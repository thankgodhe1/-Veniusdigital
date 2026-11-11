(() => {
  if (window.__DIGITAL_GROWNT_USER_DETAILS_RUNNING__) return;
  window.__DIGITAL_GROWNT_USER_DETAILS_RUNNING__ = true;

  const API = String(window.API_BASE_URL || '').replace(/\/$/, '');
  const id = new URLSearchParams(location.search).get('id');

  const api = (path, opt = {}) => window.api.request({
    url: path,
    method: opt.method || 'GET',
    data: opt.body instanceof URLSearchParams
      ? opt.body
      : opt.body || undefined,
    headers: {
      Accept: 'application/json',
      ...(opt.headers || {})
    }
  }).then(response => ({
    ok: true,
    status: response.status,
    json: async () => response.data
  })).catch(error => {
    const response = error.response;
    return Promise.reject(Object.assign(error, {
      responseData: response?.data || {}
    }));
  });

  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": ''
      }[c])
    );

  function toast(msg, ok = true) {
    const x = document.createElement('div');

    x.style.cssText = `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 99999;
      padding: 12px 16px;
      border-radius: 10px;
      background: ${ok ? '#0f5132' : '#5b1d26'};
      color: #fff;
      box-shadow: 0 8px 30px rgba(0,0,0,.3);
      font-size: .85rem;
    `;

    x.textContent = msg;
    document.body.appendChild(x);

    setTimeout(() => x.remove(), 3500);
  }

  function setLabel(label, value) {
    const heads = [...document.querySelectorAll('h5')]
      .filter(
        x =>
          x.textContent.trim().toLowerCase() ===
          label.toLowerCase()
      );

    heads.forEach(h => {
      const p = h.parentElement?.querySelector('p,span');
      if (p) p.textContent = value;
    });
  }

  function setInfo(label, value) {
    const rows = [...document.querySelectorAll('div')].filter((element) =>
      element.children.length === 2 &&
      element.children[0]?.textContent.trim().toLowerCase() === label.toLowerCase()
    );
    rows.forEach((row) => { row.children[1].textContent = value; });
  }

  function setDynamicLoadingState() {
    ['Account Balance','Profit','Referral Bonus','Bonus','User Account Status','KYC','Trade Mode','Wallet Connect','Signal Strength','Trading Progress','Dashboard Banner'].forEach((label) => setLabel(label, 'Loading...'));
    ['Fullname','Email Address','Mobile Number','Date of birth','Nationality','Registered'].forEach((label) => setInfo(label, 'Loading...'));
  }

  function setFieldValue(name, value) {
    document.querySelectorAll(`[name=\"${name}\"]`).forEach((field) => {
      if (field.type === 'checkbox' || field.type === 'radio') return;
      field.value = value == null ? '' : String(value);
      field.removeAttribute('placeholder');
    });
  }

  function setCheckboxValue(name, enabled) {
    document.querySelectorAll(`input[type=\"checkbox\"][name=\"${name}\"]`).forEach((field) => {
      field.checked = Boolean(enabled);
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function setFormLoadingState() {
    document.querySelectorAll('form[action]').forEach((form) => {
      form.querySelectorAll('input:not([type=\"hidden\"]), textarea, select').forEach((field) => {
        if (field.type === 'submit' || field.type === 'button') return;
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.disabled = true;
          return;
        }
        field.dataset.dynamicLoading = '1';
        field.disabled = true;
        if (field.tagName === 'SELECT') {
          field.dataset.previousDisabled = field.disabled ? '1' : '0';
        } else {
          field.value = '';
          field.setAttribute('placeholder', 'Loading...');
        }
      });
    });
  }

  function setFieldEnabled(name, enabled) {
    document.querySelectorAll(`[name=\"${name}\"]`).forEach((field) => {
      if (field.type === 'hidden') return;
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.disabled = false;
        return;
      }
      field.disabled = !enabled;
    });
  }

  function populatePersistentForms(u) {
    setFieldValue('winrate', Number(u.win_rate ?? 0));
    setFieldValue('win_rate', Number(u.win_rate ?? 0));

    const signalScore = Number(u.signal_strength_score ?? u.signal_strength ?? 0);
    const signalEnabled = Boolean(u.signal_strength_enabled);
    setFieldValue('signal_strength_score', signalScore);
    setCheckboxValue('signal_strength_enabled', signalEnabled);
    document.querySelectorAll('[name="signal_strength_score"]').forEach((field) => {
      field.disabled = false;
      field.removeAttribute('placeholder');
    });

    const progressScore = Number(u.trading_progress_score ?? u.trade_prog ?? 0);
    const progressEnabled = Boolean(u.trading_progress_enabled);
    setFieldValue('trading_progress_score', progressScore);
    setCheckboxValue('trading_progress_enabled', progressEnabled);
    document.querySelectorAll('[name="trading_progress_score"]').forEach((field) => {
      field.disabled = false;
      field.removeAttribute('placeholder');
    });

    for (let i = 1; i <= 5; i += 1) {
      const enabled = Boolean(u[`code${i}_enabled`]);
      setCheckboxValue(`code${i}_enabled`, enabled);
      setFieldValue(`code${i}_label`, u[`code${i}_label`] ?? '');
      setFieldValue(`code${i}`, u[`code${i}`] ?? '');
      setFieldEnabled(`code${i}_label`, enabled);
      setFieldEnabled(`code${i}`, enabled);
    }

    setFieldValue('notify', u.dashboard_banner_message ?? '');
    setFieldValue('banner_type', u.dashboard_banner_type || 'warning');
    setCheckboxValue('banner_enabled', Boolean(u.dashboard_banner_enabled));

    setFieldValue('username', u.username || '');
    setFieldValue('name', u.name || u.username || '');
    setFieldValue('email', u.email || '');
    setFieldValue('phone', u.phone || '');
    setFieldValue('country', u.country || '');
    setFieldValue('ref_link', u.ref_link || '');
  }

  function normalizeActionPath(action) {
    const value = String(action || '');
    const name = value.split('?')[0].split('/').pop().replace(/\.html$/i, '').toLowerCase();
    const map = {
      topup: '/admin/dashboard/topup',
      winrate: '/admin/dashboard/winRate',
      signalstrength: '/admin/dashboard/signalStrength',
      tradingprogress: '/admin/dashboard/tradingProgress',
      withdrawalcode: '/admin/dashboard/withdrawalcode',
      notify: '/admin/dashboard/notify',
      sendmailsingle: '/admin/dashboard/sendmailsingle',
      addhistory: '/admin/dashboard/AddHistory',
      edituser: '/admin/dashboard/edituser'
    };
    return map[name] || (value.startsWith('/admin/dashboard/') ? value : null);
  }

  function money(v, c) {
    const map = {
      USD: '$',
      NGN: '₦',
      GBP: '£',
      EUR: '€',
      JPY: '¥',
      INR: '₹',
      GHS: '₵',
      KES: 'KSh'
    };

    return `${map[String(c || 'USD').toUpperCase()] || String(c || 'USD') + ' '}${Number(
      v || 0
    ).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  async function load() {
    setDynamicLoadingState();
    setFormLoadingState();
    const r = await api(
      `/admin/dashboard/user-details/${encodeURIComponent(id)}`
    );

    const d = await r.json().catch(() => ({}));

    if (!r.ok || !d.user) {
      toast(d.message || 'User not found', false);
      return;
    }

    const u = d.user;
    const name = u.name || u.username || 'User';
    const code = u.currency_code || 'USD';

    setInfo('Fullname', u.name || u.username || 'Not provided');
    setInfo('Email Address', u.email || 'Not provided');
    setInfo('Mobile Number', u.phone || 'Not provided');
    setInfo('Date of birth', u.dob ? new Date(u.dob).toLocaleDateString() : 'Not provided');
    setInfo('Nationality', u.country || 'Not specified');
    setInfo('Registered', u.createdAt ? new Date(u.createdAt).toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }) : 'Not available');

    document.title = `Manage ${name} — Digital-grownt`;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;

      if (node.nodeValue.includes('Irmaperalta')) {
        node.nodeValue = node.nodeValue.replace(
          /Irmaperalta/g,
          name
        );
      }
    }

    document.querySelectorAll('h1').forEach(h => {
      if (/Irmaperalta|Manage/.test(h.textContent)) {
        h.textContent = name;
      }
    });

    document
      .querySelectorAll('input[name="user_id"]')
      .forEach(x => (x.value = id));

    document.querySelectorAll('form[action]').forEach(f => {
      const action = f.getAttribute('action') || '';

      if (action.includes('topup')) {
        f.querySelector('[name="user_id"]')?.setAttribute(
          'value',
          id
        );
      }
    });

    setLabel(
      'Account Balance',
      money(u.balance ?? u.account_bal, code)
    );

    setLabel(
      'Profit',
      money(u.profit ?? u.roi, code)
    );

    setLabel(
      'Referral Bonus',
      money(u.ref_bonus, code)
    );

    setLabel(
      'Bonus',
      money(u.bonus, code)
    );

    setLabel(
      'User Account Status',
      u.status === 'blocked' ? 'Blocked' : 'Active'
    );

    setLabel(
      'KYC',
      u.verificationStatus === 'verified' || u.isVerified
        ? 'Verified'
        : u.verificationStatus === 'pending'
          ? 'Pending'
          : 'Not Verified'
    );

    setLabel(
      'Trade Mode',
      u.trade_mode === 'off' ? 'Off' : 'On'
    );

    setLabel(
      'Wallet Connect',
      u.wallet_connect_status === 'off' ? 'Off' : 'On'
    );

    setLabel(
      'Signal Strength',
      u.signal_strength_enabled
        ? `${Number(
            u.signal_strength_score ??
              u.signal_strength ??
              0
          )}%`
        : 'Off'
    );

    setLabel(
      'Trading Progress',
      u.trading_progress_enabled
        ? `${Number(
            u.trading_progress_score ??
              u.trade_prog ??
              0
          )}%`
        : 'Off'
    );

    setLabel(
      'Dashboard Banner',
      u.dashboard_banner_enabled ? 'On' : 'Off'
    );

    [...document.querySelectorAll('h5')]
      .find(x => x.textContent.trim() === 'Inv. Plans')
      ?.parentElement?.querySelector('p')
      ?.replaceChildren();

    populatePersistentForms(u);

    document.querySelectorAll('form[action] input, form[action] textarea, form[action] select').forEach((field) => {
      if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') return;
      if (/^code[1-5]$/.test(field.name) || /^code[1-5]_label$/.test(field.name)) return;
      field.disabled = false;
      field.removeAttribute('placeholder');
    });

    const anchors = [...document.querySelectorAll('a[href]')];

    anchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim().toLowerCase();

      if (text === 'login activity') {
        a.setAttribute('href', '#');
        a.onclick = e => e.preventDefault();
      }

      if (text === 'add referral') {
        a.setAttribute('href', '#');
        a.onclick = e => e.preventDefault();
      }

      if (/^(block|unblock)$/.test(text)) {
        a.textContent =
          u.status === 'blocked' ? 'Unblock' : 'Block';

        a.href = `#${u.status === 'blocked' ? 'unblock' : 'block'}`;

        a.onclick = async e => {
          e.preventDefault();

          const path =
            u.status === 'blocked'
              ? `/admin/dashboard/uunblock/${id}`
              : `/admin/dashboard/uublock/${id}`;

          const rr = await api(path);
          const dd = await rr.json().catch(() => ({}));

          if (rr.ok) {
            toast(dd.message || 'Updated');
            setTimeout(() => location.reload(), 700);
          } else {
            toast(dd.message || 'Update failed', false);
          }
        };
      }

      if (
        text.includes('turn off trade') ||
        text.includes('turn on trade')
      ) {
        const next =
          u.trade_mode === 'off' ? 'on' : 'off';

        a.textContent =
          next === 'off'
            ? 'Turn off trade'
            : 'Turn on trade';

        a.href = '#trade';

        a.onclick = async e => {
          e.preventDefault();

          const rr = await api(
            `/admin/dashboard/usertrademode/${id}/${next}`
          );

          const dd = await rr.json().catch(() => ({}));

          if (rr.ok) {
            toast(dd.message || 'Trade mode updated');
            setTimeout(() => location.reload(), 700);
          } else {
            toast(dd.message || 'Update failed', false);
          }
        };
      }

      if (text === 'turn off' || text === 'turn on') {
        if (
          a.closest('div')?.textContent.includes(
            'Wallet Connect'
          )
        ) {
          const next =
            u.wallet_connect_status === 'off'
              ? 'on'
              : 'off';

          a.textContent =
            next === 'off' ? 'Turn Off' : 'Turn On';

          a.href = '#wallet';

          a.onclick = async e => {
            e.preventDefault();

            const rr = await api(
              `/admin/dashboard/userwalletstatus/${id}/${next}`
            );

            const dd = await rr.json().catch(() => ({}));

            if (rr.ok) {
              toast(
                dd.message ||
                  'Wallet status updated'
              );

              setTimeout(
                () => location.reload(),
                700
              );
            } else {
              toast(
                dd.message || 'Update failed',
                false
              );
            }
          };
        }
      }

      if (
        href.includes(
          '/admin/dashboard/resetpswd/'
        )
      ) {
        a.onclick = async e => {
          e.preventDefault();

          const rr = await api(
            `/admin/dashboard/resetpswd/${id}`
          );

          const dd = await rr.json().catch(() => ({}));

          if (rr.ok) {
            toast(
              dd.message ||
                'user password updated successfully!'
            );

            setTimeout(
              () => location.reload(),
              700
            );
          } else {
            toast(
              dd.message || 'Reset failed',
              false
            );
          }
        };
      }

      if (
        href.includes(
          '/admin/dashboard/switchuser/'
        )
      ) {
        a.onclick = async e => {
          e.preventDefault();

          const rr = await api(
            `/admin/dashboard/switchuser/${id}`,
            {
              headers: {
                Accept: 'application/json'
              }
            }
          );

          const dd = await rr.json().catch(() => ({}));

          if (rr.ok && dd.redirect) {
            location.href = dd.redirect;
          } else {
            toast(
              dd.message ||
                'Could not login as user',
              false
            );
          }
        };
      }

      if (
        href.includes(
          '/admin/dashboard/clearacct/'
        )
      ) {
        a.onclick = async e => {
          e.preventDefault();

          if (
            !confirm(
              `You are clearing account for ${name} to ${money(
                0,
                code
              )}.`
            )
          ) {
            return;
          }

          const rr = await api(
            `/admin/dashboard/clearacct/${id}`
          );

          const dd = await rr.json().catch(() => ({}));

          if (rr.ok) {
            toast(
              `Account cleared to ${money(
                0,
                code
              )}`
            );

            setTimeout(
              () => location.reload(),
              700
            );
          } else {
            toast(
              dd.message ||
                'Could not clear account',
              false
            );
          }
        };
      }

      if (
        href.includes(
          '/admin/dashboard/delsystemuser/'
        )
      ) {
        a.onclick = async e => {
          e.preventDefault();

          if (
            !confirm(
              `Are you sure you want to delete ${name}? Everything associated with this account will be lost.`
            )
          ) {
            return;
          }

          const rr = await api(
            `/admin/dashboard/delsystemuser/${id}`,
            {
              headers: {
                Accept: 'application/json'
              }
            }
          );

          const dd = await rr.json().catch(() => ({}));

          if (rr.ok) {
            toast(
              dd.message ||
                'User Account and all associated records deleted successfully!'
            );

            setTimeout(
              () =>
                (location.href =
                  '/admin/manageusers.html'),
              700
            );
          } else {
            toast(
              dd.message ||
                'Could not delete user',
              false
            );
          }
        };
      }
    });

    document
      .querySelectorAll(
        'input[name^="code"][name$=""]'
      )
      .forEach(x => {
        if (/^code[1-5]$/.test(x.name)) {
          x.maxLength = 4;
          x.value = x.value
            .replace(/\D/g, '')
            .slice(0, 4);

          x.inputMode = 'numeric';
          x.pattern = '\\d{0,4}';

          x.addEventListener('input', () => {
            x.value = x.value
              .replace(/\*\*\\\*\*D/g, '')
              .slice(0, 4);
          });
        }
      });

    document
      .querySelectorAll(
        'input[name="winrate"],' +
        'input[name="win_rate"],' +
        'input[name="signal_strength_score"],' +
        'input[name="trading_progress_score"]'
      )
      .forEach(x => {
        x.min = 0;
        x.max = 100;

        x.addEventListener('keydown', e => {
          if (
            ['-', 'e', 'E', '+'].includes(e.key)
          ) {
            e.preventDefault();
          }
        });
      });
  }

  async function bindForms() {
    const endpointMap = {
      topup: '/admin/dashboard/topup',
      winrate: '/admin/dashboard/winRate',
      signalstrength: '/admin/dashboard/signalStrength',
      tradingprogress: '/admin/dashboard/tradingProgress',
      withdrawalcode: '/admin/dashboard/withdrawalcode',
      notify: '/admin/dashboard/notify',
      sendmailsingle: '/admin/dashboard/sendmailsingle',
      addhistory: '/admin/dashboard/AddHistory',
      edituser: '/admin/dashboard/edituser'
    };
    document.querySelectorAll('form[action]').forEach((form) => {
      if (form.dataset.apiBound === '1') return;
      const endpoint = normalizeActionPath(form.getAttribute('action'));
      const key = endpoint ? endpoint.split('/').pop().toLowerCase() : '';
      if (!endpoint || !endpointMap[key]) return;
      form.dataset.apiBound = '1';
      const apiEndpoint = endpointMap[key];
      form.setAttribute('action', apiEndpoint);
      const userInput = form.querySelector('[name="user_id"]');
      if (userInput) userInput.value = id;
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        const original = submit?.innerHTML;
        if (submit) { submit.disabled = true; submit.innerHTML = 'Saving...'; }
        try {
          const response = await api(apiEndpoint, {
            method: 'POST',
            body: new URLSearchParams(new FormData(form)),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) { toast(data.message || 'Update failed', false); return; }
          toast(data.message || 'Updated successfully');
          setTimeout(() => location.reload(), 750);
        } catch (error) {
          toast(error.message || 'Update failed', false);
        } finally {
          if (submit) { submit.disabled = false; submit.innerHTML = original || 'Submit'; }
        }
      });
    });
  }

  document.addEventListener(
    'DOMContentLoaded',
    async () => {
      try {
        const me = typeof getCurrentUser === 'function'
          ? getCurrentUser()
          : null;

        if (!me || me.role !== 'ADMIN') {
          const verified = await isLoggedIn();
          const current = typeof getCurrentUser === 'function'
            ? getCurrentUser()
            : null;
          if (!verified || !current || current.role !== 'ADMIN') {
            location.href = '/login.html';
            return;
          }
        }

        if (!id) {
          location.href =
            '/admin/manageusers.html';

          return;
        }

        await bindForms();
        await load();
      } catch (e) {
        toast(
          'Could not load user details',
          false
        );
      }
    }
  );
})();
