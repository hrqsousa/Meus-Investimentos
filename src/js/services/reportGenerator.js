import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateReport(state) {
    const doc = new jsPDF();
    const { user, dashboard, fixedIncome, variableIncome, proventos } = state;
    const now = new Date();

    // Formatting Helpers
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatPercent = (val) => `${val.toFixed(2)}%`;
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('pt-BR');
        } catch (e) { return '-'; }
    };
    const formatDateTime = (date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
    const parseVal = (v) => {
        const f = parseFloat(v);
        return isNaN(f) ? 0 : f;
    };

    // ================= HEADER =================
    // Draw Header Background
    doc.setFillColor(41, 128, 185); // Professional Blue
    doc.rect(0, 0, 210, 45, 'F');

    // Add Logo (try/catch safely)
    try {
        const logoUrl = '/pwa-512x512.png';
        doc.addImage(logoUrl, 'PNG', 14, 10, 24, 24);
    } catch (e) {
        console.warn('Logo could not be loaded', e);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Relatório de Patrimônio', 46, 20); // Shift for logo
    doc.setFontSize(12);
    doc.text('Carteira de Investimentos', 46, 28);

    // Right Side Info (Bottom Right)
    doc.setFontSize(9);
    if (user && user.name) {
        doc.text(`Investidor: ${user.name}`, 195, 36, { align: 'right' });
    }
    doc.text(`Gerado em: ${formatDateTime(now)}`, 195, 41, { align: 'right' });

    let currentY = 60;

    // ================= DASHBOARD SUMMARY =================
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text('Resumo Global', 14, currentY);

    currentY += 8;

    const summaryData = [
        ['Patrimônio Total', formatCurrency(dashboard.totalBalance)],
        ['Lucro Acumulado', `${dashboard.profit >= 0 ? '+' : ''}${formatCurrency(dashboard.profit)} (${formatPercent(dashboard.profitPercentage)})`],
        ['Meta de Patrimônio', formatCurrency(dashboard.goal)],
        ['Progresso da Meta', formatPercent(dashboard.goal > 0 ? (dashboard.totalBalance / dashboard.goal) * 100 : 0)]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['Indicador', 'Valor']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
        margin: { left: 14, right: 100 } // Half width
    });

    // ================= ALLOCATION =================
    const allocStartY = currentY;
    const { labels, data, colors } = dashboard.allocation;
    const totalAlloc = data.reduce((a, b) => a + (parseFloat(b) || 0), 0);
    const allocBody = labels.map((label, i) => {
        const val = parseFloat(data[i]) || 0;
        const pct = totalAlloc > 0 ? (val / totalAlloc) * 100 : 0;
        return [label, formatCurrency(val), formatPercent(pct)];
    });

    autoTable(doc, {
        startY: allocStartY,
        head: [['Categoria', 'Valor', '% Cart.']],
        body: allocBody,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 110 } // Right side
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // Common Styles
    const rightAlign = { halign: 'right' };
    const centerAlign = { halign: 'center' };
    const leftAlign = { halign: 'left' };

    // Headers with explicit alignment for Fixed Income
    const fiHeaders = [[
        { content: 'Ativo', styles: leftAlign },
        { content: 'Vencimento', styles: centerAlign },
        { content: 'Investido', styles: rightAlign },
        { content: 'Valor Atual', styles: rightAlign },
        { content: 'Rentabilidade', styles: rightAlign }
    ]];

    // ================= 1. RESERVA DE EMERGÊNCIA =================
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('1. Reserva de Emergência', 14, currentY);
    currentY += 6;

    // FIX: Access .assets
    const allFixed = fixedIncome.assets || [];
    const reserves = allFixed.filter(i => i.isReserve);
    reserves.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    if (reserves.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: fiHeaders,
            body: reserves.map(i => {
                const invested = parseVal(i.investedValue);
                const current = parseVal(i.currentBalance);
                const profit = current - invested;
                const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
                return [
                    i.name || i.indexer || 'Reserva',
                    formatDate(i.dueDate),
                    formatCurrency(invested),
                    formatCurrency(current),
                    `${formatCurrency(profit)} (${formatPercent(profitPct)})`
                ];
            }),
            headStyles: { fillColor: [39, 174, 96] }, // Green
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Nenhum ativo de reserva cadastrado.', 14, currentY + 5);
        currentY += 15;
    }

    // ================= 2. RENDA FIXA (Outros) =================
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('2. Renda Fixa', 14, currentY);
    currentY += 6;

    // Filter out Reserve AND Treasury (check type string safely)
    const rfItems = allFixed.filter(i => !i.isReserve && !((i.type || '').toLowerCase().includes('tesouro')));
    rfItems.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    if (rfItems.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: fiHeaders,
            body: rfItems.map(i => {
                const invested = parseVal(i.investedValue);
                const current = parseVal(i.currentBalance);
                const profit = current - invested;
                const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
                return [
                    i.type || i.indexer || 'Renda Fixa',
                    formatDate(i.dueDate),
                    formatCurrency(invested),
                    formatCurrency(current),
                    `${formatCurrency(profit)} (${formatPercent(profitPct)})`
                ];
            }),
            headStyles: { fillColor: [41, 128, 185] }, // Blue
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Nenhum ativo de Renda Fixa cadastrado.', 14, currentY + 5);
        currentY += 15;
    }

    // ================= 3. TESOURO DIRETO =================
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('3. Tesouro Direto', 14, currentY);
    currentY += 6;

    const treasuryRaw = allFixed.filter(i => (i.type || '').toLowerCase().includes('tesouro'));

    // Consolidate
    const treasuryMap = {};
    treasuryRaw.forEach(i => {
        const name = i.name || i.indexer || i.type || 'Título Tesouro';
        if (!treasuryMap[name]) {
            treasuryMap[name] = {
                name: name,
                dueDate: i.dueDate,
                invested: 0,
                current: 0
            };
        }
        treasuryMap[name].invested += parseVal(i.investedValue);
        treasuryMap[name].current += parseVal(i.currentBalance);
    });

    const treasuryItems = Object.values(treasuryMap);
    treasuryItems.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

    if (treasuryItems.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: fiHeaders,
            body: treasuryItems.map(i => {
                const profit = i.current - i.invested;
                const profitPct = i.invested > 0 ? (profit / i.invested) * 100 : 0;
                return [
                    i.name,
                    formatDate(i.dueDate),
                    formatCurrency(i.invested),
                    formatCurrency(i.current),
                    `${formatCurrency(profit)} (${formatPercent(profitPct)})`
                ];
            }),
            headStyles: { fillColor: [230, 126, 34] }, // Orange
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });
        currentY = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Nenhum título do Tesouro cadastrado.', 14, currentY + 5);
        currentY += 15;
    }

    // ================= 4. RENDA VARIÁVEL =================
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('4. Renda Variável', 14, currentY);
    currentY += 6;

    const rvAssets = variableIncome.assets || [];
    // Filter out closed/liquidated or tiny dust
    const activeRv = rvAssets.filter(a => a.status !== 'closed' && a.status !== 'liquidated' && parseVal(a.qty) > 0.000001);

    const rvGroups = { 'Ação': [], 'FII': [], 'Exterior': [], 'Cripto': [], 'Outros': [] };

    activeRv.forEach(a => {
        let type = (a.type || 'Outros').toLowerCase();

        // Normalize specific types to broad categories
        if (type === 'stock' || type === 'bdr' || type === 'etf exterior') type = 'exterior';

        let key = 'Outros';
        if (type.includes('ação') || type.includes('acao')) key = 'Ação';
        else if (type.includes('fii')) key = 'FII';
        else if (type.includes('exterior')) key = 'Exterior';
        else if (type.includes('cripto') || type.includes('crypto')) key = 'Cripto';

        rvGroups[key].push(a);
    });

    // Headers with explicit alignment for Variable Income
    const rvHeaders = [[
        { content: 'Ativo', styles: leftAlign },
        { content: 'Qtd', styles: centerAlign },
        { content: 'Investido', styles: rightAlign },
        { content: 'Valor Atual', styles: rightAlign },
        { content: 'Rentabilidade', styles: rightAlign }
    ]];

    const renderRvSubTable = (title, items, color) => {
        if (items.length === 0) return;

        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(title, 14, currentY);
        currentY += 4;

        items.sort((a, b) => (a.ticker || '').localeCompare(b.ticker || ''));

        let tInvested = 0;
        let tCurrent = 0;

        const bodyData = items.map(i => {
            // FIX: Correct property names
            const qty = parseVal(i.qty);
            const invested = parseVal(i.investedValue);
            const current = parseVal(i.currentBalance);

            // USD Conversion
            const cur = i.currency || 'BRL';
            const dollarQuote = state.dollarQuote || 0;
            const isUsd = cur === 'USD';

            const finalInvested = isUsd ? invested * dollarQuote : invested;
            const finalCurrent = isUsd ? current * dollarQuote : current;

            tInvested += finalInvested;
            tCurrent += finalCurrent;

            const profit = finalCurrent - finalInvested;
            const profitPct = finalInvested > 0 ? (profit / finalInvested) * 100 : 0;

            return [
                i.ticker,
                qty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 6 }),
                formatCurrency(finalInvested),
                formatCurrency(finalCurrent),
                `${formatCurrency(profit)} (${formatPercent(profitPct)})`
            ];
        });

        const tProfit = tCurrent - tInvested;
        const tProfitPct = tInvested > 0 ? (tProfit / tInvested) * 100 : 0;

        autoTable(doc, {
            startY: currentY,
            head: rvHeaders,
            body: [
                ...bodyData,
                [
                    { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: formatCurrency(tInvested), styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: formatCurrency(tCurrent), styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: `${formatCurrency(tProfit)} (${formatPercent(tProfitPct)})`, styles: { fontStyle: 'bold', halign: 'right' } }
                ]
            ],
            headStyles: { fillColor: color },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });
        currentY = doc.lastAutoTable.finalY + 8;
    };

    renderRvSubTable('4.1 Ações', rvGroups['Ação'], [142, 68, 173]); // Purple-ish
    renderRvSubTable('4.2 FIIs', rvGroups['FII'], [245, 158, 11]); // Amber
    renderRvSubTable('4.3 Exterior', rvGroups['Exterior'], [16, 185, 129]); // Green
    renderRvSubTable('4.4 Cripto', rvGroups['Cripto'], [139, 92, 246]); // Violet
    renderRvSubTable('4.5 Outros', rvGroups['Outros'], [107, 114, 128]); // Gray

    const filename = `Relatorio_Patrimonio_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
