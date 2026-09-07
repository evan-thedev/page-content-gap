// UI only: state, render, events, gate(). Algorithms live in the pure modules.

import {
  STRIPE_PAYMENT_LINK, PRICE_LABEL, CAPS, LIMITS, DISCLAIMER_SENTENCE, REFUND_LINE, PER_BROWSER_NOTE,
} from './config.js';
import { extract, looksLikeUrl } from './extract.js';
import { analyze } from './analyze.js';
import { toCSV, toMarkdown, downloadText, copyText } from './export.js';
import { isUnlocked, getUnlock, clearUnlock } from './license.js';
import { createScenarioStore } from './storage.js';
import { countWords } from './tokenize.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en-US');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const DOC_DEFS = [
  { key: 'yours', title: 'Your page', defaultLabel: 'Your page', isYours: true },
  { key: 'c1', title: 'Competitor 1', defaultLabel: 'Competitor 1' },
  { key: 'c2', title: 'Competitor 2', defaultLabel: 'Competitor 2' },
  { key: 'c3', title: 'Competitor 3', defaultLabel: 'Competitor 3' },
];

const TABS = [
  { id: 'gaps', label: 'Gap phrases', feature: 'gaps' },
  { id: 'headings', label: 'Heading gaps', feature: 'headings' },
  { id: 'h2s', label: 'Suggested H2s', feature: 'h2s' },
  { id: 'entities', label: 'Entities (heuristic)', feature: 'entities', tip: 'Capitalized names plus a curated list. Not a language model.' },
  { id: 'shared', label: 'Shared', feature: 'shared' },
  { id: 'onlyyou', label: 'Only you', feature: 'onlyyou' },
];

const state = {
  docs: DOC_DEFS.map((d) => ({ ...d, label: '', mode: 'text', text: '' })),
  settings: { extraStopwords: '', exclusions: '', detectHeadings: true },
  data: { entities: [], boilerplate: [] },
  result: null,
  extracted: null,
  unlocked: isUnlocked(),
  tab: 'gaps',
  filters: { n: 'all', minCov: 1, hideNumbers: false, search: '' },
  sort: { key: null, dir: 'desc' },
  worker: null,
  busy: false,
};

const scenarios = createScenarioStore();

/* ---------- boot ---------- */

async function loadData() {
  const get = async (path) => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch {
      return [];
    }
  };
  const [entities, boilerplate] = await Promise.all([get('assets/data/entities.json'), get('assets/data/boilerplate.json')]);
  state.data = { entities, boilerplate };
}

function init() {
  $$('[data-price]').forEach((el) => { el.textContent = PRICE_LABEL; });
  $('#btn-buy').href = STRIPE_PAYMENT_LINK;
  $('#modal-disclaimer').textContent = DISCLAIMER_SENTENCE;
  $('#modal-per-browser').textContent = PER_BROWSER_NOTE;
  $('#modal-refund').textContent = REFUND_LINE;
  $('#footer-disclaimer').textContent = DISCLAIMER_SENTENCE;

  renderDocGrid();
  renderUnlockStatus();
  bindEvents();
  loadData();
  restoreSession();
}

/* ---------- inputs ---------- */

function renderDocGrid() {
  const grid = $('#doc-grid');
  grid.innerHTML = state.docs.map((d, i) => `
    <div class="doc ${d.isYours ? 'is-yours' : ''}" data-index="${i}">
      <div class="doc-head">
        <span class="doc-title">${esc(d.title)}</span>
        <input class="doc-label" type="text" placeholder="Label (optional)" aria-label="${esc(d.title)} label" maxlength="60" value="${esc(d.label)}">
        <div class="mode" role="radiogroup" aria-label="${esc(d.title)} input format">
          <label><input type="radio" name="mode-${d.key}" value="text" ${d.mode === 'text' ? 'checked' : ''}><span>Plain text</span></label>
          <label><input type="radio" name="mode-${d.key}" value="html" ${d.mode === 'html' ? 'checked' : ''}><span>HTML</span></label>
        </div>
      </div>
      <textarea id="ta-${d.key}" aria-label="${esc(d.title)} content" placeholder="${d.isYours ? 'Paste your page text or HTML…' : 'Paste a competitor page (optional)…'}" spellcheck="false">${esc(d.text)}</textarea>
      <div class="doc-foot">
        <span class="doc-words" id="words-${d.key}"></span>
        <span class="doc-hint" id="hint-${d.key}"></span>
      </div>
    </div>`).join('');

  state.docs.forEach((d, i) => {
    const root = grid.children[i];
    const ta = $('textarea', root);
    ta.addEventListener('input', () => { d.text = ta.value; updateDocFoot(d); saveSessionSoon(); });
    $('.doc-label', root).addEventListener('input', (e) => { d.label = e.target.value; saveSessionSoon(); });
    $$('input[type=radio]', root).forEach((r) => r.addEventListener('change', () => {
      d.mode = r.value;
      updateDocFoot(d);
      saveSessionSoon();
    }));
    updateDocFoot(d);
  });
}

