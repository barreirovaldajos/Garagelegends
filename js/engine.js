// Fuente de verdad de economía semanal
function getWeeklyEconomyBreakdown(state) {
  const incomeBreakdown = (window.Economy || globalThis.Economy).calculateTeamIncomeBreakdown(state);
  const expenseBreakdown = (window.Economy || globalThis.Economy).calculateTeamExpenseBreakdown(state);
  const rawSettlement = state?.finances?.lastRaceSettlement && typeof state.finances.lastRaceSettlement === 'object'
    ? state.finances.lastRaceSettlement
    : null;
  const latestHistoryWeek = Array.isArray(state?.finances?.history) && state.finances.history.length
    ? Number(state.finances.history[state.finances.history.length - 1]?.week)
    : null;
  const settlementWeek = Number(rawSettlement?.week);
  const settlement = rawSettlement && (!Number.isFinite(settlementWeek) || settlementWeek === latestHistoryWeek)
    ? rawSettlement
    : null;
  const prizeIncome = settlement ? Number(settlement.prizeDelta || settlement.prizeMoney || 0) : 0;
  const income = incomeBreakdown.income + prizeIncome;
  const expenses = expenseBreakdown.expenses;
  return {
    sponsorIncome: incomeBreakdown.sponsorIncome,
    fanRevenue: incomeBreakdown.fanRevenue,
    divisionGrant: incomeBreakdown.divisionGrant,
    bonusIncome: incomeBreakdown.bonusIncome,
    prizeIncome,
    salaries: expenseBreakdown.salaries,
    hqCost: expenseBreakdown.hqCost,
    contractCost: expenseBreakdown.contractCost,
    constructionUpkeep: expenseBreakdown.constructionUpkeep,
    income,
    expenses,
    net: income - expenses
  };
}

function getFinanceOverview(state) {
  const breakdown = getWeeklyEconomyBreakdown(state);
  const rawSettlement = state?.finances?.lastRaceSettlement && typeof state.finances.lastRaceSettlement === 'object'
    ? state.finances.lastRaceSettlement
    : null;
  const latestHistoryWeek = Array.isArray(state?.finances?.history) && state.finances.history.length
    ? Number(state.finances.history[state.finances.history.length - 1]?.week)
    : null;
  const settlementWeek = Number(rawSettlement?.week);
  const settlement = rawSettlement && (!Number.isFinite(settlementWeek) || settlementWeek === latestHistoryWeek)
    ? rawSettlement
    : null;
  const currentCredits = Number(state?.finances?.credits || 0);
  const deficitStreak = Number(state?.finances?.deficitStreak || 0);
  const legacyCritical = !!state?.finances?.criticalDeficit;
  const competitionNet = settlement ? Number(settlement.prizeDelta || settlement.prizeMoney || 0) : 0;
  const operatingNet = settlement && Number.isFinite(settlement.weeklyNetDelta)
    ? Number(settlement.weeklyNetDelta)
    : Number(breakdown.net || 0);
  const totalNet = settlement && Number.isFinite(settlement.totalDelta)
    ? Number(settlement.totalDelta)
    : operatingNet + competitionNet;
  const openingCash = settlement && Number.isFinite(settlement.creditsBefore)
    ? Number(settlement.creditsBefore)
    : Math.max(0, currentCredits - totalNet);
  const closingCash = settlement && Number.isFinite(settlement.creditsAfterWeekly)
    ? Number(settlement.creditsAfterWeekly)
    : currentCredits;

  let health = 'healthy';
  let reasonKey = 'finances_health_reason_positive_total';

  if (currentCredits < 10000 || (totalNet < 0 && deficitStreak >= 3) || (legacyCritical && !settlement)) {
    health = 'critical';
    reasonKey = currentCredits < 10000
      ? 'finances_health_reason_low_cash'
      : 'finances_health_reason_negative_total';
  } else if (totalNet < 0) {
    health = 'warning';
    reasonKey = 'finances_health_reason_negative_total';
  } else if (operatingNet < 0 || deficitStreak > 0 || currentCredits < 30000) {
    health = 'warning';
    reasonKey = (operatingNet < 0 || deficitStreak > 0)
      ? 'finances_health_reason_operating_pressure'
      : 'finances_health_reason_low_cash';
  }

  return {
    breakdown,
    settlement,
    currentCredits,
    openingCash,
    closingCash,
    operatingNet,
    competitionNet,
    totalNet,
    deficitStreak,
    health,
    isCritical: health === 'critical',
    isWarning: health === 'warning',
    reasonKey
  };
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.getWeeklyEconomyBreakdown = getWeeklyEconomyBreakdown;
  window.getFinanceOverview = getFinanceOverview;
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

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDivisionCatalogFromData() {
  const catalog = Array.isArray(D?.DIVISIONS) ? D.DIVISIONS : [];
  return catalog
    .map((entry) => ({
      div: Number(entry?.div),
      teams: Number(entry?.teams),
      promotions: Number(entry?.promotions),
      relegations: Number(entry?.relegations)
    }))
    .filter((entry) => Number.isFinite(entry.div) && entry.div >= 1)
    .sort((a, b) => a.div - b.div);
}

function getDivisionBoundsFromData() {
  const catalog = getDivisionCatalogFromData();
  if (!catalog.length) return { minDivision: 1, maxDivision: 8 };
  return {
    minDivision: catalog[0].div,
    maxDivision: catalog[catalog.length - 1].div
  };
}

function getDivisionConfigSafe(divNum) {
  const fallback = { teams: 10, promotions: 2, relegations: 2 };
  if (DivisionsApi && typeof DivisionsApi.getDivisionConfig === 'function') {
    return DivisionsApi.getDivisionConfig(divNum) || fallback;
  }

  const catalog = getDivisionCatalogFromData();
  const bounds = getDivisionBoundsFromData();
  const numericDiv = Number(divNum);
  const targetDiv = Number.isFinite(numericDiv)
    ? Math.max(bounds.minDivision, Math.min(bounds.maxDivision, Math.round(numericDiv)))
    : bounds.maxDivision;
  const match = catalog.find((entry) => entry.div === targetDiv);
  if (!match) return fallback;

  return {
    teams: Number.isFinite(match.teams) && match.teams > 0 ? match.teams : fallback.teams,
    promotions: Number.isFinite(match.promotions) ? Math.max(0, match.promotions) : fallback.promotions,
    relegations: Number.isFinite(match.relegations) ? Math.max(0, match.relegations) : fallback.relegations
  };
}

const AI_TEAM_COLOR_POOL = ['#00A6FB', '#2EC4B6', '#8AC926', '#6A4C93', '#FF9F1C', '#06D6A0', '#FFD166', '#D65DB1', '#3A86FF', '#43AA8B'];
const AI_TEAM_ALT_COLOR_POOL = ['#118AB2', '#7B2CBF', '#90BE6D', '#F9C74F', '#4CC9F0', '#F8961E', '#577590', '#B8DE6F', '#4D96FF', '#C77DFF'];

function hexToRgb(color) {
  const hex = String(color || '').trim().replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((part) => `${part}${part}`).join('')
    : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getColorDistance(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt(((a.r - b.r) ** 2) + ((a.g - b.g) ** 2) + ((a.b - b.b) ** 2));
}

function getVisualAiTeams() {
  const playerColor = S.getState()?.team?.colors?.primary || '#e8292a';
  const usedColors = new Set();
  return (D.AI_TEAMS || []).map((team, index) => {
    let color = AI_TEAM_COLOR_POOL[index % AI_TEAM_COLOR_POOL.length] || team.color;
    if (getColorDistance(color, playerColor) < 110) {
      color = AI_TEAM_ALT_COLOR_POOL.find((candidate) => !usedColors.has(candidate) && getColorDistance(candidate, playerColor) >= 120)
        || AI_TEAM_ALT_COLOR_POOL[index % AI_TEAM_ALT_COLOR_POOL.length]
        || color;
    }
    usedColors.add(color);
    return {
      ...team,
      color
    };
  });
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

  const pickByKey = (...keys) => staff.filter(s => keys.includes(s.roleKey) || keys.some(k => (s.role || '').toLowerCase().includes(k.toLowerCase())));

  const raceEngineers = pickByKey('race_engineer', 'race engineer');
  const pitHeads = pickByKey('head_of_pits', 'head of pits');
  const chiefEngineers = pickByKey('chief_engineer', 'chief engineer');
  const analysts = pickByKey('data_analyst', 'data analyst');

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
    weatherResearchUnlocked: true
  };
}

// ---- Research/I+D Configuration ----
const RESEARCH_TREES = {
  acceleration: { name: 'Acceleration', icon: '⚡', maxLevel: 20, costPerLevel: (l) => 5000 + (l * 1000), durationPerLevel: (l) => 5 * 24 * 3600 * 1000, componentBoost: 'chassis', boostPerLevel: 2 },
  power: { name: 'Power', icon: '💪', maxLevel: 20, costPerLevel: (l) => 8000 + (l * 1500), durationPerLevel: (l) => 7 * 24 * 3600 * 1000, componentBoost: 'engine', boostPerLevel: 2 },
  reliability: { name: 'Reliability', icon: '🛡️', maxLevel: 20, costPerLevel: (l) => 6000 + (l * 1200), durationPerLevel: (l) => 6 * 24 * 3600 * 1000, componentBoost: 'reliability', boostPerLevel: 2.5 },
  weather: { name: 'Weather Mastery', icon: '🌧️', maxLevel: 20, costPerLevel: (l) => 7000 + (l * 1300), durationPerLevel: (l) => 7 * 24 * 3600 * 1000, componentBoost: 'aero', boostPerLevel: 2 }
};

const RND_POINT_COST_PER_RESEARCH = 5;

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
  const pointCost = RND_POINT_COST_PER_RESEARCH;
  let duration = tree.durationPerLevel(nextLevel);
  duration = Math.floor(duration / caps.rndSpeedMultiplier);
  if ((state.team.engineSupplier || '').toLowerCase() === 'vulcan') {
    duration = Math.floor(duration * 0.8);
  }
  if (state.finances.credits < cost) return { error: 'Insufficient funds' };
  if ((rnd.points || 0) < pointCost) return { error: `Not enough R&D points (need ${pointCost})` };
  state.finances.credits -= cost;
  rnd.points = (rnd.points || 0) - pointCost;
  rnd.active = { treeId, startTime: getNowMs(), duration, targetLevel: nextLevel, progress: 0 };
  S.saveState();
  return { success: true, treeId, cost, pointCost, duration, targetLevel: nextLevel };
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
    team: {
      name: (team && team.name) || 'AI Team',
      fans: 3000
    },
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
    paceMult: clamp(1 + ((layoutFit + weatherFit) * 0.4), 0.92, 1.08),
    riskMult: 1 - (weather === 'wet' ? (wetBias - 50) / 220 : (50 - wetBias) / 280),
    tyreMult: 1 + (Math.abs(aeroBalance - 50) / 260)
  };
}

function getTeamDriverBaseline(state) {
  const pilots = (state && Array.isArray(state.pilots)) ? state.pilots : [];
  if (!pilots.length) return 65;
  const scores = pilots.map((p) => pilotScore(p)).filter((x) => Number.isFinite(x));
  if (!scores.length) return 65;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function getPilotAttr(pilot, key, fallback = 55) {
  const value = pilot && pilot.attrs ? pilot.attrs[key] : null;
  return Number.isFinite(value) ? value : fallback;
}

function getPilotRaceStrength(pilot, weather, strategy = {}) {
  const overall = pilotScore(pilot);
  const racePace = getPilotAttr(pilot, 'racePace', overall);
  const consistency = getPilotAttr(pilot, 'consistency', 60);
  const tyreSkill = getPilotAttr(pilot, 'tyre', 60);
  const rainSkill = getPilotAttr(pilot, 'rain', 60);
  const aggressionAttr = getPilotAttr(pilot, 'aggression', 60);
  const overtake = getPilotAttr(pilot, 'overtake', 60);
  let strength = (overall * 0.42) + (racePace * 0.22) + (consistency * 0.16) + (tyreSkill * 0.1) + (overtake * 0.1);
  if (weather === 'wet') strength += (rainSkill - 60) * 0.28;
  strength += (((strategy.aggression || 50) - 50) * 0.06);
  strength += (((strategy.riskLevel || 40) - 40) * 0.03);
  strength += ((aggressionAttr - 60) * 0.04);
  return clamp(strength, 40, 96);
}

function getPilotGridStrength(pilot, weather) {
  const overall = pilotScore(pilot);
  const pace = getPilotAttr(pilot, 'pace', overall);
  const racePace = getPilotAttr(pilot, 'racePace', overall);
  const consistency = getPilotAttr(pilot, 'consistency', 60);
  const techFeedback = getPilotAttr(pilot, 'techFB', 60);
  const mental = getPilotAttr(pilot, 'mental', 60);
  const rainSkill = getPilotAttr(pilot, 'rain', 60);

  let strength = (overall * 0.26)
    + (pace * 0.32)
    + (racePace * 0.18)
    + (consistency * 0.12)
    + (techFeedback * 0.07)
    + (mental * 0.05);

  if (weather === 'wet') strength += (rainSkill - 60) * 0.18;
  return clamp(strength, 40, 96);
}

function hashSeed(input) {
  const str = String(input || 'seed');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed) {
  return (hashSeed(seed) % 10000) / 10000;
}

function seededRange(seed, min, max) {
  return min + ((max - min) * seededUnit(seed));
}

function pickSeeded(arr, seed) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[Math.floor(seededUnit(seed) * arr.length) % arr.length];
}

