# Stage 403 — 글로벌 서비스 운영 원칙을 SORIDRAW에 적용하는 결정 (2026-10-09 KST)

## 디렉터 결론 — 별도 플랫폼 도입보다 기존 백엔드의 신뢰 구간 분리

**유지:** PREVIEW app382, 좋아요 누르자마자 화면 반영, 마지막 클릭 +30초 W1 큐 접수, 개인 하트·타 계정 공개 숫자·PC↔모바일 동기화, Music Note / Studio 저장 하트 / 팔로우 / UI 모두 보호.

**채택할 글로벌 설계 원칙:** (1) canonical 좋아요 저장과 ‘알릴 일이 있다’는 복구 가능한 표식을 **같은 트랜잭션에 남김** (Transactional Outbox/CDC), (2) 별도 처리기가 R2 공개 카드 정착을 확인하고 필요한 구독 범위에 작은 변경 신호 발행, (3) 전송 실패 시 영속 대기와 재시도, 중복 도착은 버전/이벤트 ID로 무해하게 처리. (4) 비용은 원본 D1 읽기·쓰기뿐 아니라 DO 쓰기·알람·Firebase 다운로드/연결도 측정.

현재 069 큐에는 사용자 변경 의도가 보존되지만, 기존 Worker batch는 정산 시 해당 대기열을 소비/삭제한다. **접수 ACK 또는 삭제된 큐를 외부 알림 전달 보증으로 해석하면 안 됨.** 075 저장 전 예상 `changedRows`도 실제 정착된 곡 증거가 아니다. `explore_derived_changes`는 좋아요뿐 아니라 곡 수정도 기록하므로 **좋아요 확정만 알리는 표식으로는 부적격** (Stage402). 원래 journal을 활용한 *일반 track cache invalidation*은 별도의 후보이지만 like-only 신뢰 이벤트와 동일시하지 않는다.

## 글로벌 기술 공식 참고 — 기업 내부 구현을 단정하지 않음

