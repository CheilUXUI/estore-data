const fs = require('fs');
const path = require('path');

// Trade-in Device Sheet - stable CSV export
const SHEET_ID = '151vyW_jaC-SP493360R2RaCEy0Ey6ulKiZmZACH5S2g';
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

async function buildDevices() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const csvContent = await res.text();
        const lines = csvContent.trim().split(/\r?\n/);

        if (lines.length < 2) {
            console.log('No data rows found');
            return;
        }

        const headers = parseCSVLine(lines[0]);
        console.log('Headers:', headers.slice(0, 10), '...');

        const brandIdx = headers.indexOf('Brand');
        const modelIdx = headers.indexOf('Model');
        const storageIdx = headers.indexOf('Storage');
        const stdPriceIdx = headers.indexOf('Standad Price');

        const etiCols = headers.filter(h => h.endsWith('_ETI'));
        const gtiCols = headers.filter(h => h.endsWith('_GTI'));

        console.log(`Found ${etiCols.length} ETI columns and ${gtiCols.length} GTI columns`);

        const devices = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = parseCSVLine(lines[i]);

            const brand = values[brandIdx];
            const model = values[modelIdx];
            if (!brand || !model) continue;

            const standardPriceStr = values[stdPriceIdx] || '0';
            const standardPrice = parseInt(standardPriceStr.replace(/[^0-9]/g, '')) || 0;

            const device = {
                brand,
                model,
                storage: values[storageIdx] || '',
                recommendation1: values[headers.indexOf('Recommendation 1')] || '',
                recommendation2: values[headers.indexOf('Recommendation 2')] || '',
                recommendation3: values[headers.indexOf('Recommendation 3')] || '',
                standardPrice,
                eti: {},
                gti: {}
            };

            etiCols.forEach(col => {
                const colIdx = headers.indexOf(col);
                const sku = col.replace('_ETI', '');
                const raw = (values[colIdx] || '').trim().toUpperCase();
                if (raw === 'N/A' || raw === 'NA' || raw === '') return;
                const val = parseInt(values[colIdx]);
                if (!isNaN(val)) device.eti[sku] = val;
            });

            gtiCols.forEach(col => {
                const colIdx = headers.indexOf(col);
                const sku = col.replace('_GTI', '');
                const raw = (values[colIdx] || '').trim().toUpperCase();
                if (raw === 'N/A' || raw === 'NA' || raw === '') return;
                const val = parseInt(values[colIdx]);
                if (!isNaN(val)) device.gti[sku] = val;
            });

            devices.push(device);
        }

        fs.writeFileSync(
            path.join(__dirname, 'devices.json'),
            JSON.stringify(devices, null, 2),
            'utf8'
        );

        console.log(`✓ Generated devices.json with ${devices.length} entries`);
    } catch (e) {
        console.error('Failed to build devices.json:', e.message);
    }
}

buildDevices();
