import { useState, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";

// ============================================================
// BCC FINANCIALS MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Overview        — Summary cards + revenue trend chart
//   2. P&L             — Monthly/quarterly/annual P&L
//   3. COMP_RECAP      — SF compensation detail by period
//   4. AIPP & ScoreBoard — Progress tracking
//   5. Payroll         — Staff payroll history
//   6. Bank Accounts   — Account balances and reconciliation
//   7. Credit & Debt   — Cards, loans, lines of credit
//   8. General Ledger  — Full transaction ledger
//
// DATA: Reads from Supabase via props (passed from BCCApp)
// In production replace MOCK_DATA with Supabase queries:
//   const { data } = await supabase.from('comp_recap')...
// ============================================================


// ─── Design Tokens (matches BCCApp shell) ────────────────────

const T = {
  navy:    "#1B2B4B",
  blue:    "#2D7DD2",
  blueLt:  "#EFF6FF",
  green:   "#10B981",
  greenLt: "#D1FAE5",
  amber:   "#F59E0B",
  amberLt: "#FEF3C7",
  red:     "#EF4444",
  redLt:   "#FEE2E2",
  purple:  "#7C3AED",
  purpleLt:"#EDE9FE",
  slate50: "#F8FAFC",
  slate100:"#F1F5F9",
  slate200:"#E2E8F0",
  slate400:"#94A3B8",
  slate500:"#64748B",
  slate600:"#475569",
  slate700:"#334155",
  slate800:"#1E293B",
  slate900:"#0F172A",
  white:   "#FFFFFF",
};

// ─── Live Supabase Data Hook ─────────────────────────────────
function useFinancialsData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const currentYear  = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;     // 1-12
        const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;

        const [
          isRows, compRows, bankRows, ccRows, glRows,
          payrollRunsRes, payrollDetailRows,
          aippRow, scoreboardRows,
        ] = await Promise.all([
          // Income statement view
          supabase.from("v_income_statement")
            .select("account_name, account_type, amount, month, year")
            .eq("year", currentYear).order("month"),

          // SF comp recap — real schema columns
          supabase.from("comp_recap")
            .select("period_year, period_month, comp_type, comp_category, description, amount, is_aipp_eligible, is_scoreboard_eligible")
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .limit(200),

          // Bank
          supabase.from("bank_accounts")
            .select("account_name, current_balance, as_of_date, account_type, account_number_last4, institution"),

          // Credit
          supabase.from("credit_accounts")
            .select("account_name, current_balance, updated_at, account_type, account_number_last4, credit_limit, available_credit, interest_rate, minimum_payment, payment_due_day, institution"),

          // GL
          supabase.from("journal_lines")
            .select(`
              debit, credit, created_at,
              journal_entries!inner ( entry_date, reference_number, description, source ),
              chart_of_accounts!inner ( account_name )
            `)
            .order("created_at", { ascending: false }).limit(50),

          // Payroll runs (header)
          supabase.from("payroll_runs")
            .select("id, pay_period_start, pay_period_end, pay_date, payroll_provider, gross_payroll, employer_taxes, net_payroll, status")
            .order("pay_date", { ascending: false }).limit(12),

          // Payroll detail (per-employee)
          supabase.from("payroll_detail")
            .select("payroll_run_id, gross_pay, federal_tax, state_tax, social_security, medicare, other_deductions, net_pay, employment_type"),

          // AIPP — real schema
          supabase.from("aipp_tracking")
            .select("program_year, target_amount, earned_ytd, projected_full_year, achievement_percentage, notes")
            .order("program_year", { ascending: false }).limit(1).single(),

          // ScoreBoard
          supabase.from("scoreboard_tracking")
            .select("program_year, period, metric_name, target, actual, achievement_percentage, notes")
            .order("program_year", { ascending: false }).limit(20),
        ]);

        const isData = isRows.data || [];
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

        // Monthly chart
        const monthlyRevenue = months.map((m, i) => {
          const mo = i + 1;
          const rev = isData.filter(r => r.month === mo && r.account_type === "income").reduce((s,r) => s + parseFloat(r.amount||0), 0);
          const exp = isData.filter(r => r.month === mo && r.account_type === "expense").reduce((s,r) => s + parseFloat(r.amount||0), 0);
          return { month: m, revenue: Math.round(rev), expenses: Math.round(exp) };
        });

        // P&L line items
        const buildLines = (type) =>
          [...new Set(isData.filter(r=>r.account_type===type).map(r=>r.account_name))].map(name => {
            const rows = isData.filter(r=>r.account_name===name && r.account_type===type);
            const ytd = rows.reduce((s,r)=>s+parseFloat(r.amount||0),0);
            const mtd = rows.filter(r=>r.month===currentMonth).reduce((s,r)=>s+parseFloat(r.amount||0),0);
            const qtd = rows.filter(r=>r.month>=quarterStart && r.month<=currentMonth).reduce((s,r)=>s+parseFloat(r.amount||0),0);
            return { name, mtd: Math.round(mtd), qtd: Math.round(qtd), ytd: Math.round(ytd) };
          });

        const incomeLines  = buildLines("income");
        const expenseLines = buildLines("expense");

        const sumByPeriod = (type, predicate) =>
          isData.filter(r => r.account_type === type && predicate(r))
                .reduce((s,r) => s + parseFloat(r.amount||0), 0);

        const revYTD = sumByPeriod("income",  () => true);
        const expYTD = sumByPeriod("expense", () => true);
        const revMTD = sumByPeriod("income",  r => r.month === currentMonth);
        const expMTD = sumByPeriod("expense", r => r.month === currentMonth);
        const revQTD = sumByPeriod("income",  r => r.month >= quarterStart && r.month <= currentMonth);
        const expQTD = sumByPeriod("expense", r => r.month >= quarterStart && r.month <= currentMonth);

        // Comp recap — group rows into "periods" (e.g. "Apr 2026") and pre-format for the section
        const compRecapsRaw = compRows.data || [];
        const compRecaps = compRecapsRaw.map(r => ({
          period_year:  r.period_year,
          period_month: r.period_month,
          period_label: `${months[r.period_month-1]} ${r.period_year}`,
          comp_type:    r.comp_type,
          comp_category: r.comp_category,
          description:  r.description || `${r.comp_type} — ${r.comp_category}`,
          amount:       parseFloat(r.amount || 0),
          is_aipp_eligible: r.is_aipp_eligible,
          is_scoreboard_eligible: r.is_scoreboard_eligible,
        }));

        // AIPP — alias schema fields to the names AIPPSection expects
        const aippRaw = aippRow.data || null;
        const aipp = aippRaw ? {
          year:          aippRaw.program_year || currentYear,
          target:        parseFloat(aippRaw.target_amount)        || 0,
          earned:        parseFloat(aippRaw.earned_ytd)           || 0,
          projected:     parseFloat(aippRaw.projected_full_year)  || 0,
          priorYear:     0, // schema does not track prior year; show 0 unless populated
          monthlyEarned: months.map((m,i) => {
            const mo = i + 1;
            const earned = compRecapsRaw
              .filter(r => r.period_year === currentYear && r.period_month === mo && r.is_aipp_eligible)
              .reduce((s,r) => s + parseFloat(r.amount || 0), 0);
            return { month: m, amount: Math.round(earned) };
          }),
        } : { year: currentYear, target: 0, earned: 0, projected: 0, priorYear: 0, monthlyEarned: months.map(m => ({month:m, amount:0})) };

        // ScoreBoard — alias to {metric, actual, target, pct}
        const scoreboard = (scoreboardRows.data || []).map(s => ({
          metric: s.metric_name,
          actual: parseFloat(s.actual || 0),
          target: parseFloat(s.target || 0),
          pct:    Math.round(parseFloat(s.achievement_percentage || 0)),
        }));

        // Payroll — combine runs + detail, grouped by run
        const detailByRun = {};
        for (const d of (payrollDetailRows.data || [])) {
          (detailByRun[d.payroll_run_id] ||= []).push(d);
        }
        const payroll = (payrollRunsRes.data || []).map(run => {
          const startStr = new Date(run.pay_period_start).toLocaleDateString("en-US", { month:"short", day:"numeric" });
          const endStr   = new Date(run.pay_period_end).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
          const dateStr  = run.pay_date ? new Date(run.pay_date).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "";
          return {
            pay_period: `${startStr} – ${endStr}`,
            pay_date:   dateStr,
            gross:      parseFloat(run.gross_payroll || 0),
            taxes:      parseFloat(run.employer_taxes || 0),
            net:        parseFloat(run.net_payroll || 0),
            status:     run.status || "paid",
            provider:   run.payroll_provider,
          };
        });

        // Credit accounts — alias to what CreditSection expects
        const creditAccounts = (ccRows.data || []).map(c => ({
          name:    c.account_name,
          balance: parseFloat(c.current_balance || 0),
          asOf:    c.updated_at,
          type:    c.account_type,
          last4:   c.account_number_last4,
          limit:   parseFloat(c.credit_limit || 0) || null,
          rate:    parseFloat(c.interest_rate || 0),
          payment: parseFloat(c.minimum_payment || 0),
          dueDay:  c.payment_due_day,
        }));

        setData({
          summary: {
            revenueMTD: Math.round(revMTD), revenueQTD: Math.round(revQTD), revenueYTD: Math.round(revYTD),
            expensesMTD: Math.round(expMTD), netIncomeMTD: Math.round(revMTD - expMTD), netIncomeYTD: Math.round(revYTD - expYTD),
            priorYearYTD: 442434,
          },
          monthlyRevenue,
          pl: { income: incomeLines, expenses: expenseLines },
          compRecaps,
          aipp,
          scoreboard,
          bankAccounts: (bankRows.data || []).map(b => ({
            name: b.account_name,
            balance: parseFloat(b.current_balance||0),
            asOf: b.as_of_date,
            type: b.account_type,
            last4: b.account_number_last4,
            institution: b.institution,
          })),
          creditAccounts,
          glEntries: (glRows.data || []).map(g => ({
            date:        g.journal_entries?.entry_date,
            ref:         g.journal_entries?.reference_number,
            description: g.journal_entries?.description,
            source:      g.journal_entries?.source,
            account:     g.chart_of_accounts?.account_name,
            debit:       parseFloat(g.debit  || 0),
            credit:      parseFloat(g.credit || 0),
          })),
          payroll,
        });
      } catch(e) {
        console.error("Financials load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading };
}


// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n) => { const v = Number(n); if (!Number.isFinite(v)) return "—"; if (v === 0) return "—"; return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0 }); };
const pct  = (n, t) => t ? Math.round((n / t) * 100) : 0;
const yoy  = (curr, prior) => prior ? (((curr - prior) / prior) * 100).toFixed(1) : null;

// ─── Data Store (populated by Financials component with live data) ────────────
let MOCK = {
  summary: { revenueMTD:0,revenueQTD:0,revenueYTD:0,expensesMTD:0,netIncomeMTD:0,netIncomeYTD:0,priorYearYTD:0 },
  monthlyRevenue: Array(12).fill(0).map((_,i)=>({month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],revenue:0,expenses:0})),
  pl:{income:[],expenses:[]},
  compRecaps:[],
  aipp: { year: new Date().getFullYear(), target:0, earned:0, projected:0, priorYear:0, monthlyEarned: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m=>({month:m,amount:0})) },
  scoreboard: [],
  bankAccounts:[],creditAccounts:[],glEntries:[],payroll:[],
};


