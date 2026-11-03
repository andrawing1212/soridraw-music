// TEMPORARY compatibility bridge for already-installed old PCs/phones.
// Firebase invokes these triggers on ALL matching writes (even when OFF).
// Therefore neither trigger may be deployed merely because source CI passes.
// Short TTL + separate feature flag provide a safety bound, not free execution.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { colorEventNeeded, type CanonicalColorKind } from './colorCatalogEventPure';
import { stageLegacyCanonicalColorChange } from './colorCatalogOutbox';

export const legacyColorBridgeWindowOpen = (
  now = Date.now(), flag = process.env.SORIDRAW_COLOR_CATALOG_LEGACY_BRIDGE_V1,
  end = process.env.SORIDRAW_COLOR_CATALOG_LEGACY_BRIDGE_UNTIL,
) => {
  if (flag !== '1' || !end || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(end)) return false;
  const until = Date.parse(end);
  return Number.isFinite(until) && until > now
    && until - now <= 45 * 24 * 60 * 60_000;
};

const captureLegacy = async (
  kind:CanonicalColorKind, uid:string, id:string,
  before:Record<string,unknown>|null,
  after:Record<string,unknown>|null,
) => {
  // Always test the zero-IO condition before opening a transaction.
  if (!legacyColorBridgeWindowOpen() || !colorEventNeeded(kind,before,after)) return;
  if (!uid || !id || (kind === 'musicNote' && after?.uid !== uid)
    || (kind === 'library' && after?.uid && after.uid !== uid)) return;
  await stageLegacyCanonicalColorChange(kind,uid,id);
};

export const captureLegacyMusicNoteColor = onDocumentWritten({
  document:'favorites/{documentId}',region:'asia-northeast3',
  retry:true,maxInstances:3,
}, async event => {
  const before = event.data?.before?.data() as Record<string,unknown>|undefined;
  const after = event.data?.after?.data() as Record<string,unknown>|undefined;
  const uid = String(after?.uid || '').trim();
  await captureLegacy('musicNote',uid,String(event.params.documentId||'').trim(),
    before||null,after||null);
});

export const captureLegacyLibraryColor = onDocumentWritten({
  document:'suno_tracks/{uid}/tracks/{documentId}',region:'asia-northeast3',
  retry:true,maxInstances:3,
}, async event => {
  const before = event.data?.before?.data() as Record<string,unknown>|undefined;
  const after = event.data?.after?.data() as Record<string,unknown>|undefined;
  await captureLegacy('library',String(event.params.uid||'').trim(),
    String(event.params.documentId||'').trim(),before||null,after||null);
});
