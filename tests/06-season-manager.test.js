// ===== TEST 6: season-manager.js — con Firestore Emulator =====
// Requisito: firebase emulators:start --only firestore
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/06-season-manager.test.js

'use strict';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'garage-legends-demo' });
}
const db = admin.firestore();

const { endDivisionSeason } = require('../functions/lib/season-manager.js');
const sharedData = require('../shared/data-constants.js');
const engineCore  = require('../shared/engine-core.js');

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

async function clearAll() {
  for (const col of ['divisions', 'profiles']) {
    const snap = await db.collection(col).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// Crear una división con standings ya definidos (simula fin de temporada)
async function createDivisionWithResults(divKey, division, standings) {
  const rng = new engineCore.SeededRNG(`cal_${divKey}`);
  const calendar = engineCore.generateCalendar(division, sharedData.CIRCUITS, rng)
    .map(r => ({ ...r, status: 'completed' }));

  const slots = {};
  standings.forEach((s, i) => {
    slots[String(i)] = s.isPlayer
      ? { type: 'player', userId: s.teamId, teamSnapshot: {} }
      : { type: 'bot', botTeamId: s.teamId, teamSnapshot: {} };
  });

  await db.collection('divisions').doc(divKey).set({
    division, group: 1, seasonYear: 1, phase: 'season',
    calendar, slots, standings, nextRaceRound: null, raceInProgress: false
  });

  // Crear profiles para los jugadores
  for (const s of standings) {
    if (s.isPlayer) {
      await db.collection('profiles').doc(s.teamId).set({
        email: `${s.teamId}@test.com`, role: 'player',
        mp: { division, divisionGroup: 1, divKey, slotIndex: standings.indexOf(s), status: 'active', seasonYear: 1 }
      });
    }
  }
}

async function run() {
  console.log('\n=== season-manager Tests ===\n');
  await clearAll();

  // Div 8: promotions=2, relegations=0
  // ── 1. División 8 — top 2 promovidos, nadie relegado
  console.log('1. División 8 — top 2 promovidos');
  {
    const DIV_KEY = 'season_8_1';
    const standings = [
      { slotIndex: 0, teamId: 'p_winner',   teamName: 'Winner FC',   color: '#ff0', points: 120, wins: 5, podiums: 8,  position: 1, bestResult: 1, isPlayer: true },
      { slotIndex: 1, teamId: 'p_second',   teamName: 'Second FC',   color: '#0ff', points: 95,  wins: 3, podiums: 6,  position: 2, bestResult: 2, isPlayer: true },
      { slotIndex: 2, teamId: 'p_third',    teamName: 'Third FC',    color: '#f0f', points: 80,  wins: 1, podiums: 3,  position: 3, bestResult: 3, isPlayer: true },
      { slotIndex: 3, teamId: 'ai_t1',      teamName: 'Red Arrow',   color: '#00f', points: 70,  wins: 2, podiums: 4,  position: 4, bestResult: 2, isPlayer: false },
      { slotIndex: 4, teamId: 'ai_t2',      teamName: 'Pacific',     color: '#0f0', points: 55,  wins: 0, podiums: 2,  position: 5, bestResult: 4, isPlayer: false },
      { slotIndex: 5, teamId: 'ai_t3',      teamName: 'Volta',       color: '#f00', points: 40,  wins: 0, podiums: 1,  position: 6, bestResult: 5, isPlayer: false },
      { slotIndex: 6, teamId: 'ai_t4',      teamName: 'Vortex',      color: '#fff', points: 30,  wins: 0, podiums: 0,  position: 7, bestResult: 6, isPlayer: false },
      { slotIndex: 7, teamId: 'ai_t5',      teamName: 'IronHorse',   color: '#888', points: 20,  wins: 0, podiums: 0,  position: 8, bestResult: 7, isPlayer: false },
      { slotIndex: 8, teamId: 'ai_t6',      teamName: 'Southern',    color: '#444', points: 10,  wins: 0, podiums: 0,  position: 9, bestResult: 8, isPlayer: false },
      { slotIndex: 9, teamId: 'ai_t7',      teamName: 'Nordic',      color: '#222', points: 5,   wins: 0, podiums: 0,  position: 10,bestResult: 9, isPlayer: false }
    ];
    await createDivisionWithResults(DIV_KEY, 8, standings);
    await endDivisionSeason(db, DIV_KEY);

    // Verificar phase = offseason
    const divSnap = await db.collection('divisions').doc(DIV_KEY).get();
    assertEq('División pasa a offseason', divSnap.data().phase, 'offseason');

    // Verificar season archive
    const archSnap = await db.collection('divisions').doc(DIV_KEY)
      .collection('seasonArchive').doc('1').get();
    assert('seasonArchive/1 existe', archSnap.exists);
    assertEq('seasonYear en archive', archSnap.data().seasonYear, 1);
    assertEq('division en archive', archSnap.data().division, 8);
    assert('finalStandings en archive', Array.isArray(archSnap.data().finalStandings));

    // Verificar pendingDivision del ganador → div 7
    const winnerSnap = await db.collection('profiles').doc('p_winner').get();
    assertEq('Ganador tiene pendingDivision=7', winnerSnap.data().mp.pendingDivision, 7);
    assertEq('Ganador tiene seasonOutcome=promoted', winnerSnap.data().mp.seasonOutcome, 'promoted');

    // Verificar segundo → div 7
    const secondSnap = await db.collection('profiles').doc('p_second').get();
    assertEq('Segundo tiene pendingDivision=7', secondSnap.data().mp.pendingDivision, 7);

    // Tercero no promovido → div 8
    const thirdSnap = await db.collection('profiles').doc('p_third').get();
    assertEq('Tercero tiene pendingDivision=8 (se queda)', thirdSnap.data().mp.pendingDivision, 8);
    assertEq('Tercero tiene seasonOutcome=stayed', thirdSnap.data().mp.seasonOutcome, 'stayed');
  }

  // ── 2. División 4 — promotions=3, relegations=3
  console.log('\n2. División 4 — top 3 promovidos, bottom 3 relegados');
  {
    const DIV_KEY = 'season_4_1';
    const standings = [];
    for (let i = 0; i < 10; i++) {
      const isPlayer = i < 6; // 6 jugadores
      standings.push({
        slotIndex: i,
        teamId: isPlayer ? `p4_user_${i}` : `ai_t${i+1}`,
        teamName: `Team ${i}`,
        color: '#000',
        points: (10 - i) * 20,
        wins: Math.max(0, 5 - i),
        podiums: Math.max(0, 8 - i),
        position: i + 1,
        bestResult: i + 1,
        isPlayer
      });
    }
    await createDivisionWithResults(DIV_KEY, 4, standings);
    await endDivisionSeason(db, DIV_KEY);

    // Top 3 → div 3
    for (let i = 0; i < 3; i++) {
      if (!standings[i].isPlayer) continue;
      const snap = await db.collection('profiles').doc(standings[i].teamId).get();
      assertEq(`Pos ${i+1} → div 3`, snap.data().mp.pendingDivision, 3);
      assertEq(`Pos ${i+1} promoted`, snap.data().mp.seasonOutcome, 'promoted');
    }

    // Bottom 3 (pos 8, 9, 10) → div 5
    for (let i = 7; i < 10; i++) {
      if (!standings[i].isPlayer) continue;
      const snap = await db.collection('profiles').doc(standings[i].teamId).get();
      assertEq(`Pos ${i+1} → div 5`, snap.data().mp.pendingDivision, 5);
      assertEq(`Pos ${i+1} relegated`, snap.data().mp.seasonOutcome, 'relegated');
    }
  }

  // ── 3. División 1 — no puede ascender más (div 1 = techo)
  console.log('\n3. División 1 — promotions=0, ninguno asciende');
  {
    const DIV_KEY = 'season_1_1';
    const standings = [
      { slotIndex: 0, teamId: 'p1_top',  teamName: 'Top Team', color: '#gold', points: 200, wins: 8, podiums: 10, position: 1, bestResult: 1, isPlayer: true },
      ...Array.from({ length: 9 }, (_, i) => ({
        slotIndex: i + 1, teamId: `ai_d1_${i}`, teamName: `Bot ${i}`, color: '#888',
        points: 100 - i * 10, wins: 0, podiums: 0, position: i + 2, bestResult: i + 2, isPlayer: false
      }))
    ];
    await createDivisionWithResults(DIV_KEY, 1, standings);
    await endDivisionSeason(db, DIV_KEY);

    const snap = await db.collection('profiles').doc('p1_top').get();
    // División 1 tiene promotions=0, así que el ganador se queda
    assertEq('Campeón div1 se queda en div1', snap.data().mp.pendingDivision, 1);
    assertEq('outcome=stayed', snap.data().mp.seasonOutcome, 'stayed');
  }

  // ── 4. División 8 — no puede descender más (div 8 = suelo)
  console.log('\n4. División 8 — relegations=0, nadie desciende');
  {
    // División 8 ya fue testeada en punto 1, verificamos que nadie tiene pendingDivision=9
    const thirdSnap = await db.collection('profiles').doc('p_third').get();
    assert('Ningún jugador de div8 puede ir a div9', thirdSnap.data().mp.pendingDivision !== 9);
  }

  // ── 5. Orden del archive: sorted por puntos desc
  console.log('\n5. Archive con standings ordenados');
  {
    const archSnap = await db.collection('divisions').doc('season_8_1')
      .collection('seasonArchive').doc('1').get();
    const finalStandings = archSnap.data().finalStandings;
    assert('finalStandings ordenado por puntos desc', finalStandings[0].points >= finalStandings[1].points);
    assert('Ganador es primero', finalStandings[0].teamId === 'p_winner');
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Error en tests:', err);
  process.exit(1);
});
