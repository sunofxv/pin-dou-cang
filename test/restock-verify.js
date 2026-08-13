// 验证补货管理新结构：记录(可改名/可折叠) → 多个色号清单项；
// 仪表盘「添加到补货清单」生成一条含多项的记录；一键入库 / 撤销入库 / 新增清单 / 新增补货记录；
// 以及旧扁平数据 → 新层级结构的迁移。
// 用法：先启动 `python -m http.server 8137`，再 `node test/restock-verify.js`
const puppeteer = require('C:/Users/木子/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'http://localhost:8137/index.html';
const KEY = 'perler_inventory_state_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SETTINGS = { enableVision: true, apiKey: '', model: 'glm-4v-flash', visionBaseUrl: '', sampleTolerance: 48, scaleFactor: 1, recognizeMode: 'legend', gridCols: 0, gridRows: 0, cellAspect: 0.555, gridOCREnabled: false, replenishThreshold: 100 };

function baseSeed() {
  return {
    beads: [
      { id: 'b1', colorNumber: 'A1', colorName: '红', hex: '#ef4444', location: '', stock: 5, threshold: 0 },
      { id: 'b2', colorNumber: 'B2', colorName: '蓝', hex: '#3b82f6', location: '', stock: 5, threshold: 0 },
      { id: 'b3', colorNumber: 'C3', colorName: '绿', hex: '#22c55e', location: '', stock: 5, threshold: 0 }
    ],
    logs: [], recipes: [], restockRecords: [], gallery: [], mappings: [],
    profile: { nickname: '', avatar: '' }, settings: SETTINGS
  };
}

async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
}

