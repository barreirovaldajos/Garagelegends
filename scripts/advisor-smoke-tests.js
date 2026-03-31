'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadDashboard() {
  const srcPath = path.join(__dirname, '..', 'js', 'dashboard.js');
  const src = fs.readFileSync(srcPath, 'utf8');

  const sandbox = {
    console,
    setInterval: () => 0,
    clearInterval: () => {},
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute: () => {}, style: {}, select: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
      execCommand: () => true
    },
    navigator: {},
    __: (k) => k,
    GL_UI: {
      toast: () => {},
      confirm: async () => true
    },
    GL_ENGINE: {
      getAdvisorTelemetry: (state) => state.advisor.telemetry,
      checkFacilityTimers: () => {},
      updateConstructionQueue: () => false,
      getCampaignStatus: () => null
    },
    GL_STATE: {
      _state: null,
      getState() { return this._state; },
      saveState() {},
      getMyStanding: () => ({ position: 1, points: 0 }),
      popRandomEvent: () => null
    },
    window: {}
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'dashboard.js' });
  return { dashboard: sandbox.window.GL_DASHBOARD, sandbox };
}

function createBaseState() {
  return {
    season: { year: 1, week: 1, calendar: [] },
    team: { name: 'Test', colors: { primary: '#fff' }, logo: 'T', fans: 0, reputation: 100 },
    finances: { credits: 0, tokens: 0, weeklyIncome: 0, weeklyExpenses: 0 },
    facilities: [],
    standings: [],
    pilots: [],
    sponsors: [],
    advisor: {
      mode: 'balanced',
      recent: [],
      layoutWeatherStats: {},
      practice: { sessions: 0, lastTs: 0 }
    }
  };
}

function testWeekIndex(dashboard) {
  const s = createBaseState();
  s.season.year = 2;
  s.season.week = 3;
  assert.strictEqual(dashboard.getCurrentWeekIndex(s), 55, 'week index should map year/week to linear index');
}

function testCooldown(dashboard) {
  const s = createBaseState();
  const meta = dashboard.ensureAdvisorSuggestionMeta(s);
  meta.cooldownWeeks = 3;
  meta.lastAppliedWeekIndex = 8;
  s.season.week = 10;
  const info = dashboard.getAdvisorSuggestionCooldownInfo(s);
  assert.strictEqual(info.active, true, 'cooldown should be active');
  assert.strictEqual(info.weeksLeft, 1, 'cooldown weeks left should be 1');
}

function testPolicyLock(dashboard) {
  const s = createBaseState();
  const meta = dashboard.ensureAdvisorSuggestionMeta(s);
  meta.policyLockWeeks = 2;
  meta.lastPolicyChangeWeekIndex = 4;
  s.season.week = 5;
  const locked = dashboard.getAdvisorPolicyLockInfo(s);
  assert.strictEqual(locked.allowed, false, 'policy lock should block changes');
  assert.strictEqual(locked.weeksLeft, 1, 'policy lock should report 1 week left');

  s.season.week = 6;
  const unlocked = dashboard.getAdvisorPolicyLockInfo(s);
  assert.strictEqual(unlocked.allowed, true, 'policy lock should release after window');
  assert.strictEqual(unlocked.weeksLeft, 0, 'policy lock should have 0 weeks left when unlocked');
}

function testWindowComparison(dashboard) {
  const s = createBaseState();
  const stats = dashboard.ensureAdvisorSuggestionMeta(s).stats;
  stats.history = [
    { action: 'shown', reason: 'performance' },
    { action: 'applied', reason: 'performance' },
    { action: 'shown', reason: 'adoption' },
    { action: 'ignored', reason: 'adoption' },
    { action: 'shown', reason: 'performance' },
    { action: 'applied', reason: 'performance' },
    { action: 'shown', reason: 'adoption' },
    { action: 'applied', reason: 'adoption' }
  ];

  const cmp = dashboard.getAdvisorWindowComparison(stats, 5);
  assert.strictEqual(cmp.current.shown, 2, 'current window shown count mismatch');
  assert.strictEqual(cmp.current.applied, 2, 'current window applied count mismatch');
  assert.strictEqual(cmp.current.rate, 100, 'current acceptance should be 100%');
  assert.strictEqual(cmp.hasPrevious, true, 'previous window should exist');
}

function testDataHealth(dashboard) {
  const telemetry = {
    byMode: {
      conservative: { races: 4 },
      balanced: { races: 5 },
      aggressive: { races: 4 }
    }
  };
  const stats = { shown: 12, applied: 6, ignored: 5 };
  const health = dashboard.getAdvisorDataHealth(telemetry, stats);
  assert.strictEqual(health.statusKey, 'dash_advisor_data_health_good', 'data health should be healthy with enough samples');
}

