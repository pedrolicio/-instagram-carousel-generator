import { buildClaudePrompt } from '../utils/promptBuilder.js';

const CLAUDE_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  temperature: 0.7
};

const isNetworkError = (error) => {
  if (!error) return false;
  if (error.name === 'TypeError' && /fetch/i.test(error.message || '')) return true;
  return /network/i.test(error.message || '');
};

const formatNetworkError = (error) => {
  if (!isNetworkError(error)) return error;

  const enhanced = new Error(
    'Não foi possível se conectar à Claude API. Verifique sua conexão com a internet, a chave de API e tente novamente.'
  );
  enhanced.cause = error;
  return enhanced;
};

const normalizeJsonText = (text) =>
  text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

const tryParseJson = (candidate) => {
  const normalized = normalizeJsonText(candidate);
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch (error) {
    return null;
  }
};

const extractJsonPayload = (content) => {
  if (typeof content !== 'string') return null;

  const codeBlocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const [, blockContent] of codeBlocks) {
    const parsed = tryParseJson(blockContent);
    if (parsed) {
      return parsed;
    }
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const parsed = tryParseJson(content.slice(firstBrace, lastBrace + 1));
    if (parsed) {
      return parsed;
    }
  }

  return tryParseJson(content);
};

export async function generateCarouselContent({ theme, brandKit, apiKey, signal }) {
  if (!theme) {
    throw new Error('Informe um tema para gerar o carrossel.');
  }

  if (!apiKey) {
    throw new Error('Configure a Anthropic API Key antes de gerar conteúdo.');
  }

  const prompt = buildClaudePrompt(theme, brandKit);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CLAUDE_CONFIG.model,
        max_tokens: CLAUDE_CONFIG.max_tokens,
        temperature: CLAUDE_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal
    });
  } catch (error) {
    throw formatNetworkError(error);
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.error?.message || 'Falha ao gerar conteúdo com a Claude API.');
  }

  const data = await response.json();
  const rawContent = data?.content?.[0]?.text;

  if (!rawContent) {
    throw new Error('Resposta da Claude API não contém conteúdo válido.');
  }

  try {
    const parsedResponse = extractJsonPayload(rawContent);

    if (!parsedResponse) {
      throw new Error('Empty content');
    }

    return normalizeGeneratedContent(parsedResponse);
  } catch (error) {
    console.error('[claudeService] Failed to parse JSON response', error, rawContent);
    throw new Error('Não foi possível interpretar a resposta da Claude API.');
  }
}

function normalizeGeneratedContent(payload) {
  const slidesSource = getSlidesSource(payload);
  const slides = slidesSource.map(normalizeSlide).map((slide, index) => ({
    ...slide,
    slideNumber: typeof slide.slideNumber === 'number' && !Number.isNaN(slide.slideNumber)
      ? slide.slideNumber
      : index + 1,
    type: slide.type ?? inferSlideType(index, slidesSource.length)
  }));

  const captionSource =
    payload?.caption ||
    payload?.legend ||
    payload?.post ||
    payload?.instagram_caption ||
    payload?.instagramCaption ||
    payload?.captioning ||
    {};

  const caption = normalizeCaption(captionSource);

  return {
    slides,
    caption
  };
}

function getSlidesSource(payload) {
  if (!payload) return [];

  if (Array.isArray(payload) && payload.length) {
    return payload;
  }

  const candidates = [
    payload.slides,
    payload.carousel?.slides,
    payload.carousel,
    payload.data?.slides,
    payload.data?.carousel?.slides,
    payload.content?.slides,
    payload.content?.carousel?.slides
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }

  const fallback = Object.values(payload).find(
    (value) =>
      Array.isArray(value) &&
      value.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          (hasTextualContent(item) || Array.isArray(item.sections) || Array.isArray(item.blocks))
      )
  );

  if (fallback) {
    return fallback;
  }

  return [];
}

