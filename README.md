## 623차 — 뮤직노트 분할 드래그 App 루트 재렌더 억제

- 622를 기준으로 분할 엔진/분할선/라이브러리/최근 생성곡은 그대로 유지한다.
- 실사용 영상 기준 뮤직노트는 라이브러리보다 약 10~20% 늦게 따라오는 체감이 남았고, 특히 분할바를 좌우로 반복할 때 PC/Tablet 경계를 넘는 순간 반응 타이밍 차이가 컸다.
- 605~607에서 이미 확인했던 원리를 최소 범위로 재적용했다: 분할 드래그 중 `data-soridraw-builder-mode`가 바뀌어도 **뮤직노트 화면에서만** App 루트의 `isSplitBuilderActionMobile` React state 동기화를 잠시 미룬다. CSS는 같은 root attribute를 직접 읽기 때문에 화면 반응은 계속 즉시 유지된다.
- pointer-up의 `soridraw-split-drag-end`에서 React state를 1회 동기화한다. Library / Recent / Create / Galaxy Tab 경로는 기존 즉시 동기화를 유지한다.
- 새 진단 UI, 새 ResizeObserver, 새 레이아웃 읽기, 페이지별 분할 엔진은 추가하지 않았다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 613차 — 뮤직노트 가로 스크롤 컨테이너 병목 격리 + 자동 병목 스캔

- 612 실사용 결과에서 `자동 / 기존 방식 / V2` 모두 뮤직노트만 느리고, 같은 자동 환경의 Recent/Library는 정상임을 기준으로 분할 엔진을 원인에서 제외했다.
- 뮤직노트 각 곡 행에는 라이브러리와 달리 `제목`과 `키워드` 두 개의 긴 native horizontal scroll container가 동시에 있고, 키워드는 장르/분위기/주제/Situation/스타일/사운드/보컬 칩 전체를 직접 자식으로 가진다. 결과 pane이 1px씩 변할 때 Chromium이 이 두 scrollable-overflow tree의 intrinsic/overflow geometry를 반복 유지하는 경로를 이번 차수의 주 병목으로 격리했다.
- 키워드 칩을 `soridraw-musicnote-keyword-track` 한 개의 max-content track 안으로 묶고, 제목도 기존 max-content span에 전용 track class를 부여했다. 정상 상태의 수평 스크롤 기능/디자인은 그대로 유지한다.
- 분할바를 잡고 있는 동안에만 Music Note 제목/키워드 viewport를 `overflow: clip`으로 바꿔 native scroll-container 갱신을 끊고, 두 max-content track을 독립 layout/paint island로 둔다. pointer-up 즉시 기존 `overflow-x:auto`가 복구된다.
- 같은 Music Note 전용 drag guard를 Lite V2뿐 아니라 기존 splitter의 `html.soridraw-split-dragging` 경로에도 적용했다. Library/Recent/Create/갤탭의 이미 통과한 경로는 변경하지 않는다.
- 관리자 기존 `렌더 스캔`에 `뮤직노트 제목 OFF / 키워드 OFF / 제목+키워드 OFF` 자동 A/B를 추가했다. 이번 수정이 충분하지 않을 경우 한 번의 자동 스캔으로 제목/키워드/기타 영역 중 실제 비용 주체를 바로 좁힐 수 있고, 진단 기능은 관리자 내부에 계속 보존한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 612차 — 화면별 검증 경로 복원 + PC 뮤직노트 전용 reflow 경량화

- 611의 핵심 오류를 수정했다. **PC 전체에 하나의 분할 엔진을 강제한 것이 문제**였고, 실사용 검증에서 이미 화면별 최적 경로가 달랐다.
- AUTO 라우팅을 입력환경 × 화면 기준으로 분리했다.
  - 갤럭시탭/터치 우선 환경: Music Note / Library / Recent 모두 검증된 Lite V2 adaptive 경로 유지.
  - PC Recent/Create: 기존 `StudioSplitWorkspace` 유지.
  - PC Library: Lite V2를 사용하되 **590의 CSS-variable geometry를 PC/Tablet/Mobile 시각 모드와 무관하게 고정**.
  - PC Music Note: Lite V2 direct pane geometry를 고정하고 Music Note 카드의 텍스트 flex intrinsic-size 재계산만 drag 중 격리.
- Music Note 전용 reflow 가드는 `soridraw-musicnote-song-copy`의 inline-size/layout/style containment와 title/keyword strip의 layout/style/paint containment만 사용한다. 높이나 반응형 상태를 freeze하지 않아 드래그 중에도 실제 폭은 매 프레임 따라간다.
- 갤탭에서 이미 통과한 V2 경로와 Library 590 경로에는 Music Note 전용 CSS를 적용하지 않는다.
- 관리자 `자동 / Lite V2 / 기존 방식` 강제 비교는 유지한다. `Lite V2` 강제 선택은 기존 adaptive V2를 그대로 사용해 진단 기준을 보존한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 605 - Real-hand layout acknowledgement + responsive conflict diagnostics

- Keep the **604/602 runtime behavior unchanged**. This step measures why Music Note can report high rAF FPS while still feeling as if the content is being pulled from behind.
- During a real divider drag, attach one temporary `ResizeObserver` to the two pane boxes. It consumes the observer-provided border-box sizes only; there are **no drag-time geometry reads** and no forced-layout measurement loop.
- Compare geometry writes with browser layout acknowledgement: acknowledgement rate, gap average/P95/max, write→ack latency, acknowledged-width error, and acknowledgement-per-commit ratio.
- Record pointer gap P95/max and commit-per-pointer efficiency so human input cadence is separated from rendering cadence.
- Count actual pane-mode and content-responsive-mode transitions while dragging. This directly tests whether PC/Tablet/content breakpoints are repeatedly fighting the Lite V2 geometry path.
- The existing Music Note ↔ Library real-hand comparison includes all new metrics in the full report. Recent Songs and normal runtime layout/design are untouched. No Firebase/Auth/Firestore/Functions/storage schema changes.


## 604 - Music Note / Library real-hand drag synchrony diagnostics

- Keep the **603/602 runtime geometry unchanged** so the diagnostic does not contaminate the current hand feel: Music Note remains direct geometry; Library/Recent/Create remain the 590 CSS-variable path.
- Add a paired **real-hand drag** workflow for Music Note and Library. The tool switches to each workspace in turn and waits for one 4–6 second manual divider drag, then restores the original workspace.
- Record the factors that actually determine perceived drag smoothness without adding layout reads in the hot path: pointer event rate, coalesced sample rate, real pane-width commit rate, commit-gap average/P95/max, commit coverage per rAF, pointer-to-commit delay, frame P95/max, Long Tasks and browser render cost.
- Manual drag results are included in the comprehensive copied report as `[MUSIC NOTE / LIBRARY REAL HAND DRAG]` so automatic FPS and real-hand cadence can no longer be confused.
- Normal runtime layout/design and Recent Songs are untouched. No Firebase/Auth/Firestore/Functions/storage schema changes.


## 603 - Music Note / Library paired regression guard

- Keep the **602 runtime unchanged**: Recent/Library/Create use the 590 CSS-variable path, Music Note uses direct pane geometry.
- Fix the normal automatic benchmark so it measures the **active workspace's real runtime mode**; only explicit coordinate A/B forces css-var/direct.
- Add one-click **Music Note ↔ Library paired benchmark**. It switches workspaces automatically, runs the same 1400×900 / 3-set benchmark on both, restores the original workspace, and displays both results together.
- The first successful pair is saved locally as the performance protection baseline. Later runs flag Library regressions (FPS -10% or P95 +15%) so Music Note optimization cannot silently slow the Library again.
- No normal-user runtime layout, UI design, Firebase/Auth/Firestore/Functions/storage schema changes.


## 602 - 590 baseline restore + workspace-isolated Lite V2 geometry

- Reset source baseline to **590** (discarding 591-601 runtime experiments).
- Preserve 590 CSS-variable Lite V2 geometry for **Create / Recent / Library**.
- Apply direct pane geometry only to **Music Note**, where 590 A/B showed a clear benefit.
- Benchmark A/B remains available, but after a benchmark the engine now restores the active workspace's own runtime mode instead of forcing one global mode.
- Workspace switches explicitly clear stale direct inline geometry before Recent/Library/Create resumes, preventing cross-workspace leakage.
- No Firebase/Auth/Firestore/Functions/storage schema changes.

## 549차 — 분할 리사이즈 중 빌더 화면 고정 / 연쇄 밀림 차단

- 분할바를 잡는 순간 빌더의 현재 화면 기준점을 1회 저장합니다.
- 드래그 중 보컬/가사/템포/명령창의 줄바꿈과 실제 높이가 변해도, 기존 rAF 프레임 안에서 같은 콘텐츠가 같은 화면 높이에 있도록 scrollTop만 최소 보정합니다.
- 최상단은 계속 최상단, 최하단은 계속 최하단으로 유지합니다.
- PC↔모바일 경계뿐 아니라 같은 모드 안에서 폭이 변할 때 생기던 아래/위 연쇄 밀림도 같은 규칙으로 막습니다.
- 새 React state, ResizeObserver, scroll/resize listener는 추가하지 않았습니다. 드래그 중에만 앵커 요소/빌더 rect를 읽습니다.
- 생성바 위치/크기, 548차 보컬·가사 자연 높이, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.

# SORIDRAW Music Studio

## Development

Use Node.js 20.x. The root `.nvmrc` and `package.json` engine field keep the web app aligned with Firebase Functions.

1. Copy `.env.example` to the environment used by the web build.
2. Register the Firebase web app with App Check and keep the reCAPTCHA Enterprise key domains aligned with the deployed app domains.
3. Install dependencies and start the app.

```bash
npm ci
npm run dev
```

Before deployment, verify both the web app and Functions. These commands do not deploy anything.

```bash
npm run lint
npm run build
cd functions
npm ci
npm run build
```

## Personal Gemini API key security

- Users register their own Gemini API key from the API settings screen.
- The key is stored in the server-only Firestore document `user_api_keys/{uid}`.
- The browser never receives the key and never calls Gemini directly.
- The authenticated Firebase Function `generateGeminiContent` reads the current key and calls Gemini server-side.
- The proxy sends Gemini credentials with the official `x-goog-api-key` request header and accepts both legacy Standard keys and new authorization keys issued by AI Studio.
- Google states that Standard keys will be rejected starting September 2026, so users should migrate to a new authorization key before then.
- Do not configure `VITE_GEMINI_API_KEY`; private Gemini keys must never be included in a Vite client build.

See `docs/SORIDRAW_SECURITY_COST_PLAN.md` for App Check activation, server limits, remaining console work, and the staged KMS migration plan.

The public App Check site key is bound in `src/firebase.js`; deployment environments must not override it with a stale Vite variable.

## App Check host routing

- AI Studio preview hosts use the registered App Check debug-provider path.
- The Vercel test host and Firebase Hosting domains initialize the real reCAPTCHA Enterprise provider with the site key registered to the Firebase web app.
- App Check enforcement must remain disabled until the Vercel test host reports both `token status: available` and `server status: valid` during real generation tests.

The V1 song generator now fails open after temporary Gemini correction failures: banned-term lines are removed locally as a last resort, missing required slots receive a minimal structural completion, and an otherwise usable song is no longer discarded solely because an Outro/Bridge body repair failed.

## Gemini production availability routing

## 107차 Gemini 안정 모델 3단계 교체

- 곡 생성 기본 우선순위를 `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite`로 고정합니다.
- 503/504/네트워크 오류가 난 모델만 2분간 후순위로 보내고, 시간이 지나면 원래 우선순위로 자동 복귀합니다.
- 더 이상 제공되지 않는 `gemini-2.5-flash`와 Preview 모델을 곡 생성 안전망에서 제거했습니다.
- Gemini 3.6 Flash와 3.5 Flash-Lite 요청에서는 더 이상 지원되지 않는 sampling 필드(`temperature`, `topP`, `topK`)를 전송 전에 제거합니다.
- Functions 모델 허용 목록에도 3.6 Flash와 3.5 Flash-Lite를 추가했으므로, 이 버전은 관련 Functions 재배포가 필요합니다.
- 한 생성 세션의 최대 모델 호출은 기존과 동일하게 3회입니다.
- Vercel 테스트앱의 App Check는 별도 문제로 계속 임시 비활성 상태이며, 이번 모델 교체와 분리합니다.


## 109차 App Check 사이트 키 문자 오타 수정

- Firebase App Check에 등록된 reCAPTCHA Enterprise 사이트 키와 앱 코드의 키가 대소문자/숫자 3자리에서 달랐던 문제를 수정했습니다.
- 잘못된 키는 Vercel 테스트앱에서 `recaptcha-error`와 `enterprise/clr 400`을 만들었습니다.
- Vercel 테스트앱과 Firebase Hosting은 실제 reCAPTCHA Enterprise 제공자를 계속 사용합니다.
- AI Studio 디버그 제공자, Gemini 모델, 생성 엔진, Functions, Firestore/Auth 저장 구조는 변경하지 않았습니다.


## 110차 App Check 올바른 프로젝트 사이트 키 적용

- reCAPTCHA Enterprise 키를 Firebase 프로젝트 `soridraw-app-866a5`에서 새로 만든 사이트 키로 교체했습니다.
- Vercel 테스트앱 도메인 `soridraw-music.vercel.app`을 포함한 올바른 프로젝트 소속 키를 사용합니다.
- AI Studio 디버그 제공자, Gemini 3.6 모델 라우팅, Functions, Firestore/Auth 저장 구조는 변경하지 않았습니다.
- App Check 강제 차단은 테스트앱에서 `token status: available` 및 `server status: valid`가 확인될 때까지 유지하지 않습니다.

## 329차 — 뮤직노트·라이브러리 카드/버튼 톤 및 외곽선 제거
- 뮤직노트와 Suno Library의 곡 목록 카드가 페이지 배경과 섞이지 않도록 카드 표면색을 `#1a1a1c`로 분리했습니다.
- 필터·정렬·탭 외부 버튼 영역은 `#242426`, 검색창은 `#29292a`로 통일했습니다.
- Library 그룹 헤더와 개별 트랙 행에도 단계가 보이는 진회색 톤을 적용했습니다.
- 두 페이지 내부의 버튼·입력창·카드·팝업/창 외곽선, 링, 그림자를 제거했습니다.
- 선택된 Music Note 빨강 / Library 초록 강조 버튼은 기존 강조색을 유지합니다.
- Suno Library 대문 아이콘의 세로선은 로고 그래픽이므로 유지했습니다.

## 366차 — 별 등급 UI 롤백 및 키워드 겹침 수정 유지
- 뮤직노트와 Suno Library의 별 등급 필터·목록 표시·선택 팝업을 361차의 기존 색상 원 방식으로 복구했습니다.
- 362~365차에서 추가된 별 등급 전용 CSS와 임시 별점 매핑은 제거했습니다.
- 뮤직노트 곡 목록의 선택 키워드 칩이 서로 겹치지 않도록 한 363차 수정은 그대로 유지했습니다.
- 기존 사용자 색상 데이터와 Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.


## 380차 성능 최적화
- 뮤직노트/라이브러리 검색 안내 문구의 4초 자동 교체와 모션을 제거해 전체 페이지 주기적 재렌더를 없앴습니다.
- 검색 결과 계산에 React deferred value를 적용해 입력 타이핑과 대형 목록 필터 계산을 분리했습니다.
- 화면 밖 목록 카드에 content-visibility를 적용하고, 분할바 드래그 중 전환/애니메이션/hover hit-test를 일시 중지했습니다.
- 목록 카드에 붙어 있던 실제 동작 없는 motion wrapper를 일반 div로 변경했습니다.
- 라이브러리는 재생 진행시간이 바뀔 때마다 전체 목록이 재렌더되던 GlobalPlayer 전체 Context 구독을 끊고, 재생 제어 전용 Context만 구독하도록 분리했습니다.

## 381차 중앙 디테일 팝업 통합
- 분할모드에서 뮤직노트와 Suno Library의 디테일 창을 오른쪽 결과 pane 내부가 아니라 좌우 pane 전체가 공유하는 중앙 오버레이에 표시합니다.
- 중앙 오버레이의 위치와 크기는 현재 Studio 중앙 workspace 경계를 기준으로 계산하므로 왼쪽/오른쪽 보조 rail과 상단 전역 메뉴는 가리지 않습니다.
- 독립 뮤직노트/라이브러리 페이지에서는 기존 전체 페이지 팝업 동작을 유지합니다.
- 분할모드 디테일 배경의 blur와 반투명 비침을 제거하고 각 페이지의 기본 패널 색을 불투명하게 유지해 뿌연 색감 차이를 줄였습니다.
- 곡 데이터, Firebase/Auth/Firestore 저장 구조와 디테일 기능은 변경하지 않았습니다.

### 382차 — 우측 최근 생성곡 확장 시 전체 스크롤 복구
- 최근 생성곡을 `전체`로 펼쳤을 때 선택된 키워드 카드가 짧은 내부 스크롤로 압축되던 구조를 제거했습니다.
- 펼친 상태에서는 오른쪽 보조 메뉴 자체가 세로 스크롤을 소유하며, 선택된 키워드 마지막 항목까지 확인할 수 있습니다.
- 최근 생성곡의 긴 제목 위에서 마우스 휠을 사용해도 오른쪽 메뉴가 더 내려갈 수 있는 동안에는 세로 스크롤을 우선합니다.
- 중앙 작업영역과 전체 페이지 스크롤에는 영향을 주지 않습니다.


## 383차 — 디테일 팝업 클리핑 제거 및 배경 명도 조정
- 분할모드의 Music Note / Suno Library 디테일 창을 body 기반 공통 중앙 레이어에서 렌더링합니다.
- 중앙 모달 호스트의 `overflow:hidden`, transform, paint containment를 제거해 분할 pane 경계에 잘리지 않게 했습니다.
- 모달 프레임을 중앙 호스트 기준 absolute 레이어로 고정하고 패널 높이를 공통 중앙영역에 맞게 제한합니다.
- 분할모드 backdrop은 `rgba(0,0,0,0.56)`으로 낮춰 기존보다 배경이 조금 덜 어두워집니다.
- 독립 뮤직노트/라이브러리 페이지의 backdrop도 각각 소폭 밝게 조정했습니다.
- 곡 데이터와 Firebase 저장 구조는 변경하지 않았습니다.

## 384차 — Sori Studio 대문·검색 위치 조정
- 분할모드 Sori Studio 대문을 기존보다 14px 아래로 이동해 첫 카드와의 과한 공백을 줄였습니다.
- 통합 검색 버튼을 기존보다 아래로 내리고 빌더 안쪽으로 8px 이동했습니다.
- 곡 만들기 단독 전체화면에서도 같은 간격을 유지합니다.
- 카드 위치, 분할 너비, Classic 테마, Firebase 저장 구조는 변경하지 않았습니다.


## 385차 — 디테일창 전체화면 오버레이 및 Sori Studio 대문 잘림 수정
- 분할모드의 뮤직노트·Suno Library 디테일창 공통 포털 영역을 중앙 workspace 경계가 아닌 브라우저 전체 화면으로 확장했습니다.
- 디테일창을 열면 상단 메뉴와 좌우 보조 메뉴까지 포함한 전체 창이 함께 어두워지고, 팝업 패널은 분할선 경계에 제한되지 않습니다.
- 384차에서 추가한 Sori Studio 대문의 14px 상대 이동을 취소하고 헤더 오버플로를 열어 글자 일부가 가려지는 문제를 수정했습니다.
- 곡 데이터, Firebase/Auth/Firestore 저장 구조, Classic 테마는 변경하지 않았습니다.

## 386차 — Sori Studio 대문 상단 간격 조정
- 분할모드 Sori Studio 대문을 현재 위치에서 10px 위로 이동해 Music Note 대문처럼 상단 구분선에 더 가깝게 배치했습니다.
- 헤더와 내부 셸의 오버플로를 계속 열어 둬 글자 상단·하단이 잘리지 않도록 유지했습니다.
- 첫 카드 위치, 통합 검색 버튼, 디테일창 전체화면 오버레이, Classic 테마와 Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## 387차 — 뮤직노트·라이브러리 선택 탭 색상 및 검색 아이콘 정렬
- 뮤직노트의 노트 스페이스/마이 노트/공유 노트에서 현재 선택된 탭이 빨간 강조색으로 확실히 표시되도록 전용 활성 상태 클래스를 추가했습니다.
- Suno Library의 뮤직 스페이스/마이 리스트/공유 리스트도 현재 선택된 탭이 초록 강조색으로 표시되도록 동일한 방식으로 수정했습니다.
- 좁은 분할화면과 모바일에서 42px 검색 버튼으로 접혀 있을 때 돋보기 아이콘이 버튼의 정확한 좌우 중앙에 오도록 맞췄습니다.
- 검색창을 누르면 기존처럼 입력창이 펼쳐지고, 펼친 상태에서는 아이콘이 정상적인 왼쪽 입력 여백으로 이동합니다.
- 곡 데이터, 폴더 데이터, 검색 기능, Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## 388차 — 장르·스타일·사운드 접힘 키워드 정확히 한 줄
- 접힌 상태에서 키워드 영역만 첫 번째 버튼 줄 높이인 58px로 고정했습니다.
- 두 번째 키워드 줄이 일부 걸쳐 보이던 현상을 제거했습니다.
- 제목, 카드 시작 위치, 요약 입력창 사이에 추가 간격을 만들지 않고 오히려 불필요했던 18px 빈 영역을 제거했습니다.
- 펼친 상태의 전체 키워드, 팝업, 선택, 잠금, 랜덤, 직접입력 기능은 변경하지 않았습니다.
- Classic 테마와 Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## SORIDRAW 389차 — Sori Studio 대문 하단 간격 정확 보정

- 기준: `SORIDRAW_388차_장르_스타일_사운드_접힘키워드_정확히한줄.zip`
- 변경 파일: `src/components/studio/studioLayout.css`, `README.md`
- `Sori Studio` 대문을 위로 올리던 386차 규칙을 제거했습니다.
- 카드 위치는 그대로 두고 대문만 현재 위치에서 22px 아래(최종 기준 `top: 12px`)로 이동해 Music Note처럼 다음 콘텐츠에 가깝게 붙였습니다.
- 384/385/386에 누적된 대문 위치 충돌 규칙을 정리해 최종 위치 규칙을 하나로 통일했습니다.
- Hero/Shell의 `overflow: visible`과 제목 `z-index`를 유지해 글자 잘림을 방지했습니다.
- 검색 버튼, 장르·스타일·사운드 카드, 분할 화면, Classic, Firebase 저장 구조는 변경하지 않았습니다.

## SORIDRAW 390차 — Sori Studio 대문 하단 잘림 구조 수정

- 기준: 389차 ZIP
- `src/App.tsx`: 대문 래퍼의 `translate-y` 제거 및 전용 `soridraw-studio-masthead` 훅 추가
- `src/components/studio/studioLayout.css`: 제목만 이동시키던 `top: 12px` 제거
- 대문을 실제 레이아웃 흐름의 margin으로 배치하고, 첫 카드 위 여백은 main padding으로 보정
- 제목 하단 글리프가 다음 main 레이어에 덮이지 않도록 line-height와 하단 안전 여백 적용
- Music Note/Library, Classic, Firebase 저장 구조는 변경하지 않음


## SORIDRAW 391차 — Sori Studio 대문 고정 하단 여백 제거

