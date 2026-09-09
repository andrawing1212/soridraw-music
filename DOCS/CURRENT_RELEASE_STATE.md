# SORIDRAW CURRENT RELEASE STATE

최종 갱신: 2026-09-10 KST

> **새 채팅의 현재 기준 문서. 과거 채팅 설명보다 이 문서 + GitHub/실제 배포 상태를 우선한다.**

## 1. 현재 소스 기준
- Repository: `andrawing1212/soridraw-music`
- PREVIEW branch: `preview`
- PREVIEW 마지막 앱 코드 변경 기준 commit: `2819dcf57904a8db7222a89c18965c28b94da60a`
- 이후 `preview`에는 인수인계/비용 가드레일 문서 commit이 추가되어 있으므로 **작업 시작 시 실제 `preview` HEAD를 반드시 다시 고정**한다.
- TEST branch: `main`
- TEST 앱 코드 기준 commit: `3b574c05589230f077eceff98190edd4b5195f75`
- 052 앱 코드 source tree: `8a41bf58041edf6ba304295e0a364595494baae5` — PREVIEW/TEST 동일
- 앱 버전: `052`
- 앱 버전 원본은 `public/app-version.json` 하나로 통일됨. `appUpdateNotice.ts` 하드코딩 버전 제거 완료.
- 현재 문서 정리 commit들은 앱 실행 코드를 변경하지 않는다.

## 2. 현재 배포 상태
- PREVIEW 052: Firebase 배포/검증 완료
- TEST 052: Firebase 배포/실제 번들 검증 완료
- TEST 브랜딩/아이콘: 승인된 TEST 042 브랜딩 유지
- Explore PREVIEW/TEST: 최신 Feed 30곡 일치 검증됨
- PRODUCTION: 051/052 작업으로 앱/Hosting/Worker를 승격하지 않음. 정식배포 승인 없음.
- Functions / Firestore Rules: 052 업데이트 알림 수정에서 변경 없음

## 3. 현재 데이터 운영 구조
사용자 의도는 **데이터 공유 + 기능 코드 단계별 승격**이다.

- PREVIEW / TEST / PRODUCTION: 코드/Worker/Hosting 버전은 분리
- Music Note 사용자 데이터: 같은 사용자 데이터 공유
- Explore 사용자 원본 데이터: 공유 Canonical D1/R2 기준으로 전환됨
- Explore 환경별: Worker/Feed 파생 Cache/속도제한/진단은 분리
- PREVIEW→TEST→PRODUCTION 승격의 핵심은 데이터 복제가 아니라 **기능 코드 승격**

## 4. 현재 확인된 중요 문제 — 다음 최우선
### A. Explore Feed 비용 문제
CACHE LIVE 실사용에서 좋아요/공개프로필 조작 후 D1 행 읽기가 크게 증가함.
관찰 예: 전체 449행 읽기 중 `/v1/feed-revision`이 421행을 차지.

현재 원인:
- 공유 데이터 전환용 `031-explore-shared-canonical-data.mjs`가 `/feed-revision` 앞에서 공유 revision과 환경별 Feed Cache 상태를 비교함.
- 상태가 다르면 `latest + popular` Feed를 D1에서 다시 만들어 R2에 저장함.
- 따라서 작은 좋아요 변경도 다음 revision 확인에서 전체 Feed 재생성으로 이어질 수 있음.

판정: **비용 구조 버그. 수정 필요.**

### B. 공개프로필 업데이트 후 최초 읽기 문제
`exploreProfileFirstViewService.ts`의 캐시 스키마 6 전환 후 캐시가 없으면 `__soridraw_shared_profile=51`을 붙여 공유 D1에서 공개프로필을 다시 materialize하도록 되어 있음.

판정:
- 과거 PC/모바일 공개프로필 숫자 불일치를 복구하기 위해 051에서 넣은 일회성 안전장치였음.
- 그러나 10만 사용자가 앱 업데이트 후 각자 최초 1회 DB 읽기를 일으키는 방식은 장기 운영 기준에 맞지 않음.
- **앱 버전 업데이트와 데이터 캐시 재생성을 분리해야 함.**

## 5. 다음 구조의 절대 목표
사용자가 앱을 열거나 업데이트했다는 이유만으로 서버 데이터 비용이 생기지 않게 한다.

