// Fuente de verdad de economía semanal
function getWeeklyEconomyBreakdown(state) {
  const incomeBreakdown = (window.Economy || globalThis.Economy).calculateTeamIncomeBreakdown(state);
  const expenseBreakdown = (window.Economy || globalThis.Economy).calculateTeamExpenseBreakdown(state);
  const income = incomeBreakdown.income;
  const expenses = expenseBreakdown.expenses;
  return {
    sponsorIncome: incomeBreakdown.sponsorIncome,
    fanRevenue: incomeBreakdown.fanRevenue,
    divisionGrant: incomeBreakdown.divisionGrant,
    bonusIncome: incomeBreakdown.bonusIncome,
    salaries: expenseBreakdown.salaries,
    hqCost: expenseBreakdown.hqCost,
    contractCost: expenseBreakdown.contractCost,
    constructionUpkeep: expenseBreakdown.constructionUpkeep,
    income,
    expenses,
    net: income - expenses
  };
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.getWeeklyEconomyBreakdown = getWeeklyEconomyBreakdown;
}
// ===== ENGINE.JS – Race simulation + economy + events =====


'use strict';

// Integración MMO/social y ligas dinámicas
// Ejemplo de uso de hooks MMO/social:
// Divisions.registerMMOEvent({ type: 'race_win', team: 'Cosmos', week: S.getWeek() });
// Divisions.requestHelpMMO({ from: 'Cosmos', to: 'Zenith', type: 'strategy', week: S.getWeek() });

const { GL_STATE: S, GL_DATA: D } = window;
const DivisionsApi = window.Divisions || globalThis.Divisions;
const EconomyApi = window.Economy || globalThis.Economy;
const AcademyApi = window.Academy || globalThis.Academy;
const DAY_MS = 24 * 60 * 60 * 1000;

function getTimeOffsetMs() {
  const state = S.getState();
  return (state && state.meta && typeof state.meta.timeOffsetMs === 'number') ? state.meta.timeOffsetMs : 0;
}

function getNowMs() {
  return Date.now() + getTimeOffsetMs();
}

