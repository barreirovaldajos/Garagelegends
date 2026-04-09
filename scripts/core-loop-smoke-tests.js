'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeCalendar(division) {
  return [
    {
      round: 1,
      status: 'next',
      weather: 'dry',
      circuit: { name: `D${division} Ring`, country: 'Testland', laps: 30, length: '4.9km', layout: 'mixed', weather: 70 }
    },
    {
      round: 2,
      status: 'upcoming',
      weather: 'wet',
      circuit: { name: `D${division} GP`, country: 'Testland', laps: 31, length: '5.1km', layout: 'power', weather: 60 }
    }
  ];
}

function createAiTeams() {
  return Array.from({ length: 9 }, (_, i) => ({
    id: `ai_${i + 1}`,
    name: `AI Team ${i + 1}`,
    color: '#888888',
    flag: 'T'
  }));
}

function basePilot() {
  return {
    id: 'pilot_1',
    name: 'Test Driver',
    attrs: {
      pace: 70,
      racePace: 70,
      consistency: 70,
      rain: 65,
      tyre: 70,
      aggression: 65,
      overtake: 68,
      techFB: 60,
      mental: 70,
      charisma: 60
    }
  };
}

function makePilot(id, name, overrides = {}) {
  const pilot = basePilot();
  pilot.id = id;
  pilot.name = name;
  pilot.attrs = { ...pilot.attrs, ...(overrides.attrs || {}) };
  return { ...pilot, ...overrides, attrs: pilot.attrs };
}

function baseCar() {
  return {
    components: {
      engine: { level: 1, score: 60 },
      chassis: { level: 1, score: 60 },
      aero: { level: 1, score: 60 },
      tyreManage: { level: 1, score: 60 },
      brakes: { level: 1, score: 60 },
      gearbox: { level: 1, score: 60 },
      reliability: { level: 1, score: 60 },
      efficiency: { level: 1, score: 60 }
    },
    rnd: { points: 0, active: null, queue: [] }
  };
}

function createBaseState() {
  const aiTeams = createAiTeams();
  const standings = [
    { id: 'player', name: 'Player Team', color: '#ff0000', flag: '', points: 0, wins: 0, position: 1, bestResult: 1 },
    ...aiTeams.map((t, idx) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      flag: t.flag,
      points: 0,
      wins: 0,
      position: idx + 2,
      bestResult: 2
    }))
  ];

  return {
    meta: { saveTime: Date.now() },
    team: { name: 'Player Team', colors: { primary: '#ff0000' }, fans: 1000, reputation: 100, logo: 'P', engineSupplier: '' },
    season: {
      year: 1,
      week: 1,
      raceIndex: 0,
      totalRaces: 8,
      division: 8,
      phase: 'season',
      calendar: makeCalendar(8),
      lastSummary: null,
      lastSummaryPending: false
    },
    standings,
    seasonHistory: [],
    campaign: { phase: 'phase1', activeObjectiveId: 'phase1_survive_prove', history: [] },
    objectives: [],
    finances: {
      credits: 0,
      tokens: 10,
      weeklyIncome: 0,
      weeklyExpenses: 0,
      deficitStreak: 0,
      criticalDeficit: false,
      lastNet: 0,
      history: []
    },
    pilots: [basePilot()],
    staff: [],
    sponsors: [],
    hq: { wind_tunnel: 1, rnd: 1, factory: 1, academy: 1, admin: 1 },
    construction: { active: false, buildingId: null, startTime: 0, durationMs: 0, targetLevel: 0 },
    car: baseCar(),
    randomEvents: [],
    raceResults: [],
    advisor: {
      mode: 'balanced',
      recent: [],
      layoutWeatherStats: {},
      practice: { sessions: 0, lastTs: 0 },
      telemetry: {
        byMode: {
          conservative: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
          balanced: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
          aggressive: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 }
        },
        last: { mode: 'balanced', source: 'manual', ts: 0 },
        suggestion: {
          cooldownWeeks: 2,
          lastAppliedWeekIndex: 0,
          lastAppliedMode: 'balanced',
          stats: {
            shown: 0,
            applied: 0,
            ignored: 0,
            history: [],
            byMode: {
              conservative: { shown: 0, applied: 0, ignored: 0 },
              balanced: { shown: 0, applied: 0, ignored: 0 },
              aggressive: { shown: 0, applied: 0, ignored: 0 }
            },
            pending: false,
            pendingMode: '',
            pendingWeekIndex: 0,
            pendingReason: ''
          }
        }
      }
    },
    log: []
  };
}

