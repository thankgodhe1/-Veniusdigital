(() => {
  // const API_BASE_URL = 'http://127.0.0.1:3000';
    const API_BASE_URL = 'https://veniusdigital-backend.onrender.com';
  window.API_BASE_URL = API_BASE_URL;

  function getStoredToken() {
    try {
      return localStorage.getItem('jwt_token') || localStorage.getItem('token') || '';
    } catch (_) {
      return '';
    }
  }

  window.api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 25000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });

  // Always send Bearer token when cookie is missing (cross-origin / SameSite issues)
  window.api.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = 'Bearer ' + token;
      }
    }
    return config;
  });

  function pageLoginPathFromConfig() {
    const path = window.location.pathname || '';
    return path.includes('/user/') || path.includes('/admin/') ? '../login.html' : './login.html';
  }

  function isPublicPageCfg() {
    const path = window.location.pathname || '';
    return path === '/' || /(?:index|login|register|forgot-password|reset-password|reset)\.html$/i.test(path);
  }

  function isAuthLoginRequest(error) {
    try {
      const url = String((error.config && error.config.url) || '');
      return /\/auth\/login\b/.test(url);
    } catch (_) {
      return false;
    }
  }

  window.api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error && error.response && error.response.status;
      const noResponse = !error || !error.response;

      // Network / timeout — never force logout
      if (noResponse) {
        return Promise.reject(error);
      }

      // Login endpoint has its own error messages (wrong password, etc.)
      if (isAuthLoginRequest(error)) {
        return Promise.reject(error);
      }

      if (status === 401) {
        // Do not clear session or redirect if we just logged in and a transient request failed
        let justIn = false;
        try {
          const ts = Number(sessionStorage.getItem('dg_just_logged_in') || 0);
          justIn = ts && (Date.now() - ts) < 60 * 1000;
        } catch (_) {}

        if (!justIn) {
          try {
            localStorage.removeItem('user');
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('token');
          } catch (_) {}
          if (!isPublicPageCfg()) {
            window.location.href = pageLoginPathFromConfig();
          }
        }
      }
      return Promise.reject(error);
    }
  );
})();
