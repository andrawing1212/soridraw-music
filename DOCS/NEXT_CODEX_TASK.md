# NEXT CODEX TASK

상태: **실제 PREVIEW 099 / 100 liked-card retention 후보 수정·검증 완료·미배포 / TEST 승격 금지**

## 현재 기준
- branch: `preview`
- 실제 PREVIEW 앱: **099**
- 099 PREVIEW 배포 source SHA: `78aeeb67dbb7df447fc0ab87b5af6fc212fc95d6`
- 099 App Release Run: `35003738667` — PASS
- 100 제품 수정 commit: `eef460f5024fab3a4ff6ad4e665c132aae0b69fa`
- 100 verifier commit: `3dd5c60ca2531e6c8fad2c062de0c18784a455d4`
- 100 최종 감사 Run: `35031690795` — PASS
- 100 배포: **미배포**
- PREVIEW Explore Worker: 056 / `bd8a810f-8266-41e1-80a1-0c5e9bfc561a` — 변경 없음
- PREVIEW Media Worker: `a00276d5-aca1-443f-a992-0b80ca0637ff` — 변경 없음
- TEST main: `3b574c05589230f077eceff98190edd4b5195f75` — 변경 없음
- PRODUCTION: `a8971fae1014ce107927fcfb5491d202d4c68fbe` — 변경 없음

## 099 실사용에서 새로 확정된 문제
PC/모바일에서 `내 좋아요곡` 진입 시:
- LOCAL 0 / Worker 1
- D1 Query R1
- Rows Read R12
가 재현됐다.

099는 098의 `canonicalLikedTrackIds` 전체 무효화/재확인 문제는 막았지만, 이전 좋아요 해제/재좋아요 테스트 과정에서 카드 payload 자체가 삭제되어 있었다.

정확한 원인:
- unlike 시 `patchExploreLikedTrackMembership()`이 cached card item 삭제.
- same-device `rememberExploreLikedTrack(..., false)`도 card item 삭제.
- liked-page loader도 현재 비좋아요 item을 pruning.
- 이후 다른 기기에서 re-like하면 RTDB는 membership/heart/count는 전달하지만 title/image/owner 등 card payload는 전달하지 않음.
- canonical liked ID는 있는데 card item이 없는 상태가 되어 `/v1/me/liked-tracks` targeted hydration 발생.
- 이번 실측에서 missing card 12개 → D1 Rows Read 12.

앱 update 동작은 reload일 뿐 localStorage 삭제가 아니며, cache key도 app version과 무관하다. 따라서 R12의 직접 원인은 **업데이트가 아니라 unlike 시 재사용 가능한 card payload 삭제**다.

## 100 수정
- unlike 시 card payload 즉시 삭제 금지.
- 최근 unlike card는 `dormantSince`와 함께 기기에 보존.
- re-like 시 기존 card를 즉시 재사용.
- liked-page entry에서 현재 비좋아요 card payload 전체 pruning 제거.
- dormant card는 최대 **100곡 / 7일**만 보존해 localStorage 증가 제한.
- 오래됐거나 max100 초과 dormant card만 로컬 정리.
- cache schema version은 **1 유지**하여 100 업데이트가 기존 099 card cache를 무효화하지 않음.
- 진짜 새 기기/캐시 삭제/한 번도 payload가 없던 remote-like 곡은 기존 targeted missing-card recovery 허용.

변경 파일:
- `src/services/exploreLikedTracksService.ts`
- `scripts/verify-100-liked-card-retention.mjs`

변경 없음:
- UI / pages / CSS
- Explore Worker / Media Worker
- Functions / RTDB Rules / Firestore Rules
- D1 schema/migration/seed
- 사용자 원본 데이터

## 검증
첫 Run `35031459971`은 TypeScript/Build/085~100 verifier가 모두 PASS 후, 마지막 cost fixture가 Node 20의 `node:sqlite` 미지원으로만 FAIL. 제품 오류 아님.

최종 Run `35031690795` PASS:
- TypeScript PASS
- Build PASS
- 085 / 086 / 087 PASS
- 094~100 좋아요 회귀 PASS
- Node 24 like-cost fixture PASS
- backend/UI exact scope guard PASS

검증용 임시 Workflow는 삭제 완료.

## 배포 승인 시 작업
사용자가 PREVIEW 배포를 명확히 요청하면:
1. `public/app-version.json`을 100으로 bump.
2. canonical `.github/workflows/firebase-hosting-custom-preview.yml` 경로로 Firebase PREVIEW Hosting만 배포.
3. Explore Worker/Functions/Rules/D1은 변경 없으므로 재배포 금지.
4. 실제 `preview.soridraw.com` exact build + `app-version.json=100` 확인.
5. TEST/PRODUCTION branch/Hosting 비변경 확인.

## 배포 후 실측
1. PC/모바일 모두 캐시 삭제 금지.
2. CACHE LIVE 초기화.
3. 현재 099에서 이미 hydration된 `내 좋아요곡` 진입 → D1 Rows Read 0 확인.
4. PC에서 3~5곡 unlike → boundary → re-like → boundary.
5. 모바일 하트/숫자 수렴 확인.
6. PC/모바일 각각 `내 좋아요곡` 진입 → 기존 card payload 재사용, D1 Rows Read 0 확인.
7. 모바일→PC 방향도 반대로 반복.
8. Explore 내부 탭 이동만으로 like request/write 0.
9. Firestore Explore-like sync read/write 0.
10. Cloudflare D1 Rows read/written과 CACHE LIVE 대조.

## 정상 예외
- 새 기기
- 실제 캐시 삭제/손상
- 이 기기에서 한 번도 card payload를 받은 적 없는 곡이 다른 기기에서 새로 좋아요된 경우

이때만 bounded targeted missing-card read는 허용. 정상 update/re-entry/unlike→re-like 반복 비용과 구분한다.

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
