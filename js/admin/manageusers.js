(() => {
  const API = String(window.API_BASE_URL || '').replace(/\/$/, '');

  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])
    );

  const ago = (v) => {
    const d = new Date(v);

    if (Number.isNaN(d.getTime())) return '';

    const s = Math.max(
      0,
      Math.floor((Date.now() - d.getTime()) / 1000)
    );

    if (s < 60) return `${s}s ago`;

    const m = Math.floor(s / 60);

    if (m < 60) return `${m}m ago`;

    const h = Math.floor(m / 60);

    if (h < 24) return `${h}h ago`;

    const day = Math.floor(h / 24);

    return day < 30
      ? `${day}d ago`
      : d.toLocaleDateString();
  };

  const api = (path, options = {}) =>
    fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

  function toast(message, ok = true) {
    const box = document.createElement('div');

    box.style.cssText = `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      padding: 12px 16px;
      border-radius: 10px;
      background: ${ok ? '#0f5132' : '#5b1d26'};
      color: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,.3);
      font-size: .85rem
    `;

    box.textContent = message;

    document.body.appendChild(box);

    setTimeout(() => box.remove(), 3200);
  }

  async function guard() {
    try {
      const r = await api('/auth/me');

      if (!r.ok) throw new Error('auth');

      const u = await r.json();

      if (u.role !== 'ADMIN') {
        location.href = '/login.html';
        return false;
      }

      return true;
    } catch (_) {
      location.href = '/login.html';
      return false;
    }
  }

  function locateTable() {
    return document.querySelector('table tbody');
  }

  let currentPage = 1;

  async function loadUsers() {
    const loadingTbody = locateTable();
    if (loadingTbody) {
      loadingTbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-content-muted"><span class="inline-flex items-center gap-2"><svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity=".25"></circle><path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>Loading users...</span></td></tr>`;
    }
    const search =
      document
        .querySelector('input[type="search"]')
        ?.value
        .trim() || '';

    const selects = [
      ...document.querySelectorAll('select[wire\\:model]')
    ];

    const pageSize =
      Number(
        selects
          .find(
            s => s.getAttribute('wire:model') === 'pagenum'
          )
          ?.value
      ) || 20;

    const sort =
      selects.find(
        s => s.getAttribute('wire:model') === 'orderby'
      )?.value || 'createdAt';

    const direction =
      selects.find(
        s => s.getAttribute('wire:model') === 'orderdirection'
      )?.value || 'desc';

    const r = await api(
      `/admin/dashboard/fetchusers?search=${encodeURIComponent(search)}&page=${currentPage}&limit=${pageSize}&sort=${encodeURIComponent(sort)}&direction=${direction}`
    );

    if (!r.ok) {
      throw new Error('Could not fetch users');
    }

    const data = await r.json();

    const users = data.users || data.data || [];

    const tbody = locateTable();

    if (!tbody) return;

    tbody.innerHTML =
      users
        .map(
          u => `
            <tr class="hover:bg-surface-alt/50 transition-colors">
              <td class="px-4 py-3 align-middle">
                <input
                  type="checkbox"
                  class="rounded border-border text-primary"
                  value="${esc(u._id)}"
                >
              </td>

              <td class="px-4 py-3 text-content font-medium">
                ${esc(u.name || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.username || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.email || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.phone || '')}
              </td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    u.status === 'blocked'
                      ? 'bg-danger-light text-danger'
                      : 'bg-success-light text-success'
                  }"
                >
                  ${esc(u.status || 'active')}
                </span>
              </td>

              <td class="px-4 py-3 text-content-secondary whitespace-nowrap">
                ${esc(ago(u.createdAt))}
              </td>

              <td class="px-4 py-3">
                <a
                  href="/admin/user-details.html?id=${encodeURIComponent(u._id)}"
                  class="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary-hover rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Manage
                </a>
              </td>
            </tr>
          `
        )
        .join('') ||
      `
        <tr>
          <td
            colspan="8"
            class="px-4 py-8 text-center text-content-muted"
          >
            No users found.
          </td>
        </tr>
      `;
  }

  function bind() {
    const search =
      document.querySelector('input[type="search"]');

    let timer;

    search?.addEventListener('input', () => {
      clearTimeout(timer);

      timer = setTimeout(
        () =>
          loadUsers().catch(e =>
            toast(e.message, false)
          ),
        350
      );
    });

    document
      .querySelectorAll('select[wire\\:model]')
      .forEach(s =>
        s.addEventListener('change', () =>
          loadUsers().catch(e =>
            toast(e.message, false)
          )
        )
      );

    const addForm = [
      ...document.querySelectorAll('form')
    ].find(f => f.action.includes('/saveuser'));

    addForm?.addEventListener(
      'submit',
      async e => {
        e.preventDefault();

        const r = await api(
          '/admin/dashboard/saveuser',
          {
            method: 'POST',
            body: new URLSearchParams(
              new FormData(addForm)
            ),
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            }
          }
        );

        const data = await r
          .json()
          .catch(() => ({}));

        if (!r.ok) {
          toast(
            data.message ||
              'Could not create user',
            false
          );
          return;
        }

        toast(
          data.message ||
            'User created successfully'
        );

        setTimeout(
          () => location.reload(),
          700
        );
      }
    );
  }

  function bindPagination() {
    document
      .querySelectorAll(
        '[wire\\:click="nextPage"],[dusk="nextPage.before"],[dusk="nextPage.after"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          currentPage += 1;

          loadUsers().catch(x =>
            toast(x.message, false)
          );
        })
      );

    document
      .querySelectorAll(
        '[wire\\:click^="previousPage"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          currentPage = Math.max(
            1,
            currentPage - 1
          );

          loadUsers().catch(x =>
            toast(x.message, false)
          );
        })
      );

    document
      .querySelectorAll(
        '[wire\\:click^="gotoPage"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          const m = (
            b.getAttribute('wire:click') || ''
          ).match(
            /gotoPage\((\d+)\)/
          );

          if (m) {
            currentPage = Number(m[1]);

            loadUsers().catch(x =>
              toast(x.message, false)
            );
          }
        })
      );
  }

  function normalizeAdminNavigation() {
    const base = `${window.location.origin}/admin`;
    const exact = {
      '/admin/dashboard': `${base}/adminDashboard.html`,
      '/admin/dashboard/': `${base}/adminDashboard.html`,
      '/admin/dashboard/manageusers': `${base}/manageusers.html`,
      '/admin/dashboard/manageusers/': `${base}/manageusers.html`,
      '/admin/dashboard/stock-shares': `${base}/admin-stock-shares.html`,
      '/admin/dashboard/stock-shares/': `${base}/admin-stock-shares.html`,
      '/admin/stock-shares': `${base}/admin-stock-shares.html`,
      '/admin/stock-shares/': `${base}/admin-stock-shares.html`,
      '/admin/stock-shares.html': `${base}/admin-stock-shares.html`
    };
    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (exact[url.pathname]) {
          anchor.href = exact[url.pathname] + url.search + url.hash;
          return;
        }
        if (url.pathname.startsWith('/admin/dashboard/')) {
          const tail = url.pathname.slice('/admin/dashboard/'.length).replace(/^\/+|\/+$/g, '');
          if (tail && !tail.includes('/')) anchor.href = `${base}/${tail}.html${url.search}${url.hash}`;
        }
      } catch (_) {}
    });
  }

  document.addEventListener(
    'DOMContentLoaded',
    async () => {
      if (await guard()) {
        bind();
        bindPagination();
        normalizeAdminNavigation();

        loadUsers().catch(e =>
          toast(e.message, false)
        );
      }
    }
  );
})();


