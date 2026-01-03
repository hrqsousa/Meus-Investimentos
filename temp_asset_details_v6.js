// --- ASSET DETAILS LOGIC FINAL (V6 - ATOMIC SAVE) ---
console.log(">>> LOADING ASSET DETAILS V6 (ATOMIC SAVE)");

window.currentDetailTicker = null;
window.adCurrentPage = 1;
window.adItemsPerPage = 5;
window.adFullHistory = [];

// --- BASIC LOADER ---
// Just loads data into memory. No fancy self-healing aggressiveness.
window.initializeAppData = () => {
    // 1. Load History
    const historyDisk = localStorage.getItem('local_history');
    if (historyDisk) {
        try {
            window.liquidationHistory = JSON.parse(historyDisk);
        } catch (e) {
            console.error("History Load Error:", e);
            window.liquidationHistory = [];
        }
    } else {
        window.liquidationHistory = window.liquidationHistory || [];
    }

    // 2. Load Assets
    const assetsDisk = localStorage.getItem('local_assets');
    if (assetsDisk) {
        try {
            window.mockRendaVariavelAssets = JSON.parse(assetsDisk).filter(a => a.category === 'renda-variavel' || a.ticker);
        } catch (e) {
            window.mockRendaVariavelAssets = window.mockRendaVariavelAssets || [];
        }
    }
};

// --- ATOMIC SAVE (The Fix for Persistence) ---
// Directly reads the LATEST disk state, appends the new item, and writes back.
// This prevents race conditions where we might save stale memory state.
window.saveLiquidationAtomically = (newItem) => {
    try {
        // 1. Read directly from DISK (Source of Truth)
        const raw = localStorage.getItem('local_history');
        let currentHistory = raw ? JSON.parse(raw) : [];

        // 2. Append
        currentHistory.push(newItem);

        // 3. Write Back immediately
        localStorage.setItem('local_history', JSON.stringify(currentHistory));

        // 4. Update Memory to match
        window.liquidationHistory = currentHistory;

        console.log(">>> ATOMIC SAVE SUCCESS: History item saved.");
    } catch (e) {
        console.error(">>> ATOMIC SAVE FAILED:", e);
        alert("Erro grave ao salvar liquidação. Tente novamente.");
    }
};

// --- DATA HEALER (Passive) ---
window.healData = () => {
    if (!window.liquidationHistory) return;
    let healed = false;
    window.liquidationHistory.forEach(h => {
        if (typeof h.totalVal !== 'number' || isNaN(h.totalVal)) { h.totalVal = 0; healed = true; }
    });
    if (healed) localStorage.setItem('local_history', JSON.stringify(window.liquidationHistory));
};

window.openAssetDetails = (ticker) => {
    window.initializeAppData();
    window.healData();
    window.currentDetailTicker = ticker;
    window.adCurrentPage = 1;

    const modal = document.getElementById('asset-details-modal');
    const content = document.getElementById('asset-details-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);

    if (window.renderAssetDetails) window.renderAssetDetails(ticker);
};

window.deleteHistoryItem = async (id) => {
    if (!confirm("Desfazer liquidação? A quantidade liquidada será restaurada.")) return;

    // RE-READ FROM DISK to be sure
    window.initializeAppData();

    const historyIndex = window.liquidationHistory.findIndex(h => h.id === id);
    if (historyIndex === -1) return alert("Erro: Registro histórico não encontrado.");
    const historyItem = window.liquidationHistory[historyIndex];

    // Undo Liquidate: Add qty back to asset
    // We need to save this to local_assets too.
    const asset = window.mockRendaVariavelAssets.find(a => a.ticker === historyItem.ticker);
    if (asset) {
        asset.quantity = (Number(asset.quantity) || 0) + (Number(historyItem.quantity) || 0);

        // Save Assets
        const allAssets = JSON.parse(localStorage.getItem('local_assets') || '[]');
        const updatedAll = allAssets.map(a => a.id === asset.id ? asset : a);
        // If not found in global (rare), add it? No, just update existing.
        localStorage.setItem('local_assets', JSON.stringify(updatedAll));
    }

    // Remove from History
    window.liquidationHistory.splice(historyIndex, 1);
    // Write History
    localStorage.setItem('local_history', JSON.stringify(window.liquidationHistory));

    if (window.renderAssetDetails && window.currentDetailTicker) window.renderAssetDetails(window.currentDetailTicker);
    if (window.refreshUI) window.refreshUI();
    showSuccessMessage("Liquidação desfeita.");
};

window.renderRVHistory = (ticker) => {
    const tbody = document.getElementById('rv-detail-history-body');
    if (tbody) tbody.innerHTML = '';
    renderAssetDetails(ticker);
};

window.closeAssetDetails = () => {
    const modal = document.getElementById('asset-details-modal');
    const content = document.getElementById('asset-details-content');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        window.currentDetailTicker = null;
    }, 300);
};

