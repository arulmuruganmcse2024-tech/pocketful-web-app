import { STAGE } from "./core.js";

export function uiHtml(route = "/"): string {
  const page = JSON.stringify(route);
  const reserveLink = STAGE >= 2 ? '<a href="/authorizations">Reserve</a>' : "";
  const historyLink = STAGE >= 3 ? '<a href="/statement">Statements</a>' : "";

  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pocketful — Peer-to-Peer Wallet &amp; Ledger</title>
<meta name="description" content="A peer-to-peer wallet and payment ledger with idempotent transfers, bill splitting, payment requests, authorization holds, historical statements, and refunds.">
<meta property="og:title" content="Pocketful — Peer-to-Peer Wallet &amp; Ledger">
<meta property="og:description" content="A peer-to-peer wallet and payment ledger with idempotent transfers, bill splitting, payment requests, authorization holds, historical statements, and refunds.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --bg-canvas: #090d16;
  --bg-card: #111726;
  --bg-card-subtle: #161e31;
  --bg-input: #0e1422;
  --border-card: rgba(255, 255, 255, 0.08);
  --border-card-hover: rgba(255, 255, 255, 0.15);
  --border-input: rgba(255, 255, 255, 0.12);
  --border-focus: #10b981;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --text-subtle: #64748b;
  --accent-emerald: #10b981;
  --accent-emerald-hover: #059669;
  --accent-emerald-bg: rgba(16, 185, 129, 0.12);
  --accent-crimson: #f87171;
  --accent-crimson-bg: rgba(239, 68, 68, 0.12);
  --accent-amber: #fbbf24;
  --accent-amber-bg: rgba(245, 158, 11, 0.12);
  --shadow-card: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-card);
  --shadow-hover: 0 16px 40px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--border-card-hover);
  --radius-card: 20px;
  --radius-input: 12px;
  --radius-pill: 9999px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html {
  font-family: var(--font-sans);
  background-color: var(--bg-canvas);
  color: var(--text-main);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  min-height: 100%;
}
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at 50% 0%, #152238 0%, #090d16 42%);
  background-attachment: fixed;
}
.shell { min-height: 100vh; display: flex; flex-direction: column; }

/* Top Bar Contract (3 zones) */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(9, 13, 22, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-card);
}
.navin {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.brand {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.035em;
  color: #fff;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-emerald);
  box-shadow: 0 0 12px var(--accent-emerald);
}
.links {
  display: flex;
  align-items: center;
  gap: 4px;
}
.links a {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 10px;
  transition: color 0.16s, background-color 0.16s;
  white-space: nowrap;
}
.links a:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}
.links a.active, .links a[aria-current="page"] {
  color: #fff;
  background: rgba(255, 255, 255, 0.09);
}

.userbar {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.userbar a {
  color: var(--text-main);
  text-decoration: none;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-card);
  transition: all 0.16s;
}
.userbar a:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border-card-hover);
}
.user-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-card);
  border-radius: 10px;
}
.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: linear-gradient(135deg, #10b981, #047857);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}
.user-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.user-meta strong { color: #fff; font-weight: 600; }
.user-meta span { color: var(--text-subtle); font-family: var(--font-mono); }

/* Main layout */
main {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 36px 24px 72px;
  flex: 1;
}
.grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 960px) {
  .grid { grid-template-columns: 1fr; }
}

/* Card surfaces */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 28px;
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}
.card:hover {
  border-color: var(--border-card-hover);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

h1, h2, h3 {
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
}
h1 {
  font-size: clamp(28px, 3.2vw, 36px);
  line-height: 1.15;
  margin-bottom: 6px;
}
h2 {
  font-size: 18px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
p.muted, .muted {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-muted);
}
.text-subtle { color: var(--text-subtle); font-size: 13px; }

/* Balance & Hero Figures */
.balance-container {
  margin: 18px 0 24px;
}
.balance-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 6px;
}
.balance {
  font-size: clamp(38px, 4.5vw, 54px);
  font-weight: 800;
  letter-spacing: -0.04em;
  color: #fff;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}
.metric {
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-card);
  border-radius: 14px;
  padding: 12px 18px;
  min-width: 140px;
  flex: 1;
}
.metric span {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 4px;
}
.metric strong {
  display: block;
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-main);
}

/* Forms & Controls */
form { display: grid; gap: 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
input, select, textarea {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-input);
  padding: 12px 14px;
  color: #fff;
  outline: none;
  transition: border-color 0.16s, box-shadow 0.16s, background 0.16s;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
  background: #111827;
}
input::placeholder, textarea::placeholder {
  color: var(--text-subtle);
}
input[type="datetime-local"] {
  color-scheme: dark;
}
textarea {
  min-height: 72px;
  resize: vertical;
}
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  padding-right: 40px;
}

/* Buttons */
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-input);
  padding: 12px 20px;
  border: 1px solid var(--accent-emerald);
  background: var(--accent-emerald);
  color: #042f1a;
  cursor: pointer;
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
button:hover:not(:disabled) {
  background: #34d399;
  border-color: #34d399;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}
button:active:not(:disabled) {
  transform: translateY(0);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
button.secondarybtn {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-card);
  color: var(--text-main);
  box-shadow: none;
}
button.secondarybtn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--border-card-hover);
  color: #fff;
  box-shadow: none;
}
button.dangerbtn {
  background: var(--accent-crimson-bg);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
button.dangerbtn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.22);
  border-color: var(--accent-crimson);
  color: #fff;
}
:focus-visible {
  outline: 2px solid var(--accent-emerald);
  outline-offset: 2px;
}

/* Quick helper chips */
.quick-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.quick-chip {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-card);
  border-radius: 6px;
  padding: 3px 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.14s;
  width: auto;
}
.quick-chip:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: var(--accent-emerald);
  color: #fff;
  transform: none;
}

/* Activity feed & Rows */
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-card);
  transition: background-color 0.14s;
}
.row:last-child { border-bottom: none; }
.row-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.row-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 16px;
}
.row-icon.sent {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  border: 1px solid var(--border-card);
}
.row-icon.received {
  background: var(--accent-emerald-bg);
  color: var(--accent-emerald);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.row-details { min-width: 0; }
.row-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-sub {
  font-size: 12px;
  color: var(--text-subtle);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.row-right { text-align: right; flex-shrink: 0; }
.row-amount {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.row-amount.credit { color: var(--accent-emerald); }
.row-tag {
  font-size: 11px;
  color: var(--text-subtle);
  text-transform: capitalize;
  margin-top: 2px;
}

/* Status / feedback boxes */
.errorbox {
  background: var(--accent-crimson-bg);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-radius: var(--radius-input);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
}
.uncertainbox {
  background: var(--accent-amber-bg);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fde68a;
  border-radius: var(--radius-input);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
}
.ok {
  background: var(--accent-emerald-bg);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
  border-radius: var(--radius-input);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
}
.empty {
  padding: 40px 24px;
  border: 1px dashed var(--border-card);
  border-radius: var(--radius-input);
  color: var(--text-subtle);
  text-align: center;
  font-size: 14px;
}
.small { font-size: 12px; color: var(--text-subtle); }

/* Activity & Search Toolbar */
.activity-tools {
  display: grid;
  grid-template-columns: 1fr 180px auto;
  gap: 12px;
  align-items: end;
  margin: 16px 0;
}
.request-tools {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 12px;
  align-items: end;
  margin: 16px 0;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
  margin: 16px 0;
}
.toolbar label { flex: 1; min-width: 180px; }
@media (max-width: 720px) {
  .activity-tools, .request-tools { grid-template-columns: 1fr; }
}

/* Bill Split Grid */
.sharegrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.sharegrid .metric { min-width: 0; padding: 10px 14px; }

/* Statement Summary */
.statement-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}
@media (max-width: 600px) {
  .statement-summary { grid-template-columns: 1fr; }
}
.row-actions { display: flex; gap: 8px; align-items: center; }
.row-actions button { width: auto; padding: 6px 12px; font-size: 12px; }

/* Auth page card */
.auth-wrapper {
  max-width: 440px;
  margin: 40px auto 0;
}
.demo-preset-box {
  margin-top: 24px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-card);
}
.demo-preset-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-subtle);
  margin-bottom: 10px;
}

