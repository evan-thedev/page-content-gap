// Local scenarios (PLAN §5 Flow C step 5): inputs + settings saved in localStorage only.

import { CAPS, SCENARIOS_STORAGE_KEY } from './config.js';

const SCHEMA = 'pcg-scenarios/1';

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
  } catch { /* ignore */ }
  return memoryStorage();
}

function newId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitizeScenario(s) {
  if (!s || typeof s !== 'object') return null;
  const name = String(s.name || '').trim().slice(0, 80);
  if (!name) return null;
  const inputs = Array.isArray(s.inputs) ? s.inputs.slice(0, 4).map((d) => ({
    label: String(d?.label || '').slice(0, 80),
    mode: d?.mode === 'html' ? 'html' : 'text',
    text: String(d?.text || ''),
  })) : [];
  const settings = s.settings && typeof s.settings === 'object' ? {
    extraStopwords: String(s.settings.extraStopwords || ''),
    exclusions: String(s.settings.exclusions || ''),
    detectHeadings: s.settings.detectHeadings !== false,
  } : { extraStopwords: '', exclusions: '', detectHeadings: true };
  return {
    id: typeof s.id === 'string' && s.id ? s.id : newId(),
    name,
    savedAt: typeof s.savedAt === 'string' ? s.savedAt : new Date().toISOString(),
    inputs,
    settings,
  };
}

export function createScenarioStore(storage = defaultStorage(), { key = SCENARIOS_STORAGE_KEY, max = CAPS.scenarios } = {}) {
  function readAll() {
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.scenarios) ? parsed.scenarios : [];
      return list.map(sanitizeScenario).filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    storage.setItem(key, JSON.stringify({ schema: SCHEMA, scenarios: list }));
  }

  function list() {
    return readAll().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }

  // Saves a new scenario or overwrites one with the same name. Throws when full.
  function save({ name, inputs, settings }) {
    const all = readAll();
    const clean = sanitizeScenario({ name, inputs, settings });
    if (!clean) throw new Error('Scenario needs a name.');
    const existing = all.findIndex((s) => s.name.toLowerCase() === clean.name.toLowerCase());
    if (existing >= 0) {
      clean.id = all[existing].id;
      all[existing] = clean;
    } else {
      if (all.length >= max) throw new Error(`Limit of ${max} scenarios reached. Delete one first.`);
      all.push(clean);
    }
    writeAll(all);
    return clean;
  }

  function get(id) {
    return readAll().find((s) => s.id === id) || null;
  }

  function rename(id, name) {
    const all = readAll();
    const s = all.find((x) => x.id === id);
    if (!s) return null;
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean) throw new Error('Name cannot be empty.');
    s.name = clean;
    writeAll(all);
    return s;
  }

  function remove(id) {
    const all = readAll();
    const next = all.filter((s) => s.id !== id);
    writeAll(next);
    return all.length !== next.length;
  }

  function exportJSON() {
    return JSON.stringify({ schema: SCHEMA, exportedAt: new Date().toISOString(), scenarios: readAll() }, null, 2);
  }

  // Merges imported scenarios (by name). Returns the number imported.
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Not valid JSON.'); }
    const incoming = (Array.isArray(parsed) ? parsed : parsed?.scenarios || []).map(sanitizeScenario).filter(Boolean);
    if (!incoming.length) throw new Error('No scenarios found in that file.');
    const all = readAll();
    let count = 0;
    for (const s of incoming) {
      const idx = all.findIndex((x) => x.name.toLowerCase() === s.name.toLowerCase());
      if (idx >= 0) { s.id = all[idx].id; all[idx] = s; count += 1; continue; }
      if (all.length >= max) break;
      s.id = newId();
      all.push(s);
      count += 1;
    }
    writeAll(all);
    return count;
  }

  return { list, save, get, rename, remove, exportJSON, importJSON, max };
}
