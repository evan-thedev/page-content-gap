# Page Content Gap — Product Plan

Status: PLAN v2 (incorporates the Researcher product brief). No application code exists yet.
This is the spec a follow-up implementation agent builds from.

Owner: Evan Parrott (@evan-thedev). Payments/ops: Bobby.
Price: **$39 one-time** (range $29–$49; reasoning in `LISTING.md`).
Shape: GitHub Pages, static, client-side only, Stripe-gated full report. No backend in v1.

---

## 1. Promise

Paste **your** page (HTML or plain text) plus **2–3 competitor pages** → see the phrases, headings,
and entity-style terms they cover that you don't. Export the full report as CSV or Markdown.

Everything runs in the browser. Nothing you paste is uploaded anywhere.

Listing title: **Page Content Gap — Competitor On-Page Phrase Gap Analyzer (No Ahrefs Needed)**

## 2. Problem

SEO freelancers and in-house content SEOs already have the SERP open in tabs. They know which
page is losing and which three pages are winning. What they lack is a fast, defensible,
client-presentable answer to: *what do those pages talk about that mine doesn't?*

Current options:

- Read three competitor pages and take notes. Slow, inconsistent, nothing to hand a writer.
- Surfer / Clearscope / Frase / MarketMuse at $99–$449/mo, where the "term map" is one tab of a
  subscription they don't otherwise need.
- Throwaway Python (`nltk`, `sklearn`) — technical SEOs only, and still no client deliverable.

The useful core is mechanically simple: normalize, count n-grams, compare, rank. It needs no
backend, no crawl budget, no volume API. It needs to be fast, private (agencies paste unpublished
drafts), and end in a CSV/Markdown table a freelancer can drop into a brief.

## 3. Buyer

- **Freelance / small-agency SEO** (1–10 clients). Bills per page or audit. Wants a repeatable
  15-minute "content gap" step and an export for the writer brief. Pays $39 once without thinking;
  won't add another $29/mo.
- **In-house content SEO** at a small SaaS / e-commerce. Owns 20–200 pages, no Surfer budget, gets
  asked "why does competitor X outrank us?" and needs something to show in a doc.

Non-buyers (do not design for): enterprise teams with Semrush/Ahrefs seats; anyone who wants
search volume; anyone who wants bulk crawling.

## 4. Hard constraints, out of scope, kill list

Hard constraints:

- **NO** search-volume API. **NO** Ahrefs / Semrush / DataForSEO or any clone of them. **NO**
  domain crawl.
- v1 input is **paste only** (HTML or plain text). URL fetch is optional *later* (§5.5).
- No server upload of content. No accounts. No backend.

Out of scope (v1 and v1.x): keyword difficulty, volume, CPC, SERP fetching, backlinks, sitemap
ingestion, Google Search Console integration, multi-language stemmers, server-side fetch farm.

Kill list — if the implementer finds themself starting one of these, stop:

| Killed | Why |
|---|---|
| Volume / KD / CPC APIs, Ahrefs-style anything | Hard constraint. Different product, different cost base. |
| Crawlers, sitemap readers, CORS proxies, fetch farms | Fragile, and proxies leak client content. Paste is primary. |
| Auto-writing articles / "generate the missing section" | Different product; API cost and liability. |
| Accounts, login, server license validation | No backend. |
| Merging with a keyword-gap (SERP/keyword) tool | Scope creep; keep this tool on-page only. |
| Renters / HVAC UI or any vertical-specific UI | Not this product. Generic SEO freelancer UI only. |
| External NLP / NER APIs or models | Entities are capitalized-sequence heuristics + a curated JSON list. |
| Stemmers / lemmatizers | Out of scope. Exact-token matching only. |
| Multi-language stopwords | English only. Users may paste extra stopwords. |
| Build tooling, frameworks, TypeScript compile | Vanilla ES modules served as-is by Pages. |
| Dark mode, PDF export, team sharing, browser extension | Later, if ever. |

## 5. UX flows

### Flow A — Free teaser (first visit)

