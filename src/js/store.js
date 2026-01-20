import { subscribeToAuth } from './firebase/auth.js';
import { subscribeToFixedIncome, addAsset, updateAsset, deleteAsset, subscribeToVariableIncome, addVariableAsset, updateVariableAsset, deleteVariableAsset, subscribeToProventos, addProvento, updateProvento, deleteProvento, subscribeToUserDocument, updateUserDocument } from './firebase/firestore.js';
import { fetchPrices } from './services/price_service.js';

class Store {
    constructor() {
        // Initial state with empty values (No Mock Data)
        this.state = {
            isLoading: true,
            user: null,
            reserveSettings: JSON.parse(localStorage.getItem('reserveSettings')) || {
                monthlyCost: 3000,
                includeSelic: false
            },
            dashboard: {
                totalBalance: 0,
                profit: 0,
                profitPercentage: 0,
                goal: parseFloat(localStorage.getItem('dashboardGoal')) || 1000000, // Load from local storage
                dividends: 0,
                allocation: {
                    labels: ['Renda Fixa'],
                    data: [100]
                },
                topAssets: []
            },
            fixedIncome: {
                assets: [], // Start empty
                closedAssets: []
            },
            variableIncome: {
                assets: [],
                closedAssets: []
            },
            proventos: [], // New Proventos State
            cash: parseFloat(localStorage.getItem('userCash')) || 0,
            rebalancingTargets: JSON.parse(localStorage.getItem('rebalancingTargets')) || {},
            dollarQuote: parseFloat(localStorage.getItem('dollarQuote')) || 0 // Load persisted dollar quote
        };
        this.listeners = [];

        // Subscribe to Firebase Auth
        subscribeToAuth((user) => {
            if (user) {
                this.state.user = {
                    uid: user.uid,
                    name: user.displayName,
                    email: user.email,
                    photo: user.photoURL
                };

                // Subscribe to Fixed Income Data
                subscribeToFixedIncome(user.uid, (assets) => {
                    // Separate Active vs Liquidated
                    this.state.fixedIncome.assets = assets.filter(a => a.status !== 'liquidated');
                    this.state.fixedIncome.closedAssets = assets.filter(a => a.status === 'liquidated');

                    this.state.isLoading = false;
                    this.updateDashboardFromAssets(); // Calculate totals
                    this.notify();
                });

                // Subscribe to Variable Income Data
                subscribeToVariableIncome(user.uid, (assets) => {
                    // Safety: If asset has ~0 qty but status != liquidated, move it to closed anyway
                    // This allows the user to find "lost" assets in the History.
                    assets.forEach(a => {
                        const qty = parseFloat(a.qty) || 0;
                        if (qty <= 0.000001 && a.status !== 'liquidated') {
                            a.status = 'liquidated'; // Fix memory state
                            // Ideally we should fix Firestore too, but this handles the UI.
                        }
                    });

                    this.state.variableIncome.assets = assets.filter(a => a.status !== 'liquidated');
                    this.state.variableIncome.closedAssets = assets.filter(a => a.status === 'liquidated');

                    this.updateDashboardFromAssets();
                    this.notify();
                });

                // Subscribe to Proventos
                subscribeToProventos(user.uid, (items) => {
                    this.state.proventos = items;
                    this.notify(); // Notify listeners to update UI
                });

                // Subscribe to User Settings
                subscribeToUserDocument(user.uid, (data) => {
                    if (this.state.user) {
                        this.state.user.settings = data.settings || {};
                        // Fallback: if empty in Firestore, try migrating from localStorage once?
                        // Or just let user re-enter. Migration is safer.
                        if (!this.state.user.settings.sheetCsvUrl && localStorage.getItem('sheetCsvUrl')) {
                            this.updateSettings({ sheetCsvUrl: localStorage.getItem('sheetCsvUrl') });
                        }

                        // Load Rebalancing Targets from Firestore
                        // They are stored in 'rebalancingTargets' field of user doc, or inside settings?
                        // Let's store them as a top-level field 'rebalancingTargets' in the user doc for clarity, 
                        // or inside settings. The previous code structure suggested 'settings' handles user prefs.
                        // But 'rebalancingTargets' is more data-like. 
                        // Let's put it in `data.rebalancingTargets`.
                        this.state.rebalancingTargets = data.rebalancingTargets || {};

                        // Fallback/Migration for Targets
                        if (Object.keys(this.state.rebalancingTargets).length === 0 && localStorage.getItem('rebalancingTargets')) {
                            const localTargets = JSON.parse(localStorage.getItem('rebalancingTargets'));
                            this.updateRebalancingTargets(localTargets);
                        }

                        // Load Reserve Settings from Cloud
                        if (data.reserveSettings) {
                            this.state.reserveSettings = data.reserveSettings;
                        } else if (localStorage.getItem('reserveSettings')) {
                            this.updateReserveSettings(JSON.parse(localStorage.getItem('reserveSettings')));
                        }

                        // Load Dashboard Goal from Cloud
                        if (data.dashboardGoal) {
                            this.state.dashboard.goal = parseFloat(data.dashboardGoal);
                            localStorage.setItem('dashboardGoal', this.state.dashboard.goal); // Keep local in sync
                        } else if (localStorage.getItem('dashboardGoal')) {
                            // Migration: Push local to cloud
                            this.updateGoal(parseFloat(localStorage.getItem('dashboardGoal')));
                        }

                        // Load Cash from Cloud
                        if (data.cash !== undefined) {
                            this.state.cash = parseFloat(data.cash);
                            localStorage.setItem('userCash', this.state.cash); // Keep local in sync
                        } else if (localStorage.getItem('userCash')) {
                            // Migration: Push local to cloud
                            this.updateCash(parseFloat(localStorage.getItem('userCash')));
                        }

                        this.notify();
                    }
                });




            } else {
                this.state.user = null;
                this.state.fixedIncome.assets = [];
                this.state.isLoading = false;
                this.updateDashboardFromAssets(); // Reset to zero
                this.notify();
            }
        });
    }

