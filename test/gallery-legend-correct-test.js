// 聚焦测试：图例识别结果可校正、不存在标红、合并重复、复制/加入补货走校正数据。
// 通过 window.__aiParseLegendStub 注入已知结果（含不存在色号 Z9、重复色号 A1 两条），
// 绕过真实视觉 API，验证后校验与编辑逻辑。
// 用法：先启动 `python -m http.server 8137`，再 `node test/gallery-legend-correct-test.js`
const puppeteer = require('C:/Users/木子/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'http://localhost:8137/index.html';
const KEY = 'perler_inventory_state_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SETTINGS = { enableVision: true, apiKey: '', model: 'glm-4v-flash', visionBaseUrl: '', sampleTolerance: 48, scaleFactor: 1, recognizeMode: 'legend', gridCols: 0, gridRows: 0, cellAspect: 0.555, gridOCREnabled: false, replenishThreshold: 100, restockExportCols: ['record', 'colorNumber', 'portions', 'perQty', 'beads'] };

function seed() {
  const cvs = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#f0f0f0"/></svg>').toString('base64')}`;
  return {
    beads: [
      { id: 'b1', colorNumber: 'A1', colorName: '红', hex: '#ef4444', location: '', stock: 100, threshold: 0 },
      { id: 'b2', colorNumber: 'B2', colorName: '蓝', hex: '#3b82f6', location: '', stock: 50, threshold: 0 }
    ],
    logs: [], recipes: [], mappings: [],
    gallery: [{ id: 'g1', name: '测试图', platform: '', author: '', status: 'unmade', image: cvs, createdAt: Date.now() }],
    profile: { nickname: '', avatar: '' }, settings: SETTINGS, restockRecords: []
  };
}

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', e => { if (!/tailwind is not defined/i.test(e.message)) errors.push('PAGEERROR: ' + e.message); });
    await page.evaluateOnNewDocument((k, s) => {
      localStorage.setItem(k, s);
      window.__aiParseLegendStub = (img, region, baseUrl) => Promise.resolve([
        { r: 239, g: 68, b: 68, hex: '#ef4444', colorNumber: 'A1', colorName: '红', count: 10 },
        { r: 59, g: 130, b: 246, hex: '#3b82f6', colorNumber: 'B2', colorName: '蓝', count: 20 },
        { r: 0, g: 0, b: 0, hex: '#000000', colorNumber: 'Z9', colorName: '', count: 5 },
        { r: 239, g: 68, b: 68, hex: '#ef4444', colorNumber: 'A1', colorName: '红', count: 7 }
      ]);
      window.__legendRegionStub = (img) => ({ region: { x: 0, y: 0.7, w: 1, h: 0.3 } });
    }, KEY, JSON.stringify(seed()));
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(600);

    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '图库'); if (b) b.click(); });
    await sleep(400);
    await page.evaluate(() => { const b = document.querySelector('.g-legend'); if (b) b.click(); });
    // 等待识别结果渲染（桩立即返回）
    await sleep(1500);

    const diag = await page.evaluate(() => ({
      title: document.querySelector('#modal-root h3')?.textContent || '',
      body: (document.querySelector('#modal-body')?.textContent || '').slice(0, 120),
      stub: typeof window.__aiParseLegendStub,
      regionStub: typeof window.__legendRegionStub
    }));
    console.log('DIAG=', JSON.stringify(diag));

    const title = await page.evaluate(() => document.querySelector('#modal-root h3')?.textContent || '');
    const opened = title.includes('识别结果');
    console.log('modalTitle=', title, opened ? '✅ RESULT MODAL' : '❌ NO RESULT MODAL');

    const rowCount = await page.$$eval('#gl-list .gl-cn', els => els.length);
    console.log('rows=', rowCount, rowCount === 4 ? '✅ 4 ROWS' : '❌ ROW COUNT');

    // 不存在色号 Z9 应标红（边框 border-rose-400 或 ring-rose-200）
    const hasBad = await page.$$eval('#gl-list > div', divs => divs.some(d => d.className.includes('rose')));
    console.log(hasBad ? '✅ 不存在色号标红' : '❌ 未标红');

    // 点击「合并重复色号」
    await page.evaluate(() => document.querySelector('#gl-merge').click());
    await sleep(300);
    const rowCountAfterMerge = await page.$$eval('#gl-list .gl-cn', els => els.length);
    console.log('rowsAfterMerge=', rowCountAfterMerge, rowCountAfterMerge === 3 ? '✅ MERGE -> 3 ROWS' : '❌ MERGE FAIL');

    // 把 Z9 改成不存在->改为 B2 已存在；这里改为一个真实色号 A1 重名？改 Z9 -> B2 让那份也有效
    await page.evaluate(() => {
      const inp = [...document.querySelectorAll('#gl-list .gl-cn')].find(e => e.value === 'Z9');
      if (inp) { inp.value = 'B2'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await sleep(200);

    // 加入补货清单：应校验无不存在色号后生成记录（A1 合并后 17、B2 25）
    await page.evaluate(() => document.querySelector('#gl-restock').click());
    await sleep(500);
    const afterRestock = await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      const rs = s.restockRecords;
      return { count: rs.length, names: rs.map(r => r.name), items: rs[0] ? rs[0].items : [] };
    }, KEY);
    console.log('afterRestock=', JSON.stringify(afterRestock));

    const ok = errors.length === 0 && opened && rowCount === 4 && hasBad &&
      rowCountAfterMerge === 3 && afterRestock.count === 1;
    console.log(ok ? '✅ GALLERY LEGEND CORRECT PASS' : '❌ GALLERY LEGEND CORRECT FAIL');
    console.log('PAGEERRORS:', errors);
    console.log('RESULT_OK=' + (ok ? '1' : '0'));
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('TEST ERROR:', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    const code = process.exitCode || 0;
    try { await browser.close(); } catch (e) {}
    process.exit(code);
  }
})();
