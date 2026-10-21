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
export const SPLIT_FRAME_REMOTE_EVENT = 'soridraw:split-frame-remote-config-v1';
export const SPLIT_FRAME_REMOTE_PARAMS = {
  preview: 'soridraw_split_frame_preview_v1',
  test: 'soridraw_split_frame_test_v1',
  production: 'soridraw_split_frame_production_v1',
} as const;
export type SplitFrameRemoteState = { mode: 'pure-pane' | 'local-responsive' | 'pure-pane-hybrid'; revision: number; ready: boolean };
let splitFrameRemoteState: SplitFrameRemoteState = { mode: 'pure-pane-hybrid', revision: 0, ready: false };
export const readSplitFrameRemoteState = (): SplitFrameRemoteState => ({ ...splitFrameRemoteState });
const splitFrameEnvironment = () => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (host === 'preview.soridraw.com') return 'preview';
  if (host === 'test.soridraw.com') return 'test';
  if (host === 'soridraw.com' || host === 'www.soridraw.com') return 'production';
  return null;
};
const publishSplitFrameRemote = (raw: string, ready: boolean) => {
  let mode: SplitFrameRemoteState['mode'] = 'pure-pane-hybrid';
  let revision = 0;
  try {
    const parsed = JSON.parse(raw || '{}');
    if (parsed && (parsed.mode === 'pure-pane' || parsed.mode === 'local-responsive' || parsed.mode === 'pure-pane-hybrid') &&
      Number.isSafeInteger(parsed.revision) && parsed.revision >= 0) {
      mode = parsed.mode;
      revision = parsed.revision;
    }
  } catch { /* Unconfigured parameter keeps the safe app448 Hybrid fallback. */ }
  splitFrameRemoteState = { mode, revision, ready };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SPLIT_FRAME_REMOTE_EVENT, { detail: { ...splitFrameRemoteState } }));
  }
};
const notifySplitFrameRemote = (remoteConfig: ReturnType<typeof getRemoteConfig>, ready: boolean) => {
  const env = splitFrameEnvironment();
  if (!env) return;
  publishSplitFrameRemote(getString(remoteConfig, SPLIT_FRAME_REMOTE_PARAMS[env]), ready);
};


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
  'test.soridraw.com',
  'soridraw-test.web.app',
  'soridraw-test.firebaseapp.com',
  'soridraw.com',
  'www.soridraw.com',
  'soridraw.web.app',
  'soridraw.firebaseapp.com',
  'soridraw-app-866a5.web.app',
  'soridraw-app-866a5.firebaseapp.com',
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
  splitFrameRemoteState = { ...splitFrameRemoteState, ready: false };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SPLIT_FRAME_REMOTE_EVENT, { detail: { ...splitFrameRemoteState } }));
  }
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
      [SPLIT_FRAME_REMOTE_PARAMS.preview]: '{"mode":"pure-pane-hybrid","revision":0}',
      [SPLIT_FRAME_REMOTE_PARAMS.test]: '{"mode":"pure-pane-hybrid","revision":0}',
      [SPLIT_FRAME_REMOTE_PARAMS.production]: '{"mode":"pure-pane-hybrid","revision":0}',
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

    // The app already owns a Remote Config realtime connection for version signals.
    // Reuse it for one operational setting; no new RTDB rules or second socket.
    notifySplitFrameRemote(remoteConfig, true);
    unsubscribe = onConfigUpdate(remoteConfig, {
      next: (configUpdate) => {
        void (async () => {
          const updatedKeys = Array.from(configUpdate.getUpdatedKeys());
          const env = splitFrameEnvironment();
          const frameChanged = !!env && updatedKeys.includes(SPLIT_FRAME_REMOTE_PARAMS[env]);
          const versionChanged = updatedKeys.includes(PREVIEW_VERSION_SIGNAL_PARAM);
          if (!frameChanged && !versionChanged) {
            publishDiagnostics({ updatedKeys });
            return;
          }
          await activate(remoteConfig);
          if (frameChanged) notifySplitFrameRemote(remoteConfig, true);
          if (versionChanged) {
            const nextVersions = parseVersions(getString(remoteConfig, PREVIEW_VERSION_SIGNAL_PARAM));
            const lastEventAt = Date.now();
            persistVersions(nextVersions);
            publishDiagnostics({
              status: 'connected', versions: nextVersions, updatedKeys,
              realtimeEvents: diagnostics.realtimeEvents + 1, lastEventAt, error: '',
            });
            window.dispatchEvent(new CustomEvent(VERSION_SIGNAL_DATA_EVENT, {
              detail: { versions: nextVersions, updatedKeys, at: lastEventAt },
            }));
          }
        })().catch((error) => {
          publishDiagnostics({ status: 'error', error: String((error as any)?.message || error || 'activate failed') });
        });
      },
      error: (error) => {
        splitFrameRemoteState = { ...splitFrameRemoteState, ready: false };
        window.dispatchEvent(new CustomEvent(SPLIT_FRAME_REMOTE_EVENT, { detail: { ...splitFrameRemoteState } }));
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
