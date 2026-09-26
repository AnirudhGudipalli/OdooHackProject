/**
 * StockSense — Shared UI utilities
 */

// ── Toast notifications ───────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${escHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); m.setAttribute('aria-hidden', 'false'); }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); m.setAttribute('aria-hidden', 'true'); }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});

// ── Alert inside a container ──────────────────────────────────────────────────
function showAlert(containerId, message, type = 'danger') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('alert-hidden');
}
function hideAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.classList.add('alert-hidden');
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDatetime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Status badges ─────────────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    DRAFT:      'draft',
    WAITING:    'waiting',
    READY:      'ready',
    DONE:       'done',
    CANCELED:   'canceled',
    VALIDATED:  'validated',
  };
  const cls = map[status] || 'draft';
  return `<span class="badge badge-${cls}">${escHtml(status)}</span>`;
}

function stockBadge(qty, reorder) {
  if (qty === 0) return `<span class="badge badge-out-of-stock">OUT OF STOCK</span>`;
  if (qty <= reorder) return `<span class="badge badge-low-stock">LOW STOCK</span>`;
  return `<span class="badge badge-in-stock">IN STOCK</span>`;
}

function movementBadge(type) {
  const map = {
    RECEIPT:      'receipt',
    DELIVERY:     'delivery',
    ADJUSTMENT:   'adjustment',
    TRANSFER_IN:  'transfer-in',
    TRANSFER_OUT: 'transfer-out',
  };
  const cls = map[type] || 'draft';
  return `<span class="badge badge-${cls}">${escHtml(type?.replace('_', ' '))}</span>`;
}

// ── Loading overlay ───────────────────────────────────────────────────────────
function showLoading() {
  let el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
}
function hideLoading() {
  const el = document.getElementById('global-loading');
  if (el) el.classList.add('hidden');
}

// ── Guard: redirect if not logged in ─────────────────────────────────────────
function requireAuth() {
  if (!API.isLoggedIn()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// ── Guard: redirect if wrong role ────────────────────────────────────────────
function requireRole(role) {
  const user = API.getUser();
  if (!user || user.role !== role) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}
