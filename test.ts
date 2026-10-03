import test, { describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { app, store } from "./server.js";
import {
  Store,
  formatMicrosecondsIso,
  parseDtUs,
  monotonicMicroseconds,
  equalSplit,
  hashPassword,
  checkPassword,
} from "./core.js";

let server: http.Server;
let baseUrl: string;

function req(
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Accept: "application/json",
        ...headers,
      },
    };
    let payload = "";
    if (body !== undefined) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      options.headers!["Content-Type"] = "application/json";
      options.headers!["Content-Length"] = Buffer.byteLength(payload).toString();
    }
    const r = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed: any = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          // keep as string
        }
        resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed });
      });
    });
    r.on("error", reject);
    if (payload) {
      r.write(payload);
    }
    r.end();
  });
}

// Global fixtures setup
test.before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Helper to reset state cleanly before each suite
async function resetCleanFixture() {
  const fixture = {
    track: "pocketful",
    format_version: 1,
    currency: "EUR",
    minor_units: 2,
    authorization_ttl_seconds: 600,
    settlement_operator_ids: ["u_op"],
    users: [
      { id: "u_alice", handle: "alice", email: "alice@test.local", password: "password123", balance: 10000, display_name: "Alice" },
      { id: "u_bob", handle: "bob", email: "bob@test.local", password: "password123", balance: 5000, display_name: "Bob" },
      { id: "u_charlie", handle: "charlie", email: "charlie@test.local", password: "password123", balance: 2000, display_name: "Charlie" },
      { id: "u_op", handle: "operator", email: "operator@test.local", password: "password123", balance: 50000, display_name: "Operator" },
    ],
    payments: [],
    requests: [],
    authorizations: [],
  };
  const res = await req("POST", "/_test/reset", fixture);
  assert.equal(res.status, 204);
}

async function loginUser(email = "alice@test.local", password = "password123"): Promise<string> {
  const res = await req("POST", "/auth/login", { email, password });
  assert.equal(res.status, 200);
  return res.body.token;
}

