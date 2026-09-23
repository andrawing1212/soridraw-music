const fs = require('node:fs');
const src = fs.readFileSync('src/services/geminiService.ts', 'utf8');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(
  src.includes("pass === 0 ? 'rewriteLyricHardBanLines' : 'rewriteLyricHardBanLinesSecondPass',\n      [GEMINI_TEXT_MODEL_CHAIN[0]],"),
  'hard-ban line correction must use the shared Gemini fallback entry model',
);
assert(
  src.includes("'rewriteLyricHardBanCards',\n  );"),
  'hard-ban card correction must use the shared fallback chain',
);
assert(
  !src.includes("'rewriteLyricHardBanCards',\n    ['gemini-3.5-flash-lite'],"),
  'hard-ban card correction must not be pinned to 3.5-lite',
);
console.log('HARD_BAN_SHARED_FALLBACK=PASS');
