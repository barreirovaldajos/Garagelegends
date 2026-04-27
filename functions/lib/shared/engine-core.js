// ===== ENGINE-CORE.JS – Isomorphic race simulation (browser + Node) =====
// Pure functions only — no window, document, localStorage, or global state access.
// All randomness uses SeededRNG for deterministic, reproducible results.
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.GL_ENGINE_CORE = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // =====================================================================
  //  UTILITIES
  // =====================================================================

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // =====================================================================
  //  SEEDED RNG — deterministic, counter-based
  // =====================================================================

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

  class SeededRNG {
    constructor(seed) {
      this.baseSeed = String(seed || 'default');
      this.state = hashSeed(this.baseSeed);
      this.counter = 0;
    }

    next() {
      this.counter++;
      return seededUnit(`${this.state}_${this.counter}`);
    }

    range(min, max) {
      return min + (max - min) * this.next();
    }

    intRange(min, max) {
      return Math.floor(this.range(min, max + 1));
    }

    chance(probability) {
      return this.next() < probability;
    }

    // Seeded shuffle (Fisher-Yates)
    shuffle(arr) {
      const result = arr.slice();
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const tmp = result[i];
        result[i] = result[j];
        result[j] = tmp;
      }
      return result;
    }
  }

  // =====================================================================
  //  TRANSLATION STUB — falls back to key when no i18n runtime present
  // =====================================================================

  function translateText(key, fallback) {
    if (typeof root !== 'undefined' && typeof root.__ === 'function') {
      const resolved = root.__(key);
      return resolved && resolved !== key ? resolved : (fallback || key);
    }
    return fallback || key;
  }

  function formatTranslatedText(key, replacements, fallback) {
    const template = translateText(key, fallback);
    return String(template).replace(/\{(\w+)\}/g, function (_, token) {
      const value = replacements[token];
      return value == null ? '' : String(value);
    });
  }

  // =====================================================================
  //  CIRCUIT PROFILE
  // =====================================================================

  function getCircuitProfile(circuit, weather) {
    const layout = (circuit && circuit.layout) || 'mixed';
    const byLayout = {
      'high-speed': { paceBias: 1.05, overtakeBias: 1.08, tyreDegMult: 0.95, riskBias: 1.08 },
      power: { paceBias: 1.06, overtakeBias: 1.04, tyreDegMult: 1.0, riskBias: 1.05 },
      technical: { paceBias: 0.98, overtakeBias: 0.9, tyreDegMult: 1.08, riskBias: 1.0 },
      mixed: { paceBias: 1.0, overtakeBias: 1.0, tyreDegMult: 1.0, riskBias: 1.0 },
      endurance: { paceBias: 0.96, overtakeBias: 0.92, tyreDegMult: 1.12, riskBias: 0.95 }
    };
    var p = byLayout[layout] || byLayout.mixed;
    var wetMod = weather === 'wet'
      ? { paceBias: 0.95, overtakeBias: 0.9, tyreDegMult: 1.1, riskBias: 1.2 }
      : { paceBias: 1.0, overtakeBias: 1.0, tyreDegMult: 1.0, riskBias: 1.0 };
    return {
      layout: layout,
      paceBias: p.paceBias * wetMod.paceBias,
      overtakeBias: p.overtakeBias * wetMod.overtakeBias,
      tyreDegMult: p.tyreDegMult * wetMod.tyreDegMult,
      riskBias: p.riskBias * wetMod.riskBias
    };
  }

  // =====================================================================
  //  SETUP EFFECTS
  // =====================================================================

  function getSetupEffects(circuit, weather, setup) {
    setup = setup || {};
    var layout = (circuit && circuit.layout) || 'mixed';
    var aeroBalance = typeof setup.aeroBalance === 'number' ? setup.aeroBalance : 50;
    var wetBias = typeof setup.wetBias === 'number' ? setup.wetBias : 50;

    var layoutFit = 0;
    if (layout === 'high-speed' || layout === 'power') {
      layoutFit = (50 - aeroBalance) / 140;
    } else if (layout === 'technical') {
      layoutFit = (aeroBalance - 50) / 140;
    } else {
      layoutFit = (Math.abs(aeroBalance - 50) * -1) / 220;
    }

    var weatherFit = weather === 'wet'
      ? (wetBias - 50) / 120
      : (50 - wetBias) / 120;

    return {
      paceMult: clamp(1 + ((layoutFit + weatherFit) * 0.4), 0.92, 1.08),
      riskMult: 1 - (weather === 'wet' ? (wetBias - 50) / 220 : (50 - wetBias) / 280),
      tyreMult: 1 + (Math.abs(aeroBalance - 50) / 260)
    };
  }

  // =====================================================================
  //  PILOT SCORING
  // =====================================================================

  function pilotScore(pilot) {
    if (!pilot) return 40;
    var a = pilot.attrs;
    if (!a) return 40;
    return Math.round((a.pace + a.racePace + a.consistency + a.rain + a.tyre + a.aggression + a.overtake + a.techFB + a.mental + a.charisma) / 10);
  }

  function carScoreFromComponents(components) {
    if (!components) return 50;
    var keys = Object.keys(components);
    if (!keys.length) return 50;
    return Math.round(keys.reduce(function (sum, k) { return sum + (components[k].score || 0); }, 0) / keys.length);
  }

  function getPilotAttr(pilot, key, fallback) {
    if (fallback === undefined) fallback = 55;
    var value = pilot && pilot.attrs ? pilot.attrs[key] : null;
    return Number.isFinite(value) ? value : fallback;
  }

  function getPilotGridStrength(pilot, weather) {
    var overall = pilotScore(pilot);
    var pace = getPilotAttr(pilot, 'pace', overall);
    var racePace = getPilotAttr(pilot, 'racePace', overall);
    var consistency = getPilotAttr(pilot, 'consistency', 60);
    var techFeedback = getPilotAttr(pilot, 'techFB', 60);
    var mental = getPilotAttr(pilot, 'mental', 60);
    var rainSkill = getPilotAttr(pilot, 'rain', 60);

    var strength = (overall * 0.26)
      + (pace * 0.32)
      + (racePace * 0.18)
      + (consistency * 0.12)
      + (techFeedback * 0.07)
      + (mental * 0.05);

    if (weather === 'wet') strength += (rainSkill - 60) * 0.18;
    return clamp(strength, 40, 96);
  }

  function getPilotRaceStrength(pilot, weather, strategy) {
    strategy = strategy || {};
    var overall = pilotScore(pilot);
    var racePace = getPilotAttr(pilot, 'racePace', overall);
    var consistency = getPilotAttr(pilot, 'consistency', 60);
    var tyreSkill = getPilotAttr(pilot, 'tyre', 60);
    var rainSkill = getPilotAttr(pilot, 'rain', 60);
    var aggressionAttr = getPilotAttr(pilot, 'aggression', 60);
    var overtake = getPilotAttr(pilot, 'overtake', 60);
    var strength = (overall * 0.42) + (racePace * 0.22) + (consistency * 0.16) + (tyreSkill * 0.1) + (overtake * 0.1);
    if (weather === 'wet') strength += (rainSkill - 60) * 0.28;
    strength += (((strategy.aggression || 50) - 50) * 0.06);
    strength += (((strategy.riskLevel || 40) - 40) * 0.03);
    strength += ((aggressionAttr - 60) * 0.04);
    return clamp(strength, 40, 96);
  }

  // =====================================================================
  //  STAFF EFFECTS
  // =====================================================================

  function getRaceStaffEffects(staff) {
    staff = Array.isArray(staff) ? staff : [];
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

    var pickByKey = function () {
      var keys = Array.prototype.slice.call(arguments);
      return staff.filter(function (s) {
        return keys.indexOf(s.roleKey) >= 0 || keys.some(function (k) { return (s.role || '').toLowerCase().indexOf(k.toLowerCase()) >= 0; });
      });
    };

    var raceEngineers = pickByKey('race_engineer', 'race engineer');
    var pitHeads = pickByKey('head_of_pits', 'head of pits');
    var chiefEngineers = pickByKey('chief_engineer', 'chief engineer');
    var analysts = pickByKey('data_analyst', 'data analyst');

    var avg = function (arr, key) {
      if (!arr.length) return 50;
      var sum = arr.reduce(function (s, x) { return s + (((x.attrs || {})[key]) || 50); }, 0);
      return sum / arr.length;
    };

    var pitSkill = avg([].concat(raceEngineers, pitHeads), 'pitStrategy');
    var setupSkill = avg([].concat(raceEngineers, analysts, chiefEngineers), 'setup');
    var techSkill = avg([].concat(chiefEngineers, analysts), 'technical');

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

  // =====================================================================
  //  TYRE SYSTEM
  // =====================================================================

  var TYRE_COMPOUNDS = {
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

  function getTyreTrackProfile(tyre, weather) {
    var compound = getTyreCompound(tyre);
    return weather === 'wet' ? compound.wet : compound.dry;
  }

  function getTyreUsefulLife(tyre, weather, totalLaps) {
    weather = weather || 'dry';
    totalLaps = totalLaps || 60;
    var profile = getTyreTrackProfile(tyre, weather);
    var durabilityPct = (profile.durabilityPct[0] + profile.durabilityPct[1]) / 2;
    return clamp(totalLaps * durabilityPct, 4, Math.max(6, totalLaps * 0.85));
  }

  function getTyreWearStep() {
    return 1;
  }

  function getTyrePaceDeltaMs(tyre, weather) {
    return getTyreTrackProfile(tyre, weather || 'dry').paceDeltaMs;
  }

  function getTyreWeatherPaceDelta(tyre, weather) {
    return clamp((-getTyrePaceDeltaMs(tyre, weather)) / 450, -12, 12);
  }

  function getDefaultRaceTyre(weather) {
    return weather === 'wet' ? 'intermediate' : 'medium';
  }

  // =====================================================================
  //  PIT STOP LOGIC
  // =====================================================================

  function getBasePitWindowPct(tyre, weather, pitPlan) {
    weather = weather || 'dry';
    pitPlan = pitPlan || 'single';
    if (weather === 'wet') {
      if (tyre === 'wet') return pitPlan === 'double' ? 26 : 32;
      return 52;
    }
    if (tyre === 'soft') return pitPlan === 'double' ? 22 : 25;
    if (tyre === 'hard') return pitPlan === 'double' ? 48 : 60;
    return pitPlan === 'double' ? 32 : 42;
  }

  function getDefaultPitTyres(strategy, weather) {
    strategy = strategy || {};
    weather = weather || 'dry';
    var preset = Array.isArray(strategy.pitTyres) ? strategy.pitTyres.filter(Boolean).slice(0, 2) : [];
    if (preset.length === 2) return preset;
    var startTyre = strategy.tyre || getDefaultRaceTyre(weather);
    if (weather === 'wet') {
      return [preset[0] || 'intermediate', preset[1] || 'intermediate'];
    }
    if (startTyre === 'soft') return [preset[0] || 'hard', preset[1] || 'medium'];
    if (startTyre === 'hard') return [preset[0] || 'medium', preset[1] || 'soft'];
    return [preset[0] || 'hard', preset[1] || 'medium'];
  }

  function getConfiguredPitTyre(strategy, stopIndex, weather) {
    var pitTyres = getDefaultPitTyres(strategy, weather);
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

  function getForecastWetAverage(forecast, fallbackWeather) {
    var windows = Array.isArray(forecast && forecast.windows) ? forecast.windows.filter(function (w) { return Number.isFinite(w && w.wetProb); }) : [];
    if (!windows.length) return fallbackWeather === 'wet' ? 75 : 25;
    return windows.reduce(function (sum, w) { return sum + w.wetProb; }, 0) / windows.length;
  }

  function choosePitTyreForConditions(entry, strategy, stopIndex, liveWeather, forecast, rng) {
    var requestedTyre = getConfiguredPitTyre(strategy, stopIndex, liveWeather);
    if (!entry || entry.isPlayer) return requestedTyre;

    var aiMeta = (entry.strategy && entry.strategy.aiMeta) || (strategy && strategy.aiMeta) || {};
    var decisionSkill = clamp(Number(aiMeta.decisionSkill) || 0.55, 0.35, 0.95);
    var rainSkill = clamp((Number(aiMeta.rainSkill) || 60) / 100, 0.35, 0.95);
    var tyreSkill = clamp((Number(aiMeta.tyreSkill) || 60) / 100, 0.35, 0.95);
    var confidence = clamp((Number(forecast && forecast.confidence) || 60) / 100, 0.35, 0.95);
    var wetExpectation = clamp(getForecastWetAverage(forecast, liveWeather) / 100, 0.05, 0.95);
    var adaptRoll = rng.next();
    var compoundRoll = rng.next();

    if (liveWeather === 'wet' && requestedTyre !== 'intermediate' && requestedTyre !== 'wet') {
      var adaptChance = clamp(0.08 + (decisionSkill * 0.28) + (rainSkill * 0.2) + (confidence * 0.08) + ((wetExpectation - 0.5) * 0.22), 0.12, 0.78);
      if (adaptRoll >= adaptChance) return requestedTyre;
      var fullWetChance = clamp(-0.06 + (rainSkill * 0.28) + ((wetExpectation - 0.72) * 0.95), 0.05, 0.42);
      return compoundRoll < fullWetChance ? 'wet' : 'intermediate';
    }

    if (liveWeather === 'dry' && (requestedTyre === 'intermediate' || requestedTyre === 'wet')) {
      var dryExpectation = 1 - wetExpectation;
      var adaptChanceDry = clamp(0.1 + (decisionSkill * 0.24) + (tyreSkill * 0.22) + (confidence * 0.1) + ((dryExpectation - 0.5) * 0.2), 0.14, 0.8);
      if (adaptRoll >= adaptChanceDry) return requestedTyre;
      return normalizeTyreForWeather(requestedTyre, 'dry');
    }

    return requestedTyre;
  }

  function normalizePitPlan(plan) {
    return plan === 'double' ? 'double' : 'single';
  }

  function getPrimaryStopLapPct(strategy, fallback) {
    strategy = strategy || {};
    if (fallback === undefined) fallback = 50;
    var interventions = Array.isArray(strategy.interventions) ? strategy.interventions : [];
    if (Number.isFinite(interventions[0] && interventions[0].lapPct)) return clamp(Math.round(interventions[0].lapPct), 10, 95);
    if (Number.isFinite(strategy.pitLap)) return clamp(Math.round(strategy.pitLap), 10, 95);
    return fallback;
  }

  function normalizeStrategyInterventions(strategy, fallbackPitLap) {
    strategy = strategy || {};
    if (fallbackPitLap === undefined) fallbackPitLap = 50;
    var interventions = Array.isArray(strategy.interventions) ? strategy.interventions : [];
    var firstLapPct = getPrimaryStopLapPct(strategy, fallbackPitLap);
    var secondFallback = Math.min(95, Math.max(firstLapPct + 20, 70));
    var secondLapPct = Number.isFinite(interventions[1] && interventions[1].lapPct)
      ? clamp(Math.round(interventions[1].lapPct), firstLapPct + 8, 95)
      : secondFallback;
    return [
      { lapPct: firstLapPct, pitBias: 'none' },
      { lapPct: secondLapPct, pitBias: 'none' }
    ];
  }

  function getConfiguredStopWindows(strategy, totalLaps) {
    var interventions = normalizeStrategyInterventions(strategy, getPrimaryStopLapPct(strategy, 50));
    var firstPctBase = interventions[0].lapPct;
    var secondPctBase = interventions[1].lapPct;
    var firstBaseLap = Math.floor(clamp(firstPctBase, 10, 95) / 100 * totalLaps) + 1;
    var secondBaseLap = Math.floor(clamp(secondPctBase, 10, 95) / 100 * totalLaps) + 1;
    var firstLap = firstBaseLap;
    var secondLap = Math.min(totalLaps - 2, Math.max(firstLap + 6, secondBaseLap));
    return { firstLap: firstLap, secondLap: secondLap };
  }

  function getEngineModeFx(mode) {
    var map = {
      eco: { pace: -0.05, risk: -0.15, tyre: -0.1 },
      normal: { pace: 0, risk: 0, tyre: 0 },
      push: { pace: 0.05, risk: 0.15, tyre: 0.12 }
    };
    return map[mode] || map.normal;
  }

  function getPitStopTimeMs(entry, weather, safetyCarActive, staffFx, rng) {
    weather = weather || 'dry';
    staffFx = staffFx || {};
    var aiPitSkill = entry && entry.strategy && entry.strategy.aiMeta
      ? entry.strategy.aiMeta.pitSkill
      : null;
    var crewEfficiency = entry && entry.isPlayer
      ? clamp((((staffFx.pitTimeGainChance || 0.45) - 0.25) / 0.53), 0, 1)
      : clamp((((aiPitSkill || 58) - 46) / 46), 0, 1);
    var errorMult = entry && entry.isPlayer
      ? (staffFx.pitErrorChanceMult || 1)
      : clamp(1.18 - ((aiPitSkill || 58) / 120), 0.72, 1.12);

    var laneMs = safetyCarActive ? 13200 : 18400;
    var weatherMs = weather === 'wet' ? 900 : 0;
    var serviceBaseMs = 5150 - (crewEfficiency * 1100);
    var serviceNoiseMs = Math.round((rng.next() - 0.5) * 700);
    var totalMs = laneMs + weatherMs + serviceBaseMs + serviceNoiseMs;

    var quickStopChance = entry && entry.isPlayer
      ? (staffFx.pitTimeGainChance || 0.45)
      : clamp(0.24 + (crewEfficiency * 0.45), 0.22, 0.72);
    if (rng.chance(quickStopChance)) totalMs -= 550;

    var baseErrorChance = safetyCarActive ? 0.03 : 0.06;
    if (rng.chance(baseErrorChance * errorMult)) {
      totalMs += 1600 + Math.round(rng.next() * 1400);
    }

    return clamp(Math.round(totalMs), safetyCarActive ? 11800 : 16800, safetyCarActive ? 22000 : 30000);
  }

  // =====================================================================
  //  AI DRIVER PROFILE BUILDER
  // =====================================================================

  function buildAiDriverProfile(team, carSlot, weather, circuit, profile, referenceCarScore, pilotPool) {
    var seedRoot = (team && team.id || 'ai') + '_' + carSlot + '_' + ((circuit && circuit.id) || profile.layout) + '_' + weather;
    var aiPilots = (pilotPool || []).filter(function (p) { return String(p.id || '').indexOf('ai') === 0; });
    var pilotSource = pickSeeded(aiPilots, seedRoot + '_pilot') || {
      id: (team && team.id || 'ai') + '_pilot_' + carSlot,
      name: 'AI Driver ' + carSlot,
      attrs: { pace: 64, racePace: 66, consistency: 68, rain: 62, tyre: 66, aggression: 64, overtake: 64, techFB: 62, mental: 66, charisma: 60 }
    };
    var pilot = cloneData(pilotSource);
    var driverRating = pilotScore(pilot);
    var pitSkill = Math.round(seededRange(seedRoot + '_pit', 46, 92));
    var setupSkill = Math.round(seededRange(seedRoot + '_setup', 44, 90));
    var decisionSkill = clamp(((driverRating * 0.62) + (pitSkill * 0.23) + (setupSkill * 0.15)) / 100, 0.45, 0.96);
    var aggressionAttr = getPilotAttr(pilot, 'aggression', 60);
    var consistency = getPilotAttr(pilot, 'consistency', 60);
    var tyreSkill = getPilotAttr(pilot, 'tyre', 60);
    var rainSkill = getPilotAttr(pilot, 'rain', 60);
    var prefersAggressive = aggressionAttr > 72 && seededUnit(seedRoot + '_style') > 0.42;
    var strategyId = weather === 'wet'
      ? (decisionSkill > 0.72 ? 'tactical' : 'balanced')
      : (prefersAggressive ? 'aggressive' : (decisionSkill > 0.76 ? 'tactical' : (consistency > 76 ? 'conservative' : 'balanced')));
    var engineMode = prefersAggressive ? 'push' : (consistency > 80 ? 'eco' : 'normal');
    var tyre = 'medium';
    if (weather === 'wet') {
      tyre = rainSkill > 84 && seededUnit(seedRoot + '_wet') > 0.82 ? 'wet' : 'intermediate';
    } else if (strategyId === 'aggressive') {
      tyre = tyreSkill > 72 && profile.tyreDegMult <= 1.02 && seededUnit(seedRoot + '_soft') > 0.46 ? 'soft' : 'medium';
    } else if (strategyId === 'conservative' || profile.tyreDegMult > 1.05) {
      tyre = tyreSkill > 68 || profile.tyreDegMult > 1.05 ? 'hard' : 'medium';
    } else {
      tyre = seededUnit(seedRoot + '_compound') > 0.72 ? 'hard' : 'medium';
    }
    var pitPlan;
    if (weather === 'wet') {
      pitPlan = (tyre === 'wet' || ((profile.tyreDegMult > 1.06 || tyreSkill < 64) && seededUnit(seedRoot + '_wet_double') > 0.58)) ? 'double' : 'single';
    } else if (tyre === 'soft') {
      pitPlan = 'double';
    } else if (tyre === 'hard') {
      var hardDbl = (profile.tyreDegMult > 1.05 ? 0.18 : 0.07) + (strategyId === 'aggressive' ? 0.07 : 0);
      pitPlan = seededUnit(seedRoot + '_hard_double') < hardDbl ? 'double' : 'single';
    } else {
      var baseDbl = profile.tyreDegMult > 1.06 ? 0.65
        : profile.tyreDegMult > 1.03 ? 0.50
        : 0.38;
      var dblChance = clamp(
        baseDbl
        + (strategyId === 'aggressive' ? 0.12 : 0)
        - (strategyId === 'conservative' ? 0.10 : 0)
        + (tyreSkill < 60 ? 0.08 : 0),
        0.15, 0.80
      );
      pitPlan = seededUnit(seedRoot + '_medium_double') < dblChance ? 'double' : 'single';
    }
    var setup = {
      aeroBalance: clamp(Math.round((profile.layout === 'technical' ? 68 : (profile.layout === 'high-speed' || profile.layout === 'power' ? 38 : 50)) + (setupSkill - 60) * 0.14 + seededRange(seedRoot + '_aero', -6, 6)), 20, 80),
      wetBias: clamp(Math.round((weather === 'wet' ? 72 : 42) + (rainSkill - 60) * 0.12 + seededRange(seedRoot + '_wet_bias', -8, 8)), 15, 85)
    };
    var basePitLap = getBasePitWindowPct(tyre, weather, pitPlan);
    var pitLap = clamp(Math.round(basePitLap + ((decisionSkill - 0.6) * 18) + seededRange(seedRoot + '_pitlap', -6, 6)), 18, 80);
    var riskLevel = clamp(Math.round((aggressionAttr * 0.6) + ((100 - consistency) * 0.16) + seededRange(seedRoot + '_risk', 2, 18)), 22, 84);
    var aggression = clamp(Math.round((aggressionAttr * 0.72) + (driverRating * 0.12) + seededRange(seedRoot + '_aggression', -6, 6)), 28, 90);
    var pitTyres = getDefaultPitTyres({ tyre: tyre, pitPlan: pitPlan }, weather);
    var strategy = {
      tyre: tyre,
      aggression: aggression,
      pitLap: pitLap,
      riskLevel: riskLevel,
      engineMode: engineMode,
      strategy: strategyId,
      pitPlan: pitPlan,
      safetyCarReaction: decisionSkill > 0.7 ? 'live' : 'hold',
      pitTyres: pitTyres,
      setup: setup,
      aiMeta: {
        decisionSkill: decisionSkill,
        pitSkill: pitSkill,
        setupSkill: setupSkill,
        rainSkill: rainSkill,
        tyreSkill: tyreSkill,
        driverRating: driverRating,
        carScore: clamp(Math.round((referenceCarScore * seededRange(seedRoot + '_car_scale', 0.82, 1.04)) + seededRange(seedRoot + '_car_delta', -5, 5)), 42, 90)
      }
    };
    return { pilot: pilot, strategy: strategy };
  }

  // =====================================================================
  //  BUILD RACE GRID (pure — accepts all data as params)
  // =====================================================================

  function buildRaceGrid(options) {
    var rng = options.rng;
    var playerTeams = options.playerTeams;   // [{teamName, colors, pilots[], car.components, staff[], strategy, engineSupplier}]
    var botSlots = options.botSlots;         // [{botTeamId, teamSnapshot, aiTeamData}]
    var circuit = options.circuit;
    var weather = options.weather;
    var pilotPool = options.pilotPool || [];
    var profile = getCircuitProfile(circuit, weather);

    var grid = [];

    // Player teams (can be multiple in multiplayer)
    (playerTeams || []).forEach(function (pt) {
      var carData = pt.car && pt.car.components ? pt.car.components : {};
      var car = carScoreFromComponents(carData);
      var staffFx = getRaceStaffEffects(pt.staff || []);
      var pilots = pt.pilots || [];
      var strategy = pt.strategy || {};
      var selectedPilotIds = (strategy.selectedPilotIds && strategy.selectedPilotIds.length > 0)
        ? strategy.selectedPilotIds
        : pilots.map(function (p) { return p.id; }).slice(0, 2);
      var driverConfigs = strategy.driverConfigs || {};
      var teamName = pt.teamName || 'Team';
      var teamColor = pt.colors && pt.colors.primary ? pt.colors.primary : '#e8292a';
      var teamId = pt.userId || pt.teamId || 'player';

      selectedPilotIds.slice(0, 2).forEach(function (pilotId, idx) {
        var pilot = pilots.find(function (p) { return p.id === pilotId; }) || pilots[idx] || pilots[0];
        if (!pilot) return;
        var driverStrat = normalizeDriverStrategy(driverConfigs[pilotId] || {}, strategy, weather);
        var setupFx = getSetupEffects(circuit, weather, driverStrat.setup || {});
        var pilotSc = getPilotGridStrength(pilot, weather);
        var layout = profile.layout;
        var layoutCarComponent = {
          'high-speed': (((carData.engine || {}).score || car) + ((carData.efficiency || {}).score || car)) / 2,
          power: (((carData.engine || {}).score || car) + ((carData.gearbox || {}).score || car)) / 2,
          technical: (((carData.brakes || {}).score || car) + ((carData.chassis || {}).score || car) + ((carData.aero || {}).score || car)) / 3,
          mixed: (((carData.chassis || {}).score || car) + ((carData.aero || {}).score || car) + ((carData.reliability || {}).score || car)) / 3,
          endurance: (((carData.reliability || {}).score || car) + ((carData.tyreManage || {}).score || car) + ((carData.efficiency || {}).score || car)) / 3
        };
        var trackCarBonus = ((layoutCarComponent[layout] || car) - 50) * 0.12;
        var weatherDriverMult = weather === 'wet' ? 0.92 : 1;
        var base = ((car * 0.56 + pilotSc * 0.44) + trackCarBonus) * weatherDriverMult * profile.paceBias * setupFx.paceMult;

        grid.push({
          id: teamId + '_' + (idx + 1),
          teamId: teamId,
          name: teamName + ' \u00B7 ' + (pilot.name || 'Driver'),
          color: teamColor,
          pilotId: pilot.id,
          pilotName: pilot.name || 'Driver',
          consistency: getPilotAttr(pilot, 'consistency', 60),
          teamSlot: idx + 1,
          isPlayer: true,
          base: base,
          score: (base + rng.range(-5, 5)) * (1 + staffFx.paceBonus),
          tyre: driverStrat.tyre || 'medium',
          wear: 0,
          gaps: 0,
          strategy: cloneData(driverStrat),
          staffFx: staffFx
        });
      });
    });

    // Bot teams (AI)
    (botSlots || []).forEach(function (bot) {
      var t = bot.aiTeamData || {};
      var snapshot = bot.teamSnapshot || {};
      var botCar = carScoreFromComponents(snapshot.car && snapshot.car.components);

      for (var carSlot = 1; carSlot <= 2; carSlot++) {
        var aiProfile = buildAiDriverProfile(t, carSlot, weather, circuit, profile, botCar, pilotPool);
        var aiSetupFx = getSetupEffects(circuit, weather, aiProfile.strategy.setup || {});
        var aiPilotStrength = getPilotGridStrength(aiProfile.pilot, weather);
        var aiCarScore = aiProfile.strategy.aiMeta.carScore;
        var aiTrackBias = ((aiCarScore - 50) * 0.11) + seededRange(t.id + '_' + carSlot + '_track', -2.5, 2.5);
        var aiBase = ((aiCarScore * 0.54 + aiPilotStrength * 0.46) + aiTrackBias) * profile.paceBias * aiSetupFx.paceMult;
        grid.push({
          id: t.id + '_' + carSlot,
          teamId: t.id,
          name: t.name + ' #' + carSlot,
          color: t.color || '#888',
          isPlayer: false,
          pilotId: aiProfile.pilot.id,
          pilotName: aiProfile.pilot.name,
          consistency: getPilotAttr(aiProfile.pilot, 'consistency', 60),
          teamSlot: carSlot,
          base: aiBase,
          score: aiBase + rng.range(-6, 6) * (1 - aiProfile.strategy.aiMeta.decisionSkill * 0.5),
          tyre: aiProfile.strategy.tyre,
          wear: 0,
          gaps: 0,
          strategy: aiProfile.strategy,
          staffFx: null
        });
      }
    });

    grid.sort(function (a, b) { return b.score - a.score; });
    return grid;
  }

  // =====================================================================
  //  NORMALIZE DRIVER STRATEGY (pure)
  // =====================================================================

  function normalizeDriverStrategy(driverStrategy, baseStrategy, weather) {
    driverStrategy = driverStrategy || {};
    baseStrategy = baseStrategy || {};
    weather = weather || 'dry';
    var normalizedPitPlan = normalizePitPlan(driverStrategy.pitPlan || baseStrategy.pitPlan || 'single');
    var strategySource = {};
    // Merge base into source, then driver overrides
    Object.keys(baseStrategy).forEach(function (k) { strategySource[k] = baseStrategy[k]; });
    Object.keys(driverStrategy).forEach(function (k) { strategySource[k] = driverStrategy[k]; });
    strategySource.pitPlan = normalizedPitPlan;
    strategySource.interventions = Array.isArray(driverStrategy.interventions)
      ? driverStrategy.interventions
      : (Array.isArray(baseStrategy.interventions) ? baseStrategy.interventions : undefined);

    var normalizedInterventions = normalizeStrategyInterventions(strategySource, getPrimaryStopLapPct(strategySource, 50));
    var defaultTyre = driverStrategy.tyre || baseStrategy.tyre || getDefaultRaceTyre(weather);
    return {
      tyre: defaultTyre,
      aggression: Number.isFinite(driverStrategy.aggression) ? driverStrategy.aggression : (baseStrategy.aggression || 50),
      pitLap: normalizedInterventions[0].lapPct,
      riskLevel: Number.isFinite(driverStrategy.riskLevel) ? driverStrategy.riskLevel : (baseStrategy.riskLevel || 40),
      engineMode: driverStrategy.engineMode || baseStrategy.engineMode || 'normal',
      strategy: driverStrategy.strategy || baseStrategy.strategy || 'balanced',
      pitPlan: normalizedPitPlan,
      safetyCarReaction: 'live',
      pitTyres: getDefaultPitTyres(
        driverStrategy.pitTyres ? driverStrategy : baseStrategy,
        weather
      ),
      setup: {
        aeroBalance: Number.isFinite(driverStrategy.setup && driverStrategy.setup.aeroBalance) ? driverStrategy.setup.aeroBalance : (baseStrategy.setup && baseStrategy.setup.aeroBalance != null ? baseStrategy.setup.aeroBalance : 50),
        wetBias: Number.isFinite(driverStrategy.setup && driverStrategy.setup.wetBias) ? driverStrategy.setup.wetBias : (baseStrategy.setup && baseStrategy.setup.wetBias != null ? baseStrategy.setup.wetBias : 50)
      },
      interventions: normalizedInterventions
    };
  }

  // =====================================================================
  //  CRASH REPORT BUILDER
  // =====================================================================

  function buildPlayerCrashReport(options) {
    var strategy = options.strategy || {};
    var setup = options.setup || {};
    var engineFx = options.engineFx || {};
    var lapProfile = options.lapProfile || {};
    var staffFx = options.staffFx || {};
    var pressureContext = options.pressureContext || {};

    var causes = [];
    var tips = [];
    var seenTips = {};
    var pushTip = function (text) {
      if (!text || seenTips[text]) return;
      seenTips[text] = true;
      tips.push(text);
    };

    var riskLevel = Number(strategy.riskLevel || 40);
    if (riskLevel >= 75) {
      causes.push(translateText('crash_cause_high_risk', 'High risk setup increased incident exposure.'));
      pushTip(translateText('crash_tip_reduce_risk', 'Reduce risk level by 10-20 points in similar races.'));
    } else if (riskLevel >= 60) {
      causes.push(translateText('crash_cause_medium_risk', 'Risk level was elevated for the race context.'));
      pushTip(translateText('crash_tip_reduce_risk_small', 'Trim risk level slightly and recover pace through cleaner stints.'));
    }

    if ((strategy.engineMode || 'normal') === 'push') {
      causes.push(translateText('crash_cause_engine_push', 'Engine mode push raised stress during critical laps.'));
      pushTip(translateText('crash_tip_engine_mode', 'Use normal mode during unstable phases and push only in short windows.'));
    }

    if (options.weather === 'wet' && Number(strategy.setup && strategy.setup.wetBias || 50) < 45) {
      causes.push(translateText('crash_cause_wet_setup', 'Wet setup bias was low for rainy conditions.'));
      pushTip(translateText('crash_tip_wet_setup', 'Increase wet setup bias when rain is expected or active.'));
    }

    if (Number(setup.riskMult || 1) > 1.06) {
      causes.push(translateText('crash_cause_setup_instability', 'Setup balance increased instability in this race context.'));
      pushTip(translateText('crash_tip_setup_stability', 'Use a more neutral setup balance to reduce instability.'));
    }

    if (Number(lapProfile.riskBias || 1) >= 1.1) {
      causes.push(translateText('crash_cause_track_risky', 'Track conditions naturally carried higher incident risk.'));
      pushTip(translateText('crash_tip_track_management', 'On high-risk tracks, avoid stacking aggressive calls at the same time.'));
    }

    if (Number(staffFx.incidentRiskMult || 1) > 0.95) {
      causes.push(translateText('crash_cause_risk_control', 'Risk control from the pit wall was limited under pressure.'));
      pushTip(translateText('crash_tip_staff_risk', 'Improve technical/race engineering support to stabilize race execution.'));
    }

    return {
      pilotName: options.pilotName || 'Driver',
      lap: options.lap,
      totalLaps: options.totalLaps,
      causes: causes,
      tips: tips
    };
  }

  function getCrashPressureContext(entry, positions) {
    var active = (Array.isArray(positions) ? positions : [])
      .filter(function (car) { return !car.retired && car.id !== entry.id; })
      .sort(function (a, b) { return (a.timeMs || 0) - (b.timeMs || 0); });
    var selfTime = Number(entry.timeMs || 0);
    var ahead = active.filter(function (car) { return (car.timeMs || Infinity) <= selfTime; }).slice(-1)[0] || null;
    var behind = active.find(function (car) { return (car.timeMs || Infinity) > selfTime; }) || null;
    var aheadGapMs = ahead ? Math.max(0, selfTime - (ahead.timeMs || selfTime)) : null;
    var behindGapMs = behind ? Math.max(0, (behind.timeMs || selfTime) - selfTime) : null;
    return {
      currentPos: Number.isFinite(entry.pos) ? entry.pos : null,
      teammateAhead: !!ahead && !!ahead.isPlayer,
      teammateBehind: !!behind && !!behind.isPlayer,
      rivalAhead: !!ahead && !ahead.isPlayer,
      rivalBehind: !!behind && !behind.isPlayer,
      aheadGapMs: aheadGapMs,
      behindGapMs: behindGapMs,
      rivalPressure: (!!ahead && !ahead.isPlayer && Number.isFinite(aheadGapMs) && aheadGapMs <= 900)
        || (!!behind && !behind.isPlayer && Number.isFinite(behindGapMs) && behindGapMs <= 900),
      teammateBubble: (!!ahead && !!ahead.isPlayer && Number.isFinite(aheadGapMs) && aheadGapMs <= 1200)
        || (!!behind && !!behind.isPlayer && Number.isFinite(behindGapMs) && behindGapMs <= 1200),
      inCleanAir: true
    };
  }

  // =====================================================================
  //  SIMULATE RACE — PURE, DETERMINISTIC
  // =====================================================================

  function simulateRace(options) {
    var rng = options.rng;
    var playerTeams = options.playerTeams || [];
    var botSlots = options.botSlots || [];
    var circuit = options.circuit;
    var weather = options.weather || 'dry';
    var forecast = options.forecast || null;
    var round = options.round || 1;
    var division = options.division || 8;
    var pointsTable = options.pointsTable || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    var pilotPool = options.pilotPool || [];

    var profile = getCircuitProfile(circuit, weather);
    var configuredLaps = Number(circuit && circuit.laps);
    var totalLaps = Number.isFinite(configuredLaps) && configuredLaps > 0 ? Math.round(configuredLaps) : 30;
    var liveWeather = weather;

    // Build grid
    var grid = buildRaceGrid({
      rng: rng,
      playerTeams: playerTeams,
      botSlots: botSlots,
      circuit: circuit,
      weather: weather,
      pilotPool: pilotPool
    });

    var events = [];
    var lapSnapshots = [];
    var crashReportsByCarId = {};
    var safetyCarActive = false;
    var weatherChangesDone = 0;

    // Qualifying sort
    grid.forEach(function (e) {
      e.gridScore = e.score + rng.range(-4, 4);
      if (e.isPlayer) {
        e.tyre = (e.strategy && e.strategy.tyre) || 'medium';
      }
    });
    grid.sort(function (a, b) { return b.gridScore - a.gridScore; });
    var gridStart = grid.map(function (e) { return cloneData(e); });

    // Starting positions text
    var playerStarts = gridStart.filter(function (e) { return e.isPlayer; }).map(function (e) {
      return {
        carId: e.id,
        pilotName: e.pilotName || 'Driver',
        startPos: gridStart.indexOf(e) + 1
      };
    });

    var gridText = playerStarts.map(function (x) { return x.pilotName + ': P' + x.startPos; }).join(' \u00B7 ');
    var openingWeatherText = liveWeather === 'wet'
      ? '\uD83C\uDF27\uFE0F ' + translateText('race_weather_expected_wet', 'Wet race expected.')
      : '\u2600\uFE0F ' + translateText('race_weather_expected_dry', 'Dry race expected.');
    events.push({
      lap: 0,
      type: 'info',
      text: formatTranslatedText('race_event_starting_grid', {
        grid: gridText,
        weatherText: openingWeatherText,
        layoutText: circuit && circuit.layout ? ' \u00B7 ' + translateText('track_layout_' + String(circuit.layout).replace('-', '_'), circuit.layout) : ''
      }, '<strong>Starting grid:</strong> {grid}. {weatherText}{layoutText}')
    });

    // Initialize positions
    var positions = grid.map(function (e, i) {
      return {
        id: e.id,
        teamId: e.teamId,
        name: e.name,
        pilotId: e.pilotId,
        pilotName: e.pilotName,
        color: e.color,
        isPlayer: e.isPlayer,
        consistency: e.consistency || 60,
        base: e.base,
        score: e.score,
        tyre: e.tyre || 'medium',
        strategy: e.strategy || null,
        staffFx: e.staffFx || null,
        pos: i + 1,
        laps: 0,
        pit: false,
        retired: false,
        timeMs: i * 650,
        pitStopsDone: 0,
        pitTimeMs: 0,
        lastPitLossMs: 0,
        lastPitLap: null,
        lapTimesMs: [],
        pitStopLosses: []
      };
    });

    var runtimes = {};
    var updateRunningOrder = function () {
      var activeCars = positions.filter(function (e) { return !e.retired; }).sort(function (a, b) { return a.timeMs - b.timeMs; });
      var retiredCars = positions.filter(function (e) { return e.retired; });
      activeCars.forEach(function (e, idx) { e.pos = idx + 1; });
      retiredCars.forEach(function (e, idx) { e.pos = activeCars.length + idx + 1; });
    };

    // Initialize runtimes per car
    positions.forEach(function (entry) {
      var s = entry.strategy;
      if (!s) {
        s = normalizeDriverStrategy({
          tyre: entry.tyre || getDefaultRaceTyre(weather),
          aggression: entry.isPlayer ? 50 : (42 + rng.intRange(0, 15)),
          pitLap: getBasePitWindowPct(entry.tyre || getDefaultRaceTyre(weather), weather, entry.tyre === 'soft' && weather !== 'wet' ? 'double' : 'single'),
          riskLevel: entry.isPlayer ? 40 : (34 + rng.intRange(0, 17)),
          engineMode: 'normal',
          strategy: 'balanced',
          pitPlan: entry.tyre === 'soft' && weather !== 'wet' ? 'double' : 'single',
          pitTyres: getDefaultPitTyres({ tyre: entry.tyre || getDefaultRaceTyre(weather) }, weather),
          setup: { aeroBalance: 50, wetBias: weather === 'wet' ? 70 : 35 }
        }, {}, weather);
        entry.strategy = cloneData(s);
      }
      var maxPitStops = (s.pitPlan || 'single') === 'double' ? 2 : 1;
      var stopWindows = getConfiguredStopWindows(s, totalLaps);
      runtimes[entry.id] = {
        wear: 0,
        pitStopsDone: 0,
        maxPitStops: maxPitStops,
        adaptivePitLap: stopWindows.firstLap,
        adaptivePitLap2: stopWindows.secondLap
      };
    });

    // ---- MAIN RACE LOOP ----
    for (var lap = 1; lap <= totalLaps; lap++) {
      positions.forEach(function (e) { e.pit = false; e.lastPitLossMs = 0; });

      // Weather change
      var uncertainty = forecast ? (1 - ((forecast.confidence || 60) / 100)) : 0.35;
      var raceWeatherSwingChance = forecast
        ? clamp(0.05 + (uncertainty * 0.22), 0.04, 0.18)
        : 0.12;
      var weatherFlipChance = weatherChangesDone >= 1 ? 0 : (raceWeatherSwingChance / Math.max(18, totalLaps));
      if (rng.chance(weatherFlipChance)) {
        liveWeather = liveWeather === 'wet' ? 'dry' : 'wet';
        weatherChangesDone += 1;
        events.push({ lap: lap, type: 'info', text: liveWeather === 'wet'
          ? '\uD83C\uDF27\uFE0F ' + translateText('race_event_weather_rain', 'Sudden rain hits the circuit!')
          : '\u2600\uFE0F ' + translateText('race_event_weather_drying', 'Track is drying quickly.') });
      }

      var lapProfile = getCircuitProfile(circuit, liveWeather);

      // Safety car
      if (!safetyCarActive && rng.chance(0.06)) {
        safetyCarActive = true;
        events.push({ lap: lap, type: 'safety', text: '\uD83D\uDFE1 ' + translateText('race_event_vsc', '<strong>Virtual Safety Car deployed!</strong> Pack bunches up.') });
        var activeCars = positions.filter(function (e) { return !e.retired; }).sort(function (a, b) { return a.timeMs - b.timeMs; });
        var leaderTimeSC = activeCars[0] ? activeCars[0].timeMs : 0;
        activeCars.forEach(function (entry, index) {
          if (index === 0) return;
          entry.timeMs = leaderTimeSC + ((entry.timeMs - leaderTimeSC) * 0.55);
        });

        // Pit wall decision under SC
        var staffDelta = 0;
        var hasPendingPlayerPit = false;
        positions.forEach(function (e) {
          if (e.isPlayer && !e.retired && e.staffFx) {
            staffDelta = (e.staffFx.undercutStrength || 0.5) - (e.staffFx.overcutStrength || 0.5);
          }
          if (e.isPlayer && !e.retired) {
            var rt = runtimes[e.id];
            if (rt && rt.pitStopsDone < rt.maxPitStops) hasPendingPlayerPit = true;
          }
        });
        var liveSafetyCarCall = 'neutral';
        if (hasPendingPlayerPit) {
          if (staffDelta > 0.08) liveSafetyCarCall = 'undercut';
          else if (staffDelta < -0.08) liveSafetyCarCall = 'overcut';
        }

        // Undercut/overcut pit window adjustments
        positions.filter(function (e) { return !e.retired; }).forEach(function (entry) {
          var rt = runtimes[entry.id];
          if (!rt || rt.pitStopsDone >= rt.maxPitStops) return;
          var decisionSkill = entry.isPlayer ? 0.72 : ((entry.strategy && entry.strategy.aiMeta && entry.strategy.aiMeta.decisionSkill) || 0.55);
          var playerStaffFx = entry.staffFx || {};
          if (liveSafetyCarCall === 'undercut') {
            var undercutWorks = rng.chance(entry.isPlayer ? (playerStaffFx.undercutStrength || 0.5) : clamp(0.32 + decisionSkill * 0.5, 0.35, 0.86));
            if (rt.pitStopsDone === 0 && rt.adaptivePitLap - lap <= 3) {
              rt.adaptivePitLap = Math.max(lap + 1, undercutWorks ? 2 : rt.adaptivePitLap - 1);
            } else if (rt.pitStopsDone === 1 && rt.adaptivePitLap2 - lap <= 3) {
              rt.adaptivePitLap2 = Math.max(lap + 1, undercutWorks ? rt.adaptivePitLap2 - 1 : rt.adaptivePitLap2);
            }
          }
          if (liveSafetyCarCall === 'overcut') {
            var overcutWorks = rng.chance(entry.isPlayer ? (playerStaffFx.overcutStrength || 0.5) : clamp(0.3 + decisionSkill * 0.48, 0.34, 0.84));
            if (rt.pitStopsDone === 0 && lap >= rt.adaptivePitLap - 2) {
              rt.adaptivePitLap = Math.min(totalLaps - 3, rt.adaptivePitLap + (overcutWorks ? 2 : 1));
            } else if (rt.pitStopsDone === 1 && lap >= rt.adaptivePitLap2 - 2) {
              rt.adaptivePitLap2 = Math.min(totalLaps - 2, rt.adaptivePitLap2 + (overcutWorks ? 2 : 1));
            }
          }
        });
      }
      if (safetyCarActive && rng.chance(0.4)) {
        safetyCarActive = false;
        events.push({ lap: lap, type: 'info', text: '\uD83D\uDFE2 ' + translateText('race_event_green_flag', 'Safety car period ends. Green flag!') });
      }

      // Lap times
      positions.filter(function (e) { return !e.retired; }).forEach(function (entry) {
        var s = entry.strategy || {};
        var setup = getSetupEffects(circuit, liveWeather, s.setup || {});
        var engineFx = getEngineModeFx(s.engineMode || 'normal');
        var rt = runtimes[entry.id];
        var currentTyre = entry.tyre || s.tyre || 'medium';
        if (rt) {
          var baseWear = getTyreWearStep(currentTyre, liveWeather) * lapProfile.tyreDegMult * (1 + engineFx.tyre) * setup.tyreMult;
          var aggressionWear = Math.max(0, ((s.aggression || 50) - 50) * 0.003);
          rt.wear += baseWear + aggressionWear;
        }

        var rawPace = clamp(Number(entry.base || entry.score || 60), 35, 99);
        var paceMs = rawPace * (entry.isPlayer ? 175 : 160);
        var tyreDeltaMs = getTyrePaceDeltaMs(currentTyre, liveWeather);
        var aggressionMs = ((s.aggression || 50) - 50) * 16;
        var engineMs = (engineFx.pace || 0) * 2200;
        var usefulLife = getTyreUsefulLife(currentTyre, liveWeather, totalLaps);
        var wearOveruse = rt ? Math.max(0, rt.wear - usefulLife) : 0;
        var wearMs = wearOveruse * 1100;
        var lapBaseMs = safetyCarActive ? 110000 : 94500;
        var consistency = clamp(Number(entry.consistency || 60), 20, 99);
        var playerNoiseHalfRange = clamp(500 - (consistency * 3), 120, 520);
        var aiNoiseHalfRange = clamp(800 - (consistency * 2), 220, 900);
        var noiseHalfRange = entry.isPlayer ? playerNoiseHalfRange : aiNoiseHalfRange;
        var noiseMs = rng.range(-noiseHalfRange, noiseHalfRange);
        var lapTimeMs = lapBaseMs - paceMs - aggressionMs - engineMs + tyreDeltaMs + wearMs + noiseMs;
        var clampedLapTimeMs = Math.max(70000, lapTimeMs);
        entry.timeMs += clampedLapTimeMs;
        if (!safetyCarActive) entry.lapTimesMs.push(clampedLapTimeMs);
        entry.laps = lap;
      });

      // Pit stops
      var pitStopsThisLap = false;
      positions.filter(function (e) { return !e.retired; }).forEach(function (entry) {
        var rt = runtimes[entry.id];
        var s = entry.strategy || {};
        if (!rt) return;

        var nextPitLap = rt.pitStopsDone === 0 ? rt.adaptivePitLap : rt.adaptivePitLap2;
        if (rt.pitStopsDone < rt.maxPitStops && lap === nextPitLap) {
          rt.pitStopsDone++;
          rt.wear = 0;
          var newTyre = choosePitTyreForConditions(entry, s, rt.pitStopsDone - 1, liveWeather, forecast, rng);
          var pitLossMs = getPitStopTimeMs(entry, liveWeather, safetyCarActive, entry.staffFx || {}, rng);
          entry.timeMs += pitLossMs;
          entry.tyre = newTyre;
          entry.pit = true;
          entry.pitStopsDone = rt.pitStopsDone;
          entry.pitTimeMs += pitLossMs;
          entry.pitStopLosses.push(pitLossMs);
          entry.lastPitLossMs = pitLossMs;
          entry.lastPitLap = lap;
          pitStopsThisLap = true;
          var tyreLabel = translateText('compound_' + newTyre, newTyre);
          if (entry.isPlayer) {
            events.push({ lap: lap, type: 'pit', text: '\uD83D\uDD35 ' + formatTranslatedText('race_event_player_pit', {
              pilotName: entry.pilotName,
              stop: rt.pitStopsDone,
              maxStops: rt.maxPitStops,
              lossSec: (pitLossMs / 1000).toFixed(1),
              tyreLabel: tyreLabel
            }, '<strong>{pilotName} pits (stop {stop}/{maxStops})!</strong> Loses {lossSec}s and fits {tyreLabel}.') });
          } else {
            events.push({ lap: lap, type: 'pit', text: '\uD83D\uDEDE ' + formatTranslatedText('race_event_ai_pit', {
              teamName: entry.name,
              stop: rt.pitStopsDone,
              maxStops: rt.maxPitStops,
              lossSec: (pitLossMs / 1000).toFixed(1),
              tyreLabel: tyreLabel,
              tyreNote: ''
            }, '<strong>{teamName}</strong> pits (stop {stop}/{maxStops}) and loses {lossSec}s. Fits {tyreLabel}.{tyreNote}') });
          }

          if (rt.pitStopsDone === 1 && rt.maxPitStops > 1) {
            rt.adaptivePitLap2 = Math.max(rt.adaptivePitLap2, lap + 6);
            rt.adaptivePitLap2 = Math.min(rt.adaptivePitLap2, totalLaps - 2);
          }
        }
      });

      if (pitStopsThisLap) updateRunningOrder();

      // Incidents — AI retirements
      positions.forEach(function (p) {
        if (!p.retired && !p.isPlayer) {
          if (rng.chance(0.012)) {
            p.retired = true;
            events.push({ lap: lap, type: 'incident', text: '\uD83D\uDCA5 ' + formatTranslatedText('race_event_ai_retire', { name: p.name }, '<strong>{name}</strong> retires with mechanical failure!') });
          }
        }
      });

      // Player incidents
      positions.filter(function (e) { return e.isPlayer && !e.retired; }).forEach(function (entry) {
        var s = entry.strategy || {};
        var setup = getSetupEffects(circuit, liveWeather, s.setup || {});
        var engineFx = getEngineModeFx(s.engineMode || 'normal');
        var rt = runtimes[entry.id];
        var playerStaffFx = entry.staffFx || {};
        if (!rt) return;

        var riskFactor = (s.riskLevel || 40) / 100;
        if (rng.chance((0.01 * riskFactor + 0.004) * lapProfile.riskBias * (1 + engineFx.risk) * (playerStaffFx.incidentRiskMult || 1) * setup.riskMult)) {
          if (rng.chance(0.2)) {
            // Full crash / DNF
            var currentTyre = entry.tyre || s.tyre || 'medium';
            var usefulLife = getTyreUsefulLife(currentTyre, liveWeather, totalLaps);
            var pressureContext = getCrashPressureContext(entry, positions);
            entry.retired = true;
            crashReportsByCarId[entry.id] = buildPlayerCrashReport({
              pilotName: entry.pilotName,
              lap: lap,
              totalLaps: totalLaps,
              weather: liveWeather,
              strategy: s,
              setup: setup,
              engineFx: engineFx,
              lapProfile: lapProfile,
              staffFx: playerStaffFx,
              rt: rt,
              usefulLife: usefulLife,
              pressureContext: pressureContext
            });
            events.push({ lap: lap, type: 'incident', text: '\uD83D\uDCA5 ' + formatTranslatedText('race_event_player_retire', { pilotName: entry.pilotName }, '<strong>{pilotName} retires!</strong> Mechanical issue. DNF.') });
          } else {
            // Spin — lose positions
            var lostPos = rng.intRange(1, 3);
            entry.timeMs += lostPos * 2600;
            events.push({ lap: lap, type: 'incident', text: '\u26A0\uFE0F ' + formatTranslatedText('race_event_player_spin', { pilotName: entry.pilotName, lostPos: lostPos }, '<strong>{pilotName}</strong> has a spin! Drops {lostPos} position(s).') });
          }
        }

        // Overtakes (every 5 laps)
        if (!entry.pit && lap % 5 === 0 && !entry.retired) {
          var ahead = positions.find(function (x) { return x.pos === entry.pos - 1 && !x.retired; });
          if (ahead && rng.chance(((0.3 + ((s.aggression || 50) / 200)) * lapProfile.overtakeBias + (playerStaffFx.overtakeBonus || 0)) * (1 + Math.max(0, engineFx.pace)) * Math.max(0.9, setup.paceMult))) {
            entry.timeMs = Math.max(0, entry.timeMs - 950);
            ahead.timeMs += 950;
            events.push({ lap: lap, type: 'good', text: '\u2705 ' + formatTranslatedText('race_event_player_overtake', { pilotName: entry.pilotName, aheadName: ahead.name, position: entry.pos }, '<strong>{pilotName}</strong> overtakes <strong>{aheadName}</strong>! Moves up to P{position}.') });
          }
          if (rng.chance(0.12)) {
            events.push({ lap: lap, type: 'good', text: '\uD83D\uDFE2 ' + formatTranslatedText('race_event_player_best_lap', { pilotName: entry.pilotName, lap: lap }, 'Personal best lap by <strong>{pilotName}</strong> on lap {lap}.') });
          }
        }

        // Tyre performance events
        var currentTyrePf = entry.tyre || s.tyre || 'medium';
        var paceDelta = getTyreWeatherPaceDelta(currentTyrePf, liveWeather);
        var usefulLifePf = getTyreUsefulLife(currentTyrePf, liveWeather, totalLaps);
        var wearPenalty = Math.max(0, ((rt.wear / Math.max(1, usefulLifePf)) - 0.8) * 5.5);
        var perfScore = paceDelta - wearPenalty + ((s.aggression || 50) - 50) * 0.01;

        if (!entry.pit && perfScore > 2.2 && rng.chance(0.12)) {
          entry.timeMs = Math.max(0, entry.timeMs - 650);
          events.push({ lap: lap, type: 'good', text: '\u26A1 ' + formatTranslatedText('race_event_player_tyre_push', { pilotName: entry.pilotName, tyreLabel: translateText('compound_' + currentTyrePf, currentTyrePf) }, '<strong>{pilotName}</strong> gains pace advantage on {tyreLabel} and moves up.') });
        }
        if (!entry.pit && perfScore < -2.2 && rng.chance(0.14)) {
          entry.timeMs += 1400;
          events.push({ lap: lap, type: 'incident', text: '\uD83D\uDCC9 ' + formatTranslatedText('race_event_player_tyre_struggle', { pilotName: entry.pilotName, tyreLabel: translateText('compound_' + currentTyrePf, currentTyrePf), weatherLabel: translateText(liveWeather === 'wet' ? 'weather_wet' : 'weather_dry', liveWeather) }, '<strong>{pilotName}</strong> struggles with {tyreLabel} in {weatherLabel}.') });
        }

        if (rt.wear > usefulLifePf * 0.88 && rt.wear < (usefulLifePf * 0.88) + 1.4 && !entry.retired) {
          events.push({ lap: lap, type: 'incident', text: '\u26A0\uFE0F ' + formatTranslatedText('race_event_player_tyre_drop', { pilotName: entry.pilotName }, 'Tyre performance dropping for <strong>{pilotName}</strong>.') });
        }
      });

      updateRunningOrder();

      // Lap snapshot
      var leaderTime = positions.filter(function (e) { return !e.retired; }).reduce(function (best, e) { return Math.min(best, e.timeMs); }, Infinity);
      lapSnapshots.push({
        lap: lap,
        weather: liveWeather,
        order: positions
          .map(function (e) {
            return {
              id: e.id,
              name: e.name,
              pilotName: e.pilotName,
              isPlayer: e.isPlayer,
              pos: e.pos,
              tyre: e.tyre,
              pit: !!e.pit,
              pitStopsDone: e.pitStopsDone || 0,
              pitLossMs: e.lastPitLossMs || 0,
              color: e.color,
              retired: e.retired,
              gapMs: e.retired || !Number.isFinite(leaderTime) ? null : Math.max(0, e.timeMs - leaderTime)
            };
          })
          .sort(function (a, b) { return a.pos - b.pos; })
      });
    }

    // ---- FINAL RESULTS ----
    var activePositions = positions.filter(function (p) { return !p.retired; }).sort(function (a, b) { return a.pos - b.pos; });
    var retiredPositions = positions.filter(function (p) { return p.retired; });
    var finalGrid = [].concat(activePositions, retiredPositions);

    var playerCars = positions
      .filter(function (p) { return p.isPlayer; })
      .map(function (entry) {
        var start = playerStarts.find(function (x) { return x.carId === entry.id; });
        var startPos = start ? start.startPos : 20;
        var finalPos = finalGrid.indexOf(entry) + 1;
        if (finalPos <= 0) finalPos = finalGrid.length;
        var dnf = !!entry.retired;
        var pts = dnf ? 0 : (pointsTable[finalPos - 1] || 0);
        return {
          id: entry.id,
          teamId: entry.teamId,
          pilotId: entry.pilotId,
          pilotName: entry.pilotName,
          position: finalPos,
          isDNF: dnf,
          points: pts,
          startPos: startPos,
          improvement: finalPos - startPos,
          tyre: entry.tyre || 'medium',
          pitStopsDone: entry.pitStopsDone || 0,
          pitTimeMs: entry.pitTimeMs || 0,
          lapTimesMs: entry.lapTimesMs || [],
          pitStopLosses: entry.pitStopLosses || [],
          strategy: entry.strategy || {},
          crashReport: crashReportsByCarId[entry.id] || null
        };
      })
      .sort(function (a, b) { return a.position - b.position; });

    // All cars results (for standings)
    var allCarsResults = finalGrid.map(function (entry, idx) {
      var dnf = !!entry.retired;
      var pts = dnf ? 0 : (pointsTable[idx] || 0);
      return {
        id: entry.id,
        teamId: entry.teamId,
        pilotName: entry.pilotName,
        position: idx + 1,
        isDNF: dnf,
        points: pts,
        isPlayer: entry.isPlayer
      };
    });

    // Prize money
    var PRIZE_MULT = {1:1.00, 2:0.84, 3:0.67, 4:0.50, 5:0.35, 6:0.22, 7:0.14, 8:0.08};
    var pMult = PRIZE_MULT[division] || 0.08;
    var prizeBase = [50000,40000,35000,25000,20000,15000,12000,10000,8000,5000,3000,2000,1500,1000,500,300];
    var prizeMap = prizeBase.map(function (v) { return Math.round(v * pMult / 100) * 100; });

    // Build team summaries (grouped by teamId)
    var teamSummaries = {};
    allCarsResults.forEach(function (car) {
      if (!teamSummaries[car.teamId]) {
        teamSummaries[car.teamId] = { teamId: car.teamId, isPlayer: car.isPlayer, points: 0, cars: [], bestPosition: 99, prizeMoney: 0 };
      }
      var ts = teamSummaries[car.teamId];
      ts.points += car.points;
      ts.cars.push(car);
      if (car.position < ts.bestPosition) ts.bestPosition = car.position;
      ts.prizeMoney += prizeMap[car.position - 1] || Math.max(100, Math.round(200 * pMult / 100) * 100);
    });

    var leadResult = playerCars[0] || { position: finalGrid.length, isDNF: true, points: 0, improvement: 0, pilotName: 'Driver' };

    return {
      round: round,
      position: leadResult.position,
      isDNF: leadResult.isDNF,
      points: playerCars.reduce(function (sum, x) { return sum + (x.points || 0); }, 0),
      events: events,
      lapSnapshots: lapSnapshots,
      finalGrid: finalGrid.map(function (e) {
        return {
          id: e.id, teamId: e.teamId, name: e.name, pilotName: e.pilotName,
          color: e.color, isPlayer: e.isPlayer, pos: e.pos, retired: e.retired,
          tyre: e.tyre, pitStopsDone: e.pitStopsDone || 0,
          timeMs: e.timeMs || 0,
          pitTimeMs: e.pitTimeMs || 0,
          lapTimesMs: e.lapTimesMs || [],
          pitStopLosses: e.pitStopLosses || []
        };
      }),
      gridStart: gridStart.map(function (e) {
        return {
          id: e.id, teamId: e.teamId, name: e.name, pilotName: e.pilotName,
          color: e.color, isPlayer: e.isPlayer
        };
      }),
      playerCars: playerCars,
      allCarsResults: allCarsResults,
      teamSummaries: teamSummaries,
      weather: liveWeather,
      circuit: circuit,
      circuitProfile: profile,
      forecastUsed: forecast,
      totalLaps: totalLaps,
      fastestLap: !leadResult.isDNF && leadResult.position <= 5 && rng.chance(0.2),
      improvement: leadResult.improvement,
      division: division
    };
  }

  // =====================================================================
  //  STANDINGS UPDATE (pure)
  // =====================================================================

  function updateStandingsPure(standings, raceResult, pointsTable) {
    pointsTable = pointsTable || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    standings = cloneData(standings || []);

    var allCars = raceResult.allCarsResults || [];
    var teamPoints = {};
    var teamWins = {};
    var teamBestPos = {};

    allCars.forEach(function (car) {
      var tid = car.teamId;
      if (!teamPoints[tid]) { teamPoints[tid] = 0; teamWins[tid] = 0; teamBestPos[tid] = 99; }
      teamPoints[tid] += car.points || 0;
      if (car.position === 1) teamWins[tid]++;
      if (car.position < teamBestPos[tid]) teamBestPos[tid] = car.position;
    });

    standings.forEach(function (entry) {
      var tid = entry.teamId || entry.id;
      if (teamPoints[tid] !== undefined) {
        entry.points = (entry.points || 0) + teamPoints[tid];
        entry.wins = (entry.wins || 0) + (teamWins[tid] || 0);
        if (teamBestPos[tid] <= 3) entry.podiums = (entry.podiums || 0) + 1;
        if (!entry.bestResult || teamBestPos[tid] < entry.bestResult) entry.bestResult = teamBestPos[tid];
      }
    });

    standings.sort(function (a, b) { return (b.points || 0) - (a.points || 0) || (b.wins || 0) - (a.wins || 0); });
    standings.forEach(function (s, i) { s.position = i + 1; });

    return standings;
  }

  // =====================================================================
  //  CALENDAR GENERATION (deterministic)
  // =====================================================================

  function generateCalendar(division, circuits, rng) {
    var RACE_STATUS = { UPCOMING: 'upcoming', NEXT: 'next', COMPLETED: 'completed' };
    var count = 8;
    var shuffled = rng.shuffle(circuits);
    var selectedCircuits = shuffled.slice(0, count);

    var targetWetRaces = Math.max(2, Math.min(4, Math.round(count * 0.28)));
    var wetRaceIds = {};
    selectedCircuits
      .map(function (c) {
        return { id: c.id, weight: clamp(100 - (c.weather || 70), 5, 60) + rng.range(0, 12) };
      })
      .sort(function (a, b) { return b.weight - a.weight; })
      .slice(0, targetWetRaces)
      .forEach(function (entry) { wetRaceIds[entry.id] = true; });

    return selectedCircuits.map(function (c, i) {
      var isWetRace = !!wetRaceIds[c.id];
      var baseConfidence = 58 + ((8 - division) * 2);
      var confidence = Math.max(50, Math.min(92, baseConfidence + rng.intRange(0, 12)));
      var forecastBase = isWetRace
        ? clamp(52 + ((100 - (c.weather || 70)) * 0.35), 48, 78)
        : clamp(16 + ((100 - (c.weather || 70)) * 0.22), 8, 38);
      var startWetProb = Math.max(5, Math.min(95, forecastBase + rng.intRange(-8, 8)));
      var midWetProb = Math.max(5, Math.min(95, startWetProb + rng.intRange(-12, 12)));
      var endWetProb = Math.max(5, Math.min(95, midWetProb + rng.intRange(-12, 12)));

      return {
        round: i + 1,
        circuit: c,
        circuitId: c.id,
        status: i === 0 ? RACE_STATUS.NEXT : RACE_STATUS.UPCOMING,
        result: null,
        weather: isWetRace ? 'wet' : 'dry',
        forecast: {
          confidence: confidence,
          windows: [
            { label: 'start', wetProb: startWetProb },
            { label: 'mid', wetProb: midWetProb },
            { label: 'end', wetProb: endWetProb }
          ]
        }
      };
    });
  }

  // =====================================================================
  //  PUBLIC API
  // =====================================================================

  return {
    // RNG
    SeededRNG: SeededRNG,
    hashSeed: hashSeed,
    seededUnit: seededUnit,
    seededRange: seededRange,
    pickSeeded: pickSeeded,

    // Utils
    clamp: clamp,
    cloneData: cloneData,

    // Circuit & setup
    getCircuitProfile: getCircuitProfile,
    getSetupEffects: getSetupEffects,

    // Pilot
    pilotScore: pilotScore,
    carScoreFromComponents: carScoreFromComponents,
    getPilotAttr: getPilotAttr,
    getPilotGridStrength: getPilotGridStrength,
    getPilotRaceStrength: getPilotRaceStrength,

    // Staff
    getRaceStaffEffects: getRaceStaffEffects,

    // Tyres
    TYRE_COMPOUNDS: TYRE_COMPOUNDS,
    getTyreCompound: getTyreCompound,
    getTyreUsefulLife: getTyreUsefulLife,
    getTyreWearStep: getTyreWearStep,
    getTyrePaceDeltaMs: getTyrePaceDeltaMs,

    // Pit
    getBasePitWindowPct: getBasePitWindowPct,
    getDefaultPitTyres: getDefaultPitTyres,
    getConfiguredStopWindows: getConfiguredStopWindows,
    getEngineModeFx: getEngineModeFx,
    getPitStopTimeMs: getPitStopTimeMs,
    choosePitTyreForConditions: choosePitTyreForConditions,
    normalizePitPlan: normalizePitPlan,
    normalizeDriverStrategy: normalizeDriverStrategy,
    getDefaultRaceTyre: getDefaultRaceTyre,

    // AI
    buildAiDriverProfile: buildAiDriverProfile,

    // Core simulation
    buildRaceGrid: buildRaceGrid,
    simulateRace: simulateRace,

    // Standings
    updateStandingsPure: updateStandingsPure,

    // Calendar
    generateCalendar: generateCalendar,

    // Translation helpers
    translateText: translateText,
    formatTranslatedText: formatTranslatedText
  };
}));
