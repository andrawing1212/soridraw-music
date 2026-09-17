# SORIDRAW NEXT CODEX TASK

최종 갱신: 2026-09-17 KST — 앱 116 PREVIEW 실사용 PASS / 승격 불변조건 감사 PASS / TEST 배포 전

## 현재 기준

- PREVIEW branch: `preview`
- PREVIEW app: **116**
- PREVIEW 앱 116 배포 기준: `5df12009e46ab65ab7c3f95cb686926907c4c0d8`
- 3단계 Release System 불변조건 감사 기준: `ea9d20e8dfbba189e678ce1ae9433e5471f85ad5`
- Release System Audit Run: `35211720327` SUCCESS
- TEST `main`: `bb1305660ca694dd057f3ed4184bdafea60f5b18` — 기존 앱 110
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 비변경
- 현재 TEST/PRODUCTION 승격 실행 없음
- 사용자 데이터 migration/backfill/delete 없음

## 이번에 고정된 승격 불변조건

TEST 배포 성공은 단순 Build/Hosting 성공이 아니다.

반드시:
- exact PREVIEW tree를 TEST로 승격
- TEST `DB` = shared canonical `soridraw-explore-db`
- TEST `PROFILE_MEDIA` = shared `soridraw-profile-media`
- TEST latest/popular revision = PREVIEW
- TEST latest/popular shared snapshot = PREVIEW
- TEST latest/popular 직접 Feed 공개 projection = PREVIEW
- TEST 공개프로필 projection = PREVIEW
- revision/shared snapshot/public-profile 검증에서 D1 불필요 read/write 0 계약
- 환경 캐시가 오래됐으면 최대 약 60초 자동 수렴
- 끝까지 다르면 FAIL + 이전 Worker 자동 rollback 시도 + 다음 단계 중단

PRODUCTION은 같은 방식으로 **검증된 TEST**와 비교한다.
PRODUCTION이 TEST와 같지 않으면 성공 처리하지 않는다.

## 다음 작업

현재 구현 작업은 없다.

사용자가 `테스트배포`를 명확히 요청하면 기존 고정 Workflow `.github/workflows/soridraw-release-promotion.yml`로 한 번에 진행한다.

순서:
1. 그 시점의 검증된 PREVIEW exact SHA 고정
2. TypeScript / Build / static release guard
3. TEST/PRODUCTION live binding dry-run + shared D1 read-only preflight
4. exact tree → `main` forward promotion
5. TEST Worker 배포
6. 새 PREVIEW↔TEST environment parity gate
7. PASS한 경우에만 Firebase TEST Hosting 배포
8. `test.soridraw.com` exact build/app-version/CORS 확인
9. PRODUCTION 비변경 확인

실패하면 원인을 숨기고 재배포를 반복하지 않는다. parity gate가 실패하면 자동 rollback 후 중단한다.

## TEST 실사용 확인 항목

자동 gate PASS 뒤 사용자 확인:
- PC/모바일 추천/최신/인기 동일 공개 숫자
- 공개프로필 동일 숫자
- 같은 계정 PC↔모바일 heart membership
- 좋아요/좋아요 해제 약 1분 event batch 수렴
- 공개/비공개/팔로우/프로필 수정 변경분만 반영
- Explore/Public Profile warm 재진입 비용
- Music Note 60초 묶음 저장 유지
- Library Local First 유지
- UI/반응형 PREVIEW와 동일

## PRODUCTION

아직 승인 없음.

사용자가 명확히 `정식배포`를 승인한 경우에만 검증된 TEST 동일 tree를 PRODUCTION으로 승격한다.
그때 PRODUCTION Worker는 TEST와 같은 revision/Feed/public-profile parity gate를 통과해야 하고, 실패하면 정식배포 성공으로 보고하지 않는다.

사용자 원본 데이터는 이동/복제하지 않는다.
