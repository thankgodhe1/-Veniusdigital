// digital-grownt\frontend\js\convert\login.js
// Login with network retries + Bearer token so "Unauthorized. Please login." does not appear after a valid login

var LOGIN_MAX_ATTEMPTS = 8;
var LOGIN_BASE_DELAY_MS = 2000;
var LOGIN_MAX_DELAY_MS = 8000;
var LOGIN_TIMEOUT_MS = 25000;

function loginSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function loginHasJwtCookie() {
  try {
    return /(?:^|;\s*)jwt=/.test(document.cookie || '');
  } catch (_) {
    return false;
  }
}

function loginIsNetworkError(error) {
  if (!error) return true;
  if (!error.response) return true;
  var code = error.code || '';
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ETIMEDOUT') return true;
  var msg = String(error.message || '').toLowerCase();
  if (msg.indexOf('network') >= 0 || msg.indexOf('timeout') >= 0 || msg.indexOf('failed to fetch') >= 0) return true;
  return false;
}

function loginIsUnauthorized(error) {
  return !!(error && error.response && error.response.status === 401);
}

function loginDestinationForUser(user) {
  user = user || {};
  if (user.role === 'ADMIN') return './admin/manageusers.html';
  return './user/dashboard.html';
}

function storeAuthSession(user, token) {
  try {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    if (token) {
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('token', token);
    }
    sessionStorage.setItem('dg_just_logged_in', String(Date.now()));
  } catch (_) {}
}

function clearAuthSession() {
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('token');
  } catch (_) {}
}

/**
 * POST /auth/login with retries on weak network.
 * Real 400/401 validation (wrong password, unknown user) fail immediately — those messages stay accurate.
 * "Unauthorized. Please login." is NOT a login-credential error; it comes from missing token on other routes.
 */
async function postLoginWithRetry(payload) {
  var client = (typeof api !== 'undefined' && api) || window.api;
  if (!client) throw new Error('API client not ready');

  var lastError = null;
  for (var attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt++) {
    try {
      var response = await client.post('/auth/login', payload, { timeout: LOGIN_TIMEOUT_MS });
      return response;
    } catch (error) {
      lastError = error;

      // Wrong credentials / validation — do not retry
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }

      if (!loginIsNetworkError(error) && !(error.response && error.response.status >= 500)) {
        throw error;
      }

      if (attempt >= LOGIN_MAX_ATTEMPTS) break;

      var delay = Math.min(LOGIN_BASE_DELAY_MS * Math.pow(1.4, attempt - 1), LOGIN_MAX_DELAY_MS);
      delay = Math.round(delay + Math.random() * 400);
      console.warn('[login] attempt ' + attempt + '/' + LOGIN_MAX_ATTEMPTS + ' failed; retrying in ' + delay + 'ms…');
      showAlert('error', 'Network is slow. Retrying login (' + attempt + '/' + LOGIN_MAX_ATTEMPTS + ')…');
      await loginSleep(delay);
    }
  }
  throw lastError || new Error('Login failed');
}

