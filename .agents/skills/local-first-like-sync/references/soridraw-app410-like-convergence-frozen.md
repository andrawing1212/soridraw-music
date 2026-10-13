# SORIDRAW PREVIEW app410 — PC↔모바일 좋아요 수렴 사용자 실기기 PASS 보호 기준

## 현재 지위 (2026-10-13 KST)
- 사용자 명시 피드백: app410 PREVIEW에서 마지막 남은 `골목길 탐험대` PC 빈 하트 / 모바일 꽉 찬 하트 불일치가 해결되어 **"통과야"** 확인.
- app410은 현재 좋아요/해제 개인 membership의 최신 사용자 실기기 보호 기준이다.
- 이번 PASS는 **app400~407 Stage416 client 실험으로 생긴 초기 PC↔모바일 불일치 복구 + same-version retained row 단일 하트 drift 복구**에 대한 확인이다.
- TEST/PRODUCTION 승격 승인은 아니다. 현재 PREVIEW 보호 기준만 갱신한다.

## 고정 배포 증거
| 대상 | 확인 |
|---|---|
| 제품 app410 | `ffd49ca4a87344ac4aac9f2827198440d168cafd` |
| PREVIEW release trigger | `eb533c91c5577a0215cf0242358da8bf91debad8` |
| Quality | Run `38275331236` SUCCESS |
| Stage416 readonly preflight | Run `38275331141` SUCCESS |
| Follow regression | Run `38275331107` SUCCESS |
| PREVIEW Hosting | Run `38275509549` SUCCESS, app410 / exact build PASS |
| RTDB Rules | SKIPPED |
| Functions / Worker / D1 / R2 | app410 배포에서 변경 없음 |
| Shared user data | migration/backfill/delete/overwrite 없음 |
| TEST / PRODUCTION | unchanged PASS |

## 반드시 보호할 app410 동작
- `STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE=false`.
- `STAGE416_SHARED_RTDB_BATCH_ACTIVE=false`.
- app399 계열 검증된 canonical `/v1/me/likes/batch` 정산 경로를 유지한다.
- app409 Auth-ready recovery는 **기존 durable outbox에 retryCount=0 실제 pending mutation이 있을 때만** canonical flush를 예약한다. empty outbox 방문은 서버 IO 0.
- app410 same-version retained repair는 **기존 UID RTDB listener가 이미 받은 exact retained signal**만 로컬 membership과 대조한다.
- same-version retained repair는 서버 추가 read/write 0, public `likeCount` 변경 0, whole feed/catalog scan 0.
- pending outbox / unpublished signal retry / active private intent / future Stage420 hint / opposite unresolved guard가 있으면 retained repair가 덮어쓰지 않는다.
- PC·모바일 어느 한쪽의 stale local heart 한 row 때문에 전체 개인 좋아요 카탈로그를 초기화·재생성하지 않는다.

## 비용·기능 합격 기준
- 앱 업데이트나 정상 재방문만으로 whole liked-list / whole Feed / D1 scan을 하지 않는다.
- 변경 없는 계정의 app409 startup recovery는 서버 요청 0.
- app410 retained repair는 기존 listener payload 재사용이므로 추가 네트워크 0.
- 실제 클릭은 기존 canonical batch + accepted 127 changed-track signal 경로를 따른다.
- 비용 최적화 때문에 현재 정상 PC↔모바일 하트/숫자 동작을 약화하거나 Stage416 5분 client path를 다시 켜지 않는다.

## Stage416 재개 규칙
- Stage416 backend 연구는 app410 사용자 경로와 분리한다.
- client flag는 **서버 accepted → RTDB window create → Eventarc → Cloud Task → Worker/D1 acceptance → public R2까지 독립 E2E 증명 전 OFF 유지**.
- 기능을 다시 켜기 전 app410 frozen regressions + TypeScript + Build + PREVIEW 실기기 검증 필요.
- TEST/PRODUCTION은 사용자 별도 승인 전 변경 금지.
