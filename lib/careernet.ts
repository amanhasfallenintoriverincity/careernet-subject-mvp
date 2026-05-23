import { buildRecommendation, fallbackRecommendation, type RawJob, type RawMajor, type RawMaterial } from './recommendation';

const BASE_URL = 'https://www.career.go.kr/cnet/openapi/getOpenApi';

type CareerNetParams = Record<string, string | number | undefined>;

type CareerNetResponse = {
  dataSearch?: { content?: unknown[] };
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

async function callCareerNet(params: CareerNetParams): Promise<unknown[]> {
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
}

function getString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function mapJob(item: unknown): RawJob {
  const record = item as Record<string, unknown>;
  return {
    name: getString(record, ['job_nm', 'jobNm', 'job', 'name', 'JOB_NM']),
    summary: getString(record, ['summary', 'work', 'job_summary', 'description', 'jobWork']),
    related_major: getString(record, ['relate_major', 'related_major', 'major', 'relateMajor'])
  };
}

function mapMajor(item: unknown): RawMajor {
  const record = item as Record<string, unknown>;
  return {
    name: getString(record, ['major', 'mClass', 'lClass', 'name', 'majorNm', 'MAJOR_NM']),
    summary: getString(record, ['summary', 'description', 'major_info', 'property', 'interest']),
    relate_subject: getString(record, ['relate_subject', 'relateSubject', 'RELATE_SUBJECT']),
    subject_name: getString(record, ['subject_name', 'subjectName']),
    subject_description: getString(record, ['subject_description', 'subjectDescription']),
    majorSeq: getString(record, ['majorSeq', 'major_seq', 'seq'])
  };
}

function mapMaterial(item: unknown): RawMaterial {
  const record = item as Record<string, unknown>;
  return {
    title: getString(record, ['title', 'name', 'coseTitle', 'subject']),
    description: getString(record, ['description', 'summary', 'content']),
    url: getString(record, ['url', 'link', 'fileUrl', 'viewUrl'])
  };
}

export async function getCareerRecommendation(keyword: string) {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return fallbackRecommendation('진로');

  try {
    const [jobsRaw, majorsRaw, materialsRaw] = await Promise.all([
      callCareerNet({ svcCode: 'JOB', gubun: 'job_dic_list', searchJobNm: cleanKeyword, thisPage: 1, perPage: 8 }),
      callCareerNet({ svcCode: 'MAJOR', gubun: 'univ_list', searchTitle: cleanKeyword, thisPage: 1, perPage: 8 }),
      callCareerNet({ svcCode: 'COSE', searchTitleWord: cleanKeyword, thisPage: 1, perPage: 8 })
    ]);

    const jobs = jobsRaw.map(mapJob).filter((job) => job.name);
    const majors = majorsRaw.map(mapMajor).filter((major) => major.name || major.relate_subject || major.subject_description);
    const materials = materialsRaw.map(mapMaterial).filter((material) => material.title);

    if (!jobs.length && !majors.length && !materials.length) return fallbackRecommendation(cleanKeyword);
    return buildRecommendation({ keyword: cleanKeyword, jobs, majors, materials });
  } catch (error) {
    console.error(error);
    return fallbackRecommendation(cleanKeyword);
  }
}
