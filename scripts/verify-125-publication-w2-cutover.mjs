import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const migrationPath = root + 'migrations/20260918_01_music_note_w2_cutover.sql';
const migration = readFileSync(migrationPath, 'utf8');

assert.doesNotMatch(migration, /\b(?:DELETE\s+FROM|UPDATE)\s+tracks\b/i,
  '125 migration must not rewrite/delete canonical track rows');
assert.doesNotMatch(migration, /INSERT\s+INTO\s+tracks\b/i,
  '125 migration must not backfill canonical track rows');
assert.match(migration, /WHERE source_type <> 'music_note'/,
  '125 indexes must exclude Music Note rows');
assert.match(migration, /WHEN NEW\.source_type <> 'music_note'/,
  '125 insert triggers must exclude Music Note rows');

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
  assert.match(row.sql, /WHERE\s+source_type\s*<>\s*'music_note'/i,
    name + ' must remain legacy/suno-only');
}

const revBeforeMusic = db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision;
db.exec(`
INSERT INTO tracks(
 id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
 is_public,status,published_at,created_at,updated_at
) VALUES('new-m','u','music_note','new-source','New','audio/new','New',1,'published',20,20,20);
`);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_derived_tracks WHERE id=?').get('new-m').n, 0,
  'post-cutover Music Note insert must not create D1 derived mirror');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeMusic,
  'post-cutover Music Note insert must not write legacy global revision');

db.prepare('UPDATE tracks SET is_public=0,updated_at=21 WHERE id=?').run('new-m');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeMusic,
  'Music Note private must not write legacy global revision');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_derived_tracks WHERE id=?').get('new-m').n, 0);

db.prepare('UPDATE tracks SET is_public=0,updated_at=22 WHERE id=?').run('old-m');
const oldDerived = db.prepare('SELECT active FROM explore_derived_tracks WHERE id=?').get('old-m');
assert.ok(oldDerived, 'historical derived row is preserved; no destructive backfill');
assert.equal(db.prepare("SELECT revision FROM explore_shared_revision WHERE scope='global'").get().revision, revBeforeMusic,
  'historical Music Note transition also stops legacy revision writes');

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

if (process.env.SORIDRAW_GENERATED_WORKER) {
  const worker = readFileSync(process.env.SORIDRAW_GENERATED_WORKER, 'utf8');
  for (const required of [
    'SORIDRAW_PUBLICATION_W2_SHARED_R2_AUTHORITY_066_20260918',
    'readSharedFeedAuthority066',
    'mirrorExploreSharedFeeds059',
    'mirrorExploreLocalProfile060',
  ]) assert.ok(worker.includes(required), 'generated Worker missing ' + required);
}

console.log('APP125_W2_CUTOVER_STATIC=PASS');
console.log('APP125_MUSIC_NOTE_DERIVED_D1_WRITES=0');
console.log('APP125_MUSIC_NOTE_LEGACY_REVISION_WRITES=0');
console.log('APP125_LEGACY_DERIVED_COMPAT=PASS');
console.log('APP125_SHARED_D1_EXECUTION=NOT_RUN');
