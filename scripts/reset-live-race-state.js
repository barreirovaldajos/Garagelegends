'use strict';
// Resetea liveRaceState en todas las divisiones que lo tengan en status 'live'
// Uso: node scripts/reset-live-race-state.js

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('divisions').get();
  const toReset = [];

  snap.forEach(doc => {
    const d = doc.data();
    const lrs = d.liveRaceState;
    if (lrs && lrs.status === 'live') {
      toReset.push({ id: doc.id, lrs });
    }
  });

  if (!toReset.length) {
    console.log('No hay divisiones con liveRaceState en "live". Nada que resetear.');
    return;
  }

  for (const { id, lrs } of toReset) {
    const startMs = lrs.startTime
      ? (lrs.startTime.toMillis ? lrs.startTime.toMillis() : Number(lrs.startTime))
      : 0;
    const agoMin = startMs ? Math.round((Date.now() - startMs) / 60000) : '?';
    console.log(`Reseteando ${id} (ronda ${lrs.round || '?'}, hace ${agoMin} min)...`);
    await db.collection('divisions').doc(id).update({
      liveRaceState: { status: 'waiting', round: null, startTime: null }
    });
    console.log(`  ✓ ${id} reseteado.`);
  }

  console.log(`\nDone. ${toReset.length} división(es) reseteada(s).`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