function getNowDate() {
  return new Date(getNowMs());
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getRaceStaffEffects(state) {
  const staff = state.staff || [];
  if (!staff.length) {
    return {
      pitErrorChanceMult: 1,
      pitTimeGainChance: 0.45,
      undercutStrength: 0.5,
      overcutStrength: 0.5,
      incidentRiskMult: 1,
      overtakeBonus: 0,
      paceBonus: 0
    };
  }

  const pickByRole = (roleKey) => {
    const hit = staff.filter(s => ((s.role || '').toLowerCase().includes(roleKey.toLowerCase())));
    return hit.length ? hit : [];
  };

  const raceEngineers = pickByRole('race engineer');
  const pitHeads = pickByRole('head of pits');
  const chiefEngineers = pickByRole('chief engineer');
  const analysts = pickByRole('data analyst');

  const all = [...raceEngineers, ...pitHeads, ...chiefEngineers, ...analysts];
  const avg = (arr, key) => {
    if (!arr.length) return 50;
    const sum = arr.reduce((s, x) => s + (((x.attrs || {})[key]) || 50), 0);
    return sum / arr.length;
  };

  const pitSkill = avg([...raceEngineers, ...pitHeads], 'pitStrategy');
  const setupSkill = avg([...raceEngineers, ...analysts, ...chiefEngineers], 'setup');
  const techSkill = avg([...chiefEngineers, ...analysts], 'technical');

  return {
    pitErrorChanceMult: clamp(1.2 - (pitSkill / 120), 0.68, 1.15),
    pitTimeGainChance: clamp(0.2 + (pitSkill / 200), 0.25, 0.78),
    undercutStrength: clamp((pitSkill + setupSkill) / 220, 0.3, 1.0),
    overcutStrength: clamp((setupSkill + techSkill) / 220, 0.3, 1.0),
    incidentRiskMult: clamp(1.1 - (techSkill / 180), 0.74, 1.05),
    overtakeBonus: clamp((setupSkill - 60) / 300, -0.05, 0.12),
    paceBonus: clamp((setupSkill + techSkill - 120) / 500, 0, 0.12)
  };
}

function getHqCapabilities(state) {
  const hq = state.hq || {};
  const adminLv = hq.admin || 1;
  const rndLv = hq.rnd || 1;
  const factoryLv = hq.factory || 1;
  const academyLv = hq.academy || 1;
  const windLv = hq.wind_tunnel || 1;

  return {
    sponsorMultiplier: 1 + (adminLv >= 2 ? 0.1 : 0) + (adminLv >= 3 ? 0.05 : 0) + (adminLv >= 4 ? 0.05 : 0) + (adminLv >= 5 ? 0.1 : 0),
    rndUnlocked: rndLv >= 2,
    rndSpeedMultiplier: 1 + (rndLv >= 3 ? 0.25 : 0) + (rndLv >= 5 ? 0.15 : 0),
    factoryParallelSlots: factoryLv >= 3 ? 2 : 1,
    academyTrainingSlots: academyLv >= 3 ? 2 : 1,
    academyTrainingSpeedMultiplier: 1 + (academyLv >= 2 ? 0.1 : 0) + (academyLv >= 3 ? 0.2 : 0) + (academyLv >= 4 ? 0.25 : 0) + (academyLv >= 5 ? 0.45 : 0),
    academyInjuryRiskMultiplier: academyLv >= 5 ? 0.5 : 1,
    weatherResearchUnlocked: windLv >= 2
  };
}

// ---- Research/I+D Configuration ----
const RESEARCH_TREES = {
  acceleration: { name: 'Acceleration', icon: '⚡', maxLevel: 20, costPerLevel: (l) => 5000 + (l * 1000), durationPerLevel: (l) => 5 * 24 * 3600 * 1000, componentBoost: 'chassis', boostPerLevel: 2 },
  power: { name: 'Power', icon: '💪', maxLevel: 20, costPerLevel: (l) => 8000 + (l * 1500), durationPerLevel: (l) => 7 * 24 * 3600 * 1000, componentBoost: 'engine', boostPerLevel: 2 },
  reliability: { name: 'Reliability', icon: '🛡️', maxLevel: 20, costPerLevel: (l) => 6000 + (l * 1200), durationPerLevel: (l) => 6 * 24 * 3600 * 1000, componentBoost: 'reliability', boostPerLevel: 2.5 },
  weather: { name: 'Weather Mastery', icon: '🌧️', maxLevel: 20, costPerLevel: (l) => 7000 + (l * 1300), durationPerLevel: (l) => 7 * 24 * 3600 * 1000, componentBoost: 'aero', boostPerLevel: 2 }
};

function startResearch(treeId) {
  const state = S.getState();
  const caps = getHqCapabilities(state);
  if (!RESEARCH_TREES[treeId]) return { error: 'Tree not found' };
  if (!caps.rndUnlocked) return { error: 'R&D Centre Lv2 required' };
  if (treeId === 'weather' && !caps.weatherResearchUnlocked) return { error: 'Wind Tunnel Lv2 required' };
  const tree = RESEARCH_TREES[treeId];
  const rnd = state.car.rnd;
  if (rnd.active) return { error: 'Research already in progress' };
  const currentLevel = (rnd.queue && rnd.queue[treeId]) || 0;
  if (currentLevel >= tree.maxLevel) return { error: 'Max level reached' };
  const nextLevel = currentLevel + 1;
  const cost = tree.costPerLevel(nextLevel);
  let duration = tree.durationPerLevel(nextLevel);
  duration = Math.floor(duration / caps.rndSpeedMultiplier);
  if ((state.team.engineSupplier || '').toLowerCase() === 'vulcan') {
    duration = Math.floor(duration * 0.8);
  }
  if (state.finances.credits < cost) return { error: 'Insufficient funds' };
  state.finances.credits -= cost;
  rnd.active = { treeId, startTime: getNowMs(), duration, targetLevel: nextLevel, progress: 0 };
  S.saveState();
  return { success: true, treeId, cost, duration, targetLevel: nextLevel };
}

function processResearch(state) {
  const rnd = state.car.rnd;
  if (!rnd.active) return null;
  const tree = RESEARCH_TREES[rnd.active.treeId];
  const elapsed = getNowMs() - rnd.active.startTime;
  const progress = Math.min(100, (elapsed / rnd.active.duration) * 100);
  rnd.active.progress = progress;
  if (elapsed >= rnd.active.duration) {
    const treeId = rnd.active.treeId;
    const targetLevel = rnd.active.targetLevel;
    if (!rnd.queue) rnd.queue = {};
    rnd.queue[treeId] = targetLevel;
    const component = state.car.components[tree.componentBoost];
    if (component) component.score += tree.boostPerLevel;
    const completed = { ...rnd.active };
    rnd.active = null;
    S.saveState();
    return completed;
  }
  return rnd.active;
}

function getResearchStatus() {
  const state = S.getState();
  const rnd = state.car.rnd;
  const caps = getHqCapabilities(state);
  return Object.keys(RESEARCH_TREES).map(treeId => {
    const tree = RESEARCH_TREES[treeId];
    const currentLevel = (rnd.queue && rnd.queue[treeId]) || 0;
    const isActive = rnd.active && rnd.active.treeId === treeId;
    return {
      treeId,
      name: tree.name,
      icon: tree.icon,
      currentLevel,
      maxLevel: tree.maxLevel,
      nextCost: tree.costPerLevel(currentLevel + 1),
      nextDuration: tree.durationPerLevel(currentLevel + 1),
      isActive,
      progress: isActive ? rnd.active.progress : 0,
      nextComponentBoost: tree.componentBoost,
      unlocked: caps.rndUnlocked && (treeId !== 'weather' || caps.weatherResearchUnlocked)
    };
  });
}

function generateAITeamState(team, playerState) {
  const pseudoSponsors = [{ income: 5000 + Math.floor(Math.random() * 7000), expired: false }];
  const pseudoPilots = [{ salary: 9000 + Math.floor(Math.random() * 6000) }, { salary: 8000 + Math.floor(Math.random() * 5000) }];
  const pseudoStaff = [{ salary: 7000 + Math.floor(Math.random() * 4000) }];
  return {
    sponsors: pseudoSponsors,
    pilots: pseudoPilots,
    staff: pseudoStaff,
    hq: playerState.hq || { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 },
    finances: { credits: 0 }
  };
}

// ---- pilot overall score ----
function pilotScore(pilot) {
  if (!pilot) return 40;
  const a = pilot.attrs;
  return Math.round((a.pace + a.racePace + a.consistency + a.rain + a.tyre + a.aggression + a.overtake + a.techFB + a.mental + a.charisma) / 10);
}

// ---- car overall score ----
function carScore() {
  const c = S.getCar().components;
  const keys = Object.keys(c);
  return Math.round(keys.reduce((sum, k) => sum + c[k].score, 0) / keys.length);
}

function getCircuitProfile(circuit, weather) {
  const layout = (circuit && circuit.layout) || 'mixed';
  const byLayout = {
    'high-speed': { paceBias: 1.05, overtakeBias: 1.08, tyreDegMult: 0.95, riskBias: 1.08 },
    power: { paceBias: 1.06, overtakeBias: 1.04, tyreDegMult: 1.0, riskBias: 1.05 },
    technical: { paceBias: 0.98, overtakeBias: 0.9, tyreDegMult: 1.08, riskBias: 1.0 },
    mixed: { paceBias: 1.0, overtakeBias: 1.0, tyreDegMult: 1.0, riskBias: 1.0 },
    endurance: { paceBias: 0.96, overtakeBias: 0.92, tyreDegMult: 1.12, riskBias: 0.95 }
  };

  const p = byLayout[layout] || byLayout.mixed;
  const wetMod = weather === 'wet'
    ? { paceBias: 0.95, overtakeBias: 0.9, tyreDegMult: 1.1, riskBias: 1.2 }
    : { paceBias: 1.0, overtakeBias: 1.0, tyreDegMult: 1.0, riskBias: 1.0 };

  return {
    layout,
    paceBias: p.paceBias * wetMod.paceBias,
    overtakeBias: p.overtakeBias * wetMod.overtakeBias,
    tyreDegMult: p.tyreDegMult * wetMod.tyreDegMult,
    riskBias: p.riskBias * wetMod.riskBias
  };
}

function getSetupEffects(circuit, weather, setup = {}) {
  const layout = (circuit && circuit.layout) || 'mixed';
  const aeroBalance = typeof setup.aeroBalance === 'number' ? setup.aeroBalance : 50; // 0 power, 100 aero
  const wetBias = typeof setup.wetBias === 'number' ? setup.wetBias : 50; // 0 dry bias, 100 wet bias

  let layoutFit = 0;
  if (layout === 'high-speed' || layout === 'power') {
    layoutFit = (50 - aeroBalance) / 140;
  } else if (layout === 'technical') {
    layoutFit = (aeroBalance - 50) / 140;
  } else {
    layoutFit = (Math.abs(aeroBalance - 50) * -1) / 220;
  }

  const weatherFit = weather === 'wet'
    ? (wetBias - 50) / 120
    : (50 - wetBias) / 120;

  return {
    paceMult: 1 + layoutFit + weatherFit,
    riskMult: 1 - (weather === 'wet' ? (wetBias - 50) / 220 : (50 - wetBias) / 280),
    tyreMult: 1 + (Math.abs(aeroBalance - 50) / 260)
  };
}

// ---- build full grid (player + AI teams) ----
function buildRaceGrid(playerPilot, weather, circuit, strategy = {}) {
  const state = S.getState();
  const carData = S.getCar().components;
  const car = carScore();
  const pilot = pilotScore(playerPilot);
  const profile = getCircuitProfile(circuit, weather);
  const setupFx = getSetupEffects(circuit, weather, strategy.setup || {});
  const layout = profile.layout;

  const layoutCarComponent = {
    'high-speed': (carData.engine.score + carData.efficiency.score) / 2,
    power: (carData.engine.score + carData.gearbox.score) / 2,
    technical: (carData.brakes.score + carData.chassis.score + carData.aero.score) / 3,
    mixed: (carData.chassis.score + carData.aero.score + carData.reliability.score) / 3,
    endurance: (carData.reliability.score + carData.tyreManage.score + carData.efficiency.score) / 3
  };
  const trackCarBonus = ((layoutCarComponent[layout] || car) - 50) * 0.12;
  const aggressionBonus = ((strategy.aggression || 50) - 50) * 0.04;
  const rain = weather === 'wet' ? (playerPilot ? playerPilot.attrs.rain / 100 : 0.6) : 1;
  const playerBase = ((car * 0.5 + pilot * 0.5) + trackCarBonus + aggressionBonus) * rain * profile.paceBias * setupFx.paceMult;

  const grid = [{
    id: 'player',
    name: state.team.name || 'Your Team',
    color: state.team.colors.primary,
    isPlayer: true,
    base: playerBase,
    score: playerBase + (Math.random() - 0.5) * 12,
    tyre: 'medium', wear: 0, gaps: 0
  }];

  const aiCount = Math.min(D.AI_TEAMS.length, 11);
  for (let i = 0; i < aiCount; i++) {
    const t = D.AI_TEAMS[i];
    const aiBase = 35 + Math.random() * 35;
    const aiTrackBias = -2 + Math.random() * 5;
    const rainMod = weather === 'wet' ? (0.8 + Math.random() * 0.4) : 1;
    grid.push({
      id: t.id, name: t.name, color: t.color, isPlayer: false,
      base: (aiBase + aiTrackBias) * rainMod * profile.paceBias,
      score: (aiBase + aiTrackBias) * rainMod * profile.paceBias + (Math.random() - 0.5) * 10,
      tyre: ['soft','medium','hard'][Math.floor(Math.random() * 3)],
      wear: 0, gaps: 0
    });
  }
  grid.sort((a, b) => b.score - a.score);
  return grid;
}

// ---- tyre degradation per compound ----
const TYRE_DEG = { soft: 1.5, medium: 0.9, hard: 0.5 };
const TYRE_PACE = { soft: 8, medium: 0, hard: -4 };

function getEngineModeFx(mode) {
  const map = {
    eco: { pace: -0.05, risk: -0.15, tyre: -0.1 },
    normal: { pace: 0, risk: 0, tyre: 0 },
    push: { pace: 0.05, risk: 0.15, tyre: 0.12 }
  };
  return map[mode] || map.normal;
}

// ---- race simulation ----
function simulateRace(options = {}) {
  const state = S.getState();
  const staffFx = getRaceStaffEffects(state);
  const advisorMode = (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced';
  const { weather = 'dry', circuits, round } = options;
  const selectedPilotId = options.pilotId || (options.strategy && options.strategy.pilotId) || null;
  const pilot = (state.pilots || []).find((p) => p.id === selectedPilotId)
    || state.pilots[0]
    || { attrs:{ pace:55, racePace:55, consistency:60, rain:55, tyre:55, aggression:60, overtake:55, techFB:55, mental:55, charisma:60 }, name:'Driver' };
  const strategy = options.strategy || {
    tyre: 'medium', aggression: 50, pitLap: 35, riskLevel: 50, engineMode: 'normal', strategy: 'balanced', pitPlan: 'single', safetyCarReaction: 'live'
  };
  let currentEngineMode = strategy.engineMode || 'normal';
  const pitPlan = strategy.pitPlan || 'single';
  const profile = getCircuitProfile(circuits, weather);
  const forecast = options.forecast || null;
  const layoutLaps = { 'high-speed': 32, power: 31, technical: 30, mixed: 30, endurance: 34 };
  const totalLaps = layoutLaps[profile.layout] || 30;
  let liveWeather = weather;
  const interventions = Array.isArray(strategy.interventions) ? strategy.interventions : [];

  let grid = buildRaceGrid(pilot, liveWeather, circuits, strategy);
  const initialEngineFx = getEngineModeFx(currentEngineMode);
  grid = grid.map(g => ({
    ...g,
    score: g.score * (1 + initialEngineFx.pace * (g.isPlayer ? 1 : 0.35)) * (1 + (g.isPlayer ? staffFx.paceBonus : 0))
  }));
  const events = [];
  let safetyCarActive = false;

  // Qualify – sort with qualy weights
  grid.forEach(e => {
    e.qualyScore = e.score + (Math.random() - 0.5) * 8;
    if (e.isPlayer) {
      e.tyre = strategy.tyre;
    }
  });
  grid.sort((a, b) => b.qualyScore - a.qualyScore);
  const gridStart = grid.map(e => ({...e}));
  const playerStart = gridStart.findIndex(e => e.isPlayer) + 1;

  events.push({ lap: 0, type: 'info', text: `<strong>Qualifying P${playerStart}.</strong> ${liveWeather === 'wet' ? '🌧️ Wet track!' : '☀️ Dry conditions.'} ${circuits?.layout ? `· ${circuits.layout}` : ''}` });
  if (currentEngineMode !== 'normal') {
    events.push({ lap: 0, type: 'info', text: `⚙️ Engine mode set to <strong>${currentEngineMode.toUpperCase()}</strong>.` });
  }

  // Race ticks
  const positions = grid.map((e, i) => ({ ...e, pos: i + 1, laps: 0, pit: false, retired: false }));
  let playerPit = false;
  let pitStopsDone = 0;
  let playerWear = 0;
  let adaptivePitLap = Math.floor(strategy.pitLap / 100 * totalLaps) + 1;
  let maxPitStops = pitPlan === 'double' ? 2 : 1;
  if (pitPlan === 'adaptive' && (profile.tyreDegMult > 1.05 || weather === 'wet')) {
    maxPitStops = 2;
  }
  let adaptivePitLap2 = Math.min(totalLaps - 2, adaptivePitLap + Math.max(7, Math.round(totalLaps * 0.35)));

  for (let lap = 1; lap <= totalLaps; lap++) {
    const pIdx = positions.findIndex(e => e.isPlayer);
    const intervention = interventions.find(it => Math.floor((it.lapPct || 0) / 100 * totalLaps) + 1 === lap);
    if (intervention) {
      if (intervention.pitBias === 'early' && !playerPit) {
        adaptivePitLap = Math.max(2, adaptivePitLap - 2);
        events.push({ lap, type: 'info', text: '🎛️ Tactical intervention: pit window pulled earlier.' });
      }
      if (intervention.pitBias === 'late' && !playerPit) {
        adaptivePitLap = Math.min(totalLaps - 2, adaptivePitLap + 2);
        events.push({ lap, type: 'info', text: '🎛️ Tactical intervention: pit window delayed.' });
      }
    }

    const engineFx = getEngineModeFx(currentEngineMode);

    const uncertainty = forecast ? (1 - ((forecast.confidence || 60) / 100)) : 0.35;
    const weatherFlipChance = 0.02 + (uncertainty * 0.08);
    if (Math.random() < weatherFlipChance) {
      liveWeather = liveWeather === 'wet' ? 'dry' : 'wet';
      events.push({ lap, type: 'info', text: liveWeather === 'wet' ? '🌧️ Sudden rain hits the circuit!' : '☀️ Track is drying quickly.' });
    }

    const lapProfile = getCircuitProfile(circuits, liveWeather);
    const setupFx = getSetupEffects(circuits, liveWeather, strategy.setup || {});

    // Safety car event
    if (!safetyCarActive && Math.random() < 0.06) {
      safetyCarActive = true;
      events.push({ lap, type: 'safety', text: `🟡 <strong>Virtual Safety Car deployed!</strong> Pack bunches up.` });
      // Shuffle slightly when SC out
      positions.forEach(p => { if (!p.isPlayer && !p.retired) p.pos += (Math.random() < 0.3 ? -1 : 0); });

      let liveSafetyCarCall = 'neutral';
      const staffDelta = (staffFx.undercutStrength || 0.5) - (staffFx.overcutStrength || 0.5);
      if (pitStopsDone < maxPitStops) {
        if (staffDelta > 0.08) liveSafetyCarCall = 'undercut';
        else if (staffDelta < -0.08) liveSafetyCarCall = 'overcut';
      }

      const underPct = Math.round((staffFx.undercutStrength || 0.5) * 100);
      const overPct = Math.round((staffFx.overcutStrength || 0.5) * 100);
      events.push({
        lap,
        type: 'info',
        text: `👥 Live pit wall call: <strong>${liveSafetyCarCall.toUpperCase()}</strong> (Undercut ${underPct}% · Overcut ${overPct}%).`
      });

      if (liveSafetyCarCall === 'undercut' && pitStopsDone < maxPitStops) {
        const undercutWorks = Math.random() < staffFx.undercutStrength;
        if (pitStopsDone === 0 && adaptivePitLap - lap <= 3) {
          adaptivePitLap = Math.max(lap + 1, undercutWorks ? 2 : adaptivePitLap - 1);
          events.push({ lap, type: 'info', text: undercutWorks ? '🧠 Undercut call under VSC: pit brought forward.' : '🧠 Undercut attempt: minor gain only.' });
        } else if (pitStopsDone === 1 && adaptivePitLap2 - lap <= 3) {
          adaptivePitLap2 = Math.max(lap + 1, undercutWorks ? adaptivePitLap2 - 1 : adaptivePitLap2);
          events.push({ lap, type: 'info', text: undercutWorks ? '🧠 Undercut second stop under VSC.' : '🧠 Undercut second stop: no clear window.' });
        }
      }
      if (liveSafetyCarCall === 'overcut' && pitStopsDone < maxPitStops) {
        const overcutWorks = Math.random() < staffFx.overcutStrength;
        if (pitStopsDone === 0 && lap >= adaptivePitLap - 2) {
          adaptivePitLap = Math.min(totalLaps - 3, adaptivePitLap + (overcutWorks ? 2 : 1));
          events.push({ lap, type: 'info', text: overcutWorks ? '🧠 Overcut call under VSC: extending current stint.' : '🧠 Overcut attempt: small extension only.' });
        } else if (pitStopsDone === 1 && lap >= adaptivePitLap2 - 2) {
          adaptivePitLap2 = Math.min(totalLaps - 2, adaptivePitLap2 + (overcutWorks ? 2 : 1));
          events.push({ lap, type: 'info', text: overcutWorks ? '🧠 Overcut second stop under VSC.' : '🧠 Overcut second stop: weak delta.' });
        }
      }
    }
    if (safetyCarActive && Math.random() < 0.4) {
      safetyCarActive = false;
      events.push({ lap, type: 'info', text: `🟢 Safety car period ends. Green flag!` });
    }

    if ((strategy.strategy === 'tactical' || strategy.strategy === 'balanced') && pitStopsDone < maxPitStops) {
      const nextPlannedPit = pitStopsDone === 0 ? adaptivePitLap : adaptivePitLap2;
      if (liveWeather === 'wet' && playerWear > 18 && lap >= nextPlannedPit - 3) {
        if (pitStopsDone === 0) adaptivePitLap = Math.max(2, lap);
        else adaptivePitLap2 = Math.max(lap, Math.min(totalLaps - 1, adaptivePitLap2));
        events.push({ lap, type: 'info', text: '🧠 Tactical call: early pit due to rain transition.' });
      } else if (liveWeather === 'dry' && playerWear < 12 && lap < nextPlannedPit - 3) {
        if (pitStopsDone === 0) adaptivePitLap = Math.min(totalLaps - 2, adaptivePitLap + 1);
        else adaptivePitLap2 = Math.min(totalLaps - 1, adaptivePitLap2 + 1);
      }
    }

    // Player pit stop
    const nextPitLap = pitStopsDone === 0 ? adaptivePitLap : adaptivePitLap2;
    if (pitStopsDone < maxPitStops && lap === nextPitLap) {
      playerPit = true;
      pitStopsDone++;
      playerWear = 0;
      const newTyre = liveWeather === 'wet'
        ? 'medium'
        : (pitStopsDone === 1
            ? (strategy.tyre === 'soft' ? 'hard' : (strategy.tyre === 'hard' ? 'medium' : 'hard'))
            : 'soft');
      const cleanStop = Math.random() < staffFx.pitTimeGainChance;
      const pitError = Math.random() < (0.14 * staffFx.pitErrorChanceMult);
      const playerIdx = positions.findIndex(p => p.isPlayer);
      positions[playerIdx].tyre = newTyre;
      if (pitError) {
        positions[playerIdx].pos = Math.min(positions.length, positions[playerIdx].pos + 2);
        events.push({ lap, type: 'incident', text: `🔧 <strong>${pilot.name}</strong> pit error! Loses time leaving the box.` });
      } else if (cleanStop) {
        positions[playerIdx].pos = Math.max(1, positions[playerIdx].pos - 1);
        events.push({ lap, type: 'good', text: `🔵 <strong>${pilot.name}</strong> nails the pit stop and gains track position!` });
      } else {
        events.push({ lap, type: 'pit', text: `🔵 <strong>${pilot.name} pits (stop ${pitStopsDone}/${maxPitStops})!</strong> Switches to ${newTyre} tyres. Standard execution.` });
      }

      if (pitStopsDone === 1 && maxPitStops > 1) {
        adaptivePitLap2 = Math.max(adaptivePitLap2, lap + 6);
        adaptivePitLap2 = Math.min(adaptivePitLap2, totalLaps - 2);
      }
    }

    // Incidents
    positions.forEach(p => {
      if (!p.retired && !p.isPlayer) {
        if (Math.random() < 0.012) {
          p.retired = true;
          events.push({ lap, type: 'incident', text: `💥 <strong>${p.name}</strong> retires with mechanical failure!` });
        }
      }
    });
    // Player incident
    if (pIdx >= 0 && !positions[pIdx].retired) {
      const riskFactor = strategy.riskLevel / 100;
      if (Math.random() < (0.008 * riskFactor + 0.005) * lapProfile.riskBias * (1 + engineFx.risk) * staffFx.incidentRiskMult * setupFx.riskMult) {
        if (Math.random() < 0.3) {
          positions[pIdx].retired = true;
          events.push({ lap, type: 'incident', text: `💥 <strong>${pilot.name} retires!</strong> Mechanical issue. DNF.` });
        } else {
          const lostPos = Math.floor(Math.random() * 3) + 1;
          positions[pIdx].pos = Math.min(positions.length, positions[pIdx].pos + lostPos);
          events.push({ lap, type: 'incident', text: `⚠️ <strong>${pilot.name}</strong> has a spin! Drops ${lostPos} position(s).` });
        }
      }
    }

    // Overtake / position battles every 5 laps
    if (lap % 5 === 0 && pIdx >= 0 && !positions[pIdx].retired) {
      const p = positions[pIdx];
      const ahead = positions.find(x => x.pos === p.pos - 1 && !x.retired);
      if (ahead && Math.random() < ((((0.3 + (strategy.aggression / 200)) * lapProfile.overtakeBias) + staffFx.overtakeBonus) * (1 + Math.max(0, engineFx.pace)) * Math.max(0.9, setupFx.paceMult))) {
        p.pos--;
        ahead.pos++;
        events.push({ lap, type: 'good', text: `✅ <strong>${pilot.name}</strong> overtakes <strong>${ahead.name}</strong>! Moves up to P${p.pos}.` });
      }

      // Good laptime
      if (Math.random() < 0.15) {
        events.push({ lap, type: 'good', text: `🟢 Personal best lap by <strong>${pilot.name}</strong> on lap ${lap}.` });
      }
    }

    // Tyre wear event
    const weatherTyreMult = liveWeather === 'wet' ? 1.15 : 1;
    const currentTyre = positions[pIdx] && positions[pIdx].tyre ? positions[pIdx].tyre : strategy.tyre;
    playerWear += (TYRE_DEG[currentTyre] || 0.9) * lapProfile.tyreDegMult * weatherTyreMult * (1 + engineFx.tyre) * setupFx.tyreMult;
    if (playerWear > 30 && playerWear < 32 && pIdx >= 0 && !positions[pIdx].retired) {
      events.push({ lap, type: 'incident', text: `⚠️ Tyre performance dropping significantly for <strong>${pilot.name}</strong>.` });
    }
  }

  // Final sort and position
  const activePositions = positions.filter(p => !p.retired).sort((a, b) => a.pos - b.pos);
  const retiredPositions = positions.filter(p => p.retired);
  const finalGrid = [...activePositions, ...retiredPositions];
  const playerIdxFinal = positions.findIndex((p) => p.isPlayer);

  let playerFinalPos = finalGrid.findIndex(p => p.isPlayer) + 1;
  if (playerIdxFinal >= 0 && positions[playerIdxFinal].retired) playerFinalPos = finalGrid.length;

  const points = D.POINTS_TABLE[playerFinalPos - 1] || 0;
  const isDNF = playerIdxFinal >= 0 ? positions[playerIdxFinal].retired : false;

  // Closing event
  if (!isDNF) {
    events.push({ lap: totalLaps, type: playerFinalPos <= 3 ? 'good' : 'info', text: `🏁 <strong>RACE FINISH: P${playerFinalPos}</strong> for ${pilot.name}. ${points > 0 ? points + ' points scored!' : 'No points this time.'}` });
  }

  // Calculate financials
  const prizeMap = [50000,40000,35000,25000,20000,15000,12000,10000,8000,5000,3000,2000,1500,1000,500,300];
  const prizeMoney = prizeMap[playerFinalPos - 1] || 200;

  return {
    position: playerFinalPos,
    isDNF,
    points,
    events,
    finalGrid,
    gridStart,
    weather: liveWeather,
    circuit: circuits,
    circuitProfile: profile,
    staffImpact: staffFx,
    forecastUsed: forecast,
    totalLaps,
    prizeMoney,
    fastestLap: !isDNF && playerFinalPos <= 5 && Math.random() < 0.2,
    improvement: playerFinalPos - playerStart,
  };
}

function processWeeklyAgreementLifecycle(state) {
  const changes = {
    sponsorsExpired: 0,
    contractsExpired: 0
  };

  const tickEntry = (entry, defaultWeeks) => {
    if (!entry || entry.expired) return;

    const fallbackWeeks = Number(entry.duration) || defaultWeeks;
    if (typeof entry.weeksLeft !== 'number' || Number.isNaN(entry.weeksLeft)) {
      entry.weeksLeft = fallbackWeeks;
    }

    entry.weeksLeft = Math.max(0, Math.floor(entry.weeksLeft - 1));
    if (entry.weeksLeft <= 0) {
      entry.expired = true;
    }
  };

  const sponsors = Array.isArray(state.sponsors) ? state.sponsors : [];
  sponsors.forEach((sp) => {
    const wasExpired = !!sp.expired;
    tickEntry(sp, 8);
    if (!wasExpired && sp.expired) {
      changes.sponsorsExpired += 1;
      S.addLog(`📉 Sponsor deal expired: ${sp.name || 'Unknown sponsor'}.`, 'warning');
    }
  });

  const contracts = Array.isArray(state.contracts) ? state.contracts : [];
  contracts.forEach((ct) => {
    const wasExpired = !!ct.expired;
    tickEntry(ct, 12);
    if (!wasExpired && ct.expired) {
      changes.contractsExpired += 1;
      S.addLog(`📄 Contract expired: ${ct.name || ct.id || 'Unnamed contract'}.`, 'warning');
    }
  });

  return changes;
}

// ---- weekly economy tick ----
function weeklyTick() {
  // Generar pool de scouting semanal automáticamente
  if (typeof window !== 'undefined' && window.Academy) {
    window.Academy.generateScoutingPool(S.getState());
  }
  const state = S.getState();
  ensureCampaignObjective(state);
  const completedWeek = state.season.week;
  let playerEconomy = { income: 0, expenses: 0, net: 0 };

  // Procesar economía semanal para todos los equipos de la división
  const divisionTeams = [
    { id: 'player', state },
    ...((window.GL_DATA && window.GL_DATA.AI_TEAMS) ? window.GL_DATA.AI_TEAMS.slice(0, 9).map(t => ({ id: t.id, state: generateAITeamState(t, state) })) : [])
  ];
  divisionTeams.forEach(team => {
    const { income, expenses, net, effects } = EconomyApi.processWeeklyBalance(team.state);
    if (team.id === 'player') {
      playerEconomy = { income, expenses, net, effects };
      S.addCredits(net);
      S.getState().finances.history.push({ week: state.season.week, income, expenses, net });
      if (S.getState().finances.history.length > 52) S.getState().finances.history.shift();
    } else {
      // Persistir economía semanal de AI/MMO en standings
      const standing = S.getState().standings.find(s => s.id === team.id);
      if (standing) {
        if (!standing.economyHistory) standing.economyHistory = [];
        standing.economyHistory.push({ week: state.season.week, income, expenses, net });
        if (standing.economyHistory.length > 52) standing.economyHistory.shift();
      }
    }
  });

  const agreementChanges = processWeeklyAgreementLifecycle(state);
  if (agreementChanges.sponsorsExpired > 0 || agreementChanges.contractsExpired > 0) {
    S.addLog(`Agreements update: ${agreementChanges.sponsorsExpired} sponsor(s) expired, ${agreementChanges.contractsExpired} contract(s) expired.`, 'info');
  }

  // Procesar progresión de pilotos y entrenamientos
  AcademyApi.processActiveTraining(state);

  // Procesar investigación activa
  const researchCompleted = processResearch(state);
  if (researchCompleted) {
    const treeId = researchCompleted.treeId;
    const tree = RESEARCH_TREES[treeId];
    S.addLog(`${tree.icon} Research: ${tree.name} Lv${researchCompleted.targetLevel} completed!`, 'good');
  }

  // Avanzar semana y controlar fin de temporada
  S.getState().season.week++;
  if (S.getState().season.week > S.getState().season.totalRaces) {
    endSeason();
  } else {
    const effects = playerEconomy.effects || {};
    if (effects.critical) {
      S.addLog('CRITICAL deficit streak (3+ weeks). Team morale and fanbase impacted.', 'bad');
    } else if (playerEconomy.net < 0) {
      S.addLog(`Deficit streak: ${effects.streak || 1} week(s). Stabilize spending to avoid critical penalties.`, 'warning');
    } else if ((effects.notes || []).includes('recovery')) {
      S.addLog('Positive week recorded. Deficit pressure is recovering.', 'good');
    }
    S.addLog(`Week ${completedWeek} complete. Net: ${playerEconomy.net > 0 ? '+' : ''}${playerEconomy.net.toLocaleString()} CR`, playerEconomy.net >= 0 ? 'good' : 'bad');
    S.saveState();
  }

  // Trigger random event
  if (Math.random() < 0.35) generateRandomEvent();

  return playerEconomy;
}

function getDivisionTransition(state, finalPosition) {
  const currentDivision = Number(state?.season?.division) || 8;
  const config = (DivisionsApi && DivisionsApi.getDivisionConfig)
    ? DivisionsApi.getDivisionConfig(currentDivision)
    : { teams: 10, promotions: 2, relegations: 2 };
  const teams = Number(config?.teams) || 10;
  const promotions = Number(config?.promotions) || 2;
  const relegations = Number(config?.relegations) || 2;
  const relegationStart = Math.max(1, (teams - relegations) + 1);

  if (finalPosition <= promotions && currentDivision > 1) {
    return { result: 'promoted', nextDivision: currentDivision - 1 };
  }
  if (finalPosition >= relegationStart && currentDivision < 10) {
    return { result: 'relegated', nextDivision: currentDivision + 1 };
  }
  return { result: 'stable', nextDivision: currentDivision };
}

function getCampaignPhaseByYear(year) {
  const y = Number(year) || 1;
  if (y <= 2) return 'phase1';
  if (y <= 4) return 'phase2';
  return 'phase3';
}

function buildCampaignObjective(state) {
  const phase = getCampaignPhaseByYear(state?.season?.year);
  if (phase === 'phase1') {
    return {
      id: 'phase1_survive_prove',
      phase,
      titleKey: 'campaign_objective_phase1_title',
      descKey: 'campaign_objective_phase1_desc',
      rewardCredits: 100000,
      completed: false,
      progressTextKey: 'campaign_objective_phase1_progress'
    };
  }
  if (phase === 'phase2') {
    return {
      id: 'phase2_climb',
      phase,
      titleKey: 'campaign_objective_phase2_title',
      descKey: 'campaign_objective_phase2_desc',
      rewardCredits: 150000,
      completed: false,
      progressTextKey: 'campaign_objective_phase2_progress'
    };
  }
  return {
    id: 'phase3_dynasty',
    phase,
    titleKey: 'campaign_objective_phase3_title',
    descKey: 'campaign_objective_phase3_desc',
    rewardCredits: 250000,
    completed: false,
    progressTextKey: 'campaign_objective_phase3_progress'
  };
}

function ensureCampaignObjective(state) {
  if (!state.campaign) state.campaign = { phase: 'phase1', activeObjectiveId: 'phase1_survive_prove', history: [] };
  if (!Array.isArray(state.campaign.history)) state.campaign.history = [];
  if (!Array.isArray(state.objectives)) state.objectives = [];

  const expectedPhase = getCampaignPhaseByYear(state?.season?.year);
  const current = state.objectives.find((o) => o && o.type === 'campaign' && o.phase === expectedPhase && !o.completed);
  if (current) {
    state.campaign.phase = expectedPhase;
    state.campaign.activeObjectiveId = current.id;
    return current;
  }

  const nextObjective = buildCampaignObjective(state);
  nextObjective.type = 'campaign';
  nextObjective.createdAt = Date.now();
  state.objectives = state.objectives.filter((o) => !(o && o.type === 'campaign' && !o.completed));
  state.objectives.unshift(nextObjective);
  state.campaign.phase = nextObjective.phase;
  state.campaign.activeObjectiveId = nextObjective.id;
  return nextObjective;
}

function evaluateCampaignObjective(state, seasonSummary) {
  if (!Array.isArray(state.objectives)) return null;
  const objective = state.objectives.find((o) => o && o.type === 'campaign' && !o.completed);
  if (!objective) return null;

  let completed = false;
  const finishPos = Number(seasonSummary?.finishPosition) || 99;
  const division = Number(seasonSummary?.division || state?.season?.division) || 8;
  const criticalDeficit = !!state?.finances?.criticalDeficit;

  if (objective.id === 'phase1_survive_prove') {
    completed = (finishPos <= 3) && !criticalDeficit;
  } else if (objective.id === 'phase2_climb') {
    completed = division <= 5;
  } else if (objective.id === 'phase3_dynasty') {
    completed = division === 1 && finishPos === 1;
  }

  if (!completed) return { objective, completed: false };

  objective.completed = true;
  objective.completedAt = Date.now();
  objective.lastResult = {
    year: seasonSummary?.year,
    division,
    finishPosition: finishPos
  };

  const rewardCredits = Number(objective.rewardCredits) || 0;
  if (rewardCredits > 0) S.addCredits(rewardCredits);

  if (!Array.isArray(state.campaign.history)) state.campaign.history = [];
  state.campaign.history.push({
    id: objective.id,
    phase: objective.phase,
    year: seasonSummary?.year,
    completedAt: Date.now(),
    rewardCredits
  });
  if (state.campaign.history.length > 20) state.campaign.history = state.campaign.history.slice(-20);

  const tr = (typeof window !== 'undefined' && typeof window.__ === 'function') ? window.__ : ((k) => k);
  S.addLog(`${tr('campaign_objective_completed_prefix')} ${tr(objective.titleKey)} (+${rewardCredits.toLocaleString()} CR).`, 'good');
  return { objective, completed: true, rewardCredits };
}

function getCampaignStatus() {
  const state = S.getState();
  if (!state) return null;
  const current = ensureCampaignObjective(state);
  const history = Array.isArray(state?.campaign?.history) ? state.campaign.history : [];
  return {
    phase: state?.campaign?.phase || current?.phase || 'phase1',
    objective: current || null,
    historyCount: history.length,
    recentHistory: history.slice(-5).reverse()
  };
}

// Reinicia temporada, asciende/desciende, reinicia tecnología
function endSeason() {
  const state = S.getState();
  const completedYear = Number(state?.season?.year) || 1;
  const completedDivision = Number(state?.season?.division) || 8;
  state.season.phase = 'offseason';

  // Ranking final ordenado para capturar snapshot de cierre.
  const standings = (state.standings || []).slice().sort((a, b) => {
    const aPos = Number(a?.position) || 999;
    const bPos = Number(b?.position) || 999;
    return aPos - bPos;
  });
  const myStanding = standings.find((s) => s.id === 'player') || S.getMyStanding() || { position: 10, points: 0, wins: 0 };
  const finalPosition = Number(myStanding.position) || 10;
  const finalPoints = Number(myStanding.points) || 0;
  const finalWins = Number(myStanding.wins) || 0;
  const transition = getDivisionTransition(state, finalPosition);

  const bonusCredits = finalPosition <= 3 ? 100000 : 0;
  if (bonusCredits > 0) {
    S.addCredits(bonusCredits);
  }

  state.season.division = transition.nextDivision;

  const seasonSummary = {
    year: completedYear,
    division: completedDivision,
    finishPosition: finalPosition,
    points: finalPoints,
    wins: finalWins,
    result: transition.result,
    nextDivision: transition.nextDivision,
    bonusCredits,
    ts: Date.now()
  };

  const campaignResult = evaluateCampaignObjective(state, seasonSummary);
  if (campaignResult && campaignResult.objective) {
    seasonSummary.campaign = {
      id: campaignResult.objective.id,
      titleKey: campaignResult.objective.titleKey,
      completed: !!campaignResult.completed,
      rewardCredits: Number(campaignResult.rewardCredits) || 0
    };
  }

  if (!Array.isArray(state.seasonHistory)) state.seasonHistory = [];
  state.seasonHistory.push(seasonSummary);
  if (state.seasonHistory.length > 20) state.seasonHistory = state.seasonHistory.slice(-20);
  state.season.lastSummary = seasonSummary;
  state.season.lastSummaryPending = true;

  // Reiniciar tecnología (I+D) por cambio de temporada.
  state.car.rnd = { points: 0, active: null, queue: [] };

  // Nueva temporada
  state.season.year = completedYear + 1;
  state.season.week = 1;
  state.season.raceIndex = 0;

  // Regenerar calendario
  if (typeof window !== 'undefined' && window.generateCalendar) {
    state.season.calendar = window.generateCalendar(state.season.division);
  } else if (D && D.generateCalendar) {
    state.season.calendar = D.generateCalendar(state.season.division);
  }
  if (!Array.isArray(state.season.calendar)) state.season.calendar = [];
  state.season.totalRaces = state.season.calendar.length || state.season.totalRaces || 8;
  const nextRaceIdx = state.season.calendar.findIndex((r) => r && r.status === 'next');
  state.season.raceIndex = nextRaceIdx >= 0 ? nextRaceIdx : 0;

  // Regenerar standings (jugador + AI)
  state.standings = buildInitialStandings(state.season.division);

  state.season.phase = 'season';
  ensureCampaignObjective(state);
  const statusMsg = transition.result === 'promoted'
    ? ' Promoted!'
    : (transition.result === 'relegated' ? ' Relegated!' : '');
  const bonusMsg = bonusCredits > 0 ? ` Top 3 bonus: +${bonusCredits.toLocaleString()} CR.` : '';
  S.addLog(`Season ${state.season.year} started!${statusMsg}${bonusMsg}`, 'info');
  S.saveState();
}

// ---- hq construction timer ----
function updateConstructionQueue() {
  const state = S.getState();
  const c = state.construction;
  if (!c || !c.active) return false;
  
  if (getNowMs() >= c.startTime + c.durationMs) {
    // Complete construction
    state.hq[c.buildingId] = c.targetLevel;
    
    // Log
    const bNames = { wind_tunnel: 'Túnel de Viento', rnd: 'I+D', factory: 'Fábrica', academy: 'Academia', admin: 'Administración' };
    S.addLog(`🏗️ ${bNames[c.buildingId] || c.buildingId} completado (Nivel ${c.targetLevel})`, 'good');
    
    // Clear queue
    c.active = false;
    c.buildingId = null;
    c.startTime = 0;
    c.durationMs = 0;
    c.targetLevel = 0;
    
    S.saveState();
    return true;
  }
  return false;
}

// ---- start hq upgrade ----
function startHqUpgrade(buildingId, cost, durationMs, targetLevel, useToken = false) {
  const state = S.getState();
  if (state.construction.active) {
    return { ok: false, msg: 'Ya hay una construcción en curso' };
  }
  
  // Apply Vulcan Tech bonus if they have it
  let finalDuration = durationMs;
  if ((state.team.engineSupplier || '').toLowerCase() === 'vulcan') {
    finalDuration = Math.floor(finalDuration * 0.85);
  }
  
  // Apply token speedup if requested (e.g. 70% reduction)
  if (useToken) {
    if (!S.spendTokens(5)) return { ok: false, msg: 'Tokens insuficientes (5 necesarios)' };
    finalDuration = Math.floor(finalDuration * 0.3);
  } else {
    if (!S.spendCredits(cost)) {
      return { ok: false, msg: `Saldo insuficiente. Necesitas ${cost.toLocaleString()} CR` };
    }
  }

  state.construction = {
    active: true,
    buildingId: buildingId,
    startTime: getNowMs(),
    durationMs: finalDuration,
    targetLevel: targetLevel
  };
  S.saveState();
  return { ok: true, durationMs: finalDuration };
}

// ---- generate random event ----
function generateRandomEvent() {
  const state = S.getState();
  const t = D.RANDOM_EVENT_TEMPLATES[Math.floor(Math.random() * D.RANDOM_EVENT_TEMPLATES.length)];
  const ev = { ...t, id: t.id + '_' + Date.now() };

  // Fill in template variables
  if (state.sponsors.length && ev.text.includes('{{sponsor}}')) {
    ev.text = ev.text.replace('{{sponsor}}', state.sponsors[0].name);
  }
  if (state.pilots.length && ev.text.includes('{{pilot}}')) {
    ev.text = ev.text.replace('{{pilot}}', state.pilots[Math.floor(Math.random() * state.pilots.length)].name);
  }
  if (state.staff.length && ev.text.includes('{{staff}}')) {
    ev.text = ev.text.replace('{{staff}}', state.staff[Math.floor(Math.random() * state.staff.length)].name);
  }
  ev.text = ev.text.replace('{{component}}', ['engine','gearbox','brakes','suspension'][Math.floor(Math.random()*4)]);

  S.addRandomEvent(ev);
  return ev;
}

// ---- apply random event choice ----
function applyEventChoice(event, choiceIndex) {
  const state = S.getState();
  const choice = event.choices[choiceIndex];

  // Simple effects based on event type and choice
  if (event.id.startsWith('re9')) {
    if (choiceIndex === 0) { S.addCredits(15000); S.addLog('💰 Received +15,000 CR bonus!', 'good'); }
    else { S.addTokens(8); S.addLog('🪙 Received +8 tokens!', 'good'); }
  } else if (event.id.startsWith('re4') && choiceIndex === 0) {
    S.spendCredits(5000);
    const car = S.getCar();
    Object.keys(car.components).forEach(k => { car.components[k].score = Math.min(99, car.components[k].score + 10); });
    S.addLog('⚙️ Tech partnership accepted! All car stats +10', 'good');
  } else if (event.id.startsWith('re5') && choiceIndex === 0) {
    S.spendCredits(8000);
    S.addLog('🔧 Mechanical issue repaired!', 'info');
  } else if (event.id.startsWith('re7')) {
    if (choiceIndex === 0) {
      const st = state.staff[0];
      if (st) { st.salary = Math.round(st.salary * 1.25); S.addLog(`💼 Counter-offered ${st.name}. Salary increased.`, 'info'); }
    } else {
      if (state.staff.length) { state.staff.shift(); S.addLog('👋 Staff member left the team.', 'bad'); }
    }
  } else if (event.id.startsWith('re11') && choiceIndex === 0) {
    S.getState().finances.weeklyIncome = (S.getState().finances.weeklyIncome || 0) + 500;
    S.addLog('📦 Merchandise income boosted!', 'good');
  }
  S.saveState();
}

// ---- build initial AI standings ----
function buildInitialStandings(division) {
  const teams = D.AI_TEAMS.slice(0, 9);
  const standings = teams.map((t, i) => ({
    id: t.id, name: t.name, color: t.color, flag: t.flag,
    points: 0, wins: 0, position: i + 2, bestResult: 0
  }));
  standings.unshift({
    id: 'player', name: S.getState().team.name || 'Your Team',
    color: S.getState().team.colors.primary, flag: '',
    points: 0, wins: 0, position: 1, bestResult: 0
  });
  return standings;
}

// ---- update standings after race ----
function updateStandings(raceResult) {
  const state = S.getState();
  let standings = state.standings;
  const { position, points, finalGrid } = raceResult;

  // Update player
  const playerEntry = standings.find(s => s.id === 'player');
  if (playerEntry) {
    playerEntry.points += points;
    if (position === 1) playerEntry.wins++;
    if (!playerEntry.bestResult || position < playerEntry.bestResult) playerEntry.bestResult = position;
  }

  // Update AI
  finalGrid.forEach((car, idx) => {
    if (!car.isPlayer) {
      const entry = standings.find(s => s.id === car.id);
      if (entry) {
        const aiPts = D.POINTS_TABLE[idx] || 0;
        entry.points += aiPts;
        if (idx === 0) entry.wins++;
      }
    }
  });

  // Sort and re-assign positions
  standings.sort((a, b) => b.points - a.points || b.wins - a.wins);
  standings.forEach((s, i) => { s.position = i + 1; });
  state.standings = standings;
  S.saveState();
}
// ---- get next real-world race date ----
function getNextRaceDate() {
  const now = getNowDate();
  const currentDay = now.getDay();
  const currentHours = now.getHours();

  let nextEvent = new Date(now);
  nextEvent.setHours(18, 0, 0, 0);

  let daysToAdd = 0;
  let type = '';

  if (currentDay === 0) { // Sunday
    if (currentHours >= 18) {
      daysToAdd = 3; type = 'practice'; // Next is Wed
    } else {
      daysToAdd = 0; type = 'race'; // Today is Sun
    }
  } else if (currentDay === 1) { // Mon
    daysToAdd = 2; type = 'practice';
  } else if (currentDay === 2) { // Tue
    daysToAdd = 1; type = 'practice';
  } else if (currentDay === 3) { // Wed
    if (currentHours >= 18) {
      daysToAdd = 4; type = 'race'; // Next is Sun
    } else {
      daysToAdd = 0; type = 'practice'; // Today is Wed
    }
  } else if (currentDay === 4) { // Thu
    daysToAdd = 3; type = 'race';
  } else if (currentDay === 5) { // Fri
    daysToAdd = 2; type = 'race';
  } else if (currentDay === 6) { // Sat
    daysToAdd = 1; type = 'race';
  }

  nextEvent.setDate(now.getDate() + daysToAdd);
  return { date: nextEvent, type };
}

function refreshForecastForNextRace() {
  const state = S.getState();
  const cal = (state && state.season && state.season.calendar) ? state.season.calendar : [];
  const nextRace = cal.find(r => r.status === 'next');
  if (!nextRace || !nextRace.circuit) return null;

  if (!nextRace.forecast) {
    const wetBase = Math.max(5, Math.min(95, 100 - (nextRace.circuit.weather || 70)));
    nextRace.forecast = {
      confidence: 60,
      windows: [
        { label: 'start', wetProb: wetBase },
        { label: 'mid', wetProb: wetBase },
        { label: 'end', wetProb: wetBase }
      ],
      lastUpdateBucket: null
    };
  }

  const nowMs = getNowMs();
  const nextRaceObj = getNextRaceDate();
  const hoursToRace = Math.max(0, (nextRaceObj.date.getTime() - nowMs) / 3600000);

  // Buckets to avoid noisy re-rolling every render
  // 4: >48h, 3: 24-48h, 2: 6-24h, 1: <=6h
  const bucket = hoursToRace > 48 ? 4 : (hoursToRace > 24 ? 3 : (hoursToRace > 6 ? 2 : 1));
  if (nextRace.forecast.lastUpdateBucket === bucket) {
    return nextRace.forecast;
  }

  const confidenceByBucket = { 4: 62, 3: 72, 2: 82, 1: 92 };
  const blendByBucket = { 4: 0.2, 3: 0.35, 2: 0.5, 1: 0.68 };
  const noiseByBucket = { 4: 10, 3: 7, 2: 4, 1: 2 };

  const forecast = nextRace.forecast;
  const isWetRace = nextRace.weather === 'wet';
  const targets = isWetRace
    ? [70, 78, 74]
    : [30, 22, 26];

  forecast.confidence = Math.max(
    forecast.confidence || 60,
    confidenceByBucket[bucket]
  );

  const alpha = blendByBucket[bucket];
  const noise = noiseByBucket[bucket];
  forecast.windows = (forecast.windows || []).map((w, idx) => {
    const current = typeof w.wetProb === 'number' ? w.wetProb : 50;
    const drift = (targets[idx] - current) * alpha;
    const jitter = Math.floor(Math.random() * (noise * 2 + 1)) - noise;
    const wetProb = Math.max(5, Math.min(95, Math.round(current + drift + jitter)));
    return { ...w, wetProb };
  });

  forecast.lastUpdateBucket = bucket;
  S.saveState();
  return forecast;
}

function emptyAdvisorTelemetryBucket() {
  return { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 };
}

function ensureAdvisorTelemetry(state) {
  if (!state.advisor) {
    state.advisor = { mode: 'balanced', recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
  }
  if (!state.advisor.telemetry) {
    state.advisor.telemetry = {
      byMode: {
        conservative: emptyAdvisorTelemetryBucket(),
        balanced: emptyAdvisorTelemetryBucket(),
        aggressive: emptyAdvisorTelemetryBucket()
      },
      last: { mode: state.advisor.mode || 'balanced', source: 'manual', ts: 0 }
    };
  }
  const byMode = state.advisor.telemetry.byMode || {};
  ['conservative', 'balanced', 'aggressive'].forEach((mode) => {
    if (!byMode[mode]) byMode[mode] = emptyAdvisorTelemetryBucket();
  });
  state.advisor.telemetry.byMode = byMode;
  if (!state.advisor.telemetry.last) {
    state.advisor.telemetry.last = { mode: state.advisor.mode || 'balanced', source: 'manual', ts: 0 };
  }
  return state.advisor.telemetry;
}

function getAdvisorTelemetry(stateArg) {
  const state = stateArg || S.getState();
  if (!state) return null;

  const telemetry = ensureAdvisorTelemetry(state);
  const summarize = (bucket) => {
    const races = bucket.races || 0;
    return {
      ...bucket,
      avgPoints: races > 0 ? Math.round((bucket.totalPoints / races) * 100) / 100 : 0,
      avgPerf: races > 0 ? Math.round((bucket.totalPerf / races) * 100) / 100 : 0,
      winRate: races > 0 ? Math.round((bucket.wins / races) * 100) : 0,
      podiumRate: races > 0 ? Math.round((bucket.podiums / races) * 100) : 0,
      dnfRate: races > 0 ? Math.round((bucket.dnfs / races) * 100) : 0
    };
  };

  return {
    byMode: {
      conservative: summarize(telemetry.byMode.conservative),
      balanced: summarize(telemetry.byMode.balanced),
      aggressive: summarize(telemetry.byMode.aggressive)
    },
    last: telemetry.last
  };
}

function recommendStrategyForRace(race, stateArg) {
  const state = stateArg || S.getState();
  if (!race || !race.circuit) {
    return {
      strategy: {
        tyre: 'medium', strategy: 'balanced', aggression: 55, riskLevel: 40, pitLap: 50,
        engineMode: 'normal', pitPlan: 'single', safetyCarReaction: 'neutral',
        setup: { aeroBalance: 50, wetBias: 50 },
        interventions: [{ lapPct: 30, engineMode: 'normal', pitBias: 'none' }, { lapPct: 70, engineMode: 'push', pitBias: 'none' }]
      },
      reasons: ['Fallback recommendation (no race context).']
    };
  }

  const circuit = race.circuit;
  const fc = race.forecast || { confidence: 60, windows: [{ wetProb: race.weather === 'wet' ? 70 : 30 }] };
  const windows = fc.windows || [];
  const wetAvg = windows.length
    ? windows.reduce((s, w) => s + (w.wetProb || 0), 0) / windows.length
    : (race.weather === 'wet' ? 70 : 30);
  const confidence = fc.confidence || 60;
  const uncertainty = Math.abs(wetAvg - 50);
  const staffFx = getRaceStaffEffects(state);
  const advisorMode = (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced';

  const isLikelyWet = wetAvg >= 60;
  const isLikelyDry = wetAvg <= 40;
  const isUncertain = uncertainty < 12 && confidence < 80;

  let tyre = 'medium';
  if (isLikelyDry && (circuit.layout === 'high-speed' || circuit.layout === 'power')) tyre = 'soft';
  if (isLikelyWet) tyre = 'medium';

  const setup = {
    aeroBalance: (circuit.layout === 'technical') ? 65 : ((circuit.layout === 'high-speed' || circuit.layout === 'power') ? 38 : 50),
    wetBias: isLikelyWet ? 72 : (isLikelyDry ? 35 : 52)
  };

  const pitPlan = isUncertain || isLikelyWet ? 'adaptive' : (tyre === 'soft' ? 'double' : 'single');
  const safetyCarReaction = staffFx.undercutStrength >= staffFx.overcutStrength ? 'undercut' : 'overcut';
  const engineMode = isLikelyWet ? 'normal' : (tyre === 'soft' ? 'push' : 'normal');
  const strategyPreset = isLikelyWet || isUncertain ? 'tactical' : 'balanced';

  const strategy = {
    tyre,
    strategy: strategyPreset,
    aggression: isLikelyWet ? 45 : (tyre === 'soft' ? 68 : 56),
    riskLevel: isLikelyWet ? 32 : (isUncertain ? 38 : 48),
    pitLap: pitPlan === 'double' ? 38 : 50,
    engineMode,
    pitPlan,
    safetyCarReaction,
    setup,
    interventions: [
      { lapPct: 30, engineMode: isLikelyWet ? 'normal' : 'push', pitBias: pitPlan === 'double' ? 'early' : 'none' },
      { lapPct: 70, engineMode: isLikelyWet ? 'eco' : 'push', pitBias: isLikelyWet ? 'late' : 'none' }
    ]
  };

  // Advisor A/B mode adjustments
  if (advisorMode === 'conservative') {
    strategy.aggression = clamp(strategy.aggression - 10, 25, 70);
    strategy.riskLevel = clamp(strategy.riskLevel - 10, 18, 60);
    strategy.engineMode = strategy.engineMode === 'push' ? 'normal' : strategy.engineMode;
    if (strategy.pitPlan === 'double') strategy.pitPlan = 'adaptive';
    strategy.safetyCarReaction = 'neutral';
  } else if (advisorMode === 'aggressive') {
    strategy.aggression = clamp(strategy.aggression + 8, 35, 90);
    strategy.riskLevel = clamp(strategy.riskLevel + 8, 25, 85);
    if (strategy.engineMode === 'normal' && !isLikelyWet) strategy.engineMode = 'push';
    if (strategy.pitPlan === 'single' && !isLikelyWet) strategy.pitPlan = 'double';
  }

  const reasons = [
    `Forecast wet average: ${Math.round(wetAvg)}% (confidence ${confidence}%).`,
    `Circuit layout: ${circuit.layout}.`,
    `Staff tactical profile: undercut ${Math.round(staffFx.undercutStrength * 100)}% / overcut ${Math.round(staffFx.overcutStrength * 100)}%.`,
    `Advisor mode: ${advisorMode}.`
  ];

  let advisorConfidence = {
    key: null,
    samples: 0,
    avgScore: 0,
    confidencePct: 35,
    level: 'low'
  };

  // Advisor memory: adapt recommendation from previous real outcomes on same layout/weather
  const key = `${circuit.layout || 'mixed'}_${isLikelyWet ? 'wet' : (isLikelyDry ? 'dry' : 'mixed')}`;
  const advisor = state.advisor || { layoutWeatherStats: {}, practice: { sessions: 0 } };
  const stat = (advisor.layoutWeatherStats || {})[key];
  if (stat && stat.samples > 0) {
    const avgScore = stat.totalScore / stat.samples;
    const sampleFactor = Math.min(1, stat.samples / 8);
    const perfFactor = Math.max(0, Math.min(1, (avgScore + 8) / 20));
    const confidencePct = Math.round(30 + sampleFactor * 40 + perfFactor * 30);
    const level = confidencePct >= 75 ? 'high' : (confidencePct >= 55 ? 'medium' : 'low');
    advisorConfidence = { key, samples: stat.samples, avgScore: Math.round(avgScore * 10) / 10, confidencePct, level };
  } else {
    advisorConfidence = { key, samples: 0, avgScore: 0, confidencePct: 35, level: 'low' };
  }
  if (stat && stat.samples >= 2) {
    const bestTyre = Object.entries(stat.tyreSuccess || {}).sort((a, b) => b[1] - a[1])[0];
    if (bestTyre && bestTyre[1] > 0) {
      strategy.tyre = bestTyre[0];
      reasons.push(`Advisor memory: best tyre on ${key} is ${bestTyre[0]} (${bestTyre[1].toFixed(2)} score).`);
    }

    strategy.aggression = clamp(Math.round((strategy.aggression + (stat.avgAggression || strategy.aggression)) / 2), 20, 85);
    strategy.riskLevel = clamp(Math.round((strategy.riskLevel + (stat.avgRisk || strategy.riskLevel)) / 2), 15, 75);
    reasons.push(`Advisor memory: adapted aggression/risk from ${stat.samples} past races.`);
  }

  if ((advisor.practice && advisor.practice.sessions) > 0 && isUncertain) {
    strategy.pitPlan = 'adaptive';
    reasons.push('Practice trend: keep adaptive pit plan under uncertain forecast.');
  }

  // Cold start guardrails when advisor confidence is low
  let guardrailsApplied = false;
  const safeAlternative = {
    ...strategy,
    tyre: 'medium',
    engineMode: 'normal',
    pitPlan: 'single',
    safetyCarReaction: 'neutral',
    aggression: clamp(Math.min(strategy.aggression, 54), 30, 60),
    riskLevel: clamp(Math.min(strategy.riskLevel, 36), 20, 45),
    setup: {
      aeroBalance: clamp(strategy.setup && typeof strategy.setup.aeroBalance === 'number' ? strategy.setup.aeroBalance : 50, 42, 58),
      wetBias: clamp(strategy.setup && typeof strategy.setup.wetBias === 'number' ? strategy.setup.wetBias : 50, 45, 60)
    },
    interventions: [
      { lapPct: 30, engineMode: 'normal', pitBias: 'none' },
      { lapPct: 70, engineMode: 'normal', pitBias: 'none' }
    ]
  };

  const guardrailThreshold = advisorMode === 'conservative' ? 65 : (advisorMode === 'aggressive' ? 45 : 55);
  if (advisorConfidence.confidencePct < guardrailThreshold) {
    guardrailsApplied = true;
    // Keep recommendation playable but avoid high-risk spikes on low-confidence contexts
    strategy.engineMode = advisorMode === 'aggressive' ? strategy.engineMode : 'normal';
    strategy.aggression = clamp(Math.min(strategy.aggression, advisorMode === 'aggressive' ? 72 : 62), 30, advisorMode === 'aggressive' ? 75 : 65);
    strategy.riskLevel = clamp(Math.min(strategy.riskLevel, advisorMode === 'aggressive' ? 52 : 42), 20, advisorMode === 'aggressive' ? 58 : 45);
    if (strategy.pitPlan === 'double') strategy.pitPlan = 'adaptive';
    strategy.interventions = [
      { lapPct: 30, engineMode: 'normal', pitBias: 'none' },
      { lapPct: 70, engineMode: 'push', pitBias: 'none' }
    ];
    reasons.push(`Cold start guardrails applied: low confidence context (${advisorMode} mode threshold ${guardrailThreshold}%).`);
  }

  const telemetry = getAdvisorTelemetry(state);
  const modeStats = telemetry && telemetry.byMode ? telemetry.byMode[advisorMode] : null;
  if (modeStats && modeStats.races > 0) {
    reasons.push(`Mode history: ${modeStats.races} races, avg ${modeStats.avgPoints} pts, podium ${modeStats.podiumRate}%.`);
  }
  reasons.push(`Advisor confidence: ${advisorConfidence.confidencePct}% (${advisorConfidence.level}, samples ${advisorConfidence.samples}).`);

  return { strategy, safeAlternative, guardrailsApplied, reasons, advisorConfidence };
}

function recordStrategyOutcome(race, strategy, result, meta = {}) {
  const state = S.getState();
  if (!state) return null;
  if (!state.advisor) state.advisor = { mode: 'balanced', recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
  const telemetry = ensureAdvisorTelemetry(state);
  const mode = ['conservative', 'balanced', 'aggressive'].includes(meta.mode) ? meta.mode : (state.advisor.mode || 'balanced');
  const source = ['recommended', 'safe', 'manual'].includes(meta.source) ? meta.source : 'manual';

  const layout = (race && race.circuit && race.circuit.layout) || 'mixed';
  const weather = result && result.weather ? result.weather : ((race && race.weather) || 'dry');
  const bucketWeather = weather === 'wet' ? 'wet' : (weather === 'dry' ? 'dry' : 'mixed');
  const key = `${layout}_${bucketWeather}`;

  const perfScore = (result ? result.points : 0)
    + ((result && result.position) ? Math.max(0, 12 - result.position) : 0)
    + ((result && !result.isDNF) ? 2 : -8)
    + ((typeof result.improvement === 'number') ? Math.max(-4, -result.improvement) : 0);

  const stat = state.advisor.layoutWeatherStats[key] || {
    samples: 0,
    totalScore: 0,
    tyreSuccess: { soft: 0, medium: 0, hard: 0 },
    avgAggression: 50,
    avgRisk: 40
  };

  stat.samples += 1;
  stat.totalScore += perfScore;
  const tyre = (strategy && strategy.tyre) || 'medium';
  if (typeof stat.tyreSuccess[tyre] !== 'number') stat.tyreSuccess[tyre] = 0;
  stat.tyreSuccess[tyre] += perfScore;
  stat.avgAggression = Math.round(((stat.avgAggression * (stat.samples - 1)) + ((strategy && strategy.aggression) || 50)) / stat.samples);
  stat.avgRisk = Math.round(((stat.avgRisk * (stat.samples - 1)) + ((strategy && strategy.riskLevel) || 40)) / stat.samples);
  state.advisor.layoutWeatherStats[key] = stat;

  const bucket = telemetry.byMode[mode] || emptyAdvisorTelemetryBucket();
  bucket.races += 1;
  bucket[source] += 1;
  bucket.totalPoints += result ? (result.points || 0) : 0;
  bucket.totalPerf += perfScore;
  if (result && result.position === 1) bucket.wins += 1;
  if (result && result.position && result.position <= 3) bucket.podiums += 1;
  if (result && result.isDNF) bucket.dnfs += 1;
  telemetry.byMode[mode] = bucket;
  telemetry.last = { mode, source, ts: getNowMs() };

  state.advisor.recent.unshift({
    ts: telemetry.last.ts,
    layout,
    weather: bucketWeather,
    mode,
    source,
    position: result ? result.position : null,
    points: result ? result.points : 0,
    perfScore,
    improvement: result ? result.improvement : 0,
    strategy: {
      tyre: strategy ? strategy.tyre : 'medium',
      aggression: strategy ? strategy.aggression : 50,
      riskLevel: strategy ? strategy.riskLevel : 40,
      pitPlan: strategy ? strategy.pitPlan : 'single',
      engineMode: strategy ? strategy.engineMode : 'normal'
    }
  });
  if (state.advisor.recent.length > 30) state.advisor.recent.pop();

  S.saveState();
  return { key, perfScore, samples: stat.samples, mode, source };
}

function recordPracticeOutcome(meta = {}) {
  const state = S.getState();
  if (!state) return;
  if (!state.advisor) state.advisor = { recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
  if (!state.advisor.practice) state.advisor.practice = { sessions: 0, lastTs: 0 };
  state.advisor.practice.sessions += 1;
  state.advisor.practice.lastTs = getNowMs();
  S.saveState();
}

function shiftTimeByDays(days) {
  const state = S.getState();
  if (!state) return 0;
  if (!state.meta) state.meta = { version: 1, created: null, saveTime: null, timeOffsetMs: 0 };

  const safeDays = Number.isFinite(days) ? days : 0;
  const deltaMs = Math.round(safeDays * DAY_MS);
  state.meta.timeOffsetMs = (state.meta.timeOffsetMs || 0) + deltaMs;
  S.saveState();

  if (safeDays > 0) {
    return catchUpOffline();
  }
  return 0;
}

// ---- offline progression catchup ----
function catchUpOffline() {
  const state = S.getState();
  if (!state || !state.meta || !state.meta.saveTime) return 0;

  const now = getNowMs();
  const offlineMs = now - state.meta.saveTime;
  if (offlineMs < (60 * 60 * 1000)) {
    state.meta.saveTime = now;
    S.saveState();
    return 0;
  }

  const offlineHours = Math.floor(offlineMs / (60 * 60 * 1000));
  let raceSimLimit = 0;
  if (offlineHours >= 24 * 7) raceSimLimit = 8;
  else if (offlineHours >= 24) raceSimLimit = 2;

  let simulatedRaces = 0;
  let simulatedPractices = 0;
  let totalPoints = 0;
  let totalCredits = 0;
  const logs = [];

  // Apply passive progression that should always happen while away.
  updateConstructionQueue();

  // Minimal short-offline progression.
  if (offlineHours >= 4 && raceSimLimit === 0) {
    const passiveIncome = Math.floor(((state.team?.fans || 0) * 0.01));
    if (passiveIncome > 0) {
      S.addCredits(passiveIncome);
      totalCredits += passiveIncome;
      logs.push(`⏱️ Passive progression: +${GL_UI.fmtCR(passiveIncome)} CR`);
    }
  }

  const resolveNextRace = () => {
    const cal = state.season.calendar || [];
    let nextRace = cal.find((r) => r && r.status === 'next');
    if (nextRace) return nextRace;
    const fallback = cal.find((r) => r && (r.status === 'upcoming' || r.status === 'pending'));
    if (fallback) {
      fallback.status = 'next';
      return fallback;
    }
    return null;
  };

  while (simulatedRaces < raceSimLimit) {
    const nextRaceObj = resolveNextRace();
    if (!nextRaceObj) break;

    if (offlineHours >= 24 && simulatedPractices < simulatedRaces + 1) {
      recordPracticeOutcome({ source: 'offline' });
      simulatedPractices += 1;
      logs.push(`⏱️ Practice simulated before Round ${nextRaceObj.round}.`);
    }

    const simResult = simulateRace({
      weather: nextRaceObj.weather || 'dry',
      round: nextRaceObj.round,
      circuits: nextRaceObj.circuit,
      forecast: nextRaceObj.forecast || null
    });
    updateStandings(simResult);
    nextRaceObj.status = 'completed';
    nextRaceObj.result = { position: simResult.position, points: simResult.points };

    const cal = state.season.calendar || [];
    const newNext = cal.find((r) => r && (r.status === 'upcoming' || r.status === 'pending'));
    if (newNext) newNext.status = 'next';

    S.addCredits(simResult.prizeMoney || 0);
    totalCredits += (simResult.prizeMoney || 0);
    totalPoints += (simResult.points || 0);
    simulatedRaces += 1;

    if (recordStrategyOutcome) {
      recordStrategyOutcome(nextRaceObj, {
        tyre: 'medium',
        aggression: 50,
        riskLevel: 40,
        pitPlan: 'single',
        engineMode: 'normal'
      }, simResult, {
        source: 'manual',
        mode: (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced'
      });
    }

    logs.push(`🏁 Round ${nextRaceObj.round}: P${simResult.position} (+${simResult.points} pts, +${GL_UI.fmtCR(simResult.prizeMoney || 0)} CR)`);

    // Weekly economy + progression tick after each simulated race.
    weeklyTick();
  }

  const totalSimulated = simulatedRaces + simulatedPractices;
  if (totalSimulated > 0 || logs.length) {
    S.saveState();
    setTimeout(() => {
      GL_UI.openModal({
        title: __('offline_catchup_title') || 'While You Were Away...',
        content: `
          <p style="color:var(--t-secondary);margin-bottom:16px">${__('offline_catchup_desc') || 'Your team continued to compete in scheduled races:'}</p>
          <div style="font-size:0.8rem;color:var(--t-secondary);margin-bottom:10px">
            Simulated: <strong>${simulatedRaces}</strong> races${simulatedPractices ? ` · <strong>${simulatedPractices}</strong> practices` : ''} · Points: <strong>${totalPoints}</strong> · Credits: <strong>+${GL_UI.fmtCR(totalCredits)}</strong>
          </div>
          <div style="background:var(--c-surface-2);padding:16px;border-radius:8px;font-family:monospace;font-size:0.85rem;line-height:1.5;color:var(--t-primary)">
            ${logs.join('<br>')}
          </div>
          <button class="btn btn-primary w-full mt-4" style="justify-content:center" onclick="GL_UI.closeTopModal()">${__('continue')}</button>
        `
      });
    }, 500);
  }

  // Sync saveTime so we don't simulate again
  state.meta.saveTime = now;
  S.saveState();

  return totalSimulated;
}

// ---- train pilot (once a day) ----
function trainPilot(pid) {
  const state = S.getState();
  const p = state.pilots.find(x => x.id === pid);
  if (!p) return;
  
  const now = getNowDate();
  const lastDate = p.lastTrained ? new Date(p.lastTrained) : new Date(0);
  if (lastDate.toDateString() === now.toDateString()) {
    GL_UI.toast(window.__('pilots_trained_today') || 'Trained Today', 'warning');
    return;
  }
  
  // Apply training points (randomly increase 1 stat by 1-2 points)
  const attrs = Object.keys(p.attrs);
  const targetAttr = attrs[Math.floor(Math.random() * attrs.length)];
  const gain = Math.floor(Math.random() * 2) + 1;
  p.attrs[targetAttr] = Math.min(99, p.attrs[targetAttr] + gain);
  
  p.lastTrained = now.getTime();
  S.saveState();
  
  GL_UI.toast(`🏋️ ${p.name}: +${gain} ${window.__(`attr_${targetAttr}`)||targetAttr}!`, 'good');
  if (window.GL_SCREENS && document.getElementById('screen-pilots').classList.contains('active')) {
    window.GL_SCREENS.renderPilots();
  }
}

window.GL_ENGINE = {
  pilotScore, carScore, buildRaceGrid, simulateRace,
  weeklyTick, updateConstructionQueue, startHqUpgrade,
  // Research/I+D
  startResearch, getResearchStatus, RESEARCH_TREES, getHqCapabilities,
  getRaceStaffEffects,
  refreshForecastForNextRace,
  recommendStrategyForRace,
  getCampaignStatus,
  getAdvisorTelemetry,
  recordStrategyOutcome,
  recordPracticeOutcome,
  getNowMs,
  getNowDate,
  shiftTimeByDays,
  generateRandomEvent, applyEventChoice,
  buildInitialStandings, updateStandings, getNextRaceDate, catchUpOffline, trainPilot
};

