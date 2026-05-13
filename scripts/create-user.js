'use strict';
// Uso: node scripts/create-user.js <email> <password> [role]
// role: 'player' (default) | 'admin'

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const db   = admin.firestore();

const EMAIL    = process.argv[2];
const PASSWORD = process.argv[3];
const ROLE     = process.argv[4] || 'player';

if (!EMAIL || !PASSWORD) {
  console.error('Uso: node scripts/create-user.js <email> <password> [role]');
  process.exit(1);
}

async function run() {
  let uid;

  try {
    const existing = await auth.getUserByEmail(EMAIL);
    uid = existing.uid;
    console.log('Usuario ya existe, UID:', uid);
    await auth.updateUser(uid, { password: PASSWORD });
    console.log('Contraseña actualizada.');
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true });
      uid = created.uid;
      console.log('Usuario creado, UID:', uid);
    } else {
      throw e;
    }
  }

  await db.collection('profiles').doc(uid).set(
    { email: EMAIL, role: ROLE },
    { merge: true }
  );
  console.log(`Perfil en Firestore actualizado: role="${ROLE}"`);
  console.log('\nListo. Puedes iniciar sesión con:');
  console.log('  Email:    ', EMAIL);
  console.log('  Password: ', PASSWORD);
  process.exit(0);
}

run().catch(err => { console.error('Error:', err.message || err); process.exit(1); });
