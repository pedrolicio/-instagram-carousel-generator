import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getClientsFromStorage,
  saveClientsToStorage,
  getCarouselsFromStorage,
  saveCarouselsToStorage,
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
  getApiKeyStorageMetadata,
  rememberEncryptionSecret,
  getRememberedEncryptionSecret,
  clearRememberedEncryptionSecret,
  clearStorage
} from '../services/storageService.js';

const AppContext = createContext(undefined);

export const AppProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [apiKeys, setApiKeys] = useState({ anthropic: '', google: '' });
  const [apiKeysUnlocked, setApiKeysUnlocked] = useState(false);
  const [hasStoredApiKeys, setHasStoredApiKeys] = useState(false);
  const [apiKeysEncrypted, setApiKeysEncrypted] = useState(false);
  const [encryptionSecret, setEncryptionSecret] = useState('');
  const [rememberSecret, setRememberSecret] = useState(false);

  useEffect(() => {
    setClients(getClientsFromStorage());
    setCarousels(getCarouselsFromStorage());
  }, []);

  useEffect(() => {
    saveClientsToStorage(clients);
  }, [clients]);

  useEffect(() => {
    saveCarouselsToStorage(carousels);
  }, [carousels]);

  useEffect(() => {
    let isMounted = true;

    const initializeApiKeys = async () => {
      const metadata = getApiKeyStorageMetadata();
      if (isMounted) {
        setHasStoredApiKeys(metadata.hasAny);
        setApiKeysEncrypted(metadata.encrypted);
      }

      const remembered = getRememberedEncryptionSecret();
      if (!metadata.hasAny || !remembered) {
        return;
      }

      try {
        const decrypted = await loadApiKeysFromStorage(remembered);
        if (!isMounted) return;
        setApiKeys(decrypted);
        setEncryptionSecret(remembered);
        setApiKeysUnlocked(true);
        setRememberSecret(true);
      } catch (error) {
        console.error('[AppContext] Failed to auto unlock API keys', error);
        clearRememberedEncryptionSecret();
        if (!isMounted) return;
        setApiKeys({ anthropic: '', google: '' });
        setEncryptionSecret('');
        setApiKeysUnlocked(false);
        setRememberSecret(false);
      }
    };

    initializeApiKeys();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistApiKeys = useCallback(
    async ({ keys, secret, remember }) => {
      await saveApiKeysToStorage(keys, secret);
      setApiKeys(keys);
      setHasStoredApiKeys(true);
      setApiKeysEncrypted(true);
      setEncryptionSecret(secret);
      setApiKeysUnlocked(true);

      if (remember && secret) {
        rememberEncryptionSecret(secret);
        setRememberSecret(true);
      } else {
        clearRememberedEncryptionSecret();
        setRememberSecret(false);
      }
    },
    []
  );

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
    setApiKeys({ anthropic: '', google: '' });
    setEncryptionSecret('');
    setApiKeysUnlocked(false);
    setApiKeysEncrypted(false);
    clearRememberedEncryptionSecret();
    setRememberSecret(false);
  }, []);

  const clearAllData = useCallback(() => {
    clearStorage();
    setClients([]);
    setCarousels([]);
    lockApiKeys();
    setHasStoredApiKeys(false);
    setApiKeysEncrypted(false);
  }, [lockApiKeys]);

  const value = useMemo(
    () => ({
      clients,
      addClient: (client) => setClients((prev) => [...prev, client]),
      updateClient: (clientId, patch) =>
        setClients((prev) =>
          prev.map((client) => (client.id === clientId ? { ...client, ...patch, updatedAt: new Date().toISOString() } : client))
        ),
      removeClient: (clientId) => setClients((prev) => prev.filter((client) => client.id !== clientId)),
      carousels,
      addCarousel: (carousel) => setCarousels((prev) => [carousel, ...prev]),
      updateCarousel: (carouselId, patch) =>
        setCarousels((prev) => prev.map((carousel) => (carousel.id === carouselId ? { ...carousel, ...patch } : carousel))),
      removeCarousel: (carouselId) => setCarousels((prev) => prev.filter((carousel) => carousel.id !== carouselId)),
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      encryptionSecret,
      apiKeysEncrypted,
      rememberSecret,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      clearAllData
    }),
    [
      clients,
      carousels,
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      encryptionSecret,
      apiKeysEncrypted,
      rememberSecret,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      clearAllData
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside an AppProvider');
  }

  return context;
};
