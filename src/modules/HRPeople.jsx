import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";

// ============================================================
// BCC HR & PEOPLE MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Overview      — Pipeline summary, team snapshot, alerts
//   2. Recruiting    — Kanban pipeline: New→Screen→Interview→Offer→Hired
//   3. Applicants    — Full applicant list with Groq scores
//   4. Onboarding    — Active onboarding checklists per new hire
//   5. Staff         — Current team directory with licensing status
//   6. Performance   — Monthly KPI tracking per staff member
//   7. Commissions   — Commission structures and monthly calculations
//
// KEY AUTOMATION:
//   Resume Scanner (Composio + Groq) auto-creates applicant
//   records from Gmail, scores candidates 1-10, generates
//   One Page Interview Focus — no manual data entry needed.
//
// COMPLIANCE FLAGS:
//   • Staff must be licensed before performing licensed activities
//   • Family employees require year-end W-2 review with CPA
//   • New hires must be notified to SF within required timeframe
//   • Agent is liable for all staff activities (AA05 Section I.P)
//
// DATA: Reads applicants, staff, onboarding_checklists,
//       staff_performance, commission_structures tables
// ============================================================


// ─── Design Tokens ────────────────────────────────────────────
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
  teal:    "#0D9488",
  tealLt:  "#CCFBF1",
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

// ─── Pipeline Stage Config ────────────────────────────────────
const STAGES = {
  new:       { label:"New",        color:T.slate500, bg:T.slate100, order:0 },
  screening: { label:"Screening",  color:T.blue,     bg:T.blueLt,  order:1 },
  interview: { label:"Interview",  color:T.amber,    bg:T.amberLt, order:2 },
  offer:     { label:"Offer",      color:T.purple,   bg:T.purpleLt,order:3 },
  hired:     { label:"Hired",      color:T.green,    bg:T.greenLt, order:4 },
  rejected:  { label:"Rejected",   color:T.red,      bg:T.redLt,   order:5 },
};

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_APPLICANTS = [
  {
    id:"ap1", first_name:"Jamie",  last_name:"Chen",
    email:"jamie.chen@email.com", phone:"(312) 555-0142",
    position:"Licensed Sales Agent",
    status:"interview", source:"email_auto",
    claude_score:8,
    claude_summary:"Strong candidate with 3 years P&C experience at Allstate. Currently licensed in IL. Demonstrated production record of 85 new policies/month. Clean background. Minor concern: reason for leaving current role unclear.",
    interview_focus:`ONE PAGE INTERVIEW FOCUS — Jamie Chen

STRENGTHS TO EXPLORE:
1. P&C production record at Allstate — ask for specific monthly new business numbers and what drove them
2. IL license status — verify current, in good standing, ask about plans to add WI/IN
3. Customer retention approach — 3 years at same agency suggests loyalty; understand philosophy

CONCERNS TO PROBE:
1. Reason for leaving Allstate — current role ended abruptly per resume gap; ask directly and assess answer
2. Experience with life insurance — P&C heavy background; assess openness to cross-selling
3. Salary expectations vs. commission structure — candidate may expect base salary

SUGGESTED QUESTIONS:
1. Walk me through your average month at Allstate — how many new policies, what product mix?
2. What made you decide to leave your last agency, and what are you looking for in your next role?
3. How do you approach customers who have coverage gaps they haven't asked about?
4. Have you sold life insurance before? What's your comfort level with that conversation?
5. Where do you see yourself in 2 years — still in sales, or are you interested in eventually running your own agency?

RED FLAGS: Resume gap Apr-Aug 2025 unexplained. Probe during interview.
LICENSING: IL P&C license verified active. Life license — confirm status.`,
    intake_received_at:"Apr 26, 2026",
    interview_date:"Apr 29, 2026",
    interview_notes:"Phone screen completed Apr 27. Strong communication skills. Scheduled in-person for Apr 29.",
    rating:null,
  },
  {
    id:"ap2", first_name:"Derek",  last_name:"Washington",
    email:"derek.w@email.com", phone:"(630) 555-0188",
    position:"Office Manager",
    status:"screening", source:"email_auto",
    claude_score:7,
    claude_summary:"Experienced office manager, 5 years in financial services operations. Not licensed — applying for unlicensed role. Strong organizational and systems background. Good cultural fit indicators.",
    interview_focus:`ONE PAGE INTERVIEW FOCUS — Derek Washington

STRENGTHS TO EXPLORE:
1. Financial services operations background — directly relevant to agency management
2. Systems experience — ask about CRM, scheduling, and workflow tools used
3. 5 years tenure at prior employer — signals loyalty and stability

CONCERNS TO PROBE:
1. No insurance industry experience specifically — assess learning curve appetite
2. Salary expectations — office manager roles have a wide range; align early
3. Comfort with high-volume customer interaction — financial services may be less client-facing

SUGGESTED QUESTIONS:
1. Describe a typical day managing operations at your last firm — what were your top 3 responsibilities?
2. What systems and tools do you use to stay organized across multiple priorities?
3. Have you ever supported a licensed professional team? How did you handle questions you couldn't answer?
4. What's your ideal work environment — autonomous or highly collaborative?
5. What attracted you specifically to an insurance agency vs. other financial services roles?`,
    intake_received_at:"Apr 24, 2026",
    interview_date:null,
    interview_notes:null,
    rating:null,
  },
  {
    id:"ap3", first_name:"Maria",  last_name:"Santos",
    email:"m.santos@email.com", phone:"(773) 555-0211",
    position:"Licensed Sales Agent",
    status:"new", source:"email_auto",
    claude_score:6,
    claude_summary:"Recent licensing school graduate, no prior sales experience. IL P&C license new. Enthusiastic cover letter. Will require significant training investment. Score reflects potential over experience.",
    interview_focus:null,
    intake_received_at:"Today, Apr 27",
    interview_date:null,
    interview_notes:null,
    rating:null,
  },
  {
    id:"ap4", first_name:"Kevin",  last_name:"Park",
    email:"k.park@email.com", phone:"(847) 555-0094",
    position:"Licensed Sales Agent",
    status:"offer", source:"referral",
    claude_score:9,
    claude_summary:"Exceptional candidate. 7 years State Farm experience at another agency, relocated to Chicago area. All lines licensed IL, WI, IN. Strong AIPP production history. Reference from prior agent provided.",
    interview_focus:null,
    intake_received_at:"Apr 18, 2026",
    interview_date:"Apr 22, 2026",
    interview_notes:"Excellent interview. Knows SF systems cold. Start date flexible. Salary ask is $58K base + commission. Offer being prepared.",
    rating:5,
  },
  {
    id:"ap5", first_name:"Tanya",  last_name:"Brooks",
    email:"t.brooks@email.com", phone:"(312) 555-0317",
    position:"Licensed Sales Agent",
    status:"rejected", source:"email_auto",
    claude_score:4,
    claude_summary:"Limited insurance experience. License lapsed 2 years ago — would require retesting. Cover letter indicated interest in office admin, not sales. Mismatch with role requirements.",
    interview_focus:null,
    intake_received_at:"Apr 19, 2026",
    interview_date:null,
    interview_notes:"Reviewed profile — not a fit for current opening. License lapsed.",
    rating:null,
  },
];

