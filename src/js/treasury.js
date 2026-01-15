import { store } from './store.js';
import { Chart, registerables } from 'chart.js';
import { icons } from './icons.js';
// import { openUpdateBalances } from './components/UpdateBalances.js'; 
// We might need a specific update balances for Treasury later, but prompt said "similar to fixed income", so maybe reuse for now if safe.
// Wait, prompt said: "Botão de atualizar saldos... diferença é que em cima quero filtros de acordo com os títulos que temos"
// We'll likely need to refactor UpdateBalances or make a new one. For now I'll implement the main screen first.

Chart.register(...registerables);

let allocationChart = null;
let currentFilter = 'all';

export function renderTreasury(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Initial Render
    _render(container);

    // Subscribe
    const unsub = store.subscribe(() => {
        if (document.getElementById(containerId)) {
            _render(document.getElementById(containerId));
        }
    });
}

function _render(container) {
    // 1. Get Assets & Aggregate
    const allAssets = store.getState().fixedIncome.assets; // Treasury uses same store array?
    // Filter specifically for Treasury types if they are mixed. 
    // contribution.js saves with type label: "Tesouro Selic", "Tesouro IPCA+", etc.
    const treasuryAssets = allAssets.filter(a => a.type.toLowerCase().includes('tesouro'));

    const aggregated = aggregateAssets(treasuryAssets);
    const filtered = filterAssets(aggregated, currentFilter);

    // 2. Calculations
    const totalBalance = treasuryAssets.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);
    const totalInvested = treasuryAssets.reduce((sum, a) => sum + (parseFloat(a.investedValue) || 0), 0);
    const profit = totalBalance - totalInvested;
    const profitPerc = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    // 3. HTML
    container.innerHTML = `
        <div class="dashboard-grid">
            
            <!-- Cards -->
            <div class="card md-col-span-6">
                <div class="card-header">
                   <div style="display:flex; gap:0.5rem; align-items:center;">
                      <div style="color:var(--primary-color)">${icons.building}</div>
                      <span class="card-title">Patrimônio Tesouro</span>
                   </div>
                </div>
                <div class="card-value">R$ ${formatCurrency(totalBalance)}</div>
            </div>

            <div class="card md-col-span-6">
                <div class="card-header"><span class="card-title">Rentabilidade Total</span></div>
                <div class="card-value" style="color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                    R$ ${formatCurrency(profit)}
                    <span style="font-size: 0.9rem; font-weight: 500; margin-left: 0.5rem;">
                       (${profitPerc.toFixed(2)}%)
                    </span>
                </div>
            </div>

            <!-- Allocation Chart -->
            <div class="card col-span-12">
                 <div class="card-header"><span class="card-title">Alocação por Tipo</span></div>
                 <div id="treasuryAllocationChart" style="margin-top: 1rem;"></div>
            </div>

            <!-- List Section -->
            <div class="card col-span-12">
                <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
                    <span class="card-title" style="border-left: 4px solid var(--primary-color); padding-left: 0.5rem;">Meus Títulos</span>
                    
                    <!-- Filters -->
                    <div class="filter-group" style="display: flex; gap: 0.5rem; overflow-x: auto;">
                        ${renderFilterButton('all', 'Todos')}
                        ${renderFilterButton('selic', 'Selic')}
                        ${renderFilterButton('ipca', 'IPCA+')}
                        ${renderFilterButton('pre', 'Pré-Fixado')}
                        ${renderFilterButton('renda', 'Renda+')}
                    </div>

                    <div style="margin-left: auto; display: flex; gap: 0.5rem;">
                         <button class="btn btn-ghost" id="btn-history-tr" style="padding: 0.5rem; color: var(--text-secondary);" title="Histórico">
                            ${icons.history}
                        </button>
                        <button class="btn btn-primary" id="btn-update-treasury" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
                            Atualizar Saldos
                        </button>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.85rem;">
                                <th style="padding: 1rem;">TÍTULO</th>
                                <th style="padding: 1rem;">QUANTIDADE</th>
                                <th style="padding: 1rem;">VALOR ATUAL</th>
                                <th style="padding: 1rem;">RENTAB.</th>
                                <th style="padding: 1rem;">VENCIMENTO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length > 0 ? filtered.map(item => renderRow(item)).join('') : `
                                <tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum título encontrado.</td></tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;

    // 4. Render Chart
    renderAllocationChart(aggregated);

    // 5. Events
    attachEvents(container, aggregated);
}

