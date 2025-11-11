import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

const IMAGEN_PROXY_ENDPOINT = '/api/imagen';
const NETWORK_ERROR_MESSAGE =
  'Não foi possível se conectar à Imagen API. Verifique sua conexão com a internet, a chave de API e tente novamente.';

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
