#!/usr/bin/env node
/*
Node cron job to download daily report (Excel/CSV/JSON) and save into scripts/SavedReports.

Usage:
  - Configure via CLI args or environment variables.
  - Install dependencies: in the scripts folder run `npm install`.
  - Start the job: `node save-daily-report-node.js` or `npm start`.

CLI args (simple):
  --excelUrl <url>       direct xlsx/csv download URL
  --url <url>            default report URL (json)
  --outputDir <path>     output directory (default ./SavedReports)
  --addTimestamp         include time in filename
  --runNow               run immediately and exit
  --authHeaderName <n>   header name for auth (e.g. Authorization)
  --authHeaderValue <v>  header value for auth (e.g. "Bearer token")

This script uses `node-cron` to schedule a daily run at 00:05 server local time.
*/

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
    for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--excelUrl') out.excelUrl = args[++i];
    else if (a === '--url') out.url = args[++i];
    else if (a === '--outputDir') out.outputDir = args[++i];
    else if (a === '--addTimestamp') out.addTimestamp = true;
    else if (a === '--runNow') out.runNow = true;
    else if (a === '--authHeaderName') out.authHeaderName = args[++i];
    else if (a === '--authHeaderValue') out.authHeaderValue = args[++i];
    else if (a === '--fromDate') out.fromDate = args[++i];
    else if (a === '--toDate') out.toDate = args[++i];
    else if (a === '--fromParam') out.fromParam = args[++i];
    else if (a === '--toParam') out.toParam = args[++i];
    else if (a === '--ui') out.ui = true;
    else if (a === '--fromSelector') out.fromSelector = args[++i];
    else if (a === '--toSelector') out.toSelector = args[++i];
    else if (a === '--exportSelector') out.exportSelector = args[++i];
  }
  return out;
}

const argv = parseArgs();
const CONFIG = {
  excelUrl: argv.excelUrl || process.env.EXCEL_URL || null,
  url: argv.url || process.env.REPORT_URL || 'http://192.168.5.47:3000/reports',
  outputDir: argv.outputDir || process.env.OUTPUT_DIR || path.join(__dirname, 'SavedReports'),
  addTimestamp: !!argv.addTimestamp || !!process.env.ADD_TIMESTAMP,
  authHeaderName: argv.authHeaderName || process.env.AUTH_HEADER_NAME,
  authHeaderValue: argv.authHeaderValue || process.env.AUTH_HEADER_VALUE,
  fromDate: argv.fromDate || process.env.FROM_DATE || null,
  toDate: argv.toDate || process.env.TO_DATE || null,
  fromParam: argv.fromParam || process.env.FROM_PARAM || 'from',
  toParam: argv.toParam || process.env.TO_PARAM || 'to',
  ui: !!argv.ui,
  fromSelector: argv.fromSelector,
  toSelector: argv.toSelector,
  exportSelector: argv.exportSelector,
};

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function fileNameFor(now, ext, addTimestamp) {
  const datePart = now.toISOString().slice(0,10);
  if (addTimestamp) {
    const timePart = now.toTimeString().slice(0,8).replace(/:/g,'');
    return `report-${datePart}-${timePart}.${ext}`;
  }
  return `report-${datePart}.${ext}`;
}

async function downloadToFile(url, outPath, headers) {
  const writer = fs.createWriteStream(outPath);
  const res = await axios({ url, method: 'GET', responseType: 'stream', headers, timeout: 60000 });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    let error = null;
    writer.on('error', err => { error = err; writer.close(); reject(err); });
    writer.on('close', () => { if (!error) resolve(); });
  });
}

async function runOnce() {
  try {
    await ensureDir(CONFIG.outputDir);
    const now = new Date();
    const now = new Date();
    // determine date range (default: yesterday)
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const defaultDate = d => d.toISOString().slice(0,10);
    const fromDate = CONFIG.fromDate || defaultDate(yesterday);
    const toDate = CONFIG.toDate || defaultDate(yesterday);

    const downloadUrlBase = CONFIG.excelUrl || CONFIG.url;
    // if not UI mode and we have params, build query string
    let downloadUrl = downloadUrlBase;
    let extGuess = 'json';
    if (!CONFIG.ui) {
      const u = new URL(downloadUrlBase);
      if (CONFIG.fromParam) u.searchParams.set(CONFIG.fromParam, fromDate);
      if (CONFIG.toParam) u.searchParams.set(CONFIG.toParam, toDate);
      downloadUrl = u.toString();
      extGuess = CONFIG.excelUrl ? (path.extname(CONFIG.excelUrl).replace('.','') || 'xlsx') : (path.extname(u.pathname).replace('.','') || 'csv');
    }
    const fileName = fileNameFor(now, extGuess, CONFIG.addTimestamp);
    const outPath = path.join(CONFIG.outputDir, fileName);
    const headers = {};
    if (CONFIG.authHeaderName && CONFIG.authHeaderValue) headers[CONFIG.authHeaderName] = CONFIG.authHeaderValue;

    if (CONFIG.authHeaderName && CONFIG.authHeaderValue) headers[CONFIG.authHeaderName] = CONFIG.authHeaderValue;

    if (CONFIG.ui) {
      // lazy-require puppeteer
      try { puppeteer = require('puppeteer'); } catch (e) { throw new Error('puppeteer not installed. Run npm install puppeteer'); }
      console.log('Starting puppeteer UI automation for', downloadUrlBase);
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: CONFIG.outputDir });
      await page.goto(downloadUrlBase, { waitUntil: 'networkidle2' });
      if (CONFIG.fromSelector && CONFIG.toSelector) {
        await page.evaluate((selFrom, selTo, f, t) => {
          const elF = document.querySelector(selFrom);
          const elT = document.querySelector(selTo);
          if (elF) elF.value = f;
          if (elT) elT.value = t;
        }, CONFIG.fromSelector, CONFIG.toSelector, fromDate, toDate);
      }
      if (!CONFIG.exportSelector) throw new Error('exportSelector is required in UI mode');
      await page.click(CONFIG.exportSelector);
      // wait for a new file to appear in the output dir
      const file = await waitForNewFile(CONFIG.outputDir, 30000);
      console.log('Downloaded via UI to', file);
      await browser.close();
    } else {
      console.log(new Date().toISOString(), 'Downloading', downloadUrl, '->', outPath);
      await downloadToFile(downloadUrl, outPath, headers);
      console.log(new Date().toISOString(), 'Saved', outPath);
    }
  } catch (err) {
    console.error('Failed to download report:', err && err.message ? err.message : err);
  }
}

function waitForNewFile(dir, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const existing = new Set(fs.readdirSync(dir));
    const iv = setInterval(() => {
      const now = Date.now();
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (!existing.has(f)) {
          clearInterval(iv);
          return resolve(path.join(dir, f));
        }
      }
      if (now - start > timeout) { clearInterval(iv); return reject(new Error('Timed out waiting for download')); }
    }, 500);
  });
}

async function main() {
  if (argv.runNow) {
    await runOnce();
    process.exit(0);
  }

  // Schedule daily at 00:05 local server time
  cron.schedule('5 0 * * *', async () => {
    console.log(new Date().toISOString(), 'Scheduled run starting');
    await runOnce();
  }, { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });

  console.log('Node cron job started. Scheduled daily at 00:05 local time. Output dir:', CONFIG.outputDir);
}

main();
