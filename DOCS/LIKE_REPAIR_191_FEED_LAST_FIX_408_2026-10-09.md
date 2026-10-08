# Stage408 — 기존 좋아요 복구 191 부분실패 재시도 최소 수정 결과 (2026-10-09 KST)

## 무엇이 바뀌었나

- **기준**: `preview` `bdcc0410aa502e92566b29993d9d27afe48a8734` (Stage407 실제 191 함수의 부분실패 후 재시도 누락 재현).
- **수정 파일은 기존 Worker 진입 함수 1개만**: `cloudflare/explore-worker/canonical/preview-entry.js`의 `repairSharedPublicLikeCounts191()`.
- **수정 원리**: 변경 후보 1회 선택은 기존 최신·인기 R2 Feed를 읽어온 데이터로 미리 계산한다. **해당 곡의 공개 카드·프로필을 먼저 복구하고, 마지막에 Feed 최신·인기 캐시 숫자를 갱신**한다. 카드·프로필 갱신 실패 시 Feed는 아직 이전 숫자로 남아 다음 alarm 재시도에서 같은 곡을 다시 선택할 수 있다.
- 신호 수집 단계에서 D1 추가 쿼리 0, 기존 정상 Feed에서 전체 카드/프로필 R2 추가 조회 0, 기존 개별 카드/프로필 R2 CAS 변경 방식 유지, 기존 `oneTime` marker 유지.
- `069/075` 좋아요 정산·W1 접수·30초 묶음·좋아요/해제·기기 캐시·RTDB 신호·팔로우·UI·Music Note·Library **전혀 수정하지 않음**. 공유 D1/Firestore/R2 사용자 데이터는 실제로 변경하지 않음.

## 실제 검사 결과

- **[기능 격리 Run 37833820477](https://github.com/andrawing1212/soridraw-music/actions/runs/37833820477): SUCCESS**. 원본 191 실제 함수 실행, Miniflare local D1 + 가상 R2/CAS fault injection **10/10 PASS**:
  - 정상 상태에서 R2 쓰기 0, D1 정산 SQL에 추가 호출 0
  - 기존 오차 4개 R2 object 모두 정정, 두 번째 실행에서 추가 쓰기 0
  - 카드 정상화 후 프로필 PUT 1회 실패→Feed는 구버전 유지→다음 복구에서 프로필과 Feed 모두 정상화
  - 재시도 중 이미 복구한 카드 PUT 반복 없음
  - Feed PUT 1회 실패→카드·프로필 완료 유지→다음 Feed 재시도 후 전체 정합성 확보, 카드·프로필 추가 PUT 없음
  - **여전히 미해결**: 이번 수정 전부터 Feed만 이미 정상이고 카드/프로필만 옛날 숫자인 기존 orphan 상태는 191의 Feed 차이만으로 자동 발견 불가. R2 카드별 전체조회로 해결하는 시도는 비용 때문에 금지. 별도 보수적 복구 근거 필요.
- **[제품 정적 품질 Run 37834477289](https://github.com/andrawing1212/soridraw-music/actions/runs/37834477289): SUCCESS**:
  - `node --check canonical/preview-entry.js`: PASS
  - TypeScript `npm run lint`: PASS
  - Vite `npm run build`: PASS
  - 앱 변경 없는 기존 필수 범위의 `verify-178`, `verify-191`(실제 R2 CAS retry), `verify-192`, `verify-197`, `verify-390`: PASS
  - **주의: 127/175 검사 자체는 FAIL**: 127은 현재 서비스 소스에 없는 `deferredSignal390` 문구를 기대했고, 175는 `gap repair flag missing` 정적 검사 실패. 이번 단계의 diff는 관련 `src/services/exploreLikeService.ts`·127/175 테스트를 수정하지 않았다. QA Workflow는 이 둘을 `continue-on-error`로 **별도 노출**, 나머지 검사는 엄격하게 실행한다. 따라서 이 Actions run SUCCESS는 모든 기존 검사가 녹색이라는 의미가 아니다. 해당 기준 불일치 원인·동작 동등성 별도 확인 전 릴리스 보류.
  - 기존 별도 `diagnose-069-live-like.yml` push 실패 역시 별도 미해결이다.

## 보호되는 기능과 남은 위험

- 정상 동작이 사용자 실사용으로 확인된 기존 좋아요(app160/164 이후), app382/W1 정산과 로컬 좋아요 UX, 구형 앱 수신을 재작성하지 않음.
- R2 동시성(다른 Worker가 같은 카드/Feed를 동시에 쓰는 경우), 실서비스 active Worker bundle/Binding, PC↔모바일/타계정 공개 숫자/기존 orphan 검증은 **미완료**.
- CAS는 원래 ETag 기반을 사용하지만 여러 R2 object 간의 원자 트랜잭션은 없음. 따라서 모든 경쟁 상황에서 동시 최신 수렴 증명이라고 말하지 않음.
- 기존 실패에서 남은 카드만 불일치한 데이터를 대량으로 조회/덮어쓰지 않음. 사용자 데이터 원본 변경 0.
- 추가 D1 쿼리 구조를 만들지 않았지만 실서비스 R/W 청구, R2 연산, DO/RTDB 비용이 미측정이므로 전체 비용 절감 완료라고 주장하지 않음.

## 릴리스 결론

**PREVIEW branch 코드 수정 및 검사 완료, 배포 안 함.** 현재 `preview.soridraw.com`은 Stage408 코드를 제공하는 것으로 가정하지 않음. 독립 감사/127·175 테스트 정합성 검증/Worker 결합 및 실제 PREVIEW PC·모바일 검증 전에는 Worker/Functions/RTDB Rules/공유 D1 변경·배포 및 TEST/PRODUCTION 승격 금지.

## 다음 최소 작업

1. Stage408 단일 함수 변경의 **기존 코드 대비 독립 감사**(정상 Feed 병행 좋아요·해제/다중 계정 R2 CAS 경쟁·마지막 값 우선/발행순서) 및 127/175 검사 실패 근거를 정확히 확인.
2. 원본 DB/R2·RTDB 비용 비교, 사용자가 공유 데이터를 안전하게 보호하는 상태에서만 PREVIEW Worker 배포 별도 사용자 승인 후 검증.
3. 과거 orphan 상태가 사용자에게 실제 남아 있다면 전체 재생성 말고 일부 관리자/테스트 계정 범위에서 ID 지정한 복구만 따로 설계; 공유 데이터 대량 변경은 승인 없이 금지.
