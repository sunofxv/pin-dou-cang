// Vercel Serverless Function：作为视觉 API 的代理（隐藏 Key）。
// 前端（app.js）调用同源 /api/legend-vision，本函数用服务端环境变量里的 Key
// 转发到对应厂商，避免把 API Key 暴露在前端代码或浏览器里。
//
// 按传入的 model 自动路由：
//   - glm-*            → 智谱（ZHIPU_API_KEY）+ 智谱兼容端点
//   - 其他（gpt-*/...） → OpenAI（OPENAI_API_KEY）+ OpenAI 端点
//
// 部署后请在 Vercel 控制台（项目 → Settings → Environment Variables）添加：
//   名称：OPENAI_API_KEY   值：你的 OpenAI Key（用于 gpt-4o 等）
//   名称：ZHIPU_API_KEY    值：你的智谱 Key（用于 glm-4v-plus 等，可选）
// 添加后即时生效，无需重新部署。
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
    const { image, model, prompt } = body;
    if (!image) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '缺少 image 字段' }));
    }

    const isZhipu = !!(model && model.toLowerCase().startsWith('glm'));
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: prompt || '请识别图片内容' },
        { type: 'image_url', image_url: { url: image } }
      ]
    }];

    if (isZhipu) {
      const apiKey = process.env.ZHIPU_API_KEY;
      if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: '服务端未配置 ZHIPU_API_KEY 环境变量（请在 Vercel 控制台设置）' }));
      }
      const upstream = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model: model || 'glm-4v-flash', messages })
      });
      if (!upstream.ok) {
        const txt = await upstream.text();
        let detail = txt.slice(0, 600);
        try { const d = JSON.parse(txt); if (d.error && d.error.message) detail = d.error.message; } catch (_) {}
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: '智谱 API 错误 ' + upstream.status, detail }));
      }
      const data = await upstream.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ content: content || '' }));
    }

    // OpenAI（gpt-4o 等），Vercel 海外节点直连，不受国内网络限制
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '服务端未配置 OPENAI_API_KEY 环境变量（请在 Vercel 控制台设置）' }));
    }
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model || 'gpt-4o', messages })
    });
    if (!upstream.ok) {
      const txt = await upstream.text();
      let detail = txt.slice(0, 600);
      try { const d = JSON.parse(txt); if (d.error && d.error.message) detail = d.error.message; } catch (_) {}
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'OpenAI API 错误 ' + upstream.status, detail }));
    }
    const data = await upstream.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content: content || '' }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: '代理调用失败：' + e.message }));
  }
};
