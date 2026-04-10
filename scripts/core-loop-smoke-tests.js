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
      circuit: { name: `D${division} Ring`, country: 'Testland', laps: 64, length: '4.80km', layout: 'mixed', weather: 70 }
    },
    {
      round: 2,
      status: 'upcoming',
      weather: 'wet',
      circuit: { name: `D${division} GP`, country: 'Testland', laps: 62, length: '4.92km', layout: 'power', weather: 60 }
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

function loadDataModule() {
  const srcPath = path.join(__dirname, '..', 'js', 'data.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const sandbox = {
    console,
    Date,
    Math,
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'data.js' });
  return sandbox.window.GL_DATA;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexToRgb(color) {
  const hex = String(color || '').trim().replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((part) => `${part}${part}`).join('')
    : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getColorDistance(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt(((a.r - b.r) ** 2) + ((a.g - b.g) ** 2) + ((a.b - b.b) ** 2));
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function withRandomSource(sandbox, randomFn, fn) {
  const previous = sandbox.Math.random;
  sandbox.Math.random = randomFn;
  try {
    return fn();
  } finally {
    sandbox.Math.random = previous;
  }
}

function buildSingleDriverStrategy(driverOverrides = {}) {
  const baseDriver = {
    tyre: 'medium',
    aggression: 50,
    riskLevel: 40,
    pitLap: 50,
    engineMode: 'normal',
    pitPlan: 'single',
    strategy: 'balanced',
    pitTyres: ['hard', 'soft'],
    setup: { aeroBalance: 50, wetBias: 50 },
    interventions: [{ lapPct: 30, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }]
  };
  const mergedDriver = {
    ...baseDriver,
    ...driverOverrides,
    setup: { ...baseDriver.setup, ...(driverOverrides.setup || {}) },
    interventions: Array.isArray(driverOverrides.interventions)
      ? driverOverrides.interventions.map((entry, idx) => ({ ...baseDriver.interventions[idx], ...entry }))
      : cloneData(baseDriver.interventions),
    pitTyres: Array.isArray(driverOverrides.pitTyres)
      ? driverOverrides.pitTyres.slice(0, 2)
      : cloneData(baseDriver.pitTyres)
  };

  return {
    tyre: baseDriver.tyre,
    aggression: baseDriver.aggression,
    riskLevel: baseDriver.riskLevel,
    pitLap: baseDriver.pitLap,
    engineMode: baseDriver.engineMode,
    pitPlan: baseDriver.pitPlan,
    strategy: baseDriver.strategy,
    setup: cloneData(baseDriver.setup),
    interventions: cloneData(baseDriver.interventions),
    selectedPilotIds: ['pilot_1'],
    pilotId: 'pilot_1',
    driverConfigs: {
      pilot_1: mergedDriver
    }
  };
}

function simulateSingleDriverRace(engine, stateApi, state, sandbox, driverOverrides = {}, raceOverrides = {}, randomFn = null) {
  stateApi._state = state;
  const run = () => engine.simulateRace({
    weather: raceOverrides.weather || 'dry',
    circuits: raceOverrides.circuit || state.season.calendar[0].circuit,
    strategy: buildSingleDriverStrategy(driverOverrides)
  });
  return randomFn ? withRandomSource(sandbox, randomFn, run) : run();
}

function getPlayerGridEntry(result) {
  return result.gridStart.find((entry) => entry.id === 'player_1');
}

function getPlayerFinalEntry(result) {
  return result.finalGrid.find((entry) => entry.id === 'player_1');
}

function getPlayerPitLaps(result, pilotName = 'Test Driver') {
  return result.events
    .filter((entry) => entry.type === 'pit' && entry.text.includes(pilotName))
    .map((entry) => entry.lap);
}

function getPlayerIncidentScore(result, pilotName = 'Test Driver') {
  const incidents = result.events.filter((entry) => entry.type === 'incident' && entry.text.includes(pilotName)).length;
  const dnf = result.playerCars.find((car) => car.pilotName === pilotName)?.isDNF ? 1 : 0;
  return incidents + dnf;
}

function getAiCarsWithPitStops(result) {
  return result.finalGrid.filter((entry) => !entry.isPlayer && (entry.pitStopsDone || 0) > 0);
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

function testPlayerPitTyreChoiceIsRespectedInWetRace(engine, stateApi, sandbox) {
  const state = createBaseState();
  const wetRace = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    tyre: 'hard',
    pitPlan: 'single',
    pitLap: 50,
    pitTyres: ['soft', 'soft'],
    interventions: [{ lapPct: 50, pitBias: 'none' }, { lapPct: 80, pitBias: 'none' }]
  }, { weather: 'wet' }, () => 0.9);

  const gridEntry = getPlayerGridEntry(wetRace);
  const finalEntry = getPlayerFinalEntry(wetRace);

  assert.strictEqual(gridEntry.tyre, 'hard', 'player starting tyre should remain the configured compound even in a wet race');
  assert.strictEqual(finalEntry.tyre, 'soft', 'player pit stop should mount the configured compound without automatic weather correction');
}

function testAiPitTyreReactionIsNotPerfect(engine) {
  const playerEntry = { id: 'player_1', isPlayer: true, strategy: {} };
  const cautiousAi = { id: 'ai_low', isPlayer: false, strategy: { aiMeta: { decisionSkill: 0.4, rainSkill: 45, tyreSkill: 48 } } };
  const sharpAi = { id: 'ai_high', isPlayer: false, strategy: { aiMeta: { decisionSkill: 0.92, rainSkill: 88, tyreSkill: 82 } } };
  const strategy = { tyre: 'medium', pitTyres: ['hard', 'soft'] };
  const uncertainForecast = { confidence: 55, windows: [{ wetProb: 35 }, { wetProb: 45 }, { wetProb: 55 }] };
  const wetForecast = { confidence: 90, windows: [{ wetProb: 88 }, { wetProb: 92 }, { wetProb: 96 }] };

  assert.strictEqual(engine.choosePitTyreForConditions(playerEntry, strategy, 0, 'wet', uncertainForecast, { adaptRoll: 0, compoundRoll: 0 }), 'hard', 'player compound choices should be respected exactly');
  assert.strictEqual(engine.choosePitTyreForConditions(cautiousAi, strategy, 0, 'wet', uncertainForecast, { adaptRoll: 0.95, compoundRoll: 0 }), 'hard', 'low-skill AI should sometimes stick with the original dry compound in surprise rain');
  assert.strictEqual(engine.choosePitTyreForConditions(sharpAi, strategy, 0, 'wet', wetForecast, { adaptRoll: 0.01, compoundRoll: 0.9 }), 'intermediate', 'high-skill AI should be able to react to rain without always choosing the perfect full wet tyre');
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

  const aiCarsWithPitStops = getAiCarsWithPitStops(result);
  const aiCarsOnNewCompound = aiCarsWithPitStops.filter((entry) => entry.strategy && entry.tyre !== entry.strategy.tyre);
  const aiPitSnapshot = result.lapSnapshots.some((snapshot) => snapshot.order.some((entry) => !entry.isPlayer && entry.pit));
  const aiPitEventsWithLoss = result.events.filter((entry) => {
    return entry.type === 'pit'
      && entry.text.includes('AI Team')
      && (entry.text.includes('pierde') || entry.text.includes('loses'));
  });

  assert.ok(aiCarsWithPitStops.length > 0, 'at least one AI car should complete a pit stop');
  assert.ok(aiCarsWithPitStops.some((entry) => (entry.pitTimeMs || 0) >= 16000), 'AI pit stops should accumulate a visible time loss');
  assert.ok(aiCarsOnNewCompound.length > 0, 'at least one AI car should pit and switch compounds');
  assert.ok(aiPitSnapshot, 'lap snapshots should flag at least one AI car as pitting');
  assert.ok(aiPitEventsWithLoss.length > 0, 'AI pit events should report the seconds lost in the stop');
}

function testPitStopAddsMeaningfulRaceTime(engine, stateApi, sandbox) {
  const state = createBaseState();
  const singleStop = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 92,
    pitTyres: ['medium', 'soft']
  }, {}, () => 0.9);

  const singleStopEntry = getPlayerFinalEntry(singleStop);
  const playerPitEvent = singleStop.events.find((entry) => entry.type === 'pit' && entry.text.includes('Test Driver'));
  const pitSnapshot = singleStop.lapSnapshots.some((snapshot) => snapshot.order.some((entry) => entry.id === 'player_1' && entry.pit));

  assert.ok(singleStopEntry.pitStopsDone === 1, 'planned single-stop race should record one pit stop');
  assert.ok(singleStopEntry.pitTimeMs >= 16000, 'pit stop should record a meaningful pit time loss');
  assert.ok(playerPitEvent && (playerPitEvent.text.includes('Pierde') || playerPitEvent.text.includes('Loses')), 'pit event log should expose the seconds lost during the stop');
  assert.ok(pitSnapshot, 'lap snapshots should flag the player car as pitting during the stop lap');
}

