# SORIDRAW app292 — Song Save / Edit / Sync / Cost Baseline

Date: 2026-10-02 KST

This reference captures the architecture established during the app290 → app292 PREVIEW work. It is a guardrail for future changes, not permission to refactor a working path.

## Verified user-observed behavior before app292 timing extension

On PREVIEW app291, the user confirmed:
- title edit/save reflected immediately on the other device;
- save-heart state reflected immediately on the other device;
- prompt edits reflected immediately on the other device;
- lyrics initially lagged until the canonical batch, then app291 fixed the receiving-device local language-map merge and immediate lyric reflection was confirmed;
- measured browser SDK server reads stayed at 0 during the observed test;
- D1 R0/W0 and Cloudflare Worker 0 for this private edit test;
- observed final writes for the mixed test were:
  - favorites W1;
  - user_recent_songs W1;
  - users W2;
  - total Firestore SDK writes W4.

Interpretation of that mixed test:
- one actual final heart change: favorite W1 + derived users.favoriteCount W1 = W2;
- Recent title/prompt/lyrics edits collapsed to user_recent_songs W1 + users.syncVersions.recentSongs W1 = W2;
- prior per-field Recent W6 repetition did not reappear.

## app292 timing decision

User explicitly changed only the Recent canonical quiet window:
- app291 Recent canonical batch: 60 seconds.
- app292 Recent canonical batch: **150 seconds after the latest edit**.
- immediate RTDB preview behavior remains unchanged.
- Studio heart remains 30 seconds per song.
- derived users.favoriteCount remains UID-wide 30-second delta batching.

## app292 code/audit evidence

Verified source commit:
- `34127904db7bb158ebcae28000fa65745fe56c8b`

Release request/deploy source:
- `513637969b59f7c1ed964faa452a5537ed83a23f`

Apply/audit Run:
- `36932805247` — SUCCESS

Firebase PREVIEW release Run:
- `36933026848` — SUCCESS

Release verification:
- PREVIEW app292 exact build PASS.
- TEST/PRODUCTION unchanged PASS.
- Shared RTDB Rules SKIPPED.
- Worker/Functions/Firestore Rules/D1 unchanged.
- no user-data migration/backfill/delete.

Targeted regression results recorded in the run:
- `APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS`
- `APP292_RECENT_MULTI_SONG_AGGREGATE_BATCH=PASS`
- app290 Studio heart batching regression PASS.
- app291 lyrics live-preview regression PASS.
- app289 Music Note heart regression PASS.
- Music Note Detail batch regression PASS.
- TypeScript PASS.
- Build PASS.

## Current architecture distinctions

### Recent Song edits
Scope: title / prompt / lyrics.

- One UID-level pending Recent aggregate.
- Any Recent song edit within the 150-second window resets the same timer.
- The pending snapshot includes the latest state of the Recent list, so edits to A/B/C songs can collapse into one aggregate canonical persistence.
- Immediate cross-device preview remains per changed item.
- Canonical target after quiet period: `user_recent_songs W1 + users.syncVersions.recentSongs W1 = W2`.

### Studio save heart
Scope: Music Note save/unsave membership.

- Pending intent keyed per favorite document/song.
- Each song has its own 30-second trailing timer.
- A different song does not restart another song's timer.
- Repeated same-song toggles collapse to final intent.
- final == baseline → favorite W0 target.
- final != baseline → favorite W1 target.

### users.favoriteCount
This is a derived statistic.

Current implementation file:
- `src/services/musicNoteFavoriteCountBatch.ts`

Behavior:
- UID-level pending delta.
- 30-second trailing timer.
- localStorage persistence.
- successful canonical save/unsave queues +1/-1.
- multiple deltas collapse to one `increment(totalDelta)` users write.
- net delta 0 means no statistic write.

This statistic must not become the canonical source for whether a specific song is saved.

## Remaining verification note

app292's 150-second timer extension passed code/audit and PREVIEW deployment verification. The user's prior real-device proof established the immediate-sync and cost architecture on app291. Future release decisions should still treat real-device app292 timing/cost confirmation as a separate check when relevant.

## Protected rule

Do not "optimize" this architecture by:
- removing immediate RTDB previews;
- forcing cross-device UI to wait for Firestore;
- turning Recent batching into per-song canonical writes;
- turning heart batching into a fake aggregate membership document;
- reading whole Recent/Music Note collections on preview receive;
- using derived favoriteCount as membership truth;
- adding page-navigation/focus polling or repeated writes.

Any future change must preserve the user-visible behavior first and demonstrate that backend work stays bounded and independent of total collection size.