    updateDashboardFromAssets() {
        const fixedAssets = this.state.fixedIncome.assets || [];
        const varAssets = this.state.variableIncome.assets || [];

        // Combine for Totals
        const allAssets = [...fixedAssets, ...varAssets];
        const dollarQuote = this.state.dollarQuote || 1;

        // Initialize Totals
        let fixedTotal = 0;
        let treasuryTotal = 0;
        let reserveTotal = 0;
        let variableTotal = 0;

        let totalInvested = 0;
        let totalAssetsBalance = 0;

        // Helper to check category
        const isTreasury = (a) => a.type && a.type.toLowerCase().includes('tesouro');

        // 1. Process Variable Income Exclusively
        varAssets.forEach(a => {
            let val = parseFloat(a.currentBalance) || 0;
            let inv = parseFloat(a.investedValue) || 0;

            if (a.currency === 'USD') {
                val *= dollarQuote;
                inv *= dollarQuote;
            }

            variableTotal += val;
            totalAssetsBalance += val;
            totalInvested += inv;
        });

        // 2. Process Fixed Income Exclusively
        fixedAssets.forEach(a => {
            let val = parseFloat(a.currentBalance) || 0;
            let inv = parseFloat(a.investedValue) || 0;
            // Fixed income usually BRL, but just in case
            if (a.currency === 'USD') {
                val *= dollarQuote;
                inv *= dollarQuote;
            }

            if (a.isReserve) {
                reserveTotal += val;
            } else if (isTreasury(a)) {
                treasuryTotal += val;
            } else {
                fixedTotal += val;
            }

            totalAssetsBalance += val;
            totalInvested += inv;
        });

        const totalBalance = totalAssetsBalance + (this.state.cash || 0);
        const profit = totalAssetsBalance - totalInvested;
        const profitPercentage = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        // Update Dashboard State
        this.state.dashboard.totalBalance = totalBalance;
        this.state.dashboard.profit = profit;
        this.state.dashboard.profitPercentage = profitPercentage;

        // Allocation Logic
        const allocationItems = [
            { label: 'Renda Fixa', value: fixedTotal, color: '#3b82f6' },
            { label: 'Tesouro Direto', value: treasuryTotal, color: '#f59e0b' },
            { label: 'Reserva', value: reserveTotal, color: '#10b981' },
            { label: 'Renda Variável', value: variableTotal, color: '#8b5cf6' },
            { label: 'Caixa', value: (this.state.cash || 0), color: '#9ca3af' }
        ];

        // Sort by value descending
        allocationItems.sort((a, b) => b.value - a.value);

        this.state.dashboard.allocation = {
            labels: allocationItems.map(i => i.label),
            data: allocationItems.map(i => i.value),
            colors: allocationItems.map(i => i.color)
        };

        const processedAssets = allAssets.map(a => {
            let name = a.issuer;
            let ticker = a.type;
            const isVariable = a.category === 'variable' || !!a.ticker; // Robust check

            // Logic for Names
            if (isVariable) {
                name = a.ticker; // Ticker as main name
                ticker = a.type; // "Ação", "FII"
            } else if (isTreasury(a)) {
                const year = new Date(a.dueDate).getFullYear();
                if (a.type.toLowerCase().includes('renda+')) {
                    name = `Tesouro Renda + ${year - 19} `;
                } else {
                    name = `${a.type} ${year} `;
                }
            }

            // Calculate Asset profit %
            const inv = parseFloat(a.investedValue) || 1;
            const bal = parseFloat(a.currentBalance) || 0;
            const perc = inv > 0 ? ((bal - inv) / inv) * 100 : 0;

            return {
                name: name || 'Desconhecido',
                ticker: ticker, // Badge text
                value: bal,
                percentage: perc
            };
        });

        // Sort by Percentage Descending
        this.state.dashboard.topAssets = processedAssets.sort((a, b) => {
            return b.percentage - a.percentage;
        }).slice(0, 10);
    }

    notify() {
        this.listeners.forEach(l => l(this.state));
    }

