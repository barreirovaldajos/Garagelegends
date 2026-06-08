// ===== TEST 8: i18n integrity =====
// Verifies translation keys are symmetric and no technical variable patterns leak to users.
// Run: node tests/08-i18n-integrity.test.js

'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) { console.log(`  ✅ ${desc}`); passed++; }
  else           { console.error(`  ❌ FAIL: ${desc}`); failed++; }
}

// ── Load i18n.js in a minimal browser-like sandbox ───────────────────────────
// Append explicit window assignments so const-scoped vars are accessible post-run.
const rawSrc = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
const src = rawSrc + '\nwindow.I18N_DATA = I18N_DATA; window.I18N = I18N;';
const sandbox = {
  window: {},
  localStorage: { getItem: () => 'en', setItem: () => {} }
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const I18N_DATA = sandbox.window.I18N_DATA;

if (!I18N_DATA || !I18N_DATA.en || !I18N_DATA.es) {
  console.error('Could not load I18N_DATA. Check the sandbox setup.');
  process.exit(1);
}

const enKeys = Object.keys(I18N_DATA.en);
const esKeys = new Set(Object.keys(I18N_DATA.es));

// ── Suite 1: Key symmetry ─────────────────────────────────────────────────────
console.log('\n── Suite 1: Key symmetry EN ↔ ES ──');

const missingInEs = enKeys.filter(k => !esKeys.has(k));
assert(
  `All ${enKeys.length} EN keys exist in ES (missing: ${missingInEs.length === 0 ? 'none' : missingInEs.slice(0, 5).join(', ') + (missingInEs.length > 5 ? '…' : '')})`,
  missingInEs.length === 0
);

const enSet = new Set(enKeys);
const missingInEn = Object.keys(I18N_DATA.es).filter(k => !enSet.has(k));
assert(
  `All ES keys exist in EN (missing: ${missingInEn.length === 0 ? 'none' : missingInEn.slice(0, 5).join(', ') + (missingInEn.length > 5 ? '…' : '')})`,
  missingInEn.length === 0
);

// ── Suite 2: No legacy printf-style or indexed placeholders ───────────────────
console.log('\n── Suite 2: No legacy format specifiers ({0}, %s, %d) ──');

const LEGACY_RE = /\{[0-9]+\}|%s|%d/;
['en', 'es'].forEach(lang => {
  const offenders = Object.entries(I18N_DATA[lang])
    .filter(([, v]) => LEGACY_RE.test(v))
    .map(([k]) => k);
  assert(
    `[${lang}] No key uses indexed/printf placeholders ({0}, %s, %d) — offenders: ${offenders.length === 0 ? 'none' : offenders.join(', ')}`,
    offenders.length === 0
  );
});

// ── Suite 3: No internal technical identifiers in translated strings ───────────
// {pilotId} is an internal DB key, not a user-facing name.
console.log('\n── Suite 3: No internal technical identifiers ──');

const TECHNICAL_RE = /\{pilotId\}/;
['en', 'es'].forEach(lang => {
  const offenders = Object.entries(I18N_DATA[lang])
    .filter(([, v]) => TECHNICAL_RE.test(v))
    .map(([k]) => k);
  assert(
    `[${lang}] No key exposes {pilotId} (internal identifier) — offenders: ${offenders.length === 0 ? 'none' : offenders.join(', ')}`,
    offenders.length === 0
  );
});

// ── Suite 4: __() never returns the raw key for technical-looking key names ────
// Only flag keys whose name looks like a namespace token (e.g. nav_main, dash_foo)
// and whose translated value is identical to the key — a sign no translation exists.
// Plain words like 'laps', 'wins' can legitimately equal their key name.
console.log('\n── Suite 4: __() resolves technical keys (no raw-key fallthrough) ──');

const TECH_KEY_RE = /^[a-z]+_[a-z]/;
const I18N = sandbox.window.I18N;
['en', 'es'].forEach(lang => {
  I18N.lang = lang;
  const rawKeyLeaks = enKeys.filter(k => {
    if (!TECH_KEY_RE.test(k)) return false;
    return I18N.t(k) === k;
  });
  assert(
    `[${lang}] No technical key returns itself as its own translation — leaked: ${rawKeyLeaks.length === 0 ? 'none' : rawKeyLeaks.slice(0, 5).join(', ') + (rawKeyLeaks.length > 5 ? '…' : '')}`,
    rawKeyLeaks.length === 0
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
