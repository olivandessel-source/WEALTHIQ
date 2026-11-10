"""Deterministic financial maths: profile metrics, expense detection, simulations, sample data."""
import random
import re
import statistics
from collections import defaultdict
from datetime import date, timedelta

ASSET_CLASSES = ["stocks_etfs", "index_funds", "precious_metals", "real_estate", "crypto", "cash_savings"]
ASSET_LABELS = {
    "stocks_etfs": "Stocks & ETFs", "index_funds": "Index funds", "precious_metals": "Precious metals",
    "real_estate": "Real estate", "crypto": "Crypto", "cash_savings": "Cash & savings",
}
HIGH_INTEREST = 7.0


def _sum(items, key):
    return round(sum(float(i.get(key) or 0) for i in items), 2)


def compute_metrics(p: dict) -> dict:
    income = float(p.get("monthly_income") or 0)
    expenses = float(p.get("monthly_expenses") or 0)
    cash = float(p.get("cash_balance") or 0)
    emergency = float(p.get("emergency_savings") or 0)
    investments = p.get("investments") or []
    debts = p.get("debts") or []
    upcoming = p.get("upcoming_expenses") or []

    inv_total = _sum(investments, "value")
    debt_total = _sum(debts, "balance")
    min_payments = _sum(debts, "min_payment")
    surplus = round(income - expenses - min_payments, 2)
    savings_rate = round(surplus / income * 100, 1) if income > 0 else 0.0
    em_months = round(emergency / expenses, 1) if expenses > 0 else 0.0
    risk = p.get("risk_tolerance", "medium")
    em_target = {"low": 6, "medium": 4.5, "high": 3}.get(risk, 4.5)
    high_debts = [d for d in debts if float(d.get("interest_rate") or 0) >= HIGH_INTEREST]
    upcoming_12m = round(sum(float(u.get("amount") or 0) for u in upcoming if int(u.get("due_in_months") or 0) <= 12), 2)
    available_cash = round(max(cash - expenses - upcoming_12m, 0), 2)

    by_class = defaultdict(float)
    for i in investments:
        by_class[i.get("asset_class", "stocks_etfs")] += float(i.get("value") or 0)
    by_class["cash_savings"] += cash + emergency
    total_assets = sum(by_class.values())
    current_alloc = [
        {"asset_class": c, "label": ASSET_LABELS[c], "value": round(by_class.get(c, 0), 2),
         "pct": round(by_class.get(c, 0) / total_assets * 100, 1) if total_assets else 0}
        for c in ASSET_CLASSES
    ]

    # Health score: transparent weighted components, each 0-100.
    comp = {
        "emergency_fund": min(em_months / em_target, 1) * 100 if em_target else 0,
        "savings_rate": min(max(savings_rate, 0) / 20, 1) * 100,
        "debt_load": 100 - min((debt_total / (income * 12)) * 100, 100) if income > 0 else (100 if debt_total == 0 else 0),
        "high_interest_debt": 0 if high_debts else 100,
        "diversification": min(sum(1 for a in current_alloc if a["pct"] >= 5) / 4, 1) * 100,
    }
    weights = {"emergency_fund": 0.3, "savings_rate": 0.25, "debt_load": 0.15, "high_interest_debt": 0.15, "diversification": 0.15}
    score = round(sum(comp[k] * w for k, w in weights.items()))

    return {
        "net_worth": round(cash + emergency + inv_total - debt_total, 2),
        "total_assets": round(total_assets, 2),
        "investments_total": inv_total,
        "debt_total": debt_total,
        "debt_min_payments": min_payments,
        "monthly_surplus": surplus,
        "savings_rate": savings_rate,
        "emergency_months": em_months,
        "emergency_target_months": em_target,
        "emergency_gap": round(max(em_target * expenses - emergency, 0), 2),
        "high_interest_debts": [{"name": d.get("name"), "balance": d.get("balance"), "interest_rate": d.get("interest_rate")} for d in high_debts],
        "upcoming_12m": upcoming_12m,
        "available_cash": available_cash,
        "debt_to_income": round(debt_total / (income * 12) * 100, 1) if income > 0 else None,
        "current_allocation": current_alloc,
        "health_score": score,
        "health_components": {k: round(v) for k, v in comp.items()},
    }


