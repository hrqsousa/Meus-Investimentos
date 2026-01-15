import { store } from '../store.js';
import { icons } from '../icons.js';
import { Modal } from './Modal.js';
import { CustomSelect } from './CustomSelect.js';
import Chart from 'chart.js/auto';

let evolutionChart = null; // Store chart instance to destroy it
let categoryChart = null;
let currentFilter = 'all'; // all, acao, fii, exterior
let currentPeriod = '1y'; // 6m, 1y, 2y, 5y, 10y, all
let currentFrequency = 'mensal'; // mensal, trimestral, semestral, anual
let proventosModal = null; // Reusable modal instance
let deleteModal = null;
let currentPage = 1;
const itemsPerPage = 25;

export function renderProventos(containerId, onBack) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Reset State on Mount (to match UI defaults)
    currentFilter = 'all';
    currentPeriod = '1y';
    currentFrequency = 'mensal';
    currentPage = 1;

    // Basic Layout
    const html = `
        <div class="proventos-container fade-in">
            <!-- Header with Back Button -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn btn-ghost" id="btn-back-proventos" style="padding: 0.5rem;">
                        ${icons.arrowLeft || '<-'}
                    </button>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Meus Proventos</h2>
                </div>
                <button class="btn btn-primary" id="btn-add-provento">
                    ${icons.plus} Inserir Proventos
                </button>
            </div>

            <!-- Dashboard Cards -->
            <div id="proventos-dashboard" style="margin-bottom: 2rem;">
                <!-- Filled via JS -->
            </div>

            <!-- Charts Section -->
            <div class="card" style="margin-bottom: 2rem;">
                <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
                    <span class="card-title">${icons.chart || ''} Evolução e Composição</span>
                    
                    <div style="margin-left: auto; display: flex; gap: 0.5rem;">
                         <select id="select-freq" class="input" style="width: auto; padding: 4px 8px;">
                            <option value="mensal">Mensal</option>
                            <option value="trimestral">Trimestral</option>
                            <option value="semestral">Semestral</option>
                            <option value="anual">Anual</option>
                         </select>
                         <select id="select-period" class="input" style="width: auto; padding: 4px 8px;">
                            <option value="6m">6 Meses</option>
                            <option value="1y" selected>1 Ano</option>
                            <option value="2y">2 Anos</option>
                            <option value="5y">5 Anos</option>
                            <option value="10y">10 Anos</option>
                            <option value="all">Tudo</option>
                         </select>
                    </div>
                </div>

                <div style="height: 300px; position: relative; margin-bottom: 2rem;">
                    <canvas id="evolutionChart"></canvas>
                </div>

                <h4 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase;">Proventos por Categoria</h4>
                <div style="height: 60px; position: relative;">
                    <!-- Custom HTML pill chart or Canvas? Requirement says "pill". Let's use simple HTML progress bar style first, or simple stacked bar chart. -->
                    <div id="category-pill-chart" style="width: 100%; height: 100%;"></div>
                </div>
            </div>

            <!-- History Section -->
            <div class="card">
                <div class="card-header">
                    <span class="card-title" style="border-left: 4px solid var(--primary-color); padding-left: 0.5rem;">Histórico de Proventos</span>
                </div>
                 <!-- Filters -->
                <div class="tabs-container" style="display: flex; gap: 0.5rem; margin: 1rem 0 1.5rem; padding: 0 1.5rem;">
                    <button class="btn btn-primary proventos-filter" data-filter="all">Todos</button>
                    <button class="btn btn-ghost proventos-filter" data-filter="acao">Ações</button>
                    <button class="btn btn-ghost proventos-filter" data-filter="fii">FIIs</button>
                    <button class="btn btn-ghost proventos-filter" data-filter="exterior">Exterior</button>
                </div>

                <div id="proventos-history-list" style="overflow-x: auto;">
                    <!-- Table -->
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Event Listeners
    container.querySelector('#btn-back-proventos').addEventListener('click', () => {
        if (typeof onBack === 'function') onBack();
    });

    container.querySelector('#btn-add-provento').addEventListener('click', () => {
        openProventoModal();
    });

    // Filter Listeners
    container.querySelectorAll('.proventos-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target;
            container.querySelectorAll('.proventos-filter').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-ghost');
            });
            target.classList.remove('btn-ghost');
            target.classList.add('btn-primary');
            currentFilter = target.dataset.filter;
            currentPage = 1; // Reset pagination logic
            updateUI();
        });
    });

    // Chart Selectors
    container.querySelector('#select-freq').addEventListener('change', (e) => {
        currentFrequency = e.target.value;
        updateCharts();
    });
    container.querySelector('#select-period').addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        updateCharts();
    });

    // Initial Render
    updateUI();

    // Subscribe to store updates implicitly?
    // Usually the parent component re-renders us on store change, or we subscribe.
    // Ideally we should subscribe here.
    const unsubscribe = store.subscribe(() => {
        // Only update if we are still in DOM
        if (document.getElementById('evolutionChart')) {
            updateUI();
        }
    });
    // Cleanup unsubscribe when component destroyed? Hard to know when destroyed in this pattern.
}

function updateCharts() {
    const state = store.getState();
    const allProventos = state.proventos || [];
    renderChartsData(allProventos);
}

function updateUI() {
    const state = store.getState();
    const allProventos = state.proventos || [];

    // Filter Data
    let filtered = allProventos;
    if (currentFilter !== 'all') {
        filtered = allProventos.filter(p => {
            const cat = (p.category || '').toLowerCase();
            if (currentFilter === 'acao') return cat === 'acao' || cat === 'ação';
            if (currentFilter === 'fii') return cat === 'fii';
            if (currentFilter === 'exterior') return cat === 'exterior';
            return false;
        });
    }

    renderCards(allProventos); // Cards usually show TOTAL info, but maybe affected by filters? Requirement 5 says: "Esses filtros também alteram os dois gráficos...". It doesn't explicitly say cards.
    // "1. Dashboard inicial... 5. Abaixo... com filtros... Esses filtros também alteram os dois gráficos...". 
    // Usually filters affect everything below them or specifically linked. 
    // The filters are physically located in the "History" section (Point 5), but they affect "os dois gráficos que ficam acima".
    // It doesn't imply they affect the Dashboard Cards at the very top. So I'll keep Cards global.

    // Wait, if I filter by "Actions", shouldn't graphs show only "Actions"? Yes.
    // Should history show only actions? Yes.

    renderChartsData(allProventos); // Pass all data, filter inside based on global active filter + time params
    renderHistoryTable(filtered);
}

function renderCards(proventos) {
    const container = document.getElementById('proventos-dashboard');
    if (!container) return;

    // Logic for cards
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let total = 0;
    let last12m = 0;
    let ytd = 0;
    let lastMonthVal = 0;
    let thisMonthVal = 0;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    proventos.forEach(p => {
        const d = new Date(p.date); // "YYYY-MM-DD"
        // Adjust timezone if needed? "YYYY-MM-DD" usually parsed as UTC in JS if not careful, 
        // but new Date('2024-01-01') is UTC. 
        // We want local date. Simple string split is safer for YMD.
        // Or assume p.date is ISO or "YYYY-MM-DD".
        // Let's use string operations for safety.

        const [y, m, day] = p.date.split('-').map(Number);
        const pDate = new Date(y, m - 1, day);

        const val = parseFloat(p.value) || 0;

        total += val;

        if (pDate >= oneYearAgo && pDate <= now) {
            last12m += val;
        }

        if (y === currentYear) {
            ytd += val;
        }

        if (y === currentYear && m - 1 === currentMonth) {
            thisMonthVal += val;
        }

        // Last month logic (handle year transition)
        const lm = currentMonth === 0 ? 11 : currentMonth - 1;
        const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
        if (y === ly && m - 1 === lm) {
            lastMonthVal += val;
        }
    });

    const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Comparison
    let compass = 0;
    if (lastMonthVal > 0) {
        compass = ((thisMonthVal - lastMonthVal) / lastMonthVal) * 100;
    } else if (thisMonthVal > 0) {
        compass = 100;
    }

    const compassColor = compass >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    const compassIcon = compass >= 0 ? '▲' : '▼'; // Simple icon

    container.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; width: 100%;">
            <!-- Total -->
            <div class="card" style="flex: 1; min-width: 150px; padding: 1rem;">
                <div class="card-header" style="margin-bottom: 0.5rem;"><span class="card-title" style="font-size: 0.75rem;">TOTAL RECEBIDO</span> ${icons.landmark || ''}</div>
                <div class="card-value" style="font-size: 1.1rem;">${formatBRL(total)}</div>
            </div>
             <!-- 12m -->
             <div class="card" style="flex: 1; min-width: 150px; padding: 1rem;">
                <div class="card-header" style="margin-bottom: 0.5rem;"><span class="card-title" style="font-size: 0.75rem;">ÚLTIMOS 12 MESES</span></div>
                <div class="card-value" style="font-size: 1.1rem; color: var(--primary-color);">${formatBRL(last12m)}</div>
            </div>
             <!-- YTD -->
             <div class="card" style="flex: 1; min-width: 150px; padding: 1rem;">
                <div class="card-header" style="margin-bottom: 0.5rem;"><span class="card-title" style="font-size: 0.75rem;">ESTE ANO (YTD)</span></div>
                <div class="card-value" style="font-size: 1.1rem; color: var(--success-color);">${formatBRL(ytd)}</div>
            </div>
            <!-- Last Month -->
            <div class="card" style="flex: 1; min-width: 150px; padding: 1rem;">
                 <div class="card-header" style="margin-bottom: 0.5rem;"><span class="card-title" style="font-size: 0.75rem;">MÊS PASSADO</span></div>
                 <div class="card-value" style="font-size: 1.1rem; color: var(--text-secondary);">${formatBRL(lastMonthVal)}</div>
            </div>
             <!-- This Month -->
             <div class="card" style="flex: 1; min-width: 150px; padding: 1rem;">
                 <div class="card-header" style="margin-bottom: 0.5rem;"><span class="card-title" style="font-size: 0.75rem;">ESTE MÊS</span></div>
                 <div style="display: flex; align-items: baseline; gap: 8px;">
                     <div class="card-value" style="font-size: 1.1rem; color: darkorange;">${formatBRL(thisMonthVal)}</div>
                     ${compass !== 0 ? `<span style="font-size: 0.7rem; color: ${compassColor}; font-weight: 700; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px;">${compass.toFixed(1)}%</span>` : ''}
                 </div>
            </div>
        </div>
    `;
}

