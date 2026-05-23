# 커리어넷 선택과목 추천 MVP

진로 키워드를 입력하면 커리어넷 Open API 기반으로 관련 직업, 학과, 고등학교 선택과목, 진로교육자료를 추천하는 Next.js MVP입니다.

현재 연동 흐름은 `JOB`/`MAJOR` 목록 검색에 그치지 않고, 검색 결과의 `jobdicSeq`와 `majorSeq`로 `JOB_VIEW`/`MAJOR_VIEW` 상세 API까지 조회합니다. 선택과목 추천은 `MAJOR_VIEW` 상세 응답의 `relate_subject`, `subject_description` 값을 우선 사용하고, 응답이 부족할 때만 자체 fallback 규칙을 보정용으로 사용합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 커리어넷 API 키 설정

프로젝트 루트에 `.env.local` 파일을 만들고 다음 값을 넣으세요.

```env
CAREERNET_API_KEY=발급받은_커리어넷_API키
```

API 키가 없거나 커리어넷 응답이 비어 있으면 앱은 자체 fallback 추천 규칙으로 예시 결과를 보여줍니다.

## 주요 파일

- `app/page.tsx`: 메인 UI
- `app/api/recommend/route.ts`: 추천 API 라우트
- `lib/careernet.ts`: 커리어넷 API 호출/응답 매핑
- `lib/recommendation.ts`: 과목 추출과 추천 로직
- `tests/recommendation.test.ts`: 추천 로직 테스트

## 검증

```bash
npm test
npm run build
```
