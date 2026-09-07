# Page Content Gap — Listing Copy and Pricing

Drafts for Stripe, X, and LinkedIn. Owner: Evan Parrott (@evan-thedev). Bobby swaps in the live
Payment Link and posts. Keep every claim consistent with `DISCLAIMER.md`.

---

## 1. Price recommendation

**$39 one-time.** Range considered: $29–$49.

Why $39:

- The buyer bills $50–$150/hour. The tool replaces 30–60 minutes of tab-reading per page and
  produces the CSV they attach to a writer brief. One use pays for it; that's the whole pitch.
- $29 reads as "utility script"; $49 invites comparison to a month of Surfer ($99) and a
  "why not just subscribe for one month?" objection. $39 sits under the impulse threshold for
  a business expense while signalling it is a real tool, not a checklist.
- One-time beats subscription here: usage is bursty (audits, not daily), and the product has
  no recurring cost to justify recurring billing.

Launch mechanics (no code changes, all in Stripe):

- Promotion code `LAUNCH29` = $10 off for the first 7 days (or first 50 redemptions). Posts say
  "$29 launch price, $39 after".
- Refund policy: **14 days, no questions asked.** Put it in the Stripe description and the
  Unlock modal. It removes the biggest objection for an unknown seller and costs almost nothing
  at this price.

Stripe setup notes for Bobby:

- Product name: `Page Content Gap — Full Report Unlock`
- Statement descriptor (≤ 22 chars): `PAGE CONTENT GAP`
- Collect email address: on. Tax: as required.
- After payment: redirect to `https://<pages-url>/thanks.html?session_id={CHECKOUT_SESSION_ID}`
- Do **not** put any unlock code in the confirmation message.

## 2. Stripe product description (≤ ~500 chars, shown on the Payment Link page)

> Unlock the full Page Content Gap report: complete gap-phrase table (up to 100 rows), heading
> gaps, suggested H2s, entity gaps, coverage scores, CSV and Markdown export, and saved local
> scenarios. Paste your page and up to 3 competitor pages — everything runs in your browser;
> nothing is uploaded. One-time payment; the unlock is stored in the browser you buy from.
> 14-day refund, no questions asked. This is an on-page analysis tool, not a ranking guarantee.

## 3. Titles and taglines

Primary title (use everywhere):

**Page Content Gap — Competitor On-Page Phrase Gap Analyzer (No Ahrefs Needed)**

Taglines (pick per channel):

- Paste your page and 3 competitors. See what they cover that you don't.
- The on-page gap check you do in your head — as a table you can export.
- Phrase gaps, heading gaps, suggested H2s. In your browser. $39 once.
- No crawls, no credits, no upload. Just the gaps.

## 4. Long description (site hero + directory listings)

You already know which page is losing and which three pages are winning. Page Content Gap
answers the next question: what do they talk about that you don't?

Paste your page (HTML or plain text) and up to three competitor pages. In under a second you
get:

- **Gap phrases** — 1–3 word phrases every competitor uses and you never do, ranked by how
  heavily they use them, with per-competitor counts.
- **Heading gaps** — sections (H1–H3) they have that you don't, grouped by topic, with your
  closest heading beside each so you can judge the match yourself.
- **Suggested H2s** — the competitor sections you're missing, ready to paste into a brief.
- **Entities** — product names, tools, organisations, and standards they mention that you don't.
- **Coverage scores** — the share of competitor phrases and headings your page already covers.
- **CSV and Markdown export** — drop it straight into the writer brief or the client doc.

It runs entirely in your browser. Your drafts and your client's pages never leave the tab.
No accounts, no crawl credits, no search-volume API, no monthly fee.

Free: paste and see your top 10 gap phrases and top 5 shared phrases. $39 once unlocks the full
report in that browser.

## 5. X (Twitter) — launch thread

1/ Built a small SEO tool: **Page Content Gap**.

Paste your page + up to 3 competitor pages → a ranked table of the phrases, headings and
entities they cover that you don't.

Runs in the browser. Nothing uploaded. $29 launch price (then $39), one-time.
[link]

2/ Why: every on-page audit has the same 45-minute step — read the top 3 in tabs, guess what
they cover that you don't, write it in a brief.

The big suites do this behind a $99+/mo subscription. It doesn't need one.

