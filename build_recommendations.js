const fs = require('fs');
const path = require('path');

// Recommendation Sheet - stable CSV export
const SHEET_ID = '1TKBCVyChwLaNSaBqF0Ts9q4JXUpNHIpbj7ucarqu26s';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

async function buildRecommendations() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csvContent = await res.text();

        const lines = csvContent.trim().split(/\r?\n/);
        if (lines.length < 2) {
            console.log('No data rows found');
            return;
        }

        const rawHeaders = parseCSVLine(lines[0]);
        const headerMap = {};
        rawHeaders.forEach((h, i) => {
            headerMap[h.trim()] = i;
            headerMap[h.trim().toLowerCase()] = i;
        });

        const get = (name) => headerMap[name] ?? headerMap[name.toLowerCase()] ?? -1;

        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = parseCSVLine(line);

            const product = {
                model: values[get('Model Name')] || '',
                baseCode: values[get('Base Code')] || '',
                image: values[get('Key Visual Image')] || '',
                storage: values[get('Storage')] || '',
                colorEn: values[get('Color en_HK')] || '',
                colorZh: values[get('color zh_HK')] || '',
                hexCode: values[get('Hex Code')] || '',
                showInHKBuyPage: (values[get('showInHKBuyPage')] || '').replace(/"/g, '').trim().toUpperCase() === 'TRUE',
                estoreExclusive: values[get('Estore Exclusive')] === 'Y',
                sku: values[get('SKU')] || '',
                rrp: parseInt(values[get('RRP')]) || 0,
                lsvDiscount: parseInt(values[get('LSV Discount')]) || 0,
                InStockStatus: values[get('InStockStatus')] || 'Y',
                oosLink: values[get('oosLink hk')] || '',
                oosLinkEn: values[get('oosLink hk_en')] || '',
                gifts: [
                    values[get('Gift1')] || '',
                    values[get('Gift2')] || '',
                    values[get('Gift3')] || ''
                ].filter(g => g)
            };

            // Only include products that should be shown
            if (product.showInHKBuyPage) {
                products.push(product);
            }
        }

        fs.writeFileSync(
            path.join(__dirname, 'recommendations.json'),
            JSON.stringify({ products }, null, 2),
            'utf8'
        );

        console.log(`✓ Generated recommendations.json with ${products.length} products`);
    } catch (e) {
        console.error('Failed to build recommendations.json:', e.message);
    }
}

buildRecommendations();
