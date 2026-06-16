import { useState, useMemo, useEffect, useRef } from "react";
import { supabase, AGENCY_ID } from "../lib/supabase.js";

// ============================================================
// BCC SOCIAL MEDIA MODULE v1.0
// Business Command Center — State Farm Agent Edition
// Built by Imaginary Farms LLC · imaginary-farms.com
//
// SECTIONS:
//   1. Overview      — Platform health, today's posts, weekly stats
//   2. Calendar      — Full content calendar with status tracking
//   3. Analytics     — Engagement by platform and post type
//   4. Platforms     — Per-platform rules, accounts, settings
//   5. Create        — Compliance-aware content request to Claude
//
// KEY RULES ENFORCED IN THIS MODULE:
//   • Instagram requires manual daily posting — no API scheduling
//   • All content in English — FINRA archiving requirement
//   • No prohibited topics, pricing, or customer PII
//   • 80/20 rule — 80% value-first, 20% business-adjacent
//   • AI-generated visuals require disclaimer
//   • Pre-post checklist available before any post
//
// DATA: Reads content_calendar, social_accounts,
//       social_analytics tables in Supabase
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
  pink:    "#EC4899",
  pinkLt:  "#FCE7F3",
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

// ─── Platform Config ──────────────────────────────────────────
const PLATFORMS = {
  facebook:  { label:"Facebook",  color:"#1877F2", bg:"#E7F0FD", icon:"f",  scheduling:"Auto-scheduled",  frequency:"4-5 posts/week", best_time:"Tue-Thu 9-11AM" },
  instagram: { label:"Instagram", color:"#E1306C", bg:"#FCE7F3", icon:"ig", scheduling:"Manual only",      frequency:"4-5 posts/week + daily Stories", best_time:"Mon-Fri 11AM-1PM" },
  linkedin:  { label:"LinkedIn",  color:"#0A66C2", bg:"#E8F4FD", icon:"in", scheduling:"Auto-scheduled",  frequency:"2-3 posts/week", best_time:"Tue-Thu 8-10AM" },
  twitter:   { label:"X/Twitter", color:"#000000", bg:"#F1F5F9", icon:"X",  scheduling:"Auto-scheduled",  frequency:"1-2 tweets/day", best_time:"Weekdays 8-10AM" },
};

// ─── Content Pillars ──────────────────────────────────────────
const PILLARS = {
  educate:   { label:"Educate",   color:T.blue,   bg:T.blueLt   },
  community: { label:"Community", color:T.green,  bg:T.greenLt  },
  connect:   { label:"Connect",   color:T.purple, bg:T.purpleLt },
  celebrate: { label:"Celebrate", color:T.amber,  bg:T.amberLt  },
  invite:    { label:"Invite",    color:T.teal,   bg:T.tealLt   },
};

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_POSTS = [
  { id:"p1",  platform:"facebook",  date:"Apr 27", time:"9:00 AM",  status:"scheduled", pillar:"educate",   caption:"Monday motivation — your agency runs on relationships, not just policies. Here are 3 things every homeowner should review this spring... 🏠", requires_manual:false, engagement:null },
  { id:"p2",  platform:"linkedin",  date:"Apr 27", time:"12:00 PM", status:"scheduled", pillar:"connect",   caption:"3 things State Farm agents overlook in their Q2 planning — and what I do differently to stay ahead of the numbers.", requires_manual:false, engagement:null },
  { id:"p3",  platform:"instagram", date:"Apr 27", time:"11:00 AM", status:"scheduled", pillar:"connect",   caption:"Behind the scenes at the agency this Monday morning. Coffee, team huddle, and a full week ahead. ☕", requires_manual:true, engagement:null },
  { id:"p4",  platform:"facebook",  date:"Apr 26", time:"9:00 AM",  status:"posted",    pillar:"community", caption:"Huge shoutout to the Sarasota Food Bank for their incredible work this month. Proud to support our community! 🙌", requires_manual:false, engagement:{ likes:42, comments:8, shares:6, reach:680 } },
  { id:"p5",  platform:"linkedin",  date:"Apr 26", time:"12:00 PM", status:"posted",    pillar:"educate",   caption:"The biggest financial mistake I see new homeowners make — and it's easier to fix than you think.", requires_manual:false, engagement:{ likes:31, comments:4, shares:2, reach:410 } },
  { id:"p6",  platform:"instagram", date:"Apr 26", time:"11:00 AM", status:"posted",    pillar:"community", caption:"Saturday morning walk through Lakewood Ranch. This community never gets old. 🌿", requires_manual:true, engagement:{ likes:89, comments:12, shares:0, reach:920 } },
  { id:"p7",  platform:"facebook",  date:"Apr 25", time:"9:00 AM",  status:"posted",    pillar:"celebrate", caption:"Happy work anniversary to Marcus! 4 years of helping Sarasota families feel confident about their coverage. 🎉", requires_manual:false, engagement:{ likes:67, comments:22, shares:3, reach:1100 } },
  { id:"p8",  platform:"facebook",  date:"Apr 24", time:"9:00 AM",  status:"posted",    pillar:"educate",   caption:"Spring storm season reminder — here are 4 things every Florida homeowner should check before June 1st.", requires_manual:false, engagement:{ likes:38, comments:5, shares:11, reach:820 } },
  { id:"p9",  platform:"instagram", date:"Apr 25", time:"11:00 AM", status:"failed",    pillar:"celebrate", caption:"Team Friday! Celebrating Marcus's work anniversary at lunch today. 🎂", requires_manual:true, engagement:null },
  { id:"p10", platform:"twitter",   date:"Apr 26", time:"9:00 AM",  status:"posted",    pillar:"educate",   caption:"Florida homeowners: your policy probably doesn't cover flooding. Worth a 5-minute conversation to find out for sure.", requires_manual:false, engagement:{ likes:18, comments:3, shares:7, reach:290 } },
  { id:"p11", platform:"facebook",  date:"Apr 28", time:"9:00 AM",  status:"draft",     pillar:"community", caption:"Local Love Tuesday — this week we're spotlighting a favorite local business in the area...", requires_manual:false, engagement:null },
  { id:"p12", platform:"linkedin",  date:"Apr 29", time:"12:00 PM", status:"draft",     pillar:"educate",   caption:"Thursday Thoughts: what the best-run independent insurance agencies have in common.", requires_manual:false, engagement:null },
  { id:"p13", platform:"facebook",  date:"Apr 30", time:"9:00 AM",  status:"draft",     pillar:"invite",    caption:"End of April — if you haven't done a policy review this year, my door is always open. No pressure, just a conversation.", requires_manual:false, engagement:null },
  { id:"p14", platform:"instagram", date:"Apr 28", time:"11:00 AM", status:"draft",     pillar:"educate",   caption:"Myth Monday: does a red car actually cost more to insure? Let's bust this one. 🚗❓", requires_manual:true, engagement:null },
];

