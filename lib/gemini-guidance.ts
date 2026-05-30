import type { RegionalSubjectSchoolSearch, SchoolSubjectAvailability } from './neis';
import type { Recommendation, StudentProfile } from './recommendation';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GuidanceIntent = {
  careerKeyword: string;
  schoolName?: string;
  regionName?: string;
  ay?: string;
  sem?: string;
  studentProfile?: StudentProfile;
};

export type GuidanceEvidence = {
  recommendation: Recommendation;
  schoolAvailability: SchoolSubjectAvailability | null;
  regionalSchoolSearch: RegionalSubjectSchoolSearch | null;
};

export type GeminiGuidanceResponse = {
  reply: string;
  intent: GuidanceIntent;
  evidence: GuidanceEvidence;
  source: 'gemini' | 'fallback';
  interactionId?: string;
};

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function lastUserMessage(messages: ChatMessage[]): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function cleanKeyword(value: string): string {
  return cleanText(value).replace(/[이가은는을를]$/u, '').trim();
}

function splitSubjects(value: string): string[] {
  return value.split(/[,.，、/|\n]+/).map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
}

export function fallbackIntentFromMessages(messages: ChatMessage[]): GuidanceIntent {
  const text = cleanText(messages.map((message) => message.content).join(' '));
  const latest = cleanText(lastUserMessage(messages));
  const careerMatch = latest.match(/(?:진로|직업|꿈|관심사|희망)[은는이가을를:\s]*([^,.!?\n]{2,30})/)?.[1]
    ?? latest.match(/([^,.!?\n]{2,30})(?:가|이)?\s*(?:되고 싶|관심 있|추천|궁금)/)?.[1]
    ?? latest;
  const schoolName = [...text.matchAll(/([가-힣A-Za-z0-9]{2,}(?:고등학교|고))/g)]
    .map((match) => match[1])
    .filter((name) => !['그리고', '이고', '라고'].some((ending) => name.endsWith(ending)))
    .at(-1);
  const regionName = text.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|경기도|강원|충북|충청북도|충남|충청남도|전북|전라북도|전남|전라남도|경북|경상북도|경남|경상남도|제주)/)?.[1];
  const grade = text.match(/고\s*([123])|([123])\s*학년/)?.[1] ?? text.match(/고\s*([123])|([123])\s*학년/)?.[2];
  const preferred = text.match(/(?:좋아하는|강점|잘하는)\s*과목[은는이가을를:\s]*([^.!?\n]+)/)?.[1];
  const weak = text.match(/(?:어려운|부담|약한)\s*과목[은는이가을를:\s]*([^.!?\n]+)/)?.[1];

  return {
    careerKeyword: cleanKeyword(careerMatch).slice(0, 40) || '진로 탐색',
    schoolName,
    regionName,
    ay: '2025',
    sem: '1',
    studentProfile: {
      grade: grade as StudentProfile['grade'],
      preferredSubjects: preferred ? splitSubjects(preferred) : undefined,
      weakSubjects: weak ? splitSubjects(weak) : undefined
    }
  };
}

export function normalizeGuidanceIntent(value: unknown, messages: ChatMessage[]): GuidanceIntent {
  const fallback = fallbackIntentFromMessages(messages);
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const profile = record.studentProfile && typeof record.studentProfile === 'object' ? record.studentProfile as Record<string, unknown> : {};
  const careerKeyword = typeof record.careerKeyword === 'string' && record.careerKeyword.trim()
    ? cleanKeyword(record.careerKeyword).slice(0, 40)
    : fallback.careerKeyword;
  const grade = typeof profile.grade === 'string' && ['1', '2', '3'].includes(profile.grade) ? profile.grade as StudentProfile['grade'] : fallback.studentProfile?.grade;
  const preferredSubjects = Array.isArray(profile.preferredSubjects) ? profile.preferredSubjects.filter((item): item is string => typeof item === 'string').slice(0, 8) : fallback.studentProfile?.preferredSubjects;
  const weakSubjects = Array.isArray(profile.weakSubjects) ? profile.weakSubjects.filter((item): item is string => typeof item === 'string').slice(0, 8) : fallback.studentProfile?.weakSubjects;

  return {
    careerKeyword,
    schoolName: typeof record.schoolName === 'string' && record.schoolName.trim() ? cleanText(record.schoolName) : fallback.schoolName,
    regionName: typeof record.regionName === 'string' && record.regionName.trim() ? cleanText(record.regionName) : fallback.regionName,
    ay: typeof record.ay === 'string' && record.ay.trim() ? cleanText(record.ay) : fallback.ay,
    sem: typeof record.sem === 'string' && ['1', '2'].includes(record.sem) ? record.sem : fallback.sem,
    studentProfile: { grade, preferredSubjects, weakSubjects }
  };
}

export function buildIntentExtractionPrompt(messages: ChatMessage[]): string {
  return `아래 대화에서 진로 추천에 필요한 정보를 JSON으로만 추출하세요.\n필드: careerKeyword, schoolName, regionName, ay, sem, studentProfile.grade, studentProfile.preferredSubjects, studentProfile.weakSubjects.\n모르면 빈 문자열 또는 빈 배열을 쓰세요.\n\n대화:\n${messages.map((message) => `${message.role}: ${message.content}`).join('\n')}`;
}

