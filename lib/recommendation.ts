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
  relate_subject?: string;
  relateSubject?: string[] | string;
  subject_name?: string;
  subject_description?: string;
  [key: string]: unknown;
};

export type RawMaterial = {
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  description?: string;
  [key: string]: unknown;
};

export type RecommendationInput = {
  keyword: string;
  jobs?: RawJob[];
  majors?: RawMajor[];
  materials?: RawMaterial[];
};

export type Recommendation = {
  keyword: string;
  careers: Array<{ name: string; summary: string; relatedMajors: string[] }>;
  majors: Array<{ name: string; summary: string; relatedSubjects: string[] }>;
  recommendedSubjects: {
    strong: string[];
    optional: string[];
    reason: string;
  };
  learningMaterials: Array<{ title: string; url: string; description?: string }>;
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

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function splitList(value: unknown): string[] {
  return normalizeText(value)
    .split(/[,.，、\/|>\n]+/)
    .map((part) => part.trim())
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

export function buildRecommendation(input: RecommendationInput): Recommendation {
  const jobs = input.jobs ?? [];
  const majors = input.majors ?? [];
  const materials = input.materials ?? [];
  const allSubjects = extractSubjects(majors);
  const rule = selectRule(input.keyword);
  const strong = unique([...allSubjects.filter((s) => rule.strong.includes(s)), ...rule.strong]);
  const optional = unique([...allSubjects.filter((s) => !strong.includes(s)), ...rule.optional]).slice(0, 8);

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
      reason: rule.reason
    },
    learningMaterials: materials.slice(0, 5).map((material) => ({
      title: normalizeText(material.title ?? material.name) || `${input.keyword} 진로교육자료`,
      url: normalizeText(material.url ?? material.link) || 'https://www.career.go.kr/',
      description: normalizeText(material.description) || undefined
    })),
    source: jobs.length || majors.length || materials.length ? 'careernet' : 'fallback'
  };
}

export function fallbackRecommendation(keyword: string): Recommendation {
  const rule = selectRule(keyword);
  const recommendation = buildRecommendation({
    keyword,
    jobs: [{ name: `${keyword} 관련 직업`, summary: 'API 키가 없거나 커리어넷 응답이 없을 때 표시되는 기본 예시입니다.' }],
    majors: [{ name: `${keyword} 관련 학과`, summary: '커리어넷 API 키를 설정하면 실제 관련 학과와 과목을 불러옵니다.', relate_subject: rule.strong.join(', ') }],
    materials: [{ title: '커리어넷 진로정보 검색', url: 'https://www.career.go.kr/' }]
  });
  return { ...recommendation, source: 'fallback' };
}
