import Chart from 'chart.js/auto';
import { icons } from './icons.js';
import { store } from './store.js';

let allocationChart = null;
let topPayersFilter = 'all'; // all, acao, fii, exterior

export function renderDashboard(state) {
  const container = document.getElementById('dashboard-container');
  if (!container) return;

  if (state.isLoading) {
    if (state.isLoading) {
      container.innerHTML = `
         <!-- Card Skeletons -->
         <div class="card col-span-12 md-col-span-3"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
         <div class="card col-span-12 md-col-span-3"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
         <div class="card col-span-12 md-col-span-3"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
         <div class="card col-span-12 md-col-span-3"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
         
         <!-- Chart Skeletons -->
          <div class="card col-span-12 md-col-span-8" style="height: 320px;">
             <div class="skeleton skeleton-title"></div>
             <div class="skeleton" style="width: 100%; height: 220px;"></div>
          </div>
          <div class="card col-span-12 md-col-span-4" style="height: 320px;">
             <div class="skeleton skeleton-title"></div>
             <div class="skeleton" style="width: 200px; height: 200px; border-radius: 50%; margin: 0 auto;"></div>
          </div>
    `;
      return;
    }
    return;
  }

  const { dashboard } = state;

  // Helper for Currency
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  // Generate HTML
  // Generate HTML
  container.innerHTML = `
    <!-- Patrimônio -->
    <div class="card col-span-12 md-col-span-3">
      <div class="card-header">
        <span class="card-title">Patrimônio Total</span>
      </div>
      <div class="card-value">${formatCurrency(dashboard.totalBalance)}</div>
    </div>

    <!-- Lucro -->
    <div class="card col-span-12 md-col-span-3">
      <div class="card-header">
        <span class="card-title">Lucro Acumulado</span>
        <span class="badge ${dashboard.profitPercentage >= 0 ? 'text-success' : 'text-danger'}" style="background: rgba(16, 185, 129, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">
          ${dashboard.profitPercentage >= 0 ? '+' : ''}${formatPercent(dashboard.profitPercentage)}
        </span>
      </div>
      <div class="card-value ${dashboard.profit >= 0 ? 'text-success' : 'text-danger'}">
        ${dashboard.profit >= 0 ? '+' : ''}${formatCurrency(dashboard.profit)}
      </div>
    </div>

    <!-- Meta de Patrimônio (Goal) -->
    <div class="card col-span-12 md-col-span-3" style="background-color: var(--primary-color); color: white;">
        <div class="card-header" style="justify-content: space-between; margin-bottom: 0;">
             <span class="card-title" style="color: white; font-size: 0.95rem;">Meta de Patrimônio</span>
             <button id="btn-edit-goal" class="btn btn-ghost" style="padding: 2px; height: 28px; width: 28px; min-height: unset; color: white; opacity: 0.8; display: flex; align-items: center; justify-content: center;" title="Editar Meta">
                <div style="transform: scale(0.9);">${icons.edit}</div>
             </button>
        </div>
        <div class="card-value" style="color: white; margin-bottom: 0; font-size: 1.4rem; letter-spacing: -0.5px;">${formatCurrency(dashboard.goal)}</div>
        
        <div style="margin-top: 4px;">
             ${dashboard.totalBalance >= dashboard.goal ?
      `<div style="font-weight: bold; margin-bottom: 4px; font-size: 0.85rem;">🎉 Parabéns! Meta Atingida!</div>` :
      `<div style="display:flex; justify-content:space-between; font-size:0.75rem; color: rgba(255,255,255,0.8); margin-bottom: 2px;">
                    <span>Progresso</span>
                    <span>${((dashboard.totalBalance / dashboard.goal) * 100).toFixed(1)}%</span>
                 </div>`
    }
             
             <div style="width:100%; height:6px; background-color: rgba(255,255,255,0.2); border-radius: var(--radius-pill); overflow:hidden;">
                <div style="width: ${Math.min((dashboard.totalBalance / dashboard.goal) * 100, 100)}%; height:100%; background-color: white;"></div>
             </div>
        </div>
    </div>

     <!-- Proventos (Dividends) Year Comparison -->
     ${(() => {
      const proventos = state.proventos || [];
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const currentYearTotal = proventos
        .filter(p => new Date(p.date + 'T00:00:00').getFullYear() === currentYear)
        .reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

      const lastYearTotal = proventos
        .filter(p => new Date(p.date + 'T00:00:00').getFullYear() === lastYear)
        .reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

      let diffHtml = '';

      if (lastYearTotal > 0) {
        const diffPerc = ((currentYearTotal - lastYearTotal) / lastYearTotal) * 100;
        const isPositive = diffPerc >= 0;
        const icon = isPositive ? icons.trendUp : `<div style="transform: rotate(180deg); display: flex;">${icons.trendUp}</div>`;
        const color = 'white';

        diffHtml = `
            <div style="font-size: 0.8rem; font-weight: 600; color: ${color}; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                <div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">${icon}</div>
                <div style="line-height: 1;">${isPositive ? '+' : ''}${diffPerc.toFixed(1)}% vs ${lastYear}</div>
            </div>
            `;
      } else if (currentYearTotal > 0) {
        diffHtml = `
            <div style="font-size: 0.8rem; font-weight: 600; color: white; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                    <div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">${icons.trendUp}</div>
                    <div style="line-height: 1;">vs ${lastYear}</div>
            </div>
            `;
      } else {
        diffHtml = `<div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); margin-top: 4px;">vs ${lastYear}</div>`;
      }

      return `
        <div class="card col-span-12 md-col-span-3" style="background-color: var(--success-color); color: white;">
            <div class="card-header" style="margin-bottom: 0;">
                <span class="card-title" style="color: white; font-size: 0.95rem;">Proventos (${currentYear})</span>
            </div>
            <div class="card-value" style="color: white; margin-bottom: 0;">R$ ${currentYearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            ${diffHtml}
        </div>
        `;
    })()}

    <!-- Alocação Chart -->
    <div class="card col-span-12 md-col-span-4" style="display: flex; flex-direction: column;">
       <div class="card-header"><span class="card-title">Alocação</span></div>
       <div style="flex: 1; position: relative; min-height: 220px; max-height: 260px;">
          <canvas id="allocationChart"></canvas>
       </div>
       <div id="allocation-legend" style="padding: 1.5rem;"></div>
    </div>

    <!-- Top 7 - Maiores Pagadores (12 Meses) -->
    ${(() => {
      // Logic for Top Payers
      const proventos = state.proventos || [];
      const variableAssets = state.variableIncome?.assets || [];

      // 1. Filter Last 12 Months
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      oneYearAgo.setDate(1); // Start of month for consistency? Or exact date? Let's use exact date for "Last 12m" rolling, or just check month diff. 
      // User request: "nos últimos 12 meses". Rolling window is best.

      const recentProventos = proventos.filter(p => {
        const d = new Date(p.date + 'T00:00:00');
        return d >= oneYearAgo && d <= now;
      });

      // 2. Aggregate by Ticker
      const totals = {}; // { ticker: value }
      recentProventos.forEach(p => {
        totals[p.ticker] = (totals[p.ticker] || 0) + (parseFloat(p.value) || 0);
      });

      // 3. Map to Array and Enrich with Type
      let items = Object.entries(totals).map(([ticker, value]) => {
        // Find type
        const asset = variableAssets.find(a => (a.ticker || '').toUpperCase() === ticker.toUpperCase());
        let type = 'Outros';
        // Infer type from asset or fallback
        if (asset) {
          const t = (asset.type || '').toLowerCase();
          if (t.includes('ação') || t.includes('acao')) type = 'Ação';
          else if (t.includes('fii')) type = 'FII';
          else if (t === 'stock' || t === 'bdr' || t === 'etf exterior' || t.includes('exterior')) type = 'Exterior';
          else if (t.includes('cripto') || t.includes('crypto')) type = 'Cripto';
        }
        return { ticker, value, type };
      });

      // 4. Filter by Tab
      if (topPayersFilter === 'acao') items = items.filter(i => i.type === 'Ação');
      else if (topPayersFilter === 'fii') items = items.filter(i => i.type === 'FII');
      else if (topPayersFilter === 'exterior') items = items.filter(i => i.type === 'Exterior');

      // 5. Sort Descending and Take Top 7
      items.sort((a, b) => b.value - a.value);
      const top7 = items.slice(0, 7);
      const maxVal = top7.length > 0 ? top7[0].value : 1; // For bars if we wanted bars, but user layout is list

      // Render
      const totalValue = items.reduce((sum, i) => sum + i.value, 0); // Total filtered

      return `
        <div class="card col-span-12 md-col-span-8">
            <div class="card-header" style="justify-content: space-between; align-items: center; padding-bottom: 0.5rem; border-bottom: none;">
                <span class="card-title">Top 7 - Maiores Pagadores (12 Meses)</span>
                
                <div class="tabs-pills" style="display: flex; gap: 4px; background: var(--bg-color); padding: 4px; border-radius: var(--radius-md);">
                    <button class="tab-pill ${topPayersFilter === 'all' ? 'active' : ''}" data-filter="all" style="border: none; background: ${topPayersFilter === 'all' ? 'var(--surface-color)' : 'transparent'}; box-shadow: ${topPayersFilter === 'all' ? 'var(--shadow-sm)' : 'none'}; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; color: ${topPayersFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.2s;">Todos</button>
                    <button class="tab-pill ${topPayersFilter === 'acao' ? 'active' : ''}" data-filter="acao" style="border: none; background: ${topPayersFilter === 'acao' ? 'var(--surface-color)' : 'transparent'}; box-shadow: ${topPayersFilter === 'acao' ? 'var(--shadow-sm)' : 'none'}; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; color: ${topPayersFilter === 'acao' ? 'var(--text-primary)' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.2s;">Ações</button>
                    <button class="tab-pill ${topPayersFilter === 'fii' ? 'active' : ''}" data-filter="fii" style="border: none; background: ${topPayersFilter === 'fii' ? 'var(--surface-color)' : 'transparent'}; box-shadow: ${topPayersFilter === 'fii' ? 'var(--shadow-sm)' : 'none'}; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; color: ${topPayersFilter === 'fii' ? 'var(--text-primary)' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.2s;">FIIs</button>
                    <button class="tab-pill ${topPayersFilter === 'exterior' ? 'active' : ''}" data-filter="exterior" style="border: none; background: ${topPayersFilter === 'exterior' ? 'var(--surface-color)' : 'transparent'}; box-shadow: ${topPayersFilter === 'exterior' ? 'var(--shadow-sm)' : 'none'}; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; color: ${topPayersFilter === 'exterior' ? 'var(--text-primary)' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.2s;">Ext</button>
                </div>
            </div>

            <div style="overflow-x: auto; padding: 0 1.5rem 1.5rem 1.5rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 1rem 0.5rem 0.75rem 0.5rem; width: 40px;">#</th>
                            <th style="padding: 1rem 0.5rem 0.75rem 0.5rem;">ATIVO</th>
                            <th style="padding: 1rem 0.5rem 0.75rem 0.5rem;">CAT.</th>
                            <th style="padding: 1rem 0.5rem 0.75rem 0.5rem; text-align: right;">TOTAL (12M)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${top7.length === 0 ? `<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum ativo encontrado neste período.</td></tr>` :
          top7.map((item, index) => {
            // Trophy Icons
            let rankIcon = `<span style="display:inline-block; width: 24px; text-align:center; font-weight: 600; color: var(--text-secondary);">${index + 1}</span>`;
            if (index === 0) rankIcon = `<span style="font-size: 1.2rem;">🥇</span>`;
            if (index === 1) rankIcon = `<span style="font-size: 1.2rem;">🥈</span>`;
            if (index === 2) rankIcon = `<span style="font-size: 1.2rem;">🥉</span>`;

            return `
                              <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-color)'" onmouseout="this.style.background='transparent'">
                                  <td style="padding: 1rem 0.5rem; vertical-align: middle;">${rankIcon}</td>
                                  <td style="padding: 1rem 0.5rem; font-weight: 700; color: var(--text-primary); vertical-align: middle;">${item.ticker}</td>
                                  <td style="padding: 1rem 0.5rem; vertical-align: middle;">
                                      <span style="background: var(--bg-color); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); border: 1px solid var(--border-color);">
                                          ${item.type}
                                      </span>
                                  </td>
                                  <td style="padding: 1rem 0.5rem; text-align: right; font-weight: 700; color: var(--success-color); vertical-align: middle;">
                                      +${formatCurrency(item.value)}
                                  </td>
                              </tr>
                              `;
          }).join('')
        }
                    </tbody>
                </table>
               
            </div>
        </div>
        `;
    })()}

    <!-- Top Ativos List -->
    <div class="card col-span-12">
       <div class="card-header"><span class="card-title">Top 10 - Maior Rentabilidade</span></div>
       <div style="overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
               <tr style="text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">
                 <th style="padding: 0.75rem 0.5rem;">#</th>
                 <th style="padding: 0.75rem 0.5rem;">Ativo</th>
                 <th style="padding: 0.75rem 0.5rem;">Cat.</th>
                 <th style="padding: 0.75rem 0.5rem; text-align: right;">Rent.</th>
               </tr>
            </thead>
            <tbody>
              ${dashboard.topAssets.map((asset, index) => `
                 <tr style="border-bottom: 1px solid var(--border-color);">
                   <td style="padding: 0.75rem 0.5rem; color: var(--text-secondary);">${index + 1}</td>
                   <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${asset.name}</td>
                   <td style="padding: 0.75rem 0.5rem;">
                      <span style="background: var(--bg-color); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${asset.ticker || 'N/A'}</span>
                   </td>
                   <td style="padding: 0.75rem 0.5rem; text-align: right; color: var(--success-color); font-weight: 600;">
                     +${formatPercent(asset.percentage)}
                   </td>
                 </tr>
              `).join('')}
            </tbody>
         </table>
       </div>
    </div>
  `;

  // Render Chart & Event Listeners
  setTimeout(() => {
    // Edit Goal Listener
    // Edit Goal Listener
    const btnEditGoal = document.getElementById('btn-edit-goal');
    if (btnEditGoal && !btnEditGoal.dataset.listenerAttached) {
      btnEditGoal.dataset.listenerAttached = 'true';

      btnEditGoal.addEventListener('click', () => {
        import('./components/Modal.js').then(({ Modal }) => {
          const modal = new Modal();
          modal.open('Editar Meta de Patrimônio', `
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div class="form-group">
                                <label class="form-label" style="font-weight: 500;">Nova Meta</label>
                                <div style="position: relative; display: flex; align-items: center;">
                                    <span style="position: absolute; left: 1rem; color: var(--text-secondary); font-weight: 600;">R$</span>
                                    <input type="text" id="goal-input" class="form-input" 
                                           style="padding-left: 3rem; font-weight: 600; font-size: 1.1rem; color: var(--primary-color);" 
                                           value="${dashboard.goal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}" 
                                           placeholder="0,00">
                                </div>
                            </div>
                            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 0.5rem;">
                                <button class="btn btn-ghost" id="cancel-goal" style="flex: 1;">Cancelar</button>
                                <button class="btn btn-primary" id="save-goal" style="flex: 1;">Salvar</button>
                            </div>
                        </div>
                `);

          // Scoped Elements & Mask
          const overlay = modal.overlay;
          const input = overlay.querySelector('#goal-input');
          const btnSave = overlay.querySelector('#save-goal');
          const btnCancel = overlay.querySelector('#cancel-goal');

          setTimeout(() => input.focus(), 100);

          input.oninput = (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (!value) value = '0';

            const numberVal = parseInt(value) / 100;
            e.target.value = numberVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          };

          input.onpaste = (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const digits = pastedText.replace(/\D/g, '');
            if (digits) {
              const val = (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              document.execCommand('insertText', false, val);
            }
          };

          // Save
          btnSave.addEventListener('click', () => {
            const rawValue = input.value.replace(/\./g, '').replace(',', '.');
            const newGoal = parseFloat(rawValue);
            if (!isNaN(newGoal)) {
              store.updateGoal(newGoal);
              modal.close();

              // Show Success Modal
              setTimeout(() => {
                const successModal = new Modal();
                successModal.open('Sucesso', `
                      <div style="display: flex; flex-direction: column; align-items: center; padding: 1rem 0; text-align: center;">
                          <div style="width: 64px; height: 64px; background-color: var(--success-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                          </div>
                          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Meta Atualizada!</h3>
                          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Sua meta de patrimônio foi definida com sucesso.</p>
                          <button id="btn-success-ok" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 0.75rem;">Continuar</button>
                      </div>
                  `);

                setTimeout(() => {
                  const okBtn = successModal.overlay.querySelector('#btn-success-ok');
                  if (okBtn) {
                    okBtn.addEventListener('click', () => successModal.close());
                    okBtn.focus();
                  }
                }, 50);
              }, 300);
            }
          });

          // Cancel
          btnCancel.addEventListener('click', () => modal.close());
        });
      });
    }

    const ctx = document.getElementById('allocationChart');
    if (ctx) {
      if (allocationChart) allocationChart.destroy();

      allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: dashboard.allocation.labels,
          datasets: [{
            data: dashboard.allocation.data,
            backgroundColor: dashboard.allocation.colors,
            borderWidth: 0,
            borderRadius: 20,
            spacing: 5,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '85%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { family: "'Inter', sans-serif", size: 13 },
              bodyFont: { family: "'Inter', sans-serif", size: 13 },
              callbacks: {
                label: function (context) {
                  const value = context.parsed;
                  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                  return ` ${context.label}: ${formatted}`;
                }
              }
            }
          },
          layout: { padding: 10 }
        }
      });

      // Custom HTML Legend
      const legendContainer = document.getElementById('allocation-legend');
      if (legendContainer) {
        const { labels, data, colors } = dashboard.allocation;
        const total = data.reduce((a, b) => a + (parseFloat(b) || 0), 0);

        const itemsHtml = labels.map((label, i) => {
          const val = parseFloat(data[i]) || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;

          return `
               <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-secondary);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${colors[i]}; flex-shrink: 0;"></div>
                  <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                     ${label} <strong style="color: var(--text-primary); margin-left: 2px;">${pct}%</strong>
                  </div>
               </div>
             `;
        }).join('');

        legendContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 0.5rem;">
               ${itemsHtml}
            </div>
          `;
      }
    }

    // Top Payers Tabs Listener
    const tabs = document.querySelectorAll('.tab-pill');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        if (filter && filter !== topPayersFilter) {
          topPayersFilter = filter;
          renderDashboard(store.getState()); // Rerender full dashboard to update card
        }
      });
    });

  }, 0);
}
