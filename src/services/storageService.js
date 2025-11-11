const STORAGE_KEYS = {
  clients: 'icg.clients',
  carousels: 'icg.carousels',
  apiKeys: 'icg.apiKeys',
  settings: 'icg.settings'
};

const DEFAULT_SETTINGS = {
  anthropicTestMode: false
};

const SECRET_SESSION_KEY = 'icg.apiSecret';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const hasCryptoSupport = () => {
  if (typeof window === 'undefined') return false;
  const crypto = window.crypto || window.msCrypto;
  return Boolean(crypto?.subtle && typeof crypto.getRandomValues === 'function');
};

const getCrypto = () => {
  if (typeof window === 'undefined') return undefined;
  return window.crypto || window.msCrypto;
};

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

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

const toBase64 = (buffer) => {
  if (!buffer?.byteLength) return '';
  const binary = String.fromCharCode(...buffer);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary);
  }

  return Buffer.from(binary, 'binary').toString('base64');
};

const fromBase64 = (value) => {
  if (!value) return new Uint8Array();
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  const buffer = Buffer.from(value, 'base64');
  return new Uint8Array(buffer);
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
  if (!isBrowser) return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[storage] Failed to write key ${key}`, error);
    return false;
  }
};

const readSession = (key, fallback = '') => {
  if (typeof window === 'undefined' || !window.sessionStorage) return fallback;
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error(`[storage] Failed to read session key ${key}`, error);
    return fallback;
  }
};

const writeSession = (key, value) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.error(`[storage] Failed to persist session key ${key}`, error);
  }
};

const deriveKey = async (secret, salt) => {
  if (!secret) {
    throw new Error('Encryption secret is required');
  }

  const crypto = getCrypto();
  if (!crypto?.subtle || !encoder) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey'
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptWithSecret = async (secret, value) => {
  if (!hasCryptoSupport()) {
    throw new Error('Web Crypto API not available to encrypt data');
  }

  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secret, salt);
  const encoded = encoder.encode(JSON.stringify(value));
  const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    version: 1,
    iv: toBase64(new Uint8Array(iv)),
    salt: toBase64(new Uint8Array(salt)),
    ciphertext: toBase64(new Uint8Array(encryptedBuffer))
  };
};

const decryptWithSecret = async (secret, payload) => {
  if (!hasCryptoSupport()) {
    throw new Error('Web Crypto API not available to decrypt data');
  }

  const crypto = getCrypto();
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const key = await deriveKey(secret, salt);
  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const decoded = decoder?.decode(decryptedBuffer) ?? Buffer.from(decryptedBuffer).toString('utf-8');
  return JSON.parse(decoded);
};

export const getClientsFromStorage = () => readStorage(STORAGE_KEYS.clients, []);
export const saveClientsToStorage = (clients) => writeStorage(STORAGE_KEYS.clients, clients);

const BASE64_IMAGE_MIN_LENGTH = 512;
const BASE64_IMAGE_REGEX = /^[A-Za-z0-9+/=\s]+$/;

const isLikelyBase64Image = (value) => {
  if (typeof value !== 'string' || !value) {
    return false;
  }

  if (value.startsWith('http') || value.startsWith('blob:')) {
    return false;
  }

  if (value.startsWith('data:')) {
    return true;
  }

  const trimmed = value.trim();
  if (trimmed.length < BASE64_IMAGE_MIN_LENGTH) {
    return false;
  }

  return BASE64_IMAGE_REGEX.test(trimmed);
};

const sanitizeCarouselImage = (image) => {
  if (!image || typeof image !== 'object') {
    return {
      slideNumber: image?.slideNumber ?? null,
      status: 'pending',
      imageUrl: null
    };
  }

  const rawUrl = typeof image.imageUrl === 'string' ? image.imageUrl : null;
  const imageUrl = isLikelyBase64Image(rawUrl) ? null : rawUrl;

  return {
    slideNumber: image.slideNumber,
    status: image.status ?? (imageUrl ? 'generated' : 'pending'),
    imageUrl: imageUrl ?? null
  };
};

const sanitizeCarouselForStorage = (carousel) => {
  if (!carousel || typeof carousel !== 'object') {
    return carousel;
  }

  const images = Array.isArray(carousel.images)
    ? carousel.images.map((image) => sanitizeCarouselImage(image))
    : [];

  return {
    ...carousel,
    images
  };
};

const sanitizeCarouselsForStorage = (carousels) => {
  if (!Array.isArray(carousels)) {
    return [];
  }

  return carousels.map((carousel) => sanitizeCarouselForStorage(carousel));
};

export const getCarouselsFromStorage = () => sanitizeCarouselsForStorage(readStorage(STORAGE_KEYS.carousels, []));
export const saveCarouselsToStorage = (carousels) => writeStorage(STORAGE_KEYS.carousels, sanitizeCarouselsForStorage(carousels));

export const getSettingsFromStorage = () => readStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
export const saveSettingsToStorage = (settings) =>
  writeStorage(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, ...settings });

export const getApiKeyStorageMetadata = () => {
  const stored = readStorage(STORAGE_KEYS.apiKeys, null);
  const encrypted = Boolean(stored?.ciphertext && stored?.iv && stored?.salt);
  const legacy = Boolean(stored?.anthropic || stored?.google);

  return {
    hasAny: encrypted || legacy,
    encrypted
  };
};

export const loadApiKeysFromStorage = async (secret) => {
  const stored = readStorage(STORAGE_KEYS.apiKeys, null);
  if (!stored) {
    return { anthropic: '', google: '' };
  }

  if (stored?.ciphertext && stored?.iv && stored?.salt) {
    if (!secret) {
      throw new Error('Encryption secret required to read API keys');
    }

    try {
      const decrypted = await decryptWithSecret(secret, stored);
      return {
        anthropic: decrypted?.anthropic ?? '',
        google: decrypted?.google ?? ''
      };
    } catch (error) {
      console.error('[storage] Failed to decrypt API keys', error);
      throw error;
    }
  }

  // Backwards compatibility with previous base64 storage
  const anthropic = stored?.anthropic ?? '';
  const google = stored?.google ?? '';
  return {
    anthropic: anthropic ? safeAtob(anthropic) : '',
    google: google ? safeAtob(google) : ''
  };
};

export const saveApiKeysToStorage = async (keys, secret) => {
  if (!secret) {
    throw new Error('Encryption secret required to save API keys');
  }

  const payload = await encryptWithSecret(secret, {
    anthropic: keys?.anthropic ?? '',
    google: keys?.google ?? ''
  });

  writeStorage(STORAGE_KEYS.apiKeys, payload);
};

export const getRememberedEncryptionSecret = () => readSession(SECRET_SESSION_KEY);

export const rememberEncryptionSecret = (secret) => writeSession(SECRET_SESSION_KEY, secret);

export const clearRememberedEncryptionSecret = () => writeSession(SECRET_SESSION_KEY, '');

export const clearStorage = () => {
  if (!isBrowser) return;
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
  clearRememberedEncryptionSecret();
};

export const __internal = {
  readStorage,
  writeStorage,
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
  getApiKeyStorageMetadata,
  rememberEncryptionSecret,
  getRememberedEncryptionSecret,
  clearRememberedEncryptionSecret,
  getSettingsFromStorage,
  saveSettingsToStorage,
  STORAGE_KEYS,
  DEFAULT_SETTINGS
};
