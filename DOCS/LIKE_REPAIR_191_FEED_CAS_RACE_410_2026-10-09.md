# Stage410 — 191 Feed CAS 중 뒤늦게 등장한 불일치의 복구 누락 보호

## 왜 수정하는가

기준 preview SHA `80406449c038d89aa33fbb9adb2df308978669c2`. 독립 감사에서 가상 두 곡(A/B)으로 재현: A는 최초 Feed만 구형, B는 최초 정상; 카드·프로필에 A를 먼저 복구한 직후 다른 writer가 B의 latest Feed 및 카드·프로필을 구형 숫자로 변경하여 Feed CAS가 1회 실패. Stage409은 Feed 최신 값을 재읽으면서 B도 바로 목록에 1로 고쳐 저장하나, B는 staged `changed` 목록에 없으므로 카드·프로필은 0 그대로 남는다. 다음 191 실행은 Feed A/B가 모두 최신으로 보이므로 B를 발견하지 못한다. 부모 `bdcc0410aa50`은 이 시나리오에서 카드·프로필도 다음에 갱신했다.

## 최소 변경

- `cloudflare/explore-worker/canonical/preview-entry.js`: 마지막 Feed R2 CAS retry loop에서 처음 staged `changed`에 없는 새로운 숫자 불일치를 만나면 **Feed PUT 전에 오류를 내고 일시 중단**한다. Durable Object alarm은 실패를 유지하여 다음 bounded 실행에서 새 변경 ID까지 선정 후 카드·프로필 선정착 → Feed 완료한다. 기존 8회 CAS·조건부 ETag·oneTime marker·신규 D1 read/write는 변경하지 않는다.
- `scripts/verify-407-exact-191-replay-recovery.mjs`: 로컬 두 번째 공개곡을 넣고 새 Feed CAS 경쟁이 발생할 때 미완료 유지, 다음 실행에서 공개 카드/프로필·두 Feed 일치 확인을 포함한다.
- 현재 정상 구조(069/075 좋아요 정산, W1 접수, 30초 묶음, 개인 하트, 팔로우, 캐시, UI, Studio, Music Note)는 수정하지 않는다.

## 검증과 차단

- 원본 191 함수 부분 격리 스모크에서 구버전 불일치 유지→개선 후보 첫 실행 fail-closed→다음 실행 전체 수렴 관찰. 정상 경로 추가 D1/R2 호출 없음은 정적 diff 기준이며, 실제 운영 전체 비용은 미측정.
- 자동 검사(TypeScript, Build, 127/175/178/191/192/197/390, 398~407 Miniflare)와 Work 독립감사/활성 PREVIEW Worker parity/PC↔모바일/실사용 D1 W1~W2 확인 전 **릴리스 불가**. 해당 검증은 신규 CI 결과를 확인하고 따로 기록해야 한다.
- 오래된 상태에서 이미 Feed만 최신·카드/프로필만 구형인 기존 orphan은 여전히 이 guard로 복구하지 못한다. 전체 카드 일괄 읽기로 해결하지 않는다.
- 069 live like push 진단 실패 미해결. 보안/Rules/migration 없음. 공유 사용자 D1·R2 데이터 변경·Worker/Hosting/Functions 배포 및 main/TEST/PRODUCTION 변경 금지.