window.renderAssetDetails = (ticker) => {
    // ALWAYS RELOAD FRESH DATA ON RENDER
    window.initializeAppData();

    const activeAssets = window.mockRendaVariavelAssets.filter(a => a.ticker === ticker);
    const historyAssets = window.liquidationHistory.filter(h => h.ticker === ticker);

    if (activeAssets.length === 0 && historyAssets.length === 0) return;

    let sample = activeAssets.length > 0 ? activeAssets[0] : historyAssets[0];

    // --- AGGREGATION ---
    let totalQty = 0;
    let totalInvested = 0;
    let totalCurrent = 0;

    activeAssets.forEach(a => {
        totalQty += (Number(a.quantity) || 0);
        const safeAvg = (Number(a.avgPrice) || 0);
        totalInvested += (safeAvg * a.quantity);
        totalCurrent += ((Number(a.currentPrice) || 0) * a.quantity);
    });

    let historicalInvested = 0;
    let totalLiquidatedValue = 0;
    historyAssets.forEach(h => {
        if (h.status === 'sold') {
            const hQty = Number(h.quantity) || 0;
            const hAvg = Number(h.avgPrice) || 0;
            const hTotal = Number(h.totalVal) || textToFloat(h.totalVal) || 0;
            historicalInvested += (hQty * hAvg);
            totalLiquidatedValue += hTotal;
        }
    });

    let displayInvested = totalInvested;
    if (totalQty === 0 && historyAssets.length > 0) {
        displayInvested = historicalInvested;
    }

    const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
    const currentPrice = sample.currentPrice || sample.unitPrice || 0;
    const currency = sample.currency || 'BRL';
    const type = sample.type || sample.category;

    const isHighPrecision = (type === 'Cripto' || ['Stock', 'ETF', 'REIT', 'Exterior'].includes(type) || currency === 'USD');
    const quantityPrecision = isHighPrecision ? 7 : 4;

    // UI Updates
    document.getElementById('ad-ticker').textContent = ticker;
    document.getElementById('ad-name').textContent = `${type} • ${currency}`;
    document.getElementById('ad-qty').textContent = totalQty.toFixed(quantityPrecision).replace(/\.?0+$/, '');
    document.getElementById('ad-pm').textContent = formatCurrency(avgPrice, currency);
    document.getElementById('ad-price').textContent = formatCurrency(currentPrice, currency);
    document.getElementById('ad-invested').textContent = formatCurrency(displayInvested, currency);

    // Profitability
    let profitVal = 0;
    if (totalQty > 0) {
        profitVal = totalCurrent - totalInvested;
    } else {
        profitVal = totalLiquidatedValue - historicalInvested;
    }
    const profitPerc = displayInvested > 0 ? (profitVal / displayInvested) * 100 : 0;

    document.getElementById('ad-current-total').textContent = formatCurrency(totalCurrent, currency);
    const profitEl = document.getElementById('ad-profit-val');
    const profitPercEl = document.getElementById('ad-profit-perc');
    profitEl.textContent = (profitVal >= 0 ? '+' : '') + formatCurrency(profitVal, currency);
    profitPercEl.textContent = (profitPerc >= 0 ? '+' : '') + profitPerc.toFixed(2) + '%';

    if (profitVal >= 0) {
        profitEl.className = "block font-bold text-emerald-600";
        profitPercEl.className = "text-xs font-medium text-emerald-600 bg-emerald-50 px-2 rounded";
    } else {
        profitEl.className = "block font-bold text-red-600";
        profitPercEl.className = "text-xs font-medium text-red-600 bg-red-50 px-2 rounded";
    }

    // --- HISTORY TABLE LOGIC For 0.00 FIX ---
    const activeMapped = activeAssets.map(a => ({
        ...a,
        status: 'active',
        displayDate: a.dateInv,
        totalVal: a.quantity * a.avgPrice,
        originalQuantity: a.quantity
    }));

    const historyMapped = historyAssets.map(h => ({
        ...h,
        id: h.id,
        displayDate: h.liquidationDate || h.dateLiq,
        quantity: h.quantity,
        avgPrice: h.salePrice !== undefined ? h.salePrice : (h.finalPrice || (h.finalValue / h.quantity)),
        totalVal: h.totalVal !== undefined ? h.totalVal : h.finalValue,
        status: 'sold',
        broker: 'Liquidação'
    }));

    // FIX: RECONSTRUCT ORIGINAL QUANTITY for 0-qty assets
    activeMapped.forEach(item => {
        // If this asset bucket is empty (Sold Out), we need to reconstruct what it WAS.
        // We do this by verifying if there are LIQUIDATIONS that explain the 0 qty.
        if (item.quantity === 0) {
            const relatedHistory = historyAssets.filter(h => h.ticker === ticker);
            const totalSold = relatedHistory.reduce((sum, h) => sum + (Number(h.quantity) || 0), 0);

            // If we found sales, and our qty is 0, we can assume the Original was (Active + Sold)
            // But Active is 0. So Original = TotalSold.
            if (totalSold > 0) {
                item.originalQuantity = totalSold;
                item.totalVal = totalSold * item.avgPrice; // Reconstruct Price logic
            }
        }
    });

    window.adFullHistory = [...activeMapped, ...historyMapped];
    window.adFullHistory.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

    renderAssetDetailsAportes();
};

