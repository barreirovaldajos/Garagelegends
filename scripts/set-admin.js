// ===== set-admin.js =====
// Sets a user's role to 'admin' in Firestore using Firebase Client SDK.
// Usage: node scripts/set-admin.js <email>
//
// Since we don't have Firebase Admin SDK credentials configured,
// this script uses the client SDK with a service-account-like approach.
// For now, we'll use the Firebase REST API directly.

'use strict';

const https = require('https');
const config = {
  apiKey: 'AIzaSyAPk-05EaSHC_rnc_t_GNwrTjrGjiobT_A',
  projectId: 'garagelegends-1'
};

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin.js <email>');
  console.error('\nAlternatively, set the role directly in the Firebase Console:');
  console.error('  1. Go to https://console.firebase.google.com/project/garagelegends-1/firestore');
  console.error('  2. Navigate to profiles/<your-uid>');
  console.error('  3. Change the "role" field from "player" to "admin"');
  process.exit(1);
}

console.log(`\nTo promote "${email}" to admin:`);
console.log('');
console.log('  1. Open: https://console.firebase.google.com/project/garagelegends-1/firestore');
console.log('  2. Click on "profiles" collection');
console.log('  3. Find the document for this user (search by email field)');
console.log('  4. Click the document');
console.log('  5. Edit the "role" field: change "player" to "admin"');
console.log('  6. Click "Update"');
console.log('');
console.log('After that, log out and log back in to the game to pick up the new role.');
