import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { errMsg } from "@/lib/api";

const ASSET_OPTS = [["index_funds", "Index fund"], ["stocks_etfs", "Stocks / ETF"], ["precious_metals", "Precious metals"], ["real_estate", "Real estate"], ["crypto", "Crypto"], ["cash_savings", "Savings account / deposit"]];
const YEAR = new Date().getFullYear();
const EMPTY = { full_name: "", age: 30, country: "", employment: "", dependents: 0, cash_balance: 0, monthly_income: 0, monthly_expenses: 0, emergency_savings: 0, risk_tolerance: "medium", horizon_years: 15, investments: [], debts: [], goals: [], upcoming_expenses: [] };
const NEW = {
  investments: { name: "", asset_class: "index_funds", value: 0 },
  debts: { name: "", balance: 0, interest_rate: 0, min_payment: 0 },
  goals: { name: "", target_amount: 0, target_year: YEAR + 5, priority: "medium" },
  upcoming_expenses: { name: "", amount: 0, due_in_months: 3 },
};

const Field = ({ label, id, type = "number", value, onChange, ...rest }) => (
  <label className="block">
    <span className="label">{label}</span>
    <input data-testid={id} className="field mono" type={type} value={value} onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} {...rest} />
  </label>
);

const ListSection = ({ title, k, cols, form, setForm }) => {
  const rows = form[k];
  const upd = (i, f, v) => setForm({ ...form, [k]: rows.map((r, j) => (j === i ? { ...r, [f]: v } : r)) });
  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" data-testid={`add-${k}-button`} onClick={() => setForm({ ...form, [k]: [...rows, { ...NEW[k] }] })} className="btn-ghost"><Plus size={14} />Add</button>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">None added.</p>}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 items-end" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr)) auto` }}>
            {cols.map(([f, l, t, opts]) => opts ? (
              <label key={f}><span className="label">{l}</span>
                <select data-testid={`${k}-${i}-${f}`} className="field" value={r[f]} onChange={(e) => upd(i, f, e.target.value)}>{opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
              </label>
            ) : <Field key={f} label={l} id={`${k}-${i}-${f}`} type={t} value={r[f]} onChange={(v) => upd(i, f, v)} />)}
            <button type="button" data-testid={`remove-${k}-${i}`} onClick={() => setForm({ ...form, [k]: rows.filter((_, j) => j !== i) })} className="p-2.5 text-slate-500 hover:text-rose-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default function ProfileEditor({ onboarding }) {
  const { api, profile, refresh } = useFinance();
  const nav = useNavigate();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(profile || {}) }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { user_id, is_sample, ai_consent, updated_at, ...body } = form;
    try { await api.put("/profile", body); toast.success("Profile saved — analysis updated"); await refresh(); if (!onboarding) nav("/app"); }
    catch (err) { toast.error(String(errMsg(err))); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6 rise" data-testid="profile-form">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">My finances</h1>
          <p className="text-slate-400 text-sm mt-2">Monthly amounts are net (after tax). Everything updates your analysis instantly.</p>
        </div>
        <button data-testid="profile-save-button" disabled={saving} className="btn-primary"><Save size={16} />{saving ? "Saving…" : "Save profile"}</button>
      </div>
      {profile?.is_sample && <p className="tag tag-amber">You are editing sample data. Saving replaces it with your own figures.</p>}
      <section className="panel p-5 sm:p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Name (never sent to AI)" id="profile-name" type="text" value={form.full_name} onChange={set("full_name")} />
        <Field label="Age" id="profile-age" value={form.age} onChange={set("age")} min={16} max={110} required />
        <Field label="Country" id="profile-country" type="text" value={form.country} onChange={set("country")} placeholder="e.g. Netherlands" />
        <Field label="Employment" id="profile-employment" type="text" value={form.employment} onChange={set("employment")} placeholder="e.g. Self-employed" />
        <Field label="Current account balance €" id="profile-cash" value={form.cash_balance} onChange={set("cash_balance")} min={0} step="0.01" required />
        <Field label="Monthly net income €" id="profile-income" value={form.monthly_income} onChange={set("monthly_income")} min={0} step="0.01" required />
        <Field label="Monthly expenses €" id="profile-expenses" value={form.monthly_expenses} onChange={set("monthly_expenses")} min={0} step="0.01" required />
        <Field label="Emergency savings €" id="profile-emergency" value={form.emergency_savings} onChange={set("emergency_savings")} min={0} step="0.01" required />
        <label><span className="label">Risk tolerance</span>
          <select data-testid="profile-risk" className="field" value={form.risk_tolerance} onChange={(e) => set("risk_tolerance")(e.target.value)}>
            <option value="low">Low — losses keep me up at night</option><option value="medium">Medium — I accept some swings</option><option value="high">High — I can ride out big drops</option>
          </select>
        </label>
        <Field label="Investment horizon (years)" id="profile-horizon" value={form.horizon_years} onChange={set("horizon_years")} min={1} max={60} required />
        <Field label="Dependents" id="profile-dependents" value={form.dependents} onChange={set("dependents")} min={0} max={20} />
      </section>
      <ListSection title="Investments" k="investments" form={form} setForm={setForm} cols={[["name", "Name", "text"], ["asset_class", "Type", null, ASSET_OPTS], ["value", "Value €"]]} />
      <ListSection title="Debts" k="debts" form={form} setForm={setForm} cols={[["name", "Name", "text"], ["balance", "Balance €"], ["interest_rate", "Interest % p.a."], ["min_payment", "Min. monthly €"]]} />
      <ListSection title="Goals" k="goals" form={form} setForm={setForm} cols={[["name", "Goal", "text"], ["target_amount", "Target €"], ["target_year", "By year"], ["priority", "Priority", null, [["high", "High"], ["medium", "Medium"], ["low", "Low"]]]]} />
      <ListSection title="Upcoming expenses" k="upcoming_expenses" form={form} setForm={setForm} cols={[["name", "What", "text"], ["amount", "Amount €"], ["due_in_months", "Due in (months)"]]} />
    </form>
  );
}
