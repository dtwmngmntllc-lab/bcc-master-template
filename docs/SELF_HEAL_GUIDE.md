# The Self-Heal Model

> How a BCC client maintains their system: by working WITH their Claude, not around it.

This document captures the operating philosophy of the Imaginary Farms BCC. It's reflected in-app in `Settings → About → Keep It Connected` and lives here in the repo so every Project Claude reading the install docs understands the model they're delivering.

---

## The principle

**The agent is not a system administrator. They are an insurance professional.** Every minute they spend remembering which dashboard to log into, what to click, or how to reconnect a service is a minute they're not selling, serving, or being with their family.

The BCC is designed so the agent's primary maintenance interface is **their own Claude.ai Project Claude.** When something needs attention, the agent screenshots it, pastes it to Claude, and gets back a fix or a step-by-step walkthrough. Their Claude has the full context of their stack — it knows what to do.

---

## The pattern, every time

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 📸 Screenshot    │ -> │ 💬 Paste to your │ -> │ ✅ Follow Claude's│
│    the error     │    │    Claude        │    │    steps          │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

That's it. The agent never has to:
- Remember which dashboard to open
- Look up authorization URLs
- Read OAuth error messages
- Know what "OAuth token" even means

Their Claude does that work, in plain English, on demand.

---

## Two layers of connections — your Claude knows the difference

### Layer 1 — Claude.ai connectors

These are the four core systems that power the BCC. They live in **Claude.ai → Settings → Connectors**:

| Connector | Role |
|---|---|
| **💾 Supabase** | Persistent memory + database (the source of truth) |
| **🔌 Composio** | Gateway to all the agent's other tools |
| **📦 GitHub** | Where the BCC web app code lives |
| **🚀 Vercel** | Where the BCC web app is hosted |

If one of these disconnects, the agent's Claude tells them exactly what to click in Claude.ai settings.

### Layer 2 — Composio integrations

These are the apps the BCC reaches out to (via the Composio gateway in Layer 1). They live inside the **Composio dashboard**:

- Gmail, Google Drive, Google Calendar
- LinkedIn, Facebook, Instagram, YouTube
- Anything else the agent has connected through Composio

When one of these disconnects (usually because an OAuth token expired), the agent's Claude generates a fresh authorization link on request:

> Agent: "Gmail looks disconnected — give me the Composio reauthorization link."
>
> Claude: "Here's the link to reauthorize Gmail in Composio: [link]. Click it, complete the Google OAuth prompt, you'll be back online in 30 seconds."

---

## How agents will know something needs attention

- An **alert** appears in the BCC Alerts module flagging the disconnection
- The **Automations Run Log** shows recent runs as "failed" with an auth error
- The agent stops receiving the morning briefing
- New documents stop appearing in Drive after they hit Gmail
- A module in the BCC suddenly shows "Something went wrong loading [Module]" — that's the ErrorBoundary catching a problem

**In every case:** screenshot what they see, paste it to their Claude, ask for help. Their Claude can read screenshots, identify the issue, and either fix it directly or walk them through the fix.

---

## Why this matters for the BCC product

**The "co-pilot, not just dashboard" promise depends on this.** If the agent's experience of the BCC is "another tool I have to maintain," it's a worse version of the dashboards they already pay for. If their experience is "my AI partner handles everything technical, I just describe what I see," that's the product.

The Settings → About → Keep It Connected page in the web app teaches this model to every agent on day one. It is intentionally light on technical detail and heavy on the message: **ask your Claude first.**

---

## What Project Claude should do during install

When setting up a new client BCC:

1. **Confirm the agent has connected the Layer 1 connectors** (Supabase, Composio, GitHub, Vercel) in Claude.ai settings
2. **Confirm the Composio integrations** the client needs (Gmail, Drive, Calendar, social) are authorized
3. **Walk the agent through Settings → About → Keep It Connected** during the training session — show them the green hero card and the two-tier model
4. **Reinforce the pattern verbally:** "If you ever see anything that doesn't look right — an error, a missing module, a failed automation — screenshot it and ask me. I'll fix it or tell you exactly what to click."

This is part of what the agent is buying: not just the BCC software, but the working partnership model with their Claude that makes the software self-maintaining.

---

## What the master template should NOT teach

- Direct dashboard URLs as the primary fix path (the agent doesn't need to know them)
- OAuth troubleshooting steps the agent should perform alone (their Claude does this)
- Quarterly maintenance checklists the agent runs manually (the system surfaces issues; their Claude handles them)

The quick links to Claude.ai connectors and the Composio dashboard exist in the About page — but they're framed as **"only when your Claude tells you to use them."** The default path is always: screenshot → Claude → done.

---

*Last updated: May 7, 2026 — initial self-heal model documentation.*
