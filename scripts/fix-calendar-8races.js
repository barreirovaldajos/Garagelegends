'use strict';
// Recorta el calendario de todas las divisiones activas a exactamente 8 carreras.
// Las carreras ya completadas se respetan; solo se eliminan rondas futuras sobrantes.
// Uso: node scripts/fix-calendar-8races.js [--dry-run]

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_RACES = 8;

async function fixCalendars() {
  const snap = await db.collection('divisions').where('phase', 'in', ['season', 'offseason']).get();
  if (snap.empty) { console.log('No hay divisiones activas.'); return; }

  let fixed = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const divKey = doc.id;
    const calendar = data.calendar || [];

    if (calendar.length <= MAX_RACES) {
      console.log(`  [OK]  ${divKey}: ${calendar.length} carreras — sin cambios`);
      skipped++;
      continue;
    }

    // Separar completadas y pendientes
    const completed = calendar.filter(r => r.status === 'completed');
    const pending   = calendar.filter(r => r.status !== 'completed');

    if (completed.length >= MAX_RACES) {
      // Ya se corrieron 8+; dejamos solo las primeras 8 completadas, sin pendientes
      const trimmed = completed.slice(0, MAX_RACES);
      console.log(`  [FIX] ${divKey}: ${calendar.length} → ${trimmed.length} (todas completadas, se descarta el resto)`);
      if (!DRY_RUN) await doc.ref.update({ calendar: trimmed });
      fixed++;
      continue;
    }

    // Cuántas pendientes podemos conservar para llegar a 8 en total
    const pendingSlots = MAX_RACES - completed.length;
    const trimmedPending = pending.slice(0, pendingSlots);
    const trimmed = [...completed, ...trimmedPending];

    // Renumerar rondas para que sean continuas 1..8
    trimmed.forEach((r, i) => { r.round = i + 1; });

    // nextRaceRound no debe apuntar a una ronda que ya no existe
    const currentNext = data.nextRaceRound || 1;
    const newNext = Math.min(currentNext, trimmed.length + 1);

    console.log(`  [FIX] ${divKey}: ${calendar.length} carreras → ${trimmed.length} (completadas: ${completed.length}, pendientes eliminadas: ${pending.length - trimmedPending.length})`);

    if (!DRY_RUN) {
      await doc.ref.update({
        calendar: trimmed,
        nextRaceRound: newNext,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    fixed++;
  }

  console.log(`\nResumen: ${fixed} divisiones corregidas, ${skipped} sin cambios.`);
  if (DRY_RUN) console.log('(modo --dry-run: no se escribió nada)');
}

fixCalendars()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
