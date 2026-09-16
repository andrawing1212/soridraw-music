from pathlib import Path
import json

like_path = Path('src/services/exploreLikeService.ts')
page_path = Path('src/pages/ExplorePage.tsx')
version_path = Path('public/app-version.json')
state_path = Path('DOCS/CURRENT_RELEASE_STATE.md')

like = like_path.read_text(encoding='utf-8')
page = page_path.read_text(encoding='utf-8')

if 'SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916' not in like:
    old = "const EXPLORE_LIKE_BATCH_MAX = 50;\n"
    new = """const EXPLORE_LIKE_BATCH_MAX = 50;
// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916
// The first real local like change starts the existing server-side five-minute
// aggregate window. Later changes stay local and are flushed once near the end
// of that window, so repeated toggles collapse to the final desired state.
const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 * 60_000;
const EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104 = 15_000;
type ExploreLikeEventWindow104 = {
  startedAt: number;
  finalFlushTimer: number;
};
const exploreLikeEventWindowByUid104 = new Map<string, ExploreLikeEventWindow104>();
"""
    if old not in like:
        raise SystemExit('missing like constant anchor')
    like = like.replace(old, new, 1)

    anchor = "\nexport const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {"
    helper = """

const beginExploreLikeEventWindow104 = (user: User, now = Date.now()) => {
  const uid = user.uid;
  const finalFlushDelay = EXPLORE_LIKE_EVENT_WINDOW_MS_104 - EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104;
  const active = exploreLikeEventWindowByUid104.get(uid);
  if (active && now - active.startedAt < finalFlushDelay) return false;
  if (active) window.clearTimeout(active.finalFlushTimer);

  const startedAt = now;
  const finalFlushTimer = window.setTimeout(() => {
    const current = exploreLikeEventWindowByUid104.get(uid);
    if (!current || current.startedAt != startedAt) return;
    exploreLikeEventWindowByUid104.delete(uid);
    // No request is made when the outbox is already empty. If later toggles
    // exist, this sends their final states before the server aggregate alarm.
    void flushPendingLikes(user);
  }, finalFlushDelay);

  exploreLikeEventWindowByUid104.set(uid, { startedAt, finalFlushTimer });
  return true;
};
"""
    if anchor not in like:
        raise SystemExit('missing liked ids anchor')
    like = like.replace(anchor, helper + anchor, 1)

    old_tail = """  persistLikeOutbox(user.uid, outbox);
  // 094: ordinary browsing is local-only. The only automatic flush inside the
  // Explore session is the hard 50-change batch ceiling.
  if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {
    void flushPendingLikes(user);
  }
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
"""
    new_tail = """  persistLikeOutbox(user.uid, outbox);
  // 104: start one five-minute server aggregate window on the first real
  // change, then keep later clicks local until the single near-deadline flush.
  // This preserves idle=0 and avoids one server request per click.
  const startedEventWindow104 = beginExploreLikeEventWindow104(user, now);
  if (startedEventWindow104) {
    void flushPendingLikes(user);
  } else if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {
    void flushPendingLikes(user);
  }
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
"""
    if old_tail not in like:
        raise SystemExit('missing local-only tail anchor')
    like = like.replace(old_tail, new_tail, 1)

if 'SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916' not in page:
    old_block = """// SORIDRAW_EXPLORE_LIKE_AGGREGATE_AUTO_REFRESH_070_20260912
// Revalidate once after the next 10-minute aggregate window. The extra grace
// covers the revision endpoint's short edge cache without polling.
const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070 = 10 * 60_000;
const EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070 = 70_000;
"""
    new_block = """// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916
// 103 aggregates five minutes after the first server batch. The actor browser
// performs one forced fresh Feed refresh just after that window; there is no
// periodic polling and no wall-clock 10-minute boundary anymore.
const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 * 60_000;
const EXPLORE_LIKE_REFRESH_GRACE_MS_104 = 10_000;
"""
    if old_block not in page:
        raise SystemExit('missing old aggregate refresh block')
    page = page.replace(old_block, new_block, 1)

    old_formula = """      const now = Date.now();
      const nextAggregateAt = Math.ceil((now + 1000) / EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070)
        * EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070;
      const deadline = nextAggregateAt + EXPLORE_LIKE_REVISION_CACHE_GRACE_MS_070;
"""
    new_formula = """      const now = Date.now();
      const deadline = now + EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 + EXPLORE_LIKE_REFRESH_GRACE_MS_104;
"""
    if old_formula not in page:
        raise SystemExit('missing old wall-clock deadline formula')
    page = page.replace(old_formula, new_formula, 1)

