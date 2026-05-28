import type { ScoredSubject } from './recommendation';

const NEIS_BASE_URL = 'https://open.neis.go.kr/hub';
const DEFAULT_YEAR = '2026';
const DEFAULT_SEMESTER = '1';
const HIGH_SCHOOL_GRADES = ['1', '2', '3'] as const;

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

export type RegionalSubjectSchoolMatch = SchoolSubjectAvailability & {
  matchScore: number;
};

export type RegionalSubjectSchoolSearch = {
  region: { name: string; officeCode?: string };
  matches: RegionalSubjectSchoolMatch[];
  searchedSchools: number;
  requestedSubjects: string[];
  summary: string;
};

export type RegionalSubjectSchoolSearchOptions = NeisSchoolContextOptions & {
  limit?: number;
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

const OFFICE_CODE_ALIASES: Array<{ code: string; names: string[] }> = [
  { code: 'B10', names: ['서울', '서울특별시', '서울시', '서울특별시교육청'] },
  { code: 'C10', names: ['부산', '부산광역시', '부산시', '부산광역시교육청'] },
  { code: 'D10', names: ['대구', '대구광역시', '대구시', '대구광역시교육청'] },
  { code: 'E10', names: ['인천', '인천광역시', '인천시', '인천광역시교육청'] },
  { code: 'F10', names: ['광주', '광주광역시', '광주시', '광주광역시교육청'] },
  { code: 'G10', names: ['대전', '대전광역시', '대전시', '대전광역시교육청'] },
  { code: 'H10', names: ['울산', '울산광역시', '울산시', '울산광역시교육청'] },
  { code: 'I10', names: ['세종', '세종특별자치시', '세종시', '세종특별자치시교육청'] },
  { code: 'J10', names: ['경기', '경기도', '경기도교육청'] },
  { code: 'K10', names: ['강원', '강원도', '강원특별자치도', '강원특별자치도교육청'] },
  { code: 'M10', names: ['충북', '충청북도', '충청북도교육청'] },
  { code: 'N10', names: ['충남', '충청남도', '충청남도교육청'] },
  { code: 'P10', names: ['전북', '전라북도', '전북특별자치도', '전북특별자치도교육청'] },
  { code: 'Q10', names: ['전남', '전라남도', '전라남도교육청'] },
  { code: 'R10', names: ['경북', '경상북도', '경상북도교육청'] },
  { code: 'S10', names: ['경남', '경상남도', '경상남도교육청'] },
  { code: 'T10', names: ['제주', '제주도', '제주특별자치도', '제주특별자치도교육청'] }
];

function normalizeRegion(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase();
}

function resolveOfficeCode(region: string): string | undefined {
  const cleanRegion = normalizeRegion(region);
  if (!cleanRegion) return undefined;
  if (/^[a-z]\d{2}$/i.test(cleanRegion)) return cleanRegion.toUpperCase();
  return OFFICE_CODE_ALIASES.find((item) => item.names.some((name) => normalizeRegion(name) === cleanRegion))?.code;
}

async function getNeisSchoolContextForSchoolWithClient(
  school: NeisSchool,
  client: NeisClient,
  options: NeisSchoolContextOptions = {}
): Promise<NeisSchoolContext> {
  const common = {
    ATPT_OFCDC_SC_CODE: school.officeCode,
    SD_SCHUL_CODE: school.schoolCode
  };
  const ay = options.ay ?? DEFAULT_YEAR;
  const sem = options.sem ?? DEFAULT_SEMESTER;
  const grades = options.grade ? [options.grade] : [...HIGH_SCHOOL_GRADES];

  const [majorRows, trackRows, classroomRowsByGrade, timetableRowsByGrade] = await Promise.all([
    client('schoolMajorinfo', common),
    client('schulAflcoinfo', common),
    Promise.all(grades.map((grade) => client('tiClrminfo', { ...common, AY: ay, SEM: sem, GRADE: grade }))),
    Promise.all(grades.map((grade) => client('hisTimetable', { ...common, AY: ay, SEM: sem, GRADE: grade })))
  ]);
  const classroomRows = classroomRowsByGrade.flat();
  const timetableRows = timetableRowsByGrade.flat();

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

  return getNeisSchoolContextForSchoolWithClient(school, client, options);
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

function rankRegionalMatch(availability: SchoolSubjectAvailability): number {
  return availability.confirmed.reduce((sum, item) => sum + item.score, 0);
}

export async function findRegionalSubjectSchoolsWithClient(
  regionName: string,
  scoredSubjects: ScoredSubject[],
  client: NeisClient,
  options: RegionalSubjectSchoolSearchOptions = {}
): Promise<RegionalSubjectSchoolSearch> {
  const cleanRegion = regionName.trim();
  const officeCode = resolveOfficeCode(cleanRegion);
  const requestedSubjects = scoredSubjects.filter((item) => item.score > 0).slice(0, 12).map((item) => item.name);
  if (!cleanRegion || requestedSubjects.length === 0) {
    return {
      region: { name: cleanRegion, officeCode },
      matches: [],
      searchedSchools: 0,
      requestedSubjects,
      summary: '지역명과 추천 과목이 있어야 과목 개설 학교를 찾을 수 있습니다.'
    };
  }

  const schoolRows = await client('schoolInfo', {
    ATPT_OFCDC_SC_CODE: officeCode,
    LCTN_SC_NM: officeCode ? undefined : cleanRegion,
    SCHUL_KND_SC_NM: '고등학교',
    pSize: 300
  });
  const schools = schoolRows.map(mapSchool).filter((school) => school.officeCode && school.schoolCode);
  const limit = options.limit ?? 10;
  const matches: RegionalSubjectSchoolMatch[] = [];

  for (const school of schools) {
    const context = await getNeisSchoolContextForSchoolWithClient(school, client, options);
    const availability = buildSchoolSubjectAvailability(scoredSubjects, context);
    if (availability.confirmed.length === 0) continue;
    matches.push({ ...availability, matchScore: rankRegionalMatch(availability) });
  }

  matches.sort((a, b) => {
    const scoreDiff = b.matchScore - a.matchScore;
    if (scoreDiff !== 0) return scoreDiff;
    return b.confirmed.length - a.confirmed.length;
  });

  const topMatches = matches.slice(0, limit);
  return {
    region: { name: cleanRegion, officeCode },
    matches: topMatches,
    searchedSchools: schools.length,
    requestedSubjects,
    summary: `${cleanRegion} 지역 고등학교 ${schools.length}곳 중 추천 과목을 NEIS 시간표에서 확인한 학교 ${matches.length}곳을 찾았습니다.`
  };
}

export async function findRegionalSubjectSchools(
  regionName: string,
  scoredSubjects: ScoredSubject[],
  options: RegionalSubjectSchoolSearchOptions = {}
) {
  return findRegionalSubjectSchoolsWithClient(regionName, scoredSubjects, callNeis, options);
}
