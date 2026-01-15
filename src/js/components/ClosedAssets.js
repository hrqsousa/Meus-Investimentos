import { Modal } from './Modal.js';
import { store } from '../store.js';
import { showAssetDetails } from './AssetDetail.js';
import { icons } from '../icons.js';

let modal = new Modal();

export function openClosedAssets() {
    let currentFilter = 'all'; // all, fixed, treasury, reserve, variable
    let searchQuery = '';

    const renderList = () => {
        const state = store.getState();

        // Aggregate all closed assets //
        // 1. Fixed Income (includes Treasury and Reserve)
        const fixedClosed = (state.fixedIncome.closedAssets || []).map(a => ({ ...a, _source: 'fixed' }));

        // 2. Variable Income
        const variableClosed = (state.variableIncome.closedAssets || []).map(a => ({ ...a, _source: 'variable' }));

        const allAssets = [...fixedClosed, ...variableClosed];

        // Filter logic
        let filtered = allAssets.filter(asset => {
            const type = (asset.type || '').toLowerCase();
            const source = asset._source;

            // Type Checks
            const isVariable = source === 'variable';
            const isReserve = !!asset.isReserve; // Assuming Fixed Income assets have this flag
            const isTreasury = type.includes('tesouro');
            const isFixed = source === 'fixed' && !isTreasury && !isReserve;

            // Category Filter
            if (currentFilter !== 'all') {
                if (currentFilter === 'variable' && !isVariable) return false;
                if (currentFilter === 'reserve' && !isReserve) return false;
                if (currentFilter === 'treasury' && !isTreasury) return false;
                if (currentFilter === 'fixed' && !isFixed) return false;
            }

            // Search Filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const name = (asset.issuer || asset.ticker || '').toLowerCase() + ' ' + type;
                return name.includes(q);
            }

            return true;
        });

        // Sort by Last Update (Sale Date)
        filtered.sort((a, b) => new Date(b.lastUpdate || b.dueDate) - new Date(a.lastUpdate || a.dueDate));

        const listContainer = document.getElementById('closed-assets-list');
        if (!listContainer) return;

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum ativo encontrado.</div>`;
            return;
        }

        listContainer.innerHTML = filtered.map(asset => {
            const lastHistory = (asset.history || [])[asset.history.length - 1];
            const dateStr = lastHistory ? new Date(lastHistory.date).toLocaleDateString() : 'N/A';

            // Profit Calc
            const history = asset.history || [];
            const totalBuy = history.filter(h => h.type === 'buy' || h.type === 'contribution').reduce((acc, h) => acc + (h.value || 0), 0);
            const totalSell = history.filter(h => h.type === 'sell').reduce((acc, h) => acc + (h.value || 0), 0);

            const profit = totalSell - totalBuy;
            const profitP = totalBuy > 0 ? (profit / totalBuy) * 100 : 0;

            const title = getTitleName(asset);
            const subtitle = asset.ticker ? asset.type : asset.issuer;

            return `
                <div class="closed-asset-item" data-id="${asset.id}" data-source="${asset._source}" style="
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 1rem; border-bottom: 1px solid var(--border-color);
                    cursor: pointer; transition: background 0.2s;
                ">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${title}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                            ${subtitle} • Encerrado em ${dateStr}
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <div>
                            <div style="font-weight: 600;">R$ ${totalSell.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            <div style="font-size: 0.8rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${profit > 0 ? '+' : ''}${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${profitP.toFixed(2)}%)
                            </div>
                        </div>
                        <button class="btn-revert-action" data-id="${asset.id}" data-source="${asset._source}" style="
                            background: transparent; border: 1px solid var(--border-color); color: var(--text-primary);
                            padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 500; cursor: pointer;
                            transition: all 0.2s;
                        ">
                            Reverter
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Clicks (Row Click)
        listContainer.querySelectorAll('.closed-asset-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.btn-revert-action')) return;
                // Variable Income details vs Fixed Income details?
                // For now, AssetDetail handles Fixed Income. 
                // We might need a separate viewer for Variable, or make AssetDetail generic.
                // Given the current architecture, let's try opening the respective detail view.

                const source = el.dataset.source;
                modal.close();

                setTimeout(() => {
                    if (source === 'variable') {
                        import('./VariableAssetDetail.js').then(m => m.showVariableAssetDetails(el.dataset.id));
                    } else {
                        showAssetDetails(el.dataset.id);
                    }
                }, 200);
            });
        });

        // Attach Revert Clicks
        listContainer.querySelectorAll('.btn-revert-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Pass source to confirmRevert
                confirmRevert(btn.dataset.id, btn.dataset.source);
            });
        });
    };

    const content = `
        <div style="display: flex; flex-direction: column; gap: 1rem; height: 70vh;">
            <!-- Controls -->
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                 <div class="filter-pill active" data-filter="all">Todos</div>
                 <div class="filter-pill" data-filter="fixed">Renda Fixa</div>
                 <div class="filter-pill" data-filter="treasury">Tesouro</div>
                 <div class="filter-pill" data-filter="reserve">Reserva</div>
                 <div class="filter-pill" data-filter="variable">Renda Variável</div>
            </div>
            
            <div style="position: relative;">
                <input type="text" id="closed-search" class="form-input" placeholder="Buscar ativo..." style="padding-left: 2.5rem;">
                <div style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);">
                    ${icons.search}
                </div>
            </div>

            <!-- List -->
            <div id="closed-assets-list" style="flex: 1; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                <!-- Items -->
            </div>
        </div>
        <style>
            .filter-pill {
                padding: 4px 12px;
                border-radius: 20px;
                background: var(--bg-hover);
                color: var(--text-secondary);
                font-size: 0.85rem;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
            }
            .filter-pill.active {
                background: var(--primary-color);
                color: white;
            }
            .filter-pill:hover:not(.active) {
                border-color: var(--border-color);
            }
            .closed-asset-item:hover {
                background-color: var(--bg-hover);
            }
            .btn-revert-action:hover {
                background-color: var(--bg-hover) !important;
                color: var(--primary-color) !important;
                border-color: var(--primary-color) !important;
            }
        </style>
    `;

    modal.open('Histórico de Ativos', content);
    renderList();

    // Events
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => {
        p.addEventListener('click', () => {
            pills.forEach(x => x.classList.remove('active'));
            p.classList.add('active');
            currentFilter = p.dataset.filter;
            renderList();
        });
    });

    document.getElementById('closed-search').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderList();
    });
}

