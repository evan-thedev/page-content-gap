import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFixture, loadFixtureDocs, loadData } from './helpers.mjs';
import { tokenizeBlocks } from '../assets/js/tokenize.js';
import { countNgrams } from '../assets/js/ngrams.js';
import { buildRows, classify, applySubsumption, compareGaps } from '../assets/js/gaps.js';
import { N_MIN, CAPS } from '../assets/js/config.js';

const FIXTURE_GAPS = ['cable management', 'anti fatigue mat', 'sit stand', 'herman miller'];

function fixtureRows() {
  const { yours, competitors } = loadFixtureDocs();
  const boilerplate = loadData().boilerplate;
  const yourSpans = tokenizeBlocks(yours.blocks);
  const compSpans = competitors.map((d) => tokenizeBlocks(d.blocks));
  const rows = buildRows(countNgrams(yourSpans, { boilerplate }), compSpans.map((s) => countNgrams(s, { boilerplate })));
  return { rows, compSpans, ...classify(rows) };
}

// Test 5
test('gaps: §6.10 fixture gap set, shared desk, N_min thresholds', () => {
  const { rows, gaps } = fixtureRows();
  const multi = gaps.filter((r) => r.n >= 2).map((r) => r.term).sort();
  // Before subsumption the two sub-bigrams of the trigram are also gaps.
  assert.deepEqual(multi, [...FIXTURE_GAPS, 'anti fatigue', 'fatigue mat'].sort());
  for (const t of ['cable', 'management', 'anti', 'fatigue', 'mat', 'herman', 'miller']) {
    assert.ok(gaps.some((r) => r.term === t), `unigram ${t} is an eligible gap before subsumption`);
  }
  const byTerm = Object.fromEntries(gaps.map((r) => [r.term, r]));
  assert.equal(byTerm['cable management'].unionCount, 8);
  assert.deepEqual(byTerm['cable management'].perCompetitor, [2, 3, 3]);
  assert.equal(byTerm['cable management'].cov, 3);
  assert.equal(byTerm['anti fatigue mat'].unionCount, 7);
  assert.deepEqual(byTerm['anti fatigue mat'].perCompetitor, [4, 3, 0]);
  assert.equal(byTerm['anti fatigue mat'].cov, 2);
  assert.equal(byTerm['sit stand'].unionCount, 5);
  assert.equal(byTerm['sit stand'].cov, 1);
  assert.equal(byTerm['herman miller'].unionCount, 3);
  assert.equal(byTerm['herman miller'].cov, 2);

  const desk = rows.get('desk');
  assert.equal(desk.yourCount, 8);
  assert.ok(desk.unionCount >= 30);
  assert.ok(!gaps.includes(desk), 'desk is shared, not a gap');
  // 'sit' and 'stand' also appear on your page, so only the bigram 'sit stand' is a gap.
  assert.ok(rows.get('sit').yourCount >= 1 && rows.get('stand').yourCount >= 1);

  // Thresholds: a bigram with union 1 and a unigram with union 2 are not gaps.
  for (const r of rows.values()) {
    if (r.yourCount === 0 && r.n === 2 && r.unionCount === 1) assert.ok(!gaps.includes(r), r.term);
    if (r.yourCount === 0 && r.n === 1 && r.unionCount === 2) assert.ok(!gaps.includes(r), r.term);
  }
  assert.deepEqual(N_MIN, { 1: 3, 2: 2, 3: 2 });
});

// Test 6
test('gaps: default order union desc → n desc → cov desc → alpha', () => {
  const result = analyzeFixture();
  const order = result.gaps.map((r) => r.term);
  const idx = (t) => order.indexOf(t);
  assert.equal(order[0], 'cable management');
  assert.equal(order[1], 'anti fatigue mat');
  assert.ok(idx('anti fatigue mat') < idx('sit stand'));
  assert.ok(idx('sit stand') < idx('herman miller'));
  for (let i = 1; i < result.gaps.length; i++) {
    assert.ok(compareGaps(result.gaps[i - 1], result.gaps[i]) <= 0, `row ${i} out of order`);
  }
  const rows = [
    { term: 'b', n: 2, unionCount: 5, cov: 1 },
    { term: 'a', n: 2, unionCount: 5, cov: 1 },
    { term: 'c d e', n: 3, unionCount: 5, cov: 1 },
    { term: 'z', n: 1, unionCount: 9, cov: 1 },
    { term: 'x', n: 2, unionCount: 5, cov: 3 },
  ];
  assert.deepEqual(rows.sort(compareGaps).map((r) => r.term), ['z', 'c d e', 'x', 'a', 'b']);
});

