import { useState, useMemo, useEffect, useRef } from "react";
import { AGENCY_ID } from "../lib/supabase.js";
import { useSupabaseTable } from "../lib/hooks.js";
import EmptyState from "../components/EmptyState.jsx";

// ============================================================
// BCC DOCUMENTS MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Overview     — Recent activity, storage summary, quick stats
//   2. Library      — All documents, searchable, filterable by type
//   3. Intake Log   — What was received, when, what it loaded
//   4. Upload       — Dual path: database import or Claude chat
//
// DUAL UPLOAD PATHS:
//   Path A — Upload to Database
//     → Triggers document importer
//     → Groq classifies and routes to correct Supabase tables
//     → Logged in documents table with tables_updated
//     → Saved to Google Drive in correct folder
//
//   Path B — Upload to Claude Chat
//     → Temporary context for current conversation
//     → Not persisted to database unless Claude extracts data
//     → Agent uses for quick analysis, one-off questions
//
// AUTO-INTAKE:
//   Documents emailed to agency Gmail are automatically
//   detected by the Document Importer automation (hourly)
//   and processed via the same Path A flow.
//
// DATA: Reads documents table in Supabase
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

// ─── Document Type Config ─────────────────────────────────────
const DOC_TYPES = {
  comp_recap:     { label:"COMP_RECAP",      color:T.green,  bg:T.greenLt,  icon:"📊" },
  payroll_export: { label:"Payroll Export",  color:T.blue,   bg:T.blueLt,   icon:"💼" },
  bank_statement: { label:"Bank Statement",  color:T.teal,   bg:T.tealLt,   icon:"🏦" },
  tax_document:   { label:"Tax Document",    color:T.amber,  bg:T.amberLt,  icon:"📋" },
  resume:         { label:"Resume",          color:T.purple, bg:T.purpleLt, icon:"👤" },
  aipp_report:    { label:"AIPP Report",     color:T.green,  bg:T.greenLt,  icon:"🎯" },
  eo_insurance:   { label:"E&O Insurance",   color:T.red,    bg:T.redLt,    icon:"🛡️" },
  license:        { label:"License",         color:T.navy,   bg:T.slate100, icon:"🪪" },
  contract:       { label:"Contract",        color:T.navy,   bg:T.slate100, icon:"📜" },
  other:          { label:"Other",           color:T.slate500,bg:T.slate100, icon:"📄" },
};

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_DOCUMENTS = [
  {
    id:"d1",  file_name:"SF_COMP_April_2026.pdf",
    file_type:"pdf", doc_type:"comp_recap",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"comp_recap",
    tables_updated:["comp_recap","aipp_tracking"],
    records_created:5, uploaded_at:"Apr 26 2:28 PM",
    processed_at:"Apr 26 2:30 PM",
    notes:"April 2026 COMP_RECAP. Total: $48,240. AIPP updated to 47.5%.",
    size:"284 KB",
  },
  {
    id:"d2",  file_name:"april_payroll_export.csv",
    file_type:"csv", doc_type:"payroll_export",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"payroll_export",
    tables_updated:["payroll_runs","payroll_detail"],
    records_created:4, uploaded_at:"Apr 25 10:14 AM",
    processed_at:"Apr 25 10:16 AM",
    notes:"April 1-15 payroll. 3 staff. Gross: $6,200. Taxes: $744.",
    size:"18 KB",
  },
  {
    id:"d3",  file_name:"chase_march_statement.pdf",
    file_type:"pdf", doc_type:"bank_statement",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"partial", processing_type:"database_import",
    groq_classification:"bank_statement",
    tables_updated:["journal_entries"],
    records_created:18, uploaded_at:"Apr 15 2:58 PM",
    processed_at:"Apr 15 3:01 PM",
    notes:"March bank statement. 18 of 21 transactions loaded. 3 pages could not be parsed — saved to Drive for manual review.",
    size:"1.2 MB",
  },
  {
    id:"d4",  file_name:"resume_jamie_chen.pdf",
    file_type:"pdf", doc_type:"resume",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"resume",
    tables_updated:["applicants","documents"],
    records_created:1, uploaded_at:"Apr 26 9:12 AM",
    processed_at:"Apr 26 9:14 AM",
    notes:"Applicant: Jamie Chen. Score: 8/10. One Page Interview Focus generated. Position: Licensed Sales Agent.",
    size:"142 KB",
  },
  {
    id:"d5",  file_name:"SF_COMP_March_2026.pdf",
    file_type:"pdf", doc_type:"comp_recap",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"comp_recap",
    tables_updated:["comp_recap","aipp_tracking"],
    records_created:4, uploaded_at:"Apr 5 11:20 AM",
    processed_at:"Apr 5 11:22 AM",
    notes:"March 2026 COMP_RECAP. Total: $44,600.",
    size:"276 KB",
  },
  {
    id:"d6",  file_name:"q1_tax_estimate_2026.pdf",
    file_type:"pdf", doc_type:"tax_document",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"tax_document",
    tables_updated:["documents"],
    records_created:0, uploaded_at:"Apr 1 3:45 PM",
    processed_at:"Apr 1 3:47 PM",
    notes:"Q1 2026 estimated tax document from Club Capital Tax. Archived to Drive. No data extracted.",
    size:"89 KB",
  },
  {
    id:"d7",  file_name:"EO_Policy_2025_2026.pdf",
    file_type:"pdf", doc_type:"eo_insurance",
    upload_source:"direct_upload", drive_url:"#",
    processing_status:"complete", processing_type:"archive",
    groq_classification:"eo_insurance",
    tables_updated:["documents"],
    records_created:0, uploaded_at:"Aug 15, 2025",
    processed_at:"Aug 15, 2025",
    notes:"E&O policy Hartford. Policy #HRT-8821-IL. Renews August 2026. Archived to Drive.",
    size:"412 KB",
  },
  {
    id:"d8",  file_name:"IL_License_Renewal_2024.pdf",
    file_type:"pdf", doc_type:"license",
    upload_source:"direct_upload", drive_url:"#",
    processing_status:"complete", processing_type:"archive",
    groq_classification:"license",
    tables_updated:["documents"],
    records_created:0, uploaded_at:"Oct 15, 2024",
    processed_at:"Oct 15, 2024",
    notes:"IL Producer License renewal certificate. Expires October 2026.",
    size:"156 KB",
  },
  {
    id:"d9",  file_name:"feb_payroll_export.csv",
    file_type:"csv", doc_type:"payroll_export",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"complete", processing_type:"database_import",
    groq_classification:"payroll_export",
    tables_updated:["payroll_runs","payroll_detail"],
    records_created:4, uploaded_at:"Mar 5 9:30 AM",
    processed_at:"Mar 5 9:32 AM",
    notes:"February 16-28 payroll. 3 staff.",
    size:"17 KB",
  },
  {
    id:"d10", file_name:"mystery_document.pdf",
    file_type:"pdf", doc_type:"other",
    upload_source:"email_auto", drive_url:"#",
    processing_status:"failed", processing_type:"database_import",
    groq_classification:null,
    tables_updated:[],
    records_created:0, uploaded_at:"Apr 20 4:15 PM",
    processed_at:"Apr 20 4:17 PM",
    notes:"Groq could not classify this document. File saved to Drive for manual review.",
    size:"2.1 MB",
  },
];

