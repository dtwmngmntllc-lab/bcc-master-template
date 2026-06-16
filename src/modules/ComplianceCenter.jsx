import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";

// ============================================================
// BCC COMPLIANCE CENTER MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Dashboard     — Critical alerts, upcoming deadlines, status
//   2. Rules Library — All 57 rules, searchable, filterable
//   3. Pre-Post Checklist — 26-item social media checklist
//   4. Calendar      — Compliance deadlines and recurring items
//   5. Audit Log     — Record of reviews, flags, completions
//
// DATA: Reads compliance_rules, compliance_calendar,
//       compliance_log tables in Supabase
// In production replace MOCK_DATA with:
//   const { data } = await supabase
//     .from('compliance_rules')
//     .select('*')
//     .eq('agency_id', agencyId)
//     .eq('is_active', true)
//     .order('category')
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

// ─── Category Config ──────────────────────────────────────────
const CATEGORY_CONFIG = {
  contract:              { label: "Contract Basics",        color: T.navy,   icon: "📜" },
  advertising:           { label: "Advertising",            color: T.blue,   icon: "📢" },
  social_media:          { label: "Social Media",           color: T.purple, icon: "📱" },
  social_media_checklist:{ label: "Pre-Post Checklist",     color: T.teal,   icon: "✅" },
  trademark:             { label: "Trademark & Brand",      color: T.amber,  icon: "®️" },
  giveaways:             { label: "Giveaways",              color: T.green,  icon: "🎁" },
  financial:             { label: "Financial",              color: T.blue,   icon: "💰" },
  licensing:             { label: "Licensing",              color: T.red,    icon: "🪪" },
  data_privacy:          { label: "Data Privacy",           color: T.slate700,icon: "🔒" },
  medicare:              { label: "Medicare",               color: T.red,    icon: "🏥" },
};

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_RULES = [
  { id:"1",  rule_code:"AA05-002", category:"contract",     title:'Customer Not Client — Principal-Agent Rule',      severity:"critical", description:'The word "client" is PROHIBITED. The agent-customer relationship is Principal-Agent, not fiduciary. Always say "customer." Using "client" misrepresents your legal role and creates liability.', source:"AA05 Section I.B" },
  { id:"2",  rule_code:"AA05-003", category:"contract",     title:"Agent Title Only — No Expert or Specialist",      severity:"critical", description:'Never use "expert," "specialist," "advisor," or "consultant." AA05 I.O limits you to "agent" or "licensed agent" only. These words create legally heightened expectations that become court ammunition.', source:"AA05 Section I.O" },
  { id:"3",  rule_code:"AA05-004", category:"contract",     title:"Exclusivity — SF as Principal Occupation",        severity:"critical", description:"State Farm must be your principal occupation. Cannot write for other carriers or act as broker for others without written SF consent.", source:"AA05 Section I.I" },
  { id:"4",  rule_code:"AA05-005", category:"contract",     title:"Annual Compliance Training — Mandatory",          severity:"critical", description:"Annual compliance and ethics training is a binding contractual obligation under AA05. Not optional. Must be completed every calendar year.", source:"AA05 Section I.D" },
  { id:"5",  rule_code:"AD-001",   category:"advertising",  title:"Prior Approval for All SF-Referencing Advertising",severity:"critical", description:"ALL ads referring to or identifying State Farm require PRIOR WRITTEN APPROVAL. Includes print, digital, social, business cards with SF branding, signage, email marketing, and websites mentioning SF. Preapproved Hootsuite/NMP content satisfies this.", source:"AA05 Section I.H" },
  { id:"6",  rule_code:"AD-002",   category:"advertising",  title:"No Absolutes, Guarantees, or Superlatives",       severity:"critical", description:'SF controls all pricing. Prohibited: absolutes (always/never), guarantees (will/promise), superlatives (best/#1), pricing language (low cost/cheap/affordable), service claims (most reliable/world-class). Exception: "best" when naming a specific award only.', source:"AA05 Sections I.D + I.N" },
  { id:"7",  rule_code:"AD-003",   category:"advertising",  title:"Complete Prohibited Terms List",                  severity:"critical", description:"Client→Customer. Solutions→Options. Expert/Specialist→Remove. Fully licensed→Licensed. Affordable rates→Rates more affordable than you think. Best/#1→Remove. Transfers welcome→Remove. Financial freedom→Remove. World-class→Remove.", source:"AA05 Sections I.B, I.D, I.J, I.N, I.O" },
  { id:"8",  rule_code:"SM-003",   category:"social_media", title:"Instagram — Manual Daily Posting Required",       severity:"warning",  description:"Instagram posts MUST be posted manually each day. No reliable API auto-scheduling exists. BCC will send daily reminder alerts for scheduled Instagram posts — it will NOT auto-post. Batch-prepare content but post manually.", source:"Social Chef Claude Content Playbook v1.0" },
  { id:"9",  rule_code:"SM-005",   category:"social_media", title:"English-Only Content — FINRA Requirement",        severity:"critical", description:"ALL business content must be in English. FINRA requires archiving of all communications. Proofpoint monitoring is English-only. Non-English content cannot be properly monitored — this is a contractual compliance requirement.", source:"AA05 Section I.D + FINRA Rule 2210" },
  { id:"10", rule_code:"SM-006",   category:"social_media", title:"Agent Liable for All Staff Social Media Posts",   severity:"critical", description:"AA05 Section I.P makes you contractually liable for every post your staff creates on behalf of the agency. Train all staff before granting account access. Review staff content before publishing.", source:"AA05 Section I.P" },
  { id:"11", rule_code:"SM-PROHIBIT-001", category:"social_media", title:"Absolutely Prohibited Social Media Topics", severity:"critical", description:"NEVER post: investment products, mutual funds, college savings plans, specific life/health product names, pricing/rates, internal SF processes, incentive program details (ScoreCard, AIPP, bonuses), proprietary SF information, claims/underwriting rules.", source:"AA05 Sections I.D, I.F, I.H, I.N" },
  { id:"12", rule_code:"SM-PROHIBIT-002", category:"social_media", title:"Customer Data — Absolute Prohibition",    severity:"critical", description:"Customer information is State Farm's TRADE SECRET under AA05 I.F. Sharing it on social media is a contract violation — not merely a privacy issue. Never confirm or deny someone is a customer publicly.", source:"AA05 Section I.F" },
  { id:"13", rule_code:"SM-PROHIBIT-003", category:"social_media", title:"No PHI Visible in Photos or Videos",      severity:"critical", description:"HIPAA BAA requires safeguarding all Protected Health Information. Check all photos and video backgrounds for visible paperwork, screen displays, or documents showing health information before posting.", source:"HIPAA BAA (AMD99)" },
  { id:"14", rule_code:"SM-PROHIBIT-006", category:"social_media", title:"Written Release Required for All People in Photos", severity:"critical", description:"A person's face is their legal property under Right of Publicity laws. Get written releases from EVERY identifiable person before posting — team members, customers, event attendees. No exceptions.", source:"Right of Publicity Laws" },
  { id:"15", rule_code:"TM-001",   category:"trademark",    title:"SF Name — Must Be Followed by Agent",            severity:"critical", description:'State Farm in account names/usernames is ONLY authorized if immediately followed by "agent." CORRECT: "Jane Doe – State Farm Agent." INCORRECT: "Jane Doe State Farm."', source:"State Farm Brand Standards" },
  { id:"16", rule_code:"TM-004",   category:"trademark",    title:"Google Business Profile — Insurance Only",       severity:"critical", description:"GBP is approved for insurance products ONLY. STRICTLY FORBIDDEN: financial services, banking, CDs, annuities, mutual funds, securities, specific life/health products. GBP must use SF Outlook email — Gmail is non-compliant.", source:"State Farm Business Accounts Guidelines (Sep 2025)" },
  { id:"17", rule_code:"GIVE-001", category:"giveaways",   title:"No Element of Chance in Any Giveaway",           severity:"critical", description:'Sweepstakes, contests, lotteries, raffles, and "enter to win" are PROHIBITED. Every person who takes the specified action MUST receive the item. No randomness. COMPLIANT: "Stop by for a free umbrella." NON-COMPLIANT: "Enter to win."', source:"State Farm Giveaway Guidelines (Jul 2025)" },
  { id:"18", rule_code:"GIVE-004", category:"giveaways",   title:"Referral Rewards Cannot Be on Social Media",     severity:"critical", description:"Referral rewards — gift cards, monetary value, gifts — may NOT be advertised on any social platform. Bank or securities-linked giveaways on social media are also prohibited.", source:"State Farm Giveaway Guidelines (Jul 2025)" },
  { id:"19", rule_code:"FIN-001",  category:"financial",   title:"PFA — Separate Account, Never Commingled",       severity:"critical", description:"Premium Fund Account must be maintained separately at an SF-approved bank. NEVER commingled with operating or personal funds. Subject to SF audit at any time. PFA box: 2 keys maximum (agent + CSM only).", source:"AA05 Section I.K" },
  { id:"20", rule_code:"FIN-002",  category:"financial",   title:"PFA — Not a Business Asset, Not on Balance Sheet", severity:"critical", description:"PFA is a compliance tracking item ONLY. It does NOT appear on the balance sheet. Never represent PFA as equity or use as collateral. Review with CPA annually for proper tax treatment.", source:"SF PFA Policy Guidelines" },
  { id:"21", rule_code:"FIN-003",  category:"financial",   title:"No Rebating or Unauthorized Incentives",         severity:"critical", description:"Nothing of value may be offered contingent on a policy purchase. Gift cards for quotes are permitted. Gift cards for sales are not. Never pay for or incentivize Google reviews.", source:"AA05 Section I.D — Anti-Rebating Laws" },
  { id:"22", rule_code:"FIN-005",  category:"financial",   title:"Agency Financial Health Benchmarks",             severity:"info",     description:"Payroll+Taxes/Gross: Healthy 40-50%, Warning >51%, Critical >55%. Rent/Gross: Healthy 5-8%, Warning >9%, Critical >12%. Net Margin: Healthy 25-35%, Warning <24%, Critical <20%. Owner Comp/Gross: Healthy 25-35%.", source:"State Farm Agency Reference Guide v1.0" },
  { id:"23", rule_code:"LIC-001",  category:"licensing",   title:"License Verification Before Any Business Activity", severity:"critical", description:"Verify licensing before ANY product sale. Confirm agent holds required license, license is current, and any involved staff are credentialed for that specific product. Never permit unlicensed staff to perform licensed activities.", source:"AA05 Sections I.D + I.P" },
  { id:"24", rule_code:"LIC-003",  category:"licensing",   title:"E&O Insurance — Never Let It Lapse",             severity:"critical", description:"Lapsed E&O is a contract violation. Flag renewal 90 days before expiration. Begin renewal process immediately. Provide updated certificate to SF upon renewal.", source:"SF Agent Agreement — E&O Requirements" },
  { id:"25", rule_code:"PRIV-001", category:"data_privacy","title":"Customer Data — State Farm Trade Secret",      severity:"critical", description:"All customer information is SF's trade secret (AA05 I.F). This is a property violation if shared — not just a privacy issue. At termination, return ALL customer data within 10 days.", source:"AA05 Section I.F" },
  { id:"26", rule_code:"PRIV-002", category:"data_privacy","title":"HIPAA Breach — Report Within 48 Hours",       severity:"critical", description:"Report any suspected PHI breach within 48 hours to 1-877-766-6371 AND written notice to Chief Privacy Officer. Implement administrative, physical, and technical PHI safeguards. HIPAA obligations survive agreement termination.", source:"HIPAA Business Associate Amendment (AMD99)" },
  { id:"27", rule_code:"MED-001",  category:"medicare",    title:"Medicare Marketing — CMS Strict Rules",          severity:"critical", description:"PROHIBITED for Medicare: door-to-door solicitation, cold calling, gifts over $15, marketing in provider offices (except common areas), claiming to represent Medicare/government, cross-selling non-health products during Medicare appointments.", source:"CMS Medicare Marketing Guidelines" },
];

