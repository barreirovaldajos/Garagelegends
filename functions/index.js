// ===== CLOUD FUNCTIONS – Garage Legends Multiplayer =====
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
exports.adminForceAllRaces = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');

  const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const divisionsSnap = await db.collection('divisions')
    .where('phase', '==', 'season')
    .get();

  const results = [];
  for (const doc of divisionsSnap.docs) {
    const divKey = doc.id;
    const hasNext = (doc.data().calendar || []).some(r => r.status === 'next');
    if (!hasNext) continue;

    try {
      const result = await raceRunner.runRaceForDivision(db, divKey, { triggeredBy: context.auth.uid });
      results.push({ divKey, status: 'ok', round: result.round });
    } catch (err) {
      results.push({ divKey, status: 'error', error: err.message });
    }
  }

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
