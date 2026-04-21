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
          if (user) { await this.adoptUser(user); this.hideGate(); }
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
          if (this.readyFired && window.GL_APP && typeof GL_APP.resumeAuthenticatedSession === 'function') {
            GL_APP.resumeAuthenticatedSession();
          }
        } else {
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
          const pendingCredits = (data.mp && data.mp.pendingCredits) || 0;
          const pendingFans    = (data.mp && data.mp.pendingFans)    || 0;
          if ((pendingCredits > 0 || pendingFans > 0) && data.save_data) {
            const sd = JSON.parse(JSON.stringify(data.save_data));
            if (pendingCredits > 0) {
              if (!sd.finances) sd.finances = {};
              sd.finances.credits = (sd.finances.credits || 0) + pendingCredits;
            }
            if (pendingFans > 0) {
              if (!sd.team) sd.team = {};
              sd.team.fans = (sd.team.fans || 0) + pendingFans;
            }
            data.save_data = sd;
            data.mp = Object.assign({}, data.mp, { pendingCredits: 0, pendingFans: 0 });
            const fsUpdates = {
              save_data: sd,
              save_updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (pendingCredits > 0) fsUpdates['mp.pendingCredits'] = firebase.firestore.FieldValue.delete();
            if (pendingFans    > 0) fsUpdates['mp.pendingFans']    = firebase.firestore.FieldValue.delete();
            ref.update(fsUpdates).catch(e => console.warn('Failed to persist MP rewards:', e));
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
      } catch (e) {
        this.syncStatus = 'error'; this.lastSyncError = e.message || String(e);
        this.lastSyncErrorAt = Date.now();
        console.warn('Profile load warning:', this.lastSyncError);
      }
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
    hideGate()    { const g = this.gateElement(); if (g) g.remove(); },
    fireReady()   { if (this.readyFired) return; this.readyFired = true; if (typeof this.readyCallback === 'function') this.readyCallback(); },

    renderGate() {
      this.hideGate();
      document.getElementById('app').style.display = 'none';
      const onboarding = document.getElementById('onboarding-screen');
      if (onboarding) onboarding.style.display = 'none';
      const gate = document.createElement('div');
      gate.id = 'auth-gate'; gate.className = 'auth-gate';
      gate.innerHTML = "<div class=\"auth-card\">\n          <h2 class=\"auth-title\">Garage Legends Access</h2>\n          <p class=\"auth-subtitle\">Closed beta access. Accounts are created manually by admin.</p>\n          <div class=\"auth-tabs\">\n            <button class=\"auth-tab active\" data-mode=\"login\">Login</button>\n            <button class=\"auth-tab\" data-mode=\"register\" disabled>Register</button>\n          </div>\n          <form class=\"auth-form\" id=\"auth-form\">\n            <label class=\"auth-label\" for=\"auth-email\">Email</label>\n            <input class=\"auth-input\" id=\"auth-email\" type=\"email\" required autocomplete=\"email\" />\n            <label class=\"auth-label\" for=\"auth-password\">Password</label>\n            <input class=\"auth-input\" id=\"auth-password\" type=\"password\" required autocomplete=\"current-password\" minlength=\"6\" />\n            <div class=\"auth-row\">\n              <button class=\"btn btn-primary\" id=\"auth-submit\" type=\"submit\" style=\"justify-content:center;flex:1\">Login</button>\n              <button class=\"btn btn-ghost\" id=\"auth-reset\" type=\"button\">Reset password</button>\n            </div>\n          </form>\n          <div class=\"auth-msg\" id=\"auth-msg\"></div>\n        </div>";
      document.body.appendChild(gate);

      const msg      = gate.querySelector('#auth-msg');
      const form     = gate.querySelector('#auth-form');
      const resetBtn = gate.querySelector('#auth-reset');
      const setMsg   = (text, type) => { msg.className = 'auth-msg' + (type ? ' ' + type : ''); msg.textContent = text || ''; };

      resetBtn.addEventListener('click', async () => {
        const email = String(gate.querySelector('#auth-email').value || '').trim();
        if (!email) { setMsg('Enter your email first.', 'error'); return; }
        try { await this._auth.sendPasswordResetEmail(email); setMsg('Password reset email sent. Check your inbox.', 'success'); }
        catch (e) { setMsg(e.message || 'Could not send reset email.', 'error'); }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault(); setMsg('Processing...');
        const email    = String(gate.querySelector('#auth-email').value || '').trim();
        const password = String(gate.querySelector('#auth-password').value || '');
        if (!email || !password) { setMsg('Email and password are required.', 'error'); return; }
        try {
          await this._auth.signInWithEmailAndPassword(email, password);
          setMsg('Access granted. Loading game...', 'success');
        } catch (e) {
          const code = e.code || '';
          if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
            setMsg('Invalid email or password.', 'error');
          } else {
            setMsg(e.message || 'Login failed.', 'error');
          }
        }
      });
    }
  };

  window.GL_AUTH = AUTH;
})();
