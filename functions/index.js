// ===== CLOUD FUNCTIONS – Garage Legends Multiplayer (v2) =====
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const raceRunner = require('./lib/race-runner.js');
const divisionManager = require('./lib/division-manager.js');
const seasonManager = require('./lib/season-manager.js');

// ── 1. Scheduled Race – Runs every Sunday at 18:00 UTC ──────────────────────
exports.runScheduledRace = functions.pubsub
  .schedule('every sunday 18:00')
  .timeZone('UTC')
  .onRun(async (_context) => {
    const divisionsSnap = await db.collection('divisions')
      .where('phase', '==', 'season')
      .get();

    const results = [];
    for (const doc of divisionsSnap.docs) {
      const divKey = doc.id;
      const data = doc.data();
      // Skip if no pending race
      const hasNext = (data.calendar || []).some(r => r.status === 'next');
      if (!hasNext) continue;

      try {
        const result = await raceRunner.runRaceForDivision(db, divKey, { triggeredBy: 'scheduled' });
        results.push({ divKey, status: 'ok', round: result.round });
        functions.logger.info(`Race completed: ${divKey} round ${result.round}`);
      } catch (err) {
        results.push({ divKey, status: 'error', error: err.message });
        functions.logger.error(`Race failed for ${divKey}:`, err);
      }
    }

    functions.logger.info(`Scheduled race run complete. ${results.length} divisions processed.`);
    return null;
  });

// ── 2. Admin Force Race – Callable by admin ─────────────────────────────────
exports.adminForceRace = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const divKey = data.divKey;
  if (!divKey) throw new functions.https.HttpsError('invalid-argument', 'divKey required');

  const result = await raceRunner.runRaceForDivision(db, divKey, { triggeredBy: context.auth.uid });
  return result;
});

// ── 3. Admin Force All Races – Run races for all active divisions ───────────
exports.adminForceAllRaces = functions.runWith({ timeoutSeconds: 300, memory: '512MB' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const roundFilter = (data && data.roundFilter) ? Number(data.roundFilter) : null;

  const divisionsSnap = await db.collection('divisions')
    .where('phase', '==', 'season')
    .get();

  const tasks = divisionsSnap.docs
    .filter(doc => {
      const d = doc.data();
      const hasNext = (d.calendar || []).some(r => r.status === 'next');
      if (!hasNext) return false;
      if (roundFilter !== null) {
        // lastRaceRound is only written when the full race transaction completes,
        // so it's the reliable signal — calendar status can be stale after a timeout.
        const lastRound = d.lastRaceRound || 0;
        if (lastRound >= roundFilter) return false;
      }
      return true;
    })
    .map(doc => raceRunner.runRaceForDivision(db, doc.id, { triggeredBy: context.auth.uid })
      .then(result => ({ divKey: doc.id, status: 'ok', round: result.round }))
      .catch(err   => ({ divKey: doc.id, status: 'error', error: err.message }))
    );
  const results = await Promise.all(tasks);

  return { processed: results.length, results };
});

// ── 4. Assign Division – Called after onboarding ─────────────────────────────
exports.assignDivision = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const teamSnapshot = data.teamSnapshot;
  if (!teamSnapshot) throw new functions.https.HttpsError('invalid-argument', 'teamSnapshot required');

  const result = await divisionManager.assignPlayerToDivision(db, context.auth.uid, teamSnapshot);
  return result;
});

// ── 5. Update Team Snapshot – Called when player modifies team ────────────────
exports.updateTeamSnapshot = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const teamSnapshot = data.teamSnapshot;
  if (!teamSnapshot) throw new functions.https.HttpsError('invalid-argument', 'teamSnapshot required');

  await divisionManager.updateTeamSnapshot(db, context.auth.uid, teamSnapshot);
  return { success: true };
});

// ── 6. Strategy Submit Trigger – Validates and updates activity ──────────────
exports.onStrategySubmit = functions.firestore
  .document('divisions/{divKey}/strategies/{userId}')
  .onWrite(async (change, context) => {
    const { divKey, userId } = context.params;

    // On delete, nothing to do
    if (!change.after.exists) return null;

    const strategyData = change.after.data();

    // Validate required fields
    if (!strategyData.strategy) {
      functions.logger.warn(`Invalid strategy from ${userId} in ${divKey}: missing strategy object`);
      return null;
    }

    // Update player's lastActiveAt
    const profileRef = db.collection('profiles').doc(userId);
    await profileRef.update({
      'mp.lastActiveAt': admin.firestore.FieldValue.serverTimestamp()
    });

    functions.logger.info(`Strategy submitted by ${userId} for ${divKey}, round ${strategyData.raceRound}`);
    return null;
  });

