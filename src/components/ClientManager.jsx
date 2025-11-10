import React, { useMemo, useState } from 'react';
import { Plus, Settings2, Trash2, UserCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext.jsx';
import { BrandKitForm } from './BrandKitForm.jsx';
import { v4 as uuidv4 } from 'uuid';
import { languageOptions, toneOptions } from '../utils/brandKitOptions.js';

const formatDate = (isoDate) => {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const ClientCard = ({ client, onEdit, onDelete, onGenerate }) => {
  const colors = client.brandIdentity?.colors ?? {};
  const toneValue = client.communication?.tone === 'custom' ? client.communication?.customTone : client.communication?.tone;
  const languageLabel = languageOptions.find((option) => option.value === client.communication?.language)?.label;
  const manualCount = client.brandIdentity?.brandManuals?.length ?? 0;
  const briefingCount = client.communication?.briefingFiles?.length ?? 0;
  const referenceUploads = client.brandIdentity?.visualReferences?.uploads?.length ?? 0;
  const referenceLinks = client.brandIdentity?.visualReferences?.links?.length ?? 0;
  const referencesCount = referenceUploads + referenceLinks;
  const chips = [];

  if (toneValue) {
    chips.push({ label: `Tom: ${toneValue}` });
  }

  if (languageLabel || client.communication?.language) {
    chips.push({ label: `Idioma: ${languageLabel ?? client.communication?.language}` });
  }

  if (manualCount > 0) {
    chips.push({ label: `${manualCount} manual${manualCount > 1 ? 's' : ''}` });
  }

  if (briefingCount > 0) {
    chips.push({ label: `${briefingCount} briefing${briefingCount > 1 ? 's' : ''}` });
  }

  if (referencesCount > 0) {
    chips.push({ label: `${referencesCount} referência${referencesCount > 1 ? 's' : ''} visual` });
  }
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm transition hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text">{client.clientName}</h3>
          <p className="text-sm text-text/60">Criado em {formatDate(client.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(client)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(client)}
            className="inline-flex items-center gap-1 rounded-full bg-error/10 px-3 py-1 text-xs font-medium text-error transition hover:bg-error/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            {chip.label}
          </span>
        ))}
      </div>

      {Object.keys(colors).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(colors).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <span className="text-xs font-semibold uppercase text-text/60">{key}</span>
              <span className="text-sm font-medium text-text">{value}</span>
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: value }} />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onGenerate(client)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
      >
        <UserCircle2 className="h-4 w-4" />
        Gerar Carrossel
      </button>
    </div>
  );
};

export const ClientManager = ({ onSelectClient }) => {
  const { clients, addClient, updateClient, removeClient } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt)),
    [clients]
  );

  const handleCreate = (brandKit) => {
    const now = new Date().toISOString();
    addClient({ ...brandKit, createdAt: now, updatedAt: now });
    setIsFormOpen(false);
  };

  const handleUpdate = (brandKit) => {
    updateClient(editingClient.id, brandKit);
    setEditingClient(null);
    setIsFormOpen(false);
  };

  const handleDelete = (client) => {
    if (window.confirm(`Deseja realmente remover o cliente ${client.clientName}?`)) {
      removeClient(client.id);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text">Gestão de Clientes</h2>
          <p className="text-sm text-text/70">Cadastre e mantenha os brand kits organizados por cliente.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingClient(null);
            setIsFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Adicionar Novo Cliente
        </button>
      </div>

      {isFormOpen && (
        <BrandKitForm
          key={editingClient?.id ?? 'new-client'}
          initialData={
            editingClient ?? {
              id: uuidv4(),
              clientName: '',
              brandIdentity: {
                colors: {},
                visualStyle: {},
                typography: {},
                visualElements: {},
                brandManuals: [],
                visualReferences: {
                  uploads: [],
                  links: [],
                  notes: ''
                }
              },
              communication: {
                tone: toneOptions[0].value,
                customTone: '',
                language: languageOptions[0].value,
                briefingFiles: [],
                briefingNotes: '',
                additionalNotes: ''
              },
              examples: {
                referenceUrls: [],
                successfulExamples: ''
              }
            }
          }
          onSubmit={(values) => (editingClient ? handleUpdate(values) : handleCreate(values))}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingClient(null);
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sortedClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onEdit={(item) => {
              setEditingClient(item);
              setIsFormOpen(true);
            }}
            onDelete={handleDelete}
            onGenerate={(clientItem) => onSelectClient?.(clientItem.id)}
          />
        ))}

        {sortedClients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-surface p-10 text-center text-text/70">
            Nenhum cliente cadastrado. Clique em "Adicionar Novo Cliente" para começar.
          </div>
        )}
      </div>
    </section>
  );
};
