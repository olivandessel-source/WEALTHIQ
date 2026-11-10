import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";

export function useAiReport(module) {
  const { api, reports, setReport } = useFinance();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const run = async () => {
    setRunning(true); setError(null); setProgress(0);
    try {
      const data = await api.stream(`/ai/report/${module}`, {}, setProgress);
      setReport(module, data);
      toast.success("Analysis updated");
    } catch (e) {
      setError(e.message); toast.error(e.message);
    } finally { setRunning(false); }
  };
  return { report: reports[module], run, running, progress, error };
}

export const ConsentGate = ({ children }) => {
  const { profile } = useFinance();
  if (profile?.ai_consent) return children;
  return (
    <div data-testid="ai-consent-required" className="panel p-6 border-dashed">
      <div className="flex items-center gap-2 text-emerald-400 mb-2"><ShieldCheck size={18} /><span className="font-semibold">AI analysis is off</span></div>
      <p className="text-sm text-slate-400 max-w-xl">To generate AI insights, your financial figures (without your name) are sent to an AI model for processing. Nothing is shared until you switch this on.</p>
      <Link to="/app/privacy" data-testid="ai-consent-link" className="btn-primary mt-4 inline-flex">Review & enable in Privacy</Link>
    </div>
  );
};

export const RunButton = ({ onClick, running, progress, hasResult, testId, label = "Run AI analysis" }) => (
  <button data-testid={testId} onClick={onClick} disabled={running} className="btn-primary">
    {running ? <Loader2 size={16} className="animate-spin" /> : hasResult ? <RefreshCw size={16} /> : <Sparkles size={16} />}
    {running ? (progress ? `Analysing… ${Math.min(99, Math.round(progress / 40))}%` : "Thinking…") : hasResult ? "Re-analyse" : label}
  </button>
);

export const Stamp = ({ at }) => at ? <span className="text-xs mono text-slate-500">Generated {new Date(at).toLocaleString("en-IE")}</span> : null;

export const InfoTag = ({ type }) => {
  const map = { educational: "Educational", general_insight: "General insight — not regulated advice" };
  return <span className="tag tag-muted">{map[type] || "General insight — not regulated advice"}</span>;
};

export const Thinking = ({ running }) => running ? (
  <div data-testid="ai-thinking" className="panel p-6 flex items-center gap-3 text-sm text-slate-400">
    <Loader2 className="animate-spin text-emerald-400" size={18} /> The AI is reviewing your full financial picture. Deep analysis can take up to a minute.
  </div>
) : null;
