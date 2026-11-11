document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();
    const email = String(new FormData(form).get('email') || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return showAlert('error', 'Valid email is required');
    try {
      const response = await api.post('/auth/forgot-password', { email });
      showAlert('success', response.data.message || 'Check your email for a reset link.');
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Request failed');
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
