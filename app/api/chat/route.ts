import { NextResponse } from 'next/server';
import { getCareerRecommendation } from '../../../lib/careernet';
import { callGeminiText as callGeminiGenerateContent, type GeminiGenerationConfig } from '../../../lib/gemini-api';
import { buildSchoolSubjectAvailability, findRegionalSubjectSchools, getNeisSchoolContext } from '../../../lib/neis';
import {
  buildFallbackGuidance,
  buildGuidancePrompt,
  buildIntentExtractionPrompt,
  fallbackIntentFromMessages,
  normalizeGuidanceIntent,
  type ChatMessage,
  type GeminiGuidanceResponse,
  type GuidanceIntent
} from '../../../lib/gemini-guidance';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (record.role === 'user' || record.role === 'assistant') && typeof record.content === 'string';
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const raw = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  return JSON.parse(raw);
}

async function callGeminiText(prompt: string, generationConfig?: GeminiGenerationConfig): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  return callGeminiGenerateContent(prompt, {
    apiKey,
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.35,
      ...generationConfig
    }
  });
}

async function inferIntent(messages: ChatMessage[]): Promise<{ intent: GuidanceIntent; usedGemini: boolean }> {
  try {
    const text = await callGeminiText(buildIntentExtractionPrompt(messages), { responseMimeType: 'application/json', temperature: 0.1 });
    if (!text) return { intent: fallbackIntentFromMessages(messages), usedGemini: false };
    return { intent: normalizeGuidanceIntent(extractJson(text), messages), usedGemini: true };
  } catch (error) {
    console.error(error);
    return { intent: fallbackIntentFromMessages(messages), usedGemini: false };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { messages?: unknown } | null;
  const messages = Array.isArray(body?.messages) ? body.messages.filter(isChatMessage).slice(-12) : [];

  if (!messages.length || !messages.some((message) => message.role === 'user')) {
    return NextResponse.json({ error: '사용자 메시지가 필요합니다.' }, { status: 400 });
  }

  const { intent } = await inferIntent(messages);
  const recommendation = await getCareerRecommendation(intent.careerKeyword, { studentProfile: intent.studentProfile });
  const neisOptions = { ay: intent.ay, sem: intent.sem, grade: intent.studentProfile?.grade };
  const [schoolContext, regionalSchoolSearch] = await Promise.all([
    intent.schoolName ? getNeisSchoolContext(intent.schoolName, neisOptions) : Promise.resolve(null),
    intent.regionName ? findRegionalSubjectSchools(intent.regionName, recommendation.recommendedSubjects.scored ?? [], { ...neisOptions, limit: 8 }) : Promise.resolve(null)
  ]);
  const schoolAvailability = schoolContext
    ? buildSchoolSubjectAvailability(recommendation.recommendedSubjects.scored ?? [], schoolContext)
    : null;
  const evidence = { recommendation, schoolAvailability, regionalSchoolSearch };

  let reply = buildFallbackGuidance(intent, evidence);
  let source: GeminiGuidanceResponse['source'] = 'fallback';
  try {
    const geminiReply = await callGeminiText(buildGuidancePrompt(messages, intent, evidence));
    if (geminiReply) {
      reply = geminiReply;
      source = 'gemini';
    }
  } catch (error) {
    console.error(error);
  }

  return NextResponse.json({ reply, intent, evidence, source } satisfies GeminiGuidanceResponse);
}
