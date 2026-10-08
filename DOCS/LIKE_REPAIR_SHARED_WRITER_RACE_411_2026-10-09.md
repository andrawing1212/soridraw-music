# Stage411 — 기존 공유 R2 작성자 충돌 원인 추적 (수정 아님)

기준 Stage410 제품 `40c20516fc58ea35fe7e58b30e4843254380e2aa`. `patches/060-shared-profile-r2-parity.mjs`의 `writeExploreSharedProfile060`와 `patches/062-shared-track-card-r2.mjs`의 `writeSharedTrackCard062`는 공유 R2 PUT에 CAS `onlyIf`나 좋아요 확정 revision fence가 없다. 기존 발행/프로필 세팅 및 좋아요 카드 복원 경로가 stale data를 받아 R2 공개 정보를 거꾸로 덮을 가능성을 **구조적으로** 확인했다. 실제 발생 빈도는 확인되지 않았다.

Stage410은 Feed CAS 실패 재시도 중 신규 미선정 곡이 추가되는 경우만 보수적으로 복구한다. 이미 stage191 프로필을 완료한 다음 다른 작성자가 구형 프로필로 덮을 경우, Feed는 최신이어서 다음 stage191로 복구할 근거가 사라진다.

## 격리 재현

`scripts/verify-411-existing-r2-writers-restore-race.mjs`는 patch060/062의 unconditional R2 PUT 구현을 소스에서 확인하고 실제 stage191 함수를 VM 격리 실행한다. 가상 외부 오래된 profile PUT을 Feed 마지막 PUT 직전에 주입해 Feed=1/card=1/profile=0, 다음 실행에서도 profile=0인 반례를 강제로 검증한다. **검사의 PASS는 이 위험이 재현됐다는 뜻이지 릴리스 안전 PASS가 아니다.** 실제 R2/DO/D1 원본은 읽거나 수정하지 않는다.

## 제품 보호와 최소 다음 조치

1. 구형 060/062 작성자에서 별도 비용을 발생시키는 모든 읽기 재시도 대신, 원본 revision/ETag·카드/프로필 live provenance를 먼저 조사한다. 어떤 공개/프로필 정상 변경도 막거나 최신 likeCount를 역행시키지 않는 범위에서만 수정한다.
2. 191 변경 전후 부분실패/미등록 카드/동시 출판·좋아요 해제(숫자 하락)·같은 기기/다른 기기·구형 앱 모두 자동검사. R2 비용의 새 주기적 조회/전역 scan 금지. D1 W1~W2, 페이지 R0 보호.
3. 전체 품질검사 PASS, Work 독립검증, PREVIEW active Worker read-only 확인 및 실비용/PC·모바일 확인 후에만 배포. `diagnose-069-live-like.yml` push 실패는 별도 기존 이슈로 유지. 

Stage411은 **제품 코드 변경·데이터 변경·배포 없음**, 테스트·문서/자동 품질 연계만 추가.
