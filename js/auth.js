// ===== AUTH.JS - Optional Supabase auth gate =====
'use strict';

(function () {
  const AUTH = {
    enabled: false,
    client: null,
    user: null,
    role: 'player',
    profile: null,
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

    isConfigured() {
      const cfg = window.GL_SUPABASE_CONFIG || {};
      return Boolean(cfg.url && cfg.anonKey && window.supabase && typeof window.supabase.createClient === 'function');
    },

    async init({ onReady } = {}) {
      this.readyCallback = onReady;
      if (!this.isConfigured()) {
        this.enabled = false;
        this.fireReady();
        return;
      }

      this.enabled = true;
      const cfg = window.GL_SUPABASE_CONFIG;
      const authOptions = {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: this.getAuthStorageKey(cfg)
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        authOptions.storage = window.localStorage;
      }

      this.client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: authOptions
      });
      this.bindLifecyclePersistence();

      const session = await this.getBootSession();
      if (session && session.user) {
        const valid = await this.adoptSessionUser(session.user);
        if (valid) {
          this.hideGate();
          this.fireReady();
        } else {
          this.renderGate();
        }
      } else {
        this.renderGate();
      }

      this.client.auth.onAuthStateChange((event, sessionState) => {
        window.setTimeout(() => {
          this.handleAuthStateChange(event, sessionState);
        }, 0);
      });
    },

    async handleAuthStateChange(event, sessionState) {
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        sessionState &&
        sessionState.user
      ) {
        this.writeSessionMirror(sessionState);
        if (this.user && this.user.id === sessionState.user.id && this.readyFired) {
          this.user = sessionState.user;
          return;
        }
        const valid = await this.adoptSessionUser(sessionState.user);
        if (valid) {
          this.hideGate();
          if (this.readyFired && window.GL_APP && typeof GL_APP.resumeAuthenticatedSession === 'function') {
            GL_APP.resumeAuthenticatedSession();
          } else {
            this.fireReady();
          }
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        this.clearSessionMirror();
        this.user = null;
        this.profile = null;
        this.role = 'player';
        this.remoteSave = null;
        this.remoteSaveUpdatedAt = 0;
        this.storageKeySuffix = '';
        this.pendingRemoteSave = null;
        this.renderGate();
      }
    },

    getAuthStorageKey(cfg) {
      const rawUrl = String((cfg && cfg.url) || '').trim();
      const projectRef = rawUrl.replace(/^https?:\/\//, '').split('.')[0] || 'default';
      return `garage_legends_auth_${projectRef}`;
    },

    getSessionMirrorKey(cfg) {
      const rawUrl = String((cfg && cfg.url) || '').trim();
      const projectRef = rawUrl.replace(/^https?:\/\//, '').split('.')[0] || 'default';
      return `garage_legends_auth_session_${projectRef}`;
    },

    readSessionMirror() {
      try {
        const cfg = window.GL_SUPABASE_CONFIG || {};
        const raw = window.localStorage.getItem(this.getSessionMirrorKey(cfg));
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    },

    writeSessionMirror(session) {
      try {
        if (!session || !session.access_token || !session.refresh_token) return;
        const cfg = window.GL_SUPABASE_CONFIG || {};
        window.localStorage.setItem(this.getSessionMirrorKey(cfg), JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at || null,
          expires_in: session.expires_in || null,
          token_type: session.token_type || 'bearer',
          user: session.user || null
        }));
      } catch (_) {}
    },

    clearSessionMirror() {
      try {
        const cfg = window.GL_SUPABASE_CONFIG || {};
        window.localStorage.removeItem(this.getSessionMirrorKey(cfg));
      } catch (_) {}
    },

    async getBootSession() {
      const { data } = await this.client.auth.getSession();
      const session = data && data.session ? data.session : null;
      if (session && session.user) {
        this.writeSessionMirror(session);
        return session;
      }

      const mirrored = this.readSessionMirror();
      if (!mirrored || !mirrored.access_token || !mirrored.refresh_token) {
        return null;
      }

      try {
        const restoreResult = await this.client.auth.setSession({
          access_token: mirrored.access_token,
          refresh_token: mirrored.refresh_token
        });
        if (restoreResult.error) {
          this.clearSessionMirror();
          return null;
        }
        const restoredSession = restoreResult.data && restoreResult.data.session ? restoreResult.data.session : null;
        if (restoredSession && restoredSession.user) {
          this.writeSessionMirror(restoredSession);
          return restoredSession;
        }
      } catch (_) {
        this.clearSessionMirror();
      }

      return null;
    },

    fireReady() {
      if (this.readyFired) return;
      this.readyFired = true;
      if (typeof this.readyCallback === 'function') this.readyCallback();
    },

    async adoptSessionUser(user) {
      const cfg = window.GL_SUPABASE_CONFIG || {};
      const isEmailConfirmed = Boolean(
        user && (user.email_confirmed_at || user.confirmed_at)
      );
      if (cfg.requireEmailConfirmation && !isEmailConfirmed) {
        await this.client.auth.signOut();
        return false;
      }
      this.user = user;
      this.storageKeySuffix = String(user.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      await this.ensureProfile();
      return true;
    },

    async ensureProfile() {
      if (!this.client || !this.user) return;
      const payload = {
        id: this.user.id,
        email: this.user.email || '',
        role: 'player'
      };
      const insertResult = await this.client.from('profiles').insert(payload);
      if (insertResult.error && insertResult.error.code !== '23505') {
        console.warn('Profile insert warning:', insertResult.error.message || insertResult.error);
      }
      const profResult = await this.client
        .from('profiles')
        .select('id,email,role,save_data,save_updated_at')
        .eq('id', this.user.id)
        .single();
      if (!profResult.error && profResult.data) {
        this.profile = profResult.data;
        this.role = profResult.data.role || 'player';
        this.remoteSave = profResult.data.save_data || null;
        this.remoteSaveUpdatedAt = this.getSaveTimestamp(
          profResult.data.save_data,
          profResult.data.save_updated_at
        );
        this.lastProfileLoadAt = Date.now();
        this.syncStatus = this.remoteSave ? 'synced' : 'ready';
        this.lastSyncError = '';
        this.lastSyncErrorAt = 0;
      } else if (profResult.error) {
        this.syncStatus = 'error';
        this.lastSyncError = profResult.error.message || String(profResult.error);
        this.lastSyncErrorAt = Date.now();
        console.warn('Profile load warning:', this.lastSyncError);
      }
    },

    getSaveTimestamp(snapshot, fallbackValue) {
      const snapshotTs = snapshot && snapshot.meta && typeof snapshot.meta.saveTime === 'number'
        ? snapshot.meta.saveTime
        : 0;
      if (snapshotTs > 0) return snapshotTs;
      const fallbackTs = fallbackValue ? new Date(fallbackValue).getTime() : 0;
      return Number.isFinite(fallbackTs) ? fallbackTs : 0;
    },

    getStorageKeySuffix() {
      return this.storageKeySuffix || '';
    },

    getStorageKeyAliases() {
      const aliases = [];
      if (this.storageKeySuffix) aliases.push(this.storageKeySuffix);
      const email = this.getUserEmail();
      if (email) {
        aliases.push(`email_${String(email).toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`);
      }
      return Array.from(new Set(aliases.filter(Boolean)));
    },

    getRemoteSaveSnapshot() {
      return this.remoteSave ? JSON.parse(JSON.stringify(this.remoteSave)) : null;
    },

    getRemoteSaveInfo() {
      return {
        snapshot: this.getRemoteSaveSnapshot(),
        updatedAt: this.remoteSaveUpdatedAt || 0
      };
    },

    saveRemoteStateSnapshot(state) {
      if (!this.client || !this.user || !state) return Promise.resolve();
      const snapshot = JSON.parse(JSON.stringify(state));
      const updatedAt = this.getSaveTimestamp(snapshot, Date.now());
      this.syncStatus = 'pending';
      this.lastSyncError = '';
      this.lastSyncErrorAt = 0;
      this.remoteSave = snapshot;
      this.remoteSaveUpdatedAt = Math.max(this.remoteSaveUpdatedAt || 0, updatedAt);
      this.pendingRemoteSave = {
        snapshot,
        updatedAt,
        userId: this.user.id
      };
      if (!this.savePromise) {
        this.savePromise = this.drainRemoteSaveQueue();
      }
      return this.savePromise;
    },

    async drainRemoteSaveQueue() {
      while (this.pendingRemoteSave) {
        const pending = this.pendingRemoteSave;
        this.pendingRemoteSave = null;
        try {
          const { error } = await this.client
            .from('profiles')
            .update({
              save_data: pending.snapshot,
              save_updated_at: new Date(pending.updatedAt || Date.now()).toISOString()
            })
            .eq('id', pending.userId);
          if (error) {
            this.syncStatus = 'error';
            this.lastSyncError = error.message || String(error);
            this.lastSyncErrorAt = Date.now();
            console.warn('Remote save warning:', error.message || error);
          } else if (this.user && this.user.id === pending.userId) {
            this.remoteSave = pending.snapshot;
            this.remoteSaveUpdatedAt = Math.max(this.remoteSaveUpdatedAt || 0, pending.updatedAt || 0);
            this.lastSyncAt = Date.now();
            this.syncStatus = 'synced';
            this.lastSyncError = '';
            this.lastSyncErrorAt = 0;
          }
        } catch (e) {
          this.syncStatus = 'error';
          this.lastSyncError = e && e.message ? e.message : String(e);
          this.lastSyncErrorAt = Date.now();
          console.warn('Remote save warning:', e && e.message ? e.message : e);
        }
      }
      this.savePromise = null;
    },

    async clearRemoteStateSnapshot() {
      this.remoteSave = null;
      this.remoteSaveUpdatedAt = Date.now();
      await this.flushRemoteStateSnapshot();
      if (!this.client || !this.user) return;
      try {
        await this.client
          .from('profiles')
          .update({ save_data: null, save_updated_at: new Date().toISOString() })
          .eq('id', this.user.id);
      } catch (e) {
        console.warn('Remote save clear warning:', e && e.message ? e.message : e);
      }
    },

    async flushRemoteStateSnapshot() {
      if (this.savePromise) {
        const pending = this.savePromise;
        await pending;
      }
    },

    getSyncStatus() {
      return {
        status: this.syncStatus || 'idle',
        lastSyncAt: this.lastSyncAt || 0,
        lastProfileLoadAt: this.lastProfileLoadAt || 0,
        lastError: this.lastSyncError || '',
        lastErrorAt: this.lastSyncErrorAt || 0,
        pending: Boolean(this.pendingRemoteSave || this.savePromise),
        hasRemoteSave: Boolean(this.remoteSave),
        remoteUpdatedAt: this.remoteSaveUpdatedAt || 0
      };
    },

    async refreshRemoteProfile() {
      if (!this.client || !this.user) return this.getSyncStatus();
      await this.ensureProfile();
      return this.getSyncStatus();
    },

    async forceSyncCurrentState() {
      if (!(this.client && this.user && window.GL_STATE && typeof GL_STATE.saveState === 'function')) {
        return this.getSyncStatus();
      }
      GL_STATE.saveState();
      await this.flushRemoteStateSnapshot();
      return this.getSyncStatus();
    },

    bindLifecyclePersistence() {
      if (this.lifecycleBound || typeof window === 'undefined') return;
      this.lifecycleBound = true;

      const persistCurrentSession = () => {
        if (window.GL_STATE && typeof GL_STATE.saveState === 'function' && this.isAuthenticated()) {
          try {
            GL_STATE.saveState();
          } catch (_) {}
        }
        this.flushRemoteStateSnapshot().catch(() => {});
      };

      window.addEventListener('pagehide', persistCurrentSession);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          persistCurrentSession();
        }
      });
    },

    isAuthenticated() {
      return Boolean(this.user && this.user.id);
    },

    isAdmin() {
      return this.role === 'admin';
    },

    getUserEmail() {
      return this.user && this.user.email ? this.user.email : '';
    },

    getUserId() {
      return this.user && this.user.id ? this.user.id : '';
    },

    getRole() {
      return this.role || 'player';
    },

    async signOut() {
      if (!this.client) return;
      await this.flushRemoteStateSnapshot();
      await this.client.auth.signOut();
    },

    gateElement() {
      return document.getElementById('auth-gate');
    },

    hideGate() {
      const gate = this.gateElement();
      if (gate) gate.remove();
    },

    renderGate() {
      this.hideGate();
      document.getElementById('app').style.display = 'none';
      const onboarding = document.getElementById('onboarding-screen');
      if (onboarding) onboarding.style.display = 'none';

      const cfg = window.GL_SUPABASE_CONFIG || {};
      const allowSignup = cfg.allowSignup !== false;
      const requireEmailConfirmation = cfg.requireEmailConfirmation !== false;
      const subtitle = allowSignup
        ? (requireEmailConfirmation
          ? 'Use your invite email. Accounts must verify email before first login.'
          : 'Use your invite email to access the closed beta.')
        : 'Closed beta access. Accounts are created manually by admin.';

      const gate = document.createElement('div');
      gate.id = 'auth-gate';
      gate.className = 'auth-gate';
      gate.innerHTML = `
        <div class="auth-card">
          <h2 class="auth-title">Garage Legends Access</h2>
          <p class="auth-subtitle">${subtitle}</p>
          <div class="auth-tabs">
            <button class="auth-tab active" data-mode="login">Login</button>
            <button class="auth-tab" data-mode="register" ${allowSignup ? '' : 'disabled'}>Register</button>
          </div>
          <form class="auth-form" id="auth-form">
            <label class="auth-label" for="auth-email">Email</label>
            <input class="auth-input" id="auth-email" type="email" required autocomplete="email" />
            <label class="auth-label" for="auth-password">Password</label>
            <input class="auth-input" id="auth-password" type="password" required autocomplete="current-password" minlength="8" />
            <div class="auth-row">
              <button class="btn btn-primary" id="auth-submit" type="submit" style="justify-content:center;flex:1">Login</button>
              <button class="btn btn-ghost" id="auth-reset" type="button">Reset password</button>
            </div>
          </form>
          <div class="auth-msg" id="auth-msg"></div>
        </div>`;
      document.body.appendChild(gate);

      const tabs = gate.querySelectorAll('.auth-tab');
      const submitBtn = gate.querySelector('#auth-submit');
      const form = gate.querySelector('#auth-form');
      const msg = gate.querySelector('#auth-msg');
      const resetBtn = gate.querySelector('#auth-reset');
      let mode = 'login';

      const setMsg = (text, type) => {
        msg.className = `auth-msg${type ? ` ${type}` : ''}`;
        msg.textContent = text || '';
      };

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          if (tab.disabled) {
            setMsg('Signup is disabled. Ask an admin to create your account.', 'error');
            return;
          }
          mode = tab.dataset.mode;
          tabs.forEach(t => t.classList.toggle('active', t === tab));
          submitBtn.textContent = mode === 'login' ? 'Login' : 'Create account';
          setMsg('');
        });
      });

      resetBtn.addEventListener('click', async () => {
        const email = String(gate.querySelector('#auth-email').value || '').trim();
        if (!email) {
          setMsg('Enter your email first.', 'error');
          return;
        }
        const redirect = window.location.origin + window.location.pathname;
        const result = await this.client.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (result.error) {
          setMsg(result.error.message || 'Could not send reset email.', 'error');
        } else {
          setMsg('Password reset email sent. Check your inbox.', 'success');
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setMsg('Processing...');
        const email = String(gate.querySelector('#auth-email').value || '').trim();
        const password = String(gate.querySelector('#auth-password').value || '');
        if (!email || !password) {
          setMsg('Email and password are required.', 'error');
          return;
        }

        if (mode === 'register') {
          const redirect = window.location.origin + window.location.pathname;
          const signUpResult = await this.client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirect }
          });
          if (signUpResult.error) {
            setMsg(signUpResult.error.message || 'Registration failed.', 'error');
            return;
          }
          setMsg(requireEmailConfirmation ? 'Account created. Verify your email before first login.' : 'Account created. You can log in now.', 'success');
          return;
        }

        const signInResult = await this.client.auth.signInWithPassword({ email, password });
        if (signInResult.error) {
          setMsg(signInResult.error.message || 'Login failed.', 'error');
          return;
        }
        const sessionUser = signInResult.data && signInResult.data.user ? signInResult.data.user : null;
        if (!sessionUser) {
          setMsg('Login failed: no user session.', 'error');
          return;
        }

        setMsg('Access granted. Loading game...', 'success');
      });
    }
  };

  window.GL_AUTH = AUTH;
})();
