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
MUSIC079 = CF / 'migrations' / '20260913_03_music_note_write_compaction.sql'
MIGRATION = CF / 'migrations' / '20260930_01_profile_source_trigger_compaction.sql'

TARGETS = {
    'explore032_profile_update',
    'explore032_profile_delete',
    'explore032_derived_profile_update',
    'explore032_derived_profile_feed',
}
PROTECTED_079 = {
    'explore032_derived_track_insert',
    'explore079_music_note_derived_track_insert',
    'explore032_derived_track_update',
    'explore079_music_note_derived_track_update',
}
PROTECTED_SHARED = 'soridraw_shared_rev_public_profiles_au_051'


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
    conn.executescript(LIKE033.read_text(encoding='utf-8'))
    conn.executescript(MUSIC079.read_text(encoding='utf-8'))
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS explore_shared_revision(
        scope TEXT PRIMARY KEY,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO explore_shared_revision(scope,revision,updated_at) VALUES('global',1,0);
      CREATE TRIGGER soridraw_shared_rev_public_profiles_au_051
      AFTER UPDATE ON public_profiles
      BEGIN
        UPDATE explore_shared_revision
        SET revision=revision+1, updated_at=NEW.updated_at
        WHERE scope='global';
      END;
    """)
    return conn


def seq(conn: sqlite3.Connection, scope: str, kind: str, item_id: str) -> int:
    row = conn.execute(
        "SELECT seq FROM explore_derived_changes WHERE scope=? AND kind=? AND id=?",
        (scope, kind, item_id),
    ).fetchone()
    return int(row[0]) if row else 0


def changes(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> int:
    before = conn.total_changes
    conn.execute(sql, params)
    return conn.total_changes - before


def verify_static() -> None:
    sql = MIGRATION.read_text(encoding='utf-8')
    clean = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    dropped = set(re.findall(r'DROP\s+TRIGGER\s+IF\s+EXISTS\s+([A-Za-z0-9_]+)', clean, flags=re.IGNORECASE))
    created = set(re.findall(r'CREATE\s+TRIGGER\s+([A-Za-z0-9_]+)', clean, flags=re.IGNORECASE))
    require(dropped == TARGETS, f'249 target drop drift: {sorted(dropped)}')
    require(created == TARGETS, f'249 target create drift: {sorted(created)}')
    require(not (PROTECTED_079 & dropped), '249 may not replace Music Note 079 triggers')
    require(PROTECTED_SHARED not in dropped and PROTECTED_SHARED not in created, '249 may not replace shared revision compatibility trigger')
    upper = clean.upper()
    for token in ('DROP TABLE', 'ALTER TABLE', 'CREATE TABLE', 'DROP INDEX', 'CREATE INDEX', 'DELETE FROM'):
        require(token not in upper, f'forbidden maintenance operation: {token}')
    require('LEFT JOIN PROFILE_STATS' not in upper, '249 hot profile update must not re-read profile_stats')
    require('FROM PUBLIC_PROFILES P' not in upper, '249 hot profile update must use NEW values directly')
    require("WHEN 0" in upper, 'historical derived profile feed trigger must be inert')
    print('249_PROFILE_TRIGGER_STATIC=PASS targets=4 protected079=true sharedRevision=true')


def verify_ddl_purity_and_rollback() -> None:
    conn = base_db()
    before_targets = {name: trigger_sql(conn, name) for name in TARGETS}
    before_079 = {name: trigger_sql(conn, name) for name in PROTECTED_079}
    before_shared = trigger_sql(conn, PROTECTED_SHARED)
    before_rows = {
        'profiles': conn.execute("SELECT * FROM public_profiles ORDER BY uid").fetchall(),
        'profile_stats': conn.execute("SELECT * FROM profile_stats ORDER BY uid").fetchall(),
        'tracks': conn.execute("SELECT id,owner_uid,is_public,status,updated_at FROM tracks ORDER BY id").fetchall(),
        'derived_profiles': conn.execute("SELECT * FROM explore_derived_profiles ORDER BY uid").fetchall(),
        'changes': conn.execute("SELECT * FROM explore_derived_changes ORDER BY scope,kind,id").fetchall(),
    }

    conn.executescript(MIGRATION.read_text(encoding='utf-8'))

    after_rows = {
        'profiles': conn.execute("SELECT * FROM public_profiles ORDER BY uid").fetchall(),
        'profile_stats': conn.execute("SELECT * FROM profile_stats ORDER BY uid").fetchall(),
        'tracks': conn.execute("SELECT id,owner_uid,is_public,status,updated_at FROM tracks ORDER BY id").fetchall(),
        'derived_profiles': conn.execute("SELECT * FROM explore_derived_profiles ORDER BY uid").fetchall(),
        'changes': conn.execute("SELECT * FROM explore_derived_changes ORDER BY scope,kind,id").fetchall(),
    }
    require(before_rows == after_rows, '249 DDL changed stored user/derived data')
    for name, sql in before_079.items():
        require(norm(trigger_sql(conn, name)) == norm(sql), f'249 changed protected 079 trigger: {name}')
    require(norm(trigger_sql(conn, PROTECTED_SHARED)) == norm(before_shared), '249 changed shared revision trigger')

    rollback = '\n'.join(
        [f'DROP TRIGGER IF EXISTS "{name}";' for name in sorted(TARGETS)]
        + [before_targets[name].rstrip().rstrip(';') + ';' for name in sorted(TARGETS)]
    )
    conn.executescript(rollback)
    for name, sql in before_targets.items():
        require(norm(trigger_sql(conn, name)) == norm(sql), f'249 rollback mismatch: {name}')
    print('249_PROFILE_TRIGGER_DDL_PURITY=PASS data_unchanged=true rollback=true')


def verify_profile_cost_and_semantics() -> None:
    now = 1_700_000_100_000

    # updated_at-only writes from old TEST/PRODUCTION handlers must not wake derived profile/feed.
    noop = base_db(); noop.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(noop, 'profile:owner', 'profile', 'owner')
    f0 = seq(noop, 'feed', 'profile', 'owner')
    noop_rows = changes(noop, "UPDATE public_profiles SET updated_at=? WHERE uid='owner'", (now,))
    require(seq(noop, 'profile:owner', 'profile', 'owner') == p0, 'updated_at-only save woke profile journal')
    require(seq(noop, 'feed', 'profile', 'owner') == f0, 'updated_at-only save woke feed journal')
    # canonical row + protected shared revision only
    require(noop_rows == 2, f'updated_at-only logical rows expected 2, got {noop_rows}')

    bio = base_db(); bio.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(bio, 'profile:owner', 'profile', 'owner')
    f0 = seq(bio, 'feed', 'profile', 'owner')
    before_state = int(bio.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0])
    bio_rows = changes(bio, "UPDATE public_profiles SET bio='hello', updated_at=? WHERE uid='owner'", (now + 1,))
    row = bio.execute("SELECT row_json FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    require(row and json.loads(row[0]).get('bio') == 'hello', 'bio projection did not update')
    require(seq(bio, 'profile:owner', 'profile', 'owner') > p0, 'bio profile journal missing')
    require(seq(bio, 'feed', 'profile', 'owner') == f0, 'bio unnecessarily invalidated Feed')
    require(int(bio.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0]) == before_state + 1, 'bio must advance state once')
    # canonical + derived + state + profile journal + protected shared revision
    require(bio_rows == 5, f'bio logical rows expected 5, got {bio_rows}')

    avatar = base_db(); avatar.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(avatar, 'profile:owner', 'profile', 'owner')
    f0 = seq(avatar, 'feed', 'profile', 'owner')
    before_state = int(avatar.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0])
    avatar_rows = changes(avatar, "UPDATE public_profiles SET avatar_url='https://img.example/a.webp', updated_at=? WHERE uid='owner'", (now + 2,))
    p1 = seq(avatar, 'profile:owner', 'profile', 'owner')
    f1 = seq(avatar, 'feed', 'profile', 'owner')
    require(p1 > p0 and f1 > f0, 'avatar must invalidate profile and Feed')
    require(p1 == f1, 'avatar profile/feed sibling scopes must share one seq')
    require(int(avatar.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0]) == before_state + 1, 'avatar must advance state once')
    # canonical + derived + state + profile journal + feed journal + protected shared revision
    require(avatar_rows == 6, f'avatar logical rows expected 6, got {avatar_rows}')

    stats = base_db(); stats.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(stats, 'profile:owner', 'profile', 'owner')
    f0 = seq(stats, 'feed', 'profile', 'owner')
    changes(stats, "UPDATE profile_stats SET follower_count=9,updated_at=? WHERE uid='owner'", (now + 3,))
    derived = stats.execute("SELECT followers FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    require(derived and int(derived[0]) == 9, 'follower projection did not update')
    require(seq(stats, 'profile:owner', 'profile', 'owner') > p0, 'follower profile journal missing')
    require(seq(stats, 'feed', 'profile', 'owner') == f0, 'follower update unnecessarily invalidated Feed')

    track = base_db(); track.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(track, 'profile:owner', 'profile', 'owner')
    changes(track, "UPDATE explore_derived_profiles SET track_count=track_count+1 WHERE uid='owner'")
    require(seq(track, 'profile:owner', 'profile', 'owner') == p0, 'track_count-only derived update duplicated profile journal')

    print(f'249_PROFILE_TRIGGER_COST=PASS noop={noop_rows} bio={bio_rows} avatar={avatar_rows} state_once=true')


def verify_delete_semantics() -> None:
    conn = base_db(); conn.executescript(MIGRATION.read_text(encoding='utf-8'))
    p0 = seq(conn, 'profile:owner', 'profile', 'owner')
    f0 = seq(conn, 'feed', 'profile', 'owner')
    before_state = int(conn.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0])
    conn.execute("DELETE FROM public_profiles WHERE uid='owner'")
    row = conn.execute("SELECT active,row_json FROM explore_derived_profiles WHERE uid='owner'").fetchone()
    require(row and int(row[0]) == 0 and row[1] == '{}', 'profile delete projection mismatch')
    p1 = seq(conn, 'profile:owner', 'profile', 'owner')
    f1 = seq(conn, 'feed', 'profile', 'owner')
    require(p1 > p0 and f1 > f0 and p1 == f1, 'delete profile/feed journals must share one new seq')
    require(int(conn.execute("SELECT seq FROM explore_derived_state WHERE id=1").fetchone()[0]) == before_state + 1, 'delete must advance state once')
    print('249_PROFILE_DELETE=PASS projection=true sibling_seq=true')


def main() -> None:
    verify_static()
    verify_ddl_purity_and_rollback()
    verify_profile_cost_and_semantics()
    verify_delete_semantics()
    print('VERIFY_249_PROFILE_SOURCE_TRIGGER_COMPACTION=PASS')


if __name__ == '__main__':
    main()
