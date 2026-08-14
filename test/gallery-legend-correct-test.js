// 端到端测试（新流程）：图库「识别图例」→ 跳转到「图纸识别」页（自动定位）→ AI 识别（用 stub 绕过真实视觉 API）→ 「保存到图库」反填图例信息。
// 验证：视图切换、识别结果渲染、保存到图库后 g.legend 写入 localStorage。
// 用法：先启动 `python -m http.server 8137`，再 `node test/gallery-legend-correct-test.js`
const puppeteer = require('C:/Users/木子/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'http://localhost:8137/index.html';
const KEY = 'perler_inventory_state_v1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SETTINGS = { enableVision: true, apiKey: '', model: 'glm-4v-flash', visionBaseUrl: '', sampleTolerance: 48, scaleFactor: 1, recognizeMode: 'legend', gridCols: 0, gridRows: 0, cellAspect: 0.555, gridOCREnabled: false, replenishThreshold: 100, restockExportCols: ['record', 'colorNumber', 'portions', 'perQty', 'beads'] };

function seed(image) {
  return {
    beads: [
      { id: 'b1', colorNumber: 'A1', colorName: '红', hex: '#ef4444', location: '', stock: 100, threshold: 0 },
      { id: 'b2', colorNumber: 'B2', colorName: '蓝', hex: '#3b82f6', location: '', stock: 50, threshold: 0 }
    ],
    logs: [], recipes: [], mappings: [],
    gallery: [{ id: 'g1', name: '测试两行图例', platform: '', author: '', status: 'unmade', image, legend: null, createdAt: Date.now() }],
    profile: { nickname: '', avatar: '' }, settings: SETTINGS, restockRecords: []
  };
}

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000 });
    page.on('pageerror', e => { if (!/tailwind is not defined/i.test(e.message)) errors.push('PAGEERROR: ' + e.message); });

    // 在页面上下文中绘制模拟图纸（上方图案 + 底部两行彩色图例，确保 detectLegendRegion 能定位）
    const imageDataUrl = await page.evaluate(() => {
      const W = 600, H = 800;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
      for (let y = 20; y < H * 0.58; y += 18)
        for (let x = 20; x < W - 20; x += 18) {
          ctx.fillStyle = colors[(Math.floor(x / 18) + Math.floor(y / 18)) % colors.length];
          ctx.fillRect(x, y, 14, 14);
        }
      const legendColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
        '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#10b981', '#0ea5e9', '#f59e0b', '#64748b', '#94a3b8', '#cbd5e1'];
      const rowY = [H * 0.68, H * 0.82];
      const colW = (W - 40) / 10, blockW = colW * 0.78, blockH = H * 0.08;
      legendColors.forEach((color, i) => {
        const x = 20 + (i % 10) * colW + (colW - blockW) / 2, y = rowY[Math.floor(i / 10)];
        ctx.fillStyle = color; ctx.fillRect(x, y, blockW, blockH);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String((i % 10) + 1), x + blockW / 2, y + blockH + 16);
      });
      return c.toDataURL('image/png');
    });

    await page.evaluateOnNewDocument((k, s) => {
      localStorage.setItem(k, s);
      // 用桩函数绕过真实视觉 API：返回 3 个固定色号+数量
      window.__aiParseLegendStub = (img, region, baseUrl) => Promise.resolve([
        { r: 239, g: 68, b: 68, hex: '#ef4444', colorNumber: 'A1', colorName: '红', count: 10 },
        { r: 59, g: 130, b: 246, hex: '#3b82f6', colorNumber: 'B2', colorName: '蓝', count: 20 },
        { r: 34, g: 197, b: 94, hex: '#22c55e', colorNumber: 'C3', colorName: '绿', count: 30 }
      ]);
    }, KEY, JSON.stringify(seed(imageDataUrl)));

    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(600);

    // 进入图库
    await page.evaluate(() => { const b = [...document.querySelectorAll('#nav .nav-btn')].find(x => x.textContent.trim() === '图库'); if (b) b.click(); });
    await sleep(400);

    // 点击「识别图例」→ 应跳转到「图纸识别」页
    await page.evaluate(() => { const b = document.querySelector('.g-legend'); if (b) b.click(); });
    await sleep(1200); // 等 switchView + 自动定位(detectLegendRegion) 完成

    const afterClick = await page.evaluate(() => ({
      hasCanvas: !!document.querySelector('#editor-canvas'),
      hasBack: !!document.querySelector('#rc-back-gallery'),
      hasSave: !!document.querySelector('#legend-save-gallery'),
      aiBtn: !!document.querySelector('#ai-parse-legend')
    }));
    console.log('AFTER CLICK=', JSON.stringify(afterClick));

    // 点击「AI 识别图例」
    await page.evaluate(() => { const b = document.querySelector('#ai-parse-legend'); if (b) b.click(); });
    await sleep(1000);

    const afterParse = await page.evaluate(() => ({
      items: document.querySelectorAll('#legend-items .legend-item').length,
      saveBtn: !!document.querySelector('#legend-save-gallery')
    }));
    console.log('AFTER PARSE=', JSON.stringify(afterParse));

    // 点击「保存到图库」
    await page.evaluate(() => { const b = document.querySelector('#legend-save-gallery'); if (b) b.click(); });
    await sleep(500);

    const saved = await page.evaluate((k) => {
      const st = JSON.parse(localStorage.getItem(k));
      const g = st.gallery.find(x => x.id === 'g1');
      return g && g.legend ? { count: g.legend.items.length, first: g.legend.items[0] } : null;
    }, KEY);
    console.log('SAVED LEGEND=', JSON.stringify(saved));

    const ok = afterClick.hasCanvas && afterClick.hasBack && afterClick.hasSave &&
      afterParse.items === 3 && saved && saved.count === 3 && saved.first.colorNumber === 'A1';

    console.log(ok ? '✅ GALLERY→RECOGNIZE→SAVE PASS' : '❌ GALLERY→RECOGNIZE→SAVE FAIL');
    console.log('PAGEERRORS:', errors);
    console.log('RESULT_OK=' + (ok && errors.length === 0 ? '1' : '0'));
    process.exitCode = ok && errors.length === 0 ? 0 : 1;
  } catch (e) {
    console.error('TEST ERROR:', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    const code = process.exitCode || 0;
    try { await browser.close(); } catch (e) {}
    process.exit(code);
  }
})();
