// 聚焦测试：detectLegendRegion 能否正确识别底部两行图例区域。
// 在浏览器端用 canvas 绘制模拟图纸（上方图案 + 底部两行色块图例），
// 直接调用 detectLegendRegion，验证 region 位于底部、高度足够、列数合理。
// 用法：先启动 `python -m http.server 8137`，再 `node test/gallery-legend-region-test.js`
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
    gallery: [{ id: 'g1', name: '测试两行图例', platform: '', author: '', status: 'unmade', image, createdAt: Date.now() }],
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

    // 在页面上下文中绘制模拟图纸
    const imageDataUrl = await page.evaluate(() => {
      const W = 600, H = 800;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      // 上方图案区域：随机色块，占 0~62% 高度
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
      for (let y = 20; y < H * 0.58; y += 18) {
        for (let x = 20; x < W - 20; x += 18) {
          ctx.fillStyle = colors[(Math.floor(x / 18) + Math.floor(y / 18)) % colors.length];
          ctx.fillRect(x, y, 14, 14);
        }
      }
      // 底部图例：两行，每行 10 个色块
      const legendColors = [
        '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
        '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
        '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#10b981',
        '#0ea5e9', '#f59e0b', '#64748b', '#94a3b8', '#cbd5e1'
      ];
      const rowY = [H * 0.68, H * 0.82];
      const colW = (W - 40) / 10;
      const blockW = colW * 0.78, blockH = H * 0.08;
      legendColors.forEach((color, i) => {
        const row = Math.floor(i / 10);
        const colIdx = i % 10;
        const x = 20 + colIdx * colW + (colW - blockW) / 2;
        const y = rowY[row];
        ctx.fillStyle = color;
        ctx.fillRect(x, y, blockW, blockH);
        // 下方数字
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String((i % 10) + 1), x + blockW / 2, y + blockH + 16);
      });
      return c.toDataURL('image/png');
    });

    await page.evaluateOnNewDocument((k, s) => {
      localStorage.setItem(k, s);
    }, KEY, JSON.stringify(seed(imageDataUrl)));

    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(600);

    // 直接调用 detectLegendRegion
    const det = await page.evaluate(async () => {
      const g = JSON.parse(localStorage.getItem('perler_inventory_state_v1')).gallery[0];
      const img = new Image();
      img.src = g.image;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      return window.__detectLegendRegion(img);
    });

    console.log('detectLegendRegion result:', JSON.stringify(det));
    const ok = det && det.region &&
      det.region.y >= 0.50 &&
      det.region.h >= 0.12 &&
      det.estimatedCols >= 8 && det.estimatedCols <= 14 &&
      det.likelyTwoRow === true;

    console.log(ok ? '✅ LEGEND REGION DETECT PASS' : '❌ LEGEND REGION DETECT FAIL');
    if (!ok) {
      console.log('  y=', det?.region?.y, 'expected >=0.55');
      console.log('  h=', det?.region?.h, 'expected 0.15~0.45');
      console.log('  cols=', det?.estimatedCols, 'expected 8~14');
      console.log('  twoRow=', det?.likelyTwoRow, 'expected true');
    }
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