1. Land on `index.html`. Hero: title, one-line promise, privacy line ("Runs entirely in your
   browser. Nothing you paste leaves this tab."), **[Load demo pages]**, **[Unlock full report
   — $39]**.
2. Input panel:
   - **Your page** — textarea with *Plain text* / *HTML* toggle and an optional label.
   - **Competitor 1 / 2 / 3** — same control. All three are available in free mode (input is not
     gated; output is). Empty competitors are ignored.
3. **[Analyze]** → runs `analyze()` (Web Worker above 50k words) → scrolls to results.
4. Free results:
   - **Word counts** for every doc (yours vs each competitor, plus competitor average).
   - **Top 10 gap phrases** (rank order per §6.4), with the coverage column (`2/3`).
   - **Top 5 shared phrases** (high frequency in both you and competitors — reassurance that the
     comparison is on-topic).
   - A locked band under each: "*N* more gap phrases", "*M* heading gaps", "*E* entity-style
     gaps", "Suggested H2s", "CSV / Markdown export" — each with **Unlock $39**.
5. **[Load demo pages]** fills all four inputs from `samples/` so the teaser is visible before
   the user pastes anything.

### Flow B — Purchase and unlock

1. Any locked control → **Unlock** modal: what's included (full gap table up to 100 rows,
   heading gaps, entity-style gaps, suggested H2s, "only you" section, summary scores, CSV +
   Markdown export, saved local scenarios), the disclaimer sentence, refund policy line.
2. **[Buy — $39 one-time]** → `STRIPE_PAYMENT_LINK` (placeholder constant in `config.js`; Bobby
   swaps in the live link).
3. Stripe Payment Link is configured with *After payment → redirect* to
   `https://<pages-url>/thanks.html?session_id={CHECKOUT_SESSION_ID}`.
4. `thanks.html`:
   - If `session_id` is present and starts with `cs_`, write
     `localStorage['pcg:unlock'] = { at: ISO, ref: session_id }` and show "Unlocked in this
     browser." with **[Open the tool]**.
   - Plain-language note: *"The unlock is stored in this browser only. If you clear site data,
     use another browser, or another device, it will be locked again. Keep your Stripe receipt —
     email it to us for a recovery key."*
   - Recovery-key field (see §9, optional Option B).
5. Back on `index.html`, `isUnlocked()` is true → all gates open without reload; footer shows
   "Full report unlocked · Manage" (Manage → shows the `ref`, and a *Remove unlock* action).

### Flow C — Paid full report (returning user, unlocked)

1. Same input panel. Analyze.
2. **Summary scores** strip (§6.8): Phrase coverage %, Heading coverage %, word count vs
   competitor average, counts of gaps by type.
3. Tabs:
   - **Gap phrases** — full table, capped at **100 rows**. Columns: Phrase, n, Union count,
     Competitors (`2/3`), per-competitor counts, In competitor heading?, Suggested action.
     Filters: n-gram size (1/2/3), min competitors (1/2/3), hide numbers, brand/exclusion
     list (one term per line), search. Sort by any column; default per §6.4.
   - **Heading gaps** — competitor h1–h3 topics you don't have (§6.6), grouped by topic with
     variants and "your closest heading" for sanity checking.
   - **Suggested H2s** — deterministic list derived from competitor H2 gaps (§6.7). No AI.
   - **Entities** — capitalized multi-word terms and curated-list hits competitors use and you
     don't (§6.5).
   - **Shared** — high-frequency terms present in both (full list).
   - **Only you** — collapsed by default: terms frequent on your page and absent from all
     competitors (helps spot off-topic drift or a unique angle).
4. **[Export CSV]** and **[Copy Markdown]** export the *currently filtered* gap table, plus
   heading gaps and entities as additional sections (Markdown) / files (CSV: one file with a
   `section` column).
5. **Scenarios** (local): Save current inputs + settings under a name (max 20), Load, Rename,
   Delete, Export JSON, Import JSON. `localStorage` only.

### 5.4 Empty / error states

