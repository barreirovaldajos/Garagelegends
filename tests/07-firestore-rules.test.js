// ===== TEST 7: Firestore Security Rules =====
// Requisito: firebase emulators:start --only firestore
// Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/07-firestore-rules.test.js
//
// Nota: El SDK de cliente de Firebase JS es el que evalúa las rules.
// Para tests de rules en Node se usa @firebase/rules-unit-testing.
// Instalar: npm install --save-dev @firebase/rules-unit-testing firebase
// Asegurarse de tener firestore.rules en la raíz del proyecto.

'use strict';

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let testEnv;

function assert(desc, condition) {
  if (condition) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}`); failed++; }
}

async function ok(desc, promise) {
  try {
    await assertSucceeds(promise);
    console.log(`  ✅ ${desc}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL (debería PERMITIR): ${desc} — ${e.message || e}`);
    failed++;
  }
}

async function deny(desc, promise) {
  try {
    await assertFails(promise);
    console.log(`  ✅ ${desc} (bloqueado correctamente)`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL (debería DENEGAR): ${desc} — ${e.message || e}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Firestore Security Rules Tests ===\n');

  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error('❌ firestore.rules no encontrado en la raíz del proyecto');
    process.exit(1);
  }

  testEnv = await initializeTestEnvironment({
    projectId: 'garage-legends-demo',
    firestore: {
      rules: fs.readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });

  // Datos de setup: crear división y perfil admin via admin SDK
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('divisions').doc('test_8_1').set({
      division: 8, group: 1, seasonYear: 1, phase: 'season',
      calendar: [], slots: {}, standings: [], nextRaceRound: 1, raceInProgress: false
    });
    await db.collection('divisions').doc('test_8_1')
      .collection('raceResults').doc('1').set({ round: 1, finalGrid: [] });
    await db.collection('profiles').doc('user_A').set({ email: 'a@test.com', role: 'player' });
    await db.collection('profiles').doc('user_B').set({ email: 'b@test.com', role: 'player' });
    await db.collection('profiles').doc('admin_user').set({ email: 'admin@test.com', role: 'admin' });
  });

  // ── 1. Divisions: read permitido para usuarios autenticados
  console.log('1. divisions/ — lectura');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await ok('Usuario autenticado puede leer división', userA.firestore().collection('divisions').doc('test_8_1').get());

    const anon = testEnv.unauthenticatedContext();
    await deny('Anónimo NO puede leer división', anon.firestore().collection('divisions').doc('test_8_1').get());
  }

  // ── 2. Divisions: write denegado para usuarios normales
  console.log('\n2. divisions/ — escritura de cliente');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await deny('Usuario normal NO puede escribir en división',
      userA.firestore().collection('divisions').doc('test_8_1').update({ raceInProgress: true })
    );
  }

  // ── 3. strategies: jugador escribe su propia estrategia
  console.log('\n3. strategies/ — escritura propia');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await ok('user_A puede escribir su propia estrategia',
      userA.firestore().collection('divisions').doc('test_8_1')
        .collection('strategies').doc('user_A').set({
          userId: 'user_A', raceRound: 1, strategy: { tyre: 'medium' }
        })
    );
  }

  // ── 4. strategies: jugador NO puede escribir la estrategia de otro
  console.log('\n4. strategies/ — escritura ajena');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await deny('user_A NO puede escribir estrategia de user_B',
      userA.firestore().collection('divisions').doc('test_8_1')
        .collection('strategies').doc('user_B').set({
          userId: 'user_B', raceRound: 1, strategy: { tyre: 'soft' }
        })
    );
  }

  // ── 5. strategies: jugador puede leer su propia estrategia
  console.log('\n5. strategies/ — lectura propia');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await ok('user_A puede leer su propia estrategia',
      userA.firestore().collection('divisions').doc('test_8_1')
        .collection('strategies').doc('user_A').get()
    );
  }

  // ── 6. strategies: jugador NO puede leer estrategia de otro
  console.log('\n6. strategies/ — lectura ajena');
  {
    const userB = testEnv.authenticatedContext('user_B');
    // Primero escribir estrategia de A via admin
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('divisions').doc('test_8_1')
        .collection('strategies').doc('user_A').set({ userId: 'user_A', raceRound: 1, strategy: {} });
    });
    await deny('user_B NO puede leer estrategia de user_A',
      userB.firestore().collection('divisions').doc('test_8_1')
        .collection('strategies').doc('user_A').get()
    );
  }

  // ── 7. raceResults: lectura permitida para autenticados
  console.log('\n7. raceResults/ — lectura');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await ok('Usuario autenticado puede leer raceResults',
      userA.firestore().collection('divisions').doc('test_8_1')
        .collection('raceResults').doc('1').get()
    );
  }

  // ── 8. raceResults: escritura DENEGADA para clientes
  console.log('\n8. raceResults/ — escritura denegada');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await deny('Usuario NO puede escribir en raceResults',
      userA.firestore().collection('divisions').doc('test_8_1')
        .collection('raceResults').doc('2').set({ round: 2, finalGrid: [] })
    );
  }

  // ── 9. profiles: usuario lee/escribe su propio perfil
  console.log('\n9. profiles/ — acceso propio');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await ok('user_A puede leer su propio perfil',
      userA.firestore().collection('profiles').doc('user_A').get()
    );
    await ok('user_A puede actualizar su propio perfil',
      userA.firestore().collection('profiles').doc('user_A').update({ lastSeen: Date.now() })
    );
  }

  // ── 10. profiles: usuario NO puede leer perfil ajeno
  console.log('\n10. profiles/ — acceso ajeno');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await deny('user_A NO puede leer perfil de user_B',
      userA.firestore().collection('profiles').doc('user_B').get()
    );
  }

  // ── 11. Documentos arbitrarios denegados
  console.log('\n11. Colecciones arbitrarias denegadas');
  {
    const userA = testEnv.authenticatedContext('user_A');
    await deny('No puede leer colección arbitraria',
      userA.firestore().collection('secret_stuff').doc('any').get()
    );
    await deny('No puede escribir en colección arbitraria',
      userA.firestore().collection('secret_stuff').doc('any').set({ data: 'hacked' })
    );
  }

  await testEnv.cleanup();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Error en tests:', err);
  process.exit(1);
});
