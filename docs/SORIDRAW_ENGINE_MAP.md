# SORIDRAW 엔진 구조 지도

기준: 38차 `style_intent_hook_blueprint_fix`

이 문서는 앱 안에서 실제로 동작하는 생성 엔진, 보조 엔진, 검수 계층을 구분해 정리한다.
“엔진”은 반드시 파일 하나를 뜻하지 않는다. 하나의 목적을 위해 여러 함수와 파일이 묶인 기능 계층도 엔진으로 분류한다.

## 1. 전체 현황

- 현재 서비스 주 엔진: **V1 Classic**
- 선택 가능한 별도 엔진: **V2**
- 구조만 존재하고 아직 연결되지 않은 엔진: **V3**
- V1 내부 핵심 생성 엔진/보호 계층: **32개**
- 앱 공통 실행·저장·미리보기 엔진: **5개**

## 2. 전체 처리 순서

```text
사용자 선택/직접입력
→ 생성 버전 라우터
→ Story Context와 Mood 해석
→ 장르 메인·서브·하이브리드 슬롯 확정
→ 스타일 항목별 역할 분류와 Style Intent Plan 잠금
→ 시대 정체성 앵커·전환·공간·서사·리듬 목적지 확정
→ 분위기 역할 분배와 Genre 분위기 2개 압축
→ 5단 프롬프트 조립
→ 섹션 구조/역할/보컬 소유권 설계
→ Section Performance Plan + Chorus Hook Blueprint 설계
→ Gemini 1회 통합 생성
→ 한국어·외국어 가사를 같은 Story Context와 Hook Family로 한 번에 작성
→ 섹션별 Canonical 로컬 이벤트 확정
→ 가사에는 전체 로컬 이벤트 적용
→ [Arrangement]에는 핵심 정체성·전환·최종 보상만 압축
→ 선택 스타일 목적지 누락 검사
→ Atmosphere·Vocals·사운드 큐 문법 완결
→ Suno 1,000자 예산 가드(시대/핵심 스타일 앵커 보호)
→ 섹션 렌더링/구조 가드
→ 생성 결과 표시/저장
```

## 3. 생성 버전 엔진

### 3.1 Generation Version Router

- 역할: V1/V2/V3 중 실행할 생성 경로를 결정한다.
- 위치:
  - `src/services/generation/index.ts`
  - `src/services/generation/shared/engineTypes.ts`
- 적용 범위: 생성 옵션의 엔진 선택.

### 3.2 V1 Classic Engine

- 역할: 현재 서비스의 5단 프롬프트, 가사, 섹션, 태그를 통합 생성한다.
- 위치:
  - `src/services/generation/v1/generateV1.ts`
  - `src/services/geminiService.ts`
- 상태: 현재 주 엔진.

### 3.3 V2 Engine

- 역할: V2 전용 프롬프트·가사·출력 규칙을 사용한다.
- 위치: `src/services/generation/v2/`
- 상태: 선택 가능. V1 창작 규칙과 분리한다.

### 3.4 V3 Engine

- 역할: 자유도가 높은 단일 호출 엔진을 목표로 하는 독립 구조다.
- 위치: `src/services/generation/v3/`
- 상태: 아직 실제 생성 경로에 연결되지 않음.

## 4. V1 핵심 생성 엔진 32개

### 4.1 Story Context / Shared Scene Engine

- 역할: 직접입력, 상황, 주제, 관계, 장면, 감정 흐름을 하나의 공통 서사 기준으로 만든다.
- 위치:
  - `src/services/generation/v1/rules/sharedSceneAlignment.ts`
  - `src/services/lyricStoryBrief.ts`
  - `src/services/geminiService.ts`
- 적용: 제목, Atmosphere, Vocals, Arrangement, 가사 전체.

### 4.2 Mood Identity Engine

- 역할: 여러 분위기 선택이 강화형인지, 층위형인지, 서로 다른 결인지 분석한다.
- 위치: `src/services/moodIdentity.ts`
- 적용: 분위기 해석의 공통 기준.

### 4.3 Mood Role Translator

- 역할: 하나의 분위기를 Genre, Atmosphere, Vocals, Arrangement, Lyrics 역할로 나누어 번역한다.
- 위치: `src/services/moodRoleTranslator.ts`
- 적용: 분위기 키워드가 한 줄에 과밀하게 몰리지 않도록 분배.

### 4.4 Creative Brief / Global Mood Distribution Engine

- 역할: 선택값과 직접입력을 곡 전체의 창작 지시로 요약하고 5단 프롬프트에 분배한다.
- 위치: `src/services/songCreativeBrief.ts`
- 적용: 곡 전체 색상, 분위기 분포, 선택값 보존.

### 4.5 Five-line Prompt Assembly Engine

- 역할: `[Genre] [Instruments] [Atmosphere] [Vocals] [Arrangement]` 구조를 조립한다.
- 위치:
  - `src/services/promptEngineV1.ts`
  - `src/services/geminiService.ts`
- 적용: 최종 음악 프롬프트.

### 4.6 Genre/Fusion Lyric Density Engine

- 역할: 장르, 퓨전, 템포, 섹션 역할에 따라 가사 호흡과 정보량을 다르게 설계한다.
- 위치: `src/services/geminiService.ts`
- 적용: Verse/Rap/Chorus/Bridge/Outro의 밀도 차이.

### 4.7 Section Blueprint Engine

- 역할: Stable/Recommended/Experimental/Custom 구조와 랩 구간 위치를 결정한다.
- 위치: `src/services/generation/v1/sections/sectionBlueprint.ts`
- 적용: 실제 섹션 순서와 섹션 개수.

### 4.8 Section Role Dictionary Engine

- 역할: Intro, Verse, Pre-Chorus, Chorus, Bridge, Final Chorus, Outro 등이 무엇을 해야 하는지 정의한다.
- 위치: `src/services/generation/v1/sections/sectionRoleEngine.ts`
- 적용: 섹션 역할, 반복 방식, 권장 밀도, 전환 기능.

### 4.9 Experimental Section Strategy Composer

- 역할: 실험형 구조에서 문법을 지키면서 다양한 섹션 순서를 조합한다.
- 위치: `src/services/generation/v1/sections/sectionStrategyComposer.ts`
- 적용: Experimental 구조 전용.

### 4.10 Adaptive Lyric Flow Engine

- 역할: 섹션별 가사 분량, 반복, 보컬 소유권, 전개 흐름을 Gemini 지시문으로 전달한다.
- 위치: `src/services/generation/v1/sections/sectionLyricFlow.ts`
- 적용: 섹션별 가사 호흡과 배치.

### 4.11 Vocal Anchor / Role Allocation Engine

- 역할: Main/Lead/Sub/Rap, A/B/C/D, Male/Female 앵커를 만들고 섹션 담당을 배분한다.
- 위치: `src/services/generation/v1/sections/vocalAnchors.ts`
- 적용: 멀티보컬 태그와 역할 소유권.

### 4.12 Section Renderer Engine

- 역할: Gemini의 가사를 섹션 블록으로 파싱하고 보컬 큐와 사운드 큐를 분리해 렌더링한다.
- 위치: `src/services/generation/v1/sections/sectionRenderer.ts`
- 적용: 최종 가사 태그 형식.

### 4.13 Section Guard Engine

- 역할: 누락 섹션, 잘못된 순서, 빈 섹션, 역할 배정 오류를 검사하고 구조를 보호한다.
- 위치: `src/services/generation/v1/sections/sectionGuard.ts`
- 적용: V1 구조 안전성.

### 4.14 Section Performance Plan Engine

- 역할: 첫 Gemini 호출에서 Arrangement와 가사를 함께 보고 섹션별 보컬 실행과 지역 사운드 변화를 하나의 공통 계획으로 설계한다.
- 위치: `src/services/geminiService.ts`
- 적용: 모든 가창 섹션의 변화, 균형, 통일.
- 출력 필드:
  - 자유형 주 큐/예비 큐
  - `delivery`, `phrasing`, `register`, `dynamicDirection`
  - `arrangementRole`, `arrangementAction`, `soundCue`

### 4.15 Structured Cue Reconstruction & Shared Language Binding Engine

- 역할: 자유형 큐가 손상되거나 비어도 같은 최초 응답의 구조화 필드로 안전한 큐 전체를 다시 조립한다.
- 위치: `src/services/geminiService.ts`
- 적용: 한국어·외국어 카드의 공통 퍼포먼스 태그.
- 원칙:
  - 실제 감정 문구를 코드에 고정하지 않는다.
  - 전달 방식·프레이징·성구·다이내믹 같은 기술 필드만 형식으로 고정한다.
  - 공통 계획을 한 번 확정한 뒤 두 언어 카드에 동일하게 적용한다.
  - 언어별 원본 태그로 따로 후퇴해 서로 달라지는 것을 막는다.

### 4.16 Arrangement Timeline Alignment Engine

- 역할: 섹션별 `arrangementAction`과 가사 아래의 `soundCue`를 같은 Canonical 계획에 결속한다.
- 위치: `src/services/geminiService.ts`
- 적용: Hook 진입, 반주 축소, Bridge 전환, Final lift, Ending.
- 원칙:
  - 가사 카드는 각 섹션이 소유한 모든 로컬 사건을 유지한다.
  - 최종 `[Arrangement]`는 같은 사건 지도에서 핵심 정체성·결정적 전환·최종 보상만 요약한다.
  - 한 사건은 한 섹션에만 배치하고, 해당 섹션의 `soundCue`와 보컬 반응이 모순되지 않게 한다.

### 4.17 Section Plan Completeness Contract Engine

- 역할: Gemini가 일부 필드를 비우거나 중복된 sectionIndex를 반환해도 각 실제 섹션에 계획 항목이 빠짐없이 연결되도록 보호한다.
- 위치: `src/services/geminiService.ts`
- 적용: 모든 가창 섹션의 `performanceCue`, Arrangement 사건이 있는 섹션의 `soundCue`.
- 복구 순서:
  - 주 큐 → 예비 큐 → 구조화 필드 → 기존 유효 태그 → 같은 섹션 계열의 최초 응답 큐
  - `soundCue` → 같은 섹션의 `arrangementAction` → 해당 섹션 기존 사운드 큐
- 원칙:
  - 실제 창법·감정·악기 문구를 코드에 고정하지 않는다.
  - 동일한 첫 Gemini 응답과 현재 가사 안의 정보만 사용한다.
  - 빈 태그 방지가 필요할 때만 같은 계열 큐의 재사용을 마지막 수단으로 허용한다.

### 4.18 Cue Candidate Quality & Domain Separation Engine

- 역할: 같은 섹션에 존재하는 자유형 큐, 구조형 큐, 기존 태그, 독립 대괄호 큐, 전체 `[Vocals]` 보조 정보를 품질 점수로 비교해 가장 구체적인 보컬 실행 큐를 선택한다.
- 위치: `src/services/geminiService.ts`
- 적용: Section Performance Plan 최종 결합 직전.
- 핵심 규칙:
  - `delivery`, `phrasing`, `register`, `voice`, `humming`처럼 실제 가창 행위가 중심인 문장은 `groove`, `ambient` 같은 리듬·질감 형용사가 함께 있어도 보컬 큐로 분류한다.
  - 악기·패드·신스·비트처럼 구체적인 음원 객체가 진입·이탈·스웰·페이드 같은 행동을 하면 사운드 큐로 분류한다.
  - `playful syncopated groove phrasing`, `hushed ambient delivery`는 보컬 큐로 유지한다.
  - `vocal pads swell under daegeum`은 vocal이라는 단어가 있어도 패드와 스웰이 중심이므로 사운드 큐로 유지한다.
  - 단어 하나가 아니라 문장의 중심 대상과 행동을 기준으로 상호 배타적으로 판정한다.
  - 구조형 큐를 무조건 우선하지 않고, 같은 섹션의 기존/인접 큐가 더 구체적이면 그 큐를 선택한다.
  - Bridge처럼 같은 계열의 다른 섹션이 없는 경우에는 현재 곡의 `[Vocals]`와 해당 섹션 `arrangementAction` 안의 보컬 정보를 이용해 빈 태그를 보완한다.
- 하드코딩 금지:
  - 특정 감정 문구나 테스트 결과 문장을 기본값으로 넣지 않는다.
  - 고정하는 것은 보컬/사운드 타입 구분, 후보 우선순위, 품질 비교 방식뿐이다.

- Arrangement 사건 보존:
  - 동일 섹션의 짧은 `soundCue`와 완전한 `arrangementAction`을 함께 비교한다.
  - 악기 진입·잔류·이탈과 결과가 더 많이 남아 있는 완전한 사건을 최종 독립 큐로 선택한다.
  - `drums drop out leaving keys and guitar`를 `drums drop-out`처럼 정보가 빠진 조각으로 축약하지 않는다.

### 4.19 Final Cue Grammar & Mixed-Cue Split Engine

- 역할: 최종 출력 직전 독립 대괄호 줄에 섞인 보컬 실행과 사운드 배경을 분리하고, Arrangement 사건의 의미는 유지한 채 영어 큐 문법만 정리한다.
- 위치: `src/services/geminiService.ts`
- 적용:
  - `[Intro]` 아래의 `gentle hums over ambient textures`처럼 보컬 실행과 배경이 한 줄에 섞인 경우.
  - `vocal pads swells`, `drums returns fully strength`, `beat fades outro`처럼 사건 정보는 맞지만 출력 문법이 손상된 경우.
- 원칙:
  - 보컬 부분은 섹션 태그 안으로 승격한다.
  - 실제 악기·음원 부분은 독립 사운드 큐로 유지한다.
  - 현재 곡의 단어와 사건은 바꾸지 않고, 주어-동사 수 일치·복합명사·구동사 입자만 정리한다.
  - 두 개의 실제 사운드 객체 사이에서만 접속사 토큰이 한 글자 오염된 구조를 감지해 `and`로 복원한다. `full band instrumentation`처럼 band가 실제 명사인 문장은 보존한다.
  - 가사 본문과 장면·감정·악기 선택을 재작성하지 않는다.

### 4.20 Canonical Section Plan Single-Source Engine

- 역할: 섹션별 최종 보컬 큐와 최종 사운드 사건을 한 번만 확정하고 이후 모든 출력이 같은 원본만 사용하게 한다.
- 위치: `src/services/geminiService.ts`
- 적용:
  - 한국어 가사 섹션 태그
  - 외국어 가사 섹션 태그
  - 최종 `[Arrangement]` 시간표
- 핵심 규칙:
  - 첫 응답의 자유형 큐·구조형 필드·Arrangement 사건을 이용해 섹션별 최종값을 한 번 확정한다.
  - 확정된 계획에는 내부 잠금 표시를 두어 후속 렌더링에서 다시 후보를 평가하지 않는다.
  - 언어별 기존 태그는 공통 계획이 정말 비었을 때만 최후 수단으로 사용한다.
  - `[Arrangement]`는 일부 역할만 골라내지 않고, 공통 계획에 실제 사건이 있는 모든 섹션을 순서대로 사용한다.
  - Final Chorus·Bridge·Outro 사건이 가사에는 있고 프롬프트에는 빠지는 현상을 차단한다.
  - 특정 감정·창법·악기 문구를 코드에 고정하지 않고, 단일 원본과 연결 순서만 고정한다.

### 4.21 Output Integrity / Fail-open Engine

- 역할: 다중 줄 태그, 비정상 가사 과분할, 중복 Intro/Outro, 빈 골격을 정리한다.
- 위치: `src/services/geminiService.ts`
- 적용: 사용자에게 보여주기 직전의 최종 가사.
- 원칙: 태그 품질 문제 때문에 완성된 곡 전체를 실패시키지 않는다.

### 4.22 Genre Selection Role & Slot Limit Engine

- 역할: 사용자가 실제 장르 메뉴에서 고른 순서를 음악적 역할로 보존한다.
- 위치:
  - `src/App.tsx`
  - `src/services/geminiService.ts`
- 규칙:
  - 첫 번째 실제 장르 선택 = 메인 장르.
  - 두 번째 실제 장르 선택 = 서브 장르.
  - 실제 장르 선택은 최대 2개다.
  - 최종 `[Genre]`의 장르 정체성은 메인·서브·하이브리드를 합쳐 최대 3개다.
  - 실제 장르가 1개면 하이브리드 최대 2개, 실제 장르가 2개면 하이브리드 최대 1개다.
- 안전장치: UI, 무작위 선택, 템플릿 복원, 다음 곡 적용, 최종 생성 요청 경계에서 같은 제한을 다시 적용한다.

### 4.23 Hybrid Role Router

- 역할: 하이브리드 메뉴에는 실제 장르 정체성을 바꾸는 항목만 남기고, 악기·편성·공간 질감·서사 연출 항목은 본래 역할의 메뉴로 이동한다.
- 위치:
  - `src/constants.ts`
  - `src/App.tsx`
  - `src/services/geminiService.ts`