const MOCK_INTAKE_LOG = [
  { id:"i1", date:"Apr 26", time:"2:28 PM", file:"SF_COMP_April_2026.pdf",     source:"Email — State Farm",          status:"complete", type:"comp_recap",      tables:["comp_recap","aipp_tracking"],   records:5  },
  { id:"i2", date:"Apr 26", time:"9:12 AM", file:"resume_jamie_chen.pdf",       source:"Email — Jamie Chen",          status:"complete", type:"resume",          tables:["applicants","documents"],       records:1  },
  { id:"i3", date:"Apr 25", time:"10:14 AM",file:"april_payroll_export.csv",    source:"Email — Gusto",               status:"complete", type:"payroll_export",  tables:["payroll_runs","payroll_detail"],records:4  },
  { id:"i4", date:"Apr 20", time:"4:15 PM", file:"mystery_document.pdf",        source:"Email — Unknown",             status:"failed",   type:null,              tables:[],                               records:0  },
  { id:"i5", date:"Apr 15", time:"2:58 PM", file:"chase_march_statement.pdf",   source:"Email — Chase",               status:"partial",  type:"bank_statement",  tables:["journal_entries"],              records:18 },
  { id:"i6", date:"Apr 5",  time:"11:20 AM",file:"SF_COMP_March_2026.pdf",      source:"Email — State Farm",          status:"complete", type:"comp_recap",      tables:["comp_recap","aipp_tracking"],   records:4  },
  { id:"i7", date:"Apr 1",  time:"3:45 PM", file:"q1_tax_estimate_2026.pdf",    source:"Email — Club Capital Tax",    status:"complete", type:"tax_document",    tables:["documents"],                    records:0  },
];

