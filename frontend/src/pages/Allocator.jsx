import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useAiReport, ConsentGate, RunButton, Stamp, Thinking } from "@/components/Ai";
import { eur, pct } from "@/lib/api";

const COL = { stocks_etfs: "#10B981", index_funds: "#06B6D4", precious_metals: "#EAB308", real_estate: "#8B5CF6", crypto: "#F43F5E", cash_savings: "#94A3B8" };
const LAB = { stocks_etfs: "Stocks & ETFs", index_funds: "Index funds", precious_metals: "Precious metals", real_estate: "Real estate", crypto: "Crypto", cash_savings: "Cash & savings" };

const Donut = ({ data, title, id }) => (
  <div className="panel p-5" data-testid={id}>
    <h3 className="font-semibold text-sm mb-2">{title}</h3>
    <div className="h-52"><ResponsiveContainer><PieChart>
      <Pie data={data.filter((d) => d.pct > 0)} dataKey="pct" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
        {data.filter((d) => d.pct > 0).map((d) => <Cell key={d.asset_class} fill={COL[d.asset_class]} />)}
      </Pie><Tooltip formatter={(v) => pct(v)} />
    </PieChart></ResponsiveContainer></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">{data.map((d) => <div key={d.asset_class} className="flex justify-between"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full" style={{ background: COL[d.asset_class] }} />{LAB[d.asset_class]}</span><span className="mono">{pct(d.pct, 0)}</span></div>)}</div>
  </div>
);

const Report = ({ r }) => (
  <div className="space-y-4" data-testid="allocation-report">
    <div className="panel glow p-6">
      <div className="flex gap-2 items-center"><span className="tag tag-emerald capitalize">{r.stage} stage</span><span className="tag tag-muted">General insight — not regulated advice</span></div>
      <p className="text-sm text-slate-300 mt-3">{r.stage_explanation}</p>
      <div className="mt-4 flex items-baseline gap-3"><span className="label mb-0">Could reasonably invest now</span><span data-testid="investable-now" className="mono text-2xl font-semibold text-emerald-400">{eur(r.investable_now)}</span></div>
      <p className="text-sm text-slate-400 mt-1">{r.investable_explanation}</p>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      {r.target_allocation?.filter((a) => a.pct > 0).map((a) => (
        <div key={a.asset_class} className="panel panel-hover p-5" data-testid={`alloc-card-${a.asset_class}`}>
          <div className="flex justify-between items-center"><span className="font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COL[a.asset_class] }} />{LAB[a.asset_class]}</span><span className="mono">{pct(a.pct, 0)} · {eur(a.amount)}</span></div>
          <p className="text-sm text-slate-300 mt-2">{a.why}</p>
          <div className="text-xs mt-3 space-y-1.5"><p><span className="text-rose-400">Risks: </span><span className="text-slate-400">{a.risks}</span></p><p><span className="text-amber-400">Fees: </span><span className="text-slate-400">{a.typical_fees}</span></p><p><span className="text-cyan-400">Alternatives: </span><span className="text-slate-400">{a.alternatives}</span></p></div>
        </div>
      ))}
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      <div className="panel p-5"><h3 className="font-semibold mb-3">Moves to get there</h3>{r.rebalancing_moves?.map((m) => <p key={m} className="text-sm text-slate-300 flex gap-2 mb-2"><ArrowRight size={15} className="text-emerald-400 shrink-0 mt-0.5" />{m}</p>)}</div>
      <div className="panel p-5"><h3 className="font-semibold mb-3">As your wealth grows</h3>{r.how_strategy_evolves?.map((m) => <div key={m.milestone} className="text-sm mb-2.5"><div className="mono text-emerald-300 text-xs">{m.milestone}</div><div className="text-slate-400">{m.change}</div></div>)}</div>
    </div>
    <div className="panel p-5"><h3 className="font-semibold mb-3 flex gap-2 items-center"><AlertTriangle size={16} className="text-amber-400" />Key risks</h3><ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">{r.key_risks?.map((k) => <li key={k}>{k}</li>)}</ul></div>
  </div>
);

export default function Allocator() {
  const { analysis, profile } = useFinance();
  const { report, run, running, progress } = useAiReport("allocation");
  if (!analysis) return null;
  const target = report?.result?.target_allocation?.map((a) => ({ ...a, label: LAB[a.asset_class] }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Smart Asset Allocator</h1><p className="text-sm text-slate-400 mt-2">Based on your {profile.risk_tolerance} risk tolerance and {profile.horizon_years}-year horizon. <Stamp at={report?.created_at} /></p></div>
        {profile.ai_consent && <RunButton testId="allocation-run-button" onClick={run} running={running} progress={progress} hasResult={!!report} label="Build my allocation" />}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Donut id="current-allocation-chart" title={`Current (${eur(analysis.metrics.total_assets)} assets)`} data={analysis.metrics.current_allocation} />
        {target ? <Donut id="target-allocation-chart" title="AI-suggested target" data={target} /> : <div className="panel p-5 grid place-items-center text-sm text-slate-500">Target appears after analysis</div>}
      </div>
      <ConsentGate><Thinking running={running} />{!running && report && <Report r={report.result} />}</ConsentGate>
    </div>
  );
}
