import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const STAGE = parseInt(process.env.POCKETFUL_STAGE || "4", 10);
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_NOTE = 200;
export const KEY_MAX = 255;
export const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
export const HANDLE_RE = /^[a-z0-9_]{1,20}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;
export const CURRENCIES: Record<string, number> = { EUR: 2, JPY: 0, BHD: 3 };

// Monotonic microsecond clock state
let lastMicrosecondEpoch = 0n;

/**
 * Returns current timestamp as an exact integer microsecond epoch BigInt.
 * Guarantees strictly monotonic increasing values across rapid successive calls.
 */
export function monotonicMicroseconds(): bigint {
  const nowMs = BigInt(Date.now());
  let targetUs = nowMs * 1000n;
  if (targetUs <= lastMicrosecondEpoch) {
    targetUs = lastMicrosecondEpoch + 1n;
  }
  lastMicrosecondEpoch = targetUs;
  return targetUs;
}

/**
 * Formats a microsecond epoch BigInt as a strict ISO-8601 string with 6 fractional digits and +00:00.
 * Example: "2026-10-03T09:45:00.123456+00:00"
 */
export function formatMicrosecondsIso(us: bigint): string {
  const ms = Number(us / 1000n);
  const remainderUs = Number(us % 1000n);
  const d = new Date(ms);
  const isoBase = d.toISOString(); // e.g. "2026-10-03T09:45:00.123Z"
  const dotIndex = isoBase.indexOf(".");
  if (dotIndex === -1) {
    return isoBase.replace("Z", ".000000+00:00");
  }
  const dateAndSec = isoBase.slice(0, dotIndex);
  const msFraction = isoBase.slice(dotIndex + 1, isoBase.length - 1).padEnd(3, "0");
  const usFraction = remainderUs.toString().padStart(3, "0");
  return `${dateAndSec}.${msFraction}${usFraction}+00:00`;
}

/**
 * Current date/time instant generator.
 * Produces standard Date for general usage.
 */
export function nowDt(): Date {
  return new Date();
}

/**
 * Produces strict 6-decimal microsecond ISO timestamp.
 * When dt is omitted, uses monotonicMicroseconds() to guarantee strict ordering
 * during rapid consecutive writes without relying on UUID ordering.
 */
export function iso(dt?: Date): string {
  if (dt) {
    const ms = BigInt(dt.getTime());
    const us = ms * 1000n;
    return formatMicrosecondsIso(us);
  }
  return formatMicrosecondsIso(monotonicMicroseconds());
}

/**
 * Parses an ISO instant string into an exact microsecond BigInt.
 * Enforces presence of timezone offset (+00:00 or Z).
 */
export function parseDtUs(value: any): bigint {
  if (typeof value !== "string" || !value) {
    throw new Error("invalid instant");
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("invalid instant");
  }
  // Extract date, time, fractional part, and timezone
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new Error("invalid instant");
    return BigInt(ms) * 1000n;
  }
  const [, dtSec, fracStr = "", tz] = match;
  const normalizedUtc = `${dtSec}${tz === "Z" ? "+00:00" : tz}`;
  const msBase = Date.parse(normalizedUtc);
  if (Number.isNaN(msBase)) {
    throw new Error("invalid instant");
  }
  // Microsecond fraction up to 6 digits
  const frac6 = fracStr.padEnd(6, "0").slice(0, 6);
  const usFraction = BigInt(frac6 || "0");
  return BigInt(msBase) * 1000n + usFraction;
}

export function parseDt(value: any): Date {
  if (typeof value !== "string" || !value) {
    throw new Error("invalid instant");
  }
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("invalid instant");
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error("invalid instant");
  }
  return new Date(ms);
}

/**
 * Chronological sort key as microsecond BigInt.
 * Invalid values sort first (matching ts_key behavior in Python).
 */
export function tsKeyUs(value: any): bigint {
  try {
    return parseDtUs(value);
  } catch {
    return -9223372036854775808n; // Min BigInt
  }
}

export function tsKey(value: any): number {
  try {
    return parseDt(value).getTime();
  } catch {
    return -8640000000000000;
  }
}

