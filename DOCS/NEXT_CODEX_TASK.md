# NEXT CODEX TASK

상태: **PREVIEW app 063 — 업데이트 알림 + PC/모바일 복귀 zero-read 실사용 PASS 완료**

## 현재 기준
- branch: `preview`
- PREVIEW app: `063`
- 063 기능 source: `6b7a130ff9dfa373e67fdac4ce2b75c103434f56`
- 063 release trigger/deploy checkout: `762ed77b00e5d4fc149b5ee935a46712b02602fc`
- PREVIEW app Run: `34568279072` — PASS
- 062 zero-read source: `1d82c595c10bdd3d3c19074e3e31210d76774dde`
- PREVIEW Worker: 035 deferred like aggregate + 037 one-row revision head 유지
- Worker active Version: `4236894d-b1ab-4181-9dc3-27621624595b`
- Shared D1 035 schema Run: `34511788949` — PASS
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — unchanged
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — unchanged
- 실제 URL: `https://preview.soridraw.com/`

## 실사용 PASS 확정
- 실행 중 구버전 `새 업데이트 · 적용` 자동 표시 PASS.
- 새 버전 첫 실행 `업데이트 완료 · 063` 1회 표시 PASS.
- 같은 063 재실행 시 완료 알림 비반복 PASS.
- PC Explore 반복 재진입/창복귀: 10분 freshness window 내 `LOCAL REVISION CACHE`만 증가, 추가 Worker/D1 read 0 PASS.
- 모바일 홈/전원 후 앱/Explore 복귀: `LOCAL`만 1씩 증가, 추가 Worker/D1 read 0 PASS.
- 기존 PC↔모바일 좋아요/해제 개인 하트 동기화 PASS 유지.

## 다음 작업 목표
좋아요 실제 변경 비용을 더 줄일 수 있는지 분석한다. 현재 실측 기준:
- 1곡 likes batch: 대략 D1 `R3 / W3`.
- 3곡 likes batch: D1 `R9 / W3`.
- 쓰기 3은 batch 1회당 고정 패턴으로 보이고, 읽기는 곡 수에 비례하는 패턴.
- Browser SDK `users:onSnapshot` read 누적 구성과 모바일 좋아요 비용은 아직 정확한 분해가 필요함.

## Codex 작업 범위
1. `/v1/me/likes/batch`의 D1 `R3/W3` 구성요소를 정확히 분해.
2. 1곡/3곡에서 왜 read가 곡당 약 3씩 증가하고 write는 batch당 3으로 보이는지 코드 기준으로 증명.
3. 전체 Feed/Profile 재조회 없이 read/write를 더 줄일 수 있는지 설계.
4. 058 같은 계정 PC↔모바일 개인 하트 동기화 구조와 035 deferred public aggregate를 보호.
5. Browser SDK `users:onSnapshot` read가 좋아요 signal 때문에 얼마 증가하는지 분리 계측 가능한 진단 방법 제시.
6. 모바일 좋아요/해제 비용도 동일 기준으로 측정할 수 있게 한다.
7. 100,000 DAU × 30 likes/day 기준 월비용을 현재 구조와 개선안으로 비교.
8. 데이터 migration/backfill/delete 없이 하위호환 방식만 사용.
9. 배포는 사용자 승인 없이는 하지 않음.

## 합격선
- 좋아요 1개 변경 때문에 Feed/Profile 전체 read/rebuild 없음.
- unchanged navigation/update/re-entry server data read 0 원칙 유지.
- PC↔모바일 개인 하트 동기화 회귀 없음.
- public like count의 deferred aggregate 구조 유지 또는 더 저렴한 동등 구조.
- Firestore/D1/Worker 비용이 정확히 계측 가능해야 함.
- UI/반응형/간격/색상 변경 없음.
- TEST/PRODUCTION 영향 없음.

## 현재 판정
- TypeScript: PASS.
- Build: PASS.
- Firebase PREVIEW Hosting: PASS.
- exact build/version 063: PASS.
- TEST/PRODUCTION unchanged: PASS.
- 063 update notices: **사용자 실사용 PASS**.
- 062 PC/mobile resume zero-read: **사용자 실사용 PASS**.
- 이번 PREVIEW 검증 범위: **완료**.
- TEST promotion: 사용자가 `테스트배포`를 요청할 때만 진행.

## 운영 위험
- GitHub `preview`, `main`, `production` branch protection이 실제로 비활성 상태. 이번 기능과 별개인 기존 운영 위험.
- 작업 branch `preview-062-explore-resume-zero-read`, `preview-063-update-complete-notice`는 preview에 포함됐지만 현재 연결 도구에서 branch 삭제 기능이 없어 남아 있음.
