#!/usr/bin/env node
/**
 * migrate-supabase-to-firebase.js
 * Exports 4 users + save_data from Supabase → imports to Firebase Auth + Firestore.
 *
 * Prerequisites:
 *   npm install
 *   # migration.env and firebase-service-account.json must exist in project root
 *
 * Run:
 *   node scripts/migrate-supabase-to-firebase.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ── Load env vars from migration.env ─────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', 'migration.env');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: migration.env not found at', envPath);
  process.exit(1);
}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eq = trimmed.indexOf('=');
  if (eq === -1) return;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (key && !process.env[key]) process.env[key] = val;
});

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SR_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SA_PATH           = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT || 'firebase-service-account.json');

if (!SUPABASE_URL || !SUPABASE_SR_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in migration.env');
  process.exit(1);
}
if (!fs.existsSync(SA_PATH)) {
  console.error('ERROR: firebase-service-account.json not found at', SA_PATH);
  process.exit(1);
}

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db   = admin.firestore();
const auth = admin.auth();

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function supabaseFetch(endpoint, opts = {}) {
  const url = `${SUPABASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'apikey': SUPABASE_SR_KEY,
      'Authorization': `Bearer ${SUPABASE_SR_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status} on ${endpoint}: ${body}`);
  }
  return res.json();
}

// ── Step 1: Fetch all auth users from Supabase ────────────────────────────────
async function fetchSupabaseAuthUsers() {
  console.log('\n[1/4] Fetching auth users from Supabase...');
  // Admin API: list users (paginated, default page size 50 — plenty for 4 users)
  const data = await supabaseFetch('/auth/v1/admin/users?per_page=100');
  const users = Array.isArray(data) ? data : (data.users || []);
  console.log(`      Found ${users.length} auth user(s)`);
  return users;
}

// ── Step 2: Fetch profiles + save_data from Supabase ─────────────────────────
async function fetchSupabaseProfiles() {
  console.log('\n[2/4] Fetching profiles + save_data from Supabase...');
  const profiles = await supabaseFetch(
    '/rest/v1/profiles?select=id,email,role,save_data,save_updated_at'
  );
  console.log(`      Found ${profiles.length} profile(s)`);
  return profiles;
}

// ── Step 3: Import users into Firebase Auth ───────────────────────────────────
async function importUsersToFirebase(authUsers, profileMap) {
  console.log('\n[3/4] Importing users into Firebase Auth...');
  const results = { created: [], skipped: [], errors: [] };

  for (const su of authUsers) {
    const email = su.email;
    if (!email) {
      console.warn(`      SKIP: user ${su.id} has no email`);
      results.skipped.push(su.id);
      continue;
    }

    // Check if user already exists in Firebase
    let existingUid = null;
    try {
      const existing = await auth.getUserByEmail(email);
      existingUid = existing.uid;
      console.log(`      EXISTS: ${email} → uid ${existingUid}`);
      results.skipped.push({ supabaseId: su.id, firebaseUid: existingUid, email });
      // Store mapping for Firestore step
      su._firebaseUid = existingUid;
      continue;
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    // Create user in Firebase Auth
    // Note: we cannot migrate bcrypt passwords directly via createUser.
    // Users will need to use "reset password" on first login.
    // A temporary password is set; admin should force a reset.
    try {
      const newUser = await auth.createUser({
        email,
        emailVerified: Boolean(su.email_confirmed_at),
        displayName: email.split('@')[0],
        disabled: false
      });
      console.log(`      CREATED: ${email} → uid ${newUser.uid}`);
      su._firebaseUid = newUser.uid;
      results.created.push({ supabaseId: su.id, firebaseUid: newUser.uid, email });
    } catch (e) {
      console.error(`      ERROR creating ${email}:`, e.message);
      results.errors.push({ supabaseId: su.id, email, error: e.message });
    }
  }

  return results;
}

// ── Step 4: Write profiles + save_data to Firestore ──────────────────────────
async function writeProfilesToFirestore(authUsers, profileMap) {
  console.log('\n[4/4] Writing profiles to Firestore...');
  let written = 0;
  let skipped = 0;

  const batch = db.batch();

  for (const su of authUsers) {
    const firebaseUid = su._firebaseUid;
    if (!firebaseUid) { skipped++; continue; }

    const prof = profileMap[su.id] || {};
    const docRef = db.collection('profiles').doc(firebaseUid);

    const payload = {
      email: su.email || prof.email || '',
      role: prof.role || 'player',
      supabaseId: su.id,             // keep for audit trail
      createdAt: su.created_at
        ? admin.firestore.Timestamp.fromDate(new Date(su.created_at))
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (prof.save_data) {
      payload.save_data = prof.save_data;
      if (prof.save_updated_at) {
        payload.save_updated_at = admin.firestore.Timestamp.fromDate(
          new Date(prof.save_updated_at)
        );
      }
    }

    batch.set(docRef, payload, { merge: true });
    console.log(`      profile → ${su.email} (uid: ${firebaseUid})${prof.save_data ? ' [+save_data]' : ' [no save_data]'}`);
    written++;
  }

  await batch.commit();
  console.log(`      Committed ${written} profile(s), skipped ${skipped}`);
  return { written, skipped };
}

// ── Generate password-reset links for migrated users ─────────────────────────
async function generateResetLinks(authUsers) {
  console.log('\n[BONUS] Generating password reset links for migrated users...');
  const links = [];
  for (const su of authUsers) {
    if (!su._firebaseUid || !su.email) continue;
    try {
      const link = await auth.generatePasswordResetLink(su.email);
      links.push({ email: su.email, link });
      console.log(`      ${su.email}: ${link}`);
    } catch (e) {
      console.warn(`      Could not generate link for ${su.email}:`, e.message);
    }
  }
  // Save links to file for sending to users
  const linksPath = path.resolve(__dirname, '..', 'migration-reset-links.txt');
  const content = links
    .map(l => `${l.email}\n${l.link}\n`)
    .join('\n');
  fs.writeFileSync(linksPath, content, 'utf8');
  console.log(`\n      Reset links saved to: migration-reset-links.txt`);
  console.log('      Send each user their link — they use it once to set their password.');
  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Supabase → Firebase Migration ===');
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  let authUsers, profiles;

  try {
    authUsers = await fetchSupabaseAuthUsers();
    profiles  = await fetchSupabaseProfiles();
  } catch (e) {
    console.error('\nFailed to fetch from Supabase:', e.message);
    process.exit(1);
  }

  // Build profileMap by Supabase user id
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.id] = p; });

  let importResults;
  try {
    importResults = await importUsersToFirebase(authUsers, profileMap);
  } catch (e) {
    console.error('\nFailed to import users to Firebase Auth:', e.message);
    process.exit(1);
  }

  try {
    await writeProfilesToFirestore(authUsers, profileMap);
  } catch (e) {
    console.error('\nFailed to write profiles to Firestore:', e.message);
    process.exit(1);
  }

  await generateResetLinks(authUsers);

  console.log('\n=== Migration complete ===');
  console.log(`Created:  ${importResults.created.length}`);
  console.log(`Skipped:  ${importResults.skipped.length}`);
  console.log(`Errors:   ${importResults.errors.length}`);

  if (importResults.errors.length) {
    console.error('\nErrors:');
    importResults.errors.forEach(e => console.error(`  ${e.email}: ${e.error}`));
  }

  // Write summary JSON for audit
  const summaryPath = path.resolve(__dirname, '..', 'migration-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    date: new Date().toISOString(),
    project: serviceAccount.project_id,
    supabase: SUPABASE_URL,
    results: importResults
  }, null, 2), 'utf8');
  console.log('\nSummary saved to: migration-summary.json');

  process.exit(0);
}

main().catch(e => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
