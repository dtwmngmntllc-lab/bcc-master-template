import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";
import { useSupabaseTable } from "../lib/hooks.js";
import EmptyState from "../components/EmptyState.jsx";

// ============================================================
// BCC TASKS & GOALS MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Overview    — Quick wins, due today, goal progress summary
//   2. Tasks       — Full task list, create, filter, complete
//   3. Goals       — Annual goals with progress tracking
//   4. Completed   — History of completed tasks
//
// KEY FEATURES:
//   • Tasks link to BCC modules (click → opens in context)
//   • Priority system: critical / high / medium / low
//   • Tasks created by agent, Claude, or automations
//   • Goals track revenue, AIPP, team, compliance, personal
//   • Everything tied to agency_id in Supabase
//
// DATA: Reads tasks, goals tables in Supabase
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

// ─── Priority Config ──────────────────────────────────────────
const PRIORITY = {
  critical: { color:T.red,    bg:T.redLt,    label:"Critical", dot:"🔴" },
  high:     { color:"#EA580C", bg:"#FFF7ED",  label:"High",     dot:"🟠" },
  medium:   { color:T.amber,  bg:T.amberLt,  label:"Medium",   dot:"🟡" },
  low:      { color:T.slate500,bg:T.slate100, label:"Low",      dot:"⚪" },
};

// ─── Module Reference Config ──────────────────────────────────
const MODULES = {
  financials:   { label:"Financials",   color:T.blue,    icon:"💰" },
  compliance:   { label:"Compliance",   color:T.red,     icon:"🛡️" },
  social:       { label:"Social Media", color:T.purple,  icon:"📱" },
  automations:  { label:"Automations",  color:T.teal,    icon:"⚡" },
  hr:           { label:"HR & People",  color:T.green,   icon:"👥" },
  documents:    { label:"Documents",    color:T.amber,   icon:"📁" },
  memory:       { label:"Memory",       color:T.navy,    icon:"🧠" },
  marketing:    { label:"Marketing",    color:T.purple,  icon:"📣" },
  team:         { label:"Team",         color:T.green,   icon:"👥" },
  business_dev: { label:"Business Dev", color:T.blue,    icon:"📈" },
  operations:   { label:"Operations",   color:T.slate500,icon:"⚙️" },
  general:      { label:"General",      color:T.slate500,icon:"📋" },
};

// Defensive lookup so unknown module_reference values render gracefully
const moduleConfig = (key) => MODULES[key] || MODULES.general;

