var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../explore-worker/runtime/owner-follow-outbox-529.mjs
var hex529 = /* @__PURE__ */ __name((b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(""), "hex529");
var signOwnerFollowPayload529 = /* @__PURE__ */ __name(async (body, at, secret) => {
  if (typeof secret !== "string" || secret.length < 32) throw Error("OWNER_FOLLOW_529_SECRET_REQUIRED");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex529(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(at) + "." + body)
  ));
}, "signOwnerFollowPayload529");

// ../explore-worker/runtime/owner-follow-auth-epoch-532.mjs
var EPOCH = /^[0-9a-f]{32}$/;
var isOwnerFollowAuthEpoch532 = /* @__PURE__ */ __name((e) => typeof e === "string" && EPOCH.test(e), "isOwnerFollowAuthEpoch532");
var INLINE_OWNER_FOLLOW_532_SELECT_SQL = `
 SELECT uid AS owner_uid, owner_follow_revision_530 AS revision,
 follower_count,updated_at,owner_follow_attempts_530 AS attempts,
 owner_follow_acked_revision_530 AS acked_revision,
 owner_follow_auth_epoch_532 AS auth_epoch
 FROM profile_stats INDEXED BY idx_owner_follow_due_530
 WHERE owner_follow_revision_530>owner_follow_acked_revision_530
 AND owner_follow_dead_at_530=0 AND owner_follow_attempts_530<8
 AND owner_follow_auth_epoch_532<>''
 AND owner_follow_next_at_530<=?
 ORDER BY owner_follow_next_at_530 ASC,uid ASC LIMIT ?`;
var INLINE_OWNER_FOLLOW_551_SELECT_SQL = INLINE_OWNER_FOLLOW_532_SELECT_SQL.replace(
  "follower_count,updated_at,",
  // Existing legacy stats rows can have updated_at=0 while a changed
  // overlay edge has a valid revision. This field is NOT the ordering key;
  // use the delivery-side server clock only as a positive protocol fallback.
  // Never mutate original profile timestamps to repair this metadata.
  `(follower_count+owner_follow_baseline_offset_551+owner_follow_overlay_delta_551) AS follower_count,
   CASE WHEN updated_at>0 THEN updated_at
    ELSE CAST(strftime('%s','now') AS INTEGER)*1000 END AS updated_at,`
);

// ../explore-worker/runtime/owner-follow-qa-boundary-577.mjs
var QA_OWNER_FOLLOW_FUNCTION_URL_577 = "https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542";

// ../explore-worker/runtime/owner-follow-http-539.mjs
var UID = /^[A-Za-z0-9_-]{1,128}$/;
var HTTP_LOCAL = /^http:\/\/(?:127\.0\.0\.1|localhost):[1-9][0-9]{1,4}\/owner-follow-539$/;
var HTTP_RELEASE = "https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542";
async function sendOwnerFollowHttp539(event, {
  endpoint,
  secret,
  send = fetch,
  now = Date.now,
  isolatedOnly = false,
  qaOnly = false
} = {}) {
  const target = String(endpoint || "");
  if (qaOnly && isolatedOnly || !(qaOnly ? target === QA_OWNER_FOLLOW_FUNCTION_URL_577 : isolatedOnly ? HTTP_LOCAL.test(target) : target === HTTP_RELEASE))
    throw Error("APP539_ENDPOINT_NOT_PINNED");
  if (!event || !UID.test(String(event.ownerUid || "")) || !isOwnerFollowAuthEpoch532(event.authEpoch) || !Number.isSafeInteger(event.version) || event.version <= 0 || !Number.isSafeInteger(event.followerCount) || event.followerCount < 0 || event.followerCount > 1e9 || !Number.isSafeInteger(event.updatedAt) || event.updatedAt <= 0)
    throw Error("APP539_INVALID_DURABLE_EVENT");
  const at = now();
  if (!Number.isSafeInteger(at) || at <= 0) throw Error("APP539_INVALID_CLOCK");
  const rawBody = JSON.stringify({
    version: 1,
    ownerUid: event.ownerUid,
    authEpoch: event.authEpoch,
    revision: event.version,
    followerCount: event.followerCount,
    updatedAt: event.updatedAt,
    at
  });
  const signature = await signOwnerFollowPayload529(rawBody, at, secret);
  const response = await send(endpoint, { method: "POST", headers: {
    "Content-Type": "application/json",
    "X-Soridraw-Follow-Relay529-At": String(at),
    "X-Soridraw-Follow-Relay529-Signature": signature
  }, body: rawBody });
  const payload = await response?.json?.().catch(() => null);
  return {
    ok: response?.ok === true && payload?.ok === true,
    status: response?.status || 0,
    applied: response?.ok === true && payload?.applied === true
  };
}
__name(sendOwnerFollowHttp539, "sendOwnerFollowHttp539");

