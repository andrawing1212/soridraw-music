from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CF = ROOT / 'cloudflare' / 'explore-worker'
FIXTURE = CF / 'scripts' / 'fixtures' / 'canonical-schema.sql'
DERIVED = CF / 'migrations' / '20260910_01_explore_derived_state.sql'
LIKE033 = CF / 'migrations' / '20260910_03_explore_like_write_optimization.sql'
CANDIDATE = CF / 'candidates' / '076-derived-trigger-compaction-live033.sql'

TARGETS = {
    'explore032_derived_track_insert',
    'explore032_derived_track_delete',
    'explore032_derived_profile_update',
    'explore032_derived_profile_feed',
}
PROTECTED_033 = 'explore032_derived_track_update'


def require(value: bool, message: str) -> None:
    if not value:
        raise RuntimeError(message)


def norm(value: str | None) -> str:
    return re.sub(r'\s+', ' ', str(value or '').replace('IF NOT EXISTS', '')).strip().lower().rstrip(';')


def trigger_sql(conn: sqlite3.Connection, name: str) -> str:
    row = conn.execute("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name=?", (name,)).fetchone()
    require(row is not None and row[0], f'missing trigger {name}')
    return str(row[0])


def base_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(FIXTURE.read_text(encoding='utf-8'))
    conn.executescript(DERIVED.read_text(encoding='utf-8'))
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
    conn.commit()
    # Reproduce the actual shared-D1 lineage: the 033 replacement happened after 032 seed.
    conn.executescript(LIKE033.read_text(encoding='utf-8'))
    return conn


def verify_static() -> None:
    sql = CANDIDATE.read_text(encoding='utf-8')
    clean = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    dropped = set(re.findall(r'DROP\s+TRIGGER\s+IF\s+EXISTS\s+([A-Za-z0-9_]+)', clean, flags=re.IGNORECASE))
    created = set(re.findall(r'CREATE\s+TRIGGER\s+([A-Za-z0-9_]+)', clean, flags=re.IGNORECASE))
    require(dropped == TARGETS, f'076 live033 drop drift: {sorted(dropped)}')
    require(created == TARGETS, f'076 live033 create drift: {sorted(created)}')
    require(PROTECTED_033 not in dropped and PROTECTED_033 not in created, '033 track update trigger must not be replaced')
    upper = clean.upper()
    for token in ('DROP TABLE', 'ALTER TABLE', 'CREATE TABLE', 'DROP INDEX', 'CREATE INDEX', 'DELETE FROM'):
        require(token not in upper, f'forbidden maintenance operation: {token}')
    print('076_LIVE033_STATIC=PASS targets=4 protected_033_track_update=true')


def verify_preserves_033_and_data() -> None:
    conn = base_db()
    before_033 = trigger_sql(conn, PROTECTED_033)
    before_data = {
        'derived_state': conn.execute("SELECT id,seq,seeded FROM explore_derived_state ORDER BY id").fetchall(),
        'derived_tracks': conn.execute("SELECT id,owner_uid,active,published_at,pinned,likes,row_json FROM explore_derived_tracks ORDER BY id").fetchall(),
        'derived_profiles': conn.execute("SELECT uid,active,row_json,followers,following,track_count FROM explore_derived_profiles ORDER BY uid").fetchall(),
        'changes': conn.execute("SELECT scope,kind,id,seq FROM explore_derived_changes ORDER BY scope,kind,id").fetchall(),
    }
    before_target = {name: trigger_sql(conn, name) for name in TARGETS}
    conn.executescript(CANDIDATE.read_text(encoding='utf-8'))
    require(norm(trigger_sql(conn, PROTECTED_033)) == norm(before_033), '076 changed protected 033 track-update trigger')
    after_data = {
        'derived_state': conn.execute("SELECT id,seq,seeded FROM explore_derived_state ORDER BY id").fetchall(),
        'derived_tracks': conn.execute("SELECT id,owner_uid,active,published_at,pinned,likes,row_json FROM explore_derived_tracks ORDER BY id").fetchall(),
        'derived_profiles': conn.execute("SELECT uid,active,row_json,followers,following,track_count FROM explore_derived_profiles ORDER BY uid").fetchall(),
        'changes': conn.execute("SELECT scope,kind,id,seq FROM explore_derived_changes ORDER BY scope,kind,id").fetchall(),
    }
    require(before_data == after_data, 'trigger DDL changed stored derived data')
    require(all(norm(trigger_sql(conn, name)) != norm(before_target[name]) for name in TARGETS), 'one or more 076 targets did not change')
    print('076_LIVE033_DDL_PURITY=PASS stored_data_unchanged=true protected_033_sql_unchanged=true')


