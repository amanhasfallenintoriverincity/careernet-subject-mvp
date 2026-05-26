import { describe, expect, it } from 'vitest';
import {
  buildSchoolSubjectAvailability,
  getNeisSchoolContextWithClient,
  parseNeisRows,
  type NeisClient
} from '../lib/neis';
import { buildRecommendation } from '../lib/recommendation';

describe('NEIS school context integration', () => {
  it('parses NEIS hub JSON rows from the resource envelope', () => {
    const rows = parseNeisRows('schoolInfo', {
      schoolInfo: [
        { head: [{ list_total_count: 1 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] },
        { row: [{ SCHUL_NM: '천안오성고등학교', ATPT_OFCDC_SC_CODE: 'N10', SD_SCHUL_CODE: '8140326' }] }
      ]
    });

    expect(rows).toEqual([
      { SCHUL_NM: '천안오성고등학교', ATPT_OFCDC_SC_CODE: 'N10', SD_SCHUL_CODE: '8140326' }
    ]);
  });

  it('builds a school context from schoolInfo, major, track, classroom, and high-school timetable APIs', async () => {
    const calls: Array<{ resource: string; params: Record<string, string | number | undefined> }> = [];
    const client: NeisClient = async (resource, params) => {
      calls.push({ resource, params });
      if (resource === 'schoolInfo') {
        expect(params.SCHUL_NM).toBe('천안오성고');
        return [
          {
            ATPT_OFCDC_SC_CODE: 'N10',
            ATPT_OFCDC_SC_NM: '충청남도교육청',
            SD_SCHUL_CODE: '8140326',
            SCHUL_NM: '천안오성고등학교',
            SCHUL_KND_SC_NM: '고등학교',
            ORG_RDNMA: '충남 천안시 서북구'
          }
        ];
      }
      if (resource === 'schoolMajorinfo') {
        return [{ ORD_SC_NM: '공업계열', DDDEP_NM: '소프트웨어과' }];
      }
      if (resource === 'schulAflcoinfo') {
        return [{ ORD_SC_NM: '공업계열' }];
      }
      if (resource === 'tiClrminfo') {
        return [{ GRADE: '2', SEM: '1', CLRM_NM: '2-1', DDDEP_NM: '소프트웨어과' }];
      }
      if (resource === 'hisTimetable') {
        return [
          { ITRT_CNTNT: '정보', GRADE: '2', CLRM_NM: '2-1' },
          { ITRT_CNTNT: '미적분', GRADE: '2', CLRM_NM: '2-1' },
          { ITRT_CNTNT: '인공지능 기초', GRADE: '2', CLRM_NM: '2-1' }
        ];
      }
      return [];
    };

    const context = await getNeisSchoolContextWithClient('천안오성고', client, { ay: '2026', sem: '1', grade: '2' });

    expect(calls).toEqual(expect.arrayContaining([
      { resource: 'schoolInfo', params: expect.objectContaining({ SCHUL_NM: '천안오성고' }) },
      { resource: 'schoolMajorinfo', params: expect.objectContaining({ ATPT_OFCDC_SC_CODE: 'N10', SD_SCHUL_CODE: '8140326' }) },
      { resource: 'schulAflcoinfo', params: expect.objectContaining({ ATPT_OFCDC_SC_CODE: 'N10', SD_SCHUL_CODE: '8140326' }) },
      { resource: 'tiClrminfo', params: expect.objectContaining({ AY: '2026', SEM: '1', GRADE: '2' }) },
      { resource: 'hisTimetable', params: expect.objectContaining({ AY: '2026', SEM: '1', GRADE: '2' }) }
    ]));
    expect(context.school).toMatchObject({ name: '천안오성고등학교', officeCode: 'N10', schoolCode: '8140326' });
    expect(context.majors).toEqual([{ trackName: '공업계열', departmentName: '소프트웨어과' }]);
    expect(context.tracks).toEqual(['공업계열']);
    expect(context.classrooms[0]).toMatchObject({ grade: '2', semester: '1', classroomName: '2-1' });
    expect(context.timetableSubjects).toEqual(['정보', '미적분', '인공지능 기초']);
    expect(context.source).toBe('neis');
  });

  it('matches recommended subjects against timetable subjects and school departments', () => {
    const recommendation = buildRecommendation({
      keyword: '인공지능 개발자',
      majors: [{ name: '컴퓨터공학과', relate_subject: '정보, 미적분, 데이터 과학' }]
    });

    const availability = buildSchoolSubjectAvailability(recommendation.recommendedSubjects.scored ?? [], {
      school: { name: '천안오성고등학교', officeCode: 'N10', schoolCode: '8140326' },
      majors: [{ trackName: '공업계열', departmentName: '소프트웨어과' }],
      tracks: ['공업계열'],
      classrooms: [],
      timetableSubjects: ['정보', '미적분'],
      source: 'neis'
    });

    expect(availability.confirmed.map((item) => item.subject)).toEqual(expect.arrayContaining(['정보', '미적분']));
    expect(availability.notFound.map((item) => item.subject)).toContain('데이터 과학');
    expect(availability.summary).toContain('천안오성고등학교');
    expect(availability.summary).toContain('시간표에서 확인');
  });

  it('finds regional high schools that teach the recommended subjects and ranks better matches first', async () => {
    const { findRegionalSubjectSchoolsWithClient } = await import('../lib/neis');
    const recommendation = buildRecommendation({
      keyword: '인공지능 개발자',
      majors: [{ name: '컴퓨터공학과', relate_subject: '정보, 미적분, 데이터 과학' }]
    });
    const calls: Array<{ resource: string; params: Record<string, string | number | undefined> }> = [];
    const client: NeisClient = async (resource, params) => {
      calls.push({ resource, params });
      if (resource === 'schoolInfo') {
        expect(params.ATPT_OFCDC_SC_CODE).toBe('N10');
        expect(params.SCHUL_KND_SC_NM).toBe('고등학교');
        return [
          { ATPT_OFCDC_SC_CODE: 'N10', ATPT_OFCDC_SC_NM: '충청남도교육청', SD_SCHUL_CODE: '1001', SCHUL_NM: '천안오성고등학교', ORG_RDNMA: '충남 천안시 서북구' },
          { ATPT_OFCDC_SC_CODE: 'N10', ATPT_OFCDC_SC_NM: '충청남도교육청', SD_SCHUL_CODE: '1002', SCHUL_NM: '천안제일고등학교', ORG_RDNMA: '충남 천안시 동남구' }
        ];
      }
      if (resource === 'hisTimetable' && params.SD_SCHUL_CODE === '1001') {
        return [{ ITRT_CNTNT: '정보' }, { ITRT_CNTNT: '인공지능 기초' }, { ITRT_CNTNT: '미적분' }];
      }
      if (resource === 'hisTimetable' && params.SD_SCHUL_CODE === '1002') {
        return [{ ITRT_CNTNT: '정보' }];
      }
      return [];
    };

    const result = await findRegionalSubjectSchoolsWithClient('충남', recommendation.recommendedSubjects.scored ?? [], client, {
      ay: '2026',
      sem: '1',
      grade: '2',
      limit: 5
    });

    expect(result.region.officeCode).toBe('N10');
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].school.name).toBe('천안오성고등학교');
    expect(result.matches[0].confirmed.map((item) => item.subject)).toEqual(expect.arrayContaining(['정보', '미적분', '인공지능 기초']));
    expect(result.matches[0].matchScore).toBeGreaterThan(result.matches[1].matchScore);
    expect(result.summary).toContain('충남');
    expect(calls).toEqual(expect.arrayContaining([
      { resource: 'hisTimetable', params: expect.objectContaining({ ATPT_OFCDC_SC_CODE: 'N10', SD_SCHUL_CODE: '1001', AY: '2026', SEM: '1', GRADE: '2' }) }
    ]));
  });
});