- 기준: `SORIDRAW_390차_소리스튜디오_대문_하단잘림_구조수정.zip`
- 실제 원인은 제목 위치가 아니라 `src/index.css`의 `.soridraw-studio-shell { padding-bottom: 18px !important; }` 고정 규칙이었습니다.
- 제목을 아래로 이동하면 헤더 높이도 함께 늘어나 카드까지 같이 내려가므로 간격이 줄지 않았고, 상대 위치로 움직이면 부모 경계에서 글자가 잘렸습니다.
- 제목은 정상 레이아웃 흐름에 그대로 두고, Studio Black 데스크톱에서 셸의 실제 하단 여백만 18px에서 6px로 줄였습니다.
- 첫 카드가 제목 쪽으로 12px 가까워지며, 제목 글자는 레이아웃 영역 밖으로 이동하지 않아 하단이 잘리지 않습니다.
- 검색 버튼, 카드 내부 구성, 분할 너비, Music Note/Library, Classic, Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## SORIDRAW 392차 — 뮤직노트·라이브러리 대문 시작점 통일

- 기준: `SORIDRAW_391차_소리스튜디오_대문_고정하단여백제거.zip`
- `src/App.tsx`: Sori Studio 대문과 오른쪽 작업공간 대문이 같은 행을 사용할 수 있도록 전용 Hero 행과 포털 호스트를 추가했습니다.
- `src/pages/FavoritesPage.tsx`: Studio 안에서 열릴 때 Music Note 대문과 동기화 버튼을 Hero 포털로 이동합니다.
- `src/pages/SunoLibraryPage.tsx`: Studio 안에서 열릴 때 Suno Library 대문과 남은 크레딧 버튼을 Hero 포털로 이동합니다.
- `src/components/studio/studioLayout.css`: Sori Studio와 오른쪽 대문을 실시간 분할 너비에 맞춘 같은 Grid 행에 배치하고, 기존 96px 상단 예약 여백을 제거했습니다.
- 검색·필터 영역은 첫 Sori Studio 카드와 같은 시작선에서 시작하며, 독립 뮤직노트/라이브러리 페이지와 모바일 레이아웃은 기존 구조를 유지합니다.
- 곡 데이터, 폴더/플레이리스트 데이터, Firebase/Auth/Firestore 저장 구조와 Classic 테마는 변경하지 않았습니다.

## SORIDRAW 393차 — 뮤직노트·라이브러리 대문 줄 정확 정렬

- 기준: `SORIDRAW_392차_뮤직노트_라이브러리_대문시작점_통일.zip`
- 확인된 충돌 원인은 390차의 고우선순위 `.soridraw-studio-masthead { margin-top: 64px !important; }` 규칙입니다.
- 392차 Grid가 `align-items: start`를 사용해 Sori Studio는 64px 아래에서 시작하고, 오른쪽 Music Note/Suno Library 포털은 Grid 최상단에 남아 있었습니다.
- 검색·필터·탭·곡 목록 위치는 이미 정상이라 건드리지 않고, 오른쪽 40px 대문 포털만 같은 Grid 행의 하단에 정렬했습니다.
- 고정 `top`, `transform`, 추가 padding을 사용하지 않아 제목 잘림과 메뉴/목록 재이동을 막았습니다.
- Music Note 동기화 버튼과 Suno Library 남은 크레딧 버튼도 각 대문과 같은 줄로 이동합니다.
- 모바일, 독립 페이지, Classic, Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## SORIDRAW 394차 — 뮤직노트·라이브러리 대문 실시간 분할 추적 및 크레딧 버튼 축소

- 기준: `SORIDRAW_393차_뮤직노트_라이브러리_대문줄_정확정렬.zip`
- `src/components/studio/StudioSplitWorkspace.tsx`: 분할바 드래그 중 매 requestAnimationFrame마다 Hero Grid에도 현재 빌더 픽셀 폭을 직접 전달합니다.
- Music Note와 Suno Library 대문이 마우스를 놓은 뒤에만 이동하던 원인은 Hero Grid가 pointer-up 때 갱신되는 루트 CSS 변수만 보고 있었기 때문입니다.
- 드래그 중에는 Hero 행의 로컬 `--soridraw-studio-builder-width`를 갱신하고, pointer-up에는 기존 루트 변수로 자연스럽게 인계해 제목이 분할바를 실시간으로 따라옵니다.
- Suno Library의 남은 크레딧 버튼은 일반 화면에서 높이 32px로 축소하고, 좁은 결과 패널 및 모바일에서는 28px로 더 작게 표시합니다.
- 검색·필터·탭·곡 목록, Music Note 동기화 버튼, 곡/Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## SORIDRAW 395차 — 라이브러리 생성일 가독성·곡 구분선·폴더 선택색 복구

- Suno Library 생성일/곡 수 메타 줄의 글자 크기를 소폭 키웠습니다.
- 한 생성 카드 안의 두 곡 사이에 희미한 내부 가로 구분선을 추가했습니다.
- Music Note와 Suno Library의 상단 공간 탭 및 실제 폴더 버튼에 안정적인 `aria-pressed`/`data-active` 상태를 추가했습니다.
- 분할화면의 중립 버튼 CSS보다 선택 상태가 우선하도록 전용 선택색 규칙을 강화했습니다.
- Music Note 선택은 빨간 배경, Suno Library 선택은 초록 배경으로 표시하고 선택 텍스트는 검정색으로 통일했습니다.
- 버튼/창 외곽선, Firebase, 저장 구조는 변경하지 않았습니다.


## 396차 — 뮤직노트 새로고침 버튼 한 줄 정렬

- 모바일에서 Music Note 제목과 수동 새로고침 버튼을 항상 같은 행에 배치했습니다.
- 기존 모바일 `flex-col`로 인해 버튼이 제목 아래로 줄바꿈되던 구조를 제거했습니다.
- PC 분할화면에서는 헤더 오른쪽에 실제 안전 여백을 확보해 새로고침 버튼이 바깥으로 삐져나가지 않고 조금 왼쪽에 머물도록 했습니다.
- 검색, 색상 필터, 폴더 탭, 곡 카드 및 Firebase 저장 구조는 변경하지 않았습니다.

## SORIDRAW 397차 — 모바일 Sori Studio 대문 간격 및 접힌 생성 버튼 창 왼쪽 고정

- 기준: `SORIDRAW_396차_뮤직노트_새로고침버튼_한줄정렬.zip`
- `src/components/studio/studioLayout.css`만 수정했습니다.
- 모바일/태블릿 Studio에서 Hero 뒤에 중복으로 남아 있던 `main` 상단 18px 여백을 제거해 `Sori Studio` 대문·검색 버튼과 첫 카드가 PC처럼 자연스럽게 붙도록 했습니다.
- 제목을 `top`이나 `transform`으로 억지 이동하지 않아 대문 글자 잘림과 PC 레이아웃 변형을 방지했습니다.
- 접힌 `생성하기` 버튼은 모바일에서 분할 작업영역/왼쪽 레일 좌표를 더 이상 따르지 않고 브라우저 전체창의 실제 왼쪽 끝에 고정됩니다.
- PC Studio, Classic, 카드 내부, 생성 기능, Firebase/Auth/Firestore 저장 구조는 변경하지 않았습니다.

## SORIDRAW 398차 — 모바일 대문 하단 여백 제거 및 검색 아이콘 단독 배치

- 기준: 397차
- 모바일 Sori Studio 대문 아래에 남아 있던 `soridraw-studio-shell`의 실제 18px 하단 패딩과 구분선을 제거했습니다.
- 제목을 `top`/`transform`으로 움직이지 않고 실제 레이아웃 공간만 제거해 하단 잘림 없이 첫 카드가 가까워지도록 했습니다.
- 모바일 통합 검색 버튼의 배경, 테두리, 그림자를 제거하고 노란 검색 아이콘만 남겼습니다.
- 검색 아이콘을 기존보다 아래로 4px, 오른쪽 끝에서 안쪽 18px 위치로 옮겼습니다.
- 1100px 이상 PC 레이아웃, Classic 테마, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않았습니다.

## SORIDRAW 399차 — 모바일 3개 대문 상단 여백 통일

- 기준: `SORIDRAW_398차_모바일대문_하단여백제거_검색아이콘단독배치.zip`
- 모바일 Sori Studio 대문의 윗공간을 8px 늘려 답답함을 완화했습니다.
- Music Note와 Suno Library 대문을 Sori Studio와 같은 y=96px 시작선에 맞췄습니다.
- Music Note/Library 헤더에 남아 있던 `translate-y`를 모바일에서 제거해 실제 레이아웃 기준으로 정렬했습니다.
- 검색, 필터, 폴더 탭, 곡 목록의 내부 간격과 PC/Classic/Firebase 구조는 변경하지 않았습니다.

## 400차 메모
- 뮤직노트/라이브러리 3개 탭 부모 쉘 배경을 필터/비활성 폴더 버튼과 같은 회색으로 통일.
- 부모 쉘의 추가 보더/그림자를 제거해 이중 버튼처럼 보이던 현상 완화.


## 401차 메모
- 모바일 Music Note 제목 앞에 남아 있던 전용 28px 빈 행을 제거했습니다.
- 모바일 Suno Library의 크레딧 전용 상단 행을 제거하고 대문과 같은 행에 배치했습니다.
- Music Note/Library 대문 아래 간격을 같은 12px 정상 흐름으로 통일했습니다.
- 검색/필터/폴더/곡 목록과 PC·Classic·Firebase 구조는 변경하지 않았습니다.

## 402차 메모
- 모바일 Sori Studio 기준 좌우 12px 가이드에 Music Note와 Suno Library의 검색/필터/폴더/목록 폭을 통일했습니다.
- Music Note는 대문 아래 실제 레이아웃 간격을 12px에서 4px로 줄여 아래 메뉴와 목록 전체를 함께 위로 올렸습니다.
- Suno Library는 모바일 상단 가이드를 1px만 줄여 대문, 메뉴, 목록을 한꺼번에 미세하게 위로 이동했습니다.
- PC 일반 레이아웃, Classic, Firebase/Auth/Firestore/Functions 구조는 변경하지 않았습니다.

## 403차 메모
- 모바일/컴팩트 화면의 Music Note 제목만 2px 아래로 미세 조정했습니다.
- 새로고침 버튼, 헤더 높이, 아래 메뉴, 목록과 좌우폭은 변경하지 않았습니다.


## 404차 메모
- 뮤직노트와 Suno Library에서 폴더 모드 탭 행과 검색/색상/필터 행의 표시 순서를 서로 교체했습니다.
- 기존 각 행의 높이, 좌우폭, 선택 상태, 검색/필터 기능은 유지했습니다.

## 405차 메모
- 태블릿/컴팩트 구간(1100~1599px)의 왼쪽 메뉴만 정렬 규칙을 고정했습니다.
- 접힌 왼쪽 메뉴의 내부 폭과 box-sizing을 명확히 지정해 창 너비 변화 시 아이콘이 왼쪽으로 이동하지 않도록 했습니다.
- 접힌 메뉴의 hover/선택 배경을 40×40, 10px 라운드로 통일해 잘린 정사각형처럼 보이던 현상을 제거했습니다.
- 펼친 왼쪽 메뉴도 214px 폭과 전체 행 라운드를 고정해 양쪽 메뉴를 펼친 상태에서 폭이 눌리거나 선택 배경이 깨지지 않도록 했습니다.
- 오른쪽 메뉴, 중앙 작업영역, Classic, 모바일 및 Firebase 구조는 변경하지 않았습니다.

## 406차 메모
- 태블릿/모바일 경계의 실제 원인은 compact 레일 전환은 1100px에서 시작하지만, 기존 왼쪽/오른쪽 레일 내부 스타일은 index.css에서 1280px부터만 적용되던 1100~1279px 공백이었습니다.
- 1100~1279px 구간에 왼쪽 메뉴의 펼침/접힘 정렬, 둥근 hover/선택 상태, 텍스트 말줄임과 오른쪽 대시보드 카드/목록 레이아웃을 명시적으로 복구했습니다.
- 중앙 분할 작업공간, 1100px 미만 모바일, 1280px 이상 기존 화면, Classic 및 Firebase 구조는 변경하지 않았습니다.

## 407차 메모
- 1100~1279px 태블릿 경계에서 접힌 오른쪽 메뉴 내부가 다시 `display:flex`로 살아나 64px 안에 눌리던 충돌 규칙을 차단했습니다.
- 접힌 오른쪽 메뉴는 빈 64px 레일과 중앙 정렬된 펼치기 버튼만 표시합니다.

## 408차 메모
- PC/태블릿 Sori Studio 통합 검색 아이콘만 기존 위치보다 4px 위로 조정했습니다.
- 좌우 위치, 버튼 크기, 대문·카드·분할화면 구조는 변경하지 않았습니다.


## 409차 메모
- 분할바 드래그 중 검색 아이콘의 `transition-all`을 비활성화해 오른쪽으로 튀거나 늦게 따라오는 현상을 제거했습니다.
- 드래그 중 실시간 위치 오프셋을 정지 상태 CSS와 같은 26px로 통일했습니다.
- 검색 아이콘의 높이와 나머지 레이아웃은 변경하지 않았습니다.


## 411차 메모
- 뮤직노트와 라이브러리의 카테고리 탭 행과 검색/필터 행 사이 간격을 가깝게 통일했습니다.
- 모바일/컴팩트는 8px, 일반 화면은 12px로 유지해 두 행이 완전히 붙지 않도록 했습니다.
- 버튼 높이, 좌우폭, 색상, 곡 목록 간격은 변경하지 않았습니다.


## 412차 메모
- 뮤직노트 곡 목록과 검색/필터 행 사이 간격을 카테고리 탭과 검색/필터 행 사이 간격과 동일하게 맞췄습니다.
- Suno Library 작업공간 곡 목록도 모바일 8px, 일반 화면 12px로 동일하게 맞췄습니다.
- 카드 내부 간격, 카드 높이, 선택 상태, 검색/필터 기능은 변경하지 않았습니다.

## 414차 메모
- 뮤직노트 검색/필터 행과 첫 곡 사이 간격을 411차 값(모바일 13px, 일반 21px)으로 복구했습니다.
- 뮤직노트 곡 카드끼리의 간격만 모바일 8px, 일반 12px로 축소했습니다.
- 라이브러리는 검색/필터 행과 첫 카드 사이 간격을 유지하고, 생성 카드끼리의 간격만 모바일 8px, 일반 12px로 축소했습니다.

## 415차 메모
- 뮤직노트와 Suno Library의 검색·필터 줄과 첫 곡 사이 기존 여백은 유지했습니다.
- 그 여백의 정확한 중앙에 1px 희미한 가로 구분선을 추가했습니다.
- 곡 카드끼리의 간격, 카드 높이, 검색·필터·카테고리 위치는 변경하지 않았습니다.

## 416차 — 뮤직노트·라이브러리 검색창 쿨그레이 밝기 조정
- 검색창 배경만 기존보다 밝은 쿨 뉴트럴 회색 `#2d2d31`로 통일했습니다.
- 입력 포커스 상태는 `#323237`로 한 단계만 밝아집니다.
- 필터·카테고리·곡 카드·간격·Firebase 저장 구조는 변경하지 않았습니다.


## 417차 — 검색창 밝기 유지·중성 회색 톤 복구
- 416차의 밝기는 유지하고, 검색창의 푸른 쿨톤만 줄였습니다.
- 기본 검색창은 `#2d2d2e`, 포커스 상태는 `#323233`으로 조정했습니다.
- 뮤직노트·라이브러리 검색창 이외의 색상·간격·구조는 변경하지 않았습니다.

## 418차 메모
- 뮤직노트·Suno Library 검색창의 사각형 표면을 주변 버튼과 같은 16px 라운드형으로 복구.
- 검색창 중성 회색 밝기를 `#303030`, 포커스 밝기를 `#353535`로 미세 상향.
- 검색 아이콘과 안내 문구 명도를 함께 조금 높임.
- 검색창 높이·폭·간격, 필터·카테고리·곡 목록 구조는 변경하지 않음.

## 419차 메모
- 분할화면에서 오른쪽 작업영역을 전체화면으로 전환할 때 Music Note / Suno Library 대문이 사라지던 문제를 수정했습니다.
- 원인은 전체화면에서 Sori Studio hero 전체를 숨기는 과거 규칙이, 현재 hero 포털 안에 있는 오른쪽 대문까지 함께 숨긴 것이었습니다.
- 전체화면에서는 Sori Studio 대문·통합검색만 숨기고, Music Note / Suno Library 대문은 그대로 표시합니다.
- 전체화면에만 남아 있던 main 상단 18px 여백을 제거해 카테고리·검색·목록 시작 높이를 분할화면과 동일하게 복구했습니다.
- 일반 생성결과 전체화면, 모바일, Classic, Firebase 저장 구조는 변경하지 않았습니다.

## 420차 메모
- 기준: 419차.
- 데스크톱 분할모드에서 중복 적용되던 Sori Studio 대문 상단 64px 여백을 제거했다.
- Music Note / Suno Library 포털 제목의 하단 정렬을 시작점 정렬로 바꿔 네 작업화면의 상단 기준선을 통일했다.
- Sori Studio 전체모드도 같은 대문 시작선을 사용한다.
- 최근 생성곡/생성결과 전체모드는 사라진 hero 대신 Music Note / Library 전체모드와 같은 40px 구조 가이드를 유지한다.
- 내부 메뉴·카드 간격, 모바일, Classic, Firebase 데이터 구조는 변경하지 않았다.

## 422차 메모
- 421차의 공통 hero 40px 강제는 실제 원인이 아니어서 적용하지 않음.
- 분할모드와 빌더 단독 전체모드의 검은 상단 빈 영역을 만들던 `.soridraw-studio-hero-row { margin-top: 64px; }`를 실제 레이아웃에서 제거.
- 오른쪽 단독 전체모드(뮤직노트/라이브러리/최근 생성곡)는 기준 높이로 유지.

## 423차 메모
- 기준: 422차 분할모드 상단 검은 여백 64px 실제 제거.
- 분할모드에서만 Music Note / Suno Library 포털 대문이 상단 유틸리티 칸으로 올라간 현상을 복구했다.
- 422차에서 맞춰진 소리스튜디오·최근 생성곡·카테고리·검색창·곡 목록 높이는 그대로 유지한다.
- 실제 분할 상태에서 포털 대문과 라이브러리 크레딧 버튼만 46px 아래로 이동하며, 전체모드와 단독모드는 변경하지 않는다.

## 424차 메모
- 분할모드에서 Music Note / Suno Library 포털 대문을 8px 더 아래로 내려 Sori Studio와 시각 정렬 보정.

## 425차 메모
- 424차는 포털 대문을 8px만 추가 이동해 실제 기준선보다 10px 높은 상태가 남아 있었다.
- 분할모드의 Music Note / Suno Library 포털 대문 오프셋을 54px에서 64px로 조정해 제목과 아래 메뉴 사이 간격을 Sori Studio 쪽 시각 간격에 맞췄다.
- 전체모드, 카테고리 탭, 검색창, 목록 위치는 변경하지 않는다.

## 426차 메모
- 뮤직노트/라이브러리 카테고리 부모 쉘의 내부 패딩 제거.
- 3개 버튼이 부모 높이 48px를 꽉 채우도록 맞춰 이중 크기처럼 보이던 현상 정리.

## 427차 메모
- 426차의 전체 높이 채움 방식은 되돌리고 425차의 내부 여백형 탭 디자인을 복구.
- 첫 번째/마지막 탭이 선택될 때만 바깥쪽 끝단을 부모창 가장자리까지 4px 확장해 정확히 맞춤.
- 버튼 높이 40px, 부모 높이 48px, 상하 여백은 유지.

## 428차 메모
- 뮤직노트/라이브러리 카테고리 버튼 높이를 승인된 40px로 모든 분할 상태에서 고정.
- 첫/마지막 버튼은 선택뿐 아니라 마우스 hover 때도 부모창 바깥 끝단까지 정확히 채우도록 수정.
- 부모창은 48px, 버튼은 상하 4px 여백을 유지하며 가운데 버튼 구조는 변경하지 않음.

## 429차 메모
- 뮤직노트/라이브러리 카테고리 버튼은 기본 상태에서 기존 40px 인셋을 유지한다.
- 마우스 오버 또는 선택 상태에서는 48px로 확장되어 부모창의 위·아래 끝까지 채운다.
- 첫/마지막 탭의 바깥쪽 끝단 채움 규칙은 그대로 유지한다.

## 430차 메모
- 카테고리 탭 hover/선택 시 실제 버튼 높이를 40px→48px로 변경하던 구조 제거.
- `transition-all`에 의한 이전 40px 버튼 잔상·겹침처럼 보이는 현상을 단일 pseudo 배경 레이어로 교체.
- 기본 버튼은 40px inset 유지, hover/선택 배경만 부모 높이 48px와 바깥 끝단을 정확히 채움.

## 431차 메모
- 뮤직노트/라이브러리 카테고리 부모창 높이를 검색창과 동일한 46px로 조정.
- 기본 버튼 40px는 유지하고 상하 여백을 3px로 맞춤.
- 호버/선택 배경은 부모창 46px 전체를 정확히 채우도록 보정.

## 432차 메모
- 뮤직노트/라이브러리 검색창 배경을 중성 회색 톤 그대로 한 단계 밝게 조정.
- 검색 아이콘, 안내 문구, 실제 입력 텍스트 밝기를 함께 상향.
- 높이 46px, 라운드, 간격과 필터 구조는 유지.

## 433차 메모
- Suno Library 대표색을 밝은 라벤더 바이올렛 `#A98BFF`로 변경.
- 제목, 선택 탭, 검색 포커스, 아이콘, 버튼, 로딩/선택 상태와 보조 강조색을 같은 보라 계열로 통일.
- 사용자 색상 필터의 실제 초록색 선택지와 성공/상태 의미의 일반 green 표시는 유지.

## 434차 메모
- Music Note 대표색을 밝은 코랄 `#FF7A72`로 변경.
- 제목, 선택 탭, 검색 포커스, 아이콘, 강조 버튼, 선택/팝업 상태를 같은 코랄 계열로 통일.
- 호버는 `#FF8C85`, 밝은 보조 텍스트는 `#FFC1BC`를 사용해 검정 선택 글자의 대비를 높임.
- Suno Library 라벤더 색상과 사용자 색상 필터는 변경하지 않음.

## 435차 메모
- 뮤직노트 디테일의 `다음 곡에 적용` 버튼 글자와 아이콘 색상을 검정(`#101010`)으로 변경.

## 436차 메모
- 작업 범위를 Classic 모바일 다크/라이트 모드로 제한하고 Studio Black 분할모드는 고정했다.
- 모바일 대문 시작 높이를 Music Note 기준으로 통일했다.
- Sori Studio는 실제 상단 여백을 2px 내려 맞췄고, Suno Library는 기존 72px 상단 여백을 96px로 복구했다.
- 제목만 시각 이동하지 않고 이후 메뉴와 목록도 함께 이동하도록 실제 레이아웃 여백만 수정했다.

## 437차 메모
- 모바일 Classic 다크/라이트의 세로 기준을 Suno Library로 변경.
- Music Note 제목→탭 간격과 검색행→첫 곡 간격을 Library와 동일하게 조정.
- Sori Studio의 중복 상단 여백을 제거해 제목과 첫 메뉴 카드 시작선을 Library 리듬에 맞춤.
- 메뉴/목록 좌우폭은 Library의 기존 16px가 아니라 다른 화면의 공통 기준인 12px로 통일.
- Studio Black 분할/전체모드 규칙은 변경하지 않음.

