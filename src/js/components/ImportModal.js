import { Modal } from './Modal.js';
import { addAsset, updateAsset, addVariableAsset, updateVariableAsset } from '../firebase/firestore.js';
import { store } from '../store.js';
import { CustomSelect } from './CustomSelect.js';

export function openImportModal() {
    console.log('openImportModal chamado!');
    try {
        // 1. Create Modal Container
        const modalId = 'import-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        document.body.appendChild(modal); // Append FIRST so getElementById works inside render

        // Initial State
        let currentStep = 1;
        let selectedModule = '';
        let parsedData = [];
        let validationErrors = [];
        let customSelectInstance = null; // Track instance
        let isImportFinished = false;

        // Render Function
        const render = () => {
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px; width: 90%;">
                    <div class="modal-header">
                        <h2 class="modal-title">Importar Dados</h2>
                        <span class="close-modal">&times;</span>
                    </div>
                    
                    <div class="modal-body" style="padding: 2rem;">
                        
                        <!-- Progress Bar -->
                        ${!isImportFinished ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 2.5rem; position: relative; max-width: 400px; margin-left: auto; margin-right: auto;">
                            <div style="position: absolute; top: 14px; left: 0; right: 0; height: 2px; background: var(--border-color); z-index: 0;"></div>
                            <div style="position: absolute; top: 14px; left: 0; width: ${getProgressPercent()}%; height: 2px; background: var(--primary-color); z-index: 0; transition: width 0.3s;"></div>
                            
                            ${renderStepIndicator(1, 'Seleção')}
                            ${renderStepIndicator(2, 'Validação')}
                            ${renderStepIndicator(3, 'Importação')}
                        </div>
                        ` : ''}

                        <!-- Step Content -->
                        <div id="step-content">
                            ${getStepContent()}
                        </div>

                    </div>
                    
                    ${!isImportFinished ? `
                    <div class="modal-footer" style="justify-content: flex-end; gap: 1rem; padding: 1.5rem; border-top: 1px solid var(--border-color);">
                        <button id="btn-cancel" class="btn btn-ghost" style="margin-right: auto;">Cancelar</button>
                        ${currentStep > 1 && currentStep < 3 ? '<button id="btn-back" class="btn btn-outline">Voltar</button>' : ''}
                        ${renderNextButton()}
                    </div>
                    ` : ''}
                </div>
            `;

            // Re-attach listeners after render
            attachListeners();

            // Initialize Custom Select if on Step 1
            if (currentStep === 1) {
                if (customSelectInstance) {
                    customSelectInstance.destroy();
                }
                customSelectInstance = new CustomSelect('module-select-container', [
                    { value: 'fixed_income', label: 'Renda Fixa' },
                    { value: 'variable_income', label: 'Renda Variável' },
                    { value: 'treasury', label: 'Tesouro Direto' },
                    { value: 'proventos', label: 'Proventos (Renda Variável)' }
                ], (value) => {
                    selectedModule = value;
                    render();
                }, selectedModule);
            }
        };

        // ... (getProgressPercent, renderStepIndicator, getStepContent omitted for brevity as they are unchanged) ...
        // I need to skip them in replacement or include them? 
        // replace_file_content target must be contiguous. 
        // I can target the top block.

        // ...

        const attachListeners = () => {
            const closeBtn = modal.querySelector('.close-modal');
            const cancelBtn = modal.querySelector('#btn-cancel');
            const nextBtn = modal.querySelector('#btn-next');
            const backBtn = modal.querySelector('#btn-back');
            const fileInput = modal.querySelector('#file-upload');
            const downloadSampleParams = modal.querySelector('#btn-download-sample');

            if (closeBtn) closeBtn.onclick = closeModal;
            if (cancelBtn) cancelBtn.onclick = closeModal;

            if (downloadSampleParams) {
                downloadSampleParams.onclick = downloadSample;
            }

            if (fileInput) {
                fileInput.onchange = handleFileUpload;
            }

            const selectFileBtn = modal.querySelector('#btn-select-file');
            if (selectFileBtn && fileInput) {
                selectFileBtn.onclick = () => fileInput.click();
            }

            if (nextBtn) {
                nextBtn.onclick = () => {
                    console.log('Next button clicked', currentStep, selectedModule);
                    if (currentStep === 1) {
                        currentStep = 2;
                        render();
                    } else if (currentStep === 2) {
                        currentStep = 3;
                        render();
                        executeImport();
                    }
                };
            }

            if (backBtn) {
                backBtn.onclick = () => {
                    currentStep--;
                    render();
                };
            }
        };

        const closeModal = () => {
            if (customSelectInstance) customSelectInstance.destroy();
            modal.classList.remove('open');
            setTimeout(() => {
                modal.remove();
            }, 300); // Wait for transition
        };

        const getProgressPercent = () => {
            if (currentStep === 1) return 0;
            if (currentStep === 2) return 50;
            return 100;
        };

        const renderStepIndicator = (step, label) => {
            const active = currentStep >= step;
            const color = active ? 'var(--primary-color)' : 'var(--text-secondary)';
            const bgColor = active ? 'var(--primary-color)' : 'var(--bg-card)';
            const textColor = active ? '#fff' : 'var(--text-secondary)';
            const borderColor = active ? 'var(--primary-color)' : 'var(--border-color)';
            const fontWeight = active ? '600' : '400';

            return `
                <div style="z-index: 1; text-align: center; background: var(--bg-card); padding: 0 5px;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${bgColor}; border: 2px solid ${borderColor}; color: ${textColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto; font-size: 0.9rem;">${step}</div>
                    <div style="font-size: 0.75rem; margin-top: 8px; color: ${color}; font-weight: ${fontWeight};">${label}</div>
                </div>
            `;
        };

        const getStepContent = () => {
            if (currentStep === 1) {
                const moduleLabel = selectedModule === 'fixed_income' ? 'Renda Fixa' :
                    selectedModule === 'variable_income' ? 'Renda Variável' :
                        selectedModule === 'treasury' ? 'Tesouro Direto' :
                            selectedModule === 'proventos' ? 'Proventos' : 'Selecione...';

                return `
                    <div class="form-group">
                        <label class="form-label">Módulo de Destino</label>
                        <div id="module-select-container">
                             <!-- Custom Select will be injected here -->
                             <!-- We can pre-fill the HTML structure if we want slightly better flicker handling, but JS init is fast enough -->
                        </div>
                    </div>

                    <div id="module-info" style="margin-top: 2rem; min-height: 120px;">
                        ${selectedModule === 'fixed_income' ? `
                            <div style="background: var(--bg-hover); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Instruções - Renda Fixa</h4>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                                    O arquivo CSV deve conter um cabeçalho com as colunas exatas abaixo:
                                </p>
                                <div style="background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--primary-color); border: 1px solid var(--border-color); margin-bottom: 1rem; overflow-x: auto;">
                                    data_investimento, tipo, emissor, vencimento, indexador, taxa, valor, custos
                                </div>
                                <button id="btn-download-sample" class="btn btn-ghost btn-sm" style="padding-left: 0; color: var(--primary-color);">
                                    <span style="margin-right: 5px;">⬇️</span> Baixar modelo Renda Fixa
                                </button>
                            </div>
                        ` : selectedModule === 'treasury' ? `
                             <div style="background: var(--bg-hover); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Instruções - Tesouro Direto</h4>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                                    O arquivo CSV deve conter um cabeçalho com as colunas exatas abaixo. <br>
                                    O sistema identificará o tipo (Selic, IPCA+, etc) automaticamente pelo título.
                                </p>
                                <div style="background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--primary-color); border: 1px solid var(--border-color); margin-bottom: 1rem; overflow-x: auto;">
                                    data_compra, titulo, vencimento, quantidade, valor_unitario, taxa, custos
                                </div>
                                <button id="btn-download-sample" class="btn btn-ghost btn-sm" style="padding-left: 0; color: var(--primary-color);">
                                    <span style="margin-right: 5px;">⬇️</span> Baixar modelo Tesouro
                                </button>
                            </div>
                        ` : selectedModule === 'variable_income' ? `
                            <div style="background: var(--bg-hover); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Instruções - Renda Variável</h4>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                                    O arquivo CSV deve conter o histórico de operações. <br>
                                    Tipos aceitos: Ação, FII, Exterior, Cripto. <br>
                                    Moeda: BRL ou USD (opcional, padrão BRL).
                                </p>
                                <div style="background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--primary-color); border: 1px solid var(--border-color); margin-bottom: 1rem; overflow-x: auto;">
                                    data, ticker, tipo, quantidade, preco, custos, moeda
                                </div>
                                <button id="btn-download-sample" class="btn btn-ghost btn-sm" style="padding-left: 0; color: var(--primary-color);">
                                    <span style="margin-right: 5px;">⬇️</span> Baixar modelo Renda Variável
                                </button>
                            </div>
                        ` : selectedModule === 'proventos' ? `
                            <div style="background: var(--bg-hover); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Instruções - Proventos</h4>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                                    Importe seu histórico de dividendos e JCP. <br>
                                    Moeda: BRL ou USD. Se for USD, informe a Cotação e Impostos.
                                </p>
                                <div style="background: var(--bg-card); padding: 0.75rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.85rem; color: var(--primary-color); border: 1px solid var(--border-color); margin-bottom: 1rem; overflow-x: auto;">
                                    data, ticker, categoria, evento, valor, moeda, impostos, cotacao
                                </div>
                                <button id="btn-download-sample" class="btn btn-ghost btn-sm" style="padding-left: 0; color: var(--primary-color);">
                                    <span style="margin-right: 5px;">⬇️</span> Baixar modelo Proventos
                                </button>
                            </div>
                        ` : `
                            <div style="text-align: center; color: var(--text-secondary); padding: 2rem; border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
                                <p>Selecione um módulo acima para ver as instruções.</p>
                            </div>
                        `}
                    </div>
                `;
            }

            else if (currentStep === 2) {
                return `
                    <div style="text-align: center; border: 2px dashed var(--border-color); padding: 3rem 2rem; border-radius: var(--radius-lg); background: var(--bg-hover); transition: all 0.2s;">
                        <input type="file" id="file-upload" accept=".csv" style="display: none;">
                        <div style="margin-bottom: 1.5rem;">
                            <span style="font-size: 3rem; opacity: 0.5;">📄</span>
                        </div>
                        <h4 style="margin-bottom: 0.5rem;">Upload de Arquivo</h4>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                            Arraste seu arquivo CSV aqui ou clique para selecionar
                        </p>
                        <button class="btn btn-outline" id="btn-select-file">Selecionar Arquivo</button>
                        <div id="file-name" style="margin-top: 1rem; font-weight: 500; color: var(--primary-color);"></div>
                    </div>

                    <div id="validation-results" style="margin-top: 1.5rem;"></div>
                `;
            }

            else if (currentStep === 3) {
                if (!isImportFinished) {
                    return `
                        <div style="text-align: center; padding: 3rem 1rem;">
                            <div class="spinner" style="margin: 0 auto 1.5rem auto; width: 40px; height: 40px; border: 3px solid rgba(var(--primary-rgb), 0.1); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary);">Importando Dados...</h3>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem;">Por favor, aguarde enquanto processamos seus arquivos.</p>
                            
                            <div class="progress-bar-container" style="height: 6px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; max-width: 300px; margin: 0 auto;">
                                <div id="import-progress" class="progress-bar-fill" style="width: 0%; height: 100%; background: var(--primary-color); transition: width 0.3s ease-out; border-radius: 4px;"></div>
                            </div>
                            <style>
                                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                            </style>
                        </div>
            `;
                }

                return `
            <div style="text-align: center; padding: 2rem 1rem;">
                        <div style="width: 72px; height: 72px; margin: 0 auto 1.5rem auto; display: flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.1); border-radius: 50%;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Sucesso!</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 2rem; max-width: 300px; margin-left: auto; margin-right: auto;">
                            A importação foi finalizada e <b>${parsedData.length}</b> ativos foram adicionados.
                        </p>

                        <div style="background: var(--bg-hover); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Ativos</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${parsedData.length}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Módulo</div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary-color);">
                                    ${selectedModule === 'treasury' ? 'Tesouro Direto' :
                        selectedModule === 'variable_income' ? 'Renda Variável' :
                            selectedModule === 'proventos' ? 'Proventos' : 'Renda Fixa'}
                                </div>
                            </div>
                        </div>

                        <button id="btn-finish" class="btn btn-primary" style="width: 100%; padding: 0.875rem; font-size: 1rem; justify-content: center;">
                            Concluir Importação
                        </button>
                    </div>
            `;
            }
        };

        const renderNextButton = () => {
            if (currentStep === 1) {
                const disabled = !selectedModule || (selectedModule !== 'fixed_income' && selectedModule !== 'treasury' && selectedModule !== 'variable_income' && selectedModule !== 'proventos');
                return `<button id="btn-next" class="btn btn-primary" ${disabled ? 'disabled' : ''}>Continuar</button>`;
            }
            if (currentStep === 2) {
                const disabled = parsedData.length === 0 || validationErrors.length > 0;
                return `<button id="btn-next" class="btn btn-primary" ${disabled ? 'disabled' : ''}>Importar Dados</button>`;
            }
            return '';
        };



        const downloadSample = () => {
            let csvContent = "";
            let filename = "modelo.csv";

            if (selectedModule === 'fixed_income') {
                csvContent = "data_investimento,tipo,emissor,vencimento,indexador,taxa,valor,custos\n2024-01-15,CDB,Banco XP,2026-01-15,CDI,110,5000.00,0.00\n2023-12-01,LCI,Banco ABC,2025-12-01,IPCA+,6.5,10000.50,15.00";
                filename = "modelo_renda_fixa_v2.csv";
            } else if (selectedModule === 'treasury') {
                csvContent = "data_compra,titulo,vencimento,quantidade,valor_unitario,taxa,custos\n2024-03-20,Tesouro Selic 2029,2029-03-01,0.50,14270.40,0.00,0\n2023-11-10,Tesouro IPCA+ 2045,2045-05-15,2.0,2600.00,5.50,10.00";
                filename = "modelo_tesouro_direto.csv";
            } else if (selectedModule === 'variable_income') {
                csvContent = "data,ticker,tipo,quantidade,preco,custos,moeda\n2024-01-10,PETR4,Ação,100,35.50,10.00,BRL\n2024-02-15,VRTA11,FII,50,90.20,0.00,BRL\n2024-03-01,AAPL,Exterior,10,180.00,5.00,USD\n2024-03-10,BTC,Cripto,0.005,350000.00,0.00,BRL";
                filename = "modelo_renda_variavel.csv";
            } else if (selectedModule === 'proventos') {
                csvContent = "data,ticker,categoria,evento,valor,moeda,impostos,cotacao\n2024-04-15,PETR4,Ação,Dividendo,150.00,BRL,0,0\n2024-05-10,HGLG11,FII,Rendimento,85.50,BRL,0,0\n2024-06-01,AAPL,Exterior,Dividendo,0.25,USD,0.08,5.05";
                filename = "modelo_proventos.csv";
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                validateCSV(text);
            };
            reader.readAsText(file);

            // Update UI to show filename
            const nameDisplay = document.getElementById('file-name');
            if (nameDisplay) nameDisplay.textContent = file.name;
        };

        const validateCSV = (text) => {
            parsedData = [];
            validationErrors = [];
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);

            if (lines.length < 2) {
                validationErrors.push({ line: 0, msg: "Arquivo vazio ou sem dados." });
                renderValidationResults();
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            let required = [];
            if (selectedModule === 'fixed_income') {
                required = ['data_investimento', 'tipo', 'emissor', 'vencimento', 'indexador', 'taxa', 'valor', 'custos'];
            } else if (selectedModule === 'treasury') {
                // Updated required headers per user request
                required = ['data_compra', 'titulo', 'vencimento', 'quantidade', 'valor_unitario', 'taxa', 'custos'];
            } else if (selectedModule === 'variable_income') {
                required = ['data', 'ticker', 'tipo', 'quantidade', 'preco', 'custos', 'moeda'];
            } else if (selectedModule === 'proventos') {
                required = ['data', 'ticker', 'categoria', 'evento', 'valor', 'moeda', 'impostos', 'cotacao'];
            }

            const missing = required.filter(r => !headers.includes(r));
            if (missing.length > 0) {
                validationErrors.push({ line: 1, msg: `Colunas obrigatórias faltando: ${missing.join(', ')} ` });
                renderValidationResults();
                return;
            }

            // Parse Rows
            // Regex to split by comma, ignoring commas inside double quotes
            const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

            for (let i = 1; i < lines.length; i++) {
                // Remove carriage returns just in case
                const line = lines[i].replace('\r', '');

                // Use regex split
                const cols = line.split(splitRegex).map(c => {
                    let val = c.trim();
                    // Remove surrounding double quotes if present
                    if (val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1);
                    }
                    return val;
                });

                if (cols.length !== headers.length) {
                    validationErrors.push({ line: i + 1, msg: `Número de colunas incorreto.Esperado: ${headers.length}, Encontrado: ${cols.length} ` });
                    continue;
                }

                const rowData = {};
                headers.forEach((h, index) => rowData[h] = cols[index]);

                // Helper to parse BR Money "1.000,00" or "R$ 1.000,00" or "IPCA + 5,40%" -> 1000.00 / 5.40
                const parseMoney = (str) => {
                    if (!str) return 0;

                    // Convert to string in case it's not
                    let val = String(str).trim();

                    // Remove R$, %, text like "IPCA +", "SELIC +", spaces
                    // Be careful not to remove the comma or dot used for decimals/thousands yet
                    // Strategy: Extract the last valid number pattern? 
                    // Or just remove all non-numeric chars except ',' and '.' and '-'?
                    // But "IPCA + 5,40" has spaces and plus.

                    // For Treasury Rate like "IPCA + 5,40%", we want 5.40.
                    // For Unit Price "R$ 118,89", we want 118.89.

                    // 1. Remove obvious non-numeric prefix/suffix text if possible, but regex is safer.
                    // Let's keep digits, minus, commas, and dots.
                    // This strips letters, spaces, $, %, +
                    val = val.replace(/[^\d,\.-]/g, '');

                    // Now we might have "1.000,00" or "5,40" or "0,320"

                    // BR standard: dots are thousands separators, comma is decimal.
                    // However, sometimes people use dots for decimals in CSVs generated by US software?
                    // Given the screenshot "0,04", "118,89", it's definitely BR format (comma = decimal).
                    // And "data_compra" 10/1/2022 suggests local excel export.

                    // Remove dots (thousands separators)
                    val = val.replace(/\./g, '');

                    // Replace comma with dot
                    val = val.replace(',', '.');

                    const parsed = parseFloat(val);
                    return isNaN(parsed) ? 0 : parsed;
                };

                // Helper to parse BR Date "04/10/2025" -> "2025-10-04"
                const parseDate = (str) => {
                    if (!str) return null;
                    let val = str.trim();
                    if (val.includes('-')) return val; // Already ISO?

                    // Handle potential quoting or extra chars
                    val = val.replace(/[^\d\/]/g, '');

                    const parts = val.split('/');
                    if (parts.length === 3) {
                        // Check logical formatting. 
                        // Usually D/M/Y in BR.
                        // But imported simple CSVs often drop leading zeros: "10/1/2022".
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2];
                        return `${year}-${month}-${day}`;
                    }
                    return null;
                };

                let mappedData = null;

                if (selectedModule === 'fixed_income') {
                    // Map Fixed Income Data
                    const amount = parseMoney(rowData['valor']);
                    const costs = parseMoney(rowData['custos']);
                    const rate = parseMoney(rowData['taxa']);
                    const dateISO = parseDate(rowData['data_investimento']);
                    const dueDateISO = parseDate(rowData['vencimento']);

                    mappedData = {
                        date: dateISO,
                        type: rowData['tipo'],
                        issuer: rowData['emissor'],
                        dueDate: dueDateISO,
                        indexer: rowData['indexador'],
                        rate: rate,
                        amount: amount,
                        costs: costs
                    };
                } else if (selectedModule === 'treasury') {
                    // Map Treasury Data
                    const unitPrice = parseMoney(rowData['valor_unitario']);
                    const qty = parseMoney(rowData['quantidade']);
                    const costs = parseMoney(rowData['custos']);
                    const rate = parseMoney(rowData['taxa']);
                    const dateISO = parseDate(rowData['data_compra']);
                    const dueDateISO = parseDate(rowData['vencimento']);
                    const title = rowData['titulo'];

                    // Derive Type and Indexer from Title
                    let type = 'Tesouro Indefinido';
                    let indexer = 'Indefinido';

                    // Ensure title exists
                    const lowerTitle = (title || '').toLowerCase();
                    if (lowerTitle.includes('selic')) {
                        type = 'Tesouro Selic';
                        indexer = 'Selic +';
                    } else if (lowerTitle.includes('ipca')) {
                        type = 'Tesouro IPCA+';
                        indexer = 'IPCA +';
                    } else if (lowerTitle.includes('prefixado') || lowerTitle.includes('pré-fixado') || lowerTitle.includes('pre-fixado')) {
                        type = 'Tesouro Pré-fixado';
                        indexer = 'Pré-fixado';
                    } else if (lowerTitle.includes('renda+')) {
                        type = 'Tesouro Renda+';
                        indexer = 'IPCA +';
                    }

                    // Calculate Invested Amount (Raw)
                    // Ensure unitPrice and qty are valid numbers to prevent NaN
                    const safeQty = qty || 0;
                    const safePrice = unitPrice || 0;
                    const safeCosts = costs || 0;

                    const totalInvested = (safeQty * safePrice) + safeCosts;

                    mappedData = {
                        date: dateISO,
                        type: type,
                        issuer: 'Tesouro Nacional',
                        dueDate: dueDateISO,
                        indexer: indexer,
                        rate: rate,
                        amount: totalInvested, // This will be the investedValue
                        costs: safeCosts,
                        qty: safeQty,
                        qty: safeQty,
                        unitPrice: safePrice // Keep track of unit price if needed, though usually just for calculation
                    };
                } else if (selectedModule === 'variable_income') {
                    // Map Variable Income Data
                    const dateISO = parseDate(rowData['data']);
                    const qty = parseMoney(rowData['quantidade']);
                    const price = parseMoney(rowData['preco']);
                    const costs = parseMoney(rowData['custos']);
                    const ticker = (rowData['ticker'] || '').toUpperCase();

                    let currency = (rowData['moeda'] || '').toUpperCase().trim();
                    if (!currency) currency = 'BRL';

                    // Map CSV Types to Internal Types
                    let typeRaw = (rowData['tipo'] || 'Ação').trim();
                    let type = 'acao'; // default
                    if (typeRaw.match(/fii/i)) type = 'fii';
                    else if (typeRaw.match(/exterior|etf|bdr/i) || typeRaw.toUpperCase() === 'EXTERIOR') type = 'exterior';
                    else if (typeRaw.match(/cripto|crypto/i)) type = 'cripto';

                    const total = (qty * price) + costs;

                    mappedData = {
                        date: dateISO,
                        ticker: ticker,
                        type: type,
                        qty: qty,
                        unitPrice: price,
                        costs: costs,
                        amount: total, // Invested Value for this transaction
                        currency: currency
                    };
                } else if (selectedModule === 'proventos') {
                    // Map Proventos Data
                    const dateISO = parseDate(rowData['data']);
                    const ticker = (rowData['ticker'] || '').toUpperCase();
                    // Normalize Category
                    let catRaw = (rowData['categoria'] || '').toLowerCase();
                    let category = 'acao';
                    if (catRaw.includes('fii')) category = 'fii';
                    else if (catRaw.includes('exterior') || catRaw.includes('bdr') || catRaw.includes('etf')) category = 'exterior';
                    else category = 'acao';
                    // Normalize Event
                    let evtRaw = (rowData['evento'] || '').toUpperCase();
                    let event = 'Outros';
                    if (evtRaw.includes('DIVIDEND')) event = 'Dividendo';
                    else if (evtRaw.includes('JCP') || evtRaw.includes('JUROS')) event = 'JCP';
                    else if (evtRaw.includes('RENDIMENT')) event = 'Rendimento';
                    else if (evtRaw.includes('BONIFIC')) event = 'Bonificação';
                    else event = 'Outros';
                    const valueRaw = parseMoney(rowData['valor']); // Gross
                    const taxes = parseMoney(rowData['impostos']);
                    const quote = parseMoney(rowData['cotacao']);
                    let currency = (rowData['moeda'] || 'BRL').trim().toUpperCase();

                    // Logic: 
                    // If USD -> Net = (Gross - Tax) * Quote.
                    // If BRL -> Net = Gross (Tax assumed 0 or already deducted, standard in BR usually net is deposited, but CSV says Gross/Tax).

                    let finalValue = 0;
                    if (currency === 'USD') {
                        const netUSD = Math.max(0, valueRaw - taxes);
                        const safeQuote = quote > 0 ? quote : 1; // Fallback
                        finalValue = netUSD * safeQuote;
                    } else {
                        // BRL: Net = Gross - Tax
                        finalValue = Math.max(0, valueRaw - taxes);
                    }

                    mappedData = {
                        date: dateISO,
                        ticker: ticker,
                        category: category,
                        event: event,
                        value: finalValue, // This is always BRL Net Value
                        currency: currency,
                        originalValue: valueRaw,
                        taxes: taxes,
                        quote: quote
                    };
                }

                // Validate Data Types (Generic)
                if (selectedModule !== 'proventos') {
                    if (isNaN(mappedData.amount)) {
                        validationErrors.push({ line: i + 1, msg: `Valor calculado ou fornecido inválido.` });
                    }
                    if (isNaN(mappedData.costs)) {
                        validationErrors.push({ line: i + 1, msg: `Custos inválidos.` });
                    }
                }
                if (!mappedData.date || isNaN(Date.parse(mappedData.date))) {
                    validationErrors.push({ line: i + 1, msg: `Data da compra inválida.` });
                }
                if (selectedModule === 'fixed_income' || selectedModule === 'treasury') {
                    if (!mappedData.dueDate || isNaN(Date.parse(mappedData.dueDate))) {
                        validationErrors.push({ line: i + 1, msg: `Data de vencimento inválida.` });
                    }
                }

                if (selectedModule === 'treasury') {
                    if (isNaN(mappedData.qty)) {
                        validationErrors.push({ line: i + 1, msg: `Quantidade inválida.` });
                    }
                    if (isNaN(mappedData.unitPrice)) {
                        validationErrors.push({ line: i + 1, msg: `Valor Unitário inválido.` });
                    }
                    if (isNaN(mappedData.rate)) {
                        validationErrors.push({ line: i + 1, msg: `Taxa inválida.` });
                    }
                }

                if (selectedModule === 'variable_income') {
                    if (isNaN(mappedData.qty) || mappedData.qty <= 0) validationErrors.push({ line: i + 1, msg: `Quantidade inválida.` });
                    if (isNaN(mappedData.unitPrice) || mappedData.unitPrice < 0) validationErrors.push({ line: i + 1, msg: `Preço inválido.` });
                    if (isNaN(mappedData.unitPrice) || mappedData.unitPrice < 0) validationErrors.push({ line: i + 1, msg: `Preço inválido.` });
                    if (!mappedData.ticker) validationErrors.push({ line: i + 1, msg: `Ticker obrigatório.` });
                }

                if (selectedModule === 'proventos') {
                    if (isNaN(mappedData.value) || mappedData.value < 0) validationErrors.push({ line: i + 1, msg: `Valor inválido.` });
                    if (!mappedData.ticker) validationErrors.push({ line: i + 1, msg: `Ticker obrigatório.` });
                    if (!mappedData.category) validationErrors.push({ line: i + 1, msg: `Categoria obrigatória.` });
                }

                if (validationErrors.length === 0) {
                    parsedData.push(mappedData);
                }
            }

            renderValidationResults();
        };

        const renderValidationResults = () => {
            const container = document.getElementById('validation-results');
            if (!container) return;

            if (validationErrors.length > 0) {
                container.innerHTML = `
            <div style="background: rgba(220, 53, 69, 0.1); border: 1px solid var(--danger-color); border-radius: var(--radius-sm); padding: 1rem;">
                        <h4 style="color: var(--danger-color); margin-bottom: 0.5rem; font-size: 0.95rem;">Erros Encontrados (${validationErrors.length})</h4>
                        <ul style="font-size: 0.9rem; color: var(--text-secondary); max-height: 150px; overflow-y: auto; padding-left: 1.2rem;">
                            ${validationErrors.map(e => `<li><b>Linha ${e.line}:</b> ${e.msg}</li>`).join('')}
                        </ul>
                    </div>
            `;
            } else if (parsedData.length > 0) {
                container.innerHTML = `
            <div style="background: rgba(40, 167, 69, 0.1); border: 1px solid var(--success-color); border-radius: var(--radius-sm); padding: 1rem;">
                        <h4 style="color: var(--success-color); margin-bottom: 0.5rem; font-size: 0.95rem;">Validação Concluída</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">
                            ${parsedData.length} registros válidos e prontos para importação (${selectedModule === 'treasury' ? 'Tesouro' :
                        selectedModule === 'variable_income' ? 'Renda Variável' :
                            selectedModule === 'proventos' ? 'Proventos' : 'Renda Fixa'}).
                        </p>
                    </div>
            `;
            }

            // Re-render buttons state
            const nextBtn = document.getElementById('btn-next');
            if (nextBtn) {
                if (validationErrors.length === 0 && parsedData.length > 0) {
                    nextBtn.disabled = false;
                } else {
                    nextBtn.disabled = true;
                }
            }
        };

        const executeImport = async () => {
            const progressFill = document.getElementById('import-progress');
            const state = store.getState();
            const user = state.user;

            // We need a local cache to track assets as we modify them *during* the loop.
            // This prevents creating duplicates when the CSV has multiple rows for the same new asset.
            // Map Key: Type + DueDate + Issuer
            const assetCache = new Map();

            // Initialize cache with existing store assets
            if (selectedModule === 'variable_income') {
                (state.variableIncome.assets || []).forEach(a => {
                    const key = a.ticker.toUpperCase();
                    assetCache.set(key, { ...a });
                });
            } else if (selectedModule === 'treasury') {
                // For Treasury, WE WANT TO AGGREGATE by Type + Maturity to avoid duplicates in list view
                // Previous logic separated by start date, causing multiple assets for same title.
                (state.fixedIncome.assets || []).forEach(a => {
                    // Key: Type + DueDate + Issuer (Tesouro Nacional usually)
                    const key = `${a.type}|${new Date(a.dueDate).getTime()}|${a.issuer}`;
                    assetCache.set(key, { ...a });
                });
            } else {
                // Fixed Income (Generic) - Maybe we group them? Or separate? 
                // Defaulting to grouping by type+due+issuer for now unless specified otherwise.
                (state.fixedIncome.assets || []).forEach(a => {
                    const key = `${a.type}|${new Date(a.dueDate).getTime()}|${a.issuer}`;
                    assetCache.set(key, { ...a });
                });
            }

            if (!user) {
                alert("Erro: Usuário não autenticado.");
                return;
            }

            let completed = 0;
            const total = parsedData.length;

            for (const item of parsedData) {
                if (selectedModule === 'proventos') {
                    try {
                        const data = {
                            date: item.date,
                            ticker: item.ticker,
                            category: item.category,
                            event: item.event,
                            value: item.value, // Net BRL
                            currency: item.currency,
                            originalValue: item.originalValue,
                            taxes: item.taxes,
                            quote: item.quote
                        };

                        await store.addProvento(data);

                        completed++;
                        const pct = Math.round((completed / total) * 100);
                        if (progressFill) progressFill.style.width = `${pct}% `;

                    } catch (err) {
                        console.error("Error importing provento:", item, err);
                    }
                    continue;
                }
                const investedValue = item.amount;
                const costs = item.costs;

                const historyEntry = {
                    date: item.date,
                    type: 'buy',
                    value: investedValue, // Total Cost for this transaction
                    details: item.qty ? { qty: item.qty, unitPrice: item.unitPrice, costs: costs } : null
                };

                // Generate Key for Cache Lookup
                let key = '';
                let issuer = '';

                if (selectedModule === 'variable_income') {
                    key = item.ticker.toUpperCase();
                } else {
                    issuer = selectedModule === 'treasury' ? 'Tesouro Nacional' : item.issuer;
                    if (selectedModule === 'treasury') {
                        // Aggregate by Type + Maturity
                        key = `${item.type}|${new Date(item.dueDate).getTime()}|${issuer}`;
                    } else {
                        key = `${item.type}|${new Date(item.dueDate).getTime()}|${issuer}`;
                    }
                }

                let currentAsset = assetCache.get(key);

                try {
                    if (currentAsset) {
                        // --- MERGE ---
                        const newHistory = [...(currentAsset.history || []), historyEntry];

                        if (selectedModule === 'variable_income') {
                            // Variable Income Specific Merge (Average Price)
                            const currentQty = parseFloat(currentAsset.qty || 0);
                            const currentInvested = parseFloat(currentAsset.investedValue || 0);
                            const itemQty = parseFloat(item.qty || 0);

                            const newQty = currentQty + itemQty;
                            const newInvested = currentInvested + investedValue; // investedValue includes costs? Yes, per item.amount logic

                            // Calculate new Average Price? 
                            // The system usually stores total invested and qty, average price is derived or stored for convenience.
                            // averagePrice = newInvested / newQty (if newQty > 0)
                            const newAvgPrice = newQty > 0 ? newInvested / newQty : 0;

                            // For Variable Income, 'currentBalance' isn't just sum of invested, it depends on market price.
                            // But for IMPORT, we don't have real-time market price updates yet.
                            // We should update currentBalance based on the *latest* known price or just update invested/qty?
                            // If we assume the price in the import is the "current" price if it's recent?
                            // Let's stick to update invested/qty. 
                            // We update currentBalance adding the new investment value to keep it consistent with "cash in",
                            // OR we assume currentBalance updates based on price * qty.
                            // Let's update currentBalance by adding the new invested amount (conservative).
                            const currentBalance = parseFloat(currentAsset.currentBalance || 0);
                            const newBalance = currentBalance + investedValue;

                            const updatePayload = {
                                qty: newQty,
                                investedValue: newInvested,
                                totalInvested: newInvested, // Usually same as investedValue for RV
                                currentBalance: newBalance,
                                averagePrice: newAvgPrice,
                                history: newHistory,
                                lastUpdate: new Date().toISOString()
                            };

                            await updateVariableAsset(user.uid, currentAsset.id, updatePayload);
                            assetCache.set(key, { ...currentAsset, ...updatePayload });

                        } else {
                            // Fixed Income / Treasury Merge
                            const currentBalance = parseFloat(currentAsset.currentBalance) || 0;
                            const currentInvested = parseFloat(currentAsset.investedValue) || 0;
                            const currentTotalInvested = parseFloat(currentAsset.totalInvested) || 0;
                            const currentQty = parseFloat(currentAsset.qty) || 0;

                            const newQty = item.qty ? currentQty + item.qty : currentQty;
                            const newBalance = currentBalance + investedValue;
                            const newInvested = currentInvested + investedValue;
                            const newTotalInvested = currentTotalInvested + investedValue;

                            const updatePayload = {
                                investedValue: newInvested,
                                totalInvested: newTotalInvested,
                                currentBalance: newBalance,
                                qty: newQty,
                                history: newHistory,
                                lastUpdate: new Date().toISOString()
                            };

                            await updateAsset(user.uid, currentAsset.id, updatePayload);
                            assetCache.set(key, { ...currentAsset, ...updatePayload });
                        }

                    } else {
                        // --- CREATE ---
                        if (selectedModule === 'variable_income') {
                            const assetPayload = {
                                ticker: item.ticker,
                                type: item.type,
                                qty: item.qty || 0,
                                averagePrice: item.unitPrice, // Initial PM
                                investedValue: investedValue,
                                currentBalance: investedValue, // Initial Balance = Invested
                                totalInvested: investedValue,
                                lastUpdate: new Date().toISOString(),
                                currency: item.currency || 'BRL',
                                history: [historyEntry]
                            };
                            const docRef = await addVariableAsset(user.uid, assetPayload);
                            assetCache.set(key, { ...assetPayload, id: docRef.id });

                        } else {
                            const assetPayload = {
                                type: item.type,
                                issuer: issuer,
                                indexer: item.indexer,
                                rate: item.rate,
                                investedValue: investedValue,
                                costs: costs,
                                totalInvested: investedValue,
                                currentBalance: investedValue,
                                qty: item.qty || 0,
                                startDate: item.date,
                                dueDate: item.dueDate,
                                lastUpdate: new Date().toISOString(),
                                history: [historyEntry]
                            };

                            const docRef = await addAsset(user.uid, assetPayload);
                            assetCache.set(key, { ...assetPayload, id: docRef.id });
                        }
                    }

                    completed++;
                    const pct = Math.round((completed / total) * 100);
                    if (progressFill) progressFill.style.width = `${pct}%`;

                } catch (err) {
                    console.error("Import error for item:", item, err);
                }
            }

            // Artificial delay to show 100%
            if (progressFill) progressFill.style.width = '100%';

            // Transition to specific Success State
            setTimeout(() => {
                isImportFinished = true;
                render();

                // Re-bind Finish Button (since render re-created the DOM)
                setTimeout(() => {
                    const finishBtn = document.getElementById('btn-finish');
                    if (finishBtn) finishBtn.onclick = closeModal;
                }, 0);

            }, 500);
        };

        render();
        // document.body.appendChild(modal); // Moved to top

        // Trigger transition
        setTimeout(() => {
            modal.classList.add('open');
        }, 10);

    } catch (e) {
        console.error("Critical error in openImportModal:", e);
        alert("Erro ao abrir importação: " + e.message);
    }
}
