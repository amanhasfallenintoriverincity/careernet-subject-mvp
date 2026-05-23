import { buildRecommendation, fallbackRecommendation, type RawCounselingCase, type RawJob, type RawJobType, type RawMajor, type RawMaterial } from './recommendation';

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
    title: getString(record, ['title', 'name', 'coseTitle', 'subject']),
    description: getString(record, ['description', 'summary', 'content', 'contents', 'cn']),
    url: getString(record, ['url', 'link', 'fileUrl', 'viewUrl', 'atchmnflUrl']),
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
    code: getString(record, ['code', 'CODE', 'job_ctg_code', 'CODE_ID']),
    name: getString(record, ['name', 'CODE_NM', 'job_ctg_nm', 'category', 'profession'])
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

async function fetchJobDetails(keyword: string, client: CareerNetClient): Promise<RawJob[]> {
  const list = await client({ svcCode: 'JOB', gubun: 'job_dic_list', searchJobNm: keyword, thisPage: 1, perPage: 8 });
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
  const list = await client({ svcCode: 'MAJOR', gubun: 'univ_list', searchTitle: keyword, thisPage: 1, perPage: 8 });
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
  const list = await client({ svcCode: 'COSE', searchTitleWord: keyword, thisPage: 1, perPage: 8 });
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

export async function getCareerRecommendationWithClient(keyword: string, client: CareerNetClient) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return fallbackRecommendation('진로');

  try {
    const [jobs, majors, materials, counselingCases, jobTypes] = await Promise.all([
      fetchJobDetails(cleanKeyword, client),
      fetchMajorDetails(cleanKeyword, client),
      fetchMaterials(cleanKeyword, client),
      fetchCounselingCases(cleanKeyword, client),
      fetchJobTypes(client)
    ]);

    if (!jobs.length && !majors.length && !materials.length && !counselingCases.length && !jobTypes.length) return fallbackRecommendation(cleanKeyword);
    return buildRecommendation({ keyword: cleanKeyword, jobs, majors, materials, counselingCases, jobTypes });
  } catch (error) {
    console.error(error);
    return fallbackRecommendation(cleanKeyword);
  }
}

export async function getCareerRecommendation(keyword: string) {
  return getCareerRecommendationWithClient(keyword, callCareerNet);
}