const MOCK_STAFF = [
  {
    id:"s1", first_name:"Marcus", last_name:"Thompson",
    role:"Licensed Sales Agent", employment_type:"w2",
    start_date:"Jan 15, 2022", is_active:true,
    email:"marcus@smithagency.com", phone:"(312) 555-0182",
    pay_type:"salary_plus_commission", pay_rate:52000,
    licensed:true, license_states:["IL","WI"],
    notes:"Top producer. Life license pending — scheduled exam May 2026.",
    ytd_production:{ new_policies:68, retention_rate:91 },
  },
  {
    id:"s2", first_name:"Priya", last_name:"Patel",
    role:"Office Manager", employment_type:"w2",
    start_date:"Mar 1, 2020", is_active:true,
    email:"priya@smithagency.com", phone:"(312) 555-0183",
    pay_type:"salary", pay_rate:42000,
    licensed:false, license_states:[],
    notes:"Handles all operations, billing, client service. Cannot perform licensed activities.",
    ytd_production:null,
  },
  {
    id:"s3", first_name:"Tyler", last_name:"Smith",
    role:"Administrative Support", employment_type:"family",
    start_date:"Jun 1, 2024", is_active:true,
    email:"tyler@smithagency.com", phone:null,
    pay_type:"hourly", pay_rate:18,
    licensed:false, license_states:[],
    notes:"Jane's son. Part-time 20hrs/wk. Below standard deduction — no FIT withheld. Flag for CPA at year-end W-2. Cannot perform licensed activities.",
    ytd_production:null,
    compliance_flag:"Family employee — review W-2 treatment with CPA annually",
  },
];

const MOCK_ONBOARDING = [
  {
    staff_id:"s1", staff_name:"Marcus Thompson", start_date:"Jan 15, 2022",
    template:"licensed", days_employed:834,
    items:[
      { category:"licensing",   item:"IL Producer License verified active",           completed:true,  due:"Day 1"   },
      { category:"licensing",   item:"WI non-resident license verified active",        completed:true,  due:"Day 7"   },
      { category:"documents",   item:"W-4 completed and filed",                        completed:true,  due:"Day 1"   },
      { category:"documents",   item:"Direct deposit authorization on file",           completed:true,  due:"Day 1"   },
      { category:"documents",   item:"I-9 employment eligibility verified",            completed:true,  due:"Day 3"   },
      { category:"compliance",  item:"SF compliance and ethics training completed",    completed:true,  due:"Day 30"  },
      { category:"compliance",  item:"Social media compliance training acknowledged",  completed:true,  due:"Day 14"  },
      { category:"systems",     item:"Agency management system access granted",        completed:true,  due:"Day 1"   },
      { category:"systems",     item:"SF systems training completed",                  completed:true,  due:"Day 30"  },
      { category:"training",    item:"Product training — P&C lines",                  completed:true,  due:"Day 30"  },
      { category:"training",    item:"Product training — Life insurance",              completed:false, due:"Day 60"  },
      { category:"licensing",   item:"Life insurance license — exam scheduled",        completed:false, due:"May 2026"},
    ],
  },
];

const MOCK_PERFORMANCE = [
  {
    staff_id:"s1", staff_name:"Marcus Thompson", period:"April 2026",
    metrics:[
      { metric:"New Policies Written",    target:20, actual:18, unit:"count"      },
      { metric:"Life Apps Submitted",     target:3,  actual:1,  unit:"count"      },
      { metric:"Retention Rate",          target:88, actual:91, unit:"percentage" },
      { metric:"Customer Satisfaction",   target:95, actual:94, unit:"percentage" },
      { metric:"Revenue Contribution",    target:12000, actual:10800, unit:"dollars" },
    ],
  },
];

const MOCK_COMMISSIONS = [
  {
    id:"c1", staff_name:"Marcus Thompson", staff_id:"s1",
    structure_name:"Standard Licensed Agent Commission",
    effective_date:"Jan 2022",
    commission_type:"tiered",
    tiers:[
      { min:0,    max:10000, rate:8   },
      { min:10001,max:20000, rate:10  },
      { min:20001,max:null,  rate:12  },
    ],
    qualifying_products:["auto","home","life","health"],
    notes:"Commission paid monthly on new business production attributed to Marcus. Paid with regular payroll.",
    ytd_earned:4200,
    this_month:1080,
  },
];


