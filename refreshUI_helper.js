window.refreshUI = () => {
    // 1. Refresh Background Views
    if (currentContext === 'renda-variavel') renderRendaVariavel();
    else if (currentContext === 'tesouro') renderTesouro();
    else if (currentContext === 'renda-fixa') renderRendaFixa();
    else if (currentContext === 'reserva') renderReserva();
    else if (window.renderDashboard) window.renderDashboard();

    // 2. Refresh RV Detail Modal if Open
    const detailModal = document.getElementById('rv-detail-modal');
    if (detailModal && !detailModal.classList.contains('hidden') && window.currentRVTicker) {
        // Re-open detail to refresh data
        // Check if asset still exists or has history
        const contributions = window.mockRendaVariavelAssets.filter(a => a.ticker === window.currentRVTicker);
        const history = (window.liquidationHistory || []).filter(h => h.ticker === window.currentRVTicker);

        if (contributions.length === 0 && history.length === 0) {
            // If fully deleted, close detail
            closeRVDetailModal();
        } else {
            openRVDetail(window.currentRVTicker);
        }
    }
};