- 이동 항목:
  - `Acoustic Piano` → 사운드/건반 악기.
  - `Acoustic Band`, `Indie Band`, `Full Band Sound`, `Orchestral` → 사운드/편성.
  - `Retro Synth` → 사운드/시대 신스 질감.
  - `Deep Electronic Mood` → 공간 질감의 `Deep Electronic Texture`.
  - `Musical Theater` → 서사 연출의 `Musical Theater Direction`.
- 호환성: 기존 저장본의 안정 ID를 유지하고, 과거 Hybrid 선택값은 동일 ID의 새 Sound/연출 위치로 자동 이동한다.
- 하드코딩 경계: 특정 생성 결과를 고정하지 않고 메뉴 항목의 역할과 라우팅 위치만 고정한다.

### 4.24 Mood Role Consolidation & Genre Mood Accent Compressor

- 역할: 기존 Mood Identity/Role 결과를 한 번만 역할별로 분배하고, `[Genre]`에 남길 분위기 색채를 최대 2개로 압축한다.
- 위치:
  - `src/services/moodRoleTranslator.ts`
  - `src/services/geminiService.ts`
- Genre 압축 규칙:
  - 표면·질감 정체성 최대 1개.
  - 핵심 감정 정체성 최대 1개.
  - 의미가 겹치면 하나만 유지한다.
  - 공간·공기·장면 표현은 Atmosphere로 보낸다.
  - 고조·축소·전환·페이드 같은 시간 변화는 Arrangement로 보낸다.
  - 창법·태도 중심 표현은 Vocals로 보낸다.
- 예시 원리: `Glossy, Cool, Soulful, Swelling, Open Breezy`가 입력돼도 Genre에는 역할이 다른 핵심 2개만 남고 나머지는 각 담당 줄로 분산된다. 실제 선택 문구 자체는 코드에 고정하지 않는다.

### 4.25 Genre Final Boundary Guard

- 역할: 모든 라우터와 분위기 엔진이 끝난 뒤 `[Genre]`를 단일 규칙으로 다시 조립하고 잠근다.
- 위치: `src/services/geminiService.ts`
- 최종 계약:
  - 실제 장르 정체성 최대 3개.
  - Genre 분위기 색채 최대 2개.
  - 메인 장르를 중심으로 서브·하이브리드를 `influence` 관계로 짧게 표현한다.
  - 서사 연출, 악기 편성, 공간 묘사, 다이내믹 전개가 Genre에 다시 침범하지 못하게 한다.
  - 직접 입력 장르가 있으면 사용자의 직접 입력을 우선하고 동일한 슬롯 상한만 적용한다.
- 적용 시점: Canonical Section Plan과 최종 Arrangement 정렬이 끝난 진짜 출력 경계.


### 4.26 Ensemble Formation Role Guard

- 역할: `Full Band Sound`, `Acoustic Band`, `Indie Band`, `Orchestral`을 개별 악기가 아니라 곡 전체의 편성 상태로 해석한다.
- 위치:
  - `src/services/geminiService.ts`
  - `src/constants.ts`
- 적용 원칙:
  - `[Instruments]`와 섹션별 사운드 큐에는 실제로 들리는 악기와 질감만 사용한다.
  - 편성 신호는 전체 밀도, 합주 진입, 최종 확장 같은 Arrangement 방향에만 반영한다.
  - `piano band cello`처럼 `band`가 악기 사이의 잘못된 연결어가 되는 것을 차단한다.
  - `full band enters`, `live band instrumentation`처럼 실제 편성 명사로 쓰인 정상 문장은 보존한다.

### 4.27 Canonical Producer Map Compression Engine

- 역할: 모든 섹션을 나열하던 긴 `[Arrangement]`를 같은 Canonical 사건 지도에서 핵심 프로듀서 맵으로 압축한다.
- 위치:
  - `src/services/generation/v1/rules/sectionArrangementRoles.ts`
  - `src/services/geminiService.ts`
- 솔로 출력: BPM/그루브 + 대표 정체성 + 결정적 전환 + 최종 보상.
- 듀엣·그룹 출력: 보컬 인계나 공동 보상이 꼭 필요할 때 최대 4개의 사건 절을 허용한다.
- 보호 원칙:
  - 가사 아래의 섹션별 로컬 사운드 큐는 삭제하지 않는다.
  - Final Chorus/Climax 같은 최종 보상을 우선 보호한다.
  - 사용자 지정 섹션, 무음, 악기 진입·이탈, 엔딩 지시는 자동 압축보다 우선한다.
  - 새 사건을 만들지 않고 이미 확정된 Canonical 사건만 요약한다.

### 4.28 Suno Prompt Character Budget Guard

- 역할: 최종 5단 음악 프롬프트를 Suno 입력 상한인 1,000자 안에 유지한다.
- 위치: `src/services/geminiService.ts`
- 기준:
  - 절대 상한: 1,000자.
  - 안정 목표: 약 970자 이하.
- 압축 순서:
  1. `[Arrangement]`를 핵심 프로듀서 맵으로 먼저 압축한다.
  2. 전체가 넘을 때만 선택적인 오디오 품질 문구를 제거한다.
  3. 그다음 Instruments·Atmosphere·Vocals의 중복 수식어를 역할별로 줄인다.
  4. 세미콜론·쉼표·단어 경계에서만 줄여 중간 단어 절단을 막는다.
- 보호 원칙: 장르 정체성, 사용자 직접입력, 핵심 악기, 보컬 정체성, 결정적 전환과 최종 보상을 우선 보존한다.


### 4.29 Style Intent Registry & Single-Source Engine

- 역할: 스타일 메뉴 전체를 메뉴 이름만으로 뭉뚱그리지 않고, 각 항목의 실제 음악 기능과 프롬프트·가사 목적지를 먼저 확정한다.
- 위치:
  - `src/constants.ts`
  - `src/services/geminiService.ts`
- 기본 역할표:
  - `하이브리드` → 기존 Genre Identity Engine의 보조 장르 정체성, 필요할 때 일부 악기 색채. 가사 소재로 사용하지 않는다.
  - `보컬 라인` → `[Vocals]`와 섹션별 보컬 실행 태그.
  - `특수 효과` → `[Vocals]`와 필요한 섹션의 보이스 효과 태그.
  - `시대 질감` → `[Genre]`의 시대 정체성과 `[Arrangement]`의 녹음·믹스·프로덕션 질감. 가사 내용에는 넣지 않는다.
  - `전환 연출` → `[Arrangement]`의 특정 섹션 전환과 대비 사건.
  - `공간 질감` → `[Atmosphere]`와 섹션별 로컬 사운드 큐. 가사 소재에는 넣지 않는다.
  - `서사 연출` → `[Atmosphere]`, `[Arrangement]`, 전체 섹션 감정·이야기 진행.
  - `후렴 라인` → Chorus/Hook/Refrain 전체의 Hook Blueprint.
  - `리듬감` → `[Arrangement]`와 가사 문장 길이·강세·호흡·반복 셀.
- 항목별 예외 라우팅:
  - `Musical Theater`는 보컬과 Arrangement의 무대식 서사 연출로 보낸다.
  - `Emotional Build`, `Scene Transition`은 전환 사건으로 보낸다.
  - `Dramatic Strings`, `Orchestral Hit`, `Large-scale Sound`는 Instruments/Arrangement로 보낸다.
  - `Deep Electronic Texture`는 Instruments/Atmosphere로 보낸다.
  - `Tunnel Echo`는 공간 음향이며 후렴 응답 훅과 분리한다.
- 호환성:
  - `Study Beats`는 안정 ID `fusion-study-beats`를 유지한 채 리듬감에서 하이브리드로 이동한다.
  - 과거 저장 선택값은 ID가 같으므로 새 위치에서 복원된다.
- 단일 원본 원칙: 같은 Style Intent Plan을 음악 프롬프트, Section Performance Plan, 한국어 가사, 외국어 가사가 함께 사용하며 언어별로 다시 해석하지 않는다.

### 4.30 Protected Era Identity & Style Coverage Engine

- 역할: 여러 시대 질감이 일반적인 `retro` 하나로 뭉개지거나 1,000자 압축 과정에서 모두 사라지는 현상을 막고, 선택된 스타일이 정확한 목적지에 실제 적용됐는지 검사한다.
- 위치: `src/services/geminiService.ts`
- 시대 압축 규칙:
  - 구체적인 시간 앵커는 최대 2개까지 보존한다.
  - `neo-retro`, `future-retro`, `timeless` 같은 시대 재해석은 최대 1개까지 결합한다.
  - 예: `90년대 중반 + Y2K + 네오 레트로` → `mid-90s/Y2K neo-retro`.
  - 카세트·라디오·구형 MP3 같은 매체 질감은 Genre 이름이 아니라 Arrangement의 짧은 프로덕션 질감으로 보낸다.
- Coverage 검사:
  - 각 선택 항목마다 Genre/Instruments/Atmosphere/Vocals/Arrangement/가사 구조 중 담당 목적지를 기록한다.
  - 누락된 의도만 담당 목적지에 복구하고, 관련 없는 줄에 스타일 이름을 채워 넣지 않는다.
  - 시대 앵커, 핵심 전환, 후렴 최종 보상은 Suno 문자 예산 압축보다 우선 보호한다.
- 하드코딩 경계: 시대 조합 방식과 목적지만 고정하며, 곡의 이야기·이미지·훅 문장은 고정하지 않는다.

### 4.31 Rhythm Prosody Engine

- 역할: 리듬감 선택을 단순 Arrangement 명칭으로 끝내지 않고, 실제 가사의 호흡·강세·음절 밀도·반복 셀에 반영한다.
- 위치: `src/services/geminiService.ts`
- 적용 예시 원리:
  - 3박자 → 세 부분으로 자연스럽게 흔들리는 호흡군.
  - 6/8 → 두 번의 큰 파동 안에서 상승·하강하는 문장.
  - 오프비트·싱코페이션 → 픽업 단어, 내부 쉼, 비대칭 강세.
  - 스타카토·촘촘한 리듬 → 짧고 끊기는 문장과 선명한 자음 공격.
  - 하프타임 → 적은 음절, 긴 모음, 넓은 호흡 공간.
  - 더블타임 → 압축된 다중 음절 구와 빠른 호흡 전환.
  - 바운스·셔플 → 반복 강세 위치에 짧은 펀치 단어 배치.
  - 루프형 → 같은 리듬 셀을 유지하고 주변 단어만 변화.
- 금지: `3박자`, `오프비트` 같은 기술 이름을 가사 소재로 직접 쓰지 않는다.
- 공통 적용: 한국어와 외국어 가사는 같은 리듬 목적을 공유하되 각 언어의 자연스러운 음절과 어순으로 실현한다.

### 4.32 Chorus Hook Blueprint & Hook Family Guard

- 역할: 후렴 라인 선택을 `[Arrangement]`의 장식 문구로만 소비하지 않고, 가사를 쓰기 전에 하나의 공통 Hook Blueprint로 설계한다. 현재 구조의 Chorus·Hook·Refrain·Main Theme·Theme/Climax 역할 체인을 먼저 해석한 뒤 해당 핵심 구간 전체에 적용한다.
- 위치:
  - `src/constants.ts`
  - `src/services/geminiService.ts`
- Blueprint 필드:
  - 핵심 훅 문구와 동일 의미의 한국어·외국어 표현.
  - 훅의 첫줄/끝줄/내부 배치.
  - 반복 횟수와 점층·변형 방식.
  - 리듬 셀과 보컬 퍼포먼스 사건.
  - 필요할 때 응답 문구, 선공개, 기존 Post-Chorus/Drop 연결.
- Hook Family 원칙:
  - 선택된 핵심 훅은 마지막 구간에만 몰지 않고 현재 구조에서 해석된 첫 번째 Chorus/Hook/Refrain/Main Theme/Theme부터 등장한다.
  - Chorus 2는 인지 가능한 핵심을 유지하면서 주변 문장·응답·한 단어를 제한적으로 변화시킨다.
  - Final Chorus는 반복 밀도, 음역, 하모니, 응답, 프로덕션 무게 중 적절한 요소로 강화한다.
  - 한국어·외국어 카드는 같은 의미·위치·강화 곡선을 공유한다.
  - `preserve` 가사 모드는 자동으로 수정하지 않는다.
- 지원 구조:
  - 한 줄 훅, 짧은 반복, 반복 구호, 콜앤리스폰스, 챈트/떼창, 멜로디 훅.
  - 첫줄/끝줄 앵커, 한 단어 훅, 점층 반복, 변형 반복, 메아리 응답 훅.
  - 훅 선공개, 기존 Post-Chorus 태그, A/B 분할 후렴, Drop 훅.
  - 안티코러스, 순환 리프레인, 여백 훅.
- 구조 안전:
  - 선택되지 않은 Post-Chorus·Drop·Refrain 섹션 태그를 새로 만들지 않는다.
  - 실제 Drop/Refrain이 있으면 해당 구간을 사용한다. 없으면 드롭 훅은 기존 핵심 훅 구간 끝의 내장형 이벤트로, 순환 리프레인은 기존 Intro·핵심 훅·Outro 사이의 문구 회수로 처리한다.
  - Post-Chorus Tag는 독립 섹션을 새로 만들지 않고 현재 핵심 훅 구간 안에서 처리한다.
  - `터널 메아리`는 공간 질감, `메아리 응답 훅`은 가사·보컬 문답 구조로 분리한다.
- 범용성:
  - 미국·한국·유럽의 상업 작곡에서 공통적으로 쓰이는 단순성, 선공개, 반복·변형, 퍼포먼스 친화성, 다층 훅 개념을 구조 원칙으로만 일반화한다.
  - 특정 국가의 소재·언어·가수 스타일을 고정하거나 특정 아티스트를 모방하지 않는다.

### 4.33 Style Output Guard & Hook Trace Example

- 역할: Style Intent가 목적지에는 도착했지만 최종 영어 문법·섹션 방향·가사 줄바꿈이 깨지는 경우를 공개 출력 직전에 교정한다. 창작 내용을 다시 쓰는 엔진이 아니라 구조·문법·중복만 고치는 안전장치다.
- 위치:
  - `src/constants.ts`
  - `src/services/geminiService.ts`
- 음악 프롬프트 교정:
  - `Warm Amp`의 기존 저장 ID는 유지하되 최종 표현은 `warm guitar amp texture`로 고정해 만돌린 같은 다른 악기에 잘못 붙지 않게 한다.
  - `analog keys band mandolin`, `bassline band light percussion`, `snare roll band rising synths`처럼 악기 사이에 잘못 끼어든 `band`는 `and`로 복구한다.
  - `soften analog keys`는 `soft analog keys`, `synths chords`는 `synth chords`처럼 출력 문법만 정리한다.
  - `Funk groove`, `waltz-like flow`처럼 악기가 아닌 편곡 움직임은 `[Instruments]`에서 제외하고 `[Arrangement]`에 남긴다.
- 섹션 출력 교정:
  - 한 섹션 바로 아래의 로컬 프로덕션 큐는 가장 유효한 한 개만 남긴다.
  - Intro 아래에 `dissolves`, `fade out`, `Outro` 같은 종료 방향 큐가 잘못 들어오면 제거한다.
  - 여러 줄로 찢어진 섹션 태그를 한 줄로 복구하고, 한국어가 한두 음절 단위로 과도하게 잘린 경우 자연스러운 호흡 단위로 다시 묶는다.
  - 마지막에 몸통 없이 남은 `[Drop]`, `[Outro]` 같은 빈 구조는 제거한다.
- 후렴 라인 실제 적용 예시:
  - 선택: `반복되는 구호` + `중독성 있는 반복`.
  - Story Context에서 생성된 핵심 문구가 `여기 있어`라면, Chorus 1에서 처음 제시한다.
  - Chorus 2에서는 같은 핵심을 알아볼 수 있게 유지하면서 주변 한 줄이나 응답만 제한적으로 바꾼다.
  - Final Chorus에서는 `여기 있어 / 여기 있어`처럼 최소 두 번의 인식 가능한 반복, 또는 리드·응답·화음 강화로 보상한다. 이미 두 번 존재하면 검사기가 세 번째 문구를 억지로 추가하지 않는다.
  - 한국어와 외국어는 단어 번역을 복사하는 것이 아니라 같은 의미·배치·강화 곡선을 공유한다.
- 하드코딩 경계: 위의 `여기 있어`는 사용자 설명용 예시일 뿐 실제 결과 기본 문구가 아니다. 실제 훅 문장은 매 곡의 Story Context에서 새로 만든다.

## 5. 랩 모드 엔진

