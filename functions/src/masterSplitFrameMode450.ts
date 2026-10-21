import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Dedicated app450 module: this file is the ONLY product-code import in
// the isolated Firebase Functions release package. Do not import index.ts:
// that would enumerate unrelated deployed Stage416/420 and other callables.
// The normal Functions index still initializes firebase-admin; the isolated
// one-function bundle initializes it in its own release entrypoint.
const SPLIT_FRAME_ALLOWED_450 = ["pure-pane", "local-responsive", "pure-pane-hybrid"] as const;
const SPLIT_FRAME_ORIGINS_450: Record<string, "preview" | "test" | "production"> = {
  "https://preview.soridraw.com": "preview",
  "https://test.soridraw.com": "test",
  "https://soridraw.com": "production",
  "https://www.soridraw.com": "production",
};

export const masterSetSplitFrameMode = onCall(
  { region: "us-central1" },
  async (request) => {
    const requesterUid = request.auth?.uid;
    if (!requesterUid) {
      throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");
    }
    // Equivalent to the existing requireMasterCaller path: only an explicit
    // staffRole=master canonical profile qualifies. Exactly ONE read happens
    // only on Master Apply; no page-entry/data-cache reads are introduced.
    const requesterSnap = await admin.firestore().collection("users").doc(requesterUid).get();
    if (requesterSnap.data()?.staffRole !== "master") {
      throw new HttpsError("permission-denied", "마스터 권한이 필요합니다.");
    }

    const origin = String(request.rawRequest.headers.origin || "").replace(/\/$/, "");
    const environment = SPLIT_FRAME_ORIGINS_450[origin];
    if (!environment || request.data?.environment !== environment) {
      throw new HttpsError("permission-denied", "현재 앱 환경과 적용 대상이 일치하지 않습니다.");
    }
    // Shared Functions are used by old TEST/PRODUCTION clients. Until those
    // releases are separately approved, only PREVIEW mode can be changed.
    const enabled = String(process.env.SORIDRAW_SPLIT_FRAME_ENABLED_ENVIRONMENTS || "preview")
      .split(",").map((value) => value.trim());
    // An inherited environment variable cannot silently enable unapproved
    // TEST or PRODUCTION writes during the PREVIEW-only app450 release.
    if (environment !== "preview" || !enabled.includes(environment)) {
      throw new HttpsError("failed-precondition", "이 환경은 아직 분할바 프레임 전체 적용이 승인되지 않았습니다.");
    }
    const mode: unknown = request.data?.mode;
    if (typeof mode !== "string" || !SPLIT_FRAME_ALLOWED_450.includes(mode as typeof SPLIT_FRAME_ALLOWED_450[number])) {
      throw new HttpsError("invalid-argument", "분할바 프레임 선택이 올바르지 않습니다.");
    }

    // Fail closed when two Masters started from the same old applied mode.
    // The transaction retries against the server's CURRENT scalar, not the
    // UI's stale radio selection. Missing scalar means the frozen Hybrid
    // default; client sends its last confirmed mode as expectedMode.
    const expectedMode: unknown = request.data?.expectedMode;
    if (typeof expectedMode !== "string" ||
        !SPLIT_FRAME_ALLOWED_450.includes(expectedMode as typeof SPLIT_FRAME_ALLOWED_450[number])) {
      throw new HttpsError("invalid-argument", "현재 적용값을 다시 확인한 후 적용해주세요.");
    }
    const outcome = await admin.database().ref("publicSync/splitFrameModes/" + environment)
      .transaction((stored) => {
        const current = stored == null ? "pure-pane-hybrid" : stored;
        if (current !== expectedMode) return;
        return mode;
      }, undefined, false);
    if (!outcome.committed) {
      throw new HttpsError("aborted", "다른 마스터가 설정을 변경했습니다. 최신 설정을 확인한 후 다시 선택해주세요.");
    }
    return { ok: true, environment, mode, updatedAt: Date.now() };
  },
);