function testRaceStrategyDoesNotChangeGridStrength(engine, stateApi, sandbox) {
  const state = createBaseState();
  const conservative = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    aggression: 35,
    engineMode: 'eco',
    riskLevel: 25
  }, {}, () => 0.9);
  const aggressive = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    aggression: 75,
    engineMode: 'push',
    riskLevel: 70
  }, {}, () => 0.9);

  assert.strictEqual(getPlayerGridEntry(conservative).score, getPlayerGridEntry(aggressive).score, 'race strategy knobs should not alter the starting grid with the same underlying car and pilot');
}

function testPitPlanAndWindowsAffectStops(engine, stateApi, sandbox) {
  const state = createBaseState();
  state.pilots = [makePilot('pilot_1', 'Driver One')];

  const single = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 34,
    pitTyres: ['hard', 'soft']
  }, {}, () => 0.9);
  const double = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'double',
    pitLap: 34,
    pitTyres: ['hard', 'soft']
  }, {}, () => 0.9);
  const secondStopSooner = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'double',
    pitLap: 34,
    strategy: 'balanced',
    pitTyres: ['hard', 'soft'],
    interventions: [{ lapPct: 34, pitBias: 'none' }, { lapPct: 58, pitBias: 'none' }]
  }, {}, () => 0.9);
  const secondStopLater = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'double',
    pitLap: 34,
    strategy: 'balanced',
    pitTyres: ['hard', 'soft'],
    interventions: [{ lapPct: 34, pitBias: 'none' }, { lapPct: 78, pitBias: 'none' }]
  }, {}, () => 0.9);
  const stalePitLap = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 22,
    strategy: 'balanced',
    interventions: [{ lapPct: 62, pitBias: 'none' }, { lapPct: 78, pitBias: 'none' }]
  }, {}, () => 0.9);
  const scheduledPitLap = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 62,
    strategy: 'balanced',
    interventions: [{ lapPct: 62, pitBias: 'none' }, { lapPct: 78, pitBias: 'none' }]
  }, {}, () => 0.9);
  const legacyPitBias = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 30,
    strategy: 'balanced',
    interventions: [{ lapPct: 30, pitBias: 'late' }, { lapPct: 70, pitBias: 'early' }]
  }, {}, () => 0.9);
  const neutralPitBias = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 30,
    strategy: 'balanced',
    interventions: [{ lapPct: 30, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }]
  }, {}, () => 0.9);

  const singlePitLaps = getPlayerPitLaps(single, 'Driver One');
  const doublePitLaps = getPlayerPitLaps(double, 'Driver One');
  const secondSoonerPitLaps = getPlayerPitLaps(secondStopSooner, 'Driver One');
  const secondLaterPitLaps = getPlayerPitLaps(secondStopLater, 'Driver One');
  const stalePitLapStops = getPlayerPitLaps(stalePitLap, 'Driver One');
  const scheduledPitLapStops = getPlayerPitLaps(scheduledPitLap, 'Driver One');
  const legacyPitBiasStops = getPlayerPitLaps(legacyPitBias, 'Driver One');
  const neutralPitBiasStops = getPlayerPitLaps(neutralPitBias, 'Driver One');

  assert.strictEqual(singlePitLaps.length, 1, 'single pit plan should stop once');
  assert.strictEqual(doublePitLaps.length, 2, 'double pit plan should stop twice');
  assert.strictEqual(double.playerCars[0].tyre, 'soft', 'second pit tyre selection should define the final compound on a double-stop race');
  assert.ok(secondSoonerPitLaps[1] < secondLaterPitLaps[1], 'the second configured stop window should move the second stop timing on a double-stop plan');
  assert.strictEqual(stalePitLapStops[0], scheduledPitLapStops[0], 'configured stop window should override stale pitLap values');
  assert.strictEqual(legacyPitBiasStops[0], neutralPitBiasStops[0], 'legacy pit bias values should no longer shift pit timing');
}

