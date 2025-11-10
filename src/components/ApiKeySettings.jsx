import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext.jsx';
import { clearStorage } from '../services/storageService.js';

export const ApiKeySettings = () => {
  const { apiKeys, setApiKeys } = useAppContext();
  const [localKeys, setLocalKeys] = useState(apiKeys);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSave = () => {
    setApiKeys(localKeys);
    setStatusMessage('Chaves salvas com sucesso.');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleClear = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as chaves e dados armazenados?')) {
      clearStorage();
      setApiKeys({ anthropic: '', google: '' });
      setLocalKeys({ anthropic: '', google: '' });
      setStatusMessage('Chaves e dados limpos.');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-text">Configurações de API</h2>
            <p className="text-sm text-text/70">Armazene suas chaves de forma segura no navegador (codificadas em base64).</p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Anthropic API Key
            <input
              type="password"
              value={localKeys.anthropic}
              onChange={(event) => setLocalKeys((prev) => ({ ...prev, anthropic: event.target.value }))}
              className="rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="sk-ant-..."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-text/80">
            Google AI API Key
            <input
              type="password"
              value={localKeys.google}
              onChange={(event) => setLocalKeys((prev) => ({ ...prev, google: event.target.value }))}
              className="rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="AIza..."
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <ShieldCheck className="h-4 w-4" />
            Salvar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-2 text-sm font-semibold text-error transition hover:bg-error/20"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Dados
          </button>
        </div>

        {statusMessage && <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{statusMessage}</p>}
      </div>
    </section>
  );
};