function hasTextualContent(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;

  const textualKeys = [
    'title',
    'heading',
    'headline',
    'topic',
    'subtitle',
    'subheading',
    'body',
    'content',
    'text',
    'description'
  ];

  return textualKeys.some((key) => {
    const value = candidate[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function normalizeSlide(rawSlide = {}, index = 0) {
  if (typeof rawSlide !== 'object' || rawSlide === null) {
    rawSlide = {};
  }

  const pickString = (...candidates) => {
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
    }
    return '';
  };

  return {
    ...rawSlide,
    slideNumber: resolveSlideNumber(rawSlide.slideNumber, rawSlide.number, rawSlide.index, index),
    type: rawSlide.type ?? rawSlide.role ?? rawSlide.layout,
    title: pickString(rawSlide.title, rawSlide.heading, rawSlide.headline, rawSlide.topic),
    subtitle: pickString(rawSlide.subtitle, rawSlide.subheading, rawSlide.sub_title, rawSlide.summary),
    body: pickString(rawSlide.body, rawSlide.content, rawSlide.text, rawSlide.description),
    visualDescription: pickString(
      rawSlide.visualDescription,
      rawSlide.visual_description,
      rawSlide.visualNotes,
      rawSlide.visual_notes,
      rawSlide.visual,
      rawSlide.visualIdea,
      rawSlide.visual_idea
    )
  };
}

function resolveSlideNumber(...candidates) {
  for (const value of candidates) {
    const numberValue = Number.parseInt(value, 10);
    if (!Number.isNaN(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }
  return undefined;
}

function inferSlideType(index, totalSlides) {
  if (index === 0) return 'capa';
  if (index === totalSlides - 1) return 'cta';
  return 'conteudo';
}

function normalizeCaption(rawCaption) {
  if (!rawCaption) {
    return {
      text: '',
      hashtags: [],
      cta: ''
    };
  }

  if (typeof rawCaption === 'string') {
    return {
      text: rawCaption.trim(),
      hashtags: [],
      cta: ''
    };
  }

  const pickString = (...candidates) => {
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length) {
        return value.trim();
      }
      if (Array.isArray(value) && value.length && value.every((item) => typeof item === 'string')) {
        const joined = value.join('\n').trim();
        if (joined.length) {
          return joined;
        }
      }
    }
    return '';
  };

  const text = pickString(
    rawCaption.text,
    rawCaption.body,
    rawCaption.caption,
    rawCaption.description,
    rawCaption.content,
    rawCaption.main,
    rawCaption.paragraphs
  );

  const cta = pickString(rawCaption.cta, rawCaption.callToAction, rawCaption.call_to_action, rawCaption.callout);
  const hashtags = normalizeHashtags(
    rawCaption.hashtags,
    rawCaption.tags,
    rawCaption.hashTags,
    rawCaption.hash_tags,
    rawCaption.keywords
  );

  return {
    text,
    hashtags,
    cta
  };
}

function normalizeHashtags(...candidates) {
  const result = [];

  const handleCandidate = (candidate) => {
    if (!candidate) return;

    if (Array.isArray(candidate)) {
      candidate.forEach(handleCandidate);
      return;
    }

    if (typeof candidate === 'string') {
      const parts = candidate
        .replace(/[,;\n]+/g, ' ')
        .split(' ')
        .map((part) => part.trim())
        .filter(Boolean);

      parts.forEach((part) => {
        const normalized = part.startsWith('#') ? part : `#${part}`;
        result.push(normalized);
      });
      return;
    }

    if (typeof candidate === 'object') {
      Object.values(candidate).forEach(handleCandidate);
    }
  };

  candidates.forEach(handleCandidate);

  const unique = Array.from(new Set(result.map((tag) => tag.toLowerCase())));

  return unique.map((lowerTag) => {
    const original = result.find((tag) => tag.toLowerCase() === lowerTag);
    return original ?? lowerTag;
  });
}
