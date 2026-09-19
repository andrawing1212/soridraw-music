# SORIDRAW Deployment Progress

> 상세 현재 상태의 단일 기준은 `DOCS/CURRENT_RELEASE_STATE.md`다. 이 파일은 배포 관점 요약이다.

최종 갱신: 2026-09-20 KST

## 현재 실제 릴리스
- PREVIEW 앱: **124**, Hosting 재배포 없이 기존 Firebase PREVIEW 유지.
- PREVIEW Worker: **069/070 shared Feed targeted parity + legacy full-snapshot writer guard**.
- PREVIEW Worker Version ID: `f0a910a4-104e-47f7-8e3b-2c2c6454d8cf`.
- PREVIEW Worker release source: `dc95856ad8299b3ed8746b2fd4d2dbdd574cda4b`.
- PREVIEW Worker Release Run: `35457463038` PASS.
- postflight Run: `35457550389` PASS.
- TEST Worker: `6e8dca9c-2c58-42ea-ae7d-765e10afef8f` — 비변경.
- PRODUCTION Worker: `d6b0a284-6e3c-4b57-aebf-0a7d1c3513e0` — 비변경.
- Firebase Hosting / Functions / Rules 변경 없음.
- 사용자 원본 데이터 변경 없음.

## PREVIEW 069/070 배포 결과
- canonical Worker SHA256: `91d154aaa9524dbf1349d48d0d14eadd09738602f103fedfbcf360270c340000`.
- release preflight PASS: like schema/state, publication PK index, Worker hash, dry-run.
- pre-deploy pending like queue 069 = 0.
- Feed smoke PASS.
- Profile smoke PASS.
- warm revision D1 `R0/W0`, `HEAD-ONLY-036` PASS.
- fixed like cron disabled + Durable Object event scheduler PASS.
- `preview.soridraw.com` HTTP 200.
- `app-version.json=124`.
- latest/popular current R2 feed requests D1 `R0/W0`.
- known private target: PREVIEW local/shared latest/popular 모두 37곡, 대상 미노출.
- TEST/PRODUCTION Worker versions unchanged PASS.

## 이번 릴리스에 포함된 핵심 변경
- 공개/비공개/옵션 변경을 shared Feed에서 해당 곡 단위로 반영.
- 구형 059/064의 environment-local first-page snapshot 전체 덮어쓰기 경로를 PREVIEW 070에서 비활성화.
- 좋아요 집계가 private mutation과 충돌할 때 shared Feed를 ETag CAS로 재시도하여 private 곡 재삽입 방지.
- 전체 Feed rebuild, D1 migration, user data backfill 없음.

## 아직 남은 릴리스 게이트
- TEST/PRODUCTION Worker에는 아직 구형 059/064 full snapshot writer가 남아 있다.
- known private 곡의 TEST/PRODUCTION stale local cache는 Run `35452879050`에서 대상 ID 1개만 제거해 37/37로 수리했지만, 장기 보호는 070 승격 전까지 완전하지 않다.
- TEST 승격은 사용자의 명시적 **테스트배포** 승인 필요.
- PRODUCTION은 TEST 전체 PASS 뒤 사용자의 명확한 **정식배포** 승인 필요.
- catalog WRITE ON, READ OFF, FIRST_PUBLISHER OFF.
- 실제 user mutation D1 `W1~W2` 실측 미완료.

## 다음 배포 순서
1. PREVIEW 070 실사용 회귀 및 비용 확인.
2. 사용자 테스트배포 승인 → exact PREVIEW tree를 main/TEST로 승격.
3. TEST Worker 070 적용 후 shared/local cache parity + W1~W2 확인.
4. 사용자 정식배포 승인 → 검증된 main 동일 tree를 PRODUCTION으로 승격.
5. PRODUCTION 후 세 활성 Worker 모두 legacy full writer 차단 확인.

