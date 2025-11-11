export const config = {
  runtime: 'edge'
};

const GEMINI_IMAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
const LEGACY_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration:generate';
const LEGACY_FALLBACK_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@002:generate';

const IMAGEN_CONFIG = {
  aspectRatio: '4:5',
  numberOfImages: 1,
  safetyFilterLevel: 'block_some',
  personGeneration: 'allow_adult'
};
const QUOTA_ERROR_MESSAGE =
  'Limite de uso da Google AI API excedido. Revise seu plano de faturamento ou aguarde antes de tentar novamente.';

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Goog-Api-Key'
};

const extractBase64Image = (payload) => {
  if (!payload) return '';

  const inlinePart = payload?.candidates?.[0]?.content?.parts?.find((part) => {
    const base64 = part?.inlineData?.data;
    return typeof base64 === 'string' && base64.length > 0;
  });

  if (inlinePart?.inlineData?.data) {
    return inlinePart.inlineData.data;
  }

  const inlineCandidate = payload?.candidates?.[0]?.inlineData?.data;
  if (typeof inlineCandidate === 'string' && inlineCandidate.length > 0) {
    return inlineCandidate;
  }

  const candidates = [
    payload?.predictions?.[0]?.bytesBase64Encoded,
    payload?.predictions?.[0]?.base64Image,
    payload?.images?.[0]?.base64,
    payload?.images?.[0]?.content,
    payload?.images?.[0]?.content?.base64,
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

const isNetworkError = (error) => {
  if (!error) return false;
  if (error.name === 'TypeError' && /fetch/i.test(error.message || '')) return true;
  return /network/i.test(error.message || '');
};

const shouldRetryWithFallbackModel = (error) => {
  if (!error) return false;
  if (isNetworkError(error)) return true;

  if (error.status === 404 || error.status === 405) return true;
  if (error.status >= 500) return true;

  const message = (error.payload?.error?.message || error.message || '').toLowerCase();
  return (
    message.includes('legacy') ||
    message.includes('predict') ||
    message.includes('deprecated') ||
    message.includes('not found') ||
    message.includes('imagen-3.0') ||
    message.includes('gemini-2.5') ||
    message.includes('flash-image')
  );
};

const getModelAvailabilityHelp = (error) => {
  if (!error) return null;

  const rawMessage = error.payload?.error?.message || error.message || '';
  const message = rawMessage.toLowerCase();

  if (!message) return null;

  const genericHelp =
    'Sua chave da Google AI não tem acesso ao modelo solicitado. Acesse o Google AI Studio, habilite o Image Generation para o projeto da chave ou gere uma nova chave com esse acesso.';

  if (message.includes('gemini-2.5') || message.includes('flash-image')) {
    return `${genericHelp} Garanta que o modelo "gemini-2.5-flash-image" esteja habilitado no projeto da chave.`;
  }

  if (message.includes('imagen-3.0')) {
    return `${genericHelp} Garanta que o modelo "imagen-3.0-generate-001" esteja disponível para uso.`;
  }

  if (message.includes('imagegeneration@002') || message.includes('imagegeneration')) {
    return `${genericHelp} Habilite o modelo legacy "imagegeneration@002" como alternativa.`;
  }

  if (message.includes('not found') || message.includes('unsupported') || message.includes('does not exist')) {
    return genericHelp;
  }

  return null;
};

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

const createApiError = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  const message = payload?.error?.message || 'Falha ao gerar imagem com a Imagen API.';
  const apiError = new Error(message);
  apiError.status = response.status;
  apiError.payload = payload;
  const retryAfterSeconds = extractRetryAfterSeconds(response, payload, message);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    apiError.retryAfterSeconds = retryAfterSeconds;
  }
  return apiError;
};

const callGeminiImageModel = async ({ prompt, negativePrompt, apiKey }) => {
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
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.json();
};

const callLegacyImagenApi = async ({ endpoint, prompt, negativePrompt, apiKey }) => {
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
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.json();
};

const buildErrorResponse = (status, message, { details, retryAfterSeconds } = {}) => {
  const payload = {
    error: {
      message
    }
  };

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    payload.error.retryAfterSeconds = retryAfterSeconds;
  }

  if (details !== undefined) {
    payload.error.details = details;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...baseHeaders
  };

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    headers['Retry-After'] = Math.max(1, Math.ceil(retryAfterSeconds)).toString();
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
};

const respondWithError = (error, fallbackDetails) => {
  const helpMessage = getModelAvailabilityHelp(error);
  const isQuotaError = isQuotaExceededError(error);
  const retryAfterSeconds = resolveRetryAfterSeconds(error);
  const message = isQuotaError
    ? QUOTA_ERROR_MESSAGE
    : helpMessage || error.message || 'Falha ao gerar imagem com a Imagen API.';

  const details = fallbackDetails ?? error.payload;

  return buildErrorResponse(error.status || 500, message, {
    details,
    retryAfterSeconds
  });
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: baseHeaders
    });
  }

  if (request.method !== 'POST') {
    return buildErrorResponse(405, 'Método não permitido. Utilize POST.');
  }

  let body = null;

  try {
    body = await request.json();
  } catch (error) {
    return buildErrorResponse(400, 'Corpo da requisição inválido.');
  }

  const { prompt, negativePrompt, apiKey } = body || {};

  if (!apiKey) {
    return buildErrorResponse(400, 'Configure a Google AI API Key antes de gerar imagens.');
  }

  if (!prompt || typeof prompt !== 'string') {
    return buildErrorResponse(400, 'O prompt para geração de imagem é obrigatório.');
  }

  try {
    const primaryResult = await callGeminiImageModel({ prompt, negativePrompt, apiKey });

    const base64Image = extractBase64Image(primaryResult);

    if (!base64Image) {
      throw new Error('A resposta da Imagen API não contém imagem válida.');
    }

    return new Response(JSON.stringify({ image: base64Image }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...baseHeaders
      }
    });
  } catch (primaryError) {
    if (!shouldRetryWithFallbackModel(primaryError)) {
      return respondWithError(primaryError);
    }

    try {
      const legacyResult = await callLegacyImagenApi({
        endpoint: LEGACY_GENERATE_ENDPOINT,
        prompt,
        negativePrompt,
        apiKey
      });

      const base64Image = extractBase64Image(legacyResult);

      if (!base64Image) {
        throw new Error('A resposta da Imagen API não contém imagem válida.');
      }

      return new Response(JSON.stringify({ image: base64Image }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...baseHeaders
        }
      });
    } catch (legacyError) {
      if (!shouldRetryWithFallbackModel(legacyError)) {
        legacyError.cause = primaryError || legacyError.cause;
        return respondWithError(legacyError, legacyError.payload || primaryError.payload);
      }

      try {
        const fallbackResult = await callLegacyImagenApi({
          endpoint: LEGACY_FALLBACK_GENERATE_ENDPOINT,
          prompt,
          negativePrompt,
          apiKey
        });

        const base64Image = extractBase64Image(fallbackResult);

        if (!base64Image) {
          throw new Error('A resposta da Imagen API não contém imagem válida.');
        }

        return new Response(JSON.stringify({ image: base64Image }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...baseHeaders
          }
        });
      } catch (fallbackError) {
        fallbackError.cause = primaryError || legacyError;
        const helpMessage = getModelAvailabilityHelp(fallbackError) || getModelAvailabilityHelp(legacyError) || getModelAvailabilityHelp(primaryError);

        const details = fallbackError.payload || legacyError.payload || primaryError.payload;
        return respondWithError(fallbackError, details);
      }
    }
  }
}
