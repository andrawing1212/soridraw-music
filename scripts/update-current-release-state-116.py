from pathlib import Path

p = Path('DOCS/CURRENT_RELEASE_STATE.md')
text = p.read_text(encoding='utf-8')
marker = '## 0M. PREVIEW 115 — TEST 실사용 FAIL 후 공유 파생 캐시 정합성/비용 1~5단계 수정 완료\n'

if marker not in text:
    section = """## 0M. PREVIEW 115 — TEST 실사용 FAIL 후 공유 파생 캐시 정합성/비용 1~5단계 수정 완료

- 2026-09-17 TEST 실사용에서 PREVIEW/TEST 간 좋아요 수, 공개프로필 공개곡 수, 좋아요곡 수가 다르고 공개프로필 진입 시 D1 행 읽기 급증이 확인되어 **TEST 실사용 검증 FAIL / PRODUCTION 승격 금지**로 판정했다.
- 수정은 `preview`에서만 진행했다. TEST `main`과 PRODUCTION은 변경하지 않았고, D1/Firestore 사용자 원본 데이터 migration·백필·복제·삭제는 전혀 수행하지 않았다.
- **1단계 Feed 공유 파생 캐시:** 환경별 Feed R2가 공유 D1 변경을 놓쳐 PREVIEW/TEST 숫자가 갈라지는 구조를 공유 기준으로 정리했다. UI/CSS 변경 없음.
- **2단계 공개프로필:** 환경별 profile R2 불일치와 사용자 진입 시 대량 D1 lazy repair를 줄이고, 기기/Edge/공유 profile R2 우선 + 필요한 경우 bounded/materialized 복구 순서로 정리했다. 기존 invalid-ref negative-cache/limiter 보호 유지.
- **3단계 개인 좋아요/팔로우:** TEST 환경 진입만으로 개인 좋아요/팔로우 상태를 환경별 R2에서 D1로 재구성하던 비용을 줄이기 위해 공유 개인 상태 기준으로 정리했다. 114 제품 commit `4233de0352733c364a9eed155c095bdcca29c14c`에서 TypeScript/Build 및 112~114 회귀검사 PASS.
- **4단계 좋아요곡 카드:** 사용자별 카드 복제 대신 공개곡 1개당 공유 카드 1개를 재사용하도록 정리했다. 공유 Feed에 이미 있는 카드는 D1 없이 승격 가능하고, 진짜 누락 카드만 곡 ID 한정 조회 후 공유 캐시로 남긴다. 공개/비공개/옵션/likeCount는 해당 곡 카드만 갱신. 제품 기준 commit `95ca3310076f449ad8b850afa1977053e7a253ac`, 앱 **115**, 112~115 회귀검사 + TypeScript + Build PASS.
- **5단계 Music Note / Library 비용 감사:** 제품 기능 수정 없이 현재 warm/cold 비용 보호를 독립 검증했다. 최종 Audit Run `35193767143` **SUCCESS**. `116 warm-cost`, `NO-FULL-SONG-READ`, Library 030, 기존 Music Note/Library 029 모두 PASS; TypeScript PASS; Build PASS; `dist/` 빌드 산출물 제외 소스/설정/백엔드 무변경 PASS.
- 5단계 정적 계약상 Music Note 정상 페이지 크기 캐시는 재진입 때 재사용하고 정상 진입으로 서버 bundle 재발행을 하지 않는다. Recent Songs는 로컬 상태 + 동일/낮은 version이면 `getDocFromServer` 0, `user_structures`는 동일/낮은 신호에서 재조회 0, Library는 durable/session cache가 최신이면 서버 검증 0이다. 새 기기/캐시 손상도 owner 전체곡 조회 금지, bounded page만 허용한다.
- 감사 중 과거 구현명에 고정된 stale 1030/1031/retired recovery verifier가 현재 코드와 충돌하던 테스트 유지보수 문제를 정리했다. 비용 금지 규칙 자체는 약화하지 않았고, 전체 owner scan 금지와 warm 0-read 의미 검사를 현재 구조 기준으로 유지했다.
- **현재 제품 기준:** PREVIEW 앱 115 제품 기능 commit `95ca3310076f449ad8b850afa1977053e7a253ac`; 이후 preview HEAD의 추가 commit은 116 감사/검증 tooling 정리이며 제품 UI/데이터 동작 추가 변경은 없다.
- **배포 상태:** 이번 112~115 수정본은 아직 Firebase PREVIEW / Explore Worker 실배포 전. 따라서 실제 `preview.soridraw.com`의 PREVIEW↔TEST 숫자 일치, 공개프로필 D1 읽기, 개인 좋아요 D1 읽기, Music Note/Library CACHE LIVE warm 재진입은 **실사용 검증 전**이다.
- **다음 단계:** 사용자 배포 요청 전에는 배포하지 않는다. PREVIEW 배포 승인 시 115 전체본을 고정해 TypeScript/Build/회귀검사 후 필요한 Worker + Firebase PREVIEW만 배포하고, PC/모바일에서 Explore/공개프로필/좋아요곡 정합성 및 D1/Firestore warm 0-read를 실측한다. PASS 전 TEST 재승격 금지, PRODUCTION은 별도 명확한 정식배포 승인 전 금지.

"""
    anchor = '## 0L. TEST 승격 — PREVIEW 111 전체본 배포 완료\n'
    if anchor not in text:
        raise SystemExit('0L anchor missing')
    text = text.replace(anchor, section + anchor, 1)

lines = text.splitlines()
for i, line in enumerate(lines[:8]):
    if line.startswith('최종 갱신:'):
        lines[i] = '최종 갱신: 2026-09-17 KST — PREVIEW 115 공유 파생 캐시/비용 1~5단계 수정·정적 감사 완료, 배포 전'
        break
else:
    raise SystemExit('top update line missing')

p.write_text('\n'.join(lines) + '\n', encoding='utf-8')
