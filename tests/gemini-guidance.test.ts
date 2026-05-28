import { describe, expect, it } from 'vitest';
import {
  buildEvidenceBundle,
  buildFallbackGuidance,
  buildGuidancePrompt,
  fallbackIntentFromMessages,
  normalizeGuidanceIntent,
  type GuidanceEvidence
} from '../lib/gemini-guidance';

const evidence: GuidanceEvidence = {
  recommendation: {
    keyword: '인공지능 개발자',
    careers: [{ name: '인공지능전문가', summary: 'AI 모델을 개발합니다.', relatedMajors: ['컴퓨터공학과'] }],
    majors: [{ name: '컴퓨터공학과', summary: '소프트웨어를 배웁니다.', relatedSubjects: ['정보', '미적분'] }],
    recommendedSubjects: {
      strong: ['정보'],
      optional: ['미적분'],
      reason: 'AI 분야는 정보와 수학 역량이 중요합니다.',
      scored: [
        { name: '정보', score: 9, tier: 'strong', evidence: [{ source: 'careernet-major', label: '컴퓨터공학과 관련 과목', weight: 4 }] },
        { name: '미적분', score: 6, tier: 'optional', evidence: [{ source: 'keyword-rule', label: 'AI 키워드 규칙', weight: 2 }] }
      ]
    },
    dataCoverage: { jobs: 1, majors: 1, materials: 1, counselingCases: 0, jobTypes: 1, confidence: 'high' },
    learningMaterials: [{ title: 'AI 진로 자료', url: 'https://example.com', description: '탐색 자료' }],
    counselingCases: [],
    jobTypes: [{ code: '01', name: '정보통신' }],
    source: 'careernet'
  },
  schoolAvailability: {
    school: { name: '천안오성고등학교', address: '충남', officeCode: 'N10', schoolCode: '123' },
    confirmed: [{ subject: '정보', score: 9, evidence: '시간표 수업명 일치' }],
    notFound: [{ subject: '미적분', score: 6, evidence: '시간표에서 미확인' }],
    departments: [],
    tracks: [],
    source: 'neis',
    summary: '천안오성고등학교 시간표에서 정보 과목이 확인되었습니다.'
  },
  regionalSchoolSearch: null
};

describe('gemini-guidance', () => {
  it('대화에서 진로, 학교, 학년, 선호 과목을 fallback으로 추출한다', () => {
    const intent = fallbackIntentFromMessages([
      { role: 'user', content: '고2이고 천안오성고에 다녀요. 좋아하는 과목은 정보, 수학이고 AI 개발자가 되고 싶어요.' }
    ]);

    expect(intent.careerKeyword).toContain('AI 개발자');
    expect(intent.schoolName).toBe('천안오성고');
    expect(intent.studentProfile?.grade).toBe('2');
    expect(intent.studentProfile?.preferredSubjects).toContain('정보');
  });

  it('Gemini JSON 의도 응답을 정규화하고 누락값은 fallback으로 보완한다', () => {
    const intent = normalizeGuidanceIntent(
      { careerKeyword: '간호사', studentProfile: { grade: '3', preferredSubjects: ['생명과학Ⅰ'] } },
      [{ role: 'user', content: '서울 지역 학교도 확인해줘' }]
    );

    expect(intent.careerKeyword).toBe('간호사');
    expect(intent.regionName).toBe('서울');
    expect(intent.studentProfile?.grade).toBe('3');
    expect(intent.studentProfile?.preferredSubjects).toEqual(['생명과학Ⅰ']);
  });

  it('최종 Gemini 프롬프트에 CareerNet과 NEIS 증거 묶음을 포함한다', () => {
    const prompt = buildGuidancePrompt(
      [{ role: 'user', content: 'AI 개발자 추천해줘' }],
      { careerKeyword: '인공지능 개발자', schoolName: '천안오성고' },
      evidence
    );

    expect(prompt).toContain('CareerNet/NEIS 증거');
    expect(prompt).toContain('인공지능전문가');
    expect(prompt).toContain('천안오성고등학교 시간표에서 정보 과목');
    expect(prompt).toContain('컴퓨터공학과 관련 과목');
  });

  it('fallback 답변도 증거 기반 요약과 다음 입력 안내를 제공한다', () => {
    const reply = buildFallbackGuidance({ careerKeyword: '인공지능 개발자' }, evidence);
    const bundle = buildEvidenceBundle(evidence);

    expect(bundle.recommendedSubjects[0].evidence).toContain('컴퓨터공학과 관련 과목');
    expect(reply).toContain('인공지능 개발자');
    expect(reply).toContain('정보');
    expect(reply).toContain('NEIS 확인 결과');
  });
});