// ../explore-worker/runtime/owner-follow-commit-proof-557.mjs
var UID2 = /^[A-Za-z0-9_-]{1,128}$/;
var OP = /^[A-Za-z0-9_-]{16,128}$/;
var TOKEN = /^.{1,128}$/;
async function verifyOwnerFollowCommitProof557({ reservation, env } = {}) {
  const r = reservation || {};
  if (!UID2.test(String(r.ownerUid || "")) || !UID2.test(String(r.actorUid || "")) || r.actorUid === r.ownerUid || !OP.test(String(r.operationId || "")) || !TOKEN.test(String(r.cutoverToken || "")) || typeof r.desired !== "boolean" || typeof r.beforeFollowing !== "boolean" || r.desired === r.beforeFollowing || !Number.isSafeInteger(r.expectedRevision) || r.expectedRevision < 0 || !Number.isSafeInteger(r.priorR2Revision) || r.priorR2Revision < 0)
    return { status: "invalid-reservation", committed: false };
  const media = env?.PROFILE_MEDIA;
  if (!media || typeof media.get !== "function")
    return { status: "r2-unavailable", committed: false };
  let manifest;
  try {
    const file = await media.get("internal/explore/follow-cutover-v348/active.json");
    if (!file) return { status: "cutover-unavailable", committed: false };
    manifest = JSON.parse(await file.text());
  } catch {
    return { status: "cutover-unavailable", committed: false };
  }
  if (manifest?.cutoverToken !== r.cutoverToken || manifest?.relationMode !== "overlay348" || manifest?.writeMode !== "active" || manifest?.profileCountsR2Exact !== true || manifest?.crashConsistentWriter354 !== true || manifest?.orderedClientRequests354 !== true || manifest?.oneWayAuthority348 !== true || manifest?.legacyRelationWritersFrozen !== true || manifest?.legacyCounterWritersFrozen !== true)
    return { status: "cutover-mismatch", committed: false };
  const key = "internal/explore/follow-intents-v354/" + encodeURIComponent(r.cutoverToken) + "/" + encodeURIComponent(r.actorUid) + "/" + encodeURIComponent(r.ownerUid) + ".json";
  let op;
  try {
    const file = await media.get(key);
    if (!file) return { status: "intent-not-present", committed: false };
    op = JSON.parse(await file.text());
  } catch {
    return { status: "intent-unavailable", committed: false };
  }
  if (op?.token !== r.cutoverToken || op?.actor !== r.actorUid || op?.target !== r.ownerUid || op?.id !== r.operationId || op?.following !== r.desired || op?.expectedRevision !== r.expectedRevision)
    return { status: "intent-not-matching", committed: false };
  if (op?.settled !== true || !Number.isSafeInteger(op.revision) || op.revision <= r.expectedRevision)
    return { status: "intent-not-settled", committed: false };
  return { status: "committed", committed: true, operationRevision: op.revision };
}
__name(verifyOwnerFollowCommitProof557, "verifyOwnerFollowCommitProof557");

