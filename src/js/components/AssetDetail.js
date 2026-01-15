import { Modal } from './Modal.js';
import { Chart } from 'chart.js/auto';
import { store } from '../store.js';
import { openSellAsset } from './SellAsset.js';
import { openEditAsset } from './EditAsset.js';

let modal = new Modal();
let evolutionChart = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 5;

export function showAssetDetails(id) {
    currentPage = 1;
    let asset = store.getState().fixedIncome.assets.find(a => a.id === id);
    let isClosed = false;

    if (!asset) {
        // Try closed assets
        asset = (store.getState().fixedIncome.closedAssets || []).find(a => a.id === id);
        isClosed = true;
    }

    if (!asset) return;

    currentPage = 1; // Reset page when opening new asset details
    const title = getTitleName(asset);
    modal.open(title, `<div id="asset-detail-content"></div>`); // Open modal with a placeholder div
    render(asset, isClosed); // Now render updates the content of that div
}

let currentAssetId = null;

function render(assetOrId, isClosed = false) {
    let asset = assetOrId;

    // Handle ID passed instead of object
    if (typeof asset === 'string') {
        const id = asset;
        asset = store.getState().fixedIncome.assets.find(a => a.id === id);
        if (!asset) {
            asset = (store.getState().fixedIncome.closedAssets || []).find(a => a.id === id);
            isClosed = true;
        }
    }

    if (!asset) return;

    currentAssetId = asset.id;
    const container = document.getElementById('asset-detail-content');
    if (!container) {
        // If the container doesn't exist, it means the modal hasn't been opened yet
        // or was closed. In this case, we should re-open it.
        // This scenario might happen if render is called from a callback (e.g., after sell/edit)
        // and the modal was closed by the previous action.
        showAssetDetails(asset.id); // Re-trigger the full flow
        return;
    }

    const daysToMaturity = getDaysDiff(new Date(), new Date(asset.dueDate));

    // Sanitize for NaN
    const curBal = Number.isFinite(asset.currentBalance) ? asset.currentBalance : 0;
    const invVal = Number.isFinite(asset.investedValue) ? asset.investedValue : 0;

    const profit = curBal - invVal;
    const profitP = invVal > 0 ? (profit / invVal) * 100 : 0;

    // Sort History Descending
    const sortedHistory = [...asset.history].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination Logic
    const totalPages = Math.ceil(sortedHistory.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentHistory = sortedHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const content = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Header Info -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: var(--bg-color); padding: 1.25rem; border-radius: var(--radius-md);">
                <div>
                   <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Valor Atual</div>
                   <div style="font-size: 1.5rem; font-weight: 700;">R$ ${formatCurrency(curBal)}</div>
                </div>
                 <div style="text-align: right;">
                   <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Rentabilidade</div>
                   <div style="font-size: 1.5rem; font-weight: 700; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                      ${profitP.toFixed(2)}%
                   </div>
                </div>
            </div>

            <!-- Details Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.95rem;">
                <div><strong>Emissor:</strong><br><span style="color: var(--text-secondary);">${asset.issuer}</span></div>
                <div><strong>Tipo:</strong><br><span style="color: var(--text-secondary);">${asset.type}</span></div>
                <div><strong>Taxa:</strong><br><span style="color: var(--text-secondary);">${asset.indexer} ${asset.rate}%</span></div>
                <div><strong>Vencimento:</strong><br><span style="color: var(--text-secondary);">${formatDate(asset.dueDate)} (${daysToMaturity} d)</span></div>
                <div><strong>Início:</strong><br><span style="color: var(--text-secondary);">${formatDate(asset.startDate)}</span></div>
                <div><strong>Investido:</strong><br><span style="color: var(--text-secondary);">R$ ${formatCurrency(invVal)}</span></div>
            </div>

            <!-- Chart -->
            <div>
               <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">Evolução</h4>
               <div style="height: 220px;"><canvas id="assetEvolutionChart"></canvas></div>
            </div>

            <!-- History -->
            <div>
                <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: var(--text-secondary); font-weight: 600;">Histórico</h4>
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                       ${currentHistory.map(h => {
        const realIndex = asset.history.indexOf(h);
        return `
                          <tr style="border-bottom: 1px solid var(--border-color);">
                             <td style="padding: 0.75rem 1rem;">${formatDate(h.date)}</td>
                             <td style="padding: 0.75rem 1rem;">${translateType(h.type)}</td>
                             <td style="padding: 0.75rem 1rem; text-align: right;">R$ ${formatCurrency(h.value)}</td>
                             <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap;">
                                <button class="btn-icon-edit" data-index="${realIndex}" style="color: var(--text-secondary); padding: 0.25rem; cursor: pointer; margin-right: 0.5rem;" title="Editar">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <button class="btn-icon-delete" data-index="${realIndex}" style="color: var(--text-secondary); padding: 0.25rem; cursor: pointer;" title="Excluir">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                             </td>
                          </tr>
                          `;
    }).join('')}
                    </table>
                    
                    ${totalPages > 1 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-color);">
                            <button class="btn btn-ghost" id="btn-prev-page" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor: default;"' : ''}>&lt; Anterior</button>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Página ${currentPage} de ${totalPages}</span>
                            <button class="btn btn-ghost" id="btn-next-page" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor: default;"' : ''}>Próxima &gt;</button>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                ${isClosed ? `
                    <button id="btn-detail-revert" class="btn btn-primary" style="flex: 2; justify-content: center; gap: 0.5rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Reverter Venda
                    </button>
                    <button id="btn-detail-delete" class="btn" style="flex: 1; border: 1px solid var(--danger-color); color: var(--danger-color); padding: 0.85rem; justify-content: center;">
                        Excluir
                    </button>
                ` : `
                    <button class="btn btn-primary" style="flex: 1; padding: 0.85rem;" id="btn-detail-sell">Resgatar</button>
                    <button class="btn" style="flex: 1; border: 1px solid var(--border-color); padding: 0.85rem;" id="btn-detail-edit">Editar Título</button>
                    <button class="btn" style="flex: 1; border: 1px solid var(--danger-color); color: var(--danger-color); padding: 0.85rem;" id="btn-detail-delete">Excluir Título</button>
                `}
            </div>
        </div>
    `;

    const title = getTitleName(asset);
    modal.open(title, content);
    renderEvolutionChart(asset);

    // Now setupListeners is defined below
    setupListeners(asset, isClosed);

    // History Edit/Delete Listeners
    const deleteBtns = document.querySelectorAll('.btn-icon-delete');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            confirmDeleteHistory(asset, idx);
        });
    });

    const editBtns = document.querySelectorAll('.btn-icon-edit');
    editBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            openEditHistory(asset, idx);
        });
    });

    // Pagination Listeners
    if (totalPages > 1) {
        document.getElementById('btn-prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(asset.id); } });
        document.getElementById('btn-next-page').addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; render(asset.id); } });
    }
}

