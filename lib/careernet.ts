import { buildRecommendation, fallbackRecommendation, type RawCounselingCase, type RawJob, type RawJobType, type RawMajor, type RawMaterial, type StudentProfile } from './recommendation';

const BASE_URL = 'https://www.career.go.kr/cnet/openapi/getOpenApi';
const MAX_DETAIL_REQUESTS = 3;

export type CareerNetParams = Record<string, string | number | undefined>;
export type CareerNetClient = (params: CareerNetParams) => Promise<unknown[]>;

type CareerNetResponse = {
  dataSearch?: { content?: unknown[] | unknown; totalCount?: unknown };
  content?: unknown[] | unknown;
  result?: unknown[] | unknown;
  [key: string]: unknown;
};

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function extractContent(json: CareerNetResponse): unknown[] {
  return [
    ...asArray(json.dataSearch?.content),
    ...asArray(json.content),
    ...asArray(json.result)
  ];
}

export const callCareerNet: CareerNetClient = async (params) => {
  const apiKey = process.env.CAREERNET_API_KEY;
  if (!apiKey) return [];

  const url = new URL(BASE_URL);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('svcType', 'api');
  url.searchParams.set('contentType', 'json');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
  if (!response.ok) throw new Error(`CareerNet API failed: ${response.status}`);
  const json = (await response.json()) as CareerNetResponse;
  return extractContent(json);
};

function getString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function firstRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
}

function mergeRecords(base: unknown, detail: unknown): Record<string, unknown> {
  return { ...firstRecord(base), ...firstRecord(detail) };
}

function mapJob(item: unknown): RawJob {
  const record = firstRecord(item);
  return {
    name: getString(record, ['job', 'job_nm', 'jobNm', 'name', 'JOB_NM']),
    summary: getString(record, ['summary', 'work', 'job_summary', 'description', 'jobWork', 'aptitude', 'possibility']),
    related_major: getString(record, ['related_major', 'relate_major', 'relateMajor', 'major', 'department'])
  };
}

function mapMajor(item: unknown): RawMajor {
  const record = firstRecord(item);
  return {
    name: getString(record, ['major', 'majorName', 'mClass', 'lClass', 'facilName', 'name', 'majorNm', 'MAJOR_NM']),
    summary: getString(record, ['summary', 'description', 'major_info', 'property', 'interest']),
    relate_subject: record.relate_subject ?? record.relateSubject ?? record.RELATE_SUBJECT,
    subject_name: getString(record, ['subject_name', 'subjectName']),
    subject_description: record.subject_description ?? record.subjectDescription,
    job: record.job,
    qualifications: record.qualifications,
    majorSeq: getString(record, ['majorSeq', 'major_seq', 'seq'])
  };
}

function mapMaterial(item: unknown): RawMaterial {
  const record = firstRecord(item);
  return {
    title: getString(record, ['title', 'name', 'coseTitle', 'dataTitle', 'subject']),
    description: getString(record, ['description', 'summary', 'content', 'contents', 'dataContent', 'cn']),
    url: getString(record, ['url', 'link', 'fileUrl', 'viewUrl', 'atchmnflUrl', 'attFile']),
    target: normalizeTarget(getString(record, ['target', 'targt', 'TARGET'])),
    activityType: getString(record, ['activityType', 'activity_type', 'ACTIVITY_TYPE', 'category']),
    year: getString(record, ['year'])
  };
}

function mapCounselingCase(item: unknown): RawCounselingCase {
  const record = firstRecord(item);
  return {
    code: getString(record, ['code', 'con_cd', 'conCd']),
    question: getString(record, ['question', 'memo', 'title']),
    answer: getString(record, ['answer', 'contents', 'content']),
    category: getString(record, ['gubun', 'category'])
  };
}

function mapJobType(item: unknown): RawJobType {
  const record = firstRecord(item);
  return {
    code: getString(record, ['code', 'CODE', 'job_ctg_code', 'jbgp_code', 'CODE_ID']),
    name: getString(record, ['name', 'CODE_NM', 'job_ctg_nm', 'jbgp_code_nm', 'category', 'profession'])
  };
}

function normalizeTarget(value: string): string {
  const map: Record<string, string> = {
    C: '공통',
    E: '초등학교',
    M: '중학교',
    I: '일반고등학교',
    J: '직업계고등학교',
    V: '대학교',
    U: '기타'
  };
  return map[value] ?? value;
}

function getJobSeq(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['jobdicSeq', 'jobDicSeq', 'job_seq', 'seq', 'jobSeq']);
}

function getMajorSeq(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['majorSeq', 'major_seq', 'seq']);
}

function getMaterialSeq(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['seq', 'coseSeq', 'cose_seq']);
}

function getCounselCode(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['code', 'con_cd', 'conCd']);
}

const DOMAIN_EXPANSIONS: Array<[RegExp, string[]]> = [
  [/인공지능|AI|개발자|소프트웨어|컴퓨터|데이터/i, ['인공지능', '컴퓨터', '소프트웨어', '개발자']],
  [/간호|의학|의사|보건|바이오|생명/i, ['간호', '보건', '생명', '의학']],
  [/웹툰|디자인|미술|영상|콘텐츠/i, ['웹툰', '디자인', '미술', '콘텐츠']],
  [/마케팅|경영|경제|창업/i, ['마케팅', '경영', '경제']]
];