## 438차 메모
- 모바일 Classic 다크/라이트에서 Suno Library 상단 여백을 96px에서 100px로 늘려 대문과 아래 카드 영역을 4px 하향 조정.
- Music Note 새로고침 버튼을 34px 정사각형으로 축소.
- Suno Library 남은 크레딧 버튼을 30px 높이로 축소.
- Studio Black 분할/전체모드와 모바일 좌우폭은 변경하지 않음.

## 439차 메모
- 모바일 Classic 다크/라이트에서 Music Note와 Suno Library 상단 여백을 102px로 동일 적용.
- 438차의 새로고침/크레딧 버튼 축소는 유지.
- 분할모드 및 Studio Black은 변경하지 않음.

## 440차 메모
- 모바일 Classic 다크·라이트 라이브러리에서 보라색 대표 버튼이 호버/클릭 시 구형 초록색으로 바뀌던 규칙 제거.
- 선택 탭 기본색은 `#A98BFF`, 호버색은 `#B79FFF`로 고정.
- 색상 초기화 버튼과 남은 크레딧 버튼의 호버도 같은 라벤더 계열로 통일.
- 분할모드 및 Studio Black은 변경하지 않음.

## 441차 메모
- 모바일 Classic 다크·라이트에서 Sori Studio 통합 검색 버튼만 12px 위로 이동.
- 대문, 카드, 메뉴, 분할모드 및 기타 화면은 변경하지 않음.

## 442차 메모
- 모바일 Classic 다크·라이트에서 Sori Studio 통합 검색 버튼만 4px 추가 상향하여 총 16px 위로 이동.
- 대문, 카드, 메뉴, 분할모드 및 기타 화면은 변경하지 않음.

## 443차 메모
- PC Classic 다크모드의 Sori Studio 대문과 첫 카드 줄 사이 여백만 8px 축소.
- 오른쪽 통합검색 버튼, Music Note, Suno Library, 모바일, 분할모드는 변경하지 않음.

## 445차 메모
- PC Classic 다크/라이트 Sori Studio 생성 화면의 대문 아래 실제 카드 여백을 16px에서 0으로 추가 축소.
- 동일 화면의 오른쪽 통합검색 버튼만 12px 위로 복구.
- 뮤직노트, 라이브러리, 모바일, Studio Black 분할모드는 변경하지 않음.

## 446차 메모
- PC Classic 다크/라이트의 우측 상단 프로필 펼침창 배경만 중성 회색계열로 변경.
- 다크: #2A2A2C 계열, 라이트: #E8E8EA 계열.
- 모바일, 뮤직노트, 라이브러리, 분할모드/Studio Black은 변경하지 않음.

## 447차 메모
- 모든 표시 모드의 상단 프로필 버튼을 동일한 클릭 토글 방식으로 정리.
- 첫 클릭은 펼침, 같은 버튼 두 번째 클릭은 접힘.
- 데스크톱 프로필 버튼이 모바일 메뉴 바깥에 있어 외부 클릭 처리 후 다시 열리던 이벤트 순서 충돌을 수정.
- 프로필 메뉴 내부 클릭과 바깥 클릭 닫기 동작은 유지.

## 448차 메모
- 분할모드와 일반 다크/라이트 모드의 작업화면 상태를 분리했다.
- `/studio`에서 어떤 분할 작업화면을 보고 있더라도 다크 또는 라이트로 전환하면 일반 레이아웃의 `Sori Studio + 최근 생성곡` 상태로 복귀한다.
- 장르/스타일/사운드/가사 등 Studio 입력 상태와 생성 결과 데이터는 유지하며, 보이는 작업공간만 `recent`로 정상화한다.
- 분할모드 디자인/CSS, Firebase/Auth/Firestore/Functions는 변경하지 않았다.

## 449차 메모
- Classic 라이트모드만 Suno 참고 미색 팔레트로 변경했습니다.
- 전체 배경은 `#F7F4EF`, 주요 카드/패널은 `#EEEBE7` 기준입니다.
- Sori Studio의 검은 카드와 흰 버튼을 미색 카드/버튼으로 교체했습니다.
- 스토리보드, 보컬 캐릭터, 섹션 커스텀, Music Note/Library 디테일 팝업의 하드코딩된 어두운 면을 라이트 전용 미색으로 교체했습니다.
- Music Note/Library 목록 카드와 검색/필터/탭의 밝기와 글자 대비를 라이트 테마에 맞게 정리했습니다.
- Classic 다크모드와 Studio Black/분할모드는 변경하지 않았습니다.

## 450차 메모
- Classic 라이트모드만 대비를 미세 강화했다.
- 스튜디오 메뉴, 뮤직노트/라이브러리 카드, 라이트 팝업 내부 카드를 한 단계 진한 웜그레이로 조정했다.
- 비선택 키워드 글자는 제목보다 조금 연한 중간 회색으로 조정했다.
- 직접입력/수정 연필 버튼의 배경을 제거하고 아이콘만 표시한다.
- 보컬 캐릭터 만들기 기본 상태를 기존 호버 상태처럼 자연스러운 밝은 미색으로 고정했다.
- 뮤직노트 검색창 주변의 남은 사각 테두리/그림자를 제거했다.
- 다크모드와 Studio Black/분할모드는 변경하지 않았다.

## 451차 메모
- Classic 라이트모드에 남아 있던 검은 Music Note/Library 목록 카드와 디테일 창을 미색·웜그레이 계열로 정리.
- 생성 결과의 제목·적용 키워드·프롬프트·가사·Music API 카드에서 검은 배경과 선 구분을 제거하고 톤 차이로 구분.
- Music Note/Library 탭·필터·검색/목록 계층을 따뜻한 회색으로 통일.
- Classic 다크모드와 Studio Black 분할모드는 변경하지 않음.

## 452차 메모
- 앱 시작 시 저장된 라이트/다크 모드를 복구한 뒤 다시 다크로 강제하던 App.tsx 초기화 코드를 제거했습니다.
- 새로고침 후 라이트와 다크 스타일이 동시에 섞이던 문제를 해결했습니다.
- 라이트모드 Suno Library 검색창을 Music Note와 같은 46px / 16px 라운드 / 무테 구조로 통일했습니다.
- Studio Black 분할모드와 Classic Dark 디자인은 변경하지 않았습니다.

## 453차 메모
- 새로고침 시 Classic 다크/라이트의 Studio 작업 화면을 처음부터 `recent` 일반 구성으로 초기화.
- 테마 전환 전후 `create/recent` 상태 차이로 대문-카드 간격과 검색 버튼 위치가 달라지던 현상 제거.
- Classic PC의 두 상태 모두 동일한 상단 간격과 검색 버튼 위치 적용.
- Studio Black 분할모드 디자인과 상태 계산은 변경하지 않음.

## 454차 메모
- 라이트모드 선택 키워드 요약/직접입력 창을 부모 카드와 다른 웜그레이 톤으로 분리.
- 선택 버튼 우측의 검정 숫자 배지를 밝은 웜크림 배지로 변경.
- 요약 안내 문구, 선택 키워드 문구, 직접입력 placeholder 대비 강화.
- 명령창 안내 문구와 비활성 `직접 작사` 버튼을 라이트모드에서 읽히는 중간 회색 톤으로 정리.
- 다크모드 및 Studio Black/분할모드는 변경하지 않음.

## 455차 메모
- 기준: `SORIDRAW_454차_라이트모드_선택요약대비_배지_직접작사버튼개선.zip`
- 라이트모드 Music Note 디테일의 등록된 Suno 커버 위를 불투명한 미색 레이어가 덮던 문제를 수정했습니다.
- 원인은 라이트 디테일의 광범위한 `bg-black/*` 변환 규칙이 커버 전체 재생 오버레이까지 일반 카드 배경으로 바꾼 것이었습니다.
- Suno 커버 미디어, 재생 오버레이, 재생 버튼에 전용 클래스를 부여하고 라이트모드에서만 오버레이를 투명하게 복구했습니다.
- 커버 이미지는 원본 밝기와 색으로 표시되며, 마우스를 올릴 때만 약한 어두운 오버레이가 나타납니다.
- 다크모드, 분할모드, Library 디테일, URL 저장 구조는 변경하지 않았습니다.

## 456차 메모
- 기준: `SORIDRAW_455차_뮤직노트_디테일_수노커버_불투명덮개제거.zip`
- Classic 라이트모드의 Library `남은 크레딧` 글자를 진한 보라색으로 조정하고 배경 대비를 강화했습니다.
- Music Note와 Library 색상 필터의 `전체` 글자를 각 대표색의 진한 톤으로 변경했습니다.
- 선택 배경은 기존 코랄/라벤더 계열을 유지하면서 한 단계 진하게 조정했습니다.
- 크기, 간격, 기능, 다크모드, Studio Black/분할모드는 변경하지 않았습니다.

## 457차 메모
- 기준: `SORIDRAW_456차_라이트모드_크레딧_전체버튼_글자대비강화.zip`
- Classic 라이트모드의 Music Note 더보기 메뉴에서 `다음곡에 적용`·`삭제` 행이 검은 버튼처럼 보이던 배경을 제거했습니다.
- 더보기 메뉴의 부모 창만 기존보다 살짝 진한 웜그레이로 낮추고, 각 메뉴 항목은 투명 바탕과 톤 차이로 구분했습니다.
- Studio 하단 플로팅 작업창과 왼쪽 접기 화살표 버튼에 남아 있던 어두운 배경을 미색·웜그레이 계열로 변경했습니다.
- 버튼/창 외곽선은 추가하지 않았고, Classic 다크모드와 Studio Black/분할모드는 변경하지 않았습니다.

## 458차 메모
- 기준: `SORIDRAW_457차_라이트모드_뮤직노트더보기_플로팅창_어두운배경제거.zip`
- Classic 라이트모드의 생성하기 펼침 부모창이 포털 구조 때문에 기존 라이트 선택자를 벗어나 진회색으로 남던 문제를 수정했습니다.
- 생성하기 펼침 부모창과 왼쪽 접기 버튼을 따뜻한 웜그레이로 통일했습니다.
- Suno Library 더보기 메뉴 3종에 전용 식별자를 추가하고, Music Note 더보기와 같은 부모창 톤·투명 메뉴행·호버 톤 구조로 통일했습니다.
- 장르 카드 아래 선택 안내 문구 대비를 다른 안내문과 맞췄습니다.
- 라이트모드에서 활성화된 메뉴 초기화/휴지통 아이콘을 한 단계 진하게 조정했습니다.
- Classic 다크모드와 Studio Black/분할모드는 변경하지 않았습니다.

## 459차 메모
- 기준: `SORIDRAW_458차_라이트모드_생성창_라이브러리더보기_안내문구_휴지통대비개선.zip`
- Classic 라이트모드만 수정했습니다. 다크모드와 Studio Black 분할모드는 유지했습니다.
- 생성하기 펼침창의 부모 배경을 내부 버튼보다 확실히 어두운 웜그레이로 조정했습니다.
- 장르 선택 후 하단 설명창의 노란 강조를 제거하고 다른 메뉴 설명창과 같은 중성 웜그레이·회색 글자로 통일했습니다.
- 라이브러리 더보기 3종 메뉴에 전용 클래스를 추가해 기존 Tailwind 배경·선 규칙보다 강하게 적용되도록 했습니다.
- 라이브러리 더보기는 뮤직노트처럼 부모창의 톤으로만 구분하고, 개별 메뉴 행은 투명·호버 시 명도 변화 방식으로 통일했습니다.
- 선택값이 있을 때 활성화되는 메뉴 초기화 휴지통 아이콘을 더 진한 갈색으로 보강했습니다.
- Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.

## 460차 메모
- 기준: `SORIDRAW_459차_라이트모드_생성창명도_장르설명톤_라이브러리더보기_강한룰수정.zip`
- Studio Black 분할모드의 상단 대문 영역을 고정 헤더가 아니라 각 pane의 스크롤 영역으로 사용할 수 있도록 구조를 수정했습니다.
- PC와 태블릿(1100px 이상)이 동일한 독립 pane 스크롤 구조를 사용하도록 isolation 기준을 1600px에서 1100px로 통일했습니다.
- 기존 대문과 첫 카드/목록의 시작 위치는 유지하되, 그 사이 실제 높이를 자동 측정해 pane의 scrollable top padding으로 전환했습니다.
- 스크롤 시 Sori Studio 대문/검색 버튼과 Music Note·Library 대문이 해당 pane과 함께 사라지고, 카드·목록은 고정 실선(masthead divider)까지 올라와 공간을 사용합니다.
- 태블릿에서 문서 전체가 상단 실선 위까지 넘어가던 동작을 제거하고 PC와 같은 상단 경계에서 각 pane만 스크롤되도록 통일했습니다.
- 한쪽 pane 전체화면, 모바일, Classic 다크/라이트, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.

## 461차 메모
- 기준: `SORIDRAW_460차_분할모드_상단대문_스크롤영역확장_PC태블릿통일.zip`
- 460차에서 사용한 `scrollTop > 6px` 감지 + `data-soridraw-*-masthead-scrolled` 토글 구조를 제거했습니다. 분할바 드래그 중 pane 폭이 바뀔 때 브라우저가 scrollTop을 보정하면서 대문 숨김 상태가 켜졌다 꺼지는 원인이었습니다.
- Studio Black 분할모드(PC/태블릿 1100px 이상)에서는 Sori Studio 대문과 오른쪽 Music Note/Library 대문을 각 pane 스크롤러의 실제 첫 번째 콘텐츠로 배치했습니다.
- 외부 hero를 숨겼다가 scrollTop 조건으로 다시 처리하는 방식, 음수 margin, 가상 top padding 보정을 제거했습니다. 이제 대문은 카드/목록과 동일한 실제 스크롤 흐름에 속하므로 스크롤하면 자연스럽게 위로 사라집니다.
- 각 pane의 실제 시작 경계를 고정 masthead divider의 110px 위치에 맞췄습니다. 대문이 사라진 뒤 카드/목록은 해당 실선 바로 아래까지 정상적으로 올라갑니다.
- Music Note/Library의 기존 hero portal은 분할 상태에서 오른쪽 pane 내부 masthead host를 사용하도록 변경하고, 한쪽 pane 전체화면/Classic 테마에서는 기존 외부 hero host로 자동 복귀하도록 유지했습니다.
- Sori Studio 검색 버튼도 builder pane 내부 masthead에 함께 배치해 분할바 이동 시 별도 고정 좌표 계산에 의존하지 않도록 했습니다.
- Classic 다크/라이트, 1099px 이하 모바일, 한쪽 pane 전체화면, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.

## 462차 메모
- 기준: `SORIDRAW_461차_분할대문_실제pane스크롤편입_드래그토글제거.zip`
- Studio Black의 대문 크기/위치를 461차 Sori Studio 분할 대문 기준으로 통일했다.
- 공통 대문 규격: 84px 박스, 52px 제목행, 상단 20px/하단 12px, 제목 2rem, Sori Studio 번개 34px.
- PC/태블릿 1100px 이상에서 builder-only 전체화면도 builder pane masthead를 그대로 사용한다.
- Music Note/Library result-only 전체화면도 legacy hero가 아니라 실제 result pane masthead host를 계속 사용하도록 portal 조건을 변경했다.
- 분할 pane이 compact/mobile mode로 바뀌어도 Music Note/Library 대문 글자 크기를 줄이지 않는다.
- 1100px 미만 모바일/태블릿은 Sori Studio, Music Note, Library 모두 80px page-top + 동일 84px masthead flow block + 좌우 12px gutter를 사용한다.
- 기존 Music Note 2px optical top 보정, Library 95px 모바일 top 보정, 모바일 title translate 등 오래된 개별 보정은 마지막 462 규칙에서 무효화한다.
- Classic 다크/라이트와 Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.

## 463차 메모

- 기준: `SORIDRAW_462차_대문규격_소리스튜디오분할기준_전체모드통일.zip`
- 이번 차수는 **Sori Studio 대문만** 조정하고 Music Note / Suno Library는 건드리지 않음.
- 461차의 실제 pane 스크롤 구조와 462차의 현재 대문/검색 크기는 그대로 유지.
- Studio builder masthead 84px 박스 내부의 위/아래 여백을 `20/12px` → `28/4px`로 재배분해 제목 행을 8px 아래로 이동.
- 첫 카드 시작 위치는 유지되므로 대문과 첫 카드 사이의 보이는 간격은 8px 감소.
- 검색 버튼 크기는 유지하면서 제목 행 기준으로 4px 더 아래에 배치해 카드 쪽에 더 붙도록 조정.
- 넓은 분할, 좁은 `data-pane-mode="mobile"` 분할, builder-only 전체화면 모두 동일한 builder masthead 구조/위치를 사용.
- 다크/라이트 Classic, Music Note, Suno Library, Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 464차 메모

### 기준
- 기준 ZIP: `SORIDRAW_463차_소리스튜디오대문_하향_검색버튼밀착_전체화면동일.zip`
- 이번 차수는 Studio Black의 Sori Studio 분할/분할 전체화면 대문과 검색 위치만 수정한다.
- Music Note, Suno Library, Classic, Firebase/저장 구조는 변경하지 않는다.

### 원인
- 461차의 일반 분할 전용 선택자가 Sori Studio 제목에 `clamp(2rem, 2.45vw, 2.65rem)`을 높은 우선순위로 적용하고 있었다.
- 분할 전체화면(`data-soridraw-result-collapsed=true`)에서는 그 461 선택자가 빠지고 462차의 `2rem` 규칙으로 내려가 제목이 더 작아졌다.
- 검색 버튼은 463차에서 52px 제목 행의 중앙을 기준으로 `top: calc(50% + 4px)` 배치해, 카드 상단과 직접 연결되지 않고 분할/전체화면에서 체감 위치도 달라 보였다.

### 변경
- Sori Studio builder가 보이는 모든 1100px 이상 상태에서 제목 크기를 하나의 최종 규칙으로 고정했다.
  - 일반 분할
  - 좁은 pane 분할
  - result pane을 접은 Sori Studio 분할 전체화면
- 제목 크기는 461차 일반 분할 기준인 `clamp(2rem, 2.45vw, 2.65rem)`으로 통일했다.
- 번개 아이콘은 기존 34px 유지.
- 검색 버튼은 기존 34px, 내부 검색 아이콘 24px을 그대로 유지하고 위치 계산만 변경했다.
- 검색 버튼을 제목 행 중앙 기준이 아니라 행 하단 `bottom: -2px`에 고정해 첫 카드 바로 위에 오도록 했다.
- 동일 선택자가 일반 분할과 전체화면에 동시에 적용되므로 모드 전환 시 검색 버튼의 수직 위치 계산이 달라지지 않는다.

### 사용자 실제 테스트
1. 일반 분할에서 Sori Studio 제목 크기 확인.
2. 오른쪽 pane을 완전히 접어 Sori Studio 전체화면으로 만든 뒤 제목이 작아지지 않는지 확인.
3. 두 상태 모두 검색 버튼이 첫 카드 바로 위에 붙는지 확인.
4. 분할바를 넓게/좁게 움직여도 검색 버튼의 카드 기준 높이가 변하지 않는지 확인.
5. 461차의 pane 실제 스크롤 구조와 상단 실선 공간 사용이 유지되는지 확인.

## 465차 메모

### 기준
- 기준 ZIP: `SORIDRAW_464차_소리스튜디오_분할전체화면_대문크기통일_검색카드밀착.zip`
- 이번 차수는 **Sori Studio 대문의 수직 위치와 검색 아이콘 위치만** 조정한다.
- 사용자가 승인한 `분할 전체화면(builder-only fullscreen)`의 대문 하단을 기준선으로 삼는다.
- Music Note, Suno Library, Classic 다크/라이트, Firebase/저장 구조는 변경하지 않는다.

### 변경
- Sori Studio의 84px 대문 박스와 52px 제목 행, 제목/번개/검색 크기는 모두 그대로 유지했다.
- 1100px 이상 일반 분할, 좁은 pane 분할, builder-only 전체화면의 대문 내부 여백을 모두 `상단 28px / 하단 4px`로 최종 고정했다.
- 1099px 이하 모바일/태블릿도 크기는 바꾸지 않고 동일하게 `상단 28px / 하단 4px`로 재배치해 제목 행의 **하단 위치**가 전체화면 기준과 같아지도록 했다.
- 검색 버튼은 배경이 없는 아이콘형이므로 34px 클릭영역의 박스가 아니라 실제 24px 검색 그림의 하단을 기준으로 맞췄다.
- 1100px 이상 pane 내부 검색은 `bottom: -9px`, 1099px 이하 hero 검색은 `bottom: -5px`로 내려 실제 검색 그림 하단이 대문 박스 하단선에 오도록 조정했다.
- 첫 카드의 시작 위치와 대문 전체 높이는 변경하지 않아, 기존 461차의 실선까지 스크롤 영역을 사용하는 구조를 유지한다.

### 사용자 실제 테스트
1. Sori Studio 분할 전체화면의 현재 대문 위치가 그대로 유지되는지 확인.
2. 일반 분할/좁은 pane 분할에서 대문 글자의 하단이 전체화면과 같은 위치감으로 내려왔는지 확인.
3. 모바일/태블릿에서 제목 크기는 그대로이면서 대문 하단 위치만 동일하게 맞춰졌는지 확인.
4. 분할/전체화면/모바일 모두 검색 그림이 이전보다 아래로 내려와 대문 하단선에 맞는지 확인.
5. 검색 버튼 크기, 제목 크기, 번개 아이콘 크기, 첫 카드 위치가 변하지 않았는지 확인.
6. 461차의 pane 실제 스크롤과 상단 실선 공간 사용이 그대로 유지되는지 확인.

## 466차 메모
- 기준: `SORIDRAW_465차_소리스튜디오_전체화면하단기준_대문위치_검색하단정렬.zip`
- 이번 차수는 Sori Studio의 두 사용자 승인 지점만 기준으로 다시 고정했다.
- 승인 기준 A: 일반 분할모드 검색 버튼 위치는 유지한다.
- 승인 기준 B: builder 단독 전체화면의 Sori Studio 대문 위치는 유지한다.
- 일반 분할/compact pane에서는 검색은 그대로 두고 대문만 5px 내려 전체화면 대문 기준선에 맞췄다.
- builder 단독 전체화면에서는 대문은 그대로 두고 검색만 8px 내려 일반 분할 검색의 카드 간격에 맞췄다.
- Music Note, Library, Classic, 일반 모바일 흐름은 이번 차수에서 건드리지 않았다.


## 467차 메모
- 기준: 466차.
- Sori Studio 분할 전체화면(builder-only fullscreen)의 검색 버튼만 추가 하향.
- 기존 전체화면 대문 위치, 일반 분할 검색 위치, 카드/대문 크기, 다른 페이지와 다른 모드는 변경하지 않음.
- fullscreen 검색 위치: `bottom: -17px` → `bottom: -29px`.

## 468차 메모

### 기준
- 기준 ZIP: `SORIDRAW_467차_전체화면_검색버튼만_추가하향.zip`
- 이번 차수는 **Sori Studio Studio Black 데스크톱/분할 계열의 검색 버튼 위치 계약만** 수정한다.
- 사용자 승인 기준은 **일반 분할모드의 검색 버튼 위치**이며, 이 위치를 분할 전체화면에도 그대로 사용한다.
- Sori Studio 대문 위치/크기, Music Note, Suno Library, Classic 다크/라이트, 모바일 일반 흐름은 변경하지 않는다.

