import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(root + 'scripts/fixtures/canonical-schema.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260910_01_explore_derived_state.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260913_03_music_note_write_compaction.sql', 'utf8'));
db.exec(readFileSync(root + 'migrations/20260913_04_music_note_visibility_hotpath.sql', 'utf8'));
const totalChanges = () => Number(db.prepare('SELECT total_changes() AS n').get().n || 0);

// Older TEST/PRODUCTION Workers share canonical D1 and still rely on the global
// revision signal. 080 deliberately keeps that one compatibility write.
db.exec(`CREATE TABLE IF NOT EXISTS explore_shared_revision(scope TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL DEFAULT 0);
INSERT INTO explore_shared_revision(scope,revision,updated_at) VALUES('global',1,0);
CREATE TRIGGER verify080_shared_revision AFTER UPDATE ON tracks BEGIN
  UPDATE explore_shared_revision SET revision=revision+1,updated_at=NEW.updated_at WHERE scope='global';
END;`);

db.exec(`INSERT INTO public_profiles(uid,nickname,handle,is_public,created_at,updated_at)
VALUES('u','Owner','owner',1,1,1);`);
db.exec(`INSERT INTO tracks(
  id,owner_uid,source_type,source_id,title,suno_url_primary,search_text,
  is_public,status,published_at,created_at,updated_at,
  allow_next_song_apply,allow_follower_save,profile_pinned
) VALUES('m1','u','music_note','source-1','Title','audio/m1','Title',1,'published',100,100,100,0,0,0);`);

const derivedBefore = db.prepare('SELECT * FROM explore_derived_tracks WHERE id=?').get('m1');
assert.ok(derivedBefore, 'first publication still seeds one derived recovery snapshot');
const publishedAt = db.prepare('SELECT published_at FROM tracks WHERE id=?').get('m1').published_at;

let before = totalChanges();
db.prepare('UPDATE tracks SET is_public=0,updated_at=? WHERE id=?').run(200, 'm1');
assert.equal(totalChanges() - before, 2, 'private hot transition = canonical row + protected shared revision only');
assert.deepEqual(db.prepare('SELECT * FROM explore_derived_tracks WHERE id=?').get('m1'), derivedBefore,
  'private hot transition does not rewrite heavy derived track/indexes');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tracks WHERE owner_uid=? AND is_public=1 AND status=?').get('u','published').n, 0);

before = totalChanges();
db.prepare(`UPDATE tracks SET is_public=1,allow_next_song_apply=1,allow_follower_save=1,profile_pinned=1,updated_at=? WHERE id=?`).run(300, 'm1');
assert.equal(totalChanges() - before, 2, 'republish/options hot transition = canonical row + protected shared revision only');
assert.equal(db.prepare('SELECT published_at FROM tracks WHERE id=?').get('m1').published_at, publishedAt,
  'republish preserves original indexed published_at');
assert.deepEqual(db.prepare('SELECT * FROM explore_derived_tracks WHERE id=?').get('m1'), derivedBefore,
  'republish/options hot transition still avoids heavy derived rewrite');

before = totalChanges();
db.prepare('UPDATE tracks SET title=?,updated_at=? WHERE id=?').run('Changed title', 400, 'm1');
assert.ok(totalChanges() - before > 2, 'real canonical content edit still refreshes derived recovery snapshot');
const derivedAfterContent = db.prepare('SELECT row_json FROM explore_derived_tracks WHERE id=?').get('m1').row_json;
assert.equal(JSON.parse(derivedAfterContent).title, 'Changed title');

const migration = readFileSync(root + 'migrations/20260913_04_music_note_visibility_hotpath.sql', 'utf8');
assert.match(migration, /AFTER UPDATE OF[\s\S]*title[\s\S]*ON tracks/);
const triggerColumnBlock = migration.match(/AFTER UPDATE OF([\s\S]*?)ON tracks/)?.[1] || '';
for (const hotColumn of ['is_public','updated_at','allow_next_song_apply','allow_follower_save','profile_pinned']) {
  assert.doesNotMatch(triggerColumnBlock, new RegExp(`\\b${hotColumn}\\b`), `${hotColumn} must stay out of heavy derived update trigger`);
}

const runtime = readFileSync(root + 'runtime/derived-cache.js', 'utf8');
for (const required of ['JOIN tracks AS c', "c.is_public=1", "c.status='published'", 'canonical_track_count']) {
  assert.ok(runtime.includes(required), `cold recovery missing canonical guard: ${required}`);
}

const client = readFileSync('src/services/explorePublicationService.ts', 'utf8');
for (const required of ['registered: boolean', 'registered: false', 'registered: true']) {
  assert.ok(client.includes(required), `client registered-state contract missing: ${required}`);
}
const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
assert.match(favorites, /state\.registered[\s\S]{0,700}setExploreTrackVisibility\(user,\s*state\.trackId,\s*true,\s*options\)/,
  'registered private Music Note must republish through visibility state transition');

if (process.env.SORIDRAW_GENERATED_WORKER) {
  const worker = readFileSync(process.env.SORIDRAW_GENERATED_WORKER, 'utf8');
  for (const required of [
    'SORIDRAW_PUBLICATION_STATE_TRANSITION_047_20260913',
    "source_type='music_note'",
    'syncExploreFeedR2Publication043',
    'syncExploreFeedR2Private043',
    'JOIN tracks AS c',
    'canonical_track_count',
  ]) assert.ok(worker.includes(required), `generated Worker 047 missing: ${required}`);
  const visibility = worker.match(/async function handleVisibilityR2Core\([^]*?\n\}/)?.[0] || '';
  assert.ok(visibility.includes('LEFT JOIN track_stats'), 'visibility route needs bounded one-track canonical read');
}

console.log('PASS 080: registered republish uses one visibility route; normal private/republish logical D1 writes are 2 including protected shared revision; indexed publish time stays stable; cold repair validates canonical visibility.');
