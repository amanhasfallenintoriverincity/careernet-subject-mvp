import { NextResponse } from 'next/server';
import { getCareerRecommendation } from '../../../lib/careernet';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() ?? '';

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 });
  }

  const recommendation = await getCareerRecommendation(keyword);
  return NextResponse.json(recommendation);
}
