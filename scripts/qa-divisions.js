'use strict';
// QA: valida que todas las divisiones estén bien creadas y que las reglas
// de ascensos/descensos sean correctas.
// Uso: node scripts/qa-divisions.js

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const sharedData = require('../functions/shared/data-constants.js');

const EXPECTED = [
  { div: 8, parallelDivisions: 16, promotions: 2, relegations: 0 },
  { div: 7, parallelDivisions: 12, promotions: 2, relegations: 2 },
  { div: 6, parallelDivisions:  8, promotions: 2, relegations: 2 },
  { div: 5, parallelDivisions:  6, promotions: 2, relegations: 2 },
  { div: 4, parallelDivisions:  4, promotions: 3, relegations: 3 },
  { div: 3, parallelDivisions:  3, promotions: 3, relegations: 3 },
  { div: 2, parallelDivisions:  2, promotions: 4, relegations: 4 },
  { div: 1, parallelDivisions:  1, promotions: 0, relegations: 4 },
];
const TEAMS_PER_GROUP = 10;

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++; }
function check(condition, msg) { condition ? ok(msg) : fail(msg); }

// ─── 1. Verificar que todas las divisiones/grupos existen ────────────────────
async function checkAllGroupsExist() {
  console.log('\n[1] Verificando existencia de todos los grupos...');
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  const existingKeys = new Set();
  snap.forEach(doc => existingKeys.add(doc.id));

  for (const { div, parallelDivisions } of EXPECTED) {
    for (let g = 1; g <= parallelDivisions; g++) {
      const key = `${div}_${g}`;
      check(existingKeys.has(key), `${key} existe`);
    }
  }
}

// ─── 2. Verificar estructura interna de cada grupo ───────────────────────────
async function checkGroupStructure() {
  console.log('\n[2] Verificando estructura interna de cada grupo...');
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();

  for (const doc of snap.docs) {
    const d   = doc.data();
    const key = doc.id;

    // slots: exactamente 10 (0-9)
    const slotCount = Object.keys(d.slots || {}).length;
    check(slotCount === TEAMS_PER_GROUP, `${key}: ${slotCount}/10 slots`);

    // standings: exactamente 10 entradas con teamId
    const standings = d.standings || [];
    check(standings.length === TEAMS_PER_GROUP, `${key}: ${standings.length}/10 standings`);

    // calendar no vacío
    check((d.calendar || []).length > 0, `${key}: calendar presente (${(d.calendar||[]).length} carreras)`);

    // ningún slot sin tipo
    const badSlots = Object.values(d.slots || {}).filter(s => !s || !s.type);
    check(badSlots.length === 0, `${key}: todos los slots tienen tipo`);

    // standings con isPlayer=false (todos bots cuando no hay jugadores)
    const playerSlots = Object.values(d.slots || {}).filter(s => s && s.type === 'player');
    const playerStandings = standings.filter(s => s.isPlayer);
    check(playerStandings.length === playerSlots.length, `${key}: isPlayer coherente (${playerSlots.length} jugadores reales)`);
  }
}

// ─── 3. Verificar reglas de ascensos/descensos en season-manager ─────────────
async function checkPromotionRelegationRules() {
  console.log('\n[3] Verificando reglas de ascensos/descensos...');

  for (const { div, promotions, relegations } of EXPECTED) {
    const catalog = sharedData.DIVISIONS.find(d => d.div === div);
    if (!catalog) { fail(`División ${div} no encontrada en data-constants`); continue; }

    check(catalog.promotions === promotions,
      `Div ${div}: promotions=${catalog.promotions} (esperado ${promotions})`);
    check(catalog.relegations === relegations,
      `Div ${div}: relegations=${catalog.relegations} (esperado ${relegations})`);

    // Dirección correcta: promoted → div-1, relegated → div+1
    if (div > 1 && promotions > 0) {
      const targetUp = div - 1;
      const targetCatalog = sharedData.DIVISIONS.find(d => d.div === targetUp);
      check(!!targetCatalog, `Div ${div} → promueve a Div ${targetUp} (existe)`);
    }
    if (div < 8 && relegations > 0) {
      const targetDown = div + 1;
      const targetCatalog = sharedData.DIVISIONS.find(d => d.div === targetDown);
      check(!!targetCatalog, `Div ${div} → relega a Div ${targetDown} (existe)`);
    }
  }

  // Div 1 no puede promocionar (promotions=0), Div 8 no puede relegar (relegations=0)
  const div1 = sharedData.DIVISIONS.find(d => d.div === 1);
  check(div1 && div1.promotions === 0, 'Div 1: promotions=0 (no puede subir más)');
  const div8 = sharedData.DIVISIONS.find(d => d.div === 8);
  check(div8 && div8.relegations === 0, 'Div 8: relegations=0 (no puede bajar más)');

  // Zona promoción y relegación no se superponen en ninguna división
  for (const { div, promotions: p, relegations: r } of EXPECTED) {
    const overlap = p + r > TEAMS_PER_GROUP;
    check(!overlap, `Div ${div}: zonas promo+relega no se superponen (${p}+${r}=${p+r} ≤ ${TEAMS_PER_GROUP})`);
  }
}

// ─── 4. Verificar que el Admin puede ver todas las divisiones ────────────────
async function checkAdminCanSeeAllDivisions() {
  console.log('\n[4] Verificando visibilidad admin de todas las divisiones...');
  // Simula la query que usa el admin para mover jugadores
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  const docs = [];
  snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
  docs.sort((a, b) => (a.division - b.division) || (a.group - b.group));

  const totalExpected = EXPECTED.reduce((s, d) => s + d.parallelDivisions, 0);
  check(docs.length >= totalExpected,
    `Admin ve ${docs.length} divisiones (mínimo esperado: ${totalExpected})`);

  // Verificar que hay al menos una división por cada tier
  for (const { div } of EXPECTED) {
    const found = docs.filter(d => d.division === div);
    check(found.length > 0, `Admin ve divisiones de tier ${div}`);
  }
}

// ─── 5. Verificar estado del calendario (primera carrera pendiente) ──────────
async function checkCalendarState() {
  console.log('\n[5] Verificando estado del calendario...');
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  let withNext = 0;
  let withoutNext = 0;

  snap.forEach(doc => {
    const cal = doc.data().calendar || [];
    const hasNext = cal.some(r => r.status === 'next');
    if (hasNext) withNext++; else withoutNext++;
  });

  check(withNext > 0, `Al menos una división tiene carrera pendiente (${withNext} con "next")`);
  console.log(`    Info: ${withoutNext} grupos sin carrera próxima (ya corrieron o están al inicio)`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== QA – Validación de divisiones ===');

  await checkAllGroupsExist();
  await checkGroupStructure();
  await checkPromotionRelegationRules();
  await checkAdminCanSeeAllDivisions();
  await checkCalendarState();

  console.log(`\n=== Resultado: ${passed} OK · ${failed} FALLIDOS ===\n`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error fatal:', e); process.exit(1); });
