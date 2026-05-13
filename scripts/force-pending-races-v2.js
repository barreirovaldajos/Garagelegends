'use strict';
// Llama al Cloud Function adminForceRace para las divisiones bloqueadas
const admin = require('firebase-admin');
const https = require('https');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const PROJECT = 'garagelegends-1';
const REGION  = 'us-central1';
const DIVS    = ['7_11', '7_6'];

async function callForceRace(token, divKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ data: { divKey } });
    const req = https.request({
      hostname: `${REGION}-${PROJECT}.cloudfunctions.net`,
      path: '/adminForceRace',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const token = await admin.credential.cert(serviceAccount).getAccessToken()
    .then(t => t.access_token);

  for (const divKey of DIVS) {
    console.log(`Forzando carrera para ${divKey}...`);
    const res = await callForceRace(token, divKey);
    if (res.status === 200 && res.body?.result) {
      const d = res.body.result;
      console.log(`  ✓ Ronda ${d.round || '?'} completada. ${(d.topPositions||[]).map(p=>`${p.name} P${p.pos}`).join(', ')}`);
    } else {
      console.error(`  ✗ Error (${res.status}):`, JSON.stringify(res.body));
    }
  }

  console.log('\nVerificando...');
  const db = admin.firestore();
  const snap = await db.collection('divisions').where('phase', '==', 'season').get();
  let blocked = 0;
  snap.forEach(doc => {
    const pending = (doc.data().calendar || []).filter(r => r.status === 'next');
    if (pending.length) { console.log(`  BLOQUEADA: ${doc.id} (ronda ${pending.map(r=>r.round).join(',')})`); blocked++; }
  });
  if (!blocked) console.log('  ✓ Todas completadas. Puedes avanzar la temporada.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
