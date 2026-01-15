import { Modal } from './components/Modal.js';
import { CustomSelect } from './components/CustomSelect.js';
import { icons } from './icons.js';

// ... imports

let modalInstance = null;
let currentCategory = null;
let currentIsReserve = false;
let currentPrefill = null;
let currentEditState = null; // { isEdit: false, assetId: null, historyIndex: null, initialData: null }
let currentIsSell = false;
let currentAvailableQty = 0;

const categories = [
    { id: 'fixed', label: 'Renda Fixa', icon: 'clipboard' },
    { id: 'variable', label: 'Renda Variável', icon: 'trendUp' },
    { id: 'treasury', label: 'Tesouro Direto', icon: 'building' },
    { id: 'reserve', label: 'Reserva de Emergência', icon: 'shield' }
];

export function openContributionModal(arg) {
    if (!modalInstance) {
        modalInstance = new Modal();
    }

    let activePage = '';
    currentIsReserve = false;
    currentPrefill = null; // Reset
    currentEditState = { isEdit: false, assetId: null, historyIndex: null, initialData: null }; // Reset
    currentIsSell = false;
    currentAvailableQty = 0;

    if (typeof arg === 'object') {
        activePage = arg.page || (arg.isReserve ? 'reserve' : 'fixed');
        currentIsReserve = !!arg.isReserve;

        // Edit Mode Data
        if (arg.editMode) {
            currentEditState = {
                isEdit: true,
                assetId: arg.assetId,
                historyIndex: arg.historyIndex,
                initialData: arg.initialData
            };
        }

        // Sell Mode Data
        if (arg.isSell) {
            currentIsSell = true;
            currentAvailableQty = parseFloat(arg.availableQty || 0);
            currentEditState.assetId = arg.assetId; // Reuse for ID reference
        }

        // Capture Prefill Data
        if (arg.ticker || arg.type) {
            currentPrefill = {
                ticker: arg.ticker,
                type: arg.type
            };
        }

        // Capture Asset ID (for quick add to existing asset)
        if (arg.assetId) {
            currentEditState.assetId = arg.assetId;
        }
    } else {
        activePage = arg;
        if (activePage === 'reserve') currentIsReserve = true;
    }

    // Auto-select category based on page
    const mapPageToCat = {
        'fixed': 'fixed',
        'variable': 'variable',
        'treasury': 'treasury',
        'reserve': 'reserve'
    };

    const initialCat = mapPageToCat[activePage];

    if (initialCat) {
        showForm(initialCat);
    } else {
        showCategorySelection();
    }
}