def _norm_merchant(m: str) -> str:
    return re.sub(r"[^a-z]", "", (m or "").lower())[:18]


def detect_expenses(txs: list) -> dict:
    spend = [t for t in txs if float(t.get("amount") or 0) < 0]
    by_merchant = defaultdict(list)
    for t in spend:
        by_merchant[_norm_merchant(t["merchant"])].append(t)

    recurring = []
    for _, items in by_merchant.items():
        months = {t["date"][:7] for t in items}
        if len(months) < 2:
            continue
        amounts = [abs(float(t["amount"])) for t in sorted(items, key=lambda x: x["date"])]
        med = statistics.median(amounts)
        if med == 0 or max(amounts) / med > 1.6 or min(amounts) / med < 0.6:
            continue
        first, last = amounts[0], amounts[-1]
        recurring.append({
            "merchant": items[-1]["merchant"], "category": items[-1].get("category", "Other"),
            "monthly_cost": round(last, 2), "annual_cost": round(last * 12, 2), "occurrences": len(items),
            "price_change_pct": round((last - first) / first * 100, 1) if first else 0,
            "last_charged": max(t["date"] for t in items),
        })
    recurring.sort(key=lambda r: -r["monthly_cost"])

    by_cat = defaultdict(list)
    for t in spend:
        by_cat[t.get("category", "Other")].append(t)
    unusual = []
    for cat, items in by_cat.items():
        vals = [abs(float(t["amount"])) for t in items]
        if len(vals) < 3:
            continue
        med = statistics.median(vals)
        for t in items:
            v = abs(float(t["amount"]))
            if v > max(med * 2.5, 50):
                unusual.append({**{k: t[k] for k in ("id", "date", "merchant", "category", "amount")},
                                "reason": f"{round(v / med, 1)}x your typical {cat.lower()} transaction (median €{med:.0f})"})
    unusual.sort(key=lambda u: u["amount"])

    month_cat = defaultdict(lambda: defaultdict(float))
    for t in spend:
        month_cat[t["date"][:7]][t.get("category", "Other")] += abs(float(t["amount"]))
    months_sorted = sorted(month_cat)
    monthly = [{"month": m, "total": round(sum(month_cat[m].values()), 2), **{k: round(v, 2) for k, v in month_cat[m].items()}} for m in months_sorted]

    sub_monthly = round(sum(r["monthly_cost"] for r in recurring if r["category"] == "Subscriptions"), 2)
    creep = [r for r in recurring if r["price_change_pct"] > 0]
    return {
        "recurring": recurring,
        "subscriptions_monthly": sub_monthly,
        "subscriptions_annual": round(sub_monthly * 12, 2),
        "price_increases": creep,
        "unusual": unusual,
        "monthly_by_category": monthly,
        "categories": sorted(by_cat.keys()),
        "transaction_count": len(txs),
    }


# Long-run nominal assumptions (annual return %, volatility %) — illustrative, not forecasts.
STRATEGIES = {
    "cash": {"label": "Cash savings only", "ret": 2.0, "vol": 0.5},
    "conservative": {"label": "Conservative (30/70 stocks/bonds)", "ret": 4.0, "vol": 6.0},
    "balanced": {"label": "Balanced (60/40)", "ret": 5.5, "vol": 10.0},
    "growth": {"label": "Growth (90/10 global equity)", "ret": 7.0, "vol": 15.0},
}


