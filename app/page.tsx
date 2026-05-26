import Link from 'next/link';
import { getCareerRecommendation } from '../lib/careernet';
import { buildSchoolSubjectAvailability, getNeisSchoolContext, type SchoolSubjectAvailability } from '../lib/neis';
import { parseStudentProfile } from '../lib/profile';
import type { Recommendation } from '../lib/recommendation';

const examples = ['인공지능 개발자', '간호사', '웹툰 작가', '마케팅 전문가'];

type PageProps = {
  searchParams: Promise<{
    keyword?: string;
    grade?: string;
    interestArea?: string;
    preferredSubjects?: string;
    weakSubjects?: string;
    schoolName?: string;
    ay?: string;
    sem?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const keyword = params.keyword?.trim() || '';
  const studentProfile = parseStudentProfile(params);
  const result = keyword ? await getCareerRecommendation(keyword, { studentProfile }) : null;
  const schoolName = params.schoolName?.trim() || '';
  const schoolContext = result && schoolName
    ? await getNeisSchoolContext(schoolName, { ay: params.ay || undefined, sem: params.sem || undefined, grade: studentProfile.grade })
    : null;
  const schoolAvailability = result && schoolContext
    ? buildSchoolSubjectAvailability(result.recommendedSubjects.scored ?? [], schoolContext)
    : null;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">CareerNet + NEIS Open API MVP v0.4</p>
        <h1>진로를 입력하면 나에게 맞는 고등학교 선택과목을 추천해드립니다.</h1>
        <p className="subtitle">
          직업정보, 학과정보, 진로교육자료를 연결하고 NEIS 학교 시간표까지 대조해 우리 학교에서 확인되는 과목을 함께 보여주는 MVP입니다.
        </p>
        <form className="search-panel" action="/" method="get">
          <div className="search-main">
            <input
              name="keyword"
              defaultValue={keyword || '인공지능 개발자'}
              placeholder="예: 인공지능 개발자, 간호사, 웹툰 작가"
              aria-label="진로 키워드"
            />
            <button>추천 받기</button>
          </div>
          <fieldset className="profile-fields">
            <legend>나에게 맞춤 설정</legend>
            <label>
              학년
              <select name="grade" defaultValue={studentProfile.grade ?? ''}>
                <option value="">선택 안 함</option>
                <option value="1">고1</option>
                <option value="2">고2</option>
                <option value="3">고3</option>
              </select>
            </label>
            <label>
              관심 계열
              <select name="interestArea" defaultValue={studentProfile.interestArea ?? ''}>
                <option value="">선택 안 함</option>
                <option value="ai">AI·소프트웨어</option>
                <option value="bio">의학·생명·보건</option>
                <option value="design">디자인·콘텐츠</option>
                <option value="business">경영·경제</option>
                <option value="general">아직 모르겠어요</option>
              </select>
            </label>
            <label>
              좋아하거나 강점 있는 과목
              <input name="preferredSubjects" defaultValue={params.preferredSubjects ?? ''} placeholder="예: 정보, 수학" />
            </label>
            <label>
              부담스러운 과목
              <input name="weakSubjects" defaultValue={params.weakSubjects ?? ''} placeholder="예: 물리학Ⅰ" />
            </label>
            <label>
              학교명
              <input name="schoolName" defaultValue={schoolName} placeholder="예: 천안오성고" />
            </label>
            <label>
              NEIS 조회 학년도/학기
              <span className="inline-fields">
                <input name="ay" defaultValue={params.ay ?? '2026'} placeholder="2026" />
                <select name="sem" defaultValue={params.sem ?? '1'}>
                  <option value="1">1학기</option>
                  <option value="2">2학기</option>
                </select>
              </span>
            </label>
          </fieldset>
        </form>
        <div className="chips">
          {examples.map((example) => (
            <Link key={example} href={`/?keyword=${encodeURIComponent(example)}`}>
              {example}
            </Link>
          ))}
          <Link href="/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학&weakSubjects=물리학Ⅰ">
            AI 맞춤 예시
          </Link>
          <Link href="/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학&schoolName=천안오성고&ay=2026&sem=1">
            NEIS 학교 확인 예시
          </Link>
        </div>
      </section>

      {result ? <ResultView result={result} schoolAvailability={schoolAvailability} schoolName={schoolName} /> : <EmptyState />}
    </main>
  );
}

function EmptyState() {
  return (
    <section className="empty card">
      <h2>이 MVP에서 확인할 수 있는 것</h2>
      <ul>
        <li>진로 키워드 기반 관련 직업</li>
        <li>관련 학과와 커리어넷 연계 과목</li>
        <li>학생 입력값을 반영한 강력 추천/추가 추천 선택과목</li>
        <li>과목별 추천 근거와 데이터 신뢰도</li>
        <li>NEIS 학교 시간표 기반 실제 확인 과목 비교</li>
        <li>추천 진로교육자료와 비슷한 상담사례</li>
      </ul>
      <Link className="primary-link" href="/?keyword=인공지능%20개발자&interestArea=ai&preferredSubjects=정보,수학">예시 결과 보기</Link>
    </section>
  );
}

