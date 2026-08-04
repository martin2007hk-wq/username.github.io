/**
 * PostAIAge — Click & Registration Tracker
 * Uses localStorage for offline-capable event tracking.
 * No external dependencies.
 */

(function () {
  'use strict';

  const STORAGE_KEY_CTA = 'postaiage_cta_clicks';
  const STORAGE_KEY_REGISTRATIONS = 'postaiage_registrations';

  // ── Helpers ────────────────────────────────────────────────

  function generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function readStore(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('tracker: failed to read', key, e);
      return null;
    }
  }

  function writeStore(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('tracker: failed to write', key, e);
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Record a CTA click event.
   * @param {'hero-cta'|'navbar'|'footer-cta'} source
   */
  function recordCTAClick(source) {
    const store = readStore(STORAGE_KEY_CTA) || { totalClicks: 0, events: [] };
    const event = {
      id: generateId('click'),
      timestamp: isoNow(),
      source: source
    };
    store.totalClicks += 1;
    store.events.push(event);
    writeStore(STORAGE_KEY_CTA, store);
    return event;
  }

  /**
   * Record a registration event.
   * @param {'A'|'B'} plan
   * @param {'email'|'google'} method
   * @param {string|null} email
   */
  function recordRegistration(plan, method, email) {
    const store = readStore(STORAGE_KEY_REGISTRATIONS) || {
      totalRegistrations: 0,
      stats: { planA: 0, planB: 0, methodEmail: 0, methodGoogle: 0 },
      events: []
    };

    const event = {
      id: generateId('reg'),
      timestamp: isoNow(),
      plan: plan,
      method: method,
      email: email || null
    };

    store.totalRegistrations += 1;
    store.stats['plan' + plan] += 1;
    store.stats['method' + (method === 'email' ? 'Email' : 'Google')] += 1;
    store.events.push(event);

    writeStore(STORAGE_KEY_REGISTRATIONS, store);
    return event;
  }

  /**
   * Return total CTA clicks so far.
   * @returns {number}
   */
  function getCTAClickCount() {
    const store = readStore(STORAGE_KEY_CTA);
    return store ? store.totalClicks : 0;
  }

  /**
   * Return aggregated registration stats.
   * @returns {{ totalRegistrations: number, stats: { planA: number, planB: number, methodEmail: number, methodGoogle: number }, events: Array }}
   */
  function getRegistrationStats() {
    const store = readStore(STORAGE_KEY_REGISTRATIONS);
    return store || {
      totalRegistrations: 0,
      stats: { planA: 0, planB: 0, methodEmail: 0, methodGoogle: 0 },
      events: []
    };
  }

  // ── Expose to global scope ─────────────────────────────────

  window.trackCTAClick = recordCTAClick;
  window.recordRegistration = recordRegistration;
  window.getCTAClickCount = getCTAClickCount;
  window.getRegistrationStats = getRegistrationStats;

  // Also expose keys for debugging
  window._trackerKeys = { STORAGE_KEY_CTA, STORAGE_KEY_REGISTRATIONS };
})();
