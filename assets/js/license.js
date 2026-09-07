// Unlock state (PLAN §9, Option A). Stored in localStorage under UNLOCK_STORAGE_KEY.
// This is a convenience gate, not security: nothing client-side is.

import { UNLOCK_STORAGE_KEY, SESSION_ID_RE } from './config.js';

export function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_RE.test(id.trim());
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    /* access denied (e.g. blocked third-party storage) */
  }
  return memoryStorage();
}

export function createLicense(storage = defaultStorage(), key = UNLOCK_STORAGE_KEY) {
  function getUnlock() {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.ref) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function isUnlocked() {
    return getUnlock() !== null;
  }

  // Accepts a Stripe Checkout session id (cs_live_… / cs_test_…). Returns true on success.
  function setUnlock(ref) {
    const clean = typeof ref === 'string' ? ref.trim() : '';
    if (!isValidSessionId(clean)) return false;
    try {
      storage.setItem(key, JSON.stringify({ at: new Date().toISOString(), ref: clean }));
      return true;
    } catch {
      return false;
    }
  }

  function clearUnlock() {
    try { storage.removeItem(key); } catch { /* ignore */ }
  }

  return { getUnlock, isUnlocked, setUnlock, clearUnlock };
}

const shared = createLicense();
export const getUnlock = shared.getUnlock;
export const isUnlocked = shared.isUnlocked;
export const setUnlock = shared.setUnlock;
export const clearUnlock = shared.clearUnlock;
