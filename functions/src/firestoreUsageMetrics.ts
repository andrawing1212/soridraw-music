import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as https from "https";
import { URLSearchParams } from "url";

const OWNER_EMAIL = "andrawing1212@gmail.com";
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const MONITORING_TIMEOUT_MS = 10_000;
const MAX_MONITORING_PAGES = 5;
const SERVER_METRIC_LAG_HINT_MS = 4 * 60 * 1000;

const adminAccessCache = new Map<string, number>();

type MonitoringPoint = {
  interval?: {
    startTime?: string;
    endTime?: string;
  };
  value?: {
    int64Value?: string | number;
    doubleValue?: number;
  };
};

type MonitoringSeries = {
  points?: MonitoringPoint[];
};

type MonitoringResponse = {
  timeSeries?: MonitoringSeries[];
  nextPageToken?: string;
};

type MetricAggregate = {
  today: number;
  recent: number;
  sampledThroughMs: number;
  pointCount: number;
  metricType: string;
};

const getStaffRole = (data: Record<string, unknown> | null | undefined): "master" | "admin" | null => {
  if (data?.staffRole === "master") return "master";
  if (data?.staffRole === "admin") return "admin";
  if (data?.role === "admin" && !data?.staffRole) return "admin";
  return null;
};

const requireUsageAdmin = async (request: any): Promise<string> => {
  const uid = String(request.auth?.uid || "").trim();
  if (!uid) throw new HttpsError("unauthenticated", "관리자 로그인이 필요합니다.");

  const email = String(request.auth?.token?.email || "").trim().toLowerCase();
  const emailVerified = request.auth?.token?.email_verified === true;
  if (email === OWNER_EMAIL && emailVerified) return uid;

  const cachedUntil = adminAccessCache.get(uid) || 0;
  if (cachedUntil > Date.now()) return uid;

  const snapshot = await admin.firestore().collection("users").doc(uid).get();
  if (!getStaffRole(snapshot.data() as Record<string, unknown> | undefined)) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }

  adminAccessCache.set(uid, Date.now() + ADMIN_CACHE_TTL_MS);
  return uid;
};

const requestJson = (url: string, accessToken: string): Promise<MonitoringResponse> => new Promise((resolve, reject) => {
  const request = https.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  }, (response) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy(new Error("Monitoring response too large"));
    });
    response.on("end", () => {
      const statusCode = Number(response.statusCode || 0);
      if (statusCode < 200 || statusCode >= 300) {
        const error: any = new Error(`Cloud Monitoring API ${statusCode}: ${body.slice(0, 800)}`);
        error.statusCode = statusCode;
        reject(error);
        return;
      }
      try {
        resolve(body ? JSON.parse(body) as MonitoringResponse : {});
      } catch (error) {
        reject(error);
      }
    });
  });

  request.setTimeout(MONITORING_TIMEOUT_MS, () => {
    request.destroy(new Error("Cloud Monitoring API timeout"));
  });
  request.on("error", reject);
});

