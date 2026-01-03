// --- ASSET DETAILS LOGIC ---
window.currentDetailTicker = null;
window.adCurrentPage = 1;
window.adItemsPerPage = 5;
window.adFullHistory = []; // Stores combined history for pagination

// --- PERSISTENCE SAFETY (JIT LOADING) ---
window.ensureHistoryLoaded = () => {
    // If memory is empty but disk has data, RELOAD immediately.
    if ((!window.liquidationHistory || window.liquidationHistory.length === 0)) {
        const fromDisk = localStorage.getItem('local_history');
        if (fromDisk) {
            try {
                window.liquidationHistory = JSON.parse(fromDisk);

                // DATA HEALING: Fix NaN values from corrupt saves
                let healed = false;
                window.liquidationHistory.forEach(h => {
                    if (typeof h.totalVal !== 'number' || isNaN(h.totalVal) || h.totalVal === "NaN") { h.totalVal = 0; healed = true; }
                    if (typeof h.avgPrice !== 'number' || isNaN(h.avgPrice) || h.avgPrice === "NaN") { h.avgPrice = 0; healed = true; }
                    if (typeof h.salePrice !== 'number' || isNaN(h.salePrice) || h.salePrice === "NaN") { h.salePrice = 0; healed = true; }
                    if (typeof h.quantity !== 'number' || isNaN(h.quantity) || h.quantity === "NaN") { h.quantity = 0; healed = true; }
                });

                if (healed) {
                    console.log(">>> Healed corrupt data (NaN fixed)");
                    localStorage.setItem('local_history', JSON.stringify(window.liquidationHistory));
                }

                console.log(">>> JIT Loaded liquidationHistory from disk");
            } catch (e) { console.error("JIT Load Error:", e); }
        }
    }
};

window.openAssetDetails = (ticker) => {
    window.ensureHistoryLoaded(); // JIT Load before opening
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

    // Fetch and Render Data
    if (window.renderAssetDetails) window.renderAssetDetails(ticker);
};

window.deleteHistoryItem = async (id) => {
    if (!confirm("Deseja realmente excluir este registro de liquidação? A quantidade liquidada será devolvida ao ativo.")) return;

    // 1. Find the history item
    const historyIndex = window.liquidationHistory.findIndex(h => h.id === id);
    if (historyIndex === -1) return alert("Erro: Registro histórico não encontrado.");

    const historyItem = window.liquidationHistory[historyIndex];
    if (historyItem.status !== 'sold' && !historyItem.isSell && !historyItem.liquidationDate) {
        return alert("Este item não parece ser uma liquidação válida.");
    }

    // 2. Restore Quantity to Asset (Undo)
    const asset = window.mockRendaVariavelAssets.find(a => a.ticker === historyItem.ticker);
    if (asset) {
        asset.quantity += historyItem.quantity;
        // Optional: Recalculate average price? 
        // FIFO logic implies we sold the "oldest" stocks. Restoring them simply by adding quantity 
        // to the aggregate is the best approximation without a full transaction replay system.
        // We keep the current average price as is, or we could try to restore it if we stored it?
        // Implementing full replay is too risky. Restoring quantity is the primary requirement.
        console.log(`Restored ${historyItem.quantity} to ${asset.ticker}`);
    } else {
        // Asset might have been fully deleted (0 qty) but still exists in mock list (we sanitize now).
        // If not found, maybe create it?
        // For now, if asset not found, we just delete history.
        console.warn("Asset container not found for restoration. Deleting history only.");
    }

    // 3. Remove History Item
    window.liquidationHistory.splice(historyIndex, 1);

    // 4. Save Changes
    saveToLocalStorage();

    // 5. Refresh UI
    if (window.renderAssetDetails && window.currentDetailTicker) {
        window.renderAssetDetails(window.currentDetailTicker);
    }
    if (window.refreshUI) window.refreshUI();

    showSuccessMessage("Liquidação cancelada e saldo restaurado.");
};

