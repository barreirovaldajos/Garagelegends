'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const scripts = [
  'core-loop-smoke-tests.js',
  'advisor-smoke-tests.js'
];

let failed = false;

for (const script of scripts) {
  const fullPath = path.join(__dirname, script);
  const result = spawnSync(process.execPath, [fullPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed = true;
    console.error(`\n✗ Failed: ${script}`);
  }
}

if (failed) {
  console.error('\n✗ MVP smoke tests failed.');
  process.exit(1);
}

console.log('\n✓ MVP smoke tests passed (core + advisor).');
