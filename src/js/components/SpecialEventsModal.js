import { Modal } from './Modal.js';
import { store } from '../store.js';
import { CustomSelect } from './CustomSelect.js';

let modal = new Modal();

export function openSpecialEventsModal() {
    const allAssets = store.getState().variableIncome.assets;

    // Deduplicate by Ticker (prefer active/positive qty)
    const uniqueAssetsMap = new Map();
    allAssets.forEach(a => {
        const ticker = a.ticker.toUpperCase();
        if (!uniqueAssetsMap.has(ticker)) {
            uniqueAssetsMap.set(ticker, a);
        } else {
            // If duplicate exists, prefer the one with quantity > current map item
            const current = uniqueAssetsMap.get(ticker);
            if (current.qty <= 0 && a.qty > 0) {
                uniqueAssetsMap.set(ticker, a);
            }
        }
    });

    const assets = Array.from(uniqueAssetsMap.values());

    // Sort assets alphabetically by Ticker
    const sortedAssets = [...assets].sort((a, b) => a.ticker.localeCompare(b.ticker));

    const content = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- Event Type Selection -->
            <div class="form-group">
                <label class="form-label">Tipo de Evento</label>
                <div id="select-event-type"></div>
            </div>

            <!-- Asset Selection -->
            <div class="form-group">
                <label class="form-label">Ativo</label>
                <div id="select-asset"></div>
            </div>

            <!-- Dynamic Content Area -->
            <div id="event-dynamic-form" style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Fields injected via JS based on Type -->
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-ghost" style="flex: 1;" id="btn-cancel-event">Cancelar</button>
                <button class="btn btn-primary" style="flex: 1;" id="btn-save-event">Salvar Evento</button>
            </div>
        </div>
    `;

    modal.open('Eventos Corporativos', content);

    // Initialize Selects
    // Event Types
    const eventTypes = [
        { value: 'bonus', label: 'Bonificação' },
        { value: 'split', label: 'Desdobramento (Split)' },
        { value: 'inplit', label: 'Grupamento (Inplit)' },
        { value: 'subscription', label: 'Subscrição' },
        { value: 'ticker_change', label: 'Troca de Ticker' },
        { value: 'staking', label: 'Staking (Cripto)' }
    ];

    // Asset Options (All)
    const allAssetOptions = sortedAssets.map(a => ({
        value: a.id,
        label: a.name ? `${a.ticker} - ${a.name}` : a.ticker,
        type: (a.type || '').toLowerCase(),
        category: (a.category || '').toLowerCase()
    }));

    let selectedType = 'bonus';
    // Helper to get assets for current type
    const getFilteredAssets = (type) => {
        if (type === 'staking') {
            return allAssetOptions.filter(a => a.type.includes('cripto') || a.type.includes('crypto'));
        }
        return allAssetOptions;
    };

    let currentOptions = getFilteredAssets(selectedType);
    let selectedAssetId = currentOptions.length > 0 ? currentOptions[0].value : null;

    const typeSelect = new CustomSelect('select-event-type', eventTypes, (val) => {
        selectedType = val;

        // Filter Assets based on Type
        currentOptions = getFilteredAssets(selectedType);

        // Update Asset Select Options
        // We need a way to update options in CustomSelect. 
        // Assuming CustomSelect implies re-creation or we can hack it by re-instantiating.
        // Let's re-instantiate assetSelect.
        document.getElementById('select-asset').innerHTML = ''; // Clear container
        new CustomSelect('select-asset', currentOptions, (val) => {
            selectedAssetId = val;
            renderDynamicFields();
        });

        // Auto-select first available if current selection is invalid
        if (!currentOptions.find(o => o.value === selectedAssetId)) {
            selectedAssetId = currentOptions.length > 0 ? currentOptions[0].value : null;
        }

        renderDynamicFields();
    });
    // Default to Bonus
    typeSelect.select('bonus', 'Bonificação');

    // Initial Asset Select
    new CustomSelect('select-asset', currentOptions, (val) => {
        selectedAssetId = val;
        renderDynamicFields();
    });

    if (selectedAssetId) {
        // We might need to manually trigger selection visual update if we re-created, 
        // but CustomSelect constructor usually handles initial render if we passed logic?
        // The CustomSelect implementation likely renders on init.
    }

    // Render Logic
    function renderDynamicFields() {
        const container = document.getElementById('event-dynamic-form');
        if (!container) return;

        let html = '';

        // Common Date Field (except for some?)
        // Actually, let's put Date first for all events? Or inside specific blocks.
        // Usually Date is common. Let's add it at the top of dynamic form.
        html += `
            <div class="form-group">
                <label class="form-label">Data do Evento</label>
                <input type="date" class="form-input" id="event-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
        `;

        // Find current asset props for labels
        const currentAsset = sortedAssets.find(a => a.id === selectedAssetId);
        const currentQty = currentAsset ? currentAsset.qty : 0;
        const currentTicker = currentAsset ? currentAsset.ticker : '';

        if (selectedType === 'bonus' || selectedType === 'staking') {
            const label = selectedType === 'staking' ? 'Qtd. Recebida (Staking)' : 'Qtd. Recebida (Bônus)';
            html += `
                <div class="form-group">
                    <label class="form-label">${label}</label>
                    <input type="number" class="form-input" id="event-qty" step="0.00000001" placeholder="Ex: 0.05">
                </div>
                 <div class="form-group">
                    <label class="form-label">Custo Total (Opcional)</label>
                    <input type="number" class="form-input" id="event-cost" step="0.01" value="0.00" placeholder="R$ 0,00">
                    <small style="color: var(--text-secondary); font-size: 0.75rem;">Geralmente zero para ${selectedType}.</small>
                </div>
            `;
        } else if (selectedType === 'split' || selectedType === 'inplit') {
            // ... existing split/inplit logic ...
            // Simplified for brevity in replace, but need to keep existing
            html += `
                <div class="form-group">
                    <label class="form-label">Proporção (Ratio)</label>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                         ${selectedType === 'split'
                    ? `<span style="color: var(--text-secondary);">De 1 para</span> <input type="number" class="form-input" id="event-ratio" placeholder="Ex: 2" style="flex:1;">`
                    : `<span style="color: var(--text-secondary);">De</span> <input type="number" class="form-input" id="event-ratio" placeholder="Ex: 10" style="flex:1;"> <span style="color: var(--text-secondary);">para 1</span>`
                }
                    </div>
                </div>
                 <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: -0.5rem;">
                    O sistema recalculará todo o histórico multiplicado por este fator. Ex: 1 para 2 dobra a quantidade.
                </p>
            `;
        } else if (selectedType === 'ticker_change') {
            html += `
                <div class="form-group">
                    <label class="form-label">Ticker Atual</label>
                    <input type="text" class="form-input" value="${currentTicker}" disabled style="background: var(--bg-hover); opacity: 0.8;">
                </div>
                <div class="form-group">
                    <label class="form-label">Novo Ticker</label>
                    <input type="text" class="form-input" id="event-new-ticker" placeholder="Ex: ${currentAsset ? currentAsset.ticker + '11' : ''}" style="text-transform: uppercase;">
                </div>
                 <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: -0.5rem;">
                    Todo o histórico de compras, vendas e proventos será preservado e associado ao novo ticker. O ticker antigo será salvo como referência.
                </p>
            `;
        } else if (selectedType === 'subscription') {
            html += `
                <div class="form-group">
                    <label class="form-label">Quantidade Subscrita</label>
                    <input type="number" class="form-input" id="event-qty" step="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Preço de Exercício (Unitário)</label>
                    <input type="number" class="form-input" id="event-price" step="0.01">
                </div>
            `;
        }

        container.innerHTML = html;

        // Input Masks/Behavior can be re-applied here if needed
    }

    // Initial Render
    renderDynamicFields();

    // Event Listeners
    document.getElementById('btn-cancel-event').addEventListener('click', () => modal.close());
    const btnSave = document.getElementById('btn-save-event');
    btnSave.addEventListener('click', async () => {
        if (!selectedAssetId) {
            alert("Selecione um ativo.");
            return;
        }

        // Construct Payload
        let payload = {};
        const dateDate = document.getElementById('event-date').value;
        payload.date = dateDate;

        if (selectedType === 'bonus' || selectedType === 'staking') {
            payload.quantity = parseFloat(document.getElementById('event-qty').value) || 0;
            payload.cost = parseFloat(document.getElementById('event-cost').value) || 0;
            if (payload.quantity <= 0) {
                alert("Informe uma quantidade válida.");
                return;
            }
        } else if (selectedType === 'split' || selectedType === 'inplit') {
            payload.ratio = parseFloat(document.getElementById('event-ratio').value) || 0;
            if (payload.ratio <= 0) {
                alert("Informe uma proporção válida.");
                return;
            }
        } else if (selectedType === 'ticker_change') {
            payload.newTicker = (document.getElementById('event-new-ticker').value || '').trim().toUpperCase();
            if (!payload.newTicker) {
                alert("Informe o novo ticker.");
                return;
            }
        } else if (selectedType === 'subscription') {
            payload.quantity = parseFloat(document.getElementById('event-qty').value) || 0;
            payload.price = parseFloat(document.getElementById('event-price').value) || 0;
            if (payload.quantity <= 0) {
                alert("Informe uma quantidade válida.");
                return;
            }
        }

        if (selectedType === 'split' || selectedType === 'inplit') {
            // We need to access the sortedAssets/original asset to check currency/type
            // But we only have selectedAssetId.
            // We can find it again or assume the one in scope `currentAsset` if we move it out or re-find.
            const assetsForCheck = store.getState().variableIncome.assets;
            const targetAsset = assetsForCheck.find(a => a.id === selectedAssetId);

            if (targetAsset) {
                const isBRL = targetAsset.currency === 'BRL' || !targetAsset.currency; // Default BRL
                const isStockOrFII = ['stock', 'fii', 'stock_br', 'fii_br'].includes(targetAsset.type) || isBRL;
                // Simple heuristic: If it's BRL, we assume it can't have fractions.

                // Payload already has 'ratio' from above block
                if (payload.ratio && isBRL) {
                    const projectedQty = targetAsset.qty * payload.ratio;
                    if (projectedQty < 1 && projectedQty > 0) {
                        // === TRIGGER WARNING MODAL ===
                        const confirmModal = new Modal();
                        const confirmContent = `
                            <div style="padding: 1.5rem; text-align: center;">
                                <div style="color: #ffc107; margin-bottom: 1rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                </div>
                                <h3 style="margin-bottom: 0.5rem;">Atenção: Fração Resultante</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                                    Este evento resultará em uma quantidade de <strong>${projectedQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</strong> cotas.
                                    <br><br>
                                    Na B3, frações menores que 1 geralmente são leiloadas e o ativo é encerrado. Deseja encerrar este ativo e movê-lo para o histórico?
                                </p>
                                <div style="display: flex; gap: 1rem; justify-content: center;">
                                    <button class="btn btn-ghost" id="btn-warn-cancel">Cancelar</button>
                                    <button class="btn btn-primary" id="btn-warn-confirm">Encerrar Ativo</button>
                                </div>
                            </div>
                         `;

                        confirmModal.open('Atenção', confirmContent);

                        // Handle Confirm
                        setTimeout(() => {
                            document.getElementById('btn-warn-confirm').onclick = async () => {
                                confirmModal.close();
                                payload.liquidateRemaining = true;
                                await executeSave(selectedAssetId, selectedType, payload);
                            };
                            document.getElementById('btn-warn-cancel').onclick = () => {
                                confirmModal.close();
                            };
                        }, 100);
                        return; // Stop execution here, wait for modal interaction
                    }
                }
            }
        }

        // Standard execution if no warning needed
        await executeSave(selectedAssetId, selectedType, payload);
    });

    async function executeSave(assetId, type, payload) {
        // Execute Store Action
        try {
            await store.addSpecialEvent(assetId, type, payload);

            // Success Modal
            showSuccessModal(type);

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar evento: " + e.message);
        }
    }
}

function showSuccessModal(type) {
    const titles = {
        'bonus': 'Bonificação Registrada!',
        'split': 'Desdobramento Realizado!',
        'inplit': 'Grupamento Realizado!',
        'subscription': 'Subscrição Realizada!',
        'subscription': 'Subscrição Realizada!',
        'ticker_change': 'Troca de Ticker Realizada!',
        'staking': 'Staking Registrado!'
    };

    const successContent = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center;">
            <div style="width: 60px; height: 60px; background: #d1e7dd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#198754" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <h3 style="color: #212529; margin-bottom: 0.5rem; font-size: 1.25rem;">${titles[type]}</h3>
            <p style="color: #6c757d; font-size: 1rem; margin-bottom: 2rem;">
                O evento foi salvo e o histórico do ativo atualizado.
            </p>
            <button id="btn-success-close-event" class="btn btn-primary" style="min-width: 120px;">
                OK
            </button>
        </div>
    `;

    modal.open('Sucesso', successContent);

    setTimeout(() => {
        const btn = document.getElementById('btn-success-close-event');
        if (btn) btn.onclick = () => modal.close();
    }, 0);
}

function formatNumber(val) {
    return val.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
