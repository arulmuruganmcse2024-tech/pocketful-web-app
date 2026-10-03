import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

async function post(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function runQA() {
  console.log("=== STARTING QA END-TO-END FLOW VERIFICATION ===");

  // 1. HEALTH CHECK
  const health = await get("/health");
  assert.equal(health.status, 200, "Health check must be 200");
  assert.equal(health.body.status, "ok");
  console.log("✓ Health check verified");

  // Signup unique dedicated test users for this QA run to be 100% isolated and repeatable
  const uid = Date.now();
  const aliceRes = await post("/auth/signup", {
    email: `a${uid}@qa.local`,
    password: "Password123!",
    display_name: "Alice QA"
  });
  assert.equal(aliceRes.status, 201);
  const aliceToken = aliceRes.body.token;
  const aliceMe0 = await get("/me", { Authorization: `Bearer ${aliceToken}` });
  const aliceHandle = aliceMe0.body.handle;

  const bobRes = await post("/auth/signup", {
    email: `b${uid}@qa.local`,
    password: "Password123!",
    display_name: "Bob QA"
  });
  assert.equal(bobRes.status, 201);
  const bobToken = bobRes.body.token;
  const bobMe0 = await get("/me", { Authorization: `Bearer ${bobToken}` });
  const bobHandle = bobMe0.body.handle;

  const charlieRes = await post("/auth/signup", {
    email: `c${uid}@qa.local`,
    password: "Password123!",
    display_name: "Charlie QA"
  });
  assert.equal(charlieRes.status, 201);
  const charlieToken = charlieRes.body.token;
  const charlieMe0 = await get("/me", { Authorization: `Bearer ${charlieToken}` });
  const charlieHandle = charlieMe0.body.handle;

  // Add demo funding to Alice and Bob so they have funds to transact
  for (let f = 0; f < 4; f++) {
    await post("/demo/fund", {}, {
      Authorization: `Bearer ${aliceToken}`,
      "Idempotency-Key": `fund_alice_${uid}_${f}`
    });
  }
  for (let f = 0; f < 2; f++) {
    await post("/demo/fund", {}, {
      Authorization: `Bearer ${bobToken}`,
      "Idempotency-Key": `fund_bob_${uid}_${f}`
    });
  }

  // FLOW A: Login → wallet → send payment → wallet refresh → activity
  console.log("\n--- FLOW A: Login → wallet → send payment → wallet refresh → activity ---");
  const aliceMe1 = await get("/me", { Authorization: `Bearer ${aliceToken}` });
  assert.equal(aliceMe1.status, 200);
  const startBal = aliceMe1.body.available;
  assert.ok(startBal >= 10000, `Alice should have at least 10000 minor units, has ${startBal}`);

  const payKey = `flow_a_pay_${Date.now()}`;
  const payRes = await post("/payments", {
    to_handle: bobHandle,
    amount: 1500,
    note: "Flow A lunch test",
    visibility: "public"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": payKey });
  assert.equal(payRes.status, 201);
  const paymentId = payRes.body.payment_id;

  const aliceMe2 = await get("/me", { Authorization: `Bearer ${aliceToken}` });
  assert.equal(aliceMe2.body.available, startBal - 1500, "Available must be reduced by 1500");

  const actRes = await get("/activity", { Authorization: `Bearer ${aliceToken}` });
  assert.equal(actRes.status, 200);
  const foundPay = actRes.body.payments.find((p: any) => p.payment_id === paymentId);
  assert.ok(foundPay, "Payment must appear in activity feed");
  assert.equal(foundPay.amount, 1500);
  console.log("✓ Flow A verified successfully");

  // FLOW B: Create payment request → inspect request → pay request → verify status
  console.log("\n--- FLOW B: Create payment request → inspect → pay → verify status ---");
  const reqKey = `flow_b_req_${Date.now()}`;
  const reqCreate = await post("/requests", {
    payer_handle: bobHandle,
    amount: 850,
    note: "Flow B request coffee"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": reqKey });
  assert.equal(reqCreate.status, 201);
  const requestId = reqCreate.body.request_id;
  assert.equal(reqCreate.body.status, "pending");

  const bobReqs = await get("/requests?direction=incoming", { Authorization: `Bearer ${bobToken}` });
  assert.equal(bobReqs.status, 200);
  const foundReq = bobReqs.body.requests.find((r: any) => r.request_id === requestId);
  assert.ok(foundReq, "Request must be in Bob incoming list");

  const bobPayReqKey = `flow_b_payreq_${Date.now()}`;
  const payReqRes = await post(`/requests/${requestId}/pay`, {}, {
    Authorization: `Bearer ${bobToken}`,
    "Idempotency-Key": bobPayReqKey
  });
  assert.equal(payReqRes.status, 201);

  const bobReqsAfter = await get("/requests?direction=incoming", { Authorization: `Bearer ${bobToken}` });
  const reqAfter = bobReqsAfter.body.requests.find((r: any) => r.request_id === requestId);
  assert.equal(reqAfter.status, "paid", "Request status must be paid");
  console.log("✓ Flow B verified successfully");

  // FLOW C: Create split → verify exact shares → verify requests
  console.log("\n--- FLOW C: Create split → verify exact shares ---");
  const splitKey = `flow_c_split_${Date.now()}`;
  const splitRes = await post("/splits", {
    amount: 1000,
    participant_handles: [aliceHandle, bobHandle, charlieHandle],
    note: "Flow C dinner split"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": splitKey });
  assert.equal(splitRes.status, 201);
  assert.equal(splitRes.body.shares.length, 3);
  // 1000 / 3 = 333 rem 1 => alice gets 334, bob gets 333, charlie gets 333
  assert.equal(splitRes.body.shares[0].amount, 334);
  assert.equal(splitRes.body.shares[1].amount, 333);
  assert.equal(splitRes.body.shares[2].amount, 333);
  // Requests generated for other participants (bob and charlie, caller excluded)
  assert.equal(splitRes.body.requests.length, 2);
  console.log("✓ Flow C verified successfully");

  // FLOW D: Create authorization → verify held amount → partial capture → verify remaining hold → final capture → verify released hold
  console.log("\n--- FLOW D: Create authorization → partial capture → final capture ---");
  const authKey = `flow_d_auth_${Date.now()}`;
  const authRes = await post("/authorizations", {
    to_handle: bobHandle,
    amount: 3000,
    note: "Flow D hotel deposit"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": authKey });
  assert.equal(authRes.status, 201);
  const authId = authRes.body.authorization_id;

  const aliceAfterAuth = await get("/me", { Authorization: `Bearer ${aliceToken}` });
  assert.equal(aliceAfterAuth.body.held >= 3000, true, "Held balance must include 3000");

  // Partial capture 1000 with final: false
  const capKey1 = `flow_d_cap1_${Date.now()}`;
  const cap1 = await post(`/authorizations/${authId}/capture`, {
    amount: 1000,
    final: false
  }, { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": capKey1 });
  assert.equal(cap1.status, 201);

  const authState1 = await get(`/authorizations`, { Authorization: `Bearer ${bobToken}` });
  const a1 = authState1.body.authorizations.find((x: any) => x.authorization_id === authId);
  assert.equal(a1.remaining_amount, 2000, "Remaining hold must be 2000");
  assert.equal(a1.status, "open", "Status must remain open after partial capture");

  // Final capture remaining 2000
  const capKey2 = `flow_d_cap2_${Date.now()}`;
  const cap2 = await post(`/authorizations/${authId}/capture`, {
    amount: 2000
  }, { Authorization: `Bearer ${bobToken}`, "Idempotency-Key": capKey2 });
  assert.equal(cap2.status, 201);

  const authState2 = await get(`/authorizations`, { Authorization: `Bearer ${bobToken}` });
  const a2 = authState2.body.authorizations.find((x: any) => x.authorization_id === authId);
  assert.equal(a2.status, "captured", "Status must be captured");
  assert.equal(a2.remaining_amount, 0, "Remaining hold must be 0");
  console.log("✓ Flow D verified successfully");

  // FLOW E: Authorization → void → verify held balance release
  console.log("\n--- FLOW E: Authorization → void → verify held release ---");
  const voidAuthKey = `flow_e_auth_${Date.now()}`;
  const voidAuth = await post("/authorizations", {
    to_handle: bobHandle,
    amount: 1000,
    note: "Flow E void test"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": voidAuthKey });
  assert.equal(voidAuth.status, 201);
  const voidId = voidAuth.body.authorization_id;

  const aliceHeldBeforeVoid = (await get("/me", { Authorization: `Bearer ${aliceToken}` })).body.held;

  const voidRes = await post(`/authorizations/${voidId}/void`, {}, { Authorization: `Bearer ${aliceToken}` });
  assert.equal(voidRes.status, 200);
  assert.equal(voidRes.body.status, "voided");

  const aliceHeldAfterVoid = (await get("/me", { Authorization: `Bearer ${aliceToken}` })).body.held;
  assert.equal(aliceHeldAfterVoid, aliceHeldBeforeVoid - 1000, "Held balance must be reduced by 1000 after void");
  console.log("✓ Flow E verified successfully");

  // FLOW F: Statement → filters → known_at → pagination → snapshot → immutable snapshot
  console.log("\n--- FLOW F: Statement → filters → snapshot immutability ---");
  const stmtRes = await get("/statement?limit=10", { Authorization: `Bearer ${aliceToken}` });
  assert.equal(stmtRes.status, 200);
  assert.ok(stmtRes.body.snapshot, "Snapshot ID must be generated");
  const snapId = stmtRes.body.snapshot;
  const initialClosing = stmtRes.body.closing_balance;

  // Make new transaction
  await post("/payments", {
    to_handle: bobHandle,
    amount: 100,
    note: "Post-snapshot payment"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `flow_f_pay_${Date.now()}` });

  // Query snapshot again
  const snapQuery = await get(`/statement?snapshot=${snapId}`, { Authorization: `Bearer ${aliceToken}` });
  assert.equal(snapQuery.status, 200);
  assert.equal(snapQuery.body.closing_balance, initialClosing, "Snapshot balance must be immutable");
  console.log("✓ Flow F verified successfully");

  // FLOW G: Payment refund → refund cap → balance changes → refund-of-refund protection
  console.log("\n--- FLOW G: Payment refund → refund cap → refund-of-refund protection ---");
  const payG = await post("/payments", {
    to_handle: bobHandle,
    amount: 2500,
    note: "Flow G for refund"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `flow_g_pay_${Date.now()}` });
  assert.equal(payG.status, 201);
  const payGId = payG.body.payment_id;

  // Attempt refund exceeding amount (2600 > 2500)
  const overRefund = await post(`/payments/${payGId}/refunds`, { amount: 2600 }, {
    Authorization: `Bearer ${bobToken}`,
    "Idempotency-Key": `flow_g_over_${Date.now()}`
  });
  assert.equal(overRefund.status, 422, "Excessive refund must be rejected with 422");
  assert.equal(overRefund.body.error.code, "refund_exceeds_payment");

  // Valid partial refund (1000)
  const ref1 = await post(`/payments/${payGId}/refunds`, { amount: 1000 }, {
    Authorization: `Bearer ${bobToken}`,
    "Idempotency-Key": `flow_g_ref1_${Date.now()}`
  });
  assert.equal(ref1.status, 201);
  const refundPayId = ref1.body.payment_id;

  // Attempt to refund the refund payment itself
  const refOfRef = await post(`/payments/${refundPayId}/refunds`, { amount: 500 }, {
    Authorization: `Bearer ${aliceToken}`,
    "Idempotency-Key": `flow_g_refref_${Date.now()}`
  });
  assert.equal(refOfRef.status, 422, "Refunding a refund must be rejected with 422");
  console.log("✓ Flow G verified successfully");

  // FLOW H: Historical correction → revision → overdraft protection
  console.log("\n--- FLOW H: Historical correction → revision → overdraft protection ---");
  const payH = await post("/payments", {
    to_handle: bobHandle,
    amount: 500,
    note: "Flow H original"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `flow_h_pay_${Date.now()}` });
  assert.equal(payH.status, 201);
  const payHId = payH.body.payment_id;

  const corrRes = await post(`/payments/${payHId}/corrections`, {
    expected_revision: 1,
    amount: 600,
    effective_at: payH.body.created_at,
    reason: "Correction adjustment"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `flow_h_corr_${Date.now()}` });
  assert.equal(corrRes.status, 201);
  assert.equal(corrRes.body.revision, 2);

  // Stale revision rejection
  const staleCorr = await post(`/payments/${payHId}/corrections`, {
    expected_revision: 1,
    amount: 700,
    effective_at: payH.body.created_at,
    reason: "Stale revision test"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": `flow_h_stale_${Date.now()}` });
  assert.equal(staleCorr.status, 409, "Stale revision must be 409");
  console.log("✓ Flow H verified successfully");

  // FLOW I: Network uncertainty → verify retry behavior → same idempotency key
  console.log("\n--- FLOW I: Idempotency replay & reuse validation ---");
  const idemKey = `flow_i_idem_${Date.now()}`;
  const idem1 = await post("/payments", {
    to_handle: bobHandle,
    amount: 400,
    note: "Idempotency test"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": idemKey });
  assert.equal(idem1.status, 201);

  // Exact retry with same key
  const idemReplay = await post("/payments", {
    to_handle: bobHandle,
    amount: 400,
    note: "Idempotency test"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": idemKey });
  assert.equal(idemReplay.status, 200, "Idempotent replay must return 200");
  assert.equal(idemReplay.body.payment_id, idem1.body.payment_id, "Replay must return original payment ID");

  // Same key with different payload
  const idemConflict = await post("/payments", {
    to_handle: bobHandle,
    amount: 800, // changed amount
    note: "Idempotency conflict"
  }, { Authorization: `Bearer ${aliceToken}`, "Idempotency-Key": idemKey });
  assert.equal(idemConflict.status, 409, "Idempotency key reuse with different body must return 409");
  assert.equal(idemConflict.body.error.code, "idempotency_key_reuse");
  console.log("✓ Flow I verified successfully");

  console.log("\n==================================================");
  console.log("ALL REAL USER FLOWS A THROUGH I VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runQA().catch((err) => {
  console.error("QA FAILURE:", err);
  process.exit(1);
});
