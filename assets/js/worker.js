// Web Worker wrapper: runs analyze() off the main thread for large inputs (PLAN §6.9).

import { analyze } from './analyze.js';

self.onmessage = (event) => {
  const { id, input } = event.data || {};
  try {
    const result = analyze(input);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
