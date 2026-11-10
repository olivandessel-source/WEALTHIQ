import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Repeat, TrendingUp, AlertOctagon, Trash2, Plus } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useAiReport, ConsentGate, RunButton, Stamp, Thinking } from "@/components/Ai";
import { eur, errMsg } from "@/lib/api";

const PAL = ["#10B981", "#06B6D4", "#EAB308", "#8B5CF6", "#F43F5E", "#F59E0B", "#94A3B8", "#34D399", "#22D3EE", "#A78BFA"];
const VERD = { keep: "tag-emerald", review: "tag-amber", cancel_candidate: "tag-rose" };
const today = () => new Date().toISOString().slice(0, 10);

const TxForm = ({ onAdd }) => {
  const [t, setT] = useState({ date: today(), merchant: "", category: "Groceries", amount: "" });
  const submit = (e) => { e.preventDefault(); onAdd({ ...t, amount: -Math.abs(Number(t.amount)) }).then(() => setT({ ...t, merchant: "", amount: "" })); };
  return (
    <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
      <input data-testid="tx-date-input" type="date" className="field" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} required />
      <input data-testid="tx-merchant-input" className="field" placeholder="Merchant" value={t.merchant} onChange={(e) => setT({ ...t, merchant: e.target.value })} required />
      <input data-testid="tx-category-input" className="field" placeholder="Category" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} required />
      <input data-testid="tx-amount-input" type="number" step="0.01" min="0.01" className="field mono" placeholder="Amount €" value={t.amount} onChange={(e) => setT({ ...t, amount: e.target.value })} required />
      <button data-testid="tx-add-button" className="btn-primary justify-center"><Plus size={14} />Add expense</button>
    </form>
  );
};

