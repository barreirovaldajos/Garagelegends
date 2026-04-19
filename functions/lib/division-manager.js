// ===== DIVISION-MANAGER.JS – Division assignment and slot management =====
'use strict';

const sharedData = require('../../shared/data-constants.js');
const engineCore = require('../../shared/engine-core.js');
const botFiller = require('./bot-filler.js');

const MAX_TEAMS_PER_DIVISION = 10;

/**
 * Assign a new player to a division group.
 * Finds an open slot in the lowest division (8), or creates a new group.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @param {object} teamSnapshot - Player's team data for simulation
 * @returns {{ divKey, division, group, slotIndex }}
 */
async function assignPlayerToDivision(db, userId, teamSnapshot) {
  const division = 8; // New players always start at div 8
  const divCatalog = sharedData.DIVISIONS.find(d => d.div === division);
  const maxGroups = divCatalog ? divCatalog.parallelDivisions : 16;

  // Find an existing group with an open slot
  const divisionsSnap = await db.collection('divisions')
    .where('division', '==', division)
    .where('phase', '==', 'season')
    .get();

  let targetDivKey = null;
  let targetGroup = null;
  let targetSlotIndex = null;
  let targetDivData = null;

  divisionsSnap.forEach(doc => {
    if (targetDivKey) return; // Already found one
    const data = doc.data();
    const slots = data.slots || {};
    const occupiedCount = Object.keys(slots).length;
    if (occupiedCount < MAX_TEAMS_PER_DIVISION) {
      // Find first open slot index
      for (let i = 0; i < MAX_TEAMS_PER_DIVISION; i++) {
        if (!slots[String(i)]) {
          targetDivKey = doc.id;
          targetGroup = data.group;
          targetSlotIndex = i;
          targetDivData = data;
          return;
        }
      }
    }
  });

  // If no open slot found, create a new group
  if (!targetDivKey) {
    // Find the highest existing group number for this division
    let maxGroup = 0;
    divisionsSnap.forEach(doc => {
      const g = doc.data().group || 0;
      if (g > maxGroup) maxGroup = g;
    });
    targetGroup = maxGroup + 1;
    if (targetGroup > maxGroups) {
      throw new Error(`Division ${division} has reached maximum groups (${maxGroups})`);
    }
    targetDivKey = `${division}_${targetGroup}`;
    targetSlotIndex = 0;

    // Create the new division group
    targetDivData = await _createDivisionGroup(db, division, targetGroup, targetDivKey);
  }

  // Write player slot
  const slotData = {
    type: 'player',
    userId: userId,
    teamSnapshot: teamSnapshot,
    joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
  };

  const divRef = db.collection('divisions').doc(targetDivKey);
  await divRef.update({
    [`slots.${targetSlotIndex}`]: slotData
  });

  // Add player to standings
  const standings = targetDivData.standings || [];
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
  await divRef.update({ standings: standings });

  // Update player profile with MP data
  const profileRef = db.collection('profiles').doc(userId);
  await profileRef.update({
    mp: {
      division: division,
      divisionGroup: targetGroup,
      divKey: targetDivKey,
      slotIndex: targetSlotIndex,
      status: 'active',
      joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      lastActiveAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      seasonYear: targetDivData.seasonYear || 1
    }
  });

  // If this was a new group, replace the bot in slot 0 with the player
  // (bot was placed at slot 0 during creation, now player takes it)
  // Actually we already placed player at targetSlotIndex, so just ensure bots fill the rest
  await botFiller.fillDivisionBots(db, targetDivKey, division);

  return {
    divKey: targetDivKey,
    division: division,
    group: targetGroup,
    slotIndex: targetSlotIndex
  };
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
  MAX_TEAMS_PER_DIVISION
};