function openEditHistory(asset, index) {
    const entry = asset.history[index];
    // Existing values
    const dateVal = entry.date.split('T')[0];
    const valVal = entry.value;
    const qtyVal = entry.details?.qty || 0;
    const priceVal = entry.details?.unitPrice || 0;
    const costsVal = entry.details?.costs || 0;
    // Use history specific rate if available, else fallback to asset default rate
    const rateVal = entry.details?.rate !== undefined ? entry.details.rate : asset.rate;

    const content = `
        <div style="padding: 1rem;">
            <form id="edit-history-form" style="display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Row 1: Dates -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Data do Aporte</label>
                        <input type="date" class="form-input" id="hist-date" value="${dateVal}">
                    </div>
                     <div class="form-group">
                        <label class="form-label">Vencimento</label>
                        <input type="text" class="form-input" value="${formatDate(asset.dueDate)}" disabled style="background: var(--bg-hover); opacity: 0.8; cursor: not-allowed;">
                    </div>
                </div>

                <!-- Row 2: Type/Indexer/Rate -->
                <div style="display: grid; grid-template-columns: 1.5fr 1fr 0.8fr; gap: 1rem;">
                     <div class="form-group">
                        <label class="form-label">Tipo</label>
                         <input type="text" class="form-input" value="${asset.type}" disabled style="background: var(--bg-hover); opacity: 0.8; cursor: not-allowed;">
                    </div>
                     <div class="form-group">
                        <label class="form-label">Rentabilidade</label>
                         <input type="text" class="form-input" value="${asset.indexer}" disabled style="background: var(--bg-hover); opacity: 0.8; cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Taxa (%)</label>
                        <input type="number" step="0.01" class="form-input" id="hist-rate" value="${rateVal}">
                    </div>
                </div>
                
                <!-- Row 3: Qty & Unit Price -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Quantidade</label>
                        <input type="text" class="form-input" id="hist-qty" value="${qtyVal.toFixed(2).replace('.', ',')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Preço Unitário</label>
                        <input type="text" class="form-input money-input" id="hist-price" value="${formatCurrency(priceVal)}">
                    </div>
                </div>

                <!-- Row 4: Costs & Total -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Outros Custos</label>
                        <input type="text" class="form-input money-input" id="hist-costs" value="${formatCurrency(costsVal)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Total</label>
                        <input type="text" class="form-input money-input" id="hist-value" value="${formatCurrency(valVal)}" readonly style="background: var(--bg-hover); opacity: 0.8; cursor: not-allowed;">
                    </div>
                </div>

                 <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-ghost" id="btn-cancel-hist-edit" style="flex: 1;">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Salvar Alterações</button>
                </div>
            </form>
        </div>
    `;

    modal.open('Editar Detalhes do Aporte', content);

    // Helpers
    const parseMoney = (str) => {
        if (!str) return 0;
        let val = str.replace(/[^\d,]/g, '').replace(',', '.');
        return parseFloat(val) || 0;
    };

    // Masking handling
    const moneyInputs = document.querySelectorAll('.money-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = (parseInt(value) / 100).toFixed(2) + '';
            value = value.replace('.', ',');
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            e.target.value = 'R$ ' + value;
            updateCalc();
        });
    });

    const qtyInp = document.getElementById('hist-qty');
    // Quantity Mask (no R$ prefix, just comma decimal)
    qtyInp.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            e.target.value = '';
            return;
        }
        value = (parseInt(value) / 100).toFixed(2) + '';
        value = value.replace('.', ',');
        // Thousands separator? Usually not needed for qty unless huge, but let's keep consistency if user wants
        // Simple decimal mask:
        e.target.value = value;
        updateCalc();
    });


    // Inputs for calculation
    const priceInp = document.getElementById('hist-price');
    const costsInp = document.getElementById('hist-costs');
    const totalInp = document.getElementById('hist-value');

    const updateCalc = () => {
        // Parse Qty manually since it's masked "0,00"
        let qStr = qtyInp.value.replace(/[^\d,]/g, '').replace(',', '.');
        const q = parseFloat(qStr) || 0;

        const p = parseMoney(priceInp.value);
        const c = parseMoney(costsInp.value);

        const total = (q * p) + c;

        totalInp.value = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Initial Calc Verification (in case storage had discrepancy, but we load values from storage first)
    // We let the user see stored values.

    document.getElementById('btn-cancel-hist-edit').addEventListener('click', () => {
        render(asset.id);
    });

    document.getElementById('edit-history-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newDate = document.getElementById('hist-date').value;
        const newRate = parseFloat(document.getElementById('hist-rate').value);

        // Parse masked inputs
        const qStr = document.getElementById('hist-qty').value.replace(/[^\d,]/g, '').replace(',', '.');
        const newQty = parseFloat(qStr) || 0;

        const newPrice = parseMoney(document.getElementById('hist-price').value);
        const newCosts = parseMoney(document.getElementById('hist-costs').value);
        const newValue = parseMoney(document.getElementById('hist-value').value);

        // Update Entry
        const updatedEntry = {
            ...entry,
            date: newDate,
            value: newValue,
            details: {
                ...entry.details,
                qty: newQty,
                unitPrice: newPrice,
                costs: newCosts,
                rate: newRate // Save rate to history detail
            }
        };

        // Update Asset History
        const newHistory = [...asset.history];
        newHistory[index] = updatedEntry;

        // Recalculate Aggregates
        // Invested Value = Sum of all BUY history values
        const newInvested = newHistory.reduce((acc, h) => acc + (h.type === 'buy' ? h.value : 0), 0);

        // Total Qty = Sum of all history Qty
        const newTotalQty = newHistory.reduce((acc, h) => acc + (h.details?.qty || 0), 0);

        // Current Balance Logic:
        // We used to assume user updates balance manually.
        // But if they edit a past contribution, we should probably update the balance proportionally?
        // Or should we leave balance alone?
        // If I increase Qty in history, my Current Balance (Market Value) should logically encompass more shares.
        // Assuming current market price remains constant:
        // MarketPrice = CurrentBalance / OldTotalQty
        // NewBalance = MarketPrice * NewTotalQty

        // However, if OldTotalQty was 0 (edge case), we use UnitPrice of the purchase as proxy.
        const oldTotalQty = asset.history.reduce((acc, h) => acc + (h.details?.qty || 0), 0);
        let marketPrice = 0;

        if (asset.qty > 0) {
            marketPrice = asset.currentBalance / asset.qty;
        } else {
            // Fallback to unit price of this transaction if asset had 0 qty (e.g. was empty)
            marketPrice = newPrice;
        }

        // Avoid NaN if something goes wrong
        if (isNaN(marketPrice) || !isFinite(marketPrice)) marketPrice = 0;

        const newBalance = marketPrice * newTotalQty;

        const updatePayload = {
            history: newHistory,
            investedValue: newInvested,
            qty: newTotalQty,
            currentBalance: newBalance,
            lastUpdate: new Date().toISOString()
        };

        try {
            const { updateAsset } = await import('../firebase/firestore.js');
            const user = store.getState().user;
            await updateAsset(user.uid, asset.id, updatePayload);
            render(asset.id);
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar.");
        }
    });
}

