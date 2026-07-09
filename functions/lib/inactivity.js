'use strict';

// Marks players as inactive when they submitted no strategy for the last 2 races.
// Extracted from the weeklyEconomy scheduled function so it can be unit-tested with
// a mock Firestore (no firebase-admin dependency at load time — `db` is injected).
//
// `db` must expose the subset of the Firestore API used here:
//   db.collection('divisions').where(...).get()  -> { docs: [{ id, data(), ref }] }
//   doc.ref.collection('strategies').where(...).where(...).get() -> { empty }
//   db.collection('profiles').doc(userId)         -> DocumentReference
//   db.batch() -> { update(ref, obj), commit() }
//
// Returns the number of players marked inactive.
async function markInactivePlayers(db, logger) {
  const divisionsSnap = await db.collection('divisions')
    .where('phase', '==', 'season')
    .get();

  // Gather every (division, player) strategy check we need to run.
  const checks = [];
  for (const doc of divisionsSnap.docs) {
    const data = doc.data();
    const lastRound = data.lastRaceRound || 0;
    if (lastRound < 2) continue; // Need at least 2 races to judge inactivity

    const slots = data.slots || {};
    for (const slot of Object.values(slots)) {
      if (slot.type !== 'player' || !slot.userId) continue;
      checks.push({ doc, divId: doc.id, userId: slot.userId, lastRound });
    }
  }

  // Run the strategy lookups in parallel, in bounded batches so we don't open
  // hundreds of simultaneous reads (was a serial N+1: one query per player).
  const READ_BATCH = 50;
  const inactive = [];
  for (let i = 0; i < checks.length; i += READ_BATCH) {
    const slice = checks.slice(i, i + READ_BATCH);
    const results = await Promise.all(slice.map(async (c) => {
      const recentStrategies = await c.doc.ref.collection('strategies')
        .where('userId', '==', c.userId)
        .where('raceRound', '>=', c.lastRound - 1)
        .get();
      return recentStrategies.empty ? c : null;
    }));
    for (const r of results) if (r) inactive.push(r);
  }

  // Write the "inactive" flags in Firestore batches (batch limit: 500 writes).
  for (let i = 0; i < inactive.length; i += 500) {
    const batch = db.batch();
    for (const c of inactive.slice(i, i + 500)) {
      batch.update(db.collection('profiles').doc(c.userId), { 'mp.status': 'inactive' });
    }
    await batch.commit();
  }

  if (logger) inactive.forEach(c => logger.info(`Marked ${c.userId} as inactive in ${c.divId}`));
  return inactive.length;
}

module.exports = { markInactivePlayers };