const MOCK_ANALYTICS = {
  this_week: { total_posts:8, total_reach:4220, total_likes:285, total_comments:54, total_shares:29 },
  last_week: { total_posts:7, total_reach:3890, total_likes:241, total_comments:41, total_shares:21 },
  by_platform: [
    { platform:"facebook",  posts:4, reach:2600, likes:147, comments:35, shares:20, best_post:"Marcus anniversary" },
    { platform:"instagram", posts:2, reach:1420, likes:101, comments:12, shares:0,  best_post:"Saturday walk" },
    { platform:"linkedin",  posts:1, reach:410,  likes:31,  comments:4,  shares:2,  best_post:"Homeowner mistake" },
    { platform:"twitter",   posts:1, reach:290,  likes:18,  comments:3,  shares:7,  best_post:"Flood coverage tip" },
  ],
  by_pillar: [
    { pillar:"educate",   posts:4, avg_reach:712, avg_likes:28 },
    { pillar:"community", posts:2, avg_reach:890, avg_likes:55 },
    { pillar:"connect",   posts:1, avg_reach:410, avg_likes:31 },
    { pillar:"celebrate", posts:1, avg_reach:1100,avg_likes:67 },
  ],
};

// ─── Shared Components ────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:T.white, border:`1px solid ${T.slate200}`, borderRadius:12, padding:"16px 18px", ...style }}>
    {children}
  </div>
);

const PlatformBadge = ({ platform, small=false }) => {
  const p = PLATFORMS[platform] || { label:platform, color:T.slate500, bg:T.slate100, icon:"?" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:small?9:10, fontWeight:700, padding:small?"2px 7px":"3px 9px", borderRadius:20, background:p.bg, color:p.color, whiteSpace:"nowrap" }}>
      {p.label}
    </span>
  );
};

const PillarBadge = ({ pillar }) => {
  const p = PILLARS[pillar] || { label:pillar, color:T.slate500, bg:T.slate100 };
  return (
    <span style={{ fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20, background:p.bg, color:p.color, whiteSpace:"nowrap" }}>
      {p.label}
    </span>
  );
};

