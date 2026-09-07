# Page Content Gap

**Competitor on-page phrase gap analyzer — no Ahrefs needed.**

Paste your page (HTML or plain text) and 1–3 competitor pages. See the phrases,
headings, and entity-style terms they cover that you don't, ranked with per-competitor counts.
Export the full report as CSV or Markdown.

Live: **https://evan-thedev.github.io/page-content-gap/**

Everything runs in the browser. Nothing you paste is uploaded — there is no server. No accounts,
no search-volume API, no crawling. Static GitHub Pages site, vanilla ES modules, zero runtime
dependencies. Full report is a one-time Stripe purchase ($39); the unlock is stored per browser.

Owner: Evan Parrott (@evan-thedev). Payments/ops: Bobby. Product spec: [`PLAN.md`](PLAN.md).
Listing copy: [`LISTING.md`](LISTING.md). Terms: [`DISCLAIMER.md`](DISCLAIMER.md) /
[`disclaimer.html`](disclaimer.html).

## How to use

1. Open the site. Click **Load demo pages** to see a full example before pasting anything.
2. **Your page** — paste plain text (open the page, select all, copy) or HTML (View Source).
   Toggle *Plain text* / *HTML* to match. Give it a label if you like.
3. **Competitor 1–3** — same. One competitor is enough; three gives better coverage numbers. Empty competitors are ignored. v1 does not fetch URLs; a textarea
   containing only a URL shows paste instructions instead of running.
4. **Analyze.** Results appear below:
   - **Free teaser:** word counts, the top 10 gap phrases (same order as the full table), the
     top 5 shared phrases, and the counts of everything that is locked.
   - **Unlocked:** up to 100 gap phrases with filters (phrase length, min competitors, hide
     numbers, search) and column sorting; heading gaps grouped by topic with your closest
     heading beside each; suggested H2s; entity-style gaps; the full shared list; "only you";
     phrase/heading coverage scores; **Export CSV** / **Copy Markdown** (current filters
     applied); saved local **Scenarios** (20, JSON import/export).
5. **Settings** (collapsed): extra stopwords, a brand/exclusion list (any phrase containing an
   excluded word is dropped — *Add competitor labels* fills it in), and plain-text heading
   detection (Markdown `#` and Title Case lines).

Inputs and settings persist in `sessionStorage` for the tab; scenarios and the unlock live in
`localStorage`. Nothing leaves the browser.

### Known v1 behaviour

- Exact tokens only, no stemming: `desk` and `desks` are separate rows; `Cable Management` vs
  `Managing Your Cables` is a heading gap.
- Tokens shorter than 3 characters are dropped except `ai, ui, ux, seo, qa`; hyphenated terms
  split (`e-commerce` → `commerce`).
- English stopwords only (you can add your own).
- Entities are a heuristic (capitalized sequences + `assets/data/entities.json`), not a model.
- Any single input over 200,000 characters is refused. Over 50,000 total words the analysis runs
  in a Web Worker so the tab stays responsive.
- Documents under 150 words get a "short" warning (under 50: "very short"); they are still analyzed.
- A textarea containing only URLs (one or more lines) is refused with paste instructions. There is
  no fetch and no proxy.
- While locked, the engine returns only the teaser rows plus counts (`analyze({ teaser: true })`).
  The remaining gap phrases, heading gaps, entities and scores are never present in the page —
  not in the DOM, not in JS state, not in the worker message — until the browser is unlocked,
  at which point the report is recomputed.

## Analysis rules

Implemented exactly as `PLAN.md` §6. In short: 1–3-grams counted within sentences; an n-gram may
not start or end with a stopword or number; **gap** ⇔ competitor union count ≥ `N_min`
(`{1: 3, 2: 2, 3: 2}`) and zero on your page; ranked by union desc → n desc → coverage desc →
alphabetical; shorter grams are hidden ("subsumed") when ≥ 80% of their occurrences sit inside
a displayed longer gap; heading gap ⇔ max Jaccard to your headings (incl. `<title>`) < 0.5;
suggested H2s are h2-level heading-gap topics in Title Case.

One documented deviation from the §6.10 prose: with union 7 for both, the `n desc` tiebreak ranks
the trigram `anti fatigue mat` above the bigram `cable management`, so the fixture gives
`cable management` union 8 (B: heading + two body mentions). The ranking rules in §6.4 are
authoritative; the tests encode them.

