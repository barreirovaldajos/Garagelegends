// ===== TRACKING.JS – Fire-and-forget user event tracking =====
// Never blocks the game flow. All calls are silent fire-and-forget.
'use strict';

(function () {
  const TRACKING = {
    _fn: null,
    _sessionStart: null,
    _currentScreen: null,
    _screenEnteredAt: null,

    _callable() {
      if (!this._fn) {
        try { this._fn = firebase.functions().httpsCallable('logUserEvent'); } catch (_) {}
      }
      return this._fn;
    },

    _fire(eventName, metadata) {
      try {
        const fn = this._callable();
        if (fn) fn({ eventName, metadata: metadata || null }).catch(function () {});
      } catch (_) {}
    },

    // Called after login_success
    track(eventName) { this._fire(eventName, null); },

    startSession() {
      const now = Date.now();
      try { sessionStorage.setItem('gl_session_start', String(now)); } catch (_) {}
      this._sessionStart    = now;
      this._currentScreen   = null;
      this._screenEnteredAt = null;
    },

    _resumeSession() {
      try {
        const stored = sessionStorage.getItem('gl_session_start');
        if (stored) this._sessionStart = Number(stored);
      } catch (_) {}
    },

    // Called on every GL_APP.navigateTo()
    trackScreenView(screenId) {
      if (!this._sessionStart) this._resumeSession();
      const now = Date.now();
      if (this._currentScreen && this._screenEnteredAt) {
        const durationSeconds = Math.round((now - this._screenEnteredAt) / 1000);
        this._fire('screen_exit', { screen: this._currentScreen, durationSeconds });
      }
      this._currentScreen   = screenId;
      this._screenEnteredAt = now;
      this._fire('screen_view', { screen: screenId });
    },

    // Called on signout or inactivity logout
    trackSessionEnd() {
      if (!this._sessionStart) this._resumeSession();
      if (!this._sessionStart) return;
      const durationSeconds = Math.round((Date.now() - this._sessionStart) / 1000);
      // Fire exit for current screen before ending session
      if (this._currentScreen && this._screenEnteredAt) {
        const screenDuration = Math.round((Date.now() - this._screenEnteredAt) / 1000);
        this._fire('screen_exit', { screen: this._currentScreen, durationSeconds: screenDuration });
      }
      this._fire('session_end', { durationSeconds });
      try { sessionStorage.removeItem('gl_session_start'); } catch (_) {}
      this._sessionStart    = null;
      this._currentScreen   = null;
      this._screenEnteredAt = null;
    },
  };

  window.GL_TRACKING = TRACKING;
})();
