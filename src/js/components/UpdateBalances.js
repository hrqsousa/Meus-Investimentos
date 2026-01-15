import { Modal } from './Modal.js';
import { store } from '../store.js';

let modal = new Modal();
let currentFilter = 'ALL'; // ALL, CDB_RDB, LCI_LCA
let tempValues = {}; // Cache
let viewContext = 'FIXED_INCOME';

export function openUpdateBalances(options = {}) {
    viewContext = options.filter === 'RESERVE' ? 'RESERVE' : 'FIXED_INCOME';
    tempValues = {}; // Reset
    render();
}

function render() {
    let assets = store.getState().fixedIncome.assets.filter(a => !a.type.toLowerCase().includes('tesouro'));

    // Context Filter
    if (viewContext === 'RESERVE') {
        assets = assets.filter(a => a.isReserve);
    } else {
        assets = assets.filter(a => !a.isReserve);
    }

    // Sort logic: Always by Due Date (Closest first)
    let sorted = [...assets].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Filter Logic
    if (currentFilter === 'CDB_RDB') {
        sorted = sorted.filter(a => ['CDB', 'RDB', 'LC'].includes(a.type));
    } else if (currentFilter === 'LCI_LCA') {
        sorted = sorted.filter(a => ['LCI', 'LCA'].includes(a.type));
    }

    const content = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                Atualize o valor (bruto) dos seus títulos. O sistema salva a data/hora automaticamente se houver mudança.
            </p>

            <!-- Filters -->
            <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
                <button class="btn ${currentFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-all">Todos</button>
                <button class="btn ${currentFilter === 'CDB_RDB' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-cdb">CDB/RDB/LC</button>
                 <button class="btn ${currentFilter === 'LCI_LCA' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" id="filter-lci">LCI/LCA</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${sorted.map(asset => {
        const lastUpdateDate = asset.lastUpdate ? new Date(asset.lastUpdate).toLocaleString('pt-BR') : 'Nunca atualizado';
        const formattedBalance = asset.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Use cached value
        const displayVal = tempValues[asset.id] !== undefined ? tempValues[asset.id] : formattedBalance;

        return `
                    <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-color);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${asset.type} - ${asset.issuer}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    ${asset.indexer} ${asset.rate}% • Vence: ${(() => {
                if (!asset.dueDate) return '-';
                if (typeof asset.dueDate === 'string' && asset.dueDate.includes('-')) {
                    const [y, m, d] = asset.dueDate.split('T')[0].split('-');
                    const localDate = new Date(y, m - 1, d);
                    return localDate.toLocaleDateString('pt-BR');
                }
                return new Date(asset.dueDate).toLocaleDateString('pt-BR');
            })()
            }
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.7rem; color: var(--text-secondary);">Última atualização</div>
                                <div style="font-size: 0.75rem; font-weight: 500;">${lastUpdateDate}</div>
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Saldo Atual (R$)</label>
                            <input type="text" 
                                   class="form-input input-balance-mask" 
                                   data-id="${asset.id}" 
                                   data-original="${asset.currentBalance}"
                                   value="${displayVal}"
                                   style="text-align: right; font-weight: 600; color: var(--primary-color);"
                            >
                        </div>
                    </div>
                `;
    }).join('')}
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                 <button class="btn btn-ghost" style="flex: 1;" id="btn-cancel-update">Cancelar</button>
                 <button class="btn btn-primary" style="flex: 1;" id="btn-confirm-updates">Salvar Tudo</button>
            </div>
        </div>
    `;

    modal.open('Atualizar Saldos', content);

    // Event Listeners (Wrapped in setTimeout)
    setTimeout(() => {
        const bindObj = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        };

        bindObj('filter-all', () => { currentFilter = 'ALL'; render(); });
        bindObj('filter-cdb', () => { currentFilter = 'CDB_RDB'; render(); });
        bindObj('filter-lci', () => { currentFilter = 'LCI_LCA'; render(); });

        bindObj('btn-cancel-update', () => modal.close());
        bindObj('btn-confirm-updates', confirmUpdates);

        // Masking Logic
        const inputs = document.querySelectorAll('.input-balance-mask');
        inputs.forEach(input => {
            input.addEventListener('focus', function () {
                // Select all on focus (Tab or first click)
                this.select();
            });

            input.oninput = (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (!value) {
                    e.target.value = '0,00';
                    return;
                }
                value = (parseFloat(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                e.target.value = value;
                tempValues[e.target.dataset.id] = value; // Save to cache
            };
        });
    }, 0);
}

function confirmUpdates() {
    // Gather changes
    const inputs = document.querySelectorAll('.input-balance-mask');
    let changes = 0;
    const updates = [];

    inputs.forEach(input => {
        const id = input.dataset.id;
        // Parse locale string '1.000,00' -> 1000.00
        const rawVal = input.value.replace(/\./g, '').replace(',', '.');
        const newVal = parseFloat(rawVal);
        const original = parseFloat(input.dataset.original);

        // Compare with tolerance for float precision
        if (!isNaN(newVal) && Math.abs(newVal - original) > 0.005) {
            changes++;
            updates.push({ id, val: newVal });
        }
    });

    if (changes === 0) {
        alert("Nenhuma alteração detectada nos valores.");
        return;
    }

    // Custom Confirmation
    const confirmContent = `
        <div style="text-align: center; padding: 1rem;">
             <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 0.5rem; display: flex; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1.25rem; font-weight: 700;">Confirmar Atualização</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Você editou o saldo de <strong>${changes}</strong> títulos.<br>Deseja salvar as alterações?
            </p>
             <div style="display: flex; gap: 1rem;">
                <button class="btn btn-ghost" style="flex: 1; border: 1px solid var(--border-color);" id="btn-back-update">Voltar</button>
                <button class="btn btn-primary" style="flex: 1;" id="btn-exec-update">Confirmar</button>
            </div>
        </div>
    `;

    modal.open('Confirmação', confirmContent);

    // Re-attach listeners for confirmation logic
    setTimeout(() => {
        document.getElementById('btn-back-update').onclick = render;
        document.getElementById('btn-exec-update').onclick = () => {
            updates.forEach(u => store.updateAssetBalance(u.id, u.val));
            modal.close();
        };
    }, 0);
}