// ─── Shared Components ───────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: T.white,
    border: `1px solid ${T.slate200}`,
    borderRadius: 12,
    padding: "16px 18px",
    ...style,
  }}>
    {children}
  </div>
);

const CardHeader = ({ title, sub, action }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.slate800 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: T.slate500, marginTop: 2 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

const KPICard = ({ label, value, sub, color = T.slate900, border }) => (
  <div style={{
    background: T.white,
    border: `1px solid ${border || T.slate200}`,
    borderRadius: 12,
    padding: "14px 16px",
    borderTop: border ? `3px solid ${border}` : undefined,
  }}>
    <div style={{ fontSize: 11, color: T.slate500, fontWeight: 500, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.02em", marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.slate400 }}>{sub}</div>}
  </div>
);

const Pill = ({ children, type = "info" }) => {
  const map = {
    success: { bg: T.greenLt,  color: "#065F46" },
    warning: { bg: T.amberLt,  color: "#92400E" },
    danger:  { bg: T.redLt,    color: "#991B1B" },
    info:    { bg: T.blueLt,   color: "#1E40AF" },
    purple:  { bg: T.purpleLt, color: "#5B21B6" },
  };
  const s = map[type] || map.info;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 10, fontWeight: 600,
      padding: "3px 8px", borderRadius: 20,
      background: s.bg, color: s.color,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

const AskBtn = ({ context, size = "normal", demoMode = false }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const ref = useRef(null);
  const small = size === "small";
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setTimeout(() => { setCopied(false); setOpened(false); }, 200); } };
    const k = (e) => { if (e.key === "Escape") { setOpen(false); setTimeout(() => { setCopied(false); setOpened(false); }, 200); } };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const ask = async () => {
    setOpen(true); setOpened(false);
    try { await navigator.clipboard.writeText(context); setCopied(true); } catch { setCopied(true); }
  };
  const go = () => { setOpened(true); if (!demoMode) window.open("https://claude.ai/new", "_blank", "noopener,noreferrer"); };
  const preview = context && context.length > 220 ? context.slice(0, 220).trimEnd() + "\u2026" : context;
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={open ? () => { setOpen(false); setTimeout(() => { setCopied(false); setOpened(false); }, 200); } : ask}
        style={{ display: "flex", alignItems: "center", gap: 5, background: open ? T.slate100 : T.blue, color: open ? T.blue : T.white, border: open ? `1px solid ${T.blue}` : "1px solid transparent", borderRadius: 7, padding: small ? "5px 10px" : "7px 13px", fontSize: small ? 10 : 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
      >\u26a1 Ask Claude</button>
      {open && (
        <div role="dialog" aria-label="Ask Claude" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 60, width: 300, background: T.white, border: `1px solid ${T.slate100}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(15,23,42,0.16)", padding: 14, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#16A34A", marginBottom: 4 }}>
            {copied ? "\u2713 Context copied to your clipboard" : "Copying\u2026"}
          </div>
          <div style={{ fontSize: 11, color: T.slate500, marginBottom: 8, lineHeight: 1.5 }}>
            This is what Claude will see \u2014 your data from this screen.
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.55, color: T.slate500, background: T.slate100, borderRadius: 8, padding: 9, maxHeight: 92, overflow: "hidden", whiteSpace: "pre-wrap" }}>{preview}</div>
          <div style={{ marginTop: 10 }}>
            {!opened ? (
              <button onClick={go} style={{ width: "100%", background: T.blue, color: T.white, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Open Claude.ai &amp; paste
              </button>
            ) : demoMode ? (
              <div style={{ background: "#FFFBEB", border: "1px solid #D9770633", borderRadius: 8, padding: "8px 11px", fontSize: 11, lineHeight: 1.55, color: "#D97706" }}>
                <strong>Demo mode.</strong> On a real BCC this opens the agent's own Claude.ai, ready to paste.
              </div>
            ) : (
              <div style={{ background: "#ECFDF3", border: "1px solid #16A34A33", borderRadius: 8, padding: "8px 11px", fontSize: 11, lineHeight: 1.55, color: "#16A34A" }}>
                \u2713 Claude.ai opened in a new tab \u2014 paste with Ctrl/\u2318+V.
              </div>
            )}
          </div>
          <div style={{ marginTop: 9, fontSize: 10, color: T.slate400, lineHeight: 1.5 }}>
            Opens <em>your</em> Claude account \u2014 your subscription, your Project.
          </div>
        </div>
      )}
    </div>
  );
};

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{
    display: "flex", gap: 2,
    background: T.slate100,
    borderRadius: 8, padding: 3,
    marginBottom: 16,
    flexWrap: "wrap",
  }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        padding: "6px 14px", fontSize: 12, fontWeight: active === t.id ? 600 : 400,
        color: active === t.id ? T.slate900 : T.slate500,
        background: active === t.id ? T.white : "transparent",
        border: "none", borderRadius: 6, cursor: "pointer",
        transition: "all 0.12s",
        boxShadow: active === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      }}>{t.label}</button>
    ))}
  </div>
);

// ─── Mini Bar Chart ──────────────────────────────────────────
const MiniBarChart = ({ data }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expenses)));
  const barH = 80;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: barH + 24 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, height: barH, justifyContent: "flex-end" }}>
            {d.revenue > 0 && (
              <div style={{
                width: "60%", background: T.blue, borderRadius: "2px 2px 0 0",
                height: `${(d.revenue / maxVal) * barH}px`,
                transition: "height 0.6s ease",
              }} />
            )}
            {d.revenue === 0 && (
              <div style={{ width: "60%", background: T.slate200, borderRadius: "2px 2px 0 0", height: 3 }} />
            )}
          </div>
          <div style={{ fontSize: 9, color: T.slate400 }}>{d.month}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Progress Bar ────────────────────────────────────────────
const ProgressBar = ({ value, max, color = T.blue, height = 8 }) => {
  const p = Math.min(pct(value, max), 100);
  return (
    <div style={{ height, background: T.slate100, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${p}%`,
        background: color, borderRadius: height / 2,
        transition: "width 0.7s ease",
      }} />
    </div>
  );
};

// ─── Section: Overview ───────────────────────────────────────
const OverviewSection = ({ period, setPeriod, data }) => {
  const d = data?.summary || {};
  const yoyPct = yoy(d.revenueYTD || 0, d.priorYearYTD || 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <TabBar
          tabs={[{ id:"mtd", label:"This Month" },{ id:"qtd", label:"This Quarter" },{ id:"ytd", label:"Year to Date" }]}
          active={period}
          onChange={setPeriod}
        />
        <AskBtn context={`My agency financials — ${period.toUpperCase()}: Revenue $${period==="mtd"?d.revenueMTD:period==="qtd"?d.revenueQTD:d.revenueYTD}, Expenses $${period==="mtd"?d.expensesMTD:"N/A"}, Net Income $${period==="mtd"?d.netIncomeMTD:d.netIncomeYTD}. YTD is up ${yoyPct}% vs prior year. Help me analyze my financial performance.`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
        <KPICard label="Revenue" value={fmt(period==="mtd"?d.revenueMTD:period==="qtd"?d.revenueQTD:d.revenueYTD)} sub={period==="ytd"?`↑ ${yoyPct}% vs prior year`:undefined} color={T.blue} border={T.blue} />
        <KPICard label="Expenses" value={fmt(period==="mtd"?d.expensesMTD:period==="qtd"?Math.round(d.expensesMTD*3.1):Math.round(d.expensesMTD*4))} sub="Cash basis" border={T.amber} />
        <KPICard label="Net Income" value={fmt(period==="mtd"?d.netIncomeMTD:period==="qtd"?Math.round(d.netIncomeMTD*2.9):d.netIncomeYTD)} color={T.green} border={T.green} />
        <KPICard label="Expense Ratio" value={Math.round((d.expensesMTD/d.revenueMTD)*100) + "%"} sub="Target: <45%" border={T.slate200} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 12 }}>
        <Card>
          <CardHeader title="Monthly revenue — 2026" sub="Blue bars = revenue · Gray = no data yet" />
          <MiniBarChart data={data.monthlyRevenue} />
        </Card>

        <Card>
          <CardHeader title="Income breakdown — April 2026" />
          {(Array.isArray(data?.pl?.income) ? data.pl.income : []).map((item, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: T.slate600 }}>{item.name}</span>
                <span style={{ fontWeight: 600, color: T.slate900 }}>{fmt(item.mtd)}</span>
              </div>
              <ProgressBar value={item.mtd || 0} max={data?.summary?.revenueMTD || 1} color={item.code?.startsWith("41") ? T.green : T.blue} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ─── Section: P&L ────────────────────────────────────────────
const PLSection = ({ data }) => {
  const pl = data?.pl || { income: [], expenses: [] };
  const incomeRows  = Array.isArray(pl.income)   ? pl.income   : [];
  const expenseRows = Array.isArray(pl.expenses) ? pl.expenses : [];
  const totalIncomeMTD  = incomeRows.reduce((s,r) => s + (r?.mtd || 0), 0);
  const totalExpMTD     = expenseRows.reduce((s,r) => s + (r?.mtd || 0), 0);
  const totalIncomeYTD  = incomeRows.reduce((s,r) => s + (r?.ytd || 0), 0);
  const totalExpYTD     = expenseRows.reduce((s,r) => s + (r?.ytd || 0), 0);

  const TRow = ({ label, mtd, qtd, ytd, bold, indent, isTotal, isNeg }) => (
    <tr style={{ background: isTotal ? T.slate50 : "transparent" }}>
      <td style={{ padding: "7px 8px", fontSize: 12, color: indent ? T.slate600 : T.slate800, paddingLeft: indent ? 24 : 8, fontWeight: bold ? 600 : 400 }}>{label}</td>
      <td style={{ padding: "7px 8px", fontSize: 12, textAlign: "right", fontWeight: bold ? 600 : 400, color: isNeg ? T.red : bold ? T.slate900 : T.slate700 }}>{fmt(mtd)}</td>
      <td style={{ padding: "7px 8px", fontSize: 12, textAlign: "right", fontWeight: bold ? 600 : 400, color: isNeg ? T.red : bold ? T.slate900 : T.slate700 }}>{fmt(qtd)}</td>
      <td style={{ padding: "7px 8px", fontSize: 12, textAlign: "right", fontWeight: bold ? 600 : 400, color: isNeg ? T.red : bold ? T.slate900 : T.slate700 }}>{fmt(ytd)}</td>
    </tr>
  );

  return (
    <Card>
      <CardHeader
        title="Profit & Loss Statement"
        sub="Cash basis · Calendar year 2026"
        action={<AskBtn context={`My P&L: YTD Revenue $${totalIncomeYTD}, YTD Expenses $${totalExpYTD}, Net Income $${totalIncomeYTD - totalExpYTD}. Expense ratio ${Math.round((totalExpYTD/totalIncomeYTD)*100)}%. Help me analyze my profitability and identify areas to improve.`} />}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.slate200}` }}>
              <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "left" }}>Account</th>
              <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "right" }}>Apr 2026</th>
              <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "right" }}>Q1 2026</th>
              <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "right" }}>YTD 2026</th>
            </tr>
          </thead>
          <tbody>
            <TRow label="INCOME" bold />
            {incomeRows.map((r,i) => (
              <TRow key={i} label={r.name} mtd={r.mtd} qtd={r.qtd} ytd={r.ytd} indent />
            ))}
            <TRow label="Total Income" mtd={totalIncomeMTD} qtd={incomeRows.reduce((s,r)=>s+r.qtd,0)} ytd={totalIncomeYTD} bold isTotal />

            <tr><td colSpan={4} style={{ padding: "6px 0" }} /></tr>

            <TRow label="EXPENSES" bold />
            {expenseRows.map((r,i) => (
              <TRow key={i} label={r.name} mtd={r.mtd} qtd={r.qtd} ytd={r.ytd} indent />
            ))}
            <TRow label="Total Expenses" mtd={totalExpMTD} qtd={expenseRows.reduce((s,r)=>s+r.qtd,0)} ytd={totalExpYTD} bold isTotal />

            <tr><td colSpan={4} style={{ padding: "2px 0", borderTop: `2px solid ${T.slate800}` }} /></tr>
            <TRow label="NET INCOME" mtd={totalIncomeMTD-totalExpMTD} qtd={incomeRows.reduce((s,r)=>s+r.qtd,0)-expenseRows.reduce((s,r)=>s+r.qtd,0)} ytd={totalIncomeYTD-totalExpYTD} bold isTotal />
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ─── Section: COMP_RECAP ─────────────────────────────────────
const CompRecapSection = ({ data }) => {
  const compRecaps = Array.isArray(data?.compRecaps) ? data.compRecaps : [];
  const allPeriods = [...new Set(compRecaps.map(r => r?.period_label).filter(Boolean))];
  const [period, setPeriod] = useState("");
  // Initialize period to most recent once data arrives
  useEffect(() => {
    if (allPeriods.length > 0 && !allPeriods.includes(period)) {
      setPeriod(allPeriods[0]);
    }
  }, [allPeriods.join("|")]);
  const periods  = allPeriods;
  const filtered = compRecaps.filter(r => r.period_label === period);
  const total    = filtered.reduce((s,r) => s + parseFloat(r.amount || 0), 0);
  const aippTotal = filtered.filter(r => r.is_aipp_eligible).reduce((s,r) => s + parseFloat(r.amount || 0), 0);

  return (
    <Card>
      <CardHeader
        title="SF COMP_RECAP Detail"
        sub="State Farm compensation breakdown by period"
        action={<AskBtn context={`My SF COMP_RECAP for ${period}: Total $${total}. AIPP eligible: $${aippTotal}. Help me reconcile this to my GL and confirm my AIPP calculation.`} />}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: "5px 12px", fontSize: 11, fontWeight: period===p ? 600 : 400,
            color: period===p ? T.white : T.slate600,
            background: period===p ? T.navy : T.white,
            border: `1px solid ${period===p ? T.navy : T.slate200}`,
            borderRadius: 6, cursor: "pointer",
          }}>{p}</button>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.slate200}` }}>
            <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "left" }}>Compensation Type</th>
            <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "center" }}>AIPP Eligible</th>
            <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r,i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.slate100}` }}>
              <td style={{ padding: "8px 8px", fontSize: 12, color: T.slate800 }}>{r.description}</td>
              <td style={{ padding: "8px 8px", textAlign: "center" }}>
                {r.is_aipp_eligible
                  ? <Pill type="success">AIPP</Pill>
                  : <span style={{ fontSize: 11, color: T.slate400 }}>—</span>}
              </td>
              <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 600, color: T.slate900, textAlign: "right" }}>{fmt(Math.round(r.amount))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${T.slate800}` }}>
            <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 700, color: T.slate900 }}>Total</td>
            <td style={{ padding: "8px 8px", fontSize: 11, textAlign: "center", color: T.slate500 }}>AIPP: {fmt(aippTotal)}</td>
            <td style={{ padding: "8px 8px", fontSize: 13, fontWeight: 700, color: T.blue, textAlign: "right" }}>{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
};