const MOCK_CHECKLIST = Array.from({ length: 26 }, (_, i) => ({
  id: `cl-${i+1}`,
  rule_code: `CHECKLIST-${String(i+1).padStart(2,"0")}`,
  number: i + 1,
  title: [
    "No prohibited topics",
    "Authorized language only",
    "Customer — not client",
    "Options — not solutions",
    "No absolutes, guarantees, or superlatives",
    "No expert, specialist, or world-class",
    "No scare tactics or fear mongering",
    "No legal or financial advice",
    "All trademarks used correctly",
    "Personal Price Plan® correct usage",
    "AI disclaimer included if AI used in visuals",
    "Giveaway — every participant receives item",
    "All text in English",
    "No pricing specifics or premium amounts",
    "Content does not imply agent is the insurer",
    "Event photos — no SF product info visible",
    "No customer PII or SPI disclosed",
    "No PHI visible in photos or videos",
    "Written release for all identifiable people",
    "State license numbers included if required (AR, NM)",
    "GBP posts — insurance products only",
    "Multi-office GBP — distinct listings verified",
    "DMs only on Facebook and Instagram with privacy disclaimer",
    "Staff posts reviewed by agent before publishing",
    "Building Our Brand guidelines followed",
    "No referral rewards advertised on social",
  ][i],
  severity: [0,1,2,3,4,5,6,7,8,11,12,13,14,16,17,18,23,25].includes(i) ? "critical" : "warning",
  source: "Social Chef Claude Compliance KB v2.1 — Section 18",
}));

