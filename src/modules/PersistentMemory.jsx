import { useState, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";

// ============================================================
// BCC PERSISTENT MEMORY MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// PURPOSE:
// The agency brain. Everything Claude needs to know about
// this business lives here. Editable by owner or Claude.
// Categories mirror persistent_memory table in Supabase.
//
// CATEGORIES:
//   agency_profile      — Entity, licenses, contacts
//   staff               — Team members and roles
//   business_rules      — Rules Claude must always follow
//   financial_context   — Accounting setup, CPA, comp structure
//   goals               — Current targets and priorities
//   relationships       — Key contacts and vendors
//   compliance_notes    — Agent-specific compliance reminders
//
// DATA: Reads/writes persistent_memory table in Supabase
// In production replace MOCK_MEMORY with:
//   const { data } = await supabase
//     .from('persistent_memory')
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
  slate300:"#CBD5E1",
  slate400:"#94A3B8",
  slate500:"#64748B",
  slate600:"#475569",
  slate700:"#334155",
  slate800:"#1E293B",
  slate900:"#0F172A",
  white:   "#FFFFFF",
};

// ─── Category Config ──────────────────────────────────────────
const CATEGORIES = [
  { id: "agency_profile",    label: "Agency Profile",    icon: "🏢", color: T.blue,   colorLt: T.blueLt,   description: "Entity details, licensing, contact information" },
  { id: "staff",             label: "Staff & Team",      icon: "👥", color: T.purple, colorLt: T.purpleLt, description: "Team members, roles, employment details" },
  { id: "business_rules",    label: "Business Rules",    icon: "⚙️", color: T.navy,   colorLt: T.slate100, description: "Rules Claude must always follow in every conversation" },
  { id: "financial_context", label: "Financial Context", icon: "💰", color: T.green,  colorLt: T.greenLt,  description: "Accounting setup, CPA details, compensation structure" },
  { id: "goals",             label: "Goals & Priorities",icon: "🎯", color: T.amber,  colorLt: T.amberLt,  description: "Current targets, priorities, milestones" },
  { id: "relationships",     label: "Key Relationships", icon: "🤝", color: T.teal,   colorLt: T.tealLt,   description: "CPA, vendors, SF contacts, key business relationships" },
  { id: "compliance_notes",  label: "Compliance Notes",  icon: "🛡️", color: T.red,    colorLt: T.redLt,    description: "Agency-specific compliance reminders and notes" },
];

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_MEMORY = [
  // Agency Profile
  {
    id: "1", category: "agency_profile", title: "Agency Overview",
    content: `Agency Name: Smith Insurance Agency
Owner: Jane Smith
Entity Type: S-Corporation
SF Agent Code: IL 22-441A
Licensed States: IL, WI, IN
Primary Email: jane@smithagency.com
Phone: (312) 555-0182
Address: 1420 N. Michigan Ave, Suite 301, Chicago, IL 60610
BCC Setup Date: April 15, 2026`,
    added_by: "system", source: "initial_setup",
  },
  {
    id: "2", category: "agency_profile", title: "Business Context",
    content: `Jane has operated this agency since 2018. Prior career in banking gave her strong financial acumen. Agency focus is personal lines with a growing commercial book. Located in the suburban Chicago market, high competition area. Jane reviews her BCC every morning before 9AM and prefers direct, concise communication with bullet points for action items.`,
    added_by: "system", source: "discovery_call",
  },

  // Staff
  {
    id: "3", category: "staff", title: "Team Overview",
    content: `Current Team (3 staff):

1. Marcus Thompson — Licensed Sales Agent (W-2)
   Start: Jan 2022 · Salary: $52,000 + commission
   Licensed: IL, WI · Strong life insurance producer
   Email: marcus@smithagency.com

2. Priya Patel — Office Manager (W-2, unlicensed)
   Start: Mar 2020 · Salary: $42,000
   Handles operations, billing, client service
   Email: priya@smithagency.com

3. Tyler Smith — Part-time Support (W-2, family)
   Start: Jun 2024 · Hourly: $18/hr
   Jane's son. Works 20hrs/wk. Below standard deduction.
   No FIT withheld. Flag for CPA at year-end for W-2.`,
    added_by: "system", source: "discovery_call",
  },

  // Business Rules
  {
    id: "4", category: "business_rules", title: "Accounting Rules",
    content: `1. Cash basis ONLY — revenue counts when money hits the bank account. Never count pending or promised payments as current revenue.
2. PFA (Policy Financing Arrangement) is NOT a business asset. It does not appear on the balance sheet. It is a SF compliance item only.
3. Owner draws and S-Corp distributions are equity transactions — never expenses.
4. Owner W-2 wages must reflect reasonable compensation for S-Corp — flag for CPA annually.
5. Always reconcile COMP_RECAP to GL before closing a period.
6. Tyler Smith (family employee) requires W-2 at year-end. No FIT withheld — below standard deduction threshold. Review with Steven Bonventre.
7. S-Corp Medical premiums for Jane are tracked in account 6115 and added to W-2 Box 1.`,
    added_by: "system", source: "if_standard_rules",
  },
  {
    id: "5", category: "business_rules", title: "SF Compliance Rules",
    content: `1. Never suggest social media content that promises specific rates or savings.
2. All advertising must be pre-approved by SF before publishing.
3. Required disclosures must appear on all marketing materials.
4. Flag license renewal deadlines 60 days in advance.
5. Flag E&O insurance renewal 90 days before expiration.
6. PFA activity should be reviewed with CPA annually.
7. No rebating or inducements to policyholders.
8. Do not suggest content that could be confused with official SF corporate communications.`,
    added_by: "system", source: "if_compliance_rules",
  },
  {
    id: "6", category: "business_rules", title: "Communication Preferences",
    content: `- Direct and concise. No fluff.
- Use bullet points for action items.
- Flag financial issues immediately — do not soften bad news.
- Jane reviews BCC every morning before 9AM.
- Prefers email briefings over in-app notifications for critical items.
- When recommending actions, lead with the most important item.`,
    added_by: "system", source: "discovery_call",
  },

  // Financial Context
  {
    id: "7", category: "financial_context", title: "Accounting & Tax Setup",
    content: `Entity: S-Corporation (elected 2019)
Fiscal Year: Calendar Year (Jan–Dec)
Accounting Method: Cash Basis
Payroll Provider: Gusto (bi-weekly)
CPA: Steven Bonventre at Club Capital Tax LLC
CPA Email: steven@clubcapitaltax.com
CPA Phone: (312) 555-0198
Owner W-2 Salary: $85,000/year (reasonable comp)
S-Corp Distributions: Separate from salary, tracked in equity
S-Corp Medical: Jane's health insurance added to W-2 Box 1`,
    added_by: "system", source: "discovery_call",
  },
  {
    id: "8", category: "financial_context", title: "SF Compensation Structure",
    content: `AIPP Target 2026: $142,000
Prior Year AIPP Actual 2025: $138,200
ScoreBoard Participation: Yes — targeting President level
Primary Revenue Lines: Auto, Home, Life, Personal Articles
Multi-State Comp: IL (primary), WI, IN — all comp reported on IL COMP_RECAP
COMP_RECAP: Received monthly from SF, imported via Doc Importer`,
    added_by: "system", source: "discovery_call",
  },

  // Goals
  {
    id: "9", category: "goals", title: "2026 Goals",
    content: `1. Hit AIPP target of $142,000 (currently at 47.5% — on track)
2. Grow new business premium by 15% vs 2025
3. Add one licensed team member by Q3 2026
4. Achieve ScoreBoard President recognition
5. Reduce operating expense ratio below 45%
6. Complete full BCC data migration by end of April
7. Launch social media content calendar — 4 posts/week`,
    added_by: "system", source: "discovery_call",
  },

  // Relationships
  {
    id: "10", category: "relationships", title: "Key Contacts",
    content: `CPA: Steven Bonventre — Club Capital Tax LLC — steven@clubcapitaltax.com
SF Field Leader: Michael Torres — michael.torres@statefarm.com (personal email on file)
Payroll: Gusto support — support@gusto.com
E&O Insurance: Hartford — policy #HRT-8821-IL — renews Aug 2026
Attorney: Davis & Park LLC — Michelle Park — (312) 555-0211
Landlord: Midwest Properties LLC — lease expires Dec 2027
IT Support: TechForce Chicago — helpdesk@techforcechicago.com`,
    added_by: "system", source: "discovery_call",
  },

  // Compliance Notes
  {
    id: "11", category: "compliance_notes", title: "Agency-Specific Compliance Reminders",
    content: `- IL license renewal due: October 2026 — also covers WI and IN non-resident
- CE hours required: 24 hours IL by Oct 2026 — 14 hours completed as of Apr 2026
- E&O renewal: August 2026 — flag 90 days out (May 2026)
- Annual social media audit: Due by Nov 2026
- Privacy notice distribution: Due by Nov 2026
- W-2 filing: January 31, 2027 for 2026 tax year
- Tyler Smith family employment: Review with Steven at year-end for proper W-2 treatment`,
    added_by: "system", source: "discovery_call",
  },
];

