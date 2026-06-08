'use strict';
// Fuerza la carrera pendiente en las divisiones bloqueadas
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const raceRunner = require('../functions/lib/race-runner.js');

const DIVS = ['7_11', '7_6'];

async function run() {
  for (const divKey of DIVS) {
    console.log(`\nForzando carrera para ${divKey}...`);
    try {
      const result = await raceRunner.runRaceForDivision(db, divKey, { triggeredBy: 'admin-script' });
      const top = (result.finalGrid || []).slice(0, 3).map((c, i) => `P${i+1}: ${c.name}`).join(', ');
      console.log(`  ✓ Ronda ${result.round} completada. ${top}`);
    } catch (e) {
      console.error(`  ✗ Error en ${divKey}: ${e.message}`);
    }
  }
  console.log('\nVerificando estado final...');
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  let blocked = 0;
  snap.forEach(doc => {
    const pending = (doc.data().calendar || []).filter(r => r.status === 'next');
    if (pending.length) { console.log(`  BLOQUEADA: ${doc.id} (ronda ${pending.map(r=>r.round).join(',')})`); blocked++; }
  });
  if (!blocked) console.log('  ✓ Todas las divisiones completadas. Puedes avanzar la temporada.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