@media (max-width: 768px) {
  .navin { padding: 0 16px; height: auto; padding: 12px 16px; flex-wrap: wrap; }
  .links { order: 3; width: 100%; overflow-x: auto; padding-top: 6px; }
  .links a { padding: 6px 10px; }
  main { padding: 24px 16px 48px; }
  .card { padding: 20px; border-radius: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* AI Assistant */
.ai-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 390px;
  max-width: calc(100vw - 32px);
  background: #111726;
  border: 1px solid var(--border-card);
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ai-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-card);
  background: rgba(255, 255, 255, 0.02);
}
.ai-privacy-note {
  padding: 6px 16px;
  font-size: 11px;
  color: var(--text-subtle);
  background: rgba(16, 185, 129, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.ai-messages {
  max-height: 280px;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.ai-msg {
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 88%;
  word-break: break-word;
}
.ai-msg-bot {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.ai-msg-user {
  background: linear-gradient(135deg, #10b981, #047857);
  color: #fff;
  align-self: flex-end;
}
.ai-suggested {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  overflow-x: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.2);
}
.ai-prompt {
  font-size: 11px;
  padding: 4px 10px;
  white-space: nowrap;
}
</style>
</head>
<body>
<div class="shell">
  <header class="nav">
    <div class="navin">
      <a href="/" class="brand">
        <span class="brand-dot"></span>
        Pocketful
      </a>
      <nav class="links">
        <a href="/">Wallet</a>
        <a href="/requests">Requests</a>
        <a href="/split">Split</a>
        ${reserveLink}
        ${historyLink}
      </nav>
      <div id="userbar" class="userbar"></div>
    </div>
  </header>
  <main id="app"></main>
</div>

<div id="ai-assistant-panel" data-testid="ai-assistant-panel" class="ai-panel" style="display:none">
  <div class="ai-panel-header">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="color:var(--accent-emerald);font-size:16px">✦</span>
      <strong>Gemini Assistant</strong>
      <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-weight:700">READ-ONLY</span>
    </div>
    <button id="ai-assistant-close" data-testid="ai-assistant-close" type="button" class="secondarybtn" style="width:auto;padding:4px 8px;font-size:12px;line-height:1">✕</button>
  </div>
  <div class="ai-privacy-note">
    <span>🔒 Grounded exclusively in your real authenticated account data.</span>
  </div>
  <div id="ai-assistant-messages" data-testid="ai-assistant-messages" class="ai-messages">
    <div class="ai-msg ai-msg-bot">
      Hello! I'm your Pocketful Assistant. I can explain your available balance, active reservation holds, recent activity, and pending requests. How can I help today?
    </div>
  </div>
  <div class="ai-suggested">
    <button type="button" class="quick-chip ai-prompt" data-testid="ai-prompt-balance" data-q="What is my current available balance and why?">Available balance</button>
    <button type="button" class="quick-chip ai-prompt" data-testid="ai-prompt-activity" data-q="Summarize my recent activity today">Summarize activity</button>
    <button type="button" class="quick-chip ai-prompt" data-testid="ai-prompt-requests" data-q="Show my pending payment requests">Pending requests</button>
    <button type="button" class="quick-chip ai-prompt" data-testid="ai-prompt-holds" data-q="Explain my held funds and active reservations">Explain held funds</button>
  </div>
  <form id="ai-assistant-form" style="display:flex;gap:8px;padding:12px;border-top:1px solid var(--border-card)">
    <input id="ai-assistant-input" data-testid="ai-assistant-input" placeholder="Ask about your balance, holds, or activity..." autocomplete="off" style="flex:1;font-size:13px">
    <button id="ai-assistant-submit" data-testid="ai-assistant-submit" type="submit" style="width:auto;padding:8px 16px;font-size:13px">Ask</button>
  </form>
</div>

<script>
const ROUTE = ${page};
const STAGE = ${STAGE};

document.querySelectorAll(".links a").forEach(a => {
  if (a.getAttribute("href") === ROUTE) {
    a.setAttribute("aria-current", "page");
    a.classList.add("active");
  }
});

const app = document.getElementById("app");
const tokenKey = "pocketful-token";
let refreshSeq = 0;
let paySig = "";
let payKey = crypto.randomUUID();
let paySubmitting = false;
let walletActivity = [];
let requestItems = [];
const writeKeys = new Map();

function idempotencyKey(scope, body) {
  const sig = JSON.stringify(body);
  let entries = writeKeys.get(scope);
  if (!entries) {
    entries = new Map();
    writeKeys.set(scope, entries);
  }
  if (!entries.has(sig)) entries.set(sig, crypto.randomUUID());
  return entries.get(sig);
}

function clearIdempotencyKey(scope, body) {
  const entries = writeKeys.get(scope);
  if (entries) {
    entries.delete(JSON.stringify(body));
    if (!entries.size) writeKeys.delete(scope);
  }
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => {
  switch (c) {
    case "&": return "&amp;";
    case "<": return "&lt;";
    case ">": return "&gt;";
    case '"': return "&quot;";
    case "'": return "&#39;";
    default: return c;
  }
});

function money(minor, mu, curr) {
  if (mu === 0) return minor + " " + curr;
  let s = String(Math.abs(minor)).padStart(mu + 1, "0");
  return (minor < 0 ? "-" : "") + s.slice(0, -mu) + "." + s.slice(-mu) + " " + curr;
}

function tok() { return localStorage.getItem(tokenKey) || ""; }

async function api(path, opts = {}) {
  const h = new Headers(opts.headers || {});
  h.set("Accept", "application/json");
  if (!(opts.body instanceof FormData) && opts.body !== undefined) {
    h.set("Content-Type", "application/json");
  }
  if (tok()) h.set("Authorization", "Bearer " + tok());
  return fetch(path, { ...opts, headers: h });
}

async function j(resp) {
  try { return await resp.json(); } catch { return {}; }
}

function setUserBar(me) {
  const b = document.getElementById("userbar");
  if (!b) return;
  if (!me) {
    b.innerHTML = '<a href="/login">Log in</a><a href="/signup">Sign up</a>';
    return;
  }
  const initials = esc((me.display_name || me.handle || "U").slice(0, 1).toUpperCase());
  b.innerHTML = '<div class="user-identity">' +
    '<div class="user-avatar">' + initials + '</div>' +
    '<div class="user-meta">' +
      '<strong data-testid="current-user">' + esc(me.display_name) + '</strong>' +
      '<span data-testid="current-handle">@' + esc(me.handle) + '</span>' +
    '</div>' +
  '</div>' +
  '<select id="demo-user-switch" data-testid="demo-user-switch" style="width:auto;font-size:12px;padding:6px 20px 6px 8px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid var(--border-card);color:var(--text-main)">' +
    '<option value="">Switch user...</option>' +
    '<option value="ada@pocketful.dev">Ada (@ada)</option>' +
    '<option value="bob@pocketful.dev">Bob (@bob)</option>' +
    '<option value="cy@pocketful.dev">Cy (@cy)</option>' +
  '</select>' +
  '<button id="ai-assistant-toggle" data-testid="ai-assistant-toggle" class="secondarybtn" style="width:auto;padding:6px 12px;font-size:12px;color:var(--accent-emerald);border-color:rgba(16,185,129,0.3);background:rgba(16,185,129,0.08);display:inline-flex;align-items:center;gap:4px">✦ Ask Gemini</button>' +
  '<button id="logout-button" data-testid="logout-button" class="secondarybtn" style="width:auto;padding:6px 12px;font-size:12px">Log out</button>';

  document.getElementById("logout-button").onclick = () => {
    localStorage.removeItem(tokenKey);
    location.href = "/login";
  };

  const aiToggle = document.getElementById("ai-assistant-toggle");
  if (aiToggle) {
    aiToggle.onclick = () => {
      const p = document.getElementById("ai-assistant-panel");
      if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
    };
  }

  const sw = document.getElementById("demo-user-switch");
  if (sw) {
    sw.onchange = async () => {
      const em = sw.value;
      if (!em) return;
      try {
        const r = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ email: em, password: "password123" })
        });
        const d = await r.json();
        if (d.token) {
          localStorage.setItem(tokenKey, d.token);
          location.reload();
        }
      } catch (e) {
        console.error("Failed to switch demo user:", e);
      }
    };
  }
}

function mustAuth() {
  if (!tok()) {
    location.href = "/login";
    return false;
  }
  return true;
}

async function loadMe() {
  if (!tok()) {
    setUserBar(null);
    return null;
  }
  const r = await api("/me");
  if (!r.ok) {
    localStorage.removeItem(tokenKey);
    setUserBar(null);
    return null;
  }
  const me = await j(r);
  setUserBar(me);
  return me;
}

function decimalToMinor(raw, mu) {
  const s = String(raw).trim();
  if (!/^\\d+(\\.\\d+)?$/.test(s)) throw new Error("Enter a valid amount");
  const parts = s.split(".");
  const dec = parts[1] || "";
  if (dec.length > mu) throw new Error("Too many decimal places");
  return Number(parts[0]) * 10 ** mu + Number((dec + "0".repeat(mu)).slice(0, mu) || 0);
}

function payBody() {
  return {
    to_handle: document.getElementById("pay-handle").value.trim(),
    amount: decimalToMinor(document.getElementById("pay-amount").value, window.currentMu),
    note: document.getElementById("pay-note").value.trim(),
    visibility: document.getElementById("pay-visibility").value
  };
}

function sig(v) { return JSON.stringify(v); }
function ensurePayKey(s) {
  if (paySig !== s) {
    paySig = s;
    payKey = crypto.randomUUID();
  }
}

function payBox(testid, cls) {
  let x = document.querySelector('[data-testid="' + testid + '"]');
  if (!x) {
    x = document.createElement('div');
    x.dataset.testid = testid;
    x.className = cls;
    document.getElementById('pay-form').appendChild(x);
  }
  return x;
}

function dropPayBox(testid) {
  document.querySelector('[data-testid="' + testid + '"]')?.remove();
}

