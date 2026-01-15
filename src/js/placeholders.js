import { icons } from './icons.js';

export function renderComingSoon(containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
    <div style="
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      height: 60vh; 
      text-align: center;
      color: var(--text-secondary);
      animation: fadeIn 0.5s ease;
    ">
      <div style="
        width: 80px; 
        height: 80px; 
        background: var(--bg-color); 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        margin-bottom: 1.5rem;
        color: var(--primary-color);
      ">
        ${icons.construction}
      </div>
      <h2 style="
        font-size: 1.5rem; 
        color: var(--text-primary); 
        margin-bottom: 0.5rem;
        font-weight: 700;
      ">Em desenvolvimento</h2>
      <p style="max-width: 300px;">
        O módulo de <strong>${title}</strong> está sendo construído para a próxima versão.
      </p>
    </div>
  `;
}