// ─── Producer ROI Hook ───────────────────────────────────────
function useProducerROI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const currentYear  = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const [agencyRes, staffRes, prodRes, payrollDetailRes, payrollRunsRes, compRes] = await Promise.all([
          supabase.from("agency").select("id, name, smvc_rate_pc, blended_rate_other, lapse_rate_annual").eq("id", AGENCY_ID).single(),
          supabase.from("staff").select("id, first_name, last_name, role, start_date, pay_rate, employment_type, is_active").eq("agency_id", AGENCY_ID),
          supabase.from("producer_production").select("staff_id, period_year, period_month, line_of_business, policies_issued, premium_issued").eq("agency_id", AGENCY_ID).order("period_year",{ascending:false}).order("period_month",{ascending:false}),
          supabase.from("payroll_detail").select("staff_id, gross_pay, payroll_run_id"),
          supabase.from("payroll_runs").select("id, pay_date, pay_period_start, pay_period_end").eq("agency_id", AGENCY_ID).order("pay_date",{ascending:false}).limit(24),
          supabase.from("comp_recap").select("period_year, period_month, comp_type, comp_category, amount").eq("agency_id", AGENCY_ID),
        ]);

        const agency = agencyRes.data || {};
        const staff  = (staffRes.data || []).filter(s => s.is_active !== false);
        const production = prodRes.data || [];
        const payrollDetail = payrollDetailRes.data || [];
        const payrollRuns = payrollRunsRes.data || [];
        const compRecaps = compRes.data || [];

        // Lapse rate from comp_recap: prior-year vs current-year auto+fire YTD renewals
        const isPC = (cat) => {
          const c = (cat || "").toLowerCase();
          return c.includes("auto") || c.includes("home") || c.includes("fire") || c.includes("umbrella");
        };
        const renewalsYtd = (year) => compRecaps
          .filter(r => r.period_year === year && r.comp_type === "renewal" && isPC(r.comp_category) && r.period_month <= currentMonth)
          .reduce((s,r) => s + parseFloat(r.amount || 0), 0);

        const priorRenewals = renewalsYtd(currentYear - 1);
        const currentRenewals = renewalsYtd(currentYear);
        let computedLapse = null;
        if (priorRenewals > 0) {
          computedLapse = Math.max(0, Math.min(50, (1 - currentRenewals / priorRenewals) * 100));
        }
        const lapseRate = agency.lapse_rate_annual != null ? parseFloat(agency.lapse_rate_annual) : (computedLapse != null ? computedLapse : 10);

        // Per-producer monthly gross pay from last 3 payroll runs (×2 for semi-monthly)
        const last3RunIds = new Set(payrollRuns.slice(0, 3).map(r => r.id));
        const grossByStaff = {};
        const runsCountByStaff = {};
        for (const d of payrollDetail) {
          if (!last3RunIds.has(d.payroll_run_id)) continue;
          grossByStaff[d.staff_id] = (grossByStaff[d.staff_id] || 0) + parseFloat(d.gross_pay || 0);
          runsCountByStaff[d.staff_id] = (runsCountByStaff[d.staff_id] || 0) + 1;
        }
        const monthlyGrossByStaff = {};
        for (const sid of Object.keys(grossByStaff)) {
          const total = grossByStaff[sid];
          const runs = runsCountByStaff[sid] || 1;
          monthlyGrossByStaff[sid] = (total / runs) * 2;
        }

        const smvc = parseFloat(agency.smvc_rate_pc) || 10;
        const blended = parseFloat(agency.blended_rate_other) || 9;

        // Group production by staff/year/month
        const prodByKey = {};
        for (const p of production) {
          const k = `${p.staff_id}|${p.period_year}|${p.period_month}`;
          if (!prodByKey[k]) prodByKey[k] = { pc_premium: 0, other_premium: 0, policies: 0 };
          if (p.line_of_business === "auto" || p.line_of_business === "fire") {
            prodByKey[k].pc_premium += parseFloat(p.premium_issued || 0);
          } else {
            prodByKey[k].other_premium += parseFloat(p.premium_issued || 0);
          }
          prodByKey[k].policies += parseInt(p.policies_issued || 0, 10);
        }

        // Producers only (LSPs, Producers, FSS)
        const producers = staff.filter(s => {
          const r = (s.role || "").toLowerCase();
          return r.includes("lsp") || r.includes("producer") || r.includes("financial services");
        });

        const producerRows = producers.map(s => {
          const history = [];
          for (let back = 0; back < 24; back++) {
            const date = new Date(currentYear, currentMonth - 1 - back, 1);
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const k = `${s.id}|${y}|${m}`;
            const row = prodByKey[k] || { pc_premium: 0, other_premium: 0, policies: 0 };
            const newCommission = (row.pc_premium * smvc / 100) + (row.other_premium * blended / 100);
            history.push({
              year: y, month: m,
              monthLabel: date.toLocaleDateString("en-US",{month:"short", year:"2-digit"}),
              pcPremium: row.pc_premium,
              otherPremium: row.other_premium,
              policies: row.policies,
              newCommission,
            });
          }
          history.reverse();

          const current = history[history.length - 1] || { pcPremium: 0, otherPremium: 0, policies: 0, newCommission: 0 };
          const recent6 = history.slice(-6);
          const avgPC = recent6.reduce((s,h) => s + h.pcPremium, 0) / Math.max(1, recent6.length);
          const avgOther = recent6.reduce((s,h) => s + h.otherPremium, 0) / Math.max(1, recent6.length);
          const avgNewCommission = (avgPC * smvc / 100) + (avgOther * blended / 100);

          const monthlyGross = monthlyGrossByStaff[s.id] || (parseFloat(s.pay_rate || 0) / 12) || 0;
          const monthlyLoaded = monthlyGross * 1.15;

          const startDate = s.start_date ? new Date(s.start_date) : new Date();
          const tenureMonths = Math.max(0, Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.42)));

          return {
            staff_id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            role: s.role,
            start_date: s.start_date,
            tenureMonths,
            payRate: parseFloat(s.pay_rate || 0),
            monthlyGross,
            monthlyLoaded,
            currentMonth: current,
            history,
            avgPC,
            avgOther,
            avgNewCommission,
          };
        });

        setData({
          agency,
          smvcRate: smvc,
          blendedRate: blended,
          lapseRate,
          lapseRateComputed: computedLapse,
          lapseRateOverride: agency.lapse_rate_annual != null,
          priorRenewals,
          currentRenewals,
          producerRows,
        });
      } catch (e) {
        console.error("Producer ROI load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading };
}

// ─── Helpers ──────────────────────────────────────────────────
const scoreColor = (s) => s >= 8 ? T.green : s >= 6 ? T.amber : T.red;
const scoreBg    = (s) => s >= 8 ? T.greenLt : s >= 6 ? T.amberLt : T.redLt;
const pct = (a, t) => t ? Math.min(100, Math.round((a/t)*100)) : 0;
const fmt = (n, unit) => unit === "dollars" ? "$"+n.toLocaleString() : unit === "percentage" ? n+"%" : n.toString();

// ─── Shared Components ────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:T.white, border:`1px solid ${T.slate200}`, borderRadius:12, padding:"16px 18px", ...style }}>
    {children}
  </div>
);

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

const ProgressBar = ({ value, max, color=T.blue, height=6 }) => (
  <div style={{ height, background:T.slate100, borderRadius:height/2, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${pct(value,max)}%`, background:color, borderRadius:height/2, transition:"width 0.6s ease" }} />
  </div>
);

const StageBadge = ({ status }) => {
  const s = STAGES[status] || STAGES.new;
  return <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color }}>{s.label}</span>;
};

// ─── Section: Overview ────────────────────────────────────────
const HROverview = ({ applicants, staff, onboarding }) => {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({first_name:"", last_name:"", role:"", email:"", phone:"", start_date:"", employment_type:"w2"});

  const saveEmployee = async () => {
    if (!newEmployee.first_name || !newEmployee.last_name) return;
    if (supabase) {
      await supabase.from("staff").insert({ ...newEmployee, agency_id: AGENCY_ID, is_active: true });
    }
    setShowAddEmployee(false);
    setNewEmployee({first_name:"", last_name:"", role:"", email:"", phone:"", start_date:"", employment_type:"w2"});
  };

  const active      = applicants.filter(a => !["hired","rejected"].includes(a.status));
  const newApps     = applicants.filter(a => a.status === "new").length;
  const inInterview = applicants.filter(a => a.status === "interview").length;
  const inOffer     = applicants.filter(a => a.status === "offer").length;
  const activeStaff = staff.filter(s => s.is_active).length;
  const flagged     = staff.filter(s => s.compliance_flag).length;

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Active Pipeline",   value:active.length,   color:T.blue,  border:T.blue  },
          { label:"New Applicants",    value:newApps,         color:newApps>0?T.amber:T.slate400, border:newApps>0?T.amber:T.slate200 },
          { label:"In Interviews",     value:inInterview,     color:T.purple,border:T.purple },
          { label:"Offers Pending",    value:inOffer,         color:T.green, border:T.green },
          { label:"Active Staff",      value:activeStaff,     color:T.navy,  border:T.navy  },
          { label:"Compliance Flags",  value:flagged,         color:flagged>0?T.red:T.green, border:flagged>0?T.red:T.green },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderTop:`3px solid ${k.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color, letterSpacing:"-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Compliance reminder */}
      <div style={{ background:T.amberLt, border:`1px solid #FCD34D`, borderLeft:`4px solid ${T.amber}`, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#92400E", marginBottom:4 }}>⚠ AA05 Section I.P — Agent is liable for all staff activities</div>
        <div style={{ fontSize:11, color:"#92400E", lineHeight:1.6 }}>
          You are contractually responsible for every action your staff takes on behalf of the agency. All staff performing licensed activities must hold active licenses. Unlicensed staff may not quote, bind, or solicit. Tyler Smith (family employee) requires W-2 at year-end — review with Steven Bonventre at Club Capital Tax.
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
        {/* Active Pipeline */}
        
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button onClick={()=>setShowAddEmployee(s=>!s)} style={{padding:"8px 16px",fontSize:12,fontWeight:600,background:"#1E3A5F",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>➕ Add Employee</button>
      </div>

      {showAddEmployee && (
        <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1E3A5F",marginBottom:12}}>Add New Employee</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <input placeholder="First name *" value={newEmployee.first_name} onChange={e=>setNewEmployee({...newEmployee,first_name:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <input placeholder="Last name *" value={newEmployee.last_name} onChange={e=>setNewEmployee({...newEmployee,last_name:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <input placeholder="Role / Title" value={newEmployee.role} onChange={e=>setNewEmployee({...newEmployee,role:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <input placeholder="Email" value={newEmployee.email} onChange={e=>setNewEmployee({...newEmployee,email:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <input placeholder="Phone" value={newEmployee.phone} onChange={e=>setNewEmployee({...newEmployee,phone:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <input type="date" placeholder="Start date" value={newEmployee.start_date} onChange={e=>setNewEmployee({...newEmployee,start_date:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}} />
            <select value={newEmployee.employment_type} onChange={e=>setNewEmployee({...newEmployee,employment_type:e.target.value})} style={{padding:"8px 10px",borderRadius:6,border:"1px solid #CBD5E1",fontSize:12}}>
              <option value="w2">W-2 Employee</option>
              <option value="1099">1099 Contractor</option>
              <option value="family">Family Employee (W-2)</option>
            </select>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setShowAddEmployee(false)} style={{padding:"6px 14px",fontSize:12,background:"#F1F5F9",color:"#334155",border:"none",borderRadius:6,cursor:"pointer"}}>Cancel</button>
            <button onClick={saveEmployee} style={{padding:"6px 14px",fontSize:12,background:"#1E3A5F",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:600}}>Save Employee</button>
          </div>
        </div>
      )}
<Card>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:12 }}>Active recruiting pipeline</div>
          {active.length === 0 ? (
            <div style={{ fontSize:12, color:T.slate400, textAlign:"center", padding:"16px 0" }}>No active applicants</div>
          ) : active.map((app,i) => (
            <div key={app.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<active.length-1?`1px solid ${T.slate100}`:"none" }}>
              <div style={{ width:32, height:32, borderRadius:8, background:scoreBg(app.claude_score), display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:700, color:scoreColor(app.claude_score) }}>{app.claude_score}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.slate800 }}>{app.first_name} {app.last_name}</div>
                <div style={{ fontSize:10, color:T.slate500 }}>{app.position} · {app.intake_received_at}</div>
              </div>
              <StageBadge status={app.status} />
            </div>
          ))}
        </Card>

        {/* Team Snapshot */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:12 }}>Current team</div>
          {staff.filter(s => s.is_active).map((member,i) => (
            <div key={member.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<staff.length-1?`1px solid ${T.slate100}`:"none" }}>
              <div style={{ width:32, height:32, borderRadius:8, background:member.licensed?T.greenLt:T.slate100, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:11, fontWeight:700, color:member.licensed?T.green:T.slate500 }}>
                {member.first_name[0]}{member.last_name[0]}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.slate800 }}>{member.first_name} {member.last_name}</div>
                <div style={{ fontSize:10, color:T.slate500 }}>{member.role} · {member.employment_type.toUpperCase()}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                {member.licensed
                  ? <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:20, background:T.greenLt, color:"#065F46" }}>Licensed</span>
                  : <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:20, background:T.slate100, color:T.slate500 }}>Unlicensed</span>
                }
                {member.compliance_flag && (
                  <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:20, background:T.amberLt, color:"#92400E" }}>⚠ CPA Flag</span>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Recruiting Pipeline ────────────────────────────
