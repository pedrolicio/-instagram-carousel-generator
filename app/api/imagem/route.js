import { NextResponse } from 'next/server';

export const runtime = 'edge';

const GEMINI_MODEL_NAME = 'gemini-2.5-flash-image';
const IMAGEN_40_MODEL_NAME = 'imagen-4.0-generate-001';
const IMAGEN_40_ULTRA_MODEL_NAME = 'imagen-4.0-ultra-generate-001';
const GEMINI_IMAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const LEGACY_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';
const LEGACY_FALLBACK_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://instagram-carousel-generator-git-main-pedro-licios-projects.vercel.app'
];

const makeRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Ignored – falls back to timestamp-based id below.
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const logWithContext = (level, requestId, message, meta) => {
  const prefix = requestId ? `[Imagen][${requestId}]` : '[Imagen]';
  const logger = typeof console[level] === 'function' ? console[level] : console.log;
  if (meta !== undefined) {
    logger(`${prefix} ${message}`, meta);
  } else {
    logger(`${prefix} ${message}`);
  }
};

const logInfo = (requestId, message, meta) => logWithContext('info', requestId, message, meta);
const logWarn = (requestId, message, meta) => logWithContext('warn', requestId, message, meta);
const logError = (requestId, message, meta) => logWithContext('error', requestId, message, meta);

const formatErrorForLog = (error) => {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const formatted = {
    name: error.name || 'Error',
    message: error.message || null,
    status: error.status ?? null,
    code: error.code || error?.payload?.error?.code || null
  };

  if (error?.payload?.error?.status) {
    formatted.remoteStatus = error.payload.error.status;
  }

  if (error?.payload?.error?.message) {
    formatted.remoteMessage = error.payload.error.message;
  }

  if (error?.details) {
    if (typeof error.details === 'string') {
      formatted.details = truncateForLog(error.details, 800);
    } else if (typeof error.details === 'object') {
      formatted.detailKeys = Object.keys(error.details);
    }
  }

  return formatted;
};

const truncateForLog = (value, maxLength = 500) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
};

const parseAllowedOrigins = () => {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  const entries = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return ['*', ...DEFAULT_ALLOWED_ORIGINS];
  }

  return Array.from(new Set([...entries, ...DEFAULT_ALLOWED_ORIGINS]));
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const resolveAllowedOrigin = (requestOrigin) => {
  if (!requestOrigin) {
    return ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS[0];
  }

  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  return ALLOWED_ORIGINS[0];
};

const ensureCors = (response, request) => {
  const origin = request?.headers?.get?.('origin');
  const allowedOrigin = resolveAllowedOrigin(origin);

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin || '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');

  const requestHeaders = request?.headers?.get?.('access-control-request-headers');
  const allowedHeaders = requestHeaders || 'Content-Type,X-Goog-Api-Key';
  response.headers.set('Access-Control-Allow-Headers', allowedHeaders);

  if (allowedOrigin !== '*') {
    response.headers.set('Vary', 'Origin');
  }

  return response;
};

const jsonResponse = (data, init, request) => ensureCors(NextResponse.json(data, init), request);

const PROMPT_EXEMPLO =
  'Ilustração minimalista 1080x1080 de uma banana geométrica centralizada, fundo azul-claro #A3D9FF, sombras suaves, sem pessoas, estilo clean de identidade visual.';

const collectCandidateContentParts = (payload) => {
  const parts = [];
  if (!payload || typeof payload !== 'object') {
    return parts;
  }

  const candidates = payload.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const candidateParts =
        candidate?.content?.parts ||
        candidate?.content?.data ||
        candidate?.content?.contents ||
        candidate?.parts ||
        candidate?.contents ||
        [];
      if (Array.isArray(candidateParts)) {
        parts.push(...candidateParts);
      } else if (candidateParts) {
        parts.push(candidateParts);
      }
    }
  }

  const contents = payload.contents;
  if (Array.isArray(contents)) {
    for (const content of contents) {
      const contentParts = content?.parts || content?.data || content?.contents || [];
      if (Array.isArray(contentParts)) {
        parts.push(...contentParts);
      } else if (contentParts) {
        parts.push(contentParts);
      }
    }
  }

  return parts;
};

