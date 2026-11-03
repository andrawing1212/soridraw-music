// Pure Firestore snapshot-to-color-event projection. ZERO IO.
export type CanonicalColorKind = 'musicNote' | 'library';
export type CanonicalColorEvent = {
  schemaVersion: 1;
  eventId: string;
  kind: CanonicalColorKind;
  uid: string;
  documentId: string;
  sourceUpdateTime: string;
  canonical: Record<string, unknown>;
};

const owns = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const palette = new Set(['red','orange','yellow','green','blue','purple']);
const isColor = (value: unknown) => palette.has(String(value));
const activeNote = (row: Record<string, unknown>) => {
  if (row.favoriteRemoved === true || row.saved === false
    || row.hidden === true || row.favoriteHidden === true
    || row.deletedAt || row.trashedAt) return false;
  if (row.saved === true || row.favoriteRemoved === false) return true;
  return !Boolean(row.favoriteRemovedAt || row.unlikedAt || row.unsavedAt);
};
const activeLibrary = (row: Record<string, unknown>) =>
  row.hidden !== true && !row.deletedAt && !row.trashedAt && row.status !== 'deleted';

const selectedColor = (kind: CanonicalColorKind, data: Record<string, unknown> | null) => {
  if (!data) return null;
  if (kind === 'musicNote') {
    const key = owns(data,'favoriteColorTag') ? 'favoriteColorTag' :
      owns(data,'colorTag') ? 'colorTag' : '';
    return key ? { [key]: data[key] } : {};
  }
  const color: Record<string, unknown> = {};
  for (const name of ['colorTags','favoriteColorTags']) {
    if (owns(data,name)) color[name] = data[name];
  }
  return color;
};
const docActive = (kind: CanonicalColorKind, value: Record<string, unknown> | null) =>
  Boolean(value && (kind === 'musicNote' ? activeNote(value) : activeLibrary(value)));

export const colorEventNeeded = (
  kind: CanonicalColorKind, before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => {
  if (!docActive(kind, after)) return false;
  if (kind === 'musicNote') {
    const now = selectedColor(kind, after);
    if (!now || !Object.keys(now).length) return false;
  } else if (!after || (!owns(after,'colorTags') && !owns(after,'favoriteColorTags'))) return false;
  return !docActive(kind,before)
    || JSON.stringify(selectedColor(kind,before)) !== JSON.stringify(selectedColor(kind,after));
};

export const firestoreTimestampNano = (timestamp: {seconds:number; nanoseconds:number} | null | undefined) => {
  if (!timestamp || !Number.isSafeInteger(timestamp.seconds)
    || !Number.isSafeInteger(timestamp.nanoseconds)
    || timestamp.nanoseconds < 0 || timestamp.nanoseconds >= 1_000_000_000) return '';
  const head = new Date(timestamp.seconds * 1000).toISOString().slice(0,19);
  return head + '.' + String(timestamp.nanoseconds).padStart(9,'0') + 'Z';
};

export const buildCanonicalColorDelivery = ({
  kind, uid, documentId, eventId, data, sourceUpdateTime,
}: {
  kind:CanonicalColorKind; uid:string; documentId:string; eventId:string;
  data: Record<string,unknown>; sourceUpdateTime:string;
}): CanonicalColorEvent | null => {
  if (!uid || uid.length > 128 || !documentId || documentId.length > 240
    || /[\\/]/.test(documentId)
    || !/^[A-Za-z0-9_-]{8,180}$/.test(eventId)
    || !docActive(kind,data)
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{9}Z$/.test(sourceUpdateTime)
    || (kind === 'musicNote' && data.uid !== uid)) return null;
  const source = selectedColor(kind,data);
  if (!source || !Object.keys(source).length) return null;
  const canonical: Record<string,unknown> = { ...source };
  if (kind === 'musicNote') {
    canonical.uid = uid;
    for (const key of ['saved','favoriteRemoved','favoriteRemovedAt','unlikedAt',
      'unsavedAt','hidden','favoriteHidden','deletedAt','trashedAt']) {
      if (owns(data,key)) canonical[key] = data[key];
    }
  } else for (const key of ['hidden','status','deletedAt','trashedAt']) {
    if (owns(data,key)) canonical[key] = data[key];
  }
  // Reject nonpalette colors, invalid maps and huge payloads without emitting
  // data to a third-party Worker.
  const check = (value:unknown): boolean => value === null || value === 'gray' || isColor(value);
  if (kind === 'musicNote') {
    if (!Object.values(source).every(check)) return null;
  } else for (const value of Object.values(source)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value);
    if (entries.length > 1000 || entries.some(([i,v]) =>
      !/^(0|[1-9]\d{0,3})$/.test(i) || !check(v))) return null;
  }
  return { schemaVersion:1, eventId, kind, uid, documentId, sourceUpdateTime, canonical };
};
