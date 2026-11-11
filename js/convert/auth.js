// digital-grownt\frontend\js\convert\auth.js
// Auth guard with generous retries when JWT cookie is present (weak / slow network)

/** Max attempts to reach /auth/me before treating session as dead */
var AUTH_ME_MAX_ATTEMPTS = 10;
/** Base delay between retries (ms); grows each attempt */
var AUTH_ME_BASE_DELAY_MS = 2000;
/** Cap between retries (ms) */
var AUTH_ME_MAX_DELAY_MS = 8000;
/** Per-request axios timeout (ms) */
var AUTH_ME_TIMEOUT_MS = 20000;

function pageLoginPath() {
  const path = window.location.pathname || '';
  return path.includes('/user/') || path.includes('/admin/') ? '../login.html' : './login.html';
}

/** True when browser still has the httpOnly-visible jwt cookie name in document.cookie
 *  Note: if cookie is httpOnly it may not appear here; we still treat localStorage user +
 *  network errors as "keep on page" and only hard-redirect on definitive 401. */
function hasJwtCookie() {
  try {
    const raw = document.cookie || '';
    return /(?:^|;\s*)jwt=/.test(raw);
  } catch (_) {
    return false;
  }
}

function hasCachedUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return !!(u && (u._id || u.id || u.email));
  } catch (_) {
    return false;
  }
}

/** True for ~3 minutes after a successful login redirect */
function justLoggedInRecently() {
  try {
    const ts = Number(sessionStorage.getItem('dg_just_logged_in') || 0);
    if (!ts) return false;
    return (Date.now() - ts) < 3 * 60 * 1000;
  } catch (_) {
    return false;
  }
}

function isNetworkOrTimeoutError(error) {
  if (!error) return true;
  // No HTTP response = network / CORS / offline / DNS / backend down
  if (!error.response) return true;
  const code = error.code || '';
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ETIMEDOUT') return true;
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch')) return true;
  return false;
}

function isUnauthorizedError(error) {
  return !!(error && error.response && error.response.status === 401);
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Call /auth/me with long timeout and retries.
 * - Definitive 401 → fail immediately (invalid/expired token)
 * - Network/timeouts → keep retrying while cookie or cached user exists
 * - Other 4xx/5xx → retry a few times then fail
 */
async function fetchAuthMeWithRetry(options) {
  options = options || {};
  const maxAttempts = options.maxAttempts != null ? options.maxAttempts : AUTH_ME_MAX_ATTEMPTS;
  const client = (typeof api !== 'undefined' && api) || window.api;
  if (!client) throw new Error('API client not ready');

  let lastError = null;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.get('/auth/me', { timeout: AUTH_ME_TIMEOUT_MS });
      if (response && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
      throw new Error('Empty /auth/me response');
    } catch (error) {
      lastError = error;

      // Hard auth failure — do not keep retrying
      if (isUnauthorizedError(error)) {
        localStorage.removeItem('user');
        throw error;
      }

      const canRetry =
        isNetworkOrTimeoutError(error) ||
        (error.response && error.response.status >= 500) ||
        (error.response && error.response.status === 429);

      if (!canRetry || attempt >= maxAttempts) {
        throw error;
      }

      // Stay on protected pages while waiting for a stronger network
      var delay = Math.min(
        AUTH_ME_BASE_DELAY_MS * Math.pow(1.45, attempt - 1),
        AUTH_ME_MAX_DELAY_MS
      );
      // jitter
      delay = Math.round(delay + Math.random() * 400);
      console.warn(
        '[auth] /auth/me attempt ' + attempt + '/' + maxAttempts +
        ' failed (' + (error.message || 'network') + '). Retrying in ' + delay + 'ms…'
      );
      await sleep(delay);
    }
  }
  throw lastError || new Error('Auth check failed');
}

async function isLoggedIn() {
  try {
    await fetchAuthMeWithRetry();
    return true;
  } catch (error) {
    // Cookie or cached session + pure network failure → treat as still logged in
    // so protectCurrentFrontendPage does not bounce the user to login.
    if (isNetworkOrTimeoutError(error) && (hasJwtCookie() || hasCachedUser() || justLoggedInRecently() || (typeof localStorage !== 'undefined' && (localStorage.getItem('jwt_token') || localStorage.getItem('token'))))) {
      console.warn('[auth] Network weak; keeping session from cookie/cache/login.');
      return true;
    }
    if (isUnauthorizedError(error)) {
      localStorage.removeItem('user');
      return false;
    }
    // Unknown error without cookie/cache → not logged in
    if (!(hasJwtCookie() || hasCachedUser() || justLoggedInRecently())) {
      localStorage.removeItem('user');
      return false;
    }
    // Soft-keep session
    return true;
  }
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch (_) { return null; }
}

async function logout() {
  try { await api.get('/auth/logout'); } catch (_) {}
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('token');
    sessionStorage.removeItem('dg_just_logged_in');
  } catch (_) {}
  window.location.href = pageLoginPath();
}

async function requireAuthPage() {
  const ok = await isLoggedIn();
  if (!ok) {
    // Only redirect when we are sure there is no valid session
    if (!(hasJwtCookie() || hasCachedUser() || justLoggedInRecently())) {
      window.location.href = pageLoginPath();
      return false;
    }
    // Cookie still present — stay put
    return true;
  }
  return true;
}