const extractFileUri = (payload) => {
  if (!payload) return '';

  const contentParts = collectCandidateContentParts(payload);
  for (const part of contentParts) {
    const fileData =
      part?.fileData ||
      part?.file_data ||
      part?.media ||
      part?.mediaData ||
      part?.media_data ||
      part;
    const fileUri =
      fileData?.fileUri ||
      fileData?.file_uri ||
      fileData?.uri ||
      fileData?.source ||
      fileData?.downloadUri ||
      fileData?.download_uri ||
      fileData?.url;
    if (typeof fileUri === 'string' && fileUri.startsWith('https://')) {
      return fileUri;
    }
  }

  const fallbackUris = [
    payload?.candidates?.[0]?.content?.parts?.[0]?.fileData?.fileUri,
    payload?.candidates?.[0]?.content?.parts?.[0]?.file_data?.file_uri,
    payload?.files?.[0]?.uri,
    payload?.generatedImages?.[0]?.fileUri
  ];

  return fallbackUris.find((u) => typeof u === 'string' && u.startsWith('https://')) || '';
};

const extractBase64 = (payload) => {
  if (!payload) return '';

  const parts = collectCandidateContentParts(payload);
  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data;
    const inlineBase64 = inline?.data || inline?.base64 || inline?.b64 || inline?.imageBase64;
    if (typeof inlineBase64 === 'string' && inlineBase64.trim()) {
      return inlineBase64.trim();
    }

    const direct =
      part?.data ||
      part?.base64 ||
      part?.b64 ||
      part?.imageBase64 ||
      part?.image_base64 ||
      part?.base64Image ||
      part?.base64_image;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
  }

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

const callApi = async (url, payload, apiKey, context = {}) => {
  const { requestId, step } = context;
  logInfo(requestId, `Enviando requisição ${step || ''}`.trim(), {
    url,
    hasPayload: Boolean(payload),
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : []
  });

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
    logError(requestId, `Resposta não-ok da API em ${step || url}`, {
      status: response.status,
      statusText: response.statusText,
      body: data?.error || data,
      message
    });
    throw apiError;
  }

  logInfo(requestId, `Resposta bem-sucedida em ${step || url}`, {
    status: response.status,
    hasData: Boolean(data),
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
  });

  return data;
};

const callGeminiModel = async ({ prompt, negativePrompt, apiKey, requestId }) => {
  const url = new URL(GEMINI_IMAGE_ENDPOINT);
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

  const result = await callApi(url.toString(), payload, apiKey, {
    requestId,
    step: GEMINI_MODEL_NAME
  });
  return result;
};

const callLegacyImagenApi = async ({ prompt, negativePrompt, apiKey, requestId }) => {
  const url = new URL(LEGACY_GENERATE_ENDPOINT);
  url.searchParams.set('key', apiKey);

  const instance = {
    prompt: { text: prompt }
  };

  if (negativePrompt) {
    instance.negativePrompt = { text: negativePrompt };
    instance.negative_prompt = { text: negativePrompt };
  }

  const payload = {
    instances: [instance],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputMimeType: 'image/png',
      output_mime_type: 'image/png',
      safetyFilterLevel: 'block_some',
      safety_filter_level: 'block_some',
      personGeneration: 'block_all',
      person_generation: 'block_all'
    }
  };

  const result = await callApi(url.toString(), payload, apiKey, {
    requestId,
    step: IMAGEN_40_MODEL_NAME
  });
  return result;
};

const callLegacyFallbackImagenApi = async ({ prompt, negativePrompt, apiKey, requestId }) => {
  const url = new URL(LEGACY_FALLBACK_GENERATE_ENDPOINT);
  url.searchParams.set('key', apiKey);

  const instance = {
    prompt: { text: prompt }
  };

  if (negativePrompt) {
    instance.negativePrompt = { text: negativePrompt };
    instance.negative_prompt = { text: negativePrompt };
  }

  const payload = {
    instances: [instance],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputMimeType: 'image/png',
      output_mime_type: 'image/png',
      safetyFilterLevel: 'block_some',
      safety_filter_level: 'block_some',
      personGeneration: 'block_all',
      person_generation: 'block_all'
    }
  };

  const result = await callApi(url.toString(), payload, apiKey, {
    requestId,
    step: IMAGEN_40_ULTRA_MODEL_NAME
  });
  return result;
};

const arrayBufferToBase64 = (arrayBuffer) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(arrayBuffer).toString('base64');
  }

  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  return '';
};

