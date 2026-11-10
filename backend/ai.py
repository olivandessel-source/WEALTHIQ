"""Claude prompts for the five AI systems + the Next-€ advisor, streamed as SSE."""
import json
import os
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

MODEL = ("anthropic", "claude-opus-5-5")

BASE_SYSTEM = """You are the analysis engine of AuraFinance, a read-only, EU-based personal finance education and analytics tool.
Hard rules:
- You are NOT a licensed investment adviser. Under MiFID II, regulated personalised investment advice requires an authorised firm; you provide educational information and general financial insights tailored to the user's own data. Never name a specific product/ticker as a "buy" — talk about asset classes and product types (e.g. "a broad, low-cost global equity ETF").
- Never guarantee or promise returns. Use words like "could", "historically", "may". Always mention risks, fees and the possibility of losses.
- Never recommend investing all available money. Consider liquidity, upcoming expenses, emergency savings, and high-interest debt first when relevant. Saving, paying down debt or holding cash is often the better choice.
- Base everything strictly on the numbers provided. Do not invent balances, transactions or market data. If data is missing, say so in "data_gaps".
- Currency is EUR. Be concise, concrete and specific to this person.
- Output ONLY one valid JSON object matching the requested schema. No markdown, no code fences, no commentary."""

SCHEMAS = {
    "brain": """{
 "headline": "one-sentence summary of their financial position",
 "summary": "2-3 sentences",
 "strengths": ["..."],
 "concerns": ["..."],
 "insights": [{"title": "...", "detail": "...", "priority": "high|medium|low", "category": "liquidity|debt|saving|investing|spending|goals", "action": "concrete next step", "info_type": "educational|general_insight"}],
 "goal_assessment": [{"goal": "...", "on_track": true, "comment": "..."}],
 "data_gaps": ["..."]
}""",
    "allocation": """{
 "stage": "foundation|building|growing|preserving",
 "stage_explanation": "why they are in this stage",
 "investable_now": 0,
 "investable_explanation": "how much of their money could reasonably be invested now and why (after emergency fund, debts, upcoming expenses)",
 "target_allocation": [{"asset_class": "stocks_etfs|index_funds|precious_metals|real_estate|crypto|cash_savings", "pct": 0, "amount": 0, "why": "...", "risks": "...", "typical_fees": "e.g. ETF TER 0.07-0.25% p.a.", "alternatives": "..."}],
 "rebalancing_moves": ["concrete moves from current to target, e.g. stop adding to X"],
 "how_strategy_evolves": [{"milestone": "e.g. net worth €100k", "change": "..."}],
 "key_risks": ["..."]
}
target_allocation pct must sum to 100 and cover all six asset classes (0 allowed). amount = pct of the user's total assets.""",
    "opportunities": """{
 "market_context": "what the provided live prices/changes indicate, honestly; no predictions",
 "opportunities": [{"title": "...", "type": "investment|efficiency|tax|debt|savings", "detail": "...", "potential_benefit": "...", "risks": "...", "effort": "low|medium|high", "estimated_annual_impact_eur": 0}],
 "risks_to_watch": [{"title": "...", "detail": "...", "severity": "high|medium|low"}]
}
Efficiency ideas may include high-yield savings accounts, refinancing, tax-advantaged accounts available in their country, fee reduction. estimated_annual_impact_eur must be a conservative estimate from their own numbers, or 0 if unknown.""",
    "expenses": """{
 "summary": "...",
 "savings_ideas": [{"title": "...", "detail": "...", "monthly_saving_eur": 0, "difficulty": "easy|medium|hard"}],
 "subscription_verdicts": [{"merchant": "...", "verdict": "keep|review|cancel_candidate", "reason": "..."}],
 "pattern_notes": ["..."]
}
Base savings on the detected recurring charges, price increases and unusual transactions provided.""",
    "next_money": """{
 "verdict": "one sentence: what is the most sensible use of this amount for this person",
 "splits": [{"label": "short action, e.g. Top up emergency fund", "category": "emergency_fund|debt_repayment|investing|upcoming_expenses|goal|cash_buffer", "amount": 0, "why": "personal reason referencing their numbers", "benefits": "...", "risks": "...", "alternatives": "..."}],
 "not_recommended": [{"option": "...", "reason": "..."}],
 "what_would_change_this": ["situations that would change this recommendation"],
 "info_type": "general_insight"
}
The split amounts must sum exactly to the amount given. Use 1-5 splits.""",
}


def _llm_key() -> str:
    return os.environ["EMERGENT_LLM_KEY"]


def build_prompt(module: str, context: dict) -> str:
    return (f"Task: {module}\nUser financial data and computed metrics (JSON):\n{json.dumps(context, default=str)}\n\n"
            f"Respond with JSON matching this schema:\n{SCHEMAS[module]}")


def parse_json(text: str) -> dict:
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    start, end = t.find("{"), t.rfind("}")
    return json.loads(t[start:end + 1])


async def stream_module(module: str, context: dict):
    """Yields ('delta', str) events, then ('done', dict) or ('error', str)."""
    chat = LlmChat(api_key=_llm_key(), session_id=f"{module}-{uuid.uuid4()}", system_message=BASE_SYSTEM) \
        .with_model(*MODEL).with_params(max_tokens=6000)
    buf = []
    try:
        async for ev in chat.stream_message(UserMessage(text=build_prompt(module, context))):
            if isinstance(ev, TextDelta):
                buf.append(ev.content)
                yield "delta", ev.content
            elif isinstance(ev, StreamDone):
                break
        yield "done", parse_json("".join(buf))
    except (ValueError, json.JSONDecodeError):
        yield "error", "The AI returned an unreadable answer. Please try again."
    except Exception as exc:  # upstream LLM failure
        yield "error", f"AI service error: {str(exc)[:200]}"