window.renderRVHistory = (ticker) => {
    const tbody = document.getElementById('rv-detail-history-body');
    tbody.innerHTML = '';

    // Collect Active Contributions
    const active = window.mockRendaVariavelAssets
        .filter(a => a.ticker === ticker)
        .map(a => ({ ...a, status: 'Ativo', displayDate: a.dateInv }));

    // Collect Liquidations (History)
    const history = (window.liquidationHistory || [])
        .filter(h => h.ticker === ticker)
        .map(h => ({ ...h, status: 'Venda ' + (h.liquidationType || ''), displayDate: h.liquidationDate, isSell: true }));

    // Merge and Sort
    const allItems = [...active, ...history].sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

    // Pagination
    const page = window.rvHistoryPage;
    const perPage = 5;
    const totalPages = Math.ceil(allItems.length / perPage) || 1;
    const start = (page - 1) * perPage;
    const pagedItems = allItems.slice(start, start + perPage);

    if (pagedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-slate-400 text-xs">Sem histórico.</td></tr>`;
    } else {
        pagedItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group";

            const isSell = item.isSell;
            const colorClass = isSell ? 'text-red-500' : 'text-emerald-500';
            const icon = isSell ? '<i class="fa-solid fa-cart-arrow-down mr-1"></i>' : '<i class="fa-solid fa-arrow-trend-up mr-1"></i>';
            const typeLabel = isSell ? 'Venda' : 'Compra';

            const price = isSell ? (item.salePrice || item.unitPrice) : item.avgPrice;
            const totalNative = item.quantity * price;

            // Action Buttons
            // For Sales: Allow Delete (Undo)
            // For Active: Allow Edit/Delete
            let actions = '';

            if (!isSell) {
                actions = `
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="openEditModal('${item.id}')" class="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 flex items-center justify-center transition-colors" title="Editar">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="openAssetDeleteModal('${item.id}')" class="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 flex items-center justify-center transition-colors" title="Remover">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>`;
            } else {
                // Sale Actions (Undo)
                actions = `
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="deleteHistoryItem('${item.id}')" class="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 flex items-center justify-center transition-colors" title="Cancelar Venda">
                            <i class="fa-solid fa-rotate-left text-xs"></i>
                        </button>
                    </div>`;
            }

            tr.innerHTML = `
                    <td class="px-6 py-3 font-medium text-slate-600 dark:text-slate-300 relative">
                        ${formatDate(item.displayDate)}
                    </td>
                    <td class="px-6 py-3 font-bold ${colorClass} text-xs uppercase">${icon} ${typeLabel}</td>
                    <td class="px-6 py-3 text-right text-slate-600 dark:text-slate-400">${item.quantity.toFixed((item.type === 'Cripto' || ['Stock', 'ETF', 'REIT', 'Exterior'].includes(item.type) || item.currency === 'USD') ? 7 : 4).replace(/\.?0+$/, '')}</td>
                    <td class="px-6 py-3 text-right text-slate-600 dark:text-slate-400">${formatCurrency(price, item.currency)}</td>
                    <td class="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-200">${formatCurrency(totalNative, item.currency)}</td>
                    <td class="px-6 py-3 text-right">
                        ${actions}
                    </td>
                `;
            tbody.appendChild(tr);
        });
    }

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
    // 1. Filter Assets (Active)
    // Note: We include 0-quantity assets here to show them in history if they exist in the mock list
    // (They are hidden from main list but exist in memory)
    const activeAssets = window.mockRendaVariavelAssets.filter(a => a.ticker === ticker);

    // 2. Filter History (Liquidated)
    const historyAssets = window.liquidationHistory.filter(h => h.ticker === ticker);

    if (activeAssets.length === 0 && historyAssets.length === 0) return;

    // Define Representative Asset (prefer active, else latest history)
    let sample = activeAssets.length > 0 ? activeAssets[0] : historyAssets[0];

    // 3. Aggregate Stats
    let totalQty = 0;
    let totalInvested = 0;
    let totalCurrent = 0;
    let totalInvestedBRL = 0;

    const currentUsdRate = window.currentUsdRate || 5.0;

    // A. Active Assets Calculation
    activeAssets.forEach(a => {
        totalQty += (Number(a.quantity) || 0);
        const safeAvg = (Number(a.avgPrice) || 0);
        totalInvested += (safeAvg * a.quantity);
        totalCurrent += ((Number(a.currentPrice) || 0) * a.quantity);

        let invBRL = (safeAvg * a.quantity);
        if (a.currency === 'USD') invBRL *= currentUsdRate;
        totalInvestedBRL += invBRL;
    });

    // B. Historical/Liquidated Calculation (for closed positions)
    let historicalInvested = 0;
    let totalLiquidatedValue = 0; // The cash we got back
    historyAssets.forEach(h => {
        if (h.status === 'sold') {
            const hQty = Number(h.quantity) || 0;
            const hAvg = Number(h.avgPrice) || 0; // This is the Buy Price at time of sale
            const hTotal = Number(h.totalVal) || Number(h.finalValue) || 0; // Net received

            historicalInvested += (hQty * hAvg);
            totalLiquidatedValue += hTotal;
        }
    });

    // C. Determine Display Values
    // If we have no active quantity, we are looking at a "Closed Position".
    // We should show the Historical Invested amount and the Realized Profit.
    if (totalQty === 0 && historyAssets.length > 0) {
        totalInvested = historicalInvested;
        // For profit calculation in closed position:
        // Profit = (Money Out) - (Money In)
        // Money Out = Total Liquidated Value
        // Money In = Historical Invested
        // Note: totalCurrent is 0 here.
    }

    const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
    // Fallback if sample is from history and doesn't have currentPrice
    const currentPrice = sample.currentPrice || sample.unitPrice || 0;
    const currency = sample.currency || 'BRL';
    const type = sample.type || sample.category;

    // 4. Proventos Stats
    const tickerProventos = window.proventos ? window.proventos.filter(p => p.asset === ticker) : [];
    const totalProv = tickerProventos.reduce((sum, p) => sum + p.value, 0);

    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentProv = tickerProventos.filter(p => new Date(p.date) >= oneYearAgo);
    const totalProv12m = recentProv.reduce((sum, p) => sum + p.value, 0);

    const dy12m = totalCurrent > 0 ? (totalProv12m / totalCurrent) * 100 : 0;

    // 5. Update UI - Header
    document.getElementById('ad-ticker').textContent = ticker;
    document.getElementById('ad-name').textContent = `${type} • ${currency}`; // improved label

    // Setup Icon
    const iconDiv = document.getElementById('ad-icon-container'); // Need to ensure ID exists or reuse logic
    // If ad-icon-container doesn't exist in modal HTML, skip or assume user didn't request changing it.
    // The previous implementation didn't update the icon in this function, so we keep it simple.

    const isHighPrecision = (type === 'Cripto' || ['Stock', 'ETF', 'REIT', 'Exterior'].includes(type) || currency === 'USD');
    const quantityPrecision = isHighPrecision ? 7 : 4;

    document.getElementById('ad-qty').textContent = totalQty.toFixed(quantityPrecision).replace(/\.?0+$/, '');
    document.getElementById('ad-pm').textContent = formatCurrency(avgPrice, currency);
    document.getElementById('ad-price').textContent = formatCurrency(currentPrice, currency);
    document.getElementById('ad-invested').textContent = formatCurrency(totalInvested, currency);

    // 6. Update UI - Profitability
    let profitVal = 0;

    if (totalQty > 0) {
        // Active Position: Current Value - Cost
        profitVal = totalCurrent - totalInvested;
    } else {
        // Closed Position: Liquidated Value - Cost
        profitVal = totalLiquidatedValue - totalInvested;
    }

    const profitPerc = totalInvested > 0 ? (profitVal / totalInvested) * 100 : 0;
    const totalWithProv = profitVal + totalProv;

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

    document.getElementById('ad-profit-total').textContent = (totalWithProv >= 0 ? '+' : '') + formatCurrency(totalWithProv, currency);

    // 7. Update UI - Proventos
    document.getElementById('ad-prov-all').textContent = formatCurrency(totalProv, currency);
    document.getElementById('ad-prov-12m').textContent = formatCurrency(totalProv12m, currency);
    document.getElementById('ad-dy-12m').textContent = dy12m.toFixed(2) + '%';


    // 8. Combine History (Active + Liquidated)
    // Map Active to uniform structure
    const activeMapped = activeAssets.map(a => ({
        ...a,
        status: 'active',
        displayDate: a.dateInv,
        totalVal: a.quantity * a.avgPrice,
        // Ensure originalQuantity is passed for history display
        originalQuantity: a.originalQuantity
    }));

    // Map History to uniform structure
    const historyMapped = historyAssets.map(h => ({
        ...h,
        id: h.id,
        // Handle both new 'liquidationDate' and potentially legacy 'dateLiq'
        displayDate: h.liquidationDate || h.dateLiq,
        quantity: h.quantity,
        // Handle 'salePrice' vs 'finalPrice'
        avgPrice: h.salePrice !== undefined ? h.salePrice : (h.finalPrice || (h.finalValue / h.quantity)),
        // Handle 'totalVal' vs 'finalValue'
        totalVal: h.totalVal !== undefined ? h.totalVal : h.finalValue,
        status: 'sold',
        broker: 'Liquidação'
    }));

    window.adFullHistory = [...activeMapped, ...historyMapped];
    // Sort Descending Date
    window.adFullHistory.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

    renderAssetDetailsAportes();
};

