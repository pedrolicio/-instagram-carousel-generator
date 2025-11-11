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

    return parsedResponse;
  } catch (error) {
    console.error('[claudeService] Failed to parse JSON response', error, rawContent);
    throw new Error('Não foi possível interpretar a resposta da Claude API.');
  }
}
