# SORIDRAW 누적 작업 일지

> 모든 의미 있는 진단·수정·검증·배포 작업은 삭제하지 않고 아래에 계속 append한다.

## 2026-08-30 — Stage 3 실사용 검증 실패 및 긴급 롤백
- 사용자 영상 확인: Music Note 더보기 반복 중 `favorites:getDocs 584`가 한 번에 발생.
- CACHE LIVE 누적: 브라우저 SDK `읽기 669 / 쓰기 81`까지 증가.
- 사용자 보고: Music Note는 캐시를 오래 소진한 뒤에야 서버 기준 목록이 정상에 가까워짐. Suno Library는 진입 후 서버 비용이 계속 증가하여 즉시 앱 종료.
- 판정: Stage 3의 대량 compatibility scan + 기존 bundle/cache write 경로 결합은 비용 안전 기준 위반. 정상으로 인정하지 않음.
- 조치: `preview` 앱 코드를 Stage 3 적용 직전 안전 기준 `0b5744d2fe88b5e24de9a9893f7f9f37c6a9dda9`로 강제 롤백.
- 재설계 원칙: 전체/2,000건 scan 금지. 캐시는 첫 화면 표시만 담당. 서버 20개 단위 페이지를 실제 목록의 유일한 기준으로 사용. 더보기는 캐시 소진 대기 없이 서버 다음 페이지 요청. 실제 남은 곡 수만 표시.
- 데이터 안전: Firestore 원본 문서/Rules/Functions/Auth/Test/Production 변경 없음.