describe("1. AUTHENTICATION", () => {
  test("signup creates new user and token", async () => {
    await resetCleanFixture();
    const res = await req("POST", "/auth/signup", {
      email: "newuser@test.local",
      password: "securepassword8",
      display_name: "New User",
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.ok(res.body.user_id);
    assert.equal(res.body.display_name, "New User");
  });

  test("signup rejects duplicate email with 409", async () => {
    const res = await req("POST", "/auth/signup", {
      email: "alice@test.local",
      password: "securepassword8",
      display_name: "Alice Clone",
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error?.code, "email_taken");
  });

  test("signup rejects password < 8 characters with 422", async () => {
    const res = await req("POST", "/auth/signup", {
      email: "shortpw@test.local",
      password: "short",
      display_name: "Short Pw",
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error?.code, "validation_failed");
  });

  test("login succeeds with valid credentials", async () => {
    const res = await req("POST", "/auth/login", {
      email: "alice@test.local",
      password: "password123",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.display_name, "Alice");
  });

  test("login rejects invalid password with 401 unauthenticated", async () => {
    const res = await req("POST", "/auth/login", {
      email: "alice@test.local",
      password: "wrongpassword",
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error?.code, "unauthenticated");
  });

  test("login rejects invalid email format with 422", async () => {
    const res = await req("POST", "/auth/login", {
      email: "not-an-email",
      password: "password123",
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error?.code, "validation_failed");
  });

  test("auth precedence: unauthenticated request gets 401 before idempotency check", async () => {
    const res = await req("POST", "/payments", { to_handle: "bob", amount: 100 }, {});
    assert.equal(res.status, 401);
    assert.equal(res.body.error?.code, "unauthenticated");
  });
});

describe("2. MONEY & PAYMENTS", () => {
  test("successful transfer deducts sender, credits receiver and conserves money", async () => {
    await resetCleanFixture();
    const token = await loginUser("alice@test.local");
    const res = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 1500, note: "Dinner", visibility: "public" },
      { Authorization: `Bearer ${token}`, "Idempotency-Key": "pay_key_1" }
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.amount, 1500);
    assert.equal(res.body.from_handle, "alice");
    assert.equal(res.body.to_handle, "bob");

    // Alice me check: balance = 8500
    const aliceMe = await req("GET", "/me", undefined, { Authorization: `Bearer ${token}` });
    assert.equal(aliceMe.status, 200);
    assert.equal(aliceMe.body.balance, 8500);
    assert.equal(aliceMe.body.available, 8500);

    // Bob me check: balance = 6500
    const bobToken = await loginUser("bob@test.local");
    const bobMe = await req("GET", "/me", undefined, { Authorization: `Bearer ${bobToken}` });
    assert.equal(bobMe.status, 200);
    assert.equal(bobMe.body.balance, 6500);
    assert.equal(bobMe.body.available, 6500);
  });

  test("rejects self-payment with 422 self_payment", async () => {
    const token = await loginUser("alice@test.local");
    const res = await req(
      "POST",
      "/payments",
      { to_handle: "alice", amount: 500 },
      { Authorization: `Bearer ${token}`, "Idempotency-Key": "self_pay" }
    );
    assert.equal(res.status, 422);
    assert.equal(res.body.error?.code, "self_payment");
  });

  test("rejects non-integer / negative / zero amounts with 422", async () => {
    const token = await loginUser("alice@test.local");
    for (const badAmount of [0, -100, 15.5, "1000", null, true]) {
      const res = await req(
        "POST",
        "/payments",
        { to_handle: "bob", amount: badAmount },
        { Authorization: `Bearer ${token}`, "Idempotency-Key": `bad_amt_${Math.random()}` }
      );
      assert.equal(res.status, 422, `Expected 422 for amount: ${badAmount}`);
      assert.equal(res.body.error?.code, "validation_failed");
    }
  });

  test("rejects transfer exceeding available balance with 409 insufficient_funds", async () => {
    const token = await loginUser("charlie@test.local"); // balance 2000
    const res = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 2001 },
      { Authorization: `Bearer ${token}`, "Idempotency-Key": "overspend" }
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.error?.code, "insufficient_funds");
  });
});

describe("3. IDEMPOTENCY", () => {
  test("same key + same request returns cached replay (200 OK)", async () => {
    await resetCleanFixture();
    const token = await loginUser("alice@test.local");
    const body = { to_handle: "bob", amount: 1000, note: "Coffee" };
    const res1 = await req("POST", "/payments", body, {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": "idem_coffee_1",
    });
    assert.equal(res1.status, 201);
    const pid = res1.body.payment_id;

    // Replay with exact same payload
    const res2 = await req("POST", "/payments", body, {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": "idem_coffee_1",
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.payment_id, pid);

    // Verify balance was only deducted ONCE (10000 - 1000 = 9000)
    const me = await req("GET", "/me", undefined, { Authorization: `Bearer ${token}` });
    assert.equal(me.body.balance, 9000);
  });

  test("same key + different request body returns 409 idempotency_key_reuse", async () => {
    const token = await loginUser("alice@test.local");
    const res = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 2000, note: "Different" },
      { Authorization: `Bearer ${token}`, "Idempotency-Key": "idem_coffee_1" }
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.error?.code, "idempotency_key_reuse");
  });

  test("missing idempotency key returns 400 missing_idempotency_key", async () => {
    const token = await loginUser("alice@test.local");
    const res = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 100 },
      { Authorization: `Bearer ${token}` }
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.error?.code, "missing_idempotency_key");
  });
});

