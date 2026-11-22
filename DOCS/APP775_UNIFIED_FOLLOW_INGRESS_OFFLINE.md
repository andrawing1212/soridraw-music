# APP775 — 구형·신형 팔로우 공통 진입 계약 (운영 비활성 / 오프라인 QA)

## 개발 목표와 기준

승인 범위는 **구형 브라우저와 신형 요청을 같은 안전 검증 경로로 판정하는 OFF 기본 코드·오프라인 검사**다. 공유 Cloudflare Worker/D1/R2, Firebase, RTDB, 사용자 원본, PREVIEW·TEST·PRODUCTION은 변경하지 않는다.

실제 PREVIEW `owner-follow-precommit-557.mjs` (pinned SHA `4363820117100cb03bcbc44a01e127aeb5de3cf4`)는 구형 무버전 요청의 동등한 ID를 APP579 해시로 생성하는 유용한 로직을 갖고 있다. 그러나 미등록 owner·부분 요청·조건 불일치 등은 기존 canonical Writer로 돌아간다. APP774 오프라인 우회 재현 PASS 및 QA D1 합성 W1/W0 단일 승자 PASS를 재사용하며 물리 검사를 되풀이하지 않는다. **전체 Writer 접수 강제는 아직 FAIL/HOLD**다.

## 최소 변경

`scripts/app775-unified-follow-ingress.mjs`: `APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN=false`이며 어떤 기존 Worker/앱에도 import하지 않는다. 실행 효과가 없는 `assessApp775UnifiedFollowIngress`만 내보낸다. OFF에서는 `OFF_LEGACY_UNCHANGED`를 반환하며 실제 기존 호출로 연결하지도, 기존 기능을 바꾸지도 않는다.

모의 QA의 정확한 scope에서만 enabled=true를 허용한다. 구형 빈 envelope와 신형 ordered envelope를 **동일한 인증·owner epoch·cutover·서버 작업 ID·관계 revision·pending fence 검증**으로 통과시킨다.

- 구형: 기존 APP579와 동일한 SHA-256([cutover token, actor, owner, relation revision, desired])으로 **같은 서버 ID를 재구성**한다. 클라이언트에게 임의 ID 생성 권한을 주지 않는다.
- 신형: 클라이언트에 있던 `followOperationId`/`followExpectedRevision`이 서버가 독립 검증한 exact ID/revision과 일치해야 한다. 인증 UID는 클라이언트 body가 아니라 검증된 Firebase Auth/AppCheck 결과만 인정한다.
- 공동 조건: 등록된 owner의 계정 세대, 모든 현재·구형 Writer에 대한 동일 접수 의무, 다른 canonical 경로 우회 차단, owner DO 전체 PITR 보호, 관계별 독립 pending fence, 정확한 관계 revision, 삭제/UID 재사용 정책과 PREVIEW·TEST·PRODUCTION 호환 검토의 증거가 필요하다.
- 신뢰할 수 없는 부분·부분 envelope·재시도·세대 변경·구형 우회가 하나라도 있으면 `HOLD`.
- 모의 증거가 모두 모양상 완전하면 `OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY`만 반환한다. 기존 Writer 호출/DO 예약/R2 쓰기/D1 쓰기/재시도/신호/배포 허가는 모두 `false`이며 실제 자동복구/온전한 이력 검증을 뜻하지 않는다.
- 실제 운영의 미등록 owner는 기존 canonical 경로가 필요한 사용자다. 신형 절차가 미완성인 현 시점에서 일괄 차단하면 정상 팔로우가 실패하므로, 서버 연결이나 강제 차단은 하지 않는다.

## 검사와 합격 기준

`scripts/verify-775-unified-follow-ingress.mjs`는 Node 22 오프라인 단위검사다. 이전 APP774 워크플로의 `pull_request` 오프라인 job에만 이 검사를 연결하고, 예전 live QA job `if:false` 및 `push` 트리거 삭제 상태를 유지한다. 검사는 모든 직접 네트워크 fetch를 예외로 막는다. 구형/신형/동시 구형/동일 상태/언팔로우/불완전한 Auth·cutover·fence·DO PITR 조건을 확인하며 과거 QA의 실서버 읽기·쓰기 검사를 반복하지 않는다.

**릴리스 HOLD:** 실제 서버에서 신뢰 가능한 completeFromOrigin operation history, 독립 owner revision floor와 pending fence, 모든 활성·구형 Writer를 동시에 강제하는 cutover, 구형/미등록 owner의 정상 기능 유지, 실제 canonical D1 W1~W2, 장기 R2 비용/개인정보 삭제 정책, PC↔모바일 재검증을 아직 증명하지 못했다. `APP775` 통과가 운영 자동 복구를 활성화하는 허가가 아니다.

## 변경·보호 상태

- 신규: `scripts/app775-unified-follow-ingress.mjs`, `scripts/verify-775-unified-follow-ingress.mjs`.
- 수정: 기존 `.github/workflows/app774-isolated-legacy-cas.yml`의 **오프라인 검사 경로만 확장**, 이전 live QA `if:false` 유지.
- 기존 APP557/APP579/APP713 또는 APP767/770/772 실행 코드 변경 0.
- QA Worker 새 버전/임시 Worker, D1/R2 합성 쓰기, DB schema 변경, Firebase Functions, Hosting 배포 **0**.
