# app450 — 관리자 앱 설정(마스터 전용): 분할바 프레임 (설계/구현 명령)

## app450 독립 감사 발견 사항 수정 — 2026-10-22 KST

- 관리자 **적용**은 Firestore와 RTDB 동시 쓰기를 하지 않는다. 이중 쓰기는 첫 번째 성공·두 번째 실패 시 사용자에게 오류를 보여주면서 실제 상태가 일부 바뀌는 위험이 있다. **RTDB `publicSync/splitFrameModes/{environment}` 한 값이 유일한 권한 있는 설정 원본**이며, Master Callable 1회에서 RTDB write 1회로 확정한다. 기존 Firestore 메뉴 설정 문서는 읽거나 쓰지 않는다. Master 인증을 위한 기존 1회 사용자 역할 조회는 유지한다.
- 수신자는 PREVIEW/TEST/PRODUCTION별 **해당 환경의 RTDB 문자열 1개**만 구독한다. 세 환경의 전체 맵을 반복 내려받지 않는다. 알 수 없는 호스트는 이 추가 구독을 만들지 않고 기존 Hybrid 동작을 유지한다.
- 로그인 세션당 작은 RTDB 구독 1개가 추가되는 것은 그대로이며 **100,000명 접속 비용은 별도 검증 전 미합격**. 기존 메뉴 신호와 app448 분할 UI 변경 없음.
- 이후 이 문서의 오래된 Firestore+RTDB 이중 쓰기 설명은 위 최신 결정으로 대체된다. 공유 Rules PR #367 별도 감사·배포 승인 전까지 실제 앱은 app448.



## 최종 위치 재지시 — 2026-10-21 23:06 KST
- **사용자 최신 지시: 관리자 페이지 → 앱 설정** 위치로 복귀. 마스터 권한 페이지에는 새 탭이나 설정을 추가하지 않는다.
- **이전의 Master-only '적용' 권한은 계속 유지한다.** 관리자 앱 설정을 볼 수 있는 일반 Admin에게는 이 카드가 나타나지 않으며, 서버 callable은 반드시 Master 신분을 강제 확인한다. 사용자가 위치만 변경했지 전체 사용자 모드를 바꾸는 권한을 일반 Admin으로 완화하라고 지시하지 않았다.
- UI 화면: `AdminAppSettingsPage.tsx`에 `<MasterSplitFramePanel />` 추가, `MasterPermissionsPage.tsx`는 app448 파일과 byte-exact 동일. Master 권한은 사용자 프로필 캐시 갱신을 따라 표시 여부를 판단하고, 서버 `requireMasterCaller`가 최종 권한이다.
- 정확한 이름: **분할바 프레임**, **성능우선 / 보통 / 품질우선**.
- 이번 위치 변경은 UI/source PR #366에만 반영. 보안 Rules PR #367과 공유 데이터에는 손대지 않는다.

## 사용자 최종 수정과 안전한 전달 경로 — 2026-10-21 22:31 KST
- **화면 위치는 관리자 페이지 → 앱 설정**이며 마스터 권한 페이지는 변경하지 않는다. 설정 변경은 `requireMasterCaller`로 Master만 허용한다. 일반 Admin의 `appSettings` 권한으로 적용할 수 없다.
- **최종 이름** `성능우선` = Pure Pane, `보통` = Local Responsive, `품질우선` = Pure Pane Hybrid.
- 기존 TEST/PRODUCTION의 구버전 `adminSetNavigationVisibility` callable이 `publicSync/navigationVisibility`를 통째로 `.set`하므로 같은 노드의 신규 모드를 지우게 된다. 따라서 실제 구현에서는 **별도 작은 `publicSync/splitFrameModes` 경로**를 사용한다. 로그인 앱이 이미 가지는 동일 Firebase RTDB 연결에 1개의 tiny subscription이 추가된다. 새 Firestore 데이터 조회/D1 호출/페이지별 폴링 없음. 사용자 10만 명의 초기 실시간 subscription 전달량은 0이 아니므로 별도 비용 검증 필수. 기존 nav writer/QA 유지.
- PREVIEW/TEST/PRODUCTION은 형제 필드 하나씩 관리. 기존 사용자의 공유 원본 데이터 수정/복사 없음.
- 공유 RTDB Rules에는 `publicSync/splitFrameModes` 로그인 read + client write false + 세 허용값 validation **추가만** 필요. 실제 Rules 및 Functions 배포는 공유 영향 검증과 독립 감사 PASS 전 금지.
- 코드 구현과 PREVIEW 배포 성공은 구별한다. Master 서버 Callable과 공유 Rules가 검증되기 전에는 UI가 실제 전 사용자에게 전달된다고 보고하지 않는다.



