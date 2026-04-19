// ===== RACE-RUNNER.JS – Server-side race simulation =====
'use strict';

const engineCore = require('../../shared/engine-core.js');
const sharedData = require('../../shared/data-constants.js');
const botFiller = require('./bot-filler.js');

/**
 * Run a race for a single division group.
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} divKey - Division key (e.g. "8_1")
 * @param {object} [opts] - Options
 * @param {string} [opts.triggeredBy] - UID of admin who triggered (if manual)
 * @returns {object} Race result summary
 */
async function runRaceForDivision(db, divKey, opts) {
  opts = opts || {};
  const divRef = db.collection('divisions').doc(divKey);
  const divSnap = await divRef.get();
  if (!divSnap.exists) throw new Error(`Division ${divKey} not found`);

  const divData = divSnap.data();
  if (divData.phase !== 'season') throw new Error(`Division ${divKey} is not in season phase`);
  if (divData.raceInProgress) throw new Error(`Division ${divKey} already has a race in progress`);

  // Find next race in calendar
  const calendar = divData.calendar || [];
  const nextRaceIdx = calendar.findIndex(r => r.status === 'next');
  if (nextRaceIdx < 0) throw new Error(`No pending race in division ${divKey}`);

  const raceInfo = calendar[nextRaceIdx];
  const circuit = raceInfo.circuit;
  const weather = raceInfo.weather || 'dry';
  const forecast = raceInfo.forecast || null;
  const round = raceInfo.round || (nextRaceIdx + 1);
  const division = divData.division || 8;
  const seasonYear = divData.seasonYear || 1;

  // Mark race as in progress
  await divRef.update({ raceInProgress: true });

  try {
    // Load player strategies
    const strategiesSnap = await divRef.collection('strategies').where('raceRound', '==', round).get();
    const strategiesByUser = {};
    strategiesSnap.forEach(doc => {
      const data = doc.data();
      if (data.userId) strategiesByUser[data.userId] = data.strategy || {};
    });

    // Build player teams and bot slots from division slots
    const slots = divData.slots || {};
    const playerTeams = [];
    const botSlots = [];

    Object.keys(slots).forEach(slotIdx => {
      const slot = slots[slotIdx];
      if (slot.type === 'player' && slot.userId) {
        const snapshot = slot.teamSnapshot || {};
        const strategy = strategiesByUser[slot.userId] || _defaultStrategy(weather);
        playerTeams.push({
          userId: slot.userId,
          teamId: slot.userId,
          teamName: snapshot.teamName || 'Team',
          colors: snapshot.colors || { primary: '#888888' },
          pilots: snapshot.pilots || [],
          car: snapshot.car || { components: {} },
          staff: snapshot.staff || [],
          engineSupplier: snapshot.engineSupplier || '',
          strategy: strategy
        });
      } else if (slot.type === 'bot') {
        const aiTeam = sharedData.AI_TEAMS.find(t => t.id === slot.botTeamId) || { id: slot.botTeamId, name: 'Bot Team', color: '#888' };
        botSlots.push({
          botTeamId: slot.botTeamId,
          aiTeamData: aiTeam,
          teamSnapshot: slot.teamSnapshot || { car: { components: {} } }
        });
      }
    });

    // Generate race seed
    const raceSeed = `${divKey}_${seasonYear}_${round}_${circuit.id || 'unknown'}`;
    const rng = new engineCore.SeededRNG(raceSeed);

    // Run simulation
    const result = engineCore.simulateRace({
      rng: rng,
      playerTeams: playerTeams,
      botSlots: botSlots,
      circuit: circuit,
      weather: weather,
      forecast: forecast,
      round: round,
      division: division,
      pointsTable: sharedData.POINTS_TABLE,
      pilotPool: sharedData.PILOT_POOL
    });

    // Update standings
    const currentStandings = divData.standings || [];
    const updatedStandings = engineCore.updateStandingsPure(currentStandings, result, sharedData.POINTS_TABLE);

    // Store race result
    await divRef.collection('raceResults').doc(String(round)).set({
      round: round,
      circuitId: circuit.id,
      circuit: circuit,
      weather: result.weather,
      raceSeed: raceSeed,
      simulatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      triggeredBy: opts.triggeredBy || 'scheduled',
      totalLaps: result.totalLaps,
      finalGrid: result.finalGrid,
      gridStart: result.gridStart,
      events: result.events,
      lapSnapshots: result.lapSnapshots,
      playerCars: result.playerCars,
      allCarsResults: result.allCarsResults,
      teamSummaries: result.teamSummaries,
      standingsAfter: updatedStandings
    });

    // Update division: standings, calendar status, advance race
    calendar[nextRaceIdx].status = 'completed';
    calendar[nextRaceIdx].result = {
      simulatedAt: new Date().toISOString(),
      topPositions: result.finalGrid.slice(0, 3).map(c => ({ name: c.name, teamId: c.teamId }))
    };

    // Mark next upcoming race as 'next'
    const nextUpcoming = calendar.findIndex(r => r.status === 'upcoming');
    if (nextUpcoming >= 0) {
      calendar[nextUpcoming].status = 'next';
    }

    const isLastRace = nextUpcoming < 0;

    await divRef.update({
      standings: updatedStandings,
      calendar: calendar,
      raceInProgress: false,
      lastRaceCompletedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      lastRaceRound: round,
      nextRaceRound: isLastRace ? null : calendar[nextUpcoming].round
    });

    // Apply prize money to player profiles
    for (const pt of playerTeams) {
      const summary = result.teamSummaries[pt.userId];
      if (summary && summary.prizeMoney > 0) {
        const profileRef = db.collection('profiles').doc(pt.userId);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
          const profileData = profileSnap.data();
          const saveData = profileData.save_data;
          if (saveData && saveData.finances) {
            saveData.finances.credits = (saveData.finances.credits || 0) + summary.prizeMoney;
            if (!saveData.finances.lastRaceSettlement) saveData.finances.lastRaceSettlement = {};
            saveData.finances.lastRaceSettlement.prizeDelta = summary.prizeMoney;
            saveData.finances.lastRaceSettlement.week = saveData.season ? saveData.season.week : 0;
            await profileRef.update({ save_data: saveData });
          }
        }
      }
    }

    // Delete consumed strategies
    const batch = db.batch();
    strategiesSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // If last race, trigger season end
    if (isLastRace) {
      const seasonManager = require('./season-manager.js');
      await seasonManager.endDivisionSeason(db, divKey);
    }

    return {
      divKey: divKey,
      round: round,
      circuitName: circuit.name,
      weather: result.weather,
      totalLaps: result.totalLaps,
      gridSize: result.finalGrid.length,
      isLastRace: isLastRace,
      topPositions: result.finalGrid.slice(0, 3).map(c => ({ name: c.name, pos: c.pos }))
    };

  } catch (err) {
    // Clear race-in-progress flag on error
    await divRef.update({ raceInProgress: false });
    throw err;
  }
}

function _defaultStrategy(weather) {
  return {
    tyre: weather === 'wet' ? 'intermediate' : 'medium',
    aggression: 50,
    pitLap: 42,
    riskLevel: 40,
    engineMode: 'normal',
    pitPlan: 'single',
    safetyCarReaction: 'live',
    setup: { aeroBalance: 50, wetBias: weather === 'wet' ? 65 : 40 },
    selectedPilotIds: [],
    driverConfigs: {}
  };
}

module.exports = { runRaceForDivision };