window.changeAdPage = (delta) => {
    const maxPage = Math.ceil(window.adFullHistory.length / window.adItemsPerPage) || 1;
    const newPage = window.adCurrentPage + delta;
    if (newPage >= 1 && newPage <= maxPage) {
        window.adCurrentPage = newPage;
        renderAssetDetailsAportes();
    }
};

window.renderAssetDetailsAportes = () => {
    const tbody = document.getElementById('ad-history-body');
    tbody.innerHTML = '';

    const start = (window.adCurrentPage - 1) * window.adItemsPerPage;
    const end = start + window.adItemsPerPage;
    const pageItems = window.adFullHistory.slice(start, end);

    pageItems.forEach(item => {
        const isSold = item.status === 'sold';
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group";

        // Determine Quantity to Show: Original for Buys (if exists), Actual for Sells
        // If it's a Buy (not sold) but has been partially liquidated, we want to show the Original Quantity if available.
        // Assuming 'item' for a Buy is the Asset object itself.
        let qtyDisplay = item.quantity;
        if (!isSold && item.originalQuantity !== undefined) {
            qtyDisplay = item.originalQuantity;
        }

        const dateStr = formatDate(item.displayDate);
        const typeIcon = isSold ? '<i class="fa-solid fa-cart-arrow-down text-red-500 mr-2"></i>' : '<i class="fa-solid fa-cart-shopping text-emerald-500 mr-2"></i>';
        const typeText = isSold ? 'Venda/Liq.' : 'Compra';
        const currency = item.currency || 'BRL';

        row.innerHTML = `
                    <td class="px-5 py-3">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-700 dark:text-slate-200 text-xs">${typeIcon}${dateStr}</span>
                            <span class="text-[10px] text-slate-400 pl-6">${item.broker || 'Manual'}</span>
                        </div>
                    </td>
                    <td class="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-300">${qtyDisplay}</td>
                    <td class="px-5 py-3 text-right text-slate-600 dark:text-slate-400">${formatCurrency(item.avgPrice, currency)}</td>
                    <td class="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">${formatCurrency(item.totalVal, currency)}</td>
                    <td class="px-5 py-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                            ${!isSold ? `
                                <button onclick="openEditModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="openAssetDeleteModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button>
                            ` : `
                                <button onclick="window.deleteHistoryItem('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Cancelar Venda/Liquidação">
                                    <i class="fa-solid fa-rotate-left text-xs"></i>
                                </button>
                            `}
                        </div>
                    </td>
                `;
        tbody.appendChild(row);
    });

    // Update Pagination Controls
    const maxPage = Math.ceil(window.adFullHistory.length / window.adItemsPerPage) || 1;
    document.getElementById('ad-page-display').textContent = `${window.adCurrentPage}/${maxPage}`;
    document.getElementById('btn-ad-prev').disabled = window.adCurrentPage === 1;
    document.getElementById('btn-ad-next').disabled = window.adCurrentPage === maxPage;
};

