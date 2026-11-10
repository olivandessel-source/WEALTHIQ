import { useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const eurFmt = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurFmt2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
export const eur = (n, cents = false) => (n == null || isNaN(n) ? "—" : (cents ? eurFmt2 : eurFmt).format(n));
export const pct = (n, d = 1) => (n == null || isNaN(n) ? "—" : `${Number(n).toFixed(d)}%`);

export const errMsg = (e) => e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || e?.message || "Something went wrong";

export function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => {
    const req = async (method, path, data) => {
      const token = await getToken();
      const res = await axios({ method, url: `${API}${path}`, data, headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    };
    const stream = async (path, body, onProgress) => {
      const token = await getToken();
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.detail === "string" ? j.detail : `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", chars = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.t === "delta") { chars += ev.n; onProgress?.(chars); }
          if (ev.t === "done") return ev.result;
          if (ev.t === "error") throw new Error(ev.message);
        }
      }
      throw new Error("The AI response was interrupted. Please try again.");
    };
    return {
      get: (p) => req("get", p),
      post: (p, d) => req("post", p, d),
      put: (p, d) => req("put", p, d),
      del: (p) => req("delete", p),
      stream,
    };
  }, [getToken]);
}
