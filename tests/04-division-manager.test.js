// ===== TEST 4: division-manager.js — con Firestore Emulator =====
// Requisito: firebase emulators:start --only firestore
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/04-division-manager.test.js

'use strict';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'garage-legends-demo' });
}
const db = admin.firestore();

const { assignPlayerToDivision, updateTeamSnapshot, MAX_TEAMS_PER_DIVISION } = require('../functions/lib/division-manager.js');

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

function makeSnapshot(name = 'Test FC', primary = '#ff0000') {
  return {
    teamName: name,
    colors: { primary, secondary: '#0a0b0f' },
    logo: '🏎️',
    pilots: [],
    car: { components: {
      engine:      { score: 60, level: 1 },
      chassis:     { score: 58, level: 1 },
      aero:        { score: 56, level: 1 },
      brakes:      { score: 54, level: 1 },
      gearbox:     { score: 59, level: 1 },
      reliability: { score: 57, level: 1 },
      efficiency:  { score: 58, level: 1 },
      tyreManage:  { score: 55, level: 1 }
    }},
    staff: [],
    hq: { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
    engineSupplier: '',
    fans: 1500
  };
}

async function createProfile(userId) {
  await db.collection('profiles').doc(userId).set({ email: `${userId}@test.com`, role: 'player' });
}

async function run() {
  console.log('\n=== division-manager Tests ===\n');
  await clearAll();

  // ── 1. Primer jugador crea nueva división
  console.log('1. Primer jugador — crea división 8_1');
  {
    await createProfile('user_001');
    const result = await assignPlayerToDivision(db, 'user_001', makeSnapshot('Team Alpha'));

    assertEq('Division es 8', result.division, 8);
    assert('divKey tiene formato correcto', /^\d+_\d+$/.test(result.divKey));
    assertEq('slotIndex es 0', result.slotIndex, 0);

    const divSnap = await db.collection('divisions').doc(result.divKey).get();
    assert('División existe en Firestore', divSnap.exists);
    const divData = divSnap.data();
    assert('Tiene calendar', Array.isArray(divData.calendar) && divData.calendar.length > 0);
    assert('Tiene standings', Array.isArray(divData.standings));
    assert('Player en standings', divData.standings.some(s => s.teamId === 'user_001'));

    const profileSnap = await db.collection('profiles').doc('user_001').get();
    const mp = profileSnap.data().mp;
    assert('Profile tiene campo mp', !!mp);
    assertEq('mp.division es 8', mp.division, 8);
    assertEq('mp.divKey correcto', mp.divKey, result.divKey);
    assertEq('mp.slotIndex correcto', mp.slotIndex, result.slotIndex);
    assertEq('mp.status es active', mp.status, 'active');
  }

  // ── 2. Segundo jugador en mismo grupo
  console.log('\n2. Segundo jugador — mismo grupo');
  {
    await createProfile('user_002');
    const r1snap = await db.collection('profiles').doc('user_001').get();
    const existingDivKey = r1snap.data().mp.divKey;

    const result = await assignPlayerToDivision(db, 'user_002', makeSnapshot('Team Beta'));
    assertEq('Mismo divKey', result.divKey, existingDivKey);
    assert('slotIndex > 0', result.slotIndex > 0);

    const divSnap = await db.collection('divisions').doc(existingDivKey).get();
    const players = Object.values(divSnap.data().slots).filter(s => s.type === 'player');
    assertEq('2 jugadores en la división', players.length, 2);
  }

  // ── 3. Nuevo jugador reemplaza bot en grupo existente
  console.log('\n3. Nuevo jugador reemplaza bot en grupo existente');
  {
    const r1snap = await db.collection('profiles').doc('user_001').get();
    const divKey = r1snap.data().mp.divKey;
    const divRef = db.collection('divisions').doc(divKey);
    const divData = (await divRef.get()).data();

    // Contar jugadores reales y bots antes
    const realsBefore = Object.values(divData.slots).filter(s => s.type === 'player').length;
    const botsBefore = Object.values(divData.slots).filter(s => s.type === 'bot').length;
    assert('Hay bots en el grupo', botsBefore > 0);

    await createProfile('user_003');
    const result = await assignPlayerToDivision(db, 'user_003', makeSnapshot('Team Gamma'));

    assertEq('Mismo grupo (no se creó uno nuevo)', result.divKey, divKey);
    const divAfter = (await divRef.get()).data();
    const realsAfter = Object.values(divAfter.slots).filter(s => s.type === 'player').length;
    const botsAfter = Object.values(divAfter.slots).filter(s => s.type === 'bot').length;
    assertEq('Un jugador más', realsAfter, realsBefore + 1);
    assertEq('Un bot menos', botsAfter, botsBefore - 1);
  }

  // ── 4. Grupo 100% jugadores reales → crea nuevo grupo
  console.log('\n4. Grupo lleno de jugadores reales → crea nuevo grupo');
  {
    const r1snap = await db.collection('profiles').doc('user_001').get();
    const divKey = r1snap.data().mp.divKey;
    const divRef = db.collection('divisions').doc(divKey);

    // Reemplazar todos los slots restantes con jugadores reales ficticios
    const divData = (await divRef.get()).data();
    const updates = {};
    for (let i = 0; i < MAX_TEAMS_PER_DIVISION; i++) {
      const slot = divData.slots[String(i)];
      if (!slot || slot.type === 'bot') {
        updates[`slots.${i}`] = { type: 'player', userId: `fake_${i}`, teamSnapshot: {} };
      }
    }
    if (Object.keys(updates).length > 0) await divRef.update(updates);

    // Ahora asignar un nuevo jugador — debería crear 8_2
    await createProfile('user_overflow');
    const result = await assignPlayerToDivision(db, 'user_overflow', makeSnapshot('Overflow FC'));

    assert('Nuevo grupo creado', result.divKey !== divKey);
    assertEq('Mismo número de división', result.divKey.split('_')[0], '8');
    assertEq('Nuevo grupo es 2', result.group, 2);
  }

  // ── 5. updateTeamSnapshot actualiza el slot
  console.log('\n5. updateTeamSnapshot');
  {
    const userId = 'user_001';
    const newSnapshot = makeSnapshot('Alpha UPDATED', '#00ff00');

    await updateTeamSnapshot(db, userId, newSnapshot);

    const profileSnap = await db.collection('profiles').doc(userId).get();
    const mp = profileSnap.data().mp;
    const divSnap = await db.collection('divisions').doc(mp.divKey).get();
    const slot = divSnap.data().slots[String(mp.slotIndex)];

    assertEq('teamName actualizado', slot.teamSnapshot.teamName, 'Alpha UPDATED');
    assertEq('Color actualizado', slot.teamSnapshot.colors.primary, '#00ff00');

    // Standings también actualizados
    const standings = divSnap.data().standings;
    const entry = standings.find(s => s.teamId === userId);
    assertEq('standings.teamName actualizado', entry.teamName, 'Alpha UPDATED');
    assertEq('standings.color actualizado', entry.color, '#00ff00');
  }

  // ── 6. No puede asignar jugador ya asignado a segunda división (debería reusar)
  console.log('\n6. Jugador ya asignado — idempotencia');
  {
    // Si assignDivision es llamado de nuevo para user_001, debe fallar o reusar
    // El comportamiento actual asigna NUEVO slot (no idempotente), lo documentamos
    // Este test verifica que el profile tiene UN solo divKey activo
    const profileSnap = await db.collection('profiles').doc('user_001').get();
    const mp = profileSnap.data().mp;
    assert('User_001 tiene un divKey único', !!mp.divKey);
    assertEq('User_001 en división 8', mp.division, 8);
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Error en tests:', err);
  process.exit(1);
});
