# APP772 — 기존 R2를 이용한 최소 복구 구조 후보 (SOURCE-ONLY, 2026-11-22 KST)

## 판정: 설계/오프라인 검사 PASS, 실제 자동 복구 HOLD

APP766의 실제 Cloudflare **D1 sqlite_schema 103개 테이블** 읽기 전용 검사([Actions #44938087820](https://github.com/andrawing1212/soridraw-music/actions/runs/44938087820))는 완전한 독립 과거 operation ID 원장과 외부 owner revision floor를 증명하지 못했다. 관계별 D1 `mutation_id`는 변경 시 덮어써지고, 기존 `follow-intents-v354` R2 경로도 관계별 최근 요청에 덮어쓰기된다.

APP768의 실제 **R2 조건부 6중 경합 1건 성공·5건 차단**([#44952152823](https://github.com/andrawing1212/soridraw-music/actions/runs/44952152823))과 APP769의 **QA D1 실패/모의 ACK 손실**([#44953090705](https://github.com/andrawing1212/soridraw-music/actions/runs/44953090705))은 변경 영향이 없어 재사용했다. APP770 `assessApp770PostAdmission`를 그대로 재사용하고 불필요한 재감사는 하지 않았다.

**제안 구조는 불변 R2 이력 + 기존 정본 D1 W1~W2 + 외부 복구 경계**다. 기존 공유 R2를 사용하는 *설계 후보*라는 뜻이지 공유 R2에 실제 객체를 만든 것이 아니다.

## 필요한 최소 단계 (아직 운영 연결 없음)

1. **신규 owner Auth epoch·cutover:** 과거 기록이 불완전한 ID를 재사용하지 않는다. 모든 현재·구형 브라우저와 Writer가 새 접수 흐름을 거치도록 서버에서 묶어야 한다. 일부 Writer만 새 정책을 통과시키면 **실행 HOLD**. 기존 계정에서 미확인 과거 ID를 `never-seen`으로 선언 금지.
2. **불변 R2 접수:** APP767의 owner+actor+authEpoch+cutover+canonicalOperationId SHA-256 key와 조건부 `put(...onlyIf:{etagDoesNotMatch:'*'})`를 재사용한다. 한 번 성공했다고 **D1 확정 아님**. 412/503/ACK 유실이면 새 ID 발급·자동 D1 재쓰기 0.
3. **관계당 단일 미확정 작업 경계:** 같은 관계의 이전 작업이 확정되기 전에 다음 Writer가 D1의 마지막 `mutation_id`를 덮어쓰지 못하게 막아야 한다. 해당 경계는 **owner DO 전체 PITR에도 남는** 독립 확인 자료여야 한다. 현재 실제 R2에 원자적인 경계가 있다고 주장하지 않는다. 미확인·구형 Writer 우회이면 HOLD.
4. **기존 canonical D1 변경만:** 정본 follow 관계 기록을 그대로 사용하고 추가 D1 원장 행은 제안하지 않는다. 실제 운영 Writer의 `meta.rows_written`(인덱스 포함) **1~2건이 물리 확인되어야 함**. W3 이상은 FAIL. 관계별 단순 현재 행은 과거 전체 원장이 아니다.
5. **R2 불변 확정 receipt + 외부 revision floor:** D1이 해당 ID로 확정되었음을 독립적으로 확인한 뒤, APP770의 같은 ID·D1 revision에 묶인 **불변 R2 settled 기록**을 별도 영구 증거로 남기고, owner별 DO 외부 revision floor를 단조 증가시켜야 한다. 실제 버킷 경로, 동시성 CAS, 선후행 순서, 손실 복구, 원장 보존 정책은 **미구현·미승인**. R2와 D1은 원자적인 한 번의 transaction이 아니므로 이 둘만으로 완전한 자동복구를 선언할 수 없다.
6. **재확인:** 동일 ID에 대해 admission·D1 exact commit·R2 immutable settled·Auth epoch·전체 Writer 이력·외부 revision floor·미확정 경계 증거가 **모두** 같은 경우 **읽기 전용 결과 확인 후보**가 된다. 그 외 모든 오류·불확정·일부 데이터 손실은 수동 해결 이전까지 HOLD. 이 설계에서는 자동 재쓰기·새 ID 발급·신호 전송을 어떤 경우에도 허용하지 않는다.

## 장애별 명확한 결론

| 장애 | 최소 안전 동작 | 아직 필요한 실제 서버 기능 |
| --- | --- | --- |
| R2 접수 PUT의 응답 소실 | HOLD, 새 ID·D1 변경 금지 | 같은 해시 키의 신뢰할 수 있는 상태 조회 |
| R2 접수 후 D1 오류/503·결과 불확정 | HOLD, 이전 상태라는 이유로 재쓰기 금지 | 불변 전체 요청 이력과 exact commit 판정 또는 별도 안전한 수동 복구 절차 |
| D1 확정 후 응답 소실 | 동일 ID의 정본 D1+R2 확정 증명 시 읽기 전용 결과 확인 | 실제 callback과 기존 receipt 재현/전달의 독립 검증 |
| D1 확정 후 R2 settled 쓰기 실패 | HOLD, D1 재쓰기 금지 | 이전 작업이 다음 변경으로 덮이기 전 신뢰할 수 있는 정본 확인·후속 R2 확정 |
| owner DO 전체 PITR·옛 Writer 요청 | HOLD | DO 외부 단조 floor, 시작부터 완전한 ID 이력, 모든 Writer cutover/erase 정책 |

**핵심 제한:** R2 접수 성공 이후 D1에 저장되지 않은 요청이 **정말 한 번도 확정되지 않았다**는 독립적인 사실을 증명할 수 없으면 안전한 자동 재시도는 보장할 수 없다. 이때 무한 재시도/새 ID 발급이 아니라 HOLD다. 현재 설계는 **중복 차단 우선 후보이지 완전한 자동 복구 구현이 아니다.**

## 비용과 데이터 보존

- **D1:** 기존 정본 Writer W1~W2 유지 목표, 새 append-only D1 원장 행 **추가 0**. 코드의 W1/W2 검사는 **오프라인 가짜 지표를 거부하는 규칙 검증**일 뿐 실제 PRODUCTION 비용 PASS가 아니다. 구형 인덱스/트리거/동시 Writer 등은 별도 실측 필요.
- **R2:** 접수 1회에 더해 settled 불변 기록과 owner별 외부 floor 업데이트/동시성 확인 등이 필요할 수 있다. 새 객체 PUT과 실패한 조건부 PUT도 **추가 Class A 작업·저장 비용**을 발생시킨다. 10만 사용자 규모의 실제 계정 잔여 무료 한도·write 수·월 비용 **미측정**. 비용 승인 전 활성화 금지.
- **조회:** 오류가 발생한 정확한 작업 ID만 제한적으로 조회하는 후보. 전체 D1/버킷 scan, 페이지 방문 폴링, 캐시 초기화 금지.
- **데이터:** Auth UID와 요청 ID를 장기 저장하는 것에 준하는 보존·삭제/재생성·복구 요구를 추가 설계해야 한다. 기존 데이터 대량 이전·삭제·테이블/Rules/바인딩 추가·권한 확대 없음.

## APP772 코드·검사

- `scripts/app772-minimal-recovery-boundary.mjs`: `APP772_MINIMAL_RECOVERY_COMPILED_OPEN=false`. APP770 pure shape validator를 재사용한 **별도 source-only 안전 판정**. 불확실한 5개 실패 단계 즉시 HOLD; D1 W3·전체 스캔·배경 폴링·구형 Writer 우회·DO PITR·정확한 settled receipt 불일치 모두 HOLD. 모의 완전 일치도 `OFFLINE_EXACT_SETTLED_READ_ONLY_SHAPE_ONLY`에 불과하며 D1 재쓰기·새 ID·relay·DO reserve·운영 배포 허가는 전부 false.
- `scripts/verify-772-minimal-recovery-boundary.mjs`: Node 22 오프라인 **38케이스 PASS**, 네트워크 fetch 호출 시 예외, 실제 서버 읽기·쓰기 **0**. 기존 APP768/769 QA 실검사 반복 없음.
- **서버 미연결:** 실제 APP755/765/767/770 Worker 또는 Firebase/RTDB에 import·배포/연동하지 않았다. PR 테스트의 PASS와 PC·모바일 실사용 PASS는 다르다. **PREVIEW·TEST·PRODUCTION 배포 0**, APP737/738 HOLD 유지.

다음 독립 작업은 실제 적용 전에 **현재/구형 모든 Writer 강제 접수 가능성, 외부 pending/floor 구현 비용과 R2 장기 보존·삭제 정책을 읽기 전용으로 구체화하고, 별도 승인하에 QA 실증하는 것**이다.