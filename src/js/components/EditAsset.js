import { Modal } from './Modal.js';
import { store } from '../store.js';
import { CustomSelect } from './CustomSelect.js';

let modal = new Modal();

export function openEditAsset(asset, onClose) {
    const content = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            <!-- Emissor -->
            <div class="form-group">
                <label class="form-label" for="edit-issuer">Emissor</label>
                <input type="text" id="edit-issuer" class="form-input" value="${asset.issuer}" placeholder="Ex: Banco XP">
            </div>

            <!-- Row 1: Type & Date -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <div id="select-type-container"></div>
                </div>
                <div class="form-group">
                     <label class="form-label" for="edit-dueDate">Vencimento</label>
                     <input type="date" id="edit-dueDate" class="form-input" value="${asset.dueDate}">
                </div>
            </div>

            <!-- Row 2: Indexer & Rate -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                 <div class="form-group">
                    <label class="form-label">Indexador</label>
                    <div id="select-indexer-container"></div>
                 </div>
                 <div class="form-group">
                     <label class="form-label" for="edit-rate">Taxa (%)</label>
                     <input type="number" id="edit-rate" step="0.01" class="form-input" value="${asset.rate}" placeholder="0.00">
                 </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                 <button class="btn btn-ghost" style="flex: 1;" id="btn-cancel-edit">Cancelar</button>
                 <button id="btn-save-edit" class="btn btn-primary" style="flex: 1; justify-content: center;">Salvar Alterações</button>
            </div>
        </div>
    `;

    modal.open('Editar Título', content);

    // Initialize Custom Selects
    // Type Options
    const isTreasury = asset.type.toLowerCase().includes('tesouro');

    const typeOptions = [
        { value: 'Tesouro Selic', label: 'Tesouro Selic' },
        { value: 'Tesouro IPCA+', label: 'Tesouro IPCA+' },
        { value: 'Tesouro Pré-fixado', label: 'Tesouro Pré-fixado' },
        { value: 'Tesouro Renda+', label: 'Tesouro Renda+' },
        { value: 'CDB', label: 'CDB' },
        { value: 'LCI', label: 'LCI' },
        { value: 'LCA', label: 'LCA' },
        { value: 'Debênture', label: 'Debênture' },
        { value: 'CRI', label: 'CRI' },
        { value: 'CRA', label: 'CRA' }
    ];

    const indexerOptions = [
        { value: 'Selic +', label: 'Selic +' },
        { value: 'IPCA +', label: 'IPCA +' },
        { value: 'Pré-fixado', label: 'Pré-fixado' },
        { value: 'CDI', label: 'CDI' },
    ];

    const typeSelect = new CustomSelect('select-type-container', typeOptions, (selected) => {
        // Automation Logic
        const lower = selected.toLowerCase();
        if (lower.includes('tesouro selic')) {
            indexerSelect.select('Selic +', 'Selic +');
        } else if (lower.includes('ipca') || lower.includes('renda+')) {
            indexerSelect.select('IPCA +', 'IPCA +');
        } else if (lower.includes('pré-fixado') || lower.includes('prefixado')) {
            indexerSelect.select('Pré-fixado', 'Pré-fixado');
        }
    });
    typeSelect.select(asset.type, asset.type);

    const indexerSelect = new CustomSelect('select-indexer-container', indexerOptions);
    indexerSelect.select(asset.indexer, asset.indexer);

    // Event Listeners
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        modal.close();
        if (onClose) setTimeout(() => onClose(), 200); // Re-open details if cancelled
    });

    document.getElementById('btn-save-edit').addEventListener('click', async () => {
        const newIssuer = document.getElementById('edit-issuer').value;
        const newType = typeSelect.getValue();
        const newDueDate = document.getElementById('edit-dueDate').value;
        const newIndexer = indexerSelect.getValue();
        const newRate = parseFloat(document.getElementById('edit-rate').value);

        if (!newIssuer || !newDueDate || !newType || !newIndexer) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        const updatedData = {
            issuer: newIssuer,
            type: newType,
            dueDate: newDueDate,
            indexer: newIndexer,
            rate: newRate
        };

        // Persist
        if (store.state.user) {
            try {
                const { updateAsset } = await import('../firebase/firestore.js');
                await updateAsset(store.state.user.uid, asset.id, updatedData);
                // Also update local store immediately for responsiveness, though subscription typically handles it
                store.editAsset(asset.id, updatedData);

                // Show Success Modal/Feedback? User requested "Personalized screens... confirmed operations".
                // Simple alert for now as per minimal change, but ideally a nice modal.
                // Re-using ImportModal style success?
                // Let's stick to standard alert + nice transition for now to fit complexity budget.
                // Or I can show a toast.

                // alert(`Título "${newType}" atualizado com sucesso.`);

                // Custom Success Modal
                const successContent = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center;">
                        <div style="width: 60px; height: 60px; background: #d1e7dd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#198754" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <h3 style="color: #212529; margin-bottom: 0.5rem; font-size: 1.25rem;">Título Atualizado!</h3>
                        <p style="color: #6c757d; font-size: 1rem; margin-bottom: 2rem;">
                            As informações do título <b>${newType}</b> foram salvas com sucesso.
                        </p>
                        <button id="btn-success-close-edit" class="btn btn-primary" style="min-width: 120px;">
                            OK
                        </button>
                    </div>
                `;

                modal.open('Sucesso', successContent);

                setTimeout(() => {
                    const btnClose = document.getElementById('btn-success-close-edit');
                    if (btnClose) {
                        btnClose.onclick = () => {
                            modal.close();
                            if (onClose) setTimeout(() => onClose(), 200);
                            else setTimeout(() => showAssetDetails(asset.id), 200);
                        };
                    }
                }, 0);

                return; // Stop execution to keep success modal open
            } catch (e) {
                console.error(e);
                alert("Erro ao salvar alterações.");
            }
        }

        modal.close();
        // If success path is taken, we don't reach here immediately
    });
}
