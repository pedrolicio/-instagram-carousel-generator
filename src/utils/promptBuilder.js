const formatColors = (colors = {}) =>
  Object.entries(colors)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

const formatArray = (items = []) => (items.length ? items.join(', ') : '');

export const buildClaudePrompt = (theme, brandKit) => {
  const { clientName, brandIdentity = {}, communication = {} } = brandKit;
  const { colors, visualStyle = {}, typography = {}, visualElements = {} } = brandIdentity;
  const { tone, language, formality, characteristics = [], targetAudience = {}, contentThemes = [] } = communication;

  return `Você é um especialista em marketing digital criando carrosséis para Instagram.\n\nINFORMAÇÕES DA MARCA:\n- Cliente: ${
    clientName
  }\n- Tom: ${tone}\n- Idioma: ${language}\n- Tratamento: ${formality}\n- Público: ${targetAudience.profile}\n- Dores: ${formatArray(targetAudience.painPoints)}\n- Interesses: ${formatArray(targetAudience.interests)}\n- Estilo Visual: ${visualStyle.type} (${visualStyle.mood})\n- Paleta de cores: ${formatColors(colors)}\n- Tipografia: ${typography.style} (${typography.hierarchy})\n- Elementos visuais: ${Object.entries(visualElements)
    .filter(([key]) => key.startsWith('use'))
    .map(([key, value]) => `${key.replace('use', '')}: ${value ? 'sim' : 'não'}`)
    .join(', ')}\n- Layout preferido: ${visualElements.preferredLayout}\n\nCaracterísticas da comunicação: ${formatArray(characteristics)}\nTemas recorrentes: ${formatArray(contentThemes)}\n\nTAREFA:\nCrie um carrossel informativo sobre: "${theme}"\n\nREQUISITOS:\n- Determine o número ideal de slides (mínimo 5, máximo 10)\n- Primeiro slide: capa impactante\n- Slides do meio: conteúdo educativo\n- Último slide: CTA\n- Cada slide deve ter título, subtítulo/corpo\n- Para cada slide, descreva a composição visual ideal\n- Crie uma legenda completa para o Instagram\n\nFORMATO DE RESPOSTA (JSON):\n{\n  "slides": [ ... ],\n  "caption": { ... }\n}`;
};

export const buildImagenPrompt = (slide, brandKit) => {
  const { brandIdentity = {} } = brandKit;
  const { colors = {}, visualStyle = {}, visualElements = {} } = brandIdentity;

  const basePrompt = `${slide.visualDescription || slide.title} in ${visualStyle.type} style. Brand colors: ${formatColors(colors)}. Composition: ${
    visualStyle.composition
  }. Text placement: ${visualElements.preferredLayout}. Style: ${visualStyle.imageStyle}, ${visualStyle.mood}. Format: 4:5 ratio for Instagram carousel. High quality, professional, clean design.`;

  const textOverlay = [
    slide.title ? `Title: "${slide.title}"` : null,
    slide.subtitle ? `Subtitle: "${slide.subtitle}"` : null,
    slide.body ? `Body: "${slide.body}"` : null
  ]
    .filter(Boolean)
    .join(' ');

  const additionalElements = Object.entries(visualElements)
    .filter(([key, value]) => key.startsWith('use') && value)
    .map(([key]) => key.replace('use', '').toLowerCase())
    .join(', ');

  const extras = additionalElements ? ` Additional visual elements: ${additionalElements}.` : '';

  return `${basePrompt} Include text overlay space with ${textOverlay || 'brand messaging focus'}.${extras}`;
};

export const buildNegativePrompt = () =>
  'cluttered, busy, low quality, blurry, watermark, signature, distorted text, meme style';