- Your page empty → "Paste your page first."
- No competitor text → "Paste at least one competitor page."
- Any doc < 50 words → warning badge "Very short — results will be noisy."
- Any doc > 200,000 characters → refused: "Trim to under 200k characters."
- A textarea containing only a URL → inline hint: "v1 doesn't fetch URLs. Open the page, select
  all, copy, paste here — or paste its HTML from View Source." Analysis does not run.
- HTML mode with no `<body>` → parsed as plain text with a notice.

### 5.5 URL fetch (later, optional — not v1)

If added: one **Fetch** button per textarea doing a plain `fetch(url, { mode: 'cors' })`. On
success, fill the HTML tab. On failure (most sites), show the paste instructions above. No
proxies, no retries, no readability heuristics beyond §6.1. Documented as best-effort.

## 6. Analysis — exact rules

All pure JS, deterministic, no network. Each rule below maps to a unit test in §11.

### 6.1 Preprocess and extract (`extract.js`)

Output per document:

```
Doc { label, mode, words, blocks: string[], headings: [{ level: 1|2|3, text }], title? }
```

HTML mode:

1. `DOMParser` → remove `script, style, noscript, template, svg, iframe, canvas, nav, footer,
   form, [role=navigation], [aria-hidden=true], [hidden]`, and elements whose `id`/`class`
   matches `/(^|[-_ ])(nav|menu|footer|sidebar|cookie|breadcrumb|share|comments?)([-_ ]|$)/i`.
   Keep `header` (H1 often lives there) but strip `nav` inside it.
2. Root = first of `main`, `article`, `[role=main]`, else `body`.
3. Headings = `h1, h2, h3` under root, in order, plus any `h1` outside root. Whitespace
   collapsed; drop empty or > 200 chars. `<title>` stored separately and treated as an `h1` for
   heading matching.
4. Blocks = `textContent` of each `p, li, td, th, blockquote, pre, dd, dt, figcaption, h1–h6`
   and `div`s with direct text nodes, joined as separate strings. Never use `body.textContent`
   as one string (it glues sentences across tags).

Plain-text mode:

1. Normalize `\r\n → \n`; blocks = non-empty lines/paragraphs.
2. Headings (toggle "Detect headings in plain text", default on):
   - Markdown `#`, `##`, `###` → level 1/2/3 (`####`+ ignored).
   - **Title Case line**: 2–12 words, ≤ 80 chars, no terminal `.` `;` `:`, ≥ 60% of
     non-stopword words capitalized, followed by a blank line or a line ≥ 2× its length →
     level 2.
   - Cap at 60 detected headings; above that, keep Markdown headings only and show a notice.

### 6.2 Tokenize (`tokenize.js`)

1. Lowercase. Replace `’` with `'`.
2. Tokens = matches of `/[a-z0-9']+/g`, then strip leading/trailing `'`.
3. Drop tokens with length < 3 **except** the allowlist `ai, ui, ux, seo, qa`
   (`config.SHORT_TOKEN_ALLOWLIST`, extendable).
4. Tokens are grouped per block and per sentence (split blocks on `.` `!` `?` followed by space
   or end). N-grams never cross a sentence or block boundary.
5. No stemming, no plural folding. Exact tokens only (a deliberate v1 simplification; `desk`
   and `desks` are separate rows — the user sees both and understands).

Known consequence to document in the UI help: hyphenated terms split (`e-commerce` → `commerce`
after the `e` is dropped). Acceptable for v1.

### 6.3 Stopwords (`stopwords.js`)

- Shipped English list of ~150 words (NLTK core + web boilerplate: `click, read, more, learn,
  share, login, sign, menu, cookie, privacy, terms, copyright, rights, reserved, skip, home,
  posted, updated, comments, subscribe, newsletter, email, follow, view, next, previous, back,
  top`). Exact list lives in the module and is tested for size 100–200.
- Users may append stopwords (textarea in Settings; saved with scenarios when unlocked).
- Unigram stopwords are never counted. An n-gram may **not start or end** with a stopword or a
  pure number; internal stopwords are allowed (`cost of ownership`).
- Brand/exclusion list (user-supplied): any n-gram containing an excluded token is dropped.
  The UI suggests each competitor's label as an exclusion.
