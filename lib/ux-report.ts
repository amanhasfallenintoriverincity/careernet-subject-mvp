import type { GeminiGuidanceResponse, GuidanceIntent } from './gemini-guidance';
import type { ScoredSubject } from './recommendation';

export type SubjectSchoolStatusTone = 'confirmed' | 'missing' | 'unknown';

export type SubjectUxCard = {
  name: string;
  score: number;
  priorityLabel: string;
  reason: string;
  schoolStatus: string;
  schoolStatusDetail: string;
  schoolStatusTone: SubjectSchoolStatusTone;
};

export type EvidenceSourceSummary = {
  ai: string;
  careernet: string;
  neis: string;
};

export type StudentProfileSummaryItem = {
  label: string;
  value: string;
};

export type PdfReportSection = {
  heading: string;
  items: string[];
};

export type PdfReportViewModel = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  profile: StudentProfileSummaryItem[];
  subjects: SubjectUxCard[];
  sections: PdfReportSection[];
};

function normalizeSubject(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase();
}

function hasSameSubject(left: string, right: string): boolean {
  const a = normalizeSubject(left);
  const b = normalizeSubject(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function getPositiveReason(subject: ScoredSubject): string {
  return subject.evidence.find((item) => item.weight > 0)?.label
    ?? subject.evidence[0]?.label
    ?? '진로 키워드와 과목 매칭 점수를 기준으로 추천되었습니다.';
}

function getPriorityLabel(subject: ScoredSubject, index: number): string {
  const prefix = `${index + 1}순위`;
  if (subject.tier === 'strong') return `${prefix} 핵심 추천`;
  if (subject.tier === 'optional') return `${prefix} 추천`;
  return `${prefix} 탐색 추천`;
}

function getSchoolStatus(result: GeminiGuidanceResponse, subjectName: string) {
  const availability = result.evidence.schoolAvailability;
  if (!availability) {
    return {
      schoolStatus: '학교명 입력 시 확인 가능',
      schoolStatusDetail: '학교명이나 지역을 알려주시면 NEIS 시간표와 대조해드릴 수 있어요.',
      schoolStatusTone: 'unknown' as const
    };
  }

  const confirmed = availability.confirmed.find((item) => hasSameSubject(item.subject, subjectName));
  if (confirmed) {
    return {
      schoolStatus: '학교 시간표 확인됨',
      schoolStatusDetail: `${availability.school.name} 시간표에서 ${confirmed.subject} 과목이 확인되었어요.`,
      schoolStatusTone: 'confirmed' as const
    };
  }

  const missing = availability.notFound.find((item) => hasSameSubject(item.subject, subjectName));
  if (missing) {
    return {
      schoolStatus: '현재 조회 범위에서 미확인',
      schoolStatusDetail: `${availability.school.name} 조회 범위에서는 ${missing.subject} 과목이 확인되지 않았어요. 학교에 없다고 단정하지 말고 선택과목 안내표도 함께 확인해보세요.`,
      schoolStatusTone: 'missing' as const
    };
  }

  return {
    schoolStatus: '학교 확인 결과 없음',
    schoolStatusDetail: `${availability.school.name} 조회 결과와 직접 매칭되지 않았어요. 비슷한 과목명이나 학년별 개설 여부를 확인해보세요.`,
    schoolStatusTone: 'unknown' as const
  };
}

export function buildSubjectUxCards(result: GeminiGuidanceResponse, limit = 6): SubjectUxCard[] {
  const subjects = result.evidence.recommendation.recommendedSubjects.scored ?? [];
  return subjects
    .filter((subject) => subject.score > 0)
    .slice(0, limit)
    .map((subject, index) => ({
      name: subject.name,
      score: subject.score,
      priorityLabel: getPriorityLabel(subject, index),
      reason: getPositiveReason(subject),
      ...getSchoolStatus(result, subject.name)
    }));
}

export function buildStudentProfileSummary(intent: GuidanceIntent): StudentProfileSummaryItem[] {
  const profile = intent.studentProfile;
  const items: StudentProfileSummaryItem[] = [];

  if (profile?.grade) items.push({ label: '학년', value: `고${profile.grade}` });
  if (intent.schoolName) items.push({ label: '학교', value: intent.schoolName });
  if (intent.regionName) items.push({ label: '지역', value: intent.regionName });
  if (intent.careerKeyword) items.push({ label: '희망 진로', value: intent.careerKeyword });
  if (profile?.preferredSubjects?.length) items.push({ label: '좋아하는 과목', value: profile.preferredSubjects.join(', ') });
  if (profile?.weakSubjects?.length) items.push({ label: '부담되는 과목', value: profile.weakSubjects.join(', ') });

  return items;
}

export function summarizeEvidenceSource(result: GeminiGuidanceResponse): EvidenceSourceSummary {
  const recommendation = result.evidence.recommendation;
  const availability = result.evidence.schoolAvailability;
  const regional = result.evidence.regionalSchoolSearch;

  return {
    ai: result.source === 'gemini'
      ? 'AI 분석: Gemini가 대화 맥락을 반영했어요.'
      : 'AI 분석: 기본 규칙 기반 답변으로 보완했어요.',
    careernet: recommendation.source === 'careernet'
      ? '진로 정보: 커리어넷 API 근거를 사용했어요.'
      : '진로 정보: 커리어넷 응답이 부족해 기본 추천 규칙을 사용했어요.',
    neis: availability
      ? `학교 과목: ${availability.school.name} 시간표와 대조했어요.`
      : regional
        ? `학교 과목: ${regional.region.name} 지역 학교 후보와 대조했어요.`
        : '학교 과목: 학교명이나 지역을 알려주시면 NEIS로 확인할 수 있어요.'
  };
}

export function buildNextQuestionSuggestions(result: GeminiGuidanceResponse): string[] {
  const keyword = result.intent.careerKeyword || result.evidence.recommendation.keyword || '희망 진로';
  const suggestions = result.intent.schoolName || result.evidence.schoolAvailability
    ? [
        '확인된 과목으로 2~3학년 선택 로드맵을 만들어줘',
        `${keyword} 진로에 맞는 세특 탐구 주제를 추천해줘`
      ]
    : [
        '우리 학교에 이 과목들이 열리는지 확인해줘',
        `${keyword} 기준으로 학교명을 넣어서 다시 분석해줘`
      ];

  return [
    ...suggestions,
    '컴퓨터공학과/AI학과 기준으로 과목 우선순위를 다시 정리해줘',
    '선생님 상담 때 보여줄 요약으로 정리해줘'
  ];
}

function getProfileValue(profile: StudentProfileSummaryItem[], label: string): string | undefined {
  return profile.find((item) => item.label === label)?.value;
}

function joinOrFallback(values: string[], fallback: string): string {
  return values.length ? values.join(', ') : fallback;
}

function sanitizeFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'report';
}

export function buildPdfReportViewModel(result: GeminiGuidanceResponse): PdfReportViewModel {
  const keyword = result.intent.careerKeyword || result.evidence.recommendation.keyword || '진로';
  const profile = buildStudentProfileSummary(result.intent);
  const subjects = buildSubjectUxCards(result, 8);
  const nextQuestions = buildNextQuestionSuggestions(result);
  const sourceSummary = summarizeEvidenceSource(result);
  const grade = getProfileValue(profile, '학년');
  const school = getProfileValue(profile, '학교');
  const region = getProfileValue(profile, '지역');
  const confirmed = result.evidence.schoolAvailability?.confirmed.map((item) => item.subject) ?? [];
  const notFound = result.evidence.schoolAvailability?.notFound.map((item) => item.subject) ?? [];
  const subtitleParts = [school, region && !school ? region : undefined, grade].filter((value): value is string => Boolean(value));

  return {
    title: `${keyword} 진로 선택과목 보고서`,
    subtitle: subtitleParts.join(' · ') || '학생 맞춤 진로 선택과목 요약',
    generatedAtLabel: 'CareerNet·NEIS·Gemini 근거 기반 자동 보고서',
    profile,
    subjects,
    sections: [
      {
        heading: '학생 상황',
        items: profile.length
          ? profile.map((item) => `${item.label}: ${item.value}`)
          : ['학년, 학교명, 관심 과목을 입력하면 더 정밀한 보고서를 만들 수 있습니다.']
      },
      {
        heading: '추천 과목 요약',
        items: subjects.length
          ? subjects.map((subject) => `${subject.priorityLabel} · ${subject.name}: ${subject.reason}`)
          : ['아직 추천 과목 점수가 충분하지 않습니다. 희망 진로와 관심 과목을 더 알려주세요.']
      },
      {
        heading: '학교 개설 확인',
        items: [
          `확인된 과목: ${joinOrFallback(confirmed, '아직 없음')}`,
          `현재 조회 범위에서 미확인: ${joinOrFallback(notFound, '아직 없음')}`,
          result.evidence.schoolAvailability?.summary ?? result.evidence.regionalSchoolSearch?.summary ?? '학교명이나 지역을 알려주시면 NEIS 시간표와 대조할 수 있습니다.'
        ]
      },
      {
        heading: '근거와 주의사항',
        items: [
          sourceSummary.ai,
          sourceSummary.careernet,
          sourceSummary.neis,
          '현재 조회 범위에서 미확인된 과목은 학교에 없다고 단정하지 않습니다. 실제 선택과목 안내표와 담임/진로 선생님 확인이 필요합니다.'
        ]
      },
      {
        heading: '다음 행동',
        items: nextQuestions
      }
    ]
  };
}

export function buildPdfReportFileName(result: GeminiGuidanceResponse): string {
  const keyword = result.intent.careerKeyword || result.evidence.recommendation.keyword || 'career';
  const schoolOrRegion = result.intent.schoolName || result.intent.regionName || 'student';
  return `career-report-${sanitizeFileNamePart(keyword)}-${sanitizeFileNamePart(schoolOrRegion)}.pdf`;
}