function aggregateAssets(assets) {
    const map = {};

    assets.forEach(asset => {
        const name = getTitleName(asset);
        if (!map[name]) {
            map[name] = {
                name: name,
                type: asset.type,
                dueDate: asset.dueDate,
                qty: 0,
                invested: 0,
                balance: 0,
                ids: [] // Store IDs for detail view
            };
        }
        map[name].qty += parseFloat(asset.qty) || 0;
        map[name].invested += parseFloat(asset.investedValue) || 0;
        map[name].balance += parseFloat(asset.currentBalance) || 0;
        map[name].ids.push(asset.id);
    });

    return Object.values(map).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function getTitleName(asset) {
    const year = new Date(asset.dueDate).getFullYear();
    const typeLower = asset.type.toLowerCase();

    if (typeLower.includes('renda+')) {
        return `Tesouro Renda+ ${year - 19}`;
    }
    return `${asset.type} ${year}`;
}

function filterAssets(aggregated, filter) {
    if (filter === 'all') return aggregated;
    return aggregated.filter(a => {
        const name = a.name.toLowerCase();
        if (filter === 'selic') return name.includes('selic');
        if (filter === 'ipca') return name.includes('ipca');
        if (filter === 'pre') return name.includes('pré');
        if (filter === 'renda') return name.includes('renda');
        return false;
    });
}

function renderFilterButton(id, label) {
    const active = currentFilter === id ? 'background: var(--primary-color); color: white;' : 'background: var(--bg-color); color: var(--text-primary); border: 1px solid var(--border-color);';
    return `
        <button class="filter-btn" data-id="${id}" style="
            border-radius: 20px; 
            padding: 4px 12px; 
            font-size: 0.8rem; 
            cursor: pointer;
            transition: all 0.2s;
            ${active}
        ">${label}</button>
    `;
}

function safeFormatDate(dateStr) {
    if (!dateStr) return '-';
    // dateStr is usually 'YYYY-MM-DD' or ISO. We want strictly the date part in UTC.
    // If it's YYYY-MM-DD, just split.
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

function safeDaysDiff(targetDateStr) {
    if (!targetDateStr) return 0;

    // Create Date objects treated as UTC to avoid DST/timezone issues
    const now = new Date();
    // Normalize "now" to midnight local, then treat as if it were those numbers in UTC
    // Actually simpler: Set both to midnight and compare time values.

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Parse target strictly
    const parts = targetDateStr.split('T')[0].split('-');
    const target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function renderRow(item) {
    const days = safeDaysDiff(item.dueDate);
    const isExpired = days <= 0;
    const isWarning = days > 0 && days < 15;

    const profit = item.balance - item.invested;
    const profitP = item.invested > 0 ? (profit / item.invested) * 100 : 0;

    return `
        <tr class="treasury-row" data-name="${item.name}" style="border-bottom: 1px solid var(--border-color); cursor: pointer;">
            <td style="padding: 1rem; font-weight: 500;">${item.name}</td>
            <td style="padding: 1rem;">${item.qty.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="padding: 1rem;">R$ ${formatCurrency(item.balance)}</td>
            <td style="padding: 1rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
                ${profitP.toFixed(2)}%
            </td>
            <td style="padding: 1rem;">
                <div>${safeFormatDate(item.dueDate)}</div>
                 <div style="font-size: 0.75rem; color: ${isExpired ? 'var(--danger-color)' : (isWarning ? 'var(--warning-color)' : 'var(--text-secondary)')}; font-weight: 500;">
                   ${isExpired ? 'Vencido' : `${days} dias`}
                </div>
            </td>
        </tr>
    `;
}

function renderAllocationChart(items) {
    const container = document.getElementById('treasuryAllocationChart');
    if (!container) return;

    if (allocationChart) {
        allocationChart.destroy();
        allocationChart = null;
    }

    const map = { 'Selic': 0, 'IPCA+': 0, 'Pré-Fixado': 0, 'Renda+': 0 };

    items.forEach(item => {
        const name = item.name.toLowerCase();
        if (name.includes('selic')) map['Selic'] += item.balance;
        else if (name.includes('ipca')) map['IPCA+'] += item.balance;
        else if (name.includes('pré')) map['Pré-Fixado'] += item.balance;
        else if (name.includes('renda')) map['Renda+'] += item.balance;
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0);

    const labels = Object.keys(map).filter(k => map[k] > 0);
    if (labels.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 1rem;">Sem dados.</div>';
        return;
    }

    // Colors mapping
    const colors = {
        'Selic': '#004aad',
        'IPCA+': '#10b981',
        'Pré-Fixado': '#f59e0b',
        'Renda+': '#8b5cf6'
    };

    const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Generate Chart HTML
    let labelHtml = '';
    let barHtml = '';

    labels.forEach(label => {
        const val = map[label];
        const pct = (val / total) * 100;
        const color = colors[label] || '#999';

        labelHtml += `<span style="color: ${color}">${label}: ${formatMoney(val)} (${pct.toFixed(1)}%)</span>`;
        barHtml += `<div style="width: ${pct}%; background: ${color};" title="${label}"></div>`;
    });

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 8px; font-size: 0.8rem; font-weight: 600;">
            ${labelHtml}
        </div>
        <div style="display: flex; height: 24px; border-radius: 12px; overflow: hidden; width: 100%; background: #f3f4f6;">
            ${barHtml}
        </div>
    `;
}

function attachEvents(container, aggregated) {
    // Filters
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.id;
            _render(container); // Re-render with new filter
        });
    });

    // Row Click (Detail)
    container.querySelectorAll('.treasury-row').forEach(row => {
        row.addEventListener('click', () => {
            const name = row.dataset.name;
            openTreasuryDetail(name, aggregated);
        });
    });

    // Update Balances
    const btnUpd = document.getElementById('btn-update-treasury');
    if (btnUpd) {
        btnUpd.addEventListener('click', () => {
            // Open specific Treasury Update Modal
            import('./components/UpdateBalancesTreasury.js').then(module => {
                module.openUpdateBalancesTreasury();
            });
        });
    }

    const btnHistory = document.getElementById('btn-history-tr');
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            import('./components/ClosedAssets.js').then(module => module.openClosedAssets());
        });
    }
}

// TODO: Implement openTreasuryDetail properly
function openTreasuryDetail(name, aggregated) {
    const item = aggregated.find(i => i.name === name);
    if (item && item.ids.length > 0) {
        // If we have multiple IDs, we should probably pick one as "primary" or handle a virtual asset.
        // For now, let's open the details of the FIRST ID, 
        // BUT we need to Inject the combined history into it if we want to show everything.
        // This is tricky without refactoring AssetDetail.

        // Simpler approach: Just open detailed view of the first asset for now to satisfy flow,
        // knowing that we might miss history from others if they are separate entries.
        // Ideally we merge them in the store or backend.

        import('./components/AssetDetail.js').then(module => {
            module.showAssetDetails(item.ids[0]);
        });
    }
}

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getDaysDiff(d1, d2) {
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