const MOCK_CALENDAR = [
  { id:"c1", title:"Annual Social Media Compliance Audit",    due_date:"2026-11-30", status:"upcoming", days_remaining: 217, recurrence:"annual",  severity:"warning"  },
  { id:"c2", title:"Annual Customer Privacy Notice",          due_date:"2026-11-30", status:"upcoming", days_remaining: 217, recurrence:"annual",  severity:"warning"  },
  { id:"c3", title:"Annual Compliance Training",              due_date:"2026-12-31", status:"upcoming", days_remaining: 248, recurrence:"annual",  severity:"critical" },
  { id:"c4", title:"W-2 and 1099-NEC Filing Deadline",        due_date:"2027-01-31", status:"upcoming", days_remaining: 279, recurrence:"annual",  severity:"critical" },
  { id:"c5", title:"E&O Insurance Renewal — Begin Process",   due_date:"2026-08-01", status:"upcoming", days_remaining:  96, recurrence:"annual",  severity:"critical" },
  { id:"c6", title:"IL License Renewal",                      due_date:"2026-10-31", status:"upcoming", days_remaining: 187, recurrence:"annual",  severity:"critical" },
  { id:"c7", title:"CE Hours Completion — IL (10 hrs remain)","due_date":"2026-10-31", status:"upcoming", days_remaining: 187, recurrence:"annual", severity:"warning" },
  { id:"c8", title:"Monthly PFA Reconciliation",              due_date:"2026-05-14", status:"upcoming", days_remaining:  17, recurrence:"monthly", severity:"warning"  },
  { id:"c9", title:"Monthly Auto Application Compliance Review","due_date":"2026-04-30", status:"due",  days_remaining:   3, recurrence:"monthly", severity:"warning" },
  { id:"c10",title:"Monthly Altered Monies History Review",   due_date:"2026-04-30", status:"due",     days_remaining:   3, recurrence:"monthly", severity:"warning"  },
];

