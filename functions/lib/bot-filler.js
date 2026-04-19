// ===== BOT-FILLER.JS – Fill empty division slots with AI teams =====
'use strict';

const sharedData = require('../../shared/data-constants.js');
const engineCore = require('../../shared/engine-core.js');

const MAX_TEAMS = 10;

// Division-scaled car score ranges
const DIVISION_CAR_RANGE = {
  8: [38, 55],
  7: [42, 60],
  6: [48, 65],
  5: [52, 70],
  4: [56, 75],
  3: [62, 80],
  2: [68, 85],
  1: [72, 92]
};

/**
 * Fill empty slots in a division group with bot teams.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} divKey
 * @param {number} division
 */
async function fillDivisionBots(db, divKey, division) {
  const divRef = db.collection('divisions').doc(divKey);
  const divSnap = await divRef.get();
  if (!divSnap.exists) return;

  const divData = divSnap.data();
  const slots = divData.slots || {};
  const standings = divData.standings || [];
  const seasonYear = divData.seasonYear || 1;

  // Find empty slot indices
  const emptyIndices = [];
  for (let i = 0; i < MAX_TEAMS; i++) {
    if (!slots[String(i)]) {
      emptyIndices.push(i);
    }
  }

  if (!emptyIndices.length) return; // All slots filled

  // Assign AI teams to empty slots
  const usedBotIds = new Set();
  Object.values(slots).forEach(slot => {
    if (slot.type === 'bot' && slot.botTeamId) usedBotIds.add(slot.botTeamId);
  });

  const availableTeams = sharedData.AI_TEAMS.filter(t => !usedBotIds.has(t.id));
  const carRange = DIVISION_CAR_RANGE[division] || DIVISION_CAR_RANGE[8];

  const updates = {};
  const newStandingsEntries = [];

  emptyIndices.forEach((slotIdx, i) => {
    const aiTeam = availableTeams[i % availableTeams.length];
    if (!aiTeam) return;

    const botSeed = `bot_${divKey}_${slotIdx}_${seasonYear}`;
    const rng = new engineCore.SeededRNG(botSeed);

    // Generate car component scores scaled to division
    const components = {};
    ['engine', 'chassis', 'aero', 'brakes', 'gearbox', 'reliability', 'efficiency', 'tyreManage'].forEach(comp => {
      components[comp] = { score: rng.intRange(carRange[0], carRange[1]), level: 1 };
    });

    // Pick 2 pilots from AI pool
    const aiPilots = sharedData.PILOT_POOL.filter(p => String(p.id).startsWith('ai'));
    const pilot1 = engineCore.pickSeeded(aiPilots, botSeed + '_p1') || aiPilots[0];
    const pilot2 = engineCore.pickSeeded(aiPilots, botSeed + '_p2') || aiPilots[1] || aiPilots[0];

    const teamSnapshot = {
      teamName: aiTeam.name,
      colors: { primary: aiTeam.color, secondary: '#0a0b0f' },
      logo: '',
      pilots: [
        engineCore.cloneData(pilot1),
        engineCore.cloneData(pilot2)
      ],
      car: { components: components },
      staff: [],
      hq: { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
      engineSupplier: '',
      fans: 1000 + rng.intRange(0, 3000)
    };

    updates[`slots.${slotIdx}`] = {
      type: 'bot',
      botTeamId: aiTeam.id,
      teamSnapshot: teamSnapshot
    };

    // Check if standings already has this team
    if (!standings.find(s => s.teamId === aiTeam.id)) {
      newStandingsEntries.push({
        slotIndex: slotIdx,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        color: aiTeam.color,
        flag: aiTeam.flag || '',
        points: 0,
        wins: 0,
        podiums: 0,
        position: standings.length + newStandingsEntries.length + 1,
        bestResult: 0,
        isPlayer: false
      });
    }
  });

  if (Object.keys(updates).length > 0) {
    await divRef.update(updates);
  }

  if (newStandingsEntries.length > 0) {
    const finalStandings = standings.concat(newStandingsEntries);
    finalStandings.forEach((s, i) => { s.position = i + 1; });
    await divRef.update({ standings: finalStandings });
  }
}

module.exports = { fillDivisionBots, DIVISION_CAR_RANGE };
