from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'cloudflare' / 'explore-worker' / 'migrations'
FIXTURES = ROOT / 'cloudflare' / 'explore-worker' / 'scripts' / 'fixtures'
PATCH_042 = ROOT / 'cloudflare' / 'explore-worker' / 'patches' / '042-social-snapshot-write-compaction.mjs'
DERIVED_RUNTIME = ROOT / 'cloudflare' / 'explore-worker' / 'runtime' / 'derived-cache.js'
TRIGGER_CANDIDATE_076 = ROOT / 'cloudflare' / 'explore-worker' / 'candidates' / '076-derived-trigger-compaction.sql'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def queue_upsert(conn: sqlite3.Connection, uid: str, updated_at: int, patch: dict[str, dict[str, int]]) -> tuple[int, int]:
    processed_condition = """(
      explore_like_user_queue_075.updated_at < (
        SELECT processed_at FROM explore_like_user_queue_state_075 WHERE id = 1
      )
      OR (
        explore_like_user_queue_075.updated_at = (
          SELECT processed_at FROM explore_like_user_queue_state_075 WHERE id = 1
        )
        AND explore_like_user_queue_075.user_uid <= (
          SELECT processed_uid FROM explore_like_user_queue_state_075 WHERE id = 1
        )
      )
    )"""
    payload = json.dumps(patch, separators=(',', ':'))
    pending_count = len(patch)
    sql = f"""
      INSERT INTO explore_like_user_queue_075(
        user_uid, updated_at, pending_count, mutations_json
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_uid) DO UPDATE SET
        mutations_json = CASE
          WHEN {processed_condition} THEN excluded.mutations_json
          ELSE json_patch(explore_like_user_queue_075.mutations_json, excluded.mutations_json)
        END,
        pending_count = CASE
          WHEN {processed_condition} THEN excluded.pending_count
          ELSE (
            SELECT COUNT(*)
            FROM json_each(json_patch(explore_like_user_queue_075.mutations_json, excluded.mutations_json))
          )
        END,
        updated_at = CASE
          WHEN excluded.updated_at > explore_like_user_queue_075.updated_at THEN excluded.updated_at
          ELSE explore_like_user_queue_075.updated_at + 1
        END
      RETURNING updated_at, pending_count
    """
    row = conn.execute(sql, (uid, updated_at, pending_count, payload)).fetchone()
    require(row is not None, '075 queue upsert returned no row')
    return int(row[0]), int(row[1])


def verify_user_queue() -> None:
    conn = sqlite3.connect(':memory:')
    conn.executescript((MIGRATIONS / '20260913_01_explore_like_user_queue.sql').read_text(encoding='utf-8'))

    t1, count1 = queue_upsert(conn, 'u1', 1000, {
        'track-a': {'liked': 1, 'mutationAt': 1000},
        'track-b': {'liked': 1, 'mutationAt': 1000},
    })
    require(count1 == 2, f'first pending_count={count1}')
    require(conn.execute('SELECT COUNT(*) FROM explore_like_user_queue_075').fetchone()[0] == 1, 'first batch must create one user row')

    t2, count2 = queue_upsert(conn, 'u1', 1100, {
        'track-a': {'liked': 0, 'mutationAt': 1100},
    })
    require(t2 > t1 and count2 == 2, f'same-user patch did not stay compact: t={t2} count={count2}')
    payload = json.loads(conn.execute("SELECT mutations_json FROM explore_like_user_queue_075 WHERE user_uid='u1'").fetchone()[0])
    require(payload['track-a']['liked'] == 0, 'like→unlike final state lost')
    require(payload['track-b']['liked'] == 1, 'unrelated track state lost')
    require(conn.execute('SELECT COUNT(*) FROM explore_like_user_queue_075').fetchone()[0] == 1, 'same user created more than one queue row')

    _, count3 = queue_upsert(conn, 'u1', 1200, {
        'track-a': {'liked': 1, 'mutationAt': 1200},
    })
    require(count3 == 2, f'reversal pending_count={count3}')
    payload = json.loads(conn.execute("SELECT mutations_json FROM explore_like_user_queue_075 WHERE user_uid='u1'").fetchone()[0])
    require(payload['track-a']['liked'] == 1, 'like→unlike→like final ON lost')

    row = conn.execute("SELECT updated_at FROM explore_like_user_queue_075 WHERE user_uid='u1'").fetchone()
    processed_at = int(row[0])
    conn.execute("UPDATE explore_like_user_queue_state_075 SET processed_at=?, processed_uid='u1' WHERE id=1", (processed_at,))
    queue_upsert(conn, 'u1', processed_at + 100, {
        'track-c': {'liked': 1, 'mutationAt': processed_at + 100},
    })
    payload = json.loads(conn.execute("SELECT mutations_json FROM explore_like_user_queue_075 WHERE user_uid='u1'").fetchone()[0])
    require(set(payload) == {'track-c'}, f'processed user row was not replaced: {sorted(payload)}')
    require(conn.execute('SELECT COUNT(*) FROM explore_like_user_queue_075').fetchone()[0] == 1, 'processed user reuse must remain one row')
    print('075_USER_QUEUE_COMPACTION=PASS rows_per_user=1 reversal=PASS processed_row_reuse=PASS')


