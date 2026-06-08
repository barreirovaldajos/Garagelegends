'use strict';
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  console.log(`Total divisiones activas: ${snap.size}`);
  snap.forEach(doc => {
    const d = doc.data();
    const pending = (d.calendar || []).filter(r => r.status === 'next');
    const done = (d.calendar || []).filter(r => r.status === 'done');
    console.log(`${doc.id}: ${done.length} completadas, ${pending.length} pendientes${pending.length ? ' ← BLOQUEADA (ronda ' + pending.map(r=>r.round).join(',') + ')' : ' ✓'}`);
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
