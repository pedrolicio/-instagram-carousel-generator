import React from 'react';
import { Image as ImageIcon, ImageOff } from 'lucide-react';

const isHttpUrl = (value) => /^https?:\/\//i.test(value);
const isDataUrl = (value) => /^data:image\//i.test(value);

const normalizeImageSource = (rawValue) => {
  if (typeof rawValue !== 'string') {
    return '';
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (isHttpUrl(trimmed) || isDataUrl(trimmed)) {
    return trimmed;
  }

  const sanitized = trimmed.replace(/\s+/g, '');
  return `data:image/png;base64,${sanitized}`;
};

const getSlideMetadata = (slides, slideNumber) => {
  if (!Array.isArray(slides)) {
    return null;
  }

  return slides.find((slide) => slide.slideNumber === slideNumber) ?? null;
};

export const GeneratedImagesPreview = ({ images, slides }) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-text">Pré-visualização das imagens</h3>
          <p className="text-sm text-text/70">
            Revise as artes geradas antes de salvar o carrossel. Faça o download clicando com o botão direito sobre cada imagem.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => {
          const src = normalizeImageSource(image?.imageUrl);
          const slideMeta = getSlideMetadata(slides, image?.slideNumber);
          const title = slideMeta?.title || slideMeta?.body || '';

          return (
            <article
              key={image?.slideNumber ?? `image-${index}`}
              className="overflow-hidden rounded-xl border border-primary/10 bg-background"
            >
              <div className="relative aspect-square w-full bg-background/80">
                {src ? (
                  <img
                    src={src}
                    alt={title ? `Slide ${image?.slideNumber}: ${title}` : `Slide ${image?.slideNumber}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-text/60">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-xs font-medium">Imagem indisponível</span>
                  </div>
                )}
                {image?.status && (
                  <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    {image.status}
                  </span>
                )}
              </div>

              <footer className="space-y-1 px-4 py-3">
                <p className="text-sm font-semibold text-text">Slide {image?.slideNumber ?? '?'}</p>
                {title && <p className="text-xs text-text/70">{title}</p>}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
};
