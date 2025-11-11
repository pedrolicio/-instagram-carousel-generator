import { NextResponse } from 'next/server';

export const runtime = 'edge';

const LEGACY_MODEL = 'imagegeneration@002';
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const LEGACY_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${LEGACY_MODEL}:generate`;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Goog-Api-Key'
};

const PROMPT_EXEMPLO =
  'Ilustração minimalista 1080x1080 de uma banana geométrica centralizada, fundo azul-claro #A3D9FF, sombras suaves, sem pessoas, estilo clean de identidade visual.';

const ensureCors = (response) => {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
};

const jsonResponse = (data, init) => ensureCors(NextResponse.json(data, init));

const extractBase64 = (payload) => {
  if (!payload) return '';

  const visited = new Set();
  const queue = [payload];

  const pickBase64 = (value) => {
    const candidates = Array.isArray(value)
      ? value
      : [
          value?.data,
          value?.base64,
          value?.b64,
          value?.bytesBase64Encoded,
          value?.bytes_base64_encoded,
          value?.base64Image,
          value?.base64_image,
          value?.imageBase64,
          value?.image_base64,
          value
        ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return '';
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== 'object') continue;

    const inline = current.inlineData || current.inline_data;
    const inlineBase64 = pickBase64(inline);
    if (inlineBase64) return inlineBase64;

    const directBase64 = pickBase64(current);
    if (directBase64) return directBase64;

    const nestedKeys = [
      'predictions',
      'candidates',
      'generatedImages',
      'generated_images',
      'images',
      'contents',
      'content',
      'data',
      'items',
      'output',
      'outputs',
      'media',
      'mediaData',
      'media_data'
    ];

    for (const key of nestedKeys) {
      const value = current[key];
      if (value) {
        queue.push(value);
      }
    }
  }

  return '';
};

const detectSafetyBlock = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const reasons = new Set();
  const messages = new Set();
  const queue = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== 'object') continue;

    const finishReason = current.finishReason || current.finish_reason;
    if (typeof finishReason === 'string') {
      const normalized = finishReason.toUpperCase();
      if (normalized.includes('SAFETY')) {
        reasons.add('SAFETY');
      }
    }

    const blockReason = current.blockReason || current.block_reason;
    if (typeof blockReason === 'string') {
      const normalized = blockReason.toUpperCase();
      if (normalized.includes('SAFETY')) {
        reasons.add('SAFETY');
      }
    }

    const description = current.description || current.message || current.text;
    if (typeof description === 'string' && description.trim()) {
      messages.add(description.trim());
    }

    const safetyRatings = current.safetyRatings || current.safety_ratings;
    if (Array.isArray(safetyRatings)) {
      for (const rating of safetyRatings) {
        const category = rating?.category;
        const blocked = rating?.blocked || rating?.probability === 'VERY_LIKELY';
        if (blocked && typeof category === 'string') {
          reasons.add('SAFETY');
          messages.add(category.replace(/^HARM_CATEGORY_/, '').replace(/_/g, ' ').toLowerCase());
        }
      }
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    });
  }

  if (!reasons.has('SAFETY')) {
    return null;
  }

  const detail = Array.from(messages).join(' ').trim();
  return detail || 'Conteúdo bloqueado por segurança.';
};

const isQuotaError = (error) => {
  const status = error?.status;
  if (status === 429) return true;
  const message = (error?.message || '').toLowerCase();
  if (message.includes('quota') || message.includes('rate limit') || message.includes('exceeded')) {
    return true;
  }
  const payloadMessage = (error?.payload?.error?.message || '').toLowerCase();
  return payloadMessage.includes('quota') || payloadMessage.includes('rate limit');
};

const callApi = async (url, payload, apiKey) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || `Falha na chamada da API (${response.status}).`;
    const apiError = new Error(message);
    apiError.status = response.status;
    apiError.payload = data;
    throw apiError;
  }

  return data;
};

const callLegacyModel = async ({ prompt, negativePrompt, apiKey }) => {
  const url = new URL(LEGACY_ENDPOINT);
  url.searchParams.set('key', apiKey);

  const payload = {
    prompt: { text: prompt },
    imageGenerationConfig: {
      numberOfImages: 1,
      aspectRatio: '1:1',
      outputMimeType: 'image/png',
      safetyFilterLevel: 'block_some',
      personGeneration: 'block_all'
    }
  };

  if (negativePrompt) {
    payload.negativePrompt = { text: negativePrompt };
  }

  const result = await callApi(url.toString(), payload, apiKey);
  console.log('[Imagen] Resposta imagegeneration@002:', JSON.stringify(result));
  return result;
};

const callGeminiModel = async ({ prompt, negativePrompt, apiKey }) => {
  const url = new URL(GEMINI_ENDPOINT);
  url.searchParams.set('key', apiKey);

  const promptText = negativePrompt ? `${prompt}\n\nRestrições: ${negativePrompt}` : prompt;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }]
      }
    ]
  };

  const result = await callApi(url.toString(), payload, apiKey);
  console.log('[Imagen] Resposta gemini-2.5-flash-image:', JSON.stringify(result));
  return result;
};

const generateImage = async ({ prompt, negativePrompt, apiKey }) => {
  try {
    const legacy = await callLegacyModel({ prompt, negativePrompt, apiKey });
    const base64 = extractBase64(legacy);
    if (base64) {
      return base64;
    }

    const safetyDetail = detectSafetyBlock(legacy);
    if (safetyDetail) {
      const safetyError = new Error('Bloqueado por segurança');
      safetyError.status = 422;
      safetyError.details = safetyDetail;
      throw safetyError;
    }

    const noImageError = new Error(
      `O modelo ${LEGACY_MODEL} não retornou imagem. Exemplo de prompt funcional: ${PROMPT_EXEMPLO}`
    );
    noImageError.status = 502;
    noImageError.details = legacy;
    throw noImageError;
  } catch (error) {
    if (error.status && error.status < 500 && error.status !== 422) {
      throw error;
    }

    try {
      const gemini = await callGeminiModel({ prompt, negativePrompt, apiKey });

      const safetyDetail = detectSafetyBlock(gemini);
      if (safetyDetail) {
        const safetyError = new Error('Bloqueado por segurança');
        safetyError.status = 422;
        safetyError.details = safetyDetail;
        throw safetyError;
      }

      const base64 = extractBase64(gemini);
      if (base64) {
        return base64;
      }

      const geminiError = new Error(
        `O modelo ${GEMINI_MODEL} não retornou imagem. Tente ajustar o prompt, por exemplo: ${PROMPT_EXEMPLO}`
      );
      geminiError.status = 502;
      geminiError.details = gemini;
      throw geminiError;
    } catch (fallbackError) {
      fallbackError.cause = error;
      throw fallbackError;
    }
  }
};

export async function OPTIONS() {
  return jsonResponse(null, { status: 204 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const negativePrompt = typeof body?.negativePrompt === 'string' ? body.negativePrompt.trim() : '';
  const providedKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = providedKey || (process.env.GOOGLE_API_KEY || '').trim();

  if (!apiKey) {
    return jsonResponse({ error: 'A API Key é obrigatória.' }, { status: 401 });
  }

  if (!prompt) {
    return jsonResponse({ error: 'O prompt é obrigatório.', exemplo: PROMPT_EXEMPLO }, { status: 400 });
  }

  console.log('[Imagen] Prompt recebido:', prompt);

  try {
    const image = await generateImage({ prompt, negativePrompt, apiKey });
    return jsonResponse({ image });
  } catch (error) {
    if (error?.details) {
      console.log('[Imagen] Erro detalhado:', JSON.stringify(error.details));
    }

    if (error?.status === 422 && error.message.includes('Bloqueado')) {
      return jsonResponse({ error: 'Bloqueado por segurança', detalhes: error.details || null }, { status: 422 });
    }

    if (isQuotaError(error)) {
      return jsonResponse({ error: 'Quota excedida', detalhes: error.message }, { status: error.status || 429 });
    }

    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const message = error?.message || 'Falha ao gerar imagem.';
    return jsonResponse({ error: message, exemplo: PROMPT_EXEMPLO }, { status });
  }
}
