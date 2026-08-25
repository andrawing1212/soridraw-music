from pathlib import Path

path = Path('docs/SORIDRAW_BACKEND_V2_MASTER_PLAN.md')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "Status: IMPLEMENTATION / Step 2-A4a complete — provider-neutral stable song ID, deterministic mutation/version contract and separate bounded IndexedDB mirror outbox are implemented and validated with runtime OFF and zero Firebase IO; Step 2-A4b V1 recent/Music Note mutation-boundary centralization is next, while Step 4 remains blocked before separately approved shadow/catch-up writes",
        "Status: IMPLEMENTATION / Step 2-A4b complete — all audited current Recent and Music Note V1 content mutations now pass through one behavior-compatible V1 boundary with mirror/outbox/stable-ID runtime still OFF and no added Firebase IO; mandatory Maintenance Gate A is next before any separately approved 2-A4c shadow write, and Step 4 remains blocked",
    ),
    (
        "2-A4 live mutation/sync risk review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4_LIVE_MUTATION_SYNC_RISK_REVIEW.md`.",
        "2-A4 live mutation/sync risk review: `docs/SORIDRAW_BACKEND_V2_STEP2_A4_LIVE_MUTATION_SYNC_RISK_REVIEW.md`.\n2-A4a inert identity/outbox result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4A_INERT_ID_OUTBOX_RESULT.md`.\n2-A4b V1 mutation-boundary result: `docs/SORIDRAW_BACKEND_V2_STEP2_A4B_V1_MUTATION_BOUNDARY_RESULT.md`.\nMaintenance ledger: `docs/SORIDRAW_MAINTENANCE_BACKLOG.md`.",
    ),
    (
        "### 2-B complete — additive V2 schema/rules source",
        "### 2-A4b complete — current V1 Recent/Music Note mutation boundaries centralized; mirror OFF\n- Source-only audits `32887635933` and `32887735487` enumerated the current mutation topology before runtime edits and performed zero Firebase IO.\n- Added `src/data/v1MutationBoundary.ts` and contract: the boundary is metadata-only, imports no Firebase/V2/outbox/network code, executes the existing V1 mutation once, preserves its Promise/error/concurrency behavior and keeps `BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = false`.\n- Current App Recent writes are covered 8/8: clear/reset, delete-item, normal batch save, regenerate persistence, added-lyrics-language persistence, edit persistence and pre-Music-Note edit persistence; no stable ID injection or outbox activation occurs.\n- Audited Music Note content mutations across `App.tsx`, `FavoritesPage.tsx` and `SunoLibraryPage.tsx` are routed through the boundary, including save/restore/unsave/permanent delete/update/recovery, bulk delete/lock/unlock, folder mutations/shared-note save and favorite-color metadata sync. Supporting `users/{uid}` sync/count writes retain existing semantics and are not promoted into canonical content mutations.\n- Apply/validation run `32888639358` SUCCESS: protected Firebase/backend files unchanged, static omission gate passed, boundary and Step 2-A4a identity contracts passed, scoped TypeScript passed and production Vite build passed.\n- Independent post-verification run `32888861551` SUCCESS: `recentV1WritePaths=8`, `recentWrapped=8`, `recentBoundaryCalls=8`, App/FavoritesPage/SunoLibraryPage boundary calls `19/4/1`, mirror OFF, Firebase reads/writes/deletes `0/0/0`; contracts and production build passed again.\n- Tooling-only failures before success are documented in the result report and had no runtime/Firebase effect.\n- No Rules/indexes/Functions/Hosting deploy, main promotion, Firebase migration/backfill, API-key change or Suno Library migration occurred.\n- 2-A4c remains blocked until Maintenance Gate A clears M-001/M-002/M-003/M-008 and then receives separate exact write approval.\n- Full detail: `docs/SORIDRAW_BACKEND_V2_STEP2_A4B_V1_MUTATION_BOUNDARY_RESULT.md`.\n\n### 2-B complete — additive V2 schema/rules source",
    ),
    (
        "### Step 2 — V2 code implementation on preview (2-A4a inert identity/outbox complete; 2-A4b/c/d still gated) 🔄",
        "### Step 2 — V2 code implementation on preview (2-A4b V1 mutation-boundary centralization complete; Maintenance Gate A + 2-A4c/d still gated) 🔄",
    ),
    (
        "    - [ ] 2-A4b Centralize all current V1 recent/Music Note mutation boundaries while V2 mirror remains OFF; prove V1 parity/cost unchanged.",
        "    - [x] 2-A4b Centralize all audited current V1 Recent/Music Note content mutation boundaries while V2 mirror remains OFF; 8/8 Recent paths + audited Music Note categories independently verified, no added Firebase IO.",
    ),
    (
        "### Step 4 — Preview validation (0/12; blocked pending Step 2-A4b + separately approved 2-A4c/d write stages) ⏳",
        "### Step 4 — Preview validation (0/12; blocked pending mandatory Maintenance Gate A + separately approved 2-A4c/d write stages) ⏳",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Master Plan anchor mismatch ({count}): {old[:120]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Step 2-A4b Master Plan finalization patch applied')
