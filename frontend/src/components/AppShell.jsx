import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { LayoutDashboard, Coins, PieChart, TrendingUp, ScanSearch, Radar, UserCog, Lock, ShieldAlert } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";

const NAV = [
  { to: "/app", end: true, label: "Financial Brain", icon: LayoutDashboard, id: "nav-overview" },
  { to: "/app/next", label: "Next € advisor", icon: Coins, id: "nav-next-money" },
  { to: "/app/allocator", label: "Asset Allocator", icon: PieChart, id: "nav-allocator" },
  { to: "/app/predictor", label: "Wealth Predictor", icon: TrendingUp, id: "nav-predictor" },
  { to: "/app/expenses", label: "Expense Detector", icon: ScanSearch, id: "nav-expenses" },
  { to: "/app/opportunities", label: "Opportunity Scanner", icon: Radar, id: "nav-opportunities" },
  { to: "/app/profile", label: "My finances", icon: UserCog, id: "nav-profile" },
  { to: "/app/privacy", label: "Privacy & data", icon: Lock, id: "nav-privacy" },
];

const NavItems = () => NAV.map(({ to, end, label, icon: Icon, id }) => (
  <NavLink key={to} to={to} end={end} data-testid={id}
    className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}>
    <Icon size={16} /> <span>{label}</span>
  </NavLink>
));

export default function AppShell() {
  const { profile } = useFinance();
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] sticky top-0 h-screen p-5">
        <div className="flex items-center gap-2 mb-8"><span className="logo-dot" /><span className="font-display text-lg font-bold tracking-tight">AuraFinance</span></div>
        <nav className="flex flex-col gap-1"><NavItems /></nav>
        <div className="mt-auto text-[11px] leading-relaxed text-slate-500">Read-only. AuraFinance never moves money or executes trades.</div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <div data-testid="disclaimer-banner" className="disclaimer">
          <ShieldAlert size={14} className="shrink-0" />
          <span>Read-only educational & analytics tool. Not regulated investment advice. Projections are not guarantees — investments can lose value.</span>
        </div>
        <header className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <span className="lg:hidden font-display font-bold">AuraFinance</span>
            {profile?.is_sample && <span data-testid="sample-data-badge" className="tag tag-amber">Sample data — edit in “My finances”</span>}
          </div>
          <div data-testid="user-menu"><UserButton /></div>
        </header>
        <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 py-2 border-b border-[var(--line)] no-scrollbar"><NavItems /></nav>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full"><Outlet /></main>
      </div>
    </div>
  );
}
