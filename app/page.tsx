import { CareerChat } from './career-chat';

export default function Home() {
  return (
    <main className="shell">
      <section className="hero conversational-hero">
        <div className="hero-copy">
          <p className="eyebrow">CareerNet + NEIS + Gemini API MVP v0.6</p>
          <h1>입력 폼 대신 대화로 진로를 파악하고 증거 기반으로 추천합니다.</h1>
          <p className="subtitle">
            Gemini가 학생의 말에서 관심 진로·학년·강점 과목·학교/지역 정보를 파악한 뒤 CareerNet 진로 정보와 NEIS 시간표 근거를 종합해 답변합니다.
          </p>
          <div className="value-props" aria-label="서비스 진행 단계">
            <span>① 대화로 관심사 파악</span>
            <span>② CareerNet 직업·학과 근거 조회</span>
            <span>③ NEIS 학교·지역 과목 확인</span>
          </div>
        </div>
      </section>

      <CareerChat />

      <section className="empty card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>대화형 추천 방식</h2>
          </div>
        </div>
        <div className="feature-grid">
          <article><strong>Gemini 의도 파악</strong><span>고정 입력창 없이 대화에서 진로 키워드, 학년, 선호 과목, 학교/지역을 추출합니다.</span></article>
          <article><strong>CareerNet 근거</strong><span>직업·학과·진로교육자료·상담사례를 조회해 추천 과목의 근거로 사용합니다.</span></article>
          <article><strong>NEIS 확인</strong><span>학교명이나 지역을 말하면 시간표에서 추천 과목이 확인되는지 대조합니다.</span></article>
          <article><strong>근거 기반 답변</strong><span>확인된 API 근거와 미확인/추정 내용을 구분해 답변합니다.</span></article>
        </div>
      </section>
    </main>
  );
}