async function refreshWallet() {
  if (!mustAuth()) return;
  const seq = ++refreshSeq;
  const button = document.getElementById("wallet-refresh");
  const status = document.getElementById("wallet-feedback");
  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing...";
  }
  try {
    const [mr, ar] = await Promise.all([api("/me"), api("/activity?limit=200")]);
    if (!mr.ok || !ar.ok) throw new Error("Could not refresh your wallet. Try again.");
    const [me, activity] = await Promise.all([j(mr), j(ar)]);
    if (seq !== refreshSeq) return;
    walletActivity = activity.payments || [];
    renderWalletData(me, activity);
    renderActivity();
    if (status) {
      status.classList.remove("errorbox");
      status.textContent = "Updated " + new Date().toLocaleTimeString();
    }
  } catch (ex) {
    if (seq === refreshSeq && status) {
      status.textContent = ex instanceof TypeError
        ? "Connection issue. Your last displayed balance may be out of date."
        : ex.message;
      status.classList.add("errorbox");
    }
  } finally {
    if (seq === refreshSeq && button) {
      button.disabled = false;
      button.textContent = "Refresh balance & feed";
    }
  }
}

function renderWalletData(me, activity) {
  const bal = document.querySelector('[data-testid="wallet-balance"]');
  if (bal) {
    bal.textContent = money(me.total ?? me.balance, me.minor_units, me.currency);
    bal.dataset.amount = String(me.total ?? me.balance);
  }
  const av = document.querySelector('[data-testid="wallet-available"]');
  if (av) {
    av.textContent = money(me.available, me.minor_units, me.currency);
    av.dataset.amount = String(me.available);
  }
  let held = document.querySelector('[data-testid="wallet-held"]');
  const sec = document.querySelector('[data-testid="wallet-available"]')?.closest(".secondary") || document.querySelector('[data-testid="wallet-available"]')?.parentElement;
  if (me.held > 0 && !held && sec) {
    sec.insertAdjacentHTML("beforeend", '<div class="metric"><strong data-testid="wallet-held"></strong><span>Held</span></div>');
    held = document.querySelector('[data-testid="wallet-held"]');
  }
  if (me.held === 0 && held) {
    held.parentElement.remove();
    held = null;
  }
  if (me.held > 0 && held) {
    held.parentElement.style.display = "";
  }
  if (held) {
    held.textContent = money(me.held, me.minor_units, me.currency);
    held.dataset.amount = String(me.held);
  }
  const list = document.querySelector('[data-testid="activity-list"]');
  const empty = document.querySelector('[data-testid="empty-activity"]');
  if (list) {
    list.innerHTML = (activity.payments || []).map(p => {
      const isSent = p.from_handle === window.currentHandle;
      return '<div class="row ' + (isSent ? "activity-sent" : "activity-received") + '" data-testid="activity-item-' + esc(p.payment_id) + '" data-visibility="' + esc(p.visibility) + '">' +
        '<div class="row-left">' +
          '<div class="row-icon ' + (isSent ? 'sent' : 'received') + '">' + (isSent ? '↑' : '↓') + '</div>' +
          '<div class="row-details">' +
            '<div class="row-title" data-testid="activity-parties-' + esc(p.payment_id) + '">' + esc(p.from_handle) + ' → ' + esc(p.to_handle) + '</div>' +
            '<div class="row-sub"><span data-testid="activity-note-' + esc(p.payment_id) + '">' + esc(p.note || "Transfer") + '</span> · <span>' + esc(p.visibility) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="row-right">' +
          '<div class="row-amount ' + (isSent ? '' : 'credit') + '" data-testid="activity-amount-' + esc(p.payment_id) + '">' + (isSent ? '-' : '+') + esc(money(p.amount, me.minor_units, me.currency)) + '</div>' +
          '<div class="row-tag">' + (isSent ? 'Sent' : 'Received') + '</div>' +
        '</div>' +
      '</div>';
    }).join("");
    if (empty) empty.style.display = (activity.payments || []).length ? "none" : "";
  }
}

function renderActivity() {
  const list = document.getElementById("activity-list");
  if (!list) return;
  const search = (document.getElementById("activity-search")?.value || "").trim().toLowerCase();
  const mode = document.getElementById("activity-filter")?.value || "all";
  const rows = walletActivity.filter(p => {
    const sent = p.from_handle === window.currentHandle;
    if (mode === "sent" && !sent) return false;
    if (mode === "received" && sent) return false;
    return [p.from_handle, p.to_handle, p.note, p.visibility].join(" ").toLowerCase().includes(search);
  });
  list.innerHTML = rows.map(p => {
    const isSent = p.from_handle === window.currentHandle;
    return '<div class="row ' + (isSent ? "activity-sent" : "activity-received") + '" data-testid="activity-item-' + esc(p.payment_id) + '" data-visibility="' + esc(p.visibility) + '">' +
      '<div class="row-left">' +
        '<div class="row-icon ' + (isSent ? 'sent' : 'received') + '">' + (isSent ? '↑' : '↓') + '</div>' +
        '<div class="row-details">' +
          '<div class="row-title" data-testid="activity-parties-' + esc(p.payment_id) + '">' + esc(p.from_handle) + ' → ' + esc(p.to_handle) + '</div>' +
          '<div class="row-sub"><span data-testid="activity-note-' + esc(p.payment_id) + '">' + esc(p.note || "Transfer") + '</span> · <span>' + esc(p.visibility) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="row-right">' +
        '<div class="row-amount ' + (isSent ? '' : 'credit') + '" data-testid="activity-amount-' + esc(p.payment_id) + '">' + (isSent ? '-' : '+') + esc(money(p.amount, window.currentMu, window.currentCurrency)) + '</div>' +
        '<div class="row-tag">' + (isSent ? 'Sent' : 'Received') + '</div>' +
      '</div>' +
    '</div>';
  }).join("");
  const empty = document.getElementById("empty-activity");
  if (empty) {
    empty.style.display = rows.length ? "none" : "";
    empty.textContent = walletActivity.length ? "No activity matches these filters." : "No visible payments yet.";
  }
  const count = document.getElementById("activity-count");
  if (count) {
    count.textContent = "Showing " + rows.length + " of " + walletActivity.length + " visible payments";
  }
}

