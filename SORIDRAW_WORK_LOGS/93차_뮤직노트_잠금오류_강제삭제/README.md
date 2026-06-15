# SORIDRAW 93차 작업 기록

## 기준
- 기준 ZIP: SORIDRAW_92차_뮤직노트_수노URL연결_상세화면이동.zip

## 작업 내용
- 뮤직노트에서 잠금해제 후에도 삭제가 막히는 곡을 처리할 수 있도록 보강.
- 잠금해제를 누른 곡이 여전히 잠긴 곡으로 삭제 차단될 경우 확인 문구 표시:
  - "잠금 상태에 오류가 있습니다. 강제로 삭제할까요?"
- 확인 시 해당 곡 ID 기준으로 잠금 해제 후 삭제 실행.
- 보관함 삭제 대상 탐색을 제목/프롬프트 우선이 아니라 문서 ID 우선으로 수정.

## 변경 파일
- src/pages/FavoritesPage.tsx
- src/App.tsx

## 안전 조건
- Firestore/Auth/Functions/Rules 구조 변경 없음.
- 기존 데이터 구조 변경 없음.
- chrome-extension 폴더 포함 없음.
