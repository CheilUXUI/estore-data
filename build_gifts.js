const fs = require('fs');
const path = require('path');

// Stable CSV export (not the flaky gviz/tq one)
const SHEET_ID = '1bXyzOFAQEozdzRcLiLgkBC7AkZtfnlgDlsQsXN4s5kg';
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

async function buildGifts() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const csv = await res.text();
        const lines = csv.trim().split(/\r?\n/);
        
        if (lines.length < 2) {
            console.log('No data rows found');
            return;
        }

        const rawHeaders = parseCSVLine(lines[0]);
        console.log('Headers:', rawHeaders);

        // Build case-insensitive header lookup
        const headerMap = {};
        rawHeaders.forEach((h, i) => {
            headerMap[h.trim()] = i;
            headerMap[h.trim().toLowerCase()] = i;
        });

        const get = (name) => headerMap[name] ?? headerMap[name.toLowerCase()] ?? -1;

        const gifts = [];
        const seen = new Set();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const v = parseCSVLine(line);
            
            const giftCode = v[get('GiftCode')] || '';
            if (!giftCode) continue;

            const sku = v[get('SKU_PromoCode')] || '';
            const key = `${giftCode}|${sku}`;
            
            if (seen.has(key)) continue; // dedupe
            seen.add(key);

            gifts.push({
                GiftCode: giftCode,
                Mode: v[get('Mode')] || '',
                SKU_PromoCode: sku,
                GiftNameEN: v[get('Gift_Name_EN')] || v[get('Gift Name EN')] || '',
                GiftNameZH: v[get('Gift_Name_ZH')] || v[get('Gift Name ZH')] || '',
                'SKU Image': v[get('SKU Image')] || '',
                Price: v[get('Price')] || '',
                'Parent Model': v[get('Parent Model')] || '',
                Active: (v[get('Active')] || '').toUpperCase() === 'Y' ? 'Y' : 'N'
            });
        }

        fs.writeFileSync(
            path.join(__dirname, 'gifts.json'),
            JSON.stringify(gifts, null, 2),
            'utf8'
        );

        console.log(`✓ Generated gifts.json with ${gifts.length} unique entries`);

        // Validation
        const s26u = gifts.filter(g => g.GiftCode?.startsWith('S26U_Gift00'));
        console.log('S26U gifts:', s26u.map(g => g.GiftCode).join(', '));
        
    } catch (e) {
        console.error('Failed to build gifts.json:', e.message);
    }
}

buildGifts();
