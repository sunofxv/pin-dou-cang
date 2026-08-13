// 聚焦测试：补货清单「导出列预设」——勾选/排序/保存 + 复制输出受预设控制。
// 用法：先启动 `python -m http.server 8137`，再 `node test/restock-export-test.js`
const puppeteer = require('C:/Users/木子/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'http://localhost:8137/index.html';
const KEY = 'perler_inventory_state_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SETTINGS = { enableVision: true, apiKey: '', model: 'glm-4v-flash', visionBaseUrl: '', sampleTolerance: 48, scaleFactor: 1, recognizeMode: 'legend', gridCols: 0, gridRows: 0, cellAspect: 0.555, gridOCREnabled: false, replenishThreshold: 100, restockExportCols: ['record', 'colorNumber', 'portions', 'perQty', 'beads'] };

function seed() {
  return {
    beads: [
      { id: 'b1', colorNumber: 'A1', colorName: '红', hex: '#ef4444', location: '', stock: 5, threshold: 0 },
      { id: 'b2', colorNumber: 'B2', colorName: '蓝', hex: '#3b82f6', location: '', stock: 5, threshold: 0 }
    ],
    logs: [], recipes: [], mappings: [], gallery: [], profile: { nickname: '', avatar: '' }, settings: SETTINGS,
    restockRecords: [{ id: 'rs_d1', name: '我的清单', status: 'pending', createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null,
      items: [
        { id: 'i1', colorNumber: 'A1', portions: 2, perQty: 1000, note: '' },
        { id: 'i2', colorNumber: 'B2', portions: 3, perQty: 1000, note: '' }
      ] }]
  };
}

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', e => { if (!/tailwind is not defined/i.test(e.message)) errors.push('PAGEERROR: ' + e.message); });
    await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, s), KEY, JSON.stringify(seed()));
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(500);
    try { await (await browser.defaultBrowserContext()).overridePermissions('http://localhost:8137', ['clipboard-read', 'clipboard-write']); } catch (e) {}
    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '补货管理'); if (b) b.click(); });
    await sleep(400);

    // 打开导出列预设弹窗
    await page.click('#rs-export-cfg'); await sleep(300);
    const hasCfg = await page.$('.rs-col-on');
    // 取消勾选「记录名」
    await page.evaluate(() => { const cb = document.querySelector('.rs-col-on[data-key="record"]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    // 「颗数」上移两次
    await page.click('.rs-col-up[data-key="beads"]'); await sleep(150);
    await page.click('.rs-col-up[data-key="beads"]'); await sleep(150);
    await page.click('#rs-cfg-save'); await sleep(300);
    const cfgSaved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).settings.restockExportCols, KEY);

    // 复制清单（按预设：应不含记录名列，顺序 色号/份数/颗数/每份颗数）
    await page.click('#rs-copy'); await sleep(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
    console.log('EXPORT_CFG:', JSON.stringify({ hasCfg: !!hasCfg, cfgSaved, clipLines: clip.split('\n') }));

    const expected = ['colorNumber', 'beads', 'portions', 'perQty']; // record 取消；beads 上移两次
    const cfgOK = errors.length === 0 && !!hasCfg && JSON.stringify(cfgSaved) === JSON.stringify(expected);
    const clipLines = clip.split('\n').map(s => s.replace(/\r$/, ''));
    const clipOK = clipLines.length >= 3 &&
      clipLines[0] === '补货清单（待采购）' &&
      clipLines[1] === '色号\t颗数\t份数\t每份颗数' &&
      clipLines[2] === 'A1\t2000\t2\t1000' &&
      clipLines[3] === 'B2\t3000\t3\t1000';
    const ok = cfgOK && clipOK;
    console.log('PAGEERRORS:', errors);
    console.log(ok ? '✅ EXPORT-CFG PASS' : '❌ EXPORT-CFG FAIL');
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('THROWN:', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    try { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]); } catch (e) {}
  }
})();
