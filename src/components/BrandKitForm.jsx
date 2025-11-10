import React, { useEffect, useState } from 'react';
import { FileText, Images, Sparkles, UserCircle2, XCircle } from 'lucide-react';
import { validateBrandKit } from '../utils/brandKitValidator.js';
import { languageOptions, toneOptions } from '../utils/brandKitOptions.js';

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

const inputBase =
  'w-full rounded-xl border border-primary/20 bg-background px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const parseList = (value) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyList = (list = []) => list.join('\n');

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeAttachments = (attachments = []) =>
  ensureArray(attachments).map((item) => ({
    ...item,
    id: item?.id ?? generateId()
  }));

const normalizeBrandKit = (brandKit = {}) => {
  const defaults = {
    id: brandKit?.id,
    clientName: brandKit?.clientName ?? '',
    brandIdentity: {
      colors: {},
      visualStyle: {},
      typography: {},
      visualElements: {},
      brandManuals: [],
      visualReferences: {
        uploads: [],
        links: [],
        notes: ''
      }
    },
    communication: {
      tone: toneOptions[0].value,
      customTone: '',
      language: languageOptions[0].value,
      briefingFiles: [],
      briefingNotes: '',
      additionalNotes: ''
    },
    examples: {
      referenceUrls: [],
      successfulExamples: ''
    }
  };

  const visualReferences = brandKit?.brandIdentity?.visualReferences ?? {};
  const communication = brandKit?.communication ?? {};

  return {
    ...defaults,
    ...brandKit,
    brandIdentity: {
      ...defaults.brandIdentity,
      ...brandKit?.brandIdentity,
      brandManuals: normalizeAttachments(brandKit?.brandIdentity?.brandManuals ?? []),
      visualReferences: {
        ...defaults.brandIdentity.visualReferences,
        ...visualReferences,
        uploads: normalizeAttachments(visualReferences?.uploads ?? []),
        links: ensureArray(visualReferences?.links ?? [])
      }
    },
    communication: {
      ...defaults.communication,
      ...communication,
      tone: communication?.tone ?? defaults.communication.tone,
      customTone: communication?.customTone ?? '',
      language: communication?.language ?? defaults.communication.language,
      briefingFiles: normalizeAttachments(communication?.briefingFiles ?? []),
      briefingNotes: communication?.briefingNotes ?? communication?.notes ?? '',
      additionalNotes: communication?.additionalNotes ?? ''
    },
    examples: {
      ...defaults.examples,
      ...brandKit?.examples
    }
  };
};

const formatFileSize = (size = 0) => {
  if (!size) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const AttachmentList = ({ items = [], onRemove }) => {
  if (!items.length) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((file) => (
        <li
          key={file.id}
          className="flex items-center justify-between rounded-xl border border-primary/10 bg-surface px-4 py-3 text-sm text-text"
        >
          <div className="flex flex-col">
            <span className="font-medium">{file.name}</span>
            {file.size ? <span className="text-xs text-text/60">{formatFileSize(file.size)}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => onRemove?.(file.id)}
            className="inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-error transition hover:border-error/30 hover:text-error"
          >
            <XCircle className="h-4 w-4" />
            Remover
          </button>
        </li>
      ))}
    </ul>
  );
};

