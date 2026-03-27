// ===== APP.JS – Router + initialization =====
'use strict';

const APP = {
  currentScreen: 'dashboard',

  NAV_ITEMS: [
    { id:'dashboard', labelKey:'nav_dashboard', icon:'🏠', screen:'dashboard' },
    { id:'garage',    labelKey:'nav_garage',    icon:'🏗️', screen:'garage' },
    { id:'pilots',    labelKey:'nav_pilots',    icon:'🧑‍✈️', screen:'pilots' },
    { id:'car',       labelKey:'nav_car',       icon:'⚙️', screen:'car' },
    { id:'staff',     labelKey:'nav_staff',     icon:'👥', screen:'staff' },
    { id:'calendar',  labelKey:'nav_calendar',  icon:'📅', screen:'calendar' },
    { id:'standings', labelKey:'nav_standings', icon:'🏆', screen:'standings' },
    { id:'finances',  labelKey:'nav_finances',  icon:'💰', screen:'finances' },
    { id:'market',    labelKey:'nav_market',    icon:'🔍', screen:'market' },
    { id:'prerace',   labelKey:'nav_prerace',   icon:'🚦', screen:'prerace', hidden:true },
    { id:'race',      labelKey:'nav_race',      icon:'🏁', screen:'race', hidden:true },
    { id:'postrace',  labelKey:'nav_postrace',  icon:'📊', screen:'postrace', hidden:true },
  ],

  init() {
    const loaded = GL_STATE.loadState();

    if (loaded && GL_STATE.hasOnboarded()) {
      this.showApp();
      GL_ENGINE.catchUpOffline();
      if (window.GL_DASHBOARD) GL_DASHBOARD.init();
      this.navigateTo('dashboard');
    } else {
      console.log('App: State not onboarded or missing. Starting onboarding.');
      document.getElementById('app').style.display = 'none';
      const obEl = document.getElementById('onboarding-screen');
      if (obEl) {
        obEl.style.display = 'flex';
        GL_OB.start();
      }
    }

    this.buildSidebar();
    this.buildTopbar();
    this.attachGlobalHandlers();
    this.startRealTimeClock();
  },

  startRealTimeClock() {
    const updateTime = () => {
      const elTime = document.getElementById('rt-clock-time');
      const elNext = document.getElementById('rt-clock-next');
      if (!elTime || !elNext) return;

      const now = new Date();
      // Format time safely
      const formatTime = (d) => d.toLocaleTimeString(GL_I18N.currentLang === 'es' ? 'es-ES' : 'en-US', {weekday: 'short', hour: '2-digit', minute:'2-digit'});
      elTime.textContent = formatTime(now).toUpperCase();

      const nextRaceObj = GL_ENGINE.getNextRaceDate();
      const nextRace = nextRaceObj.date;
      
      const diffMs = nextRace.getTime() - now.getTime();
      
      // If time arrived, simulate!
      if (diffMs <= 0) {
         GL_ENGINE.catchUpOffline();
         if (window.GL_DASHBOARD) GL_DASHBOARD.init();
         return;
      }
      
      // Check active HQ construction
      if (GL_ENGINE.updateConstructionQueue()) {
         if (APP.currentScreen === 'garage' && window.GL_SCREENS) window.GL_SCREENS.renderGarage();
         if (window.GL_DASHBOARD) GL_DASHBOARD.updateTopbar(S.getState());
      }
      
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      let countdown = '';
      if (diffHrs >= 24) {
         countdown = `${Math.floor(diffHrs/24)}d ${diffHrs%24}h`;
      } else {
         countdown = `${diffHrs}h ${diffMins}m ${diffSecs}s`;
      }
      
      const lblStr = nextRaceObj.type === 'practice' ? (window.__('next_practice_lbl') || 'NEXT PRAC') : (window.__('next_race_lbl') || 'NEXT RACE');
      elNext.textContent = `${lblStr}: ${countdown}`;
    };
    
    updateTime();
    setInterval(updateTime, 1000);
  },

  showApp() {
    document.getElementById('onboarding-screen').style.display = 'none';
    document.getElementById('app').style.display = 'grid';
  },

  buildTopbar() {
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const state = GL_STATE.getState();
    topbar.innerHTML = `
      <div class="topbar-brand">
        <div class="topbar-logo" id="topbar-logo" style="background:linear-gradient(135deg,${state.team.colors.primary},${state.team.colors.primary}88)">
          ${state.team.logo||'🏎️'}
        </div>
        <span class="topbar-name" id="topbar-team-name">${state.team.name||'Garage Legends'}</span>
      </div>
      <div class="topbar-separator"></div>
      <div class="topbar-clock rt-clock" id="topbar-clock">
        <div class="rt-clock-time" id="rt-clock-time">--:--</div>
        <div class="rt-clock-next" id="rt-clock-next">NEXT RACE: --:--</div>
      </div>
      <div class="topbar-actions">
        <div class="topbar-credits" title="Credits" onclick="GL_APP.navigateTo('finances')">
          <span class="topbar-credits-icon">💰</span>
          <span class="topbar-credits-val" id="topbar-credits-val">${GL_UI.fmtCR(state.finances.credits||0)}</span>
        </div>
        <div class="topbar-tokens" title="Tokens">
          <span class="topbar-tokens-icon">🪙</span>
          <span class="topbar-tokens-val" id="topbar-tokens-val">${state.finances.tokens||0}</span>
        </div>
        <div class="topbar-notif" title="Notifications" onclick="GL_APP.showNotifications()">
          🔔
          <div class="notif-dot"></div>
        </div>
        <button class="topbar-lang-btn" onclick="GL_I18N.toggle()" title="Switch language / Cambiar idioma" style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:4px 10px;cursor:pointer;font-size:0.78rem;color:var(--t-secondary);font-weight:600;transition:all 0.2s">
          ${GL_I18N.getLangLabel()}
        </button>
        <div class="topbar-avatar" id="topbar-avatar" title="Your team" onclick="GL_APP.showProfile()" style="cursor:pointer">${(state.team.name||'U')[0].toUpperCase()}</div>
      </div>`;
  },

  buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const state = GL_STATE.getState();
    const visibleItems = this.NAV_ITEMS.filter(n => !n.hidden);
    sidebar.innerHTML = `
      <div class="sidebar-section-label">${__('nav_main')}</div>
      ${visibleItems.slice(0,1).map(n => this.navItemHTML(n)).join('')}
      <div class="sidebar-section-label">${__('nav_team')}</div>
      ${visibleItems.slice(1,5).map(n => this.navItemHTML(n)).join('')}
      <div class="sidebar-section-label">${__('nav_season')}</div>
      ${visibleItems.slice(5).map(n => this.navItemHTML(n)).join('')}
      <div class="sidebar-divider"></div>
      <div class="sidebar-footer">
        <div class="sidebar-team-info">
          <div class="sidebar-team-logo" id="sidebar-team-logo" style="background:${state.team.colors.primary}22">${state.team.logo||'🏎️'}</div>
          <div>
            <div class="sidebar-team-name" id="sidebar-team-name">${state.team.name||'Your Team'}</div>
            <div class="sidebar-team-div" id="sidebar-team-div">${__('division')} ${state.season.division}</div>
          </div>
        </div>
      </div>`;
  },

  navItemHTML(item) {
    const label = item.labelKey ? __(item.labelKey, item.id) : (item.label||item.id);
    return `<button class="nav-item ${this.currentScreen===item.id?'active':''}" data-screen="${item.id}" onclick="GL_APP.navigateTo('${item.id}')">
      <span class="nav-item-icon">${item.icon}</span>
      <span class="nav-item-text">${label}</span>
    </button>`;
  },

  navigateTo(screenId) {
    this.currentScreen = screenId;

    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.screen === screenId);
    });

    // Hide all screens, show target
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('active');

    // Render screen content
    const renderMap = {
      dashboard: () => GL_DASHBOARD.refresh(),
      garage:    () => GL_SCREENS.renderGarage(),
      pilots:    () => GL_SCREENS.renderPilots(),
      staff:     () => GL_SCREENS.renderStaff(),
      car:       () => GL_SCREENS.renderCar(),
      calendar:  () => GL_SCREENS.renderCalendar(),
      standings: () => GL_SCREENS.renderStandings(),
      finances:  () => GL_SCREENS.renderFinances(),
      market:    () => GL_SCREENS.renderMarket(),
      prerace:   () => GL_SCREENS.renderPreRace(),
      race:      () => GL_SCREENS.renderRace(),
      postrace:  () => GL_SCREENS.renderPostRace(),
    };
    if (renderMap[screenId]) renderMap[screenId]();

    // Scroll main to top
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  },

  showNotifications() {
    const log = GL_STATE.getState().log || [];
    GL_UI.openModal({
      title: __('topbar_notifications_title'),
      content: log.length ? `<div style="display:flex;flex-direction:column;gap:8px">
        ${log.slice(0,15).map(l => {
          const icon = l.type === 'good' ? '✅' : l.type === 'bad' ? '❌' : 'ℹ️';
          return `<div style="display:flex;gap:12px;padding:10px;background:var(--c-surface-2);border-radius:8px;font-size:0.82rem">
            <span>${icon}</span><div style="flex:1;color:var(--t-secondary)">${l.text}</div>
            <span style="font-size:0.72rem;color:var(--t-tertiary);flex-shrink:0">${__('topbar_week')} ${l.week}</span>
          </div>`;
        }).join('')}
      </div>` : `<p style="color:var(--t-secondary)">${__('topbar_no_notifications')}</p>`
    });
  },

  showProfile() {
    const state = GL_STATE.getState();
    GL_UI.openModal({
      title: __('profile_title') || 'Team Profile',
      size: 'sm',
      content: `
        <div style="text-align:center;margin-bottom:var(--s-5)">
          <div style="font-size:3.5rem;margin-bottom:var(--s-2)">${state.team.logo}</div>
          <h3 style="font-size:1.6rem;margin:0;color:var(--t-primary)">${state.team.name}</h3>
          <p style="color:var(--t-tertiary);margin:var(--s-1) 0 0;font-size:0.9rem">${state.team.origin || state.team.country} · ${__('division')} ${state.season.division}</p>
        </div>
        <hr style="border:0;border-top:1px solid var(--c-border-hi);margin:var(--s-5) 0"/>
        <p style="color:var(--t-secondary);font-size:0.85rem;margin-bottom:var(--s-4);text-align:center">${__('profile_logout_desc') || 'Log out to reset progress and start a new team.'}</p>
        <button class="btn btn-danger w-full" style="justify-content:center" onclick="GL_APP.logout()">${__('profile_logout') || 'Log Out / Delete Data'}</button>
      `
    });
  },

  logout() {
    GL_UI.confirm(
      __('logout_confirm_title') || 'Log Out?',
      __('logout_confirm_desc') || 'Are you sure you want to log out? All your current team data will be lost forever.',
      __('logout_yes') || 'Yes, Log Out',
      __('logout_no') || 'Cancel'
    ).then(res => {
      if (res) {
        GL_STATE.resetState();
        window.location.reload();
      }
    });
  },

  attachGlobalHandlers() {
    // Keyboard: ESC closes modals
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeFabMenu();
        GL_UI.closeTopModal();
      }
    });
  },

  // ===== FLOATING NAV MENU =====
  buildFabNav() {
    const panel = document.getElementById('fab-nav-panel');
    if (!panel) return;
    const visibleItems = this.NAV_ITEMS.filter(n => !n.hidden);
    panel.innerHTML = visibleItems.map(n => {
      const label = n.labelKey ? __(n.labelKey, n.id) : (n.label || n.id);
      return `<button class="fab-nav-item ${this.currentScreen === n.id ? 'active' : ''}" onclick="GL_APP.fabNavigate('${n.id}')">
        <span class="fab-nav-item-icon">${n.icon}</span>
        <span class="fab-nav-item-label">${label}</span>
      </button>`;
    }).join('');
  },

  toggleFabMenu() {
    const btn = document.getElementById('fab-menu-btn');
    const panel = document.getElementById('fab-nav-panel');
    const overlay = document.getElementById('fab-overlay');
    if (!btn || !panel || !overlay) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      this.closeFabMenu();
    } else {
      this.buildFabNav();
      btn.classList.add('open');
      btn.textContent = '✕';
      panel.classList.add('open');
      overlay.classList.add('open');
    }
  },

  closeFabMenu() {
    const btn = document.getElementById('fab-menu-btn');
    const panel = document.getElementById('fab-nav-panel');
    const overlay = document.getElementById('fab-overlay');
    if (btn) { btn.classList.remove('open'); btn.textContent = '☰'; }
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  fabNavigate(screenId) {
    this.closeFabMenu();
    this.navigateTo(screenId);
  }
};

window.GL_APP = APP;

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  APP.init();
});
