/**
 * StockSense — Sidebar Navigation
 * Renders the correct nav for MANAGER or STAFF.
 */

const NAV = (() => {
  const MANAGER_ITEMS = [
    { label: 'Dashboard',     icon: '📊', href: '/dashboard.html',   section: 'main' },
    { label: 'Products',      icon: '📦', href: '/products.html',    section: 'inventory' },
    { label: 'Receipts',      icon: '📥', href: '/receipts.html',    section: 'operations' },
    { label: 'Deliveries',    icon: '📤', href: '/deliveries.html',  section: 'operations' },
    { label: 'Adjustments',   icon: '🔄', href: '/adjustments.html', section: 'operations' },
    { label: 'Move History',  icon: '📋', href: '/movements.html',   section: 'reports' },
    { label: 'Warehouses',    icon: '🏭', href: '/warehouses.html',  section: 'admin' },
    { label: 'Profile',       icon: '👤', href: '/profile.html',     section: 'account' },
  ];

  const STAFF_ITEMS = [
    { label: 'Dashboard',     icon: '📊', href: '/dashboard.html',   section: 'main' },
    { label: 'Receipts',      icon: '📥', href: '/receipts.html',    section: 'operations' },
    { label: 'Deliveries',    icon: '📤', href: '/deliveries.html',  section: 'operations' },
    { label: 'Inventory Count', icon: '🔄', href: '/adjustments.html', section: 'operations' },
    { label: 'Move History',  icon: '📋', href: '/movements.html',   section: 'reports' },
    { label: 'Profile',       icon: '👤', href: '/profile.html',     section: 'account' },
  ];

  const SECTION_LABELS = {
    main: 'Overview',
    inventory: 'Inventory',
    operations: 'Operations',
    reports: 'Reports',
    admin: 'Administration',
    account: 'Account',
  };

  function render(containerId) {
    const user = API.getUser();
    if (!user) { window.location.href = '/login.html'; return; }

    const container = document.getElementById(containerId);
    if (!container) return;

    const items = user.role === 'MANAGER' ? MANAGER_ITEMS : STAFF_ITEMS;
    const currentPath = window.location.pathname;

    const sections = {};
    items.forEach(item => {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    });

    let html = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">📦</div>
        <div>
          <div class="sidebar-logo-text">StockSense</div>
          <div class="sidebar-logo-sub">Inventory Management</div>
        </div>
      </div>
      <nav class="sidebar-nav">
    `;

    let prevSection = null;
    items.forEach(item => {
      if (item.section !== prevSection) {
        if (SECTION_LABELS[item.section]) {
          html += `<div class="sidebar-section">${SECTION_LABELS[item.section]}</div>`;
        }
        prevSection = item.section;
      }
      const isActive = currentPath === item.href || currentPath.startsWith(item.href.replace('.html', ''));
      html += `
        <a href="${item.href}" class="sidebar-item${isActive ? ' active' : ''}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    });

    html += `</nav>`;

    // User footer + logout
    const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    html += `
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${escHtml(user.name || 'User')}</div>
            <div class="sidebar-user-role">${user.role}</div>
          </div>
        </div>
        <a href="#" id="logout-btn" class="sidebar-item" style="margin-top:4px">
          <span class="icon">🚪</span>
          <span>Logout</span>
        </a>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('logout-btn').addEventListener('click', e => {
      e.preventDefault();
      API.clearSession();
      window.location.href = '/login.html';
    });
  }

  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render };
})();
