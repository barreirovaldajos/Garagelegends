'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const STATE_KEY = 'garage_legends_v1';

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

function createSave(teamName, accountId, accountEmail) {
  return JSON.stringify({
    meta: {
      saveTime: Date.now(),
      accountId,
      accountEmail
    },
    team: {
      name: teamName,
      colors: { primary: '#ff0000', secondary: '#000000' },
      logo: 'T'
    },
    season: {
      phase: 'season',
      division: 8
    },
    finances: {
      credits: 1000,
      tokens: 10,
      history: []
    },
    pilots: [],
    staff: [],
    sponsors: [],
    contracts: [],
    raceResults: [],
    standings: [],
    log: [],
    achievements: [],
    randomEvents: [],
    seasonHistory: [],
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
        suggestion: { cooldownWeeks: 2, lastAppliedWeekIndex: 0, lastAppliedMode: 'balanced', stats: { shown: 0, applied: 0, ignored: 0, history: [], byMode: { conservative: { shown: 0, applied: 0, ignored: 0 }, balanced: { shown: 0, applied: 0, ignored: 0 }, aggressive: { shown: 0, applied: 0, ignored: 0 } }, pending: false, pendingMode: '', pendingWeekIndex: 0, pendingReason: '' } }
      }
    }
  });
}

function loadStateModule({ userId, email, storageSeed = {} }) {
  const srcPath = path.join(__dirname, '..', 'js', 'state.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const localStorage = createLocalStorage(storageSeed);
  let remoteClearCount = 0;

  const auth = {
    enabled: true,
    getUserId: () => userId,
    getUserEmail: () => email,
    getStorageKeyAliases: () => [userId, `email_${String(email).toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`],
    getStorageKeySuffix: () => userId,
    getRemoteSaveInfo: () => ({ snapshot: null, updatedAt: 0 }),
    saveRemoteStateSnapshot: () => Promise.resolve(),
    clearRemoteStateSnapshot: () => {
      remoteClearCount += 1;
      return Promise.resolve();
    }
  };

  const sandbox = {
    console,
    Date,
    JSON,
    localStorage,
    window: { GL_AUTH: auth },
    GL_AUTH: auth
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'state.js' });

  return {
    state: sandbox.window.GL_STATE,
    localStorage,
    getRemoteClearCount: () => remoteClearCount
  };
}

async function testLegacySaveIgnoredAcrossAccounts() {
  const { state } = loadStateModule({
    userId: 'user_a',
    email: 'a@example.com',
    storageSeed: {
      [STATE_KEY]: createSave('Wrong Team', 'user_b', 'b@example.com')
    }
  });

  const loaded = state.loadState();
  assert.strictEqual(loaded, false, 'legacy save from another account should not be loaded');
  assert.strictEqual(state.getState().team.name, '', 'state should fall back to default onboarding state');
}

async function testResetOnlyClearsCurrentAccountKeys() {
  const currentKey = `${STATE_KEY}_user_a`;
  const otherKey = `${STATE_KEY}_user_b`;
  const { state, localStorage, getRemoteClearCount } = loadStateModule({
    userId: 'user_a',
    email: 'a@example.com',
    storageSeed: {
      [currentKey]: createSave('Current Team', 'user_a', 'a@example.com'),
      [otherKey]: createSave('Other Team', 'user_b', 'b@example.com'),
      [STATE_KEY]: createSave('Legacy Current', 'user_a', 'a@example.com')
    }
  });

  state.loadState();
  await state.resetState();

  assert.strictEqual(localStorage.getItem(currentKey), null, 'current account scoped key should be removed on reset');
  assert.strictEqual(localStorage.getItem(STATE_KEY), null, 'legacy key should be removed on reset');
  assert.ok(localStorage.getItem(otherKey), 'other account scoped data must remain untouched');
  assert.strictEqual(getRemoteClearCount(), 1, 'remote snapshot should be cleared once for current account');
  assert.strictEqual(state.hasOnboarded(), false, 'reset account should return to onboarding state');
  assert.strictEqual(state.getState().team.name, '', 'team identity should be cleared on reset');
  assert.strictEqual(state.getState().season.phase, 'onboarding', 'reset account should require onboarding again');
}

async function testSaveStateAnnotatesCurrentAccount() {
  const currentKey = `${STATE_KEY}_user_a`;
  const { state, localStorage } = loadStateModule({
    userId: 'user_a',
    email: 'a@example.com'
  });

  state.loadState();
  const current = state.getState();
  current.team.name = 'Scoped Team';
  current.season.phase = 'season';
  state.saveState();

  const saved = JSON.parse(localStorage.getItem(currentKey));
  assert.strictEqual(saved.meta.accountId, 'user_a', 'saved state should store current account id');
  assert.strictEqual(saved.meta.accountEmail, 'a@example.com', 'saved state should store current account email');
}

async function run() {
  await testLegacySaveIgnoredAcrossAccounts();
  await testResetOnlyClearsCurrentAccountKeys();
  await testSaveStateAnnotatesCurrentAccount();
  console.log('✓ Account/state smoke tests passed (3 cases).');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});