function updateDocFoot(d) {
  const words = $(`#words-${d.key}`);
  const hint = $(`#hint-${d.key}`);
  const text = d.text || '';
  const n = text.trim() ? countWords([text.replace(/<[^>]+>/g, ' ')]) : 0;
  words.textContent = text.trim() ? `${fmt(n)} words · ${fmt(text.length)} chars` : '';
  hint.className = 'doc-hint';
  hint.textContent = '';
  if (!text.trim()) return;
  if (text.length > LIMITS.maxChars) {
    hint.classList.add('err');
    hint.textContent = `Too long — trim to under ${fmt(LIMITS.maxChars)} characters.`;
  } else if (looksLikeUrl(text)) {
    hint.textContent = "v1 doesn't fetch URLs. Open the page, select all, copy, paste here — or paste its HTML from View Source.";
  } else if (d.mode === 'text' && /<\/(p|div|h[1-6]|li|body)>/i.test(text)) {
    hint.textContent = 'This looks like HTML — switch the format to HTML for cleaner results.';
  } else if (n < LIMITS.shortDocWords) {
    hint.textContent = 'Very short — results will be noisy.';
  }
}

function syncDocsToDom() {
  state.docs.forEach((d, i) => {
    const root = $('#doc-grid').children[i];
    if (!root) return;
    $('textarea', root).value = d.text;
    $('.doc-label', root).value = d.label;
    const radio = $(`input[name=mode-${d.key}][value=${d.mode}]`, root);
    if (radio) radio.checked = true;
    updateDocFoot(d);
  });
  $('#extra-stopwords').value = state.settings.extraStopwords;
  $('#exclusions').value = state.settings.exclusions;
  $('#detect-headings').checked = state.settings.detectHeadings;
}

function readSettings() {
  state.settings.extraStopwords = $('#extra-stopwords').value;
  state.settings.exclusions = $('#exclusions').value;
  state.settings.detectHeadings = $('#detect-headings').checked;
}

/* ---------- session persistence (inputs survive a reload; local only) ---------- */

const SESSION_KEY = 'pcg:session';
const saveSessionSoon = debounce(saveSession, 600);

function saveSession() {
  try {
    readSettings();
    const payload = { docs: state.docs.map((d) => ({ label: d.label, mode: d.mode, text: d.text })), settings: state.settings };
    const json = JSON.stringify(payload);
    if (json.length > 4_000_000) return;
    sessionStorage.setItem(SESSION_KEY, json);
  } catch { /* ignore quota errors */ }
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    (parsed.docs || []).forEach((d, i) => { if (state.docs[i]) Object.assign(state.docs[i], { label: d.label || '', mode: d.mode === 'html' ? 'html' : 'text', text: d.text || '' }); });
    if (parsed.settings) Object.assign(state.settings, parsed.settings);
    syncDocsToDom();
  } catch { /* ignore */ }
}

/* ---------- demo ---------- */

async function loadDemo() {
  setStatus('Loading demo pages…', 'busy');
  const files = [
    ['yours', 'samples/yours.txt', 'text', 'Your draft'],
    ['c1', 'samples/competitor-1.html', 'html', 'DeskLab'],
    ['c2', 'samples/competitor-2.txt', 'text', 'Setup guide'],
    ['c3', 'samples/competitor-3.txt', 'text', 'Sit-stand guide'],
  ];
  try {
    const texts = await Promise.all(files.map(([, path]) => fetch(path).then((r) => { if (!r.ok) throw new Error(path); return r.text(); })));
    files.forEach(([key, , mode, label], i) => {
      const d = state.docs.find((x) => x.key === key);
      d.text = texts[i];
      d.mode = mode;
      d.label = label;
    });
    syncDocsToDom();
    saveSession();
    setStatus('Demo pages loaded.');
    runAnalysis();
  } catch (err) {
    setStatus('Could not load demo pages (are you opening index.html from disk? Serve it over http).', 'err');
  }
}

/* ---------- analysis ---------- */

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function validateInputs() {
  const yours = state.docs[0];
  if (!yours.text.trim()) return 'Paste your page first.';
  const comps = state.docs.slice(1).filter((d) => d.text.trim());
  if (!comps.length) return 'Paste at least one competitor page.';
  for (const d of [yours, ...comps]) {
    if (d.text.length > LIMITS.maxChars) return `${d.label || d.title}: trim to under ${fmt(LIMITS.maxChars)} characters.`;
    if (looksLikeUrl(d.text)) return `${d.label || d.title} contains only a URL. v1 doesn't fetch URLs — open the page, select all, copy, paste here, or paste its HTML from View Source.`;
  }
  return null;
}

function extractAll() {
  readSettings();
  const opts = { detectHeadings: state.settings.detectHeadings };
  const yours = state.docs[0];
  const yoursDoc = extract(yours.text, yours.mode, { ...opts, label: yours.label || yours.defaultLabel });
  const competitors = state.docs.slice(1).filter((d) => d.text.trim()).map((d) => extract(d.text, d.mode, { ...opts, label: d.label || d.defaultLabel }));
  return { yours: yoursDoc, competitors };
}