function loadEngine() {
  const srcPath = path.join(__dirname, '..', 'js', 'engine.js');
  let src = fs.readFileSync(srcPath, 'utf8');
  src = src.replace(/^import\s+.*$/gm, '');

  const sandbox = {
    console,
    Date,
    Math: Object.create(Math),
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
    Divisions: {
      getDivisionConfig: () => ({ teams: 10, promotions: 2, relegations: 2 })
    },
    Economy: {
      processWeeklyBalance: (teamState) => {
        if (!teamState.finances) teamState.finances = {};
        teamState.finances.weeklyIncome = 12000;
        teamState.finances.weeklyExpenses = 9000;
        teamState.finances.lastNet = 3000;
        return { income: 12000, expenses: 9000, net: 3000, effects: { streak: 0, notes: [] } };
      },
      calculateTeamIncomeBreakdown: () => ({ sponsorIncome: 0, fanRevenue: 0, bonusIncome: 0, income: 0 }),
      calculateTeamExpenseBreakdown: () => ({ salaries: 0, hqCost: 0, contractCost: 0, constructionUpkeep: 0, expenses: 0 })
    },
    Academy: {
      generateScoutingPool: () => {},
      processActiveTraining: () => {}
    },
    window: {},
    __: (k) => k
  };

  const aiTeams = createAiTeams();
  const logs = [];
  const toasts = [];
  const modals = [];

  const stateApi = {
    _state: null,
    getState() { return this._state; },
    saveState() {},
    addCredits(amount) { this._state.finances.credits = Math.max(0, (this._state.finances.credits || 0) + amount); },
    spendCredits(amount) {
      if ((this._state.finances.credits || 0) < amount) return false;
      this._state.finances.credits -= amount;
      return true;
    },
    addTokens(amount) { this._state.finances.tokens = (this._state.finances.tokens || 0) + amount; },
    addLog(text, type) { logs.unshift({ text, type }); },
    addRandomEvent(ev) { this._state.randomEvents.push(ev); },
    popRandomEvent() { return this._state.randomEvents.shift() || null; },
    getMyStanding() { return this._state.standings.find((s) => s.id === 'player') || { position: 10, points: 0, wins: 0 }; },
    getCar() { return this._state.car; },
    getWeek() { return this._state.season.week; }
  };

  sandbox.window = {
    GL_STATE: stateApi,
    GL_DATA: {
      AI_TEAMS: aiTeams,
      POINTS_TABLE: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      RANDOM_EVENTS: [],
      generateCalendar: makeCalendar
    },
    GL_UI: {
      fmtCR: (v) => Number(v || 0).toLocaleString(),
      openModal: (cfg) => { modals.push(cfg); },
      toast: (msg, type) => { toasts.push({ msg, type }); }
    },
    generateCalendar: makeCalendar,
    __: (k) => k
  };

  sandbox.GL_UI = sandbox.window.GL_UI;

  sandbox.Math.random = () => 0.9;

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'engine.js' });

  return {
    engine: sandbox.window.GL_ENGINE,
    stateApi,
    logs,
    toasts,
    modals,
    sandbox
  };
}

function testSeasonTransitionAndCampaignCompletion(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 10000;
  state.season.week = state.season.totalRaces;
  state.season.year = 2; // phase1 objective still active
  state.season.division = 8;
  state.standings.find((s) => s.id === 'player').position = 2;
  state.standings.find((s) => s.id === 'player').points = 110;
  state.standings.find((s) => s.id === 'player').wins = 2;

  stateApi._state = state;

  const economy = engine.weeklyTick();

  assert.strictEqual(economy.net, 3000, 'weekly economy should be processed for player');
  assert.strictEqual(state.season.year, 3, 'season year should advance after endSeason');
  assert.strictEqual(state.season.week, 1, 'week should reset to 1 after rollover');
  assert.strictEqual(state.season.division, 7, 'player in top 2 should be promoted from div 8 to 7');
  assert.strictEqual(state.season.lastSummaryPending, true, 'season summary should be pending for UI display');
  assert.ok(state.season.lastSummary, 'last summary should exist after season rollover');
  assert.strictEqual(state.season.lastSummary.year, 2, 'summary should reference completed year');
  assert.strictEqual(state.season.lastSummary.finishPosition, 2, 'summary should capture final position');
  assert.ok(state.season.lastSummary.campaign, 'summary should include campaign result payload');
  assert.strictEqual(state.season.lastSummary.campaign.completed, true, 'phase1 objective should complete for top 3 and no critical deficit');
  assert.strictEqual(state.campaign.history.length, 1, 'campaign history should register completion');
}