function parseCircuitLengthKm(lengthValue) {
  const parsed = Number.parseFloat(String(lengthValue || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 5;
}

function getCircuitRaceDistanceKm(circuit = {}) {
  const laps = Number(circuit?.laps) || 0;
  const lengthKm = parseCircuitLengthKm(circuit?.length);
  return Math.round(lengthKm * laps * 1000) / 1000;
}

function getDefaultRaceTyre(weather = 'dry') {
  return weather === 'wet' ? 'intermediate' : 'medium';
}

function getBasePitWindowPct(tyre, weather = 'dry', pitPlan = 'single') {
  if (weather === 'wet') {
    if (tyre === 'wet') return pitPlan === 'double' ? 26 : 32;
    return 52;
  }
  if (tyre === 'soft') return pitPlan === 'double' ? 22 : 25;
  if (tyre === 'hard') return pitPlan === 'double' ? 48 : 60;
  return pitPlan === 'double' ? 32 : 42; // medium
}

function getDefaultPitTyres(strategy = {}, weather = 'dry') {
  const preset = Array.isArray(strategy.pitTyres) ? strategy.pitTyres.filter(Boolean).slice(0, 2) : [];
  if (preset.length === 2) return preset;
  const startTyre = strategy.tyre || getDefaultRaceTyre(weather);
  if (weather === 'wet') {
    return [preset[0] || (startTyre === 'wet' ? 'intermediate' : 'intermediate'), preset[1] || 'intermediate'];
  }
  if (startTyre === 'soft') return [preset[0] || 'hard', preset[1] || 'medium'];
  if (startTyre === 'hard') return [preset[0] || 'medium', preset[1] || 'soft'];
  return [preset[0] || 'hard', preset[1] || 'medium'];
}

function getConfiguredPitTyre(strategy, stopIndex, weather) {
  const pitTyres = getDefaultPitTyres(strategy, weather);
  return pitTyres[stopIndex] || pitTyres[pitTyres.length - 1] || (weather === 'wet' ? 'intermediate' : 'medium');
}

function normalizeTyreForWeather(tyre, weather) {
  if (weather === 'wet') {
    if (tyre === 'intermediate' || tyre === 'wet') return tyre;
    return 'intermediate';
  }
  if (tyre === 'intermediate' || tyre === 'wet') return 'medium';
  return tyre;
}

function getForecastWetAverage(forecast, fallbackWeather = 'dry') {
  const windows = Array.isArray(forecast?.windows) ? forecast.windows.filter((window) => Number.isFinite(window?.wetProb)) : [];
  if (!windows.length) return fallbackWeather === 'wet' ? 75 : 25;
  return windows.reduce((sum, window) => sum + window.wetProb, 0) / windows.length;
}

function choosePitTyreForConditions(entry, strategy, stopIndex, liveWeather, forecast = null, options = {}) {
  const requestedTyre = getConfiguredPitTyre(strategy, stopIndex, liveWeather);
  if (!entry || entry.isPlayer) return requestedTyre;

  const aiMeta = (entry.strategy && entry.strategy.aiMeta) || strategy?.aiMeta || {};
  const decisionSkill = clamp(Number(aiMeta.decisionSkill) || 0.55, 0.35, 0.95);
  const rainSkill = clamp((Number(aiMeta.rainSkill) || 60) / 100, 0.35, 0.95);
  const tyreSkill = clamp((Number(aiMeta.tyreSkill) || 60) / 100, 0.35, 0.95);
  const confidence = clamp((Number(forecast?.confidence) || 60) / 100, 0.35, 0.95);
  const wetExpectation = clamp(getForecastWetAverage(forecast, liveWeather) / 100, 0.05, 0.95);
  const adaptRoll = Number.isFinite(options.adaptRoll) ? options.adaptRoll : Math.random();
  const compoundRoll = Number.isFinite(options.compoundRoll) ? options.compoundRoll : Math.random();

  if (liveWeather === 'wet' && requestedTyre !== 'intermediate' && requestedTyre !== 'wet') {
    const adaptChance = clamp(0.08 + (decisionSkill * 0.28) + (rainSkill * 0.2) + (confidence * 0.08) + ((wetExpectation - 0.5) * 0.22), 0.12, 0.78);
    if (adaptRoll >= adaptChance) return requestedTyre;
    const fullWetChance = clamp(-0.06 + (rainSkill * 0.28) + ((wetExpectation - 0.72) * 0.95), 0.05, 0.42);
    return compoundRoll < fullWetChance ? 'wet' : 'intermediate';
  }

  if (liveWeather === 'dry' && (requestedTyre === 'intermediate' || requestedTyre === 'wet')) {
    const dryExpectation = 1 - wetExpectation;
    const adaptChance = clamp(0.1 + (decisionSkill * 0.24) + (tyreSkill * 0.22) + (confidence * 0.1) + ((dryExpectation - 0.5) * 0.2), 0.14, 0.8);
    if (adaptRoll >= adaptChance) return requestedTyre;
    return normalizeTyreForWeather(requestedTyre, 'dry');
  }

  return requestedTyre;
}

function normalizePitPlan(plan) {
  return plan === 'double' ? 'double' : 'single';
}

function getPrimaryStopLapPct(strategy = {}, fallback = 50) {
  const interventions = Array.isArray(strategy.interventions) ? strategy.interventions : [];
  if (Number.isFinite(interventions[0]?.lapPct)) return clamp(Math.round(interventions[0].lapPct), 10, 95);
  if (Number.isFinite(strategy.pitLap)) return clamp(Math.round(strategy.pitLap), 10, 95);
  return fallback;
}

function normalizeStrategyInterventions(strategy = {}, fallbackPitLap = 50) {
  const interventions = Array.isArray(strategy.interventions) ? strategy.interventions : [];
  const firstLapPct = getPrimaryStopLapPct(strategy, fallbackPitLap);
  const secondFallback = Math.min(95, Math.max(firstLapPct + 20, 70));
  const secondLapPct = Number.isFinite(interventions[1]?.lapPct)
    ? clamp(Math.round(interventions[1].lapPct), firstLapPct + 8, 95)
    : secondFallback;
  return [
    {
      lapPct: firstLapPct,
      pitBias: 'none'
    },
    {
      lapPct: secondLapPct,
      pitBias: 'none'
    }
  ];
}

function getConfiguredStopWindows(strategy = {}, totalLaps) {
  const interventions = normalizeStrategyInterventions(strategy, getPrimaryStopLapPct(strategy, 50));
  const firstPctBase = interventions[0].lapPct;
  const secondPctBase = interventions[1].lapPct;
  const firstBaseLap = Math.floor(clamp(firstPctBase, 10, 95) / 100 * totalLaps) + 1;
  const secondBaseLap = Math.floor(clamp(secondPctBase, 10, 95) / 100 * totalLaps) + 1;
  const firstLap = firstBaseLap;
  const secondLap = Math.min(totalLaps - 2, Math.max(firstLap + 6, secondBaseLap));
  return { firstLap, secondLap };
}

function getPitStopTimeMs(entry, weather = 'dry', safetyCarActive = false, staffFx = {}) {
  const aiPitSkill = entry && entry.strategy && entry.strategy.aiMeta
    ? entry.strategy.aiMeta.pitSkill
    : null;
  const crewEfficiency = entry && entry.isPlayer
    ? clamp((((staffFx.pitTimeGainChance || 0.45) - 0.25) / 0.53), 0, 1)
    : clamp((((aiPitSkill || 58) - 46) / 46), 0, 1);
  const errorMult = entry && entry.isPlayer
    ? (staffFx.pitErrorChanceMult || 1)
    : clamp(1.18 - ((aiPitSkill || 58) / 120), 0.72, 1.12);

  const laneMs = safetyCarActive ? 13200 : 18400;
  const weatherMs = weather === 'wet' ? 900 : 0;
  const serviceBaseMs = 5150 - (crewEfficiency * 1100);
  const serviceNoiseMs = Math.round((Math.random() - 0.5) * 700);
  let totalMs = laneMs + weatherMs + serviceBaseMs + serviceNoiseMs;

  const quickStopChance = entry && entry.isPlayer
    ? (staffFx.pitTimeGainChance || 0.45)
    : clamp(0.24 + (crewEfficiency * 0.45), 0.22, 0.72);
  if (Math.random() < quickStopChance) totalMs -= 550;

  const baseErrorChance = safetyCarActive ? 0.03 : 0.06;
  if (Math.random() < (baseErrorChance * errorMult)) {
    totalMs += 1600 + Math.round(Math.random() * 1400);
  }

  return clamp(Math.round(totalMs), safetyCarActive ? 11800 : 16800, safetyCarActive ? 22000 : 30000);
}

function buildAiDriverProfile(team, carSlot, weather, circuit, profile, referenceCarScore) {
  const seedRoot = `${team?.id || 'ai'}_${carSlot}_${(circuit && circuit.id) || profile.layout}_${weather}`;
  const aiPilots = (D.PILOT_POOL || []).filter((pilot) => String(pilot.id || '').indexOf('ai') === 0);
  const pilotSource = pickSeeded(aiPilots, `${seedRoot}_pilot`) || {
    id: `${team?.id || 'ai'}_pilot_${carSlot}`,
    name: `AI Driver ${carSlot}`,
    attrs: { pace: 64, racePace: 66, consistency: 68, rain: 62, tyre: 66, aggression: 64, overtake: 64, techFB: 62, mental: 66, charisma: 60 }
  };
  const pilot = cloneData(pilotSource);
  const driverRating = pilotScore(pilot);
  const pitSkill = Math.round(seededRange(`${seedRoot}_pit`, 46, 92));
  const setupSkill = Math.round(seededRange(`${seedRoot}_setup`, 44, 90));
  const decisionSkill = clamp(((driverRating * 0.62) + (pitSkill * 0.23) + (setupSkill * 0.15)) / 100, 0.45, 0.96);
  const aggressionAttr = getPilotAttr(pilot, 'aggression', 60);
  const consistency = getPilotAttr(pilot, 'consistency', 60);
  const tyreSkill = getPilotAttr(pilot, 'tyre', 60);
  const rainSkill = getPilotAttr(pilot, 'rain', 60);
  const prefersAggressive = aggressionAttr > 72 && seededUnit(`${seedRoot}_style`) > 0.42;
  const strategyId = weather === 'wet'
    ? (decisionSkill > 0.72 ? 'tactical' : 'balanced')
    : (prefersAggressive ? 'aggressive' : (decisionSkill > 0.76 ? 'tactical' : (consistency > 76 ? 'conservative' : 'balanced')));
  const engineMode = prefersAggressive ? 'push' : (consistency > 80 ? 'eco' : 'normal');
  let tyre = 'medium';
  if (weather === 'wet') {
    tyre = rainSkill > 84 && seededUnit(`${seedRoot}_wet`) > 0.82 ? 'wet' : 'intermediate';
  } else if (strategyId === 'aggressive') {
    tyre = tyreSkill > 72 && profile.tyreDegMult <= 1.02 && seededUnit(`${seedRoot}_soft`) > 0.46 ? 'soft' : 'medium';
  } else if (strategyId === 'conservative' || profile.tyreDegMult > 1.05) {
    tyre = tyreSkill > 68 || profile.tyreDegMult > 1.05 ? 'hard' : 'medium';
  } else {
    tyre = seededUnit(`${seedRoot}_compound`) > 0.72 ? 'hard' : 'medium';
  }
  let pitPlan;
  if (weather === 'wet') {
    pitPlan = (tyre === 'wet' || ((profile.tyreDegMult > 1.06 || tyreSkill < 64) && seededUnit(`${seedRoot}_wet_double`) > 0.58)) ? 'double' : 'single';
  } else if (tyre === 'soft') {
    pitPlan = 'double';
  } else if (tyre === 'hard') {
    // Hard: parada doble rara, solo en circuitos de alto desgaste con pilotos agresivos
    const hardDbl = (profile.tyreDegMult > 1.05 ? 0.18 : 0.07) + (strategyId === 'aggressive' ? 0.07 : 0);
    pitPlan = seededUnit(`${seedRoot}_hard_double`) < hardDbl ? 'double' : 'single';
  } else {
    // Medium: varía según desgaste del circuito, estilo y habilidad de neumáticos
    const baseDbl = profile.tyreDegMult > 1.06 ? 0.55
      : profile.tyreDegMult > 1.03 ? 0.38
      : 0.18;
    const dblChance = clamp(
      baseDbl
      + (strategyId === 'aggressive' ? 0.10 : 0)
      - (strategyId === 'conservative' ? 0.08 : 0)
      + (tyreSkill < 60 ? 0.08 : 0),      // pilotos con mal manejo de neumáticos paran más
      0.06, 0.72
    );
    pitPlan = seededUnit(`${seedRoot}_medium_double`) < dblChance ? 'double' : 'single';
  }
  const setup = {
    aeroBalance: clamp(Math.round((profile.layout === 'technical' ? 68 : (profile.layout === 'high-speed' || profile.layout === 'power' ? 38 : 50)) + (setupSkill - 60) * 0.14 + seededRange(`${seedRoot}_aero`, -6, 6)), 20, 80),
    wetBias: clamp(Math.round((weather === 'wet' ? 72 : 42) + (rainSkill - 60) * 0.12 + seededRange(`${seedRoot}_wet_bias`, -8, 8)), 15, 85)
  };
  const basePitLap = getBasePitWindowPct(tyre, weather, pitPlan);
  const pitLap = clamp(Math.round(basePitLap + ((decisionSkill - 0.6) * 18) + seededRange(`${seedRoot}_pitlap`, -6, 6)), 18, 80);
  const riskLevel = clamp(Math.round((aggressionAttr * 0.6) + ((100 - consistency) * 0.16) + seededRange(`${seedRoot}_risk`, 2, 18)), 22, 84);
  const aggression = clamp(Math.round((aggressionAttr * 0.72) + (driverRating * 0.12) + seededRange(`${seedRoot}_aggression`, -6, 6)), 28, 90);
  const pitTyres = getDefaultPitTyres({ tyre, pitPlan }, weather);
  const strategy = {
    tyre,
    aggression,
    pitLap,
    riskLevel,
    engineMode,
    strategy: strategyId,
    pitPlan,
    safetyCarReaction: decisionSkill > 0.7 ? 'live' : 'hold',
    pitTyres,
    setup,
    aiMeta: {
      decisionSkill,
      pitSkill,
      setupSkill,
      rainSkill,
      tyreSkill,
      driverRating,
      carScore: clamp(Math.round((referenceCarScore * seededRange(`${seedRoot}_car_scale`, 0.82, 1.04)) + seededRange(`${seedRoot}_car_delta`, -5, 5)), 42, 90)
    }
  };
  return { pilot, strategy };
}

// ---- build full grid (player + AI teams) ----
function buildRaceGrid(playerPilot, weather, circuit, strategy = {}) {
  const state = S.getState();
  const carData = S.getCar().components;
  const car = carScore();
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
  const weatherDriverMult = weather === 'wet' ? 0.92 : 1;
  const leadDriverStrength = getPilotGridStrength(playerPilot, weather);
  const playerBase = ((car * 0.56 + leadDriverStrength * 0.44) + trackCarBonus) * weatherDriverMult * profile.paceBias * setupFx.paceMult;

  const grid = [{
    id: 'player',
    name: state.team.name || 'Your Team',
    color: state.team.colors.primary,
    isPlayer: true,
    base: playerBase,
    score: playerBase + (Math.random() - 0.5) * 12,
    tyre: 'medium', wear: 0, gaps: 0
  }];

  const division = Number(state?.season?.division) || 8;
  const teamSlots = Math.max(2, Number(getDivisionConfigSafe(division)?.teams) || 10);
  const aiTeams = getVisualAiTeams().slice(0, Math.max(1, teamSlots - 1));
  aiTeams.forEach((t) => {
    for (let carSlot = 1; carSlot <= 2; carSlot++) {
      const aiProfile = buildAiDriverProfile(t, carSlot, weather, circuit, profile, car);
      const aiSetupFx = getSetupEffects(circuit, weather, aiProfile.strategy.setup || {});
      const aiPilotStrength = getPilotGridStrength(aiProfile.pilot, weather);
      const aiCarScore = aiProfile.strategy.aiMeta.carScore;
      const aiTrackBias = ((aiCarScore - 50) * 0.11) + seededRange(`${t.id}_${carSlot}_track`, -2.5, 2.5);
      const aiBase = ((aiCarScore * 0.54 + aiPilotStrength * 0.46) + aiTrackBias) * profile.paceBias * aiSetupFx.paceMult;
      grid.push({
        id: `${t.id}_${carSlot}`,
        teamId: t.id,
        name: `${t.name} #${carSlot}`,
        color: t.color,
        isPlayer: false,
        pilotId: aiProfile.pilot.id,
        pilotName: aiProfile.pilot.name,
        consistency: getPilotAttr(aiProfile.pilot, 'consistency', 60),
        teamSlot: carSlot,
        base: aiBase,
        score: aiBase + (Math.random() - 0.5) * (12 - (aiProfile.strategy.aiMeta.decisionSkill * 6)),
        tyre: aiProfile.strategy.tyre,
        wear: 0,
        gaps: 0,
        strategy: aiProfile.strategy
      });
    }
  });
  grid.sort((a, b) => b.score - a.score);
  return grid;
}

// ---- tyre degradation per compound ----
const TYRE_COMPOUNDS = {
  soft: {
    dry: { durabilityPct: [0.15, 0.30], paceDeltaMs: -550 },
    wet: { durabilityPct: [0.10, 0.20], paceDeltaMs: 4200 }
  },
  medium: {
    dry: { durabilityPct: [0.30, 0.50], paceDeltaMs: 0 },
    wet: { durabilityPct: [0.15, 0.25], paceDeltaMs: 5200 }
  },
  hard: {
    dry: { durabilityPct: [0.50, 0.70], paceDeltaMs: 500 },
    wet: { durabilityPct: [0.20, 0.30], paceDeltaMs: 6200 }
  },
  intermediate: {
    dry: { durabilityPct: [0.10, 0.25], paceDeltaMs: 4200 },
    wet: { durabilityPct: [0.40, 0.70], paceDeltaMs: 0 }
  },
  wet: {
    dry: { durabilityPct: [0.05, 0.15], paceDeltaMs: 6500 },
    wet: { durabilityPct: [0.20, 0.40], paceDeltaMs: 1000 }
  }
};

function getTyreCompound(tyre) {
  return TYRE_COMPOUNDS[tyre] || TYRE_COMPOUNDS.medium;
}

function getTyreTrackProfile(tyre, weather = 'dry') {
  const compound = getTyreCompound(tyre);
  return weather === 'wet' ? compound.wet : compound.dry;
}

function getTyreUsefulLife(tyre, weather = 'dry', totalLaps = 60) {
  const profile = getTyreTrackProfile(tyre, weather);
  const durabilityPct = (profile.durabilityPct[0] + profile.durabilityPct[1]) / 2;
  return clamp(totalLaps * durabilityPct, 4, Math.max(6, totalLaps * 0.85));
}

function getTyreWearStep(tyre, weather) {
  return 1;
}

function getTyrePaceDeltaMs(tyre, weather = 'dry') {
  return getTyreTrackProfile(tyre, weather).paceDeltaMs;
}

function getTyreWeatherPaceDelta(tyre, weather) {
  return clamp((-getTyrePaceDeltaMs(tyre, weather)) / 450, -12, 12);
}

function getEngineModeFx(mode) {
  const map = {
    eco: { pace: -0.05, risk: -0.15, tyre: -0.1 },
    normal: { pace: 0, risk: 0, tyre: 0 },
    push: { pace: 0.05, risk: 0.15, tyre: 0.12 }
  };
  return map[mode] || map.normal;
}

function averageFinite(values = [], fallback = 0) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function scoreToStars(score) {
  return clamp(Math.round((Number(score) || 0) / 20), 1, 5);
}

function translateText(key, fallback = '') {
  const translate = (typeof window !== 'undefined' && typeof window.__ === 'function')
    ? window.__
    : (typeof globalThis.__ === 'function' ? globalThis.__ : null);
  if (!translate) return fallback || key;
  const resolved = translate(key);
  return resolved && resolved !== key ? resolved : (fallback || key);
}

function formatTranslatedText(key, replacements = {}, fallback = '') {
  const template = translateText(key, fallback);
  return String(template).replace(/\{(\w+)\}/g, (_, token) => {
    const value = replacements[token];
    return value == null ? '' : String(value);
  });
}

function formatGapMs(value) {
  return Number.isFinite(value) ? `${(value / 1000).toFixed(1)}s` : 'n/a';
}

function formatSignedDelta(value, zeroLabel = '0') {
  const safeValue = Number(value) || 0;
  if (!safeValue) return zeroLabel;
  return `${safeValue > 0 ? '+' : ''}${safeValue}`;
}

function formatSignedGapDeltaMs(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const seconds = value / 1000;
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(1)}s`;
}

function getCrashPressureContext(entry, positions = []) {
  const active = (Array.isArray(positions) ? positions : [])
    .filter((car) => !car?.retired && car?.id !== entry?.id)
    .sort((a, b) => Number(a?.timeMs || 0) - Number(b?.timeMs || 0));
  const selfTime = Number(entry?.timeMs || 0);
  const ahead = active
    .filter((car) => Number(car?.timeMs || Number.POSITIVE_INFINITY) <= selfTime)
    .slice(-1)[0] || null;
  const behind = active.find((car) => Number(car?.timeMs || Number.POSITIVE_INFINITY) > selfTime) || null;
  const aheadGapMs = ahead ? Math.max(0, selfTime - Number(ahead.timeMs || selfTime)) : null;
  const behindGapMs = behind ? Math.max(0, Number(behind.timeMs || selfTime) - selfTime) : null;
  const teammateAhead = !!ahead && !!ahead.isPlayer;
  const teammateBehind = !!behind && !!behind.isPlayer;
  const rivalAhead = !!ahead && !ahead.isPlayer;
  const rivalBehind = !!behind && !behind.isPlayer;
  const rivalPressure = (rivalAhead && Number.isFinite(aheadGapMs) && aheadGapMs <= 900)
    || (rivalBehind && Number.isFinite(behindGapMs) && behindGapMs <= 900);
  const teammateBubble = (teammateAhead && Number.isFinite(aheadGapMs) && aheadGapMs <= 1200)
    || (teammateBehind && Number.isFinite(behindGapMs) && behindGapMs <= 1200);

  const currentPos = Number.isFinite(entry?.pos) ? Number(entry.pos) : null;
  return {
    currentPos,
    teammateAhead,
    teammateBehind,
    rivalAhead,
    rivalBehind,
    aheadGapMs,
    behindGapMs,
    rivalPressure,
    teammateBubble,
    inCleanAir: !rivalPressure
  };
}

function buildPlayerCrashReport(options = {}) {
  const {
    pilotName,
    lap,
    totalLaps,
    weather,
    strategy,
    setup,
    engineFx,
    lapProfile,
    staffFx,
    rt,
    usefulLife,
    pressureContext
  } = options;

  const causes = [];
  const tips = [];
  const seenTips = new Set();
  const pushTip = (text) => {
    if (!text || seenTips.has(text)) return;
    seenTips.add(text);
    tips.push(text);
  };

  const riskLevel = Number(strategy?.riskLevel || 40);
  if (riskLevel >= 75) {
    causes.push(translateText('crash_cause_high_risk', 'High risk setup increased incident exposure.'));
    pushTip(translateText('crash_tip_reduce_risk', 'Reduce risk level by 10-20 points in similar races.'));
  } else if (riskLevel >= 60) {
    causes.push(translateText('crash_cause_medium_risk', 'Risk level was elevated for the race context.'));
    pushTip(translateText('crash_tip_reduce_risk_small', 'Trim risk level slightly and recover pace through cleaner stints.'));
  }

  if ((strategy?.engineMode || 'normal') === 'push') {
    causes.push(translateText('crash_cause_engine_push', 'Engine mode push raised stress during critical laps.'));
    pushTip(translateText('crash_tip_engine_mode', 'Use normal mode during unstable phases and push only in short windows.'));
  }

  if (weather === 'wet' && Number(strategy?.setup?.wetBias ?? 50) < 45) {
    causes.push(translateText('crash_cause_wet_setup', 'Wet setup bias was low for rainy conditions.'));
    pushTip(translateText('crash_tip_wet_setup', 'Increase wet setup bias when rain is expected or active.'));
  }

  if (Number(setup?.riskMult || 1) > 1.06) {
    causes.push(translateText('crash_cause_setup_instability', 'Setup balance increased instability in this race context.'));
    pushTip(translateText('crash_tip_setup_stability', 'Use a more neutral setup balance to reduce instability.'));
  }

  if (Number(lapProfile?.riskBias || 1) >= 1.1) {
    causes.push(translateText('crash_cause_track_risky', 'Track conditions naturally carried higher incident risk.'));
    pushTip(translateText('crash_tip_track_management', 'On high-risk tracks, avoid stacking aggressive calls at the same time.'));
  }

  if (Number(staffFx?.incidentRiskMult || 1) > 0.95) {
    causes.push(translateText('crash_cause_risk_control', 'Risk control from the pit wall was limited under pressure.'));
    pushTip(translateText('crash_tip_staff_risk', 'Improve technical/race engineering support to stabilize race execution.'));
  }

  const pressure = pressureContext && typeof pressureContext === 'object' ? pressureContext : {};
  const hasLowExternalPressure = !!pressure.inCleanAir && !!pressure.teammateBubble && Number(pressure.currentPos || 99) <= 2;
  if (hasLowExternalPressure) {
    causes.push(translateText('crash_cause_low_external_pressure', 'There was no direct rival pressure at this moment; the incident likely came from setup/risk variance.'));
    pushTip(formatTranslatedText('crash_tip_hold_team_pace', {
      position: Number(pressure.currentPos || 1)
    }, 'When running in the top positions with your teammate nearby, hold team pace and avoid forced pushes.'));
  } else if (!!pressure.rivalPressure) {
    pushTip(translateText('crash_tip_avoid_dirty_air', 'In close rival battles, lower aggression one step and avoid unstable dirty-air entries.'));
  }

  const wearOveruse = Number.isFinite(rt?.wear) && Number.isFinite(usefulLife)
    ? Number(rt.wear) - Number(usefulLife)
    : 0;
  if (wearOveruse > 0.35) {
    causes.push(translateText('crash_cause_tyre_overuse', 'Tyre life was stretched beyond the safe performance window.'));
    pushTip(translateText('crash_tip_tyre_window', 'Pit 1-2 laps earlier when tyre drop warnings appear.'));
    const bringForward = wearOveruse > 0.9 ? 3 : 2;
    pushTip(formatTranslatedText('crash_tip_dynamic_pit', { laps: bringForward }, 'Bring your next pit stop forward by about {laps} laps in this context.'));
  }

  if ((engineFx?.risk || 0) > 0.1 && riskLevel >= 65) {
    causes.push(translateText('crash_cause_risk_stack', 'Multiple aggressive choices compounded overall race risk.'));
    pushTip(translateText('crash_tip_avoid_stack', 'Do not combine high risk level and push mode for long stints.'));
  }

  if (riskLevel >= 55) {
    const targetRisk = clamp(riskLevel >= 70 ? riskLevel - 15 : riskLevel - 8, 42, 62);
    pushTip(formatTranslatedText('crash_tip_target_risk', {
      targetRisk
    }, 'For this setup, target risk around {targetRisk} instead of over-pushing.'));
  }

  if ((strategy?.engineMode || 'normal') === 'push' && Number.isFinite(totalLaps)) {
    const finalWindow = Math.max(5, Math.round(totalLaps * 0.2));
    const pushLapStart = Math.max(1, totalLaps - finalWindow + 1);
    pushTip(formatTranslatedText('crash_tip_push_window', {
      pushLapStart,
      finalWindow
    }, 'Keep engine mode normal and switch to push only from lap {pushLapStart} (last {finalWindow} laps).'));
  }

  if (!causes.length) {
    causes.push(translateText('crash_cause_generic', 'Incident likely came from race variance under pressure conditions.'));
    pushTip(translateText('crash_tip_generic', 'Use a slightly safer baseline and escalate only after stable pace is confirmed.'));
    pushTip(formatTranslatedText('crash_tip_target_risk', { targetRisk: 50 }, 'For this setup, target risk around {targetRisk} instead of over-pushing.'));
  }

  return {
    pilotName: pilotName || translateText('race_driver', 'Driver'),
    lap: Number.isFinite(lap) ? lap : null,
    totalLaps: Number.isFinite(totalLaps) ? totalLaps : null,
    causes,
    tips: tips.length ? tips.slice(0, 4) : [translateText('crash_tip_generic', 'Use a slightly safer baseline and escalate only after stable pace is confirmed.')]
  };
}

function pickRaceSnapshotLaps(totalLaps) {
  const safeTotal = Math.max(1, Math.round(Number(totalLaps) || 1));
  return Array.from(new Set([
    1,
    Math.max(1, Math.round(safeTotal * 0.25)),
    Math.max(1, Math.round(safeTotal * 0.5)),
    Math.max(1, Math.round(safeTotal * 0.75)),
    safeTotal
  ])).sort((a, b) => a - b);
}

function buildRaceAdminReport(result, stateArg = null) {
  const state = stateArg || S.getState();
  const playerCars = Array.isArray(result?.playerCars) ? result.playerCars : [];
  const finalGrid = Array.isArray(result?.finalGrid) ? result.finalGrid : [];
  const gridStart = Array.isArray(result?.gridStart) ? result.gridStart : [];
  const lapSnapshots = Array.isArray(result?.lapSnapshots) ? result.lapSnapshots : [];
  const totalLaps = Math.max(1, Math.round(Number(result?.totalLaps || result?.circuit?.laps || lapSnapshots.length || 1)));
  const lastSnapshot = lapSnapshots[lapSnapshots.length - 1] || null;
  const weatherStart = lapSnapshots[0]?.weather || result?.weather || 'dry';
  const weatherEnd = lastSnapshot?.weather || result?.weather || weatherStart;
  const weatherChanges = lapSnapshots.reduce((count, snapshot, idx) => {
    if (idx === 0) return count;
    return snapshot?.weather !== lapSnapshots[idx - 1]?.weather ? count + 1 : count;
  }, 0);
  const componentState = state?.car?.components || {};
  const hq = state?.hq || {};
  const pilotMap = Object.fromEntries((state?.pilots || []).map((pilot) => [pilot.id, pilot]));
  const finalGridMap = Object.fromEntries(finalGrid.map((entry) => [entry.id, entry]));
  const startGridMap = Object.fromEntries(gridStart.map((entry) => [entry.id, entry]));
  const checkpointLaps = pickRaceSnapshotLaps(totalLaps);
  const circuitProfile = result?.circuitProfile || getCircuitProfile(result?.circuit, weatherEnd);
  const staffFx = result?.staffImpact || getRaceStaffEffects(state);
  const eventCounts = (Array.isArray(result?.events) ? result.events : []).reduce((acc, event) => {
    const key = String(event?.type || 'info');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { info: 0, good: 0, pit: 0, safety: 0, incident: 0 });

  const getSnapshotEntry = (lap, carId) => {
    const snapshot = lapSnapshots[Math.max(0, Math.min(lapSnapshots.length - 1, Math.round(Number(lap) || 1) - 1))];
    if (!snapshot || !Array.isArray(snapshot.order)) return null;
    return snapshot.order.find((entry) => entry.id === carId) || null;
  };

  const topClassification = ((lastSnapshot && Array.isArray(lastSnapshot.order)) ? lastSnapshot.order : finalGrid)
    .slice(0, 5)
    .map((entry, idx) => {
      const label = entry?.pilotName || entry?.name || `Car ${idx + 1}`;
      const gap = idx === 0 ? 'leader' : formatGapMs(entry?.gapMs);
      return `- P${idx + 1}: ${label} | gap ${gap}`;
    });

  const flags = [];
  const p2Gap = Number(lastSnapshot?.order?.[1]?.gapMs);
  if (Number.isFinite(p2Gap) && p2Gap >= 20000) {
    flags.push(`Final gap leader -> P2 = ${formatGapMs(p2Gap)} (threshold 20.0s)`);
  }

  const avgPlayerPitMs = averageFinite(playerCars.map((car) => Number(car?.pitTimeMs) || 0), 0);
  if (avgPlayerPitMs >= 24000) {
    flags.push(`Average player pit loss = ${formatGapMs(avgPlayerPitMs)} (threshold 24.0s)`);
  }
  if (weatherChanges > 1) {
    flags.push(`Weather changed ${weatherChanges} times in one race.`);
  }

  const driverSections = playerCars.map((car, index) => {
    const pilot = pilotMap[car.pilotId] || {
      id: car.pilotId,
      name: car.pilotName || `Driver ${index + 1}`,
      attrs: {}
    };
    const finalEntry = finalGridMap[car.id] || {};
    const startEntry = startGridMap[car.id] || {};
    const strategy = car.strategy || finalEntry.strategy || {};
    const setupFx = getSetupEffects(result?.circuit, weatherEnd, strategy?.setup || {});
    const engineFx = getEngineModeFx(strategy?.engineMode || 'normal');
    const raceStrength = getPilotRaceStrength(pilot, weatherEnd, strategy);
    const basePaceScore = Number(finalEntry?.base || finalEntry?.score || finalEntry?.gridScore || raceStrength);
    const finalGapMs = Number(getSnapshotEntry(totalLaps, car.id)?.gapMs);
    const lastFiveRefGapMs = Number(getSnapshotEntry(Math.max(1, totalLaps - 4), car.id)?.gapMs);
    const lastFiveDeltaMs = Number.isFinite(finalGapMs) && Number.isFinite(lastFiveRefGapMs)
      ? (finalGapMs - lastFiveRefGapMs)
      : null;
    const gridGain = Number(car?.startPos || startEntry?.pos || 0) - Number(car?.position || finalEntry?.pos || 0);
    const finalTyre = finalEntry?.tyre || car?.tyre || strategy?.tyre || 'medium';
    const tyreUsefulLife = getTyreUsefulLife(finalTyre, weatherEnd, totalLaps);
    const tyrePaceDeltaMs = getTyrePaceDeltaMs(finalTyre, weatherEnd);

    if (Number.isFinite(finalGapMs) && finalGapMs >= 20000) {
      flags.push(`${car.pilotName || pilot.name} finished ${formatGapMs(finalGapMs)} behind the leader.`);
    }
    if (Number.isFinite(lastFiveDeltaMs) && lastFiveDeltaMs >= 12000) {
      flags.push(`${car.pilotName || pilot.name} lost ${formatSignedGapDeltaMs(lastFiveDeltaMs)} to the leader over the last 5 laps.`);
    }

    const pilotAttrs = ['pace', 'racePace', 'consistency', 'rain', 'tyre', 'aggression', 'overtake', 'techFB', 'mental']
      .map((key) => `${translateText(`attr_${key}`, key)} ${getPilotAttr(pilot, key, 55)}`)
      .join(' | ');

    const checkpoints = checkpointLaps
      .map((lap) => {
        const snapshotEntry = getSnapshotEntry(lap, car.id);
        if (!snapshotEntry) return null;
        return `L${lap}: P${snapshotEntry.pos} ${formatGapMs(snapshotEntry.gapMs)}${snapshotEntry.pit ? ' PIT' : ''}`;
      })
      .filter(Boolean)
      .join(' | ');

    return [
      `DRIVER ${index + 1}: ${car.pilotName || pilot.name}`,
      `- Finish: ${car.isDNF ? 'DNF' : `P${car.position}`} from P${car.startPos || startEntry.pos || '?'} | grid delta ${formatSignedDelta(gridGain, '0')} | points ${car.points || 0} | final gap ${formatGapMs(finalGapMs)} | pit loss ${formatGapMs(car.pitTimeMs)} | stops ${car.pitStopsDone || 0}`,
      `- Strategy: start tyre ${(strategy.tyre || car.tyre || 'medium')} | finish tyre ${finalTyre} | pit plan ${strategy.pitPlan || 'single'} | aggression ${strategy.aggression || 50} | risk ${strategy.riskLevel || 40} | engine ${strategy.engineMode || 'normal'} | aero ${strategy?.setup?.aeroBalance ?? 50} | wet ${strategy?.setup?.wetBias ?? 50}`,
      `- Pilot attrs: ${pilotAttrs}`,
      `- Derived inputs: raceStrength ${raceStrength.toFixed(1)} | base pace ${basePaceScore.toFixed(1)} | setup paceMult ${setupFx.paceMult.toFixed(3)} | setup riskMult ${setupFx.riskMult.toFixed(3)} | setup tyreMult ${setupFx.tyreMult.toFixed(3)} | engine paceFx ${engineFx.pace.toFixed(2)} | engine riskFx ${engineFx.risk.toFixed(2)} | tyre delta ${tyrePaceDeltaMs} ms/lap | useful tyre life ${tyreUsefulLife.toFixed(1)} laps`,
      `- Gap checkpoints: ${checkpoints || 'n/a'}`,
      `- Last 5 laps gap delta: ${formatSignedGapDeltaMs(lastFiveDeltaMs)}`
    ].join('\n');
  });

  const summaryLines = [
    'ADMIN RACE REPORT',
    `Round: ${Number(result?.round || 0)}`,
    `Circuit: ${result?.circuit?.name || 'Unknown'} | layout ${(result?.circuit?.layout || 'mixed')} | laps ${totalLaps} | length ${result?.circuit?.length || 'n/a'}`,
    `Weather: start ${weatherStart} -> end ${weatherEnd} | changes ${weatherChanges}`,
    `Team result: ${result?.points || 0} pts | best finish ${playerCars[0]?.isDNF ? 'DNF' : `P${playerCars[0]?.position || result?.position || 0}`} | prize ${Number(result?.prizeMoney || 0)} CR`,
    '',
    'BALANCE FLAGS',
    ...(flags.length ? flags.map((line) => `- ${line}`) : ['- No extreme balance flags detected with current thresholds.']),
    '',
    'TOP OF CLASSIFICATION',
    ...(topClassification.length ? topClassification : ['- n/a']),
    '',
    'RACE CONTEXT',
    `- Circuit profile: paceBias ${Number(circuitProfile?.paceBias || 1).toFixed(3)} | overtakeBias ${Number(circuitProfile?.overtakeBias || 1).toFixed(3)} | tyreDegMult ${Number(circuitProfile?.tyreDegMult || 1).toFixed(3)} | riskBias ${Number(circuitProfile?.riskBias || 1).toFixed(3)}`,
    `- Staff effects: pitErrorMult ${Number(staffFx?.pitErrorChanceMult || 1).toFixed(3)} | pitGainChance ${(Number(staffFx?.pitTimeGainChance || 0) * 100).toFixed(0)}% | undercut ${(Number(staffFx?.undercutStrength || 0) * 100).toFixed(0)}% | overcut ${(Number(staffFx?.overcutStrength || 0) * 100).toFixed(0)}% | incidentRiskMult ${Number(staffFx?.incidentRiskMult || 1).toFixed(3)} | overtakeBonus ${Number(staffFx?.overtakeBonus || 0).toFixed(3)} | paceBonus ${Number(staffFx?.paceBonus || 0).toFixed(3)}`,
    `- HQ: admin ${Number(hq?.admin || 1)} | wind_tunnel ${Number(hq?.wind_tunnel || 1)} | rnd ${Number(hq?.rnd || 1)} | factory ${Number(hq?.factory || 1)} | academy ${Number(hq?.academy || 1)}`,
    `- Car components: engine ${Number(componentState?.engine?.score || 0)} | chassis ${Number(componentState?.chassis?.score || 0)} | aero ${Number(componentState?.aero?.score || 0)} | tyreManage ${Number(componentState?.tyreManage?.score || 0)} | brakes ${Number(componentState?.brakes?.score || 0)} | gearbox ${Number(componentState?.gearbox?.score || 0)} | reliability ${Number(componentState?.reliability?.score || 0)} | efficiency ${Number(componentState?.efficiency?.score || 0)}`,
    `- Event counts: info ${eventCounts.info || 0} | good ${eventCounts.good || 0} | pit ${eventCounts.pit || 0} | safety ${eventCounts.safety || 0} | incident ${eventCounts.incident || 0}`,
    '',
    'MODEL COEFFICIENTS',
    '- Base race strength uses 50% car score + 50% pilot race strength, then applies track/setup multipliers and some aggression bonus.',
    '- Player lap time formula: 94500 - rawPace*175 - aggressionDelta*22 - engineModePace*2600 + tyreDelta + wearPenalty + noise.',
    '- AI lap time uses the same structure but rawPace is multiplied by 160 instead of 175 and noise is wider.',
    '- Wear penalty begins after useful tyre life and scales as (wear - usefulLife) * 1900 ms/lap.',
    '- Safety car lap base is 110000 ms and compresses active gaps to 55% of their previous spread.',
    '- Successful overtake events swing roughly 950 ms; spin events add about 2600 ms per lost position.',
    '',
    ...driverSections.flatMap((section) => ['', section])
  ];

  return {
    version: 1,
    generatedAt: Date.now(),
    flags,
    summary: {
      weatherStart,
      weatherEnd,
      weatherChanges,
      p2GapMs: Number.isFinite(p2Gap) ? p2Gap : null,
      averagePlayerPitMs: avgPlayerPitMs
    },
    text: summaryLines.join('\n')
  };
}

function buildRacePerformanceReport(result, stateArg = null) {
  const state = stateArg || S.getState();
  const playerCars = Array.isArray(result?.playerCars) ? result.playerCars : [];
  const playerPilots = playerCars.map((car) => {
    return (state?.pilots || []).find((pilot) => pilot.id === car.pilotId) || {
      id: car.pilotId || car.id,
      name: car.pilotName || 'Driver',
      attrs: {
        pace: 55,
        racePace: 55,
        consistency: 55,
        rain: 55,
        tyre: 55,
        aggression: 55,
        overtake: 55,
        techFB: 55,
        mental: 55,
        charisma: 55
      }
    };
  });
  const avgAttr = (key, fallback = 55) => averageFinite(playerPilots.map((pilot) => getPilotAttr(pilot, key, fallback)), fallback);
  const avgPosition = averageFinite(playerCars.map((car) => Number(car.position)), Number(result?.position) || 10);
  const avgGridGain = averageFinite(playerCars.map((car) => -(Number(car.improvement) || 0)), 0);
  const dnfCount = playerCars.filter((car) => car.isDNF).length;
  const avgPitTimeMs = averageFinite(playerCars.map((car) => Number(car.pitTimeMs) || 0), 0);
  const avgSetupFit = averageFinite(playerCars.map((car) => {
    const setupFx = getSetupEffects(result?.circuit, result?.weather || 'dry', car?.strategy?.setup || {});
    return clamp(56 + ((setupFx.paceMult - 1) * 180) - ((setupFx.tyreMult - 1) * 40), 20, 99);
  }), 58);
  const staffSetupScore = averageFinite((state?.staff || []).map((member) => Number(member?.attrs?.setup) || 0), 58);
  const staffTechnicalScore = averageFinite((state?.staff || []).map((member) => Number(member?.attrs?.technical) || 0), 58);
  const staffPitScore = averageFinite((state?.staff || []).map((member) => Number(member?.attrs?.pitStrategy) || 0), 58);
  const hq = state?.hq || {};
  const carComponents = state?.car?.components || {};
  const carPaceCore = averageFinite([
    Number(carComponents?.engine?.score),
    Number(carComponents?.chassis?.score),
    Number(carComponents?.aero?.score)
  ], 60);
  const tyreCore = averageFinite([
    Number(carComponents?.tyreManage?.score),
    Number(carComponents?.brakes?.score),
    Number(carComponents?.gearbox?.score)
  ], 60);
  const reliabilityCore = averageFinite([
    Number(carComponents?.reliability?.score),
    Number(carComponents?.gearbox?.score),
    Number(carComponents?.brakes?.score)
  ], 60);
  const positionScore = clamp(96 - ((avgPosition - 1) * 6), 24, 98);
  const gainScore = clamp(52 + (avgGridGain * 8), 22, 96);
  const finishPenalty = dnfCount * 12;
  const pitExecutionScore = clamp(82 - Math.max(0, (avgPitTimeMs - 18000) / 280), 26, 94);

  const categories = [
    {
      id: 'pace',
      labelKey: 'report_category_pace',
      score: clamp((avgAttr('pace') * 0.25) + (avgAttr('racePace') * 0.25) + (carPaceCore * 0.35) + (positionScore * 0.15) - finishPenalty, 20, 99),
      focusAttrKeys: ['pace', 'racePace'],
      buildingId: 'rnd',
      componentKey: 'engine',
      staffLabel: 'Chief Engineer'
    },
    {
      id: 'race_craft',
      labelKey: 'report_category_race_craft',
      score: clamp((avgAttr('racePace') * 0.26) + (avgAttr('overtake') * 0.2) + (avgAttr('aggression') * 0.14) + (avgAttr('mental') * 0.1) + (positionScore * 0.15) + (gainScore * 0.15) - finishPenalty, 20, 99),
      focusAttrKeys: ['racePace', 'overtake', 'aggression'],
      buildingId: 'academy',
      componentKey: null,
      staffLabel: 'Pilot Coach'
    },
    {
      id: 'tyre_management',
      labelKey: 'report_category_tyre_management',
      score: clamp((avgAttr('tyre') * 0.38) + (avgAttr('consistency') * 0.14) + (avgAttr('rain') * 0.08) + (tyreCore * 0.3) + (pitExecutionScore * 0.1) - finishPenalty, 20, 99),
      focusAttrKeys: ['tyre', 'consistency'],
      buildingId: 'factory',
      componentKey: 'tyre_manage',
      staffLabel: 'Pilot Coach'
    },
    {
      id: 'setup_data',
      labelKey: 'report_category_setup_data',
      score: clamp((avgSetupFit * 0.34) + (staffSetupScore * 0.23) + (staffTechnicalScore * 0.18) + (avgAttr('techFB') * 0.15) + ((Number(hq?.wind_tunnel || 1) * 5) + (Number(hq?.rnd || 1) * 4)), 20, 99),
      focusAttrKeys: ['techFB', 'mental'],
      buildingId: 'wind_tunnel',
      componentKey: 'aero',
      staffLabel: 'Race Engineer / Data Analyst'
    },
    {
      id: 'pit_execution',
      labelKey: 'report_category_pit_execution',
      score: clamp((staffPitScore * 0.34) + (avgAttr('mental') * 0.16) + (avgAttr('consistency') * 0.16) + (pitExecutionScore * 0.22) + (Number(hq?.factory || 1) * 6), 20, 99),
      focusAttrKeys: ['mental', 'consistency'],
      buildingId: 'factory',
      componentKey: null,
      staffLabel: 'Head of Pits'
    },
    {
      id: 'reliability',
      labelKey: 'report_category_reliability',
      score: clamp((reliabilityCore * 0.42) + (avgAttr('consistency') * 0.18) + (avgAttr('mental') * 0.12) + (positionScore * 0.1) + (Number(hq?.factory || 1) * 5) - (dnfCount * 18), 15, 99),
      focusAttrKeys: ['consistency', 'mental'],
      buildingId: 'factory',
      componentKey: 'reliability',
      staffLabel: 'Chief Engineer'
    }
  ].map((category) => ({
    ...category,
    stars: scoreToStars(category.score)
  }));

  const driverReports = playerCars.map((car) => {
    const pilot = playerPilots.find((entry) => entry.id === car.pilotId) || playerPilots[0] || { attrs: {} };
    const finishAdjust = car.isDNF
      ? -10
      : clamp(10 - ((Number(car.position || result?.position || 10) - 1) * 1.6) + ((-(Number(car.improvement) || 0)) * 1.5), -4, 12);
    const attributeKeys = ['pace', 'racePace', 'consistency', 'rain', 'tyre', 'mental', 'techFB'];
    const attributes = attributeKeys.map((key) => {
      const baseValue = getPilotAttr(pilot, key, 55);
      const conditionBonus = key === 'rain' && result?.weather === 'wet'
        ? 6
        : key === 'tyre'
          ? 4
          : key === 'techFB'
            ? 3
            : 0;
      const score = clamp(baseValue + finishAdjust + conditionBonus, 20, 99);
      return {
        key,
        score,
        stars: scoreToStars(score)
      };
    });
    const sortedAttrs = [...attributes].sort((a, b) => a.score - b.score);
    const overallScore = Math.round(averageFinite(attributes.map((attr) => attr.score), 55));
    return {
      pilotId: car.pilotId,
      pilotName: car.pilotName,
      position: car.position,
      isDNF: !!car.isDNF,
      overallScore,
      overallStars: scoreToStars(overallScore),
      weakestAttrKey: sortedAttrs[0]?.key || 'pace',
      strongestAttrKey: sortedAttrs[sortedAttrs.length - 1]?.key || 'racePace',
      attributes
    };
  });

  const weakestCategories = [...categories].sort((a, b) => a.score - b.score).slice(0, 2).map((category) => category.id);
  const teamFocusAttrs = Array.from(new Set(weakestCategories.flatMap((categoryId) => {
    const category = categories.find((entry) => entry.id === categoryId);
    return Array.isArray(category?.focusAttrKeys) ? category.focusAttrKeys : [];
  })));
  const overallScore = Math.round(averageFinite(categories.map((category) => category.score), 55));

  return {
    version: 1,
    round: Number(result?.round || 0),
    circuitId: result?.circuit?.id || null,
    weather: result?.weather || 'dry',
    generatedAt: Date.now(),
    overallScore,
    overallStars: scoreToStars(overallScore),
    weakestCategories,
    teamFocusAttrs,
    categories,
    driverReports
  };
}

function buildRaceArchiveRecord(result, raceMeta = {}, stateArg = null) {
  const report = result?.performanceReport || buildRacePerformanceReport(result, stateArg);
  const adminReport = result?.adminReport || buildRaceAdminReport(result, stateArg);
  return {
    round: Number(raceMeta?.round || result?.round || 0),
    ts: Number(raceMeta?.ts || Date.now()),
    circuit: result?.circuit ? {
      id: result.circuit.id,
      name: result.circuit.name,
      country: result.circuit.country,
      layout: result.circuit.layout,
      laps: result.circuit.laps,
      length: result.circuit.length
    } : null,
    weather: result?.weather || raceMeta?.weather || 'dry',
    position: Number(result?.position || 0),
    points: Number(result?.points || 0),
    prizeMoney: Number(result?.prizeMoney || 0),
    playerCars: Array.isArray(result?.playerCars) ? result.playerCars.map((car) => ({
      pilotId: car.pilotId,
      pilotName: car.pilotName,
      position: car.position,
      points: car.points,
      isDNF: !!car.isDNF,
      improvement: car.improvement,
      pitStopsDone: car.pitStopsDone,
      pitTimeMs: car.pitTimeMs
    })) : [],
    performanceReport: report,
    adminReport
  };
}

function upsertRaceArchiveRecord(stateArg, record) {
  if (!stateArg || !record) return null;
  if (!Array.isArray(stateArg.raceResults)) stateArg.raceResults = [];
  const existingIdx = stateArg.raceResults.findIndex((entry) => {
    return Number(entry?.round || 0) === Number(record.round || 0)
      && String(entry?.circuit?.id || '') === String(record?.circuit?.id || '');
  });
  if (existingIdx >= 0) {
    stateArg.raceResults[existingIdx] = record;
  } else {
    stateArg.raceResults.push(record);
  }
  if (stateArg.raceResults.length > 64) stateArg.raceResults.shift();
  return record;
}

// ---- race simulation ----
function simulateRace(options = {}) {
  const state = S.getState();
  const staffFx = getRaceStaffEffects(state);
  const { weather = 'dry', circuits, round } = options;
  const baseStrategy = options.strategy || {
    tyre: 'medium', aggression: 50, pitLap: 42, riskLevel: 50, engineMode: 'normal', strategy: 'balanced', pitPlan: 'single', safetyCarReaction: 'live'
  };

  const fallbackPilot = { attrs:{ pace:55, racePace:55, consistency:60, rain:55, tyre:55, aggression:60, overtake:55, techFB:55, mental:55, charisma:60 }, name:'Driver' };
  const allPilots = (state.pilots && state.pilots.length) ? state.pilots : [fallbackPilot];
  const requestedIds = [];
  if (Array.isArray(options.selectedPilotIds)) requestedIds.push(...options.selectedPilotIds);
  if (Array.isArray(baseStrategy.selectedPilotIds)) requestedIds.push(...baseStrategy.selectedPilotIds);
  if (options.pilotId) requestedIds.push(options.pilotId);
  if (baseStrategy.pilotId) requestedIds.push(baseStrategy.pilotId);

  const selectedPilots = [];
  requestedIds.forEach((id) => {
    if (!id || selectedPilots.find((p) => p.id === id)) return;
    const found = allPilots.find((p) => p.id === id);
    if (found) selectedPilots.push(found);
  });
  allPilots.forEach((p) => {
    if (selectedPilots.length >= 2) return;
    if (!selectedPilots.find((x) => x.id === p.id)) selectedPilots.push(p);
  });

  const normalizeDriverStrategy = (driverStrategy = {}) => {
    const normalizedPitPlan = normalizePitPlan(driverStrategy.pitPlan || baseStrategy.pitPlan || 'single');
    const strategySource = {
      ...baseStrategy,
      ...driverStrategy,
      pitPlan: normalizedPitPlan,
      interventions: Array.isArray(driverStrategy.interventions)
        ? driverStrategy.interventions
        : (Array.isArray(baseStrategy.interventions) ? baseStrategy.interventions : undefined)
    };
    const normalizedInterventions = normalizeStrategyInterventions(strategySource, getPrimaryStopLapPct(strategySource, 50));
    const defaultTyre = driverStrategy.tyre || baseStrategy.tyre || getDefaultRaceTyre(weather);
    return {
      tyre: defaultTyre,
      aggression: Number.isFinite(driverStrategy.aggression) ? driverStrategy.aggression : (baseStrategy.aggression || 50),
      pitLap: normalizedInterventions[0].lapPct,
      riskLevel: Number.isFinite(driverStrategy.riskLevel) ? driverStrategy.riskLevel : (baseStrategy.riskLevel || 40),
      engineMode: driverStrategy.engineMode || baseStrategy.engineMode || 'normal',
      strategy: driverStrategy.strategy || baseStrategy.strategy || 'balanced',
      pitPlan: normalizedPitPlan,
      safetyCarReaction: 'live',
      pitTyres: getDefaultPitTyres({ ...(driverStrategy.pitTyres ? driverStrategy : baseStrategy), tyre: defaultTyre, pitPlan: normalizedPitPlan }, weather),
      setup: {
        aeroBalance: Number.isFinite(driverStrategy?.setup?.aeroBalance) ? driverStrategy.setup.aeroBalance : (baseStrategy?.setup?.aeroBalance ?? 50),
        wetBias: Number.isFinite(driverStrategy?.setup?.wetBias) ? driverStrategy.setup.wetBias : (baseStrategy?.setup?.wetBias ?? 50)
      },
      interventions: normalizedInterventions
    };
  };

  const driverConfigs = (baseStrategy && baseStrategy.driverConfigs) ? baseStrategy.driverConfigs : {};
  const selectedDrivers = selectedPilots.slice(0, 2).map((pilot, idx) => {
    const raw = driverConfigs[pilot.id] || {};
    return {
      slot: idx + 1,
      id: `player_${idx + 1}`,
      pilotId: pilot.id || `pilot_${idx + 1}`,
      pilot,
      strategy: normalizeDriverStrategy(raw)
    };
  });

  const leadDriver = selectedDrivers[0] || {
    slot: 1,
    id: 'player_1',
    pilotId: 'pilot_1',
    pilot: fallbackPilot,
    strategy: normalizeDriverStrategy({})
  };

  const profile = getCircuitProfile(circuits, weather);
  const forecast = options.forecast || null;
  const configuredLaps = Number(circuits?.laps);
  const totalLaps = Number.isFinite(configuredLaps) && configuredLaps > 0 ? Math.round(configuredLaps) : 30;
  let liveWeather = weather;

  let grid = buildRaceGrid(leadDriver.pilot, liveWeather, circuits, leadDriver.strategy).map((entry) => {
    if (!entry.isPlayer) return entry;
    return {
      ...entry,
      id: leadDriver.id,
      name: `${state.team.name || 'Your Team'} · ${leadDriver.pilot.name}`,
      pilotId: leadDriver.pilotId,
      pilotName: leadDriver.pilot.name,
      consistency: getPilotAttr(leadDriver.pilot, 'consistency', 60),
      teamSlot: leadDriver.slot,
      strategy: cloneData(leadDriver.strategy),
      score: entry.score * (1 + staffFx.paceBonus)
    };
  });

  if (selectedDrivers[1]) {
    const secondDriver = selectedDrivers[1];
    const carData = S.getCar().components;
    const car = carScore();
    const pilotSc = getPilotGridStrength(secondDriver.pilot, liveWeather);
    const setupFx = getSetupEffects(circuits, liveWeather, secondDriver.strategy.setup || {});
    const layout = profile.layout;
    const layoutCarComponent = {
      'high-speed': (carData.engine.score + carData.efficiency.score) / 2,
      power: (carData.engine.score + carData.gearbox.score) / 2,
      technical: (carData.brakes.score + carData.chassis.score + carData.aero.score) / 3,
      mixed: (carData.chassis.score + carData.aero.score + carData.reliability.score) / 3,
      endurance: (carData.reliability.score + carData.tyreManage.score + carData.efficiency.score) / 3
    };
    const trackCarBonus = ((layoutCarComponent[layout] || car) - 50) * 0.12;
    const weatherDriverMult = liveWeather === 'wet' ? 0.92 : 1;
    const base = ((car * 0.56 + pilotSc * 0.44) + trackCarBonus) * weatherDriverMult * profile.paceBias * setupFx.paceMult;
    grid.push({
      id: secondDriver.id,
      name: `${state.team.name || 'Your Team'} · ${secondDriver.pilot.name}`,
      color: state.team.colors.primary,
      pilotId: secondDriver.pilotId,
      pilotName: secondDriver.pilot.name,
      consistency: getPilotAttr(secondDriver.pilot, 'consistency', 60),
      teamSlot: secondDriver.slot,
      isPlayer: true,
      base,
      score: (base + (Math.random() - 0.5) * 10) * (1 + staffFx.paceBonus),
      tyre: secondDriver.strategy.tyre || 'medium',
      wear: 0,
      gaps: 0,
      strategy: cloneData(secondDriver.strategy)
    });
  }

  grid.sort((a, b) => b.score - a.score);

  const events = [];
  const lapSnapshots = [];
  const crashReportsByCarId = {};
  let safetyCarActive = false;
  let weatherChangesDone = 0;

  // Build the starting grid directly from race-weekend form.
  grid.forEach(e => {
    e.gridScore = e.score + (Math.random() - 0.5) * 8;
    if (e.isPlayer) {
      e.tyre = (e.strategy && e.strategy.tyre) || leadDriver.strategy.tyre;
    }
  });
  grid.sort((a, b) => b.gridScore - a.gridScore);
  const gridStart = grid.map(e => ({...e}));
  const playerStarts = gridStart.filter(e => e.isPlayer).map((e) => ({
    carId: e.id,
    pilotName: e.pilotName || 'Driver',
    startPos: gridStart.findIndex((x) => x.id === e.id) + 1
  }));

  const gridText = playerStarts
    .map((x) => `${x.pilotName}: P${x.startPos}`)
    .join(' · ');
  const openingWeatherText = liveWeather === 'wet'
    ? `🌧️ ${translateText('race_weather_expected_wet', 'Wet race expected.')}`
    : `☀️ ${translateText('race_weather_expected_dry', 'Dry race expected.')}`;
  const openingLayoutText = circuits?.layout
    ? ` · ${translateText(`track_layout_${String(circuits.layout).replace('-', '_')}`, circuits.layout)}`
    : '';
  events.push({
    lap: 0,
    type: 'info',
    text: formatTranslatedText('race_event_starting_grid', {
      grid: gridText,
      weatherText: openingWeatherText,
      layoutText: openingLayoutText
    }, '<strong>Starting grid:</strong> {grid}. {weatherText}{layoutText}')
  });

  // Race ticks
  const positions = grid.map((e, i) => ({
    ...e,
    pos: i + 1,
    laps: 0,
    pit: false,
    retired: false,
    timeMs: i * 650,
    pitStopsDone: 0,
    pitTimeMs: 0,
    lastPitLossMs: 0,
    lastPitLap: null
  }));
  const runtimes = {};
  const updateRunningOrder = () => {
    const activeCars = positions.filter((entry) => !entry.retired).sort((a, b) => a.timeMs - b.timeMs);
    const retiredCars = positions.filter((entry) => entry.retired);
    activeCars.forEach((entry, index) => {
      entry.pos = index + 1;
    });
    retiredCars.forEach((entry, index) => {
      entry.pos = activeCars.length + index + 1;
    });
  };

  positions.forEach((entry) => {
    const strategySeed = entry.strategy || normalizeDriverStrategy({
      tyre: entry.tyre || getDefaultRaceTyre(weather),
      aggression: entry.isPlayer ? 50 : (42 + Math.floor(Math.random() * 16)),
      pitLap: getBasePitWindowPct(entry.tyre || getDefaultRaceTyre(weather), weather, entry.tyre === 'soft' && weather !== 'wet' ? 'double' : 'single'),
      riskLevel: entry.isPlayer ? 40 : (34 + Math.floor(Math.random() * 18)),
      engineMode: 'normal',
      strategy: 'balanced',
      pitPlan: entry.tyre === 'soft' && weather !== 'wet' ? 'double' : 'single',
      pitTyres: getDefaultPitTyres({ tyre: entry.tyre || getDefaultRaceTyre(weather) }, weather),
      setup: { aeroBalance: 50, wetBias: weather === 'wet' ? 70 : 35 }
    });
    if (!entry.strategy) entry.strategy = cloneData(strategySeed);
    const s = entry.strategy;
    let maxPitStops = (s.pitPlan || 'single') === 'double' ? 2 : 1;
    const stopWindows = getConfiguredStopWindows(s, totalLaps);
    runtimes[entry.id] = {
      wear: 0,
      pitStopsDone: 0,
      maxPitStops,
      adaptivePitLap: stopWindows.firstLap,
      adaptivePitLap2: stopWindows.secondLap
    };
  });

  for (let lap = 1; lap <= totalLaps; lap++) {
    positions.forEach((entry) => {
      entry.pit = false;
      entry.lastPitLossMs = 0;
    });

    const uncertainty = forecast ? (1 - ((forecast.confidence || 60) / 100)) : 0.35;
    const raceWeatherSwingChance = forecast
      ? clamp(0.05 + (uncertainty * 0.22), 0.04, 0.18)
      : 0.12;
    const weatherFlipChance = weatherChangesDone >= 1 ? 0 : (raceWeatherSwingChance / Math.max(18, totalLaps));
    if (Math.random() < weatherFlipChance) {
      liveWeather = liveWeather === 'wet' ? 'dry' : 'wet';
      weatherChangesDone += 1;
      events.push({ lap, type: 'info', text: liveWeather === 'wet' ? `🌧️ ${translateText('race_event_weather_rain', 'Sudden rain hits the circuit!')}` : `☀️ ${translateText('race_event_weather_drying', 'Track is drying quickly.')}` });
    }

    const lapProfile = getCircuitProfile(circuits, liveWeather);

    // Safety car event
    if (!safetyCarActive && Math.random() < 0.06) {
      safetyCarActive = true;
      events.push({ lap, type: 'safety', text: `🟡 ${translateText('race_event_vsc', '<strong>Virtual Safety Car deployed!</strong> Pack bunches up.')}` });
      const activeCars = positions.filter((entry) => !entry.retired).sort((a, b) => a.timeMs - b.timeMs);
      const leaderTime = activeCars[0]?.timeMs || 0;
      activeCars.forEach((entry, index) => {
        if (index === 0) return;
        entry.timeMs = leaderTime + ((entry.timeMs - leaderTime) * 0.55);
      });

      let liveSafetyCarCall = 'neutral';
      const staffDelta = (staffFx.undercutStrength || 0.5) - (staffFx.overcutStrength || 0.5);
      const hasPendingPlayerPit = positions.some((e) => {
        if (!e.isPlayer || e.retired) return false;
        const rt = runtimes[e.id];
        return !!rt && rt.pitStopsDone < rt.maxPitStops;
      });
      if (hasPendingPlayerPit) {
        if (staffDelta > 0.08) liveSafetyCarCall = 'undercut';
        else if (staffDelta < -0.08) liveSafetyCarCall = 'overcut';
      }

      const underPct = Math.round((staffFx.undercutStrength || 0.5) * 100);
      const overPct = Math.round((staffFx.overcutStrength || 0.5) * 100);
      events.push({
        lap,
        type: 'info',
        text: `👥 ${formatTranslatedText('race_event_live_pit_call', {
          callLabel: translateText(`race_call_${liveSafetyCarCall}`, liveSafetyCarCall.toUpperCase()),
          underPct,
          overPct
        }, 'Live pit wall call: <strong>{callLabel}</strong> (Undercut {underPct}% · Overcut {overPct}%).')}`
      });

      positions.filter((e) => !e.retired).forEach((entry) => {
        const rt = runtimes[entry.id];
        if (!rt || rt.pitStopsDone >= rt.maxPitStops) return;
        const decisionSkill = entry.isPlayer ? 0.72 : (entry.strategy?.aiMeta?.decisionSkill || 0.55);
        if (liveSafetyCarCall === 'undercut') {
          const undercutWorks = Math.random() < (entry.isPlayer ? staffFx.undercutStrength : clamp(0.32 + decisionSkill * 0.5, 0.35, 0.86));
          if (rt.pitStopsDone === 0 && rt.adaptivePitLap - lap <= 3) {
            rt.adaptivePitLap = Math.max(lap + 1, undercutWorks ? 2 : rt.adaptivePitLap - 1);
            if (entry.isPlayer || decisionSkill > 0.76) {
              events.push({ lap, type: 'info', text: `🧠 ${formatTranslatedText(undercutWorks ? 'race_event_undercut_good' : 'race_event_undercut_minor', { name: entry.pilotName || entry.name }, '{name}: undercut call under VSC.')}` });
            }
          } else if (rt.pitStopsDone === 1 && rt.adaptivePitLap2 - lap <= 3) {
            rt.adaptivePitLap2 = Math.max(lap + 1, undercutWorks ? rt.adaptivePitLap2 - 1 : rt.adaptivePitLap2);
            if (entry.isPlayer || decisionSkill > 0.8) {
              events.push({ lap, type: 'info', text: `🧠 ${formatTranslatedText(undercutWorks ? 'race_event_undercut_second_good' : 'race_event_undercut_second_bad', { name: entry.pilotName || entry.name }, '{name}: undercut second stop.')}` });
            }
          }
        }
        if (liveSafetyCarCall === 'overcut') {
          const overcutWorks = Math.random() < (entry.isPlayer ? staffFx.overcutStrength : clamp(0.3 + decisionSkill * 0.48, 0.34, 0.84));
          if (rt.pitStopsDone === 0 && lap >= rt.adaptivePitLap - 2) {
            rt.adaptivePitLap = Math.min(totalLaps - 3, rt.adaptivePitLap + (overcutWorks ? 2 : 1));
            if (entry.isPlayer || decisionSkill > 0.76) {
              events.push({ lap, type: 'info', text: `🧠 ${formatTranslatedText(overcutWorks ? 'race_event_overcut_good' : 'race_event_overcut_minor', { name: entry.pilotName || entry.name }, '{name}: overcut call under VSC.')}` });
            }
          } else if (rt.pitStopsDone === 1 && lap >= rt.adaptivePitLap2 - 2) {
            rt.adaptivePitLap2 = Math.min(totalLaps - 2, rt.adaptivePitLap2 + (overcutWorks ? 2 : 1));
            if (entry.isPlayer || decisionSkill > 0.8) {
              events.push({ lap, type: 'info', text: `🧠 ${formatTranslatedText(overcutWorks ? 'race_event_overcut_second_good' : 'race_event_overcut_second_bad', { name: entry.pilotName || entry.name }, '{name}: overcut second stop.')}` });
            }
          }
        }
      });
    }
    if (safetyCarActive && Math.random() < 0.4) {
      safetyCarActive = false;
      events.push({ lap, type: 'info', text: `🟢 ${translateText('race_event_green_flag', 'Safety car period ends. Green flag!')}` });
    }

    positions.filter((entry) => !entry.retired).forEach((entry) => {
      const s = entry.strategy || leadDriver.strategy;
      const setup = getSetupEffects(circuits, liveWeather, s.setup || {});
      const engineFx = getEngineModeFx(s.engineMode || 'normal');
      const rt = runtimes[entry.id];
      const currentTyre = entry.tyre || s.tyre || 'medium';
      if (rt) {
        const baseWear = getTyreWearStep(currentTyre, liveWeather) * lapProfile.tyreDegMult * (1 + engineFx.tyre) * setup.tyreMult;
        const aggressionWear = Math.max(0, ((s.aggression || 50) - 50) * 0.003);
        rt.wear += baseWear + aggressionWear;
      }

      const rawPace = clamp(Number(entry.base || entry.score || entry.gridScore || 60), 35, 99);
      const paceMs = rawPace * (entry.isPlayer ? 175 : 160);
      const tyreDeltaMs = getTyrePaceDeltaMs(currentTyre, liveWeather);
      const aggressionMs = ((s.aggression || 50) - 50) * 16;
      const engineMs = (engineFx.pace || 0) * 2200;
      const usefulLife = getTyreUsefulLife(currentTyre, liveWeather, totalLaps);
      const wearOveruse = rt ? Math.max(0, rt.wear - usefulLife) : 0;
      const wearMs = wearOveruse * 1100;
      const lapBaseMs = safetyCarActive ? 110000 : 94500;
      const consistency = clamp(Number(entry.consistency || 60), 20, 99);
      const playerNoiseHalfRange = clamp(500 - (consistency * 3), 120, 520);
      const aiNoiseHalfRange = clamp(800 - (consistency * 2), 220, 900);
      const noiseHalfRange = entry.isPlayer ? playerNoiseHalfRange : aiNoiseHalfRange;
      const noiseMs = (Math.random() - 0.5) * (noiseHalfRange * 2);
      const lapTimeMs = lapBaseMs - paceMs - aggressionMs - engineMs + tyreDeltaMs + wearMs + noiseMs;
      entry.timeMs += Math.max(70000, lapTimeMs);
      entry.laps = lap;
    });

    let pitStopsThisLap = false;
    positions.filter((e) => !e.retired).forEach((entry) => {
      const rt = runtimes[entry.id];
      const s = entry.strategy || leadDriver.strategy;
      const entryLabel = entry.pilotName || entry.name || 'Driver';
      if (!rt) return;

      const nextPitLap = rt.pitStopsDone === 0 ? rt.adaptivePitLap : rt.adaptivePitLap2;
      if (rt.pitStopsDone < rt.maxPitStops && lap === nextPitLap) {
        rt.pitStopsDone++;
        rt.wear = 0;
        const requestedTyre = getConfiguredPitTyre(s, rt.pitStopsDone - 1, liveWeather);
        const newTyre = choosePitTyreForConditions(entry, s, rt.pitStopsDone - 1, liveWeather, forecast);
        const pitLossMs = getPitStopTimeMs(entry, liveWeather, safetyCarActive, staffFx);
        entry.timeMs += pitLossMs;
        entry.tyre = newTyre;
        entry.pit = true;
        entry.pitStopsDone = rt.pitStopsDone;
        entry.pitTimeMs += pitLossMs;
        entry.lastPitLossMs = pitLossMs;
        entry.lastPitLap = lap;
        pitStopsThisLap = true;
        const tyreLabel = translateText(`compound_${newTyre}`, newTyre);
        if (entry.isPlayer) {
          events.push({ lap, type: 'pit', text: `🔵 ${formatTranslatedText('race_event_player_pit', {
            pilotName: entry.pilotName,
            stop: rt.pitStopsDone,
            maxStops: rt.maxPitStops,
            lossSec: (pitLossMs / 1000).toFixed(1),
            tyreLabel
          }, '<strong>{pilotName} pits (stop {stop}/{maxStops})!</strong> Loses {lossSec}s and fits {tyreLabel}.')}` });
        } else {
          const tyreNote = requestedTyre !== newTyre ? translateText('race_event_ai_pit_adjust', ' Reacts to the weather and changes the plan.') : '';
          events.push({ lap, type: 'pit', text: `🛞 ${formatTranslatedText('race_event_ai_pit', {
            teamName: entry.name,
            stop: rt.pitStopsDone,
            maxStops: rt.maxPitStops,
            lossSec: (pitLossMs / 1000).toFixed(1),
            tyreLabel,
            tyreNote
          }, '<strong>{teamName}</strong> pits (stop {stop}/{maxStops}) and loses {lossSec}s. Fits {tyreLabel}.{tyreNote}')}` });
        }

        if (rt.pitStopsDone === 1 && rt.maxPitStops > 1) {
          rt.adaptivePitLap2 = Math.max(rt.adaptivePitLap2, lap + 6);
          rt.adaptivePitLap2 = Math.min(rt.adaptivePitLap2, totalLaps - 2);
        }
      }
    });

    if (pitStopsThisLap) updateRunningOrder();

    // Incidents
    positions.forEach(p => {
      if (!p.retired && !p.isPlayer) {
        if (Math.random() < 0.012) {
          p.retired = true;
          events.push({ lap, type: 'incident', text: `💥 ${formatTranslatedText('race_event_ai_retire', { name: p.name }, '<strong>{name}</strong> retires with mechanical failure!')}` });
        }
      }
    });
    positions.filter((e) => e.isPlayer && !e.retired).forEach((entry) => {
      const s = entry.strategy || leadDriver.strategy;
      const setup = getSetupEffects(circuits, liveWeather, s.setup || {});
      const engineFx = getEngineModeFx(s.engineMode || 'normal');
      const rt = runtimes[entry.id];
      if (!rt) return;

      const riskFactor = (s.riskLevel || 40) / 100;
      if (Math.random() < (0.01 * riskFactor + 0.004) * lapProfile.riskBias * (1 + engineFx.risk) * staffFx.incidentRiskMult * setup.riskMult) {
        if (Math.random() < 0.2) {
          const currentTyre = entry.tyre || s.tyre || 'medium';
          const usefulLife = getTyreUsefulLife(currentTyre, liveWeather, totalLaps);
          const pressureContext = getCrashPressureContext(entry, positions);
          entry.retired = true;
          crashReportsByCarId[entry.id] = buildPlayerCrashReport({
            pilotName: entry.pilotName,
            lap,
            totalLaps,
            weather: liveWeather,
            strategy: s,
            setup,
            engineFx,
            lapProfile,
            staffFx,
            rt,
            usefulLife,
            pressureContext
          });
          events.push({ lap, type: 'incident', text: `💥 ${formatTranslatedText('race_event_player_retire', { pilotName: entry.pilotName }, '<strong>{pilotName} retires!</strong> Mechanical issue. DNF.')}` });
        } else {
          const lostPos = Math.floor(Math.random() * 3) + 1;
          entry.timeMs += lostPos * 2600;
          events.push({ lap, type: 'incident', text: `⚠️ ${formatTranslatedText('race_event_player_spin', { pilotName: entry.pilotName, lostPos }, '<strong>{pilotName}</strong> has a spin! Drops {lostPos} position(s).')}` });
        }
      }

      if (!entry.pit && lap % 5 === 0 && !entry.retired) {
        const ahead = positions.find((x) => x.pos === entry.pos - 1 && !x.retired);
        if (ahead && Math.random() < ((((0.3 + ((s.aggression || 50) / 200)) * lapProfile.overtakeBias) + staffFx.overtakeBonus) * (1 + Math.max(0, engineFx.pace)) * Math.max(0.9, setup.paceMult))) {
          entry.timeMs = Math.max(0, entry.timeMs - 950);
          ahead.timeMs += 950;
          events.push({ lap, type: 'good', text: `✅ ${formatTranslatedText('race_event_player_overtake', { pilotName: entry.pilotName, aheadName: ahead.name, position: entry.pos }, '<strong>{pilotName}</strong> overtakes <strong>{aheadName}</strong>! Moves up to P{position}.')}` });
        }
        if (Math.random() < 0.12) {
          events.push({ lap, type: 'good', text: `🟢 ${formatTranslatedText('race_event_player_best_lap', { pilotName: entry.pilotName, lap }, 'Personal best lap by <strong>{pilotName}</strong> on lap {lap}.')}` });
        }
      }

      const currentTyre = entry.tyre || s.tyre || 'medium';
      const paceDelta = getTyreWeatherPaceDelta(currentTyre, liveWeather);
      const usefulLife = getTyreUsefulLife(currentTyre, liveWeather, totalLaps);
      const wearPenalty = Math.max(0, ((rt.wear / Math.max(1, usefulLife)) - 0.8) * 5.5);
      const perfScore = paceDelta - wearPenalty + ((s.aggression || 50) - 50) * 0.01;
      const currentTyreLabel = translateText(`compound_${currentTyre}`, currentTyre);
      const weatherLabel = translateText(liveWeather === 'wet' ? 'weather_wet' : 'weather_dry', liveWeather);

      if (!entry.pit && perfScore > 2.2 && Math.random() < 0.12) {
        entry.timeMs = Math.max(0, entry.timeMs - 650);
        events.push({ lap, type: 'good', text: `⚡ ${formatTranslatedText('race_event_player_tyre_push', { pilotName: entry.pilotName, tyreLabel: currentTyreLabel }, '<strong>{pilotName}</strong> gains pace advantage on {tyreLabel} and moves up.')}` });
      }
      if (!entry.pit && perfScore < -2.2 && Math.random() < 0.14) {
        entry.timeMs += 1400;
        events.push({ lap, type: 'incident', text: `📉 ${formatTranslatedText('race_event_player_tyre_struggle', { pilotName: entry.pilotName, tyreLabel: currentTyreLabel, weatherLabel }, '<strong>{pilotName}</strong> struggles with {tyreLabel} in {weatherLabel}.')}` });
      }

      if (rt.wear > usefulLife * 0.88 && rt.wear < (usefulLife * 0.88) + 1.4 && !entry.retired) {
        events.push({ lap, type: 'incident', text: `⚠️ ${formatTranslatedText('race_event_player_tyre_drop', { pilotName: entry.pilotName }, 'Tyre performance dropping for <strong>{pilotName}</strong>.')}` });
      }
    });

    updateRunningOrder();

    const leaderTime = positions.filter((entry) => !entry.retired).reduce((best, entry) => Math.min(best, entry.timeMs), Number.POSITIVE_INFINITY);
    lapSnapshots.push({
      lap,
      weather: liveWeather,
      order: positions
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          pilotName: entry.pilotName,
          isPlayer: entry.isPlayer,
          pos: entry.pos,
          tyre: entry.tyre,
          pit: !!entry.pit,
          pitStopsDone: entry.pitStopsDone || 0,
          pitLossMs: entry.lastPitLossMs || 0,
          color: entry.color,
          retired: entry.retired,
          gapMs: entry.retired || !Number.isFinite(leaderTime) ? null : Math.max(0, entry.timeMs - leaderTime)
        }))
        .sort((a, b) => a.pos - b.pos)
    });
  }

  // Final sort and position
  const activePositions = positions.filter(p => !p.retired).sort((a, b) => a.pos - b.pos);
  const retiredPositions = positions.filter(p => p.retired);
  const finalGrid = [...activePositions, ...retiredPositions];
  const playerCars = positions
    .filter((p) => p.isPlayer)
    .map((entry) => {
      const start = playerStarts.find((x) => x.carId === entry.id)?.startPos || 20;
      const finalPos = finalGrid.findIndex((x) => x.id === entry.id) + 1;
      const dnf = !!entry.retired;
      const pts = dnf ? 0 : (D.POINTS_TABLE[finalPos - 1] || 0);
      return {
        id: entry.id,
        pilotId: entry.pilotId,
        pilotName: entry.pilotName,
        position: finalPos,
        isDNF: dnf,
        points: pts,
        startPos: start,
        improvement: finalPos - start,
        tyre: entry.tyre || 'medium',
        pitStopsDone: entry.pitStopsDone || 0,
        pitTimeMs: entry.pitTimeMs || 0,
        strategy: entry.strategy || leadDriver.strategy,
        crashReport: crashReportsByCarId[entry.id] || null
      };
    })
    .sort((a, b) => a.position - b.position);

  const leadResult = playerCars[0] || { position: finalGrid.length, isDNF: true, points: 0, improvement: 0, pilotName: 'Driver' };
  const teamPoints = playerCars.reduce((sum, x) => sum + (x.points || 0), 0);

  playerCars.forEach((car) => {
    if (!car.isDNF) {
      events.push({
        lap: totalLaps,
        type: car.position <= 3 ? 'good' : 'info',
        text: `🏁 ${formatTranslatedText('race_event_player_finish', {
          pilotName: car.pilotName,
          position: car.position,
          pointsText: car.points > 0 ? `${car.points} ${translateText('points', 'pts')}` : translateText('race_event_no_points', 'No points')
        }, '<strong>{pilotName}</strong> finishes P{position}. {pointsText}.')}`
      });
    }
  });

  // Prize money scales with division: lower number = higher tier = bigger prize
  const _divForPrize = Number(S.getState()?.season?.division) || 8;
  const _PRIZE_MULT = {1:1.00, 2:0.84, 3:0.67, 4:0.50, 5:0.35, 6:0.22, 7:0.14, 8:0.08};
  const _pMult = _PRIZE_MULT[_divForPrize] || 0.08;
  const prizeBase = [50000,40000,35000,25000,20000,15000,12000,10000,8000,5000,3000,2000,1500,1000,500,300];
  const prizeMap = prizeBase.map(v => Math.round(v * _pMult / 100) * 100);
  const prizeMoney = playerCars.reduce((sum, car) => sum + (prizeMap[car.position - 1] || Math.max(100, Math.round(200 * _pMult / 100) * 100)), 0);

  return {
    round,
    position: leadResult.position,
    isDNF: leadResult.isDNF,
    points: teamPoints,
    events,
    lapSnapshots,
    finalGrid,
    gridStart,
    playerCars,
    weather: liveWeather,
    circuit: circuits,
    circuitProfile: profile,
    staffImpact: staffFx,
    forecastUsed: forecast,
    totalLaps,
    prizeMoney,
    fastestLap: !leadResult.isDNF && leadResult.position <= 5 && Math.random() < 0.2,
    improvement: leadResult.improvement,
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
  const division = Number(state?.season?.division) || 8;
  const teamSlots = Math.max(2, Number(getDivisionConfigSafe(division)?.teams) || 10);
  const divisionTeams = [
    { id: 'player', state },
    ...((window.GL_DATA && window.GL_DATA.AI_TEAMS)
      ? window.GL_DATA.AI_TEAMS.slice(0, Math.max(1, teamSlots - 1)).map(t => ({ id: t.id, state: generateAITeamState(t, state) }))
      : [])
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

  // Random events disabled for now.

  return playerEconomy;
}

// ---- Sponsor demand evaluation (called after each race) ----
function evaluateSponsorDemands(raceResult) {
  const state = S.getState();
  if (!state || !Array.isArray(state.sponsors)) return;

  const playerCars = Array.isArray(raceResult?.playerCars) ? raceResult.playerCars : [];
  const positions = playerCars.map(c => Number(c.position || 99));
  const bestPos = positions.length ? Math.min(...positions) : 99;
  const allFinished = playerCars.every(c => !c.isDNF);
  const lastBestPos = Number(state.lastRaceBestPos || 99);

  state.sponsors.forEach(sp => {
    if (sp.expired) return;
    let met = false;
    switch (sp.demandKey) {
      case 'top15':  met = bestPos <= 15; break;
      case 'top12':  met = bestPos <= 12; break;
      case 'top10':  met = bestPos <= 10; break;
      case 'top8':   met = bestPos <= 8; break;
      case 'top5':   met = bestPos <= 5; break;
      case 'podium': met = bestPos <= 3; break;
      case 'win':    met = bestPos === 1; break;
      case 'no_dnf': met = allFinished; break;
      default:       met = true;
    }
    const maxFailures = sp.demandMaxFailures || 2;
    if (met) {
      sp.demandFailures = 0;
      if (sp.demandBonus > 0) {
        S.addCredits(sp.demandBonus);
        S.addLog(`💼 ${sp.name}: objetivo cumplido — +${GL_UI.fmtCR(sp.demandBonus)} CR`, 'good');
      }
    } else {
      sp.demandFailures = (sp.demandFailures || 0) + 1;
      if (sp.demandFailures >= maxFailures) {
        sp.expired = true;
        S.addLog(`💼 ${sp.name} canceló el contrato por incumplimiento de objetivos.`, 'bad');
      } else {
        S.addLog(`⚠️ ${sp.name}: objetivo no cumplido (advertencia ${sp.demandFailures}/${maxFailures}).`, 'warning');
      }
    }
  });

  state.lastRaceBestPos = bestPos;
}

function applyRaceWeekendEconomy(raceResult) {
  const state = S.getState();
  const prizeMoney = Number.isFinite(raceResult?.prizeMoney)
    ? Number(raceResult.prizeMoney)
    : Number(raceResult?.prizeMoney || 0);
  const creditsBefore = Number(state?.finances?.credits || 0);

  if (prizeMoney !== 0) {
    S.addCredits(prizeMoney);
  }

  evaluateSponsorDemands(raceResult);

  const creditsAfterPrize = Number(S.getState()?.finances?.credits || 0);
  const weeklyEconomy = weeklyTick() || { net: 0, income: 0, expenses: 0, effects: {} };
  const creditsAfterWeekly = Number(S.getState()?.finances?.credits || 0);
  const summary = {
    creditsBefore,
    creditsAfterPrize,
    creditsAfterWeekly,
    prizeDelta: creditsAfterPrize - creditsBefore,
    weeklyNetDelta: creditsAfterWeekly - creditsAfterPrize,
    totalDelta: creditsAfterWeekly - creditsBefore,
    weeklyEconomy
  };

  const prizeIncome = Number(summary.prizeDelta || 0);
  if (summary.weeklyEconomy && typeof summary.weeklyEconomy === 'object') {
    const baseIncome = Number(summary.weeklyEconomy.income || 0);
    const expenses = Number(summary.weeklyEconomy.expenses || 0);
    summary.weeklyEconomy.prizeIncome = prizeIncome;
    summary.weeklyEconomy.operatingIncome = baseIncome;
    summary.weeklyEconomy.income = baseIncome + prizeIncome;
    summary.weeklyEconomy.net = summary.weeklyEconomy.income - expenses;
  }

  const refreshedState = S.getState();
  if (refreshedState?.finances) {
    const history = Array.isArray(refreshedState.finances.history) ? refreshedState.finances.history : [];
    const latestEntry = history.length ? history[history.length - 1] : null;
    if (latestEntry) {
      const operatingIncome = Number(latestEntry.operatingIncome ?? latestEntry.income ?? 0);
      const expenses = Number(latestEntry.expenses || 0);
      latestEntry.operatingIncome = operatingIncome;
      latestEntry.prizeIncome = prizeIncome;
      latestEntry.income = operatingIncome + prizeIncome;
      latestEntry.net = latestEntry.income - expenses;
    }

    // Division-aware fan gain: higher division = more fans per race (bigger audience)
    const _fanDiv = Number(refreshedState?.season?.division) || 8;
    const _FAN_BASE = {1:1200, 2:800, 3:500, 4:320, 5:200, 6:130, 7:80, 8:50};
    const _FAN_PER_PT = {1:110, 2:84, 3:62, 4:45, 5:32, 6:22, 7:15, 8:10};
    const _fanPts = Number(raceResult?.points || 0);
    const _fanCars = Array.isArray(raceResult?.playerCars) ? raceResult.playerCars.filter(c => !c.isDNF) : [];
    const _fanBestPos = _fanCars.length
      ? _fanCars.reduce((min, c) => Math.min(min, Number(c.position) || 99), 99)
      : (Number(raceResult?.position) || 20);
    const _podiumMult = _fanBestPos === 1 ? 2.2 : _fanBestPos === 2 ? 1.6 : _fanBestPos === 3 ? 1.3 : 1.0;
    const fansGained = Math.round(((_FAN_BASE[_fanDiv] || 50) + _fanPts * (_FAN_PER_PT[_fanDiv] || 10)) * _podiumMult);
    if (refreshedState.team) {
      refreshedState.team.fans = (refreshedState.team.fans || 0) + fansGained;
    }
    summary.fansGained = fansGained;

    refreshedState.finances.lastRaceSettlement = {
      ts: Date.now(),
      week: Array.isArray(refreshedState.finances.history) && refreshedState.finances.history.length
        ? refreshedState.finances.history[refreshedState.finances.history.length - 1].week
        : (refreshedState?.season?.week || 1) - 1,
      round: raceResult?.round || refreshedState?.season?.raceIndex || 0,
      prizeMoney,
      fansGained,
      creditsBefore,
      creditsAfterPrize,
      creditsAfterWeekly,
      weeklyNetDelta: summary.weeklyNetDelta,
      totalDelta: summary.totalDelta,
      playerCars: Array.isArray(raceResult?.playerCars)
        ? raceResult.playerCars.map((car) => ({ pilotName: car.pilotName, position: car.position, points: car.points }))
        : []
    };
  }

  if (raceResult && typeof raceResult === 'object') {
    raceResult.economySummary = summary;
  }

  S.saveState();
  return summary;
}

function getDivisionTransition(state, finalPosition) {
  const bounds = getDivisionBoundsFromData();
  const currentDivisionRaw = Number(state?.season?.division);
  const currentDivision = Number.isFinite(currentDivisionRaw)
    ? Math.max(bounds.minDivision, Math.min(bounds.maxDivision, Math.round(currentDivisionRaw)))
    : bounds.maxDivision;
  const config = getDivisionConfigSafe(currentDivision);
  const teams = Number(config?.teams) || 10;
  const promotions = Number(config?.promotions) || 2;
  const relegations = Number(config?.relegations) || 2;
  const relegationStart = Math.max(1, (teams - relegations) + 1);

  if (finalPosition <= promotions && currentDivision > bounds.minDivision) {
    return { result: 'promoted', nextDivision: currentDivision - 1 };
  }
  if (finalPosition >= relegationStart && currentDivision < bounds.maxDivision) {
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
  const financeOverview = getFinanceOverview(state);

  if (objective.id === 'phase1_survive_prove') {
    completed = (finishPos <= 3) && !financeOverview.isCritical;
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
  const finalPodiums = Number(myStanding.podiums) || 0;
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
    podiums: finalPodiums,
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
    if (S.addNotification) {
      const buildingLabel = bNames[c.buildingId] || c.buildingId;
      S.addNotification({
        text: formatTranslatedText('topbar_notif_building_complete', {
          building: buildingLabel,
          level: c.targetLevel
        }, 'Construction finished: {building} (Lv {level}).'),
        type: 'good'
      });
    }
    
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
  const teamSlots = Math.max(2, Number(getDivisionConfigSafe(division)?.teams) || 10);
  const teams = getVisualAiTeams().slice(0, Math.max(1, teamSlots - 1));
  const standings = teams.map((t, i) => ({
    id: t.id, name: t.name, color: t.color, flag: t.flag,
    points: 0, wins: 0, position: i + 2, bestResult: 0
  }));
  standings.unshift({
    id: 'player', name: S.getState().team.name || 'Your Team',
    color: S.getState().team.colors.primary, flag: '',
    points: 0, wins: 0, podiums: 0, position: 1, bestResult: 0
  });
  return standings;
}

// ---- update standings after race ----
function updateStandings(raceResult) {
  const state = S.getState();
  if (!Array.isArray(state.standings) || state.standings.length === 0) {
    state.standings = buildInitialStandings((state.season && state.season.division) || 8);
  }
  let standings = state.standings;
  const visualTeams = Object.fromEntries(getVisualAiTeams().map((team) => [team.id, team]));
  standings.forEach((entry) => {
    if (entry.id === 'player') {
      entry.color = state.team.colors.primary;
      return;
    }
    const visualTeam = visualTeams[entry.id];
    if (visualTeam) {
      entry.color = visualTeam.color;
      entry.flag = visualTeam.flag;
      entry.name = visualTeam.name;
    }
  });
  const { position, points, finalGrid, playerCars } = raceResult;
  const earnedPoints = Number.isFinite(points) ? points : 0;
  const bestPlayerPos = Array.isArray(playerCars) && playerCars.length
    ? playerCars.reduce((best, c) => Math.min(best, c && Number.isFinite(c.position) ? c.position : 99), 99)
    : (Number.isFinite(position) ? position : 99);

  // Update player
  const playerEntry = standings.find(s => s.id === 'player');
  if (playerEntry) {
    playerEntry.points += earnedPoints;
    const hasWin = Array.isArray(playerCars)
      ? playerCars.some((c) => c && c.position === 1)
      : position === 1;
    const hasPodium = Array.isArray(playerCars)
      ? playerCars.some((c) => c && c.position >= 1 && c.position <= 3)
      : (position >= 1 && position <= 3);
    if (hasWin) playerEntry.wins++;
    if (hasPodium) playerEntry.podiums = (playerEntry.podiums || 0) + 1;
    if (!playerEntry.bestResult || bestPlayerPos < playerEntry.bestResult) playerEntry.bestResult = bestPlayerPos;
  }

  // Update AI
  const aiWinners = new Set();
  (Array.isArray(finalGrid) ? finalGrid : []).forEach((car, idx) => {
    if (!car.isPlayer) {
      const teamId = car.teamId || car.id;
      const entry = standings.find(s => s.id === teamId);
      if (entry) {
        const aiPts = D.POINTS_TABLE[idx] || 0;
        entry.points += aiPts;
        if (idx === 0 && !aiWinners.has(teamId)) {
          entry.wins++;
          aiWinners.add(teamId);
        }
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

  // Only races (Sundays at 18:00), no practice events
  if (currentDay === 0 && currentHours < 18) {
    daysToAdd = 0; type = 'race'; // Today is race day
  } else {
    daysToAdd = (7 - currentDay) % 7 || 7; // Next Sunday
    type = 'race';
  }

  nextEvent.setDate(now.getDate() + daysToAdd);
  return { date: nextEvent, type };
}

function ensureNextRaceAvailable() {
  const state = S.getState();
  if (!state || !state.season || !Array.isArray(state.season.calendar)) return null;
  const cal = state.season.calendar;
  const RACE_STATUS_ENUM = (typeof window !== 'undefined' && window.RACE_STATUS)
    ? window.RACE_STATUS
    : { UPCOMING: 'upcoming', NEXT: 'next', COMPLETED: 'completed' };
  let changed = false;

  const getSeasonWetRaceTarget = (raceCount) => {
    if (raceCount <= 8) return 2;
    return clamp(Math.round(raceCount * 0.3), 3, 4);
  };

  const resetForecastForRace = (race, isWetRace) => {
    const circuitWetness = clamp(100 - (race?.circuit?.weather || 70), 5, 60);
    const base = isWetRace
      ? clamp(50 + (circuitWetness * 0.35), 48, 78)
      : clamp(14 + (circuitWetness * 0.2), 8, 36);
    race.forecast = {
      confidence: Math.max(55, Number(race?.forecast?.confidence) || 60),
      windows: [
        { label: 'start', wetProb: base },
        { label: 'mid', wetProb: clamp(base + (isWetRace ? 6 : 4), 5, 95) },
        { label: 'end', wetProb: clamp(base + (isWetRace ? 2 : 0), 5, 95) }
      ],
      lastUpdateBucket: null
    };
  };

  const rebalanceSeasonWeather = () => {
    const totalRaces = cal.length;
    if (!totalRaces) return false;

    const completedWet = cal.filter((race) => race && race.status === 'completed' && race.weather === 'wet').length;
    const pendingRaces = cal.filter((race) => race && race.status !== 'completed');
    if (!pendingRaces.length) return false;

    const targetWetRaces = getSeasonWetRaceTarget(totalRaces);
    const pendingWetTarget = clamp(targetWetRaces - completedWet, 0, pendingRaces.length);
    const wetRaceKeys = new Set(
      pendingRaces
        .map((race, index) => ({
          key: `${race.round || index}_${race.circuit?.id || index}`,
          weight: clamp(100 - (race.circuit?.weather || 70), 5, 60) + ((pendingRaces.length - index) * 0.01)
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, pendingWetTarget)
        .map((entry) => entry.key)
    );

    let weatherChanged = false;
    pendingRaces.forEach((race, index) => {
      const key = `${race.round || index}_${race.circuit?.id || index}`;
      const nextWeather = wetRaceKeys.has(key) ? 'wet' : 'dry';
      if (race.weather !== nextWeather) {
        race.weather = nextWeather;
        resetForecastForRace(race, nextWeather === 'wet');
        weatherChanged = true;
      }
    });
    return weatherChanged;
  };

  cal.forEach((r) => {
    if (!r || !r.status) return;
    if (r.status === 'done' || r.status === 'finished' || r.status === 'completed') {
      r.status = RACE_STATUS_ENUM.COMPLETED;
      changed = true;
      return;
    }
    if (r.status === 'next') {
      r.status = RACE_STATUS_ENUM.NEXT;
      changed = true;
      return;
    }
    if (r.status === 'pending' || r.status === 'upcoming') {
      r.status = RACE_STATUS_ENUM.UPCOMING;
      changed = true;
    }
  });

  if (rebalanceSeasonWeather()) {
    changed = true;
  }

  let next = cal.find((r) => r && r.status === RACE_STATUS_ENUM.NEXT);
  if (next) {
    if (changed) S.saveState();
    return next;
  }

  const upcoming = cal.find((r) => r && r.status === RACE_STATUS_ENUM.UPCOMING);
  if (upcoming) {
    upcoming.status = RACE_STATUS_ENUM.NEXT;
    changed = true;
    S.saveState();
    return upcoming;
  }

  // Savegames can get stuck with all races completed but season not rolled over.
  const completedCount = cal.filter((r) => r && r.status === RACE_STATUS_ENUM.COMPLETED).length;
  const totalRaces = Number(state?.season?.totalRaces) || cal.length;
  const needsSeasonRollover = state.season.phase === 'season' && cal.length > 0 && completedCount >= totalRaces;
  const weekOutOfRange = Number(state.season.week) > totalRaces;
  if (needsSeasonRollover || weekOutOfRange) {
    endSeason();
    const refreshed = S.getState();
    const refreshedCal = Array.isArray(refreshed?.season?.calendar) ? refreshed.season.calendar : [];
    return refreshedCal.find((r) => r && r.status === RACE_STATUS_ENUM.NEXT) || null;
  }

  return null;
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
  if (isLikelyWet) tyre = confidence >= 75 && wetAvg >= 80 ? 'wet' : 'intermediate';

  const setup = {
    aeroBalance: (circuit.layout === 'technical') ? 65 : ((circuit.layout === 'high-speed' || circuit.layout === 'power') ? 38 : 50),
    wetBias: isLikelyWet ? 72 : (isLikelyDry ? 35 : 52)
  };

  const pitPlan = (isLikelyWet || tyre === 'soft' || (circuit.layout === 'endurance' && !isLikelyDry)) ? 'double' : 'single';
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
      { lapPct: 30, engineMode: isLikelyWet ? 'normal' : 'push', pitBias: 'none' },
      { lapPct: 70, engineMode: isLikelyWet ? 'eco' : 'push', pitBias: 'none' }
    ]
  };

  // Advisor A/B mode adjustments
  if (advisorMode === 'conservative') {
    strategy.aggression = clamp(strategy.aggression - 10, 25, 70);
    strategy.riskLevel = clamp(strategy.riskLevel - 10, 18, 60);
    strategy.engineMode = strategy.engineMode === 'push' ? 'normal' : strategy.engineMode;
    strategy.pitPlan = 'single';
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


  // Cold start guardrails when advisor confidence is low
  let guardrailsApplied = false;
  const safeAlternative = {
    ...strategy,
    tyre: isLikelyWet ? 'intermediate' : 'medium',
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
    strategy.pitPlan = 'single';
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
    tyreSuccess: { soft: 0, medium: 0, hard: 0, intermediate: 0, wet: 0 },
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

// Practices removed from MVP — stub kept for state compatibility
function recordPracticeOutcome() {}

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

function shiftTimeToMs(targetMs) {
  const state = S.getState();
  if (!state) return { simulatedRaces: 0, simulatedPractices: 0, weeklyTicks: 0, totalSimulated: 0 };
  if (!state.meta) state.meta = { version: 1, created: null, saveTime: null, timeOffsetMs: 0 };

  const safeTargetMs = Number(targetMs);
  if (!Number.isFinite(safeTargetMs)) {
    return { simulatedRaces: 0, simulatedPractices: 0, weeklyTicks: 0, totalSimulated: 0 };
  }

  const currentVirtualMs = getNowMs();
  const deltaMs = safeTargetMs - currentVirtualMs;
  state.meta.timeOffsetMs = (state.meta.timeOffsetMs || 0) + deltaMs;
  if (!state.meta.saveTime || safeTargetMs < state.meta.saveTime) {
    state.meta.saveTime = safeTargetMs;
  }
  S.saveState();

  if (deltaMs > 0) {
    return catchUpOffline();
  }
  return { simulatedRaces: 0, simulatedPractices: 0, weeklyTicks: 0, totalSimulated: 0 };
}

// ---- offline progression catchup ----
function catchUpOffline() {
  const state = S.getState();
  if (!state || !state.meta || !state.meta.saveTime) return 0;

  const now = getNowMs();
  const offlineMs = now - state.meta.saveTime;
  const fromMs = state.meta.saveTime;
  const toMs = now;

  const offlineHours = Math.floor(offlineMs / (60 * 60 * 1000));

  const formatAuditDateTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const listScheduleCrossings = (startMs, endMs, dayOfWeek, hour) => {
    const start = new Date(startMs + 1);
    const end = new Date(endMs);
    if (start > end) return [];

    const cursor = new Date(start);
    cursor.setSeconds(0, 0);
    const dayShift = (dayOfWeek - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + dayShift);
    cursor.setHours(hour, 0, 0, 0);
    if (cursor < start) cursor.setDate(cursor.getDate() + 7);

    const timestamps = [];
    while (cursor <= end) {
      timestamps.push(cursor.getTime());
      cursor.setDate(cursor.getDate() + 7);
    }
    return timestamps;
  };

  const raceDates = listScheduleCrossings(fromMs, toMs, 0, 18); // Sun 18:00
  const raceCrossings = raceDates.length;

  // Skip if no time has passed AND no race was crossed
  // (allows active players to trigger a race when the countdown hits zero).
  if (offlineMs < (60 * 60 * 1000) && raceCrossings === 0) {
    state.meta.saveTime = now;
    S.saveState();
    return 0;
  }
  const weeklyTicksTarget = Math.min(52, Math.floor(offlineMs / (7 * DAY_MS)));

  let simulatedRaces = 0;
  let totalPoints = 0;
  let totalCredits = 0;
  let weeklyTicksApplied = 0;
  const logs = [];

  // Apply passive progression that should always happen while away.
  updateConstructionQueue();

  // Minimal short-offline progression.
  if (offlineHours >= 4 && raceCrossings === 0) {
    const passiveIncome = Math.floor(((state.team?.fans || 0) * 0.01));
    if (passiveIncome > 0) {
      S.addCredits(passiveIncome);
      totalCredits += passiveIncome;
      logs.push(`⏱️ Progresión pasiva: +${GL_UI.fmtCR(passiveIncome)} CR`);
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


  while (simulatedRaces < raceCrossings) {
    const nextRaceObj = resolveNextRace();
    if (!nextRaceObj) break;

    const raceTs = raceDates[simulatedRaces];
    logs.push(`⏱️ Preparando ronda ${nextRaceObj.round}.`);

    const simResult = simulateRace({
      weather: nextRaceObj.weather || 'dry',
      round: nextRaceObj.round,
      circuits: nextRaceObj.circuit,
      forecast: nextRaceObj.forecast || null
    });
    updateStandings(simResult);
    simResult.performanceReport = buildRacePerformanceReport(simResult, state);
    const archiveRecord = buildRaceArchiveRecord(simResult, { round: nextRaceObj.round, ts: raceTs || Date.now(), weather: nextRaceObj.weather || simResult.weather }, state);
    nextRaceObj.status = 'completed';
    nextRaceObj.result = archiveRecord;
    upsertRaceArchiveRecord(state, archiveRecord);

    const cal = state.season.calendar || [];
    const newNext = cal.find((r) => r && (r.status === 'upcoming' || r.status === 'pending'));
    if (newNext) newNext.status = 'next';

    evaluateSponsorDemands(simResult);
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

    logs.push(`🏁 Ronda ${nextRaceObj.round}: P${simResult.position} (+${simResult.points} pts, +${GL_UI.fmtCR(simResult.prizeMoney || 0)} CR)`);
  }

  while (weeklyTicksApplied < weeklyTicksTarget) {
    weeklyTick();
    weeklyTicksApplied += 1;
  }

  ensureNextRaceAvailable();

  if (simulatedRaces > 0 || logs.length) {
    S.saveState();
    setTimeout(() => {
      GL_UI.openModal({
        title: __('offline_catchup_title') || 'While You Were Away...',
        content: `
          <p style="color:var(--t-secondary);margin-bottom:16px">${__('offline_catchup_desc') || 'Your team continued to compete in scheduled races:'}</p>
          <div style="font-size:0.8rem;color:var(--t-secondary);margin-bottom:10px">
            ${simulatedRaces > 0 ? `<strong>${simulatedRaces}</strong> carrera${simulatedRaces !== 1 ? 's' : ''} simulada${simulatedRaces !== 1 ? 's' : ''} · ` : ''}Puntos: <strong>${totalPoints}</strong> · Créditos: <strong>+${GL_UI.fmtCR(totalCredits)}</strong>
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

  return {
    simulatedRaces,
    weeklyTicks: weeklyTicksApplied
  };
}

// ---- train pilot (once a day) ----
function trainPilot(pid) {
  const state = S.getState();
  const p = state.pilots.find(x => x.id === pid);
  if (!p) return;
  
  const now = getNowDate();
  const lastDate = p.lastTrained ? new Date(p.lastTrained) : new Date(0);
  if (lastDate.toDateString() === now.toDateString()) {
    GL_UI.toast(window.__('pilots_trained_today', 'Trained Today'), 'warning');
    return;
  }
  
  // Apply training points (randomly increase 1 stat by 1-2 points)
  const attrs = Object.keys(p.attrs);
  const targetAttr = attrs[Math.floor(Math.random() * attrs.length)];
  const gain = Math.floor(Math.random() * 2) + 1;
  p.attrs[targetAttr] = Math.min(99, p.attrs[targetAttr] + gain);
  
  p.lastTrained = now.getTime();
  S.saveState();

  GL_UI.toast(`🏋️ ${formatTranslatedText('training_gain_toast', {
    pilotName: p.name,
    gain,
    attrLabel: translateText(`attr_${targetAttr}`, targetAttr)
  }, '{pilotName}: +{gain} {attrLabel}!')}`, 'good');
  if (window.GL_SCREENS && document.getElementById('screen-pilots').classList.contains('active')) {
    window.GL_SCREENS.renderPilots();
  }
}

window.GL_ENGINE = {
  pilotScore, carScore, buildRaceGrid, simulateRace,
  choosePitTyreForConditions,
  getTyreUsefulLife, getTyrePaceDeltaMs, getCircuitRaceDistanceKm,
  buildRacePerformanceReport, buildRaceAdminReport, buildRaceArchiveRecord, upsertRaceArchiveRecord,
  getFinanceOverview,
  weeklyTick, applyRaceWeekendEconomy, evaluateSponsorDemands, updateConstructionQueue, startHqUpgrade,
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
  shiftTimeToMs,
  ensureNextRaceAvailable,
  generateRandomEvent, applyEventChoice,
  buildInitialStandings, updateStandings, getNextRaceDate, catchUpOffline, trainPilot,
  endSeason
};

