import { useState } from "react";
import { toast } from "sonner";
import { Database, PencilLine } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { errMsg } from "@/lib/api";
import ProfileEditor from "@/pages/ProfileEditor";

export default function Onboarding() {
  const { api, refresh } = useFinance();
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadSample = async () => {
    setBusy(true);
    try { await api.post("/profile/sample"); toast.success("Sample data loaded — edit it any time"); await refresh(); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  if (mode === "manual") return <div className="max-w-5xl mx-auto p-4 sm:p-8"><ProfileEditor onboarding /></div>;

  return (
    <div className="min-h-screen auth-bg grid place-items-center p-6">
      <div className="max-w-3xl w-full rise">
        <div className="flex items-center gap-2 mb-6"><span className="logo-dot" /><span className="font-display font-bold">AuraFinance</span></div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Let's map your finances.</h1>
        <p className="text-slate-400 mt-4 max-w-xl">A bank balance alone is never enough to decide what to do with money. We need the full picture: income, spending, debts, goals and how much risk you can live with.</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          <button data-testid="onboarding-manual-button" onClick={() => setMode("manual")} className="panel panel-hover p-6 text-left">
            <PencilLine className="text-emerald-400 mb-3" />
            <div className="font-semibold">Enter my real numbers</div>
            <p className="text-sm text-slate-400 mt-1">About 3 minutes. Stored privately, exportable and deletable.</p>
          </button>
          <button data-testid="onboarding-sample-button" onClick={loadSample} disabled={busy} className="panel panel-hover p-6 text-left disabled:opacity-60">
            <Database className="text-cyan-400 mb-3" />
            <div className="font-semibold">{busy ? "Loading…" : "Explore with sample data"}</div>
            <p className="text-sm text-slate-400 mt-1">A realistic 34-year-old in Germany with 3 months of transactions. Clearly labelled, fully editable.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
