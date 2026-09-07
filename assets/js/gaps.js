// Gap / shared / only-you classification, ranking, subsumption, caps, and scores (PLAN §6.4, §6.8).

import { N_MIN, SUBSUMPTION_RATIO } from './config.js';
import { ngramSize } from './ngrams.js';

// Merge per-document counts into one row per term.
export function buildRows(yourCounts, compCounts) {
  const K = compCounts.length;
  const rows = new Map();
  const getRow = (term) => {
    let row = rows.get(term);
    if (!row) {
      row = {
        term,
        n: ngramSize(term),
        yourCount: 0,
        unionCount: 0,
        cov: 0,
        K,
        perCompetitor: new Array(K).fill(0),
        inHeading: null,
        action: '',
        subsumes: [],
      };
      rows.set(term, row);
    }
    return row;
  };
  compCounts.forEach((counts, i) => {
    for (const [term, c] of counts) {
      const row = getRow(term);
      row.perCompetitor[i] = c;
      row.unionCount += c;
      if (c > 0) row.cov += 1;
    }
  });
  for (const [term, c] of yourCounts) getRow(term).yourCount = c;
  return rows;
}

export function isEligible(row, nMin = N_MIN) {
  return row.unionCount >= nMin[row.n];
}

export function isGap(row, nMin = N_MIN) {
  return isEligible(row, nMin) && row.yourCount === 0;
}

export function isShared(row, nMin = N_MIN) {
  return isEligible(row, nMin) && row.yourCount >= 1;
}

export function isOnlyYou(row, nMin = N_MIN) {
  return row.unionCount === 0 && row.yourCount >= nMin[row.n];
}

export function compareGaps(a, b) {
  if (b.unionCount !== a.unionCount) return b.unionCount - a.unionCount;
  if (b.n !== a.n) return b.n - a.n;
  if (b.cov !== a.cov) return b.cov - a.cov;
  return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
}

export function compareShared(a, b) {
  const ma = Math.min(a.yourCount, a.unionCount);
  const mb = Math.min(b.yourCount, b.unionCount);
  if (mb !== ma) return mb - ma;
  if (b.n !== a.n) return b.n - a.n;
  return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
}

export function compareOnlyYou(a, b) {
  if (b.yourCount !== a.yourCount) return b.yourCount - a.yourCount;
  if (b.n !== a.n) return b.n - a.n;
  return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
}

export function classify(rows, nMin = N_MIN) {
  const gaps = [];
  const shared = [];
  const onlyYou = [];
  let eligible = 0;
  for (const row of rows.values()) {
    if (isEligible(row, nMin)) {
      eligible += 1;
      if (row.yourCount === 0) gaps.push(row);
      else shared.push(row);
    } else if (isOnlyYou(row, nMin)) {
      onlyYou.push(row);
    }
  }
  gaps.sort(compareGaps);
  shared.sort(compareShared);
  onlyYou.sort(compareOnlyYou);
  return { gaps, shared, onlyYou, eligible };
}

// Positional subsumption. For each child gram (n = childN) count how many of its
// competitor occurrences sit inside an occurrence of a displayed parent gram. Hide the
// child when the covered share is >= ratio, and record it in the parent's `subsumes`.
function subsumeLevel(childRows, parentRows, compSpans, ratio) {
  if (!childRows.length || !parentRows.length) return { visible: childRows, hidden: [] };
  const childN = childRows[0].n;
  const children = new Map(childRows.map((r) => [r.term, r]));
  const parents = new Map(parentRows.map((r) => [r.term, r]));
  const parentSizes = [...new Set(parentRows.map((r) => r.n))].sort((a, b) => b - a);
  const stats = new Map();
  for (const term of children.keys()) stats.set(term, { total: 0, covered: 0, byParent: new Map() });

  for (const spans of compSpans) {
    for (const span of spans) {
      const L = span.length;
      if (L < childN) continue;
      const cover = new Array(L).fill(null);
      for (const n of parentSizes) {
        for (let i = 0; i + n <= L; i++) {
          const gram = span.slice(i, i + n).join(' ');
          if (!parents.has(gram)) continue;
          for (let j = i; j < i + n; j++) if (cover[j] === null) cover[j] = gram;
        }
      }
      for (let i = 0; i + childN <= L; i++) {
        const gram = childN === 1 ? span[i] : span.slice(i, i + childN).join(' ');
        const s = stats.get(gram);
        if (!s) continue;
        s.total += 1;
        let inside = true;
        for (let j = i; j < i + childN; j++) if (cover[j] === null) { inside = false; break; }
        if (inside) {
          s.covered += 1;
          const p = cover[i];
          s.byParent.set(p, (s.byParent.get(p) || 0) + 1);
        }
      }
    }
  }

  const visible = [];
  const hidden = [];
  for (const row of childRows) {
    const s = stats.get(row.term);
    if (s && s.total > 0 && s.covered / s.total >= ratio) {
      let best = null;
      let bestCount = -1;
      for (const [p, c] of s.byParent) if (c > bestCount) { best = p; bestCount = c; }
      if (best) parents.get(best).subsumes.push(row.term);
      hidden.push(row);
    } else {
      visible.push(row);
    }
  }
  return { visible, hidden };
}

// gaps: ranked gap rows (all n). compSpans: string[][][] (per competitor sentence spans).
export function applySubsumption(gaps, compSpans, ratio = SUBSUMPTION_RATIO) {
  for (const r of gaps) r.subsumes = [];
  const tri = gaps.filter((r) => r.n === 3);
  const bi = gaps.filter((r) => r.n === 2);
  const uni = gaps.filter((r) => r.n === 1);
  const biRes = subsumeLevel(bi, tri, compSpans, ratio);
  const uniRes = subsumeLevel(uni, [...tri, ...biRes.visible], compSpans, ratio);
  const visible = [...tri, ...biRes.visible, ...uniRes.visible].sort(compareGaps);
  for (const r of visible) r.subsumes.sort();
  return { visible, hidden: [...biRes.hidden, ...uniRes.hidden] };
}

export function phraseCoverage(eligible, gapCountBeforeSubsumption) {
  if (!eligible) return null;
  return Math.round((1000 * (eligible - gapCountBeforeSubsumption)) / eligible) / 10;
}

export function wordStats(yourWords, competitorWords) {
  if (!competitorWords.length) {
    return { yours: yourWords, min: 0, avg: 0, max: 0, shorterThanAll: false };
  }
  const min = Math.min(...competitorWords);
  const max = Math.max(...competitorWords);
  const avg = Math.round(competitorWords.reduce((a, b) => a + b, 0) / competitorWords.length);
  return { yours: yourWords, min, avg, max, shorterThanAll: yourWords < min };
}
