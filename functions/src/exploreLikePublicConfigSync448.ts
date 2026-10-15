import { createHmac } from "node:crypto";
import type { Stage416EnvironmentConfig } from "./exploreLikeEnvironment416";

const ALLOWED_448 = new Set([1, 3, 5, 10, 20]);
const CONFIG_ROUTE_448 = "/v1/internal/common-public-like-config-448";

const configEndpoint448 = (config: Stage416EnvironmentConfig) => {
  const url = new URL(config.workerEndpoint);
  url.pathname = CONFIG_ROUTE_448;
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const syncCommonPublicLikeConfig448 = async (
  config: Stage416EnvironmentConfig,
  publicMinutes: number,
  version: number,
  secret: string,
  nowMs = Date.now(),
  http: typeof fetch = fetch,
) => {
  if (!ALLOWED_448.has(publicMinutes) || !Number.isSafeInteger(version) || version < 0 ||
      typeof secret !== "string" || secret.length < 32 ||
      !Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error("448_CONFIG_SYNC_INPUT_INVALID");
  }
  const raw = JSON.stringify({ publicMinutes, version, signedAtMs: nowMs });
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  const response = await http(configEndpoint448(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Soridraw-448-Signature": signature,
    },
    body: raw,
  });
  const payload = await response.json().catch(() => null) as
    | { ok?: boolean; data?: { publicMinutes?: number; version?: number } }
    | null;
  if (!response.ok || payload?.ok !== true ||
      Number(payload.data?.publicMinutes) !== publicMinutes ||
      Number(payload.data?.version) !== version) {
    throw new Error("448_CONFIG_SYNC_REJECTED");
  }
  return payload.data;
};