window.renderAssetDetailsAportes = () => {
    const tbody = document.getElementById('ad-history-body');
    tbody.innerHTML = '';
    const start = (window.adCurrentPage - 1) * window.adItemsPerPage;
    const end = start + window.adItemsPerPage;
    const pageItems = window.adFullHistory.slice(start, end);

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-3 text-center text-slate-400 text-xs">Sem histórico.</td></tr>`;
        return;
    }

    pageItems.forEach(item => {
        const isSold = item.status === 'sold';
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group";

        let qtyDisplay = item.quantity;
        if (!isSold && item.originalQuantity) {
            qtyDisplay = item.originalQuantity; // Always show Original for Buy lines
        }

        const dateStr = formatDate(item.displayDate);
        const typeIcon = isSold ? '<i class="fa-solid fa-cart-arrow-down text-red-500 mr-2"></i>' : '<i class="fa-solid fa-cart-shopping text-emerald-500 mr-2"></i>';
        const currency = item.currency || 'BRL';

        row.innerHTML = `
            <td class="px-5 py-3">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-700 dark:text-slate-200 text-xs">${typeIcon}${dateStr}</span>
                     ${item.broker ? `<span class="text-[10px] text-slate-400 pl-6">${item.broker}</span>` : ''}
                </div>
            </td>
            <td class="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-300">
                ${Number(qtyDisplay).toFixed((item.type === 'Cripto' || ['Stock', 'ETF', 'REIT', 'Exterior'].includes(item.type) || item.currency === 'USD') ? 7 : 4).replace(/\.?0+$/, '')}
            </td>
            <td class="px-5 py-3 text-right text-slate-600 dark:text-slate-400">${formatCurrency(item.avgPrice, currency)}</td>
            <td class="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">${formatCurrency(item.totalVal, currency)}</td>
            <td class="px-5 py-3 text-center">
                 <div class="flex items-center justify-center gap-2">
                    ${!isSold ? `
                        <button onclick="openEditModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="openAssetDeleteModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                    ` : `
                        <button onclick="window.deleteHistoryItem('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Desfazer Liquidação"><i class="fa-solid fa-rotate-left text-xs"></i></button>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    const maxPage = Math.ceil(window.adFullHistory.length / window.adItemsPerPage) || 1;
    document.getElementById('ad-page-display').textContent = `${window.adCurrentPage}/${maxPage}`;
    document.getElementById('btn-ad-prev').disabled = window.adCurrentPage === 1;
    document.getElementById('btn-ad-next').disabled = window.adCurrentPage === maxPage;
};

// --- INITIALIZE ---
window.initializeAppData();

// --- LIQUIDATION UI ---
// (Same as before but calls confirmTickerLiquidation > saveLiquidationAtomically)

const parseBRFloat = (val) => { if (!val) return 0; val = val.replace(/\./g, ''); val = val.replace(',', '.'); return parseFloat(val) || 0; };
window.formatCurrencyInput = (input) => {
    let value = input.value.replace(/\D/g, "");
    value = (parseInt(value) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    if (value === "NaN") value = "";
    input.value = value;
};
window.updateLiquidationValues = () => {
    const qty = parseBRFloat(document.getElementById('liq-qty').value);
    const price = parseBRFloat(document.getElementById('liq-price').value);
    const costs = parseBRFloat(document.getElementById('liq-costs').value);
    const total = (qty * price) - costs;
    document.getElementById('liq-final-value').value = total.toFixed(2);
};

// --- TICKER LIQ MODAL ---
window.openTickerLiquidation = () => {
    const modal = document.getElementById('ticker-liquidation-modal');
    if (!modal) return;
    const content = document.getElementById('ticker-liquidation-content');
    document.getElementById('tl-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tl-check-all').checked = false;

    // Calculate Max
    const contributions = window.mockRendaVariavelAssets.filter(a => a.ticker === window.currentDetailTicker);
    const maxQty = contributions.reduce((acc, c) => acc + c.quantity, 0);
    window.tlMaxQty = maxQty;
    document.getElementById('tl-max-qty').textContent = maxQty.toLocaleString('pt-BR');

    const inputQty = document.getElementById('tl-qty');
    inputQty.value = ''; inputQty.disabled = false;

    // Price
    const currentPrice = contributions.length ? (contributions[0].currentPrice || 0) : 0;
    document.getElementById('tl-price').value = currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('tl-costs').value = '0,00';
    updateLiquidationCalc();

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10);
};
window.closeTickerLiquidation = () => {
    const modal = document.getElementById('ticker-liquidation-modal');
    if (modal) modal.classList.add('hidden');
};
window.toggleLiquidarTudo = () => {
    const chk = document.getElementById('tl-check-all').checked;
    const inp = document.getElementById('tl-qty');
    if (chk) { inp.value = window.tlMaxQty.toLocaleString('pt-BR'); inp.disabled = true; }
    else { inp.disabled = false; }
    updateLiquidationCalc();
};
window.updateLiquidationCalc = () => {
    const qty = parseBRFloat(document.getElementById('tl-qty').value);
    const price = parseBRFloat(document.getElementById('tl-price').value);
    const costs = parseBRFloat(document.getElementById('tl-costs').value);
    const total = (qty * price) - costs;
    document.getElementById('tl-total-val').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

window.confirmTickerLiquidation = async () => {
    const qtyToSell = parseBRFloat(document.getElementById('tl-qty').value);
    const price = parseBRFloat(document.getElementById('tl-price').value);
    const costs = parseBRFloat(document.getElementById('tl-costs').value);
    const date = document.getElementById('tl-date').value;

    if (qtyToSell <= 0 || qtyToSell > window.tlMaxQty + 0.0001) return alert("Quantidade inválida.");

    const contributions = window.mockRendaVariavelAssets
        .filter(a => a.ticker === window.currentDetailTicker && a.quantity > 0)
        .sort((a, b) => new Date(a.dateInv) - new Date(b.dateInv));

    let remainingQty = qtyToSell;
    closeTickerLiquidation();

    for (const asset of contributions) {
        if (remainingQty <= 0.000001) break;

        const takeQty = Math.min(asset.quantity, remainingQty);
        remainingQty -= takeQty;
        const propCosts = (takeQty / qtyToSell) * costs || 0;
        const netVal = (takeQty * price) - propCosts;

        // Create Valid History Item
        const newItem = {
            id: 'hist_' + Date.now() + Math.random().toString(36).substr(2),
            ticker: asset.ticker,
            quantity: takeQty,
            salePrice: price,
            avgPrice: asset.avgPrice,
            totalVal: netVal,
            liquidationDate: date,
            status: 'sold',
            type: asset.type,
            broker: asset.broker,
            currency: asset.currency
        };

        // ATOMIC SAVE
        window.saveLiquidationAtomically(newItem);

        // Update Asset (Reduce Qty)
        asset.quantity -= takeQty;
        if (asset.quantity < 0) asset.quantity = 0;

        // Save Asset Update (Manual atomic-ish)
        const allAssets = JSON.parse(localStorage.getItem('local_assets') || '[]');
        const targetIdx = allAssets.findIndex(a => a.id === asset.id || (a.ticker === asset.ticker && a.dateInv === asset.dateInv)); // Robust match
        if (targetIdx !== -1) {
            allAssets[targetIdx].quantity = asset.quantity;
            localStorage.setItem('local_assets', JSON.stringify(allAssets));
        }
    }

    if (window.renderAssetDetails) window.renderAssetDetails(window.currentDetailTicker);
    if (window.refreshUI) window.refreshUI();
    // showSuccessMessage removed or safe call
    if (window.showSuccessMessage) showSuccessMessage("Liquidação realizada com sucesso.");
};