function renderChartsData(allProventos) {
    // 1. Filter by Category (currentFilter)
    let data = allProventos;
    if (currentFilter !== 'all') {
        data = allProventos.filter(p => {
            const cat = (p.category || '').toLowerCase();
            if (currentFilter === 'acao') return cat === 'acao' || cat === 'ação';
            if (currentFilter === 'fii') return cat === 'fii';
            if (currentFilter === 'exterior') return cat === 'exterior';
            return false;
        });
    }

    // 2. Filter by Period (6m, 1y, etc) for Evolution Chart
    // Sort by date
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine Start Date
    const now = new Date();
    let startDate = new Date();
    if (currentPeriod === '6m') startDate.setMonth(now.getMonth() - 6);
    else if (currentPeriod === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else if (currentPeriod === '2y') startDate.setFullYear(now.getFullYear() - 2);
    else if (currentPeriod === '5y') startDate.setFullYear(now.getFullYear() - 5);
    else if (currentPeriod === '10y') startDate.setFullYear(now.getFullYear() - 10);
    else startDate = new Date(0); // All time

    const rangeData = data.filter(p => new Date(p.date) >= startDate);

    // Grouping by Frequency
    // buckets key: "YYYY-MM" or "YYYY-QX" etc
    const buckets = {};

    rangeData.forEach(p => {
        const d = new Date(p.date);
        let key = '';
        if (currentFrequency === 'mensal') {
            key = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} `;
        } else if (currentFrequency === 'anual') {
            key = `${d.getFullYear()} `;
        } else {
            // TODO: Trimestral/Semestral
            // Trimestral: Q1 (0-2), Q2 (3-5), Q3 (6-8), Q4 (9-11)
            const q = Math.floor(d.getMonth() / 3) + 1;
            key = currentFrequency === 'trimestral' ? `${d.getFullYear()} -Q${q} ` : `${d.getFullYear()} -S${Math.floor(d.getMonth() / 6) + 1} `;
        }

        if (!buckets[key]) buckets[key] = { total: 0, items: [] };
        buckets[key].total += parseFloat(p.value) || 0;
        buckets[key].items.push(p);
    });

    const labels = Object.keys(buckets).sort();
    const values = labels.map(k => buckets[k].total);

    // Top Payers Logic for Tooltip
    // We can pre-calculate or calculate on hover. 
    // Let's store logic in the chart callback.

    // --- EVOLUTION CHART ---
    const ctxEvo = document.getElementById('evolutionChart');
    if (ctxEvo) {
        if (evolutionChart) evolutionChart.destroy();

        evolutionChart = new Chart(ctxEvo, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Proventos Recebidos',
                    data: values,
                    backgroundColor: '#10b981',
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function (context) {
                                // Default label behavior
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                }
                                return label;
                            },
                            afterBody: (context) => {
                                // Logic to find top payers for this bucket
                                const idx = context[0].dataIndex;
                                const key = labels[idx];
                                const bucketItems = buckets[key].items; // Array of proventos

                                // Group by Ticker
                                const totals = {};
                                bucketItems.forEach(i => {
                                    totals[i.ticker] = (totals[i.ticker] || 0) + (parseFloat(i.value) || 0);
                                });

                                // Sort and Take Top 7
                                const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 7);

                                const lines = [' ', 'Maiores Pagadores:'];
                                sorted.forEach(s => {
                                    const val = s[1].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                    lines.push(`${s[0]}: ${val}`);
                                });

                                return lines;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } }, // Cleaner look
                    y: { border: { display: false } }
                }
            }
        });
    }

    // --- CATEGORY PILL CHART ---
    // This chart shows the distribution of the CURRENT FILTERED VIEW or GLOBAL?
    // "Embaixo desse gráfico, um gráfico... com os proventos por categoria".
    // If filter is specific (e.g. Acoes), this chart would be 100% Acoes. 
    // That's fine, it provides visual confirmation.

    // Calculate category totals from `rangeData` (Filtered by time range)
    const catTotals = { acao: 0, fii: 0, exterior: 0 };
    let grandTotal = 0;

    rangeData.forEach(p => {
        const cat = (p.category || 'acao').toLowerCase();
        const v = parseFloat(p.value) || 0;
        grandTotal += v;

        if (cat.includes('ação') || cat === 'acao') catTotals.acao += v;
        else if (cat.includes('fii')) catTotals.fii += v;
        else if (cat.includes('exterior')) catTotals.exterior += v;
    });

    const pillContainer = document.getElementById('category-pill-chart');
    if (pillContainer) {
        if (grandTotal === 0) {
            pillContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding-top: 1rem;">Sem dados no período</div>';
        } else {
            const pctAcao = (catTotals.acao / grandTotal) * 100;
            const pctFii = (catTotals.fii / grandTotal) * 100;
            const pctExt = (catTotals.exterior / grandTotal) * 100;

            // Colors
            const cAcao = '#10b981'; // Greenish
            const cFii = '#3b82f6'; // Blue
            const cExt = '#8b5cf6'; // Purple

            const formatMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            pillContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.8rem; font-weight: 600;">
            ${pctAcao > 0 ? `<span style="color: ${cAcao}">AÇÕES: ${formatMoney(catTotals.acao)} (${pctAcao.toFixed(1)}%)</span>` : '<span></span>'}
                     ${pctFii > 0 ? `<span style="color: ${cFii}">FIIS: ${formatMoney(catTotals.fii)} (${pctFii.toFixed(1)}%)</span>` : '<span></span>'}
                     ${pctExt > 0 ? `<span style="color: ${cExt}">EXTERIOR: ${formatMoney(catTotals.exterior)} (${pctExt.toFixed(1)}%)</span>` : '<span></span>'}
                </div>
        <div style="display: flex; height: 24px; border-radius: 12px; overflow: hidden; width: 100%;">
            ${pctAcao > 0 ? `<div style="width: ${pctAcao}%; background: ${cAcao};" title="Ações"></div>` : ''}
            ${pctFii > 0 ? `<div style="width: ${pctFii}%; background: ${cFii};" title="FIIs"></div>` : ''}
            ${pctExt > 0 ? `<div style="width: ${pctExt}%; background: ${cExt};" title="Exterior"></div>` : ''}
        </div>
    `;
        }
    }
}

function renderHistoryTable(list) {
    const tableDiv = document.getElementById('proventos-history-list');
    if (!tableDiv) return;

    if (list.length === 0) {
        tableDiv.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhum registro encontrado.</div>';
        return;
    }

    // Sort Descending Date
    const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination Logic
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = sorted.slice(startIndex, startIndex + itemsPerPage);

    // Ref: "colunas indicando a data, ativo, categoria ..., evento ..., valor Recebido, e botão de ação"

    // Helper Maps
    const catMap = { 'acao': 'Ação', 'fii': 'FII', 'exterior': 'Exterior' };

    const html = `
        <div style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem; text-align: right;">
            Exibindo ${startIndex + 1}-${Math.min(startIndex + itemsPerPage, sorted.length)} de ${sorted.length}
        </div>
        <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
            <thead>
                <tr style="text-align: left; color: var(--text-secondary); font-size: 0.85rem; border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 1rem;">DATA</th>
                    <th style="padding: 1rem;">ATIVO</th>
                    <th style="padding: 1rem;">CATEGORIA</th>
                    <th style="padding: 1rem;">EVENTO</th>
                    <th style="padding: 1rem; text-align: right;">VALOR RECEBIDO</th>
                    <th style="padding: 1rem; text-align: center;">AÇÕES</th>
                </tr>
            </thead>
            <tbody>
                ${paginatedItems.map(item => {
        const isUSD = (item.currency || 'BRL').trim().toUpperCase() === 'USD';
        let valHtml = '';

        if (isUSD) {
            const original = parseFloat(item.originalValue) || 0;
            const tax = parseFloat(item.taxes) || 0;
            const netUSD = Math.max(0, original - tax);
            const netBRL = parseFloat(item.value) || 0;

            valHtml = `
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <span style="font-weight: 700; color: var(--success-color);">US$ ${netUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">R$ ${netBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        `;
        } else {
            valHtml = `R$ ${parseFloat(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        return `
                    <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
                         <td style="padding: 1rem;">${(() => {
                const parts = item.date.split('-');
                if (parts.length < 3) return item.date;
                return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('pt-BR');
            })()}</td>
                         <td style="padding: 1rem; font-weight: 700;">${item.ticker}</td>
                         <td style="padding: 1rem;">
                            <span style="background: var(--bg-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
                                ${catMap[(item.category || '').toLowerCase()] || item.category}
                            </span>
                         </td>
                         <td style="padding: 1rem;">${item.event}</td>
                         <td style="padding: 1rem; text-align: right; font-weight: 600; color: var(--success-color);">
                            ${valHtml}
                         </td>
                         <td style="padding: 1rem; text-align: center;">
                             <button class="btn btn-icon btn-edit-p" data-id="${item.id}" style="color: var(--primary-color);">
                                ${icons.edit || '✎'}
                             </button>
                             <button class="btn btn-icon btn-del-p" data-id="${item.id}" style="color: var(--danger-color);">
                                ${icons.trash || '🗑'}
                             </button>
                         </td>
                    </tr>
                `;
    }).join('')}
            </tbody>
        </table>

        <!-- Pagination Controls -->
        ${totalPages > 1 ? `
        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem;">
            <button id="btn-page-prev" class="btn btn-ghost" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                ${icons.arrowLeft || '<'}
            </button>
            <span style="color: var(--text-secondary); font-size: 0.9rem;">
                Página <strong>${currentPage}</strong> de ${totalPages}
            </span>
            <button id="btn-page-next" class="btn btn-ghost" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                ${icons.arrowRight || '>'}
            </button>
        </div>
        ` : ''}
    `;
    tableDiv.innerHTML = html;

    // Actions Listeners
    tableDiv.querySelectorAll('.btn-del-p').forEach(btn => {
        btn.addEventListener('click', () => {
            showDeleteConfirmation(btn.dataset.id);
        });
    });

    tableDiv.querySelectorAll('.btn-edit-p').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const item = list.find(l => l.id === id);
            if (item) openProventoModal(item);
        });
    });

    // Pagination Listeners
    const btnPrev = tableDiv.querySelector('#btn-page-prev');
    const btnNext = tableDiv.querySelector('#btn-page-next');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderHistoryTable(list); // Re-render with new page
                // Scroll to table top
                tableDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderHistoryTable(list);
                tableDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