- `assets/data/boilerplate.json`: ~40 generic phrases (`privacy policy`, `terms of service`,
  `all rights reserved`, `read more`, `sign up`) dropped from all tables.

### 6.4 N-grams and gap phrases (`ngrams.js`, `gaps.js`)

Count 1-, 2-, 3-grams per document within sentence spans under §6.3 rules.

Definitions for term `t` with `K` competitors (1–3):

```
yourCount(t)   = occurrences in your page
unionCount(t)  = Σ occurrences across competitors
cov(t)         = number of competitors with count ≥ 1
N_min          = { 1: 3, 2: 2, 3: 2 }[n]

GAP(t)  ⇔  unionCount(t) ≥ N_min[n]  AND  yourCount(t) = 0
```

Ranking (default sort; stable):

1. `unionCount` descending.
2. Tie → `n` descending (prefer trigrams, then bigrams, then unigrams).
3. Tie → `cov` descending.
4. Tie → alphabetical.

Display preference for bi/tri-grams (**subsumption**): a unigram `u` is hidden if ≥ 80% of its
competitor occurrences fall inside a displayed bigram/trigram gap; a bigram is hidden under the
same rule relative to a displayed trigram. Hidden terms are listed in the parent row's
`subsumes` and shown on hover ("also: cable, management"). Rule is applied after ranking, and
the cap is applied after subsumption.

Caps: **top 100** rows unlocked; **top 10** in the free teaser (counted after subsumption and
filters, so the teaser shows the same first 10 rows the paid table does).

Optional filter (unlocked): *min competitors* 1/2/3. Default 1 (the brief defines gaps by union
count, not coverage). Coverage is always shown as a column so the user can judge.

Row shape:

```
GapRow {
  term, n, unionCount, cov, K, perCompetitor: number[],
  inHeading: 1|2|3|null,        // lowest competitor heading level containing the term
  action: string,               // §6.7 deterministic text
  subsumes: string[]
}
```

### 6.5 Entities (`entities.js`)

No external NLP. Two sources, unioned, counted case-insensitively, displayed in the most frequent
original-case surface form:

1. **Capitalized multi-word sequences**: 2–4 consecutive original-case tokens matching
   `/^[A-Z][A-Za-z0-9'\-]*$/`, allowing internal `of | and | & | the | for` between capitalized
   tokens. Discard sequences that occur only once *and* only at sentence start. Discard if every
   token lowercases to a stopword.
2. **Curated list** `assets/data/entities.json` (~150–250 entries, extendable): common SEO /
   web / business entities whose casing is unreliable in the wild — e.g. `Google Search
   Console`, `Core Web Vitals`, `Schema.org`, `WordPress`, `Shopify`, `HubSpot`, `ChatGPT`,
   `Bing Webmaster Tools`, `E-E-A-T`, `PageSpeed Insights`. Matched case-insensitively against
   the lowercase block text, including single-word entries.

Entity gap ⇔ present in ≥ 1 competitor and absent from your page. Ranked by `unionCount`, then
`cov`. Cap 100. UI label: **Entities (heuristic)** with tooltip "Capitalized names plus a curated
list. Not a language model."

### 6.6 Heading gaps (`headings.js`)

1. Consider competitor `h1–h3` (HTML) or detected headings (plain text). Normalize each:
   tokenize (§6.2), drop stopwords, drop pure numbers, set of remaining tokens.
2. For each competitor heading, `sim = Jaccard(A, B)` against each of your headings (including
   your `<title>`). Also count as matched if one set is a subset of the other and the smaller has
   ≥ 2 tokens.
3. **Heading gap ⇔ max sim < 0.5.**
4. Cluster competitor heading gaps across competitors (same `sim ≥ 0.5` rule) into topics; show
   one row per topic: representative heading (the shortest), variants, `covH/K`, levels, and
   `yourClosest { text, sim }` so false positives are visible.
5. Order rows by `covH` desc, then by average section length (words between this heading and
   the next heading of same-or-higher level) desc.

### 6.7 Suggested H2s and suggested actions (deterministic, no AI)