async function requireAdmin() {
  try {
    const user = await fetchAuthMeWithRetry();
    if (!user || user.role !== 'ADMIN') {
      window.location.href = '../index.html';
      return false;
    }
    return true;
  } catch (error) {
    if (isUnauthorizedError(error)) {
      localStorage.removeItem('user');
      window.location.href = '../login.html';
      return false;
    }
    // Weak network: if we already know they are admin from cache, keep them
    if (isNetworkOrTimeoutError(error) || (error.response && error.response.status >= 500)) {
      const cached = getCurrentUser();
      if (cached && cached.role === 'ADMIN') {
        console.warn('[auth] Network weak; keeping admin session from cache.');
        return true;
      }
      if (hasJwtCookie() || hasCachedUser()) {
        // Don't kick admin off the page; allow shell to load, data can retry later
        console.warn('[auth] Network weak on admin guard; staying on page.');
        return true;
      }
    }
    localStorage.removeItem('user');
    window.location.href = '../login.html';
    return false;
  }
}

function isProtectedFrontendPath() {
  const path = window.location.pathname || '';
  return path.includes('/user/') || path.includes('/admin/');
}

function showAuthWaitOverlay(show) {
  var id = 'auth-network-wait';
  var el = document.getElementById(id);
  if (!show) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:500 14px system-ui,sans-serif;';
  el.innerHTML = '<div style="text-align:center;padding:20px 28px;border-radius:14px;background:#111;border:1px solid #1e1e1e;max-width:280px;">' +
    '<div style="margin-bottom:10px;font-size:22px;">⏳</div>' +
    '<div style="margin-bottom:6px;">Connecting to server…</div>' +
    '<div style="font-size:12px;color:#888;">Slow network detected. Please wait — you will not be logged out.</div>' +
    '</div>';
  document.documentElement.appendChild(el);
}

async function protectCurrentFrontendPage() {
  const path = window.location.pathname || '';
  if (!isProtectedFrontendPath()) return true;

  document.documentElement.style.visibility = 'hidden';
  var hadSessionHint = hasJwtCookie() || hasCachedUser();
  if (hadSessionHint) showAuthWaitOverlay(true);

  var allowed = false;
  try {
    allowed = path.includes('/admin/') ? await requireAdmin() : await requireAuthPage();
  } finally {
    showAuthWaitOverlay(false);
  }

  if (allowed) document.documentElement.style.visibility = 'visible';
  return allowed;
}

function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
}

function requestPushPermission() {
  if (!pushSupported() || Notification.permission === 'denied') return Promise.resolve(Notification.permission);
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Promise.resolve(Notification.permission);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function getOrCreatePushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  const configResponse = await api.get('/auth/push-config');
  if (!configResponse.data?.enabled || !configResponse.data.publicKey) return null;

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  await registration.update();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(configResponse.data.publicKey)
    });
  }
  return subscription;
}

async function subscribePush() {
  const subscription = await getOrCreatePushSubscription();
  if (!subscription) return false;
  await api.post('/auth/push-subscribe', { subscription: subscription.toJSON() });
  localStorage.removeItem('pendingPushSubscription');
  return true;
}

async function setupPublicPush(options) {
  try {
    if (!pushSupported()) return false;
    const permission = options && options.permission ? options.permission : Notification.permission;
    if (permission !== 'granted') return false;
    const subscription = await getOrCreatePushSubscription();
    if (!subscription) return false;
    const payload = { subscription: subscription.toJSON() };
    localStorage.setItem('pendingPushSubscription', JSON.stringify(payload.subscription));
    try {
      await api.post('/auth/push-subscribe', payload);
      localStorage.removeItem('pendingPushSubscription');
    } catch (error) {
      if (error.response?.status !== 401) throw error;
    }
    return true;
  } catch (error) {
    console.warn('Public push setup failed:', error.message);
    return false;
  }
}

async function setupPushIfNeeded(options) {
  try {
    const permission = options && options.permission ? options.permission : (Notification.permission || 'default');
    if (permission !== 'granted') return false;
    return await subscribePush();
  } catch (error) {
    console.warn('Push setup failed:', error.message);
    return false;
  }
}

function addNotificationButton() {
  if (!pushSupported() || !document.body || document.getElementById('enable-browser-notifications')) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

  const button = document.createElement('button');
  button.id = 'enable-browser-notifications';
  button.type = 'button';
  button.setAttribute('aria-label', 'Enable browser notifications');
  button.innerHTML = '<span aria-hidden="true">🔔</span><span>Enable notifications</span>';
  button.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid rgba(0,212,154,.45);border-radius:999px;background:#111;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);cursor:pointer;';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.style.opacity = '0.65';
    const permission = await requestPushPermission();
    let enabled = false;
    if (permission === 'granted') {
      enabled = isProtectedFrontendPath() ? await setupPushIfNeeded({ permission }) : await setupPublicPush({ permission });
    }
    if (enabled || permission === 'denied') {
      button.remove();
      return;
    }
    button.disabled = false;
    button.style.opacity = '1';
  });
  document.body.appendChild(button);
}

async function initializePushForCurrentPage() {
  if (!pushSupported()) return;
  if (Notification.permission === 'granted' && isProtectedFrontendPath()) {
    await setupPushIfNeeded({ permission: 'granted' });
    return;
  }
  if (Notification.permission === 'default') addNotificationButton();
}


function bindLogoutControls() {
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-auth-logout], form[action*="/logout"], form[action="logout"]');
    if (!form) return;
    event.preventDefault();
    await logout();
  });
  document.addEventListener('click', async (event) => {
    const control = event.target.closest('[data-auth-logout], a[href*="/logout"]');
    if (!control) return;
    event.preventDefault();
    await logout();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindLogoutControls();
  const allowed = await protectCurrentFrontendPage();
  if (!allowed) return;
  await initializePushForCurrentPage();
});
