import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';

import { store } from './js/store.js';
import { renderDashboard } from './js/dashboard.js';
import { renderComingSoon } from './js/placeholders.js';
import { renderSettings } from './js/settings.js';
import { renderFixedIncome } from './js/fixed_income.js';
import { renderTreasury } from './js/treasury.js';
import { renderReserve } from './js/reserve.js';
import { renderVariableIncome } from './js/variable_income.js';
import { openContributionModal } from './js/contribution.js';
import { icons } from './js/icons.js';

console.log('App initialized');

try {

  // Inject Icons
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.dataset.icon;
    if (icons[iconName]) {
      el.innerHTML = icons[iconName];
    }
  });

  // Restore Theme Preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-mode');
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark-mode');
  } else {
    // Optional: Auto-detect system preference if no saved preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark-mode');
    }
  }

  // Logic to switch content
  function handleNavigation(page) {
    const user = store.getState().user;

    // Route Guard
    if (!user && page !== 'settings') {
      // Force settings if not logged in (logic from previous intent)
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('[data-page="settings"]').forEach(el => el.classList.add('active'));

      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = 'Configurações';

      const contentArea = document.getElementById('content-area');
      if (contentArea) {
        contentArea.innerHTML = '<div id="settings-container"></div>';
        renderSettings('settings-container');
      }
      return;
    }

    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    if (page === 'home') {
      contentArea.innerHTML = '<div id="dashboard-container" class="dashboard-grid animate-enter"></div>';
      renderDashboard(store.getState());
    } else if (page === 'settings') {
      contentArea.innerHTML = '<div id="settings-container" class="animate-enter"></div>';
      renderSettings('settings-container');
    } else if (page === 'fixed') {
      contentArea.innerHTML = '<div id="fixed-income-container" class="animate-enter"></div>';
      renderFixedIncome('fixed-income-container');
    } else if (page === 'treasury') {
      contentArea.innerHTML = '<div id="treasury-container" class="animate-enter"></div>';
      renderTreasury('treasury-container');
    } else if (page === 'reserve') {
      contentArea.innerHTML = '<div id="reserve-container" class="animate-enter"></div>';
      renderReserve('reserve-container');
    } else if (page === 'variable') {
      contentArea.innerHTML = '<div id="variable-container" class="animate-enter"></div>';
      renderVariableIncome('variable-container');
    } else if (page === 'rebalance') {
      contentArea.innerHTML = '<div id="rebalancing-container" class="animate-enter"></div>';
      import('./js/components/Rebalancing.js').then(module => {
        module.renderRebalancing('rebalancing-container');
      });
    } else {
      contentArea.innerHTML = '<div id="generic-container" class="animate-enter"></div>';
      const titleMap = {
        rebalance: 'Rebalanceamento',
        reserve: 'Reserva de Emergência',
        fixed: 'Renda Fixa',
        variable: 'Renda Variável',
        treasury: 'Tesouro Direto',
        menu: 'Menu',
        settings: 'Configurações'
      };
      renderComingSoon('generic-container', titleMap[page] || 'Funcionalidade');
    }
  }

  // Initial Render
  renderDashboard(store.getState());

  // Subscribe to store updates to render active content
  store.subscribe((state) => {
    const activeNav = document.querySelector('.nav-item.active');
    const activePage = activeNav ? activeNav.dataset.page : 'home';
    const contentArea = document.getElementById('content-area');

    if (!contentArea) return;

    if (activePage === 'home') {
      renderDashboard(state);
    } else if (activePage === 'settings') {
      // Re-render settings (e.g. to show User profile after login)
      if (document.getElementById('settings-container')) {
        renderSettings('settings-container');
      }
    } else if (activePage === 'fixed') {
      // Fixed income subscribes internally
    } else if (activePage === 'treasury') {
      if (document.getElementById('treasury-container')) {
        renderTreasury('treasury-container');
      }
    } else if (activePage === 'reserve') {
      if (document.getElementById('reserve-container')) {
        renderReserve('reserve-container');
      }
    } else if (activePage === 'variable') {
      if (document.getElementById('variable-container')) {
        renderVariableIncome('variable-container');
      }
    }
  });

  // Navigation Logic
  const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove active from all
      navItems.forEach(nav => nav.classList.remove('active'));
      // Add active to clicked (and its counterpart)
      const page = item.dataset.page;
      document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

      // Update title
      const titleMap = {
        home: 'Visão Geral',
        rebalance: 'Rebalanceamento',
        reserve: 'Reserva de Emergência',
        fixed: 'Renda Fixa',
        variable: 'Renda Variável',
        treasury: 'Tesouro Direto',
        menu: 'Menu',
        settings: 'Configurações'
      };
      const titleEl = document.getElementById('page-title');
      if (titleEl && titleMap[page]) titleEl.textContent = titleMap[page];

      // Handle Content Switch
      handleNavigation(page);
    });
  });

  // FAB Logic
  const fabBtn = document.querySelector('.fab');
  if (fabBtn) {
    fabBtn.addEventListener('click', () => {
      const activeNav = document.querySelector('.nav-item.active');
      const currentPage = activeNav ? activeNav.dataset.page : 'home';
      openContributionModal(currentPage);
    });
  }

  // Lucide Icons (if available)
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Remove Loading Screen
  const loading = document.getElementById('loading-overlay');
  const app = document.getElementById('app');

  if (loading && app) {
    setTimeout(() => {
      loading.style.opacity = '0';
      app.style.opacity = '1';
      setTimeout(() => {
        if (loading.parentNode) loading.parentNode.removeChild(loading);
      }, 500);
    }, 100);
  }

} catch (e) {
  console.error("Init Error:", e);
  // Emergency unblock
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';
  const app = document.getElementById('app');
  if (app) app.style.opacity = '1';
}
