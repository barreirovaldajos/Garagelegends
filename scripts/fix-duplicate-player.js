'use strict';
// Elimina la entrada duplicada de un jugador en standings y libera el slot extra.
// Mantiene el slot de menor índice (primera asignación).
// Uso: node scripts/fix-duplicate-player.js <divKey> <userId>
// Ejemplo: node scripts/fix-duplicate-player.js 8_1 i6Zrq2LHlzS1sRyoUSg96oAKV3D3

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const botFiller = require('../functions/lib/bot-filler.js');

async function run() {
  const divKey = process.argv[2];
  const userId = process.argv[3];
  if (!divKey || !userId) {
    console.error('Uso: node scripts/fix-duplicate-player.js <divKey> <userId>');
    process.exit(1);
  }

  const divRef = db.collection('divisions').doc(divKey);
  const snap = await divRef.get();
  if (!snap.exists) { console.error(`No existe: ${divKey}`); process.exit(1); }

  const data = snap.data();
  const slots = data.slots || {};
  const standings = data.standings || [];

  // Encontrar todas las entradas del jugador en standings
  const playerEntries = standings
    .map((s, i) => ({ ...s, _i: i }))
    .filter(s => s.teamId === userId);

  if (playerEntries.length <= 1) {
    console.log('Sin duplicados para ese userId.');
    process.exit(0);
  }

  // Mantener la entrada con menor slotIndex (primera asignación)
  playerEntries.sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99));
  const keep = playerEntries[0];
  const remove = playerEntries.slice(1);

  console.log(`Manteniendo: standings[${keep._i}] slotIndex=${keep.slotIndex} pos=${keep.position}`);
  remove.forEach(r => console.log(`Eliminando:  standings[${r._i}] slotIndex=${r.slotIndex} pos=${r.position}`));

  // Filtrar standings — quitar duplicados
  const removeIndices = new Set(remove.map(r => r._i));
  const newStandings = standings.filter((_, i) => !removeIndices.has(i));

  // Recalcular posiciones
  newStandings.sort((a, b) => (a.position || 99) - (b.position || 99));
  newStandings.forEach((s, i) => { s.position = i + 1; });

  // Liberar los slots extra del jugador
  const updates = { standings: newStandings };
  for (const r of remove) {
    if (r.slotIndex != null) {
      updates[`slots.${r.slotIndex}`] = admin.firestore.FieldValue.delete();
      console.log(`Liberando slot ${r.slotIndex}`);
    }
  }

  await divRef.update(updates);
  console.log('\nStandings actualizados. Rellenando slot vacío con bot...');

  await botFiller.fillDivisionBots(db, divKey, data.division || 8);
  console.log('Listo.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
