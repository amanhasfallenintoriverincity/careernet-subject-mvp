import { NextResponse } from 'next/server';
import { getCareerRecommendation } from '../../../lib/careernet';
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
  return NextResponse.json(recommendation);
}
