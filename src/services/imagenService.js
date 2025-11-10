import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

const IMAGEN_CONFIG = {
  aspectRatio: '4:5',
  numberOfImages: 1,
  safetyFilterLevel: 'block_some',
  personGeneration: 'allow_adult'
};

export async function generateSlideImage({ prompt, negativePrompt, apiKey, signal }) {
  if (!apiKey) {
    throw new Error('Configure a Google AI API Key antes de gerar imagens.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [
          {
            prompt,
            negativePrompt: negativePrompt || buildNegativePrompt()
          }
        ],
        parameters: {
          sampleCount: IMAGEN_CONFIG.numberOfImages,
          aspectRatio: IMAGEN_CONFIG.aspectRatio,
          safetyFilterLevel: IMAGEN_CONFIG.safetyFilterLevel,
          personGeneration: IMAGEN_CONFIG.personGeneration
        }
      }),
      signal
    }
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.error?.message || 'Falha ao gerar imagem com a Imagen API.');
  }

  const data = await response.json();
  const base64Image = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!base64Image) {
    throw new Error('A resposta da Imagen API não contém imagem válida.');
  }

  return base64Image;
}

export async function generateCarouselImages({ slides, brandKit, apiKey, onProgress, signal }) {
  const results = [];

  for (const slide of slides) {
    if (signal?.aborted) {
      throw new Error('Geração de imagens cancelada.');
    }

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
