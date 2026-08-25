from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        'Status: IMPLEMENTATION / Step 3-4c playlist-header limited backfill complete and verified — 42 V2 playlist headers created, V1 unchanged; awaiting approval for Step 3-4d playlist-item limited backfill',
        'Status: IMPLEMENTATION / Step 3-4d playlist-item limited backfill complete and verified — 49 V2 playlist items created under 42 verified V2 playlist headers, V1 unchanged; awaiting approval for Step 3-4e recent-song limited backfill',
    ),
    (
        '### Step 3 — Backup, backfill and verification (3/6 complete; Step 3-4c complete, limited writes verified) 🔄',
        '### Step 3 — Backup, backfill and verification (3/6 complete; Step 3-4d complete, limited writes verified) 🔄',
    ),
    (
        '  - [ ] 3-4d Playlist-item limited backfill: 49 items after re-verifying all parent V2 playlist headers.',
        '  - [x] 3-4d Playlist-item limited backfill complete: 49 items created under their preserved playlist IDs after all 42 parent V2 playlist headers were re-verified; full payload/source/color/order parity verified and V1 remained unchanged.',
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected master-plan text not found: {old[:120]}')
    text = text.replace(old, new, 1)

marker = '## 10. Mandatory progress / self-review reporting'
if marker not in text:
    raise SystemExit('Master progress marker missing')

section = '''### Step 3-4d execution complete — playlist items verified
- GitHub Actions run `32853791057` completed SUCCESS.
- Fresh preflight observed 3,312 same-day reads, 115 writes and 0 deletes; migration caps remained 10,000 reads / 5,000 writes.
- Step 3-3 manifest plus playlist-header and playlist-item dataset checksums were re-verified before writes.
- All 42 current V1 playlist headers and their 42 V2 parent destinations were re-verified for exact payload parity before item creation.
- Backup and live approved item path sets both contained exactly 49 documents with no path delta.
- Created exactly 49 V2 playlist items at `users/{uid}/playlists/{playlistId}/items/{itemId}` in two bounded transactions (25 + 24).
- Existing destinations would have been no-op only if identical; any parent/source/destination conflict or source change would have stopped execution.
- Post-write verification confirmed every V1 item payload/update time unchanged, every V2 item payload hash matched, item IDs and parent playlist IDs were preserved, and full payload parity preserved source/color/order relationship fields.
- V1 writes/deletes: 0 / 0. V2 deletes: 0. Rules, Functions and Firebase Hosting deploys: 0.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_4D_PLAYLIST_ITEMS_RESULT.md`.

'''

if '### Step 3-4d execution complete — playlist items verified' not in text:
    text = text.replace(marker, section + marker, 1)

path.write_text(text, encoding='utf-8')