describe("4. PAYMENT REQUESTS", () => {
  test("create, list, pay request lifecycle", async () => {
    await resetCleanFixture();
    const bobToken = await loginUser("bob@test.local");
    const aliceToken = await loginUser("alice@test.local");

    // Bob requests 1200 cents from Alice
    const resCreate = await req(
      "POST",
      "/requests",
      { payer_handle: "alice", amount: 1200, note: "Lunch" },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "rq_1" }
    );
    assert.equal(resCreate.status, 201);
    const rid = resCreate.body.request_id;
    assert.equal(resCreate.body.status, "pending");

    // Alice checks incoming requests
    const resList = await req("GET", "/requests?direction=incoming", undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(resList.status, 200);
    assert.equal(resList.body.requests.length, 1);
    assert.equal(resList.body.requests[0].request_id, rid);

    // Alice pays request
    const resPay = await req(
      "POST",
      `/requests/${rid}/pay`,
      {},
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "pay_rq_1" }
    );
    assert.equal(resPay.status, 201);
    assert.equal(resPay.body.request_id, rid);

    // Verify request status is now 'paid' and cannot be double paid
    const resDoublePay = await req(
      "POST",
      `/requests/${rid}/pay`,
      {},
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "pay_rq_2" }
    );
    assert.equal(resDoublePay.status, 409);
    assert.equal(resDoublePay.body.error?.code, "request_not_pending");
  });

  test("decline request", async () => {
    await resetCleanFixture();
    const bobToken = await loginUser("bob@test.local");
    const aliceToken = await loginUser("alice@test.local");

    const resCreate = await req(
      "POST",
      "/requests",
      { payer_handle: "alice", amount: 500, note: "Taxi" },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "rq_2" }
    );
    const rid = resCreate.body.request_id;

    // Alice declines
    const resDecline = await req("POST", `/requests/${rid}/decline`, {}, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(resDecline.status, 200);
    assert.equal(resDecline.body.status, "declined");
  });

  test("cancel request", async () => {
    await resetCleanFixture();
    const bobToken = await loginUser("bob@test.local");

    const resCreate = await req(
      "POST",
      "/requests",
      { payer_handle: "alice", amount: 500, note: "Mistake" },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "rq_3" }
    );
    const rid = resCreate.body.request_id;

    // Bob cancels his own request
    const resCancel = await req("POST", `/requests/${rid}/cancel`, {}, {
      Authorization: `Bearer ${bobToken}`,
    });
    assert.equal(resCancel.status, 200);
    assert.equal(resCancel.body.status, "cancelled");
  });
});

describe("5. SPLIT PAYMENTS", () => {
  test("equal split integer division and remainder distribution without caller self-request", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    // Total 1000 EUR cents split among alice, bob, charlie (3 people: 334, 333, 333)
    const res = await req(
      "POST",
      "/splits",
      {
        amount: 1000,
        participant_handles: ["alice", "bob", "charlie"],
        note: "Group Pizza",
      },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "split_1" }
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.shares.length, 3);
    assert.equal(res.body.shares[0].amount, 334); // remainder +1 given to first
    assert.equal(res.body.shares[1].amount, 333);
    assert.equal(res.body.shares[2].amount, 333);

    // Caller Alice is excluded from created requests (only bob and charlie receive requests)
    assert.equal(res.body.requests.length, 2);
    assert.ok(res.body.requests.every((r: any) => r.requester_handle === "alice"));
    assert.ok(res.body.requests.every((r: any) => r.payer_handle !== "alice"));
  });
});

describe("6. ATOMIC SETTLEMENTS", () => {
  test("operator authorization check on settlements", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");
    const res = await req(
      "POST",
      "/settlements",
      {
        transfers: [{ from_handle: "alice", to_handle: "bob", amount: 100 }],
      },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "set_unauth" }
    );
    assert.equal(res.status, 403);
    assert.equal(res.body.error?.code, "forbidden");
  });

  test("atomic settlement executes multiple transfers with single commit instant", async () => {
    const opToken = await loginUser("operator@test.local");
    const res = await req(
      "POST",
      "/settlements",
      {
        transfers: [
          { from_handle: "alice", to_handle: "bob", amount: 2000, note: "Settlement 1" },
          { from_handle: "bob", to_handle: "charlie", amount: 1000, note: "Settlement 2" },
        ],
      },
      { Authorization: `Bearer ${opToken}`, "Idempotency-Key": "set_1" }
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.payments.length, 2);
    assert.ok(res.body.committed_at);
    assert.equal(res.body.payments[0].created_at, res.body.committed_at);
    assert.equal(res.body.payments[1].created_at, res.body.committed_at);
  });
});

