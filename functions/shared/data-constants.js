// ===== DATA-CONSTANTS.JS – Shared static game data (browser + Node) =====
// Isomorphic module: exports via module.exports (Node) or window.GL_SHARED_DATA (browser).
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GL_SHARED_DATA = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var PILOT_POOL = [
    { id:'p1',  name:'Marco Venti',       nat:'\uD83C\uDDEE\uD83C\uDDF9', age:24, emoji:'\uD83E\uDDD1',
      attrs:{ pace:72, racePace:68, consistency:65, rain:55, tyre:60, aggression:70, overtake:65, techFB:62, mental:58, charisma:75 },
      potential:85, salary:12000 },
    { id:'p2',  name:'Lena Storm',        nat:'\uD83C\uDDE9\uD83C\uDDEA', age:28, emoji:'\uD83D\uDC69',
      attrs:{ pace:65, racePace:74, consistency:80, rain:85, tyre:78, aggression:55, overtake:60, techFB:82, mental:80, charisma:68 },
      potential:80, salary:14000 },
    { id:'p3',  name:'Adrian Ruiz',       nat:'\uD83C\uDDF2\uD83C\uDDFD', age:21, emoji:'\uD83E\uDDD1',
      attrs:{ pace:60, racePace:62, consistency:70, rain:65, tyre:68, aggression:75, overtake:72, techFB:55, mental:55, charisma:80 },
      potential:92, salary:8000 },
    { id:'p4',  name:'Sven Larsson',      nat:'\uD83C\uDDF8\uD83C\uDDEA', age:32, emoji:'\uD83E\uDDD4',
      attrs:{ pace:62, racePace:70, consistency:85, rain:60, tyre:82, aggression:45, overtake:55, techFB:88, mental:88, charisma:60 },
      potential:70, salary:16000 },
    { id:'p5',  name:'Yuki Tanaka',       nat:'\uD83C\uDDEF\uD83C\uDDF5', age:23, emoji:'\uD83E\uDDD1',
      attrs:{ pace:78, racePace:72, consistency:68, rain:70, tyre:65, aggression:68, overtake:74, techFB:70, mental:62, charisma:72 },
      potential:88, salary:11000 },
    { id:'p6',  name:'Chiamaka Osei',     nat:'\uD83C\uDDEC\uD83C\uDDED', age:26, emoji:'\uD83D\uDC69',
      attrs:{ pace:66, racePace:75, consistency:78, rain:74, tyre:72, aggression:62, overtake:70, techFB:68, mental:75, charisma:82 },
      potential:84, salary:13000 },
    { id:'p7',  name:'Boris Koval',       nat:'\uD83C\uDDFA\uD83C\uDDE6', age:30, emoji:'\uD83E\uDDD4',
      attrs:{ pace:70, racePace:76, consistency:72, rain:68, tyre:70, aggression:78, overtake:80, techFB:60, mental:70, charisma:55 },
      potential:76, salary:15000 },
    { id:'p8',  name:'Priya Mehta',       nat:'\uD83C\uDDEE\uD83C\uDDF3', age:22, emoji:'\uD83D\uDC69',
      attrs:{ pace:58, racePace:60, consistency:72, rain:62, tyre:58, aggression:60, overtake:62, techFB:75, mental:70, charisma:85 },
      potential:90, salary:7000 },
    { id:'p9',  name:'Carlos Dupont',     nat:'\uD83C\uDDE7\uD83C\uDDF7', age:27, emoji:'\uD83E\uDDD1',
      attrs:{ pace:74, racePace:78, consistency:74, rain:72, tyre:74, aggression:72, overtake:76, techFB:66, mental:72, charisma:78 },
      potential:82, salary:18000 },
    { id:'p10', name:'Anya Petrov',       nat:'\uD83C\uDDF7\uD83C\uDDFA', age:25, emoji:'\uD83D\uDC69',
      attrs:{ pace:68, racePace:70, consistency:76, rain:80, tyre:76, aggression:65, overtake:66, techFB:72, mental:74, charisma:64 },
      potential:80, salary:12500 },
    // AI-only pilots
    { id:'ai1', name:'Diego Bernal',      nat:'\uD83C\uDDE6\uD83C\uDDF7', age:29, emoji:'\uD83E\uDDD1', attrs:{pace:65,racePace:72,consistency:70,rain:60,tyre:68,aggression:70,overtake:68,techFB:64,mental:68,charisma:60}, potential:75, salary:14000 },
    { id:'ai2', name:'Freya Nilsen',      nat:'\uD83C\uDDF3\uD83C\uDDF4', age:24, emoji:'\uD83D\uDC69', attrs:{pace:70,racePace:68,consistency:72,rain:75,tyre:70,aggression:62,overtake:65,techFB:68,mental:70,charisma:70}, potential:82, salary:11500 },
    { id:'ai3', name:'Tom\u00E1s Kramer', nat:'\uD83C\uDDE8\uD83C\uDDFF', age:31, emoji:'\uD83E\uDDD4', attrs:{pace:62,racePace:74,consistency:80,rain:65,tyre:78,aggression:55,overtake:58,techFB:80,mental:82,charisma:58}, potential:72, salary:15000 },
    { id:'ai4', name:'Jin Park',          nat:'\uD83C\uDDF0\uD83C\uDDF7', age:22, emoji:'\uD83E\uDDD1', attrs:{pace:75,racePace:70,consistency:65,rain:68,tyre:62,aggression:75,overtake:76,techFB:65,mental:60,charisma:74}, potential:90, salary:9000 },
    { id:'ai5', name:'Lucia Ferraro',     nat:'\uD83C\uDDEE\uD83C\uDDF9', age:26, emoji:'\uD83D\uDC69', attrs:{pace:68,racePace:73,consistency:74,rain:70,tyre:72,aggression:66,overtake:68,techFB:70,mental:72,charisma:76}, potential:80, salary:13000 },
    { id:'ai6', name:'Nathan Webb',       nat:'\uD83C\uDDEC\uD83C\uDDE7', age:28, emoji:'\uD83E\uDDD1', attrs:{pace:72,racePace:75,consistency:76,rain:62,tyre:74,aggression:68,overtake:70,techFB:72,mental:74,charisma:65}, potential:78, salary:16000 },
    { id:'ai7', name:'Sara Khoury',       nat:'\uD83C\uDDF1\uD83C\uDDE7', age:23, emoji:'\uD83D\uDC69', attrs:{pace:64,racePace:66,consistency:68,rain:78,tyre:68,aggression:60,overtake:62,techFB:66,mental:68,charisma:80}, potential:86, salary:9500 },
    { id:'ai8', name:'Emil Braun',        nat:'\uD83C\uDDE9\uD83C\uDDEA', age:33, emoji:'\uD83E\uDDD4', attrs:{pace:60,racePace:68,consistency:84,rain:64,tyre:80,aggression:48,overtake:52,techFB:86,mental:88,charisma:55}, potential:68, salary:17000 }
  ];

  var CIRCUITS = [
    { id:'c1',  name:'Silverstone Circuit',     country:'\uD83C\uDDEC\uD83C\uDDE7', laps:64, layout:'high-speed', weather:60, length:'4.788 km' },
    { id:'c2',  name:'Circuit de la Sarthe',    country:'\uD83C\uDDEB\uD83C\uDDF7', laps:62, layout:'endurance',  weather:65, length:'4.905 km' },
    { id:'c3',  name:'Autodromo Nazionale',     country:'\uD83C\uDDEE\uD83C\uDDF9', laps:67, layout:'power',      weather:80, length:'4.579 km' },
    { id:'c4',  name:'Spa-Francorchamps',       country:'\uD83C\uDDE7\uD83C\uDDEA', laps:66, layout:'mixed',      weather:45, length:'4.641 km' },
    { id:'c5',  name:'Circuit de Barcelona',    country:'\uD83C\uDDEA\uD83C\uDDF8', laps:65, layout:'technical',  weather:85, length:'4.675 km' },
    { id:'c6',  name:'Suzuka International',    country:'\uD83C\uDDEF\uD83C\uDDF5', laps:66, layout:'technical',  weather:70, length:'4.617 km' },
    { id:'c7',  name:'Interlagos',              country:'\uD83C\uDDE7\uD83C\uDDF7', laps:67, layout:'mixed',      weather:55, length:'4.553 km' },
    { id:'c8',  name:'Hockenheimring',          country:'\uD83C\uDDE9\uD83C\uDDEA', laps:67, layout:'power',      weather:65, length:'4.574 km' },
    { id:'c9',  name:'Brands Hatch',            country:'\uD83C\uDDEC\uD83C\uDDE7', laps:67, layout:'technical',  weather:55, length:'4.562 km' },
    { id:'c10', name:'Portim\u00E3o Circuit',   country:'\uD83C\uDDF5\uD83C\uDDF9', laps:66, layout:'mixed',      weather:80, length:'4.653 km' },
    { id:'c11', name:'Mugello Circuit',         country:'\uD83C\uDDEE\uD83C\uDDF9', laps:64, layout:'power',      weather:78, length:'4.781 km' },
    { id:'c12', name:'Red Bull Ring',           country:'\uD83C\uDDE6\uD83C\uDDF9', laps:70, layout:'high-speed', weather:75, length:'4.318 km' },
    { id:'c13', name:'Standard Circuit',        country:'\uD83C\uDFC1',             laps:65, layout:'mixed',      weather:70, length:'4.650 km' }
  ];

  var AI_TEAMS = [
    { id:'ai_t1', name:'Red Arrow Racing',   color:'#00A6FB', flag:'\uD83C\uDDE9\uD83C\uDDEA' },
    { id:'ai_t2', name:'Pacific Motorsport', color:'#2EC4B6', flag:'\uD83C\uDDEF\uD83C\uDDF5' },
    { id:'ai_t3', name:'Volta Corse',        color:'#8AC926', flag:'\uD83C\uDDEE\uD83C\uDDF9' },
    { id:'ai_t4', name:'Vortex Racing',      color:'#6A4C93', flag:'\uD83C\uDDEB\uD83C\uDDF7' },
    { id:'ai_t5', name:'Iron Horse GP',      color:'#FF9F1C', flag:'\uD83C\uDDFA\uD83C\uDDF8' },
    { id:'ai_t6', name:'Southern Cross SC',  color:'#06D6A0', flag:'\uD83C\uDDE6\uD83C\uDDFA' },
    { id:'ai_t7', name:'Nordic RST',         color:'#FFD166', flag:'\uD83C\uDDF8\uD83C\uDDEA' },
    { id:'ai_t8', name:'Pampas Motorsport',  color:'#D65DB1', flag:'\uD83C\uDDE6\uD83C\uDDF7' },
    { id:'ai_t9', name:'Sahara Velocity',    color:'#3A86FF', flag:'\uD83C\uDDF2\uD83C\uDDE6' },
    { id:'ai_t10',name:'Baltic Speed Co.',   color:'#43AA8B', flag:'\uD83C\uDDF1\uD83C\uDDFB' }
  ];

  var POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0];

  var DIVISIONS = [
    { div:8, name:'Division 8 \u2013 Amateur Circuit',  teams:10, promotions:2, relegations:0, parallelDivisions:16 },
    { div:7, name:'Division 7 \u2013 Regional Series',  teams:10, promotions:2, relegations:2, parallelDivisions:12 },
    { div:6, name:'Division 6 \u2013 National Trophy',  teams:10, promotions:2, relegations:2, parallelDivisions:8 },
    { div:5, name:'Division 5 \u2013 Continental Cup',  teams:10, promotions:2, relegations:2, parallelDivisions:6 },
    { div:4, name:'Division 4 \u2013 Pro Series',       teams:10, promotions:3, relegations:3, parallelDivisions:4 },
    { div:3, name:'Division 3 \u2013 Championship',     teams:10, promotions:3, relegations:3, parallelDivisions:3 },
    { div:2, name:'Division 2 \u2013 Premier League',   teams:10, promotions:4, relegations:4, parallelDivisions:2 },
    { div:1, name:'Division 1 \u2013 Elite Series',     teams:10, promotions:0, relegations:4, parallelDivisions:1 }
  ];

  return {
    PILOT_POOL: PILOT_POOL,
    CIRCUITS: CIRCUITS,
    AI_TEAMS: AI_TEAMS,
    POINTS_TABLE: POINTS_TABLE,
    DIVISIONS: DIVISIONS
  };
}));
