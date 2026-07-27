const fs = require('fs');
const https = require('https');

const SHEET_ID = '1qmxJE53u2Jlvoj2KwHzw2PR7SVPf5fIo0XRatYN0S18';
const GID = '0';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

const EXPECTED_HEADERS = [
  'family', 'device', 'feature1_img', 'feature2_img', 'feature3_img',
  'feature1h_tc', 'feature1d_tc', 'feature1s_tc',
  'feature2h_tc', 'feature2d_tc', 'feature2s_tc',
  'feature3h_tc', 'feature3d_tc', 'feature3s_tc',
  'feature1h_en', 'feature1d_en', 'feature1s_en',
  'feature2h_en', 'feature2d_en', 'feature2s_en',
  'feature3h_en', 'feature3d_en', 'feature3s_en'
];

https.get(URL, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const jsonStart = data.indexOf('{');
      const jsonEnd = data.lastIndexOf('}');
      const jsonData = JSON.parse(data.substring(jsonStart, jsonEnd + 1));
      
      const rows = jsonData.table.rows;
      const result = rows.map(row => {
        const rawObj = {};
        row.c.forEach((cell, index) => {
          const header = EXPECTED_HEADERS[index];
          if (header) {
            rawObj[header] = cell && cell.v !== null ? cell.v : '';
          }
        });

        const { family, device, ...features } = rawObj;
        return {
          family,
          device,
          features
        };
      });

      fs.writeFileSync('output.json', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error.message);
    }
  });
}).on('error', (err) => {
  console.error(err.message);
});
