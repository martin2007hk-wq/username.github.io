/**
 * PostAIAge — Cookie Utility Module
 * 
 * Three cookies:
 *   1. postaiage_visit   — Returning visitor detection (1 year expiry)
 *   2. postaiage_prefs   — User preferences (1 year expiry)
 *   3. postaiage_session — Session hint / registration memory (session expiry)
 *
 * Vanilla JS, no dependencies.
 */

(function () {
  'use strict';

  const COOKIE_VISIT = 'postaiage_visit';
  const COOKIE_PREFS = 'postaiage_prefs';
  const COOKIE_SESSION = 'postaiage_session';

  // ── Low-level cookie helpers ──────────────────────────────────

  /**
   * Set a cookie with optional maxAge (seconds) and path.
   * @param {string} name
   * @param {string} value
   * @param {number} [maxAge] - seconds until expiry (default: session)
   * @param {string} [path] - default "/"
   */
  function setCookie(name, value, maxAge, path) {
    let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value);
    if (maxAge !== undefined && maxAge !== null) {
      cookie += '; max-age=' + maxAge;
    }
    cookie += '; path=' + (path || '/');
    cookie += '; SameSite=Lax';
    // Secure-only in production (https). Firebase hosting uses https.
    if (window.location.protocol === 'https:') {
      cookie += '; Secure';
    }
    document.cookie = cookie;
  }

  /**
   * Get a cookie value by name. Returns null if not found.
   * @param {string} name
   * @returns {string|null}
   */
  function getCookie(name) {
    var encoded = encodeURIComponent(name) + '=';
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i].trim();
      if (c.indexOf(encoded) === 0) {
        return decodeURIComponent(c.substring(encoded.length));
      }
    }
    return null;
  }

  /**
   * Delete a cookie by setting maxAge=0.
   * @param {string} name
   */
  function deleteCookie(name) {
    setCookie(name, '', 0);
  }

  // ── Visit Data ──────────────────────────────────────────────

  /**
   * Read current visit data, or init a fresh record.
   * Always bumps visitCount and updates lastVisit on every page load.
   * @returns {{ firstVisit: string, visitCount: number, lastVisit: string, referrer: string, landingPage: string }}
   */
  function getOrInitVisitData() {
    var raw = getCookie(COOKIE_VISIT);
    var data;
    var now = new Date().toISOString();

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = null;
      }
    }

    if (!data || !data.firstVisit) {
      // First visit ever
      data = {
        firstVisit: now,
        visitCount: 1,
        lastVisit: now,
        referrer: document.referrer || 'direct',
        landingPage: window.location.pathname
      };
    } else {
      // Returning visitor — bump counters
      data.visitCount += 1;
      data.lastVisit = now;
    }

    // Persist (1 year = 31536000 seconds)
    setCookie(COOKIE_VISIT, JSON.stringify(data), 31536000);

    return data;
  }

  /**
   * Public: get visit data without mutation.
   * @returns {{ firstVisit: string, visitCount: number, lastVisit: string, referrer: string, landingPage: string }}
   */
  function getVisitData() {
    var raw = getCookie(COOKIE_VISIT);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    return null;
  }

  // ── Preferences ──────────────────────────────────────────────

  /**
   * Get all stored preferences.
   * @returns {{ theme?: string, dismissedBanners?: string[], lastViewedSection?: string, planViewed?: string }}
   */
  function getPreferences() {
    var raw = getCookie(COOKIE_PREFS);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    return {};
  }

  /**
   * Set a single preference key/value. Merged with existing prefs.
   * @param {string} key
   * @param {*} value
   */
  function setPreference(key, value) {
    var prefs = getPreferences();
    prefs[key] = value;
    setCookie(COOKIE_PREFS, JSON.stringify(prefs), 31536000);
  }

  /**
   * Record that a banner/notice has been dismissed.
   * @param {string} bannerId
   */
  function dismissBanner(bannerId) {
    var prefs = getPreferences();
    if (!prefs.dismissedBanners) {
      prefs.dismissedBanners = [];
    }
    if (prefs.dismissedBanners.indexOf(bannerId) === -1) {
      prefs.dismissedBanners.push(bannerId);
    }
    setCookie(COOKIE_PREFS, JSON.stringify(prefs), 31536000);
  }

  /**
   * Check if a banner has been dismissed.
   * @param {string} bannerId
   * @returns {boolean}
   */
  function isBannerDismissed(bannerId) {
    var prefs = getPreferences();
    return prefs.dismissedBanners && prefs.dismissedBanners.indexOf(bannerId) !== -1;
  }

  // ── Session Hints ────────────────────────────────────────────

  /**
   * Get session data (browser-session lifetime).
   * @returns {{ lastAuthMethod?: string, registered?: boolean, lastPlan?: string }}
   */
  function getSession() {
    var raw = getCookie(COOKIE_SESSION);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    return {};
  }

  /**
   * Merge session data.
   * @param {{ lastAuthMethod?: string, registered?: boolean, lastPlan?: string }} data
   */
  function setSession(data) {
    var session = getSession();
    Object.keys(data).forEach(function (k) {
      session[k] = data[k];
    });
    // Session cookie — expires when browser closes (no maxAge)
    setCookie(COOKIE_SESSION, JSON.stringify(session));
  }

  /**
   * Mark user as having completed registration (session lifetime).
   * @param {'A'|'B'} plan
   */
  function markRegistered(plan) {
    setSession({ registered: true, lastPlan: plan });
  }

  // ── Convenience queries ──────────────────────────────────────

  /**
   * Is this a returning visitor? (visitCount > 1)
   * @returns {boolean}
   */
  function isReturning() {
    var data = getVisitData();
    return data ? data.visitCount > 1 : false;
  }

  /**
   * How many total visits (including current)?
   * @returns {number}
   */
  function getVisitCount() {
    var data = getVisitData();
    return data ? data.visitCount : 0;
  }

  /**
   * Days since first visit, or null if unknown.
   * @returns {number|null}
   */
  function daysSinceFirstVisit() {
    var data = getVisitData();
    if (!data || !data.firstVisit) return null;
    var first = new Date(data.firstVisit).getTime();
    var now = Date.now();
    return Math.floor((now - first) / (1000 * 60 * 60 * 24));
  }

  // ── Consent ──────────────────────────────────────────────────

  /**
   * Check if user has given cookie consent.
   * @returns {boolean}
   */
  function isCookieConsentGiven() {
    var prefs = getPreferences();
    return prefs.cookieConsent === 'all' || prefs.cookieConsent === 'essential';
  }

  /**
   * Returns current consent level: 'all', 'essential', or null.
   * @returns {string|null}
   */
  function getConsentLevel() {
    var prefs = getPreferences();
    return prefs.cookieConsent || null;
  }

  // ── Initialise visit on load ─────────────────────────────────

  var visitData = getOrInitVisitData();

  // ── Expose public API ────────────────────────────────────────

  window.PostAIAgeCookies = {
    // Visit
    getVisitData: getVisitData,
    isReturning: isReturning,
    getVisitCount: getVisitCount,
    daysSinceFirstVisit: daysSinceFirstVisit,

    // Preferences
    getPreferences: getPreferences,
    setPreference: setPreference,
    dismissBanner: dismissBanner,
    isBannerDismissed: isBannerDismissed,

    // Consent
    isCookieConsentGiven: isCookieConsentGiven,
    getConsentLevel: getConsentLevel,

    // Session
    getSession: getSession,
    setSession: setSession,
    markRegistered: markRegistered,

    // Low-level (for debugging)
    _setCookie: setCookie,
    _getCookie: getCookie,
    _deleteCookie: deleteCookie,

    // Current visit (already initialised)
    visitData: visitData
  };

  // Log for debugging
  console.log('PostAIAge: cookies initialised — visit #' + visitData.visitCount +
    ', returning=' + isReturning() +
    ', daysSinceFirst=' + daysSinceFirstVisit());
})();