// ─── Goal Category Config ─────────────────────────────────────
const GOAL_CATS = {
  aipp:       { label:"AIPP",       color:T.green,  icon:"🎯" },
  revenue:    { label:"Revenue",    color:T.blue,   icon:"💰" },
  team:       { label:"Team",       color:T.purple, icon:"👥" },
  compliance: { label:"Compliance", color:T.red,    icon:"🛡️" },
  personal:   { label:"Personal",   color:T.amber,  icon:"⭐" },
  growth:     { label:"Growth",     color:T.teal,   icon:"📈" },
};

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_TASKS = [
  // Open tasks
  { id:"t1",  title:"Fix Daily Briefing automation — Gmail OAuth expired",       priority:"critical", status:"open",        module:"automations", due_date:"Apr 27, 2026", assigned_to:"Jane Smith",  created_by:"system",      description:"Gmail OAuth token expired causing Daily Briefing to fail. Reconnect Gmail in Composio dashboard.", created_at:"Today" },
  { id:"t2",  title:"Complete monthly auto application compliance review",        priority:"high",     status:"open",        module:"compliance",  due_date:"Apr 30, 2026", assigned_to:"Jane Smith",  created_by:"system",      description:"Pull RAZ000BT report. Review all required auto app metrics. Review SAM report (RAZ000BV). Document findings.", created_at:"Apr 25" },
  { id:"t3",  title:"Complete monthly Altered Monies history review",             priority:"high",     status:"open",        module:"financials",  due_date:"Apr 30, 2026", assigned_to:"Jane Smith",  created_by:"system",      description:"Review and document Altered Monies history for April. Required standing compliance item.", created_at:"Apr 25" },
  { id:"t4",  title:"Manually post Instagram content — Monday April 27",          priority:"high",     status:"open",        module:"social",      due_date:"Apr 27, 2026", assigned_to:"Jane Smith",  created_by:"automations", description:"Behind the scenes at the agency this Monday morning. Coffee, team huddle, and a full week ahead. ☕ — scheduled for 11AM", created_at:"Today" },
  { id:"t5",  title:"Review Q1 bank reconciliation",                               priority:"medium",   status:"open",        module:"financials",  due_date:"May 3, 2026",  assigned_to:"Jane Smith",  created_by:"claude",      description:"Q1 bank reconciliation is ready to review. Verify all GL entries match bank statements for January, February, and March.", created_at:"Apr 26" },
  { id:"t6",  title:"Send Kimberly Yow reseller agreement for signature",          priority:"medium",   status:"in_progress", module:"general",     due_date:"May 5, 2026",  assigned_to:"Jane Smith",  created_by:"Jane Smith",  description:"Channel partner reseller agreement ready. Send via DocuSign and follow up within 3 business days.", created_at:"Apr 24" },
  { id:"t7",  title:"Schedule discovery call with new prospect — Mike Anderson",   priority:"medium",   status:"open",        module:"general",     due_date:"May 1, 2026",  assigned_to:"Jane Smith",  created_by:"Jane Smith",  description:"Referred by Alyssa. Auto agency owner. Interested in BCC setup.", created_at:"Apr 23" },
  { id:"t8",  title:"Post resume — April interview focus review with Marcus",      priority:"medium",   status:"open",        module:"hr",          due_date:"Apr 29, 2026", assigned_to:"Marcus T.",   created_by:"automations", description:"New applicant received — Jamie Chen. Claude score: 8/10. Review One Page Interview Focus together before scheduling interview.", created_at:"Apr 26" },
  { id:"t9",  title:"Begin E&O insurance renewal process",                         priority:"low",      status:"open",        module:"compliance",  due_date:"May 1, 2026",  assigned_to:"Jane Smith",  created_by:"system",      description:"E&O insurance renews August 2026. Begin renewal process 90 days in advance. Contact Hartford for renewal quote.", created_at:"Apr 27" },
  { id:"t10", title:"Update staff performance metrics for March",                  priority:"low",      status:"open",        module:"hr",          due_date:"May 3, 2026",  assigned_to:"Jane Smith",  created_by:"system",      description:"Log March KPIs for Marcus Thompson and Priya Patel in the staff performance table.", created_at:"Apr 1" },
  { id:"t11", title:"Draft April social media batch for next week",                priority:"low",      status:"open",        module:"social",      due_date:"Apr 30, 2026", assigned_to:"Jane Smith",  created_by:"Jane Smith",  description:"Batch create May 4-8 social posts. Use content calendar framework: Mon Educate, Tue Community, Wed Connect, Thu Educate/Celebrate, Fri Invite.", created_at:"Apr 26" },

  // Completed
  { id:"t12", title:"Process April COMP_RECAP from State Farm",                   priority:"high",     status:"completed",   module:"financials",  due_date:"Apr 26, 2026", assigned_to:"Jane Smith",  created_by:"automations", description:"", created_at:"Apr 20", completed_at:"Apr 26" },
  { id:"t13", title:"Run April payroll",                                           priority:"high",     status:"completed",   module:"financials",  due_date:"Apr 19, 2026", assigned_to:"Jane Smith",  created_by:"Jane Smith",  description:"", created_at:"Apr 15", completed_at:"Apr 19" },
  { id:"t14", title:"Post Marcus work anniversary social content",                 priority:"medium",   status:"completed",   module:"social",      due_date:"Apr 25, 2026", assigned_to:"Jane Smith",  created_by:"Jane Smith",  description:"", created_at:"Apr 23", completed_at:"Apr 25" },
  { id:"t15", title:"Complete Q1 staff performance review",                        priority:"medium",   status:"completed",   module:"hr",          due_date:"Apr 15, 2026", assigned_to:"Jane Smith",  created_by:"system",      description:"", created_at:"Apr 1",  completed_at:"Apr 14" },
  { id:"t16", title:"March PFA bank statement reconciliation",                     priority:"high",     status:"completed",   module:"financials",  due_date:"Apr 14, 2026", assigned_to:"Jane Smith",  created_by:"system",      description:"", created_at:"Apr 1",  completed_at:"Apr 12" },
];

