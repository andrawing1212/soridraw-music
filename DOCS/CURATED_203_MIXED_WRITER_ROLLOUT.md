# #203 SORIDRAW 추천곡 — 구형 Worker 교체 및 공유 읽기 개방 기준
작성: 2026-10-24 KST · **설계 기준만 확정, 실행/배포 승인 아님**

## 고정 상태
- `preview` base: `09458e3d2d75905f29d88e3a1cf61eb84989e427` (app475 미병합).
- 제품 PR #454 app475 감사 SHA: `ef3a5abe272d7a5e81c6743ec0c6d8f8846ae82d`. 기존 P1×2/P2×1의 소스 재감사 PASS. 전체 운영 감사/배포 PASS 아님.
- 실제 공유 D1 13 / PREVIEW 13 / TEST 12 / PRODUCTION 12: 2026-10-24 KST 재측정 #40035848324. TEST/PRODUCTION 기존 v307 R2 목록 누락이 존재.
- 실제 PREVIEW 3개 변수 `SORIDRAW_CURATED_WRITER_SHADOW471`, `SORIDRAW_CURATED_SHARED_V466`, `SORIDRAW_CURATED_ALL_WRITERS_READY466`: **모두 ABSENT_OFF**. 공유 D1, R2, DO 연결 PASS. app475 미배포.
- TEST/PRODUCTION 현재 구형 Worker에는 새로운 공유 v466 R2 쓰기 경로가 없다. 따라서 **읽기 v466 활성화 금지**.
- 공유 사용자 원본 데이터 이동/수정/백필/삭제/캐시 전역 삭제 금지. Music Note #237·비용 후순위. 앱 UI/좋아요/Stage416 기존 기능 보호.

## 왜 기존 재감사 PASS만으로 켤 수 없는가
1. **재현 확정:** 구형 TEST나 PRODUCTION Worker가 공유 D1에 추천 승격/해제 또는 곡 공개/비공개를 저장해도 v466 공유 R2에는 변경을 기록하지 못한다.
2. 뒤늦게 새 Worker가 v466을 맞춰놓아도, **그 뒤에 실행된 마지막 구형 쓰기**가 공유 R2를 영구적으로 뒤처지게 만들 수 있다. v466 HEAD/Edge 읽기로는 이를 발견하지 못한다.
3. 플래그 `ALL_WRITERS_READY466=1`은 코드에서 **운영자 수동 증명값**일 뿐, 활성 Worker가 모두 교체됐다는 자동 증거가 아니다. `keep_vars:true`라 코드에 변수가 없다는 것만으로 운영 설정이 OFF라고 추정하면 안 된다.

## 승인/실행을 분리한 단계

### A. PREVIEW 소스 준비 (배포 없음, 바로 구현/감사 가능)
- #454의 고정 SHA와 현재 `preview`의 **문서/진단 전용 변경**을 충돌 없이 정리한다. 구형/신형 기능 코드를 임의 혼합하지 않는다.
- `scripts/verify-467-curated-writer-fence.mjs` 및 기존 468/469/475 테스트로 검증: 모든 OFF / shadow ON·reader OFF / shadow OFF·reader ON+ready OFF / read ON+ready ON. **shadow ON·reader OFF에서 legacy v307은 변함없이 표시**, v466만 이중 기록.
- 실사용 변경 경로 총점검: 관리자 추천 추가/해제 `PUT/DELETE /v1/curation/soridraw/:id`, 곡 visibility `PATCH /v1/tracks/:id/visibility`, Music Note 공개/비공개 batch. 성공 D1 commit 후 R2 실패 때 durable 예약이 삭제되지 않는지; 공개/숨김·정렬·예약 노출 시각이 바뀌는 다른 경로가 있는지도 점검.
- **릴리스 장벽 추가를 별도 source-only 작업으로 검증**: 활성 PREVIEW·TEST·PRODUCTION Worker *실제* version ID, source/modules + 읽기/쓰기 route 호환 표시, live bindings+flags, 동일 공유 D1/R2, 개별 환경 캐시, read-revision 결과를 읽기 전용으로 비교; 단 하나라도 미확인·혼합 배포·오래된 쓰기 경로면 FAIL. 민감한 secret 값 출력 금지.
- TypeScript/Build/Worker dry-run, 기존 좋아요/Stage416/뮤직노트 회귀, Work 독립 감사의 **정확한 최종 SHA PASS**가 필요.