## 사용자 최종 요구 (2026-10-21 22:10 KST)
마스터 권한 화면에 제목 **분할바 프레임**을 표시하고, 세 개 중 하나를 선택한 뒤 **적용**을 누르면 전체 사용자에게 가능한 한 즉시 반영한다.
**최종 명칭 변경 반영:** `최적우선`은 쓰지 않고 `보통`을 사용한다.

| 관리자 표시 | 정확한 기존 엔진 값 | 설명 |
|---|---|---|
| 성능우선 | `pure-pane` | 가장 가벼운 Pure Pane |
| 보통 | `local-responsive` | app448 당시의 Local Responsive. 생성바 반응형 전환이 드래그 종료 때 마무리될 수 있음 |
| 품질우선 | `pure-pane-hybrid` | 기존 정식 기본값. 드래그 중 화면 경계/생성바 전환 동기화 |

**초기 기본값은 반드시 `품질우선`(현재 코드의 Hybrid)으로 유지**한다. 신규 도입 자체가 전 사용자 동작을 바꾸어서는 안 된다.

## GitHub 확인 기준
- 구현 출발점 `preview` HEAD `2dc2cd30dc4f0d9d54c88ac2002fa60915995b4a`, 실제 Firebase PREVIEW는 **app448** source `b57c8f61eef364e03b1fa8f3fe07dd7d29e5fb31`, Firebase Action #39579346778 PASS. 해당 HEAD 이후 작업은 시작 시 다시 고정.
- `AdminAppSettingsPage.tsx`: 앱 설정/관리자 UI, `appSettings` 권한, 기존 관리자 저장 패턴 확인.
- `StudioSplitEngineWorkspace.tsx`: `v2DragPerfMode`로 엔진 모드를 전달. `LiteStudioSplitWorkspace.tsx`: 기존 각 모드의 실제 동작. **여기 내부 Geometry/CSS/drag rAF 코드를 이번 기능 때문에 고치지 않는다.**
- 이미 앱은 `src/services/navigationVisibilitySyncService.ts`의 RTDB `publicSync/navigationVisibility` 단일 실시간 신호를 기존 사용자의 메뉴 상태에 활용한다 (기존 QA `scripts/verify-214-navigation-visibility-sync.mjs`). `functions/src/index.ts`에 `adminSetNavigationVisibility` callable과 `requireAdminCaller(request, "appSettings")`이 있다.
- 공용 RTDB `database.rules.json` navigationVisibility 경로의 `.read`는 로그인 사용자만 허용, `.write`는 false (Functions Admin SDK 전용), `$other.validate=false`. 새 항목에는 하위호환 **추가 규칙**이 필요하다.
- 기존 `adminSetNavigationVisibility` RTDB 쓰기는 전체 `.set({...})`. 같은 노드에 새 설정을 추가하려면 메뉴 갱신 시 새 값을 지우지 않도록 서버 측에서 **값 보존**을 보장해야 한다. 기존 메뉴 저장 기능/권한/214 QA 결과는 유지.

