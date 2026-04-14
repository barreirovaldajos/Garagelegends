// ===== DATA.JS – Static game data =====
'use strict';

// ---- PILOT POOL ----
const PILOT_POOL = [
  { id:'p1',  name:'Marco Venti',       nat:'🇮🇹', age:24, emoji:'🧑',
    attrs:{ pace:72, racePace:68, consistency:65, rain:55, tyre:60, aggression:70, overtake:65, techFB:62, mental:58, charisma:75 },
    potential:85, salary:12000, bio:'Explosive qualifier, wild in the rain.' },
  { id:'p2',  name:'Lena Storm',        nat:'🇩🇪', age:28, emoji:'👩',
    attrs:{ pace:65, racePace:74, consistency:80, rain:85, tyre:78, aggression:55, overtake:60, techFB:82, mental:80, charisma:68 },
    potential:80, salary:14000, bio:'Consistent veteran, outstanding in wet conditions.' },
  { id:'p3',  name:'Adrian Ruiz',       nat:'🇲🇽', age:21, emoji:'🧑',
    attrs:{ pace:60, racePace:62, consistency:70, rain:65, tyre:68, aggression:75, overtake:72, techFB:55, mental:55, charisma:80 },
    potential:92, salary:8000,  bio:'Young lion. Raw, but enormous ceiling.' },
  { id:'p4',  name:'Sven Larsson',      nat:'🇸🇪', age:32, emoji:'🧔',
    attrs:{ pace:62, racePace:70, consistency:85, rain:60, tyre:82, aggression:45, overtake:55, techFB:88, mental:88, charisma:60 },
    potential:70, salary:16000, bio:'Veteran tyre genius. Wins on strategy.' },
  { id:'p5',  name:'Yuki Tanaka',       nat:'🇯🇵', age:23, emoji:'🧑',
    attrs:{ pace:78, racePace:72, consistency:68, rain:70, tyre:65, aggression:68, overtake:74, techFB:70, mental:62, charisma:72 },
    potential:88, salary:11000, bio:'Fast and precise. Still learning race management.' },
  { id:'p6',  name:'Chiamaka Osei',     nat:'🇬🇭', age:26, emoji:'👩',
    attrs:{ pace:66, racePace:75, consistency:78, rain:74, tyre:72, aggression:62, overtake:70, techFB:68, mental:75, charisma:82 },
    potential:84, salary:13000, bio:'Smooth, intelligent racer with a huge fan base.' },
  { id:'p7',  name:'Boris Koval',       nat:'🇺🇦', age:30, emoji:'🧔',
    attrs:{ pace:70, racePace:76, consistency:72, rain:68, tyre:70, aggression:78, overtake:80, techFB:60, mental:70, charisma:55 },
    potential:76, salary:15000, bio:'Aggressive overtaker. Risky but spectacular.' },
  { id:'p8',  name:'Priya Mehta',       nat:'🇮🇳', age:22, emoji:'👩',
    attrs:{ pace:58, racePace:60, consistency:72, rain:62, tyre:58, aggression:60, overtake:62, techFB:75, mental:70, charisma:85 },
    potential:90, salary:7000,  bio:'Technical prodigy. Will be a star in 2 seasons.' },
  { id:'p9',  name:'Carlos Dupont',     nat:'🇧🇷', age:27, emoji:'🧑',
    attrs:{ pace:74, racePace:78, consistency:74, rain:72, tyre:74, aggression:72, overtake:76, techFB:66, mental:72, charisma:78 },
    potential:82, salary:18000, bio:'Complete driver. Slightly expensive for this level.' },
  { id:'p10', name:'Anya Petrov',       nat:'🇷🇺', age:25, emoji:'👩',
    attrs:{ pace:68, racePace:70, consistency:76, rain:80, tyre:76, aggression:65, overtake:66, techFB:72, mental:74, charisma:64 },
    potential:80, salary:12500, bio:'Rain specialist. Cold-headed under pressure.' },
  // AI-only pilots (for opponent teams)
  { id:'ai1', name:'Diego Bernal',      nat:'🇦🇷', age:29, emoji:'🧑', attrs:{pace:65,racePace:72,consistency:70,rain:60,tyre:68,aggression:70,overtake:68,techFB:64,mental:68,charisma:60}, potential:75, salary:14000 },
  { id:'ai2', name:'Freya Nilsen',      nat:'🇳🇴', age:24, emoji:'👩', attrs:{pace:70,racePace:68,consistency:72,rain:75,tyre:70,aggression:62,overtake:65,techFB:68,mental:70,charisma:70}, potential:82, salary:11500 },
  { id:'ai3', name:'Tomás Kramer',      nat:'🇨🇿', age:31, emoji:'🧔', attrs:{pace:62,racePace:74,consistency:80,rain:65,tyre:78,aggression:55,overtake:58,techFB:80,mental:82,charisma:58}, potential:72, salary:15000 },
  { id:'ai4', name:'Jin Park',          nat:'🇰🇷', age:22, emoji:'🧑', attrs:{pace:75,racePace:70,consistency:65,rain:68,tyre:62,aggression:75,overtake:76,techFB:65,mental:60,charisma:74}, potential:90, salary:9000 },
  { id:'ai5', name:'Lucia Ferraro',     nat:'🇮🇹', age:26, emoji:'👩', attrs:{pace:68,racePace:73,consistency:74,rain:70,tyre:72,aggression:66,overtake:68,techFB:70,mental:72,charisma:76}, potential:80, salary:13000 },
  { id:'ai6', name:'Nathan Webb',       nat:'🇬🇧', age:28, emoji:'🧑', attrs:{pace:72,racePace:75,consistency:76,rain:62,tyre:74,aggression:68,overtake:70,techFB:72,mental:74,charisma:65}, potential:78, salary:16000 },
  { id:'ai7', name:'Sara Khoury',       nat:'🇱🇧', age:23, emoji:'👩', attrs:{pace:64,racePace:66,consistency:68,rain:78,tyre:68,aggression:60,overtake:62,techFB:66,mental:68,charisma:80}, potential:86, salary:9500 },
  { id:'ai8', name:'Emil Braun',        nat:'🇩🇪', age:33, emoji:'🧔', attrs:{pace:60,racePace:68,consistency:84,rain:64,tyre:80,aggression:48,overtake:52,techFB:86,mental:88,charisma:55}, potential:68, salary:17000 },
];

