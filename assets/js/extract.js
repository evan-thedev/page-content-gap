// Document extraction (PLAN §6.1). HTML via DOMParser (or an injected parser for tests);
// plain text with optional heading detection.

import { CAPS } from './config.js';
import { countWords } from './tokenize.js';
import { STOPWORDS } from './stopwords.js';

const REMOVE_SELECTOR =
  'script, style, noscript, template, svg, iframe, canvas, nav, footer, form, ' +
  '[role=navigation], [aria-hidden=true], [hidden]';
const CHROME_RE = /(^|[-_ ])(nav|menu|footer|sidebar|cookie|breadcrumb|share|comments?)([-_ ]|$)/i;
const BLOCK_TAGS = new Set(['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'PRE', 'DD', 'DT', 'FIGCAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'CANVAS']);
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function collapseWhitespace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

export function looksLikeUrl(text) {
  const t = String(text ?? '').trim();
  if (!t || /\s/.test(t)) return false;
  return /^https?:\/\/\S+$/i.test(t) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t);
}

export function looksLikeHtml(text) {
  return /<\s*(html|body|head|main|article|div|p|h[1-6]|ul|ol|li|section|span|a)\b[^>]*>/i.test(String(text ?? ''));
}

function hasDirectText(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE && node.nodeValue.trim()) return true;
  }
  return false;
}

function isBlockCandidate(el) {
  if (BLOCK_TAGS.has(el.tagName)) return true;
  return el.tagName === 'DIV' && hasDirectText(el);
}

// Text of an element, stopping at nested block candidates (they become their own blocks).
function ownText(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE) out += node.nodeValue;
    else if (node.nodeType === ELEMENT_NODE) {
      if (SKIP_TAGS.has(node.tagName)) continue;
      if (isBlockCandidate(node)) { out += ' '; continue; }
      out += ' ' + ownText(node) + ' ';
    }
  }
  return out;
}

function stripChrome(root) {
  for (const el of Array.from(root.querySelectorAll(REMOVE_SELECTOR))) el.remove();
  for (const el of Array.from(root.querySelectorAll('[id], [class]'))) {
    const id = el.getAttribute('id') || '';
    const cls = el.getAttribute('class') || '';
    if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'MAIN' || el.tagName === 'ARTICLE') continue;
    if (CHROME_RE.test(id) || cls.split(/\s+/).some((c) => CHROME_RE.test(c))) el.remove();
  }
}

// document: a parsed DOM Document (browser DOMParser or jsdom).
export function extractFromDocument(document, options = {}) {
  const label = options.label || 'Page';
  const notices = [];
  const title = collapseWhitespace(document.querySelector('title')?.textContent || '') || null;

  stripChrome(document);
  const body = document.body || document.documentElement;
  const root = document.querySelector('main') || document.querySelector('article') || document.querySelector('[role=main]') || body;

  const blocks = [];
  const headings = [];
  const seen = new Set();

  const walk = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType !== ELEMENT_NODE || SKIP_TAGS.has(node.tagName)) continue;
      if (isBlockCandidate(node)) {
        const text = collapseWhitespace(ownText(node));
        if (text) {
          const idx = blocks.length;
          blocks.push(text);
          seen.add(node);
          const m = /^H([1-3])$/.exec(node.tagName);
          if (m && text.length <= CAPS.headingTextLength) headings.push({ level: Number(m[1]), text, blockIndex: idx });
        }
      }
      walk(node);
    }
  };
  walk(root);

  if (root !== body) {
    for (const h1 of Array.from(body.querySelectorAll('h1'))) {
      if (root.contains(h1) || seen.has(h1)) continue;
      const text = collapseWhitespace(h1.textContent);
      if (text && text.length <= CAPS.headingTextLength) {
        blocks.unshift(text);
        for (const h of headings) h.blockIndex += 1;
        headings.unshift({ level: 1, text, blockIndex: 0 });
      }
    }
  }

  return { label, mode: 'html', title, blocks, headings, words: countWords(blocks), notices };
}

export function extractHtml(html, options = {}) {
  const source = String(html ?? '');
  if (!looksLikeHtml(source)) {
    const doc = extractText(source, options);
    doc.notices.unshift('No HTML markup found — parsed as plain text.');
    return doc;
  }
  let document;
  if (options.parse) document = options.parse(source);
  else if (typeof DOMParser !== 'undefined') document = new DOMParser().parseFromString(source, 'text/html');
  else throw new Error('No HTML parser available');
  return extractFromDocument(document, options);
}

const MD_HEADING_RE = /^(#{1,6})\s+(.*)$/;

function isTitleCaseLine(line, nextLine) {
  if (line.length > 80) return false;
  if (/[.;:]$/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;
  const content = words.filter((w) => {
    const t = w.toLowerCase().replace(/[^a-z0-9']/g, '');
    return t.length >= 3 && !STOPWORDS.has(t);
  });
  if (!content.length) return false;
  const capitalized = content.filter((w) => /^[A-Z0-9]/.test(w)).length;
  if (capitalized / content.length < 0.6) return false;
  if (nextLine === null || nextLine === '') return true;
  return nextLine.length >= 2 * line.length;
}

export function extractText(text, options = {}) {
  const label = options.label || 'Page';
  const detect = options.detectHeadings !== false;
  const notices = [];
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());

  const blocks = [];
  const headings = [];
  let detectedCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const md = MD_HEADING_RE.exec(line);
    if (md) {
      const level = md[1].length;
      const htext = collapseWhitespace(md[2].replace(/\s#+$/, ''));
      if (!htext) continue;
      const idx = blocks.length;
      blocks.push(htext);
      if (detect && level <= 3 && htext.length <= CAPS.headingTextLength) headings.push({ level, text: htext, blockIndex: idx, markdown: true });
      continue;
    }
    const idx = blocks.length;
    blocks.push(collapseWhitespace(line));
    if (detect) {
      const next = i + 1 < lines.length ? lines[i + 1] : null;
      if (isTitleCaseLine(line, next)) {
        headings.push({ level: 2, text: collapseWhitespace(line), blockIndex: idx, markdown: false });
        detectedCount += 1;
      }
    }
  }

  let finalHeadings = headings;
  if (detectedCount > CAPS.detectedHeadings) {
    finalHeadings = headings.filter((h) => h.markdown);
    notices.push(`Detected ${detectedCount} Title Case headings — too many to trust; kept Markdown headings only.`);
  }
  finalHeadings = finalHeadings.map(({ level, text, blockIndex }) => ({ level, text, blockIndex }));

  return { label, mode: 'text', title: null, blocks, headings: finalHeadings, words: countWords(blocks), notices };
}

export function extract(text, mode, options = {}) {
  return mode === 'html' ? extractHtml(text, options) : extractText(text, options);
}
