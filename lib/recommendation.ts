import type { StudentProfile } from './profile';
export type { StudentProfile } from './profile';

export type RawJob = {
  name?: string;
  job_nm?: string;
  job?: string;
  summary?: string;
  description?: string;
  work?: string;
  relatedMajors?: string[];
  related_major?: string;
  relate_major?: string;
  [key: string]: unknown;
};

export type RawMajor = {
  name?: string;
  major?: string;
  mClass?: string;
  summary?: string;
  description?: string;
  relate_subject?: unknown;
  relateSubject?: unknown;
  subject_name?: string;
  subject_description?: unknown;
  [key: string]: unknown;
};

export type RawMaterial = {
  title?: string;
  name?: string;
  dataTitle?: string;
  url?: string;
  link?: string;
  attFile?: string;
  description?: string;
  dataContent?: string;
  target?: string;
  activityType?: string;
  year?: string;
  [key: string]: unknown;
};

export type RawCounselingCase = {
  question?: string;
  answer?: string;
  memo?: string;
  content?: string;
  category?: string;
  code?: string;
  [key: string]: unknown;
};

export type RawJobType = {
  code?: string;
  name?: string;
  jbgp_code?: string;
  jbgp_code_nm?: string;
  [key: string]: unknown;
};

export type SubjectEvidence = {
  source: 'careernet-major' | 'keyword-rule' | 'interest-area' | 'student-preference' | 'student-weakness';
  label: string;
  weight: number;
};

export type ScoredSubject = {
  name: string;
  score: number;
  tier: 'strong' | 'optional' | 'explore';
  evidence: SubjectEvidence[];
};

export type DataCoverage = {
  jobs: number;
  majors: number;
  materials: number;
  counselingCases: number;
  jobTypes: number;
  confidence: 'high' | 'medium' | 'low';
};

export type RecommendationInput = {
  keyword: string;
  jobs?: RawJob[];
  majors?: RawMajor[];
  materials?: RawMaterial[];
  counselingCases?: RawCounselingCase[];
  jobTypes?: RawJobType[];
  studentProfile?: StudentProfile;
};

export type Recommendation = {
  keyword: string;
  careers: Array<{ name: string; summary: string; relatedMajors: string[] }>;
  majors: Array<{ name: string; summary: string; relatedSubjects: string[] }>;
  recommendedSubjects: {
    strong: string[];
    optional: string[];
    reason: string;
    scored?: ScoredSubject[];
  };
  dataCoverage?: DataCoverage;
  studentProfile?: StudentProfile;
  learningMaterials: Array<{ title: string; url: string; description?: string; target?: string; activityType?: string; year?: string }>;
  counselingCases: Array<{ question: string; answer: string; category?: string }>;
  jobTypes: Array<{ code: string; name: string }>;
  source: 'careernet' | 'fallback';
};

const AI_KEYWORDS = ['인공지능', 'AI', '머신러닝', '데이터', '소프트웨어', '개발자', '컴퓨터'];
const DESIGN_KEYWORDS = ['디자인', '미술', '시각', '웹툰', '영상'];
const BIO_KEYWORDS = ['의학', '간호', '생명', '바이오', '보건'];
const BUSINESS_KEYWORDS = ['경영', '마케팅', '경제', '창업'];

const SUBJECT_RULES = [
  {
    match: AI_KEYWORDS,
    strong: ['정보', '미적분', '확률과 통계', '인공지능 기초'],
    optional: ['기하', '물리학Ⅰ', '데이터 과학'],
    reason: '인공지능·소프트웨어 분야는 수학적 모델링, 알고리즘, 데이터 분석 역량이 중요하므로 수학과 정보 과목을 우선 추천합니다.'
  },
  {
    match: DESIGN_KEYWORDS,
    strong: ['미술', '사회·문화', '언어와 매체'],
    optional: ['미술 창작', '디자인 일반', '문화콘텐츠 산업 일반'],
    reason: '디자인·콘텐츠 분야는 표현력, 사용자 이해, 매체 활용 능력이 중요하므로 예술·사회·언어 계열 과목을 함께 추천합니다.'
  },
  {
    match: BIO_KEYWORDS,
    strong: ['생명과학Ⅰ', '화학Ⅰ', '확률과 통계'],
    optional: ['생명과학Ⅱ', '화학Ⅱ', '보건'],
    reason: '의학·생명·보건 분야는 생명 현상 이해와 실험/통계 해석 역량이 중요하므로 생명과학, 화학, 통계 과목을 추천합니다.'
  },
  {
    match: BUSINESS_KEYWORDS,
    strong: ['경제', '사회·문화', '확률과 통계'],
    optional: ['정치와 법', '실용 경제', '기업과 경영'],
    reason: '경영·경제 분야는 시장과 사회를 읽는 능력, 자료 해석 능력이 중요하므로 사회탐구와 통계 과목을 추천합니다.'
  }
];