- 위치:
  - `src/services/generation/v1/sections/sectionBlueprint.ts`
  - `src/components/MusicApiGenerateModal.tsx`
  - `src/App.tsx`
- 동작:
  - OFF: Rap Section 없음
  - AUTO: 래퍼 역할 선택 시 Rap Section 자동 적용
  - ON: 래퍼가 없어도 Rap Section 강제 적용
- Stable: 화면에 표시된 `Intro → Verse 1 → Pre-Chorus 1 → Chorus 1 → Verse 2 → Pre-Chorus 2 → Chorus 2 → Bridge → Final Chorus → Outro`를 절대 변경하지 않는다. 래퍼가 선택되어도 `Verse 2` 라벨을 유지한 채 그 보컬이 리드미컬한 Verse 2를 담당한다. 실제 `Rap Section`이 필요하면 Recommended/Experimental/Custom을 사용한다.
- Recommended/Experimental: ON과 강한 랩 장르 조건에서만 더 강한 랩 구조를 허용한다.

## 6. 앱 공통 실행 엔진 5개

### 6.1 Gemini Generation Queue Engine

- 역할: 최대 2곡 동시 생성, 전체 작업함 최대 5곡을 관리한다.
- 위치: `src/App.tsx`

### 6.2 Generation Error Detail Engine

- 역할: 핵심 API 실패 사유를 작업칩에 저장하고 표시한다.
- 위치: `src/App.tsx`

### 6.3 Serialized Result Save Engine

- 역할: 동시 완료된 결과가 Firestore 최근 생성곡을 서로 덮어쓰지 않도록 저장 순서를 보호한다.
- 위치: `src/App.tsx`

### 6.4 Song Preview Engine

- 역할: 생성 전 선택 키워드가 Genre/Instruments/Atmosphere/Vocals/Arrangement/Lyrics에 어떻게 반영될지 화면용 설명으로 만든다.
- 위치: `src/services/songPreviewEngine.ts`

### 6.5 MusicNote Async Save Session Guard

- 역할: 수노 URL 저장처럼 시간이 걸리는 저장 요청이 완료될 때 사용자가 이미 닫은 Detail & Edit 창을 다시 열지 못하게 한다.
- 위치: `src/pages/FavoritesPage.tsx`
- 적용: 뮤직노트 수노 URL 저장·연결 해제.
- 원칙:
  - 창을 닫아도 서버 저장은 계속 완료한다.
  - 완료 결과는 현재 같은 곡의 상세창이 실제로 열려 있을 때만 화면 상태에 반영한다.
  - 비동기 함수가 가지고 있던 과거 `selectedSong` 값으로 팝업을 복원하지 않는다.

## 7. 하드코딩 허용 기준

허용:

- 태그 문법
- 섹션 이름과 구조
- 가창/비가창 구분
- 역할 우선순위
- 파싱, 길이, 저장, API 안전
- 사용자 직접입력 우선권

금지:

- 특정 장면이나 사물에 고정된 이야기
- 특정 감정 문장 강제 삽입
- 특정 테스트 결과만 고치는 오류 단어 목록
- 모든 장르에 같은 퍼포먼스 큐 삽입
- 예시 문구를 실제 결과 기본값으로 재사용

## 8. 향후 문서화 원칙

앱 사용자에게는 내부 파일명이나 검사 규칙을 모두 보여주지 않는다.
사용자 설명은 아래처럼 단순화한다.

> SORIDRAW는 선택한 장르·분위기·주제·보컬을 하나의 Story Context로 정리한 뒤, 곡 전체 Arrangement와 섹션별 보컬 연출을 함께 설계합니다. 각 섹션은 같은 곡의 정체성을 유지하면서도 서로 다른 에너지와 전달 방식을 갖도록 생성됩니다.

개발자용 문서는 이 파일을 기준으로 유지하고, 엔진을 추가·삭제·이동할 때 반드시 함께 갱신한다.

## 9. 40차 Stable Structure Hard Lock

- Stable은 사용자에게 보이는 정확한 10개 섹션 계약이다. 장르, 래퍼 역할, Rap AUTO/ON 때문에 `Verse 2`를 `Rap Section`으로 바꾸지 않는다.
- Gemini가 일부 섹션 태그를 누락해도 빈 줄로 구분된 실제 가사 문단을 순서대로 복구하여 누락된 Stable 태그에 다시 배치한다. 이 보정은 가사 문장을 새로 만들지 않고 구조 태그만 복원한다.
- Stable 결과의 실제 태그 순서가 예상 순서와 다르면 V1 catastrophic structure failure로 판정해 1회 구조 복구를 실행한다.
- 최종 공개 결과는 Stable 10개 섹션 이외의 `Rap Section`, `Drop`, 추가 Chorus를 임의로 노출하지 않는다.

## 10. 41·42차 후렴 실험본 상태

- 41차와 42차는 후렴 기능을 빠르게 확장한 실험본이다.
- 계획 생성과 실제 가사 검증, 솔로/다인 보컬 조건, 보컬 레이어 역할이 완전히 분리되지 않아 활성 기준에서 제외한다.
- 43차는 42차 위에 계속 덧붙이지 않고 40차 Stable Structure Hard Lock을 기준으로 후렴 엔진만 다시 구축한다.

## 11. 43차 보컬 레이어 + 후렴 라인 재구축

### 메뉴 역할 분리

- 사운드의 `보컬 효과` 표시명은 `보컬 레이어`로 변경한다. 내부 ID `vocal-effects`는 과거 저장값 호환을 위해 유지한다.
- 보컬 레이어는 허밍, 합창, 챈트, 화음, 샤우트, 보컬 샘플처럼 메인 보컬 위에 추가되는 목소리 층만 담당한다.
- 후렴 라인은 핵심 훅 문장, 배치, 반복 곡선, 가창 관계, 후렴 구조만 담당한다.
- 보컬 레이어만 선택했다고 콜앤리스폰스 가사를 임의로 만들지 않고, 후렴 라인만 선택했다고 존재하지 않는 합창단이나 두 번째 가수를 만들지 않는다.

### 후렴 라인 21개

- 훅 형태: `짧은 훅 반복`, `반복되는 구호`, `한 줄 훅`, `한 단어 훅`, `멜로디 훅`.
- 훅 배치: `후렴 첫줄 앵커`, `후렴 끝줄 앵커`, `훅 선공개`, `포스트코러스 태그`, `순환 리프레인`.
- 반복 방식: `고정 후렴`, `점층 반복`, `변형 반복`.
- 가창 구조: `챈트 훅`, `콜앤리스폰스 훅`, `메아리 응답 훅`, `따라 부르는 후렴`.
- 후렴 구조: `A/B 분할 후렴`, `드롭 훅`, `안티코러스`, `여백 훅`.

### 제거·이동·호환

- 중복 또는 결과 목표형 메뉴 `중독성 있는 반복`, `캐치한 훅`, `귀에 남는 후렴`, `후렴 강조`, `후렴 전환감`, `후렴 폭발`, `훅 중심 전개`는 가장 가까운 현재 기능이나 전환 연출로 별칭 복원한다.
- `떼창 포인트`는 후렴 문장 기능이 아니라 보조 보컬 편성이므로 `보컬 레이어 > 그룹 챈트`로 이동한다.
- 새 UI에는 21개만 표시하지만 과거 저장 ID는 삭제하지 않고 별칭/이동 테이블로 복원한다.

### 보컬 조건

- 솔로 단독: 챈트, 한 줄/한 단어 훅, 따라 부르는 후렴 등 단일 보컬 기능 사용 가능.
- 콜앤리스폰스: 2인 이상 보컬 또는 `그룹 챈트`, `관객 챈트`, 합창 계열 같은 응답형 보컬 레이어가 있어야 사용 가능.
- 조건이 맞지 않으면 선택 단계에서 안내하고, 복원된 과거 데이터에서는 `보컬 조건 미충족`으로 표시한다. 두 번째 보컬을 몰래 생성하지 않는다.
- 콜앤리스폰스는 의미가 다른 호출/응답과 명시적 응답 주체 큐가 모두 있어야 통과한다. 괄호 속 반복만으로 통과하지 않는다.
- 메아리 응답은 핵심 훅의 짧은 일부를 되받는 별도 기능이며 콜앤리스폰스의 응답으로 계산하지 않는다.

### 생성·검사 계약

- 21개 선택값은 하나의 Story Context를 공유하되, 각 기능의 필드와 검사는 분리한다.
- `한 단어 훅`은 독립된 반복 줄, `짧은 훅 반복`은 Chorus 시작 동일 문장 2회, `훅 선공개`는 첫 Pre-Chorus의 짧은 조각으로 검사한다.
- `따라 부르는 후렴`은 짧은 문장뿐 아니라 문법적으로 완결된 훅이어야 한다. `When I close my eyes it all`처럼 끝나지 않은 영어 종속절은 실패한다.
- 멜로디, 챈트의 실제 타격감, 안티코러스의 실제 다이내믹, 여백의 실제 공간감은 텍스트 검사와 `음원 확인`을 분리한다.
- 적용된 키워드 안의 `후렴 설계`에는 설계 생성, 실제 가사 적용, 보컬 조건, 구조 미포함, 음원 확인을 서로 다른 상태로 보여준다.

### 구조·데이터 안전

- 40차 Stable 구조 `Intro → Verse 1 → Pre-Chorus 1 → Chorus 1 → Verse 2 → Pre-Chorus 2 → Chorus 2 → Bridge → Final Chorus → Outro`를 그대로 유지한다.
- Stable에 없는 Drop/Post-Chorus/Refrain 섹션 태그는 새로 만들지 않는다. 드롭 훅은 첫 번째 적합한 핵심 구간(안정형은 Chorus 1) 끝부분에 한 번 내장하고, 순환 리프레인은 Intro·Chorus·Final Chorus·Outro의 기존 구간에서 같은 문구를 회수한다. 핵심 적용 대상 자체가 없을 때만 `적용 대상 부족`으로 표시한다.
- 직접작사 원문 유지 모드는 후렴 가드가 가사를 수정하지 않는다.
- Firestore, Auth, Functions, 뮤직노트 저장 구조는 변경하지 않는다.

### 변경 위치

- `src/constants.ts`
- `src/services/geminiService.ts`
- `src/types.ts`
- `src/App.tsx`
- `src/services/generation/README.md`
- `docs/SORIDRAW_ENGINE_MAP.md`

## 12. 45차 고정 후렴 + 후렴 가사 발전 계약

- V1의 기본 후렴은 `핵심 훅 유지 + 주변 가사 발전`이다. Chorus 1 전체를 Chorus 2와 Final Chorus에 그대로 복사하지 않는다.
- Chorus 2는 Verse 2 이후 달라진 상황·행동·인식을 주변 가사 한 줄 이상에 반영하고, Final Chorus는 Bridge의 전환이나 감정 결론을 주변 가사 한 줄 이상에 반영한다.
- `한 줄 훅`은 중심 문장 한 줄만, `후렴 첫줄 앵커`는 첫 줄만, `후렴 끝줄 앵커`는 마지막 줄만 고정한다. 나머지 후렴 가사는 계속 발전한다.
- 전체 후렴 가사를 동일하게 반복하는 방식은 별도 메뉴 `고정 후렴`에서만 허용한다. 이때 Chorus 1의 가창 본문을 Chorus 2와 Final Chorus에 그대로 복원하되, 섹션 태그·사운드 큐·보컬 레이어·화음·애드리브·편곡 강도는 달라질 수 있다.
- 같은 Gemini 호출의 Hook Blueprint가 한글/보조 언어별 `Chorus 2 변화 줄`과 `Final Chorus 변화 줄`을 함께 반환한다. 생성 결과가 거의 동일한 후렴으로 수렴하면 최종 가드가 고정 대상이 아닌 주변 문장 하나를 해당 변화 줄로 교체한다. 별도 Gemini 재호출은 하지 않는다.
- 직접작사 원문 유지 모드는 이 가드의 수정 대상에서 제외한다. Stable 10개 섹션 구조는 그대로 유지한다.

## 46차 후렴 설계 표시값 결정화
- 적용된 키워드의 `후렴 설계` 요약값은 Gemini가 자유롭게 만든 영어 메모를 그대로 표시하지 않는다.
- `적용 위치 / 가사 반복 / 훅 호흡 / 가창 구조`는 실제 선택된 후렴 기능과 보컬 조건에서 코드가 결정적으로 계산한다.
- `고정 후렴` 단독 선택 시 `Chorus 1 · Chorus 2 · Final Chorus`, `Chorus 1 전체 가사 = Chorus 2 = Final Chorus`만 표시하며, 선택하지 않은 리듬·가창 계획은 숨긴다.
- supersaw, chord burst 같은 편곡 문구가 `가창 계획`에 섞이거나 centered payoff, fixed identity 같은 모호한 모델 문구가 노출되는 것을 차단한다.

## 47차 공통 핵심 구간 역할 엔진

### 구조 이름이 아니라 역할로 연결

- 신규 모듈: `src/services/generation/v1/sections/hookRoleEngine.ts`.
- 현재 V1 섹션 블루프린트를 읽어 핵심 훅 체인을 `Chorus`, `Hook`, `Refrain`, `Main Theme`, `Theme → Climax` 중 하나로 해석한다.
- 같은 후렴 라인 기능이 안정형에서는 Chorus 계열, 랩 구조에서는 Hook/Final Hook, 시네마틱 구조에서는 Main Theme 또는 Theme/Climax, 서사 구조에서는 Refrain 계열을 따라간다.
- 실제 섹션 이름과 중복 순서를 `Chorus 1 · Chorus 2 · Final Chorus`처럼 표시용 라벨로 따로 관리한다.

### 모드별 구조 안전

- 안정형: 정확한 10개 섹션을 유지한다. `[Drop]`, `[Refrain]`, `[Post-Chorus]`를 새로 만들지 않는다.
- 추천·실험형: 선택된 구조에 실제 Drop·Refrain·Final Hook·Climax가 있으면 해당 구간을 사용한다.
- 커스텀: 사용자가 만든 순서와 태그를 그대로 보존한다. Hook/Refrain/Drop이 있으면 그 위치를 사용하고, 핵심 훅 계열이 전혀 없으면 임의 섹션을 만들지 않고 `적용 대상 부족`으로 판정한다.

### 드롭 훅

- 실제 `[Drop]`이 있는 구조: 해당 Drop에 짧은 훅과 Drop 큐를 배치한다.
- 실제 Drop이 없는 구조: 첫 번째 적합한 핵심 훅 구간 끝에 `[brief beat drop under the vocal hook]`와 짧은 훅을 한 번 넣는 내장형 드롭으로 처리한다.
- 안정형에서는 이 내장형 방식만 사용하므로 10개 섹션 계약이 깨지지 않는다.

### 순환 리프레인

- 실제 Refrain이 반복되는 구조: 기존 Refrain들을 우선 사용한다.
- Refrain이 없는 안정형 등: 같은 핵심 문구를 Intro에서 예고하고, 핵심 훅 구간들에서 완성·반복한 뒤 Outro에서 회수한다.
- `[Refrain]` 섹션을 새로 만들지 않으며 `짧은 훅 반복`이나 `한 단어 훅`과 조합할 수 있다. 전자는 한 구간 안의 반복 형태이고, 순환 리프레인은 서로 떨어진 구간 사이의 배치 방식이다.

### 공통 생성·검사·표시

- 고정 후렴, 기본 후렴 발전, 첫줄/끝줄 앵커, 훅 선공개, 드롭 훅, 순환 리프레인이 모두 동일한 역할 계획을 사용한다.
- 상태는 `적용`, `실패`, `보컬 조건 미충족`, `비교 대상 없음`, `음원 확인`, `적용 대상 부족`으로 분리한다.
- 적용된 키워드의 후렴 설계에는 코드가 계산한 `구조 모드`, `핵심 적용 구간`, `구조 조건`, `보컬 조건`만 노출한다.
- 직접작사 원문 유지, Gemini 호출 횟수, Firestore/Auth/Functions/저장 구조는 변경하지 않는다.

### 47차 내부 검사

- 안정형: 내장형 드롭 훅, Intro→Chorus→Final Chorus→Outro 순환 리프레인, 10개 구조 보존.
- 추천 댄스: 실제 Drop 사용. 추천 서사: 실제 Refrain 순환. 추천 시네마틱: Theme A에서 Climax까지 연결. 실험형 댄스/시네마틱도 실제 Drop과 Theme→Climax 역할 체인을 유지.
- 커스텀: Hook→Drop→Final Hook 순서 보존, 고정 훅 복사, 사용자 고유 섹션명을 구조 경계로 보존, 핵심 구간 없는 구조의 `적용 대상 부족` 판정.
- 21개 공개 후렴 라인 기능의 단독 계약과 안정형·추천·실험형·커스텀 연결을 결정적 코드/가드 단위로 검사한다. 실제 Gemini 생성과 Suno 음원 체감 검사는 별도로 진행한다.

