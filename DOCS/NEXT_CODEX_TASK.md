# NEXT CODEX TASK

상태: **PREVIEW 100 배포 완료 / 자동검증 PASS / liked-card zero-read·PC↔모바일 실사용 비용 검증 남음 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **100**
- 100 제품 수정 commit: `eef460f5024fab3a4ff6ad4e665c132aae0b69fa`
- 100 verifier commit: `3dd5c60ca2531e6c8fad2c062de0c18784a455d4`
- 100 version bump commit: `5f19e3f2c46a7f25e43ee22af8cd6bd15ae94961`
- 100 PREVIEW 배포 source SHA: `28a49b881e86f9f3ef752ed66e33d48a576bfe13`
- 100 최종 감사 Run: `35031690795` — PASS
- 100 App Release Run: `35033032795` — PASS
- PREVIEW Explore Worker: 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 배포 Workflow 기준 비변경 PASS
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 배포 Workflow 기준 비변경 PASS

## 099 실사용에서 확정된 문제
`내 좋아요곡` 진입 시 LOCAL 0 / Worker 1 / D1 Query R1 / Rows Read R12가 재현됐다.

원인:
- unlike 시 cached card payload를 삭제.
- 다른 기기 re-like 때 RTDB는 membership/heart/count만 전달하고 title/image/owner card payload는 전달하지 않음.
- canonical liked ID는 있지만 card item이 없는 곡만 `/v1/me/liked-tracks` targeted hydration.
- 실측 missing card 12개 → D1 Rows Read 12.

즉 앱 update 자체가 아니라 **unlike 때 재사용 가능한 card payload를 파괴한 것**이 직접 원인.

## 100 수정
- unlike 시 card payload 즉시 삭제 금지.
- 최근 unlike card는 `dormantSince`와 함께 기기에 보존.
- re-like 시 기존 card 즉시 재사용.
- liked-page entry에서 현재 비좋아요 card 전체 pruning 제거.
- dormant card 최대 **100곡 / 7일** bounded retention.
- cache schema version **1 유지** → 100 update가 기존 099 cache를 무효화하지 않음.
- 새 기기/실제 캐시 삭제·손상/한 번도 payload가 없던 remote-like만 targeted missing-card recovery 허용.

변경 파일:
- `src/services/exploreLikedTracksService.ts`
- `scripts/verify-100-liked-card-retention.mjs`

변경 없음:
- UI / pages / CSS
- Explore Worker / Media Worker
- Functions / RTDB Rules / Firestore Rules
- D1 schema/migration/seed
- 사용자 원본 데이터

## 자동검증
최종 Run `35031690795` PASS:
- TypeScript / Build PASS
- 085 / 086 / 087 PASS
- 094~100 좋아요 회귀 PASS
- Node 24 Explore like cost fixture PASS
- backend/UI exact scope guard PASS

## 배포 결과
Run `35033032795` PASS:
- locked source `28a49b881e86f9f3ef752ed66e33d48a576bfe13`
- Install / TypeScript / Build PASS
- Firebase PREVIEW Hosting 배포 PASS
- `preview.soridraw.com` exact build PASS
- 실제 `app-version.json=100` PASS
- TEST / PRODUCTION branch + Hosting 비변경 PASS
- Worker / Functions / RTDB Rules / Firestore Rules / D1 schema 재배포 없음
- 사용자 데이터 migration/backfill/delete/overwrite 없음

## 다음 실측
1. PC/모바일 모두 **캐시 삭제 금지**.
2. 100 업데이트 적용 후 CACHE LIVE 초기화.
3. 현재 hydration된 `내 좋아요곡` 진입 → `/v1/me/liked-tracks` D1 Rows Read 0 확인.
4. PC에서 3~5곡 unlike → boundary → re-like → boundary.
5. 모바일 heart/count 수렴 확인.
6. PC/모바일 각각 `내 좋아요곡` 진입 → 기존 card payload 재사용, D1 Rows Read 0 확인.
7. 모바일→PC 방향도 반대로 반복.
8. Explore 추천/최신/인기 이동만으로 like server request/write 0.
9. Firestore Explore-like sync read/write 0.
10. Cloudflare D1 Rows read/written과 CACHE LIVE 대조.

## 정상 예외
- 새 기기
- 실제 캐시 삭제/손상
- 해당 기기에서 한 번도 card payload를 받은 적 없는 곡의 remote-like

이 경우만 bounded targeted missing-card read 허용.

## 합격선
- 기존 payload가 있던 곡의 unlike→re-like 후 `내 좋아요곡` D1 Rows Read 0.
- update만으로 membership/card cache 초기화 없음.
- PC↔모바일 heart/count 동일 수렴.
- ordinary Explore browsing = like server request/write 0.
- 전체 liked-list / Feed / tracks scan 없음.

## 승격 금지
- 100 PREVIEW 실사용 zero-read + PC↔mobile 정확성 + Cloudflare 비용 실측 PASS 전 TEST 승격 금지.
- PRODUCTION은 사용자 명확한 정식배포 승인 전 금지.
- 사용자 데이터 복사/백필/전체 재생성 금지.