### 원인
- 463~467차에서 검색 버튼의 `bottom` 값은 여러 차례 바뀌었지만, 전체화면 상태에서는 검색 버튼이 항상 동일한 positioned element 계약을 갖는다는 보장이 없었다.
- `bottom`은 `position: static`인 요소에는 실질적으로 작동하지 않기 때문에 전체화면 검색이 숫자 변경에도 움직이지 않는 현상이 발생할 수 있었다.
- 또한 normal split / fullscreen에 서로 다른 임시 bottom 보정이 누적돼 모드별 계산이 갈라져 있었다.

### 변경
- 1100px 이상 Studio Black에서 builder가 보이는 모든 상태의 `.soridraw-studio-scroll-builder-masthead`를 검색 버튼의 `position: relative` 기준 컨테이너로 명시했다.
- `.soridraw-studio-scroll-search-button`을 모든 builder 상태에서 `position: absolute !important`로 고정했다.
- 일반 분할에서 사용자가 승인한 검색 위치를 단일 기준으로 사용:
  - `right: 2px`
  - `bottom: -9px`
  - `top: auto`
  - `transform/translate: none`
- split / compact-pane split / builder-only fullscreen 모두 같은 선택자와 같은 좌표를 사용하도록 최종 규칙으로 통일했다.
- 463~467차의 검색 위치 임시 보정은 파일에 기록으로 남지만 468차 최종 규칙이 우선해 더 이상 실제 배치 계산을 나누지 않는다.
- 검색 클릭영역 34px, 실제 돋보기 24px 크기는 유지했다.

### 사용자 실제 테스트
1. 일반 분할모드에서 승인한 검색 버튼 위치가 그대로인지 확인.
2. 오른쪽 pane을 접어 Sori Studio 분할 전체화면으로 전환했을 때 검색 버튼이 같은 하단 위치로 이동하는지 확인.
3. 분할 ↔ 전체화면을 여러 번 반복해도 검색 위치가 변하지 않는지 확인.
4. 분할바를 넓게/좁게 이동해도 검색 위치가 흔들리지 않는지 확인.
5. 승인된 전체화면 Sori Studio 대문 위치와 크기가 변하지 않았는지 확인.

## 469차 메모

### 기준
- 기준 ZIP: `SORIDRAW_468차_검색버튼_position계약통일_분할전체화면고정.zip`
- 이번 차수는 **Sori Studio 분할 계열 검색 버튼이 첫 카드 아래로 가려지는 현상만** 수정한다.
- 승인된 대문 위치/크기, 검색 아이콘의 체감 하단 위치, Music Note, Library, Classic, 모바일 일반 흐름은 변경하지 않는다.

### 원인
- 468차에서 34px 검색 클릭영역 전체를 `bottom: -9px`로 내리면서 클릭영역 하단 5px가 84px masthead host 밖으로 내려갔다.
- 바로 다음에 그려지는 첫 메뉴 카드의 paint layer가 이 바깥쪽 영역을 덮으면서 검색 아이콘 일부가 카드 아래로 숨는 현상이 발생했다.
- 즉 검색 좌표 자체는 적용됐지만 **클릭영역 박스가 다음 카드 영역으로 침범한 것이 원인**이었다.

### 변경
- 검색 버튼 34px 클릭영역은 masthead 안에서 끝나도록 `bottom: -4px`로 올렸다.
- 실제 24px 돋보기 SVG만 버튼 내부에서 `top: 5px` 내려 468차에서 승인한 체감 하단 위치는 그대로 유지했다.
- 결과적으로 클릭영역은 카드와 겹치지 않고, 보이는 검색 아이콘만 대문 하단 가까이에 위치한다.
- 일반 분할 / compact-pane 분할 / builder-only 전체화면은 계속 같은 최종 규칙 하나를 사용한다.

### 사용자 실제 테스트
1. 일반 분할에서 검색 아이콘이 첫 카드 뒤로 숨지 않는지 확인.
2. 오른쪽 pane을 접어 전체화면으로 전환해도 동일하게 검색 아이콘 전체가 보이는지 확인.
3. 검색 아이콘의 체감 높이는 468차와 동일하게 낮게 유지되는지 확인.
4. 분할 ↔ 전체화면 반복 전환 및 분할바 이동에도 위치가 흔들리지 않는지 확인.
5. 승인된 Sori Studio 대문 위치/크기와 첫 카드 위치가 변하지 않았는지 확인.

## 470차 메모
- 기준: 469차.
- Sori Studio 검색 버튼 위치를 일반 분할과 builder-only 전체화면으로 다시 분리했다.
- 일반 분할/compact split은 사용자가 통과시킨 466차 검색 위치(`bottom:-9px`, 내부 SVG 추가 이동 없음)를 정확히 복구했다.
- 전체화면은 검색 버튼의 containing block을 52px row가 아니라 84px masthead host로 변경했다.
- 전체화면 검색 34px 클릭영역은 masthead 내부 `bottom:0`에 두고, 24px 돋보기만 버튼 하단에 맞춰 카드 뒤로 숨거나 사라지지 않게 했다.
- 승인된 전체화면 Sori Studio 대문 크기/위치, 카드 위치, 분할 스크롤 구조, Music Note/Library/Classic은 변경하지 않았다.


## 471차 메모
- 기준: `SORIDRAW_470차_검색버튼_분할승인위치복구_전체화면독립고정.zip`.
- 일반 분할모드 검색 버튼은 사용자 통과 상태이므로 변경하지 않았다.
- builder-only 전체화면 검색 버튼만 기존 `bottom: 0`에서 `bottom: 6px`로 6px 상향했다.
- 전체화면 검색의 84px masthead host 기준 absolute 구조는 그대로 유지해 카드 뒤 가림/사라짐 방지 구조를 보존했다.
- Sori Studio 대문 크기/위치, 카드 위치, 분할바/스크롤 구조, Music Note, Library, Classic, 일반 모바일은 변경하지 않았다.

### 사용자 실제 테스트
1. 일반 분할모드 검색 버튼이 470차 통과 위치 그대로인지 확인.
2. builder-only 전체화면 검색 버튼만 이전보다 약간 위로 올라왔는지 확인.
3. 전체화면 검색 버튼이 사라지거나 카드 뒤로 숨지 않는지 확인.
4. 분할 ↔ 전체화면 반복 전환 시 각 상태의 검색 위치가 유지되는지 확인.

## 472차 메모
- 기준: `SORIDRAW_471차_전체화면_검색버튼만_6px상향.zip`
- 이번 차수는 Sori Studio의 이미 승인된 대문/검색 정렬을 기준으로 Music Note와 Suno Library만 동시에 맞췄다.
- 대상 상태는 데스크톱 Studio Black의 ① 넓은 분할 result pane, ② pane mobile(좁은 분할), ③ result-only 전체화면이다.
- 두 페이지 result masthead를 Sori Studio와 동일한 84px 박스 / 52px 제목행 / 28px 상단 / 4px 하단 배치로 통일했다.
- Music Note / Library 제목 크기는 Sori Studio와 동일한 `clamp(2rem, 2.45vw, 2.65rem)`으로 통일하고, 일반/좁은 분할에서는 Studio와 같은 5px optical drop, result-only 전체화면에서는 fullscreen 기준선을 사용한다.
- 포털 제목의 가로 기준을 실제 페이지 셸(max 1548px, split 12/10px, pane-mobile 12/12px gutter)과 동일하게 만들어 전체화면에서 제목만 왼쪽으로 튀던 현상을 제거했다. 제목/탭/검색/목록이 같은 세로 가이드에서 시작한다.
- Music Note 새로고침과 Library 크레딧 바로가기도 Studio 검색과 같은 하단 액션 가이드에 맞췄다.
- Sori Studio 자체, 분할바/스크롤 구조, 카드/탭/검색/목록의 기존 크기와 간격, Classic/다크·라이트 일반모드는 변경하지 않았다.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 473차 메모
- 기준: 472차.
- Music Note / Suno Library 대문을 Sori Studio 기준으로 다시 모드별 분리 계산했다.
- 넓은 분할모드는 472차에서 맞은 제목/탭 위치를 유지하고, 우측 새로고침/크레딧 액션만 Studio 검색 가이드에 정렬했다.
- 좁은 `data-pane-mode="mobile"`에서는 기존 컴팩트 제목 크기 `1.85rem`을 고정해 분할바 이동으로 글자 크기가 변하지 않게 하고, 제목과 우측 액션의 위치만 조정했다.
- 결과 전체화면은 포털 대문을 실제 페이지 쉘과 같은 max-width 1548px + 좌우 24px 가이드로 맞춰 제목/액션과 탭·검색·목록의 가로 시작선을 통일했다.
- 실제 1100px 미만 모바일/태블릿은 폰트 크기를 건드리지 않고 Sori Studio와 같은 28px/4px 대문 여백 배치와 4px 하단 흐름만 적용했다.
- Sori Studio, 카드/탭/검색 크기, 분할 스크롤 구조, Firebase/Auth/Firestore/Functions는 변경하지 않았다.

## 474차 메모
- 473차의 단순 CSS 위치 보정 방식 대신, 분할 작업공간에서 Music Note / Suno Library 대문에 `soridraw-studio-scroll-result-masthead` 전용 구조 클래스를 부여했다.
- Studio Black의 1100px 이상 작업공간에서는 Sori Studio와 동일한 84px masthead host + 52px 실제 제목행 구조를 사용한다.
- 넓은 분할은 Sori Studio 분할 제목의 5px optical drop과 동일하게 맞추고, 좁은 pane-mobile은 기존 1.85rem 제목 크기를 그대로 고정한 채 위치만 동일 구조로 맞춘다.
- 오른쪽 전체화면은 Sori Studio 전체화면과 같은 1500px 중앙 콘텐츠 가이드, 제목 baseline, 우측 액션 위치 계약을 사용한다.
- Music Note 새로고침과 Library 크레딧은 Sori Studio 검색 버튼의 분할/전체화면 위치 계약을 각각 따라간다.
- 실제 모바일/태블릿(<1100px)은 제목 font-size를 건드리지 않고 masthead 높이/상하 위치만 Sori Studio 리듬으로 맞춘다.
- Sori Studio 자체, 분할바, 카드/목록, Firebase/Auth/Firestore/Functions는 변경하지 않았다.

## 475차 메모
- 기준: 474차.
- 사용자 검증 결과 `넓은 분할`은 통과 상태라 해당 규칙은 수정하지 않았다.
- 좁은 분할의 `data-pane-mode="mobile"`에서 Music Note / Suno Library 제목을 1.85rem으로 축소하던 474 규칙을 폐기하고, Sori Studio pane-mobile과 동일한 `clamp(2rem, 2.45vw, 2.65rem)` 크기와 5px split optical 위치를 사용하도록 수정했다.
- 오른쪽 전체화면은 포털 대문이 실제 페이지 쉘의 가로 계약과 달라 좌측으로 쏠려 보이던 문제를 수정했다. 대문 행을 실제 페이지와 같은 `max-width:1548px + 좌우 24px` 구조로 맞춰 제목/우측 액션이 탭·검색·목록과 같은 1500px 콘텐츠 가이드를 사용한다.
- 전체화면 대문은 84px 전체 높이를 유지하면서 상단/하단 패딩을 24px/8px로 재분배해 행 전체를 4px 위로 이동했다.
- Music Note 새로고침과 Library 크레딧도 전체화면에서 동일한 24px 우측 가이드에 맞췄다.
- Sori Studio, 넓은 분할, 분할바/스크롤 구조, 실제 1100px 미만 모바일/태블릿, Firebase/Auth/Firestore/Functions는 변경하지 않았다.


## 476차 메모
- Music Note / Suno Library의 Studio workspace 대문에서 legacy page-header 클래스를 제거해 위치 소유권을 전용 result masthead 하나로 분리.
- 474/475의 중복 workspace masthead CSS를 제거하고 476 단일 계약으로 교체.
- 넓은 분할은 승인 위치 유지, compact split은 제목 크기를 별도 축소하지 않으며 Sori Studio와 동일한 brand scale/84px masthead rhythm 사용.
- result-only fullscreen은 기존 Studio fullscreen의 1500px pane child composition을 그대로 사용하고 내부 1548px/24px 이중 폭 계산을 제거.
- 일반 Music Note/Library 페이지 헤더는 기존 legacy class를 유지해 분할 작업공간 외 디자인과 분리.

## 477차 메모
- 기준: 476차.
- Music Note / Suno Library의 Studio Black **오른쪽 전체화면(result-only fullscreen)** 가로 정렬만 수정.
- 476차에서 대문 위치 소유권은 단일 `soridraw-studio-result-masthead`로 정리됐지만, 전체화면 masthead 내부 여백이 2px로 남아 아래 탭/검색/목록의 1500px 중앙 구성보다 왼쪽에 붙던 문제를 수정.
- 전체화면 masthead의 좌측 가이드를 `centered 1500px + 12px`, 우측 액션 가이드를 `centered 1500px + 10px`로 직접 계산하여 아래 콘텐츠와 같은 세로선에 정렬.
- 넓은 분할, compact/mobile pane, 실제 모바일, Sori Studio는 변경하지 않음.


## 478차 메모
- 전체화면 Music Note / Library 대문의 좌측 쏠림 원인을 실제 CSS 소유권 기준으로 수정.
- 334의 `result-pane > *` 1500px 직접 자식 캡과 361의 workspace-page 100% 재확장 때문에 대문 host와 본문이 서로 다른 가로 좌표계를 쓰던 충돌을 제거.
- 전체화면에서만 masthead host를 100% scroll-shell 폭으로 풀고, 내부 masthead row를 본문과 동일한 1548px 중앙 shell + 12px/10px gutter로 통일.
- 넓은 분할/모바일 분할/모바일 글자 크기/세로 위치는 변경하지 않음.


## 479차 메모
- 기준: 478차.
- 범위: Studio Black의 Music Note / Suno Library `result-only fullscreen` masthead 가로 정렬만 미세조정. 넓은 분할/모바일형 분할/Sori Studio는 변경하지 않음.
- 478차에서 masthead와 본문이 같은 1548px 좌표계로 움직이기 시작한 것을 확인한 뒤, 실제 스크린샷에서 제목 시작점이 본문(탭/검색)보다 약 24px 왼쪽, 우측 액션은 약 24px 바깥쪽인 차이를 보정.
- fullscreen masthead row의 좌측 gutter를 12px→36px, 우측 gutter를 10px→34px로 변경. Music Note 새로고침과 Library 크레딧 액션의 right도 10px→34px로 맞춤.
- 세로 위치, 제목 크기, 탭/검색/목록, 모바일형 pane, 넓은 분할 상태는 유지.

## 480차 메모
- 기준: `SORIDRAW_479차_전체화면_대문좌측24px안쪽_우측액션24px안쪽.zip`
- 최근 생성곡 result-only 전체화면만 수정.
- 원인: 420차 레거시 규칙이 최근 생성곡 전체화면에서 `soridraw-studio-hero`를 보이지 않게만 처리하고 실제 높이/상단 padding은 유지해, split보다 큰 빈 상단 영역을 만들고 있었음.
- 수정: 최근 생성곡 전체화면에서는 레거시 hidden hero를 완전히 0으로 제거하고, split/Music Note/Library와 같은 `110px main start + 84px pane masthead host` 구조를 사용하도록 통일.
- 분할모드, Sori Studio builder 전체화면, Music Note, Library, 모바일/태블릿 일반 흐름, Classic은 변경하지 않음.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 486차 - 반응형/리사이즈 처리 통합 및 성능 정리

- 기준: 484차 (485차 폐기)
- UI 디자인/Firestore/Auth/Functions/저장 구조 변경 없음.
- PC/태블릿/모바일 외곽 모드는 1600 / 1100 경계를 유지한다.
- breakpoint 전용 처리를 공용 matchMedia store로 이동해, 창을 1px씩 줄일 때 React 상태가 반복 갱신되지 않게 했다.
- StudioPageFrame의 synthetic `window.resize` 재발행을 제거하고 전용 `soridraw-studio-frame-resize`만 유지했다.
- StudioSplitWorkspace는 실제 workspace ResizeObserver를 단일 수평 리사이즈 소스로 사용하고, 같은 프레임의 중복 callback을 rAF 1회로 합쳤다. native resize는 세로 viewport 높이 변화에만 사용한다.
- 전체창 수평 리사이즈 중 workspace 고정 높이를 매 프레임 재측정하던 forced-layout 경로를 제거했다.
- Music Note / Library masthead portal host는 1100px breakpoint 변경과 pane/theme 이벤트에만 재선택한다.
- 생성 카드 5개의 높이 측정은 각자 window.resize를 듣지 않고 ResizeObserver + 90ms settle 측정으로 변경했다.
- 하단 생성 액션바는 window.resize 직접 측정 대신 anchor ResizeObserver + rAF로 합쳤다.
- GlobalPlayer의 768/1320 breakpoint 상태는 공용 matchMedia를 사용하고 제목 폭 측정은 로컬 ResizeObserver로 제한했다.
- 484차의 최근 생성곡 제목 위 갈색선 제거는 유지한다.

## 488차 — PC/태블릿/모바일 조건 보존 + 연속 리사이즈 경량화
- 기준은 486차입니다. 487차의 split geometry 변경과 tablet 확장 isolation은 가져오지 않았습니다.
- viewport 조건은 기존 그대로 유지합니다: 1600px 이상 PC, 1100~1599px 태블릿/compact, 1100px 미만 모바일.
- 태블릿에서는 기존 bridge CSS가 좌우 보조 rail을 숨기고 중앙 split workspace가 전체 폭을 사용합니다.
- 내부 분할바는 viewport 모드와 분리되어 builder/result의 실제 pane 폭만 변경하고, 각 pane의 `data-pane-mode`가 기존 820px/680px 기준으로 독립 반응합니다.
- 창 크기 조절 또는 분할바 드래그 중에는 pane geometry를 바꾸지 않고, 무거운 nested container query와 transition/animation 계산만 일시 중지합니다. 조작 종료 후 한 번만 전체 responsive detail을 복구합니다.
- 생성 카드 높이와 하단 생성바 위치 측정도 연속 resize 중에는 중지하고 종료 후 한 번만 갱신합니다.
- 487차에서 발생한 결과 pane blank/검은 공간 문제를 만들었던 live split variable/absolute geometry 교체는 적용하지 않았습니다.
- Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.

## 506차 — 488 기준 PC/태블릿 양쪽 메뉴 단일 디자인 1단계
- 기준: `SORIDRAW_488차_PC태블릿모드보존_분할창리사이즈경량화(1).zip`.
- 이번 차수는 좌우 보조 메뉴만 수정했다. `StudioPageFrame.tsx`, `StudioLeftRail.tsx`, `StudioRightRail.tsx`의 488 동작 로직/DOM은 그대로 보존했다.
- 488의 상태 계약 유지: PC(>=1600)는 저장된 펼침/접힘 상태를 사용하고, 태블릿(1100~1599)에 진입하면 양쪽 메뉴가 접힘 상태로 시작한다. 태블릿에서도 좌우 펼치기/접기 버튼은 그대로 동작한다. 태블릿 조작은 PC 저장 상태를 덮어쓰지 않는다.
- PC에서 사용하던 좌우 메뉴 시각 CSS를 1100px 이상 공통 계약으로 승격했다. 글자 크기, 아이콘, 프로필 행, 펼치기/접기 버튼, 메뉴 행, 우측 생성 상태/최근곡/크레딧 카드가 별도 태블릿 디자인으로 바뀌지 않도록 했다.
- `index.css`의 두 Studio rail 기본 블록을 1280px 시작에서 1100px 시작으로 통일했다.
- `studioLayout.css`에서 239/310-tablet/312/313-tablet/405/406/407 계열의 태블릿 전용 rail 재설계·보정 규칙을 제거했다. `data-rail-viewport="compact"`를 이용한 시각 CSS는 0개로 정리했다.
- 488에서 정상 동작하던 builder 접힘 시 compact 상단 여백(76px)은 별도 규칙으로 보존했다. 중앙 분할 로직, 대문, Music Note, Library, 생성 기능, Firebase/Auth/Firestore/Functions/저장 구조는 건드리지 않았다.
- 정적 검사: `index.css` / `studioLayout.css` tinycss2 파싱 오류 0. TypeScript 검사 결과는 488과 동일한 기존 오류 211줄이며 신규 오류가 없다.
- 상태: 코드 반영 완료 · 실사용 검증 전. 다음 단계로 넘어가기 전에 PC/태블릿 양쪽 메뉴의 펼침/접힘 왕복과 디자인 동일성만 먼저 확인한다.


## 507차 — 왼쪽 메뉴 펼침/접힘 전환 순간 레이아웃 깨짐 제거

- 기준: 506차(488 기준 1단계)
- 수정 범위: `src/index.css`만 기능 수정.
- 원인: 왼쪽 메뉴 행에 `transition: 0.16s ease`가 걸려 있어 접힘 40px → 펼침 100% 전환 때 `width/padding/gap`까지 애니메이션되었다. 텍스트는 즉시 표시되지만 버튼 폭은 약 160ms 동안 좁은 상태를 지나가면서 글자가 세로로 쌓이는 순간 프레임이 발생했다.
- 수정: 메뉴 행 transition을 `background-color / color / border-color`로만 제한. 펼침/접힘의 폭·패딩·간격은 애니메이션 없이 같은 프레임에 즉시 전환한다.
- 보존: 488의 좌우 메뉴 상태 로직, 태블릿 진입 시 자동 접힘, 태블릿에서 수동 펼침/접힘, PC 상태 저장, 오른쪽 메뉴, 중앙 분할, 대문, Music Note/Library는 변경하지 않았다.

### 508차 — Music Note / Library dark·split content layout unification
- Base: 507차.
- Added `src/lib/contentResponsive.ts`: one real-width observer for Music Note / Library. It writes responsive attributes only when 1080 / 820 / 680 thresholds are crossed.
- Music Note and Suno Library page roots now opt into `soridraw-responsive-content-page`.
- Canonical visual reference is the existing Studio result-pane layout. Standalone dark pages and embedded split pages now use the same horizontal gutters, tab density, search/filter compact behavior, Music Note row density, Library text density, and compact credit-button geometry at the same real content width.
- Compact mode is now based on actual page width <= 680px, not `browser <= 767px` versus `result-pane mobile` as two separate design triggers.
- Masthead/portal ownership and Sori Studio/side rails/splitter are intentionally untouched in this step.
- No Firebase/Auth/Firestore/Functions/storage schema changes.

### 509차 — 1100px 직전 상단 내비게이션 겹침 수정
- 기준: 508차.
- 전역 상단 내비게이션 전환 기준을 Tailwind `lg`(1024px)에서 SORIDRAW 외곽 반응형 기준인 1100px로 일치시켰다.
- 1024~1099px 구간에서 데스크톱 메뉴가 억지로 유지되어 메뉴/외부앱/프로필이 겹치던 현상을 제거했다.
- 1100px 미만에서는 모바일 아이콘 바, 1100px 이상에서는 데스크톱 상단 메뉴를 사용한다.
- Music Note/Library 콘텐츠 반응형 계약, Studio 좌우 메뉴, 분할바, Firebase/저장 구조는 변경하지 않았다.


