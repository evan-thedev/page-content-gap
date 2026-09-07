// Orchestrator: Docs → Result. Used by app.js (main thread) and worker.js. Pure JS, no DOM.

import { CAPS, N_MIN } from './config.js';
import { tokenizeBlocks, tokenizeSentence } from './tokenize.js';
import { countNgrams, makeRules, rawGrams } from './ngrams.js';
import { buildRows, classify, applySubsumption, phraseCoverage, wordStats } from './gaps.js';
import { analyzeHeadings } from './headings.js';
import { entityGaps } from './entities.js';
import { parseWordList } from './stopwords.js';

function exclusionTokens(list) {
  const set = new Set();
  for (const entry of list || []) for (const t of tokenizeSentence(entry)) set.add(t);
  return set;
}

// Map term -> lowest competitor heading level (h1 = 1) whose text contains the term.
function headingGramLevels(competitors) {
  const levels = new Map();
  for (const doc of competitors) {
    const items = [...(doc.headings || []).filter((h) => h.level <= 3)];
    for (const h of items) {
      for (const gram of rawGrams(tokenizeSentence(h.text.replace(/[.!?]+/g, ' ')))) {
        const prev = levels.get(gram);
        if (prev == null || h.level < prev) levels.set(gram, h.level);
      }
    }
  }
  return levels;
}

export function suggestedAction(row) {
  if (row.inHeading) return `Consider a section (competitor h${row.inHeading})`;
  if (row.n >= 2) return 'Mention in body';
  return 'Mention in body or expand a related section';
}

function plainRow(row) {
  return {
    term: row.term,
    n: row.n,
    yourCount: row.yourCount,
    unionCount: row.unionCount,
    cov: row.cov,
    K: row.K,
    perCompetitor: row.perCompetitor.slice(),
    inHeading: row.inHeading,
    action: row.action,
    subsumes: row.subsumes.slice(),
  };
}

/**
 * @param {object} input
 * @param {Doc} input.yours
 * @param {Doc[]} input.competitors
 * @param {object} [input.settings] { extraStopwords: string|string[], exclusions: string|string[] }
 * @param {object} [input.data] { entities: string[], boilerplate: string[] }
 */
export function analyze(input) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const yours = input.yours;
  const competitors = (input.competitors || []).filter((d) => d && d.blocks && d.blocks.length);
  const settings = input.settings || {};
  const data = input.data || {};

  const extraStopwords = new Set(
    Array.isArray(settings.extraStopwords) ? settings.extraStopwords : parseWordList(settings.extraStopwords),
  );
  const exclusionList = Array.isArray(settings.exclusions) ? settings.exclusions : parseWordList(settings.exclusions);
  const exclusions = exclusionTokens(exclusionList);
  const boilerplate = new Set((data.boilerplate || []).map((s) => s.toLowerCase()));
  const rules = makeRules({ extraStopwords, exclusions, boilerplate });

  const yourSpans = tokenizeBlocks(yours.blocks);
  const compSpans = competitors.map((d) => tokenizeBlocks(d.blocks));
  const yourCounts = countNgrams(yourSpans, rules);
  const compCounts = compSpans.map((spans) => countNgrams(spans, rules));

  const rows = buildRows(yourCounts, compCounts);
  const { gaps, shared, onlyYou, eligible } = classify(rows, N_MIN);
  const gapsBeforeSubsumption = gaps.length;

  const hLevels = headingGramLevels(competitors);
  for (const row of gaps) {
    row.inHeading = hLevels.get(row.term) ?? null;
    row.action = suggestedAction(row);
  }

  const { visible } = applySubsumption(gaps, compSpans);
  const headings = analyzeHeadings(yours, competitors, { extraStopwords });
  const entities = entityGaps(yours, competitors, data.entities || [], { exclusions });

  const words = wordStats(yours.words, competitors.map((d) => d.words));
  const gapRows = visible.slice(0, CAPS.gapRows).map(plainRow);
  const sharedRows = shared.slice(0, CAPS.sharedRows).map(plainRow);
  const onlyYouRows = onlyYou.slice(0, CAPS.onlyYouRows).map(plainRow);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    docs: {
      yours: { label: yours.label, words: yours.words, mode: yours.mode, notices: yours.notices || [] },
      competitors: competitors.map((d) => ({ label: d.label, words: d.words, mode: d.mode, notices: d.notices || [] })),
    },
    K: competitors.length,
    gaps: gapRows,
    gapTotal: visible.length,
    gapsBeforeSubsumption,
    shared: sharedRows,
    sharedTotal: shared.length,
    onlyYou: onlyYouRows,
    onlyYouTotal: onlyYou.length,
    headingGaps: headings.gaps,
    suggestedH2s: headings.suggestedH2s,
    entityGaps: entities.gaps,
    entityTotal: entities.total,
    scores: {
      phraseCoverage: phraseCoverage(eligible, gapsBeforeSubsumption),
      headingCoverage: headings.headingCoverage,
      eligible,
      matchedTopics: headings.matchedTopics,
      totalTopics: headings.totalTopics,
      words,
      counts: {
        gaps: visible.length,
        headingGaps: headings.gaps.length,
        entityGaps: entities.total,
        suggestedH2s: headings.suggestedH2s.length,
      },
    },
    settings: { extraStopwords: [...extraStopwords], exclusions: exclusionList },
    ms: Math.round(t1 - t0),
  };
}
