'use strict';
// Crea todas las divisiones y grupos (52 en total) con bots.
// Omite grupos que ya existen (preserva datos de jugadores reales).
// Uso: node scripts/create-all-divisions.js [--force]
//   --force : sobreescribe grupos existentes (usar con cuidado)

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const engineCore = require('../functions/shared/engine-core.js');
const sharedData = require('../functions/shared/data-constants.js');
const botFiller  = require('../functions/lib/bot-filler.js');

const FORCE = process.argv.includes('--force');

// Estructura completa: div → cantidad de grupos paralelos
const DIVISION_STRUCTURE = [
  { div: 8, parallelDivisions: 16 },
  { div: 7, parallelDivisions: 12 },
  { div: 6, parallelDivisions:  8 },
  { div: 5, parallelDivisions:  6 },
  { div: 4, parallelDivisions:  4 },
  { div: 3, parallelDivisions:  3 },
  { div: 2, parallelDivisions:  2 },
  { div: 1, parallelDivisions:  1 },
];

const TOTAL_GROUPS = DIVISION_STRUCTURE.reduce((s, d) => s + d.parallelDivisions, 0);

async function createGroup(division, group) {
  const divKey = `${division}_${group}`;

  // Check if already exists
  const existing = await db.collection('divisions').doc(divKey).get();
  if (existing.exists && !FORCE) {
    console.log(`  ↳ ${divKey} ya existe — omitido (usa --force para sobreescribir)`);
    return { divKey, skipped: true };
  }

  const calendarSeed = `cal_${divKey}_s1`;
  const rng      = new engineCore.SeededRNG(calendarSeed);
  const calendar = engineCore.generateCalendar(division, sharedData.CIRCUITS, rng);

  const divData = {
    division,
    group,
    seasonYear: 1,
    phase: 'season',
    calendar,
    slots: {},
    standings: [],
    nextRaceRound: 1,
    raceInProgress: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('divisions').doc(divKey).set(divData);
  await botFiller.fillDivisionBots(db, divKey, division);
  return { divKey, skipped: false };
}

async function main() {
  console.log(`\n=== Creando todas las divisiones (${TOTAL_GROUPS} grupos) ===\n`);
  if (FORCE) console.log('⚠️  Modo --force activado: se sobreescriben grupos existentes\n');

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const { div, parallelDivisions } of DIVISION_STRUCTURE) {
    console.log(`División ${div} (${parallelDivisions} grupos):`);
    for (let group = 1; group <= parallelDivisions; group++) {
      try {
        const result = await createGroup(div, group);
        if (result.skipped) {
          skipped++;
        } else {
          console.log(`  ✓ ${result.divKey} creado con bots`);
          created++;
        }
      } catch (err) {
        console.error(`  ✗ ${div}_${group} ERROR: ${err.message}`);
        errors++;
      }
    }
    console.log('');
  }

  console.log('=== Resumen ===');
  console.log(`  Creados : ${created}`);
  console.log(`  Omitidos: ${skipped}`);
  console.log(`  Errores : ${errors}`);
  console.log(`  Total   : ${TOTAL_GROUPS}\n`);

  if (errors > 0) process.exit(1);
}

main()
  .then(() => { console.log('Hecho.'); process.exit(0); })
  .catch(e => { console.error('Error fatal:', e); process.exit(1); });