## 최소 비용/안전 설계
1. 새 Firestore onSnapshot per-user, 타이머 polling, Worker/D1 쿼리, FCM/WebSocket 신규 인프라는 만들지 않는다. 추가 RTDB tiny signal 1개는 구버전 메뉴 writer 보호를 위한 허용 예외다. **기존 로그인 수신 흐름에서 `publicSync/splitFrameModes`라는 별도의 작은 RTDB sibling을 구독**한다. 구버전 메뉴 설정 callable의 `.set()`에도 삭제되지 않아야 한다. 추가 RTDB 구독은 로그인 세션 동안 유지해 페이지 이동/드래그로 반복 구독하지 않으며 Firestore read=0, D1 read=0 목표. 관리자가 한 번 적용할 때만 작은 서버 설정 write와 기존 연결의 작은 푸시 이벤트가 발생하며 10만 동시 접속자라면 방송량이 0이 되는 것은 아니다. 별도 재연결/데이터재생성 불필요.
2. `splitFrameModes: { preview, test, production }`로 **환경별 운영 상태를 분리**한다. 실제 사용자가 공유하는 canonical Firestore/D1 데이터와 이 파생 운영설정은 서로 다른 개념이다. PREVIEW 관리자 적용이 TEST/PRODUCTION 모드를 의도 없이 바꾸면 FAIL. 가능한 경우 설정 모드의 환경 결정은 단순 호스트 추측보다는 프로젝트의 기존 환경 매핑 유틸을 재사용해 엄격히 판별한다.
3. 원본 설정은 작은 `app_settings/navigation_visibility` Firestore 문서에 추가 하위호환 필드로 보관하여 기존 관리자 설정 로드/저장 시 **추가 getDoc 비용을 만들지 않도록** 한다. RTDB는 작은 실시간 복제/전달 경로다. Firestore 원본을 쓰는 서버 callable 1회 + RTDB 신호 1회. 기존 메뉴 서버 callable이 RTDB 신호의 splitFrameModes를 삭제하지 않아야 하며, 새 설정 callable도 메뉴 데이터를 손상시키지 않아야 한다.
4. 마스터만 누를 수 있는 **적용** 버튼. `requireMasterCaller`로 Master 권한을 서버에서 강제 검증, 입력은 세 값 중 하나로만 제한. 저장 중 중복 클릭 방지, 서버의 성공 응답 이후에만 '적용 완료'로 표시. 최신 저장값과 미적용 선택값을 구분하고, 실패하면 이미 적용된 값을 유지. 전체 변경이므로 확인 문구/적용 대상 환경을 함께 표시. 관리자 외 사용자의 쓰기/조작 차단.
5. 페이지에 현재 적용 중인 라벨/선택 상태를 표시하되 **실제 값은 서버 기준**. 새 사용자 캐시가 비어있거나 신호 실패 시에는 **기존 `pure-pane-hybrid` 안전 기본값** 유지. 이미 받아 둔 정상 설정이 있으면 새 빌드 진입/페이지 이동만으로 지우지 않는다.
6. **세션 중 즉시 적용**: 이미 기존 RTDB 신호를 받고 있는 호환 코드가 있는 활성 앱에서는 서버 적용 완료 후 수신 즉시 모드를 바꾼다. 사용자가 *바로 분할바를 드래그 중*이면 Geometry 경합 방지를 위해 해당 드래그 종료 시 안전하게 적용. 새로고침/페이지 이동을 강제하지 않으며 저장곡/목록을 다시 읽거나 React 전체 앱을 remount하지 않는다. 앱이 종료·오프라인이면 재접속할 때 반영. 앱 코드가 아직 구버전인 클라이언트는 기능을 모른다: 해당 환경 릴리스/업데이트 전까지 '모든 앱 즉시 적용'이라고 거짓 주장 금지.
7. 사용자 앱에서는 **기존 설정 수신**과 Studio Split 모드 선택만 연결한다. 기존 admin 진단 A/B는 사라지거나 거짓 표시되어서는 안 된다. 관리자 개인 진단 임시 모드는 **서버 전역 설정과 분리**하되, 전체 적용 결과를 시험할 수 있도록 현재 전역 모드 라벨을 표시.
8. 비로그인 사용자도 Studio를 사용할 수 있는지 먼저 실제 라우트로 확인할 것. 기존 RTDB 공용 신호는 인증자가 아닌 브라우저에서 수신 불가이므로, 로그인 전 Studio가 열리는 경우 모든 사용자 요구를 만족하는 안전한 보완 채널/캐시를 설계하고 보고. 위험한 RTDB 전체 공개 규칙 변경은 금지.
9. 서비스 재배포 순서는 실제 호환성 기준으로 나눠야 한다: 먼저 additive rules + Functions 서버 수정이 구버전 클라이언트/다른 환경과 안전하게 공존하는지 검증 → PREVIEW React 배포 → 사용자 PC/태블릿/모바일 검증 → 명시적 TEST/PROD 승인 후 동일 코드/서버 계약 승격. 기능 구현 **도중 공유 실사용자 data/schema의 파괴적 수정 금지**.

