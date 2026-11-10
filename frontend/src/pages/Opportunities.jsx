import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useAiReport, ConsentGate, RunButton, Stamp, Thinking } from "@/components/Ai";
import { eur, pct } from "@/lib/api";

const SEV = { high: "tag-rose", medium: "tag-amber", low: "tag-cyan" };
const Chg = ({ v }) => <span className={`mono ${v == null ? "text-slate-500" : v >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{v == null ? "—" : `${v >= 0 ? "+" : ""}${pct(v)}`}</span>;

const Market = () => {
  const { api } = useFinance();
  const [m, setM] = useState(null);
  const load = () => api.get("/market").then(setM).catch(() => setM({ available: false, assets: [] }));
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="panel p-5" data-testid="market-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">{m?.available && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}Live market prices (EUR)</h3>
        <button data-testid="market-refresh-button" onClick={load} className="text-slate-500 hover:text-slate-200"><RefreshCw size={14} /></button>
      </div>
      {m && !m.available && <p data-testid="market-unavailable" className="text-sm text-amber-400">Live prices are temporarily unavailable from the provider. No figures are shown rather than guessed ones.</p>}
      {m?.available && (
        <>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-2 text-sm">
            <span className="label">Asset</span><span className="label text-right">Price</span><span className="label text-right">24h</span><span className="label text-right">7d</span><span className="label text-right">30d</span>
            {m.assets.map((a) => [
              <span key={a.id} data-testid={`market-${a.id}`}>{a.name}</span>,
              <span key={a.id + "p"} className="mono text-right">{eur(a.price_eur, true)}</span>,
              <span key={a.id + "1"} className="text-right"><Chg v={a.change_24h} /></span>,
              <span key={a.id + "7"} className="text-right"><Chg v={a.change_7d} /></span>,
              <span key={a.id + "3"} className="text-right"><Chg v={a.change_30d} /></span>,
            ])}
          </div>
          <p className="text-xs text-slate-500 mt-3">Source: {m.source}, fetched {new Date(m.fetched_at).toLocaleTimeString("en-IE")}{m.stale ? " (stale)" : ""}. Gold & silver are priced via gold/silver-backed tokens (PAXG, KAG), which track 1 troy ounce closely but can deviate slightly from spot. Stock/ETF quotes are not connected.</p>
        </>
      )}
    </div>
  );
};

export default function Opportunities() {
  const { profile } = useFinance();
  const { report, run, running, progress } = useAiReport("opportunities");
  const r = report?.result;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rise">
        <div><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Opportunity Scanner</h1><p className="text-sm text-slate-400 mt-2">Opportunities and risks matched to your situation, using live prices. <Stamp at={report?.created_at} /></p></div>
        {profile.ai_consent && <RunButton testId="opportunities-run-button" onClick={run} running={running} progress={progress} hasResult={!!report} label="Scan now" />}
      </div>
      <Market />
      <ConsentGate>
        <Thinking running={running} />
        {!running && r && (
          <div className="space-y-4" data-testid="opportunities-report">
            <div className="panel glow p-5 text-sm text-slate-300"><span className="label">Market context</span>{r.market_context}</div>
            <div className="grid md:grid-cols-2 gap-4">
              {r.opportunities?.map((o) => (
                <div key={o.title} className="panel panel-hover p-5">
                  <div className="flex flex-wrap gap-2 mb-2"><span className="tag tag-emerald">{o.type}</span><span className="tag tag-muted">effort: {o.effort}</span>{o.estimated_annual_impact_eur > 0 && <span className="tag tag-cyan">≈ {eur(o.estimated_annual_impact_eur)}/yr</span>}</div>
                  <div className="font-semibold">{o.title}</div>
                  <p className="text-sm text-slate-400 mt-1.5">{o.detail}</p>
                  <p className="text-xs mt-3"><span className="text-emerald-400">Benefit: </span><span className="text-slate-400">{o.potential_benefit}</span></p>
                  <p className="text-xs mt-1"><span className="text-rose-400">Risks: </span><span className="text-slate-400">{o.risks}</span></p>
                </div>
              ))}
            </div>
            <div className="panel p-5"><h3 className="font-semibold mb-3">Risks to watch</h3>{r.risks_to_watch?.map((k) => <div key={k.title} className="flex gap-3 py-2 border-t border-[var(--line)] text-sm"><span className={`tag ${SEV[k.severity] || "tag-muted"}`}>{k.severity}</span><div><div className="font-medium">{k.title}</div><div className="text-slate-400">{k.detail}</div></div></div>)}</div>
            <p className="text-xs text-slate-500">Estimates are rough and based on your entered figures. Not regulated investment advice.</p>
          </div>
        )}
      </ConsentGate>
    </div>
  );
}
