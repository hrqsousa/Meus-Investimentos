        // --- ASSET DETAILS LOGIC ---
        window.currentDetailTicker = null;
        window.adCurrentPage = 1;
        window.adItemsPerPage = 5;
        window.adFullHistory = []; // Stores combined history for pagination

        window.openAssetDetails = (ticker) => {
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
            const activeAssets = window.mockRendaVariavelAssets.filter(a => a.ticker === ticker);
            if (activeAssets.length === 0) return; // Should not happen if clicked from list
            const sample = activeAssets[0];

            // 2. Filter History (Liquidated)
            const historyAssets = window.liquidationHistory.filter(h => h.ticker === ticker);

            // 3. Aggregate Stats (Active Only)
            let totalQty = 0;
            let totalInvested = 0;
            let totalCurrent = 0;
            let totalInvestedBRL = 0; // For accuracy if mixed currencies, though usually same per ticker
            
            const currentUsdRate = window.currentUsdRate || 5.0;

            activeAssets.forEach(a => {
                totalQty += a.quantity;
                totalInvested += (a.avgPrice * a.quantity);
                totalCurrent += (a.currentPrice * a.quantity);
                
                let invBRL = (a.avgPrice * a.quantity);
                if (a.currency === 'USD') invBRL *= currentUsdRate;
                totalInvestedBRL += invBRL;
            });

            const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
            const currentPrice = sample.currentPrice;
            const currency = sample.currency || 'BRL';

            // 4. Proventos Stats
            const tickerProventos = window.proventos.filter(p => p.asset === ticker);
            const totalProv = tickerProventos.reduce((sum, p) => sum + p.value, 0);
            
            const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const recentProv = tickerProventos.filter(p => new Date(p.date) >= oneYearAgo);
            const totalProv12m = recentProv.reduce((sum, p) => sum + p.value, 0);

            // Yield 12m (vs Current Total Value or vs Invested? Standard is vs Current Price * Qty)
            // If totalCurrent is 0 (fully liquidated), logic fails. But we are viewing active asset.
            const dy12m = totalCurrent > 0 ? (totalProv12m / totalCurrent) * 100 : 0;

            // 5. Update UI - Header
            document.getElementById('ad-ticker').textContent = ticker;
            document.getElementById('ad-name').textContent = `${sample.type} • ${currency}`;
            document.getElementById('ad-qty').textContent = totalQty.toFixed(4).replace(/\.?0+$/, '');
            document.getElementById('ad-pm').textContent = formatCurrency(avgPrice, currency);
            document.getElementById('ad-price').textContent = formatCurrency(currentPrice, currency);
            document.getElementById('ad-invested').textContent = formatCurrency(totalInvested, currency);

            // 6. Update UI - Profitability
            const profitVal = totalCurrent - totalInvested;
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
                totalVal: a.quantity * a.avgPrice
            }));

            // Map History to uniform structure
            // History items usually have: dateLik, quantity (negative?), finalValue...
            // "Partially liquidated" logic means history has 'quantity' of sold items.
            // We want to show them as "Venda".
            const historyMapped = historyAssets.map(h => ({
                ...h,
                id: h.id, // Keep ID for potential deletion if we allow deleting history from here?
                // History items have 'dateLiq'. Use that.
                displayDate: h.dateLiq, 
                quantity: h.quantity, // This is expected to be the sold amount
                avgPrice: h.finalPrice || (h.finalValue / h.quantity), // Sold Price
                totalVal: h.finalValue,
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
                
                const dateStr = formatDate(item.displayDate);
                const typeIcon = isSold ? '<i class="fa-solid fa-arrow-trend-down text-red-500 mr-2"></i>' : '<i class="fa-solid fa-cart-shopping text-emerald-500 mr-2"></i>';
                const typeText = isSold ? 'Venda/Liq.' : 'Compra';
                const currency = item.currency || 'BRL';

                row.innerHTML = `
                    <td class="px-5 py-3">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-700 dark:text-slate-200 text-xs">${typeIcon}${dateStr}</span>
                            <span class="text-[10px] text-slate-400 pl-6">${item.broker || 'Manual'}</span>
                        </div>
                    </td>
                    <td class="px-5 py-3 text-right font-medium text-slate-600 dark:text-slate-300">${item.quantity}</td>
                    <td class="px-5 py-3 text-right text-slate-600 dark:text-slate-400">${formatCurrency(item.avgPrice, currency)}</td>
                    <td class="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-200">${formatCurrency(item.totalVal, currency)}</td>
                    <td class="px-5 py-3 text-center">
                        <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            ${!isSold ? `
                                <button onclick="openLiquidationModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Liquidar Parcial"><i class="fa-solid fa-gavel text-xs"></i></button>
                                <button onclick="openEditModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="openAssetDeleteModal('${item.id}')" class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir"><i class="fa-solid fa-trash text-xs"></i></button>
                            ` : `
                                <span class="text-[10px] text-slate-400 italic">Fechado</span>
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
        window.openTickerLiquidation = () => {
             // Liquidate ALL logic or open generic liquidation for ticker?
             // User plan said "Partial/Total" logic. 
             // Simplest first step: Just open the standard Liquidation modal for the OLDEST active asset?
             // Or create a new specific modal for "Amount to Liquidate"?
             alert("Funcionalidade de Liquidação por Ticker em breve! Use a liquidação individual na tabela abaixo.");
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