합격 기준:
- 앱 업데이트 후 기존 정상 캐시 사용자: D1 data read 0 / Firestore data read 0
- Explore 재진입, 데이터 변경 없음: D1 data read 0 목표
- 공개프로필 재진입, 데이터 변경 없음: D1 data read 0 목표
- 좋아요 1회: 전체 Feed scan/rebuild 0, 관련 항목만 처리
- 공개/비공개 1곡: 전체 Feed/전체 공개프로필 scan 0, 관련 항목만 처리
- 사용자 수/전체 곡 수가 늘어날수록 한 mutation 비용이 함께 커지는 구조 금지

## 6. Music Note 현재 보호 기준
현재 정상 동작을 보호한다.
- 사용자 편집은 로컬 즉시 반영
- 여러 필드 수정은 약 60초 동안 묶어서 서버 반영
- 종료/백그라운드 시 남은 변경을 안전하게 마무리
- 페이지 이동/재진입만으로 불필요한 서버 write 금지

향후 기기간 빠른 동기화는 적용 가능하지만 **이번 Explore 비용 수정과 섞지 않는다.** 별도 단계에서 '변경 있음 신호 → 변경분만 가져오기' 방식으로 설계한다.

## 7. 지금부터의 작업 순서
1. Codex가 `DOCS/NEXT_CODEX_TASK.md` 기준으로 PREVIEW에서 Explore/공개프로필 비용 구조를 수정
2. Codex가 TypeScript/Build/관련 테스트 후 commit SHA 제출
3. Work가 `DOCS/WORK_AUDIT_CHECKLIST.md` 기준으로 그 commit을 수정 없이 독립 감사
4. ChatGPT가 GitHub + 실제 PREVIEW 상태를 최종 확인
5. 사용자가 PREVIEW 배포를 승인하면 ChatGPT가 PREVIEW 배포/실주소 검증
6. 사용자 실사용 PREVIEW 테스트
7. 통과하면 사용자 요청으로 TEST 승격
8. PRODUCTION은 별도 명확한 승인 전 금지

## 8. 현재 Codex 실행 기준
- 권장: **GPT-6 Astra Medium**
- 배포 금지
- 분석 → 구현 → 관련 검증 → 최종 TypeScript/Build/Test → commit
- 사용량 절약 규칙: `DOCS/CODEX_USAGE_BUDGET.md`
- 같은 저장소 전체/과거 로그를 반복 재분석하지 않는다.
- FCM/WebSocket/새 외부 서비스는 이번 작업에 도입하지 않는다.
- migration/데이터 손실/하위호환 불가/반복 실패가 나오면 높은 추론으로 밀어붙이지 말고 중단 후 보고한다.

## 9. 이번 단계에서 건드리면 안 되는 것
- Music Note 60초 묶음 저장 정상 경로
- 기존 UI/반응형/간격/색상
- 공유 Canonical 사용자 데이터 자체의 삭제/대량변환
- PRODUCTION 앱/Hosting/Worker
- 필요 없는 Functions/Rules 재배포
- 신규 실시간 인프라(FCM/WebSocket 등)

## 10. 문서 유지 규칙
작업 완료/실패/롤백/배포로 상태가 달라지면 **같은 작업 안에서 이 파일을 갱신하고 commit**한다.
문서에 적힌 commit이 문서-only commit 때문에 실제 HEAD보다 과거일 수 있으므로, `마지막 앱 코드 변경 기준`과 `실제 preview HEAD`를 구분한다.
새 채팅에서 사용자가 과거 작업을 다시 설명하게 하지 않는다.

## 10. 2026-09-10 Codex 비용 경로 감사 — 구현 중단, 배포 전

- 작업 기준: `preview @ 35a036040bcc704352cb999baea08d25a505d638`.
- `NEXT_CODEX_TASK.md`의 복잡한 동시성 안전성 검토/중단 조건 적용. 비용 수정은 미완료이며 다음 배포 승인 대상으로 취급하지 않는다.
- 이번/누적 변경 파일: `DOCS/CURRENT_RELEASE_STATE.md`만. 실행 코드, 버전 052, 캐시 schema 6, 환경 선택 및 공유 binding은 변경하지 않았다.

### 확인한 호출 흐름