function runInWorker(input) {
  return new Promise((resolve, reject) => {
    try {
      if (!state.worker) state.worker = new Worker('assets/js/worker.js', { type: 'module' });
    } catch (err) {
      reject(err);
      return;
    }
    const id = Math.random().toString(36).slice(2);
    const onMessage = (e) => {
      if (!e.data || e.data.id !== id) return;
      state.worker.removeEventListener('message', onMessage);
      state.worker.removeEventListener('error', onError);
      if (e.data.ok) resolve(e.data.result); else reject(new Error(e.data.error));
    };
    const onError = (e) => {
      state.worker.removeEventListener('message', onMessage);
      state.worker.removeEventListener('error', onError);
      state.worker = null;
      reject(e.error || new Error('Worker failed'));
    };
    state.worker.addEventListener('message', onMessage);
    state.worker.addEventListener('error', onError);
    state.worker.postMessage({ id, input });
  });
}

async function runAnalysis() {
  if (state.busy) return;
  const problem = validateInputs();
  if (problem) { setStatus(problem, 'err'); return; }
  state.busy = true;
  $('#btn-analyze').disabled = true;
  setStatus('Analyzing…', 'busy');
  try {
    const extracted = extractAll();
    state.extracted = extracted;
    const input = { ...extracted, settings: { extraStopwords: state.settings.extraStopwords, exclusions: state.settings.exclusions }, data: state.data };
    const totalWords = extracted.yours.words + extracted.competitors.reduce((s, d) => s + d.words, 0);
    let result;
    if (totalWords > LIMITS.workerThresholdWords && typeof Worker !== 'undefined') {
      setStatus(`Analyzing ${fmt(totalWords)} words in a background worker…`, 'busy');
      try { result = await runInWorker(input); } catch { result = analyze(input); }
    } else {
      await new Promise((r) => setTimeout(r, 0));
      result = analyze(input);
    }
    state.result = result;
    state.sort = { key: null, dir: 'desc' };
    setStatus(`Done in ${result.ms} ms · ${fmt(totalWords)} words · ${result.K} competitor${result.K === 1 ? '' : 's'}.`);
    renderResults();
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    setStatus('Analysis failed: ' + (err && err.message ? err.message : err), 'err');
  } finally {
    state.busy = false;
    $('#btn-analyze').disabled = false;
  }
}

/* ---------- gating ---------- */

const FEATURE_LABELS = {
  export: 'CSV / Markdown export',
  scenarios: 'Saved scenarios',
  gaps: 'the full gap-phrase table',
  shared: 'the full shared-phrase list',
  headings: 'heading gaps',
  entities: 'entity-style gaps',
  h2s: 'suggested H2s',
  onlyyou: 'the "only you" section',
  scores: 'summary scores',
  hero: 'the full report',
};

function gate(el, feature) {
  el.dataset.gated = feature;
  el.classList.toggle('is-locked', !state.unlocked);
  el.setAttribute('aria-describedby', state.unlocked ? '' : 'unlock-title');
}

