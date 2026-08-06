// Vercel Serverless Function：作为智谱视觉 API 的代理（隐藏 Key）。
// 前端（app.js）调用同源 /api/legend-vision，本函数用服务端环境变量 ZHIPU_API_KEY
// 转发到智谱 OpenAI 兼容端点，避免把 API Key 暴露在前端代码或浏览器里。
//
// 部署后请在 Vercel 控制台（项目 → Settings → Environment Variables）添加：
//   名称：ZHIPU_API_KEY   值：你的智谱 API Key
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

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: '服务端未配置 ZHIPU_API_KEY 环境变量（请在 Vercel 控制台设置）' }));
  }

  try {
    const body = req.body || {};
    const { image, model, prompt } = body;
    if (!image) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '缺少 image 字段' }));
    }

    const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const upstream = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model || 'glm-4v-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt || '请识别图片内容' },
            { type: 'image_url', image_url: { url: image } }
          ]
        }]
      })
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: '智谱 API 错误 ' + upstream.status, detail: txt.slice(0, 600) }));
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