function testLegacyAdaptivePitPlanFallsBackToSingle(engine, stateApi, sandbox) {
  const state = createBaseState();
  const legacyAdaptive = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'adaptive',
    pitLap: 46,
    pitTyres: ['hard', 'soft'],
    interventions: [{ lapPct: 46, pitBias: 'none' }, { lapPct: 72, pitBias: 'none' }]
  }, {}, () => 0.9);

  const entry = getPlayerFinalEntry(legacyAdaptive);
  assert.strictEqual(entry.strategy.pitPlan, 'single', 'legacy adaptive pit plans should normalize to single-stop');
  assert.strictEqual(entry.pitStopsDone, 1, 'legacy adaptive pit plans should produce a single stop after normalization');
}

function testAggressionAffectsRacePace(engine, stateApi, sandbox) {
  const state = createBaseState();
  const lowAggression = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    aggression: 20,
    riskLevel: 5,
    pitLap: 80
  }, {}, () => 0.9);
  const highAggression = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    aggression: 80,
    riskLevel: 5,
    pitLap: 80
  }, {}, () => 0.9);

  assert.ok(getPlayerFinalEntry(highAggression).timeMs < getPlayerFinalEntry(lowAggression).timeMs, 'higher aggression should reduce total race time when risk is held constant');
}