function exportActivity() {
  const search = (document.getElementById("activity-search")?.value || "").trim().toLowerCase();
  const mode = document.getElementById("activity-filter")?.value || "all";
  const rows = walletActivity.filter(p => {
    const sent = p.from_handle === window.currentHandle;
    if (mode === "sent" && !sent) return false;
    if (mode === "received" && sent) return false;
    return [p.from_handle, p.to_handle, p.note, p.visibility].join(" ").toLowerCase().includes(search);
  });
  if (!rows.length) {
    const count = document.getElementById("activity-count");
    if (count) count.textContent = "Nothing to export for these filters.";
    return;
  }
  const quote = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv = [
    ["Direction", "From", "To", "Amount", "Minor units", "Currency", "Note", "Visibility", "Created at"].map(quote).join(","),
    ...rows.map(p => [
      p.from_handle === window.currentHandle ? "Sent" : "Received",
      p.from_handle,
      p.to_handle,
      money(p.amount, window.currentMu, window.currentCurrency),
      p.amount,
      window.currentCurrency,
      p.note,
      p.visibility,
      p.created_at
    ].map(quote).join(","))
  ].join("\\r\\n");
  const url = URL.createObjectURL(new Blob(["\\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "pocketful-activity.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function walletView() {
  return '<div class="grid">' +
    '<section class="card">' +
      '<div class="card-header">' +
        '<div>' +
          '<h1>Move money with confidence.</h1>' +
          '<p class="muted">Available funds are guaranteed explicit; every payment write is idempotent and crash-resilient.</p>' +
        '</div>' +
      '</div>' +
      '<div class="balance-container">' +
        '<div class="balance-label">Total Balance</div>' +
        '<div data-testid="wallet-balance" id="wallet-balance" class="balance" data-amount="0">—</div>' +
      '</div>' +
      '<div class="secondary" id="balance-metrics">' +
        '<div class="metric"><strong data-testid="wallet-available">—</strong><span>Available</span></div>' +
        '<div class="metric" id="heldbox" style="display:none"><strong data-testid="wallet-held">—</strong><span>Held</span></div>' +
      '</div>' +
      '<div style="margin-top:24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<button id="wallet-refresh" data-testid="wallet-refresh" class="secondarybtn" style="width:auto">Refresh balance & feed</button>' +
        '<div id="wallet-feedback" class="small" role="status" aria-live="polite"></div>' +
      '</div>' +
    '</section>' +

    '<section class="card">' +
      '<h2>Send money</h2>' +
      '<p class="muted" style="margin-bottom:16px">Instant settlement from your available balance. Writes are protected against duplicate charges.</p>' +
      '<form id="pay-form">' +
        '<label>Recipient handle' +
          '<input data-testid="pay-handle" id="pay-handle" placeholder="e.g. bob" autocomplete="off">' +
          '<div class="quick-chips">' +
            '<button type="button" class="quick-chip" data-set-handle="bob">@bob</button>' +
            '<button type="button" class="quick-chip" data-set-handle="cy">@cy</button>' +
            '<button type="button" class="quick-chip" data-set-handle="ada">@ada</button>' +
          '</div>' +
        '</label>' +
        '<label>Amount' +
          '<input data-testid="pay-amount" id="pay-amount" inputmode="decimal" value="15.00">' +
          '<div class="quick-chips">' +
            '<button type="button" class="quick-chip" data-set-amount="5.00">5.00</button>' +
            '<button type="button" class="quick-chip" data-set-amount="15.00">15.00</button>' +
            '<button type="button" class="quick-chip" data-set-amount="50.00">50.00</button>' +
          '</div>' +
        '</label>' +
        '<label>Note' +
          '<textarea data-testid="pay-note" id="pay-note" rows="2" placeholder="What is this payment for?"></textarea>' +
        '</label>' +
        '<label>Visibility' +
          '<select data-testid="pay-visibility" id="pay-visibility">' +
            '<option value="public">Public (Visible in general feed)</option>' +
            '<option value="private">Private (Only sender & recipient)</option>' +
          '</select>' +
        '</label>' +
        '<button type="submit" data-testid="pay-submit" id="pay-submit">Send</button>' +
      '</form>' +
    '</section>' +
  '</div>' +

  '<section class="card" style="margin-top:24px">' +
    '<div class="card-header">' +
      '<div>' +
        '<h2>Activity</h2>' +
        '<p class="muted">Live transactional ledger records ordered newest first.</p>' +
      '</div>' +
    '</div>' +
    '<div class="activity-tools">' +
      '<label>Search activity' +
        '<input id="activity-search" data-testid="activity-search" type="search" placeholder="Search by handle or memo" aria-label="Search activity">' +
      '</label>' +
      '<label>Filter' +
        '<select id="activity-filter" data-testid="activity-filter" aria-label="Filter activity">' +
          '<option value="all">All activity</option>' +
          '<option value="sent">Money sent</option>' +
          '<option value="received">Money received</option>' +
        '</select>' +
      '</label>' +
      '<button id="activity-export" data-testid="activity-export" type="button" class="secondarybtn" style="width:auto;height:44px">Export CSV</button>' +
    '</div>' +
    '<div id="activity-count" class="small" role="status" aria-live="polite" style="margin-bottom:12px"></div>' +
    '<div id="activity-list" data-testid="activity-list"></div>' +
    '<div id="empty-activity" data-testid="empty-activity" class="empty">No visible payments yet.</div>' +
  '</section>';
}

function requestForm() {
  return '<section class="card">' +
    '<h2>Request money</h2>' +
    '<p class="muted" style="margin-bottom:16px">Request funds from any handle. Payer can fulfill or decline at their convenience.</p>' +
    '<form id="request-form">' +
      '<label>Payer handle' +
        '<input id="request-handle" data-testid="request-handle" placeholder="e.g. bob" autocomplete="off">' +
        '<div class="quick-chips">' +
          '<button type="button" class="quick-chip" data-set-req-handle="bob">@bob</button>' +
          '<button type="button" class="quick-chip" data-set-req-handle="cy">@cy</button>' +
          '<button type="button" class="quick-chip" data-set-req-handle="ada">@ada</button>' +
        '</div>' +
      '</label>' +
      '<label>Amount' +
        '<input id="request-amount" data-testid="request-amount" inputmode="decimal" value="12.00">' +
      '</label>' +
      '<label>Note' +
        '<textarea id="request-note" data-testid="request-note" rows="2" placeholder="Reason for request"></textarea>' +
      '</label>' +
      '<button id="request-submit" data-testid="request-submit" type="submit">Request</button>' +
      '<div id="request-error" data-testid="request-error" class="errorbox" style="display:none"></div>' +
    '</form>' +
  '</section>';
}

function demoFundView() {
  return '<section class="card" style="margin-top:24px">' +
    '<div class="card-header">' +
      '<div>' +
        '<h2>Simulated Demo Funds</h2>' +
        '<p class="muted">Instant sandbox credits for testing multi-party splits, authorizations, and bitemporal statements. No real banking connections involved.</p>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
      '<button type="button" id="demo-fund" data-testid="demo-fund" class="secondarybtn" style="width:auto">Add simulated demo funds</button>' +
      '<div id="fund-feedback" role="status" aria-live="polite" class="small"></div>' +
    '</div>' +
  '</section>';
}

function splitView() {
  return '<div class="grid">' +
    '<section class="card">' +
      '<h2>Split a bill</h2>' +
      '<p class="muted" style="margin-bottom:16px">Deterministic integer division. Exact minor unit arithmetic guarantees conservation without rounding discrepancies.</p>' +
      '<form id="split-form">' +
        '<label>Total amount' +
          '<input id="split-amount" data-testid="split-amount" inputmode="decimal" value="10.00">' +
        '</label>' +
        '<label>Participant handles (comma-separated, in order)' +
          '<input id="split-handles" data-testid="split-handles" placeholder="ada,bob,cy">' +
          '<div class="quick-chips">' +
            '<button type="button" class="quick-chip" data-set-split-handles="ada,bob,cy">ada, bob, cy</button>' +
            '<button type="button" class="quick-chip" data-set-split-handles="bob,cy">bob, cy</button>' +
          '</div>' +
        '</label>' +
        '<label>Note' +
          '<textarea id="split-note" data-testid="split-note" rows="2" placeholder="e.g. Dinner, utilities, travel"></textarea>' +
        '</label>' +
        '<button id="split-submit" data-testid="split-submit" type="submit">Create split</button>' +
        '<div id="split-success" data-testid="split-success" class="ok" role="status" aria-live="polite" style="display:none"></div>' +
        '<div id="split-error" data-testid="split-error" class="errorbox" style="display:none"></div>' +
      '</form>' +
    '</section>' +
    '<section class="card">' +
      '<h2>Live Share Breakdown</h2>' +
      '<p class="muted">Integer cent division preview. Any remainder is distributed one cent per participant starting from the left.</p>' +
      '<div id="split-preview" data-testid="split-preview" class="panel" style="margin-top:16px"></div>' +
    '</section>' +
  '</div>';
}

function renderRequestsPage() {
  app.innerHTML = '<div class="grid">' +
    requestForm() +
    '<section class="card">' +
      '<div class="card-header">' +
        '<div>' +
          '<h2>Request overview</h2>' +
          '<p class="muted">Live status of money requested from you and requests you have sent.</p>' +
        '</div>' +
        '<button id="requests-refresh" data-testid="requests-refresh" type="button" class="secondarybtn" style="width:auto">Refresh</button>' +
      '</div>' +
      '<div class="secondary">' +
        '<div class="metric"><strong id="request-incoming-count" data-testid="request-incoming-count">-</strong><span>Incoming pending</span></div>' +
        '<div class="metric"><strong id="request-outgoing-count" data-testid="request-outgoing-count">-</strong><span>Outgoing pending</span></div>' +
        '<div class="metric"><strong id="request-closed-count" data-testid="request-closed-count">-</strong><span>Resolved</span></div>' +
      '</div>' +
    '</section>' +
  '</div>' +
  '<section class="card" style="margin-top:24px">' +
    '<div class="request-tools">' +
      '<label>Search requests' +
        '<input id="request-search" data-testid="request-search" type="search" placeholder="Search by handle or memo" aria-label="Search requests">' +
      '</label>' +
      '<label>Filter status' +
        '<select id="request-status" data-testid="request-status" aria-label="Filter requests">' +
          '<option value="all">All statuses</option>' +
          '<option value="pending">Pending</option>' +
          '<option value="paid">Paid</option>' +
          '<option value="declined">Declined</option>' +
          '<option value="cancelled">Cancelled</option>' +
        '</select>' +
      '</label>' +
    '</div>' +
    '<div id="request-count" class="small" role="status" aria-live="polite" style="margin-bottom:14px">Loading requests...</div>' +
    '<div class="grid">' +
      '<div><h3 style="font-size:15px;margin-bottom:12px;color:var(--text-muted)">Incoming Requests</h3><div data-testid="incoming-list" id="incoming-list"></div></div>' +
      '<div><h3 style="font-size:15px;margin-bottom:12px;color:var(--text-muted)">Outgoing Requests</h3><div data-testid="outgoing-list" id="outgoing-list"></div></div>' +
    '</div>' +
    '<div data-testid="empty-requests" id="empty-requests" class="empty" style="display:none;margin-top:16px">No requests.</div>' +
    '<div data-testid="request-error" id="request-error" class="errorbox" style="display:none;margin-top:16px"></div>' +
  '</section>';

  document.getElementById("request-search").oninput = renderRequestItems;
  document.getElementById("request-status").onchange = renderRequestItems;
  document.getElementById("requests-refresh").onclick = loadRequests;
  wireRequestCreate();
  loadRequests();
}

function renderRequestItems() {
  const query = (document.getElementById("request-search")?.value || "").trim().toLowerCase();
  const status = document.getElementById("request-status")?.value || "all";
  const rows = requestItems.filter(r =>
    (status === "all" || r.status === status) &&
    [r.requester_handle, r.payer_handle, r.note, r.status].join(" ").toLowerCase().includes(query)
  );
  const incoming = rows.filter(r => r.payer_handle === window.currentHandle);
  const outgoing = rows.filter(r => r.requester_handle === window.currentHandle);
  const inc = document.getElementById("incoming-list");
  const out = document.getElementById("outgoing-list");
  if (!inc || !out) return;
  inc.innerHTML = incoming.map(requestRow).join("") || '<div class="small" style="padding:12px 0">None</div>';
  out.innerHTML = outgoing.map(requestRow).join("") || '<div class="small" style="padding:12px 0">None</div>';
  const empty = document.getElementById("empty-requests");
  if (empty) {
    empty.style.display = rows.length ? "none" : "";
    empty.textContent = requestItems.length ? "No requests match these filters." : "No requests yet.";
  }
  const count = document.getElementById("request-count");
  if (count) count.textContent = "Showing " + rows.length + " of " + requestItems.length + " requests";
  wireRequestButtons();
}

async function loadRequests() {
  const error = document.getElementById("request-error");
  try {
    const r = await api("/requests?limit=200");
    const data = await j(r);
    if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Could not load requests");
    requestItems = data.requests || [];
    document.getElementById("request-incoming-count").textContent =
      requestItems.filter(x => x.payer_handle === window.currentHandle && x.status === "pending").length;
    document.getElementById("request-outgoing-count").textContent =
      requestItems.filter(x => x.requester_handle === window.currentHandle && x.status === "pending").length;
    document.getElementById("request-closed-count").textContent =
      requestItems.filter(x => x.status !== "pending").length;
    renderRequestItems();
    if (error) error.style.display = "none";
  } catch (ex) {
    if (error) {
      error.textContent = ex.message;
      error.style.display = "";
    }
  }
}

function requestRow(r) {
  let actions = '';
  if (r.status === "pending" && r.payer_handle === window.currentHandle) {
    actions = '<button class="secondarybtn" data-action="pay" data-rid="' + esc(r.request_id) + '" data-testid="request-pay-' + esc(r.request_id) + '">Pay</button>' +
      '<button class="secondarybtn dangerbtn" data-action="decline" data-rid="' + esc(r.request_id) + '" data-testid="request-decline-' + esc(r.request_id) + '">Decline</button>';
  }
  if (r.status === "pending" && r.requester_handle === window.currentHandle) {
    actions = '<button class="secondarybtn" data-action="cancel" data-rid="' + esc(r.request_id) + '" data-testid="request-cancel-' + esc(r.request_id) + '">Cancel</button>';
  }
  return '<div class="row" data-status="' + esc(r.status) + '" data-testid="request-item-' + esc(r.request_id) + '">' +
    '<div>' +
      '<strong>' + esc(r.requester_handle) + ' → ' + esc(r.payer_handle) + '</strong>' +
      '<div class="small">' + esc(r.note || "No memo") + ' · <span style="text-transform:capitalize">' + esc(r.status) + '</span></div>' +
    '</div>' +
    '<div style="text-align:right">' +
      '<strong data-testid="request-amount-' + esc(r.request_id) + '" style="font-family:var(--font-mono)">' + esc(money(r.amount, window.currentMu, window.currentCurrency)) + '</strong>' +
      '<div class="row-actions" style="margin-top:6px;justify-content:flex-end">' + actions + '</div>' +
    '</div>' +
  '</div>';
}

function wireRequestCreate() {
  const f = document.getElementById("request-form");
  const button = document.getElementById("request-submit");
  if (!f || !button) return;
  f.querySelectorAll("[data-set-req-handle]").forEach(b => {
    b.onclick = () => {
      const inp = document.getElementById("request-handle");
      if (inp) inp.value = b.dataset.setReqHandle;
    };
  });
  let busy = false;
  f.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const errbox = document.getElementById("request-error");
    if (errbox) errbox.style.display = "none";
    busy = true;
    button.disabled = true;
    button.textContent = "Sending...";
    try {
      const body = {
        payer_handle: document.getElementById("request-handle").value.trim(),
        amount: decimalToMinor(document.getElementById("request-amount").value, window.currentMu),
        note: document.getElementById("request-note").value.trim()
      };
      const scope = "POST:/requests";
      const key = idempotencyKey(scope, body);
      const r = await api("/requests", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body)
      });
      const data = await j(r);
      if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Request refused");
      clearIdempotencyKey(scope, body);
      f.reset();
      if (document.getElementById("request-incoming-count")) await loadRequests();
    } catch (ex) {
      if (errbox) {
        errbox.textContent = ex instanceof TypeError
          ? "The outcome is uncertain. Retry without changing these fields."
          : ex.message;
        errbox.style.display = "";
      }
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "Request";
    }
  };
}

function wireRequestButtons() {
  document.querySelectorAll("[data-action]").forEach(b => b.onclick = async () => {
    if (b.disabled) return;
    const action = b.dataset.action;
    const rid = b.dataset.rid;
    const box = document.getElementById("request-error");
    const path = "/requests/" + encodeURIComponent(rid) + "/" + action;
    let actionError = "";
    if (box) box.style.display = "none";
    b.disabled = true;
    b.textContent = "Working...";
    try {
      const opts = { method: "POST" };
      if (action === "pay") {
        const body = {};
        const scope = "POST:" + path;
        opts.headers = { "Idempotency-Key": idempotencyKey(scope, body) };
        opts.body = JSON.stringify(body);
      }
      const r = await api(path, opts);
      const data = await j(r);
      if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Action refused");
    } catch (ex) {
      actionError = ex instanceof TypeError
        ? (action === "pay" ? "The outcome is uncertain. Retry Pay; the same idempotency key will be reused." : "The outcome is uncertain. Refresh the request status before retrying.")
        : ex.message;
    } finally {
      await loadRequests();
      if (actionError && box) {
        box.textContent = actionError;
        box.style.display = "";
      }
    }
  });
}

function renderSplit() {
  app.innerHTML = splitView();
  const a = document.getElementById("split-amount");
  const h = document.getElementById("split-handles");
  const form = document.getElementById("split-form");
  const submit = document.getElementById("split-submit");
  const success = document.getElementById("split-success");
  let busy = false;

  const update = () => {
    const box = document.getElementById("split-preview");
    try {
      const handles = h.value.split(",").map(x => x.trim()).filter(Boolean);
      if (!handles.length) {
        box.innerHTML = '<div class="small">Add participant handles to preview shares.</div>';
        return;
      }
      const amount = decimalToMinor(a.value, window.currentMu);
      const shares = equalSplitClient(amount, handles.length);
      const remainder = amount % handles.length;
      let remNote = remainder > 0
        ? '<div class="small" style="margin-top:12px;color:var(--accent-amber)">Remainder of ' + remainder + ' cent(s) evenly distributed to first ' + remainder + ' participant(s).</div>'
        : '<div class="small" style="margin-top:12px;color:var(--accent-emerald)">Exact division. All participant shares are identical.</div>';

      box.innerHTML = '<div class="sharegrid">' +
        handles.map((x, i) =>
          '<div class="metric">' +
            '<span>Share</span>' +
            '<strong data-testid="split-share-' + esc(x) + '">' + esc(money(shares[i], window.currentMu, window.currentCurrency)) + '</strong>' +
            '<span data-testid="split-share-label-' + esc(x) + '" style="margin-top:4px;color:var(--text-main)">@' + esc(x) + '</span>' +
          '</div>'
        ).join("") +
      '</div>' + remNote;
    } catch (ex) {
      box.innerHTML = '<div class="small" style="color:var(--accent-crimson)">' + esc(ex.message) + '</div>';
    }
  };

  a.oninput = update;
  h.oninput = update;
  document.querySelectorAll("[data-set-split-handles]").forEach(b => {
    b.onclick = () => {
      h.value = b.dataset.setSplitHandles;
      update();
    };
  });
  update();

  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const er = document.getElementById("split-error");
    er.style.display = "none";
    success.style.display = "none";
    busy = true;
    submit.disabled = true;
    submit.textContent = "Creating...";
    try {
      const handles = h.value.split(",").map(x => x.trim()).filter(Boolean);
      const body = {
        amount: decimalToMinor(a.value, window.currentMu),
        participant_handles: handles,
        note: document.getElementById("split-note").value.trim()
      };
      const scope = "POST:/splits";
      const key = idempotencyKey(scope, body);
      const r = await api("/splits", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body)
      });
      const data = await j(r);
      if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Split refused");
      clearIdempotencyKey(scope, body);
      success.textContent = (data.requests || []).length + " payment request(s) created for your participants.";
      success.style.display = "";
    } catch (ex) {
      er.textContent = ex instanceof TypeError
        ? "The outcome is uncertain. Retry without changing the split details."
        : ex.message;
      er.style.display = "";
    } finally {
      busy = false;
      submit.disabled = false;
      submit.textContent = "Create split";
    }
  };
}

