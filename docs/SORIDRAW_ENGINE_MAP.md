# SORIDRAW 엔진 구조 지도

기준: 28차 `structured_cue_arrangement_timeline_fix`

이 문서는 앱 안에서 실제로 동작하는 생성 엔진, 보조 엔진, 검수 계층을 구분해 정리한다.
“엔진”은 반드시 파일 하나를 뜻하지 않는다. 하나의 목적을 위해 여러 함수와 파일이 묶인 기능 계층도 엔진으로 분류한다.

## 1. 전체 현황

- 현재 서비스 주 엔진: **V1 Classic**
- 선택 가능한 별도 엔진: **V2**
- 구조만 존재하고 아직 연결되지 않은 엔진: **V3**
- V1 내부 핵심 생성 엔진/보호 계층: **17개**
- 앱 공통 실행·저장·미리보기 엔진: **4개**

## 2. 전체 처리 순서

```text
사용자 선택/직접입력
→ 생성 버전 라우터
→ Story Context와 Mood 해석
→ 5단 프롬프트 조립
→ 섹션 구조/역할/보컬 소유권 설계
→ Section Performance Plan 설계
→ Gemini 1회 통합 생성
→ 섹션 렌더링/구조 가드
→ 큐 무결성·출력 무결성 검사
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

## 4. V1 핵심 생성 엔진 17개

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

- 역할: 섹션별 `arrangementAction`을 최종 `[Arrangement]`에 다시 반영하여 전체 프롬프트와 가사 태그가 같은 시간표를 사용하게 한다.
- 위치: `src/services/geminiService.ts`
- 적용: Hook 진입, 반주 축소, Bridge 전환, Final lift, Ending.
- 원칙:
  - 한 사건은 한 섹션에만 배치한다.
  - 최종 `[Arrangement]`와 해당 섹션의 `soundCue`/보컬 반응이 서로 모순되지 않게 한다.

### 4.17 Output Integrity / Fail-open Engine

- 역할: 다중 줄 태그, 비정상 가사 과분할, 중복 Intro/Outro, 빈 골격을 정리한다.
- 위치: `src/services/geminiService.ts`
- 적용: 사용자에게 보여주기 직전의 최종 가사.
- 원칙: 태그 품질 문제 때문에 완성된 곡 전체를 실패시키지 않는다.

## 5. 랩 모드 엔진

- 위치:
  - `src/services/generation/v1/sections/sectionBlueprint.ts`
  - `src/components/MusicApiGenerateModal.tsx`
  - `src/App.tsx`
- 동작:
  - OFF: Rap Section 없음
  - AUTO: 래퍼 역할 선택 시 Rap Section 자동 적용
  - ON: 래퍼가 없어도 Rap Section 강제 적용
- Stable: Verse 2 자리만 Rap Section으로 교체한다.
- Recommended/Experimental: ON과 강한 랩 장르 조건에서만 더 강한 랩 구조를 허용한다.

## 6. 앱 공통 실행 엔진 4개

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
