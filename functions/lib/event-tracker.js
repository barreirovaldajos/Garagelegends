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
  const meta = parseUA(uaString);
  await db.collection('user_events_tracking').add({
    userId:     userId     || null,
    eventName:  eventName  || 'unknown',
    createdAt:  db.constructor.name === 'Firestore'
                  ? require('firebase-admin').firestore.FieldValue.serverTimestamp()
                  : new Date(),
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
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const admin = require('firebase-admin');
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

module.exports = { logEvent, getRecentEvents, getTodayCounters };
