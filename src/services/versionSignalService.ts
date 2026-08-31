import '../firebase';
import { getApp } from 'firebase/app';
import {
  activate,
  ensureInitialized,
  fetchAndActivate,
  getRemoteConfig,
  getString,
  isSupported,
  onConfigUpdate,
  type Unsubscribe,
} from 'firebase/remote-config';

export const VERSION_SIGNAL_DIAGNOSTICS_EVENT = 'soridraw:version-signal-diagnostics';
export const VERSION_SIGNAL_DATA_EVENT = 'soridraw:version-signal';
export const PREVIEW_VERSION_SIGNAL_PARAM = 'soridraw_preview_version_signal_v1';

export type VersionSignalDiagnostics = {
  enabled: boolean;
  provider: 'remote-config';
  status: 'disabled' | 'connecting' | 'connected' | 'error';
  bootstrapFetches: number;
  realtimeEvents: number;
  versions: Record<string, number>;
  updatedKeys: string[];
  lastEventAt: number;
  error: string;
};

const PREVIEW_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
]);
const BOOTSTRAP_STORAGE_KEY = 'soridraw_stage5_rc_bootstrap_complete_v1';
const VERSION_STORAGE_KEY = 'soridraw_stage5_rc_versions_v1';

let diagnostics: VersionSignalDiagnostics = {
  enabled: false,
  provider: 'remote-config',
  status: 'disabled',
  bootstrapFetches: 0,
  realtimeEvents: 0,
  versions: {},
  updatedKeys: [],
  lastEventAt: 0,
  error: '',
};
let startPromise: Promise<void> | null = null;
let unsubscribe: Unsubscribe | null = null;

const normalizeVersions = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    const numberValue = Number(raw || 0);
    if (Number.isFinite(numberValue) && numberValue >= 0) {
      result[String(key)] = Math.floor(numberValue);
    }
  });
  return result;
};

const parseVersions = (raw: string): Record<string, number> => {
  try {
    return normalizeVersions(JSON.parse(String(raw || '{}')));
  } catch {
    return {};
  }
};

const persistVersions = (versions: Record<string, number>) => {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(versions)); } catch {}
};

const publishDiagnostics = (patch: Partial<VersionSignalDiagnostics>) => {
  diagnostics = { ...diagnostics, ...patch };
  if (typeof window !== 'undefined') {
    (window as any).__soridrawVersionSignalDiagnostics = { ...diagnostics };
    window.dispatchEvent(new CustomEvent(VERSION_SIGNAL_DIAGNOSTICS_EVENT, {
      detail: { ...diagnostics },
    }));
  }
};

export const readVersionSignalDiagnostics = (): VersionSignalDiagnostics => ({ ...diagnostics });

export const stopPreviewVersionSignal = () => {
  try { unsubscribe?.(); } catch {}
  unsubscribe = null;
  startPromise = null;
  publishDiagnostics({ status: diagnostics.enabled ? 'disabled' : diagnostics.status });
};

export const startPreviewVersionSignal = (): Promise<void> => {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    if (typeof window === 'undefined' || !PREVIEW_HOSTS.has(window.location.hostname.toLowerCase())) {
      publishDiagnostics({ enabled: false, status: 'disabled' });
      return;
    }

    publishDiagnostics({ enabled: true, status: 'connecting', error: '' });
    if (!(await isSupported())) {
      publishDiagnostics({ status: 'error', error: 'Remote Config IndexedDB unsupported' });
      return;
    }

    const remoteConfig = getRemoteConfig(getApp());
    remoteConfig.settings.fetchTimeoutMillis = 10_000;
    remoteConfig.settings.minimumFetchIntervalMillis = 12 * 60 * 60 * 1000;
    remoteConfig.defaultConfig = {
      [PREVIEW_VERSION_SIGNAL_PARAM]: JSON.stringify({ genres: 0 }),
    };

    await ensureInitialized(remoteConfig);

    let versions = parseVersions(getString(remoteConfig, PREVIEW_VERSION_SIGNAL_PARAM));
    let needsBootstrap = true;
    try { needsBootstrap = localStorage.getItem(BOOTSTRAP_STORAGE_KEY) !== 'true'; } catch {}

    if (needsBootstrap) {
      try {
        await fetchAndActivate(remoteConfig);
        versions = parseVersions(getString(remoteConfig, PREVIEW_VERSION_SIGNAL_PARAM));
        try { localStorage.setItem(BOOTSTRAP_STORAGE_KEY, 'true'); } catch {}
        publishDiagnostics({
          bootstrapFetches: diagnostics.bootstrapFetches + 1,
          versions,
        });
        persistVersions(versions);
      } catch (error) {
        console.warn('[Version Signal] one-time bootstrap fetch failed; realtime listener will retry on invalidation.', error);
      }
    } else {
      persistVersions(versions);
    }

    unsubscribe = onConfigUpdate(remoteConfig, {
      next: (configUpdate) => {
        void (async () => {
          const updatedKeys = Array.from(configUpdate.getUpdatedKeys());
          if (!updatedKeys.includes(PREVIEW_VERSION_SIGNAL_PARAM)) {
            publishDiagnostics({ updatedKeys });
            return;
          }
          await activate(remoteConfig);
          const nextVersions = parseVersions(getString(remoteConfig, PREVIEW_VERSION_SIGNAL_PARAM));
          const lastEventAt = Date.now();
          persistVersions(nextVersions);
          publishDiagnostics({
            status: 'connected',
            versions: nextVersions,
            updatedKeys,
            realtimeEvents: diagnostics.realtimeEvents + 1,
            lastEventAt,
            error: '',
          });
          window.dispatchEvent(new CustomEvent(VERSION_SIGNAL_DATA_EVENT, {
            detail: { versions: nextVersions, updatedKeys, at: lastEventAt },
          }));
        })().catch((error) => {
          publishDiagnostics({ status: 'error', error: String((error as any)?.message || error || 'activate failed') });
        });
      },
      error: (error) => {
        publishDiagnostics({ status: 'error', error: String((error as any)?.message || error || 'realtime listener failed') });
      },
      complete: () => {},
    });

    publishDiagnostics({ status: 'connected', versions, error: '' });
  })().catch((error) => {
    publishDiagnostics({ status: 'error', error: String((error as any)?.message || error || 'version signal init failed') });
  });

  return startPromise;
};
