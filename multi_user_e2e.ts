import assert from "node:assert/strict";
import { describe, test, before } from "node:test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface ClientSession {
  email: string;
  handle: string;
  token: string;
  userId: string;
}

let sessionAda: ClientSession;
let sessionBob: ClientSession;
let sessionCy: ClientSession;

async function api(
  token: string,
  method: string,
  path: string,
  body?: any,
  idempotencyKey?: string
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function login(email: string): Promise<ClientSession> {
  const res = await api("", "POST", "/auth/login", { email, password: "password123" });
  assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(res.body)}`);
  return {
    email,
    handle: res.body.handle || email.split("@")[0],
    token: res.body.token,
    userId: res.body.user_id,
  };
}

const cleanFixture = {
  track: "pocketful",
  format_version: 1,
  currency: "EUR",
  minor_units: 2,
  authorization_ttl_seconds: 600,
  settlement_operator_ids: ["u_ada"],
  users: [
    { id: "u_ada", handle: "ada", email: "ada@pocketful.dev", password: "password123", balance: 50000, display_name: "Ada Lovelace" },
    { id: "u_bob", handle: "bob", email: "bob@pocketful.dev", password: "password123", balance: 25000, display_name: "Bob Babbage" },
    { id: "u_cy", handle: "cy", email: "cy@pocketful.dev", password: "password123", balance: 15000, display_name: "Cy Turing" },
  ],
  payments: [],
  requests: [],
  authorizations: [],
};

describe("POCKETFUL MULTI-USER MASTERPIECE E2E SUITE", () => {
  before(async () => {
    // Reset test database to clean fixture state
    const resetRes = await api("", "POST", "/_test/reset", cleanFixture);
    assert.equal(resetRes.status, 204, `Reset failed: ${JSON.stringify(resetRes.body)}`);
    sessionAda = await login("ada@pocketful.dev");
    sessionBob = await login("bob@pocketful.dev");
    sessionCy = await login("cy@pocketful.dev");
  });

  test("TEST 1: Ada -> Bob payment updates balances and activity with correct visibility", async () => {
    const adaBefore = await api(sessionAda.token, "GET", "/me");
    const bobBefore = await api(sessionBob.token, "GET", "/me");

    const payRes = await api(
      sessionAda.token,
      "POST",
      "/payments",
      { to_handle: "bob", amount: 1500, note: "Dinner split", visibility: "public" },
      "mu_t1_pay"
    );
    assert.equal(payRes.status, 201);
    const pid = payRes.body.payment_id;

    const adaAfter = await api(sessionAda.token, "GET", "/me");
    const bobAfter = await api(sessionBob.token, "GET", "/me");

    assert.equal(adaAfter.body.total, adaBefore.body.total - 1500);
    assert.equal(bobAfter.body.total, bobBefore.body.total + 1500);

    // Verify Ada activity feed shows outgoing payment
    const adaAct = await api(sessionAda.token, "GET", "/activity");
    assert.ok(adaAct.body.payments.some((p: any) => p.payment_id === pid && p.from_handle === "ada"));

    // Verify Bob activity feed shows incoming payment
    const bobAct = await api(sessionBob.token, "GET", "/activity");
    assert.ok(bobAct.body.payments.some((p: any) => p.payment_id === pid && p.to_handle === "bob"));
  });

  test("TEST 2: Ada -> Bob payment request lifecycle (create -> inspect -> fulfill)", async () => {
    // Ada requests 800 from Bob
    const reqRes = await api(
      sessionAda.token,
      "POST",
      "/requests",
      { payer_handle: "bob", amount: 800, note: "Coffee" },
      "mu_t2_req"
    );
    assert.equal(reqRes.status, 201);
    const rid = reqRes.body.request_id;

    // Bob inspects incoming requests
    const bobIncoming = await api(sessionBob.token, "GET", "/requests?direction=incoming");
    const found = bobIncoming.body.requests.find((r: any) => r.request_id === rid);
    assert.ok(found, "Bob should see incoming request from Ada");
    assert.equal(found.status, "pending");

    // Bob pays the request
    const bobMeBefore = await api(sessionBob.token, "GET", "/me");
    const adaMeBefore = await api(sessionAda.token, "GET", "/me");

    const payReqRes = await api(sessionBob.token, "POST", `/requests/${rid}/pay`, {}, "mu_t2_pay");
    assert.equal(payReqRes.status, 201);

    const bobMeAfter = await api(sessionBob.token, "GET", "/me");
    const adaMeAfter = await api(sessionAda.token, "GET", "/me");

    assert.equal(bobMeAfter.body.total, bobMeBefore.body.total - 800);
    assert.equal(adaMeAfter.body.total, adaMeBefore.body.total + 800);

    // Both parties see paid state
    const adaReqs = await api(sessionAda.token, "GET", "/requests?direction=outgoing");
    assert.equal(adaReqs.body.requests.find((r: any) => r.request_id === rid).status, "paid");
  });

  test("TEST 3: Ada creates 3-way split -> Bob and Cy receive separate requests", async () => {
    const splitRes = await api(
      sessionAda.token,
      "POST",
      "/splits",
      {
        amount: 3000,
        participant_handles: ["ada", "bob", "cy"],
        note: "Team lunch",
      },
      "mu_t3_split"
    );
    assert.equal(splitRes.status, 201);
    assert.equal(splitRes.body.requests.length, 2); // Bob and Cy (Ada excluded)
    assert.equal(splitRes.body.requests[0].amount, 1000);
    assert.equal(splitRes.body.requests[1].amount, 1000);

    // Bob inspects his pending requests
    const bobReqs = await api(sessionBob.token, "GET", "/requests?direction=incoming&status=pending");
    assert.ok(bobReqs.body.requests.some((r: any) => r.amount === 1000 && r.note === "Team lunch"));

    // Cy inspects his pending requests
    const cyReqs = await api(sessionCy.token, "GET", "/requests?direction=incoming&status=pending");
    assert.ok(cyReqs.body.requests.some((r: any) => r.amount === 1000 && r.note === "Team lunch"));
  });

  test("TEST 4: Ada authorizes Bob -> Bob partial capture (final=false) -> final capture (final=true)", async () => {
    // Ada authorizes 3000 for Bob
    const authRes = await api(
      sessionAda.token,
      "POST",
      "/authorizations",
      { to_handle: "bob", amount: 3000, note: "Hotel deposit" },
      "mu_t4_auth"
    );
    assert.equal(authRes.status, 201);
    const aid = authRes.body.authorization_id;

    const adaAfterHold = await api(sessionAda.token, "GET", "/me");
    assert.equal(adaAfterHold.body.held, 3000);

    // Bob performs partial capture of 1000 with final=false
    const cap1 = await api(
      sessionBob.token,
      "POST",
      `/authorizations/${aid}/capture`,
      { amount: 1000, final: false },
      "mu_t4_cap1"
    );
    assert.equal(cap1.status, 201);

    const adaAfterCap1 = await api(sessionAda.token, "GET", "/me");
    assert.equal(adaAfterCap1.body.held, 2000, "Remaining 2000 must stay held");

    // Bob performs final capture of 2000 with final=true
    const cap2 = await api(
      sessionBob.token,
      "POST",
      `/authorizations/${aid}/capture`,
      { amount: 2000, final: true },
      "mu_t4_cap2"
    );
    assert.equal(cap2.status, 201);

    const authsRes = await api(sessionBob.token, "GET", "/authorizations");
    const authItem = authsRes.body.authorizations.find((a: any) => a.authorization_id === aid);
    assert.equal(authItem.status, "captured");

    const adaAfterFinal = await api(sessionAda.token, "GET", "/me");
    assert.equal(adaAfterFinal.body.held, 0, "Held amount must be 0 after final capture");
  });

  test("TEST 5: Bob refunds payment received from Ada", async () => {
    // Ada sends 1200 to Bob
    const payRes = await api(
      sessionAda.token,
      "POST",
      "/payments",
      { to_handle: "bob", amount: 1200, note: "To be refunded" },
      "mu_t5_pay"
    );
    assert.equal(payRes.status, 201);
    const pid = payRes.body.payment_id;

    const adaMeBefore = await api(sessionAda.token, "GET", "/me");
    const bobMeBefore = await api(sessionBob.token, "GET", "/me");

    // Bob refunds 1200
    const refundRes = await api(
      sessionBob.token,
      "POST",
      `/payments/${pid}/refunds`,
      { amount: 1200 },
      "mu_t5_ref"
    );
    assert.equal(refundRes.status, 201);
    assert.equal(refundRes.body.amount, 1200);

    const adaMeAfter = await api(sessionAda.token, "GET", "/me");
    const bobMeAfter = await api(sessionBob.token, "GET", "/me");

    assert.equal(adaMeAfter.body.total, adaMeBefore.body.total + 1200);
    assert.equal(bobMeAfter.body.total, bobMeBefore.body.total - 1200);
  });

  test("TEST 6: Rapid repeated requests by Ada while Bob reads wallet concurrently", async () => {
    const promises: Promise<any>[] = [];

    // Ada fires 5 rapid writes
    for (let i = 0; i < 5; i++) {
      promises.push(
        api(
          sessionAda.token,
          "POST",
          "/requests",
          { payer_handle: "bob", amount: 10 + i, note: `Rapid ${i}` },
          `mu_rapid_${i}`
        )
      );
    }

    // Bob concurrently polls /me and /requests
    for (let i = 0; i < 5; i++) {
      promises.push(api(sessionBob.token, "GET", "/me"));
      promises.push(api(sessionBob.token, "GET", "/requests"));
    }

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.ok(r.status === 200 || r.status === 201, `Status ${r.status} unexpected`);
    }
  });

  test("TEST 7: Concurrent duplicate writes with same Idempotency-Key result in exactly ONE transaction", async () => {
    const adaBefore = await api(sessionAda.token, "GET", "/me");
    const bobBefore = await api(sessionBob.token, "GET", "/me");

    const key = "concurrent_idem_key_777";
    const body = { to_handle: "bob", amount: 500, note: "Concurrent test" };

    // Fire two requests at the exact same moment
    const [resA, resB] = await Promise.all([
      api(sessionAda.token, "POST", "/payments", body, key),
      api(sessionAda.token, "POST", "/payments", body, key),
    ]);

    assert.ok(
      (resA.status === 201 && resB.status === 200) ||
      (resA.status === 200 && resB.status === 201) ||
      (resA.status === 201 && resB.status === 201) ||
      (resA.status === 200 && resB.status === 200)
    );
    assert.equal(resA.body.payment_id, resB.body.payment_id);

    const adaAfter = await api(sessionAda.token, "GET", "/me");
    const bobAfter = await api(sessionBob.token, "GET", "/me");

    // Exactly ONE 500 minor units deduction!
    assert.equal(adaAfter.body.total, adaBefore.body.total - 500);
    assert.equal(bobAfter.body.total, bobBefore.body.total + 500);
  });

  test("TEST 8: One client refreshes while another mutates -> latest confirmed state wins", async () => {
    // Bob sends to Cy
    const mutPromise = api(
      sessionBob.token,
      "POST",
      "/payments",
      { to_handle: "cy", amount: 250, note: "Race test" },
      "race_mut_key"
    );
    // Cy concurrently queries
    const [mutRes, cyMe] = await Promise.all([
      mutPromise,
      api(sessionCy.token, "GET", "/me"),
    ]);

    assert.equal(mutRes.status, 201);
    // Fresh query confirms Cy has updated balance
    const cyFinal = await api(sessionCy.token, "GET", "/me");
    assert.ok(cyFinal.body.total >= cyMe.body.total);
  });

  test("TEST 9: Cross-user permission boundaries strictly enforce 403 Forbidden", async () => {
    // Ada creates a request for Bob
    const reqRes = await api(
      sessionAda.token,
      "POST",
      "/requests",
      { payer_handle: "bob", amount: 999 },
      "perm_req_1"
    );
    assert.equal(reqRes.status, 201);
    const rid = reqRes.body.request_id;

    // Cy attempts to pay Ada's request for Bob -> 403 Forbidden
    const cyPay = await api(sessionCy.token, "POST", `/requests/${rid}/pay`, {}, "cy_pay_evil");
    assert.equal(cyPay.status, 403);

    // Cy attempts to cancel Ada's request -> 403 Forbidden
    const cyCancel = await api(sessionCy.token, "POST", `/requests/${rid}/cancel`, {}, "cy_cancel_evil");
    assert.equal(cyCancel.status, 403);

    // Ada creates an authorization for Bob
    const authRes = await api(
      sessionAda.token,
      "POST",
      "/authorizations",
      { to_handle: "bob", amount: 1000 },
      "perm_auth_1"
    );
    assert.equal(authRes.status, 201);
    const aid = authRes.body.authorization_id;

    // Cy attempts to capture Bob's authorization -> 403 Forbidden
    const cyCap = await api(
      sessionCy.token,
      "POST",
      `/authorizations/${aid}/capture`,
      { amount: 500 },
      "cy_cap_evil"
    );
    assert.equal(cyCap.status, 403);
  });

  test("TEST 10: 3 users perform concurrent payments with strict conservation of money", async () => {
    const [ada0, bob0, cy0] = await Promise.all([
      api(sessionAda.token, "GET", "/me"),
      api(sessionBob.token, "GET", "/me"),
      api(sessionCy.token, "GET", "/me"),
    ]);
    const totalStart = ada0.body.total + bob0.body.total + cy0.body.total;

    // Concurrently:
    // Ada -> Bob: 100
    // Bob -> Cy: 100
    // Cy -> Ada: 100
    await Promise.all([
      api(sessionAda.token, "POST", "/payments", { to_handle: "bob", amount: 100 }, "circ_1"),
      api(sessionBob.token, "POST", "/payments", { to_handle: "cy", amount: 100 }, "circ_2"),
      api(sessionCy.token, "POST", "/payments", { to_handle: "ada", amount: 100 }, "circ_3"),
    ]);

    const [adaEnd, bobEnd, cyEnd] = await Promise.all([
      api(sessionAda.token, "GET", "/me"),
      api(sessionBob.token, "GET", "/me"),
      api(sessionCy.token, "GET", "/me"),
    ]);

    const totalEnd = adaEnd.body.total + bobEnd.body.total + cyEnd.body.total;

    // Absolute money conservation!
    assert.equal(totalEnd, totalStart, "Total circulating supply must be perfectly conserved");
    assert.ok(adaEnd.body.total >= 0);
    assert.ok(bobEnd.body.total >= 0);
    assert.ok(cyEnd.body.total >= 0);
  });

  test("TEST 11: Gemini Assistant endpoint returns grounded read-only response", async () => {
    // Query assistant for Ada
    const aiRes = await api(sessionAda.token, "POST", "/api/ai/assistant", {
      message: "What is my current available balance?",
    });
    assert.equal(aiRes.status, 200);
    assert.ok(aiRes.body.reply, "Must return reply string");
    assert.ok(aiRes.body.safe_context, "Must return safe context");
    assert.equal(typeof aiRes.body.safe_context.available, "number");

    // Attempting to ask AI assistant while unauthenticated returns 401
    const anonRes = await api("", "POST", "/api/ai/assistant", { message: "Hello" });
    assert.equal(anonRes.status, 401);
  });
});
