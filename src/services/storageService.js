const STORAGE_KEYS = {
  clients: 'icg.clients',
  carousels: 'icg.carousels',
  apiKeys: 'icg.apiKeys'
};

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeBtoa = (value) => {
  if (!value) return '';
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }

  return Buffer.from(value, 'utf-8').toString('base64');
};

const safeAtob = (value) => {
  if (!value) return '';
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(value);
  }

  return Buffer.from(value, 'base64').toString('utf-8');
};

const readStorage = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (error) {
    console.error(`[storage] Failed to read key ${key}`, error);
    return fallback;
  }
};

const writeStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[storage] Failed to write key ${key}`, error);
  }
};

export const getClientsFromStorage = () => readStorage(STORAGE_KEYS.clients, []);
export const saveClientsToStorage = (clients) => writeStorage(STORAGE_KEYS.clients, clients);

export const getCarouselsFromStorage = () => readStorage(STORAGE_KEYS.carousels, []);
export const saveCarouselsToStorage = (carousels) => writeStorage(STORAGE_KEYS.carousels, carousels);

export const getApiKeysFromStorage = () => {
  const stored = readStorage(STORAGE_KEYS.apiKeys, { anthropic: '', google: '' });
  return {
    anthropic: safeAtob(stored?.anthropic ?? ''),
    google: safeAtob(stored?.google ?? '')
  };
};

export const saveApiKeysToStorage = (keys) => {
  writeStorage(STORAGE_KEYS.apiKeys, {
    anthropic: safeBtoa(keys?.anthropic ?? ''),
    google: safeBtoa(keys?.google ?? '')
  });
};

export const clearStorage = () => {
  if (!isBrowser) return;
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
};

export const __internal = { readStorage, writeStorage, safeAtob, safeBtoa, STORAGE_KEYS };
