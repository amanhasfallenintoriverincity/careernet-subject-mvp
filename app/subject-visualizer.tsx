'use client';

import { useState, useEffect } from 'react';
import type { GeminiGuidanceResponse } from '../lib/gemini-guidance';
import type { ScoredSubject } from '../lib/recommendation';
import {
  buildNextQuestionSuggestions,
  buildPdfReportFileName,
  buildPdfReportViewModel,
  buildStudentProfileSummary,
  buildSubjectUxCards,
  summarizeEvidenceSource
} from '../lib/ux-report';

type SubjectVisualizerProps = {
  result: GeminiGuidanceResponse | null;
  onAskSuggestion?: (question: string) => void;
};

export function SubjectVisualizer({ result, onAskSuggestion }: SubjectVisualizerProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'chart'>('map');
  const [selectedSubject, setSelectedSubject] = useState<ScoredSubject | null>(null);

  // Auto-select the top subject when result changes
  useEffect(() => {
    if (result?.evidence?.recommendation?.recommendedSubjects?.scored?.length) {
      setSelectedSubject(result.evidence.recommendation.recommendedSubjects.scored[0]);
    } else {
      setSelectedSubject(null);
    }
  }, [result]);

  if (!result) {
    return (
      <aside className="visualizer-card card empty-state">
        <div className="empty-state-content">
          <div className="empty-icon-wrapper">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </div>
          <h3>진로 과목 시각화 리포트</h3>
          <p className="muted">
            왼쪽 창에서 대화를 시작해 보세요. Gemini가 진로 의도를 파악하고 관련 과목 매칭 근거를 시각 자료로 분석해 드립니다.
          </p>
          <div className="empty-tips">
            <span>💡 "고2이고 인공지능 개발자가 되고 싶어" 처럼 구체적으로 물어보세요.</span>
          </div>
        </div>
      </aside>
    );
  }

  const { recommendation, schoolAvailability, regionalSchoolSearch } = result.evidence;
  const keyword = recommendation.keyword || result.intent.careerKeyword || '선택된 진로';
  const scoredSubjects = recommendation.recommendedSubjects.scored || [];
  const subjectCards = buildSubjectUxCards(result, 4);
  const profileItems = buildStudentProfileSummary(result.intent);
  const sourceSummary = summarizeEvidenceSource(result);
  const nextQuestions = buildNextQuestionSuggestions(result);
  const pdfReport = buildPdfReportViewModel(result);
  const pdfFileName = buildPdfReportFileName(result);

  function onPrintPdfReport() {
    if (typeof window === 'undefined') return;
    const previousTitle = document.title;
    document.title = pdfFileName.replace(/\.pdf$/i, '');
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  // Filter out subjects with score <= 0
  const chartSubjects = scoredSubjects.filter(sub => sub.score > 0).slice(0, 7);
  const tableSubjects = scoredSubjects.filter(sub => sub.score > 0).slice(0, 15);

  const getSubjectCategory = (name: string): string => {
    const cleanName = name.replace(/\s+/g, '');
    if (/국어|화법|독서|작문|문학|매체|고전읽기|언어/g.test(cleanName)) return '국어';
    if (/수학|대수|미적분|기하|확률|통계|해석|대수학/g.test(cleanName)) return '수학';
    if (/영어|독해|회화|영미/g.test(cleanName)) return '영어';
    if (/사회|문화|윤리|사상|역사|지리|세계사|동아시아|정치|법|경제|현대사회/g.test(cleanName)) return '사회';
    if (/과학|물리|화학|생명|지구|실험|융합|우주/g.test(cleanName)) return '과학';
    return '정보/기타';
  };

  const categories = ['국어', '수학', '영어', '사회', '과학', '정보/기타'];

  const groupedSubjects = categories.reduce((acc, cat) => {
    acc[cat] = [];
    return acc;
  }, {} as Record<string, typeof tableSubjects>);

  tableSubjects.forEach(sub => {
    const cat = getSubjectCategory(sub.name);
    groupedSubjects[cat].push(sub);
  });

  const getCategoryClass = (category: string): string => {
    switch (category) {
      case '국어': return 'korean';
      case '수학': return 'math';
      case '영어': return 'english';
      case '사회': return 'social';
      case '과학': return 'science';
      default: return 'other';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'careernet-major': return '🎓';
      case 'keyword-rule': return '🔍';
      case 'interest-area': return '✨';
      case 'student-preference': return '👍';
      case 'student-weakness': return '⚠️';
      default: return '📄';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'careernet-major': return '커리어넷 학과 정보';
      case 'keyword-rule': return 'AI 키워드 규칙';
      case 'interest-area': return '학생 관심 분야';
      case 'student-preference': return '학생 선호 과목';
      case 'student-weakness': return '학생 부담 과목';
      default: return '기타 근거';
    }
  };

  return (
    <aside className="visualizer-card card active">
      <div className="visualizer-header">
        <div>
          <span className="eyebrow">Visual Matching Report</span>
          <h2>진로 과목 분석</h2>
          <p className="keyword-badge">
            <span className="bullet"></span>
            희망 진로: <strong>{keyword}</strong>
          </p>
        </div>
        
        <div className="visualizer-tabs">
          <button 
            type="button" 
            className={activeTab === 'map' ? 'active' : ''} 
            onClick={() => setActiveTab('map')}
          >
            과목 매칭
          </button>
          <button 
            type="button" 
            className={activeTab === 'chart' ? 'active' : ''} 
            onClick={() => setActiveTab('chart')}
          >
            차트 분석
          </button>
        </div>
      </div>

      <div className="ux-summary-board" aria-label="진로 상담 요약">
        <div className="summary-panel profile-summary">
          <h3>학생 상황</h3>
          {profileItems.length > 0 ? (
            <dl>
              {profileItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>학년, 학교명, 좋아하는 과목을 알려주시면 더 정확해져요.</p>
          )}
        </div>

        <div className="summary-panel source-summary">
          <h3>이 답변의 근거</h3>
          <ul>
            <li>{sourceSummary.ai}</li>
            <li>{sourceSummary.careernet}</li>
            <li>{sourceSummary.neis}</li>
          </ul>
        </div>
      </div>

      {subjectCards.length > 0 && (
        <section className="subject-card-strip" aria-label="추천 과목 카드">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Priority Cards</span>
              <h3>바로 볼 추천 과목</h3>
            </div>
            <p>추천 이유와 학교 확인 상태를 함께 봅니다.</p>
          </div>
          <div className="subject-ux-grid">
            {subjectCards.map((card) => (
              <article key={card.name} className={`subject-ux-card ${card.schoolStatusTone}`}>
                <div className="subject-ux-topline">
                  <span>{card.priorityLabel}</span>
                  <strong>{card.score}점</strong>
                </div>
                <h4>{card.name}</h4>
                <p>{card.reason}</p>
                <div className={`school-status-pill ${card.schoolStatusTone}`}>{card.schoolStatus}</div>
                <small>{card.schoolStatusDetail}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="next-action-panel" aria-label="다음 질문 추천">
        <div>
          <span className="eyebrow">Next Steps</span>
          <h3>다음에 이렇게 물어보세요</h3>
        </div>
        <div className="next-question-list">
          {nextQuestions.map((question) => (
            <button key={question} type="button" onClick={() => onAskSuggestion?.(question)} disabled={!onAskSuggestion}>
              {question}
            </button>
          ))}
        </div>
      </div>

      <section className="pdf-report-panel" aria-label="PDF 보고서 만들기">
        <div className="pdf-report-actions screen-only">
          <div>
            <span className="eyebrow">PDF Report</span>
            <h3>상담 결과 PDF 보고서</h3>
            <p>학생 상황, 추천 과목, 학교 확인 결과, 다음 행동을 한 장 보고서로 정리합니다.</p>
          </div>
          <button type="button" onClick={onPrintPdfReport}>PDF 보고서 저장</button>
        </div>

        <article className="pdf-report-print-area" aria-label="인쇄용 진로 선택과목 보고서">
          <header className="pdf-report-header">
            <span>{pdfReport.generatedAtLabel}</span>
            <h2>{pdfReport.title}</h2>
            <p>{pdfReport.subtitle}</p>
          </header>

          {pdfReport.subjects.length > 0 && (
            <section className="pdf-report-section">
              <h3>핵심 추천 과목</h3>
              <div className="pdf-subject-table" role="table" aria-label="PDF 추천 과목 표">
                <div className="pdf-subject-row header" role="row">
                  <span role="columnheader">과목</span>
                  <span role="columnheader">추천</span>
                  <span role="columnheader">학교 확인</span>
                </div>
                {pdfReport.subjects.slice(0, 6).map((subject) => (
                  <div className="pdf-subject-row" role="row" key={subject.name}>
                    <strong role="cell">{subject.name}</strong>
                    <span role="cell">{subject.priorityLabel} · {subject.score}점</span>
                    <span role="cell">{subject.schoolStatus}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pdfReport.sections.map((section) => (
            <section className="pdf-report-section" key={section.heading}>
              <h3>{section.heading}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      </section>

      <div className="visualization-pane">
        {activeTab === 'map' ? (
          <div className="network-container">
            <div className="subject-table-card">
              <div className="subject-table-header">
                <span>일반 선택</span>
              </div>
              <div className="subject-table-body">
                {categories.map(category => {
                  const subjects = groupedSubjects[category];
                  if (subjects.length === 0) return null;
                  return (
                    <div key={category} className="subject-table-row">
                      <div className={`subject-category-cell ${getCategoryClass(category)}`}>
                        {category}
                      </div>
                      <div className="subject-badges-cell">
                        {subjects.map(sub => {
                          const isSelected = selectedSubject?.name === sub.name;
                          const isStrong = sub.tier === 'strong';
                          return (
                            <button
                              key={sub.name}
                              type="button"
                              className={`subject-table-badge ${isStrong ? 'strong' : 'optional'} ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedSubject(sub)}
                            >
                              {isStrong ? `★ ${sub.name}` : sub.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="subject-table-legend">
              <span><span className="dot strong"></span>핵심 추천 과목</span>
              <span><span className="dot optional"></span>추천 과목</span>
            </div>
          </div>
        ) : (
          <div className="chart-container">
            <div className="bar-chart">
              {chartSubjects.map((sub, index) => {
                const maxScore = Math.max(...chartSubjects.map(s => s.score), 10);
                const percentage = Math.min(100, (sub.score / maxScore) * 100);
                const isSelected = selectedSubject?.name === sub.name;
                
                return (
                  <button 
                    key={sub.name} 
                    type="button"
                    className={`chart-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSubject(sub)}
                  >
                    <div className="chart-label">
                      <span className={`tier-badge ${sub.tier}`}>
                        {sub.tier === 'strong' ? '핵심' : sub.tier === 'optional' ? '일반' : '탐색'}
                      </span>
                      <strong className="subject-name">{sub.name}</strong>
                    </div>
                    <div className="chart-bar-wrapper">
                      <div 
                        className={`chart-bar ${sub.tier}`} 
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="chart-score">{sub.score}점</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subject detail card */}
      {selectedSubject && (
        <div className="subject-detail-panel card">
          <div className="detail-header">
            <div>
              <span className={`detail-tier-badge ${selectedSubject.tier}`}>
                {selectedSubject.tier === 'strong' ? '🔥 핵심 추천 과목' : selectedSubject.tier === 'optional' ? '📘 일반 추천 과목' : '🔍 탐색 추천 과목'}
              </span>
              <h3>{selectedSubject.name}</h3>
            </div>
            <div className="total-score-badge">
              적합도 <strong>{selectedSubject.score}점</strong>
            </div>
          </div>
          
          <div className="evidence-breakdown">
            <h4>추천 근거 분석</h4>
            <div className="evidence-chips">
              {selectedSubject.evidence.map((ev, idx) => (
                <div key={idx} className={`evidence-chip ${ev.weight > 0 ? 'pos' : 'neg'}`}>
                  <span className="ev-icon">{getSourceIcon(ev.source)}</span>
                  <div className="ev-info">
                    <span className="ev-source">{getSourceLabel(ev.source)}</span>
                    <span className="ev-label">{ev.label}</span>
                  </div>
                  <span className="ev-weight">{ev.weight > 0 ? `+${ev.weight}` : ev.weight}점</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEIS status block */}
      {(schoolAvailability || regionalSchoolSearch) && (
        <div className="neis-visual-card card">
          <h4>🏫 NEIS 개설 현황 대조</h4>
          {schoolAvailability ? (
            <div className="neis-school-status">
              <p className="school-indicator">
                📍 <strong>{schoolAvailability.school.name}</strong> 개설 현황
              </p>
              
              <div className="availability-grid">
                {schoolAvailability.confirmed.length > 0 && (
                  <div className="avail-section confirmed">
                    <h5>개설 확인됨 ({schoolAvailability.confirmed.length})</h5>
                    <div className="avail-tags">
                      {schoolAvailability.confirmed.map((sub, idx) => (
                        <span key={idx} className="avail-tag check">✔ {sub.subject}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {schoolAvailability.notFound.length > 0 && (
                  <div className="avail-section missing">
                    <h5>시간표 정보 부족/미개설 ({schoolAvailability.notFound.length})</h5>
                    <div className="avail-tags">
                      {schoolAvailability.notFound.map((sub, idx) => (
                        <span key={idx} className="avail-tag alert">⚠ {sub.subject}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : regionalSchoolSearch ? (
            <div className="neis-regional-status">
              <p className="school-indicator">
                🌐 <strong>{regionalSchoolSearch.region.name}</strong> 지역 학교 과목 개설
              </p>
              <div className="regional-schools-list">
                {regionalSchoolSearch.matches.slice(0, 3).map((match, idx) => (
                  <div key={idx} className="regional-school-row">
                    <div className="school-info">
                      <strong>{match.school.name}</strong>
                      <span className="match-score">개설 매칭도: {(match.matchScore * 100).toFixed(0)}%</span>
                    </div>
                    <div className="school-subjects">
                      <span className="label">확인된 과목:</span>
                      <span className="subjs">{match.confirmed.slice(0, 3).map(m => m.subject).join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