function testCampaignStatusRecentHistory(engine, stateApi) {
  const state = createBaseState();
  state.campaign.history = [
    { id: 'phase1_survive_prove', phase: 'phase1', year: 1, rewardCredits: 100000 },
    { id: 'phase2_climb', phase: 'phase2', year: 2, rewardCredits: 150000 },
    { id: 'phase3_dynasty', phase: 'phase3', year: 3, rewardCredits: 250000 },
    { id: 'phase1_survive_prove', phase: 'phase1', year: 4, rewardCredits: 100000 },
    { id: 'phase2_climb', phase: 'phase2', year: 5, rewardCredits: 150000 },
    { id: 'phase3_dynasty', phase: 'phase3', year: 6, rewardCredits: 250000 }
  ];
  stateApi._state = state;

  const status = engine.getCampaignStatus();

  assert.ok(status.objective, 'campaign status should always provide active objective');
  assert.strictEqual(status.historyCount, 6, 'historyCount should reflect full campaign history');
  assert.strictEqual(status.recentHistory.length, 5, 'recentHistory should be capped at 5 entries');
  assert.strictEqual(status.recentHistory[0].year, 6, 'recentHistory should be newest first');
  assert.strictEqual(status.recentHistory[4].year, 2, 'recentHistory should include last 5 entries only');
}

function testNoPromotionBeyondDivisionOne(engine, stateApi) {
  const state = createBaseState();
  state.season.year = 5;
  state.season.week = state.season.totalRaces;
  state.season.division = 1;
  state.standings.find((s) => s.id === 'player').position = 1;
  state.standings.find((s) => s.id === 'player').points = 150;
  stateApi._state = state;

  engine.weeklyTick();

  assert.strictEqual(state.season.division, 1, 'division 1 champion should stay in division 1');
  assert.strictEqual(state.season.lastSummary.result, 'stable', 'division 1 champion should not be promoted further');
}

function testRelegationAtBottomThreshold(engine, stateApi) {
  const state = createBaseState();
  state.season.week = state.season.totalRaces;
  state.season.division = 5;
  state.standings.find((s) => s.id === 'player').position = 10;
  state.standings.find((s) => s.id === 'player').points = 4;
  stateApi._state = state;

  engine.weeklyTick();

  assert.strictEqual(state.season.division, 6, 'bottom-two finish should relegate player by one division');
  assert.strictEqual(state.season.lastSummary.result, 'relegated', 'season summary should record relegation');
  assert.strictEqual(state.season.lastSummary.nextDivision, 6, 'summary should record target relegated division');
}

function testPhase2CampaignCompletion(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 30000;
  state.season.year = 4;
  state.season.week = state.season.totalRaces;
  state.season.division = 5;
  state.standings.find((s) => s.id === 'player').position = 4;
  stateApi._state = state;

  engine.weeklyTick();

  assert.strictEqual(state.season.lastSummary.campaign.id, 'phase2_climb', 'phase2 objective should be active in year 4');
  assert.strictEqual(state.season.lastSummary.campaign.completed, true, 'reaching division 5 should complete phase2');
  assert.strictEqual(state.campaign.history[0].id, 'phase2_climb', 'campaign history should record phase2 completion');
}

function testPhase3CampaignCompletion(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 50000;
  state.season.year = 5;
  state.season.week = state.season.totalRaces;
  state.season.division = 1;
  state.standings.find((s) => s.id === 'player').position = 1;
  state.standings.find((s) => s.id === 'player').points = 160;
  state.standings.find((s) => s.id === 'player').wins = 6;
  stateApi._state = state;

  engine.weeklyTick();

  assert.strictEqual(state.season.lastSummary.campaign.id, 'phase3_dynasty', 'phase3 objective should be active in year 5+');
  assert.strictEqual(state.season.lastSummary.campaign.completed, true, 'winning division 1 should complete phase3');
  assert.strictEqual(state.campaign.history[0].id, 'phase3_dynasty', 'campaign history should record phase3 completion');
}

