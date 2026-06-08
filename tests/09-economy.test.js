// ===== TEST 9: economy.js — ingresos, gastos y balance semanal =====
// Run: node tests/09-economy.test.js
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
function assertEq(desc, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}\n     got:      ${JSON.stringify(a)}\n     expected: ${JSON.stringify(b)}`); failed++; }
}
function near(desc, a, b, tolerance = 1) {
  if (Math.abs(a - b) <= tolerance) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}\n     got: ${a}, expected ~${b} (±${tolerance})`); failed++; }
}

// ── Cargar economy.js en sandbox con window simulado ─────────────────────────

const sandbox = { window: {}, console };
vm.createContext(sandbox);
const economyCode = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'economy.js'), 'utf8'
);
vm.runInContext(economyCode, sandbox);
const Economy = sandbox.window.Economy;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides = {}) {
  return {
    season:   { division: 8 },
    team:     { fans: 1000 },
    finances: { credits: 10000, deficitStreak: 0, criticalDeficit: false, lastNet: 0,
                bonusIncome: 0, history: [] },
    sponsors: [],
    staff:    [],
    hq:       { admin: 0, wind_tunnel: 0, rnd: 0, factory: 0, academy: 0 },
    contracts: [],
    construction: { active: false },
    pilots:   [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 1. calculateTeamIncomeBreakdown ──────────────────────────────');

{
  const state = makeState();
  const b = Economy.calculateTeamIncomeBreakdown(state);

  assert('devuelve objeto con claves esperadas',
    'income' in b && 'sponsorIncome' in b && 'fanRevenue' in b && 'divisionGrant' in b
  );
  assertEq('sin patrocinadores → sponsorIncome = 0', b.sponsorIncome, 0);
  near('division 8 → divisionGrant = 16000', b.divisionGrant, 16000);
  near('1000 fans * 0.12 → fanRevenue = 120', b.fanRevenue, 120);
  near('ingreso total sin sponsors = 16120', b.income, 16120);
}

{
  const state = makeState({
    sponsors: [
      { weeklyValue: 5000, expired: false },
      { weeklyValue: 3000, expired: false },
      { weeklyValue: 2000, expired: true  },   // expirado, no cuenta
    ],
  });
  const b = Economy.calculateTeamIncomeBreakdown(state);
  assert('patrocinadores expirados se excluyen', b.sponsorIncome >= 8000 && b.sponsorIncome < 10000);
}

{
  const state = makeState({ sponsors: [{ weeklyValue: 10000, expired: false }], hq: { admin: 5 } });
  const b = Economy.calculateTeamIncomeBreakdown(state);
  assert('HQ admin lv5 → sponsorIncome > base (bonus aplicado)', b.sponsorIncome > 10000);
}

{
  const state = makeState({
    sponsors: [{ weeklyValue: 10000, expired: false }],
    staff: [{ roleKey: 'commercial_dir', salary: 5000 }],
  });
  const b = Economy.calculateTeamIncomeBreakdown(state);
  assert('director comercial → sponsorIncome += 10%', b.sponsorIncome >= 11000);
}

{
  const divGrants = { 1: 65000, 2: 52000, 3: 42000, 4: 34000, 5: 28000, 6: 23000, 7: 19000, 8: 16000 };
  for (const [div, expected] of Object.entries(divGrants)) {
    const state = makeState({ season: { division: Number(div) } });
    const b = Economy.calculateTeamIncomeBreakdown(state);
    near(`División ${div} → divisionGrant = ${expected}`, b.divisionGrant, expected);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 2. calculateTeamExpenseBreakdown ─────────────────────────────');

{
  const state = makeState();
  const b = Economy.calculateTeamExpenseBreakdown(state);

  assert('devuelve objeto con claves esperadas',
    'expenses' in b && 'salaries' in b && 'hqCost' in b && 'contractCost' in b
  );
  assertEq('sin pilotos ni staff → salaries = 0', b.salaries, 0);
  assertEq('HQ todo a 0 → hqCost = 0', b.hqCost, 0);
  assertEq('sin contratos → contractCost = 0', b.contractCost, 0);
  assertEq('sin construcción → constructionUpkeep = 0', b.constructionUpkeep, 0);
  assertEq('gastos totales vacíos = 0', b.expenses, 0);
}

{
  const state = makeState({
    pilots: [{ salary: 12000 }, { salary: 8000 }],
    staff:  [{ salary: 3000 }],
  });
  const b = Economy.calculateTeamExpenseBreakdown(state);
  assertEq('salaries = suma pilotos + staff', b.salaries, 23000);
}

{
  const state = makeState({ hq: { admin: 2, wind_tunnel: 1, rnd: 0, factory: 0, academy: 0 } });
  const b = Economy.calculateTeamExpenseBreakdown(state);
  // admin lv2 = 2*300=600, wind_tunnel lv1 = 1*450=450 → total = 1050
  near('HQ admin=2 wind_tunnel=1 → hqCost = 1050', b.hqCost, 1050);
}

{
  const state = makeState({
    contracts:    [{ weeklyCost: 1500, expired: false }, { weeklyCost: 2000, expired: true }],
    construction: { active: true },
  });
  const b = Economy.calculateTeamExpenseBreakdown(state);
  assertEq('contratos expirados no cuentan', b.contractCost, 1500);
  assertEq('construcción activa → upkeep = 500', b.constructionUpkeep, 500);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 3. processWeeklyBalance ──────────────────────────────────────');

{
  const state = makeState({ sponsors: [{ weeklyValue: 20000, expired: false }] });
  const result = Economy.processWeeklyBalance(state);

  assert('devuelve { income, expenses, net, effects }',
    typeof result.income === 'number' && typeof result.expenses === 'number' &&
    typeof result.net === 'number' && result.effects != null
  );
  assert('net = income - expenses', result.net === result.income - result.expenses);
  assert('net positivo con sponsors > gastos', result.net > 0);
  assertEq('sin déficit → streak = 0', result.effects.streak, 0);
}

{
  // Estado con gastos > ingresos para provocar déficit
  const state = makeState({
    pilots: [{ salary: 30000 }, { salary: 30000 }],
    sponsors: [],
  });
  const result = Economy.processWeeklyBalance(state);
  assert('net negativo cuando gastos > ingresos', result.net < 0);
  assertEq('primera semana en déficit → streak = 1', result.effects.streak, 1);
  assert('notes incluye "deficit"', result.effects.notes.includes('deficit'));
  assert('fans bajan con déficit', state.team.fans < 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 4. handleDeficitStatus ───────────────────────────────────────');

{
  const state = makeState();

  // 3 semanas consecutivas en déficit → criticalDeficit
  for (let i = 0; i < 3; i++) {
    Economy.handleDeficitStatus(state, -5000);
  }
  assertEq('3 semanas déficit → streak = 3', state.finances.deficitStreak, 3);
  assertEq('criticalDeficit = true tras 3 semanas', state.finances.criticalDeficit, true);
  // Ronda 1: streak<3 → fanLoss=45; Ronda 2: streak<3 → fanLoss=45; Ronda 3: streak>=3 → fanLoss=120
  // fans = 1000 - 45 - 45 - 120 = 790
  near('fans tras 3 déficits = 790', state.team.fans, 790);
}

{
  const state = makeState({ finances: { deficitStreak: 2, criticalDeficit: false, lastNet: 0, history: [] } });

  // Semana positiva → recupera streak
  Economy.handleDeficitStatus(state, 5000);
  assertEq('semana positiva reduce streak de 2 a 1', state.finances.deficitStreak, 1);
  assert('criticalDeficit = false tras semana positiva', !state.finances.criticalDeficit);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── 5. Casos borde ────────────────────────────────────────────────');

{
  const result = Economy.calculateTeamIncomeBreakdown(null);
  assert('null state → income = 0', result.income === 0);
}
{
  const result = Economy.calculateTeamExpenseBreakdown(null);
  assert('null state → expenses = 0', result.expenses === 0);
}
{
  const result = Economy.processWeeklyBalance(null);
  assert('null state → net = 0', result.net === 0);
  assert('null state → no crash', result.effects != null);
}
{
  const state = makeState({ team: { fans: 0 } });
  Economy.handleDeficitStatus(state, -1000);
  assert('fans no bajan de 0', state.team.fans === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Resultado: ${passed} ✅  ${failed} ❌  (total: ${passed + failed})`);
if (failed > 0) process.exit(1);