- **Suggested H2s** = heading-gap topics (§6.6) where the competitor level is `h2` (or `h3`
  when ≥ 2 competitors share the topic), rendered as the representative heading in Title Case,
  ordered as in §6.6. Cap 15. Each shows "used by 2/3 competitors" and its variants.
- **Suggested action** per gap phrase:
  - `inHeading` set → "Consider a section (competitor h*N*)".
  - `n ≥ 2` → "Mention in body".
  - `n = 1` → "Mention in body or expand a related section".

### 6.8 Shared, "only you", and summary scores

- **Shared** phrases: terms with `yourCount ≥ 1` and `unionCount ≥ N_min[n]`, ranked by
  `min(yourCount, unionCount)` desc, then `n` desc. Top 5 in teaser; full list (cap 100) unlocked.
- **Only you**: terms with `yourCount ≥ N_min[n]` and `unionCount = 0`, same ranking. Collapsed
  by default (unlocked only).
- **Summary scores** (unlocked):
  - `Phrase coverage % = 100 × (eligible − gaps) / eligible`, where `eligible` = number of
    competitor terms with `unionCount ≥ N_min[n]` (after stopword/boilerplate/exclusion rules,
    before subsumption).
  - `Heading coverage % = 100 × matchedTopics / totalCompetitorTopics` (topics per §6.6 step 4).
  - Word count: yours vs competitor min / avg / max, with a "shorter than all competitors" flag.
  - Counts: gap phrases, heading gaps, entity gaps, suggested H2s.

### 6.9 Performance

- 4 docs × 20k words: < 500 ms on a 2020 laptop. Use `Map`s; count per doc once, merge once.
- Total words > 50k → run `analyze()` in `worker.js` with a busy state. Same modules.

### 6.10 Worked fixture (drives tests 5–8)

