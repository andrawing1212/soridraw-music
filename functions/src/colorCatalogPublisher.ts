// Future opt-in Firestore->shared Catalog server delivery.
// This is NOT deployed or enabled in source. Trigger has no writes itself:
// only genuine color/membership transitions issue an HTTP request (R1 exact
// canonical document per event). Retries are at-least-once, not unbounded or
// a cross-service transaction. Existing local/RTDB immediate paint is intact.
import { createHmac } from 'node:crypto';
import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import {
  colorEventNeeded, firestoreTimestampNano, buildCanonicalColorDelivery,
  type CanonicalColorKind,
} from './colorCatalogEventPure';

const signingKey = defineSecret('SORIDRAW_COLOR_CATALOG_HMAC_SECRET');
const targetHosts = new Set([
  'soridraw-media-preview.andrawing1212.workers.dev',
  'soridraw-media-test.andrawing1212.workers.dev',
  'soridraw-media.andrawing1212.workers.dev',
]);
const sendChangedColor = async (
  kind:CanonicalColorKind, uid:string, documentId:string, eventId:string,
  before:Record<string,unknown>|null, after:Record<string,unknown>|null,
) => {
  if (process.env.SORIDRAW_COLOR_CATALOG_EVENTS_V1 !== '1'
    || !colorEventNeeded(kind,before,after)) return;
  const target = String(process.env.SORIDRAW_COLOR_CATALOG_WORKER_URL || '');
  const secret = signingKey.value();
  let url:URL;
  try { url = new URL(target); }
  catch { throw Error('COLOR_CATALOG_WORKER_URL_MISSING'); }
  if (url.protocol !== 'https:' || !targetHosts.has(url.hostname)
    || (url.port && url.port !== '443') || url.username || url.password
    || secret.length < 32) throw Error('COLOR_CATALOG_DELIVERY_CONFIGURATION_INVALID');

  const ref = kind === 'musicNote'
    ? admin.firestore().collection('favorites').doc(documentId)
    : admin.firestore().collection('suno_tracks').doc(uid).collection('tracks').doc(documentId);
  // R1 for a REAL color change only. Re-read canonical on each event retry:
  // delayed event snapshots cannot override a user's newer gray/reset click.
  const latest = await ref.get();
  if (!latest.exists) return; // never resurrect a deleted document
  const source = latest.data() as Record<string,unknown> | undefined;
  if (!source) return;
  const event = buildCanonicalColorDelivery({
    kind, uid, documentId,
    eventId: eventId.replace(/[^A-Za-z0-9_-]/g,'').slice(0,180),
    data: source,
    sourceUpdateTime: firestoreTimestampNano(latest.updateTime),
  });
  if (!event) return; // inactive, invalid, or explicit color absence
  const raw = JSON.stringify(event);
  if (raw.length > 32 * 1024) throw Error('COLOR_CATALOG_DELIVERY_TOO_LARGE');
  const issued = String(Date.now());
  const signature = createHmac('sha256',secret).update(issued+'.'+raw).digest('base64url');
  const response = await fetch(url.toString().replace(/\/$/,'')+'/v1/internal/catalog-color-event', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'X-Soridraw-Color-Time':issued,
      'X-Soridraw-Color-Signature':signature,
    },
    body:raw, signal:AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw Error('COLOR_CATALOG_DELIVERY_HTTP_'+response.status);
};

export const syncMusicNoteCanonicalColors = onDocumentWritten({
  document:'favorites/{documentId}', region:'asia-northeast3',
  retry:true, secrets:[signingKey], maxInstances:5,
}, async (event) => {
  const before = event.data?.before?.data() as Record<string,unknown>|undefined;
  const after = event.data?.after?.data() as Record<string,unknown>|undefined;
  const uid = String(after?.uid || before?.uid || '').trim();
  const documentId = String(event.params.documentId || '').trim();
  if (!uid || !documentId || (after?.uid && after.uid !== uid)) return;
  await sendChangedColor('musicNote',uid,documentId,event.id,before || null,after || null);
});

export const syncLibraryCanonicalColors = onDocumentWritten({
  document:'suno_tracks/{uid}/tracks/{documentId}', region:'asia-northeast3',
  retry:true, secrets:[signingKey], maxInstances:5,
}, async (event) => {
  const before = event.data?.before?.data() as Record<string,unknown>|undefined;
  const after = event.data?.after?.data() as Record<string,unknown>|undefined;
  const uid = String(event.params.uid || '').trim();
  const documentId = String(event.params.documentId || '').trim();
  if (!uid || !documentId || (after?.uid && after.uid !== uid)) return;
  await sendChangedColor('library',uid,documentId,event.id,before || null,after || null);
});