function confirmDeleteHistory(asset, historyIndex) {
    const content = `
        <div style="text-align: center; padding: 1.5rem;">
            <div style="font-size: 3rem; color: var(--warning-color); margin-bottom: 1rem; display: flex; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">Excluir Histórico?</h3>
            <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.5;">
                Deseja realmente remover este registro?<br>
                Isso pode alterar o saldo atual se for a última atualização.
            </p>
            <div style="display: flex; gap: 1rem;">
                <button class="btn" style="flex: 1; border: 1px solid var(--border-color); padding: 0.85rem;" id="btn-cancel-del-hist">Cancelar</button>
                <button class="btn" style="flex: 1; background-color: var(--danger-color); color: white; padding: 0.85rem;" id="btn-confirm-del-hist">Excluir</button>
            </div>
        </div>
    `;

    modal.open('Confirmação', content);

    document.getElementById('btn-cancel-del-hist').addEventListener('click', () => {
        render(asset.id); // Go back to details
    });

    document.getElementById('btn-confirm-del-hist').addEventListener('click', () => {
        store.removeHistoryItem(asset.id, historyIndex);
        render(asset.id); // Re-render details with item removed
    });
}

function confirmDelete(asset) {
    // Check for "siblings" (Assets with same type and dueDate) - Primarily for Treasury
    const allAssets = store.getState().fixedIncome.assets;
    const siblings = allAssets.filter(a =>
        a.id !== asset.id &&
        a.type === asset.type &&
        a.dueDate === asset.dueDate
    );

    const totalToDelete = 1 + siblings.length;
    const isGrouped = totalToDelete > 1;

    const content = `
        <div style="text-align: center; padding: 1.5rem;">
            <div style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem; display: flex; justify-content: center;">
                 <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </div>
            <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">Excluir Título Definitivamente?</h3>
            <div style="background: rgba(239, 68, 68, 0.05); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
                 <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">
                    Você está prestes a excluir <strong>${asset.type}</strong>.
                    <br><br>
                    ${isGrouped
            ? `<span style="color: var(--danger-color); font-weight: 600;">⚠️ Atenção:</span> Isso removerá este e outros <strong>${siblings.length}</strong> aportes relacionados a este título.`
            : `<span style="color: var(--danger-color); font-weight: 600;">⚠️ Atenção:</span> Isso removerá <strong>TODOS</strong> os aportes, histórico de rentabilidade e registros associados a este ativo. Esta ação não pode ser desfeita.`
        }
                </p>
            </div>

            <div style="display: flex; gap: 1rem;">
                <button class="btn" style="flex: 1; border: 1px solid var(--border-color); padding: 0.85rem;" id="btn-cancel-delete">Cancelar</button>
                <button class="btn" style="flex: 1; background-color: var(--danger-color); color: white; padding: 0.85rem; font-weight: 600;" id="btn-confirm-delete">
                    ${isGrouped ? 'EXCLUIR TUDO' : 'EXCLUIR'}
                </button>
            </div>
        </div>
    `;

    modal.open('Zona de Perigo', content);

    document.getElementById('btn-cancel-delete').addEventListener('click', () => {
        render(asset.id);
    });

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        // Delete current
        await store.deleteAsset(asset.id);

        // Delete siblings
        for (const sibling of siblings) {
            await store.deleteAsset(sibling.id);
        }

        modal.close();
    });
}