export default function Expenses() {
  const { api, analysis, refresh } = useFinance();
  const { report, run, running, progress } = useAiReport("expenses");
  const [txs, setTxs] = useState([]);
  const load = () => api.get("/transactions").then(setTxs).catch((e) => toast.error(String(errMsg(e))));
  useEffect(() => { load(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!analysis) return null;
  const x = analysis.expenses;
  const cats = x.categories.filter((c) => c !== "Income");

  const add = async (t) => { try { await api.post("/transactions", t); toast.success("Expense added"); await Promise.all([load(), refresh()]); } catch (e) { toast.error(String(errMsg(e))); } };
  const del = async (id) => { try { await api.del(`/transactions/${id}`); await Promise.all([load(), refresh()]); } catch (e) { toast.error(String(errMsg(e))); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Expense Detector</h1><p className="text-sm text-slate-400 mt-2">Detected automatically from your {x.transaction_count} transactions. <Stamp at={report?.created_at} /></p></div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="panel p-5"><div className="label flex gap-2"><Repeat size={13} />Subscriptions</div><div data-testid="subs-monthly" className="mono text-2xl font-semibold">{eur(x.subscriptions_monthly, true)}<span className="text-sm text-slate-500">/mo</span></div><div className="text-xs text-slate-500">{eur(x.subscriptions_annual)} per year</div></div>
        <div className="panel p-5"><div className="label flex gap-2"><TrendingUp size={13} />Price increases</div><div data-testid="price-increase-count" className="mono text-2xl font-semibold text-amber-400">{x.price_increases.length}</div><div className="text-xs text-slate-500">recurring charges got more expensive</div></div>
        <div className="panel p-5"><div className="label flex gap-2"><AlertOctagon size={13} />Unusual</div><div data-testid="unusual-count" className="mono text-2xl font-semibold text-rose-400">{x.unusual.length}</div><div className="text-xs text-slate-500">transactions far above your norm</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel p-5" data-testid="recurring-list"><h3 className="font-semibold mb-3">Recurring charges</h3>
          {x.recurring.length === 0 && <p className="text-sm text-slate-500">Need at least 2 months of transactions to detect recurring charges.</p>}
          {x.recurring.map((r) => (
            <div key={r.merchant} className="flex items-center justify-between py-2 border-t border-[var(--line)] text-sm">
              <div><div>{r.merchant}</div><div className="text-xs text-slate-500">{r.category} · {r.occurrences}×</div></div>
              <div className="text-right"><div className="mono">{eur(r.monthly_cost, true)}</div>{r.price_change_pct > 0 && <span className="tag tag-amber">+{r.price_change_pct}%</span>}</div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="panel p-5" data-testid="unusual-list"><h3 className="font-semibold mb-3">Unusual transactions</h3>
            {x.unusual.length === 0 && <p className="text-sm text-slate-500">Nothing unusual detected.</p>}
            {x.unusual.map((u) => <div key={u.id} className="py-2 border-t border-[var(--line)] text-sm"><div className="flex justify-between"><span>{u.merchant} <span className="text-slate-500 text-xs mono">{u.date}</span></span><span className="mono text-rose-300">{eur(u.amount, true)}</span></div><div className="text-xs text-slate-500">{u.reason}</div></div>)}
          </div>
          <div className="panel p-5"><h3 className="font-semibold mb-3 text-sm">Spending by month</h3>
            <div className="h-52"><ResponsiveContainer><BarChart data={x.monthly_by_category}>
              <CartesianGrid stroke="#1F2D32" vertical={false} /><XAxis dataKey="month" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} width={50} />
              <Tooltip formatter={(v) => eur(v)} cursor={{ fill: "#1A2428" }} />
              {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={PAL[i % PAL.length]} />)}
            </BarChart></ResponsiveContainer></div>
          </div>
        </div>
      </div>
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">AI savings review</h2>{analysis && <ConsentGate><RunButton testId="expenses-run-button" onClick={run} running={running} progress={progress} hasResult={!!report} label="Find savings" /></ConsentGate>}</div>
        <Thinking running={running} />
        {!running && report && (
          <div className="space-y-4" data-testid="expenses-report">
            <div className="panel glow p-5 text-sm text-slate-300">{report.result.summary}</div>
            <div className="grid md:grid-cols-3 gap-4">{report.result.savings_ideas?.map((s) => <div key={s.title} className="panel p-5"><div className="flex justify-between"><span className="font-semibold">{s.title}</span><span className="mono text-emerald-400">{eur(s.monthly_saving_eur)}/mo</span></div><p className="text-sm text-slate-400 mt-2">{s.detail}</p><span className="tag tag-muted mt-3">{s.difficulty}</span></div>)}</div>
            <div className="panel p-5"><h3 className="font-semibold mb-2 text-sm">Subscription verdicts</h3>{report.result.subscription_verdicts?.map((v) => <div key={v.merchant} className="flex gap-3 py-2 border-t border-[var(--line)] text-sm"><span className={`tag ${VERD[v.verdict] || "tag-muted"}`}>{v.verdict.replace("_", " ")}</span><span className="font-medium">{v.merchant}</span><span className="text-slate-400">{v.reason}</span></div>)}</div>
          </div>
        )}
      </section>
      <section className="panel p-5 space-y-4">
        <h3 className="font-semibold">Transactions</h3>
        <TxForm onAdd={add} />
        <div className="max-h-96 overflow-y-auto" data-testid="tx-list">
          {txs.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2 border-t border-[var(--line)] text-sm">
              <span className="mono text-xs text-slate-500 w-24">{t.date}</span><span className="flex-1 truncate">{t.merchant}</span><span className="tag tag-muted hidden sm:inline-flex">{t.category}</span>
              <span className={`mono w-24 text-right ${t.amount > 0 ? "text-emerald-400" : ""}`}>{eur(t.amount, true)}</span>
              <button data-testid={`tx-delete-${t.id}`} onClick={() => del(t.id)} className="text-slate-600 hover:text-rose-400"><Trash2 size={14} /></button>
            </div>
          ))}
          {txs.length === 0 && <p className="text-sm text-slate-500">No transactions yet. Add your expenses to detect subscriptions and unusual spending.</p>}
        </div>
      </section>
    </div>
  );
}