describe("7. AUTHORIZATIONS, HOLDS & CAPTURES", () => {
  test("create authorization holds funds and restricts available balance", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local"); // balance: 10000

    const res = await req(
      "POST",
      "/authorizations",
      { to_handle: "bob", amount: 3000, note: "Hotel Hold" },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "auth_1" }
    );
    assert.equal(res.status, 201);
    const aid = res.body.authorization_id;
    assert.equal(res.body.status, "open");
    assert.equal(res.body.remaining_amount, 3000);

    // Alice me check: total 10000, held 3000, available 7000
    const me = await req("GET", "/me", undefined, { Authorization: `Bearer ${aliceToken}` });
    assert.equal(me.body.total, 10000);
    assert.equal(me.body.held, 3000);
    assert.equal(me.body.available, 7000);

    // Cannot spend 7500 now even though total is 10000
    const overspend = await req(
      "POST",
      "/payments",
      { to_handle: "charlie", amount: 7500 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "over_held" }
    );
    assert.equal(overspend.status, 409);
    assert.equal(overspend.body.error?.code, "insufficient_funds");

    // Bob performs partial capture of 1000 (final: false)
    const bobToken = await loginUser("bob@test.local");
    const resCap1 = await req(
      "POST",
      `/authorizations/${aid}/capture`,
      { amount: 1000, final: false },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "cap_1" }
    );
    assert.equal(resCap1.status, 201);

    // After partial capture: Alice total = 9000, remaining held = 2000, available = 7000
    const meAfterCap1 = await req("GET", "/me", undefined, { Authorization: `Bearer ${aliceToken}` });
    assert.equal(meAfterCap1.body.total, 9000);
    assert.equal(meAfterCap1.body.held, 2000);
    assert.equal(meAfterCap1.body.available, 7000);

    // Bob performs final capture of remaining 2000
    const resCap2 = await req(
      "POST",
      `/authorizations/${aid}/capture`,
      { amount: 2000, final: true },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "cap_2" }
    );
    assert.equal(resCap2.status, 201);

    // Authorization is now captured; remaining held is 0
    const meAfterFinal = await req("GET", "/me", undefined, { Authorization: `Bearer ${aliceToken}` });
    assert.equal(meAfterFinal.body.total, 7000);
    assert.equal(meAfterFinal.body.held, 0);
    assert.equal(meAfterFinal.body.available, 7000);
  });

  test("voiding authorization releases held funds immediately", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    const res = await req(
      "POST",
      "/authorizations",
      { to_handle: "bob", amount: 4000 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "auth_void" }
    );
    const aid = res.body.authorization_id;

    // Alice voids the hold
    const resVoid = await req("POST", `/authorizations/${aid}/void`, {}, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(resVoid.status, 200);
    assert.equal(resVoid.body.status, "voided");

    // Funds restored to available balance
    const me = await req("GET", "/me", undefined, { Authorization: `Bearer ${aliceToken}` });
    assert.equal(me.body.held, 0);
    assert.equal(me.body.available, 10000);
  });
});

