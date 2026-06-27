const fs = require('fs');
const path = require('path');

// Bank Promotion Sheet - stable CSV export
const SHEET_ID = '14qeOckxBspQVFUi_WhZrOLuUrnCOnQ7uWodf81aNG40';
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

async function buildBankPromo() {
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
        const headerMap = {};
        rawHeaders.forEach((h, i) => {
            headerMap[h.trim()] = i;
            headerMap[h.trim().toLowerCase()] = i;
        });

        const get = (name) => headerMap[name] ?? headerMap[name.toLowerCase()] ?? -1;

        const banks = [];
        const seenKeys = new Set();

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = parseCSVLine(line);

            const bankKey = (values[get('Bank Name EN')] || values[get('Bank Name')] || '')
                .toLowerCase()
                .replace(/\s+/g, '');

            if (!bankKey || seenKeys.has(bankKey)) continue;
            seenKeys.add(bankKey);  

            const bank = {
                key: bankKey,
                name: {
                    en: values[get('Bank Name EN')] || values[get('Bank Name')] || '',
                    zh: values[get('Bank Name ZH')] || ''
                },
                rebateName: {
                    en: values[get('Rebate Name EN')] || 'Credit Card Rebate',
                    zh: values[get('Rebate Name ZH')] || '信用卡回贈'
                },
                logo: values[get('Logo')] || '',
                tiers: [],
                maximum: parseInt(values[get('Maximum')]) || 0,
                fixedDiscount: null,
                priority: parseInt(values[get('Priority')]) || 999,
                isRecommended: (values[get('Recommendation')] || '').toUpperCase() === 'Y'
            };

            // Parse tiers
            const tierColumns = [
                { max: 'Tier1', percent: 'Tier1 Percentage Discount' },
                { max: 'Tier2', percent: 'Tier2 Percentage Discount' },
                { max: 'Tier3', percent: 'Tier3 Percentage Discount' },
                { max: 'Tier4', percent: 'Tier4 Percentage Discount' }
            ];

            tierColumns.forEach(col => {
                const maxVal = parseInt(values[get(col.max)]) || 0;
                const percentStr = values[get(col.percent)] || '';
                const percent = parseFloat(percentStr) / 100;

                if (maxVal > 0) {
                    bank.tiers.push({ max: maxVal, percent });
                }
            });

            // Fixed discount
            const fixedNameEn = values[get('FixedDiscount1 EN')] || values[get('FixedDiscount1')] || '';
            const fixedNameZh = values[get('FixedDiscount1 ZH')] || '';
            const fixedValue = parseInt(values[get('Fixed Discount1 Value')]) || 0;
            if ((fixedNameEn || fixedNameZh) && fixedValue > 0) {
                bank.fixedDiscount = {
                    name: {
                        en: fixedNameEn,
                        zh: fixedNameZh || fixedNameEn
                    },
                    value: fixedValue
                };
            }

            banks.push(bank);
        }

        fs.writeFileSync(
            path.join(__dirname, 'bankpromo.json'),
            JSON.stringify(banks, null, 2),
            'utf8'
        );

        console.log(`✓ Generated bankpromo.json with ${banks.length} banks`);
    } catch (e) {
        console.error('Failed to build bankpromo.json:', e.message);
    }
}

buildBankPromo();