// ─── Section: AIPP & ScoreBoard ──────────────────────────────
const AIPPSection = ({ data }) => {
  const aippData = data?.aipp || {};
  const year       = aippData.year       || new Date().getFullYear();
  const target     = aippData.target     || 0;
  const earned     = aippData.earned     || 0;
  const projected  = aippData.projected  || 0;
  const priorYear  = aippData.priorYear  || 0;
  const monthlyEarned = Array.isArray(aippData.monthlyEarned) ? aippData.monthlyEarned : [];
  const scoreboard    = Array.isArray(data?.scoreboard) ? data.scoreboard : [];
  const achievement = pct(earned, target);
  const projPct = pct(projected, target);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>

        {/* AIPP Progress */}
        <Card>
          <CardHeader
            title={`AIPP ${year} — Annual Incentive Progress`}
            action={<AskBtn context={`AIPP ${year}: Target $${target}, Earned YTD $${earned}, Achievement ${achievement}%, Projected $${projected}, Prior Year $${priorYear}. Am I on track? What do I need to focus on?`} />}
          />
          <div style={{ fontSize: 32, fontWeight: 700, color: T.green, letterSpacing: "-0.03em", marginBottom: 4 }}>
            {achievement}%
          </div>
          <div style={{ fontSize: 12, color: T.slate500, marginBottom: 12 }}>
            {fmt(earned)} earned of {fmt(target)} target
          </div>
          <ProgressBar value={earned} max={target} color={T.green} height={10} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.slate400, marginTop: 6, marginBottom: 16 }}>
            <span>Jan {year}</span><span>Dec {year}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Earned YTD",    value: fmt(earned),    color: T.green },
              { label: "Projected",     value: fmt(projected), color: projPct >= 95 ? T.green : T.amber },
              { label: "Prior Year",    value: fmt(priorYear), color: T.slate500 },
            ].map((s,i) => (
              <div key={i} style={{ background: T.slate50, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.slate500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.slate600, marginBottom: 8 }}>Monthly earned — {year}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {monthlyEarned.map((m,i) => (
                <div key={i} style={{ flex: 1, background: T.blueLt, borderRadius: 6, padding: "6px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: T.slate500 }}>{m.month}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, marginTop: 2 }}>{fmt(m.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ScoreBoard */}
        <Card>
          <CardHeader
            title="ScoreBoard Metrics — 2026"
            sub="Progress toward performance recognition"
            action={<AskBtn context="My ScoreBoard metrics for 2026: reviewing progress toward SF performance recognition. Help me identify which metrics need the most attention." />}
          />
          {scoreboard.map((m, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: T.slate700 }}>{m.metric}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.slate500 }}>{m.actual}/{m.target}</span>
                  <Pill type={m.pct >= 100 ? "success" : m.pct >= 75 ? "warning" : "danger"}>
                    {m.pct}%
                  </Pill>
                </div>
              </div>
              <ProgressBar
                value={m.actual}
                max={m.target}
                color={m.pct >= 100 ? T.green : m.pct >= 75 ? T.amber : T.red}
                height={6}
              />
            </div>
          ))}
          <div style={{
            marginTop: 16, padding: "10px 12px",
            background: T.slate50, borderRadius: 8,
            fontSize: 11, color: T.slate600,
            borderLeft: `3px solid ${T.amber}`,
          }}>
            Retention rate is above target — excellent. New Business Policies at 48% needs attention to hit ScoreBoard recognition level.
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Payroll ─────────────────────────────────────────
const PayrollSection = ({ data }) => {
  const ytdGross = (data.payroll || []).reduce((s,r) => s + parseFloat(r.gross || 0), 0);
  const ytdTax   = (data.payroll || []).reduce((s,r) => s + parseFloat(r.taxes || 0), 0);

  return (
    <Card>
      <CardHeader
        title="Payroll History"
        sub={`YTD Gross: ${fmt(ytdGross)} · YTD Taxes: ${fmt(ytdTax)}`}
        action={<AskBtn context={`My agency payroll YTD: Gross ${fmt(ytdGross)}, Employer taxes ${fmt(ytdTax)}. Help me review payroll expenses and identify any concerns.`} />}
      />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.slate200}` }}>
            {["Pay Period","Pay Date","Gross","Employer Taxes","Net Payroll","Status"].map((h,i) => (
              <th key={i} style={{ padding: "8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: i > 1 ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.payroll || []).map((r,i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.slate100}` }}>
              <td style={{ padding: "9px 8px", fontSize: 12, color: T.slate800 }}>{r.pay_period||r.period}</td>
              <td style={{ padding: "9px 8px", fontSize: 12, color: T.slate600 }}>{r.pay_date||r.payDate||"-"}</td>
              <td style={{ padding: "9px 8px", fontSize: 12, fontWeight: 600, color: T.slate900, textAlign: "right" }}>{fmt(r.gross)}</td>
              <td style={{ padding: "9px 8px", fontSize: 12, color: T.slate700, textAlign: "right" }}>{fmt(parseFloat(r.taxes||0))}</td>
              <td style={{ padding: "9px 8px", fontSize: 12, color: T.slate700, textAlign: "right" }}>{fmt(parseFloat(r.net||0))}</td>
              <td style={{ padding: "9px 8px", textAlign: "right" }}>
                <Pill type="success">{r.status}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

// ─── Section: Bank Accounts ───────────────────────────────────
const BankSection = ({ data }) => {
  const bankAccounts = Array.isArray(data?.bankAccounts) ? data.bankAccounts : [];
  const totalCash = bankAccounts.reduce((s,r) => s + (r?.balance || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 }}>
        {bankAccounts.map((a, i) => (
          <Card key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.slate700 }}>{a.name}</div>
              <Pill type={a.reconciled ? "success" : "warning"}>
                {a.reconciled ? "Reconciled" : "Pending"}
              </Pill>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.slate900, letterSpacing: "-0.02em" }}>
              {fmt(a.balance)}
            </div>
            <div style={{ fontSize: 10, color: T.slate400, marginTop: 4 }}>
              As of {a.asOf} · ••••{a.last4}
            </div>
          </Card>
        ))}
        <Card style={{ background: T.navy, border: "none" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Total Cash Position</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.white, letterSpacing: "-0.02em" }}>{fmt(totalCash)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>All accounts combined</div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Credit & Debt ───────────────────────────────────
const CreditSection = ({ data }) => {
  const totalDebt = (data.creditAccounts || []).reduce((s,r) => s + r.balance, 0);
  const totalAvailable = (data.creditAccounts || []).filter(a => a.limit).reduce((s,r) => s + (r.limit - r.balance), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 4 }}>
        <KPICard label="Total Debt Exposure" value={fmt(totalDebt)} color={T.red} border={T.red} />
        <KPICard label="Available Credit" value={fmt(totalAvailable)} color={T.green} border={T.green} />
        <KPICard label="Next Payment Due" value="May 1" sub="SBA Loan — $1,847" border={T.amber} />
      </div>

      {(data.creditAccounts || []).map((a, i) => (
        <Card key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.slate800 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: T.slate500, marginTop: 2 }}>
                {a.type === "credit_card" ? "Credit Card" : a.type === "loan" ? "Loan" : "Line of Credit"} · ••••{a.last4} · {a.rate}% APR
              </div>
            </div>
            <AskBtn context={`${a.name}: Balance ${fmt(a.balance)}, Rate ${a.rate}%, Payment due on the ${a.dueDay}. Minimum payment: ${fmt(a.payment)}. Help me think about this debt.`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: T.slate500, marginBottom: 2 }}>Current Balance</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.red }}>{fmt(a.balance)}</div>
            </div>
            {a.limit && (
              <div>
                <div style={{ fontSize: 10, color: T.slate500, marginBottom: 2 }}>Available Credit</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>{fmt(a.limit - a.balance)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: T.slate500, marginBottom: 2 }}>Min Payment</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.amber }}>{fmt(a.payment)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.slate500, marginBottom: 2 }}>Due Date</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.slate800 }}>May {a.dueDay}</div>
            </div>
          </div>

          {a.limit && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: T.slate400, marginBottom: 4 }}>Utilization: {pct(a.balance, a.limit)}%</div>
              <ProgressBar value={a.balance} max={a.limit} color={pct(a.balance,a.limit) > 30 ? T.amber : T.green} height={6} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

