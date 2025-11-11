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
    return JSON.parse(rawContent);
  } catch (error) {
    console.error('[claudeService] Failed to parse JSON response', error, rawContent);
    throw new Error('Não foi possível interpretar a resposta da Claude API.');
  }
}