function testCooldownNoActiveData(dashboard) {
  const s = createBaseState();
  const meta = dashboard.ensureAdvisorSuggestionMeta(s);
  meta.cooldownWeeks = 2;
  meta.lastAppliedWeekIndex = 0;
  const info = dashboard.getAdvisorSuggestionCooldownInfo(s);
  assert.strictEqual(info.active, false, 'cooldown should not be active if never applied');
  assert.strictEqual(info.weeksLeft, 0, 'no weeks left if cooldown never started');
}

function testPolicyLockDisabled(dashboard) {
  const s = createBaseState();
  const meta = dashboard.ensureAdvisorSuggestionMeta(s);
  meta.policyLockWeeks = 1;
  meta.lastPolicyChangeWeekIndex = 0;
  const locked = dashboard.getAdvisorPolicyLockInfo(s);
  assert.strictEqual(locked.allowed, true, 'lock should allow when never changed');
  assert.strictEqual(locked.active, false, 'lock should not be active if never changed');
}

function testWindowComparisonNoPrevious(dashboard) {
  const s = createBaseState();
  const stats = dashboard.ensureAdvisorSuggestionMeta(s).stats;
  stats.history = [
    { action: 'shown', reason: 'performance' },
    { action: 'applied', reason: 'performance' }
  ];
  const cmp = dashboard.getAdvisorWindowComparison(stats, 10);
  assert.strictEqual(cmp.hasPrevious, false, 'should detect no previous window');
  assert.strictEqual(cmp.deltaRate, null, 'delta rate should be null without previous');
}

function testDataHealthLow(dashboard) {
  const telemetry = {
    byMode: {
      conservative: { races: 0 },
      balanced: { races: 2 },
      aggressive: { races: 1 }
    }
  };
  const stats = { shown: 0, applied: 0, ignored: 0 };
  const health = dashboard.getAdvisorDataHealth(telemetry, stats);
  assert.strictEqual(health.statusKey, 'dash_advisor_data_health_low', 'data health should be low with minimal samples');
}

function testIgnoreReasonBreakdown(dashboard) {
  const s = createBaseState();
  const stats = dashboard.ensureAdvisorSuggestionMeta(s).stats;
  stats.history = [
    { action: 'ignored', ignoreReason: 'expired' },
    { action: 'ignored', ignoreReason: 'expired' },
    { action: 'ignored', ignoreReason: 'override' }
  ];
  const breakdown = dashboard.getAdvisorIgnoreReasonBreakdown(stats, 10);
  assert.strictEqual(breakdown.total, 3, 'should count 3 ignored');
  assert.strictEqual(breakdown.expired, 2, 'should count 2 expiries');
  assert.strictEqual(breakdown.override, 1, 'should count 1 override');
}

function testAnalysisWindowValidation(dashboard, sandbox) {
  const s = createBaseState();
  sandbox.GL_STATE._state = s;
  const meta = dashboard.ensureAdvisorSuggestionMeta(s);
  meta.analysisWindow = 99;
  dashboard.setAdvisorAnalysisWindow(99);
  assert.strictEqual(meta.analysisWindow, 10, 'invalid window should default to 10');

  dashboard.setAdvisorAnalysisWindow(5);
  assert.strictEqual(meta.analysisWindow, 5, 'window 5 should be accepted');
  dashboard.setAdvisorAnalysisWindow(20);
  assert.strictEqual(meta.analysisWindow, 20, 'window 20 should be accepted');
}

function testRefreshWithoutCheckFacilityTimers(dashboard, sandbox) {
  const s = createBaseState();
  sandbox.GL_STATE._state = s;
  const previous = sandbox.GL_ENGINE.checkFacilityTimers;
  delete sandbox.GL_ENGINE.checkFacilityTimers;
  sandbox.GL_ENGINE.updateConstructionQueue = () => false;

  assert.doesNotThrow(() => dashboard.refresh(), 'dashboard refresh should not crash if checkFacilityTimers is missing');

  if (previous) sandbox.GL_ENGINE.checkFacilityTimers = previous;
}

function run() {
  const { dashboard, sandbox } = loadDashboard();
  if (!dashboard) throw new Error('Could not load GL_DASHBOARD from dashboard.js');

  testWeekIndex(dashboard);
  testCooldown(dashboard);
  testPolicyLock(dashboard);
  testWindowComparison(dashboard);
  testDataHealth(dashboard);
  testCooldownNoActiveData(dashboard);
  testPolicyLockDisabled(dashboard);
  testWindowComparisonNoPrevious(dashboard);
  testDataHealthLow(dashboard);
  testIgnoreReasonBreakdown(dashboard);
  testAnalysisWindowValidation(dashboard, sandbox);
  testRefreshWithoutCheckFacilityTimers(dashboard, sandbox);

  console.log('✓ Advisor smoke tests passed (14 cases).');
}

run();