function ResultView({ result, schoolAvailability, schoolName }: { result: Recommendation; schoolAvailability: SchoolSubjectAvailability | null; schoolName: string }) {
  return (
    <section className="results">
      <div className="card highlight">
        <div className="row">
          <div>
            <p className="eyebrow">추천 결과</p>
            <h2>{result.keyword}</h2>
          </div>
          <span className="badge">{result.source === 'careernet' ? 'CareerNet' : 'Fallback'}</span>
        </div>
        {result.dataCoverage && (
          <div className="coverage" aria-label="추천 데이터 커버리지">
            <span>신뢰도 {confidenceLabel(result.dataCoverage.confidence)}</span>
            <span>직업 {result.dataCoverage.jobs}건</span>
            <span>학과 {result.dataCoverage.majors}건</span>
            <span>자료 {result.dataCoverage.materials}건</span>
            <span>상담 {result.dataCoverage.counselingCases}건</span>
          </div>
        )}
        <p>{result.recommendedSubjects.reason}</p>
        <h3>강력 추천 과목</h3>
        <TagList items={result.recommendedSubjects.strong} />
        <h3>추가 추천 과목</h3>
        <TagList items={result.recommendedSubjects.optional} muted />
        {result.recommendedSubjects.scored && result.recommendedSubjects.scored.length > 0 && (
          <div className="subject-evidence-list">
            {result.recommendedSubjects.scored.slice(0, 8).map((subject) => (
              <article className="subject-evidence" key={subject.name}>
                <div className="row compact">
                  <strong>{subject.name}</strong>
                  <span className="score">점수 {subject.score}</span>
                </div>
                <ul>
                  {subject.evidence.slice(0, 3).map((evidence) => (
                    <li key={`${subject.name}-${evidence.source}-${evidence.label}`}>{evidence.label}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>

      {schoolAvailability ? (
        <section className="card school-card">
          <div className="row">
            <div>
              <p className="eyebrow">NEIS 학교 기준 확인</p>
              <h2>{schoolAvailability.school.name}</h2>
            </div>
            <span className="badge">NEIS</span>
          </div>
          <p>{schoolAvailability.summary}</p>
          {(schoolAvailability.departments.length > 0 || schoolAvailability.tracks.length > 0) && (
            <div className="filter-box">
              {schoolAvailability.tracks.length > 0 && (
                <>
                  <strong>학교 계열</strong>
                  <TagList items={schoolAvailability.tracks} muted />
                </>
              )}
              {schoolAvailability.departments.length > 0 && (
                <>
                  <strong>학교 학과</strong>
                  <TagList items={schoolAvailability.departments} muted />
                </>
              )}
            </div>
          )}
          <div className="grid">
            <div>
              <h3>시간표에서 확인된 추천 과목</h3>
              {schoolAvailability.confirmed.length ? <AvailabilityList items={schoolAvailability.confirmed} /> : <p>현재 조회 범위에서 확인된 추천 과목이 없습니다.</p>}
            </div>
            <div>
              <h3>추가 확인이 필요한 과목</h3>
              {schoolAvailability.notFound.length ? <AvailabilityList items={schoolAvailability.notFound.slice(0, 8)} muted /> : <p>추천 과목이 모두 시간표에서 확인되었습니다.</p>}
            </div>
          </div>
        </section>
      ) : schoolName ? (
        <section className="card school-card">
          <p className="eyebrow">NEIS 학교 기준 확인</p>
          <h2>{schoolName}</h2>
          <p>NEIS에서 학교 또는 시간표 정보를 찾지 못했습니다. 학교명을 공식 명칭으로 다시 입력하거나 학년도/학기를 바꿔 확인해 주세요.</p>
        </section>
      ) : null}

      <div className="grid">
        <section className="card">
          <h2>관련 직업</h2>
          {result.jobTypes.length > 0 && (
            <div className="filter-box">
              <strong>커리어넷 직업분류</strong>
              <TagList items={result.jobTypes.map((type) => type.name || type.code)} muted />
            </div>
          )}
          {result.careers.map((career) => (
            <article key={career.name} className="item">
              <h3>{career.name}</h3>
              <p>{career.summary}</p>
              {career.relatedMajors.length > 0 && <TagList items={career.relatedMajors} muted />}
            </article>
          ))}
        </section>

        <section className="card">
          <h2>관련 학과</h2>
          {result.majors.map((major) => (
            <article key={major.name} className="item">
              <h3>{major.name}</h3>
              <p>{major.summary}</p>
              <TagList items={major.relatedSubjects.length ? major.relatedSubjects : ['관련 과목 정보 없음']} muted />
            </article>
          ))}
        </section>
      </div>

      <section className="card">
        <h2>추천 진로교육자료</h2>
        <div className="materials">
          {result.learningMaterials.map((material) => (
            <a key={`${material.title}-${material.url}`} href={material.url} target="_blank" rel="noreferrer">
              <strong>{material.title}</strong>
              <div className="meta-row">
                {material.target && <span>{material.target}</span>}
                {material.activityType && <span>{material.activityType}</span>}
                {material.year && <span>{material.year}</span>}
              </div>
              {material.description && <span>{material.description}</span>}
            </a>
          ))}
        </div>
      </section>

      {result.counselingCases.length > 0 && (
        <section className="card">
          <h2>비슷한 진로상담 사례</h2>
          <div className="counsel-list">
            {result.counselingCases.map((item) => (
              <article className="counsel" key={item.question}>
                {item.category && <p className="eyebrow">{item.category}</p>}
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function AvailabilityList({ items, muted = false }: { items: Array<{ subject: string; score: number; evidence: string }>; muted?: boolean }) {
  return (
    <div className="subject-evidence-list">
      {items.map((item) => (
        <article className="subject-evidence" key={`${item.subject}-${item.evidence}`}>
          <div className="row compact">
            <strong>{item.subject}</strong>
            <span className={muted ? 'score muted-score' : 'score'}>점수 {item.score}</span>
          </div>
          <p>{item.evidence}</p>
        </article>
      ))}
    </div>
  );
}

function confidenceLabel(value: NonNullable<Recommendation['dataCoverage']>['confidence']) {
  return value === 'high' ? '높음' : value === 'medium' ? '보통' : '낮음';
}

function TagList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <div className="tags">
      {items.map((item) => (
        <span className={muted ? 'tag muted' : 'tag'} key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}