const RecruitingPipeline = ({ applicants, onUpdate }) => {
  const [selected, setSelected] = useState(null);
  const stages = ["new","screening","interview","offer","hired","rejected"];


  const selectedApp = applicants.find(a => a.id === selected);

  return (
    <div>
      {/* Pipeline Kanban */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:8, marginBottom:16 }}>
        {stages.map(stage => {
          const s = STAGES[stage];
          const stageApps = applicants.filter(a => a.status === stage);
          return (
            <div key={stage} style={{ background:T.slate50, borderRadius:10, padding:"10px 8px", minHeight:120 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:10, fontWeight:700, color:s.color }}>{s.label}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10, background:s.bg, color:s.color }}>{stageApps.length}</span>
              </div>
              {stageApps.map(app => (
                <div
                  key={app.id}
                  onClick={() => setSelected(selected===app.id?null:app.id)}
                  style={{ background:T.white, border:`1px solid ${selected===app.id?T.blue:T.slate200}`, borderRadius:8, padding:"8px 10px", marginBottom:6, cursor:"pointer" }}
                >
                  <div style={{ fontSize:11, fontWeight:600, color:T.slate800 }}>{app.first_name} {app.last_name}</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4 }}>
                    <span style={{ fontSize:9, color:T.slate400 }}>{app.position.split(" ").slice(-1)[0]}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:scoreColor(app.claude_score) }}>{app.claude_score}/10</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Applicant Detail Panel */}
      {selectedApp && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:T.slate900 }}>{selectedApp.first_name} {selectedApp.last_name}</div>
              <div style={{ fontSize:12, color:T.slate500, marginTop:2 }}>{selectedApp.position} · Received {selectedApp.intake_received_at}</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ width:44, height:44, borderRadius:12, background:scoreBg(selectedApp.claude_score), display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:18, fontWeight:700, color:scoreColor(selectedApp.claude_score) }}>{selectedApp.claude_score}</span>
              </div>
              <StageBadge status={selectedApp.status} />
              <AskBtn size="small" context={`Applicant profile:\nName: ${selectedApp.first_name} ${selectedApp.last_name}\nPosition: ${selectedApp.position}\nClaude Score: ${selectedApp.claude_score}/10\nSummary: ${selectedApp.claude_summary}\n${selectedApp.interview_focus?"Interview Focus:\n"+selectedApp.interview_focus:""}\n${selectedApp.interview_notes?"Interview Notes: "+selectedApp.interview_notes:""}\n\nHelp me think through this candidate. Should I move forward? What should I focus on in the interview?`} />
            </div>
          </div>

          {/* Claude Summary */}
          <div style={{ background:T.slate50, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.slate600, marginBottom:4 }}>CLAUDE SUMMARY (Groq Analysis)</div>
            <div style={{ fontSize:12, color:T.slate700, lineHeight:1.7 }}>{selectedApp.claude_summary}</div>
          </div>

          {/* Interview Focus */}
          {selectedApp.interview_focus && (
            <div style={{ background:T.amberLt, border:`1px solid #FCD34D`, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#92400E", marginBottom:8 }}>ONE PAGE INTERVIEW FOCUS</div>
              <pre style={{ fontSize:11, color:"#78350F", lineHeight:1.7, margin:0, whiteSpace:"pre-wrap", fontFamily:"inherit" }}>
                {selectedApp.interview_focus}
              </pre>
            </div>
          )}

          {/* Interview notes */}
          {selectedApp.interview_notes && (
            <div style={{ background:T.blueLt, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#1E40AF", marginBottom:4 }}>INTERVIEW NOTES</div>
              <div style={{ fontSize:12, color:"#1E40AF", lineHeight:1.7 }}>{selectedApp.interview_notes}</div>
            </div>
          )}

          {/* Stage Actions */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {selectedApp.status === "new" && (
              <button onClick={() => onUpdate(selectedApp.id,"screening")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.blue, border:"none", borderRadius:7, cursor:"pointer" }}>→ Move to Screening</button>
            )}
            {selectedApp.status === "screening" && (
              <button onClick={() => onUpdate(selectedApp.id,"interview")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.amber, border:"none", borderRadius:7, cursor:"pointer" }}>→ Schedule Interview</button>
            )}
            {selectedApp.status === "interview" && (
              <>
                <button onClick={() => onUpdate(selectedApp.id,"offer")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.green, border:"none", borderRadius:7, cursor:"pointer" }}>→ Extend Offer</button>
                <button onClick={() => onUpdate(selectedApp.id,"rejected")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.red, background:T.redLt, border:"none", borderRadius:7, cursor:"pointer" }}>✗ Reject</button>
              </>
            )}
            {selectedApp.status === "offer" && (
              <>
                <button onClick={() => onUpdate(selectedApp.id,"hired")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.green, border:"none", borderRadius:7, cursor:"pointer" }}>✓ Mark Hired</button>
                <button onClick={() => onUpdate(selectedApp.id,"rejected")} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.red, background:T.redLt, border:"none", borderRadius:7, cursor:"pointer" }}>✗ Offer Declined</button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── Section: Staff Directory ─────────────────────────────────