// ---- STAFF POOL ----
const STAFF_POOL = [
  { id:'s1', role:'Chief Engineer',  name:'Dr. Hans Müller',   nat:'🇩🇪', emoji:'👨‍🔬', rarity:'rare',
    attrs:{ technical:88, setup:85, pitStrategy:70, scouting:40, commercial:30 }, salary:22000, bio:'Brilliant aerodynamicist. Boosts R&D speed by 15%.' },
  { id:'s2', role:'Race Engineer',   name:'Sarah Okoro',       nat:'🇿🇦', emoji:'👩‍💼', rarity:'uncommon',
    attrs:{ technical:72, setup:82, pitStrategy:88, scouting:50, commercial:45 }, salary:15000, bio:'Pit strategy wizard. Reduces strategy errors.' },
  { id:'s3', role:'Scout',           name:'Pierre Lefevre',    nat:'🇫🇷', emoji:'🕵️', rarity:'uncommon',
    attrs:{ technical:40, setup:35, pitStrategy:30, scouting:90, commercial:60 }, salary:11000, bio:'Elite talent finder. Unlocks hidden-potential pilots.' },
  { id:'s4', role:'Pilot Coach',     name:'Coach Ramos',       nat:'🇪🇸', emoji:'🧑‍🏫', rarity:'common',
    attrs:{ technical:55, setup:45, pitStrategy:40, scouting:60, commercial:30 }, salary:9000,  bio:'Accelerates pilot development by 20%.' },
  { id:'s5', role:'Commercial Dir.', name:'Elena Voss',        nat:'🇦🇹', emoji:'💼', rarity:'uncommon',
    attrs:{ technical:20, setup:15, pitStrategy:20, scouting:40, commercial:92 }, salary:14000, bio:'Brings in better sponsors. +10% sponsor income.' },
  { id:'s6', role:'Data Analyst',    name:'Jin-ho Choi',       nat:'🇰🇷', emoji:'🖥️', rarity:'rare',
    attrs:{ technical:80, setup:78, pitStrategy:82, scouting:55, commercial:35 }, salary:18000, bio:'Boosts car setup accuracy and race prediction.' },
  { id:'s7', role:'Head of Pits',    name:'Tony Marchetti',    nat:'🇧🇷', emoji:'🔧', rarity:'common',
    attrs:{ technical:65, setup:50, pitStrategy:75, scouting:30, commercial:28 }, salary:8000,  bio:'Faster pit stops; reduces execution errors.' },
  { id:'s8', role:'Medic/Physio',    name:'Dr. Amy Lund',      nat:'🇩🇰', emoji:'🏥', rarity:'common',
    attrs:{ technical:30, setup:25, pitStrategy:20, scouting:35, commercial:40 }, salary:7000,  bio:'Reduces injury risk and helps pilot morale recovery.' },
];