## 실제 UI 합격선
마스터 권한 화면의 신규 탭에 기존 디자인과 같은 카드 형태로 한 섹션만 추가. 제목 **분할바 프레임**. 3개 선택지 **성능우선 / 보통 / 품질우선**, 단일 선택. 옆에 현재 선택값과 `적용` 버튼. 선택만 하면 아무 변화 없음; 적용 시 환경별 전체 사용자 정책 전환. 기본 표시 `품질우선`.

## 회귀/성능 합격선
- 관리자 적용/권한없는 사용자 거부/적용 취소/네트워크 실패/연속 설정 클릭/다른 관리자 동시 변경.
- 이미 열린 **호환 PREVIEW 두 브라우저/PC↔모바일**에서 실시간 값 전파, 페이지 재방문/새 기기, 비로그인 경로, 오프라인 복귀. 단위 밀리초 '절대 즉시'를 주장하지 않고 전파 완료 여부와 지연 측정.
- 3가지 모드(특히 보통=정확히 app448 `local-responsive`)를 660/820/1080 및 외부 1100px 경계에서 각각 실제 검증. app449의 실패한 Generate 루트 모드 신호를 재도입하지 말 것. app448 생성바 Compact+PC <4px width drift 및 pointer-up geometry, app447 Note/Library 480px 탭, app445 콘텐츠 전환, app442 gutter, 기존 Pure Pane/Hybrid, 모바일 루트 보호.
- 실사용 드래그 속도 Pure Pane/Local/Hybrid 기존 대비 보전; CSS, 크기, 배치, 테마, 기능 변경 없음.
- RTDB/Firestore 비용: 관리자 1회 적용에만 작은 공유 설정 write, 화면 이동·드래그 재진입 Firestore/D1 추가 read=0, 신규 per-user listener/polling=0. 기존 연결 공유가 제대로 되는지 코드/QA로 확인. 각 기능의 데이터 원본을 이 옵션으로 바꾸지 않는다.
- `scripts/verify-214-navigation-visibility-sync.mjs` 회귀, `scripts/verify-303-studio-split-browser-history.mjs`, TS/Build/관련 TEST, Work 독립감사. 현재 공유 DB의 규칙 변경/Functions 배포는 스키마 및 전체 사용자 안전 검증 전에는 실행하지 않는다.

## 중단 조건
- 기존 RTDB 메뉴 채널의 값 손실/스키마 미호환, 비인증 사용자 갱신 불가 상태에서 무리하게 전 사용자 즉시라고 주장해야 하는 경우, 앱 전환 시 데이터 전체조회, app449 속도 퇴행, 기존 admin 진단/버튼 기능 파손, PROD 비의도 변경 발견 시 **FAIL + 원인 보고**, 배포/승격 중단.

## 현재 완료/미완료
- **설계 및 GitHub 실상 확인 완료**. 이 문서만으로 기능이 생기지는 않음.
- **실제 코드 구현, 테스트, 실시간 백엔드, PREVIEW 배포, 사용자 실사용 검증은 아직 미실시.**
- 구현은 Codex High → 독립 Work 감사 → ChatGPT release gate → PREVIEW 검증 순서로 진행하며, 사용자에게 완성했다고 보고하지 않는다.
