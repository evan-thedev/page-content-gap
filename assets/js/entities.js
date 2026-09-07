// Entity-style terms (PLAN §6.5): capitalized multi-word sequences + a curated list. No NLP models.

import { CAPS } from './config.js';
import { splitSentences } from './tokenize.js';
import { isStopword } from './stopwords.js';

const CAP_TOKEN_RE = /^[A-Z][A-Za-z0-9'\-]*$/;
const CONNECTORS = new Set(['of', 'and', '&', 'the', 'for']);
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'\-]*|&/g;

function cleanToken(t) {
  return t.replace(/['\u2019]s$/i, '').replace(/^'+|'+$/g, '');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function boundaryRegex(phrase) {
  return new RegExp('(^|[^a-z0-9])' + escapeRegExp(phrase.toLowerCase()) + '(?=[^a-z0-9]|$)', 'g');
}

function countMatches(text, re) {
  let n = 0;
  re.lastIndex = 0;
  while (re.exec(text) !== null) n += 1;
  return n;
}

// Capitalized sequences of 2–4 capitalized tokens (connectors allowed inside).
// Heading blocks are skipped: Title Case headings are capitalized by convention, not
// because they name something, and produce systematic false positives.
export function capitalizedSequences(blocks, skipIndexes) {
  const found = new Map(); // key -> { count, nonStart, surfaces: Map }
  for (let b = 0; b < (blocks || []).length; b++) {
    if (skipIndexes && skipIndexes.has(b)) continue;
    const block = blocks[b];
    for (const sentence of splitSentences(String(block).replace(/[\u2019\u2018]/g, "'"))) {
      const words = (sentence.match(WORD_RE) || []).map(cleanToken).filter(Boolean);
      let i = 0;
      while (i < words.length) {
        if (!CAP_TOKEN_RE.test(words[i])) { i += 1; continue; }
        const start = i;
        const seq = [words[i]];
        let capCount = 1;
        let j = i + 1;
        while (j < words.length) {
          if (CAP_TOKEN_RE.test(words[j])) {
            seq.push(words[j]);
            capCount += 1;
            j += 1;
          } else if (CONNECTORS.has(words[j].toLowerCase()) && j + 1 < words.length && CAP_TOKEN_RE.test(words[j + 1])) {
            seq.push(words[j], words[j + 1]);
            capCount += 1;
            j += 2;
          } else {
            break;
          }
        }
        i = j;
        if (capCount < 2 || capCount > 4) continue;
        const capTokens = seq.filter((w) => !CONNECTORS.has(w.toLowerCase()));
        if (capTokens.every((w) => isStopword(w.toLowerCase()))) continue;
        const surface = seq.join(' ');
        const key = surface.toLowerCase();
        let e = found.get(key);
        if (!e) { e = { count: 0, nonStart: 0, surfaces: new Map() }; found.set(key, e); }
        e.count += 1;
        if (start !== 0) e.nonStart += 1;
        e.surfaces.set(surface, (e.surfaces.get(surface) || 0) + 1);
      }
    }
  }
  const out = new Map();
  for (const [key, e] of found) {
    if (e.count === 1 && e.nonStart === 0) continue; // once, and only at sentence start
    out.set(key, { count: e.count, surface: topSurface(e.surfaces), source: 'capitalized' });
  }
  return out;
}

function topSurface(surfaces) {
  let best = '';
  let bestCount = -1;
  for (const [s, c] of surfaces) if (c > bestCount) { best = s; bestCount = c; }
  return best;
}

// Curated list matched case-insensitively against lowercase text.
export function curatedMatches(blocks, curated) {
  const text = (blocks || []).join('\n').toLowerCase().replace(/[\u2019\u2018]/g, "'");
  const out = new Map();
  for (const entry of curated || []) {
    const c = countMatches(text, boundaryRegex(entry));
    if (c > 0) out.set(entry.toLowerCase(), { count: c, surface: entry, source: 'curated' });
  }
  return out;
}

// Union of both sources for one document. Curated wins on overlap (its count already
// includes the capitalized occurrences).
export function extractEntities(doc, curated) {
  const headingBlocks = new Set((doc.headings || []).map((h) => h.blockIndex).filter((i) => i != null));
  const result = capitalizedSequences(doc.blocks, headingBlocks);
  for (const [key, e] of curatedMatches(doc.blocks, curated)) result.set(key, e);
  return result;
}

function containsExcluded(key, exclusions) {
  if (!exclusions || !exclusions.size) return false;
  return key.split(/[^a-z0-9']+/).some((t) => exclusions.has(t));
}

// Entity gaps: present in >= 1 competitor, absent from your page (map or lowercase text).
export function entityGaps(yours, competitors, curated, options = {}) {
  const K = competitors.length;
  const yourEntities = extractEntities(yours, curated);
  const yourText = (yours.blocks || []).join('\n').toLowerCase().replace(/[\u2019\u2018]/g, "'");
  const rows = new Map();
  competitors.forEach((doc, i) => {
    for (const [key, e] of extractEntities(doc, curated)) {
      let row = rows.get(key);
      if (!row) {
        row = { key, surface: e.surface, surfaces: new Map(), source: e.source, unionCount: 0, cov: 0, K, perCompetitor: new Array(K).fill(0) };
        rows.set(key, row);
      }
      row.perCompetitor[i] = e.count;
      row.unionCount += e.count;
      row.cov += 1;
      row.surfaces.set(e.surface, (row.surfaces.get(e.surface) || 0) + e.count);
      if (e.source === 'curated') row.source = 'curated';
    }
  });
  const gaps = [];
  for (const row of rows.values()) {
    if (yourEntities.has(row.key)) continue;
    if (containsExcluded(row.key, options.exclusions)) continue;
    if (countMatches(yourText, boundaryRegex(row.key)) > 0) continue;
    row.surface = topSurface(row.surfaces);
    delete row.surfaces;
    gaps.push(row);
  }
  gaps.sort((a, b) => b.unionCount - a.unionCount || b.cov - a.cov || a.key.localeCompare(b.key));
  return { gaps: gaps.slice(0, CAPS.entityRows), total: gaps.length };
}