const MOCK_AUDIT_LOG = [
  { id:"a1", date:"Apr 26, 2026", event_type:"review",          description:"Reviewed social media compliance rules library — all 27 current rules acknowledged", created_by:"Jane Smith" },
  { id:"a2", date:"Apr 24, 2026", event_type:"claude_pushback", description:'Claude flagged content draft containing the word "specialist" — revised to "licensed agent"', created_by:"Claude" },
  { id:"a3", date:"Apr 20, 2026", event_type:"completed",       description:"Monthly auto application compliance review completed — no issues found", created_by:"Jane Smith" },
  { id:"a4", date:"Apr 15, 2026", event_type:"claude_pushback", description:'Claude flagged giveaway post draft containing "enter to win" language — corrected to action-based format', created_by:"Claude" },
  { id:"a5", date:"Apr 10, 2026", event_type:"review",          description:"Pre-post checklist completed for April social media batch — 26/26 items passed", created_by:"Jane Smith" },
  { id:"a6", date:"Mar 31, 2026", event_type:"completed",       description:"Monthly PFA reconciliation completed — sequential check order verified", created_by:"Jane Smith" },
];

// ─── Helpers ──────────────────────────────────────────────────
const severityConfig = (s) => ({
  critical: { color: T.red,    bg: T.redLt,    label: "Critical" },
  warning:  { color: T.amber,  bg: T.amberLt,  label: "Warning"  },
  info:     { color: T.blue,   bg: T.blueLt,   label: "Info"     },
}[s] || { color: T.slate500, bg: T.slate100, label: s });

const statusConfig = (s) => ({
  upcoming:  { color: T.blue,  bg: T.blueLt,  label: "Upcoming"  },
  due:       { color: T.amber, bg: T.amberLt, label: "Due Soon"  },
  overdue:   { color: T.red,   bg: T.redLt,   label: "Overdue"   },
  completed: { color: T.green, bg: T.greenLt, label: "Complete"  },
}[s] || { color: T.slate500, bg: T.slate100, label: s });

const eventConfig = (e) => ({
  review:          { color: T.blue,    icon: "👁" },
  completed:       { color: T.green,   icon: "✅" },
  claude_pushback: { color: T.amber,   icon: "⚡" },
  violation_flagged:{ color: T.red,   icon: "🚨" },
  acknowledged:    { color: T.slate500,icon: "📋" },
}[e] || { color: T.slate500, icon: "📋" });

// ─── Shared Components ────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: T.white, border: `1px solid ${T.slate200}`, borderRadius: 12, padding: "16px 18px", ...style }}>
    {children}
  </div>
);

const Pill = ({ type, children }) => {
  const s = severityConfig(type);
  return (
    <span style={{ display:"inline-flex", alignItems:"center", fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color, whiteSpace:"nowrap" }}>
      {children || s.label}
    </span>
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
  <div style={{ display:"flex", gap:2, background:T.slate100, borderRadius:8, padding:3, marginBottom:16, flexWrap:"wrap" }}>
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{ padding:"7px 14px", fontSize:12, fontWeight:active===t.id?600:400, color:active===t.id?T.slate900:T.slate500, background:active===t.id?T.white:"transparent", border:"none", borderRadius:6, cursor:"pointer", transition:"all 0.12s", boxShadow:active===t.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
        {t.label}
      </button>
    ))}
  </div>
);