// ../explore-worker/runtime/owner-follow-postcommit-555.mjs
var APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN = false;
var UID3 = /^[A-Za-z0-9_-]{1,128}$/;
var EPOCH2 = /^[0-9a-f]{32}$/;
var maxCount = 1e9;
var off = /* @__PURE__ */ __name((env, enabled) => !enabled || env?.SORIDRAW_ENVIRONMENT !== "preview" || env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555 !== "1", "off");
var outcome = /* @__PURE__ */ __name((status, other = {}) => ({ status, d1Writes: 0, ...other }), "outcome");
var qaRelayHold580 = /* @__PURE__ */ __name((env) => {
  const mode = env?.SORIDRAW_OWNER_FOLLOW_QA_ONLY_577;
  if (mode !== void 0 && mode !== "0" && mode !== "1")
    return "qa-relay-mode-invalid";
  if (mode === "1" && env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539 !== QA_OWNER_FOLLOW_FUNCTION_URL_577)
    return "qa-target-hold";
  return null;
}, "qaRelayHold580");
async function deliverSettledOwner555({
  ownerUid,
  expectedEpoch = null,
  afterRevision = 0,
  env,
  now = Date.now,
  send = fetch,
  enabled
} = {}) {
  if (off(env, enabled)) return outcome("disabled");
  if (!UID3.test(String(ownerUid || ""))) return outcome("invalid-owner");
  const qaHold = qaRelayHold580(env);
  if (qaHold) return outcome(qaHold);
  const qaOnly = env?.SORIDRAW_OWNER_FOLLOW_QA_ONLY_577 === "1";
  const key = "internal/explore/shared-profile-v113/" + encodeURIComponent(ownerUid) + ".json";
  let bundle;
  try {
    const file = await env?.PROFILE_MEDIA?.get(key);
    if (!file) return outcome("r2-unavailable");
    bundle = JSON.parse(await file.text());
  } catch {
    return outcome("r2-unavailable");
  }
  const count = bundle?.body?.data?.profile?.followerCount;
  const version = bundle?.revision;
  const sync = bundle?.followSync354;
  if (bundle?.body?.data?.profile?.uid !== ownerUid || !Number.isSafeInteger(version) || version <= 0 || !Number.isSafeInteger(count) || count < 0 || count > maxCount || sync?.exact !== true || !sync.pending || typeof sync.pending !== "object" || Array.isArray(sync.pending) || Object.keys(sync.pending).length !== 0)
    return outcome("r2-unsettled");
  if (version <= afterRevision) return outcome("r2-not-advanced");
  let epoch = "";
  try {
    const owner = await env.DB.prepare(
      "SELECT owner_follow_auth_epoch_532 AS epoch FROM profile_stats WHERE uid=? LIMIT 1"
    ).bind(ownerUid).first();
    epoch = String(owner?.epoch || "");
  } catch {
    return outcome("epoch-unavailable");
  }
  if (!EPOCH2.test(epoch)) return outcome("owner-not-enrolled");
  if (expectedEpoch !== null && epoch !== expectedEpoch)
    return outcome("rejected-generation");
  const secret = env.SORIDRAW_OWNER_FOLLOW_HMAC_539;
  const endpoint = env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539;
  const event = {
    ownerUid,
    authEpoch: epoch,
    version,
    followerCount: count,
    updatedAt: Math.max(1, Number(now()))
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const sent = await sendOwnerFollowHttp539(event, { endpoint, secret, send, now, qaOnly });
      if (sent.ok) return outcome("delivered", { deliveredRevision: version });
      if (sent.status === 409)
        return outcome("rejected-generation");
    } catch {
    }
  }
  return outcome("relay-failed");
}
__name(deliverSettledOwner555, "deliverSettledOwner555");
async function replayOwnerFollowReservation556({
  reservation,
  env,
  now = Date.now,
  send = fetch,
  enabled = APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN
} = {}) {
  if (off(env, enabled)) return outcome("disabled");
  const qaHold = qaRelayHold580(env);
  if (qaHold) return outcome(qaHold);
  const { ownerUid, authEpoch, priorR2Revision } = reservation || {};
  if (!UID3.test(String(ownerUid || "")) || !EPOCH2.test(String(authEpoch || "")) || !Number.isSafeInteger(priorR2Revision) || priorR2Revision < 0)
    return outcome("invalid-reservation");
  const proof = await verifyOwnerFollowCommitProof557({ reservation, env });
  if (!proof.committed) return outcome(proof.status);
  return deliverSettledOwner555({
    ownerUid,
    expectedEpoch: authEpoch,
    afterRevision: priorR2Revision,
    env,
    now,
    send,
    enabled
  });
}
__name(replayOwnerFollowReservation556, "replayOwnerFollowReservation556");

