import crypto from "node:crypto";
import express, { Request, Response, NextFunction } from "express";
import {
  Store,
  PocketError,
  err,
  iso,
  parseDt,
  tsKey,
  parseDtUs,
  formatMicrosecondsIso,
  monotonicMicroseconds,
  newId,
  hashPassword,
  checkPassword,
  equalSplit,
  MAX_NOTE,
  KEY_MAX,
  HANDLE_RE,
  EMAIL_RE,
  nowDt,
  STAGE,
} from "./core.js";
import { uiHtml } from "./ui.js";

const DB_PATH = process.env.POCKETFUL_DB || "/tmp/pocketful/state.json";
export const store = new Store(DB_PATH);
export const app = express();

app.use(express.text({ type: "*/*", limit: "5mb" }));

function parseBody(req: Request): any {
  try {
    const obj = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      err(400, "malformed_request");
    }
    return obj;
  } catch (e) {
    if (e instanceof PocketError) throw e;
    err(400, "malformed_request");
  }
}

function token(req: Request): string {
  const raw = req.header("authorization") || "";
  if (!raw.startsWith("Bearer ")) {
    err(401, "unauthenticated");
  }
  return raw.slice(7).trim();
}

function isHtml(req: Request): boolean {
  const auth = req.header("authorization") || "";
  if (auth.startsWith("Bearer ")) return false;
  const acc = req.header("accept") || "";
  return acc.includes("text/html") || acc.includes("*/*") || !acc;
}

function qint(req: Request, name: string, defVal: number, maxv = 200, minv = 1): number {
  const raw = req.query[name];
  if (raw === undefined) return defVal;
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    err(422, "validation_failed");
  }
  const v = parseInt(raw, 10);
  if (v < minv || v > maxv) {
    err(422, "validation_failed");
  }
  return v;
}

function qoffset(req: Request): number {
  const raw = req.query.offset;
  if (raw === undefined) return 0;
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) {
    err(422, "validation_failed");
  }
  return parseInt(raw, 10);
}

function instantParam(req: Request, name: string): string | null {
  if (!(name in req.query)) return null;
  const raw = req.query[name];
  if (typeof raw !== "string") err(422, "validation_failed");
  try {
    parseDt(raw);
  } catch {
    err(422, "validation_failed");
  }
  return raw;
}

function requireWriteKey(req: Request): string {
  const k = req.header("Idempotency-Key");
  if (!k) err(400, "missing_idempotency_key");
  if (k.length > KEY_MAX) err(422, "validation_failed");
  return k;
}

function authUser(st: any, req: Request): any {
  return store.activeUser(st, token(req));
}

function replayOrNone(st: any, u: any, key: string, bodyObj: any, method: string, pathStr: string): any {
  return store.idemReplay(st, u, key, method, pathStr, bodyObj);
}

function requireStage(n: number): void {
  if (STAGE < n) err(404, "not_found");
}

function findPayment(st: any, pid: string): any {
  return st.payments.find((p: any) => p.payment_id === pid) ?? null;
}

function isDemoLoginEnabled(): boolean {
  const raw = (process.env.POCKETFUL_DEMO_LOGIN ?? "1").toLowerCase();
  return STAGE >= 4 && ["1", "true", "yes", "on"].includes(raw);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/_test/export", (_req, res) => {
  res.json({ track: "pocketful", format_version: 1, state: store.export() });
});

app.post("/_test/reset", (req, res) => {
  const fx = parseBody(req);
  store.reset(fx);
  res.status(204).end();
});

app.post("/_test/import", (req, res) => {
  const obj = parseBody(req);
  if (
    obj.track !== "pocketful" ||
    obj.format_version !== 1 ||
    !obj.state ||
    typeof obj.state !== "object" ||
    Array.isArray(obj.state)
  ) {
    err(422, "validation_failed");
  }
  const st = obj.state;
  if (
    st.track !== "pocketful" ||
    st.format_version !== 1 ||
    !st.users ||
    typeof st.users !== "object" ||
    Array.isArray(st.users)
  ) {
    err(422, "validation_failed");
  }
  store.replace(st);
  res.status(204).end();
});

app.post("/auth/signup", (req, res) => {
  const obj = parseBody(req);
  const { email, password, display_name: display } = obj;
  if (typeof email !== "string" || typeof password !== "string" || typeof display !== "string") {
    err(400, "malformed_request");
  }
  if (!EMAIL_RE.test(email) || password.length < 8) {
    err(422, "validation_failed");
  }
  const out = store.mutate((st) => {
    for (const u of Object.values(st.users) as any[]) {
      if (u.email === email) err(409, "email_taken");
    }
    const local = email.split("@")[0].toLowerCase();
    const handle = local.replace(/[^a-z0-9_]/g, "_").slice(0, 20);
    if (!HANDLE_RE.test(handle)) err(422, "validation_failed");
    if (store.userByHandle(st, handle) !== null) err(409, "handle_taken");
    const uid = newId("u");
    st.users[uid] = {
      id: uid,
      email,
      password_hash: hashPassword(password),
      display_name: display,
      handle,
      balance: 0,
    };
    st.opening_balances[uid] = 0;
    const tok = crypto.randomBytes(32).toString("base64url");
    st.tokens[tok] = uid;
    return { user_id: uid, display_name: display, token: tok };
  });
  res.status(201).json(out);
});

