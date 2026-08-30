# SORIDRAW 장기 데이터 원칙 / 최종 8단계

## 최상위 규칙 — 서버비용 폭발 방지

SORIDRAW의 모든 데이터 기능은 **사용자 수와 데이터량이 커져도 서버 읽기/호출 비용이 함께 폭발하지 않는 구조**를 최우선으로 한다.

### 1. 동일 데이터 세트의 전체 서버 구축은 최대 1회

- 같은 `uid + environment + schemaVersion + cacheKey` 기준으로 전체 bootstrap/full sweep는 최대 1회만 허용한다.
- 한 번 받은 데이터는 영구 캐시에 남기고 화면 이동, 앱 재실행, 시간 경과만으로 같은 전체 데이터를 다시 읽지 않는다.
- 이후 갱신은 `version / revision / cursor / changedIds` 기반 Delta Sync만 사용한다.
- 페이지네이션은 사용자가 아직 받지 않은 다음 묶음을 처음 요청할 때만 서버에서 가져오고, 이미 받은 페이지/묶음은 캐시에서 재사용한다.
- 명시적 복구/전체 동기화, 캐시 schema 불일치, 계정/환경 변경처럼 전체 재구축이 실제로 필요한 경우만 예외로 한다.

> 여기서 "최대 1회"는 네트워크를 평생 한 번만 쓴다는 뜻이 아니라, **동일한 대량 데이터 전체를 반복해서 다시 읽지 않는다**는 기준이다.

### 2. 여러 정보는 항목별 호출이 아니라 묶음으로 가져온다

- 곡마다 API/DB를 한 번씩 호출하는 N+1 구조를 금지한다.
- 최초 bootstrap은 가능한 한 `snapshot / manifest / batch endpoint` 하나의 논리적 요청으로 묶는다.
- 좋아요, 공개상태, 카드 메타처럼 화면 구성에 필요한 상태도 현재 표시 묶음의 ID들을 batch로 전달한다.
- 동일 도메인의 실시간 변경감지는 항목별 listener/socket을 만들지 않고 **공유 Version Signal 채널**로 묶는다.
- 한 화면에서 같은 데이터 원천에 중복 listener, 중복 fetch, 중복 Worker 호출을 만들지 않는다.

### 3. 데이터가 많아져도 사용자당 전체 read가 증가하지 않게 한다

- Explore에 100곡이 있어도, 10만 곡이 있어도 첫 화면은 필요한 20~40곡 정도만 가져온다.
- D1/Firestore 쿼리는 적절한 인덱스와 cursor pagination을 사용해 전체 데이터량 증가가 사용자당 scan/read 증가로 이어지지 않게 한다.
- 신규가입자에게 기존 전체 데이터 수천/수만 건을 일괄 다운로드시키지 않는다.
- 공개 공용 데이터는 Cloudflare Edge Cache/CDN에서 최대한 처리해 동일 요청이 D1까지 반복 도달하지 않게 한다.
- 목표는 **정보량이 증가할수록 사용자당 반복 서버비용은 증가하지 않거나 오히려 캐시 효율로 감소하도록 유지**하는 것이다.

### 4. 캐시는 쉽게 사라지지 않도록 보호하되 서버 안전장치를 함께 둔다

- 작은 상태/메타는 영구 저장소를 사용하고, 큰 데이터는 IndexedDB 중심으로 유지한다.
- 앱 코드 업데이트만으로 정상 캐시를 지우지 않는다. `schemaVersion`이 실제로 호환되지 않을 때만 해당 캐시를 재구축한다.
- 로그아웃 시에도 공개 공용 캐시는 유지할 수 있으며, UID 데이터는 계정별로 분리해 다른 사용자에게 절대 노출하지 않는다.
- 브라우저/OS가 저장공간을 강제로 지우는 상황까지 100% 막을 수는 없다. 이 경우에도 서버 원본 전체 DB를 직접 훑지 않고 **Edge에 캐시된 snapshot/manifest 또는 최소 bootstrap endpoint**에서 복구하는 구조를 우선한다.
- 복구 후 즉시 영구 캐시를 다시 만들고 이후에는 Delta Sync로 복귀한다.

### 5. 서버비용보다 데이터 안전/정합성을 희생하지 않는다

- 서버는 최종 원본(Source of Truth)이다.
- 캐시는 서버 데이터의 로컬 복제본이며, 다른 사용자의 데이터/관리자 권한/Secret을 신뢰의 원본으로 사용하지 않는다.
- 사용자 수정은 mutation ID/revision으로 중복 적용과 충돌을 막고, 삭제는 tombstone으로 추적한다.

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

2026-08-31 기준: **1~4단계 완료.**

- 1단계: Explore 30초 전체 재조회 제거 및 재진입 검증 완료.
- 2단계: Explore/좋아요/Music Note 공개상태 영구 캐시 및 앱 재실행 후 서버 재조회 0 검증 완료.
- 3단계: 공통 Cache Envelope/version 기반 적용 완료.
- 4단계: Firebase 도메인 이전 안정화 완료.
  - PREVIEW: `preview.soridraw.com` 정상.
  - TEST: `main → soridraw-test → test.soridraw.com` 빌드/배포/HTTPS/Hosting parity/Auth/Functions/Explore CORS 검증 완료.
  - PRODUCTION: `soridraw.com → soridraw` 및 `www.soridraw.com → soridraw.com` 연결/HTTPS/현재 Production Hosting parity/Auth/Functions/Explore CORS 검증 완료. 새 Production 앱 코드 배포는 수행하지 않음.

**다음 고정 작업은 5단계 `실시간 Version Signal 실험`이다.** 작은 관리자 설정 1종으로 먼저 검증한 뒤, 성공한 방식만 6단계 Delta Sync 공통 엔진으로 승격한다.