Your page (~300 words about standing desks) uses `standing desk`, `height adjustable`,
`ergonomic`. Competitors A/B/C use `cable management` (A 2, B 2, C 3; B has `h2` "Cable
Management"), `anti fatigue mat` (A 4, B 3, C 0), `sit stand` (C 5 only), `Herman Miller`
(A 2, C 1), `desk` (A 12, B 9, C 15 — you also use it 8×).

Expected (unlocked, default sort): `cable management` (union 7, 3/3, inHeading h2, action
"Consider a section (competitor h2)") → `anti fatigue mat` (union 7, 2/3 — same union and `n`,
so the `cov` tiebreak puts `cable management` first) → `sit stand` (union 5, 1/3) →
`herman miller` (union 3, 2/3), which also appears in Entities as `Herman Miller`. `desk` is
Shared, not a gap. Unigrams `cable`, `management`, `mat` are subsumed.
Heading gaps include topic "Cable Management" (1/3) with `yourClosest` sim < 0.5; Suggested H2s
lists "Cable Management".

## 7. Free vs paid

| Capability | Free teaser | Unlocked ($39) |
|---|---|---|
| Inputs | Your page + up to 3 competitors | same |
| Word counts | yes | yes |
| Gap phrases | top 10 | top 100, filters, sort |
| Shared phrases | top 5 | full (cap 100) |
| Heading gaps | count only | full |
| Suggested H2s | count only | full |
| Entities | count only | full |
| Only you | — | yes (collapsed) |
| Summary scores | — | yes |
| CSV / Markdown export | locked | yes |
| Saved local scenarios | — | 20, JSON import/export |
| Custom stopwords / exclusions | session only | saved with scenarios |
| Demo pages | yes | yes |

Implementation: one `isUnlocked()` in `license.js`; every gated element goes through
`gate(el, feature)`. The full analysis always runs; gating happens at render. Locked rows render
as placeholders with counts (not blurred real data).

## 8. File structure

```
/
├── index.html                 # app shell; <script type="module" src="assets/js/app.js">
├── thanks.html                # Stripe redirect target: sets unlock, shows recovery note
├── disclaimer.html            # DISCLAIMER.md rendered as a page; linked from footer + modal
├── 404.html
├── assets/
│   ├── css/app.css            # single stylesheet, CSS variables, no framework
│   ├── js/
│   │   ├── config.js          # STRIPE_PAYMENT_LINK placeholder, PRICE, caps, N_min, allowlist
│   │   ├── app.js             # UI only: state, render, events, gate()
│   │   ├── analyze.js         # orchestrator: Docs → Result (used by app.js and worker.js)
│   │   ├── extract.js         # §6.1
│   │   ├── tokenize.js        # §6.2
│   │   ├── stopwords.js       # §6.3
│   │   ├── ngrams.js          # §6.4 counting
│   │   ├── gaps.js            # §6.4 gap/shared/only-you, ranking, subsumption, caps, §6.8 scores
│   │   ├── entities.js        # §6.5
│   │   ├── headings.js        # §6.6 + suggested H2s (§6.7)
│   │   ├── export.js          # CSV (BOM, quoting) + Markdown builders, download/copy helpers
│   │   ├── license.js         # isUnlocked(), setUnlock(ref), recovery key check (optional)
│   │   ├── storage.js         # scenarios CRUD, import/export
│   │   └── worker.js
│   └── data/
│       ├── entities.json      # curated entity list (§6.5)
│       ├── boilerplate.json   # generic web phrases to drop (§6.3)
│       └── key-hashes.json    # only if Option B (§9) ships
├── samples/                   # demo pages: yours.txt, competitor-1.html, competitor-2.txt, competitor-3.txt
├── scripts/gen-keys.mjs       # only if Option B ships; writes keys-private.txt (gitignored)
├── tests/                     # node --test; fixtures/ holds §6.10
├── .github/workflows/test.yml # node --test on push/PR; Pages serves main directly
├── package.json               # "test": "node --test tests/"; devDependency: jsdom (extract tests only)
├── .gitignore                 # keys-private.txt
└── PLAN.md  LISTING.md  DISCLAIMER.md  README.md
```

Rules: zero runtime dependencies; vanilla ES modules; only `app.js` (and `thanks.html`'s inline
module) touch the DOM; algorithm modules are pure and Node-testable; relative asset paths so the
app works at `https://<user>.github.io/page-content-gap/` and on a custom domain.

## 9. Stripe gate (no backend)

**Option A — required (v1):** Stripe Payment Link → redirect to
`thanks.html?session_id={CHECKOUT_SESSION_ID}` → `localStorage['pcg:unlock']`.

- `thanks.html` only sets the unlock when `session_id` matches `/^cs_(live|test)_[A-Za-z0-9]+$/`.
  This deters accidental visits; it is not security (nothing client-side is).
- Documented clearly (thanks page, unlock modal, `DISCLAIMER.md`): the unlock is **per
  browser**. Clearing site data, another browser, or another device → locked again → **re-pay**,
  or email the Stripe receipt for a recovery key (if Option B ships) / manual help.
- `config.js`: `STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_ME'`, `PRICE_LABEL =
  '$39'`. Bobby replaces both.

**Option B — optional, ship if it stays under a few hours:** recovery/license keys.

- `scripts/gen-keys.mjs 300` → `PCG-XXXXX-XXXXX-XXXXX` (Crockford base32) into
  `keys-private.txt` (gitignored, Bobby keeps) + `assets/data/key-hashes.json` (SHA-256 hex,
  committed).
- Activate field on `thanks.html` and in the Unlock modal: `crypto.subtle.digest('SHA-256',
  key.trim().toUpperCase())` → lookup → `pcg:unlock = { at, ref: 'key' }`.
- Bobby emails a key on request (refund-desk style) when a buyer loses their unlock. Revocation =
  delete the hash and redeploy.

Do not add obfuscation. Do not put a shared code in Stripe's confirmation message (one screenshot
leaks it).

## 10. UI direction

Notebook aesthetic, kept practical for daily use: off-white paper background, ink text, one
marker-yellow accent for locked states and highlights, thin ruled dividers; humanist serif for
headings, monospace for terms and numbers; system font stacks (no webfonts — privacy and speed).
Max width 1100px; inputs 2-up collapsing at 800px; tables scroll horizontally on mobile.
Keyboard reachable, visible focus, labelled textareas, `<th scope>`, contrast ≥ 4.5:1.