function equalSplitClient(amount, n) {
  const base = Math.floor(amount / n);
  const rem = amount % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function authView() {
  return '<div class="grid">' +
    '<section class="card">' +
      '<h2>Reserve money</h2>' +
      '<p class="muted" style="margin-bottom:16px">Create an authorization hold. Held funds reduce available balance but remain in your account until captured or voided.</p>' +
      '<form id="auth-form">' +
        '<label>Recipient handle' +
          '<input id="authorize-handle" data-testid="authorize-handle" placeholder="e.g. bob" autocomplete="off">' +
        '</label>' +
        '<label>Amount' +
          '<input id="authorize-amount" data-testid="authorize-amount" inputmode="decimal" value="20.00">' +
        '</label>' +
        '<label>Note' +
          '<textarea id="authorize-note" data-testid="authorize-note" rows="2" placeholder="e.g. Hotel deposit, equipment reservation"></textarea>' +
        '</label>' +
        '<label>Visibility' +
          '<select id="authorize-visibility" data-testid="authorize-visibility">' +
            '<option value="public">Public</option>' +
            '<option value="private">Private</option>' +
          '</select>' +
        '</label>' +
        '<button id="authorize-submit" data-testid="authorize-submit" type="submit">Reserve</button>' +
        '<div id="authorize-error" data-testid="authorize-error" class="errorbox" role="alert" style="display:none"></div>' +
        '<div id="authorize-success" data-testid="authorize-success" class="ok" role="status" aria-live="polite" style="display:none"></div>' +
      '</form>' +
    '</section>' +
    '<section class="card">' +
      '<h2>Active Reservations</h2>' +
      '<p class="muted" style="margin-bottom:16px">Recipients may capture funds up to the held amount. Senders may void open reservations to release held funds.</p>' +
      '<div id="authorization-list" data-testid="authorization-list"></div>' +
      '<div id="authorization-error" data-testid="authorization-error" class="errorbox" style="display:none"></div>' +
      '<div id="empty-authorizations" data-testid="empty-authorizations" class="empty" style="display:none">None.</div>' +
    '</section>' +
  '</div>';
}

function renderAuth() {
  app.innerHTML = authView();
  const form = document.getElementById("auth-form");
  const button = document.getElementById("authorize-submit");
  const er = document.getElementById("authorize-error");
  const success = document.getElementById("authorize-success");
  let busy = false;

  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    er.style.display = "none";
    success.style.display = "none";
    busy = true;
    button.disabled = true;
    button.textContent = "Reserving...";
    try {
      const body = {
        to_handle: document.getElementById("authorize-handle").value.trim(),
        amount: decimalToMinor(document.getElementById("authorize-amount").value, window.currentMu),
        note: document.getElementById("authorize-note").value.trim(),
        visibility: document.getElementById("authorize-visibility").value
      };
      const scope = "POST:/authorizations";
      const key = idempotencyKey(scope, body);
      const r = await api("/authorizations", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body)
      });
      const data = await j(r);
      if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Reservation refused");
      clearIdempotencyKey(scope, body);
      success.textContent = "Funds reserved until " + new Date(data.expires_at).toLocaleString();
      success.style.display = "";
      await Promise.all([loadAuths(), refreshWallet()]);
    } catch (ex) {
      er.textContent = ex instanceof TypeError
        ? "The outcome is uncertain. Retry without changing these details."
        : ex.message;
      er.style.display = "";
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = "Reserve";
    }
  };
  loadAuths();
}

