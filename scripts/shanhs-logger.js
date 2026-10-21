// shanhs-logger.js
// Probe script: hits ShanHS verify/imei + price-cal for a Samsung device and an iPhone
// control on both TEST and LIVE envs, and writes full request/response logs to a file.
//
// Usage:
//   SHANHS_TEST_APP_ID=57 SHANHS_TEST_APP_SECRET=... \
//   SHANHS_LIVE_APP_ID=120 SHANHS_LIVE_APP_SECRET=... \
//   node scripts/shanhs-logger.js
//
// Or provide a .env.shanhs.local at repo root (gitignored) with the same vars.

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// load .env.shanhs.local if present
const envFile = path.join(__dirname, '..', '.env.shanhs.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
}

const ENVS = [
  { label: 'TEST env (test.m.shanhs.com.cn)', appId: process.env.SHANHS_TEST_APP_ID, secret: process.env.SHANHS_TEST_APP_SECRET, host: 'test.m.shanhs.com.cn' },
  { label: 'LIVE env (m.shanhs.com)', appId: process.env.SHANHS_LIVE_APP_ID, secret: process.env.SHANHS_LIVE_APP_SECRET, host: 'm.shanhs.com' },
].filter(e => e.appId && e.secret);

if (!ENVS.length) {
  console.error('No envs configured. Set SHANHS_TEST_APP_ID/SHANHS_TEST_APP_SECRET and/or SHANHS_LIVE_APP_ID/SHANHS_LIVE_APP_SECRET.');
  process.exit(1);
}

const CHECKS = [
  { label: 'Samsung S25 Ultra (modelId 17081)', modelId: '17081', detailIds: [1160, 1920, 400011, 400021, 400031, 400051] },
  { label: 'iPhone 16 Pro (modelId 13202)', modelId: '13202', detailIds: [1150, 1920, 400011, 400021, 400031, 400051] },
];

const LINES = [];
function log(m) { console.log(m); LINES.push(m); }

function send(env, p, bizObj) {
  const bizStr = JSON.stringify(bizObj);
  const ts = Date.now();
  const si = `appId=${env.appId}&bizContent=${bizStr}&timestamp=${ts}`;
  const sg = crypto.createHmac('sha256', Buffer.from(env.secret, 'utf8')).update(si, 'utf8').digest('hex');
  const body = JSON.stringify({ appId: env.appId, bizContent: bizStr, timestamp: ts, sign: sg, signType: 'HS256' });
  return new Promise((resolve) => {
    const req = https.request({ hostname: env.host, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 30000 },
      (z) => { let d = ''; z.on('data', c => d += c); z.on('end', () => {
        log(`--- ${new Date().toISOString()} ---`);
        log(`POST https://${env.host}${p}`);
        log(`request body: ${body}`);
        log(`sign input: ${si}`);
        log(`http status: ${z.statusCode}`);
        log(`response: ${d}`); log(''); resolve(); }); });
    req.on('error', e => { log('error: ' + e.message); resolve(); });
    req.write(body); req.end();
  });
}

(async () => {
  const B = '/sapi/gateway/shanhs-global-recycle-api/samsung';
  for (const env of ENVS) {
    log('########################################');
    log('env: ' + env.label); log('');
    for (const c of CHECKS) {
      log(`==== ${c.label} ====`);
      log('--- verify/imei ---');
      await send(env, B + '/verify/imei', { modelId: c.modelId, imei: '543215432154321', isNewDevice: 'false' });
      log('--- price-cal ---');
      await send(env, B + '/price-cal', { memberLevel: 3, modelId: c.modelId, detailIds: c.detailIds, recyclePhoneImei: '543215432154321', newPhoneModelCode: 'VCEN4P4YAK', newSkuList: [] });
      log('');
    }
  }
  const out = path.join(__dirname, '..', 'logs', `shanhs-request-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, LINES.join('\n'));
  console.log('saved -> ' + out);
})();
