// ===== SCREENS.JS – All secondary screen renderers =====
'use strict';

const SCREENS = {
  getRaceRuntimeMode() {
    const mode = window._raceRuntimeMode;
    return mode === 'qa' ? 'qa' : 'real';
  },

  getRaceRuntimeDurationMs() {
    return this.getRaceRuntimeMode() === 'qa' ? (2 * 60 * 1000) : (30 * 60 * 1000);
  },

  setRaceRuntimeMode(mode) {
    window._raceRuntimeMode = (mode === 'qa') ? 'qa' : 'real';
    GL_UI.toast(window._raceRuntimeMode === 'qa' ? 'Modo QA activo (2 min).' : 'Modo REAL activo (30 min).', 'info');
    this.renderRace();
  },

  getTyreMeta(tyre) {
    const compounds = {
      soft: { label: __('compound_soft', 'Soft'), shortLabel: 'S', color: '#ff4d4f', paceText: __('compound_soft_pace', '+0.5s to +1.0s vs Medium in the dry'), durabilityText: __('compound_soft_durability', 'Lasts 15-30% of the race · drops to 10-20% in the wet') },
      medium: { label: __('compound_medium', 'Medium'), shortLabel: 'M', color: '#f1c40f', paceText: __('compound_medium_pace', 'Baseline compound and the most versatile'), durabilityText: __('compound_medium_durability', 'Lasts 30-50% of the race · strong for Medium -> Hard plans') },
      hard: { label: __('compound_hard', 'Hard'), shortLabel: 'H', color: '#f5f7fa', paceText: __('compound_hard_pace', '0.5s to 0.8s slower than Medium'), durabilityText: __('compound_hard_durability', 'Lasts 50-70% of the race · best for one-stop plans') },
      intermediate: { label: __('compound_intermediate', 'Intermediate'), shortLabel: 'I', color: '#2ecc71', paceText: __('compound_intermediate_pace', 'Reference tyre on a damp track'), durabilityText: __('compound_intermediate_durability', 'Lasts 40-70% in the wet · only 10-25% on dry asphalt') },
      wet: { label: __('compound_wet', 'Wet'), shortLabel: 'W', color: '#3498db', paceText: __('compound_wet_pace', 'Only for extreme rain · usually slower than Intermediates'), durabilityText: __('compound_wet_durability', 'Lasts 20-40% in the wet · overheats in 5-15% on dry asphalt') }
    };
    return compounds[tyre] || compounds.medium;
  },

  getTrackLayoutLabel(layout) {
    const map = {
      'high-speed': __('track_layout_high_speed', 'High-speed'),
      power: __('track_layout_power', 'Power'),
      technical: __('track_layout_technical', 'Technical'),
      mixed: __('track_layout_mixed', 'Mixed'),
      endurance: __('track_layout_endurance', 'Endurance')
    };
    return map[layout] || layout || '—';
  },

  getEngineModeLabel(mode) {
    const map = {
      eco: __('engine_mode_eco', 'Eco'),
      normal: __('engine_mode_normal', 'Normal'),
      push: __('engine_mode_push', 'Push')
    };
    return map[mode] || String(mode || '').toUpperCase();
  },

  getPitPlanLabel(plan) {
    const map = {
      single: __('pit_plan_single', 'One stop'),
      double: __('pit_plan_double', 'Two stops')
    };
    return map[plan] || map.single;
  },

  getCompoundLabel(tyre) {
    const map = {
      soft: __('compound_soft', 'Soft'),
      medium: __('compound_medium', 'Medium'),
      hard: __('compound_hard', 'Hard'),
      intermediate: __('compound_intermediate', 'Intermediate'),
      wet: __('compound_wet', 'Wet')
    };
    return map[tyre] || tyre || '—';
  },

  getAttrLabel(attrKey) {
    const key = String(attrKey || '');
    const readableFallbacks = {
      pace: 'Ritmo',
      racePace: 'Ritmo de carrera',
      consistency: 'Consistencia',
      rain: 'Rendimiento en lluvia',
      tyre: 'Gestion de neumaticos',
      aggression: 'Agresividad',
      overtake: 'Adelantamientos',
      techFB: 'Feedback tecnico',
      mental: 'Mentalidad',
      charisma: 'Carisma'
    };
    return __(key.startsWith('attr_') ? key : `attr_${key}`, readableFallbacks[key] || key || '—');
  },

  getHqLabel(buildingId) {
    const key = String(buildingId || '');
    const readableFallbacks = {
      admin: 'Administracion',
      wind_tunnel: 'Tunel de viento',
      rnd: 'Centro de I+D',
      factory: 'Fabrica',
      academy: 'Academia de pilotos'
    };
    return __(key.startsWith('hq_') ? key : `hq_${key}`, readableFallbacks[key] || key || '—');
  },

  getHqCapabilitySnapshot(state, overrideBuildingId = null, overrideLevel = null) {
    if (!state || !GL_ENGINE.getHqCapabilities) return null;
    if (!overrideBuildingId) return GL_ENGINE.getHqCapabilities(state);
    const shadowState = JSON.parse(JSON.stringify(state));
    shadowState.hq = shadowState.hq || {};
    shadowState.hq[overrideBuildingId] = overrideLevel;
    return GL_ENGINE.getHqCapabilities(shadowState);
  },

  getHqUpgradeImpactText(state, def, currentLevel) {
    const fmtCR = (value) => {
      if (window.GL_UI && typeof window.GL_UI.fmtCR === 'function') return window.GL_UI.fmtCR(value);
      return `${Math.round(Number(value) || 0).toLocaleString('es-ES')} CR`;
    };
    const nextLevelData = def?.levels?.[currentLevel];
    const currentLevelData = def?.levels?.[Math.max(0, currentLevel - 1)];
    if (!nextLevelData) {
      return currentLevelData?.effect
        ? `Efecto actual: ${currentLevelData.effect}`
        : 'Nivel maximo alcanzado';
    }

    const beforeCaps = this.getHqCapabilitySnapshot(state);
    const afterCaps = this.getHqCapabilitySnapshot(state, def.id, currentLevel + 1);
    if (!beforeCaps || !afterCaps) return `Mejora: ${nextLevelData.effect}`;

    if (def.id === 'admin') {
      const pct = Math.round((afterCaps.sponsorMultiplier - beforeCaps.sponsorMultiplier) * 100);
      if (pct > 0) {
        const breakdown = (typeof window.getWeeklyEconomyBreakdown === 'function')
          ? window.getWeeklyEconomyBreakdown(state)
          : null;
        const sponsorIncome = Number(breakdown?.sponsorIncome || 0);
        const beforeMult = Number(beforeCaps.sponsorMultiplier || 1);
        const afterMult = Number(afterCaps.sponsorMultiplier || 1);
        let estimate = '';
        if (sponsorIncome > 0 && beforeMult > 0 && afterMult > beforeMult) {
          const projectedDelta = sponsorIncome * ((afterMult - beforeMult) / beforeMult);
          if (projectedDelta > 0) estimate = ` (~+${fmtCR(Math.round(projectedDelta))}/sem)`;
        }
        return `Prox. nivel: +${pct}% ingresos por sponsors${estimate}`;
      }
      return `Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'rnd') {
      const speedPct = Math.round((afterCaps.rndSpeedMultiplier - beforeCaps.rndSpeedMultiplier) * 100);
      if (!beforeCaps.rndUnlocked && afterCaps.rndUnlocked) return 'Prox. nivel: desbloquea I+D';
      if (speedPct > 0) {
        const beforeSpeed = Number(beforeCaps.rndSpeedMultiplier || 1);
        const afterSpeed = Number(afterCaps.rndSpeedMultiplier || 1);
        const durationCutPct = Math.round((1 - (beforeSpeed / Math.max(afterSpeed, 1))) * 100);
        if (durationCutPct > 0) return `Prox. nivel: +${speedPct}% velocidad I+D (~-${durationCutPct}% tiempo por proyecto)`;
        return `Prox. nivel: +${speedPct}% velocidad de I+D`;
      }
      return `Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'wind_tunnel') {
      if (!beforeCaps.weatherResearchUnlocked && afterCaps.weatherResearchUnlocked) {
        return 'Prox. nivel: desbloquea investigacion de clima';
      }
      return `Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'factory') {
      const slotsDelta = (afterCaps.factoryParallelSlots || 1) - (beforeCaps.factoryParallelSlots || 1);
      if (slotsDelta > 0) return `Prox. nivel: +${slotsDelta} cola paralela de I+D (mas progreso simultaneo)`;
      return `Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'academy') {
      const speedPct = Math.round((afterCaps.academyTrainingSpeedMultiplier - beforeCaps.academyTrainingSpeedMultiplier) * 100);
      const slotsDelta = (afterCaps.academyTrainingSlots || 1) - (beforeCaps.academyTrainingSlots || 1);
      if (slotsDelta > 0 && speedPct > 0) {
        const beforeSpeed = Number(beforeCaps.academyTrainingSpeedMultiplier || 1);
        const afterSpeed = Number(afterCaps.academyTrainingSpeedMultiplier || 1);
        const durationCutPct = Math.round((1 - (beforeSpeed / Math.max(afterSpeed, 1))) * 100);
        return durationCutPct > 0
          ? `Prox. nivel: +${slotsDelta} slot y +${speedPct}% entreno (~-${durationCutPct}% tiempo)`
          : `Prox. nivel: +${slotsDelta} slot y +${speedPct}% entreno`;
      }
      if (slotsDelta > 0) return `Prox. nivel: +${slotsDelta} slot de entrenamiento`;
      if (speedPct > 0) return `Prox. nivel: +${speedPct}% velocidad de entrenamiento`;
      return `Mejora: ${nextLevelData.effect}`;
    }

    return `Mejora: ${nextLevelData.effect}`;
  },

  getStaffFocusLabel(staffLabel) {
    const keyOrLabel = String(staffLabel || '');
    const aliasMap = {
      'Chief Engineer': 'staff_focus_chief_engineer',
      'Pilot Coach': 'staff_focus_pilot_coach',
      'Race Engineer / Data Analyst': 'staff_focus_race_engineer_data_analyst',
      'Head of Pits': 'staff_focus_head_of_pits'
    };
    const resolvedKey = aliasMap[keyOrLabel] || keyOrLabel;
    const readableFallbacks = {
      staff_focus_chief_engineer: 'Ingeniero jefe',
      staff_focus_pilot_coach: 'Coach de pilotos',
      staff_focus_race_engineer_data_analyst: 'Ingeniero de carrera / Analista de datos',
      staff_focus_head_of_pits: 'Jefe de boxes'
    };
    return __(resolvedKey, readableFallbacks[resolvedKey] || keyOrLabel || '—');
  },

  getStaffRoleLabel(role) {
    const roleLabel = String(role || '');
    const roleMap = {
      'Chief Engineer': 'staff_role_chief_engineer',
      'Race Engineer': 'staff_role_race_engineer',
      Scout: 'staff_role_scout',
      'Pilot Coach': 'staff_role_pilot_coach',
      'Commercial Dir.': 'staff_role_commercial_dir',
      'Data Analyst': 'staff_role_data_analyst',
      'Head of Pits': 'staff_role_head_of_pits',
      'Medic/Physio': 'staff_role_medic_physio'
    };
    const key = roleMap[roleLabel] || roleLabel;
    return __(key, roleLabel || '—');
  },

  normalizePitPlan(plan) {
    return plan === 'double' ? 'double' : 'single';
  },

  getPrimaryStopLapPct(strategy, fallback = 50) {
    if (Array.isArray(strategy?.interventions) && Number.isFinite(strategy.interventions[0]?.lapPct)) {
      return Math.max(10, Math.min(95, Math.round(strategy.interventions[0].lapPct)));
    }
    if (Number.isFinite(strategy?.pitLap)) {
      return Math.max(10, Math.min(95, Math.round(strategy.pitLap)));
    }
    return fallback;
  },

  stripHtmlTags(text) {
    return String(text || '').replace(/<[^>]*>/g, ' ');
  },

  normalizeEventSearchText(text) {
    return this.stripHtmlTags(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  },

  getPlayerEventPilotNames(playerCars = []) {
    return Array.from(new Set((Array.isArray(playerCars) ? playerCars : [])
      .map((car) => String(car?.pilotName || '').trim())
      .filter(Boolean)));
  },

  formatPitStrategySummary(strategy = {}) {
    const safeStrategy = strategy || {};
    const planLabel = this.getPitPlanLabel(safeStrategy.pitPlan || 'single');
    const firstStop = this.getPrimaryStopLapPct(safeStrategy, 50);
    const secondStop = Array.isArray(safeStrategy.interventions) && Number.isFinite(safeStrategy.interventions[1]?.lapPct)
      ? Math.max(firstStop + 8, Math.min(95, Math.round(safeStrategy.interventions[1].lapPct)))
      : Math.min(95, Math.max(firstStop + 20, 70));
    const pitTyres = Array.isArray(safeStrategy.pitTyres) ? safeStrategy.pitTyres : [];
    const tyreSummary = (safeStrategy.pitPlan === 'double'
      ? [pitTyres[0], pitTyres[1]]
      : [pitTyres[0]])
      .filter(Boolean)
      .map((tyre) => this.getCompoundLabel(tyre))
      .join(' -> ');
    const stopSummary = safeStrategy.pitPlan === 'double'
      ? `P1 ${firstStop}% · P2 ${secondStop}%`
      : `P1 ${firstStop}%`;
    return {
      planLabel,
      stopSummary,
      tyreSummary: tyreSummary || '—'
    };
  },

  isPlayerRelatedRaceEvent(eventText, playerPilotNames = []) {
    const haystack = this.normalizeEventSearchText(eventText);
    if (!haystack) return false;
    return playerPilotNames.some((pilotName) => haystack.includes(this.normalizeEventSearchText(pilotName)));
  },

  getWeatherLabel(weather) {
    if (weather === 'wet') return __('prerace_rain_expected', 'Rain Expected').replace('🌧️ ', '');
    if (weather === 'dry') return __('prerace_dry2', 'Dry').replace('☀️ ', '');
    return weather || '—';
  },

  getCalendarWeatherIndicator(race = {}) {
    const windows = Array.isArray(race.forecast?.windows)
      ? race.forecast.windows.filter((entry) => Number.isFinite(entry?.wetProb))
      : [];
    const wetAverage = windows.length
      ? (windows.reduce((sum, entry) => sum + Number(entry.wetProb || 0), 0) / windows.length)
      : (race.weather === 'wet' ? 70 : 25);
    const confidence = Number.isFinite(race.forecast?.confidence) ? Number(race.forecast.confidence) : 60;
    const likelyWet = wetAverage >= 66 && confidence >= 72;
    const likelyDry = wetAverage <= 34 && confidence >= 64;
    const icon = likelyWet ? '🌧️' : (likelyDry ? '☀️' : '⛅');
    const label = likelyWet
      ? __('prerace_rain_expected', 'Rain Expected')
      : (likelyDry ? __('prerace_dry2', 'Dry') : __('prerace_weather', 'Race weather'));
    const tooltip = `${label.replace(/^.?\s*/, '')} · ${Math.round(wetAverage)}% ${__('prerace_forecast_wet', 'chance of rain')} · ${confidence}%`;
    return { icon, tooltip, wetAverage, confidence };
  },

  getRaceTrackLayoutProfile(layout) {
    const profiles = {
      'high-speed': {
        points: [[122,108],[352,82],[676,90],[888,146],[926,240],[840,314],[676,300],[550,332],[650,432],[842,496],[726,558],[458,552],[248,508],[192,420],[286,348],[194,238],[96,210]],
        scaleX: 1.04,
        scaleY: 0.94
      },
      power: {
        points: [[112,120],[342,90],[662,84],[884,136],[926,232],[846,310],[686,304],[536,336],[622,432],[812,494],[706,552],[454,548],[246,502],[182,414],[278,338],[186,236],[98,214]],
        scaleX: 1.02,
        scaleY: 0.98
      },
      technical: {
        points: [[140,122],[332,96],[620,100],[852,154],[898,248],[812,310],[662,294],[560,334],[632,424],[786,492],[692,536],[470,536],[280,500],[220,424],[294,346],[214,250],[120,226]],
        scaleX: 0.96,
        scaleY: 1.04
      },
      mixed: {
        points: [[128,112],[352,86],[676,92],[892,152],[930,244],[842,318],[678,302],[548,336],[646,430],[836,496],[722,558],[456,552],[250,506],[190,420],[286,346],[192,238],[100,214]],
        scaleX: 1,
        scaleY: 1
      },
      endurance: {
        points: [[108,102],[338,78],[690,84],[914,142],[948,238],[856,322],[692,306],[530,328],[650,438],[876,504],[758,566],[460,560],[224,514],[166,416],[270,340],[172,234],[88,198]],
        scaleX: 1.08,
        scaleY: 0.92
      }
    };
    return profiles[layout] || profiles.mixed;
  },

  getRaceTrackControlPoints(layout) {
    const profile = this.getRaceTrackLayoutProfile(layout);
    return (profile.points || []).map(([x, y]) => ({
      x: (x - 500) * Number(profile.scaleX || 1) + 500,
      y: (y - 310) * Number(profile.scaleY || 1) + 310
    }));
  },

  getRaceTrackSplinePoint(points, index, t) {
    const total = points.length;
    const p0 = points[(index - 1 + total) % total];
    const p1 = points[index % total];
    const p2 = points[(index + 1) % total];
    const p3 = points[(index + 2) % total];
    const tt = t * t;
    const ttt = tt * t;
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + ((2 * p0.x) - (5 * p1.x) + (4 * p2.x) - p3.x) * tt + ((-p0.x) + (3 * p1.x) - (3 * p2.x) + p3.x) * ttt);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + ((2 * p0.y) - (5 * p1.y) + (4 * p2.y) - p3.y) * tt + ((-p0.y) + (3 * p1.y) - (3 * p2.y) + p3.y) * ttt);
    const dx = 0.5 * ((-p0.x + p2.x) + (2 * ((2 * p0.x) - (5 * p1.x) + (4 * p2.x) - p3.x) * t) + (3 * ((-p0.x) + (3 * p1.x) - (3 * p2.x) + p3.x) * tt));
    const dy = 0.5 * ((-p0.y + p2.y) + (2 * ((2 * p0.y) - (5 * p1.y) + (4 * p2.y) - p3.y) * t) + (3 * ((-p0.y) + (3 * p1.y) - (3 * p2.y) + p3.y) * tt));
    return { x, y, dx, dy };
  },

  getRaceTrackPoint(progress, layout, laneOffset = 0) {
    const points = this.getRaceTrackControlPoints(layout);
    if (!points.length) return { x: 500, y: 312 };
    const loop = ((Number(progress) % 1) + 1) % 1;
    const splineCursor = loop * points.length;
    const index = Math.floor(splineCursor) % points.length;
    const t = splineCursor - Math.floor(splineCursor);
    const splinePoint = this.getRaceTrackSplinePoint(points, index, t);
    const tangentLen = Math.max(0.001, Math.hypot(splinePoint.dx, splinePoint.dy));
    const nx = -splinePoint.dy / tangentLen;
    const ny = splinePoint.dx / tangentLen;
    return {
      x: splinePoint.x + (nx * laneOffset),
      y: splinePoint.y + (ny * laneOffset)
    };
  },

  getRacePitLanePoint(progress, layout) {
    const local = Math.max(0, Math.min(1, Number(progress) || 0));
    const profileMap = {
      'high-speed': { entryProgress: 0.885, exitProgress: 0.035, entryDx: 40, entryDy: -44, exitDx: 44, exitDy: -50, c1Dx: 136, c1Dy: -94, c2Dx: -62, c2Dy: -92 },
      power: { entryProgress: 0.89, exitProgress: 0.03, entryDx: 38, entryDy: -44, exitDx: 42, exitDy: -46, c1Dx: 128, c1Dy: -86, c2Dx: -58, c2Dy: -84 },
      technical: { entryProgress: 0.88, exitProgress: 0.04, entryDx: 34, entryDy: -40, exitDx: 36, exitDy: -44, c1Dx: 112, c1Dy: -74, c2Dx: -50, c2Dy: -76 },
      mixed: { entryProgress: 0.885, exitProgress: 0.032, entryDx: 36, entryDy: -42, exitDx: 40, exitDy: -46, c1Dx: 122, c1Dy: -82, c2Dx: -56, c2Dy: -80 },
      endurance: { entryProgress: 0.89, exitProgress: 0.03, entryDx: 42, entryDy: -48, exitDx: 48, exitDy: -54, c1Dx: 146, c1Dy: -102, c2Dx: -68, c2Dy: -96 }
    };
    const profile = profileMap[layout] || profileMap.mixed;
    const entryBase = this.getRaceTrackPoint(profile.entryProgress, layout, 10);
    const exitBase = this.getRaceTrackPoint(profile.exitProgress, layout, 8);
    const p0 = { x: entryBase.x + profile.entryDx, y: entryBase.y + profile.entryDy };
    const p3 = { x: exitBase.x + profile.exitDx, y: exitBase.y + profile.exitDy };
    const p1 = { x: p0.x + profile.c1Dx, y: p0.y + profile.c1Dy };
    const p2 = { x: p3.x + profile.c2Dx, y: p3.y + profile.c2Dy };
    const inv = 1 - local;
    const inv2 = inv * inv;
    const inv3 = inv2 * inv;
    const t2 = local * local;
    const t3 = t2 * local;
    return {
      x: (inv3 * p0.x) + (3 * inv2 * local * p1.x) + (3 * inv * t2 * p2.x) + (t3 * p3.x),
      y: (inv3 * p0.y) + (3 * inv2 * local * p1.y) + (3 * inv * t2 * p2.y) + (t3 * p3.y)
    };
  },

  getRacePathData(layout, laneOffset = 0, samples = 180, usePitLane = false) {
    const points = [];
    for (let idx = 0; idx <= samples; idx += 1) {
      const progress = idx / samples;
      const point = usePitLane
        ? this.getRacePitLanePoint(progress, layout)
        : this.getRaceTrackPoint(progress, layout, laneOffset);
      points.push(`${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
    }
    return usePitLane ? points.join(' ') : `${points.join(' ')} Z`;
  },

  getRaceTrackSceneryMarkup(layout) {
    const scenery = {
      'high-speed': {
        stands: [{ x: 210, y: 26, w: 540, h: 66 }],
        garages: [{ x: 144, y: 500, w: 560, h: 54 }, { x: 22, y: 516, w: 126, h: 42 }],
        buildings: [{ x: 38, y: 118, w: 72, h: 56 }, { x: 728, y: 510, w: 126, h: 34 }],
        lakes: [{ x: 38, y: 454, w: 128, h: 96 }],
        panels: [{ x: 782, y: 116, w: 120, h: 56 }]
      },
      power: {
        stands: [{ x: 182, y: 34, w: 590, h: 58 }],
        garages: [{ x: 154, y: 492, w: 580, h: 58 }],
        buildings: [{ x: 72, y: 440, w: 96, h: 46 }, { x: 772, y: 120, w: 104, h: 40 }],
        lakes: [{ x: 46, y: 446, w: 120, h: 88 }],
        panels: [{ x: 764, y: 112, w: 124, h: 58 }]
      },
      technical: {
        stands: [{ x: 192, y: 28, w: 520, h: 62 }],
        garages: [{ x: 188, y: 486, w: 520, h: 52 }],
        buildings: [{ x: 84, y: 194, w: 88, h: 42 }, { x: 756, y: 448, w: 116, h: 38 }],
        lakes: [{ x: 54, y: 456, w: 112, h: 84 }],
        panels: [{ x: 734, y: 108, w: 126, h: 52 }]
      },
      mixed: {
        stands: [{ x: 220, y: 22, w: 520, h: 70 }],
        garages: [{ x: 154, y: 500, w: 560, h: 52 }],
        buildings: [{ x: 44, y: 118, w: 96, h: 54 }, { x: 746, y: 500, w: 124, h: 36 }],
        lakes: [{ x: 30, y: 446, w: 138, h: 102 }],
        panels: [{ x: 742, y: 102, w: 132, h: 58 }, { x: 686, y: 486, w: 140, h: 58 }]
      },
      endurance: {
        stands: [{ x: 170, y: 18, w: 620, h: 66 }],
        garages: [{ x: 112, y: 504, w: 640, h: 48 }],
        buildings: [{ x: 58, y: 130, w: 88, h: 44 }, { x: 786, y: 450, w: 110, h: 44 }],
        lakes: [{ x: 28, y: 448, w: 146, h: 106 }],
        panels: [{ x: 768, y: 102, w: 136, h: 62 }]
      }
    };
    const selected = scenery[layout] || scenery.mixed;
    const treeNodes = [
      [86, 68], [120, 82], [870, 56], [924, 86], [84, 438], [146, 486],
      [816, 468], [878, 452], [724, 534], [304, 166], [392, 158], [610, 164]
    ].map(([x, y], idx) => `
      <g class="race-track-tree" transform="translate(${x} ${y}) scale(${0.8 + ((idx % 4) * 0.12)})">
        <circle class="race-track-tree-crown" cx="0" cy="0" r="16"></circle>
        <circle class="race-track-tree-crown" cx="-10" cy="8" r="10"></circle>
        <circle class="race-track-tree-crown" cx="12" cy="6" r="11"></circle>
        <rect class="race-track-tree-trunk" x="-2" y="12" width="4" height="12" rx="2"></rect>
      </g>`).join('');
    const stands = selected.stands.map((item) => `<g class="race-track-stand"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="8"></rect><path class="race-track-stand-grid" d="M ${item.x} ${item.y + 18} H ${item.x + item.w} M ${item.x} ${item.y + 40} H ${item.x + item.w}"></path></g>`).join('');
    const garages = selected.garages.map((item) => `<g class="race-track-garage"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="8"></rect><path class="race-track-garage-detail" d="M ${item.x + 20} ${item.y + item.h - 12} H ${item.x + item.w - 20}"></path></g>`).join('');
    const buildings = selected.buildings.map((item) => `<g class="race-track-building"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="6"></rect><g class="race-track-building-windows"><rect x="${item.x + 12}" y="${item.y + 12}" width="10" height="8" rx="2"></rect><rect x="${item.x + 30}" y="${item.y + 12}" width="10" height="8" rx="2"></rect><rect x="${item.x + 48}" y="${item.y + 12}" width="10" height="8" rx="2"></rect></g></g>`).join('');
    const lakes = (selected.lakes || []).map((item) => `<g class="race-track-lake"><path d="M ${item.x + 10} ${item.y + item.h * 0.4} C ${item.x - 4} ${item.y + item.h * 0.75}, ${item.x + item.w * 0.2} ${item.y + item.h}, ${item.x + item.w * 0.5} ${item.y + item.h * 0.92} C ${item.x + item.w * 0.9} ${item.y + item.h * 0.84}, ${item.x + item.w + 8} ${item.y + item.h * 0.5}, ${item.x + item.w * 0.82} ${item.y + item.h * 0.16} C ${item.x + item.w * 0.62} ${item.y - 4}, ${item.x + item.w * 0.24} ${item.y + 6}, ${item.x + 10} ${item.y + item.h * 0.4} Z"></path></g>`).join('');
    const panels = (selected.panels || []).map((item) => `<g class="race-track-solar"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="6"></rect><path d="M ${item.x + 8} ${item.y + 16} H ${item.x + item.w - 8} M ${item.x + 8} ${item.y + 28} H ${item.x + item.w - 8} M ${item.x + 8} ${item.y + 40} H ${item.x + item.w - 8}"></path></g>`).join('');
    return `${lakes}${stands}${garages}${buildings}${panels}${treeNodes}`;
  },

  getRaceCarSvgMarkup() {
    return `
      <svg class="race-car-svg" viewBox="0 0 64 120" aria-hidden="true">
        <rect class="race-car-wing rear" x="8" y="4" width="48" height="10" rx="3"></rect>
        <rect class="race-car-body" x="22" y="14" width="20" height="20" rx="7"></rect>
        <path class="race-car-body" d="M22 28 C22 22 42 22 42 28 L46 66 C47 74 48 82 52 92 L52 102 C52 106 49 109 44 109 L20 109 C15 109 12 106 12 102 L12 92 C16 82 17 74 18 66 Z"></path>
        <path class="race-car-stripe" d="M29 16 H35 L37 97 H27 Z"></path>
        <rect class="race-car-cockpit" x="25" y="38" width="14" height="26" rx="6"></rect>
        <rect class="race-car-wing front" x="12" y="100" width="40" height="9" rx="3"></rect>
        <path class="race-car-nose" d="M28 108 H36 L42 120 H22 Z"></path>
        <rect class="race-car-wheel fl" x="6" y="34" width="10" height="20" rx="3"></rect>
        <rect class="race-car-wheel fr" x="48" y="34" width="10" height="20" rx="3"></rect>
        <rect class="race-car-wheel rl" x="4" y="72" width="12" height="22" rx="3"></rect>
        <rect class="race-car-wheel rr" x="48" y="72" width="12" height="22" rx="3"></rect>
      </svg>`;
  },

  getRaceTrackStageMarkup(circuit, weather) {
    const layout = circuit?.layout || 'mixed';
    const roadPath = this.getRacePathData(layout, 0, 220, false);
    const centerPath = this.getRacePathData(layout, -1, 220, false);
    const pitPath = this.getRacePathData(layout, 0, 90, true);
    const innerIslandPath = this.getRacePathData(layout, -108, 220, false);
    const pitBoxes = Array.from({ length: 7 }).map((_, idx) => {
      const t = 0.16 + (idx * 0.1);
      const box = this.getRacePitLanePoint(t, layout);
      const ahead = this.getRacePitLanePoint(Math.min(1, t + 0.03), layout);
      const angle = Math.atan2(ahead.y - box.y, ahead.x - box.x) * (180 / Math.PI);
      return `<rect class="race-track-pit-box" x="${(box.x - 14).toFixed(1)}" y="${(box.y - 6).toFixed(1)}" width="28" height="12" rx="3" transform="rotate(${angle.toFixed(1)} ${box.x.toFixed(1)} ${box.y.toFixed(1)})"></rect>`;
    }).join('');
    const weatherLabel = this.getWeatherLabel(weather);
    return `
      <div class="race-track-stage ${weather === 'wet' ? 'wet-weather' : 'dry-weather'}" id="race-track-stage">
        <svg class="race-track-svg" viewBox="0 0 1000 620" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="race-track-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(0,0,0,0.24)"/>
            </filter>
          </defs>
          <rect class="race-track-grass" x="0" y="0" width="1000" height="620" rx="18" />
          ${this.getRaceTrackSceneryMarkup(layout)}
          <path class="race-track-runoff" d="${roadPath}" />
          <path class="race-track-island" d="${innerIslandPath}" />
          <path class="race-track-curb-outer" d="${roadPath}" />
          <path class="race-track-road-shadow" d="${roadPath}" />
          <path class="race-track-road" d="${roadPath}" />
          <path class="race-track-road-inner" d="${roadPath}" />
          <path class="race-track-curb-inner" d="${roadPath}" />
          <path class="race-track-centerline" d="${centerPath}" />
          <path class="race-track-racing-line" d="${centerPath}" />
          <path class="race-track-pitlane" d="${pitPath}" />
          <path class="race-track-pitlane-outline" d="${pitPath}" />
          <g class="race-track-pit-boxes">${pitBoxes}</g>
          <line class="race-track-finish" x1="820" y1="89" x2="820" y2="173" />
          <text class="race-track-pitlabel" x="784" y="72">PIT</text>
        </svg>
        <div class="race-track-cars" id="race-track-cars"></div>
        <div class="race-track-hud">
          <span class="race-track-chip" id="race-track-chip-layout">${this.getTrackLayoutLabel(layout)}</span>
          <span class="race-track-chip" id="race-track-chip-weather">${weather === 'wet' ? '🌧️' : '☀️'} ${weatherLabel}</span>
          <span class="race-track-chip" id="race-track-chip-pit">PIT 0</span>
          <span class="race-track-chip" id="race-track-chip-player">${__('standings_you')} P—/P—</span>
        </div>
      </div>`;
  },

  buildLiveRaceOrder({ lapSnapshots, currentLap, lapBlend = 0, finalGrid, startPosMap, finalPosMap, progress, tick }) {
    const safeBlend = Math.max(0, Math.min(1, Number(lapBlend) || 0));
    const previousSnapshot = currentLap > 1 ? lapSnapshots[currentLap - 2] : null;
    const targetSnapshot = lapSnapshots[currentLap - 1] || null;

    if (targetSnapshot && Array.isArray(targetSnapshot.order) && targetSnapshot.order.length) {
      const previousOrder = previousSnapshot && Array.isArray(previousSnapshot.order) && previousSnapshot.order.length
        ? previousSnapshot.order
        : finalGrid.map((car, idx) => ({
            ...car,
            pos: startPosMap[car.id] || (idx + 1),
            gapMs: Number.isFinite(car.gapMs) ? car.gapMs : ((startPosMap[car.id] || (idx + 1)) - 1) * 900,
            pit: false,
            pitLossMs: 0,
            retired: !!car.retired
          }));

      const previousMap = Object.fromEntries(previousOrder.map((car, idx) => [car.id, { ...car, pos: car.pos || (idx + 1) }]));
      const targetMap = Object.fromEntries(targetSnapshot.order.map((car, idx) => [car.id, { ...car, pos: car.pos || (idx + 1) }]));
      const allIds = Array.from(new Set([...Object.keys(previousMap), ...Object.keys(targetMap), ...finalGrid.map((car) => car.id)]));

      const interpolated = allIds.map((carId, idx) => {
        const fallback = finalGrid.find((car) => car.id === carId) || {};
        const sourceCar = previousMap[carId] || {
          ...fallback,
          id: carId,
          pos: startPosMap[carId] || (idx + 1),
          gapMs: ((startPosMap[carId] || (idx + 1)) - 1) * 900,
          pit: false,
          pitLossMs: 0,
          retired: !!fallback.retired
        };
        const nextCar = targetMap[carId] || sourceCar;
        const startPos = Number.isFinite(sourceCar.pos) ? sourceCar.pos : (startPosMap[carId] || (idx + 1));
        const endPos = Number.isFinite(nextCar.pos) ? nextCar.pos : startPos;
        const startGap = Number.isFinite(sourceCar.gapMs) ? sourceCar.gapMs : Math.max(0, (startPos - 1) * 900);
        const endGap = Number.isFinite(nextCar.gapMs) ? nextCar.gapMs : startGap;
        const wobble = Math.sin((tick * 0.45) + String(carId || '').length) * 0.14 * (1 - progress);
        const liveScore = (startPos * (1 - safeBlend)) + (endPos * safeBlend) + wobble;
        return {
          ...fallback,
          ...sourceCar,
          ...nextCar,
          pos: liveScore,
          displayPos: Math.round((startPos * (1 - safeBlend)) + (endPos * safeBlend)),
          gapMs: (startGap * (1 - safeBlend)) + (endGap * safeBlend),
          pit: !!sourceCar.pit || !!nextCar.pit,
          pitLossMs: safeBlend < 0.5 ? (sourceCar.pitLossMs || 0) : (nextCar.pitLossMs || 0),
          tyre: safeBlend < 0.58 ? (sourceCar.tyre || nextCar.tyre) : (nextCar.tyre || sourceCar.tyre),
          retired: !!sourceCar.retired || !!nextCar.retired
        };
      }).sort((a, b) => a.pos - b.pos);

      return interpolated.map((car, idx) => ({ ...car, pos: idx + 1, displayPos: idx + 1 }));
    }

    return finalGrid.map((car) => {
      const startPos = startPosMap[car.id] || 20;
      const endPos = finalPosMap[car.id] || startPos;
      const wobble = Math.sin((tick * 0.45) + (car.id || '').length) * 0.35 * (1 - progress);
      const score = (startPos * (1 - progress)) + (endPos * progress) + wobble;
      return { ...car, pos: score, displayPos: Math.round(score) };
    }).sort((a, b) => a.pos - b.pos).map((car, idx) => ({ ...car, pos: idx + 1, displayPos: idx + 1 }));
  },

  renderRaceTrackVisualization({ liveOrder, progress, totalLaps, currentLap, circuit, weather }) {
    const carsLayer = document.getElementById('race-track-cars');
    if (!carsLayer) return;

    const trackStage = document.getElementById('race-track-stage');
    if (trackStage) {
      trackStage.classList.toggle('wet-weather', weather === 'wet');
      trackStage.classList.toggle('dry-weather', weather !== 'wet');
    }

    const weatherChip = document.getElementById('race-track-chip-weather');
    const pitChip = document.getElementById('race-track-chip-pit');
    const playerChip = document.getElementById('race-track-chip-player');
    if (weatherChip) weatherChip.textContent = `${weather === 'wet' ? '🌧️' : '☀️'} ${this.getWeatherLabel(weather)}`;

    const intraLapProgress = (progress * totalLaps) % 1;
    const layout = circuit?.layout || 'mixed';
    const estimatedLeaderLapMs = Math.max(76000, Number((circuit?.laps || 60) * 1450));
    const cars = (Array.isArray(liveOrder) ? liveOrder : []).slice(0, 20);
    const activePitCars = cars.filter((car) => !!car?.pit).length;
    if (pitChip) pitChip.textContent = `PIT ${activePitCars}`;
    const teamCars = cars
      .filter((car) => car?.isPlayer)
      .sort((a, b) => Number(a?.displayPos || a?.pos || 99) - Number(b?.displayPos || b?.pos || 99));
    if (playerChip) {
      if (teamCars.length >= 2) {
        const p1 = Math.max(1, Math.round(teamCars[0].displayPos || teamCars[0].pos || 1));
        const p2 = Math.max(1, Math.round(teamCars[1].displayPos || teamCars[1].pos || 2));
        playerChip.textContent = `${__('standings_you')} P${p1}/P${p2}`;
      } else if (teamCars.length === 1) {
        const p = Math.max(1, Math.round(teamCars[0].displayPos || teamCars[0].pos || 1));
        playerChip.textContent = `${__('standings_you')} P${p}`;
      } else {
        playerChip.textContent = `${__('standings_you')} P—`;
      }
    }

    if (!this._raceVisualState || typeof this._raceVisualState !== 'object') {
      this._raceVisualState = {};
    }
    const visualState = this._raceVisualState;
    const seenIds = new Set();

    carsLayer.innerHTML = cars.map((car, idx) => {
      const carId = String(car.id || `car-${idx}`);
      seenIds.add(carId);
      const stateEntry = visualState[carId] || { x: null, y: null, pitProgress: 0, onPitLane: false };

      let point;
      let aheadPoint;
      if (car.retired) {
        const retiredPoint = { x: 120 + ((idx % 5) * 40), y: 524 + (Math.floor(idx / 5) * 24) };
        point = retiredPoint;
        aheadPoint = { x: retiredPoint.x + 8, y: retiredPoint.y };
      } else {
        const gapFraction = Number.isFinite(car.gapMs) ? (car.gapMs / estimatedLeaderLapMs) : (idx * 0.014);
        const trackProgress = intraLapProgress - gapFraction;
        const laneOffset = ((idx % 3) - 1) * 3.1;
        const trackPoint = this.getRaceTrackPoint(trackProgress, layout, laneOffset);
        const trackAheadPoint = this.getRaceTrackPoint(trackProgress + 0.008, layout, laneOffset);

        if (car.pit) {
          const pitGain = 0.09 + Math.min(0.06, Number(car.pitLossMs || 0) / 56000);
          stateEntry.pitProgress = Math.min(1, (stateEntry.pitProgress || 0) + pitGain);
          stateEntry.onPitLane = true;
        } else if (stateEntry.onPitLane && (stateEntry.pitProgress || 0) < 1) {
          stateEntry.pitProgress = Math.min(1, (stateEntry.pitProgress || 0) + 0.16);
          if (stateEntry.pitProgress >= 0.999) {
            stateEntry.onPitLane = false;
            stateEntry.pitProgress = 0;
          }
        } else {
          stateEntry.onPitLane = false;
          stateEntry.pitProgress = 0;
        }

        if (stateEntry.onPitLane) {
          point = this.getRacePitLanePoint(stateEntry.pitProgress, layout);
          aheadPoint = this.getRacePitLanePoint(Math.min(1, stateEntry.pitProgress + 0.025), layout);
        } else {
          const prevX = Number.isFinite(stateEntry.x) ? stateEntry.x : trackPoint.x;
          const prevY = Number.isFinite(stateEntry.y) ? stateEntry.y : trackPoint.y;
          point = {
            x: (prevX * 0.72) + (trackPoint.x * 0.28),
            y: (prevY * 0.72) + (trackPoint.y * 0.28)
          };
          aheadPoint = trackAheadPoint;
        }
      }

      stateEntry.x = point.x;
      stateEntry.y = point.y;
      visualState[carId] = stateEntry;

      const angle = (Math.atan2(aheadPoint.y - point.y, aheadPoint.x - point.x) * (180 / Math.PI)) + 90;
      const tyreMeta = this.getTyreMeta(car.tyre);
      const label = car.isPlayer || idx < 3 ? `<span class="race-car-label">P${Math.max(1, Math.round(car.displayPos || car.pos || (idx + 1)))}</span>` : '';
      return `
        <div class="race-car-marker ${car.isPlayer ? 'player' : ''} ${stateEntry.onPitLane ? 'pit' : ''} ${car.retired ? 'retired' : ''}" title="${car.name || car.pilotName || 'Car'}"
             style="left:${(point.x / 10).toFixed(2)}%;top:${(point.y / 6.2).toFixed(2)}%;--car-angle:${angle.toFixed(1)}deg;--car-color:${car.color || '#888'};--tyre-color:${tyreMeta.color}">
          ${this.getRaceCarSvgMarkup()}
          ${label}
        </div>`;
    }).join('');

    Object.keys(visualState).forEach((id) => {
      if (!seenIds.has(id)) delete visualState[id];
    });
  },

  getDriverStrategyDefaults(sharedStrategy, currentConfig = {}) {
    const basePitTyres = Array.isArray(currentConfig.pitTyres)
      ? currentConfig.pitTyres
      : (Array.isArray(sharedStrategy.pitTyres) ? sharedStrategy.pitTyres : []);
    const baseSetup = (currentConfig.setup && typeof currentConfig.setup === 'object')
      ? currentConfig.setup
      : ((sharedStrategy.setup && typeof sharedStrategy.setup === 'object') ? sharedStrategy.setup : {});
    const sourceInterventions = Array.isArray(currentConfig.interventions) && currentConfig.interventions.length
      ? currentConfig.interventions
      : (Array.isArray(sharedStrategy.interventions) ? sharedStrategy.interventions : []);
    const defaultPitLap = this.getPrimaryStopLapPct(
      currentConfig,
      this.getPrimaryStopLapPct(sharedStrategy, 50)
    );
    return this.syncDriverStopWindows({
      tyre: currentConfig.tyre || sharedStrategy.tyre || 'medium',
      aggression: Number.isFinite(currentConfig.aggression) ? currentConfig.aggression : (sharedStrategy.aggression || 50),
      riskLevel: Number.isFinite(currentConfig.riskLevel) ? currentConfig.riskLevel : (sharedStrategy.riskLevel || 40),
      pitLap: defaultPitLap,
      engineMode: currentConfig.engineMode || sharedStrategy.engineMode || 'normal',
      pitPlan: this.normalizePitPlan(currentConfig.pitPlan || sharedStrategy.pitPlan || 'single'),
      strategy: currentConfig.strategy || sharedStrategy.strategy || 'balanced',
      pitTyres: [basePitTyres[0] || 'hard', basePitTyres[1] || 'medium'],
      safetyCarReaction: currentConfig.safetyCarReaction || sharedStrategy.safetyCarReaction || 'live',
      setup: {
        aeroBalance: Number.isFinite(baseSetup.aeroBalance) ? baseSetup.aeroBalance : 50,
        wetBias: Number.isFinite(baseSetup.wetBias) ? baseSetup.wetBias : 50
      },
      interventions: [0, 1].map((idx) => ({
        lapPct: Number.isFinite(sourceInterventions[idx]?.lapPct) ? sourceInterventions[idx].lapPct : (idx === 0 ? defaultPitLap : 70),
        pitBias: 'none'
      }))
    });
  },

  syncDriverStopWindows(cfg) {
    if (!cfg) return cfg;
    const clampPct = (value, fallback) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(10, Math.min(95, Math.round(n)));
    };
    if (!Array.isArray(cfg.interventions)) {
      cfg.interventions = [{ lapPct: cfg.pitLap || 50, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }];
    }
    const firstLapPct = clampPct(this.getPrimaryStopLapPct(cfg, 50), 50);
    const secondFallback = Math.min(95, Math.max(firstLapPct + 20, 70));
    const secondLapPct = Math.max(firstLapPct + 8, clampPct(cfg.interventions[1]?.lapPct, secondFallback));
    cfg.pitLap = firstLapPct;
    cfg.interventions = [
      {
        lapPct: firstLapPct,
        pitBias: 'none'
      },
      {
        lapPct: Math.min(95, secondLapPct),
        pitBias: 'none'
      }
    ];
    return cfg;
  },


  // ===== GARAGE SCREEN (HQ) =====
  renderGarage() {
    const state = GL_STATE.getState();
    const hqLevels = state.hq || { wind_tunnel: 1, rnd: 1, factory: 1, academy: 1, admin: 1 };
    const caps = GL_ENGINE.getHqCapabilities ? GL_ENGINE.getHqCapabilities(state) : null;
    const c = state.construction || { active: false };
    const engineSup = state.team.engineSupplier ? GL_DATA.ENGINE_SUPPLIERS.find(e => e.id === (state.team.engineSupplier || '').toLowerCase()) : null;
    
    const el = document.getElementById('screen-garage');
    if (!el) return;
    
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">Motor Empire Infraestructura</div>
          <div class="screen-title">Cuartel General (HQ)</div>
          <div class="screen-subtitle">Invierte tus Dólares ME en edificios para ganar ventaja técnica a lo largo de la temporada.</div>
        </div>
        ${engineSup ? `
        <div class="card" style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4);border-color:${engineSup.color}66;background:${engineSup.color}11">
           <div style="font-size:2rem">⚙️</div>
           <div>
              <div style="font-size:0.75rem;color:var(--t-secondary)">Motor Oficial</div>
              <div style="font-weight:700;color:${engineSup.color}">${engineSup.name}</div>
           </div>
        </div>` : ''}
      </div>
      
      <div class="garage-layout">
        <div class="garage-map">
          <div class="garage-map-bg"></div>
          <div class="garage-grid-overlay"></div>
          <div class="section-eyebrow" style="position:relative;z-index:2">Instalaciones Físicas · ${state.team.name || ''}</div>
          
          <div class="garage-buildings mt-auto" style="position:relative;z-index:2;margin-top:var(--s-5)">
            ${GL_DATA.FACILITIES.map(def => {
              const currentLevel = hqLevels[def.id] || 0;
              const nextLevelData = def.levels[currentLevel];
              const isUpgrading = c.active && c.buildingId === def.id;
              const impactText = this.getHqUpgradeImpactText(state, def, currentLevel);
              let contentHtml = '';
              
              if (isUpgrading) {
                // Show real-time progress bar
                contentHtml = `
                  <div class="building-upgrade-bar"><div class="building-upgrade-fill" id="hq-fill-${def.id}" style="width:0%"></div></div>
                  <div style="display:flex;justify-content:space-between;font-size:0.65rem;margin-top:2px;">
                     <span style="color:var(--c-gold)">Construyendo Lv${currentLevel+1}</span>
                     <span id="hq-time-${def.id}">--:--</span>
                  </div>
                `;
              } else if (nextLevelData) {
                // Determine if we can afford it
                const canAfford = state.finances.credits >= nextLevelData.cost;
                const canStart = !c.active && canAfford;
                const durationMins = Math.round(nextLevelData.durationMs / 60000);
                let durationStr = durationMins > 60 ? `${Math.round(durationMins/60)}h` : `${durationMins}m`;
                if((state.team.engineSupplier || '').toLowerCase() === 'vulcan') durationStr += ' (-15%)';
                
                contentHtml = `
                  <button class="btn btn-secondary btn-sm ${!canStart ? 'disabled' : ''}" 
                          onclick="GL_SCREENS.upgradeBuilding('${def.id}', ${nextLevelData.cost}, ${nextLevelData.durationMs}, ${currentLevel+1})" 
                          style="font-size:0.7rem;padding:6px;width:100%;margin-top:var(--s-2)">
                    Nv${currentLevel+1} · ${GL_UI.fmtCR(nextLevelData.cost)} CR · ⏱️ ${durationStr}
                  </button>
                `;
              } else {
                contentHtml = `<span class="badge badge-gold" style="width:100%;display:block;text-align:center;margin-top:var(--s-2)">NIVEL MÁXIMO</span>`;
              }

              return `<div class="building-tile ${isUpgrading?'upgrading':''}">
                <div class="building-icon">${def.icon}</div>
                <div class="building-name">${def.name}</div>
                <div class="building-level">
                  ${Array.from({length:def.maxLevel}).map((_,i) => `<div class="building-level-dot ${i<currentLevel?'filled':''}"></div>`).join('')}
                </div>
                <div style="font-size:0.72rem;color:var(--t-secondary);text-align:center;line-height:1.35;min-height:34px;margin-top:6px">${impactText}</div>
                ${contentHtml}
              </div>`;
            }).join('')}
          </div>
        </div>
        
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">Motor Empire Buffs</div>
            <div class="section-title mb-4" style="font-size:1.1rem">Capacidades del Cuartel</div>
            ${caps ? `
              <div style="font-size:0.78rem;color:var(--t-secondary);margin-bottom:var(--s-3)">
                Sponsors: +${Math.round((caps.sponsorMultiplier - 1) * 100)}% ·
                I+D desbloqueado: ${caps.rndUnlocked ? 'Si' : 'No'} ·
                Velocidad I+D: +${Math.round((caps.rndSpeedMultiplier - 1) * 100)}% ·
                Entrenamientos simultaneos: ${caps.academyTrainingSlots}
              </div>
            ` : ''}
            ${GL_DATA.FACILITIES.map(def => {
              const currentLevel = hqLevels[def.id] || 0;
              const curData = def.levels[currentLevel - 1];
              return curData ? `<div style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-3);">
                <span style="font-size:1.5rem">${def.icon}</span>
                <div><div style="font-size:0.85rem;font-weight:700">${def.name} · Lv${currentLevel}</div>
                <div style="font-size:0.75rem;color:var(--t-secondary)">${curData.effect}</div></div></div>` : '';
            }).join('')}
          </div>
          
          <div class="card">
            <div class="section-eyebrow">Gestión de Construcción</div>
            <div class="section-title mb-2">Pase Mensual VIP</div>
            <p style="font-size:0.8rem;color:var(--t-secondary);margin-bottom:var(--s-3)">Acelera la construcción instantáneamente usando Tokens, o despacha 2 mejoras simultáneas con el Pase VIP.</p>
            ${c.active ? `
              <button class="btn btn-gold w-full" onclick="GL_SCREENS.showBoostModal()">
                ⚡ Acelerar ${GL_DATA.FACILITIES.find(f=>f.id===c.buildingId)?.name} (5 Tokens)
              </button>
            ` : `
              <button class="btn btn-secondary w-full disabled">Sin construcciones activas</button>
            `}
          </div>
        </div>
      </div>`;
      
      // Start live timer loop if construction is active
      if (c.active && !this._hqTimer) {
         this._hqTimer = setInterval(() => this.updateHqTimers(), 1000);
      } else if (!c.active && this._hqTimer) {
         clearInterval(this._hqTimer);
         this._hqTimer = null;
      }
      this.updateHqTimers(); // manual initial call
  },
  
  updateHqTimers() {
     const c = GL_STATE.getConstruction();
     if (!c || !c.active) return;
     const now = Date.now();
     const remainingMs = (c.startTime + c.durationMs) - now;
     
     const fillEl = document.getElementById(`hq-fill-${c.buildingId}`);
     const timeEl = document.getElementById(`hq-time-${c.buildingId}`);
     
     if (remainingMs <= 0) {
        // Complete! Engine will catch it next tick
        if(fillEl) fillEl.style.width = '100%';
        if(timeEl) timeEl.textContent = 'Completado';
        return;
     }
     
     if (fillEl) {
        let pct = ((now - c.startTime) / c.durationMs) * 100;
        fillEl.style.width = Math.min(100, pct) + '%';
     }
     
     if (timeEl) {
        const h = Math.floor(remainingMs / 3600000);
        const m = Math.floor((remainingMs % 3600000) / 60000);
        const s = Math.floor((remainingMs % 60000) / 1000);
        timeEl.textContent = `${h>0?h+'h ':''}${m}m ${s}s`;
     }
  },

  upgradeBuilding(id, cost, durationMs, targetLevel) {
    const result = GL_ENGINE.startHqUpgrade(id, cost, durationMs, targetLevel, false);
    if (result.ok) {
      GL_UI.toast(`🏗️ Construcción iniciada.`, 'success');
      this.renderGarage();
      GL_DASHBOARD.refresh();
    } else {
      GL_UI.toast(result.msg, 'warning');
    }
  },

  showBoostModal() {
    GL_UI.confirm('Acelerar Construcción', '¿Usar 5 Tokens para acortar el tiempo restante de construcción al 30% del original?', 'Gastar 5 Tokens ⚡', 'Cancelar').then(ok => {
      if (!ok) return;
      if (!GL_STATE.spendTokens(5)) { GL_UI.toast('¡Tokens insuficientes!', 'error'); return; }
      const c = GL_STATE.getConstruction();
      if(c && c.active) {
         const remaining = (c.startTime + c.durationMs) - Date.now();
         if (remaining > 0) {
            c.durationMs = c.durationMs - Math.floor(remaining * 0.7); // cut 70% of remaining time
            GL_STATE.saveState();
            if (window.GL_DASHBOARD && typeof window.GL_DASHBOARD.updateTopbar === 'function') {
              window.GL_DASHBOARD.updateTopbar(GL_STATE.getState());
            }
            GL_UI.toast('⚡ ¡Construcción acelerada!', 'success');
            this.renderGarage();
         }
      }
    });
  },

  computePilotMarketSalary(pilot) {
    const overall = GL_ENGINE.pilotScore(pilot);
    const potential = Number(pilot?.potential) || overall;
    const weighted = (overall * 0.7) + (potential * 0.3);
    return Math.max(6000, Math.round(weighted * 230));
  },

  // ===== PILOTS SCREEN =====
  renderPilots() {
    const state = GL_STATE.getState();
    const pilots = state.pilots || [];
    const el = document.getElementById('screen-pilots');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('pilots_eyebrow')}</div>
          <div class="screen-title">${__('pilots_title')}</div>
          <div class="screen-subtitle">${__('pilots_subtitle')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('market')">${__('pilots_transfer_market')}</button>
        </div>
      </div>
      <div class="pilot-roster-grid">
        ${pilots.map(p => this.fullPilotCard(p, state)).join('')}
        ${pilots.length < 3 ? `<div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;text-align:center;border-style:dashed;cursor:pointer" onclick="GL_APP.navigateTo('market')">
          <div style="font-size:2.5rem;margin-bottom:var(--s-3)">➕</div>
          <div style="font-weight:600">${__('pilots_sign_new')}</div>
          <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:var(--s-2)">${__('pilots_find_talent')}</div>
        </div>` : ''}
      </div>`;
  },

  fullPilotCard(p, state) {
    const overall = GL_ENGINE.pilotScore(p);
    const bgColor = state.team.colors.primary;
    const now = (window.GL_ENGINE && typeof window.GL_ENGINE.getNowDate === 'function') ? window.GL_ENGINE.getNowDate() : new Date();
    const lastDate = p.lastTrained ? new Date(p.lastTrained) : new Date(0);
    const canTrain = lastDate.toDateString() !== now.toDateString();

    return `
      <div class="pilot-full-card">
        <div class="pilot-full-header" style="background:linear-gradient(135deg,${bgColor}22,var(--c-surface-2))">
          <div class="pilot-full-avatar" style="background:${bgColor}33;font-size:2.5rem">${p.emoji||'🧑'}</div>
          <div>
            <div class="pilot-full-name">${p.name}</div>
            <div class="pilot-full-meta">${p.nat} · ${__('age')} ${p.age}</div>
            <span class="badge badge-orange">${__('overall')}: ${overall}</span>
          </div>
          <div class="pilot-full-number">${p.number||'77'}</div>
        </div>
        <div class="pilot-full-body">
          <div class="section-eyebrow" style="margin-bottom:var(--s-3)">${__('pilots_attrs')}</div>
          <div class="pilot-full-attrs">
            ${GL_UI.statBar(__('pilots_qualifying'), p.attrs.pace)}
            ${GL_UI.statBar(__('pilots_race'), p.attrs.racePace)}
            ${GL_UI.statBar(__('pilots_consistency'), p.attrs.consistency)}
            ${GL_UI.statBar(__('pilots_rain'), p.attrs.rain, 99, 'blue')}
            ${GL_UI.statBar(__('pilots_tyre'), p.attrs.tyre, 99, 'green')}
            ${GL_UI.statBar(__('pilots_mental'), p.attrs.mental, 99, 'purple')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:var(--s-4)">
            <div><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_salary')}</div><div style="font-family:var(--font-display);font-weight:800;color:var(--c-gold)">${GL_UI.fmtCR(p.salary)}${__('per_week')}</div></div>
            <div style="text-align:center"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_contract')}</div><div style="font-family:var(--font-display);font-weight:800">${p.contractWeeks||20}${__('market_weeks').substring(0,2)}</div></div>
            <div style="text-align:center"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_potential')}</div><div style="font-family:var(--font-display);font-weight:800;color:var(--c-purple)">${p.potential}%</div></div>
          </div>
          <div style="margin-top:var(--s-4)">${GL_UI.progressBar(p.morale||75,100,'green')}</div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--t-tertiary);margin-top:4px"><span>${__('pilots_morale')}</span><span>${p.morale||75}/100</span></div>
          <button class="btn w-full mt-4 ${canTrain ? 'btn-secondary' : ''}" onclick="GL_ENGINE.trainPilot('${p.id}')" ${canTrain ? '' : 'disabled'}>
            ${canTrain ? '🏋️ ' + (__('pilots_train')||'Train') : '⏳ ' + (__('pilots_trained_today')||'Trained')}
          </button>
          <button class="btn btn-ghost w-full mt-2" onclick="GL_SCREENS.dismissPilot('${p.id}')">${__('pilots_dismiss_btn') || 'Despedir piloto'}</button>
        </div>
      </div>`;
  },

  dismissPilot(id) {
    const state = GL_STATE.getState();
    const pilots = state.pilots || [];
    const pilot = pilots.find((p) => p.id === id);
    if (!pilot) return;
    if (pilots.length <= 1) {
      GL_UI.toast(__('pilots_dismiss_last_blocked') || 'No puedes despedir al ultimo piloto del equipo.', 'warning');
      return;
    }

    const severance = Number(pilot.salary || 0);
    const title = __('pilots_dismiss_confirm_title') || 'Despedir piloto';
    const msg = (__('pilots_dismiss_confirm_msg') || 'Si despides a {name}, debes pagar un sueldo completo ({amount}).')
      .replace('{name}', pilot.name || __('pilots_title'))
      .replace('{amount}', `${GL_UI.fmtCR(severance)} CR`);
    const okLabel = __('pilots_dismiss_confirm_ok') || 'Despedir y pagar';
    const cancelLabel = __('btn_cancel') || 'Cancelar';

    GL_UI.confirm(title, msg, okLabel, cancelLabel).then((confirmed) => {
      if (!confirmed) return;
      if (!GL_STATE.spendCredits(severance)) {
        GL_UI.toast(__('pilots_dismiss_insufficient') || 'Saldo insuficiente para pagar la indemnizacion.', 'warning');
        return;
      }
      if (typeof GL_STATE.addCashflowAdjustment === 'function') {
        GL_STATE.addCashflowAdjustment(-Math.abs(severance), 'pilot_severance', {
          week: Number(state?.season?.week || 1),
          note: pilot.name || ''
        });
      }

      state.pilots = (state.pilots || []).filter((p) => p.id !== id);
      if (window._raceStrategy && Array.isArray(window._raceStrategy.selectedPilotIds)) {
        window._raceStrategy.selectedPilotIds = window._raceStrategy.selectedPilotIds.filter((pid) => pid !== id);
        if (window._raceStrategy.driverConfigs && window._raceStrategy.driverConfigs[id]) {
          delete window._raceStrategy.driverConfigs[id];
        }
      }
      GL_STATE.addLog(`👋 ${(pilot.name || 'Pilot')} ${__('pilots_dismissed_log') || 'was dismissed'} (${GL_UI.fmtCR(severance)} CR).`, 'warning');
      GL_STATE.saveState();
      if (window.GL_DASHBOARD && typeof window.GL_DASHBOARD.updateTopbar === 'function') {
        window.GL_DASHBOARD.updateTopbar(GL_STATE.getState());
      }
      GL_UI.toast((__('pilots_dismissed_toast') || '{name} despedido.').replace('{name}', pilot.name || 'Piloto'), 'info');
      this.renderPilots();
    });
  },

  // ===== STAFF SCREEN =====
  renderStaff() {
    const state = GL_STATE.getState();
    const staff = state.staff || [];
    const el = document.getElementById('screen-staff');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('staff_eyebrow')}</div>
          <div class="screen-title">${__('staff_title')}</div>
          <div class="screen-subtitle">${__('staff_subtitle')}</div>
        </div>
      </div>
      <div class="grid-2 mb-6">
        ${staff.map(s => `
          <div class="card card-hover flex gap-4">
            <div class="icon-circle ${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'green'}" style="width:52px;height:52px;font-size:1.5rem">${s.emoji||'👤'}</div>
            <div style="flex:1">
              <div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem">${s.name}</div>
              <div style="font-size:0.75rem;color:var(--t-secondary);margin-bottom:var(--s-2)">${this.getStaffRoleLabel(s.role)} · ${s.nat}</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}">${s.rarity||'common'}</span>
              <div style="margin-top:var(--s-3);font-size:0.75rem;color:var(--t-tertiary)">${s.bio||''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:var(--font-display);font-weight:800;color:var(--c-gold)">${GL_UI.fmtCR(s.salary)}</div>
              <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('staff_week')}</div>
            </div>
          </div>`).join('')}
        <div class="card" style="display:flex;align-items:center;justify-content:center;text-align:center;border-style:dashed;min-height:100px;cursor:pointer" onclick="GL_SCREENS.showHireStaff()">
          <div><div style="font-size:1.5rem">➕</div><div style="font-weight:600;margin-top:var(--s-2)">${__('staff_hire')}</div></div>
        </div>
      </div>`;
  },

  showHireStaff() {
    const available = GL_DATA.STAFF_POOL.filter(s => !GL_STATE.getState().staff.find(st=>st.id===s.id));
    GL_UI.openModal({ title: __('staff_hire'), size: 'lg', content: `
      <div style="display:flex;flex-direction:column;gap:var(--s-3)">
        ${available.map(s => `
          <div class="market-pilot-row" onclick="GL_SCREENS.hireStaff('${s.id}', this.closest('.modal-overlay'))">
            <div class="market-pilot-avatar" style="font-size:1.5rem">${s.emoji||'👤'}</div>
            <div class="market-pilot-info">
              <div class="market-pilot-name">${s.name}</div>
              <div class="market-pilot-meta">${this.getStaffRoleLabel(s.role)} · ${s.nat}</div>
              <div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:4px">${s.bio||''}</div>
            </div>
            <div class="market-pilot-salary"><div class="market-pilot-salary-val">${GL_UI.fmtCR(s.salary)}/wk</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}">${s.rarity}</span></div>
          </div>`).join('')}
      </div>` });
  },

  hireStaff(id, overlay) {
    const s = GL_DATA.STAFF_POOL.find(s=>s.id===id);
    if (!s) return;
    GL_STATE.getState().staff.push(GL_STATE.deepClone(s));
    GL_STATE.addLog(`👥 ${__('staff_joined_as', '{name} joined as {role}.').replace('{name}', s.name).replace('{role}', this.getStaffRoleLabel(s.role))}`, 'good');
    GL_STATE.saveState();
    overlay?.remove();
    GL_UI.toast(`${s.name} ${__('staff_hired')}`, 'success');
    this.renderStaff();
  },

  // ===== CAR DEV SCREEN =====
  renderCar() {
    const state = GL_STATE.getState();
    const car = state.car;
    const el = document.getElementById('screen-car');
    if (!el) return;
    const total = Math.round(Object.values(car.components).reduce((s,c)=>s+c.score,0)/Object.keys(car.components).length);
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('car_eyebrow')}</div>
          <div class="screen-title">${__('car_title')}</div>
          <div class="screen-subtitle">${__('car_subtitle')}</div>
        </div>
        <div class="screen-actions"><button class="btn btn-primary" onclick="GL_SCREENS.showRnD()">${__('car_start_rnd')}</button></div>
      </div>
      <div class="car-layout">
        <div>
          <div class="car-visual card" style="margin-bottom:var(--s-5)">
            <div class="car-display-text">${state.team.name||'GL'}</div>
            <div>
              <div class="car-name-display" style="color:${state.team.colors.primary}">${car.name}</div>
              <div style="text-align:center;margin-top:var(--s-2)">
                <span class="badge badge-blue">${__('car_overall')}: ${total}/99</span>
              </div>
              ${GL_UI.progressBar(total, 99, 'blue')}
            </div>
          </div>
          <div class="car-stats-grid">
            ${Object.entries(car.components).map(([key, c]) => {
              const labels = { engine:__('car_engine'),chassis:__('car_chassis'),aero:__('car_aero'),tyreManage:__('car_tyre_manage'),brakes:__('car_brakes'),gearbox:__('car_gearbox'),reliability:__('car_reliability'),efficiency:__('car_efficiency') };
              const icons  = { engine:'⚙️',chassis:'🔩',aero:'💨',tyreManage:'🏎️',brakes:'🛑',gearbox:'⚡',reliability:'🛡️',efficiency:'⛽' };
              const colors = { engine:'red',chassis:'blue',aero:'blue',tyreManage:'green',brakes:'red',gearbox:'orange',reliability:'green',efficiency:'gold' };
              return `<div class="car-stat-block">
                <div class="car-stat-name">${icons[key]||''} ${labels[key]||key}</div>
                <div class="car-stat-val">${c.score}<span style="font-size:0.75rem;color:var(--t-tertiary)">/99</span></div>
                <div class="car-stat-bar">${GL_UI.progressBar(c.score,99,colors[key]||'')}</div>
                <div style="font-size:0.7rem;color:var(--t-tertiary);margin-top:4px">Lv ${c.level}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">${__('car_quick_upgrades')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('car_spend_credits')}</div>
            ${Object.entries(car.components).map(([key, c]) => {
              const labels = { engine:__('car_engine'),chassis:__('car_chassis'),aero:__('car_aero'),tyreManage:__('car_tyre_manage'),brakes:__('car_brakes'),gearbox:__('car_gearbox'),reliability:__('car_reliability'),efficiency:__('car_efficiency') };
              const cost = 5000 + c.level * 3000;
              return `<div class="finance-row">
                <span class="finance-row-label">${labels[key]}</span>
                <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.upgradeCarComp('${key}')">+3 · ${GL_UI.fmtCR(cost)} CR</button>
              </div>`;
            }).join('')}
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('car_rnd_points')}</div>
            <div class="stat-card-value" style="font-size:1.4rem">${car.rnd.points || 0}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:4px">${__('car_rnd_desc')}</div>
          </div>
        </div>
      </div>`;
  },

  upgradeCarComp(key) {
    const car = GL_STATE.getCar();
    const cost = 5000 + car.components[key].level * 3000;
    if (!GL_STATE.spendCredits(cost)) { GL_UI.toast('Not enough credits', 'warning'); return; }
    car.components[key].score = Math.min(99, car.components[key].score + 3);
    car.components[key].level++;
    GL_STATE.addLog(`⚙️ ${key} upgraded +3 points`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${key} improved!`, 'success');
    this.renderCar();
    GL_DASHBOARD.refresh();
  },

  showRnD() {
    const state = GL_STATE.getState();
    const caps = GL_ENGINE.getHqCapabilities ? GL_ENGINE.getHqCapabilities(state) : null;
    if (!caps || !caps.rndUnlocked) {
      GL_UI.toast(__('car_rnd_unlock'), 'info');
      return;
    }

    const trees = GL_ENGINE.getResearchStatus ? GL_ENGINE.getResearchStatus() : [];
    const toTime = (ms) => {
      const h = Math.max(1, Math.round(ms / 3600000));
      return h >= 24 ? `${Math.round(h / 24)}d` : `${h}h`;
    };

    GL_UI.openModal({
      title: 'Centro de I+D',
      content: `
        <div style="display:grid;gap:12px;max-height:60vh;overflow:auto;">
          ${trees.map(t => {
            const locked = !t.unlocked;
            const canStart = !locked && !t.isActive && t.currentLevel < t.maxLevel;
            return `
              <div style="background:var(--c-surface-2);padding:12px;border-radius:10px;border:1px solid var(--c-border)">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <div style="font-weight:700">${t.icon} ${t.name}</div>
                  <span class="badge ${t.isActive ? 'badge-blue' : 'badge-gray'}">Lv ${t.currentLevel}/${t.maxLevel}</span>
                </div>
                <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:6px">Boost: ${t.nextComponentBoost} · Coste: ${GL_UI.fmtCR(t.nextCost)} · Duracion: ${toTime(t.nextDuration)}</div>
                ${t.isActive ? `<div style="margin-top:8px">${GL_UI.progressBar(Math.round(t.progress), 100, 'blue')}</div>` : ''}
                ${locked ? `<div style="font-size:0.78rem;color:var(--c-orange);margin-top:8px">Requiere mejoras de HQ (I+D / Tunel de viento).</div>` : ''}
                ${canStart ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="GL_SCREENS.startResearchTree('${t.treeId}')">Iniciar Investigacion</button>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `
    });
  },

  startResearchTree(treeId) {
    const result = GL_ENGINE.startResearch ? GL_ENGINE.startResearch(treeId) : { error: 'R&D engine not found' };
    if (result && result.success) {
      GL_UI.toast('Investigacion iniciada', 'success');
      GL_STATE.addLog(`🔬 Nueva investigacion iniciada: ${treeId}.`, 'info');
      GL_STATE.saveState();
      this.showRnD();
      this.renderCar();
      return;
    }
    GL_UI.toast(result && result.error ? result.error : 'No se pudo iniciar I+D', 'warning');
  },

  renderStarRating(stars = 0) {
    const safeStars = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
    return `<span style="letter-spacing:1px;color:var(--c-gold);font-size:0.9rem">${'★'.repeat(safeStars)}${'☆'.repeat(5 - safeStars)}</span>`;
  },

  getRaceArchiveRecord(round) {
    const state = GL_STATE.getState();
    const roundNumber = Number(round || 0);
    const calendarRace = (state?.season?.calendar || []).find((race) => Number(race?.round || 0) === roundNumber);
    if (calendarRace?.result?.performanceReport) return calendarRace.result;
    return (state?.raceResults || []).find((entry) => Number(entry?.round || 0) === roundNumber) || null;
  },

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  copyTextToClipboard(content, successMessage, failedMessage) {
    const onSuccess = () => GL_UI.toast(successMessage, 'good');
    const onFailure = () => GL_UI.toast(failedMessage, 'warning');

    const fallbackCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) onSuccess();
        else onFailure();
      } catch (error) {
        onFailure();
      }
    };

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(onSuccess).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  },

  copyRaceAdminReport(round = null) {
    const state = GL_STATE.getState();
    const source = round == null ? window._lastRaceResult : this.getRaceArchiveRecord(round);
    const report = source?.adminReport || (round == null && GL_ENGINE.buildRaceAdminReport ? GL_ENGINE.buildRaceAdminReport(source, state) : null);
    if (report && source && !source.adminReport) source.adminReport = report;
    if (!report?.text) {
      GL_UI.toast(__('admin_report_unavailable'), 'info');
      return;
    }
    this.copyTextToClipboard(report.text, __('admin_report_copy_success'), __('admin_report_copy_failed'));
  },

  renderRaceAdminReport(report, options = {}) {
    if (!report?.text) {
      return `<p style="color:var(--t-secondary);font-size:0.82rem">${__('admin_report_unavailable')}</p>`;
    }
    const compact = !!options.compact;
    const flags = Array.isArray(report.flags) ? report.flags : [];
    const copyAction = options.copyAction || '';
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div class="section-eyebrow">${__('admin_report_title')}</div>
            <div style="font-size:0.76rem;color:var(--t-secondary);margin-top:4px">${__('admin_report_subtitle')}</div>
          </div>
          ${copyAction ? `<button class="btn btn-secondary btn-sm" onclick="${copyAction}">${__('admin_report_copy')}</button>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="font-size:0.72rem;font-weight:700;color:var(--t-secondary);text-transform:uppercase;letter-spacing:0.06em">${__('admin_report_flags')}</div>
          ${(flags.length ? flags : [__('admin_report_no_flags')]).map((flag) => `<div style="padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.035);border:1px solid var(--c-border);font-size:0.78rem;line-height:1.45">${this.escapeHtml(flag)}</div>`).join('')}
        </div>
        <textarea readonly style="width:100%;min-height:${compact ? '260px' : '420px'};padding:12px;border-radius:14px;border:1px solid var(--c-border);background:rgba(6,10,16,0.86);color:var(--t-primary);font-size:0.74rem;line-height:1.45;font-family:Consolas, 'Courier New', monospace;resize:vertical">${this.escapeHtml(report.text)}</textarea>
      </div>`;
  },

  renderRacePerformanceReport(report, options = {}) {
    if (!report) {
      return `<p style="color:var(--t-secondary);font-size:0.82rem">${__('calendar_report_unavailable')}</p>`;
    }
    const compact = !!options.compact;
    const categoryItems = Array.isArray(report.categories) ? report.categories : [];
    const driverItems = Array.isArray(report.driverReports) ? report.driverReports : [];
    const weakestSet = new Set(Array.isArray(report.weakestCategories) ? report.weakestCategories : []);
    const componentLabels = {
      engine: __('car_engine'),
      aero: __('car_aero'),
      reliability: __('car_reliability'),
      tyre_manage: __('car_tyre_manage')
    };

    const categoryMarkup = categoryItems.map((category) => {
      const trainLabel = (category.focusAttrKeys || []).map((key) => this.getAttrLabel(key)).join(' / ');
      const componentLabel = category.componentKey ? (componentLabels[category.componentKey] || category.componentKey) : '—';
      const cardBorder = weakestSet.has(category.id) ? 'var(--c-red)' : 'var(--c-border)';
      return `
        <div style="padding:14px;border:1px solid ${cardBorder};border-radius:14px;background:rgba(255,255,255,0.02)">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
            <div style="font-weight:700">${__(category.labelKey)}</div>
            <div style="text-align:right">${this.renderStarRating(category.stars)}<div style="font-size:0.72rem;color:var(--t-secondary)">${Math.round(category.score)}/99</div></div>
          </div>
          <div style="font-size:0.75rem;color:var(--t-secondary);margin-top:10px;line-height:1.5">
            <div>${__('report_focus_train')}: <strong style="color:var(--t-primary)">${trainLabel || '—'}</strong></div>
            <div>${__('report_focus_upgrade')}: <strong style="color:var(--t-primary)">${this.getHqLabel(category.buildingId)}</strong></div>
            <div>${__('report_focus_component')}: <strong style="color:var(--t-primary)">${componentLabel}</strong></div>
            <div>${__('report_focus_staff')}: <strong style="color:var(--t-primary)">${this.getStaffFocusLabel(category.staffLabelKey || category.staffLabel)}</strong></div>
          </div>
        </div>`;
    }).join('');

    const driverMarkup = driverItems.map((driver) => {
      const attrs = Array.isArray(driver.attributes) ? driver.attributes : [];
      return `
        <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:rgba(255,255,255,0.02)">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <div style="font-weight:700">${driver.pilotName}</div>
              <div style="font-size:0.76rem;color:var(--t-secondary)">${driver.isDNF ? 'DNF' : `P${driver.position}`} · ${__('report_driver_focus')}: <strong style="color:var(--t-primary)">${this.getAttrLabel(driver.weakestAttrKey)}</strong></div>
            </div>
            <div style="text-align:right">${this.renderStarRating(driver.overallStars)}<div style="font-size:0.72rem;color:var(--t-secondary)">${Math.round(driver.overallScore)}/99</div></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px">
            ${attrs.map((attr) => `
              <div style="padding:10px;border-radius:10px;background:rgba(255,255,255,0.025)">
                <div style="font-size:0.72rem;color:var(--t-secondary)">${this.getAttrLabel(attr.key)}</div>
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:4px">
                  ${this.renderStarRating(attr.stars)}
                  <span style="font-size:0.76rem;color:var(--t-primary)">${Math.round(attr.score)}/99</span>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div ${compact ? '' : 'style="padding-top:4px"'}>
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px">
          <div>
            <div class="section-eyebrow">${__('report_overall_rating')}</div>
            <div style="font-family:var(--font-display);font-size:${compact ? '1.4rem' : '1.8rem'};font-weight:800">${Math.round(report.overallScore || 0)}/99</div>
          </div>
          <div style="text-align:right">
            ${this.renderStarRating(report.overallStars || 0)}
            <div style="font-size:0.76rem;color:var(--t-secondary);margin-top:4px">${report.weather === 'wet' ? '🌧️' : '☀️'} ${this.getWeatherLabel(report.weather)}</div>
          </div>
        </div>
        <div class="section-eyebrow" style="margin-bottom:10px">${__('report_team_categories')}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px">${categoryMarkup}</div>
        <div class="section-eyebrow" style="margin-bottom:10px">${__('report_driver_attributes')}</div>
        <div style="display:grid;gap:10px">${driverMarkup}</div>
      </div>`;
  },

  openRaceReport(round) {
    const record = this.getRaceArchiveRecord(round);
    const titleSuffix = record?.circuit?.name || `R${round}`;
    GL_UI.openModal({
      title: `${__('calendar_report_title')} · ${titleSuffix}`,
      size: 'lg',
      content: `
        ${this.renderRaceAdminReport(record?.adminReport || null, { copyAction: `GL_SCREENS.copyRaceAdminReport(${Number(round)})` })}
        <div class="divider" style="margin:18px 0"></div>
        ${this.renderRacePerformanceReport(record?.performanceReport || null)}
      `
    });
  },

  // ===== CALENDAR SCREEN =====
  renderCalendar() {
    const state = GL_STATE.getState();
    if (GL_ENGINE.ensureNextRaceAvailable) {
      GL_ENGINE.ensureNextRaceAvailable();
    }
    const cal = state.season.calendar || [];
    const el = document.getElementById('screen-calendar');
    if (!el) return;
    const standings = Array.isArray(state.standings) ? state.standings : [];
    const myStanding = GL_STATE.getMyStanding();
    const pts = myStanding.points || 0;
    const completedRaces = cal.filter((race) => race.status === (window.RACE_STATUS ? RACE_STATUS.COMPLETED : 'completed'));
    const nextRace = cal.find((race) => race.status === (window.RACE_STATUS ? RACE_STATUS.NEXT : 'next')) || null;
    const promotionSpots = Number((GL_DATA.DIVISIONS || []).find((d) => Number(d.div) === Number(state.season.division))?.promotions || 0);
    const promotionCutoff = promotionSpots > 0
      ? standings.find((entry) => Number(entry.position) === promotionSpots)
      : null;
    const pointsToPromotion = promotionCutoff && Number(myStanding.position || 99) > promotionSpots
      ? Math.max(0, Number(promotionCutoff.points || 0) - Number(myStanding.points || 0) + 1)
      : 0;
    const archive = Array.isArray(state.raceResults) ? state.raceResults : [];
    const totalPrizeMoney = archive.reduce((sum, entry) => sum + Number(entry?.prizeMoney || 0), 0);
    const recentDone = completedRaces.slice(-3);
    const recentPoints = recentDone.reduce((sum, race) => sum + Number(race?.result?.points || 0), 0);
    const avgPoints = recentDone.length ? (recentPoints / recentDone.length) : 0;
    const bestFinish = completedRaces.length
      ? completedRaces.reduce((best, race) => Math.min(best, Number(race?.result?.position || 99)), 99)
      : null;
    const nextWeather = nextRace ? this.getCalendarWeatherIndicator(nextRace) : null;
    const readinessScore = !nextRace
      ? 100
      : (nextRace.savedStrategy ? 72 : 32) + Math.round((Number(nextWeather?.confidence || 0) / 100) * 24);
    const readinessTier = readinessScore >= 85 ? 'high' : (readinessScore >= 60 ? 'mid' : 'low');
    const seasonProgress = cal.length ? Math.round((completedRaces.length / cal.length) * 100) : 0;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('calendar_eyebrow')} ${state.season.year}</div>
          <div class="screen-title">${__('calendar_title')}</div>
          <div class="screen-subtitle">${__('division')} ${state.season.division} · ${cal.length} ${__('calendar_round').toLowerCase()} · ${__('topbar_week')} ${state.season.week}</div>
        </div>
        <div class="screen-actions">
          <span class="badge badge-gold" style="font-size:0.85rem;padding:8px 16px">🏆 ${pts} ${__('points')}</span>
        </div>
      </div>
      <div class="calendar-layout">
        <aside class="calendar-ops-panel">
          <div class="calendar-ops-head">
            <div class="section-eyebrow">${__('calendar_ops_eyebrow')}</div>
            <div class="calendar-ops-title">${__('calendar_ops_title')}</div>
            <div class="calendar-ops-subtitle">${__('calendar_ops_subtitle')}</div>
          </div>
          <div class="calendar-ops-kpis">
            <div class="calendar-kpi-card">
              <div class="calendar-kpi-label">${__('calendar_kpi_completed')}</div>
              <div class="calendar-kpi-value">${completedRaces.length}</div>
            </div>
            <div class="calendar-kpi-card">
              <div class="calendar-kpi-label">${__('calendar_kpi_remaining')}</div>
              <div class="calendar-kpi-value">${Math.max(0, cal.length - completedRaces.length)}</div>
            </div>
            <div class="calendar-kpi-card">
              <div class="calendar-kpi-label">${__('calendar_kpi_avg_points')}</div>
              <div class="calendar-kpi-value">${avgPoints.toFixed(1)}</div>
            </div>
            <div class="calendar-kpi-card">
              <div class="calendar-kpi-label">${__('calendar_kpi_best_finish')}</div>
              <div class="calendar-kpi-value">${bestFinish ? `P${bestFinish}` : '—'}</div>
            </div>
          </div>
          <div class="calendar-ops-progress">
            <div class="calendar-ops-progress-head">
              <span>${__('calendar_progress')}</span>
              <strong>${seasonProgress}%</strong>
            </div>
            ${GL_UI.progressBar(seasonProgress, 100, 'red')}
          </div>
          <div class="calendar-insight-card ${readinessTier}">
            <div class="calendar-insight-title">${__('calendar_readiness_title')}</div>
            <div class="calendar-insight-score">${readinessScore}%</div>
            <div class="calendar-insight-desc">${
              nextRace
                ? (nextRace.savedStrategy ? __('calendar_readiness_ready') : __('calendar_readiness_missing'))
                : __('calendar_readiness_complete')
            }</div>
            ${nextRace
              ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="GL_APP.navigateTo('prerace')">${__('calendar_race_arrow')}</button>`
              : (() => {
                  const cal2 = (typeof GL_STATE !== 'undefined' ? GL_STATE.getState() : null)?.season?.calendar || [];
                  const seasonOver = cal2.length > 0 && cal2.every(r => r.status === 'completed');
                  return seasonOver ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="GL_DASHBOARD.advanceToNextSeason()">${__('season_end_btn')}</button>` : '';
                })()
            }
          </div>
          <div class="calendar-insight-list">
            <div class="calendar-insight-item">
              <span>${__('calendar_promotion_race')}</span>
              <strong>${
                pointsToPromotion > 0
                  ? `${pointsToPromotion} ${__('points')}`
                  : __('calendar_promotion_safe')
              }</strong>
            </div>
            <div class="calendar-insight-item">
              <span>${__('finances_competition_flow')}</span>
              <strong style="color:var(--c-gold)">+${GL_UI.fmtCR(totalPrizeMoney)}</strong>
            </div>
            <div class="calendar-insight-item">
              <span>${__('calendar_next_weather')}</span>
              <strong>${nextWeather ? `${nextWeather.icon} ${Math.round(nextWeather.wetAverage)}%` : '—'}</strong>
            </div>
          </div>
        </aside>
        <div class="calendar-timeline">
        ${cal.map(r => {
          const isDone = r.status === (window.RACE_STATUS ? RACE_STATUS.COMPLETED : 'completed');
          const isNext = r.status === (window.RACE_STATUS ? RACE_STATUS.NEXT : 'next');
          const res = r.result;
          const weatherIndicator = this.getCalendarWeatherIndicator(r);
          const raceArchive = this.getRaceArchiveRecord(r.round);
          const racePrize = Number(raceArchive?.prizeMoney || 0);
          const weatherClass = weatherIndicator.wetAverage >= 66 ? 'wet' : (weatherIndicator.wetAverage <= 34 ? 'dry' : 'mixed');
          return `<div class="calendar-race-item ${isDone?'done':''} ${isNext?'next':''}">
            <div class="calendar-round">
              <div class="calendar-round-label">${__('calendar_round')}</div>
              <div class="calendar-round-num">${r.round}</div>
            </div>
            <div class="calendar-circuit-dot"></div>
            <div class="calendar-info">
              <div class="calendar-race-name">${r.circuit?.name||'Circuit'}</div>
              <div class="calendar-race-meta">${r.circuit?.country||''} · ${r.circuit?.laps||0} ${__('laps')} · ${r.circuit?.length||''}</div>
              <div class="calendar-race-tags">
                <span class="calendar-tag ${weatherClass}">${weatherIndicator.icon} ${Math.round(weatherIndicator.wetAverage)}%</span>
                <span class="calendar-tag">${__('calendar_confidence')}: ${Math.round(weatherIndicator.confidence)}%</span>
                ${isDone && racePrize > 0 ? `<span class="calendar-tag prize">+${GL_UI.fmtCR(racePrize)}</span>` : ''}
                ${isNext && r.savedStrategy ? `<span class="calendar-tag ready">${__('calendar_strat_ready')}</span>` : ''}
              </div>
            </div>
            <div class="calendar-weather" title="${weatherIndicator.tooltip}">${weatherIndicator.icon}</div>
            <div class="calendar-result">
              ${isDone && res ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <div class="calendar-result-pos" style="color:${res.position<=3?'var(--c-gold)':'var(--t-primary)'}">P${res.position}</div>
                <div class="calendar-result-pts">+${res.points} ${__('points')}</div>
                <button class="btn btn-secondary btn-sm" onclick="GL_SCREENS.openRaceReport(${r.round})">${__('calendar_view_report')}</button>
              </div>` :
              isNext ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                ${r.savedStrategy ? `<span style="font-size:0.72rem;color:var(--c-green)">✔ ${__('calendar_strat_ready')}</span>` : `<span style="font-size:0.72rem;color:var(--c-orange)">${__('calendar_strategy_missing')}</span>`}
                <button class="btn btn-primary btn-sm" onclick="GL_APP.navigateTo('prerace')">${__('calendar_race_arrow')}</button>
              </div>` :
              `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('calendar_upcoming')}</div>`}
            </div>
          </div>`;
        }).join('')}
        </div>
      </div>`;
  },

  // ===== STANDINGS SCREEN =====
  renderStandings() {
    const state = GL_STATE.getState();
    const standings = state.standings || [];
    const el = document.getElementById('screen-standings');
    if (!el) return;
    const divInfo = GL_DATA.DIVISIONS.find(d=>d.div===state.season.division);
    const campaign = GL_ENGINE.getCampaignStatus ? GL_ENGINE.getCampaignStatus() : null;
    const hasLastSummary = !!state?.season?.lastSummary;
    const seasonHistory = Array.isArray(state?.seasonHistory) ? state.seasonHistory : [];
    const objective = campaign?.objective;
    const phaseLabel = objective?.phase === 'phase1'
      ? __('dash_campaign_phase1')
      : (objective?.phase === 'phase2' ? __('dash_campaign_phase2') : __('dash_campaign_phase3'));
    const campaignHistoryHtml = (campaign?.recentHistory || []).length
      ? campaign.recentHistory.map((h) => `<div style="font-size:0.78rem;color:var(--t-secondary)">• Y${h.year} ${__(h.id === 'phase1_survive_prove' ? 'campaign_objective_phase1_title' : (h.id === 'phase2_climb' ? 'campaign_objective_phase2_title' : 'campaign_objective_phase3_title'))} <span style="color:var(--c-green)">(+${GL_UI.fmtCR(h.rewardCredits || 0)})</span></div>`).join('')
      : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('campaign_history_empty')}</div>`;
    const recentSeasonHistory = seasonHistory
      .map((summary, index) => ({ summary, index }))
      .slice(-5)
      .reverse();
    const seasonHistoryHtml = recentSeasonHistory.length
      ? recentSeasonHistory.map(({ summary, index }) => {
          const resultLabel = summary.result === 'promoted'
            ? __('season_summary_transition_promoted')
            : (summary.result === 'relegated' ? __('season_summary_transition_relegated') : __('season_summary_transition_stayed'));
          return `<button class="btn btn-ghost btn-sm" style="justify-content:space-between;width:100%;margin-bottom:8px" onclick="GL_DASHBOARD.openSeasonSummaryHistory(${index})">
            <span>${__('season_history_year')} ${summary.year} · ${__('division')} ${summary.division}</span>
            <span>P${summary.finishPosition} · ${resultLabel}</span>
          </button>`;
        }).join('')
      : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('season_history_empty')}</div>`;
    const titles = seasonHistory.filter((summary) => Number(summary.division) === 1 && Number(summary.finishPosition) === 1).length;
    const promotions = seasonHistory.filter((summary) => summary.result === 'promoted').length;
    const podiums = seasonHistory.filter((summary) => Number(summary.finishPosition) <= 3).length;
    const campaignMilestones = Array.isArray(state?.campaign?.history) ? state.campaign.history.length : 0;
    const bestFinish = seasonHistory.length
      ? seasonHistory.reduce((best, summary) => Math.min(best, Number(summary.finishPosition) || 99), 99)
      : null;
    const hallOfFameEntries = seasonHistory
      .filter((summary) => summary.result === 'promoted' || Number(summary.finishPosition) <= 3 || (Number(summary.division) === 1 && Number(summary.finishPosition) === 1))
      .slice(-4)
      .reverse();
    const hallOfFameHtml = hallOfFameEntries.length
      ? hallOfFameEntries.map((summary) => {
          const badge = Number(summary.division) === 1 && Number(summary.finishPosition) === 1
            ? __('hall_of_fame_badge_title')
            : (summary.result === 'promoted' ? __('hall_of_fame_badge_promotion') : __('hall_of_fame_badge_podium'));
          return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.78rem;color:var(--t-secondary);padding:8px 0;border-bottom:1px solid var(--c-border-hi)">
            <span>${__('season_history_year')} ${summary.year} · ${__('division')} ${summary.division}</span>
            <span><strong style="color:var(--t-primary)">${badge}</strong> · P${summary.finishPosition}</span>
          </div>`;
        }).join('')
      : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('hall_of_fame_empty')}</div>`;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('standings_eyebrow')}</div>
          <div class="screen-title">${__('standings_title')} ${state.season.division}</div>
          <div class="screen-subtitle">${divInfo?.name || ''} · ${divInfo?.promotions || 0} ${__('standings_promotion_spots')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('dashboard')">← ${__('back') || 'Atrás'}</button>
        </div>
      </div>
      <div class="grid-2 mb-4">
        <div class="card">
          <div class="section-eyebrow">${__('campaign_progress_title')}</div>
          ${objective ? `
            <div style="font-size:0.8rem;color:var(--t-secondary);margin-bottom:6px">${__('dash_campaign_phase_label')}: <strong>${phaseLabel}</strong></div>
            <div style="font-size:0.95rem;color:var(--t-primary);font-weight:700;margin-bottom:4px">${__(objective.titleKey)}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary);margin-bottom:8px">${__(objective.descKey)}</div>
            <div style="font-size:0.8rem;color:var(--c-gold)">${__('dash_campaign_reward')}: <strong>+${GL_UI.fmtCR(objective.rewardCredits || 0)} CR</strong></div>
          ` : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('dash_campaign_no_objective')}</div>`}
          <div class="divider"></div>
          <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
            <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.openLatestSeasonSummary()" ${hasLastSummary ? '' : 'disabled'}>${__('season_summary_view_last')}</button>
          </div>
          <div class="section-eyebrow" style="margin-top:0">${__('campaign_history_title')}</div>
          ${campaignHistoryHtml}
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('hall_of_fame_title')}</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 14px">
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('hall_of_fame_titles')}</div><div style="font-size:1.2rem;font-weight:800;color:var(--c-gold)">${titles}</div></div>
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('hall_of_fame_promotions')}</div><div style="font-size:1.2rem;font-weight:800;color:var(--t-primary)">${promotions}</div></div>
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('hall_of_fame_podiums')}</div><div style="font-size:1.2rem;font-weight:800;color:var(--t-primary)">${podiums}</div></div>
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('hall_of_fame_best_finish')}</div><div style="font-size:1.2rem;font-weight:800;color:var(--t-primary)">${bestFinish ? `P${bestFinish}` : '–'}</div></div>
          </div>
          <div style="font-size:0.78rem;color:var(--t-secondary);margin-bottom:10px">${__('hall_of_fame_campaign_milestones')}: <strong>${campaignMilestones}</strong></div>
          ${hallOfFameHtml}
        </div>
      </div>
      <div class="card mb-4">
        <div class="section-eyebrow">${__('season_history_title')}</div>
        ${seasonHistoryHtml}
      </div>
      <div class="card p-0">
        <table class="standings-table-full">
          <thead><tr>
            <th>${__('standings_pos')}</th><th>${__('standings_team')}</th><th>${__('standings_points')}</th><th>${__('standings_wins')}</th><th>${__('standings_best')}</th><th>${__('standings_status')}</th>
          </tr></thead>
          <tbody>
                ${standings.map((s, i) => {
                  const isPromo = divInfo && i < divInfo.promotions;
                  const isRelegate = divInfo && i >= standings.length - divInfo.relegations && state.season.division < 8;
                  // Si hay breakdowns por estado de carrera, usar enums centralizados aquí también
                  return `<tr class="${s.id==='player'?'my-row':''} ${isPromo?'promoted':''} ${isRelegate?'relegated':''}">
                    <td><div class="pos-badge pos-${i<3?i+1:'n'}">${i+1}</div></td>
                    <td style="display:flex;align-items:center;gap:var(--s-2);min-width:200px">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color||'#888'};flex-shrink:0"></span>
                      ${s.flag||''} <strong>${s.name}</strong>${s.id==='player'?' <span style="font-size:0.8rem;color:var(--c-accent)">'+__('standings_you')+'</span>':''}
                    </td>
                    <td><strong style="color:var(--c-gold)">${s.points}</strong></td>
                    <td>${s.wins || 0}</td>
                    <td>${s.bestResult ? 'P'+s.bestResult : '–'}</td>
                    <td>${isPromo ? `<span class="badge badge-green">${__('standings_promote')}</span>` : isRelegate ? `<span class="badge badge-red">${__('standings_relegate')}</span>` : '–'}</td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  // ===== FINANCES SCREEN =====
  renderFinances() {
    const state = GL_STATE.getState();
    const fi = state.finances;
    const activeSponsors = (state.sponsors || []).filter((sp) => !sp.expired);
    const el = document.getElementById('screen-finances');
    if (!el) return;
    const history = fi.history || [];
    const financeOverview = window.getFinanceOverview
      ? window.getFinanceOverview(state)
      : {
          breakdown: window.getWeeklyEconomyBreakdown ? window.getWeeklyEconomyBreakdown(state) : { income: 0, expenses: 0, net: 0, sponsorIncome: 0, fanRevenue: 0, divisionGrant: 0, bonusIncome: 0, prizeIncome: 0, salaries: 0, hqCost: 0, contractCost: 0 },
          settlement: fi.lastRaceSettlement && typeof fi.lastRaceSettlement === 'object' ? fi.lastRaceSettlement : null,
          openingCash: Number(fi.credits || 0),
          closingCash: Number(fi.credits || 0),
          operatingNet: 0,
          competitionNet: 0,
          totalNet: 0,
          deficitStreak: Number(fi.deficitStreak || 0),
          health: fi.criticalDeficit ? 'critical' : (fi.deficitStreak > 0 ? 'warning' : 'healthy'),
          isCritical: !!fi.criticalDeficit,
          isWarning: !fi.criticalDeficit && Number(fi.deficitStreak || 0) > 0,
          reasonKey: 'finances_health_reason_positive_total'
        };
    const breakdown = financeOverview.breakdown;
    const cashflowAdjustments = Array.isArray(fi.cashflowAdjustments) ? fi.cashflowAdjustments : [];
    const adjustmentByWeek = cashflowAdjustments.reduce((acc, entry) => {
      const weekKey = Number(entry?.week || 0);
      if (!Number.isFinite(weekKey) || weekKey <= 0) return acc;
      acc[weekKey] = (acc[weekKey] || 0) + Number(entry?.amount || 0);
      return acc;
    }, {});
    const currentWeekAdjustment = Number(adjustmentByWeek[Number(state?.season?.week || 0)] || 0);
    const operatingNetWithAdjustments = Number(financeOverview.operatingNet || 0) + currentWeekAdjustment;
    const totalNetWithAdjustments = operatingNetWithAdjustments + Number(financeOverview.competitionNet || 0);
    const closingCashWithAdjustments = Number(fi.credits || 0);
    const openingCashWithAdjustments = closingCashWithAdjustments - totalNetWithAdjustments;
    const income = breakdown.income;
    const expenses = breakdown.expenses;
    const lastRaceSettlement = financeOverview.settlement;
    const deficitStreak = financeOverview.deficitStreak;
    const healthLabel = financeOverview.isCritical
      ? __('dash_finance_critical_state')
      : (financeOverview.isWarning ? __('dash_finance_warning_state') : __('dash_finance_healthy_state'));
    const healthColor = financeOverview.isCritical ? 'var(--c-red)' : (financeOverview.isWarning ? 'var(--c-gold)' : 'var(--c-green)');
    const settlementRound = Number.isFinite(lastRaceSettlement?.round) ? `R${lastRaceSettlement.round}` : '—';
    const settlementDate = Number.isFinite(lastRaceSettlement?.ts)
      ? new Date(lastRaceSettlement.ts).toLocaleString()
      : '';
    const settlementPlayerSummary = Array.isArray(lastRaceSettlement?.playerCars)
      ? lastRaceSettlement.playerCars
          .filter((car) => Number.isFinite(car?.position))
          .map((car) => `${car.pilotName || __('nav_team')} P${car.position}`)
          .join(' · ')
      : '';
    const prizeByWeek = {};
    (state.raceResults || []).forEach((race) => {
      const weekKey = Number(race?.round || 0);
      if (!Number.isFinite(weekKey) || weekKey <= 0) return;
      prizeByWeek[weekKey] = (prizeByWeek[weekKey] || 0) + Number(race?.prizeMoney || 0);
    });
    if (Number.isFinite(lastRaceSettlement?.week)) {
      const wk = Number(lastRaceSettlement.week);
      prizeByWeek[wk] = Number(lastRaceSettlement.prizeDelta || lastRaceSettlement.prizeMoney || prizeByWeek[wk] || 0);
    }
    const recentHistory = history.slice(-10);
    const historyTotals = recentHistory.reduce((acc, h) => {
      const weekKey = Number(h.week || 0);
      const hasStoredPrize = Number.isFinite(Number(h.prizeIncome));
      const prizeIncome = hasStoredPrize ? Number(h.prizeIncome || 0) : Number(prizeByWeek[weekKey] || 0);
      const oneOffAdjustment = Number(adjustmentByWeek[weekKey] || 0);
      const operatingIncomeSource = (typeof h.operatingIncome === 'number')
        ? h.operatingIncome
        : ((h.income || 0) - (hasStoredPrize ? Number(h.prizeIncome || 0) : 0));
      const operatingIncome = Number(operatingIncomeSource || 0);
      const expenses = Number(h.expenses || 0);
      const weeklyNet = (operatingIncome + prizeIncome + oneOffAdjustment) - expenses;
      acc.operatingIncome += operatingIncome;
      acc.prizeIncome += prizeIncome;
      acc.oneOff += oneOffAdjustment;
      acc.income += operatingIncome + prizeIncome;
      acc.expenses += expenses;
      acc.net += weeklyNet;
      return acc;
    }, { operatingIncome: 0, prizeIncome: 0, oneOff: 0, income: 0, expenses: 0, net: 0 });
    let runningNet = 0;
    const historyRowsHtml = recentHistory.length
      ? recentHistory.map((h) => {
          const weekKey = Number(h.week || 0);
          const hasStoredPrize = Number.isFinite(Number(h.prizeIncome));
          const prizeIncome = hasStoredPrize ? Number(h.prizeIncome || 0) : Number(prizeByWeek[weekKey] || 0);
          const oneOffAdjustment = Number(adjustmentByWeek[weekKey] || 0);
          const operatingIncomeSource = (typeof h.operatingIncome === 'number')
            ? h.operatingIncome
            : ((h.income || 0) - (hasStoredPrize ? Number(h.prizeIncome || 0) : 0));
          const operatingIncome = Number(operatingIncomeSource || 0);
          const expenses = Number(h.expenses || 0);
          const totalNet = (operatingIncome + prizeIncome + oneOffAdjustment) - expenses;
          const netVal = totalNet;
          runningNet += netVal;
          return `<tr>
            <td>${__('topbar_week')} ${h.week}</td>
            <td style="color:var(--c-green)">+${GL_UI.fmtCR(operatingIncome)}</td>
            <td style="color:${prizeIncome >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(prizeIncome)}</td>
            <td style="color:${oneOffAdjustment >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(oneOffAdjustment)}</td>
            <td style="color:var(--c-red)">-${GL_UI.fmtCR(expenses)}</td>
            <td style="color:${netVal >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(netVal)}</td>
            <td style="font-weight:700;color:${runningNet >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(runningNet)}</td>
          </tr>`;
        }).join('')
      : '';
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('finances_eyebrow')}</div>
          <div class="screen-title">${__('finances_title')}</div>
          <div class="screen-subtitle">${__('finances_subtitle')}</div>
        </div>
        <div class="screen-actions"><span class="badge badge-gold" style="font-size:1rem;padding:10px 20px">💰 ${GL_UI.fmtCR(fi.credits||0)} CR</span></div>
      </div>
      <div class="card mb-4">
        <div class="section-eyebrow">${__('finances_health_title')}</div>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <div style="font-size:0.9rem;color:var(--t-secondary)">${__('finances_health_label')}: <strong style="color:${healthColor}">${healthLabel}</strong></div>
          <div style="font-size:0.82rem;color:var(--t-secondary)">${__('dash_finance_deficit_streak_label')}: <strong>${deficitStreak}</strong> ${__('dash_finance_deficit_streak_weeks')}</div>
          <div style="font-size:0.82rem;color:${totalNetWithAdjustments>=0?'var(--c-green)':'var(--c-red)'}">${__('finances_total_flow')}: <strong>${GL_UI.fmtSign(totalNetWithAdjustments)}</strong></div>
        </div>
        <div style="margin-top:10px;font-size:0.82rem;color:var(--t-secondary)">${__(financeOverview.reasonKey)}</div>
      </div>
      <div class="card mb-4">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div class="section-eyebrow">${__('finances_cashflow_title')}</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--t-primary)">${__('finances_last_race')}: ${settlementRound}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:4px">${__('finances_cashflow_subtitle')}</div>
          </div>
          <div style="font-size:0.76rem;color:var(--t-secondary);text-align:right">${settlementDate || ''}${settlementPlayerSummary ? `<br>${settlementPlayerSummary}` : ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:var(--s-4)">
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--t-primary)">${GL_UI.fmtCR(openingCashWithAdjustments)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_opening_cash')}</div></div>
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:${operatingNetWithAdjustments >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(operatingNetWithAdjustments)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_operating_flow')}</div></div>
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:${financeOverview.competitionNet >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(financeOverview.competitionNet)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_competition_flow')}</div></div>
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:${currentWeekAdjustment >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(currentWeekAdjustment)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_oneoff_flow')}</div></div>
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:${totalNetWithAdjustments >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(totalNetWithAdjustments)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_total_flow')}</div></div>
          <div style="padding:14px;border:1px solid var(--c-border);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))"><div style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--t-primary)">${GL_UI.fmtCR(closingCashWithAdjustments)}</div><div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">${__('finances_closing_cash')}</div></div>
        </div>
        ${lastRaceSettlement ? `<div style="margin-top:10px;font-size:0.78rem;color:var(--t-secondary)">${__('finances_race_settlement_hint')}</div>` : `<p style="color:var(--t-tertiary);font-size:0.82rem;margin-top:var(--s-4)">${__('finances_no_race_settlement')}</p>`}
      </div>
      <div class="grid-2 mb-6">
        <div class="card">
          <div class="section-eyebrow">${__('finances_income')}</div>
          <div style="margin-top:var(--s-4)">
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_sponsors')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.sponsorIncome/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-green)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(breakdown.sponsorIncome)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_competition_flow')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.prizeIncome/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-accent)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(breakdown.prizeIncome || 0)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_division_grant')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.divisionGrant/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-gold)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(breakdown.divisionGrant)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_fan_revenue')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.fanRevenue/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-blue)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(breakdown.fanRevenue)}</span></div>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${__('finances_total_income')}</span><span style="font-family:var(--font-display);font-weight:800;color:var(--c-green)">+${GL_UI.fmtCR(income)}${__('per_week')}</span></div>
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('finances_expenses')}</div>
          <div style="margin-top:var(--s-4)">
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_pilots')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.salaries/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-red)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(breakdown.salaries)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_facilities')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.hqCost/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-gold)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(breakdown.hqCost)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('eco_contracts')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(breakdown.contractCost/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-orange)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(breakdown.contractCost)}</span></div>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${__('finances_total_expenses')}</span><span style="font-family:var(--font-display);font-weight:800;color:var(--c-red)">-${GL_UI.fmtCR(expenses)}${__('per_week')}</span></div>
        </div>
      </div>
      <div class="card mb-6">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div class="section-eyebrow">${__('finances_sponsors')}</div>
            <div style="font-size:0.8rem;color:var(--t-secondary);margin-top:4px">${activeSponsors.length} ${__('dash_sponsors_label').toLowerCase()}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('market')">${__('dash_sponsors_market')}</button>
        </div>
        <div style="margin-top:var(--s-4);display:flex;flex-direction:column;gap:8px">
          ${activeSponsors.length
            ? activeSponsors
                .map((sp) => {
                  const incomeVal = Number(sp.weeklyValue || sp.income || 0);
                  const weeksLeft = Number(sp.weeksLeft || sp.duration || 0);
                  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0">
                      <span style="font-size:1rem">${sp.logo || '💼'}</span>
                      <div style="min-width:0">
                        <div style="font-weight:700;color:var(--t-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.name || __('finances_sponsors')}</div>
                        <div style="font-size:0.74rem;color:var(--t-secondary)">${__('market_duration')}: ${weeksLeft} ${__('market_weeks')}</div>
                      </div>
                    </div>
                    <div style="font-weight:800;color:var(--c-green)">+${GL_UI.fmtCR(incomeVal)}${__('per_week')}</div>
                  </div>`;
                })
                .join('')
            : `<div style="font-size:0.82rem;color:var(--t-tertiary)">${__('dash_no_sponsors')}</div>`}
        </div>
      </div>
      <div class="card">
        <div class="section-eyebrow">${__('finances_history')}</div>
        <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:6px">${__('finances_history_hint')}</div>
        ${recentHistory.length ? `
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:var(--s-4)">
            <div style="padding:10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-secondary)">${__('finances_total_income')}</div><div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--c-green)">+${GL_UI.fmtCR(historyTotals.income)}</div></div>
            <div style="padding:10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-secondary)">${__('finances_total_expenses')}</div><div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:var(--c-red)">-${GL_UI.fmtCR(historyTotals.expenses)}</div></div>
            <div style="padding:10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-secondary)">${__('finances_total_flow')}</div><div style="font-family:var(--font-display);font-size:1rem;font-weight:800;color:${historyTotals.net >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(historyTotals.net)}</div></div>
          </div>
          <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:8px">${__('finances_competition_flow')}: <strong style="color:${historyTotals.prizeIncome >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(historyTotals.prizeIncome)}</strong> · ${__('finances_oneoff_flow')}: <strong style="color:${historyTotals.oneOff >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${GL_UI.fmtSign(historyTotals.oneOff)}</strong></div>
          <div style="overflow:auto;margin-top:12px">
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
              <thead>
                <tr style="text-align:left;color:var(--t-secondary);border-bottom:1px solid var(--c-border)">
                  <th style="padding:8px 6px">${__('topbar_week')}</th>
                  <th style="padding:8px 6px">${__('finances_income')}</th>
                  <th style="padding:8px 6px">${__('finances_competition_flow')}</th>
                  <th style="padding:8px 6px">${__('finances_oneoff_flow')}</th>
                  <th style="padding:8px 6px">${__('finances_expenses')}</th>
                  <th style="padding:8px 6px">${__('finances_total_flow')}</th>
                  <th style="padding:8px 6px">${__('finances_history') || 'Acum.'}</th>
                </tr>
              </thead>
              <tbody>
                ${historyRowsHtml}
              </tbody>
            </table>
          </div>` : `<p style="color:var(--t-tertiary);font-size:0.82rem;margin-top:var(--s-4)">${__('finances_no_history')}</p>`}
      </div>`;
  },

  // ===== MARKET SCREEN =====
  renderMarket() {
    const state = GL_STATE.getState();
    const myIds = state.pilots.map(p=>p.id);
    const available = GL_DATA.PILOT_POOL.filter(p => !myIds.includes(p.id));
    const el = document.getElementById('screen-market');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('market_eyebrow')}</div>
          <div class="screen-title">${__('market_title')}</div>
          <div class="screen-subtitle">${__('market_subtitle')}</div>
        </div>
      </div>
      <div class="tabs mb-6" style="max-width:400px">
        <button class="tab active" onclick="GL_SCREENS.marketTab('pilots',this)">${__('market_tab_pilots')}</button>
        <button class="tab" onclick="GL_SCREENS.marketTab('sponsors',this)">${__('market_tab_sponsors')}</button>
      </div>
      <div id="market-content">
        ${this.marketPilotList(available)}
      </div>`;
  },

  marketTab(tab, btn) {
    document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    const mc = document.getElementById('market-content');
    if (tab === 'pilots') {
      const myIds = GL_STATE.getState().pilots.map(p=>p.id);
      mc.innerHTML = this.marketPilotList(GL_DATA.PILOT_POOL.filter(p=>!myIds.includes(p.id)));
    } else {
      mc.innerHTML = this.marketSponsorList();
    }
  },

  marketPilotList(pilots) {
    if (!pilots.length) return `<p style="color:var(--t-secondary);font-size:0.9rem">${__('market_no_pilots')}</p>`;
    const ordered = pilots
      .map((p) => ({ ...p, _marketSalary: this.computePilotMarketSalary(p), _overall: GL_ENGINE.pilotScore(p) }))
      .sort((a, b) => b._marketSalary - a._marketSalary);
    return ordered.map(p => {
      const overall = GL_ENGINE.pilotScore(p);
      return `<div class="market-pilot-row">
        <div class="market-pilot-avatar" style="font-size:2rem">${p.emoji||'🧑'}</div>
        <div class="market-pilot-info">
          <div class="market-pilot-name">${p.name} <span style="font-size:0.7rem;color:var(--t-secondary)">${p.nat} · ${__('age')} ${p.age}</span></div>
          <div class="market-pilot-meta">${__('overall')} ${overall} · ${__('pilots_potential')} ${p.potential}%</div>
          <div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:4px;font-style:italic">"${p.bio||''}"</div>
        </div>
        <div class="market-pilot-attrs">
          <div class="market-attr"><div class="market-attr-val">${p.attrs.pace}</div><div class="market-attr-label">PACE</div></div>
          <div class="market-attr"><div class="market-attr-val">${p.attrs.racePace}</div><div class="market-attr-label">RACE</div></div>
          <div class="market-attr"><div class="market-attr-val">${p.attrs.rain}</div><div class="market-attr-label">RAIN</div></div>
        </div>
        <div class="market-pilot-salary">
          <div class="market-pilot-salary-val">${GL_UI.fmtCR(p._marketSalary)}<span style="font-size:0.7rem">${__('per_week')}</span></div>
          <div class="market-pilot-salary-label">${__('market_salary')}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--s-2)" onclick="GL_SCREENS.signPilot('${p.id}')">${__('market_sign')}</button>
        </div>
      </div>`;
    }).join('');
  },

  marketSponsorList() {
    const myIds = GL_STATE.getState().sponsors.map(s=>s.id);
    const available = GL_DATA.SPONSOR_POOL.filter(s=>!myIds.includes(s.id));
    return available.map(sp => `
      <div class="market-pilot-row">
        <div class="market-pilot-avatar" style="font-size:2rem;background:${sp.bg||'#111'}">${sp.logo}</div>
        <div class="market-pilot-info">
          <div class="market-pilot-name" style="color:${sp.color}">${sp.name}</div>
          <div class="market-pilot-meta">${__('market_duration')}: ${sp.duration} ${__('market_weeks')} · ${__('market_req')}: ${sp.demand}</div>
        </div>
        <div class="market-pilot-salary">
          <div class="market-pilot-salary-val">+${GL_UI.fmtCR(sp.income)}<span style="font-size:0.7rem">${__('per_week')}</span></div>
          <div class="market-pilot-salary-label">${__('market_sponsor_income')}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--s-2)" onclick="GL_SCREENS.signSponsor('${sp.id}')">${__('market_sign_deal')}</button>
        </div>
      </div>`).join('');
  },

  signPilot(id) {
    const state = GL_STATE.getState();
    if (state.pilots.length >= 3) { GL_UI.toast(__('market_max_pilots'), 'warning'); return; }
    const p = GL_DATA.PILOT_POOL.find(x=>x.id===id);
    if (!p) return;
    state.pilots.push({
      ...GL_STATE.deepClone(p),
      salary: this.computePilotMarketSalary(p),
      morale:80,
      contractWeeks:20,
      number:Math.floor(Math.random()*89)+11
    });
    GL_STATE.addLog(`🧑‍✈️ ${p.name} signed!`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${p.name} signed!`, 'success');
    this.renderMarket();
    GL_DASHBOARD.refresh();
  },

  signSponsor(id) {
    const sp = GL_DATA.SPONSOR_POOL.find(x=>x.id===id);
    if (!sp) return;
    GL_STATE.getState().sponsors.push({ ...GL_STATE.deepClone(sp), weeksLeft: sp.duration });
    GL_STATE.addLog(`💼 ${sp.name} sponsor deal signed!`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${sp.name} deal signed!`, 'success');
    this.renderMarket();
    GL_DASHBOARD.refresh();
  },

  // ===== PRE-RACE SCREEN =====
  renderPreRace() {
    const state = GL_STATE.getState();
    if (GL_ENGINE.ensureNextRaceAvailable) {
      GL_ENGINE.ensureNextRaceAvailable();
    }
    if (GL_ENGINE.refreshForecastForNextRace) {
      GL_ENGINE.refreshForecastForNextRace();
    }
    const cal = state.season.calendar || [];
    const next = cal.find(r=>r.status==='next');
    const el = document.getElementById('screen-prerace');
    if (!el) return;
    if (!next) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('prerace_no_race')}</p></div>`; return; }
    const c = next.circuit;
    const fc = next.forecast || { confidence: 60, windows: [{ label: 'start', wetProb: 30 }, { label: 'mid', wetProb: 35 }, { label: 'end', wetProb: 30 }] };
    const defaultStrategy = {
      tyre:'medium', strategy:'balanced', aggression:58, riskLevel:40, pitLap:42, engineMode:'normal', pitPlan:'single', safetyCarReaction:'live',
      pitTyres: ['hard', 'medium'],
      setup: { aeroBalance: 50, wetBias: 50 },
      interventions: [
        { lapPct: 42, pitBias: 'none' },
        { lapPct: 70, pitBias: 'none' }
      ],
      pilotId: (state.pilots && state.pilots[0]) ? state.pilots[0].id : null,
      selectedPilotIds: (state.pilots || []).slice(0, 2).map((p) => p.id),
      driverConfigs: {}
    };
    const baseStrategy = GL_STATE.deepClone(window._raceStrategy || next.savedStrategy || defaultStrategy);
    if (!Array.isArray(baseStrategy.interventions) || baseStrategy.interventions.length < 2) {
      baseStrategy.interventions = [{ lapPct: 30, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }];
    }
    if (!baseStrategy.pilotId && state.pilots && state.pilots[0]) {
      baseStrategy.pilotId = state.pilots[0].id;
    }
    const roster = state.pilots || [];
    if (!Array.isArray(baseStrategy.selectedPilotIds)) baseStrategy.selectedPilotIds = [];
    baseStrategy.selectedPilotIds = baseStrategy.selectedPilotIds.filter((id) => roster.some((p) => p.id === id));
    if (baseStrategy.selectedPilotIds.length === 0) {
      roster.forEach((p) => {
        if (baseStrategy.selectedPilotIds.length < 2 && !baseStrategy.selectedPilotIds.includes(p.id)) {
          baseStrategy.selectedPilotIds.push(p.id);
        }
      });
    }
    baseStrategy.selectedPilotIds = baseStrategy.selectedPilotIds.slice(0, 2);
    if (!baseStrategy.driverConfigs) baseStrategy.driverConfigs = {};
    Object.keys(baseStrategy.driverConfigs).forEach((pid) => {
      if (!baseStrategy.selectedPilotIds.includes(pid)) delete baseStrategy.driverConfigs[pid];
    });
    baseStrategy.selectedPilotIds.forEach((pid) => {
      baseStrategy.driverConfigs[pid] = this.getDriverStrategyDefaults(baseStrategy, baseStrategy.driverConfigs[pid] || {});
    });
    if (!baseStrategy.strategy) baseStrategy.strategy = 'balanced';
    if (!baseStrategy.pitPlan) baseStrategy.pitPlan = 'single';
    if (!baseStrategy.engineMode) baseStrategy.engineMode = 'normal';
    if (!baseStrategy.safetyCarReaction) baseStrategy.safetyCarReaction = 'live';
    window._raceStrategy = baseStrategy;
    window._advisorStrategySource = 'manual';
    const nextRaceObj = GL_ENGINE.getNextRaceDate ? GL_ENGINE.getNextRaceDate() : null;
    const hoursToRace = nextRaceObj ? Math.max(0, Math.round((nextRaceObj.date.getTime() - Date.now()) / 3600000)) : null;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('round')} ${next.round} · ${__('prerace_eyebrow')}</div>
          <div class="screen-title">${c.name}</div>
          <div class="screen-subtitle">${c.country} · ${c.laps} ${__('laps')} · ${c.length} · ${next.weather==='wet'?__('prerace_rain_expected'):__('prerace_dry2')}</div>
        </div>
        <div class="screen-actions">
          ${next.savedStrategy ? `<span style="font-size:0.78rem;color:var(--c-green);display:flex;align-items:center;gap:4px">✔ ${__('prerace_strat_saved_badge') || 'Estrategia guardada'}</span>` : ''}
          <button class="btn btn-primary btn-lg" onclick="GL_SCREENS.saveStrategy()">${next.savedStrategy ? (__('prerace_update_strat') || '💾 Actualizar Estrategia') : (window.__('prerace_save_strat') || '💾 Guardar Estrategia')}</button>
          <button class="btn btn-secondary btn-lg" onclick="GL_APP.navigateTo('race')">${__('race_sim_btn') || 'Correr carrera'}</button>
        </div>
      </div>
      <div class="prerace-grid">
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_driver_assign')}</div>
          <div style="font-size:0.74rem;color:var(--t-secondary);margin-bottom:10px">Selecciona hasta 2 pilotos para correr. Cada coche usa su propio compuesto, motor, plan de pit, setup y llamadas tácticas.</div>
          ${state.pilots.map(p => {
            const selected = (window._raceStrategy?.selectedPilotIds || []).includes(p.id);
            const cfg = this.getDriverStrategyDefaults(window._raceStrategy || baseStrategy, window._raceStrategy?.driverConfigs?.[p.id] || {});
            const tyreMeta = this.getTyreMeta(cfg.tyre);
            return `
            <div class="morale-pill" style="margin-bottom:var(--s-3)">
              <div class="morale-avatar" style="font-size:1.2rem">${p.emoji||'🧑'}</div>
              <div class="morale-info"><div class="morale-name">${p.name}</div><div style="font-size:0.7rem;color:var(--t-secondary)">Base igualada · la diferencia la hace la estrategia individual</div></div>
              <button class="btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}" data-pilot-btn="${p.id}" style="margin-left:auto" onclick="GL_SCREENS.toggleRacePilot('${p.id}')">${selected ? 'En carrera' : 'Reserva'}</button>
            </div>
            ${selected ? `
              <div class="card" style="margin:-8px 0 10px 0;padding:10px;background:var(--c-surface-2)">
                <div style="font-size:0.72rem;color:var(--t-secondary);margin-bottom:6px">Estrategia de ${p.name}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:0.72rem">
                  <span class="badge" style="background:${tyreMeta.color}22;color:${tyreMeta.color};border:1px solid ${tyreMeta.color}55">${tyreMeta.label}</span>
                  <span style="color:var(--t-secondary)">${tyreMeta.paceText}</span>
                  <span style="color:var(--t-secondary)">${tyreMeta.durabilityText}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
                  <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','tyre',this.value)">
                    <option value="soft" ${cfg.tyre === 'soft' ? 'selected' : ''}>${__('prerace_tyre_label', 'Tyre')}: ${__('compound_soft', 'Soft')}</option>
                    <option value="medium" ${cfg.tyre === 'medium' || !cfg.tyre ? 'selected' : ''}>${__('prerace_tyre_label', 'Tyre')}: ${__('compound_medium', 'Medium')}</option>
                    <option value="hard" ${cfg.tyre === 'hard' ? 'selected' : ''}>${__('prerace_tyre_label', 'Tyre')}: ${__('compound_hard', 'Hard')}</option>
                    <option value="intermediate" ${cfg.tyre === 'intermediate' ? 'selected' : ''}>${__('prerace_tyre_label', 'Tyre')}: ${__('compound_intermediate', 'Intermediate')}</option>
                    <option value="wet" ${cfg.tyre === 'wet' ? 'selected' : ''}>${__('prerace_tyre_label', 'Tyre')}: ${__('compound_wet', 'Wet')}</option>
                  </select>
                  <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','engineMode',this.value)">
                    <option value="eco" ${cfg.engineMode === 'eco' ? 'selected' : ''}>${__('prerace_engine_label', 'Engine')}: ${this.getEngineModeLabel('eco')}</option>
                    <option value="normal" ${cfg.engineMode === 'normal' || !cfg.engineMode ? 'selected' : ''}>${__('prerace_engine_label', 'Engine')}: ${this.getEngineModeLabel('normal')}</option>
                    <option value="push" ${cfg.engineMode === 'push' ? 'selected' : ''}>${__('prerace_engine_label', 'Engine')}: ${this.getEngineModeLabel('push')}</option>
                  </select>
                  <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','pitPlan',this.value)">
                    <option value="single" ${cfg.pitPlan === 'single' || !cfg.pitPlan ? 'selected' : ''}>${__('prerace_pit_plan_label', 'Pit Plan')}: ${this.getPitPlanLabel('single')}</option>
                    <option value="double" ${cfg.pitPlan === 'double' ? 'selected' : ''}>${__('prerace_pit_plan_label', 'Pit Plan')}: ${this.getPitPlanLabel('double')}</option>
                  </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
                  <select onchange="GL_SCREENS.updateDriverPitTyre('${p.id}',0,this.value)">
                    <option value="soft" ${cfg.pitTyres?.[0] === 'soft' ? 'selected' : ''}>${__('prerace_pit_1', 'Pit 1')}: ${__('compound_soft', 'Soft')}</option>
                    <option value="medium" ${cfg.pitTyres?.[0] === 'medium' ? 'selected' : ''}>${__('prerace_pit_1', 'Pit 1')}: ${__('compound_medium', 'Medium')}</option>
                    <option value="hard" ${cfg.pitTyres?.[0] === 'hard' ? 'selected' : ''}>${__('prerace_pit_1', 'Pit 1')}: ${__('compound_hard', 'Hard')}</option>
                    <option value="intermediate" ${cfg.pitTyres?.[0] === 'intermediate' ? 'selected' : ''}>${__('prerace_pit_1', 'Pit 1')}: ${__('compound_intermediate', 'Intermediate')}</option>
                    <option value="wet" ${cfg.pitTyres?.[0] === 'wet' ? 'selected' : ''}>${__('prerace_pit_1', 'Pit 1')}: ${__('compound_wet', 'Wet')}</option>
                  </select>
                  <select onchange="GL_SCREENS.updateDriverPitTyre('${p.id}',1,this.value)" ${cfg.pitPlan === 'single' ? 'disabled' : ''}>
                    <option value="soft" ${cfg.pitTyres?.[1] === 'soft' ? 'selected' : ''}>${__('prerace_pit_2', 'Pit 2')}: ${__('compound_soft', 'Soft')}</option>
                    <option value="medium" ${cfg.pitTyres?.[1] === 'medium' ? 'selected' : ''}>${__('prerace_pit_2', 'Pit 2')}: ${__('compound_medium', 'Medium')}</option>
                    <option value="hard" ${cfg.pitTyres?.[1] === 'hard' ? 'selected' : ''}>${__('prerace_pit_2', 'Pit 2')}: ${__('compound_hard', 'Hard')}</option>
                    <option value="intermediate" ${cfg.pitTyres?.[1] === 'intermediate' ? 'selected' : ''}>${__('prerace_pit_2', 'Pit 2')}: ${__('compound_intermediate', 'Intermediate')}</option>
                    <option value="wet" ${cfg.pitTyres?.[1] === 'wet' ? 'selected' : ''}>${__('prerace_pit_2', 'Pit 2')}: ${__('compound_wet', 'Wet')}</option>
                  </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
                  <div>
                    <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('prerace_aggression_label', 'Aggression')}: <strong id="driver-aggression-label-${p.id}">${cfg.aggression}</strong></div>
                    <input type="range" min="0" max="100" value="${cfg.aggression}" oninput="document.getElementById('driver-aggression-label-${p.id}').textContent=this.value; GL_SCREENS.updateDriverStrategy('${p.id}','aggression',+this.value,true)">
                  </div>
                  <div>
                    <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('prerace_risk_label', 'Risk')}: <strong id="driver-risk-label-${p.id}">${cfg.riskLevel}</strong></div>
                    <input type="range" min="0" max="100" value="${cfg.riskLevel}" oninput="document.getElementById('driver-risk-label-${p.id}').textContent=this.value; GL_SCREENS.updateDriverStrategy('${p.id}','riskLevel',+this.value,true)">
                  </div>
                </div>
                <div class="divider"></div>
                <div style="font-size:0.72rem;font-weight:700;margin-bottom:6px">${__('prerace_car_setup', 'Car Setup')}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <div>
                    <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('prerace_aero_balance', 'Aero Balance')}: <strong id="driver-aero-label-${p.id}">${cfg.setup.aeroBalance}</strong></div>
                    <input type="range" min="0" max="100" value="${cfg.setup.aeroBalance}" oninput="document.getElementById('driver-aero-label-${p.id}').textContent=this.value; GL_SCREENS.updateDriverSetup('${p.id}','aeroBalance',+this.value,true)">
                  </div>
                  <div>
                    <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('prerace_weather_bias', 'Weather Bias')}: <strong id="driver-wetbias-label-${p.id}">${cfg.setup.wetBias}</strong></div>
                    <input type="range" min="0" max="100" value="${cfg.setup.wetBias}" oninput="document.getElementById('driver-wetbias-label-${p.id}').textContent=this.value; GL_SCREENS.updateDriverSetup('${p.id}','wetBias',+this.value,true)">
                  </div>
                </div>
                <div class="divider"></div>
                <div style="font-size:0.72rem;font-weight:700;margin-bottom:6px">${__('prerace_stop_schedule', 'Stop schedule')}</div>
                <div style="font-size:0.68rem;color:var(--t-tertiary);margin-bottom:8px">${cfg.pitPlan === 'single' ? __('prerace_stop_2_hint', 'Used only for two-stop plans') : __('prerace_tactical_calls', 'Tactical Calls')}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  ${[0, 1].map((idx) => `
                    ${(() => {
                      const stopLabel = idx === 0 ? __('prerace_pit_1', 'Pit 1') : __('prerace_pit_2', 'Pit 2');
                      const disabled = idx === 1 && cfg.pitPlan === 'single';
                      return `
                    <div>
                      <div style="font-size:0.7rem;color:var(--t-tertiary);margin-bottom:4px">${stopLabel}: <strong id="driver-iv-${idx}-label-${p.id}">${cfg.interventions[idx].lapPct}%</strong></div>
                      <input type="range" min="10" max="95" value="${cfg.interventions[idx].lapPct}" oninput="document.getElementById('driver-iv-${idx}-label-${p.id}').textContent=this.value+'%'; GL_SCREENS.updateDriverIntervention('${p.id}',${idx},'lapPct',+this.value,true)" style="width:100%" ${disabled ? 'disabled' : ''}>
                    </div>
                      `;
                    })()}
                  `).join('')}
                </div>
              </div>
            ` : ''}`;
          }).join('')}
        </div>
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_circuit_intel')}</div>
          ${GL_UI.statRow(__('prerace_layout_type'), this.getTrackLayoutLabel(c.layout), '🗺️')}
          ${GL_UI.statRow(__('prerace_total_laps'), c.laps, '🔄')}
          ${GL_UI.statRow(__('prerace_circuit_len'), c.length, '📏')}
          ${GL_UI.statRow(__('prerace_rain_prob'), `${100 - c.weather}%`, '🌧️')}
          ${GL_UI.statRow(__('prerace_weather'), next.weather === 'wet' ? '🌧️ '+__('prerace_wet_adv') : '☀️ '+__('prerace_dry_norm'), '⛅')}
          ${hoursToRace !== null ? GL_UI.statRow(__('prerace_time_to_race'), `${hoursToRace}h`, '⏳') : ''}
          ${GL_UI.statRow(__('prerace_forecast_confidence'), `${fc.confidence}%`, '📡')}
          ${GL_UI.statRow(__('prerace_forecast_start'), `${fc.windows?.[0]?.wetProb || 0}% ${__('prerace_forecast_wet')}`, '🌦️')}
          ${GL_UI.statRow(__('prerace_forecast_mid'), `${fc.windows?.[1]?.wetProb || 0}% ${__('prerace_forecast_wet')}`, '🌦️')}
          ${GL_UI.statRow(__('prerace_forecast_end'), `${fc.windows?.[2]?.wetProb || 0}% ${__('prerace_forecast_wet')}`, '🌦️')}
          <div class="divider"></div>
          <div class="circuit-mini">${GL_UI.circuitSVG(c.layout)}</div>
        </div>
      </div>`;

  },

  sliderGroup(id, label, leftLabel, rightLabel, val) {
    return `<div class="slider-group">
      <div class="slider-header">
        <span class="slider-name">${label}</span>
        <span class="slider-val" id="sv-${id}">${val}</span>
      </div>
      <div style="display:flex;align-items:center;gap:var(--s-2)">
        <span style="font-size:0.7rem;color:var(--t-tertiary)">${leftLabel}</span>
        <input type="range" min="0" max="100" value="${val}" oninput="document.getElementById('sv-${id}').textContent=this.value; if(window._raceStrategy){ if('${id}'.startsWith('setup_')){ if(!window._raceStrategy.setup) window._raceStrategy.setup={ aeroBalance:50, wetBias:50 }; const k='${id}'.replace('setup_',''); window._raceStrategy.setup[k]=+this.value; } else { window._raceStrategy['${id}']=+this.value; } }" style="flex:1">
        <span style="font-size:0.7rem;color:var(--t-tertiary)">${rightLabel}</span>
      </div>
    </div>`;
  },

  selectStrategy(id, el) {
    document.querySelectorAll('.strategy-preset').forEach(e=>e.classList.remove('selected'));
    el.classList.add('selected');
    if (window._raceStrategy) window._raceStrategy.strategy = id;
    window._advisorStrategySource = 'manual';
    if (id === 'aggressive') {
      window._raceStrategy.aggression = 80;
      window._raceStrategy.riskLevel = 70;
      window._raceStrategy.engineMode = 'push';
    }
    if (id === 'conservative') {
      window._raceStrategy.aggression = 30;
      window._raceStrategy.riskLevel = 20;
      window._raceStrategy.engineMode = 'eco';
    }
    if (id === 'balanced') {
      window._raceStrategy.engineMode = 'normal';
    }
    if (id === 'tactical') {
      window._raceStrategy.engineMode = 'normal';
      window._raceStrategy.riskLevel = 45;
    }
    const modeEl = document.getElementById('sv-engineMode');
    if (modeEl) modeEl.textContent = (window._raceStrategy.engineMode || 'normal').toUpperCase();
  },

  selectTyre(t, el) {
    document.querySelectorAll('.tire-btn').forEach(e=>{ e.classList.remove('selected','soft','medium','hard','intermediate','wet'); });
    el.classList.add('selected', t);
    if (window._raceStrategy) window._raceStrategy.tyre = t;
    window._advisorStrategySource = 'manual';
  },

  selectEngineMode(mode) {
    if (!window._raceStrategy) return;
    window._raceStrategy.engineMode = mode;
    window._advisorStrategySource = 'manual';
    const el = document.getElementById('sv-engineMode');
    if (el) el.textContent = mode.toUpperCase();
  },

  applyRecommendedStrategy() {
    if (!window._raceRecommendation || !window._raceRecommendation.strategy) {
      GL_UI.toast('No recommendation available.', 'warning');
      return;
    }
    const prevPilotId = window._raceStrategy?.pilotId || null;
    window._raceStrategy = GL_STATE.deepClone(window._raceRecommendation.strategy);
    if (prevPilotId) window._raceStrategy.pilotId = prevPilotId;
    window._advisorStrategySource = 'recommended';
    GL_UI.toast('Recommendation applied. You can fine tune before saving.', 'good');
  },

  applySafeRecommendation() {
    if (!window._raceRecommendation || !window._raceRecommendation.safeAlternative) {
      GL_UI.toast('No safe variant available.', 'warning');
      return;
    }
    const prevPilotId = window._raceStrategy?.pilotId || null;
    window._raceStrategy = GL_STATE.deepClone(window._raceRecommendation.safeAlternative);
    if (prevPilotId) window._raceStrategy.pilotId = prevPilotId;
    window._advisorStrategySource = 'safe';
    GL_UI.toast('Safe variant applied. You can fine tune before saving.', 'good');
  },

  toggleRacePilot(pid) {
    if (!window._raceStrategy) return;
    const state = GL_STATE.getState();
    const rosterIds = (state.pilots || []).map((p) => p.id);
    if (!rosterIds.includes(pid)) return;
    if (!Array.isArray(window._raceStrategy.selectedPilotIds)) window._raceStrategy.selectedPilotIds = [];

    const selected = window._raceStrategy.selectedPilotIds;
    const idx = selected.indexOf(pid);
    if (idx >= 0) {
      if (selected.length <= 1) {
        GL_UI.toast('Debes mantener al menos 1 piloto en carrera.', 'warning');
        return;
      }
      selected.splice(idx, 1);
      delete window._raceStrategy.driverConfigs?.[pid];
    } else {
      if (selected.length >= 2) {
        GL_UI.toast('Solo pueden correr 2 pilotos.', 'warning');
        return;
      }
      selected.push(pid);
      this.ensureDriverConfig(pid);
    }
    window._raceStrategy.pilotId = window._raceStrategy.selectedPilotIds[0] || null;
    window._advisorStrategySource = 'manual';
    this.renderPreRace();
  },

  ensureDriverConfig(pid) {
    if (!window._raceStrategy) return null;
    if (!window._raceStrategy.driverConfigs) window._raceStrategy.driverConfigs = {};
    const normalized = this.getDriverStrategyDefaults(window._raceStrategy, window._raceStrategy.driverConfigs[pid] || {});
    window._raceStrategy.driverConfigs[pid] = GL_STATE.deepClone(normalized);
    return window._raceStrategy.driverConfigs[pid];
  },

  updateDriverStrategy(pid, key, value, silent = false) {
    const cfg = this.ensureDriverConfig(pid);
    if (!cfg) return;
    cfg[key] = key === 'pitPlan' ? this.normalizePitPlan(value) : value;
    if (key === 'pitLap' || key === 'pitPlan') this.syncDriverStopWindows(cfg);
    window._advisorStrategySource = 'manual';
    if (!silent) this.renderPreRace();
  },

  updateDriverPitTyre(pid, stopIndex, value, silent = false) {
    const cfg = this.ensureDriverConfig(pid);
    if (!cfg) return;
    if (stopIndex === 1 && cfg.pitPlan === 'single') return;
    cfg.pitTyres[stopIndex] = value;
    window._advisorStrategySource = 'manual';
    if (!silent) this.renderPreRace();
  },

  updateDriverSetup(pid, key, value, silent = false) {
    const cfg = this.ensureDriverConfig(pid);
    if (!cfg) return;
    if (!cfg.setup) cfg.setup = { aeroBalance: 50, wetBias: 50 };
    cfg.setup[key] = value;
    window._advisorStrategySource = 'manual';
    if (!silent) this.renderPreRace();
  },

  updateDriverIntervention(pid, idx, key, value, silent = false) {
    const cfg = this.ensureDriverConfig(pid);
    if (!cfg) return;
    if (!Array.isArray(cfg.interventions)) {
      cfg.interventions = [{ lapPct: 30, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }];
    }
    if (!cfg.interventions[idx]) {
      cfg.interventions[idx] = { lapPct: idx === 0 ? 30 : 70, pitBias: 'none' };
    }
    cfg.interventions[idx][key] = value;
    if (idx === 0 && key === 'lapPct') cfg.pitLap = value;
    this.syncDriverStopWindows(cfg);
    window._advisorStrategySource = 'manual';
    if (!silent) this.renderPreRace();
  },

  syncSharedToDrivers(silent = false) {
    if (!window._raceStrategy) return;
    const ids = window._raceStrategy.selectedPilotIds || [];
    if (!window._raceStrategy.driverConfigs) window._raceStrategy.driverConfigs = {};
    ids.forEach((pid) => {
      window._raceStrategy.driverConfigs[pid] = GL_STATE.deepClone(this.getDriverStrategyDefaults(window._raceStrategy, {}));
    });
    window._advisorStrategySource = 'manual';
    if (!silent) {
      GL_UI.toast('Estrategia compartida copiada a pilotos en carrera.', 'good');
      this.renderPreRace();
    }
  },

  setAdvisorMode(mode) {
    const state = GL_STATE.getState();
    if (!state.advisor) state.advisor = { mode: 'balanced', recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
    state.advisor.mode = mode;
    GL_STATE.saveState();
    GL_UI.toast(`Advisor mode set to ${mode}.`, 'info');
    this.renderPreRace();
  },

  saveStrategy() {
    const state = GL_STATE.getState();
    const nextIdx = (state.season.calendar || []).findIndex(r=>r.status==='next');
    if (nextIdx !== -1) {
      const selectedIds = (window._raceStrategy?.selectedPilotIds || []).slice(0, 2);
      selectedIds.forEach((pid) => this.ensureDriverConfig(pid));
      state.season.calendar[nextIdx].savedStrategy = GL_STATE.deepClone(window._raceStrategy || {
        tyre:'medium', strategy:'balanced', aggression:58, riskLevel:40, pitLap:42, engineMode:'normal', pitPlan:'single', safetyCarReaction:'live', setup:{ aeroBalance:50, wetBias:50 },
        pitTyres: ['hard', 'medium'],
        interventions: [{ lapPct: 42, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }],
        pilotId: (state.pilots && state.pilots[0]) ? state.pilots[0].id : null,
        selectedPilotIds: (state.pilots || []).slice(0, 2).map((p) => p.id),
        driverConfigs: {}
      });
      if (!state.season.calendar[nextIdx].savedStrategy.pilotId && state.pilots && state.pilots[0]) {
        state.season.calendar[nextIdx].savedStrategy.pilotId = state.pilots[0].id;
      }
      if (!Array.isArray(state.season.calendar[nextIdx].savedStrategy.selectedPilotIds)) {
        state.season.calendar[nextIdx].savedStrategy.selectedPilotIds = (state.pilots || []).slice(0, 2).map((p) => p.id);
      }
      if (!state.season.calendar[nextIdx].savedStrategy.driverConfigs) {
        state.season.calendar[nextIdx].savedStrategy.driverConfigs = {};
      }
      const allowedIds = new Set(state.season.calendar[nextIdx].savedStrategy.selectedPilotIds);
      Object.keys(state.season.calendar[nextIdx].savedStrategy.driverConfigs).forEach((pid) => {
        if (!allowedIds.has(pid)) delete state.season.calendar[nextIdx].savedStrategy.driverConfigs[pid];
      });
      GL_STATE.saveState();
      GL_UI.toast(window.__('prerace_strat_saved') || 'Estrategia guardada con éxito', 'good');
      this.renderPreRace();
    }
  },

  // ===== RACE SCREEN =====
  renderRace() {
    const state = GL_STATE.getState();
    if (GL_ENGINE.ensureNextRaceAvailable) {
      GL_ENGINE.ensureNextRaceAvailable();
    }
    const staffFx = GL_ENGINE.getRaceStaffEffects ? GL_ENGINE.getRaceStaffEffects(state) : null;
    const cal = state.season.calendar || [];
    const next = cal.find(r=>r.status==='next');
    const el = document.getElementById('screen-race');
    if (!el) return;
    const circuit = next?.circuit || GL_DATA.CIRCUITS[0];
    const weather = next?.weather || 'dry';
    const strategy = GL_STATE.deepClone(window._raceStrategy || next?.savedStrategy || {
      tyre:'medium', aggression:50, riskLevel:40, pitLap:42, engineMode:'normal', pitPlan:'single', safetyCarReaction:'live', setup:{ aeroBalance:50, wetBias:50 },
      pitTyres: ['hard', 'medium'],
      interventions: [{ lapPct: 42, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }],
      pilotId: (state.pilots && state.pilots[0]) ? state.pilots[0].id : null,
      selectedPilotIds: (state.pilots || []).slice(0,2).map((p) => p.id),
      driverConfigs: {}
    });
    window._raceStrategy = strategy;
    const selectedPilot = (state.pilots || []).find((p) => p.id === strategy.pilotId) || (state.pilots || [])[0] || null;
    const racePilots = (strategy.selectedPilotIds || []).map((pid) => {
      const pilot = (state.pilots || []).find((p) => p.id === pid);
      if (!pilot) return null;
      const cfg = this.getDriverStrategyDefaults(strategy, (strategy.driverConfigs && strategy.driverConfigs[pid]) || strategy);
      return { pilot, cfg };
    }).filter(Boolean);
    const runtimeMode = this.getRaceRuntimeMode();
    const runtimeLabel = runtimeMode === 'qa' ? 'QA · 2 min' : 'REAL · 30 min';
    const liveStrategySummary = racePilots.length
      ? racePilots.map((rp) => {
          const tyreMeta = this.getTyreMeta(rp.cfg.tyre);
          return `${rp.pilot.name.split(' ')[0]} ${tyreMeta.shortLabel}/${(rp.cfg.engineMode || 'normal').toUpperCase()}`;
        }).join(' · ')
      : `${this.getTyreMeta(strategy.tyre).shortLabel}/${(strategy.engineMode || 'normal').toUpperCase()}`;

    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('race_eyebrow')} ${next?.round||1}</div>
          <div class="screen-title">${circuit.name}</div>
          <div class="screen-subtitle">${weather==='wet'?'🌧️':'☀️'} ${weather} ${__('race_conditions')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.setRaceRuntimeMode('real')" ${runtimeMode === 'real' ? 'style="border-color:var(--c-accent);color:var(--c-accent)"' : ''}>REAL 30m</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.setRaceRuntimeMode('qa')" ${runtimeMode === 'qa' ? 'style="border-color:var(--c-accent);color:var(--c-accent)"' : ''}>QA 2m</button>
          <button class="btn btn-primary" id="race-sim-btn" onclick="GL_SCREENS.runSimulation()">${__('race_sim_btn')}</button>
        </div>
      </div>
      <div class="race-layout">
        <div class="race-track-view">
          <div class="race-track-bg"></div>
          <div class="race-status-bar" id="race-status-bar">
            <span class="race-lap-counter" id="race-lap">🏁 ${__('race_ready')}</span>
            <span class="race-condition">${weather==='wet'?'🌧️':'☀️'} ${weather.charAt(0).toUpperCase()+weather.slice(1)} · ${circuit.laps} ${__('laps')}</span>
            <span style="margin-left:auto;font-size:0.8rem;color:var(--t-secondary)">${liveStrategySummary} · ⏱️ ${runtimeLabel}</span>
          </div>
          ${this.getRaceTrackStageMarkup(circuit, weather)}
          <div class="race-event-log" id="race-event-log">
            <div class="race-event" style="border-color:var(--c-border)">
              <span class="race-event-text">🏁 ${__('race_press_start')}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">${__('race_grid_position')}</div>
            <div class="race-grid-list" id="race-grid-list">
              <div style="color:var(--t-tertiary);font-size:0.82rem;padding:var(--s-4) 0">${__('race_grid_appear')}</div>
            </div>
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('race_strat_active')}</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-top:var(--s-3)">
              ${GL_UI.statRow(__('race_sc_reaction', 'Safety Car reaction'), __('race_sc_live_managed', 'Live by the staff'), '🟡')}
              ${GL_UI.statRow(__('race_intervention_1', 'Intervention 1'), `${strategy.interventions?.[0]?.lapPct || 30}%`, '🎛️')}
              ${GL_UI.statRow(__('race_intervention_2', 'Intervention 2'), `${strategy.interventions?.[1]?.lapPct || 70}%`, '🎛️')}
              ${GL_UI.statRow(__('race_setup_aero', 'Aero setup'), `${strategy.setup?.aeroBalance ?? 50}%`, '🛩️')}
              ${GL_UI.statRow(__('race_setup_weather', 'Weather setup'), `${strategy.setup?.wetBias ?? 50}%`, '🌧️')}
              ${racePilots.map((rp, idx) => {
                const tyreMeta = this.getTyreMeta(rp.cfg.tyre);
                return GL_UI.statRow(`${__('race_driver', 'Driver')} ${idx+1}`, `${rp.pilot.name} · ${tyreMeta.label} · ${this.getEngineModeLabel(rp.cfg.engineMode || 'normal')} · ${this.getPitPlanLabel(rp.cfg.pitPlan || 'single')} · ${__('prerace_pit_1', 'Pit 1')} ${this.getPrimaryStopLapPct(rp.cfg, 50)}%`, '🧑‍✈️');
              }).join('')}
              ${racePilots.length === 0 && selectedPilot ? GL_UI.statRow(__('race_primary_driver', 'Lead driver'), `${selectedPilot.name} (${GL_ENGINE.pilotScore(selectedPilot)})`, '🧑‍✈️') : ''}
              ${staffFx ? GL_UI.statRow(__('race_staff_pit_quality', 'Pit crew efficiency'), `${Math.round(staffFx.pitTimeGainChance * 100)}%`, '👥') : ''}
              ${staffFx ? GL_UI.statRow(__('race_staff_risk_control', 'Risk control'), `${Math.round((1 - staffFx.incidentRiskMult) * 100)}%`, '🧠') : ''}
            </div>
          </div>
        </div>
      </div>`;

    this.renderRaceTrackVisualization({
      liveOrder: [],
      progress: 0,
      totalLaps: circuit.laps || 1,
      currentLap: 1,
      circuit,
      weather
    });
  },

  runSimulation() {
    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const nextIdx = cal.findIndex(r=>r.status==='next');
    const next = cal[nextIdx];
    if (nextIdx < 0 || !next) {
      GL_UI.toast('No hay una carrera marcada como siguiente.', 'warning');
      return;
    }
    const strategy = window._raceStrategy || {
      tyre:'medium', aggression:50, riskLevel:40, pitLap:42, engineMode:'normal', pitPlan:'single', safetyCarReaction:'live', setup:{ aeroBalance:50, wetBias:50 },
      pitTyres: ['hard', 'medium'],
      interventions: [{ lapPct: 42, pitBias: 'none' }, { lapPct: 70, pitBias: 'none' }],
      pilotId: (state.pilots && state.pilots[0]) ? state.pilots[0].id : null
    };
    const strategySource = ['recommended', 'safe', 'manual'].includes(window._advisorStrategySource)
      ? window._advisorStrategySource
      : 'manual';

    document.getElementById('race-sim-btn').disabled = true;
    document.getElementById('race-sim-btn').textContent = `⏳ ${__('race_racing')}`;
    window._raceInProgress = true;

    let result;
    try {
      result = GL_ENGINE.simulateRace({
        weather: next?.weather || 'dry',
        circuits: next?.circuit || GL_DATA.CIRCUITS[0],
        round: next?.round || 1,
        forecast: next?.forecast || null,
        strategy,
        pilotId: strategy.pilotId,
        selectedPilotIds: strategy.selectedPilotIds || [],
        driverStrategies: strategy.driverConfigs || {}
      });
    } catch (err) {
      window._raceInProgress = false;
      document.getElementById('race-sim-btn').disabled = false;
      document.getElementById('race-sim-btn').textContent = __('race_sim_btn');
      GL_UI.toast('Error al iniciar simulación de carrera.', 'warning');
      throw err;
    }

    window._lastRaceResult = result;

    const log = document.getElementById('race-event-log');
    if (log) log.innerHTML = '';
    const lapEl = document.getElementById('race-lap');
    const raceDurationMs = this.getRaceRuntimeDurationMs();
    const startTs = Date.now();
    const allEvents = Array.isArray(result.events) ? result.events : [];
    const totalLaps = result.totalLaps || 30;
    const gridStart = Array.isArray(result.gridStart) ? result.gridStart : [];
    const finalGrid = Array.isArray(result.finalGrid) ? result.finalGrid : [];
    const lapSnapshots = Array.isArray(result.lapSnapshots) ? result.lapSnapshots : [];
    const playerEventPilotNames = this.getPlayerEventPilotNames(result.playerCars);
    const startPosMap = {};
    const finalPosMap = {};

    gridStart.forEach((car, idx) => { startPosMap[car.id] = idx + 1; });
    finalGrid.forEach((car, idx) => { finalPosMap[car.id] = idx + 1; });

    let eventCursor = 0;
    let tick = 0;
    let finished = false;

    const formatRemaining = (ms) => {
      const sec = Math.max(0, Math.ceil(ms / 1000));
      const mm = Math.floor(sec / 60);
      const ss = sec % 60;
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    const renderLiveGrid = (live) => {
      const gl = document.getElementById('race-grid-list');
      if (!gl) return;

      gl.innerHTML = live.slice(0, 20).map((car, idx) => {
        const gap = idx === 0
          ? __('race_leader')
          : (Number.isFinite(car.gapMs)
              ? `+${(car.gapMs / 1000).toFixed(1)}s`
              : `+${(idx * 0.9).toFixed(1)}s`);
        const dotColor = car.color || '#888';
        const tyreMeta = this.getTyreMeta(car.tyre);
        const status = car.retired
          ? 'DNF'
          : car.pit
            ? `BOX ${Number.isFinite(car.pitLossMs) && car.pitLossMs > 0 ? `· -${(car.pitLossMs / 1000).toFixed(1)}s` : ''}`
            : gap;
        return `
          <div class="race-pos-row ${car.isPlayer?'my-car':''}" style="--team-color:${dotColor}">
            <span class="race-pos-num">${car.pos || (idx + 1)}</span>
            <span class="race-pos-teamdot" style="background:${dotColor}"></span>
            <span class="race-pos-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
            <span class="race-pos-tire" title="${tyreMeta.label}" style="color:${tyreMeta.color};font-weight:800">${tyreMeta.shortLabel}</span>
            <span class="race-pos-gap">${status}</span>
          </div>`;
      }).join('');
    };

    const finishRace = () => {
      if (finished) return;
      finished = true;

      result.performanceReport = GL_ENGINE.buildRacePerformanceReport
        ? GL_ENGINE.buildRacePerformanceReport(result, state)
        : null;
      result.adminReport = GL_ENGINE.buildRaceAdminReport
        ? GL_ENGINE.buildRaceAdminReport(result, state)
        : null;
      const archiveRecord = GL_ENGINE.buildRaceArchiveRecord
        ? GL_ENGINE.buildRaceArchiveRecord(result, {
            round: next?.round || result.round || 0,
            weather: next?.weather || result.weather || 'dry'
          }, state)
        : null;

      GL_ENGINE.updateStandings(result);
      if (nextIdx >= 0 && cal[nextIdx]) {
        cal[nextIdx].status = 'completed';
        cal[nextIdx].result = archiveRecord || { position: result.position, points: result.points, playerCars: result.playerCars || [] };
      }
      if (nextIdx + 1 < cal.length) cal[nextIdx + 1].status = 'next';
      if (GL_ENGINE.ensureNextRaceAvailable) GL_ENGINE.ensureNextRaceAvailable();
      state.season.raceIndex = nextIdx + 1;
      const prize = Number.isFinite(result.prizeMoney) ? result.prizeMoney : Number(result.prizeMoney || 0);
      const economySummary = GL_ENGINE.applyRaceWeekendEconomy
        ? GL_ENGINE.applyRaceWeekendEconomy(result)
        : {
            creditsBefore: GL_STATE.getCredits(),
            creditsAfterPrize: GL_STATE.getCredits(),
            creditsAfterWeekly: GL_STATE.getCredits(),
            prizeDelta: prize,
            weeklyNetDelta: 0,
            totalDelta: prize,
            weeklyEconomy: { net: 0, income: 0, expenses: 0 }
          };
      const carSummary = (result.playerCars || []).map((c) => `${c.pilotName}:P${c.position}`).join(' · ');
      GL_STATE.addLog(`🏁 Round ${next?.round}: ${carSummary || ('P' + result.position)} · Team ${result.points} pts · +${GL_UI.fmtCR(prize)} CR`, 'good');
      if (GL_STATE.addNotification) {
        const roundLabel = next?.round || result.round || state.season.raceIndex || 0;
        GL_STATE.addNotification({
          text: (__('topbar_notif_race_report_ready') || 'Race report ready: Round {round}.')
            .replace('{round}', roundLabel),
          type: 'good'
        });
      }
      if (window.GL_DASHBOARD && typeof GL_DASHBOARD.updateTopbar === 'function') {
        GL_DASHBOARD.updateTopbar(GL_STATE.getState());
      }
      if (economySummary.prizeDelta > 0 || economySummary.weeklyNetDelta !== 0) {
        const weeklyLabel = economySummary.weeklyNetDelta === 0
          ? ''
          : ` · Balance semanal ${economySummary.weeklyNetDelta > 0 ? '+' : '-'}${GL_UI.fmtCR(Math.abs(economySummary.weeklyNetDelta))} CR`;
        GL_UI.toast(`Premio de carrera +${GL_UI.fmtCR(economySummary.prizeDelta)} CR${weeklyLabel} · Saldo ${GL_UI.fmtCR(economySummary.creditsBefore)} -> ${GL_UI.fmtCR(economySummary.creditsAfterWeekly)} CR`, economySummary.totalDelta >= 0 ? 'good' : 'info');
      }

      if (GL_ENGINE.recordStrategyOutcome) {
        GL_ENGINE.recordStrategyOutcome(next, strategy, result, {
          source: strategySource,
          mode: (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced'
        });
      }
      window._advisorStrategySource = 'manual';

      state.car.rnd.points = (state.car.rnd.points || 0) + 5 + Math.floor(Math.random() * 5);
      state.team.fans += 100 + (result.points || 0) * 50;
      if (archiveRecord && GL_ENGINE.upsertRaceArchiveRecord) {
        GL_ENGINE.upsertRaceArchiveRecord(state, archiveRecord);
      }

      GL_STATE.saveState();
      window._raceInProgress = false;

      setTimeout(() => GL_APP.navigateTo('postrace'), 1000);
    };

    let liveAnimationFrame = null;
    const runLivePlayback = () => {
      tick += 1;
      const elapsed = Date.now() - startTs;
      const progress = Math.max(0, Math.min(1, elapsed / raceDurationMs));
      const lapProgress = progress * totalLaps;
      const currentLap = Math.max(1, Math.min(totalLaps, Math.floor(lapProgress) + 1));
      const lapBlend = lapProgress % 1;
      const remaining = raceDurationMs - elapsed;
      const liveOrder = this.buildLiveRaceOrder({
        lapSnapshots,
        currentLap,
        lapBlend,
        finalGrid,
        startPosMap,
        finalPosMap,
        progress,
        tick
      });
      const currentSnapshot = lapSnapshots[currentLap - 1];
      const liveWeather = currentSnapshot?.weather || result.weather || next?.weather || 'dry';

      if (lapEl) {
        lapEl.textContent = `🏁 ${__('race_lap')} ${currentLap} / ${totalLaps} · ${formatRemaining(remaining)}`;
      }

      const shouldShowEvents = Math.floor(progress * allEvents.length);
      while (eventCursor < shouldShowEvents) {
        const ev = allEvents[eventCursor];
        if (log) {
          const div = document.createElement('div');
          const teamHighlightClass = this.isPlayerRelatedRaceEvent(ev.text, playerEventPilotNames) ? 'team-highlight' : '';
          div.className = `race-event ${ev.type} ${teamHighlightClass}`.trim();
          div.innerHTML = `<span class="race-event-lap">${__('race_lap_short')} ${ev.lap}</span><span class="race-event-text">${ev.text}</span>`;
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        eventCursor += 1;
      }

      renderLiveGrid(liveOrder);
      this.renderRaceTrackVisualization({
        liveOrder,
        progress,
        totalLaps,
        currentLap,
        circuit: result.circuit || next?.circuit || GL_DATA.CIRCUITS[0],
        weather: liveWeather
      });

      if (progress >= 1) {
        if (liveAnimationFrame !== null) {
          cancelAnimationFrame(liveAnimationFrame);
          liveAnimationFrame = null;
        }
        finishRace();
        return;
      }

      liveAnimationFrame = requestAnimationFrame(runLivePlayback);
    };

    liveAnimationFrame = requestAnimationFrame(runLivePlayback);
  },

  // ===== POST-RACE SCREEN =====
  renderPostRace() {
    const result = window._lastRaceResult;
    const el = document.getElementById('screen-postrace');
    if (!el) return;
    if (!result) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('postrace_no_result')}</p></div>`; return; }
    const playerCars = (Array.isArray(result.playerCars) ? result.playerCars : [])
      .slice()
      .sort((a, b) => {
        const posA = a?.isDNF ? 999 : Number(a?.position || 999);
        const posB = b?.isDNF ? 999 : Number(b?.position || 999);
        return posA - posB;
      });
    const playerEventPilotNames = this.getPlayerEventPilotNames(playerCars);
    const leadCar = playerCars[0] || { position: result.position, isDNF: result.isDNF, pilotName: 'Driver', points: result.points };
    const teamResultSummary = (playerCars.length ? playerCars : [leadCar])
      .map((car) => `${car.pilotName || __('race_driver', 'Driver')} ${car.isDNF ? 'DNF' : `P${car.position}`}`)
      .join(' · ');
    const teamResultHeadline = (playerCars.length ? playerCars : [leadCar])
      .map((car) => `<span class="badge ${car.isDNF ? 'badge-red' : 'badge-blue'}" style="font-size:0.74rem;padding:6px 10px">${car.pilotName || __('race_driver', 'Driver')}: ${car.isDNF ? 'DNF' : `P${car.position}`}</span>`)
      .join(' ');
    const posColor = leadCar.position <= 1 ? 'var(--c-gold)' : leadCar.position <= 3 ? '#cd7c32' : leadCar.position <= 8 ? 'var(--c-green)' : 'var(--t-primary)';
    const state = GL_STATE.getState();
    const performanceReport = result.performanceReport || (GL_ENGINE.buildRacePerformanceReport ? GL_ENGINE.buildRacePerformanceReport(result, state) : null);
    if (performanceReport && !result.performanceReport) result.performanceReport = performanceReport;
    const adminReport = result.adminReport || (GL_ENGINE.buildRaceAdminReport ? GL_ENGINE.buildRaceAdminReport(result, state) : null);
    if (adminReport && !result.adminReport) result.adminReport = adminReport;
    const crashReports = playerCars
      .filter((car) => car && car.isDNF)
      .map((car) => ({
        pilotName: car.pilotName,
        report: car.crashReport || null
      }));
    const crashReviewHtml = crashReports.length
      ? `<div class="card mb-4">
          <div class="section-eyebrow">${__('postrace_crash_review_title', 'Driver Incident Review')}</div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">
            ${crashReports.map((entry) => {
              const report = entry.report || {};
              const causes = Array.isArray(report.causes) && report.causes.length
                ? report.causes
                : [__('crash_cause_generic', 'Incident likely came from race variance under pressure conditions.')];
              const tips = Array.isArray(report.tips) && report.tips.length
                ? report.tips
                : [__('crash_tip_generic', 'Use a slightly safer baseline and escalate only after stable pace is confirmed.')];
              const lapLabel = Number.isFinite(report.lap)
                ? `${__('race_lap_short')} ${report.lap}${Number.isFinite(report.totalLaps) ? `/${report.totalLaps}` : ''}`
                : __('postrace_crash_review_lap_unknown', 'Lap unknown');
              return `
                <div style="padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;background:rgba(255,255,255,0.02)">
                  <div style="font-weight:700;color:var(--c-red)">${entry.pilotName || __('race_driver', 'Driver')} · DNF</div>
                  <div style="font-size:0.78rem;color:var(--t-secondary);margin:2px 0 8px 0">${__('postrace_crash_review_probable', 'Probable incident context')}: ${lapLabel}</div>
                  <div style="font-size:0.78rem;color:var(--t-secondary);margin-bottom:4px">${__('postrace_crash_review_causes', 'Likely causes')}</div>
                  <ul style="margin:0 0 10px 18px;padding:0;display:flex;flex-direction:column;gap:4px">${causes.map((line) => `<li>${line}</li>`).join('')}</ul>
                  <div style="font-size:0.78rem;color:var(--t-secondary);margin-bottom:4px">${__('postrace_crash_review_tips', 'How to avoid next time')}</div>
                  <ul style="margin:0 0 0 18px;padding:0;display:flex;flex-direction:column;gap:4px">${tips.map((line) => `<li>${line}</li>`).join('')}</ul>
                </div>`;
            }).join('')}
          </div>
        </div>`
      : '';
    const strategyRows = (Array.isArray(result.finalGrid) ? result.finalGrid : []).map((car, idx) => {
      const summary = this.formatPitStrategySummary(car.strategy || {});
      return `
        <div class="postrace-strategy-row ${car.isPlayer ? 'my-car' : ''}">
          <div class="postrace-strategy-main">
            <span class="postrace-strategy-pos">P${idx + 1}</span>
            <span class="postrace-strategy-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
            <span class="postrace-strategy-plan">${summary.planLabel}</span>
          </div>
          <div class="postrace-strategy-meta">
            <span>${summary.stopSummary}</span>
            <span>${summary.tyreSummary}</span>
          </div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('postrace_eyebrow')}</div>
          <div class="screen-title">${__('postrace_title')}</div>
          <div class="screen-subtitle">${result.circuit?.name || 'Last Race'} · ${result.weather === 'wet' ? '🌧️' : '☀️'}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('dashboard')">← ${__('dashboard')}</button>
          <button class="btn btn-primary" onclick="GL_APP.navigateTo('prerace')">${__('postrace_next')} →</button>
        </div>
      </div>
      <div class="post-race-hero">
        <div class="post-race-position">
          <div class="post-race-pos-num" style="color:${posColor}">${leadCar.isDNF ? 'DNF' : 'P'+leadCar.position}</div>
          <div class="post-race-pos-label">${leadCar.isDNF ? __('postrace_dnf') : leadCar.position === 1 ? '🏆 '+__('postrace_winner') : leadCar.position <= 3 ? '🥇 '+__('postrace_podium') : __('postrace_classified')}</div>
        </div>
        <div class="post-race-info">
          <div class="post-race-title">${leadCar.isDNF ? __('postrace_mech_fail') : leadCar.position === 1 ? __('postrace_victory') : leadCar.position <= 3 ? __('postrace_podium_fin') : `${__('race_team_cars')}: ${teamResultSummary}`}</div>
            <div style="color:var(--t-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap">${result.circuit?.name} · ${__('postrace_weather')}: ${this.getWeatherLabel(result.weather)} ${teamResultHeadline}</div>
          <div class="post-race-metrics">
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-gold)">${result.points}</div><div class="post-race-metric-label">${__('postrace_team_points')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${GL_UI.fmtCR(result.economySummary?.prizeDelta ?? result.prizeMoney)}</div><div class="post-race-metric-label">${__('postrace_prize')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:${(result.economySummary?.weeklyNetDelta || 0) >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${(result.economySummary?.weeklyNetDelta || 0) > 0 ? '+' : ''}${GL_UI.fmtCR(Math.abs(result.economySummary?.weeklyNetDelta || 0))}</div><div class="post-race-metric-label">${__('postrace_weekly_balance', 'Weekly balance')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:${(result.economySummary?.totalDelta || 0) >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${(result.economySummary?.totalDelta || 0) > 0 ? '+' : ''}${GL_UI.fmtCR(Math.abs(result.economySummary?.totalDelta || 0))}</div><div class="post-race-metric-label">${__('postrace_credit_delta', 'Total credit delta')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val">${GL_UI.fmtCR(result.economySummary?.creditsBefore || 0)}</div><div class="post-race-metric-label">${__('postrace_credits_before', 'Credits before')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val">${GL_UI.fmtCR(result.economySummary?.creditsAfterWeekly || 0)}</div><div class="post-race-metric-label">${__('postrace_credits_after', 'Credits after')}</div></div>
            <div class="post-race-metric"><div class="post-race-metric-val">${leadCar.improvement < 0 ? '▲'+Math.abs(leadCar.improvement) : leadCar.improvement > 0 ? '▼'+leadCar.improvement : '—'}</div><div class="post-race-metric-label">${__('postrace_vs_grid')}</div></div>
          </div>
        </div>
      </div>
      ${crashReviewHtml}
      <div class="card mb-4">
        <div class="section-eyebrow">${__('postrace_admin_report')}</div>
        <div style="margin-top:10px">${this.renderRaceAdminReport(adminReport, { compact: true, copyAction: 'GL_SCREENS.copyRaceAdminReport()' })}</div>
      </div>
      <div class="card mb-4">
        <div class="section-eyebrow">${__('postrace_performance_report')}</div>
        <div style="margin-top:10px">${this.renderRacePerformanceReport(performanceReport, { compact: true })}</div>
      </div>
      <div class="grid-2">
        <div class="card">
            <div class="section-eyebrow">${__('race_team_cars')}</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0 14px 0">
            ${(playerCars.length ? playerCars : [{ pilotName: 'Driver', position: result.position, points: result.points, isDNF: result.isDNF }]).map((car) => `
              <div class="fin-item"><span>${car.pilotName}</span><strong>${car.isDNF ? 'DNF' : ('P'+car.position)} · ${car.points || 0} pts</strong></div>
            `).join('')}
          </div>
          <div class="section-eyebrow">${__('postrace_events')}</div>
          <div class="race-event-log" style="max-height:250px;overflow-y:auto">
            ${result.events.map(ev => `<div class="race-event ${ev.type} ${this.isPlayerRelatedRaceEvent(ev.text, playerEventPilotNames) ? 'team-highlight' : ''}"><span class="race-event-lap">L${ev.lap}</span><span class="race-event-text">${ev.text}</span></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('postrace_class')}</div>
          <div class="race-grid-list">
            ${result.finalGrid.slice(0,10).map((car, i) => `
              <div class="race-pos-row ${car.isPlayer?'my-car':''}">
                <span class="race-pos-num">${i+1}</span>
                <span class="race-pos-name">${car.isPlayer?'<strong style="color:var(--c-accent)">'+car.name+'</strong>':car.name}</span>
                <span style="font-size:0.78rem;color:var(--c-gold)">${GL_DATA.POINTS_TABLE[i]||0} pts</span>
              </div>`).join('')}
          </div>
          <div class="divider"></div>
          <div class="section-eyebrow">${__('postrace_box_strategy_audit', 'Pit Strategy Audit')}</div>
          <div class="postrace-strategy-list">
            ${strategyRows}
          </div>
        </div>
      </div>`;
  },

};

window.GL_SCREENS = SCREENS;
