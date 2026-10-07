import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const path='cloudflare/explore-worker/migrations/20261007_03_follow_overlay_378_control_guard.sql';
const sql=readFileSync(path,'utf8');
const cleaned=sql.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--.*$/gm,' ');

assert.match(cleaned,/INSERT INTO explore_follow_cutover_control_348/);
assert.match(cleaned,/VALUES\(1,\s*'legacy',\s*1,\s*'',\s*0\)/);
assert.match(cleaned,/CREATE TRIGGER IF NOT EXISTS explore_follow_cutover_control_348_no_downgrade/);
assert.match(cleaned,/CREATE TRIGGER IF NOT EXISTS explore_follow_cutover_control_348_no_delete/);
assert.doesNotMatch(cleaned,/\b(?:INSERT|UPDATE|DELETE|REPLACE)\s+(?:INTO\s+|FROM\s+)?(?:follows|profile_stats|public_profiles)\b/i);
assert.doesNotMatch(cleaned,/\b(?:DROP|ALTER|VACUUM|REINDEX|ATTACH|DETACH)\b/i);

const db=new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE explore_follow_cutover_control_348(
 id INTEGER PRIMARY KEY CHECK(id=1),
 phase TEXT NOT NULL CHECK(phase IN ('legacy','armed','overlay','readonly')),
 schema_version INTEGER NOT NULL,
 cutover_token TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
`);
db.exec(sql);
assert.equal(db.prepare("SELECT phase FROM explore_follow_cutover_control_348 WHERE id=1").get().phase,'legacy');
db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='armed',cutover_token='t',updated_at=1 WHERE id=1").run();
db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='overlay',updated_at=2 WHERE id=1").run();
assert.throws(()=>db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='legacy' WHERE id=1").run(),/follow authority downgrade blocked/);
assert.throws(()=>db.prepare("DELETE FROM explore_follow_cutover_control_348 WHERE id=1").run(),/follow authority latch delete blocked/);
db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='readonly',updated_at=3 WHERE id=1").run();
db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='overlay',updated_at=4 WHERE id=1").run();

console.log('FOLLOW381_CONTROL_ROW_SYSTEM_METADATA_ONLY=PASS');
console.log('FOLLOW381_ONE_WAY_TRIGGERS=PASS');
console.log('FOLLOW381_USER_RELATION_PROFILE_WRITE=0');