const fetchFileUriAsBase64 = async (fileUri, apiKey) => {
  if (!fileUri || typeof fileUri !== 'string') {
    return '';
  }

  try {
    const headers = {};
    if (apiKey) {
      headers['X-Goog-Api-Key'] = apiKey;
    }

    const response = await fetch(fileUri, { headers });
    if (!response.ok) {
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
  } catch (error) {
    console.error('[Imagen] Falha ao baixar fileUri:', error);
    return '';
  }
};

const resolveBase64Image = async (payload, apiKey) => {
  const inlineBase64 = extractBase64(payload);
  if (inlineBase64) {
    return inlineBase64;
  }

  const fileUri = extractFileUri(payload);
  if (!fileUri) {
    return '';
  }

  const base64 = await fetchFileUriAsBase64(fileUri, apiKey);
  return base64;
};

const generateImage = async ({ prompt, negativePrompt, apiKey, requestId }) => {
  try {
    logInfo(requestId, `Iniciando tentativa com ${GEMINI_MODEL_NAME}.`);
    const gemini = await callGeminiModel({ prompt, negativePrompt, apiKey, requestId });

    const safetyDetail = detectSafetyBlock(gemini);
    if (safetyDetail) {
      const safetyError = new Error('Bloqueado por segurança');
      safetyError.status = 422;
      safetyError.details = safetyDetail;
      logWarn(requestId, `${GEMINI_MODEL_NAME} bloqueou por segurança.`, { detail: safetyDetail });
      throw safetyError;
    }

    const base64 = await resolveBase64Image(gemini, apiKey);
    if (base64) {
      logInfo(requestId, `${GEMINI_MODEL_NAME} retornou imagem com sucesso.`);
      return base64;
    }

    const noImageError = new Error(
      `O modelo ${GEMINI_MODEL_NAME} não retornou imagem. Exemplo de prompt funcional: ${PROMPT_EXEMPLO}`
    );
    noImageError.status = 502;
    noImageError.details = gemini;
    logWarn(requestId, `${GEMINI_MODEL_NAME} respondeu sem imagem.`, {
      dataKeys: gemini && typeof gemini === 'object' ? Object.keys(gemini) : []
    });
    throw noImageError;
  } catch (error) {
    const isFallbackCandidate =
      !error?.status || error.status >= 500 || error.status === 404 || error.status === 405;

    if (!isFallbackCandidate && error.status !== 422) {
      logError(requestId, `Falha irrecuperável em ${GEMINI_MODEL_NAME}.`, formatErrorForLog(error));
      throw error;
    }

    try {
      logWarn(
        requestId,
        `${GEMINI_MODEL_NAME} falhou (fallbackCandidate=${isFallbackCandidate}). Tentando ${IMAGEN_40_MODEL_NAME}.`,
        formatErrorForLog(error)
      );
      const legacy = await callLegacyImagenApi({ prompt, negativePrompt, apiKey, requestId });

      const safetyDetail = detectSafetyBlock(legacy);
      if (safetyDetail) {
        const safetyError = new Error('Bloqueado por segurança');
        safetyError.status = 422;
        safetyError.details = safetyDetail;
        logWarn(requestId, `${IMAGEN_40_MODEL_NAME} bloqueou por segurança.`, { detail: safetyDetail });
        throw safetyError;
      }

      const base64 = await resolveBase64Image(legacy, apiKey);
      if (base64) {
        logInfo(requestId, `${IMAGEN_40_MODEL_NAME} retornou imagem com sucesso.`);
        return base64;
      }

      const legacyError = new Error(
        `O modelo ${IMAGEN_40_MODEL_NAME} não retornou imagem. Exemplo de prompt funcional: ${PROMPT_EXEMPLO}`
      );
      legacyError.status = 502;
      legacyError.details = legacy;
      logWarn(requestId, `${IMAGEN_40_MODEL_NAME} respondeu sem imagem.`, {
        dataKeys: legacy && typeof legacy === 'object' ? Object.keys(legacy) : []
      });
      throw legacyError;
    } catch (fallbackError) {
      if (!isFallbackCandidate && fallbackError?.status && fallbackError.status < 500 && fallbackError.status !== 422) {
        logError(requestId, `Falha irrecuperável em ${IMAGEN_40_MODEL_NAME}.`, formatErrorForLog(fallbackError));
        throw fallbackError;
      }

      fallbackError.cause = error;

      try {
        logWarn(
          requestId,
          `${IMAGEN_40_MODEL_NAME} falhou (fallbackCandidate=${isFallbackCandidate}). Tentando ${IMAGEN_40_ULTRA_MODEL_NAME}.`,
          formatErrorForLog(fallbackError)
        );
        const legacyFallback = await callLegacyFallbackImagenApi({
          prompt,
          negativePrompt,
          apiKey,
          requestId
        });

        const safetyDetail = detectSafetyBlock(legacyFallback);
        if (safetyDetail) {
          const safetyError = new Error('Bloqueado por segurança');
          safetyError.status = 422;
          safetyError.details = safetyDetail;
          logWarn(requestId, `${IMAGEN_40_ULTRA_MODEL_NAME} bloqueou por segurança.`, { detail: safetyDetail });
          throw safetyError;
        }

        const base64 = await resolveBase64Image(legacyFallback, apiKey);
        if (base64) {
          logInfo(requestId, `${IMAGEN_40_ULTRA_MODEL_NAME} retornou imagem com sucesso.`);
          return base64;
        }

        const legacyError = new Error(
          `O modelo ${IMAGEN_40_ULTRA_MODEL_NAME} não retornou imagem. Exemplo de prompt funcional: ${PROMPT_EXEMPLO}`
        );
        legacyError.status = 502;
        legacyError.details = legacyFallback;
        legacyError.cause = fallbackError;
        logWarn(requestId, `${IMAGEN_40_ULTRA_MODEL_NAME} respondeu sem imagem.`, {
          dataKeys: legacyFallback && typeof legacyFallback === 'object' ? Object.keys(legacyFallback) : []
        });
        throw legacyError;
      } catch (legacyError) {
        logError(requestId, `${IMAGEN_40_ULTRA_MODEL_NAME} também falhou.`, {
          primary: formatErrorForLog(legacyError),
          secondary: formatErrorForLog(fallbackError)
        });
        legacyError.cause = legacyError.cause ?? fallbackError;
        throw legacyError;
      }
    }
  }
};

export async function OPTIONS(request) {
  return ensureCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request) {
  const requestId = makeRequestId();
  const origin = request?.headers?.get?.('origin') || null;
  logInfo(requestId, 'Requisição recebida para geração de imagem.', { origin });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    logError(requestId, 'Falha ao interpretar JSON da requisição.', formatErrorForLog(error));
    return jsonResponse({ error: 'Corpo da requisição inválido.' }, { status: 400 }, request);
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const negativePrompt = typeof body?.negativePrompt === 'string' ? body.negativePrompt.trim() : '';
  const providedKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey = providedKey || (process.env.GOOGLE_API_KEY || '').trim();

  if (!apiKey) {
    logWarn(requestId, 'Requisição sem API key.');
    return jsonResponse({ error: 'A API Key é obrigatória.' }, { status: 401 }, request);
  }

  if (!prompt) {
    logWarn(requestId, 'Prompt ausente na requisição.');
    return jsonResponse({ error: 'O prompt é obrigatório.', exemplo: PROMPT_EXEMPLO }, { status: 400 }, request);
  }

  logInfo(requestId, 'Prompt recebido.', {
    prompt: truncateForLog(prompt),
    negativePrompt: negativePrompt ? truncateForLog(negativePrompt) : undefined,
    negativePromptLength: negativePrompt.length
  });

  try {
    const image = await generateImage({ prompt, negativePrompt, apiKey, requestId });
    logInfo(requestId, 'Imagem gerada com sucesso.');
    return jsonResponse({ image }, undefined, request);
  } catch (error) {
    const formattedError = formatErrorForLog(error);
    logError(requestId, 'Falha ao gerar imagem.', formattedError);

    if (error?.status === 422 && error.message.includes('Bloqueado')) {
      return jsonResponse({ error: 'Bloqueado por segurança', detalhes: error.details || null }, { status: 422 }, request);
    }

    if (isQuotaError(error)) {
      return jsonResponse({ error: 'Quota excedida', detalhes: error.message }, { status: error.status || 429 }, request);
    }

    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const message = error?.message || 'Falha ao gerar imagem.';
    return jsonResponse({ error: message, exemplo: PROMPT_EXEMPLO }, { status }, request);
  }
}
