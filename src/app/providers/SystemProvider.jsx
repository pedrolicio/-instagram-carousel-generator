import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { clearStorage } from '../../services/storageService.js';
import { useClients } from './ClientsProvider.jsx';
import { useCarousels } from './CarouselsProvider.jsx';
import { useApiKeys } from './ApiKeysProvider.jsx';
import { useSettings } from './SettingsProvider.jsx';

const SystemContext = createContext(undefined);

export const SystemProvider = ({ children }) => {
  const { resetClients } = useClients();
  const { resetCarousels } = useCarousels();
  const { resetApiKeys } = useApiKeys();
  const { resetSettings } = useSettings();

  const clearAllData = useCallback(() => {
    clearStorage();
    resetClients();
    resetCarousels();
    resetApiKeys();
    resetSettings();
  }, [resetClients, resetCarousels, resetApiKeys, resetSettings]);

  const value = useMemo(() => ({ clearAllData }), [clearAllData]);

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
};

export const useSystem = () => {
  const context = useContext(SystemContext);

  if (!context) {
    throw new Error('useSystem must be used inside a SystemProvider');
  }

  return context;
};