like_path.write_text(like, encoding='utf-8')
page_path.write_text(page, encoding='utf-8')

version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '104'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

state = state_path.read_text(encoding='utf-8')
latest_marker = '## 0. PREVIEW 104 — 103 실사용 실패 후 즉시 수정/재배포'
if latest_marker not in state:
    intro = '> 새 채팅은 이 문서 + 실제 GitHub/Firebase/Cloudflare 상태를 기준으로 이어간다. 문서와 실제 상태가 다르면 실제 상태 우선.\n\n'
    block = """## 0. PREVIEW 104 — 103 실사용 실패 후 즉시 수정/재배포
- 2026-09-16 실사용에서 Master는 공개 좋아요 1, 다른 Admin은 5분 후에도 0으로 남는 현상 확인.
- 원인 1: 103 클라이언트가 일반 Explore 체류 중에는 좋아요 outbox를 서버로 보내지 않아, 페이지 경계/50개 전에는 서버의 5분 타이머 자체가 시작되지 않았음.
- 원인 2: `ExplorePage.tsx`에 이전 10분 wall-clock aggregate refresh 기준이 남아 있었음.
- 104 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`.
- 104 수정: 첫 실제 좋아요 변경에서 서버 5분 aggregate 창을 1회 시작하고, 같은 창의 후속 클릭은 로컬에 모은 뒤 마감 15초 전에 최종 상태만 한 번 더 flush. 50개 ceiling/page boundary는 기존 안전장치 유지.
- 104 수정: actor 강제 fresh Feed refresh를 `5분 + 10초` 기준으로 변경하고 이전 10분 wall-clock 계산 제거.
- 104 source apply Run `35052705770` PASS: verifier / TypeScript / Build / change boundary PASS.
- PREVIEW Hosting 104 배포 Run `35052825886` PASS. 실제 `preview.soridraw.com` 앱 버전 104.
- PREVIEW Explore Worker는 103 event scheduler 배포본 `0287b2ef-6445-47a4-afd9-6058f02706cc` 유지. 고정 10분 cron 없음.
- TEST/PRODUCTION 비변경. Firebase Functions/Rules, D1 schema/migration, RTDB Rules, 사용자 원본 데이터 변경 없음.
- 주의: 다른 계정의 **완전히 가만히 있는 열린 탭**은 비용 0 원칙 때문에 주기 polling하지 않는다. 5분 이후 해당 계정이 Explore 재진입/포커스/실제 상호작용하면 zero-D1 revision 경로로 최신 공개 숫자를 확인해야 한다.
- 상태: **104 PREVIEW 배포 완료, Master/Admin 교차계정 재검증 필요. TEST 승격 금지.**
- 아래 102/103의 “미배포” 문구는 당시 기록이며 이 0번 항목이 최신 실제 상태다.

"""
    if intro not in state:
        raise SystemExit('missing CURRENT_RELEASE_STATE intro anchor')
    state = state.replace(intro, intro + block, 1)

state = state.replace('- 현재 `preview` 제품 코드 후보: **103**', '- 현재 `preview` 제품 코드 후보: **104**', 1)
if '- 104 first-like 5분 창 수정 제품 commit:' not in state:
    state = state.replace('- 103 Explore event-driven 5분 좋아요 묶음 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`', '- 103 Explore event-driven 5분 좋아요 묶음 제품 commit: `04b9829318b45637685549bb2160fb080c1068e0`\n- 104 first-like 5분 창 수정 제품 commit: `6073e840cd581a24e8f40012acec2776a85fa3b6`', 1)
state = state.replace('- 실제 PREVIEW 앱: **101** — `https://preview.soridraw.com` — 102 아직 미배포', '- 실제 PREVIEW 앱: **104** — `https://preview.soridraw.com` — Run `35052825886` PASS', 1)
state = state.replace('- 실제 PREVIEW Explore Worker: 기존 **056** / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 102 parity 코드 아직 미배포', '- 실제 PREVIEW Explore Worker: **103 event scheduler** / `0287b2ef-6445-47a4-afd9-6058f02706cc` — 고정 10분 cron 제거 완료', 1)
state = state.replace('- **릴리스 상태: 103 코드/자동검증 PASS, PREVIEW 미배포·실사용 검증 전. TEST 승격 금지.**', '- **릴리스 상태: 104 PREVIEW 배포 완료, 교차계정 공개 좋아요 재검증 전. TEST 승격 금지.**', 1)
state_path.write_text(state, encoding='utf-8')