## 48차 드롭 훅·순환 리프레인 출력 형식 보정

- 여러 줄로 깨진 `[Verse 1 : ...]`, `[Pre-Chorus 1 : ...]` 같은 구조 태그를 최종 출력 전에 한 줄로 복구한다.
- 한두 음절 단위로 연속 분할된 한국어 가사만 병적인 줄바꿈으로 판단해 읽을 수 있는 프레이즈로 재배치한다. 일반적인 짧은 훅은 유지한다.
- 순환 리프레인은 핵심 문구가 인접한 두세 줄로 갈라져 있어도 같은 문구로 인식한다. 정확히 분할된 핵심 문구는 한 줄로 다시 합쳐 표시한다.
- 안정형 내장 드롭 훅의 `[brief beat drop under the vocal hook]`는 Chorus 상단으로 이동하지 않고, 담당 훅 바로 앞에 붙는다. 빈 줄로 큐와 훅이 분리되지 않는다.
- 후렴 가사 발전 보정은 가창 줄만 제자리 교체하므로 섹션 중간·끝의 사운드 큐 위치를 바꾸지 않는다.
- 중복 Intro와 본문 없는 마지막 Outro 태그를 최종 공개 경계에서 한 번 더 제거한다.
- Gemini 추가 호출, 구조 추가, Firebase/Auth/Firestore/Functions 및 저장 데이터 변경은 없다.

## 49차 내장형 드롭 블록·가사 줄 보존 보정

- 안정형 내장 드롭 훅은 모든 후렴·섹션·퍼포먼스 보정이 끝난 최종 공개 출력 경계에서 위치를 확정한다.
- Gemini가 `[brief beat drop under the vocal hook]`를 Chorus 상단에 먼저 생성해도 해당 큐를 제거한 뒤 Chorus 1 마지막 반복 훅 바로 앞으로 이동한다.
- 최종 형태는 `기존 Chorus 가사 → 드롭 큐 → 반복 훅`이며 큐와 훅 사이에 빈 줄을 허용하지 않는다.
- 드롭 훅 검사는 큐가 Chorus 안 어딘가에 존재하는지만 보지 않는다. 마지막 반복 훅의 바로 앞 줄에 큐가 붙어 있어야 성공한다.
- 여러 후렴 기능을 함께 선택했을 때 각 검사를 독립적으로 유지한다. 예를 들어 순환 리프레인은 성공하고 드롭 훅 위치가 틀리면 `순환 리프레인 ✓ / 드롭 훅 ✕`로 판정한다.
- 기존의 한국어 24자 기준 강제 분할을 제거한다. Gemini가 생성한 가사 한 줄은 원칙적으로 그대로 보존하고, 병적으로 한두 단어씩 연속 분할된 구간만 한 줄로 복구한다. 복구한 문장을 다시 글자 수로 쪼개지 않는다.
- 안정형 10개 구조, 공통 핵심 구간 역할 엔진, 직접작사 원문 유지, Gemini 호출 횟수, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않는다.

## 50차 V1 절대 최종 반환 경계

- 실제 문제 원인은 49차의 드롭 훅 위치 보정 이후, 공개 `generateSong()` 래퍼가 강한 금지어 처리와 섹션 구조 보정을 다시 실행하면서 드롭 큐를 Chorus 상단으로 되돌린 것이었다.
- 최종 순서를 `강한 금지어 처리 → 구조 안전 보정 → 섹션 블루프린트 보정 → 공개 출력 정리 → 내장형 드롭 훅 절대 슬롯 고정 → 실제 반환 가사 검사`로 고정한다.
- 안정형 내장 드롭 훅은 Chorus 1의 마지막 두 비어 있지 않은 줄을 반드시 `[brief beat drop under the vocal hook]`와 반복 훅으로 만든다. 앞쪽에 있던 동일 큐는 모두 제거하고, 이 단계 뒤에는 가사를 수정하는 보정기가 실행되지 않는다.
- Hook Blueprint의 내부 계약은 최종 반환 경계까지만 임시로 유지하고 공개 결과 직전에 삭제한다. 적용된 키워드의 후렴 설계 상태는 최종 반환되는 한글/보조 언어 가사로 다시 계산한다.
- 따라서 `순환 리프레인 ✓ / 드롭 훅 ✕`처럼 실제 최종 가사와 일치하는 독립 판정이 가능하며, 잘못 배치된 중간 결과를 초록색으로 표시하지 않는다.
- Gemini 추가 호출, 안정형 10개 구조, Firebase/Auth/Firestore/Functions, 저장 구조 및 기존 사용자 데이터는 변경하지 않는다.

## 68차 언어 혼합 품질 복구

### 유지하는 것

- 67차 기준의 UI·디자인·언어 선택·혼합 비율 선택·생성 모달·저장 구조를 그대로 유지한다.
- 안정형 누락 섹션 복구와 공개 섹션 이름 봉인은 `sectionGuard.ts`에 남긴다. 이 기능은 기존 가사를 다른 언어 문장으로 교체하지 않는다.
- V1의 Story Context, Section Blueprint, Section Performance Plan, Hook Blueprint, 강한 금지어 처리, 최종 공개 출력 안전 경계는 유지한다.

### 제거한 실행 파일

- `src/services/generation/v1/language/index.ts`
- `src/services/generation/v1/language/languageArrangementDirector.ts`
- `src/services/generation/v1/language/languageMixEngine.ts`
- `src/services/generation/v1/sections/oneWordHookGuard.ts`

### 현재 가사 생성 순서

```text
사용자 언어·혼합 비율 선택
→ Gemini 최초 통합 호출에서 Story Context 기준 최종 가사 작성
→ 기존 V50의 치명적 빈 섹션 복구·금지어·태그·공개 출력 안전 처리
→ 언어 비율을 위한 문장 교체 없이 반환
```

### 삭제한 동작

- 고정 외국어 문구 삽입과 언어별 fallback 문장 목록
- 가사 카드별 18~44개 대체 문장 Blueprint 생성
- 줄 단위 언어 교체와 반복 수렴
- 훅 재결합 뒤 두 번째 언어 비율 보정
- 실패 카드의 추가 Gemini 정밀 보정 호출
- 언어 비율을 맞추기 위한 Hook Blueprint 카드 교환
- 한 단어 훅을 언어 비율 계산과 결합하는 전용 후처리

### 현재 언어 비율 원칙

- 선택 비율은 곡 전체의 대략적인 창작 방향이다. 정확한 줄 수·단어 수 통과 조건이 아니다.
- 비율과 품질이 충돌하면 Story Context, 인물 말투, 자연스러운 문장, 섹션 흐름, 훅 정체성, 가창성을 우선한다.
- 서로 같은 뜻의 인접 번역 줄, 다른 언어 표면을 이용한 훅 중복, 비율 채우기용 filler를 생성 지시에서 금지한다.
- 구체적인 가사 단어·문장 예시는 생성 프롬프트에 넣지 않는다. 섹션 태그처럼 형식만 설명하는 예시는 콘텐츠 하드코딩으로 보지 않는다.

### 데이터·배포 영향

- Firebase Auth, Firestore, Functions, Rules, 환경변수, 저장 문서 구조를 변경하지 않는다.
- 기존 곡 데이터는 그대로 읽는다. `languageMixAudit` 값이 없는 새 결과에서는 기존 검사 UI가 표시되지 않는다.

## 69차 순환 리프레인 절대 최종 반환 보정

- 원인은 순환 리프레인 역할 계산이 아니라 실행 순서였다. 순환 문구는 중간 단계에서 배치됐지만,
  이후 강한 금지어 처리·구조 안전 보정·섹션 퍼포먼스 계획·공개 출력 정리를 다시 거쳤고,
  절대 최종 반환 경계에서는 드롭 훅만 재고정되고 있었다.
- 최종 V1 반환 경계에서 `순환 리프레인`이 실제 선택된 경우에만 현재 곡의 Hook Blueprint가 만든
  핵심 문구를 다시 검사한다. 특정 가사 단어·문장·예시를 코드에 넣지 않는다.
- `hookRoleEngine.ts`가 이미 선택한 기존 Intro/Refrain/핵심 훅/Outro 구간만 대상으로 하며,
  누락된 문구만 복구한다. 새로운 `[Refrain]`, `[Chorus]`, `[Intro]`, `[Outro]` 태그를 만들지 않는다.
- Refrain·핵심 훅 구간은 가창 문구로, Intro·Outro 같은 예고/회수 구간은 괄호형 문구로 복구한다.
  이미 같은 문구가 있거나 인접 줄에 걸쳐 존재하면 중복 삽입하지 않는다.
- 순환 리프레인 재검사 뒤 기존 내장형 드롭 훅 절대 슬롯 보정을 실행하므로,
  드롭 훅의 `큐 → 반복 훅` 마지막 두 줄 계약은 그대로 유지한다.
- 순환 리프레인을 선택하지 않은 곡, 직접작사 원문 유지, 다른 후렴 라인 기능, UI·디자인,
  Firebase/Auth/Firestore/Functions, 저장 구조, Gemini 호출 횟수에는 변화가 없다.

## 70차 언어 혼합 비율 계약 복구

- 68차 품질 롤백에서 함께 약해졌던 **최초 작사 단계의 언어 혼합 비율 계약**만 복구한다. 문장 교체형 언어 엔진은 되살리지 않는다.
- UI의 10%·20%·30%·40%·50%·60%·70%를 각각 독립적인 목표값으로 Gemini에 전달한다. 몇 개의 넓은 단계로 합치지 않는다.
- 비율은 실제 가창 가사 줄만 계산한다. 구조 태그와 독립 사운드·프로덕션 큐는 제외하며, 의미 있는 대상 언어 구절이나 짧은 완결 가사 생각이 있는 줄만 혼합 줄로 인정한다.
- 최초 Gemini 통합 호출에서 전체 가사를 처음부터 혼합 비율에 맞춰 작성한다. 고정 가사 예시, 고정 번역문, 대체문 후보, 줄 단위 교체, 반복 수렴은 사용하지 않는다.
- 스크립트가 구분되는 언어 조합은 생성 직후 읽기 전용으로 측정한다. 전체 줄 수에서 한 줄이 차지하는 비율을 고려한 허용 오차를 벗어난 경우에만 해당 가사 카드 전체를 최대 1회 다시 작성한다.
- 재작성은 Story Context, Hook Blueprint, 보컬 소유권, 섹션 순서·개수, 대략적인 줄 수를 고정한 상태에서 실행한다. 기존 구조와 정확히 호환되고 목표 비율에 더 가까워진 결과만 채택한다.
- 영어·스페인어처럼 같은 문자 체계를 쓰는 조합은 코드가 언어를 오판해 문장을 강제 교체하지 않는다. 이 경우 최초 생성 계약을 우선한다.
- 69차 순환 리프레인 절대 반환 보정, 드롭 훅, 다른 후렴 라인 기능, UI·디자인, Firebase/Auth/Firestore/Functions, 저장 구조는 변경하지 않는다.

## 71차 언어 혼합 섹션 골격 잠금

- 70차의 전체 가사 1회 비율 재작성에서 섹션 순서만 같으면 전체 줄 수를 섹션 사이에서 옮길 수 있었던 허점을 막는다. 이 허점 때문에 Verse·Chorus가 짧아지고 Outro가 새로운 Verse처럼 길어질 수 있었다.
- 최초 생성 가사에서 각 섹션의 실제 가창 줄 수를 동적으로 추출해 재작성 계약으로 전달한다. 고정 줄 수나 특정 가사 예시는 사용하지 않으며, 현재 곡이 만든 섹션 골격 자체가 기준이다.
- 재작성 결과는 기존 섹션 순서·개수뿐 아니라 섹션별 가창 줄 수도 정확히 같아야 채택한다. 마지막 섹션 뒤의 무소속 가사, 섹션 병합·분리·추가·삭제도 실패 처리한다.
- 기존 Section Role Engine 검사를 함께 사용해 재작성 전에는 없던 `Outro 서사 재시작`, `Intro 과대 전개`, `Final Chorus 축소`, `compact 구간 과대 전개` 같은 역할 오류가 생기면 결과를 폐기한다.
- 비율이 더 정확해져도 섹션 골격을 훼손한 후보는 사용하지 않고 최초 가사를 유지한다. 언어 비율 보정은 가사의 언어만 바꿀 수 있으며 섹션 구조를 다시 설계할 권한은 갖지 않는다.
- 69차 순환 리프레인, 내장형 드롭 훅, 다른 후렴 라인 기능, UI·디자인, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않는다.

## 72차 언어 혼합 품질 우선 회귀 수정

- 언어 혼합이 0%로 반환된 직접 원인은 71차의 과도한 재작성 후보 폐기 조건이었다. 섹션별 가창 줄 수가 한 줄만 달라도 후보를 버리고, 언어 혼합과 무관한 역할 경고까지 새로 생기면 후보를 모두 폐기해 최초 단일언어 가사가 그대로 반환됐다.
- 과거의 전체 가사 단위 언어 혼합 방식은 유지한다. 최초 Gemini가 전체 가사를 자연스럽게 혼합해 작성하고, 선택 언어가 완전히 빠지거나 심하게 부족할 때만 전체 가사 카드를 최대 1회 다시 작성한다.
- 10%·20%·30%·40%·50%·60%·70%는 서로 구분되는 근사 방향값이다. 정확한 수학 비율보다 Story Context, 자연스러운 문장, 섹션 역할, 훅 정체성, 가창성을 우선한다.
- 71차의 섹션별 정확한 줄 수 잠금은 제거한다. 기존 섹션 순서·개수와 전체 길이 범위는 유지하고, Intro/Outro 과대 전개, Final Chorus 축소, Refrain 정체성 손상, compact 구간 과대 전개처럼 실제 구조를 망가뜨리는 핵심 오류만 차단한다.
- 특정 언어 문장·고정 번역·줄 단위 교체·비율 수렴·새 섹션 생성은 사용하지 않는다. UI, 순환 리프레인, 드롭 훅, Firebase/Auth/Firestore/Functions 및 저장 구조는 변경하지 않는다.

## 73차 — Section Blueprint final structural ownership

### 원인
- V1 Section Blueprint Guard가 먼저 정확한 구조를 만들더라도, 이후 공개 출력 정리기가 반복 섹션 숫자를 내부 매칭용 기본 이름으로 평탄화했다.
- 언어 혼합 재작성 검사가 활성 Blueprint가 아니라 최초 가사의 구조만 비교하여, 최초 가사부터 Bridge 등이 누락되면 같은 오류를 유지한 재작성도 통과할 수 있었다.
- 기존 V1 전체 가사 복구는 복구 후 정확한 Blueprint 충족 여부를 최종 합격 조건으로 다시 확인하지 않았다.

### 수정
- 절대 반환 경계 순서를 `공개 정리 → Section Blueprint Guard → 순환 리프레인/드롭 훅 고정`으로 변경한다.
- Recommended/Stable/Experimental은 재작성 결과가 현재 활성 Blueprint의 섹션 개수·순서를 충족해야 한다.
- Custom도 현재 구조의 표준 반복 섹션을 1부터 순서대로 번호화한 Blueprint와 정확히 비교한다. 사용자 정의 비표준 섹션 이름은 그대로 유지한다.
- 필수 섹션이 실제로 누락되면 전체 가사를 다시 쓰지 않고 누락된 섹션의 본문만 1회 생성하여 정확한 위치에 삽입한다.
- 기존 가사, 훅, 보컬 소유권, 사운드 큐, 언어 혼합 방식과 근사 비율은 유지한다.
- `Verse 1`, `Verse 2` 및 자동 번호가 붙는 반복 섹션은 Blueprint의 실제 이름 그대로 최종 출력한다.

### 영향 범위
- `src/services/geminiService.ts`
- `src/services/generation/v1/sections/sectionGuard.ts`
- 언어 혼합 창작 방식, UI, Firebase/Auth/Firestore/Functions, 저장 구조에는 영향 없음.



## 76차 — 전체 모드 섹션 번호·소유권 확정

### 번호 규칙
- 추천형·안정형·실험형·커스텀 모두 `Verse`, `Pre-Chorus`, `Chorus`, `Hook`, `Refrain`, `Rap Section`에 1부터 순서대로 번호를 붙인다. 한 번만 등장해도 `Verse 1`, `Chorus 1`처럼 표시한다.
- Intro, Bridge, Final Chorus, Outro처럼 고유 역할인 섹션은 번호를 붙이지 않는다. Verse·Pre-Chorus·Chorus·Hook·Refrain·Rap Section은 한 번만 등장해도 1부터 번호를 붙여 섹션 소유권을 명확히 한다.
- 안정형 고정 구조는 `Intro → Verse 1 → Pre-Chorus 1 → Chorus 1 → Verse 2 → Pre-Chorus 2 → Chorus 2 → Bridge → Final Chorus → Outro`이다.

