import type { RegionalSubjectSchoolSearch, SchoolSubjectAvailability } from './neis';
import type { Recommendation } from './recommendation';

export type ExplorationSubgroup = {
  title: string;
  count: number;
  summary: string;
};

export type ExplorationGroup = {
  id: 'subjects' | 'school' | 'career' | 'resources';
  title: string;
  summary: string;
  totalCount: number;
  subgroups: ExplorationSubgroup[];
};

function pluralCount(count: number, unit: string) {
  return `${count}${unit}`;
}

function uniqueSubjectCount(subjects: string[]) {
  return new Set(subjects.filter(Boolean)).size;
}

export function buildExplorationGroups(
  result: Recommendation,
  schoolAvailability: SchoolSubjectAvailability | null,
  regionalSchoolSearch: RegionalSubjectSchoolSearch | null
): ExplorationGroup[] {
  const strongCount = result.recommendedSubjects.strong.length;
  const optionalCount = result.recommendedSubjects.optional.length;
  const scoredCount = result.recommendedSubjects.scored?.length ?? 0;
  const confirmedCount = schoolAvailability?.confirmed.length ?? 0;
  const notFoundCount = schoolAvailability?.notFound.length ?? 0;
  const regionalMatchCount = regionalSchoolSearch?.matches.length ?? 0;
  const regionalRequestedCount = regionalSchoolSearch?.requestedSubjects.length ?? 0;
  const subjectTotalCount = uniqueSubjectCount([
    ...result.recommendedSubjects.strong,
    ...result.recommendedSubjects.optional,
    ...(result.recommendedSubjects.scored?.map((subject) => subject.name) ?? [])
  ]);

  return [
    {
      id: 'subjects',
      title: '추천 과목',
      totalCount: subjectTotalCount,
      summary: `강력 추천 ${pluralCount(strongCount, '개')} · 추가 추천 ${pluralCount(optionalCount, '개')} · 근거 과목 ${pluralCount(scoredCount, '개')}`,
      subgroups: [
        { title: '강력 추천', count: strongCount, summary: '진로 키워드와 학과 근거가 가장 강하게 연결된 과목입니다.' },
        { title: '추가 추천', count: optionalCount, summary: '함께 탐색하면 좋은 보완 과목입니다.' },
        { title: '과목별 근거', count: scoredCount, summary: '커리어넷·관심계열·학생 입력값을 점수화한 상세 근거입니다.' }
      ]
    },
    {
      id: 'school',
      title: '학교·지역 개설 확인',
      totalCount: confirmedCount + regionalMatchCount,
      summary: schoolAvailability || regionalSchoolSearch
        ? `우리 학교 확인 ${pluralCount(confirmedCount, '개')} · 추가 확인 ${pluralCount(notFoundCount, '개')} · 지역 후보 ${pluralCount(regionalMatchCount, '곳')}`
        : '학교명이나 지역을 입력하면 NEIS 시간표 기준으로 개설 여부를 확인합니다.',
      subgroups: [
        { title: '우리 학교 시간표', count: confirmedCount, summary: schoolAvailability?.summary ?? '학교명을 입력하면 추천 과목이 실제 시간표에 있는지 보여줍니다.' },
        { title: '추가 확인 과목', count: notFoundCount, summary: '현재 조회 범위에서 아직 시간표 일치가 확인되지 않은 과목입니다.' },
        { title: '지역 학교 후보', count: regionalMatchCount, summary: regionalSchoolSearch ? `${regionalSchoolSearch.region.name}에서 ${pluralCount(regionalRequestedCount, '개')} 과목 기준으로 찾은 학교입니다.` : '지역명을 입력하면 추천 과목을 수업하는 학교를 묶어서 보여줍니다.' }
      ]
    },
    {
      id: 'career',
      title: '진로·학과 정보',
      totalCount: result.careers.length + result.majors.length + result.jobTypes.length,
      summary: `관련 직업 ${pluralCount(result.careers.length, '개')} · 관련 학과 ${pluralCount(result.majors.length, '개')} · 직업분류 ${pluralCount(result.jobTypes.length, '개')}`,
      subgroups: [
        { title: '관련 직업', count: result.careers.length, summary: '입력한 진로와 연결된 직업 설명입니다.' },
        { title: '관련 학과', count: result.majors.length, summary: '학과 설명과 고교 관련 과목을 함께 정리합니다.' },
        { title: '커리어넷 직업분류', count: result.jobTypes.length, summary: 'CareerNet 분류 기준으로 진로 영역을 보조 설명합니다.' }
      ]
    },
    {
      id: 'resources',
      title: '자료·상담 사례',
      totalCount: result.learningMaterials.length + result.counselingCases.length,
      summary: `진로교육자료 ${pluralCount(result.learningMaterials.length, '개')} · 상담 사례 ${pluralCount(result.counselingCases.length, '개')}`,
      subgroups: [
        { title: '추천 진로교육자료', count: result.learningMaterials.length, summary: '더 읽어볼 수 있는 CareerNet 자료입니다.' },
        { title: '비슷한 진로상담 사례', count: result.counselingCases.length, summary: '비슷한 고민에 대한 상담 답변을 요약합니다.' }
      ]
    }
  ];
}
