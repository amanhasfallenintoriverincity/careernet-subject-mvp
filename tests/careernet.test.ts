import { describe, expect, it } from 'vitest';
import { getCareerRecommendationWithClient, type CareerNetClient } from '../lib/careernet';

describe('CareerNet detail-based recommendation flow', () => {
  it('uses JOB_VIEW and MAJOR_VIEW detail responses before building recommendations', async () => {
    const calls: Array<Record<string, string | number | undefined>> = [];
    const client: CareerNetClient = async (params) => {
      calls.push(params);
      if (params.svcCode === 'JOB') {
        return [{ job: '인공지능전문가', jobdicSeq: '123', summary: '목록 설명' }];
      }
      if (params.svcCode === 'JOB_VIEW') {
        return [{ job: '인공지능전문가', summary: '상세 직업 설명', similarJob: '데이터과학자', related_major: '컴퓨터공학과, 인공지능학과' }];
      }
      if (params.svcCode === 'MAJOR') {
        return [{ majorSeq: '456', mClass: '컴퓨터공학과' }];
      }
      if (params.svcCode === 'MAJOR_VIEW') {
        return [{
          major: '컴퓨터공학과',
          summary: '상세 학과 설명',
          relate_subject: [
            { subject_name: '일반선택', subject_description: '수학Ⅰ, 수학Ⅱ, 정보' },
            { subject_name: '진로선택', subject_description: '인공지능 기초, 데이터 과학' }
          ],
          job: [{ description: '소프트웨어개발자' }]
        }];
      }
      if (params.svcCode === 'COSE') {
        return [{ title: 'AI 진로자료', url: 'https://career.example/ai', description: '자료 설명' }];
      }
      return [];
    };

    const result = await getCareerRecommendationWithClient('인공지능 개발자', client);

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ svcCode: 'JOB' }),
      expect.objectContaining({ svcCode: 'JOB_VIEW', jobdicSeq: '123' }),
      expect.objectContaining({ svcCode: 'MAJOR' }),
      expect.objectContaining({ svcCode: 'MAJOR_VIEW', majorSeq: '456' }),
      expect.objectContaining({ svcCode: 'COSE' })
    ]));
    expect(result.source).toBe('careernet');
    expect(result.careers[0]).toMatchObject({ name: '인공지능전문가', summary: '상세 직업 설명' });
    expect(result.careers[0].relatedMajors).toEqual(['컴퓨터공학과', '인공지능학과']);
    expect(result.majors[0]).toMatchObject({ name: '컴퓨터공학과', summary: '상세 학과 설명' });
    expect(result.majors[0].relatedSubjects).toEqual(expect.arrayContaining(['수학Ⅰ', '수학Ⅱ', '정보', '인공지능 기초', '데이터 과학']));
    expect(result.recommendedSubjects.strong).toEqual(expect.arrayContaining(['정보', '인공지능 기초']));
    expect(result.learningMaterials[0].title).toBe('AI 진로자료');
  });
});