app.post("/auth/login", (req, res) => {
  const obj = parseBody(req);
  const { email, password } = obj;
  if (typeof email !== "string" || typeof password !== "string") {
    err(400, "malformed_request");
  }
  const demoLogin = isDemoLoginEnabled();
  if (!email || !password || !EMAIL_RE.test(email)) {
    err(422, "validation_failed");
  }
  const out = store.mutate((st) => {
    let u = (Object.values(st.users) as any[]).find((x) =>
      STAGE >= 4 ? x.email.toLowerCase() === email.toLowerCase() : x.email === email
    );
    if (!u && demoLogin) {
      const local = email.split("@")[0].toLowerCase();
      const base =
        local
          .replace(/[^a-z0-9_]/g, "_")
          .slice(0, 14)
          .replace(/^_+|_+$/g, "") || "guest";
      let handle = base;
      if (store.userByHandle(st, handle) !== null) {
        handle = `${base.slice(0, 13)}_${crypto.randomBytes(3).toString("hex")}`.slice(0, 20);
      }
      const uid = newId("u");
      const displayName = local.slice(0, 40) || "Guest";
      u = {
        id: uid,
        email,
        password_hash: hashPassword(password),
        display_name: displayName,
        handle,
        balance: 0,
      };
      st.users[uid] = u;
      st.opening_balances[uid] = 0;
    } else if (!u) {
      err(401, "unauthenticated");
    } else if (!checkPassword(password, u.password_hash)) {
      err(401, "unauthenticated");
    }
    const tok = crypto.randomBytes(32).toString("base64url");
    st.tokens[tok] = u.id;
    return { user_id: u.id, display_name: u.display_name, token: tok };
  });
  res.json(out);
});

app.get("/me", (req, res) => {
  const st = store.read();
  const u = authUser(st, req);
  const asOf = STAGE >= 3 ? instantParam(req, "as_of") : null;
  const knownAt = STAGE >= 3 ? instantParam(req, "known_at") : null;
  res.json(store.me(st, u, asOf, knownAt));
});

