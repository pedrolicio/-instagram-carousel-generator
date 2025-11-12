import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCarouselsFromStorage,
  saveCarouselsToStorageWithQuotaFallback
} from '../../services/storageService.js';

export const CAROUSEL_STORAGE_ERROR_MESSAGE =
  'Não foi possível salvar o histórico local. Remova alguns itens e tente novamente.';

export const CAROUSEL_STORAGE_WARNING_MESSAGE =
  'Histórico cheio: removemos os itens mais antigos para liberar espaço.';

const MAX_CAROUSEL_HISTORY = 20;

const CarouselsContext = createContext(undefined);

export const CarouselsProvider = ({ children }) => {
  const [carousels, setCarousels] = useState([]);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    const stored = getCarouselsFromStorage();
    const trimmed = stored.slice(0, MAX_CAROUSEL_HISTORY);
    const { success, persisted, removedCount } = saveCarouselsToStorageWithQuotaFallback(trimmed);

    if (success) {
      setCarousels(persisted);
      setStorageError(removedCount > 0 ? CAROUSEL_STORAGE_WARNING_MESSAGE : '');
      return;
    }

    setCarousels(trimmed);
    if (trimmed.length > 0) {
      setStorageError(CAROUSEL_STORAGE_ERROR_MESSAGE);
    }
  }, []);

  const persistCarousels = useCallback((updater) => {
    let didPersist = false;

    setCarousels((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      const normalized = Array.isArray(next) ? next : [];
      const trimmed = normalized.slice(0, MAX_CAROUSEL_HISTORY);
      const { success, persisted, removedCount } = saveCarouselsToStorageWithQuotaFallback(trimmed);

      if (!success) {
        setStorageError(CAROUSEL_STORAGE_ERROR_MESSAGE);
        didPersist = false;
        return previous;
      }

      setStorageError(removedCount > 0 ? CAROUSEL_STORAGE_WARNING_MESSAGE : '');
      didPersist = true;
      return persisted;
    });

    return didPersist;
  }, []);

  const addCarousel = useCallback((carousel) => persistCarousels((previous) => [carousel, ...previous]), [persistCarousels]);

  const updateCarousel = useCallback(
    (carouselId, patch) =>
      persistCarousels((previous) =>
        previous.map((carousel) => (carousel.id === carouselId ? { ...carousel, ...patch } : carousel))
      ),
    [persistCarousels]
  );

  const removeCarousel = useCallback(
    (carouselId) => persistCarousels((previous) => previous.filter((carousel) => carousel.id !== carouselId)),
    [persistCarousels]
  );

  const resetCarousels = useCallback(() => {
    setCarousels(() => {
      saveCarouselsToStorageWithQuotaFallback([]);
      return [];
    });
    setStorageError('');
  }, []);

  const value = useMemo(
    () => ({
      carousels,
      addCarousel,
      updateCarousel,
      removeCarousel,
      storageError,
      resetCarousels
    }),
    [carousels, addCarousel, updateCarousel, removeCarousel, storageError, resetCarousels]
  );

  return <CarouselsContext.Provider value={value}>{children}</CarouselsContext.Provider>;
};

export const useCarousels = () => {
  const context = useContext(CarouselsContext);

  if (!context) {
    throw new Error('useCarousels must be used inside a CarouselsProvider');
  }

  return context;
};
