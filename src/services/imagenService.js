import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

const IMAGEN_PROXY_ENDPOINT = '/api/imagen';
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
const NETWORK_ERROR_MESSAGE =
  'Não foi possível se conectar à Imagen API. Verifique sua conexão com a internet, a chave de API e tente novamente.';
const QUOTA_ERROR_MESSAGE =
  'Limite de uso da Google AI API excedido. Revise seu plano de faturamento ou aguarde antes de tentar novamente.';

const createApiError = async (response) => {
  const errorPayload = await response.json().catch(() => ({}));
  const message =
    errorPayload?.error?.message || 'Falha ao gerar imagem com a Imagen API através do proxy.';
  const error = new Error(message);
  error.status = response.status;
  error.payload = errorPayload;
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
    proxyError.payload = payload.error?.details;
    throw proxyError;
  }

  const { image } = payload;
  if (!image || typeof image !== 'string') {
    throw new Error('A resposta do proxy não contém uma imagem válida.');
  }

  return image;
};

const createImagenApiError = (message, status, payload) => {
  const error = new Error(message || 'Falha ao gerar imagem com a Imagen API.');
  if (status) error.status = status;
  if (payload) error.payload = payload;
  return error;
};

const callGeminiImageModel = async ({ prompt, negativePrompt, apiKey, signal }) => {
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

    const message =
      errorPayload?.error?.message || errorPayload?.message || 'Falha ao gerar imagem com a Imagen API.';
    throw createImagenApiError(message, response.status, errorPayload);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('A resposta da Imagen API não contém imagem válida.');
  }

  return base64Image;
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

const shouldRetryWithFallbackModel = (error) => {
  if (!error) return false;
  if (error.status === 404 || error.status === 405) return true;
  if (error.status && error.status >= 500) return true;

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
    throw createImagenApiError(message, response.status, errorPayload);
  }

  const result = await response.json();
  const base64Image = extractBase64Image(result);

  if (!base64Image) {
    throw createImagenApiError('A resposta da Imagen API não contém imagem válida.');
  }

  return base64Image;
};

const callImagenApiDirectly = async ({ prompt, negativePrompt, apiKey, signal }) => {
  let primaryError = null;

  try {
    return await callGeminiImageModel({ prompt, negativePrompt, apiKey, signal });
  } catch (error) {
    primaryError = error;
    if (!shouldRetryWithFallbackModel(error)) {
      throw error;
    }
  }

  try {
    return await callLegacyImagenEndpoint({
      endpoint: LEGACY_GENERATE_ENDPOINT,
      prompt,
      negativePrompt,
      apiKey,
      signal
    });
  } catch (legacyError) {
    if (!shouldRetryWithFallbackModel(legacyError)) {
      legacyError.cause = primaryError || legacyError.cause;
      throw legacyError;
    }

    try {
      return await callLegacyImagenEndpoint({
        endpoint: LEGACY_FALLBACK_GENERATE_ENDPOINT,
        prompt,
        negativePrompt,
        apiKey,
        signal
      });
    } catch (fallbackError) {
      fallbackError.cause = primaryError || legacyError;
      throw fallbackError;
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

const parseRetryDelayFromDetails = (details) => {
  if (!Array.isArray(details)) return null;

  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;

    const retryDelay = detail.retryDelay || detail?.metadata?.retryDelay;
    if (!retryDelay) continue;

    const seconds = Number(retryDelay.seconds ?? retryDelay?.seconds);
    const nanos = Number(retryDelay.nanos ?? retryDelay?.nanos);

    if (Number.isFinite(seconds) || Number.isFinite(nanos)) {
      const totalSeconds = (Number.isFinite(seconds) ? seconds : 0) + (Number.isFinite(nanos) ? nanos / 1e9 : 0);
      if (totalSeconds > 0) {
        return totalSeconds;
      }
    }

    if (typeof retryDelay === 'string') {
      const numeric = Number(retryDelay.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }
  }

  return null;
};

const parseRetryDelayFromMessage = (message) => {
  if (typeof message !== 'string') return null;

  const match = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match) return null;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

const getRetryDelayInSeconds = (error) => {
  const payloadError = error?.payload?.error || error?.payload;

  const detailsDelay = parseRetryDelayFromDetails(payloadError?.details);
  if (detailsDelay) return detailsDelay;

  const messageDelay = parseRetryDelayFromMessage(payloadError?.message || error?.message);
  if (messageDelay) return messageDelay;

  return null;
};

const createQuotaExceededError = (error) => {
  const retryDelaySeconds = getRetryDelayInSeconds(error);
  const quotaMessageSuffix = (() => {
    if (!retryDelaySeconds) return '';

    const roundedSeconds = Math.max(1, Math.round(retryDelaySeconds));
    const plural = roundedSeconds > 1 ? 's' : '';
    return ` Tente novamente em aproximadamente ${roundedSeconds} segundo${plural}.`;
  })();

  const quotaError = new Error(`${QUOTA_ERROR_MESSAGE}${quotaMessageSuffix}`);
  quotaError.status = error?.status || 429;
  quotaError.payload = error?.payload;
  quotaError.originalError = error;
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
