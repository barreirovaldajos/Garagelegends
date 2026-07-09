'use strict';

// Unit test for markInactivePlayers (functions/lib/inactivity.js).
// Runs with the built-in Node test runner — no firebase-admin, no emulator, no Java:
//   node --test functions/test/    (or: npm test, from functions/)
//
// A mock Firestore replicates exactly the API surface the function uses and filters
// seeded strategies for real, so the parallel/batched rewrite is exercised end-to-end.

const { test } = require('node:test');
const assert = require('node:assert');
const { markInactivePlayers } = require('../lib/inactivity.js');

// --- Mock Firestore -------------------------------------------------------
// seed = {
//   divisions:  [{ id, phase, lastRaceRound, slots: { '0': {type, userId}, ... } }],
//   strategies: { [divId]: [{ userId, raceRound }, ...] }
// }
function makeDb(seed) {
  const commits = []; // array of batches; each batch is an array of updated userIds

  function stratQuery(divId, filters) {
    return {
      where(field, op, val) { return stratQuery(divId, filters.concat([{ field, op, val }])); },
      async get() {
        let rows = seed.strategies[divId] || [];
        for (const f of filters) {
          rows = rows.filter((r) => {
            if (f.op === '==') return r[f.field] === f.val;
            if (f.op === '>=') return r[f.field] >= f.val;
            return true;
          });
        }
        return { empty: rows.length === 0, docs: rows.map((r) => ({ data: () => r })) };
      },
    };
  }

  return {
    collection(name) {
      if (name === 'divisions') {
        return {
          where(field, op, val) {
            return {
              async get() {
                const docs = seed.divisions
                  .filter((d) => (op === '==' ? d[field] === val : true))
                  .map((d) => ({
                    id: d.id,
                    data: () => d,
                    ref: {
                      collection: (c) => {
                        assert.strictEqual(c, 'strategies');
                        return stratQuery(d.id, []);
                      },
                    },
                  }));
                return { docs };
              },
            };
          },
        };
      }
      if (name === 'profiles') {
        return { doc: (userId) => ({ __profileId: userId }) };
      }
      throw new Error('unexpected collection: ' + name);
    },
    batch() {
      const ops = [];
      return {
        update(ref, obj) {
          assert.deepStrictEqual(obj, { 'mp.status': 'inactive' });
          ops.push(ref.__profileId);
        },
        async commit() { commits.push(ops.slice()); },
      };
    },
    __commits: commits,
  };
}

const markedIds = (db) => db.__commits.flat().sort();

test('marks players with no recent strategy as inactive', async () => {
  const db = makeDb({
    divisions: [{
      id: 'D8_1', phase: 'season', lastRaceRound: 5,
      slots: { 0: { type: 'player', userId: 'active1' }, 1: { type: 'player', userId: 'idle1' } },
    }],
    strategies: {
      D8_1: [{ userId: 'active1', raceRound: 5 }], // idle1 has none
    },
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, 1);
  assert.deepStrictEqual(markedIds(db), ['idle1']);
});

test('recent strategy = raceRound >= lastRound-1 keeps a player active', async () => {
  const db = makeDb({
    divisions: [{
      id: 'D8_1', phase: 'season', lastRaceRound: 5,
      slots: { 0: { type: 'player', userId: 'edge' }, 1: { type: 'player', userId: 'stale' } },
    }],
    strategies: {
      D8_1: [
        { userId: 'edge', raceRound: 4 },  // 4 >= 5-1 -> active
        { userId: 'stale', raceRound: 3 }, // 3 <  5-1 -> inactive
      ],
    },
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, 1);
  assert.deepStrictEqual(markedIds(db), ['stale']);
});

test('divisions with fewer than 2 races are skipped entirely', async () => {
  const db = makeDb({
    divisions: [{
      id: 'D8_new', phase: 'season', lastRaceRound: 1,
      slots: { 0: { type: 'player', userId: 'p' } },
    }],
    strategies: {},
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, 0);
  assert.deepStrictEqual(db.__commits, []);
});

test('bot slots and slots without userId are ignored', async () => {
  const db = makeDb({
    divisions: [{
      id: 'D8_1', phase: 'season', lastRaceRound: 3,
      slots: {
        0: { type: 'bot', userId: 'shouldIgnore' },
        1: { type: 'player' },                 // no userId
        2: { type: 'player', userId: 'real' }, // no strategy -> inactive
      },
    }],
    strategies: {},
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, 1);
  assert.deepStrictEqual(markedIds(db), ['real']);
});

test('non-season divisions are excluded by the query', async () => {
  const db = makeDb({
    divisions: [{
      id: 'D8_off', phase: 'offseason', lastRaceRound: 9,
      slots: { 0: { type: 'player', userId: 'p' } },
    }],
    strategies: {},
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, 0);
});

test('batches writes in chunks of 500 across many players and reads in bounded batches', async () => {
  // 501 idle players across the read-batch boundary (READ_BATCH=50) and the
  // write-batch boundary (500). All should be marked, split into 2 commits.
  const N = 501;
  const slots = {};
  for (let i = 0; i < N; i++) slots[i] = { type: 'player', userId: 'u' + i };
  const db = makeDb({
    divisions: [{ id: 'D1_1', phase: 'season', lastRaceRound: 4, slots }],
    strategies: { D1_1: [] }, // nobody submitted -> all inactive
  });
  const count = await markInactivePlayers(db, null);
  assert.strictEqual(count, N);
  assert.strictEqual(db.__commits.length, 2);          // 500 + 1
  assert.strictEqual(db.__commits[0].length, 500);
  assert.strictEqual(db.__commits[1].length, 1);
  assert.strictEqual(new Set(markedIds(db)).size, N);  // no dupes, all present
});
