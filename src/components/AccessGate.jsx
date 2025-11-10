import React, { useEffect, useMemo, useState } from 'react';

const ACCESS_STORAGE_KEY = 'icg.access.hash';
const SKIP_STORAGE_KEY = 'icg.access.skip';

const parseList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

const hashAccessCode = async (code) => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API não suportada neste ambiente');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

const getStoredHash = () => {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(ACCESS_STORAGE_KEY) ?? window.sessionStorage.getItem(ACCESS_STORAGE_KEY) ?? '';
  } catch (error) {
    console.error('[AccessGate] Failed to read stored access hash', error);
    return '';
  }
};

const persistHash = (hash, remember) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(ACCESS_STORAGE_KEY);
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    window.sessionStorage.removeItem(SKIP_STORAGE_KEY);

    if (!hash) {
      return;
    }

    if (remember) {
      window.localStorage.setItem(ACCESS_STORAGE_KEY, hash);
    } else {
      window.sessionStorage.setItem(ACCESS_STORAGE_KEY, hash);
    }
  } catch (error) {
    console.error('[AccessGate] Failed to persist access hash', error);
  }
};

const markSkipLogin = () => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(SKIP_STORAGE_KEY, '1');
  } catch (error) {
    console.error('[AccessGate] Failed to persist skip login flag', error);
  }
};

const getSkipLogin = () => {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(SKIP_STORAGE_KEY) === '1';
  } catch (error) {
    console.error('[AccessGate] Failed to read skip login flag', error);
    return false;
  }
};

export const AccessGate = ({ children }) => {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configuredHashes = useMemo(() => {
    const hashed = (import.meta.env.VITE_ACCESS_CODE_HASHES ?? '').trim();
    return hashed ? parseList(hashed) : [];
  }, []);

  const configuredCodes = useMemo(() => {
    const codes = (import.meta.env.VITE_ACCESS_CODES ?? '').trim();
    return codes ? parseList(codes) : [];
  }, []);

  const hasProtection = configuredHashes.length > 0 || configuredCodes.length > 0;

  useEffect(() => {
    if (!hasProtection) {
      setStatus('granted');
      return;
    }

    if (getSkipLogin()) {
      setStatus('granted');
      return;
    }

    const verifyStoredHash = async () => {
      const storedHash = getStoredHash();
      if (!storedHash) {
        setStatus('locked');
        return;
      }

      if (configuredHashes.includes(storedHash)) {
        setStatus('granted');
        return;
      }

      if (configuredCodes.length > 0) {
        try {
          const hashedCodes = await Promise.all(configuredCodes.map((item) => hashAccessCode(item)));
          if (hashedCodes.includes(storedHash)) {
            setStatus('granted');
            return;
          }
        } catch (hashError) {
          console.error('[AccessGate] Failed to validate stored plain code hash', hashError);
        }
      }

      setStatus('locked');
    };

    verifyStoredHash();
  }, [hasProtection, configuredHashes, configuredCodes]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const value = code.trim();
    if (!value) {
      setError('Informe o código de acesso.');
      return;
    }

    if (!hasProtection) {
      setStatus('granted');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (configuredCodes.includes(value)) {
        const computedHash = await hashAccessCode(value);
        persistHash(computedHash, remember);
        setStatus('granted');
        return;
      }

      const computedHash = await hashAccessCode(value);
      if (configuredHashes.includes(computedHash)) {
        persistHash(computedHash, remember);
        setStatus('granted');
        return;
      }

      setError('Código de acesso inválido.');
    } catch (submitError) {
      console.error('[AccessGate] Failed to validate access code', submitError);
      setError('Não foi possível validar o código. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueWithoutLogin = () => {
    markSkipLogin();
    setStatus('granted');
  };

  if (status === 'granted' || !hasProtection) {
    return children;
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-2xl border border-primary/10 bg-surface px-6 py-4 text-sm text-text/70 shadow-sm">
          Verificando permissões…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-surface p-8 shadow-xl shadow-primary/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-text">Acesso Restrito</h1>
          <p className="mt-2 text-sm text-text/70">
            Este sistema é restrito. Informe o código de acesso fornecido pela administração.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="access-code" className="mb-2 block text-sm font-medium text-text">
              Código de acesso
            </label>
            <input
              id="access-code"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-lg border border-primary/20 bg-background px-4 py-2 text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
              placeholder="Digite o código"
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-text/80">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-primary/40 text-primary focus:ring-primary/30"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isSubmitting}
            />
            Lembrar deste dispositivo
          </label>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-75"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Validando…' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleContinueWithoutLogin}
            className="w-full rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={isSubmitting}
          >
            Continuar sem login
          </button>
        </form>
      </div>
    </div>
  );
};
