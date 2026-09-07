// Central configuration. Bobby replaces STRIPE_PAYMENT_LINK and PRICE_LABEL before launch.

export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/PLACEHOLDER';
export const PRICE_LABEL = '$39';
export const PRODUCT_NAME = 'Page Content Gap';

// Minimum competitor union count for an n-gram to be eligible (PLAN §6.4).
export const N_MIN = { 1: 3, 2: 2, 3: 2 };
export const MAX_N = 3;

// Tokens shorter than 3 characters are dropped unless listed here (PLAN §6.2).
export const SHORT_TOKEN_ALLOWLIST = ['ai', 'ui', 'ux', 'seo', 'qa'];

export const CAPS = {
  gapRows: 100,
  teaserGapRows: 10,
  sharedRows: 100,
  teaserSharedRows: 5,
  onlyYouRows: 100,
  entityRows: 100,
  suggestedH2: 15,
  scenarios: 20,
  detectedHeadings: 60,
  headingTextLength: 200,
};

export const LIMITS = {
  maxChars: 200000,
  shortDocWords: 50,
  workerThresholdWords: 50000,
  maxCompetitors: 3,
};

// Subsumption: hide a shorter gram when this share of its competitor occurrences
// fall inside a displayed longer gram (PLAN §6.4).
export const SUBSUMPTION_RATIO = 0.8;

// Heading similarity threshold (PLAN §6.6).
export const HEADING_SIM_THRESHOLD = 0.5;

export const UNLOCK_STORAGE_KEY = 'pcg:unlock';
export const SCENARIOS_STORAGE_KEY = 'pcg:scenarios';
export const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]+$/;

export const DISCLAIMER_SENTENCE =
  'Page Content Gap compares page text you paste and reports coverage gaps; it runs in your ' +
  'browser, uploads nothing, uses no search-volume or crawl data, and is not a ranking guarantee.';

export const REFUND_LINE = '14-day refund, no questions asked. Reply to your Stripe receipt.';

export const PER_BROWSER_NOTE =
  'The unlock is stored in this browser only. If you clear site data, use another browser, or ' +
  'another device, it will be locked again. Keep your Stripe receipt — email it to us for help.';