async function confirmSessionOrContinue(userFromLogin) {
  var client = (typeof api !== 'undefined' && api) || window.api;
  if (!client) return userFromLogin;

  for (var attempt = 1; attempt <= 6; attempt++) {
    try {
      var response = await client.get('/auth/me', { timeout: LOGIN_TIMEOUT_MS });
      if (response && response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
    } catch (error) {
      if (loginIsUnauthorized(error) && !loginHasJwtCookie() && !localStorage.getItem('jwt_token')) {
        throw error;
      }
      if (attempt < 6 && (loginIsNetworkError(error) || (error.response && error.response.status >= 500))) {
        var delay = Math.min(1500 * attempt, 6000);
        await loginSleep(delay);
        continue;
      }
      if (loginHasJwtCookie() || localStorage.getItem('jwt_token') || userFromLogin) {
        return userFromLogin || null;
      }
      throw error;
    }
  }
  return userFromLogin;
}

function goToApp(user, redirectFromServer) {
  var dest = redirectFromServer || loginDestinationForUser(user);
  // Prefer relative paths so live-server routing stays correct
  if (dest && /^https?:\/\//i.test(dest)) {
    try {
      var u = new URL(dest);
      if (u.pathname.indexOf('/admin/') >= 0) dest = './admin/manageusers.html';
      else if (u.pathname.indexOf('/user/') >= 0) dest = './user/dashboard.html';
    } catch (_) {}
  }
  try {
    sessionStorage.setItem('dg_just_logged_in', String(Date.now()));
  } catch (_) {}
  window.location.href = dest;
}

function friendlyLoginError(error) {
  var data = (error && error.response && error.response.data) || {};
  var msg = data.message || data.error || (error && error.message) || 'Login failed';
  // Map middleware message if it ever leaks onto the login form
  if (/unauthorized\.?\s*please login/i.test(String(msg))) {
    return 'Could not complete sign-in. Please try again.';
  }
  return String(msg);
}

document.addEventListener('DOMContentLoaded', function () {
  // Soft redirect if we already have a session
  (async function softRedirectIfSession() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
    var token = null;
    try { token = localStorage.getItem('jwt_token') || localStorage.getItem('token'); } catch (_) {}
    if (!(loginHasJwtCookie() || token || cached)) return;
    try {
      showAlert('success', 'Session found. Opening your dashboard…');
      var user = await confirmSessionOrContinue(cached);
      goToApp(user || cached, null);
    } catch (_) {
      // invalid session — stay on login
    }
  })();

  var form = document.getElementById('loginForm') || document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearAlert();

    var values = new FormData(form);
    var payload = {
      email: values.get('email'),
      password: values.get('password'),
      remember: values.get('remember') === 'on'
    };
    if (!String(payload.email || '').trim()) return showAlert('error', 'Email or username is required');
    if (!payload.password) return showAlert('error', 'Password is required');

    var submitBtn = form.querySelector('button[type="submit"]');
    var prevLabel = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Signing in…';
    }

    var permissionPromise = Promise.resolve('default');
    try {
      if (typeof requestPushPermission === 'function') {
        permissionPromise = requestPushPermission();
      }
    } catch (_) {
      permissionPromise = Promise.resolve('default');
    }

    try {
      var response = await postLoginWithRetry(payload);
      var body = response.data || {};
      var user = body.user || {};
      var token = body.token || '';

      // Persist session BEFORE any follow-up authenticated calls (push, /me)
      storeAuthSession(user, token);

      try {
        user = (await confirmSessionOrContinue(user)) || user;
      } catch (confirmErr) {
        // Only abort if we have no token/cookie at all
        if (loginIsUnauthorized(confirmErr) && !token && !loginHasJwtCookie()) {
          clearAuthSession();
          throw confirmErr;
        }
      }

      // Push must never block or surface "Unauthorized. Please login."
      try {
        var permission = await permissionPromise;
        if (typeof setupPushIfNeeded === 'function') {
          await setupPushIfNeeded({ permission: permission });
        }
      } catch (pushErr) {
        console.warn('[login] push setup skipped:', pushErr && pushErr.message);
      }

      showAlert('success', body.message || 'Login successful');

      window.setTimeout(function () {
        goToApp(user, body.redirect);
      }, 400);
    } catch (error) {
      // If token/cookie exists despite an error (secondary request failed), still enter app
      var tokenNow = null;
      try { tokenNow = localStorage.getItem('jwt_token'); } catch (_) {}
      if (tokenNow || loginHasJwtCookie()) {
        var cachedUser = null;
        try { cachedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) {}
        showAlert('success', 'Connected. Opening your dashboard…');
        window.setTimeout(function () {
          goToApp(cachedUser, null);
        }, 400);
      } else {
        showAlert('error', friendlyLoginError(error));
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = prevLabel || 'Sign In';
      }
    }
  });
});

function clearAlert() {
  var el = document.getElementById('form-alert');
  if (el) el.remove();
}

function showAlert(type, text) {
  clearAlert();
  var box = document.createElement('div');
  box.id = 'form-alert';
  box.className = type === 'success'
    ? 'mb-4 flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300'
    : 'mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300';
  var message = document.createElement('span');
  message.className = 'flex-1 leading-relaxed';
  message.textContent = String(text || '');
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'text-current opacity-70 hover:opacity-100 bg-transparent border-0 cursor-pointer text-lg leading-none';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', function () { box.remove(); });
  box.append(message, close);
  var form = document.querySelector('form');
  if (form) form.parentNode.insertBefore(box, form);
}