// ../explore-worker/runtime/owner-follow-recovery-556.mjs
var OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN = false;
var UID4 = /^[A-Za-z0-9_-]{1,128}$/;
var OP2 = /^[A-Za-z0-9_-]{16,128}$/;
var EPOCH3 = /^[0-9a-f]{32}$/;
var MAX_ATTEMPTS = 8;
var MAX_QUEUE = 24;
var INITIAL_MS = 1e3;
var valid = /* @__PURE__ */ __name((r) => r && UID4.test(String(r.ownerUid || "")) && UID4.test(String(r.actorUid || "")) && r.ownerUid !== r.actorUid && OP2.test(String(r.operationId || "")) && typeof r.cutoverToken === "string" && r.cutoverToken.length > 0 && r.cutoverToken.length <= 128 && typeof r.desired === "boolean" && typeof r.beforeFollowing === "boolean" && r.desired !== r.beforeFollowing && EPOCH3.test(String(r.authEpoch || "")) && Number.isSafeInteger(r.expectedRevision) && r.expectedRevision >= 0 && Number.isSafeInteger(r.priorR2Revision) && r.priorR2Revision >= 0, "valid");
var backoff = /* @__PURE__ */ __name((n) => Math.min(60 * 6e4, INITIAL_MS * 2 ** Math.max(0, n - 1)), "backoff");
var fail = /* @__PURE__ */ __name((status) => ({ ok: false, status }), "fail");
var identity = /* @__PURE__ */ __name((r) => r.actorUid + ":" + r.operationId, "identity");
var same = /* @__PURE__ */ __name((a, b) => a.ownerUid === b.ownerUid && a.actorUid === b.actorUid && a.operationId === b.operationId && a.cutoverToken === b.cutoverToken && a.authEpoch === b.authEpoch && a.desired === b.desired && a.beforeFollowing === b.beforeFollowing && a.expectedRevision === b.expectedRevision && a.priorR2Revision === b.priorR2Revision, "same");
function createOwnerFollowRecovery556({
  state,
  env,
  now = Date.now,
  deliver = replayOwnerFollowReservation556,
  enabled = OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN
} = {}) {
  const storage = state?.storage;
  const allowed = /* @__PURE__ */ __name(() => enabled && env?.SORIDRAW_ENVIRONMENT === "preview" && env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555 === "1", "allowed");
  const reserve = /* @__PURE__ */ __name(async (record) => {
    if (!allowed()) return fail("disabled");
    if (!valid(record) || !storage) return fail("invalid-reservation");
    const current = await storage.get("pending");
    if (current && (current.ownerUid !== record.ownerUid || current.authEpoch !== record.authEpoch)) return fail("generation-held");
    const entries = Array.isArray(current?.entries) ? current.entries : [];
    const old = entries.find((x) => identity(x) === identity(record));
    if (old) return same(old, record) ? { ok: true, status: "already-reserved", generation: old.generation } : fail("operation-conflict");
    if (entries.length >= MAX_QUEUE) return fail("owner-queue-full");
    const generation = Math.max(0, Number(current?.generation) || 0) + 1;
    const next = {
      ownerUid: record.ownerUid,
      authEpoch: record.authEpoch,
      generation,
      entries: [...entries, { ...record, generation, attempts: 0, dead: false, nextAttemptAt: 0 }]
    };
    const at = now(), due = at + INITIAL_MS;
    const scheduled = typeof storage.getAlarm === "function" ? await storage.getAlarm() : null;
    const canReuse = Number.isSafeInteger(scheduled) && scheduled > at && scheduled <= due;
    const put = storage.put("pending", next);
    const wake = canReuse ? Promise.resolve() : storage.setAlarm(due);
    await Promise.all([put, wake]);
    return { ok: true, status: "reserved", generation };
  }, "reserve");
  const alarm = /* @__PURE__ */ __name(async () => {
    if (!allowed() || !storage) return fail("disabled");
    const current = await storage.get("pending");
    if (!current) return { ok: true, status: "empty" };
    const entries = Array.isArray(current.entries) ? current.entries : [];
    const live = entries.filter((x) => valid(x) && !x.dead);
    if (!live.length) return fail("manual-hold");
    const at = now();
    const dueOf = /* @__PURE__ */ __name((x) => Number.isSafeInteger(x.nextAttemptAt) && x.nextAttemptAt > 0 ? x.nextAttemptAt : 0, "dueOf");
    const due = live.filter((x) => dueOf(x) <= at);
    const item = due.reduce((best, x) => !best || x.attempts < best.attempts || x.attempts === best.attempts && x.generation < best.generation ? x : best, null);
    if (!item) {
      await storage.setAlarm(Math.max(at + INITIAL_MS, Math.min(...live.map(dueOf))));
      return { ok: true, status: "retry-scheduled", attempts: 0 };
    }
    let result;
    try {
      result = await deliver({ reservation: item, env, now, enabled: true });
    } catch {
      result = { status: "relay-failed" };
    }
    const latest = await storage.get("pending");
    const target = latest?.entries?.find((x) => identity(x) === identity(item));
    if (!target || target.generation !== item.generation || latest.ownerUid !== item.ownerUid || latest.authEpoch !== item.authEpoch) {
      if (latest?.entries?.some((x) => !x.dead)) await storage.setAlarm(now() + INITIAL_MS);
      return { ok: true, status: "newer-reservation-preserved" };
    }
    const done = result?.status === "delivered" || result?.status === "rejected-generation";
    const attempts = item.attempts + 1;
    const dead = !done && attempts >= MAX_ATTEMPTS;
    const updated = done ? latest.entries.filter((x) => identity(x) !== identity(item)) : latest.entries.map((x) => identity(x) === identity(item) ? { ...x, attempts, dead, nextAttemptAt: dead ? 0 : now() + backoff(attempts) } : x);
    if (updated.length === 0) {
      await storage.delete("pending");
      return { ok: true, status: result.status };
    }
    const put = storage.put("pending", { ...latest, entries: updated });
    const pending = updated.filter((x) => valid(x) && !x.dead);
    const earliest = pending.length ? Math.min(...pending.map((x) => Number.isSafeInteger(x.nextAttemptAt) && x.nextAttemptAt > 0 ? x.nextAttemptAt : 0)) : 0;
    const wake = pending.length ? storage.setAlarm(Math.max(now() + INITIAL_MS, earliest)) : Promise.resolve();
    await Promise.all([put, wake]);
    return {
      ok: done,
      status: done ? result.status : dead ? "manual-hold" : "retry-scheduled",
      attempts: done ? item.attempts : attempts
    };
  }, "alarm");
  return { reserve, alarm };
}
__name(createOwnerFollowRecovery556, "createOwnerFollowRecovery556");