(() => {
  const API = String(window.API_BASE_URL || '').replace(/\/$/, '');

  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])
    );

  const ago = (v) => {
    const d = new Date(v);

    if (Number.isNaN(d.getTime())) return '';

    const s = Math.max(
      0,
      Math.floor((Date.now() - d.getTime()) / 1000)
    );

    if (s < 60) return `${s}s ago`;

    const m = Math.floor(s / 60);

    if (m < 60) return `${m}m ago`;

    const h = Math.floor(m / 60);

    if (h < 24) return `${h}h ago`;

    const day = Math.floor(h / 24);

    return day < 30
      ? `${day}d ago`
      : d.toLocaleDateString();
  };

  const api = (path, options = {}) =>
    fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

  function toast(message, ok = true) {
    const box = document.createElement('div');

    box.style.cssText = `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      padding: 12px 16px;
      border-radius: 10px;
      background: ${ok ? '#0f5132' : '#5b1d26'};
      color: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,.3);
      font-size: .85rem
    `;

    box.textContent = message;

    document.body.appendChild(box);

    setTimeout(() => box.remove(), 3200);
  }

  async function guard() {
    try {
      const r = await api('/auth/me');

      if (!r.ok) throw new Error('auth');

      const u = await r.json();

      if (u.role !== 'ADMIN') {
        location.href = '/login.html';
        return false;
      }

      return true;
    } catch (_) {
      location.href = '/login.html';
      return false;
    }
  }

  function locateTable() {
    return document.querySelector('table tbody');
  }

  let currentPage = 1;

  async function loadUsers() {
    const search =
      document
        .querySelector('input[type="search"]')
        ?.value
        .trim() || '';

    const selects = [
      ...document.querySelectorAll('select[wire\\:model]')
    ];

    const pageSize =
      Number(
        selects
          .find(
            s => s.getAttribute('wire:model') === 'pagenum'
          )
          ?.value
      ) || 20;

    const sort =
      selects.find(
        s => s.getAttribute('wire:model') === 'orderby'
      )?.value || 'createdAt';

    const direction =
      selects.find(
        s => s.getAttribute('wire:model') === 'orderdirection'
      )?.value || 'desc';

    const r = await api(
      `/admin/dashboard/fetchusers?search=${encodeURIComponent(search)}&page=${currentPage}&limit=${pageSize}&sort=${encodeURIComponent(sort)}&direction=${direction}`
    );

    if (!r.ok) {
      throw new Error('Could not fetch users');
    }

    const data = await r.json();

    const users = data.users || data.data || [];

    const tbody = locateTable();

    if (!tbody) return;

    tbody.innerHTML =
      users
        .map(
          u => `
            <tr class="hover:bg-surface-alt/50 transition-colors">
              <td class="px-4 py-3 align-middle">
                <input
                  type="checkbox"
                  class="rounded border-border text-primary"
                  value="${esc(u._id)}"
                >
              </td>

              <td class="px-4 py-3 text-content font-medium">
                ${esc(u.name || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.username || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.email || '')}
              </td>

              <td class="px-4 py-3 text-content-secondary">
                ${esc(u.phone || '')}
              </td>

              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    u.status === 'blocked'
                      ? 'bg-danger-light text-danger'
                      : 'bg-success-light text-success'
                  }"
                >
                  ${esc(u.status || 'active')}
                </span>
              </td>

              <td class="px-4 py-3 text-content-secondary whitespace-nowrap">
                ${esc(ago(u.createdAt))}
              </td>

              <td class="px-4 py-3">
                <a
                  href="/admin/user-details.html?id=${encodeURIComponent(u._id)}"
                  class="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary-hover rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Manage
                </a>
              </td>
            </tr>
          `
        )
        .join('') ||
      `
        <tr>
          <td
            colspan="8"
            class="px-4 py-8 text-center text-content-muted"
          >
            No users found.
          </td>
        </tr>
      `;
  }

  function bind() {
    const search =
      document.querySelector('input[type="search"]');

    let timer;

    search?.addEventListener('input', () => {
      clearTimeout(timer);

      timer = setTimeout(
        () =>
          loadUsers().catch(e =>
            toast(e.message, false)
          ),
        350
      );
    });

    document
      .querySelectorAll('select[wire\\:model]')
      .forEach(s =>
        s.addEventListener('change', () =>
          loadUsers().catch(e =>
            toast(e.message, false)
          )
        )
      );

    const addForm = [
      ...document.querySelectorAll('form')
    ].find(f => f.action.includes('/saveuser'));

    addForm?.addEventListener(
      'submit',
      async e => {
        e.preventDefault();

        const r = await api(
          '/admin/dashboard/saveuser',
          {
            method: 'POST',
            body: new URLSearchParams(
              new FormData(addForm)
            ),
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            }
          }
        );

        const data = await r
          .json()
          .catch(() => ({}));

        if (!r.ok) {
          toast(
            data.message ||
              'Could not create user',
            false
          );
          return;
        }

        toast(
          data.message ||
            'User created successfully'
        );

        setTimeout(
          () => location.reload(),
          700
        );
      }
    );
  }

  function bindPagination() {
    document
      .querySelectorAll(
        '[wire\\:click="nextPage"],[dusk="nextPage.before"],[dusk="nextPage.after"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          currentPage += 1;

          loadUsers().catch(x =>
            toast(x.message, false)
          );
        })
      );

    document
      .querySelectorAll(
        '[wire\\:click^="previousPage"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          currentPage = Math.max(
            1,
            currentPage - 1
          );

          loadUsers().catch(x =>
            toast(x.message, false)
          );
        })
      );

    document
      .querySelectorAll(
        '[wire\\:click^="gotoPage"]'
      )
      .forEach(b =>
        b.addEventListener('click', e => {
          e.preventDefault();

          const m = (
            b.getAttribute('wire:click') || ''
          ).match(
            /gotoPage\((\d+)\)/
          );

          if (m) {
            currentPage = Number(m[1]);

            loadUsers().catch(x =>
              toast(x.message, false)
            );
          }
        })
      );
  }

  document.addEventListener(
    'DOMContentLoaded',
    async () => {
      if (await guard()) {
        bind();

        loadUsers().catch(e =>
          toast(e.message, false)
        );
      }
    }
  );
})();