// ── 7. Weekly Economy – Monday 00:00 UTC ─────────────────────────────────────
exports.weeklyEconomy = functions.pubsub
  .schedule('every monday 00:00')
  .timeZone('UTC')
  .onRun(async (_context) => {
    // Mark inactive players (no strategy submitted for 2+ consecutive races)
    const divisionsSnap = await db.collection('divisions')
      .where('phase', '==', 'season')
      .get();

    let inactiveCount = 0;

    for (const doc of divisionsSnap.docs) {
      const data = doc.data();
      const slots = data.slots || {};
      const lastRound = data.lastRaceRound || 0;

      if (lastRound < 2) continue; // Need at least 2 races to judge inactivity

      for (const [slotIdx, slot] of Object.entries(slots)) {
        if (slot.type !== 'player' || !slot.userId) continue;

        // Check if player submitted strategies for recent rounds
        const recentStrategies = await doc.ref.collection('strategies')
          .where('userId', '==', slot.userId)
          .where('raceRound', '>=', lastRound - 1)
          .get();

        if (recentStrategies.empty) {
          // Mark as inactive
          const profileRef = db.collection('profiles').doc(slot.userId);
          await profileRef.update({ 'mp.status': 'inactive' });
          inactiveCount++;
          functions.logger.info(`Marked ${slot.userId} as inactive in ${doc.id}`);
        }
      }
    }

    functions.logger.info(`Weekly economy: ${inactiveCount} players marked inactive`);
    return null;
  });

// ── 8. Admin Start New Season ────────────────────────────────────────────────
exports.adminStartNewSeason = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  await seasonManager.startNewSeason(db);
  return { success: true, message: 'New season started for all divisions' };
});

// ── 9. Admin Fill Bots – Fill empty slots in a division with AI teams ─────────
exports.adminFillBots = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { divKey } = data;
  if (!divKey) throw new functions.https.HttpsError('invalid-argument', 'divKey is required');

  const divSnap = await db.collection('divisions').doc(divKey).get();
  if (!divSnap.exists) throw new functions.https.HttpsError('not-found', `Division ${divKey} not found`);

  const botFiller = require('./lib/bot-filler.js');
  const division = divSnap.data().division;
  await botFiller.fillDivisionBots(db, divKey, division);

  return { success: true, divKey };
});

// ── 10. Admin Reset Group – Clears players, deletes and recreates the division ─
exports.adminResetGroup = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { divKey } = data;
  if (!divKey) throw new functions.https.HttpsError('invalid-argument', 'divKey is required');

  const parts = divKey.split('_');
  const division = parseInt(parts[0], 10);
  const group = parseInt(parts[1], 10);
  if (isNaN(division) || isNaN(group)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid divKey format: ${divKey}`);
  }

  const divRef = db.collection('divisions').doc(divKey);
  const divSnap = await divRef.get();

  // Collect all real players in this group and clear their mp
  const affectedPlayers = [];
  if (divSnap.exists) {
    const slots = divSnap.data().slots || {};
    for (const slot of Object.values(slots)) {
      if (slot && slot.type === 'player' && slot.userId) {
        affectedPlayers.push(slot.userId);
      }
    }
  }

  // Clear mp for affected players in batches (Firestore batch limit: 500)
  for (let i = 0; i < affectedPlayers.length; i += 500) {
    const batch = db.batch();
    for (const userId of affectedPlayers.slice(i, i + 500)) {
      batch.update(db.collection('profiles').doc(userId), {
        mp: admin.firestore.FieldValue.delete()
      });
    }
    await batch.commit();
  }

  // Delete old document
  if (divSnap.exists) await divRef.delete();

  // Recreate fresh with calendar and bots
  await divisionManager.createDivisionGroup(db, division, group, divKey);
  const botFiller = require('./lib/bot-filler.js');
  await botFiller.fillDivisionBots(db, divKey, division);

  functions.logger.info(`adminResetGroup: ${divKey} reset. Players cleared: ${affectedPlayers.join(', ')}`);
  return { success: true, divKey, affectedPlayers };
});

// ── 11. Admin Force Season Advance – End stuck seasons, then start new ───────
// Timeout extendido: procesar 52 divisiones puede tomar varios minutos.
exports.adminForceSeasonAdvance = functions.runWith({ timeoutSeconds: 300 }).https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  // Guard: bloquear si quedan carreras pendientes en CUALQUIER división activa.
  // El avance de temporada solo se permite cuando todas las carreras están completadas.
  const activeSnap = await db.collection('divisions').where('phase', '==', 'season').get();
  const pendingRaceDivs = [];
  const finishedDivs = [];

  activeSnap.forEach(doc => {
    const hasNext = (doc.data().calendar || []).some(r => r.status === 'next');
    if (hasNext) pendingRaceDivs.push(doc.id);
    else finishedDivs.push(doc.id);
  });

  if (pendingRaceDivs.length > 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `No se puede avanzar la temporada: ${pendingRaceDivs.length} división(es) aún tienen carreras pendientes. ` +
      `Usa "Forzar carrera en todas las divisiones" hasta que todas estén completas.`
    );
  }

  // Paso 1: cerrar divisiones en 'season' que ya terminaron (no tienen 'next')
  const endedDivs = [];
  for (const divId of finishedDivs) {
    try {
      await seasonManager.endDivisionSeason(db, divId);
      endedDivs.push(divId);
      functions.logger.info(`adminForceSeasonAdvance: ended season for ${divId}`);
    } catch (err) {
      functions.logger.error(`adminForceSeasonAdvance: failed to end ${divId}:`, err);
    }
  }

  // Paso 2: iniciar nueva temporada para todas las divisiones en 'offseason'
  await seasonManager.startNewSeason(db);

  functions.logger.info(`adminForceSeasonAdvance done. Ended: ${endedDivs.length}`);
  return {
    success: true,
    endedDivisions: endedDivs,
    message: `Temporada avanzada. ${endedDivs.length} división(es) cerradas. Nueva temporada iniciada.`
  };
});
