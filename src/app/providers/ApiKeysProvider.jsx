import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
  getApiKeyStorageMetadata,
  rememberEncryptionSecret,
  getRememberedEncryptionSecret,
  clearRememberedEncryptionSecret
} from '../../services/storageService.js';

const EMPTY_KEYS = { anthropic: '', google: '' };

const ApiKeysContext = createContext(undefined);

export const ApiKeysProvider = ({ children }) => {
  const [apiKeys, setApiKeys] = useState(EMPTY_KEYS);
  const [apiKeysUnlocked, setApiKeysUnlocked] = useState(false);
  const [hasStoredApiKeys, setHasStoredApiKeys] = useState(false);
  const [apiKeysEncrypted, setApiKeysEncrypted] = useState(false);
  const [encryptionSecret, setEncryptionSecret] = useState('');
  const [rememberSecret, setRememberSecret] = useState(false);

  useEffect(() => {
    let active = true;

    const metadata = getApiKeyStorageMetadata();
    if (!active) return;
    setHasStoredApiKeys(metadata.hasAny);
    setApiKeysEncrypted(metadata.encrypted);

    const remembered = getRememberedEncryptionSecret();
    if (!metadata.hasAny || !remembered) {
      return () => {
        active = false;
      };
    }

    loadApiKeysFromStorage(remembered)
      .then((keys) => {
        if (!active) return;
        setApiKeys(keys);
        setEncryptionSecret(remembered);
        setApiKeysUnlocked(true);
        setRememberSecret(true);
      })
      .catch((error) => {
        console.error('[ApiKeysProvider] Failed to unlock stored keys automatically', error);
        clearRememberedEncryptionSecret();
        if (!active) return;
        setApiKeys(EMPTY_KEYS);
        setEncryptionSecret('');
        setApiKeysUnlocked(false);
        setRememberSecret(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistApiKeys = useCallback(async ({ keys, secret, remember }) => {
    await saveApiKeysToStorage(keys, secret);
    setApiKeys(keys);
    setEncryptionSecret(secret);
    setApiKeysUnlocked(true);
    setHasStoredApiKeys(true);
    setApiKeysEncrypted(true);

    if (remember && secret) {
      rememberEncryptionSecret(secret);
      setRememberSecret(true);
    } else {
      clearRememberedEncryptionSecret();
      setRememberSecret(false);
    }
  }, []);

  const unlockApiKeys = useCallback(
    async ({ secret, remember }) => {
      const keys = await loadApiKeysFromStorage(secret);
      setApiKeys(keys);
      setEncryptionSecret(secret);
      setApiKeysUnlocked(true);
      const metadata = getApiKeyStorageMetadata();
      setHasStoredApiKeys(metadata.hasAny);
      setApiKeysEncrypted(metadata.encrypted);

      if (remember && secret) {
        rememberEncryptionSecret(secret);
        setRememberSecret(true);
      } else {
        clearRememberedEncryptionSecret();
        setRememberSecret(false);
      }

      return keys;
    },
    []
  );

  const lockApiKeys = useCallback(() => {
    setApiKeys(EMPTY_KEYS);
    setEncryptionSecret('');
    setApiKeysUnlocked(false);
    setRememberSecret(false);
  }, []);

  const resetApiKeys = useCallback(() => {
    setApiKeys(EMPTY_KEYS);
    setEncryptionSecret('');
    setApiKeysUnlocked(false);
    setHasStoredApiKeys(false);
    setApiKeysEncrypted(false);
    setRememberSecret(false);
    clearRememberedEncryptionSecret();
  }, []);

  const value = useMemo(
    () => ({
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      apiKeysEncrypted,
      encryptionSecret,
      rememberSecret,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      resetApiKeys
    }),
    [
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      apiKeysEncrypted,
      encryptionSecret,
      rememberSecret,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      resetApiKeys
    ]
  );

  return <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>;
};

export const useApiKeys = () => {
  const context = useContext(ApiKeysContext);

  if (!context) {
    throw new Error('useApiKeys must be used inside an ApiKeysProvider');
  }

  return context;
};