## 11. Acceptance tests

Automated (`node --test`, fixtures under `tests/fixtures/`):

1. `tokenize`: `"SEO isn't dead. Don't panic!"` → `[["seo","isn't","dead"],["don't","panic"]]`
   (two sentence spans; `seo` survives via allowlist; `ai`/`ux` also survive; `is`, `to` dropped
   for length).
2. `tokenize`: `’` normalizes to `'`; leading/trailing apostrophes stripped; `e-commerce` →
   `commerce` (documented behaviour).
3. `stopwords`: list length is between 100 and 200; contains `the`, `and`, `read`, `more`.
4. `ngrams`: no n-gram crosses a sentence/block boundary; none starts or ends with a stopword or
   pure number; `cost of ownership` allowed.
5. `gaps`: §6.10 fixture — `GAP` set is exactly `{cable management, anti fatigue mat, sit stand,
   herman miller}` plus eligible unigrams before subsumption; `desk` is Shared; a bigram with
   union 1 is not a gap; a unigram with union 2 is not a gap (N_min 3).
6. `gaps`: default order is union desc → n desc → cov desc → alpha; `cable management` precedes
   `anti fatigue mat`.
7. `gaps`: subsumption hides `cable`, `management`, `mat` and lists them in `subsumes`; cap 100
   and teaser 10 are applied after subsumption; teaser rows equal the first 10 unlocked rows.
8. `gaps`: brand/exclusion list removes every row containing an excluded token; boilerplate
   phrases never appear.
9. `gaps`: Phrase coverage % and Heading coverage % match hand-computed values for the fixture;
   "only you" contains `height adjustable` and `ergonomic` (if they meet `N_min`).
10. `entities`: extracts `Google Search Console` (curated), `Herman Miller` (capitalized
    sequence), does not extract sentence-initial `However` or `The Best` when it appears once.
11. `headings`: "Cable Management" vs "Managing Your Cables" → gap (no stemming, so `cable` ≠
    `cables`; Jaccard < 0.5) — documents the v1 behaviour; "Pricing and Plans" vs "Plans &
    Pricing" → matched (sim 1.0); three variants cluster into one topic with `covH = 3`.
12. `headings`: only `h1–h3` are considered; `h4` in a fixture is ignored; `<title>` counts as
    one of your headings.
13. `headings`: Suggested H2s = h2-level topics in §6.6 order, Title Case, cap 15.
14. `extract` (jsdom): strips `nav`/`footer`/`script`; prefers `<main>`; keeps `h1` in
    `<header>`; blocks are separate strings.
15. `extract` text mode: `## Foo` → level 2; Title Case line followed by a paragraph → detected
    heading; a long sentence is not; > 60 detections falls back to Markdown only.
16. `export`: CSV starts with UTF-8 BOM, quotes fields with commas/quotes/newlines, includes a
    `section` column; Markdown export renders three tables with matching row counts.
17. `license`: `isUnlocked()` false by default; `setUnlock('cs_test_abc')` → true; a
    `session_id` not matching `/^cs_(live|test)_/` is rejected; (Option B) known key accepted,
    one-character variant rejected, whitespace/lowercase normalized.
18. `analyze`: 4 × 20k-word synthetic docs complete in < 1000 ms in CI.

Manual (checked in the PR before ship):

19. Free: three competitors accepted; exactly 10 gap rows and 5 shared rows; locked bands show
    correct counts; Export opens the Unlock modal.
20. Stripe test-mode purchase → `thanks.html` → unlocked without reload on return; reload keeps
    it; *Remove unlock* clears it; visiting `thanks.html` without `session_id` does not unlock.
21. Demo pages produce non-empty results on every tab.
22. Paste View-Source HTML from a WordPress post, a Shopify product page, and a docs page: no
    menu/footer text in the top 20 gaps; headings look sane.
