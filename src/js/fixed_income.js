import { store } from './store.js';
import { Chart, registerables } from 'chart.js';
import { icons } from './icons.js';
import { showAssetDetails } from './components/AssetDetail.js';
import { openUpdateBalances } from './components/UpdateBalances.js';
Chart.register(...registerables);

let ladderChart = null;
let allocationChart = null;

export function renderFixedIncome(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Initial Render
    _render(container);

    // Subscribe to store updates
    store.subscribe(() => {
        // Only re-render if the container is still in the DOM (active tab)
        if (document.getElementById(containerId)) {
            _render(document.getElementById(containerId));
        }
    });
}

function _render(container) {
    const state = store.getState().fixedIncome;
    // Filter OUT Treasury assets (they have their own dashboard) and Reserve assets
    const assets = state.assets
        .filter(a => !a.type.toLowerCase().includes('tesouro') && !a.isReserve)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Calculations
    const totalInvested = assets.reduce((acc, a) => acc + a.investedValue, 0);
    const totalBalance = assets.reduce((acc, a) => acc + a.currentBalance, 0);
    const totalProfit = totalBalance - totalInvested;
    const profitPerc = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    container.innerHTML = `
        <div class="dashboard-grid">
            <!-- Summary Cards -->
            <div class="card md-col-span-6">
                <div class="card-header">
                   <div style="display:flex; gap:0.5rem; align-items:center;">
                      <div style="color:var(--primary-color)">${icons.clipboard}</div>
                      <span class="card-title">Patrimônio Renda Fixa</span>
                   </div>
                </div>
                <div class="card-value">R$ ${formatCurrency(totalBalance)}</div>
            </div>

            <div class="card md-col-span-6">
                <div class="card-header">
                     <span class="card-title">Rentabilidade Total</span>
                </div>
                <div class="card-value" style="color: ${totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    R$ ${formatCurrency(totalProfit)}
                    <span style="font-size: 0.9rem; font-weight: 500; margin-left: 0.5rem;">
                       (${profitPerc.toFixed(2)}%)
                    </span>
                </div>
            </div>

            <!-- Charts -->
            <div class="card md-col-span-6">
                 <div class="card-header"><span class="card-title">Bond Ladder (Vencimentos)</span></div>
                 <div style="height: 200px;"><canvas id="bondLadderChart"></canvas></div>
            </div>
            
            <div class="card md-col-span-6">
                 <div class="card-header"><span class="card-title">Alocação por Indexador</span></div>
                 <div style="height: 200px; display:flex; justify-content:center;"><canvas id="fiAllocationChart"></canvas></div>
            </div>

            <!-- Asset List -->
            <div class="card col-span-12">
                <div class="card-header">
                    <span class="card-title" style="border-left: 4px solid var(--primary-color); padding-left: 0.5rem;">Meus Títulos</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-ghost" id="btn-history-fi" style="padding: 0.5rem; color: var(--text-secondary);" title="Histórico">
                            ${icons.history}
                        </button>
                        <button class="btn btn-primary" id="btn-update-balances" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
                            Atualizar Saldos
                        </button>
                    </div>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.85rem;">
                                <th style="padding: 1rem;">ATIVO</th>
                                <th style="padding: 1rem;">EMISSOR</th>
                                <th style="padding: 1rem;">VALOR ATUAL</th>
                                <th style="padding: 1rem;">RENTAB.</th>
                                <th style="padding: 1rem;">VENCIMENTO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assets.map(asset => renderAssetRow(asset)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    renderFixedIncomeCharts(assets);

    // Attach Events
    const rows = container.querySelectorAll('.asset-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            showAssetDetails(row.dataset.id);
        });
    });

    const btnUpdate = document.getElementById('btn-update-balances');
    if (btnUpdate) {
        btnUpdate.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling if needed
            openUpdateBalances();
        });
    }

    const btnHistory = document.getElementById('btn-history-fi');
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            import('./components/ClosedAssets.js').then(module => module.openClosedAssets());
        });
    }
}

function renderAssetRow(asset) {
    const daysToMaturity = getDaysDiff(new Date(), new Date(asset.dueDate));
    const isExpired = daysToMaturity <= 0;
    const isWarning = daysToMaturity > 0 && daysToMaturity < 15;

    let statusStyle = '';
    if (isExpired) statusStyle = 'background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--danger-color);';
    else if (isWarning) statusStyle = 'background-color: rgba(245, 158, 11, 0.1); border-left: 4px solid var(--warning-color);';

    // Sanitize
    const curBal = Number.isFinite(asset.currentBalance) ? asset.currentBalance : 0;
    const invVal = Number.isFinite(asset.investedValue) ? asset.investedValue : 0;

    const profit = curBal - invVal;
    const profitP = invVal > 0 ? (profit / invVal) * 100 : 0;

    return `
        <tr class="asset-row" data-id="${asset.id}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; ${statusStyle}">
            <td style="padding: 1rem;">
                <div style="font-weight: 600; color: var(--primary-color);">${asset.type}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${asset.indexer} ${asset.rate}%</div>
            </td>
            <td style="padding: 1rem;">${asset.issuer}</td>
            <td style="padding: 1rem; font-weight: 500;">R$ ${formatCurrency(curBal)}</td>
             <td style="padding: 1rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                ${profitP.toFixed(2)}%
            </td>
            <td style="padding: 1rem;">
                <div>${formatDate(asset.dueDate)}</div>
                <div style="font-size: 0.75rem; color: ${isExpired ? 'var(--danger-color)' : (isWarning ? 'var(--warning-color)' : 'var(--text-secondary)')}; font-weight: 500;">
                   ${isExpired ? 'Vencido' : `${daysToMaturity} dias`}
                </div>
            </td>
        </tr>
    `;
}

// --- Charts ---
function renderFixedIncomeCharts(assets) {
    const ladderCtx = document.getElementById('bondLadderChart')?.getContext('2d');
    const allocCtx = document.getElementById('fiAllocationChart')?.getContext('2d');

    if (!ladderCtx || !allocCtx) return;

    // 1. Bond Ladder Data
    const ladderData = {};
    const currentYear = new Date().getFullYear();
    // Initialize for current year and next two years
    for (let i = 0; i < 3; i++) {
        ladderData[currentYear + i] = 0;
    }
    assets.forEach(a => {
        const year = new Date(a.dueDate).getFullYear();
        if (ladderData.hasOwnProperty(year)) { // Only count for the years we are displaying
            ladderData[year] += a.currentBalance;
        }
    });

    // 2. Allocation Data
    const allocData = {};
    assets.forEach(a => {
        const type = a.indexer; // e.g. "IPCA +", "CDI"
        allocData[type] = (allocData[type] || 0) + a.currentBalance;
    });

    // Destroy old charts
    if (ladderChart) ladderChart.destroy();
    if (allocationChart) allocationChart.destroy();

    // Render Ladder
    ladderChart = new Chart(ladderCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(ladderData),
            datasets: [{
                label: 'Vencimentos (R$)',
                data: Object.values(ladderData),
                backgroundColor: '#004aad',
                borderRadius: 8, // Rounded bars
                barPercentage: 0.6, // Thinner, more elegant bars
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (ctx) => ` R$ ${ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                    ticks: { font: { size: 11, family: "'Inter', sans-serif" } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, family: "'Inter', sans-serif" } }
                }
            }
        }
    });

    // Render Allocation (Pill Style)
    // Calculate percentages for legend
    const totalAlloc = Object.values(allocData).reduce((a, b) => a + b, 0);

    allocationChart = new Chart(allocCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(allocData),
            datasets: [{
                data: Object.values(allocData),
                backgroundColor: ['#004aad', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                borderWidth: 0,
                borderRadius: 20, // Pill ends
                spacing: 8, // Space between pills
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Thin ring
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        font: { family: "'Inter', sans-serif", size: 12 },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    const value = data.datasets[0].data[i];
                                    const percentage = totalAlloc > 0 ? (value / totalAlloc) * 100 : 0;
                                    return {
                                        text: `${label}   ${Math.round(percentage)}%`,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.backgroundColor,
                                        lineWidth: 0,
                                        hidden: isNaN(value) || meta.data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const val = context.parsed;
                            return ` ${context.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            layout: { padding: 10 }
        }
    });
}

// Helpers
function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        if (typeof dateStr === 'string' && dateStr.includes('-') && dateStr.length === 10) {
            const [y, m, d] = dateStr.split('T')[0].split('-');
            const localDate = new Date(y, m - 1, d);
            return localDate.toLocaleDateString('pt-BR');
        }
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch (e) { return dateStr || ''; }
}

function getDaysDiff(d1, d2) {
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
