from pathlib import Path

MARKER = "SORIDRAW_BACKEND_V2_STEP2B_ADDITIVE_RULES"

rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
if MARKER not in rules:
    anchor = "      allow update: if isMaster() || validUserManagerUpdate() || (isOwner(uid) && isValidSelfUpdate());\n    }"
    if rules.count(anchor) != 1:
        raise SystemExit("Step 2-B abort: users rule anchor not unique")
    block = """      allow update: if isMaster() || validUserManagerUpdate() || (isOwner(uid) && isValidSelfUpdate());

      // SORIDRAW_BACKEND_V2_STEP2B_ADDITIVE_RULES
      // Additive V2 private-data rules only. Existing V1 rules remain unchanged.
      // Historical migration provenance is server/Admin-SDK controlled; normal
      // owner writes may preserve it but cannot create or alter it.
      function hasValidV2SongMetadata(data) {
        return data.schemaVersion == 2 &&
          data.musicNote is bool &&
          data.recentVisible is bool &&
          data.v2UpdatedAtMs is int &&
          data.v2UpdatedAtMs >= 0 &&
          (!(\"legacyRecentIndex\" in data) || data.legacyRecentIndex is int) &&
          (!(\"legacyFavoriteId\" in data) || data.legacyFavoriteId is string) &&
          (!(\"legacyFavoriteKey\" in data) || data.legacyFavoriteKey is string);
      }

      function ownerCreatesWithoutMigrationProvenance() {
        return !request.resource.data.keys().hasAny([
          'legacyRecentIndex', 'legacyFavoriteId', 'legacyFavoriteKey'
        ]);
      }

      function ownerPreservesMigrationProvenance() {
        return !request.resource.data.diff(resource.data).affectedKeys().hasAny([
          'legacyRecentIndex', 'legacyFavoriteId', 'legacyFavoriteKey'
        ]);
      }

      // Canonical private songs. Unknown legacy creative/provider payload fields
      // remain allowed so first-pass migration can preserve complete source data.
      match /songs/{songId} {
        allow read: if isOwner(uid) || isAdmin();
        allow create: if
          (isOwner(uid) && hasValidV2SongMetadata(request.resource.data) && ownerCreatesWithoutMigrationProvenance()) ||
          (isAdmin() && hasValidV2SongMetadata(request.resource.data));
        allow update: if
          (isOwner(uid) && hasValidV2SongMetadata(request.resource.data) && ownerPreservesMigrationProvenance()) ||
          (isAdmin() && hasValidV2SongMetadata(request.resource.data));
        allow delete: if isOwner(uid) || isAdmin();
      }

      // V2 private playlists. Preserve current IDs/payload/order/source links.
      match /playlists/{playlistId} {
        allow read, write: if isOwner(uid) || isAdmin();

        match /items/{itemId} {
          allow read, write: if isOwner(uid) || isAdmin();
        }
      }

      // First-pass settings destination is deliberately limited to one document.
      match /settings/{settingsId} {
        allow read, write: if settingsId == 'sections' && (isOwner(uid) || isAdmin());
      }
    }"""
    rules = rules.replace(anchor, block)
    rules_path.write_text(rules, encoding="utf-8")

schema_path = Path("src/data/v2Schema.ts")
if not schema_path.exists():
    schema_path.write_text("""/*
 * SORIDRAW Backend V2 additive schema contract.
 *
 * Step 2-B is source-only: importing this module must never perform Firebase IO.
 * Unknown legacy song/playlist/settings payload fields are intentionally preserved.
 */

export const V2_SONG_SCHEMA_VERSION = 2 as const;

export const V2_SONG_REQUIRED_METADATA_FIELDS = Object.freeze([
  'schemaVersion',
  'musicNote',
  'recentVisible',
  'v2UpdatedAtMs',
] as const);

export const V2_SONG_MIGRATION_PROVENANCE_FIELDS = Object.freeze([
  'legacyRecentIndex',
  'legacyFavoriteId',
  'legacyFavoriteKey',
] as const);

export const V2_PRIVATE_SCHEMA_PATHS = Object.freeze({
  song: 'users/{uid}/songs/{songId}',
  playlist: 'users/{uid}/playlists/{playlistId}',
  playlistItem: 'users/{uid}/playlists/{playlistId}/items/{itemId}',
  sections: 'users/{uid}/settings/sections',
} as const);

export type V2SongMetadata = {
  schemaVersion: typeof V2_SONG_SCHEMA_VERSION;
  musicNote: boolean;
  recentVisible: boolean;
  v2UpdatedAtMs: number;
  legacyRecentIndex?: number;
  legacyFavoriteId?: string;
  legacyFavoriteKey?: string;
};
""", encoding="utf-8")

