# SORIDRAW 장기 데이터 원칙 / 최종 8단계

## 고정 원칙

SORIDRAW 데이터 구조의 장기 목표는 다음과 같다.

**최초 1회 서버 → 기기 영구 캐시 → 이후 전체 재조회 금지 → 변경 신호만 실시간 수신 → 바뀐 데이터만 갱신**

중간에 UI 수정, 버그 수정, 배포 이전 작업이 끼어도 이 로드맵은 유지한다. 옆 작업이 끝나면 다음 미완료 단계로 복귀한다.

## 최종 8단계

1. **Explore 30초 전체 재조회 제거**
   - 화면 왕복/시간 경과만으로 `/v1/feed` 전체 재조회 금지.
2. **Explore/좋아요/뮤직노트 공개상태 영구 캐시**
   - 앱을 닫았다 다시 열어도 재사용.
   - UID별 데이터는 사용자별 분리.
3. **공통 Cache Envelope / version 기반 준비**
   - 모든 신규 캐시는 공통 메타 구조를 사용.
4. **Firebase PREVIEW → TEST → PRODUCTION 이전 안정화**
   - preview.soridraw.com → test.soridraw.com → soridraw.com.
5. **관리자 설정 1종으로 실시간 Version Signal 실험**
   - 장르/키워드 등 작은 데이터로 RTDB 또는 Remote Config 기반 변경 신호 검증.
6. **Delta Sync 공통 엔진**
   - 전체 재조회가 아니라 `lastVersion 이후 변경분`만 받기.
7. **실제 페이지 관리자 직접 편집과 연결**
   - Admin/Master가 실제 화면에서 추가/수정/순서/숨김/저장.
8. **앱 전체 확대**
   - 메뉴/키워드/설정/Explore/사용자별 데이터까지 공통 동기화 원칙 확대.

## SORIDRAW 공통 Cache Envelope

필수 메타:

- `schemaVersion`: 캐시 구조 버전
- `dataVersion`: 데이터 버전
- `uid`: 사용자별 캐시 분리. 공개 공용 데이터는 `null`
- `environment`: preview / test / production / local 분리
- `cacheKey`: 캐시 종류와 요청을 식별하는 키
- `sourceType`: explore_feed / explore_likes / music_note_publication 등 원천 구분
- `updatedAt`: 캐시 데이터가 마지막으로 바뀐 시각
- `syncedAt`: 서버와 마지막 정상 동기화 시각
- `syncCursor`: 다음 Delta Sync 기준점
- `serverRevision`: 서버 revision/version을 지원할 때 저장
- `deletedIds`: 삭제된 항목을 다시 살리지 않기 위한 tombstone 정보

필요할 때만 추가:

- `expiresAt`: 실제 만료가 있는 데이터
- `dirty`: 로컬 변경이 아직 서버에 확정되지 않은 상태
- `pendingMutationId`: 중복 저장/재시도 방지용 mutation 식별자

## 충돌 방지 원칙

- 서버가 최종 원본(Source of Truth)이다.
- 캐시는 서버 데이터를 빠르게 사용하는 로컬 복제본이다.
- API Secret, Firebase ID Token, App Check Token, 관리자 비밀정보는 영구 캐시에 저장하지 않는다.
- 임시/만료 URL을 캐시할 경우 `expiresAt`을 함께 저장한다.
- preview/test/production 캐시는 절대 섞지 않는다.
- UID가 다른 사용자 캐시는 절대 공유하지 않는다.
- 삭제는 단순 누락이 아니라 tombstone/version 변경으로 처리한다.

## Music Note 캐시 후보

- 곡 기본정보
- 폴더 위치/정렬순서
- 선택 키워드
- 좋아요/싫어요
- 잠금 상태
- 공개/비공개 상태
- 메모 및 Music Note 자체 정보
- 마지막 수정 revision

## Explore 캐시 후보

- 피드 카드 데이터
- 카드 순서
- 좋아요 상태
- 공개 상태
- `feedVersion`
- `nextCursor`
- 마지막으로 받은 게시물 기준점

## 현재 단계

2026-08-31 기준: **1~3단계부터 PREVIEW에서 구현/검증 후 4단계로 복귀한다.**
