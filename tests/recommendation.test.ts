import { describe, expect, it } from 'vitest';
import { buildRecommendation, extractSubjects, fallbackRecommendation } from '../lib/recommendation';

describe('CareerNet recommendation MVP logic', () => {
  it('extracts and deduplicates high-school subjects from CareerNet relate_subject variants', () => {
    const subjects = extractSubjects([
      { relate_subject: '수학, 정보, 과학' },
      { subject_name: '진로선택', subject_description: '인공지능 기초, 데이터 과학, 정보' },
      { relateSubject: ['미적분', '확률과 통계'] }
    ]);

    expect(subjects).toEqual(['수학', '정보', '과학', '인공지능 기초', '데이터 과학', '미적분', '확률과 통계']);
  });

  it('builds a useful recommendation from jobs, majors, materials, and fallback keyword rules', () => {
    const result = buildRecommendation({
      keyword: '인공지능 개발자',
      jobs: [
        { name: '인공지능전문가', summary: 'AI 시스템을 연구하고 개발합니다.', relatedMajors: ['컴퓨터공학과'] }
      ],
      majors: [
        { name: '컴퓨터공학과', summary: '소프트웨어와 컴퓨터 시스템을 배웁니다.', relate_subject: '수학, 정보' }
      ],
      materials: [
        { title: '인공지능 진로교육자료', url: 'https://example.com/ai' }
      ]
    });

    expect(result.keyword).toBe('인공지능 개발자');
    expect(result.careers[0].name).toBe('인공지능전문가');
    expect(result.majors[0].relatedSubjects).toContain('정보');
    expect(result.recommendedSubjects.strong).toEqual(expect.arrayContaining(['정보', '미적분', '확률과 통계', '인공지능 기초']));
    expect(result.recommendedSubjects.reason).toContain('수학적 모델링');
    expect(result.learningMaterials[0].title).toBe('인공지능 진로교육자료');
  });

  it('scores subjects with CareerNet evidence and student profile preferences', () => {
    const result = buildRecommendation({
      keyword: '인공지능 개발자',
      majors: [
        { name: '컴퓨터공학과', relate_subject: '정보, 수학, 물리학Ⅰ' }
      ],
      studentProfile: {
        grade: '2',
        interestArea: 'ai',
        preferredSubjects: ['정보'],
        weakSubjects: ['물리학Ⅰ']
      }
    });

    expect(result.recommendedSubjects.strong[0]).toBe('정보');
    expect(result.recommendedSubjects.optional).not.toContain('물리학Ⅰ');
    expect(result.recommendedSubjects.scored?.[0]).toMatchObject({
      name: '정보',
      tier: 'strong'
    });
    expect(result.recommendedSubjects.scored?.[0].evidence.map((item) => item.source)).toEqual(expect.arrayContaining([
      'careernet-major',
      'keyword-rule',
      'student-preference'
    ]));
  });

  it('reports data coverage and confidence', () => {
    const rich = buildRecommendation({
      keyword: '간호사',
      jobs: [{ name: '간호사' }],
      majors: [{ name: '간호학과', relate_subject: '생명과학Ⅰ, 화학Ⅰ' }],
      materials: [{ title: '간호 진로자료' }],
      counselingCases: [{ question: '간호 진로 질문' }],
      jobTypes: [{ code: '20', name: '보건의료' }]
    });

    expect(rich.dataCoverage).toEqual({
      jobs: 1,
      majors: 1,
      materials: 1,
      counselingCases: 1,
      jobTypes: 1,
      confidence: 'high'
    });

    const sparse = fallbackRecommendation('알 수 없는 진로');
    expect(sparse.dataCoverage?.confidence).toBe('low');
  });

  it('marks API-key-free demo recommendations as fallback source', () => {
    const result = fallbackRecommendation('인공지능 개발자', { preferredSubjects: ['정보'] });

    expect(result.source).toBe('fallback');
    expect(result.studentProfile).toEqual({ preferredSubjects: ['정보'] });
    expect(result.recommendedSubjects.strong).toContain('정보');
  });
});
