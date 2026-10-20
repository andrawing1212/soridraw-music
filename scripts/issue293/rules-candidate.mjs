// LOCAL EMULATOR EXPERIMENT ONLY. Not referenced by firebase.json.
// This single-document design is NOT a rollout candidate until the physical
// delete/recreate compatibility gate passes. Do not deploy its output.
import assert from 'node:assert/strict';

export const urlFields293 = [
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex', 'sunoLinkCount',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoShareUrlUpdatedAt',
  'sunoTitle', 'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoCoverFetchedAt',
];
export const colorFields293 = [
  'favoriteColorTag', 'colorTag', 'color', 'favoriteColor', 'noteColor',
];

export function buildRulesCandidate293(baseline, { allowProtectedDelete = false } = {}) {
  const start = baseline.indexOf('    // Favorites collection');
  const end = baseline.indexOf('    // User recent songs', start);
  assert(start >= 0 && end > start, 'favorites Rules boundary changed');
  const list = (keys) => JSON.stringify(keys);
  const candidate = `    // #293 single-document experiment; EMULATOR ONLY.
    match /favorites/{favoriteId} {
      function revision(key) {
        return resource.data.get(key, 0);
      }
      function validGroup(key, fields) {
        let before = revision(key);
        let after = request.resource.data.get(key, 0);
        let changed = request.resource.data.diff(resource.data).affectedKeys();
        return before is int && after is int && before >= 0 && after >= 0 &&
          ((before == 0 && after == 0) ||
           (after == before && !changed.hasAny(fields.concat([key]))) ||
           (after == before + 1 && changed.hasAny(fields)));
      }
      function validInitialRevision(key) {
        let value = request.resource.data.get(key, 0);
        return value is int && value >= 0 && value <= 1;
      }
      allow read, list: if isAuthenticated() &&
        (resource.data.uid == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid &&
        validInitialRevision('urlRevision293') && validInitialRevision('colorRevision293');
      allow update: if isAuthenticated() &&
        (resource.data.uid == request.auth.uid || isAdmin()) &&
        request.resource.data.uid == resource.data.uid &&
        validGroup('urlRevision293', ${list(urlFields293)}) &&
        validGroup('colorRevision293', ${list(colorFields293)});
      allow delete: if isAuthenticated() &&
        (resource.data.uid == request.auth.uid || isAdmin()) &&
        ${allowProtectedDelete ? 'true' : "(revision('urlRevision293') == 0 && revision('colorRevision293') == 0)"};
    }

`;
  return baseline.slice(0, start) + candidate + baseline.slice(end);
}