export function canon(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canon).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canon(value[k])).join(",") +
    "}"
  );
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const rounds = 60000;
  const digest = crypto.pbkdf2Sync(password, salt, rounds, 32, "sha256");
  return `pbkdf2_sha256$${rounds}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function checkPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const [alg, roundsStr, saltB64, digestB64] = parts;
    if (alg !== "pbkdf2_sha256") return false;
    const salt = Buffer.from(saltB64, "base64url");
    const got = crypto.pbkdf2Sync(password, salt, parseInt(roundsStr, 10), 32, "sha256");
    const expected = Buffer.from(digestB64, "base64url");
    if (got.length !== expected.length) return false;
    return crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export function equalSplit(amount: number, n: number): number[] {
  const base = Math.floor(amount / n);
  const rem = amount % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export class PocketError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message = "") {
    super(message || code);
    this.status = status;
    this.code = code;
    this.message = message || code;
  }
}

export function err(status: number, code: string, message = ""): never {
  throw new PocketError(status, code, message || code);
}

export class Store {
  filePath: string;
  state: any;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.init();
  }

  private init(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      if (fs.existsSync(this.filePath)) {
        try {
          const content = fs.readFileSync(this.filePath, "utf-8");
          this.state = JSON.parse(content);
          if (!this.state || typeof this.state !== "object" || !this.state.users) {
            this.state = Store.seededEmpty();
            this.persist();
          }
        } catch {
          // Corrupted file recovery: safely fallback to clean seeded state
          this.state = Store.seededEmpty();
          this.persist();
        }
      } else {
        this.state = Store.seededEmpty();
        this.persist();
      }
    } catch {
      this.state = Store.seededEmpty();
    }
  }

  static empty(): any {
    return {
      track: "pocketful",
      format_version: 1,
      currency: "EUR",
      minor_units: 2,
      authorization_ttl_seconds: 600,
      users: {},
      tokens: {},
      payments: [],
      requests: [],
      authorizations: [],
      settlements: [],
      settlement_operator_ids: [],
      idempotency: [],
      snapshots: {},
      opening_balances: {},
    };
  }

  static seededEmpty(): any {
    const st = Store.empty();
    const demoUsers = [
      { id: "u_ada", handle: "ada", email: "ada@pocketful.dev", display_name: "Ada Lovelace", balance: 12500 },
      { id: "u_bob", handle: "bob", email: "bob@pocketful.dev", display_name: "Bob Babbage", balance: 8500 },
      { id: "u_cy", handle: "cy", email: "cy@pocketful.dev", display_name: "Cy Turing", balance: 5000 },
    ];
    for (const u of demoUsers) {
      st.users[u.id] = {
        id: u.id,
        email: u.email,
        password_hash: hashPassword("password123"),
        display_name: u.display_name,
        handle: u.handle,
        balance: u.balance,
      };
      st.opening_balances[u.id] = u.balance;
    }
    st.settlement_operator_ids = ["u_ada"];
    return st;
  }

  /**
   * Atomic persistence:
   * 1. Write complete JSON to a unique temporary file in the same directory.
   * 2. Flush and close the write stream.
   * 3. Atomically rename/replace the destination file.
   * Never leaves partially written JSON as the primary state.
   */
  persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      const tempPath = path.join(dir, `.state_${crypto.randomUUID()}.tmp`);
      const payload = JSON.stringify(this.state);
      fs.writeFileSync(tempPath, payload, "utf-8");
      fs.renameSync(tempPath, this.filePath);
    } catch {
      // In-memory state remains fully intact if disk fails
    }
  }

  read(): any {
    return structuredClone(this.state);
  }

  replace(newState: any): void {
    this.state = structuredClone(newState);
    this.persist();
  }

  mutate<T>(fn: (st: any) => T): T {
    const draft = structuredClone(this.state);
    const out = fn(draft);
    this.state = draft;
    this.persist();
    return out;
  }

  export(): any {
    return this.read();
  }

  reset(fx: any): void {
    this.replace(this.makeFixture(fx));
  }

  makeFixture(fx: any): any {
    if (!fx || typeof fx !== "object" || Array.isArray(fx)) err(422, "validation_failed");
    const currency = fx.currency;
    const mu = fx.minor_units;
    if (!(currency in CURRENCIES) || mu !== CURRENCIES[currency]) err(422, "validation_failed");
    const usersRaw = fx.users;
    if (!Array.isArray(usersRaw)) err(422, "validation_failed");
    const st = Store.empty();
    st.currency = currency;
    st.minor_units = mu;
    st.authorization_ttl_seconds = fx.authorization_ttl_seconds ?? 600;
    if (!Number.isInteger(st.authorization_ttl_seconds) || st.authorization_ttl_seconds <= 0) {
      err(422, "validation_failed");
    }
    const seenHandles = new Set<string>();
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();
    for (const u of usersRaw) {
      if (!u || typeof u !== "object") err(422, "validation_failed");
      const { id: uid, handle, email, password, balance } = u;
      if (typeof uid !== "string" || !ID_RE.test(uid) || typeof handle !== "string" || !HANDLE_RE.test(handle)) {
        err(422, "validation_failed");
      }
      if (seenHandles.has(handle) || seenIds.has(uid) || typeof email !== "string" || !EMAIL_RE.test(email)) {
        err(422, "validation_failed");
      }
      if (
        seenEmails.has(email) ||
        typeof password !== "string" ||
        password.length < 8 ||
        typeof balance !== "number" ||
        !Number.isInteger(balance) ||
        balance < 0
      ) {
        err(422, "validation_failed");
      }
      seenHandles.add(handle);
      seenEmails.add(email);
      seenIds.add(uid);
      st.users[uid] = {
        id: uid,
        email,
        password_hash: hashPassword(password),
        display_name: String(u.display_name ?? ""),
        handle,
        balance,
      };
      st.opening_balances[uid] = balance;
    }
    st.settlement_operator_ids = Array.isArray(fx.settlement_operator_ids) ? [...fx.settlement_operator_ids] : [];
    if (st.settlement_operator_ids.some((x: string) => !(x in st.users))) err(422, "validation_failed");
    const resetTime = nowDt();
    const seeded: any[] = [];
    for (const p of fx.payments || []) {
      if (!p || typeof p !== "object") err(422, "validation_failed");
      const pid = p.id ?? newId("p");
      const sid = p.from_user_id;
      const rid = p.to_user_id;
      if (typeof pid !== "string" || !ID_RE.test(pid) || !(sid in st.users) || !(rid in st.users) || sid === rid) {
        err(422, "validation_failed");
      }
      const amt = this.validateAmount(p.amount);
      const created = p.created_at || iso(resetTime);
      let cdt: Date;
      try {
        cdt = parseDt(created);
      } catch {
        err(422, "validation_failed");
      }
      if (cdt.getTime() > resetTime.getTime()) err(422, "validation_failed");
      const note = p.note ?? "";
      const vis = p.visibility ?? "public";
      if (typeof note !== "string" || note.length > MAX_NOTE || (vis !== "public" && vis !== "private")) {
        err(422, "validation_failed");
      }
      seeded.push(
        this.makePayment(
          st,
          pid,
          sid,
          rid,
          amt,
          note,
          vis,
          p.request_id ?? null,
          p.authorization_id ?? null,
          p.settlement_id ?? null,
          p.refund_of ?? null,
          created
        )
      );
    }
    st.payments = seeded;
    for (const p of seeded) {
      st.opening_balances[p.from_user_id] += p.amount;
      st.opening_balances[p.to_user_id] -= p.amount;
    }
    if (Object.values(st.opening_balances).some((v: any) => v < 0)) err(422, "validation_failed");
    for (const r of fx.requests || []) {
      if (!r || typeof r !== "object") err(422, "validation_failed");
      const rid = r.id ?? newId("rq");
      const requester = r.requester_id;
      const payer = r.payer_id;
      if (!(requester in st.users) || !(payer in st.users) || requester === payer) err(422, "validation_failed");
      const amt = this.validateAmount(r.amount);
      const note = r.note ?? "";
      const status = r.status ?? "pending";
      if (
        typeof note !== "string" ||
        note.length > MAX_NOTE ||
        !["pending", "paid", "declined", "cancelled"].includes(status)
      ) {
        err(422, "validation_failed");
      }
      st.requests.push({
        request_id: rid,
        requester_id: requester,
        payer_id: payer,
        amount: amt,
        currency,
        note,
        status,
        payment_id: r.payment_id ?? null,
        created_at: r.created_at || iso(resetTime),
      });
    }
    if (STAGE >= 2) {
      for (const a of fx.authorizations || []) {
        if (!a || typeof a !== "object") err(422, "validation_failed");
        const aid = a.id ?? newId("a");
        const sid = a.from_user_id;
        const rid = a.to_user_id;
        const amt = a.amount;
        const status = a.status ?? "open";
        if (
          !(sid in st.users) ||
          !(rid in st.users) ||
          sid === rid ||
          typeof amt !== "number" ||
          !Number.isInteger(amt) ||
          amt < 1 ||
          amt > MAX_AMOUNT ||
          !["open", "captured", "voided", "expired"].includes(status)
        ) {
          err(422, "validation_failed");
        }
        const exp = a.expires_at;
        if (typeof exp !== "string") err(422, "validation_failed");
        try {
          parseDt(exp);
        } catch {
          err(422, "validation_failed");
        }
        const created = a.created_at || iso(resetTime);
        st.authorizations.push({
          authorization_id: aid,
          from_user_id: sid,
          to_user_id: rid,
          amount: amt,
          captured_amount: Number(a.captured_amount ?? 0),
          currency,
          note: a.note ?? "",
          visibility: a.visibility ?? "public",
          status,
          expires_at: exp,
          payment_id: a.payment_id ?? null,
          payment_ids: Array.isArray(a.payment_ids)
            ? [...a.payment_ids]
            : a.payment_id
            ? [a.payment_id]
            : [],
          created_at: created,
          closed_at: a.closed_at ?? null,
        });
      }
      const held = this.heldMap(st, resetTime);
      for (const [uid, v] of Object.entries(held)) {
        if ((v as number) > st.users[uid].balance) err(422, "validation_failed");
      }
    }
    return st;
  }

  makePayment(
    st: any,
    pid: string,
    sid: string,
    rid: string,
    amt: number,
    note: string,
    vis: string,
    requestId: string | null = null,
    authId: string | null = null,
    settlementId: string | null = null,
    refundOf: string | null = null,
    createdAt: string | null = null
  ): any {
    if (!createdAt) {
      const prevUs = (st.payments || []).reduce(
        (max: bigint, p: any) => {
          const u = tsKeyUs(p.created_at);
          return u > max ? u : max;
        },
        -9223372036854775808n
      );
      let currentUs = monotonicMicroseconds();
      if (currentUs <= prevUs) {
        currentUs = prevUs + 1n;
        lastMicrosecondEpoch = currentUs;
      }
      createdAt = formatMicrosecondsIso(currentUs);
    }
    return {
      payment_id: pid,
      from_user_id: sid,
      from_handle: st.users[sid].handle,
      to_user_id: rid,
      to_handle: st.users[rid].handle,
      amount: amt,
      currency: st.currency,
      note,
      visibility: vis,
      request_id: requestId,
      authorization_id: authId,
      settlement_id: settlementId,
      refund_of: refundOf,
      created_at: createdAt,
      revisions: [
        {
          revision: 1,
          amount: amt,
          effective_at: createdAt,
          recorded_at: createdAt,
          reason: "",
          correction_batch_id: null,
        },
      ],
    };
  }

  userByHandle(st: any, h: string): any {
    return Object.values(st.users).find((u: any) => u.handle === h) ?? null;
  }

  userFromToken(st: any, token: string): any {
    return token ? st.users[st.tokens[token]] ?? null : null;
  }

  activeUser(st: any, token: string): any {
    const u = this.userFromToken(st, token);
    if (!u) err(401, "unauthenticated");
    return u;
  }

  expire(st: any, at?: Date): void {
    const now = at ?? nowDt();
    for (const a of st.authorizations || []) {
      if (a.status === "open") {
        try {
          const exp = parseDt(a.expires_at);
          if (exp.getTime() <= now.getTime()) {
            a.status = "expired";
            a.closed_at = a.expires_at;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  heldMap(st: any, at?: Date): Record<string, number> {
    this.expire(st, at);
    const held: Record<string, number> = {};
    for (const uid of Object.keys(st.users)) held[uid] = 0;
    for (const a of st.authorizations || []) {
      if (a.status === "open") {
        held[a.from_user_id] =
          (held[a.from_user_id] || 0) + Math.max(0, a.amount - (a.captured_amount || 0));
      }
    }
    return held;
  }

  me(st: any, u: any, asOf: string | null = null, knownAt: string | null = null): any {
    if (asOf === null && knownAt !== null) {
      return this.historicalMe(st, u, iso(nowDt()), knownAt);
    }
    if (asOf === null) {
      const h = this.heldMap(st);
      return this.basicUser(st, u, h[u.id] || 0, knownAt);
    }
    return this.historicalMe(st, u, asOf, knownAt);
  }

  basicUser(st: any, u: any, held = 0, knownAt: string | null = null): any {
    const d: any = {
      user_id: u.id,
      display_name: u.display_name,
      handle: u.handle,
      balance: u.balance,
      total: u.balance,
      available: u.balance - held,
      held,
      currency: st.currency,
      minor_units: st.minor_units,
    };
    if (knownAt !== null) d.known_at = knownAt;
    return d;
  }

  selectedRevision(p: any, knownAt: string | null = null): any {
    if (knownAt === null) return p.revisions[p.revisions.length - 1];
    const kUs = parseDtUs(knownAt);
    let chosen: any = null;
    for (const r of p.revisions) {
      const recUs = parseDtUs(r.recorded_at);
      if (recUs <= kUs && (chosen === null || recUs > parseDtUs(chosen.recorded_at))) {
        chosen = r;
      }
    }
    return chosen;
  }

  paymentEvents(st: any, knownAt: string | null = null): Array<[any, any]> {
    const out: Array<[any, any]> = [];
    for (const p of st.payments) {
      const r = this.selectedRevision(p, knownAt);
      if (r !== null) out.push([p, r]);
    }
    return out;
  }

  historicalTotals(st: any, asOf: string | null = null, knownAt: string | null = null): Record<string, number> {
    const base: Record<string, number> = { ...st.opening_balances };
    const asUs = asOf !== null ? parseDtUs(asOf) : parseDtUs(iso(nowDt()));
    const events = this.paymentEvents(st, knownAt).map(([p, r]) => ({
      effUs: parseDtUs(r.effective_at),
      pid: p.payment_id,
      p,
      r,
    }));
    events.sort((a, b) => (a.effUs < b.effUs ? -1 : a.effUs > b.effUs ? 1 : a.pid.localeCompare(b.pid)));
    for (const { effUs, p, r } of events) {
      if (effUs <= asUs) {
        base[p.from_user_id] -= r.amount;
        base[p.to_user_id] += r.amount;
      }
    }
    return base;
  }

  historicalMe(st: any, u: any, asOf: string, knownAt: string | null): any {
    const totals = this.historicalTotals(st, asOf, knownAt);
    const held = this.historicalHeld(st, asOf, knownAt, u.id);
    const shadow = { ...u, balance: totals[u.id] };
    const d = this.basicUser(st, shadow, held, knownAt);
    d.as_of = asOf;
    return d;
  }

  historicalHeld(st: any, asOf: string, knownAt: string | null, uid: string): number {
    const tUs = parseDtUs(asOf);
    const kUs = knownAt ? parseDtUs(knownAt) : null;
    let held = 0;
    for (const a of st.authorizations || []) {
      if (a.from_user_id !== uid) continue;
      const createdUs = parseDtUs(a.created_at);
      if (createdUs > tUs || (kUs !== null && createdUs > kUs)) continue;
      let captured = 0;
      for (const pid of a.payment_ids || []) {
        const p = st.payments.find((x: any) => x.payment_id === pid);
        if (!p) continue;
        const ctUs = parseDtUs(p.created_at);
        if (ctUs <= tUs && (kUs === null || ctUs <= kUs)) captured += p.amount;
      }
      let rem = Math.max(0, a.amount - captured);
      let expUs: bigint | null = null;
      try {
        expUs = parseDtUs(a.expires_at);
      } catch {
        expUs = null;
      }
      const closedUs = a.closed_at ? parseDtUs(a.closed_at) : null;
      if (expUs !== null && expUs <= tUs && (kUs === null || createdUs <= kUs)) rem = 0;
      if (
        closedUs !== null &&
        closedUs <= tUs &&
        (a.status === "captured" || a.status === "voided") &&
        (kUs === null || closedUs <= kUs)
      ) {
        rem = 0;
      }
      if (rem > 0) held += rem;
    }
    return held;
  }

  serializePayment(st: any, p: any): any {
    return {
      payment_id: p.payment_id ?? null,
      from_user_id: p.from_user_id ?? null,
      from_handle: p.from_handle ?? null,
      to_user_id: p.to_user_id ?? null,
      to_handle: p.to_handle ?? null,
      amount: p.amount ?? null,
      currency: p.currency ?? null,
      note: p.note ?? null,
      visibility: p.visibility ?? null,
      request_id: p.request_id ?? null,
      authorization_id: p.authorization_id ?? null,
      settlement_id: p.settlement_id ?? null,
      refund_of: p.refund_of ?? null,
      created_at: p.created_at ?? null,
    };
  }

  serializeRequest(st: any, r: any): any {
    return {
      request_id: r.request_id,
      requester_id: r.requester_id,
      requester_handle: st.users[r.requester_id].handle,
      payer_id: r.payer_id,
      payer_handle: st.users[r.payer_id].handle,
      amount: r.amount,
      currency: r.currency,
      note: r.note,
      status: r.status,
      payment_id: r.payment_id ?? null,
      created_at: r.created_at,
    };
  }

  serializeAuth(st: any, a: any): any {
    const rem = a.status === "open" ? Math.max(0, a.amount - (a.captured_amount || 0)) : 0;
    return {
      authorization_id: a.authorization_id,
      from_user_id: a.from_user_id,
      from_handle: st.users[a.from_user_id].handle,
      to_user_id: a.to_user_id,
      to_handle: st.users[a.to_user_id].handle,
      amount: a.amount,
      captured_amount: a.captured_amount || 0,
      remaining_amount: rem,
      currency: a.currency,
      note: a.note,
      visibility: a.visibility,
      status: a.status,
      expires_at: a.expires_at,
      payment_id: a.payment_id ?? null,
      payment_ids: Array.isArray(a.payment_ids) ? [...a.payment_ids] : [],
      created_at: a.created_at,
      closed_at: a.closed_at ?? null,
    };
  }

  visibleActivity(st: any, u: any): any[] {
    const out = st.payments
      .filter((p: any) => p.visibility === "public" || p.from_user_id === u.id || p.to_user_id === u.id)
      .map((p: any) => this.serializePayment(st, p));
    out.sort((a: any, b: any) => {
      const uA = tsKeyUs(a.created_at);
      const uB = tsKeyUs(b.created_at);
      if (uB < uA) return -1;
      if (uB > uA) return 1;
      return b.payment_id.localeCompare(a.payment_id);
    });
    return out;
  }

  idemReplay(st: any, u: any, key: string, method: string, pathStr: string, body: any): any {
    if (typeof key !== "string" || !key) err(400, "missing_idempotency_key");
    if (key.length > KEY_MAX) err(422, "validation_failed");
    const c = canon(body);
    for (const rec of st.idempotency) {
      if (rec.user_id === u.id && rec.key === key && rec.method === method && rec.path === pathStr) {
        if (rec.body !== c) err(409, "idempotency_key_reuse");
        return rec.response;
      }
    }
    return null;
  }

  recordIdem(
    st: any,
    u: any,
    key: string,
    method: string,
    pathStr: string,
    body: any,
    status: number,
    response: any
  ): void {
    st.idempotency.push({
      user_id: u.id,
      key,
      method,
      path: pathStr,
      body: canon(body),
      status,
      response,
    });
  }

  validateAmount(x: any, allowZero = false): number {
    const lo = allowZero ? 0 : 1;
    if (typeof x !== "number" || !Number.isInteger(x) || x < lo || x > MAX_AMOUNT) {
      err(422, "validation_failed");
    }
    return x;
  }

  validateNoteVisibility(note: any, vis: any): void {
    if (typeof note !== "string" || note.length > MAX_NOTE || (vis !== "public" && vis !== "private")) {
      err(422, "validation_failed");
    }
  }

  transfer(
    st: any,
    u: any,
    toHandle: string,
    amount: number,
    note: string,
    vis: string,
    requestId: string | null = null,
    authId: string | null = null,
    settlementId: string | null = null,
    refundOf: string | null = null
  ): any {
    amount = this.validateAmount(amount);
    this.validateNoteVisibility(note, vis);
    const target = this.userByHandle(st, toHandle);
    if (!target) err(404, "not_found");
    if (target.id === u.id) err(422, "self_payment");
    const held = this.heldMap(st)[u.id] || 0;
    if (u.balance - held < amount) err(409, "insufficient_funds");
    u.balance -= amount;
    target.balance += amount;
    const p = this.makePayment(
      st,
      newId("p"),
      u.id,
      target.id,
      amount,
      note,
      vis,
      requestId,
      authId,
      settlementId,
      refundOf
    );
    st.payments.push(p);
    if (requestId) {
      const r = st.requests.find((x: any) => x.request_id === requestId);
      if (r) {
        r.status = "paid";
        r.payment_id = p.payment_id;
      }
    }
    return p;
  }

  checkHistoricalNonnegative(st: any, overrides: Record<string, any> = {}): boolean {
    const cur: Record<string, number> = { ...st.opening_balances };
    const held: Record<string, number> = {};
    for (const uid of Object.keys(st.users)) held[uid] = 0;
    const events = new Map<string, { money: Record<string, number>; hold: Record<string, number> }>();

    const bucket = (atUsStr: string) => {
      let b = events.get(atUsStr);
      if (!b) {
        b = { money: {}, hold: {} };
        events.set(atUsStr, b);
      }
      return b;
    };

    for (const p of st.payments) {
      const r = overrides[p.payment_id] ?? p.revisions[p.revisions.length - 1];
      const atUs = parseDtUs(r.effective_at).toString();
      const b = bucket(atUs);
      b.money[p.from_user_id] = (b.money[p.from_user_id] || 0) - r.amount;
      b.money[p.to_user_id] = (b.money[p.to_user_id] || 0) + r.amount;
    }

    for (const a of st.authorizations || []) {
      const createdUs = parseDtUs(a.created_at).toString();
      const cb = bucket(createdUs);
      cb.hold[a.from_user_id] = (cb.hold[a.from_user_id] || 0) + a.amount;

      const captures: Array<[bigint, number]> = [];
      for (const pid of a.payment_ids || []) {
        const p = st.payments.find((x: any) => x.payment_id === pid);
        if (!p) continue;
        captures.push([parseDtUs(p.created_at), p.amount]);
      }
      for (const [atUs, amount] of captures) {
        const b = bucket(atUs.toString());
        b.hold[a.from_user_id] = (b.hold[a.from_user_id] || 0) - amount;
      }
      if (["captured", "voided", "expired"].includes(a.status) && a.closed_at) {
        const closedUs = parseDtUs(a.closed_at);
        const capturedBefore = captures
          .filter(([atUs]) => atUs <= closedUs)
          .reduce((acc, [, amt]) => acc + amt, 0);
        const remaining = Math.max(0, a.amount - capturedBefore);
        if (remaining > 0) {
          const b = bucket(closedUs.toString());
          b.hold[a.from_user_id] = (b.hold[a.from_user_id] || 0) - remaining;
        }
      }
    }

    const sortedTimes = Array.from(events.keys()).sort((a, b) => {
      const bA = BigInt(a);
      const bB = BigInt(b);
      return bA < bB ? -1 : bA > bB ? 1 : 0;
    });

    for (const atStr of sortedTimes) {
      const b = events.get(atStr)!;
      for (const [uid, delta] of Object.entries(b.money)) {
        cur[uid] = (cur[uid] || 0) + delta;
      }
      for (const [uid, delta] of Object.entries(b.hold)) {
        held[uid] = Math.max(0, (held[uid] || 0) + delta);
      }
      if (Object.values(cur).some((v) => v < 0)) return false;
      if (Object.keys(cur).some((uid) => cur[uid] - (held[uid] || 0) < 0)) return false;
    }
    return true;
  }
}