// Test 7
test('gaps: subsumption hides cable/management/mat; caps applied after subsumption', () => {
  const { gaps, compSpans } = fixtureRows();
  const { visible, hidden } = applySubsumption(gaps.sort(compareGaps), compSpans);
  const hiddenTerms = hidden.map((r) => r.term);
  for (const t of ['cable', 'management', 'mat', 'anti', 'fatigue', 'anti fatigue', 'fatigue mat', 'herman', 'miller']) {
    assert.ok(hiddenTerms.includes(t), `${t} hidden`);
  }
  const cm = visible.find((r) => r.term === 'cable management');
  assert.deepEqual(cm.subsumes, ['cable', 'management']);
  const afm = visible.find((r) => r.term === 'anti fatigue mat');
  assert.deepEqual(afm.subsumes, ['anti', 'anti fatigue', 'fatigue', 'fatigue mat', 'mat']);
  assert.deepEqual(visible.filter((r) => r.n >= 2).map((r) => r.term).sort(), [...FIXTURE_GAPS].sort());

  const result = analyzeFixture();
  assert.ok(result.gaps.length <= CAPS.gapRows);
  assert.equal(result.gaps.length, Math.min(visible.length, CAPS.gapRows));
  const teaser = result.gaps.slice(0, CAPS.teaserGapRows);
  assert.deepEqual(teaser.map((r) => r.term), result.gaps.slice(0, 10).map((r) => r.term));
  assert.equal(teaser.length, 10);
});

// Test 8
test('gaps: exclusion list removes rows; boilerplate never appears', () => {
  const excluded = analyzeFixture({ exclusions: 'Herman Miller\ncable' });
  for (const r of [...excluded.gaps, ...excluded.shared, ...excluded.onlyYou]) {
    for (const tok of r.term.split(' ')) assert.ok(!['herman', 'miller', 'cable'].includes(tok), r.term);
  }
  assert.ok(!excluded.entityGaps.some((e) => e.key === 'herman miller'));

  const result = analyzeFixture();
  const boiler = new Set(loadData().boilerplate);
  for (const r of [...result.gaps, ...result.shared, ...result.onlyYou]) assert.ok(!boiler.has(r.term), r.term);
  // Competitor A's chrome (nav/footer/cookie banner) never reaches the tables.
  const terms = result.gaps.map((r) => r.term).join('|');
  for (const t of ['privacy policy', 'rights reserved', 'cookies', 'newsletter']) assert.ok(!terms.includes(t), t);
});

// Test 9
test('gaps: coverage scores match hand computation; only-you contains your unique phrases', () => {
  const { rows, eligible, gaps } = fixtureRows();
  let eligibleByHand = 0;
  let gapsByHand = 0;
  for (const r of rows.values()) {
    if (r.unionCount >= N_MIN[r.n]) {
      eligibleByHand += 1;
      if (r.yourCount === 0) gapsByHand += 1;
    }
  }
  assert.equal(eligible, eligibleByHand);
  assert.equal(gaps.length, gapsByHand);
  const result = analyzeFixture();
  const expected = Math.round((1000 * (eligibleByHand - gapsByHand)) / eligibleByHand) / 10;
  assert.equal(result.scores.phraseCoverage, expected);
  assert.equal(result.scores.phraseCoverage, 75.8);
  assert.equal(result.scores.headingCoverage, Math.round((1000 * result.scores.matchedTopics) / result.scores.totalTopics) / 10);
  assert.equal(result.scores.headingCoverage, 16.7);

  const onlyYou = result.onlyYou.map((r) => r.term);
  assert.ok(onlyYou.includes('ergonomic'));
  assert.ok(onlyYou.includes('height adjustable frame'));
  assert.ok(result.scores.words.shorterThanAll);
});
