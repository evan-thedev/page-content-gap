import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, toMarkdown, csvField, CSV_COLUMNS } from '../assets/js/export.js';
import { createLicense, isValidSessionId } from '../assets/js/license.js';
import { createScenarioStore } from '../assets/js/storage.js';
import { analyzeFixture, fakeStorage } from './helpers.mjs';

// Test 16
test('export: CSV has BOM, quoting, section column; Markdown has three tables with matching counts', () => {
  const result = analyzeFixture();
  const sections = {
    gaps: result.gaps.map((g) => ({ ...g })),
    headingGaps: result.headingGaps,
    entityGaps: result.entityGaps,
    meta: { yourLabel: 'Yours', competitorLabels: ['A', 'B', 'C'] },
  };
  sections.gaps[0] = { ...sections.gaps[0], term: 'weird, "quoted"\nterm' };

  const csv = toCSV(sections);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split('\r\n').filter(Boolean);
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.ok(lines[0].startsWith('section,'));
  assert.equal(lines.length - 1, result.gaps.length + result.headingGaps.length + result.entityGaps.length);
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
  assert.equal(csvField('plain'), 'plain');
  assert.ok(csv.includes('"weird, ""quoted""\nterm"'));
  assert.ok(lines.some((l) => l.startsWith('gap phrase,')));
  assert.ok(lines.some((l) => l.startsWith('heading gap,')));
  assert.ok(lines.some((l) => l.startsWith('entity gap,')));

  const md = toMarkdown(sections);
  const tables = md.split('\n## ').slice(1);
  assert.equal(tables.length, 3);
  const rowsIn = (t) => t.split('\n').filter((l) => l.startsWith('|')).length - 2;
  assert.equal(rowsIn(tables[0]), result.gaps.length);
  assert.equal(rowsIn(tables[1]), result.headingGaps.length);
  assert.equal(rowsIn(tables[2]), result.entityGaps.length);
  assert.ok(md.includes('| cable management |') || md.includes('| anti fatigue mat |'));
});

// Test 17
test('license: locked by default; valid session id unlocks; invalid rejected; clear works', () => {
  const lic = createLicense(fakeStorage());
  assert.equal(lic.isUnlocked(), false);
  assert.equal(lic.setUnlock('cs_test_abc'), true);
  assert.equal(lic.isUnlocked(), true);
  assert.equal(lic.getUnlock().ref, 'cs_test_abc');
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(lic.getUnlock().at));

  const lic2 = createLicense(fakeStorage());
  assert.equal(lic2.setUnlock('pi_123'), false);
  assert.equal(lic2.setUnlock('cs_abc'), false);
  assert.equal(lic2.setUnlock(''), false);
  assert.equal(lic2.setUnlock('cs_live_'), false);
  assert.equal(lic2.isUnlocked(), false);
  assert.equal(lic2.setUnlock('  cs_live_a1B2c3  '), true);
  lic2.clearUnlock();
  assert.equal(lic2.isUnlocked(), false);

  assert.ok(isValidSessionId('cs_live_abc123'));
  assert.ok(!isValidSessionId('cs_test_abc-123'));
  assert.ok(!isValidSessionId('<script>'));

  const corrupted = fakeStorage();
  corrupted.setItem('pcg:unlock', '{not json');
  assert.equal(createLicense(corrupted).isUnlocked(), false);
});

test('storage: scenarios CRUD, cap, export/import round trip', () => {
  const store = createScenarioStore(fakeStorage(), { max: 3 });
  const inputs = [{ label: 'Yours', mode: 'text', text: 'a' }, { label: 'A', mode: 'html', text: '<p>b</p>' }];
  const s1 = store.save({ name: 'First', inputs, settings: { extraStopwords: 'foo', exclusions: '', detectHeadings: true } });
  store.save({ name: 'Second', inputs });
  store.save({ name: 'Third', inputs });
  assert.throws(() => store.save({ name: 'Fourth', inputs }), /Limit/);
  store.save({ name: 'first', inputs: [] }); // same name (case-insensitive) overwrites
  assert.equal(store.list().length, 3);
  assert.deepEqual(store.get(s1.id).inputs, []);
  store.rename(s1.id, 'Renamed');
  assert.equal(store.get(s1.id).name, 'Renamed');
  const json = store.exportJSON();
  assert.ok(store.remove(s1.id));
  assert.equal(store.list().length, 2);
  const other = createScenarioStore(fakeStorage(), { max: 20 });
  assert.equal(other.importJSON(json), 3);
  assert.throws(() => other.importJSON('nope'), /JSON/);
  assert.throws(() => other.importJSON('{"scenarios":[]}'), /No scenarios/);
});
