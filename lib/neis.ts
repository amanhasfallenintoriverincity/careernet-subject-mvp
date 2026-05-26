import type { ScoredSubject } from './recommendation';

const NEIS_BASE_URL = 'https://open.neis.go.kr/hub';
const DEFAULT_YEAR = '2026';
const DEFAULT_SEMESTER = '1';

type NeisRow = Record<string, unknown>;

export type NeisClient = (resource: string, params: Record<string, string | number | undefined>) => Promise<NeisRow[]>;

export type NeisSchool = {
  name: string;
  officeCode: string;
  officeName?: string;
  schoolCode: string;
  kind?: string;
  address?: string;
};

export type NeisSchoolMajor = {
  trackName?: string;
  departmentName?: string;
};

export type NeisClassroom = {
  grade?: string;
  semester?: string;
  classroomName?: string;
  departmentName?: string;
  trackName?: string;
};

export type NeisSchoolContext = {
  school: NeisSchool;
  majors: NeisSchoolMajor[];
  tracks: string[];
  classrooms: NeisClassroom[];
  timetableSubjects: string[];
  source: 'neis' | 'fallback';
};

export type NeisSchoolContextOptions = {
  ay?: string;
  sem?: string;
  grade?: string;
};

export type SchoolSubjectAvailability = {
  confirmed: Array<{ subject: string; score: number; evidence: string }>;
  notFound: Array<{ subject: string; score: number; evidence: string }>;
  school: NeisSchool;
  departments: string[];
  tracks: string[];
  summary: string;
};

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeSubject(value: string): string {
  return value
    .replace(/<br\s*\/?> /gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSameSubject(a: string, b: string): boolean {
  const left = normalizeSubject(a).replace(/\s+/g, '').toLowerCase();
  const right = normalizeSubject(b).replace(/\s+/g, '').toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

export function parseNeisRows(resource: string, json: unknown): NeisRow[] {
  if (!json || typeof json !== 'object') return [];
  const record = json as Record<string, unknown>;
  const envelope = record[resource];
  if (!Array.isArray(envelope)) return [];
  const rowContainer = envelope.find((item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).row));
  if (!rowContainer || typeof rowContainer !== 'object') return [];
  return ((rowContainer as Record<string, unknown>).row as unknown[]).filter((item): item is NeisRow => Boolean(item && typeof item === 'object'));
}

export const callNeis: NeisClient = async (resource, params) => {
  const url = new URL(`${NEIS_BASE_URL}/${resource}`);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  url.searchParams.set('pSize', '100');
  const key = process.env.NEIS_API_KEY;
  if (key) url.searchParams.set('KEY', key);

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 12 } });
  if (!response.ok) throw new Error(`NEIS API failed: ${response.status}`);
  return parseNeisRows(resource, await response.json());
};

function mapSchool(row: NeisRow): NeisSchool {
  return {
    name: text(row.SCHUL_NM),
    officeCode: text(row.ATPT_OFCDC_SC_CODE),
    officeName: text(row.ATPT_OFCDC_SC_NM) || undefined,
    schoolCode: text(row.SD_SCHUL_CODE),
    kind: text(row.SCHUL_KND_SC_NM) || undefined,
    address: text(row.ORG_RDNMA) || text(row.ORG_RDNDA) || undefined
  };
}

function mapMajor(row: NeisRow): NeisSchoolMajor {
  return {
    trackName: text(row.ORD_SC_NM) || undefined,
    departmentName: text(row.DDDEP_NM) || undefined
  };
}

function mapClassroom(row: NeisRow): NeisClassroom {
  return {
    grade: text(row.GRADE) || undefined,
    semester: text(row.SEM) || undefined,
    classroomName: text(row.CLRM_NM) || undefined,
    departmentName: text(row.DDDEP_NM) || undefined,
    trackName: text(row.ORD_SC_NM) || undefined
  };
}

function extractTimetableSubjects(rows: NeisRow[]): string[] {
  return unique(rows.map((row) => normalizeSubject(text(row.ITRT_CNTNT))).filter(Boolean));
}

export async function getNeisSchoolContextWithClient(
  schoolName: string,
  client: NeisClient,
  options: NeisSchoolContextOptions = {}
): Promise<NeisSchoolContext | null> {
  const cleanSchoolName = schoolName.trim();
  if (!cleanSchoolName) return null;

  const schools = await client('schoolInfo', { SCHUL_NM: cleanSchoolName, SCHUL_KND_SC_NM: '고등학교' });
  const school = schools.map(mapSchool).find((item) => item.officeCode && item.schoolCode) ?? null;
  if (!school) return null;

  const common = {
    ATPT_OFCDC_SC_CODE: school.officeCode,
    SD_SCHUL_CODE: school.schoolCode
  };
  const ay = options.ay ?? DEFAULT_YEAR;
  const sem = options.sem ?? DEFAULT_SEMESTER;

  const [majorRows, trackRows, classroomRows, timetableRows] = await Promise.all([
    client('schoolMajorinfo', common),
    client('schulAflcoinfo', common),
    client('tiClrminfo', { ...common, AY: ay, SEM: sem, GRADE: options.grade }),
    client('hisTimetable', { ...common, AY: ay, SEM: sem, GRADE: options.grade })
  ]);

  const majors = majorRows.map(mapMajor).filter((item) => item.trackName || item.departmentName);
  const tracks = unique([
    ...trackRows.map((row) => text(row.ORD_SC_NM)),
    ...majors.map((item) => item.trackName ?? '')
  ]);

  return {
    school,
    majors,
    tracks,
    classrooms: classroomRows.map(mapClassroom).filter((item) => item.classroomName || item.departmentName || item.trackName),
    timetableSubjects: extractTimetableSubjects(timetableRows),
    source: 'neis'
  };
}

export async function getNeisSchoolContext(schoolName: string, options: NeisSchoolContextOptions = {}) {
  return getNeisSchoolContextWithClient(schoolName, callNeis, options);
}

export function buildSchoolSubjectAvailability(scoredSubjects: ScoredSubject[], context: NeisSchoolContext): SchoolSubjectAvailability {
  const departments = unique(context.majors.map((major) => major.departmentName ?? ''));
  const confirmed: SchoolSubjectAvailability['confirmed'] = [];
  const notFound: SchoolSubjectAvailability['notFound'] = [];

  for (const subject of scoredSubjects.filter((item) => item.score > 0).slice(0, 12)) {
    const found = context.timetableSubjects.find((candidate) => hasSameSubject(candidate, subject.name));
    const item = {
      subject: subject.name,
      score: subject.score,
      evidence: found ? `NEIS 고등학교시간표 수업내용 “${found}”에서 확인` : 'NEIS 고등학교시간표 수업내용에서 아직 확인되지 않음'
    };
    if (found) confirmed.push(item);
    else notFound.push(item);
  }

  const summary = `${context.school.name} 기준으로 추천 과목 ${confirmed.length}개가 NEIS 시간표에서 확인되었습니다. ${notFound.length}개는 현재 조회 범위에서 확인되지 않았습니다.`;

  return {
    confirmed,
    notFound,
    school: context.school,
    departments,
    tracks: context.tracks,
    summary
  };
}