function renderEvolutionChart(asset) {
    const ctx = document.getElementById('assetEvolutionChart');
    if (!ctx) return;

    if (evolutionChart) evolutionChart.destroy();

    const sortedForChart = [...asset.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedForChart.map(h => formatDate(h.date));
    const data = sortedForChart.map(h => h.value);

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor',
                data: data,
                borderColor: '#004aad',
                backgroundColor: 'rgba(0, 74, 173, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    display: true, // Show Dates
                    grid: { display: false },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: false,
                    grace: '5%',
                    grid: {
                        display: true, // Show Grid
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        display: true, // Show Values
                        color: 'var(--text-secondary)',
                        font: { size: 10 },
                        callback: function (value) {
                            return 'R$ ' + value.toLocaleString('pt-BR', { notation: 'compact' });
                        }
                    }
                }
            },
            layout: {
                padding: { top: 10, bottom: 10, left: 0, right: 10 }
            }
        }
    });

    // Manually adjust Y scale to fit tight at bottom, loose at top
    // Chart.js 'grace' applies to both ends if not careful, or we use suggestedMax
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    let range = maxVal - minVal;

    // Handle single point or flat line
    if (range === 0) {
        const offset = Math.abs(minVal) * 0.02 || 1;
        evolutionChart.options.scales.y.min = minVal - offset;
        evolutionChart.options.scales.y.suggestedMax = maxVal + (offset * 3);
    } else {
        evolutionChart.options.scales.y.min = minVal - (range * 0.05);
        evolutionChart.options.scales.y.suggestedMax = maxVal + (range * 0.2);
    }

    evolutionChart.update();
}