### 구조 오염 원인과 차단
- 과거에는 번호 없는 세 번째 `[Chorus]`가 남은 같은 계열 슬롯인 Final Chorus로 잘못 매칭되거나, 알 수 없는 블록이 가장 가까운 Chorus 2·Bridge·Outro에 합쳐질 수 있었다.
- 이제 일반 Chorus와 Final Chorus는 서로 다른 소유권으로 취급한다. 번호 없는 입력은 다음 비어 있는 동일 계열 번호 슬롯에만 순차 배정하며, 남는 중복 블록은 다른 섹션으로 옮기지 않는다.
- 빈 줄 문단을 Verse/Pre-Chorus/Chorus로 추측해 분리하는 복구와, 누락된 반복 섹션에 이웃 가사를 복사하는 복구를 중단한다. 누락 본문은 기존 전용 누락 섹션 생성 단계만 처리한다.
- 언어 혼합 재작성과 최종 치명 구조 검사는 평탄화된 `Chorus` 계열명이 아니라 실제 `Chorus 1`, `Chorus 2` 순서를 검사한다. V2 공개 정리기도 같은 번호 규칙을 사용해 정상 번호를 제거하지 않는다.

### 안전 범위
- 특정 가사 문장, 장면, 언어 예시, 고정 줄 수를 넣지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수와 저장 문서 구조는 변경하지 않는다.

## 77차 — 가사 줄바꿈·Outro·섹션 밀도·최종 클리셰 안전 경계

### 줄바꿈과 메아리 표기
- Gemini가 만든 가창 줄바꿈을 후렴의 리듬 구조로 인정한다. 짧은 훅·챈트·응답 줄이 연속된다는 이유만으로 한 문장에 합치지 않는다.
- 기존 한국어 분절 복구기는 잘못 열린 여러 줄 대괄호 큐만 복구하며, 가창 본문은 이동하거나 합치지 않는다.
- 줄 전체가 이중 괄호로 감싸진 메아리 응답은 최종 훅 비교 전에 한 겹으로 정규화한다.

### Outro와 전개 섹션 밀도
- 일반 보컬곡의 Outro는 짧은 마무리 가사·애드리브·회수 문구 중 하나를 가져야 한다.
- 사용자가 Outro를 연주 전용·무가사·무보컬로 직접 요청한 경우에만 빈 가사 Outro를 허용한다.
- Verse·Rap Section 중 하나가 같은 계열의 다른 구간보다 심하게 빈약하고 사용자가 의도적으로 한 줄 구간을 요청하지 않았다면, 전체 곡을 다시 쓰지 않고 해당 섹션 본문만 제자리에서 1회 보완한다.
- 고정 줄 수나 특정 가사 예시는 사용하지 않고 현재 곡 내부의 같은 역할 구간을 상대 기준으로 판단한다.

### 관리자·사용자 클리셰 최종 차단
- 관리자와 사용자가 등록한 1순위 금지어는 최종 Section Blueprint와 Hook Blueprint가 모두 적용된 실제 공개 가사를 기준으로 다시 검사한다.
- 금지어 정리 뒤 과거 훅 문구를 재결합하지 않아, 이미 제거한 표현이 마지막 단계에서 다시 들어오는 경로를 차단한다.
- 1순위 금지어 정리에 실패하면 원본을 조용히 반환하지 않고 생성 재시도를 요구한다. 품질 보완 실패보다 금지어 유출 방지를 우선한다.

### 안전 범위
- 특정 가사 문장, 장면, 대체문 목록, 고정 섹션 줄 수를 넣지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수와 저장 문서 구조는 변경하지 않는다.

## 78차 — 섹션 보완 실패의 생성 실패 전환 차단

### 원인
- 77차에서 한 줄 Verse 같은 상대적 밀도 문제를 `치명적 구조 실패`에 포함했다.
- 해당 섹션만 1회 보완한 뒤에도 Gemini가 짧게 유지하면, 제목·프롬프트·나머지 가사가 정상이어도 최종 반환 단계에서 곡 전체를 실패 처리했다.
- 클리셰 교정 뒤 전체 빈 섹션 정리기를 다시 실행하면서 이미 확정된 번호 섹션 태그를 제거할 수 있는 중복 경로도 있었다.

### 수정
- Verse·Rap Section의 상대적 밀도 부족은 품질 보완 대상으로만 유지하고 치명 오류에서 제외한다.
- 해당 섹션 본문만 최대 1회 보완하며, 보완 후에도 짧으면 기존 완성곡을 반환한다. 전체 가사 재작성과 생성 실패로 확대하지 않는다.
- 최종 클리셰 교정은 가사 본문 줄만 바꾸므로, 이후에는 번호 섹션 구조를 다시 파괴적으로 정리하지 않는다.
- 최종 구조 경고는 기록하되 완성된 곡을 폐기하지 않는다.

### 유지 범위
- `Verse 1/2`, `Pre-Chorus 1/2`, `Chorus 1/2` 번호 소유권, 필수 섹션 보완, Outro 보완 시도, 클리셰 최종 검사, 언어 혼합 방식은 그대로 유지한다.
- 특정 가사 문장·장면·고정 줄 수·대체 문장 목록을 추가하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수 및 저장 구조는 변경하지 않는다.

## 79차 — 커스텀 구조 섹션 퍼포먼스 엔진 일원화

### 원인
- 커스텀 구조는 번호·순서 Blueprint는 사용했지만, 최종 `Section Performance Plan` 적용과 퍼포먼스 큐 검사를 조기 종료했다.
- 그래서 같은 커스텀 구조라도 Gemini가 처음부터 태그를 잘 작성한 곡은 정상처럼 보이고, `[Verse 1]`, `[Chorus 1]`처럼 빈 퍼포먼스 태그를 반환한 곡은 그대로 공개됐다.
- 다중 보컬의 Main/Lead/Rap 역할 소유권과 Final Chorus 공유 보컬 검사도 커스텀에서 제외되어 기본 구조보다 결과 편차가 컸다.

### 수정
- 커스텀 구조도 기본 구조와 같은 공유 Section Performance Plan을 최종 가사에 적용한다.
- 실제 가사 본문이 있는 모든 가창·애드리브 섹션은 현재 곡에서 생성된 짧은 퍼포먼스 큐를 가지며, 다중 보컬은 활성 보컬 앵커를 유지한다.
- 사용자 정의 비표준 섹션명은 고정 이름 목록으로 판단하지 않고 현재 커스텀 Blueprint의 `allowsLyrics`와 `kind`를 기준으로 처리한다.
- Stop·Break·Instrumental·Interlude 같은 전환/연주 구간은 가창 큐 강제 대상에서 제외하고 기존 무가사 소유권을 보호한다.
- 커스텀에서도 Main/Lead/Rap 담당과 Final Chorus 공유 보컬을 검사하되, 사용자가 특정 보컬 담당을 직접 지정한 경우 기존 사용자 우선 필터를 그대로 적용한다.

### 유지 범위
- 커스텀 섹션 순서, 번호, 사용자 정의 이름, 명시적 태그, 가사 본문과 훅은 재설계하지 않는다.
- 특정 퍼포먼스 문구·고정 보컬 배정·가사 예문을 하드코딩하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수 및 저장 구조는 변경하지 않는다.

## 80차 — 섹션 보컬 큐·악기 큐 독립 표시 토글

### UI와 기본값
- 섹션 구조 바로 아래에 `보컬 큐`, `악기 큐` 두 개의 독립 토글을 둔다. 화면에는 이름과 ON/OFF 버튼만 표시하고 자세한 설명은 기존 도움말 팝업에서 제공한다.
- 기존 사용자와 저장본 호환을 위해 값이 없으면 둘 다 ON으로 해석한다. 템플릿 적용, 이전 곡 설정 재적용, 가사 재생성에도 같은 선택값을 복원한다.

### 4가지 출력 조합
- ON / ON: 섹션 태그의 보컬 표현 큐와 독립 악기·편곡 큐를 모두 표시한다.
- ON / OFF: 보컬 표현 큐만 표시하고 독립 악기·편곡 큐 줄은 숨긴다.
- OFF / ON: 보컬 표현 문구는 숨기되 다중 보컬의 가창 담당 앵커는 유지하고, 악기·편곡 큐는 표시한다. 솔로곡은 번호가 붙은 기본 섹션 태그만 남길 수 있다.
- OFF / OFF: 구조 태그, 다중 보컬 소유권에 필요한 담당 앵커, 가사·애드리브만 표시한다.

### 엔진 연동 원칙
- 두 토글은 공개 가사에 보이는 표기만 제어한다. Section Role Engine, Section Blueprint 번호·소유권, Section Performance Plan, Hook Blueprint, 보컬 배정, 내부 Arrangement 계획은 OFF에서도 계속 작동한다.
- 따라서 이후 보컬 큐·악기 큐 생성 품질을 개선하더라도 UI 토글은 최종 출력 정책만 제어하며, 생성 엔진과 직접 결합되지 않아 기능 연동이 깨지지 않는다.
- 선택값은 `appliedKeywords.sectionCueOptions`로 보존되고 V1, V2, 가사 단독 재생성의 최종 공개 경계에서 동일하게 적용된다.

### 안전 범위
- 특정 보컬 큐·악기 큐 문장, 가사 예문, 고정 섹션 내용을 하드코딩하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수 및 저장 문서 구조는 변경하지 않는다.


## 88차 Gemini 호출 예산 / 후처리 원칙

- 곡 생성 1건의 실제 Gemini API 요청은 중앙 예산으로 최대 3회까지 허용한다.
- 자동 품질 보정 호출은 최대 1회만 허용한다.
- 정상 경로는 최초 곡 생성 1회다.
- 첫 모델이 일시적인 API 오류로 실패한 경우에만 대체 모델 1회를 허용한다.
- V1 누락 섹션·가사 밀도·언어 혼합 비율·Atmosphere 문장 문제는 추가 Gemini 호출 없이 코드 기반 정리 또는 원본 보존으로 처리한다.
- 강한 금지어가 실제 최종 가사에 남은 경우에만 한 번의 통합 교정 호출을 허용한다. 한국어·외국어 카드가 동시에 걸려도 한 호출로 묶는다.
- 제목 누락만으로 별도 Gemini 호출을 시작하지 않는다.
- 호출 상한은 감사 화면에서 확인 가능하며, 상한을 넘는 호출은 API 요청 전에 차단된다.

## 89차 — 곡별 동적 Section Blueprint 슬롯 계약

### 핵심 원칙
- 안정형 전체 구조를 모든 곡에 공통 강제하지 않는다.
- 추천형·안정형·실험형·커스텀은 생성 시작 전에 각 곡의 Section Blueprint를 한 번만 확정한다.
- 추천형과 실험형의 랜덤 선택은 Blueprint 확정 전까지만 허용하고, 최초 Gemini 호출 이후에는 같은 곡 안에서 구조를 다시 뽑거나 해석하지 않는다.
- 커스텀은 사용자가 지정한 실제 순서와 비표준 섹션명을 그대로 계약으로 사용한다. 사용자가 넣지 않은 Bridge, Final Chorus, Outro 등을 임의로 추가하지 않는다.

### 동적 슬롯 출력
- V1 최초 응답의 가사는 고정 `verse1/chorus1` 필드가 아니라 `sectionId`, `sectionName`, `productionCues`, `bodyLines`를 가진 동적 배열로 받는다.
- 앱이 확정 Blueprint 순서대로 슬롯을 조립하므로 모델이 중간 또는 뒤쪽 태그를 빼더라도 섹션 소유권과 정확한 위치가 사라지지 않는다.
- 선택되지 않은 언어 카드는 빈 값으로 유지하며, 한국어 전용 생성에서 보조 언어용 빈 슬롯 묶음을 만들지 않는다.

### 슬롯별 가사 정책
- `LYRIC_BODY_REQUIRED`: Verse, Chorus, Rap Section 등 실제 가창 본문이 필요한 슬롯.
- `LYRIC_BODY_OPTIONAL`: Intro, Build-Up, Drop, Theme, Climax처럼 곡 설계에 따라 짧은 보컬 또는 무가사로 둘 수 있는 슬롯.
- `LYRIC_BODY_FORBIDDEN`: Instrumental, Interlude, Break, Stop.
- 이 정책은 구조와 안전을 위한 제한이며, 가사 소재·장면·문장·이미지·말투는 고정하지 않는다.

### 누락 처리와 호출 상한
- 태그·순서·번호는 앱이 Blueprint 계약으로 조립한다.
- 필수 가창 슬롯의 실제 본문만 비어 있을 때 해당 슬롯 본문만 한 번 보완한다. 기존 가사 전체 재작성과 구조 재추첨은 하지 않는다.
- 보완 응답은 `sectionId + sectionIndex + sectionName`이 모두 계약과 일치할 때만 제자리에 삽입한다.
- 최종 공개 직전에 확정 계약과 실제 결과를 다시 비교한다. 선택된 필수 슬롯을 끝까지 완성하지 못한 경우 불완전한 곡을 정상 완료로 표시하지 않는다.
- 88차의 곡당 Gemini 최대 3회 절대 상한과 자동 보정 호출 상한은 유지한다.

### 안전 범위
- 신규 콘텐츠 하드코딩은 추가하지 않는다. 이미 존재하던 Section Registry의 `가사 필수 / 선택 / 금지` 구조 정책과 88차 호출 상한만 재사용하며, 특정 장르의 소재·가사 문장·장면·대체 문구·고정 스토리는 넣지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수와 저장 문서 구조는 변경하지 않는다.

## 90차 - 전개 섹션 최소 실질 밀도 안전선

### 적용 범위
- 89차에서 곡마다 확정된 동적 Section Blueprint를 그대로 사용한다.
- 추천형·안정형·실험형·커스텀 전체에 동일한 고정 구조를 강제하지 않는다.
- 이번 곡의 Blueprint에서 `development + expansive`로 확정된 Verse, Rap Section 및 같은 역할의 슬롯만 검사한다.

### 최초 생성 예방
- 최초 Gemini 지시문에서 전개 섹션은 장면·행동·관계·욕망·태도·결과 중 실제 진행을 담아야 한다고 명시한다.
- `(음, 음...)`, `(우-)`, `(아...)` 같은 비어휘 괄호 애드리브는 퍼포먼스로는 유지하지만 전개 내용량으로 계산하지 않는다.
- 한두 개의 긴 의미 문장 또는 여러 개의 짧은 리듬 문장 모두 허용한다. 생성 프롬프트에는 고정 줄 수를 요구하지 않는다.

### 제한적 하드코딩 안전선
- 극단적으로 비어 있는 전개 섹션만 찾기 위해 `가사 길이 모드 + 역할`에 따른 내부 최저선을 둔다.
- 판정은 `고유한 의미 단위 수`와 `전체 어휘량`을 동시에 본다. 둘 중 하나라도 충분하면 통과하므로 일반 작사 형식을 고정하지 않는다.
- Rap Section은 기존 섹션 역할 정의상 Verse보다 촘촘한 전개를 담당하므로 안전선만 소폭 높인다.
- 사용자가 특정 섹션을 한 줄·짧게·미니멀하게 직접 요청한 경우 이 안전선보다 사용자 지시가 우선한다.

### 보완 방식과 호출 제한
- 최초 결과가 안전선 아래로 붕괴한 경우에만 자동 보정 허용 1회를 사용한다.
- 누락 섹션은 전체 본문을 받고, 밀도 부족 섹션은 기존 줄을 보존한 채 추가할 새 줄만 받는다.
- 전체 가사 재작성, 구조 재추첨, 기존 줄 교체, 다른 섹션 변경은 금지한다.
- 곡당 실제 API 최대 3회와 자동 보정 최대 1회 제한은 유지한다.

### 안전 범위
- 특정 가사 문장, 장면, 소재, 말투, 장르별 이야기 내용을 하드코딩하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수 및 저장 문서 구조는 변경하지 않는다.
- 최종 1순위 금지어 교정은 품질 보정이 아니라 출력 안전 단계로 분리한다. 절대 3회 상한에는 포함되지만, 섹션 밀도 보정 1회가 이미 실행됐다는 이유만으로 차단하지 않는다.

## 91차 — 동적 Blueprint 정확 슬롯 스키마와 보완 fallback