const MOCK_GOALS = [
  {
    id:"g1", title:"Hit AIPP Target — 2026",
    description:"Achieve full AIPP payout for 2026 program year",
    category:"aipp", unit:"dollars",
    target_value:142000, current_value:67450,
    target_date:"Dec 31, 2026",
    status:"active",
    notes:"On track — 47.5% achieved with 8 months remaining. Prior year final was $138,200.",
    monthly_data:[15200,14800,18650,18800,0,0,0,0,0,0,0,0],
  },
  {
    id:"g2", title:"Annual Revenue Target — 2026",
    description:"Total agency gross revenue for the year",
    category:"revenue", unit:"dollars",
    target_value:580000, current_value:187420,
    target_date:"Dec 31, 2026",
    status:"active",
    notes:"YTD $187,420 through April. On pace for $562K at current run rate — slightly below target. May need to push new business in Q2.",
    monthly_data:[41200,38900,44600,48240,0,0,0,0,0,0,0,0],
  },
  {
    id:"g3", title:"New Business Premium Growth — 15%",
    description:"Grow new business premium by 15% vs 2025",
    category:"growth", unit:"percentage",
    target_value:15, current_value:9,
    target_date:"Dec 31, 2026",
    status:"active",
    notes:"Currently at 9% growth YTD. Need to accelerate new business production in Q2-Q3.",
    monthly_data:null,
  },
  {
    id:"g4", title:"Add One Licensed Team Member — Q3",
    description:"Hire and license one additional team member by September 2026",
    category:"team", unit:"count",
    target_value:1, current_value:0,
    target_date:"Sep 30, 2026",
    status:"active",
    notes:"Resume Scanner is active. Jamie Chen interview in progress (score 8/10). Marcus can help onboard.",
    monthly_data:null,
  },
  {
    id:"g5", title:"Reduce Operating Expense Ratio Below 45%",
    description:"Keep total operating expenses below 45% of gross income",
    category:"revenue", unit:"percentage",
    target_value:45, current_value:43.2,
    target_date:"Dec 31, 2026",
    status:"active",
    notes:"Currently at 43.2% — ahead of target. Monitor payroll ratio as team grows.",
    monthly_data:null,
  },
  {
    id:"g6", title:"Complete Annual Compliance Training",
    description:"Complete all required State Farm annual compliance and ethics training",
    category:"compliance", unit:"count",
    target_value:1, current_value:0,
    target_date:"Dec 31, 2026",
    status:"active",
    notes:"Due by December 31. Schedule Q3 to allow time for completion.",
    monthly_data:null,
  },
];

// ─── Helpers ──────────────────────────────────────────────────
const pct = (curr, target) => Math.min(100, Math.round((curr / target) * 100));
const fmt = (n, unit) => {
  if (unit === "dollars") return "$" + n.toLocaleString();
  if (unit === "percentage") return n + "%";
  return n.toString();
};
const isOverdue = (due) => {
  const dueDate = new Date(due + ", 2026");
  return dueDate < new Date();
};
const daysUntil = (due) => {
  const dueDate = new Date(due + ", 2026");
  const today = new Date();
  return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
};

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

