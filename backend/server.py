import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

try:
    from backend.clerk_auth import clerk_router, require_user
    from backend import finance, ai
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user
    import finance
    import ai

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

INDEXES: dict[str, list[IndexModel]] = {
    "profiles": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "transactions": [
        IndexModel([("user_id", ASCENDING), ("date", DESCENDING)], name="user_date"),
        IndexModel([("id", ASCENDING)], name="id", unique=True),
    ],
    "ai_reports": [IndexModel([("user_id", ASCENDING), ("module", ASCENDING)], name="user_module", unique=True)],
    "advice_history": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logging.getLogger(__name__).error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)

app = FastAPI()
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
AssetClass = Literal["stocks_etfs", "index_funds", "precious_metals", "real_estate", "crypto", "cash_savings"]


class Investment(BaseModel):
    name: str = Field(max_length=120)
    asset_class: AssetClass
    value: float = Field(ge=0)


class Debt(BaseModel):
    name: str = Field(max_length=120)
    balance: float = Field(ge=0)
    interest_rate: float = Field(ge=0, le=100)
    min_payment: float = Field(ge=0)


class Goal(BaseModel):
    name: str = Field(max_length=120)
    target_amount: float = Field(ge=0)
    target_year: int = Field(ge=2000, le=2150)
    priority: Literal["high", "medium", "low"] = "medium"


class Upcoming(BaseModel):
    name: str = Field(max_length=120)
    amount: float = Field(ge=0)
    due_in_months: int = Field(ge=0, le=120)


class ProfileIn(BaseModel):
    full_name: str = Field("", max_length=120)
    age: int = Field(ge=16, le=110)
    country: str = Field("", max_length=60)
    employment: str = Field("", max_length=60)
    dependents: int = Field(0, ge=0, le=20)
    cash_balance: float = Field(ge=0)
    monthly_income: float = Field(ge=0)
    monthly_expenses: float = Field(ge=0)
    emergency_savings: float = Field(ge=0)
    risk_tolerance: Literal["low", "medium", "high"]
    horizon_years: int = Field(ge=1, le=60)
    investments: List[Investment] = []
    debts: List[Debt] = []
    goals: List[Goal] = []
    upcoming_expenses: List[Upcoming] = []


class Profile(ProfileIn):
    user_id: str
    is_sample: bool = False
    ai_consent: bool = False
    updated_at: str = Field(default_factory=now_iso)


class TransactionIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    merchant: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    amount: float