### 최초 응답 구조 강제
- 89차에서 곡별로 확정한 Recommended, Stable, Experimental, Custom Blueprint를 그대로 사용한다. 공통 팝 구조나 특정 섹션 이름을 새로 강제하지 않는다.
- 선택된 각 언어 카드의 구조화 출력 배열은 현재 곡의 슬롯 수와 정확히 같은 `minItems/maxItems`를 가진다.
- 배열의 각 위치는 `prefixItems`로 잠그며, `sectionId`, `sectionIndex`, `sectionName`을 해당 Blueprint 슬롯의 단일 enum 값으로 제한한다.
- 필수 가창 슬롯은 구조화 출력 단계부터 `bodyLines` 최소 1개를 요구하고, 가사 금지 슬롯은 `bodyLines` 최대 0개로 제한한다.
- 선택하지 않은 언어 카드는 정확히 빈 배열만 허용한다.

### 보완 응답과 호출 예산
- 누락 또는 극단적 밀도 부족 슬롯의 보완 응답도 대상 슬롯 수·순서·ID·이름을 같은 방식으로 정확히 잠근다.
- 하나의 허용된 보완 작업이 429/5xx/503 같은 일시적 API 오류로 실패하면 대체 모델 1회를 같은 보완 작업의 fallback으로 허용한다.
- fallback 물리 요청은 곡당 실제 요청 최대 3회 상한에 포함되지만, 별도의 두 번째 품질 보정으로 계산하지 않는다.
- 따라서 정상 1회, 최초 호출 + 보완 1회, 또는 최초 호출 + 보완 실패 + fallback의 최대 3회 경로만 가능하며 무한 재호출은 불가능하다.

### 하드코딩 범위
- 이번 제한은 현재 곡에서 이미 확정된 슬롯의 수·순서·식별자·가사 허용 정책을 API 스키마로 고정하는 형식/안전 하드코딩이다.
- 가사 문장, 소재, 장면, 말투, 장르별 이야기, 특정 섹션 조합은 고정하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수와 저장 문서 구조는 변경하지 않는다.

## 92차 — Gemini 지원 스키마 기반 동적 슬롯 복구

### 91차 오류 수정
- 실제 Gemini 런타임이 `responseSchema.prefixItems`를 지원하지 않아 최초 요청이 토큰 생성 전 `400 INVALID_ARGUMENT`로 실패하고 모든 곡이 간소화 긴급 생성으로 넘어가던 문제를 수정한다.
- 최초 생성과 타깃 섹션 보완 스키마에서 `prefixItems`를 완전히 제거한다.

### 지원되는 계약 방식
- 선택된 언어 카드 배열은 현재 곡 Blueprint 슬롯 수와 같은 `minItems/maxItems`를 유지한다.
- 배열 항목의 `sectionId`, `sectionIndex`, `sectionName`은 현재 Blueprint에 존재하는 값만 허용한다.
- 정확한 ID·순번·이름 조합, Blueprint 순서, 가사 필수·선택·금지 정책은 앱의 기존 렌더러와 최종 계약 검사기가 다시 검증한다.
- 타깃 보완도 현재 보완 대상 값만 허용하며, 중복·불일치 슬롯은 다른 섹션에 잘못 삽입하지 않는다.

### 호출 영향
- 정상 곡은 다시 최초 Gemini 호출 1회 경로를 사용한다.
- 실제 필수 슬롯 누락 또는 극단적 밀도 부족이 확인될 때만 기존 허용 범위 안에서 보완 호출을 사용한다.
- 곡당 실제 API 요청 최대 3회와 자동 보정 상한은 유지한다.

### 안전 범위
- 특정 가사, 장면, 소재, 장르별 이야기, 고정 섹션 조합을 추가하지 않는다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수 및 저장 문서 구조는 변경하지 않는다.

## 93차 — 숫자 슬롯 인덱스 스키마 호환 및 개발 오류 비용 차단

### 원인 수정
- Gemini 구조화 출력은 `sectionIndex`의 숫자 enum을 문자열 enum처럼 검증해 `400 INVALID_ARGUMENT`을 반환했다.
- 최초 생성과 타깃 섹션 보완 스키마에서 숫자 enum을 제거하고 `sectionIndex`는 필수 정수로만 수신한다.
- 현재 Blueprint의 정확한 범위·순서·`sectionId + sectionIndex + sectionName` 결합은 기존 앱 코드 검증과 최종 계약 검사에서 계속 강제한다.
- 문자열인 `sectionId`, `sectionName`의 현재 곡 허용값과 언어 카드별 정확 슬롯 수는 유지한다.

### 불필요한 추가 호출 차단
- `generation_config.response_schema`, `response_schema`, `fieldViolations`, `Invalid JSON payload` 등 스키마 설정 표식이 있는 `400 INVALID_ARGUMENT`은 개발 설정 오류로 분리한다.
- 이 오류는 토큰 0으로 끝난 뒤 `간소화 긴급 생성`을 유료 호출하는 대신 즉시 실패로 표시한다.
- 실제 429·5xx·모델 과부하 같은 일시 오류의 제한된 fallback과 실제 생성 결과의 누락 슬롯 보완은 기존 절대 호출 상한 안에서 유지한다.

### 변경하지 않는 범위
- 동적 추천·실험형·커스텀 Blueprint, 섹션 밀도 기준, 곡 길이 로직, 가사 내용 자유도는 변경하지 않는다.
- 가사 문장·소재·장면·말투 하드코딩과 Firebase/Auth/Firestore/Functions/저장 구조 변경은 없다.

## 94차 — 일시 오류 fallback 복구 및 스키마 위험 축소

### 정확한 원인 수정
- 93차의 누락 섹션 보완에서 실제 `503 UNAVAILABLE`이 발생해도 대체 모델 호출이 시작되지 않은 원인은, 재시도 판별기가 네이티브 `Error`를 `JSON.stringify()`하여 `{}`로 읽고 `message` 안의 503·UNAVAILABLE 정보를 잃었기 때문이다.
- 오류 판별은 이제 `message`, `name`, 코드, 상태, 중첩 `error/cause/response/data/details`를 함께 읽는다.
- 실제 429·5xx·UNAVAILABLE·DEADLINE_EXCEEDED만 기존 제한 안에서 대체 모델 1회를 허용한다.
- `response_schema`가 포함된 400 개발 설정 오류는 재시도 가능 오류와 명시적으로 분리해 유료 fallback을 실행하지 않는다.

### 구조화 출력 안정화
- 최초 생성과 섹션 보완 스키마에서 동적 `sectionId/sectionName` enum을 제거한다. 과거 숫자 enum·`prefixItems`처럼 런타임 호환성 차이로 최초 요청 전체가 깨지는 위험을 줄인다.
- API 스키마는 자료형과 현재 곡의 정확한 슬롯 개수만 담당한다.
- 정확한 슬롯 ID·순번·이름 결합, 순서, 중복, 가사 필수·선택·금지 정책은 잠긴 Blueprint와 앱 코드가 최종 검증한다.
- 최초 응답 전 내부 자체 점검 지시를 추가해 모든 필수 슬롯의 `bodyLines`가 실제 비어 있지 않은지 같은 응답 안에서 확인하도록 한다.
- 보완 대상은 호출 전에 Blueprint 기준으로 중복 제거·재검증한다.

### 호출 및 데이터 안전
- 정상 결과는 1회, 실제 누락 시 보완 1회, 보완이 일시 오류일 때만 대체 모델 1회로 최대 3회다.
- 새로운 가사 문장·장면·소재·장르별 스토리 하드코딩은 없다.
- Firebase Auth, Firestore, Functions, Rules, 환경변수와 저장 문서 구조는 변경하지 않는다.

## 95차 — Gemini Server Proxy / Security Cost Guard

- Client prompt engine remains in `src/services/geminiService.ts`.
- Actual Gemini HTTP request is routed through `src/services/geminiProxyClient.ts` to Firebase Function `generateGeminiContent`.
- The browser never receives `googleGeminiApiKey`.
- Server guard enforces 2 concurrent requests, 12 requests/minute, and 3 requests/session per user.
- 429 quota errors stop immediately; only temporary 5xx/unavailable errors may use one fallback model.
- App Check code is prepared and becomes mandatory only after Firebase Console registration and `ENFORCE_APP_CHECK=true`.

## 111차 — Lyric Architecture Shadow Plan / 실제 가사 글자 비율 진단

- 신규 모듈:
  - `src/services/generation/v1/lyrics/lyricArchitecturePlan.ts`
  - `src/services/generation/v1/language/languageMixAudit.ts`
- 현재 가사 결과를 즉시 바꾸지 않는 `shadow` 단계다.
- 장르·퓨전 신호, 템포, 보컬 랩 역할, 전체 가사 길이와 활성 Section Blueprint를 이용해 다음 내부 진단을 만든다.
  - 장르적 언어 움직임: 서사량, 리듬 밀도, 멜로디 유지음, 훅 반복, 구절 압축, 호흡 여백, 라임, 대화성
  - 섹션별 서사 역할, 상대 밀도 0~4, 구절 길이, 호흡, 반복, 유지음, 라임, 언어혼합 형태
  - 전체 Density Curve
- 고정 음절표나 소재·장면·문장 예시는 사용하지 않는다. 숫자는 정확한 음절 수가 아니라 섹션 간 상대적 언어 압력을 뜻한다.
- 진단 결과는 `appliedKeywords.lyricArchitectureAudit`에 저장한다. 아직 생성 프롬프트에는 연결하지 않아 기존 가사 결과의 기준점을 보호한다.
- 언어혼합 검사는 최종 공개 가사의 실제 가창 내용만 측정한다.
  - 제외: 섹션 태그, 보컬·퍼포먼스 큐, 악기·프로덕션 큐, 공백, 문장부호
  - 계산: 목표 언어 문자 수 ÷ (기본 언어 문자 수 + 목표 언어 문자 수)
  - 결과: `appliedKeywords.languageMixAudit`
- 이번 단계에서는 비율 진단이 생성 결과를 자동 재작성하지 않는다. 다음 단계에서 동일 입력 비교 후 구절 배치 계획에 연결한다.

## 112차 — Lyric Architecture Active Rollout / 장르·퓨전·섹션 밀도 연결

- 기준: `SORIDRAW_111차_lyric_architecture_shadow_audit.zip`
- 변경 핵심:
  - 111차에서 기록만 하던 `LyricArchitecturePlan`을 실제 V1 가사 생성 지시에 연결했다.
  - 메인 장르는 전체 곡의 언어 움직임과 통일감을 담당한다.
  - 보조 장르는 Verse, Hook, Bridge, Opening 등 자신의 프레이징이 자연스러운 섹션에만 국소 적용한다.
  - 각 섹션은 서사 역할, 상대 밀도 0~4, 구절 길이, 호흡, 반복, 멜로디 유지음, 라임 우선도, 장르 영향 정보를 가진다.
  - Verse 2는 이전 Verse의 반복이 아니라 새로운 행동·결과·관점을 추가하도록 하고, Bridge는 실제 전환, Final Chorus/Hook은 기존 훅의 해소·재해석을 요구한다.
  - Chorus/Hook은 Verse보다 짧을 수 있으며, 분량을 늘리기 위해 설명문으로 만들지 않는다.
  - 정확한 음절표나 고정 줄 수는 사용하지 않는다. 현재 장르, 템포, 구조, 보컬, 사용자 직접 지시를 함께 사용한다.
- 일관성:
  - 최초 가사 생성과 누락/저밀도 섹션 국소 보완이 같은 Architecture Plan을 사용한다.
  - `appliedKeywords.lyricArchitectureAudit`에는 `version: v1-active-2`, `mode: active`, 섹션별 `genreInfluence`와 `fusionRole`이 저장된다.
- 미변경:
  - 언어혼합 passage 배치 로직과 자동 비율 보정은 이번 차수에서 수정하지 않았다.
  - Firebase/Auth/Firestore/Functions 저장 구조는 변경하지 않았다.

## 113차 — Recommended 누락 섹션 소유권 복구

- 112차 추천 구조 테스트에서 빈 `Chorus 2` 슬롯의 가사가 앞선 `Pre-Chorus 2` 뒤쪽 문단에 붙고, 빈 Chorus 태그만 제거되는 실제 실패를 확인했다.
- `sectionGuard.ts`는 Recommended/Stable의 명확한 전환 경계에서만 문단 소유권을 복구한다.
  - 허용: `Pre-Chorus/Build-Up → Chorus/Hook/Drop`, `Bridge → Final Chorus/Final Hook/Climax`
  - 조건: 다음 필수 슬롯이 비어 있음, 이전 슬롯에 2개 이상 실제 문단이 있음, 분리 후 양쪽에 각각 2줄 이상의 가창 내용이 남음
  - 금지: Verse 임의 분할, Custom/Experimental 추정, 일반 줄 길이만으로 섹션 추론
- 복구된 슬롯에는 기존 Section Performance Plan이 해당 곡의 큐를 다시 연결하므로 고정된 보컬 큐를 삽입하지 않는다.
- 영어 큐 단어 손상은 특정 단어 목록으로 교정하지 않고, 현재 응답 안의 정상형과 비교해 손상 후보를 제외한다.
- 언어혼합, 서사 내용, Firebase/Auth/Firestore/Functions 및 사용자 저장 데이터는 변경하지 않는다.


## 114차: 애드리브 자동 관성 차단

- 기본 생성에서 Intro/Outro를 채우기 위해 `(음...)`을 자동으로 쓰지 않는다.
- 명시적 허밍/구음/애드리브 의도는 보존한다.
- 자동 상태에서는 사용자 선택과 직접 입력을 근거로 written ad-lib 필요성을 판단한다.
- 괄호 안의 의미 있는 훅·응답 문장은 삭제하지 않는다.
- Outro 가사 본문은 선택 사항이며, 무가사 종료를 정상 구조로 인정한다.


## 115차 섹션 큐 최종 경계

- `sectionRegistry.cleanV1SectionCue`: 반복 철자 손상 최소 복구
- `sectionRenderer.renderSectionTag`: 실제 가사 본문이 있는 bare sung tag에 역할 기반 최후 안전 큐 제공
- `geminiService.finalizeV1PublicLyricOutputIntegrity`: UI 반환 직전 구조 태그 내부 큐 철자 재확인
- 이 단계는 가사 내용·서사·섹션 순서를 다시 쓰지 않는다.

## V1 Language Mix — Locked Whole-Lyric Rewrite (130차)

`generateSong` 최종 반환 경계에서 `languageMixWholeRewrite.ts`가 작동한다.

1. 롤백2차 기본 엔진이 가사, 섹션 태그, 보컬/퍼포먼스 태그, 악기큐를 먼저 완성한다.
2. 언어혼합 활성 시 가창 줄만 `L1...Ln` ID로 추출한다.
3. 별도 Gemini 필수 단계가 전체 문맥을 보고 각 ID의 완성형 최종 줄 후보를 작성한다.
4. 로컬 선택기가 실제 가창 줄 점유율과 전·중·후 분산에 가까운 완성형 줄 묶음을 선택한다.
5. 대괄호 줄과 줄 위치는 원문 그대로 재조립한다.
6. `languageMixRewritePlan`, `languageMixAudit`, `sectionIntegrityAudit`를 공개 진단에 기록한다.

금지 구조: 단어/토큰 부분 치환, 초기 생성 응답에 후보 수십 개 동시 생성, 한글/영어 원시 글자 길이 동등성 강제.

## 132차 — Cue Immutable Boundary / Sung-Line Occupancy Mix

- `geminiService.ts`의 큐 후처리는 모델이 만든 단어의 철자를 직접 변경하지 않는다. 현재 곡 안의 정상형과 구조적으로 충돌하는 손상 후보만 제외한다.
- `languageMixMeasurement.ts`가 가창 줄 단위 점유율을 단일 기준으로 제공한다.
- `languageMixWholeRewrite.ts`와 `languageMixAudit.ts`가 같은 점유율 기준을 사용하므로 선택기와 최종 진단의 수치가 일치한다.
- 중간·고비율 선택기는 인접한 줄 묶음을 먼저 만들고, 전·중·후 구간을 채운 뒤 목표 비율에 접근한다.
- Firebase/Auth/Firestore/Functions 및 사용자 저장 구조 변경 없음.


## 133차 — 선계획 언어 블록 재작성

- 언어혼합 줄 후보를 먼저 흩어서 만든 뒤 인접 묶음을 찾던 순서를 폐기했다.
- 앱이 섹션 구조와 전·중·후 위치를 기준으로 목표 비율에 필요한 연속 가창 블록을 먼저 정한다. 가사 단어나 특정 소재는 계획 기준에 사용하지 않는다.
- Gemini에는 계획된 블록 ID와 줄만 재작성 대상으로 전달하며, 블록 밖의 줄은 원문 그대로 반환하도록 잠근다.
- 계획 블록의 일부 줄만 빠지거나 보조 언어가 없는 경우 해당 블록 전체를 적용하지 않는다. 완성된 블록만 원자적으로 재조립한다.
- 가창 비율 선택기와 공개 검사는 섹션 경계를 실제 휴지점으로 취급한다. 서로 다른 섹션의 연속 줄을 하나의 과도한 언어 구간으로 오판하지 않는다.
- 20%는 전·중·후의 여러 섹션에 자연스러운 연속 블록을 배치하고, 선택기와 최종 검사가 같은 가창 줄 점유율을 사용한다.
- 특정 영어 단어, 가사 문장, 장면, 소재 하드코딩은 추가하지 않았다. Firebase/Auth/Firestore/Functions 및 저장 구조 변경 없음.

