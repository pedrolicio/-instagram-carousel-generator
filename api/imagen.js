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

const buildErrorResponse = (status, message, details) =>
  new Response(
    JSON.stringify({
      error: {
        message,
        details
      }
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...baseHeaders
      }
    }
  );

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
      const helpMessage = getModelAvailabilityHelp(primaryError);
      const message = helpMessage || primaryError.message || 'Falha ao gerar imagem com a Imagen API.';

      return buildErrorResponse(primaryError.status || 500, message, primaryError.payload);
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
        const helpMessage = getModelAvailabilityHelp(legacyError) || getModelAvailabilityHelp(primaryError);
        const message = helpMessage || legacyError.message || 'Falha ao gerar imagem com a Imagen API.';
        const details = legacyError.payload || primaryError.payload;

        return buildErrorResponse(legacyError.status || 500, message, details);
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

        const message = helpMessage || fallbackError.message || 'Falha ao gerar imagem com a Imagen API.';

        const details = fallbackError.payload || legacyError.payload || primaryError.payload;

        return buildErrorResponse(fallbackError.status || 500, message, details);
      }
    }
  }
}
