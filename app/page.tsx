import Link from 'next/link';
import { getCareerRecommendation } from '../lib/careernet';
import type { Recommendation } from '../lib/recommendation';

const examples = ['인공지능 개발자', '간호사', '웹툰 작가', '마케팅 전문가'];

type PageProps = {
  searchParams: Promise<{ keyword?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const keyword = params.keyword?.trim() || '';
  const result = keyword ? await getCareerRecommendation(keyword) : null;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">CareerNet Open API MVP</p>
        <h1>진로를 입력하면 고등학교 선택과목을 추천해드립니다.</h1>
        <p className="subtitle">
          직업정보, 학과정보, 진로교육자료를 연결해 진로별 추천 과목과 추천 이유를 한 번에 보여주는 MVP입니다.
        </p>
        <form className="search" action="/" method="get">
          <input
            name="keyword"
            defaultValue={keyword || '인공지능 개발자'}
            placeholder="예: 인공지능 개발자, 간호사, 웹툰 작가"
            aria-label="진로 키워드"
          />
          <button>추천 받기</button>
        </form>
        <div className="chips">
          {examples.map((example) => (
            <Link key={example} href={`/?keyword=${encodeURIComponent(example)}`}>
              {example}
            </Link>
          ))}
        </div>
      </section>

      {result ? <ResultView result={result} /> : <EmptyState />}
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
        <li>강력 추천/추가 추천 선택과목</li>
        <li>추천 진로교육자료</li>
      </ul>
      <Link className="primary-link" href="/?keyword=인공지능%20개발자">예시 결과 보기</Link>
    </section>
  );
}

function ResultView({ result }: { result: Recommendation }) {
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
        <p>{result.recommendedSubjects.reason}</p>
        <h3>강력 추천 과목</h3>
        <TagList items={result.recommendedSubjects.strong} />
        <h3>추가 추천 과목</h3>
        <TagList items={result.recommendedSubjects.optional} muted />
      </div>

      <div className="grid">
        <section className="card">
          <h2>관련 직업</h2>
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
              {material.description && <span>{material.description}</span>}
            </a>
          ))}
        </div>
      </section>
    </section>
  );
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