// ─── Section: Compliance Dashboard ───────────────────────────
const ComplianceDashboard = () => {
  const critical = MOCK_RULES.filter(r => r.severity === "critical").length;
  const dueItems = MOCK_CALENDAR.filter(c => c.status === "due" || c.days_remaining <= 14).length;
  const overdueItems = MOCK_CALENDAR.filter(c => c.status === "overdue").length;

  return (
    <div>
      {/* Status KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Critical Rules",     value: critical,     color: T.red,   border: T.red   },
          { label:"Due Within 14 Days", value: dueItems,     color: T.amber, border: T.amber },
          { label:"Overdue Items",      value: overdueItems, color: overdueItems>0?T.red:T.green, border: overdueItems>0?T.red:T.green },
          { label:"Rules in Library",   value: 57,           color: T.blue,  border: T.blue  },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderTop:`3px solid ${k.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color, letterSpacing:"-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
        {/* Upcoming Deadlines */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Upcoming deadlines</span>
            <AskBtn size="small" context="Here are my upcoming compliance deadlines. Help me prioritize what needs my immediate attention and what I should plan for in the next 90 days." />
          </div>
          {MOCK_CALENDAR.slice(0,6).map((item,i) => {
            const sc = statusConfig(item.status);
            const urgent = item.days_remaining <= 14;
            return (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, padding:"8px 0", borderBottom:i<5?`1px solid ${T.slate100}`:"none" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:urgent?T.red:T.slate800 }}>{item.title}</div>
                  <div style={{ fontSize:10, color:T.slate400, marginTop:2 }}>
                    {item.days_remaining <= 0 ? "Overdue" : item.days_remaining <= 14 ? `⚠ ${item.days_remaining} days remaining` : `${item.days_remaining} days`} · {item.recurrence}
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:sc.bg, color:sc.color, whiteSpace:"nowrap" }}>{sc.label}</span>
              </div>
            );
          })}
        </Card>

        {/* Critical Rules Quick Reference */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Critical rules — quick reference</span>
          </div>
          {[
            { code:"AA05-002", rule:'Say "customer" — never "client" (AA05 I.B)' },
            { code:"AA05-003", rule:'Say "agent" — never "expert" or "specialist" (AA05 I.O)' },
            { code:"AD-001",   rule:"ALL SF-referencing ads require prior approval (AA05 I.H)" },
            { code:"SM-005",   rule:"All content in English — FINRA archiving required" },
            { code:"FIN-001",  rule:"PFA must stay separate — never commingled" },
            { code:"FIN-002",  rule:"PFA is NOT a business asset — never on balance sheet" },
            { code:"GIVE-001", rule:'No "enter to win" — every participant must receive item' },
            { code:"TM-004",   rule:"GBP: insurance products only — no financial services" },
          ].map((r,i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom:i<7?`1px solid ${T.slate100}`:"none" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:T.red, flexShrink:0, marginTop:5 }} />
              <div>
                <span style={{ fontSize:11, color:T.slate700, lineHeight:1.5 }}>{r.rule}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent Audit Log */}
      <Card style={{ marginTop:12 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:12 }}>Recent compliance activity</div>
        {MOCK_AUDIT_LOG.slice(0,4).map((log,i) => {
          const ec = eventConfig(log.event_type);
          return (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderBottom:i<3?`1px solid ${T.slate100}`:"none" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{ec.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:T.slate800 }}>{log.description}</div>
                <div style={{ fontSize:10, color:T.slate400, marginTop:2 }}>{log.date} · {log.created_by}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ─── Section: Rules Library ───────────────────────────────────
const RulesLibrary = () => {
  const [search,    setSearch]    = useState("");
  const [category,  setCategory]  = useState("all");
  const [severity,  setSeverity]  = useState("all");
  const [expanded,  setExpanded]  = useState(null);

  const categories = ["all", ...Object.keys(CATEGORY_CONFIG).filter(c => c !== "social_media_checklist")];

  const filtered = useMemo(() => MOCK_RULES.filter(r => {
    if (category !== "all" && r.category !== category) return false;
    if (severity !== "all" && r.severity !== severity) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.rule_code.toLowerCase().includes(q) || r.source.toLowerCase().includes(q);
    }
    return true;
  }), [search, category, severity]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search rules, codes, or sources..."
          style={{ flex:1, minWidth:200, padding:"8px 12px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", background:T.white }}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Categories</option>
          {categories.filter(c => c !== "all").map(c => (
            <option key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</option>
          ))}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div style={{ fontSize:11, color:T.slate400, marginBottom:12 }}>
        Showing {filtered.length} of {MOCK_RULES.length} rules
      </div>

      {/* Rules List */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {filtered.map(rule => {
          const cat = CATEGORY_CONFIG[rule.category] || {};
          const sev = severityConfig(rule.severity);
          const isExpanded = expanded === rule.id;

          return (
            <div
              key={rule.id}
              style={{ background:T.white, border:`1px solid ${isExpanded?cat.color||T.slate200:T.slate200}`, borderLeft:`4px solid ${cat.color||T.slate300}`, borderRadius:10, overflow:"hidden", transition:"border-color 0.15s" }}
            >
              <div
                style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, padding:"12px 14px", cursor:"pointer" }}
                onClick={() => setExpanded(isExpanded ? null : rule.id)}
              >
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, fontFamily:"monospace", color:T.slate400, background:T.slate100, padding:"2px 6px", borderRadius:4 }}>{rule.rule_code}</span>
                    <span style={{ fontSize:10, color:cat.color||T.slate500 }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:sev.bg, color:sev.color }}>{sev.label}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>{rule.title}</div>
                </div>
                <span style={{ color:T.slate400, fontSize:14, flexShrink:0, marginTop:2 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              {isExpanded && (
                <div style={{ padding:"0 14px 14px", borderTop:`1px solid ${T.slate100}` }}>
                  <div style={{ fontSize:12, color:T.slate700, lineHeight:1.7, marginTop:10, marginBottom:10 }}>
                    {rule.description}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                    <div style={{ fontSize:10, color:T.slate400 }}>
                      📜 <em>{rule.source}</em>
                    </div>
                    <AskBtn size="small" context={`Compliance rule: ${rule.title} (${rule.rule_code})\n\nRule description: ${rule.description}\n\nSource: ${rule.source}\n\nHelp me understand this rule and how it applies to my agency. What are the most common ways agents accidentally violate this?`} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Section: Pre-Post Checklist ──────────────────────────────
const PrePostChecklist = () => {
  const [checked, setChecked] = useState({});
  const [sessionDate] = useState(new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" }));

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allPassed = checkedCount === MOCK_CHECKLIST.length;
  const criticalItems = MOCK_CHECKLIST.filter(i => i.severity === "critical");
  const criticalPassed = criticalItems.every(i => checked[i.id]);

  const resetChecklist = () => setChecked({});

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Social Media Pre-Post Compliance Checklist</div>
          <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>Run every piece of content through all 26 items before publishing · {sessionDate}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <AskBtn context={`I just completed the social media pre-post compliance checklist. ${checkedCount} of 26 items passed. ${allPassed ? "All items cleared." : "Some items need attention."} Help me review any compliance concerns before I publish this content.`} />
          <button onClick={resetChecklist} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.slate600, background:T.slate100, border:"none", borderRadius:7, cursor:"pointer" }}>Reset</button>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background:T.white, border:`1px solid ${T.slate200}`, borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:T.slate700 }}>{checkedCount} of 26 items verified</span>
          {allPassed
            ? <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:T.greenLt, color:"#065F46" }}>✓ All Clear — Safe to Post</span>
            : criticalPassed
              ? <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:T.amberLt, color:"#92400E" }}>Critical Items Passed — Review Warnings</span>
              : <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:T.redLt, color:"#991B1B" }}>Do Not Post — Critical Items Pending</span>
          }
        </div>
        <div style={{ height:8, background:T.slate100, borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${(checkedCount/26)*100}%`, background:allPassed?T.green:criticalPassed?T.amber:T.blue, borderRadius:4, transition:"width 0.3s ease" }} />
        </div>
      </div>

      {/* Checklist Items */}
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {MOCK_CHECKLIST.map((item) => {
          const isChecked = !!checked[item.id];
          const isCritical = item.severity === "critical";
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"10px 14px",
                background: isChecked ? (isCritical ? "#F0FDF4" : T.slate50) : T.white,
                border:`1px solid ${isChecked ? (isCritical ? "#BBF7D0" : T.slate200) : T.slate200}`,
                borderLeft:`4px solid ${isCritical ? T.red : T.amber}`,
                borderRadius:8, cursor:"pointer",
                transition:"all 0.12s",
                opacity: isChecked ? 0.75 : 1,
              }}
            >
              {/* Checkbox */}
              <div style={{
                width:20, height:20, borderRadius:5, flexShrink:0,
                border: isChecked ? "none" : `2px solid ${T.slate300}`,
                background: isChecked ? T.green : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.15s",
              }}>
                {isChecked && <span style={{ color:T.white, fontSize:12, lineHeight:1 }}>✓</span>}
              </div>

              {/* Item */}
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:10, color:T.slate400, fontWeight:500 }}>{String(item.number).padStart(2,"0")}</span>
                  <span style={{ fontSize:12, fontWeight:isChecked?400:500, color:isChecked?T.slate400:T.slate800, textDecoration:isChecked?"line-through":"none" }}>
                    {item.title}
                  </span>
                </div>
              </div>

              {/* Severity badge */}
              <Pill type={item.severity}>{isCritical ? "Critical" : "Warning"}</Pill>
            </div>
          );
        })}
      </div>

      {/* Post-checklist note */}
      {allPassed && (
        <div style={{ marginTop:14, padding:"12px 16px", background:T.greenLt, border:`1px solid #BBF7D0`, borderRadius:10, fontSize:12, color:"#065F46" }}>
          ✓ All 26 compliance items verified. This content is cleared for publishing. Log this review in the audit log before posting.
        </div>
      )}
    </div>
  );
};