function buildSearchKeywords(keyword: string, mode: 'job' | 'content' = 'content'): string[] {
  const tokens = keyword
    .split(/[\s,/|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const usefulTokens = tokens.filter((token) => /개발자|소프트웨어|컴퓨터|간호사|간호|의사|교사|디자이너|마케팅|경영|데이터|프로그래머/.test(token));
  const expansions = DOMAIN_EXPANSIONS.flatMap(([pattern, values]) => pattern.test(keyword) ? values : []);
  const candidates = mode === 'job'
    ? [keyword, ...usefulTokens, ...tokens.slice().reverse(), ...expansions]
    : [keyword, ...expansions, ...usefulTokens, ...tokens.slice().reverse()];
  return Array.from(new Set(candidates)).slice(0, 8);
}

async function fetchJobDetails(keyword: string, client: CareerNetClient): Promise<RawJob[]> {
  let list: unknown[] = [];
  for (const searchJobNm of buildSearchKeywords(keyword, 'job')) {
    list = await client({ svcCode: 'JOB', gubun: 'job_dic_list', searchJobNm, thisPage: 1, perPage: 8 });
    if (list.length) break;
  }
  const targets = list.slice(0, MAX_DETAIL_REQUESTS);
  const details = await Promise.all(
    targets.map(async (job) => {
      const jobdicSeq = getJobSeq(job);
      if (!jobdicSeq) return job;
      const detail = await client({ svcCode: 'JOB_VIEW', gubun: 'job_dic_list', jobdicSeq });
      return mergeRecords(job, detail[0]);
    })
  );

  const source = details.length ? details : list;
  return source.map(mapJob).filter((job) => job.name);
}

async function fetchMajorDetails(keyword: string, client: CareerNetClient): Promise<RawMajor[]> {
  let list: unknown[] = [];
  for (const searchTitle of buildSearchKeywords(keyword)) {
    list = await client({ svcCode: 'MAJOR', gubun: 'univ_list', searchTitle, thisPage: 1, perPage: 8 });
    if (list.length) break;
  }
  const targets = list.slice(0, MAX_DETAIL_REQUESTS);
  const details = await Promise.all(
    targets.map(async (major) => {
      const majorSeq = getMajorSeq(major);
      if (!majorSeq) return major;
      const detail = await client({ svcCode: 'MAJOR_VIEW', gubun: 'univ_list', majorSeq });
      return mergeRecords(major, detail[0]);
    })
  );

  const source = details.length ? details : list;
  return source.map(mapMajor).filter((major) => major.name || major.relate_subject || major.subject_description);
}

async function fetchMaterials(keyword: string, client: CareerNetClient): Promise<RawMaterial[]> {
  let list: unknown[] = [];
  for (const searchTitleWord of buildSearchKeywords(keyword)) {
    list = await client({ svcCode: 'COSE', searchTitleWord, thisPage: 1, perPage: 8 });
    if (list.length) break;
  }
  const targets = list.slice(0, MAX_DETAIL_REQUESTS);
  const details = await Promise.all(
    targets.map(async (material) => {
      const seq = getMaterialSeq(material);
      if (!seq) return material;
      const detail = await client({ svcCode: 'COSE_VIEW', seq });
      return mergeRecords(material, detail[0]);
    })
  );
  const source = details.length ? details : list;
  return source.map(mapMaterial).filter((material) => material.title);
}

async function fetchCounselingCases(keyword: string, client: CareerNetClient): Promise<RawCounselingCase[]> {
  const list = await client({ svcCode: 'COUNSEL', searchText: keyword, thisPage: 1, perPage: 5 });
  const targets = list.slice(0, MAX_DETAIL_REQUESTS);
  const details = await Promise.all(
    targets.map(async (item) => {
      const con_cd = getCounselCode(item);
      if (!con_cd) return item;
      const detail = await client({ svcCode: 'COUNSEL_VIEW', con_cd });
      return mergeRecords(item, detail[0]);
    })
  );
  const source = details.length ? details : list;
  return source.map(mapCounselingCase).filter((item) => item.question || item.answer);
}

async function fetchJobTypes(client: CareerNetClient): Promise<RawJobType[]> {
  const types = await client({ svcCode: 'JOB_TYPE', gubun: 'job_dic_list' });
  return types.map(mapJobType).filter((item) => item.code || item.name);
}

type CareerRecommendationOptions = {
  studentProfile?: StudentProfile;
};

export async function getCareerRecommendationWithClient(keyword: string, client: CareerNetClient, options: CareerRecommendationOptions = {}) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return fallbackRecommendation('진로', options.studentProfile);

  try {
    const [jobs, majors, materials, counselingCases, jobTypes] = await Promise.all([
      fetchJobDetails(cleanKeyword, client),
      fetchMajorDetails(cleanKeyword, client),
      fetchMaterials(cleanKeyword, client),
      fetchCounselingCases(cleanKeyword, client),
      fetchJobTypes(client)
    ]);

    if (!jobs.length && !majors.length && !materials.length && !counselingCases.length && !jobTypes.length) return fallbackRecommendation(cleanKeyword, options.studentProfile);
    return buildRecommendation({ keyword: cleanKeyword, jobs, majors, materials, counselingCases, jobTypes, studentProfile: options.studentProfile });
  } catch (error) {
    console.error(error);
    return fallbackRecommendation(cleanKeyword, options.studentProfile);
  }
}

export async function getCareerRecommendation(keyword: string, options: CareerRecommendationOptions = {}) {
  return getCareerRecommendationWithClient(keyword, callCareerNet, options);
}
