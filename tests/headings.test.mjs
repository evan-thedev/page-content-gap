import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingTokens, jaccard, isMatch, analyzeHeadings, titleCase } from '../assets/js/headings.js';
import { analyzeFixture } from './helpers.mjs';
import { CAPS } from '../assets/js/config.js';

function doc(label, headings, title = null) {
  const blocks = headings.map((h) => h.text);
  return { label, title, blocks, headings: headings.map((h, i) => ({ ...h, blockIndex: i })), words: 0 };
}

// Test 11
test('headings: Jaccard matching without stemming; variants cluster into one topic', () => {
  const a = headingTokens('Cable Management');
  const b = headingTokens('Managing Your Cables');
  assert.ok(jaccard(a, b) < 0.5);
  assert.ok(!isMatch(a, b), 'cable ≠ cables, managing ≠ management (documented v1 behaviour)');

  const p = headingTokens('Pricing and Plans');
  const q = headingTokens('Plans & Pricing');
  assert.equal(jaccard(p, q), 1);
  assert.ok(isMatch(p, q));

  const yours = doc('Yours', [{ level: 1, text: 'Standing Desk Guide' }]);
  const comps = [
    doc('A', [{ level: 2, text: 'Cable Management' }]),
    doc('B', [{ level: 2, text: 'Cable Management Tips' }]),
    doc('C', [{ level: 3, text: 'Desk Cable Management' }]),
  ];
  const res = analyzeHeadings(yours, comps);
  assert.equal(res.gaps.length, 1);
  assert.equal(res.gaps[0].heading, 'Cable Management');
  assert.equal(res.gaps[0].covH, 3);
  assert.deepEqual(res.gaps[0].variants.sort(), ['Cable Management Tips', 'Desk Cable Management']);
  assert.ok(res.gaps[0].yourClosest.sim < 0.5);
});

// Test 12
test('headings: only h1–h3 considered; your <title> counts as a heading', () => {
  const yours = doc('Yours', [{ level: 2, text: 'Budget' }], 'Pricing and Plans for Small Teams');
  const comps = [
    doc('A', [
      { level: 2, text: 'Plans & Pricing' },
      { level: 4, text: 'Deeply Nested Warranty Details' },
    ]),
  ];
  const res = analyzeHeadings(yours, comps);
  assert.equal(res.gaps.length, 0, 'title matched the competitor h2; h4 ignored');
  assert.equal(res.matchedTopics, 1);
  assert.equal(res.headingCoverage, 100);

  const noTitle = analyzeHeadings(doc('Yours', [{ level: 2, text: 'Budget' }]), comps);
  assert.equal(noTitle.gaps.length, 1);
  assert.equal(noTitle.gaps[0].heading, 'Plans & Pricing');
});

// Test 13
test('headings: suggested H2s are h2-level topics in §6.6 order, Title Case, cap 15', () => {
  const result = analyzeFixture();
  const sugg = result.suggestedH2s;
  assert.ok(sugg.length > 0 && sugg.length <= CAPS.suggestedH2);
  assert.equal(sugg[0].text, 'Cable Management');
  assert.equal(sugg[0].covH, 2);
  const eligibleTopics = result.headingGaps.filter((t) => t.levels.includes(2) || (t.levels.includes(3) && t.covH >= 2));
  assert.deepEqual(sugg.map((s) => s.text), eligibleTopics.slice(0, CAPS.suggestedH2).map((t) => titleCase(t.heading)));
  for (const s of sugg) assert.equal(s.text, titleCase(s.text));
  // Order: covH desc, then average section length desc.
  for (let i = 1; i < result.headingGaps.length; i++) {
    const a = result.headingGaps[i - 1];
    const b = result.headingGaps[i];
    assert.ok(a.covH > b.covH || (a.covH === b.covH && a.avgSectionWords >= b.avgSectionWords));
  }
  assert.equal(titleCase('the complete guide to sit stand desks'), 'The Complete Guide to Sit Stand Desks');
  assert.equal(titleCase('SEO basics for beginners'), 'SEO Basics for Beginners');

  const many = doc('Yours', [{ level: 1, text: 'Alpha' }]);
  const comps = [doc('A', Array.from({ length: 30 }, (_, i) => ({ level: 2, text: `Alpha${i} bravo${i} charlie${i}` })))];
  assert.equal(analyzeHeadings(many, comps).suggestedH2s.length, CAPS.suggestedH2);
});