async function loadAuths() {
  const error = document.getElementById("authorization-error");
  try {
    const r = await api("/authorizations?limit=200");
    const data = await j(r);
    const list = document.getElementById("authorization-list");
    if (!list) return;
    list.innerHTML = (data.authorizations || []).map(a => {
      let actions = "";
      if (a.status === "open" && a.to_handle === window.currentHandle) {
        actions = '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;margin-top:8px">' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<input data-testid="authorization-capture-amount-' + esc(a.authorization_id) + '" data-cap-amt="' + esc(a.authorization_id) + '" data-rem="' + esc(a.remaining_amount) + '" value="' + esc((a.remaining_amount / 10 ** window.currentMu).toFixed(window.currentMu)) + '" style="width:96px;padding:6px 10px;font-size:12px">' +
            '<select data-testid="authorization-capture-final-' + esc(a.authorization_id) + '" style="width:auto;font-size:12px;padding:6px 26px 6px 8px">' +
              '<option value="true" selected>Final (close hold)</option>' +
              '<option value="false">Partial (keep hold open)</option>' +
            '</select>' +
            '<button data-cap="' + esc(a.authorization_id) + '" data-testid="authorization-capture-' + esc(a.authorization_id) + '" style="width:auto;padding:6px 14px;font-size:12px">Capture</button>' +
          '</div>' +
        '</div>';
      }
      if (a.status === "open" && a.from_handle === window.currentHandle) {
        actions += '<div style="margin-top:8px">' +
          '<button class="secondarybtn dangerbtn" data-void="' + esc(a.authorization_id) + '" data-testid="authorization-void-' + esc(a.authorization_id) + '" style="width:auto">Void hold</button>' +
        '</div>';
      }
      const cap = a.status === "captured"
        ? '<div data-testid="authorization-captured-' + esc(a.authorization_id) + '" class="small" style="color:var(--accent-emerald)">Captured: ' + esc(money(a.captured_amount, window.currentMu, window.currentCurrency)) + '</div>'
        : "";

      return '<div class="row" data-status="' + esc(a.status) + '" data-testid="authorization-item-' + esc(a.authorization_id) + '">' +
        '<div>' +
          '<strong>' + esc(a.from_handle) + ' → ' + esc(a.to_handle) + '</strong>' +
          '<div class="small"><span style="text-transform:capitalize">' + esc(a.status) + '</span> · <span data-testid="authorization-expires-' + esc(a.authorization_id) + '">Expires ' + esc(new Date(a.expires_at).toLocaleString()) + '</span></div>' +
          cap +
        '</div>' +
        '<div style="text-align:right">' +
          '<strong data-testid="authorization-amount-' + esc(a.authorization_id) + '" style="font-family:var(--font-mono)">' + esc(money(a.amount, window.currentMu, window.currentCurrency)) + '</strong>' +
          actions +
        '</div>' +
      '</div>';
    }).join("");
    document.getElementById("empty-authorizations").style.display = (data.authorizations || []).length ? "none" : "";

    document.querySelectorAll("[data-cap-amt]").forEach(inp => {
      inp.oninput = () => {
        const id = inp.dataset.capAmt;
        const rem = Number(inp.dataset.rem);
        const sel = document.querySelector('[data-testid="authorization-capture-final-' + CSS.escape(id) + '"]');
        if (sel) {
          try {
            const val = decimalToMinor(inp.value, window.currentMu);
            sel.value = val < rem ? "false" : "true";
          } catch {
            // ignore
          }
        }
      };
    });

    document.querySelectorAll("[data-cap]").forEach(b => b.onclick = async () => {
      if (b.disabled) return;
      const er = document.getElementById("authorization-error");
      if (er) er.style.display = "none";
      b.disabled = true;
      b.textContent = "Capturing...";
      const id = b.dataset.cap;
      const path = "/authorizations/" + encodeURIComponent(id) + "/capture";
      const inp = document.querySelector('[data-testid="authorization-capture-amount-' + CSS.escape(id) + '"]');
      const finalSel = document.querySelector('[data-testid="authorization-capture-final-' + CSS.escape(id) + '"]');
      const isFinal = finalSel ? finalSel.value === "true" : true;
      try {
        const body = {
          amount: decimalToMinor(inp.value, window.currentMu),
          final: isFinal
        };
        const scope = "POST:" + path;
        const key = idempotencyKey(scope, body);
        const r = await api(path, {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body)
        });
        const data = await j(r);
        if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Capture refused");
        clearIdempotencyKey(scope, body);
      } catch (ex) {
        if (er) {
          er.textContent = ex instanceof TypeError
            ? "The outcome is uncertain. Retry Capture; the same key will be reused."
            : ex.message;
          er.style.display = "";
        }
      }
      await Promise.all([loadAuths(), refreshWallet()]);
    });

    document.querySelectorAll("[data-void]").forEach(b => b.onclick = async () => {
      if (b.disabled) return;
      const er = document.getElementById("authorization-error");
      if (er) er.style.display = "none";
      b.disabled = true;
      b.textContent = "Voiding...";
      try {
        const r = await api("/authorizations/" + encodeURIComponent(b.dataset.void) + "/void", { method: "POST" });
        const data = await j(r);
        if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Void refused");
      } catch (ex) {
        if (er) {
          er.textContent = ex instanceof TypeError
            ? "The outcome is uncertain. Refresh the authorization status before retrying."
            : ex.message;
          er.style.display = "";
        }
      }
      await Promise.all([loadAuths(), refreshWallet()]);
    });
  } catch (ex) {
    if (error) {
      error.textContent = ex instanceof TypeError ? "Connection issue. Authorizations may be out of date." : ex.message;
      error.style.display = "";
    }
  }
}

