# Stage420/416 실운영 전환 안전 검증 및 실행 순서 — 2026-10-11

**성격:** GitHub `preview` 80bb23c9ea61d0437359d89ee797b3dce11658c7 기준, ChatGPT 직접 **소스 대조**. Codex의 자동검사와 분리된 검토이나 **Work 별도 실행 독립 감사 아님**. Firestore/RTDB 실데이터 읽기·쓰기, Hosting/Worker/Functions/Rules 배포, 실기기 p95 측정은 하지 않았다.

## 확정된 연결 차단 — 단순 QA 추가로 해소되지 않음

1. **수신 경로 불일치:** `src/services/exploreLikeGuardedTransport420.ts`는 `privateLikeSync420/{uid}/display`만 구독한다. `functions/src/exploreLikeAtomicLedgerCandidate420.ts`의 Firestore receipt 이벤트·복구는 `.../displayV2`만 쓴다. `database.rules.json`의 기본 `.read=false/.write=false` 아래 `privateLikeSync420`의 클라이언트 표시 권한이 실제 반영되어 있지 않다. 따라서 새 이벤트를 연결하면 **사용자 화면으로 전달되지 않을 수 있다.** Rules 단독 승격은 금지.
2. **현재 운영 Master와 새 승인 권한 불일치:** `functions/src/index.ts`의 `masterUnlockExploreLike420`, `masterGetExploreLikeLimit420`, `masterSetExploreLikePolicy420`는 현재 RTDB 상태/설정을 대상으로 한다. Firestore 원자 승인 후보는 `privateLikeGuardV2_420/{uid}`를 rate authority로 사용한다. 새 Master unlock helper는 `requireMasterCaller`에 실제 연결되지 않았으며 실서비스 callable이 아니다. 같은 잠금·조회·감사·정책 UI와 새 approval authority를 함께 옮기기 전 120분 잠금이 우회되거나 해제가 무효일 위험.
3. **서버 재전달 실가동 아님:** `createLikeReceiptDeliveryTriggerCandidate420`에는 `retry:true`, 23시간 경계 단건 HOLD 기록·Master 인증 뒤 단건 복구 helper가 있으나 `functions/src/index.ts`에서 trigger를 export/등록하지 않고 Cloud Monitoring 경보/자동 운영 복구도 없다. PASS는 memory mock/TypeScript/CI 기준. 이벤트가 23시간 이상 복구되지 않으면 HOLD만 남아 PC↔모바일 자동 수렴을 보장하지 못한다.
4. **이전 앱의 승인 증명 없음:** 운영 app396의 UUID v4 pending을 Firestore 신규 receipt로 소급 승인할 수 없다. 원본 증거 없이 서명증표 발급/재전송하면 중복 승인·금지된 사용자 데이터 변환 위험. 정확한 단건 원본 증거가 없으면 **보류 또는 명시적인 사용자 재확인**이 필요.
5. **구형 앱 무중단과 즉시 우회 폐쇄의 충돌:** 이전 열린 탭과 동일 Firebase Auth를 가진 임의 SDK 호출은 공유 RTDB Rules만으로 신뢰성 있게 구분하기 어렵다. 기존 `userSync/{uid}/exploreLikeIntent416` 직접 쓰기를 허용하면 새 120분 보안 제한을 우회할 수 있고, 즉시 차단하면 구형 앱의 정상 전송이 막힐 수 있다. **안전한 강제 업데이트/기존 pending 정리 기간에 관한 디렉터 승인이 필요**하다.

## 다음 구현을 한 묶음으로 진행할 순서 (코드 기능 변경은 Codex High, 별도 감사는 Work)

