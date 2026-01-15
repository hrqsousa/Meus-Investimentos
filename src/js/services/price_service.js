
/**
 * Service to fetch and parse prices from a Google Sheets CSV.
 * Expected format: Col A = Ticker, Col B = Price (number or string with comma/dot)
 */
export async function fetchPrices(csvUrl) {
    if (!csvUrl) throw new Error("URL da planilha não configurada.");

    try {
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Erro ao acessar planilha: ${response.statusText}`);

        const text = await response.text();
        const lines = text.split('\n');

        const priceMap = {};

        lines.forEach(line => {
            // Google Sheets CSV usually uses comma separator, but depending on locale might vary.
            // We assume standard Published CSV: "Ticker,Price"
            // If price has comma decimal, it might be quoted: "PETR4","35,50"

            // Simple split might fail on quoted values.
            // Let's rely on a basic regex or just simple split if we assume user follows instructions.
            // Instructions said: Col A Ticker, Col B Price.

            // Regex to handle CSV with quotes
            const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!parts || parts.length < 2) return;

            let ticker = parts[0].replace(/['"]/g, '').trim().toUpperCase();
            let priceStr = parts[1].replace(/['"]/g, '').trim();

            // Handle Currency Symbols and Decimal Separators
            // "R$ 35,50" -> 35.50
            // "5.10" -> 5.10

            // Remove currency symbols (R$, US$, $)
            priceStr = priceStr.replace(/[R$US\s]/g, '');

            // Replace comma with dot if present and no other dots (Brazilian format)
            if (priceStr.includes(',') && !priceStr.includes('.')) {
                priceStr = priceStr.replace(',', '.');
            }
            // If it has both (e.g. 1.000,00), remove dot first, then replace comma
            else if (priceStr.includes('.') && priceStr.includes(',')) {
                priceStr = priceStr.replace(/\./g, '').replace(',', '.');
            }

            const price = parseFloat(priceStr);

            if (ticker && !isNaN(price)) {
                priceMap[ticker] = price;
            }
        });

        return priceMap;

    } catch (error) {
        console.error("fetchPrices error:", error);
        throw new Error("Falha ao ler dados da planilha. Verifique o link e o formato.");
    }
}
