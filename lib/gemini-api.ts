export type GeminiGenerationConfig = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
};

export type GeminiGenerateContentRequest = {
  apiKey: string;
  model: string;
  prompt: string;
  generationConfig?: GeminiGenerationConfig;
  systemInstruction?: string;
};

export type GeminiRequest = {
  url: string;
  init: RequestInit;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export function buildGeminiGenerateContentRequest({
  apiKey,
  model,
  prompt,
  generationConfig,
  systemInstruction
}: GeminiGenerateContentRequest): GeminiRequest {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  };

  if (generationConfig) body.generationConfig = generationConfig;
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    }
  };
}

export function extractGeminiText(json: unknown): string | null {
  const response = json as GeminiResponse;
  const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  return text || null;
}

export async function callGeminiText(
  prompt: string,
  options: {
    apiKey: string;
    model: string;
    generationConfig?: GeminiGenerationConfig;
    systemInstruction?: string;
  }
): Promise<string | null> {
  const request = buildGeminiGenerateContentRequest({
    apiKey: options.apiKey,
    model: options.model,
    prompt,
    generationConfig: options.generationConfig,
    systemInstruction: options.systemInstruction
  });
  const response = await fetch(request.url, request.init);

  if (!response.ok) throw new Error(`Gemini API failed: ${response.status}`);
  return extractGeminiText(await response.json());
}
