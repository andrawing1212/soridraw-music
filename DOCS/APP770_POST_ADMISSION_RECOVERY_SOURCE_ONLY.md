# APP770 — R2 접수 뒤 D1 확정/응답 소실 복구 판단 설계 (SOURCE-ONLY, 2026-11-22)

## 목표와 실제 범위

APP768의 **실제 QA R2 6중 동일 요청에서 1건만 저장 PASS**와 APP769의 **QA D1 실패 SQL·모의 ACK 소실 합성 PASS**를 재활용한다. 이번 승인 범위는 기존 팔로우 서버의 저장 결과를 재확인하기 위한 **OFF 기본값의 판단 규칙과 오프라인 코드 검사**뿐이다. 실제 Cloudflare Worker/DO, D1/R2, Firebase/RTDB/Hosting, 사용자 원본/요금제/배포는 변경하지 않았다.

재사용한 코드: `scripts/app767-r2-admission-candidate.mjs`의 conditional PUT 해시, `scripts/app765-production-canonical-recovery.mjs`의 독립 이력·owner revision floor 개념, `scripts/app755-production-follow-backend.mjs`의 확정 증거와 Durable Receipt 보호. 기존 `DOCS/APP766_EXISTING_FOLLOW_HISTORY_EVIDENCE.md` 기준 D1 pair의 최근 `mutation_id` 및 R2의 최근 intent만으로는 **과거 개별 operation ID의 전체 이력**을 증명할 수 없다. APP770은 없는 정본을 있다고 가정하지 않는다.

## APP770 소스 계약

`scripts/app770-post-admission-reconcile.mjs`는 `APP770_POST_ADMISSION_COMPILED_OPEN=false`이고 어떠한 실제 서비스에서도 import·호출·연결되지 않는다. `assessApp770PostAdmission`은 메모리 객체를 비교하는 **읽기/쓰기 0회** 순수 검증이다.

1. R2가 인정한 `ADMISSION_ONLY_NOT_D1_COMMIT`의 `keyDigest`를 APP767과 **동일한 인자 순서로 SHA-256 재계산**하여 owner·actor·Auth epoch·cutover·정확한 canonical operation ID에 묶는다. R2 key 존재만으로 성공을 추론하지 않는다.
2. 서버에서 독립적으로 검증한 Auth 계정 세대·첫 요청부터 누락 없는 cutover·구형 Writer 완전 커버리지·개인정보 삭제 수명 정책이 필요하다.
3. D1의 **해당 operation ID 확정 receipt**, R2의 **같은 operation ID에 연결된 immutable settled receipt**가 필요하다. 최근 pair 상태나 단순 follower count가 같다는 증거는 거절한다.
4. DO 복구(PITR)에 영향을 받지 않는 **처음부터 완전한 operation history**와 **외부 owner revision floor**가 최신 D1/R2 확정 버전 이상인지 검사한다. ACK 손실·이전 ID·503·원장 누락·세대 불일치·과거 Writer 미확정은 모두 `HOLD`다.
5. 모든 모의 증거 모양이 일치하더라도 `OFFLINE_EXACT_SETTLED_PROOF_SHAPE_MATCHED_ONLY`라는 **코드 계약 판정만** 반환한다. **재전송, 새 ID 발급, D1 재쓰기, DO 신규 예약, Firebase 신호 송신, PRODUCTION 배포 권한은 언제나 false**다. 이 판정은 실제 정본 조회/자동 복구 PASS가 아니다.

## 장애별 판정

| 상황 | APP770 정책 | 이유 |
| --- | --- | --- |
| R2 접수 후 D1 쓰기 실패/503 | `HOLD`, 재쓰기 금지 | D1 성공 여부·시점 미확정. 단순 행 부재는 독립 원장 증거가 아님 |
| D1 commit 뒤 ACK 소실 | 독립 D1 + R2 + 이력 + floor의 **같은 ID** 일치 시 계약상 상태 확인만 가능 | ACK 손실만으로 기존 DO receipt 재발급하거나 이미 확정된 쓰기를 반복하면 위험 |
| R2 write 성공했지만 503 응답 | `HOLD`, 새 ID 발급 금지 | 서버가 commit했는지 판단 불가 |
| R2 미정산/최근 intent만 존재 | `HOLD` | 정확한 immutable settle/수신점 증명 불가 |
| DO 전체 PITR·구형 Writer 누락·Auth 세대 변경 | `HOLD` | 최신 pair만으로 전 이력 복구 불가능 |

## 검사와 남은 출시 차단점

`node scripts/verify-770-post-admission-reconcile.mjs` Node 22 오프라인 **42개 케이스 PASS**. 오프라인 실행 중 fetch가 호출되면 실패하도록 차단했으며 실제 서버 읽기·쓰기 0. APP768/769 실서버 QA PASS는 변경 영향이 없으므로 반복 검사하지 않았다.

**미완료 / HOLD:** 실제 운영 Worker에서 immutable canonical operation receipt를 읽는 서버 callback, completeFromOrigin과 모든 구형 Writer 적용 증거, Auth epoch·독립 owner revision floor, R2↔D1 장애 중간 상태 reconcile, PC↔모바일 검증, 실제 팔로우 D1 W1~W2 물리 측정, 개인정보 보존·삭제정책. 기존 APP765/767 기본 OFF. 이번 작업만으로 PRODUCTION/PREVIEW 배포 또는 자동 복구 활성화 불가. 이후 실제 서버 연결·독립 원장 생성/마이그레이션·공유 데이터 변경은 별도 승인과 물리 비용·보존 정책 검토가 선행되어야 한다.