app.post("/demo/fund", (req, res) => {
  requireStage(4);
  if (!isDemoLoginEnabled()) err(404, "not_found");
  const obj = parseBody(req);
  if (Object.keys(obj).length > 0) err(422, "validation_failed");
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/demo/fund");
    if (replay !== null) return { status: 200, body: replay };
    const credit = st.minor_units === 2 ? 2500 : st.minor_units === 0 ? 25 : 25000;
    if (u.balance + credit > 100000 * 10 ** Math.max(0, st.minor_units - 2)) {
      err(409, "demo_fund_limit", "Demo balance limit reached");
    }
    u.balance += credit;
    st.opening_balances[u.id] = (st.opening_balances[u.id] || 0) + credit;
    const out = { credited: credit, currency: st.currency, balance: u.balance, demo_only: true };
    store.recordIdem(st, u, key, "POST", "/demo/fund", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/payments", (req, res) => {
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/payments");
    if (replay !== null) return { status: 200, body: replay };
    if (!("to_handle" in obj) || !("amount" in obj)) err(422, "validation_failed");
    if (typeof obj.to_handle !== "string") err(400, "malformed_request");
    const amount = store.validateAmount(obj.amount);
    const note = obj.note ?? "";
    const vis = obj.visibility ?? "public";
    store.validateNoteVisibility(note, vis);
    const p = store.transfer(st, u, obj.to_handle, amount, note, vis);
    const out = store.serializePayment(st, p);
    store.recordIdem(st, u, key, "POST", "/payments", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/requests", (req, res) => {
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/requests");
    if (replay !== null) return { status: 200, body: replay };
    if (!("payer_handle" in obj) || !("amount" in obj)) err(422, "validation_failed");
    if (typeof obj.payer_handle !== "string") err(400, "malformed_request");
    const payer = store.userByHandle(st, obj.payer_handle);
    if (!payer) err(404, "not_found");
    if (payer.id === u.id) err(422, "self_request");
    const amount = store.validateAmount(obj.amount);
    const note = obj.note ?? "";
    if (typeof note !== "string" || note.length > MAX_NOTE) err(422, "validation_failed");
    const r = {
      request_id: newId("rq"),
      requester_id: u.id,
      payer_id: payer.id,
      amount,
      currency: st.currency,
      note,
      status: "pending",
      payment_id: null,
      created_at: iso(),
    };
    st.requests.push(r);
    const out = store.serializeRequest(st, r);
    store.recordIdem(st, u, key, "POST", "/requests", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.get("/requests", (req, res) => {
  if (isHtml(req)) {
    res.type("html").send(uiHtml("/requests"));
    return;
  }
  const st = store.read();
  const u = authUser(st, req);
  const direction = req.query.direction as string | undefined;
  const status = req.query.status as string | undefined;
  if (direction !== undefined && !["incoming", "outgoing"].includes(direction)) {
    err(422, "validation_failed");
  }
  if (status !== undefined && !["pending", "paid", "declined", "cancelled"].includes(status)) {
    err(422, "validation_failed");
  }
  const limit = qint(req, "limit", 50);
  const offset = qoffset(req);
  const rows: any[] = [];
  for (const r of st.requests) {
    if (r.requester_id !== u.id && r.payer_id !== u.id) continue;
    if (direction === "incoming" && r.payer_id !== u.id) continue;
    if (direction === "outgoing" && r.requester_id !== u.id) continue;
    if (status && r.status !== status) continue;
    rows.push(store.serializeRequest(st, r));
  }
  rows.sort(
    (a, b) => tsKey(b.created_at) - tsKey(a.created_at) || b.request_id.localeCompare(a.request_id)
  );
  res.json({ requests: rows.slice(offset, offset + limit), has_more: offset + limit < rows.length });
});

app.post("/requests/:rid/pay", (req, res) => {
  const { rid } = req.params;
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", `/requests/${rid}/pay`);
    if (replay !== null) return { status: 200, body: replay };
    const r = st.requests.find((x: any) => x.request_id === rid);
    if (!r) err(404, "not_found");
    if (r.payer_id !== u.id) err(403, "forbidden");
    if (r.status !== "pending") err(409, "request_not_pending");
    const vis = obj.visibility ?? "public";
    if (vis !== "public" && vis !== "private") err(422, "validation_failed");
    const p = store.transfer(st, u, st.users[r.requester_id].handle, r.amount, r.note, vis, rid);
    const out = store.serializePayment(st, p);
    store.recordIdem(st, u, key, "POST", `/requests/${rid}/pay`, obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/requests/:rid/decline", (req, res) => {
  const { rid } = req.params;
  const out = store.mutate((st) => {
    const u = authUser(st, req);
    const r = st.requests.find((x: any) => x.request_id === rid);
    if (!r) err(404, "not_found");
    if (r.payer_id !== u.id) err(403, "forbidden");
    if (r.status === "declined") return store.serializeRequest(st, r);
    if (r.status !== "pending") err(409, "request_not_pending");
    r.status = "declined";
    return store.serializeRequest(st, r);
  });
  res.json(out);
});

app.post("/requests/:rid/cancel", (req, res) => {
  const { rid } = req.params;
  const out = store.mutate((st) => {
    const u = authUser(st, req);
    const r = st.requests.find((x: any) => x.request_id === rid);
    if (!r) err(404, "not_found");
    if (r.requester_id !== u.id) err(403, "forbidden");
    if (r.status === "cancelled") return store.serializeRequest(st, r);
    if (r.status !== "pending") err(409, "request_not_pending");
    r.status = "cancelled";
    return store.serializeRequest(st, r);
  });
  res.json(out);
});

app.post("/splits", (req, res) => {
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/splits");
    if (replay !== null) return { status: 200, body: replay };
    if (!("amount" in obj) || !("participant_handles" in obj)) err(422, "validation_failed");
    const amount = store.validateAmount(obj.amount);
    const handles = obj.participant_handles;
    const note = obj.note ?? "";
    if (!Array.isArray(handles)) err(400, "malformed_request");
    if (
      handles.length === 0 ||
      handles.some((h) => typeof h !== "string") ||
      new Set(handles).size !== handles.length
    ) {
      err(422, "validation_failed");
    }
    if (typeof note !== "string" || note.length > MAX_NOTE) err(422, "validation_failed");
    const users = handles.map((h) => {
      const x = store.userByHandle(st, h);
      if (!x) err(404, "not_found");
      return x;
    });
    const shares = equalSplit(amount, users.length);
    const reqs: any[] = [];
    for (let i = 0; i < users.length; i++) {
      const x = users[i];
      const share = shares[i];
      if (x.id === u.id) continue;
      const r = {
        request_id: newId("rq"),
        requester_id: u.id,
        payer_id: x.id,
        amount: share,
        currency: st.currency,
        note,
        status: "pending",
        payment_id: null,
        created_at: iso(),
      };
      st.requests.push(r);
      reqs.push(store.serializeRequest(st, r));
    }
    const out = {
      split_id: newId("sp"),
      amount,
      currency: st.currency,
      note,
      shares: users.map((x, i) => ({ handle: x.handle, amount: shares[i] })),
      requests: reqs,
      created_at: iso(),
    };
    store.recordIdem(st, u, key, "POST", "/splits", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.get("/activity", (req, res) => {
  const st = store.read();
  const u = authUser(st, req);
  const limit = qint(req, "limit", 50);
  const offset = qoffset(req);
  const rows = store.visibleActivity(st, u);
  res.json({ payments: rows.slice(offset, offset + limit), has_more: offset + limit < rows.length });
});

app.post("/settlements", (req, res) => {
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/settlements");
    if (replay !== null) return { status: 200, body: replay };
    if (!st.settlement_operator_ids.includes(u.id)) err(403, "forbidden");
    const transfers = obj.transfers;
    if (!Array.isArray(transfers) || transfers.length < 1 || transfers.length > 32) {
      err(422, "validation_failed");
    }
    const parsed: any[] = [];
    const delta: Record<string, number> = {};
    for (const t of transfers) {
      if (!t || typeof t !== "object" || !("from_handle" in t) || !("to_handle" in t) || !("amount" in t)) {
        err(422, "validation_failed");
      }
      const sender = store.userByHandle(st, t.from_handle);
      const receiver = store.userByHandle(st, t.to_handle);
      if (!sender || !receiver) err(404, "not_found");
      if (sender.id === receiver.id) err(422, "self_payment");
      const amt = store.validateAmount(t.amount);
      const note = t.note ?? "";
      const vis = t.visibility ?? "public";
      store.validateNoteVisibility(note, vis);
      parsed.push({ sender, receiver, amt, note, vis });
      delta[sender.id] = (delta[sender.id] || 0) - amt;
      delta[receiver.id] = (delta[receiver.id] || 0) + amt;
    }
    const held = store.heldMap(st);
    for (const [uid, dd] of Object.entries(delta)) {
      if (st.users[uid].balance - (held[uid] || 0) + dd < 0) err(409, "insufficient_funds");
    }
    const sid = newId("set");
    const committed = iso();
    const outs: any[] = [];
    for (const { sender, receiver, amt, note, vis } of parsed) {
      sender.balance -= amt;
      receiver.balance += amt;
      const p = store.makePayment(
        st,
        newId("p"),
        sender.id,
        receiver.id,
        amt,
        note,
        vis,
        null,
        null,
        sid,
        null,
        committed
      );
      st.payments.push(p);
      outs.push(store.serializePayment(st, p));
    }
    st.settlements.push({
      settlement_id: sid,
      committed_at: committed,
      payment_ids: st.payments.filter((p: any) => p.settlement_id === sid).map((p: any) => p.payment_id),
    });
    const out = { settlement_id: sid, committed_at: committed, payments: outs };
    store.recordIdem(st, u, key, "POST", "/settlements", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/authorizations", (req, res) => {
  requireStage(2);
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/authorizations");
    if (replay !== null) return { status: 200, body: replay };
    if (!("to_handle" in obj) || !("amount" in obj)) err(422, "validation_failed");
    if (typeof obj.to_handle !== "string") err(422, "validation_failed");
    const target = store.userByHandle(st, obj.to_handle);
    if (!target) err(404, "not_found");
    if (target.id === u.id) err(422, "self_payment");
    const amount = store.validateAmount(obj.amount);
    const note = obj.note ?? "";
    const vis = obj.visibility ?? "public";
    store.validateNoteVisibility(note, vis);
    const held = store.heldMap(st)[u.id] || 0;
    if (u.balance - held < amount) err(409, "insufficient_funds");
    const createdDt = nowDt();
    const created = iso(createdDt);
    const exp = iso(new Date(createdDt.getTime() + st.authorization_ttl_seconds * 1000));
    const a = {
      authorization_id: newId("a"),
      from_user_id: u.id,
      to_user_id: target.id,
      amount,
      captured_amount: 0,
      currency: st.currency,
      note,
      visibility: vis,
      status: "open",
      expires_at: exp,
      payment_id: null,
      payment_ids: [],
      created_at: created,
      closed_at: null,
    };
    st.authorizations.push(a);
    const out = store.serializeAuth(st, a);
    store.recordIdem(st, u, key, "POST", "/authorizations", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/authorizations/:aid/capture", (req, res) => {
  requireStage(2);
  const { aid } = req.params;
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", `/authorizations/${aid}/capture`);
    if (replay !== null) return { status: 200, body: replay };
    const a = st.authorizations.find((x: any) => x.authorization_id === aid);
    if (!a) err(404, "not_found");
    if (a.to_user_id !== u.id) err(403, "forbidden");
    store.expire(st);
    if (a.status === "expired") err(409, "authorization_expired");
    if (a.status !== "open") err(409, "authorization_not_open");
    const rem = a.amount - (a.captured_amount || 0);
    const amount = store.validateAmount(obj.amount ?? rem);
    if (amount > rem) err(422, "capture_exceeds_authorization");
    const final = obj.final ?? true;
    if (typeof final !== "boolean") err(422, "validation_failed");
    const sender = st.users[a.from_user_id];
    const receiver = st.users[a.to_user_id];
    if (sender.balance < amount) err(409, "insufficient_funds");
    sender.balance -= amount;
    receiver.balance += amount;
    const p = store.makePayment(
      st,
      newId("p"),
      sender.id,
      receiver.id,
      amount,
      a.note,
      a.visibility,
      null,
      aid
    );
    st.payments.push(p);
    a.captured_amount = (a.captured_amount || 0) + amount;
    a.payment_id = p.payment_id;
    a.payment_ids = a.payment_ids || [];
    a.payment_ids.push(p.payment_id);
    const remaining = a.amount - a.captured_amount;
    if (final || remaining === 0) {
      a.status = "captured";
      a.closed_at = iso();
    }
    const out = store.serializePayment(st, p);
    store.recordIdem(st, u, key, "POST", `/authorizations/${aid}/capture`, obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/authorizations/:aid/void", (req, res) => {
  requireStage(2);
  const { aid } = req.params;
  const out = store.mutate((st) => {
    const u = authUser(st, req);
    const a = st.authorizations.find((x: any) => x.authorization_id === aid);
    if (!a) err(404, "not_found");
    if (a.from_user_id !== u.id) err(403, "forbidden");
    store.expire(st);
    if (a.status === "voided") return store.serializeAuth(st, a);
    if (a.status !== "open") err(409, "authorization_not_open");
    a.status = "voided";
    a.closed_at = iso();
    return store.serializeAuth(st, a);
  });
  res.json(out);
});

app.get("/authorizations", (req, res) => {
  requireStage(2);
  if (isHtml(req)) {
    res.type("html").send(uiHtml("/authorizations"));
    return;
  }
  const st = store.read();
  const u = authUser(st, req);
  store.expire(st);
  const direction = req.query.direction as string | undefined;
  const status = req.query.status as string | undefined;
  if (direction !== undefined && !["incoming", "outgoing"].includes(direction)) {
    err(422, "validation_failed");
  }
  if (status !== undefined && !["open", "captured", "voided", "expired"].includes(status)) {
    err(422, "validation_failed");
  }
  const limit = qint(req, "limit", 50);
  const offset = qoffset(req);
  const rows: any[] = [];
  for (const a of st.authorizations) {
    if (a.from_user_id !== u.id && a.to_user_id !== u.id) continue;
    if (direction === "outgoing" && a.from_user_id !== u.id) continue;
    if (direction === "incoming" && a.to_user_id !== u.id) continue;
    if (status && a.status !== status) continue;
    rows.push(store.serializeAuth(st, a));
  }
  rows.sort(
    (a, b) =>
      tsKey(b.created_at) - tsKey(a.created_at) ||
      b.authorization_id.localeCompare(a.authorization_id)
  );
  res.json({
    authorizations: rows.slice(offset, offset + limit),
    has_more: offset + limit < rows.length,
  });
});

function statementCompute(
  st: any,
  u: any,
  fromS: string | null,
  toS: string | null,
  limit: number,
  offset: number,
  knownAt: string | null
): any {
  const fUs = fromS ? parseDtUs(fromS) : -9223372036854775808n;
  const tUs = toS ? parseDtUs(toS) : parseDtUs(iso(nowDt()));
  if (fUs > tUs) err(422, "validation_failed");
  const events: Array<{ effUs: bigint; pid: string; p: any; r: any }> = [];
  for (const [p, r] of store.paymentEvents(st, knownAt)) {
    if (p.from_user_id !== u.id && p.to_user_id !== u.id) continue;
    events.push({ effUs: parseDtUs(r.effective_at), pid: p.payment_id, p, r });
  }
  events.sort((a, b) => (a.effUs < b.effUs ? -1 : a.effUs > b.effUs ? 1 : a.pid.localeCompare(b.pid)));
  let running = st.opening_balances[u.id] || 0;
  for (const { effUs, p, r } of events) {
    if (effUs < fUs) {
      running += p.from_user_id === u.id ? -r.amount : r.amount;
    }
  }
  const opening = running;
  const allEntries: any[] = [];
  for (const { effUs, p, r } of events) {
    if (fUs <= effUs && effUs < tUs) {
      const delta = p.from_user_id === u.id ? -r.amount : r.amount;
      running += delta;
      const pay = { ...store.serializePayment(st, p), amount: r.amount };
      allEntries.push({
        payment: pay,
        delta,
        balance_after: running,
        revision: r.revision,
        effective_at: r.effective_at,
        recorded_at: r.recorded_at,
      });
    }
  }
  const closing = running;
  return {
    opening_balance: opening,
    entries: allEntries,
    closing_balance: closing,
    has_more: offset + limit < allEntries.length,
    snapshot_range: { from: fromS, to: toS, known_at: knownAt },
  };
}

app.get("/statement", (req, res) => {
  requireStage(3);
  if (isHtml(req)) {
    res.type("html").send(uiHtml("/statement"));
    return;
  }
  const st = store.read();
  const u = authUser(st, req);
  const limit = qint(req, "limit", 50);
  const offset = qoffset(req);
  let snap = req.query.snapshot as string | undefined;
  let base: any;
  if (snap) {
    if ("from" in req.query || "to" in req.query || "known_at" in req.query) {
      err(422, "validation_failed");
    }
    const data = st.snapshots[snap];
    if (!data || data.user_id !== u.id) err(404, "not_found");
    base = structuredClone(data.data);
  } else {
    const frm = instantParam(req, "from");
    const to = instantParam(req, "to");
    const known = instantParam(req, "known_at");
    const data = statementCompute(st, u, frm, to, limit, offset, known);
    snap = newId("snap");
    store.mutate((s) => {
      s.snapshots[snap!] = { user_id: u.id, data };
    });
    base = structuredClone(data);
  }
  const entries = base.entries;
  const out: any = {
    opening_balance: base.opening_balance,
    closing_balance: base.closing_balance,
    snapshot_range: base.snapshot_range,
    entries: entries.slice(offset, offset + limit),
    has_more: offset + limit < entries.length,
    snapshot: snap,
  };
  if (base.snapshot_range.known_at !== null && base.snapshot_range.known_at !== undefined) {
    out.known_at = base.snapshot_range.known_at;
  }
  res.json(out);
});

app.get("/payments/:pid/revisions", (req, res) => {
  requireStage(3);
  const { pid } = req.params;
  const st = store.read();
  const u = authUser(st, req);
  const p = findPayment(st, pid);
  if (!p) err(404, "not_found");
  if (p.from_user_id !== u.id && p.to_user_id !== u.id) err(404, "not_found");
  res.json({ revisions: p.revisions });
});

app.post("/payments/:pid/corrections", (req, res) => {
  requireStage(3);
  const { pid } = req.params;
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", `/payments/${pid}/corrections`);
    if (replay !== null) return { status: 200, body: replay };
    const p = findPayment(st, pid);
    if (!p) err(404, "not_found");
    if (p.from_user_id !== u.id) err(403, "forbidden");
    if (p.authorization_id || p.refund_of || p.settlement_id) err(422, "linked_payment_immutable");
    for (const k of ["expected_revision", "amount", "effective_at", "reason"]) {
      if (!(k in obj)) err(422, "validation_failed");
    }
    if (typeof obj.expected_revision !== "number" || !Number.isInteger(obj.expected_revision) || obj.expected_revision < 1) {
      err(422, "validation_failed");
    }
    const amount = store.validateAmount(obj.amount, true);
    let eff: Date;
    try {
      eff = parseDt(obj.effective_at);
    } catch {
      err(422, "validation_failed");
    }
    if (
      eff.getTime() > nowDt().getTime() ||
      typeof obj.reason !== "string" ||
      obj.reason.length < 1 ||
      obj.reason.length > 200
    ) {
      err(422, "validation_failed");
    }
    const current = p.revisions[p.revisions.length - 1];
    if (current.revision !== obj.expected_revision) err(409, "stale_revision");
    const refunded = st.payments
      .filter((x: any) => x.refund_of === pid)
      .reduce((acc: number, x: any) => acc + x.amount, 0);
    if (amount < refunded) err(422, "refund_exceeds_payment");
    const delta = amount - current.amount;
    const held = store.heldMap(st);
    if (delta > 0 && u.balance - (held[u.id] || 0) < delta) err(409, "insufficient_funds");
    if (delta < 0) {
      const receiver = st.users[p.to_user_id];
      if (receiver.balance - (held[receiver.id] || 0) < -delta) err(409, "insufficient_funds");
    }
    const currentUs = parseDtUs(current.recorded_at);
    let recUs = monotonicMicroseconds();
    if (recUs <= currentUs) {
      recUs = currentUs + 1n;
    }
    const newRev = {
      revision: current.revision + 1,
      amount,
      effective_at: obj.effective_at,
      recorded_at: formatMicrosecondsIso(recUs),
      reason: obj.reason,
      correction_batch_id: null,
    };
    const overrides = { [pid]: newRev };
    if (!store.checkHistoricalNonnegative(st, overrides)) err(409, "historical_overdraft");
    const sender = st.users[p.from_user_id];
    const receiver = st.users[p.to_user_id];
    sender.balance -= delta;
    receiver.balance += delta;
    p.revisions.push(newRev);
    const out = {
      payment_id: pid,
      revision: newRev.revision,
      amount: newRev.amount,
      effective_at: newRev.effective_at,
      recorded_at: newRev.recorded_at,
      reason: newRev.reason,
    };
    store.recordIdem(st, u, key, "POST", `/payments/${pid}/corrections`, obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/payments/:pid/refunds", (req, res) => {
  requireStage(4);
  const { pid } = req.params;
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", `/payments/${pid}/refunds`);
    if (replay !== null) return { status: 200, body: replay };
    const p = findPayment(st, pid);
    if (!p) err(404, "not_found");
    if (p.refund_of !== null && p.refund_of !== undefined) err(422, "invalid_refund_target");
    if (u.id !== p.to_user_id) err(403, "forbidden");
    const amount = store.validateAmount(obj.amount);
    const current = p.revisions[p.revisions.length - 1].amount;
    const refunded = st.payments
      .filter((x: any) => x.refund_of === pid)
      .reduce((acc: number, x: any) => acc + x.amount, 0);
    if (refunded + amount > current) err(422, "refund_exceeds_payment");
    const held = store.heldMap(st);
    if (u.balance - (held[u.id] || 0) < amount) err(409, "insufficient_funds");
    const source = u;
    const target = st.users[p.from_user_id];
    source.balance -= amount;
    target.balance += amount;
    const rp = store.makePayment(
      st,
      newId("p"),
      source.id,
      target.id,
      amount,
      p.note,
      p.visibility,
      null,
      null,
      null,
      pid,
      iso()
    );
    st.payments.push(rp);
    const out = store.serializePayment(st, rp);
    store.recordIdem(st, u, key, "POST", `/payments/${pid}/refunds`, obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/correction-batches", (req, res) => {
  requireStage(4);
  const obj = parseBody(req);
  const result = store.mutate((st) => {
    const u = authUser(st, req);
    const key = requireWriteKey(req);
    const replay = replayOrNone(st, u, key, obj, "POST", "/correction-batches");
    if (replay !== null) return { status: 200, body: replay };
    if (!st.settlement_operator_ids.includes(u.id)) err(403, "forbidden");
    const items = obj.corrections;
    if (!Array.isArray(items) || items.length < 1 || items.length > 32) {
      err(422, "validation_failed");
    }
    const ids: string[] = [];
    const proposed: Record<string, any> = {};
    const deltas: Record<string, number> = {};
    const settlementGroups: Record<string, string[]> = {};
    for (const item of items) {
      if (!item || typeof item !== "object") err(422, "validation_failed");
      for (const k of ["payment_id", "expected_revision", "amount", "effective_at", "reason"]) {
        if (!(k in item)) err(422, "validation_failed");
      }
      const pid = item.payment_id;
      if (ids.includes(pid)) err(422, "validation_failed");
      ids.push(pid);
      const p = findPayment(st, pid);
      if (!p) err(404, "not_found");
      if (typeof item.expected_revision !== "number" || !Number.isInteger(item.expected_revision) || item.expected_revision < 1) {
        err(422, "validation_failed");
      }
      const amount = store.validateAmount(item.amount, true);
      let eff: Date;
      try {
        eff = parseDt(item.effective_at);
      } catch {
        err(422, "validation_failed");
      }
      if (
        eff.getTime() > nowDt().getTime() ||
        typeof item.reason !== "string" ||
        item.reason.length < 1 ||
        item.reason.length > 200
      ) {
        err(422, "validation_failed");
      }
      if (p.authorization_id || p.refund_of) err(422, "linked_payment_immutable");
      const current = p.revisions[p.revisions.length - 1];
      if (current.revision !== item.expected_revision) err(409, "stale_revision");
      const refunded = st.payments
        .filter((x: any) => x.refund_of === pid)
        .reduce((acc: number, x: any) => acc + x.amount, 0);
      if (amount < refunded) err(422, "refund_exceeds_payment");
      proposed[pid] = {
        revision: current.revision + 1,
        amount,
        effective_at: item.effective_at,
        recorded_at: "",
        reason: item.reason,
        correction_batch_id: null,
      };
      const delta = amount - current.amount;
      deltas[p.from_user_id] = (deltas[p.from_user_id] || 0) - delta;
      deltas[p.to_user_id] = (deltas[p.to_user_id] || 0) + delta;
      if (p.settlement_id) {
        settlementGroups[p.settlement_id] = settlementGroups[p.settlement_id] || [];
        settlementGroups[p.settlement_id].push(pid);
      }
    }
    for (const [sid, pids] of Object.entries(settlementGroups)) {
      const members = st.payments.filter((p: any) => p.settlement_id === sid).map((p: any) => p.payment_id);
      if (pids.length !== members.length || !pids.every((x) => members.includes(x))) {
        err(422, "incomplete_settlement");
      }
      const effs = new Set(pids.map((x) => parseDt(proposed[x].effective_at).getTime()));
      if (effs.size !== 1) err(422, "validation_failed");
    }
    const held = store.heldMap(st);
    for (const [uid, delta] of Object.entries(deltas)) {
      if (st.users[uid].balance + delta - (held[uid] || 0) < 0) err(409, "insufficient_funds");
    }
    let maxLastUs = -9223372036854775808n;
    for (const p of st.payments) {
      if (p.payment_id in proposed) {
        const lastUs = parseDtUs(p.revisions[p.revisions.length - 1].recorded_at);
        if (lastUs > maxLastUs) maxLastUs = lastUs;
      }
    }
    let recUs = monotonicMicroseconds();
    if (recUs <= maxLastUs) recUs = maxLastUs + 1n;
    const batchId = newId("cb");
    const recIso = formatMicrosecondsIso(recUs);
    for (const rv of Object.values(proposed)) {
      rv.recorded_at = recIso;
      rv.correction_batch_id = batchId;
    }
    if (!store.checkHistoricalNonnegative(st, proposed)) err(409, "historical_overdraft");
    for (const [pid, rv] of Object.entries(proposed)) {
      const p = findPayment(st, pid);
      const delta = rv.amount - p.revisions[p.revisions.length - 1].amount;
      st.users[p.from_user_id].balance -= delta;
      st.users[p.to_user_id].balance += delta;
      p.revisions.push(rv);
    }
    const revisions = Object.entries(proposed).map(([pid, rv]) => ({
      payment_id: pid,
      revision: rv.revision,
      amount: rv.amount,
      effective_at: rv.effective_at,
      recorded_at: rv.recorded_at,
      reason: rv.reason,
      correction_batch_id: batchId,
    }));
    const out = { correction_batch_id: batchId, recorded_at: recIso, revisions };
    store.recordIdem(st, u, key, "POST", "/correction-batches", obj, 201, out);
    return { status: 201, body: out };
  });
  res.status(result.status).json(result.body);
});

app.post("/api/ai/assistant", async (req, res, next) => {
  try {
    const st = store.read();
    const u = authUser(st, req);
    const obj = parseBody(req);
    const message = typeof obj.message === "string" ? obj.message.trim() : "";
    if (!message) {
      err(422, "validation_failed");
    }

    // Gather real financial data for authenticated user only
    const held = store.heldMap(st)[u.id] || 0;
    const available = Math.max(0, u.balance - held);
    const cur = st.currency;
    const mu = st.minor_units;

    // Recent activity
    const userPayments = st.payments
      .filter((p: any) => p.from_user_id === u.id || p.to_user_id === u.id)
      .slice(-10)
      .map((p: any) => store.serializePayment(st, p));

    // Pending requests
    const pendingIncoming = st.requests
      .filter((r: any) => r.payer_id === u.id && r.status === "pending")
      .map((r: any) => store.serializeRequest(st, r));
    const pendingOutgoing = st.requests
      .filter((r: any) => r.requester_id === u.id && r.status === "pending")
      .map((r: any) => store.serializeRequest(st, r));

    // Active authorizations
    const activeAuths = st.authorizations
      .filter((a: any) => (a.from_user_id === u.id || a.to_user_id === u.id) && a.status === "open")
      .map((a: any) => store.serializeAuth(st, a));

    const contextData = {
      user: {
        handle: u.handle,
        display_name: u.display_name,
        currency: cur,
        minor_units: mu,
        balance_total_minor: u.balance,
        balance_held_minor: held,
        balance_available_minor: available,
      },
      pending_requests: {
        incoming_to_pay: pendingIncoming,
        outgoing_requested: pendingOutgoing,
      },
      active_holds: activeAuths,
      recent_activity: userPayments,
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({
        reply: "AI assistant is currently offline (GEMINI_API_KEY is not configured). All core Pocketful wallet, payment, split, authorization, and statement features remain fully functional!",
        safe_context: {
          available,
          held,
          total: u.balance,
          currency: cur,
        },
      });
      return;
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are the Pocketful Financial Intelligence Assistant.
You provide clear, concise, and helpful explanations of the authenticated user's Pocketful wallet and ledger.
Rules:
1. You are strictly READ-ONLY. You cannot execute payments, refunds, transfers, voids, or captures.
2. If the user asks you to execute a financial action (e.g. "send $10 to Bob", "refund this payment"), explain that you cannot perform transactions directly for safety, and guide them clearly to the exact UI button/page in Pocketful to complete it.
3. Only use the real financial context provided. Do not hallucinate transactions, counterparties, or balances.
4. Monetary values are provided in integer minor units (e.g. 1500 with 2 minor units = 15.00). Format them nicely with the user's currency.
5. If the user asks why their available balance is lower than total balance, explain their active reservation holds.
Keep answers concise, direct, professional, and friendly.`;

      const prompt = `User question: "${message}"\n\nReal authenticated account context:\n${JSON.stringify(contextData, null, 2)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const replyText = response.text || "I was unable to analyze your request. Please try again.";
      res.json({
        reply: replyText,
        safe_context: {
          available,
          held,
          total: u.balance,
          currency: cur,
        },
      });
    } catch (aiErr: any) {
      console.error("Gemini assistant error:", aiErr?.message || aiErr);
      res.json({
        reply: "I'm temporarily unable to reach the Gemini service. Your Pocketful wallet and payments are unaffected. Please try again shortly.",
        safe_context: {
          available,
          held,
          total: u.balance,
          currency: cur,
        },
      });
    }
  } catch (e) {
    next(e);
  }
});

app.get("/", (_req, res) => {
  res.type("html").send(uiHtml("/"));
});

app.get("/login", (_req, res) => {
  res.type("html").send(uiHtml("/login"));
});

app.get("/signup", (_req, res) => {
  res.type("html").send(uiHtml("/signup"));
});

app.get("/split", (_req, res) => {
  res.type("html").send(uiHtml("/split"));
});

app.use((errObj: any, _req: Request, res: Response, _next: NextFunction) => {
  if (errObj instanceof PocketError) {
    res.status(errObj.status).json({
      error: { code: errObj.code, message: errObj.message || errObj.code },
    });
    return;
  }
  res.status(500).json({
    error: { code: "internal_error", message: "internal error" },
  });
});

const PORT = Number(process.env.PORT || 3000);
const isDirectRun =
  Boolean(process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js")));

if (isDirectRun && process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pocketful server listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
