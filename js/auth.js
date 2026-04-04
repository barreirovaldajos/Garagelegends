// ===== AUTH.JS - Optional Supabase auth gate =====
'use strict';

(function () {
  const AUTH = {
    enabled: false,
    client: null,
    user: null,
    role: 'player',
    profile: null,
    readyFired: false,
    readyCallback: null,

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
      this.client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      const { data } = await this.client.auth.getSession();
      const session = data && data.session ? data.session : null;
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

      this.client.auth.onAuthStateChange(async (event, sessionState) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sessionState && sessionState.user) {
          const valid = await this.adoptSessionUser(sessionState.user);
          if (valid) {
            this.hideGate();
            if (this.readyFired && window.GL_APP && typeof GL_APP.resumeAuthenticatedSession === 'function') {
              GL_APP.resumeAuthenticatedSession();
            } else {
              this.fireReady();
            }
          }
        }
        if (event === 'SIGNED_OUT') {
          this.user = null;
          this.profile = null;
          this.role = 'player';
          this.renderGate();
        }
      });
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
      const profResult = await this.client.from('profiles').select('id,email,role').eq('id', this.user.id).single();
      if (!profResult.error && profResult.data) {
        this.profile = profResult.data;
        this.role = profResult.data.role || 'player';
      }
    },

    getStorageKeySuffix() {
      if (!this.enabled || !this.user || !this.user.id) return '';
      return String(this.user.id).replace(/[^a-zA-Z0-9_-]/g, '_');
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

    getRole() {
      return this.role || 'player';
    },

    async signOut() {
      if (!this.client) return;
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

        const user = signInResult.data && signInResult.data.user ? signInResult.data.user : null;
        if (!user) {
          setMsg('Login failed: no user session.', 'error');
          return;
        }

        const valid = await this.adoptSessionUser(user);
        if (!valid) {
          setMsg(requireEmailConfirmation ? 'Verify your email first, then log in again.' : 'Account access is not ready yet.', 'error');
          return;
        }

        setMsg('Access granted. Loading game...', 'success');
        this.hideGate();
        if (this.readyFired && window.GL_APP && typeof GL_APP.resumeAuthenticatedSession === 'function') {
          GL_APP.resumeAuthenticatedSession();
        } else {
          this.fireReady();
        }
      });
    }
  };

  window.GL_AUTH = AUTH;
})();