## 134차 — Low-ratio within-line rhyme mix

- 적용 범위: V1 언어혼합 10~20%.
- `languageMixWholeRewrite.ts`는 저비율에서 연속 영어 블록 대신 분산된 혼합 후보 줄을 계획한다. 각 후보는 한 줄 안에 기본 언어와 목표 언어를 모두 포함해야 한다.
- 저비율 후보 검증 조건: 두 언어 존재, 완전 외국어 줄 금지, 최소 가창 분량 확보, 실제 언어 경계 존재, 의미 연결 설명, 발음·모음·강세·리듬 연결 설명, 외국어 토큰과 한국어 조사 직접 결합 금지.
- `languageMixMeasurement.ts`는 한국어 음절과 라틴계 언어 추정 발음 음절을 같은 공연 단위로 계산한다. 원시 알파벳 길이와 단순 줄 개수는 비율 근거로 사용하지 않는다.
- `languageMixAudit.ts`는 10~20%에서 완전 외국어 줄이 하나라도 있거나 실제 혼합 줄이 부족하면 통과시키지 않는다.
- 프롬프트와 코드에는 특정 영어 단어, 라임 예시, 가사 문장, 장면, 소재를 고정하지 않는다.
- 기본 가사 생성, 섹션 렌더러, 큐 파이프라인과 Firebase/Auth/Firestore/Functions는 변경하지 않는다.


## 135차 — K-pop Sound-First Code Switch 10/20

- 적용 범위: V1 언어혼합 10%와 20% 통합 경로.
- 생성 기준은 문법적 자연스러움이 아니라 K-pop 가창음이다. 모음 착지, 자음 시작, 영어 강세, 음절·호흡 밀도, 내부·끝 라임, 훅 타격감을 우선한다.
- 비문, 문장 파편, 압축 구문, 의미 반복은 음악적 역할이 있으면 허용하며, 직역·회화 문법은 로컬 거부 조건에서 제거했다.
- 모델이 작성한 의미/발음 설명을 신뢰해 통과시키지 않는다. `languageMixMeasurement.ts`가 결과 줄에서 실제 언어 경계, 목표 언어 구절 수, 가창 점유량을 계산하고 `languageMixWholeRewrite.ts`가 원문 대비 호흡 밀도와 과도한 전환을 검사한다.
- 10%는 한 줄당 중간 강도의 목표 언어 구절과 적은 혼합 줄 수, 20%는 더 높은 구절 점유율과 제한된 추가 혼합 줄 수를 사용한다. 두 비율 모두 완전 외국어 줄을 만들지 않는다.
- `languageMixAudit.ts`는 목표 비율 외에도 혼합 줄 총수와 섹션 내 연속 혼합 줄 길이를 공개 진단한다.
- 특정 영어 단어, 상투 문구, 라임 샘플, 장면·소재 하드코딩 없음. 기본 가사/섹션/큐 파이프라인 및 Firebase 저장 구조 변경 없음.

## 136차 — K-pop Repeated Hook Anchor Pattern 10/20

- 적용 경로: `languageMixWholeRewrite.ts`의 V1 10%·20% K-pop 코드 스위칭.
- `buildV1LanguageMixBlockPlan`은 반복 Chorus/Hook/Refrain/Drop의 같은 로컬 줄 위치를 하나의 원자적 미러 블록으로 묶는다. 10%는 핵심 미러 슬롯 1개, 20%는 2개를 우선 계획한다.
- 미러 블록은 모든 반복 구간에서 동일한 목표 언어 토큰 앵커를 가져야 한다. 동일 원문 훅은 최종 혼합문도 완전히 같아야 하며, 한 구간만 한국어로 되돌아가거나 다른 영어 구절로 바뀌면 전체 블록을 거부한다.
- 저비율 혼합 형식은 `keyword-anchor`와 `short-phrase`를 함께 사용한다. 단어형은 1개 또는 분리 불가능한 2단어 이하, 짧은 구절형은 2~6단어로 제한한다. 10%·20% 계획에서 긴 영어 문장형은 기본 선택하지 않는다.
- `languageMixMeasurement.ts`는 실제 목표 언어 토큰을 추출하고, `languageMixAudit.ts`는 단어형/짧은 구절형 개수, 반복 후렴 위치 일치, 앵커 일치, Final Chorus 회수를 공개 진단한다.
- Pre-Chorus는 Chorus 반복 가족에서 제외한다. 반복 후렴들은 물리적으로 여러 섹션이어도 배치 밀도 검사에서는 하나의 논리적 훅 패턴으로 취급한다.
- 모델의 `meaningConnection`·`phoneticConnection` 설명은 합격 근거가 아니다. 실제 최종 가사의 토큰과 구조만 판정한다.
- 특정 영어 단어, 라임 샘플, 가사 소재는 하드코딩하지 않는다. 기본 가사·섹션·큐 엔진과 Firebase 저장 구조는 변경하지 않는다.


### 137차 K-pop 공통 후렴 앵커 재사용
- 10%·20% 후렴은 각 Chorus를 독립 생성한 뒤 우연히 일치시키지 않는다.
- 연결된 후렴 후보에서 핵심 외국어 단어/짧은 구절을 한 번 선택하고, 같은 후렴 슬롯에 그대로 재사용한다.
- 핵심 단어형은 후보 문구에서 의미어를 선택하므로 특정 단어를 하드코딩하지 않는다.
- 후렴 후보 하나의 길이 편차로 전체 언어혼합을 0% 원문 복구하지 않도록 공통 앵커를 로컬에서 안정적으로 조립한다.
- 10%·20% 계획 줄 수를 축소해 지나치게 많은 가사 줄을 건드리지 않는다.


### 138차 1단계 — 비율 판정과 적용 판정 분리
- `languageMixWholeRewrite.ts`에서 목표 비율 범위는 계속 계산하지만, 범위 밖이라는 이유만으로 유효 후보 전체를 폐기하지 않는다.
- 적용 여부는 기존 후보 유효성, 섹션·큐 잠금, 현재 배치 안전 조건으로 결정한다.
- 실제 비율은 `languageMixAudit`에서 그대로 보고되어 다음 단계의 조정 근거로 사용한다.
- 후렴 패턴, 단어/구절 형태, 라임, 후보 계획 로직은 변경하지 않는다.


## 139차 언어혼합 비율 선택지 정리
- 활성 선택지를 `5 / 10 / 20 / 30 / 40 / 50 / 60%`로 변경했다.
- 5%를 다시 활성화하고 70%는 UI와 활성 생성 계약에서 제거했다.
- 과거 저장본의 70% 값은 60%로 정규화해 기존 곡 설정을 불러올 때 오류가 나지 않게 한다.
- 이번 차수는 비율 선택지와 전달 경계만 변경한다. 문장 생성 품질, 후렴 패턴, 라임, 배치, 실제 비율 보정은 변경하지 않는다.


## 140차 — 5% 전용 언어혼합 배치 단계
- 활성 5% 선택값은 10% 계획을 재사용하지 않고 별도 저밀도 계획을 사용한다.
- 반복 Chorus/Hook의 같은 슬롯에 공통 단어 앵커 1개를 유지하고, 비후렴 추가 후보는 1~2곳으로 제한한다.
- 최종 혼합 줄 목표는 반복 후렴을 포함해 대체로 3~5줄이며, 5%가 여러 역할 구간에 한 단어씩 흩어지는 현상을 줄인다.
- 공개 검사의 형태 분류는 목표 언어 1토큰을 단어형, 2~6토큰의 한 덩어리를 짧은 구절형으로 계산한다.
- 10%·20% 선택기, 실제 비율 예산 보정, 의미·상징·라임 품질 단계는 이번 차수에서 변경하지 않았다.

## 141차 — 5% 비율 예산 단독 보정
- 5%는 140차의 고정 배치(반복 후렴 3회 + 비후렴 2줄)를 유지한다.
- 반복 후렴 앵커는 최소 3 가창 단위, 비후렴 짧은 구절은 각 최소 4 가창 단위를 요구해 전체 4~7%를 목표로 한다.
- 5% 검사 권장 범위를 4~7%로 분리했다. 비율 미달만으로 결과 전체를 원문 복구하지 않는 138차 원칙은 유지한다.
- 10%·20% 이상의 배치·선택·비율 규칙은 변경하지 않는다.

## 142차 — 5% 후렴 앵커 길이 충돌 제거
- `languageMixWholeRewrite.ts`의 5% `keyword-anchor` 최소 가창 단위를 3에서 1로 되돌렸다.
- 한 단어 후렴 앵커도 유효 후보로 인정되어 `hook-anchor-reuse-invalid:target-sung-units-outside-mix-form`로 반복 후렴 블록 전체가 폐기되지 않는다.
- 반복 후렴 동일 앵커, 비후렴 짧은 구절 2곳, 5줄 배치와 4~7% 진단은 그대로 유지한다.
- 이번 차수는 실패 복구만 수행하며 다른 비율·품질·저장 구조는 변경하지 않는다.

## 143차 — 5% 실제 비율 완성 단계
- `languageMixWholeRewrite.ts`의 5% 경로는 반복 후렴 공통 앵커 3회와 비후렴 짧은 구절 2회를 최종 5개 가창 위치로 확정한다.
- 전체 가사의 추정 가창 단위에서 4~7%에 필요한 목표 언어 단위를 계산하고, 비후렴 두 줄의 `targetUnitGuide`를 곡 길이에 맞춰 동적으로 만든다.
- 기본 비후렴 후보 2개 외에 대체 후보 2개를 같은 Gemini 요청에 포함한다. 후보가 하나 탈락해도 추가 호출 없이 유효한 조합 중 5%에 가장 가까운 두 줄을 선택한다.
- 계획 밖에 이미 존재하는 목표 언어 가사는 `restore-base-language` 대상으로 보내 기본 언어로 정리한 뒤 최종 비율을 계산한다.
- 공개 검사기의 5% `short-phrase` 분류도 생성 검사와 동일한 3~8 토큰·6~16 가창 단위 범위로 맞췄다.
- 5%는 `5개 위치 완성 + 실제 4~7% + 반복 후렴 앵커 일치 + 잠금 경계 보존`을 모두 통과해야 적용된다. 10%·20% 이상과 Firebase 저장 구조는 변경하지 않았다.

## 144차 — 5% short-phrase 가창 단위 계약 보정
- 실패 보고서에서 5% 비후렴 기본·백업 후보가 모두 1~2개의 지나치게 짧은 영어 조각으로 생성되어, 동적 `targetUnitGuide` 최소 7 가창 단위와 충돌한 원인을 수정했다.
- Gemini 요청에는 각 5% 비후렴 줄의 `targetTokenGuide`와 `targetUnitGuide`를 함께 전달하고, 가창 단위를 실제 발음 음절로 세어 최소값 미달이면 같은 구절을 자연스럽게 확장한 뒤 반환하도록 강제한다.
- 검사기는 2개의 다중 음절 단어도 충분한 가창 단위를 만들 수 있다는 점을 반영해 5% short-phrase의 토큰 하한을 3에서 2로 조정했다. 단, 동적 가창 단위 하한과 전체 4~7% 조건은 완화하지 않는다.
- 143차의 5줄 패턴, 후렴 동일 앵커, 후보 조합 선택, 계획 밖 목표 언어 정리, 10%·20% 이상 경로는 그대로 유지한다.


## 145차 — Whole-song language ratio bands
- 공통 비율 단일 원본: `src/constants/languageMixRatios.ts`
  - 5% 선택: 실제 5~10%
  - 10% 선택: 실제 10~20%
  - 20% 선택: 실제 20~30%
  - 30% 선택: 실제 30~40%
  - 40% 선택: 실제 40~50%
  - 50% 선택: 실제 50~60%
  - 60% 선택: 실제 60~70%
- `languageMixWholeRewrite.ts`는 모든 비율에서 최종 추정 가창 점유율이 해당 범위에 들어오는 후보/블록 조합을 우선 선택한다.
- 5%는 고정 5줄 패턴과 계획 밖 기존 외국어 선삭제를 적용 조건에서 제거한다. 현재 전체 가창 비율에서 부족한 분량만 추가한다.
- 30~60%는 완전 외국어 블록을 5~8개 후보 단위로 세분화하고 부분 조합을 평가해 큰 블록 단위 점프를 줄인다.
- `languageMixAudit.ts`의 상태는 이번 단계에서 전체 분량 통과 여부로 결정한다. 배치·후렴·형태 관련 값과 경고는 삭제하지 않고 진단으로 보존한다.
- UI는 단일 숫자를 정확값처럼 표시하지 않고 실제 생성 범위와 기본 언어 역범위를 표시한다.
- 엔진 버전: `v1-whole-song-ratio-bands-step7-active-22`.

## 146차 — Language mix visible result / warning-only diagnostics

- `languageMixWholeRewrite.ts`의 적용 판정에서 전체 비율 범위를 하드 실패 조건에서 제거했다.
- 유효 후보가 한 줄 이상 선택되고 섹션·큐 잠금 및 재조립 경계가 보존되면 결과를 `applied`로 반환한다.
- 비율, 타임라인 분산, 섹션 토폴로지, 저비율 라임 형식, 후렴 미러, 5% 패턴은 `warningReasons`에 기록하고 공개 결과를 숨기지 않는다.
- `chooseCandidate`와 5%/30~60% 후보 조합 선택기는 상한 초과 후보를 사전에 삭제하지 않고, 비율 거리와 초과 페널티로 순위를 매긴다.
- 기술적 원문 보존 사유는 `no-valid-*`, `no-applicable-language-mix-placement`, `preexisting-target-cleanup-incomplete`, `locked-section-or-cue-lines-changed`로 제한한다.
- 공개 필드: `ratioBandPassed`, `warningReasons`, `applicationPolicy`.
- 엔진 버전: `v1-language-mix-visible-warning-step8-active-23`.

## 147차 — Ratio-fit candidate selection

- 기준: 146차 언어혼합 생성·배치 구조를 유지하고 비율 맞춤 경로만 수정했다.
- `buildV1LanguageMixBlockPlan`
  - 10%·20%는 원곡의 전체 추정 가창 단위와 평균 줄 길이로 필요한 후보 발생량을 계산한다.
  - 10% short phrase는 4~10 목표 가창 단위, 20% short phrase는 5~12 목표 가창 단위를 후보 생성 가이드로 전달한다.
  - 실제 적용 수보다 여유 후보를 함께 받아 모델 편차가 있어도 목표 비율 조합을 선택할 수 있게 한다.
- `applyV1WholeRewriteResponse`
  - 10%·20% 후보 전체를 대상으로 실제 가창 점유율 기반 조합 탐색을 실행한다.
  - 최우선 순위는 선택 범위 진입, 다음은 범위 중앙과의 거리다. 섹션·후렴·배치 진단은 삭제하지 않고 기존 공개 진단으로 유지한다.
  - `excludedLineIds`를 지원해 금지어 후보만 제외한 재조합이 가능하다.
- `applyV1LockedWholeLyricLanguageMix`
  - 금지어가 있는 혼합 후보 줄만 최대 3회 제외하고 동일 응답 후보로 비율을 다시 맞춘다.
  - 금지어가 남는 경우에만 원문 보존 처리한다. 금지어 검사 자체는 제거하지 않는다.
- 엔진 버전: `v1-language-mix-ratio-fit-step9-active-24`.

## 148차 — Language Arrangement Arc

### 변경 파일
- 신규: `src/services/generation/v1/language/languageArrangementDirector.ts`
- 수정: `src/services/generation/v1/language/languageMixWholeRewrite.ts`
- 수정: `src/services/geminiService.ts`
- 수정: `src/services/generation/v1/language/index.ts`
- 문서: `src/services/generation/README.md`, `docs/SORIDRAW_ENGINE_MAP.md`

### 현재 언어혼합 흐름

```text
사용자 전체 비율 선택
→ 장르/퓨전 장르/스타일/분위기/Story Context/직접입력/템포/보컬 해석
→ Language Arrangement Brief 생성
→ 변화·균형·통일을 기준으로 넓은 후보 기회 제공
→ Gemini가 후보별 적용/원문 보존 + 혼합 형식/전환 방향/모티프 관계 제안
→ 실제 가창 점유율을 측정하며 가장 자연스러운 후보 부분집합 선택
→ 섹션·큐·줄 ID·파싱 안전 확인
→ 결과와 실제 비율 공개
```

