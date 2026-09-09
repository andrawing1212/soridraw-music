# SORIDRAW Deployment Progress

> 상세 현재 상태의 단일 기준은 `DOCS/CURRENT_RELEASE_STATE.md`다. 이 파일은 배포 관점 요약이다.

최종 갱신: 2026-09-10 KST

## 현재 릴리스
- PREVIEW: 052 배포/검증 완료 — source `preview@2819dcf57904a8db7222a89c18965c28b94da60a`
- TEST: 052 배포/검증 완료 — source `main@3b574c05589230f077eceff98190edd4b5195f75`
- PREVIEW/TEST source tree 동일: `8a41bf58041edf6ba304295e0a364595494baae5`
- PRODUCTION: 051/052 작업으로 승격하지 않음

## 최근 완료
- Explore 사용자 원본 데이터 공유 구조 전환
- PREVIEW/TEST Explore Feed 30곡 일치 검증
- 공개프로필 기기별 오래된 캐시 문제 완화용 051 복구 반영
- 앱 업데이트 버전 소스를 `public/app-version.json` 하나로 통일
- TEST 042 아이콘/브랜딩 유지

## 현재 최우선 문제
배포 기능 문제보다 **백엔드 비용 구조**가 우선이다.

- `/feed-revision`이 revision 변경 후 latest+popular 전체 Feed 재생성을 유발할 수 있음
- 공개프로필 051 복구 로직이 새 캐시/업데이트 후 최초 요청에서 원본 D1 materialize를 유도함
- 10만 사용자 기준으로 업데이트/첫 진입이 원본 DB read 폭증으로 이어질 수 있으므로 현 구조를 장기 운영 기준으로 승인하지 않음

## 다음 단계
1. Codex High — PREVIEW에서 Explore/Public Profile 초저비용 구조 구현, 배포 금지
2. Work — 대상 commit 독립 감사, 수정 금지
3. ChatGPT — GitHub/실제 환경 최종 확인
4. 사용자 PREVIEW 실사용 테스트
5. 통과 시 TEST 승격
6. PRODUCTION은 별도 승인 필요

## 이번 단계 배포 정책
- PREVIEW 코드 수정은 가능
- Codex 구현 단계에서는 배포하지 않음
- TEST는 Work + 사용자 검증 전 승격 금지
- PRODUCTION 변경 금지
