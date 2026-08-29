# SORIDRAW Hosting Migration Progress

## 전체 목표
Vercel 정상 앱을 Firebase Hosting + 새 도메인에서 동일하게 재현하고 Preview/Test/Production을 동일한 단순 배포 구조로 통일한다.

## 현재 진척도
- 현재 단계: **3/7 뮤직노트·라이브러리 페이지네이션 정상화 — 실사용 검증 실패 / 재설계 중**
- 3단계 진척도: **52%**
- 전체 진척도: **2/7 완료 + 3단계 재작업 중**
- 현재 우선순위: **비용 폭주 제거 → 서버 20개 단위 단일 페이지 체인 → 실제 남은 곡 수 표시**

## 단계별 상태
| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | Preview 빌드·배포 구조 단순화 | COMPLETE |
| 2 | Vercel ↔ Firebase 기능 1:1 복구 | COMPLETE |
| 3 | 뮤직노트·라이브러리 페이지네이션 정상화 | **실사용 검증 실패 / 재설계** |
| 4 | Firebase 테스트 환경 구조 통일 | 대기 |
| 5 | Auth / App Check / CORS 주소 최종 정리 | 일부 완료 / 대기 |
| 6 | 정식 Firebase 배포 구조 통일 | 대기 |
| 7 | Vercel 제거 여부 결정 | 대기 |

## Stage 3 실패 근거
- 사용자 영상에서 Music Note 더보기 반복 중 `favorites:getDocs 584` 확인.
- CACHE LIVE 누적 브라우저 SDK `읽기 669 / 쓰기 81`까지 증가.
- 사용자 보고: Suno Library 진입 후 서버 비용이 계속 증가해 즉시 앱 종료.
- 판정: 대량 compatibility scan과 기존 cache/bundle write 경로 결합은 비용 안전 기준 위반.

## 현재 조치
- Preview 앱 코드를 Stage 3 적용 직전 안전 기준 `0b5744d2fe88b5e24de9a9893f7f9f37c6a9dda9`로 롤백.
- Stage 3 실패에서 추가된 대량 scan/page-meta 변경은 프리뷰에서 제거.
- **이 커밋은 안전 기준을 Firebase Preview에 다시 배포하기 위한 롤백 배포 트리거다.**
- Test(main) / Production은 변경하지 않음.

## Stage 3 재설계 원칙
- 전체/2,000건 scan 금지.
- 캐시는 최초 화면 빠른 표시만 담당.
- 서버 20개 단위 페이지가 실제 목록의 유일한 기준.
- 더보기는 캐시 소진을 기다리지 않고 서버 다음 페이지 요청.
- 더보기 숫자는 권위 있는 서버 총량 기준의 실제 남은 곡 수만 표시.
- Firestore 원본 데이터/Functions/Rules/Auth/Explore/Production 변경 금지.

## 기록 규칙
모든 작업은 `DOCS/WORK_LOG.md`에 누적 기록한다.
