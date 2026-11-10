import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, XCircle, RotateCw } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { ConsentGate, RunButton, InfoTag, Thinking } from "@/components/Ai";
import { eur } from "@/lib/api";

const PRESETS = [100, 500, 1000, 5000];
const COLORS = { emergency_fund: "#06B6D4", debt_repayment: "#F43F5E", investing: "#10B981", upcoming_expenses: "#F59E0B", goal: "#8B5CF6", cash_buffer: "#94A3B8" };

const Split = ({ s, total, i }) => (
  <div data-testid={`next-split-${i}`} className="panel p-5 rise" style={{ animationDelay: `${i * 0.07}s` }}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[s.category] || "#94A3B8" }} /><span className="font-semibold">{s.label}</span></div>
      <span className="mono text-lg font-semibold">{eur(s.amount, true)}</span>
    </div>
    <div className="h-1.5 rounded-full bg-[var(--elev)] mt-3"><div className="h-1.5 rounded-full" style={{ width: `${(s.amount / total) * 100}%`, background: COLORS[s.category] || "#94A3B8" }} /></div>
    <p className="text-sm text-slate-300 mt-3">{s.why}</p>
    <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
      <div><div className="label text-emerald-400">Benefits</div><p className="text-slate-400">{s.benefits}</p></div>
      <div><div className="label text-rose-400">Risks</div><p className="text-slate-400">{s.risks}</p></div>
      <div><div className="label text-cyan-400">Alternatives</div><p className="text-slate-400">{s.alternatives}</p></div>
    </div>
  </div>
);

const Result = ({ r, amount }) => (
  <div className="space-y-4" data-testid="next-money-result">
    <div className="panel glow p-6">
      <div className="flex flex-wrap gap-2 mb-3"><InfoTag type={r.info_type} /><span className="tag tag-muted">Nothing is executed automatically</span></div>
      <div data-testid="next-money-verdict" className="text-lg font-display font-semibold">{r.verdict}</div>
      <div className="flex h-3 rounded-full overflow-hidden mt-5 bg-[var(--elev)]">
        {r.splits?.map((s, i) => <div key={i} title={s.label} style={{ width: `${(s.amount / amount) * 100}%`, background: COLORS[s.category] || "#94A3B8" }} />)}
      </div>
    </div>
    {r.splits?.map((s, i) => <Split key={i} s={s} total={amount} i={i} />)}
    {r.not_recommended?.length > 0 && (
      <div className="panel p-5"><h3 className="font-semibold mb-3">Not recommended right now</h3>
        {r.not_recommended.map((n) => <div key={n.option} className="flex gap-2 text-sm mb-2"><XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" /><div><span className="font-medium">{n.option}: </span><span className="text-slate-400">{n.reason}</span></div></div>)}
      </div>
    )}
    {r.what_would_change_this?.length > 0 && <div className="panel p-5 text-sm"><h3 className="font-semibold mb-2">What would change this advice</h3><ul className="list-disc pl-5 text-slate-400 space-y-1">{r.what_would_change_this.map((w) => <li key={w}>{w}</li>)}</ul></div>}
  </div>
);

export default function NextMoney() {
  const { api, analysis } = useFinance();
  const [amount, setAmount] = useState(500);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => { api.get("/ai/next-money/history").then(setHistory).catch(() => {}); }, [api]);

  const ask = async () => {
    if (!(amount > 0)) return toast.error("Enter an amount above €0");
    setRunning(true); setProgress(0);
    try {
      const d = await api.stream("/ai/next-money", { amount, note }, setProgress);
      setResult(d); setHistory((h) => [d, ...h].slice(0, 20));
    } catch (e) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rise">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">What should I do with my next <span className="text-emerald-400 mono">{eur(amount || 0)}</span>?</h1>
        <p className="text-slate-400 mt-3 max-w-2xl text-sm">The AI weighs your emergency fund, debts, upcoming costs, goals and risk tolerance before suggesting anything. Investing everything is never the default.</p>
      </div>
      <ConsentGate>
        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          <div className="panel p-6 space-y-5 lg:sticky lg:top-6">
            <label className="block"><span className="label">Amount available now</span>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 mono">€</span>
                <input data-testid="next-amount-input" type="number" min={1} className="field mono text-2xl pl-8 py-3" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </label>
            <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p} data-testid={`next-preset-${p}`} onClick={() => setAmount(p)} className={`tag cursor-pointer ${amount === p ? "tag-emerald" : "tag-muted"}`}>{eur(p)}</button>)}</div>
            <label className="block"><span className="label">Context (optional)</span>
              <textarea data-testid="next-note-input" className="field h-20 resize-none" maxLength={300} placeholder="e.g. tax refund, I may need a new laptop soon" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <RunButton testId="next-submit-button" onClick={ask} running={running} progress={progress} hasResult={false} label="Get my personal plan" />
            {analysis && <p className="text-xs text-slate-500">Considering: {analysis.metrics.emergency_months} months emergency fund, {eur(analysis.metrics.debt_total)} debt, {eur(analysis.metrics.upcoming_12m)} upcoming costs.</p>}
          </div>
          <div className="space-y-4">
            <Thinking running={running} />
            {!running && result && <Result r={result.result} amount={result.amount} />}
            {!running && !result && <div className="panel p-10 text-center text-slate-500 text-sm"><Coins className="mx-auto mb-3 text-slate-600" />Enter an amount and get a split tailored to you.</div>}
            {history.length > 0 && (
              <div className="panel p-5"><h3 className="font-semibold mb-3 text-sm">Previous questions</h3>
                {history.slice(0, 6).map((h) => (
                  <button key={h.id} data-testid={`next-history-${h.id}`} onClick={() => setResult(h)} className="w-full flex items-center justify-between text-sm py-2 border-t border-[var(--line)] text-left hover:text-emerald-300">
                    <span className="mono">{eur(h.amount)}</span><span className="text-slate-500 truncate mx-3 flex-1">{h.result?.verdict}</span><RotateCw size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ConsentGate>
    </div>
  );
}
