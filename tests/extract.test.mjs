import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtml, extractText, looksLikeUrl } from '../assets/js/extract.js';
import { fixture, parseHtml } from './helpers.mjs';
import { CAPS } from '../assets/js/config.js';

// Test 14
test('extract (jsdom): strips nav/footer/script, prefers <main>, keeps header h1, separate blocks', () => {
  const doc = extractHtml(fixture('competitor-1.html'), { label: 'A', parse: parseHtml });
  assert.equal(doc.mode, 'html');
  assert.equal(doc.title, 'Standing Desk Buying Guide: Frames, Mats and Accessories | DeskLab');
  const text = doc.blocks.join('\n');
  assert.ok(!/Reviews|Deals|Log in/.test(text), 'nav removed');
  assert.ok(!/All rights reserved|Share this article/.test(text), 'footer removed');
  assert.ok(!/dataLayer|color: red/.test(text), 'script/style removed');
  assert.ok(!/We use cookies/.test(text), 'cookie banner (id match) removed');
  assert.ok(!/Weekly desk deals/.test(text), 'sidebar (class match) removed');
  assert.equal(doc.headings[0].level, 1);
  assert.equal(doc.headings[0].text, 'Standing Desk Buying Guide', 'h1 in <header> outside <main> kept');
  assert.equal(doc.blocks[0], 'Standing Desk Buying Guide');
  assert.ok(doc.headings.some((h) => h.level === 2 && h.text === 'Frame and Motor'));
  assert.ok(doc.blocks.length > 10, 'blocks are separate strings');
  assert.ok(doc.blocks.every((b) => !/\n/.test(b)));
  assert.ok(doc.words > 300);

  const nested = extractHtml(
    '<html><body><main><ul><li>First item <p>with nested paragraph</p></li><li>Second</li></ul>' +
      '<div>Direct text <span>inline</span></div><div><p>Only a child</p></div><h4>Minor</h4></main></body></html>',
    { parse: parseHtml },
  );
  assert.deepEqual(nested.blocks, ['First item', 'with nested paragraph', 'Second', 'Direct text inline', 'Only a child', 'Minor']);
  assert.equal(nested.headings.length, 0, 'h4 is a block but not a heading');
  assert.ok(nested.blocks.every((b) => b.split(' ').length < 6), 'body.textContent never used as one string');

  const noBody = extractHtml('Just some plain words. No tags here.', { parse: parseHtml });
  assert.equal(noBody.mode, 'text');
  assert.ok(noBody.notices[0].includes('plain text'));
});

// Test 15
test('extract text mode: Markdown and Title Case heading detection, cap fallback', () => {
  const doc = extractText('## Foo\nSome body text here that is long enough to count as a paragraph.\n\nCable Management\n\nRoute cables under the desk so nothing pulls when it rises.\nThis is a long sentence that would never be mistaken for a heading because it goes on.\nshort lowercase line\n');
  assert.deepEqual(doc.headings.map((h) => [h.level, h.text]), [[2, 'Foo'], [2, 'Cable Management']]);
  assert.equal(doc.blocks[0], 'Foo');
  assert.ok(doc.blocks.includes('short lowercase line'));

  const followed = extractText('Getting the Height Right\nSet the desk surface at elbow height when you stand and keep your wrists neutral.');
  assert.equal(followed.headings.length, 1, 'Title Case line followed by a much longer paragraph');
  const notFollowed = extractText('Getting the Height Right\nShort line after.');
  assert.equal(notFollowed.headings.length, 0);
  const terminal = extractText('Getting the Height Right.\n\nBody.');
  assert.equal(terminal.headings.length, 0, 'terminal period disqualifies');

  const off = extractText('## Foo\nBar', { detectHeadings: false });
  assert.equal(off.headings.length, 0);

  const lines = ['# Real Heading'];
  for (let i = 0; i < CAPS.detectedHeadings + 5; i++) lines.push(`Title Case Line Number ${i}`, '');
  const many = extractText(lines.join('\n'));
  assert.deepEqual(many.headings.map((h) => h.text), ['Real Heading']);
  assert.ok(many.notices.some((n) => /Markdown/.test(n)));
});

test('extract: URL detection helper', () => {
  assert.ok(looksLikeUrl('https://example.com/page'));
  assert.ok(looksLikeUrl('www.example.com'));
  assert.ok(looksLikeUrl(' example.co.uk/path?q=1 '));
  assert.ok(!looksLikeUrl('Visit https://example.com for more'));
  assert.ok(!looksLikeUrl('Standing desks are great.'));
});
