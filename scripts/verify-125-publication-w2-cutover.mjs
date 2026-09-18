import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const migrationPath = root + 'migrations/20260918_01_music_note_w2_cutover.sql';
const migration = readFileSync(migrationPath, 'utf8');
const manifest = JSON.parse(readFileSync(root + 'release-patches.json', 'utf8'));

assert.doesNotMatch(migration, /\b(?:DELETE\s+FROM|UPDATE)\s+tracks\b/i,
  '125 migration must not rewrite/delete canonical track rows');
assert.doesNotMatch(migration, /INSERT\s+INTO\s+tracks\b/i,
  '125 migration must not backfill canonical track rows');
assert.match(migration, /ADD COLUMN publication_storage_version INTEGER NOT NULL DEFAULT 0/i,
  '125 migration must keep old rows/workers on legacy storage version 0');
assert.match(migration, /source_type <> 'music_note' OR publication_storage_version <> 1/i,
  '125 indexes must exclude only opt-in W2 Music Note rows');
assert.match(migration, /NEW\.source_type <> 'music_note' OR NEW\.publication_storage_version <> 1/i,
  '125 insert/revision triggers must exclude only opt-in W2 Music Note rows');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(root + 'scripts/fixtures/canonical-schema.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260910_01_explore_derived_state.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260913_03_music_note_write_compaction.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260913_04_music_note_visibility_hotpath.sql', 'utf8'));
db.exec(`
CREATE TABLE IF NOT EXISTS explore_shared_revision(
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO explore_shared_revision(scope,revision,updated_at) VALUES('global',1,0);
CREATE TRIGGER soridraw_shared_rev_tracks_ai_051 AFTER INSERT ON tracks BEGIN
  UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
END;
CREATE TRIGGER soridraw_shared_rev_tracks_au_051 AFTER UPDATE ON tracks BEGIN
  UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
END;
CREATE TRIGGER soridraw_shared_rev_tracks_ad_051 AFTER DELETE ON tracks BEGIN
  UPDATE explore_shared_revision SET revision=revision+1,updated_at=OLD.updated_at WHERE scope='global';
END;
`);

db.exec(`
INSERT INTO public_profiles(uid,nickname,handle,is_public,created_at,updated_at)
VALUES('u','Owner','owner',1,1,1);
INSERT INTO tracks(
 id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
 is_public,status,published_at,created_at,updated_at
) VALUES('old-m','u','music_note','old-source','Old','audio/old','Old',1,'published',10,10,10);
`);
assert.ok(db.prepare('SELECT 1 FROM explore_derived_tracks WHERE id=?').get('old-m'),
  'pre-cutover historical Music Note row should exist in legacy derived table');

db.exec(migration);

const storageColumn = db.prepare("SELECT name,dflt_value FROM pragma_table_info('tracks') WHERE name='publication_storage_version'").get();
assert.equal(storageColumn?.name, 'publication_storage_version');
assert.equal(String(storageColumn?.dflt_value), '0');
assert.equal(db.prepare('SELECT publication_storage_version AS v FROM tracks WHERE id=?').get('old-m').v, 0,
  'existing Music Note row must remain legacy version 0 without backfill');

const expectedIndexes = [
 'idx_tracks_latest_order',
 'idx_tracks_legacy_global',
 'idx_tracks_owner_latest',
 'idx_tracks_owner_profile_order',
 'idx_tracks_owner_source',
 'idx_tracks_owner_suno_url',
 'idx_tracks_primary_genre_latest',
 'idx_tracks_source_type_latest',
 'idx_tracks_title',
];
for (const name of expectedIndexes) {
  const row = db.prepare("SELECT sql FROM sqlite_schema WHERE type='index' AND name=?").get(name);
  assert.ok(row?.sql, 'missing recreated index ' + name);
  assert.match(row.sql, /WHERE\s+source_type\s*<>\s*'music_note'\s+OR\s+publication_storage_version\s*<>\s*1/i,
    name + ' must preserve legacy rows while excluding only W2 Music Note rows');
}

const revBeforeW2 = db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision;
db.exec(`
INSERT INTO tracks(
 id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
 publication_storage_version,
 is_public,status,published_at,created_at,updated_at
) VALUES('new-w2','u','music_note','new-source','New','audio/new','New',1,1,'published',20,20,20);
`);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_derived_tracks WHERE id=?').get('new-w2').n, 0,
  'W2 Music Note insert must not create D1 derived mirror');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeW2,
  'W2 Music Note insert must not write legacy global revision');

db.prepare('UPDATE tracks SET is_public=0,updated_at=21 WHERE id=?').run('new-w2');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeW2,
  'W2 Music Note private must not write legacy global revision');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_derived_tracks WHERE id=?').get('new-w2').n, 0);

const revBeforeOldPrivate = db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision;
db.prepare('UPDATE tracks SET is_public=0,updated_at=22 WHERE id=?').run('old-m');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeOldPrivate + 1,
  'legacy version-0 Music Note transition must retain old Worker revision compatibility');
assert.ok(db.prepare('SELECT 1 FROM explore_derived_tracks WHERE id=?').get('old-m'),
  'historical derived row must be preserved; no destructive cleanup/backfill');

