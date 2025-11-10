import React, { useMemo, useState } from 'react';
import { Palette, Sparkles, XCircle } from 'lucide-react';
import { validateBrandKit } from '../utils/brandKitValidator.js';

const Section = ({ icon: Icon, title, description, children }) => (
  <section className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
    <header className="mb-4 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        {description && <p className="text-sm text-text/70">{description}</p>}
      </div>
    </header>
    <div className="grid gap-4">{children}</div>
  </section>
);

const inputBase = 'w-full rounded-xl border border-primary/20 bg-background px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const parseList = (value) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyList = (list = []) => list.join('\n');

export const BrandKitForm = ({ initialData, onSubmit, onCancel }) => {
  const clone = typeof structuredClone === 'function' ? structuredClone : (value) => JSON.parse(JSON.stringify(value));
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});

  const colorPreview = useMemo(() => Object.values(formData.brandIdentity.colors ?? {}), [formData.brandIdentity.colors]);

  const handleChange = (path, value) => {
    setFormData((prev) => {
      const next = clone(prev);
      const segments = path.split('.');
      let cursor = next;
      segments.slice(0, -1).forEach((segment) => {
        cursor[segment] = cursor[segment] ?? {};
        cursor = cursor[segment];
      });
      cursor[segments.at(-1)] = value;
      return next;
    });
  };

  const handleListChange = (path, value) => handleChange(path, parseList(value));

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateBrandKit(formData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Section icon={Palette} title="Identidade Visual" description="Defina a base visual que garante consistência entre os slides.">
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(formData.brandIdentity.colors).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text/80">Cor {key}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={value}
                  onChange={(event) => handleChange(`brandIdentity.colors.${key}`, event.target.value)}
                  className="h-12 w-16 cursor-pointer rounded-xl border border-primary/20 bg-surface"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(event) => handleChange(`brandIdentity.colors.${key}`, event.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {colorPreview.map((color) => (
            <span key={color} className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/10" style={{ backgroundColor: color }} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Estilo Visual</label>
            <input
              type="text"
              value={formData.brandIdentity.visualStyle.type}
              onChange={(event) => handleChange('brandIdentity.visualStyle.type', event.target.value)}
              className={inputBase}
              placeholder="Ex: moderno-minimalista"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Mood</label>
            <input
              type="text"
              value={formData.brandIdentity.visualStyle.mood}
              onChange={(event) => handleChange('brandIdentity.visualStyle.mood', event.target.value)}
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Estilo de Imagem</label>
            <input
              type="text"
              value={formData.brandIdentity.visualStyle.imageStyle}
              onChange={(event) => handleChange('brandIdentity.visualStyle.imageStyle', event.target.value)}
              className={inputBase}
              placeholder="Ex: fotografia clean"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Composição</label>
            <input
              type="text"
              value={formData.brandIdentity.visualStyle.composition}
              onChange={(event) => handleChange('brandIdentity.visualStyle.composition', event.target.value)}
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Tipografia</label>
            <input
              type="text"
              value={formData.brandIdentity.typography.style}
              onChange={(event) => handleChange('brandIdentity.typography.style', event.target.value)}
              className={inputBase}
              placeholder="Ex: sans-serif moderna"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Hierarquia Tipográfica</label>
            <input
              type="text"
              value={formData.brandIdentity.typography.hierarchy}
              onChange={(event) => handleChange('brandIdentity.typography.hierarchy', event.target.value)}
              className={inputBase}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(formData.brandIdentity.visualElements)
            .filter(([key]) => key.startsWith('use'))
            .map(([key, value]) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-primary/10 bg-background px-4 py-3 text-sm font-medium text-text/80">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => handleChange(`brandIdentity.visualElements.${key}`, event.target.checked)}
                  className="h-4 w-4 rounded border-primary/40 text-primary focus:ring-primary"
                />
                {key.replace('use', '')}
              </label>
            ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text/80">Layout Preferido</label>
          <input
            type="text"
            value={formData.brandIdentity.visualElements.preferredLayout}
            onChange={(event) => handleChange('brandIdentity.visualElements.preferredLayout', event.target.value)}
            className={inputBase}
            placeholder="Ex: texto na parte inferior com imagem no topo"
          />
        </div>
      </Section>

      <Section icon={Sparkles} title="Comunicação" description="Defina tom de voz, público-alvo e direcionadores de conteúdo.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Tom de voz</label>
            <input
              type="text"
              value={formData.communication.tone}
              onChange={(event) => handleChange('communication.tone', event.target.value)}
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Idioma</label>
            <input
              type="text"
              value={formData.communication.language}
              onChange={(event) => handleChange('communication.language', event.target.value)}
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Tratamento</label>
            <input
              type="text"
              value={formData.communication.formality}
              onChange={(event) => handleChange('communication.formality', event.target.value)}
              className={inputBase}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Características da marca</label>
            <textarea
              value={stringifyList(formData.communication.characteristics)}
              onChange={(event) => handleListChange('communication.characteristics', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
              placeholder="Uma por linha"
            />
            {errors['communication.characteristics'] && (
              <p className="text-xs font-medium text-error">{errors['communication.characteristics']}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Temas de conteúdo recorrentes</label>
            <textarea
              value={stringifyList(formData.communication.contentThemes)}
              onChange={(event) => handleListChange('communication.contentThemes', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
              placeholder="Uma por linha"
            />
            {errors['communication.contentThemes'] && (
              <p className="text-xs font-medium text-error">{errors['communication.contentThemes']}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Público-Alvo</label>
            <input
              type="text"
              value={formData.communication.targetAudience.profile}
              onChange={(event) => handleChange('communication.targetAudience.profile', event.target.value)}
              className={inputBase}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Dores (uma por linha)</label>
            <textarea
              value={stringifyList(formData.communication.targetAudience.painPoints)}
              onChange={(event) => handleListChange('communication.targetAudience.painPoints', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Interesses (uma por linha)</label>
            <textarea
              value={stringifyList(formData.communication.targetAudience.interests)}
              onChange={(event) => handleListChange('communication.targetAudience.interests', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
            />
          </div>
        </div>
      </Section>

      <Section icon={XCircle} title="Referências" description="Links e exemplos que ajudam a guiar a IA.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">URLs de referência</label>
            <textarea
              value={stringifyList(formData.examples.referenceUrls)}
              onChange={(event) => handleListChange('examples.referenceUrls', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
              placeholder="https://..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Exemplos de sucesso</label>
            <textarea
              value={formData.examples.successfulExamples}
              onChange={(event) => handleChange('examples.successfulExamples', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
            />
          </div>
        </div>
      </Section>

      <footer className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-5 py-2.5 text-sm font-semibold text-text transition hover:border-primary/40 hover:text-primary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-success/90"
        >
          Salvar Brand Kit
        </button>
      </footer>
    </form>
  );
};
