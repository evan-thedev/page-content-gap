import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeBlock, tokenizeSentence, splitSentences } from '../assets/js/tokenize.js';
import { STOPWORDS } from '../assets/js/stopwords.js';
import { countNgrams } from '../assets/js/ngrams.js';

// Test 1
test('tokenize: sentence spans, allowlist, short-token drop', () => {
  assert.deepEqual(tokenizeBlock("SEO isn't dead. Don't panic!"), [['seo', "isn't", 'dead'], ["don't", 'panic']]);
  assert.deepEqual(tokenizeSentence('AI and UX matter; it is up to us'), ['ai', 'and', 'ux', 'matter']);
});

// Test 2
test('tokenize: apostrophe normalization, stripping, hyphen split', () => {
  assert.deepEqual(tokenizeSentence('SEO isn’t dead'), ['seo', "isn't", 'dead']);
  assert.deepEqual(tokenizeSentence("'quoted' 'tis"), ['quoted', 'tis']);
  assert.deepEqual(tokenizeSentence('e-commerce'), ['commerce']);
  assert.deepEqual(splitSentences('One. Two! Three? 3.5 inches'), ['One', 'Two', 'Three', '3.5 inches']);
});

// Test 3
test('stopwords: size 100–200, contains core and boilerplate words', () => {
  assert.ok(STOPWORDS.size >= 100 && STOPWORDS.size <= 200, `size ${STOPWORDS.size}`);
  for (const w of ['the', 'and', 'read', 'more']) assert.ok(STOPWORDS.has(w), w);
});

// Test 4
test('ngrams: no boundary crossing, no stopword/number edges, internal stopwords allowed', () => {
  const spans = [['total', 'cost', 'of', 'ownership'], ['matters', 'here']];
  const counts = countNgrams(spans);
  assert.equal(counts.get('cost of ownership'), 1);
  assert.equal(counts.get('total cost of'), undefined); // ends with stopword
  assert.equal(counts.get('of ownership'), undefined); // starts with stopword
  assert.equal(counts.get('ownership matters'), undefined); // crosses a span boundary
  assert.equal(counts.get('the'), undefined);

  const numeric = countNgrams([['costs', '300', 'dollars', 'and', '2024']]);
  assert.equal(numeric.get('300'), undefined);
  assert.equal(numeric.get('2024'), undefined);
  assert.equal(numeric.get('costs 300'), undefined);
  assert.equal(numeric.get('costs 300 dollars'), 1); // number allowed in the middle

  const excluded = countNgrams([['herman', 'miller', 'desk']], { exclusions: ['miller'] });
  assert.equal(excluded.get('herman miller'), undefined);
  assert.equal(excluded.get('desk'), 1);

  const boiler = countNgrams([['read', 'our', 'privacy', 'policy']], { boilerplate: ['privacy policy'] });
  assert.equal(boiler.get('privacy policy'), undefined);
});