def seed_derived_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript((FIXTURES / 'canonical-schema.sql').read_text(encoding='utf-8'))
    conn.executescript((MIGRATIONS / '20260910_01_explore_derived_state.sql').read_text(encoding='utf-8'))
    now = 1_700_000_000_000
    conn.execute(
        """INSERT INTO public_profiles(
          uid,nickname,avatar_url,bio,is_public,created_at,updated_at,handle,background_url,
          genre_override,spotify_url,instagram_url,tiktok_url,profile_customized
        ) VALUES('owner','Owner','','',1,?,?,?,?,?,?,?,?,0)""",
        (now, now, 'owner', '', '[]', '', '', ''),
    )
    conn.execute("INSERT INTO profile_stats(uid,follower_count,following_count,updated_at) VALUES('owner',0,0,?)", (now,))
    conn.execute(
        """INSERT INTO tracks(
          id,owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
          source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,
          duration_seconds,lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,
          is_public,status,published_at,created_at,updated_at,allow_next_song_apply,
          allow_follower_save,profile_pinned,share_schema_version,share_payload_json,primary_genre
        ) VALUES(
          'track-1','owner','music_note','note-1',NULL,NULL,'',NULL,NULL,'Track 1','','',
          NULL,'','','','https://suno.com/s/test',NULL,'Track 1',1,'published',?,?,?,0,0,0,0,NULL,NULL
        )""",
        (now, now, now),
    )
    conn.execute("INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at) VALUES('track-1',0,0,0,?)", (now,))
    return conn


def seed_derived_db_076() -> sqlite3.Connection:
    conn = seed_derived_db()
    conn.executescript(TRIGGER_CANDIDATE_076.read_text(encoding='utf-8'))
    return conn