def simulate(start: float, monthly: float, years: int, inflation: float, fee: float, strategies: list, runs: int = 600, seed: int = 42) -> dict:
    rng = random.Random(seed)
    months = years * 12
    out = {}
    for key in strategies:
        s = STRATEGIES[key]
        mu = (s["ret"] - fee) / 100 / 12
        sigma = s["vol"] / 100 / (12 ** 0.5)
        yearly = [[] for _ in range(years + 1)]
        for _ in range(runs):
            v = start
            yearly[0].append(v)
            for m in range(1, months + 1):
                v = v * (1 + rng.gauss(mu, sigma)) + monthly
                if m % 12 == 0:
                    yearly[m // 12].append(v / ((1 + inflation / 100) ** (m / 12)))
        pct = []
        for y, vals in enumerate(yearly):
            vals.sort()
            n = len(vals)
            pct.append({"year": y, "p10": round(vals[int(n * 0.1)], 0), "p50": round(vals[n // 2], 0), "p90": round(vals[int(n * 0.9)], 0)})
        loss_prob = sum(1 for v in yearly[-1] if v < start + monthly * months) / len(yearly[-1])
        out[key] = {"label": s["label"], "assumed_return": s["ret"], "assumed_volatility": s["vol"], "series": pct,
                    "prob_below_contributed": round(loss_prob * 100, 1)}
    return {"strategies": out, "total_contributed": round(start + monthly * months, 2),
            "contributed_real_note": "Values shown in today's euros (inflation-adjusted)."}


def sample_profile() -> dict:
    return {
        "full_name": "Sample user", "age": 34, "country": "Germany", "employment": "Employed (permanent)",
        "cash_balance": 6800, "monthly_income": 3900, "monthly_expenses": 2650, "emergency_savings": 5200,
        "risk_tolerance": "medium", "horizon_years": 20, "dependents": 0,
        "investments": [
            {"name": "Vanguard FTSE All-World ETF", "asset_class": "index_funds", "value": 14200},
            {"name": "Individual tech stocks", "asset_class": "stocks_etfs", "value": 3100},
            {"name": "Bitcoin", "asset_class": "crypto", "value": 1900},
        ],
        "debts": [
            {"name": "Credit card", "balance": 2300, "interest_rate": 19.9, "min_payment": 70},
            {"name": "Car loan", "balance": 9400, "interest_rate": 5.4, "min_payment": 260},
        ],
        "goals": [
            {"name": "Apartment down payment", "target_amount": 45000, "target_year": date.today().year + 5, "priority": "high"},
            {"name": "Retire comfortably", "target_amount": 600000, "target_year": date.today().year + 31, "priority": "medium"},
        ],
        "upcoming_expenses": [{"name": "Summer holiday", "amount": 1800, "due_in_months": 3}],
        "is_sample": True,
    }


def sample_transactions() -> list:
    today = date.today()
    rows = []

    def add(days_ago, merchant, category, amount):
        rows.append({"date": (today - timedelta(days=days_ago)).isoformat(), "merchant": merchant, "category": category, "amount": amount})

    for m in range(3):
        base = m * 30
        add(base + 1, "Employer GmbH salary", "Income", 3900)
        add(base + 2, "Rent - Hausverwaltung", "Housing", -1150)
        add(base + 3, "Netflix", "Subscriptions", -17.99 if m == 0 else -13.99)
        add(base + 4, "Spotify", "Subscriptions", -10.99)
        add(base + 5, "McFit Gym", "Subscriptions", -29.90)
        add(base + 6, "Adobe Creative Cloud", "Subscriptions", -66.45 if m == 0 else -59.49)
        add(base + 7, "Disney+", "Subscriptions", -9.99)
        add(base + 8, "Amazon Prime", "Subscriptions", -8.99)
        add(base + 9, "iCloud Storage", "Subscriptions", -2.99)
        add(base + 10, "Stadtwerke Energy", "Utilities", -95)
        add(base + 10, "Telekom Mobile", "Utilities", -39.95)
        for i, amt in enumerate([-82.4, -64.1, -91.7, -55.3]):
            add(base + 11 + i * 4, "REWE", "Groceries", amt)
        for i, amt in enumerate([-18.5, -32.0, -24.9]):
            add(base + 12 + i * 5, "Lieferando", "Eating out", amt)
        add(base + 14, "DB Bahn", "Transport", -49)
        add(base + 20, "Shell", "Transport", -61.2)
    add(9, "MediaMarkt", "Shopping", -749)
    add(16, "Zalando", "Shopping", -89.9)
    add(40, "Zalando", "Shopping", -64.5)
    add(70, "H&M", "Shopping", -42)
    add(13, "Bar Centrale", "Eating out", -146)
    return rows
