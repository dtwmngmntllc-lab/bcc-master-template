import { useState, useEffect, createContext, useContext } from "react";

import Dashboard from "./src/modules/Dashboard.jsx";
import Financials from "./src/modules/Financials.jsx";
import PersistentMemory from "./src/modules/PersistentMemory.jsx";
import ComplianceCenter from "./src/modules/ComplianceCenter.jsx";
import Automations from "./src/modules/Automations.jsx";
import SocialMedia from "./src/modules/SocialMedia.jsx";
import TasksGoals from "./src/modules/TasksGoals.jsx";
import AlertsNotifications from "./src/modules/AlertsNotifications.jsx";
import Documents from "./src/modules/Documents.jsx";
import HRPeople from "./src/modules/HRPeople.jsx";
import Settings from "./src/modules/Settings.jsx";
import ErrorBoundary from "./src/components/ErrorBoundary.jsx";
import { supabase, AGENCY_ID } from "./src/lib/supabase.js";
import DemoBanner from "./src/components/DemoBanner.jsx";


// ============================================================
// BCC APP SHELL v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// ARCHITECTURE:
// ┌─────────────────────────────────────────────────────┐
// │  This file: Frontend UI (React)                      │
// │  Data:      Supabase (SUPABASE_URL + ANON_KEY only) │
// │  Execution: Composio (connected accounts)            │
// │  Processing: Groq via Composio (free, no API key)   │
// │  Intelligence: Claude.ai (client's subscription)    │
// │  Hosting:   Vercel (client's free account)          │
// │  Recipes:   Stored in automation_recipes table      │
// │  Schedules: Cron triggers in Supabase               │
// │                                                      │
// │  NO Anthropic API key required in this app.         │
// │  Claude.ai opens in a new tab with context.         │
// └─────────────────────────────────────────────────────┘
//
// ENVIRONMENT VARIABLES NEEDED (.env):
//   VITE_SUPABASE_URL=https://[project].supabase.co
//   VITE_SUPABASE_ANON_KEY=[anon key]
//
// That's it. Two variables. Nothing else.
// ============================================================


// ─── Design Tokens ────────────────────────────────────────────────────────────
const TOKENS = {
  navy:    "#1B2B4B",
  navyDark:"#121E35",
  blue:    "#2D7DD2",
  blueLt:  "#EFF6FF",
  green:   "#10B981",
  greenLt: "#D1FAE5",
  amber:   "#F59E0B",
  amberLt: "#FEF3C7",
  red:     "#EF4444",
  redLt:   "#FEE2E2",
  slate50: "#F8FAFC",
  slate100:"#F1F5F9",
  slate200:"#E2E8F0",
  slate400:"#94A3B8",
  slate500:"#64748B",
  slate700:"#334155",
  slate900:"#0F172A",
  white:   "#FFFFFF",
};

// ─── App Context ──────────────────────────────────────────────────────────────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ─── Mock Auth & Agency Data ──────────────────────────────────────────────────
// In production this comes from Supabase Auth + agency table
const MOCK_AGENCY = {
  name: "Smith Insurance Agency",
  agentCode: "IL 22-441A",
  user: { name: "Jane Smith", initials: "JS", role: "owner", email: "jane@smithinsurance.com" },
  alerts: 3,
};

