/**
 * First-time / visitor beacon for Digital-grownt.
 * Sends a single ping per page load to the backend public /visitor-ping endpoint.
 * Stores a stable visitor_key in localStorage so return visits are recognized.
 */
(function () {
  'use strict';
  if (window.__DG_VISITOR_BEACON__) return;
  window.__DG_VISITOR_BEACON__ = true;

  var KEY = 'dg_visitor_key';

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  }

  function getVisitorKey() {
    try {
      var existing = localStorage.getItem(KEY);
      if (existing && existing.length >= 8) return existing;
      var created = uuid();
      localStorage.setItem(KEY, created);
      return created;
    } catch (_) {
      return uuid();
    }
  }

  function apiBase() {
    try {
      return String(window.API_BASE_URL || '').replace(/\/$/, '');
    } catch (_) {
      return '';
    }
  }

  function sendPing() {
    var base = apiBase();
    if (!base) return;
    var payload = {
      visitor_key: getVisitorKey(),
      page_url: String(location.href || '').slice(0, 500),
      referrer: String(document.referrer || '').slice(0, 500),
      language: String(navigator.language || navigator.userLanguage || ''),
      screen: (window.screen && (screen.width + 'x' + screen.height)) || '',
      timezone: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; }
      })(),
    };

    // Prefer axios if present; else fetch
    if (window.axios) {
      window.axios.post(base + '/visitor-ping', payload, { timeout: 8000 }).catch(function () {});
      return;
    }
    if (typeof fetch === 'function') {
      fetch(base + '/visitor-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(sendPing, 800);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(sendPing, 800);
    });
  }
})();
