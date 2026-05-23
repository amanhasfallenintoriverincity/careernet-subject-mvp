import { buildRecommendation, fallbackRecommendation, type RawJob, type RawMajor, type RawMaterial } from './recommendation';

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
    description: getString(record, ['description', 'summary', 'content']),
    url: getString(record, ['url', 'link', 'fileUrl', 'viewUrl'])
  };
}

function getJobSeq(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['jobdicSeq', 'jobDicSeq', 'job_seq', 'seq', 'jobSeq']);
}

function getMajorSeq(item: unknown): string {
  const record = firstRecord(item);
  return getString(record, ['majorSeq', 'major_seq', 'seq']);
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
  const materials = await client({ svcCode: 'COSE', searchTitleWord: keyword, thisPage: 1, perPage: 8 });
  return materials.map(mapMaterial).filter((material) => material.title);
}

export async function getCareerRecommendationWithClient(keyword: string, client: CareerNetClient) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return fallbackRecommendation('진로');

  try {
    const [jobs, majors, materials] = await Promise.all([
      fetchJobDetails(cleanKeyword, client),
      fetchMajorDetails(cleanKeyword, client),
      fetchMaterials(cleanKeyword, client)
    ]);

    if (!jobs.length && !majors.length && !materials.length) return fallbackRecommendation(cleanKeyword);
    return buildRecommendation({ keyword: cleanKeyword, jobs, majors, materials });
  } catch (error) {
    console.error(error);
    return fallbackRecommendation(cleanKeyword);
  }
}

export async function getCareerRecommendation(keyword: string) {
  return getCareerRecommendationWithClient(keyword, callCareerNet);
}