function testRiskLevelIncreasesIncidentExposure(engine, stateApi, sandbox) {
  let lowRiskScore = 0;
  let highRiskScore = 0;

  for (let seed = 1; seed <= 64; seed++) {
    const lowState = createBaseState();
    const highState = createBaseState();
    lowState.season.calendar[0].circuit.layout = 'high-speed';
    highState.season.calendar[0].circuit.layout = 'high-speed';

    const lowRisk = simulateSingleDriverRace(engine, stateApi, lowState, sandbox, {
      tyre: 'intermediate',
      strategy: 'conservative',
      pitPlan: 'single',
      pitLap: 85,
      riskLevel: 0,
      interventions: [{ lapPct: 85, pitBias: 'none' }, { lapPct: 95, pitBias: 'none' }],
      setup: { aeroBalance: 50, wetBias: 0 }
    }, {
      weather: 'wet',
      circuit: lowState.season.calendar[0].circuit
    }, createSeededRandom(seed));

    const highRisk = simulateSingleDriverRace(engine, stateApi, highState, sandbox, {
      tyre: 'intermediate',
      strategy: 'conservative',
      pitPlan: 'single',
      pitLap: 85,
      riskLevel: 100,
      interventions: [{ lapPct: 85, pitBias: 'none' }, { lapPct: 95, pitBias: 'none' }],
      setup: { aeroBalance: 50, wetBias: 0 }
    }, {
      weather: 'wet',
      circuit: highState.season.calendar[0].circuit
    }, createSeededRandom(seed));

    lowRiskScore += getPlayerIncidentScore(lowRisk);
    highRiskScore += getPlayerIncidentScore(highRisk);
  }

  assert.ok(highRiskScore > lowRiskScore, 'higher risk should produce more incident exposure across deterministic seeded runs');
}

function testSetupAffectsTrackAndWeatherPace(engine, stateApi, sandbox) {
  const baseState = createBaseState();
  const dryCircuit = { ...baseState.season.calendar[0].circuit, layout: 'high-speed' };
  const wetCircuit = { ...baseState.season.calendar[0].circuit, layout: 'mixed' };

  const powerBiased = simulateSingleDriverRace(engine, stateApi, cloneData(baseState), sandbox, {
    setup: { aeroBalance: 20, wetBias: 35 }
  }, { weather: 'dry', circuit: dryCircuit }, () => 0.9);
  const aeroBiased = simulateSingleDriverRace(engine, stateApi, cloneData(baseState), sandbox, {
    setup: { aeroBalance: 80, wetBias: 35 }
  }, { weather: 'dry', circuit: dryCircuit }, () => 0.9);
  const wetReady = simulateSingleDriverRace(engine, stateApi, cloneData(baseState), sandbox, {
    tyre: 'intermediate',
    setup: { aeroBalance: 50, wetBias: 80 }
  }, { weather: 'wet', circuit: wetCircuit }, () => 0.9);
  const dryReadyInWet = simulateSingleDriverRace(engine, stateApi, cloneData(baseState), sandbox, {
    tyre: 'intermediate',
    setup: { aeroBalance: 50, wetBias: 20 }
  }, { weather: 'wet', circuit: wetCircuit }, () => 0.9);

  assert.ok(getPlayerGridEntry(powerBiased).score > getPlayerGridEntry(aeroBiased).score, 'power-biased setup should improve race-start strength on high-speed tracks');
  assert.ok(getPlayerGridEntry(wetReady).score > getPlayerGridEntry(dryReadyInWet).score, 'wet-biased setup should improve race-start strength in wet conditions');
}