    getState() {
        return this.state;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        // Initial call
        listener(this.state);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Actions
    async updateReserveSettings(newSettings) {
        this.state.reserveSettings = { ...this.state.reserveSettings, ...newSettings };
        localStorage.setItem('reserveSettings', JSON.stringify(this.state.reserveSettings));
        this.notify();

        if (this.state.user) {
            try {
                await updateUserDocument(this.state.user.uid, { reserveSettings: this.state.reserveSettings });
            } catch (e) {
                console.error("Error syncing reserve settings:", e);
            }
        }
    }

    async updateGoal(newGoal) {
        this.state.dashboard.goal = parseFloat(newGoal);
        localStorage.setItem('dashboardGoal', this.state.dashboard.goal);
        this.notify();

        if (this.state.user) {
            try {
                await updateUserDocument(this.state.user.uid, { dashboardGoal: this.state.dashboard.goal });
            } catch (e) {
                console.error("Error syncing dashboard goal:", e);
            }
        }
    }

    async updateSettings(newSettings) {
        if (!this.state.user) return;

        // Optimistic
        const currentSettings = this.state.user.settings || {};
        const updated = { ...currentSettings, ...newSettings };
        this.state.user.settings = updated;
        this.notify();

        try {
            await updateUserDocument(this.state.user.uid, { settings: updated });
        } catch (e) {
            console.error("Error updating settings:", e);
        }
    }

    async addFixedIncomeAsset(asset) {
        if (!this.state.user) throw new Error("Usuário não autenticado");

        try {
            // Firestore call returns a DocumentReference
            const docRef = await addAsset(this.state.user.uid, asset);

            // Construct return object
            const newAsset = { id: docRef.id, ...asset };

            // Note: No need to push to local state here. 
            // The onSnapshot listener in the constructor handles it automatically.

            return newAsset;
        } catch (e) {
            console.error("Error adding asset:", e);
            throw e;
        }
    }

    async addVariableAsset(asset) {
        if (!this.state.user) throw new Error("Usuário não autenticado");

        // Deduplication Logic: Check if ticker already exists
        const ticker = (asset.ticker || '').toUpperCase();
        const existingAsset = this.state.variableIncome.assets.find(a => (a.ticker || '').toUpperCase() === ticker);

        if (existingAsset) {
            // Merge History
            // asset.history contains the new items (usually length 1)
            const newHistoryItems = asset.history || [];
            if (newHistoryItems.length === 0) return existingAsset; // Nothing to add?

            const updatedHistory = [...existingAsset.history, ...newHistoryItems];

            // Update State Object temporarily to recalculate
            const tempAsset = { ...existingAsset, history: updatedHistory };
            this._recalculateVariableAsset(tempAsset);

            // Persist Update
            try {
                await updateVariableAsset(this.state.user.uid, existingAsset.id, {
                    history: tempAsset.history,
                    qty: tempAsset.qty,
                    investedValue: tempAsset.investedValue,
                    currentBalance: tempAsset.currentBalance,
                    averagePrice: tempAsset.averagePrice,
                    lastUpdate: new Date().toISOString()
                });

                // Update Local State
                Object.assign(existingAsset, tempAsset);
                existingAsset.lastUpdate = tempAsset.lastUpdate;

                this.notify();
                return existingAsset;
            } catch (e) {
                console.error("Error updating existing variable asset:", e);
                throw e;
            }
        } else {
            // Create New
            try {
                const docRef = await addVariableAsset(this.state.user.uid, asset);
                return { id: docRef.id, ...asset };
            } catch (e) {
                console.error("Error adding variable asset:", e);
                throw e;
            }
        }
    }

    async updateVariableAsset(assetId, data) {
        if (!this.state.user) throw new Error("Usuário não autenticado");

        // Optimistic update
        const asset = this.state.variableIncome.assets.find(a => a.id === assetId);
        if (asset) {
            Object.assign(asset, data);
            this.notify();
        }

        try {
            await updateVariableAsset(this.state.user.uid, assetId, data);
        } catch (e) {
            console.error("Error updating variable asset:", e);
            // Revert or throw? For simple meta update, logging is probably enough for now, 
            // but ideally we would revert.
            throw e;
        }
    }

    updateAssetBalance(assetId, newBalance) {
        const asset = this.state.fixedIncome.assets.find(a => a.id === assetId);
        if (asset) {
            const currentVal = parseFloat(newBalance);
            // Only update if changed or if it's the first update
            if (currentVal !== asset.currentBalance) {
                asset.currentBalance = currentVal;

                const now = new Date();
                asset.lastUpdate = now.toISOString();

                // Add to history
                asset.history.push({
                    date: now.toISOString(), // Full ISO for sorting/time
                    type: 'update',
                    value: currentVal
                });

                this.updateDashboardFromAssets();

                // Notify listeners
                this.listeners.forEach(l => l(this.state));

                // Persist to Firestore
                if (this.state.user) {
                    updateAsset(this.state.user.uid, assetId, {
                        currentBalance: asset.currentBalance,
                        history: asset.history,
                        lastUpdate: asset.lastUpdate
                    }).catch(error => {
                        console.error('Error updating asset balance:', error);
                    });
                }
            }
        }
    }

    async removeHistoryItem(assetId, historyIndex) {
        const asset = this.state.fixedIncome.assets.find(a => a.id === assetId);
        if (!asset || !asset.history[historyIndex]) return;

        const item = asset.history[historyIndex];

        // Revert Logic
        if (item.type === 'sell') {
            // Restore what was sold
            const soldQty = item.details?.qty || 0;
            const soldRatio = (item.details?.qty && asset.qty) ? (item.details.qty / asset.qty) : 0;
            // Warning: calculating ratio post-facto is hard because asset.qty is now smaller.
            // Better to just restore values if we can, or reverse the math.

            // If we have exact details:
            if (item.details) {
                asset.qty += item.details.qty;

                // We need to restore Invested and Balance.
                // In sellFromAsset, we reduced them by a ratio.
                // New = Old - (Old * ratio)  => New = Old * (1 - ratio)
                // Old = New / (1 - ratio)
                // Validate this math. 
                // Sell Ratio was calculated based on the Qty AT THE TIME.
                // ratio = soldQty / (currentQty + soldQty)

                const originalQty = asset.qty; // Since we just added it back
                const ratio = soldQty / originalQty;

                if (originalQty > 0 && ratio < 1) {
                    // Reverse the reduction
                    // current = original * (1 - ratio)
                    // original = current / (1 - ratio)

                    // However, float precision issues.
                    // Alternative: We don't know the exact value reduced unless we stored it?
                    // We didn't store the exact reduced amount, only the transaction value.

                    // Approximation:
                    // If we sold 10% of quantity, we should restore asset value by 1 / 0.9 = 1.11...

                    asset.investedValue = asset.investedValue / (1 - ratio);
                    asset.currentBalance = asset.currentBalance / (1 - ratio);
                }
            }
        } else if (item.type === 'buy' || item.type === 'contribution') {
            // Revert contribution
            // Subtract values
            asset.investedValue -= (item.value || 0);
            asset.currentBalance -= (item.value || 0); // Assuming immediate value match
            if (item.details?.qty) {
                asset.qty -= item.details.qty;
            }
        }

        // Remove item
        asset.history.splice(historyIndex, 1);
        asset.lastUpdate = new Date().toISOString();

        this.notify();

        // Firestore Update
        if (this.state.user) {
            try {
                await updateAsset(this.state.user.uid, assetId, {
                    qty: asset.qty,
                    investedValue: asset.investedValue,
                    currentBalance: asset.currentBalance,
                    history: asset.history,
                    lastUpdate: asset.lastUpdate
                });
            } catch (e) { console.error(e); }
        }
    }

    async sellAsset(assetId, sellData) {
        const asset = this.state.fixedIncome.assets.find(a => a.id === assetId);
        if (!asset) return;

        const { date, qty, unitPrice, costs, totalValue } = sellData;
        const sellQty = parseFloat(qty);
        const currentQty = parseFloat(asset.qty) || 0;

        // Validation
        if (sellQty <= 0) return;

        const isTotal = sellQty >= currentQty - 0.0001; // Epsilon for float

        // Calculate Reductions (What is being removed)
        let reducedInvested = 0;
        let reducedBalance = 0;

        if (isTotal) {
            reducedInvested = asset.investedValue;
            reducedBalance = asset.currentBalance;
        } else {
            // Partial
            const sellRatio = currentQty > 0 ? sellQty / currentQty : 0;
            reducedInvested = asset.investedValue * sellRatio;
            reducedBalance = asset.currentBalance * sellRatio;
        }

        const transaction = {
            date: date, // ISO String
            type: 'sell',
            value: totalValue,
            details: {
                qty: sellQty,
                unitPrice: unitPrice,
                costs: costs,
                reducedInvested: reducedInvested,
                reducedBalance: reducedBalance
            }
        };

        if (isTotal) {
            // Liquidate
            asset.currentBalance = 0;
            asset.qty = 0;
            asset.investedValue = 0; // Cleared
            asset.history.push(transaction);
            asset.status = 'liquidated';
            asset.lastUpdate = new Date().toISOString();

            // Optimistic Store Update
            this.state.fixedIncome.closedAssets.push({ ...asset });
            this.state.fixedIncome.assets = this.state.fixedIncome.assets.filter(a => a.id !== assetId);

            if (this.state.user) {
                try {
                    await updateAsset(this.state.user.uid, assetId, {
                        currentBalance: 0,
                        qty: 0,
                        investedValue: 0,
                        status: 'liquidated',
                        history: asset.history,
                        lastUpdate: asset.lastUpdate
                    });
                } catch (e) { console.error(e); }
            }

        } else {
            // Partial Update
            asset.qty = Math.max(0, asset.qty - sellQty);
            asset.investedValue = Math.max(0, asset.investedValue - reducedInvested);
            asset.currentBalance = Math.max(0, asset.currentBalance - reducedBalance);

            asset.history.push(transaction);
            asset.lastUpdate = new Date().toISOString();

            if (this.state.user) {
                try {
                    await updateAsset(this.state.user.uid, assetId, {
                        qty: asset.qty,
                        investedValue: asset.investedValue,
                        currentBalance: asset.currentBalance,
                        history: asset.history,
                        lastUpdate: asset.lastUpdate
                    });
                } catch (e) { console.error(e); }
            }
        }

        this.updateDashboardFromAssets();
        this.notify();
    }

    editAsset(assetId, updatedData) {
        const asset = this.state.fixedIncome.assets.find(a => a.id === assetId);
        if (asset) {
            Object.assign(asset, updatedData);
            this.listeners.forEach(l => l(this.state));
        }
    }

    // Helper to reconstruct state from history
    _recalculateAsset(asset) {
        let qty = 0;
        let invested = 0;
        let balance = 0;

        // Sort chronologically
        const sortedHistory = [...asset.history].sort((a, b) => new Date(a.date) - new Date(b.date));

        for (const h of sortedHistory) {
            if (h.type === 'buy' || h.type === 'contribution') {
                const hQty = h.details?.qty || 0;
                const hVal = h.value || 0;
                qty += hQty;
                invested += hVal;
                balance += hVal;
            } else if (h.type === 'update') {
                // Update overrides balance
                balance = h.value;
            } else if (h.type === 'sell') {
                const sQty = h.details?.qty || h.qty || 0;

                // Balance Reduction
                if (h.details?.reducedBalance !== undefined) {
                    balance -= h.details.reducedBalance;
                } else if (h.details?.unitPrice) {
                    balance -= (sQty * h.details.unitPrice);
                } else {
                    const ratio = qty > 0 ? sQty / qty : 0;
                    balance -= balance * ratio;
                }

                // Invested Reduction
                if (h.details?.reducedInvested !== undefined) {
                    invested -= h.details.reducedInvested;
                } else {
                    const ratio = qty > 0 ? sQty / qty : 0;
                    invested -= invested * ratio;
                }

                qty -= sQty;
            }
        }

        asset.qty = Math.max(0, qty);
        asset.investedValue = Math.max(0, invested);
        asset.currentBalance = Math.max(0, balance);
    }

    async revertSell(assetId) {
        const assetIndex = this.state.fixedIncome.closedAssets.findIndex(a => a.id === assetId);
        if (assetIndex === -1) return;

        const asset = this.state.fixedIncome.closedAssets[assetIndex];

        // Find last sell to remove
        const lastRev = [...asset.history].reverse();
        const lastSellIdx = lastRev.findIndex(h => h.type === 'sell');

        if (lastSellIdx === -1) {
            console.warn('Não foi possível encontrar um resgate para reverter.');
            return;
        }

        const realIndex = asset.history.length - 1 - lastSellIdx;
        asset.history.splice(realIndex, 1);

        // Reconstruct State from remaining history
        this._recalculateAsset(asset);

        // Reset Status
        asset.status = 'active';
        asset.lastUpdate = new Date().toISOString();

        // Optimistic Move
        this.state.fixedIncome.closedAssets.splice(assetIndex, 1);
        this.state.fixedIncome.assets.push(asset);

        this.updateDashboardFromAssets();
        this.notify();

        // Persist
        if (this.state.user && this.state.user.uid) {
            try {
                // Dynamic import not needed if we rely on global/closure, but safe to keep or assume imports
                // store.js has imports at top presumably.
                // But previously I used await updateAsset...
                // existing code uses updateAsset directly.
                await updateAsset(this.state.user.uid, assetId, {
                    qty: asset.qty,
                    investedValue: asset.investedValue,
                    currentBalance: asset.currentBalance,
                    history: asset.history,
                    status: 'active',
                    lastUpdate: asset.lastUpdate
                });
            } catch (e) {
                console.error("Erro ao persistir reversão:", e);
            }
        }
    }

    async revertVariableSell(assetId) {
        // Optimistic update
        const assetIndex = this.state.variableIncome.closedAssets.findIndex(a => a.id === assetId);
        if (assetIndex === -1) throw new Error("Ativo não encontrado nos encerrados.");

        const asset = this.state.variableIncome.closedAssets[assetIndex];

        // Find last sell to remove
        const lastRev = [...asset.history].reverse();
        const lastSellIdx = lastRev.findIndex(h => h.type === 'sell');

        if (lastSellIdx === -1) {
            console.warn('Não foi possível encontrar um resgate para reverter.');
            return;
        }

        const realIndex = asset.history.length - 1 - lastSellIdx;
        asset.history.splice(realIndex, 1);

        // Recalculate Logic
        this._recalculateVariableAsset(asset);

        // Force active status if we have quantity now
        if (asset.qty > 0) {
            asset.status = 'active';
        }

        asset.lastUpdate = new Date().toISOString();

        // Optimistic Move
        this.state.variableIncome.closedAssets.splice(assetIndex, 1);
        this.state.variableIncome.assets.push(asset);

        this.notify();

        // Persist
        if (this.state.user && this.state.user.uid) {
            try {
                await updateVariableAsset(this.state.user.uid, assetId, {
                    qty: asset.qty,
                    investedValue: asset.investedValue,
                    currentBalance: asset.currentBalance,
                    history: asset.history,
                    averagePrice: asset.averagePrice,
                    status: 'active',
                    lastUpdate: asset.lastUpdate
                });
            } catch (e) {
                console.error("Erro ao persistir reversão RV:", e);
                throw e;
            }
        }
    }

    async updatePricesFromSheet() {
        const settings = (this.state.user && this.state.user.settings) || {};
        const csvUrl = settings.sheetCsvUrl || localStorage.getItem('sheetCsvUrl'); // Fallback to local
        if (!csvUrl) throw new Error("URL da planilha não configurada. Vá em Configurações > Integrações.");

        const priceMap = await fetchPrices(csvUrl);

        // Extract dollar quote if available
        let dollarUpdated = false;
        if (priceMap['USDBRL']) {
            this.state.dollarQuote = priceMap['USDBRL'];
            localStorage.setItem('dollarQuote', this.state.dollarQuote); // Persist
            dollarUpdated = true;
        }

        let updatedCount = 0;

        const updatePromises = this.state.variableIncome.assets.map(async (asset) => {
            const ticker = asset.ticker.toUpperCase();
            if (priceMap[ticker] !== undefined) {
                const newPrice = priceMap[ticker];
                const newBalance = asset.qty * newPrice;

                // Only update if changed significantly (epsilon)
                if (Math.abs(asset.currentBalance - newBalance) > 0.001) {
                    asset.currentBalance = newBalance;
                    asset.lastUpdate = new Date().toISOString();

                    // We don't save 'currentPrice' explicitly in asset root usually, 
                    // but we might want to store it for reference if needed. 
                    // For now, Balance is the source of truth for display.

                    // Optimistic update done in memory above.
                    updatedCount++;

                    // Persist
                    if (this.state.user && this.state.user.uid) {
                        await updateVariableAsset(this.state.user.uid, asset.id, {
                            currentBalance: asset.currentBalance,
                            lastUpdate: asset.lastUpdate
                        });
                    }
                }
            }
        });

        await Promise.all(updatePromises);
        this.updateDashboardFromAssets();
        this.notify();
        return {
            updatedCount,
            dollarQuote: this.state.dollarQuote,
            dollarUpdated
        };
    }

    async deleteVariableHistoryItem(assetId, historyIndex) {
        if (!this.state.user) throw new Error("Usuário não autenticado");

        // 1. Find Asset
        const asset = this.state.variableIncome.assets.find(a => a.id === assetId) ||
            this.state.variableIncome.closedAssets.find(a => a.id === assetId);

        if (!asset || !asset.history[historyIndex]) return;

        // 2. Remove Item
        asset.history.splice(historyIndex, 1);
        asset.lastUpdate = new Date().toISOString();

        // 3. Recalculate Logic
        this._recalculateVariableAsset(asset);

        // 4. Notify
        this.notify();

        // 5. Persist
        try {
            await updateVariableAsset(this.state.user.uid, assetId, {
                qty: asset.qty,
                investedValue: asset.investedValue,
                currentBalance: asset.currentBalance,
                history: asset.history,
                averagePrice: asset.averagePrice,
                lastUpdate: asset.lastUpdate,
                status: asset.status || 'active' // In case it gets resurrected or closed (logic handled in recalc?)
            });
        } catch (e) {
            console.error("Error deleting history item:", e);
            throw e;
        }
    }

    async editVariableHistoryItem(assetId, historyIndex, newData) {
        if (!this.state.user) throw new Error("Usuário não autenticado");

        const asset = this.state.variableIncome.assets.find(a => a.id === assetId) ||
            this.state.variableIncome.closedAssets.find(a => a.id === assetId);

        if (!asset || !asset.history[historyIndex]) return;

        // Merge logic: ensure we keep safe fields like date if not provided? 
        // newData usually comes from form { date, type, value, details: {qty, unitPrice, costs} }
        // We'll trust newData fully for the fields it provides.
        Object.assign(asset.history[historyIndex], newData);
        asset.lastUpdate = new Date().toISOString();

        this._recalculateVariableAsset(asset);
        this.notify();

        try {
            await updateVariableAsset(this.state.user.uid, assetId, {
                qty: asset.qty,
                investedValue: asset.investedValue,
                currentBalance: asset.currentBalance,
                history: asset.history,
                averagePrice: asset.averagePrice,
                lastUpdate: asset.lastUpdate
            });
        } catch (e) {
            console.error("Error editing history item:", e);
            throw e;
        }
    }

    _recalculateVariableAsset(asset) {
        let qty = 0;
        let invested = 0; // Total money put in
        let balance = 0; // Not really "Balance" from history, but Current Balance depends on Qty * Price. 
        // Wait, for Variable Income, Balance = Qty * Current Market Price.
        // But if we edit history, we might not know current market price unless stored.
        // Usually we fetch prices. 
        // If we assume `asset.currentBalance` holds the *latest known balance* based on *latest known price*,
        // we should re-derive valid Balance.
        // Current Balance = Current Qty * (Last Known Price).
        // We can deduce Last Known Price from old Balance / old Qty? 
        // Or just don't touch Balance if it's market dependent, ONLY update Qty?
        // BUT, if I delete a BUY, my Balance MUST go down.
        // So: Price = Balance / Qty.

        let currentPrice = (asset.qty > 0 && asset.currentBalance > 0) ? (asset.currentBalance / asset.qty) : 0;

        // Sorting
        const sortedHistory = [...asset.history].sort((a, b) => new Date(a.date) - new Date(b.date));
        asset.history = sortedHistory; // Save sorted? Yes.

        // Standard Weighted Average Price (PM) Calculation
        // PM = Total invested in currently held shares / Qty
        // When selling, PM doesn't change, but invested amount decreases proportionally.

        // Re-run history simulation
        let simQty = 0;
        let simInvested = 0;

        for (const h of sortedHistory) {
            const hQty = parseFloat(h.qty || h.details?.qty || 0);
            const hVal = parseFloat(h.value || 0); // Total formatted value

            if (h.type === 'buy' || h.type === 'contribution') {
                simQty += hQty;
                simInvested += hVal;
            } else if (h.type === 'sell') {
                const sQty = hQty;
                if (simQty > 0) {
                    const pm = simInvested / simQty;
                    const costBasisRemoved = sQty * pm;
                    simInvested -= costBasisRemoved;
                    simQty -= sQty;
                }
            } else if (h.type === 'bonus' || h.type === 'staking') {
                // Bonus/Staking: Adds Qty, Cost is usually 0 (or small tax value if strictly entered, but currently cost input is unitPrice or similar)
                // If payload has unitPrice, it adds to invested?
                // Current UI for bonus has "Custo" field.
                simQty += hQty;
                simInvested += hVal;
            } else if (h.type === 'subscription') {
                // Subscription: Adds Qty, Adds Cost (Invested)
                simQty += hQty;
                simInvested += hVal;
            } else if (h.type === 'split' || h.type === 'inplit') {
                // Split/Inplit: 
                // Legacy: h.details.qty is the delta (new - old).
                // New: h.details.ratio is the multiplier.

                if (h.details && h.details.ratio) {
                    // New Ratio Logic (Safe for Retroactive)
                    simQty = simQty * h.details.ratio;
                } else {
                    // Legacy Delta Logic (Only safe for non-retroactive, kept for compat)
                    const delta = parseFloat(h.qty || h.details?.qty || 0);
                    simQty += delta;
                }
                // Invested unchanged
            }
        }

        // Final values
        asset.qty = Math.max(0, simQty);
        asset.investedValue = Math.max(0, simInvested);
        asset.averagePrice = asset.qty > 0 ? (asset.investedValue / asset.qty) : 0;

        // Recalculate Balance using "Last Known Market Price" we saved, or just leave it?
        // If we deleted a transaction, Qty changed. Balance MUST change.
        // New Balance = New Qty * CurrentPrice
        asset.currentBalance = asset.qty * currentPrice;

        // Check Liquidation
        if (asset.qty <= 0 && asset.investedValue <= 0.01) { // Epsilon
            // Should mark as liquidated? 
            // Maybe user just deleted all transactions. 
            // If manual liquidation is handled via `sellAsset`, this is fine.
            // If we edits history such that qty reaches 0, it technically is liquidated.
            // But for now, keeping it 'active' with 0 balance is safer than automoving it to closed list without explicit action?
            // Let's leave status as is, unless it was 'liquidated' and now has Qty > 0 (Resurrection).
            if (asset.qty > 0 && asset.status === 'liquidated') {
                asset.status = 'active';
            }
        }
    }

    async sellVariableAsset(assetId, sellData) {
        const asset = this.state.variableIncome.assets.find(a => a.id === assetId);
        if (!asset) throw new Error("Ativo não encontrado.");

        const sellItem = {
            date: sellData.date,
            type: 'sell',
            qty: parseFloat(sellData.qty), // for 'sell' type we can store qty directly or in details. 
            // _recalculateVariableAsset checks `h.details?.qty || h.qty`
            // sellData.qty is strictly the amount sold (positive number)
            value: (parseFloat(sellData.qty) * parseFloat(sellData.price)) - parseFloat(sellData.costs || 0), // Net Value? Or Gross?
            // Usually History Value = Cash Flow. Sell = Positive Cash Flow?
            // Contribution Form uses: investedValue (positive).
            // Let's store Total Value of transaction.
            // Recalc logic: `invested -= (sQty * avgPrice)` -> Uses Avg Price, not Sell Price for Invested calc.
            // Sell Price is for Profit/Loss calc (which we might not track deeply yet).
            details: {
                qty: parseFloat(sellData.qty),
                price: parseFloat(sellData.price),
                costs: parseFloat(sellData.costs || 0)
            }
        };

        asset.history.push(sellItem);
        asset.lastUpdate = new Date().toISOString();

        this._recalculateVariableAsset(asset);

        // Liquidation Check
        if (asset.qty <= 0.000001) { // Float tolerance
            asset.status = 'liquidated';
            // Move to closed logic
            const idx = this.state.variableIncome.assets.findIndex(a => a.id === asset.id);
            if (idx !== -1) {
                this.state.variableIncome.assets.splice(idx, 1);
                this.state.variableIncome.closedAssets.push(asset);
                console.log(`Ativo ${asset.ticker} liquidado e movido para encerrados.`);
            } else {
                console.warn(`Ativo ${asset.ticker} marcado como fechado mas não encontrado na lista ativa.`);
            }
        }

        this.updateDashboardFromAssets();
        this.notify();

        // Persist
        if (this.state.user && this.state.user.uid) {
            await updateVariableAsset(this.state.user.uid, asset.id, {
                qty: asset.qty,
                investedValue: asset.investedValue,
                currentBalance: asset.currentBalance,
                history: asset.history,
                averagePrice: asset.averagePrice,
                status: asset.status || 'active',
                lastUpdate: asset.lastUpdate
            });
        }
    }

    // --- PROVENTOS ACTIONS ---

    async addProvento(data) {
        if (!this.state.user) throw new Error("Usuário não autenticado");
        try {
            await addProvento(this.state.user.uid, data);
        } catch (e) {
            console.error("Error adding provento:", e);
            throw e;
        }
    }

    async updateProvento(id, data) {
        if (!this.state.user) throw new Error("Usuário não autenticado");
        try {
            await updateProvento(this.state.user.uid, id, data);
        } catch (e) {
            console.error("Error updating provento:", e);
            throw e;
        }
    }

    async deleteProvento(id) {
        if (!this.state.user) throw new Error("Usuário não autenticado");
        try {
            await deleteProvento(this.state.user.uid, id);
            this.state.proventos = this.state.proventos.filter(p => p.id !== id);
            this.notify();
        } catch (e) {
            console.error("Error deleting provento:", e);
            throw e;
        }
    }

    async addSpecialEvent(assetId, type, payload) {
        // Find asset in Variable Income
        let asset = this.state.variableIncome.assets.find(a => a.id === assetId);
        let isClosed = false;

        // If not found, check closed assets (less likely for events, but possible if reverting?)
        // For now assume active assets only as per modal logic.
        if (!asset) {
            console.error("Asset not found for event");
            return;
        }

        const date = payload.date || new Date().toISOString();
        let historyEntry = {
            date: date,
            type: type, // 'bonus', 'split', 'inplit'
            value: 0, // Default financial flow is 0 unless bonus has cost
            details: {
                qty: 0,
                unitPrice: 0,
                costs: 0
            }
        };

        if (type === 'bonus' || type === 'staking') {
            const qty = type === 'staking' ? payload.stakingQty : payload.bonusQty;
            const cost = type === 'staking' ? (payload.cost || 0) : (payload.bonusCost || 0);

            // Calculate Unit Price of Bonus/Staking
            const unitPrice = qty > 0 ? (cost / qty) : 0;
            const totalValue = cost;

            historyEntry.value = totalValue;
            historyEntry.details.qty = qty;
            historyEntry.details.unitPrice = unitPrice;

            // Update Asset State
            asset.qty += qty;
            asset.investedValue += totalValue;

            // Update Balance logic
            const currentPrice = (asset.qty - qty) > 0 ? (asset.currentBalance / (asset.qty - qty)) : 0;
            if (currentPrice > 0) {
                asset.currentBalance += qty * currentPrice;
            }

        } else if (type === 'subscription') {
            const qty = payload.subQty;
            const cost = payload.subPrice || 0;
            const totalValue = qty * cost;

            historyEntry.value = totalValue;
            historyEntry.details.qty = qty;
            historyEntry.details.unitPrice = cost;

            asset.qty += qty;
            asset.investedValue += totalValue;

            const currentPrice = (asset.qty - qty) > 0 ? (asset.currentBalance / (asset.qty - qty)) : 0;
            if (currentPrice > 0) {
                asset.currentBalance += qty * currentPrice;
            }

        } else if (type === 'split' || type === 'inplit') {

            if (payload.ratio) {
                // New Logic: Store Ratio
                historyEntry.details.ratio = payload.ratio;

                // Update Asset State (Current)
                asset.qty = asset.qty * payload.ratio;

                // Handle Explicit Liquidation (Fractions < 1)
                if (payload.liquidateRemaining) {
                    // We handle the 'sell' event push later, but here we can force 0 qty to match UI immediately?
                    // The subsequent sell event handles the logic, but let's be safe.
                }

            } else {
                // Legacy Logic (NewQty / Delta) - Fallback
                const newQty = payload.newQty;
                const currentQty = asset.qty;
                const delta = newQty - currentQty;

                historyEntry.details.qty = delta;
                asset.qty = newQty;
            }

        } else if (type === 'ticker_change') {
            const newTicker = payload.newTicker;
            const oldTicker = asset.ticker;

            historyEntry.details.oldTicker = oldTicker;
            historyEntry.details.newTicker = newTicker;

            // Update Asset State
            asset.previousTicker = oldTicker;
            asset.ticker = newTicker;
        }

        // Check for Liquidation (Zero Qty) - General Check
        if (asset.qty <= 0) {
            const index = this.state.variableIncome.assets.indexOf(asset);
            if (index > -1) {
                this.state.variableIncome.assets.splice(index, 1);
                asset.status = 'liquidated';
                this.state.variableIncome.closedAssets.push(asset);
                isClosed = true;
            }
        }


        asset.history.push(historyEntry);

        // Handle Explicit Liquidation (Fractions < 1) - Push Sell Event
        if ((type === 'split' || type === 'inplit') && payload.liquidateRemaining) {
            const residualQty = asset.qty; // asset.qty was updated with ratio above
            const liquidationEntry = {
                date: date,
                type: 'sell',
                qty: residualQty,
                value: 0,
                details: {
                    qty: residualQty,
                    price: 0,
                    costs: 0,
                    description: 'Liquidação de Frações'
                }
            };
            asset.history.push(liquidationEntry);
        }

        // Recalculate to ensure Average Price and other derived fields are correct
        this._recalculateVariableAsset(asset);

        asset.lastUpdate = new Date().toISOString();

        // Check for Liquidation (Zero Qty from calculation)
        if (asset.qty <= 0.000001) { // Epsilon check
            const index = this.state.variableIncome.assets.indexOf(asset);
            if (index > -1) {
                this.state.variableIncome.assets.splice(index, 1);
                asset.status = 'liquidated'; // CRITICAL: Mark as liquidated for Firestore Listener
                this.state.variableIncome.closedAssets.push(asset);
                console.log(`Ativo ${asset.ticker} liquidado por evento corporativo.`);
            }
        }

        this.updateDashboardFromAssets();
        this.notify();

        // Persist
        if (this.state.user) {
            try {
                // If closed, we might want to handle it differently, but our store handles closed logic in simple arrays.
                // Firestore peristence just updates the doc.
                await updateVariableAsset(this.state.user.uid, asset.id, asset);
            } catch (e) {
                console.error("Failed to persist event", e);
                // Revert logic would go here
            }
        }
    }

    async deleteAsset(assetId) {
        let isVariable = false;

        // Optimistic update - Fixed Income
        let index = this.state.fixedIncome.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
            this.state.fixedIncome.assets.splice(index, 1);
        } else {
            index = this.state.fixedIncome.closedAssets.findIndex(a => a.id === assetId);
            if (index !== -1) {
                this.state.fixedIncome.closedAssets.splice(index, 1);
            }
        }

        // Optimistic update - Variable Income
        let vIndex = this.state.variableIncome.assets.findIndex(a => a.id === assetId);
        if (vIndex !== -1) {
            this.state.variableIncome.assets.splice(vIndex, 1);
            isVariable = true;
        } else {
            vIndex = this.state.variableIncome.closedAssets.findIndex(a => a.id === assetId);
            if (vIndex !== -1) {
                this.state.variableIncome.closedAssets.splice(vIndex, 1);
                isVariable = true;
            }
        }

        this.updateDashboardFromAssets();
        this.notify();

        // Persist to Firestore
        if (this.state.user && this.state.user.uid) {
            try {
                if (isVariable) {
                    await deleteVariableAsset(this.state.user.uid, assetId);
                } else {
                    await deleteAsset(this.state.user.uid, assetId);
                }
            } catch (error) {
                console.error("Failed to delete asset in Firestore:", error);
            }
        }
    }
    async updateCash(value) {
        this.state.cash = parseFloat(value) || 0;
        localStorage.setItem('userCash', this.state.cash);
        this.updateDashboardFromAssets(); // Recalculate global totals
        this.notify();

        if (this.state.user) {
            try {
                await updateUserDocument(this.state.user.uid, { cash: this.state.cash });
            } catch (e) {
                console.error("Error syncing cash value:", e);
            }
        }
    }

    async updateRebalancingTargets(targets) {
        this.state.rebalancingTargets = targets;
        localStorage.setItem('rebalancingTargets', JSON.stringify(targets));
        this.notify();

        if (this.state.user && this.state.user.uid) {
            try {
                // Use updateUserDocument which merges data
                await updateUserDocument(this.state.user.uid, { rebalancingTargets: targets });
            } catch (e) {
                console.error("Error persisting rebalancing targets:", e);
            }
        }
    }
}

export const store = new Store();
