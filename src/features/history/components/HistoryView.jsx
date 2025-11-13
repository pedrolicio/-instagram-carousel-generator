import React, { useMemo, useState } from 'react';
import { Download, Recycle, Trash2 } from 'lucide-react';
import { useClients } from '../../../app/providers/ClientsProvider.jsx';
import { useCarousels } from '../../../app/providers/CarouselsProvider.jsx';

const sanitizeFileSegment = (value) => {
  if (!value) {
    return 'carrossel';
  }

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const sanitized = normalized
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'carrossel';
};

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export const HistoryView = ({ onSelectClient, onOpenGenerator }) => {
  const { clients } = useClients();
  const { carousels, removeCarousel, storageError } = useCarousels();
  const [clientFilter, setClientFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filteredCarousels = useMemo(() => {
    return carousels.filter((carousel) => {
      if (clientFilter !== 'all' && carousel.clientId !== clientFilter) {
        return false;
      }
      if (query && !carousel.theme.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [carousels, clientFilter, query]);

  const handleDelete = (carousel) => {
    if (window.confirm(`Remover o carrossel "${carousel.theme}"?`)) {
      removeCarousel(carousel.id);
    }
  };

  const handleDownloadJson = (carousel) => {
    const blob = new Blob([JSON.stringify(carousel, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileSegment(carousel.theme)}-carrossel.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text">Histórico de Carrosséis</h2>
          <p className="text-sm text-text/70">Revisite, baixe ou regenere carrosséis criados anteriormente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm"
          >
            <option value="all">Todos os clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.clientName}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar por tema"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm"
          />
        </div>
      </header>

      {storageError && (
        <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">{storageError}</div>
      )}

      <div className="grid gap-4">
        {filteredCarousels.map((carousel) => {
          const client = clients.find((item) => item.id === carousel.clientId);
          return (
            <div key={carousel.id} className="rounded-2xl border border-primary/10 bg-surface p-6 shadow-sm">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-text">{carousel.theme}</h3>
                  <p className="text-sm text-text/70">{client?.clientName ?? 'Cliente removido'} • {formatDateTime(carousel.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectClient?.(carousel.clientId);
                      onOpenGenerator?.();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    <Recycle className="h-4 w-4" />
                    Regenerar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJson(carousel)}
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2 text-xs font-semibold text-secondary transition hover:bg-secondary/20"
                  >
                    <Download className="h-4 w-4" />
                    Baixar JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(carousel)}
                    className="inline-flex items-center gap-2 rounded-lg bg-error/10 px-4 py-2 text-xs font-semibold text-error transition hover:bg-error/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </header>

              <div className="grid gap-3 md:grid-cols-2">
                {carousel.content.slides.slice(0, 2).map((slide) => (
                  <div key={slide.slideNumber} className="rounded-xl border border-primary/10 bg-background px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">Slide {slide.slideNumber}</span>
                    <h4 className="text-sm font-semibold text-text">{slide.title}</h4>
                    <p className="text-xs text-text/70">{slide.body}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredCarousels.length === 0 && (
          <div className="rounded-2xl border border-dashed border-primary/20 bg-surface p-10 text-center text-text/70">
            Nenhum carrossel encontrado para os filtros selecionados.
          </div>
        )}
      </div>
    </section>
  );
};