function testEnsureNextRaceRebalancesWetSeason(engine, stateApi) {
  const state = createBaseState();
  state.season.calendar = Array.from({ length: 8 }, (_, idx) => ({
    round: idx + 1,
    status: idx === 0 ? 'next' : 'upcoming',
    weather: 'wet',
    circuit: { name: `Track ${idx + 1}`, id: `track_${idx + 1}`, country: 'Testland', laps: 30, length: '5.0km', layout: 'mixed', weather: 75 },
    result: null,
    forecast: null
  }));

  stateApi._state = state;
  const nextRace = engine.ensureNextRaceAvailable();
  const wetRaces = state.season.calendar.filter((race) => race.weather === 'wet');

  assert.ok(nextRace, 'a next race should still be available after rebalancing weather');
  assert.ok(wetRaces.length <= 2, 'season rebalancing should cap wet races to a small minority of the calendar');
}

function testDryRaceDoesNotAlmostAlwaysFlipToRain(engine, stateApi, sandbox) {
  const state = createBaseState();
  const result = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    tyre: 'medium',
    pitPlan: 'single',
    pitLap: 80
  }, {
    weather: 'dry',
    circuit: state.season.calendar[0].circuit
  }, () => 0.01);

  const weatherChangeEvents = result.events.filter((entry) => entry.text.includes('Sudden rain hits the circuit') || entry.text.includes('Track is drying quickly'));
  assert.strictEqual(weatherChangeEvents.length, 0, 'dry races should not flip weather almost automatically under a low random seed');
}

function testRaceUsesCircuitLapCount(engine, stateApi, sandbox) {
  const state = createBaseState();
  const longCircuit = { ...state.season.calendar[0].circuit, laps: 72, layout: 'high-speed' };
  const result = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    pitPlan: 'single',
    pitLap: 50
  }, {
    weather: 'dry',
    circuit: longCircuit
  }, () => 0.9);

  assert.strictEqual(result.totalLaps, 72, 'race simulation should respect the configured circuit lap count');
  assert.strictEqual(result.lapSnapshots.length, 72, 'lap snapshots should cover every configured lap');
}

function testApplyRaceWeekendEconomyReturnsClearBreakdown(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 10000;
  stateApi._state = state;

  const summary = engine.applyRaceWeekendEconomy({ prizeMoney: 50000 });

  assert.strictEqual(summary.prizeDelta, 50000, 'race economy should add the full prize before weekly adjustments');
  assert.strictEqual(summary.weeklyNetDelta, 3000, 'weekly economy delta should be reported separately');
  assert.strictEqual(summary.totalDelta, 53000, 'total credit delta should include prize plus weekly net');
  assert.strictEqual(stateApi.getState().finances.credits, 63000, 'credits should reflect the full prize and weekly net after race finalization');
  assert.strictEqual(stateApi.getState().finances.lastRaceSettlement.prizeMoney, 50000, 'latest race settlement should preserve the credited prize amount');
}

function testApplyRaceWeekendEconomySupportsTwoCarTeamPayout(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 25000;
  stateApi._state = state;

  const summary = engine.applyRaceWeekendEconomy({
    prizeMoney: 90000,
    playerCars: [
      { pilotName: 'Driver One', position: 1, points: 25 },
      { pilotName: 'Driver Two', position: 2, points: 18 }
    ]
  });

  assert.strictEqual(summary.prizeDelta, 90000, 'combined team payout should preserve the full race prize for both player cars');
  assert.strictEqual(stateApi.getState().finances.credits, 118000, 'credits should reflect the two-car payout plus weekly net');
  assert.strictEqual(stateApi.getState().finances.lastRaceSettlement.playerCars.length, 2, 'race settlement should preserve both finishing player cars for auditability');
}

function testPositiveRaceSettlementOverridesLegacyCriticalHealth(engine, stateApi) {
  const state = createBaseState();
  state.finances.credits = 10000;
  state.finances.deficitStreak = 3;
  state.finances.criticalDeficit = true;
  stateApi._state = state;

  engine.applyRaceWeekendEconomy({ prizeMoney: 50000 });
  const overview = engine.getFinanceOverview(stateApi.getState());

  assert.strictEqual(overview.isCritical, false, 'positive total cash flow after race settlement should not remain in critical state');
  assert.strictEqual(overview.isWarning, true, 'legacy operating pressure should still surface as warning while the streak remains active');
  assert.strictEqual(overview.totalNet, 53000, 'finance overview should include both prize and weekly net in total cash flow');
}

