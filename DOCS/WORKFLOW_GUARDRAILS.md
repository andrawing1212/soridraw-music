# SORIDRAW 작업·배포 고정 지침

> 이 문서는 새 채팅/새 작업자가 저장소를 불러왔을 때 가장 먼저 읽어야 하는 고정 지침이다.

## 1. 작업 기준
- 저장소: `andrawing1212/soridraw-music`
- `preview` = 큰 수정/안전작업/프리뷰 검증
- `main` = 테스트앱 기준
- Firebase Hosting production = 정식앱
- 정식앱은 사용자가 명확히 `정식배포`라고 승인하기 전에는 절대 배포하지 않는다.

## 2. 주소
- Vercel Preview 비교 기준: https://soridraw-music-git-preview-andrawing1212.vercel.app/
- Firebase Preview: https://preview.soridraw.com/
- Firebase Preview site: https://soridraw-preview.web.app/
- 테스트앱: https://soridraw-music.vercel.app/
- 정식앱: https://soridraw.web.app/

## 3. 현재 최우선 목표
**현재 단계: 3/7 — 뮤직노트·라이브러리 페이지네이션 정상화.**

1단계 `Preview 빌드·배포 구조 단순화`와 2단계 `Vercel ↔ Firebase 기능 1:1 복구`는 COMPLETE 상태다.
이제 Hosting/Auth 구조를 더 바꾸지 않고 목록 읽기 문제만 분리해서 처리한다.

## 4. 배포 구조 목표와 현재 상태
최종 목표는 모든 환경에서 아래 단일 흐름이다.

`실제 소스 수정 -> TypeScript 검사 -> Vite build -> 해당 Firebase Hosting 배포 -> smoke test`

### Preview 상태
- **완료:** 빌드할 때 Python이 `src/**`를 다시 고치던 `predev / prebuild / prelint` lifecycle 제거
- **완료:** 기존 legacy 빌드가 생성하던 frontend 최종 런타임을 실제 소스로 동결
- **완료:** legacy 생성 `src/**`와 동결 `src/**` 동일 검증
- **완료:** legacy `dist`와 동결 `dist` 바이트 단위 동일 검증
- **완료:** Firebase Preview build/typecheck/deploy/smoke 통과
- **완료:** Vercel/Firebase Functions CORS, Explore CORS, Auth domain parity 확인
- **완료:** Firebase Preview 실제 Google 로그인 팝업 시작 확인
- **완료:** 이메일 인증 반환 URL에 Firebase Preview 주소 반영

Test/Production의 동일 구조 통일은 각각 4단계/6단계에서 진행한다.
필요한 기능 변경은 빌드 패치가 아니라 실제 소스에 확정 반영한다.

## 5. 현재 작업 로드맵
1. Preview 빌드·배포 구조 단순화 — **COMPLETE**
2. Vercel ↔ Firebase 기능 1:1 복구 — **COMPLETE**
3. 뮤직노트·라이브러리 페이지네이션 정상화 — **NEXT**
4. Firebase 테스트 환경 구조 통일
5. Auth / App Check / CORS 주소 최종 정리
6. 정식 Firebase 배포 구조 통일
7. Vercel 제거 여부 결정

한 번에 여러 단계를 섞지 않는다.

## 6. 진행상황 보고 — 절대 생략 금지
작업 중/작업 후 모든 보고 맨 위에 아래 항목을 표시한다.
- 전체 목표
- 현재 단계 `N/7`
- 현재 단계 진척도 `%`
- 전체 7단계 진척도
- 이번에 수정한 것
- 다음 작업
- Preview / Test / Production 배포 상태

사용자는 이 진척도를 기준으로 다음 계획을 세우므로 새 채팅에서도 반드시 유지한다.

## 7. 데이터 안전
Firestore/Auth/Functions의 저장 구조나 읽기 방식이 바뀌면 기존 사용자 데이터 호환성을 먼저 확인한다.
기존 데이터를 못 읽거나 덮어쓸 가능성이 있으면 배포하지 않는다.
데이터 삭제/덮어쓰기/백필은 별도 승인 없이 실행하지 않는다.

## 8. 현재 앱 버그 메모 — 3단계에서 처리
- 뮤직노트: 캐시 + 서버 이중 페이지네이션으로 전체 수/연속 목록이 깨짐. 약 493개 기준 전체 서버 체인을 정상화해야 함.
- 라이브러리: 서버에 더 있어도 `hasMore`가 false가 되면 더보기 버튼이 사라지는 현상.
- Explore: 현재 정상. 건드리지 않는다.

### 3단계 고정 원칙
- 기존 979~986/987 실험을 그대로 재개하지 않는다.
- 현재 동결된 실제 소스를 기준으로 원인을 다시 확인한다.
- 캐시와 서버 페이지네이션이 동시에 목록 길이/커서를 소유하지 않도록 읽기 경로를 단순화한다.
- 기존 사용자 데이터 삭제/덮어쓰기/백필 없이 해결을 우선한다.
- Firestore 인덱스/저장 필드/읽기 구조 변경이 정말 필요하면 호환성을 먼저 확인하고 별도 보고한다.
- Explore와 Hosting/Auth는 이번 단계에서 건드리지 않는다.

## 9. 2단계 Hosting/Auth 완료 기준 메모
- Firebase Preview custom/site 실제 JS/CSS가 현재 동결 source build와 동일함을 확인했다.
- Vercel/Firebase Origin 모두 Functions CORS 및 Explore CORS를 통과했다.
- Firebase Auth authorized domains에 Vercel Preview 및 Firebase Preview 주소가 모두 등록되어 있다.
- Firebase Preview에서 `Google로 계속하기` 클릭 후 실제 Google 팝업이 정상 시작된다.
- OAuth handler는 backend Auth 프로젝트 `soridraw-app-866a5.firebaseapp.com/__/auth/handler`를 사용한다.
- `src/constants/emailVerification.ts`는 Firebase Preview 3개 주소로 인증 완료 후 복귀할 수 있게 수정됐다.
- `src/data/v2PreviewShadowMirror.ts`의 Vercel 전용 Backend V2 shadow 경로는 별도 실험/진단 기능이므로 Hosting 이관과 섞지 않는다.

## 10. Functions 범위
1단계 legacy root build가 `functions/src/index.ts`에도 생성 차이를 만들 수 있다는 점은 확인했지만, 1단계에는 포함하지 않았다.
Functions/Rules/Firestore는 배포하지 않았으며, Functions는 별도 `functions/package.json` 빌드 체인을 유지한다.
Functions 구조 정리가 필요한 경우 별도 단계에서 호환성 검증 후 진행한다.

## 11. UI 고정 원칙
앱의 버튼/창에 외곽선(테두리 선)을 새로 넣지 않는다.
기존 디자인·반응형 동작은 요청 없는 한 변경하지 않는다.
