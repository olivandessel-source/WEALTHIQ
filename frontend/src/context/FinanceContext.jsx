import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApi, errMsg } from "@/lib/api";

const Ctx = createContext(null);
export const useFinance = () => useContext(Ctx);

export function FinanceProvider({ children }) {
  const api = useApi();
  const [profile, setProfile] = useState(undefined);
  const [analysis, setAnalysis] = useState(null);
  const [reports, setReports] = useState({});

  const refresh = useCallback(async () => {
    try {
      const { profile: p } = await api.get("/profile");
      setProfile(p);
      if (p) {
        const [a, r] = await Promise.all([api.get("/analysis"), api.get("/ai/reports")]);
        setAnalysis(a);
        setReports(r);
      } else {
        setAnalysis(null);
        setReports({});
      }
    } catch (e) {
      toast.error(errMsg(e));
      setProfile((p) => (p === undefined ? null : p));
    }
  }, [api]);

  useEffect(() => { refresh(); }, [refresh]);

  const setReport = (module, data) => setReports((r) => ({ ...r, [module]: data }));

  return <Ctx.Provider value={{ api, profile, analysis, reports, refresh, setReport }}>{children}</Ctx.Provider>;
}
