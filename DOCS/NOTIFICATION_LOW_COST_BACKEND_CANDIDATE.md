# SORIDRAW 알림 저비용 백엔드 — 정본 이벤트 연결 후보 (2026-11-07)

**상태: CODE CANDIDATE / 공유 서버 미적용.** PR #866. PREVIEW/TEST/PRODUCTION은 사용자 원본 D1·Worker를 공유하며, 이번 수정은 실제 테이블/Rules/Worker에 배포하지 않는다.

## 실제 GitHub 정본 확정 경로 (코드에서 확인)
- 좋아요 현재 입력 `/v1/me/likes/batch`는 D1 `explore_like_user_queue_075` 접수로 끝날 수 있다. **`legacy-queued` ACK는 사용자 좋아요 확정이 아니므로 알림을 만들면 안 된다.**
- 실제 확정은 기존 `likes(track_id,user_uid,created_at)`에 INSERT 성공한 때다. 기존 deferred 075 및 direct legacy 경로 모두 정본 테이블의 실제 INSERT를 통과한다. 그래서 **서버 정본 INSERT 트리거** 후보로만 기록한다. DELETE(좋아요 해제), INSERT OR IGNORE(이미 좋아요)에는 새 알림이 없다.
- 팔로우 legacy 확정은 `follows(follower_uid,following_uid,created_at)` INSERT. overlay350/354는 `explore_follow_overrides_348`의 net-new INSERT 또는 `following=0→1` UPDATE가 정본 변경이다. overlay의 `duplicate` 또는 단순 프론트 클릭은 알림 근거가 아니다.
- actor와 receiver는 브라우저 제출값이 아니라 정본 행과 `tracks.owner_uid`에서 서버가 도출한다. 같은 사용자 자기 좋아요 및 비공개/미발행곡은 알림 제외.

## 권한·중복·보관기간·비용 계약
- D1 후보 스키마 `cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql`의 래치 `enabled=0`이 기본. 적용 전에도 기존 Writer 미변경, 모든 이벤트 발송 0.
- 한 수신자 + 2시간 버킷 + 유형 + actor + 곡/대상에 대해 **최대 한 행**, 기본 분류 활동·소식. 좋아요 해제·팔로우 해제는 새 알림을 발행하지 않음.
- `soridraw_notification_preferences_002`는 계정별 마스터/5종 설정을 작은 행 하나로 보관. 초기 읽기 기본 ON, 사용자 입력 변경 때만 revision CAS로 저장(일반적인 성공은 D1 명령 한 번, 중복/변경 없는 요청은 W0). 같은 UID의 PC/모바일이 서로 오래된 버전을 덮어쓰지 않도록 충돌을 돌려줌. 아직 UI 브라우저 localStorage와 연결되지 않았으므로 **서버 수집 활성화 전 기기 설정 이행과 새 클라이언트 롤아웃 검증 필수**.
- `readOwnNotificationInbox001`는 서버에서 인증된 UID만 사용하며 30개 한도, 최근 30일만 조회하고 다른 UID를 인자로 받지 않는다. D1 만료 인덱스로 1회 최대 200건 물리 삭제하는 **후보 cleanup**을 추가했다. 현재 자동 Cron 등록 없음, 따라서 운영 보관기간 준수는 미검증 상태.
- 공지는 `soridraw_global_announcements_001` 단일 전역 행에 한 번 저장하는 후보, 승인된 관리자 확인이 없으면 작성 거부. 사용자 10만 명에 10만 건 복제 금지.
- 비용은 가입자 수와 전체 곡 수에 비례하는 스캔을 만들지 않는다. 실제 신규 이벤트 1건에 수신자 데이터 1행 및 보관기간 인덱스 관리, 정본 대상 lookup/계정 설정 lookup이 추가된다. **D1 billed rows written/read는 테이블/인덱스/트리거 동작에 따라 증가하므로 W1 또는 월 비용 확정 선언 금지.** 삭제는 만료된 행 수에 비례하나 1회 최대 200행. 2시간마다 전체 사용자 조회/반복 백필 없음.

## 후보 회귀 증거
- `scripts/verify-notification-canonical-triggers-002.mjs` — Node 22 `node:sqlite`로 진짜 테이블과 트리거 생성, 래치 OFF, like/legacy follow/overlay follow, 재시도·해제·본인·비공개, 계정 설정/마스터 OFF, PC↔모바일 revision 충돌, 30일 조회·indexed 만료, 단일 글로벌 공지 검증.
- 기존 `scripts/verify-notification-inbox-candidate-001.mjs` 및 알림 패널 검사 연결. Worker 활성 `preview-entry.js`는 이 모듈을 import하지 않으며 실제 알림이 생성되지는 않는다.

## 실제 활성화 전 남은 위험 및 승인
1. 공유 D1 환경의 정확한 기존 3가지 Writer 버전과 `likes`/`follows`/overlay 실제 스키마·트리거·D1 physical read/write 증거를 읽기 전용으로 확인할 것. 현재 증거는 **소스와 격리 SQLite**에 한정된다.
2. 현재 서버 인증 `validateExploreAuth307`와 AppCheck를 붙여 정확한 UID만 조회·설정 변경 가능한 실제 HTTP route를 작성·검증할 것(현재 route 없음). 관리자 공지 발행 권한은 실제 staff/admin 권한 조회와 서버측 강제 검증 필요.
3. PC/모바일에 이미 저장된 로컬 OFF·개별 선택값 이행/일치, 재로그인, 구형 앱 공존 및 공통 2시간 관리자 설정을 서버와 일치시키는 정책 확정. **마스터 OFF 사용자에게 불필요한 알림을 절대 쌓지 말 것.**
4. 30일 물리 만료의 실제 bounded alarm/정리 실행, 초기 백로그 상한, 공지의 기간·삭제·캐시 TTL을 안전하게 검증. 새로운 전체 사용자 polling 금지.
5. 독립된 공유 DB 권한/트리거 안전성·이전 Writer 호환 검증 후 **별도 디렉터 승인**을 받고 D1 migration/Worker 실행. 일반적인 PREVIEW Hosting 배포 승인으로 공유 환경 변경 금지.

**완료 기준:** 실제 PC·모바일에서 정확한 확정 알림 전달과 기존 좋아요·팔로우 정상 동작, 설정 OFF의 서버 적용, 저장·읽기·삭제 비용 측정이 모두 PASS여야 실제 백엔드 완료.