### 비율별 경로
- 5%: 기존 저밀도 `within-line-rhyme` 유지.
- 10~50%: 새 `adaptive-arrangement` 사용.
- 60%: 기존 `complete-line-blocks` 유지.

### 핵심 계약
- 전체 비율은 섹션별 균등 할당값이 아니다.
- 직접입력 장르/메인 장르가 primary profile을 담당하고, 보조 장르/스타일은 secondary grammar로 섹션별 변화를 보강한다.
- 섹션별 언어 강도는 이야기 기승전결과 장르 문법을 해석한 결과다.
- 후보 줄 수와 실제 적용 줄 수는 분리된다.
- 한 곡에서 단어·짧은 구절·긴 구절·완전 외국어 줄과 여러 전환 방향을 함께 사용할 수 있다.
- 반복 섹션은 동일 문장을 강제하지 않고, 인식 가능한 언어 모티프를 반복·확장·축소·반전·재해석할 수 있다.
- 비율 미세 조정은 강한 배치 결정을 보존한 채 최소 변경으로 수행한다.
- 창작 진단은 후보 선택을 기계적으로 지배하지 않으며, 기술적 안전 검사는 유지한다.

### 유지 영역
- `languageMixRatios.ts` 비율 범위
- 전체 가창 점유율 측정
- 5% 및 60%의 검증된 생성 경로
- 섹션/퍼포먼스 큐/프로덕션 큐 잠금
- 줄 누락·중복 ID·파싱/재조립 검사
- 금지어 후보 단독 제외 후 재선택
- Firebase/Auth/Firestore/Functions 및 사용자 저장 구조

엔진 버전: `v1-language-mix-arrangement-arc-step10-active-25`

## 150차 — Two-language card reliability

### 적용 조건
```text
V1 + 가사 언어 정확히 2개 선택 + 언어혼합 ON
```

### 수정 흐름
```text
각 카드의 반대편 언어를 target으로 확정
→ 잠금형 재작성 응답을 JSON schema로 제한
→ 파싱 실패 시 같은 schema로 1회 재요청
→ source에 상대 언어가 미리 있으면 baseText로 기본 언어 바탕 복구
→ Language Arrangement 후보 finalText를 부분집합 선택
→ 최종 비율·태그·큐·줄 잠금 검사
```

### 영향 차단
- 1개 언어 선택 경로 변경 없음
- V2 변경 없음
- 기본 작사·작곡 프롬프트 변경 없음
- UI 변경 없음
- Firebase/Auth/Firestore/Functions·저장 구조 변경 없음

엔진 버전: `v1-language-mix-two-card-reliability-step11-active-26`

## 151차 — Two-language compact schema dispatch

- 두 가사 언어 카드의 구조화 응답을 필수 필드 중심 compact schema로 축소한다.
- schema 거절 시 두 언어 경로에서만 JSON MIME fallback 1회를 사용한다.
- 엔진 버전: `v1-language-mix-two-card-compact-schema-step12-active-27`.

## 152차 — Two-card parallel language rewrite

### 적용 조건
```text
V1 + 가사 언어 정확히 2개 + 한국어/보조언어 카드 모두 존재 + 언어혼합 ON
```

### 실행 흐름
```text
이전: 한국어 카드 Gemini 완료 → 보조 언어 카드 Gemini 시작
현재: 한국어 카드 Gemini 시작 ┐
      보조 언어 카드 Gemini 시작 ┘ → 두 결과 결합 → 공통 검사
```

### 유지 계약
- 카드별 target 언어, compact schema, retry, HardBan, 비율·배치 선택 로직은 변경하지 않는다.
- `Promise.all`은 두 카드가 모두 존재하는 정확히 두 가사 언어 경로에만 사용한다.
- 카드 내부 오류는 카드별 preserved 결과로 변환하므로 다른 카드의 성공 결과를 취소하지 않는다.
- 한 언어 및 3개국어 혼합 경로는 이번 작업에서 변경하지 않는다.

엔진 버전: `v1-language-mix-two-card-parallel-step13-active-28`


## 153차 — Two-language arc and ratio repair

### 적용 경계

- V1
- 가사 카드 정확히 2개
- 카드별 목표 언어 정확히 1개
- 언어혼합 10~50%
- 3개국어·다중 목표 언어 경로는 기존 동작 유지

### 처리 흐름

1. 한국어 카드와 보조 언어 카드를 실제 병렬로 호출한다.
2. 각 호출은 전체 가사 후보를 넓게 생성하되, 반복 후렴은 대표 앵커 슬롯 1개만 고정 연결한다.
3. 로컬 선택기가 비율·섹션/타임라인·형식/방향 다양성·후렴 집중도를 함께 평가해 최종 후보 집합을 고른다.
4. 카드가 목표 하한에 미달하면 그 카드만 후보 확장 호출을 1회 실행한다.
5. 첫 호출의 유효 후보는 고정하고, 미사용 줄에서 받은 새 후보만 병합해 다시 선택한다.
6. 두 번째 선택도 목표 범위에 실패하면 미달 결과를 공개하지 않고 해당 카드 원본을 보존한다.
7. HardBan 후보 제외 뒤 비율이 다시 무너지면 역시 원본을 보존한다.

### 진단 필드

- `actualParallelDispatch`
- `requestSessionMode: parallel-two-card-direct-stage`
- `candidateExpansionUsed`
- `candidateExpansionUsedModel`
- `candidateExpansionResponseMode`
- 실패 시 `two-language-ratio-band-not-met-after-candidate-expansion`

엔진 버전: `v1-language-mix-two-card-arc-repair-step14-active-29`

## 154차 — Two-language target occupancy deficit completion

### 범위

정확히 두 언어를 선택한 V1 언어혼합의 10~50% 카드만 보완한다. 3개국어, 5%, 60%, V2, UI, Firebase 저장 구조는 변경하지 않는다.

### 문제

153차는 첫 후보가 목표 비율에 미달하면 후보 확장을 한 번 실행했지만, 첫 호출의 `suitable=true` 후보를 모두 고정했다. 따라서 짧은 영어 꼬리 후보가 많을 때 후보 수는 충분해도 실제 목표 언어 가창 점유율은 부족했고, 한글 카드가 최종적으로 원본 보존 0%로 끝날 수 있었다.

### 처리

1. 첫 결과의 목표 하한 미달 포인트를 계산한다.
2. 부족한 카드만 목표 점유율 보충 호출을 실행한다.
3. 비후렴 구간에 65~100% 목표언어 점유율의 완전 문장·긴 구절 후보를 우선 요청한다.
4. 기존 짧은 후보보다 목표언어 점유율이 18%p 이상 높고 가창 단위도 증가한 후보는 교체 허용한다.
5. 연결 후렴 훅은 보호하여 반복 모티프를 유지한다.
6. 합친 후보 풀로 전체 비율과 언어 아크를 다시 계산한다.
7. 한 카드만 성공하면 전체 상태를 `partial`로 기록한다.

엔진 버전: `v1-language-mix-two-card-deficit-occupancy-step15-active-30`

## 155차 — Three-language target distribution for two lyric cards

### 카드별 목표 매핑

```text
가사 카드: 한국어 + 영어
추가 섞을 언어: 일본어

한국어 카드 → 영어 + 일본어
영어 카드   → 한국어 + 일본어
```

- 선택 혼합 비율은 카드마다 두 목표 언어의 합계다.
- 목표 언어별 균등 방향을 제공하되 섹션·장르·서사에 따라 실제 분배는 유동적이다.
- 각 목표 언어는 균등 목표의 최소 40% 이상을 가져야 하며, 한 언어가 0%면 합계 비율이 맞아도 실패다.
- 후보 선택 beam score에 목표 언어별 최소 점유율과 언어 간 과도한 불균형 감점을 추가한다.
- 부족한 언어가 있으면 candidate expansion에 해당 언어와 실제/최소/이상 비율을 전달한다.
- expansion merge는 합계 점유율 증가뿐 아니라 부족 언어의 가창 단위가 증가하는 후보 교체도 허용한다.
- 공개 audit는 secondary 카드 목표를 `반대편 카드 언어 + 추가 선택 언어`로 계산하고, `targetLanguageCoveragePassed`, `missingTargetLanguages`, `targetLanguageMinimums`를 기록한다.
- 언어혼합 전 source structure repair는 섹션 태그의 첫 글자 유실과 비어 있는 Outro를 곡 내부 문맥으로만 복구한다.

엔진 버전: `v1-language-mix-three-language-card-targets-step16-active-31`

## 다음 곡 적용 언어 설정 복원 (step17)
- `App.tsx`의 `applyKeywordsToNext`가 저장곡의 가사/제목 언어, 언어혼합 여부, 혼합 비율, 혼합 대상 언어를 메인 생성 상태로 복원한다.
- `MusicApiGenerateModal.tsx`는 `initialLyricLanguages`를 받아 선택 순서를 보존해 초기화한다.
- Firebase/Auth/저장 구조는 변경하지 않고 기존 `appliedKeywords` 필드만 읽는다.


## 157차 — Final section and production-cue integrity repair

### 확인된 실패 경로

```text
정확한 섹션 슬롯 생성
→ 후처리에서 빈 필수 섹션 태그 제거
→ HardBan/훅/퍼포먼스 플랜 종료
→ 최종 로컬 보정이 사라진 슬롯을 삽입하지 못함
→ Bridge 누락 상태로 언어혼합이 태그를 잠금
```

프로덕션 cue도 초기 배열이 마지막 cue 정규화에서 탈락하면 이를 다시 채우는 단계가 없어 audit에만 누락으로 남았다.

### 복구 순서

1. `Chorus/Hook/Refrain → Bridge` 경계에서 빈 줄로 분리된 독립 문단을 안전하게 Bridge로 소유권 복구한다.
2. HardBan 이후 최종 필수 섹션 계약을 다시 검사한다.
3. 실제 missing/empty 필수 섹션만 targeted Gemini body repair로 복구한다.
4. canonical Section Performance Plan을 다시 적용한다.
5. 섹션별 프로덕션 cue 누락을 검사한다.
6. 같은 섹션의 다른 언어 카드 cue → canonical plan cue → 누락 섹션 전용 Gemini cue 순서로 채운다.
7. 구조와 cue가 완성된 뒤 언어혼합을 실행해 모든 잠금 줄을 보존한다.

### 공개 진단

- `sectionIntegrityRepair.missingSectionCards`
- `sectionIntegrityRepair.repairedSectionCards`
- `sectionIntegrityRepair.productionCueSections`
- `sectionIntegrityRepair.unresolvedSections`
- `sectionIntegrityRepair.extraGeminiCallsUsed`

섹션 무결성 버전: `v1-final-section-cue-integrity-step18-active-32`

## 158차 — 생성 옵션 초기화 경계
- `App.tsx`의 `applyKeywordsToNext`만 이전 곡의 언어 선택 및 언어혼합 설정을 복원한다.
- `clearAll`과 전역 `applyRandom`은 `mainGenerationLyricLanguages=['ko']`, 언어혼합 OFF, 혼합 비율 10%, 혼합 대상 언어 빈 배열로 복구한다.
- 목적: 다음곡 적용 정보가 일반 무작위/전체초기화 이후까지 누출되지 않도록 한다.

## 159차 — Post-language-mix final section/cue gate

### 확인된 실제 원인

```text
157차 섹션·cue 복구
→ 공개 cue 출력 정책
→ 잠금형 언어혼합
→ 언어혼합 결과로 audit 작성
→ 이후 복구 없음
```

복구 로직 자체보다 실행 위치가 최종 반환 경계보다 앞에 있었다. 이 때문에 한 카드의 `Pre-Chorus 2` cue, 양 카드의 `Intro/Chorus 1` cue, 보조 카드의 `Bridge`가 최종 출력에서 누락돼도 다시 채워지지 않았다. 보고서 역시 최종 복구 단계가 없어 누락 상태를 그대로 기록했다.

### 변경된 최종 흐름

```text
HardBan·구조 확정
→ public cue policy
→ pre-language-mix integrity gate
→ 완성 구조 스냅샷
→ locked whole-lyric language mix
→ post-language-mix final integrity gate
→ final language/section audit refresh
→ 반환
```

### 품질 보호

- 정상 섹션과 기존 혼합 가사 줄은 재작성하지 않는다.
- 누락 섹션은 먼저 동일 카드의 언어혼합 직전 스냅샷에서 해당 블록만 복원한다.
- 스냅샷에도 없는 필수 본문만 targeted section-body Gemini를 사용한다.
- cue는 sibling card → canonical plan → cue-only Gemini 순서로 채운다.
- cue 추가는 가창 비율 계산에서 제외되며, 섹션 본문이 긴급 복구된 경우 최종 혼합 비율과 언어별 coverage를 다시 측정해 보고서에 반영한다.

### 공개 진단

- `sectionIntegrityRepair.phaseRuns`
- `sectionIntegrityRepair.snapshotRestoredSections`
- `sectionIntegrityRepair.finalAuditStatus`
- 기존 누락/복구/cue/미해결/추가 호출 필드 유지

섹션 무결성 버전: `v1-post-language-mix-section-cue-integrity-step19-active-33`

## 831차 — Gemini 3.7 Flash / Interactions API / 5단 fallback

### 생산 모델 체인

```text
Gemini 3.7 Flash
→ Gemini 3.6 Flash
→ Gemini 3.5 Flash
→ Gemini 3.5 Flash-Lite
→ Gemini 3.1 Flash-Lite
```

- 기본 모델은 `gemini-3.7-flash`다.
- 3.7은 AI Studio `Get code`에서 확인된 모델 ID를 사용한다.
- 3.7은 Functions 서버 내부에서 `/v1beta/interactions`로 호출하고, 응답을 기존 `generateContent` 응답 모양으로 정규화해 앱/가사 엔진 인터페이스는 바꾸지 않는다.
- 3.6 이하 기존 모델은 기존 `/v1beta/models/{model}:generateContent` 경로를 유지한다.
- structured output은 기존 `responseMimeType/responseSchema`를 Interactions API의 `response_format`으로 변환한다.
- 3.7 요청은 `thinking_level=medium`, `store=false`를 사용한다.

### fallback 및 비용 가드

- 자동 전환 ON일 때만 다음 모델로 이동한다.
- 허용 사유는 upstream `429 rate/quota`, 명시적 `GEMINI_UPSTREAM_UNAVAILABLE`로 분류된 일시적 `500/502/503/504`, 그리고 3.7 단계적 rollout 호환을 위한 명시적 `404 model_not_found`다.
- auth/billing/schema/content/network/품질 문제는 다음 모델 호출을 만들지 않는다.
- 곡당 물리 Gemini 호출 절대 상한: 최대 5회.
- Functions 세션 상한: 최대 5회.
- 자동 품질 보정 operation 상한: 기존 최대 1회 유지.
- fallback 호출도 동일한 물리 호출 상한에 포함된다.

### 보안/호환성

- 사용자 Gemini API Key는 브라우저로 반환하지 않는다.
- Firebase Auth + App Check + Functions 서버 프록시 + `user_api_keys/{uid}` 서버 읽기 구조를 유지한다.
- Firestore 문서 구조나 기존 사용자 데이터 형식은 변경하지 않는다.

### 836 Gemini cooldown path
`generateContentWithModelFallback` 앞단에 사용자별 localStorage 모델 cooldown을 둔다. 429/명시적 transient 5xx/rollout 404에서만 기록하며, 활성 cooldown 모델은 물리 요청 전에 제거한다. 따라서 알려진 실패 모델은 `geminiProxyClient -> generateGeminiContent Function -> Firestore guard` 경로 자체를 타지 않는다. 정상 성공 시 해당 모델 cooldown은 즉시 해제된다.

### 837 — Gemini cooldown shared across every generation pass
- Temporary model cooldown is now written to in-memory session state before persistence, so the initial generation and all correction/repair passes share the same failure knowledge immediately.
- Guest cooldown state is migrated into the authenticated user scope if Firebase Auth hydrates after the first call.
- Cooldown-skipped models do not create a Firebase Function request and do not consume the physical Gemini request budget.

### 838 — server-contained Gemini fallback
- Browser sends one logical `generateGeminiContent` request with the cooldown-filtered model chain.
- Functions performs model fallback inside that same invocation only for explicit 429, 404 rollout mismatch, or transient 500/502/503/504.
- Primary Auth/App Check/account/API-key reads happen once. Each extra physical Gemini attempt only reserves the existing guard counter on `gemini_request_guards` so the 5-call physical ceiling remains enforced.
- Server returns per-attempt model/status/duration/usage metadata so the existing local admin audit stays physical-call accurate.