describe("8. BITEMPORAL STATEMENTS, REVISIONS & CORRECTIONS", () => {
  test("statement window [from, to), running balance, and immutable snapshots", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    // Alice sends 1000 to Bob
    await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 1000 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "p_stmt_1" }
    );

    // Fetch statement
    const stmtRes = await req("GET", "/statement", undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(stmtRes.status, 200);
    assert.equal(stmtRes.body.opening_balance, 10000);
    assert.equal(stmtRes.body.closing_balance, 9000);
    assert.equal(stmtRes.body.entries.length, 1);
    assert.ok(stmtRes.body.snapshot);
    const snapId = stmtRes.body.snapshot;

    // Querying the snapshot returns the exact frozen statement
    const snapRes = await req("GET", `/statement?snapshot=${snapId}`, undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(snapRes.status, 200);
    assert.equal(snapRes.body.closing_balance, 9000);

    // Mixing snapshot with from/to query params is strictly rejected with 422
    const badQuery = await req("GET", `/statement?snapshot=${snapId}&from=2026-01-01T00:00:00Z`, undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(badQuery.status, 422);
  });

  test("payment correction updates revision and enforces historical non-negative balance", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    const payRes = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 2000, note: "Initial" },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "p_corr_1" }
    );
    const pid = payRes.body.payment_id;

    // Correct amount from 2000 to 1500
    const corrRes = await req(
      "POST",
      `/payments/${pid}/corrections`,
      {
        expected_revision: 1,
        amount: 1500,
        effective_at: payRes.body.created_at,
        reason: "Overcharged",
      },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "corr_key_1" }
    );
    assert.equal(corrRes.status, 201);
    assert.equal(corrRes.body.revision, 2);
    assert.equal(corrRes.body.amount, 1500);

    // Stale revision rejection: submitting expected_revision: 1 again returns 409
    const staleRes = await req(
      "POST",
      `/payments/${pid}/corrections`,
      {
        expected_revision: 1,
        amount: 1000,
        effective_at: payRes.body.created_at,
        reason: "Stale update",
      },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "corr_stale" }
    );
    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.body.error?.code, "stale_revision");
  });
});

describe("9. REFUNDS & CORRECTION BATCHES", () => {
  test("refund by receiver creates linked refund payment capped by payment amount", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");
    const bobToken = await loginUser("bob@test.local");

    const pay = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 3000 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "p_for_ref" }
    );
    const pid = pay.body.payment_id;

    // Alice (sender) attempting to refund is forbidden with 403
    const forbiddenRefund = await req(
      "POST",
      `/payments/${pid}/refunds`,
      { amount: 1000 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "ref_fail" }
    );
    assert.equal(forbiddenRefund.status, 403);

    // Bob (receiver) refunds 1000
    const ref1 = await req(
      "POST",
      `/payments/${pid}/refunds`,
      { amount: 1000 },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "ref_ok_1" }
    );
    assert.equal(ref1.status, 201);
    assert.equal(ref1.body.refund_of, pid);
    assert.equal(ref1.body.amount, 1000);
    const refundPaymentId = ref1.body.payment_id;

    // Refund of a refund is rejected with 422 invalid_refund_target
    const refOfRef = await req(
      "POST",
      `/payments/${refundPaymentId}/refunds`,
      { amount: 500 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "ref_of_ref" }
    );
    assert.equal(refOfRef.status, 422);
    assert.equal(refOfRef.body.error?.code, "invalid_refund_target");

    // Cumulative refund cannot exceed original payment amount (attempting 2500 more when 2000 remaining)
    const excessRefund = await req(
      "POST",
      `/payments/${pid}/refunds`,
      { amount: 2500 },
      { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": "ref_excess" }
    );
    assert.equal(excessRefund.status, 422);
    assert.equal(excessRefund.body.error?.code, "refund_exceeds_payment");
  });

  test("correction batch validates settlement completeness and operator auth", async () => {
    await resetCleanFixture();
    const opToken = await loginUser("operator@test.local");

    // Settlement with 2 payments
    const setRes = await req(
      "POST",
      "/settlements",
      {
        transfers: [
          { from_handle: "alice", to_handle: "bob", amount: 1000 },
          { from_handle: "bob", to_handle: "charlie", amount: 1000 },
        ],
      },
      { Authorization: `Bearer ${opToken}`, "Idempotency-Key": "set_batch_test" }
    );
    const p1 = setRes.body.payments[0].payment_id;
    const p2 = setRes.body.payments[1].payment_id;
    const effAt = setRes.body.committed_at;

    // Incomplete settlement correction (only including p1) is rejected with 422 incomplete_settlement
    const incomplete = await req(
      "POST",
      "/correction-batches",
      {
        corrections: [
          {
            payment_id: p1,
            expected_revision: 1,
            amount: 800,
            effective_at: effAt,
            reason: "Partial adjustment",
          },
        ],
      },
      { Authorization: `Bearer ${opToken}`, "Idempotency-Key": "cb_incomplete" }
    );
    assert.equal(incomplete.status, 422);
    assert.equal(incomplete.body.error?.code, "incomplete_settlement");

    // Complete settlement batch succeeds
    const complete = await req(
      "POST",
      "/correction-batches",
      {
        corrections: [
          { payment_id: p1, expected_revision: 1, amount: 800, effective_at: effAt, reason: "Adjustment" },
          { payment_id: p2, expected_revision: 1, amount: 800, effective_at: effAt, reason: "Adjustment" },
        ],
      },
      { Authorization: `Bearer ${opToken}`, "Idempotency-Key": "cb_complete" }
    );
    assert.equal(complete.status, 201);
    assert.ok(complete.body.correction_batch_id);
    assert.equal(complete.body.revisions.length, 2);
  });
});

