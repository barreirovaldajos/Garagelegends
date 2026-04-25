// ===== RACE-RUNNER.JS – Server-side race simulation =====
'use strict';

const { FieldValue, Timestamp } = require('firebase-admin').firestore;
const engineCore = require('./shared/engine-core.js');
const sharedData = require('./shared/data-constants.js');

/**
 * Run a race for a single division group.
 * Every player slot participates; those without a submitted strategy race with a
 * smart default strategy built from their current team snapshot.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} divKey - e.g. "8_1"
 * @param {object} [opts]
 * @param {string} [opts.triggeredBy] - UID of admin or 'scheduled'
 */
async function runRaceForDivision(db, divKey, opts) {
  opts = opts || {};
  const divRef  = db.collection('divisions').doc(divKey);
  const divSnap = await divRef.get();
  if (!divSnap.exists) throw new Error(`Division ${divKey} not found`);

  const divData = divSnap.data();
  if (divData.phase !== 'season') throw new Error(`Division ${divKey} is not in season phase`);
  if (divData.raceInProgress)    throw new Error(`Division ${divKey} already has a race in progress`);

  // Find the pending race
  const calendar    = divData.calendar || [];
  const nextRaceIdx = calendar.findIndex(r => r.status === 'next');
  if (nextRaceIdx < 0) throw new Error(`No pending race in division ${divKey}`);

  const raceInfo   = calendar[nextRaceIdx];
  const circuit    = raceInfo.circuit;
  const weather    = raceInfo.weather  || 'dry';
  const forecast   = raceInfo.forecast || null;
  const round      = raceInfo.round    || (nextRaceIdx + 1);
  const division   = divData.division  || 8;
  const seasonYear = divData.seasonYear || 1;

  // Lock the division to prevent duplicate races
  await divRef.update({ raceInProgress: true });

  try {
    // ── 1. Load submitted strategies for this round ──────────────────────────
    const strategiesSnap = await divRef.collection('strategies')
      .where('raceRound', '==', round)
      .get();

    const strategiesByUser = {};
    strategiesSnap.forEach(doc => {
      const d = doc.data();
      if (d.userId) strategiesByUser[d.userId] = d.strategy || {};
    });

    // ── 2. Identify players without a submitted strategy ─────────────────────
    const slots = divData.slots || {};
    const usersWithoutStrategy = [];
    Object.keys(slots).forEach(slotIdx => {
      const slot = slots[slotIdx];
      if (slot.type === 'player' && slot.userId && !strategiesByUser[slot.userId]) {
        usersWithoutStrategy.push(slot.userId);
      }
    });

    // ── 3. Fetch fresh snapshots from profiles for players without strategy ──
    //       This ensures their current car/pilot data is used even if the
    //       cached slot snapshot is stale.
    const freshSnapshots = {};
    for (const uid of usersWithoutStrategy) {
      try {
        const profileSnap = await db.collection('profiles').doc(uid).get();
        if (profileSnap.exists) {
          const pd = profileSnap.data();
          if (pd.save_data) freshSnapshots[uid] = _buildSnapshotFromSaveData(pd.save_data);
        }
      } catch (_) { /* use cached snapshot as fallback */ }
    }

    // ── 4. Build playerTeams and botSlots ────────────────────────────────────
    const playerTeams    = [];
    const botSlots       = [];
    const defaultStratUsers = [];

    Object.keys(slots).forEach(slotIdx => {
      const slot = slots[slotIdx];

      if (slot.type === 'player' && slot.userId) {
        const snapshot   = freshSnapshots[slot.userId] || slot.teamSnapshot || {};
        const hasStrat   = !!strategiesByUser[slot.userId];
        const strategy   = hasStrat
          ? strategiesByUser[slot.userId]
          : _defaultStrategy(weather, snapshot);

        if (!hasStrat) defaultStratUsers.push(slot.userId);

        playerTeams.push({
          userId:         slot.userId,
          teamId:         slot.userId,
          teamName:       snapshot.teamName    || 'Team',
          colors:         snapshot.colors      || { primary: '#888888' },
          pilots:         snapshot.pilots      || [],
          car:            snapshot.car         || { components: {} },
          staff:          snapshot.staff       || [],
          engineSupplier: snapshot.engineSupplier || '',
          strategy:       strategy
        });

      } else if (slot.type === 'bot') {
        const aiTeam = sharedData.AI_TEAMS.find(t => t.id === slot.botTeamId)
          || { id: slot.botTeamId, name: 'Bot Team', color: '#888' };
        botSlots.push({
          botTeamId:    slot.botTeamId,
          aiTeamData:   aiTeam,
          teamSnapshot: slot.teamSnapshot || { car: { components: {} } }
        });
      }
    });

    if (defaultStratUsers.length > 0) {
      require('firebase-functions').logger.info(
        `[${divKey}] R${round}: ${defaultStratUsers.length} player(s) used default strategy: ${defaultStratUsers.join(', ')}`
      );
    }

    // ── 5. Simulate the race ─────────────────────────────────────────────────
    const raceSeed = `${divKey}_${seasonYear}_${round}_${circuit.id || 'unknown'}`;
    const rng      = new engineCore.SeededRNG(raceSeed);

    const result = engineCore.simulateRace({
      rng,
      playerTeams,
      botSlots,
      circuit,
      weather,
      forecast,
      round,
      division,
      pointsTable: sharedData.POINTS_TABLE,
      pilotPool:   sharedData.PILOT_POOL
    });

    // ── 6. Update division standings ─────────────────────────────────────────
    const currentStandings  = divData.standings || [];
    const updatedStandings  = engineCore.updateStandingsPure(currentStandings, result, sharedData.POINTS_TABLE);

    // ── 7. Store race result document ────────────────────────────────────────
    await divRef.collection('raceResults').doc(String(round)).set({
      round,
      circuitId:      circuit.id,
      circuit,
      weather:        result.weather,
      raceSeed,
      simulatedAt:    FieldValue.serverTimestamp(),
      triggeredBy:    opts.triggeredBy || 'scheduled',
      defaultStratUsers,
      totalLaps:      result.totalLaps,
      finalGrid:      result.finalGrid,
      gridStart:      result.gridStart,
      events:         result.events,
      lapSnapshots:   result.lapSnapshots,
      playerCars:     result.playerCars,
      allCarsResults: result.allCarsResults,
      teamSummaries:  result.teamSummaries,
      standingsAfter: updatedStandings
    });

    // ── 8. Advance division calendar ─────────────────────────────────────────
    calendar[nextRaceIdx].status = 'completed';
    calendar[nextRaceIdx].result = {
      simulatedAt:  new Date().toISOString(),
      topPositions: (result.finalGrid || []).slice(0, 3).map(c => ({ name: c.name, teamId: c.teamId })),
      playerPositions: playerTeams.map(pt => {
        const ts = result.teamSummaries && result.teamSummaries[pt.teamId];
        return { teamId: pt.teamId, position: ts ? ts.bestPosition : 99, points: ts ? ts.points : 0, prizeMoney: ts ? ts.prizeMoney : 0 };
      })
    };

    const nextUpcomingIdx = calendar.findIndex(r => r.status === 'upcoming');
    if (nextUpcomingIdx >= 0) calendar[nextUpcomingIdx].status = 'next';
    const isLastRace = nextUpcomingIdx < 0;

    await divRef.update({
      standings:             updatedStandings,
      calendar,
      raceInProgress:        false,
      lastRaceCompletedAt:   FieldValue.serverTimestamp(),
      lastRaceRound:         round,
      nextRaceRound:         isLastRace ? null : calendar[nextUpcomingIdx].round,
      liveRaceState: {
        status:       'live',
        round,
        startTime:    FieldValue.serverTimestamp(),
        durationMode: 'real'
      }
    });

    // ── 9. Update each player's mp field with pending rewards ────────────────
    // Rewards are stored outside save_data so SP game saves cannot overwrite them.
    // The client applies pending values to save_data on next profile load.
    const FAN_BASE    = {1:1200,2:800,3:500,4:320,5:200,6:130,7:80,8:50};
    const FAN_PER_PT  = {1:110, 2:84, 3:62, 4:45, 5:32, 6:22, 7:15, 8:10};
    for (const pt of playerTeams) {
      const summary    = result.teamSummaries && result.teamSummaries[pt.teamId];
      const prizeMoney = (summary && summary.prizeMoney) || 0;
      const points     = (summary && summary.points)     || 0;
      const bestPos    = (summary && summary.bestPosition) || 99;
      const podiumMult = bestPos === 1 ? 2.2 : bestPos === 2 ? 1.6 : bestPos === 3 ? 1.3 : 1.0;
      const fansGained = Math.round(((FAN_BASE[division] || 50) + points * (FAN_PER_PT[division] || 10)) * podiumMult);
      // Compact race result for save_data.raceResults (sponsors + finance panel)
      const raceEntry = {
        round, points, prizeMoney, fansGained,
        position: bestPos,
        circuit: { name: circuit.name, country: circuit.country || '', layout: circuit.layout || '' },
        weather,
        ts: Date.now()
      };
      try {
        const profileRef = db.collection('profiles').doc(pt.userId);
        // rewardsRevealAt: bloquea que el cliente aplique los resultados hasta que termine la carrera en vivo
        // 8 min 30 seg = countdown 10s + carrera 8min + buffer 20s
        const rewardsRevealAt = Timestamp.fromMillis(Date.now() + (8 * 60 + 30) * 1000);
        const updates = { 'mp.lastActiveAt': FieldValue.serverTimestamp(), 'mp.pendingRaceResult': raceEntry, 'mp.rewardsRevealAt': rewardsRevealAt };
        if (prizeMoney > 0) updates['mp.pendingCredits'] = FieldValue.increment(prizeMoney);
        if (fansGained  > 0) updates['mp.pendingFans']   = FieldValue.increment(fansGained);
        await profileRef.update(updates);
      } catch (profileErr) {
        require('firebase-functions').logger.error(`Failed to update mp for ${pt.userId}:`, profileErr);
      }
    }

    // ── 10. Delete consumed strategies ───────────────────────────────────────
    const batch = db.batch();
    strategiesSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // ── 11. End season if this was the last race ──────────────────────────────
    if (isLastRace) {
      const seasonManager = require('./season-manager.js');
      await seasonManager.endDivisionSeason(db, divKey);
    }

    return {
      divKey,
      round,
      circuitName:  circuit.name,
      weather:      result.weather,
      totalLaps:    result.totalLaps,
      gridSize:     (result.finalGrid || []).length,
      playerCount:  playerTeams.length,
      botCount:     botSlots.length,
      defaultStratCount: defaultStratUsers.length,
      isLastRace,
      topPositions: (result.finalGrid || []).slice(0, 3).map(c => ({ name: c.name, pos: c.pos }))
    };

  } catch (err) {
    await divRef.update({ raceInProgress: false });
    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Default strategy for players who did not submit one.
 * Uses the team's actual pilots so they always have cars on the grid.
 */
function _defaultStrategy(weather, snapshot) {
  const pilots = (snapshot && Array.isArray(snapshot.pilots)) ? snapshot.pilots : [];
  // Must be a non-empty array OR null — never [] (empty array is truthy so engine-core
  // won't fall back to the team's pilot list).
  const selectedPilotIds = pilots.slice(0, 2).map(p => p.id).filter(Boolean);
  return {
    tyre:               weather === 'wet' ? 'intermediate' : 'medium',
    aggression:         50,
    pitLap:             42,
    riskLevel:          40,
    engineMode:         'normal',
    pitPlan:            'single',
    safetyCarReaction:  'live',
    setup:              { aeroBalance: 50, wetBias: weather === 'wet' ? 65 : 40 },
    selectedPilotIds:   selectedPilotIds.length > 0 ? selectedPilotIds : null,
    driverConfigs:      {}
  };
}

/**
 * Rebuild a team snapshot from the player's full save_data.
 * Used when the cached slot snapshot might be stale.
 */
function _buildSnapshotFromSaveData(saveData) {
  return {
    teamName:       (saveData.team  && saveData.team.name)            || 'Team',
    colors:         (saveData.team  && saveData.team.colors)          || { primary: '#888888', secondary: '#0a0b0f' },
    logo:           (saveData.team  && saveData.team.logo)            || '',
    pilots:         saveData.pilots || [],
    car:            { components: (saveData.car && saveData.car.components) || {} },
    staff:          saveData.staff  || [],
    hq:             saveData.hq     || { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
    engineSupplier: (saveData.team  && saveData.team.engineSupplier)  || '',
    fans:           (saveData.team  && saveData.team.fans)            || 1000
  };
}

module.exports = { runRaceForDivision };
