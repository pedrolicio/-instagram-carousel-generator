import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';
import {
  IMAGEN_DEFAULT_ASPECT_RATIO,
  IMAGEN_DEFAULT_PERSON_GENERATION,
  IMAGEN_DEFAULT_SAMPLE_COUNT,
  IMAGEN_DEFAULT_SAFETY_FILTER_LEVEL
} from '../config/imagenDefaults.js';

const IMAGEN_PROXY_ENDPOINT = '/api/imagen';
const IMAGEN_DEFAULT_MODEL = 'imagen-4.0-generate-001';
const IMAGEN_DEFAULT_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_DEFAULT_MODEL}:predict`;
const IMAGEN_ULTRA_MODEL = 'imagen-4.0-ultra-generate-001';
const IMAGEN_ULTRA_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_ULTRA_MODEL}:predict`;
const GEMINI_IMAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const LEGACY_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration:generate';
const LEGACY_FALLBACK_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@002:generate';

const IMAGEN_CONFIG = {
  aspectRatio: IMAGEN_DEFAULT_ASPECT_RATIO,
  numberOfImages: IMAGEN_DEFAULT_SAMPLE_COUNT,
  safetyFilterLevel: IMAGEN_DEFAULT_SAFETY_FILTER_LEVEL,
  personGeneration: IMAGEN_DEFAULT_PERSON_GENERATION
};
const MISSING_IMAGE_ERROR_PATTERNS = [
  'não contém uma imagem válida',
  'não contém imagem válida',
  'não retornou imagem',
  'missing image',
  'missing an image_id',
  'missing image_id',
  'invalid image'
];
const NETWORK_ERROR_MESSAGE =
  'Não foi possível se conectar à Imagen API. Verifique sua conexão com a internet, a chave de API e tente novamente.';
const QUOTA_ERROR_MESSAGE =
  'Limite de uso da Google AI API excedido. Revise seu plano de faturamento ou aguarde antes de tentar novamente.';

const getRetryAfterSecondsFromDetails = (details) => {
  if (!Array.isArray(details)) return null;

  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;

    const type = detail['@type'] || detail.type;
    if (!type || typeof type !== 'string') continue;

    if (!type.toLowerCase().includes('retryinfo')) continue;

    const retryDelay = detail.retryDelay || detail.retry_delay;
    if (!retryDelay || typeof retryDelay !== 'object') continue;

    const seconds = Number(retryDelay.seconds || retryDelay.Seconds || 0);
    const nanos = Number(retryDelay.nanos || retryDelay.Nanos || 0);

    const total = seconds + nanos / 1_000_000_000;
    if (Number.isFinite(total) && total > 0) {
      return total;
    }
  }

  return null;
};

const parseRetryAfterHeader = (response) => {
  if (!response?.headers) return null;

  const header = response.headers.get?.('retry-after');
  if (!header) return null;

  const numericValue = Number.parseFloat(header);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  const retryDate = new Date(header);
  if (!Number.isNaN(retryDate.getTime())) {
    const diffSeconds = (retryDate.getTime() - Date.now()) / 1000;
    if (Number.isFinite(diffSeconds) && diffSeconds > 0) {
      return diffSeconds;
    }
  }

  return null;
};

