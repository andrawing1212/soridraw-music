from __future__ import annotations

import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'cloudflare' / 'explore-worker' / 'scripts' / 'fixtures' / 'canonical-schema.sql'
DERIVED = ROOT / 'cloudflare' / 'explore-worker' / 'migrations' / '20260910_01_explore_derived_state.sql'
CANDIDATE = ROOT / 'cloudflare' / 'explore-worker' / 'candidates' / '076-derived-trigger-compaction.sql'
TARGETS = {
    'explore032_derived_track_insert',
    'explore032_derived_track_update',
    'explore032_derived_track_delete',
    'explore032_derived_profile_update',
    'explore032_derived_profile_feed',
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def normalize_sql(value: str | None) -> str:
    return re.sub(r'\s+', ' ', str(value or '').strip()).lower()


def seed() -> sqlite3.Connection:
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
    conn.execute(
        "INSERT INTO profile_stats(uid,follower_count,following_count,updated_at) VALUES('owner',3,2,?)",
        (now,),
    )
    conn.execute(
        """INSERT INTO tracks(
          id,owner_uid,source_type,source_id,source_parent_id,legacy_global_id,
          source_subtrack_key,source_subtrack_index,source_subtrack_id,title,description,cover_url,
          duration_seconds,lyrics,style,prompt,suno_url_primary,suno_url_secondary,search_text,
          is_public,status,published_at,created_at,updated_at,allow_next_song_apply,
          allow_follower_save,profile_pinned,share_schema_version,share_payload_json,primary_genre
        ) VALUES(
          'track-1','owner','music_note','note-1',NULL,NULL,'',NULL,NULL,'Track 1','desc','cover',
          180,'lyrics','style','prompt','https://suno.com/s/test',NULL,'Track 1',1,'published',?,?,?,1,1,0,1,'{}','pop'
        )""",
        (now, now, now),
    )
    conn.execute(
        "INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at) VALUES('track-1',7,1,12,?)",
        (now,),
    )
    conn.execute("INSERT INTO likes(track_id,user_uid,created_at) VALUES('track-1','viewer-1',?)", (now,))
    conn.commit()
    return conn


def schema_map(conn: sqlite3.Connection, kind: str) -> dict[str, str]:
    return {
        str(name): str(sql or '')
        for name, sql in conn.execute(
            "SELECT name,sql FROM sqlite_schema WHERE type=? AND name NOT LIKE 'sqlite_%' ORDER BY name",
            (kind,),
        )
    }


def data_snapshot(conn: sqlite3.Connection) -> dict[str, tuple[tuple[str, ...], tuple[tuple[str, ...], ...]]]:
    snapshot = {}
    table_names = [
        str(row[0])
        for row in conn.execute(
            "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    for table in table_names:
        columns = tuple(str(row[1]) for row in conn.execute(f'PRAGMA table_info("{table}")'))
        raw_rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
        rows = tuple(sorted(tuple(repr(value) for value in row) for row in raw_rows))
        snapshot[table] = (columns, rows)
    return snapshot


def verify_candidate_static() -> None:
    sql = CANDIDATE.read_text(encoding='utf-8')
    executable = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    upper = executable.upper()
    for forbidden in ('DROP TABLE', 'ALTER TABLE', 'CREATE TABLE', 'DROP INDEX', 'CREATE INDEX', 'DELETE FROM'):
        require(forbidden not in upper, f'076 maintenance candidate contains forbidden DDL/data operation: {forbidden}')
    dropped = set(re.findall(r'^\s*DROP\s+TRIGGER\s+IF\s+EXISTS\s+([A-Za-z0-9_]+)', executable, flags=re.IGNORECASE | re.MULTILINE))
    created = set(re.findall(r'^\s*CREATE\s+TRIGGER\s+([A-Za-z0-9_]+)', executable, flags=re.IGNORECASE | re.MULTILINE))
    require(dropped == TARGETS, f'076 drop target drift: {sorted(dropped)}')
    require(created == TARGETS, f'076 create target drift: {sorted(created)}')
    print('076_TRIGGER_MAINTENANCE_STATIC=PASS trigger_set=5 table_ddl=0 direct_delete=0')


def verify_ddl_data_purity_and_rollback() -> None:
    conn = seed()
    before_data = data_snapshot(conn)
    before_indexes = schema_map(conn, 'index')
    before_triggers = schema_map(conn, 'trigger')
    require(TARGETS.issubset(before_triggers), 'baseline missing one or more 076 target triggers')

    conn.executescript(CANDIDATE.read_text(encoding='utf-8'))
    after_data = data_snapshot(conn)
    after_indexes = schema_map(conn, 'index')
    after_triggers = schema_map(conn, 'trigger')

    require(after_data == before_data, '076 trigger replacement changed stored rows during DDL')
    require(after_indexes == before_indexes, '076 trigger replacement changed indexes')
    require(set(after_triggers) == set(before_triggers), '076 trigger replacement changed trigger name set')
    for name, sql in before_triggers.items():
        if name in TARGETS:
            require(normalize_sql(after_triggers[name]) != normalize_sql(sql), f'076 target trigger did not change: {name}')
        else:
            require(normalize_sql(after_triggers[name]) == normalize_sql(sql), f'076 changed unrelated trigger: {name}')

    rollback = '\n'.join(
        [f'DROP TRIGGER IF EXISTS "{name}";' for name in sorted(TARGETS)]
        + [before_triggers[name].rstrip().rstrip(';') + ';' for name in sorted(TARGETS)]
    )
    conn.executescript(rollback)
    restored_data = data_snapshot(conn)
    restored_indexes = schema_map(conn, 'index')
    restored_triggers = schema_map(conn, 'trigger')

    require(restored_data == before_data, '076 rollback changed stored rows')
    require(restored_indexes == before_indexes, '076 rollback changed indexes')
    require(set(restored_triggers) == set(before_triggers), '076 rollback trigger set mismatch')
    for name, sql in before_triggers.items():
        require(normalize_sql(restored_triggers[name]) == normalize_sql(sql), f'076 rollback did not restore trigger SQL: {name}')

    print('076_DDL_DATA_PURITY=PASS stored_rows_unchanged=true indexes_unchanged=true unrelated_triggers_unchanged=true')
    print('076_ROLLBACK_RESTORE=PASS original_trigger_sql_restored=true stored_rows_unchanged=true')


def main() -> None:
    verify_candidate_static()
    verify_ddl_data_purity_and_rollback()
    print('VERIFY_076_TRIGGER_MAINTENANCE=PASS')


if __name__ == '__main__':
    main()
