import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { extractHtml, extractText } from '../assets/js/extract.js';
import { analyze } from '../assets/js/analyze.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', name), 'utf8');
export const parseHtml = (html) => new JSDOM(html).window.document;

export function loadData() {
  return {
    entities: JSON.parse(fs.readFileSync(path.join(root, 'assets/data/entities.json'), 'utf8')),
    boilerplate: JSON.parse(fs.readFileSync(path.join(root, 'assets/data/boilerplate.json'), 'utf8')),
  };
}

// The §6.10 worked fixture: your standing-desk page vs competitors A (HTML), B, C (text).
export function loadFixtureDocs() {
  return {
    yours: extractText(fixture('yours.txt'), { label: 'Yours' }),
    competitors: [
      extractHtml(fixture('competitor-1.html'), { label: 'A', parse: parseHtml }),
      extractText(fixture('competitor-2.txt'), { label: 'B' }),
      extractText(fixture('competitor-3.txt'), { label: 'C' }),
    ],
  };
}

export function analyzeFixture(settings = {}) {
  const { yours, competitors } = loadFixtureDocs();
  return analyze({ yours, competitors, settings, data: loadData() });
}

export function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