function statementView() {
  return '<section class="card">' +
    '<div class="card-header">' +
      '<div>' +
        '<h1>Account statement</h1>' +
        '<p class="muted">Immutable bitemporal ledger explorer. Date ranges evaluate [from, to) with reproducible snapshots.</p>' +
      '</div>' +
      '<button type="button" id="statement-refresh" data-testid="statement-refresh" class="secondarybtn" style="width:auto">Refresh</button>' +
    '</div>' +
    '<form id="statement-filters" data-testid="statement-filters" class="toolbar">' +
      '<label>From instant' +
        '<input id="statement-from" data-testid="statement-from" type="datetime-local">' +
      '</label>' +
      '<label>To instant' +
        '<input id="statement-to" data-testid="statement-to" type="datetime-local">' +
      '</label>' +
      '<label>Known as of' +
        '<input id="statement-known" data-testid="statement-known" type="datetime-local">' +
      '</label>' +
      '<button type="submit" data-testid="statement-submit" style="width:auto;height:44px">Apply filters</button>' +
    '</form>' +
    '<div class="small" style="color:var(--text-subtle)">“Known as of” reconstructs what the system knew at a past point in time before subsequent revisions or retroactive corrections.</div>' +
    '<div id="statement-error" data-testid="statement-error" class="errorbox" role="alert" style="display:none;margin-top:16px"></div>' +
    '<div id="statement-loading" data-testid="statement-loading" class="empty" role="status" style="margin-top:16px">Loading statement…</div>' +
    '<div id="statement-content" style="display:none">' +
      '<div class="statement-summary">' +
        '<div class="metric"><strong id="statement-opening" data-testid="statement-opening"></strong><span>Opening balance</span></div>' +
        '<div class="metric"><strong id="statement-closing" data-testid="statement-closing"></strong><span>Closing balance</span></div>' +
        '<div class="metric"><strong id="statement-count" data-testid="statement-count"></strong><span>Entries in this view</span></div>' +
      '</div>' +
      '<div id="statement-range" data-testid="statement-range" class="small" style="margin-bottom:14px;color:var(--text-muted)"></div>' +
      '<div id="statement-entries" data-testid="statement-entries"></div>' +
      '<div id="statement-empty" data-testid="statement-empty" class="empty" style="display:none">No ledger entries in this period.</div>' +
      '<div class="row-actions" style="margin-top:18px">' +
        '<button type="button" id="statement-prev" data-testid="statement-prev" class="secondarybtn" style="width:auto">Previous</button>' +
        '<button type="button" id="statement-next" data-testid="statement-next" class="secondarybtn" style="width:auto">Next</button>' +
      '</div>' +
    '</div>' +
  '</section>';
}

let statementSnapshot = "", statementOffset = 0;
function localInstant(id) {
  const raw = document.getElementById(id).value;
  return raw ? new Date(raw).toISOString() : "";
}

async function loadStatement(reset = true) {
  const error = document.getElementById("statement-error");
  const loading = document.getElementById("statement-loading");
  const content = document.getElementById("statement-content");
  if (reset) {
    statementSnapshot = "";
    statementOffset = 0;
  }
  error.style.display = "none";
  loading.style.display = "";
  loading.textContent = "Loading statement…";
  content.style.display = "none";
  try {
    const q = new URLSearchParams({ limit: "50", offset: String(statementOffset) });
    if (statementSnapshot) q.set("snapshot", statementSnapshot);
    else {
      for (const [id, key] of [["statement-from", "from"], ["statement-to", "to"], ["statement-known", "known_at"]]) {
        const v = localInstant(id);
        if (v) q.set(key, v);
      }
    }
    const r = await api("/statement?" + q.toString());
    const data = await j(r);
    if (!r.ok) throw new Error(data.error?.message || data.error?.code || "Could not load statement");
    statementSnapshot = data.snapshot;
    document.getElementById("statement-opening").textContent = money(data.opening_balance, window.currentMu, window.currentCurrency);
    document.getElementById("statement-closing").textContent = money(data.closing_balance, window.currentMu, window.currentCurrency);
    document.getElementById("statement-count").textContent = String(data.entries.length);
    document.getElementById("statement-range").textContent = "Period: " + (data.snapshot_range.from || "Beginning") + " to " + (data.snapshot_range.to || "Now") + (data.known_at ? " · Known at " + data.known_at : "");
    const rows = data.entries || [];
    document.getElementById("statement-entries").innerHTML = rows.map(e => {
      const p = e.payment;
      const refund = STAGE >= 4 && p.to_handle === window.currentHandle && !p.refund_of
        ? '<div style="display:flex;gap:6px;align-items:center;margin-top:6px">' +
            '<input data-refund-input="' + esc(p.payment_id) + '" value="' + esc((p.amount / 10 ** window.currentMu).toFixed(window.currentMu)) + '" style="width:96px;padding:5px 8px;font-size:12px">' +
            '<button class="secondarybtn" data-refund="' + esc(p.payment_id) + '" data-amount="' + esc(p.amount) + '" style="padding:5px 10px;font-size:12px">Refund</button>' +
          '</div>'
        : '';
      return '<div class="row">' +
        '<div>' +
          '<strong>' + esc(p.from_handle) + ' → ' + esc(p.to_handle) + '</strong>' +
          '<div class="small">' + esc(p.note || "Payment") + ' · ' + esc(e.effective_at) + ' · rev ' + esc(e.revision) + '</div>' +
          '<button class="secondarybtn" data-rev-btn="' + esc(p.payment_id) + '" style="width:auto;padding:2px 8px;font-size:11px;margin-top:4px">Revisions (' + esc(e.revision) + ')</button>' +
          '<div id="rev-box-' + esc(p.payment_id) + '" style="display:none;margin-top:6px;padding:8px;background:rgba(255,255,255,0.03);border:1px solid var(--border-card);border-radius:8px;font-size:11px;text-align:left"></div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<strong style="font-family:var(--font-mono)">' + esc(money(e.delta, window.currentMu, window.currentCurrency)) + '</strong>' +
          '<div class="small" style="font-family:var(--font-mono)">Balance ' + esc(money(e.balance_after, window.currentMu, window.currentCurrency)) + '</div>' +
          refund +
        '</div>' +
      '</div>';
    }).join("");
    document.getElementById("statement-empty").style.display = rows.length ? "none" : "";
    document.getElementById("statement-prev").disabled = statementOffset === 0;
    document.getElementById("statement-next").disabled = !data.has_more;
    document.getElementById("statement-prev").onclick = () => {
      statementOffset = Math.max(0, statementOffset - 50);
      loadStatement(false);
    };
    document.getElementById("statement-next").onclick = () => {
      statementOffset += 50;
      loadStatement(false);
    };

    document.querySelectorAll("[data-rev-btn]").forEach(b => {
      b.onclick = async () => {
        const pid = b.dataset.revBtn;
        const box = document.getElementById("rev-box-" + pid);
        if (!box) return;
        if (box.style.display !== "none") {
          box.style.display = "none";
          return;
        }
        box.style.display = "";
        box.innerHTML = '<span class="small">Loading revisions…</span>';
        try {
          const r = await api("/payments/" + encodeURIComponent(pid) + "/revisions");
          const d = await j(r);
          const revs = d.revisions || [];
          box.innerHTML = '<div style="margin-bottom:4px;font-weight:600">Revisions Chain:</div>' +
            revs.map(rv => '<div class="small" style="margin-bottom:2px">Rev ' + rv.revision + ': ' + esc(money(rv.amount, window.currentMu, window.currentCurrency)) + ' · ' + esc(rv.reason || "original") + ' · <span style="font-family:var(--font-mono)">' + esc(rv.recorded_at) + '</span></div>').join("");
        } catch (ex) {
          box.innerHTML = '<span class="small" style="color:var(--accent-crimson)">' + esc(ex.message) + '</span>';
        }
      };
    });

    document.querySelectorAll("[data-refund]").forEach(b => b.onclick = async () => {
      const amt = Number(b.dataset.amount);
      const inp = document.querySelector('[data-refund-input="' + CSS.escape(b.dataset.refund) + '"]');
      const raw = inp ? inp.value : (amt / 10 ** window.currentMu).toFixed(window.currentMu);
      let amount;
      try {
        amount = decimalToMinor(raw, window.currentMu);
      } catch (ex) {
        error.textContent = ex.message;
        error.style.display = "";
        return;
      }
      if (amount < 1 || amount > amt) {
        error.textContent = "Refund must be positive and cannot exceed this payment.";
        error.style.display = "";
        return;
      }
      b.disabled = true;
      try {
        const path = "/payments/" + encodeURIComponent(b.dataset.refund) + "/refunds";
        const refundBody = { amount };
        const scope = "POST:" + path;
        const rr = await api(path, {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey(scope, refundBody) },
          body: JSON.stringify(refundBody)
        });
        const rd = await j(rr);
        if (!rr.ok) throw new Error(rd.error?.message || rd.error?.code || "Refund refused");
        clearIdempotencyKey(scope, refundBody);
        await loadStatement(true);
      } catch (ex) {
        error.textContent = ex instanceof TypeError
          ? "The outcome is uncertain. Retry this refund with the same amount."
          : ex.message;
        error.style.display = "";
        b.disabled = false;
      }
    });

    loading.style.display = "none";
    content.style.display = "";
  } catch (ex) {
    loading.textContent = "Statement unavailable.";
    error.textContent = ex.message;
    error.style.display = "";
  }
}

