import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, FlaskConical, KeyRound, Lock, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import { useApiKeys } from '../../../app/providers/ApiKeysProvider.jsx';
import { useSettings } from '../../../app/providers/SettingsProvider.jsx';
import { useSystem } from '../../../app/providers/SystemProvider.jsx';

const inputBase =
  'rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export const ApiKeySettings = () => {
  const {
    apiKeys,
    apiKeysUnlocked,
    hasStoredApiKeys,
    apiKeysEncrypted,
    encryptionSecret,
    rememberSecret,
    persistApiKeys,
    unlockApiKeys,
    lockApiKeys
  } = useApiKeys();
  const { settings, updateSettings } = useSettings();
  const { clearAllData } = useSystem();

  const [localKeys, setLocalKeys] = useState(apiKeys);
  const [secret, setSecret] = useState(encryptionSecret);
  const [remember, setRemember] = useState(rememberSecret);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setLocalKeys(apiKeys);
  }, [apiKeys]);

  useEffect(() => {
    setSecret(encryptionSecret);
  }, [encryptionSecret]);

  useEffect(() => {
    setRemember(rememberSecret);
  }, [rememberSecret]);

  const resetStatus = () => setStatus({ type: '', message: '' });

  const handleSave = async () => {
    resetStatus();
    if (!secret) {
      setStatus({ type: 'error', message: 'Informe uma frase-secreta forte para criptografar suas chaves.' });
      return;
    }

    setIsProcessing(true);
    try {
      await persistApiKeys({ keys: localKeys, secret, remember });
      setStatus({ type: 'success', message: 'Chaves criptografadas e salvas com sucesso.' });
    } catch (error) {
      console.error('[ApiKeySettings] Failed to save API keys securely', error);
      setStatus({ type: 'error', message: 'Não foi possível salvar as chaves. Verifique o suporte ao Web Crypto e tente novamente.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    resetStatus();
    if (!secret && apiKeysEncrypted) {
      setStatus({ type: 'error', message: 'Informe a frase-secreta utilizada durante o salvamento das chaves.' });
      return;
    }

    setIsProcessing(true);
    try {
      const decrypted = await unlockApiKeys({ secret, remember });
      setLocalKeys(decrypted);
      setStatus({ type: 'success', message: 'Chaves descriptografadas para esta sessão.' });
    } catch (error) {
      console.error('[ApiKeySettings] Failed to unlock API keys', error);
      setStatus({ type: 'error', message: 'Não foi possível desbloquear. A frase-secreta informada está incorreta?' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLock = () => {
    lockApiKeys();
    setLocalKeys({ anthropic: '', google: '' });
    setStatus({ type: 'success', message: 'Chaves bloqueadas nesta sessão. Os dados permanecem criptografados no navegador.' });
  };

  const handleClear = () => {
    resetStatus();
    if (window.confirm('Tem certeza que deseja limpar todas as chaves e dados armazenados?')) {
      clearAllData();
      setLocalKeys({ anthropic: '', google: '' });
      setSecret('');
      setRemember(false);
      setStatus({ type: 'success', message: 'Chaves e dados apagados com segurança.' });
    }
  };

  const statusStyles = {
    success: 'bg-success/10 text-success',
    error: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning'
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-6">
        <div className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-text">Configurações de API</h2>
            <p className="text-sm text-text/70">
              As chaves são criptografadas com AES-GCM (Web Crypto) usando uma frase-secreta que nunca sai do seu navegador.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Anthropic API Key
            <input
              type="password"
              value={localKeys.anthropic}
              onChange={(event) => setLocalKeys((prev) => ({ ...prev, anthropic: event.target.value }))}
              className={inputBase}
              placeholder="sk-ant-..."
              disabled={hasStoredApiKeys && !apiKeysUnlocked}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Google AI API Key
            <input
              type="password"
              value={localKeys.google}
              onChange={(event) => setLocalKeys((prev) => ({ ...prev, google: event.target.value }))}
              className={inputBase}
              placeholder="AIza..."
              disabled={hasStoredApiKeys && !apiKeysUnlocked}
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Frase-secreta de criptografia
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                className={`${inputBase} pr-10`}
                placeholder="Use uma frase longa e exclusiva"
              />
              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 transition hover:text-text"
                aria-label={showSecret ? 'Ocultar frase-secreta' : 'Mostrar frase-secreta'}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="text-xs text-text/60">
              Combine letras maiúsculas, minúsculas, números e símbolos. Você precisará desta frase para desbloquear as chaves.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-text/70">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-primary/40 text-primary focus:ring-primary/40"
            />
            Lembrar a frase-secreta durante esta sessão (armazenado apenas em <code>sessionStorage</code>)
          </label>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            Salvar chaves criptografadas
          </button>
          <button
            type="button"
            onClick={apiKeysUnlocked ? handleLock : handleUnlock}
            disabled={isProcessing || (!apiKeysUnlocked && !hasStoredApiKeys)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {apiKeysUnlocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {apiKeysUnlocked ? 'Bloquear sessão atual' : 'Desbloquear chaves' }
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-2 text-sm font-semibold text-error transition hover:bg-error/20"
          >
            <Trash2 className="h-4 w-4" />
            Limpar todos os dados
          </button>
          {hasStoredApiKeys && !apiKeysUnlocked && (
            <p className="text-xs text-warning">
              Há chaves criptografadas. Desbloqueie-as informando a frase-secreta correta.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text/80">
          <h3 className="mb-2 text-sm font-semibold text-text">Boas práticas recomendadas</h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>Utilize uma frase-secreta única e não compartilhada com outras aplicações.</li>
            <li>Nunca reutilize suas chaves de API em ambientes públicos ou dispositivos compartilhados.</li>
            <li>Prefira desbloquear as chaves apenas quando for gerar novos conteúdos.</li>
            <li>Revogue chaves suspeitas imediatamente no painel do provedor.</li>
          </ul>
        </div>

        {status.message && (
          <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${statusStyles[status.type] ?? 'bg-primary/10 text-primary'}`}>
            {status.message}
          </p>
        )}
        {hasStoredApiKeys && !apiKeysEncrypted && (
          <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
            Detectamos chaves armazenadas no formato legado (apenas codificadas em base64). Desbloqueie e salve novamente com
            uma frase-secreta para habilitar a criptografia forte.
          </p>
        )}
      </div>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-text">Modo de teste</h2>
            <p className="text-sm text-text/70">
              Utilize o modo de teste para simular conteúdos sem disparar requisições para a Claude API.
            </p>
          </div>
        </header>

        <label className="flex items-start gap-3 text-sm text-text/80">
          <input
            type="checkbox"
            checked={settings.anthropicTestMode}
            onChange={(event) => updateSettings({ anthropicTestMode: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-primary/40 text-primary focus:ring-primary/40"
          />
          <span className="flex flex-col gap-1">
            <span className="font-semibold text-text">Ativar modo de teste para textos</span>
            <span className="text-xs text-text/70">
              Quando habilitado, o gerador de carrossel usa conteúdos demonstrativos para economizar seus créditos da Claude.
            </span>
          </span>
        </label>

        {settings.anthropicTestMode && (
          <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
            Enquanto o modo de teste estiver ativado, nenhum conteúdo real será solicitado à Claude. Desative-o quando quiser
            gerar textos definitivos.
          </p>
        )}
      </section>
    </div>
  );
};