const ProgressBar = ({ value, max, color=T.blue, height=8 }) => {
  const p = pct(value, max);
  return (
    <div style={{ height, background:T.slate100, borderRadius:height/2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${p}%`, background:color, borderRadius:height/2, transition:"width 0.7s ease" }} />
    </div>
  );
};

// ─── Task Card Component ──────────────────────────────────────
const TaskCard = ({ task, onComplete, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const pr = PRIORITY[task.priority] || PRIORITY.medium;
  const mod = moduleConfig(task.module) || MODULES.general;
  const overdue = task.status === "open" && isOverdue(task.due_date);
  const days = daysUntil(task.due_date);
  const isCompleted = task.status === "completed";

  return (
    <div style={{
      background:T.white,
      border:`1px solid ${expanded?T.blue:overdue?T.red:T.slate200}`,
      borderLeft:`4px solid ${overdue?T.red:pr.color}`,
      borderRadius:10, overflow:"hidden",
      opacity:isCompleted?0.7:1,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 12px" }}>
        {/* Checkbox */}
        {!isCompleted ? (
          <div
            onClick={() => onComplete(task.id)}
            style={{ width:20, height:20, borderRadius:5, border:`2px solid ${T.slate300}`, background:"transparent", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
            title="Mark complete"
          />
        ) : (
          <div style={{ width:20, height:20, borderRadius:5, background:T.green, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:T.white, fontSize:11, lineHeight:1 }}>✓</span>
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setExpanded(e => !e)}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, fontWeight:isCompleted?400:600, color:isCompleted?T.slate400:T.slate800, textDecoration:isCompleted?"line-through":"none" }}>
              {task.title}
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20, background:pr.bg, color:pr.color }}>{pr.label}</span>
            <span style={{ fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20, background:mod.color+"20", color:mod.color }}>{mod.icon} {mod.label}</span>
            <span style={{ fontSize:10, color:overdue?T.red:days<=3?T.amber:T.slate400, fontWeight:overdue||days<=3?600:400 }}>
              {isCompleted ? `Completed ${task.completed_at}` : overdue ? `Overdue — ${task.due_date}` : days===0 ? "Due today" : days===1 ? "Due tomorrow" : `Due ${task.due_date}`}
            </span>
            {task.assigned_to && <span style={{ fontSize:10, color:T.slate400 }}>→ {task.assigned_to}</span>}
            <span style={{ fontSize:9, color:T.slate400, fontStyle:"italic" }}>by {task.created_by}</span>
          </div>
        </div>

        {/* Module link */}
        {!isCompleted && task.module !== "general" && (
          <button
            onClick={() => onNavigate(task.module)}
            style={{ fontSize:10, color:mod.color, background:mod.color+"15", border:"none", borderRadius:6, padding:"4px 8px", cursor:"pointer", flexShrink:0 }}
            title={`Go to ${mod.label}`}
          >
            Open →
          </button>
        )}

        <span style={{ color:T.slate400, fontSize:11, flexShrink:0, cursor:"pointer" }} onClick={() => setExpanded(e => !e)}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && task.description && (
        <div style={{ padding:"0 12px 12px 46px", borderTop:`1px solid ${T.slate100}` }}>
          <div style={{ fontSize:12, color:T.slate600, lineHeight:1.6, marginTop:8, marginBottom:8 }}>
            {task.description}
          </div>
          <AskBtn size="small" context={`Task context:\nTitle: ${task.title}\nPriority: ${task.priority}\nDue: ${task.due_date}\nModule: ${task.module}\nAssigned to: ${task.assigned_to}\nDescription: ${task.description}\n\nHelp me think through how to complete this task efficiently.`} />
        </div>
      )}
    </div>
  );
};

// ─── New Task Modal ───────────────────────────────────────────
const NewTaskModal = ({ onSave, onCancel }) => {
  const [form, setForm] = useState({ title:"", description:"", priority:"medium", module:"general", due_date:"", assigned_to:"Jane Smith" });
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ background:T.white, borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.slate200}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>New Task</span>
          <button onClick={onCancel} style={{ background:"none", border:"none", fontSize:18, color:T.slate400, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ padding:20 }}>
          {[
            { label:"TITLE", key:"title", type:"text", placeholder:"What needs to be done?" },
            { label:"DESCRIPTION", key:"description", type:"textarea", placeholder:"Additional details..." },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:5 }}>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3}
                  style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", resize:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              ) : (
                <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                  style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", boxSizing:"border-box" }} />
              )}
            </div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:5 }}>PRIORITY</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)}
                style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
                {Object.keys(PRIORITY).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:5 }}>MODULE</label>
              <select value={form.module} onChange={e => set("module", e.target.value)}
                style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
                {Object.keys(MODULES).map(m => <option key={m} value={m}>{moduleConfig(m).icon} {moduleConfig(m).label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:5 }}>DUE DATE</label>
              <input type="text" value={form.due_date} onChange={e => set("due_date", e.target.value)} placeholder="May 1, 2026"
                style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:5 }}>ASSIGNED TO</label>
              <input type="text" value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} placeholder="Jane Smith"
                style={{ width:"100%", padding:"8px 10px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
        </div>
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.slate200}`, display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={onCancel} style={{ padding:"7px 14px", fontSize:11, fontWeight:600, color:T.slate600, background:T.slate100, border:"none", borderRadius:7, cursor:"pointer" }}>Cancel</button>
          <button onClick={() => form.title.trim() && onSave({ ...form, id:`t${Date.now()}`, status:"open", created_by:"Jane Smith", created_at:"Today" })}
            disabled={!form.title.trim()}
            style={{ padding:"7px 16px", fontSize:11, fontWeight:600, color:T.white, background:form.title.trim()?T.navy:"#94A3B8", border:"none", borderRadius:7, cursor:form.title.trim()?"pointer":"not-allowed" }}>
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Section: Overview ────────────────────────────────────────
const TasksOverview = ({ tasks, goals, onComplete, onNavigate }) => {
  const open       = tasks.filter(t => t.status !== "completed");
  const critical   = open.filter(t => t.priority === "critical");
  const dueThisWeek= open.filter(t => daysUntil(t.due_date) <= 7);
  const overdue    = open.filter(t => isOverdue(t.due_date));
  const completedThisMonth = tasks.filter(t => t.status === "completed").length;

  const topGoals = goals.slice(0, 3);

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Open Tasks",         value:open.length,             color:T.blue,  border:T.blue  },
          { label:"Critical",           value:critical.length,         color:critical.length>0?T.red:T.green,   border:critical.length>0?T.red:T.green   },
          { label:"Due This Week",      value:dueThisWeek.length,      color:dueThisWeek.length>2?T.amber:T.green, border:dueThisWeek.length>2?T.amber:T.green },
          { label:"Completed This Month",value:completedThisMonth,     color:T.green, border:T.green },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderTop:`3px solid ${k.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color, letterSpacing:"-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
        {/* Due This Week */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Due this week</span>
            <AskBtn size="small" context={`My tasks due this week:\n${dueThisWeek.map(t=>`• ${t.title} (${t.priority}, due ${t.due_date}, module: ${t.module})`).join("\n")}\n\nHelp me prioritize these tasks and create an action plan for the week.`} />
          </div>
          {dueThisWeek.length === 0 ? (
            <div style={{ fontSize:12, color:T.slate400, textAlign:"center", padding:"16px 0" }}>Nothing due this week 🎉</div>
          ) : dueThisWeek.map((task,i) => {
            const pr = PRIORITY[task.priority] || PRIORITY.medium;
            const mod = moduleConfig(task.module);
            const days = daysUntil(task.due_date);
            return (
              <div key={task.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 0", borderBottom:i<dueThisWeek.length-1?`1px solid ${T.slate100}`:"none" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:pr.color, flexShrink:0, marginTop:4 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:T.slate800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
                  <div style={{ fontSize:10, color:T.slate400, marginTop:1 }}>
                    {mod.icon} {mod.label} · {days===0?"Due today":days===1?"Due tomorrow":`${days} days`}
                  </div>
                </div>
                <button onClick={() => onComplete(task.id)} style={{ fontSize:9, color:T.green, background:T.greenLt, border:"none", borderRadius:5, padding:"3px 7px", cursor:"pointer", flexShrink:0, fontWeight:600 }}>Done</button>
              </div>
            );
          })}
        </Card>

        {/* Goal Highlights */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Goal progress</span>
            <AskBtn size="small" context={`My top agency goals and progress:\n${topGoals.map(g=>`• ${g.title}: ${fmt(g.current_value,g.unit)} of ${fmt(g.target_value,g.unit)} (${pct(g.current_value,g.target_value)}%)\n  ${g.notes}`).join("\n\n")}\n\nAnalyze my goal progress. Which goals need the most attention? What actions should I take this week to stay on track?`} />
          </div>
          {topGoals.map((goal,i) => {
            const cat = GOAL_CATS[goal.category] || GOAL_CATS.personal;
            const p = pct(goal.current_value, goal.target_value);
            const onTrack = p >= 40;
            return (
              <div key={goal.id} style={{ marginBottom:i<topGoals.length-1?14:0, paddingBottom:i<topGoals.length-1?14:0, borderBottom:i<topGoals.length-1?`1px solid ${T.slate100}`:"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13 }}>{cat.icon}</span>
                    <span style={{ fontSize:12, fontWeight:500, color:T.slate800 }}>{goal.title}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:onTrack?T.green:T.amber }}>{p}%</span>
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:20, background:onTrack?T.greenLt:T.amberLt, color:onTrack?"#065F46":"#92400E", fontWeight:600 }}>
                      {onTrack?"On track":"Needs focus"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:T.slate500, marginBottom:4 }}>
                  {fmt(goal.current_value, goal.unit)} of {fmt(goal.target_value, goal.unit)}
                </div>
                <ProgressBar value={goal.current_value} max={goal.target_value} color={onTrack?T.green:T.amber} height={6} />
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Tasks List ──────────────────────────────────────
const TasksList = ({ tasks, onComplete, onNavigate, onAdd }) => {
  const [filter,     setFilter]     = useState("open");
  const [priority,   setPriority]   = useState("all");
  const [module,     setModule]     = useState("all");
  const [showModal,  setShowModal]  = useState(false);

  const filtered = useMemo(() => tasks.filter(t => {
    if (filter === "open"        && t.status === "completed")  return false;
    if (filter === "completed"   && t.status !== "completed")  return false;
    if (filter === "in_progress" && t.status !== "in_progress")return false;
    if (priority !== "all" && t.priority !== priority) return false;
    if (module   !== "all" && t.module   !== module)   return false;
    return true;
  }), [tasks, filter, priority, module]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:2, background:T.slate100, borderRadius:8, padding:3 }}>
          {[{id:"open",label:"Open"},{id:"in_progress",label:"In Progress"},{id:"completed",label:"Completed"}].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding:"6px 12px", fontSize:11, fontWeight:filter===f.id?600:400, color:filter===f.id?T.slate900:T.slate500, background:filter===f.id?T.white:"transparent", border:"none", borderRadius:6, cursor:"pointer", boxShadow:filter===f.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
              {f.label} ({tasks.filter(t => f.id==="open"?t.status==="open":f.id==="in_progress"?t.status==="in_progress":t.status==="completed").length})
            </button>
          ))}
        </div>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ padding:"7px 10px", fontSize:11, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:7, background:T.white, outline:"none" }}>
          <option value="all">All Priority</option>
          {Object.keys(PRIORITY).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </select>
        <select value={module} onChange={e => setModule(e.target.value)} style={{ padding:"7px 10px", fontSize:11, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:7, background:T.white, outline:"none" }}>
          <option value="all">All Modules</option>
          {Object.keys(MODULES).map(m => <option key={m} value={m}>{moduleConfig(m).icon} {moduleConfig(m).label}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <button onClick={() => setShowModal(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", fontSize:11, fontWeight:600, color:T.white, background:T.navy, border:"none", borderRadius:8, cursor:"pointer" }}>
          + New Task
        </button>
        <AskBtn context="Review my open task list and help me prioritize. What should I focus on first today? Are there any tasks I should delegate, defer, or eliminate?" />
      </div>

      {/* Task List */}
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px", color:T.slate400, fontSize:13 }}>
            No tasks match your current filters.
          </div>
        ) : filtered.map(task => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} onNavigate={onNavigate} />
        ))}
      </div>

      {showModal && (
        <NewTaskModal
          onSave={(task) => { onAdd(task); setShowModal(false); }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// ─── Section: Goals ───────────────────────────────────────────
const GoalsSection = ({ goals }) => {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:13, color:T.slate500 }}>
          Track your agency goals and progress toward each target for {new Date().getFullYear()}.
        </div>
        <AskBtn context={`My full goal progress for 2026:\n${goals.map(g=>`• ${g.title} (${g.category}): ${fmt(g.current_value,g.unit)} of ${fmt(g.target_value,g.unit)} = ${pct(g.current_value,g.target_value)}% — ${g.notes}`).join("\n")}\n\nGive me a comprehensive goal review. Which goals are at risk? What specific actions would move the needle most this month?`} />
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {goals.map(goal => {
          const cat = GOAL_CATS[goal.category] || GOAL_CATS.personal;
          const p = pct(goal.current_value, goal.target_value);
          const onTrack = p >= 40;
          const isExpanded = expanded === goal.id;

          return (
            <div key={goal.id} style={{ background:T.white, border:`1px solid ${isExpanded?T.blue:T.slate200}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"16px 18px", cursor:"pointer" }} onClick={() => setExpanded(isExpanded?null:goal.id)}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:cat.color+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {cat.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:T.slate900, letterSpacing:"-0.01em" }}>{goal.title}</div>
                      <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>{goal.description} · Due {goal.target_date}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:22, fontWeight:700, color:onTrack?T.green:T.amber, letterSpacing:"-0.02em" }}>{p}%</div>
                      <div style={{ fontSize:10, color:T.slate400 }}>{fmt(goal.current_value,goal.unit)} / {fmt(goal.target_value,goal.unit)}</div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:600, padding:"3px 8px", borderRadius:20, background:onTrack?T.greenLt:T.amberLt, color:onTrack?"#065F46":"#92400E" }}>
                      {onTrack?"On track":"Needs focus"}
                    </span>
                    <span style={{ color:T.slate400, fontSize:12 }}>{isExpanded?"▲":"▼"}</span>
                  </div>
                </div>

                <ProgressBar value={goal.current_value} max={goal.target_value} color={onTrack?T.green:T.amber} height={10} />

                {/* Monthly bars for dollar goals */}
                {goal.monthly_data && (
                  <div style={{ display:"flex", gap:3, height:32, alignItems:"flex-end", marginTop:10 }}>
                    {(Array.isArray(goal.monthly_data) ? goal.monthly_data : []).map((v, i) => {
                      const maxM = (Array.isArray(goal.monthly_data) && goal.monthly_data.length > 0 ? Math.max(...goal.monthly_data.filter(x=>x>0), 0) : 0);
                      return (
                        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                          <div style={{ width:"100%", background:v>0?T.blue:T.slate100, borderRadius:"2px 2px 0 0", height:v>0?`${Math.max(6,(v/maxM)*28)}px`:"3px" }} />
                          <div style={{ fontSize:7, color:T.slate400 }}>
                            {["J","F","M","A","M","J","J","A","S","O","N","D"][i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ padding:"0 18px 16px", borderTop:`1px solid ${T.slate100}` }}>
                  <div style={{ fontSize:12, color:T.slate600, lineHeight:1.7, marginTop:10, marginBottom:10 }}>
                    {goal.notes}
                  </div>
                  <AskBtn size="small" context={`Goal deep dive:\nTitle: ${goal.title}\nCategory: ${goal.category}\nTarget: ${fmt(goal.target_value,goal.unit)}\nCurrent: ${fmt(goal.current_value,goal.unit)}\nProgress: ${p}%\nDue: ${goal.target_date}\nNotes: ${goal.notes}\n\nHelp me build a specific action plan to hit this goal. What do I need to do this month?`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Section: Completed ───────────────────────────────────────
const CompletedSection = ({ tasks }) => {
  const completed = tasks.filter(t => t.status === "completed");
  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Completed tasks</div>
          <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>{completed.length} tasks completed this month — great work</div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {completed.map((task,i) => {
          const pr = PRIORITY[task.priority] || PRIORITY.medium;
          const mod = moduleConfig(task.module);
          return (
            <div key={task.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<completed.length-1?`1px solid ${T.slate100}`:"none", opacity:0.7 }}>
              <div style={{ width:18, height:18, borderRadius:4, background:T.green, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ color:T.white, fontSize:10 }}>✓</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:T.slate600, textDecoration:"line-through", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
                <div style={{ fontSize:10, color:T.slate400, marginTop:1 }}>{mod.icon} {mod.label} · Completed {task.completed_at}</div>
              </div>
              <span style={{ fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20, background:pr.bg, color:pr.color, flexShrink:0 }}>{pr.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ─── Main Tasks & Goals Module ────────────────────────────────
export default function TasksGoals({ onNavigate }) {
  const [section,  setSection]  = useState("overview");
  const { data: liveTasks, loading: tasksLoading } = useSupabaseTable("tasks", AGENCY_ID, { orderBy: "due_date", ascending: true });
  const { data: liveGoals, loading: goalsLoading } = useSupabaseTable("goals", AGENCY_ID, { orderBy: "target_date", ascending: true });
  const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== "false";

  const [tasks, setTasks] = useState(useMockData ? MOCK_TASKS : []);
  useEffect(() => {
    if (liveTasks && liveTasks.length > 0) {
      // Alias schema fields so existing render code (task.module, task.due_date, etc.) keeps working
      setTasks(liveTasks.map(t => ({
        ...t,
        module:       t.module_reference || t.module || "general",
        due_date:     t.due_date ? new Date(t.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
        completed_at: t.completed_at ? new Date(t.completed_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
      })));
    }
  }, [liveTasks]);

  const goals = (liveGoals && liveGoals.length > 0)
    ? liveGoals
    : useMockData ? MOCK_GOALS : [];

  if (tasksLoading || goalsLoading) return <div style={{padding:40,textAlign:"center",fontSize:13,color:"#64748B"}}>Loading tasks and goals…</div>;
  if (tasks.length === 0 && goals.length === 0) return <EmptyState module="tasks" />;

  const completeTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, status:"completed", completed_at:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) }
      : t
    ));
  };

  const addTask = (task) => setTasks(prev => [task, ...prev]);

  const sections = [
    { id:"overview",  label:"Overview"   },
    { id:"tasks",     label:"Tasks"      },
    { id:"goals",     label:"Goals"      },
    { id:"completed", label:"Completed"  },
  ];

  return (
    <div>
      {/* Module Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>Tasks & Goals</div>
          <div style={{ fontSize:12, color:T.slate500, marginTop:3 }}>
            {tasks.filter(t=>t.status!=="completed").length} open tasks · {goals.length} active goals · {tasks.filter(t=>t.status==="completed").length} completed this month
          </div>
        </div>
        <AskBtn context="Give me a complete review of my tasks and goals. What are the most critical items I should focus on today? What's at risk of falling behind? Help me build a clear action plan for this week." />
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
      {section === "overview"  && <TasksOverview tasks={tasks} goals={goals} onComplete={completeTask} onNavigate={onNavigate||(()=>{})} />}
      {section === "tasks"     && <TasksList     tasks={tasks} onComplete={completeTask} onNavigate={onNavigate||(() =>{})} onAdd={addTask} />}
      {section === "goals"     && <GoalsSection  goals={goals} />}
      {section === "completed" && <CompletedSection tasks={tasks} />}
    </div>
  );
}