// ---- HQ BUILDINGS ----
const FACILITIES = [
  { id:'admin', name:'Oficina de Administración', icon:'🏢', maxLevel:5,
    levels:[
      { cost:15000,  durationMs:5 * 60 * 1000,   effect:'+5% sponsor income' }, // 5 mins
      { cost:45000,  durationMs:30 * 60 * 1000,  effect:'+10% sponsor income, +1 sponsor slot' }, // 30 mins
      { cost:150000, durationMs:2 * 3600 * 1000, effect:'+15% sponsor income, higher tier deals' }, // 2 hours
      { cost:400000, durationMs:8 * 3600 * 1000, effect:'+20% sponsor income' }, // 8 hours
      { cost:1000000,durationMs:24 * 3600 * 1000,effect:'+30% sponsor income, elite PR' } // 24 hours
    ]
  },
  { id:'wind_tunnel', name:'Túnel de Viento', icon:'💨', maxLevel:5,
    levels:[
      { cost:25000,  durationMs:10 * 60 * 1000,  effect:'+10 Base Aerodynamics' },
      { cost:80000,  durationMs:60 * 60 * 1000,  effect:'+20 Base Aerodynamics, rain resistance' },
      { cost:250000, durationMs:4 * 3600 * 1000, effect:'+35 Base Aerodynamics' },
      { cost:600000, durationMs:12 * 3600 * 1000,effect:'+50 Base Aerodynamics, elite correlation' },
      { cost:1500000,durationMs:48 * 3600 * 1000,effect:'+75 Base Aerodynamics, flawless aero' }
    ]
  },
  { id:'rnd', name:'Centro de I+D', icon:'🔬', maxLevel:5,
    levels:[
      { cost:35000,  durationMs:15 * 60 * 1000,  effect:'+10 Base Engine Power' },
      { cost:100000, durationMs:90 * 60 * 1000,  effect:'+22 Base Engine Power, fuel efficiency' },
      { cost:300000, durationMs:6 * 3600 * 1000, effect:'+38 Base Engine Power' },
      { cost:750000, durationMs:16 * 3600 * 1000,effect:'+55 Base Engine Power, custom mapping' },
      { cost:1800000,durationMs:72 * 3600 * 1000,effect:'+80 Base Engine Power, works status' }
    ]
  },
  { id:'factory', name:'Fábrica', icon:'🏭', maxLevel:5,
    levels:[
      { cost:20000,  durationMs:10 * 60 * 1000,  effect:'+10 Reliability, faster pit stops' },
      { cost:65000,  durationMs:45 * 60 * 1000,  effect:'+20 Reliability, -1s pit stops' },
      { cost:200000, durationMs:3 * 3600 * 1000, effect:'+35 Reliability, advanced materials' },
      { cost:500000, durationMs:10 * 3600 * 1000,effect:'+55 Reliability, zero defects' },
      { cost:1200000,durationMs:36 * 3600 * 1000,effect:'+80 Reliability, autonomous assembly' }
    ]
  },
  { id:'academy', name:'Academia de Pilotos', icon:'🎓', maxLevel:5,
    levels:[
      { cost:30000,  durationMs:15 * 60 * 1000,  effect:'+15% pilot training speed' },
      { cost:90000,  durationMs:60 * 60 * 1000,  effect:'+30% pilot training speed, unlock sim' },
      { cost:250000, durationMs:5 * 3600 * 1000, effect:'+50% pilot training speed, mental coaching' },
      { cost:650000, durationMs:14 * 3600 * 1000,effect:'+75% pilot training speed, physical peak' },
      { cost:1400000,durationMs:48 * 3600 * 1000,effect:'+100% pilot training speed, legendary academy' }
    ]
  }
];

