import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../assets/js/analyze.js';
import { extractText } from '../assets/js/extract.js';
import { analyzeFixture, loadData, loadFixtureDocs } from './helpers.mjs';

// Deterministic pseudo-random generator so the perf test is reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function syntheticDoc(label, words, seed) {
  const rand = rng(seed);
  const vocab = [];
  for (let i = 0; i < 4000; i++) vocab.push('term' + i.toString(36) + (i % 7 === 0 ? 'x' : ''));
  const common = ['desk', 'standing', 'height', 'frame', 'monitor', 'the', 'and', 'for', 'with', 'your'];
  const lines = [];
  let count = 0;
  while (count < words) {
    const len = 8 + Math.floor(rand() * 14);
    const sentence = [];
    for (let i = 0; i < len; i++) {
      sentence.push(rand() < 0.4 ? common[Math.floor(rand() * common.length)] : vocab[Math.floor(rand() * vocab.length)]);
    }
    count += len;
    lines.push(sentence.join(' ') + '.');
    if (lines.length % 6 === 0) lines.push('', `## Section ${lines.length}`, '');
  }
  return extractText(lines.join('\n'), { label });
}

// Test 18
test('analyze: 4 × 20k-word synthetic docs complete in < 1000 ms', () => {
  const yours = syntheticDoc('Yours', 20000, 1);
  const competitors = [syntheticDoc('A', 20000, 2), syntheticDoc('B', 20000, 3), syntheticDoc('C', 20000, 4)];
  assert.ok(yours.words >= 20000);
  const t0 = performance.now();
  const result = analyze({ yours, competitors, data: loadData() });
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `took ${Math.round(ms)} ms`);
  assert.ok(result.gaps.length > 0);
  assert.ok(result.gaps.length <= 100);
});

test('analyze: result is structured-clone safe and carries counts for locked bands', () => {
  const result = analyzeFixture();
  const cloned = structuredClone(result);
  assert.deepEqual(cloned.gaps[0], result.gaps[0]);
  assert.equal(result.K, 3);
  assert.equal(result.scores.counts.gaps, result.gapTotal);
  assert.equal(result.scores.counts.headingGaps, result.headingGaps.length);
  assert.equal(result.scores.counts.entityGaps, result.entityTotal);
  assert.equal(result.scores.counts.suggestedH2s, result.suggestedH2s.length);
  assert.equal(result.gaps[0].action, 'Consider a section (competitor h2)');
  assert.equal(result.gaps[0].inHeading, 2);
  const hm = result.gaps.find((r) => r.term === 'herman miller');
  assert.equal(hm.action, 'Mention in body');
  assert.ok(result.shared.slice(0, 5).some((r) => r.term === 'desk'));
  assert.ok(result.headingGaps.some((h) => h.heading === 'Cable Management' && h.yourClosest.sim < 0.5));
  assert.ok(result.suggestedH2s.some((h) => h.text === 'Cable Management'));
});

test('analyze: teaser mode carries only the free rows plus counts (DevTools-safe)', () => {
  const full = analyzeFixture();
  const { yours, competitors } = loadFixtureDocs();
  const teaser = analyze({ yours, competitors, teaser: true, data: loadData() });
  assert.equal(teaser.teaser, true);
  assert.equal(teaser.gaps.length, 10);
  assert.deepEqual(teaser.gaps.map((g) => g.term), full.gaps.slice(0, 10).map((g) => g.term));
  assert.equal(teaser.shared.length, 5);
  assert.deepEqual(teaser.headingGaps, []);
  assert.deepEqual(teaser.suggestedH2s, []);
  assert.deepEqual(teaser.entityGaps, []);
  assert.deepEqual(teaser.onlyYou, []);
  assert.equal(teaser.scores.phraseCoverage, null);
  assert.equal(teaser.scores.headingCoverage, null);
  // Counts survive so locked bands can show them.
  assert.equal(teaser.gapTotal, full.gapTotal);
  assert.equal(teaser.headingGapTotal, full.headingGaps.length);
  assert.equal(teaser.suggestedH2Total, full.suggestedH2s.length);
  assert.equal(teaser.entityTotal, full.entityTotal);
  assert.equal(teaser.sharedTotal, full.sharedTotal);
  assert.equal(teaser.onlyYouTotal, full.onlyYouTotal);
  // No locked phrase leaks anywhere in the serialized teaser.
  const json = JSON.stringify(teaser);
  for (const g of full.gaps.slice(10)) assert.ok(!json.includes(`"${g.term}"`), `leaked gap: ${g.term}`);
  for (const h of full.headingGaps) assert.ok(!json.includes(`"${h.heading}"`), `leaked heading: ${h.heading}`);
  for (const e of full.entityGaps) assert.ok(!json.includes(`"${e.surface}"`), `leaked entity: ${e.surface}`);
  for (const s of full.shared.slice(5)) assert.ok(!json.includes(`"term":"${s.term}"`), `leaked shared: ${s.term}`);
});

test('analyze: empty competitors are ignored; extra stopwords apply', () => {
  const yours = extractText('Standing desk guide. Standing desk guide. Standing desk guide.', { label: 'Y' });
  const comp = extractText('Standing desk guide. Standing desk guide. Bamboo tops are nice. Bamboo tops are nice. Bamboo tops rock.', { label: 'A' });
  const empty = extractText('', { label: 'B' });
  const r = analyze({ yours, competitors: [comp, empty], data: loadData() });
  assert.equal(r.K, 1);
  assert.ok(r.gaps.some((g) => g.term === 'bamboo tops'));
  const r2 = analyze({ yours, competitors: [comp], settings: { extraStopwords: 'bamboo' }, data: loadData() });
  assert.ok(!r2.gaps.some((g) => g.term.includes('bamboo')));
});
