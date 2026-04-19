// ===== TEST 5: race-runner.js — con Firestore Emulator =====
// Requisito: firebase emulators:start --only firestore
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/05-race-runner.test.js

'use strict';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'garage-legends-demo' });
}
const db = admin.firestore();

const { runRaceForDivision } = require('../functions/lib/race-runner.js');
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

function makePlayerTeamSnapshot(userId) {
  return {
    teamName: `Team ${userId}`,
    colors: { primary: '#ff0000', secondary: '#0a0b0f' },
    logo: '',
    pilots: [sharedData.PILOT_POOL[0], sharedData.PILOT_POOL[1]],
    car: {
      components: {
        engine:      { score: 62, level: 1 },
        chassis:     { score: 60, level: 1 },
        aero:        { score: 58, level: 1 },
        brakes:      { score: 56, level: 1 },
        gearbox:     { score: 61, level: 1 },
        reliability: { score: 59, level: 1 },
        efficiency:  { score: 60, level: 1 },
        tyreManage:  { score: 57, level: 1 }
      }
    },
    staff: [],
    hq: { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
    engineSupplier: '',
    fans: 2000
  };
}

async function createTestDivision(divKey, playerUserId) {
  const rng = new engineCore.SeededRNG(`cal_${divKey}`);
  const calendar = engineCore.generateCalendar(8, sharedData.CIRCUITS, rng);

  // Asegurar que round 1 esté marcado como 'next'
  calendar[0].status = 'next';
  calendar.slice(1).forEach(r => { r.status = 'upcoming'; });

  const playerSlot = {
    type: 'player',
    userId: playerUserId,
    teamSnapshot: makePlayerTeamSnapshot(playerUserId)
  };

  // Llenar el resto con bots
  const slots = { '0': playerSlot };
  for (let i = 1; i < 10; i++) {
    const aiTeam = sharedData.AI_TEAMS[i - 1];
    slots[String(i)] = {
      type: 'bot',
      botTeamId: aiTeam.id,
      teamSnapshot: {
        teamName: aiTeam.name,
        colors: { primary: aiTeam.color, secondary: '#0a0b0f' },
        pilots: [sharedData.PILOT_POOL.find(p => p.id === 'ai1'), sharedData.PILOT_POOL.find(p => p.id === 'ai2')],
        car: { components: {
          engine:      { score: 55, level: 1 }, chassis:     { score: 53, level: 1 },
          aero:        { score: 51, level: 1 }, brakes:      { score: 49, level: 1 },
          gearbox:     { score: 54, level: 1 }, reliability: { score: 52, level: 1 },
          efficiency:  { score: 53, level: 1 }, tyreManage:  { score: 50, level: 1 }
        }},
        staff: [], hq: {}, engineSupplier: '', fans: 1000
      }
    };
  }

  const standings = [
    { slotIndex: 0, teamId: playerUserId, teamName: `Team ${playerUserId}`, color: '#ff0000', points: 0, wins: 0, podiums: 0, position: 1, bestResult: 0, isPlayer: true }
  ];
  sharedData.AI_TEAMS.slice(0, 9).forEach((t, i) => {
    standings.push({ slotIndex: i + 1, teamId: t.id, teamName: t.name, color: t.color, points: 0, wins: 0, podiums: 0, position: i + 2, bestResult: 0, isPlayer: false });
  });

  await db.collection('divisions').doc(divKey).set({
    division: 8, group: 1, seasonYear: 1, phase: 'season',
    calendar, slots, standings, nextRaceRound: 1, raceInProgress: false
  });

  // Crear profile del jugador
  await db.collection('profiles').doc(playerUserId).set({
    email: `${playerUserId}@test.com`, role: 'player',
    mp: { division: 8, divisionGroup: 1, divKey, slotIndex: 0, status: 'active', seasonYear: 1 },
    save_data: { finances: { credits: 100000 } }
  });
}

async function run() {
  console.log('\n=== race-runner Tests ===\n');
  await clearAll();

  const DIV_KEY = 'race_test_8_1';
  const PLAYER_ID = 'player_racer_001';

  await createTestDivision(DIV_KEY, PLAYER_ID);

  // ── 1. Carrera básica completa
  console.log('1. Carrera básica — sin estrategia enviada');
  {
    const result = await runRaceForDivision(db, DIV_KEY, { triggeredBy: 'test' });

    assert('Tiene divKey', result.divKey === DIV_KEY);
    assert('Tiene round', Number.isFinite(result.round) && result.round === 1);
    assert('Tiene circuitName', typeof result.circuitName === 'string');
    assert('Tiene gridSize', Number.isFinite(result.gridSize) && result.gridSize > 0);
    assert('Tiene topPositions', Array.isArray(result.topPositions) && result.topPositions.length <= 3);
    assert('isLastRace es boolean', typeof result.isLastRace === 'boolean');
  }

  // ── 2. raceResults/{round} fue escrito en Firestore
  console.log('\n2. raceResults guardado en Firestore');
  {
    const snap = await db.collection('divisions').doc(DIV_KEY)
      .collection('raceResults').doc('1').get();

    assert('raceResults/1 existe', snap.exists);
    const data = snap.data();
    assertEq('round correcto', data.round, 1);
    assert('Tiene finalGrid', Array.isArray(data.finalGrid) && data.finalGrid.length > 0);
    assert('Tiene events', Array.isArray(data.events));
    assert('Tiene teamSummaries', !!data.teamSummaries);
    assert('Tiene standingsAfter', Array.isArray(data.standingsAfter));
    assert('Tiene totalLaps', Number.isFinite(data.totalLaps));
    assert('triggeredBy es test', data.triggeredBy === 'test');
  }

  // ── 3. Standings actualizados en división
  console.log('\n3. Standings actualizados');
  {
    const divSnap = await db.collection('divisions').doc(DIV_KEY).get();
    const standings = divSnap.data().standings;

    assert('Standings no vacíos', standings.length > 0);
    const total = standings.reduce((sum, s) => sum + (s.points || 0), 0);
    assert('Hubo puntos repartidos', total > 0);
    standings.forEach((s, i) => {
      assert(`Position ${i+1} correcta`, s.position === i + 1);
    });
  }

  // ── 4. Calendario avanzado
  console.log('\n4. Calendario avanzado');
  {
    const divSnap = await db.collection('divisions').doc(DIV_KEY).get();
    const cal = divSnap.data().calendar;
    const completed = cal.filter(r => r.status === 'completed');
    const next = cal.filter(r => r.status === 'next');
    const upcoming = cal.filter(r => r.status === 'upcoming');

    assertEq('1 carrera completada', completed.length, 1);
    assert('Siguiente carrera marcada como next', next.length <= 1);
    assert('Ronda 1 está completada', cal[0].status === 'completed');
  }

  // ── 5. raceInProgress se limpia al terminar
  console.log('\n5. raceInProgress limpiado');
  {
    const divSnap = await db.collection('divisions').doc(DIV_KEY).get();
    assertEq('raceInProgress = false', divSnap.data().raceInProgress, false);
  }

  // ── 6. Prize money aplicado al perfil
  console.log('\n6. Prize money aplicado al jugador');
  {
    const profileSnap = await db.collection('profiles').doc(PLAYER_ID).get();
    const credits = profileSnap.data().save_data?.finances?.credits;
    // El jugador empieza con 100000 y recibe prize money si no es DNF
    assert('Credits en profile es número', Number.isFinite(credits));
    // No podemos garantizar que ganó puntos, pero credits no debería ser undefined
    assert('Credits existe', credits !== undefined);
  }

  // ── 7. Carrera con estrategia enviada por jugador
  console.log('\n7. Carrera con estrategia del jugador');
  {
    const DIV_KEY2 = 'race_test_8_2';
    const PLAYER2 = 'player_strat_001';
    await createTestDivision(DIV_KEY2, PLAYER2);

    // Escribir estrategia para ronda 1
    await db.collection('divisions').doc(DIV_KEY2)
      .collection('strategies').doc(PLAYER2).set({
        userId: PLAYER2,
        slotIndex: 0,
        raceRound: 1,
        strategy: {
          tyre: 'soft',
          aggression: 80,
          pitLap: 35,
          riskLevel: 60,
          engineMode: 'push',
          pitPlan: 'double',
          safetyCarReaction: 'live',
          setup: { aeroBalance: 40, wetBias: 35 },
          selectedPilotIds: [sharedData.PILOT_POOL[0].id, sharedData.PILOT_POOL[1].id],
          driverConfigs: {}
        }
      });

    const result = await runRaceForDivision(db, DIV_KEY2, { triggeredBy: 'test' });
    assert('Carrera con estrategia completa', result.round === 1);

    // Estrategia debe haberse consumido (eliminada)
    const stratSnap = await db.collection('divisions').doc(DIV_KEY2)
      .collection('strategies').doc(PLAYER2).get();
    assert('Estrategia eliminada post-carrera', !stratSnap.exists);
  }

  // ── 8. No puede correr si raceInProgress = true
  console.log('\n8. Guard: raceInProgress');
  {
    const DIV_KEY3 = 'race_test_8_3';
    await createTestDivision(DIV_KEY3, 'player_lock_001');
    await db.collection('divisions').doc(DIV_KEY3).update({ raceInProgress: true });

    let threw = false;
    try {
      await runRaceForDivision(db, DIV_KEY3, { triggeredBy: 'test' });
    } catch (e) {
      threw = true;
    }
    assert('Lanza error si raceInProgress = true', threw);
  }

  // ── 9. No puede correr en fase offseason
  console.log('\n9. Guard: phase offseason');
  {
    const DIV_KEY4 = 'race_test_8_4';
    await createTestDivision(DIV_KEY4, 'player_off_001');
    await db.collection('divisions').doc(DIV_KEY4).update({ phase: 'offseason' });

    let threw = false;
    try {
      await runRaceForDivision(db, DIV_KEY4, { triggeredBy: 'test' });
    } catch (e) {
      threw = true;
    }
    assert('Lanza error si phase != season', threw);
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Error en tests:', err);
  process.exit(1);
});
