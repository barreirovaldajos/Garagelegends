// ===== DIVISION-MANAGER.JS – Division assignment and slot management =====
'use strict';

const sharedData = require('./shared/data-constants.js');
const engineCore = require('./shared/engine-core.js');
const botFiller = require('./bot-filler.js');

const MAX_TEAMS_PER_DIVISION = 10;

/**
 * Assign a new player to a division group using social-packing logic:
 *  1. Find the group with the most real players that still has a bot to replace.
 *  2. If all groups are full of real players, create a new group in the same division.
 *  3. If the division has hit its max-groups limit, fall through to the next division tier.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @param {object} teamSnapshot - Player's team data for simulation
 * @returns {{ divKey, division, group, slotIndex }}
 */
async function assignPlayerToDivision(db, userId, teamSnapshot) {
  // Try divisions starting from 8 (entry level) upward (7, 6…) as fallback
  const DIVISION_ORDER = [8, 7, 6, 5, 4, 3, 2, 1];

  for (const division of DIVISION_ORDER) {
    const result = await _tryAssignInDivision(db, userId, teamSnapshot, division);
    if (result) return result;
  }

  throw new Error('No available division found for new player.');
}

/**
 * Try to assign a player in a specific division.
 * Returns the assignment result or null if the division is completely full of real players.
 */
async function _tryAssignInDivision(db, userId, teamSnapshot, division) {
  const divCatalog = sharedData.DIVISIONS.find(d => d.div === division);
  const maxGroups = divCatalog ? divCatalog.parallelDivisions : 16;

  const divisionsSnap = await db.collection('divisions')
    .where('division', '==', division)
    .where('phase', '==', 'season')
    .get();

  // Build candidate list: groups that still have at least one bot slot to replace.
  // Sort by real-player count descending to pack players together.
  const candidates = [];
  let maxExistingGroup = 0;

  divisionsSnap.forEach(doc => {
    const data = doc.data();
    const slots = data.slots || {};
    const group = data.group || 1;
    if (group > maxExistingGroup) maxExistingGroup = group;

    let botSlotIndex = null;
    let realCount = 0;
    for (let i = 0; i < MAX_TEAMS_PER_DIVISION; i++) {
      const slot = slots[String(i)];
      if (slot && slot.type === 'player') realCount++;
      if (slot && slot.type === 'bot' && botSlotIndex === null) botSlotIndex = i;
    }

    if (botSlotIndex !== null) {
      candidates.push({ docId: doc.id, data, realCount, botSlotIndex });
    }
  });

  candidates.sort((a, b) => b.realCount - a.realCount);

  let targetDivKey, targetGroup, targetSlotIndex, targetDivData;

  if (candidates.length > 0) {
    // Case 1: place in the group with the most real players (replace a bot)
    const best = candidates[0];
    targetDivKey = best.docId;
    targetGroup = best.data.group;
    targetSlotIndex = best.botSlotIndex;
    targetDivData = best.data;
  } else {
    // Case 2: all existing groups are full of real players — create a new group
    const nextGroup = maxExistingGroup + 1;
    if (nextGroup > maxGroups) {
      // Case 3: division is at its group limit — signal to try next division
      return null;
    }
    targetGroup = nextGroup;
    targetDivKey = `${division}_${targetGroup}`;
    targetSlotIndex = 0;
    targetDivData = await _createDivisionGroup(db, division, targetGroup, targetDivKey);
  }

  const divRef = db.collection('divisions').doc(targetDivKey);

  // Write player slot (overwrites bot if replacing one)
  await divRef.update({
    [`slots.${targetSlotIndex}`]: {
      type: 'player',
      userId: userId,
      teamSnapshot: teamSnapshot,
      joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    }
  });

  // Update standings: remove bot entry for this slot, add player
  const standings = (targetDivData.standings || []).filter(
    s => !(s.slotIndex === targetSlotIndex && !s.isPlayer)
  );
  standings.push({
    slotIndex: targetSlotIndex,
    teamId: userId,
    teamName: teamSnapshot.teamName || 'New Team',
    color: (teamSnapshot.colors && teamSnapshot.colors.primary) || '#888',
    points: 0,
    wins: 0,
    podiums: 0,
    position: standings.length + 1,
    bestResult: 0,
    isPlayer: true
  });
  await divRef.update({ standings });

  // Update player profile with MP data
  await db.collection('profiles').doc(userId).update({
    mp: {
      division,
      divisionGroup: targetGroup,
      divKey: targetDivKey,
      slotIndex: targetSlotIndex,
      status: 'active',
      joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      lastActiveAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      seasonYear: targetDivData.seasonYear || 1
    }
  });

  // Fill any remaining empty slots with bots (only relevant for newly created groups)
  await botFiller.fillDivisionBots(db, targetDivKey, division);

  return { divKey: targetDivKey, division, group: targetGroup, slotIndex: targetSlotIndex };
}

/**
 * Create a new division group document with calendar and bots.
 */
async function _createDivisionGroup(db, division, group, divKey) {
  const calendarSeed = `cal_${divKey}_${Date.now()}`;
  const rng = new engineCore.SeededRNG(calendarSeed);
  const calendar = engineCore.generateCalendar(division, sharedData.CIRCUITS, rng);

  const divData = {
    division: division,
    group: group,
    seasonYear: 1,
    phase: 'season',
    calendar: calendar,
    slots: {},
    standings: [],
    nextRaceRound: 1,
    raceInProgress: false,
    createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
  };

  await db.collection('divisions').doc(divKey).set(divData);
  return divData;
}

/**
 * Update a player's team snapshot in their division slot.
 */
async function updateTeamSnapshot(db, userId, teamSnapshot) {
  const profileSnap = await db.collection('profiles').doc(userId).get();
  if (!profileSnap.exists) throw new Error('Profile not found');
  const mp = profileSnap.data().mp;
  if (!mp || !mp.divKey) throw new Error('Player not assigned to a division');

  const divRef = db.collection('divisions').doc(mp.divKey);
  await divRef.update({
    [`slots.${mp.slotIndex}.teamSnapshot`]: teamSnapshot
  });

  // Also update standings name/color
  const divSnap = await divRef.get();
  if (divSnap.exists) {
    const standings = divSnap.data().standings || [];
    const entry = standings.find(s => s.teamId === userId);
    if (entry) {
      entry.teamName = teamSnapshot.teamName || entry.teamName;
      entry.color = (teamSnapshot.colors && teamSnapshot.colors.primary) || entry.color;
      await divRef.update({ standings: standings });
    }
  }
}

module.exports = {
  assignPlayerToDivision,
  updateTeamSnapshot,
  createDivisionGroup: _createDivisionGroup,
  MAX_TEAMS_PER_DIVISION
};
