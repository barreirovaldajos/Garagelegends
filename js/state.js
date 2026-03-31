// ===== STATE.JS – Central game state + persistence =====
'use strict';

const STATE_KEY = 'garage_legends_v1';

const DEFAULT_STATE = {
  // MMO/social hooks
  faction: {
    engineSupplier: '',
    joinedDate: null,
    helpRequests: { sent: [], received: [] },
    contributedEvents: []
  },
  meta: { version: 1, created: null, saveTime: null },
  team: {
    name: '', country: '', countryFlag: '',
    colors: { primary: '#e8292a', secondary: '#0a0b0f' },
    logo: '🏎️', philosophy: '', origin: '',
    reputation: 100, fans: 500,
    engineSupplier: '' // Cosmos, Zenith, AeroV, Titan, Vulcan
  },
  finances: {
    credits: 0,
    tokens: 20,
    weeklyIncome: 0,
    weeklyExpenses: 0,
    history: []   // [{week, income, expenses, net}]
  },
  season: {
    year: 1,
    week: 1,
    raceIndex: 0,
    totalRaces: 8,
    division: 8,
    phase: 'season', // onboarding | season | offseason
    lastSummary: null,
    lastSummaryPending: false
  },
  seasonHistory: [], // [{year, division, finishPosition, points, wins, result, bonusCredits, ts}]
  standings: [],    // [{id, name, color, points, wins, position, bestResult}]
  pilots: [],       // see data.js for shape
  staff: [],        // see data.js for shape
  academyQueue: [], // [{ pilotId, trainingType, startTime, duration, targetAttr }]
  scoutingPool: [], // [{ id, name, attrs, ... }]
  car: {
    name: 'GL-001',
    components: {
      engine:       { level: 1, score: 42 },
      chassis:      { level: 1, score: 38 },
      aero:         { level: 1, score: 35 },
      tyreManage:   { level: 1, score: 40 },
      brakes:       { level: 1, score: 45 },
      gearbox:      { level: 1, score: 43 },
      reliability:  { level: 1, score: 55 },
      efficiency:   { level: 1, score: 48 }
    },
    rnd: { points: 0, active: null, queue: [] }
  },
  hq: {
    wind_tunnel: 1, // Aero
    rnd: 1,         // Engine
    factory: 1,     // Reliability / Parts
    academy: 1,     // Pilot XP
    admin: 1        // Money / Sponsors
  },
  construction: {
    active: false,
    buildingId: null, // 'wind_tunnel', 'rnd', etc.
    startTime: 0,
    durationMs: 0,
    targetLevel: 0
  },
  facilities: [],   // Legacy, kept for fallback
  sponsors: [],     // see data.js for shape
  contracts: [],    // optional agreements with weekly cost / duration
  raceResults: [],  // [{round, circuit, position, points, events[]}]
  advisor: {
    mode: 'balanced', // conservative | balanced | aggressive
    recent: [], // [{ ts, layout, weather, position, points, improvement, strategy }]
    layoutWeatherStats: {}, // key: layout_weather -> aggregates
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
  randomEvents: [], // pending events
  log: [],          // activity log [{text, type, week}]
  achievements: [], // unlocked achievement ids
  campaign: {
    phase: 'phase1',
    activeObjectiveId: 'phase1_survive_prove',
    history: []
  },
  objectives: [],   // {id, text, target, current, reward}
  settings: {
    mode: 'assisted', // assisted | expert
    notifications: true
  }
};

let _state = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      _state = JSON.parse(raw);
      // Migración engineSupplier a id minúsculas
      if (_state && _state.team && _state.team.engineSupplier) {
        _state.team.engineSupplier = (_state.team.engineSupplier + '').toLowerCase();
      }

      // Defensive migrations for legacy / partially corrupted saves.
      if (!_state.team) _state.team = deepClone(DEFAULT_STATE.team);
      if (!_state.team.colors) _state.team.colors = deepClone(DEFAULT_STATE.team.colors);
      if (typeof _state.team.colors.primary !== 'string' || !_state.team.colors.primary) {
        _state.team.colors.primary = DEFAULT_STATE.team.colors.primary;
      }
      if (typeof _state.team.colors.secondary !== 'string' || !_state.team.colors.secondary) {
        _state.team.colors.secondary = DEFAULT_STATE.team.colors.secondary;
      }
      if (typeof _state.team.logo !== 'string' || !_state.team.logo) {
        _state.team.logo = DEFAULT_STATE.team.logo;
      }
      if (!_state.meta) _state.meta = deepClone(DEFAULT_STATE.meta);
      
      // Migrations / Fallbacks
      if (typeof _state.team.engineSupplier === 'undefined') _state.team.engineSupplier = '';
      if (!_state.finances) _state.finances = { credits: 0, tokens: 20, weeklyIncome: 0, weeklyExpenses: 0, history: [] };
      if (typeof _state.finances.deficitStreak !== 'number') _state.finances.deficitStreak = 0;
      if (typeof _state.finances.criticalDeficit !== 'boolean') _state.finances.criticalDeficit = false;
      if (typeof _state.finances.lastNet !== 'number') _state.finances.lastNet = 0;
      if (!_state.season) _state.season = { year: 1, week: 1, raceIndex: 0, totalRaces: 8, division: 8, phase: 'season', lastSummary: null, lastSummaryPending: false };
      if (typeof _state.season.lastSummaryPending !== 'boolean') _state.season.lastSummaryPending = false;
      if (typeof _state.season.lastSummary === 'undefined') _state.season.lastSummary = null;
      if (!_state.hq) _state.hq = { wind_tunnel: 1, rnd: 1, factory: 1, academy: 1, admin: 1 };
      if (!_state.construction) _state.construction = { active: false, buildingId: null, startTime: 0, durationMs: 0, targetLevel: 0 };
      if (!Array.isArray(_state.sponsors)) _state.sponsors = [];
      if (!Array.isArray(_state.contracts)) _state.contracts = [];
      if (!Array.isArray(_state.seasonHistory)) _state.seasonHistory = [];
      if (!_state.campaign) _state.campaign = { phase: 'phase1', activeObjectiveId: 'phase1_survive_prove', history: [] };
      if (!Array.isArray(_state.campaign.history)) _state.campaign.history = [];
      if (typeof _state.campaign.phase !== 'string') _state.campaign.phase = 'phase1';
      if (typeof _state.campaign.activeObjectiveId !== 'string' || !_state.campaign.activeObjectiveId) {
        _state.campaign.activeObjectiveId = 'phase1_survive_prove';
      }
      if (!_state.advisor) {
        _state.advisor = {
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
        };
      }
      if (!_state.advisor.mode) _state.advisor.mode = 'balanced';
      if (!_state.advisor.telemetry) {
        _state.advisor.telemetry = {
          byMode: {
            conservative: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
            balanced: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
            aggressive: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 }
          },
          last: { mode: _state.advisor.mode || 'balanced', source: 'manual', ts: 0 },
          suggestion: {
            cooldownWeeks: 2,
            lastAppliedWeekIndex: 0,
            lastAppliedMode: _state.advisor.mode || 'balanced',
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
        };
      }
      if (!_state.advisor.telemetry.suggestion) {
        _state.advisor.telemetry.suggestion = {
          cooldownWeeks: 2,
          lastAppliedWeekIndex: 0,
          lastAppliedMode: _state.advisor.mode || 'balanced',
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
        };
      }
      if (!_state.advisor.telemetry.suggestion.stats) {
        _state.advisor.telemetry.suggestion.stats = {
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
        };
      }
      if (!_state.advisor.telemetry.suggestion.stats.byMode) {
        _state.advisor.telemetry.suggestion.stats.byMode = {
          conservative: { shown: 0, applied: 0, ignored: 0 },
          balanced: { shown: 0, applied: 0, ignored: 0 },
          aggressive: { shown: 0, applied: 0, ignored: 0 }
        };
      }
      if (!Array.isArray(_state.advisor.telemetry.suggestion.stats.history)) {
        _state.advisor.telemetry.suggestion.stats.history = [];
      }
      if (typeof _state.advisor.telemetry.suggestion.stats.pendingReason !== 'string') {
        _state.advisor.telemetry.suggestion.stats.pendingReason = '';
      }

      // --- Migración de estados legacy de carrera a enums centralizados ---
      if (_state.season && Array.isArray(_state.season.calendar)) {
        if (typeof window !== 'undefined' && typeof window.RACE_STATUS === 'undefined') {
          try { window.RACE_STATUS = require('./game_constants.js').RACE_STATUS; } catch(e) {}
        }
        const RACE_STATUS_ENUM = (typeof window !== 'undefined' && window.RACE_STATUS) ? window.RACE_STATUS : { UPCOMING: 'upcoming', NEXT: 'next', COMPLETED: 'completed' };
        _state.season.calendar = _state.season.calendar.map(race => ({
          ...race,
          status: (race.status === 'done' || race.status === 'finished' || race.status === 'completed') ? RACE_STATUS_ENUM.COMPLETED :
                  (race.status === 'next') ? RACE_STATUS_ENUM.NEXT :
                  RACE_STATUS_ENUM.UPCOMING
        }));
      }
      return true;
    }
  } catch(e) { console.warn('State load error', e); }
  _state = deepClone(DEFAULT_STATE);
  return false;
}

