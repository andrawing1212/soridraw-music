from pathlib import Path

p = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = p.read_text(encoding='utf-8')

old_status = 'Status: IMPLEMENTATION / Step 3-4b settings canary complete and verified — 3 V2 settings documents created, V1 unchanged; awaiting approval for Step 3-4c playlist-header limited backfill'
new_status = 'Status: IMPLEMENTATION / Step 3-4c playlist-header limited backfill complete and verified — 42 V2 playlist headers created, V1 unchanged; awaiting approval for Step 3-4d playlist-item limited backfill'
if old_status not in text:
    raise SystemExit('Expected Step 3-4b status not found')
text = text.replace(old_status, new_status, 1)

old_goal = '12. Every implementation substep must be followed by self-review, omission check and independent result verification; the initial implementation must not be assumed correct.'
new_goal = old_goal + '\n13. User Gemini/Suno/provider API keys must use encrypted-at-rest persistent storage only; plaintext must never be persisted, cached, logged or returned to the browser. Future proxy runtimes may decrypt only just-in-time for the outbound provider request and must discard plaintext references immediately. See `docs/SORIDRAW_API_KEY_SECURITY_REQUIREMENTS.md`.'
if old_goal not in text:
    raise SystemExit('Expected non-negotiable goal anchor not found')
if 'SORIDRAW_API_KEY_SECURITY_REQUIREMENTS.md' not in text:
    text = text.replace(old_goal, new_goal, 1)

old_heading = '### Step 3 — Backup, backfill and verification (3/6 complete; Step 3-4 safety design complete, writes not started) 🔄'
new_heading = '### Step 3 — Backup, backfill and verification (3/6 complete; Step 3-4c complete, limited writes verified) 🔄'
if old_heading not in text:
    raise SystemExit('Expected Step 3 heading not found')
text = text.replace(old_heading, new_heading, 1)

old_tracker = '''  - [x] 3-4b Settings canary complete: 3 `user_structures` documents created at `users/{uid}/settings/sections`; all V1 sources remained unchanged and destination payload parity verified.
  - [ ] 3-4c Playlist-header limited backfill: 42 headers, bounded create-only batches, conflict-stop and immediate parity verification.
  - [ ] 3-4d Playlist-item limited backfill: 49 items after header verification.'''
new_tracker = '''  - [x] 3-4b Settings canary complete: 3 `user_structures` documents created at `users/{uid}/settings/sections`; all V1 sources remained unchanged and destination payload parity verified.
  - [x] 3-4c Playlist-header limited backfill complete: 42 headers created at `users/{uid}/playlists/{playlistId}` in two bounded 21-document transactions; IDs/payload parity verified and V1 remained unchanged.
  - [ ] 3-4d Playlist-item limited backfill: 49 items after re-verifying all parent V2 playlist headers.'''
if old_tracker not in text:
    raise SystemExit('Expected Step 3-4 tracker block not found')
text = text.replace(old_tracker, new_tracker, 1)

marker = '## 10. Mandatory progress / self-review reporting'
summary = '''### Step 3-4c execution complete — playlist headers verified
- GitHub Actions run `32852176048` completed SUCCESS.
- Fresh preflight observed 3,060 same-day reads, 73 writes and 0 deletes; migration caps remained 10,000 reads / 5,000 writes.
- Step 3-3 manifest and playlist-header dataset checksum were re-verified before writes.
- Backup and live approved `lists` path sets both contained exactly 42 documents with no path delta.
- Created exactly 42 V2 playlist headers at `users/{uid}/playlists/{playlistId}` in two bounded 21-document transactions.
- Existing destinations would have been no-op only if identical; any conflict/source change would have stopped execution.
- Post-write verification confirmed every V1 source payload/update time unchanged, every V2 payload hash matched, and every playlist ID was preserved.
- V1 writes/deletes: 0 / 0. V2 deletes: 0. Rules, Functions and Firebase Hosting deploys: 0.
- Full result: `docs/SORIDRAW_BACKEND_V2_STEP3_4C_PLAYLIST_HEADERS_RESULT.md`.

'''
if marker not in text:
    raise SystemExit('Master reporting marker not found')
if '### Step 3-4c execution complete' not in text:
    text = text.replace(marker, summary + marker, 1)

p.write_text(text, encoding='utf-8')