## 510차 — 모바일→태블릿 전환점 상단 내비게이션 오판정 수정
- 기준: 509차
- 수정: `src/App.tsx`
- 원인: 전체 쉘 기준은 PC >=1600 / Tablet 1100~1599 / Mobile <1100인데, 509차에서 전체 PC 상단 내비게이션을 1100px부터 표시해 태블릿 진입 순간 폭이 부족한 PC 메뉴가 켜졌다. 외부 앱 버튼/프로필/메뉴가 겹치고 Music Note/Library 상단 레이아웃이 순간적으로 튀었다.
- 수정: 전체 PC 상단 내비게이션은 1600px 이상에서만 표시. 1600px 미만(모바일+태블릿)은 기존 아이콘형 compact 상단바를 유지한다.
- 범위: Music Note/Library 전환 구간의 공통 상단바만 수정. 페이지 내부 반응형, Studio, 좌우 rail, split, Firebase/저장 구조는 미수정.


## 511차 — Music Note / Library 모바일↔태블릿 판정 루프 제거
- 기준: 510차.
- `src/lib/contentResponsive.ts`의 반응형 판정 폭을 `ResizeObserverEntry.contentRect.width`(content-box)에서 `getBoundingClientRect().width`(border-box)로 변경.
- 508에서 모바일/태블릿 모드별 페이지 좌우 padding이 달라지면서 content-box 폭 자체가 바뀌어, 680px 경계 부근에서 `tablet → mobile → tablet` 판정이 반복되던 피드백 루프를 제거.
- Music Note / Library가 공유하는 반응형 유틸만 수정했으며 상단바, Studio, 분할바, Firebase/저장 구조는 변경하지 않음.

### 512차 — Music Note / Library 일반모드 창 크기 전환을 분할모드 기준과 동일화
- 511차의 실제 폭 기반 responsive contract(모바일 <=680 / 태블릿 681~1080 / PC >1080)를 일반 다크 화면의 레거시 viewport 보정에도 동일하게 적용했다.
- Music Note / Library에 남아 있던 `max-width: 767px` 모바일 보정은 `max-width: 680px`, 짝이 되는 `min-width: 768px` 보정은 `min-width: 681px`로 맞췄다.
- 따라서 일반모드에서도 분할 pane과 동일하게 `태블릿 -> 모바일`이 680px 경계 하나에서 전환되며, 681~767px의 짧은 혼합 단계가 생기지 않는다.
- Sori Studio, 좌/우 레일, 분할바, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않았다.


### 513차 — Music Note / Library 목록 중간형 제거
- 기준: 512차.
- 대상은 Music Note / Library의 곡 목록 반응형만이다. Studio 본체, 좌우 rail, splitter, 대문 구조는 변경하지 않았다.
- 508에서 남아 있던 Music Note 820px/1080px 키워드 폭 중간 단계와 해당 data attribute 기록을 제거했다. 목록은 이제 `비모바일(PC+태블릿)` / `모바일(<=680px)` 두 밀도만 사용한다.
- split 결과 pane의 `data-pane-mode`는 Studio 자체의 16px hysteresis를 계속 유지하지만, Music Note / Library 목록 디자인에는 더 이상 개입하지 못하게 최종 목록 규격을 page의 `data-soridraw-responsive-mode` 하나로 고정했다.
- 따라서 일반 다크와 분할모드 모두 목록은 680px에서 한 번만 모바일 규격으로 전환하며, 중간에 media/text/actions/keyword/track-gap이 별도로 한 번 더 바뀌는 짧은 혼합형을 제거했다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

### 514차 - Music Note / Library 모바일 전환 시점 지연
- 513차에서 중간 목록형을 제거한 상태를 유지하면서 모바일 전환 기준을 실제 콘텐츠 폭 680px → 640px로 낮췄다.
- 일반모드 Music Note / Library의 관련 680/681 media 기준도 640/641로 함께 맞춰, 일반모드와 분할모드가 같은 시점에 전환된다.
- 분할모드에서 Music Note / Library를 띄운 경우 result pane의 전환 기준도 640px 계열로 맞추고, 이 두 화면에 한해서 16px pane-mode hysteresis를 사용하지 않는다. 따라서 페이지 자체 판정과 부모 pane 판정이 서로 다른 순간에 바뀌는 짧은 혼합 상태를 만들지 않는다.
- 생성 결과 등 다른 result pane 화면은 기존 680px + 16px hysteresis를 그대로 유지한다.
- Studio 본체, 좌우 메뉴, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.


## 515차 — 모바일 전환 지연 재조정 + 전체 버튼 세로깨짐 제거
- 514차의 640px 지연은 과도해서 실제 사용 구간에서 모바일 전환 전에 일반/태블릿 UI만 눌렸고, 색상 필터의 `전체` 텍스트가 세로로 접히는 잘못된 중간 상태가 생겼습니다.
- Music Note / Library의 공통 모바일 전환 기준을 680px 원래 기준보다 조금 늦은 660px로 재조정했습니다.
- 일반모드와 분할모드 모두 같은 660px 기준을 사용하며, 분할 결과 pane의 모드 판정도 661px 경계/무히스테리시스로 동기화됩니다.
- 모바일 전환 전에는 색상 필터와 `전체` 버튼이 줄어들거나 줄바꿈되지 않도록 고정했습니다.
- 660px 이하가 되는 순간 검색/필터/색상 전체 버튼/목록 밀도가 함께 모바일 디자인으로 전환됩니다.
- Studio 본체, 좌우 메뉴, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았습니다.


## 516차 - Library credit size + list divider alignment
- Suno Library `남은 크레딧` 버튼은 PC/태블릿/모바일/분할모드에서 모두 모바일 기준 36px 높이, 10px 좌우 여백, 12px 라운드, 10px 텍스트로 통일했습니다.
- Library의 검색창과 첫 곡 사이 가로선은 Music Note와 같은 시각적 중앙 위치를 사용하도록 조정했습니다. 목록/카드 간격 자체는 변경하지 않았습니다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 517차 — 분할바 이동 중 하단 생성영역 연속 변형 제거
- 기준: 516차.
- 영상에서 분할바를 움직일 때 하단 `생성하기` 영역의 높이, 글자, 아이콘, 내부 간격, 라운드가 builder 폭에 비례해 매 픽셀 계속 커졌다/작아졌다 하는 현상을 확인했습니다.
- 원인은 `studioLayout.css`의 Studio Black 하단 action bar가 `--soridraw-studio-builder-width`를 이용해 control-height / gap / padding / radius / font-size / icon-size를 모두 연속 `clamp(calc(...))`로 계산하던 구조였습니다.
- 수정: 분할바 이동 중에는 action bar의 **위치와 사용 가능한 가로폭만** builder pane을 실시간 추적하고, 내부 세로 밀도는 60px 높이 / 18px 글자 / 18px 아이콘 / 7px 간격 / 11~16px radius로 고정했습니다.
- 681px 기준의 기존 compact/label 전환, action bar floating/inline owner 구조, 접기 기능, 생성 기능, 분할바 자체 동작은 유지했습니다.
- 변경 파일: `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 518차 — 분할바 이동 시 하단 생성바 분할선 밀착 / 모바일형 오전환 제거
- 기준: 517차
- Studio Black 분할모드의 하단 생성하기 영역만 수정.
- 분할바 드래그 중 floating action bar가 builder 전체폭을 그대로 채우면서 분할선에 붙어 보이던 현상을 막기 위해 PC/태블릿(>=1100px)에서 좌우 18px 고정 여백을 유지.
- 하단 생성바가 자체 681px container query 때문에 분할바 이동 중 `무작위/전체초기화` 라벨을 숨기고 모바일형처럼 변하던 이중 반응형을 차단.
- PC/태블릿 분할모드에서는 생성바 내부 구성을 한 가지 desktop 형태로 유지하고, 실제 앱 모바일(<1100px) 규칙은 그대로 유지.
- 분할바 위치/폭 계산, Studio 본문 pane 반응형, 생성 기능, Firebase/저장 구조는 변경하지 않음.


## 519차 - 분할 드래그 실시간 반응형 / 생성바 좌표 소유권 정리
- 기준: 518차
- 분할바를 잡는 동안 builder/result/action panel의 container-type을 끄던 488 최적화 범위를 축소했다. 이제 핵심 pane 반응형은 드래그 중에도 실제 pane 폭을 즉시 따른다.
- 하단 생성하기 floating bar는 드래그 중 DOM inline left/width와 CSS root 변수가 경쟁하지 않도록, `--soridraw-action-fixed-left/width` 한 좌표 경로로 통일했다.
- Studio Black의 접힌 키워드 카드 높이는 브라우저 `window.innerWidth`가 아니라 builder pane의 `data-pane-mode`를 따른다.
- 분할 rAF 직접 이동, floating/inline 소유권 전환 지연, 결과 타이틀의 무거운 높이 재측정 지연은 유지해 성능 보호 범위를 남겼다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 520차 - 분할 클릭/드래그 시작 시 생성바 첫 프레임 점프 제거
- 기준: 519차.
- 영상에서 분할바를 누른 직후 생성바가 한 번 흔들린 뒤 드래그 폭을 따라가는 현상을 재분석했다.
- 원인은 휴지 상태에서 App.tsx가 실제 `.soridraw-studio-action-anchor-expanded`의 viewport rect로 floating 생성바를 배치하지만, 드래그 fast path는 builder pane 전체 rect를 그대로 `--soridraw-action-fixed-left/width`에 넣어 서로 다른 가로 기준을 사용하던 것이었다.
- pointer-down 시 실제 action anchor와 builder pane 사이의 좌/우 inset을 1회 측정해 저장하고, 드래그 중에는 `builderWidth - insetLeft - insetRight`와 `builderLeft + insetLeft`만 rAF 산술로 갱신하도록 변경했다.
- 드래그 시작 전 현재 anchor rect를 root 변수에 먼저 seed해 첫 rAF 프레임이 휴지 상태와 픽셀 단위로 동일한 좌표에서 시작하게 했다.
- 매 pointer frame에 getBoundingClientRect를 추가하지 않았으므로 기존 rAF 성능 경로는 유지한다.
- 수정 파일: `src/components/studio/StudioSplitWorkspace.tsx`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 521차 — 분할 생성바 Builder 모바일모드 연동
- 520의 드래그 좌표/첫 프레임 안정화는 그대로 유지합니다.
- 분할 Builder의 기존 `desktop/mobile` 판정을 body portal 생성바에도 동일 프레임으로 전달합니다.
- Builder가 mobile 판정이 되면 생성바는 별도 viewport 판정 없이 즉시 모바일형 3버튼 구성(무작위 아이콘 / 생성하기 / 초기화 아이콘)으로 전환됩니다.
- Builder가 desktop으로 돌아오면 기존 PC형(접기 + 라벨 포함) 구성으로 복귀합니다.
- 전환은 두 상태만 사용하며 폭에 비례한 연속 축소/중간형은 추가하지 않습니다.

## 522차 — 분할 Builder 모바일 생성바 스와이프 접기 통일
- 기준: 521차.
- 521에서 안정화된 분할바 드래그 좌표/첫 프레임/Builder mobile 3버튼 전환은 그대로 유지한다.
- 분할모드에서 Builder가 `mobile` 판정일 때는 생성바의 별도 `<-` 접기 버튼을 렌더링하지 않는다. 실제 모바일 생성바와 같은 3버튼 형태만 유지한다.
- 실제 모바일에서 이미 사용하던 생성바 좌측 스와이프 접기 제스처를 분할 Builder mobile 상태에도 그대로 재사용한다. 왼쪽으로 충분히 드래그하면 생성바가 접힌 탭 상태로 전환된다.
- 접힌 탭도 같은 조건에서 오른쪽 스와이프로 다시 펼칠 수 있고, 기존 클릭 펼치기도 유지한다.
- Builder `desktop` 상태에서는 기존 PC형 `<-` 접기 버튼과 클릭 접기 방식을 그대로 유지한다.
- pane 폭의 매 픽셀마다 React 상태를 갱신하지 않고 `<html data-soridraw-builder-mode>`가 실제 breakpoint를 넘을 때만 MutationObserver로 제스처 모드를 전환한다.
- 수정 파일: `src/App.tsx`, `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 523차 — 생성바 스와이프 후 생성하기 오클릭 차단
- 기준: 522차.
- 실제 모바일 / 일반 테마 / Studio Black 분할 Builder mobile이 공통으로 사용하는 생성바 스와이프에서, 생성하기 버튼 위에서 좌측 드래그를 시작하고 포인터를 다시 생성하기 버튼 안에서 놓으면 브라우저가 pointerup 뒤 `click`을 합성해 생성 모달까지 실행하던 문제를 수정했다.
- 공통 `soridraw-studio-action-row`에서 Framer Motion의 `onDragStart` 시점부터 제스처를 소비한 것으로 표시하고, 드래그 종료 직후 발생하는 후행 click을 capture 단계에서 `preventDefault + stopPropagation`으로 차단한다.
- 정상적인 단순 클릭은 `onDragStart`가 발생하지 않으므로 기존 생성하기 / 무작위 / 초기화 클릭 동작은 그대로 유지한다.
- 왼쪽 스와이프가 접기 임계값에 도달하면 접기만 실행되고, 손을 놓은 위치가 생성하기 버튼 내부여도 생성하기가 실행되지 않는다. 임계값에 못 미친 드래그도 버튼 클릭으로 오인하지 않는다.
- 수정 파일: `src/App.tsx`, `README.md`. CSS / 분할바 좌표 / Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 524차 — 분할 생성바 Dark/Light 비율감 통일
- 기준: 523차.
- 사용자 비교 영상에서 Classic Dark/Light 생성바는 모바일 약 69px, PC 약 90px 높이의 통통한 비율인데 Studio Black 분할 생성바는 모바일/PC 모두 60px로 강제되어 납작해 보이는 차이를 확인했습니다.
- Studio Black의 색상/분할 배치/드래그 좌표/스와이프 동작은 유지하고, 생성바의 **시각 치수만** Classic 기준으로 맞췄습니다.
- PC형: control 90px, 글자 34px, 아이콘 24px, row gap 12px, padding 10px, radius 24px, 접기 폭 48px, 좌우 라벨 버튼은 Classic처럼 내용폭 + 24px 좌우 padding을 사용합니다.
- Builder mobile형: control 69px, 글자 25px, 아이콘 20px, row gap/padding 8px, radius 24px로 맞추고, floating 바 좌우 gutter를 18px→8px로 줄여 Dark/Light 모바일처럼 좌우를 더 꽉 채운 확대감으로 조정했습니다.
- visible action panel max-width도 Classic의 max-w-4xl과 같은 896px로 맞췄습니다.
- Studio 본문, 분할바, Builder mobile 판정, 520~523의 드래그 안정화/스와이프/오클릭 차단 로직은 변경하지 않았습니다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

### 525차 — 생성바 확대 후 도킹 위치/접기 위치 안정화
- 524에서 생성바를 크게 만든 뒤 floating/inline 전환 때 외곽 wrapper 높이를 캐시하면서, inline 전용 12px 상단 padding까지 높이에 섞여 도킹 판정이 흔들리던 구조를 수정했습니다.
- 생성바 높이 측정 기준을 실제 `.soridraw-studio-action-row` 높이 하나로 통일하고, inline anchor는 항상 `실제 row 높이 + 12px`만 예약합니다.
- 커진 시각 높이가 기존 도킹 타이밍까지 밀어내지 않도록 도킹 판정용 높이는 기존 compact 동작 범위(최대 94px)로 분리했습니다. 따라서 화면 최하단에서는 다시 명령창 바로 아래의 실제 in-flow 자리로 들어갑니다.
- 이미 inline으로 들어간 상태에서 접으면 collapsed 탭이 viewport 하단으로 재배치되지 않고 같은 명령창 아래 세로 위치를 유지합니다. 스크롤 중에도 실제 anchor 위치를 따라갑니다.
- 520~524에서 완료한 분할바 드래그 좌표 안정화, builder-mobile 3버튼 전환, 스와이프 접기/오클릭 차단, 확대된 생성바 비율은 유지합니다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

### 528차 — 분할 Music Note / Suno Library 선택탭 인셋 규칙 정리
- 기준: 525차 (526/527의 실패한 후속 덮어쓰기는 폐기)
- 426~431에 누적되어 있던 선택탭 full-fill 확장 규칙을 하나의 canonical rule로 교체.
- 부모 46px / 내부 버튼 40px / 상하 3px·좌우 4px inset.
- 선택/hover 표면은 부모 가장자리까지 확장하지 않음.
- Music Note coral, Library purple, 선택 텍스트 검정 유지.


## 529차 — 분할 Music Note / Library 탭 라운드 미세 조정
- 기준: 528차
- 범위: Studio Black 분할모드의 Music Note / Suno Library 3단 탭만 수정.
- 부모 탭 바의 46px 높이, 16px 라운드, 3px/4px 인셋은 그대로 유지.
- 내부 하위 버튼 및 active/hover 페인트 라운드만 12px → 14px로 조정해 Classic Dark의 더 둥근 인상에 맞춤.
- 선택 색상과 선택 텍스트 검정색은 그대로 유지.
- 일반 Dark/Light, 생성바, 분할바, Firebase/저장 구조는 변경하지 않음.

## 530차 - 분할 생성바 하단 도킹/접기 위치 안정화
- 기준: 529차.
- 분할모드의 Builder는 독립 스크롤 영역이므로, 생성바 도킹 판정을 브라우저 viewport 하단이 아니라 Builder 안의 실제 생성바 자리(anchor)가 완전히 보이는지로 판단하도록 변경했다.
- 최하단에서 실제 자리가 보이면 floating 생성바가 명령창 아래의 inline 자리로 내려간다.
- 그 자리에서 접을 때 anchor 높이를 제거하지 않도록 하여 독립 스크롤의 scrollHeight/scrollTop이 갑자기 바뀌면서 접힌 생성바가 위로 튀는 현상을 막았다.
- 전체화면/Classic의 기존 viewport 기반 생성바 판정은 유지했다.
- 뮤직노트/라이브러리 및 Firebase/저장 구조는 변경하지 않았다.

## 531차 - 분할 생성바 접힘/펼침 도킹 규칙 단일화
- 기준: 530차.
- 원인: 접힌 상태에서는 `updateActionBarPlacement()`가 조기 종료되어 Builder를 스크롤해도 floating/inline 판정이 갱신되지 않았고, 다시 펼칠 때 과거 상태를 그대로 사용해 명령창 아래 자리로 내려가지 않는 잠김 현상이 있었다.
- 분할모드 도킹 판정을 현재 anchor 높이(`rect.bottom`)가 아니라 `anchor top + 실제 생성바 자연 높이`로 변경했다. 접힘/펼침 때문에 anchor 예약 높이가 바뀌어도 판정 기준 자체가 움직이지 않는다.
- 접힌 상태에서도 Builder 스크롤에 따라 floating ↔ docked 판정을 계속 갱신한다. 따라서 접은 채 최하단으로 내려가도 실제 자리가 보이면 docked 상태가 되고, 그 상태에서 펼치면 같은 명령창 아래 자리에서 바로 펼쳐진다.
- docked 접힌 버튼의 높이를 실제 생성바 행 높이 이하로 제한하여 최하단에서 버튼 하단이 Builder/footer 아래로 살짝 가려지던 현상을 방지했다.
- docked 상태에서는 접힘/펼침 모두 동일한 anchor 예약 높이를 유지해 스크롤 가능한 아래 영역이 상태마다 달라지지 않도록 했다.
- 전체화면/Classic의 기존 viewport 기반 판정, 분할바 드래그 좌표 안정화, 모바일 3버튼/스와이프 동작은 변경하지 않았다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 532차 — 생성바 공통 도킹 규칙 + 분할 드래그 확장상태 경량화
- 기준: 531차.
- 접힘/펼침마다 서로 다른 세로 위치/스크롤 규칙을 사용하던 구조를 제거하고, Studio Black 전체화면/분할 PC/Tablet/Builder-mobile 모두 `floating / inline` 한 가지 배치 상태만 사용하도록 정리했다.
- Studio Black에서는 생성바가 보이는 동안 실제 명령창 아래 action anchor가 항상 동일한 높이를 예약한다. 따라서 접힌 상태와 펼친 상태의 최하단 스크롤 범위가 동일하고, 접기/펼치기는 위치가 아니라 외형만 바뀐다.
- 도킹 판정은 공통 anchor의 실제 `rect.bottom`과 현재 표시 영역 하단을 비교하는 한 규칙으로 통일했다. 분할모드는 Builder 하단, 전체화면은 viewport 하단을 사용한다.
- 접힌 버튼도 별도 `collapsed-docked` 상태/저장 top을 사용하지 않고 `data-soridraw-placement="floating|inline"`을 그대로 공유한다. 명령창 아래에서 접거나 펼쳐도 같은 row top을 사용한다.
- 생성바의 row/slot 높이를 JS 측정값이 아니라 CSS 공통 변수(`control + padding`, `row + 12px`)로 정의해 상태 전환 시 높이 캐시가 달라지는 원인을 제거했다.
- 신규 `src/lib/studioActionBarGeometry.ts`에 floating 생성바의 left/width 계산을 공통화하여 App의 평상시 배치와 SplitWorkspace의 rAF 드래그 배치가 같은 수식을 사용한다.
- 확장 생성바 드래그 성능: action panel의 중복 `@container studio-action-panel` 판정을 제거하고 Builder mode/viewport 한 규칙으로 반응형을 소유하게 했다. 98% 불투명한 Studio Black 생성바의 불필요한 backdrop blur도 제거했다.
- 896px 패널 최대폭보다 넓은 Builder에서는 portal tracking box 자체를 `896px + gutter`까지만 유지하고 중앙만 이동시켜, 분할바 매 픽셀마다 큰 생성바 내부 전체가 재레이아웃되는 범위를 줄였다. 좁은 Builder에서는 기존처럼 실제 폭을 따라간다.
- 520~529에서 통과/개선된 분할바 좌표 안정화, Builder-mobile 3버튼, 스와이프 접기, 스와이프 후 오클릭 차단, Music Note/Library UI는 변경하지 않았다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 533차 — 생성바 접힘 상태 유령 스크롤 공간 제거

- 기준: 532차
- 생성바 세로 배치 규칙을 단순화했다. 펼친 생성바만 `floating / inline` 도킹을 사용한다.
- 접힌 생성 컨트롤은 모든 테마에서 항상 floating edge tab으로 동작하고 inline/docked 위치를 기억하지 않는다.
- Studio Black에서 접힌 상태에도 `soridraw-studio-action-anchor-expanded` 높이를 강제로 남기던 532 규칙을 제거했다. 따라서 접으면 펼친 생성바 높이만큼 빈 스크롤 공간이 생기지 않는다.
- 접힘 상태에서는 action-bar 도킹/ResizeObserver 재계산도 중지해 불필요한 위치 계산을 줄였다.
- 분할바 드래그, 모바일 3버튼, 스와이프 접기, 스와이프 후 생성 오클릭 차단, 생성 기능은 변경하지 않았다.

