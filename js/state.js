// ===== STATE.JS – Central game state + persistence =====
'use strict';

const STATE_KEY = 'garage_legends_v1';

const DEFAULT_STATE = {
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
    phase: 'season' // onboarding | season | offseason
  },
  standings: [],    // [{id, name, color, points, wins, position, bestResult}]
  pilots: [],       // see data.js for shape
  staff: [],        // see data.js for shape
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
  raceResults: [],  // [{round, circuit, position, points, events[]}]
  randomEvents: [], // pending events
  log: [],          // activity log [{text, type, week}]
  achievements: [], // unlocked achievement ids
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
      
      // Migrations / Fallbacks
      if (typeof _state.team.engineSupplier === 'undefined') _state.team.engineSupplier = '';
      if (!_state.hq) _state.hq = { wind_tunnel: 1, rnd: 1, factory: 1, academy: 1, admin: 1 };
      if (!_state.construction) _state.construction = { active: false, buildingId: null, startTime: 0, durationMs: 0, targetLevel: 0 };
      
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

window.GL_STATE = {
  loadState, saveState, getState, setState, resetState, hasOnboarded,
  getCredits, getTokens, getDivision, getWeek, getYear,
  getPilots, getStaff, getFacilities, getSponsors, getStandings,
  getMyStanding, getCar, getHQ, getConstruction, getRaceResults,
  addCredits, spendCredits, addTokens, spendTokens,
  addLog, addRandomEvent, popRandomEvent, deepClone
};