class Transaction(TransactionIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str


class ConsentIn(BaseModel):
    ai_consent: bool


class NextMoneyIn(BaseModel):
    amount: float = Field(gt=0, le=10_000_000)
    note: str = Field("", max_length=300)


class SimulateIn(BaseModel):
    start: float = Field(ge=0, le=100_000_000)
    monthly: float = Field(ge=0, le=1_000_000)
    years: int = Field(ge=1, le=50)
    inflation: float = Field(2.5, ge=0, le=15)
    fee: float = Field(0.25, ge=0, le=5)


# ---------- Helpers ----------
async def get_profile(uid: str) -> Optional[dict]:
    doc = await db.profiles.find_one({"user_id": uid}, {"_id": 0})
    return Profile(**doc).model_dump() if doc else None


async def require_profile(uid: str) -> dict:
    p = await get_profile(uid)
    if not p:
        raise HTTPException(404, "Create your financial profile first")
    return p


async def get_txs(uid: str) -> list:
    docs = await db.transactions.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(5000)
    return [Transaction(**d).model_dump() for d in docs]


# ---------- Profile ----------
@api.get("/profile")
async def read_profile(user: dict = Depends(require_user)):
    return {"profile": await get_profile(user["user_id"])}


@api.put("/profile")
async def save_profile(body: ProfileIn, user: dict = Depends(require_user)):
    uid = user["user_id"]
    existing = await get_profile(uid)
    prof = Profile(**body.model_dump(), user_id=uid, is_sample=False,
                   ai_consent=bool(existing and existing.get("ai_consent")))
    await db.profiles.replace_one({"user_id": uid}, prof.model_dump(), upsert=True)
    await db.ai_reports.delete_many({"user_id": uid})  # stale once inputs change
    return {"profile": prof.model_dump()}


@api.post("/profile/sample")
async def load_sample(user: dict = Depends(require_user)):
    uid = user["user_id"]
    existing = await get_profile(uid)
    prof = Profile(**finance.sample_profile(), user_id=uid, ai_consent=bool(existing and existing.get("ai_consent")))
    await db.profiles.replace_one({"user_id": uid}, prof.model_dump(), upsert=True)
    await db.transactions.delete_many({"user_id": uid})
    txs = [Transaction(**t, user_id=uid).model_dump() for t in finance.sample_transactions()]
    await db.transactions.insert_many([dict(t) for t in txs])
    await db.ai_reports.delete_many({"user_id": uid})
    return {"profile": prof.model_dump()}


@api.put("/consent")
async def set_consent(body: ConsentIn, user: dict = Depends(require_user)):
    res = await db.profiles.update_one({"user_id": user["user_id"]}, {"$set": {"ai_consent": body.ai_consent, "consent_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Create your financial profile first")
    return {"ai_consent": body.ai_consent}


# ---------- Transactions ----------
@api.get("/transactions")
async def list_transactions(user: dict = Depends(require_user)):
    return await get_txs(user["user_id"])


@api.post("/transactions")
async def add_transaction(body: TransactionIn, user: dict = Depends(require_user)):
    tx = Transaction(**body.model_dump(), user_id=user["user_id"])
    await db.transactions.insert_one(tx.model_dump())
    return tx.model_dump()


@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, user: dict = Depends(require_user)):
    res = await db.transactions.delete_one({"id": tx_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Deterministic analysis ----------
@api.get("/analysis")
async def analysis(user: dict = Depends(require_user)):
    uid = user["user_id"]
    p = await require_profile(uid)
    return {"metrics": finance.compute_metrics(p), "expenses": finance.detect_expenses(await get_txs(uid))}


@api.post("/simulate")
async def simulate(body: SimulateIn, user: dict = Depends(require_user)):
    return await run_in_threadpool(finance.simulate, body.start, body.monthly, body.years, body.inflation, body.fee, list(finance.STRATEGIES))


# ---------- Market data (CoinGecko, cached) ----------
MARKET_IDS = {"bitcoin": "Bitcoin", "ethereum": "Ethereum", "pax-gold": "Gold (1 troy oz, via PAXG)", "kinesis-silver": "Silver (1 troy oz, via KAG)"}
_market_cache = {"data": None, "ts": 0}


def _fetch_market():
    r = requests.get("https://api.coingecko.com/api/v3/coins/markets", timeout=15, params={
        "vs_currency": "eur", "ids": ",".join(MARKET_IDS), "price_change_percentage": "24h,7d,30d"},
        headers={"User-Agent": "AuraFinance/1.0", "Accept": "application/json"})
    r.raise_for_status()
    return [{"id": c["id"], "name": MARKET_IDS[c["id"]], "symbol": c["symbol"].upper(), "price_eur": c["current_price"],
             "change_24h": c.get("price_change_percentage_24h_in_currency"), "change_7d": c.get("price_change_percentage_7d_in_currency"),
             "change_30d": c.get("price_change_percentage_30d_in_currency"), "high_24h": c.get("high_24h"), "low_24h": c.get("low_24h"),
             "last_updated": c.get("last_updated")} for c in r.json()]


async def market_data() -> dict:
    if not _market_cache["data"] or time.time() - _market_cache["ts"] > 180:
        try:
            _market_cache["data"] = await run_in_threadpool(_fetch_market)
            _market_cache["ts"] = time.time()
        except Exception as exc:
            logging.getLogger(__name__).warning("market fetch failed: %s", exc)
    if not _market_cache["data"]:
        return {"available": False, "assets": [], "source": "CoinGecko", "fetched_at": None}
    return {"available": True, "assets": _market_cache["data"], "source": "CoinGecko",
            "fetched_at": datetime.fromtimestamp(_market_cache["ts"], timezone.utc).isoformat(),
            "stale": time.time() - _market_cache["ts"] > 600}


@api.get("/market")
async def market(user: dict = Depends(require_user)):
    return await market_data()


# ---------- AI (streamed SSE) ----------
def sse(obj) -> str:
    return f"data: {json.dumps(obj, default=str)}\n\n"


async def ai_context(uid: str, module: str, extra: dict = None) -> dict:
    p = await require_profile(uid)
    if not p.get("ai_consent"):
        raise HTTPException(403, "AI analysis needs your consent first (Privacy settings)")
    profile = {k: v for k, v in p.items() if k not in ("user_id", "full_name", "ai_consent", "updated_at")}
    ctx = {"today": datetime.now(timezone.utc).date().isoformat(), "profile": profile, "metrics": finance.compute_metrics(p)}
    if module in ("expenses", "brain"):
        exp = finance.detect_expenses(await get_txs(uid))
        ctx["expense_detection"] = {k: exp[k] for k in ("recurring", "subscriptions_monthly", "price_increases", "unusual")}
    if module == "opportunities":
        ctx["live_market"] = await market_data()
    return {**ctx, **(extra or {})}


def stream_response(module: str, ctx: dict, on_done):
    async def gen():
        yield sse({"t": "start"})
        async for kind, payload in ai.stream_module(module, ctx):
            if kind == "delta":
                yield sse({"t": "delta", "n": len(payload)})
            elif kind == "done":
                result = await on_done(payload)
                yield sse({"t": "done", "result": result})
            else:
                yield sse({"t": "error", "message": payload})
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.get("/ai/reports")
async def ai_reports(user: dict = Depends(require_user)):
    docs = await db.ai_reports.find({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0}).to_list(20)
    return {d["module"]: d for d in docs}


@api.post("/ai/report/{module}")
async def ai_report(module: Literal["brain", "allocation", "opportunities", "expenses"], user: dict = Depends(require_user)):
    uid = user["user_id"]
    ctx = await ai_context(uid, module)

    async def save(result):
        doc = {"user_id": uid, "module": module, "result": result, "created_at": now_iso()}
        await db.ai_reports.replace_one({"user_id": uid, "module": module}, doc, upsert=True)
        return {"module": module, "result": result, "created_at": doc["created_at"]}
    return stream_response(module, ctx, save)


@api.post("/ai/next-money")
async def next_money(body: NextMoneyIn, user: dict = Depends(require_user)):
    uid = user["user_id"]
    ctx = await ai_context(uid, "next_money", {"amount_available_now_eur": body.amount, "user_note": body.note})

    async def save(result):
        splits = result.get("splits") or []
        total = sum(float(s.get("amount") or 0) for s in splits)
        if splits and total > 0 and abs(total - body.amount) > 0.5:
            for s in splits:  # keep proportions, force exact total
                s["amount"] = round(float(s.get("amount") or 0) / total * body.amount, 2)
        doc = {"id": str(uuid.uuid4()), "user_id": uid, "amount": body.amount, "note": body.note, "result": result, "created_at": now_iso()}
        await db.advice_history.insert_one(dict(doc))
        return {k: v for k, v in doc.items() if k != "user_id"}
    return stream_response("next_money", ctx, save)


@api.get("/ai/next-money/history")
async def next_money_history(user: dict = Depends(require_user)):
    return await db.advice_history.find({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(20)


# ---------- GDPR ----------
@api.get("/gdpr/export")
async def gdpr_export(user: dict = Depends(require_user)):
    uid = user["user_id"]
    proj = {"_id": 0}
    return {
        "exported_at": now_iso(), "user_id": uid,
        "profile": await db.profiles.find_one({"user_id": uid}, proj),
        "transactions": await db.transactions.find({"user_id": uid}, proj).to_list(10000),
        "ai_reports": await db.ai_reports.find({"user_id": uid}, proj).to_list(100),
        "advice_history": await db.advice_history.find({"user_id": uid}, proj).to_list(1000),
    }


@api.delete("/gdpr/data")
async def gdpr_delete(user: dict = Depends(require_user)):
    uid = user["user_id"]
    for c in ("profiles", "transactions", "ai_reports", "advice_history"):
        await db[c].delete_many({"user_id": uid})
    return {"deleted": True}


@api.get("/")
async def root():
    return {"status": "ok"}


app.include_router(api)
app.include_router(clerk_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def start_index_build():
    app.state.index_task = asyncio.create_task(ensure_indexes())


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