function testCampaignFailureStillPersistsSummary(engine, stateApi) {
  const state = createBaseState();
  state.season.year = 2;
  state.season.week = state.season.totalRaces;
  state.finances.criticalDeficit = true;
  state.standings.find((s) => s.id === 'player').position = 2;
  stateApi._state = state;

  engine.weeklyTick();

  assert.ok(state.season.lastSummary.campaign, 'summary should include campaign result even on failure');
  assert.strictEqual(state.season.lastSummary.campaign.completed, false, 'critical deficit should fail phase1 objective');
  assert.strictEqual(state.campaign.history.length, 0, 'failed objective should not write completion history');
}

function testOfflineCatchUpPassiveWindow(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 500;
  state.meta.saveTime = Date.now() - (5 * 60 * 60 * 1000);
  state.season.calendar = [];
  stateApi._state = state;

  const simulated = engine.catchUpOffline();

  assert.strictEqual(simulated.simulatedRaces, 0, 'short offline window should not simulate races');
  assert.ok(state.finances.credits > 500, 'passive progression should add credits in short offline window');
  assert.ok(state.meta.saveTime <= Date.now(), 'saveTime should sync after catch-up');
}

function testOfflineCatchUpRaceWindow(engine, stateApi) {
  const state = createBaseState();
  state.meta.saveTime = Date.now() - (10 * 24 * 60 * 60 * 1000);
  state.season.week = 1;
  state.season.totalRaces = 20;
  stateApi._state = state;

  const beforePoints = state.standings.find((s) => s.id === 'player').points;
  const simulated = engine.catchUpOffline();

  assert.ok(simulated.totalSimulated >= 2, '24h+ window should simulate at least one practice and one race when calendar is available');
  assert.ok(simulated.simulatedRaces >= 1, '24h+ window should simulate at least one race when calendar is available');
  assert.ok(state.standings.find((s) => s.id === 'player').points >= beforePoints, 'player standings should update after offline race simulation');
  const completedRaces = state.season.calendar.filter((r) => r.status === 'completed').length;
  assert.ok(completedRaces >= 1, 'offline race simulation should complete at least one race');
}

function testBuildRaceGridUsesSelectedPilotStrength(engine, stateApi) {
  const state = createBaseState();
  stateApi._state = state;

  const weakPilot = makePilot('pilot_slow', 'Slow Driver', {
    attrs: { pace: 45, racePace: 48, consistency: 50, rain: 48, tyre: 50, aggression: 52, overtake: 46, techFB: 55, mental: 52, charisma: 50 }
  });
  const strongPilot = makePilot('pilot_fast', 'Fast Driver', {
    attrs: { pace: 88, racePace: 91, consistency: 84, rain: 82, tyre: 86, aggression: 75, overtake: 85, techFB: 72, mental: 84, charisma: 70 }
  });
  const sharedStrategy = {
    tyre: 'medium',
    aggression: 55,
    riskLevel: 40,
    engineMode: 'normal',
    pitPlan: 'single',
    strategy: 'balanced',
    setup: { aeroBalance: 50, wetBias: 50 }
  };

  const weakGrid = engine.buildRaceGrid(weakPilot, 'dry', state.season.calendar[0].circuit, sharedStrategy);
  const strongGrid = engine.buildRaceGrid(strongPilot, 'dry', state.season.calendar[0].circuit, sharedStrategy);
  const weakBase = weakGrid.find((entry) => entry.id === 'player').base;
  const strongBase = strongGrid.find((entry) => entry.id === 'player').base;

  assert.ok(strongBase > weakBase, 'player base pace should depend on selected pilot, not team average only');
}

