import React, { useMemo, useState } from 'react';
import { BrainCircuit, GalleryHorizontal, History, Settings, Users } from 'lucide-react';
import { ClientManager } from './features/clients/components/ClientManager.jsx';
import { CarouselGenerator } from './features/carousels/components/CarouselGenerator.jsx';
import { HistoryView } from './features/history/components/HistoryView.jsx';
import { ApiKeySettings } from './features/api-keys/components/ApiKeySettings.jsx';
import { useClients } from './app/providers/ClientsProvider.jsx';

const TABS = {
  clients: {
    id: 'clients',
    label: 'Clientes',
    icon: Users
  },
  generator: {
    id: 'generator',
    label: 'Gerar Carrossel',
    icon: BrainCircuit
  },
  history: {
    id: 'history',
    label: 'Histórico',
    icon: History
  },
  settings: {
    id: 'settings',
    label: 'Configurações',
    icon: Settings
  }
};

const TabButton = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-surface text-text hover:bg-primary/10'
      }`}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </button>
  );
};

export default function App() {
  const { clients } = useClients();
  const [activeTab, setActiveTab] = useState(TABS.clients.id);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId) ?? null, [
    clients,
    selectedClientId
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-primary/10 bg-surface shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <GalleryHorizontal className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-text">Gerador de Carrosséis Instagram</h1>
              <p className="text-sm text-text/70">Multi-cliente, alimentado por IA, com consistência visual garantida.</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            {Object.values(TABS).map((tab) => (
              <TabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {activeTab === TABS.clients.id && (
          <ClientManager
            onSelectClient={(clientId) => {
              setSelectedClientId(clientId);
              setActiveTab(TABS.generator.id);
            }}
          />
        )}

        {activeTab === TABS.generator.id && (
          <CarouselGenerator selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
        )}

        {activeTab === TABS.history.id && (
          <HistoryView onSelectClient={setSelectedClientId} onOpenGenerator={() => setActiveTab(TABS.generator.id)} />
        )}

        {activeTab === TABS.settings.id && <ApiKeySettings />}
      </main>
    </div>
  );
}
