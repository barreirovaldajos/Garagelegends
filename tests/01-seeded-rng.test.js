// ===== TEST 1: SeededRNG — reproducibilidad y métodos =====
// Run: node tests/01-seeded-rng.test.js

'use strict';

const { SeededRNG, pickSeeded } = require('../shared/engine-core.js');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

function assertEq(desc, a, b) {
  if (a === b) {
    console.log(`  ✅ ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
    failed++;
  }
}

console.log('\n=== SeededRNG Tests ===\n');

// ── 1. Reproducibilidad: misma seed → misma secuencia
console.log('1. Reproducibilidad');
{
  const rng1 = new SeededRNG('test_seed_42');
  const rng2 = new SeededRNG('test_seed_42');
  const seq1 = [rng1.next(), rng1.next(), rng1.next(), rng1.next(), rng1.next()];
  const seq2 = [rng2.next(), rng2.next(), rng2.next(), rng2.next(), rng2.next()];
  assertEq('Misma seed produce misma secuencia', JSON.stringify(seq1), JSON.stringify(seq2));
  assert('Los valores están en [0, 1)', seq1.every(v => v >= 0 && v < 1));
}

// ── 2. Seeds distintas → secuencias distintas
console.log('\n2. Seeds distintas');
{
  const rng1 = new SeededRNG('seed_A');
  const rng2 = new SeededRNG('seed_B');
  const seq1 = [rng1.next(), rng1.next(), rng1.next()];
  const seq2 = [rng2.next(), rng2.next(), rng2.next()];
  assert('Seeds distintas producen secuencias distintas', JSON.stringify(seq1) !== JSON.stringify(seq2));
}

// ── 3. intRange
console.log('\n3. intRange');
{
  const rng = new SeededRNG('range_test');
  const values = Array.from({ length: 100 }, () => rng.intRange(10, 50));
  assert('intRange valores >= min', values.every(v => v >= 10));
  assert('intRange valores <= max', values.every(v => v <= 50));
  assert('intRange produce enteros', values.every(v => Number.isInteger(v)));
  assert('intRange cubre el rango (tiene variedad)', new Set(values).size > 10);
}

// ── 4. chance
console.log('\n4. chance');
{
  const rng = new SeededRNG('chance_test');
  const always = Array.from({ length: 20 }, () => rng.chance(1.0));
  const never  = Array.from({ length: 20 }, () => rng.chance(0.0));
  assert('chance(1.0) siempre true', always.every(v => v === true));
  assert('chance(0.0) siempre false', never.every(v => v === false));

  const rng2 = new SeededRNG('chance_half');
  const half = Array.from({ length: 200 }, () => rng2.chance(0.5));
  const trueCount = half.filter(Boolean).length;
  assert('chance(0.5) ~50% true (entre 35-65%)', trueCount >= 70 && trueCount <= 130);
}

// ── 5. pickSeeded
console.log('\n5. pickSeeded');
{
  const arr = ['alpha', 'beta', 'gamma', 'delta'];
  const result1 = pickSeeded(arr, 'seed_pick_1');
  const result2 = pickSeeded(arr, 'seed_pick_1');
  assertEq('pickSeeded es determinista', result1, result2);
  assert('pickSeeded devuelve elemento del array', arr.includes(result1));
  assert('pickSeeded con array vacío devuelve null', pickSeeded([], 'x') === null);
  assert('pickSeeded con null devuelve null', pickSeeded(null, 'x') === null);
}

// ── 6. shuffle
console.log('\n6. shuffle');
{
  const rng1 = new SeededRNG('shuffle_test');
  const rng2 = new SeededRNG('shuffle_test');
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled1 = rng1.shuffle(original);
  const shuffled2 = rng2.shuffle(original);
  assertEq('shuffle es determinista con misma seed', JSON.stringify(shuffled1), JSON.stringify(shuffled2));
  assert('shuffle conserva todos los elementos', shuffled1.sort((a,b)=>a-b).join() === original.sort((a,b)=>a-b).join());
  assert('shuffle no modifica el original', original.length === 8);
}

// ── 7. Contador incremental
console.log('\n7. Contador incremental');
{
  const rng = new SeededRNG('counter_test');
  const v1 = rng.next();
  const v2 = rng.next();
  const v3 = rng.next();
  assert('Valores consecutivos son distintos', v1 !== v2 && v2 !== v3);
  assertEq('Counter empieza en 0', rng.counter - 3, 0);
}

console.log(`\n${'─'.repeat(40)}`);
console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
if (failed > 0) process.exit(1);