report_path = Path("docs/SORIDRAW_BACKEND_V2_STEP2B_SCHEMA_RULES.md")
if not report_path.exists():
    report_path.write_text("""# SORIDRAW Backend V2 · Step 2-B Additive Schema / Rules

Status: COMPLETE IN SOURCE / NOT DEPLOYED TO FIREBASE
Date: 2026-08-25 KST
Working branch: `preview`

## Scope
Step 2-B adds only the approved V2 private path/schema and Firestore Rules definitions. V1 remains authoritative and all V1 Rules remain in source.

## V2 private paths
- `users/{uid}/songs/{songId}`
- `users/{uid}/playlists/{playlistId}`
- `users/{uid}/playlists/{playlistId}/items/{itemId}`
- `users/{uid}/settings/sections`

## Song metadata contract
Required on V2 song documents:
- `schemaVersion: 2`
- `musicNote: boolean`
- `recentVisible: boolean`
- `v2UpdatedAtMs: integer >= 0`

Optional migration provenance:
- `legacyRecentIndex: integer`
- `legacyFavoriteId: string`
- `legacyFavoriteKey: string`

Unknown legacy creative/provider fields are intentionally not whitelisted away. First-pass migration must preserve complete source payloads.

## Rules decisions
- Owner/admin read access mirrors the V1 private-data compatibility model.
- Normal owner creates cannot forge historical migration provenance.
- Normal owner updates must preserve existing migration provenance unchanged.
- Admin SDK historical migration remains able to write provenance because server Admin SDK bypasses client Rules.
- Playlist/item payloads remain opaque/preserved in the first pass.
- Settings are limited to the exact `sections` document in this step.
- V1 Rules are not removed or weakened.

## Index decision
`firestore.indexes.json` is intentionally unchanged. Step 2-B adds no V2 runtime query. Composite indexes will be added only after an exact V2 query is audited, per Step 1-D.

## Safety result
- V2 runtime reads: 0
- V2 runtime writes: 0
- Firestore data migration: 0
- Firestore Rules deployment: 0
- Firestore index deployment: 0
- Functions deployment: 0
- Firebase Hosting deployment: 0
- V1 Rules removed: 0
- main branch modification: 0

## Next gate
Step 2-C may add the IndexedDB/local-first scaffold while V1 remains authoritative. Production Rules must not be deployed without separate explicit approval.
""", encoding="utf-8")

master_path = Path("docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md")
master = master_path.read_text(encoding="utf-8")
master = master.replace(
    "Status: IMPLEMENTATION / Step 2-A3-R Preview latest-track blocker deferred — safe next step 2-B awaiting approval",
    "Status: IMPLEMENTATION / Step 2-B complete in source — awaiting approval for 2-C"
)
if "### 2-B complete — additive V2 schema/rules source" not in master:
    anchor = "## 9. Work stages and progress tracker"
    section = """### 2-B complete — additive V2 schema/rules source
- Added canonical V2 private path/schema constants in `src/data/v2Schema.ts`; no Firebase imports or runtime IO.
- Added owner/admin Rules for `users/{uid}/songs`, V2 playlists/items and the exact `settings/sections` destination.
- V2 song Rules require the finalized additive metadata shape while preserving unknown legacy creative/provider payload fields.
- Normal owner writes cannot create/change historical migration provenance fields; Admin SDK migration remains server-controlled.
- Existing V1 Rules remain unchanged and authoritative runtime paths remain V1-only.
- `firestore.indexes.json` remains unchanged because no V2 runtime query has yet been activated/audited.
- Rules are validated only against the local Firestore emulator/demo project in CI; no production Rules/index deploy occurs in Step 2-B.
- Preview latest-track display blocker remains deferred and does not authorize any production/App Check change.

"""
    if master.count(anchor) != 1:
        raise SystemExit("Step 2-B abort: master tracker anchor not unique")
    master = master.replace(anchor, section + anchor)
master = master.replace(
    "- [ ] 2-B Additive V2 schema/rules/index definitions in source; do not remove V1 and do not deploy production Rules without explicit approval.",
    "- [x] 2-B Additive V2 schema/rules/index definitions in source; V1 retained, no production Rules/index deploy."
)
master_path.write_text(master, encoding="utf-8")

print("Applied SORIDRAW Backend V2 Step 2-B additive schema/rules source patch.")
