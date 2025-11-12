import React from 'react';
import { ClientsProvider } from './ClientsProvider.jsx';
import { CarouselsProvider } from './CarouselsProvider.jsx';
import { SettingsProvider } from './SettingsProvider.jsx';
import { ApiKeysProvider } from './ApiKeysProvider.jsx';
import { SystemProvider } from './SystemProvider.jsx';

export const AppProvider = ({ children }) => (
  <ClientsProvider>
    <CarouselsProvider>
      <SettingsProvider>
        <ApiKeysProvider>
          <SystemProvider>{children}</SystemProvider>
        </ApiKeysProvider>
      </SettingsProvider>
    </CarouselsProvider>
  </ClientsProvider>
);
