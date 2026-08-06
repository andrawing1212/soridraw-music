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
