// Future opt-in Firestore->shared Catalog server delivery.
// This is NOT deployed or enabled in source. Trigger has no writes itself:
// only genuine color/membership transitions issue an HTTP request (R1 exact
// canonical document per event). Retries are at-least-once, not unbounded or
// a cross-service transaction. Existing local/RTDB immediate paint is intact.
import { createHmac } from 'node:crypto';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import {
  firestoreTimestampNano, buildCanonicalColorDelivery, type CanonicalColorKind,
} from './colorCatalogEventPure';

export const colorCatalogSigningKey = defineSecret('SORIDRAW_COLOR_CATALOG_HMAC_SECRET');
const targetHosts = new Set([
  'soridraw-media-preview.andrawing1212.workers.dev',
  'soridraw-media-test.andrawing1212.workers.dev',
  'soridraw-media.andrawing1212.workers.dev',
]);
export const deliverLatestCanonicalColor = async (
  kind:CanonicalColorKind, uid:string, documentId:string, eventId:string,
):Promise<'DELIVERED'|'CANONICAL_ABSENT'> => {
  if (process.env.SORIDRAW_COLOR_CATALOG_EVENTS_V1 !== '1') throw Error('COLOR_CATALOG_DISABLED');
  const target = String(process.env.SORIDRAW_COLOR_CATALOG_WORKER_URL || '');
  const secret = colorCatalogSigningKey.value();
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
  if (!latest.exists) return 'CANONICAL_ABSENT'; // never resurrect a deleted document
  const source = latest.data() as Record<string,unknown> | undefined;
  if (!source) return 'CANONICAL_ABSENT';
  const event = buildCanonicalColorDelivery({
    kind, uid, documentId,
    eventId: eventId.replace(/[^A-Za-z0-9_-]/g,'').slice(0,180),
    data: source,
    sourceUpdateTime: firestoreTimestampNano(latest.updateTime),
  });
  if (!event) return 'CANONICAL_ABSENT'; // inactive, invalid, or absent current color
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
  const acknowledged = await response.json().catch(() => null);
  if (acknowledged?.ok !== true || !['APPLIED','DUPLICATE','STALE'].includes(acknowledged?.code)) {
    throw Error('COLOR_CATALOG_DELIVERY_UNCONFIRMED');
  }
  return 'DELIVERED';
};

