const formatColors = (colors = {}) =>
  Object.entries(colors)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

const formatArray = (items = []) => (items.length ? items.join(', ') : '');

const formatAttachments = (attachments = []) =>
  attachments.length ? attachments.map((item) => item.name ?? 'arquivo').join(', ') : '';

const languageLabels = {
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)'
};

export const buildClaudePrompt = (theme, brandKit) => {
  const { clientName, brandIdentity = {}, communication = {} } = brandKit;
  const {
    colors = {},
    visualStyle = {},
    typography = {},
    visualElements = {},
    brandManuals = [],
    visualReferences = {}
  } = brandIdentity;
  const {
    tone,
    customTone,
    language,
    briefingFiles = [],
    briefingNotes = '',
    additionalNotes = '',
    characteristics = [],
    targetAudience = {},
    contentThemes = [],
    notes,
    ...restCommunication
  } = communication;

  const resolvedTone = tone === 'custom' ? customTone : tone;
  const resolvedLanguage = languageLabels[language] ?? language ?? 'Português (Brasil)';

  const manualSummary = formatAttachments(brandManuals);
  const briefingSummary = formatAttachments(briefingFiles);
  const referenceUploads = formatAttachments(visualReferences.uploads ?? []);
  const referenceLinks = formatArray(visualReferences.links ?? []);
  const referenceNotes = visualReferences.notes;

  const materialsLines = [
    manualSummary ? `• Manuais: ${manualSummary}` : null,
    briefingSummary ? `• Briefings: ${briefingSummary}` : null,
    referenceUploads ? `• Referências enviadas: ${referenceUploads}` : null,
    referenceLinks ? `• Links de inspiração: ${referenceLinks}` : null,
    referenceNotes ? `• Observações visuais: ${referenceNotes}` : null
  ].filter(Boolean);

  const legacyVisualLines = [
    visualStyle?.type || visualStyle?.mood
      ? `• Estilo legado: ${[visualStyle?.type, visualStyle?.mood].filter(Boolean).join(' ')}`
      : null,
    visualStyle?.imageStyle ? `• Estilo de imagem: ${visualStyle.imageStyle}` : null,
    visualStyle?.composition ? `• Composição preferida: ${visualStyle.composition}` : null,
    formatColors(colors) ? `• Paleta de cores: ${formatColors(colors)}` : null,
    typography?.style || typography?.hierarchy
      ? `• Tipografia: ${[typography?.style, typography?.hierarchy].filter(Boolean).join(' ')}`
      : null,
    Object.entries(visualElements)
      .filter(([key, value]) => key.startsWith('use') && value)
      .map(([key]) => key.replace('use', ''))
      .join(', ')
      ? `• Elementos visuais preferidos: ${Object.entries(visualElements)
          .filter(([key, value]) => key.startsWith('use') && value)
          .map(([key]) => key.replace('use', ''))
          .join(', ')}`
      : null,
    visualElements?.preferredLayout ? `• Layout preferido: ${visualElements.preferredLayout}` : null
  ].filter(Boolean);

  const audienceLines = [
    targetAudience?.profile ? `• Público: ${targetAudience.profile}` : null,
    formatArray(targetAudience?.painPoints ?? []) ? `• Dores: ${formatArray(targetAudience.painPoints)}` : null,
    formatArray(targetAudience?.interests ?? []) ? `• Interesses: ${formatArray(targetAudience.interests)}` : null
  ].filter(Boolean);

  const characteristicsLine = characteristics.length
    ? `• Características da marca: ${formatArray(characteristics)}`
    : null;
  const themesLine = contentThemes.length ? `• Temas recorrentes: ${formatArray(contentThemes)}` : null;

  const additionalCommunicationNotes = [briefingNotes, additionalNotes, notes, restCommunication?.additionalNotes]
    .map((item) => (item ?? '').trim())
    .filter(Boolean)
    .join('\n');

  const communicationLines = [characteristicsLine, themesLine, ...audienceLines].filter(Boolean);

  const materialsBlock = (materialsLines.length ? materialsLines : ['• Nenhum material adicional fornecido']).join('\n');
  const legacyVisualBlock = legacyVisualLines.length
    ? `\nDiretrizes visuais legadas:\n${legacyVisualLines.join('\n')}`
    : '';
  const legacyCommunicationBlock = communicationLines.length
    ? `\nContexto de comunicação legado:\n${communicationLines.join('\n')}`
    : '';

  return `Você é um especialista em marketing digital criando carrosséis para Instagram.\n\nINFORMAÇÕES DA MARCA:\n- Cliente: ${
    clientName || 'Não informado'
  }\n- Tom de voz: ${resolvedTone || 'Não informado'}\n- Idioma: ${resolvedLanguage}\n- Materiais compartilhados:\n${materialsBlock}${legacyVisualBlock}${legacyCommunicationBlock}\n\nNotas de briefing:\n${additionalCommunicationNotes || 'Sem observações adicionais.'}\n\nTAREFA:\nCrie um carrossel informativo sobre: "${
    theme
  }"\n\nREQUISITOS:\n- Determine o número ideal de slides (mínimo 5, máximo 10)\n- Primeiro slide: capa impactante\n- Slides do meio: conteúdo educativo\n- Último slide: CTA\n- Cada slide deve ter título, subtítulo/corpo\n- Para cada slide, descreva a composição visual ideal\n- Crie uma legenda completa para o Instagram\n\nFORMATO DE RESPOSTA (JSON):\n{\n  "slides": [ ... ],\n  "caption": { ... }\n}`;
};