function saveState() {
  try {
    if (_state) {
      _state.meta.saveTime = Date.now();
      localStorage.setItem(STATE_KEY, JSON.stringify(_state));
    }
  } catch(e) { console.warn('State save error', e); }
}

function getState() { return _state; }

function setState(updater) {
  if (typeof updater === 'function') {
    updater(_state);
  } else {
    Object.assign(_state, updater);
  }
  saveState();
}

function resetState() {
  _state = deepClone(DEFAULT_STATE);
  _state.meta.created = Date.now();
  localStorage.removeItem(STATE_KEY);
}

function hasOnboarded() {
  return _state && _state.team.name !== '' && _state.season.phase !== 'onboarding';
}

// Convenience getters
function getCredits()  { return _state.finances.credits; }
function getTokens()   { return _state.finances.tokens; }
function getDivision() { return _state.season.division; }
function getWeek()     { return _state.season.week; }
function getYear()     { return _state.season.year; }
function getPilots()   { return _state.pilots; }
function getStaff()    { return _state.staff; }
function getFacilities() { return _state.facilities; }
function getSponsors() { return _state.sponsors; }
function getStandings() { return _state.standings; }
function getMyStanding() {
  return _state.standings.find(s => s.id === 'player') || { points: 0, position: 1 };
}
function getCar() { return _state.car; }
function getHQ() { return _state.hq; }
function getConstruction() { return _state.construction; }
function getRaceResults() { return _state.raceResults; }

