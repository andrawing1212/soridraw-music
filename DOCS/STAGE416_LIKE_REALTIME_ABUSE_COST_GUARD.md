## 최종 사용자 지정 정책 — 2026-10-10 13:10 KST

**기존 1시간 제한을 2시간 제한으로 변경 확정.** 직전 작성된 본 문서의 `1시간` 관련 제안/설명은 역사적 초안이며 현재 사용 금지. 최신 확정 정책은 다음과 같다.

| 조건 | 동작 |
|---|---|
| 동일 계정에서 60초간 30회 좋아요 또는 해제 | 과도한 클릭 경고 |
| 동일 계정에서 60초간 40회 도달 | 해당 60초 창의 추가 좋아요·해제 거절 |
| **2분 연속** 위 제한에 도달 | **120분(2시간) 해당 계정 좋아요/해제 잠금** |
| 잠금이 시작된 시점부터 120분 경과 | 자동으로 해제 |
| Master 관리자 | 잠금 상태 조회·조기해제·횟수/시간 기준 변경·감사 기록 |

- `30 / 40 / 2개 연속 60초 창 / 120분`은 이번 개발 기준이다. 잠금 개시 기준은 정확한 서버 시계·계정별 60초 창·중복/동시기기 여부가 검증되기 전까지 **서버 보안 PASS 아님**.
- 최초 정상 클릭은 기존 app392처럼 빠르게 RTDB 다른 기기에 전달해야 한다.
- 사람의 실수로 매우 짧게 클릭한 것을 반복 저장해서 비용이 폭증하지 않도록 신호 최소화/경고 UX는 먼저 구현할 수 있으나, **앱·브라우저만 막는 것은 실제 공격의 서버 차단이 아니다**. 직접 RTDB REST/SDK 호출 및 Worker 원본 우회까지 막을 수 있음을 테스트하기 전에는 '보안 완료' 표기 금지.
- 이미 접수된 원본·미전송 영속 좋아요/해제 기록을 잠금 때문에 삭제하거나 뒤집지 않는다.
- 새로운 공유 RTDB/Firestore 규칙 및 Worker/Functions 배포는 실제 기존 앱과 사용자 데이터 공용 영향을 확인하고 exact preflight PASS 이전에는 적용하지 않는다.
- 사용자의 최신 지시로 이 방어를 **③ 저장 5분 변경보다 우선** 개발한다.

---

# Stage416 추가 안전 게이트 — 좋아요 반복 클릭 및 실시간 RTDB 비용 방어 설계
기준: 2026-10-10 KST, 사용자 신규 명시 요구. **분석/설계 문서이며 코드 구현·실행·공유 Rules 배포 승인이나 완료가 아니다.**

## 사용자 제기 문제
- PREVIEW app392의 같은 계정 PC↔모바일 개인 하트 실시간 즉시 반영은 사용자가 실사용 PASS 확인. **속도를 느리게 해 비용을 줄이라는 요청이 아니다.**
- 클릭을 악의적으로 매우 빠르게 반복하거나 봇이 RTDB 변경 신호를 계속 송신하면 공유 Firebase RTDB outbound bandwidth/동시 트랜잭션, 실시간 접속자에게 받는 트래픽, 추가 settle 상태 전송, Cloudflare canonical intake 자원을 소모시킬 수 있다.
- 사용자 요청: **1분에 최대 허용 횟수** 도입; **2분 이상 반복적인 과잉 클릭**이 지속되면 경고, 해당 계정의 좋아요/해제 입력 **약 1시간 잠금** 후 자동 해제. 무고한 일반 사용자가 느려지거나 혼란스럽지 않아야 함.
- 운영은 최종적으로 Master에서 임계값/잠금시간 조회·변경·조기해제·감사 기록이 가능하도록 설계하되, 기능 검증 이전에 공유 사용자 원본/기존 UI 무단 변경 금지.

