import { store } from './store.js';
import { icons } from './icons.js';
import { Modal } from './components/Modal.js';
import { openContributionModal } from './contribution.js';
import { openUpdateBalances } from './components/UpdateBalances.js';
import { showAssetDetails } from './components/AssetDetail.js';
import { openClosedAssets } from './components/ClosedAssets.js';

let modal = new Modal();

export function renderReserve(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = store.getState();

    // Loading State
    if (state.isLoading) {
        container.innerHTML = `
            <div class="dashboard-grid">
                 <!-- Stats Cards -->
                 <div class="card col-span-12 md-col-span-4"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
                 <div class="card col-span-12 md-col-span-4"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
                 <div class="card col-span-12 md-col-span-4"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-h1"></div></div>
                 
                 <!-- Table Card -->
                 <div class="card col-span-12">
                    <div class="card-header"><div class="skeleton skeleton-title" style="width: 150px;"></div></div>
                    <div style="display: flex; flex-direction: column; gap: 1px;">
                        <div class="skeleton" style="height: 3.5rem; width: 100%; border-radius: 0;"></div>
                        <div class="skeleton" style="height: 3.5rem; width: 100%; border-radius: 0;"></div>
                        <div class="skeleton" style="height: 3.5rem; width: 100%; border-radius: 0;"></div>
                    </div>
                 </div>
            </div>
        `;
        return;
    }

    const assets = state.fixedIncome.assets;
    const settings = state.reserveSettings;

    // Filter Assets
    // 1. Reserve Assets (CDBs tagged as reserve)
    const reserveAssets = assets.filter(a => a.isReserve);

    // 2. Treasury Selic (if enabled)
    const selicAssets = settings.includeSelic
        ? assets.filter(a => a.type.toLowerCase().includes('selic'))
        : [];

    // Combine (Dedupe if necessary, though Type usually prevents overlap)
    // Using Set to dedupe by ID just in case
    const combinedIds = new Set([...reserveAssets, ...selicAssets].map(a => a.id));
    const displayAssets = assets.filter(a => combinedIds.has(a.id));

    // Sort by Due Date (Closest first)
    displayAssets.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Calculations
    const totalInvested = displayAssets.reduce((sum, a) => sum + (parseFloat(a.investedValue) || 0), 0);
    const totalBalance = displayAssets.reduce((sum, a) => sum + (parseFloat(a.currentBalance) || 0), 0);
    const profit = totalBalance - totalInvested;
    const profitPerc = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    const monthlyCost = settings.monthlyCost || 1; // Avoid div by zero
    const monthsCoverage = totalBalance / monthlyCost;

    // Helper formatting
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatPercent = (val) => `${val.toFixed(2)}%`;

    container.innerHTML = `
        <div class="dashboard-grid">
            <!-- Patrimônio -->
            <div class="card col-span-12 md-col-span-4">
                <div class="card-header"><span class="card-title">Patrimônio da Reserva</span></div>
                <div class="card-value">${formatCurrency(totalBalance)}</div>
            </div>

            <!-- Rentabilidade -->
            <div class="card col-span-12 md-col-span-4">
                 <div class="card-header"><span class="card-title">Rentabilidade</span></div>
                 <div class="card-value ${profit >= 0 ? 'text-success' : 'text-danger'}">
                    ${profit >= 0 ? '+' : ''}${formatCurrency(profit)}
                 </div>
                 <div style="font-size: 0.8rem; ${profitPerc >= 0 ? 'color: var(--success-color);' : 'color: var(--danger-color);'} margin-top: 0.25rem;">
                    ${profitPerc >= 0 ? '+' : ''}${formatPercent(profitPerc)}
                 </div>
            </div>

            <!-- Meses de Cobertura (Blue Card) -->
            <div class="card col-span-12 md-col-span-4" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none;">
                <div class="card-header" style="justify-content: space-between;">
                    <span class="card-title" style="color: rgba(255,255,255,0.9);">Cobertura</span>
                    <button class="btn-icon" id="btnEditMonthlyCost" style="color: white; background: rgba(255,255,255,0.2);">
                        ${icons.edit || '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'}
                    </button>
                </div>
                <div class="card-value" style="color: white;">${monthsCoverage.toFixed(1)} Meses</div>
                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8); margin-top: 0.25rem;">
                    Custo Mensal Base: ${formatCurrency(monthlyCost)}
                </div>
            </div>

            <!-- Asset List (Table) -->
            <div class="card col-span-12">
                 <div class="card-header">
                    <span class="card-title" style="border-left: 4px solid var(--primary-color); padding-left: 0.5rem;">Títulos da Reserva</span>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="btn btn-ghost" id="btn-history-reserve" style="padding: 0.5rem; color: var(--text-secondary);" title="Histórico">
                            ${icons.history}
                        </button>
                        <button class="btn btn-primary" id="btn-update-reserve" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
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
                            ${displayAssets.length === 0
            ? `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum ativo na reserva.</td></tr>`
            : displayAssets.map(asset => renderTableRow(asset)).join('')
        }
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    `;

    // Listeners
    document.getElementById('btnEditMonthlyCost')?.addEventListener('click', () => {
        const currentCost = settings.monthlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <p style="color: var(--text-secondary); font-size: 0.9rem;">
                   Qual é o seu custo de vida mensal estimado?
                </p>
                <div class="form-group">
                    <label class="form-label" style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Custo Mensal (R$)</label>
                    <input type="text" class="form-input money-input" id="inp-monthly-cost" value="${currentCost}" style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color); padding: 0.75rem;">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-ghost" style="flex: 1;" id="btn-cancel-cost">Cancelar</button>
                    <button class="btn btn-primary" style="flex: 1;" id="btn-save-cost">Salvar</button>
                </div>
            </div>
        `;

        modal.open('Editar Custo Mensal', content);

        setTimeout(() => {
            const input = document.getElementById('inp-monthly-cost');

            // Masking Logic (Automatic Comma)
            input.oninput = (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (!value) {
                    e.target.value = '';
                    return;
                }
                value = (Number(value) / 100).toFixed(2) + '';
                value = value.replace('.', ',');
                value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = value;
            };

            input.focus();

            // Handle Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') document.getElementById('btn-save-cost').click();
            };

            document.getElementById('btn-cancel-cost').onclick = () => modal.close();

            document.getElementById('btn-save-cost').onclick = () => {
                const raw = input.value.replace(/\./g, '').replace(',', '.');
                const val = parseFloat(raw);
                if (!isNaN(val) && val > 0) {
                    store.updateReserveSettings({ monthlyCost: val });
                    renderReserve(containerId);
                    modal.close();
                } else {
                    alert("Por favor, insira um valor válido.");
                }
            };
        }, 0);
    });

    // Listeners for Buttons in Header
    document.getElementById('btn-update-reserve')?.addEventListener('click', () => {
        openUpdateBalances({ filter: 'RESERVE' });
    });

    document.getElementById('btn-history-reserve')?.addEventListener('click', () => openClosedAssets());

    // Row Clicks
    document.querySelectorAll('.asset-row').forEach(row => {
        row.addEventListener('click', () => {
            const asset = displayAssets.find(a => a.id === row.dataset.id);
            if (asset) showAssetDetails(asset);
        });
    });
}

function renderTableRow(asset) {
    const isSelic = asset.type.toLowerCase().includes('selic');
    const badge = isSelic ?
        `<span style="background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight:600; margin-left:6px;">Tesouro</span>` :
        '';

    const profitVal = asset.currentBalance - asset.investedValue;
    const profitPerc = asset.investedValue > 0 ? (profitVal / asset.investedValue) * 100 : 0;
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return `
    <tr class="asset-row" data-id="${asset.id}" style="border-bottom: 1px solid var(--border-color); cursor: pointer;">
        <td style="padding: 1rem; font-weight: 600; color: var(--text-primary);">
            ${asset.type} ${badge}
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                ${asset.indexer} ${asset.rate > 0 ? asset.rate + '%' : ''}
            </div>
        </td>
        <td style="padding: 1rem; color: var(--text-secondary);">
            ${asset.issuer || '-'}
        </td>
        <td style="padding: 1rem; font-weight: 600; color: var(--text-primary);">
            ${fmt(asset.currentBalance)}
        </td>
        <td style="padding: 1rem; font-weight: 500; color: ${profitVal >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
             ${profitVal >= 0 ? '+' : ''}${profitPerc.toFixed(2)}%
        </td>
         <td style="padding: 1rem; color: var(--text-secondary);">
             ${new Date(asset.dueDate).toLocaleDateString('pt-BR')}
        </td>
    </tr>
    `;
}