// ---- ENGINE SUPPLIERS ----
const ENGINE_SUPPLIERS = [
  { id:'cosmos', name:'Cosmos Power', cost: 10000, color: '#e74c3c', pros:'+10 Velocidad Inicial', description: 'Motor barato y robusto. Ideal para empezar tu legado.' },
  { id:'zenith', name:'Zenith Motors', cost: 25000, color: '#3498db', pros:'+5 Eficiencia, -5 Degradación', description: 'Equilibrio perfecto. Destaca en tandas largas cuidando neumáticos.' },
  { id:'aerov', name:'Aero-V', cost: 35000, color: '#2ecc71', pros:'+10 Aerodinámica, +5 Velocidad', description: 'Bloque compacto que permite diseños de coche agresivos.' },
  { id:'titan', name:'Titan Dynamics', cost: 50000, color: '#f1c40f', pros:'+15 Fiabilidad', description: 'A prueba de balas. Un motor pesado que rara vez se rompe.' },
  { id:'vulcan', name:'Vulcan Tech', cost: 100000, color: '#9b59b6', pros:'-15% Tiempos de I+D/Construcción', description: 'Tecnología punta VIP. Acelera el progreso en tu Cuartel General.' }
];

// ---- SPONSORS ----
const SPONSOR_POOL = [
  { id:'sp1',  name:'VELOCE Energy',   color:'#e8292a', bg:'#1a0505', income:8000,  duration:8,  demand:'Top 8 finish', demandBonus:2000, logo:'⚡' },
  { id:'sp2',  name:'NovaTech Systems',color:'#4a9eff', bg:'#050f1a', income:6000,  duration:10, demand:'Complete all races', demandBonus:1000, logo:'💻' },
  { id:'sp3',  name:'Grid Fuels',      color:'#f5c842', bg:'#1a1505', income:5000,  duration:12, demand:'Improve position vs prev season', demandBonus:1500, logo:'⛽' },
  { id:'sp4',  name:'Carbon Strike',   color:'#9b6dff', bg:'#0d0516', income:12000, duration:6,  demand:'Podium finish', demandBonus:5000, logo:'🎯' },
  { id:'sp5',  name:'Apex Logistics',  color:'#2ecc7a', bg:'#051410', income:9000,  duration:8,  demand:'Top 5 average', demandBonus:3000, logo:'🚚' },
  { id:'sp6',  name:'Meridian Bank',   color:'#ff8c42', bg:'#1a0e05', income:7000,  duration:10, demand:'Beat rival team', demandBonus:2500, logo:'🏦' },
  { id:'sp7',  name:'AltiSport',       color:'#2ecc7a', bg:'#051a0a', income:4000,  duration:12, demand:'No DNF', demandBonus:800, logo:'🏔️' },
  { id:'sp8',  name:'Helix Motors',    color:'#e8292a', bg:'#1a0505', income:15000, duration:4,  demand:'Win a race', demandBonus:8000, logo:'🔴' },
];