const normalizeRetryAfterSeconds = (value) => {
  if (value == null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  if (typeof value === 'object') {
    const seconds = Number(value.seconds ?? value.Seconds ?? value.retryAfterSeconds ?? value.retry_after_seconds ?? 0);
    const nanos = Number(value.nanos ?? value.Nanos ?? 0);
    const total = seconds + nanos / 1_000_000_000;
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  return null;
};

const extractRetryAfterSeconds = (response, payload, message) => {
  const headerRetry = parseRetryAfterHeader(response);
  if (headerRetry) return headerRetry;

  const directRetryCandidates = [
    payload?.error?.retryAfterSeconds,
    payload?.error?.retry_after_seconds,
    payload?.error?.retryAfter,
    payload?.error?.retry_after,
    payload?.retryAfterSeconds,
    payload?.retry_after_seconds
  ];

  for (const candidate of directRetryCandidates) {
    const normalized = normalizeRetryAfterSeconds(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const detailsRetry = getRetryAfterSecondsFromDetails(payload?.error?.details || payload?.details);
  if (detailsRetry) return detailsRetry;

  const sourceMessage = message || payload?.error?.message || payload?.message || '';
  if (typeof sourceMessage === 'string' && sourceMessage) {
    const match = sourceMessage.match(/retry in\s+(\d+(?:\.\d+)?)/i);
    if (match) {
      const seconds = Number.parseFloat(match[1]);
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds;
      }
    }
  }

  return null;
};

const resolveRetryAfterSeconds = (error) => {
  const visited = new Set();
  let current = error;

  while (current && !visited.has(current)) {
    visited.add(current);

    if (Number.isFinite(current?.retryAfterSeconds) && current.retryAfterSeconds > 0) {
      return current.retryAfterSeconds;
    }

    current = current.cause;
  }

  return null;
};

const formatRetryAfterMessage = (retryAfterSeconds) => {
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return '';
  }

  const roundedSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  const unit = roundedSeconds === 1 ? 'segundo' : 'segundos';
  return ` Aguarde aproximadamente ${roundedSeconds} ${unit} e tente novamente.`;
};

const createApiError = async (response) => {
  const errorPayload = await response.json().catch(() => ({}));
  const message =
    errorPayload?.error?.message || 'Falha ao gerar imagem com a Imagen API através do proxy.';
  const error = new Error(message);
  error.status = response.status;
  error.payload = errorPayload;
  const retryAfterSeconds = extractRetryAfterSeconds(null, errorPayload, message);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  return error;
};

const callImagenProxy = async ({ prompt, negativePrompt, apiKey, signal }) => {
  const response = await fetch(IMAGEN_PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, negativePrompt, apiKey }),
    signal
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  const payload = await response.json().catch(() => null);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inesperada do proxy de geração de imagens.');
  }

  if (payload.error) {
    const proxyError = new Error(payload.error?.message || 'Falha ao gerar imagem com a Imagen API.');
    proxyError.payload = payload.error || payload;
    if (Number.isFinite(payload.error?.retryAfterSeconds) && payload.error.retryAfterSeconds > 0) {
      proxyError.retryAfterSeconds = payload.error.retryAfterSeconds;
    }
    throw proxyError;
  }

  const { image } = payload;
  if (!image || typeof image !== 'string') {
    const invalidImageError = new Error('A resposta do proxy não contém uma imagem válida.');
    invalidImageError.payload = payload;
    throw invalidImageError;
  }

  return image;
};

const appendRemoteMessage = (baseMessage, payload) => {
  const rawMessage =
    payload?.error?.message ||
    payload?.error?.details?.[0]?.message ||
    payload?.message ||
    '';

  if (!rawMessage || typeof rawMessage !== 'string') {
    return baseMessage;
  }

  if (baseMessage && baseMessage.includes(rawMessage)) {
    return baseMessage;
  }

  const sanitized = rawMessage.trim();
  if (!sanitized) {
    return baseMessage;
  }

  const truncated = sanitized.length > 600 ? `${sanitized.slice(0, 600)}…` : sanitized;

  const separator = baseMessage?.trim()?.endsWith('.') ? '' : '.';
  return `${baseMessage || 'Falha ao gerar imagem com a Imagen API.'}${separator} Detalhes: ${truncated}`;
};

const createImagenApiError = (message, status, payload, retryAfterSeconds) => {
  const enrichedMessage = appendRemoteMessage(message, payload);
  const error = new Error(enrichedMessage || 'Falha ao gerar imagem com a Imagen API.');
  if (status) error.status = status;
  if (payload) error.payload = payload;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  return error;
};

const normalizeErrorMessage = (message) => (typeof message === 'string' ? message.toLowerCase() : '');

const hasMissingImageMessage = (message) => {
  const normalized = normalizeErrorMessage(message);
  if (!normalized) return false;

  return MISSING_IMAGE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const isMissingImageError = (error) => {
  if (!error) return false;

  if (hasMissingImageMessage(error.message)) {
    return true;
  }

  const payloadError = error.payload?.error || error.payload;
  if (hasMissingImageMessage(payloadError?.message)) {
    return true;
  }

  return false;
};

const callImagenDefaultModel = async ({ prompt, negativePrompt, apiKey, signal }) => {
  const payload = buildImagenPredictPayload({ prompt, negativePrompt });

  const requestUrl = new URL(IMAGEN_DEFAULT_ENDPOINT);
  requestUrl.searchParams.set('key', apiKey);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (error) {
      errorPayload = null;
    }

    const message =
      errorPayload?.error?.message || errorPayload?.message || 'Falha ao gerar imagem com o modelo Imagen 4.0.';
    const retryAfterSeconds = extractRetryAfterSeconds(response, errorPayload, message);
    throw createImagenApiError(message, response.status, errorPayload, retryAfterSeconds);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('O modelo Imagen 4.0 não retornou uma imagem válida.', response.status, result);
  }

  return base64Image;
};