function formatCurrency(val) { return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function formatDate(dateStr) {
    if (!dateStr) return '-';
    // Fix UTC offset issue by treating YYYY-MM-DD as local
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // 0-indexed
        const day = parseInt(parts[2]);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('pt-BR');
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getDaysDiff(d1, d2) {
    // Normalize to start of day to avoid time differences
    const start1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const start2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    const diff = start2.getTime() - start1.getTime();
    return Math.ceil(diff / (86400000));
}
function translateType(type) {
    const map = { 'buy': 'Compra', 'sell': 'Venda', 'update': 'Atualização' };
    return map[type] || type;
}

function getTitleName(asset) {
    if (asset.type.toLowerCase().includes('tesouro')) {
        const year = new Date(asset.dueDate).getFullYear();
        if (asset.type.toLowerCase().includes('renda+')) {
            return `Tesouro Renda+ ${year - 19}`;
        }
        return `${asset.type} ${year}`;
    }
    return `${asset.type} - ${asset.issuer}`;
}

function setupListeners(asset, isClosed) {
    // Delete Button (Works for both active and closed)
    const btnDelete = document.getElementById('btn-detail-delete');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            confirmDelete(asset);
        });
    }

    if (isClosed) {
        const btnRevert = document.getElementById('btn-detail-revert');
        if (btnRevert) {
            btnRevert.addEventListener('click', async () => {
                const { store } = await import('../store.js'); // Ensure store is available
                await store.revertSell(asset.id);
                modal.close();
            });
        }
        return;
    }

    const btnSell = document.getElementById('btn-detail-sell');
    if (btnSell) {
        btnSell.addEventListener('click', () => {
            modal.close();
            setTimeout(() => openSellAsset(asset), 200);
        });
    }

    const btnEdit = document.getElementById('btn-detail-edit');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            modal.close();
            setTimeout(() => openEditAsset(asset, () => showAssetDetails(asset.id)), 200);
        });
    }
}
