import { store } from './store.js';
import { icons } from './icons.js';
import { openContributionModal } from './contribution.js';
import { showVariableAssetDetails } from './components/VariableAssetDetail.js';
import { openSpecialEventsModal } from './components/SpecialEventsModal.js';
import { Modal } from './components/Modal.js';
import Chart from 'chart.js/auto';

let allocationChart = null;
let currentFilter = 'all'; // all, acao, fii, exterior, cripto
let updateModal = null;
let currentView = 'dashboard'; // dashboard, proventos

export function renderVariableIncome(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (currentView === 'proventos') {
        import('./components/Proventos.js').then(module => {
            module.renderProventos(containerId, () => {
                currentView = 'dashboard';
                renderVariableIncome(containerId);
            });
        });
        return;
    }

    const state = store.getState();
    const assets = (state.variableIncome.assets || []).filter(a => a.status !== 'closed' && a.qty > 0.000001);
    const dollarQuote = state.dollarQuote || 0; // 0 = não configurado

    // --- Calculations (convert USD to BRL) ---
    const totalInvested = assets.reduce((sum, a) => {
        const inv = parseFloat(a.investedValue) || 0;
        const cur = a.currency || 'BRL';
        return sum + (cur === 'USD' ? inv * dollarQuote : inv);
    }, 0);
    const totalBalance = assets.reduce((sum, a) => {
        const bal = parseFloat(a.currentBalance) || 0;
        const cur = a.currency || 'BRL';
        return sum + (cur === 'USD' ? bal * dollarQuote : bal);
    }, 0);
    const profit = totalBalance - totalInvested;
    const profitPerc = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    // Allocation Data (BRL-converted)
    const allocation = {
        'acao': 0,
        'fii': 0,
        'exterior': 0,
        'cripto': 0
    };

    assets.forEach(a => {
        // Map asset.type (stored as value e.g. 'acao' or label 'Ação'?)
        // In contribution.js, logic was: `type = varTypeSelect.getValue()` which returns 'acao', 'fii', etc.
        // Wait, `assetData.type` was set to `typeLabel` ("Ação") in `saveContribution`?
        // Let's check `saveContribution`.
        // `typeLabel = varTypeSelect.triggerLabel.textContent;` -> "Ação".
        // `type = varTypeSelect.getValue();` -> "acao".
        // In `saveContribution`, `assetData.type = typeLabel`.
        // So we have "Ação", "FII", "Exterior", "Cripto".
        // We need to map back to keys or use the labels directly.

        let key = 'outros';
        const t = a.type.toLowerCase();
        if (t.includes('ação') || t.includes('acao')) key = 'acao';
        else if (t.includes('fii')) key = 'fii';
        else if (t.includes('exterior')) key = 'exterior';
        else if (t.includes('cripto')) key = 'cripto';

        if (allocation[key] !== undefined) {
            const bal = parseFloat(a.currentBalance) || 0;
            const cur = a.currency || 'BRL';
            allocation[key] += cur === 'USD' ? bal * dollarQuote : bal;
        }
    });

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatPercent = (val) => `${val.toFixed(2)}%`;

    const html = `
        <div class="dashboard-grid">
            
            <!-- Cards Row -->
            <div class="card col-span-12 md-col-span-4">
                <div class="card-header"><span class="card-title">Total em Renda Variável</span></div>
                <div class="card-value" id="card-total-rv">R$ 0,00</div>
            </div>

            <div class="card col-span-12 md-col-span-4">
                <div class="card-header">
                    <span class="card-title">Rentabilidade</span>
                    <span id="card-profit-icon">
                        ${icons.trendUp}
                    </span>
                </div>
                <div class="card-value" id="card-profit-rv">
                    R$ 0,00
                </div>
                <div style="font-size: 0.85rem; margin-top: 4px;" id="card-profit-perc-rv">
                    0,00%
                </div>
            </div>

            <!-- Calculated Proventos Card -->
            <div class="card col-span-12 md-col-span-4">
                <div class="card-header">
                    <span class="card-title">Média Proventos (12m)</span>
                    <div style="color: var(--warning-color);">${icons.coins || '$'}</div>
                </div>
                <div class="card-value" id="card-proventos-rv">R$ 0,00</div>
            </div>

             <div class="card col-span-12 md-col-span-12">
                <div class="card-header">
                    <span class="card-title">Alocação por Classe</span>
                </div>
                <div id="rvAllocationChart" style="margin-top: 1rem;"></div>
            </div>

            <!-- Assets List Card (Unified) -->
            <div class="card col-span-12" style="padding-bottom: 0;">
                <div class="card-header" style="flex-wrap: wrap; gap: 1rem; align-items: center;">
                    <span class="card-title" style="border-left: 4px solid var(--primary-color); padding-left: 0.5rem;">Meus Ativos</span>
                    
                    <!-- Filters (Tabs) -->
                    <div class="tabs-container" style="display: flex; gap: 0.5rem; overflow-x: auto;">
                        <button class="btn btn-primary filter-btn" data-filter="all" style="border-radius: 20px; padding: 4px 12px; font-size: 0.8rem;">Todos</button>
                        <button class="btn btn-ghost filter-btn" data-filter="acao" style="border-radius: 20px; padding: 4px 12px; font-size: 0.8rem;">Ações</button>
                        <button class="btn btn-ghost filter-btn" data-filter="fii" style="border-radius: 20px; padding: 4px 12px; font-size: 0.8rem;">FIIs</button>
                        <button class="btn btn-ghost filter-btn" data-filter="exterior" style="border-radius: 20px; padding: 4px 12px; font-size: 0.8rem;">Exterior</button>
                        <button class="btn btn-ghost filter-btn" data-filter="cripto" style="border-radius: 20px; padding: 4px 12px; font-size: 0.8rem;">Cripto</button>
                    </div>

                    <!-- Right Actions -->
                     <div style="margin-left: auto; display: flex; gap: 0.5rem; overflow-x: auto; white-space: nowrap; padding-bottom: 4px; max-width: 100%;">
                         <button class="btn" id="btn-proventos" style="background: rgba(16, 185, 129, 0.1); color: var(--success-color); border: 1px solid var(--success-color); padding: 0.5rem 1rem; font-size: 0.85rem;" title="Proventos">
                            ${icons.dollarSign || '$'} <span class="desktop-only">Proventos</span>
                         </button>
                         <button class="btn" id="btn-update-prices" style="border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.5rem 1rem; font-size: 0.85rem;" title="Atualizar Cotações">
                            <span class="icon-refresh">${icons.refresh}</span> <span class="desktop-only">Cotações</span>
                         </button>
                         <button class="btn" id="btn-events" style="border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.5rem 1rem; font-size: 0.85rem;" title="Eventos (Bonificação/Split)">
                            <span class="icon-refresh">${icons.lightning}</span> <span class="desktop-only">Eventos</span>
                         </button>
                         <button class="btn btn-ghost" id="btn-history-var" style="padding: 0.5rem; color: var(--text-secondary);" title="Histórico">
                            ${icons.history}
                         </button>
                    </div>
                </div>

                <!-- Assets Table Container -->
                <div id="assets-list-container">
                    <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                        Carregando ativos...
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Helper to calculate and update cards based on filter
    const updateDashboardCards = (filter) => {
        const state = store.getState();
        const allAssets = (state.variableIncome.assets || []).filter(a => a.status !== 'closed' && a.qty > 0.000001);
        const allProventos = state.proventos || [];
        const dollarQuote = state.dollarQuote || 0;

        // Filter Assets
        const filteredAssets = allAssets.filter(a => {
            if (filter === 'all') return true;
            const t = (a.type || '').toLowerCase();
            let key = 'outros';
            if (t.includes('ação') || t.includes('acao')) key = 'acao';
            else if (t.includes('fii')) key = 'fii';
            else if (t.includes('exterior')) key = 'exterior';
            else if (t.includes('cripto') || t.includes('crypto')) key = 'cripto';
            return key === filter;
        });

        // Filter Proventos (Last 12m)
        const now = new Date();
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);

        const filteredProventos = allProventos.filter(p => {
            // 1. Filter by Date (12m for Avg)
            if (!p.date) return false;
            // Handle various formats if necessary, but assume YYYY-MM-DD for now.
            // Safety check for date validity
            const d = new Date(p.date + 'T00:00:00');
            if (isNaN(d.getTime())) return false;

            if (d < yearAgo || d > now) return false;

            // 2. Filter by Category
            if (filter === 'all') return true;
            const cat = (p.category || '').toLowerCase();

            // Mapping
            if (filter === 'acao') return cat === 'acao' || cat === 'ação';
            if (filter === 'fii') return cat === 'fii';
            if (filter === 'exterior') return cat === 'exterior';
            if (filter === 'cripto') return cat === 'cripto' || cat === 'crypto';
            return false;
        });

        // Calculate Totals
        const totalInvested = filteredAssets.reduce((sum, a) => {
            const inv = parseFloat(a.investedValue) || 0;
            const cur = a.currency || 'BRL';
            return sum + (cur === 'USD' ? inv * dollarQuote : inv);
        }, 0);

        const totalBalance = filteredAssets.reduce((sum, a) => {
            const bal = parseFloat(a.currentBalance) || 0;
            const cur = a.currency || 'BRL';
            return sum + (cur === 'USD' ? bal * dollarQuote : bal);
        }, 0);

        const profit = totalBalance - totalInvested;
        const profitPerc = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        // Helper for robust parsing
        const parseMoney = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            // Remove 'R$', ' ', etc. Convert ',' to '.' if needed
            let clean = val.toString().replace(/[^\d,.-]/g, '');
            // If comma exists and dot doesn't, or comma is after dot, treat as decimal separator
            // Heuristic: if string has comma, replace with dot
            if (clean.includes(',')) clean = clean.replace(',', '.');
            return parseFloat(clean) || 0;
        };

        const totalProventos12m = filteredProventos.reduce((sum, p) => sum + parseMoney(p.value), 0);
        const avgProventos12m = totalProventos12m / 12;

        // Update DOM
        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        const formatPercent = (val) => `${val.toFixed(2)}%`;

        // Total
        const elTotal = document.getElementById('card-total-rv');
        if (elTotal) elTotal.textContent = formatCurrency(totalBalance);

        // Profit
        const elProfit = document.getElementById('card-profit-rv');
        const elProfitPerc = document.getElementById('card-profit-perc-rv');
        const elProfitIcon = document.getElementById('card-profit-icon');

        if (elProfit) {
            elProfit.textContent = (profit >= 0 ? '+' : '') + formatCurrency(profit);
            elProfit.className = `card-value ${profit >= 0 ? 'text-success' : 'text-danger'}`;
        }
        if (elProfitPerc) {
            elProfitPerc.textContent = (profit >= 0 ? '+' : '') + formatPercent(profitPerc);
            elProfitPerc.style.color = profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        }
        if (elProfitIcon) {
            elProfitIcon.style.color = profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        }

        // Proventos
        const elProventos = document.getElementById('card-proventos-rv');
        if (elProventos) elProventos.textContent = formatCurrency(avgProventos12m);
    };

    // Render Chart
    renderAllocationChart(allocation); // Chart uses global allocation, maybe update it too?
    // Requirement says "valores dos cards se adaptarem". Chart usually shows allocation of Everything.
    // If I filter, should the chart filter? "Esses filtros também alteram os dois gráficos".
    // Wait, the user said "valores dos cards", but point 5 in implementation plan (from memory/previous context) 
    // mentioned "filters affect charts". 
    // Let's assume for now filters affect List + Cards. Chart usually shows composition of *current view*?
    // Or composition of *everything*? 
    // Usually "Allocation" shows how my portfolio is divided. If I filter only "Cripto", allocation chart of "Cripto" is 100% Cripto. That's useless.
    // Maybe the user wants the chart to stay global? 
    // Or maybe the chart should show breakdown of filtered items (e.g. BTC vs ETH)?
    // The current chart is "Allocation by Class" (Acoes vs FIIs). If I filter Acoes, it's 100% Acoes.
    // So the chart probably shouldn't change, OR it's a "Composition" chart.
    // Let's stick to Cards + Table for now as requested in the specific prompt "valores dos cards".

    // Initial Table Render
    renderAssetTable(assets, currentFilter);
    updateDashboardCards(currentFilter);

    // Filter Events
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // UI
            container.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-ghost');
            });
            target.classList.remove('btn-ghost');
            target.classList.add('btn-primary');

            // Logic
            const filter = target.dataset.filter;
            currentFilter = filter;
            renderAssetTable(store.getState().variableIncome.assets || [], filter);
            updateDashboardCards(filter);
        });
    });

    // Proventos Event
    const btnProventos = document.getElementById('btn-proventos');
    if (btnProventos) {
        btnProventos.addEventListener('click', () => {
            currentView = 'proventos';
            renderVariableIncome(containerId);
        });
    }

    // History Event
    const btnHistory = document.getElementById('btn-history-var');
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            import('./components/ClosedAssets.js').then(module => module.openClosedAssets());
        });
    }

    // Events Button
    const btnEvents = container.querySelector('#btn-events');
    if (btnEvents) {
        btnEvents.addEventListener('click', () => {
            openSpecialEventsModal();
        });
    }

    // Update Prices Integration
    const btnUpdatePrices = container.querySelector('#btn-update-prices');
    if (btnUpdatePrices) {
        btnUpdatePrices.addEventListener('click', async () => {
            if (!updateModal) updateModal = new Modal();

            const originalContent = btnUpdatePrices.innerHTML;
            try {
                btnUpdatePrices.innerHTML = '<span class="icon-spin">↻</span> Atualizando...';
                btnUpdatePrices.disabled = true;

                const result = await store.updatePricesFromSheet();
                const { updatedCount, dollarQuote, dollarUpdated } = result;

                const dollarLine = dollarUpdated
                    ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">Dólar: <strong>R$ ${dollarQuote.toFixed(2)}</strong></p>`
                    : '';

                setTimeout(() => {
                    updateModal.open('Cotações',
                        `<div style="text-align: center;">
                            <div style="width: 48px; height: 48px; margin: 0 auto 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success-color);">${icons.check}</div>
                            <h3 style="margin-bottom: 0.5rem; color: var(--success-color);">Atualização Concluída!</h3>
                            <p style="color: var(--text-secondary);"><strong>${updatedCount}</strong> ativos foram atualizados.</p>
                            ${dollarLine}
                        </div>`
                    );
                    btnUpdatePrices.innerHTML = originalContent;
                    btnUpdatePrices.disabled = false;
                }, 500);

            } catch (error) {
                console.error(error);

                updateModal.open('Erro',
                    `<div style="text-align: center;">
                         <div style="width: 48px; height: 48px; margin: 0 auto 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--danger-color);">${icons.alertCircle}</div>
                         <h3 style="margin-bottom: 0.5rem; color: var(--danger-color);">Falha na Atualização</h3>
                         <p style="color: var(--text-secondary);">${error.message}</p>
                    </div>`
                );
                btnUpdatePrices.innerHTML = originalContent;
                btnUpdatePrices.disabled = false;
            }
        });
    }
}


