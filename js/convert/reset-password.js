document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const tokenInput = form.querySelector('[name="token"]');
  const emailInput = form.querySelector('[name="email"]');
  if (tokenInput) tokenInput.value = token;
  if (emailInput && email) emailInput.value = email;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();
    const values = new FormData(form);
    const payload = { token: values.get('token') || token, email: values.get('email'), password: values.get('password'), password_confirmation: values.get('password_confirmation') };
    try {
      const response = await api.post('/auth/reset-password', payload);
      showAlert('success', response.data.message || 'Password updated.');
      window.setTimeout(() => { window.location.href = response.data.redirect || './login.html'; }, 1000);
    } catch (error) {
      const data = error.response?.data || {};
      const details = data.errors && typeof data.errors === 'object' ? Object.values(data.errors).join(' · ') : '';
      showAlert('error', details || data.message || 'Reset failed');
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