(async () => {
  const errors = [];
  process.on('unhandledRejection', (e) => { console.error('UNHANDLED_REJECTION:', e && e.stack || e); });

  // ---- Phase A: 旧扁平数据 → 新层级结构 迁移 ----
  // 注意：迁移发生在内存中，首次用户操作才写回 localStorage；故此处直接检查渲染出的 DOM。
  {
    const oldSeed = baseSeed();
    oldSeed.restockRecords = [{ id: 'rs_old1', colorNumber: 'A1', portions: 2, perQty: 500, note: 'old', status: 'pending', createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null }];
    const browser = await launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, s), KEY, JSON.stringify(oldSeed));
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(500);
    // 进入补货管理页，检查迁移后的渲染
    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '补货管理'); if (b) b.click(); });
    await sleep(400);
    const mig = await page.evaluate(() => ({
      names: [...document.querySelectorAll('.rs-name')].map(e => e.value),
      colors: [...document.querySelectorAll('.ri-color')].map(e => e.value),
      itemCount: document.querySelectorAll('.rs-item').length
    }));
    console.log('MIGRATION(DOM):', JSON.stringify(mig));
    try { await browser.close(); } catch (e) {}
    const migOK = errors.length === 0 && mig.names.includes('补货记录1') && mig.colors.includes('A1') && mig.itemCount === 1;
    console.log(migOK ? '✅ MIGRATION PASS' : '❌ MIGRATION FAIL');
    if (!migOK) { console.log('PAGEERRORS:', errors); process.exitCode = 1; return; }
  }

  // ---- Phase B: 新结构全流程 ----
  {
    const seed = baseSeed();
    const browser = await launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.evaluateOnNewDocument((k, s) => localStorage.setItem(k, s), KEY, JSON.stringify(seed));
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(500);

    const hasBtn = await page.$('#add-to-restock');

    // 1) 仪表盘「添加到补货清单」→ 一条记录含 3 个色号项
    await page.click('#add-to-restock'); await sleep(600);
    const afterAdd = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      return { pending: s.restockRecords.filter(r => r.status === 'pending'), items: (s.restockRecords[0] && s.restockRecords[0].items) || [] };
    }, KEY);
    console.log('DEBUG afterAdd.items colors:', JSON.stringify(afterAdd.items.map(i => i.colorNumber)));
    const nameVal = await page.$eval('.rs-name', el => el.value).catch(() => null);
    const hasStockAll = await page.$('.rs-stock-all');
    const hasAddItem = await page.$('.rs-add-item');
    const itemRows = await page.$$eval('.rs-item', els => els.length);

    // 2) 回仪表盘重复点击：不新增记录、不重复色号项
    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '仪表盘'); if (b) b.click(); }); await sleep(400);
    await page.click('#add-to-restock'); await sleep(500);
    const afterDup = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      return { recs: s.restockRecords.length, items: s.restockRecords[0].items.length };
    }, KEY);

    // 3) 回到补货管理，一键入库（整条记录 → 3 项各入库）
    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '补货管理'); if (b) b.click(); }); await sleep(400);
    await page.click('.rs-stock-all'); await sleep(500);
    const afterStock = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
    const stockedCount = afterStock.restockRecords.filter(r => r.status === 'stocked').length;
    const beadsStock = afterStock.beads.map(b => ({ n: b.colorNumber, s: b.stock }));
    const logIn = afterStock.logs.filter(l => l.type === '补货清单入库');

    // 4) 切到「已入库」页签 → 撤销入库（回到未入库，库存扣回）
    await page.evaluate(() => { const t = document.querySelector('.rs-tab[data-t="stocked"]'); if (t) t.click(); }); await sleep(400);
    await page.click('.rs-undo'); await sleep(500);
    const afterUndo = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
    const pendingBack = afterUndo.restockRecords.filter(r => r.status === 'pending').length;
    const logUndo = afterUndo.logs.filter(l => l.type === '补货清单撤销入库');
    const beadBack = afterUndo.beads.every(b => b.stock === 5);

    // 5) 回到未入库页签，新增清单项并填写色号
    await page.evaluate(() => { const t = document.querySelector('.rs-tab[data-t="pending"]'); if (t) t.click(); }); await sleep(400);
    const itemsBefore = await page.$$eval('.rs-item', els => els.length);
    await page.click('.rs-add-item'); await sleep(400);
    const addedItemRowCount = await page.$$eval('.rs-item', els => els.length);
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.rs-item')];
      const last = items[items.length - 1];
      const inp = last.querySelector('.ri-color');
      inp.value = 'A1'; inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sleep(400);

    // 6) 新增补货记录 → 补货记录2（空项）
    await page.click('#rs-add'); await sleep(400);
    const afterNew = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      const last = s.restockRecords[s.restockRecords.length - 1];
      return { recs: s.restockRecords.length, names: s.restockRecords.map(r => r.name), lastItems: (last.items || []).length };
    }, KEY);

    // 7) 操作记录类型（直接读 state，避免移动端更多下拉干扰）
    const logTypes = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      return [...new Set(s.logs.map(l => l.type))];
    }, KEY);

    console.log('RESULTS:', JSON.stringify({
      nameVal, hasStockAll: !!hasStockAll, hasAddItem: !!hasAddItem, itemRows,
      recsAfterAdd: afterAdd.pending.length, itemsAfterAdd: afterAdd.items.length,
      afterDup, stockedCount, beadsStock, logInCount: logIn.length,
      pendingBack, logUndoCount: logUndo.length, beadBack,
      itemsBefore, addedItemRowCount, afterNew, logTypes
    }, null, 2));

    const ok = errors.length === 0 && !!hasBtn &&
      afterAdd.pending.length === 1 && afterAdd.items.length === 3 && nameVal === '补货记录1' &&
      !!hasStockAll && !!hasAddItem && itemRows === 3 &&
      afterDup.recs === 1 && afterDup.items === 3 &&
      stockedCount === 1 && beadsStock.every(b => b.s === 1005) && logIn.length === 3 &&
      pendingBack === 1 && logUndo.length === 3 && beadBack &&
      addedItemRowCount === itemsBefore + 1 &&
      afterNew.recs === 2 && afterNew.names[1] === '补货记录2' && afterNew.lastItems === 0 &&
      logTypes.includes('补货清单入库') && logTypes.includes('补货清单撤销入库');
    console.log(ok ? '✅ PASS' : '❌ FAIL');
    console.log('PAGEERRORS:', errors);
    try { await browser.close(); } catch (e) {}
    process.exitCode = ok ? 0 : 1;
  }
})();