function renderAllocationChart(data) {
    const container = document.getElementById('rvAllocationChart');
    if (!container) return;

    if (allocationChart) {
        allocationChart.destroy();
        allocationChart = null;
    }

    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) {
        container.innerHTML = '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">Sem dados para gráfico</div>';
        return;
    }

    const pctAcao = (data.acao / total) * 100;
    const pctFii = (data.fii / total) * 100;
    const pctExt = (data.exterior / total) * 100;
    const pctCripto = (data.cripto / total) * 100;

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 8px; font-size: 0.8rem; font-weight: 600;">
             ${pctAcao > 0 ? `<span style="color: #3b82f6">AÇÕES: ${formatMoney(data.acao)} (${pctAcao.toFixed(1)}%)</span>` : ''}
             ${pctFii > 0 ? `<span style="color: #f59e0b">FIIS: ${formatMoney(data.fii)} (${pctFii.toFixed(1)}%)</span>` : ''}
             ${pctExt > 0 ? `<span style="color: #10b981">EXTERIOR: ${formatMoney(data.exterior)} (${pctExt.toFixed(1)}%)</span>` : ''}
             ${pctCripto > 0 ? `<span style="color: #8b5cf6">CRIPTO: ${formatMoney(data.cripto)} (${pctCripto.toFixed(1)}%)</span>` : ''}
        </div>
        <div style="display: flex; height: 24px; border-radius: 12px; overflow: hidden; width: 100%; background: #f3f4f6;">
            ${pctAcao > 0 ? `<div style="width: ${pctAcao}%; background: #3b82f6;" title="Ações"></div>` : ''}
            ${pctFii > 0 ? `<div style="width: ${pctFii}%; background: #f59e0b;" title="FIIs"></div>` : ''}
            ${pctExt > 0 ? `<div style="width: ${pctExt}%; background: #10b981;" title="Exterior"></div>` : ''}
            ${pctCripto > 0 ? `<div style="width: ${pctCripto}%; background: #8b5cf6;" title="Cripto"></div>` : ''}
        </div>
    `;
}

function renderAssetTable(assets, filter) {
    const container = document.getElementById('assets-list-container');
    if (!container) return;

    let filtered = assets;
    if (filter !== 'all') {
        filtered = assets.filter(a => {
            const t = a.type.toLowerCase();
            if (filter === 'acao') return t.includes('ação') || t.includes('acao');
            if (filter === 'fii') return t.includes('fii');
            if (filter === 'exterior') return t.includes('exterior');
            if (filter === 'cripto') return t.includes('cripto');
            return false;
        });
    }

    // Sort by Ticker (A-Z)
    filtered.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));

    // Calculate Totals per Category for Recommendation Logic
    // We need the total balance of the *current filter category* (or all valid categories?) 
    // to calculate the target share.
    // Usually Meta % is relative to the *whole portfolio* or *category*.
    // User said: "As ações devem dar no máximo 100%". 
    // This implies Meta is strictly within the Category.
    // So if I'm looking at "Acao A", its Meta is % of "Total Acoes".

    // Let's compute totals for each category first (Action, FII, Exterior, Cripto).
    const totals = { acao: 0, fii: 0, exterior: 0, cripto: 0, outros: 0 };
    const metaTotals = { acao: 0, fii: 0, exterior: 0, cripto: 0, outros: 0 };
    const dollarQuote = store.getState().dollarQuote || 0; // 0 = não configurado

    // We need to loop over ALL assets, not just filtered ones, to get correct totals for recommendation
    (store.getState().variableIncome.assets || []).forEach(a => {
        const bal = parseFloat(a.currentBalance) || 0;
        const cur = a.currency || 'BRL';
        const balBRL = cur === 'USD' ? bal * dollarQuote : bal; // Convert USD to BRL
        const meta = parseFloat(a.meta) || 0;
        const t = a.type.toLowerCase();

        if (t.includes('ação') || t.includes('acao')) { totals.acao += balBRL; metaTotals.acao += meta; }
        else if (t.includes('fii')) { totals.fii += balBRL; metaTotals.fii += meta; }
        else if (t.includes('exterior')) { totals.exterior += balBRL; metaTotals.exterior += meta; }
        else if (t.includes('cripto')) { totals.cripto += balBRL; metaTotals.cripto += meta; }
        else { totals.outros += balBRL; metaTotals.outros += meta; }
    });

    // Check for Meta Violations
    let metaWarning = '';
    const categories = [
        { key: 'acao', label: 'Ações' },
        { key: 'fii', label: 'FIIs' },
        { key: 'exterior', label: 'Exterior' },
        { key: 'cripto', label: 'Cripto' }
    ];

    const violations = categories.filter(c => metaTotals[c.key] > 100);
    if (violations.length > 0) {
        metaWarning = `
            <div style="margin: 0 0 1.5rem 0; padding: 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger-color); border-radius: 8px; display: flex; align-items: center; gap: 0.75rem; color: var(--danger-color);">
                ${icons.alertCircle || '!'}
                <div>
                    <strong>Atenção:</strong> A soma das metas ultrapassa 100% em: ${violations.map(v => `${v.label} (${metaTotals[v.key].toFixed(1)}%)`).join(', ')}.
                </div>
            </div>
        `;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            ${metaWarning}
            <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                ${icons.clipboard}
                <p style="margin-top: 1rem;">Nenhum ativo encontrado nesta categoria.</p>
                <button id="btn-add-empty" class="btn btn-primary" style="margin-top: 1rem;">
                    ${icons.plus} Novo Aporte
                </button>
            </div>
        `;
        const btn = document.getElementById('btn-add-empty');
        if (btn) btn.addEventListener('click', () => openContributionModal({ page: 'variable' }));
        return;
    }

    const html = `
        ${metaWarning}
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 1rem;">ATIVO</th>
                        <th style="padding: 1rem; width: 100px;">META %</th>
                        <th style="padding: 1rem;">QTD</th>
                        <th style="padding: 1rem;">PM / ATUAL</th>
                        <th style="padding: 1rem;">SALDO</th>
                        <th style="padding: 1rem;">REND.</th>
                        <th style="padding: 1rem;">RECOMENDAÇÃO</th>
                        <th style="padding: 1rem;">AÇÕES</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(asset => {
        const bal = parseFloat(asset.currentBalance) || 0;
        const inv = parseFloat(asset.investedValue) || 1;

        const qty = parseFloat(asset.qty) || 0;
        const currPrice = qty > 0 ? bal / qty : 0;

        const cur = asset.currency || 'BRL';
        const dollarQuote = store.getState().dollarQuote || 0; // 0 = não configurado
        const isUSD = cur === 'USD';

        // Calculate BRL values for USD assets
        const balBRL = isUSD ? bal * dollarQuote : bal;
        const invBRL = isUSD ? inv * dollarQuote : inv;
        const profit = balBRL - invBRL;
        const profitPerc = invBRL > 0 ? (profit / invBRL) * 100 : 0;

        // Formatters
        const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const fmtUSD = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
        const fmt = (v) => isUSD ? fmtUSD(v) : fmtBRL(v);

        // Meta Logic
        const meta = parseFloat(asset.meta || 0);

        // Get Category Total (use BRL-converted values)
        let catTotal = 0;
        const t = asset.type.toLowerCase();
        if (t.includes('ação') || t.includes('acao')) catTotal = totals.acao;
        else if (t.includes('fii')) catTotal = totals.fii;
        else if (t.includes('exterior')) catTotal = totals.exterior;
        else if (t.includes('cripto')) catTotal = totals.cripto;

        // Target Value
        const targetVal = catTotal * (meta / 100);
        const diff = targetVal - balBRL;

        let recHtml = '<span style="color: var(--text-secondary); background: var(--bg-color); padding: 4px 8px; border-radius: 4px;">Aguardar</span>';
        if (diff > 1) { // Threshold
            recHtml = `
                                <div style="display: flex; flex-direction: column;">
                                    <span class="rec-badge-buy">Comprar</span>
                                    <span class="rec-value">R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                             `;
        }

        let icon = icons.activity;
        const typeLower = asset.type.toLowerCase();
        if (typeLower.includes('ação') || typeLower.includes('acao')) icon = icons.stock;
        else if (typeLower.includes('fii')) icon = icons.office;
        else if (typeLower.includes('exterior')) icon = icons.globe;
        else if (typeLower.includes('cripto')) icon = icons.crypto;

        // Build display strings for USD assets
        const saldoHtml = isUSD
            ? `<div style="font-weight: 700;">${fmtBRL(balBRL)}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">${fmtUSD(bal)}</div>`
            : `<span style="font-weight: 700;">${fmtBRL(bal)}</span>`;

        const rendHtml = isUSD
            ? `<div style="font-weight: 600; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${profit >= 0 ? '+' : ''}${fmtBRL(profit)}</div>
               <div style="font-size: 0.75rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${profitPerc.toFixed(2)}% <span style="color: var(--text-secondary);">(${profit >= 0 ? '+' : ''}${fmtUSD(bal - inv)})</span></div>`
            : `<div style="font-weight: 600; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${profit >= 0 ? '+' : ''}${fmtBRL(profit)}</div>`;

        return `
                        <tr data-id="${asset.id}" style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="background: var(--bg-hover); padding: 0.5rem; text-align: center; border-radius: 8px; color: var(--primary-color);">
                                        ${icon}
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.95rem;">${asset.ticker}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">${asset.type}</div>
                                    </div>
                                </div>
                            </td>
                            <td style="padding: 1rem;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <input type="number" class="inp-meta" data-id="${asset.id}" value="${meta}" 
                                        style="width: 50px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; text-align: center; font-weight: 600;" 
                                        min="0" max="100">
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">%</span>
                                </div>
                            </td>
                            <td style="padding: 1rem; font-weight: 500;">${qty.toLocaleString('pt-BR')}</td>
                            <td style="padding: 1rem;">
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">PM: ${fmt(parseFloat(asset.averagePrice) || 0)}</div>
                                <div style="font-weight: 600;">${fmt(currPrice)}</div>
                            </td>
                            <td style="padding: 1rem;">${saldoHtml}</td>
                            <td style="padding: 1rem;">
                                ${rendHtml}
                                ${!isUSD ? `<div style="font-size: 0.75rem; color: ${profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                    ${profitPerc.toFixed(2)}%
                                </div>` : ''}
                            </td>
                            <td style="padding: 1rem;">
                                ${recHtml}
                            </td>
                            <td style="padding: 1rem;">
                                <button class="btn btn-sm btn-quick-add btn-action-soft" data-id="${asset.id}" data-ticker="${asset.ticker}" data-type="${asset.type}">
                                    + Aportar
                                </button>
                            </td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;

    // Events - Helper listener
    // Note: btn-add-table removed



    // Quick Add
    container.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            const ticker = target.dataset.ticker;
            const type = target.dataset.type;
            const id = target.dataset.id;

            // Open modal with prefill data
            openContributionModal({
                page: 'variable',
                ticker: ticker,
                type: type,
                assetId: id // Pass ID to prevent duplicates
            });
        });
    });

    // Meta Change Listener (Auto-save)
    container.querySelectorAll('.inp-meta').forEach(inp => {
        inp.addEventListener('change', (e) => {
            const assetId = e.target.dataset.id;
            const newMeta = parseFloat(e.target.value) || 0;

            // Save to store
            store.updateVariableAsset(assetId, { meta: newMeta });

            // Re-render to update recommendation? 
            // Or just recalculate this row? Re-render is safer.
            // But if we re-render, we lose focus.
            // Let's just update store, and let the store listener trigger re-render if it wants, 
            // but store listener re-renders WHOLE VARIABLE INCOME.
            // That might be jarring.
            // For now, assume render is fast enough.
        });
        // Prevent row click propagation
        inp.addEventListener('click', (e) => e.stopPropagation());
    });

    // Row Click Listener for Details
    container.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
            // Check if clicked element is button or input
            if (e.target.closest('button') || e.target.closest('input')) return;

            const assetTicker = tr.querySelector('td div div').textContent; // heuristic to find ticker?
            // Better: add data-id to the TR
            const id = tr.getAttribute('data-id');
            if (id) {
                showVariableAssetDetails(id);
            }
        });
    });
}