const callImagenUltraModel = async ({ prompt, negativePrompt, apiKey, signal }) => {
  const payload = buildImagenPredictPayload({
    prompt,
    negativePrompt,
    parameters: {
      sampleCount: 1,
      aspectRatio: IMAGEN_CONFIG.aspectRatio,
      outputMimeType: 'image/png',
      safetyFilterLevel: IMAGEN_CONFIG.safetyFilterLevel,
      personGeneration: IMAGEN_CONFIG.personGeneration
    }
  });

  const requestUrl = new URL(IMAGEN_ULTRA_ENDPOINT);
  requestUrl.searchParams.set('key', apiKey);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (error) {
      errorPayload = null;
    }

    const message =
      errorPayload?.error?.message || errorPayload?.message || 'Falha ao gerar imagem com o modelo Imagen 4.0 Ultra.';
    const retryAfterSeconds = extractRetryAfterSeconds(response, errorPayload, message);
    throw createImagenApiError(message, response.status, errorPayload, retryAfterSeconds);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('O modelo Imagen 4.0 Ultra não retornou uma imagem válida.', response.status, result);
  }

  return base64Image;
};

const callGeminiFlashImageModel = async ({ prompt, negativePrompt, apiKey, signal }) => {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildGeminiPromptText(prompt, negativePrompt) }]
      }
    ]
  };

  const requestUrl = new URL(GEMINI_IMAGE_ENDPOINT);
  requestUrl.searchParams.set('key', apiKey);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (error) {
      errorPayload = null;
    }

    const message = errorPayload?.error?.message || errorPayload?.message || 'Falha ao gerar imagem com a Imagen API.';
    const retryAfterSeconds = extractRetryAfterSeconds(response, errorPayload, message);
    throw createImagenApiError(message, response.status, errorPayload, retryAfterSeconds);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('A resposta da Imagen API não contém imagem válida.', response.status, result);
  }

  return base64Image;
};

const extractInlineDataBase64 = (part) => {
  if (!part || typeof part !== 'object') {
    return '';
  }

  const inlineData =
    (typeof part.inlineData === 'object' && part.inlineData) ||
    (typeof part.inline_data === 'object' && part.inline_data);

  if (!inlineData || typeof inlineData !== 'object') {
    return '';
  }

  const base64Candidates = [
    inlineData.data,
    inlineData.base64,
    inlineData.base64Data,
    inlineData.base64_data
  ];

  return base64Candidates.find((value) => typeof value === 'string' && value.length > 0) || '';
};

const extractBase64Image = (payload) => {
  if (!payload) return '';

  const candidate = payload?.candidates?.[0];

  const contentParts = [];

  if (Array.isArray(candidate?.content)) {
    for (const content of candidate.content) {
      if (Array.isArray(content?.parts)) {
        contentParts.push(...content.parts);
      }
    }
  } else if (Array.isArray(candidate?.content?.parts)) {
    contentParts.push(...candidate.content.parts);
  }

  const inlinePart = contentParts.find((part) => extractInlineDataBase64(part));

  if (inlinePart) {
    const base64 = extractInlineDataBase64(inlinePart);
    if (base64) {
      return base64;
    }
  }

  const inlineCandidate = extractInlineDataBase64(candidate);
  if (inlineCandidate) {
    return inlineCandidate;
  }

  const candidates = [
    payload?.predictions?.[0]?.bytesBase64Encoded,
    payload?.predictions?.[0]?.base64Image,
    payload?.images?.[0]?.base64,
    payload?.images?.[0]?.content,
    payload?.images?.[0]?.content?.base64,
    payload?.images?.[0]?.parts?.[0]?.inlineData?.data,
    payload?.images?.[0]?.parts?.[0]?.inline_data?.data,
    payload?.artifacts?.[0]?.base64,
    payload?.data?.[0]?.b64_json,
    payload?.generatedImages?.[0]?.bytesBase64Encoded
  ];

  return candidates.find((candidate) => typeof candidate === 'string' && candidate.length > 0) || '';
};