3/ What you get:
• Gap phrases (1–3 words) with per-competitor counts
• Heading gaps grouped by topic, with your closest heading shown for sanity
• Suggested H2s (derived from their H2s — no AI)
• Entity gaps
• Coverage %
• CSV + Markdown export

4/ What it deliberately isn't:
✗ search volume / KD / CPC
✗ SERP scraping or crawling
✗ an Ahrefs / Semrush clone
✗ an article generator

It's the gap table. Fast, private, exportable.

5/ Privacy is the point. Agencies paste unpublished drafts and client pages. Everything is
computed client-side; the site makes zero network requests after load (check the Network tab).

6/ Free tier shows your top 10 gap phrases so you can see whether it's useful before paying.
Full report is $29 this week with code LAUNCH29, then $39. 14-day refund, no questions.
[link]

Single-post variants:

- "Paste your page + 3 competitors. Get the phrases and headings they cover that you don't.
  In-browser, no upload, $39 once. [link]"
- "The 'what are the top 3 covering that I'm not' step of every on-page audit, as a CSV.
  Page Content Gap — no Ahrefs needed. [link]"
- "Small tool, one job: competitor on-page phrase gaps. No crawl credits, no volume API, no
  subscription. [link]"

## 6. LinkedIn post

I built a small, single-purpose SEO tool and I'd like feedback from people who do on-page work.

**Page Content Gap** — paste your page and up to three competitor pages, and it returns the
phrases, headings, and entities they cover that your page doesn't. Ranked, with per-competitor
counts, and exportable to CSV or Markdown for the writer brief.

A few decisions that might matter to you:

- It runs entirely in the browser. Nothing you paste is uploaded. That matters when the "page"
  is a client's unpublished draft.
- It does one thing. No search volume, no crawling, no SERP data, no AI rewriting. Those are
  different tools with different cost structures, and bolting them on is how a $39 tool becomes
  a $99/month tool.
- One-time price ($39; $29 this launch week). Usage is bursty — audits, not daily — so a
  subscription never felt honest.

The free tier shows your top 10 gap phrases so you can judge the output on a real page before
paying anything.

Link in the comments. If you try it on a page you're working on, I'd genuinely like to know
where the output was wrong or noisy — that's what will shape v1.1.

## 7. Short FAQ (site + replies)

**Does it fetch the URL for me?** Not in v1. Open the page, select all, copy, paste — or paste
the HTML from View Source. Browser fetches are blocked by most sites, and we won't route your
content through a proxy.

**Where does my content go?** Nowhere. Open the Network tab: after the page loads there are no
requests until you click Buy. Analysis runs in your browser.

**Is the unlock tied to an account?** No accounts. The unlock is stored in the browser you buy
from. If you clear site data or switch devices, it locks again — reply to your Stripe receipt
and we'll sort you out (recovery key or manual help). See the disclaimer for details.

**Does it use search volume?** No. It compares page text. It tells you what competitors cover,
not what people search for.

**Will this make my page rank?** No tool can promise that. It shows coverage gaps against pages
that currently rank; what you do with them, and everything else Google weighs, is up to you.

**Refunds?** 14 days, no questions asked.

## 8. Email templates (Bobby)

Post-purchase (only if manual follow-up is needed):

> Subject: Page Content Gap — your unlock
>
> Thanks for buying Page Content Gap. Your browser should already show the full report after
> the Stripe redirect. If it doesn't, or you need it on another device, reply to this email and
> I'll send a recovery key. Refunds are no-questions for 14 days — just reply.
>
> One request: if the output is noisy or wrong on a real page, tell me what you pasted. That's
> how v1.1 gets better.

Recovery key (Option B):

> Subject: Re: Page Content Gap — recovery key
>
> Here's your key: PCG-XXXXX-XXXXX-XXXXX
> Open the tool → Unlock → "Already bought?" → paste the key. It unlocks that browser. Keep the
> key for other devices.

## 9. Open Graph

- `og:title`: Page Content Gap — Competitor On-Page Phrase Gap Analyzer
- `og:description`: Paste your page + 3 competitors. See the phrases, headings and entities they
  cover that you don't. In-browser, private, $39 once.
- `og:image`: 1200×630 screenshot of the gap table on the demo data (notebook styling).
