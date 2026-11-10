import { Link } from "react-router-dom";
import { Brain, PieChart, TrendingUp, ScanSearch, Radar, Coins, ShieldCheck, EyeOff, Ban } from "lucide-react";

const SYSTEMS = [
  { icon: Brain, t: "Financial Brain", d: "Reads your whole picture — cash, debts, goals, risk — and tells you what matters most right now." },
  { icon: PieChart, t: "Smart Asset Allocator", d: "A target mix across ETFs, index funds, metals, property, crypto and cash, with the why, risks and fees." },
  { icon: TrendingUp, t: "Wealth Predictor", d: "Monte Carlo simulations with best/median/worst bands in today's euros. Projections, never promises." },
  { icon: ScanSearch, t: "Expense Detector", d: "Finds recurring charges, subscription price creep and unusual spikes in your own transactions." },
  { icon: Radar, t: "Opportunity Scanner", d: "Live crypto & precious-metal prices plus efficiency wins like better savings rates or refinancing." },
];

export default function Landing() {
  return (
    <div className="min-h-screen auth-bg">
      <header className="flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-2"><span className="logo-dot" /><span className="font-display text-lg font-bold">AuraFinance</span></div>
        <div className="flex gap-2">
          <Link to="/sign-in" data-testid="landing-sign-in-button" className="btn-ghost">Sign in</Link>
          <Link to="/sign-up" data-testid="landing-sign-up-button" className="btn-primary">Create account</Link>
        </div>
      </header>
      <section className="px-6 sm:px-12 pt-12 pb-20 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center max-w-7xl">
        <div className="rise">
          <span className="tag tag-emerald mb-6">Read-only · Never moves your money</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mt-4">
            What should I do with my <span className="text-emerald-400">next €500</span>?
          </h1>
          <p className="mt-6 text-slate-400 max-w-xl text-base">An AI finance assistant that looks at your whole situation before suggesting anything. Sometimes the answer is invest. Often it's pay down that card, or keep it as a buffer. It always shows you why.</p>
          <div className="mt-8 flex gap-3">
            <Link to="/sign-up" data-testid="hero-get-started-button" className="btn-primary">Start your free analysis</Link>
          </div>
        </div>
        <div className="panel glow p-6 rise rise-2 relative overflow-hidden grain">
          <div className="text-xs mono text-slate-500 mb-4">EXAMPLE OUTPUT · €500</div>
          {[["Pay down credit card (19.9%)", 300, "bg-rose-400"], ["Top up emergency fund", 150, "bg-cyan-400"], ["Global equity ETF", 50, "bg-emerald-400"]].map(([l, a, c]) => (
            <div key={l} className="mb-4">
              <div className="flex justify-between text-sm mb-1.5"><span>{l}</span><span className="mono">€{a}</span></div>
              <div className="h-2 rounded-full bg-[var(--elev)]"><div className={`h-2 rounded-full ${c}`} style={{ width: `${a / 5}%` }} /></div>
            </div>
          ))}
          <p className="text-xs text-slate-500 mt-4">Illustrative only. Your result depends on your own numbers.</p>
        </div>
      </section>
      <section className="px-6 sm:px-12 pb-20 max-w-7xl">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {SYSTEMS.map(({ icon: I, t, d }, i) => (
            <div key={t} className={`panel panel-hover p-5 rise rise-${(i % 4) + 1}`}>
              <I size={20} className="text-emerald-400 mb-3" />
              <div className="font-semibold mb-1.5">{t}</div>
              <p className="text-sm text-slate-400 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 grid sm:grid-cols-3 gap-4 text-sm">
          {[[ShieldCheck, "GDPR by design", "Export or permanently delete all your data in one click."], [EyeOff, "Explicit AI consent", "Nothing is sent to the AI until you switch it on. Your name is never sent."], [Ban, "Zero execution", "No trades, no transfers. You stay in control of every decision."]].map(([I, t, d]) => (
            <div key={t} className="flex gap-3"><I size={18} className="text-cyan-400 shrink-0 mt-0.5" /><div><div className="font-medium">{t}</div><div className="text-slate-500">{d}</div></div></div>
          ))}
        </div>
        <p className="mt-12 text-xs text-slate-600 max-w-3xl">AuraFinance provides educational information and general financial insights. It is not an authorised investment firm and does not provide regulated personalised investment advice under MiFID II. Capital at risk. Past performance and projections do not guarantee future results.</p>
      </section>
    </div>
  );
}
