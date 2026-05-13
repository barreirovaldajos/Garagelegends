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
async function assignPlayerToDivision(db, userId, clientSnapshot) {
  // Build trusted snapshot from server-side save_data before assigning
  const profileSnap = await db.collection('profiles').doc(userId).get();
  if (!profileSnap.exists) throw new Error('Profile not found for userId: ' + userId);
  const trustedSnapshot = _buildSnapshotFromSaveData(profileSnap.data().save_data, clientSnapshot);

  // Try divisions starting from 8 (entry level) upward (7, 6…) as fallback
  const DIVISION_ORDER = [8, 7, 6, 5, 4, 3, 2, 1];

  for (const division of DIVISION_ORDER) {
    const result = await _tryAssignInDivision(db, userId, trustedSnapshot, division);
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

  // Update standings: remove bot entry for this slot AND any existing entry for this player
  const standings = (targetDivData.standings || []).filter(
    s => !(s.slotIndex === targetSlotIndex && !s.isPlayer) && s.teamId !== userId
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

// ─── Server-side validation constants (mirrors race-runner.js) ───────────────
const _BASE_COMPONENT_SCORES = {
  engine: 42, chassis: 38, aero: 35, tyreManage: 40,
  brakes: 45, gearbox: 43, reliability: 55, efficiency: 48
};
const _RND_BOOSTS = {
  acceleration: { component: 'chassis',     boostPerLevel: 2,   maxLevel: 20 },
  power:        { component: 'engine',      boostPerLevel: 2,   maxLevel: 20 },
  reliability:  { component: 'reliability', boostPerLevel: 2.5, maxLevel: 20 },
  weather:      { component: 'aero',        boostPerLevel: 2,   maxLevel: 20 }
};
const _MAX_HQ_LEVEL = 5;
const _MAX_ATTR     = 99;
const _EVENT_BUFFER = 15;

function _sanitizeName(str, maxLen) {
  return String(str || '').replace(/[<>"'&`]/g, '').trim().substring(0, maxLen || 50);
}

function _capHQ(hq) {
  const h = hq || {};
  return {
    admin:       Math.min(Math.max(1, Number(h.admin)       || 1), _MAX_HQ_LEVEL),
    wind_tunnel: Math.min(Math.max(1, Number(h.wind_tunnel) || 1), _MAX_HQ_LEVEL),
    rnd:         Math.min(Math.max(1, Number(h.rnd)         || 1), _MAX_HQ_LEVEL),
    factory:     Math.min(Math.max(1, Number(h.factory)     || 1), _MAX_HQ_LEVEL),
    academy:     Math.min(Math.max(1, Number(h.academy)     || 1), _MAX_HQ_LEVEL)
  };
}

function _capComponents(car) {
  const components = (car && car.components) ? car.components : {};
  const queue      = (car && car.rnd && car.rnd.queue) ? car.rnd.queue : {};
  const result     = {};

  for (const [key, baseScore] of Object.entries(_BASE_COMPONENT_SCORES)) {
    const comp = components[key] || {};
    let maxScore = baseScore + _EVENT_BUFFER;
    for (const [treeId, tree] of Object.entries(_RND_BOOSTS)) {
      if (tree.component === key) {
        const level = Math.min(Math.max(0, Math.floor(Number(queue[treeId]) || 0)), tree.maxLevel);
        maxScore += level * tree.boostPerLevel;
      }
    }
    maxScore = Math.min(_MAX_ATTR, maxScore);
    result[key] = {
      level: Math.max(1, Math.min(50, Math.floor(Number(comp.level) || 1))),
      score: Math.min(maxScore, Math.max(1, Number(comp.score) || baseScore))
    };
  }

  for (const [key, comp] of Object.entries(components)) {
    if (!result[key]) {
      result[key] = {
        level: Math.max(1, Math.min(50, Math.floor(Number(comp.level) || 1))),
        score: Math.min(_MAX_ATTR, Math.max(1, Number(comp.score) || 40))
      };
    }
  }
  return result;
}

function _capPilots(pilots) {
  if (!Array.isArray(pilots)) return [];
  return pilots.map(p => {
    if (!p || typeof p !== 'object') return null;
    const sanitizedAttrs = {};
    const attrs = p.attrs || {};
    for (const [key, val] of Object.entries(attrs)) {
      const n = Number(val);
      sanitizedAttrs[key] = isNaN(n) ? val : Math.min(_MAX_ATTR, Math.max(1, n));
    }
    return { ...p, name: _sanitizeName(p.name, 50), attrs: sanitizedAttrs };
  }).filter(Boolean);
}

/**
 * Build a trusted team snapshot from the player's server-side save_data.
 * Cosmetic fields (name, colors, logo) can optionally come from clientSnapshot,
 * but all competitive values are validated and capped server-side.
 */
function _buildSnapshotFromSaveData(saveData, clientSnapshot) {
  const team = (saveData && saveData.team) || {};
  const car  = (saveData && saveData.car)  || {};

  const sanitizedName = clientSnapshot && typeof clientSnapshot.teamName === 'string'
    ? _sanitizeName(clientSnapshot.teamName, 40)
    : _sanitizeName(team.name || 'Team', 40);

  const sanitizedColors = clientSnapshot && clientSnapshot.colors
    ? {
        primary:   typeof clientSnapshot.colors.primary   === 'string' ? clientSnapshot.colors.primary.substring(0, 20)   : (team.colors && team.colors.primary)   || '#888888',
        secondary: typeof clientSnapshot.colors.secondary === 'string' ? clientSnapshot.colors.secondary.substring(0, 20) : (team.colors && team.colors.secondary) || '#0a0b0f'
      }
    : { primary: (team.colors && team.colors.primary) || '#888888', secondary: (team.colors && team.colors.secondary) || '#0a0b0f' };

  const sanitizedLogo = clientSnapshot && typeof clientSnapshot.logo === 'string'
    ? clientSnapshot.logo.substring(0, 200)
    : (team.logo || '');

  return {
    teamName:       sanitizedName,
    colors:         sanitizedColors,
    logo:           sanitizedLogo,
    pilots:         _capPilots(saveData && saveData.pilots),
    car:            { components: _capComponents(car) },
    staff:          (saveData && Array.isArray(saveData.staff)) ? saveData.staff : [],
    hq:             _capHQ(saveData && saveData.hq),
    engineSupplier: (team.engineSupplier) || '',
    fans:           Math.max(0, Number(team.fans || 1000))
  };
}

/**
 * Update a player's team snapshot in their division slot.
 * Game mechanics data is rebuilt from the player's authoritative save_data —
 * the client-provided snapshot is only used for cosmetic fields (name, colors, logo).
 */
async function updateTeamSnapshot(db, userId, teamSnapshot) {
  const profileSnap = await db.collection('profiles').doc(userId).get();
  if (!profileSnap.exists) throw new Error('Profile not found');
  const profileData = profileSnap.data();
  const mp = profileData.mp;
  if (!mp || !mp.divKey) throw new Error('Player not assigned to a division');

  // Build snapshot from server-side save_data, not from client input
  const trustedSnapshot = _buildSnapshotFromSaveData(profileData.save_data, teamSnapshot);

  const divRef = db.collection('divisions').doc(mp.divKey);
  await divRef.update({
    [`slots.${mp.slotIndex}.teamSnapshot`]: trustedSnapshot
  });

  // Also update standings name/color
  const divSnap = await divRef.get();
  if (divSnap.exists) {
    const standings = divSnap.data().standings || [];
    const entry = standings.find(s => s.teamId === userId);
    if (entry) {
      entry.teamName = trustedSnapshot.teamName || entry.teamName;
      entry.color = (trustedSnapshot.colors && trustedSnapshot.colors.primary) || entry.color;
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