## 실제 소스 확인 — 기존 보안과 빠진 방어 분리
- `src/services/exploreLikeIntent416.ts`: 실제 클릭마다 `runTransaction(userSync/$uid/exploreLikeIntent416)`로 **RTDB 실시간 쓰기** 1회를 시도하며, canonical ACK 후 `settleExploreLikeIntent416`로 해당 임시 신호 정리 **추가 RTDB transaction이 발생할 수 있음**. 일부 이전 pending 결과를 합친 최대 50건/전송 구조이며, 작은 한 하트 메시지만 고정해 보내는 구조 아님. `onValue`가 같은 UID의 기기에 데이터를 다시 전송한다. 30초 이상 늦은 수신/1시간 TTL/최대50항목은 보호지만 분당 서버 쓰기 제한과 다르다.
- `database.rules.json`: `userSync/$uid` 로그인 uid 검증, `exploreLikeIntent416`는 structure/version/row size 제한. **UID별 60초 횟수 카운터·2분 과다 행동·1시간 lockUntil을 서버 강제하지 않음**. 구조 검증만으로 악의적 코드 직접 호출/다중 탭/직접 REST API 악용을 막을 수 없음.
- `cloudflare/explore-worker/canonical/preview-entry.js` `handleVerifiedLikeBatch426`: Worker 서버 원본 저장 요청 전에 `LIKE_RATE_LIMITER.limit({key:actor.uid})` 확인. `cloudflare/explore-worker/canonical/wrangler.preview.jsonc`에서 **`simple.limit=60, period=60`** (60초당 Cloudflare Worker 요청 최대60 설정). 이것은 **likes batch HTTP request** 제한이지 RTDB direct per-click preview write 제한 또는 2분 탐지+1시간 계정 제한은 아님.
- **Firebase RTDB 비용:** 쓰기 연산 자체는 Firestore 문서당 과금처럼 따로 결제 항목이 아니지만 실제 서버 writes/트랜잭션은 수행하며, RTDB 저장 GB, outbound 다운로드 GB, 연결/프로토콜 비용이 증가. **보안 Rules 거절 요청도 네트워크 비용 가능**. 공식: https://firebase.google.com/docs/database/usage/billing 와 https://firebase.google.com/pricing. 무료 구간 이후 Blaze storage $5/GB-month, data downloads $1/GB(2026-10 확인). 실제 프로젝트 일간/월간 sent/received bytes, connections, RTDB write throughput, 다른 Worker D1/DO/R2 실비용 **아직 측정 전**.

## 방어 정책 초안 (최종 값은 abuse/정상 사용 분포로 튜닝)
- **기준은 하나의 Firebase auth UID 전체**: PC·모바일·여러 탭·여러 곡 합산. 계정마다 별도 카운트, 타 계정에 영향 0.
- **운영 시작 제안**: 자연스러운 한 번 클릭은 즉시 개인 UI+RTDB 신호 유지; **30회/60초 누적 시 1차 경고**, **40회/60초에 도달하면 남은 그 구간 신규 좋아요/해제 차단**; **연속된 두 60초 창이 한도에 도달**해 과다행동이 2분 지속됐다고 서버가 판정하면 신규 좋아요/해제를 **1시간 잠금**. 안전상 사용자에게 보이는 UI 경고는 실제 서버가 판정한 `lockUntil` 근거가 있을 때만 최종 잠금 표시. 사용량 분포가 없다면 30/40은 추천 **초기 가설값**이지 확정 합격선 아님.
- 경고 예: "짧은 시간에 좋아요 변경이 많아요. 잠시 후 다시 시도해 주세요." 잠금 예: "비정상적으로 많은 좋아요 변경이 감지되어 1시간 동안 좋아요 및 해제가 제한됩니다. 종료 예정: HH:MM." 정상 계정 악의 오탐 방지·관리자 수동해제·잠금 만료 복구 포함.
- 실시간 이벤트 **남발 방지:** 사람이 누르는 최초 클릭 즉시 전송하는 현재 app392 빠른 동작을 절대 저해하지 않고, 한 곡의 수백ms 단위 재반전·동일 최종 상태 중복 전송은 최대 0.3~1초 trailing 병합을 검토. 정상 UX에 필요한 5~10초 목표/좋아요·해제 정확성 유지. 단 **클라이언트에서만 막는 건 공격 방어가 아니라 UX 보호**.
- **중요:** 무단 클라이언트가 RTDB에 직접 호출해도 허용량을 넘길 수 없도록 **서버 강제 계정별 한도**가 필요하며, 확정 D1 좋아요 Worker 경로에서도 같은 계정 잠금 여부를 확인해야 함. 클라이언트 내 숨긴 버튼이나 localStorage 계정 차단은 우회 가능하므로 보안 완료로 처리 금지. 서버 시간·원자적 UID별 집계/만료·구형 앱 호환/RTDB Rules 상위 `.write` 영향 검증. 기존 RATE_LIMITER 활용 시 Worker 호출당 제한과 실제 클릭당 제한의 의미를 구분한다.
- 1시간 신규 조작 잠금은 **이미 성공적으로 접수된 원본 또는 영속 outbox 미전송 변경을 자동으로 삭제하거나 개인 하트를 임의 반전하지 않음**. 기존 최종 상태는 idempotent settlement로 수렴. RTDB 잠정 신호와 canonical 원본을 각기 우회 불가능하게 차단/정리. 정상 like 1회에 별도 Functions/D1/Firestore 비용성 요청 추가 최소화.
- **악성 다중 계정 우회**는 UID 한도로 완전 방지 불가: Firebase Auth/App Check 실제 enforcement 및 진짜 서버-side request suppression, multi-account velocity, 비정상 네트워크/기기 신호 비용 비교 별도. 한 IP 공유의 정상 가족/공유망을 무작정 잠그지 않음.
- RTDB Rules deny도 data egress 가능하므로 무한 '거절만 보내기' 공격에는 App Check/인증/상위 edge abuse control/budget alarm이 별도로 필요. 완전한 비용 0 공격 방어라는 주장 금지.

