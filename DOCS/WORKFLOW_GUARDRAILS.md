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
Vercel에서 정상 동작하던 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현한다.
새 기능/새 설계를 섞지 않는다. Hosting 이전과 앱 기능 수정은 단계별로 분리한다.

## 4. 배포 구조 목표
빌드할 때 Python이 실제 소스(`src/**`)를 다시 고치는 구조를 제거한다.
최종 목표는 모든 환경에서 아래 단일 흐름이다.

`실제 소스 수정 -> TypeScript 검사 -> Vite build -> 해당 Firebase Hosting 배포 -> smoke test`

필요한 기능 변경은 빌드 패치가 아니라 실제 소스에 확정 반영한다.

## 5. 현재 작업 로드맵
1. Preview 빌드·배포 구조 단순화
2. Vercel ↔ Firebase 기능 1:1 복구
3. 뮤직노트·라이브러리 페이지네이션 정상화
4. Firebase 테스트 환경 구조 통일
5. Auth / App Check / CORS 주소 최종 정리
6. 정식 Firebase 배포 구조 통일
7. Vercel 제거 여부 결정

한 번에 여러 단계를 섞지 않는다.

## 6. 진행상황 보고 — 절대 생략 금지
작업 중/작업 후 모든 보고 맨 위에 아래 항목을 표시한다.
- 전체 목표
- 현재 단계 `N/7`
- 전체 진척도 `%`
- 이번에 수정한 것
- 다음 작업
- Preview / Test / Production 배포 상태

사용자는 이 진척도를 기준으로 다음 계획을 세우므로 새 채팅에서도 반드시 유지한다.

## 7. 데이터 안전
Firestore/Auth/Functions의 저장 구조나 읽기 방식이 바뀌면 기존 사용자 데이터 호환성을 먼저 확인한다.
기존 데이터를 못 읽거나 덮어쓸 가능성이 있으면 배포하지 않는다.
데이터 삭제/덮어쓰기/백필은 별도 승인 없이 실행하지 않는다.

## 8. 현재 앱 버그 메모 — 1단계 완료 전 수정 금지
- 뮤직노트: 캐시 + 서버 이중 페이지네이션으로 전체 수/연속 목록이 깨짐. 약 493개 기준 전체 서버 체인을 정상화해야 함.
- 라이브러리: 서버에 더 있어도 `hasMore`가 false가 되면 더보기 버튼이 사라지는 현상.
- Explore: 현재 정상. 건드리지 않는다.

위 두 앱 버그는 **1단계 Preview 빌드·배포 구조 단순화 완료 후** 수정한다.

## 9. UI 고정 원칙
앱의 버튼/창에 외곽선(테두리 선)을 새로 넣지 않는다.
기존 디자인·반응형 동작은 요청 없는 한 변경하지 않는다.