function addCredits(amount) {
  _state.finances.credits = Math.max(0, (_state.finances.credits || 0) + amount);
  saveState();
}
function spendCredits(amount) {
  if (_state.finances.credits < amount) return false;
  _state.finances.credits -= amount;
  saveState();
  return true;
}
function addTokens(n) {
  _state.finances.tokens = (_state.finances.tokens || 0) + n;
  saveState();
}
function spendTokens(n) {
  if (_state.finances.tokens < n) return false;
  _state.finances.tokens -= n;
  saveState();
  return true;
}

function addLog(text, type = 'info') {
  _state.log.unshift({ text, type, week: _state.season.week, ts: Date.now() });
  if (_state.log.length > 100) _state.log.pop();
  saveState();
}

function addRandomEvent(ev) {
  _state.randomEvents.push(ev);
  saveState();
}

function popRandomEvent() {
  return _state.randomEvents.shift() || null;
}

// Hooks para módulos externos
window.GL_STATE = {
  loadState, saveState, getState, setState, resetState, hasOnboarded,
  getCredits, getTokens, getDivision, getWeek, getYear,
  getPilots, getStaff, getFacilities, getSponsors, getStandings,
  getMyStanding, getCar, getHQ, getConstruction, getRaceResults,
  addCredits, spendCredits, addTokens, spendTokens,
  addLog, addRandomEvent, popRandomEvent, deepClone,
  // Academy/Scouting
  getAcademyQueue: () => _state.academyQueue,
  setAcademyQueue: (q) => { _state.academyQueue = q; saveState(); },
  getScoutingPool: () => _state.scoutingPool,
  setScoutingPool: (pool) => { _state.scoutingPool = pool; saveState(); },
  // MMO/social
  getFaction: () => _state.faction,
  setFaction: (f) => { _state.faction = f; saveState(); },
  getHelpRequests: () => _state.faction.helpRequests,
  addHelpRequest: (req) => { _state.faction.helpRequests.sent.push(req); saveState(); },
  receiveHelpRequest: (req) => { _state.faction.helpRequests.received.push(req); saveState(); },
  getContributedEvents: () => _state.faction.contributedEvents,
  addContributedEvent: (ev) => { _state.faction.contributedEvents.push(ev); saveState(); },
  // Research/I+D
  getResearch: () => _state.car.rnd,
  setResearch: (rnd) => { _state.car.rnd = rnd; saveState(); }
};
