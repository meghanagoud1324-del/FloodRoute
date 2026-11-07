/**
 * =====================================================================
 * FLOODROUTE - Main Application Scripts
 * Shared navigation, mobile toggle, toasts and session management
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initUserSession();
  initMobileToggle();
});

function initNavigation() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPath.endsWith(href)) {
      item.classList.add('active');
    }
  });
}

function initUserSession() {
  const user = FloodAPI.getCurrentUser();
  const userNameEl = document.getElementById('sessionUserName');
  const userRoleEl = document.getElementById('sessionUserRole');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminNav = document.getElementById('adminNavItem');

  if (user) {
    if (userNameEl) userNameEl.textContent = user.fullName || user.username;
    if (userRoleEl) userRoleEl.textContent = user.role === 'ROLE_ADMIN' ? 'GHMC Admin' : 'Citizen Commuter';
    if (adminNav) {
      adminNav.style.display = (user.role === 'ROLE_ADMIN') ? 'flex' : 'none';
    }
  } else {
    if (userNameEl) userNameEl.textContent = 'Guest Citizen';
    if (userRoleEl) userRoleEl.textContent = 'Visitor';
    if (adminNav) adminNav.style.display = 'none';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      FloodAPI.logout();
    });
  }
}

function initMobileToggle() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });

    // Close when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : (type === 'warning' ? '⚠' : 'ℹ'));
  toast.innerHTML = `<span style="font-weight: bold; font-size: 16px;">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

window.showToast = showToast;
