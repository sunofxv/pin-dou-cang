// Vercel Serverless Function：97api 图生图代理（隐藏 Key + 绕开跨域）。
// 前端把"源图 dataURL + 指令"发来，本函数用服务端 PINDOU_API_KEY 调 97api 的
// /v1/images/edits 做图生图重绘，再把结果图以 dataURL 形式回传，
// 这样前端把重绘图喂给 canvas 时不会被跨域污染（getImageData 才可用）。
//
// 部署后请在 Vercel 控制台（项目 → Settings → Environment Variables）添加：
//   名称：PINDOU_API_KEY   值：你的 97api Key
// 添加后即时生效，无需重新部署（只要函数代码本身已部署）。
module.exports = async (req, res) => {
  // 允许同源调用；处理预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: '仅支持 POST 方法' }));
  }

  try {
    const body = req.body || {};
    const src = body.image;
    if (!src || !/^data:image\//.test(src)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '缺少 image 字段（需 dataURL）' }));
    }

    const apiKey = process.env.PINDOU_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '服务端未配置 PINDOU_API_KEY 环境变量（请在 Vercel 控制台设置）' }));
    }

    // 解析 dataURL → buffer + mime
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(src);
    if (!m) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'image 不是合法 dataURL' }));
    }
    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');

    // 由像素尺寸挑选符合 97api 廉价渠道枚举的 size（避免 400）
    const dim = probeSize(buf);
    const { aspect_ratio, size } = pickSize(dim ? dim.width : 1024, dim ? dim.height : 1024);

    const prompt = body.prompt ||
      'Redraw this as flat perler-bead / pixel-art style: limited solid color palette, clean square grid, ' +
      'hard edges, no gradients, no shading, bold dark outlines, each region a single flat color. ' +
      'Keep the main subject and overall composition.';

    // 组装 multipart/form-data（图生图 edits 接口）
    const form = new FormData();
    form.append('model', body.model || 'gpt-image-2');
    form.append('prompt', prompt);
    form.append('aspect_ratio', aspect_ratio);
    form.append('size', size);
    form.append('quality', body.quality || 'high');
    form.append('output_format', 'webp');
    form.append('n', '1');
    form.append('response_format', 'url');
    form.append('image', new Blob([buf], { type: mime }), 'source.webp');

    const upstream = await fetch('https://images.97api.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json'
      },
      body: form
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      let detail = txt.slice(0, 800);
      try { const d = JSON.parse(txt); if (d.error && d.error.message) detail = d.error.message; } catch (_) {}
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '97api 错误 ' + upstream.status, detail }));
    }

    const data = await upstream.json();
    const url = data.data && data.data[0] && data.data[0].url;
    if (!url) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '97api 未返回图片 URL', raw: JSON.stringify(data).slice(0, 600) }));
    }

    // 服务端拉取重绘图，转成 dataURL 回传（绕开浏览器跨域限制）
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '重绘图下载失败 ' + imgRes.status }));
    }
    const ab = Buffer.from(await imgRes.arrayBuffer());
    const ct = imgRes.headers.get('content-type') || 'image/webp';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ image: 'data:' + ct + ';base64,' + ab.toString('base64') }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: '代理调用失败：' + e.message }));
  }
};

// 依据宽高比挑选 97api 廉价渠道支持的 size 组合（gpt-image-2 / 1K）
function pickSize(w, h) {
  const r = w / h;
  if (r > 1.4) {
    return r > 1.7
      ? { aspect_ratio: '16:9', size: '1666x944' }
      : { aspect_ratio: '3:2', size: '1536x1024' };
  }
  if (r < 1 / 1.4) {
    return r < 1 / 1.7
      ? { aspect_ratio: '9:16', size: '944x1665' }
      : { aspect_ratio: '2:3', size: '1024x1536' };
  }
  return { aspect_ratio: '1:1', size: '1254x1254' };
}

// 仅解析 PNG/JPEG 头部拿宽高（够挑选 size 即可），失败返回 null
function probeSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) { // PNG
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG：扫描 SOF 标记
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] === 0xFF && buf[i + 1] >= 0xC0 && buf[i + 1] <= 0xCF &&
            buf[i + 1] !== 0xC4 && buf[i + 1] !== 0xC8 && buf[i + 1] !== 0xCC) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i++;
      }
    }
  } catch (_) {}
  return null;
}

// Vercel Node 函数最大执行时长：图像生成常 > 60s。
// hobby 套餐上限 60s；若用 Pro 可把这里（或 vercel.json）调到 120~300。
module.exports.config = { maxDuration: 60 };
