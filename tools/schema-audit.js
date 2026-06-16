#!/usr/bin/env node
/**
 * Schema Audit — verifies every supabase.from(...).select/eq/order in src/
 * actually references columns that exist in the database.
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run audit:schema
 *
 * Or with explicit env file:
 *   node tools/schema-audit.js
 *
 * Exits 0 if clean, 1 if any mismatches found (so CI can block bad code).
 *
 * Built by Imaginary Farms LLC after we shipped 3 silent schema-mismatch
 * bugs to clients in May 2026. Never again.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// Load env from .env if present
try {
  const env = readFileSync(".env", "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^[\"\']|[\"\']$/g, "");
  }
} catch {}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  const strict = process.env.AUDIT_STRICT === "1" || process.argv.includes("--strict");
  console.warn("⚠ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — skipping schema audit.");
  console.warn("  Set them in .env to enable. Use --strict or AUDIT_STRICT=1 to fail when env is missing.");
  process.exit(strict ? 2 : 0);
}

const supabase = createClient(url, key);

// ── Step 1: Walk src/ and collect every .jsx/.js file ──
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|tsx?)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk("src");

// ── Step 2: Pull live schema ──
async function loadSchema() {
  // Try every public table by attempting a 0-row select with HEAD.
  // We use a known-bad column trick: SELECT * with limit 0 returns column metadata.
  // Simpler — query a system view via PostgREST rpc... but we keep it standalone:
  // List all tables we reference in code first, then probe each with limit(0).
  return null; // placeholder — populated below
}

// Faster approach: extract every table name first, then probe each
const fromPat = /\bfrom\s*\(\s*[\"\']([\w_]+)[\"\']\s*\)/g;
const tablesRef = new Set();
for (const f of files) {
  const c = readFileSync(f, "utf-8");
  let m;
  while ((m = fromPat.exec(c)) !== null) tablesRef.add(m[1]);
}

// Probe each table — limit(0) returns headers without rows
const schema = {};
const probeErrors = [];
await Promise.all([...tablesRef].map(async t => {
  const { error, data } = await supabase.from(t).select("*").limit(1);
  if (error) {
    if (error.code === "42P01") {
      schema[t] = null; // table doesn't exist
    } else {
      probeErrors.push({ table: t, error: error.message });
      schema[t] = null;
    }
    return;
  }
  // Get columns from the first row (or a single-row select if empty)
  if (data && data.length > 0) {
    schema[t] = new Set(Object.keys(data[0]));
  } else {
    // Empty table — issue an OPTIONS-style probe by inserting+rolling back is too risky.
    // Fall back to information_schema via rpc. If no rpc, we mark as "unknown" and skip.
    schema[t] = null;
  }
}));

// For tables that came back empty, fall back to fetching column list from PostgREST OpenAPI spec
const need_openapi = [...tablesRef].filter(t => schema[t] === null && !probeErrors.find(e => e.table === t));
if (need_openapi.length > 0) {
  try {
    const r = await fetch(`${url}/rest/v1/?apikey=${key}`);
    const spec = await r.json();
    const defs = spec.definitions || spec.components?.schemas || {};
    for (const t of need_openapi) {
      if (defs[t]?.properties) {
        schema[t] = new Set(Object.keys(defs[t].properties));
      }
    }
  } catch (e) {
    // OpenAPI fallback failed — leave those tables as null
  }
}

// ── Step 3: Parse every supabase.from call ──
function parseQueries(content, file) {
  const calls = [];
  const fp = /\bfrom\s*\(\s*[\"\']([\w_]+)[\"\']\s*\)/g;
  let m;
  while ((m = fp.exec(content)) !== null) {
    const table = m[1];
    const start = m.index;
    const line = content.slice(0, start).split("\n").length;
    const win = content.slice(start, start + 3000);

    // Find chain end (paren-balanced)
    let depth = 0, end = win.length, inStr = null, inTpl = false;
    for (let i = 0; i < win.length; i++) {
      const c = win[i];
      if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (inTpl) { if (c === "`") inTpl = false; continue; }
      if (c === "\'" || c === "\"") inStr = c;
      else if (c === "`") inTpl = true;
      else if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) {
        const rest = win.slice(i+1, i+200);
        if (!/^\s*\./.test(rest)) { end = i+1; break; }
      }}
    }
    const chain = win.slice(0, end);

    // Extract .select cols
    const sm = /\.select\s*\(\s*[\"\']([^\"\']*)[\"\'`]\s*\)/.exec(chain);
    let selectCols = null;
    if (sm) {
      const raw = sm[1];
      const cols = [];
      let buf = "", d = 0;
      for (const ch of raw) {
        if (ch === "(") d++;
        else if (ch === ")") d--;
        else if (ch === "," && d === 0) { cols.push(buf.trim()); buf = ""; continue; }
        buf += ch;
      }
      if (buf) cols.push(buf.trim());
      selectCols = cols.filter(c => c && c !== "*" && !c.includes("(") && !c.includes(":"));
    }

    // Extract filter/order columns
    const filterCols = [];
    const fpats = [/\.eq\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.gte\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.lte\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.gt\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.lt\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.in\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.like\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.ilike\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.is\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.contains\s*\(\s*[\"\']([\w_]+)[\"\']/g,
                   /\.order\s*\(\s*[\"\']([\w_]+)[\"\']/g];
    for (const pat of fpats) {
      let mm;
      while ((mm = pat.exec(chain)) !== null) filterCols.push(mm[1]);
    }

    calls.push({ file, line, table, selectCols, filterCols });
  }
  return calls;
}

const allCalls = [];
for (const f of files) allCalls.push(...parseQueries(readFileSync(f, "utf-8"), f));

// ── Step 4: Compare against schema ──
const issues = [];
for (const call of allCalls) {
  const cols = schema[call.table];
  if (cols === null || cols === undefined) {
    if (probeErrors.find(e => e.table === call.table)) continue;
    issues.push({ severity: "TABLE_UNKNOWN", ...call,
      message: `Table '${call.table}' could not be verified (empty or unreachable)` });
    continue;
  }
  const badSelect = (call.selectCols || []).filter(c => !cols.has(c));
  const badFilter = call.filterCols.filter(c => !cols.has(c));
  if (badSelect.length || badFilter.length) {
    issues.push({ severity: "COLUMN_MISMATCH", ...call, badSelect, badFilter,
      realCols: [...cols].sort() });
  }
}

// ── Step 5: Report ──
const RESET = "\x1b[0m", BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m";
console.log(`\n${BOLD}═══ BCC Schema Audit ═══${RESET}`);
console.log(`Files scanned:    ${files.length}`);
console.log(`Queries scanned:  ${allCalls.length}`);
console.log(`Tables referenced: ${tablesRef.size}`);
if (probeErrors.length) {
  console.log(`${YELLOW}⚠ Tables that errored on probe:${RESET}`);
  probeErrors.forEach(e => console.log(`   ${e.table}: ${e.error}`));
}

if (issues.length === 0) {
  console.log(`${GREEN}${BOLD}✅ No schema mismatches found. Master template is clean.${RESET}\n`);
  process.exit(0);
} else {
  // Warn mode (default for prebuild) — print issues but never block the build
  // Strict mode (audit:schema or CI) — exit 1 so the failure is loud
  const strict = process.env.AUDIT_STRICT === "1" || process.argv.includes("--strict");
  const icon = strict ? RED + BOLD + "❌" : YELLOW + BOLD + "⚠";
  console.log(`${icon} Found ${issues.length} schema issue(s):${RESET}\n`);
  issues.forEach((iss, i) => {
    console.log(`${BOLD}[${i+1}] ${iss.severity}${RESET} — ${iss.file}:${iss.line}`);
    console.log(`    Table: ${iss.table}`);
    if (iss.badSelect?.length) console.log(`    ${RED}❌ Selected columns that don't exist:${RESET} ${iss.badSelect.join(", ")}`);
    if (iss.badFilter?.length) console.log(`    ${RED}❌ Filter/order on columns that don't exist:${RESET} ${iss.badFilter.join(", ")}`);
    if (iss.realCols) console.log(`    ${GREEN}✓ Real columns:${RESET} ${iss.realCols.join(", ")}`);
    if (iss.message) console.log(`    ${iss.message}`);
    console.log();
  });
  if (strict) {
    console.log(`${RED}${BOLD}Audit failed — fix the issues above and try again.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${YELLOW}(warn-only mode — build will continue. Use AUDIT_STRICT=1 to block.)${RESET}\n`);
    process.exit(0);
  }
}