23. Bare URL in a textarea → paste instructions, no analysis.
24. 200k+ characters refused; 60k-word run shows busy state, tab does not freeze.
25. Mobile 375px: inputs stack, tables scroll, all buttons reachable.
26. Lighthouse: Performance ≥ 90, Accessibility ≥ 95; no console errors; zero network requests
    after load except the Stripe link on click.
27. `disclaimer.html` reachable from footer and Unlock modal; privacy line under the hero.

## 12. Implementation sequence (dependency order; each step ends green and committed)

1. Skeleton: `index.html`, `app.css`, `config.js`, `app.js` inputs + stub results; `package.json`
   with `node --test`; CI workflow; enable Pages so every step is visible.
2. `tokenize.js`, `stopwords.js`, `ngrams.js` + tests 1–4.
3. `gaps.js` (gap/shared/only-you, ranking, subsumption, caps, scores), `analyze.js` + tests 5–9;
   render the gap table. First usable moment.
4. `extract.js` (HTML + text headings) + tests 14–15; Plain/HTML toggle.
5. `headings.js` (+ suggested H2s), `entities.js`, `entities.json` + tests 10–13; tabs.
6. Filters, sort, `export.js` + test 16.
7. Gate + Stripe: `license.js`, `thanks.html`, Unlock modal, `disclaimer.html` + test 17;
   manual 19–20. Option B only if time remains.
8. `storage.js` scenarios drawer.
9. `worker.js` + threshold + test 18; manual 24.
10. Samples, empty states, notebook styling, a11y, Lighthouse; manual 21–27.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Boilerplate rows (menus, cookie text) | §6.1 stripping, `boilerplate.json`, exclusions, subsumption; manual test 22 on 3 real templates. |
| "It's just word counts" | Heading gaps, Suggested H2s, coverage scores, action column, and a demo that shows all of it on first visit. |
| Per-browser unlock frustrates buyers | Plain warning on thanks page + modal; Option B recovery keys; refund policy. |
| Public repo → gate bypass | Accepted at this price and audience. Private repo needs GitHub Pro for Pages (decision below). |
| No stemming → `desk`/`desks` duplicate rows | Documented; users read both. Revisit only with evidence. |
| Refund requests "didn't rank me" | Disclaimer sentence in Stripe description, modal, and site; 14-day refund policy. |

## 14. Open decisions (defaults chosen; implementation may proceed)

1. Repo public vs private. **Default: public.**
2. Launch pricing: $39 list; optional 7-day `LAUNCH29` promotion code. **Default: yes, via Stripe
   promotion code, no code changes.**
3. Option B recovery keys in v1. **Default: ship only if step 7 finishes early; otherwise v1.1.**
4. Analytics. **Default: none.**
5. Custom domain. **Default: github.io until first 10 sales.**

## 15. Ship checklist

- [ ] Automated tests green in CI; manual tests 19–27 ticked in the PR description.
- [ ] `config.js`: live `STRIPE_PAYMENT_LINK`; `PRICE_LABEL` matches Stripe.
- [ ] Stripe Payment Link: collects email; after-payment redirect to
      `.../thanks.html?session_id={CHECKOUT_SESSION_ID}`; product description uses the copy in
      `LISTING.md` (includes disclaimer sentence + refund line); optional `LAUNCH29` promo code.
- [ ] Test-mode purchase verified end-to-end, then switched to live.
- [ ] (If Option B) keys generated once; `keys-private.txt` with Bobby, not committed;
      `key-hashes.json` committed; `.gitignore` verified.
- [ ] `thanks.html`, Unlock modal, and `disclaimer.html` copy match `LISTING.md` /
      `DISCLAIMER.md`; per-browser unlock warning present in all three places.
- [ ] Demo pages load and produce results on every tab.
- [ ] GitHub Pages enabled on `main` root; no 404s for assets; `404.html` works.
- [ ] `README.md`: what it is, run tests, deploy, swap Stripe link, (Option B) generate keys.
- [ ] Open Graph title/description/image for X and LinkedIn previews.
- [ ] Refund/recovery process agreed: who watches the Stripe inbox, response-time target.
- [ ] Launch posts from `LISTING.md` scheduled.
