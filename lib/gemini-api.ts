export type GeminiGenerationConfig = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
};

export type GeminiInteractionRequestInput = {
  apiKey: string;
  model: string;
  input: string;
  generationConfig?: GeminiGenerationConfig;
  systemInstruction?: string;
  previousInteractionId?: string;
};

export type GeminiRequest = {
  url: string;
  init: RequestInit;
};

export type GeminiTextResult = {
  text: string;
  interactionId?: string;
};

type InteractionTextContent = {
  type?: string;
  text?: string;
};

type InteractionStep = {
  type?: string;
  content?: InteractionTextContent[];
};

type InteractionResponse = {
  id?: string;
  object?: string;
  status?: string;
  steps?: InteractionStep[];
  outputs?: InteractionTextContent[];
};

function toInteractionGenerationConfig(config?: GeminiGenerationConfig): Record<string, unknown> | undefined {
  if (!config) return undefined;
  const generationConfig: Record<string, unknown> = {};
  if (typeof config.temperature === 'number') generationConfig.temperature = config.temperature;
  if (typeof config.topP === 'number') generationConfig.top_p = config.topP;
  if (typeof config.topK === 'number') generationConfig.top_k = config.topK;
  if (typeof config.maxOutputTokens === 'number') generationConfig.max_output_tokens = config.maxOutputTokens;
  return Object.keys(generationConfig).length ? generationConfig : undefined;
}

export function buildGeminiInteractionRequest({
  apiKey,
  model,
  input,
  generationConfig,
  systemInstruction,
  previousInteractionId
}: GeminiInteractionRequestInput): GeminiRequest {
  const body: Record<string, unknown> = {
    model,
    input
  };
  const mappedGenerationConfig = toInteractionGenerationConfig(generationConfig);

  if (mappedGenerationConfig) body.generation_config = mappedGenerationConfig;
  if (generationConfig?.responseMimeType) body.response_mime_type = generationConfig.responseMimeType;
  if (generationConfig?.responseSchema) body.response_format = generationConfig.responseSchema;
  if (systemInstruction) body.system_instruction = systemInstruction;
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;

  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/interactions',
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

export function extractGeminiInteractionText(json: unknown): GeminiTextResult | null {
  const response = json as InteractionResponse;
  const stepText = response.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text ?? '')
    .join('')
    .trim();
  const outputText = response.outputs
    ?.filter((output) => output.type === 'text' && typeof output.text === 'string')
    .map((output) => output.text ?? '')
    .join('')
    .trim();
  const text = stepText || outputText;

  return text ? { text, interactionId: response.id } : null;
}

export async function callGeminiInteraction(
  input: string,
  options: {
    apiKey: string;
    model: string;
    generationConfig?: GeminiGenerationConfig;
    systemInstruction?: string;
    previousInteractionId?: string;
  }
): Promise<GeminiTextResult | null> {
  const request = buildGeminiInteractionRequest({
    apiKey: options.apiKey,
    model: options.model,
    input,
    generationConfig: options.generationConfig,
    systemInstruction: options.systemInstruction,
    previousInteractionId: options.previousInteractionId
  });
  const response = await fetch(request.url, request.init);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini Interactions API failed: ${response.status}${errorBody ? ` ${errorBody}` : ''}`);
  }
  return extractGeminiInteractionText(await response.json());
}
