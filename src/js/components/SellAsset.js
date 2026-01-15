import { Modal } from './Modal.js';
import { store } from '../store.js';

let modal = new Modal();

export function openSellAsset(asset, onClose) {
    try {
        console.log('Opening Sell Asset:', asset);
        const daysToMaturity = getDaysDiff(new Date(), new Date(asset.dueDate));
        const isExpired = daysToMaturity <= 0;
        const isTreasury = asset.type.toLowerCase().includes('tesouro');

        // Defaults
        // Ensure asset.qty is at least 1 to avoid division by zero if data is bad
        const assetQty = parseFloat(asset.qty) || 0;
        const assetBal = parseFloat(asset.currentBalance) || 0;
        const safeQty = assetQty > 0 ? assetQty : 1;

        // For Treasury: Price based on Balance/Qty
        // For Private: We just care about value, but store needs qty.
        const impliedPrice = assetBal / safeQty;

        let inputsHtml = '';

        if (isTreasury) {
            inputsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <label class="form-label">Quantidade</label>
                            <button type="button" id="btn-sell-all" class="btn btn-ghost" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; height: auto; min-height: unset; color: var(--primary-color);">
                                Tudo
                            </button>
                        </div>
                        <input type="number" step="0.01" id="sell-qty" class="form-input" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Preço Venda (Unit.)</label>
                        <input type="text" id="sell-price" class="form-input money-input" value="${formatCurrency(impliedPrice)}">
                    </div>
                </div>
             `;
        } else {
            // Private Credit: Value Based
            inputsHtml = `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label class="form-label">Valor do Resgate (Bruto)</label>
                        <button type="button" id="btn-sell-all" class="btn btn-ghost" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; height: auto; min-height: unset; color: var(--primary-color);">
                            Tudo
                        </button>
                    </div>
                    <input type="text" id="sell-gross" class="form-input money-input" placeholder="R$ 0,00">
                </div>
                 <!-- Hidden inputs for store compatibility -->
                 <input type="hidden" id="sell-qty" value="0">
                 <input type="hidden" id="sell-price" value="${impliedPrice}"> 
            `;
        }

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                 <div style="background: var(--bg-color); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--primary-color);">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Ativo</div>
                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.5rem;">${asset.type} - ${asset.issuer}</div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                        <div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">Saldo Atual</div>
                            <div style="font-weight: 700;">R$ ${formatCurrency(assetBal)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${isTreasury ? 'Qtd. Atual' : 'Valor Investido'}</div>
                            <div style="font-weight: 700;">
                                ${isTreasury
                ? (assetQty ? assetQty.toFixed(2).replace('.', ',') : '-')
                : 'R$ ' + formatCurrency(parseFloat(asset.investedValue) || 0)
            }
                            </div>
                        </div>
                    </div>
                </div>

                ${isExpired
                ? `<div style="padding: 1rem; background: rgba(239, 68, 68, 0.1); color: var(--danger-color); font-size: 0.9rem; border-radius: var(--radius-md); font-weight: 500;">
                        Este título venceu. Recomenda-se o resgate total.
                       </div>`
                : ''}

                <form id="sell-form">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label class="form-label">Data do Resgate</label>
                        <input type="date" id="sell-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    ${inputsHtml}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Custos / IR / Taxas</label>
                            <input type="text" id="sell-costs" class="form-input money-input" placeholder="R$ 0,00">
                        </div>
                         <div class="form-group">
                            <label class="form-label">Valor Líquido</label>
                            <input type="text" id="sell-total" class="form-input money-input" readonly style="background: var(--bg-hover); opacity: 0.8; cursor: not-allowed;" placeholder="R$ 0,00">
                        </div>
                    </div>
                    
                    <!-- Simulation / Math Display -->
                    <div id="sell-simulation" style="background: var(--bg-hover); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); display: none;">
                         <div style="display: flex; justify-content: space-between;">
                            <span>Novo Saldo Est.:</span>
                            <strong id="sim-balance">R$ 0,00</strong>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div id="sell-error-msg" style="display:none; color: var(--danger-color); background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: var(--radius-sm); margin-top: 1rem; text-align: center; font-size: 0.9rem; font-weight: 500;"></div>

                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="button" class="btn btn-ghost" style="flex: 1;" id="btn-cancel-sell">Cancelar</button>
                        <button type="submit" id="confirm-sell" class="btn btn-primary" style="flex: 1; justify-content: center;">Confirmar Resgate</button>
                    </div>
                </form>
            </div>
        `;

        modal.open('Resgatar Título', content);

        // Elements
        const qtyInp = document.getElementById('sell-qty');
        const priceInp = document.getElementById('sell-price'); // Might be hidden
        const grossInp = document.getElementById('sell-gross'); // Only for Private
        const costsInp = document.getElementById('sell-costs');
        const totalInp = document.getElementById('sell-total');
        const simDiv = document.getElementById('sell-simulation');

        // Logic
        const updateCalc = () => {
            let grossVal = 0;
            let currentSellQty = 0;

            if (isTreasury) {
                const q = parseFloat(qtyInp.value) || 0;
                const p = parseMoney(priceInp.value);
                grossVal = q * p;
                currentSellQty = q;
            } else {
                grossVal = parseMoney(grossInp.value);
                // Calculate implicit Qty for store
                // Ratio = Gross / Balance
                const bal = assetBal > 0 ? assetBal : 1;
                const ratio = grossVal / bal;
                currentSellQty = safeQty * ratio; // Proportional qty

                // Update hidden inputs for submission
                if (qtyInp) qtyInp.value = currentSellQty;
                // Price is fixed implied
            }

            const costs = parseMoney(costsInp.value);
            const net = Math.max(0, grossVal - costs);

            totalInp.value = 'R$ ' + net.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Simulation
            if (grossVal > 0) {
                simDiv.style.display = 'block';
                const estBalance = Math.max(0, assetBal - grossVal);
                document.getElementById('sim-balance').textContent = 'R$ ' + estBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            } else {
                simDiv.style.display = 'none';
            }
        };

        // Masking
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

        if (isTreasury) {
            qtyInp.addEventListener('input', updateCalc);
            priceInp.addEventListener('input', updateCalc);
        } else {
            grossInp.addEventListener('input', updateCalc);
        }

        costsInp.addEventListener('input', updateCalc);

        // Sell All
        const btnSellAll = document.getElementById('btn-sell-all');
        if (btnSellAll) {
            btnSellAll.addEventListener('click', () => {
                if (isTreasury) {
                    qtyInp.value = assetQty;
                } else {
                    // Set Gross to Balance
                    grossInp.value = 'R$ ' + assetBal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
                updateCalc();
            });
        }

        // Auto-fill if expired (sell all suggestion)
        if (isExpired && !asset.processedExpired) {
            // Logic to auto-fill could go here, but user might want to check first.
        }


        document.getElementById('btn-cancel-sell').addEventListener('click', () => {
            modal.close();
            if (onClose) setTimeout(() => onClose(), 200);
        });

        document.getElementById('sell-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const showError = (msg) => {
                const el = document.getElementById('sell-error-msg');
                el.textContent = msg;
                el.style.display = 'block';
            };
            document.getElementById('sell-error-msg').style.display = 'none';

            const date = document.getElementById('sell-date').value;
            const costs = parseMoney(costsInp.value);
            const totalValue = parseMoney(totalInp.value);

            // Get final calcs
            let finalQty = 0;
            let finalPrice = 0;

            if (isTreasury) {
                finalQty = parseFloat(qtyInp.value);
                finalPrice = parseMoney(priceInp.value);
                if (!finalQty || finalQty <= 0) { showError('Digite uma quantidade válida.'); return; }
                if (finalQty > assetQty + 0.001) { showError('Quantidade maior que o disponível.'); return; } // Tolerance
            } else {
                const gross = parseMoney(grossInp.value);
                if (!gross || gross <= 0) { showError('Digite um valor de resgate válido.'); return; }
                if (gross > assetBal + 0.01) { showError('Valor maior que o saldo atual.'); return; } // Tolerance

                // Recalculate implied params
                const bal = assetBal > 0 ? assetBal : 1;
                const ratio = gross / bal;
                finalQty = safeQty * ratio;
                finalPrice = impliedPrice; // Keep constant price
            }

            store.sellAsset(asset.id, {
                date,
                qty: finalQty, // Pass calculated qty
                unitPrice: finalPrice,
                costs,
                totalValue
            });

            // Show Success State
            const successContent = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center;">
                    <div style="width: 64px; height: 64px; background: var(--success-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Resgate Realizado!</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">A operação foi registrada com sucesso.</p>
                    
                    <button id="btn-success-close" class="btn btn-primary" style="width: 100%; justify-content: center;">Concluir</button>
                </div>
            `;

            modal.open('Sucesso', successContent);

            document.getElementById('btn-success-close').addEventListener('click', () => {
                modal.close();
                if (finalQty < safeQty - 0.001) {
                    if (onClose) setTimeout(() => onClose(), 300);
                }
            });
        });
    } catch (error) {
        console.error("Error opening Sell Asset modal:", error);
        alert("Erro ao abrir janela de venda: " + error.message);
    }
}

function getDaysDiff(d1, d2) {
    const diff = d2.getTime() - d1.getTime();
    return Math.ceil(diff / (86400000));
}

function formatCurrency(val) {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(str) {
    if (!str) return 0;
    let val = str.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(val) || 0;
}
