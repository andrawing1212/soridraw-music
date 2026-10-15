import { onRequest } from "firebase-functions/v2/https";
import { getDatabase } from "firebase-admin/database";
import { readLikeBatchTimingAt416 } from "./exploreLikeBatchSettings416";
import { STAGE416_ENVIRONMENTS } from "./exploreLikeEnvironment416";

// SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015
// One tiny public configuration read per NEW shared window, never per user/page.
// The value is non-sensitive and only controls when public like counts materialize.
export const publicLikeWindowConfig448Candidate = onRequest(
  { region: "asia-northeast3", timeoutSeconds: 15, minInstances: 0 },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ ok: false });
      return;
    }
    try {
      const timing = await readLikeBatchTimingAt416(
        getDatabase(), STAGE416_ENVIRONMENTS.preview.timingPath);
      res.set("Cache-Control", "public, max-age=30");
      res.status(200).json({
        ok: true,
        data: { publicMinutes: timing.publicMinutes, version: timing.version },
      });
    } catch {
      res.status(503).json({
        ok: false,
        error: { code: "448_PUBLIC_CONFIG_UNAVAILABLE" },
      });
    }
  },
);
