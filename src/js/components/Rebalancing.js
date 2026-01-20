import { store } from '../store.js';
import { icons } from '../icons.js';


let expandedCategories = new Set(); // Stores IDs of EXPANDED categories. Default collapsed.

// Local helper if not imported
const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function renderRebalancing(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render skeleton or initial structure
    container.innerHTML = `
        <div class="rebalancing-container fade-in">
            
            <!-- Cash Input Section -->
            <div class="card" style="margin-bottom: 2rem; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="font-size: 0.9rem; margin-bottom: 0.5rem; display: block; color: var(--text-secondary); font-weight: 600;">CAIXA DISPONÍVEL PARA APORTE</label>
                        <div class="input-group" style="position: relative; display: flex; align-items: center;">
                             <span style="position: absolute; left: 1rem; font-size: 1.5rem; font-weight: 700; color: var(--text-secondary); pointer-events: none;">R$</span>
                             <input type="text" id="inp-cash" class="form-input" style="font-size: 1.5rem; font-weight: 700; padding-left: 3.5rem;" placeholder="0,00">
                        </div>
                    </div>
                    <div style="text-align: right;">
                         <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">Patrimônio Atual (Total)</div>
                         <div id="total-equity-display" style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">R$ 0,00</div>
                    </div>
                </div>
            </div>

            <!-- Validation/Warnings Area -->
            <div id="rebalancing-warnings"></div>

            <!-- Categories Container -->
            <div id="rebalancing-categories" style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Filled via JS -->
            </div>
        </div>
    `;

    // Initialize logic
    bindEvents(container);
    updateRebalancingUI();

    // Subscribe to store
    store.subscribe(() => {
        if (document.getElementById(containerId)) {
            updateRebalancingUI();
        }
    });
}

function bindEvents(container) {
    const inpCash = container.querySelector('#inp-cash');
    if (inpCash) {
        // Init value
        const currentCash = store.getState().cash || 0;
        inpCash.value = currentCash > 0 ? formatMoney(currentCash).replace('R$', '').trim() : '';

        // Input Mask & Update
        inpCash.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (!value) {
                store.updateCash(0);
                e.target.value = '';
                return;
            }
            const floatVal = parseFloat(value) / 100;
            store.updateCash(floatVal);

            // Format Display
            e.target.value = floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        });
    }
}

function updateRebalancingUI() {
    const state = store.getState();
    const cash = state.cash || 0;
    const settings = state.reserveSettings || { includeSelic: false };
    const targets = state.rebalancingTargets || {};
    const dollarQuote = state.dollarQuote || 1; // Default to 1 if not set

    // 1. Categorize Assets
    // Pass explicit source lists to avoid ambiguity
    const categorization = categorizeAssets(
        state.fixedIncome.assets,
        state.variableIncome.assets,
        settings,
        dollarQuote
    );

    // 2. Calculate Totals
    const totalEquity = calculateTotalEquity(categorization, cash);

    // 3. Update Header
    const totalDisplay = document.getElementById('total-equity-display');
    if (totalDisplay) totalDisplay.textContent = formatMoney(totalEquity);

    // 4. Render Categories
    renderCategories(categorization, totalEquity, targets);

    // 5. Validation
    validateTargets(targets, categorization);
}

function calculateTotalEquity(cat, cash) {
    let sum = cash;
    Object.values(cat).forEach(c => {
        sum += c.currentValue;
    });
    return sum;
}