function testRacePerformanceReportProvidesActionableSignals(engine, stateApi, sandbox) {
  const state = createBaseState();
  stateApi._state = state;

  const result = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    tyre: 'medium',
    aggression: 56,
    riskLevel: 34,
    pitPlan: 'single',
    pitLap: 44,
    setup: { aeroBalance: 58, wetBias: 46 },
    pitTyres: ['hard', 'soft']
  }, {}, () => 0.9);

  const report = engine.buildRacePerformanceReport(result, stateApi.getState());

  assert.ok(report, 'race performance report should be generated');
  assert.strictEqual(report.categories.length, 6, 'report should provide the full category set');
  assert.ok(report.driverReports.length >= 1, 'report should include at least one player driver breakdown');
  assert.ok(Array.isArray(report.teamFocusAttrs) && report.teamFocusAttrs.length >= 2, 'report should identify concrete training focus attributes');
  report.categories.forEach((category) => {
    assert.ok(category.buildingId, `category ${category.id} should point to a building improvement path`);
    assert.ok(Array.isArray(category.focusAttrKeys) && category.focusAttrKeys.length >= 1, `category ${category.id} should point to training attributes`);
    assert.ok(category.stars >= 1 && category.stars <= 5, `category ${category.id} should expose a bounded star rating`);
  });
}

function testRaceAdminReportProvidesCopyableTechnicalBreakdown(engine, stateApi, sandbox) {
  const state = createBaseState();
  stateApi._state = state;

  const result = simulateSingleDriverRace(engine, stateApi, cloneData(state), sandbox, {
    tyre: 'soft',
    aggression: 62,
    riskLevel: 48,
    pitPlan: 'double',
    pitLap: 34,
    engineMode: 'push',
    setup: { aeroBalance: 42, wetBias: 38 },
    pitTyres: ['medium', 'hard']
  }, {}, createSeededRandom(1234));

  const report = engine.buildRaceAdminReport(result, stateApi.getState());
  const archive = engine.buildRaceArchiveRecord({ ...result, adminReport: report }, { round: 1, weather: result.weather }, stateApi.getState());

  assert.ok(report, 'admin report should be generated');
  assert.ok(typeof report.text === 'string' && report.text.includes('ADMIN RACE REPORT'), 'admin report should expose a copyable text payload');
  assert.ok(report.text.includes('BALANCE FLAGS'), 'admin report should include balance warnings section');
  assert.ok(report.text.includes('MODEL COEFFICIENTS'), 'admin report should include model coefficient section');
  assert.ok(report.text.includes('DRIVER 1:'), 'admin report should include per-driver detail');
  assert.ok(Array.isArray(report.flags), 'admin report should preserve a machine-readable flag list');
  assert.ok(archive.adminReport && archive.adminReport.text === report.text, 'archive record should persist the admin report for later access');
}

function testCircuitCatalogTargetsModernGrandPrixDistances() {
  const data = loadDataModule();
  const circuits = Array.isArray(data?.CIRCUITS) ? data.CIRCUITS : [];

  assert.ok(circuits.length >= 8, 'data catalog should expose the circuit list');
  circuits.forEach((circuit) => {
    const lengthKm = Number.parseFloat(String(circuit.length || '').replace(/[^\d.]/g, ''));
    const totalDistance = Math.round(lengthKm * Number(circuit.laps || 0) * 1000) / 1000;
    assert.ok(circuit.laps >= 60 && circuit.laps <= 70, `${circuit.name} should stay between 60 and 70 laps`);
    assert.ok(totalDistance >= 300 && totalDistance <= 310, `${circuit.name} should target a 300-310 km race distance, got ${totalDistance}`);
  });
}

