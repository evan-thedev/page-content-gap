// Tokenizer (PLAN §6.2). Pure, deterministic, no stemming.

import { SHORT_TOKEN_ALLOWLIST } from './config.js';

const TOKEN_RE = /[a-z0-9']+/g;
const DEFAULT_ALLOWLIST = new Set(SHORT_TOKEN_ALLOWLIST);

export function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/[\u2019\u2018]/g, "'");
}

// Splits a block into sentences on . ! ? followed by whitespace or end of text.
export function splitSentences(block) {
  return String(block ?? '')
    .split(/[.!?]+(?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tokenizeSentence(sentence, opts = {}) {
  const allow = opts.allowlist ? new Set(opts.allowlist) : DEFAULT_ALLOWLIST;
  const out = [];
  const matches = normalize(sentence).match(TOKEN_RE) || [];
  for (const raw of matches) {
    const t = raw.replace(/^'+|'+$/g, '');
    if (!t) continue;
    if (t.length < 3 && !allow.has(t)) continue;
    out.push(t);
  }
  return out;
}

// Returns an array of sentence spans (arrays of tokens) for one block.
export function tokenizeBlock(block, opts) {
  return splitSentences(block)
    .map((s) => tokenizeSentence(s, opts))
    .filter((tokens) => tokens.length > 0);
}

// Flattens all blocks into sentence spans. N-grams never cross a span.
export function tokenizeBlocks(blocks, opts) {
  const spans = [];
  for (const block of blocks || []) {
    for (const span of tokenizeBlock(block, opts)) spans.push(span);
  }
  return spans;
}

// Raw word count (whitespace-separated), used for the word-count display.
export function countWords(blocks) {
  let n = 0;
  for (const block of blocks || []) {
    const m = String(block).match(/\S+/g);
    if (m) n += m.length;
  }
  return n;
}
