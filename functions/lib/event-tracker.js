'use strict';

const { UAParser } = require('ua-parser-js');

function parseUA(uaString) {
  if (!uaString) return { browser: 'unknown', deviceType: 'unknown', os: 'unknown' };
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const browserName    = result.browser.name    || 'unknown';
  const browserVersion = result.browser.version || '';
  const osName         = result.os.name         || 'unknown';
  const osVersion      = result.os.version      || '';
  const rawDeviceType  = result.device.type;

  const deviceType = rawDeviceType === 'mobile'  ? 'mobile'
                   : rawDeviceType === 'tablet'  ? 'tablet'
                   : 'desktop';

  return {
    browser:    browserVersion ? `${browserName} ${browserVersion}` : browserName,
    deviceType,
    os:         osVersion      ? `${osName} ${osVersion}`           : osName,
  };
}

async function logEvent(db, { userId, eventName, uaString }) {
  const admin = require('firebase-admin');
  const meta = parseUA(uaString);
  await db.collection('user_events_tracking').add({
    userId:     userId     || null,
    eventName:  eventName  || 'unknown',
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    browser:    meta.browser,
    deviceType: meta.deviceType,
    os:         meta.os,
  });
}

async function getRecentEvents(db, { limit = 50 } = {}) {
  const snap = await db.collection('user_events_tracking')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id:         doc.id,
      userId:     d.userId     || null,
      eventName:  d.eventName  || '',
      createdAt:  d.createdAt  ? d.createdAt.toMillis() : null,
      browser:    d.browser    || '',
      deviceType: d.deviceType || '',
      os:         d.os         || '',
    };
  });
}

async function getTodayCounters(db) {
  const admin = require('firebase-admin');
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startTs = admin.firestore.Timestamp.fromDate(startOfDay);

  const [loginSnap, prepSnap] = await Promise.all([
    db.collection('user_events_tracking')
      .where('eventName', '==', 'login_success')
      .where('createdAt', '>=', startTs)
      .get(),
    db.collection('user_events_tracking')
      .where('eventName', '==', 'prepare_race_click')
      .where('createdAt', '>=', startTs)
      .get(),
  ]);

  return {
    login_success:       loginSnap.size,
    prepare_race_click:  prepSnap.size,
  };
}

// Returns daily counts for the last `days` days grouped by eventName.
// Result: { 'YYYY-MM-DD': { login_success: N, prepare_race_click: M }, ... }
async function getDailyStats(db, { days = 14 } = {}) {
  const admin = require('firebase-admin');
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  cutoff.setUTCHours(0, 0, 0, 0);
  const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

  const snap = await db.collection('user_events_tracking')
    .where('createdAt', '>=', cutoffTs)
    .orderBy('createdAt', 'asc')
    .get();

  const byDay = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.createdAt) return;
    const day = d.createdAt.toDate().toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = {};
    byDay[day][d.eventName] = (byDay[day][d.eventName] || 0) + 1;
  });

  // Fill missing days with zeros
  const result = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    result[key] = byDay[key] || {};
  }

  return result;
}

module.exports = { logEvent, getRecentEvents, getTodayCounters, getDailyStats };
