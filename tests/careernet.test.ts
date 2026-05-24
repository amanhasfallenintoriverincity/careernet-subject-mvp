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
        return [{ title: 'AI 진로자료', seq: '789', url: 'https://career.example/ai', description: '목록 자료 설명' }];
      }
      if (params.svcCode === 'COSE_VIEW') {
        return [{ title: 'AI 진로자료 상세', seq: '789', url: 'https://career.example/ai-detail', description: '상세 자료 설명', targt: 'I', activityType: '진로탐색' }];
      }
      if (params.svcCode === 'COUNSEL') {
        return [{ code: 'C001', memo: 'AI 진로 상담 질문', gubun: '진로탐색' }];
      }
      if (params.svcCode === 'COUNSEL_VIEW') {
        return [{ question: 'AI 개발자가 되려면 어떤 과목이 좋나요?', answer: '수학과 정보 과목을 중심으로 준비하세요.', gubun: '진로탐색' }];
      }
      if (params.svcCode === 'JOB_TYPE') {
        return [{ code: '10', name: '공학/기술' }];
      }
      return [];
    };

    const result = await getCareerRecommendationWithClient('인공지능 개발자', client, {
      studentProfile: { preferredSubjects: ['정보'], weakSubjects: ['물리학Ⅰ'] }
    });

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ svcCode: 'JOB' }),
      expect.objectContaining({ svcCode: 'JOB_VIEW', jobdicSeq: '123' }),
      expect.objectContaining({ svcCode: 'MAJOR' }),
      expect.objectContaining({ svcCode: 'MAJOR_VIEW', majorSeq: '456' }),
      expect.objectContaining({ svcCode: 'COSE' }),
      expect.objectContaining({ svcCode: 'COSE_VIEW', seq: '789' }),
      expect.objectContaining({ svcCode: 'COUNSEL' }),
      expect.objectContaining({ svcCode: 'COUNSEL_VIEW', con_cd: 'C001' }),
      expect.objectContaining({ svcCode: 'JOB_TYPE' })
    ]));
    expect(result.source).toBe('careernet');
    expect(result.careers[0]).toMatchObject({ name: '인공지능전문가', summary: '상세 직업 설명' });
    expect(result.careers[0].relatedMajors).toEqual(['컴퓨터공학과', '인공지능학과']);
    expect(result.majors[0]).toMatchObject({ name: '컴퓨터공학과', summary: '상세 학과 설명' });
    expect(result.majors[0].relatedSubjects).toEqual(expect.arrayContaining(['수학Ⅰ', '수학Ⅱ', '정보', '인공지능 기초', '데이터 과학']));
    expect(result.recommendedSubjects.strong).toEqual(expect.arrayContaining(['정보', '인공지능 기초']));
    expect(result.learningMaterials[0]).toMatchObject({ title: 'AI 진로자료 상세', url: 'https://career.example/ai-detail', description: '상세 자료 설명', target: '일반고등학교', activityType: '진로탐색' });
    expect(result.counselingCases[0]).toMatchObject({ question: 'AI 개발자가 되려면 어떤 과목이 좋나요?', answer: '수학과 정보 과목을 중심으로 준비하세요.', category: '진로탐색' });
    expect(result.jobTypes[0]).toEqual({ code: '10', name: '공학/기술' });
    expect(result.studentProfile).toEqual({ preferredSubjects: ['정보'], weakSubjects: ['물리학Ⅰ'] });
    expect(result.recommendedSubjects.scored?.[0].evidence.map((item) => item.source)).toContain('student-preference');
  });

  it('maps live CareerNet COSE and JOB_TYPE field variants', async () => {
    const client: CareerNetClient = async (params) => {
      if (params.svcCode === 'COSE') {
        return [{ dataTitle: '개발자 진로교육자료', seq: 'C123', targt: 'I', activityType: '진로탐색' }];
      }
      if (params.svcCode === 'COSE_VIEW') {
        return [{ dataTitle: '개발자 진로교육자료 상세', dataContent: '라이브 응답 본문', attFile: 'https://career.example/file.pdf', target: '일반고등학교', year: '2026' }];
      }
      if (params.svcCode === 'JOB_TYPE') {
        return [{ jbgp_code: '104168', jbgp_code_nm: '농림어업 관련직' }];
      }
      return [];
    };

    const result = await getCareerRecommendationWithClient('개발자', client);

    expect(result.source).toBe('careernet');
    expect(result.learningMaterials[0]).toMatchObject({
      title: '개발자 진로교육자료 상세',
      description: '라이브 응답 본문',
      url: 'https://career.example/file.pdf',
      target: '일반고등학교',
      activityType: '진로탐색',
      year: '2026'
    });
    expect(result.jobTypes[0]).toEqual({ code: '104168', name: '농림어업 관련직' });
  });

  it('retries JOB search with a useful token when the full keyword has no jobs', async () => {
    const calls: Array<Record<string, string | number | undefined>> = [];
    const client: CareerNetClient = async (params) => {
      calls.push(params);
      if (params.svcCode === 'JOB' && params.searchJobNm === '인공지능 개발자') return [];
      if (params.svcCode === 'JOB' && params.searchJobNm === '개발자') return [{ job: '시스템소프트웨어개발자', jobdicSeq: '834' }];
      if (params.svcCode === 'JOB_VIEW') return [{ job: '시스템소프트웨어개발자', summary: '상세 설명' }];
      if (params.svcCode === 'MAJOR' && params.searchTitle === '개발자') return [{ majorSeq: '999', mClass: '관광경영과' }];
      if (params.svcCode === 'MAJOR' && params.searchTitle === '컴퓨터') return [{ majorSeq: '569', mClass: '컴퓨터공학과' }];
      if (params.svcCode === 'MAJOR_VIEW' && params.majorSeq === '999') return [{ major: '관광경영과', relate_subject: '사회' }];
      if (params.svcCode === 'MAJOR_VIEW' && params.majorSeq === '569') return [{ major: '컴퓨터공학과', relate_subject: '정보, 미적분' }];
      if (params.svcCode === 'COSE' && params.searchTitleWord === '인공지능') return [{ dataTitle: 'AI 자료', seq: 'A1' }];
      if (params.svcCode === 'COSE_VIEW') return [{ dataTitle: 'AI 자료 상세', dataContent: '상세 자료' }];
      return [];
    };

    const result = await getCareerRecommendationWithClient('인공지능 개발자', client);

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ svcCode: 'JOB', searchJobNm: '인공지능 개발자' }),
      expect.objectContaining({ svcCode: 'JOB', searchJobNm: '개발자' }),
      expect.objectContaining({ svcCode: 'JOB_VIEW', jobdicSeq: '834' }),
      expect.objectContaining({ svcCode: 'MAJOR', searchTitle: '컴퓨터' }),
      expect.objectContaining({ svcCode: 'COSE', searchTitleWord: '인공지능' })
    ]));
    expect(result.careers[0]).toMatchObject({ name: '시스템소프트웨어개발자', summary: '상세 설명' });
    expect(result.majors[0]).toMatchObject({ name: '컴퓨터공학과' });
    expect(result.learningMaterials[0]).toMatchObject({ title: 'AI 자료 상세', description: '상세 자료' });
  });
});
