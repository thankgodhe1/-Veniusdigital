document.addEventListener('DOMContentLoaded', async () => {
  if (!(await requireAuthPage())) return;
  const apiBase = String(window.API_BASE_URL || '').replace(/\/$/, '');
  const apiUrl = (path) => `${apiBase}${path}`;
  function currencySymbol(code) {
    const map = { USD: '$', NGN: '₦', GBP: '£', EUR: '€', CAD: '$', AUD: '$', JPY: '¥', CNY: '¥', INR: '₹', ZAR: 'R', GHS: '₵', KES: 'KSh' };
    return map[String(code || 'USD').toUpperCase()] || `${String(code || 'USD').toUpperCase()} `;
  }
  function money(value, code) {
    return `${currencySymbol(code)}${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function initials(name) {
    return String(name || 'User').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'US';
  }
  function findTextElement(label) {
    const nodes = Array.from(document.querySelectorAll('p,h3,h4,h5,span,div'));
    const heading = nodes.find((el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === label.toLowerCase());
    return heading?.parentElement?.querySelector('p:last-child,span:last-child') || null;
  }
  function setUserVisuals(user) {
    const name = user.name || user.username || 'User';
    const code = user.currency_code || 'USD';
    const bal = money(user.balance, code);
    document.getElementById('topBal')?.replaceChildren(document.createTextNode(bal));
    document.getElementById('balFig')?.replaceChildren(document.createTextNode(bal));
    document.querySelectorAll('.sb-top .font-medium, aside .font-medium').forEach((element) => {
      if (!element.querySelector('i')) element.textContent = name;
    });
    document.querySelectorAll('.user-avatar, nav a[title="My Profile"]').forEach((element) => {
      if (!element.querySelector('img')) element.textContent = initials(name);
    });
    const labels = {
      'Account Balance': bal,
      'Profit': money(user.profit, code),
      'Referral Bonus': money(user.ref_bonus, code),
      'Bonus': money(user.bonus, code),
    };
    Object.entries(labels).forEach(([label, value]) => {
      const el = findTextElement(label);
      if (el) el.textContent = value;
    });
  }
  function setNavLinks() {
    const frontendBase = `${window.location.origin}/user`;
    const map = {
      '/dashboard/': `${frontendBase}/dashboard.html`,
      '/dashboard': `${frontendBase}/dashboard.html`,
      '/dashboard/trade': `${frontendBase}/trade.html`,
      '/dashboard/markets': `${frontendBase}/markets.html`,
      '/dashboard/portfolio': `${frontendBase}/portfolio.html`,
      '/dashboard/accounthistory': `${frontendBase}/accounthistory.html`,
      '/dashboard/notification': `${frontendBase}/notification.html`,
      '/dashboard/notifications': `${frontendBase}/notification.html`,
      '/dashboard/deposits': `${frontendBase}/deposits.html`,
      '/dashboard/withdrawals': `${frontendBase}/withdrawals.html`,
      '/dashboard/tradinghistory': `${frontendBase}/tradinghistory.html`,
      '/dashboard/copy-trading': `${frontendBase}/copy-trading.html`,
      '/dashboard/bot-trading': `${frontendBase}/bot-trading.html`,
      '/dashboard/convert': `${frontendBase}/convert.html`,
    };
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      try {
        const pathname = new URL(href, window.location.href).pathname;
        if (map[pathname]) a.setAttribute('href', map[pathname]);
        else if (pathname.startsWith('/dashboard/')) {
          const rest = pathname.slice('/dashboard/'.length);
          a.setAttribute('href', `${frontendBase}/${rest}.html`.replace('.html.html', '.html'));
        }
      } catch (_) {}
    });
  }
  function renderProgress(user) {
    const main = document.getElementById('main-content');
    if (!main) return;
    const box = Array.from(main.querySelectorAll('#main-content > div > div')).find((el) => {
      const text = el.textContent.toLowerCase();
      return text.includes('trading progress') && text.includes('signal strength');
    });
    if (!box) return;
    const progress = Math.max(0, Math.min(100, Number(user.trading_progress || 0)));
    const signal = Math.max(0, Math.min(100, Number(user.signal_strength || 0)));
    const active = user.status === 'active';
    box.style.display = active && (user.trading_progress_enabled || user.signal_strength_enabled) ? '' : 'none';
    const rows = Array.from(box.children).filter((el) => el.querySelector?.('p'));
    const progressRow = rows.find((el) => /trading progress/i.test(el.textContent));
    const signalRow = rows.find((el) => /signal strength/i.test(el.textContent));
    if (progressRow) {
      progressRow.style.display = active && user.trading_progress_enabled ? '' : 'none';
      const percent = Array.from(progressRow.querySelectorAll('p')).find((p) => /%/.test(p.textContent));
      if (percent) percent.textContent = `${progress}%`;
      const fill = progressRow.querySelector('div[style*="height:100%"]');
      if (fill) fill.style.width = `${progress}%`;
    }
    if (signalRow) {
      signalRow.style.display = active && user.signal_strength_enabled ? '' : 'none';
      const percent = Array.from(signalRow.querySelectorAll('p')).find((p) => /%/.test(p.textContent));
      if (percent) {
        percent.textContent = `${signal}%`;
        percent.style.color = signal < 25 ? '#ff3344' : signal < 50 ? '#f5c542' : '#00d47c';
      }
      const color = signal < 25 ? '#ff3344' : signal < 50 ? '#f5c542' : '#00d47c';
      const segments = Array.from(signalRow.querySelectorAll('div')).filter((d) => d.style.height === '14px');
      segments.forEach((seg, index) => {
        const threshold = ((index + 1) / Math.max(1, segments.length)) * 100;
        seg.style.background = threshold <= signal ? color : `${color}2e`;
      });
    }
  }
  function renderBanners(user) {
    const main = document.getElementById('main-content');
    const status = user.verificationStatus || 'not_verified';
    const kycIcon = document.querySelector('.kyc-pulse-icon');
    if (kycIcon) {
      kycIcon.href = `${window.location.origin}/user/verify-account.html`;
      const icon = kycIcon.querySelector('i');
      if (status === 'verified') {
        kycIcon.removeAttribute('href');
        kycIcon.style.pointerEvents = 'none';
        kycIcon.style.cursor = 'default';
        kycIcon.style.color = '#00d47c';
        kycIcon.style.background = 'rgba(0,212,124,.08)';
        kycIcon.style.borderColor = 'rgba(0,212,124,.25)';
        kycIcon.title = 'Account verified';
        if (icon) icon.className = 'fa-solid fa-circle-check';
      } else if (status === 'pending') {
        kycIcon.style.color = '#f5c542';
        kycIcon.style.background = 'rgba(245,197,66,.08)';
        kycIcon.style.borderColor = 'rgba(245,197,66,.25)';
        kycIcon.title = 'Verification pending';
        if (icon) icon.className = 'fa-solid fa-hourglass-half';
      } else {
        kycIcon.style.color = '#f87171';
        kycIcon.style.background = '#1f0d0d';
        kycIcon.style.borderColor = '#3d1a1a';
        kycIcon.title = 'Verify your identity';
        if (icon) icon.className = 'fa-solid fa-triangle-exclamation';
      }
    }
    if (!main) return;
    const children = Array.from(main.querySelector(':scope > div')?.children || []);
    const candidates = children.filter((el) => /Identity Verification Required|this is the message banner|Trading progress|Signal strength/i.test(el.textContent));
    const verification = candidates.find((el) => /Identity Verification Required/i.test(el.textContent));
    const message = candidates.find((el) => /this is the message banner/i.test(el.textContent));
    const progress = candidates.find((el) => /Trading progress/i.test(el.textContent) && /Signal strength/i.test(el.textContent));
    if (verification) {
      if (status === 'verified' && user.verificationBannerDismissed) verification.style.display = 'none';
      else {
        verification.style.display = '';
        const title = verification.querySelector('p');
        const desc = verification.querySelectorAll('p')[1];
        const icon = verification.querySelector('.fa-solid');
        const button = verification.querySelector('a');
        if (status === 'pending') {
          if (title) title.textContent = 'KYC Under Review';
          if (desc) desc.textContent = 'Your identity documents have been submitted and are being reviewed. This usually takes 1–2 business days.';
          if (icon) icon.className = 'fa-solid fa-hourglass-half';
          if (button) { button.textContent = 'View Status'; button.href = '/user/verify-account.html'; }
        } else if (status === 'verified') {
          verification.style.display = 'none';
          if (title) title.textContent = 'Verification Approved';
          if (desc) desc.textContent = 'Your KYC has been approved and your account is verified.';
          if (icon) icon.className = 'fa-solid fa-circle-check';
          if (button) button.textContent = 'Verified';
          verification.querySelector('[style*="background"]')?.style.setProperty('background', 'rgba(0,212,124,.08)');
        } else {
          if (title) title.textContent = 'Identity Verification Required';
          if (desc) desc.textContent = 'Complete KYC to unlock deposits, withdrawals, and full platform access.';
          if (icon) icon.className = 'fa-solid fa-triangle-exclamation';
          if (button) button.textContent = 'Verify Now';
        }
      }
    }
    if (message) {
      const enabled = Boolean(user.dashboardBanner?.enabled);
      message.style.display = enabled ? '' : 'none';
      const text = message.querySelector('p:last-of-type');
      if (text) text.textContent = user.dashboardBanner?.message || '';
      const type = user.dashboardBanner?.type || 'warning';
      const palette = {
        warning: ['#f59e0b', 'fa-triangle-exclamation'],
        success: ['#00d47c', 'fa-circle-check'],
        danger: ['#ff4560', 'fa-circle-exclamation'],
      }[type];
      if (palette) {
        const icon = message.querySelector('.fa-solid');
        if (icon) icon.className = `fa-solid ${palette[1]}`;
        const holder = icon?.parentElement;
        if (holder) {
          holder.style.color = palette[0];
          holder.style.background = `${palette[0]}1f`;
          holder.style.borderColor = `${palette[0]}4d`;
        }
        const banner = message.querySelector('div[style*="display:flex"]');
        if (banner) {
          banner.style.background = `linear-gradient(90deg,${palette[0]}14 0%,${palette[0]}08 100%)`;
          banner.style.borderColor = `${palette[0]}40`;
        }
      }
    }
    if (progress) {
      const show = user.status === 'active' && Boolean(user.trading_progress_enabled || user.signal_strength_enabled);
      progress.style.display = show ? '' : 'none';
    }
    if (message && user.status !== 'active') message.style.display = 'none';
    if (verification) {
      const close = verification.querySelector('button');
      if (close) {
        close.onclick = async (event) => {
          event.preventDefault();
          verification.style.display = 'none';
          if (status === 'verified') {
            try { await api.post('/user/dashboard/verification-banner/dismiss'); } catch (_) {}
          }
        };
      }
    }
  }
  async function loadDashboard() {
    const response = await api.get('/user/dashboard');
    const data = response.data || {};
    const user = data.user || data;
    localStorage.setItem('user', JSON.stringify(user));
    setUserVisuals(user);
    setNavLinks();
    renderBanners(user);
    renderProgress(user);
    updateBadge(data.unreadCount);
    return user;
  }
  function updateBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const value = Number(count || 0);
    badge.textContent = value > 99 ? '99+' : String(value);
    badge.style.display = value > 0 ? '' : 'none';
  }
  async function refreshUnread() {
    try {
      const response = await api.get('/user/dashboard/notifications/unread');
      updateBadge(response.data?.count || 0);
      const panel = document.getElementById('notifPanel');
      if (panel?.classList.contains('open') && typeof loadNotifs === 'function') loadNotifs();
    } catch (_) {}
  }

  // One-notification-at-a-time behavior: clicking an unread item marks only that
  // notification read, updates the badge, then follows its destination.
  window.openNotifItem = async function(id, url) {
    try {
      const response = await api.post(`/user/dashboard/notifications/${encodeURIComponent(id)}/read`);
      updateBadge(response.data?.unreadCount || 0);
    } catch (_) {}
    if (url && url !== '#') {
      const destination = new URL(url, window.location.href);
      const pathname = destination.pathname;
      if (pathname === '/dashboard' || pathname === '/dashboard/') window.location.href = `${window.location.origin}/user/dashboard.html`;
      else if (pathname.startsWith('/dashboard/')) window.location.href = `${window.location.origin}/user/${pathname.slice('/dashboard/'.length)}.html`.replace('.html.html', '.html');
      else if (pathname.startsWith('/user/')) window.location.href = `${window.location.origin}${pathname}`;
      else window.location.href = destination.href;
    }
  };

  window.markRead = async function() {
    try {
      await api.post('/user/dashboard/notifications/read-all');
      updateBadge(0);
      if (typeof loadNotifs === 'function') loadNotifs();
      if (typeof showToast === 'function') showToast('All marked as read', 'green');
    } catch (_) {}
  };

  // Keep the page responsive to push events and tab changes.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'DIGITAL_GROWNT_NOTIFICATION') refreshUnread();
    });
  }
  window.addEventListener('focus', refreshUnread);
  setInterval(refreshUnread, 15000);

  try {
    await loadDashboard();
    await setupPushIfNeeded();
    await refreshUnread();
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      await logout();
      return;
    }
    console.error('Dashboard initialization failed:', error);
  }
});