const INTEREST_AREA_SUBJECTS: Record<NonNullable<StudentProfile['interestArea']>, string[]> = {
  ai: ['정보', '수학', '미적분', '확률과 통계', '인공지능 기초', '데이터 과학'],
  bio: ['생명과학Ⅰ', '화학Ⅰ', '확률과 통계', '보건'],
  design: ['미술', '미술 창작', '디자인 일반', '언어와 매체'],
  business: ['경제', '사회·문화', '확률과 통계', '실용 경제'],
  general: ['국어', '수학', '영어', '진로와 직업']
};

function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>?/gi, ', ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(', ');
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number') return String(value);
  if (value == null) return '';
  return cleanText(String(value));
}

function flattenTextValues(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenTextValues);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [
      record.subject_description,
      record.subjectDescription,
      record.description,
      record.SBJECT_NM,
      record.SBJECT_SUMRY,
      record.name,
      record.data
    ].flatMap(flattenTextValues);
  }
  return [];
}

function splitList(value: unknown): string[] {
  return flattenTextValues(value)
    .map(cleanText)
    .flatMap((text) => text.split(/[,.，、\/|>\n]+/))
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function extractSubjects(majors: RawMajor[]): string[] {
  return unique(
    majors.flatMap((major) => [
      ...splitList(major.relate_subject),
      ...splitList(major.relateSubject),
      ...splitList(major.subject_description)
    ])
  );
}

function selectRule(keyword: string) {
  return SUBJECT_RULES.find((rule) => rule.match.some((word) => keyword.toLowerCase().includes(word.toLowerCase()))) ?? {
    strong: ['국어', '수학', '영어', '진로와 직업'],
    optional: ['사회·문화', '정보', '과학탐구실험'],
    reason: '입력한 진로와 관련된 학과 정보를 바탕으로 기본 학업 역량과 진로 탐색에 도움이 되는 과목을 추천합니다.'
  };
}

function hasSubject(subjects: string[] | undefined, target: string): boolean {
  return (subjects ?? []).some((subject) => subject.trim().toLowerCase() === target.trim().toLowerCase());
}

function addEvidence(
  bucket: Map<string, { subject: string; score: number; evidence: SubjectEvidence[]; order: number }>,
  subject: string,
  evidence: SubjectEvidence,
  orderHint: number
) {
  const clean = subject.trim();
  if (!clean) return;
  const current = bucket.get(clean) ?? { subject: clean, score: 0, evidence: [], order: orderHint };
  current.score += evidence.weight;
  current.order = Math.min(current.order, orderHint);
  if (!current.evidence.some((item) => item.source === evidence.source && item.label === evidence.label)) {
    current.evidence.push(evidence);
  }
  bucket.set(clean, current);
}

function scoreSubjects(majors: RawMajor[], rule: ReturnType<typeof selectRule>, studentProfile?: StudentProfile): ScoredSubject[] {
  const bucket = new Map<string, { subject: string; score: number; evidence: SubjectEvidence[]; order: number }>();
  let order = 0;

  for (const subject of extractSubjects(majors)) {
    addEvidence(bucket, subject, { source: 'careernet-major', label: '커리어넷 학과 상세의 관련 과목', weight: 5 }, order++);
  }

  for (const subject of rule.strong) {
    addEvidence(bucket, subject, { source: 'keyword-rule', label: '입력 진로 키워드의 핵심 추천 과목', weight: 4 }, order++);
  }

  for (const subject of rule.optional) {
    addEvidence(bucket, subject, { source: 'keyword-rule', label: '입력 진로 키워드의 추가 추천 과목', weight: 2 }, order++);
  }

  const interestSubjects = studentProfile?.interestArea ? INTEREST_AREA_SUBJECTS[studentProfile.interestArea] : [];
  for (const subject of interestSubjects) {
    addEvidence(bucket, subject, { source: 'interest-area', label: '학생 관심 계열과 연결되는 과목', weight: 3 }, order++);
  }

  for (const subject of studentProfile?.preferredSubjects ?? []) {
    addEvidence(bucket, subject, { source: 'student-preference', label: '학생이 좋아하거나 강점으로 입력한 과목', weight: 3 }, order++);
  }

  for (const subject of studentProfile?.weakSubjects ?? []) {
    addEvidence(bucket, subject, { source: 'student-weakness', label: '학생이 부담스럽다고 입력해 우선순위를 낮춘 과목', weight: -4 }, order++);
  }

  const sorted = Array.from(bucket.values()).sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const aCareerNet = a.evidence.some((item) => item.source === 'careernet-major') ? 1 : 0;
    const bCareerNet = b.evidence.some((item) => item.source === 'careernet-major') ? 1 : 0;
    if (aCareerNet !== bCareerNet) return bCareerNet - aCareerNet;
    return a.order - b.order;
  });

  return sorted.map((item, index) => {
    const hasStrongKeywordRule = item.evidence.some((evidence) => evidence.source === 'keyword-rule' && evidence.weight >= 4);
    const isWeakSubject = hasSubject(studentProfile?.weakSubjects, item.subject);
    const tier: ScoredSubject['tier'] = !isWeakSubject && (item.score >= 7 || index < 4 || hasStrongKeywordRule) ? 'strong' : item.score >= 3 ? 'optional' : 'explore';
    return {
      name: item.subject,
      score: item.score,
      tier,
      evidence: item.evidence
    };
  });
}