## Repository layout

```
index.html            app shell (GitHub Pages serves the repo root on main)
thanks.html           Stripe redirect target: stores the unlock, explains per-browser scope
disclaimer.html       DISCLAIMER.md as a page (footer + Unlock modal link here)
404.html
assets/css/app.css    single stylesheet, system fonts
assets/js/config.js   STRIPE_PAYMENT_LINK, PRICE_LABEL, caps, N_min, allowlist
assets/js/app.js      UI only (state, render, events, gate)
assets/js/analyze.js  orchestrator: Docs → Result (main thread and worker.js)
assets/js/{extract,tokenize,stopwords,ngrams,gaps,headings,entities,export,license,storage}.js
assets/data/entities.json     curated entity list (§6.5)
assets/data/boilerplate.json  generic web phrases dropped from all tables (§6.3)
samples/              demo pages (the §6.10 fixture)
tests/                node --test suite; tests/fixtures/ holds the worked fixture
.github/workflows/test.yml    runs the tests on push/PR
```

Only `app.js` and the inline module in `thanks.html` touch the DOM. Algorithm modules are pure
and Node-testable. All asset paths are relative, so the app works at
`https://<user>.github.io/page-content-gap/` and on a custom domain.

## Run locally

Any static server works (ES modules and `fetch` need `http://`, not `file://`):

```bash
npm run serve          # python3 -m http.server 8080
# open http://localhost:8080/
```

## Tests

```bash
npm install            # devDependency: jsdom (used only by the HTML extraction tests)
npm test               # node --test "tests/*.test.mjs"
```

Covers PLAN.md §11 tests 1–18: tokenizer, stopwords, n-gram rules, the §6.10 fixture (gap set,
ranking, subsumption, caps, exclusions, boilerplate, coverage scores), entities, headings and
suggested H2s, HTML/text extraction, CSV/Markdown export, license gate, scenarios storage, and a
4 × 20k-word performance budget (< 1000 ms).

Manual checks (PLAN.md §11 tests 19–27) are listed in the pull request template of each release.

## Deploy (GitHub Pages)

The site is served from the **root of `main`** — there is no build step.

1. Repository → Settings → Pages → *Build and deployment* → Source: **Deploy from a branch**,
   Branch: **main**, Folder: **/ (root)**. Save.
2. `.nojekyll` is committed so Pages serves files as-is.
3. The site appears at `https://evan-thedev.github.io/page-content-gap/` a minute later.

## Swap in the Stripe link (Bobby)

1. Create the Stripe Payment Link (product name, description, statement descriptor and
   after-payment redirect are in `LISTING.md` §1–2). The redirect **must** be
   `https://evan-thedev.github.io/page-content-gap/thanks.html?session_id={CHECKOUT_SESSION_ID}`.
   Do not put an unlock code in the confirmation message.
2. Edit `assets/js/config.js`:
   - `STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/PLACEHOLDER'` → the live link.
   - `PRICE_LABEL = '$39'` → whatever the Payment Link charges.
3. Commit to `main`. Pages redeploys automatically.
4. Test-mode check: complete a test purchase; Stripe lands on `thanks.html?session_id=cs_test_…`,
   the page says "unlocked in this browser", and the tool tab unlocks without a reload. Visiting
   `thanks.html` without a `session_id` (or with one not matching `cs_live_…`/`cs_test_…`) does
   not unlock. Footer → *Manage* → *Remove unlock* clears it.

### How the unlock works

`thanks.html` writes `localStorage['pcg:unlock'] = { at, ref: <session_id> }` when
`session_id` matches `/^cs_(live|test)_[A-Za-z0-9]+$/`. `isUnlocked()` in `license.js` reads it;
every gated element renders through `gate()`. The full analysis always runs; gating happens at
render, and locked sections show real counts, not real rows.

This is a convenience gate for an honest audience, not security — the code is public and runs
on the buyer's machine. The unlock is **per browser**: clearing site data or switching
browser/device locks the tool again. Buyers reply to their Stripe receipt for help. Recovery
keys (PLAN.md §9 Option B) are not in v1.

## Out of scope (do not add)

Search volume / KD / CPC / Ahrefs-style data, crawlers or CORS proxies, URL fetching (v1),
article generation, accounts or a backend, stemming, non-English stopwords, build tooling.
See `PLAN.md` §4 for the kill list.