export function buildEvidenceBundle(evidence: GuidanceEvidence) {
  const { recommendation, schoolAvailability, regionalSchoolSearch } = evidence;
  return {
    careerKeyword: recommendation.keyword,
    source: recommendation.source,
    dataCoverage: recommendation.dataCoverage,
    recommendedSubjects: recommendation.recommendedSubjects.scored?.slice(0, 12).map((subject) => ({
      name: subject.name,
      score: subject.score,
      tier: subject.tier,
      evidence: subject.evidence.map((item) => item.label)
    })) ?? [],
    careers: recommendation.careers.slice(0, 5),
    majors: recommendation.majors.slice(0, 5),
    materials: recommendation.learningMaterials.slice(0, 5),
    counselingCases: recommendation.counselingCases.slice(0, 3),
    schoolAvailability: schoolAvailability ? {
      school: schoolAvailability.school,
      confirmed: schoolAvailability.confirmed,
      notFound: schoolAvailability.notFound,
      departments: schoolAvailability.departments,
      tracks: schoolAvailability.tracks,
      summary: schoolAvailability.summary
    } : null,
    regionalSchoolSearch: regionalSchoolSearch ? {
      region: regionalSchoolSearch.region,
      searchedSchools: regionalSchoolSearch.searchedSchools,
      requestedSubjects: regionalSchoolSearch.requestedSubjects,
      matches: regionalSchoolSearch.matches.slice(0, 5).map((match) => ({
        school: match.school,
        matchScore: match.matchScore,
        confirmed: match.confirmed,
        notFound: match.notFound
      })),
      summary: regionalSchoolSearch.summary
    } : null
  };
}

export function buildGuidancePrompt(messages: ChatMessage[], intent: GuidanceIntent, evidence: GuidanceEvidence): string {
  return `당신은 한국 고등학생을 돕는 진로 상담 AI입니다. 반드시 제공된 CareerNet/NEIS 증거만 근거로 답하세요.\n- CareerNet 근거: 관련 직업, 학과, 학과 관련 과목, 진로교육자료, 상담사례\n- NEIS 근거: 학교/지역 시간표에서 확인된 과목과 학교 후보\n- 확인되지 않은 내용은 추정이라고 말하고, API 근거처럼 단정하지 마세요.\n- 확인되지 않은 과목은 학교에 없다고 단정하지 말고, "현재 조회 범위에서 확인되지 않았다"고 표현하세요.\n- 답변은 한국어 존댓말로, 학생에게 대화하듯 자연스럽게 작성하세요.\n- 화면은 Markdown을 지원하므로 제목(##), 목록(-), 굵게(**텍스트**)를 사용해 읽기 쉽게 답하세요.\n- 아직 정보가 부족하면 1~3개의 후속 질문을 포함하세요.\n\n사용자 의도:\n${JSON.stringify(intent, null, 2)}\n\n대화:\n${messages.map((message) => `${message.role}: ${message.content}`).join('\n')}\n\nAPI 증거 묶음:\n${JSON.stringify(buildEvidenceBundle(evidence), null, 2)}\n\n답변 형식:\n## 3줄 요약\n1. 결론을 한 문장으로 말하세요.\n2. 가장 중요한 추천 과목 또는 학교 확인 결과를 한 문장으로 말하세요.\n3. 사용자가 바로 할 다음 행동을 한 문장으로 말하세요.\n\n## 지금까지 파악한 진로 방향\n## 추천 과목과 이유\n## NEIS 학교·지역 확인 결과\n## CareerNet 근거\n## 다음 행동`;
}

export function buildFallbackGuidance(intent: GuidanceIntent, evidence: GuidanceEvidence): string {
  const bundle = buildEvidenceBundle(evidence);
  const subjects = bundle.recommendedSubjects.slice(0, 5).map((subject) => `${subject.name}(점수 ${subject.score})`).join(', ') || '추천 과목 근거 부족';
  const topSubject = bundle.recommendedSubjects[0]?.name ?? '추천 과목';
  const careers = bundle.careers.slice(0, 3).map((career) => career.name).join(', ') || '관련 직업 정보 부족';
  const school = evidence.schoolAvailability?.summary ?? evidence.regionalSchoolSearch?.summary ?? '학교명이나 지역을 알려주시면 NEIS 시간표와 대조해드릴 수 있습니다.';

  return `## 3줄 요약\n1. 지금 대화에서는 **${intent.careerKeyword}** 방향을 중심으로 파악했습니다.\n2. 우선 추천 과목은 **${topSubject}** 등이며, CareerNet·진로 키워드·학생 입력을 함께 점수화했습니다.\n3. 다음에는 학교명, 지역, 좋아하는 과목과 부담스러운 과목을 알려주시면 더 정확해집니다.\n\n## 지금까지 파악한 진로 방향\n${intent.careerKeyword} 방향을 중심으로 진로와 과목을 연결해 보았습니다.\n\n## 추천 과목과 이유\n추천 과목은 ${subjects}입니다. 이 과목들은 CareerNet 학과 관련 과목, 진로 키워드, 학생 입력 정보를 함께 점수화한 결과입니다.\n\n## NEIS 학교·지역 확인 결과\nNEIS 확인 결과: ${school}\n\n## CareerNet 근거\nCareerNet 근거로는 ${careers} 등의 관련 직업/학과 정보가 연결되었습니다.\n\n## 다음 행동\n- 학교명이나 지역을 알려주시면 추천 과목이 실제 시간표에서 확인되는지 대조해드릴게요.\n- 희망 학과를 알려주시면 과목 우선순위를 더 좁혀드릴게요.\n- 선생님 상담용 요약이나 2~3학년 로드맵으로도 정리할 수 있어요.`;
}
