// English stopwords (PLAN §6.3): NLTK core plus web boilerplate.
// Tokens shorter than 3 characters never survive tokenization, so 1–2 letter
// words (a, an, in, is, to, ...) are omitted here on purpose.

import { SHORT_TOKEN_ALLOWLIST } from './config.js';

export const STOPWORDS_LIST = [
  // NLTK core
  'about', 'above', 'after', 'again', 'against', 'all', 'and', 'any', 'are', "aren't",
  'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'can', "can't",
  'cannot', 'could', "couldn't", 'did', "didn't", 'does', "doesn't", 'doing', "don't", 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have',
  "haven't", 'having', "he's", 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', "i'd", "i'll", "i'm", "i've", 'into', "isn't", "it's", 'its',
  'itself', 'more', 'most', 'myself', 'nor', 'not', 'off', 'once', 'only',
  'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
  "she's", 'should', "shouldn't", 'some', 'such', 'than', 'that', "that's",
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', "there's", 'these', 'they',
  "they're", "they've", 'this', 'those', 'through', 'too', 'under',
  'until', 'very', 'was', "wasn't", "we're", "we've", 'were', "weren't",
  'what', "what's", 'when', 'where', 'which', 'while', 'who', "who's",
  'whom', 'why', 'with', "won't", 'would', "wouldn't", 'you', "you'll",
  "you're", "you've", 'your', 'yours', 'yourself', 'yourselves',
  // Common function words not in the NLTK core
  'also', 'just', 'like', 'will', 'may', 'might', 'much', 'many', 'every', 'even', 'well',
  'however', 'yet', 'still', 'via', 'per', 'get', 'got', 'one', 'two',
  // Web boilerplate
  'click', 'read', 'learn', 'share', 'login', 'sign', 'menu', 'cookie', 'privacy', 'terms',
  'copyright', 'rights', 'reserved', 'skip', 'home', 'posted', 'updated', 'comments',
  'subscribe', 'newsletter', 'email', 'follow', 'view', 'next', 'previous', 'back', 'top',
];

export const STOPWORDS = new Set(STOPWORDS_LIST);
const SHORT_ALLOW = new Set(SHORT_TOKEN_ALLOWLIST);

// Tokens under 3 characters (of, to, in, ...) are dropped by the tokenizer; when they reach
// this function through hand-built spans they are treated as stopwords too.
export function isStopword(token, extra) {
  if (token.length < 3 && !SHORT_ALLOW.has(token)) return true;
  return STOPWORDS.has(token) || (extra ? extra.has(token) : false);
}

export function isPureNumber(token) {
  return /^[0-9]+$/.test(token);
}

// Parses a user-supplied stopword list (one per line or comma/space separated).
export function parseWordList(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