| 제공사와 공식 자료 | 검증된 원칙 | SORIDRAW 반영 |
|---|---|---|
| [AWS Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | DB 저장+발행 이중 실패를 피하려면 같은 트랜잭션의 outbox 또는 CDC, 수신 멱등 처리 | 069/075 정산 DB batch 안에서 *실제 변한 곡*에 한정해 복구 가능한 이벤트를 남기는 최소 비용 후보 |
| [AWS DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/streamsmain.html) | 변경된 항목 기록을 순서대로 별도 서비스에 제공 | D1에 동일 기능이 있다고 **가정 금지**; 기존 `explore_derived_changes`는 like-only CDC가 아니다 |
| [Cloudflare D1 batch()](https://developers.cloudflare.com/d1/worker-api/d1-database/) | SQL batch는 한 트랜잭션이며 실패 시 전체 되돌림 | 현재 배치에 새 outbox INSERT를 넣는 구조를 격리 Miniflare에서 **정확한 트리거/비용 포함해** 증명 |
| [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/) | 영속 저장을 통해 재시작 뒤 복구; 알람 최소 한 번 실행/재시도 | 기존 `ExploreLikeBatchScheduler103`를 이용할 수 있는지 검토. 메모리 Map은 영속 기록이 아니고 알람 자동 재시도 횟수만 믿지 않는다 |
| [Firebase RTDB 성능](https://firebase.google.com/docs/database/usage/optimize), [Web onValue](https://firebase.google.com/docs/database/web/read-and-write) | 큰 상위 경로 onValue 대신 필요한 데이터 범위만 구독 | 기존 `publicSync/exploreLike` 글로벌 전송을 추후 페이지/구독 범위별 신호로 점진 전환. 카드마다 리스너 1개씩 만드는 방식 금지 |
| [Firebase RTDB 청구](https://firebase.google.com/docs/database/usage/billing), [Cloudflare DO 요금](https://developers.cloudflare.com/durable-objects/platform/pricing/) | 전송 바이트뿐 아니라 프로토콜·연결 오버헤드와 DO 요청/저장도 비용 | 'D1 W0 추가'만으로 무료라고 보고하지 않고 10만 명 동시 사용 가정에서 전체 비용 비교 |

이것은 공식 설계 자료에 대한 조사이며 특정 SNS 기업의 비공개 실제 운영 구조를 확인했다는 뜻이 아니다.

## 단일 권장 후보 — ‘정산 트랜잭션에 복구 가능한 outbox 포함’ (제품 적용 전 비용 검증)

1. **클릭 단계 변경 없음.** 개인 하트 로컬 즉시, 30초 마지막 상태 묶음, 069 W1 접수 유지. 앱 버전 변경으로 전 사용자 캐시 초기화 금지.
2. **정산 단계 069 및 075 통합 관찰.** 변경된 좋아요 membership이 실제 저장될 때만 같은 D1 batch 안에서 `type=publicLikeChanged, trackId, eventId/version`를 가진 ‘알려야 할 변경’ 식별/기록. D1 트랜잭션 바깥에 따로 DO put 먼저 수행해 저장/발행 동기화를 주장하지 않는다. 여러 사용자·같은 곡은 윈도우 단위로 묶을 수 있는지 검증.
3. **기존 R2 공개 카드 정착 확인.** R2가 canonical 최신 값과 다르거나 부분 실패하면 아직 알림을 성공 처리하지 않고 bounded 재시도. 191의 상위 40곡 복구는 임의 곡 전체의 성공 근거로 쓰지 않는다.
4. **서버 전용 publisher + 재전송.** 기능 플래그 OFF로 작성 후 독립 검증. DO 영속 원장 또는 이미 원자 저장된 D1 outbox로 미전송 이벤트를 보존. Firebase 서버 전용 인증·재전송 ID·순서 역전 방지. 전송 먼저→ACK 마지막; 중복 전송은 허용하되 최종 화면 중복/역행은 0.
5. **수신 범위 최소화.** 한 곡 변경 시 이용자 전체에 50곡 배열을 재전송하지 않도록, 화면 단위 변경 통지 및 계정별 개인 membership 구분. 화면과 무관한 곡 신호는 무시, 변경된 곡 카드만 R2에서 확인. 구버전 앱이 사라질 때까지 기존 경로를 같이 유지·비용 측정. 공유 RTDB Rules 변경은 가장 마지막에 승인 후 진행.

## 근본 비용 현실 — 숫자를 실제로 증명해야 함

D1 `rows_written`은 인덱스/트리거 파생 쓰기까지 합산할 수 있다. Stage399/400의 SQL 후보는 `RETURNING`만으로 069 R+3~+7 / 075 R+3~+5, **W 추가 0**(격리 배경 aggregate 모델)까지 확인되었지만 영속 outbox를 추가할 때의 새 D1 W는 **아직 모름**.

- 기존 사용자 행동의 **전체 D1 W1~W2**만 합격. 실제 aggregation+index+trigger로 W3+면 이 후보도 FAIL. '배치 전체 W를 많은 클릭 수로 나눠서 W2'라고 임의 합격 처리하지 않음. 정산 전/후 계측과 명확한 행동별 비용 귀속 필수.
- outbox 신규 레코드가 D1 W를 1 이상 늘릴 수 있으며 DO `put`/alarm도 **별도 비용**을 만든다. 무조건 무료라고 주장하지 않음.
- **추정 모델**: 동시 구독자 10만 명, 실제 관련 구독 2천 명, 신호 payload 128B, 변경 100회라면 이론적 payload 전송은 글로벌 1.28GB, 한정 구독 25.6MB, 50배 차이. **실제 유저 분포·Firebase 프로토콜/재연결/기존 앱 병행 전송/수신 구독 구현을 반영하지 않았으므로 실요금 추산 아님.**
- 관리자 비용 카운터에서 **발행 수, 수신자 수, 다운로드, D1 행읽기·쓰기, DO durable storage, Functions 비용**을 구분. 데이터 변경 없을 때 D1 R0/W0 목표, 페이지 이동/앱 업데이트로 D1 조회 금지.

## Stage403 실행 결과/범위

`scripts/verify-403-global-notification-model.mjs`로 10가지 순수 메모리 **모형 테스트** 추가: rollback 시 알림 없음, DB 정착 후 중단 복구, R2 실패/지연, 보낸 후 ACK 전 중단/중복억제, 최신 곡 버전 유지, 중복 mutation ID, 곡 정보 편집과 like 신호 구분, W1~W2 gate, 10만 fanout 단순 산식. 이 테스트는 live D1/DO/RTDB 통합·실비용을 증명하지 않는다. 기존 398~402 독립 검증과 함께 GitHub CI 실행.

**결론:** 글로벌 패턴에서 가져올 것은 **복구 가능한 이벤트와 관심범위 전달**이며, 새 기술 대량 도입이 아니다. Stage404 우선 작업은 위 outbox 후보를 현재 069/075 실제 **full canonical D1 SQL + 모든 index/trigger**가 포함된 격리 Miniflare에서 W1~W2/실제 변경곡 보존까지 검사하는 **단일 비용 게이트**다. 비용 불합격이면 outbox 설치하지 말고 적은 비용의 일반 cache invalidation / 제한된 비실시간 동기화 대안을 비교해 사용자에게 보고.

## 동결/금지

제품 Worker·Functions·Firebase Rules·RTDB 쓰기·공유 D1 migration/seed/write·Hosting/TEST/PRODUCTION 배포·사용자 데이터 변환 금지. `app382`·30초 묶음·기존 좋아요/팔로우/Studio·Music Note·PC↔모바일 사용자 확인 기준 절대 변경 금지. Google/Firebase/Cloudflare 계정에 로그인해 직접 실서비스를 바꾸는 작업은 이번 연구 범위가 아님.
