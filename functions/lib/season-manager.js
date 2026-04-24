// ===== SEASON-MANAGER.JS – End-of-season promotion/relegation and new season setup =====
'use strict';

const sharedData = require('./shared/data-constants.js');
const engineCore = require('./shared/engine-core.js');
const botFiller = require('./bot-filler.js');

/**
 * End a division group's season: compute promotions/relegations, reset for next season.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} divKey - e.g. "8_1"
 */
async function endDivisionSeason(db, divKey) {
  const divRef = db.collection('divisions').doc(divKey);
  const divSnap = await divRef.get();
  if (!divSnap.exists) throw new Error(`Division ${divKey} not found`);

  const divData = divSnap.data();
  const division = divData.division;
  const group = divData.group;
  const seasonYear = divData.seasonYear || 1;
  const slots = divData.slots || {};

  // Rebuild standings from slots to guard against missing bot entries
  // (e.g. botFiller failed during setup or bots were added after some races ran)
  const rawStandings = divData.standings || [];
  const standingsMap = {};
  rawStandings.forEach(s => { if (s && s.teamId) standingsMap[s.teamId] = s; });
  Object.values(slots).forEach(slot => {
    if (!slot) return;
    const tid = slot.type === 'player' ? slot.userId : slot.botTeamId;
    if (!tid || standingsMap[tid]) return;
    standingsMap[tid] = {
      teamId: tid,
      teamName: (slot.teamSnapshot && slot.teamSnapshot.teamName) || 'Team',
      points: 0, wins: 0, podiums: 0, bestResult: 0,
      isPlayer: slot.type === 'player',
      position: 99
    };
  });
  const standings = Object.values(standingsMap);

  const divCatalog = sharedData.DIVISIONS.find(d => d.div === division);
  if (!divCatalog) throw new Error(`Unknown division ${division}`);

  const promoCount = divCatalog.promotions || 0;
  const relegCount = divCatalog.relegations || 0;

  // Guard: if no meaningful race data exists, archive without promotions/relegations.
  // This prevents a lone player from being auto-promoted when bots never raced.
  const anyRaceData = standings.some(s => s.points > 0 || s.wins > 0 || s.bestResult > 0);
  if (!anyRaceData) {
    require('firebase-functions').logger.warn(
      `endDivisionSeason(${divKey}): no race data found, archiving without promotion/relegation`
    );
    await divRef.update({
      phase: 'offseason',
      seasonEndedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  // Sort: points DESC → wins DESC → bestResult ASC (lower car position = better finish)
  // bestResult=0 means uninitialized (never raced) → treat as worst possible (9999)
  const sorted = standings.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aBest = a.bestResult > 0 ? a.bestResult : 9999;
    const bBest = b.bestResult > 0 ? b.bestResult : 9999;
    return aBest - bBest;
  });

  // Tag promotion/relegation zones
  const promoted = [];
  const relegated = [];
  sorted.forEach((entry, idx) => {
    if (idx < promoCount && division > 1) {
      entry.seasonOutcome = 'promoted';
      promoted.push(entry);
    } else if (idx >= sorted.length - relegCount && division < 8) {
      entry.seasonOutcome = 'relegated';
      relegated.push(entry);
    } else {
      entry.seasonOutcome = 'stayed';
    }
  });

  // Store season archive
  await divRef.collection('seasonArchive').doc(String(seasonYear)).set({
    seasonYear: seasonYear,
    division: division,
    group: group,
    finalStandings: sorted,
    completedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
  });

  // Process player promotions/relegations
  for (const entry of [...promoted, ...relegated]) {
    if (!entry.isPlayer) continue;

    const newDiv = entry.seasonOutcome === 'promoted' ? division - 1 : division + 1;
    const userId = entry.teamId;

    // Update player profile mp field
    const profileRef = db.collection('profiles').doc(userId);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) continue;

    const profileData = profileSnap.data();
    const mp = profileData.mp || {};

    // Mark pending reassignment — will be placed in new division on next season start
    await profileRef.update({
      'mp.pendingDivision': newDiv,
      'mp.seasonOutcome': entry.seasonOutcome,
      'mp.lastSeasonYear': seasonYear,
      'mp.lastSeasonPosition': entry.position
    });
  }

  // Also mark stayed players
  for (const entry of sorted) {
    if (!entry.isPlayer) continue;
    if (entry.seasonOutcome === 'stayed') {
      const profileRef = db.collection('profiles').doc(entry.teamId);
      await profileRef.update({
        'mp.pendingDivision': division,
        'mp.seasonOutcome': 'stayed',
        'mp.lastSeasonYear': seasonYear,
        'mp.lastSeasonPosition': entry.position
      });
    }
  }

  // Transition division to offseason
  await divRef.update({
    phase: 'offseason',
    seasonEndedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Start a new season for all divisions.
 * Called by scheduled function or admin.
 * @param {FirebaseFirestore.Firestore} db
 */
async function startNewSeason(db) {
  // 1. Collect all players with pending reassignments
  const profilesSnap = await db.collection('profiles')
    .where('mp.pendingDivision', '>', 0)
    .get();

  const playersByDiv = {}; // { division: [{ userId, teamSnapshot, pendingDivision }] }

  profilesSnap.forEach(doc => {
    const data = doc.data();
    const mp = data.mp || {};
    const pendingDiv = mp.pendingDivision;
    if (!pendingDiv) return;

    if (!playersByDiv[pendingDiv]) playersByDiv[pendingDiv] = [];
    playersByDiv[pendingDiv].push({
      userId: doc.id,
      teamSnapshot: _buildSnapshotFromProfile(data),
      pendingDivision: pendingDiv
    });
  });

  // 2. Clear old division docs (set phase to 'archived') and compute next season year
  const oldDivisionsSnap = await db.collection('divisions')
    .where('phase', '==', 'offseason')
    .get();

  // Derive nextSeasonYear from the offseason docs we already have — avoids a
  // composite-index query (division + phase) that Firestore would reject without
  // a manual index definition.
  const seasonYearByDiv = {};
  oldDivisionsSnap.forEach(doc => {
    const { division: d, seasonYear: y } = doc.data();
    if (!seasonYearByDiv[d] || y > seasonYearByDiv[d]) seasonYearByDiv[d] = y || 1;
  });

  const archiveBatch = db.batch();
  oldDivisionsSnap.forEach(doc => {
    archiveBatch.update(doc.ref, { phase: 'archived' });
  });
  await archiveBatch.commit();

  // 3. Create new division groups and assign players
  for (const [divStr, players] of Object.entries(playersByDiv)) {
    const division = parseInt(divStr);
    const divCatalog = sharedData.DIVISIONS.find(d => d.div === division);
    const maxGroups = divCatalog ? divCatalog.parallelDivisions : 16;
    const teamsPerGroup = 10;

    // nextSeasonYear = max year seen in offseason docs for this div + 1
    const nextSeasonYear = (seasonYearByDiv[division] || 1) + 1;

    // Distribute players across groups (max 10 per group)
    const groups = [];
    for (let i = 0; i < players.length; i += teamsPerGroup) {
      groups.push(players.slice(i, i + teamsPerGroup));
    }

    // Ensure at least one group exists
    if (groups.length === 0) groups.push([]);

    for (let gIdx = 0; gIdx < groups.length && gIdx < maxGroups; gIdx++) {
      const groupNum = gIdx + 1;
      const divKey = `${division}_${groupNum}`;
      const groupPlayers = groups[gIdx];

      // Generate new calendar
      const calSeed = `cal_${divKey}_s${nextSeasonYear}`;
      const rng = new engineCore.SeededRNG(calSeed);
      const calendar = engineCore.generateCalendar(division, sharedData.CIRCUITS, rng);

      // Build slots and standings
      const slotsObj = {};
      const standings = [];

      groupPlayers.forEach((player, slotIdx) => {
        slotsObj[String(slotIdx)] = {
          type: 'player',
          userId: player.userId,
          teamSnapshot: player.teamSnapshot,
          joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
        };
        standings.push({
          slotIndex: slotIdx,
          teamId: player.userId,
          teamName: (player.teamSnapshot.teamName) || 'Team',
          color: (player.teamSnapshot.colors && player.teamSnapshot.colors.primary) || '#888',
          points: 0,
          wins: 0,
          podiums: 0,
          position: slotIdx + 1,
          bestResult: 0,
          isPlayer: true
        });
      });

      // Create new division doc
      const divData = {
        division: division,
        group: groupNum,
        seasonYear: nextSeasonYear,
        phase: 'season',
        calendar: calendar,
        slots: slotsObj,
        standings: standings,
        nextRaceRound: 1,
        raceInProgress: false,
        createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
      };

      await db.collection('divisions').doc(divKey).set(divData);

      // Fill remaining slots with bots
      await botFiller.fillDivisionBots(db, divKey, division);

      // Update player profiles with new division assignment
      for (const player of groupPlayers) {
        const slotIdx = groupPlayers.indexOf(player);
        await db.collection('profiles').doc(player.userId).update({
          mp: {
            division: division,
            divisionGroup: groupNum,
            divKey: divKey,
            slotIndex: slotIdx,
            status: 'active',
            seasonYear: nextSeasonYear,
            joinedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
            lastActiveAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
          }
        });
      }
    }
  }
}

/**
 * Build a team snapshot from a player's profile data.
 */
function _buildSnapshotFromProfile(profileData) {
  const save = profileData.save_data || {};
  // save_data structure mirrors race-runner: team name/colors live under save.team.*
  return {
    teamName:       (save.team && save.team.name)           || profileData.teamName || 'Team',
    colors:         (save.team && save.team.colors)         || { primary: '#888888', secondary: '#0a0b0f' },
    logo:           (save.team && save.team.logo)           || '',
    pilots:         save.pilots                             || [],
    car:            { components: (save.car && save.car.components) || {} },
    staff:          save.staff                              || [],
    hq:             save.hq || { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
    engineSupplier: (save.team && save.team.engineSupplier) || '',
    fans:           (save.team && save.team.fans)           || 1000
  };
}

module.exports = {
  endDivisionSeason,
  startNewSeason
};
