const fs = require('fs');
const path = require('path');
const https = require('https');

const SHEET_ID = '1uw3xEwpfdufNPEKF9j93Z4CGvLbfR5Y6eTgvB3NdfMM';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSVRow(text) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function convertCsvToLocalesJson(csvData) {
  const jsonOutputPath = path.join(__dirname, 'locales.json');
  const rows = csvData.replace(/\r\n/g, '\n').split('\n').filter(row => row.trim() !== '');

  if (rows.length < 2) {
    console.error('Error: Remote CSV data is empty or missing data rows.');
    process.exit(1);
  }

  const headers = parseCSVRow(rows[0]);
  const keyIdx = headers.indexOf('key');
  const enIdx = headers.indexOf('en');
  const zhIdx = headers.indexOf('zh');

  if (keyIdx === -1 || enIdx === -1 || zhIdx === -1) {
    console.error("Error: Remote CSV must include 'key', 'en', and 'zh' header columns.");
    process.exit(1);
  }

  const localesJson = { en: {}, zh: {} };

  for (let i = 1; i < rows.length; i++) {
    const columns = parseCSVRow(rows[i]);
    if (columns.length <= Math.max(keyIdx, enIdx, zhIdx)) continue;

    const key = columns[keyIdx].trim();
    if (!key) continue;

    localesJson.en[key] = columns[enIdx];
    localesJson.zh[key] = columns[zhIdx];
  }

  fs.writeFileSync(jsonOutputPath, JSON.stringify(localesJson, null, 2), 'utf8');
  console.log(`Successfully pulled spreadsheet data and generated: ${jsonOutputPath}`);
}

function fetchWithRedirects(url) {
  https.get(url, (res) => {
    // Handle 301, 302, 303, 307, and 308 redirect codes
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      fetchWithRedirects(res.headers.location);
    } else if (res.statusCode !== 200) {
      console.error(`Failed to fetch sheet. Status Code: ${res.statusCode}. Ensure the sheet link sharing settings are set to 'Anyone with the link can view'.`);
      process.exit(1);
    } else {
      let csvData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { csvData += chunk; });
      res.on('end', () => {
        convertCsvToLocalesJson(csvData);
      });
    }
  }).on('error', (err) => {
    console.error('Network error while fetching sheet:', err.message);
  });
}

function fetchGoogleSheet() {
  if (SHEET_ID === 'TO_BE_PROVIDED') {
    console.error('Error: Please replace SHEET_ID with your actual Google Sheet ID.');
    process.exit(1);
  }

  console.log('Fetching translations from Google Sheets...');
  fetchWithRedirects(SHEET_URL);
}

fetchGoogleSheet();