// ─── Section: General Ledger ──────────────────────────────────
const GLSection = ({ data }) => (
  <Card>
    <CardHeader
      title="General Ledger — Recent Entries"
      sub="Last 30 days · All accounts"
      action={<AskBtn context="I am reviewing my General Ledger recent entries. Help me verify these entries look correct and identify anything that needs attention." />}
    />
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${T.slate200}` }}>
          {["Date","Ref","Description","Account","Debit","Credit"].map((h,i) => (
            <th key={i} style={{ padding: "8px", fontSize: 11, fontWeight: 600, color: T.slate500, textAlign: i >= 4 ? "right" : "left" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(Array.isArray(data?.glEntries) ? data.glEntries : []).map((r,i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${T.slate100}` }}>
            <td style={{ padding: "8px", fontSize: 11, color: T.slate500 }}>{r.date}</td>
            <td style={{ padding: "8px", fontSize: 11, color: T.blue, fontFamily: "monospace" }}>{r.ref}</td>
            <td style={{ padding: "8px", fontSize: 12, color: T.slate800 }}>{r.description}</td>
            <td style={{ padding: "8px", fontSize: 11, color: T.slate500, fontFamily: "monospace" }}>{r.account}</td>
            <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: T.slate900, fontWeight: r.debit ? 500 : 400 }}>{r.debit ? fmt(r.debit) : "—"}</td>
            <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: T.green, fontWeight: r.credit ? 500 : 400 }}>{r.credit ? fmt(r.credit) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

// ─── Main Financials Module ───────────────────────────────────
export default function Financials() {
  const [section, setSection] = useState("overview");
  const [period, setPeriod] = useState("mtd");
  const { data: liveData, loading } = useFinancialsData();
  if (liveData) MOCK = liveData;

  const sections = [
    { id: "overview",  label: "Overview"        },
    { id: "pl",        label: "P&L"             },
    { id: "comp",      label: "COMP_RECAP"      },
    { id: "aipp",      label: "AIPP & ScoreBoard"},
    { id: "payroll",   label: "Payroll"         },
    { id: "bank",      label: "Bank Accounts"   },
    { id: "credit",    label: "Credit & Debt"   },
    { id: "gl",        label: "General Ledger"  },
  ];

  return (
    <div>
      {/* Module Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.slate900, letterSpacing: "-0.02em" }}>Financials</div>
          <div style={{ fontSize: 12, color: T.slate500, marginTop: 3 }}>
            Cash basis · Calendar year · All figures in USD
          </div>
        </div>
        <AskBtn context="I am reviewing my agency financials. Help me get a complete picture of my financial health, identify any concerns, and suggest what I should focus on." />
      </div>

      {/* Section Navigation */}
      <div style={{
        display: "flex", gap: 2, flexWrap: "wrap",
        background: T.slate100, borderRadius: 10,
        padding: 4, marginBottom: 18,
      }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding: "7px 14px", fontSize: 12,
            fontWeight: section === s.id ? 600 : 400,
            color: section === s.id ? T.slate900 : T.slate500,
            background: section === s.id ? T.white : "transparent",
            border: "none", borderRadius: 7, cursor: "pointer",
            transition: "all 0.12s",
            boxShadow: section === s.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>{s.label}</button>
        ))}
      </div>

      {/* Section Content */}
      {section === "overview" && <OverviewSection period={period} setPeriod={setPeriod} data={MOCK} />}
      {section === "pl"       && <PLSection data={MOCK} />}
      {section === "comp"     && <CompRecapSection data={MOCK} />}
      {section === "aipp"     && <AIPPSection data={MOCK} />}
      {section === "payroll"  && <PayrollSection data={MOCK} />}
      {section === "bank"     && <BankSection data={MOCK} />}
      {section === "credit"   && <CreditSection data={MOCK} />}
      {section === "gl"       && <GLSection data={MOCK} />}
    </div>
  );
}