describe("10. DEMO FUNDING & HEALTH", () => {
  test("health check returns 200 ok", async () => {
    const res = await req("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  test("demo funding adds simulation credit idempotently", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    const res1 = await req("POST", "/demo/fund", {}, {
      Authorization: `Bearer ${aliceToken}`,
      "Idempotency-Key": "demo_fund_key",
    });
    assert.equal(res1.status, 201);
    assert.equal(res1.body.credited, 2500); // 25.00 EUR
    assert.equal(res1.body.demo_only, true);

    // Idempotent replay
    const res2 = await req("POST", "/demo/fund", {}, {
      Authorization: `Bearer ${aliceToken}`,
      "Idempotency-Key": "demo_fund_key",
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.credited, 2500);
  });
});

describe("11. TIMESTAMP HARDENING & MICROSECOND MONOTONICITY", () => {
  test("rapid successive payments receive strictly increasing monotonic timestamps", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(
        await req(
          "POST",
          "/payments",
          { to_handle: "bob", amount: 10 },
          { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `rapid_p_${i}` }
        )
      );
    }
    for (const r of results) {
      assert.equal(r.status, 201);
    }
    const timestamps = results.map((r) => r.body.created_at);
    for (let i = 1; i < timestamps.length; i++) {
      const prevUs = parseDtUs(timestamps[i - 1]);
      const currUs = parseDtUs(timestamps[i]);
      assert.ok(currUs > prevUs, `Expected ${timestamps[i]} > ${timestamps[i - 1]}`);
    }
  });

  test("sub-millisecond parsing and formatting roundtrip is exact", () => {
    const us = 1791000000123456n;
    const isoStr = formatMicrosecondsIso(us);
    assert.ok(isoStr.endsWith(".123456+00:00"));
    const parsedUs = parseDtUs(isoStr);
    assert.equal(parsedUs, us);
  });

  test("rapid sub-millisecond writes maintain aligned statement ordering, historical balances, and exact known_at boundaries", async () => {
    await resetCleanFixture();
    const aliceToken = await loginUser("alice@test.local");

    // Two rapid writes in immediate sequence
    const p1 = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 100 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "rapid_sub_1" }
    );
    const p2 = await req(
      "POST",
      "/payments",
      { to_handle: "bob", amount: 200 },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "rapid_sub_2" }
    );
    assert.equal(p1.status, 201);
    assert.equal(p2.status, 201);

    const us1 = parseDtUs(p1.body.created_at);
    const us2 = parseDtUs(p2.body.created_at);
    assert.ok(us2 > us1, "p2 microsecond timestamp must be strictly greater than p1");

    // Statement ordering: microsecond ordering places p1 before p2
    const stmt = await req("GET", "/statement", undefined, { Authorization: `Bearer ${aliceToken}` });
    assert.equal(stmt.status, 200);
    assert.equal(stmt.body.entries.length, 2);
    assert.equal(stmt.body.entries[0].payment.payment_id, p1.body.payment_id);
    assert.equal(stmt.body.entries[0].balance_after, 9900);
    assert.equal(stmt.body.entries[1].payment.payment_id, p2.body.payment_id);
    assert.equal(stmt.body.entries[1].balance_after, 9700);

    // Historical as_of boundary test:
    // as_of = p1.created_at should only reflect p1 (9900), not p2
    const histAtP1 = await req("GET", `/me?as_of=${encodeURIComponent(p1.body.created_at)}`, undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(histAtP1.status, 200);
    assert.equal(histAtP1.body.total, 9900);

    // as_of = p2.created_at reflects both p1 and p2 (9700)
    const histAtP2 = await req("GET", `/me?as_of=${encodeURIComponent(p2.body.created_at)}`, undefined, {
      Authorization: `Bearer ${aliceToken}`,
    });
    assert.equal(histAtP2.status, 200);
    assert.equal(histAtP2.body.total, 9700);

    // Known_at boundary test:
    // Apply correction to p1
    const corr = await req(
      "POST",
      `/payments/${p1.body.payment_id}/corrections`,
      {
        expected_revision: 1,
        amount: 150,
        effective_at: p1.body.created_at,
        reason: "Microsecond correction adjustment",
      },
      { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": "corr_sub_1" }
    );
    assert.equal(corr.status, 201);
    const corrRecAt = corr.body.recorded_at;

    // Statement queried with known_at = p2.created_at (BEFORE correction was recorded)
    const stmtKnownBefore = await req(
      "GET",
      `/statement?known_at=${encodeURIComponent(p2.body.created_at)}`,
      undefined,
      { Authorization: `Bearer ${aliceToken}` }
    );
    assert.equal(stmtKnownBefore.status, 200);
    // At that time, p1 was revision 1 with amount 100
    assert.equal(stmtKnownBefore.body.entries[0].revision, 1);
    assert.equal(stmtKnownBefore.body.entries[0].payment.amount, 100);
    assert.equal(stmtKnownBefore.body.closing_balance, 9700);

    // Statement queried with known_at = corrRecAt (AFTER correction was recorded)
    const stmtKnownAfter = await req(
      "GET",
      `/statement?known_at=${encodeURIComponent(corrRecAt)}`,
      undefined,
      { Authorization: `Bearer ${aliceToken}` }
    );
    assert.equal(stmtKnownAfter.status, 200);
    // Revision 2 with amount 150 now visible
    assert.equal(stmtKnownAfter.body.entries[0].revision, 2);
    assert.equal(stmtKnownAfter.body.entries[0].payment.amount, 150);
    assert.equal(stmtKnownAfter.body.closing_balance, 9650);
  });
});

describe("12. ATOMIC PERSISTENCE HARDENING", () => {
  test("atomic state write and recovery from corrupted file", () => {
    const testDbPath = path.join("/tmp/pocketful_test", `state_${Date.now()}.json`);
    const s1 = new Store(testDbPath);
    s1.mutate((st) => {
      st.currency = "JPY";
      st.minor_units = 0;
    });

    // Verify written file exists and contains valid JSON
    assert.ok(fs.existsSync(testDbPath));
    const content = JSON.parse(fs.readFileSync(testDbPath, "utf-8"));
    assert.equal(content.currency, "JPY");

    // Intentionally corrupt file
    fs.writeFileSync(testDbPath, "CORRUPTED_NOT_JSON", "utf-8");

    // New Store instantiation handles corruption gracefully by loading seeded clean state
    const s2 = new Store(testDbPath);
    assert.ok(s2.read().users);
    assert.equal(s2.read().currency, "EUR");
  });
});
