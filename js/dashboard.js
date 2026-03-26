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
    GL_ENGINE.checkFacilityTimers();
    this.renderSkeleton();
    this.renderStatCards(state);
    this.renderNextEvent(state);
    this.renderStandings(state);
    this.renderFinances(state);
    this.renderUpgrades(state);
    this.renderPilotMorale(state);
    this.renderActivity(state);
    this.renderSponsors(state);
    this.renderAlerts(state);
    this.renderRecommendations(state);
    this.updateTopbar(state);
  },

  renderSkeleton() {
    const el = document.getElementById('screen-dashboard');
    if (!el) return;
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
        </div>
      </div>
      <div class="dashboard-grid stagger">
        <div id="dash-stat-cards" style="display:contents"></div>
        <div style="grid-column:1/3">
          <div class="section-header">
            <span class="section-title">${__('dash_next_event')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('calendar')">${__('dash_full_calendar')}</button>
          </div>
          <div id="dash-next-event"></div>
        </div>
        <div>
          <div class="section-header">
            <span class="section-title">${__('dash_standings')}</span>
            <button class="btn btn-ghost btn-sm" onclick="GL_APP.navigateTo('standings')">${__('dash_full_table')}</button>
          </div>
          <div class="card" id="dash-standings"></div>
        </div>
        <div class="right-panel">
          <div class="card">
            <div class="section-eyebrow">${__('dash_alerts_label')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('dash_alerts_title')}</div>
            <div id="dash-alerts"></div>
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

  renderStatCards(state) {
    const el = document.getElementById('dash-stat-cards');
    if (!el) return;
    const standing = GL_STATE.getMyStanding();
    const fi = state.finances;
    const net = (fi.weeklyIncome||0) - (fi.weeklyExpenses||0);
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-icon">🏁</div>
        <div class="stat-card-eyebrow">${__('dash_championship_pos')}</div>
        <div class="stat-card-value" style="color:var(--c-gold)">P${standing.position||1}</div>
        <div class="stat-card-label">${standing.points||0} ${__('dash_points_season')}</div>
        <div class="stat-card-change neutral">${__('division')} ${state.season.division}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">💰</div>
        <div class="stat-card-eyebrow">${__('dash_credits')}</div>
        <div class="stat-card-value">${GL_UI.fmtCR(fi.credits||0)}</div>
        <div class="stat-card-label">${__('dash_available_budget')}</div>
        <div class="stat-card-change ${net>=0?'up':'down'}">${GL_UI.fmtSign(net)} ${__('finance_per_week')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">👥</div>
        <div class="stat-card-eyebrow">${__('dash_fans')}</div>
        <div class="stat-card-value">${GL_UI.fmtCR(state.team.fans||0)}</div>
        <div class="stat-card-label">${__('dash_global_fan')}</div>
        <div class="stat-card-change up">${__('dash_growing')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon">⭐</div>
        <div class="stat-card-eyebrow">${__('dash_reputation')}</div>
        <div class="stat-card-value">${state.team.reputation||100}</div>
        <div class="stat-card-label">${__('dash_team_prestige')}</div>
        ${GL_UI.progressBar(state.team.reputation||100, 500, 'gold')}
      </div>`;
  },

  renderNextEvent(state) {
    const el = document.getElementById('dash-next-event');
    if (!el) return;
    const cal = state.season.calendar || [];
    const next = cal.find(r => r.status === 'next');
    if (!next) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('no_race_complete')}</p></div>`; return; }
    const c = next.circuit;
    
    const nextRaceObj = GL_ENGINE.getNextRaceDate();
    const typeLabel = nextRaceObj.type === 'practice' ? (window.__('next_practice_lbl') || 'PRÁCTICA') : (window.__('next_race_lbl') || 'CARRERA');

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
    const top5 = standings.slice(0, 6);
    el.innerHTML = top5.map(s => `
      <div class="standings-row ${s.id==='player'?'my-team':''}">
        <span class="standings-row-pos">${s.position}</span>
        <span class="standings-row-dot" style="background:${s.color||'#888'}"></span>
        <span class="standings-row-name">${s.name}${s.id==='player'?' <span style="color:var(--c-accent);font-size:0.7rem">' + __('standings_you') + '</span>':''}</span>
        <span class="standings-row-pts">${s.points} ${__('points')}</span>
      </div>`).join('');
  },

  renderFinances(state) {
    const el = document.getElementById('dash-finances');
    if (!el) return;
    const sponsors = state.sponsors || [];
    const pilots = state.pilots || [];
    const staff = state.staff || [];
    const sponsorIncome = sponsors.reduce((s,sp) => s+(sp.income||0), 0);
    const pilotCost = pilots.reduce((s,p) => s+(p.salary||0), 0);
    const staffCost = staff.reduce((s,st) => s+(st.salary||0), 0);
    const facCost = (state.facilities||[]).reduce((s,f) => s+(f.level>0?f.level*800:0), 0);
    const income = sponsorIncome + Math.floor((state.team.fans||0)*0.05);
    const expenses = pilotCost + staffCost + facCost;
    el.innerHTML = `
      <div class="finance-row"><span class="finance-row-label">${__('finances_sponsor_income')}</span><span class="finance-row-val positive">+${GL_UI.fmtCR(sponsorIncome)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_fan_revenue')}</span><span class="finance-row-val positive">+${GL_UI.fmtCR(Math.floor((state.team.fans||0)*0.05))}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_pilot_salaries')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(pilotCost)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_staff_salaries')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(staffCost)}${__('per_week')}</span></div>
      <div class="finance-row"><span class="finance-row-label">${__('finances_facility_costs')}</span><span class="finance-row-val negative">-${GL_UI.fmtCR(facCost)}${__('per_week')}</span></div>
      <div class="finance-row" style="border-top:2px solid var(--c-border-hi)">
        <span class="finance-row-label" style="font-weight:700;color:var(--t-primary)">${__('finances_weekly_net')}</span>
        <span class="finance-row-val ${income-expenses>=0?'positive':'negative'}" style="font-size:1rem">${GL_UI.fmtSign(income-expenses)}</span>
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

  renderAlerts(state) {
    const el = document.getElementById('dash-alerts');
    if (!el) return;
    const alerts = [];
    if (state.finances.credits < 20000) alerts.push({ type:'danger', icon:'⚠️', text: __('dash_low_budget') });
    const negWeekly = ((state.sponsors||[]).reduce((s,sp)=>s+(sp.income||0),0)) - ((state.pilots||[]).reduce((s,p)=>s+(p.salary||0),0)) - ((state.staff||[]).reduce((s,st)=>s+(st.salary||0),0));
    if (negWeekly < 0) alerts.push({ type:'warning', icon:'💸', text: __('dash_losing_money') });
    const injuredPilot = (state.pilots||[]).find(p=>p.injured);
    if (injuredPilot) alerts.push({ type:'danger', icon:'🤕', text: `<strong>${injuredPilot.name}</strong> ${__('dash_pilot_injured')}` });
    if (!alerts.length) { el.innerHTML = `<p style="color:var(--t-tertiary);font-size:0.82rem">${__('dash_no_critical')}</p>`; return; }
    el.innerHTML = alerts.map(a => `<div class="alert-item ${a.type}"><span class="alert-item-icon">${a.icon}</span><span class="alert-item-text">${a.text}</span></div>`).join('');
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
