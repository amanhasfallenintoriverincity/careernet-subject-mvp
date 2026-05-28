import { describe, expect, it } from 'vitest';
import { buildGeminiInteractionRequest, extractGeminiInteractionText } from '../lib/gemini-api';

describe('gemini-api', () => {
  it('Interactions API 문서 형식에 맞춰 상호작용 생성 요청을 만든다', () => {
    const request = buildGeminiInteractionRequest({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      input: '안녕',
      previousInteractionId: 'v1_prev',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 512 }
    });

    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-key'
    });
    expect(JSON.parse(request.init.body as string)).toEqual({
      model: 'gemini-2.5-flash',
      input: '안녕',
      previous_interaction_id: 'v1_prev',
      response_mime_type: 'application/json',
      generation_config: { temperature: 0.1, max_output_tokens: 512 }
    });
  });

  it('Interactions API 응답 steps[].content[].text를 합쳐서 추출한다', () => {
    const result = extractGeminiInteractionText({
      id: 'v1_interaction',
      object: 'interaction',
      status: 'completed',
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: '첫 문장' }, { type: 'text', text: ' 둘째 문장' }] },
        { type: 'tool_call', content: [{ type: 'text', text: '무시' }] }
      ]
    });

    expect(result).toEqual({ text: '첫 문장 둘째 문장', interactionId: 'v1_interaction' });
  });

  it('실제 Interactions API 응답의 outputs[].text도 추출한다', () => {
    const result = extractGeminiInteractionText({
      id: 'v1_interaction',
      object: 'interaction',
      status: 'completed',
      outputs: [
        { type: 'thought', text: '무시' },
        { type: 'text', text: '실제 답변' }
      ]
    });

    expect(result).toEqual({ text: '실제 답변', interactionId: 'v1_interaction' });
  });
});
