# SORIDRAW 작업·배포 고정 지침

> 이 문서는 새 채팅/Codex/Work가 공통으로 따르는 영구 규칙이다. 현재 구체 상태는 `CURRENT_RELEASE_STATE.md`를 우선한다.

## 1. 브랜치와 환경
- `preview` → PREVIEW 개발/검증 → `preview.soridraw.com`
- `main` → TEST 승인본 → `test.soridraw.com`
- 검증된 `main` + 명확한 사용자 승인 → PRODUCTION → `soridraw.com`
- 기본 배포는 Firebase. Vercel은 사용자가 명확히 요청한 경우만 사용한다.
- 큰 수정은 `preview`에서 시작한다. `preview`와 `main`을 임의로 섞지 않는다.

## 2. SORIDRAW 데이터 운영 의도 — 중요
- PREVIEW / TEST / PRODUCTION은 **기능 코드 검증 단계**다.
- 사용자 데이터는 세 앱에서 동시에 보존·공유하는 것이 현재 운영 의도다.
- Music Note처럼 같은 계정 데이터가 세 앱에서 일관되게 보이는 것이 기준이다.
- Explore도 사용자 공개곡/공개프로필/좋아요/팔로우/통계/사용자 미디어의 원본은 공유 기준을 사용한다.
- 환경별로 분리할 것은 Worker/Hosting/코드 버전/파생 Cache/속도제한/진단 상태다.
- 릴리스 승격 때 사용자 데이터를 PREVIEW→TEST→PRODUCTION으로 복제하는 작업을 기본 절차로 사용하지 않는다.
- 공유 원본의 스키마 변경은 이전 TEST/PRODUCTION 코드가 계속 읽을 수 있는 **추가형·하위호환** 방식이 원칙이다.

## 3. 비용 절대 기준
목표: 사용자 수가 10만 명으로 늘어도 업데이트/페이지 재방문 때문에 비용이 폭증하지 않게 한다.

- 앱 업데이트만으로 D1/Firestore 사용자 데이터 전체 재조회 금지.
- 앱 업데이트만으로 공개프로필/Feed 전체 재생성 금지.
- 페이지 진입/재방문/새로고침만으로 write 금지.
- 정상 로컬 캐시가 최신이면 서버 data read 0 목표.
- 실제 mutation만 서버에 반영한다.
- mutation은 변경된 항목만 처리한다. 총 곡 수/사용자 수에 비례하는 전체 scan 금지.
- 좋아요 한 번 때문에 latest+popular 전체 Feed를 다시 만드는 구조 금지.
- 공개/비공개 한 곡 때문에 공개프로필 전체를 다시 읽거나 전체 Feed를 재생성하는 구조 금지.
- 서버에서 전체 목록이 필요한 최초 사용자는 가능하면 이미 만들어진 공용 캐시/번들을 받아야 하며, 사용자마다 원본 DB 전체 조회를 반복하지 않는다.
- 실시간성은 비용보다 우선하지 않는다. 수 초 단위 즉시 갱신이 필요하지 않은 공용 화면은 변경분을 묶고 캐시를 우선한다.

## 4. Music Note 보호
- 현재 검증된 원칙: 사용자 편집은 로컬 즉시 반영, 여러 수정은 60초 동안 묶어서 서버 저장, 종료/백그라운드 시 남은 변경을 안전하게 마무리.
- 페이지 이동/재진입만으로 불필요한 Firestore read/write를 만들지 않는다.
- 향후 기기간 빠른 동기화가 필요하면 전체 재조회가 아니라 '변경 있음' 신호 + 변경분만 가져오는 방향을 우선한다.
- 현재 정상 경로를 Explore 최적화 작업과 섞어 수정하지 않는다.

## 5. 데이터·UI 안전
- 기존 Firestore/Auth/Functions/Rules/App Check/CORS/Secrets/Cloudflare D1/R2 호환성을 먼저 확인한다.
- 기존 데이터를 못 읽거나 덮어쓸 위험이 있으면 작업을 중단하고 보고한다.
- 데이터 삭제·대량수정·migration·PRODUCTION 변환은 승인 없이 금지.
- 사용자 요청 없이 외곽선, 위치, 크기, 간격, 반응형, 테마를 바꾸지 않는다.

## 6. 구현/검증 분리
- 설계가 확정되면 Codex가 `preview`에서 구현한다.
- Codex 권장: High. 데이터 migration/손실 위험/동시성 문제가 실제로 필요해지는 경우에만 Extra High로 올린다.
- Codex 결과는 commit SHA로 고정한다.
- Work는 그 commit을 독립적으로 감사한다. 기본적으로 코드를 수정하지 않는다.
- 감사에서 실패하면 TEST 승격을 중단한다.

## 7. 배포 완료 기준
완료 보고 전 최소 확인:
- 대상 commit 고정
- TypeScript 성공
- Build 성공
- 필요한 Test 성공
- 필요한 Worker/Functions/Hosting 성공
- Firebase/Cloudflare 설정 확인
- 필요한 D1/R2/Firestore 상태 확인
- 실제 목표 주소 확인
- PREVIEW/TEST 결과 비교
- 다음 환경/PRODUCTION 비의도 변경 없음 확인

하나라도 실패하면 다음 승격을 중단하고 '미완료'로 보고한다.

## 8. 새 채팅 인수인계
새 채팅에서 과거 대화를 재구성하지 않는다.
1. `AGENTS.md`
2. `CURRENT_RELEASE_STATE.md`
3. 현재 branch HEAD와 최근 commit
4. 필요 시 실제 Firebase/Cloudflare 상태
만 확인한 뒤 이어간다.
