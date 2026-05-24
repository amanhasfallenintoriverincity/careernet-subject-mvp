export type StudentProfile = {
  grade?: '1' | '2' | '3';
  interestArea?: 'ai' | 'bio' | 'design' | 'business' | 'general';
  preferredSubjects?: string[];
  weakSubjects?: string[];
};

const GRADES = new Set(['1', '2', '3']);
const INTEREST_AREAS = new Set(['ai', 'bio', 'design', 'business', 'general']);

type QueryValue = string | string[] | undefined;
type QueryLike = Record<string, QueryValue>;

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseSubjectList(value: QueryValue): string[] | undefined {
  const raw = Array.isArray(value) ? value.join(',') : value;
  const items = Array.from(
    new Set(
      (raw ?? '')
        .split(/[,.，、|/\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
  return items.length ? items : undefined;
}

export function serializeSubjectList(subjects: string[]): string {
  return Array.from(new Set(subjects.map((item) => item.trim()).filter(Boolean))).join(',');
}

export function parseStudentProfile(query: QueryLike): StudentProfile {
  const grade = first(query.grade);
  const interestArea = first(query.interestArea);
  const profile: StudentProfile = {};

  if (grade && GRADES.has(grade)) profile.grade = grade as StudentProfile['grade'];
  if (interestArea && INTEREST_AREAS.has(interestArea)) profile.interestArea = interestArea as StudentProfile['interestArea'];

  const preferredSubjects = parseSubjectList(query.preferredSubjects);
  const weakSubjects = parseSubjectList(query.weakSubjects);
  if (preferredSubjects) profile.preferredSubjects = preferredSubjects;
  if (weakSubjects) profile.weakSubjects = weakSubjects;

  return profile;
}