function authFormsPage(kind) {
  const signup = kind === "signup";
  const buttonLabel = signup ? "Create account" : "Log in";
  app.innerHTML = '<div class="auth-wrapper">' +
    '<section class="card">' +
      '<h1>' + (signup ? "Create account" : "Welcome back") + '</h1>' +
      '<p class="muted" style="margin-bottom:20px">Institutional-grade ledger with idempotent writes and exact minor unit accounting.</p>' +
      '<form id="auth-form">' +
        (signup
          ? '<label>Email<input id="signup-email" data-testid="signup-email" type="email" autocomplete="email" placeholder="name@domain.com" required></label>' +
            '<label>Display name<input id="signup-display-name" data-testid="signup-display-name" autocomplete="name" placeholder="Full name or alias" required></label>' +
            '<label>Password<input id="signup-password" data-testid="signup-password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" required></label>'
          : '<label>Email<input id="login-email" data-testid="login-email" type="email" autocomplete="email" value="ada@pocketful.dev" required></label>' +
            '<label>Password<input id="login-password" data-testid="login-password" type="password" autocomplete="current-password" value="password123" required></label>'
        ) +
        '<button data-testid="' + (signup ? "signup-submit" : "login-submit") + '" type="submit">' + buttonLabel + '</button>' +
        '<div id="auth-error" data-testid="auth-error" class="errorbox" role="alert" style="display:none"></div>' +
      '</form>' +
      (!signup ? '<div class="demo-preset-box">' +
        '<div class="demo-preset-label">One-click test accounts</div>' +
        '<div style="display:grid;gap:6px">' +
          '<button type="button" class="secondarybtn" style="text-align:left;justify-content:flex-start;font-size:12px;padding:8px 12px" data-cred="ada@pocketful.dev"><strong>Ada Lovelace</strong> · ada@pocketful.dev</button>' +
          '<button type="button" class="secondarybtn" style="text-align:left;justify-content:flex-start;font-size:12px;padding:8px 12px" data-cred="bob@pocketful.dev"><strong>Bob Stone</strong> · bob@pocketful.dev</button>' +
          '<button type="button" class="secondarybtn" style="text-align:left;justify-content:flex-start;font-size:12px;padding:8px 12px" data-cred="cy@pocketful.dev"><strong>Cy Young</strong> · cy@pocketful.dev</button>' +
        '</div>' +
      '</div>' : '') +
      '<div style="margin-top:20px;text-align:center" class="small">' +
        (signup
          ? 'Already have an account? <a href="/login" style="color:var(--accent-emerald);text-decoration:none;font-weight:600">Log in</a>'
          : 'Need an account? <a href="/signup" style="color:var(--accent-emerald);text-decoration:none;font-weight:600">Sign up</a>') +
      '</div>' +
    '</section>' +
  '</div>';

  window.fillCreds = email => {
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = "password123";
  };
  document.querySelectorAll("[data-cred]").forEach(b => {
    b.onclick = () => fillCreds(b.dataset.cred);
  });

  const form = document.getElementById("auth-form");
  const button = form.querySelector("button");
  const error = document.getElementById("auth-error");
  let busy = false;

  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = signup ? "Creating account..." : "Signing in...";
    error.style.display = "none";
    try {
      const obj = signup
        ? {
            email: document.getElementById("signup-email").value.trim(),
            password: document.getElementById("signup-password").value,
            display_name: document.getElementById("signup-display-name").value.trim()
          }
        : {
            email: document.getElementById("login-email").value.trim(),
            password: document.getElementById("login-password").value
          };
      const r = await fetch(signup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(obj)
      });
      const data = await j(r);
      if (!r.ok) throw new Error(data.error?.code || data.error?.message || "Authentication failed");
      localStorage.setItem(tokenKey, data.token);
      location.href = "/";
    } catch (ex) {
      error.textContent = ex instanceof TypeError
        ? (signup ? "The result is uncertain. Try logging in before creating the account again." : "Connection issue. Check your connection and try signing in again.")
        : ex.message;
      error.style.display = "";
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  };
}

async function render() {
  if (ROUTE === "/login") {
    setUserBar(null);
    authFormsPage("login");
    return;
  }
  if (ROUTE === "/signup") {
    setUserBar(null);
    authFormsPage("signup");
    return;
  }
  const me = await loadMe();
  window.currentUser = me;
  window.currentHandle = me?.handle || "";
  window.currentMu = me?.minor_units ?? 2;
  window.currentCurrency = me?.currency || "EUR";
  if (!me) {
    location.href = "/login";
    return;
  }
  if (ROUTE === "/") {
    app.innerHTML = walletView() + requestForm() + (STAGE >= 4 ? demoFundView() : "");
    wireRequestCreate();
    document.querySelectorAll("[data-set-handle]").forEach(b => {
      b.onclick = () => {
        const inp = document.getElementById("pay-handle");
        if (inp) inp.value = b.dataset.setHandle;
      };
    });
    document.querySelectorAll("[data-set-amount]").forEach(b => {
      b.onclick = () => {
        const inp = document.getElementById("pay-amount");
        if (inp) inp.value = b.dataset.setAmount;
      };
    });
    document.getElementById("wallet-refresh").onclick = refreshWallet;
    document.getElementById("activity-search").oninput = renderActivity;
    document.getElementById("activity-filter").onchange = renderActivity;
    document.getElementById("activity-export").onclick = exportActivity;

    if (STAGE >= 4) {
      document.getElementById("demo-fund").onclick = async () => {
        const b = document.getElementById("demo-fund");
        const fb = document.getElementById("fund-feedback");
        if (b.disabled) return;
        b.disabled = true;
        fb.textContent = "Adding simulated funds...";
        try {
          const path = "/demo/fund";
          const body = {};
          const scope = "POST:" + path;
          const key = idempotencyKey(scope, body);
          const r = await api(path, {
            method: "POST",
            headers: { "Idempotency-Key": key },
            body: JSON.stringify(body)
          });
          const d = await j(r);
          if (!r.ok) throw new Error(d.error?.message || d.error?.code || "Demo funding unavailable");
          clearIdempotencyKey(scope, body);
          fb.textContent = money(d.credited, window.currentMu, d.currency) + " simulated demo funds added.";
          await refreshWallet();
        } catch (ex) {
          fb.textContent = ex instanceof TypeError
            ? "Outcome uncertain. Retry to safely reuse the same demo funding request."
            : ex.message;
        } finally {
          b.disabled = false;
        }
      };
    }

    document.getElementById("pay-form").onsubmit = async e => {
      e.preventDefault();
      if (paySubmitting) return;
      const sendButton = document.querySelector("[data-testid=pay-submit]");
      paySubmitting = true;
      sendButton.disabled = true;
      sendButton.textContent = "Sending…";
      dropPayBox("pay-error");
      dropPayBox("pay-uncertain");
      try {
        const body = payBody();
        const s = sig(body);
        ensurePayKey(s);
        const r = await api("/payments", {
          method: "POST",
          headers: { "Idempotency-Key": payKey },
          body: JSON.stringify(body)
        });
        const d = await j(r);
        if (!r.ok) throw new Error(d.error?.code || d.error?.message || "Payment refused");
        paySig = "";
        payKey = crypto.randomUUID();
        await refreshWallet();
      } catch (ex) {
        if (ex instanceof TypeError) {
          const un = payBox("pay-uncertain", "uncertainbox");
          un.textContent = "The outcome is uncertain. Retry this same form without changing a field.";
        } else {
          const er = payBox("pay-error", "errorbox");
          er.textContent = ex.message;
        }
      } finally {
        paySubmitting = false;
        sendButton.disabled = false;
        sendButton.textContent = "Send";
      }
    };

    await refreshWallet();
    return;
  }
  if (ROUTE === "/requests") {
    renderRequestsPage();
    return;
  }
  if (ROUTE === "/split") {
    renderSplit();
    return;
  }
  if (ROUTE === "/authorizations") {
    renderAuth();
    return;
  }
  if (ROUTE === "/statement" && STAGE >= 3) {
    app.innerHTML = statementView();
    document.getElementById("statement-filters").onsubmit = e => {
      e.preventDefault();
      loadStatement(true);
    };
    document.getElementById("statement-refresh").onclick = () => loadStatement(true);
    loadStatement();
    return;
  }
}

function initAiAssistant() {
  const panel = document.getElementById("ai-assistant-panel");
  const closeBtn = document.getElementById("ai-assistant-close");
  const form = document.getElementById("ai-assistant-form");
  const input = document.getElementById("ai-assistant-input");
  const submit = document.getElementById("ai-assistant-submit");
  const msgBox = document.getElementById("ai-assistant-messages");
  if (!panel || !form || !input || !msgBox) return;

  if (closeBtn) closeBtn.onclick = () => { panel.style.display = "none"; };

  const ask = async (q) => {
    const text = (q || input.value || "").trim();
    if (!text || submit.disabled) return;
    input.value = "";
    msgBox.insertAdjacentHTML("beforeend", '<div class="ai-msg ai-msg-user">' + esc(text) + '</div>');
    msgBox.insertAdjacentHTML("beforeend", '<div class="ai-msg ai-msg-bot" id="ai-loading">Thinking…</div>');
    msgBox.scrollTop = msgBox.scrollHeight;
    submit.disabled = true;
    try {
      const r = await api("/api/ai/assistant", {
        method: "POST",
        body: JSON.stringify({ message: text })
      });
      const d = await j(r);
      document.getElementById("ai-loading")?.remove();
      const reply = d.reply || (d.error?.message ? "Error: " + d.error.message : "No response available.");
      msgBox.insertAdjacentHTML("beforeend", '<div class="ai-msg ai-msg-bot">' + esc(reply) + '</div>');
    } catch (e) {
      document.getElementById("ai-loading")?.remove();
      msgBox.insertAdjacentHTML("beforeend", '<div class="ai-msg ai-msg-bot" style="color:var(--accent-crimson)">' + esc(e.message || "Failed to reach AI assistant") + '</div>');
    } finally {
      submit.disabled = false;
      msgBox.scrollTop = msgBox.scrollHeight;
    }
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    ask();
  };

  document.querySelectorAll(".ai-prompt").forEach(b => {
    b.onclick = () => {
      const q = b.dataset.q;
      if (q) ask(q);
    };
  });
}

initAiAssistant();
render();
</script>
</body>
</html>`;
}