## 534차 — 생성바 접기/펼치기 화면 위치 공통 기준 통일
- 기준: 533차.
- 3가지 분할 반응형 상태(PC / Tablet / Builder-mobile)에서 접기 순간의 세로 위치가 달라지는 원인을 공통 규칙으로 정리했다.
- 접기 직전 현재 펼쳐진 생성바의 실제 화면 하단 좌표를 한 번 캡처하고, 접힌 edge tab이 그 동일한 화면 하단선에서 나타나도록 `--soridraw-action-collapsed-visual-bottom` 공통 기준을 사용한다.
- 접힌 버튼의 `initial y: 8 -> 0` 상승 애니메이션을 제거했다. 접기 자체가 위로 8px 이동하는 Motion 효과를 더 이상 만들지 않는다.
- 533에서 접기 시 `inline -> floating`을 강제로 바꾸던 상태 변경을 제거했다. 접기는 모양만 바꾸고 마지막 expanded 배치 상태를 보존하므로, 다시 펼칠 때도 먼저 같은 inline/floating 문맥으로 복귀한다.
- 접힌 상태에서는 도킹을 새로 계산하지 않지만 마지막 expanded placement를 덮어쓰지도 않는다.
- 접힘 상태의 anchor 높이 0 규칙은 그대로 유지해 533에서 해결한 유령 하단 스크롤 공간은 다시 만들지 않는다.
- Studio Black뿐 아니라 Classic/Dark/Light도 같은 캡처 변수를 사용하도록 공통 브리지를 추가했으며, 캡처 값이 없을 때 기존 breakpoint별 기본 bottom 값은 유지한다.
- 분할바 드래그 geometry, 모바일 3버튼/스와이프, Music Note/Library, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 상태: 코드 반영 완료 · 실사용 검증 전.
- 추가 안정화: inline 슬롯 제거로 브라우저가 scrollTop을 자동 clamp한 경우, 접힌 동안 사용자가 스크롤하지 않았다면 펼칠 때 원래 scrollTop을 먼저 복원한 뒤 도킹을 재판정한다. 그래서 533의 `anchor=0`(유령 공간 제거)은 유지하면서 단순 접기→펼치기에서 화면 내용과 생성바 위치가 서로 다른 지점으로 돌아가는 문제를 막는다.