// ---- CIRCUITS ----
const CIRCUITS = [
  { id:'c1',  name:'Silverstone Circuit',     country:'🇬🇧', laps:64, layout:'high-speed', weather:60, length:'4.788 km' },
  { id:'c2',  name:'Circuit de la Sarthe',    country:'🇫🇷', laps:62, layout:'endurance',  weather:65, length:'4.905 km' },
  { id:'c3',  name:'Autodromo Nazionale',     country:'🇮🇹', laps:67, layout:'power',      weather:80, length:'4.579 km' },
  { id:'c4',  name:'Spa-Francorchamps',       country:'🇧🇪', laps:66, layout:'mixed',      weather:45, length:'4.641 km' },
  { id:'c5',  name:'Circuit de Barcelona',    country:'🇪🇸', laps:65, layout:'technical',  weather:85, length:'4.675 km' },
  { id:'c6',  name:'Suzuka International',    country:'🇯🇵', laps:66, layout:'technical',  weather:70, length:'4.617 km' },
  { id:'c7',  name:'Interlagos',              country:'🇧🇷', laps:67, layout:'mixed',      weather:55, length:'4.553 km' },
  { id:'c8',  name:'Hockenheimring',          country:'🇩🇪', laps:67, layout:'power',      weather:65, length:'4.574 km' },
  { id:'c9',  name:'Brands Hatch',            country:'🇬🇧', laps:67, layout:'technical',  weather:55, length:'4.562 km' },
  { id:'c10', name:'Portimão Circuit',        country:'🇵🇹', laps:66, layout:'mixed',      weather:80, length:'4.653 km' },
  { id:'c11', name:'Mugello Circuit',         country:'🇮🇹', laps:64, layout:'power',      weather:78, length:'4.781 km' },
  { id:'c12', name:'Red Bull Ring',           country:'🇦🇹', laps:70, layout:'high-speed', weather:75, length:'4.318 km' },
];

// ---- CALENDAR per season (8 rounds for Div 8) ----
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSeasonWetRaceTarget(raceCount) {
  if (raceCount <= 8) {
    return 2 + (Math.random() < 0.45 ? 1 : 0);
  }
  return clampNumber(Math.round(raceCount * 0.3), 3, 4);
}