// ─── Navigation Config ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",       icon: "grid",        roles: ["owner","manager","staff","readonly","accountant"] },
  { id: "financials",  label: "Financials",       icon: "dollar",      roles: ["owner","manager","accountant"] },
  { id: "memory",      label: "Memory",           icon: "brain",       roles: ["owner","manager"] },
  { id: "compliance",  label: "Compliance",       icon: "shield",      roles: ["owner","manager"] },
  { id: "automations", label: "Automations",      icon: "zap",         roles: ["owner","manager"] },
  { id: "social",      label: "Social Media",     icon: "share",       roles: ["owner","manager","staff"] },
  { id: "tasks",       label: "Tasks & Goals",    icon: "check",       roles: ["owner","manager","staff","readonly"] },
  { id: "alerts",      label: "Alerts",           icon: "bell",        roles: ["owner","manager","staff","readonly","accountant"] },
  { id: "documents",   label: "Documents",        icon: "folder",      roles: ["owner","manager","accountant"] },
  { id: "hr",          label: "HR & People",      icon: "users",       roles: ["owner","manager"] },
  { id: "chat",        label: "Claude Chat",      icon: "message",     roles: ["owner","manager","staff","readonly","accountant"] },
  { id: "settings",    label: "Settings",         icon: "settings",    roles: ["owner"] },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.75 }) => {
  const s = { width: size, height: size, flexShrink: 0 };
  const p = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    grid:       <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
    dollar:     <svg style={s} viewBox="0 0 24 24" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    brain:      <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.13A3 3 0 0 1 4 12a3 3 0 0 1 2-2.83 2.5 2.5 0 0 1 1.5-4.17z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.13A3 3 0 0 0 20 12a3 3 0 0 0-2-2.83 2.5 2.5 0 0 0-1.5-4.17z"/></svg>,
    shield:     <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
    zap:        <svg style={s} viewBox="0 0 24 24" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    share:      <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
    check:      <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    bell:       <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    folder:     <svg style={s} viewBox="0 0 24 24" {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    users:      <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    message:    <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    settings:   <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    chevronLeft:<svg style={s} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6"/></svg>,
    chevronRight:<svg style={s} viewBox="0 0 24 24" {...p}><polyline points="9 18 15 12 9 6"/></svg>,
    logout:     <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    menu:       <svg style={s} viewBox="0 0 24 24" {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    x:          <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    lightning:  <svg style={s} viewBox="0 0 24 24" fill={color} stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    externalLink:<svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  };
  return icons[name] || null;
};

// ─── Styles (CSS-in-JS) ───────────────────────────────────────────────────────
const css = {
  app: {
    display: "flex", flexDirection: "column",
    height: "100vh", minHeight: 600,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    background: TOKENS.slate50,
    overflow: "hidden",
  },

  // Header
  header: {
    background: TOKENS.navy,
    height: 58,
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    flexShrink: 0,
    borderBottom: `1px solid ${TOKENS.navyDark}`,
    zIndex: 100,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: {
    width: 32, height: 32,
    background: TOKENS.blue,
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  agencyName: { fontSize: 14, fontWeight: 600, color: TOKENS.white, letterSpacing: "-0.01em" },
  agencySub:  { fontSize: 10, color: TOKENS.slate400, marginTop: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  bellWrap: { position: "relative", cursor: "pointer", padding: 4 },
  bellBadge: {
    position: "absolute", top: 0, right: 0,
    background: TOKENS.red, color: TOKENS.white,
    fontSize: 9, fontWeight: 700,
    borderRadius: "50%", width: 16, height: 16,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: `2px solid ${TOKENS.navy}`,
  },
  userPill: {
    display: "flex", alignItems: "center", gap: 8,
    cursor: "pointer", padding: "4px 8px",
    borderRadius: 8,
    transition: "background 0.15s",
  },
  avatar: {
    width: 30, height: 30, borderRadius: "50%",
    background: TOKENS.blue,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: TOKENS.white,
    flexShrink: 0,
  },
  userName: { fontSize: 12, fontWeight: 600, color: TOKENS.white },
  userRole: { fontSize: 10, color: TOKENS.slate400, textTransform: "capitalize" },

  // Body
  body: { display: "flex", flex: 1, overflow: "hidden" },

  // Sidebar Nav
  nav: (collapsed) => ({
    width: collapsed ? 56 : 220,
    background: TOKENS.white,
    borderRight: `1px solid ${TOKENS.slate200}`,
    display: "flex", flexDirection: "column",
    flexShrink: 0,
    transition: "width 0.2s ease",
    overflow: "hidden",
    zIndex: 50,
  }),
  navScroll: { flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" },
  navItem: (active, collapsed) => ({
    display: "flex", alignItems: "center",
    gap: collapsed ? 0 : 10,
    padding: collapsed ? "10px 0" : "9px 14px",
    justifyContent: collapsed ? "center" : "flex-start",
    cursor: "pointer",
    fontSize: 12.5, fontWeight: active ? 600 : 400,
    color: active ? TOKENS.blue : TOKENS.slate500,
    background: active ? TOKENS.blueLt : "transparent",
    borderLeft: active ? `3px solid ${TOKENS.blue}` : "3px solid transparent",
    borderRadius: collapsed ? 0 : "0 6px 6px 0",
    marginRight: collapsed ? 0 : 8,
    transition: "all 0.12s",
    whiteSpace: "nowrap",
    overflow: "hidden",
  }),
  navLabel: (collapsed) => ({
    opacity: collapsed ? 0 : 1,
    maxWidth: collapsed ? 0 : 160,
    transition: "opacity 0.15s, max-width 0.2s",
    overflow: "hidden",
  }),
  navCollapseBtn: {
    padding: "10px 0",
    display: "flex", alignItems: "center", justifyContent: "center",
    borderTop: `1px solid ${TOKENS.slate200}`,
    cursor: "pointer",
    color: TOKENS.slate400,
    transition: "color 0.15s",
  },
  navFooter: {
    padding: "8px 14px 12px",
    borderTop: `1px solid ${TOKENS.slate200}`,
  },

  // Main Content
  main: {
    flex: 1, overflowY: "auto",
    display: "flex", flexDirection: "column",
  },
  mainInner: { flex: 1, padding: "20px 24px" },

  // Page Header (used by each module)
  pageHeader: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 20, fontWeight: 700,
    color: TOKENS.slate900, letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    fontSize: 12, color: TOKENS.slate500, marginTop: 3,
  },

  // Ask Claude Button
  askBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: TOKENS.blue, color: TOKENS.white,
    border: "none", borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12, fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  // Cards
  card: {
    background: TOKENS.white,
    border: `1px solid ${TOKENS.slate200}`,
    borderRadius: 12,
    padding: "16px 18px",
  },
  cardTitle: {
    fontSize: 12, fontWeight: 600,
    color: TOKENS.slate700,
    marginBottom: 12,
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
  },

  // KPI Cards
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12, marginBottom: 16,
  },
  kpi: {
    background: TOKENS.white,
    border: `1px solid ${TOKENS.slate200}`,
    borderRadius: 12, padding: "14px 16px",
  },
  kpiLabel: { fontSize: 11, color: TOKENS.slate500, marginBottom: 6, fontWeight: 500 },
  kpiValue: { fontSize: 22, fontWeight: 700, color: TOKENS.slate900, letterSpacing: "-0.02em", marginBottom: 4 },
  kpiTrend: { fontSize: 11, display: "flex", alignItems: "center", gap: 4 },

  // Status Pills
  pill: (type) => {
    const map = {
      success: { bg: TOKENS.greenLt, color: "#065F46" },
      warning: { bg: TOKENS.amberLt, color: "#92400E" },
      danger:  { bg: TOKENS.redLt,   color: "#991B1B" },
      info:    { bg: TOKENS.blueLt,  color: "#1E40AF" },
    };
    const t = map[type] || map.info;
    return {
      display: "inline-flex", alignItems: "center",
      fontSize: 10, fontWeight: 600,
      padding: "3px 8px", borderRadius: 20,
      background: t.bg, color: t.color,
      whiteSpace: "nowrap",
    };
  },

  // Footer
  footer: {
    padding: "8px 24px",
    borderTop: `1px solid ${TOKENS.slate200}`,
    background: TOKENS.white,
    textAlign: "center",
    fontSize: 10, color: TOKENS.slate400,
    flexShrink: 0,
  },
};

// ─── Ask Claude Button Component ──────────────────────────────────────────────
const AskClaudeBtn = ({ context, size = "normal" }) => {
  const handleClick = () => {
    const prompt = context || "I am reviewing my Business Command Center. Help me analyze what I'm seeing.";
    navigator.clipboard?.writeText(prompt).catch(() => {});
    window.open("https://claude.ai", "_blank");
  };
  return (
    <button
      style={{
        ...css.askBtn,
        padding: size === "small" ? "5px 10px" : "8px 14px",
        fontSize: size === "small" ? 11 : 12,
      }}
      onClick={handleClick}
      title="Copies context to clipboard and opens Claude.ai"
    >
      <Icon name="lightning" size={12} color={TOKENS.white} />
      Ask Claude
      <Icon name="externalLink" size={11} color="rgba(255,255,255,0.7)" />
    </button>
  );
};

// ─── Module Placeholders ──────────────────────────────────────────────────────
// Each will be replaced with full module builds in subsequent steps

const ComingSoon = ({ module }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: 40, textAlign: "center" }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: TOKENS.blueLt, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="zap" size={24} color={TOKENS.blue} />
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color: TOKENS.slate900 }}>{module}</div>
    <div style={{ fontSize: 13, color: TOKENS.slate500, maxWidth: 300, lineHeight: 1.6 }}>
      This module is being built. Check back as we complete each section of your BCC.
    </div>
  </div>
);