def changes(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    before = conn.total_changes
    conn.execute(sql, params)
    return conn.total_changes - before


def seq(conn: sqlite3.Connection, scope: str, kind: str, item_id: str) -> int:
    row = conn.execute("SELECT seq FROM explore_derived_changes WHERE scope=? AND kind=? AND id=?", (scope, kind, item_id)).fetchone()
    return int(row[0]) if row else 0


def verify_profile_semantics() -> None:
    now = 1_700_000_100_000

    bio = base_db(); bio.executescript(CANDIDATE.read_text(encoding='utf-8'))
    feed_before = seq(bio, 'feed', 'profile', 'owner')
    profile_before = seq(bio, 'profile:owner', 'profile', 'owner')
    bio_rows = changes(bio, "UPDATE public_profiles SET bio='hello', updated_at=? WHERE uid='owner'", (now,))
    row = bio.execute("SELECT row_json FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    require(row and json.loads(row[0]).get('bio') == 'hello', 'bio projection did not update')
    require(seq(bio, 'profile:owner', 'profile', 'owner') > profile_before, 'bio did not invalidate public profile')
    require(seq(bio, 'feed', 'profile', 'owner') == feed_before, 'bio unnecessarily invalidated Feed')
    require(bio_rows == 4, f'bio logical rows expected 4, got {bio_rows}')

    avatar = base_db(); avatar.executescript(CANDIDATE.read_text(encoding='utf-8'))
    feed_before = seq(avatar, 'feed', 'profile', 'owner')
    profile_before = seq(avatar, 'profile:owner', 'profile', 'owner')
    avatar_rows = changes(avatar, "UPDATE public_profiles SET avatar_url='https://img.example/a.png', updated_at=? WHERE uid='owner'", (now + 1,))
    require(seq(avatar, 'profile:owner', 'profile', 'owner') > profile_before, 'avatar did not invalidate public profile')
    require(seq(avatar, 'feed', 'profile', 'owner') > feed_before, 'avatar did not invalidate Feed')
    require(avatar_rows == 6, f'avatar compatibility rows expected 6, got {avatar_rows}')
    print(f'076_LIVE033_PROFILE_COST=PASS bio={bio_rows} avatar={avatar_rows}')


def verify_track_insert_delete_semantics() -> None:
    conn = base_db(); conn.executescript(CANDIDATE.read_text(encoding='utf-8'))
    before_count = int(conn.execute("SELECT track_count FROM explore_derived_profiles WHERE uid='owner'").fetchone()[0])
    before_seq = int(conn.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0])
    conn.execute("INSERT INTO explore_derived_tracks(id,owner_uid,active,published_at,pinned,likes,row_json) VALUES('track-2','owner',1,2,0,0,'{}')")
    after_insert = int(conn.execute("SELECT track_count FROM explore_derived_profiles WHERE uid='owner'").fetchone()[0])
    require(after_insert == before_count + 1, 'insert track_count mismatch')
    require(seq(conn, 'feed', 'track', 'track-2') > before_seq, 'insert Feed journal missing')
    require(seq(conn, 'profile:owner', 'track', 'track-2') > before_seq, 'insert profile journal missing')
    # Same seq is safe because these are different scopes.
    require(seq(conn, 'feed', 'track', 'track-2') == seq(conn, 'profile:owner', 'track', 'track-2'), 'insert sibling scopes did not share seq')
    conn.execute("DELETE FROM explore_derived_tracks WHERE id='track-2'")
    after_delete = int(conn.execute("SELECT track_count FROM explore_derived_profiles WHERE uid='owner'").fetchone()[0])
    require(after_delete == before_count, 'delete track_count mismatch')
    require(seq(conn, 'feed', 'track', 'track-2') == seq(conn, 'profile:owner', 'track', 'track-2'), 'delete sibling scopes did not share seq')
    print('076_LIVE033_TRACK_INSERT_DELETE=PASS count=true feed=true profile=true cursor_safe=true')


def verify_rollback() -> None:
    conn = base_db()
    original = {name: trigger_sql(conn, name) for name in TARGETS}
    protected = trigger_sql(conn, PROTECTED_033)
    conn.executescript(CANDIDATE.read_text(encoding='utf-8'))
    rollback = '\n'.join(
        [f'DROP TRIGGER IF EXISTS "{name}";' for name in sorted(TARGETS)]
        + [original[name].rstrip().rstrip(';') + ';' for name in sorted(TARGETS)]
    )
    conn.executescript(rollback)
    for name, sql in original.items():
        require(norm(trigger_sql(conn, name)) == norm(sql), f'rollback mismatch: {name}')
    require(norm(trigger_sql(conn, PROTECTED_033)) == norm(protected), 'rollback disturbed protected 033 trigger')
    print('076_LIVE033_ROLLBACK=PASS targets=4 protected_033_unchanged=true')


def main() -> None:
    verify_static()
    verify_preserves_033_and_data()
    verify_profile_semantics()
    verify_track_insert_delete_semantics()
    verify_rollback()
    print('VERIFY_076_LIVE033_COMPACTION=PASS')


if __name__ == '__main__':
    main()
