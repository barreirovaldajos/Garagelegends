// ===== APP.JS – Router + initialization =====
'use strict';

const APP = {
  currentScreen: 'dashboard',
  _handlersAttached: false,
  _clockStarted: false,

  renderBootRecovery(error) {
    const host = document.getElementById('onboarding-screen') || document.body;
    const message = error && error.message ? error.message : 'Unknown boot error';
    host.style.display = 'flex';
    host.innerHTML = `
      <div style="min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#090b12,#121826);padding:24px;box-sizing:border-box">
        <div style="max-width:640px;width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:22px;color:#f5f7fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
          <h2 style="margin:0 0 10px;color:#ff8080">No pudimos iniciar el juego</h2>
          <p style="margin:0 0 12px;color:#cbd5e1">Detectamos un problema de arranque en este navegador. Puedes recuperar con un reinicio limpio local.</p>
          <div style="font-family:Consolas,monospace;font-size:12px;line-height:1.5;background:rgba(0,0,0,0.28);padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);word-break:break-word">${message}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button id="boot-recover-btn" style="background:#e8292a;color:#fff;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:700">Limpiar datos locales y reintentar</button>
            <button id="boot-reload-btn" style="background:#1f2937;color:#fff;border:1px solid #334155;border-radius:10px;padding:10px 14px;cursor:pointer">Solo recargar</button>
          </div>
        </div>
      </div>`;

    const recoverBtn = document.getElementById('boot-recover-btn');
    if (recoverBtn) {
      recoverBtn.onclick = () => {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.indexOf('garage_legends_v1') === 0 || k.indexOf('leagues') === 0) {
              localStorage.removeItem(k);
            }
          });
        } catch (_) {}
        window.location.reload();
      };
    }

    const reloadBtn = document.getElementById('boot-reload-btn');
    if (reloadBtn) {
      reloadBtn.onclick = () => window.location.reload();
    }
  },

  NAV_ITEMS: [
    { id:'dashboard', labelKey:'nav_dashboard', icon:'🏠', screen:'dashboard' },
    { id:'mi-equipo', labelKey:'nav_mi_equipo', icon:'🏎️', screen:'mi-equipo' },
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
    { id:'admin',     labelKey:'nav_admin',     icon:'🛡️', screen:'admin', adminOnly:true },
  ],

  init() {
    this.attachGlobalHandlers();
    this.startRealTimeClock();
    this.bootForCurrentSession();
    // Browser back/forward button support
    window.addEventListener('hashchange', () => {
      const hashScreen = location.hash.replace('#', '');
      if (this._validScreenIds.has(hashScreen) && hashScreen !== this.currentScreen) {
        this.navigateTo(hashScreen, { updateHash: false });
      }
    });
  },

  bootForCurrentSession() {
    const loaded = GL_STATE.loadState();
    const authReady = window.GL_AUTH && GL_AUTH.enabled && typeof GL_AUTH.isAuthenticated === 'function' && GL_AUTH.isAuthenticated();
    const syncStatus = authReady && typeof GL_AUTH.getSyncStatus === 'function'
      ? GL_AUTH.getSyncStatus()
      : null;

    if (loaded && GL_STATE.hasOnboarded()) {
      this.showApp();
      GL_ENGINE.catchUpOffline();
      this.buildSidebar();
      this.buildTopbar();
      if (window.GL_DASHBOARD) GL_DASHBOARD.init();
      // Restore screen from URL hash (e.g. #finances) or default to dashboard
      const hashScreen = location.hash.replace('#', '');
      const startScreen = this._validScreenIds.has(hashScreen) ? hashScreen : 'dashboard';
      this.navigateTo(startScreen);
    } else if (authReady && syncStatus && syncStatus.lastError) {
      this.showCloudRecovery(syncStatus);
    } else {
      console.log('App: State not onboarded or missing. Starting onboarding.');
      document.getElementById('app').style.display = 'none';
      this.buildSidebar();
      this.buildTopbar();
      const onboardingEl = document.getElementById('onboarding-screen');
      if (onboardingEl) {
        onboardingEl.style.display = 'flex';
        GL_OB.start();
      }
    }
  },

  showCloudRecovery(syncStatus) {
    const onboardingEl = document.getElementById('onboarding-screen');
    document.getElementById('app').style.display = 'none';
    this.buildSidebar();
    this.buildTopbar();
    if (!onboardingEl) return;
    onboardingEl.style.display = 'flex';
    onboardingEl.innerHTML = `
      <div style="min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(8,10,16,0.98),rgba(15,21,35,0.96));padding:24px;box-sizing:border-box">
        <div style="max-width:680px;width:100%;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;color:var(--t-primary)">
          <div class="screen-eyebrow">${__('finances_cashflow_title', 'Cloud save')}</div>
          <h2 style="margin:6px 0 10px;font-size:1.9rem">${__('profile_cloud_recovery_title', 'We found your account, but could not recover the cloud save.')}</h2>
          <p style="margin:0 0 14px;color:var(--t-secondary);line-height:1.6">${__('profile_cloud_recovery_desc', 'This usually means the cloud sync failed or the remote save could not be loaded. Retry the sync before starting a new team.')}</p>
          <div style="padding:12px 14px;border-radius:12px;background:rgba(232,41,42,0.08);border:1px solid rgba(232,41,42,0.25);color:var(--t-secondary);font-size:0.85rem;word-break:break-word">${syncStatus.lastError || __('profile_cloud_unknown', 'Unknown sync error.')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
            <button class="btn btn-primary" onclick="GL_APP.retryCloudRecovery()">${__('profile_cloud_recovery_retry', 'Retry cloud sync')}</button>
            <button class="btn btn-ghost" onclick="GL_APP.startNewTeamAfterRecovery()">${__('profile_cloud_recovery_continue', 'Continue with a new team')}</button>
          </div>
        </div>
      </div>`;
  },

  async retryCloudRecovery() {
    if (!(window.GL_AUTH && typeof GL_AUTH.refreshRemoteProfile === 'function')) return;
    try {
      const status = await GL_AUTH.refreshRemoteProfile();
      if (status && !status.lastError) {
        this.bootForCurrentSession();
        return;
      }
      GL_UI.toast(status?.lastError || __('profile_cloud_refresh_fail', 'Could not reload the cloud save.'), 'error');
      this.showCloudRecovery(status || { lastError: __('profile_cloud_unknown', 'Unknown sync error.') });
    } catch (e) {
      GL_UI.toast((e && e.message) ? e.message : __('profile_cloud_refresh_fail', 'Could not reload the cloud save.'), 'error');
    }
  },

  startNewTeamAfterRecovery() {
    const onboardingEl = document.getElementById('onboarding-screen');
    if (!onboardingEl) return;
    onboardingEl.style.display = 'flex';
    GL_OB.start();
  },

  resumeAuthenticatedSession() {
    if (window.GL_UI && typeof GL_UI.forceCloseAllModals === 'function') {
      GL_UI.forceCloseAllModals();
    }
    this.closeFabMenu();
    this.bootForCurrentSession();
  },

  startRealTimeClock() {
    if (this._clockStarted) return;
    this._clockStarted = true;
    const updateTime = () => {
      const elTime = document.getElementById('rt-clock-time');
      const elNext = document.getElementById('rt-clock-next');
      if (!elTime || !elNext) return;

      const now = (GL_ENGINE && typeof GL_ENGINE.getNowDate === 'function') ? GL_ENGINE.getNowDate() : new Date();
      // Format time safely
      const formatTime = (d) => d.toLocaleTimeString(GL_I18N.currentLang === 'es' ? 'es-ES' : 'en-US', {weekday: 'short', hour: '2-digit', minute:'2-digit'});
      elTime.textContent = formatTime(now).toUpperCase();

      const nextRaceObj = GL_ENGINE.getNextRaceDate();
      const nextRace = nextRaceObj.date;
      
      const diffMs = nextRace.getTime() - now.getTime();
      
      // If time arrived, simulate!
      if (diffMs <= 0) {
        if (window._raceInProgress || APP.currentScreen === 'race') {
          elNext.textContent = `${window.__('next_race_lbl', 'PRÓX. CARRERA')}: LIVE`;
          return;
        }
         GL_ENGINE.catchUpOffline();
         if (window.GL_DASHBOARD) GL_DASHBOARD.init();
         return;
      }
      
      // Check active HQ construction
      if (GL_ENGINE.updateConstructionQueue()) {
         if (APP.currentScreen === 'garage' && window.GL_SCREENS) window.GL_SCREENS.renderGarage();
        if (window.GL_DASHBOARD) GL_DASHBOARD.updateTopbar(GL_STATE.getState());
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
      
      elNext.textContent = `${window.__('next_race_lbl', 'PRÓX. CARRERA')}: ${countdown}`;
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
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    const unreadCount = notifications.filter((n) => !n.read).length;
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
        <div class="rt-clock-next" id="rt-clock-next">${window.__ ? window.__('next_race_lbl', 'PRÓX. CARRERA') : 'PRÓX. CARRERA'}: --:--</div>
      </div>
      <div class="topbar-actions">
        <div class="topbar-credits" title="Credits" onclick="GL_APP.navigateTo('finances')">
          <span class="topbar-credits-icon">💰</span>
          <span class="topbar-credits-val" id="topbar-credits-val">${GL_UI.fmtCR(state.finances.credits||0)}</span>
        </div>
        <div class="topbar-fans" title="Fans">
          <span class="topbar-fans-icon">👥</span>
          <span class="topbar-fans-val" id="topbar-fans-val">${GL_UI.fmtCR(state.team.fans||0)}</span>
        </div>
        <div class="topbar-tokens" title="Tokens">
          <span class="topbar-tokens-icon">🪙</span>
          <span class="topbar-tokens-val" id="topbar-tokens-val">${state.finances.tokens||0}</span>
        </div>
        <div class="topbar-notif" title="Notifications" onclick="GL_APP.showNotifications()">
          🔔
          <div class="notif-dot" id="topbar-notif-dot" style="display:${unreadCount > 0 ? 'block' : 'none'}"></div>
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
    const isAdmin = window.GL_AUTH && GL_AUTH.isAdmin();
    const visibleItems = this.NAV_ITEMS.filter(n => !n.hidden && !n.adminOnly);
    const adminItems = isAdmin ? this.NAV_ITEMS.filter(n => n.adminOnly) : [];
    sidebar.innerHTML = `
      <div class="sidebar-section-label">${__('nav_main')}</div>
      ${visibleItems.slice(0,2).map(n => this.navItemHTML(n)).join('')}
      <div class="sidebar-section-label">${__('nav_team')}</div>
      ${visibleItems.slice(2,6).map(n => this.navItemHTML(n)).join('')}
      <div class="sidebar-section-label">${__('nav_season')}</div>
      ${visibleItems.slice(6).map(n => this.navItemHTML(n)).join('')}
      ${adminItems.length ? `<div class="sidebar-section-label">${__('nav_admin_section')}</div>
      ${adminItems.map(n => this.navItemHTML(n)).join('')}` : ''}
      <div class="sidebar-divider"></div>
      <div class="sidebar-footer">
        <div class="sidebar-team-info">
          <div class="sidebar-team-logo" id="sidebar-team-logo" style="background:${state.team.colors.primary}22">${state.team.logo||'🏎️'}</div>
          <div>
            <div class="sidebar-team-name" id="sidebar-team-name">${state.team.name||'Your Team'}</div>
            <div class="sidebar-team-div" id="sidebar-team-div">${__('division')} ${(window.GL_AUTH && GL_AUTH.mp && GL_AUTH.mp.division) ? (typeof Divisions !== 'undefined' && Divisions.divisionLabel ? Divisions.divisionLabel(GL_AUTH.mp.division, GL_AUTH.mp.divisionGroup) : GL_AUTH.mp.division) : state.season.division}</div>
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

  _validScreenIds: new Set(['dashboard','mi-equipo','garage','pilots','staff','car','calendar','standings','finances','market','prerace','race','liverace','postrace','admin']),

  navigateTo(screenId, { updateHash = true } = {}) {
    if (!this._validScreenIds.has(screenId)) screenId = 'dashboard';
    if (this.currentScreen === 'liverace' && screenId !== 'liverace' && window.GL_SCREENS && GL_SCREENS.cleanupLiveRace) {
      GL_SCREENS.cleanupLiveRace();
    }
    this.currentScreen = screenId;

    // Update URL hash so F5 restores the same screen
    if (updateHash && location.hash !== `#${screenId}`) {
      history.pushState(null, '', `#${screenId}`);
    }

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
      dashboard:  () => GL_DASHBOARD.refresh(),
      'mi-equipo':() => { if (window.GL_TEAM_PROFILE) GL_TEAM_PROFILE.renderMyTeam(); },
      garage:     () => GL_SCREENS.renderGarage(),
      pilots:     () => GL_SCREENS.renderPilots(),
      staff:      () => GL_SCREENS.renderStaff(),
      car:        () => GL_SCREENS.renderCar(),
      calendar:   () => GL_SCREENS.renderCalendar(),
      standings:  () => GL_SCREENS.renderStandings(),
      finances:   () => GL_SCREENS.renderFinances(),
      market:     () => GL_SCREENS.renderMarket(),
      prerace:    () => GL_SCREENS.renderPreRace(),
      race:       () => GL_SCREENS.renderRace(),
      liverace:   () => GL_SCREENS.renderLiveRace(),
      postrace:   () => GL_SCREENS.renderPostRace(),
      admin:      () => { if (window.GL_ADMIN) GL_ADMIN.renderAdminPanel(); },
    };
    if (renderMap[screenId]) renderMap[screenId]();

    // Scroll main to top
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  },

  showNotifications() {
    const notes = GL_STATE.getNotifications ? GL_STATE.getNotifications() : [];
    GL_UI.openModal({
      title: __('topbar_notifications_title'),
      content: notes.length ? `<div style="display:flex;flex-direction:column;gap:8px">
        ${notes.slice(0,15).map(n => {
          const icon = n.type === 'good' ? '✅' : n.type === 'bad' ? '❌' : n.type === 'warning' ? '⚠️' : 'ℹ️';
          return `<div style="display:flex;gap:12px;padding:10px;background:var(--c-surface-2);border-radius:8px;font-size:0.82rem">
            <span>${icon}</span><div style="flex:1;color:var(--t-secondary)">${n.text}</div>
            <span style="font-size:0.72rem;color:var(--t-tertiary);flex-shrink:0">${__('topbar_week')} ${n.week}</span>
          </div>`;
        }).join('')}
      </div>` : `<p style="color:var(--t-secondary)">${__('topbar_no_notifications')}</p>`
    });

    if (GL_STATE.markNotificationsRead) {
      GL_STATE.markNotificationsRead();
      if (window.GL_DASHBOARD && typeof GL_DASHBOARD.updateTopbar === 'function') {
        GL_DASHBOARD.updateTopbar(GL_STATE.getState());
      }
    }
  },

  showProfile() {
    const state = GL_STATE.getState();
    const authEnabled = window.GL_AUTH && GL_AUTH.enabled;
    const authEmail = authEnabled ? (GL_AUTH.getUserEmail() || 'unknown') : '';
    const authRole = authEnabled ? (GL_AUTH.getRole() || 'player') : '';
    const syncStatus = authEnabled && typeof GL_AUTH.getSyncStatus === 'function'
      ? GL_AUTH.getSyncStatus()
      : null;
    const syncLabel = !syncStatus
      ? ''
      : syncStatus.pending
        ? __('profile_cloud_pending', 'Sync in progress')
        : syncStatus.lastError
          ? __('profile_cloud_error', 'Sync error')
          : syncStatus.hasRemoteSave
            ? __('profile_cloud_synced', 'Cloud save synced')
            : __('profile_cloud_empty', 'No cloud save detected yet');
    const syncColor = !syncStatus
      ? 'var(--t-secondary)'
      : syncStatus.pending
        ? 'var(--c-gold)'
        : syncStatus.lastError
          ? 'var(--c-red)'
          : syncStatus.hasRemoteSave
            ? 'var(--c-green)'
            : 'var(--t-secondary)';
    const syncDate = syncStatus && (syncStatus.remoteUpdatedAt || syncStatus.lastSyncAt)
      ? new Date(syncStatus.remoteUpdatedAt || syncStatus.lastSyncAt).toLocaleString()
      : '—';
    GL_UI.openModal({
      title: __('profile_title') || 'Team Profile',
      size: 'sm',
      content: `
        <div style="text-align:center;margin-bottom:var(--s-5)">
          <div style="font-size:3.5rem;margin-bottom:var(--s-2)">${state.team.logo}</div>
          <h3 style="font-size:1.6rem;margin:0;color:var(--t-primary)">${state.team.name}</h3>
          <p style="color:var(--t-tertiary);margin:var(--s-1) 0 0;font-size:0.9rem">${state.team.origin || state.team.country} · ${__('division')} ${(window.GL_AUTH && GL_AUTH.mp && GL_AUTH.mp.division) ? (typeof Divisions !== 'undefined' && Divisions.divisionLabel ? Divisions.divisionLabel(GL_AUTH.mp.division, GL_AUTH.mp.divisionGroup) : GL_AUTH.mp.division) : state.season.division}</p>
        </div>
        ${authEnabled ? `<div style="margin:0 0 var(--s-4);padding:10px;border-radius:10px;background:var(--c-surface-2);border:1px solid var(--c-border);font-size:0.8rem;color:var(--t-secondary)">
          <div style="margin-bottom:4px"><strong style="color:var(--t-primary)">${__('profile_account_label', 'Account')}:</strong> ${authEmail}</div>
          <div style="margin-bottom:4px"><strong style="color:var(--t-primary)">${__('profile_role_label', 'Role')}:</strong> ${authRole}</div>
          <div style="margin-bottom:4px"><strong style="color:var(--t-primary)">${__('profile_cloud_status', 'Cloud save')}:</strong> <span style="color:${syncColor}">${syncLabel}</span></div>
          <div style="margin-bottom:${syncStatus?.lastError ? '4px' : '0'}"><strong style="color:var(--t-primary)">${__('profile_cloud_last_sync', 'Last cloud update')}:</strong> ${syncDate}</div>
          ${syncStatus?.lastError ? `<div style="margin-top:6px;color:var(--c-red)"><strong>${__('profile_cloud_error_label', 'Error')}:</strong> ${syncStatus.lastError}</div>` : ''}
        </div>` : ''}
        <hr style="border:0;border-top:1px solid var(--c-border-hi);margin:var(--s-5) 0"/>
        <p style="color:var(--t-secondary);font-size:0.85rem;margin-bottom:var(--s-4);text-align:center">${__('profile_logout_desc') || 'Session logout and local reset are separate actions.'}</p>
        ${authEnabled ? `<button class="btn btn-primary w-full" style="justify-content:center;margin-bottom:10px" onclick="GL_APP.forceCloudSync()">${__('profile_cloud_force_sync', 'Force cloud sync')}</button>` : ''}
        ${authEnabled ? `<button class="btn btn-ghost w-full" style="justify-content:center;margin-bottom:10px" onclick="GL_APP.refreshCloudProfile()">${__('profile_cloud_retry', 'Reload cloud save')}</button>` : ''}
        ${authEnabled ? `<button class="btn btn-secondary w-full" style="justify-content:center;margin-bottom:10px" onclick="GL_APP.sessionLogout()">Sign out account session</button>` : ''}
        <button class="btn btn-danger w-full" style="justify-content:center" onclick="GL_APP.logout()">Reset team data</button>
      `
    });
  },

  reopenProfileModal() {
    if (window.GL_UI && typeof GL_UI.closeTopModal === 'function') {
      GL_UI.closeTopModal();
    }
    window.setTimeout(() => {
      this.showProfile();
    }, 220);
  },

  async forceCloudSync() {
    if (!(window.GL_AUTH && typeof GL_AUTH.forceSyncCurrentState === 'function')) return;
    try {
      const status = await GL_AUTH.forceSyncCurrentState();
      if (status?.lastError) {
        GL_UI.toast(status.lastError, 'error');
      } else {
        GL_UI.toast(__('profile_cloud_sync_ok', 'Cloud save synchronized.'), 'good');
      }
      this.reopenProfileModal();
    } catch (e) {
      GL_UI.toast((e && e.message) ? e.message : __('profile_cloud_sync_fail', 'Could not synchronize the cloud save.'), 'error');
    }
  },

  async refreshCloudProfile() {
    if (!(window.GL_AUTH && typeof GL_AUTH.refreshRemoteProfile === 'function')) return;
    try {
      const status = await GL_AUTH.refreshRemoteProfile();
      if (status?.lastError) {
        GL_UI.toast(status.lastError, 'error');
      } else {
        GL_UI.toast(__('profile_cloud_refresh_ok', 'Cloud save reloaded.'), 'good');
      }
      this.bootForCurrentSession();
      this.reopenProfileModal();
    } catch (e) {
      GL_UI.toast((e && e.message) ? e.message : __('profile_cloud_refresh_fail', 'Could not reload the cloud save.'), 'error');
    }
  },

  async sessionLogout() {
    if (!(window.GL_AUTH && GL_AUTH.enabled)) return;
    const ok = await GL_UI.confirm(
      'Sign out?',
      'This signs out your account session but keeps local save data for this account.',
      'Sign out',
      'Cancel'
    );
    if (!ok) return;
    try {
      if (window.GL_UI && typeof GL_UI.forceCloseAllModals === 'function') {
        GL_UI.forceCloseAllModals();
      }
      if (window.GL_STATE && typeof GL_STATE.saveState === 'function') {
        GL_STATE.saveState();
      }
      await GL_AUTH.signOut();
    } catch (e) {
      GL_UI.toast((e && e.message) ? e.message : 'Could not sign out.', 'error');
    }
  },

  async logout() {
    const res = await GL_UI.confirm(
      __('logout_confirm_title') || 'Reset team data?',
      __('logout_confirm_desc') || 'This deletes the saved team progress for the current account.',
      __('logout_yes') || 'Yes, reset team',
      __('logout_no') || 'Cancel'
    );
    if (!res) return;
    try {
      await GL_STATE.resetState();
      window.location.reload();
    } catch (e) {
      GL_UI.toast((e && e.message) ? e.message : 'Could not reset account data.', 'error');
    }
  },

  attachGlobalHandlers() {
    if (this._handlersAttached) return;
    this._handlersAttached = true;
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
  try {
    if (window.GL_AUTH && typeof GL_AUTH.init === 'function') {
      GL_AUTH.init({
        onReady: () => APP.init()
      });
    } else {
      APP.init();
    }
  } catch (e) {
    console.error('App boot failed:', e);
    APP.renderBootRecovery(e);
  }
});