const buildGeminiPromptText = (prompt, negativePrompt) => {
  if (!negativePrompt) return prompt;

  return `${prompt}\n\nRestrições: ${negativePrompt}`;
};

const buildImagenPredictPayload = ({ prompt, negativePrompt, parameters: parameterOverrides }) => {
  const instance = { prompt };

  if (negativePrompt) {
    instance.negativePrompt = negativePrompt;
    instance.negative_prompt = negativePrompt;
  }

  const parameters = {
    sampleCount: IMAGEN_CONFIG.numberOfImages,
    aspectRatio: IMAGEN_CONFIG.aspectRatio,
    outputMimeType: 'image/png',
    safetyFilterLevel: IMAGEN_CONFIG.safetyFilterLevel,
    personGeneration: IMAGEN_CONFIG.personGeneration,
    ...(parameterOverrides || {})
  };

  const compatibilityParameters = {};

  if (parameters.sampleCount != null) {
    compatibilityParameters.sample_count = parameters.sampleCount;
  }

  if (parameters.aspectRatio) {
    compatibilityParameters.aspect_ratio = parameters.aspectRatio;
  }

  if (parameters.outputMimeType) {
    compatibilityParameters.output_mime_type = parameters.outputMimeType;
  }

  if (parameters.safetyFilterLevel) {
    compatibilityParameters.safety_filter_level = parameters.safetyFilterLevel;
  }

  if (parameters.personGeneration) {
    compatibilityParameters.person_generation = parameters.personGeneration;
  }

  return {
    instances: [instance],
    parameters: {
      ...parameters,
      ...compatibilityParameters
    }
  };
};

const shouldRetryWithFallbackModel = (error) => {
  if (!error) return false;
  if (error.status === 404 || error.status === 405) return true;
  if (error.status && error.status >= 500) return true;

  const message = (error.payload?.error?.message || error.message || '').toLowerCase();

  if (isMissingImageError(error)) {
    return true;
  }

  return (
    message.includes('legacy') ||
    message.includes('predict') ||
    message.includes('deprecated') ||
    message.includes('not found') ||
    message.includes('imagen-4.0') ||
    message.includes('imagen-3.0') ||
    message.includes('generate-001') ||
    message.includes('fast-generate') ||
    message.includes('gemini-2.5') ||
    message.includes('flash-image')
  );
};

const callLegacyImagenEndpoint = async ({ endpoint, prompt, negativePrompt, apiKey, signal }) => {
  const payload = {
    prompt: { text: prompt },
    imageGenerationConfig: {
      numberOfImages: IMAGEN_CONFIG.numberOfImages,
      aspectRatio: IMAGEN_CONFIG.aspectRatio,
      outputMimeType: 'image/png',
      safetyFilterLevel: IMAGEN_CONFIG.safetyFilterLevel,
      personGeneration: IMAGEN_CONFIG.personGeneration
    }
  };

  if (negativePrompt) {
    payload.negativePrompt = { text: negativePrompt };
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set('key', apiKey);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (error) {
      errorPayload = null;
    }

    const message = errorPayload?.error?.message || 'Falha ao gerar imagem com a Imagen API.';
    const retryAfterSeconds = extractRetryAfterSeconds(response, errorPayload, message);
    throw createImagenApiError(message, response.status, errorPayload, retryAfterSeconds);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('A resposta da Imagen API não contém imagem válida.', response.status, result);
  }

  return base64Image;
};

