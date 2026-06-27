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

async function fetchStockStatus(skus) {
    if (!skus.length) return {};
    
    const callbackName = `jQuery_${Date.now()}`;
    const url = `https://shop.samsung.com/hk/servicesv2/getSimpleProductsInfo?productCodes=${skus.join(',')}&callback=${callbackName}`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        
        // Extract JSON from JSONP response wrapper
        const startIdx = text.indexOf('(');
        const endIdx = text.lastIndexOf(')');
        if (startIdx === -1 || endIdx === -1) throw new Error('Invalid JSONP response');
        
        const jsonStr = text.substring(startIdx + 1, endIdx);
        const data = JSON.parse(jsonStr);
        
        const stockMap = {};
        if (data && Array.isArray(data.productDatas)) {
            data.productDatas.forEach(p => {
                stockMap[p.productCode] = p.stockLevelStatus === 'inStock' ? 'Y' : 'N';
            });
        }
        return stockMap;
    } catch (e) {
        console.error('Failed to fetch stock status:', e.message);
        return {};
    }
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
                sku: (values[get('SKU')] || '').trim(),
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

            if (product.showInHKBuyPage) {
                products.push(product);
            }
        }

        // Fetch and update live stock status using SKU codes
        const skus = products.map(p => p.sku).filter(sku => sku);
        if (skus.length > 0) {
            const stockMap = await fetchStockStatus(skus);
            products.forEach(product => {
                if (product.sku && stockMap[product.sku] !== undefined) {
                    product.InStockStatus = stockMap[product.sku];
                } else if (product.sku) {
                    product.InStockStatus = 'N'; // Default to 'N' if SKU wasn't returned in the API result
                }
            });
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
