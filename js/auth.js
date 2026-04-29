// ===== AUTH.JS - Firebase auth gate =====
// Drop-in replacement for the Supabase version.
// Public API (window.GL_AUTH) is identical.
'use strict';

(function () {
  const AUTH = {
    enabled: false,
    _auth: null,
    _db: null,
    user: null,
    role: 'player',
    profile: null,
    mp: null,
    remoteSave: null,
    remoteSaveUpdatedAt: 0,
    storageKeySuffix: '',
    readyFired: false,
    readyCallback: null,
    savePromise: null,
    pendingRemoteSave: null,
    lifecycleBound: false,
    syncStatus: 'idle',
    lastSyncAt: 0,
    lastSyncError: '',
    lastSyncErrorAt: 0,
    lastProfileLoadAt: 0,
    _unsubscribeAuth: null,

    // Auto-logout after 1h of inactivity
    _inactivityMs: 60 * 60 * 1000,
    _inactivityTimer: null,
    _inactivityHandlers: null,
    _inactivityLastReset: 0,

    isConfigured() {
      return Boolean(
        window.GL_FIREBASE_CONFIG &&
        window.GL_FIREBASE_CONFIG.apiKey &&
        typeof firebase !== 'undefined' &&
        firebase.app
      );
    },

    async init({ onReady } = {}) {
      this.readyCallback = onReady;
      if (!this.isConfigured()) { this.enabled = false; this.fireReady(); return; }
      this.enabled = true;
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(window.GL_FIREBASE_CONFIG);
      this._auth = firebase.auth();
      this._db   = firebase.firestore();
      this.bindLifecyclePersistence();
      await new Promise(resolve => {
        const unsub = this._auth.onAuthStateChanged(async user => {
          unsub();
          if (user) { await this.adoptUser(user); this.hideGate(); this._startInactivityTracking(); }
          else { this.renderGate(); }
          this.fireReady();
          resolve();
        });
      });
      this._unsubscribeAuth = this._auth.onAuthStateChanged(async user => {
        if (user) {
          if (this.user && this.user.uid === user.uid && this.readyFired) { this.user = user; return; }
          await this.adoptUser(user);
          this.hideGate();
          this._startInactivityTracking();
          if (this.readyFired && window.GL_APP && typeof GL_APP.resumeAuthenticatedSession === 'function') {
            GL_APP.resumeAuthenticatedSession();
          }
        } else {
          this._stopInactivityTracking();
          this.user = null; this.profile = null; this.role = 'player';
          this.mp = null; this.remoteSave = null; this.remoteSaveUpdatedAt = 0;
          this.storageKeySuffix = ''; this.pendingRemoteSave = null;
          this.renderGate();
        }
      });
    },

    async adoptUser(user) { this.user = user; this.storageKeySuffix = user.uid; await this.ensureProfile(); },

    async ensureProfile() {
      if (!this._db || !this.user) return;
      const ref = this._db.collection('profiles').doc(this.user.uid);
      try {
        const snap = await ref.get();
        if (snap.exists) {
          // Profile exists — update email only, never overwrite role
          const data = snap.data();
          if ((data.email || '') !== (this.user.email || '')) {
            await ref.update({ email: this.user.email || '' });
          }
          // Apply any pending MP rewards (credits, fans) before loading state.
          // These fields live outside save_data so SP saves cannot overwrite them.
          // Pending MP rewards are applied via _applyMpPending (also called by onSnapshot listener).
          // Pre-apply to data.save_data so state loads with correct values immediately.
          const pendingCredits    = (data.mp && data.mp.pendingCredits)    || 0;
          const pendingFans       = (data.mp && data.mp.pendingFans)       || 0;
          const pendingRaceResult = (data.mp && data.mp.pendingRaceResult) || null;
          const _revealAt = data.mp && data.mp.rewardsRevealAt;
          const _revealMs = _revealAt
            ? (typeof _revealAt.toMillis === 'function' ? _revealAt.toMillis() : (typeof _revealAt.seconds === 'number' ? _revealAt.seconds * 1000 + Math.floor((_revealAt.nanoseconds || 0) / 1e6) : Number(_revealAt) || 0))
            : 0;
          const _rewardsReady = !_revealMs || _revealMs <= Date.now();
          if (_rewardsReady && (pendingCredits > 0 || pendingFans > 0 || pendingRaceResult) && data.save_data) {
            const sd = data.save_data;
            if (pendingCredits > 0) { if (!sd.finances) sd.finances = {}; sd.finances.credits = (sd.finances.credits || 0) + pendingCredits; }
            if (pendingFans    > 0) { if (!sd.team)     sd.team     = {}; sd.team.fans         = (sd.team.fans     || 0) + pendingFans; }
            if (pendingRaceResult) {
              if (!Array.isArray(sd.raceResults)) sd.raceResults = [];
              if (!sd.raceResults.find(r => r.round === pendingRaceResult.round && r.ts === pendingRaceResult.ts))
                sd.raceResults.push(pendingRaceResult);
            }
            if (!sd.meta) sd.meta = {};
            sd.meta.saveTime = Date.now();
            data.mp = Object.assign({}, data.mp, { pendingCredits: 0, pendingFans: 0, pendingRaceResult: null });
          }
          this.profile = data;
          this.role = data.role || 'player';
          this.mp = data.mp || null;
          this.remoteSave = data.save_data || null;
          this.remoteSaveUpdatedAt = this.getSaveTimestamp(
            data.save_data,
            data.save_updated_at ? data.save_updated_at.toMillis() : 0
          );
        } else {
          // New profile — set role to player
          const newProfile = { email: this.user.email || '', role: 'player' };
          await ref.set(newProfile);
          this.profile = newProfile;
          this.role = 'player';
          this.remoteSave = null;
          this.remoteSaveUpdatedAt = 0;
        }
        this.lastProfileLoadAt = Date.now();
        this.syncStatus = this.remoteSave ? 'synced' : 'ready';
        this.lastSyncError = ''; this.lastSyncErrorAt = 0;
        // Start real-time listener for MP rewards (applied without requiring page reload)
        if (!this._mpRewardsListener) this._startMpRewardsListener(ref);
      } catch (e) {
        this.syncStatus = 'error'; this.lastSyncError = e.message || String(e);
        this.lastSyncErrorAt = Date.now();
        console.warn('Profile load warning:', this.lastSyncError);
      }
    },

    _applyMpPending(data, profileRef) {
      const pendingCredits    = (data.mp && data.mp.pendingCredits)    || 0;
      const pendingFans       = (data.mp && data.mp.pendingFans)       || 0;
      const pendingRaceResult = (data.mp && data.mp.pendingRaceResult) || null;
      if (pendingCredits <= 0 && pendingFans <= 0 && !pendingRaceResult) return false;

      // Bloquea la aplicación de resultados hasta que termine la carrera en vivo
      const revealAt = data.mp && data.mp.rewardsRevealAt;
      if (revealAt) {
        const revealMs = typeof revealAt.toMillis === 'function'
          ? revealAt.toMillis()
          : (typeof revealAt.seconds === 'number' ? revealAt.seconds * 1000 + Math.floor((revealAt.nanoseconds || 0) / 1e6) : Number(revealAt) || 0);
        const remaining = revealMs - Date.now();
        if (remaining > 0) {
          setTimeout(() => this._applyMpPending(data, profileRef), remaining + 500);
          return false;
        }
      }

      const state = window.GL_STATE && GL_STATE.getState && GL_STATE.getState();
      if (!state) return false;

      if (pendingCredits > 0 && state.finances) {
        state.finances.credits = (state.finances.credits || 0) + pendingCredits;
      }
      if (pendingFans > 0 && state.team) {
        state.team.fans = (state.team.fans || 0) + pendingFans;
      }
      if (pendingRaceResult) {
        if (!Array.isArray(state.raceResults)) state.raceResults = [];
        // Avoid duplicates by round+ts
        if (!state.raceResults.find(r => r.round === pendingRaceResult.round && r.ts === pendingRaceResult.ts)) {
          state.raceResults.push(pendingRaceResult);
        }
        // Update lastRaceSettlement for finance panel
        if (!state.finances) state.finances = {};
        state.finances.lastRaceSettlement = { prizeDelta: pendingRaceResult.prizeMoney, week: pendingRaceResult.round };
        // Award I+D points (once per round)
        const _rndRound = pendingRaceResult.round;
        if (!state.car) state.car = {};
        if (!state.car.rnd) state.car.rnd = { points: 0, active: null, queue: [] };
        if (!state.car.rnd.lastAwardedRound || state.car.rnd.lastAwardedRound < _rndRound) {
          const _pos = Number(pendingRaceResult.position) || 99;
          const _base = _pos === 1 ? 10 : _pos === 2 ? 8 : _pos === 3 ? 6 : _pos <= 10 ? 3 : _pos <= 20 ? 1 : 0;
          const _lv = (state.hq && state.hq.rnd) ? Number(state.hq.rnd) : 1;
          const _bonus = Math.max(0, _lv - 1);
          const _earned = _base > 0 ? _base + _bonus : 0;
          state.car.rnd.lastAwardedRound = _rndRound;
          if (_earned > 0) {
            state.car.rnd.points = (state.car.rnd.points || 0) + _earned;
            if (window.GL_STATE && GL_STATE.addLog) {
              const _msg = _bonus > 0
                ? `🔬 +${_earned} pts de I+D (P${_pos}, +${_bonus} bonus I+D Lv${_lv})`
                : `🔬 +${_earned} pts de I+D (P${_pos})`;
              GL_STATE.addLog(_msg, 'good');
            }
          }
        }
        // Decrement sponsor/staff contract durations (1 race = 1 week in MP)
        if (window.GL_ENGINE && GL_ENGINE.processWeeklyAgreements) {
          GL_ENGINE.processWeeklyAgreements(state);
        } else if (state.sponsors) {
          // Fallback: decrement weeksLeft directly
          state.sponsors.forEach(sp => {
            if (typeof sp.weeksLeft === 'number') sp.weeksLeft = Math.max(0, sp.weeksLeft - 1);
          });
        }
      }

      const sd = JSON.parse(JSON.stringify(state));
      if (!sd.meta) sd.meta = {};
      sd.meta.saveTime = Date.now();
      const fsUpdates = {
        save_data: sd,
        save_updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (pendingCredits    > 0) fsUpdates['mp.pendingCredits']    = firebase.firestore.FieldValue.delete();
      if (pendingFans       > 0) fsUpdates['mp.pendingFans']       = firebase.firestore.FieldValue.delete();
      if (pendingRaceResult)     fsUpdates['mp.pendingRaceResult'] = firebase.firestore.FieldValue.delete();
      fsUpdates['mp.rewardsRevealAt'] = firebase.firestore.FieldValue.delete();
      profileRef.update(fsUpdates).then(() => {
        this.remoteSave = sd;
        this.remoteSaveUpdatedAt = sd.meta.saveTime;
        if (window.GL_DASHBOARD && GL_DASHBOARD.renderTopbar) GL_DASHBOARD.renderTopbar(state);
        else if (window.GL_APP && GL_APP.refreshTopbar) GL_APP.refreshTopbar();
      }).catch(e => console.warn('Failed to apply MP rewards:', e));
      return true;
    },

    _startMpRewardsListener(profileRef) {
      this._mpRewardsListener = profileRef.onSnapshot(snap => {
        if (!snap.exists || !this.user) return;
        this._applyMpPending(snap.data(), profileRef);
      });
    },

    getSaveTimestamp(snapshot, fallbackValue) {
      const snapshotTs = snapshot && snapshot.meta && typeof snapshot.meta.saveTime === 'number'
        ? snapshot.meta.saveTime : 0;
      if (snapshotTs > 0) return snapshotTs;
      const fallbackTs = typeof fallbackValue === 'number'
        ? fallbackValue : new Date(fallbackValue || 0).getTime();
      return Number.isFinite(fallbackTs) ? fallbackTs : 0;
    },

    getStorageKeySuffix() { return this.storageKeySuffix || ''; },
    getStorageKeyAliases() {
      const aliases = [];
      if (this.storageKeySuffix) aliases.push(this.storageKeySuffix);
      const email = this.getUserEmail();
      if (email) aliases.push('email_' + String(email).toLowerCase().replace(/[^a-z0-9_-]/g, '_'));
      return Array.from(new Set(aliases.filter(Boolean)));
    },
    getRemoteSaveSnapshot() { return this.remoteSave ? JSON.parse(JSON.stringify(this.remoteSave)) : null; },
    getRemoteSaveInfo() { return { snapshot: this.getRemoteSaveSnapshot(), updatedAt: this.remoteSaveUpdatedAt || 0 }; },

    saveRemoteStateSnapshot(state) {
      if (!this._db || !this.user || !state) return Promise.resolve();
      const snapshot  = JSON.parse(JSON.stringify(state));
      const updatedAt = this.getSaveTimestamp(snapshot, Date.now());
      this.syncStatus = 'pending'; this.lastSyncError = ''; this.lastSyncErrorAt = 0;
      this.remoteSave = snapshot;
      this.remoteSaveUpdatedAt = Math.max(this.remoteSaveUpdatedAt || 0, updatedAt);
      this.pendingRemoteSave = { snapshot, updatedAt, userId: this.user.uid };
      if (!this.savePromise) this.savePromise = this.drainRemoteSaveQueue();
      return this.savePromise;
    },

    async drainRemoteSaveQueue() {
      while (this.pendingRemoteSave) {
        const pending = this.pendingRemoteSave;
        this.pendingRemoteSave = null;
        try {
          await this._db.collection('profiles').doc(pending.userId).update({
            save_data: pending.snapshot,
            save_updated_at: firebase.firestore.Timestamp.fromMillis(pending.updatedAt || Date.now()),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (this.user && this.user.uid === pending.userId) {
            this.remoteSave = pending.snapshot;
            this.remoteSaveUpdatedAt = Math.max(this.remoteSaveUpdatedAt || 0, pending.updatedAt || 0);
            this.lastSyncAt = Date.now(); this.syncStatus = 'synced';
            this.lastSyncError = ''; this.lastSyncErrorAt = 0;
          }
        } catch (e) {
          this.syncStatus = 'error'; this.lastSyncError = e.message || String(e);
          this.lastSyncErrorAt = Date.now();
          console.warn('Remote save warning:', this.lastSyncError);
        }
      }
      this.savePromise = null;
    },

    async clearRemoteStateSnapshot() {
      this.remoteSave = null; this.remoteSaveUpdatedAt = Date.now();
      await this.flushRemoteStateSnapshot();
      if (!this._db || !this.user) return;
      try {
        await this._db.collection('profiles').doc(this.user.uid).update({
          save_data: firebase.firestore.FieldValue.delete(),
          save_updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) { console.warn('Remote save clear warning:', e.message || e); }
    },

    async flushRemoteStateSnapshot() { if (this.savePromise) await this.savePromise; },

    getSyncStatus() {
      return {
        status: this.syncStatus || 'idle', lastSyncAt: this.lastSyncAt || 0,
        lastProfileLoadAt: this.lastProfileLoadAt || 0, lastError: this.lastSyncError || '',
        lastErrorAt: this.lastSyncErrorAt || 0, pending: Boolean(this.pendingRemoteSave || this.savePromise),
        hasRemoteSave: Boolean(this.remoteSave), remoteUpdatedAt: this.remoteSaveUpdatedAt || 0
      };
    },

    async refreshRemoteProfile() {
      if (!this._db || !this.user) return this.getSyncStatus();
      await this.ensureProfile(); return this.getSyncStatus();
    },

    async forceSyncCurrentState() {
      if (!(this._db && this.user && window.GL_STATE && typeof GL_STATE.saveState === 'function')) return this.getSyncStatus();
      GL_STATE.saveState(); await this.flushRemoteStateSnapshot(); return this.getSyncStatus();
    },

    bindLifecyclePersistence() {
      if (this.lifecycleBound || typeof window === 'undefined') return;
      this.lifecycleBound = true;
      const persist = () => {
        if (window.GL_STATE && typeof GL_STATE.saveState === 'function' && this.isAuthenticated()) {
          try { GL_STATE.saveState(); } catch (_) {}
        }
        this.flushRemoteStateSnapshot().catch(() => {});
      };
      window.addEventListener('pagehide', persist);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
    },

    isAuthenticated() { return Boolean(this.user && this.user.uid); },
    isAdmin()         { return this.role === 'admin'; },
    getUserEmail()    { return this.user && this.user.email ? this.user.email : ''; },
    getUserId()       { return this.user && this.user.uid  ? this.user.uid  : ''; },
    getRole()         { return this.role || 'player'; },

    async signOut() {
      if (!this._auth) return;
      await this.flushRemoteStateSnapshot();
      await this._auth.signOut();
    },

    gateElement() { return document.getElementById('auth-gate'); },
    hideGate()    { const g = this.gateElement(); if (g) g.remove(); this._closeAuthModal(); },
    fireReady()   { if (this.readyFired) return; this.readyFired = true; if (typeof this.readyCallback === 'function') this.readyCallback(); },

    renderGate() {
      this.hideGate();
      document.getElementById('app').style.display = 'none';
      const onboarding = document.getElementById('onboarding-screen');
      if (onboarding) onboarding.style.display = 'none';

      const gate = document.createElement('div');
      gate.id = 'auth-gate';
      gate.className = 'auth-gate auth-landing-gate';
      gate.innerHTML = this._landingHTML();
      document.body.appendChild(gate);

      gate.querySelector('#auth-cta-login').addEventListener('click', () => this._openLoginModal());
      gate.querySelector('#auth-cta-signup').addEventListener('click', () => this._openSignupModal());
      const loginTop = gate.querySelector('#auth-cta-login-top');
      if (loginTop) loginTop.addEventListener('click', () => this._openLoginModal());
      const langBtn = gate.querySelector('#auth-lang-toggle');
      if (langBtn) langBtn.addEventListener('click', () => this._toggleLandingLang());

      // ESC closes any open auth modal
      if (!this._authEscBound) {
        this._authEscBound = true;
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && document.getElementById('auth-modal-overlay')) this._closeAuthModal();
        });
      }
    },

    _toggleLandingLang() {
      if (window.GL_I18N) {
        const next = (GL_I18N.lang === 'es') ? 'en' : 'es';
        GL_I18N.lang = next;
        try { localStorage.setItem('gl_lang', next); } catch (_) {}
      }
      // Re-render the gate with the new language; close any open modal
      this._closeAuthModal();
      this.renderGate();
    },

    _t(key, fallback) {
      return (typeof window.__ === 'function') ? window.__(key, fallback) : (fallback || key);
    },

    _landingHTML() {
      const t = (k, fb) => this._t(k, fb);
      const curLang = (window.GL_I18N && GL_I18N.lang) || 'es';
      const langLabel = curLang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES';
      return ''
        + '<div class="auth-landing">'
        +   '<div class="auth-landing-bg" aria-hidden="true"></div>'
        +   '<header class="auth-landing-topbar">'
        +     '<div class="auth-brand">'
        +       '<span class="auth-brand-mark">🏎️</span>'
        +       '<span class="auth-brand-name">' + t('auth_brand', 'Garage Legends') + '</span>'
        +     '</div>'
        +     '<div class="auth-topbar-actions">'
        +       '<button class="auth-btn auth-btn-ghost auth-lang-btn" id="auth-lang-toggle" type="button" aria-label="Change language">' + langLabel + '</button>'
        +       '<button class="auth-btn auth-btn-ghost" id="auth-cta-login-top" type="button">' + t('auth_btn_login', 'Login') + '</button>'
        +     '</div>'
        +   '</header>'
        +   '<section class="auth-hero">'
        +     '<div class="auth-hero-eyebrow">' + t('auth_eyebrow', 'Motorsport Management · Closed Beta') + '</div>'
        +     '<h1 class="auth-hero-title">' + t('auth_title_html', 'Build a racing team<br/>from the <span class="auth-hero-accent">garage</span> to the top.') + '</h1>'
        +     '<p class="auth-hero-tagline">' + t('auth_tagline', '') + '</p>'
        +     '<div class="auth-cta-row">'
        +       '<button class="auth-btn auth-btn-primary" id="auth-cta-login" type="button">' + t('auth_btn_login', 'Login') + '</button>'
        +       '<button class="auth-btn auth-btn-secondary" id="auth-cta-signup" type="button">' + t('auth_btn_signup', 'Sign up') + '</button>'
        +     '</div>'
        +     '<div class="auth-hero-meta">' + t('auth_meta', '') + '</div>'
        +   '</section>'
        +   '<section class="auth-features">'
        +     '<div class="auth-feature"><div class="auth-feature-icon">🧑‍✈️</div><div class="auth-feature-title">' + t('auth_feat1_title', 'Pilots & Staff') + '</div><div class="auth-feature-desc">' + t('auth_feat1_desc', '') + '</div></div>'
        +     '<div class="auth-feature"><div class="auth-feature-icon">⚙️</div><div class="auth-feature-title">' + t('auth_feat2_title', 'Car Development') + '</div><div class="auth-feature-desc">' + t('auth_feat2_desc', '') + '</div></div>'
        +     '<div class="auth-feature"><div class="auth-feature-icon">💰</div><div class="auth-feature-title">' + t('auth_feat3_title', 'Sponsors & Finances') + '</div><div class="auth-feature-desc">' + t('auth_feat3_desc', '') + '</div></div>'
        +     '<div class="auth-feature"><div class="auth-feature-icon">🏆</div><div class="auth-feature-title">' + t('auth_feat4_title', 'Live Multiplayer') + '</div><div class="auth-feature-desc">' + t('auth_feat4_desc', '') + '</div></div>'
        +   '</section>'
        + '</div>';
    },

    _openLoginModal() {
      this._closeAuthModal();
      const t = (k, fb) => this._t(k, fb);
      const overlay = document.createElement('div');
      overlay.id = 'auth-modal-overlay';
      overlay.className = 'auth-modal-overlay';
      overlay.innerHTML = ''
        + '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">'
        +   '<button class="auth-modal-close" type="button" aria-label="Close">✕</button>'
        +   '<h2 class="auth-modal-title" id="auth-modal-title">' + t('auth_modal_login_title', 'Log in') + '</h2>'
        +   '<p class="auth-modal-subtitle">' + t('auth_modal_login_subtitle', '') + '</p>'
        +   '<form class="auth-form" id="auth-form">'
        +     '<label class="auth-label" for="auth-email">' + t('auth_form_email', 'Email') + '</label>'
        +     '<input class="auth-input" id="auth-email" type="email" required autocomplete="email" />'
        +     '<label class="auth-label" for="auth-password">' + t('auth_form_password', 'Password') + '</label>'
        +     '<input class="auth-input" id="auth-password" type="password" required autocomplete="current-password" minlength="6" />'
        +     '<div class="auth-row">'
        +       '<button class="auth-btn auth-btn-primary" id="auth-submit" type="submit" style="flex:1;justify-content:center">' + t('auth_form_login', 'Login') + '</button>'
        +       '<button class="auth-btn auth-btn-ghost" id="auth-reset" type="button">' + t('auth_form_reset', 'Reset password') + '</button>'
        +     '</div>'
        +   '</form>'
        +   '<div class="auth-msg" id="auth-msg"></div>'
        + '</div>';
      document.body.appendChild(overlay);

      overlay.querySelector('.auth-modal-close').addEventListener('click', () => this._closeAuthModal());
      overlay.addEventListener('click', e => { if (e.target === overlay) this._closeAuthModal(); });

      const msg      = overlay.querySelector('#auth-msg');
      const form     = overlay.querySelector('#auth-form');
      const resetBtn = overlay.querySelector('#auth-reset');
      const setMsg   = (text, type) => { msg.className = 'auth-msg' + (type ? ' ' + type : ''); msg.textContent = text || ''; };

      resetBtn.addEventListener('click', async () => {
        const email = String(overlay.querySelector('#auth-email').value || '').trim();
        if (!email) { setMsg(t('auth_form_email_first', 'Enter your email first.'), 'error'); return; }
        try { await this._auth.sendPasswordResetEmail(email); setMsg(t('auth_form_reset_sent', 'Password reset email sent.'), 'success'); }
        catch (e) { setMsg(e.message || t('auth_form_reset_fail', 'Could not send reset email.'), 'error'); }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault(); setMsg(t('auth_form_processing', 'Processing...'));
        const email    = String(overlay.querySelector('#auth-email').value || '').trim();
        const password = String(overlay.querySelector('#auth-password').value || '');
        if (!email || !password) { setMsg(t('auth_form_required', 'Email and password are required.'), 'error'); return; }
        try {
          await this._auth.signInWithEmailAndPassword(email, password);
          setMsg(t('auth_form_login_ok', 'Access granted. Loading game...'), 'success');
        } catch (e) {
          const code = e.code || '';
          if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
            setMsg(t('auth_form_invalid', 'Invalid email or password.'), 'error');
          } else {
            setMsg(e.message || t('auth_form_login_fail', 'Login failed.'), 'error');
          }
        }
      });

      setTimeout(() => { const f = overlay.querySelector('#auth-email'); if (f) f.focus(); }, 50);
    },

    _openSignupModal() {
      this._closeAuthModal();
      const t = (k, fb) => this._t(k, fb);
      const overlay = document.createElement('div');
      overlay.id = 'auth-modal-overlay';
      overlay.className = 'auth-modal-overlay';
      overlay.innerHTML = ''
        + '<div class="auth-modal auth-modal-notice" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">'
        +   '<button class="auth-modal-close" type="button" aria-label="Close">✕</button>'
        +   '<div class="auth-notice-icon">🔒</div>'
        +   '<h2 class="auth-modal-title" id="auth-modal-title">' + t('auth_signup_title', 'Sign up — Closed beta') + '</h2>'
        +   '<p class="auth-modal-subtitle">' + t('auth_signup_subtitle', '') + '</p>'
        +   '<p class="auth-modal-text">' + t('auth_signup_text', '') + '</p>'
        +   '<div class="auth-row" style="margin-top:18px">'
        +     '<button class="auth-btn auth-btn-primary" id="auth-notice-ok" type="button" style="flex:1;justify-content:center">' + t('auth_signup_ok', 'Got it') + '</button>'
        +   '</div>'
        + '</div>';
      document.body.appendChild(overlay);

      overlay.querySelector('.auth-modal-close').addEventListener('click', () => this._closeAuthModal());
      overlay.querySelector('#auth-notice-ok').addEventListener('click', () => this._closeAuthModal());
      overlay.addEventListener('click', e => { if (e.target === overlay) this._closeAuthModal(); });
    },

    _closeAuthModal() {
      const m = document.getElementById('auth-modal-overlay');
      if (m) m.remove();
    },

    // ===== Inactivity auto-logout (1h) =====
    _startInactivityTracking() {
      if (this._inactivityHandlers) return;
      const handler = () => this._resetInactivityTimer();
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
      this._inactivityHandlers = { handler, events };
      this._inactivityLastReset = 0;
      this._resetInactivityTimer();
    },

    _resetInactivityTimer() {
      if (!this.isAuthenticated()) return;
      const now = Date.now();
      // Throttle: only re-arm timer once every 5s to avoid hammering on mousemove
      if (now - this._inactivityLastReset < 5000) return;
      this._inactivityLastReset = now;
      if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
      this._inactivityTimer = setTimeout(() => this._handleInactivityLogout(), this._inactivityMs);
    },

    _stopInactivityTracking() {
      if (this._inactivityTimer) { clearTimeout(this._inactivityTimer); this._inactivityTimer = null; }
      if (!this._inactivityHandlers) return;
      const { handler, events } = this._inactivityHandlers;
      events.forEach(ev => window.removeEventListener(ev, handler));
      this._inactivityHandlers = null;
    },

    async _handleInactivityLogout() {
      if (!this.isAuthenticated()) return;
      this._stopInactivityTracking();
      try {
        if (window.GL_STATE && typeof GL_STATE.saveState === 'function') GL_STATE.saveState();
        await this.flushRemoteStateSnapshot();
      } catch (_) {}
      try {
        if (window.GL_UI && typeof GL_UI.toast === 'function') {
          GL_UI.toast(this._t('auth_inactivity_toast', 'Session closed after 1h of inactivity'), 'warning', 6000);
        }
      } catch (_) {}
      try { await this.signOut(); } catch (_) {}
    }
  };

  window.GL_AUTH = AUTH;
})();