function openUnlockModal(feature) {
  const ctx = $('#unlock-context');
  const r = state.result;
  const what = FEATURE_LABELS[feature] || 'the full report';
  const counts = r ? ` This report has ${fmt(r.gapTotal)} gap phrases, ${fmt(r.headingGaps.length)} heading gaps, and ${fmt(r.entityTotal)} entity-style gaps waiting.` : '';
  ctx.textContent = `Unlock ${what} and everything below, in this browser, for a one-time ${PRICE_LABEL}.${counts}`;
  const dlg = $('#unlock-modal');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function refreshUnlockState() {
  const now = isUnlocked();
  if (now !== state.unlocked) {
    state.unlocked = now;
    renderUnlockStatus();
    if (state.result) renderResults();
  }
}

function renderUnlockStatus() {
  const el = $('#unlock-status');
  if (state.unlocked) {
    const u = getUnlock();
    el.innerHTML = `<span class="badge ok">Full report unlocked</span> · <button type="button" id="btn-manage-unlock">Manage</button>`;
    $('#btn-manage-unlock', el).addEventListener('click', () => {
      const ref = u && u.ref ? u.ref : 'unknown';
      const at = u && u.at ? new Date(u.at).toLocaleString() : '';
      el.innerHTML = `<span class="badge ok">Unlocked</span> <code>${esc(ref)}</code> ${esc(at ? '· ' + at : '')} · <button type="button" id="btn-remove-unlock">Remove unlock</button> · <button type="button" id="btn-close-manage">Close</button>`;
      $('#btn-remove-unlock', el).addEventListener('click', () => {
        if (confirm('Remove the unlock from this browser? You will need your Stripe receipt to restore it.')) {
          clearUnlock();
          refreshUnlockState();
        }
      });
      $('#btn-close-manage', el).addEventListener('click', renderUnlockStatus);
    });
  } else {
    el.innerHTML = `<span class="badge locked">Free teaser</span> · <button type="button" data-unlock="footer">Unlock full report — ${esc(PRICE_LABEL)}</button>`;
  }
  $('#btn-hero-unlock').hidden = state.unlocked;
}

/* ---------- results rendering ---------- */

function renderResults() {
  const r = state.result;
  if (!r) return;
  $('#results').hidden = false;
  renderNotices(r);
  renderSummary(r);
  renderTabs(r);
  renderActiveTab();
  $$('#export-bar [data-gated]').forEach((b) => gate(b, b.dataset.gated));
}

function renderNotices(r) {
  const items = [];
  const all = [r.docs.yours, ...r.docs.competitors];
  for (const d of all) {
    for (const n of d.notices || []) items.push(`${d.label}: ${n}`);
    if (d.words < LIMITS.shortDocWords) items.push(`${d.label}: very short (${d.words} words) — results will be noisy.`);
  }
  if (!r.headingGaps.length && r.scores.totalTopics === 0) items.push('No competitor headings found. For plain text, keep "Detect headings" on or use Markdown # headings; for HTML, paste the full source.');
  $('#notices').innerHTML = items.map((t) => `<div class="notice">${esc(t)}</div>`).join('');
}

function renderSummary(r) {
  const w = r.scores.words;
  const compWords = r.docs.competitors.map((d) => `<span class="term">${esc(d.label)}</span> ${fmt(d.words)}`).join(' · ');
  const locked = !state.unlocked;
  const lockedStat = (label, value, sub) => `
    <div class="stat locked" data-unlock="scores" role="button" tabindex="0" aria-label="${esc(label)} — unlock to view">
      <div class="label">${esc(label)} <span class="badge locked">Unlock</span></div>
      <div class="value" aria-hidden="true">${esc(value)}</div>
      <div class="sub">${esc(sub)}</div>
    </div>`;
  const stat = (label, value, sub) => `
    <div class="stat"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  $('#summary').innerHTML = [
    stat('Your word count', fmt(w.yours), `${w.shorterThanAll ? '<span class="badge warn">shorter than all competitors</span>' : `vs avg ${fmt(w.avg)}`}`),
    stat('Competitors', `${fmt(w.min)}–${fmt(w.max)}`, `avg ${fmt(w.avg)} · ${compWords}`),
    locked ? lockedStat('Phrase coverage', '00.0%', 'share of competitor phrases you cover')
      : stat('Phrase coverage', r.scores.phraseCoverage == null ? '—' : `${r.scores.phraseCoverage}%`, `of ${fmt(r.scores.eligible)} eligible competitor phrases`),
    locked ? lockedStat('Heading coverage', '00.0%', 'share of competitor heading topics you cover')
      : stat('Heading coverage', r.scores.headingCoverage == null ? '—' : `${r.scores.headingCoverage}%`, `${fmt(r.scores.matchedTopics)} of ${fmt(r.scores.totalTopics)} topics`),
    stat('Gaps found', fmt(r.gapTotal), `${fmt(r.headingGaps.length)} heading · ${fmt(r.entityTotal)} entity · ${fmt(r.suggestedH2s.length)} suggested H2s`),
  ].join('');
}

function tabCount(r, id) {
  switch (id) {
    case 'gaps': return r.gapTotal;
    case 'headings': return r.headingGaps.length;
    case 'h2s': return r.suggestedH2s.length;
    case 'entities': return r.entityTotal;
    case 'shared': return r.sharedTotal;
    case 'onlyyou': return r.onlyYouTotal;
    default: return 0;
  }
}

function renderTabs(r) {
  $('#tabs').innerHTML = TABS.map((t) => `
    <button type="button" class="tab" role="tab" id="tab-${t.id}" aria-selected="${state.tab === t.id}" aria-controls="panel-${t.id}" data-tab="${t.id}" ${t.tip ? `title="${esc(t.tip)}"` : ''}>
      ${esc(t.label)}<span class="count">${fmt(tabCount(r, t.id))}</span>${!state.unlocked && t.id !== 'gaps' && t.id !== 'shared' ? ' <span class="badge locked">$</span>' : ''}
    </button>`).join('');
}

function renderActiveTab() {
  const r = state.result;
  const panel = $('#tab-panels');
  $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
  let html = '';
  switch (state.tab) {
    case 'gaps': html = renderGapsTab(r); break;
    case 'headings': html = state.unlocked ? renderHeadingsTab(r) : lockedPanel('headings', r.headingGaps.length, 'heading gaps', 'Competitor H1–H3 topics your page does not cover, with your closest heading beside each.'); break;
    case 'h2s': html = state.unlocked ? renderH2sTab(r) : lockedPanel('h2s', r.suggestedH2s.length, 'suggested H2s', 'Competitor sections you are missing, ready for a brief. Derived from their headings — no AI.'); break;
    case 'entities': html = state.unlocked ? renderEntitiesTab(r) : lockedPanel('entities', r.entityTotal, 'entity-style gaps', 'Capitalized names and curated tools/brands/standards competitors mention that you do not.'); break;
    case 'shared': html = renderSharedTab(r); break;
    case 'onlyyou': html = state.unlocked ? renderOnlyYouTab(r) : lockedPanel('onlyyou', r.onlyYouTotal, 'phrases only you use', 'Terms frequent on your page and absent from every competitor — off-topic drift or a unique angle.'); break;
    default: html = '';
  }
  panel.innerHTML = `<div class="tab-panel" role="tabpanel" id="panel-${state.tab}" aria-labelledby="tab-${state.tab}">${html}</div>`;
  bindTabPanelEvents();
}

function lockedPanel(feature, count, noun, description) {
  return `
    <div class="locked-panel">
      <div class="big">${fmt(count)}</div>
      <p><strong>${esc(noun)}</strong> found in this report.</p>
      <p class="muted">${esc(description)}</p>
      <button type="button" class="btn btn-accent" data-unlock="${feature}">Unlock ${esc(PRICE_LABEL)}</button>
    </div>`;
}

function lockedBand(r, moreGaps) {
  const items = [
    moreGaps > 0 ? `<span><strong>${fmt(moreGaps)}</strong> more gap phrases</span>` : '',
    `<span><strong>${fmt(r.headingGaps.length)}</strong> heading gaps</span>`,
    `<span><strong>${fmt(r.entityTotal)}</strong> entity-style gaps</span>`,
    `<span><strong>${fmt(r.suggestedH2s.length)}</strong> suggested H2s</span>`,
    '<span>CSV / Markdown export</span>',
  ].filter(Boolean).join('');
  return `
    <div class="locked-band" data-unlock="gaps">
      <div><strong>Locked in the free teaser</strong><div class="items">${items}</div></div>
      <button type="button" class="btn btn-accent" data-unlock="gaps">Unlock ${esc(PRICE_LABEL)}</button>
    </div>`;
}

function hasDigit(term) { return /\d/.test(term); }

function filteredGaps(r) {
  let rows = r.gaps;
  if (!state.unlocked) return rows;
  const f = state.filters;
  if (f.n !== 'all') rows = rows.filter((g) => g.n === Number(f.n));
  if (f.minCov > 1) rows = rows.filter((g) => g.cov >= f.minCov);
  if (f.hideNumbers) rows = rows.filter((g) => !hasDigit(g.term));
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    rows = rows.filter((g) => g.term.includes(q) || g.subsumes.some((s) => s.includes(q)));
  }
  if (state.sort.key) {
    const { key, dir } = state.sort;
    const val = (g) => {
      if (key.startsWith('pc:')) return g.perCompetitor[Number(key.slice(3))];
      if (key === 'inHeading') return g.inHeading ?? 99;
      return g[key];
    };
    rows = rows.slice().sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      let c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      if (c === 0) c = a.term.localeCompare(b.term);
      return dir === 'asc' ? c : -c;
    });
  }
  return rows;
}

function sortButton(label, key, cls = '') {
  const active = state.sort.key === key;
  const aria = active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<th scope="col" class="${cls}"><button type="button" data-sort="${esc(key)}" aria-sort="${aria}">${esc(label)}</button></th>`;
}

function renderGapsTab(r) {
  const labels = r.docs.competitors.map((d) => d.label);
  const rows = filteredGaps(r);
  const shown = state.unlocked ? rows : rows.slice(0, CAPS.teaserGapRows);
  const filters = state.unlocked ? `
    <div class="filters">
      <label>Phrase length <select id="f-n">
        <option value="all" ${state.filters.n === 'all' ? 'selected' : ''}>1–3 words</option>
        <option value="1" ${state.filters.n === '1' ? 'selected' : ''}>1 word</option>
        <option value="2" ${state.filters.n === '2' ? 'selected' : ''}>2 words</option>
        <option value="3" ${state.filters.n === '3' ? 'selected' : ''}>3 words</option>
      </select></label>
      <label>Min competitors <select id="f-cov">
        ${[1, 2, 3].filter((k) => k <= r.K).map((k) => `<option value="${k}" ${state.filters.minCov === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></label>
      <label><input type="checkbox" id="f-numbers" ${state.filters.hideNumbers ? 'checked' : ''}> Hide numbers</label>
      <label>Search <input type="search" id="f-search" value="${esc(state.filters.search)}" placeholder="phrase…"></label>
      <span class="muted">${fmt(rows.length)} of ${fmt(r.gapTotal)} rows${r.gapTotal > CAPS.gapRows ? ` (top ${CAPS.gapRows})` : ''}</span>
      <button type="button" class="btn btn-small btn-ghost" id="f-reset">Reset</button>
    </div>` : `<p class="muted small">Free teaser: the first ${CAPS.teaserGapRows} of ${fmt(r.gapTotal)} gap phrases, in the same order as the full table. Coverage shows how many competitors use each phrase.</p>`;

  const head = `
    <tr>
      <th scope="col" class="num">#</th>
      ${sortButton('Phrase', 'term')}
      ${sortButton('n', 'n', 'num')}
      ${sortButton('Union', 'unionCount', 'num')}
      ${sortButton('Competitors', 'cov', 'num')}
      ${labels.map((l, i) => sortButton(l, 'pc:' + i, 'num')).join('')}
      ${sortButton('In heading', 'inHeading')}
      <th scope="col">Suggested action</th>
    </tr>`;
  const body = shown.map((g, i) => `
    <tr class="${i < 3 && !state.sort.key ? 'rank-top' : ''}">
      <td class="num">${i + 1}</td>
      <td class="term">${esc(g.term)}${g.subsumes.length ? `<div class="also" title="Shorter phrases hidden under this row">also: ${esc(g.subsumes.join(', '))}</div>` : ''}</td>
      <td class="num">${g.n}</td>
      <td class="num">${g.unionCount}</td>
      <td class="num">${g.cov}/${g.K}</td>
      ${g.perCompetitor.map((c) => `<td class="num">${c}</td>`).join('')}
      <td>${g.inHeading ? `h${g.inHeading}` : '—'}</td>
      <td>${esc(g.action)}</td>
    </tr>`).join('');
  const table = shown.length
    ? `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`
    : `<div class="empty">No gap phrases${state.unlocked ? ' match these filters' : ''}. ${r.gapTotal ? '' : 'Your page already covers every eligible competitor phrase — or the inputs are very short.'}</div>`;
  const band = state.unlocked ? '' : lockedBand(r, r.gapTotal - shown.length);
  return filters + table + band;
}

function renderSharedTab(r) {
  const labels = r.docs.competitors.map((d) => d.label);
  const rows = state.unlocked ? r.shared : r.shared.slice(0, CAPS.teaserSharedRows);
  const intro = `<p class="muted small">Phrases frequent on both sides — a sanity check that the comparison is on-topic.${state.unlocked ? '' : ` Free teaser shows ${CAPS.teaserSharedRows} of ${fmt(r.sharedTotal)}.`}</p>`;
  const table = rows.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th scope="col" class="num">#</th><th scope="col">Phrase</th><th scope="col" class="num">n</th><th scope="col" class="num">You</th><th scope="col" class="num">Union</th><th scope="col" class="num">Competitors</th>${labels.map((l) => `<th scope="col" class="num">${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((g, i) => `<tr><td class="num">${i + 1}</td><td class="term">${esc(g.term)}</td><td class="num">${g.n}</td><td class="num">${g.yourCount}</td><td class="num">${g.unionCount}</td><td class="num">${g.cov}/${g.K}</td>${g.perCompetitor.map((c) => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">No shared phrases — are these pages about the same topic?</div>';
  const band = state.unlocked || r.sharedTotal <= rows.length ? '' : `
    <div class="locked-band" data-unlock="shared"><div><strong>${fmt(r.sharedTotal - rows.length)} more shared phrases</strong></div><button type="button" class="btn btn-accent" data-unlock="shared">Unlock ${esc(PRICE_LABEL)}</button></div>`;
  return intro + table + band;
}

function renderHeadingsTab(r) {
  if (!r.headingGaps.length) return '<div class="empty">No heading gaps — every competitor H1–H3 topic has a match on your page (Jaccard ≥ 0.5), or no competitor headings were found.</div>';
  const rows = r.headingGaps.map((h, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><strong>${esc(h.heading)}</strong>${h.variants.length ? `<div class="variants">${esc(h.variants.join(' · '))}</div>` : ''}</td>
      <td class="num">${h.covH}/${h.K}</td>
      <td>${h.levels.map((l) => 'h' + l).join(', ')}</td>
      <td class="num">${fmt(h.avgSectionWords)}</td>
      <td>${h.yourClosest.text ? `${esc(h.yourClosest.text)} <span class="muted">(${h.yourClosest.sim})</span>` : '<span class="muted">—</span>'}</td>
    </tr>`).join('');
  return `
    <p class="muted small">Competitor H1–H3 topics (Jaccard similarity to your headings &lt; 0.5). Exact tokens only: <code>cables</code> ≠ <code>cable</code>. Check "your closest" to judge false positives.</p>
    <div class="table-wrap"><table>
      <thead><tr><th scope="col" class="num">#</th><th scope="col">Topic (shortest variant)</th><th scope="col" class="num">Competitors</th><th scope="col">Levels</th><th scope="col" class="num">Avg section words</th><th scope="col">Your closest heading (sim)</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

function renderH2sTab(r) {
  if (!r.suggestedH2s.length) return '<div class="empty">No suggested H2s — no competitor h2 topics are missing from your page.</div>';
  return `
    <p class="muted small">Competitor h2 topics you don't cover (h3 when two or more competitors share it), in Title Case. Deterministic — derived from their headings, not written for you.</p>
    <ul class="h2list">${r.suggestedH2s.map((h) => `
      <li><span class="h2text">${esc(h.text)}</span><span class="meta">used by ${h.covH}/${h.K} competitor${h.K === 1 ? '' : 's'}${h.variants.length ? ` · variants: ${esc(h.variants.join(' · '))}` : ''}</span></li>`).join('')}
    </ul>`;
}

function renderEntitiesTab(r) {
  const labels = r.docs.competitors.map((d) => d.label);
  if (!r.entityGaps.length) return '<div class="empty">No entity-style gaps found.</div>';
  return `
    <p class="muted small">Capitalized names plus a curated list of tools, brands and standards. Heuristic — not a language model. Expect misses and false positives. Add brand names to the exclusion list to hide them.</p>
    <div class="table-wrap"><table>
      <thead><tr><th scope="col" class="num">#</th><th scope="col">Entity</th><th scope="col" class="num">Union</th><th scope="col" class="num">Competitors</th>${labels.map((l) => `<th scope="col" class="num">${esc(l)}</th>`).join('')}<th scope="col">Source</th></tr></thead>
      <tbody>${r.entityGaps.map((e, i) => `<tr><td class="num">${i + 1}</td><td class="term">${esc(e.surface)}</td><td class="num">${e.unionCount}</td><td class="num">${e.cov}/${e.K}</td>${e.perCompetitor.map((c) => `<td class="num">${c}</td>`).join('')}<td class="muted">${e.source === 'curated' ? 'curated list' : 'capitalized'}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function renderOnlyYouTab(r) {
  if (!r.onlyYou.length) return '<div class="empty">Nothing here — every phrase you repeat also appears on at least one competitor page.</div>';
  return `
    <details class="onlyyou">
      <summary>${fmt(r.onlyYouTotal)} phrases frequent on your page and absent from every competitor</summary>
      <p class="muted small">Useful for spotting off-topic drift — or your unique angle.</p>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col" class="num">#</th><th scope="col">Phrase</th><th scope="col" class="num">n</th><th scope="col" class="num">Your count</th></tr></thead>
        <tbody>${r.onlyYou.map((g, i) => `<tr><td class="num">${i + 1}</td><td class="term">${esc(g.term)}</td><td class="num">${g.n}</td><td class="num">${g.yourCount}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>`;
}

function bindTabPanelEvents() {
  const panel = $('#tab-panels');
  const fn = $('#f-n', panel);
  if (fn) fn.addEventListener('change', () => { state.filters.n = fn.value; renderActiveTab(); });
  const fc = $('#f-cov', panel);
  if (fc) fc.addEventListener('change', () => { state.filters.minCov = Number(fc.value); renderActiveTab(); });
  const fnum = $('#f-numbers', panel);
  if (fnum) fnum.addEventListener('change', () => { state.filters.hideNumbers = fnum.checked; renderActiveTab(); });
  const fs = $('#f-search', panel);
  if (fs) {
    const apply = debounce(() => { state.filters.search = fs.value; renderActiveTab(); $('#f-search')?.focus(); }, 200);
    fs.addEventListener('input', apply);
  }
  const reset = $('#f-reset', panel);
  if (reset) reset.addEventListener('click', () => { state.filters = { n: 'all', minCov: 1, hideNumbers: false, search: '' }; state.sort = { key: null, dir: 'desc' }; renderActiveTab(); });
  $$('[data-sort]', panel).forEach((b) => b.addEventListener('click', () => {
    if (!state.unlocked) { openUnlockModal('gaps'); return; }
    const key = b.dataset.sort;
    if (state.sort.key === key) {
      if (state.sort.dir === 'desc') state.sort.dir = 'asc'; else state.sort = { key: null, dir: 'desc' };
    } else {
      state.sort = { key, dir: key === 'term' || key === 'inHeading' ? 'asc' : 'desc' };
    }
    renderActiveTab();
  }));
}

/* ---------- export ---------- */

function exportSections() {
  const r = state.result;
  return {
    gaps: filteredGaps(r),
    headingGaps: r.headingGaps,
    entityGaps: r.entityGaps,
    meta: { yourLabel: r.docs.yours.label, competitorLabels: r.docs.competitors.map((d) => d.label), date: new Date().toISOString().slice(0, 10) },
  };
}

function slug(s) { return String(s || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'report'; }

/* ---------- scenarios ---------- */

function openScenarios() {
  renderScenarioList();
  $('#scenario-status').textContent = '';
  const dlg = $('#scenarios-modal');
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function renderScenarioList() {
  const list = scenarios.list();
  const ul = $('#scenario-list');
  if (!list.length) { ul.innerHTML = '<li class="muted">No saved scenarios yet.</li>'; return; }
  ul.innerHTML = list.map((s) => `
    <li data-id="${esc(s.id)}">
      <span><span class="name">${esc(s.name)}</span><span class="when">${esc(new Date(s.savedAt).toLocaleString())}</span></span>
      <span class="actions">
        <button type="button" class="btn btn-small btn-primary" data-act="load">Load</button>
        <button type="button" class="btn btn-small" data-act="rename">Rename</button>
        <button type="button" class="btn btn-small" data-act="delete">Delete</button>
      </span>
    </li>`).join('');
}

function scenarioStatus(text, kind = '') {
  const el = $('#scenario-status');
  el.textContent = text;
  el.className = 'status small' + (kind ? ' ' + kind : '');
}

function bindScenarioEvents() {
  $('#btn-scenario-save').addEventListener('click', () => {
    readSettings();
    const name = $('#scenario-name').value.trim() || `Scenario ${new Date().toLocaleDateString()}`;
    try {
      scenarios.save({ name, inputs: state.docs.map((d) => ({ label: d.label, mode: d.mode, text: d.text })), settings: state.settings });
      $('#scenario-name').value = '';
      renderScenarioList();
      scenarioStatus(`Saved "${name}".`);
    } catch (err) { scenarioStatus(err.message, 'err'); }
  });
  $('#scenario-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const s = scenarios.get(id);
    if (!s) return;
    if (btn.dataset.act === 'load') {
      s.inputs.forEach((d, i) => { if (state.docs[i]) Object.assign(state.docs[i], { label: d.label, mode: d.mode, text: d.text }); });
      for (let i = s.inputs.length; i < state.docs.length; i++) Object.assign(state.docs[i], { label: '', text: '' });
      Object.assign(state.settings, s.settings);
      syncDocsToDom();
      saveSession();
      $('#scenarios-modal').close();
      setStatus(`Loaded scenario "${s.name}". Click Analyze.`);
      $('#btn-analyze').focus();
    } else if (btn.dataset.act === 'rename') {
      const name = prompt('New name', s.name);
      if (name && name.trim()) {
        try { scenarios.rename(id, name); renderScenarioList(); } catch (err) { scenarioStatus(err.message, 'err'); }
      }
    } else if (btn.dataset.act === 'delete') {
      if (confirm(`Delete scenario "${s.name}"?`)) { scenarios.remove(id); renderScenarioList(); }
    }
  });
  $('#btn-scenario-export').addEventListener('click', () => {
    downloadText(`page-content-gap-scenarios-${new Date().toISOString().slice(0, 10)}.json`, scenarios.exportJSON(), 'application/json');
  });
  $('#scenario-import').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const n = scenarios.importJSON(await file.text());
      renderScenarioList();
      scenarioStatus(`Imported ${n} scenario${n === 1 ? '' : 's'}.`);
    } catch (err) { scenarioStatus(err.message, 'err'); }
    e.target.value = '';
  });
}

/* ---------- events ---------- */

function bindEvents() {
  $('#btn-analyze').addEventListener('click', runAnalysis);
  $('#btn-demo').addEventListener('click', loadDemo);
  $('#btn-suggest-exclusions').addEventListener('click', () => {
    const ta = $('#exclusions');
    const existing = new Set(ta.value.split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));
    const labels = state.docs.slice(1).filter((d) => d.label.trim() && d.text.trim()).map((d) => d.label.trim());
    const add = labels.filter((l) => !existing.has(l.toLowerCase()));
    if (!add.length) { setStatus(labels.length ? 'Competitor labels already listed.' : 'Give competitors a label first (brand names work best).'); return; }
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + add.join('\n');
    readSettings();
    saveSession();
    setStatus(`Added ${add.length} exclusion${add.length === 1 ? '' : 's'}. Re-run Analyze to apply.`);
  });
  ['#extra-stopwords', '#exclusions', '#detect-headings'].forEach((sel) => $(sel).addEventListener('change', () => { readSettings(); saveSession(); }));

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-unlock]');
    if (t && !state.unlocked) { e.preventDefault(); openUnlockModal(t.dataset.unlock); return; }
    const tab = e.target.closest('.tab[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; renderActiveTab(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.stat.locked[data-unlock]')) { e.preventDefault(); openUnlockModal('scores'); }
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const idx = TABS.findIndex((t) => t.id === state.tab);
    const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    state.tab = next.id;
    renderActiveTab();
    $(`#tab-${next.id}`).focus();
  });

  $('#btn-export-csv').addEventListener('click', () => {
    if (!state.unlocked) { openUnlockModal('export'); return; }
    if (!state.result) return;
    downloadText(`page-content-gap-${slug(state.result.docs.yours.label)}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(exportSections()), 'text/csv;charset=utf-8');
    setStatus('CSV downloaded (current filters applied to the gap table).');
  });
  $('#btn-copy-md').addEventListener('click', async () => {
    if (!state.unlocked) { openUnlockModal('export'); return; }
    if (!state.result) return;
    const ok = await copyText(toMarkdown(exportSections()));
    setStatus(ok ? 'Markdown copied to clipboard.' : 'Could not copy — your browser blocked clipboard access.', ok ? '' : 'err');
  });
  $('#btn-scenarios').addEventListener('click', () => {
    if (!state.unlocked) { openUnlockModal('scenarios'); return; }
    openScenarios();
  });
  bindScenarioEvents();

  // Unlock without reload when thanks.html (another tab) sets the key, or when returning to this tab.
  window.addEventListener('storage', (e) => { if (!e.key || e.key === 'pcg:unlock') refreshUnlockState(); });
  window.addEventListener('focus', refreshUnlockState);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUnlockState(); });
  window.addEventListener('pageshow', refreshUnlockState);
}

init();
