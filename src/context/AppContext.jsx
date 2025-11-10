import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getClientsFromStorage,
  saveClientsToStorage,
  getCarouselsFromStorage,
  saveCarouselsToStorage,
  getApiKeysFromStorage,
  saveApiKeysToStorage
} from '../services/storageService.js';

const AppContext = createContext(undefined);

export const AppProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [apiKeys, setApiKeys] = useState({ anthropic: '', google: '' });

  useEffect(() => {
    setClients(getClientsFromStorage());
    setCarousels(getCarouselsFromStorage());
    setApiKeys(getApiKeysFromStorage());
  }, []);

  useEffect(() => {
    saveClientsToStorage(clients);
  }, [clients]);

  useEffect(() => {
    saveCarouselsToStorage(carousels);
  }, [carousels]);

  useEffect(() => {
    saveApiKeysToStorage(apiKeys);
  }, [apiKeys]);

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
      setApiKeys
    }),
    [clients, carousels, apiKeys]
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