const getPointValue = (point: MonitoringPoint): number => {
  const raw = point.value?.int64Value ?? point.value?.doubleValue ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const queryMetric = async (
  projectId: string,
  metricType: string,
  dayStartMs: number,
  recentStartMs: number,
  endMs: number,
  accessToken: string,
): Promise<MetricAggregate> => {
  let pageToken = "";
  let pageCount = 0;
  let today = 0;
  let recent = 0;
  let sampledThroughMs = 0;
  let pointCount = 0;

  do {
    const params = new URLSearchParams({
      filter: `metric.type = "${metricType}"`,
      "interval.startTime": new Date(dayStartMs).toISOString(),
      "interval.endTime": new Date(endMs).toISOString(),
      view: "FULL",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries?${params.toString()}`;
    const payload = await requestJson(url, accessToken);
    const timeSeries = Array.isArray(payload.timeSeries) ? payload.timeSeries : [];

    timeSeries.forEach((series) => {
      const points = Array.isArray(series.points) ? series.points : [];
      points.forEach((point) => {
        const value = getPointValue(point);
        const endTimeMs = Date.parse(String(point.interval?.endTime || ""));
        pointCount += 1;
        today += value;
        if (Number.isFinite(endTimeMs)) {
          sampledThroughMs = Math.max(sampledThroughMs, endTimeMs);
          if (endTimeMs >= recentStartMs) recent += value;
        }
      });
    });

    pageToken = String(payload.nextPageToken || "");
    pageCount += 1;
  } while (pageToken && pageCount < MAX_MONITORING_PAGES);

  return {
    today: Math.round(today),
    recent: Math.round(recent),
    sampledThroughMs,
    pointCount,
    metricType,
  };
};

const queryMetricFamily = async (
  projectId: string,
  metricTypes: string[],
  dayStartMs: number,
  recentStartMs: number,
  endMs: number,
  accessToken: string,
): Promise<MetricAggregate> => {
  let emptyResult: MetricAggregate | null = null;

  for (const metricType of metricTypes) {
    try {
      const result = await queryMetric(projectId, metricType, dayStartMs, recentStartMs, endMs, accessToken);
      if (result.pointCount > 0) return result;
      if (!emptyResult) emptyResult = result;
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 400 || statusCode === 404) continue;
      throw error;
    }
  }

  return emptyResult || {
    today: 0,
    recent: 0,
    sampledThroughMs: 0,
    pointCount: 0,
    metricType: metricTypes[0] || "",
  };
};

export const getFirestoreServerUsage = onCall(
  { region: "us-central1", timeoutSeconds: 20, memory: "256MiB" },
  async (request) => {
    await requireUsageAdmin(request);

    const now = Date.now();
    const requestedWindowMinutes = Number(request.data?.windowMinutes || 10);
    const windowMinutes = Math.min(30, Math.max(5, Number.isFinite(requestedWindowMinutes) ? Math.floor(requestedWindowMinutes) : 10));
    const requestedDayStartMs = Number(request.data?.dayStartMs || 0);
    const earliestAllowed = now - (26 * 60 * 60 * 1000);
    const dayStartMs = Number.isFinite(requestedDayStartMs) && requestedDayStartMs > 0
      ? Math.min(now, Math.max(earliestAllowed, requestedDayStartMs))
      : now - (24 * 60 * 60 * 1000);
    const recentStartMs = Math.max(dayStartMs, now - (windowMinutes * 60 * 1000));
    const projectId = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId || "soridraw-app-866a5");

    try {
      const access = await admin.credential.applicationDefault().getAccessToken();
      const accessToken = String(access.access_token || "");
      if (!accessToken) throw new Error("Google Cloud access token unavailable");

      const [reads, writes, deletes, billableReads, billableRealtimeReads, billableWrites] = await Promise.all([
        queryMetricFamily(projectId, [
          "firestore.googleapis.com/document/read_ops_count",
          "firestore.googleapis.com/document/read_count",
        ], dayStartMs, recentStartMs, now, accessToken),
        queryMetricFamily(projectId, [
          "firestore.googleapis.com/document/write_ops_count",
          "firestore.googleapis.com/document/write_count",
        ], dayStartMs, recentStartMs, now, accessToken),
        queryMetricFamily(projectId, [
          "firestore.googleapis.com/document/delete_ops_count",
          "firestore.googleapis.com/document/delete_count",
        ], dayStartMs, recentStartMs, now, accessToken),
        queryMetricFamily(projectId, ["firestore.googleapis.com/api/billable_read_units"], dayStartMs, recentStartMs, now, accessToken),
        queryMetricFamily(projectId, ["firestore.googleapis.com/api/billable_realtime_read_units"], dayStartMs, recentStartMs, now, accessToken),
        queryMetricFamily(projectId, ["firestore.googleapis.com/api/billable_write_units"], dayStartMs, recentStartMs, now, accessToken),
      ]);

      const sampledThroughMs = Math.max(
        reads.sampledThroughMs,
        writes.sampledThroughMs,
        deletes.sampledThroughMs,
        billableReads.sampledThroughMs,
        billableRealtimeReads.sampledThroughMs,
        billableWrites.sampledThroughMs,
      );

      return {
        ok: true,
        source: "cloud-monitoring",
        projectId,
        fetchedAt: now,
        sampledThroughMs,
        lagHintMs: SERVER_METRIC_LAG_HINT_MS,
        dayStartMs,
        windowMinutes,
        documentOps: {
          today: { reads: reads.today, writes: writes.today, deletes: deletes.today },
          recent: { reads: reads.recent, writes: writes.recent, deletes: deletes.recent },
        },
        billableUnits: {
          today: {
            reads: billableReads.today,
            realtimeReads: billableRealtimeReads.today,
            writes: billableWrites.today,
          },
          recent: {
            reads: billableReads.recent,
            realtimeReads: billableRealtimeReads.recent,
            writes: billableWrites.recent,
          },
        },
        metricTypes: {
          reads: reads.metricType,
          writes: writes.metricType,
          deletes: deletes.metricType,
          billableReads: billableReads.metricType,
          billableRealtimeReads: billableRealtimeReads.metricType,
          billableWrites: billableWrites.metricType,
        },
      };
    } catch (error: any) {
      console.error("Firestore Cloud Monitoring query failed:", error);
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 401 || statusCode === 403) {
        throw new HttpsError(
          "permission-denied",
          "Cloud Monitoring 조회 권한이 없습니다. Functions 실행 서비스 계정에 monitoring.timeSeries.list 권한이 필요합니다.",
        );
      }
      throw new HttpsError("unavailable", "Cloud Monitoring Firestore 사용량을 불러오지 못했습니다.");
    }
  },
);
