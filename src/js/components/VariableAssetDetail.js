import { Modal } from './Modal.js';
import { Chart } from 'chart.js/auto';
import { store } from '../store.js';
import { openContributionModal } from '../contribution.js';

let modal = new Modal();
let evolutionChart = null;


let currentHistoryPage = 0; // Pagination State

export function showVariableAssetDetails(id) {
    currentHistoryPage = 0; // Reset pagination on open
    const state = store.getState().variableIncome;
    const assets = state.assets || [];
    let asset = assets.find(a => a.id === id);

    if (!asset) {
        const closedAssets = state.closedAssets || [];
        asset = closedAssets.find(a => a.id === id);
    }

    if (!asset) return;

    render(asset);
}

function render(asset) {
    const curBal = parseFloat(asset.currentBalance) || 0;
    const invVal = parseFloat(asset.investedValue) || 1; // Avoid div/0
    const profit = curBal - invVal;
    const profitP = (profit / invVal) * 100;

    const qty = parseFloat(asset.qty) || 0;
    const avgPrice = parseFloat(asset.averagePrice) || 0;
    const currPrice = qty > 0 ? curBal / qty : 0;

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: asset.currency || 'BRL' }).format(val);
    const formatDate = (d) => {
        if (!d) return '-';
        const parts = d.split('-');
        if (parts.length < 3) return d;
        // manually construct date to avoid utc conversion issues
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('pt-BR');
    };

    // Dividend Calculations
    const state = store.getState();
    const allProventos = state.proventos || [];
    const dollarQuote = state.dollarQuote || 5.0; // Fallback safe
    const assetProventos = allProventos.filter(p => p.ticker === asset.ticker || (asset.previousTicker && p.ticker === asset.previousTicker));

    // Helper for conversion
    const getValueInAssetCurrency = (p) => {
        const pCurr = (p.currency || 'BRL').trim().toUpperCase();
        const aCurr = (asset.currency || 'BRL').trim().toUpperCase();

        // 1. If target is BRL, use stored BRL value (p.value is always BRL)
        if (aCurr === 'BRL') {
            return parseFloat(p.value) || 0;
        }

        // 2. If target is USD
        if (aCurr === 'USD') {
            if (pCurr === 'USD') {
                // Native USD: Calculate from original - tax
                const gross = parseFloat(p.originalValue) || 0;
                const tax = parseFloat(p.taxes) || 0;
                return Math.max(0, gross - tax);
            } else {
                // BRL Provento: Convert BRL value to USD
                const valBRL = parseFloat(p.value) || 0;
                return dollarQuote > 0 ? valBRL / dollarQuote : 0;
            }
        }

        return parseFloat(p.value) || 0;
    };

    // Total Dividends
    const divReceivedTotal = assetProventos.reduce((sum, p) => sum + getValueInAssetCurrency(p), 0);

    // 12m Dividends
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const divReceived12m = assetProventos
        .filter(p => new Date(p.date + 'T00:00:00') >= oneYearAgo)
        .reduce((sum, p) => sum + getValueInAssetCurrency(p), 0);

    // Dividend Yield (12m) - Based on Current Balance
    const dy12m = curBal > 0 ? (divReceived12m / curBal) * 100 : 0;

    // Total Return (Profit + Dividends)
    const returnWithDiv = profit + divReceivedTotal;

    // --- Pagination Logic ---
    const pageSize = 5;
    const history = (asset.history || []).map((h, i) => ({ ...h, originalIndex: i }));

    // Sort by Date Descending
    history.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        return db - da; // Descending
    });

    const totalPages = Math.ceil(history.length / pageSize) || 1;
    if (currentHistoryPage >= totalPages) currentHistoryPage = totalPages - 1;
    if (currentHistoryPage < 0) currentHistoryPage = 0;

    const pageHistory = history.slice(currentHistoryPage * pageSize, (currentHistoryPage + 1) * pageSize);


    const content = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Header Info -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: var(--bg-color); padding: 1.25rem; border-radius: 8px;">
                <div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Valor Atual</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${formatCurrency(curBal)}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">${asset.ticker} - ${asset.type}</div>
                    ${asset.previousTicker ? `<div style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.8; margin-top: 2px;">(Antes: ${asset.previousTicker})</div>` : ''}
                </div>
                 <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Rentabilidade</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                       ${profitP.toFixed(2)}%
                    </div>
                     <div style="font-size: 0.85rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; margin-top: 5px;">
                       ${profit >= 0 ? '+' : ''}${formatCurrency(profit)}
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.9rem;">
                <div><strong>Quantidade:</strong><br><span style="color: var(--text-secondary);">${qty}</span></div>
                <div><strong>Preço Médio:</strong><br><span style="color: var(--text-secondary);">${formatCurrency(avgPrice)}</span></div>
                <div><strong>Preço Atual:</strong><br><span style="color: var(--text-secondary);">${formatCurrency(currPrice)}</span></div>
                <div><strong>Total Investido:</strong><br><span style="color: var(--text-secondary);">${formatCurrency(invVal)}</span></div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.9rem;">
                 <div><strong>Total Proventos:</strong><br><span style="color: var(--text-secondary);">${formatCurrency(divReceivedTotal)}</span></div>
                 <div><strong>Proventos (12m):</strong><br><span style="color: var(--text-secondary);">${formatCurrency(divReceived12m)}</span></div>
                 <div><strong>Dividend Yield (12m):</strong><br><span style="color: var(--text-secondary);">${dy12m.toFixed(2)}%</span></div>
                 <div><strong>Retorno Total (c/ Div):</strong><br><span style="color: ${returnWithDiv >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${formatCurrency(returnWithDiv)}</span></div>
            </div>

            <!-- History -->
            <div>
                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">Histórico</h4>
                <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; min-height: 200px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                       ${pageHistory.map(h => {
        // Label Mapping
        let typeLabel = h.type;
        if (h.type === 'buy') typeLabel = 'Compra';
        else if (h.type === 'sell') typeLabel = 'Venda';
        else if (h.type === 'bonus') typeLabel = 'Bonificação';
        else if (h.type === 'split') typeLabel = 'Desdobramento';
        else if (h.type === 'inplit') typeLabel = 'Grupamento';
        else if (h.type === 'subscription') typeLabel = 'Subscrição';
        else if (h.type === 'ticker_change') typeLabel = 'Troca de Ticker';

        return `
                          <tr style="border-bottom: 1px solid var(--border-color);">
                             <td style="padding: 0.75rem 1rem;">${formatDate(h.date)}</td>
                             <td style="padding: 0.75rem 1rem; text-transform: capitalize;">${typeLabel}</td>
                             <td style="padding: 0.75rem 1rem; text-align: right;">${formatCurrency(h.value || 0)}</td>
                             <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap;">
                                <button class="btn-icon action-btn-edit" data-index="${h.originalIndex}" data-type="${h.type}" style="background: none; border: none; cursor: pointer; color: var(--text-secondary); margin-right: 0.5rem;" title="Editar">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                                <button class="btn-icon action-btn-delete" data-index="${h.originalIndex}" style="background: none; border: none; cursor: pointer; color: var(--danger-color);" title="Excluir">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                             </td>
                          </tr>
                       `;
    }).join('')}
                        ${pageHistory.length === 0 ? '<tr><td colspan="4" style="padding: 1rem; text-align: center; color: var(--text-secondary);">Sem histórico.</td></tr>' : ''}
                    </table>
                </div>

                <!-- Pagination Controls -->
                ${totalPages > 1 ? `
                <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1rem;">
                    <button id="btn-hist-prev" class="btn btn-sm" ${currentHistoryPage === 0 ? 'disabled' : ''} style="padding: 0.5rem 0.75rem;">
                        &lt;
                    </button>
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">
                        Página ${currentHistoryPage + 1} de ${totalPages}
                    </span>
                    <button id="btn-hist-next" class="btn btn-sm" ${currentHistoryPage >= totalPages - 1 ? 'disabled' : ''} style="padding: 0.5rem 0.75rem;">
                        &gt;
                    </button>
                </div>
                ` : ''}
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                <button class="btn btn-primary" style="flex: 1; padding: 0.85rem;" id="btn-detail-add">Aportar</button>
                <button class="btn" style="flex: 1; border: 1px solid var(--danger-color); color: var(--danger-color); padding: 0.85rem;" id="btn-detail-delete">Excluir</button>
                <button class="btn" style="flex: 1; border: 1px solid var(--border-color); padding: 0.85rem;" id="btn-detail-sell">Vender</button>
            </div>
        </div>
    `;

    modal.open(`${asset.ticker} - Detalhes`, content);

    // Pagination Listeners
    const btnPrev = document.getElementById('btn-hist-prev');
    const btnNext = document.getElementById('btn-hist-next');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentHistoryPage > 0) {
                currentHistoryPage--;
                render(asset);
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentHistoryPage < totalPages - 1) {
                currentHistoryPage++;
                render(asset);
            }
        });
    }

    // Listeners
    document.getElementById('btn-detail-add').addEventListener('click', () => {
        modal.close();
        setTimeout(() => openContributionModal({
            page: 'variable',
            ticker: asset.ticker,
            type: asset.type,
            assetId: asset.id // Ensure ID is passed too
        }), 200);
    });

    document.getElementById('btn-detail-delete').addEventListener('click', async () => {
        // Custom Confirmation Modal
        const confirmHtml = `
            <div style="text-align: center; padding: 1rem;">
                <div style="color: var(--danger-color); font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="margin-bottom: 1rem;">Excluir Ativo?</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    Você está prestes a excluir o ativo <strong>${asset.ticker}</strong>.
                    Isso apagará <strong>TODO</strong> o histórico de compras, vendas e proventos deste ativo.
                </p>
                <p style="color: var(--danger-color); font-weight: bold; margin-bottom: 2rem;">
                    Esta ação não pode ser desfeita.
                </p>
                
                <div style="display: flex; gap: 1rem;">
                    <button id="btn-confirm-cancel" class="btn" style="flex: 1; border: 1px solid var(--border-color);">Cancelar</button>
                    <button id="btn-confirm-delete" class="btn" style="flex: 1; background: var(--danger-color); color: white; border: none;">Excluir</button>
                </div>
            </div>
        `;

        modal.open('Confirmação', confirmHtml);

        // Attach listeners to new modal content
        document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
            // Re-open details
            showVariableAssetDetails(asset.id);
        });

        document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
            try {
                await store.deleteAsset(asset.id);
                modal.close();
            } catch (e) {
                alert('Erro ao excluir: ' + e.message);
                // Re-open details on error?
                showVariableAssetDetails(asset.id);
            }
        });
    });

    document.getElementById('btn-detail-sell').addEventListener('click', () => {
        modal.close();
        setTimeout(() => openContributionModal({
            page: 'variable',
            isSell: true,
            ticker: asset.ticker,
            type: asset.type,
            assetId: asset.id,
            availableQty: asset.qty
        }), 200);
    });
    // --- History Action Listeners ---

    // Edit Buttons
    document.querySelectorAll('.action-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const index = parseInt(btnEl.dataset.index);
            const type = btnEl.dataset.type;
            const originalDetailAsset = asset; // Capture closure

            // We need to fetch the original item from the full history, NOT sorted/paginated
            // But we already map 'originalIndex', so index is correct.
            const historyItem = asset.history[index];

            modal.close();

            if (['bonus', 'split', 'inplit', 'subscription', 'ticker_change'].includes(type)) {
                import('./SpecialEventsModal.js').then(module => {
                    module.openSpecialEventsModal(historyItem, originalDetailAsset, index);
                });
            } else {
                // Regular Buy/Sell
                setTimeout(() => {
                    openContributionModal({
                        page: 'variable',
                        editMode: true,
                        assetId: originalDetailAsset.id,
                        historyIndex: index,
                        initialData: historyItem,
                        ticker: originalDetailAsset.ticker,
                        type: originalDetailAsset.type
                    });
                }, 200);
            }
        });
    });

    // Delete Buttons
    document.querySelectorAll('.action-btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const index = parseInt(btnEl.dataset.index);

            // Custom Confirmation Modal
            const confirmHtml = `
                <div style="text-align: center; padding: 1rem;">
                    <div style="color: var(--danger-color); font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="margin-bottom: 1rem;">Excluir Histórico?</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                        Você está removendo um registro do histórico. 
                        Isso <strong>recalculará</strong> o preço médio e o saldo do ativo.
                    </p>
                    <p style="color: var(--danger-color); font-weight: bold; margin-bottom: 2rem;">
                        Deseja continuar?
                    </p>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button id="btn-hist-cancel" class="btn" style="flex: 1; border: 1px solid var(--border-color);">Cancelar</button>
                        <button id="btn-hist-delete" class="btn" style="flex: 1; background: var(--danger-color); color: white; border: none;">Excluir</button>
                    </div>
                </div>
            `;

            modal.open('Confirmação', confirmHtml);

            document.getElementById('btn-hist-cancel').addEventListener('click', () => {
                // Re-open details using ID
                showVariableAssetDetails(asset.id);
            });

            document.getElementById('btn-hist-delete').addEventListener('click', async () => {
                try {
                    await store.deleteVariableHistoryItem(asset.id, index);

                    const successHtml = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center;">
                             <div style="width: 60px; height: 60px; background: var(--success-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; margin-bottom: 1rem;">✓</div>
                             <h3 style="margin-bottom: 0.5rem; font-weight: 700;">Excluído!</h3>
                             <p style="color: var(--text-secondary);">O registro foi removido com sucesso.</p>
                             <button id="btn-success-close" class="btn btn-primary" style="margin-top: 1.5rem; width: 100%;">OK</button>
                        </div>
                    `;
                    modal.open('Sucesso', successHtml);

                    document.getElementById('btn-success-close').addEventListener('click', () => {
                        showVariableAssetDetails(asset.id);
                    });

                } catch (err) {
                    alert('Erro ao excluir: ' + err.message);
                    showVariableAssetDetails(asset.id);
                }
            });
        });
    });
}