export const buildImagenPrompt = (slide, brandKit) => {
  const { brandIdentity = {}, communication = {} } = brandKit;
  const {
    colors = {},
    visualStyle = {},
    visualElements = {},
    brandManuals = [],
    visualReferences = {}
  } = brandIdentity;

  const resolvedTone = communication.tone === 'custom' ? communication.customTone : communication.tone;
  const legacyColors = formatColors(colors);
  const visualStyleParts = [visualStyle?.type, visualStyle?.mood, visualStyle?.imageStyle]
    .filter(Boolean)
    .join(', ');
  const layoutPreference = visualStyle?.composition || visualElements?.preferredLayout;
  const attachmentSummary = formatAttachments(brandManuals);
  const referenceNotes = [
    visualReferences?.notes,
    formatArray(visualReferences?.links ?? []) ? `Links: ${formatArray(visualReferences.links)}` : null,
    formatAttachments(visualReferences?.uploads ?? [])
      ? `Uploads: ${formatAttachments(visualReferences.uploads)}`
      : null
  ]
    .filter(Boolean)
    .join('. ');

  const additionalElements = Object.entries(visualElements)
    .filter(([key, value]) => key.startsWith('use') && value)
    .map(([key]) => key.replace('use', '').toLowerCase())
    .join(', ');

  const descriptionParts = [
    slide.visualDescription || slide.title || 'Instagram carousel slide',
    resolvedTone ? `Tom geral: ${resolvedTone}` : null,
    visualStyleParts ? `Estilo legado: ${visualStyleParts}` : null,
    legacyColors ? `Paleta da marca: ${legacyColors}` : null,
    layoutPreference ? `Composição desejada: ${layoutPreference}` : null,
    additionalElements ? `Elementos recorrentes: ${additionalElements}` : null,
    attachmentSummary ? `Considere materiais: ${attachmentSummary}` : null,
    referenceNotes ? `Referências visuais: ${referenceNotes}` : null
  ].filter(Boolean);

  const textOverlay = [
    slide.title ? `Title: "${slide.title}"` : null,
    slide.subtitle ? `Subtitle: "${slide.subtitle}"` : null,
    slide.body ? `Body: "${slide.body}"` : null
  ]
    .filter(Boolean)
    .join(' ');

  return `${descriptionParts.join('. ')}. Formato 4:5 para carrossel do Instagram. Design limpo, profissional e de alta qualidade. Inclua espaço para texto com ${
    textOverlay || 'mensagens da marca'
  }.`;
};

export const buildNegativePrompt = () =>
  'cluttered, busy, low quality, blurry, watermark, signature, distorted text, meme style';
