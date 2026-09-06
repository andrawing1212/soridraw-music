from pathlib import Path

# SORIDRAW 1040: PREVIEW common catalog runtime route hardening.

p = Path('src/lib/userDataEngine.ts')
s = p.read_text(encoding='utf-8')
old = """const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const retryDelays = [0, 250, 800, 1600];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      const [idToken, appCheckToken] = await Promise.all([
        user.getIdToken(attempt >= 2),
        getFirebaseAppCheckToken(),
      ]);
      if (idToken && appCheckToken) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken,
        };
      }
    } catch (error) {
      if (attempt === retryDelays.length - 1) {
        console.warn('[userDataEngine] catalog auth headers unavailable after retry.', error);
      }
    }
  }
  return null;
};"""
new = """const authenticatedHeaders = async (
  requireAppCheck = true,
): Promise<Record<string, string> | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const retryDelays = requireAppCheck ? [0, 250, 800, 1600] : [0, 250, 800];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      const idToken = await user.getIdToken(attempt >= 2);
      if (!idToken) throw new Error('CATALOG_ID_TOKEN_MISSING');
      const appCheckToken = await getFirebaseAppCheckToken();
      if (requireAppCheck && !appCheckToken) throw new Error('CATALOG_APP_CHECK_NOT_READY');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      };
      if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
      return headers;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn('[userDataEngine] catalog auth headers unavailable after retry.', lastError);
  return null;
};"""
if old not in s:
    raise SystemExit('authenticatedHeaders block not found')
s = s.replace(old, new, 1)
old = """      const headers = await authenticatedHeaders();
      if (!headers) throw new Error('CATALOG_AUTH_NOT_READY');
      const knownRemoteRevision = Math.max(readKnownRemoteCatalogRevision(kind, uid), Math.floor(minimumRevision || 0));"""
new = """      // Catalog GET is owner-authorized by Firebase Auth. App Check is attached
      // when available, but a transient attestation failure cannot downgrade PREVIEW
      // into the old partial-list path.
      const headers = await authenticatedHeaders(false);
      if (!headers) throw new Error('CATALOG_AUTH_NOT_READY');
      const knownRemoteRevision = Math.max(readKnownRemoteCatalogRevision(kind, uid), Math.floor(minimumRevision || 0));"""
if old not in s:
    raise SystemExit('readRemote catalog header block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('src/lib/listBundleCache.ts')
s = p.read_text(encoding='utf-8')
old_import = "import { readPreviewAdaptiveListIndexV2 } from './adaptiveListIndexV2';"
new_import = "import { isPreviewAdaptiveListIndexEnabled, readPreviewAdaptiveListIndexV2 } from './adaptiveListIndexV2';"
if old_import not in s:
    raise SystemExit('adaptive import block not found')
s = s.replace(old_import, new_import, 1)
old = """  const runOneShotRead = () => {
    if (cancelled || started) return;
    started = true;
    void readPreviewAdaptiveListIndexV2(kind, uid)
      .then((adaptiveBundle) => {
        if (cancelled) return;
        if (adaptiveBundle) {
          callbacks.onData(adaptiveBundle, { fromCache: false });
          return;
        }
        runLegacyOneShotRead();
      })
      .catch(() => runLegacyOneShotRead());
  };"""
new = """  const readPreviewCatalogWithStartupRetry = async (): Promise<ListBundleSnapshot | null> => {
    const retryDelays = [0, 300, 800, 1600, 3200, 5000];
    for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
      if (cancelled) return null;
      if (retryDelays[attempt] > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
      try {
        const adaptiveBundle = await readPreviewAdaptiveListIndexV2(kind, uid);
        if (adaptiveBundle) return adaptiveBundle;
      } catch {}
    }
    return null;
  };

  const runOneShotRead = () => {
    if (cancelled || started) return;
    started = true;
    void (async () => {
      const adaptiveBundle = await readPreviewCatalogWithStartupRetry();
      if (cancelled) return;
      if (adaptiveBundle) {
        callbacks.onData(adaptiveBundle, { fromCache: false });
        return;
      }
      if (isPreviewAdaptiveListIndexEnabled()) {
        console.warn(`[listBundleCache] ${kind} V4 catalog unavailable after startup retry; legacy partial fallback blocked.`);
        return;
      }
      runLegacyOneShotRead();
    })().catch((error) => {
      if (cancelled) return;
      if (isPreviewAdaptiveListIndexEnabled()) {
        console.warn(`[listBundleCache] ${kind} V4 catalog startup failed; legacy partial fallback blocked.`, error);
        return;
      }
      runLegacyOneShotRead();
    });
  };"""
if old not in s:
    raise SystemExit('runOneShotRead block not found')
s = s.replace(old, new, 1)
old = """  const adaptiveBundle = await readPreviewAdaptiveListIndexV2(kind, uid);
  if (adaptiveBundle) return adaptiveBundle;
  const snapshot = await getDocFromServer(getBundleRef(kind, uid));"""
new = """  const adaptiveBundle = await readPreviewAdaptiveListIndexV2(kind, uid);
  if (adaptiveBundle) return adaptiveBundle;
  if (isPreviewAdaptiveListIndexEnabled()) return null;
  const snapshot = await getDocFromServer(getBundleRef(kind, uid));"""
if old not in s:
    raise SystemExit('readListBundleFromServerOnce block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('cloudflare/media-worker/src/index.js')
s = p.read_text(encoding='utf-8')
anchor = """const requireClientIdentity = async (request, env) => {
  const idToken = extractBearer(request);
  const appCheckToken = text(request.headers.get('X-Firebase-AppCheck'));
  const [auth] = await Promise.all([
    verifyFirebaseIdToken(idToken, env),
    verifyAppCheckToken(appCheckToken, env),
  ]);
  return { uid: auth.uid, idToken, appCheckToken };
};
"""
addition = anchor + """
const requireCatalogReadIdentity = async (request, env) => {
  const idToken = extractBearer(request);
  const auth = await verifyFirebaseIdToken(idToken, env);
  const suppliedAppCheckToken = text(request.headers.get('X-Firebase-AppCheck'));
  let appCheckToken = '';
  if (suppliedAppCheckToken) {
    try {
      await verifyAppCheckToken(suppliedAppCheckToken, env);
      appCheckToken = suppliedAppCheckToken;
    } catch {
      // Existing private R2 catalogs remain readable by their authenticated owner.
      // An invalid App Check token is never forwarded to canonical Firestore rebuilds.
      appCheckToken = '';
    }
  }
  return { uid: auth.uid, idToken, appCheckToken };
};
"""
if anchor not in s:
    raise SystemExit('requireClientIdentity block not found')
s = s.replace(anchor, addition, 1)
handle_pos = s.find('const handleCatalog = async')
if handle_pos < 0:
    raise SystemExit('handleCatalog missing')
old = """  let identity;
  try {
    identity = await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }
"""
new = """  let identity;
  try {
    const isCatalogRead = request.method === 'GET' && route.action === 'base';
    identity = isCatalogRead
      ? await requireCatalogReadIdentity(request, env)
      : await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }
"""
before, after = s[:handle_pos], s[handle_pos:]
if old not in after:
    raise SystemExit('handleCatalog identity block not found')
after = after.replace(old, new, 1)
p.write_text(before + after, encoding='utf-8')

print('SORIDRAW_1040_RUNTIME_ROUTE_FIX=APPLIED')
