// ===== TRACKING.JS – Fire-and-forget user event tracking =====
// Calls the logUserEvent Cloud Function silently. Never blocks the game flow.
'use strict';

(function () {
  const TRACKING = {
    _fn: null,

    _callable() {
      if (!this._fn) {
        try { this._fn = firebase.functions().httpsCallable('logUserEvent'); } catch (_) {}
      }
      return this._fn;
    },

    track(eventName) {
      try {
        const fn = this._callable();
        if (fn) fn({ eventName }).catch(function () {});
      } catch (_) {}
    },
  };

  window.GL_TRACKING = TRACKING;
})();