function testSimulateRaceRespectsDriverTyresAndPitTyres(engine, stateApi) {
  const state = createBaseState();
  state.pilots = [
    makePilot('pilot_1', 'Driver One', { attrs: { pace: 78, racePace: 80, tyre: 77, consistency: 74 } }),
    makePilot('pilot_2', 'Driver Two', { attrs: { pace: 66, racePace: 72, tyre: 71, consistency: 79 } })
  ];
  stateApi._state = state;

  const result = engine.simulateRace({
    weather: 'dry',
    circuits: state.season.calendar[0].circuit,
    strategy: {
      tyre: 'medium',
      aggression: 50,
      riskLevel: 40,
      pitLap: 50,
      engineMode: 'normal',
      pitPlan: 'single',
      strategy: 'balanced',
      setup: { aeroBalance: 50, wetBias: 50 },
      selectedPilotIds: ['pilot_1', 'pilot_2'],
      pilotId: 'pilot_1',
      driverConfigs: {
        pilot_1: {
          tyre: 'soft',
          aggression: 68,
          riskLevel: 46,
          pitLap: 20,
          engineMode: 'push',
          pitPlan: 'single',
          strategy: 'aggressive',
          pitTyres: ['hard', 'soft']
        },
        pilot_2: {
          tyre: 'hard',
          aggression: 38,
          riskLevel: 28,
          pitLap: 24,
          engineMode: 'eco',
          pitPlan: 'single',
          strategy: 'conservative',
          pitTyres: ['medium', 'soft']
        }
      }
    }
  });

  const car1 = result.playerCars.find((entry) => entry.pilotId === 'pilot_1');
  const car2 = result.playerCars.find((entry) => entry.pilotId === 'pilot_2');

  assert.ok(car1 && car2, 'simulateRace should return both selected player cars');
  assert.strictEqual(car1.strategy.tyre, 'soft', 'driver one should start from its individual tyre selection');
  assert.strictEqual(car2.strategy.tyre, 'hard', 'driver two should start from its individual tyre selection');
  assert.strictEqual(car1.tyre, 'hard', 'driver one should finish on the configured first pit compound');
  assert.strictEqual(car2.tyre, 'medium', 'driver two should finish on the configured first pit compound');
}

function testSimulateRaceProducesAiPitStops(engine, stateApi) {
  const state = createBaseState();
  stateApi._state = state;

  const result = engine.simulateRace({
    weather: 'dry',
    circuits: state.season.calendar[0].circuit,
    strategy: {
      tyre: 'medium',
      aggression: 50,
      riskLevel: 40,
      pitLap: 50,
      engineMode: 'normal',
      pitPlan: 'single',
      strategy: 'balanced',
      setup: { aeroBalance: 50, wetBias: 50 },
      selectedPilotIds: ['pilot_1'],
      pilotId: 'pilot_1',
      driverConfigs: {
        pilot_1: {
          tyre: 'medium',
          aggression: 50,
          riskLevel: 40,
          pitLap: 22,
          engineMode: 'normal',
          pitPlan: 'single',
          strategy: 'balanced',
          pitTyres: ['hard', 'soft']
        }
      }
    }
  });

  const aiCarsOnNewCompound = result.finalGrid.filter((entry) => !entry.isPlayer && entry.strategy && entry.tyre !== entry.strategy.tyre);
  assert.ok(aiCarsOnNewCompound.length > 0, 'at least one AI car should pit and switch compounds');
}

function run() {
  const { engine, stateApi } = loadEngine();
  if (!engine) throw new Error('Could not load GL_ENGINE from engine.js');

  testSeasonTransitionAndCampaignCompletion(engine, stateApi);
  testCampaignStatusRecentHistory(engine, stateApi);
  testNoPromotionBeyondDivisionOne(engine, stateApi);
  testRelegationAtBottomThreshold(engine, stateApi);
  testPhase2CampaignCompletion(engine, stateApi);
  testPhase3CampaignCompletion(engine, stateApi);
  testCampaignFailureStillPersistsSummary(engine, stateApi);
  testOfflineCatchUpPassiveWindow(engine, stateApi);
  testOfflineCatchUpRaceWindow(engine, stateApi);
  testBuildRaceGridUsesSelectedPilotStrength(engine, stateApi);
  testSimulateRaceRespectsDriverTyresAndPitTyres(engine, stateApi);
  testSimulateRaceProducesAiPitStops(engine, stateApi);

  console.log('✓ Core loop smoke tests passed (12 cases).');
}

run();