function generateCalendar(division) {
  if (typeof window !== 'undefined' && typeof window.RACE_STATUS === 'undefined') {
    // Cargar enums si no están presentes
    try { window.RACE_STATUS = require('./game_constants.js').RACE_STATUS; } catch(e) {}
  }
  const RACE_STATUS_ENUM = (typeof window !== 'undefined' && window.RACE_STATUS) ? window.RACE_STATUS : { UPCOMING: 'upcoming', NEXT: 'next', COMPLETED: 'completed' };
  const count = Math.min(8 + (8 - division), 12);
  const shuffled = [...CIRCUITS].sort(() => Math.random() - 0.5);
  const selectedCircuits = shuffled.slice(0, count);
  const targetWetRaces = getSeasonWetRaceTarget(selectedCircuits.length);
  const wetRaceIds = new Set(
    selectedCircuits
      .map((c) => ({
        id: c.id,
        weight: clampNumber(100 - (c.weather || 70), 5, 60) + (Math.random() * 12)
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, targetWetRaces)
      .map((entry) => entry.id)
  );

  return selectedCircuits.map((c, i) => ({
    // Forecast confidence mejora en divisiones altas (mejor data/weather ops)
    // Div 8: ~58-70%, Div 1: ~72-84%
    ...(() => {
      const isWetRace = wetRaceIds.has(c.id);
      const baseConfidence = 58 + ((8 - division) * 2);
      const confidence = Math.max(50, Math.min(92, baseConfidence + Math.floor(Math.random() * 13)));
      const forecastBase = isWetRace
        ? clampNumber(52 + ((100 - (c.weather || 70)) * 0.35), 48, 78)
        : clampNumber(16 + ((100 - (c.weather || 70)) * 0.22), 8, 38);
      const startWetProb = Math.max(5, Math.min(95, forecastBase + (Math.floor(Math.random() * 17) - 8)));
      const midWetProb = Math.max(5, Math.min(95, startWetProb + (Math.floor(Math.random() * 25) - 12)));
      const endWetProb = Math.max(5, Math.min(95, midWetProb + (Math.floor(Math.random() * 25) - 12)));
      return {
        forecast: {
          confidence,
          windows: [
            { label: 'start', wetProb: startWetProb },
            { label: 'mid', wetProb: midWetProb },
            { label: 'end', wetProb: endWetProb }
          ]
        }
      };
    })(),
    round: i + 1,
    circuit: c,
    status: i === 0 ? RACE_STATUS_ENUM.NEXT : RACE_STATUS_ENUM.UPCOMING,
    result: null,
    weather: wetRaceIds.has(c.id) ? 'wet' : 'dry',
  }));
}

// ---- AI TEAM NAMES ----
const AI_TEAMS = [
  { id:'ai_t1', name:'Red Arrow Racing',   color:'#00A6FB', flag:'🇩🇪' },
  { id:'ai_t2', name:'Pacific Motorsport', color:'#2EC4B6', flag:'🇯🇵' },
  { id:'ai_t3', name:'Volta Corse',        color:'#8AC926', flag:'🇮🇹' },
  { id:'ai_t4', name:'Vortex Racing',      color:'#6A4C93', flag:'🇫🇷' },
  { id:'ai_t5', name:'Iron Horse GP',      color:'#FF9F1C', flag:'🇺🇸' },
  { id:'ai_t6', name:'Southern Cross SC',  color:'#06D6A0', flag:'🇦🇺' },
  { id:'ai_t7', name:'Nordic RST',         color:'#FFD166', flag:'🇸🇪' },
  { id:'ai_t8', name:'Pampas Motorsport',  color:'#D65DB1', flag:'🇦🇷' },
  { id:'ai_t9', name:'Sahara Velocity',    color:'#3A86FF', flag:'🇲🇦' },
  { id:'ai_t10',name:'Baltic Speed Co.',   color:'#43AA8B', flag:'🇱🇻' },
];

// ---- PHILOSOPHIES ----
const PHILOSOPHIES = [
  { id:'aggressive',    name:'Aggressive',       icon:'🔥', desc:'High risk, high reward. Your drivers push hard and your setups chase performance.' },
  { id:'technical',     name:'Technical',        icon:'🔬', desc:'Data-driven. You invest in R&D and setup precision over raw pace.' },
  { id:'underdog',      name:'Underdog',         icon:'💪', desc:'Lean operation. Exceptional value from every budget credit.' },
  { id:'innovative',    name:'Innovative',       icon:'💡', desc:'First to try new approaches. Tech upgrades unlock faster.' },
  { id:'traditional',   name:'Traditional',      icon:'🏆', desc:'Proven methods and stable team culture. Lower volatility.' },
  { id:'rain',          name:'Rain Specialist',  icon:'🌧️', desc:'Your team excels in wet conditions. Wet-weather bonuses.' },
  { id:'endurance',     name:'Endurance Focus',  icon:'⏱️', desc:'Consistency and tyre management over one-lap speed.' },
  { id:'commercial',    name:'Commercial Power', icon:'💼', desc:'Marketing machine. Higher sponsor income and fan growth.' },
];

// ---- RANDOM EVENT TEMPLATES ----
const RANDOM_EVENT_TEMPLATES = [
  { id:'re1',  type:'warning',  title:'Sponsor Demands More', text:'{{sponsor}} is requesting better race results or threatens reduced income.', choices:['Promise Top 5','Offer Media Package','Ignore Risk'] },
  { id:'re2',  type:'good',     title:'Talent Sighted',       text:'Your scout spotted a promising young driver. Sign {{pilot}} to the academy?', choices:['Sign to Academy','Pass'] },
  { id:'re3',  type:'bad',      title:'Pilot Frustrated',     text:'{{pilot}} feels underused and is considering other offers. Address this?', choices:['Salary Bonus +20%','Promise Race Win','Release'] },
  { id:'re4',  type:'good',     title:'Tech Partnership',     text:'A components supplier offers a technical partnership deal.', choices:['Accept (-5000 cr, +10 all car stats)','Decline'] },
  { id:'re5',  type:'bad',      title:'Mechanical Failure',  text:'A fault was found in the {{component}}. Repair cost or race risk?', choices:['Repair Now (-8000 cr)','Risk It (+DNF chance)'] },
  { id:'re6',  type:'good',     title:'Media Buzz',           text:'Your team is featured in a major motorsport broadcast. Fan surge incoming!', choices:['Capitalize (+PR boost)','Business As Usual'] },
  { id:'re7',  type:'warning',  title:'Staff Offer',          text:'{{staff}} has received an offer from a rival team. Counter-offer?', choices:['Counter +25% salary','Let Them Go'] },
  { id:'re8',  type:'bad',      title:'Audit Incoming',       text:'Financial auditors are reviewing your books. Ensure records are clean.', choices:['Hire Accountant (-3000 cr)','Face Audit'] },
  { id:'re9',  type:'good',     title:'Championship Bonus',   text:'Division committee awards early bonus for competitive season.', choices:['Accept Cash (+15000 cr)','Accept Tokens (+8 tokens)'] },
  { id:'re10', type:'warning',  title:'Weather Forecast',     text:'Heavy rain expected at next race. Adjust strategy?', choices:['Switch to Wet Focus','Keep Current Setup','Rain Master Mode (-5 tokens)'] },
  { id:'re11', type:'good',     title:'Fan Milestone',        text:'You just crossed a fan milestone! Merchandise income spiking.', choices:['Boost Merchandise (+income)','Use for Publicity'] },
  { id:'re12', type:'bad',      title:'Practice Incident',    text:'{{pilot}} had a heavy crash in practice. Minor injury risk.', choices:['Rest Pilot (miss qual)','Clear to Race (risk)'] },
];

// ---- POINTS SYSTEM ----
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0];

// ---- DIVISION STRUCTURE ----
// Regla base: cada división tiene 10 equipos (20 pilotos).
// La pirámide crece hacia abajo con múltiples ligas paralelas por nivel.
const DIVISIONS = [
  { div:8, name:'Division 8 – Amateur Circuit',  teams:10, promotions:2, relegations:0, parallelDivisions:16 },
  { div:7, name:'Division 7 – Regional Series',  teams:10, promotions:2, relegations:2, parallelDivisions:12 },
  { div:6, name:'Division 6 – National Trophy',  teams:10, promotions:2, relegations:2, parallelDivisions:8 },
  { div:5, name:'Division 5 – Continental Cup',  teams:10, promotions:2, relegations:2, parallelDivisions:6 },
  { div:4, name:'Division 4 – Pro Series',       teams:10, promotions:3, relegations:3, parallelDivisions:4 },
  { div:3, name:'Division 3 – Championship',     teams:10, promotions:3, relegations:3, parallelDivisions:3 },
  { div:2, name:'Division 2 – Premier League',   teams:10, promotions:4, relegations:4, parallelDivisions:2 },
  { div:1, name:'Division 1 – Elite Series',     teams:10, promotions:0, relegations:4, parallelDivisions:1 },
];

window.GL_DATA = {
  PILOT_POOL, STAFF_POOL, FACILITIES, SPONSOR_POOL,
  CIRCUITS, AI_TEAMS, PHILOSOPHIES,
  RANDOM_EVENT_TEMPLATES, POINTS_TABLE, DIVISIONS,
  ENGINE_SUPPLIERS,
  generateCalendar
};
