// ===== DASHBOARD.JS – Main hub renderer =====
'use strict';

const DASHBOARD = {
  init() {
    this.refresh();
    this.startEventPoller();
  },

  refresh() {
    const state = GL_STATE.getState();
    if (!state) return;
    try {
      if (GL_ENGINE && typeof GL_ENGINE.checkFacilityTimers === 'function') {
        GL_ENGINE.checkFacilityTimers();
      } else if (GL_ENGINE && typeof GL_ENGINE.updateConstructionQueue === 'function') {
        GL_ENGINE.updateConstructionQueue();
      }
      this.renderSkeleton();
      this.renderNextEvent(state);
      this.renderStandings(state);
      this.renderFinances(state);
      this.renderUpgrades(state);
      this.renderPilotMorale(state);
      this.renderActivity(state);
      this.renderSponsors(state);
      this.renderAlerts(state);
      this.renderCampaign(state);
      this.renderRecommendations(state);
      this.updateTopbar(state);
      this.showSeasonSummaryIfPending(state);
      this.showFirstDashboardIntroIfPending(state);
    } catch (error) {
      console.error('Dashboard refresh failed', error);
      this.renderFallback(state);
    }
  },

  timeTravel(days) {
    if (!window.GL_ENGINE || typeof window.GL_ENGINE.shiftTimeByDays !== 'function') {
      GL_UI.toast(__('dash_time_travel_unavailable', 'Time travel is not available in this build.'), 'warning');
      return;
    }

    const d = Number(days) || 0;
    const simulated = window.GL_ENGINE.shiftTimeByDays(d);
    const sign = d > 0 ? '+' : '';
    GL_UI.toast(`Time travel ${sign}${d}d aplicado.`, 'info');
    const totalSimulated = (simulated && typeof simulated === 'object')
      ? (simulated.totalSimulated || 0)
      : Number(simulated || 0);
    if (totalSimulated > 0) {
      GL_UI.toast((__('dash_time_autosim_events', 'Auto-simulated: {count} event(s).')).replace('{count}', totalSimulated), 'good');
    }

    this.refresh();
  },

  formatDateTimeLocal(date) {
    const d = date instanceof Date ? date : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  getNextWeekdayAtHour(baseDate, weekday, hour) {
    const base = baseDate instanceof Date ? baseDate : new Date();
    const target = new Date(base);
    const deltaDays = (weekday - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + deltaDays);
    target.setHours(hour, 0, 0, 0);
    if (target <= base) target.setDate(target.getDate() + 7);
    return target;
  },

  setTimePreset(presetKey) {
    const input = document.getElementById('dash-time-target');
    if (!input) return;

    const now = (window.GL_ENGINE && typeof window.GL_ENGINE.getNowDate === 'function') ? window.GL_ENGINE.getNowDate() : new Date();
    let target = new Date(now);

    if (presetKey === 'next_wed_18') {
      target = this.getNextWeekdayAtHour(now, 3, 18);
    } else if (presetKey === 'next_sun_18') {
      target = this.getNextWeekdayAtHour(now, 0, 18);
    } else if (presetKey === 'next_week_start') {
      target = this.getNextWeekdayAtHour(now, 1, 0);
    }

    input.value = this.formatDateTimeLocal(target);
    GL_UI.toast((__('dash_time_preset_applied', 'Preset applied: {date}')).replace('{date}', target.toLocaleString('es-ES')), 'info');
  },

  applyExactTime() {
    const input = document.getElementById('dash-time-target');
    if (!input || !input.value) {
      GL_UI.toast(__('dash_time_target_select', 'Choose a target date and time.'), 'warning');
      return;
    }
    if (!window.GL_ENGINE || typeof window.GL_ENGINE.shiftTimeToMs !== 'function') {
      GL_UI.toast(__('dash_time_travel_exact_unavailable', 'Exact time travel is not available in this build.'), 'warning');
      return;
    }

    const targetMs = new Date(input.value).getTime();
    if (!Number.isFinite(targetMs)) {
      GL_UI.toast(__('dash_time_target_invalid', 'Invalid date/time.'), 'warning');
      return;
    }

    const state = GL_STATE.getState();
    const minAllowedMs = Number(state?.meta?.created || 0);
    if (Number.isFinite(minAllowedMs) && minAllowedMs > 0 && targetMs < minAllowedMs) {
      const minDate = new Date(minAllowedMs);
      GL_UI.toast((__('dash_time_before_start', 'You cannot travel before the save start ({date}).')).replace('{date}', minDate.toLocaleString('es-ES')), 'warning');
      return;
    }

    const currentMs = (typeof window.GL_ENGINE.getNowMs === 'function') ? window.GL_ENGINE.getNowMs() : Date.now();
    const deltaMs = targetMs - currentMs;
    const result = window.GL_ENGINE.shiftTimeToMs(targetMs);
    const deltaHours = Math.round(deltaMs / (60 * 60 * 1000));
    const signedHours = `${deltaHours > 0 ? '+' : ''}${deltaHours}`;
    GL_UI.toast((__('dash_time_adjusted', 'Time adjusted ({deltaHours}h).')).replace('{deltaHours}', signedHours), 'info');
    if ((result?.simulatedRaces || 0) > 0) {
      GL_UI.toast((__('dash_time_autosim_races', 'Auto-simulated: {count} race(s).')).replace('{count}', result.simulatedRaces), 'good');
    }

    this.refresh();
  },

  renderFallback(state) {
    const el = document.getElementById('screen-dashboard');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('dash_title')}</div>
          <div class="screen-title">${__('dash_fallback_title')}</div>
          <div class="screen-subtitle">${__('dash_fallback_desc')}</div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="card">
          <div class="section-title" style="margin-bottom:12px">${__('dash_next_event')}</div>
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_APP.navigateTo('calendar')">${__('dash_full_calendar')}</button>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:12px">${__('nav_standings')}</div>
          <button class="btn btn-secondary w-full" style="justify-content:center" onclick="GL_APP.navigateTo('standings')">${__('dash_full_table')}</button>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:12px">${__('nav_finances')}</div>
          <button class="btn btn-ghost w-full" style="justify-content:center" onclick="GL_APP.navigateTo('finances')">${__('dash_finances_details')}</button>
        </div>
      </div>`;
    this.updateTopbar(state);
  },

  showFirstDashboardIntroIfPending(state) {
    if (!state?.meta?.firstDashboardIntroPending) return;
    state.meta.firstDashboardIntroPending = false;
    GL_STATE.saveState();
    setTimeout(() => {
      GL_UI.openModal({
        title: __('dash_intro_title'),
        content: `
          <p style="color:var(--t-secondary);margin-bottom:14px">${__('dash_intro_desc')}</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
            <div class="fin-item"><span>🏁</span><strong>${__('dash_intro_point_event')}</strong></div>
            <div class="fin-item"><span>💰</span><strong>${__('dash_intro_point_finances')}</strong></div>
            <div class="fin-item"><span>🎯</span><strong>${__('dash_intro_point_objective')}</strong></div>
          </div>
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_UI.closeTopModal()">${__('continue')}</button>
        `
      });
    }, 250);
  },

  openLatestSeasonSummary() {
    const state = GL_STATE.getState();
    const summary = state?.season?.lastSummary;
    if (!summary) {
      GL_UI.toast(__('season_summary_none'), 'info');
      return;
    }
    this.openSeasonSummaryModal(summary);
  },

  openSeasonSummaryHistory(index) {
    const state = GL_STATE.getState();
    const history = Array.isArray(state?.seasonHistory) ? state.seasonHistory : [];
    const parsedIndex = Number(index);
    const summary = Number.isInteger(parsedIndex) ? history[parsedIndex] : null;
    if (!summary) {
      GL_UI.toast(__('season_summary_none'), 'info');
      return;
    }
    this.openSeasonSummaryModal(summary);
  },

  openSeasonSummaryModal(summary) {
    if (!summary) return;

    const resultKey = summary.result === 'promoted'
      ? 'season_summary_transition_promoted'
      : (summary.result === 'relegated' ? 'season_summary_transition_relegated' : 'season_summary_transition_stayed');

    const campaign = summary.campaign || null;
    const campaignRow = campaign
      ? `<div class="fin-item"><span>${__('season_summary_campaign')}</span><strong>${campaign.completed ? __('season_summary_campaign_completed') : __('season_summary_campaign_failed')}</strong></div>
         <div class="fin-item"><span>${__('season_summary_campaign_objective')}</span><strong>${__(campaign.titleKey || '') || '-'}</strong></div>
         ${campaign.rewardCredits > 0 ? `<div class="fin-item"><span>${__('season_summary_campaign_reward')}</span><strong>+${GL_UI.fmtCR(campaign.rewardCredits)}</strong></div>` : ''}`
      : '';

    GL_UI.openModal({
      title: __('season_summary_title'),
      content: `
        <p style="color:var(--t-secondary);margin-bottom:12px">${__('season_summary_subtitle')} ${summary.year}</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <div class="fin-item"><span>${__('season_summary_finish')}</span><strong>P${summary.finishPosition || '-'}</strong></div>
          <div class="fin-item"><span>${__('season_summary_points')}</span><strong>${summary.points || 0}</strong></div>
          <div class="fin-item"><span>${__('season_summary_wins')}</span><strong>${summary.wins || 0}</strong></div>
          <div class="fin-item"><span>${__('season_summary_division')}</span><strong>${summary.division || '-'} → ${summary.nextDivision || '-'}</strong></div>
          <div class="fin-item"><span>${__('season_summary_transition')}</span><strong>${__(resultKey)}</strong></div>
          <div class="fin-item"><span>${__('season_summary_bonus')}</span><strong>+${GL_UI.fmtCR(summary.bonusCredits || 0)}</strong></div>
          ${campaignRow}
        </div>
        <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_UI.closeTopModal()">${__('continue')}</button>
      `
    });
  },

  showSeasonSummaryIfPending(state) {
    const summary = state?.season?.lastSummary;
    if (!summary || !state?.season?.lastSummaryPending) return;

    state.season.lastSummaryPending = false;
    GL_STATE.saveState();

    setTimeout(() => {
      this.openSeasonSummaryModal(summary);
    }, 250);
  },

  renderSkeleton() {
    const el = document.getElementById('screen-dashboard');
    if (!el) return;
    const state = GL_STATE.getState();
    const now = (window.GL_ENGINE && typeof window.GL_ENGINE.getNowDate === 'function') ? window.GL_ENGINE.getNowDate() : new Date();
    const targetDefault = this.formatDateTimeLocal(now);
    const minAllowedMs = Number(state?.meta?.created || 0);
    const minAllowedValue = (Number.isFinite(minAllowedMs) && minAllowedMs > 0)
      ? this.formatDateTimeLocal(new Date(minAllowedMs))
      : '';
    // Only render skeleton if it's empty to avoid completely destroying DOM on every tick (prevents scroll jumping)
    // Actually, simple rendering is fine for now, but let's just do it
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('garage_eyebrow')}</div>
          <div class="screen-title">${__('dash_title')}</div>
          <div id="dash-week-subtitle" class="screen-subtitle">${__('dash_subtitle')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-primary" onclick="GL_APP.navigateTo('prerace')">${__('dash_race_prep')}</button>
          <input id="dash-time-target" type="datetime-local" value="${targetDefault}" min="${minAllowedValue}" style="min-width:210px;padding:8px 10px;border:1px solid var(--c-border);background:var(--c-surface-2);color:var(--t-primary);border-radius:8px;font-size:0.78rem">
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.setTimePreset('next_wed_18')">${__('dash_preset_next_wed', 'Next Wed 18:00')}</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.setTimePreset('next_sun_18')">${__('dash_preset_next_sun', 'Next Sun 18:00')}</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.setTimePreset('next_week_start')">${__('dash_preset_next_week', 'Start next week')}</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.applyExactTime()">${__('dash_preset_exact', 'Go to date/time')}</button>
        </div>
      </div>
      <div class="dashboard-grid stagger">
        <div style="grid-column:1/4;display:grid;grid-template-columns:1fr 280px;gap:var(--s-4);align-items:start">
          <div>
            <div class="section-header">
              <span class="section-title">${__('dash_standings')}</span>
              <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('standings')">${__('dash_full_table')}</button>
            </div>
            <div class="card" id="dash-standings"></div>
          </div>
          <div id="dash-circuit-preview"></div>
        </div>
        <div class="right-panel">
          <div class="card">
            <div class="section-eyebrow">${__('dash_alerts_label')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('dash_alerts_title')}</div>
            <div id="dash-alerts"></div>
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('dash_campaign_label')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('dash_campaign_title')}</div>
            <div id="dash-campaign"></div>
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('dash_recs_label')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('dash_recs_actions')}</div>
            <div id="dash-recs"></div>
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('dash_activity_label')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('dash_activity_recent')}</div>
            <div id="dash-activity"></div>
          </div>
        </div>
        <div>
          <div class="section-header">
            <span class="section-title">${__('dash_finances_label')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('finances')">${__('dash_finances_details')}</button>
          </div>
          <div class="card" id="dash-finances"></div>
        </div>
        <div>
          <div class="section-header">
            <span class="section-title">${__('dash_upgrades_label')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('garage')">${__('dash_upgrades_garage')}</button>
          </div>
          <div class="card" id="dash-upgrades"></div>
        </div>
        <div>
          <div class="section-header">
            <span class="section-title">${__('dash_morale_label')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('pilots')">${__('dash_morale_roster')}</button>
          </div>
          <div class="card" id="dash-morale"></div>
        </div>
        <div>
          <div class="section-header">
            <span class="section-title">${__('dash_sponsors_label')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('market')">${__('dash_sponsors_market')}</button>
          </div>
          <div class="card" style="display:flex;flex-direction:column;gap:var(--s-2)" id="dash-sponsors"></div>
        </div>
      </div>`;
  },

  updateTopbar(state) {
    const el = id => document.getElementById(id);
    if (el('topbar-team-name')) el('topbar-team-name').textContent = state.team.name || 'Your Team';
    if (el('topbar-credits-val')) el('topbar-credits-val').textContent = GL_UI.fmtCR(state.finances.credits||0);
    if (el('topbar-fans-val')) el('topbar-fans-val').textContent = GL_UI.fmtCR(state.team.fans||0);
    if (el('topbar-tokens-val')) el('topbar-tokens-val').textContent = state.finances.tokens||0;
    if (el('topbar-logo')) {
      el('topbar-logo').style.background = `linear-gradient(135deg,${state.team.colors.primary},${state.team.colors.primary}88)`;
      el('topbar-logo').textContent = state.team.logo||'🏎️';
    }
    if (el('topbar-avatar')) el('topbar-avatar').textContent = (state.team.name||'U')[0].toUpperCase();
    if (el('topbar-season')) el('topbar-season').textContent = `${__('topbar_season')} ${state.season.year} · ${__('topbar_div')} ${state.season.division}`;
    if (el('sidebar-team-logo')) { el('sidebar-team-logo').textContent = state.team.logo||'🏎️'; el('sidebar-team-logo').style.background = state.team.colors.primary+'22'; }
    if (el('sidebar-team-name')) el('sidebar-team-name').textContent = state.team.name||'Your Team';
    if (el('sidebar-team-div')) el('sidebar-team-div').textContent = `${__('division')} ${state.season.division}`;
  },

  renderNextEvent(state) {
    const el = document.getElementById('dash-next-event');
    if (!el) return;
    if (GL_ENGINE && typeof GL_ENGINE.ensureNextRaceAvailable === 'function') {
      GL_ENGINE.ensureNextRaceAvailable();
    }
    const cal = state.season.calendar || [];
    const next = cal.find(r => r.status === 'next');
    if (!next) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('no_race_complete')}</p></div>`; return; }
    const c = next.circuit;
    
    const nextRaceObj = GL_ENGINE.getNextRaceDate();
    const typeLabel = nextRaceObj.type === 'practice' ? window.__('next_practice_lbl', 'PRÁCTICA') : window.__('next_race_lbl', 'CARRERA');

    el.innerHTML = `
      <div class="next-event-card">
        <div class="next-event-header">
          <div class="next-event-label">⚡ ${typeLabel} · ${window.__('round') || 'Ronda'} ${next.round}</div>
          <div class="next-event-name">${c.name}</div>
          <div class="next-event-meta">${c.country} · ${c.laps} ${__('laps')} · ${c.length} · ${next.weather === 'wet' ? __('prerace_rain_expected') : __('prerace_dry2')}</div>
        </div>
        <div class="next-event-body">
          <div class="circuit-mini">
            <svg viewBox="0 0 200 80" class="circuit-svg">${this.circuitSVG(c.layout)}</svg>
          </div>
          <div style="display:flex;gap:var(--s-3)">
            <button class="btn btn-primary flex-1" onclick="GL_APP.navigateTo('prerace')">${window.__('dash_race_prep') || 'Preparar Estrategia'}</button>
            <button class="btn btn-secondary" onclick="GL_APP.navigateTo('calendar')">📅 ${__('nav_calendar')}</button>
          </div>
        </div>
      </div>`;
  },

  circuitSVG(layout) {
    const layouts = {
      'high-speed':  `<ellipse cx="100" cy="40" rx="85" ry="30" fill="none" stroke="rgba(232,41,42,0.5)" stroke-width="6" stroke-dasharray="4,2"/>
                      <rect x="80" y="20" width="40" height="2" fill="var(--c-accent)" rx="1"/>`,
      'technical':   `<path d="M20,60 Q40,20 80,30 Q120,40 140,20 Q160,10 180,40 Q190,60 160,65 Q120,70 80,65 Q40,70 20,60" fill="none" stroke="rgba(232,41,42,0.5)" stroke-width="6"/>`,
      'power':       `<path d="M30,40 L90,15 L170,15 L170,65 L90,65 L90,40 L30,40" fill="none" stroke="rgba(232,41,42,0.5)" stroke-width="6" stroke-linejoin="round"/>`,
      'mixed':       `<path d="M20,55 Q30,25 60,30 L100,30 Q130,30 140,50 Q150,70 130,65 L80,65 Q50,65 40,55" fill="none" stroke="rgba(232,41,42,0.5)" stroke-width="6"/>`,
      'endurance':   `<path d="M100,10 Q160,10 175,40 Q190,70 150,72 Q110,74 80,65 Q30,55 25,40 Q20,10 100,10" fill="none" stroke="rgba(232,41,42,0.5)" stroke-width="5"/>`
    };
    return layouts[layout] || layouts['mixed'];
  },

  renderStandings(state) {
    const el = document.getElementById('dash-standings');
    if (!el) return;
    const standings = state.standings || [];
    const divInfo = GL_DATA && GL_DATA.DIVISIONS ? (GL_DATA.DIVISIONS.find(d => d.div == state.season.division) || {}) : {};
    const divName = divInfo.name || `${__('division')} ${state.season.division}`;
    const myStanding = GL_STATE.getMyStanding();
    const promotionSpots = divInfo.promotions || 0;
    const myPos = myStanding.position || '-';
    const myPts = myStanding.points || 0;
    const inPromoZone = typeof myPos === 'number' && promotionSpots > 0 && myPos <= promotionSpots;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--c-border)">
        <div>
          <div style="font-size:0.58rem;font-weight:700;letter-spacing:0.1em;color:var(--t-tertiary);text-transform:uppercase;margin-bottom:2px">${__('division')} ${state.season.division} · ${divName}</div>
        </div>
        <div style="text-align:right">
          <span style="font-size:1.3rem;font-weight:800;color:var(--c-gold)">P${myPos}</span>
          <span style="font-size:0.72rem;color:${inPromoZone?'var(--c-green)':'var(--t-secondary)'};margin-left:6px">${myPts} ${__('points')}${inPromoZone?' · ✔':''}</span>
        </div>
      </div>
      ${standings.map(s => `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--c-border);font-size:0.78rem ${s.id==='player'?';background:var(--c-surface-2);border-radius:4px;padding:3px 6px':''} ">
        <span style="width:18px;text-align:right;font-weight:700;color:${s.id==='player'?'var(--c-gold)':'var(--t-tertiary)'}">${s.position}</span>
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color||'#888'};flex-shrink:0;display:inline-block"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${s.id==='player'?'var(--t-primary)':'var(--t-secondary)'}">${s.name}</span>
        <span style="font-weight:${s.id==='player'?'700':'400'};color:${s.id==='player'?'var(--c-gold)':'var(--t-tertiary)'}">${s.points}</span>
      </div>`).join('')}`;

    // Circuit preview panel
    const previewEl = document.getElementById('dash-circuit-preview');
    if (!previewEl) return;
    if (GL_ENGINE && typeof GL_ENGINE.ensureNextRaceAvailable === 'function') GL_ENGINE.ensureNextRaceAvailable();
    const cal = state.season.calendar || [];
    const next = cal.find(r => r.status === 'next');
    if (!next) { previewEl.innerHTML = ''; return; }
    const c = next.circuit;
    const hasStrategy = !!next.savedStrategy;
    previewEl.innerHTML = `
      <div class="section-header">
        <span class="section-title">${__('dash_next_event')}</span>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:var(--s-3)">
        <div style="font-size:0.6rem;font-weight:700;letter-spacing:0.1em;color:var(--t-tertiary);text-transform:uppercase">${__('round')} ${next.round}</div>
        <div style="font-size:1rem;font-weight:700;color:var(--t-primary)">${c.name}</div>
        <div style="font-size:0.75rem;color:var(--t-secondary)">${c.country} · ${c.laps} ${__('laps')} · ${c.length}</div>
        <div style="font-size:0.75rem;color:var(--t-secondary)">${next.weather === 'wet' ? __('prerace_rain_expected') : __('prerace_dry2')}</div>
        <svg viewBox="0 0 200 80" style="width:100%;opacity:0.7">${this.circuitSVG(c.layout)}</svg>
        ${hasStrategy ? `<div style="font-size:0.72rem;color:var(--c-green)">✔ ${__('prerace_strat_saved_badge') || 'Estrategia guardada'}</div>` : ''}
        <button class="btn btn-primary btn-sm w-full" style="justify-content:center" onclick="GL_APP.navigateTo('prerace')">${__('dash_race_prep')}</button>
      </div>`;
  },

  renderFinances(state) {
    const el = document.getElementById('dash-finances');
    if (!el) return;
    const financeOverview = window.getFinanceOverview
      ? window.getFinanceOverview(state)
      : {
          breakdown: window.getWeeklyEconomyBreakdown ? window.getWeeklyEconomyBreakdown(state) : { income: 0, salaries: 0, hqCost: 0, contractCost: 0, net: 0 },
          operatingNet: 0,
          competitionNet: 0,
          totalNet: 0,
          closingCash: Number(state?.finances?.credits || 0),
          deficitStreak: Number(state?.finances?.deficitStreak || 0),
          isCritical: !!state?.finances?.criticalDeficit,
          isWarning: !state?.finances?.criticalDeficit && Number(state?.finances?.deficitStreak || 0) > 0,
          reasonKey: 'finances_health_reason_positive_total'
        };
    const breakdown = financeOverview.breakdown;
    const statusLabel = financeOverview.isCritical
      ? __('dash_finance_critical_state')
      : (financeOverview.isWarning ? __('dash_finance_warning_state') : __('dash_finance_healthy_state'));
    const statusClass = financeOverview.isCritical ? 'negative' : (financeOverview.isWarning ? '' : 'positive');
    el.innerHTML = `
      <div class="finance-row"><span class="finance-row-label">${__('eco_income')}</span><span class="finance-row-val positive">+${GL_UI.fmtCR(breakdown.income)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('eco_salaries')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(breakdown.salaries)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('eco_hq')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(breakdown.hqCost)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('eco_contracts')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(breakdown.contractCost)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_operating_flow')}</span><span class="finance-row-val ${financeOverview.operatingNet>=0?'positive':'negative'}">${GL_UI.fmtSign(financeOverview.operatingNet)}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_competition_flow')}</span><span class="finance-row-val ${financeOverview.competitionNet>=0?'positive':'negative'}">${GL_UI.fmtSign(financeOverview.competitionNet)}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_health_label')}</span><span class="finance-row-val ${statusClass}">${statusLabel}</span></div>
      <div class="finance-row" style="border-top:2px solid var(--c-border-hi)">
        <span class="finance-row-label" style="font-weight:700;color:var(--t-primary)">${__('finances_total_flow')}</span>
        <span class="finance-row-val ${financeOverview.totalNet>=0?'positive':'negative'}" style="font-size:1rem">${GL_UI.fmtSign(financeOverview.totalNet)}</span>
      </div>`;
  },

  renderUpgrades(state) {
    const el = document.getElementById('dash-upgrades');
    if (!el) return;
    const active = (state.facilities||[]).filter(f => f.upgrading);
    if (!active.length) {
      el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem;text-align:center;padding:var(--s-4) 0">${__('dash_no_upgrades')}</p>`;
      return;
    }
    el.innerHTML = active.map(f => {
      const def = GL_DATA.FACILITIES.find(d=>d.id===f.id);
      const weeksLeft = (f.completeWeek - state.season.week);
      const def2 = def?.levels[f.level];
      const totalWeeks = def2?.buildTime || 4;
      const pct = Math.min(100, Math.max(0, ((totalWeeks - weeksLeft) / totalWeeks) * 100));
      return `<div class="upgrade-item">
        <div class="upgrade-item-icon">${def?.icon||'🏗️'}</div>
        <div class="upgrade-item-info">
          <div class="upgrade-item-name">${def?.name||f.id} → Lv${f.level+1}</div>
          <div class="upgrade-item-time">${weeksLeft > 0 ? weeksLeft + ' ' + __('weeks_remaining') : __('completing_next')}</div>
          <div class="upgrade-item-progress">${GL_UI.progressBar(pct, 100, 'gold')}</div>
        </div>
      </div>`;
    }).join('');
  },

  renderPilotMorale(state) {
    const el = document.getElementById('dash-morale');
    if (!el) return;
    const pilots = state.pilots || [];
    if (!pilots.length) { el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_no_pilots')}</p>`; return; }
    el.innerHTML = pilots.map(p => {
      const m = p.morale || 75;
      const mColor = m > 70 ? 'var(--c-green)' : m > 40 ? 'var(--c-gold)' : 'var(--c-red)';
      const overall = GL_ENGINE.pilotScore(p);
      return `<div class="morale-pill">
        <div class="morale-avatar" style="background:${state.team.colors.primary}33;color:${state.team.colors.primary}">${p.emoji||'🧑'}</div>
        <div class="morale-info">
          <div class="morale-name">${p.name}</div>
          <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('overall')} ${overall} · ${__('dash_contract')} ${p.contractWeeks||20}${__('per_week').replace('/','')}.</div>
        </div>
        <div class="morale-bar-wrap">${GL_UI.progressBar(m,100,'green')}</div>
        <div class="morale-val" style="color:${mColor}">${m}</div>
      </div>`;
    }).join('');
  },

  renderActivity(state) {
    const el = document.getElementById('dash-activity');
    if (!el) return;
    const log = state.log || [];
    if (!log.length) { el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_no_activity')}</p>`; return; }
    const typeColor = { good:'var(--c-green)', bad:'var(--c-red)', info:'var(--c-blue)', warning:'var(--c-gold)' };
    el.innerHTML = log.slice(0,8).map(l => `
      <div class="activity-item">
        <div class="activity-dot" style="background:${typeColor[l.type]||'var(--c-border-hi)'}"></div>
        <div>
          <div class="activity-text">${l.text}</div>
          <div class="activity-time">${__('topbar_week')} ${l.week}</div>
        </div>
      </div>`).join('');
  },

  renderSponsors(state) {
    const el = document.getElementById('dash-sponsors');
    if (!el) return;
    const sponsors = state.sponsors || [];
    if (!sponsors.length) { el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_no_sponsors')}</p>`; return; }
    el.innerHTML = sponsors.map(s => GL_UI.sponsorChipHTML(s)).join('');
  },

  getCampaignProgressText(state, objective) {
    if (!objective) return __('dash_campaign_no_objective');
    const lastSummary = state?.season?.lastSummary || {};
    const finish = Number(lastSummary?.finishPosition) || '-';
    const division = Number(state?.season?.division) || 8;
    const deficitStreak = Number(state?.finances?.deficitStreak) || 0;

    if (objective.id === 'phase1_survive_prove') {
      return `${__('dash_campaign_progress_finish')}: P${finish} · ${__('dash_campaign_progress_deficit')}: ${deficitStreak}`;
    }
    if (objective.id === 'phase2_climb') {
      return `${__('dash_campaign_progress_division')}: ${division} (<= 5)`;
    }
    if (objective.id === 'phase3_dynasty') {
      return `${__('dash_campaign_progress_division')}: ${division} · ${__('dash_campaign_progress_finish')}: P${finish}`;
    }
    return __('dash_campaign_no_objective');
  },

  renderCampaign(state) {
    const el = document.getElementById('dash-campaign');
    if (!el) return;

    const campaign = GL_ENGINE.getCampaignStatus ? GL_ENGINE.getCampaignStatus() : null;
    const objective = campaign?.objective;
    if (!objective) {
      el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_campaign_no_objective')}</p>`;
      return;
    }

    const phaseLabel = objective.phase === 'phase1'
      ? __('dash_campaign_phase1')
      : (objective.phase === 'phase2' ? __('dash_campaign_phase2') : __('dash_campaign_phase3'));
    const progressText = this.getCampaignProgressText(state, objective);

    el.innerHTML = `
      <div style="font-size:0.72rem;color:var(--t-secondary);margin-bottom:6px">${__('dash_campaign_phase_label')}: <strong>${phaseLabel}</strong></div>
      <div style="font-size:0.76rem;color:var(--t-primary);font-weight:700;margin-bottom:4px">${__(objective.titleKey)}</div>
      <div style="font-size:0.72rem;color:var(--t-secondary);margin-bottom:6px">${__(objective.descKey)}</div>
      <div style="font-size:0.7rem;color:var(--t-tertiary);margin-bottom:6px">${progressText}</div>
      <div style="font-size:0.72rem;color:var(--c-gold)">${__('dash_campaign_reward')}: <strong>+${GL_UI.fmtCR(objective.rewardCredits || 0)} CR</strong></div>
    `;
  },

  renderAlerts(state) {
    const el = document.getElementById('dash-alerts');
    if (!el) return;
    const alerts = [];
    if (state.finances.credits < 20000) alerts.push({ type:'danger', icon:'⚠️', text: __('dash_low_budget') });
    const financeOverview = window.getFinanceOverview ? window.getFinanceOverview(state) : null;
    const breakdown = financeOverview?.breakdown || (window.getWeeklyEconomyBreakdown ? window.getWeeklyEconomyBreakdown(state) : { net: 0 });
    if (breakdown.net < 0) alerts.push({ type:'warning', icon:'💸', text: __('dash_losing_money') });
    if ((financeOverview?.deficitStreak || state.finances?.deficitStreak || 0) > 0) {
      const alertType = financeOverview?.isCritical ? 'danger' : 'warning';
      const alertIcon = financeOverview?.isCritical ? '🚨' : '📉';
      alerts.push({
        type: alertType,
        icon: alertIcon,
        text: `${__('dash_finance_deficit_streak_label')}: <strong>${financeOverview?.deficitStreak || state.finances.deficitStreak}</strong> ${__('dash_finance_deficit_streak_weeks')} · ${__(financeOverview?.reasonKey || 'finances_health_reason_negative_total')}`
      });
    }
    const injuredPilot = (state.pilots||[]).find(p=>p.injured);
    if (injuredPilot) alerts.push({ type:'danger', icon:'🤕', text: `<strong>${injuredPilot.name}</strong> ${__('dash_pilot_injured')}` });
    if (!alerts.length) { el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_no_critical')}</p>`; return; }
    el.innerHTML = alerts.map(a => `<div class="alert-item ${a.type}"><span class="alert-item-icon">${a.icon}</span><span class="alert-item-text">${a.text}</span></div>`).join('');
  },

  getAdvisorModeSuggestion(state) {
    const telemetry = GL_ENGINE.getAdvisorTelemetry ? GL_ENGINE.getAdvisorTelemetry(state) : null;
    if (!telemetry || !telemetry.byMode) return null;

    const activeMode = (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced';
    const cooldown = this.getAdvisorSuggestionCooldownInfo(state);
    if (cooldown.active) return null;
    const active = telemetry.byMode[activeMode];
    const modes = ['conservative', 'balanced', 'aggressive']
      .map((mode) => {
        const trend = this.getAdvisorRecentTrend(state, mode);
        const recentAvg = trend.samples.length
          ? trend.samples.reduce((sum, val) => sum + val, 0) / trend.samples.length
          : null;
        const avgPoints = (telemetry.byMode[mode] || {}).avgPoints || 0;
        const score = recentAvg === null ? avgPoints : ((avgPoints * 0.7) + (recentAvg * 0.3));
        return { mode, ...(telemetry.byMode[mode] || {}), recentAvg, score };
      })
      .filter(m => (m.races || 0) >= 3);
    if (!modes.length || !active || (active.races || 0) < 3) return null;

    // Check adoption-rate-based suggestion first (higher priority)
    const sStats = (state.advisor?.telemetry?.suggestion?.stats) || {};
    const byMode = sStats.byMode || {
      conservative: { shown: 0, applied: 0, ignored: 0 },
      balanced: { shown: 0, applied: 0, ignored: 0 },
      aggressive: { shown: 0, applied: 0, ignored: 0 }
    };
    
    const adoptionRates = {};
    const activeAdoption = byMode[activeMode]?.shown > 0 
      ? Math.round((byMode[activeMode].applied / byMode[activeMode].shown) * 100)
      : 0;
    modes.forEach(m => {
      if (byMode[m.mode]?.shown >= 3) {
        adoptionRates[m.mode] = Math.round((byMode[m.mode].applied / byMode[m.mode].shown) * 100);
      }
    });

    const bestAdoptionMode = Object.entries(adoptionRates)
      .sort(([,a], [,b]) => b - a)[0];
    if (bestAdoptionMode && bestAdoptionMode[1] >= 70 && activeAdoption < 65) {
      return {
        mode: bestAdoptionMode[0],
        activeMode,
        reason: 'adoption',
        adoptionRate: bestAdoptionMode[1],
        adoptionDelta: bestAdoptionMode[1] - activeAdoption
      };
    }

    const activeTrend = this.getAdvisorRecentTrend(state, activeMode);
    const activeRecentAvg = activeTrend.samples.length
      ? activeTrend.samples.reduce((sum, val) => sum + val, 0) / activeTrend.samples.length
      : null;
    const activeScore = activeRecentAvg === null
      ? (active.avgPoints || 0)
      : (((active.avgPoints || 0) * 0.7) + (activeRecentAvg * 0.3));

    const best = modes.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (!best || best.mode === activeMode) return null;

    const deltaPts = (best.avgPoints || 0) - (active.avgPoints || 0);
    const deltaScore = (best.score || 0) - activeScore;
    const deltaRecent = ((best.recentAvg || 0) - (activeRecentAvg || 0));
    const deltaPodium = (best.podiumRate || 0) - (active.podiumRate || 0);
    const policy = (state.advisor && state.advisor.telemetry && state.advisor.telemetry.suggestion && state.advisor.telemetry.suggestion.policy)
      ? state.advisor.telemetry.suggestion.policy
      : {};
    const deltaScoreMin = typeof policy.deltaScoreMin === 'number' ? policy.deltaScoreMin : 1.1;
    const deltaRecentMin = typeof policy.deltaRecentMin === 'number' ? policy.deltaRecentMin : 1.4;
    const deltaPodiumMin = typeof policy.deltaPodiumMin === 'number' ? policy.deltaPodiumMin : 5;
    if (deltaScore < deltaScoreMin && deltaRecent < deltaRecentMin && deltaPodium < deltaPodiumMin) return null;

    return {
      mode: best.mode,
      activeMode,
      reason: 'performance',
      deltaPts: Math.round(deltaPts * 100) / 100,
      deltaScore: Math.round(deltaScore * 100) / 100,
      deltaRecent: Math.round(deltaRecent * 100) / 100,
      deltaPodium: Math.round(deltaPodium)
    };
  },

  applyAdvisorMode(mode) {
    const state = GL_STATE.getState();
    if (!state.advisor) state.advisor = { mode: 'balanced', recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
    const suggestionMeta = this.ensureAdvisorSuggestionMeta(state);
    const sStats = suggestionMeta.stats;
    const maxHistory = 40;
    const byMode = sStats.byMode || {
      conservative: { shown: 0, applied: 0, ignored: 0 },
      balanced: { shown: 0, applied: 0, ignored: 0 },
      aggressive: { shown: 0, applied: 0, ignored: 0 }
    };
    if (sStats.pending && sStats.pendingMode === mode) {
      sStats.applied += 1;
      if (byMode[mode]) byMode[mode].applied += 1;
      if (!Array.isArray(sStats.history)) sStats.history = [];
      sStats.history.push({
        action: 'applied',
        mode,
        weekIndex: this.getCurrentWeekIndex(state),
        reason: (sStats.pendingReason || 'performance')
      });
      if (sStats.history.length > maxHistory) sStats.history = sStats.history.slice(-maxHistory);
      sStats.pending = false;
    } else if (sStats.pending && sStats.pendingMode !== mode) {
      sStats.ignored += 1;
      if (byMode[sStats.pendingMode]) byMode[sStats.pendingMode].ignored += 1;
      if (!Array.isArray(sStats.history)) sStats.history = [];
      sStats.history.push({
        action: 'ignored',
        mode: sStats.pendingMode,
        weekIndex: this.getCurrentWeekIndex(state),
        reason: (sStats.pendingReason || 'performance'),
        ignoreReason: 'override'
      });
      if (sStats.history.length > maxHistory) sStats.history = sStats.history.slice(-maxHistory);
      sStats.pending = false;
    }
    sStats.byMode = byMode;
    state.advisor.mode = mode;
    suggestionMeta.lastAppliedWeekIndex = this.getCurrentWeekIndex(state);
    suggestionMeta.lastAppliedMode = mode;
    GL_STATE.saveState();
    GL_UI.toast((__('dash_advisor_mode_set') || 'Advisor mode set to') + ` ${mode}.`, 'info');
    this.refresh();
  },

  applyAdvisorSuggestionTuning(actionType) {
    const state = GL_STATE.getState();
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const defaultPolicy = { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 };
    const policyLock = this.getAdvisorPolicyLockInfo(state);
    if (!policyLock.allowed) {
      GL_UI.toast(`${__('dash_advisor_policy_lock_blocked')} ${policyLock.weeksLeft} ${__('dash_advisor_weeks_left')}.`, 'warning');
      return;
    }
    if (!meta.policy) {
      meta.policy = { ...defaultPolicy };
    }

    if (actionType === 'increase_cooldown') {
      meta.cooldownWeeks = Math.min(4, Math.max(1, (meta.cooldownWeeks || 2) + 1));
      meta.policyProfile = 'custom';
      meta.lastPolicyChangeWeekIndex = this.getCurrentWeekIndex(state);
      this.recordAdvisorPolicyChange(state, 'increase_cooldown');
      GL_STATE.saveState();
      GL_UI.toast(__('dash_advisor_tune_cooldown_applied'), 'info');
      this.refresh();
      return;
    }

    if (actionType === 'tighten_thresholds') {
      meta.policy.deltaScoreMin = Math.min(2.2, (meta.policy.deltaScoreMin || 1.1) + 0.2);
      meta.policy.deltaRecentMin = Math.min(3.0, (meta.policy.deltaRecentMin || 1.4) + 0.3);
      meta.policy.deltaPodiumMin = Math.min(10, (meta.policy.deltaPodiumMin || 5) + 1);
      meta.policyProfile = 'custom';
      meta.lastPolicyChangeWeekIndex = this.getCurrentWeekIndex(state);
      this.recordAdvisorPolicyChange(state, 'tighten_thresholds');
      GL_STATE.saveState();
      GL_UI.toast(__('dash_advisor_tune_thresholds_applied'), 'info');
      this.refresh();
      return;
    }

    if (actionType === 'reset_policy') {
      meta.cooldownWeeks = 2;
      meta.policy = { ...defaultPolicy };
      meta.policyProfile = 'balanced';
      meta.lastPolicyChangeWeekIndex = this.getCurrentWeekIndex(state);
      this.recordAdvisorPolicyChange(state, 'reset_policy');
      GL_STATE.saveState();
      GL_UI.toast(__('dash_advisor_tune_reset_applied'), 'info');
      this.refresh();
    }
  },

  recordAdvisorPolicyChange(state, actionType) {
    const meta = this.ensureAdvisorSuggestionMeta(state);
    if (!Array.isArray(meta.policyHistory)) meta.policyHistory = [];
    meta.policyHistory.push({
      ts: Date.now(),
      year: (state?.season?.year) || 1,
      week: (state?.season?.week) || 1,
      action: actionType,
      profile: meta.policyProfile || 'balanced',
      cooldownWeeks: meta.cooldownWeeks || 2,
      policy: {
        deltaScoreMin: Number((meta.policy?.deltaScoreMin ?? 1.1).toFixed(1)),
        deltaRecentMin: Number((meta.policy?.deltaRecentMin ?? 1.4).toFixed(1)),
        deltaPodiumMin: Number((meta.policy?.deltaPodiumMin ?? 5).toFixed(1))
      }
    });
    if (meta.policyHistory.length > 20) meta.policyHistory = meta.policyHistory.slice(-20);
  },

  getAdvisorPolicyActionLabel(actionType) {
    if (actionType === 'increase_cooldown') return __('dash_advisor_policy_action_increase_cooldown');
    if (actionType === 'tighten_thresholds') return __('dash_advisor_policy_action_tighten_thresholds');
    if (actionType === 'reset_policy') return __('dash_advisor_policy_action_reset');
    if (actionType === 'preset') return __('dash_advisor_policy_action_preset');
    return __('dash_advisor_policy_action_unknown');
  },

  getAdvisorPolicyTimeline(meta, limit = 5) {
    const history = Array.isArray(meta?.policyHistory) ? meta.policyHistory : [];
    const safeLimit = Math.max(1, Number(limit) || 5);
    return history.slice(-safeLimit).reverse().map((entry) => {
      const year = entry?.year || 1;
      const week = entry?.week || 1;
      const actionLabel = this.getAdvisorPolicyActionLabel(entry?.action);
      const profileLabel = this.getAdvisorPolicyProfileLabel(entry?.profile);
      const cooldown = entry?.cooldownWeeks || 2;
      const policy = entry?.policy || { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 };
      return `Y${year}W${week} ${actionLabel} (${profileLabel}) [C:${cooldown} S:${policy.deltaScoreMin} R:${policy.deltaRecentMin} P:${Math.round(policy.deltaPodiumMin)}]`;
    });
  },

  getAdvisorDataHealth(telemetry, suggestionStats) {
    const byMode = telemetry?.byMode || {};
    const totalRaces = ['conservative', 'balanced', 'aggressive']
      .reduce((sum, mode) => sum + (Number(byMode?.[mode]?.races) || 0), 0);
    const shown = Number(suggestionStats?.shown) || 0;
    const outcomes = (Number(suggestionStats?.applied) || 0) + (Number(suggestionStats?.ignored) || 0);

    if (totalRaces >= 12 && shown >= 10 && outcomes >= 8) {
      return { statusKey: 'dash_advisor_data_health_good', color: 'var(--c-green)', races: totalRaces, shown, outcomes };
    }
    if (totalRaces >= 6 && shown >= 5 && outcomes >= 4) {
      return { statusKey: 'dash_advisor_data_health_warming', color: 'var(--c-gold)', races: totalRaces, shown, outcomes };
    }
    return { statusKey: 'dash_advisor_data_health_low', color: 'var(--c-red)', races: totalRaces, shown, outcomes };
  },

  exportAdvisorPolicyTimeline() {
    const state = GL_STATE.getState();
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const timeline = this.getAdvisorPolicyTimeline(meta, 10);
    if (!timeline.length) {
      GL_UI.toast(__('dash_advisor_policy_export_empty'), 'info');
      return;
    }

    const policy = meta.policy || { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 };
    const profileLabel = this.getAdvisorPolicyProfileLabel(meta.policyProfile || 'balanced');
    const header = `${__('dash_advisor_policy_label')}: ${profileLabel} | ${__('dash_advisor_policy_cooldown')}: ${meta.cooldownWeeks || 2} | ${__('dash_advisor_policy_thresholds')}: S:${policy.deltaScoreMin} R:${policy.deltaRecentMin} P:${Math.round(policy.deltaPodiumMin)}`;
    const body = timeline.map((line, idx) => `${idx + 1}. ${line}`).join('\n');
    const content = `${header}\n${__('dash_advisor_policy_recent_changes')}:\n${body}`;

    const onSuccess = () => GL_UI.toast(__('dash_advisor_policy_export_success'), 'good');
    const onFailure = () => GL_UI.toast(__('dash_advisor_policy_export_failed'), 'warning');

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
      } catch (e) {
        onFailure();
      }
    };

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(onSuccess).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  },

  archiveAndResetAdvisorTelemetry() {
    const state = GL_STATE.getState();
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const stats = meta.stats || {};
    const policyHistory = Array.isArray(meta.policyHistory) ? meta.policyHistory : [];
    const suggestionHistory = Array.isArray(stats.history) ? stats.history : [];
    const hasAnyData = (stats.shown || 0) > 0 || (stats.applied || 0) > 0 || (stats.ignored || 0) > 0 || policyHistory.length > 0 || suggestionHistory.length > 0;

    if (!hasAnyData) {
      GL_UI.toast(__('dash_advisor_history_archive_empty'), 'info');
      return;
    }

    GL_UI.confirm(
      __('dash_advisor_history_archive_confirm_title'),
      __('dash_advisor_history_archive_confirm_desc'),
      __('dash_advisor_history_archive_confirm_ok'),
      __('btn_cancel')
    ).then((ok) => {
      if (!ok) return;

      if (!Array.isArray(meta.telemetryArchives)) meta.telemetryArchives = [];
      meta.telemetryArchives.push({
        ts: Date.now(),
        year: (state?.season?.year) || 1,
        week: (state?.season?.week) || 1,
        summary: {
          shown: Number(stats.shown) || 0,
          applied: Number(stats.applied) || 0,
          ignored: Number(stats.ignored) || 0,
          policyChanges: policyHistory.length,
          suggestionEvents: suggestionHistory.length
        }
      });
      if (meta.telemetryArchives.length > 12) meta.telemetryArchives = meta.telemetryArchives.slice(-12);

      meta.policyHistory = [];
      meta.stats = {
        shown: 0,
        applied: 0,
        ignored: 0,
        history: [],
        byMode: {
          conservative: { shown: 0, applied: 0, ignored: 0 },
          balanced: { shown: 0, applied: 0, ignored: 0 },
          aggressive: { shown: 0, applied: 0, ignored: 0 }
        },
        pending: false,
        pendingMode: '',
        pendingWeekIndex: 0,
        pendingReason: 'performance'
      };

      GL_STATE.saveState();
      GL_UI.toast(__('dash_advisor_history_archive_done'), 'good');
      this.refresh();
    });
  },

  getAdvisorPolicyPresets() {
    return {
      conservative: { cooldownWeeks: 3, policy: { deltaScoreMin: 1.5, deltaRecentMin: 2.0, deltaPodiumMin: 6 } },
      balanced: { cooldownWeeks: 2, policy: { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 } },
      aggressive: { cooldownWeeks: 1, policy: { deltaScoreMin: 0.8, deltaRecentMin: 1.0, deltaPodiumMin: 4 } }
    };
  },

  getAdvisorPolicyProfileLabel(profileId) {
    if (profileId === 'conservative') return __('dash_advisor_policy_preset_conservative');
    if (profileId === 'aggressive') return __('dash_advisor_policy_preset_aggressive');
    if (profileId === 'custom') return __('dash_advisor_policy_preset_custom');
    return __('dash_advisor_policy_preset_balanced');
  },

  applyAdvisorPolicyPreset(profileId) {
    const state = GL_STATE.getState();
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const policyLock = this.getAdvisorPolicyLockInfo(state);
    if (!policyLock.allowed) {
      GL_UI.toast(`${__('dash_advisor_policy_lock_blocked')} ${policyLock.weeksLeft} ${__('dash_advisor_weeks_left')}.`, 'warning');
      return;
    }
    const presets = this.getAdvisorPolicyPresets();
    const preset = presets[profileId] || presets.balanced;

    meta.cooldownWeeks = preset.cooldownWeeks;
    meta.policy = {
      deltaScoreMin: preset.policy.deltaScoreMin,
      deltaRecentMin: preset.policy.deltaRecentMin,
      deltaPodiumMin: preset.policy.deltaPodiumMin
    };
    meta.policyProfile = presets[profileId] ? profileId : 'balanced';
    meta.lastPolicyChangeWeekIndex = this.getCurrentWeekIndex(state);
    this.recordAdvisorPolicyChange(state, 'preset');

    GL_STATE.saveState();
    GL_UI.toast(`${__('dash_advisor_policy_preset_applied')} ${this.getAdvisorPolicyProfileLabel(meta.policyProfile)}.`, 'info');
    this.refresh();
  },

  getAdvisorRecommendedPolicyPreset(state) {
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const stats = meta.stats || {};
    const analysisWindow = this.getAdvisorAnalysisWindow(state);
    const ignoreBreakdown = this.getAdvisorIgnoreReasonBreakdown(stats, analysisWindow);
    const windowComparison = this.getAdvisorWindowComparison(stats, analysisWindow);
    const acceptanceRate = windowComparison?.current?.rate || 0;
    const trendDelta = windowComparison?.deltaRate;

    // Dominant expiry pattern means user often misses suggestions -> slow cadence.
    if (ignoreBreakdown.total >= 3 && ignoreBreakdown.expired >= (ignoreBreakdown.override + 2)) {
      return { profile: 'conservative', reasonKey: 'dash_advisor_policy_auto_reason_expired' };
    }

    // Manual overrides indicate recommendations are too pushy -> move to balanced.
    if (ignoreBreakdown.total >= 3 && ignoreBreakdown.override >= (ignoreBreakdown.expired + 2)) {
      return { profile: 'balanced', reasonKey: 'dash_advisor_policy_auto_reason_override' };
    }

    // High acceptance with improving trend can handle more aggressive optimization.
    if (acceptanceRate >= 65 && trendDelta !== null && trendDelta >= 3) {
      return { profile: 'aggressive', reasonKey: 'dash_advisor_policy_auto_reason_growth' };
    }

    return { profile: 'balanced', reasonKey: 'dash_advisor_policy_auto_reason_default' };
  },

  applyAdvisorRecommendedPolicyBaseline() {
    const state = GL_STATE.getState();
    const recommendation = this.getAdvisorRecommendedPolicyPreset(state);
    const targetProfile = recommendation?.profile || 'balanced';
    this.applyAdvisorPolicyPreset(targetProfile);
  },

  ensureAdvisorSuggestionMeta(state) {
    if (!state.advisor) {
      state.advisor = { mode: 'balanced', recent: [], layoutWeatherStats: {}, practice: { sessions: 0, lastTs: 0 } };
    }
    if (!state.advisor.telemetry) {
      state.advisor.telemetry = {
        byMode: {
          conservative: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
          balanced: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 },
          aggressive: { races: 0, recommended: 0, safe: 0, manual: 0, wins: 0, podiums: 0, dnfs: 0, totalPoints: 0, totalPerf: 0 }
        },
        last: { mode: state.advisor.mode || 'balanced', source: 'manual', ts: 0 },
        suggestion: {
          analysisWindow: 10,
          cooldownWeeks: 2,
          policyProfile: 'balanced',
          policy: { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 },
          policyHistory: [],
          lastAppliedWeekIndex: 0,
          lastAppliedMode: state.advisor.mode || 'balanced',
          stats: {
            shown: 0,
            applied: 0,
            ignored: 0,
            history: [],
            byMode: {
              conservative: { shown: 0, applied: 0, ignored: 0 },
              balanced: { shown: 0, applied: 0, ignored: 0 },
              aggressive: { shown: 0, applied: 0, ignored: 0 }
            },
            pending: false,
            pendingMode: '',
            pendingWeekIndex: 0
          }
        }
      };
    }
    if (!state.advisor.telemetry.suggestion) {
      state.advisor.telemetry.suggestion = {
        analysisWindow: 10,
        cooldownWeeks: 2,
        policyProfile: 'balanced',
        policy: { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 },
        policyHistory: [],
        lastAppliedWeekIndex: 0,
        lastAppliedMode: state.advisor.mode || 'balanced',
        stats: {
          shown: 0,
          applied: 0,
          ignored: 0,
          history: [],
          byMode: {
            conservative: { shown: 0, applied: 0, ignored: 0 },
            balanced: { shown: 0, applied: 0, ignored: 0 },
            aggressive: { shown: 0, applied: 0, ignored: 0 }
          },
          pending: false,
          pendingMode: '',
          pendingWeekIndex: 0
        }
      };
    }
    if (!state.advisor.telemetry.suggestion.stats) {
      state.advisor.telemetry.suggestion.stats = {
        shown: 0,
        applied: 0,
        ignored: 0,
        history: [],
        byMode: {
          conservative: { shown: 0, applied: 0, ignored: 0 },
          balanced: { shown: 0, applied: 0, ignored: 0 },
          aggressive: { shown: 0, applied: 0, ignored: 0 }
        },
        pending: false,
        pendingMode: '',
        pendingWeekIndex: 0
      };
    }
    if (!state.advisor.telemetry.suggestion.stats.byMode) {
      state.advisor.telemetry.suggestion.stats.byMode = {
        conservative: { shown: 0, applied: 0, ignored: 0 },
        balanced: { shown: 0, applied: 0, ignored: 0 },
        aggressive: { shown: 0, applied: 0, ignored: 0 }
      };
    }
    if (!Array.isArray(state.advisor.telemetry.suggestion.stats.history)) {
      state.advisor.telemetry.suggestion.stats.history = [];
    }
    if (![5, 10, 20].includes(Number(state.advisor.telemetry.suggestion.analysisWindow))) {
      state.advisor.telemetry.suggestion.analysisWindow = 10;
    }
    if (!state.advisor.telemetry.suggestion.policy) {
      state.advisor.telemetry.suggestion.policy = { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 };
    }
    if (!Array.isArray(state.advisor.telemetry.suggestion.policyHistory)) {
      state.advisor.telemetry.suggestion.policyHistory = [];
    }
    if (!Array.isArray(state.advisor.telemetry.suggestion.telemetryArchives)) {
      state.advisor.telemetry.suggestion.telemetryArchives = [];
    }
    if (!['conservative', 'balanced', 'aggressive', 'custom'].includes(state.advisor.telemetry.suggestion.policyProfile)) {
      state.advisor.telemetry.suggestion.policyProfile = 'balanced';
    }
    if (typeof state.advisor.telemetry.suggestion.policyLockWeeks !== 'number') {
      state.advisor.telemetry.suggestion.policyLockWeeks = 1;
    }
    if (typeof state.advisor.telemetry.suggestion.lastPolicyChangeWeekIndex !== 'number') {
      state.advisor.telemetry.suggestion.lastPolicyChangeWeekIndex = 0;
    }
    return state.advisor.telemetry.suggestion;
  },

  getCurrentWeekIndex(state) {
    const year = (state && state.season && state.season.year) ? state.season.year : 1;
    const week = (state && state.season && state.season.week) ? state.season.week : 1;
    return ((year - 1) * 52) + week;
  },

  getAdvisorSuggestionCooldownInfo(state) {
    const s = this.ensureAdvisorSuggestionMeta(state);
    const cooldownWeeks = Math.max(0, s.cooldownWeeks || 0);
    if (!cooldownWeeks || !s.lastAppliedWeekIndex) {
      return { active: false, weeksLeft: 0, cooldownWeeks };
    }
    const delta = this.getCurrentWeekIndex(state) - s.lastAppliedWeekIndex;
    const weeksLeft = Math.max(0, cooldownWeeks - delta);
    return { active: weeksLeft > 0, weeksLeft, cooldownWeeks };
  },

  getAdvisorPolicyLockInfo(state) {
    const s = this.ensureAdvisorSuggestionMeta(state);
    const lockWeeks = Math.max(0, Number(s.policyLockWeeks) || 1);
    const lastChangeWeekIndex = Number(s.lastPolicyChangeWeekIndex) || 0;
    if (!lockWeeks || !lastChangeWeekIndex) {
      return { allowed: true, active: false, weeksLeft: 0, lockWeeks };
    }
    const delta = this.getCurrentWeekIndex(state) - lastChangeWeekIndex;
    const weeksLeft = Math.max(0, lockWeeks - delta);
    return { allowed: weeksLeft === 0, active: weeksLeft > 0, weeksLeft, lockWeeks };
  },

  getAdvisorAnalysisWindow(state) {
    const s = this.ensureAdvisorSuggestionMeta(state);
    const windowSize = Number(s.analysisWindow) || 10;
    return [5, 10, 20].includes(windowSize) ? windowSize : 10;
  },

  setAdvisorAnalysisWindow(windowSize) {
    const state = GL_STATE.getState();
    const s = this.ensureAdvisorSuggestionMeta(state);
    const parsed = Number(windowSize) || 10;
    s.analysisWindow = [5, 10, 20].includes(parsed) ? parsed : 10;
    GL_STATE.saveState();
    this.refresh();
  },

  updateAdvisorSuggestionTelemetry(state, suggestion) {
    const meta = this.ensureAdvisorSuggestionMeta(state);
    const stats = meta.stats;
    const byMode = stats.byMode || {
      conservative: { shown: 0, applied: 0, ignored: 0 },
      balanced: { shown: 0, applied: 0, ignored: 0 },
      aggressive: { shown: 0, applied: 0, ignored: 0 }
    };
    const maxHistory = 40;
    const weekIndex = this.getCurrentWeekIndex(state);
    let changed = false;

    if (suggestion) {
      const samePending = stats.pending && stats.pendingMode === suggestion.mode && stats.pendingWeekIndex === weekIndex;
      if (!samePending) {
        if (stats.pending && weekIndex > stats.pendingWeekIndex) {
          stats.ignored += 1;
          if (byMode[stats.pendingMode]) byMode[stats.pendingMode].ignored += 1;
          if (!Array.isArray(stats.history)) stats.history = [];
          stats.history.push({
            action: 'ignored',
            mode: stats.pendingMode,
            weekIndex,
            reason: (stats.pendingReason || 'performance'),
            ignoreReason: 'expired'
          });
          if (stats.history.length > maxHistory) stats.history = stats.history.slice(-maxHistory);
          stats.pending = false;
          changed = true;
        }
        stats.shown += 1;
        if (byMode[suggestion.mode]) byMode[suggestion.mode].shown += 1;
        if (!Array.isArray(stats.history)) stats.history = [];
        stats.history.push({
          action: 'shown',
          mode: suggestion.mode,
          weekIndex,
          reason: (suggestion.reason || 'performance')
        });
        if (stats.history.length > maxHistory) stats.history = stats.history.slice(-maxHistory);
        stats.pending = true;
        stats.pendingMode = suggestion.mode;
        stats.pendingWeekIndex = weekIndex;
        stats.pendingReason = suggestion.reason || 'performance';
        changed = true;
      }
    } else if (stats.pending && weekIndex > stats.pendingWeekIndex) {
      stats.ignored += 1;
      if (byMode[stats.pendingMode]) byMode[stats.pendingMode].ignored += 1;
      if (!Array.isArray(stats.history)) stats.history = [];
      stats.history.push({
        action: 'ignored',
        mode: stats.pendingMode,
        weekIndex,
        reason: (stats.pendingReason || 'performance'),
        ignoreReason: 'expired'
      });
      if (stats.history.length > maxHistory) stats.history = stats.history.slice(-maxHistory);
      stats.pending = false;
      changed = true;
    }

    stats.byMode = byMode;

    if (changed) GL_STATE.saveState();
    return stats;
  },

  getAdvisorSuggestionHistoryTrend(stats, windowSize = 10) {
    const history = Array.isArray(stats?.history) ? stats.history : [];
    const count = [5, 10, 20].includes(windowSize) ? windowSize : 10;
    const outcomes = history
      .filter((h) => h && (h.action === 'applied' || h.action === 'ignored'))
      .slice(-count);
    const bars = outcomes.map((h) => (h.action === 'applied' ? '▇' : '▂'));
    const applied = outcomes.filter((h) => h.action === 'applied').length;
    return {
      bars,
      samples: outcomes.length,
      applied,
      ignored: outcomes.length - applied
    };
  },

  getAdvisorSuggestionReasonBreakdown(stats, windowSize = 10) {
    const history = Array.isArray(stats?.history) ? stats.history : [];
    const count = [5, 10, 20].includes(windowSize) ? windowSize : 10;
    const recent = history.slice(-count);
    const base = {
      performance: { shown: 0, applied: 0, ignored: 0, rate: 0 },
      adoption: { shown: 0, applied: 0, ignored: 0, rate: 0 }
    };

    recent.forEach((item) => {
      if (!item || !item.action) return;
      const reasonKey = item.reason === 'adoption' ? 'adoption' : 'performance';
      if (item.action === 'shown') base[reasonKey].shown += 1;
      if (item.action === 'applied') base[reasonKey].applied += 1;
      if (item.action === 'ignored') base[reasonKey].ignored += 1;
    });

    base.performance.rate = base.performance.shown > 0
      ? Math.round((base.performance.applied / base.performance.shown) * 100)
      : 0;
    base.adoption.rate = base.adoption.shown > 0
      ? Math.round((base.adoption.applied / base.adoption.shown) * 100)
      : 0;

    return base;
  },

  getAdvisorIgnoreReasonBreakdown(stats, windowSize = 10) {
    const history = Array.isArray(stats?.history) ? stats.history : [];
    const count = [5, 10, 20].includes(windowSize) ? windowSize : 10;
    const recentIgnored = history
      .filter((item) => item && item.action === 'ignored')
      .slice(-count);

    const breakdown = {
      expired: 0,
      override: 0,
      unknown: 0,
      total: recentIgnored.length
    };

    recentIgnored.forEach((item) => {
      if (item.ignoreReason === 'expired') breakdown.expired += 1;
      else if (item.ignoreReason === 'override') breakdown.override += 1;
      else breakdown.unknown += 1;
    });

    return breakdown;
  },

  getAdvisorIgnorePatternRecommendation(ignoreBreakdown) {
    const total = ignoreBreakdown?.total || 0;
    if (total === 0) return { text: __('dash_advisor_ignore_tip_none'), action: null };
    if (total < 3) return { text: __('dash_advisor_ignore_tip_low_data'), action: null };

    const expired = ignoreBreakdown.expired || 0;
    const override = ignoreBreakdown.override || 0;

    if (expired >= 2 && expired >= (override + 2)) {
      return { text: __('dash_advisor_ignore_tip_expired'), action: 'increase_cooldown' };
    }
    if (override >= 2 && override >= (expired + 2)) {
      return { text: __('dash_advisor_ignore_tip_override'), action: 'tighten_thresholds' };
    }
    return { text: __('dash_advisor_ignore_tip_balanced'), action: null };
  },

  getAdvisorWindowComparison(stats, windowSize = 10) {
    const history = Array.isArray(stats?.history) ? stats.history : [];
    const count = [5, 10, 20].includes(windowSize) ? windowSize : 10;

    const summarize = (slice) => {
      const summary = {
        shown: 0,
        applied: 0,
        ignored: 0,
        rate: 0,
        byReason: {
          performance: { shown: 0, applied: 0, ignored: 0, rate: 0 },
          adoption: { shown: 0, applied: 0, ignored: 0, rate: 0 }
        }
      };

      slice.forEach((item) => {
        if (!item || !item.action) return;
        const reasonKey = item.reason === 'adoption' ? 'adoption' : 'performance';
        if (item.action === 'shown') {
          summary.shown += 1;
          summary.byReason[reasonKey].shown += 1;
        }
        if (item.action === 'applied') {
          summary.applied += 1;
          summary.byReason[reasonKey].applied += 1;
        }
        if (item.action === 'ignored') {
          summary.ignored += 1;
          summary.byReason[reasonKey].ignored += 1;
        }
      });

      summary.rate = summary.shown > 0
        ? Math.round((summary.applied / summary.shown) * 100)
        : 0;
      summary.byReason.performance.rate = summary.byReason.performance.shown > 0
        ? Math.round((summary.byReason.performance.applied / summary.byReason.performance.shown) * 100)
        : 0;
      summary.byReason.adoption.rate = summary.byReason.adoption.shown > 0
        ? Math.round((summary.byReason.adoption.applied / summary.byReason.adoption.shown) * 100)
        : 0;

      return summary;
    };

    const currentSlice = history.slice(-count);
    const previousSlice = history.slice(-(count * 2), -count);
    const current = summarize(currentSlice);
    const previous = summarize(previousSlice);
    const hasPrevious = previous.shown > 0;

    const deltaRate = hasPrevious ? (current.rate - previous.rate) : null;
    const deltaPerformance = previous.byReason.performance.shown > 0
      ? (current.byReason.performance.rate - previous.byReason.performance.rate)
      : null;
    const deltaAdoption = previous.byReason.adoption.shown > 0
      ? (current.byReason.adoption.rate - previous.byReason.adoption.rate)
      : null;

    return {
      current,
      previous,
      hasPrevious,
      deltaRate,
      deltaPerformance,
      deltaAdoption
    };
  },

  getAdvisorRecentTrend(state, mode) {
    const recent = (state.advisor && Array.isArray(state.advisor.recent)) ? state.advisor.recent : [];
    const samples = recent
      .filter(r => r && r.mode === mode)
      .slice(0, 5)
      .map((r) => {
        if (typeof r.perfScore === 'number') return r.perfScore;
        const points = typeof r.points === 'number' ? r.points : 0;
        const posScore = (typeof r.position === 'number') ? Math.max(0, 12 - r.position) : 0;
        return points + posScore;
      })
      .reverse();

    const bars = samples.map((v) => {
      if (v >= 14) return '▇';
      if (v >= 10) return '▆';
      if (v >= 7) return '▅';
      if (v >= 4) return '▄';
      if (v >= 1) return '▃';
      return '▂';
    });
    return { samples, bars };
  },

  renderAdvisorTelemetry(state) {
    const el = document.getElementById('dash-advisor');
    if (!el) return;

    const telemetry = GL_ENGINE.getAdvisorTelemetry ? GL_ENGINE.getAdvisorTelemetry(state) : null;
    if (!telemetry || !telemetry.byMode) {
      el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_advisor_no_data')}</p>`;
      return;
    }

    const activeMode = (state.advisor && state.advisor.mode) ? state.advisor.mode : 'balanced';
    const modeLabel = {
      conservative: __('prerace_conservative'),
      balanced: __('prerace_balanced'),
      aggressive: __('prerace_aggressive')
    };

    const rows = ['conservative', 'balanced', 'aggressive'].map(mode => {
      const m = telemetry.byMode[mode] || { races: 0, avgPoints: 0, podiumRate: 0, dnfRate: 0 };
      const trend = this.getAdvisorRecentTrend(state, mode);
      const trendText = trend.bars.length
        ? trend.bars.join('')
        : __('dash_advisor_no_trend');
      const activeBadge = mode === activeMode
        ? `<span style="font-size:0.68rem;color:var(--c-accent)">• ${__('dash_advisor_current')}</span>`
        : '';
      return `
        <div style="padding:6px 0;border-bottom:1px solid var(--c-border)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="font-size:0.78rem;color:var(--t-primary)"><strong>${modeLabel[mode] || mode}</strong> ${activeBadge}</div>
            <div style="font-size:0.72rem;color:var(--t-secondary)">${__('dash_advisor_mode_races')}: <strong>${m.races || 0}</strong> · ${__('dash_advisor_avg_points')}: <strong>${m.avgPoints || 0}</strong> · ${__('dash_advisor_podium')}: <strong>${m.podiumRate || 0}%</strong> · ${__('dash_advisor_dnf')}: <strong>${m.dnfRate || 0}%</strong></div>
          </div>
          <div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">
            ${__('dash_advisor_trend')} (${__('dash_advisor_last5')}): <strong style="letter-spacing:1px">${trendText}</strong>
          </div>
        </div>`;
    }).join('');

    const suggestion = this.getAdvisorModeSuggestion(state);
    const suggestionMeta = this.ensureAdvisorSuggestionMeta(state);
    const activePolicy = suggestionMeta.policy || { deltaScoreMin: 1.1, deltaRecentMin: 1.4, deltaPodiumMin: 5 };
    const activeProfile = suggestionMeta.policyProfile || 'balanced';
    const profileLabel = this.getAdvisorPolicyProfileLabel(activeProfile);
    const recommendedPolicy = this.getAdvisorRecommendedPolicyPreset(state);
    const recommendedProfile = recommendedPolicy?.profile || 'balanced';
    const recommendedProfileLabel = this.getAdvisorPolicyProfileLabel(recommendedProfile);
    const recommendedReason = __(recommendedPolicy?.reasonKey || 'dash_advisor_policy_auto_reason_default');
    const isRecommendedActive = recommendedProfile === activeProfile;
    const policyHistory = Array.isArray(suggestionMeta.policyHistory) ? suggestionMeta.policyHistory : [];
    const policyLockInfo = this.getAdvisorPolicyLockInfo(state);
    const lastPolicyChange = policyHistory.length ? policyHistory[policyHistory.length - 1] : null;
    const lastPolicyChangeText = lastPolicyChange
      ? `${this.getAdvisorPolicyActionLabel(lastPolicyChange.action)} · ${this.getAdvisorPolicyProfileLabel(lastPolicyChange.profile)} · Y${lastPolicyChange.year}W${lastPolicyChange.week}`
      : __('dash_advisor_policy_no_changes');
    const policyTimeline = this.getAdvisorPolicyTimeline(suggestionMeta, 5);
    const policyTimelineHtml = policyTimeline.length
      ? policyTimeline.map((line) => `<div style="font-size:0.68rem;color:var(--t-tertiary)">• ${line}</div>`).join('')
      : `<div style="font-size:0.68rem;color:var(--t-tertiary)">${__('dash_advisor_policy_no_recent_changes')}</div>`;
    const presetButtonStyle = (profile) => profile === activeProfile
      ? 'background:var(--c-surface-2);border:1px solid var(--c-green);color:var(--c-green)'
      : 'background:var(--c-surface-2);border:1px solid var(--c-border-hi);color:var(--t-secondary)';
    const suggestionStats = this.updateAdvisorSuggestionTelemetry(state, suggestion);
    const dataHealth = this.getAdvisorDataHealth(telemetry, suggestionStats);
    const archiveCount = Array.isArray(suggestionMeta.telemetryArchives) ? suggestionMeta.telemetryArchives.length : 0;
    const byModeStats = suggestionStats.byMode || {
      conservative: { shown: 0, applied: 0, ignored: 0 },
      balanced: { shown: 0, applied: 0, ignored: 0 },
      aggressive: { shown: 0, applied: 0, ignored: 0 }
    };
    const modeAdoption = {
      conservative: byModeStats.conservative.shown > 0 ? Math.round((byModeStats.conservative.applied / byModeStats.conservative.shown) * 100) : 0,
      balanced: byModeStats.balanced.shown > 0 ? Math.round((byModeStats.balanced.applied / byModeStats.balanced.shown) * 100) : 0,
      aggressive: byModeStats.aggressive.shown > 0 ? Math.round((byModeStats.aggressive.applied / byModeStats.aggressive.shown) * 100) : 0
    };
    const bestAdoptionMode = ['conservative', 'balanced', 'aggressive']
      .sort((a, b) => (modeAdoption[b] || 0) - (modeAdoption[a] || 0))[0];
    const adoptionRate = suggestionStats.shown > 0
      ? Math.round((suggestionStats.applied / suggestionStats.shown) * 100)
      : 0;
    const analysisWindow = this.getAdvisorAnalysisWindow(state);
    const analysisWindowLabel = analysisWindow === 5
      ? __('dash_advisor_last5_decisions')
      : (analysisWindow === 20 ? __('dash_advisor_last20_decisions') : __('dash_advisor_last10_decisions'));
    const adoptionHistoryTrend = this.getAdvisorSuggestionHistoryTrend(suggestionStats, analysisWindow);
    const adoptionHistoryText = adoptionHistoryTrend.bars.length
      ? adoptionHistoryTrend.bars.join('')
      : __('dash_advisor_no_trend');
    const reasonBreakdown = this.getAdvisorSuggestionReasonBreakdown(suggestionStats, analysisWindow);
    const ignoreBreakdown = this.getAdvisorIgnoreReasonBreakdown(suggestionStats, analysisWindow);
    const ignoreTip = this.getAdvisorIgnorePatternRecommendation(ignoreBreakdown);
    const ignoreActionButton = ignoreTip.action === 'increase_cooldown'
      ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="GL_DASHBOARD.applyAdvisorSuggestionTuning('increase_cooldown')">${__('dash_advisor_ignore_action_expired')}</button>`
      : (ignoreTip.action === 'tighten_thresholds'
        ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="GL_DASHBOARD.applyAdvisorSuggestionTuning('tighten_thresholds')">${__('dash_advisor_ignore_action_override')}</button>`
        : '');
    const resetPolicyButton = `<button class="btn btn-ghost btn-sm" style="margin-top:6px;margin-left:6px" onclick="GL_DASHBOARD.applyAdvisorSuggestionTuning('reset_policy')">${__('dash_advisor_ignore_action_reset')}</button>`;
    const windowComparison = this.getAdvisorWindowComparison(suggestionStats, analysisWindow);
    const windowDelta = windowComparison.deltaRate;
    const windowDeltaText = windowDelta === null
      ? __('dash_advisor_insufficient_prev')
      : `${windowDelta > 0 ? '+' : ''}${windowDelta}${__('dash_advisor_pp')} ${__('dash_advisor_delta_prev')}`;
    const windowDeltaStyle = windowDelta === null
      ? 'color:var(--t-tertiary)'
      : (windowDelta > 0 ? 'color:var(--c-green)' : (windowDelta < 0 ? 'color:var(--c-red)' : 'color:var(--t-tertiary)'));
    const trendStatus = windowDelta === null
      ? { key: 'dash_advisor_trend_unknown', icon: '?', style: 'color:var(--t-tertiary)' }
      : (windowDelta >= 3
        ? { key: 'dash_advisor_trend_improving', icon: '▲', style: 'color:var(--c-green);font-weight:700' }
        : (windowDelta <= -3
          ? { key: 'dash_advisor_trend_worsening', icon: '▼', style: 'color:var(--c-red);font-weight:700' }
          : { key: 'dash_advisor_trend_stable', icon: '●', style: 'color:var(--c-gold);font-weight:700' }));
    const formatDeltaWithIcon = (delta) => {
      if (delta === null) return '';
      const icon = delta >= 3 ? '▲' : (delta <= -3 ? '▼' : '●');
      const color = delta >= 3
        ? 'var(--c-green)'
        : (delta <= -3 ? 'var(--c-red)' : 'var(--c-gold)');
      return ` <span style="color:${color};font-weight:700">(${icon} Δ ${delta > 0 ? '+' : ''}${delta}${__('dash_advisor_pp')})</span>`;
    };
    const perfDeltaText = formatDeltaWithIcon(windowComparison.deltaPerformance);
    const adoptionDeltaText = formatDeltaWithIcon(windowComparison.deltaAdoption);
    const performanceRate = reasonBreakdown.performance.rate || 0;
    const adoptionSourceRate = reasonBreakdown.adoption.rate || 0;
    const minSourceSamples = 3;
    const hasSourceConfidence = reasonBreakdown.performance.shown >= minSourceSamples && reasonBreakdown.adoption.shown >= minSourceSamples;
    const sourceRateTie = hasSourceConfidence && performanceRate === adoptionSourceRate;
    const bestSource = !hasSourceConfidence || sourceRateTie
      ? null
      : (performanceRate > adoptionSourceRate ? 'performance' : 'adoption');
    const performanceSourceStyle = bestSource === 'performance' ? 'color:var(--c-green);font-weight:700' : '';
    const adoptionSourceStyle = bestSource === 'adoption' ? 'color:var(--c-green);font-weight:700' : '';
    const sourceTieLabel = sourceRateTie ? ` • ${__('dash_advisor_tie')}` : '';
    const sourceConfidenceNote = !hasSourceConfidence
      ? `<div style="font-size:0.68rem;color:var(--c-gold);margin-bottom:6px">${__('dash_advisor_low_confidence_source')} (${__('dash_advisor_min_samples')}: ${minSourceSamples}/${minSourceSamples})</div>`
      : '';
    const cooldown = this.getAdvisorSuggestionCooldownInfo(state);
    const suggestionBox = suggestion ? `
      <div style="margin-top:8px;padding:8px;border:1px solid var(--c-border-hi);border-radius:8px;background:var(--c-surface-2)">
        <div style="font-size:0.76rem;color:var(--t-primary);font-weight:700">${__('dash_advisor_suggest_title')}</div>
        <div style="font-size:0.72rem;color:var(--t-secondary);margin-top:4px">
          ${suggestion.reason === 'adoption'
            ? `${__('dash_advisor_suggest_adoption_text')} <strong>${modeLabel[suggestion.mode] || suggestion.mode}</strong> (${suggestion.adoptionRate}% ${__('dash_advisor_adoption_rate').toLowerCase()}).`
            : `${__('dash_advisor_suggest_text')} <strong>${modeLabel[suggestion.mode] || suggestion.mode}</strong> (+${suggestion.deltaPts} ${__('points')}, +${suggestion.deltaPodium}% ${__('dash_advisor_podium')}).`
          }
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="GL_DASHBOARD.applyAdvisorMode('${suggestion.mode}')">${__('dash_advisor_apply_mode')}</button>
      </div>`
      : '';
    const cooldownBox = (!suggestion && cooldown.active) ? `
      <div style="margin-top:8px;padding:8px;border:1px dashed var(--c-border-hi);border-radius:8px;background:var(--c-surface-2)">
        <div style="font-size:0.74rem;color:var(--t-secondary)">${__('dash_advisor_cooldown')}: <strong>${cooldown.weeksLeft}</strong> ${__('dash_advisor_weeks_left')}</div>
      </div>`
      : '';

    el.innerHTML = `
      ${suggestionBox}
      ${cooldownBox}

      <div class="adv-section">
        <div class="adv-section-hd">${__('dash_advisor_section_status')}</div>
        <div class="adv-row">${__('dash_advisor_current_mode')}: <strong>${modeLabel[activeMode] || activeMode}</strong></div>
        <div class="adv-row">${__('dash_advisor_data_health_label')}: <span style="color:${dataHealth.color};font-weight:700">${__(dataHealth.statusKey)}</span> · ${__('dash_advisor_mode_races')} <strong>${dataHealth.races}</strong> · ${__('dash_advisor_shown')} <strong>${dataHealth.shown}</strong> · ${__('dash_advisor_data_health_outcomes')} <strong>${dataHealth.outcomes}</strong></div>
        <div class="adv-row">${__('dash_advisor_suggestion_stats')}: ${__('dash_advisor_shown')} <strong>${suggestionStats.shown}</strong> · ${__('dash_advisor_applied')} <strong>${suggestionStats.applied}</strong> · ${__('dash_advisor_ignored')} <strong>${suggestionStats.ignored}</strong></div>
        <div class="adv-row">${__('dash_advisor_adoption_rate')}: <strong>${adoptionRate}%</strong></div>
      </div>

      <div class="adv-section">
        <div class="adv-section-hd">${__('dash_advisor_section_modes')}</div>
        <div style="font-size:0.68rem;color:var(--t-tertiary);margin-bottom:6px" title="${__('dash_advisor_trend_scale_tip')}">${__('dash_advisor_trend_scale')}</div>
        ${rows}
      </div>

      <div class="adv-section">
        <div class="adv-section-hd">${__('dash_advisor_section_analytics')}</div>
        <div class="adv-row adv-row--flex">
          <span>${__('dash_advisor_window')}:</span>
          <select onchange="GL_DASHBOARD.setAdvisorAnalysisWindow(this.value)" style="font-size:0.7rem;padding:2px 4px;border-radius:6px;border:1px solid var(--c-border-hi);background:var(--c-surface-2);color:var(--t-primary)">
            <option value="5" ${analysisWindow === 5 ? 'selected' : ''}>5</option>
            <option value="10" ${analysisWindow === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${analysisWindow === 20 ? 'selected' : ''}>20</option>
          </select>
        </div>
        <div class="adv-row">${__('dash_advisor_trend_signal')}: <span style="${trendStatus.style}">${trendStatus.icon} ${__(trendStatus.key)}</span></div>
        <div class="adv-row">${__('dash_advisor_window_accept')} (${analysisWindowLabel}): <strong>${windowComparison.current.rate}%</strong> <span style="${windowDeltaStyle}">(${windowDeltaText})</span></div>
        ${sourceConfidenceNote}
        <div class="adv-row">${__('dash_advisor_source_mix')}: <span style="${performanceSourceStyle}">${__('dash_advisor_performance')} <strong>${reasonBreakdown.performance.shown}</strong>${bestSource === 'performance' ? ` • ${__('dash_advisor_best')}` : ''}</span> · <span style="${adoptionSourceStyle}">${__('dash_advisor_adoption')} <strong>${reasonBreakdown.adoption.shown}</strong>${bestSource === 'adoption' ? ` • ${__('dash_advisor_best')}` : ''}</span>${sourceTieLabel}</div>
        <div class="adv-row">${__('dash_advisor_source_accept')}: <span style="${performanceSourceStyle}">${__('dash_advisor_performance')} <strong>${reasonBreakdown.performance.rate}%</strong>${perfDeltaText}${bestSource === 'performance' ? ` • ${__('dash_advisor_best')}` : ''}</span> · <span style="${adoptionSourceStyle}">${__('dash_advisor_adoption')} <strong>${reasonBreakdown.adoption.rate}%</strong>${adoptionDeltaText}${bestSource === 'adoption' ? ` • ${__('dash_advisor_best')}` : ''}</span>${sourceTieLabel}</div>
        <div class="adv-row">${__('dash_advisor_ignore_reasons')} (${analysisWindowLabel}): ${__('dash_advisor_ignore_expired')} <strong>${ignoreBreakdown.expired}</strong> · ${__('dash_advisor_ignore_override')} <strong>${ignoreBreakdown.override}</strong>${ignoreBreakdown.unknown > 0 ? ` · ${__('dash_advisor_ignore_unknown')} <strong>${ignoreBreakdown.unknown}</strong>` : ''}</div>
        <div class="adv-row">${__('dash_advisor_ignore_tip_label')}: ${ignoreTip.text}${ignoreActionButton}${resetPolicyButton}</div>
        <div class="adv-row">${__('dash_advisor_by_mode')}:
          <span style="${bestAdoptionMode === 'conservative' ? 'color:var(--c-green);font-weight:700' : ''}">C <strong>${byModeStats.conservative.applied}/${byModeStats.conservative.shown}</strong> (${modeAdoption.conservative}%)${bestAdoptionMode === 'conservative' ? ` • ${__('dash_advisor_best')}` : ''}</span> ·
          <span style="${bestAdoptionMode === 'balanced' ? 'color:var(--c-green);font-weight:700' : ''}">B <strong>${byModeStats.balanced.applied}/${byModeStats.balanced.shown}</strong> (${modeAdoption.balanced}%)${bestAdoptionMode === 'balanced' ? ` • ${__('dash_advisor_best')}` : ''}</span> ·
          <span style="${bestAdoptionMode === 'aggressive' ? 'color:var(--c-green);font-weight:700' : ''}">A <strong>${byModeStats.aggressive.applied}/${byModeStats.aggressive.shown}</strong> (${modeAdoption.aggressive}%)${bestAdoptionMode === 'aggressive' ? ` • ${__('dash_advisor_best')}` : ''}</span>
        </div>
        <div class="adv-row">${__('dash_advisor_adoption_trend')} (${analysisWindowLabel}): <strong style="letter-spacing:1px">${adoptionHistoryText}</strong> <span style="font-size:0.68rem;color:var(--t-tertiary)">(${adoptionHistoryTrend.applied}/${adoptionHistoryTrend.samples})</span></div>
      </div>

      <div class="adv-section">
        <div class="adv-section-hd">${__('dash_advisor_section_policy')}</div>
        <div class="adv-row">${__('dash_advisor_policy_label')}: <strong>${profileLabel}</strong> · ${__('dash_advisor_policy_cooldown')} <strong>${suggestionMeta.cooldownWeeks || 2}</strong> · ${__('dash_advisor_policy_thresholds')} <strong>S:${activePolicy.deltaScoreMin.toFixed(1)}</strong>/<strong>R:${activePolicy.deltaRecentMin.toFixed(1)}</strong>/<strong>P:${Math.round(activePolicy.deltaPodiumMin)}</strong></div>
        <div class="adv-row">${__('dash_advisor_policy_lock_label')}: <strong>${policyLockInfo.lockWeeks}</strong> ${__('dash_advisor_policy_lock_window_weeks')} · ${policyLockInfo.active ? `<span style="color:var(--c-gold)">${__('dash_advisor_policy_lock_active')} (${policyLockInfo.weeksLeft} ${__('dash_advisor_weeks_left')})</span>` : `<span style="color:var(--c-green)">${__('dash_advisor_policy_lock_ready')}</span>`}</div>
        <div class="adv-row adv-row--flex">
          <span>${__('dash_advisor_policy_presets')}:</span>
          <button class="btn btn-ghost btn-sm" style="${presetButtonStyle('conservative')}" onclick="GL_DASHBOARD.applyAdvisorPolicyPreset('conservative')">${__('dash_advisor_policy_preset_conservative')}</button>
          <button class="btn btn-ghost btn-sm" style="${presetButtonStyle('balanced')}" onclick="GL_DASHBOARD.applyAdvisorPolicyPreset('balanced')">${__('dash_advisor_policy_preset_balanced')}</button>
          <button class="btn btn-ghost btn-sm" style="${presetButtonStyle('aggressive')}" onclick="GL_DASHBOARD.applyAdvisorPolicyPreset('aggressive')">${__('dash_advisor_policy_preset_aggressive')}</button>
        </div>
        <div class="adv-row">${__('dash_advisor_policy_auto_label')}: <strong>${recommendedProfileLabel}</strong>${isRecommendedActive ? ` · <span style="color:var(--c-green)">${__('dash_advisor_policy_auto_already_active')}</span>` : ''} · ${recommendedReason} <button class="btn btn-ghost btn-sm" style="margin-left:4px" onclick="GL_DASHBOARD.applyAdvisorRecommendedPolicyBaseline()">${__('dash_advisor_policy_auto_apply')}</button></div>
      </div>

      <div class="adv-section">
        <div class="adv-section-hd">${__('dash_advisor_section_history')}</div>
        <div class="adv-row">${__('dash_advisor_policy_last_change')}: <strong>${lastPolicyChangeText}</strong> · ${__('dash_advisor_policy_changes_count')} <strong>${policyHistory.length}</strong></div>
        <div style="margin:4px 0 6px">${policyTimelineHtml}</div>
        <div class="adv-row adv-row--flex">
          <span>${__('dash_advisor_history_archive_count')}: <strong>${archiveCount}</strong></span>
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.exportAdvisorPolicyTimeline()">${__('dash_advisor_policy_export')}</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_DASHBOARD.archiveAndResetAdvisorTelemetry()">${__('dash_advisor_history_archive_reset')}</button>
        </div>
      </div>
    `;
  },

  renderRecommendations(state) {
    const el = document.getElementById('dash-recs');
    if (!el) return;
    const recs = [];
    const cal = state.season.calendar || [];
    const next = cal.find(r=>r.status==='next');
    if (next) recs.push({ icon:'🏁', title:__('rec_race_title'), text:`${__('round')} ${next.round} ${__('nav_at')||'at'} ${next.circuit?.name}. ${__('rec_race_text')}`, action:"GL_APP.navigateTo('prerace')" });
    const upgrading = (state.facilities||[]).filter(f=>f.upgrading).length;
    if (!upgrading && state.finances.credits > 30000) recs.push({ icon:'🏗️', title:__('rec_upgrade_title'), text:__('rec_upgrade_text'), action:"GL_APP.navigateTo('garage')" });
    if ((state.pilots||[]).length < 2) recs.push({ icon:'🧑‍✈️', title:__('rec_sign_pilot_title'), text:__('rec_sign_pilot_text'), action:"GL_APP.navigateTo('market')" });
    const advisorSuggestion = this.getAdvisorModeSuggestion(state);
    if (advisorSuggestion) {
      recs.push({
        icon:'🧠',
        title: __('rec_advisor_mode_title'),
        text: `${__('rec_advisor_mode_text')} ${advisorSuggestion.mode}.`,
        action: `GL_DASHBOARD.applyAdvisorMode('${advisorSuggestion.mode}')`
      });
    }
    const campaign = GL_ENGINE.getCampaignStatus ? GL_ENGINE.getCampaignStatus() : null;
    if (campaign?.objective && !campaign.objective.completed) {
      recs.push({
        icon:'🎯',
        title: __('rec_campaign_title'),
        text: `${__('rec_campaign_text')} ${__(campaign.objective.titleKey)}.`,
        action: "GL_APP.navigateTo('standings')"
      });
    }
    if (!recs.length) recs.push({ icon:'📊', title:__('rec_review_title'), text:__('rec_review_text'), action:"GL_APP.navigateTo('standings')" });
    el.innerHTML = recs.map(r => `<div class="rec-card" onclick="${r.action}"><span class="rec-card-icon">${r.icon}</span><div class="rec-card-text"><strong>${r.title}</strong>${r.text}</div></div>`).join('');
  },

  startEventPoller() {
    setInterval(() => {
      const ev = GL_STATE.popRandomEvent();
      if (ev) { window._pendingEvent = ev; GL_UI.showRandomEvent(ev); }
    }, 15000);
  }
};

window.GL_DASHBOARD = DASHBOARD;