// --- SHORTCUTS ---
// --- TICKER LIQUIDATION LOGIC ---
// --- HELPER: INPUT MASK ---
window.formatCurrencyInput = (input) => {
    let value = input.value.replace(/\D/g, "");
    value = (parseInt(value) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    if (value === "NaN") value = "";
    input.value = value;
};

// --- HELPER: SANITIZE DUPLICATES ---
const sanitizeAssets = (ticker) => {
    // Aggressive deduplication
    const all = window.mockRendaVariavelAssets;
    const uniqueMap = new Map();
    const indicesToRemove = [];

    // Identify unique assets by logical key
    all.forEach((asset, index) => {
        if (asset.ticker !== ticker) return;

        // Key includes Quantity to differentiate valid different lots, 
        // BUT if we have exact duplicates (Ghost assets), they will have same qty/date/price.
        // We also check ID. If ID is different but everything else is same, it's a ghost.
        const key = `${asset.ticker}|${asset.dateInv}|${asset.avgPrice.toFixed(4)}|${asset.quantity.toFixed(4)}`;

        if (uniqueMap.has(key)) {
            // Found a duplicate!
            // We keep the one that ALREADY has an ID if possible, or the First one.
            const existingIndex = uniqueMap.get(key);
            const existingAsset = all[existingIndex];

            // If current asset has ID and existing doesn't, swap? 
            // Usually simpler: just kill the current one (the second one found)
            indicesToRemove.push(index);
        } else {
            uniqueMap.set(key, index);
        }
    });

    // Remove duplicates (reverse order)
    indicesToRemove.sort((a, b) => b - a).forEach(i => {
        window.mockRendaVariavelAssets.splice(i, 1);
    });

    if (indicesToRemove.length > 0) {
        saveToLocalStorage();
    }
};

// --- TICKER LIQUIDATION LOGIC ---
window.openTickerLiquidation = () => {
    const modal = document.getElementById('ticker-liquidation-modal');
    const content = document.getElementById('ticker-liquidation-content');

    // Reset Fields
    document.getElementById('tl-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tl-check-all').checked = false;

    // Get Max Qty
    const contributions = window.mockRendaVariavelAssets.filter(a => a.ticker === window.currentDetailTicker);
    const maxQty = contributions.reduce((acc, c) => acc + c.quantity, 0);
    window.tlMaxQty = maxQty;
    document.getElementById('tl-max-qty').textContent = maxQty.toFixed(4).replace(/\.?0+$/, '').replace('.', ',');

    const inputQty = document.getElementById('tl-qty');
    inputQty.value = '';
    inputQty.disabled = false;
    inputQty.placeholder = maxQty.toFixed(4).replace(/\.?0+$/, '').replace('.', ',');

    // Get Current Price
    const currentPrice = contributions.length > 0 ? (contributions[0].currentPrice || 0) : 0;

    // Format Price for Input (BR string)
    const priceStr = currentPrice.toFixed(2).replace('.', ',');
    document.getElementById('tl-price').value = priceStr;
    document.getElementById('tl-costs').value = '0,00';

    updateLiquidationCalc();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
};

window.closeTickerLiquidation = () => {
    const modal = document.getElementById('ticker-liquidation-modal');
    const content = document.getElementById('ticker-liquidation-content');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.toggleLiquidarTudo = () => {
    const isChecked = document.getElementById('tl-check-all').checked;
    const inputQty = document.getElementById('tl-qty');
    if (isChecked) {
        inputQty.value = window.tlMaxQty;
        inputQty.disabled = true;
    } else {
        inputQty.disabled = false;
    }
    updateLiquidationCalc();
};

// Helper to parse float from BR/Comma format
const parseBRFloat = (val) => {
    if (!val) return 0;
    // Remove all non-numeric chars except comma
    // If multiple dots/commas exist, this simple replace might be weak, but for controlled input it works.
    // Standard format from masking is "1.234,56" or "10,00".
    // 1. Remove dots (thousands separators)
    val = val.replace(/\./g, '');
    // 2. Replace comma with dot
    val = val.replace(',', '.');
    return parseFloat(val) || 0;
};

window.updateLiquidationCalc = () => {
    const qty = parseBRFloat(document.getElementById('tl-qty').value);
    const price = parseBRFloat(document.getElementById('tl-price').value);
    const costs = parseBRFloat(document.getElementById('tl-costs').value);

    const total = (qty * price) - costs;
    document.getElementById('tl-total-val').textContent = formatCurrency(total);
};

// Helper to ensure persistence (Compatible with LocalDataManager)
window.saveToLocalStorage = () => {
    window.ensureHistoryLoaded(); // JIT Load before saving to avoid overwriting with empty
    try {
        // 1. Save Assets (Merge RV into global 'local_assets')
        const currentAll = JSON.parse(localStorage.getItem('local_assets') || '[]');

        // Filter out existing RV assets from storage to avoid duplication/stale data
        // We assume 'renda-variavel' category OR presence of ticker implies RV in this app context
        const nonRV = currentAll.filter(a => a.category !== 'renda-variavel' && !a.ticker);

        // Combine Non-RV + Current In-Memory RV
        const newAll = [...nonRV, ...window.mockRendaVariavelAssets];

        localStorage.setItem('local_assets', JSON.stringify(newAll));

        // 2. Save History (Direct override of 'local_history')
        if (window.liquidationHistory) {
            console.log(`>>> Saving History: ${window.liquidationHistory.length} items`);
            localStorage.setItem('local_history', JSON.stringify(window.liquidationHistory));
        }

        console.log(">>> Data Saved to LocalStorage (local_assets, local_history)");
    } catch (e) {
        console.error("Auto-Save Error:", e);
    }
};

window.confirmTickerLiquidation = async () => {
    // 1. Sanitize FIRST to remove any ghost duplicates before processing
    if (window.currentDetailTicker) sanitizeAssets(window.currentDetailTicker);

    const qtyToSell = parseBRFloat(document.getElementById('tl-qty').value);
    const price = parseBRFloat(document.getElementById('tl-price').value);
    const costs = parseBRFloat(document.getElementById('tl-costs').value);
    const date = document.getElementById('tl-date').value;

    if (!qtyToSell || qtyToSell <= 0) return alert("Quantidade inválida");
    if (price < 0) return alert("Preço inválido");
    if (qtyToSell > window.tlMaxQty + 0.0001) return alert("Quantidade excede o saldo disponível");

    // FIFO Logic
    // Ignore assets with 0 quantity (already liquidated)
    const contributions = window.mockRendaVariavelAssets
        .filter(a => a.ticker === window.currentDetailTicker && a.quantity > 0)
        .sort((a, b) => new Date(a.dateInv) - new Date(b.dateInv)); // Oldest first

    let remainingQty = qtyToSell;

    closeTickerLiquidation();

    // Iterate through contributions
    for (const asset of contributions) {
        if (remainingQty <= 0.000001) break;

        // 1. Find the REAL Asset in the Global Array to ensure reference integrity
        let globalIndex = window.mockRendaVariavelAssets.findIndex(a => a === asset);

        // Fallback: Find by matching properties if reference lost (Fixes duplicates)
        if (globalIndex === -1) {
            globalIndex = window.mockRendaVariavelAssets.findIndex(a =>
                a.ticker === asset.ticker &&
                a.dateInv === asset.dateInv &&
                Math.abs(a.quantity - asset.quantity) < 0.0001
            );
        }

        if (globalIndex === -1) {
            console.error("Asset not found in global list", asset);
            continue;
        }

        // Get the real global object
        const globalAsset = window.mockRendaVariavelAssets[globalIndex];

        // 2. Ensure ID exists (Fixes legacy data)
        if (!globalAsset.id) {
            globalAsset.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }

        const takeQty = Math.min(globalAsset.quantity, remainingQty);
        remainingQty -= takeQty;

        // Proportional Costs
        const propCosts = (takeQty / qtyToSell) * costs || 0;

        // Calculate Profit
        const saleVal = takeQty * price;
        const netVal = saleVal - propCosts;
        // Safeguard: Ensure avgPrice is number
        const safeAvgPrice = Number(globalAsset.avgPrice) || 0;
        const buyVal = takeQty * safeAvgPrice;
        const profit = netVal - buyVal;

        // Create History Entry
        const historyItem = {
            id: 'hist_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
            ticker: globalAsset.ticker,
            type: globalAsset.type,
            quantity: takeQty,
            avgPrice: safeAvgPrice, // Buy Price
            salePrice: price,         // Sell Price
            finalPrice: price,        // Compatibility
            totalVal: isNaN(netVal) ? 0 : netVal,         // Net Received (NaN proof)
            finalValue: isNaN(netVal) ? 0 : netVal,       // Compatibility
            liquidationDate: date,    // New field
            dateLiq: date,            // Compatibility
            dateInv: globalAsset.dateInv,
            broker: globalAsset.broker,
            currency: globalAsset.currency,
            status: 'sold'
        };

        window.liquidationHistory.push(historyItem);

        // 3. Update Asset (Reduce or Zero - PRESERVE ORIGINAL QTY)
        if (globalAsset.originalQuantity === undefined) {
            globalAsset.originalQuantity = globalAsset.quantity;
        }

        const newQty = globalAsset.quantity - takeQty;
        globalAsset.quantity = newQty <= 0.000001 ? 0 : newQty;

        // 4. Persistence
        // Save
        // We do NOT use firebaseSaveAsset here because it might append instead of update in some legacy implementations.
        // We rely on the full-list overwrite below.

        // Explicit Save List
        saveToLocalStorage();
    }

    // FINAL REFRESH
    // Update the VIEW explicitly
    if (window.renderAssetDetails && window.currentDetailTicker) {
        window.renderAssetDetails(window.currentDetailTicker);
    }

    // Also trigger global refresh just in case
    if (window.refreshUI) window.refreshUI();

    // Non-blocking success message
    if (window.showSuccessMessage) showSuccessMessage("Liquidação realizada com sucesso!");
};

window.openTickerAporte = () => {
    if (window.currentDetailTicker) {
        // Find sample for pre-fill
        const sample = window.mockRendaVariavelAssets.find(a => a.ticker === window.currentDetailTicker);
        if (sample) {
            openInvestModal({
                category: 'renda-variavel',
                type: sample.type,
                ticker: sample.ticker,
                currency: sample.currency
            });
        }
    }
};