### B. 실제 Writer 교체 (배포 승인 단계, **지금 실행하지 않음**)
- 먼저 PREVIEW에 승인된 완성 Worker만, reader OFF·ready OFF 상태로 배포한 뒤 실사용/비용 확인. `SORIDRAW_CURATED_WRITER_SHADOW471=1`도 별도 승인된 운영 플래그 절차를 통해서만 설정하고, 양쪽(v307/v466) 투영 실패 시 예약 유지 검증.
- 이후 사용자 **TEST 승격 승인**을 받은 릴리스만 main→TEST에 사용. TEST 활성 Worker 100%가 같은 호환 계약을 준수하는지, 구형 요청이 여전히 실행될 가능성/예약/롤백 버전까지 확인. reader OFF 유지.
- 사용자 **명확한 PRODUCTION 정식배포 승인** 전까지 PRODUCTION은 바꾸지 않는다. 승인 시 TEST에서 확인한 동일 릴리스 아티팩트를 이용해 PROD Writer를 교체하되 reader OFF 유지.
- 세 환경 모두 *실제* 100% 활성 버전과 모든 관리자/공개·비공개 쓰기 경로를 확인하고, **교체 이전에 시작한 구형 요청까지 완전히 종료했다는 증거**를 확보하기 전에는 shared reader를 켜지 않는다. 이 증거/충분한 런타임 종료 경계를 확인할 수 없으면 **진행 중단**, 시간 경과만으로 PASS 추정 금지. 임의의 구형 Worker 재활성화도 금지.

### C. 원본 확인/파생 데이터 복구 (사용자 원본 쓰기 없음)
- 위 B가 통과한 후 **관리자 한정, 한 번만** 공유 canonical `curated_picks` 최대 40행 및 각 공개 상세의 유효성을 읽어 공유 v466과 각 환경 v307 캐시를 비교한다. 불일치 시 **R2 파생 객체 해당 키만** 조건부(CAS)로 고쳐 맞춘다. 공유 D1 사용자 원본에 쓰지 않는다.
- 13/13/12/12 → **13/13/13/13** (정확한 track ID·순서·공개상태 기준)로 일치하고 실제 Edge/브라우저 warm·cold PC/모바일에서도 보이는지 증명한다. 단순 개수 PASS로 인정하지 않는다.
- 기존 5분 Edge 캐시, 브라우저 보유 revision, 기존 생산 환경 캐시를 함께 검증. 전역 캐시 삭제/반복 DB 조회/페이지 이동 write 금지. 전체 컬렉션 scan 금지, 40곡 상한 유지.

### D. 읽기 개방 (추가 승인된 별도 단계)
- **세 Writer 100% 호환 + 구형 쓰기 종료 증명 + 공유 R2와 3 환경 표시 parity + Work 감사**가 모두 확인된 뒤에만 `SORIDRAW_CURATED_ALL_WRITERS_READY466=1`를 증명값으로 설정할 수 있다.
- `SORIDRAW_CURATED_SHARED_V466=1`은 Writer 배포와 **동시에 자동으로 켜지 않는다**. PREVIEW부터 단계별 읽기 동작 검증 후 승인된 순서로 TEST/PRODUCTION에 개방한다. 기존 정상 v307 캐시 우회 경로를 없애지 않는다.
- 실패·rollback 시 **먼저 새 reader를 OFF**한 것이 실제 반영됐는지 검증한다. 이후 필요한 경우에만 승인된 호환 버전으로 복구한다. 다른 환경의 새 reader가 살아 있는데 구형 writer를 다시 100% 돌리는 롤백은 금지.

## app477 안전검사 한계 (2026-10-24)
- 세 Worker의 live 배포 버전·모듈·설정·Workers.dev 경로·플래그를 읽기 전용 GET으로 확인한다. 전부 정상이어도 구형 요청의 마지막 D1 쓰기 종료 증명이 되는 것은 아니다.
- app477은 외부 독립 증거의 진위까지 확인할 수 없으면 의도적으로 HOLD를 반환한다. 100% 트래픽 할당, 단순 경과 시간, 관리자 자체 선언은 독립 증거가 아니다.
- 운영 원칙: 구형 요청 종료의 검증 가능한 증거가 생길 때까지 reader OFF와 기존 v307을 유지한다. 별도 구현·독립 감사 없이 우회하지 않는다.
## 구현 담당 / 증거 / 중단 조건
- ChatGPT: 위 설계, 출시 게이트/비용/데이터 안전 최종 판단.
- Codex High: A단계 **라이브 Writer 호환 증명용 읽기 전용 스크립트 + 강제 FAIL 로직 + 재현 테스트**, 가능하면 기존 release-system preflight 재사용. 배포/실제 변수 설정/사용자 D1 변경 금지. 소스 commit과 TS/Build/Test 결과 제출.
- Work: 고정 SHA 독립 검증 (구형 마지막 쓰기, 리더 이중 플래그, R2 CAS 실패/재시도, 3환경 binding, rollback, Warm 캐시).
- 사용자: PREVIEW 실사용 검증, TEST/PRODUCTION 승격 승인.
- STOP: v466 단독 read ON, Writer 불일치/미증명, source-only PASS를 live PASS로 표시, R2 복구 실패 후 성공 ACK, 권한/원본 위험, 정상 좋아요/뮤직노트 영향, D1 전체/반복 조회, 비용 증가 원인 불명.

**다음 한 가지 구현:** A의 **세 환경 활성 Worker 호환 검증을 자동화하는 읽기 전용 장벽**. 기존 app475 기능 소스는 잠시 동결하고, 이 검증을 PASS해야만 B 단계 승격 가능 여부를 논의한다.
