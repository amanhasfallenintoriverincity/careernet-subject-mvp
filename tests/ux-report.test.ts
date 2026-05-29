import { describe, expect, it } from 'vitest';
import {
  buildNextQuestionSuggestions,
  buildStudentProfileSummary,
  buildSubjectUxCards,
  summarizeEvidenceSource
} from '../lib/ux-report';
import type { GeminiGuidanceResponse } from '../lib/gemini-guidance';

const baseResult: GeminiGuidanceResponse = {
  reply: '테스트 답변',
  source: 'gemini',
  interactionId: 'interaction-1',
  intent: {
    careerKeyword: 'AI 개발자',
    schoolName: '천안오성고등학교',
    studentProfile: {
      grade: '2',
      preferredSubjects: ['정보', '수학'],
      weakSubjects: ['화학']
    }
  },
  evidence: {
    recommendation: {
      keyword: 'AI 개발자',
      careers: [],
      majors: [],
      recommendedSubjects: {
        strong: ['정보', '확률과 통계'],
        optional: ['미적분'],
        reason: 'AI 분야는 정보와 수학 역량이 중요합니다.',
        scored: [
          {
            name: '정보',
            score: 9,
            tier: 'strong',
            evidence: [
              { source: 'careernet-major', label: '컴퓨터공학과 관련 과목', weight: 5 },
              { source: 'student-preference', label: '학생이 좋아하는 과목', weight: 2 }
            ]
          },
          {
            name: '미적분',
            score: 6,
            tier: 'optional',
            evidence: [{ source: 'keyword-rule', label: 'AI 키워드 핵심 추천', weight: 4 }]
          },
          {
            name: '화학',
            score: -1,
            tier: 'explore',
            evidence: [{ source: 'student-weakness', label: '학생이 부담스러워하는 과목', weight: -2 }]
          }
        ]
      },
      learningMaterials: [],
      counselingCases: [],
      jobTypes: [],
      source: 'careernet'
    },
    schoolAvailability: {
      school: { name: '천안오성고등학교', officeCode: 'N10', schoolCode: '123' },
      confirmed: [{ subject: '정보', score: 9, evidence: '시간표에서 확인' }],
      notFound: [{ subject: '미적분', score: 6, evidence: '시간표에서 미확인' }],
      departments: [],
      tracks: [],
      summary: '정보는 확인되었고 미적분은 현재 조회 범위에서 확인되지 않았습니다.'
    },
    regionalSchoolSearch: null
  }
};

describe('ux-report helpers', () => {
  it('추천 과목을 우선순위, 근거, 학교 확인 상태가 포함된 카드로 변환한다', () => {
    const cards = buildSubjectUxCards(baseResult);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: '정보',
      priorityLabel: '1순위 핵심 추천',
      schoolStatus: '학교 시간표 확인됨',
      schoolStatusTone: 'confirmed',
      reason: '컴퓨터공학과 관련 과목'
    });
    expect(cards[1]).toMatchObject({
      name: '미적분',
      priorityLabel: '2순위 추천',
      schoolStatus: '현재 조회 범위에서 미확인',
      schoolStatusTone: 'missing'
    });
    expect(cards.map((card) => card.name)).not.toContain('화학');
  });

  it('학교 확인 결과가 없으면 학교명 입력을 다음 행동으로 안내한다', () => {
    const resultWithoutSchool: GeminiGuidanceResponse = {
      ...baseResult,
      intent: { careerKeyword: 'AI 개발자' },
      evidence: { ...baseResult.evidence, schoolAvailability: null }
    };

    const cards = buildSubjectUxCards(resultWithoutSchool);
    const suggestions = buildNextQuestionSuggestions(resultWithoutSchool);

    expect(cards[0].schoolStatus).toBe('학교명 입력 시 확인 가능');
    expect(suggestions[0]).toContain('우리 학교');
  });

  it('학생 프로필과 근거 출처를 학생 친화적인 문구로 요약한다', () => {
    expect(buildStudentProfileSummary(baseResult.intent)).toEqual([
      { label: '학년', value: '고2' },
      { label: '학교', value: '천안오성고등학교' },
      { label: '희망 진로', value: 'AI 개발자' },
      { label: '좋아하는 과목', value: '정보, 수학' },
      { label: '부담되는 과목', value: '화학' }
    ]);
    expect(summarizeEvidenceSource(baseResult)).toEqual({
      ai: 'AI 분석: Gemini가 대화 맥락을 반영했어요.',
      careernet: '진로 정보: 커리어넷 API 근거를 사용했어요.',
      neis: '학교 과목: 천안오성고등학교 시간표와 대조했어요.'
    });
  });
});
