// Heading gaps (PLAN §6.6) and suggested H2s (§6.7). Pure, no DOM.

import { CAPS, HEADING_SIM_THRESHOLD } from './config.js';
import { tokenizeSentence, countWords } from './tokenize.js';
import { isStopword, isPureNumber } from './stopwords.js';

export function headingTokens(text, extraStopwords) {
  const set = new Set();
  for (const t of tokenizeSentence(String(text).replace(/[.!?]+/g, ' '))) {
    if (isStopword(t, extraStopwords) || isPureNumber(t)) continue;
    set.add(t);
  }
  return set;
}

export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function isSubset(small, big) {
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

// Matched when Jaccard >= threshold, or when the smaller set (>= 2 tokens) is a subset of the other.
export function isMatch(a, b, threshold = HEADING_SIM_THRESHOLD) {
  if (jaccard(a, b) >= threshold) return true;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  return small.size >= 2 && isSubset(small, big);
}

export function bestMatch(set, candidates, threshold = HEADING_SIM_THRESHOLD) {
  let best = { sim: 0, index: -1, matched: false };
  candidates.forEach((c, index) => {
    const sim = jaccard(set, c.set);
    if (sim > best.sim || best.index === -1) best = { sim, index, matched: false };
  });
  best.matched = candidates.some((c) => isMatch(set, c.set, threshold));
  if (best.index === -1) best.sim = 0;
  return best;
}

const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'vs', 'from', 'as', 'but', 'nor']);

export function titleCase(text) {
  const words = String(text).trim().split(/\s+/);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
      if (/^[A-Z0-9&\-]+$/.test(w) && w.length <= 5) return w; // acronyms: SEO, UX, H1
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

// Words in the section that starts at a heading and ends at the next heading of the
// same-or-higher level (lower level number) or the end of the document.
export function sectionLength(doc, heading) {
  if (heading.blockIndex == null || !doc.blocks) return 0;
  const start = heading.blockIndex + 1;
  let end = doc.blocks.length;
  for (const h of doc.headings) {
    if (h.blockIndex != null && h.blockIndex > heading.blockIndex && h.level <= heading.level) {
      end = Math.min(end, h.blockIndex);
    }
  }
  return countWords(doc.blocks.slice(start, end));
}

function prepareHeadings(doc, extraStopwords, includeTitle) {
  const out = [];
  if (includeTitle && doc.title) {
    out.push({ level: 1, text: doc.title, set: headingTokens(doc.title, extraStopwords), sectionWords: 0, isTitle: true });
  }
  for (const h of doc.headings || []) {
    if (h.level > 3) continue;
    const set = headingTokens(h.text, extraStopwords);
    if (set.size === 0) continue;
    out.push({ level: h.level, text: h.text, set, sectionWords: sectionLength(doc, h), isTitle: false });
  }
  return out;
}

function clusterHeadings(items, threshold) {
  const topics = [];
  for (const item of items) {
    let topic = topics.find((t) => t.members.some((m) => isMatch(m.set, item.set, threshold)));
    if (!topic) {
      topic = { members: [] };
      topics.push(topic);
    }
    topic.members.push(item);
  }
  return topics;
}

// yours: Doc; competitors: Doc[]. Returns { gaps, suggestedH2s, matchedTopics, totalTopics }.
export function analyzeHeadings(yours, competitors, options = {}) {
  const threshold = options.threshold ?? HEADING_SIM_THRESHOLD;
  const extra = options.extraStopwords;
  const K = competitors.length;
  const yourHeadings = prepareHeadings(yours, extra, true);

  const matchedItems = [];
  const gapItems = [];
  competitors.forEach((doc, ci) => {
    for (const h of prepareHeadings(doc, extra, true)) {
      const best = bestMatch(h.set, yourHeadings, threshold);
      const item = { ...h, competitor: ci, competitorLabel: doc.label, best };
      if (best.matched) matchedItems.push(item);
      else gapItems.push(item);
    }
  });

  const gapTopics = clusterHeadings(gapItems, threshold).map((topic) => {
    const members = topic.members;
    const rep = members.reduce((a, b) => (b.text.length < a.text.length ? b : a));
    const competitorsCovering = new Set(members.map((m) => m.competitor));
    const levels = [...new Set(members.map((m) => m.level))].sort();
    const avgSection = members.reduce((s, m) => s + m.sectionWords, 0) / members.length;
    let closest = { text: '', sim: 0 };
    for (const m of members) {
      if (m.best.index >= 0 && m.best.sim >= closest.sim) {
        closest = { text: yourHeadings[m.best.index].text, sim: Math.round(m.best.sim * 100) / 100 };
      }
    }
    return {
      heading: rep.text,
      variants: [...new Set(members.map((m) => m.text).filter((t) => t !== rep.text))],
      covH: competitorsCovering.size,
      K,
      levels,
      competitors: [...competitorsCovering].sort(),
      avgSectionWords: Math.round(avgSection),
      yourClosest: closest,
    };
  });
  gapTopics.sort((a, b) => b.covH - a.covH || b.avgSectionWords - a.avgSectionWords || a.heading.localeCompare(b.heading));

  const matchedTopics = clusterHeadings(matchedItems, threshold).length;
  const totalTopics = matchedTopics + gapTopics.length;

  const suggestedH2s = gapTopics
    .filter((t) => t.levels.includes(2) || (t.levels.includes(3) && t.covH >= 2))
    .slice(0, CAPS.suggestedH2)
    .map((t) => ({ text: titleCase(t.heading), covH: t.covH, K, variants: t.variants, levels: t.levels }));

  return {
    gaps: gapTopics,
    suggestedH2s,
    matchedTopics,
    totalTopics,
    headingCoverage: totalTopics ? Math.round((1000 * matchedTopics) / totalTopics) / 10 : null,
  };
}