| 경로 | 현재 동작 / 문제 |
|---|---|
| `/feed-revision` | 031 shared revision 비교 → 불일치 시 latest/popular build + 상태 저장 → 030 integrity 검사 → 019 R2 HEAD. 030은 현재도 실행 가능한 중첩 경로다. |
| profile cold request | frontend가 `__soridraw_shared_profile=51` 전송 → 031 materialize → 020 R2/Edge first-view. 앱 버전 자체는 캐시 키에 포함되지 않지만 cold 요청마다 복구가 강제된다. |
| like | 028 D1 관계/카운터 변경 → 020 profile R2 부분 갱신 + 009 feed R2 부분 갱신. feed는 현재 목록에 있는 ID만 수정한다. |
| publish/private/options | 019/020 profile R2 부분 갱신 존재. 조건 없는 read-modify-write이며 profile 카운트도 이전 bundle에서 계산한다. |
| profile snapshot write | 010 writePublicProfileFirstViewSnapshot wrapper → 020 syncExploreProfileR2FromD1 → bounded profile window 재조회. 함수 이름과 달리 항상 부분 갱신인 것은 아니다. |
| 환경 간 변경 | 031은 global revision 값만 읽고 환경별 EXPLORE_CACHE를 재구축한다. 020 mirror fanout/route는 031에서 no-op 처리되어 변경 ID 전달 경로로 쓸 수 없다. |

### 중단 근거와 재현 결과

실제 저장소 patch의 `helpers` template을 Node VM에서 평가하고 R2/D1을 메모리 mock으로 대체했다. 실제 서버/사용자 데이터에는 접근하지 않았다.

1. `patchExploreFeedR2LikeCount`에 서로 다른 두 ID의 좋아요 변경을 `Promise.all`로 실행: 최초 `[a:0,b:0]`가 `[a:0,b:1]`로 끝났다. 두 변경 중 하나가 파생 cache에서 유실된다. canonical 좋아요 데이터 삭제를 재현한 것은 아니다.
2. 현재 popular snapshot 밖 ID에 likeCount 100 적용: 인기 목록에 진입하지 않았다. 기존 목록의 정렬만으로 경계 밖 순위 진입/경계 안 하락 후 refill을 보장할 수 없다.
3. `ensureExploreSharedFeedCache031`의 state revision 1 / canonical revision 2 조건: revision SELECT 1회, feed builder 2회, R2 write 3회 재현. 실제 feed SQL의 rows_read 수는 mock에서 측정하지 않았다.

따라서 030/031 재구축만 지우고 기존 R2 delta를 유지하는 변경은 승인된 데이터 일관성 조건을 충족하지 못한다. 특히 preview 코드만 변경하는 동안 기존 TEST/PRODUCTION writer가 공유 canonical을 변경하는 경우까지 포함한 안전한 변경 전달 계약을 먼저 결정해야 한다. 새 schema나 인프라가 반드시 필요하다고 단정한 것은 아니며, 이번 범위에서 이를 임의로 추가하지 않았다.

필요한 최소 후속 설계 검토:
- 기존 writer까지 포함하는 durable 변경 ID/version 전달 방식과 환경별 cache 소비 cursor. 기존 global revision 하나만으로는 바뀐 ID를 알아낼 수 없다.
- R2 delta의 충돌 검출/재시도 및 오래된 mutation 응답 덮어쓰기 방지. 단순 무조건 put 금지.
- popular 경계 밖 진입 및 삭제/하락 refill에 사용할 bounded indexed 조회 계약. `LIMIT`만 붙여 실제 rows_read가 제한된다고 간주하지 않는다.
- 위 계약이 정해진 뒤 read 경로 재구축 제거, 정상 profile snapshot 재사용, mutation snapshot 부분 갱신을 함께 검증한다. migration/backfill이나 TEST/PRODUCTION 수정이 필요해지면 별도 검토한다.

### 실행 검증

- `verify-033-explore-feed-revision.mjs`: PASS.
- `verify-045-explore-active-revalidation.mjs`: PASS.
- `verify-048-explore-public-profile-parity.mjs`: FAIL — schema 5를 요구하지만 현재 6.
- `verify-049-explore-feed-integrity.mjs`: FAIL — 앱 049를 요구하지만 현재 052.
- `verify-051-explore-shared-canonical-data.mjs`: FAIL — 앱 051을 요구하지만 현재 052.
- 019 revision / 019 publication delta / 020 profile repair / 030 / 031 patch `node --check`: 모두 PASS.
- 메모리 mock 결함 재현 3건: 모두 재현됨. 이는 비용/정합성 합격을 뜻하지 않는다.
- 전체 TypeScript/build, 최종 Worker patch replay, 실제 D1 비용/환경 간 기능 검증: 미실행. 구현 중단 및 문서만 변경했으므로 최종 후보 검증을 수행하지 않았다.
- Firebase/Cloudflare 배포, DB 변경, main/Production 수정: 없음. 실제 주소 smoke test 없음.
