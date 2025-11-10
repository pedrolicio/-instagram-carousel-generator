import React from 'react';
import { Pencil, RefreshCw } from 'lucide-react';

const inputBase = 'w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export const ContentPreview = ({ slides, caption, onSlideChange, onRegenerateSlide, onCaptionChange }) => (
  <div className="flex flex-col gap-6">
    <div className="grid gap-4 lg:grid-cols-2">
      {slides.map((slide) => (
        <div key={slide.slideNumber} className="rounded-2xl border border-primary/10 bg-surface p-5 shadow-sm">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Slide {slide.slideNumber}</span>
              <h4 className="text-lg font-semibold text-text">{slide.type === 'capa' ? 'Capa' : slide.title}</h4>
            </div>
            {onRegenerateSlide && (
              <button
                type="button"
                onClick={() => onRegenerateSlide(slide)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerar
              </button>
            )}
          </header>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-text/60">Título</label>
            <input
              type="text"
              value={slide.title ?? ''}
              onChange={(event) => onSlideChange?.(slide.slideNumber, { title: event.target.value })}
              className={inputBase}
            />

            <label className="text-xs font-semibold uppercase tracking-wide text-text/60">Subtítulo</label>
            <input
              type="text"
              value={slide.subtitle ?? ''}
              onChange={(event) => onSlideChange?.(slide.slideNumber, { subtitle: event.target.value })}
              className={inputBase}
            />

            <label className="text-xs font-semibold uppercase tracking-wide text-text/60">Corpo</label>
            <textarea
              value={slide.body ?? ''}
              onChange={(event) => onSlideChange?.(slide.slideNumber, { body: event.target.value })}
              className={`${inputBase} min-h-[120px]`}
            />

            <label className="text-xs font-semibold uppercase tracking-wide text-text/60">Descrição Visual</label>
            <textarea
              value={slide.visualDescription ?? ''}
              onChange={(event) => onSlideChange?.(slide.slideNumber, { visualDescription: event.target.value })}
              className={`${inputBase} min-h-[120px]`}
            />
          </div>
        </div>
      ))}
    </div>

    <div className="rounded-2xl border border-primary/10 bg-surface p-5 shadow-sm">
      <header className="mb-3 flex items-center gap-2 text-text">
        <Pencil className="h-4 w-4 text-primary" />
        <h4 className="text-lg font-semibold">Legenda do Post</h4>
      </header>
      <textarea
        value={caption.text ?? ''}
        onChange={(event) => onCaptionChange?.({ ...caption, text: event.target.value })}
        className={`${inputBase} min-h-[180px]`}
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-text/60">Hashtags</label>
          <textarea
            value={(caption.hashtags ?? []).join('\n')}
            onChange={(event) => onCaptionChange?.({ ...caption, hashtags: event.target.value.split('\n').filter(Boolean) })}
            className={`${inputBase} min-h-[100px]`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-text/60">CTA</label>
          <input
            type="text"
            value={caption.cta ?? ''}
            onChange={(event) => onCaptionChange?.({ ...caption, cta: event.target.value })}
            className={inputBase}
          />
        </div>
      </div>
    </div>
  </div>
);
