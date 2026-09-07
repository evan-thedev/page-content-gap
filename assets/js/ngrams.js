// N-gram counting (PLAN §6.4) under the stopword / exclusion / boilerplate rules of §6.3.

import { MAX_N } from './config.js';
import { isStopword, isPureNumber } from './stopwords.js';

export function ngramSize(term) {
  return term.split(' ').length;
}

// A gram is eligible when neither its first nor its last token is a stopword or a pure
// number, no token is excluded, and the phrase is not a boilerplate phrase.
export function isEligibleGram(tokens, rules) {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (isStopword(first, rules.extraStopwords) || isPureNumber(first)) return false;
  if (isStopword(last, rules.extraStopwords) || isPureNumber(last)) return false;
  if (rules.exclusions && rules.exclusions.size) {
    for (const t of tokens) if (rules.exclusions.has(t)) return false;
  }
  return true;
}

export function makeRules({ extraStopwords, exclusions, boilerplate } = {}) {
  return {
    extraStopwords: extraStopwords instanceof Set ? extraStopwords : new Set(extraStopwords || []),
    exclusions: exclusions instanceof Set ? exclusions : new Set(exclusions || []),
    boilerplate: boilerplate instanceof Set ? boilerplate : new Set(boilerplate || []),
  };
}

// spans: string[][] (sentence spans). Returns Map<term, count> for 1..maxN grams.
export function countNgrams(spans, rulesIn = {}, maxN = MAX_N) {
  const rules = rulesIn.extraStopwords instanceof Set ? rulesIn : makeRules(rulesIn);
  const counts = new Map();
  for (const span of spans) {
    const L = span.length;
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= L; i++) {
        const tokens = span.slice(i, i + n);
        if (!isEligibleGram(tokens, rules)) continue;
        const term = tokens.join(' ');
        if (rules.boilerplate.has(term)) continue;
        counts.set(term, (counts.get(term) || 0) + 1);
      }
    }
  }
  return counts;
}

// All contiguous 1..maxN grams of a span with no eligibility filtering.
// Used for heading containment lookups.
export function rawGrams(span, maxN = MAX_N) {
  const out = [];
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i + n <= span.length; i++) out.push(span.slice(i, i + n).join(' '));
  }
  return out;
}
