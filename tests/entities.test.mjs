import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractEntities, capitalizedSequences, entityGaps } from '../assets/js/entities.js';
import { analyzeFixture, loadData } from './helpers.mjs';

// Test 10
test('entities: curated + capitalized sequences; sentence-initial singletons dropped', () => {
  const curated = loadData().entities;
  const doc = {
    blocks: [
      'However, the report from google search console showed a drop.',
      'We compared it against a Herman Miller chair and a second Herman Miller desk.',
      'The Best option is usually the cheapest one.',
      'They also mention Bing Webmaster Tools once.',
    ],
    headings: [],
  };
  const found = extractEntities(doc, curated);
  assert.ok(found.has('google search console'), 'curated, matched case-insensitively');
  assert.equal(found.get('google search console').surface, 'Google Search Console');
  assert.equal(found.get('google search console').source, 'curated');
  assert.ok(found.has('herman miller'), 'capitalized sequence');
  assert.equal(found.get('herman miller').count, 2);
  assert.equal(found.get('herman miller').source, 'capitalized');
  assert.ok(!found.has('however'));
  assert.ok(!found.has('the best'), 'sentence-initial, seen once');
  assert.ok(found.has('bing webmaster tools'));

  const repeated = capitalizedSequences(['The Best option. The Best option again, and The Best once more.']);
  assert.ok(repeated.has('the best'), 'kept when it also appears mid-sentence');

  const headings = capitalizedSequences(['How to Set Up a Standing Desk'], new Set([0]));
  assert.equal(headings.size, 0, 'heading blocks skipped');
});

test('entities: fixture gap includes Herman Miller with union 3 across 2 competitors', () => {
  const result = analyzeFixture();
  const hm = result.entityGaps.find((e) => e.key === 'herman miller');
  assert.ok(hm);
  assert.equal(hm.surface, 'Herman Miller');
  assert.equal(hm.unionCount, 3);
  assert.equal(hm.cov, 2);
  assert.deepEqual(hm.perCompetitor, [2, 0, 1]);
  assert.ok(result.entityGaps.some((e) => e.key === 'uplift v2'));
});

test('entities: present in your text (any case) is not a gap; exclusions apply', () => {
  const yours = { blocks: ['We love herman miller chairs.'], headings: [] };
  const comp = { blocks: ['Herman Miller makes chairs. Herman Miller also sells Steelcase Leap knockoffs.'], headings: [] };
  const { gaps } = entityGaps(yours, [comp], [], {});
  assert.ok(!gaps.some((g) => g.key === 'herman miller'));
  assert.ok(gaps.some((g) => g.key === 'steelcase leap'));
  const { gaps: ex } = entityGaps(yours, [comp], [], { exclusions: new Set(['steelcase']) });
  assert.ok(!ex.some((g) => g.key === 'steelcase leap'));
});
