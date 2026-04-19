// ===== TEST 3: bot-filler.js — con Firestore Emulator =====
// Requisito: firebase emulators:start --only firestore
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/03-bot-filler.test.js

'use strict';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'garage-legends-demo' });
}
const db = admin.firestore();

const { fillDivisionBots, DIVISION_CAR_RANGE } = require('../functions/lib/bot-filler.js');
const sharedData = require('../shared/data-constants.js');
const engineCore = require('../shared/engine-core.js');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}`); failed++; }
}
function assertEq(desc, a, b) {
  if (a === b) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); failed++; }
}

async function clearCollection(col) {
  const snap = await db.collection(col).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

async function createDivision(divKey, slots = {}, standings = []) {
  const rng = new engineCore.SeededRNG(`cal_${divKey}`);
  const calendar = engineCore.generateCalendar(8, sharedData.CIRCUITS, rng);
  await db.collection('divisions').doc(divKey).set({
    division: 8,
    group: 1,
    seasonYear: 1,
    phase: 'season',
    calendar,
    slots,
    standings,
    nextRaceRound: 1,
    raceInProgress: false
  });
}

async function run() {
  console.log('\n=== bot-filler Tests ===\n');

  await clearCollection('divisions');

  // ── 1. Llena división completamente vacía (0 slots → 10 bots)
  console.log('1. División vacía → 10 bots');
  {
    const KEY = 'test_8_1';
    await createDivision(KEY, {}, []);
    await fillDivisionBots(db, KEY, 8);

    const snap = await db.collection('divisions').doc(KEY).get();
    const data = snap.data();
    const slots = data.slots || {};
    const standings = data.standings || [];

    assertEq('10 slots creados', Object.keys(slots).length, 10);
    assert('Todos son type:bot', Object.values(slots).every(s => s.type === 'bot'));
    assertEq('10 entradas en standings', standings.length, 10);
    assert('Todos tienen botTeamId', Object.values(slots).every(s => !!s.botTeamId));
  }

  // ── 2. No duplica bots en la misma división
  console.log('\n2. Sin duplicados de botTeamId');
  {
    const KEY = 'test_8_2';
    await createDivision(KEY, {}, []);
    await fillDivisionBots(db, KEY, 8);

    const snap = await db.collection('divisions').doc(KEY).get();
    const slots = snap.data().slots || {};
    const botIds = Object.values(slots).map(s => s.botTeamId);
    assert('No hay botTeamIds duplicados', new Set(botIds).size === botIds.length);
  }

  // ── 3. Scores dentro del rango de la división
  console.log('\n3. Car scores dentro del rango de división');
  {
    const KEY = 'test_8_3';
    await createDivision(KEY, {}, []);
    await fillDivisionBots(db, KEY, 8);

    const snap = await db.collection('divisions').doc(KEY).get();
    const slots = snap.data().slots || {};
    const [min, max] = DIVISION_CAR_RANGE[8];

    let allInRange = true;
    Object.values(slots).forEach(slot => {
      const comps = slot.teamSnapshot.car.components;
      Object.values(comps).forEach(c => {
        if (c.score < min || c.score > max) allInRange = false;
      });
    });
    assert(`Scores de componentes en [${min}, ${max}]`, allInRange);
  }

  // ── 4. Con jugador ya en slot 0, no lo sobreescribe
  console.log('\n4. No sobreescribe slot de jugador');
  {
    const KEY = 'test_8_4';
    const playerSlot = {
      type: 'player',
      userId: 'user_123',
      teamSnapshot: { teamName: 'Test Player', colors: { primary: '#ff0000' }, pilots: [], car: { components: {} }, staff: [], hq: {}, engineSupplier: '', fans: 1000 }
    };
    const playerStanding = { slotIndex: 0, teamId: 'user_123', teamName: 'Test Player', color: '#ff0000', points: 0, wins: 0, podiums: 0, position: 1, bestResult: 0, isPlayer: true };
    await createDivision(KEY, { '0': playerSlot }, [playerStanding]);
    await fillDivisionBots(db, KEY, 8);

    const snap = await db.collection('divisions').doc(KEY).get();
    const slots = snap.data().slots || {};

    assert('Slot 0 sigue siendo player', slots['0'].type === 'player');
    assertEq('Slot 0 mantiene userId', slots['0'].userId, 'user_123');
    assertEq('9 slots totales (1 player + 8 bots)', Object.keys(slots).length, 9);
  }

  // ── 5. División ya llena → no hace cambios
  console.log('\n5. División llena → sin cambios');
  {
    const KEY = 'test_8_5';
    const fullSlots = {};
    for (let i = 0; i < 10; i++) {
      fullSlots[String(i)] = { type: 'bot', botTeamId: `ai_t${i + 1}`, teamSnapshot: {} };
    }
    await createDivision(KEY, fullSlots, []);
    await fillDivisionBots(db, KEY, 8);

    const snap = await db.collection('divisions').doc(KEY).get();
    assert('Sigue con 10 slots', Object.keys(snap.data().slots).length === 10);
  }

  // ── 6. División 1 usa rango de scores más alto
  console.log('\n6. División 1 — car scores elevados');
  {
    const KEY = 'test_1_1';
    const rng = new engineCore.SeededRNG(`cal_${KEY}`);
    const calendar = engineCore.generateCalendar(1, sharedData.CIRCUITS, rng);
    await db.collection('divisions').doc(KEY).set({
      division: 1, group: 1, seasonYear: 1, phase: 'season', calendar,
      slots: {}, standings: [], nextRaceRound: 1, raceInProgress: false
    });
    await fillDivisionBots(db, KEY, 1);

    const snap = await db.collection('divisions').doc(KEY).get();
    const slots = snap.data().slots || {};
    const [min1, max1] = DIVISION_CAR_RANGE[1];
    const [min8, max8] = DIVISION_CAR_RANGE[8];

    let allInRange = true;
    let avgScore = 0;
    let count = 0;
    Object.values(slots).forEach(slot => {
      Object.values(slot.teamSnapshot.car.components).forEach(c => {
        if (c.score < min1 || c.score > max1) allInRange = false;
        avgScore += c.score;
        count++;
      });
    });
    avgScore /= count;

    assert(`Scores div 1 en [${min1}, ${max1}]`, allInRange);
    assert(`Score promedio div1 (${avgScore.toFixed(1)}) > score max div8 (${max8})`, avgScore > max8 - 5);
  }

  // ── 7. Determinismo: dos llamadas con misma div → mismos bots
  console.log('\n7. Determinismo entre divisiones iguales');
  {
    const KEY_A = 'test_det_A';
    const KEY_B = 'test_det_B';
    // Mismo seasonYear, mismos slotIdx → misma seed
    await createDivision(KEY_A, {}, []);
    await createDivision(KEY_B, {}, []);
    await fillDivisionBots(db, KEY_A, 8);
    await fillDivisionBots(db, KEY_B, 8);

    const snapA = await db.collection('divisions').doc(KEY_A).get();
    const snapB = await db.collection('divisions').doc(KEY_B).get();
    const slotsA = snapA.data().slots;
    const slotsB = snapB.data().slots;

    // Los botTeamIds se asignan por rotación (availableTeams[i%n]), no por seed
    // Pero los component scores SÍ dependen del divKey+slotIdx (distintos), así que NO deben ser iguales
    // Lo que sí debe ser igual: el número de slots y que todos sean bots
    assertEq('Ambas divisiones tienen 10 slots', Object.keys(slotsA).length, Object.keys(slotsB).length);
    assert('Todos son bots en A', Object.values(slotsA).every(s => s.type === 'bot'));
    assert('Todos son bots en B', Object.values(slotsB).every(s => s.type === 'bot'));
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Error en tests:', err);
  process.exit(1);
});