function testTyreModelMatchesStrategicHierarchy(engine) {
  const totalLaps = 66;

  const softLife = engine.getTyreUsefulLife('soft', 'dry', totalLaps);
  const mediumLife = engine.getTyreUsefulLife('medium', 'dry', totalLaps);
  const hardLife = engine.getTyreUsefulLife('hard', 'dry', totalLaps);
  const interWetLife = engine.getTyreUsefulLife('intermediate', 'wet', totalLaps);
  const wetWetLife = engine.getTyreUsefulLife('wet', 'wet', totalLaps);

  assert.ok(softLife < mediumLife && mediumLife < hardLife, 'dry slick durability should scale soft < medium < hard');
  assert.ok(interWetLife > wetWetLife, 'intermediate tyres should outlast full wets in a typical wet race');
  assert.ok(engine.getTyrePaceDeltaMs('soft', 'dry') < engine.getTyrePaceDeltaMs('medium', 'dry'), 'soft tyres should be faster than mediums in dry conditions');
  assert.ok(engine.getTyrePaceDeltaMs('hard', 'dry') > engine.getTyrePaceDeltaMs('medium', 'dry'), 'hard tyres should be slower than mediums in dry conditions');
  assert.ok(engine.getTyrePaceDeltaMs('intermediate', 'wet') < engine.getTyrePaceDeltaMs('wet', 'wet'), 'intermediates should usually be the quicker wet-race tyre');
  assert.ok(engine.getTyrePaceDeltaMs('hard', 'wet') > engine.getTyrePaceDeltaMs('soft', 'wet'), 'hard slicks should be the worst dry tyre on a wet track');
  assert.ok(engine.getTyreUsefulLife('wet', 'dry', totalLaps) < engine.getTyreUsefulLife('intermediate', 'dry', totalLaps), 'full wets should overheat and fade faster than intermediates on a dry track');
}

function testAiTeamColorsStayDistinctFromPlayer(engine, stateApi) {
  const state = createBaseState();
  state.team.colors.primary = '#e8292a';
  stateApi._state = state;

  const grid = engine.buildRaceGrid(state.pilots[0], 'dry', state.season.calendar[0].circuit, {
    tyre: 'medium',
    aggression: 50,
    riskLevel: 40,
    engineMode: 'normal',
    pitPlan: 'single',
    strategy: 'balanced',
    setup: { aeroBalance: 50, wetBias: 50 }
  });

  const aiTeamColors = Array.from(new Set(grid.filter((entry) => !entry.isPlayer).map((entry) => entry.color)));
  assert.ok(aiTeamColors.length >= 9, 'AI teams should expose a broad unique color palette');
  aiTeamColors.forEach((color) => {
    assert.ok(getColorDistance(color, state.team.colors.primary) >= 110, `AI team color ${color} should not be too close to the player color`);
  });
}

function run() {
  const { engine, stateApi, sandbox } = loadEngine();
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
  testPlayerPitTyreChoiceIsRespectedInWetRace(engine, stateApi, sandbox);
  testSimulateRaceProducesAiPitStops(engine, stateApi);
  testAiPitTyreReactionIsNotPerfect(engine, stateApi);
  testRaceStrategyDoesNotChangeGridStrength(engine, stateApi, sandbox);
  testPitPlanAndWindowsAffectStops(engine, stateApi, sandbox);
  testLegacyAdaptivePitPlanFallsBackToSingle(engine, stateApi, sandbox);
  testPitStopAddsMeaningfulRaceTime(engine, stateApi, sandbox);
  testAggressionAffectsRacePace(engine, stateApi, sandbox);
  testRiskLevelIncreasesIncidentExposure(engine, stateApi, sandbox);
  testSetupAffectsTrackAndWeatherPace(engine, stateApi, sandbox);
  testEnsureNextRaceRebalancesWetSeason(engine, stateApi);
  testDryRaceDoesNotAlmostAlwaysFlipToRain(engine, stateApi, sandbox);
  testRaceUsesCircuitLapCount(engine, stateApi, sandbox);
  testApplyRaceWeekendEconomyReturnsClearBreakdown(engine, stateApi);
  testApplyRaceWeekendEconomySupportsTwoCarTeamPayout(engine, stateApi);
  testPositiveRaceSettlementOverridesLegacyCriticalHealth(engine, stateApi);
  testRacePerformanceReportProvidesActionableSignals(engine, stateApi, sandbox);
  testRaceAdminReportProvidesCopyableTechnicalBreakdown(engine, stateApi, sandbox);
  testCircuitCatalogTargetsModernGrandPrixDistances();
  testTyreModelMatchesStrategicHierarchy(engine);
  testAiTeamColorsStayDistinctFromPlayer(engine, stateApi);

  console.log('✓ Core loop smoke tests passed (32 cases).');
}

run();
