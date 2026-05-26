import { NextResponse } from 'next/server';
import { getCareerRecommendation } from '../../../lib/careernet';
import { buildSchoolSubjectAvailability, getNeisSchoolContext } from '../../../lib/neis';
import { parseStudentProfile } from '../../../lib/profile';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() ?? '';

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 });
  }

  const studentProfile = parseStudentProfile({
    grade: searchParams.get('grade') ?? undefined,
    interestArea: searchParams.get('interestArea') ?? undefined,
    preferredSubjects: searchParams.get('preferredSubjects') ?? undefined,
    weakSubjects: searchParams.get('weakSubjects') ?? undefined
  });
  const recommendation = await getCareerRecommendation(keyword, { studentProfile });
  const schoolName = searchParams.get('schoolName')?.trim() ?? '';

  if (!schoolName) return NextResponse.json(recommendation);

  const schoolContext = await getNeisSchoolContext(schoolName, {
    ay: searchParams.get('ay') ?? undefined,
    sem: searchParams.get('sem') ?? undefined,
    grade: studentProfile.grade
  });
  const schoolAvailability = schoolContext
    ? buildSchoolSubjectAvailability(recommendation.recommendedSubjects.scored ?? [], schoolContext)
    : null;

  return NextResponse.json({ ...recommendation, schoolAvailability });
}