## 535차 — 생성바 Y축 단일 소유권 + 분할 드래그 경량화
- 기준: 534차.
- 영상에서 반복된 “어떤 때는 맞고 어떤 때는 잠기는” 현상의 핵심 원인을 Studio Black 생성바의 `floating / inline / collapsed snapshot` 다중 세로 좌표 소유권으로 판단하고 구조를 단순화했다.
- Studio Black의 펼친 생성바는 더 이상 inline/docked DOM owner로 전환하지 않고 항상 body fixed portal 한 개만 사용한다. 접기/펼치기, PC/Tablet/Builder-mobile 전환은 생성바 모양과 내부 구성만 바꾸며 Y 위치 소유권은 바꾸지 않는다.
- 펼친 생성바와 접힌 edge tab은 모두 `--soridraw-action-current-bottom` 하나를 사용한다. 평상시 하단 간격은 동일하고, 실제 Footer가 올라올 때만 `--soridraw-studio-action-footer-offset`이 공통 baseline을 위로 민다.
- Studio Black에서는 534의 `--soridraw-action-collapsed-visual-bottom` 캡처, inline 슬롯 제거에 따른 scrollTop snapshot/복원, 접힌 상태의 과거 dock 상태 기억을 사용하지 않는다. 접기/펼치기는 순수한 shape swap이므로 상태별 스크롤 길이 보정 로직이 사라졌다. Classic/Dark/Light의 기존 캡처 동작은 유지한다.
- Studio Black action anchor는 높이를 예약하는 슬롯이 아니라 `soridraw-studio-action-geometry-anchor`라는 0높이 X/width 측정점으로 분리했다. 따라서 생성바 상태가 바뀌어도 Builder의 scrollHeight가 달라지지 않는다.
- App.tsx에서 Studio Black 생성바 위치를 위해 중복으로 붙어 있던 두 번째 ResizeObserver + Builder scroll listener를 제거했다. Studio Black은 스크롤 때 App 레벨 도킹 판정을 더 이상 실행하지 않고, Footer 충돌 계산은 SplitWorkspace의 기존 rAF-coalesced 경로 하나만 사용한다.
- 분할바를 접힌 생성바 상태로 움직일 때도 `--soridraw-action-fixed-left/width`를 매 rAF에 계속 갱신하도록 변경했다. 이전에는 펼친 portal이 존재할 때만 root geometry를 갱신해, 접힌 채 PC/mobile 폭을 넘긴 뒤 펼치면 한 프레임 오래된 좌표로 복귀할 수 있었다.
- 분할 드래그의 기존 React state 비사용 / requestAnimationFrame / 1px pointer fidelity / 결과 타이틀 측정 지연 최적화는 유지한다.
- 수정 파일: `src/App.tsx`, `src/components/studio/StudioSplitWorkspace.tsx`, `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 536차 — 생성바 펼침/접힘 시각 하단선 통일 + 공통 하향 조정
- 기준: 535차.
- 사용자 영상에서 펼친 생성바의 노란 실제 버튼 하단과 접힌 노란 edge tab 하단이 약 10px 어긋나는 것을 확인했다. 원인은 둘 다 같은 wrapper `bottom` 값을 쓰지만, 펼친 생성바는 row 내부에 PC 10px / mobile 8px의 하단 padding이 있고 접힌 tab은 padding 없이 박스 전체가 노란 표면이라 실제 보이는 하단선이 서로 달랐기 때문이다.
- Studio Black의 Y축 소유권 단일화는 그대로 유지하면서, 기준을 wrapper 하단이 아니라 **실제 보이는 컨트롤 하단선**으로 바꿨다. 공통 visible gap을 12px로 두고, 펼친 bar만 row padding만큼 wrapper bottom을 보정한다. 따라서 접기/펼치기 전후 노란 컨트롤의 하단선이 동일해진다.
- 535에서 PC에만 적용되던 `28px`, 기본 상태의 `20px` 하단 gap 차이를 제거했다. PC / Tablet / Builder-mobile 모두 동일한 12px visible baseline을 사용하므로 모드 전환 때 Y 위치가 다시 달라지지 않는다.
- 기존보다 생성바와 접힌 tab을 모두 더 아래로 내렸다. Footer가 실제로 올라오는 경우에는 기존 `--soridraw-studio-action-footer-offset`만 공통으로 더해져 두 상태가 함께 올라간다.
- 성능: JS 위치 계산, ResizeObserver, scroll/resize listener, React state를 추가하지 않았다. CSS 변수 계산만 바꿔 535의 rAF/단일 geometry 경로를 그대로 유지한다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 537차 — 접힌 생성바 상태의 Builder PC→Mobile 하단 기준 유지
- 기준: 536차.
- 요청 범위만 수정했다. 생성바 위치/크기, 카드 디자인, 반응형 구성, Firebase/저장 구조는 변경하지 않았다.
- 접힌 생성바 상태에서 분할바를 줄여 Builder가 `desktop -> mobile`로 바뀌는 순간, 기존에는 `scrollTop` 숫자만 그대로 남아 3열/2열 카드가 1열로 재배치되면서 화면에 훨씬 앞쪽 메뉴가 나타났다.
- 전환 직전 Builder 화면의 **하단에서 콘텐츠 끝까지 남은 거리**를 1회 저장하고, mobile 레이아웃 적용 후 같은 하단 거리가 유지되도록 Builder `scrollTop`을 1회 보정한다. 따라서 전체화면/PC에서 보이던 하단 정보 흐름을 기준으로 모바일 화면이 이어진다.
- 분할바를 계속 더 줄여도 드래그 매 프레임마다 scrollHeight를 측정하지 않는다. 모드 경계 진입 시 1회 + pointer-up 최종 폭에서 1회만 보정하여 버벅임 증가를 피한다.
- 생성바가 펼쳐진 상태, Builder가 이미 mobile인 상태, mobile->desktop 전환에는 이 보정을 적용하지 않는다.
- 수정 파일: `src/components/studio/StudioSplitWorkspace.tsx`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 538차 — 접힌 생성바 PC↔모바일 스크롤 기준 대칭화
- 기준: 537차. 다른 UI/생성바 위치/Firebase 구조는 변경하지 않음.
- 접힌 생성바 상태에서 분할바가 Builder의 desktop/mobile 경계를 실제로 넘을 때만 스크롤 기준을 1회 저장·복원한다.
- 최상단(2px 이내)은 전환 후에도 정확히 최상단, 최하단(2px 이내)은 정확히 최하단으로 고정한다.
- 중간 영역은 `scrollTop / maxScrollTop` 비율을 보존해 PC→모바일과 모바일→PC가 서로 대칭이 되도록 했다. 537차의 하단 간격(bottom gap) 보존을 제거해 반복 전환 시 아래로 누적 수렴하던 현상을 막는다.
- 복원은 모드가 바뀐 프레임과 분할바를 놓은 최종 프레임에만 requestAnimationFrame 1회씩 실행되며 일반 분할 드래그 프레임에는 추가 scroll 계산을 하지 않는다.



## 539차 — 펼친 생성바 하단 위치를 접힘 기준까지 하향
- 기준: 538차.
- 요청 범위만 수정했다. PC↔모바일 스크롤 대칭 전환, 분할바 동작, 생성바 크기/구성, 접힌 버튼 위치, Firebase/저장 구조는 변경하지 않았다.
- 펼친 생성바가 최하단에서 Footer 충돌 보정값 때문에 화면 아래쪽까지 내려오지 못하고 위에 멈추던 경로만 제거했다.
- 펼친 생성바는 536차의 실제 노란 컨트롤 하단선 보정(행 padding 보정)은 유지하면서, Footer offset에 의해 추가로 위로 밀리지 않도록 하단 기준을 고정했다.
- 따라서 PC / Tablet / Builder-mobile 모두 펼친 생성바가 접힌 상태에서 사용자가 확인한 낮은 하단 위치까지 내려오도록 맞춘다.
- 성능: JS/React state/ResizeObserver/scroll listener/DOM 측정을 추가하지 않았고 CSS 변수 계산 1곳만 변경했다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 540차 — 펼친/접힌 생성바 최하단 스크롤 범위 통일
- 기준: 539차.
- 최신 영상 재분석 결과, 문제는 생성바 자체의 fixed `bottom` 값이 아니라 **Builder의 최하단 스크롤 여유가 펼침/접힘 상태마다 달랐던 것**으로 확인했다.
- 300차 공통 규칙은 wide desktop Builder에 `padding-bottom: 56px`을 주고 있었지만, 오래된 328차 규칙이 `data-soridraw-action-owner=floating/inline`인 펼친 상태에서만 이를 다시 `0px`으로 덮어썼다. 그래서 접으면 56px 더 내려가고, 펼치면 그만큼 일찍 멈췄다.
- 535차 이후 Studio Black 생성바는 이미 항상 body fixed portal이고 in-flow expanded anchor는 `height: 0`이므로, 328차의 owner별 padding 분기는 더 이상 유효하지 않다. 해당 stale override를 제거했다.
- 결과적으로 펼침/접힘 모두 기존의 동일한 56px 하단 reserve를 사용한다. 생성바 위치/크기/PC↔Mobile 스크롤 대칭 규칙/분할바 geometry/Firebase 구조는 변경하지 않았다.
- 최적화: 새 JS, React state, ResizeObserver, scroll listener, DOM 측정을 추가하지 않았다. 오히려 상태별 CSS override 하나를 제거해 접기/펼치기 때 scrollHeight가 달라지는 레이아웃 변동을 줄였다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 541차 — 생성바 접기/펼치기 버튼 위 휠 스크롤 전달
- 기준: `SORIDRAW_540차_펼친접힌_최하단스크롤범위통일.zip`
- 수정 파일: `src/App.tsx`, `README.md`
- Studio Black의 생성바 `접기` 버튼과 접힌 상태의 `펼치기` 버튼은 body portal에 고정되어 있어, 마우스 포인터가 버튼 위에 있을 때 휠 이벤트가 Builder 내부 스크롤 pane으로 전달되지 않던 문제를 수정했다.
- 두 토글 위에서 발생한 세로 wheel 입력만 현재 Builder pane의 `scrollTop`으로 직접 전달한다.
- Builder pane이 실제로 내부 스크롤을 소유하는 경우에만 동작하며, 내부 스크롤이 없는 화면에서는 기존 브라우저 스크롤 동작을 그대로 둔다.
- `ctrl + wheel`은 브라우저 확대/축소를 막지 않도록 전달하지 않는다.
- 별도 `scroll`/`resize` listener, ResizeObserver, React state, rAF 루프를 추가하지 않았다. 토글 위에서 wheel이 발생할 때만 계산하므로 기존 분할바 성능 경로에는 영향이 없다.
- 생성바 위치/크기/접힘 애니메이션, 538차 PC↔모바일 스크롤 대칭 규칙, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.

## 542차 — 생성바 펼침/접힘 공통 PC↔모바일 스크롤 기준 적용
- 기준: `SORIDRAW_541차_생성바_접기펼치기_버튼위_휠스크롤복구.zip`
- 수정 파일: `src/components/studio/StudioSplitWorkspace.tsx`, `README.md`
- 538차의 PC↔Builder-mobile 전환 스크롤 보존 로직이 `collapsedActionButton` 존재 여부로 제한되어 있어, 생성바가 펼쳐진 상태에서는 같은 규칙이 적용되지 않던 조건을 제거했다.
- 이제 생성바가 펼쳐져 있든 접혀 있든 Builder가 desktop/mobile 경계를 실제로 넘는 순간 동일한 규칙을 사용한다: 최상단은 최상단, 최하단은 최하단, 중간은 전체 스크롤 가능 범위 대비 진행 비율을 유지한다.
- 생성바의 펼침/접힘 상태를 확인하기 위한 DOM 조건을 스크롤 보존 경로에서 제거해 상태 의존성을 없앴다. 새 observer/listener/state는 추가하지 않았고, 기존처럼 모드가 실제 변경될 때만 캡처/복원을 실행한다.
- 541차의 접기/펼치기 버튼 위 휠 스크롤 전달, 생성바 위치/크기, 분할바 geometry, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 543차 — 생성바 접기/펼치기 버튼 휠 스크롤 공통화 + 부드러운 전달
- 기준: 542차.
- 펼친 생성바의 접기 버튼은 draggable Motion 패널 내부, 접힌 펼치기 버튼은 body portal 단독 구조라 휠 이벤트 경로가 달랐던 부분을 `onWheelCapture`로 통일했다.
- 기존의 `scrollTop = current + deltaY` 즉시 점프 전달을 제거하고, 휠 입력을 목표 scrollTop에 누적한 뒤 단일 `requestAnimationFrame` 루프로 짧게 보간해 일반 스크롤처럼 부드럽게 이동한다.
- 확대/축소용 Ctrl+휠은 가로채지 않는다.
- 별도 상시 scroll/resize listener, ResizeObserver, React state는 추가하지 않았고 휠 입력이 들어오는 동안에만 rAF가 동작한다.
- 생성바 위치/크기, 542차 PC↔모바일 스크롤 위치 보존, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 영상 재확인 반영: 펼친 상태에서는 사용자가 작은 접기 화살표가 아니라 `생성하기` 버튼을 포함한 생성바 본체 위에서 휠을 사용하고 있었다. 따라서 펼친 생성바는 접기 버튼 1개가 아니라 action row 전체에서 휠을 받아 Builder로 전달하도록 범위를 수정했다. 접힌 상태는 기존 왼쪽 펼치기 탭에서 동일하게 동작한다.

## 544차 — 생성바 위 휠 스크롤 관성 개선 + 최하단 역방향 첫 입력 복구
- 기준: 543차.
- 최신 영상에서 펼친 생성바 위 휠이 여전히 계단식으로 느껴지고, 최하단에서 아래쪽 휠을 한 번 더 준 뒤 위쪽으로 방향을 바꾸면 첫 역방향 입력이 먹지 않는 현상을 확인했다.
- 원인은 543차가 휠 입력을 `목표 scrollTop`에 누적해 보간하는 방식이어서, 최하단에서 아래 방향 입력이 들어오면 목표값이 `maxScrollTop`에 붙은 상태가 남고 역방향 첫 입력이 그 오래된 목표를 상쇄하는 데 사용될 수 있었던 것이다.
- 목표 위치 누적 방식을 제거하고 `현재 scrollTop + 속도(velocity)` 기반의 단일 requestAnimationFrame 관성 스크롤로 변경했다. 실제 화면 위치를 매 프레임 기준으로 사용하므로 오래된 target 좌표가 남지 않는다.
- 휠 방향이 반대로 바뀌면 기존 관성을 즉시 버리고 새 방향 속도로 시작한다. 최상단에서 위쪽, 최하단에서 아래쪽처럼 바깥 방향 휠이 들어오면 관성과 rAF를 즉시 종료하므로 다음 반대 방향 휠이 첫 입력부터 바로 작동한다.
- 한 번의 일반 wheel delta가 여러 프레임에 나뉘어 감쇠되도록 해 543차의 큰 목표점 보간보다 연속적인 이동감을 우선했다. 연속 휠은 하나의 velocity에만 합쳐지며 최대 속도를 제한해 과도한 가속을 막는다.
- 펼친 생성바 action row 전체와 접힌 펼치기 탭의 기존 `onWheelCapture` 범위는 그대로 유지한다. Ctrl+휠 확대/축소도 그대로 통과한다.
- 상시 scroll/resize listener, ResizeObserver, React state는 추가하지 않았다. 휠 사용 중에만 rAF 1개가 동작한다.
- 생성바 위치/크기, 542차 PC↔모바일 스크롤 위치 보존, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/App.tsx`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 545차 — PC↔모바일 중간 영역 콘텐츠 앵커 보존
- 기준: `SORIDRAW_544차_생성바_휠스크롤_관성부드러움_역방향잠김복구.zip`
- 최신 영상에서 분할바가 Builder의 desktop/mobile 경계를 넘을 때 `보컬 큐 / 악기 큐`가 사라졌다 다시 나타나는 것처럼 보이던 현상을 재분석했다. 큐 자체의 조건부 렌더링 문제가 아니라, 538~542차의 **전체 scrollTop 비율 보존**이 PC 다열 ↔ Mobile 1열 재배치에서 같은 내용을 유지하지 못해 화면 위치가 튀는 문제였다.
- 최상단/최하단 규칙은 그대로 유지한다: 전환 직전 최상단이면 전환 후도 최상단, 최하단이면 전환 후도 최하단이다.
- 중간 영역은 더 이상 `scrollTop / maxScrollTop`만 복원하지 않는다. 전환 직전 Builder 화면 중앙에 실제로 걸쳐 있는 메뉴/세부 블록을 **콘텐츠 앵커**로 잡고, 그 앵커 내부에서 사용자가 보고 있던 상대 지점을 전환 후에도 같은 화면 높이에 맞춘다.
- 일반 메뉴 카드 전체를 자동 후보로 사용하고, 가사 카드의 `섹션 구조`와 `보컬 큐/악기 큐` 행에는 더 세밀한 앵커를 추가했다. 따라서 영상처럼 큐 행 근처에서 PC↔Mobile을 반복해도 큐가 화면 밖으로 튀었다 돌아오는 현상을 줄인다.
- 모드 전환 직후 같은 프레임에서 1회 즉시 보정하고, CSS 재배치가 끝나는 다음 requestAnimationFrame에서 1회만 검증 보정한다. 일반 분할 드래그 프레임에는 추가 DOM 탐색/측정이 없으므로 드래그 성능 경로는 유지한다.
- 동일 콘텐츠 앵커를 찾지 못하는 예외 상황에서만 기존 normalized progress를 fallback으로 사용한다.
- 생성바 위치/크기, 544차 휠 관성 스크롤, 카드 디자인/표시 조건, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/components/studio/StudioSplitWorkspace.tsx`, `src/App.tsx`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 546차 — 보컬 큐/악기 큐 PC·모바일 상시 유지
- 기준: 545차.
- 증상: 분할바로 Builder가 PC↔Mobile 경계를 넘을 때 가사 카드 하단의 `보컬 큐 / 악기 큐` 행이 모바일 쪽에서 잘렸다가 PC에서 다시 나타나면서 가사 카드 높이와 전체 스크롤 높이가 함께 흔들리는 현상.
- 원인: PC의 보컬/가사 2열을 같은 높이로 맞추기 위한 `height:100%` 규칙과 `useStableContentHeight` 기반 고정 높이 애니메이션이 모바일 1열 전환에도 남아 있었고, 모바일 카드의 `overflow:hidden`까지 겹쳐 분할 드래그 중 재측정이 끝나기 전 가사 카드 하단을 클리핑할 수 있었음.
- 수정: Studio Black 가사 콘텐츠는 intrinsic(auto) 높이를 사용하고, Builder Mobile에서는 보컬/가사 슬롯의 데스크톱용 동일 높이 강제를 해제. 가사 카드 하단 overflow 클리핑도 해제하여 큐 행을 PC/모바일 모두 항상 레이아웃에 유지.
- 범위: 가사 카드 높이/클리핑만 수정. 큐 기능값, 생성 로직, 분할바 스크롤 기준, 생성바, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않음.

## 547차 — 분할 리사이즈 카드 높이 안정화
- 기준: 546차.
- Studio Black 데스크톱에서 546차의 `lyrics-content-shell { height:auto }`가 `useStableContentHeight()`를 덮어쓰던 범위를 제거했다.
- 분할바 드래그 중에는 기존 안정 높이를 유지하고, 드래그 종료 후에만 실제 콘텐츠 높이를 다시 측정한다. 화면 폭에 따른 글자 크기 변화가 보컬/가사 카드와 아래 템포 영역을 연속으로 밀어내지 않도록 복구했다.
- Builder Mobile은 자연 높이를 그대로 유지해 보컬 큐/악기 큐가 잘리지 않는 546차 동작을 보존한다.
- 새 observer/listener/state 없음. Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 548차 — 보컬/가사 반응형 높이 자연화 · 리사이즈 후 빈공간 제거
- 기준: `SORIDRAW_547차_분할리사이즈_카드높이안정화.zip`.
- 최신 영상 재분석 결과, 분할바 이동 중 `명령창` 위 간격이 순간적으로 달라졌다가 복귀하고, 다시 폭을 넓힐 때 보컬/가사 카드 내부에 빈 영역이 남는 직접 원인은 **반응형 텍스트/줄바꿈은 즉시 바뀌는데 내부 콘텐츠 높이는 `useStableContentHeight()`로 이전 값을 유지한 뒤 드래그 종료 후 다시 측정하고 0.25초 동안 애니메이션하던 구조**였다.
- Studio Black의 `VocalControl`과 `SongStructureIntegratedControl`만 `naturalResponsiveHeight` 경로를 사용하도록 분리했다. 이 경로에서는 높이 측정용 `ResizeObserver`/settle timer를 만들지 않고, 내부 콘텐츠 shell을 항상 intrinsic `height:auto`로 유지한다.
- 결과적으로 분할바를 줄이거나 키울 때 폰트 크기/줄바꿈 변화와 카드 실제 높이가 같은 레이아웃 패스에서 즉시 반영된다. 드래그 종료 후 뒤늦게 카드가 늘거나 줄어드는 0.25초 높이 애니메이션이 없어져 고정 section gap이 잠깐 눌렸다 복구되는 현상과 stale height 빈공간을 제거한다.
- Classic 및 다른 테마는 기존 measured-height 동작을 유지한다. Studio Black Mobile의 보컬 큐/악기 큐 intrinsic height 및 overflow-visible 보정도 유지한다.
- 성능: Studio Black 보컬/가사에서 불필요했던 높이 측정 `ResizeObserver`, drag-end/window-resize-end 재측정 timer, scrollHeight read 경로를 비활성화했다. 새 observer/listener/state는 추가하지 않았다.
- 수정 파일: `src/App.tsx`, `src/components/studio/studioLayout.css`, `README.md`.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 550차 — 모바일 분할 해제 점프 제거 / 명령창-생성바 간격 정리
- 기준: 549차
- 분할바 드래그 중 PC→모바일 경계를 넘을 때 `builderModeScrollAnchor`와 `builderDragScrollAnchor`가 동시에 소유하던 스크롤 보정을 단일화했다. 드래그 중에는 시작 시점 콘텐츠 앵커만 사용하고, 마우스를 놓은 뒤 오래된 모드 전환 앵커가 재적용되어 화면이 위로 튀는 경로를 제거했다.
- 드래그가 아닌 일반 반응형 전환에서는 기존의 최상단→최상단 / 최하단→최하단 / 중간 콘텐츠 앵커 규칙을 그대로 유지한다.
- Builder가 모바일 모드일 때만 하단 스크롤 여유를 112px→100px로 조정해 명령창과 고정 생성바 사이의 시각 간격을 약 11px 수준으로 정리했다. PC/Tablet pane 간격과 생성바 Y 위치는 변경하지 않았다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 551차 — 모바일 명령창·생성바 간격 미세 축소
- 기준: `SORIDRAW_550차_모바일전환_마우스해제점프제거_명령창생성바간격정리.zip`
- Builder가 `data-pane-mode="mobile"`인 경우에만 하단 reserve를 `100px → 92px`로 8px 줄여 명령창과 고정 생성바 사이 간격을 조금 더 좁혔다.
- PC/Tablet 간격, 생성바 Y 위치/크기, 분할바/스크롤 앵커 로직, 보컬/가사 반응형 높이, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 552차 — 비모바일 명령창·생성바 간격 미세 확대
- 기준: `SORIDRAW_551차_모바일_명령창생성바_간격미세축소.zip`
- Builder Mobile의 현재 하단 reserve `92px`은 그대로 유지했다.
- PC/Tablet 등 `data-pane-mode="mobile"`이 아닌 Studio Black Builder에서만 하단 reserve를 `112px → 120px`로 8px 늘려 명령창과 고정 생성바 사이 여백을 조금 더 확보했다.
- 생성바 Y 위치/크기, 모바일 간격, 분할바/스크롤 로직, 보컬/가사 레이아웃, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 553차 — 비모바일 명령창·생성바 간격 118px 미세조정
- 기준: `SORIDRAW_552차_비모바일_명령창생성바_간격미세확대.zip`
- Builder Mobile의 하단 reserve `92px`은 그대로 유지했다.
- PC/Tablet 등 비모바일 Studio Black Builder의 하단 reserve만 `120px → 118px`로 2px 줄였다.
- 생성바 위치/크기, 모바일 간격, 분할바/스크롤 로직, 보컬/가사 레이아웃, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.


## 554차 — 모바일 명령창·생성바 간격 93px 미세조정
- 기준: `SORIDRAW_553차_비모바일_명령창생성바_간격118px.zip`
- Builder Mobile의 하단 reserve만 `92px → 93px`로 1px 늘렸다.
- PC/Tablet 등 비모바일 reserve `118px`은 그대로 유지했다.
- 생성바 위치/크기, 분할바/스크롤 로직, 보컬/가사 레이아웃, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 559차 — 554 기준 · 생성바 하단 30px · 상단 간격 동시고정
- 기준: `SORIDRAW_554차_모바일_명령창생성바_간격93px.zip`.
- 555~558에서 혼동했던 `생성바 자체 bottom`과 `Builder 하단 reserve`를 하나의 짝으로 정리했다.
- 생성바의 보이는 하단 여백을 554의 12px에서 30px로 +18px 늘리되, 같은 +18px만큼 Builder 하단 reserve도 함께 늘려 최하단에서 `명령창 ↔ 생성바` 간격과 그 위의 모든 메뉴 간격이 554와 동일하게 유지되도록 했다.
- Builder Mobile reserve: 93px → 111px. 비모바일 reserve: 118px → 136px. 두 값은 생성바가 위로 이동하는 +18px을 정확히 상쇄하기 위한 동기 보정이다.
- 별도 page-end spacer, pseudo-element, 추가 scroll 보정은 사용하지 않는다.
- 생성바 크기/버튼 구성/분할바/PC↔Mobile 스크롤 앵커/Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.


## 560차 — 컴팩트 전환 1074px 단일 단계 · 분할 리사이즈 경량화
- 기준: `SORIDRAW_559차_554기준_생성바하단30px_상단간격동기고정.zip`.
- 분할바로 Builder 폭을 줄일 때 서로 다른 임계값에서 순차적으로 변하던 UI를 하나로 통합했다. 기존에는 헤더 잠금/랜덤/리셋 아이콘이 1120px, 보컬 멤버 그리드가 1100px, `(n/n)` 카운터 숨김과 분위기/주제 5열 키워드가 1074px에서 각각 바뀌어 3단계처럼 보였다.
- Studio Black Builder desktop의 위 항목을 모두 **1074px 한 임계값**에서 동시에 전환하도록 통합했다. 따라서 분위기/주제가 5개 키워드 열로 바뀌는 순간 잠금/랜덤/리셋 크기, 메뉴 타이틀 compact 상태, `(n/n)` 숨김, 보컬 멤버 compact 배치도 함께 바뀐다.
- 성능: 1120/1100의 별도 container-query 단계 2개를 제거하고 1074px 블록 하나로 합쳤다. 또한 카드 헤더 액션과 키워드 버튼의 Tailwind `transition-all`이 폭/높이 geometry까지 보간하지 않도록 paint/클릭 피드백(background/color/opacity/transform)만 transition 대상으로 제한했다. 새 React state, ResizeObserver, scroll/resize listener, DOM 측정은 추가하지 않았다.
- 559차 생성바 위치/하단 간격, 스크롤 앵커, PC↔Mobile 모드 기준, 카드 기능값, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않았다.
- 수정 파일: `src/components/studio/studioLayout.css`, `README.md`.
- 상태: 코드 반영 완료 · 실사용 검증 전.

## 562차 - 뮤직노트 양쪽 레일 성능 비교 테스트
- 기준: 560차 (`SORIDRAW_560차_컴팩트전환_1074px단일화_분할최적화.zip`). 561차 최적화 실험은 폐기하고 사용하지 않음.
- `/history` 뮤직노트 페이지에 Studio Black의 좌측 메뉴 레일과 우측 대시보드 레일을 동일하게 장착.
- 이번 차수에서는 뮤직노트/라이브러리 1:1 분할은 아직 적용하지 않음. 목적은 동일한 양쪽 레일을 가진 상태에서 뮤직노트 단일 페이지의 프레임/체감 성능을 Studio와 비교하는 것.
- `StudioPageFrame`에 `lockViewport` 옵션을 추가. Studio는 기존 기본값(`true`)을 유지하고, 뮤직노트 테스트 셸은 `false`로 사용하여 기존 뮤직노트 문서 스크롤/레이아웃을 보존함.
- 뮤직노트 본문 디자인/검색/필터/곡 카드/모달/데이터 로직은 변경하지 않음.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 563차 메모
- /history 로그인 화면을 뮤직노트(좌) + 라이브러리(우) 1:1 분할 테스트 레이아웃으로 전환했다.
- Studio 좌/우 레일은 유지하고 중앙만 StudioSplitWorkspace로 감쌌다.
- 비로그인 note 공유 라우트와 /suno-library 단독 페이지는 그대로 유지했다.


## 564차 메모
- 뮤직노트+라이브러리 성능 테스트에 독립 Lite Split V2 엔진을 추가했다.
- 기본은 Lite V2이며 우측 상단 테스트 스위치에서 기존 StudioSplitWorkspace와 즉시 비교할 수 있다.
- Lite V2 드래그 hot path는 pointerdown 1회 측정 + rAF 1회 CSS 변수 write만 사용한다.
- Lite pane 안의 뮤직노트/라이브러리는 각자 ResizeObserver를 만들지 않고 splitter가 계산한 pane width 이벤트를 직접 받아 PC/tablet/mobile 모드만 임계점에서 변경한다.
- 기존 엔진 코드는 삭제/수정하지 않고 비교용으로 그대로 보존했다.

## 565차 — Lite Split V2 Studio 실제 적용 + 기존 방식 즉시 비교

- 564차에서 성능이 확인된 Lite Split V2를 `/studio`의 기본 분할 엔진으로 적용했다.
- 기존 `StudioSplitWorkspace`는 삭제/수정하지 않고 `?splitEngine=legacy` 비교 모드로 그대로 보존했다.
- Studio 우측 상단의 `Lite V2 / 기존 방식` 버튼으로 같은 디자인/콘텐츠에서 두 엔진을 즉시 비교할 수 있다.
- Lite Studio 엔진은 기존 Studio의 승인된 pane 클래스/ID, 내부 독립 스크롤, 얇은 스크롤바, PC/Tablet/Mobile pane-mode, 좌/우 접기 버튼, 공통 중앙 모달 host, 상단 masthead host를 그대로 사용한다.
- 드래그 hot path는 React state를 갱신하지 않는다. 기본적으로 로컬 workspace의 `--soridraw-studio-builder-width`만 변경하고, body portal인 분할선/검색/생성바/상단 헤더처럼 로컬 변수를 상속할 수 없는 최소 요소만 직접 동기화한다.
- 기존 엔진의 전역 root split 변수 갱신은 드래그 중 하지 않고 시작/종료·외부 레이아웃 변경 시에만 커밋한다.
- Builder/Result의 `data-pane-mode`와 root pane mode도 실제 breakpoint를 넘을 때만 변경한다.
- Genre ↔ Result 첫 카드 높이 동기화용 ResizeObserver는 평상시에만 연결하고 분할 드래그 시작 즉시 disconnect, 종료 후 재연결한다.
- 564 Lite 테스트의 뮤직노트/라이브러리 pane-width 이벤트도 매 프레임 발송하지 않고 PC/Tablet/Mobile 모드가 실제로 바뀔 때만 보낸다.
- 564에서 보이지 않던 중앙 pane 스크롤바를 Lite V2에도 복구했다.
- Lite 분할선은 active/focus 상태에서도 높이 100%, transform/scale 없음으로 고정해 클릭 시 선 길이가 줄어들지 않는다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 566차 메모
- Lite V2 성능 테스트의 중심을 뮤직노트/라이브러리 테스트 화면에서 실제 Sori Studio로 이동했다.
- /history는 562차처럼 정상 뮤직노트 단독 화면 + 좌우 레일 구조로 복구했다.
- /studio는 Lite Studio 분할 엔진 V2가 기본이며, 기존 StudioSplitWorkspace는 비교용 `기존 방식` 전환으로 유지한다.
- 뮤직노트 테스트용 LiteSplitWorkspace 런타임 import/helper를 App.tsx에서 제거해 일반 뮤직노트 화면에 분할 엔진이 개입하지 않도록 했다.


## 567차 메모
- Lite V2 엔진은 566차에도 적용되어 있었지만 Studio용 splitter가 legacy `.soridraw-studio-splitter` 클래스를 함께 사용해 누적된 기존 CSS 디자인을 다시 상속하던 문제를 수정했다.
- Studio Lite V2 splitter에서 legacy splitter 클래스를 제거하고, 564차 Music Note/Library 테스트에서 검증한 `.soridraw-lite-splitter` 디자인을 그대로 사용한다.
- Studio에서 필요한 viewport fixed 위치만 별도 override하며, normal/hover/active/focus 모두 1px 전체 높이를 고정해 클릭 시 선 길이가 변하지 않는다.
- 분할 엔진 동작/비율/반응형/데이터/Firebase 구조는 변경하지 않았다.


## 568차 메모
- 567에서 클래스만 Lite V2로 바꿨지만 Studio용 splitter를 body portal/fixed 좌표로 계속 렌더링해 564 테스트와 실제 선의 구조/길이가 달랐던 문제를 수정했다.
- Lite V2 splitter를 Studio workspace 내부 absolute divider로 되돌려 564 뮤직노트/라이브러리 테스트와 동일한 렌더링 방식으로 통일했다.
- splitter 위치는 workspace의 단일 `--soridraw-lite-split-percent` write가 소유하며, 클릭/드래그 상태에서도 base Lite V2 선 길이/두께가 유지된다.


## 569차 메모
- Lite Studio V2의 builder/result pane에 `data-soridraw-lite-pane` 신호를 복구했다.
- Music Note/Library는 분할 중 자체 ResizeObserver + getBoundingClientRect 경로를 만들지 않고 Lite V2가 이미 계산한 pane width를 직접 받는다.
- `soridraw-lite-pane-width`는 PC/tablet/mobile responsive 경계를 실제로 넘을 때만 전달한다. 안정된 초기/리사이즈 커밋에서는 1회 강제 동기화한다.
- 디자인/CSS/분할선/스크롤/저장 구조는 변경하지 않았다.

## 571차 — 분할 성능 진단 빌드
- Lite V2 분할 동작 자체는 570차와 동일하게 유지하고, 성능 측정 코드만 추가했다.
- 분할 드래그 중 별도 React 렌더는 하지 않는다. rAF 타임스탬프와 Long Task, JS hot-path 시간만 ref/메모리에 수집하고 pointer-up 뒤 패널을 갱신한다.
- 진단 패널 표시: 추정 FPS, 평균/P95/최악 frame gap, 20/34/50ms 초과 프레임, Long Task, split flush/apply 시간, 콘텐츠 실제 폭 반영 횟수, DOM node 수, JS heap.
- AI Studio 프리뷰와 Vercel 테스트앱에서 같은 창 크기·같은 페이지·같은 3~5초 왕복 드래그 후 패널을 캡처해 비교한다.
- 임시 진단 UI이며 Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않는다.

## 572차 — 분할 병목 귀속 진단 강화
- 571의 FPS/Long Task 계측은 유지한다.
- Chrome Long Animation Frames(LoAF) 정보를 추가 수집해 긴 프레임 안에서 실제 시간을 사용한 스크립트/콜백을 TOP 순위로 표시한다.
- LoAF가 제공하는 forcedStyleAndLayoutDuration을 합산해 강제 Style/Layout 비용을 별도로 표시한다.
- Event Timing이 지원되면 느린 입력 이벤트와 input delay도 함께 표시한다.
- JS로 귀속되지 않은 LoAF 시간은 `브라우저 렌더/레이아웃/페인트(비JS)`로 따로 집계해, 엔진 JS와 브라우저 리플로우 비용을 구분한다.
- 이번 차수는 진단 정확도를 위한 버전이라 570/571의 분할 동작, 30fps 콘텐츠 커밋, 디자인에는 손대지 않았다. 성능 원인이 확인된 뒤 실제 최적화를 적용한다.


## 573차 메모 — 단일 60fps 경계 + 오프스크린 렌더 예산
- 570차의 `60fps 분할선 + 약 30fps 콘텐츠` 이중 이동을 제거했다. Lite V2 분할선과 실제 좌/우 pane 폭은 다시 하나의 로컬 `--soridraw-studio-builder-width` 값으로 같은 rAF 프레임에서 움직인다.
- 분할 드래그 시작 시 각 pane의 현재 스크롤 viewport를 한 번만 측정하고, 260px overscan 밖의 Music Note 곡 카드 / Library playlist row / Library workspace group·track / Studio menu·result 블록을 현재 높이 그대로 `content-visibility:hidden + contain:strict` shell로 임시 고정한다. 화면에 보이는 요소는 건드리지 않는다.
- 드래그 종료 시 shell을 모두 해제하고 첫 visible row의 viewport offset을 1회 복원하여 off-screen 자연 높이 재계산 때문에 세로 위치가 튀지 않게 했다.
- Library workspace group이 화면에 걸쳐 있을 때도 먼 track row가 매 폭 변경마다 재배치되지 않도록 track row 단위 `content-visibility:auto` containment를 추가했다.
- 분할 중 React state 갱신, 반복 DOM 측정, 별도 compositor divider는 추가하지 않았다. 진단 패널은 유지한다.
- 목적은 디자인을 바꾸는 것이 아니라 실제 분할 때 브라우저가 다시 계산/페인트해야 하는 off-screen DOM 양을 줄이는 것이다.


## 576차 메모 — 573 기준 leaf-card native isolation
- 574/575 실험은 기준에서 제외하고 573의 단일 실경계 rAF 구조로 복귀.
- 드래그 시작 시 모든 카드의 getBoundingClientRect를 훑어 exact-height shell로 바꾸던 JS render-budget을 제거.
- Music Note 곡 카드, Library playlist row, Library workspace track row만 드래그 중 content-visibility:auto + cached intrinsic size로 브라우저가 off-screen work를 직접 생략.
- visible leaf card는 기존 디자인/실시간 반응형 높이를 유지하면서 layout/style/paint containment로 카드 단위 재계산 범위를 제한.
- active menu row는 containment에서 제외해 popover/overflow 디자인을 보호.
- 스크롤 안정화는 pane당 visible anchor 1개만 elementFromPoint로 캡처해 pointer-up 후 1회 보정.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 577차 — Lite V2 드래그 상태 전역 CSS 분리
- 기준: 576차. 디자인/분할 비율/실시간 리플로우/leaf-card isolation은 그대로 유지한다.
- Lite V2가 더 이상 레거시 `html.soridraw-split-dragging` 클래스를 사용하지 않도록 분리했다.
- 레거시 `body *`, Music Note/Library 전체 descendant, pane 전체 `* / *::before / *::after` 드래그 선택자가 Lite V2에서 발동하지 않는다.
- Lite V2는 `html.soridraw-lite-split-dragging` + workspace `.is-dragging`만 사용하고, 생성바/검색버튼/heartbeat/실제 leaf 카드처럼 필요한 대상만 정확히 지정한다.
- `useStableContentHeight`는 새 Lite drag marker도 continuous resize로 인식해 드래그 중 높이 재측정이 다시 살아나지 않도록 유지했다.
- 목표: pointer-down 시 전역 style matching 비용과 배포 환경의 큰 MessagePort/forced-layout spike를 줄이는 1단계 실험.

## 579차 메모
- 분할 성능 검증을 사람 손 드래그가 아닌 반복 가능한 자동 벤치마크로 표준화했다.
- PERF 패널의 `자동 테스트`는 기본 32%↔68% 범위를 사용하고, 현재 화면의 안전 범위에 맞춰 자동 보정한다.
- 워밍업 1왕복(측정 제외) 후 1초/leg 고정 속도로 2왕복을 측정한다. 테스트 후 기존 분할 비율로 복구한다.
- 측정 결과에 측정 시간, 50ms 초과 비율, Long Task ms/s, 브라우저 비JS 렌더 ms/s를 추가했다.
- 관리자 > 앱 설정에 `분할 성능 진단 도구` 표시/숨김 토글을 추가했다. 로컬 브라우저 설정으로 저장하며 일반 사용자에게 PERF 패널은 표시하지 않는다.
- Firebase/Auth/Firestore/Functions 저장 구조는 변경하지 않았다.


## 580차 메모
- 579 자동 벤치마크에서 4초 측정 구간과 겹치던 App 최상위 3.6초 명령창 placeholder 갱신을 성능 병목 후보로 분리했다.
- placeholder 순환 타이머는 이제 `/studio`의 `create` 화면에서만 존재하며, Music Note/Library/Recent에서는 타이머 자체를 만들지 않는다.
- Lite V2 분할 드래그 중에는 create 화면에서도 placeholder 상태 갱신을 건너뛰어 분할 hot path에 상위 React commit이 끼어들지 않게 했다.
- 관리자 PERF 토글/자동 벤치마크는 유지한다. UI 디자인/Firebase 저장 구조는 변경하지 않았다.

## 581차 — 3세트 중앙값 자동 벤치마크 + 상위 ResizeObserver/모달 폴링 드래그 차단
- PERF 자동 테스트를 워밍업 1회 후 동일 2왕복 측정 3세트로 변경하고, 최종 판정은 3세트 중앙값으로 표시한다.
- 각 세트 FPS/P95를 함께 표시해 우연한 GC/이미지/백그라운드 작업에 의한 1회성 튐을 구분한다.
- Music Note/Library 상단·리스트, Studio 외부 UI의 DOM 규모를 진단 패널에 분리 표시한다.
- App 최상위 SecondaryScrollControl의 documentElement ResizeObserver와 500ms 모달 폴링을 Lite V2 분할 드래그 중 일시 중지하고 드래그 종료 후 1회 동기화한다.
- 디자인, 분할 실시간 리플로우, Firebase/Auth/Firestore/Functions 저장 구조는 변경하지 않는다.

## 582차 — 자동 벤치마크 조건 검증 + PERF 가로형 압축 UI
- 581의 3세트 중앙값 자동 테스트를 유지하면서, Music Note/Library 테스트는 동일 화면·동일 리스트 DOM 조건의 유효 세트만 채택하도록 보강했다.
- 뮤직노트/라이브러리 리스트 DOM이 0이거나, 세트 사이 대상 DOM/viewport가 크게 달라지면 해당 세트는 자동 폐기하고 재측정한다.
- 최대 7회 시도 안에 유효 3세트를 확보하지 못하면 결과를 억지로 정상 판정하지 않고 오류 상태로 종료한다.
- PERF 패널은 세로 누적 대신 좌우 2열 배치로 변경해 한 번의 스크린샷에 핵심 수치·영역 DOM·병목 TOP·Lite V2 내부 단계를 함께 담기 쉽게 했다.
- 일반 앱 디자인/분할 동작/Firebase 저장 구조는 변경하지 않았다.


## 584차 메모
- 관리자 PERF에 `영역 스캔`을 추가했다. 기준 → 현재 리스트 전체 OFF → 왼쪽 pane 전체 OFF → 오른쪽 pane 전체 OFF → 좌우 콘텐츠 전체 OFF를 동일 자동 벤치마크 조건으로 측정한다.
- 영역 스캔은 진단 중에만 `content-visibility`/`contain`으로 대상 렌더를 임시 제외하고 끝나면 즉시 원래 디자인으로 복구한다. 실제 앱 디자인/레이아웃 코드는 변경하지 않았다.
- 관리자 `품질·성능 진단 도구`에 자동 벤치마크 / 렌더 A/B / 영역 이진 스캔 항목을 보이게 정리했다. 향후 품질 테스트 도구도 같은 관리자 영역에 누적한다.


## 585차 — Music Note / Library 페이지 영역 단위 렌더 격리
- 기준: 584차 영역 이진 스캔 결과.
- Music Note와 Library의 상단 컨트롤, 리스트 루트, 라이브러리 그룹을 Lite V2 드래그 동안만 독립 layout/style boundary로 분리했다.
- 카드/행 leaf는 기존 576 격리를 공통 marker로 정리했다.
- size containment나 상시 layout freeze는 사용하지 않아 승인된 디자인, 줄바꿈, 카드 높이, PC/Tablet/Mobile 실시간 반응을 유지한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 586차 — DEV/PROD 실행 환경 종합 진단
- 585차 페이지 영역 렌더 격리는 유지했다.
- 관리자 PERF 패널에 `환경 진단`을 추가했다.
- 환경 진단은 Vite DEV/PROD, production asset bundle 여부, idle rAF 추정 Hz, Service Worker controller/registration, CacheStorage 수, 로컬 JS/CSS 자원 규모, CSS rule 수, CPU thread/device memory, viewport/DPR, network 정보를 한 번에 수집한다.
- `진단서 복사`로 같은 정보를 텍스트로 복사할 수 있다.
- 이 기능은 관리자 `품질·성능 진단 도구`에 영구 보관하며 일반 사용자에게는 노출하지 않는다.
- 앱 디자인/분할 동작/Firebase 데이터 구조는 변경하지 않았다.


## 587차 — PROD CSS minify OFF A/B 진단
- 586차를 기준으로 production 전용 CSS 축소를 `build.cssMinify: false`로 잠시 비활성화했다.
- 목적은 AI Studio DEV와 Vercel PROD가 idle Hz는 동일한데 분할 Layout/Paint에서 큰 차이가 나는 원인이 production CSS 축소 출력인지 단일 변수로 검증하는 것이다.
- JS minification, Lite V2 분할 엔진, Music Note/Library 디자인과 585 렌더 격리는 그대로 유지한다.
- 환경 진단에 `587 · PROD CSS minify A/B`와 실제 적용 상태를 표시한다. DEV에서는 비적용, PROD에서만 OFF(진단)로 표시된다.
- 테스트는 Music Note 동일 화면에서 자동 테스트 3세트 중앙값을 실행하고, 586/585의 PROD 기준과 FPS/P95/렌더 비JS·초를 비교한다.
- 결과가 없거나 악화되면 이 build 옵션은 다음 차수에서 즉시 원복하고 JS minify/번들 경로를 다음 후보로 검증한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 588차 메모
- 587차의 PROD CSS minify OFF 실험은 원복하고 production CSS 축소를 정상 상태로 되돌렸다.
- 다음 단일 변수 A/B로 production JS minify만 OFF했다. production bundle/청크 구조는 유지해서 JS 축소 출력 자체가 분할 렌더 병목에 관여하는지 비교한다.
- PERF 환경 진단에 JS minify / CSS minify 상태를 각각 표시한다.
- `종합 진단서 복사`를 추가해 최신 환경 정보, 자동 테스트 3세트 중앙값, DOM/병목 TOP/Lite V2 내부 단계와 저장된 렌더·영역 A/B 결과를 텍스트 한 번으로 복사할 수 있게 했다.
- 기존 관리자 품질·성능 진단 도구는 유지하며 일반 사용자에게는 노출하지 않는다.

## 589차 — DEV/PROD computed style · CSS cascade 진단
- 587/588에서 CSS minify 및 JS minify 단일 변수 A/B가 PROD 분할 병목의 주원인이 아님을 확인해 production minify 설정을 정상값으로 모두 복구했다.
- 관리자 PERF `환경 진단`과 `종합 진단서`가 Lite V2 workspace 내부 실제 computed style을 DEV/PROD에서 동일하게 집계한다.
- 집계 항목: contain/layout/paint containment, content-visibility, container-type, transform/filter/backdrop-filter/box-shadow, transition, will-change, fixed/sticky, overflow 관련 요소 수.
- 핵심 target(workspace, 좌/우 pane, Music Note page/top/list/card, Library page/top/list/row)의 실제 적용된 크기/overflow/contain/container/transform/filter/shadow/transition/will-change 값을 진단서에 기록한다.
- document.styleSheets의 적용 순서, local 여부, 읽을 수 있는 rule 수, source를 진단서에 기록해 DEV dev-module CSS와 PROD bundle CSS의 cascade 차이를 비교할 수 있게 했다.
- 환경 패널은 캡처 높이가 과도하게 늘지 않도록 computed-style 요약을 3열로 표시한다.
- 실제 Studio/Music Note/Library 디자인 및 분할 동작은 변경하지 않았다.
- Firebase/Auth/Firestore/Functions/사용자 저장 구조 변경 없음.


## 590차 — 고정 벤치마크 표면 + 좌표 A/B
- 자동 분할 벤치마크가 사용자의 브라우저 창 크기와 무관하게 내부 workspace를 1400×900으로 고정한 뒤 측정한다.
- 좌/우 pane 스크롤은 테스트 시작 시 0으로 맞추고 테스트 종료 후 원래 스크롤, workspace 크기, 분할 비율을 복구한다.
- 측정 결과에 `Benchmark Surface 1400×900 PASS/FAIL`을 기록하고, 표면 고정 실패 세트는 무효 처리한다.
- 관리자 PERF에 `좌표 A/B`를 추가했다. 동일한 1400×900/3세트 조건에서 기존 부모 CSS custom property 방식과 builder/result/divider 직접 좌표 적용 방식을 비교한다.
- 직접 좌표 방식은 진단 중에만 활성화되며 일반 Studio 동작과 디자인은 기존 CSS 변수 방식을 유지한다.
- 관리자 품질·성능 진단 도구 설명에도 고정 표면과 좌표 A/B를 정리했다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.


## 606 · split-drag App rerender suppression

- Basis: 605. Runtime geometry remains the 602 screen-separated setup: Music Note uses direct pane geometry; Library/Recent/Create keep the 590 CSS-variable path.
- 605 real-hand diagnostics showed the split engine writes themselves were tiny and input-to-commit latency was sub-millisecond, while the root builder responsive mode still crossed repeatedly during hand drags.
- `App.tsx` previously mirrored every `data-soridraw-builder-mode` crossing through a root `MutationObserver` into `isSplitBuilderActionMobile` React state. That can rerender the large App tree during the divider hot path even though CSS already switches the floating Generate bar from the same root attribute.
- During an active Lite V2 split drag, 606 now keeps the visual CSS responsive switch live but defers only that React gesture-state mirror. One synchronized React update runs on `soridraw-split-drag-end`. Outside dragging, theme/resize responsive changes still synchronize immediately.
- No Firestore/Auth/Functions/storage schema changes. No deployment.


## 607 · stabilize PC/tablet behavior before further optimization

- Based on real-hand testing, the 606 App rerender suppression is no longer global. Library, Recent, Create, and Music Note PC restore immediate `data-soridraw-builder-mode` -> App gesture-state synchronization.
- Only Music Note while the result content is in the published `tablet` responsive mode keeps the 606 drag-time deferral, because that is the state where the user observed a clear smoothness improvement.
- Lite V2 now publishes its already-computed builder/result content responsive mode and active workspace on root data attributes. No extra DOM measurement, ResizeObserver, or per-frame React state was added.
- Goal of 607 is stability, not another performance experiment: preserve the good Tablet Music Note behavior, restore other workspaces from the 606 regression, and keep PC Music Note on one synchronized App/control path before any later optimization.

## 608차 — PC/Tablet 좌표 엔진 소유권 안정화
- 607 실사용에서 확인된 대칭 증상을 기준으로 페이지별 좌표 엔진 분기를 제거했다.
  - Tablet: Music Note(direct)는 부드럽고 다른 화면(css-var)은 버벅임.
  - PC: 다른 화면(css-var)은 부드럽고 Music Note(direct)만 버벅임.
- 결론: 성능 경로를 페이지가 아니라 **결과 pane의 실제 responsive mode**가 소유해야 한다.
- 일반 손 드래그 런타임:
  - result `pc` (>1080px): 590의 `css-var` 경로.
  - result `tablet/mobile` (<=1080px): `direct` pane geometry 경로.
- 모드 선택은 기존 rAF 안에서 ref로만 수행하며 React state/observer/DOM read를 새로 추가하지 않는다.
- PC↔Tablet 경계를 넘을 때 direct inline geometry와 CSS-var geometry는 같은 동기 작업 안에서 전환되어 서로 동시에 경쟁하지 않는다. 엔진 전환에는 16px 히스테리시스를 둬 1080px 근처에서 좌우로 흔들 때 두 엔진이 반복 교대하지 않게 했다.
- 606/607에서 추가했던 App-level drag sync 억제는 제거하고 605의 원래 즉시 동기화로 복구했다. 즉 다른 화면의 App 동작을 희생시키지 않는다.
- 관리자 PERF 진단/명시적 layout A/B override는 그대로 유지한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 609차 — PC/Tablet 좌표 소유권 동기 안정화
- 608 실사용 확인 결과를 기준으로 추가 최적화보다 **양쪽 모드 안정화**를 우선했다.
- 확인된 실제 손 드래그 결과:
  - Tablet responsive mode: Music Note / Library / Recent 모두 `direct`가 부드러움.
  - PC responsive mode: Library / Recent는 기존 `css-var` 경로가 안정적이며, Music Note는 별도 잔여 이슈로 남아 있음.
- 608의 핵심 문제는 콘텐츠의 실제 PC↔Tablet 전환 기준(1080px)과 좌표 엔진 전환 기준(별도 ±16px 히스테리시스)이 서로 달랐다는 점이다. 이 때문에 경계 부근에서 화면은 Tablet인데 좌표 엔진은 PC 경로이거나 그 반대인 구간이 생길 수 있었다.
- 609에서는 좌표 엔진이 **결과 pane의 실제 content responsive mode와 동일한 판정**을 사용한다.
  - result `tablet/mobile`: 모든 workspace `direct`.
  - result `pc`: Music Note=`direct`, Library/Recent/Create=`css-var`.
- 별도의 엔진 전환 히스테리시스를 제거해 responsive mode와 geometry owner가 같은 프레임 경계에서 바뀌도록 했다.
- workspace 전환 시 현재 result content mode를 한 번 다시 판정해 이전 화면의 inline direct geometry가 다음 화면에 남지 않게 했다.
- 606/607의 App drag-sync 억제는 재도입하지 않았다. 608의 원래 즉시 App 동기화를 유지한다.
- 이번 차수는 안정화 작업이며 PC Music Note 추가 최적화는 후속으로 보류한다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 610차 — PC 마우스 드래그를 터치 입력 경로에 맞춤
- 609까지 PC/Tablet 화면 모드로 해석하던 축을 더 이상 확대하지 않는다. 실제 사용자 검증 기준은 **갤럭시탭 손가락 터치=빠름 / PC 마우스=느림**으로 고정했다.
- 좌표 엔진, responsive 기준, Music Note/Library/Recent 레이아웃은 609 상태를 유지하고 이번 차수에서는 입력 경로만 수정했다.
- PC 마우스 `pointermove`에서 브라우저가 묶어 전달하는 `getCoalescedEvents()`의 **가장 마지막 실제 하드웨어 샘플 좌표**를 사용한다. React pointer wrapper 좌표가 물리 마우스보다 한 묶음 뒤에 남는 가능성을 제거한다.
- 마우스 드래그 동안에만 workspace 위에 투명 hit-test shield를 하나 두고, splitter의 pointer capture는 그대로 유지한다. 따라서 마우스가 수백 개 카드/버튼/스크롤/hover 영역을 지나갈 때 발생할 수 있는 desktop hover 재판정을 차단한다.
- touch/pen 입력에는 이 shield를 적용하지 않는다. 갤탭에서 이미 확인된 터치 손맛은 변경하지 않는다.
- 신규 observer, per-frame DOM read, React drag state, forced layout 로직은 추가하지 않았다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 611차 — PC 기존 엔진 / 터치 Lite V2 자동 분기 + 실사용 PERF 분리
- 기준: 610차 (`SORIDRAW_610차_PC마우스_터치동기화_드래그입력개선`). 같은 좁은 화면에서 **PC 마우스의 Lite V2만 느리고 기존 방식은 빠르며, 갤럭시탭 터치의 Lite V2는 빠른** 실사용 비교를 최종 기준으로 삼았다.
- 일반 Studio Black 분할 엔진을 화면 폭이 아니라 **주 입력 환경**으로 자동 선택한다.
  - `(pointer: fine) + hover 가능`인 일반 PC 마우스/트랙패드 환경: 검증된 `StudioSplitWorkspace` 기존 방식.
  - `(pointer: coarse)` 또는 `hover: none`인 갤럭시탭/터치 우선 환경: 검증된 `Lite V2`.
  - 브라우저 창을 좁혀도 PC는 기존 엔진을 유지하므로 PC/Tablet 반응형 판정과 분할 엔진 선택을 더 이상 섞지 않는다.
- 관리자에게만 `자동 / Lite V2 / 기존 방식` 진단 스위치를 남겼다. 기본은 `자동`이며, `?splitEngine=lite|legacy`는 비교 진단용 강제 선택으로 유지한다.
- 610차의 마우스 전용 보정은 제거했다.
  - `getCoalescedEvents()` 마지막 샘플로 좌표를 바꾸던 경로 제거.
  - 마우스 드래그 중 투명 hit-test shield와 `is-mouse-dragging` 상태 제거.
  - 터치 Lite V2의 기존 rAF/좌표/반응형 동작은 그대로 유지한다.
- PERF 진단을 일반 실사용 드래그와 분리했다.
  - 일반 손 드래그는 `beginSplitPerfDrag`, pointer sample 기록, `layoutAck ResizeObserver`를 시작하지 않는다.
  - 자동 벤치마크는 기존 1400×900 고정 측정과 layout-ack 계측을 유지한다.
  - 관리자 `실손 드래그 비교`를 눌렀을 때만 다음 1회 드래그를 명시적으로 arm하여 PERF/ResizeObserver를 켜고, pointer-up 후 자동 해제한다. 진단 도구 자체는 삭제하지 않는다.
- PC 자동 모드에서는 Lite V2 PERF 도구 실행 전 관리자 진단 스위치로 `Lite V2` 강제 선택을 안내한다.
- UI 디자인, 분할 비율/반응형 규칙, 생성 기능, Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 615차 — 뮤직노트 PC 빠른 드래그 프레임 페이싱

- 기준: 613차. 614의 드래그 중 대체 카드 DOM은 사용하지 않음(색상/외형 변경 없음).
- 사용자 영상에서 확인된 증상은 평균 FPS 저하보다 입력 속도에 따라 지연이 누적되는 형태에 가까웠음.
  - 천천히 이동: 비교적 부드러움
  - 조금만 빠르게 이동: 레이아웃 처리가 입력 속도를 못 따라가며 여러 좌표가 한 번에 따라붙는 점프 발생
- PC fine-pointer 환경의 Music Note에만 실제 레이아웃 커밋을 약 30fps 고정 cadence로 제한.
- pointermove 자체는 계속 최신 좌표만 보관하고, 다음 허용 프레임에서 가장 최신 좌표 하나만 적용.
- Legacy / Lite V2 모두 동일 원칙 적용.
- Galaxy Tab / coarse-pointer V2는 기존 경로 유지.
- Library / Recent / Create는 변경 없음.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.

## 616차 — 뮤직노트 PC 빠른 드래그 공간폭 제한 + Lite 전용 전환정지

- 기준: 615차. 615의 30ms 시간 제한은 제거했다. 사용자 실사용 결과처럼 느린 드래그는 가장 부드럽고 빠른 드래그만 크게 끊기는 경우, 프레임 수 자체보다 한 프레임에 바뀌는 Music Note 폭이 커질 때 레이아웃/페인트 비용이 급증하는 패턴으로 판단했다.
- PC fine-pointer Music Note에서만 매 rAF를 그대로 유지하면서 한 프레임의 splitter 이동폭을 제한한다.
  - 정상 프레임: 최대 64px
  - 지연 프레임: 최대 44px
  - 30ms 이상 밀린 프레임: 최대 28px
  - 느린 이동은 제한값보다 작으므로 기존처럼 1px 단위로 그대로 따라간다.
  - 빠른 입력은 과거 좌표 큐를 재생하지 않고 항상 최신 목표만 유지한 채 제한된 공간폭으로 따라간다.
  - pointer-up에서는 최종 좌표를 정확히 1회 확정한다.
- Legacy와 Lite V2에 같은 Music Note 공간폭 규칙을 적용했다. Galaxy Tab/coarse-pointer는 기존 V2 경로를 변경하지 않는다.
- Lite V2는 기존 `soridraw-lite-split-dragging` 경로 때문에 Legacy Music Note에 적용되던 transition/animation 정지가 빠져 있었다. 616에서는 body 전체가 아니라 Music Note 하위에만 정확히 같은 정지 규칙을 적용한다.
- 613에서 title/keyword track마다 넣었던 `translateZ(0)` / `will-change: transform` 레이어 승격은 제거했다. 다수 카드가 별도 합성 레이어로 승격되어 빠른 폭 변경 때 raster/composite 비용을 키울 가능성을 없앴다. 기존 색상/레이아웃/카드 디자인은 변경하지 않는다.
- Library / Recent / Create, Firebase/Auth/Firestore/Functions/저장 구조 변경 없음. 배포 없음.

## 617차 — 뮤직노트 분할 경로 공용화
- 기준: 616차
- PC 자동 뮤직노트의 Lite runtime profile을 라이브러리와 동일한 `library-590` CSS-variable geometry로 통일.
- PC에서 강제 Lite V2를 선택해도 뮤직노트/라이브러리는 동일한 `library-590` geometry를 사용.
- 갤럭시탭/터치 우선 환경은 검증된 adaptive Lite V2 유지.
- 기존 방식에서 뮤직노트만 따로 적용했던 빠른 드래그 공간폭 제한을 제거하고 최근 생성곡과 동일한 pointer/rAF 경로로 복구.
- 613~616에서 추가된 뮤직노트 전용 title/keyword track 및 drag containment/clip/transform 실험을 정상 구조로 원복.
- 관리자 전용 Music Note render probe는 유지.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 622차 - 분할선 공통 구현 + 진단 도구 기본 OFF
- 기준: 617차. 618~621의 분할선 전용 CSS 실험은 사용하지 않는다.
- Music Note / Library의 Lite/590 분할선은 Recent Songs와 동일한 `soridraw-studio-splitter` DOM/CSS를 body portal로 공유한다.
- 분할선 top/bottom, 1px line, hover, `ew-resize` cursor의 시각 소유권은 `studioLayout.css` 공통 규칙 하나로 통일한다.
- 품질·성능 진단 도구는 관리자 앱 설정 토글로만 켜며 기본값은 OFF. Auto/Lite V2/기존 방식 전환 UI도 같은 토글을 따른다.
- Firebase/Auth/Firestore/Functions/저장 구조 변경 없음.


## 624차 — 뮤직노트 잔여 분할 딜레이 추가 억제
- 623의 App 루트 재렌더 억제 조건이 legacy drag class만 확인해 자동 PC 뮤직노트의 Lite/590 드래그에서는 실제로 적용되지 않던 조건을 수정했다.
- 뮤직노트 드래그 중에는 `soridraw-lite-split-dragging` / `soridraw-split-dragging` 둘 다 인식한다.
- 드래그 중 `isStudioBlackActionMode`, `isSplitBuilderActionMobile` React mirror 갱신을 모두 건너뛰고, 기존 CSS/root dataset 반응은 그대로 실시간 유지한다. 포인터를 놓을 때 한 번만 React 상태를 동기화한다.
- 최근 생성곡, 라이브러리, 갤탭 V2, 분할 엔진/디자인/Firebase 구조는 변경하지 않는다.


## 625차 - 전역 스크롤바 중립 회색 통일
- 모바일/다크/라이트에 남아 있던 갈색·주황 계열 스크롤바를 기존 분할 패널과 동일한 중립 회색(#626266, hover #77777b)으로 통일.
- 전역 html/body 스크롤바는 4px, 모바일은 3px로 얇게 조정하고 트랙은 투명 처리.
- custom-scrollbar 및 Studio 가사 스크롤바의 주황 hover/thumb도 동일 회색 규칙으로 통일.
- 스크롤 동작/레이아웃/성능 로직은 변경하지 않음.


## 626차 — 모바일 분할모드 최근 생성/테마 왕복 복구
- 기준: 625차.
- 휴대폰 Studio Black은 PC와 같은 `StudioRightRail` DOM을 새로 만들지 않고 그대로 재사용해, 센터 작업공간 아래에 100% 폭으로 쌓이도록 복구. 따라서 생성 상태/최근 생성곡/크레딧 영역이 모바일에서도 사라지지 않음.
- 다크/라이트로 전환할 때는 기존처럼 `recent` 구성을 사용하고, 다시 분할(Studio Black)로 돌아올 때는 `create` 작업공간으로 복구해 이전 테마의 split 상태가 남지 않도록 수정.
- 1099px 이하에서는 builder/result를 공통 세로 100% 폭으로 고정하고, create/recent의 접힘 상태를 실제 display에 반영해 테마 왕복 뒤 64px/분할 폭이 남아 화면이 찌그러지는 문제를 차단.
- PC/갤탭 분할 엔진, 생성 로직, Firebase/Auth/Firestore/Functions/저장 구조는 변경하지 않음.


## 627차 - 키워드 접기 전환 통일 / 스토리보드 카드 높이 축소
- 기준: 626차
- 장르/스타일/사운드 접힘 시 강제로 `height: 58px`을 즉시 적용하던 규칙을 제거하고, 분위기/주제와 동일한 `max-height` 300ms 전환 경로를 사용하도록 수정했습니다.
- 접힌 상태의 첫 키워드 1줄 노출 높이(58px)는 유지합니다.
- 스토리보드 카드의 세로 패딩만 줄여 카드 높이를 낮췄습니다. 기능/모달/데이터 구조는 변경하지 않았습니다.

## 628차 - Firestore 읽기 절감 / 캐시 우선 구조
- 기준: 627차. Firestore 저장 구조/문서 스키마는 변경하지 않음.
- `section_tags` 전체 실시간 listener 제거. Studio 진입 시 로컬 캐시를 먼저 사용하고 12시간 TTL이 지난 경우에만 1회 조회.
- 전역 `suno_tracks` 최근 30곡 listener는 생성 중이거나 완료 후 크레딧 확인이 남아 있을 때만 연결. 평상시 로그인 상태에서는 연결하지 않음.
- `users/{uid}` 로그인 초기 `getDoc` 2회를 제거하고 기존 실시간 listener의 첫 서버 snapshot 하나로 역할/상태/강제로그아웃/세션 동기화를 처리. 캐시 snapshot은 UI 선표시만 하고 보안 판정은 서버 snapshot을 기다림.
- 메뉴 공개 설정은 6시간, 전체 가사 클리셰 설정은 6시간 로컬 TTL 캐시를 사용. 클리셰 설정은 Studio에서만 서버 refresh하며 관리자 저장 시 같은 브라우저 캐시를 즉시 갱신.
- 섹션 태그 관리자 화면이 서버 최신 목록을 수신할 때 사용자용 section-tags 캐시도 같이 갱신.
- Firestore Web persistent multi-tab cache를 로컬/AI Studio 개발 환경과 `로그인 기억`을 선택한 신뢰 기기에서 활성화. 짧은 새로고침/재연결이 매번 새 query처럼 시작되는 비용을 줄이는 목적.
- Favorites / 최근 생성곡 / Library의 실제 사용자 데이터 실시간 동기화는 이번 차수에서 유지. 데이터 최신성이 중요한 영역까지 임의 TTL 캐시로 바꾸지 않음.


## 629차 — 키워드 메뉴 접기/펼치기 속도 완전 통일
- 기준: 628차
- 장르 / 스타일 / 사운드 / 분위기 / 주제 5개 메뉴의 접기·펼치기 애니메이션을 단일 공통 클래스 `soridraw-keyword-expand-motion`으로 통합했습니다.
- 모든 메뉴가 펼치기와 접기 양방향 모두 `max-height + opacity / 300ms / ease-out` 조건을 동일하게 사용합니다.
- 627차에서 복구한 장르·스타일·사운드의 부드러운 접기 경로와 1줄 노출 높이는 그대로 유지합니다.
- 분할바 드래그 중 기존 `transition: none !important` 성능 보호 규칙은 그대로 우선하므로 분할 성능에는 영향을 주지 않습니다.
- UI 높이, 키워드 내용, Firestore/Auth/Functions/저장 구조는 변경하지 않았습니다.
