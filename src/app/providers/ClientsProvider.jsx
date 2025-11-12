import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getClientsFromStorage, saveClientsToStorage } from '../../services/storageService.js';

const ClientsContext = createContext(undefined);

export const ClientsProvider = ({ children }) => {
  const [clients, setClients] = useState(() => getClientsFromStorage());

  const addClient = useCallback((client) => {
    setClients((previous) => {
      const next = [...previous, client];
      saveClientsToStorage(next);
      return next;
    });
  }, []);

  const updateClient = useCallback((clientId, patch) => {
    setClients((previous) => {
      const next = previous.map((client) =>
        client.id === clientId ? { ...client, ...patch, updatedAt: new Date().toISOString() } : client
      );
      saveClientsToStorage(next);
      return next;
    });
  }, []);

  const removeClient = useCallback((clientId) => {
    setClients((previous) => {
      const next = previous.filter((client) => client.id !== clientId);
      saveClientsToStorage(next);
      return next;
    });
  }, []);

  const resetClients = useCallback(() => {
    setClients(() => {
      saveClientsToStorage([]);
      return [];
    });
  }, []);

  const value = useMemo(
    () => ({ clients, addClient, updateClient, removeClient, resetClients }),
    [clients, addClient, updateClient, removeClient, resetClients]
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
};

export const useClients = () => {
  const context = useContext(ClientsContext);

  if (!context) {
    throw new Error('useClients must be used inside a ClientsProvider');
  }

  return context;
};