def measured_changes(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    before = conn.total_changes
    conn.execute(sql, params)
    return conn.total_changes - before


def change_seq(conn: sqlite3.Connection, scope: str, kind: str, item_id: str) -> int:
    row = conn.execute(
        'SELECT seq FROM explore_derived_changes WHERE scope=? AND kind=? AND id=?',
        (scope, kind, item_id),
    ).fetchone()
    return int(row[0]) if row else 0


def assert_no_same_scope_seq_collision(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """SELECT scope, seq, COUNT(*)
           FROM explore_derived_changes
           GROUP BY scope, seq
           HAVING COUNT(*) > 1"""
    ).fetchall()
    require(not rows, f'076 cursor collision inside one scope: {rows}')


def verify_current_trigger_amplification() -> None:
    conn = seed_derived_db()
    now = 1_700_000_001_000
    like_rows = measured_changes(conn, "UPDATE track_stats SET like_count=1, updated_at=? WHERE track_id='track-1'", (now,))
    private_rows = measured_changes(conn, "UPDATE tracks SET is_public=0, updated_at=? WHERE id='track-1'", (now + 1,))
    profile_rows = measured_changes(conn, "UPDATE public_profiles SET bio='hello', updated_at=? WHERE uid='owner'", (now + 2,))

    require(like_rows == 8, f'current like baseline drifted: {like_rows}')
    require(private_rows == 12, f'current visibility baseline drifted: {private_rows}')
    require(profile_rows == 6, f'current profile baseline drifted: {profile_rows}')
    print(f'CURRENT_DERIVED_TRIGGER_ROWS like_count_update={like_rows} visibility_update={private_rows} profile_update={profile_rows}')
    print('CURRENT_DERIVED_TRIGGER_AMPLIFICATION=CONFIRMED')


def verify_076_cursor_contract_assumptions() -> None:
    runtime = DERIVED_RUNTIME.read_text(encoding='utf-8')
    require(
        'WHERE scope=? AND seq>? AND seq<=? ORDER BY seq LIMIT 64' in runtime,
        'derived consumer is no longer per-scope LIMIT 64; re-audit 076 seq sharing',
    )
    require(
        'profile = bootstrap || owners.has(uid) || touched.size ? await derivedProfile032(env,uid)' in runtime,
        'profile track event no longer reloads profile projection; track_count suppression is unsafe',
    )
    candidate = TRIGGER_CANDIDATE_076.read_text(encoding='utf-8')
    require('DROP TABLE' not in candidate.upper(), '076 must not drop tables')
    require('ALTER TABLE' not in candidate.upper(), '076 must not alter tables')
    require('track_count-only updates do not need a second' in candidate, '076 track_count rationale missing')
    print('076_CURSOR_COMPATIBILITY_STATIC=PASS per_scope_cursor=true track_event_reloads_profile=true')


def verify_076_compacted_cost_and_semantics() -> None:
    now = 1_700_000_101_000

    like = seed_derived_db_076()
    like_rows = measured_changes(like, "UPDATE track_stats SET like_count=1, updated_at=? WHERE track_id='track-1'", (now,))
    derived_like = like.execute("SELECT likes FROM explore_derived_tracks WHERE id='track-1'").fetchone()
    feed_like_seq = change_seq(like, 'feed', 'track', 'track-1')
    profile_like_seq = change_seq(like, 'profile:owner', 'track', 'track-1')
    require(like_rows == 5, f'076 like writes expected 5, got {like_rows}')
    require(derived_like and int(derived_like[0]) == 1, '076 like projection did not converge to 1')
    require(feed_like_seq > 0 and feed_like_seq == profile_like_seq, '076 like sibling scopes did not share one safe seq')
    assert_no_same_scope_seq_collision(like)

    visibility = seed_derived_db_076()
    before_track_count = visibility.execute("SELECT track_count FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    require(before_track_count and int(before_track_count[0]) == 1, f'076 seed track_count expected 1, got {before_track_count}')
    visibility_rows = measured_changes(
        visibility,
        "UPDATE tracks SET is_public=0, updated_at=? WHERE id='track-1'",
        (now + 1,),
    )
    derived_visibility = visibility.execute("SELECT active FROM explore_derived_tracks WHERE id='track-1'").fetchone()
    after_track_count = visibility.execute("SELECT track_count FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    feed_visibility_seq = change_seq(visibility, 'feed', 'track', 'track-1')
    profile_visibility_seq = change_seq(visibility, 'profile:owner', 'track', 'track-1')
    require(visibility_rows == 6, f'076 visibility writes expected 6, got {visibility_rows}')
    require(derived_visibility and int(derived_visibility[0]) == 0, '076 private track remained active')
    require(after_track_count and int(after_track_count[0]) == 0, '076 profile track_count did not decrement')
    require(feed_visibility_seq > 0 and feed_visibility_seq == profile_visibility_seq, '076 visibility sibling scopes did not share one safe seq')
    assert_no_same_scope_seq_collision(visibility)

    bio = seed_derived_db_076()
    feed_profile_before = change_seq(bio, 'feed', 'profile', 'owner')
    profile_profile_before = change_seq(bio, 'profile:owner', 'profile', 'owner')
    bio_rows = measured_changes(
        bio,
        "UPDATE public_profiles SET bio='hello', updated_at=? WHERE uid='owner'",
        (now + 2,),
    )
    bio_json = bio.execute("SELECT row_json FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    feed_profile_after = change_seq(bio, 'feed', 'profile', 'owner')
    profile_profile_after = change_seq(bio, 'profile:owner', 'profile', 'owner')
    require(bio_rows == 4, f'076 bio writes expected 4, got {bio_rows}')
    require(bio_json and json.loads(bio_json[0]).get('bio') == 'hello', '076 bio projection did not update')
    require(profile_profile_after > profile_profile_before, '076 public-profile scope did not receive bio change')
    require(feed_profile_after == feed_profile_before, '076 bio change unnecessarily woke Feed')
    assert_no_same_scope_seq_collision(bio)

    avatar = seed_derived_db_076()
    avatar_feed_before = change_seq(avatar, 'feed', 'profile', 'owner')
    avatar_profile_before = change_seq(avatar, 'profile:owner', 'profile', 'owner')
    avatar_rows = measured_changes(
        avatar,
        "UPDATE public_profiles SET avatar_url='https://img.example/avatar.png', updated_at=? WHERE uid='owner'",
        (now + 3,),
    )
    avatar_feed_after = change_seq(avatar, 'feed', 'profile', 'owner')
    avatar_profile_after = change_seq(avatar, 'profile:owner', 'profile', 'owner')
    require(avatar_rows == 6, f'076 avatar writes expected compatibility cost 6, got {avatar_rows}')
    require(avatar_feed_after > avatar_feed_before, '076 avatar change did not wake Feed')
    require(avatar_profile_after > avatar_profile_before, '076 avatar change did not wake public profile')
    assert_no_same_scope_seq_collision(avatar)

    print(
        '076_COMPACTED_DERIVED_ROWS=PASS '
        f'like_count_update={like_rows} visibility_update={visibility_rows} '
        f'profile_bio_update={bio_rows} profile_avatar_update={avatar_rows}'
    )
    print('076_SEMANTIC_COMPATIBILITY=PASS feed_track=true profile_track=true track_count=true profile_scope=true')


def verify_worker_static_boundaries() -> None:
    patch = PATCH_042.read_text(encoding='utf-8')
    idle = patch.index("if (!legacyBoundary && !userQueuePending)")
    acquire = patch.index('acquireExploreLikeProcessor035(env, owner, now)')
    require(idle < acquire, 'idle return must occur before lease write')
    require('idleWriteZero: true' in patch, 'idle W0 marker missing')
    require('enqueueExploreLikeUserQueue075' in patch, '075 per-user queue is not wired')
    require('DELETE FROM explore_like_user_queue_075' not in patch, '075 queue must not delete a row per batch')
    require('/v1/me/social-snapshot' in patch, 'combined social snapshot route missing')
    require('snapshotItem: feedItem' in patch, 'publication snapshot response missing')
    print('075_WORKER_COST_BOUNDARY=PASS idle_W0=true queue_delete_per_batch=0 social_snapshot=combined')


def main() -> None:
    verify_user_queue()
    verify_worker_static_boundaries()
    verify_current_trigger_amplification()
    verify_076_cursor_contract_assumptions()
    verify_076_compacted_cost_and_semantics()
    print('VERIFY_075_076_SOCIAL_SNAPSHOT_COST=PASS')


if __name__ == '__main__':
    main()