function categorizeAssets(fixedAssets, variableAssets, settings, dollarQuote) {
    // Structure
    const cats = {
        reserve: {
            id: 'reserve', label: 'Reserva de Emergência', icon: icons.shield, color: '#10b981', currentValue: 0, sub: {
                'reserva_manual': { id: 'reserva_manual', label: 'Reserva', currentValue: 0 },
                'tesouro_selic': { id: 'tesouro_selic', label: 'Tesouro Selic', currentValue: 0, visible: settings.includeSelic }
            }
        },
        fixed: {
            id: 'fixed', label: 'Renda Fixa', icon: icons.building, color: '#3b82f6', currentValue: 0, sub: {
                'rf_cdi': { id: 'rf_cdi', label: 'Renda Fixa CDI', currentValue: 0 },
                'rf_ipca': { id: 'rf_ipca', label: 'Renda Fixa IPCA', currentValue: 0 },
                'tesouro_ipca': { id: 'tesouro_ipca', label: 'Tesouro IPCA', currentValue: 0 },
                'tesouro_selic': { id: 'tesouro_selic', label: 'Tesouro Selic', currentValue: 0, visible: !settings.includeSelic }
            }
        },
        variable: {
            id: 'variable', label: 'Renda Variável', icon: icons.trendUp, color: '#8b5cf6', currentValue: 0, sub: {
                'acao': { id: 'acao', label: 'Ações', currentValue: 0 },
                'fii': { id: 'fii', label: 'FIIs', currentValue: 0 },
                'exterior': { id: 'exterior', label: 'Exterior', currentValue: 0 },
                'cripto': { id: 'cripto', label: 'Cripto', currentValue: 0 }
            }
        },
        retirement: {
            id: 'retirement', label: 'Aposentadoria', icon: icons.sun, color: '#f59e0b', currentValue: 0, sub: {
                'tesouro_renda': { id: 'tesouro_renda', label: 'Tesouro Renda+', currentValue: 0 }
            }
        }
    };

    // Helper to process asset
    const processAsset = (a, source) => {
        let val = parseFloat(a.currentBalance) || 0;
        // Currency Conversion
        if (a.currency === 'USD') {
            val = val * dollarQuote;
        }

        const type = (a.type || '').toLowerCase();
        const index = (a.indexer || a.index || '').toLowerCase();

        // 1. Retirement (Specific Type, usually Fixed but checked globally)
        if (type.includes('renda+')) {
            cats.retirement.sub.tesouro_renda.currentValue += val;
            cats.retirement.currentValue += val;
        }
        // 2. Reserve (Explicit Flag or Selic if setting enabled)
        else if (a.isReserve || (settings.includeSelic && type.includes('selic'))) {
            if (type.includes('selic')) {
                cats.reserve.sub.tesouro_selic.currentValue += val;
            } else {
                cats.reserve.sub.reserva_manual.currentValue += val;
            }
            cats.reserve.currentValue += val;
        }
        else {
            // 3. Fallback based on SOURCE
            if (source === 'variable') {
                // It IS Variable Income
                // Sub-classify by type
                if (type.includes('ação') || type.includes('acao') || type.includes('etf') || type.includes('unit')) cats.variable.sub.acao.currentValue += val;
                else if (type.includes('fii')) cats.variable.sub.fii.currentValue += val;
                else if (type.includes('exterior') || type.includes('stock') || type.includes('reit') || type.includes('bdr')) cats.variable.sub.exterior.currentValue += val;
                else if (type.includes('cripto') || type.includes('btc') || type.includes('eth')) cats.variable.sub.cripto.currentValue += val;
                else cats.variable.sub.acao.currentValue += val; // Default to Action if unknown variable type

                cats.variable.currentValue += val;
            } else {
                // It IS Fixed Income (and not Reserve/Retirement above)
                if (type.includes('selic')) {
                    // Selic but NOT in reserve settings -> Fixed Selic bucket
                    cats.fixed.sub.tesouro_selic.currentValue += val;
                } else if (type.includes('tesouro') && (type.includes('ipca') || index.includes('ipca'))) {
                    cats.fixed.sub.tesouro_ipca.currentValue += val;
                } else if (type.includes('ipca') || index.includes('ipca')) {
                    cats.fixed.sub.rf_ipca.currentValue += val;
                } else {
                    cats.fixed.sub.rf_cdi.currentValue += val;
                }
                cats.fixed.currentValue += val;
            }
        }
    };

    // Process Fixed List
    fixedAssets.forEach(a => processAsset(a, 'fixed'));

    // Process Variable List
    variableAssets.forEach(a => processAsset(a, 'variable'));

    return cats;
}