const revBeforeOldWorkerInsert = db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision;
db.exec(`
INSERT INTO tracks(
 id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
 is_public,status,published_at,created_at,updated_at
) VALUES('old-worker-m','u','music_note','old-worker-source','Old worker','audio/ow','Old worker',1,'published',25,25,25);
`);
assert.equal(db.prepare('SELECT publication_storage_version AS v FROM tracks WHERE id=?').get('old-worker-m').v, 0);
assert.ok(db.prepare('SELECT 1 FROM explore_derived_tracks WHERE id=?').get('old-worker-m'),
  'old Worker Music Note insert must keep legacy derived compatibility');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeOldWorkerInsert + 1,
  'old Worker Music Note insert must keep legacy revision compatibility');

const revBeforeLegacy = db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision;
db.exec(`
INSERT INTO tracks(
 id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
 is_public,status,published_at,created_at,updated_at
) VALUES('legacy-s','u','suno_library','sun-source','Legacy','audio/s','Legacy',1,'published',30,30,30);
`);
assert.ok(db.prepare('SELECT 1 FROM explore_derived_tracks WHERE id=?').get('legacy-s'),
  'legacy/suno insert must keep D1 derived compatibility');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeLegacy + 1,
  'legacy/suno insert must keep global revision compatibility');

assert.ok(Array.isArray(manifest.patches));
assert.ok(manifest.patches.includes('066-publication-w2-shared-r2-authority.mjs'),
  '066 W2 release patch must be registered');
assert.ok(manifest.patches.indexOf('066-publication-w2-shared-r2-authority.mjs')
  > manifest.patches.indexOf('065-shared-like-count-targeted.mjs'),
  '066 must layer after the current shared R2 publication/like contracts');

if (process.env.SORIDRAW_GENERATED_WORKER) {
  const worker = readFileSync(process.env.SORIDRAW_GENERATED_WORKER, 'utf8');
  for (const required of [
    'SORIDRAW_PUBLICATION_W2_SHARED_R2_AUTHORITY_066_20260919',
    'publication_storage_version',
    'ensureW2FeedIndexes066',
    'removeW2FeedIndexes066',
    'moveW2PopularIndex066',
    'mirrorExploreSharedFeeds059',
    'primeExploreLocalProfile060',
    'mirrorExploreLocalProfile060',
    'syncExploreFeedR2Publication043Core066',
    'syncExploreFeedR2Private043Core066',
    'patchExploreProfileR2Publication043Core066',
    'patchExploreVisibleProfiles056Core066',
  ]) assert.ok(worker.includes(required), 'generated Worker missing ' + required);

  const publicationStart = worker.indexOf('async function handleMusicNotePublicationSingleWrite016(');
  const publication = worker.slice(publicationStart, publicationStart + 28000);
  assert.match(publication, /primary_genre,\s*publication_storage_version,\s*is_public/);
  assert.match(publication, /\?, \?, \?,\s*1,\s*1, 'published'/);
  assert.doesNotMatch(publication, /publication_storage_version\s*=\s*excluded\.publication_storage_version/,
    'existing Music Note rows must not be silently promoted to W2 storage');

  for (const name of [
    'putW2FeedIndexObject066',
    'ensureW2FeedIndexes066',
    'removeW2FeedIndexes066',
    'moveW2PopularIndex066',
  ]) {
    const start = worker.indexOf('async function ' + name + '(');
    const end = worker.indexOf('\n}', start);
    const block = start >= 0 ? worker.slice(start, end > start ? end + 2 : start + 5000) : '';
    assert.ok(block, 'missing helper ' + name);
    assert.doesNotMatch(block, /env\.DB|\.prepare\(/, name + ' must remain R2-only');
  }

  const publishStart = worker.indexOf('async function syncExploreFeedR2Publication043(');
  const publish = worker.slice(publishStart, publishStart + 2200);
  assert.match(publish, /ensureW2FeedIndexes066\(env, incomingItem\)/);
  assert.match(publish, /mirrorExploreSharedFeeds059\(env\)/);

  const privateStart = worker.indexOf('async function syncExploreFeedR2Private043(');
  const makePrivate = worker.slice(privateStart, privateStart + 2600);
  assert.match(makePrivate, /readSharedTrackCard062\(env, trackId\)/);
  assert.match(makePrivate, /removeW2FeedIndexes066\(env, previousCard\)/);
  assert.match(makePrivate, /mirrorExploreSharedFeeds059\(env\)/);

  const profileStart = worker.indexOf('async function patchExploreProfileR2Publication043(');
  const profile = worker.slice(profileStart, profileStart + 2400);
  assert.match(profile, /primeExploreLocalProfile060\(env, normalizedUid\)/);
  assert.match(profile, /mirrorExploreLocalProfile060\(env, normalizedUid\)/);
}

console.log('APP125_W2_CUTOVER_STATIC=PASS');
console.log('APP125_NEW_MUSIC_NOTE_STORAGE_VERSION=1');
console.log('APP125_NEW_MUSIC_NOTE_DERIVED_D1_WRITES=0');
console.log('APP125_NEW_MUSIC_NOTE_LEGACY_REVISION_WRITES=0');
console.log('APP125_OLD_WORKER_STORAGE_VERSION=0_COMPAT_PASS');
console.log('APP125_SHARED_R2_PUBLICATION_AUTHORITY=PASS_BY_GENERATED_CONTRACT');
console.log('APP125_SHARED_D1_EXECUTION=NOT_RUN');