1. **비활성 상태에서 사용자 수신 호환 먼저 완성:** 앱은 구형 `display` 이벤트를 그대로 처리하되, 활성화 가능 경로에 `displayV2` 이벤트도 UID 단위로 병렬 수신하고 이벤트 ID/버전 별도로 중복·역순·진입 초기 snapshot을 처리하게 준비한다. 구형 좋아요·팔로우·Studio 저장 하트는 변경하지 않는다. 공유 Rules/데이터는 아직 변경하지 않는다.
2. **Master 원자 권한 경로 완성:** 신규 Firestore 잠금 조회·단건 해제·불변 감사·동일 호출 재시도 W0를 이미 존재하는 `requireMasterCaller` 서버 검증과 결합할 수 있도록 설계한다. 현재 RTDB 정책에서 새 Firestore 정책으로 전환하는 순간과 이전 운영 기능의 backward compatibility를 명시한다. UI는 승인 없이 변경하지 않는다.
3. **이벤트 운영 준비:** `onDocumentCreated` 실제 함수 export 준비, 오류가 성공 ACK로 사라지지 않는지 Firebase Emulator에서 확인, 23h HOLD에 실운영 경보·Master 단건 확인/재전달·이력 보존기간과 TTL 계약을 붙인다. 월 재시도 상한·HOLD 수·경보 실패의 보수적 처리·복구 후 실제 listener 수렴을 검증한다. **배포는 아직 금지**.
4. **구형 앱 경계와 보안 cutover 결정:** 미처리 v4는 승인 영수증을 위조하지 않는다. 구형 탭 강제 업데이트/유예기간/안전한 사용자 재확인 UX 중 하나를 사용자 승인으로 선택한다. 구형 직접 쓰기 종료와 새 인증·Worker 서명필수 적용을 **같은 검증 릴리스**로 취급하며, Rules/Functions/Worker 각각 rollback 조건 마련. 단독 부분 배포 금지.
5. **실측/승격 게이트:** Firebase Emulator + 구/신 앱 혼합+다중 탭+실기기 PC/모바일, 51/257/1001 op 동일 영수증 replay W0, 업데이트 read0, 잠금 120분, Worker171 canonical, 실제 API/D1 청구행수, 한국 모바일 p95. PREVIEW 실주소와 TEST/PROD 환경 차이, exact artifact/기존 PWA 캐시의 회귀를 검사한 뒤에만 ⑤~⑩ 게이트 갱신.

## 총비용 검증 전제 (실측값 아님)

100,000 DAU × 하루 5회 × 30일 = **1,500만 회** / 하루 20회 = **6,000만 회** 승인 시도 가정. Firestore 원자 후보의 최초 승인 모형은 건당 `receipt + rate` **2R/2W**이므로 요청의 전부가 신규 승인이라면 월 reads 3천만~1억2천만, writes 3천만~1억2천만의 명목 작업량. 실제 반려·기본 무료량·지역·TTL 삭제·트랜잭션 재시도에 따라 달라진다. Eventarc 실행 1,500만~6,000만, HOLD/복구 별도. 이전 문서의 8,105 bytes × 이벤트 수 = 약 121.6/486.3 GB는 RTDB 트랜잭션의 **가상 직렬화 총량**이지 실제 네트워크 송신량/청구 egress가 아니다. listener fanout·탭 수·연결시간·Functions CPU·Firestore TTL·RTDB 다운로드·Worker/DO/D1/R2/캐시를 함께 계측해야 한다. **W3+만으로 기능을 불합격 처리하지 않고**, O(1) 변경분, 전체 서비스 월비용, 서버 반복 read와 기존 기능 정확성으로 판단한다.

## 정확한 현재 판정

- **소스 후보 품질:** 9efc4d0a 기반 GitHub 408 Run 38116576707 SUCCESS (기존 TypeScript/Build/회귀), 이번 자체 Work 실행/실서버 통합검사 아님.
- **Stage420 운영 전환:** **FAIL/HOLD**. 게이트 ①~④의 소스/모형 PASS를 ⑤~⑩ 실운영 PASS로 확대 해석 금지.
- **전체 Stage416:** 1/5 큰 단계 완료 20% + 현 단계 4/10 × 2%p = **28%**.
- **앱396 속도 개선:** 5/5·100% (기존 문서 자동검사, 현재 별도 물리기기 검증 아님).
- **보호 상태:** `EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE=false`, Worker426 OFF, 공유 원본/Rules/Firebase/Cloudflare/TEST/PRODUCTION 모두 이번 감사에 의한 변경 없음.
- **다음 한 작업:** Codex에 위 1~3의 **실제 수신+Master+재전달 한 묶음 통합 코드**를 비활성 상태로 구현·CI 검증하도록 넘긴 뒤 Work 별도 독립 감사. 어떤 공유 Rules 전환이나 실제 운영 데이터 변경도 별도 승인 이전에는 수행하지 않는다.
