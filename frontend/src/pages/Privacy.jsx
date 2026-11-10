import { useState } from "react";
import { toast } from "sonner";
import { Download, Trash2, ShieldCheck, Database } from "lucide-react";
import { useClerk } from "@clerk/react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useFinance } from "@/context/FinanceContext";
import { errMsg } from "@/lib/api";

export default function Privacy() {
  const { api, profile, refresh } = useFinance();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  const toggle = async (v) => {
    try { await api.put("/consent", { ai_consent: v }); toast.success(v ? "AI analysis enabled" : "AI analysis disabled"); await refresh(); }
    catch (e) { toast.error(String(errMsg(e))); }
  };
  const exportData = async () => {
    try {
      const data = await api.get("/gdpr/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `aurafinance-export-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
      toast.success("Your data was exported");
    } catch (e) { toast.error(String(errMsg(e))); }
  };
  const resetSample = async () => {
    setBusy(true);
    try { await api.post("/profile/sample"); toast.success("Sample data restored"); await refresh(); } catch (e) { toast.error(String(errMsg(e))); } finally { setBusy(false); }
  };
  const wipe = async () => {
    try { await api.del("/gdpr/data"); toast.success("All your financial data was permanently deleted"); await refresh(); }
    catch (e) { toast.error(String(errMsg(e))); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rise"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Privacy & data</h1><p className="text-sm text-slate-400 mt-2">Your rights under GDPR: access, portability, erasure and withdrawal of consent at any time.</p></div>
      <div className="panel p-6">
        <div className="flex items-start justify-between gap-6">
          <div><div className="font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-400" />Allow AI analysis</div>
            <p className="text-sm text-slate-400 mt-2">When on, your financial figures (income, expenses, balances, debts, goals, transactions — never your name or email) are sent to an AI model provider (Anthropic Claude) to generate insights. Turn off any time; existing reports stay until you delete them.</p></div>
          <Switch data-testid="ai-consent-switch" checked={!!profile?.ai_consent} onCheckedChange={toggle} />
        </div>
      </div>
      <div className="panel p-6 space-y-3 text-sm text-slate-400">
        <div className="font-semibold text-slate-100">What AuraFinance is — and isn't</div>
        <p><span className="text-slate-200">Educational information:</span> explanations of how asset classes, fees and risks work.</p>
        <p><span className="text-slate-200">General financial insights:</span> analysis of your own numbers, e.g. "your emergency fund covers 2 months".</p>
        <p><span className="text-slate-200">Not provided — regulated personalised investment advice:</span> under MiFID II this requires an authorised firm that assesses suitability. We never recommend specific securities, never execute trades and never move money. For regulated advice, consult a licensed financial adviser.</p>
        <p>Data access is read-only: you enter figures yourself; no bank credentials are ever requested.</p>
      </div>
      <div className="panel p-6 flex flex-wrap gap-3">
        <button data-testid="gdpr-export-button" onClick={exportData} className="btn-ghost"><Download size={15} />Export all my data (JSON)</button>
        <button data-testid="reset-sample-button" onClick={resetSample} disabled={busy} className="btn-ghost"><Database size={15} />Replace with sample data</button>
        <AlertDialog>
          <AlertDialogTrigger asChild><button data-testid="gdpr-delete-button" className="btn-danger"><Trash2 size={15} />Delete all my data</button></AlertDialogTrigger>
          <AlertDialogContent className="bg-[var(--panel)] border-[var(--line)] text-slate-100">
            <AlertDialogHeader><AlertDialogTitle>Permanently delete everything?</AlertDialogTitle>
              <AlertDialogDescription>Your profile, transactions, AI reports and advice history will be erased. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel data-testid="gdpr-delete-cancel">Cancel</AlertDialogCancel><AlertDialogAction data-testid="gdpr-delete-confirm" onClick={wipe} className="bg-rose-600 hover:bg-rose-500">Delete permanently</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <button data-testid="sign-out-button" onClick={() => signOut()} className="btn-ghost ml-auto">Sign out</button>
      </div>
    </div>
  );
}