## 우선 개발/검증 경로 및 중단 게이트
1. **배포 전 read-only 감사:** app392 RTDB 실제 전송량·bytes/click·settlement 추가 transaction·10/50 pending 최대 패킷, 현재 Cloudflare Worker rate limiter의 실제 경로 및 원본/RTDB 우회 가능성을 정량화. 하루 100회 수준의 일반 계정과 10만명 월 총비용 예상 비교.
2. 클라이언트 연속 클릭 합치기(정상 첫 클릭 즉시 유지)·서버에서 atomic 60초 한도·2분 연속·1시간 잠금 **가장 단순·저렴하고 실제 우회 불가인 구조** 선택. 하나의 per-UID 카운터와 TTL 같은 최소 운영 정보만 저장, 미변경/재방문 모든 read/write 0.
3. RTDB Security Rules, canonical Worker, 필요 Functions/Admin 설정이 합쳐진 **전체 경로**에 한도 적용. 계정 전환/동시기기/구형 앱/REST 호출에서도 서버 강제. 공유 RTDB rules와 Worker TEST/PRODUCTION 호환 preflight 없이 배포 불가.
4. 실행형 레드팀 fixture: 1분 29/30/39/40/41 클릭, 2분 연속 limit, 진짜 1시간 만료/해제, 타기기 동시, direct RTDB 쓰기/REST/old app/Worker direct bypass, settled outbox 보존, 비용·최대 payload, 일반 사용자 1회 좋아요 지연·기존 app392 양방향 실시간 PASS, 공개 숫자 원본 무변경, TEST/PRODUCTION 영향 없음.
5. 완성 후 앱버전 릴리스 검증 및 **PREVIEW만** 정확 소스+rules+Worker 필요분 배포. 사용자에게 고강도 클릭 공격 재현 요청하지 않고 안전한 test account와 fixture로 검증. 필요 시 사용자는 정상 1회 탭과 우발 더블탭 정도만 확인.
6. 장기 Master 운영값은 기존 Admin과 Master 권한을 서버에서 분리. 관리자는 상태 조회만(권한 받은 자), Master는 값 수정·조기해제·감사. 실시간 비정상 활동 집계가 일상 사용 때 불필요한 D1 R/W 증가시키지 않도록 함.

## 현재 게이트
- **실제 제품 코드/공유 Firebase Rules/Cloudflare Worker 변경·배포 없음**. app392 개인 PC↔모바일 거의 즉시 동기화 보호.
- **기존 좋아요 서버 제한 존재**: Worker 60 HTTP batch calls / 60 s, 하지만 이 사용자 제기의 RTDB 악성 클릭을 제한한다고 오인하면 안 됨.
- **보안 완료 PASS 아님.** Stage416 ② 사용자 PASS/전체1/5 상태 유지. ③ 개인5분+Master 기능을 진행할 때 본 보안 설계·경제성을 선행 점검하고 위험 미해소는 별도 HOLD로 보고.
