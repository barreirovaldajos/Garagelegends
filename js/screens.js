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

  getSliderHint(field, val) {
    const hints = {
      aggression: [
        { max: 25, text: 'Conservador · pocas maniobras, mínimo desgaste de neumáticos' },
        { max: 50, text: 'Equilibrado · ritmo estable con desgaste moderado' },
        { max: 75, text: 'Agresivo · más adelantamientos, mayor desgaste de neumáticos' },
        { max: 100, text: 'Muy agresivo · máximo ritmo, alto riesgo de pinchazo' },
      ],
      riskLevel: [
        { max: 25, text: 'Seguro · protege de incidentes, evita maniobras comprometidas' },
        { max: 50, text: 'Calculado · balance entre oportunidad y seguridad' },
        { max: 75, text: 'Arriesgado · más oportunidades, posibles incidentes en pista' },
        { max: 100, text: 'Temerario · todo o nada, alto riesgo de abandono' },
      ],
      aeroBalance: [
        { max: 30, text: 'Alta carga aerodinámica · mejor grip en curvas, rectas más lentas' },
        { max: 60, text: 'Balance neutro · equilibrio entre velocidad y adherencia' },
        { max: 80, text: 'Baja carga · más velocidad en rectas, menos grip en curvas' },
        { max: 100, text: 'Configuración de recta · velocidad máxima, poco agarre' },
      ],
      wetBias: [
        { max: 25, text: 'Setup seco · óptimo para pista seca, penaliza en lluvia' },
        { max: 50, text: 'Setup mixto · adaptable a condiciones cambiantes' },
        { max: 75, text: 'Setup mojado · mejor en lluvia, penaliza en pista seca' },
        { max: 100, text: 'Full lluvia · máximo rendimiento bajo lluvia intensa' },
      ],
    };
    const list = hints[field] || [];
    return list.find(h => val <= h.max)?.text || list[list.length - 1]?.text || '';
  },

  driverSliderHtml(pid, field, label, val, updateFn) {
    const hint = this.getSliderHint(field, val);
    const intensity = val <= 30 ? 'low' : val <= 65 ? 'mid' : 'high';
    const accentColor = val <= 30 ? 'var(--c-green)' : val <= 65 ? 'var(--c-gold)' : 'var(--c-red)';
    return `
      <div class="ds-block">
        <div class="ds-header">
          <span class="ds-label">${label}</span>
          <span class="ds-val ds-val--${intensity}" id="ds-val-${field}-${pid}">${val}</span>
        </div>
        <input type="range" min="0" max="100" value="${val}" class="ds-range" style="accent-color:${accentColor}"
          oninput="const v=+this.value; const i=v<=30?'low':v<=65?'mid':'high'; const c=v<=30?'var(--c-green)':v<=65?'var(--c-gold)':'var(--c-red)'; this.style.accentColor=c; const vEl=document.getElementById('ds-val-${field}-${pid}'); vEl.textContent=v; vEl.className='ds-val ds-val--'+i; document.getElementById('ds-hint-${field}-${pid}').textContent=GL_SCREENS.getSliderHint('${field}',v); ${updateFn}">
        <div class="ds-hint" id="ds-hint-${field}-${pid}">${hint}</div>
      </div>`;
  },

  driverPitSliderHtml(pid, idx, val, disabled) {
    const stopLabel = idx === 0 ? 'Parada 1' : 'Parada 2';
    const hint = val < 35 ? 'Parada temprana · buena para undercut y neutralizar Safety Car' : val < 60 ? 'Parada media · equilibrio entre frescura de neumático y tiempo en pista' : 'Parada tardía · extiende el stint, útil para cubrir a rivales';
    const pitAccent = val < 35 ? 'var(--c-green)' : val < 60 ? 'var(--c-gold)' : 'var(--c-red)';
    return `
      <div class="ds-block">
        <div class="ds-header">
          <span class="ds-label">${stopLabel}</span>
          <span class="ds-val" id="ds-val-iv${idx}-${pid}">${val}%</span>
        </div>
        <input type="range" min="10" max="95" value="${val}" class="ds-range" style="accent-color:${pitAccent}" ${disabled ? 'disabled' : ''}
          oninput="const v=+this.value; const c=v<35?'var(--c-green)':v<60?'var(--c-gold)':'var(--c-red)'; this.style.accentColor=c; document.getElementById('ds-val-iv${idx}-${pid}').textContent=v+'%'; document.getElementById('ds-hint-iv${idx}-${pid}').textContent=v<35?'Parada temprana · buena para undercut y neutralizar Safety Car':v<60?'Parada media · equilibrio entre frescura de neumático y tiempo en pista':'Parada tardía · extiende el stint, útil para cubrir a rivales'; GL_SCREENS.updateDriverIntervention('${pid}',${idx},'lapPct',v,true)">
        <div class="ds-hint ${disabled ? 'ds-hint--disabled' : ''}" id="ds-hint-iv${idx}-${pid}">${disabled ? 'Solo activo con dos paradas' : hint}</div>
      </div>`;
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
    const currentEffectLine = currentLevel > 0 && currentLevelData?.effect
      ? `<span style="color:var(--c-gold);display:block;margin-bottom:2px">✓ ${currentLevelData.effect}</span>`
      : '';
    if (!nextLevelData) {
      return currentLevel > 0 && currentLevelData?.effect
        ? `<span style="color:var(--c-gold)">✓ ${currentLevelData.effect}</span>`
        : 'Nivel maximo alcanzado';
    }

    const beforeCaps = this.getHqCapabilitySnapshot(state);
    const afterCaps = this.getHqCapabilitySnapshot(state, def.id, currentLevel + 1);
    if (!beforeCaps || !afterCaps) return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;

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
        return `${currentEffectLine}Prox. nivel: +${pct}% ingresos por sponsors${estimate}`;
      }
      return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'rnd') {
      const speedPct = Math.round((afterCaps.rndSpeedMultiplier - beforeCaps.rndSpeedMultiplier) * 100);
      if (!beforeCaps.rndUnlocked && afterCaps.rndUnlocked) return `${currentEffectLine}Prox. nivel: desbloquea I+D`;
      if (speedPct > 0) {
        const beforeSpeed = Number(beforeCaps.rndSpeedMultiplier || 1);
        const afterSpeed = Number(afterCaps.rndSpeedMultiplier || 1);
        const durationCutPct = Math.round((1 - (beforeSpeed / Math.max(afterSpeed, 1))) * 100);
        if (durationCutPct > 0) return `${currentEffectLine}Prox. nivel: +${speedPct}% velocidad I+D (~-${durationCutPct}% tiempo por proyecto)`;
        return `${currentEffectLine}Prox. nivel: +${speedPct}% velocidad de I+D`;
      }
      return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'factory') {
      const slotsDelta = (afterCaps.factoryParallelSlots || 1) - (beforeCaps.factoryParallelSlots || 1);
      if (slotsDelta > 0) return `${currentEffectLine}Prox. nivel: +${slotsDelta} cola paralela de I+D (mas progreso simultaneo)`;
      return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;
    }

    if (def.id === 'academy') {
      const speedPct = Math.round((afterCaps.academyTrainingSpeedMultiplier - beforeCaps.academyTrainingSpeedMultiplier) * 100);
      const slotsDelta = (afterCaps.academyTrainingSlots || 1) - (beforeCaps.academyTrainingSlots || 1);
      if (slotsDelta > 0 && speedPct > 0) {
        const beforeSpeed = Number(beforeCaps.academyTrainingSpeedMultiplier || 1);
        const afterSpeed = Number(afterCaps.academyTrainingSpeedMultiplier || 1);
        const durationCutPct = Math.round((1 - (beforeSpeed / Math.max(afterSpeed, 1))) * 100);
        return durationCutPct > 0
          ? `${currentEffectLine}Prox. nivel: +${slotsDelta} slot y +${speedPct}% entreno (~-${durationCutPct}% tiempo)`
          : `${currentEffectLine}Prox. nivel: +${slotsDelta} slot y +${speedPct}% entreno`;
      }
      if (slotsDelta > 0) return `${currentEffectLine}Prox. nivel: +${slotsDelta} slot de entrenamiento`;
      if (speedPct > 0) return `${currentEffectLine}Prox. nivel: +${speedPct}% velocidad de entrenamiento`;
      return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;
    }

    return `${currentEffectLine}Mejora: ${nextLevelData.effect}`;
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

  getRaceTrackLayoutProfile(key) {
    const circuits = {
      // c1: Silverstone — high-speed, wide sweeping arcs, Maggotts/Becketts complex
      c1: { points: [[182,138],[410,106],[692,106],[870,132],[946,196],[932,310],[872,382],[810,420],[838,496],[896,554],[738,572],[540,554],[342,554],[182,518],[118,415],[122,295],[150,212]], scaleX:1,scaleY:1 },
      // c2: Circuit de la Sarthe — endurance, very long straights, tight chicane sectors
      c2: { points: [[182,132],[500,100],[840,132],[910,195],[905,290],[848,352],[796,380],[820,445],[892,515],[905,565],[720,575],[508,562],[295,562],[165,540],[118,460],[125,365],[155,275],[168,210]], scaleX:1,scaleY:1 },
      // c3: Monza — power, two long parallel straights, tight chicane complex, Parabolica
      c3: { points: [[185,138],[395,108],[645,108],[848,138],[922,200],[910,312],[848,380],[820,416],[848,488],[914,550],[750,572],[545,556],[346,558],[185,524],[118,450],[122,348],[142,268],[165,210]], scaleX:1,scaleY:1 },
      // c4: Spa-Francorchamps — L-shaped: top straight, Raidillon dip, long Kemmel, Bus Stop deep into bottom-right
      c4: { points: [[180,132],[415,105],[685,105],[878,132],[935,195],[925,305],[872,362],[808,398],[840,472],[912,548],[758,572],[548,558],[350,560],[195,540],[122,462],[126,368],[152,268],[168,205]], scaleX:1,scaleY:1 },
      // c5: Barcelona — tight technical sector, many direction changes, slow hairpin, compact mid-section
      c5: { points: [[200,138],[355,115],[545,112],[725,132],[808,178],[792,242],[726,282],[668,305],[682,362],[730,412],[758,462],[742,520],[628,555],[488,555],[352,542],[258,516],[205,464],[185,398],[210,338],[248,305],[212,258],[182,210]], scaleX:1,scaleY:1 },
      // c6: Suzuka — technical, sweeping S-curves, 130R, Degner curves, Spoon
      c6: { points: [[205,145],[420,112],[658,112],[845,145],[922,205],[905,318],[848,385],[790,422],[820,498],[892,558],[730,578],[525,560],[328,558],[188,525],[122,420],[128,305],[160,220]], scaleX:1,scaleY:1 },
      // c7: Interlagos — compact heart-shape, Senna S double-kink mid-track, tight stadium section bottom
      c7: { points: [[200,138],[368,112],[568,112],[768,132],[848,188],[832,260],[778,305],[728,298],[692,318],[712,365],[758,402],[788,445],[770,490],[718,525],[640,548],[530,552],[420,542],[332,518],[268,488],[220,448],[188,390],[192,328],[218,278],[210,238],[200,188]], scaleX:1,scaleY:1 },
      // c8: Hockenheimring — power, two long straights, three hairpins, stadium complex
      c8: { points: [[188,138],[500,108],[825,138],[902,200],[900,312],[850,375],[812,402],[850,440],[902,505],[858,562],[688,575],[488,558],[282,560],[158,530],[118,450],[122,350],[145,272],[170,212]], scaleX:1,scaleY:1 },
      // c9: Brands Hatch — technical, compact bowl, Paddock Hill, Druids hairpin
      c9: { points: [[215,148],[420,118],[625,118],[802,150],[882,210],[870,315],[815,378],[760,412],[792,475],[862,540],[730,570],[528,558],[342,560],[195,532],[128,458],[130,360],[154,270],[180,212]], scaleX:1,scaleY:1 },
      // c10: Portimão — mixed, flowing, sweeping cambered bends, blind crests
      c10: { points: [[180,130],[360,108],[622,108],[820,132],[905,192],[888,275],[822,332],[748,374],[812,450],[885,525],[764,565],[562,548],[400,528],[298,565],[222,525],[188,450],[242,370],[318,310],[260,254],[176,212]], scaleX:1,scaleY:1 },
      // c11: Mugello — power, long front straight, fast flowing Arrabbiata, tight Casanova
      c11: { points: [[178,138],[395,108],[665,108],[865,138],[942,200],[932,308],[875,378],[812,420],[835,500],[895,558],[735,578],[538,560],[342,558],[182,522],[118,420],[122,300],[148,215]], scaleX:1,scaleY:1 },
      // c12: Red Bull Ring — compact triangle: short lap, only 4 real corners, stays tight in the viewBox
      c12: { points: [[248,148],[495,118],[748,118],[888,160],[942,225],[932,308],[880,368],[828,398],[805,440],[808,490],[775,518],[708,530],[608,528],[495,522],[375,512],[275,488],[198,448],[158,380],[158,305],[178,235],[208,178]], scaleX:1,scaleY:1 },
      // c13: Standard Circuit — mixed, long top straight, wide oval left section, S-curve chicane at bottom-right
      c13: { points: [[155,148],[480,112],[800,118],[905,155],[958,218],[960,312],[948,392],[900,432],[838,454],[772,438],[712,462],[648,514],[480,538],[305,528],[162,495],[108,420],[98,315],[110,208]], scaleX:1,scaleY:1 }
    };
    const layoutFallbacks = {
      'high-speed': circuits.c1,
      power: circuits.c3,
      technical: circuits.c5,
      mixed: circuits.c10,
      endurance: circuits.c2
    };
    return circuits[key] || layoutFallbacks[key] || layoutFallbacks.mixed;
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

  // Pit lane runs as an open path segment parallel to the main straight, offset inside the circuit.
  // PIT_OFFSET negative = inside the track (right normal for clockwise circuits).
  getPitLaneConstants() {
    return { PIT_START: 0.02, PIT_END: 0.175, PIT_OFFSET: -62 };
  },

  getRacePitLanePoint(progress, layout) {
    const { PIT_START, PIT_END, PIT_OFFSET } = this.getPitLaneConstants();
    const local = Math.max(0, Math.min(1, Number(progress) || 0));
    // local=0 → pit entry (track progress PIT_START), local=1 → pit exit (track progress PIT_END)
    const trackProgress = PIT_START + (PIT_END - PIT_START) * local;
    return this.getRaceTrackPoint(trackProgress, layout, PIT_OFFSET);
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

  // Generates an open SVG path for a specific progress range (used for selective corner curbs)
  getRacePathSegmentData(layout, fromProgress, toProgress, laneOffset = 0, samples = 32) {
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const p = fromProgress + ((toProgress - fromProgress) * i / samples);
      const pt = this.getRaceTrackPoint(p, layout, laneOffset);
      pts.push(`${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
    }
    return pts.join(' ');
  },

  // Returns corner zones (progress ranges) where curb markings should appear
  getLayoutCurbZones(key) {
    const zones = {
      c1:  [{ from:0.19,to:0.31 },{ from:0.50,to:0.60 },{ from:0.72,to:0.80 },{ from:0.84,to:0.91 }],
      c2:  [{ from:0.14,to:0.24 },{ from:0.30,to:0.42 },{ from:0.46,to:0.53 },{ from:0.65,to:0.77 },{ from:0.80,to:0.88 }],
      c3:  [{ from:0.19,to:0.29 },{ from:0.32,to:0.46 },{ from:0.50,to:0.58 },{ from:0.77,to:0.88 }],
      c4:  [{ from:0.18,to:0.28 },{ from:0.42,to:0.52 },{ from:0.62,to:0.72 },{ from:0.78,to:0.88 }],
      c5:  [{ from:0.14,to:0.26 },{ from:0.30,to:0.44 },{ from:0.62,to:0.74 },{ from:0.78,to:0.91 }],
      c6:  [{ from:0.18,to:0.30 },{ from:0.50,to:0.62 },{ from:0.73,to:0.82 },{ from:0.84,to:0.91 }],
      c7:  [{ from:0.20,to:0.30 },{ from:0.40,to:0.50 },{ from:0.65,to:0.75 },{ from:0.78,to:0.88 }],
      c8:  [{ from:0.20,to:0.30 },{ from:0.32,to:0.46 },{ from:0.50,to:0.58 },{ from:0.76,to:0.88 }],
      c9:  [{ from:0.16,to:0.28 },{ from:0.36,to:0.50 },{ from:0.64,to:0.76 },{ from:0.80,to:0.91 }],
      c10: [{ from:0.20,to:0.30 },{ from:0.40,to:0.52 },{ from:0.65,to:0.75 },{ from:0.77,to:0.88 }],
      c11: [{ from:0.18,to:0.30 },{ from:0.46,to:0.56 },{ from:0.68,to:0.78 },{ from:0.82,to:0.90 }],
      c12: [{ from:0.20,to:0.32 },{ from:0.48,to:0.60 },{ from:0.70,to:0.80 },{ from:0.84,to:0.92 }],
      c13: [{ from:0.17,to:0.28 },{ from:0.38,to:0.62 },{ from:0.66,to:0.78 },{ from:0.83,to:0.93 }],
      'high-speed': [{ from:0.18,to:0.32 },{ from:0.50,to:0.60 },{ from:0.71,to:0.79 },{ from:0.83,to:0.90 }],
      power:        [{ from:0.20,to:0.30 },{ from:0.32,to:0.48 },{ from:0.50,to:0.58 },{ from:0.76,to:0.88 }],
      technical:    [{ from:0.14,to:0.28 },{ from:0.32,to:0.46 },{ from:0.62,to:0.74 },{ from:0.78,to:0.91 }],
      mixed:        [{ from:0.20,to:0.30 },{ from:0.40,to:0.52 },{ from:0.65,to:0.75 },{ from:0.77,to:0.88 }],
      endurance:    [{ from:0.14,to:0.24 },{ from:0.29,to:0.42 },{ from:0.45,to:0.52 },{ from:0.64,to:0.77 },{ from:0.79,to:0.87 }]
    };
    return zones[key] || zones.mixed;
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

  getRaceTrackStageMarkup(circuit, weather, idPrefix = 'race') {
    const layout = circuit?.layout || 'mixed';
    const trackKey = circuit?.id || layout;

    // Track paths — keyed by circuit ID so each circuit has its own shape
    const islandOffsets = { 'high-speed':-112, power:-118, technical:-90, mixed:-108, endurance:-105, c1:-112, c2:-105, c3:-118, c4:-108, c5:-90, c6:-112, c7:-108, c8:-118, c9:-90, c10:-108, c11:-118, c12:-112, c13:-108 };
    const islandOffset = islandOffsets[trackKey] || -108;
    const roadPath = this.getRacePathData(trackKey, 0, 220, false);
    const centerPath = this.getRacePathData(trackKey, -1, 220, false);
    const innerIslandPath = this.getRacePathData(trackKey, islandOffset, 220, false);

    // Pit lane — open path parallel to main straight, offset inside the circuit
    const { PIT_START, PIT_END, PIT_OFFSET } = this.getPitLaneConstants();
    const pitLanePath = this.getRacePathSegmentData(trackKey, PIT_START, PIT_END, PIT_OFFSET, 60);

    // Pit boxes — rotated rects aligned with pit lane direction
    const pitBoxCount = 10;
    const pitBoxes = Array.from({ length: pitBoxCount }, (_, i) => {
      const prog = PIT_START + ((i + 0.5) / pitBoxCount) * (PIT_END - PIT_START);
      const pt = this.getRaceTrackPoint(prog, trackKey, PIT_OFFSET - 20);
      const fwd = this.getRaceTrackPoint(prog + 0.002, trackKey, PIT_OFFSET - 20);
      const ang = Math.atan2(fwd.y - pt.y, fwd.x - pt.x) * 180 / Math.PI;
      return `<rect class="race-track-pit-box" x="${(pt.x - 8).toFixed(1)}" y="${(pt.y - 4).toFixed(1)}" width="16" height="8" rx="1.5" transform="rotate(${ang.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)})" />`;
    }).join('');

    // PIT label at midpoint of pit lane
    const pitLabelProg = (PIT_START + PIT_END) / 2;
    const pitLabelPt = this.getRaceTrackPoint(pitLabelProg, trackKey, PIT_OFFSET - 38);
    const pitLabelFwd = this.getRaceTrackPoint(pitLabelProg + 0.004, trackKey, PIT_OFFSET - 38);
    const pitLabelAngle = Math.atan2(pitLabelFwd.y - pitLabelPt.y, pitLabelFwd.x - pitLabelPt.x) * 180 / Math.PI;

    // Curbs — removed (dashed paths on curves create cone artefacts; will be reworked)
    const curbMarkup = '';

    // Start / Finish line — checkerboard stripe perpendicular to track direction
    const sfProgress = 0.09;
    const sfPt = this.getRaceTrackPoint(sfProgress, trackKey, 0);
    const sfAhead = this.getRaceTrackPoint(sfProgress + 0.004, trackKey, 0);
    const sfAngle = Math.atan2(sfAhead.y - sfPt.y, sfAhead.x - sfPt.x) * (180 / Math.PI);
    const sfMarkup = `
      <rect fill="url(#${idPrefix}-track-sf-pattern)"
        x="${(sfPt.x - 5).toFixed(1)}" y="${(sfPt.y - 46).toFixed(1)}"
        width="10" height="92"
        transform="rotate(${sfAngle.toFixed(1)} ${sfPt.x.toFixed(1)} ${sfPt.y.toFixed(1)})"
        opacity="0.94" />
      <text class="race-track-sf-label"
        x="${(sfPt.x - 14).toFixed(1)}" y="${(sfPt.y - 52).toFixed(1)}">S/F</text>`;

    const weatherLabel = this.getWeatherLabel(weather);
    return `
      <div class="race-track-stage ${weather === 'wet' ? 'wet-weather' : 'dry-weather'}" id="${idPrefix}-track-stage">
        <svg class="race-track-svg" viewBox="0 0 1000 620" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="${idPrefix}-track-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(0,0,0,0.24)"/>
            </filter>
            <pattern id="${idPrefix}-track-sf-pattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="5" height="5" fill="white"/>
              <rect x="5" y="5" width="5" height="5" fill="white"/>
              <rect x="5" y="0" width="5" height="5" fill="black"/>
              <rect x="0" y="5" width="5" height="5" fill="black"/>
            </pattern>
          </defs>
          <rect class="race-track-grass" x="0" y="0" width="1000" height="620" rx="18" />
          ${this.getRaceTrackSceneryMarkup(layout)}
          <g class="race-track-retired-zone">
            <rect class="race-track-retired-bay" x="8" y="488" width="128" height="128" rx="7" />
            <text class="race-track-retired-label" x="72" y="506" text-anchor="middle">DNF</text>
            <line x1="8" y1="515" x2="136" y2="515" stroke="rgba(200,55,55,0.22)" stroke-width="1"/>
          </g>
          <path class="race-track-runoff" d="${roadPath}" />
          <path class="race-track-island" d="${innerIslandPath}" />
          <path class="race-track-road-shadow" d="${roadPath}" />
          <path class="race-track-road" d="${roadPath}" />
          <path class="race-track-road-inner" d="${roadPath}" />
          ${curbMarkup}
          <path class="race-track-centerline" d="${centerPath}" />
          <path class="race-track-pitlane-outline" d="${pitLanePath}" />
          <path class="race-track-pitlane" d="${pitLanePath}" />
          <g class="race-track-pit-boxes">${pitBoxes}</g>
          ${sfMarkup}
          <text class="race-track-pitlabel" x="${pitLabelPt.x.toFixed(1)}" y="${pitLabelPt.y.toFixed(1)}" transform="rotate(${pitLabelAngle.toFixed(1)} ${pitLabelPt.x.toFixed(1)} ${pitLabelPt.y.toFixed(1)})" text-anchor="middle">PIT</text>
        </svg>
        <div class="race-track-cars" id="${idPrefix}-track-cars"></div>
        <div class="race-track-progress-wrap">
          <div class="race-track-progress-bar" id="${idPrefix}-track-progress-bar" style="width:0%"></div>
          <span class="race-track-progress-label" id="${idPrefix}-track-progress-label">V—</span>
        </div>
        <div class="race-track-hud">
          <span class="race-track-chip" id="${idPrefix}-track-chip-layout">${this.getTrackLayoutLabel(layout)}</span>
          <span class="race-track-chip" id="${idPrefix}-track-chip-weather">${weather === 'wet' ? '🌧️' : '☀️'} ${weatherLabel}</span>
          <span class="race-track-chip" id="${idPrefix}-track-chip-pit">PIT 0</span>
          <span class="race-track-chip" id="${idPrefix}-track-chip-player">${__('standings_you')} P—/P—</span>
          <span class="race-track-chip race-track-chip-gap" id="${idPrefix}-track-chip-gap" title="Gap al auto de adelante">GAP —</span>
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

  renderRaceTrackVisualization({ liveOrder, progress, totalLaps, currentLap, circuit, weather, idPrefix = 'race' }) {
    const carsLayer = document.getElementById(`${idPrefix}-track-cars`);
    if (!carsLayer) return;

    const trackStage = document.getElementById(`${idPrefix}-track-stage`);
    if (trackStage) {
      trackStage.classList.toggle('wet-weather', weather === 'wet');
      trackStage.classList.toggle('dry-weather', weather !== 'wet');
    }

    const weatherChip = document.getElementById(`${idPrefix}-track-chip-weather`);
    const pitChip = document.getElementById(`${idPrefix}-track-chip-pit`);
    const playerChip = document.getElementById(`${idPrefix}-track-chip-player`);
    if (weatherChip) weatherChip.textContent = `${weather === 'wet' ? '🌧️' : '☀️'} ${this.getWeatherLabel(weather)}`;

    const intraLapProgress = (progress * totalLaps) % 1;
    const layout = circuit?.layout || 'mixed';
    const trackKey = circuit?.id || layout;
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

    const gapChip = document.getElementById(`${idPrefix}-track-chip-gap`);
    if (gapChip && teamCars.length) {
      const leader = teamCars[0];
      const leaderIdx = cars.findIndex((c) => c.id === leader.id);
      if (leaderIdx === 0) {
        const carBehind = cars[1];
        const gapBehindMs = carBehind ? (carBehind.gapMs - leader.gapMs) : null;
        gapChip.textContent = gapBehindMs != null && Number.isFinite(gapBehindMs) && gapBehindMs >= 0
          ? `LÍDER +${(gapBehindMs / 1000).toFixed(1)}s`
          : 'LÍDER';
      } else if (leaderIdx > 0) {
        const carAhead = cars[leaderIdx - 1];
        const gapMs = leader.gapMs - carAhead.gapMs;
        gapChip.textContent = Number.isFinite(gapMs) && gapMs >= 0
          ? `GAP ${(gapMs / 1000).toFixed(1)}s`
          : 'GAP —';
      } else {
        gapChip.textContent = 'GAP —';
      }
    }

    const progBar = document.getElementById(`${idPrefix}-track-progress-bar`);
    const progLabel = document.getElementById(`${idPrefix}-track-progress-label`);
    if (progBar && totalLaps > 0) {
      const pct = Math.min(100, Math.round((currentLap / totalLaps) * 100));
      progBar.style.width = `${pct}%`;
    }
    if (progLabel && totalLaps > 0) {
      progLabel.textContent = `V${Math.max(1, currentLap)}/${totalLaps}`;
    }

    if (!this._raceVisualState || typeof this._raceVisualState !== 'object') {
      this._raceVisualState = {};
    }
    if (!this._retiredSlotMap || typeof this._retiredSlotMap !== 'object') {
      this._retiredSlotMap = {};
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
        // Assign a permanent slot in the DNF bay (bottom-left, off all track layouts)
        if (this._retiredSlotMap[carId] === undefined) {
          const usedSlots = new Set(Object.values(this._retiredSlotMap));
          let slot = 0;
          while (usedSlots.has(slot)) slot++;
          this._retiredSlotMap[carId] = slot;
        }
        const slot = this._retiredSlotMap[carId];
        point = { x: 18 + ((slot % 5) * 22), y: 524 + (Math.floor(slot / 5) * 18) };
        aheadPoint = { x: point.x + 1, y: point.y };
        stateEntry.onPitLane = false;
        stateEntry.pitProgress = 0;
      } else {
        const gapFraction = Number.isFinite(car.gapMs) ? (car.gapMs / estimatedLeaderLapMs) : (idx * 0.014);
        const trackProgress = intraLapProgress - gapFraction;
        const laneOffset = ((idx % 3) - 1) * 3.1;
        const trackPoint = this.getRaceTrackPoint(trackProgress, trackKey, laneOffset);
        const trackAheadPoint = this.getRaceTrackPoint(trackProgress + 0.008, trackKey, laneOffset);

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
          point = this.getRacePitLanePoint(stateEntry.pitProgress, trackKey);
          aheadPoint = this.getRacePitLanePoint(Math.min(1, stateEntry.pitProgress + 0.025), trackKey);
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
    Object.keys(this._retiredSlotMap).forEach((id) => {
      if (!seenIds.has(id)) delete this._retiredSlotMap[id];
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
                <div style="font-size:0.72rem;color:var(--t-secondary);text-align:center;line-height:1.35;min-height:46px;margin-top:6px">${impactText}</div>
                ${contentHtml}
              </div>`;
            }).join('')}
          </div>
        </div>
        
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">Bonificaciones Activas</div>
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
    const pilots = state.pilots || [];
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
          <button class="btn btn-ghost w-full mt-2" onclick="GL_SCREENS.dismissPilot('${p.id}')" ${pilots.length <= 2 ? 'disabled title="Necesitas al menos 2 pilotos en el equipo"' : ''}>${__('pilots_dismiss_btn') || 'Despedir piloto'}</button>
        </div>
      </div>`;
  },

  dismissPilot(id) {
    const state = GL_STATE.getState();
    const pilots = state.pilots || [];
    const pilot = pilots.find((p) => p.id === id);
    if (!pilot) return;
    if (pilots.length <= 2) {
      GL_UI.toast('Necesitas al menos 2 pilotos en el equipo. Contrata uno antes de despedir.', 'warning');
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
  getStaffSeverance(member) {
    const weeks = member.rarity === 'rare' ? 6 : member.rarity === 'uncommon' ? 4 : 2;
    return (member.salary || 0) * weeks;
  },

  renderStaff() {
    const state = GL_STATE.getState();
    const staff = state.staff || [];
    const maxStaff = GL_DATA.MAX_STAFF || 5;
    const used = staff.length;
    const activeSponsors = (state.sponsors || []).filter(s => !s.expired);
    const el = document.getElementById('screen-staff');
    if (!el) return;
    const atMax = used >= maxStaff;
    const slotDots = Array.from({ length: maxStaff }, (_, i) => `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i < used ? 'var(--c-accent)' : 'rgba(255,255,255,0.12)'};margin-right:4px"></span>`).join('');

    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('staff_eyebrow')}</div>
          <div class="screen-title">${__('staff_title')}</div>
          <div class="screen-subtitle">${__('staff_subtitle')}</div>
        </div>
        <div id="staff-header-action" style="display:flex;align-items:center;gap:var(--s-3);flex-shrink:0">
          <div style="text-align:right">
            <div style="font-size:0.7rem;color:var(--t-tertiary);margin-bottom:4px;letter-spacing:0.04em">PERSONAL ${used}/${maxStaff}</div>
            <div>${slotDots}</div>
          </div>
          ${!atMax ? `<button class="btn btn-primary btn-sm" onclick="GL_SCREENS.showHireStaff()">+ Contratar</button>` : `<span style="font-size:0.72rem;color:var(--t-tertiary);padding:6px 10px;border-radius:var(--r-sm);border:1px solid rgba(255,255,255,0.1)">Plantilla completa</span>`}
        </div>
      </div>
      <div class="tabs mb-6" style="max-width:400px">
        <button class="tab active" onclick="GL_SCREENS.staffTab('staff',this)">Personal</button>
        <button class="tab" onclick="GL_SCREENS.staffTab('sponsors',this)">Patrocinadores <span style="font-size:0.7rem;opacity:0.7">(${activeSponsors.length})</span></button>
      </div>
      <div id="staff-content">
        ${this._staffPanelContent(staff, maxStaff, used, atMax)}
      </div>`;
  },

  staffTab(tab, btn) {
    const state = GL_STATE.getState();
    const tabs = document.querySelectorAll('#screen-staff .tabs .tab');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('staff-content');
    const headerAction = document.getElementById('staff-header-action');
    if (!content) return;
    if (tab === 'staff') {
      const staff = state.staff || [];
      const maxStaff = GL_DATA.MAX_STAFF || 5;
      const used = staff.length;
      const atMax = used >= maxStaff;
      if (headerAction) {
        const slotDots = Array.from({ length: maxStaff }, (_, i) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i < used ? 'var(--c-accent)' : 'rgba(255,255,255,0.12)'};margin-right:4px"></span>`).join('');
        headerAction.innerHTML = `
          <div style="text-align:right">
            <div style="font-size:0.7rem;color:var(--t-tertiary);margin-bottom:4px;letter-spacing:0.04em">PERSONAL ${used}/${maxStaff}</div>
            <div>${slotDots}</div>
          </div>
          ${!atMax ? `<button class="btn btn-primary btn-sm" onclick="GL_SCREENS.showHireStaff()">+ Contratar</button>` : `<span style="font-size:0.72rem;color:var(--t-tertiary);padding:6px 10px;border-radius:var(--r-sm);border:1px solid rgba(255,255,255,0.1)">Plantilla completa</span>`}`;
      }
      content.innerHTML = this._staffPanelContent(staff, maxStaff, used, atMax);
    } else {
      if (headerAction) {
        headerAction.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.openMarketSponsors()">+ Buscar patrocinadores</button>`;
      }
      content.innerHTML = this._sponsorPanelContent();
    }
  },

  _staffPanelContent(staff, maxStaff, used, atMax) {
    return `<div class="grid-2 mb-6">
      ${staff.map(s => {
        const severance = this.getStaffSeverance(s);
        return `
        <div class="card card-hover flex gap-4">
          <div class="icon-circle ${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'green'}" style="width:52px;height:52px;font-size:1.5rem;flex-shrink:0">${s.emoji||'👤'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem">${s.name}</div>
            <div style="font-size:0.75rem;color:var(--t-secondary);margin-bottom:var(--s-2)">${s.role || this.getStaffRoleLabel(s.roleKey || '')} · ${s.nat}</div>
            <div style="font-size:0.72rem;color:var(--c-accent);font-weight:600;margin-bottom:var(--s-2);line-height:1.4">${s.effect || s.bio || ''}</div>
            <div style="font-size:0.7rem;color:var(--t-tertiary);font-style:italic">"${s.bio || ''}"</div>
          </div>
          <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:var(--s-1)">
            <div>
              <div style="font-family:var(--font-display);font-weight:800;color:var(--c-gold)">${GL_UI.fmtCR(s.salary)}/sem</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}" style="margin-top:4px">${s.rarity||'common'}</span>
            </div>
            <button class="btn btn-ghost btn-sm" style="margin-top:auto;font-size:0.68rem;color:var(--t-tertiary)" onclick="GL_SCREENS.dismissStaff('${s.id}')" title="Indemnización: ${GL_UI.fmtCR(severance)} CR">Despedir · ${GL_UI.fmtCR(severance)} CR</button>
          </div>
        </div>`;
      }).join('')}
      ${Array.from({ length: maxStaff - used }, (_, i) => `
        <div class="card" style="display:flex;align-items:center;justify-content:center;text-align:center;border-style:dashed;min-height:100px;cursor:pointer;opacity:${atMax ? 0.4 : 1}" onclick="${atMax ? '' : 'GL_SCREENS.showHireStaff()'}">
          <div><div style="font-size:1.5rem;color:var(--t-tertiary)">+</div><div style="font-size:0.78rem;color:var(--t-tertiary);margin-top:4px">Slot disponible</div></div>
        </div>`).join('')}
    </div>`;
  },

  _sponsorPanelContent() {
    const state = GL_STATE.getState();
    const activeSponsors = (state.sponsors || []).filter(s => !s.expired);
    if (!activeSponsors.length) {
      return `<div style="text-align:center;padding:40px 20px;color:var(--t-tertiary)">
        <div style="font-size:2rem;margin-bottom:12px">💼</div>
        <div style="font-size:0.9rem;margin-bottom:16px">Sin patrocinadores activos</div>
        <button class="btn btn-primary btn-sm" onclick="GL_SCREENS.openMarketSponsors()">Buscar patrocinadores</button>
      </div>`;
    }
    const lastPos = Number(state.lastRaceBestPos || 0);
    const lastPosLabel = lastPos > 0 && lastPos < 99 ? `P${lastPos}` : null;
    const posNeeded = { win:1, podium:3, top5:5, top8:8, top10:10, top12:12, top15:15 };
    return `<div class="grid-3 mb-6">
      ${activeSponsors.map(sp => {
        const income = Number(sp.weeklyValue || sp.income || 0);
        const weeksLeft = sp.weeksLeft != null ? Number(sp.weeksLeft) : Number(sp.duration || 0);
        const penalty = Math.round(income * Math.max(1, weeksLeft) * 0.2);
        const bonusVal = Number(sp.demandBonus || 0);
        const failures = Number(sp.demandFailures || 0);
        const maxFailures = Number(sp.demandMaxFailures || 2);
        const remaining = maxFailures - failures;
        const isAtRisk = remaining === 1;
        const statusColor = failures === 0 ? 'var(--c-green)' : isAtRisk ? 'var(--c-accent)' : 'var(--c-gold)';
        const failureDots = Array.from({ length: maxFailures }, (_, i) =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i < failures ? 'var(--c-accent)' : 'rgba(255,255,255,0.15)'};border:1px solid ${i < failures ? 'var(--c-accent)' : 'rgba(255,255,255,0.25)'}"></span>`
        ).join('');
        const needed = posNeeded[sp.demandKey];
        let lastRaceHint = '';
        if (needed && lastPosLabel) {
          const met = lastPos <= needed;
          lastRaceHint = `<div style="font-size:0.7rem;margin-top:3px;color:${met ? 'var(--c-green)' : 'var(--t-tertiary)'}">${lastPosLabel} en última carrera ${met ? '✓' : `— necesitas Top ${needed}`}</div>`;
        } else if (sp.demandKey === 'no_dnf') {
          lastRaceHint = `<div style="font-size:0.7rem;margin-top:3px;color:var(--t-tertiary)">Todos los pilotos deben terminar</div>`;
        }
        const demandText = sp.demand || (needed ? `Top ${needed} en carrera` : sp.demandKey || '');
        return `
        <div class="card" style="border-top:3px solid ${statusColor};display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:1.6rem;width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${sp.bg||'var(--c-surface-2)'};border-radius:6px">${sp.logo||'💼'}</div>
            <div style="min-width:0;flex:1">
              <div style="font-weight:700;color:${sp.color||'var(--t-primary)'};font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.name}</div>
              <div style="font-size:0.72rem;color:var(--t-tertiary)">${weeksLeft} sem. restantes</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px">
            <span style="font-family:var(--font-display);font-weight:800;color:var(--c-green);font-size:1rem">+${GL_UI.fmtCR(income)}<span style="font-size:0.65rem;font-weight:400">/sem</span></span>
            ${bonusVal > 0 ? `<span style="font-size:0.72rem;color:var(--c-gold)">+${GL_UI.fmtCR(bonusVal)} bonus</span>` : ''}
          </div>
          <div style="padding:8px;background:rgba(255,255,255,0.04);border-radius:6px">
            <div style="font-size:0.76rem;font-weight:600;color:var(--t-primary)">🎯 ${demandText}</div>
            ${lastRaceHint}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <div>
              <div style="display:flex;gap:4px;margin-bottom:3px">${failureDots}</div>
              <div style="font-size:0.68rem;color:${statusColor}">${isAtRisk ? '⚠️ Última oportunidad' : failures === 0 ? 'Sin advertencias' : `${remaining} fallo${remaining!==1?'s':''} restante${remaining!==1?'s':''}`}</div>
            </div>
            <button class="btn btn-ghost btn-sm" style="font-size:0.65rem;color:var(--t-tertiary);padding:3px 7px" onclick="GL_SCREENS.rescindSponsor('${sp.id}')">Rescindir</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  showHireStaff() {
    const state = GL_STATE.getState();
    const maxStaff = GL_DATA.MAX_STAFF || 5;
    const used = (state.staff || []).length;
    if (used >= maxStaff) {
      GL_UI.toast('Plantilla completa. Debes despedir a alguien primero.', 'warning');
      return;
    }
    const myIds = new Set((state.staff || []).map(s => s.id));
    const available = GL_DATA.STAFF_POOL.filter(s => !myIds.has(s.id));
    const slotsLeft = maxStaff - used;
    const fans = Number(state?.team?.fans || 0);

    GL_UI.openModal({ title: 'Contratar Personal', size: 'lg', content: `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s-4);padding:var(--s-3) var(--s-4);background:var(--c-surface-2);border-radius:var(--r-sm)">
        <span style="font-size:0.8rem;color:var(--t-secondary)">Slots disponibles</span>
        <span style="font-family:var(--font-display);font-weight:700;color:var(--c-accent)">${slotsLeft} de ${maxStaff}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--s-3)">
        ${available.map(s => {
          const locked = fans < (s.minFans || 0);
          const canHire = !locked;
          return `
          <div class="market-pilot-row" style="${locked ? 'opacity:0.5' : 'cursor:pointer'}" ${canHire ? `onclick="GL_SCREENS.hireStaff('${s.id}', this.closest('.modal-overlay'))"` : ''}>
            <div class="market-pilot-avatar" style="font-size:1.5rem">${locked ? '🔒' : (s.emoji||'👤')}</div>
            <div class="market-pilot-info" style="flex:1;min-width:0">
              <div class="market-pilot-name" style="${locked ? 'color:var(--t-tertiary)' : ''}">${s.name}</div>
              <div class="market-pilot-meta">${s.role || this.getStaffRoleLabel(s.roleKey || '')} · ${s.nat}</div>
              <div style="font-size:0.72rem;color:var(--c-accent);font-weight:600;margin-top:3px">${s.effect || ''}</div>
              ${locked
                ? `<div style="font-size:0.72rem;color:var(--c-accent);margin-top:3px">🔒 Requiere ${s.minFans.toLocaleString()} fans (tienes ${fans.toLocaleString()})</div>`
                : `<div style="font-size:0.7rem;color:var(--t-tertiary);margin-top:2px;font-style:italic">${s.bio||''}</div>`
              }
            </div>
            <div class="market-pilot-salary" style="flex-shrink:0">
              <div class="market-pilot-salary-val">${GL_UI.fmtCR(s.salary)}/sem</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}" style="margin-top:4px">${s.rarity}</span>
              <div style="font-size:0.65rem;color:var(--t-tertiary);margin-top:4px">Indem: ${GL_UI.fmtCR(this.getStaffSeverance(s))} CR</div>
            </div>
          </div>`;
        }).join('')}
      </div>` });
  },

  hireStaff(id, overlay) {
    const state = GL_STATE.getState();
    const maxStaff = GL_DATA.MAX_STAFF || 5;
    if ((state.staff || []).length >= maxStaff) {
      GL_UI.toast('Plantilla completa. Debes despedir a alguien antes de contratar.', 'warning');
      return;
    }
    const s = GL_DATA.STAFF_POOL.find(s => s.id === id);
    if (!s) return;
    const fans = Number(state?.team?.fans || 0);
    if (fans < (s.minFans || 0)) {
      GL_UI.toast(`Necesitas ${s.minFans.toLocaleString()} fans para contratar a ${s.name}.`, 'warning');
      return;
    }
    state.staff.push(GL_STATE.deepClone(s));
    GL_STATE.addLog(`👥 ${s.name} se une al equipo como ${s.role || s.roleKey}.`, 'good');
    GL_STATE.saveState();
    overlay?.remove();
    GL_UI.toast(`${s.name} contratado.`, 'success');
    this.renderStaff();
  },

  dismissStaff(id) {
    const state = GL_STATE.getState();
    const staff = state.staff || [];
    const member = staff.find((s) => s.id === id);
    if (!member) return;

    const severance = this.getStaffSeverance(member);
    const weeksLabel = member.rarity === 'rare' ? '6 semanas' : member.rarity === 'uncommon' ? '4 semanas' : '2 semanas';
    const title = 'Despedir personal';
    const msg = `Si despides a <strong>${member.name}</strong>, debes pagar la indemnización de ${weeksLabel} de sueldo: <strong>${GL_UI.fmtCR(severance)} CR</strong>.`;

    GL_UI.confirm(title, msg, 'Despedir y pagar', 'Cancelar').then((confirmed) => {
      if (!confirmed) return;
      if (!GL_STATE.spendCredits(severance)) {
        GL_UI.toast('Saldo insuficiente para pagar la indemnización.', 'warning');
        return;
      }
      if (typeof GL_STATE.addCashflowAdjustment === 'function') {
        GL_STATE.addCashflowAdjustment(-Math.abs(severance), 'staff_severance', {
          week: Number(state?.season?.week || 1),
          note: member.name || ''
        });
      }
      state.staff = staff.filter((s) => s.id !== id);
      GL_STATE.addLog(`👋 ${member.name || 'Personal'} despedido. Indemnización: ${GL_UI.fmtCR(severance)} CR.`, 'warning');
      GL_STATE.saveState();
      if (window.GL_DASHBOARD && typeof GL_DASHBOARD.updateTopbar === 'function') {
        GL_DASHBOARD.updateTopbar(GL_STATE.getState());
      }
      GL_UI.toast(`${member.name || 'Personal'} despedido.`, 'info');
      this.renderStaff();
    });
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
            <div class="section-title mb-4" style="font-size:1rem">Créditos + 10 pts de I+D por mejora</div>
            ${Object.entries(car.components).map(([key, c]) => {
              const labels = { engine:__('car_engine'),chassis:__('car_chassis'),aero:__('car_aero'),tyreManage:__('car_tyre_manage'),brakes:__('car_brakes'),gearbox:__('car_gearbox'),reliability:__('car_reliability'),efficiency:__('car_efficiency') };
              const cost = 5000 + c.level * 3000;
              return `<div class="finance-row">
                <span class="finance-row-label">${labels[key]}</span>
                <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.upgradeCarComp('${key}')">+3 · ${GL_UI.fmtCR(cost)} CR · 10 pts</button>
              </div>`;
            }).join('')}
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('car_rnd_points')}</div>
            <div class="stat-card-value" style="font-size:1.4rem;color:${(car.rnd.points||0) >= 10 ? 'var(--c-gold)' : 'inherit'}">${car.rnd.points || 0}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:4px">P1 +10 · P2 +8 · P3 +6 · P4–10 +3 · P11–20 +1. Bonus +1 pt por nivel adicional de I+D. Se usan en mejoras rápidas (10 pts) e I+D (5 pts/proyecto).</div>
            ${(car.rnd.points||0) >= 5
              ? `<button class="btn btn-ghost btn-sm w-full" style="margin-top:8px" onclick="GL_SCREENS.showRnD()">🔬 Usar en I+D</button>`
              : `<div style="font-size:0.72rem;color:var(--t-tertiary);margin-top:8px">Necesitas 5 pts para iniciar una investigación.</div>`
            }
          </div>
        </div>
      </div>`;
  },

  upgradeCarComp(key) {
    const car = GL_STATE.getCar();
    const cost = 5000 + car.components[key].level * 3000;
    const rndCost = 10;
    if ((car.rnd.points || 0) < rndCost) { GL_UI.toast(`Puntos de I+D insuficientes (necesitas ${rndCost} pts)`, 'warning'); return; }
    if (!GL_STATE.spendCredits(cost)) { GL_UI.toast('Créditos insuficientes', 'warning'); return; }
    car.rnd.points = (car.rnd.points || 0) - rndCost;
    car.components[key].score = Math.min(99, car.components[key].score + 3);
    car.components[key].level++;
    const labels = { engine:'Motor', chassis:'Chasis', aero:'Aerodinámica', tyreManage:'Gestión de Neumáticos', brakes:'Frenos', gearbox:'Caja de Cambios', reliability:'Fiabilidad', efficiency:'Eficiencia' };
    GL_STATE.addLog(`⚙️ ${labels[key]||key} mejorado +3 puntos`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${labels[key]||key} mejorado +3`, 'success');
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
    const pointCost = (GL_ENGINE.RND_POINT_COST_PER_RESEARCH || 5);
    const availablePoints = state.car.rnd.points || 0;
    const toTime = (ms) => {
      const h = Math.max(1, Math.round(ms / 3600000));
      return h >= 24 ? `${Math.round(h / 24)}d` : `${h}h`;
    };
    const compLabels = { chassis:'Chasis', engine:'Motor', aero:'Aerodinámica', reliability:'Fiabilidad', tyreManage:'Gestión de Neumáticos', brakes:'Frenos', gearbox:'Caja de Cambios', efficiency:'Eficiencia' };

    GL_UI.openModal({
      title: 'Centro de I+D',
      content: `
        <div style="background:var(--c-surface-2);border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:0.82rem;color:var(--t-secondary)">Puntos de I+D disponibles</span>
          <span style="font-weight:700;font-size:1.1rem;color:${availablePoints >= pointCost ? 'var(--c-gold)' : 'var(--c-red)'}">${availablePoints} pts</span>
        </div>
        <div style="display:grid;gap:12px;max-height:55vh;overflow:auto;">
          ${trees.map(t => {
            const locked = !t.unlocked;
            const hasPoints = availablePoints >= pointCost;
            const canStart = !locked && !t.isActive && t.currentLevel < t.maxLevel && hasPoints;
            const canStartNoPoints = !locked && !t.isActive && t.currentLevel < t.maxLevel && !hasPoints;
            const compLabel = compLabels[t.nextComponentBoost] || t.nextComponentBoost;
            return `
              <div style="background:var(--c-surface-2);padding:12px;border-radius:10px;border:1px solid var(--c-border)">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <div style="font-weight:700">${t.icon} ${t.name}</div>
                  <span class="badge ${t.isActive ? 'badge-blue' : 'badge-gray'}">Nv ${t.currentLevel}/${t.maxLevel}</span>
                </div>
                <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:6px">
                  Mejora: ${compLabel} · ${GL_UI.fmtCR(t.nextCost)} CR · ${pointCost} pts · Duración: ${toTime(t.nextDuration)}
                </div>
                ${t.isActive ? `<div style="margin-top:8px">${GL_UI.progressBar(Math.round(t.progress), 100, 'blue')}</div>` : ''}
                ${locked ? `<div style="font-size:0.78rem;color:var(--c-orange);margin-top:8px">Requiere Centro de I+D Nivel 2.</div>` : ''}
                ${canStart ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="GL_SCREENS.startResearchTree('${t.treeId}')">Iniciar (${pointCost} pts · ${GL_UI.fmtCR(t.nextCost)} CR)</button>` : ''}
                ${canStartNoPoints ? `<div style="font-size:0.78rem;color:var(--c-red);margin-top:8px">⚠️ Sin puntos suficientes — compite para ganar más.</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `
    });
  },

  startResearchTree(treeId) {
    const result = GL_ENGINE.startResearch ? GL_ENGINE.startResearch(treeId) : { error: 'Motor de I+D no encontrado' };
    if (result && result.success) {
      GL_UI.toast(`Investigación iniciada (-${result.pointCost} pts)`, 'success');
      GL_STATE.addLog(`🔬 Nueva investigación iniciada: ${treeId}.`, 'info');
      GL_STATE.saveState();
      this.showRnD();
      this.renderCar();
      return;
    }
    const errMap = {
      'Insufficient funds': 'Créditos insuficientes',
      'Research already in progress': 'Ya hay una investigación en curso',
      'R&D Centre Lv2 required': 'Requiere Centro de I+D Nivel 2',
      'Max level reached': 'Nivel máximo alcanzado'
    };
    const rawErr = result && result.error ? result.error : 'No se pudo iniciar I+D';
    const translated = errMap[rawErr] || (rawErr.startsWith('Not enough R&D points') ? `Puntos insuficientes — compite para ganar más` : rawErr);
    GL_UI.toast(translated, 'warning');
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

  toggleAnalystReport() {
    const el = document.getElementById('postrace-analyst-panel');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  renderRaceComparisonTable(result) {
    if (!result || !GL_ENGINE.buildRaceComparisonStats) {
      return `<p style="color:var(--t-secondary);font-size:0.82rem">Sin datos de telemetría disponibles.</p>`;
    }
    // In MP, remap isPlayer to only the viewing player's cars (avoids other players' data)
    const viewerUid = result._viewerUid || (window.GL_AUTH && GL_AUTH.user && GL_AUTH.user.uid) || null;
    const resultForStats = viewerUid ? {
      ...result,
      finalGrid: (result.finalGrid || []).map(e => ({ ...e, isPlayer: e.teamId === viewerUid }))
    } : result;
    const stats = GL_ENGINE.buildRaceComparisonStats(resultForStats);
    const { rows, best } = stats;
    if (!rows || !rows.length) {
      return `<p style="color:var(--t-secondary);font-size:0.82rem">Sin datos de telemetría disponibles.</p>`;
    }
    // Detect if timing data is available (server MP races don't generate lap times)
    const hasTimingData = rows.some(r => r.avgLapMs > 0);

    // ── Formatters ─────────────────────────────────────────────────────────
    const fmtLap = (ms) => {
      if (!ms || !Number.isFinite(ms)) return '—';
      const m = Math.floor(ms / 60000);
      const s = ((ms % 60000) / 1000).toFixed(1).padStart(4, '0');
      return `${m}:${s}`;
    };
    const fmtPure = (ms) => {
      if (!ms || !Number.isFinite(ms)) return '—';
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
      return `${m}m ${s}s`;
    };
    const fmtSec = (ms) => (ms && Number.isFinite(ms)) ? `${(ms / 1000).toFixed(1)}s` : '—';
    const fmtConsist = (ms) => (ms && Number.isFinite(ms)) ? `±${(ms / 1000).toFixed(1)}s` : '—';
    const fmtPosGain = (n) => {
      if (!Number.isFinite(n) || n === 0) return '<span style="color:var(--t-secondary)">—</span>';
      return n > 0
        ? `<span style="color:var(--c-green)">▲+${n}</span>`
        : `<span style="color:var(--c-red)">▼${Math.abs(n)}</span>`;
    };

    // ── Heatmap cell style (0=best/green, 1=worst/red) ──────────────────────
    const heatStyle = (value, allVals, lowerIsBetter) => {
      const valid = allVals.filter(v => Number.isFinite(v));
      if (valid.length <= 1 || !Number.isFinite(value)) return '';
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      if (max === min) return '';
      const score = lowerIsBetter ? (value - min) / (max - min) : (max - value) / (max - min);
      const clamped = Math.max(0, Math.min(1, score));
      if (clamped <= 0.25) return 'background:rgba(34,197,94,0.13);color:var(--c-green)';
      if (clamped >= 0.75) return 'background:rgba(239,68,68,0.11);color:var(--c-red)';
      return '';
    };

    // ── Column value arrays (for heatmap range) ────────────────────────────
    const live = rows.filter(r => !r.isDNF);
    const colAvgLap     = live.map(r => r.avgLapMs);
    const colBestLap    = live.map(r => r.bestLapMs);
    const colConsist    = live.map(r => r.consistencyMs);
    const colPureRace   = live.map(r => r.pureRaceMs);
    const colAvgPit     = live.filter(r => r.avgPitMs !== null).map(r => r.avgPitMs);
    const colPosGain    = rows.map(r => r.posGain);

    // ── Best lap overall ───────────────────────────────────────────────────
    const overallBestLapMs = best.bestLapMs;

    // Table rows are rendered inline in the return block below (with hasTimingData guard)

    // ── Analyst report ─────────────────────────────────────────────────────
    const playerRows = rows.filter(r => r.isPlayer && !r.isDNF);
    const METRIC_TIPS = [
      {
        key: 'avgLapMs',
        label: 'Ritmo promedio',
        bestVal: best.avgLapMs,
        playerBest: playerRows.length ? Math.min(...playerRows.map(r => r.avgLapMs)) : null,
        lowerBetter: true,
        fmt: fmtLap,
        tips: ['Sube el <strong>Motor</strong> y la <strong>Aerodinámica</strong> del coche', 'Busca mayor <strong>Ritmo de Carrera</strong> en tus pilotos']
      },
      {
        key: 'bestLapMs',
        label: 'Vuelta rápida',
        bestVal: best.bestLapMs,
        playerBest: playerRows.length ? Math.min(...playerRows.map(r => r.bestLapMs)) : null,
        lowerBetter: true,
        fmt: fmtLap,
        tips: ['Mejora el <strong>Motor</strong> y la <strong>Caja de cambios</strong>', 'Pilotos con mayor atributo de <strong>Paso</strong> y <strong>Agresividad</strong>', 'Prueba usar <strong>Modo Motor: Push</strong> en stints cortos']
      },
      {
        key: 'consistencyMs',
        label: 'Consistencia de ritmo',
        bestVal: best.consistencyMs,
        playerBest: playerRows.length ? Math.min(...playerRows.map(r => r.consistencyMs)) : null,
        lowerBetter: true,
        fmt: fmtConsist,
        tips: ['Pilotos con mayor atributo de <strong>Consistencia</strong> y <strong>Mental</strong>', 'Reduce la <strong>Agresividad</strong> en la estrategia', 'Baja el <strong>Nivel de Riesgo</strong>']
      },
      {
        key: 'pureRaceMs',
        label: 'Tiempo puro de carrera',
        bestVal: best.pureRaceMs,
        playerBest: playerRows.length ? Math.min(...playerRows.map(r => r.pureRaceMs)) : null,
        lowerBetter: true,
        fmt: fmtPure,
        tips: ['Mejora el <strong>score general del coche</strong> (Motor, Chasis, Aero)', 'Pilotos con mejor <strong>Ritmo de Carrera</strong> y <strong>Pace</strong> general', 'Optimiza el <strong>Setup</strong> según el layout del circuito']
      },
      {
        key: 'avgPitMs',
        label: 'Tiempo promedio en pits',
        bestVal: best.avgPitMs,
        playerBest: playerRows.filter(r => r.avgPitMs !== null).length
          ? Math.min(...playerRows.filter(r => r.avgPitMs !== null).map(r => r.avgPitMs))
          : null,
        lowerBetter: true,
        fmt: fmtSec,
        tips: ['Mejora tu <strong>Staff de Boxes</strong> (velocidad y fiabilidad del equipo de pits)', 'Revisa el timing de las paradas para aprovechar el <strong>Undercut / Overcut</strong>']
      },
      {
        key: 'posGain',
        label: 'Posiciones ganadas',
        bestVal: best.posGain,
        playerBest: playerRows.length ? Math.max(...playerRows.map(r => r.posGain)) : null,
        lowerBetter: false,
        fmt: (n) => n > 0 ? `+${n}` : `${n}`,
        tips: ['Pilotos con mayor atributo de <strong>Adelantamiento</strong> y <strong>Agresividad</strong>', 'Sube la <strong>Agresividad</strong> en la estrategia (con cuidado de los neumáticos)', 'Una mejor posición de salida también ayuda: mejora el setup de clasificación']
      }
    ];

    const analystLines = METRIC_TIPS.map(m => {
      if (m.playerBest === null || !Number.isFinite(m.playerBest) || !Number.isFinite(m.bestVal)) return null;
      const isPlayerBest = m.lowerBetter
        ? Math.abs(m.playerBest - m.bestVal) < 0.5
        : Math.abs(m.playerBest - m.bestVal) < 0.5;

      if (isPlayerBest) {
        return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:8px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2)">
          <span style="font-size:1rem;flex-shrink:0">✅</span>
          <div>
            <div style="font-size:0.78rem;font-weight:600;color:var(--c-green)">${m.label}</div>
            <div style="font-size:0.75rem;color:var(--t-secondary);margin-top:2px">Tu equipo lideró esta métrica en la carrera. ¡Excelente trabajo!</div>
          </div>
        </div>`;
      }

      const gapMs = m.lowerBetter ? (m.playerBest - m.bestVal) : (m.bestVal - m.playerBest);
      const gapLabel = (m.key === 'avgLapMs' || m.key === 'bestLapMs')
        ? `+${(gapMs / 1000).toFixed(2)}s por vuelta de diferencia con el mejor`
        : (m.key === 'pureRaceMs' ? `+${(gapMs / 1000).toFixed(0)}s de tiempo puro sobre el líder`
        : (m.key === 'avgPitMs' || m.key === 'worstPitMs' ? `+${(gapMs / 1000).toFixed(1)}s más lento en pits`
        : (m.key === 'posGain' ? `${Math.abs(gapMs)} posiciones menos ganadas que el mejor remontador` : '')));
      const tipsHtml = m.tips.map(t => `<li style="margin-bottom:3px">${t}</li>`).join('');
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15)">
        <span style="font-size:1rem;flex-shrink:0">📉</span>
        <div>
          <div style="font-size:0.78rem;font-weight:600;color:var(--t-primary)">${m.label}</div>
          <div style="font-size:0.73rem;color:var(--t-secondary);margin-top:2px">${gapLabel}</div>
          <ul style="font-size:0.73rem;color:var(--t-secondary);margin:6px 0 0 0;padding-left:16px">${tipsHtml}</ul>
        </div>
      </div>`;
    }).filter(Boolean).join('');

    const thStyle = 'font-size:0.7rem;font-weight:600;color:var(--t-secondary);text-align:center;padding:6px 8px;white-space:nowrap;border-bottom:1px solid var(--c-border)';
    const thFirstStyle = 'font-size:0.7rem;font-weight:600;color:var(--t-secondary);text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border)';

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <div class="postrace-report-title" style="font-size:0.9rem;font-weight:700">📊 Información de tiempos de carrera</div>
          <div style="font-size:0.72rem;color:var(--t-secondary);margin-top:2px">Pilotos ordenados por posición final · ★ vuelta rápida</div>
        </div>
        ${hasTimingData ? `<button class="btn btn-secondary" style="font-size:0.76rem;padding:6px 12px" onclick="GL_SCREENS.toggleAnalystReport()">🧠 Informe del Analista</button>` : ''}
      </div>

      ${hasTimingData ? `<div id="postrace-analyst-panel" style="display:none;margin-bottom:14px;padding:14px;border-radius:10px;background:var(--c-surface-2);border:1px solid var(--c-border)">
        <div style="font-size:0.8rem;font-weight:700;color:var(--t-primary);margin-bottom:10px">Análisis de tu equipo vs el campo</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${analystLines || '<div style="font-size:0.78rem;color:var(--t-secondary)">No hay datos suficientes para generar el informe.</div>'}
        </div>
      </div>` : ''}

      ${!hasTimingData ? `<div style="font-size:0.72rem;color:var(--t-tertiary);padding:4px 0 8px 0">⚠️ Datos de timing no disponibles para carreras multijugador (columnas de tiempo muestran —)</div>` : ''}
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem;min-width:${hasTimingData ? '580' : '300'}px">
          <thead>
            <tr style="background:var(--c-surface-2)">
              <th style="${thFirstStyle}">Piloto</th>
              ${hasTimingData ? `
              <th style="${thStyle}" title="Tiempo promedio por vuelta excluyendo pit stops">Ritmo prom.</th>
              <th style="${thStyle}" title="Vuelta más rápida de la carrera">Vuelta rápida</th>
              <th style="${thStyle}" title="Variabilidad del ritmo — menor es más regular">Consistencia</th>
              <th style="${thStyle}" title="Tiempo total de carrera sin contar pit stops">Tiempo puro</th>
              <th style="${thStyle}" title="Tiempo promedio perdido por parada en boxes">Pits (prom.)</th>
              ` : ''}
              <th style="${thStyle}" title="Posiciones ganadas o perdidas desde la salida">Δ Pos</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => {
              const isPlayer = row.isPlayer;
              const rowBg = isPlayer ? 'background:var(--c-surface-2);border-left:3px solid var(--c-accent)' : '';
              const namePart = isPlayer ? `<strong style="color:var(--c-accent)">${row.name}</strong>` : row.name;
              const posLabel = row.isDNF ? '<span style="color:var(--c-red)">DNF</span>' : `P${row.finishPos}`;
              const isFastestLap = Number.isFinite(row.bestLapMs) && Math.abs(row.bestLapMs - best.bestLapMs) < 1;
              const live = rows.filter(r => !r.isDNF);
              const hAvg  = heatStyle(row.avgLapMs,       live.map(r => r.avgLapMs),       true);
              const hBest = heatStyle(row.bestLapMs,      live.map(r => r.bestLapMs),      true);
              const hCons = heatStyle(row.consistencyMs,  live.map(r => r.consistencyMs),  true);
              const hPure = heatStyle(row.pureRaceMs,     live.map(r => r.pureRaceMs),     true);
              const hPit  = row.avgPitMs != null ? heatStyle(row.avgPitMs, live.filter(r => r.avgPitMs != null).map(r => r.avgPitMs), true) : '';
              const timingCells = hasTimingData ? `
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem;${hAvg}">${fmtLap(row.avgLapMs)}</td>
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem;${hBest}">
                  ${fmtLap(row.bestLapMs)}${isFastestLap ? ' <span title="Vuelta rápida" style="color:#c084fc;font-size:0.7rem">★</span>' : ''}
                </td>
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem;${hCons}">${fmtConsist(row.consistencyMs)}</td>
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem;${hPure}">${fmtPure(row.pureRaceMs)}</td>
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem;${hPit}">${fmtSec(row.avgPitMs)}</td>
              ` : '';
              return `<tr style="${rowBg}">
                <td style="white-space:nowrap;padding:7px 10px;font-size:0.78rem">
                  <span style="color:var(--t-secondary);margin-right:6px;font-size:0.72rem">${posLabel}</span>${namePart}
                </td>
                ${timingCells}
                <td style="text-align:center;padding:6px 8px;font-size:0.78rem">${fmtPosGain(row.posGain)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  openRaceReport(round) {
    const isMP = typeof GL_ENGINE !== 'undefined' && GL_ENGINE.isMultiplayer && GL_ENGINE.isMultiplayer();
    if (isMP && GL_AUTH && GL_AUTH.mp && GL_AUTH._db && GL_AUTH.user) {
      const uid = GL_AUTH.user.uid;
      GL_AUTH._db.collection('divisions').doc(GL_AUTH.mp.divKey)
        .collection('raceResults').doc(String(round)).get()
        .then(snap => {
          if (!snap.exists) { GL_UI.toast(__('calendar_report_unavailable'), 'info'); return; }
          const r = snap.data();
          const ts = (r.teamSummaries && r.teamSummaries[uid]) || {};
          const myCars = ts.cars || (r.allCarsResults || []).filter(c => c.teamId === uid);
          const record = {
            ...r,
            playerCars: myCars,
            points: ts.points || 0,
            prizeMoney: ts.prizeMoney || 0,
            _viewerUid: uid,
          };
          const titleSuffix = record.circuit?.name || `R${round}`;
          GL_UI.openModal({
            title: `${__('postrace_title')} · ${titleSuffix}`,
            size: 'xl',
            content: GL_SCREENS._buildRaceReportModalContent(record, round)
          });
        }).catch(() => GL_UI.toast(__('calendar_report_unavailable'), 'info'));
      return;
    }
    const record = this.getRaceArchiveRecord(round);
    if (!record) {
      GL_UI.toast(__('calendar_report_unavailable'), 'info');
      return;
    }
    const titleSuffix = record.circuit?.name || `R${round}`;
    GL_UI.openModal({
      title: `${__('postrace_title')} · ${titleSuffix}`,
      size: 'xl',
      content: this._buildRaceReportModalContent(record, round)
    });
  },

  _buildRaceReportModalContent(record, round) {
    const playerCars = (Array.isArray(record.playerCars) ? record.playerCars : [])
      .slice()
      .sort((a, b) => {
        const posA = a?.isDNF ? 999 : Number(a?.position || 999);
        const posB = b?.isDNF ? 999 : Number(b?.position || 999);
        return posA - posB;
      });
    const leadCar = playerCars[0] || { position: record.position, isDNF: false, pilotName: 'Driver', points: record.points };
    const posColor = leadCar.position <= 1 ? 'var(--c-gold)' : leadCar.position <= 3 ? '#cd7c32' : leadCar.position <= 8 ? 'var(--c-green)' : 'var(--t-primary)';
    const teamResultSummary = playerCars.length
      ? playerCars.map((car) => `${car.pilotName || __('race_driver', 'Driver')} ${car.isDNF ? 'DNF' : `P${car.position}`}`).join(' · ')
      : `P${record.position}`;
    const teamResultHeadline = playerCars.length
      ? playerCars.map((car) => `<span class="badge ${car.isDNF ? 'badge-red' : 'badge-blue'}" style="font-size:0.74rem;padding:6px 10px">${car.pilotName || __('race_driver', 'Driver')}: ${car.isDNF ? 'DNF' : `P${car.position}`}</span>`).join(' ')
      : '';
    const heroTeamResults = playerCars.slice(0, 2).map((car) => {
      const driverName = car.pilotName || __('race_driver', 'Driver');
      const posText = car.isDNF ? 'DNF' : `P${car.position}`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)">
        <span style="font-size:0.78rem;color:var(--t-secondary)">${driverName}</span>
        <strong style="font-size:0.8rem;color:var(--t-primary)">${posText} · ${Number(car.points || 0)} pts</strong>
      </div>`;
    }).join('');

    // Hero metrics
    const eco = record.economySummary || {};
    const metricsHtml = `
      <div class="post-race-metrics" style="flex-wrap:wrap">
        <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-gold)">${record.points}</div><div class="post-race-metric-label">${__('postrace_team_points')}</div></div>
        <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${GL_UI.fmtCR(eco.prizeDelta ?? record.prizeMoney)}</div><div class="post-race-metric-label">${__('postrace_prize')}</div></div>
        ${eco.weeklyNetDelta != null ? `<div class="post-race-metric"><div class="post-race-metric-val" style="color:${eco.weeklyNetDelta >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${eco.weeklyNetDelta > 0 ? '+' : ''}${GL_UI.fmtCR(Math.abs(eco.weeklyNetDelta))}</div><div class="post-race-metric-label">${__('postrace_weekly_balance', 'Weekly balance')}</div></div>` : ''}
        ${eco.fansGained != null ? `<div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${Number(eco.fansGained).toLocaleString()}</div><div class="post-race-metric-label">${__('postrace_fans_gained')}</div></div>` : ''}
        <div class="post-race-metric"><div class="post-race-metric-val">${leadCar.improvement < 0 ? '▲'+Math.abs(leadCar.improvement) : leadCar.improvement > 0 ? '▼'+leadCar.improvement : '—'}</div><div class="post-race-metric-label">${__('postrace_vs_grid')}</div></div>
      </div>`;

    // Podium
    const finalGrid = Array.isArray(record.finalGrid) ? record.finalGrid : [];
    const podiumCars = finalGrid.slice(0, 3).map((car, idx) => {
      const pos = idx + 1;
      const trophy = pos === 1 ? '🏆' : (pos === 2 ? '🥈' : '🥉');
      const tierClass = pos === 1 ? 'gold' : (pos === 2 ? 'silver' : 'bronze');
      const pts = Number(GL_DATA.POINTS_TABLE[idx] || 0);
      return { car, pos, trophy, tierClass, pts };
    });
    const podiumOrder = [2, 1, 3];
    const podiumHtml = podiumOrder
      .map((pos) => podiumCars.find((entry) => entry.pos === pos))
      .filter(Boolean)
      .map((entry) => {
        const carName = entry.car?.name || __('race_driver', 'Driver');
        return `<div class="postrace-podium-slot ${entry.tierClass} ${entry.car?.isPlayer ? 'my-team' : ''}">
          <div class="postrace-podium-trophy">${entry.trophy}</div>
          <div class="postrace-podium-pos">P${entry.pos}</div>
          <div class="postrace-podium-name">${entry.car?.isPlayer ? `<strong>${carName}</strong>` : carName}</div>
          <div class="postrace-podium-pts">${entry.pts} pts</div>
          <div class="postrace-podium-base"></div>
        </div>`;
      }).join('');

    // Strategy audit rows
    const strategyRows = finalGrid.map((car, idx) => {
      let planLabel, stopSummary, tyreSummary;
      if (car.strategy) {
        // SP race: full strategy data available
        const summary = this.formatPitStrategySummary(car.strategy);
        planLabel = summary.planLabel; stopSummary = summary.stopSummary; tyreSummary = summary.tyreSummary;
      } else {
        // MP race: use actual race data (pitStopsDone, tyre)
        const stops = car.pitStopsDone != null ? car.pitStopsDone : '?';
        planLabel = stops === 1 ? this.getPitPlanLabel('single') : stops >= 2 ? this.getPitPlanLabel('double') : `${stops} ${__('pit_stops','paradas')}`;
        stopSummary = `${stops} ${__('pit_stop_count', 'parada(s)')}`;
        tyreSummary = car.tyre ? this.getCompoundLabel(car.tyre) : '—';
      }
      return `<div class="postrace-strategy-row ${car.isPlayer ? 'my-car' : ''}">
        <div class="postrace-strategy-main">
          <span class="postrace-strategy-pos">P${idx + 1}</span>
          <span class="postrace-strategy-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
          <span class="postrace-strategy-plan">${planLabel}</span>
        </div>
        <div class="postrace-strategy-meta">
          <span>${stopSummary}</span>
          <span>${tyreSummary}</span>
        </div>
      </div>`;
    }).join('');

    // Events log
    const playerEventPilotNames = this.getPlayerEventPilotNames(playerCars);
    const events = Array.isArray(record.events) ? record.events : [];
    const eventsHtml = events.length
      ? events.map((ev) => `<div class="race-event ${ev.type} ${this.isPlayerRelatedRaceEvent(ev.text, playerEventPilotNames) ? 'team-highlight' : ''}"><span class="race-event-lap">L${ev.lap}</span><span class="race-event-text">${ev.text}</span></div>`).join('')
      : `<div style="color:var(--t-secondary);font-size:0.82rem">—</div>`;

    // Classification top 10
    const classificationHtml = finalGrid.slice(0, 10).map((car, i) => `
      <div class="race-pos-row ${car.isPlayer ? 'my-car' : ''} ${i === 0 ? 'podium-gold' : i === 1 ? 'podium-silver' : i === 2 ? 'podium-bronze' : ''}">
        <span class="race-pos-num">${i + 1}</span>
        <span class="race-pos-name">${i === 0 ? '🏆 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}${car.isPlayer ? `<strong style="color:var(--c-accent)">${car.name}</strong>` : car.name}</span>
        <span style="font-size:0.78rem;color:var(--c-gold)">${GL_DATA.POINTS_TABLE[i] || 0} pts</span>
      </div>`).join('');

    return `
      <div class="post-race-hero" style="margin-bottom:var(--s-5)">
        <div class="post-race-position">
          <div class="post-race-pos-num" style="color:${posColor}">${leadCar.isDNF ? 'DNF' : 'P' + leadCar.position}</div>
          <div class="post-race-pos-label">${leadCar.isDNF ? __('postrace_dnf') : leadCar.position === 1 ? '🏆 ' + __('postrace_winner') : leadCar.position <= 3 ? '🥇 ' + __('postrace_podium') : __('postrace_classified')}</div>
        </div>
        <div class="post-race-info">
          <div class="post-race-title">${__('race_team_cars')}: ${teamResultSummary}</div>
          <div style="color:var(--t-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap">${record.circuit?.name} · ${__('postrace_weather')}: ${this.getWeatherLabel(record.weather)} ${teamResultHeadline}</div>
          <div style="display:grid;gap:6px;margin-top:10px">${heroTeamResults}</div>
          ${metricsHtml}
        </div>
      </div>
      ${podiumHtml ? `<div class="card mb-4 postrace-podium-card">
        <div class="postrace-podium-title">🏁 ${__('postrace_class')}</div>
        <div class="postrace-podium-wrap">${podiumHtml}</div>
      </div>` : ''}
      <div class="card mb-4 postrace-report-card">
        ${this.renderRaceComparisonTable(record)}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="section-eyebrow">${__('race_team_cars')}</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0 14px 0">
            ${playerCars.map((car) => `<div class="fin-item"><span>${car.pilotName}</span><strong>${car.isDNF ? 'DNF' : 'P' + car.position} · ${car.points || 0} pts</strong></div>`).join('')}
          </div>
          <div class="section-eyebrow">${__('postrace_events')}</div>
          <div class="race-event-log" style="max-height:250px;overflow-y:auto">${eventsHtml}</div>
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('postrace_class')}</div>
          <div class="race-grid-list">${classificationHtml}</div>
          <div class="divider"></div>
          <div class="section-eyebrow">${__('postrace_box_strategy_audit', 'Pit Strategy Audit')}</div>
          <div class="postrace-strategy-list">${strategyRows}</div>
        </div>
      </div>`;
  },

  // ===== CALENDAR SCREEN =====
  renderCalendar() {
    const mp = window.GL_AUTH && GL_AUTH.mp;
    if (GL_ENGINE.isMultiplayer && GL_ENGINE.isMultiplayer() && mp && mp.divKey && GL_AUTH._db) {
      const el = document.getElementById('screen-calendar');
      if (el) el.innerHTML = `<div style="padding:32px;color:var(--t-secondary);text-align:center">📡 ${__('loading') || 'Cargando calendario...'}</div>`;
      GL_AUTH._db.collection('divisions').doc(mp.divKey).get()
        .then(snap => { if (snap.exists) GL_STATE.syncCalendarFromDivision(snap.data()); })
        .catch(() => {})
        .finally(() => this._renderCalendarUI());
      return;
    }
    this._renderCalendarUI();
  },

  _renderCalendarUI() {
    const state = GL_STATE.getState();
    const isMP = GL_ENGINE.isMultiplayer && GL_ENGINE.isMultiplayer();
    if (!isMP && GL_ENGINE.ensureNextRaceAvailable) {
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
    const seasonProgress = cal.length ? Math.round((completedRaces.length / cal.length) * 100) : 0;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('calendar_eyebrow')} ${state.season.year}</div>
          <div class="screen-title">${__('calendar_title')}</div>
          <div class="screen-subtitle">${__('division')} ${(function(){ const _mp = window.GL_AUTH && GL_AUTH.mp && GL_AUTH.mp.division; const _d = _mp ? GL_AUTH.mp.division : state.season.division; const _g = _mp ? GL_AUTH.mp.divisionGroup : state.season.divisionGroup; return (typeof Divisions !== 'undefined' && Divisions.divisionLabel) ? Divisions.divisionLabel(_d, _g) : _d; })()} · ${cal.length} ${__('calendar_round').toLowerCase()} · ${__('topbar_week')} ${state.season.week}</div>
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
              ${isDone ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                ${res && res.position != null ? `<div class="calendar-result-pos" style="color:${res.position<=3?'var(--c-gold)':'var(--t-primary)'}">P${res.position}</div><div class="calendar-result-pts">+${res.points ?? 0} ${__('points')}</div>` : `<div class="calendar-result-pos" style="color:var(--t-secondary)">—</div>`}
                <button class="btn btn-secondary btn-sm" onclick="GL_SCREENS.openRaceReport(${r.round})">${__('calendar_view_report')}</button>
              </div>` :
              isNext ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                ${r.savedStrategy ? `<span style="font-size:0.72rem;color:var(--c-green)">✔ ${__('calendar_strat_ready')}</span>` : `<span style="font-size:0.72rem;color:var(--c-orange)">${__('calendar_strategy_missing')}</span>`}
                <button class="btn btn-primary btn-sm" onclick="GL_APP.navigateTo('prerace')">Preparar Carrera</button>
                <button class="btn btn-secondary btn-sm" onclick="GL_APP.navigateTo('liverace')">Ver Carrera en Vivo</button>
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
    // MMG: always fetch from Firestore
    this._renderMpStandings();
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
          <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.openMarketSponsors()">${__('dash_sponsors_market')}</button>
        </div>
        <div style="margin-top:var(--s-4);display:flex;flex-direction:column;gap:8px">
          ${activeSponsors.length
            ? activeSponsors
                .map((sp) => {
                  const incomeVal = Number(sp.weeklyValue || sp.income || 0);
                  const weeksLeft = sp.weeksLeft != null ? Number(sp.weeksLeft) : Number(sp.duration || 0);
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
  openMarketSponsors() {
    GL_APP.navigateTo('market');
    // renderMarket is called synchronously inside navigateTo, so sponsors tab
    // can be activated immediately without a timeout.
    const marketTabs = document.querySelectorAll('#screen-market .tabs .tab');
    if (marketTabs.length >= 2) {
      marketTabs.forEach(t => t.classList.remove('active'));
      marketTabs[1].classList.add('active');
      const mc = document.getElementById('market-content');
      if (mc) mc.innerHTML = this.marketSponsorList();
    }
  },

  // initialTab: 'pilots' | 'sponsors'  (default 'pilots')
  renderMarket(initialTab) {
    const tab = initialTab || 'pilots';
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
      <div class="tabs mb-6" style="max-width:400px" id="market-tabs">
        <button class="tab ${tab==='pilots'?'active':''}" onclick="GL_SCREENS.marketTab('pilots',this)">${__('market_tab_pilots')}</button>
        <button class="tab ${tab==='sponsors'?'active':''}" onclick="GL_SCREENS.marketTab('sponsors',this)">${__('market_tab_sponsors')}</button>
      </div>
      <div id="market-content">
        ${tab === 'sponsors' ? this.marketSponsorList() : this.marketPilotList(available)}
      </div>`;
  },

  marketTab(tab, btn) {
    // Scope to market screen tabs only to avoid touching tabs on other screens
    document.querySelectorAll('#screen-market .tabs .tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    const mc = document.getElementById('market-content');
    if (!mc) return;
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
    const state = GL_STATE.getState();
    const _spDiv = Number(state?.season?.division) || 8;
    const _SP_MULT = {1:13.0, 2:9.0, 3:6.5, 4:4.5, 5:3.2, 6:2.2, 7:1.5, 8:1.0};
    const _spMult = _SP_MULT[_spDiv] || 1.0;
    const activeSponsorIds = state.sponsors.filter(s => !s.expired).map(s => s.id);
    const activeCount = activeSponsorIds.length;
    const MAX_SPONSORS = 3;
    const fans = Number(state?.team?.fans || 0);
    const slotsFullMsg = activeCount >= MAX_SPONSORS
      ? `<div style="background:rgba(232,41,42,0.1);border:1px solid rgba(232,41,42,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:0.82rem;color:var(--c-accent)">⚠️ Tienes ${MAX_SPONSORS} patrocinadores activos (máximo). Rescinde uno para firmar otro.</div>`
      : `<div style="font-size:0.78rem;color:var(--t-tertiary);margin-bottom:10px">Slots de patrocinadores: <strong>${activeCount}/${MAX_SPONSORS}</strong></div>`;
    const allSponsors = GL_DATA.SPONSOR_POOL;
    if (!allSponsors.length) return `${slotsFullMsg}<p style="color:var(--t-secondary);font-size:0.9rem">No hay patrocinadores disponibles.</p>`;
    return slotsFullMsg + allSponsors.map(sp => {
      const scaledIncome = Math.round(sp.income * _spMult / 100) * 100;
      const scaledBonus = Math.round(sp.demandBonus * _spMult / 100) * 100;
      const isActive = activeSponsorIds.includes(sp.id);
      const locked = !isActive && fans < (sp.minFans || 0);
      const lockReason = locked ? `Requiere ${sp.minFans.toLocaleString()} fans (tienes ${fans.toLocaleString()})` : '';
      const slotsFull = activeCount >= MAX_SPONSORS;
      const canSign = !isActive && !locked && !slotsFull;
      return `
      <div class="market-pilot-row" style="${locked ? 'opacity:0.55' : isActive ? 'opacity:0.75' : ''}">
        <div class="market-pilot-avatar" style="font-size:2rem;background:${sp.bg||'#111'}">${locked ? '🔒' : sp.logo}</div>
        <div class="market-pilot-info">
          <div class="market-pilot-name" style="color:${locked ? 'var(--t-tertiary)' : sp.color}">${sp.name}</div>
          <div class="market-pilot-meta">${sp.duration} semanas · ${sp.demand}</div>
          <div style="font-size:0.74rem;color:var(--c-gold);margin-top:3px">🎯 Bonus si cumples: +${GL_UI.fmtCR(scaledBonus)}</div>
          ${locked ? `<div style="font-size:0.72rem;color:var(--c-accent);margin-top:3px">🔒 ${lockReason}</div>` : ''}
          ${isActive ? `<div style="font-size:0.72rem;color:var(--c-green);margin-top:3px">✓ Contrato activo</div>` : ''}
        </div>
        <div class="market-pilot-salary">
          <div class="market-pilot-salary-val">+${GL_UI.fmtCR(scaledIncome)}<span style="font-size:0.7rem">/sem</span></div>
          ${isActive
            ? `<span class="badge badge-gray" style="margin-top:var(--s-2);padding:5px 10px">Contratado</span>`
            : `<button class="btn btn-primary btn-sm" style="margin-top:var(--s-2)" ${canSign ? `onclick="GL_SCREENS.signSponsor('${sp.id}')"` : 'disabled'}>Firmar Acuerdo</button>`
          }
        </div>
      </div>`;
    }).join('');
  },

  signPilot(id) {
    const state = GL_STATE.getState();
    if (state.pilots.length >= 3) { GL_UI.toast(__('market_max_pilots'), 'warning'); return; }
    const p = GL_DATA.PILOT_POOL.find(x=>x.id===id);
    if (!p) return;
    if ((state.pilots || []).some(existing => existing.id === p.id || existing.name === p.name)) {
      GL_UI.toast(__('market_pilot_already_signed', 'Este piloto ya está en tu equipo.'), 'warning'); return;
    }
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
    const state = GL_STATE.getState();
    const active = state.sponsors.filter(s => !s.expired);
    if (active.length >= 3) { GL_UI.toast('Slots llenos. Rescinde un contrato antes de firmar uno nuevo.', 'warning'); return; }
    const fans = Number(state?.team?.fans || 0);
    if (fans < (sp.minFans || 0)) { GL_UI.toast(`Necesitas ${sp.minFans.toLocaleString()} fans para acceder a este sponsor.`, 'warning'); return; }
    const _spDiv = Number(state?.season?.division) || 8;
    const _SP_MULT = {1:13.0, 2:9.0, 3:6.5, 4:4.5, 5:3.2, 6:2.2, 7:1.5, 8:1.0};
    const _spMult = _SP_MULT[_spDiv] || 1.0;
    const scaledIncome = Math.round(sp.income * _spMult / 100) * 100;
    const scaledBonus = Math.round(sp.demandBonus * _spMult / 100) * 100;
    state.sponsors.push({
      ...GL_STATE.deepClone(sp),
      weeklyValue: scaledIncome,
      demandBonus: scaledBonus,
      weeksLeft: sp.duration,
      demandFailures: 0
    });
    GL_STATE.addLog(`💼 Acuerdo firmado con ${sp.name}: +${GL_UI.fmtCR(scaledIncome)}/sem`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${sp.name} firmado! +${GL_UI.fmtCR(scaledIncome)}/sem`, 'success');
    this._refreshSponsorTab();
    GL_DASHBOARD.refresh();
  },

  _refreshSponsorTab() {
    const currentScreen = window.GL_APP && GL_APP.currentScreen;

    if (currentScreen === 'staff') {
      const sc = document.getElementById('staff-content');
      if (sc) {
        sc.innerHTML = this._sponsorPanelContent();
        const state = GL_STATE.getState();
        const count = (state.sponsors || []).filter(s => !s.expired).length;
        const staffTabs = document.querySelectorAll('#screen-staff .tabs .tab');
        if (staffTabs.length >= 2) staffTabs[1].innerHTML = `Patrocinadores <span style="font-size:0.7rem;opacity:0.7">(${count})</span>`;
      }
      return;
    }

    if (currentScreen === 'market') {
      const mc = document.getElementById('market-content');
      if (mc) {
        mc.innerHTML = this.marketSponsorList();
        // Activate sponsors tab using screen-scoped selector
        const marketTabs = document.querySelectorAll('#screen-market .tabs .tab');
        marketTabs.forEach(t => t.classList.remove('active'));
        if (marketTabs.length >= 2) marketTabs[1].classList.add('active');
      } else {
        this.renderMarket('sponsors');
      }
    }
  },

  rescindSponsor(sponsorId) {
    const state = GL_STATE.getState();
    const idx = state.sponsors.findIndex(s => s.id === sponsorId && !s.expired);
    if (idx === -1) return;
    const sp = state.sponsors[idx];
    const penalty = Math.round((sp.weeklyValue || 0) * Math.max(1, sp.weeksLeft || 1) * 0.2);
    GL_UI.confirm(
      'Rescindir contrato',
      `¿Rescindir el contrato con ${sp.name}? Penalización: -${GL_UI.fmtCR(penalty)} CR por incumplimiento.`
    ).then(ok => {
      if (!ok) return;
      sp.expired = true;
      if (penalty > 0) GL_STATE.addCredits(-penalty);
      GL_STATE.addLog(`💼 Contrato rescindido con ${sp.name}. Penalización: -${GL_UI.fmtCR(penalty)} CR`, 'bad');
      GL_STATE.saveState();
      GL_UI.toast(`Contrato rescindido.`, 'warning');
      this._refreshSponsorTab();
      GL_DASHBOARD.refresh();
    });
  },

  // ===== MP STANDINGS =====
  _renderMpStandings() {
    const el = document.getElementById('screen-standings');
    if (!el) return;
    const mp = window.GL_AUTH && GL_AUTH.mp;
    if (!mp || !mp.divKey || !GL_AUTH._db) {
      el.innerHTML = `<div class="card"><p style="color:var(--t-tertiary)">📡 Conectando a la división...</p></div>`;
      return;
    }

    // Render local panels immediately (campaign, history, hall of fame come from local state)
    const state = GL_STATE.getState();
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
    const recentSeasonHistory = seasonHistory.map((summary, index) => ({ summary, index })).slice(-5).reverse();
    const seasonHistoryHtml = recentSeasonHistory.length
      ? recentSeasonHistory.map(({ summary, index }) => {
          const resultLabel = summary.result === 'promoted'
            ? __('season_summary_transition_promoted')
            : (summary.result === 'relegated' ? __('season_summary_transition_relegated') : __('season_summary_transition_stayed'));
          const _hDiv = (typeof Divisions !== 'undefined' && Divisions.divisionLabel) ? Divisions.divisionLabel(summary.division, summary.divisionGroup) : summary.division;
          return `<button class="btn btn-ghost btn-sm" style="justify-content:space-between;width:100%;margin-bottom:8px" onclick="GL_DASHBOARD.openSeasonSummaryHistory(${index})">
            <span>${__('season_history_year')} ${summary.year} · ${__('division')} ${_hDiv}</span>
            <span>P${summary.finishPosition} · ${resultLabel}</span>
          </button>`;
        }).join('')
      : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('season_history_empty')}</div>`;
    const titles           = seasonHistory.filter((s) => Number(s.division) === 1 && Number(s.finishPosition) === 1).length;
    const promotions       = seasonHistory.filter((s) => s.result === 'promoted').length;
    const podiumsTotal     = seasonHistory.reduce((sum, s) => sum + (Number(s.podiums) || 0), 0);
    const winsTotal        = seasonHistory.reduce((sum, s) => sum + (Number(s.wins)    || 0), 0);
    const campaignMilestones = Array.isArray(state?.campaign?.history) ? state.campaign.history.length : 0;
    const bestFinish       = seasonHistory.length ? seasonHistory.reduce((b, s) => Math.min(b, Number(s.finishPosition) || 99), 99) : null;
    const hofEntries       = seasonHistory.filter((s) => s.result === 'promoted' || Number(s.finishPosition) <= 3 || (Number(s.division) === 1 && Number(s.finishPosition) === 1)).slice(-4).reverse();
    const hallOfFameHtml   = hofEntries.length
      ? hofEntries.map((s) => {
          const badge = Number(s.division) === 1 && Number(s.finishPosition) === 1 ? __('hall_of_fame_badge_title') : (s.result === 'promoted' ? __('hall_of_fame_badge_promotion') : __('hall_of_fame_badge_podium'));
          const _hDiv = (typeof Divisions !== 'undefined' && Divisions.divisionLabel) ? Divisions.divisionLabel(s.division, s.divisionGroup) : s.division;
          return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.78rem;color:var(--t-secondary);padding:8px 0;border-bottom:1px solid var(--c-border-hi)">
            <span>${__('season_history_year')} ${s.year} · ${__('division')} ${_hDiv}</span>
            <span><strong style="color:var(--t-primary)">${badge}</strong> · P${s.finishPosition}</span>
          </div>`;
        }).join('')
      : `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('hall_of_fame_empty')}</div>`;

    // Skeleton with placeholder for live table
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('standings_eyebrow')}</div>
          <div class="screen-title" id="mp-standings-title">📡 ${__('standings_title')}</div>
          <div class="screen-subtitle" id="mp-standings-subtitle">Cargando división...</div>
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
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('hall_of_fame_podiums')}</div><div style="font-size:1.2rem;font-weight:800;color:var(--t-primary)">${podiumsTotal}</div></div>
            <div style="padding:10px;border-radius:10px;background:var(--c-surface-2)"><div style="font-size:0.72rem;color:var(--t-tertiary)">Victorias totales</div><div style="font-size:1.2rem;font-weight:800;color:var(--t-primary)">${winsTotal}</div></div>
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
      <div class="card p-0" id="mp-live-standings-table">
        <div style="padding:16px;color:var(--t-tertiary);font-size:0.82rem">📡 Cargando clasificación en vivo...</div>
      </div>`;

    // Fetch live standings from Firestore and fill table
    GL_AUTH._db.collection('divisions').doc(mp.divKey).get().then(snap => {
      const titleEl    = document.getElementById('mp-standings-title');
      const subtitleEl = document.getElementById('mp-standings-subtitle');
      const tableEl    = document.getElementById('mp-live-standings-table');
      if (!snap.exists) {
        if (tableEl) tableEl.innerHTML = '<div style="padding:16px;color:var(--c-red)">División no encontrada.</div>';
        return;
      }
      const data = snap.data();
      const standings = (data.standings || []).slice().sort((a, b) => (a.position || 99) - (b.position || 99));
      if (window.GL_TEAM_PROFILE) GL_TEAM_PROFILE._divStandings = standings;
      const divInfo  = GL_DATA.DIVISIONS.find(d => d.div === data.division);
      const promoZone = divInfo ? divInfo.promotions : 0;
      const relegZone = divInfo ? divInfo.relegations : 0;
      const totalTeams = standings.length;
      if (titleEl)    titleEl.textContent    = `📡 ${__('division')} ${data.division}-${data.group} · ${__('standings_title')}`;
      if (subtitleEl) subtitleEl.textContent = `${divInfo?.name || ''} · ${__('season_history_year')} ${data.seasonYear || 1} · ${promoZone} ${__('standings_promotion_spots')}`;
      if (tableEl) tableEl.innerHTML = `
        <table class="standings-table-full">
          <thead><tr>
            <th>${__('standings_pos')}</th>
            <th>${__('standings_team')}</th>
            <th>${__('standings_points')}</th>
            <th>${__('standings_wins')}</th>
            <th>${__('standings_podiums', 'Podios')}</th>
            <th>${__('standings_status')}</th>
          </tr></thead>
          <tbody>
            ${standings.map((s, idx) => {
              const isMe   = s.isPlayer && s.teamId === GL_AUTH.user?.uid;
              const isPromo = idx < promoZone;
              const isReleg = idx >= totalTeams - relegZone && relegZone > 0;
              return `<tr class="${isMe ? 'my-row' : ''} ${isPromo ? 'promoted' : ''} ${isReleg ? 'relegated' : ''}">
                <td><div class="pos-badge pos-${idx < 3 ? idx + 1 : 'n'}">${s.position || idx + 1}</div></td>
                <td style="display:flex;align-items:center;gap:var(--s-2);min-width:200px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color || '#888'};flex-shrink:0"></span>
                  <span style="cursor:pointer;text-decoration:underline dotted" onclick="GL_TEAM_PROFILE.openTeamByIndex(${idx})">${s.teamName || 'Team'}${s.isPlayer ? '' : ' 🤖'}${isMe ? ' ⭐' : ''}</span>
                  ${isMe ? `<span style="font-size:0.8rem;color:var(--c-accent)">${__('standings_you')}</span>` : ''}
                </td>
                <td><strong style="color:var(--c-gold)">${s.points || 0}</strong></td>
                <td>${s.wins || 0}</td>
                <td>${s.podiums || 0}</td>
                <td>${isPromo ? `<span class="badge badge-green">${__('standings_promote')}</span>` : isReleg ? `<span class="badge badge-red">${__('standings_relegate')}</span>` : '–'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${promoZone > 0 ? `<div style="padding:8px 16px;font-size:0.72rem;color:var(--c-green)">▲ Top ${promoZone}: zona de ascenso</div>` : ''}
        ${relegZone > 0 ? `<div style="padding:4px 16px 10px;font-size:0.72rem;color:var(--c-red)">▼ Últimos ${relegZone}: zona de descenso</div>` : ''}`;
    }).catch(err => {
      const tableEl = document.getElementById('mp-live-standings-table');
      if (tableEl) tableEl.innerHTML = `<div style="padding:16px;color:var(--c-red)">Error: ${err.message || err}</div>`;
    });
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
          <div style="font-size:0.74rem;color:var(--t-secondary);margin-top:4px">${__('prerace_mp_info') || 'La carrera se simula automáticamente el domingo 18:00 UTC'}</div>
        </div>
      </div>
      <div class="prerace-grid">
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_driver_assign')}</div>
          <div style="font-size:0.74rem;color:var(--t-secondary);margin-bottom:10px">Selecciona hasta 2 pilotos para correr. Cada coche usa su propio compuesto, motor, plan de pit, setup y llamadas tácticas.</div>
          ${state.pilots.map(p => {
            const selectedIds = window._raceStrategy?.selectedPilotIds || [];
            const selected = selectedIds.includes(p.id);
            const pilotSlot = selectedIds.indexOf(p.id); // 0 = P1, 1 = P2
            const slotLabel = pilotSlot === 0 ? 'Piloto 1' : pilotSlot === 1 ? 'Piloto 2' : null;
            const slotColor = pilotSlot === 0 ? 'var(--c-accent)' : '#a78bfa';
            const cfg = this.getDriverStrategyDefaults(window._raceStrategy || baseStrategy, window._raceStrategy?.driverConfigs?.[p.id] || {});
            const tyreMeta = this.getTyreMeta(cfg.tyre);
            return `
            <div class="morale-pill" style="margin-bottom:var(--s-3);${selected ? `border:1.5px solid ${slotColor}55;` : ''}">
              <div class="morale-avatar" style="font-size:1.2rem">${p.emoji||'🧑'}</div>
              <div class="morale-info">
                <div class="morale-name">${p.name}${slotLabel ? ` <span style="font-size:0.65rem;font-weight:700;color:${slotColor};background:${slotColor}18;border:1px solid ${slotColor}44;border-radius:4px;padding:1px 6px;vertical-align:middle;margin-left:4px">${slotLabel}</span>` : ''}</div>
                <div style="font-size:0.7rem;color:var(--t-secondary)">Base igualada · la diferencia la hace la estrategia individual</div>
              </div>
              <button class="btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}" data-pilot-btn="${p.id}" style="margin-left:auto" onclick="GL_SCREENS.toggleRacePilot('${p.id}')">${selected ? 'En carrera' : 'Reserva'}</button>
            </div>
            ${selected ? `
              <div class="ds-card" style="border-left:3px solid ${slotColor};margin-bottom:var(--s-4)">
                <div class="ds-card-header">
                  <span class="ds-card-title">🎯 Táctica de carrera <span style="font-size:0.7rem;font-weight:700;color:${slotColor};background:${slotColor}18;border:1px solid ${slotColor}44;border-radius:4px;padding:1px 7px;margin-left:6px;vertical-align:middle">${slotLabel}</span></span>
                  <span class="ds-card-pilot">${p.name}</span>
                </div>

                <div class="ds-section">
                  <div class="ds-section-label">Neumático de salida</div>
                  <div class="ds-tyre-row">
                    <span class="badge" style="background:${tyreMeta.color}22;color:${tyreMeta.color};border:1px solid ${tyreMeta.color}55;padding:3px 10px">${tyreMeta.label}</span>
                    <span class="ds-tyre-meta">${tyreMeta.paceText} · ${tyreMeta.durabilityText}</span>
                  </div>
                  <div class="ds-selects-row">
                    <div class="ds-select-wrap">
                      <label class="ds-select-label">Neumático</label>
                      <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','tyre',this.value)">
                        <option value="soft" ${cfg.tyre === 'soft' ? 'selected' : ''}>Blando</option>
                        <option value="medium" ${cfg.tyre === 'medium' || !cfg.tyre ? 'selected' : ''}>Medio</option>
                        <option value="hard" ${cfg.tyre === 'hard' ? 'selected' : ''}>Duro</option>
                        <option value="intermediate" ${cfg.tyre === 'intermediate' ? 'selected' : ''}>Intermedio</option>
                        <option value="wet" ${cfg.tyre === 'wet' ? 'selected' : ''}>Lluvia</option>
                      </select>
                    </div>
                    <div class="ds-select-wrap">
                      <label class="ds-select-label">Modo motor</label>
                      <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','engineMode',this.value)">
                        <option value="eco" ${cfg.engineMode === 'eco' ? 'selected' : ''}>${this.getEngineModeLabel('eco')}</option>
                        <option value="normal" ${cfg.engineMode === 'normal' || !cfg.engineMode ? 'selected' : ''}>${this.getEngineModeLabel('normal')}</option>
                        <option value="push" ${cfg.engineMode === 'push' ? 'selected' : ''}>${this.getEngineModeLabel('push')}</option>
                      </select>
                    </div>
                    <div class="ds-select-wrap">
                      <label class="ds-select-label">Plan de boxes</label>
                      <select onchange="GL_SCREENS.updateDriverStrategy('${p.id}','pitPlan',this.value)">
                        <option value="single" ${cfg.pitPlan === 'single' || !cfg.pitPlan ? 'selected' : ''}>${this.getPitPlanLabel('single')}</option>
                        <option value="double" ${cfg.pitPlan === 'double' ? 'selected' : ''}>${this.getPitPlanLabel('double')}</option>
                      </select>
                    </div>
                  </div>
                  <div class="ds-selects-row ds-selects-2col" style="margin-top:6px">
                    <div class="ds-select-wrap">
                      <label class="ds-select-label">Neumático tras parada 1</label>
                      <select onchange="GL_SCREENS.updateDriverPitTyre('${p.id}',0,this.value)">
                        <option value="soft" ${cfg.pitTyres?.[0] === 'soft' ? 'selected' : ''}>Blando</option>
                        <option value="medium" ${cfg.pitTyres?.[0] === 'medium' ? 'selected' : ''}>Medio</option>
                        <option value="hard" ${cfg.pitTyres?.[0] === 'hard' ? 'selected' : ''}>Duro</option>
                        <option value="intermediate" ${cfg.pitTyres?.[0] === 'intermediate' ? 'selected' : ''}>Intermedio</option>
                        <option value="wet" ${cfg.pitTyres?.[0] === 'wet' ? 'selected' : ''}>Lluvia</option>
                      </select>
                    </div>
                    <div class="ds-select-wrap">
                      <label class="ds-select-label">Neumático tras parada 2</label>
                      <select onchange="GL_SCREENS.updateDriverPitTyre('${p.id}',1,this.value)" ${cfg.pitPlan === 'single' ? 'disabled' : ''}>
                        <option value="soft" ${cfg.pitTyres?.[1] === 'soft' ? 'selected' : ''}>Blando</option>
                        <option value="medium" ${cfg.pitTyres?.[1] === 'medium' ? 'selected' : ''}>Medio</option>
                        <option value="hard" ${cfg.pitTyres?.[1] === 'hard' ? 'selected' : ''}>Duro</option>
                        <option value="intermediate" ${cfg.pitTyres?.[1] === 'intermediate' ? 'selected' : ''}>Intermedio</option>
                        <option value="wet" ${cfg.pitTyres?.[1] === 'wet' ? 'selected' : ''}>Lluvia</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="ds-divider"></div>
                <div class="ds-section-label" style="margin-bottom:8px">🏎️ Comportamiento en pista</div>
                <div class="ds-sliders-grid">
                  ${this.driverSliderHtml(p.id, 'aggression', 'Agresividad', cfg.aggression, `GL_SCREENS.updateDriverStrategy('${p.id}','aggression',v,true)`)}
                  ${this.driverSliderHtml(p.id, 'riskLevel', 'Nivel de riesgo', cfg.riskLevel, `GL_SCREENS.updateDriverStrategy('${p.id}','riskLevel',v,true)`)}
                </div>

                <div class="ds-divider"></div>
                <div class="ds-section-label" style="margin-bottom:8px">⚙️ Puesta a punto</div>
                <div class="ds-sliders-grid">
                  ${this.driverSliderHtml(p.id, 'aeroBalance', 'Balance aerodinámico', cfg.setup.aeroBalance, `GL_SCREENS.updateDriverSetup('${p.id}','aeroBalance',v,true)`)}
                  ${this.driverSliderHtml(p.id, 'wetBias', 'Ajuste para clima', cfg.setup.wetBias, `GL_SCREENS.updateDriverSetup('${p.id}','wetBias',v,true)`)}
                </div>

                <div class="ds-divider"></div>
                <div class="ds-section-label" style="margin-bottom:8px">🏁 Programación de paradas</div>
                <div class="ds-sliders-grid">
                  ${this.driverPitSliderHtml(p.id, 0, cfg.interventions[0].lapPct, false)}
                  ${this.driverPitSliderHtml(p.id, 1, cfg.interventions[1].lapPct, cfg.pitPlan === 'single')}
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
          ${GL_UI.statRow(__('prerace_rain_prob'), `${100 - c.weather}%`, '📊')}
          ${(() => {
            const _wins = Array.isArray(fc.windows) ? fc.windows.filter(w => Number.isFinite(w?.wetProb)) : [];
            const _avg = _wins.length ? Math.round(_wins.reduce((s, w) => s + w.wetProb, 0) / _wins.length) : 0;
            return GL_UI.statRow(__('prerace_forecast_avg'), `${_avg}% ${__('prerace_forecast_wet')}`, '🌧️');
          })()}
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
      if (selected.length <= 2) {
        GL_UI.toast('Debes correr con 2 pilotos. No puedes dejar uno sin asignar.', 'warning');
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
    if (nextIdx === -1) return;
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

    const next = state.season.calendar[nextIdx];
    const mp = window.GL_AUTH && GL_AUTH.mp;
    const db = GL_AUTH && GL_AUTH._db;
    if (GL_ENGINE.isMultiplayer() && mp && mp.divKey && db && GL_AUTH.user) {
      const strategy = GL_STATE.deepClone(next.savedStrategy);
      const uid = GL_AUTH.user.uid;
      const divRef = db.collection('divisions').doc(mp.divKey);
      // Read nextRaceRound from Firestore to avoid using stale local calendar round
      divRef.get().then(divSnap => {
        const raceRound = divSnap.exists ? (divSnap.data().nextRaceRound || next.round) : next.round;
        return divRef.collection('strategies').doc(uid).set({
          userId: uid,
          slotIndex: mp.slotIndex,
          raceRound: raceRound,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          strategy: strategy
        });
      }).then(() => {
        GL_UI.toast(window.__('prerace_strat_saved') || 'Estrategia guardada con éxito', 'good');
        if (GL_STATE.syncTeamSnapshot) GL_STATE.syncTeamSnapshot();
      }).catch(err => {
        GL_UI.toast('Error al guardar: ' + (err.message || err), 'error');
      });
    } else {
      GL_UI.toast(window.__('prerace_strat_saved') || 'Estrategia guardada con éxito', 'good');
    }
    this.renderPreRace();
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
        const gapToLeader = idx === 0
          ? __('race_leader')
          : (Number.isFinite(car.gapMs)
              ? `+${(car.gapMs / 1000).toFixed(1)}s`
              : `+${(idx * 0.9).toFixed(1)}s`);
        const aheadCar = idx > 0 ? live[idx - 1] : null;
        const intervalMs = (aheadCar && Number.isFinite(car.gapMs) && Number.isFinite(aheadCar.gapMs))
          ? (car.gapMs - aheadCar.gapMs)
          : null;
        const intervalStr = (idx > 0 && intervalMs !== null)
          ? `▲${(Math.max(0, intervalMs) / 1000).toFixed(1)}s`
          : '';
        const dotColor = car.color || '#888';
        const tyreMeta = this.getTyreMeta(car.tyre);
        const status = car.retired
          ? 'DNF'
          : car.pit
            ? `BOX ${Number.isFinite(car.pitLossMs) && car.pitLossMs > 0 ? `· -${(car.pitLossMs / 1000).toFixed(1)}s` : ''}`
            : gapToLeader;
        return `
          <div class="race-pos-row ${car.isPlayer?'my-car':''}" style="--team-color:${dotColor}">
            <span class="race-pos-num">${car.pos || (idx + 1)}</span>
            <span class="race-pos-teamdot" style="background:${dotColor}"></span>
            <span class="race-pos-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
            <span class="race-pos-tire" title="${tyreMeta.label}" style="color:${tyreMeta.color};font-weight:800">${tyreMeta.shortLabel}</span>
            <span class="race-pos-gap" style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;line-height:1.1">
              <span>${status}</span>
              ${intervalStr && !car.retired && !car.pit ? `<span style="font-size:0.68rem;color:var(--t-secondary);font-weight:500">${intervalStr}</span>` : ''}
            </span>
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

      const _bestPos = Array.isArray(result.playerCars) && result.playerCars.length > 0
        ? result.playerCars.reduce((b, c) => Math.min(b, (c && Number.isFinite(c.position) ? c.position : 99)), 99)
        : (result.position || 99);
      const _rndBasePoints = _bestPos === 1 ? 10 : _bestPos === 2 ? 8 : _bestPos === 3 ? 6 : _bestPos <= 10 ? 3 : _bestPos <= 20 ? 1 : 0;
      const _rndBuildingLv = (state.hq && state.hq.rnd) ? Number(state.hq.rnd) : 1;
      const _rndBonus = Math.max(0, _rndBuildingLv - 1);
      const _rndEarned = _rndBasePoints > 0 ? _rndBasePoints + _rndBonus : 0;
      if (_rndEarned > 0) {
        state.car.rnd.points = (state.car.rnd.points || 0) + _rndEarned;
        const _rndMsg = _rndBonus > 0 ? `🔬 +${_rndEarned} pts de I+D (P${_bestPos}, +${_rndBonus} bonus I+D Lv${_rndBuildingLv})` : `🔬 +${_rndEarned} pts de I+D (P${_bestPos})`;
        GL_STATE.addLog(_rndMsg, 'good');
      }
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

  // ===== LIVE RACE SCREEN =====
  cleanupLiveRace() {
    if (window._liveRaceListener) { window._liveRaceListener(); window._liveRaceListener = null; }
    if (window._liveRaceCountdownInterval) { clearInterval(window._liveRaceCountdownInterval); window._liveRaceCountdownInterval = null; }
    if (window._liveRaceAnimFrame) { cancelAnimationFrame(window._liveRaceAnimFrame); window._liveRaceAnimFrame = null; }
    this._raceVisualState = {};
    this._retiredSlotMap = {};
  },

  renderLiveRace() {
    this.cleanupLiveRace();
    const el = document.getElementById('screen-liverace');
    if (!el) return;

    const mp = window.GL_AUTH && GL_AUTH.mp;
    if (!mp || !mp.divKey) {
      el.innerHTML = `<div class="screen-header"><div class="screen-title-group"><div class="screen-title">Sin división asignada</div></div><div class="screen-actions"><button class="btn btn-secondary" onclick="GL_APP.navigateTo('calendar')">← Calendario</button></div></div>`;
      return;
    }

    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const next = cal.find(r => r.status === 'next');
    const circuit = next?.circuit || GL_DATA.CIRCUITS[0];
    const weather = next?.weather || 'dry';
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">Carrera en Vivo · Ronda ${next?.round || '–'}</div>
          <div class="screen-title">${circuit.name}</div>
          <div class="screen-subtitle">${weather === 'wet' ? '🌧️' : '☀️'} ${weather} · Esperando inicio</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('calendar')">← Calendario</button>
        </div>
      </div>
      <div class="race-layout">
        <div class="race-track-view">
          <div class="race-track-bg"></div>
          <div class="race-status-bar" id="liverace-status-bar">
            <span class="race-lap-counter" id="liverace-lap">⏳ Esperando inicio...</span>
            <span class="race-condition">${weather === 'wet' ? '🌧️' : '☀️'} ${weather.charAt(0).toUpperCase() + weather.slice(1)} · ${circuit.laps} vueltas</span>
          </div>
          ${this.getRaceTrackStageMarkup(circuit, weather, 'liverace')}
          <div class="race-event-log" id="liverace-event-log">
            <div class="race-event" style="border-color:var(--c-border)">
              <span class="race-event-text">⏳ Esperando que el administrador inicie la carrera...</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">Grilla en Vivo</div>
            <div class="race-grid-list" id="liverace-grid-list">
              <div style="color:var(--t-tertiary);font-size:0.82rem;padding:var(--s-4) 0">La grilla aparecerá al comenzar la carrera.</div>
            </div>
          </div>
        </div>
      </div>`;

    this.renderRaceTrackVisualization({ liveOrder: [], progress: 0, totalLaps: circuit.laps || 1, currentLap: 1, circuit, weather, idPrefix: 'liverace' });

    const divRef = GL_AUTH._db.collection('divisions').doc(mp.divKey);
    window._liveRaceListener = divRef.onSnapshot(snap => {
      if (!snap.exists) return;
      const liveState = snap.data().liveRaceState;
      if (!liveState || liveState.status !== 'live') return;
      if (window._liveRaceListener) { window._liveRaceListener(); window._liveRaceListener = null; }
      this._startLiveRaceCountdown(liveState, mp.divKey);
    });
  },

  _startLiveRaceCountdown(liveState, divKey) {
    const startTimeMs = liveState.startTime
      ? (liveState.startTime.toMillis ? liveState.startTime.toMillis() : Number(liveState.startTime))
      : Date.now();
    const raceStartMs = startTimeMs + 10000;
    const durationMode = liveState.durationMode || 'real';
    const lapEl = document.getElementById('liverace-lap');
    const log = document.getElementById('liverace-event-log');

    const tick = () => {
      const remaining = raceStartMs - Date.now();
      if (remaining <= 0) {
        clearInterval(window._liveRaceCountdownInterval);
        window._liveRaceCountdownInterval = null;
        if (lapEl) lapEl.textContent = '🏁 ¡Arrancamos!';
        if (log) {
          const div = document.createElement('div');
          div.className = 'race-event';
          div.innerHTML = '<span class="race-event-text">🏁 ¡Comienza la carrera!</span>';
          log.innerHTML = '';
          log.appendChild(div);
        }
        this._fetchAndStartLiveRace(divKey, liveState.round, raceStartMs, durationMode);
      } else {
        const secs = Math.ceil(remaining / 1000);
        if (lapEl) lapEl.textContent = `🚦 Salida en ${secs}...`;
      }
    };

    tick();
    if (raceStartMs > Date.now()) {
      window._liveRaceCountdownInterval = setInterval(tick, 200);
    }
  },

  async _fetchAndStartLiveRace(divKey, round, raceStartMs, durationMode) {
    try {
      const resultSnap = await GL_AUTH._db
        .collection('divisions').doc(divKey)
        .collection('raceResults').doc(String(round))
        .get();
      if (!resultSnap.exists) { GL_UI.toast('Error: resultado de carrera no encontrado.', 'warning'); return; }
      const result = resultSnap.data();
      const uid = GL_AUTH.user && GL_AUTH.user.uid;
      const viewerCars = uid ? (result.allCarsResults || []).filter(c => c.teamId === uid) : [];
      this._runLiveRaceVisualization({ ...result, viewerCars }, raceStartMs, durationMode);
    } catch (e) {
      GL_UI.toast('Error al cargar la carrera en vivo.', 'warning');
    }
  },

  _runLiveRaceVisualization(result, raceStartMs, durationMode = 'real') {
    const log = document.getElementById('liverace-event-log');
    const lapEl = document.getElementById('liverace-lap');
    if (log) log.innerHTML = '';

    const LIVE_RACE_DURATION_MS = durationMode === 'qa' ? (2 * 60 * 1000) : (8 * 60 * 1000);
    const allEvents = Array.isArray(result.events) ? result.events : [];
    const totalLaps = result.totalLaps || 30;
    const gridStart = Array.isArray(result.gridStart) ? result.gridStart : [];
    const finalGrid = Array.isArray(result.finalGrid) ? result.finalGrid : [];
    const lapSnapshots = Array.isArray(result.lapSnapshots) ? result.lapSnapshots : [];
    const circuit = result.circuit || GL_DATA.CIRCUITS[0];
    const weather = result.weather || 'dry';
    const playerEventPilotNames = this.getPlayerEventPilotNames(result.viewerCars || []);

    const startPosMap = {};
    const finalPosMap = {};
    gridStart.forEach((car, idx) => { startPosMap[car.id] = idx + 1; });
    finalGrid.forEach((car, idx) => { finalPosMap[car.id] = idx + 1; });

    let eventCursor = 0;
    let tick = 0;
    let finished = false;

    const formatRemaining = (ms) => {
      const sec = Math.max(0, Math.ceil(ms / 1000));
      return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    };

    const renderLiveGrid = (live) => {
      const gl = document.getElementById('liverace-grid-list');
      if (!gl) return;
      gl.innerHTML = live.slice(0, 20).map((car, idx) => {
        const gapToLeader = idx === 0 ? __('race_leader') : (Number.isFinite(car.gapMs) ? `+${(car.gapMs / 1000).toFixed(1)}s` : `+${(idx * 0.9).toFixed(1)}s`);
        const aheadCar = idx > 0 ? live[idx - 1] : null;
        const intervalMs = (aheadCar && Number.isFinite(car.gapMs) && Number.isFinite(aheadCar.gapMs)) ? (car.gapMs - aheadCar.gapMs) : null;
        const intervalStr = (idx > 0 && intervalMs !== null) ? `▲${(Math.max(0, intervalMs) / 1000).toFixed(1)}s` : '';
        const dotColor = car.color || '#888';
        const tyreMeta = this.getTyreMeta(car.tyre);
        const status = car.retired ? 'DNF' : car.pit ? `BOX ${Number.isFinite(car.pitLossMs) && car.pitLossMs > 0 ? `· -${(car.pitLossMs / 1000).toFixed(1)}s` : ''}` : gapToLeader;
        return `<div class="race-pos-row ${car.isPlayer ? 'my-car' : ''}" style="--team-color:${dotColor}">
          <span class="race-pos-num">${car.pos || (idx + 1)}</span>
          <span class="race-pos-teamdot" style="background:${dotColor}"></span>
          <span class="race-pos-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
          <span class="race-pos-tire" title="${tyreMeta.label}" style="color:${tyreMeta.color};font-weight:800">${tyreMeta.shortLabel}</span>
          <span class="race-pos-gap" style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;line-height:1.1">
            <span>${status}</span>
            ${intervalStr && !car.retired && !car.pit ? `<span style="font-size:0.68rem;color:var(--t-secondary);font-weight:500">${intervalStr}</span>` : ''}
          </span>
        </div>`;
      }).join('');
    };

    const finishRace = () => {
      if (finished) return;
      finished = true;
      if (lapEl) lapEl.textContent = '🏁 ¡Carrera finalizada!';
      setTimeout(() => GL_APP.navigateTo('postrace'), 1500);
    };

    const runTick = () => {
      tick += 1;
      const elapsed = Date.now() - raceStartMs;
      if (elapsed < 0) { window._liveRaceAnimFrame = requestAnimationFrame(runTick); return; }

      const progress = Math.max(0, Math.min(1, elapsed / LIVE_RACE_DURATION_MS));
      const lapProgress = progress * totalLaps;
      const currentLap = Math.max(1, Math.min(totalLaps, Math.floor(lapProgress) + 1));
      const lapBlend = lapProgress % 1;
      const remaining = LIVE_RACE_DURATION_MS - elapsed;

      const liveOrder = this.buildLiveRaceOrder({ lapSnapshots, currentLap, lapBlend, finalGrid, startPosMap, finalPosMap, progress, tick });
      const liveWeather = lapSnapshots[currentLap - 1]?.weather || weather;

      if (lapEl) lapEl.textContent = `🏁 Vuelta ${currentLap} / ${totalLaps} · ${formatRemaining(remaining)}`;

      const shouldShowEvents = Math.floor(progress * allEvents.length);
      while (eventCursor < shouldShowEvents) {
        const ev = allEvents[eventCursor];
        if (log) {
          const div = document.createElement('div');
          const teamHighlightClass = this.isPlayerRelatedRaceEvent(ev.text, playerEventPilotNames) ? 'team-highlight' : '';
          div.className = `race-event ${ev.type || ''} ${teamHighlightClass}`.trim();
          div.innerHTML = `<span class="race-event-lap">${__('race_lap_short')} ${ev.lap}</span><span class="race-event-text">${ev.text}</span>`;
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        eventCursor += 1;
      }

      renderLiveGrid(liveOrder);
      this.renderRaceTrackVisualization({ liveOrder, progress, totalLaps, currentLap, circuit, weather: liveWeather, idPrefix: 'liverace' });

      if (progress >= 1) { finishRace(); return; }
      window._liveRaceAnimFrame = requestAnimationFrame(runTick);
    };

    window._liveRaceAnimFrame = requestAnimationFrame(runTick);
  },

  // ===== POST-RACE SCREEN =====
  renderPostRace() {
    const el = document.getElementById('screen-postrace');
    if (!el) return;

    // In MP mode, load the last race result from Firestore if not already loaded
    const isMP = typeof GL_ENGINE !== 'undefined' && GL_ENGINE.isMultiplayer && GL_ENGINE.isMultiplayer();
    if (isMP && GL_AUTH && GL_AUTH.mp && GL_AUTH._db && GL_AUTH.user) {
      const mp = GL_AUTH.mp;
      const uid = GL_AUTH.user.uid;
      const divSnap = GL_AUTH._db.collection('divisions').doc(mp.divKey);
      divSnap.get().then(snap => {
        if (!snap.exists) return;
        const divData = snap.data();
        const lastRound = divData.lastRaceRound;
        if (!lastRound) return;
        // Avoid re-fetching if already loaded for this round
        if (window._lastRaceResult && window._lastRaceResult._mpRound === lastRound) {
          return; // Already loaded, render below will pick it up
        }
        el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">Cargando resultado...</p></div>`;
        snap.ref.collection('raceResults').doc(String(lastRound)).get().then(rSnap => {
          if (!rSnap.exists) return;
          const r = rSnap.data();
          const myCars = (r.allCarsResults || []).filter(c => c.teamId === uid);
          window._lastRaceResult = { ...r, playerCars: myCars, _mpRound: lastRound, _viewerUid: uid };

          // Award I+D points for this MP race (once per round)
          const _mpState = GL_STATE.getState();
          const _lastAwarded = _mpState.car && _mpState.car.rnd && _mpState.car.rnd.lastAwardedRound;
          if (!_lastAwarded || _lastAwarded < lastRound) {
            const _mpBestPos = myCars.length > 0
              ? myCars.reduce((b, c) => Math.min(b, (c && Number.isFinite(c.position) ? c.position : 99)), 99)
              : 99;
            const _rndBase = _mpBestPos === 1 ? 10 : _mpBestPos === 2 ? 8 : _mpBestPos === 3 ? 6 : _mpBestPos <= 10 ? 3 : _mpBestPos <= 20 ? 1 : 0;
            const _rndLv = (_mpState.hq && _mpState.hq.rnd) ? Number(_mpState.hq.rnd) : 1;
            const _rndBonus = Math.max(0, _rndLv - 1);
            const _rndEarned = _rndBase > 0 ? _rndBase + _rndBonus : 0;
            if (!_mpState.car.rnd) _mpState.car.rnd = { points: 0, active: null, queue: [] };
            _mpState.car.rnd.lastAwardedRound = lastRound;
            if (_rndEarned > 0) {
              _mpState.car.rnd.points = (_mpState.car.rnd.points || 0) + _rndEarned;
              const _msg = _rndBonus > 0
                ? `🔬 +${_rndEarned} pts de I+D (P${_mpBestPos}, +${_rndBonus} bonus I+D Lv${_rndLv})`
                : `🔬 +${_rndEarned} pts de I+D (P${_mpBestPos})`;
              GL_STATE.addLog(_msg, 'good');
            }
            GL_STATE.saveState();
          }

          GL_SCREENS.renderPostRace();
        }).catch(() => {});
      }).catch(() => {});
      if (!window._lastRaceResult || !window._lastRaceResult._mpRound) {
        el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">Cargando resultado...</p></div>`;
        return;
      }
    }

    const result = window._lastRaceResult;
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
    const heroTeamResults = (playerCars.length ? playerCars : [leadCar])
      .slice(0, 2)
      .map((car) => {
        const driverName = car.pilotName || __('race_driver', 'Driver');
        const posText = car.isDNF ? 'DNF' : `P${car.position}`;
        const ptsText = `${Number(car.points || 0)} pts`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 10px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-surface-2)">
          <span style="font-size:0.78rem;color:var(--t-secondary)">${driverName}</span>
          <strong style="font-size:0.8rem;color:var(--t-primary)">${posText} · ${ptsText}</strong>
        </div>`;
      })
      .join('');
    const posColor = leadCar.position <= 1 ? 'var(--c-gold)' : leadCar.position <= 3 ? '#cd7c32' : leadCar.position <= 8 ? 'var(--c-green)' : 'var(--t-primary)';
    const state = GL_STATE.getState();
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
    const podiumCars = (Array.isArray(result.finalGrid) ? result.finalGrid : [])
      .slice(0, 3)
      .map((car, idx) => {
        const pos = idx + 1;
        const trophy = pos === 1 ? '🏆' : (pos === 2 ? '🥈' : '🥉');
        const tierClass = pos === 1 ? 'gold' : (pos === 2 ? 'silver' : 'bronze');
        const pts = Number(GL_DATA.POINTS_TABLE[idx] || 0);
        return { car, pos, trophy, tierClass, pts };
      });
    const podiumOrder = [2, 1, 3];
    const podiumHtml = podiumOrder
      .map((pos) => podiumCars.find((entry) => entry.pos === pos))
      .filter(Boolean)
      .map((entry) => {
        const carName = entry.car?.name || __('race_driver', 'Driver');
        return `<div class="postrace-podium-slot ${entry.tierClass} ${entry.car?.isPlayer ? 'my-team' : ''}">
          <div class="postrace-podium-trophy">${entry.trophy}</div>
          <div class="postrace-podium-pos">P${entry.pos}</div>
          <div class="postrace-podium-name">${entry.car?.isPlayer ? `<strong>${carName}</strong>` : carName}</div>
          <div class="postrace-podium-pts">${entry.pts} pts</div>
          <div class="postrace-podium-base"></div>
        </div>`;
      })
      .join('');
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
          <div class="post-race-title">${__('race_team_cars')}: ${teamResultSummary}</div>
            <div style="color:var(--t-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap">${result.circuit?.name} · ${__('postrace_weather')}: ${this.getWeatherLabel(result.weather)} ${teamResultHeadline}</div>
          <div style="display:grid;gap:6px;margin-top:10px">${heroTeamResults}</div>
          <div class="post-race-metrics">
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-gold)">${result.points}</div><div class="post-race-metric-label">${__('postrace_team_points')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${GL_UI.fmtCR(result.economySummary?.prizeDelta ?? result.prizeMoney)}</div><div class="post-race-metric-label">${__('postrace_prize')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:${(result.economySummary?.weeklyNetDelta || 0) >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${(result.economySummary?.weeklyNetDelta || 0) > 0 ? '+' : ''}${GL_UI.fmtCR(Math.abs(result.economySummary?.weeklyNetDelta || 0))}</div><div class="post-race-metric-label">${__('postrace_weekly_balance', 'Weekly balance')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:${(result.economySummary?.totalDelta || 0) >= 0 ? 'var(--c-green)' : 'var(--c-red)'}">${(result.economySummary?.totalDelta || 0) > 0 ? '+' : ''}${GL_UI.fmtCR(Math.abs(result.economySummary?.totalDelta || 0))}</div><div class="post-race-metric-label">${__('postrace_credit_delta', 'Total credit delta')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val">${GL_UI.fmtCR(result.economySummary?.creditsBefore || 0)}</div><div class="post-race-metric-label">${__('postrace_credits_before', 'Credits before')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val">${GL_UI.fmtCR(result.economySummary?.creditsAfterWeekly || 0)}</div><div class="post-race-metric-label">${__('postrace_credits_after', 'Credits after')}</div></div>
              <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${(result.economySummary?.fansGained || 0).toLocaleString()}</div><div class="post-race-metric-label">${__('postrace_fans_gained')}</div></div>
            <div class="post-race-metric"><div class="post-race-metric-val">${leadCar.improvement < 0 ? '▲'+Math.abs(leadCar.improvement) : leadCar.improvement > 0 ? '▼'+leadCar.improvement : '—'}</div><div class="post-race-metric-label">${__('postrace_vs_grid')}</div></div>
          </div>
        </div>
      </div>
      ${crashReviewHtml}
      <div class="card mb-4 postrace-podium-card">
        <div class="postrace-podium-title">🏁 ${__('postrace_class')}</div>
        <div class="postrace-podium-wrap">${podiumHtml || `<div style="color:var(--t-secondary)">No podium data</div>`}</div>
      </div>
      <div class="card mb-4 postrace-report-card">
        ${this.renderRaceComparisonTable(result)}
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
              <div class="race-pos-row ${car.isPlayer?'my-car':''} ${i===0?'podium-gold':(i===1?'podium-silver':(i===2?'podium-bronze':''))}">
                <span class="race-pos-num">${i+1}</span>
                <span class="race-pos-name">${i===0?'🏆 ':i===1?'🥈 ':i===2?'🥉 ':''}${car.isPlayer?'<strong style="color:var(--c-accent)">'+car.name+'</strong>':car.name}</span>
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
