import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

const IMAGEN_CONFIG = {
  aspectRatio: '4:5',
  numberOfImages: 1,
  safetyFilterLevel: 'block_some',
  personGeneration: 'allow_adult'
};

const GENERATE_IMAGES_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration:generate';
const FALLBACK_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@002:generate';

const extractBase64Image = (payload) => {
  if (!payload) return '';

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

  return candidates.find((v) => typeof v === 'string' && v.length > 0) || '';
};

const createApiError = async (response) => {
  const errorPayload = await response.json().catch(() => ({}));
  const message = errorPayload?.error?.message || 'Falha ao gerar imagem com a Imagen API.';
  const error = new Error(message);
  error.status = response.status;
  error.payload = errorPayload;
  return error;
};

// --- Funções de verificação e tratamento de erro ---

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
    message.includes('imagen-3.0')
  );
};

const formatNetworkError = (error, fallbackMessage) => {
  if (!isNetworkError(error)) return error;

  const enhanced = new Error(
    fallbackMessage ||
      'Não foi possível se conectar à Imagen API. Verifique sua conexão com a internet, a chave de API e tente novamente.'
  );

  enhanced.cause = error;
  return enhanced;
};

const getModelAvailabilityHelp = (error) => {
  if (!error) return null;

  const rawMessage = error.payload?.error?.message || error.message || '';
  const message = rawMessage.toLowerCase();

  if (!message) return null;

  const genericHelp =
    'Sua chave da Google AI não tem acesso ao modelo solicitado. Acesse o Google AI Studio, habilite o Image Generation para o projeto da chave ou gere uma nova chave com esse acesso.';

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

// --- Chamadas às APIs ---

const callFallbackGenerate = async ({ prompt, negativePrompt, apiKey, signal }) => {
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

  const requestUrl = new URL(FALLBACK_GENERATE_ENDPOINT);
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

  if (!response.ok) throw await createApiError(response);
  return response.json();
};

const callGenerateImages = async ({ prompt, negativePrompt, apiKey, signal }) => {
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

  const requestUrl = new URL(GENERATE_IMAGES_ENDPOINT);
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

  if (!response.ok) throw await createApiError(response);
  return response.json();
};

// --- Função principal de geração ---

export async function generateSlideImage({ prompt, negativePrompt, apiKey, signal }) {
  if (!apiKey) throw new Error('Configure a Google AI API Key antes de gerar imagens.');

  const resolvedNegativePrompt = negativePrompt || buildNegativePrompt();

  const attemptExtraction = async (request) => {
    const payload = await request;
    const base64Image = extractBase64Image(payload);
    if (!base64Image) throw new Error('A resposta da Imagen API não contém imagem válida.');
    return base64Image;
  };

  try {
    return await attemptExtraction(
      callGenerateImages({ prompt, negativePrompt: resolvedNegativePrompt, apiKey, signal })
    );
  } catch (generateImagesError) {
    if (!shouldRetryWithFallbackModel(generateImagesError)) {
      throw formatNetworkError(generateImagesError);
    }

    try {
      return await attemptExtraction(
        callFallbackGenerate({ prompt, negativePrompt: resolvedNegativePrompt, apiKey, signal })
      );
    } catch (fallbackError) {
      const formatted = formatNetworkError(fallbackError);
      const helpMessage =
        getModelAvailabilityHelp(fallbackError) || getModelAvailabilityHelp(generateImagesError);

      if (helpMessage) {
        const detailSegments = [];
        const fallbackMessage = fallbackError?.message;
        const previousMessage = generateImagesError?.message;

        if (fallbackMessage && !helpMessage.toLowerCase().includes(fallbackMessage.toLowerCase())) {
          detailSegments.push(`Detalhes: ${fallbackMessage}`);
        }

        if (
          previousMessage &&
          previousMessage !== fallbackMessage &&
          !detailSegments.some((segment) => segment.toLowerCase().includes(previousMessage.toLowerCase()))
        ) {
          detailSegments.push(`Tentativa anterior: ${previousMessage}`);
        }

        formatted.message = detailSegments.length
          ? `${helpMessage} (${detailSegments.join(' | ')})`
          : helpMessage;
      } else if (formatted === fallbackError && generateImagesError?.message) {
        formatted.message = `${formatted.message} (tentativa anterior: ${generateImagesError.message})`;
      }
      throw formatted;
    }
  }
}

// --- Geração de múltiplas imagens (ex.: carrossel) ---

export async function generateCarouselImages({ slides, brandKit, apiKey, onProgress, signal }) {
  const results = [];

  for (const slide of slides) {
    if (signal?.aborted) throw new Error('Geração de imagens cancelada.');

    const prompt = buildImagenPrompt(slide, brandKit);
    const image = await generateSlideImage({ prompt, apiKey, signal });

    results.push({
      slideNumber: slide.slideNumber,
      imageUrl: image,
      status: 'generated'
    });

    onProgress?.(results.length / slides.length);
  }

  return results;
}