// ─── Module Router ────────────────────────────────────────────────────────────
// All 11 modules built. In production each is imported from src/modules/.
// This shell routes to each module component. ComingSoon is only used
// for the Claude Chat module which connects to Claude.ai externally.
const ModuleRouter = ({ active, onNavigate }) => {
  const modules = {
    dashboard:   <ErrorBoundary name="Dashboard"><Dashboard onNavigate={onNavigate} /></ErrorBoundary>,
    financials:  <ErrorBoundary name="Financials"><Financials /></ErrorBoundary>,
    memory:      <ErrorBoundary name="Memory"><PersistentMemory /></ErrorBoundary>,
    compliance:  <ErrorBoundary name="Compliance"><ComplianceCenter /></ErrorBoundary>,
    automations: <ErrorBoundary name="Automations"><Automations /></ErrorBoundary>,
    social:      <ErrorBoundary name="Social Media"><SocialMedia /></ErrorBoundary>,
    tasks:       <ErrorBoundary name="Tasks & Goals"><TasksGoals /></ErrorBoundary>,
    alerts:      <ErrorBoundary name="Alerts"><AlertsNotifications onNavigate={onNavigate} /></ErrorBoundary>,
    documents:   <ErrorBoundary name="Documents"><Documents /></ErrorBoundary>,
    hr:          <ErrorBoundary name="HR & People"><HRPeople /></ErrorBoundary>,
    settings:    <ErrorBoundary name="Settings"><Settings /></ErrorBoundary>,
    chat: (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:16, padding:40, textAlign:"center" }}>
        <div style={{ fontSize:40 }}>💬</div>
        <div style={{ fontSize:18, fontWeight:700, color:TOKENS.slate900 }}>Claude Chat</div>
        <div style={{ fontSize:13, color:TOKENS.slate500, maxWidth:360, lineHeight:1.7 }}>
          Your Claude.ai account is your intelligence layer. Open it in a new tab and your BCC data is already in context through your Project instructions.
        </div>
        <button
          onClick={() => window.open("https://claude.ai","_blank")}
          style={{ display:"flex", alignItems:"center", gap:8, background:TOKENS.blue, color:"#fff", border:"none", borderRadius:10, padding:"12px 24px", fontSize:13, fontWeight:700, cursor:"pointer" }}
        >
          <Icon name="externalLink" size={14} color="#fff" />
          Open Claude.ai
        </button>
        <div style={{ fontSize:11, color:TOKENS.slate400, maxWidth:320, lineHeight:1.6 }}>
          Tip: Use the Ask Claude buttons throughout your BCC — they open Claude.ai with your data already in the prompt. One paste and Claude knows exactly what you're looking at.
        </div>
      </div>
    ),
  };
  return modules[active] || <ComingSoon module={active} />;
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BCCApp() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [agency, setAgency] = useState(MOCK_AGENCY);

  useEffect(() => {
    if (!supabase || !AGENCY_ID) return;
    supabase
      .from("agency")
      .select("name, state_farm_agent_code, owner_name, primary_email")
      .eq("id", AGENCY_ID)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return; // graceful fallback to MOCK_AGENCY
        setAgency({
          name: data.name || MOCK_AGENCY.name,
          agentCode: data.state_farm_agent_code || MOCK_AGENCY.agentCode,
          user: {
            name: data.owner_name || MOCK_AGENCY.user.name,
            initials: (data.owner_name || MOCK_AGENCY.user.name)
              .split(" ").map(n => n[0]).join("").toUpperCase(),
            role: "owner",
            email: data.primary_email || MOCK_AGENCY.user.email,
          },
          alerts: MOCK_AGENCY.alerts,
        });
      });
  }, []);

  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(agency.user.role));

  return (
    <AppContext.Provider value={{ agency, activeModule, setActiveModule }}>
      <div style={css.app}>
        <DemoBanner />

        {/* ── Header ── */}
        <header style={css.header}>
          <div style={css.headerLeft}>
            <div style={css.headerLogo}>
              <Icon name="lightning" size={16} color={TOKENS.white} />
            </div>
            <div>
              <div style={css.agencyName}>{agency.name}</div>
              <div style={css.agencySub}>Business Command Center</div>
            </div>
          </div>

          <div style={css.headerRight}>
            {/* Alerts Bell */}
            <div style={css.bellWrap} title={`${agency.alerts} active alerts`}>
              <Icon name="bell" size={18} color={TOKENS.slate400} />
              {agency.alerts > 0 && <span style={css.bellBadge}>{agency.alerts}</span>}
            </div>

            {/* User Menu */}
            <div style={{ position: "relative" }}>
              <div
                style={css.userPill}
                onClick={() => setUserMenuOpen(o => !o)}
              >
                <div style={css.avatar}>{agency.user.initials}</div>
                <div>
                  <div style={css.userName}>{agency.user.name}</div>
                  <div style={css.userRole}>{agency.user.role}</div>
                </div>
              </div>
              {userMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  background: TOKENS.white, border: `1px solid ${TOKENS.slate200}`,
                  borderRadius: 10, padding: 6, minWidth: 160,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200,
                }}>
                  <div style={{ padding: "8px 10px", fontSize: 11, color: TOKENS.slate500, borderBottom: `1px solid ${TOKENS.slate200}`, marginBottom: 4 }}>
                    {agency.user.email}
                  </div>
                  {["Profile", "Notification Settings", "Team Access"].map(item => (
                    <div key={item} style={{ padding: "7px 10px", fontSize: 12, color: TOKENS.slate700, cursor: "pointer", borderRadius: 6 }}
                      onClick={() => { setActiveModule("settings"); setUserMenuOpen(false); }}>
                      {item}
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${TOKENS.slate200}`, marginTop: 4, paddingTop: 4 }}>
                    <div style={{ padding: "7px 10px", fontSize: 12, color: TOKENS.red, cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="logout" size={13} color={TOKENS.red} /> Sign out
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div style={css.body} onClick={() => userMenuOpen && setUserMenuOpen(false)}>

          {/* ── Sidebar ── */}
          <nav style={css.nav(navCollapsed)}>
            <div style={css.navScroll}>
              {visibleNav.map(item => {
                const active = activeModule === item.id;
                return (
                  <div
                    key={item.id}
                    style={css.navItem(active, navCollapsed)}
                    onClick={() => setActiveModule(item.id)}
                    title={navCollapsed ? item.label : ""}
                  >
                    <Icon
                      name={item.icon}
                      size={15}
                      color={active ? TOKENS.blue : TOKENS.slate400}
                    />
                    <span style={css.navLabel(navCollapsed)}>{item.label}</span>
                    {item.id === "alerts" && !navCollapsed && agency.alerts > 0 && (
                      <span style={{ ...css.pill("danger"), marginLeft: "auto", fontSize: 9, padding: "2px 6px" }}>
                        {agency.alerts}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Collapse Toggle */}
            <div
              style={css.navCollapseBtn}
              onClick={() => setNavCollapsed(c => !c)}
              title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            >
              <Icon name={navCollapsed ? "chevronRight" : "chevronLeft"} size={14} color={TOKENS.slate400} />
            </div>
          </nav>

          {/* ── Main Content ── */}
          <main style={css.main}>
            <div style={css.mainInner}>
              <ModuleRouter active={activeModule} onNavigate={setActiveModule} />
            </div>

            {/* Footer */}
            <div style={css.footer}>
              Built by Imaginary Farms LLC &nbsp;·&nbsp; The Claude Whisperer &nbsp;·&nbsp;
              <a href="https://imaginary-farms.com" target="_blank" rel="noopener noreferrer"
                style={{ color: TOKENS.slate400, textDecoration: "none" }}>
                imaginary-farms.com
              </a>
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