function renderCategories(cats, totalEquity, targets) {
    const container = document.getElementById('rebalancing-categories');
    if (!container) return;

    const html = Object.values(cats).map(cat => {
        // Main Category Target
        const targetPct = targets[cat.id] || 0;
        const currentPct = totalEquity > 0 ? (cat.currentValue / totalEquity) * 100 : 0;

        const targetVal = totalEquity * (targetPct / 100);
        const diff = targetVal - cat.currentValue;

        let statusHtml = '';
        if (diff > 0) {
            statusHtml = `<span style="color: var(--primary-color); font-weight: 600; font-size: 0.9rem;">Aporte Sugerido<br>R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
        } else {
            if (targetPct === 0) statusHtml = `<span style="color: var(--text-secondary);">Sem Meta</span>`;
            else statusHtml = `<span style="color: var(--success-color); font-weight: 600;">${icons.check || '✓'} Atingido</span>`;
        }

        // Progress Bar
        const progressWidth = Math.min(100, (currentPct / targetPct) * 100) || 0;

        // Subcategories
        const subsHtml = Object.values(cat.sub).filter(s => s.visible !== false).map(sub => {
            const subTargetPct = targets[`${cat.id}_${sub.id}`] || 0;
            const subCurrentPct = totalEquity > 0 ? (sub.currentValue / totalEquity) * 100 : 0;
            const subTargetVal = totalEquity * (subTargetPct / 100);
            const subDiff = subTargetVal - sub.currentValue;

            let subStatus = '';
            if (subDiff > 0.01) subStatus = `+${formatMoney(subDiff)}`;
            else subStatus = '-';

            return `
                <div style="display: flex; align-items: center; padding: 0.75rem 0; border-top: 1px solid var(--border-color); font-size: 0.9rem;">
                    <div style="flex: 2; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${cat.color}; display: inline-block;"></span>
                        ${sub.label}
                    </div>
                    <div style="flex: 1; text-align: right; color: var(--text-secondary);">${formatMoney(sub.currentValue)}</div>
                    <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 4px;">
                         <input type="number" class="target-input sub-target" data-id="${cat.id}_${sub.id}" value="${subTargetPct}" placeholder="0" min="0" max="100" style="width: 50px; text-align: center; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px;">
                         <span style="font-size: 0.8rem;">%</span>
                    </div>
                    <div style="flex: 1; text-align: right; font-weight: 600; color: ${subDiff > 0 ? 'var(--primary-color)' : 'var(--text-secondary)'};">
                        ${subStatus}
                    </div>
                    <!-- Spacer for alignment with header chevron -->
                    <div style="width: 50px;"></div>
                </div>
            `;
        }).join('');

        // Expand/Collapse State
        const isExpanded = expandedCategories.has(cat.id);
        const chevron = isExpanded ? (icons.chevronUp || '^') : (icons.chevronDown || 'v');
        const collapsedClass = isExpanded ? '' : 'collapsed';

        return `
            <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 0.5rem;" data-cat-id="${cat.id}">
            <div class="rebal-card-header toggle-header" data-cat-id="${cat.id}">
                    
                    <!-- Info Section: Icon & Title -->
                    <div class="rebal-info">
                        <div style="color: ${cat.color}; background: ${cat.color}20; padding: 6px; border-radius: 6px; display: flex;">${cat.icon}</div>
                        <div style="min-width: 0;">
                            <span class="card-title" style="font-size: 1.1rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.label}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Atual: <strong>${currentPct.toFixed(1)}%</strong></span>
                        </div>
                    </div>
                    
                    <!-- Stats Section (Meta + Status) -->
                    <div class="rebal-stats">
                        <!-- Meta Input -->
                        <div class="rebal-meta">
                            <div class="input-label-mobile" style="text-transform: uppercase; font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 2px;">Meta</div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <input type="number" class="target-input main-target" data-id="${cat.id}" value="${targetPct}" placeholder="0" min="0" max="100" style="font-size: 1.2rem; width: 60px; text-align: right; border: none; border-bottom: 2px solid var(--border-color); background: transparent; font-weight: 700; color: var(--text-primary);">
                                <span style="font-weight: 700; font-size: 1rem;">%</span>
                            </div>
                        </div>

                        <!-- Status/Suggestion -->
                        <div class="rebal-status">
                            <div style="font-size: 1rem;">${statusHtml}</div>
                        </div>
                    </div>

                    <!-- Chevron -->
                    <div style="color: var(--text-secondary); display: flex;">
                        ${chevron}
                    </div>
                </div>
                
                <!-- Collapsible Content -->
                <div class="card-body ${collapsedClass}" style="background: var(--bg-hover); padding: 0 1.5rem; transition: max-height 0.3s ease;">
                    <br>
                    ${subsHtml}
                    <br>
                </div>
                
                <!-- Progress Line -->
                <div style="height: 4px; background: #e5e7eb; width: 100%;">
                    <div style="height: 100%; background: ${cat.color}; width: ${progressWidth}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Attach Toggle Listeners
    container.querySelectorAll('.toggle-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Check if click was on Input, if so, ignore
            if (e.target.tagName === 'INPUT') return;

            const card = header.closest('.card');
            const catId = card.dataset.catId;

            if (expandedCategories.has(catId)) {
                expandedCategories.delete(catId);
            } else {
                expandedCategories.add(catId);
            }
            // Trigger Re-render to update icon and class
            renderCategories(cats, totalEquity, targets);
        });
    });

    // Attach Input Listeners
    container.querySelectorAll('.target-input').forEach(inp => {
        inp.addEventListener('click', (e) => e.stopPropagation()); // Prevent header toggle

        // Auto-select content on focus for easier editing
        inp.addEventListener('focus', (e) => {
            e.target.select();
        });

        inp.addEventListener('change', (e) => {
            const key = e.target.dataset.id;
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 100) val = 100;
            e.target.value = val;

            // Update Store
            const newTargets = { ...store.getState().rebalancingTargets, [key]: val };
            store.updateRebalancingTargets(newTargets);
        });
    });
}