function buildDataCoverage(input: RecommendationInput): DataCoverage {
  const jobs = input.jobs?.length ?? 0;
  const majors = input.majors?.length ?? 0;
  const materials = input.materials?.length ?? 0;
  const counselingCases = input.counselingCases?.length ?? 0;
  const jobTypes = input.jobTypes?.length ?? 0;
  const primarySources = [jobs, majors, materials].filter((count) => count > 0).length;
  const confidence: DataCoverage['confidence'] = majors > 0 && jobs > 0 && primarySources >= 3 ? 'high' : primarySources >= 2 ? 'medium' : 'low';
  return { jobs, majors, materials, counselingCases, jobTypes, confidence };
}

export function buildRecommendation(input: RecommendationInput): Recommendation {
  const jobs = input.jobs ?? [];
  const majors = input.majors ?? [];
  const materials = input.materials ?? [];
  const counselingCases = input.counselingCases ?? [];
  const jobTypes = input.jobTypes ?? [];
  const rule = selectRule(input.keyword);
  const scored = scoreSubjects(majors, rule, input.studentProfile);
  const strong = scored.filter((subject) => subject.tier === 'strong' && subject.score > 0).map((subject) => subject.name).slice(0, 6);
  const optional = scored
    .filter((subject) => subject.tier === 'optional' && subject.score >= 3 && !strong.includes(subject.name) && !hasSubject(input.studentProfile?.weakSubjects, subject.name))
    .map((subject) => subject.name)
    .slice(0, 8);

  return {
    keyword: input.keyword,
    careers: jobs.slice(0, 5).map((job) => ({
      name: normalizeText(job.name ?? job.job_nm ?? job.job) || input.keyword,
      summary: normalizeText(job.summary ?? job.description ?? job.work) || '커리어넷 직업정보를 바탕으로 관련 진로를 탐색합니다.',
      relatedMajors: unique([...(job.relatedMajors ?? []), ...splitList(job.related_major), ...splitList(job.relate_major)]).slice(0, 5)
    })),
    majors: majors.slice(0, 5).map((major) => ({
      name: normalizeText(major.name ?? major.major ?? major.mClass) || `${input.keyword} 관련 학과`,
      summary: normalizeText(major.summary ?? major.description) || '관련 학과의 특성과 고교 연계 과목을 확인해 보세요.',
      relatedSubjects: extractSubjects([major])
    })),
    recommendedSubjects: {
      strong,
      optional,
      reason: rule.reason,
      scored
    },
    dataCoverage: buildDataCoverage(input),
    studentProfile: input.studentProfile,
    learningMaterials: materials.slice(0, 5).map((material) => ({
      title: normalizeText(material.title ?? material.name ?? material.dataTitle) || `${input.keyword} 진로교육자료`,
      url: normalizeText(material.url ?? material.link ?? material.attFile) || 'https://www.career.go.kr/',
      description: normalizeText(material.description ?? material.dataContent) || undefined,
      target: normalizeText(material.target) || undefined,
      activityType: normalizeText(material.activityType) || undefined,
      year: normalizeText(material.year) || undefined
    })),
    counselingCases: counselingCases.slice(0, 3).map((item) => ({
      question: normalizeText(item.question ?? item.memo) || `${input.keyword} 관련 상담사례`,
      answer: normalizeText(item.answer ?? item.content) || '상세 상담 답변은 커리어넷 상담사례를 확인해 주세요.',
      category: normalizeText(item.category) || undefined
    })),
    jobTypes: jobTypes.map((item) => ({
      code: normalizeText(item.code ?? item.jbgp_code),
      name: normalizeText(item.name ?? item.jbgp_code_nm)
    })).filter((item) => (item.code || item.name) && !/^\d+$/.test(item.name || item.code)).slice(0, 8),
    source: jobs.length || majors.length || materials.length || counselingCases.length || jobTypes.length ? 'careernet' : 'fallback'
  };
}

export function fallbackRecommendation(keyword: string, studentProfile?: StudentProfile): Recommendation {
  const rule = selectRule(keyword);
  const recommendation = buildRecommendation({
    keyword,
    studentProfile,
    jobs: [{ name: `${keyword} 관련 직업`, summary: 'API 키가 없거나 커리어넷 응답이 없을 때 표시되는 기본 예시입니다.' }],
    majors: [{ name: `${keyword} 관련 학과`, summary: '커리어넷 API 키를 설정하면 실제 관련 학과와 과목을 불러옵니다.', relate_subject: rule.strong.join(', ') }],
    materials: [{ title: '커리어넷 진로정보 검색', url: 'https://www.career.go.kr/' }]
  });
  return {
    ...recommendation,
    dataCoverage: recommendation.dataCoverage ? { ...recommendation.dataCoverage, confidence: 'low' } : undefined,
    source: 'fallback'
  };
}
