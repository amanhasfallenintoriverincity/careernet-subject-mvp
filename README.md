# 커리어넷 선택과목 추천 MVP

진로 키워드를 입력하면 커리어넷 Open API 기반으로 관련 직업, 학과, 고등학교 선택과목, 진로교육자료를 추천하는 Next.js MVP입니다.

현재 연동 흐름은 커리어넷 Open API v4.1 문서 기준에 맞춰 직업백과는 `/cnet/front/openapi/jobs.json` 목록과 `/cnet/front/openapi/job.json` 상세(`seq`)를 사용하고, 학과정보/진로교육자료/상담사례는 `getOpenApi`의 `MAJOR`/`MAJOR_VIEW`, `COSE`/`COSE_VIEW`, `COUNSEL`/`COUNSEL_VIEW`를 사용합니다. 선택과목 추천은 `MAJOR_VIEW` 상세 응답의 `relate_subject`, `subject_description` 값을 우선 사용하고, 응답이 부족할 때만 자체 fallback 규칙을 보정용으로 사용합니다.

## v0.5 기능

- 직업백과 API를 v4.1 문서 기준 `/cnet/front/openapi/jobs.json`, `/cnet/front/openapi/job.json?seq=...`, `jobcodes.json` 엔드포인트로 정렬
- `jobs` 목록 응답, `baseInfo`/`workList`/`departList` 상세 응답, 직업분류 코드표 응답 매핑 검증
- 원하는 지역(`regionName`)을 입력하면 해당 시도교육청 고등학교 목록을 NEIS `schoolInfo`로 조회
- 각 학교의 `hisTimetable` 수업내용과 추천 과목을 비교해 실제 시간표에서 확인된 학교만 선별
- 과목 점수 합산 기준으로 학교를 랭킹하고, 학교별 확인 과목/미확인 과목/주소를 표시
- 웹 화면과 `/api/recommend`에서 `regionName`, `ay`, `sem`, `grade` 조합 지원

지역 학교 찾기 예시 URL:

```text
/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학&regionName=충남&ay=2026&sem=1
```

API 예시:

```text
/api/recommend?keyword=인공지능%20개발자&interestArea=ai&regionName=충남&ay=2026&sem=1
```

## v0.4 기능

- NEIS Open API 연동 추가
- 학교명으로 `schoolInfo`를 조회해 시도교육청코드와 행정표준코드 자동 확보
- `schoolMajorinfo`, `schulAflcoinfo`로 학교 학과/계열 표시
- `hisTimetable`로 고등학교 시간표 수업내용을 조회해 추천 과목과 실제 시간표 과목 비교
- `tiClrminfo` 기반 강의실/학과 필터 확장 기반 마련
- 웹 화면과 `/api/recommend`에서 `schoolName`, `ay`, `sem` 파라미터 지원

NEIS 학교 확인 예시 URL:

```text
/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학&schoolName=천안오성고&ay=2026&sem=1
```

API 예시:

```text
/api/recommend?keyword=인공지능%20개발자&interestArea=ai&schoolName=천안오성고&ay=2026&sem=1
```

## v0.3 기능

- 학년, 관심 계열, 강점 과목, 부담 과목을 입력해 학생 맞춤형 추천 생성
- 커리어넷 학과 상세 과목, 진로 키워드 규칙, 학생 선호/부담 과목을 함께 반영한 점수 기반 과목 우선순위화
- 과목별 추천 근거와 점수를 카드로 표시
- 결과 상단에 직업/학과/자료/상담 데이터 커버리지와 추천 신뢰도 표시
- 실제 커리어넷 live 응답 필드(`dataTitle`, `dataContent`, `attFile`, `jbgp_code`, `jbgp_code_nm`) 매핑 보정
- `JOB` 검색 결과가 없을 때 입력 키워드의 유용한 토큰으로 재검색

예시 URL:

```text
/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학&weakSubjects=물리학Ⅰ
```

API 예시:

```text
/api/recommend?keyword=간호사&interestArea=bio&preferredSubjects=생명과학Ⅰ,화학Ⅰ
```

## v0.2 기능

- `COSE_VIEW` 상세 조회로 진로교육자료의 대상/활동유형/상세 설명을 카드에 표시
- `COUNSEL` + `COUNSEL_VIEW`로 비슷한 진로상담 사례 표시
- `JOB_TYPE`으로 커리어넷 직업분류 정보를 함께 노출
- `JOB_VIEW`, `MAJOR_VIEW`, `COSE_VIEW`, `COUNSEL_VIEW` 상세 조회 흐름을 테스트로 검증

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 커리어넷/NEIS API 키 설정

프로젝트 루트에 `.env.local` 파일을 만들고 다음 값을 넣으세요.

```env
CAREERNET_API_KEY=발급받은_커리어넷_API키
NEIS_API_KEY=발급받은_NEIS_API키
```

API 키가 없거나 응답이 비어 있으면 앱은 자체 fallback 추천 규칙으로 예시 결과를 보여줍니다. NEIS는 일부 샘플/공개 응답이 가능할 수 있지만, 안정적인 운영에는 `NEIS_API_KEY` 설정을 권장합니다.

## 주요 파일

- `app/page.tsx`: 메인 UI
- `app/api/recommend/route.ts`: 추천 API 라우트
- `lib/careernet.ts`: 커리어넷 API 호출/응답 매핑
- `lib/neis.ts`: NEIS API 호출, 학교 컨텍스트 생성, 추천 과목 시간표 매칭, 지역별 과목 개설 학교 검색
- `lib/recommendation.ts`: 과목 추출과 추천 로직
- `tests/recommendation.test.ts`: 추천 로직 테스트
- `tests/careernet.test.ts`: 커리어넷 상세 API 흐름 테스트
- `tests/neis.test.ts`: NEIS 응답 파싱, 학교 컨텍스트, 시간표 과목 매칭 테스트

## 검증

```bash
npm test
npm run build
```
