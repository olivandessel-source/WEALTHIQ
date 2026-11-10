import { useCallback, useEffect, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Info } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { eur, errMsg } from "@/lib/api";
import { toast } from "sonner";

const COL = { cash: "#94A3B8", conservative: "#06B6D4", balanced: "#EAB308", growth: "#10B981" };

const Num = ({ label, id, value, onChange, step = 1, min = 0, max }) => (
  <label className="block"><span className="label">{label}</span>
    <input data-testid={id} type="number" className="field mono" value={value} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

export default function Predictor() {
  const { api, analysis } = useFinance();
  const m = analysis?.metrics;
  const [p, setP] = useState(() => ({ start: Math.round(m?.investments_total || 0), monthly: Math.max(0, Math.round((m?.monthly_surplus || 0) * 0.5)), years: 20, inflation: 2.5, fee: 0.25 }));
  const [focus, setFocus] = useState("balanced");
  const [res, setRes] = useState(null);

  const run = useCallback(async () => {
    try { setRes(await api.post("/simulate", p)); } catch (e) { toast.error(String(errMsg(e))); }
  }, [api, p]);
  useEffect(() => { const t = setTimeout(run, 350); return () => clearTimeout(t); }, [run]);

  const set = (k) => (v) => setP({ ...p, [k]: v });
  const data = res ? res.strategies.cash.series.map((_, y) => {
    const row = { year: `Y${y}` };
    Object.entries(res.strategies).forEach(([k, s]) => { row[k] = s.series[y].p50; });
    const f = res.strategies[focus].series[y];
    row.band = [f.p10, f.p90];
    return row;
  }) : [];

  return (
    <div className="space-y-6">
      <div className="rise"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Wealth Predictor</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-3xl">600 Monte Carlo simulations per strategy using long-run return & volatility assumptions, minus fees, shown in today's euros. These are projections, not predictions or guarantees.</p></div>
      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        <div className="panel p-5 space-y-4">
          <Num id="sim-start-input" label="Starting invested €" value={p.start} onChange={set("start")} step={100} />
          <Num id="sim-monthly-input" label="Monthly contribution €" value={p.monthly} onChange={set("monthly")} step={25} />
          <Num id="sim-years-input" label="Years" value={p.years} onChange={set("years")} min={1} max={50} />
          <Num id="sim-inflation-input" label="Inflation % p.a." value={p.inflation} onChange={set("inflation")} step={0.1} max={15} />
          <Num id="sim-fee-input" label="Annual fees % (TER etc.)" value={p.fee} onChange={set("fee")} step={0.05} max={5} />
          {m && <p className="text-xs text-slate-500">Your current surplus is {eur(m.monthly_surplus)}/mo. Try spending €100 less and see the difference.</p>}
        </div>
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex flex-wrap gap-2 mb-4">{Object.keys(COL).map((k) => res && <button key={k} data-testid={`sim-focus-${k}`} onClick={() => setFocus(k)} className={`tag cursor-pointer ${focus === k ? "tag-emerald" : "tag-muted"}`}>{res.strategies[k].label}</button>)}</div>
            <div className="h-80" data-testid="sim-chart"><ResponsiveContainer><ComposedChart data={data}>
              <CartesianGrid stroke="#1F2D32" vertical={false} />
              <XAxis dataKey="year" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `€${Math.round(v / 1000)}k`} width={56} />
              <Tooltip formatter={(v) => Array.isArray(v) ? `${eur(v[0])} – ${eur(v[1])}` : eur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="band" name="10–90% range (focused)" fill={COL[focus]} fillOpacity={0.12} stroke="none" />
              {Object.entries(COL).map(([k, c]) => <Line key={k} dataKey={k} name={res?.strategies[k].label} stroke={c} strokeWidth={k === focus ? 2.5 : 1.25} dot={false} />)}
            </ComposedChart></ResponsiveContainer></div>
          </div>
          {res && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="sim-results">
              {Object.entries(res.strategies).map(([k, s]) => { const last = s.series[s.series.length - 1]; return (
                <div key={k} className={`panel p-4 ${k === focus ? "border-emerald-500/40" : ""}`}>
                  <div className="text-xs text-slate-400">{s.label}</div>
                  <div data-testid={`sim-median-${k}`} className="mono text-xl font-semibold mt-2">{eur(last.p50)}</div>
                  <div className="text-xs text-slate-500 mono">range {eur(last.p10)} – {eur(last.p90)}</div>
                  <div className="text-xs text-slate-500 mt-2">Assumes {s.assumed_return}% return, {s.assumed_volatility}% volatility</div>
                  <div className="text-xs text-amber-400 mt-1">{s.prob_below_contributed}% chance of ending below what you paid in (in real terms)</div>
                </div>); })}
            </div>
          )}
          {res && <div className="panel p-4 text-xs text-slate-400 flex gap-2"><Info size={14} className="shrink-0 mt-0.5 text-cyan-400" />You would contribute {eur(res.total_contributed)} in total (nominal). Outcomes outside the 10–90% range happen. Real markets can fall 30–50% in a single year; assumptions are illustrative and do not reflect any specific product.</div>}
        </div>
      </div>
    </div>
  );
}