// ─── Helpers ──────────────────────────────────────────────────
const statusConfig = (s) => ({
  complete: { color:"#065F46", bg:T.greenLt, label:"Complete" },
  partial:  { color:"#92400E", bg:T.amberLt, label:"Partial"  },
  failed:   { color:"#991B1B", bg:T.redLt,   label:"Failed"   },
  pending:  { color:"#1E40AF", bg:T.blueLt,  label:"Pending"  },
  archive:  { color:T.slate500,bg:T.slate100,label:"Archived" },
}[s] || { color:T.slate500, bg:T.slate100, label:s });

const sourceConfig = (s) => ({
  email_auto:    { label:"Auto — Email",    color:T.green,  icon:"📧" },
  direct_upload: { label:"Manual Upload",   color:T.blue,   icon:"⬆️" },
  drive:         { label:"Google Drive",    color:T.amber,  icon:"📁" },
}[s] || { label:s, color:T.slate500, icon:"📄" });

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

const DocTypeBadge = ({ type }) => {
  const dt = DOC_TYPES[type] || DOC_TYPES.other;
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:dt.bg, color:dt.color, whiteSpace:"nowrap" }}>
      {dt.icon} {dt.label}
    </span>
  );
};

// ─── Document Card ────────────────────────────────────────────
const DocCard = ({ doc, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const sc  = statusConfig(doc.processing_type === "archive" ? "archive" : doc.processing_status);
  const src = sourceConfig(doc.upload_source);
  const dt  = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;

  return (
    <div style={{
      background:T.white,
      border:`1px solid ${expanded?T.blue:T.slate200}`,
      borderLeft:`4px solid ${dt.color}`,
      borderRadius:10, overflow:"hidden",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", cursor:"pointer" }} onClick={() => setExpanded(e=>!e)}>
        {/* File icon */}
        <div style={{ width:36, height:36, borderRadius:8, background:dt.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {dt.icon}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.slate900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>
            {doc.file_name}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <DocTypeBadge type={doc.doc_type} />
            <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:20, background:src.color+"20", color:src.color }}>{src.icon} {src.label}</span>
            <span style={{ fontSize:10, color:T.slate400 }}>{doc.uploaded_at} · {doc.size}</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:sc.bg, color:sc.color }}>{sc.label}</span>
          {doc.processing_type === "database_import" && doc.records_created > 0 && (
            <span style={{ fontSize:10, color:T.slate400 }}>{doc.records_created} records</span>
          )}
          <span style={{ color:T.slate400, fontSize:11 }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:"0 14px 14px", borderTop:`1px solid ${T.slate100}` }}>
          {/* Details Grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:8, marginTop:10, marginBottom:12 }}>
            {[
              { label:"File Type",     value:doc.file_type.toUpperCase() },
              { label:"Source",        value:src.label },
              { label:"Uploaded",      value:doc.uploaded_at },
              { label:"Processed",     value:doc.processed_at },
              { label:"Import Type",   value:doc.processing_type === "database_import" ? "Database Import" : doc.processing_type === "archive" ? "Archived" : "Claude Context" },
              { label:"Records Created",value:doc.records_created.toString() },
            ].map((d,i) => (
              <div key={i} style={{ background:T.slate50, borderRadius:8, padding:"7px 10px" }}>
                <div style={{ fontSize:9, color:T.slate400, marginBottom:2 }}>{d.label}</div>
                <div style={{ fontSize:11, fontWeight:500, color:T.slate700 }}>{d.value}</div>
              </div>
            ))}
          </div>

          {/* Tables Updated */}
          {doc.tables_updated?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:T.slate400, marginBottom:4 }}>TABLES UPDATED</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {doc.tables_updated.map((t,i) => (
                  <span key={i} style={{ fontSize:10, fontFamily:"monospace", padding:"3px 8px", borderRadius:5, background:T.greenLt, color:"#065F46", fontWeight:500 }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {doc.notes && (
            <div style={{ fontSize:11, color:T.slate600, lineHeight:1.6, marginBottom:10, padding:"8px 10px", background:T.slate50, borderRadius:8 }}>
              {doc.notes}
            </div>
          )}

          {/* Status warnings */}
          {doc.processing_status === "partial" && (
            <div style={{ fontSize:11, color:"#92400E", background:T.amberLt, padding:"8px 10px", borderRadius:6, marginBottom:10 }}>
              ⚠ Partial import — some pages could not be parsed. Check Google Drive for the saved file and review manually.
            </div>
          )}
          {doc.processing_status === "failed" && (
            <div style={{ fontSize:11, color:"#991B1B", background:T.redLt, padding:"8px 10px", borderRadius:6, marginBottom:10 }}>
              🔴 Import failed — Groq could not classify this document. File saved to Google Drive. Review manually or re-upload with a clearer document.
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {(doc.drive_url || doc.google_drive_file_id) && (
              <button 
                onClick={() => {
                  const url = doc.drive_url || (doc.google_drive_file_id ? `https://drive.google.com/file/d/${doc.google_drive_file_id}/view` : null);
                  if (url) window.open(url, "_blank");
                  else alert("No Google Drive link available for this document.");
                }}
                style={{ padding:"6px 14px", fontSize:11, fontWeight:600, color:T.amber, background:T.amberLt, border:"none", borderRadius:7, cursor:"pointer" }}>
                📁 Open in Drive
              </button>
            )}
            <AskBtn size="small" context={`Document in my BCC:\nFile: ${doc.file_name}\nType: ${DOC_TYPES[doc.doc_type]?.label||doc.doc_type}\nSource: ${doc.upload_source}\nStatus: ${doc.processing_status}\nProcessed: ${doc.processed_at}\nTables updated: ${doc.tables_updated?.join(", ")||"None"}\nRecords created: ${doc.records_created}\nNotes: ${doc.notes}\n\nHelp me understand this document and verify the data was imported correctly. Are there any follow-up actions needed?`} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Section: Overview ────────────────────────────────────────
const DocumentsOverview = ({ documents, onNavigate }) => {
  const complete = documents.filter(d => d.processing_status === "complete").length;
  const partial  = documents.filter(d => d.processing_status === "partial").length;
  const failed   = documents.filter(d => d.processing_status === "failed").length;
  const total    = documents.length;

  const byType = Object.keys(DOC_TYPES).map(type => ({
    type, count:documents.filter(d => d.doc_type === type).length,
  })).filter(t => t.count > 0);

  const recent = documents.slice(0, 5);

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Total Documents", value:total,    color:T.navy,  border:T.navy  },
          { label:"Complete",        value:complete, color:T.green, border:T.green },
          { label:"Partial Import",  value:partial,  color:partial>0?T.amber:T.green, border:partial>0?T.amber:T.green },
          { label:"Failed",          value:failed,   color:failed>0?T.red:T.green,   border:failed>0?T.red:T.green   },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderTop:`3px solid ${k.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color, letterSpacing:"-0.02em" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Alerts for failed/partial */}
      {(failed > 0 || partial > 0) && (
        <div style={{ background:T.amberLt, border:`1px solid #FCD34D`, borderLeft:`4px solid ${T.amber}`, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#92400E", marginBottom:4 }}>⚠ Documents Needing Attention</div>
          {failed  > 0 && <div style={{ fontSize:11, color:"#92400E", marginBottom:2 }}>• {failed} document{failed>1?"s":""} failed to import — review and re-upload</div>}
          {partial > 0 && <div style={{ fontSize:11, color:"#92400E" }}>• {partial} document{partial>1?"s":""} partially imported — check Google Drive for unparsed pages</div>}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.4fr) minmax(0,1fr)", gap:12 }}>
        {/* Recent Documents */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Recently processed</span>
            <AskBtn size="small" context="Review my recent document imports. Are there any documents that need follow-up? Any data that should be verified against the GL?" />
          </div>
          {recent.map((doc,i) => {
            const dt = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;
            const sc = statusConfig(doc.processing_type === "archive" ? "archive" : doc.processing_status);
            return (
              <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<recent.length-1?`1px solid ${T.slate100}`:"none" }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{dt.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:T.slate800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.file_name}</div>
                  <div style={{ fontSize:10, color:T.slate400 }}>{doc.uploaded_at} · {doc.size}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:sc.bg, color:sc.color, flexShrink:0 }}>{sc.label}</span>
              </div>
            );
          })}
        </Card>

        {/* Document Types Breakdown */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:12 }}>Library breakdown by type</div>
          {byType.map((t,i) => {
            const dt = DOC_TYPES[t.type];
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:i<byType.length-1?`1px solid ${T.slate100}`:"none" }}>
                <span style={{ fontSize:18 }}>{dt.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:T.slate700 }}>{dt.label}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:T.slate900 }}>{t.count}</span>
              </div>
            );
          })}

          {/* How auto-intake works */}
          <div style={{ marginTop:14, padding:"10px 12px", background:T.blueLt, borderRadius:8, fontSize:11, color:T.slate600, lineHeight:1.6 }}>
            📧 <strong>Auto-intake is active.</strong> Documents emailed to your Gmail are detected hourly, saved to Drive, classified by Groq, and loaded to the correct tables automatically.
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section: Library ─────────────────────────────────────────
const DocumentLibrary = ({ documents }) => {
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");

  const filtered = useMemo(() => documents.filter(d => {
    if (typeFilter   !== "all" && d.doc_type       !== typeFilter)   return false;
    if (sourceFilter !== "all" && d.upload_source  !== sourceFilter) return false;
    if (statusFilter !== "all" && d.processing_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.file_name.toLowerCase().includes(q) || (d.notes||"").toLowerCase().includes(q);
    }
    return true;
  }), [documents, typeFilter, sourceFilter, statusFilter, search]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
          style={{ flex:1, minWidth:160, padding:"8px 12px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", background:T.white }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Types</option>
          {Object.keys(DOC_TYPES).map(t => <option key={t} value={t}>{DOC_TYPES[t].icon} {DOC_TYPES[t].label}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Sources</option>
          <option value="email_auto">Auto — Email</option>
          <option value="direct_upload">Manual Upload</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Status</option>
          <option value="complete">Complete</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div style={{ fontSize:11, color:T.slate400, marginBottom:10 }}>
        Showing {filtered.length} of {documents.length} documents
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:T.slate400, fontSize:13 }}>No documents match your filters.</div>
        ) : filtered.map(doc => (
          <DocCard key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
};

// ─── Section: Intake Log ──────────────────────────────────────
const IntakeLog = ({ log }) => (
  <Card>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
      <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Document intake log</div>
      <AskBtn size="small" context="Review my document intake log. Are there any gaps in my financial document history? What documents should I be sending that I haven't sent yet?" />
    </div>
    <div style={{ fontSize:11, color:T.slate500, marginBottom:16 }}>Everything received, when it arrived, and what it loaded</div>

    {/* How it works */}
    <div style={{ display:"flex", gap:0, marginBottom:16, borderRadius:10, overflow:"hidden", border:`1px solid ${T.slate200}` }}>
      {[
        { step:"1", label:"Email arrives",    sub:"to your Gmail"        },
        { step:"2", label:"Composio detects", sub:"attachment scanned"   },
        { step:"3", label:"Groq classifies",  sub:"free, no API key"     },
        { step:"4", label:"Data loaded",      sub:"correct Supabase tables"},
        { step:"5", label:"Drive filed",      sub:"correct folder/year"  },
      ].map((s,i) => (
        <div key={i} style={{ flex:1, padding:"8px 4px", textAlign:"center", background:i%2===0?T.slate50:T.white, borderRight:i<4?`1px solid ${T.slate200}`:"none" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.blue }}>{s.step}</div>
          <div style={{ fontSize:9, fontWeight:600, color:T.slate700 }}>{s.label}</div>
          <div style={{ fontSize:9, color:T.slate400 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    <table style={{ width:"100%", borderCollapse:"collapse" }}>
      <thead>
        <tr style={{ borderBottom:`1px solid ${T.slate200}` }}>
          {["Date","File","Source","Type","Tables Updated","Records","Status"].map((h,i) => (
            <th key={i} style={{ padding:"8px", fontSize:11, fontWeight:600, color:T.slate500, textAlign:"left" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {log.map((item,i) => {
          const dt = DOC_TYPES[item.type] || DOC_TYPES.other;
          const sc = statusConfig(item.status);
          return (
            <tr key={item.id} style={{ borderBottom:`1px solid ${T.slate100}` }}>
              <td style={{ padding:"9px 8px", fontSize:11, color:T.slate500, whiteSpace:"nowrap" }}>{item.date} {item.time}</td>
              <td style={{ padding:"9px 8px", fontSize:11, color:T.slate800, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.file}</td>
              <td style={{ padding:"9px 8px", fontSize:11, color:T.slate600 }}>{item.source}</td>
              <td style={{ padding:"9px 8px" }}>
                {item.type ? <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:dt.bg, color:dt.color }}>{dt.icon} {dt.label}</span> : <span style={{ fontSize:10, color:T.slate400 }}>Unknown</span>}
              </td>
              <td style={{ padding:"9px 8px", fontSize:10, color:T.slate500 }}>{item.tables.join(", ")||"—"}</td>
              <td style={{ padding:"9px 8px", fontSize:11, fontWeight:600, color:T.slate900, textAlign:"center" }}>{item.records||"—"}</td>
              <td style={{ padding:"9px 8px" }}><span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:sc.bg, color:sc.color }}>{sc.label}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </Card>
);

// ─── Section: Upload ──────────────────────────────────────────
const UploadSection = () => {
  const [uploadPath, setUploadPath] = useState(null);
  const [dragOver,   setDragOver]   = useState(false);

  return (
    <div>
      <div style={{ fontSize:13, color:T.slate500, marginBottom:16, lineHeight:1.6 }}>
        Choose how you want to use this document. Documents can go to your database for permanent storage, or to Claude Chat for a one-time conversation.
      </div>

      {/* Path Selection */}
      {!uploadPath && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {/* Path A */}
          <div
            onClick={() => setUploadPath("database")}
            style={{ border:`2px solid ${T.slate200}`, borderRadius:14, padding:"24px 20px", cursor:"pointer", transition:"all 0.15s", background:T.white }}
            onMouseEnter={e => e.currentTarget.style.borderColor=T.green}
            onMouseLeave={e => e.currentTarget.style.borderColor=T.slate200}
          >
            <div style={{ fontSize:32, marginBottom:12 }}>🗄️</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.slate900, marginBottom:6 }}>Upload to Database</div>
            <div style={{ fontSize:12, color:T.slate500, lineHeight:1.7, marginBottom:12 }}>
              Document is processed by Groq, classified, and data is loaded to the correct Supabase tables. Saved permanently to Google Drive. Logged in your document library.
            </div>
            <div style={{ fontSize:11, color:T.green, fontWeight:600 }}>Best for: COMP_RECAP, payroll, bank statements, resumes, tax documents</div>
          </div>

          {/* Path B */}
          <div
            onClick={() => setUploadPath("chat")}
            style={{ border:`2px solid ${T.slate200}`, borderRadius:14, padding:"24px 20px", cursor:"pointer", transition:"all 0.15s", background:T.white }}
            onMouseEnter={e => e.currentTarget.style.borderColor=T.blue}
            onMouseLeave={e => e.currentTarget.style.borderColor=T.slate200}
          >
            <div style={{ fontSize:32, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.slate900, marginBottom:6 }}>Upload to Claude Chat</div>
            <div style={{ fontSize:12, color:T.slate500, lineHeight:1.7, marginBottom:12 }}>
              Document is passed to Claude as temporary conversation context. Not saved to your database unless Claude extracts and stores specific data. Use for quick analysis.
            </div>
            <div style={{ fontSize:11, color:T.blue, fontWeight:600 }}>Best for: one-off analysis, contract review, quick questions about a document</div>
          </div>
        </div>
      )}

      {/* Upload Path A — Database */}
      {uploadPath === "database" && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.slate900 }}>🗄️ Upload to Database</div>
              <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>Groq will classify and route data to correct tables</div>
            </div>
            <button onClick={() => setUploadPath(null)} style={{ fontSize:11, color:T.slate500, background:"none", border:`1px solid ${T.slate200}`, borderRadius:7, padding:"5px 10px", cursor:"pointer" }}>← Back</button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); }}
            style={{
              border:`2px dashed ${dragOver?T.green:T.slate300}`,
              borderRadius:12, padding:"40px 20px",
              textAlign:"center", cursor:"pointer",
              background:dragOver?T.greenLt:T.slate50,
              transition:"all 0.15s", marginBottom:16,
            }}
            onClick={() => document.getElementById("file-input-db")?.click()}
          >
            <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.slate700, marginBottom:4 }}>Drop your document here or click to browse</div>
            <div style={{ fontSize:11, color:T.slate400 }}>PDF, CSV, XLSX, DOCX — max 25MB</div>
            <input id="file-input-db" type="file" accept=".pdf,.csv,.xlsx,.docx" style={{ display:"none" }} />
          </div>

          {/* Processing Flow Preview */}
          <div style={{ background:T.slate50, borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.slate700, marginBottom:8 }}>What happens after you upload:</div>
            {[
              { step:"1", text:"Groq reads and classifies the document type" },
              { step:"2", text:"Data is extracted and mapped to the correct Supabase tables" },
              { step:"3", text:"Document is saved to your Google Drive in the correct folder" },
              { step:"4", text:"Import is logged with tables updated and records created" },
              { step:"5", text:"You receive an alert confirming what loaded (or flagging any issues)" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", gap:10, marginBottom:i<4?6:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.blue, flexShrink:0, width:16 }}>{s.step}</span>
                <span style={{ fontSize:11, color:T.slate600 }}>{s.text}</span>
              </div>
            ))}
          </div>

          {/* Supported types */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:T.slate600, marginBottom:8 }}>Supported document types:</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["comp_recap","payroll_export","bank_statement","tax_document","resume","aipp_report","eo_insurance","license"].map(t => (
                <span key={t} style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:DOC_TYPES[t].bg, color:DOC_TYPES[t].color }}>
                  {DOC_TYPES[t].icon} {DOC_TYPES[t].label}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Upload Path B — Claude Chat */}
      {uploadPath === "chat" && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.slate900 }}>💬 Upload to Claude Chat</div>
              <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>Document becomes context for your next Claude conversation</div>
            </div>
            <button onClick={() => setUploadPath(null)} style={{ fontSize:11, color:T.slate500, background:"none", border:`1px solid ${T.slate200}`, borderRadius:7, padding:"5px 10px", cursor:"pointer" }}>← Back</button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); }}
            style={{
              border:`2px dashed ${dragOver?T.blue:T.slate300}`,
              borderRadius:12, padding:"40px 20px",
              textAlign:"center", cursor:"pointer",
              background:dragOver?T.blueLt:T.slate50,
              transition:"all 0.15s", marginBottom:16,
            }}
            onClick={() => document.getElementById("file-input-chat")?.click()}
          >
            <div style={{ fontSize:36, marginBottom:8 }}>💬</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.slate700, marginBottom:4 }}>Drop your document here or click to browse</div>
            <div style={{ fontSize:11, color:T.slate400 }}>PDF, DOCX — max 10MB</div>
            <input id="file-input-chat" type="file" accept=".pdf,.docx" style={{ display:"none" }} />
          </div>

          {/* What happens */}
          <div style={{ background:T.blueLt, border:`1px solid ${T.blue}20`, borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.navy, marginBottom:8 }}>What happens after you upload:</div>
            {[
              { step:"1", text:"Document is attached to your next Claude.ai conversation" },
              { step:"2", text:"Claude can read, analyze, and answer questions about it" },
              { step:"3", text:"Not saved to your Supabase database automatically" },
              { step:"4", text:"If Claude finds data worth saving, it can write to your database during the conversation" },
              { step:"5", text:"Use for: contract review, one-off analysis, understanding a document before deciding to import it" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", gap:10, marginBottom:i<4?6:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.blue, flexShrink:0, width:16 }}>{s.step}</span>
                <span style={{ fontSize:11, color:T.slate600 }}>{s.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { window.open("https://claude.ai","_blank"); }}
            style={{ width:"100%", padding:"11px", fontSize:12, fontWeight:700, color:T.white, background:T.blue, border:"none", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
          >
            ⚡ Open Claude.ai to upload and discuss this document
          </button>
        </Card>
      )}

      {/* Email reminder */}
      {!uploadPath && (
        <div style={{ background:T.greenLt, border:`1px solid #BBF7D0`, borderLeft:`4px solid ${T.green}`, borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#065F46", marginBottom:4 }}>📧 Easier option: just email it</div>
          <div style={{ fontSize:11, color:"#065F46", lineHeight:1.6 }}>
            The fastest way to get a document into your BCC is to email it to your agency Gmail. The Document Importer checks hourly and processes it automatically — no manual upload needed. COMP_RECAP, payroll exports, bank statements, resumes — just forward the email.
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Documents Module ────────────────────────────────────
export default function Documents() {
  const [section, setSection] = useState("overview");
  const { data: liveDocs, loading: docsLoading } = useSupabaseTable("documents", AGENCY_ID, { orderBy: "uploaded_at", ascending: false });
  const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== "false";
  const documents = (liveDocs && liveDocs.length > 0)
    ? liveDocs
    : useMockData ? MOCK_DOCUMENTS : [];

  const sections = [
    { id:"overview", label:"Overview"   },
    { id:"library",  label:"Library"    },
    { id:"intake",   label:"Intake Log" },
    { id:"upload",   label:"Upload"     },
  ];

  if (docsLoading) return <div style={{padding:40,textAlign:"center",fontSize:13,color:"#64748B"}}>Loading documents…</div>;
  if (documents.length === 0) return <EmptyState module="documents" />;

  return (
    <div>
      {/* Module Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>Documents</div>
          <div style={{ fontSize:12, color:T.slate500, marginTop:3 }}>
            {documents.length} documents · Auto-intake active · Groq processing · Google Drive filing
          </div>
        </div>
        <AskBtn context="Review my document library. Are there any gaps in my financial document history? What documents should I have that I might be missing? What needs follow-up?" />
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
      {section === "overview" && <DocumentsOverview documents={documents} />}
      {section === "library"  && <DocumentLibrary  documents={documents} />}
      {section === "intake"   && <IntakeLog         log={MOCK_INTAKE_LOG} />}
      {section === "upload"   && <UploadSection />}
    </div>
  );
}

