document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();
    const values = new FormData(form);
    const payload = {
      name: values.get('name'),
      username: values.get('username'),
      email: values.get('email'),
      phone: values.get('phone'),
      gender: values.get('gender'),
      country: values.get('country'),
      currency_code: values.get('currency_code'),
      password: values.get('password'),
      password_confirmation: values.get('password_confirmation'),
      captcha: values.get('captcha'),
      captcha_confirmation: values.get('captcha_confirmation'),
      account: values.getAll('account[]'),
    };
    try {
      const response = await api.post('/auth/register', payload);
      showAlert('success', response.data.message || 'Account created successfully.');
      window.setTimeout(() => { window.location.href = response.data.redirect || './login.html'; }, 1200);
    } catch (error) {
      const data = error.response?.data || {};
      const details = data.errors && typeof data.errors === 'object' ? Object.values(data.errors).join(' · ') : '';
      showAlert('error', details || data.message || 'Registration failed');
    }
  });
});
function clearAlert() {
  document.getElementById('form-alert')?.remove();
}

function showAlert(type, text) {
  clearAlert();
  const box = document.createElement('div');
  box.id = 'form-alert';
  box.className = type === 'success'
    ? 'mb-4 flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300'
    : 'mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300';
  const message = document.createElement('span');
  message.className = 'flex-1 leading-relaxed';
  message.textContent = String(text || '');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'text-current opacity-70 hover:opacity-100 bg-transparent border-0 cursor-pointer text-lg leading-none';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => box.remove());
  box.append(message, close);
  const form = document.querySelector('form');
  if (form) form.parentNode.insertBefore(box, form);
}