function validateTargets(targets, cats) {
    const warningDiv = document.getElementById('rebalancing-warnings');
    if (!warningDiv) return;

    const messages = [];

    // 1. Check Total > 100%
    let total = 0;
    Object.keys(cats).forEach(k => {
        total += (targets[k] || 0);
    });

    if (total > 100) {
        messages.push(`A soma das metas das categorias principal ultrapassa 100% (Atual: ${total}%).`);
    } else if (total < 100 && total > 0) {
        messages.push(`A soma das metas é menor que 100% com (Atual: ${total}%).`);
    }

    // 2. Check Subcategories > Category
    Object.values(cats).forEach(cat => {
        const catTarget = targets[cat.id] || 0;
        let subTotal = 0;
        Object.keys(cat.sub).forEach(subKey => {
            if (cat.sub[subKey].visible !== false) {
                subTotal += (targets[`${cat.id}_${subKey}`] || 0);
            }
        });

        if (subTotal > catTarget) {
            messages.push(`Em "${cat.label}", a soma das subcategorias (${subTotal}%) ultrapassa a meta da categoria (${catTarget}%).`);
        }
    });

    if (messages.length > 0) {
        warningDiv.innerHTML = messages.map(m => `
            <div style="padding: 1rem; margin-bottom: 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger-color); border-radius: 8px; color: var(--danger-color); display: flex; gap: 0.5rem; align-items: center;">
                ${icons.alertCircle} <span>${m}</span>
            </div>
        `).join('');
    } else {
        warningDiv.innerHTML = '';
    }
}
