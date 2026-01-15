import { Modal } from './Modal.js';
import { store } from '../store.js';
import { updateAsset } from '../firebase/firestore.js';

let modal = new Modal();
let currentFilter = 'ALL';
let pendingUpdates = {};

export function openUpdateBalancesTreasury() {
    pendingUpdates = {};
    render();
}

function render() {
    const assets = store.getState().fixedIncome.assets;
    let treasuryAssets = assets.filter(a => a.type.toLowerCase().includes('tesouro') && a.status !== 'liquidated');

    // Sort by Due Date
    treasuryAssets.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Filter Logic
    if (currentFilter === 'SELIC') treasuryAssets = treasuryAssets.filter(a => a.type.toLowerCase().includes('selic'));
    else if (currentFilter === 'IPCA') treasuryAssets = treasuryAssets.filter(a => a.type.toLowerCase().includes('ipca'));
    else if (currentFilter === 'PRE') treasuryAssets = treasuryAssets.filter(a => a.type.toLowerCase().includes('pré'));
    else if (currentFilter === 'RENDA') treasuryAssets = treasuryAssets.filter(a => a.type.toLowerCase().includes('renda'));

    const content = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <p style="color: #495057; font-size: 0.9rem;">
                Atualize o valor de mercado de cada aporte. O valor total do título será a soma dos valores informados.
            </p>

            <!-- Filters -->
            <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; border-bottom: 1px solid #dee2e6;">
                <button class="btn ${currentFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-td-all">Todos</button>
                <button class="btn ${currentFilter === 'SELIC' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-td-selic">Selic</button>
                <button class="btn ${currentFilter === 'IPCA' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-td-ipca">IPCA+</button>
                <button class="btn ${currentFilter === 'PRE' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-td-pre">Pré-Fixado</button>
                <button class="btn ${currentFilter === 'RENDA' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-td-renda">Renda+</button>
            </div>

            <!-- Changed from flex to block to prevent shrinking issues -->
            <div style="display: block; gap: 1rem;">
                ${treasuryAssets.map(asset => {
        try {
            const name = getTreasuryName(asset);

            const rawHistory = Array.isArray(asset.history) ? asset.history : [];
            const contributions = rawHistory
                .map((h, index) => ({ ...h, originalIndex: index }))
                .filter(h => h.type === 'buy' || h.type === 'contribution');

            if (contributions.length === 0) return '';

            return `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; overflow: hidden; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                <div style="padding: 0.75rem 1rem; background: #f8f9fa; display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #e0e0e0;">
                                    <span style="color: #0d6efd; font-weight: 700; font-size: 0.95rem;">${name}</span>
                                    <span style="font-size: 0.8rem; color: #6c757d;">Vence: ${safeDate(asset.dueDate)}</span>
                                </div>
                                
                                <div style="display: flex; flex-direction: column;">
                                    ${contributions.map(item => {
                const key = `${asset.id}_${item.originalIndex}`;

                let displayValue = "";
                if (pendingUpdates[key] !== undefined) {
                    displayValue = pendingUpdates[key];
                } else if (item.currentValue !== undefined && item.currentValue !== null) {
                    displayValue = formatNumber(item.currentValue);
                } else if (item.value !== undefined && item.value !== null) {
                    displayValue = formatNumber(item.value);
                } else {
                    displayValue = "0,00";
                }

                const investedVal = (item.value !== undefined && item.value !== null) ? item.value : 0;
                const investedStr = investedVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const dateStr = safeDate(item.date);

                return `
                                            <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #f0f0f0; display: grid; grid-template-columns: 1fr 140px; align-items: center; gap: 1rem;">
                                                <div style="font-size: 0.85rem;">
                                                    <div style="color: #212529; font-weight: 600; margin-bottom: 4px;">Compra: ${dateStr}</div>
                                                    <div style="color: #6c757d;">Investido: <span style="color: #495057;">${investedStr}</span></div>
                                                </div>
                                                <div>
                                                    <label style="font-size: 0.75rem; color: #6c757d; display: block; margin-bottom: 4px;">Valor Atual (R$)</label>
                                                    <input type="text" 
                                                        class="form-input input-balance-mask-td" 
                                                        data-key="${key}"
                                                        value="${displayValue}"
                                                        placeholder="0,00"
                                                        style="text-align: right; font-weight: 700; color: #198754; padding: 0.5rem; width: 100%; border: 1px solid #ced4da; border-radius: 4px; background: #fff;"
                                                    >
                                                </div>
                                            </div>
                                        `;
            }).join('')}
                                </div>
                                <div style="padding: 0.75rem 1rem; background: #f8f9fa; text-align: right; font-size: 0.9rem; color: #212529; border-top: 1px solid #e0e0e0;">
                                    Saldo Total: <b style="color: #198754;">${(asset.currentBalance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
                                </div>
                            </div>
                        `;
        } catch (err) {
            return `<div style="padding: 1rem; color: red;">Erro renderização</div>`;
        }
    }).join('')}
                
                ${treasuryAssets.length === 0 ? '<div style="padding:2rem; text-align:center; color:#6c757d;">Nenhum título encontrado.</div>' : ''}
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #eee;">
                 <button class="btn btn-ghost" style="flex: 1;" id="btn-cancel-update-td">Cancelar</button>
                 <button class="btn btn-primary" style="flex: 1;" id="btn-confirm-updates-td">Salvar Atualizações</button>
            </div>
        </div>
    `;

    modal.open('Atualizar Tesouro', content);

    // Event Listeners
    setTimeout(() => {
        const bindObj = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        bindObj('filter-td-all', () => { currentFilter = 'ALL'; render(); });
        bindObj('filter-td-selic', () => { currentFilter = 'SELIC'; render(); });
        bindObj('filter-td-ipca', () => { currentFilter = 'IPCA'; render(); });
        bindObj('filter-td-pre', () => { currentFilter = 'PRE'; render(); });
        bindObj('filter-td-renda', () => { currentFilter = 'RENDA'; render(); });

        bindObj('btn-cancel-update-td', () => modal.close());
        bindObj('btn-confirm-updates-td', confirmUpdates);

        const inputs = document.querySelectorAll('.input-balance-mask-td');
        inputs.forEach(input => {
            input.oninput = (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (!value) value = '0';
                const numVal = (parseFloat(value) / 100);
                e.target.value = numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                pendingUpdates[e.target.dataset.key] = e.target.value;
            };
            input.onfocus = (e) => e.target.select();
        });
    }, 0);
}

function confirmUpdates() {
    const assets = store.getState().fixedIncome.assets.filter(a => a.type.toLowerCase().includes('tesouro'));

    let hasChanges = false;
    const updates = [];

    assets.forEach(asset => {
        const newHistory = (asset.history || []).map(h => ({ ...h }));
        let newTotalBalance = 0;
        let assetModified = false;

        newHistory.forEach((h, index) => {
            if (h.type === 'buy' || h.type === 'contribution') {
                const key = `${asset.id}_${index}`;
                if (pendingUpdates[key]) {
                    const rawVal = pendingUpdates[key].replace(/\./g, '').replace(',', '.');
                    const newVal = parseFloat(rawVal);
                    if (!isNaN(newVal)) {
                        h.currentValue = newVal;
                        assetModified = true;
                    }
                }
                const val = (h.currentValue !== undefined && h.currentValue !== null) ? h.currentValue : (h.value || 0);
                newTotalBalance += val;
            }
        });

        const userTouchedAsset = Object.keys(pendingUpdates).some(k => k.startsWith(asset.id));
        if (userTouchedAsset || assetModified) {
            hasChanges = true;
            updates.push({
                id: asset.id,
                uid: store.getState().user.uid,
                payload: {
                    history: newHistory,
                    currentBalance: newTotalBalance,
                    lastUpdate: new Date().toISOString()
                }
            });
        }
    });

    if (!hasChanges) {
        alert("Nenhuma alteração detectada.");
        return;
    }

    const btn = document.getElementById('btn-confirm-updates-td');
    if (btn) btn.textContent = "Salvando...";

    const promises = updates.map(u => updateAsset(u.uid, u.id, u.payload));

    Promise.all(promises).then(() => {
        // Show Success View
        const successContent = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center;">
                <div style="width: 60px; height: 60px; background: #d1e7dd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#198754" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h3 style="color: #212529; margin-bottom: 0.5rem; font-size: 1.25rem;">Saldos Atualizados!</h3>
                <p style="color: #6c757d; font-size: 1rem; margin-bottom: 2rem;">
                    Foram atualizados <b>${updates.length}</b> títulos no total.
                </p>
                <button id="btn-success-close-td" class="btn btn-primary" style="min-width: 120px;">
                    OK
                </button>
            </div>
        `;

        modal.open('Sucesso', successContent); // Revert/Use modal for success

        setTimeout(() => {
            const btnClose = document.getElementById('btn-success-close-td');
            if (btnClose) btnClose.onclick = () => modal.close();
        }, 0);

    }).catch(err => {
        console.error("Erro ao atualizar:", err);
        alert("Ocorreu um erro ao salvar os saldos.");
        if (btn) btn.textContent = "Salvar Atualizações";
    });
}

function getTreasuryName(asset) {
    if (!asset.dueDate) return asset.type || 'Título sem Vencimento';
    try {
        const year = new Date(asset.dueDate).getFullYear();
        if (isNaN(year)) return asset.type;
        const typeLower = (asset.type || '').toLowerCase();
        if (typeLower.endsWith(String(year))) return asset.type;
        if (typeLower.includes('renda+')) {
            if (!typeLower.includes(String(year))) return `${asset.type} ${year}`;
        }
        return `${asset.type} ${year}`;
    } catch (e) { return asset.type; }
}

function safeDate(date) {
    if (!date) return '-';
    try {
        if (typeof date === 'string' && date.includes('-')) {
            const [y, m, d] = date.split('T')[0].split('-');
            const localDate = new Date(y, m - 1, d);
            return localDate.toLocaleDateString('pt-BR');
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    } catch (e) { return '-'; }
}

function formatNumber(val) {
    try {
        if (val === undefined || val === null || isNaN(val)) return "0,00";
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) { return "0,00"; }
}