const StaffDirectory = ({ staff }) => {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {staff.filter(s => s.is_active).map(member => {
        const isExpanded = expanded === member.id;
        return (
          <Card key={member.id} style={{ border:`1px solid ${isExpanded?T.blue:T.slate200}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, cursor:"pointer" }} onClick={() => setExpanded(isExpanded?null:member.id)}>
              {/* Avatar */}
              <div style={{ width:48, height:48, borderRadius:12, background:member.licensed?T.navy:T.slate200, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:member.licensed?T.white:T.slate500, flexShrink:0 }}>
                {member.first_name[0]}{member.last_name[0]}
              </div>

              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>{member.first_name} {member.last_name}</span>
                  {member.licensed
                    ? <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:T.greenLt, color:"#065F46" }}>Licensed</span>
                    : <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:T.slate100, color:T.slate500 }}>Unlicensed — cannot perform licensed activities</span>
                  }
                  {member.compliance_flag && (
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:T.amberLt, color:"#92400E" }}>⚠ CPA Flag</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:T.slate500 }}>
                  {member.role} · {member.employment_type === "w2" ? "W-2 Employee" : member.employment_type === "family" ? "Family Employee (W-2)" : "1099 Contractor"} · Since {member.start_date}
                </div>
              </div>

              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.slate900 }}>
                  {member.pay_type === "hourly" ? `$${member.pay_rate}/hr` : `$${member.pay_rate.toLocaleString()}/yr`}
                </div>
                <div style={{ fontSize:10, color:T.slate400 }}>{member.pay_type.replace(/_/g," ")}</div>
              </div>

              <span style={{ color:T.slate400, fontSize:12 }}>{isExpanded?"▲":"▼"}</span>
            </div>

            {isExpanded && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.slate100}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:8, marginBottom:12 }}>
                  {[
                    { label:"Email",      value:member.email },
                    { label:"Phone",      value:member.phone||"—" },
                    { label:"Licensed States", value:member.license_states.length>0?member.license_states.join(", "):"None" },
                    { label:"Start Date", value:member.start_date },
                  ].map((d,i) => (
                    <div key={i} style={{ background:T.slate50, borderRadius:8, padding:"7px 10px" }}>
                      <div style={{ fontSize:9, color:T.slate400, marginBottom:2 }}>{d.label}</div>
                      <div style={{ fontSize:11, fontWeight:500, color:T.slate700 }}>{d.value}</div>
                    </div>
                  ))}
                </div>
                {member.notes && (
                  <div style={{ fontSize:11, color:T.slate600, lineHeight:1.6, padding:"8px 10px", background:T.slate50, borderRadius:8, marginBottom:10 }}>
                    {member.notes}
                  </div>
                )}
                {member.compliance_flag && (
                  <div style={{ fontSize:11, color:"#92400E", background:T.amberLt, padding:"8px 10px", borderRadius:8, marginBottom:10 }}>
                    ⚠ {member.compliance_flag}
                  </div>
                )}
                <AskBtn size="small" context={`Staff member profile:\nName: ${member.first_name} ${member.last_name}\nRole: ${member.role}\nEmployment: ${member.employment_type}\nPay: ${member.pay_type} — ${member.pay_type==="hourly"?"$"+member.pay_rate+"/hr":"$"+member.pay_rate.toLocaleString()+"/yr"}\nLicensed: ${member.licensed?"Yes — "+member.license_states.join(", "):"No"}\nStart: ${member.start_date}\nNotes: ${member.notes}\n${member.compliance_flag?"Compliance flag: "+member.compliance_flag:""}\n\nHelp me review this team member's profile. Are there any compliance concerns or HR items I should address?`} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

// ─── Section: Onboarding ─────────────────────────────────────
const OnboardingSection = ({ onboarding }) => {
  const categoryColors = {
    licensing:  { color:T.green,  bg:T.greenLt  },
    documents:  { color:T.blue,   bg:T.blueLt   },
    compliance: { color:T.red,    bg:T.redLt    },
    systems:    { color:T.teal,   bg:T.tealLt   },
    training:   { color:T.purple, bg:T.purpleLt },
  };

  return (
    <div>
      {onboarding.map(record => {
        const completed = record.items.filter(i => i.completed).length;
        const total = record.items.length;
        const pctDone = Math.round((completed/total)*100);
        const grouped = record.items.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});

        return (
          <Card key={record.staff_id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>{record.staff_name}</div>
                <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>Started {record.start_date} · {record.days_employed} days employed · {record.template} template</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:22, fontWeight:700, color:pctDone===100?T.green:T.amber, letterSpacing:"-0.02em" }}>{pctDone}%</div>
                <div style={{ fontSize:10, color:T.slate400 }}>{completed}/{total} complete</div>
              </div>
            </div>

            <div style={{ height:8, background:T.slate100, borderRadius:4, overflow:"hidden", marginBottom:16 }}>
              <div style={{ height:"100%", width:`${pctDone}%`, background:pctDone===100?T.green:T.amber, borderRadius:4, transition:"width 0.6s ease" }} />
            </div>

            {Object.entries(grouped).map(([cat, items]) => {
              const cc = categoryColors[cat] || { color:T.slate500, bg:T.slate100 };
              return (
                <div key={cat} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:cc.color, marginBottom:6, textTransform:"capitalize" }}>{cat}</div>
                  {items.map((item,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:i<items.length-1?`1px solid ${T.slate100}`:"none" }}>
                      <div style={{ width:18, height:18, borderRadius:4, background:item.completed?T.green:T.slate200, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {item.completed && <span style={{ color:T.white, fontSize:10 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize:12, color:item.completed?T.slate400:T.slate800, textDecoration:item.completed?"line-through":"none" }}>{item.item}</span>
                      <span style={{ fontSize:10, color:T.slate400, flexShrink:0 }}>{item.due}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
};

// ─── Section: Performance — Producer ROI ──────────────────────────────────
// ─── Section: Performance — Producer ROI ──────────────────────
const PerformanceSection = ({ roi }) => {
  if (!roi) {
    return (
      <Card>
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: T.slate500 }}>
          Loading producer performance data…
        </div>
      </Card>
    );
  }

  const { smvcRate, blendedRate, lapseRate, lapseRateComputed, lapseRateOverride,
          priorRenewals, currentRenewals, producerRows } = roi;

  if (producerRows.length === 0) {
    return (
      <Card>
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: T.slate500 }}>
          No producers (LSPs / Financial Services Specialists) found in your staff list.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ─── BOOK LAPSE RATE CARD ─────────────────────────────────── */}
      <Card style={{ borderLeft: `4px solid ${T.blue}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.slate900 }}>Book Lapse Rate (P&C, YTD)</div>
            <div style={{ fontSize: 11, color: T.slate500, marginTop: 2 }}>
              Same-period auto + fire renewal commission: prior year vs current year
            </div>
          </div>
          <AskBtn size="small" context={`My agency book lapse rate analysis:\nPrior year YTD P&C renewal commission: $${Math.round(priorRenewals).toLocaleString()}\nCurrent year YTD P&C renewal commission: $${Math.round(currentRenewals).toLocaleString()}\nComputed lapse rate: ${(lapseRateComputed || 0).toFixed(1)}%\nApplied lapse rate (used in projections): ${lapseRate.toFixed(1)}%\n\nIs this lapse rate normal for our book? What should I focus on to reduce it?`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div style={{ background: T.slate50, padding: "10px 12px", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: T.slate500, marginBottom: 4 }}>Prior Year YTD Renewals</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.slate900 }}>
              {Number.isFinite(priorRenewals) ? "$" + Math.round(priorRenewals).toLocaleString() : "—"}
            </div>
          </div>
          <div style={{ background: T.slate50, padding: "10px 12px", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: T.slate500, marginBottom: 4 }}>Current Year YTD Renewals</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.slate900 }}>
              {Number.isFinite(currentRenewals) ? "$" + Math.round(currentRenewals).toLocaleString() : "—"}
            </div>
          </div>
          <div style={{ background: lapseRate > 15 ? T.redLt : lapseRate > 10 ? T.amberLt : T.greenLt, padding: "10px 12px", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: T.slate500, marginBottom: 4 }}>
              Lapse Rate {lapseRateOverride ? "(manual)" : "(computed)"}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: lapseRate > 15 ? "#991B1B" : lapseRate > 10 ? "#92400E" : "#065F46" }}>
              {lapseRate.toFixed(1)}%
            </div>
          </div>
          <div style={{ background: T.slate50, padding: "10px 12px", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: T.slate500, marginBottom: 4 }}>Applied to Projections</div>
            <div style={{ fontSize: 12, color: T.slate700, lineHeight: 1.4 }}>
              {(100 - lapseRate).toFixed(0)}% of policies renew next year (assumption)
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "10px 12px", background: T.blueLt, borderRadius: 8, fontSize: 11, color: T.slate700, lineHeight: 1.5 }}>
          <strong>Why this matters:</strong> Each producer&apos;s new business takes 12-18 months to start producing renewal commission.
          A lapse rate of {lapseRate.toFixed(1)}% means roughly {(100 - lapseRate).toFixed(0)}% of what they write today will still be on the books next year, generating renewal commission.
          The projections below use this rate to estimate when each producer becomes profitable against their fully-loaded payroll cost.
        </div>
      </Card>

      {/* ─── PER-PRODUCER ROI ANALYSIS ───────────────────────────── */}
      {producerRows.map(p => <ProducerROICard key={p.staff_id} producer={p} smvcRate={smvcRate} blendedRate={blendedRate} lapseRate={lapseRate} />)}

      {/* ─── ASSUMPTIONS FOOTER ──────────────────────────────────── */}
      <Card style={{ background: T.slate50, border: `1px dashed ${T.slate200}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.slate700, marginBottom: 8 }}>Assumptions used in projections</div>
        <div style={{ fontSize: 11, color: T.slate600, lineHeight: 1.7 }}>
          <div>• <strong>SMVC rate (P&C):</strong> {smvcRate.toFixed(2)}% — agent earns this percent of issued auto + fire premium per A005 agreement</div>
          <div>• <strong>Blended rate (other):</strong> {blendedRate.toFixed(2)}% — blended commission for Life, Health, Financial Services</div>
          <div>• <strong>Lapse rate:</strong> {lapseRate.toFixed(1)}% per year — applied as compounding annual decay to renewing cohorts</div>
          <div>• <strong>Fully-loaded payroll:</strong> gross pay × 1.15 — covers FICA, FUTA, SUTA, WC</div>
          <div>• <strong>Renewal start:</strong> month 13 — new business policies issued today start generating renewal commission 12 months from now</div>
          <div>• <strong>Steady-state pace:</strong> 6-month rolling average of issued premium per producer</div>
        </div>
      </Card>
    </div>
  );
};

// ─── Producer ROI Card — per-producer analysis with stacked cohort projection ───
const ProducerROICard = ({ producer, smvcRate, blendedRate, lapseRate }) => {
  const persistency = 1 - lapseRate / 100;

  // Build the 24 future months of projection
  // Each historical month is a "cohort" that survives going forward
  // For future months, we assume steady-state at producer.avg{PC,Other}
  const futureMonths = 24;
  const totalMonths = producer.history.length + futureMonths;

  // Build cohort series: one per month index in the timeline (0 = oldest history, history.length = current+1)
  const cohorts = [];
  for (let i = 0; i < producer.history.length; i++) {
    const h = producer.history[i];
    cohorts.push({ pcPremium: h.pcPremium, otherPremium: h.otherPremium, isHistory: true });
  }
  for (let i = 0; i < futureMonths; i++) {
    cohorts.push({ pcPremium: producer.avgPC, otherPremium: producer.avgOther, isHistory: false });
  }

  // For each forward month index from producer.history.length onward (i.e., projection months),
  // compute total commission to agency = sum of (cohort_k's renewal commission at age = (month - k))
  // Rules: at age 0 (same month as written), commission = full new-business commission (SMVC × pc + blended × other)
  //        at age 1-11 months, no additional commission yet (it's the same policies, paid once at issue under SF)
  //        at age 12+, the renewal commission kicks in, reduced by persistency^floor((age-12)/12 + 1)
  //
  // Simpler model that matches Rebecca's description:
  //   For month N going forward, projected commission = NEW commission this month +
  //     for each cohort k written ≥12 months ago: cohort_k_commission × persistency^(years_since)
  //   where years_since = floor((N - k) / 12)

  const forwardStartIdx = producer.history.length;
  const projectionMonths = []; // {label, newCommission, renewalCommission, totalCommission, isHistory}

  for (let i = 0; i < totalMonths; i++) {
    const date = new Date(producer.history[0].year, producer.history[0].month - 1 + i, 1);
    const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const isHistory = i < forwardStartIdx;

    const cohortAtI = cohorts[i] || { pcPremium: 0, otherPremium: 0 };
    const newCommission = (cohortAtI.pcPremium * smvcRate / 100) + (cohortAtI.otherPremium * blendedRate / 100);

    // Renewal commission: only project this for FORWARD months. Historical bars show
    // only what the producer actually earned (new business commission) — we don't
    // retroactively simulate renewals that the producer didn't actually generate.
    let renewalCommission = 0;
    if (!isHistory) {
      for (let k = 0; k < i; k++) {
        const age = i - k;
        if (age < 12) continue;
        const yearsRenewed = Math.floor((age - 12) / 12) + 1;
        const survivalFactor = Math.pow(persistency, yearsRenewed);
        const cohortCommission = (cohorts[k].pcPremium * smvcRate / 100) + (cohorts[k].otherPremium * blendedRate / 100);
        renewalCommission += cohortCommission * survivalFactor;
      }
    }

    projectionMonths.push({ label, newCommission, renewalCommission,
                            totalCommission: newCommission + renewalCommission, isHistory });
  }

  // Find breakeven month — first FORWARD month where totalCommission >= monthlyLoaded
  const monthlyLoaded = producer.monthlyLoaded;
  let breakevenIdx = -1;
  for (let i = forwardStartIdx; i < projectionMonths.length; i++) {
    if (projectionMonths[i].totalCommission >= monthlyLoaded) {
      breakevenIdx = i;
      break;
    }
  }
  const breakevenLabel = breakevenIdx >= 0 ? projectionMonths[breakevenIdx].label : null;
  const monthsToBreakeven = breakevenIdx >= 0 ? breakevenIdx - forwardStartIdx + 1 : null;

  // Status pill — logic accounts for the difference between covering cost from
  // new business alone (rare for producers) vs needing renewal stack-up over time
  // (typical, expected, and what the projection chart visualizes).
  let status, statusColor, statusBg, statusText;
  // Check this at the END of the calc so we use newly-computed currentNewCommission
  // (defined later); we'll set status after all calcs are done. Placeholder here.
  status = "On track"; statusColor = "#065F46"; statusBg = T.greenLt;
  statusText = "";

  // Current month metrics — actual new-business commission this producer earned the agency THIS MONTH.
  // We deliberately do NOT add simulated renewal income here. Renewal commission in comp_recap is at
  // the AGENCY level, not tagged to a producer; attributing it back is misleading.
  // The renewal projection in the chart below shows what the cohort math says SHOULD build over time.
  const cur = producer.currentMonth;
  const currentNewCommission = (cur.pcPremium * smvcRate / 100) + (cur.otherPremium * blendedRate / 100);
  const currentNetToAgency = currentNewCommission - monthlyLoaded;

  // Now set the real status based on actual + projected economics
  if (currentNewCommission >= monthlyLoaded) {
    status = "Profitable now"; statusColor = "#065F46"; statusBg = T.greenLt;
    statusText = `New-business commission alone covers fully-loaded cost (${producer.name.split(" ")[0]} is a star producer)`;
  } else if (breakevenIdx < 0) {
    status = "Behind pace"; statusColor = "#991B1B"; statusBg = T.redLt;
    statusText = `Not projected to break even within 24 months at current pace — production needs to increase or cost structure needs review`;
  } else if (monthsToBreakeven <= 18) {
    status = "On track"; statusColor = "#065F46"; statusBg = T.greenLt;
    statusText = `Cohort math projects renewals will cover fully-loaded cost in ${monthsToBreakeven} months (${breakevenLabel}) — within the 12-18 month target window`;
  } else {
    status = "Slow ramp"; statusColor = "#92400E"; statusBg = T.amberLt;
    statusText = `Cohort math projects breakeven in ${monthsToBreakeven} months (${breakevenLabel}) — outside the 18-month target. Consider production target adjustment.`;
  }

  // Chart dimensions
  const chartH = 180;
  const maxValue = Math.max(
    monthlyLoaded * 1.3,
    ...projectionMonths.map(p => p.totalCommission)
  ) || 1;

  return (
    <Card>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.slate900 }}>{producer.name}</div>
          <div style={{ fontSize: 11, color: T.slate500, marginTop: 2 }}>
            {producer.role} · Started {producer.start_date} · Tenure {producer.tenureMonths} months
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: statusBg, color: statusColor }}>{status}</span>
          <AskBtn size="small" context={`Producer ROI analysis — ${producer.name}\nRole: ${producer.role}\nTenure: ${producer.tenureMonths} months\nMonthly issued premium (P&C avg): $${Math.round(producer.avgPC).toLocaleString()}\nMonthly issued premium (other avg): $${Math.round(producer.avgOther).toLocaleString()}\nMonthly fully-loaded cost: $${Math.round(monthlyLoaded).toLocaleString()}\nNew-business commission this month: $${Math.round(currentNewCommission).toLocaleString()} (issued premium × SMVC rate)\nMonthly fully-loaded cost: $${Math.round(monthlyLoaded).toLocaleString()}\nNet to agency this month (new-biz only): $${Math.round(currentNetToAgency).toLocaleString()}\nProjected breakeven (when renewal stack-up + new biz covers cost): ${breakevenLabel || "outside 24 months"}\nLapse rate applied: ${lapseRate.toFixed(1)}%\nSMVC rate: ${smvcRate.toFixed(2)}% on P&C, ${blendedRate.toFixed(2)}% blended on other lines\n\nIs this producer on track? Should I increase their production target? What should I be doing differently?`} />
        </div>
      </div>

      {/* Status text */}
      <div style={{ fontSize: 11, color: T.slate600, marginBottom: 14, fontStyle: "italic" }}>{statusText}</div>

      {/* Current Month Economics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        <div style={{ background: T.slate50, padding: "9px 11px", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.slate500, marginBottom: 3 }}>P&C Premium Issued</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.slate900 }}>${Math.round(cur.pcPremium).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.slate400, marginTop: 2 }}>{cur.policies} policies</div>
        </div>
        <div style={{ background: T.slate50, padding: "9px 11px", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.slate500, marginBottom: 3 }}>Other Lines Premium</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.slate900 }}>${Math.round(cur.otherPremium).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.slate400, marginTop: 2 }}>Life · FS</div>
        </div>
        <div style={{ background: T.blueLt, padding: "9px 11px", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.slate500, marginBottom: 3 }}>New-Biz Commission</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>${Math.round(currentNewCommission).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.slate400, marginTop: 2 }}>Premium × SMVC</div>
        </div>
        <div style={{ background: T.amberLt, padding: "9px 11px", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.slate500, marginBottom: 3 }}>Fully-Loaded Cost</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>${Math.round(monthlyLoaded).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: T.slate400, marginTop: 2 }}>Gross × 1.15</div>
        </div>
        <div style={{ background: currentNetToAgency >= 0 ? T.greenLt : T.redLt, padding: "9px 11px", borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.slate500, marginBottom: 3 }}>Net to Agency</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: currentNetToAgency >= 0 ? "#065F46" : "#991B1B" }}>
            {currentNetToAgency >= 0 ? "+" : "-"}${Math.round(Math.abs(currentNetToAgency)).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: T.slate400, marginTop: 2 }}>This month</div>
        </div>
      </div>

      {/* 24-Month Projection Chart */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.slate800 }}>Commission Trajectory — 24 months back, 24 months forward</div>
          <div style={{ display: "flex", gap: 12, fontSize: 10, color: T.slate500 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.green, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />New business</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: T.blue, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Renewals</span>
            <span><span style={{ display: "inline-block", width: 18, height: 2, background: T.red, marginRight: 4, verticalAlign: "middle" }} />Cost line</span>
          </div>
        </div>

        <div style={{ position: "relative", height: chartH + 30, background: T.slate50, borderRadius: 8, padding: "10px 8px 4px 8px" }}>
          {/* Cost line */}
          <div style={{
            position: "absolute",
            left: 8, right: 8,
            top: 10 + chartH - (monthlyLoaded / maxValue * chartH),
            height: 2, background: T.red,
            borderTop: `2px dashed ${T.red}`,
            zIndex: 2,
          }} />
          <div style={{
            position: "absolute",
            right: 12,
            top: 10 + chartH - (monthlyLoaded / maxValue * chartH) - 16,
            fontSize: 9, fontWeight: 700, color: T.red,
            background: T.white, padding: "1px 5px", borderRadius: 4,
            zIndex: 3,
          }}>${Math.round(monthlyLoaded).toLocaleString()}/mo cost</div>

          {/* Bars */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: chartH, position: "relative" }}>
            {projectionMonths.map((m, i) => {
              const newH = (m.newCommission / maxValue) * chartH;
              const renH = (m.renewalCommission / maxValue) * chartH;
              const isBreakeven = i === breakevenIdx;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: chartH, position: "relative" }}>
                  {isBreakeven && (
                    <div style={{ position: "absolute", top: -4, fontSize: 14 }}>⭐</div>
                  )}
                  <div style={{ width: "85%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: chartH, opacity: m.isHistory ? 1 : 0.7 }}>
                    {renH > 0 && (
                      <div style={{ height: renH, background: T.blue, borderRadius: "0", borderTop: newH > 0 ? "none" : "2px 2px 0 0" }} />
                    )}
                    {newH > 0 && (
                      <div style={{ height: newH, background: T.green, borderRadius: renH > 0 ? "0" : "2px 2px 0 0" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-axis labels — every 6th month */}
          <div style={{ display: "flex", gap: 1, marginTop: 4 }}>
            {projectionMonths.map((m, i) => (
              <div key={i} style={{ flex: 1, fontSize: 8, color: m.isHistory ? T.slate500 : T.slate400, textAlign: "center" }}>
                {i % 6 === 0 ? m.label : ""}
              </div>
            ))}
          </div>

          {/* Vertical "now" divider */}
          <div style={{
            position: "absolute",
            left: `${8 + (forwardStartIdx / projectionMonths.length) * (100 - 1.6)}%`,
            top: 6, height: chartH + 8,
            borderLeft: `1px dashed ${T.slate400}`,
            zIndex: 1,
          }} />
        </div>

        {breakevenLabel && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: T.greenLt, borderRadius: 8, fontSize: 11, color: "#065F46" }}>
            <strong>⭐ Projected breakeven: {breakevenLabel}</strong> — at {producer.name.split(" ")[0]}&apos;s current 6-month avg of ${Math.round(producer.avgPC + producer.avgOther).toLocaleString()}/mo issued premium, the agency earns ${Math.round(producer.avgNewCommission).toLocaleString()}/mo in new-business commission. As renewals stack up over time (at {(100-lapseRate).toFixed(0)}% persistency), total monthly commission generated by {producer.name.split(" ")[0]}&apos;s book is projected to first cover their ${Math.round(monthlyLoaded).toLocaleString()}/mo fully-loaded cost in {monthsToBreakeven} months.
          </div>
        )}
        {!breakevenLabel && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: T.amberLt, borderRadius: 8, fontSize: 11, color: "#92400E" }}>
            <strong>Projected breakeven not within 24 months.</strong> At current pace of ${Math.round(producer.avgPC + producer.avgOther).toLocaleString()}/mo issued premium (${Math.round(producer.avgNewCommission).toLocaleString()}/mo new-business commission to the agency), this producer&apos;s renewal-tail trajectory does not catch up to ${Math.round(monthlyLoaded).toLocaleString()}/mo fully-loaded cost within the projection window. Either issued premium needs to increase, or pay rate needs review.
          </div>
        )}
      </div>
    </Card>
  );
};


// ─── Section: Commissions ─────────────────────────────────────
const CommissionsSection = ({ commissions }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    {commissions.map(c => (
      <Card key={c.id}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>{c.staff_name}</div>
            <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>{c.structure_name} · Effective {c.effective_date}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:T.slate400, marginBottom:2 }}>This month</div>
            <div style={{ fontSize:20, fontWeight:700, color:T.green }}>${c.this_month.toLocaleString()}</div>
            <div style={{ fontSize:10, color:T.slate400 }}>YTD: ${c.ytd_earned.toLocaleString()}</div>
          </div>
        </div>

        {/* Tier Structure */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.slate600, marginBottom:8 }}>Commission Tiers</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {c.tiers.map((tier,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:T.slate50, borderRadius:8 }}>
                <span style={{ fontSize:12, color:T.slate600, flex:1 }}>
                  ${tier.min.toLocaleString()} {tier.max?`— $${tier.max.toLocaleString()}`:"and above"}
                </span>
                <span style={{ fontSize:14, fontWeight:700, color:T.blue }}>{tier.rate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Qualifying Products */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.slate600, marginBottom:6 }}>Qualifying products</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {c.qualifying_products.map(p => (
              <span key={p} style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:T.blueLt, color:T.blue }}>{p}</span>
            ))}
          </div>
        </div>

        {c.notes && (
          <div style={{ fontSize:11, color:T.slate600, lineHeight:1.6, padding:"8px 10px", background:T.slate50, borderRadius:8, marginBottom:10 }}>
            {c.notes}
          </div>
        )}

        <AskBtn size="small" context={`Commission structure review:\nStaff: ${c.staff_name}\nStructure: ${c.structure_name}\nThis month earned: $${c.this_month}\nYTD earned: $${c.ytd_earned}\nTiers: ${c.tiers.map(t=>`$${t.min}-${t.max||"+"} at ${t.rate}%`).join(", ")}\n\nHelp me verify this commission calculation is correct and review if the structure still makes sense given current production levels.`} />
      </Card>
    ))}
  </div>
);

// ─── Main HR Module ───────────────────────────────────────────
export default function HRPeople() {
  const { data: roi } = useProducerROI();
  const [section,     setSection]     = useState("overview");
  const [applicants,  setApplicants]  = useState(MOCK_APPLICANTS);

  const updateApplicantStage = (id, newStatus) => {
    setApplicants(prev => prev.map(a => a.id === id ? {...a, status:newStatus} : a));
  };

  const sections = [
    { id:"overview",    label:"Overview"    },
    { id:"recruiting",  label:"Recruiting"  },
    { id:"staff",       label:"Staff"       },
    { id:"onboarding",  label:"Onboarding"  },
    { id:"performance", label:"Performance" },
    { id:"commissions", label:"Commissions" },
  ];

  return (
    <div>
      {/* Module Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>HR & People</div>
          <div style={{ fontSize:12, color:T.slate500, marginTop:3 }}>
            {MOCK_STAFF.filter(s=>s.is_active).length} active staff · {MOCK_APPLICANTS.filter(a=>!["hired","rejected"].includes(a.status)).length} applicants in pipeline · Resume scanner active
          </div>
        </div>
        <AskBtn context="Give me a complete HR review. How is my recruiting pipeline looking? Any compliance concerns with my current team? What HR actions should I take this week?" />
      </div>

      {/* Section Navigation */}
      <div style={{ display:"flex", gap:2, flexWrap:"wrap", background:T.slate100, borderRadius:10, padding:4, marginBottom:18 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding:"7px 14px", fontSize:12, fontWeight:section===s.id?600:400, color:section===s.id?T.slate900:T.slate500, background:section===s.id?T.white:"transparent", border:"none", borderRadius:7, cursor:"pointer", transition:"all 0.12s", boxShadow:section===s.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {section === "overview"    && <HROverview        applicants={applicants} staff={MOCK_STAFF} onboarding={MOCK_ONBOARDING} />}
      {section === "recruiting"  && <RecruitingPipeline applicants={applicants} onUpdate={updateApplicantStage} />}
      {section === "staff"       && <StaffDirectory     staff={MOCK_STAFF} />}
      {section === "onboarding"  && <OnboardingSection  onboarding={MOCK_ONBOARDING} />}
      {section === "performance" && <PerformanceSection  roi={roi} />}
      {section === "commissions" && <CommissionsSection  commissions={MOCK_COMMISSIONS} />}
    </div>
  );
}
