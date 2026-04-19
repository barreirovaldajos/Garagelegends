#!/usr/bin/env node
// ===== MIGRATE-TO-MULTIPLAYER.JS =====
// Reads all existing player profiles and assigns them to division groups.
// Run once to bootstrap the MP system for existing players.
//
// Usage: node scripts/migrate-to-multiplayer.js
// Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key

'use strict';

const admin = require('firebase-admin');

// Initialize from env or default service account
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Load shared modules
const sharedData = require('../shared/data-constants.js');
const engineCore = require('../shared/engine-core.js');
const botFiller = require('../functions/lib/bot-filler.js');

const MAX_TEAMS = 10;

async function migrate() {
  console.log('=== Migrate to Multiplayer ===');

  // 1. Load all profiles with save_data
  const profilesSnap = await db.collection('profiles').get();
  const players = [];

  profilesSnap.forEach(doc => {
    const data = doc.data();
    if (!data.save_data) return;
    // Skip if already assigned
    if (data.mp && data.mp.divKey) {
      console.log(`  Skip ${doc.id}: already assigned to ${data.mp.divKey}`);
      return;
    }
    const save = data.save_data;
    const division = Number(save.season?.division) || 8;
    players.push({
      userId: doc.id,
      division: division,
      teamSnapshot: {
        teamName: (save.team && save.team.name) || data.email || 'Team',
        colors: save.team ? { primary: save.team.colors?.primary || '#888', secondary: save.team.colors?.secondary || '#0a0b0f' } : { primary: '#888', secondary: '#0a0b0f' },
        logo: (save.team && save.team.logo) || '',
        pilots: save.pilots || [],
        car: { components: save.car?.components || {} },
        staff: save.staff || [],
        hq: save.hq || { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
        engineSupplier: (save.team && save.team.engineSupplier) || '',
        fans: (save.team && save.team.fans) || 1000
      }
    });
  });

  console.log(`Found ${players.length} players to migrate.`);
  if (players.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // 2. Group players by division
  const byDiv = {};
  players.forEach(p => {
    if (!byDiv[p.division]) byDiv[p.division] = [];
    byDiv[p.division].push(p);
  });

  // 3. For each division, create groups and assign players
  for (const [divStr, divPlayers] of Object.entries(byDiv)) {
    const division = parseInt(divStr);
    const divCatalog = sharedData.DIVISIONS.find(d => d.div === division);
    const maxGroups = divCatalog ? divCatalog.parallelDivisions : 16;

    // Split into groups of MAX_TEAMS
    const groups = [];
    for (let i = 0; i < divPlayers.length; i += MAX_TEAMS) {
      groups.push(divPlayers.slice(i, i + MAX_TEAMS));
    }

    console.log(`\nDivision ${division}: ${divPlayers.length} players → ${groups.length} group(s)`);

    for (let gIdx = 0; gIdx < groups.length && gIdx < maxGroups; gIdx++) {
      const groupNum = gIdx + 1;
      const divKey = `${division}_${groupNum}`;
      const groupPlayers = groups[gIdx];

      console.log(`  Creating ${divKey} with ${groupPlayers.length} player(s)...`);

      // Generate calendar
      const calSeed = `cal_${divKey}_migration`;
      const rng = new engineCore.SeededRNG(calSeed);
      const calendar = engineCore.generateCalendar(division, sharedData.CIRCUITS, rng);

      // Build slots + standings
      const slots = {};
      const standings = [];

      groupPlayers.forEach((player, slotIdx) => {
        slots[String(slotIdx)] = {
          type: 'player',
          userId: player.userId,
          teamSnapshot: player.teamSnapshot,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        standings.push({
          slotIndex: slotIdx,
          teamId: player.userId,
          teamName: player.teamSnapshot.teamName,
          color: player.teamSnapshot.colors.primary,
          points: 0,
          wins: 0,
          podiums: 0,
          position: slotIdx + 1,
          bestResult: 0,
          isPlayer: true
        });
      });

      // Create division doc
      await db.collection('divisions').doc(divKey).set({
        division: division,
        group: groupNum,
        seasonYear: 1,
        phase: 'season',
        calendar: calendar,
        slots: slots,
        standings: standings,
        nextRaceRound: 1,
        raceInProgress: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Fill remaining slots with bots
      await botFiller.fillDivisionBots(db, divKey, division);

      // Update player profiles
      for (let i = 0; i < groupPlayers.length; i++) {
        const player = groupPlayers[i];
        await db.collection('profiles').doc(player.userId).update({
          mp: {
            division: division,
            divisionGroup: groupNum,
            divKey: divKey,
            slotIndex: i,
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            seasonYear: 1
          }
        });
        console.log(`    Assigned ${player.userId} → slot ${i}`);
      }
    }
  }

  console.log('\n=== Migration complete ===');
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
