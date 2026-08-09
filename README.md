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