const callImagenApiDirectly = async ({ prompt, negativePrompt, apiKey, signal }) => {
  let primaryError = null;
  let ultraError = null;

  try {
    return await callImagenDefaultModel({ prompt, negativePrompt, apiKey, signal });
  } catch (error) {
    primaryError = error;
    if (!shouldRetryWithFallbackModel(error)) {
      throw error;
    }
  }

  try {
    return await callImagenUltraModel({ prompt, negativePrompt, apiKey, signal });
  } catch (error) {
    ultraError = error;
    if (!shouldRetryWithFallbackModel(error)) {
      error.cause = primaryError || error.cause;
      throw error;
    }
  }

  try {
    return await callGeminiFlashImageModel({ prompt, negativePrompt, apiKey, signal });
  } catch (legacyError) {
    if (!shouldRetryWithFallbackModel(legacyError)) {
      legacyError.cause = ultraError || primaryError || legacyError.cause;
      throw legacyError;
    }

    try {
      return await callLegacyImagenEndpoint({
        endpoint: LEGACY_GENERATE_ENDPOINT,
        prompt,
        negativePrompt,
        apiKey,
        signal
      });
    } catch (fallbackError) {
      if (!shouldRetryWithFallbackModel(fallbackError)) {
        fallbackError.cause = ultraError || primaryError || legacyError;
        throw fallbackError;
      }

      try {
        return await callLegacyImagenEndpoint({
          endpoint: LEGACY_FALLBACK_GENERATE_ENDPOINT,
          prompt,
          negativePrompt,
          apiKey,
          signal
        });
      } catch (finalError) {
        finalError.cause = ultraError || primaryError || fallbackError;
        throw finalError;
      }
    }
  }
};

const shouldBypassProxy = (error) => {
  if (!error) return false;

  const status = error.status;
  if (status === 404 || status === 405 || status === 501) return true;

  const message = (error.message || '').toLowerCase();
  return message.includes('not found') || message.includes('edge function');
};

const isQuotaExceededError = (error) => {
  if (!error) return false;

  if (error.status === 429) return true;

  const payloadError = error.payload?.error || error.payload;
  const payloadStatus = payloadError?.status;
  const payloadCode = payloadError?.code;

  if (payloadCode === 429 || payloadStatus === 429 || payloadStatus === 'RESOURCE_EXHAUSTED') {
    return true;
  }

  const message = (payloadError?.message || error.message || '').toLowerCase();

  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('exceeded your current quota') ||
    message.includes('resource exhausted')
  );
};

const createQuotaExceededError = (error) => {
  const retryAfterSeconds = resolveRetryAfterSeconds(error);
  const retryMessage = formatRetryAfterMessage(retryAfterSeconds);
  const quotaError = new Error(`${QUOTA_ERROR_MESSAGE}${retryMessage}`);
  quotaError.cause = error;
  quotaError.status = error?.status || 429;
  quotaError.payload = error?.payload;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    quotaError.retryAfterSeconds = retryAfterSeconds;
  }
  return quotaError;
};

export async function generateSlideImage({ prompt, negativePrompt, apiKey, signal }) {
  if (!apiKey) throw new Error('Configure a Google AI API Key antes de gerar imagens.');

  const resolvedNegativePrompt = negativePrompt || buildNegativePrompt();

  try {
    return await callImagenProxy({
      prompt,
      negativePrompt: resolvedNegativePrompt,
      apiKey,
      signal
    });
  } catch (error) {
    if (shouldBypassProxy(error)) {
      try {
        return await callImagenApiDirectly({
          prompt,
          negativePrompt: resolvedNegativePrompt,
          apiKey,
          signal
        });
      } catch (directError) {
        if (isQuotaExceededError(directError)) {
          throw createQuotaExceededError(directError);
        }
        throw directError;
      }
    }

    if (isQuotaExceededError(error)) {
      throw createQuotaExceededError(error);
    }

    if (error?.name === 'TypeError' || /network/i.test(error?.message || '')) {
      const enhancedError = new Error(NETWORK_ERROR_MESSAGE);
      enhancedError.cause = error;
      throw enhancedError;
    }

    throw error;
  }
}

// --- Geração de múltiplas imagens (ex.: carrossel) ---

export async function generateCarouselImages({ slides, brandKit, apiKey, onProgress, signal }) {
  const results = [];

  for (const slide of slides) {
    if (signal?.aborted) throw new Error('Geração de imagens cancelada.');

    const prompt = buildImagenPrompt(slide, brandKit);
    const image = await generateSlideImage({
      prompt,
      negativePrompt: buildNegativePrompt(),
      apiKey,
      signal
    });

    results.push({
      slideNumber: slide.slideNumber,
      imageUrl: image,
      status: 'generated'
    });

    onProgress?.(results.length / slides.length);
  }

  return results;
}