// Modal Logic
function openProventoModal(editingItem = null) {
    if (!proventosModal) proventosModal = new Modal();

    const isEdit = !!editingItem;

    // HTML Form
    const content = `
        <form id="form-provento" style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                     <label class="form-label">Data</label>
                     <input type="date" class="form-input" name="date" required value="${editingItem ? editingItem.date : new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                     <label class="form-label">Ativo (Ticker)</label>
                     <input type="text" class="form-input" name="ticker" required placeholder="Ex: PETR4" value="${editingItem ? editingItem.ticker : ''}" style="text-transform: uppercase;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                     <label class="form-label">Categoria</label>
                     <div id="sel-cat-container"></div>
                </div>
                <div class="form-group">
                     <label class="form-label">Evento</label>
                     <div id="sel-event-container"></div>
                </div>
            </div>

            <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
                 <label class="form-label" style="margin-bottom: 0;">Moeda (USD)</label>
                 <!-- Switch Component -->
                 <label class="switch">
                    <input type="checkbox" id="currency-toggle">
                    <span class="slider round"></span>
                 </label>
            </div>

            <!-- USD Specific Fields (Hidden by default) -->
            <div id="usd-container" style="display: none; padding: 1.25rem; border-radius: var(--radius-md); background: #f8fafc; border: 1px solid var(--border-color); margin-bottom: 0.5rem;">
                 <h4 style="margin: 0 0 1rem; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Detalhes em Dólar</h4>
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                         <label class="form-label">Valor Bruto (US$)</label>
                         <input type="text" class="form-input money-input" name="valueUSD" placeholder="0,00" data-prefix="US$ ">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                         <label class="form-label">Impostos (US$)</label>
                         <input type="text" class="form-input money-input" name="taxUSD" placeholder="0,00" data-prefix="US$ ">
                    </div>
                 </div>
                 <!-- Quote Moved Here -->
                 <div class="form-group" id="quote-group">
                    <label class="form-label">Cotação (R$)</label>
                    <input type="text" class="form-input quote-input" name="quote" placeholder="0,0000" value="${store.getState().dollarQuote ? store.getState().dollarQuote.toFixed(4).replace('.', ',') : '5,0000'}">
                 </div>
            </div>

            <!-- Net Value (Row) -->
            <div class="form-group" id="net-value-group">
                 <label class="form-label" id="label-net-value">Valor Líquido (R$)</label>
                 <div style="position: relative;">
                    <input type="text" class="form-input money-input" name="valueFinal" required placeholder="0,00" style="font-size: 1.1rem; font-weight: 600; color: var(--success-color);" data-prefix="R$ ">
                    <div id="converted-preview" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.85rem; color: var(--text-secondary); display: none;">
                        ~ R$ 0,00
                    </div>
                 </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button type="button" class="btn btn-ghost" id="btn-cancel" style="padding: 0.75rem 1.5rem;">Cancelar</button>
                <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 600;">Salvar</button>
            </div>
        </form>
    `;

    proventosModal.open(isEdit ? 'Editar Provento' : 'Inserir Proventos', content);

    // Form Interactions
    const form = document.getElementById('form-provento');

    // MASK HELPERS
    // 1. Standard Money Mask (2 decimals)
    const applyMask = (e) => {
        let prefix = e.target.dataset.prefix || '';
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            e.target.value = '';
            calculate();
            return;
        }
        value = (parseInt(value) / 100).toFixed(2) + '';
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        e.target.value = prefix + value;
        calculate();
    };

    // 2. Quote Mask (4 decimals)
    const applyQuoteMask = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            e.target.value = '';
            calculate();
            return;
        }
        // Divide by 10000 for 4 decimal places
        value = (parseInt(value) / 10000).toFixed(4) + '';
        value = value.replace('.', ',');
        // Optional: add thousand separator if quote > 999 (unlikely for BRL/USD but good practice)
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        e.target.value = value;
        calculate();
    };

    // Helper: Parse money with any prefix
    const parseMasked = (str) => {
        if (!str) return 0;
        let clean = str.replace(/[^\d,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const formatMoney = (val, prefix = 'R$ ') => {
        if (!val && val !== 0) return '';
        let str = val.toFixed(2).replace('.', ',');
        str = str.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        return prefix + str;
    };

    // Apply masks
    form.querySelectorAll('.money-input').forEach(inp => {
        inp.addEventListener('input', applyMask);
    });

    // Apply quote mask
    form.querySelectorAll('.quote-input').forEach(inp => {
        inp.addEventListener('input', applyQuoteMask);
    });

    // Custom Selects
    const catOptions = [
        { value: 'acao', label: 'Ação' },
        { value: 'fii', label: 'FII' },
        { value: 'exterior', label: 'Exterior' }
    ];

    // Logic Handler for Category Change
    const handleCatChange = (val) => {
        if (val === 'fii') {
            eventSelect.select('Rendimento', 'Rendimento');
        } else if (val === 'exterior') {
            eventSelect.select('Dividendo', 'Dividendo');
            toggle.checked = true; // Auto-switch to USD
            toggleCurrency(true);
        }
    };

    const catSelect = new CustomSelect('sel-cat-container', catOptions, handleCatChange, editingItem?.category || 'acao');

    const eventOptions = [
        { value: 'Dividendo', label: 'Dividendo' },
        { value: 'JCP', label: 'JCP' },
        { value: 'Rendimento', label: 'Rendimento' },
        { value: 'Bonificação', label: 'Bonificação' },
        { value: 'Outros', label: 'Outros' }
    ];
    const eventSelect = new CustomSelect('sel-event-container', eventOptions, null, editingItem?.event || 'Dividendo');

    // DOM Elements - Using the new IDs from the HTML update
    const toggle = form.querySelector('#currency-toggle');
    const usdContainer = form.querySelector('#usd-container');
    const quoteGroup = form.querySelector('#quote-group');
    const netValueGroup = form.querySelector('#net-value-group');
    const labelNetValue = form.querySelector('#label-net-value');

    const inputFinal = form.querySelector('input[name="valueFinal"]');
    const inputUSD = form.querySelector('input[name="valueUSD"]');
    const inputTax = form.querySelector('input[name="taxUSD"]');
    const inputQuote = form.querySelector('input[name="quote"]');
    const previewText = form.querySelector('#converted-preview');

    // Auto sets
    // Auto sets
    if (editingItem) {
        const cur = (editingItem.currency || 'BRL').trim().toUpperCase();
        if (cur === 'USD') {
            toggle.checked = true;
            toggleCurrency(true);

            // Populate USD Fields
            inputUSD.value = formatMoney(editingItem.originalValue || 0, 'US$ ');
            inputTax.value = formatMoney(editingItem.taxes || 0, 'US$ ');

            // Quote (handle 4 decimals)
            const q = editingItem.quote || 1;
            inputQuote.value = q.toFixed(4).replace('.', ',');

            // Recalculate to set inputFinal correctly (readonly)
            calculate();
        } else {
            // BRL
            inputFinal.value = formatMoney(editingItem.value);
        }
    }

    // Toggle Listener
    toggle.addEventListener('change', (e) => {
        toggleCurrency(e.target.checked);
    });

    function toggleCurrency(isUSD) {
        if (!labelNetValue) return; // Safety

        if (isUSD) {
            usdContainer.style.display = 'block';
            if (quoteGroup) quoteGroup.style.display = 'block';

            labelNetValue.textContent = 'Valor Líquido (US$)';
            inputFinal.dataset.prefix = 'US$ ';
            inputFinal.readOnly = true;
            inputFinal.placeholder = "0,00";
            // Optional: style change for read-only to look "active" but calculated?
            inputFinal.style.opacity = '1'; // Ensure it's not too dim if we want it readable
            inputFinal.style.backgroundColor = 'var(--bg-hover)'; // Slight grey background

            if (previewText) previewText.style.display = 'block';

            calculate();
        } else {
            usdContainer.style.display = 'none';
            // Quote is inside usdContainer, so it hides with it. OLD quoteGroup logic might need check.
            // Wait, previous code had quoteGroup styled display none/block.
            // Now quoteGroup IS inside usdContainer which IS hidden.
            // So we don't strictly need to toggle quoteGroup display individually, but harmless to leave logic or remove it.
            // Let's rely on usdContainer hiding everything inside.

            labelNetValue.textContent = 'Valor Líquido (R$)';
            inputFinal.dataset.prefix = 'R$ ';
            inputFinal.readOnly = false;
            inputFinal.style.backgroundColor = ''; // Reset
            if (previewText) previewText.style.display = 'none';
        }
    }

    // Calculation Logic
    function calculate() {
        if (!toggle.checked) return; // Manual BRL mode

        const vUSD = parseMasked(inputUSD.value);
        const tax = parseMasked(inputTax.value);

        // Custom parse for Quote (may not have prefix, but has comma)
        const quote = parseMasked(inputQuote.value);

        const netUSD = Math.max(0, vUSD - tax);

        // Update Net Value Input (USD)
        const valStr = netUSD.toFixed(2).replace('.', ',');
        const fmtVal = valStr.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        inputFinal.value = 'US$ ' + fmtVal;

        // Update BRL Preview
        const totalBRL = netUSD * quote;
        if (previewText) previewText.textContent = `~ ${totalBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    }

    inputQuote.addEventListener('input', calculate);

    // Cancel
    document.getElementById('btn-cancel').addEventListener('click', () => proventosModal.close());

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        // Final Value Logic
        let finalValueBRL = 0;
        if (toggle.checked) {
            const vUSD = parseMasked(inputUSD.value);
            const tax = parseMasked(inputTax.value);
            const quote = parseMasked(inputQuote.value);
            const netUSD = Math.max(0, vUSD - tax);
            finalValueBRL = netUSD * quote;
        } else {
            finalValueBRL = parseMasked(inputFinal.value);
        }

        const data = {
            date: fd.get('date'),
            ticker: fd.get('ticker').toUpperCase(),
            category: catSelect.getValue(),
            event: eventSelect.getValue(),
            value: finalValueBRL
        };

        try {
            if (isEdit) {
                await store.updateProvento(editingItem.id, data);
            } else {
                await store.addProvento(data);
            }
            proventosModal.close();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    });
}

function showDeleteConfirmation(id) {
    if (!deleteModal) deleteModal = new Modal();

    const html = `
        <div style="padding: 1.5rem 1rem 1rem 1rem; text-align: center;">
             <div style="width: 64px; height: 64px; margin: 0 auto 1.5rem auto; display: flex; align-items: center; justify-content: center; background: rgba(220, 53, 69, 0.1); border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </div>
            
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1.25rem;">Excluir Provento?</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
                Tem certeza que deseja excluir este registro?<br>
                Esta ação não pode ser desfeita.
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <button id="btn-cancel-delete" class="btn btn-ghost" style="justify-content: center;">Cancelar</button>
                <button id="btn-confirm-delete" class="btn btn-danger" style="justify-content: center;">Excluir</button>
            </div>
        </div>
    `;

    deleteModal.open('Confirmar Exclusão', html);

    // Hide the header title visually if desired, or keep it.
    // Ideally we remove the header from DOM for this modal instance, but Modal.js is shared.
    // Custom style injection to hide header for this modal?
    // Let's keep the title 'Confirmar Exclusão' as it is standard.

    setTimeout(() => {
        const btnCancel = document.getElementById('btn-cancel-delete');
        const btnConfirm = document.getElementById('btn-confirm-delete');

        if (btnCancel) {
            btnCancel.onclick = () => deleteModal.close();
        }

        if (btnConfirm) {
            btnConfirm.onclick = async () => {
                const originalText = btnConfirm.innerHTML;
                btnConfirm.innerHTML = 'Excluindo...';
                btnConfirm.disabled = true;

                try {
                    await store.deleteProvento(id);
                    deleteModal.close();
                } catch (e) {
                    console.error(e);
                    alert("Erro ao excluir: " + e.message);
                    btnConfirm.innerHTML = originalText;
                    btnConfirm.disabled = false;
                }
            };
        }
    }, 50);
}
