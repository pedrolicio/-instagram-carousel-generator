import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext.jsx';
import { generateCarouselContent } from '../services/claudeService.js';
import { ContentPreview } from './ContentPreview.jsx';
import { ImageGenerator } from './ImageGenerator.jsx';
import { v4 as uuidv4 } from 'uuid';
import { buildImagenPrompt, buildNegativePrompt } from '../utils/promptBuilder.js';

const inputBase = 'w-full rounded-xl border border-primary/20 bg-background px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const createMockCarousel = (theme, brandKit) => {
  const slides = Array.from({ length: 5 }).map((_, index) => ({
    slideNumber: index + 1,
    type: index === 0 ? 'capa' : index === 4 ? 'cta' : 'conteudo',
    title:
      index === 0
        ? theme
        : `${index}. Insight ${brandKit?.communication?.contentThemes?.[index - 1] ?? 'Importante'}`,
    subtitle: index === 0 ? 'Carrossel gerado em modo demonstração' : null,
    body:
      index === 0
        ? 'Use a integração com a Claude para gerar conteúdos completos.'
        : 'Substitua este texto com insights reais gerados pela IA.',
    visualDescription: 'Layout seguindo o brand kit com foco em dados e CTA claro.'
  }));

  return {
    slides,
    caption: {
      text: `Carrossel de demonstração para o tema ${theme}. Configure suas chaves de API para gerar conteúdo real.`,
      hashtags: ['#marketingdigital', '#carrossel'],
      cta: 'Pronto para gerar conteúdos reais? Configure as APIs!'
    }
  };
};

export const CarouselGenerator = ({ selectedClientId, onSelectClient }) => {
  const { clients, addCarousel, apiKeys } = useAppContext();
  const [theme, setTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState(null);
  const [images, setImages] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId) ?? null, [
    clients,
    selectedClientId
  ]);

  const handleGenerate = async () => {
    if (!selectedClient) {
      setError('Selecione um cliente para gerar o carrossel.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccessMessage('');
    setImages([]);
    setPrompts([]);

    try {
      const generated = await generateCarouselContent({
        theme,
        brandKit: selectedClient,
        apiKey: apiKeys.anthropic
      });
      setContent(generated);
    } catch (generationError) {
      console.warn('[CarouselGenerator] Falling back to mock content', generationError);
      setContent(createMockCarousel(theme, selectedClient));
      setError(generationError.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSlideChange = (slideNumber, patch) => {
    setContent((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) => (slide.slideNumber === slideNumber ? { ...slide, ...patch } : slide))
    }));
  };

  const handleCaptionChange = (nextCaption) => {
    setContent((prev) => ({ ...prev, caption: nextCaption }));
  };

  const handleImagesGenerated = (imagesResult, promptsResult) => {
    setImages(imagesResult);
    setPrompts(promptsResult);
    setSuccessMessage('Imagens geradas com sucesso! Não esqueça de salvar no histórico.');
  };

  const handleSaveCarousel = () => {
    if (!content || !selectedClient) {
      setError('Gere e revise o conteúdo antes de salvar.');
      return;
    }

    const now = new Date().toISOString();
    const carousel = {
      id: uuidv4(),
      clientId: selectedClient.id,
      theme,
      createdAt: now,
      content: {
        slides: content.slides,
        caption: content.caption
      },
      prompts: prompts.length
        ? prompts
        : content.slides.map((slide) => ({
            slideNumber: slide.slideNumber,
            imagenPrompt: buildImagenPrompt(slide, selectedClient),
            negativePrompt: buildNegativePrompt()
          })),
      images: images.length
        ? images
        : content.slides.map((slide) => ({ slideNumber: slide.slideNumber, imageUrl: null, status: 'pending' }))
    };

    addCarousel(carousel);
    setSuccessMessage('Carrossel salvo no histórico com sucesso!');
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-text">Gerador de Carrossel</h2>
            <p className="text-sm text-text/70">Selecione o cliente, informe o tema e deixe a IA gerar todo o conteúdo.</p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Cliente
            <select
              value={selectedClientId ?? ''}
              onChange={(event) => onSelectClient?.(event.target.value || null)}
              className={inputBase}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Tema do carrossel
            <input
              type="text"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              className={inputBase}
              placeholder="Ex: 5 métricas essenciais do Google Ads"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!theme || !selectedClient || isGenerating}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? 'Gerando...' : 'Gerar Conteúdo'}
        </button>

        {error && <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p>}
      </div>

      {content && (
        <div className="flex flex-col gap-6">
          <ContentPreview
            slides={content.slides}
            caption={content.caption}
            onSlideChange={handleSlideChange}
            onCaptionChange={handleCaptionChange}
          />

          <ImageGenerator
            slides={content.slides}
            brandKit={selectedClient}
            apiKey={apiKeys.google}
            onImagesGenerated={handleImagesGenerated}
          />

          <button
            type="button"
            onClick={handleSaveCarousel}
            className="inline-flex items-center gap-2 self-end rounded-xl bg-success px-6 py-3 text-sm font-semibold text-white transition hover:bg-success/90"
          >
            <Wand2 className="h-4 w-4" />
            Salvar no Histórico
          </button>
        </div>
      )}

      {successMessage && <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{successMessage}</p>}
    </section>
  );
};
