import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getClientsFromStorage,
  saveClientsToStorage,
  getCarouselsFromStorage,
  saveCarouselsToStorage,
  getSettingsFromStorage,
  saveSettingsToStorage,
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
  getApiKeyStorageMetadata,
  rememberEncryptionSecret,
  getRememberedEncryptionSecret,
  clearRememberedEncryptionSecret,
  clearStorage
} from '../services/storageService.js';

const DEFAULT_SETTINGS = {
  anthropicTestMode: false
};

export const CAROUSEL_STORAGE_ERROR_MESSAGE =
  'Não foi possível salvar o histórico local. Remova alguns itens e tente novamente.';

const MAX_CAROUSEL_HISTORY = 20;

const AppContext = createContext(undefined);

export const AppProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [carouselStorageError, setCarouselStorageError] = useState('');
  const [apiKeys, setApiKeys] = useState({ anthropic: '', google: '' });
  const [apiKeysUnlocked, setApiKeysUnlocked] = useState(false);
  const [hasStoredApiKeys, setHasStoredApiKeys] = useState(false);
  const [apiKeysEncrypted, setApiKeysEncrypted] = useState(false);
  const [encryptionSecret, setEncryptionSecret] = useState('');
  const [rememberSecret, setRememberSecret] = useState(false);
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...getSettingsFromStorage() }));

  useEffect(() => {
    setClients(getClientsFromStorage());
    const storedCarousels = getCarouselsFromStorage();
    const limitedCarousels = storedCarousels.slice(0, MAX_CAROUSEL_HISTORY);
    setCarousels(limitedCarousels);
    saveCarouselsToStorage(limitedCarousels);
  }, []);

  useEffect(() => {
    saveClientsToStorage(clients);
  }, [clients]);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  const persistCarousels = useCallback(
    (updater) => {
      let didPersist = false;

      setCarousels((previous) => {
        const updated = typeof updater === 'function' ? updater(previous) : updater;
        const normalized = Array.isArray(updated) ? updated : [];
        const trimmed = normalized.slice(0, MAX_CAROUSEL_HISTORY);
        const saved = saveCarouselsToStorage(trimmed);

        if (!saved) {
          setCarouselStorageError(CAROUSEL_STORAGE_ERROR_MESSAGE);
          didPersist = false;
          return previous;
        }

        setCarouselStorageError('');
        didPersist = true;
        return trimmed;
      });

      return didPersist;
    },
    [setCarouselStorageError, saveCarouselsToStorage]
  );

  const addCarousel = useCallback((carousel) => persistCarousels((prev) => [carousel, ...prev]), [persistCarousels]);

  const updateCarousel = useCallback(
    (carouselId, patch) =>
      persistCarousels((prev) =>
        prev.map((carousel) => (carousel.id === carouselId ? { ...carousel, ...patch } : carousel))
      ),
    [persistCarousels]
  );

  const removeCarousel = useCallback(
    (carouselId) => persistCarousels((prev) => prev.filter((carousel) => carousel.id !== carouselId)),
    [persistCarousels]
  );

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
    setCarouselStorageError('');
    lockApiKeys();
    setHasStoredApiKeys(false);
    setApiKeysEncrypted(false);
    setSettings(DEFAULT_SETTINGS);
  }, [lockApiKeys, setCarouselStorageError]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

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
      addCarousel,
      updateCarousel,
      removeCarousel,
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      encryptionSecret,
      apiKeysEncrypted,
      rememberSecret,
      settings,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      clearAllData,
      updateSettings,
      carouselStorageError
    }),
    [
      clients,
      carousels,
      addCarousel,
      updateCarousel,
      removeCarousel,
      apiKeys,
      apiKeysUnlocked,
      hasStoredApiKeys,
      encryptionSecret,
      apiKeysEncrypted,
      rememberSecret,
      settings,
      persistApiKeys,
      unlockApiKeys,
      lockApiKeys,
      clearAllData,
      updateSettings,
      carouselStorageError
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
