import { describe, expect, it } from 'vitest';
import { buildGeminiGenerateContentRequest, extractGeminiText } from '../lib/gemini-api';

describe('gemini-api', () => {
  it('공식 REST 문서 형식에 맞춰 generateContent 요청을 만든다', () => {
    const request = buildGeminiGenerateContentRequest({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      prompt: '안녕',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    });

    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-key'
    });
    expect(JSON.parse(request.init.body as string)).toEqual({
      contents: [{ role: 'user', parts: [{ text: '안녕' }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
    });
  });

  it('Gemini 응답 candidates.content.parts[].text를 합쳐서 추출한다', () => {
    const text = extractGeminiText({
      candidates: [{ content: { parts: [{ text: '첫 문장' }, { text: ' 둘째 문장' }] } }]
    });

    expect(text).toBe('첫 문장 둘째 문장');
  });
});