// worker.mjs
var APP600_OWNER_WORKER_COMPILED_OPEN = true;
var UID5 = /^[A-Za-z0-9_-]{1,128}$/;
var APPROVED_CANARY_SHA256_600 = "8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f";
async function approvedOwner600(uid, env, syntheticOwnerUid) {
  if (!UID5.test(String(uid || ""))) return false;
  if (syntheticOwnerUid !== void 0) return uid === syntheticOwnerUid;
  if (String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || "") !== uid) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(uid));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return hash === APPROVED_CANARY_SHA256_600;
}
__name(approvedOwner600, "approvedOwner600");
var MAX_BODY_BYTES = 1024;
var INTERNAL_RESERVE = "/internal/owner-follow/reserve600";
var INTERNAL_REPLAY = "https://owner-follow.internal/owner-follow/replay557-internal";
var SECRET_HEADER = "X-Soridraw-Owner-Bridge-600";
var reply = /* @__PURE__ */ __name((status, body) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" }
}), "reply");
var active = /* @__PURE__ */ __name((env, enabled) => enabled === true && env?.SORIDRAW_ENVIRONMENT === "preview" && env?.SORIDRAW_OWNER_DO_STANDALONE_600 === "1", "active");
function capabilityValid(request, env) {
  const expected = env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
  const supplied = request.headers.get(SECRET_HEADER);
  if (typeof expected !== "string" || expected.length < 32 || expected.length > 256 || typeof supplied !== "string") return false;
  let difference = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return difference === 0;
}
__name(capabilityValid, "capabilityValid");
async function limitedTicket(request) {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES))
    return { status: 413 };
  let raw;
  try {
    raw = await request.text();
  } catch {
    return { status: 400 };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
    return { status: 413 };
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== "object" || !UID5.test(String(value.ownerUid || ""))) return { status: 400 };
    return { ticket: value };
  } catch {
    return { status: 400 };
  }
}
__name(limitedTicket, "limitedTicket");
async function replayThroughService600({ reservation, env } = {}) {
  const service = env?.OWNER_FOLLOW_CANONICAL_REPLAY_600;
  const secret = env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
  if (typeof service?.fetch !== "function" || typeof secret !== "string" || secret.length < 32) return { status: "relay-failed" };
  try {
    const response = await service.fetch(new Request(INTERNAL_REPLAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SECRET_HEADER]: secret
      },
      body: JSON.stringify(reservation)
    }));
    const value = await response.json();
    if (response.status === 200 && value?.status === "delivered" && Number.isSafeInteger(value.deliveredRevision) && value.deliveredRevision > reservation.priorR2Revision)
      return { status: "delivered" };
    if (response.status === 409 && value?.status === "rejected-generation")
      return { status: "rejected-generation" };
  } catch {
  }
  return { status: "relay-failed" };
}
__name(replayThroughService600, "replayThroughService600");
function createOwnerDoService600({
  state,
  env,
  enabled = APP600_OWNER_WORKER_COMPILED_OPEN,
  now = Date.now,
  deliver = replayThroughService600,
  syntheticOwnerUid
} = {}) {
  const engine = createOwnerFollowRecovery556({ state, env, enabled, now, deliver });
  return {
    async fetch(request) {
      if (!active(env, enabled)) return reply(503, { ok: false, status: "disabled" });
      if (request.method !== "POST" || new URL(request.url).pathname !== INTERNAL_RESERVE)
        return reply(404, { ok: false });
      if (!capabilityValid(request, env)) return reply(403, { ok: false });
      const parsed = await limitedTicket(request);
      if (!parsed.ticket) return reply(parsed.status, { ok: false });
      if (!await approvedOwner600(parsed.ticket.ownerUid, env, syntheticOwnerUid))
        return reply(403, { ok: false, status: "owner-not-approved" });
      const result = await engine.reserve(parsed.ticket).catch(() => ({ ok: false, status: "storage-unavailable" }));
      return reply(result.ok ? 200 : 503, result);
    },
    alarm: /* @__PURE__ */ __name(async () => {
      if (!active(env, enabled) || !await approvedOwner600(String(env?.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574 || ""), env, syntheticOwnerUid))
        return { ok: false, status: "disabled" };
      return engine.alarm();
    }, "alarm")
  };
}
__name(createOwnerDoService600, "createOwnerDoService600");
var OwnerFollowerStandalone600 = class {
  static {
    __name(this, "OwnerFollowerStandalone600");
  }
  constructor(state, env) {
    this.service = createOwnerDoService600({ state, env });
  }
  fetch(request) {
    return this.service.fetch(request);
  }
  alarm() {
    return this.service.alarm();
  }
};
async function handleOwnerWorker600(request, env, {
  enabled = APP600_OWNER_WORKER_COMPILED_OPEN,
  syntheticOwnerUid
} = {}) {
  if (!active(env, enabled)) return reply(503, { ok: false, status: "disabled" });
  if (request.method !== "POST" || new URL(request.url).pathname !== INTERNAL_RESERVE)
    return reply(404, { ok: false });
  if (!capabilityValid(request, env)) return reply(403, { ok: false });
  const parsed = await limitedTicket(request);
  if (!parsed.ticket) return reply(parsed.status, { ok: false });
  if (!await approvedOwner600(parsed.ticket.ownerUid, env, syntheticOwnerUid))
    return reply(403, { ok: false, status: "owner-not-approved" });
  const namespace = env?.OWNER_FOLLOW_DO_600;
  if (typeof namespace?.idFromName !== "function" || typeof namespace?.get !== "function")
    return reply(503, { ok: false, status: "missing-do-binding" });
  try {
    const stub = namespace.get(namespace.idFromName(parsed.ticket.ownerUid));
    const internal = new Request("https://owner-follow.internal" + INTERNAL_RESERVE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SECRET_HEADER]: env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600
      },
      body: JSON.stringify(parsed.ticket)
    });
    if (new TextEncoder().encode(await internal.clone().text()).byteLength > MAX_BODY_BYTES)
      return reply(413, { ok: false });
    return await stub.fetch(internal);
  } catch {
    return reply(503, { ok: false, status: "reservation-unavailable" });
  }
}
__name(handleOwnerWorker600, "handleOwnerWorker600");
var worker_default = { fetch(request, env) {
  return handleOwnerWorker600(request, env);
} };
export {
  APP600_OWNER_WORKER_COMPILED_OPEN,
  OwnerFollowerStandalone600,
  createOwnerDoService600,
  worker_default as default,
  handleOwnerWorker600,
  replayThroughService600
};
//# sourceMappingURL=worker.js.map
