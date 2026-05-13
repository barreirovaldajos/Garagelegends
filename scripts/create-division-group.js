'use strict';
// Script de recuperación: crea un grupo de división directamente en Firestore
// Uso: node scripts/create-division-group.js <division> <group>
// Ejemplo: node scripts/create-division-group.js 8 1

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Cargar shared desde functions/shared (rutas correctas para el deploy)
const engineCore = require('../functions/shared/engine-core.js');
const sharedData = require('../functions/shared/data-constants.js');
const botFiller = require('../functions/lib/bot-filler.js');

async function createGroup(division, group) {
  const divKey = `${division}_${group}`;
  console.log(`Creando grupo ${divKey}...`);

  const calendarSeed = `cal_${divKey}_${Date.now()}`;
  const rng = new engineCore.SeededRNG(calendarSeed);
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
  console.log(`Documento ${divKey} creado. Llenando bots...`);

  await botFiller.fillDivisionBots(db, divKey, division);
  console.log(`Grupo ${divKey} listo con bots.`);
}

const division = parseInt(process.argv[2], 10);
const group = parseInt(process.argv[3], 10);

if (isNaN(division) || isNaN(group)) {
  console.error('Uso: node scripts/create-division-group.js <division> <group>');
  console.error('Ejemplo: node scripts/create-division-group.js 8 1');
  process.exit(1);
}

createGroup(division, group)
  .then(() => { console.log('Hecho.'); process.exit(0); })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
