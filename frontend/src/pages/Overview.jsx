import { Link } from "react-router-dom";
import { Wallet, Landmark, PiggyBank, Gauge, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useAiReport, ConsentGate, RunButton, Stamp, InfoTag, Thinking } from "@/components/Ai";
import { eur, pct } from "@/lib/api";

const Stat = ({ label, value, sub, icon: I, id, tone = "text-slate-100" }) => (
  <div className="panel p-5 rise">
    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-500"><span>{label}</span>{I && <I size={15} />}</div>
    <div data-testid={id} className={`mono text-2xl sm:text-3xl font-semibold mt-3 ${tone}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
  </div>
);

const PRI = { high: "tag-rose", medium: "tag-amber", low: "tag-cyan" };
const COMP_LABEL = { emergency_fund: "Emergency fund", savings_rate: "Savings rate", debt_load: "Debt load", high_interest_debt: "No high-interest debt", diversification: "Diversification" };

const Health = ({ m }) => (
  <div className="panel p-5 sm:p-6 rise rise-1">
    <div className="flex items-baseline justify-between"><h3 className="font-semibold">Financial health score</h3><span data-testid="health-score" className="mono text-3xl font-bold text-emerald-400">{m.health_score}<span className="text-sm text-slate-500">/100</span></span></div>
    <p className="text-xs text-slate-500 mt-1">Transparent formula from your own numbers — weights: emergency 30%, savings 25%, debt 15%, high-interest 15%, diversification 15%.</p>
    <div className="mt-4 space-y-2.5">
      {Object.entries(m.health_components).map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{COMP_LABEL[k]}</span><span className="mono">{v}</span></div>
          <div className="h-1.5 rounded-full bg-[var(--elev)]"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${v}%` }} /></div>
        </div>
      ))}
    </div>
  </div>
);

const BrainReport = ({ r }) => (
  <div className="space-y-4" data-testid="brain-report">
    <div className="panel glow p-6">
      <div className="text-lg font-display font-semibold">{r.headline}</div>
      <p className="text-sm text-slate-400 mt-2">{r.summary}</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
        <div>{r.strengths?.map((s) => <div key={s} className="flex gap-2 mb-1.5"><CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />{s}</div>)}</div>
        <div>{r.concerns?.map((s) => <div key={s} className="flex gap-2 mb-1.5"><AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />{s}</div>)}</div>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      {r.insights?.map((i, n) => (
        <div key={n} data-testid={`insight-card-${n}`} className="panel panel-hover p-5">
          <div className="flex flex-wrap gap-2 mb-2"><span className={`tag ${PRI[i.priority] || "tag-muted"}`}>{i.priority}</span><span className="tag tag-muted">{i.category}</span><InfoTag type={i.info_type} /></div>
          <div className="font-semibold">{i.title}</div>
          <p className="text-sm text-slate-400 mt-1.5">{i.detail}</p>
          {i.action && <p className="text-sm text-emerald-300 mt-3 flex gap-2"><ArrowRight size={15} className="shrink-0 mt-0.5" />{i.action}</p>}
        </div>
      ))}
    </div>
    {r.goal_assessment?.length > 0 && (
      <div className="panel p-5"><h3 className="font-semibold mb-3">Goals</h3>
        {r.goal_assessment.map((g) => <div key={g.goal} className="flex gap-3 py-2 border-t border-[var(--line)] text-sm"><span className={`tag ${g.on_track ? "tag-emerald" : "tag-amber"}`}>{g.on_track ? "On track" : "Behind"}</span><div><div className="font-medium">{g.goal}</div><div className="text-slate-400">{g.comment}</div></div></div>)}
      </div>
    )}
    {r.data_gaps?.length > 0 && <p className="text-xs text-slate-500">Missing data that would improve this: {r.data_gaps.join("; ")}</p>}
  </div>
);

export default function Overview() {
  const { analysis, profile } = useFinance();
  const { report, run, running, progress } = useAiReport("brain");
  if (!analysis) return null;
  const m = analysis.metrics;
  return (
    <div className="space-y-6">
      <div className="rise">
        <p className="text-sm text-slate-500">Hello{profile.full_name && !profile.is_sample ? `, ${profile.full_name}` : ""}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your financial brain</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat id="net-worth-display" label="Net worth" icon={Landmark} value={eur(m.net_worth)} sub={`${eur(m.total_assets)} assets · ${eur(m.debt_total)} debt`} />
        <Stat id="monthly-surplus-display" label="Monthly surplus" icon={Wallet} value={eur(m.monthly_surplus)} sub={`Savings rate ${pct(m.savings_rate)} (after min. debt payments)`} tone={m.monthly_surplus < 0 ? "text-rose-400" : "text-slate-100"} />
        <Stat id="emergency-months-display" label="Emergency fund" icon={PiggyBank} value={`${m.emergency_months} mo`} sub={m.emergency_gap > 0 ? `${eur(m.emergency_gap)} short of ${m.emergency_target_months} months` : `Target of ${m.emergency_target_months} months met`} tone={m.emergency_gap > 0 ? "text-amber-400" : "text-emerald-400"} />
        <Stat id="available-cash-display" label="Free cash now" icon={Gauge} value={eur(m.available_cash)} sub={`After 1 month expenses + ${eur(m.upcoming_12m)} upcoming`} />
      </div>
      <div className="grid lg:grid-cols-[1fr_2fr] gap-6 items-start">
        <div className="space-y-4">
          <Health m={m} />
          {m.high_interest_debts.length > 0 && (
            <div className="panel p-5 border-rose-500/30"><div className="text-sm font-semibold text-rose-300 flex gap-2"><AlertTriangle size={16} />High-interest debt</div>
              {m.high_interest_debts.map((d) => <div key={d.name} className="flex justify-between text-sm mt-2"><span>{d.name}</span><span className="mono">{eur(d.balance)} @ {d.interest_rate}%</span></div>)}
            </div>
          )}
          <Link to="/app/next" data-testid="overview-next-money-link" className="panel panel-hover p-5 block"><div className="text-xs text-slate-500 uppercase tracking-wider">Signature</div><div className="font-semibold mt-1 flex items-center justify-between">What should I do with my next €500? <ArrowRight size={16} /></div></Link>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">AI insights</h2><Stamp at={report?.created_at} /></div>
            {profile.ai_consent && <RunButton testId="brain-run-button" onClick={run} running={running} progress={progress} hasResult={!!report} />}
          </div>
          <ConsentGate>
            <Thinking running={running} />
            {!running && report && <BrainReport r={report.result} />}
            {!running && !report && <div className="panel p-6 text-sm text-slate-400">Run an analysis to get personalised insights built from all the numbers on this page.</div>}
          </ConsentGate>
        </div>
      </div>
    </div>
  );
}