function showCategorySelection() {
    const html = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
         ${categories.map(cat => `
            <button class="btn btn-category" data-id="${cat.id}" style="
                flex-direction: column; 
                padding: 1.5rem; 
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                background: var(--bg-color);
                gap: 0.5rem;
                height: 100%;
            ">
               <div style="color: var(--primary-color);">${icons[cat.icon]}</div>
               <span>${cat.label}</span>
            </button>
         `).join('')}
      </div>
    `;

    modalInstance.open('Novo Aporte', html);

    // Attach events
    modalInstance.overlay.querySelectorAll('.btn-category').forEach(btn => {
        btn.addEventListener('click', () => {
            showForm(btn.dataset.id);
        });
    });
}

function showForm(categoryId) {
    currentCategory = categoryId;
    const catLabel = categories.find(c => c.id === categoryId)?.label || 'Aporte';

    if (categoryId !== 'fixed' && categoryId !== 'treasury' && categoryId !== 'reserve' && categoryId !== 'variable') {
        // Placeholder for others
        modalInstance.open(`Novo Aporte - ${catLabel}`, `
           <div style="text-align: center; padding: 2rem;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">🚧</div>
              <h3>Em Breve</h3>
              <p style="color: var(--text-secondary);">O formulário de ${catLabel} está em desenvolvimento.</p>
           </div>
        `);
        return;
    }

    const isTreasury = categoryId === 'treasury';
    const isVariable = categoryId === 'variable';
    const isReserveCat = categoryId === 'reserve';

    // Variable Income Sub-types
    const variableTypes = [
        { value: 'acao', label: 'Ação', currency: 'BRL', decimals: 0 },
        { value: 'fii', label: 'FII', currency: 'BRL', decimals: 0 },
        { value: 'exterior', label: 'Exterior', currency: 'USD', decimals: 8 },
        { value: 'cripto', label: 'Cripto', currency: 'BRL', decimals: 8 }
    ];

    // HTML Structure
    const formHtml = `
      <form id="contribution-form" style="display: flex; flex-direction: column; gap: 1rem;">
         
         <!-- Row 1: Dates -->
         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
             <div class="form-group">
                <label class="form-label">${currentIsSell ? 'Data da Venda' : 'Data do Aporte'}</label>
                <input type="date" class="form-input" id="inp-date" value="${new Date().toISOString().split('T')[0]}">
             </div>
             ${!isVariable ? `
             <div class="form-group">
                <label class="form-label">Vencimento</label>
                <input type="date" class="form-input" id="inp-due">
             </div>
             ` : `
             <div class="form-group">
                <label class="form-label">Moeda</label>
                <div style="display: flex; gap: 0.5rem; background: var(--bg-color); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <button type="button" class="btn-currency active" data-currency="BRL" style="flex:1; border-radius:6px; border:none; background:var(--primary-color); color:white; font-size:0.8rem; cursor:pointer; padding: 6px;">BRL</button>
                    <button type="button" class="btn-currency" data-currency="USD" style="flex:1; border-radius:6px; border:none; background:transparent; color:var(--text-secondary); font-size:0.8rem; cursor:pointer; padding: 6px;">USD</button>
                </div>
                <input type="hidden" id="inp-currency" value="BRL">
             </div>
             `}
         </div>

         <!-- Variable Income Specific Rows -->
         ${isVariable ? `
             <!-- Category & Ticker -->
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                 <div class="form-group">
                    <label class="form-label">Categoria</label>
                    <div id="sel-var-type"></div>
                 </div>
                 <div class="form-group">
                    <label class="form-label">Ticker</label>
                    <input type="text" class="form-input" id="inp-ticker" placeholder="EX: PETR4" style="text-transform: uppercase;">
                 </div>
             </div>
         ` : ''}

         <!-- Row 2: Issuer/Type (Fixed/Treasury) -->
         ${!isVariable ? (!isTreasury ? `
             <div class="form-group">
                <label class="form-label">Banco Emissor</label>
                <input type="text" class="form-input" id="inp-issuer" placeholder="Ex: Banco XP">
             </div>
         ` : `
             <input type="hidden" id="inp-issuer" value="Tesouro Nacional">
         `) : ''}

         <!-- Row 3: Type, Indexer & Rate (Fixed/Treasury Only) -->
         ${!isVariable ? `
         <div style="display: grid; grid-template-columns: ${isTreasury ? '2fr 1.5fr 1fr' : '1fr 1fr'}; gap: 1rem;">
             <div class="form-group">
                <label class="form-label">Tipo</label>
                <div id="sel-type"></div>
             </div>
             <div class="form-group">
                <label class="form-label">Rentabilidade</label>
                <div id="sel-indexer"></div>
             </div>
             ${isTreasury ? `
             <div class="form-group">
                <label class="form-label">Taxa (%)</label>
                <input type="text" class="form-input money-input" id="inp-rate" placeholder="0,00">
             </div>
             ` : ''}
         </div>
         ` : ''}

         <!-- Values -->
         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
             ${(isTreasury || isVariable) ? `
             <div class="form-group">
                <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Quantidade ${currentIsSell ? `(Disp: ${currentAvailableQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })})` : ''}</span>
                    ${currentIsSell ? '<span id="btn-max-qty" style="color: var(--primary-color); cursor: pointer; font-size: 0.85em; font-weight: 600;">MAX</span>' : ''}
                </label>
                <!-- Variable: Dynamic decimals. Treasury: 2 decimals -->
                <input type="text" class="form-input" id="inp-qty" placeholder="0" inputmode="decimal">
             </div>
             ` : ''}
             
             <div class="form-group">
                <label class="form-label">${currentIsSell ? 'Preço de Venda' : (isVariable ? 'Preço de Compra' : (isTreasury ? 'Preço Unitário' : 'Valor Investido'))}</label>
                <div class="input-wrapper" style="position: relative;">
                    <span class="currency-prefix" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 0.9rem;">R$</span>
                    <input type="text" class="form-input money-input" id="inp-value" placeholder="0,00" style="padding-left: 36px;">
                </div>
             </div>

             ${(!isTreasury && !isVariable) ? `
             <div class="form-group">
                <label class="form-label">Taxa (%)</label>
                <input type="text" class="form-input money-input" id="inp-rate" placeholder="0,00">
             </div>
             ` : ''}
         </div>

         <!-- Row 5: Costs & Total -->
         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
             <div class="form-group">
                <label class="form-label">Outros Custos</label>
                <input type="text" class="form-input money-input" id="inp-costs" placeholder="0,00">
             </div>
             <div class="form-group">
                <label class="form-label">Total</label>
                <input type="text" class="form-input" id="inp-total" readonly style="background: var(--bg-color); font-weight: 700;">
             </div>
         </div>

         <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 1rem; margin-top: 1rem;">
            ${currentIsSell ? 'Confirmar Venda' : (currentEditState && currentEditState.isEdit ? 'Salvar Alterações' : 'Salvar Aporte')}
         </button>

      </form>
    `;

    const title = currentIsSell
        ? `Vender Ativo - ${catLabel}`
        : ((currentEditState && currentEditState.isEdit) ? `Editar Aporte - ${catLabel}` : `Novo Aporte - ${catLabel}`);

    modalInstance.open(title, formHtml);

    // --- Initialize Components ---



    // --- Initialize Components ---

    let typeSelect, indexerSelect, varTypeSelect;

    if (isVariable) {
        // Variable Income Logic
        varTypeSelect = new CustomSelect('sel-var-type', variableTypes, (selected) => {
            const typeData = variableTypes.find(t => t.value === selected);
            if (typeData) {
                // Auto-set currency and decimals
                setCurrency(typeData.currency);

                // Update Quantity Input Precision/Masking
                const qtyInp = document.getElementById('inp-qty');
                if (qtyInp) {
                    qtyInp.dataset.decimals = typeData.decimals;
                    qtyInp.value = ''; // Reset on change
                    qtyInp.placeholder = typeData.decimals === 0 ? '0' : '0,00000000';
                }
            }
        });

        // Initialize Type: Use Prefill if available, else default 'acao'
        let initialType = (currentPrefill && currentPrefill.type) ? currentPrefill.type.toLowerCase() : 'acao';

        // Map stored types (which might include "Ação", "FII") to values ("acao", "fii")
        if (initialType.includes('ação') || initialType.includes('acao')) initialType = 'acao';
        else if (initialType.includes('fii')) initialType = 'fii';
        else if (initialType.includes('exterior')) initialType = 'exterior';
        else if (initialType.includes('cripto')) initialType = 'cripto';

        varTypeSelect.select(initialType, variableTypes.find(t => t.value === initialType)?.label || 'Ação');

        // Prefill Ticker
        if (currentPrefill && currentPrefill.ticker) {
            const tickerInp = document.getElementById('inp-ticker');
            if (tickerInp) tickerInp.value = currentPrefill.ticker;
        }

        // --- EDIT MODE PRE-FILL ---
        if (currentEditState && currentEditState.isEdit && currentEditState.initialData) {
            const data = currentEditState.initialData;
            // data: { date, type, value, details: {qty, price, costs} }

            // Date
            if (data.date) {
                document.getElementById('inp-date').value = data.date.split('T')[0];
            }

            // Values (Price, Qty, Costs)
            // Handle both structure with details and potentially flat or legacy
            const qty = data.details?.qty || data.qty || 0;
            const price = data.details?.price || (data.value / qty) || 0; // Approx if price missing
            const costs = data.details?.costs || 0;

            document.getElementById('inp-value').value = formatMoney(price);
            document.getElementById('inp-qty').value = formatMoney(qty); // Use formatMoney for display
            document.getElementById('inp-costs').value = formatMoney(costs);

            // Button Text
            const btnSubmit = document.getElementById('contribution-form').querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';

            // Trigger Calc to update total
            calcTotal();
        }

        // Currency Toggle Logic
        document.querySelectorAll('.btn-currency').forEach(btn => {
            btn.addEventListener('click', () => {
                setCurrency(btn.dataset.currency);
            });
        });

        function setCurrency(curr) {
            document.querySelectorAll('.btn-currency').forEach(b => {
                const isActive = b.dataset.currency === curr;
                b.classList.toggle('active', isActive);
                b.style.background = isActive ? 'var(--primary-color)' : 'transparent';
                b.style.color = isActive ? 'white' : 'var(--text-secondary)';
            });
            document.getElementById('inp-currency').value = curr;

            // Update Prefix and Padding
            const prefix = document.querySelector('.currency-prefix');
            const input = document.getElementById('inp-value');
            if (prefix && input) {
                prefix.textContent = curr === 'BRL' ? 'R$' : 'US$';
                // Adjust padding: R$ needs ~36px, US$ (wider) needs ~42px
                input.style.paddingLeft = curr === 'BRL' ? '36px' : '42px';
            }
        }

        // Listener for Quantity (Variable specific validation)
        const qtyInp = document.getElementById('inp-qty');
        if (qtyInp) {
            qtyInp.addEventListener('input', (e) => {
                const decimals = parseInt(e.target.dataset.decimals || 0);
                // Allow numbers and comma/dot
                let val = e.target.value.replace(/[^0-9,.]/g, '');

                // Ensure only one comma/dot
                // Normalize to comma for display
                if ((val.match(/[,.]/g) || []).length > 1) {
                    val = val.substring(0, val.length - 1);
                }

                // If decimals is 0, integer only
                if (decimals === 0) {
                    val = val.replace(/[,.]/g, '');
                }

                e.target.value = val;
                calcTotal();
            });
        }

    } else if (isTreasury) {
        // Treasury Options
        typeSelect = new CustomSelect('sel-type', [
            { value: 'tesouro_selic', label: 'Tesouro Selic' },
            { value: 'tesouro_ipca', label: 'Tesouro IPCA+' },
            { value: 'tesouro_pre', label: 'Tesouro Pré-fixado' },
            { value: 'tesouro_renda', label: 'Tesouro Renda+' }
        ], (selected) => {
            // Automation: Auto-select indexer
            if (selected === 'tesouro_selic') indexerSelect.select('selic_plus', 'Selic +');
            else if (selected === 'tesouro_pre') indexerSelect.select('pre', 'Pré-fixado');
            else indexerSelect.select('ipca_plus', 'IPCA +');
        });

        indexerSelect = new CustomSelect('sel-indexer', [
            { value: 'selic_plus', label: 'Selic +' },
            { value: 'ipca_plus', label: 'IPCA +' },
            { value: 'pre', label: 'Pré-fixado' }
        ]);

        // Listener for Quantity (Treasury specific: Money mask behavior)
        const qtyInp = document.getElementById('inp-qty');
        if (qtyInp) {
            qtyInp.classList.add('money-input'); // Re-add class if missing or handle similarly
            qtyInp.addEventListener('input', calcTotal);
        }

    } else {
        // Fixed Income Options
        typeSelect = new CustomSelect('sel-type', [
            { value: 'cdb', label: 'CDB' },
            { value: 'rdb', label: 'RDB' },
            { value: 'lci', label: 'LCI' },
            { value: 'lca', label: 'LCA' }
        ]);

        indexerSelect = new CustomSelect('sel-indexer', [
            { value: 'cdi', label: 'CDI' },
            { value: 'cdi_plus', label: 'CDI +' },
            { value: 'ipca_plus', label: 'IPCA +' },
            { value: 'pre', label: 'Pré-fixado' }
        ]);
    }

    // Max Qty Listener
    const btnMax = document.getElementById('btn-max-qty');
    if (btnMax) {
        btnMax.addEventListener('click', () => {
            const qtyInp = document.getElementById('inp-qty');
            if (qtyInp) {
                // Determine decimals based on input dataset or just use max precision
                // Use a safe string representation
                let valStr = currentAvailableQty.toLocaleString('pt-BR', { maximumFractionDigits: 8, useGrouping: false });
                qtyInp.value = valStr;
                // Trigger calculation
                calcTotal();
            }
        });
    }

    // Masking & Calc
    setupMoneyInputs();

    // Submit Handler
    document.getElementById('contribution-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveContribution(isTreasury, typeSelect, indexerSelect, varTypeSelect);
    });
}

function setupMoneyInputs() {
    const inputs = document.querySelectorAll('.money-input');

    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = (Number(value) / 100).toFixed(2) + '';
            value = value.replace('.', ',');
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            e.target.value = value;

            calcTotal();
        });
    });
}

function calcTotal() {
    const valInp = document.getElementById('inp-value');
    const costsInp = document.getElementById('inp-costs');
    const qtyInp = document.getElementById('inp-qty'); // Specific to Treasury

    const val = parseMoney(valInp?.value || '0');
    const costs = parseMoney(costsInp?.value || '0');

    let total = 0;

    if (qtyInp) {
        // Treasury: (Qty * UnitPrice) +/- Costs
        // Quantity is now masked (e.g. 1,00), so we use parseMoney to get float
        const qty = parseMoney(qtyInp.value || '0');

        if (currentIsSell) {
            total = (qty * val) - costs;
        } else {
            total = (qty * val) + costs;
        }

    } else {
        // Fixed Income: Value +/- Costs
        if (currentIsSell) {
            total = val - costs;
        } else {
            total = val + costs;
        }
    }

    // Ensure total isn't negative? For a sell it could be if costs > value?
    // Unlikely but possible. We allow it or clamp to 0?
    // Let's allow negative to show "Loss"? No, proceeds -> 0.
    // Usually if costs > sale, you pay to sell.

    document.getElementById('inp-total').value = formatMoney(total);
}

function parseMoney(str) {
    return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatMoney(num) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

import { store } from './store.js';

async function saveContribution(isTreasury, typeSelect, indexerSelect, varTypeSelect) {
    let type, indexer;
    let typeLabel, indexerLabel;

    // Variable Income Data
    const isVariable = !!varTypeSelect;
    let ticker, currency;

    if (isVariable) {
        type = varTypeSelect.getValue();
        typeLabel = varTypeSelect.triggerLabel.textContent;
        ticker = document.getElementById('inp-ticker').value.toUpperCase();
        currency = document.getElementById('inp-currency').value;

        if (!ticker) {
            alert('Por favor, informe o Ticker.');
            return;
        }
    } else {
        type = typeSelect.getValue();
        typeLabel = typeSelect.triggerLabel.textContent;
        indexer = indexerSelect.getValue();
        indexerLabel = indexerSelect.triggerLabel.textContent;

        if (!type || !indexer) {
            alert('Por favor, selecione o Tipo e a Rentabilidade.');
            return;
        }
    }

    const valInp = document.getElementById('inp-value'); // Price or Invested Value
    const costsInp = document.getElementById('inp-costs');
    const qtyInp = document.getElementById('inp-qty');
    const date = document.getElementById('inp-date').value;

    const val = parseMoney(valInp?.value || '0');
    const costs = parseMoney(costsInp?.value || '0');
    let qty = 0;

    let investedValue = 0;

    // --- Logic Split ---

    if (isVariable) {
        // Variable Income Logic
        // value = Price
        // Qty is required
        // Invested = (Price * Qty) + Costs

        // Qty might have decimals
        qty = parseFloat(qtyInp.value.replace(',', '.')); // Simple parse for now, assuming input handled decimals
        if (isNaN(qty) || qty <= 0) {
            alert('Quantidade inválida');
            return;
        }

        investedValue = (val * qty) + costs;

    } else if (isTreasury) {
        // Treasury Logic
        // value = Unit Price
        // Qty required
        qty = parseMoney(qtyInp.value || '0');
        investedValue = (qty * val) + costs;

        const rate = parseFloat(document.getElementById('inp-rate').value.replace(',', '.')) || 0;
    } else {
        // Fixed Income Logic
        // value = Invested Value directly
        investedValue = val + costs;
        qty = 1; // Default
    }

    const rate = !isVariable ? (parseFloat(document.getElementById('inp-rate')?.value.replace(',', '.') || '0')) : 0;
    const due = document.getElementById('inp-due')?.value || '';

    // Construct Asset Object
    let assetData = {
        type: typeLabel,
        startDate: date,
        dueDate: due,
        isReserve: currentIsReserve || currentCategory === 'reserve',
        investedValue: investedValue,
        currentBalance: investedValue, // Initial
        status: 'active',
        qty: qty,
        history: [{
            date: date, // ISO string needed? `date` from input is YYYY-MM-DD. Store prefers ISO.
            type: 'buy',
            value: investedValue,
            details: { qty, price: val, costs }
        }]
    };

    if (isVariable) {
        assetData.category = 'variable';
        assetData.ticker = ticker;
        assetData.currency = currency;
        assetData.averagePrice = val;
    } else {
        assetData.category = 'fixed';
        assetData.issuer = document.getElementById('inp-issuer').value;
        assetData.indexer = indexerLabel;
        assetData.rate = rate;
    }

    try {
        if (currentIsSell) {
            // === SELL MODE ===
            if (qty > currentAvailableQty + 0.0001) {
                alert(`Quantidade indisponível. Máximo: ${currentAvailableQty}`);
                return;
            }

            await store.sellVariableAsset(currentEditState.assetId, {
                date: date,
                qty: qty,
                price: val,
                costs: costs
            });

            // Common Success Modal will open below

        } else if (currentEditState && currentEditState.isEdit) {
            // === EDIT MODE ===
            const newData = {
                date: date,
                type: currentEditState.initialData.type || 'buy', // Maintain original type or default to buy
                value: investedValue,
                details: { qty, price: val, costs }
            };

            if (isVariable) {
                await store.editVariableHistoryItem(currentEditState.assetId, currentEditState.historyIndex, newData);
            } else {
                alert('Edição de Renda Fixa não implementada.');
                return;
            }

        } else {
            // === ADD MODE ===
            if (isVariable) {
                await store.addVariableAsset(assetData);
            } else {
                await store.addFixedIncomeAsset(assetData);
            }
        }

        // Show Success (Common for Add, Edit, Sell)
        const successHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center;">
             <div style="
                width: 60px; height: 60px; 
                background: var(--success-color); 
                border-radius: 50%; 
                display: flex; align-items: center; justify-content: center;
                color: white; font-size: 2rem; margin-bottom: 1rem;
             ">✓</div>
             <h3 style="margin-bottom: 0.5rem; font-weight: 700;">Salvo com sucesso!</h3>
             <p style="color: var(--text-secondary);">O ativo foi atualizado.</p>
          </div>
        `;
        modalInstance.open('Sucesso', successHtml);
        setTimeout(() => {
            modalInstance.close();
        }, 2000);

    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    }
}