// ─── Section: Compliance Calendar ─────────────────────────────
const ComplianceCalendar = () => {
  const [filter, setFilter] = useState("all");

  const filtered = MOCK_CALENDAR.filter(item => {
    if (filter === "all") return true;
    if (filter === "due") return item.days_remaining <= 30;
    if (filter === "annual") return item.recurrence === "annual";
    if (filter === "monthly") return item.recurrence === "monthly";
    return true;
  });

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Compliance Calendar</div>
          <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>Annual and recurring compliance deadlines</div>
        </div>
        <AskBtn context="I am reviewing my compliance calendar. Help me prioritize the most urgent items and create an action plan for the next 90 days." />
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {[{id:"all",label:"All"},{id:"due",label:"Due Within 30 Days"},{id:"annual",label:"Annual"},{id:"monthly",label:"Monthly"}].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding:"5px 12px", fontSize:11, fontWeight:filter===f.id?600:400,
            color:filter===f.id?T.white:T.slate600,
            background:filter===f.id?T.navy:T.white,
            border:`1px solid ${filter===f.id?T.navy:T.slate200}`,
            borderRadius:6, cursor:"pointer",
          }}>{f.label}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {filtered.map((item,i) => {
          const sc = statusConfig(item.status);
          const sev = severityConfig(item.severity);
          const urgent = item.days_remaining <= 14;
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:urgent?T.redLt:T.white, border:`1px solid ${urgent?"#FECACA":T.slate200}`, borderRadius:10 }}>
              <div style={{ width:48, height:48, borderRadius:10, background:urgent?T.red:sev.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:14, fontWeight:700, color:urgent?T.white:sev.color, lineHeight:1 }}>{Math.max(0,item.days_remaining)}</span>
                <span style={{ fontSize:8, color:urgent?T.white:sev.color, marginTop:1 }}>days</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:urgent?T.red:T.slate800 }}>{item.title}</div>
                <div style={{ fontSize:10, color:T.slate400, marginTop:2 }}>
                  Due: {item.due_date} · {item.recurrence.charAt(0).toUpperCase()+item.recurrence.slice(1)}
                </div>
              </div>
              <span style={{ fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sc.bg, color:sc.color }}>{sc.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ─── Section: Audit Log ───────────────────────────────────────
const AuditLog = () => {
  const [newNote, setNewNote] = useState("");
  const [logs, setLogs] = useState(MOCK_AUDIT_LOG);

  const addLog = () => {
    if (!newNote.trim()) return;
    setLogs(prev => [{
      id: `a${Date.now()}`,
      date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
      event_type: "review",
      description: newNote.trim(),
      created_by: "Jane Smith",
    }, ...prev]);
    setNewNote("");
  };

  return (
    <Card>
      <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:14 }}>Compliance Audit Log</div>

      {/* Add Entry */}
      <div style={{ marginBottom:16, padding:"12px 14px", background:T.slate50, borderRadius:10, border:`1px solid ${T.slate200}` }}>
        <div style={{ fontSize:11, fontWeight:600, color:T.slate600, marginBottom:8 }}>LOG A COMPLIANCE ACTIVITY</div>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Describe the compliance activity, review, or action taken..."
          rows={2}
          style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", resize:"none", fontFamily:"inherit", lineHeight:1.6, boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
          <button
            onClick={addLog}
            disabled={!newNote.trim()}
            style={{ padding:"6px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.navy, border:"none", borderRadius:7, cursor:newNote.trim()?"pointer":"not-allowed", opacity:newNote.trim()?1:0.5 }}
          >Log Activity</button>
        </div>
      </div>

      {/* Log Entries */}
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {logs.map((log,i) => {
          const ec = eventConfig(log.event_type);
          return (
            <div key={log.id} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:i<logs.length-1?`1px solid ${T.slate100}`:"none" }}>
              <div style={{ width:32, height:32, borderRadius:8, background:T.slate50, border:`1px solid ${T.slate200}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>
                {ec.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:T.slate800, lineHeight:1.5 }}>{log.description}</div>
                <div style={{ fontSize:10, color:T.slate400, marginTop:3 }}>
                  {log.date} · {log.created_by} · {log.event_type.replace(/_/g," ")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ─── Main Compliance Center Module ───────────────────────────
export default function ComplianceCenter() {
  const [section, setSection] = useState("dashboard");

  // ── Add/Edit Modal State ────────────────────────────────────
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({title:"", category:"", description:"", severity:"info"});

  const saveRule = async () => {
    if (!newRule.title) return;
    const { error } = await supabase.from("compliance_rules").insert([{
      ...newRule,
      agency_id: AGENCY_ID,
      status: "active",
      created_at: new Date().toISOString()
    }]);
    if (!error) {
      setShowAddRule(false);
      setNewRule({title:"", category:"", description:"", severity:"info"});
      // Trigger refetch
      window.location.reload();
    }
  };


  const sections = [
    { id:"dashboard", label:"Dashboard"         },
    { id:"rules",     label:"Rules Library (57)"},
    { id:"checklist", label:"Pre-Post Checklist"},
    { id:"calendar",  label:"Calendar"          },
    { id:"log",       label:"Audit Log"         },
  ];

  return (
    <div>
      {/* Module Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>Compliance Center</div>
          <div style={{ fontSize:12, color:T.slate500, marginTop:3 }}>
            57 rules · AA05 contract-based · Claude enforces these in every conversation
          </div>
        </div>
        <AskBtn context="I am reviewing my compliance center. I need you to act as my compliance advisor. What are the most critical compliance items I should be focused on right now as a State Farm agent? What are the most common compliance mistakes agents make?" />
      </div>

      {/* AA05 Notice Banner */}
      <div style={{ background:T.blueLt, border:`1px solid ${T.blue}20`, borderLeft:`4px solid ${T.blue}`, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"flex-start", gap:12 }}>
        <span style={{ fontSize:18, flexShrink:0 }}>📜</span>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:T.navy, marginBottom:2 }}>
            These rules are grounded in your AA05 Agent Agreement
          </div>
          <div style={{ fontSize:11, color:T.slate600, lineHeight:1.6 }}>
            Every compliance rule in this library cites the AA05 clause or regulatory requirement that makes it binding. Your Claude uses this library as guardrails in every conversation — it will push back when you ask it to generate non-compliant content, and it will explain exactly which contract clause applies.
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div style={{ display:"flex", gap:2, flexWrap:"wrap", background:T.slate100, borderRadius:10, padding:4, marginBottom:18 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ padding:"7px 14px", fontSize:12, fontWeight:section===s.id?600:400, color:section===s.id?T.slate900:T.slate500, background:section===s.id?T.white:"transparent", border:"none", borderRadius:7, cursor:"pointer", transition:"all 0.12s", boxShadow:section===s.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{display:"flex", justifyContent:"flex-end", marginBottom:12}}>
        {section === "rules" && (
          <button
            onClick={() => setShowAddRule(!showAddRule)}
            style={{padding:"7px 16px", fontSize:12, fontWeight:600, background:T.navy, color:T.white, border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", gap:6}}
          >
            ➕ Add Custom Rule
          </button>
        )}
      </div>

      {/* Add Rule Form */}
      {showAddRule && (
        <div style={{background:T.navyLt, border:`1px solid ${T.blue}30`, borderRadius:10, padding:16, marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:700, color:T.navy, marginBottom:12}}>Add Custom Compliance Rule</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
            <input placeholder="Rule title *" value={newRule.title} onChange={e=>setNewRule({...newRule,title:e.target.value})}
              style={{padding:"8px 10px", borderRadius:6, border:`1px solid ${T.slate300}`, fontSize:12, gridColumn:"1/-1"}} />
            <input placeholder="Category (e.g. Social Media)" value={newRule.category} onChange={e=>setNewRule({...newRule,category:e.target.value})}
              style={{padding:"8px 10px", borderRadius:6, border:`1px solid ${T.slate300}`, fontSize:12}} />
            <select value={newRule.severity} onChange={e=>setNewRule({...newRule,severity:e.target.value})}
              style={{padding:"8px 10px", borderRadius:6, border:`1px solid ${T.slate300}`, fontSize:12}}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <textarea placeholder="Description / requirement" value={newRule.description} onChange={e=>setNewRule({...newRule,description:e.target.value})}
              rows={2} style={{padding:"8px 10px", borderRadius:6, border:`1px solid ${T.slate300}`, fontSize:12, gridColumn:"1/-1", resize:"vertical"}} />
          </div>
          <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
            <button onClick={()=>setShowAddRule(false)} style={{padding:"6px 14px", fontSize:12, background:T.slate100, color:T.slate700, border:"none", borderRadius:6, cursor:"pointer"}}>Cancel</button>
            <button onClick={saveRule} style={{padding:"6px 14px", fontSize:12, background:T.navy, color:T.white, border:"none", borderRadius:6, cursor:"pointer", fontWeight:600}}>Save Rule</button>
          </div>
        </div>
      )}

      {/* Section Content */}
      {section === "dashboard" && <ComplianceDashboard />}
      {section === "rules"     && <RulesLibrary />}
      {section === "checklist" && <PrePostChecklist />}
      {section === "calendar"  && <ComplianceCalendar />}
      {section === "log"       && <AuditLog />}
    </div>
  );
}