// ─── Shared Components ────────────────────────────────────────
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

// ─── Memory Card ──────────────────────────────────────────────
const MemoryCard = ({ item, categoryConfig, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = item.content.split("\n").filter(Boolean);
  const preview = lines.slice(0, 3).join("\n");
  const hasMore = lines.length > 3;

  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.slate200}`,
      borderRadius: 12,
      overflow: "hidden",
      borderLeft: `4px solid ${categoryConfig.color}`,
    }}>
      {/* Card Header */}
      <div style={{
        padding: "12px 14px",
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.slate800, marginBottom: 2 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 10, color: T.slate400 }}>
            Added by {item.added_by} · {item.source.replace(/_/g," ")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <AskBtn size="small" context={`Memory context — ${item.title}:\n\n${item.content}\n\nHelp me review and update this information if needed.`} />
          <button
            onClick={() => onEdit(item)}
            style={{
              padding: "5px 10px", fontSize: 10, fontWeight: 600,
              color: T.slate600, background: T.slate100,
              border: `1px solid ${T.slate200}`,
              borderRadius: 6, cursor: "pointer",
            }}
          >Edit</button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: "0 14px 12px",
        fontSize: 12, color: T.slate700,
        lineHeight: 1.7,
        whiteSpace: "pre-line",
      }}>
        {expanded ? item.content : preview}
        {hasMore && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              display: "block", marginTop: 6,
              fontSize: 11, color: T.blue,
              background: "none", border: "none",
              cursor: "pointer", padding: 0, fontWeight: 500,
            }}
          >
            {expanded ? "Show less ↑" : `Show more (${lines.length - 3} more lines) ↓`}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Edit Modal ───────────────────────────────────────────────
const EditModal = ({ item, categories, onSave, onCancel, onDelete }) => {
  const [title,    setTitle]    = useState(item?.title   || "");
  const [content,  setContent]  = useState(item?.content || "");
  const [category, setCategory] = useState(item?.category || "business_rules");
  const isNew = !item?.id;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(15,23,42,0.5)",
      display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: T.white, borderRadius: 16,
        width: "100%", maxWidth: 560,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${T.slate200}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.slate900 }}>
            {isNew ? "Add Memory" : "Edit Memory"}
          </div>
          <button onClick={onCancel} style={{
            background: "none", border: "none",
            fontSize: 18, color: T.slate400,
            cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px" }}>
          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.slate600, display: "block", marginBottom: 6 }}>
              CATEGORY
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                fontSize: 12, color: T.slate800,
                background: T.white,
                border: `1px solid ${T.slate200}`,
                borderRadius: 8, outline: "none",
              }}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.slate600, display: "block", marginBottom: 6 }}>
              TITLE
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Short descriptive title..."
              style={{
                width: "100%", padding: "8px 10px",
                fontSize: 12, color: T.slate800,
                border: `1px solid ${T.slate200}`,
                borderRadius: 8, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Content */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.slate600, display: "block", marginBottom: 6 }}>
              CONTENT
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Enter the information Claude should remember..."
              rows={8}
              style={{
                width: "100%", padding: "10px",
                fontSize: 12, color: T.slate800,
                border: `1px solid ${T.slate200}`,
                borderRadius: 8, outline: "none",
                resize: "vertical", lineHeight: 1.6,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: T.slate400, marginBottom: 16 }}>
            Claude reads this in every conversation. Be specific and complete.
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${T.slate200}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            {!isNew && (
              <button
                onClick={() => onDelete(item.id)}
                style={{
                  padding: "7px 14px", fontSize: 11, fontWeight: 600,
                  color: T.red, background: T.redLt,
                  border: "none", borderRadius: 7, cursor: "pointer",
                }}
              >Delete</button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                padding: "7px 14px", fontSize: 11, fontWeight: 600,
                color: T.slate600, background: T.slate100,
                border: "none", borderRadius: 7, cursor: "pointer",
              }}
            >Cancel</button>
            <button
              onClick={() => onSave({ ...item, title, content, category })}
              disabled={!title.trim() || !content.trim()}
              style={{
                padding: "7px 16px", fontSize: 11, fontWeight: 600,
                color: T.white, background: T.navy,
                border: "none", borderRadius: 7, cursor: "pointer",
                opacity: (!title.trim() || !content.trim()) ? 0.5 : 1,
              }}
            >Save Memory</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Category Sidebar ─────────────────────────────────────────
const CategorySidebar = ({ categories, activeCategory, counts, onChange }) => (
  <div style={{
    width: 200, flexShrink: 0,
    display: "flex", flexDirection: "column", gap: 4,
  }}>
    <button
      onClick={() => onChange("all")}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "9px 12px", borderRadius: 8, cursor: "pointer",
        background: activeCategory === "all" ? T.navy : "transparent",
        border: `1px solid ${activeCategory === "all" ? T.navy : T.slate200}`,
        fontSize: 12, fontWeight: activeCategory === "all" ? 600 : 400,
        color: activeCategory === "all" ? T.white : T.slate600,
        textAlign: "left",
      }}
    >
      <span>All Memories</span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        background: activeCategory === "all" ? "rgba(255,255,255,0.2)" : T.slate200,
        color: activeCategory === "all" ? T.white : T.slate600,
        borderRadius: 10, padding: "1px 7px",
      }}>{counts.all}</span>
    </button>

    {categories.map(cat => {
      const active = activeCategory === cat.id;
      return (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
            background: active ? cat.colorLt : "transparent",
            border: `1px solid ${active ? cat.color : T.slate200}`,
            fontSize: 12, fontWeight: active ? 600 : 400,
            color: active ? cat.color : T.slate600,
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: active ? cat.color : T.slate100,
            color: active ? T.white : T.slate500,
            borderRadius: 10, padding: "1px 7px",
          }}>{counts[cat.id] || 0}</span>
        </button>
      );
    })}
  </div>
);

// ─── Main Module ──────────────────────────────────────────────
export default function PersistentMemory() {
  const [memories,        setMemories]        = useState(MOCK_MEMORY);
  const [activeCategory,  setActiveCategory]  = useState("all");
  const [editingItem,     setEditingItem]      = useState(null);
  const [showNewModal,    setShowNewModal]     = useState(false);
  const [searchQuery,     setSearchQuery]      = useState("");

  // Counts per category
  const counts = {
    all: memories.filter(m => m.is_active !== false).length,
    ...Object.fromEntries(
      CATEGORIES.map(c => [c.id, memories.filter(m => m.category === c.id && m.is_active !== false).length])
    ),
  };

  // Filtered memories
  const filtered = memories.filter(m => {
    if (m.is_active === false) return false;
    if (activeCategory !== "all" && m.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
    }
    return true;
  });

  // Grouped by category for display
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(m => m.category === cat.id);
    if (items.length) acc[cat.id] = items;
    return acc;
  }, {});

  const handleSave = (item) => {
    if (item.id) {
      setMemories(prev => prev.map(m => m.id === item.id ? item : m));
    } else {
      setMemories(prev => [...prev, { ...item, id: Date.now().toString(), added_by: "owner", source: "manual" }]);
    }
    setEditingItem(null);
    setShowNewModal(false);
  };

  const handleDelete = (id) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, is_active: false } : m));
    setEditingItem(null);
  };

  const allContext = memories
    .filter(m => m.is_active !== false)
    .map(m => `[${m.title}]\n${m.content}`)
    .join("\n\n---\n\n");

  return (
    <div>
      {/* Module Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.slate900, letterSpacing: "-0.02em" }}>
            Persistent Memory
          </div>
          <div style={{ fontSize: 12, color: T.slate500, marginTop: 3 }}>
            {counts.all} memory entries · Claude reads all of these in every conversation
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AskBtn
            context={`Here is my complete agency memory context — everything I want you to know about my business:\n\n${allContext}\n\nPlease review this and tell me: (1) Is anything missing? (2) Is anything outdated? (3) Are there any inconsistencies you notice?`}
          />
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: T.navy, color: T.white,
              border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >+ Add Memory</button>
        </div>
      </div>

      {/* How Claude Uses This — Info Banner */}
      <div style={{
        background: T.blueLt,
        border: `1px solid ${T.blue}20`,
        borderLeft: `4px solid ${T.blue}`,
        borderRadius: 10, padding: "12px 16px",
        marginBottom: 20,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 3 }}>
            How Claude uses this memory
          </div>
          <div style={{ fontSize: 11, color: T.slate600, lineHeight: 1.6 }}>
            Every entry here is passed to Claude as context at the start of each conversation. Claude uses it to give you answers that are specific to your agency — not generic advice. The more complete and accurate this memory is, the more useful your Claude becomes. You and Claude can both add, edit, and update these entries at any time.
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          style={{
            width: "100%", padding: "9px 14px",
            fontSize: 12, color: T.slate800,
            border: `1px solid ${T.slate200}`,
            borderRadius: 9, outline: "none",
            boxSizing: "border-box",
            background: T.white,
          }}
        />
      </div>

      {/* Body — Sidebar + Cards */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* Category Sidebar */}
        <CategorySidebar
          categories={CATEGORIES}
          activeCategory={activeCategory}
          counts={counts}
          onChange={setActiveCategory}
        />

        {/* Memory Cards */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              color: T.slate400, fontSize: 13,
            }}>
              {searchQuery ? `No memories match "${searchQuery}"` : "No memories in this category yet."}
            </div>
          )}

          {activeCategory === "all"
            ? CATEGORIES.map(cat => {
                const items = grouped[cat.id];
                if (!items?.length) return null;
                return (
                  <div key={cat.id}>
                    {/* Category Group Header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.slate700 }}>{cat.label}</span>
                      <div style={{ flex: 1, height: 1, background: T.slate200, marginLeft: 4 }} />
                      <span style={{ fontSize: 11, color: T.slate400 }}>{items.length} {items.length === 1 ? "entry" : "entries"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.map(item => (
                        <MemoryCard
                          key={item.id}
                          item={item}
                          categoryConfig={cat}
                          onEdit={setEditingItem}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            : (() => {
                const cat = CATEGORIES.find(c => c.id === activeCategory);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filtered.map(item => (
                      <MemoryCard
                        key={item.id}
                        item={item}
                        categoryConfig={cat}
                        onEdit={setEditingItem}
                      />
                    ))}
                  </div>
                );
              })()
          }
        </div>
      </div>

      {/* Edit Modal */}
      {(editingItem || showNewModal) && (
        <EditModal
          item={editingItem}
          categories={CATEGORIES}
          onSave={handleSave}
          onCancel={() => { setEditingItem(null); setShowNewModal(false); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