function getTitleName(asset) {
    if (asset.ticker) return asset.ticker; // Variable Income

    if (asset.type.toLowerCase().includes('tesouro')) {
        const year = new Date(asset.dueDate).getFullYear();
        if (asset.type.toLowerCase().includes('renda+')) {
            return `Tesouro Renda+ ${year - 19}`;
        }
        return `${asset.type} ${year}`;
    }
    return `${asset.type} - ${asset.issuer}`;
}

function confirmRevert(assetId, source) {
    const content = `
        <div style="text-align: center; padding: 1.5rem;">
            <div style="width: 64px; height: 64px; background: rgba(37, 99, 235, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--primary-color)" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                 </svg>
            </div>
            <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">Desfazer Venda?</h3>
            <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.5;">
                O ativo será reativado e voltará para sua carteira com o saldo restaurado.
            </p>
            <div style="display: flex; gap: 1rem;">
                <button class="btn" style="flex: 1; border: 1px solid var(--border-color); padding: 0.85rem;" id="btn-cancel-revert">Cancelar</button>
                <button class="btn btn-primary" style="flex: 1; padding: 0.85rem;" id="btn-confirm-revert">Confirmar</button>
            </div>
        </div>
    `;

    modal.open('Confirmação', content);

    document.getElementById('btn-cancel-revert').addEventListener('click', () => {
        openClosedAssets();
    });

    document.getElementById('btn-confirm-revert').addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-revert');
        try {
            btn.innerText = '...';
            btn.disabled = true;

            // Determine which revert method to call
            if (source === 'variable') {
                if (store.revertVariableSell) {
                    await store.revertVariableSell(assetId);
                } else {
                    throw new Error('Função de reverter Renda Variável não implementada no Store.');
                }
            } else {
                if (store.revertSell) {
                    await store.revertSell(assetId);
                }
            }

            showRevertSuccess();
        } catch (error) {
            console.error(error);
            alert("Erro ao reverter: " + error.message);
            if (btn) {
                btn.innerText = 'Confirmar';
                btn.disabled = false;
            }
        }
    });
}

function showRevertSuccess() {
    const content = `
        <div style="text-align: center; padding: 2rem 1rem;">
            <div style="width: 64px; height: 64px; background: var(--success-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Sucesso!</h3>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">A venda foi desfeita e o ativo foi restaurado.</p>
            
            <button id="btn-revert-success-close" class="btn btn-primary" style="width: 100%; justify-content: center;">Concluir</button>
        </div>
    `;

    modal.open('Sucesso', content);

    setTimeout(() => {
        const btn = document.getElementById('btn-revert-success-close');
        if (btn) {
            btn.addEventListener('click', () => {
                modal.close();
            });
        }
    }, 100);
}
