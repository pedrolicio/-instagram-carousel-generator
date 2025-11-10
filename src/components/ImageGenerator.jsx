import React, { useState } from 'react';
import { ImageDown, Loader2 } from 'lucide-react';
import { generateCarouselImages } from '../services/imagenService.js';
import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

export const ImageGenerator = ({ slides, brandKit, apiKey, onImagesGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    const controller = new AbortController();

    try {
      const images = await generateCarouselImages({
        slides,
        brandKit,
        apiKey,
        onProgress: setProgress,
        signal: controller.signal
      });

      const prompts = slides.map((slide) => ({
        slideNumber: slide.slideNumber,
        imagenPrompt: buildImagenPrompt(slide, brandKit),
        negativePrompt: buildNegativePrompt()
      }));

      onImagesGenerated?.(images, prompts);
    } catch (generationError) {
      console.error('[ImageGenerator] Failed to generate images', generationError);
      setError(generationError.message);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text">Geração de Imagens</h3>
          <p className="text-sm text-text/70">Gere as artes do carrossel respeitando o brand kit automaticamente.</p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !slides.length}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
          {isGenerating ? 'Gerando...' : 'Gerar Imagens'}
        </button>
      </header>

      {isGenerating && (
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full rounded-full bg-primary/10">
            <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="text-sm font-medium text-text/70">{Math.round(progress * 100)}% concluído</span>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
    </div>
  );
};
