'use strict';
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const divKey = process.argv[2] || '8_A';
  const snap = await db.collection('divisions').doc(divKey).get();
  if (!snap.exists) { console.error(`No existe la división: ${divKey}`); process.exit(1); }

  const standings = snap.data().standings || [];
  console.log(`\nDivisión ${divKey} — ${standings.length} entradas en standings:\n`);

  const seen = {};
  standings.forEach((s, i) => {
    const key = s.teamId || '(sin teamId)';
    if (!seen[key]) seen[key] = [];
    seen[key].push({ index: i, teamName: s.teamName, slotIndex: s.slotIndex, isPlayer: s.isPlayer, position: s.position });
  });

  let hasDups = false;
  for (const [teamId, entries] of Object.entries(seen)) {
    if (entries.length > 1) {
      hasDups = true;
      console.log(`DUPLICADO — teamId: ${teamId}`);
      entries.forEach(e => console.log(`  [standings[${e.index}]] teamName="${e.teamName}" slotIndex=${e.slotIndex} isPlayer=${e.isPlayer} position=${e.position}`));
      console.log();
    }
  }

  if (!hasDups) {
    console.log('Sin duplicados encontrados.');
    console.log('\nTodos los equipos:');
    standings.forEach(s => console.log(`  pos=${s.position} teamId=${s.teamId} teamName="${s.teamName}" isPlayer=${s.isPlayer}`));
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