const StatusBadge = ({ status, manual }) => {
  if (status === "scheduled" && manual) return (
    <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:T.purpleLt, color:T.purple, whiteSpace:"nowrap" }}>Manual needed</span>
  );
  const map = {
    scheduled:{ bg:T.blueLt,   color:"#1E40AF", label:"Scheduled" },
    posted:   { bg:T.greenLt,  color:"#065F46", label:"Posted"    },
    failed:   { bg:T.redLt,    color:"#991B1B", label:"Failed"    },
    draft:    { bg:T.slate100, color:T.slate500, label:"Draft"     },
  };
  const s = map[status] || { bg:T.slate100, color:T.slate500, label:status };
  return <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color, whiteSpace:"nowrap" }}>{s.label}</span>;
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

// ─── Mini Stat Bar ────────────────────────────────────────────
const StatBar = ({ value, max, color }) => (
  <div style={{ height:6, background:T.slate100, borderRadius:3, overflow:"hidden", marginTop:4 }}>
    <div style={{ height:"100%", width:`${Math.min(100,(value/max)*100)}%`, background:color, borderRadius:3, transition:"width 0.6s ease" }} />
  </div>
);

// ─── Section: Overview ────────────────────────────────────────
const SocialOverview = ({ posts, analytics }) => {
  // Dynamic today filter — formats current date as "Mon DD" to match post date format
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const todayPosts = posts.filter(p => p.date === todayLabel);
  const scheduledThisWeek = posts.filter(p => p.status === "scheduled" || p.status === "draft").length;
  const failedRecent = posts.filter(p => p.status === "failed").length;
  const manualNeeded = posts.filter(p => p.status === "scheduled" && p.requires_manual).length;

  const weekChange = {
    reach: Math.round(((analytics.this_week.total_reach - analytics.last_week.total_reach) / analytics.last_week.total_reach) * 100),
    likes: Math.round(((analytics.this_week.total_likes - analytics.last_week.total_likes) / analytics.last_week.total_likes) * 100),
  };

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
        {[
          { label:"Posts This Week",    value:analytics.this_week.total_posts,  color:T.blue,  border:T.blue  },
          { label:"Total Reach",        value:analytics.this_week.total_reach.toLocaleString(), color:T.green, border:T.green, sub:`↑${weekChange.reach}% vs last week` },
          { label:"Drafts Scheduled",   value:scheduledThisWeek, color:T.amber, border:T.amber },
          { label:"Manual Posts Needed",value:manualNeeded,      color:manualNeeded>0?T.purple:T.green, border:manualNeeded>0?T.purple:T.green },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderTop:`3px solid ${k.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.color, letterSpacing:"-0.02em" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:10, color:T.green, marginTop:2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Instagram Reminder */}
      {manualNeeded > 0 && (
        <div style={{ background:T.purpleLt, border:`1px solid #DDD6FE`, borderLeft:`4px solid ${T.purple}`, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>📸</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#5B21B6", marginBottom:2 }}>Instagram requires manual posting today</div>
            <div style={{ fontSize:11, color:"#6D28D9" }}>{manualNeeded} Instagram {manualNeeded===1?"post":"posts"} scheduled — must be posted manually. Instagram API does not support auto-scheduling.</div>
          </div>
        </div>
      )}

      {/* Failed Post Alert */}
      {failedRecent > 0 && (
        <div style={{ background:T.redLt, border:`1px solid #FECACA`, borderLeft:`4px solid ${T.red}`, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#991B1B", marginBottom:2 }}>⚠️ Failed post detected</div>
          <div style={{ fontSize:11, color:"#991B1B" }}>1 Instagram post failed on Apr 25. Review the calendar and repost manually.</div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
        {/* Today's Posts */}
        
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button onClick={()=>setShowScheduler(s=>!s)} style={{padding:"8px 16px",fontSize:12,fontWeight:600,background:"#1E3A5F",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>➕ Schedule New Post</button>
      </div>
<Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Today — Monday April 27</span>
            <AskBtn size="small" context={`Today's social media posts:\n${todayPosts.map(p=>`${p.platform.toUpperCase()} at ${p.time}: "${p.caption}" — Status: ${p.status}${p.requires_manual?" (MANUAL POSTING REQUIRED)":""}`).join("\n")}\n\nHelp me review today's content for compliance and engagement quality. Check against the 80/20 rule and the pre-post checklist.`} />
          </div>
          {todayPosts.length === 0 ? (
            <div style={{ fontSize:12, color:T.slate400, textAlign:"center", padding:"20px 0" }}>No posts scheduled for today</div>
          ) : todayPosts.map((post,i) => (
            <div key={post.id} style={{ padding:"9px 0", borderBottom:i<todayPosts.length-1?`1px solid ${T.slate100}`:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <PlatformBadge platform={post.platform} />
                <span style={{ fontSize:10, color:T.slate400 }}>{post.time}</span>
                <StatusBadge status={post.status} manual={post.requires_manual} />
              </div>
              <div style={{ fontSize:11, color:T.slate700, lineHeight:1.5, marginBottom:6 }}>{post.caption}</div>
              <div style={{ display:"flex", gap:6 }}>
                {post.status === "draft" && (
                  <button onClick={()=>approvePost(post.id)} style={{padding:"3px 10px",fontSize:10,fontWeight:600,background:"#DCFCE7",color:"#16A34A",border:"none",borderRadius:5,cursor:"pointer"}}>
                    ✅ Approve
                  </button>
                )}
                <button onClick={()=>setEditingPost(post)} style={{padding:"3px 10px",fontSize:10,fontWeight:600,background:"#DBEAFE",color:"#2563EB",border:"none",borderRadius:5,cursor:"pointer"}}>
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:12 }}>This week by platform</div>
          {analytics.by_platform.map((p,i) => (
            <div key={i} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <PlatformBadge platform={p.platform} />
                <div style={{ display:"flex", gap:12 }}>
                  <span style={{ fontSize:10, color:T.slate500 }}>{p.posts} posts</span>
                  <span style={{ fontSize:10, color:T.slate500 }}>{p.reach.toLocaleString()} reach</span>
                  <span style={{ fontSize:10, fontWeight:600, color:T.slate700 }}>{p.likes} ❤️</span>
                </div>
              </div>
              <StatBar value={p.reach} max={analytics.this_week.total_reach} color={PLATFORMS[p.platform]?.color || T.blue} />
            </div>
          ))}
        </Card>
      </div>

      {/* 80/20 Rule Check */}
      <Card style={{ marginTop:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>80/20 Content Mix — This Month</div>
            <div style={{ fontSize:11, color:T.slate500, marginTop:2 }}>80% value-first · 20% business-adjacent · Never hard-sell</div>
          </div>
          <AskBtn size="small" context="Review my social media content mix for this month. Am I following the 80/20 rule correctly? 80% should be value-first (educate, community, connect, celebrate) and max 20% business-adjacent (invite). Never hard-sell." />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {analytics.by_pillar.map((p,i) => {
            const pl = PILLARS[p.pillar];
            const pct = Math.round((p.posts / analytics.this_week.total_posts) * 100);
            return (
              <div key={i} style={{ flex:1, minWidth:100, background:pl?.bg||T.slate50, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:10, fontWeight:600, color:pl?.color||T.slate500, marginBottom:4 }}>{pl?.label||p.pillar}</div>
                <div style={{ fontSize:18, fontWeight:700, color:pl?.color||T.slate500 }}>{pct}%</div>
                <div style={{ fontSize:9, color:T.slate400, marginTop:2 }}>{p.posts} posts</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Content Calendar ────────────────────────────────
const ContentCalendar = ({ posts }) => {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [expanded,       setExpanded]       = useState(null);

  const filtered = useMemo(() => posts.filter(p => {
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (statusFilter   !== "all" && p.status   !== statusFilter)   return false;
    return true;
  }), [posts, platformFilter, statusFilter]);

  // Group by date
  const grouped = filtered.reduce((acc, post) => {
    if (!acc[post.date]) acc[post.date] = [];
    acc[post.date].push(post);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a,b) => {
    const order = ["Apr 30","Apr 29","Apr 28","Apr 27","Apr 26","Apr 25","Apr 24"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Platforms</option>
          {Object.keys(PLATFORMS).map(p => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding:"8px 10px", fontSize:12, color:T.slate700, border:`1px solid ${T.slate200}`, borderRadius:8, background:T.white, outline:"none" }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
          <option value="failed">Failed</option>
        </select>
        <AskBtn context={`I need help planning my social media content for next week. My content pillars are: Educate (Mon), Community (Tue), Connect (Wed), Educate/Celebrate (Thu), Invite/Celebrate (Fri). Platforms: Facebook (auto-schedule), LinkedIn (auto-schedule), Instagram (manual daily), X/Twitter. Remember: 80/20 rule, all content in English, no pricing or product specifics, no scare tactics. Help me draft 5 posts for next week.`} />
      </div>

      {/* Calendar */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {dates.map(date => (
          <div key={date}>
            {/* Date Header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:T.slate800 }}>{date}</span>
              <div style={{ flex:1, height:1, background:T.slate200 }} />
              <span style={{ fontSize:11, color:T.slate400 }}>{grouped[date].length} posts</span>
            </div>

            {/* Posts for this date */}
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {grouped[date].map(post => {
                const isExpanded = expanded === post.id;
                return (
                  <div
                    key={post.id}
                    style={{ background:T.white, border:`1px solid ${isExpanded?T.blue:T.slate200}`, borderLeft:`4px solid ${PLATFORMS[post.platform]?.color||T.slate300}`, borderRadius:8, overflow:"hidden" }}
                  >
                    <div
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }}
                      onClick={() => setExpanded(isExpanded?null:post.id)}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, flexWrap:"wrap" }}>
                          <PlatformBadge platform={post.platform} small />
                          <span style={{ fontSize:10, color:T.slate400 }}>{post.time}</span>
                          <PillarBadge pillar={post.pillar} />
                          {post.requires_manual && (
                            <span style={{ fontSize:9, fontWeight:600, padding:"2px 6px", borderRadius:20, background:T.purpleLt, color:T.purple }}>Manual</span>
                          )}
                        </div>
                        <div style={{ fontSize:12, color:T.slate700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{post.caption}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                        {post.engagement && (
                          <span style={{ fontSize:10, color:T.slate400 }}>❤️ {post.engagement.likes} · 💬 {post.engagement.comments} · 👁 {post.engagement.reach}</span>
                        )}
                        <StatusBadge status={post.status} manual={post.requires_manual} />
                        <span style={{ color:T.slate400, fontSize:12 }}>{isExpanded?"▲":"▼"}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding:"0 12px 12px", borderTop:`1px solid ${T.slate100}` }}>
                        <div style={{ fontSize:12, color:T.slate700, lineHeight:1.7, marginTop:10, marginBottom:10, fontStyle:"italic" }}>
                          "{post.caption}"
                        </div>
                        {post.engagement && (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:10 }}>
                            {[
                              { label:"Likes",    value:post.engagement.likes    },
                              { label:"Comments", value:post.engagement.comments },
                              { label:"Shares",   value:post.engagement.shares   },
                              { label:"Reach",    value:post.engagement.reach    },
                            ].map((s,i) => (
                              <div key={i} style={{ background:T.slate50, borderRadius:8, padding:"6px 8px", textAlign:"center" }}>
                                <div style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>{s.value}</div>
                                <div style={{ fontSize:9, color:T.slate400 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {post.status === "failed" && (
                          <div style={{ fontSize:11, color:"#991B1B", background:T.redLt, padding:"8px 10px", borderRadius:6, marginBottom:8 }}>
                            🔴 Post failed — repost manually or reschedule.
                          </div>
                        )}
                        <AskBtn size="small" context={`Social media post review:\nPlatform: ${post.platform}\nDate: ${post.date} at ${post.time}\nPillar: ${post.pillar}\nStatus: ${post.status}\nCaption: "${post.caption}"\n${post.engagement?`Engagement: ${post.engagement.likes} likes, ${post.engagement.comments} comments, ${post.engagement.shares} shares, ${post.engagement.reach} reach`:"No engagement data yet"}\n\nRun this post through the compliance pre-post checklist and tell me if anything needs to be changed. Also evaluate engagement quality.`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Section: Analytics ───────────────────────────────────────
const Analytics = ({ analytics }) => {
  const maxReach = Math.max(...analytics.by_platform.map(p => p.reach));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Weekly Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10 }}>
        {[
          { label:"Total Reach",    value:analytics.this_week.total_reach.toLocaleString(),    sub:`vs ${analytics.last_week.total_reach.toLocaleString()} last week`, up:true },
          { label:"Total Likes",    value:analytics.this_week.total_likes,    sub:`vs ${analytics.last_week.total_likes} last week`, up:true },
          { label:"Total Comments", value:analytics.this_week.total_comments, sub:`vs ${analytics.last_week.total_comments} last week`, up:true },
          { label:"Total Shares",   value:analytics.this_week.total_shares,   sub:`vs ${analytics.last_week.total_shares} last week`, up:true },
          { label:"Posts Published",value:analytics.this_week.total_posts,    sub:`vs ${analytics.last_week.total_posts} last week`, up:true },
        ].map((k,i) => (
          <div key={i} style={{ background:T.white, border:`1px solid ${T.slate200}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:T.slate500, fontWeight:500, marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>{k.value}</div>
            <div style={{ fontSize:10, color:T.green, marginTop:2 }}>↑ {k.sub}</div>
          </div>
        ))}
      </div>

      {/* By Platform */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.slate800 }}>Performance by platform — this week</div>
          <AskBtn size="small" context={`My social media analytics this week:\n${analytics.by_platform.map(p=>`${p.platform}: ${p.posts} posts, ${p.reach} reach, ${p.likes} likes, ${p.comments} comments, ${p.shares} shares. Best post: "${p.best_post}"`).join("\n")}\n\nAnalyze my platform performance. Which platform is performing best? What content is working? What should I focus on next week?`} />
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.slate200}` }}>
              {["Platform","Posts","Reach","Likes","Comments","Shares","Best Post"].map((h,i) => (
                <th key={i} style={{ padding:"8px", fontSize:11, fontWeight:600, color:T.slate500, textAlign:i>0?"right":"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analytics.by_platform.map((p,i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${T.slate100}` }}>
                <td style={{ padding:"10px 8px" }}><PlatformBadge platform={p.platform} /></td>
                <td style={{ padding:"10px 8px", fontSize:12, fontWeight:600, color:T.slate900, textAlign:"right" }}>{p.posts}</td>
                <td style={{ padding:"10px 8px", fontSize:12, color:T.slate700, textAlign:"right" }}>{p.reach.toLocaleString()}</td>
                <td style={{ padding:"10px 8px", fontSize:12, color:T.slate700, textAlign:"right" }}>{p.likes}</td>
                <td style={{ padding:"10px 8px", fontSize:12, color:T.slate700, textAlign:"right" }}>{p.comments}</td>
                <td style={{ padding:"10px 8px", fontSize:12, color:T.slate700, textAlign:"right" }}>{p.shares}</td>
                <td style={{ padding:"10px 8px", fontSize:11, color:T.slate500, textAlign:"right" }}>{p.best_post}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* By Pillar */}
      <Card>
        <div style={{ fontSize:13, fontWeight:600, color:T.slate800, marginBottom:14 }}>Performance by content pillar</div>
        {analytics.by_pillar.map((p,i) => {
          const pl = PILLARS[p.pillar];
          return (
            <div key={i} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <PillarBadge pillar={p.pillar} />
                <div style={{ display:"flex", gap:16 }}>
                  <span style={{ fontSize:11, color:T.slate500 }}>{p.posts} posts</span>
                  <span style={{ fontSize:11, color:T.slate500 }}>avg reach {p.avg_reach.toLocaleString()}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:T.slate700 }}>avg {p.avg_likes} likes</span>
                </div>
              </div>
              <StatBar value={p.avg_reach} max={1200} color={pl?.color||T.blue} />
            </div>
          );
        })}
        <div style={{ marginTop:8, padding:"10px 12px", background:T.greenLt, borderRadius:8, fontSize:11, color:"#065F46" }}>
          💡 Celebrate pillar (team spotlights, milestones) is your highest-performing content type this week with avg reach of 1,100. Consider featuring your team more frequently.
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Platform Guide ──────────────────────────────────
const PlatformGuide = () => (
  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    {Object.entries(PLATFORMS).map(([key, platform]) => (
      <Card key={key}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:platform.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:platform.color, flexShrink:0 }}>
            {platform.icon}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:T.slate900 }}>{platform.label}</span>
              <span style={{ fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20, background:key==="instagram"?T.purpleLt:T.greenLt, color:key==="instagram"?T.purple:"#065F46" }}>
                {platform.scheduling}
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:10 }}>
              {[
                { label:"Frequency",  value:platform.frequency  },
                { label:"Best time",  value:platform.best_time  },
                { label:"Scheduling", value:platform.scheduling },
              ].map((d,i) => (
                <div key={i} style={{ background:T.slate50, borderRadius:8, padding:"7px 10px" }}>
                  <div style={{ fontSize:9, color:T.slate400, marginBottom:2 }}>{d.label.toUpperCase()}</div>
                  <div style={{ fontSize:11, fontWeight:500, color:T.slate700 }}>{d.value}</div>
                </div>
              ))}
            </div>
            {key === "instagram" && (
              <div style={{ fontSize:11, color:"#5B21B6", background:T.purpleLt, padding:"8px 12px", borderRadius:8, lineHeight:1.6 }}>
                📸 <strong>Instagram requires manual daily posting.</strong> No reliable API scheduling exists. Batch-prepare your content in advance, but post each day manually. Your BCC sends a reminder alert each morning for scheduled Instagram posts.
              </div>
            )}
            {key === "facebook" && (
              <div style={{ fontSize:11, color:"#065F46", background:T.greenLt, padding:"8px 12px", borderRadius:8, lineHeight:1.6 }}>
                ✓ Facebook posts are auto-scheduled via Composio. Reply to every comment within 2 hours — the algorithm rewards active conversations. Never tag @StateFarm corporate in posts.
              </div>
            )}
            {key === "linkedin" && (
              <div style={{ fontSize:11, color:"#1E40AF", background:T.blueLt, padding:"8px 12px", borderRadius:8, lineHeight:1.6 }}>
                ✓ LinkedIn posts are auto-scheduled. Stay online for 60 minutes after posting to respond to comments — this signals the algorithm to push your post wider. Text-only posts get maximum reach.
              </div>
            )}
            {key === "twitter" && (
              <div style={{ fontSize:11, color:T.slate600, background:T.slate50, padding:"8px 12px", borderRadius:8, lineHeight:1.6 }}>
                ✓ X/Twitter posts are auto-scheduled. Engage for 10-15 minutes before posting your own content. Add links in replies, not in the tweet itself — external links reduce reach.
              </div>
            )}
          </div>
        </div>
      </Card>
    ))}
  </div>
);

// ─── Section: Create Content ──────────────────────────────────
const CreateContent = () => {
  const [platform,   setPlatform]   = useState("facebook");
  const [pillar,     setPillar]     = useState("educate");
  const [topic,      setTopic]      = useState("");
  const [copyDone,   setCopyDone]   = useState(false);

  const platformRules = {
    facebook:  "Facebook (4-5 posts/week, auto-scheduled, medium-long captions 100-300 words, 3-5 hashtags, warm neighborly tone, moderate emoji)",
    instagram: "Instagram (manual daily posting required, shorter captions 50-150 words, 20-25 hashtags in first comment, casual visual-first tone, 3-6 emoji, Reels get highest reach)",
    linkedin:  "LinkedIn (2-3 posts/week, auto-scheduled, longer 150-400 word posts, 3-5 hashtags, professional tone, minimal emoji, text-only posts get max reach)",
    twitter:   "X/Twitter (1-2 tweets/day, auto-scheduled, punchy and brief, 1-2 hashtags, put links in replies not tweets)",
  };

  const pillarGuidance = {
    educate:   "EDUCATE — Share tips, myth-busting, seasonal prep. NEVER mention specific products, pricing, or coverage details. Educate about concepts only.",
    community: "COMMUNITY — Local business spotlights, event recaps, community heroes. Tag local businesses (never @StateFarm). Community content is safest and highest-engagement.",
    connect:   "CONNECT — Personal stories, hobbies, office culture, team moments. Keep it authentic. Can reference being an agent naturally but never promote products.",
    celebrate: "CELEBRATE — Team milestones, customer appreciation (with written release), anniversaries, awards. Never mention policy details in celebrations.",
    invite:    "INVITE — Soft availability reminders only. 'My door is always open.' Never hard-sell. Never exceed 20% of total content.",
  };

  const complianceReminder = `COMPLIANCE RULES TO FOLLOW:
• Always say "customer" — NEVER "client" (AA05 I.B)
• Say "agent" only — NEVER "expert" or "specialist" (AA05 I.O)
• No absolutes (always/never), guarantees (will/promise), superlatives (best/#1)
• No pricing, rates, or premium amounts of any kind (AA05 I.N)
• No specific SF product names
• No scare tactics or fear-based language
• All text in English only (FINRA requirement)
• No customer PII or SPI
• For giveaway content: every participant must receive item — no "enter to win"
• After drafting: run through the 26-item pre-post checklist before publishing`;

  const buildPrompt = () => {
    if (!topic.trim()) return "";
    return `I need a social media post for my State Farm agency.

PLATFORM: ${platformRules[platform]}
CONTENT PILLAR: ${pillarGuidance[pillar]}
TOPIC/CONTEXT: ${topic}

AGENT CONTEXT: [My name], State Farm Agent in [My City]. I am an independent contractor agent. ${platform === "instagram" ? "This will be posted manually." : "This will be auto-scheduled."}

${complianceReminder}

Please draft a complete, compliant post ready to publish. Include:
1. The caption text
2. Suggested visual description
3. Recommended posting time
4. Any platform-specific notes
5. Confirm it passes the compliance pre-post checklist`;
  };

  const handleCopy = () => {
    const prompt = buildPrompt();
    if (!prompt) return;
    navigator.clipboard?.writeText(prompt);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
    window.open("https://claude.ai","_blank");
  };

  return (
    <div>
      <div style={{ fontSize:13, color:T.slate500, marginBottom:16, lineHeight:1.6 }}>
        Build a compliance-aware content request for your Claude. Fill in the details below, then click Send to Claude — your prompt will be pre-loaded with your platform rules, content pillar guidance, and all compliance requirements.
      </div>

      <Card>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          {/* Platform */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:6 }}>PLATFORM</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.keys(PLATFORMS).map(p => (
                <button key={p} onClick={() => setPlatform(p)} style={{ padding:"6px 12px", fontSize:11, fontWeight:platform===p?600:400, color:platform===p?T.white:T.slate600, background:platform===p?PLATFORMS[p].color:T.white, border:`1px solid ${platform===p?PLATFORMS[p].color:T.slate200}`, borderRadius:6, cursor:"pointer" }}>
                  {PLATFORMS[p].label}
                </button>
              ))}
            </div>
            {platform === "instagram" && (
              <div style={{ fontSize:10, color:T.purple, marginTop:6, fontWeight:500 }}>⚠ Instagram requires manual daily posting</div>
            )}
          </div>

          {/* Pillar */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:6 }}>CONTENT PILLAR</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.keys(PILLARS).map(p => {
                const pl = PILLARS[p];
                return (
                  <button key={p} onClick={() => setPillar(p)} style={{ padding:"6px 12px", fontSize:11, fontWeight:pillar===p?600:400, color:pillar===p?T.white:T.slate600, background:pillar===p?pl.color:T.white, border:`1px solid ${pillar===p?pl.color:T.slate200}`, borderRadius:6, cursor:"pointer" }}>
                    {pl.label}
                  </button>
                );
              })}
            </div>
            {pillar === "invite" && (
              <div style={{ fontSize:10, color:T.amber, marginTop:6, fontWeight:500 }}>⚠ Invite pillar max 20% of total content</div>
            )}
          </div>
        </div>

        {/* Topic */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:T.slate600, display:"block", marginBottom:6 }}>TOPIC OR CONTEXT</label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Describe what you want the post to be about. The more specific the better.\n\nExamples:\n• 'Spring storm season prep for Florida homeowners'\n• 'Spotlight on Main Street Bakery in our community'\n• 'Marcus just celebrated his 4-year work anniversary'\n• 'Myth bust: does a red car cost more to insure?'"
            rows={5}
            style={{ width:"100%", padding:"10px 12px", fontSize:12, color:T.slate800, border:`1px solid ${T.slate200}`, borderRadius:8, outline:"none", resize:"vertical", lineHeight:1.6, fontFamily:"inherit", boxSizing:"border-box" }}
          />
        </div>

        {/* Compliance reminder */}
        <div style={{ background:T.slate50, border:`1px solid ${T.slate200}`, borderRadius:8, padding:"10px 12px", marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.slate700, marginBottom:4 }}>Your Claude will automatically apply these rules to every post:</div>
          <div style={{ fontSize:10, color:T.slate500, lineHeight:1.8 }}>
            Customer not client (AA05 I.B) · Agent not expert (AA05 I.O) · No pricing or rates (AA05 I.N) · No absolutes or guarantees · English only (FINRA) · 26-item pre-post checklist · Platform-specific formatting and timing
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleCopy}
          disabled={!topic.trim()}
          style={{ width:"100%", padding:"12px", fontSize:13, fontWeight:700, color:T.white, background:topic.trim()?T.navy:"#94A3B8", border:"none", borderRadius:10, cursor:topic.trim()?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
        >
          {copyDone ? "✓ Prompt copied — Claude.ai opened!" : "⚡ Build prompt and send to Claude"}
        </button>
      </Card>
    </div>
  );
};

// ─── Main Social Media Module ─────────────────────────────────
export default function SocialMedia() {
  const [section, setSection] = useState("overview");

  const sections = [
    { id:"overview",  label:"Overview"      },
    { id:"calendar",  label:"Calendar"      },
    { id:"analytics", label:"Analytics"     },
    { id:"platforms", label:"Platform Guide"},
    { id:"create",    label:"Create Content"},
  ];

  const [editingPost, setEditingPost] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [newPost, setNewPost] = useState({platform:"facebook", content:"", post_date:"", status:"draft"});

  const savePost = async (post) => {
    const { error } = await supabase.from("content_calendar").upsert([{
      ...post,
      agency_id: AGENCY_ID,
      updated_at: new Date().toISOString()
    }]);
    if (!error) { setEditingPost(null); setShowScheduler(false); window.location.reload(); }
  };

  const approvePost = async (postId) => {
    await supabase.from("content_calendar").update({status:"approved", approved_at: new Date().toISOString()}).eq("id", postId);
    window.location.reload();
  };


  return (
    <div>
      {/* Module Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:T.slate900, letterSpacing:"-0.02em" }}>Social Media</div>
          <div style={{ fontSize:12, color:T.slate500, marginTop:3 }}>
            Facebook · Instagram · LinkedIn · X/Twitter · Compliance-aware content creation
          </div>
        </div>
        <AskBtn context="I need a full social media review. Check my content mix (80/20 rule), platform performance, upcoming schedule, and flag any compliance concerns. What should I prioritize this week?" />
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
      {section === "overview"  && <SocialOverview  posts={MOCK_POSTS} analytics={MOCK_ANALYTICS} />}
      {section === "calendar"  && <ContentCalendar  posts={MOCK_POSTS} />}
      {section === "analytics" && <Analytics        analytics={MOCK_ANALYTICS} />}
      {section === "platforms" && <PlatformGuide />}
      {section === "create"    && <CreateContent />}
    </div>
  );
}