export const BrandKitForm = ({ initialData, onSubmit, onCancel }) => {
  const clone = typeof structuredClone === 'function' ? structuredClone : (value) => JSON.parse(JSON.stringify(value));
  const [formData, setFormData] = useState(() => normalizeBrandKit(initialData));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(normalizeBrandKit(initialData));
    setErrors({});
  }, [initialData]);

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

  const handleToneChange = (value) => {
    handleChange('communication.tone', value);
    if (value !== 'custom') {
      handleChange('communication.customTone', '');
    }
  };

  const handleFileUpload = async (path, filesList) => {
    const files = Array.from(filesList ?? []);
    if (!files.length) return;

    const attachments = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: generateId(),
                name: file.name,
                size: file.size,
                type: file.type,
                content: reader.result
              });
            reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o arquivo.'));
            reader.readAsDataURL(file);
          })
      )
    );

    setFormData((prev) => {
      const next = clone(prev);
      const segments = path.split('.');
      let cursor = next;
      segments.slice(0, -1).forEach((segment) => {
        cursor[segment] = cursor[segment] ?? {};
        cursor = cursor[segment];
      });
      const key = segments.at(-1);
      const current = Array.isArray(cursor[key]) ? cursor[key] : [];
      cursor[key] = [...current, ...attachments];
      return next;
    });
  };

  const handleClipboardUpload = async (path, clipboardData) => {
    if (!clipboardData?.items) return;

    const files = Array.from(clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item, index) => {
        const file = item.getAsFile();
        if (!file) return null;

        if (file.name) {
          return file;
        }

        const extension = file.type?.split('/')?.[1] ?? 'png';
        const filename = `imagem-colada-${Date.now()}-${index + 1}.${extension}`;
        try {
          return new File([file], filename, { type: file.type || 'image/png', lastModified: Date.now() });
        } catch (error) {
          return file;
        }
      })
      .filter(Boolean);

    if (!files.length) return;

    await handleFileUpload(path, files);
  };

  const handleFileRemove = (path, fileId) => {
    setFormData((prev) => {
      const next = clone(prev);
      const segments = path.split('.');
      let cursor = next;
      segments.slice(0, -1).forEach((segment) => {
        cursor[segment] = cursor[segment] ?? {};
        cursor = cursor[segment];
      });
      const key = segments.at(-1);
      const current = Array.isArray(cursor[key]) ? cursor[key] : [];
      cursor[key] = current.filter((file) => file.id !== fileId);
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateBrandKit(formData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    onSubmit?.(formData);
  };

  const toneIsCustom = formData.communication.tone === 'custom';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Section icon={UserCircle2} title="Informações do cliente" description="Defina quem é o dono do brand kit.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Nome do cliente</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(event) => handleChange('clientName', event.target.value)}
              className={inputBase}
              placeholder="Ex: Loja Exemplo"
            />
            {errors.clientName && <p className="text-xs font-medium text-error">{errors.clientName}</p>}
          </div>
        </div>
      </Section>

      <Section
        icon={FileText}
        title="Materiais da marca"
        description="Envie o manual de identidade e o briefing oficial para centralizar as diretrizes."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Manual da marca</label>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={async (event) => {
                await handleFileUpload('brandIdentity.brandManuals', event.target.files);
                event.target.value = '';
              }}
              className={`${inputBase} file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white`}
            />
            <AttachmentList
              items={formData.brandIdentity.brandManuals}
              onRemove={(fileId) => handleFileRemove('brandIdentity.brandManuals', fileId)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Briefing ou guia da marca</label>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
              multiple
              onChange={async (event) => {
                await handleFileUpload('communication.briefingFiles', event.target.files);
                event.target.value = '';
              }}
              className={`${inputBase} file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white`}
            />
            <AttachmentList
              items={formData.communication.briefingFiles}
              onRemove={(fileId) => handleFileRemove('communication.briefingFiles', fileId)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text/80">Notas importantes do briefing</label>
          <textarea
            value={formData.communication.briefingNotes}
            onChange={(event) => handleChange('communication.briefingNotes', event.target.value)}
            className={`${inputBase} min-h-[120px]`}
            placeholder="Resuma os pontos críticos do briefing para facilitar o uso nas gerações."
          />
        </div>
      </Section>

      <Section
        icon={Images}
        title="Referências visuais"
        description="Envie ou cole posts que representem o estilo visual desejado."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Uploads de referência</label>
            <div
              tabIndex={0}
              onPaste={async (event) => {
                event.preventDefault();
                await handleClipboardUpload('brandIdentity.visualReferences.uploads', event.clipboardData);
              }}
              className="rounded-xl border border-dashed border-primary/30 bg-background/60 p-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  await handleFileUpload('brandIdentity.visualReferences.uploads', event.target.files);
                  event.target.value = '';
                }}
                className={`${inputBase} file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white`}
              />
              <p className="mt-3 text-xs text-text/60">
                Clique aqui e use <kbd className="rounded bg-text/10 px-1 py-0.5 text-[10px] uppercase tracking-wide">Ctrl</kbd> +
                <kbd className="rounded bg-text/10 px-1 py-0.5 text-[10px] uppercase tracking-wide">V</kbd> para colar imagens copiadas.
              </p>
            </div>
            <AttachmentList
              items={formData.brandIdentity.visualReferences.uploads}
              onRemove={(fileId) => handleFileRemove('brandIdentity.visualReferences.uploads', fileId)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Links de posts e referências</label>
            <textarea
              value={stringifyList(formData.brandIdentity.visualReferences.links)}
              onChange={(event) => handleListChange('brandIdentity.visualReferences.links', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
              placeholder="Cole um link por linha (Instagram, Behance, Pinterest, etc.)"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text/80">Observações sobre o estilo visual</label>
          <textarea
            value={formData.brandIdentity.visualReferences.notes}
            onChange={(event) => handleChange('brandIdentity.visualReferences.notes', event.target.value)}
            className={`${inputBase} min-h-[120px]`}
            placeholder="Descreva os elementos que não podem faltar ou cuidados ao reproduzir o estilo."
          />
        </div>
      </Section>

      <Section
        icon={Sparkles}
        title="Comunicação"
        description="Defina o tom de voz e as diretrizes gerais de conteúdo."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Tom de voz</label>
            <select
              value={formData.communication.tone}
              onChange={(event) => handleToneChange(event.target.value)}
              className={inputBase}
            >
              {toneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {toneIsCustom && (
              <input
                type="text"
                value={formData.communication.customTone}
                onChange={(event) => handleChange('communication.customTone', event.target.value)}
                className={inputBase}
                placeholder="Descreva o tom personalizado"
              />
            )}
            {errors['communication.tone'] && <p className="text-xs font-medium text-error">{errors['communication.tone']}</p>}
            {errors['communication.customTone'] && (
              <p className="text-xs font-medium text-error">{errors['communication.customTone']}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Idioma</label>
            <select
              value={formData.communication.language}
              onChange={(event) => handleChange('communication.language', event.target.value)}
              className={inputBase}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors['communication.language'] && (
              <p className="text-xs font-medium text-error">{errors['communication.language']}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text/80">Notas adicionais</label>
            <textarea
              value={formData.communication.additionalNotes}
              onChange={(event) => handleChange('communication.additionalNotes', event.target.value)}
              className={`${inputBase} min-h-[120px]`}
              placeholder="Inclua orientações específicas sobre linguagem, CTA ou ofertas."
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
