import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getSettingsFromStorage, saveSettingsToStorage } from '../../services/storageService.js';

const DEFAULT_SETTINGS = {
  anthropicTestMode: false
};

const SettingsContext = createContext(undefined);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...getSettingsFromStorage() }));

  const updateSettings = useCallback((patch) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      saveSettingsToStorage(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(() => {
      saveSettingsToStorage(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }

  return context;
};
