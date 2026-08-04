/* ===================================================================
 * 拼豆豆仓 · 拼豆库存管理 Demo（纯前端 / LocalStorage / 无后端）
 * -------------------------------------------------------------------
 * 页面：仪表盘 / 豆子仓库 / 图纸识别 / 配方库 / 操作记录 / 设置
 *
 * 本文件重点注释两块核心算法：
 *   A. 图纸取色聚类统计（canvas 像素采样 → 颜色分桶计数）
 *   B. 色号映射逻辑（采样 RGB → 色卡对照表 → 标准拼豆色号）
 * =================================================================== */
(function () {
  'use strict';

  /* ===================== 1. 常量与默认种子数据 ===================== */
  const STORAGE_KEY = 'perler_inventory_state_v1';

  /* ---------- MARD 221 标准色卡（市面上零售最常见的 221 色版本） ----------
   * 色号前缀 A–M，共 9 个系列、221 色：
   *   A 黄/橙(26) B 绿(32) C 蓝/青(29) D 紫(26) E 粉/玫(24)
   *   F 红(25)   G 棕/肤色(21) H 黑白灰(23) M 莫兰迪灰调(15)
   * 下方为「色号 + 屏幕近似 HEX」，来源于公开色卡（实体豆受光线/批次影响）。
   * 这 221 条本身即默认「色卡对照表」：图纸识别时用“最近色”自动匹配色号。
   * 用户可在「设置」里追加自定义映射做覆盖/别名。 */
  const MARD_RAW = `
    A1 #FAF4C8 A2 #FFFFD5 A3 #FEFF8B A4 #FBED56 A5 #F4D738 A6 #FEAC4C A7 #FE8B4C A8 #FFDA45 A9 #FF995B A10 #F77C31
    A11 #FFDD99 A12 #FE9F72 A13 #FFC365 A14 #FD543D A15 #FFF365 A16 #FFFF9F A17 #FFE36E A18 #FEBE7D A19 #FD7C72 A20 #FFD568
    A21 #FFE395 A22 #F4F57D A23 #E6C9B7 A24 #F7F8A2 A25 #FFD67D A26 #FFC830
    B1 #E6EE31 B2 #63F347 B3 #9EF780 B4 #5DE035 B5 #35E352 B6 #65E2A6 B7 #3DAF80 B8 #1C9C4F B9 #27523A B10 #95D3C2
    B11 #5D722A B12 #166F41 B13 #CAEB7B B14 #ADE946 B15 #2E5132 B16 #C5ED9C B17 #9BB13A B18 #E6EE49 B19 #24B88C B20 #C2F0CC
    B21 #156A6B B22 #0B3C43 B23 #303A21 B24 #EEFCA5 B25 #4E846D B26 #8D7A35 B27 #CCE1AF B28 #9EE5B9 B29 #C5E254 B30 #E2FCB1
    B31 #B0E792 B32 #9CAB5A
    C1 #E8FFE7 C2 #A9F9FC C3 #A0E2FB C4 #41CCFF C5 #01ACEB C6 #50AAF0 C7 #3677D2 C8 #0F54C0 C9 #324BCA C10 #3EBCE2
    C11 #28DDDE C12 #1C334D C13 #CDE8FF C14 #D5FDFF C15 #22C4C6 C16 #1557A8 C17 #04D1F6 C18 #1D3344 C19 #1887A2 C20 #176DAF
    C21 #BEDDFF C22 #67B4BE C23 #C8E2FF C24 #7CC4FF C25 #A9E5E5 C26 #3CAED8 C27 #D3DFFA C28 #BBCFED C29 #34488E
    D1 #AEB4F2 D2 #858EDD D3 #2F54AF D4 #182A84 D5 #B843C5 D6 #AC7BDE D7 #8854B3 D8 #E2D3FF D9 #D5B9F8 D10 #361851
    D11 #B9BAE1 D12 #DE9AD4 D13 #B90095 D14 #8B279B D15 #2F1F90 D16 #E3E1EE D17 #C4D4F6 D18 #A45EC7 D19 #D8C3D7 D20 #9C32B2
    D21 #9A009B D22 #333A95 D23 #EBDAFC D24 #7786E5 D25 #494FC7 D26 #DFC2F8
    E1 #FDD3CC E2 #FEC0DF E3 #FFB7E7 E4 #E8649E E5 #F551A2 E6 #F13D74 E7 #C63478 E8 #FFDBE9 E9 #E970CC E10 #D33793
    E11 #FCDDD2 E12 #F78FC3 E13 #B5006D E14 #FFD1BA E15 #F8C7C9 E16 #FFF3EB E17 #FFE2EA E18 #FFC7DB E19 #FEBAD5 E20 #D8C7D1
    E21 #BD9DA1 E22 #B785A1 E23 #937A8D E24 #E1BCE8
    F1 #FD957B F2 #FC3D46 F3 #F74941 F4 #FC283C F5 #E7002F F6 #943630 F7 #971937 F8 #BC0028 F9 #E2677A F10 #8A4526
    F11 #5A2121 F12 #FD4E6A F13 #F35744 F14 #FFA9AD F15 #D30022 F16 #FEC2A6 F17 #E69C79 F18 #D37C46 F19 #C1444A F20 #CD9391
    F21 #F7B4C6 F22 #FDC0D0 F23 #F67E66 F24 #E698AA F25 #E54B4F
    G1 #FFE2CE G2 #FFC4AA G3 #F4C3A5 G4 #E1B383 G5 #EDB045 G6 #E99C17 G7 #9D5B3E G8 #753832 G9 #E6B483 G10 #D98C39
    G11 #E0C593 G12 #FFC890 G13 #B7714A G14 #8D614C G15 #FCF9E0 G16 #F2D9BA G17 #78524B G18 #FFE4CC G19 #E07935 G20 #A94023 G21 #B88558
    H1 #FDFBFF H2 #FEFFFF H3 #B6B1BA H4 #89858C H5 #48464E H6 #2F2B2F H7 #000000 H8 #E7D6DB H9 #EDEDED H10 #EEE9EA
    H11 #CECDD5 H12 #FFF5ED H13 #F5ECD2 H14 #CFD7D3 H15 #98A6A8 H16 #1D1414 H17 #F1EDED H18 #FFFDF0 H19 #F6EFE2 H20 #949FA3
    H21 #FFFBE1 H22 #CACAD4 H23 #9A9D94
    M1 #BCC6B8 M2 #8AA386 M3 #697D80 M4 #E3D2BC M5 #D0CCAA M6 #B0A782 M7 #B4A497 M8 #B38281 M9 #A58767 M10 #C5B2BC
    M11 #9F7594 M12 #644749 M13 #D19066 M14 #C77362 M15 #757D78
  `;
  // 解析为 [{code, hex}]：按空白分词后两两配对（降低手写 221 行出错概率）
  const MARD_PALETTE = (() => {
    const t = MARD_RAW.trim().split(/\s+/);
    const arr = [];
    for (let i = 0; i + 1 < t.length; i += 2) arr.push({ code: t[i], hex: t[i + 1] });
    return arr;
  })();

  // G/H/M 系列的官方中文名（来源：公开 MARD 色卡命名）；其余系列用色相自动命名
  const MARD_NAMES = {
    G1:'浅肤色',G2:'浅棕',G3:'淡棕',G4:'土黄棕',G5:'浅棕',G6:'金棕',G7:'浅棕',G8:'深棕',G9:'浅棕',G10:'浅黄棕',
    G11:'浅黄棕',G12:'浅棕',G13:'中棕',G14:'深棕',G15:'极浅棕',G16:'极浅棕',G17:'深棕',G18:'浅肤色',G19:'浅肤色',G20:'红棕',G21:'棕',
    H1:'纯白',H2:'极浅灰',H3:'浅灰',H4:'深灰',H5:'近黑灰',H6:'深灰黑',H7:'纯黑',H8:'浅粉灰',H9:'极浅灰',H10:'浅灰',
    H11:'中灰',H12:'浅米灰',H13:'浅紫灰',H14:'浅蓝灰',H15:'中深灰',H16:'深灰',H17:'极浅灰',H18:'极浅黄绿灰',H19:'浅米灰',H20:'中绿灰',
    H21:'极浅黄绿灰',H22:'中灰',H23:'深灰',
    M1:'浅绿灰',M2:'中绿灰',M3:'深绿灰',M4:'浅米棕',M5:'浅黄棕',M6:'中黄棕',M7:'灰棕',M8:'红棕灰',M9:'红棕灰',M10:'紫棕灰',
    M11:'深紫棕灰',M12:'浅棕色',M13:'浅棕色',M14:'浅棕',M15:'深绿灰'
  };

  // 根据 HEX 粗略推断颜色家族（用于 A–F 等无官方名系列的快速命名）
  function autoName(hex) {
    const [r, g, b] = hexToRgb(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    if (l > 0.94) return '白';
    if (l < 0.08) return '黑';
    if (s < 0.12) return l > 0.6 ? '浅灰' : '灰';
    if (h < 15 || h >= 345) return '红';
    if (h < 45) return l < 0.5 ? '棕' : '橙';
    if (h < 70) return '黄';
    if (h < 160) return '绿';
    if (h < 200) return '青';
    if (h < 250) return '蓝';
    if (h < 290) return '紫';
    return '粉';
  }

  function defaultState() {
    // 默认仓库 = MARD 221 色卡：每个色号初始库存 1000 颗，无存放位置、阈值 0（0 = 使用全局补货阈值）。
    // 不预置任何“演示用”低库存数据，首次使用所有色号库存均为 1000。
    // MARD_PALETTE / MARD_NAMES 同时作为“RGB→标准色号”内部对照，用于图纸识别时做颜色匹配。
    const beads = MARD_PALETTE.map((p, i) => ({
      id: 'b' + (i + 1),
      colorNumber: p.code,
      colorName: MARD_NAMES[p.code] || autoName(p.hex),
      hex: p.hex,
      location: '',
      stock: 1000,
      threshold: 0
    }));
    return {
      beads,
      logs: [],
      recipes: [],
      // 自定义色号映射覆盖表（可选）：识别时优先于内置 221 色卡匹配
      mappings: [],
      settings: {
        enableVision: false, apiKey: '', model: 'gpt-4o-mini',
        sampleTolerance: 48, scaleFactor: 1,
        // 识别模式：'auto' = 智能识别（自动框图+自动行列，最省事）；'grid' = 手动格子数；'pixel' = 像素聚类
        recognizeMode: 'auto',
        gridCols: 80, gridRows: 80,
        // 单元格高宽比（行距 = 列距 × cellAspect）。MARD 标准图纸默认 0.555 ≈ 该图实测行列距比，
        // 不同图纸若行数不对，可在此微调（一般 0.45~0.7）。
        cellAspect: 0.555,
        // 全局补货阈值：库存低于此值即触发“低库存/需补货”预警（可在设置中调整，默认 100）。
        // 单个色号在「豆子仓库」里可单独设置覆盖值（阈值填 0 = 使用此全局值）。
        replenishThreshold: 100
      }
    };
  }

  /* ===================== 2. 存储与会话状态 ===================== */
  let state = load();
  // 旧版 aligned 模式已移除，兼容降级到 auto（智能识别）
  if (state.settings.recognizeMode === 'aligned') state.settings.recognizeMode = 'auto';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // 简单兜底，避免旧数据结构缺字段；settings 需深层补齐（向后兼容旧数据缺失的新增项如 replenishThreshold）
      const merged = Object.assign(defaultState(), parsed);
      merged.settings = Object.assign(defaultState().settings, parsed.settings || {});
      return merged;
    } catch (e) {
      console.warn('读取本地数据失败，使用默认数据', e);
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('保存失败：' + e.message, 'error'); }
    scheduleSync();
  }

  /* ===================== 2.5 云端同步（Supabase，可选） ===================== */
  // 若 config.js 未配置（仍为 YOUR-... 占位），supabase 为 null，所有同步逻辑自动跳过，
  // 应用降级为纯 localStorage，不报错、不影响任何现有功能。
  let supabase = null;
  try {
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
        !/YOUR-/.test(window.SUPABASE_URL) && !/YOUR-/.test(window.SUPABASE_ANON_KEY)) {
      supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  } catch (e) { console.warn('Supabase 初始化失败，降级为 localStorage', e); }
  let currentUser = null;   // 当前登录用户（supabase.auth.user）
  let lastSyncAt = null;    // 上次成功同步时间
  let syncTimer = null;     // 防抖计时器

  // 上传本地 state 到云端（upsert，按 user_id 唯一）
  async function syncPush() {
    if (!supabase || !currentUser) return;
    const { error } = await supabase
      .from('user_state')
      .upsert({ user_id: currentUser.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { console.warn('syncPush 失败', error); toast('云端同步失败：' + error.message, 'error'); }
    else { lastSyncAt = new Date(); }
  }
  // 保存后防抖上传（800ms 内多次保存只上传一次，避免频繁请求）
  function scheduleSync() {
    if (!supabase || !currentUser) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncPush(); }, 800);
  }
  // 从云端拉取并覆盖本地（云端优先；若云端无记录则上传本地）
  async function syncPull() {
    if (!supabase || !currentUser) return;
    const { data, error } = await supabase
      .from('user_state')
      .select('data, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) { toast('云端拉取失败：' + error.message, 'error'); return; }
    if (data && data.data) {
      const merged = Object.assign(defaultState(), data.data);
      merged.settings = Object.assign(defaultState().settings, (data.data && data.data.settings) || {});
      state = merged;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      lastSyncAt = data.updated_at ? new Date(data.updated_at) : new Date();
      toast('已从云端同步', 'success');
    } else {
      await syncPush(); // 云端还没有数据，把本地上传上去
      return;
    }
    if (currentView === 'dashboard') renderDashboard($('#view'));
    else if (currentView === 'warehouse') renderWarehouse($('#view'));
    else if (currentView === 'settings') renderSettings($('#view'));
  }
  // 登录 / 注册
  async function doAuth(mode) {
    if (!supabase) return toast('云端同步未配置', 'error');
    const email = $('#acc-email').value.trim();
    const pass = $('#acc-pass').value;
    if (!email || !pass) return toast('请填写邮箱和密码', 'error');
    if (pass.length < 6) return toast('密码至少 6 位', 'error');
    try {
      const { data, error } = mode === 'signup'
        ? await supabase.auth.signUp({ email, password: pass })
        : await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        console.warn('auth error', error);
        return toast((mode === 'signup' ? '注册' : '登录') + '失败：' + error.message, 'error');
      }
      if (mode === 'signup' && data.user && !data.session) {
        return toast('注册成功，请查收验证邮件后登录', 'success');
      }
      currentUser = (data.session && data.session.user) || data.user || null;
      if (!currentUser) return toast('登录异常，未获取到用户', 'error');
      toast('已登录', 'success');
      await syncPull();
      renderSettings($('#view'));
    } catch (e) {
      console.error('doAuth 异常', e);
      toast((mode === 'signup' ? '注册' : '登录') + '异常：' + (e && e.message ? e.message : String(e)), 'error');
    }
  }
  async function doLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    toast('已退出登录（本机数据已保留）', 'success');
    renderSettings($('#view'));
  }
  // 设置页“账户与同步”卡片内容（按登录态渲染）
  function accountSyncInner() {
    if (!supabase) {
      return `<p class="text-xs text-mk-sub">未配置云端同步（config.js 中未填写 Supabase 项目）。当前数据仅保存在本机浏览器（localStorage），换设备或清缓存会丢失。配置 Supabase 后即可跨设备自动同步。</p>`;
    }
    if (currentUser) {
      return `
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm">已登录：<b>${escapeHtml(currentUser.email || currentUser.id)}</b></span>
          <span class="text-xs text-mk-sub">${lastSyncAt ? '上次同步：' + lastSyncAt.toLocaleString() : '尚未同步'}</span>
          <button id="sync-now" class="px-3 py-1.5 rounded-xl bg-mk-sky text-mk-ink text-sm font-semibold">立即同步</button>
          <button id="sync-out" class="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-500 text-sm font-semibold">退出登录</button>
        </div>
        <p class="text-xs text-mk-sub mt-2">数据已在本地与云端双向同步（每次保存后自动上传，登录/启动时拉取）。换设备登录同一账号即可恢复全部数据。</p>`;
    }
    return `
      <div class="grid sm:grid-cols-2 gap-3 max-w-md">
        <label class="text-sm">邮箱<input id="acc-email" type="email" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="you@example.com"></label>
        <label class="text-sm">密码（至少 6 位）<input id="acc-pass" type="password" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="••••••"></label>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="acc-login" class="px-4 py-2 rounded-xl bg-mk-mint text-mk-ink font-semibold">登录</button>
        <button id="acc-signup" class="px-4 py-2 rounded-xl bg-mk-lav text-mk-ink font-semibold">注册新账号</button>
      </div>
      <p class="text-xs text-mk-sub mt-2">登录后数据将自动同步到云端，可跨设备使用。账号仅用于标识你的数据，不与任何人共享。</p>`;
  }

  /* ===================== 3. 通用工具函数 ===================== */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? h.split('').map(c => c + c).join('')
      : h;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    const c = v => v.toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }
  // 两颜色的欧氏距离（RGB 空间），用于“相近颜色”判定
  function colorDist(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }
  // 亮度（0-1）与饱和度（0-1），用于判断是否为背景/网格线
  function brightness(r, g, b) { return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255; }
  function saturation(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }
  function isBackgroundLike(r, g, b) {
    const l = brightness(r, g, b), s = saturation(r, g, b);
    // 接近纯白、纯黑，或低饱和灰线，均视为背景/网格线
    return l > 0.92 || l < 0.12 || s < 0.1;
  }
  // 为带网格/标注的图纸额外判断：浅灰、米白、浅黄绿等“图纸空白”也当背景
  function isGridBackgroundLike(r, g, b) {
    const l = brightness(r, g, b), s = saturation(r, g, b);
    return l > 0.90 || l < 0.15 || s < 0.12;
  }
  // 从原图指定比例位置取 1 个像素颜色（预览图缩放后点击用）
  function getPixelColorFromImage(img, xRatio, yRatio) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = Math.min(img.width - 1, Math.max(0, Math.round(xRatio * img.width)));
    const py = Math.min(img.height - 1, Math.max(0, Math.round(yRatio * img.height)));
    const d = ctx.getImageData(px, py, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], hex: rgbToHex(d[0], d[1], d[2]) };
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function beadByNumber(num) { return state.beads.find(b => b.colorNumber === num); }
  // 有效补货阈值：单色单独设置且 >0 时优先，否则使用全局默认（设置里的 replenishThreshold）
  function effThreshold(b) {
    return (b.threshold && b.threshold > 0) ? b.threshold : (state.settings.replenishThreshold || 0);
  }
  function isLow(b) { return b.stock < effThreshold(b); }

  /* ===================== 4. 轻提示 Toast ===================== */
  function toast(msg, type = 'info') {
    const colors = { info: 'bg-mk-ink', success: 'bg-emerald-500', error: 'bg-rose-400', warn: 'bg-amber-400' };
    const t = document.createElement('div');
    t.className = `${colors[type] || colors.info} text-white text-sm px-4 py-2 rounded-full shadow-soft transition`;
    t.textContent = msg;
    $('#toast-root').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 1800);
    setTimeout(() => t.remove(), 2300);
  }

  /* ===================== 5. 模态框系统 ===================== */
  function openModal(title, bodyHtml, opts = {}) {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4" id="modal-overlay">
        <div class="mk-card rounded-2xl shadow-soft w-full ${opts.wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] flex flex-col">
          <div class="flex items-center justify-between px-5 py-4 border-b border-mk-sand">
            <h3 class="font-bold text-lg">${escapeHtml(title)}</h3>
            <button class="text-mk-sub hover:text-mk-ink text-xl leading-none" id="modal-close">×</button>
          </div>
          <div class="p-5 overflow-auto" id="modal-body">${bodyHtml}</div>
          <div class="px-5 py-3 border-t border-mk-sand flex justify-end gap-2" id="modal-foot"></div>
        </div>
      </div>`;
    $('#modal-close').onclick = closeModal;
    $('#modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') closeModal(); };
    return $('#modal-body');
  }
  function setModalFoot(html) { $('#modal-foot').innerHTML = html; }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  /* ====================================================================
   * 6. 核心算法 A：图纸取色聚类统计
   * --------------------------------------------------------------------
   * 思路（纯前端、无云端 AI）：
   *   1) 把上传图片画到离屏 canvas，并按最长边缩放到 ~300px，
   *      既保证像素≈豆子（拼豆图纸常为“每像素=1颗豆”的小图），
   *      又避免大图（照片）采样过慢。
   *   2) 遍历像素，跳过透明像素；对每个不透明像素：
   *        - 在已有“颜色桶”里寻找欧氏距离 <= 容差 的桶；
   *        - 找到则该桶计数 +1；找不到则新建一个桶。
   *      （容差聚类：把光照/抗锯齿造成的轻微色差归并到同一颜色）
   *   3) 每个桶 = 图纸中的一种颜色；桶的像素数 ≈ 需要的豆子数。
   *   scaleFactor（默认 1）可用于“每多少像素折算 1 颗豆”的微调。
   * ==================================================================== */
  function clusterImageColors(img, tolerance, ignoreColors = []) {
    const MAX = 300;
    let { width: w, height: h } = img;
    const scale = Math.min(1, MAX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;

    const buckets = []; // { r,g,b,count }
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // 跳过透明背景
      const r = data[i], g = data[i + 1], b = data[i + 2];

      // 跳过用户标记的忽略颜色（背景/网格线）
      let ignored = false;
      for (const ig of ignoreColors) {
        if (colorDist(r, g, b, ig.r, ig.g, ig.b) <= (ig.tolerance || 24)) { ignored = true; break; }
      }
      if (ignored) continue;

      let hit = null;
      for (const bk of buckets) {
        if (colorDist(r, g, b, bk.r, bk.g, bk.b) <= tolerance) { hit = bk; break; }
      }
      if (hit) {
        // 用 running average 更新桶心颜色，减少光照/抗锯齿造成的漂移
        hit.r = Math.round((hit.r * hit.count + r) / (hit.count + 1));
        hit.g = Math.round((hit.g * hit.count + g) / (hit.count + 1));
        hit.b = Math.round((hit.b * hit.count + b) / (hit.count + 1));
        hit.count++;
      } else buckets.push({ r, g, b, count: 1 });
    }
    return buckets;
  }

  /* ====================================================================
   * 6.5 核心算法 A2：格子中心采样（专为带色号标注的图纸设计）
   * --------------------------------------------------------------------
   * 问题：很多拼豆图纸在每个格子里印有“色号数字/字母”。
   * 如果直接做像素聚类，文字颜色会被当成独立颜色，导致结果零散、主色被稀释。
   * 解决：用户输入图纸的列数(rows)和行数(cols)，程序把图等分为若干格子，
   * 对每个格子的中心小区域取色，并取该区域内的“众数颜色”作为该格子的代表色。
   * 这样能避开格子边缘的网格线和格子内部的文字标注，得到接近真实豆子分布的统计。
   * ==================================================================== */
  function sampleByGrid(img, cols, rows, ignoreColors = [], tolerance = 24) {
    const MAX = 1200; // 格子采样需要更高分辨率，才能区分格子和文字
    let { width: w, height: h } = img;
    const scale = Math.min(1, MAX / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;

    const cellW = cw / cols;
    const cellH = ch / rows;
    const cellColors = []; // 每个格子的代表色 {r,g,b,count:1}

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // 取格子中心 36% 区域，避开网格线边缘和大部分文字
        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;
        const rw = cellW * 0.36;
        const rh = cellH * 0.36;
        const sx = Math.max(0, Math.round(cx - rw / 2));
        const sy = Math.max(0, Math.round(cy - rh / 2));
        const ex = Math.min(cw, Math.round(cx + rw / 2));
        const ey = Math.min(ch, Math.round(cy + rh / 2));

        // 统计中心区域内每种颜色的出现次数，取众数
        const freq = new Map(); // hex -> {r,g,b,count}
        for (let py = sy; py < ey; py++) {
          for (let px = sx; px < ex; px++) {
            const idx = (py * cw + px) * 4;
            const a = data[idx + 3];
            if (a < 128) continue;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];

            // 跳过忽略色与自动背景色
            let ignored = false;
            for (const ig of ignoreColors) {
              if (colorDist(r, g, b, ig.r, ig.g, ig.b) <= (ig.tolerance || 24)) { ignored = true; break; }
            }
            if (ignored || isGridBackgroundLike(r, g, b)) continue;

            const hex = rgbToHex(r, g, b);
            if (freq.has(hex)) freq.get(hex).count++;
            else freq.set(hex, { r, g, b, count: 1 });
          }
        }

        let best = null, bestCount = 0;
        for (const v of freq.values()) {
          if (v.count > bestCount) { best = v; bestCount = v.count; }
        }
        // 如果该格子中心区域剩下的主色仍然是背景/空白，整个格子跳过
        if (best && isGridBackgroundLike(best.r, best.g, best.b)) continue;
        // 关键：每个格子只计 1 颗豆，不要携带中心区域的像素数
        if (best) cellColors.push({ r: best.r, g: best.g, b: best.b, count: 1 });
      }
    }

    // 对格子代表色做二次轻聚类（合并相近色），得到最终颜色桶
    // tolerance 使用用户设置的聚类容差，避免把同一色号因轻微色差拆成多行
    const buckets = [];
    for (const c of cellColors) {
      let hit = null;
      for (const bk of buckets) {
        if (colorDist(c.r, c.g, c.b, bk.r, bk.g, bk.b) <= tolerance) { hit = bk; break; }
      }
      if (hit) {
        hit.r = Math.round((hit.r * hit.count + c.r) / (hit.count + 1));
        hit.g = Math.round((hit.g * hit.count + c.g) / (hit.count + 1));
        hit.b = Math.round((hit.b * hit.count + c.b) / (hit.count + 1));
        hit.count++; // 累加的是“格子数”，不是像素数
      } else buckets.push({ r: c.r, g: c.g, b: c.b, count: 1 });
    }
    return buckets;
  }

  /* 在框选区域内均匀采样（兜底：没检测到网格线时用） */
  function sampleByGridInRegion(img, region, cols, rows, ignoreColors = [], tolerance = 24) {
    const MAX = 1200;
    const { w, h, ctx } = createAnalysisCanvas(img, MAX);
    const data = ctx.getImageData(0, 0, w, h).data;
    const x0 = region.x * w, y0 = region.y * h;
    const rw = region.w * w, rh = region.h * h;
    const cellW = rw / cols, cellH = rh / rows;
    const cellColors = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = x0 + (x + 0.5) * cellW;
        const cy = y0 + (y + 0.5) * cellH;
        const halfX = cellW * 0.30, halfY = cellH * 0.30;
        const sx = Math.max(0, Math.round(cx - halfX));
        const sy = Math.max(0, Math.round(cy - halfY));
        const ex = Math.min(w, Math.round(cx + halfX));
        const ey = Math.min(h, Math.round(cy + halfY));
        const freq = new Map();
        for (let py = sy; py < ey; py++) {
          for (let px = sx; px < ex; px++) {
            const idx = (py * w + px) * 4;
            const a = data[idx + 3];
            if (a < 128) continue;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            let ignored = false;
            for (const ig of ignoreColors) {
              if (colorDist(r, g, b, ig.r, ig.g, ig.b) <= (ig.tolerance || 24)) { ignored = true; break; }
            }
            if (ignored || isGridBackgroundLike(r, g, b)) continue;
            const hex = rgbToHex(r, g, b);
            if (freq.has(hex)) freq.get(hex).count++;
            else freq.set(hex, { r, g, b, count: 1 });
          }
        }
        let best = null, bestCount = 0;
        for (const v of freq.values()) {
          if (v.count > bestCount) { best = v; bestCount = v.count; }
        }
        if (best && isGridBackgroundLike(best.r, best.g, best.b)) continue;
        if (best) cellColors.push({ r: best.r, g: best.g, b: best.b, count: 1 });
      }
    }
    const buckets = [];
    for (const c of cellColors) {
      let hit = null;
      for (const bk of buckets) {
        if (colorDist(c.r, c.g, c.b, bk.r, bk.g, bk.b) <= tolerance) { hit = bk; break; }
      }
      if (hit) {
        hit.r = Math.round((hit.r * hit.count + c.r) / (hit.count + 1));
        hit.g = Math.round((hit.g * hit.count + c.g) / (hit.count + 1));
        hit.b = Math.round((hit.b * hit.count + c.b) / (hit.count + 1));
        hit.count++;
      } else buckets.push({ r: c.r, g: c.g, b: c.b, count: 1 });
    }
    return buckets;
  }

  /* ====================================================================
   * 7. 核心算法 B：色号映射（采样 RGB → 标准拼豆色号）
   * --------------------------------------------------------------------
   * 优先级：
   *   1) 色卡对照表精确匹配：cluster _rgb 与 mapping.hex 距离 <= mapping.tolerance
   *      → 直接采用该 mapping 指向的标准色号（最可靠，建议用户维护此表）。
   *   2) 库存近似匹配：没有对照表命中时，在所有库存豆子里找“最近的色值”，
   *      距离 <= 较大容差(60) 则标记为“近似匹配”，仍需用户确认。
   *   3) 均未命中 → matched=false，弹窗中由用户手动从下拉框选择色号。
   * 返回 { colorNumber, colorName, hex, matched, matchedBy }
   * ==================================================================== */
  function mapColorToStandard(r, g, b) {
    // 1) 色卡对照表
    let best = null, bestD = Infinity;
    for (const m of state.mappings) {
      const [mr, mg, mb] = hexToRgb(m.hex);
      const d = colorDist(r, g, b, mr, mg, mb);
      if (d <= (m.tolerance || 40) && d < bestD) { best = m; bestD = d; }
    }
    if (best) {
      const bead = beadByNumber(best.colorNumber);
      return { colorNumber: best.colorNumber, colorName: bead ? bead.colorName : '', hex: bead ? bead.hex : rgbToHex(r, g, b), matched: true, matchedBy: '对照表', distance: bestD };
    }
    // 2) 库存近似匹配
    let near = null, nearD = Infinity;
    for (const bead of state.beads) {
      const [br, bg, bb] = hexToRgb(bead.hex);
      const d = colorDist(r, g, b, br, bg, bb);
      if (d < nearD) { nearD = d; near = bead; }
    }
    if (near && nearD <= 60) {
      return { colorNumber: near.colorNumber, colorName: near.colorName, hex: near.hex, matched: true, matchedBy: '近似', distance: nearD };
    }
    // 3) 未命中
    return { colorNumber: '', colorName: '', hex: rgbToHex(r, g, b), matched: false, matchedBy: '', distance: Infinity };
  }

  /* ===================== 8. 云端视觉 AI（可选 VLM 路径） ===================== */
  // 若用户在“设置”开启 OpenAI Vision 并填了 Key，可走 VLM 直接产出结构化 JSON。
  // 与像素聚类路径共享同一套“弹窗校对”流程。
  async function callVisionAPI(dataUrl, apiKey, model) {
    const prompt = `这是一张拼豆(Perler/Hama)图纸。请识别图中每一种颜色对应的像素(豆子)数量，并尽量映射为拼豆标准色号。
只返回一个 JSON 对象，形如 {"items":[{"colorNumber":"色号或空串","colorName":"颜色名","hex":"#RRGGBB","count":数量}]}，不要输出任何其他文字。`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ] }]
      })
    });
    if (!res.ok) throw new Error('Vision API ' + res.status);
    const j = await res.json();
    const parsed = JSON.parse(j.choices[0].message.content);
    return (parsed.items || []).map(it => ({
      r: hexToRgb(it.hex || '#000000')[0],
      g: hexToRgb(it.hex || '#000000')[1],
      b: hexToRgb(it.hex || '#000000')[2],
      count: Math.max(0, parseInt(it.count) || 0),
      colorNumber: it.colorNumber || '',
      colorName: it.colorName || '',
      hex: it.hex || '#000000',
      matched: !!it.colorNumber,
      matchedBy: it.colorNumber ? 'VLM' : ''
    }));
  }

  /* ===================== 9. 操作日志 ===================== */
  function addLog(type, bead, qty, note) {
    state.logs.unshift({
      id: uid('l'), ts: Date.now(), type, colorNumber: bead.colorNumber,
      colorName: bead.colorName, qty, balance: bead.stock, note: note || ''
    });
    if (state.logs.length > 1000) state.logs.length = 1000;
  }

  /* ===================== 10. 导航与视图路由 ===================== */
  const VIEWS = [
    { key: 'dashboard',  label: '仪表盘' },
    { key: 'warehouse', label: '豆子仓库' },
    { key: 'recognize', label: '图纸识别' },
    { key: 'recipes',   label: '配方库' },
    { key: 'logs',      label: '操作记录' },
    { key: 'settings',  label: '设置' }
  ];
  let currentView = 'dashboard';

  function renderNav() {
    $('#nav').innerHTML = VIEWS.map(v =>
      `<button class="nav-btn px-3 py-1.5 rounded-xl text-sm font-semibold text-mk-sub whitespace-nowrap ${v.key === currentView ? 'active' : 'hover:bg-white/60'}" data-view="${v.key}">${v.label}</button>`
    ).join('');
    $$('#nav .nav-btn').forEach(btn => btn.onclick = () => switchView(btn.dataset.view));
  }
  function switchView(key) {
    currentView = key;
    renderNav();
    const v = $('#view');
    if (key === 'dashboard')  renderDashboard(v);
    if (key === 'warehouse')  renderWarehouse(v);
    if (key === 'recognize')  renderRecognize(v);
    if (key === 'recipes')    renderRecipes(v);
    if (key === 'logs')       renderLogs(v);
    if (key === 'settings')   renderSettings(v);
  }

  /* ===================== 11. 仪表盘 ===================== */
  function renderDashboard(v) {
    const low = state.beads.filter(isLow);
    const totalStock = state.beads.reduce((s, b) => s + b.stock, 0);
    const recent = state.logs.slice(0, 6);

    v.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        ${statCard('色号种类', state.beads.length, '🌈', 'from-mk-pink to-mk-rose')}
        ${statCard('当前总库存', totalStock, '📦', 'from-mk-sky to-mk-mint')}
        ${statCard('低库存预警', low.length, '⚠️', 'from-mk-peach to-mk-lemon', low.length ? 'text-rose-500' : '')}
        ${statCard('操作记录', state.logs.length, '📝', 'from-mk-lav to-mk-sky')}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">🚨 低库存预警（低于补货阈值）</h3>
          ${low.length ? `<div class="space-y-2">${low.map(b => lowRow(b)).join('')}</div>`
            : '<p class="text-mk-sub text-sm">暂无预警，库存充足 ✨</p>'}
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">🕘 最近操作</h3>
          ${recent.length ? `<div class="space-y-2">${recent.map(logRow).join('')}</div>`
            : '<p class="text-mk-sub text-sm">还没有操作记录</p>'}
        </section>
      </div>

      <section class="mk-card rounded-2xl shadow-soft p-5 mt-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold">🎨 库存色号概览</h3>
          <div class="flex gap-2">
            <button id="dash-in" class="px-3 py-1.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white shadow-soft">入库</button>
            <button id="dash-out" class="px-3 py-1.5 rounded-xl text-sm font-semibold bg-mk-rose text-white shadow-soft">出库</button>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${state.beads.map(b => `
            <button class="dash-color flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/70 border border-mk-sand hover:ring-2 hover:ring-mk-rose transition ${isLow(b) ? 'ring-2 ring-rose-300' : ''}" data-num="${b.colorNumber}">
              <span class="w-5 h-5 rounded-full swatch" style="background:${b.hex}"></span>
              <span class="text-sm font-semibold">${b.colorNumber}</span>
              <span class="text-xs text-mk-sub">${escapeHtml(b.colorName)}</span>
              <span class="text-xs ${isLow(b) ? 'text-rose-500 font-bold' : 'text-mk-sub'}">${b.stock}</span>
            </button>`).join('')}
        </div>
        <p class="text-xs text-mk-sub mt-2">💡 点击色号可跳转到「豆子仓库」对应色号；右上角按钮可批量入库 / 出库。</p>
      </section>`;

    $$('.dash-color', v).forEach(btn => btn.onclick = () => {
      whFilterLow = false;
      pendingWarehouseColor = btn.dataset.num;
      switchView('warehouse');
    });
    const di = $('#dash-in'); if (di) di.onclick = () => openBatchStock('入库');
    const dout = $('#dash-out'); if (dout) dout.onclick = () => openBatchStock('出库');
    $$('.low-stock-row', v).forEach(btn => btn.onclick = () => {
      whFilterLow = false;
      pendingWarehouseColor = btn.dataset.num;
      switchView('warehouse');
    });
  }
  function statCard(label, val, icon, grad, valColor = 'text-mk-ink') {
    return `<div class="mk-card rounded-2xl shadow-soft p-4 bg-gradient-to-br ${grad}">
      <div class="text-2xl">${icon}</div>
      <div class="text-2xl font-bold ${valColor} mt-1">${val}</div>
      <div class="text-xs text-mk-ink/70 font-semibold">${label}</div>
    </div>`;
  }
  function lowRow(b) {
    return `<button class="low-stock-row w-full flex items-center justify-between bg-rose-50/70 rounded-xl px-3 py-2 text-left hover:ring-2 hover:ring-rose-300 transition" data-num="${b.colorNumber}">
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full swatch" style="background:${b.hex}"></span>
        <span class="font-semibold text-sm">${b.colorNumber} ${escapeHtml(b.colorName)}</span>
      </div>
      <span class="text-sm text-rose-500 font-bold">${b.stock} / 阈值 ${effThreshold(b)}${(b.threshold && b.threshold > 0) ? '' : ' <span class="text-[10px]">默认</span>'}</span>
    </button>`;
  }
  function logRow(l) {
    const color = { 入库: 'text-emerald-600', 出库: 'text-rose-500', 消耗: 'text-rose-500', 图纸消耗: 'text-amber-600', 配方扣减: 'text-purple-600' }[l.type] || 'text-mk-ink';
    const sign = l.qty > 0 ? '+' : '';
    return `<div class="flex items-center justify-between text-sm border-b border-mk-sand/60 pb-1.5">
      <span class="text-mk-sub">${fmtTime(l.ts)}</span>
      <span class="font-semibold">${l.type}</span>
      <span class="${color} font-bold">${sign}${l.qty}</span>
      <span class="text-mk-sub">${l.colorNumber} ${escapeHtml(l.colorName)}</span>
    </div>`;
  }

  /* ===================== 12. 豆子仓库 ===================== */
  let whFilterLow = false;
  let pendingWarehouseColor = null; // 从仪表盘点击色号后要跳转/高亮的色号
  function renderWarehouse(v) {
    let list = state.beads.slice();
    if (whFilterLow) list = list.filter(isLow);

    v.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-xl font-bold">📦 豆子仓库</h2>
        <div class="flex gap-2">
          <button id="wh-filter" class="px-3 py-1.5 rounded-xl text-sm font-semibold ${whFilterLow ? 'bg-rose-200 text-rose-700' : 'bg-white/70 text-mk-sub'}">仅看低库存</button>
          <button id="wh-add" class="px-3 py-1.5 rounded-xl text-sm font-semibold bg-mk-rose text-white shadow-soft">+ 新增豆子</button>
        </div>
      </div>
      <div class="mk-card rounded-2xl shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-mk-sand/40 text-mk-sub">
              <tr>
                <th class="px-3 py-2 text-left">色号</th><th class="px-3 py-2 text-left">颜色</th>
                <th class="px-3 py-2 text-left">色值</th><th class="px-3 py-2 text-left">存放位置</th>
                <th class="px-3 py-2 text-right">库存</th><th class="px-3 py-2 text-right">补货阈值</th>
                <th class="px-3 py-2 text-center">状态</th><th class="px-3 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              ${list.length ? list.map(beadRow).join('') : `<tr><td colspan="8" class="text-center text-mk-sub py-6">暂无数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    $('#wh-add').onclick = openAddBead;
    $('#wh-filter').onclick = () => { whFilterLow = !whFilterLow; renderWarehouse(v); };
    $$('.bead-edit').forEach(b => b.onclick = () => openAddBead(b.dataset.id));
    $$('.bead-adj').forEach(b => b.onclick = () => openAdjust(b.dataset.id));
    $$('.bead-del').forEach(b => b.onclick = () => deleteBead(b.dataset.id));
    if (pendingWarehouseColor) {
      const target = pendingWarehouseColor; pendingWarehouseColor = null;
      const row = $$('tr[data-num]').find(tr => tr.dataset.num === target);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('ring-2', 'ring-mk-rose', 'bg-mk-rose/5');
        setTimeout(() => row.classList.remove('ring-2', 'ring-mk-rose', 'bg-mk-rose/5'), 2600);
      }
    }
  }
  function beadRow(b) {
    const low = isLow(b);
    return `<tr class="border-t border-mk-sand/50" data-num="${b.colorNumber}">
      <td class="px-3 py-2 font-bold">${b.colorNumber}</td>
      <td class="px-3 py-2">${escapeHtml(b.colorName)}</td>
      <td class="px-3 py-2"><span class="inline-flex items-center gap-1"><span class="w-4 h-4 rounded-full swatch inline-block" style="background:${b.hex}"></span><span class="text-xs text-mk-sub">${b.hex}</span></span></td>
      <td class="px-3 py-2 text-mk-sub">${escapeHtml(b.location)}</td>
      <td class="px-3 py-2 text-right font-semibold ${low ? 'text-rose-500' : ''}">${b.stock}</td>
      <td class="px-3 py-2 text-right text-mk-sub">${effThreshold(b)}${(b.threshold && b.threshold > 0) ? '' : ' <span class="text-[10px]">默认</span>'}</td>
      <td class="px-3 py-2 text-center">${low ? '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold">补货</span>' : '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs">正常</span>'}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">
        <button class="bead-adj text-xs px-2 py-1 rounded-lg bg-mk-mint text-mk-ink font-semibold mr-1" data-id="${b.id}">入库/消耗</button>
        <button class="bead-edit text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand text-mk-sub" data-id="${b.id}">编辑</button>
        <button class="bead-del text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-400" data-id="${b.id}">删</button>
      </td>
    </tr>`;
  }
  function openAddBead(id) {
    const b = id ? state.beads.find(x => x.id === id) : null;
    const stdOpts = MARD_PALETTE.map(p => {
      const nm = MARD_NAMES[p.code] || autoName(p.hex);
      return `<option value="${p.code}" data-hex="${p.hex}" data-name="${escapeHtml(nm)}">${p.code} · ${escapeHtml(nm)}</option>`;
    }).join('');
    const body = `
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm col-span-2">从 MARD 221 标准色卡选择（可选）<select id="f-std" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand"><option value="">— 不使用标准色卡，手动填写 —</option>${stdOpts}</select></label>
        <label class="text-sm">色号<input id="f-num" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.colorNumber : ''}" placeholder="如 P13"></label>
        <label class="text-sm">颜色名称<input id="f-name" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.colorName : ''}" placeholder="如 湖蓝"></label>
        <label class="text-sm">色值(HEX)<input id="f-hex" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.hex : '#FFFFFF'}" type="color"></label>
        <label class="text-sm">存放位置<input id="f-loc" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.location : ''}" placeholder="如 E盒-2"></label>
        <label class="text-sm">当前库存<input id="f-stock" type="number" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.stock : 1000}"></label>
        <label class="text-sm">补货阈值（填 0 = 用全局默认 ${state.settings.replenishThreshold}）<input id="f-thr" type="number" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${b ? b.threshold : 0}"></label>
      </div>`;
    openModal(b ? '编辑豆子' : '新增豆子', body);
    const fstd = $('#f-std');
    if (fstd) fstd.onchange = () => {
      const opt = fstd.options[fstd.selectedIndex];
      if (!opt.value) return;
      $('#f-num').value = opt.value;
      $('#f-name').value = opt.getAttribute('data-name') || '';
      $('#f-hex').value = opt.getAttribute('data-hex') || '#FFFFFF';
    };
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="(function(){document.getElementById('modal-root').innerHTML=''})()">取消</button>
      <button id="f-save" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">保存</button>`);
    $('#f-save').onclick = () => {
      const num = $('#f-num').value.trim();
      if (!num) return toast('请填写色号', 'error');
      const dup = state.beads.find(x => x.colorNumber === num && x.id !== (b && b.id));
      if (dup) return toast('色号已存在', 'error');
      const data = {
        colorNumber: num, colorName: $('#f-name').value.trim() || '未命名',
        hex: $('#f-hex').value, location: $('#f-loc').value.trim(),
        stock: parseInt($('#f-stock').value) || 0, threshold: parseInt($('#f-thr').value) || 0
      };
      if (b) Object.assign(b, data);
      else state.beads.push({ id: uid('b'), ...data });
      save(); closeModal(); renderWarehouse($('#view')); toast('已保存', 'success');
    };
  }
  function openAdjust(id) {
    const b = state.beads.find(x => x.id === id);
    const body = `
      <div class="flex items-center gap-3 mb-3">
        <span class="w-10 h-10 rounded-full swatch" style="background:${b.hex}"></span>
        <div><div class="font-bold">${b.colorNumber} ${escapeHtml(b.colorName)}</div><div class="text-sm text-mk-sub">当前库存 ${b.stock}</div></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm">类型<select id="a-type" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand"><option value="入库">入库（增加）</option><option value="消耗">消耗（减少）</option></select></label>
        <label class="text-sm">数量<input id="a-qty" type="number" min="1" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="10"></label>
      </div>
      <label class="text-sm block mt-3">备注<input id="a-note" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="可选"></label>`;
    openModal('入库 / 消耗', body);
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="a-ok" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">确认</button>`);
    $('#a-ok').onclick = () => {
      const type = $('#a-type').value;
      let qty = parseInt($('#a-qty').value) || 0;
      if (qty <= 0) return toast('数量需大于 0', 'error');
      if (type === '消耗') qty = -qty;
      b.stock = Math.max(0, b.stock + qty);
      addLog(type, b, qty, $('#a-note').value.trim());
      save(); closeModal(); renderWarehouse($('#view')); toast('已记录', 'success');
    };
  }
  function deleteBead(id) {
    const b = state.beads.find(x => x.id === id);
    if (!confirm(`确认删除 ${b.colorNumber} ${b.colorName}？`)) return;
    state.beads = state.beads.filter(x => x.id !== id);
    save(); renderWarehouse($('#view')); toast('已删除', 'success');
  }
  // 仪表盘批量入库 / 出库：多选色号，统一或分别设置数量后一次性应用
  function openBatchStock(type) {
    const isIn = type === '入库';
    const checked = new Set();
    const qtys = new Map();
    let filterText = '';
    const bodyId = 'batch-body';
    function renderList() {
      const q = (filterText || '').trim().toLowerCase();
      const items = state.beads.filter(b =>
        !q || b.colorNumber.toLowerCase().includes(q) || (b.colorName || '').toLowerCase().includes(q)
      );
      $('#' + bodyId).innerHTML = items.map(b => `
        <div class="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/70 border border-mk-sand ${checked.has(b.colorNumber) ? 'ring-2 ring-mk-rose' : ''}">
          <input type="checkbox" class="batch-chk" data-num="${b.colorNumber}" ${checked.has(b.colorNumber) ? 'checked' : ''}>
          <span class="w-5 h-5 rounded-full swatch" style="background:${b.hex}"></span>
          <span class="text-sm font-semibold w-12">${b.colorNumber}</span>
          <span class="text-xs text-mk-sub flex-1 truncate">${escapeHtml(b.colorName)}</span>
          <span class="text-xs text-mk-sub w-16 text-right">库存 ${b.stock}</span>
          <input type="number" min="0" class="batch-qty w-20 px-2 py-1 rounded-lg bg-white border border-mk-sand" data-num="${b.colorNumber}" value="${qtys.has(b.colorNumber) ? qtys.get(b.colorNumber) : 10}" ${checked.has(b.colorNumber) ? '' : 'disabled'}>
        </div>`).join('');
      $$('#' + bodyId + ' .batch-chk').forEach(c => c.onchange = () => {
        if (c.checked) { checked.add(c.dataset.num); if (!qtys.has(c.dataset.num)) qtys.set(c.dataset.num, $('#batch-all').value || '10'); }
        else checked.delete(c.dataset.num);
        renderList();
      });
      $$('#' + bodyId + ' .batch-qty').forEach(inp => inp.oninput = () => { if (checked.has(inp.dataset.num)) qtys.set(inp.dataset.num, inp.value); });
      const cnt = $('#batch-count'); if (cnt) cnt.textContent = checked.size;
    }
    const body = `
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <div class="text-sm font-semibold">操作类型：<span class="${isIn ? 'text-emerald-600' : 'text-rose-500'}">${type}</span></div>
        <label class="text-sm flex items-center gap-2">统一数量<input id="batch-all" type="number" min="0" value="10" class="px-2 py-1 rounded-lg bg-white border border-mk-sand w-24"></label>
      </div>
      <input id="batch-search" placeholder="搜索色号 / 名称…" class="w-full px-3 py-2 mb-3 rounded-xl bg-white/70 border border-mk-sand text-sm">
      <div id="${bodyId}" class="space-y-1.5 max-h-[46vh] overflow-auto"></div>
      <div class="text-sm text-mk-sub mt-2">已选 <span id="batch-count" class="font-bold text-mk-ink">0</span> 个色号</div>`;
    openModal(isIn ? '批量入库' : '批量出库', body, { wide: true });
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="batch-ok" class="px-4 py-2 rounded-xl ${isIn ? 'bg-emerald-500' : 'bg-mk-rose'} text-white font-semibold shadow-soft">确认${type}</button>`);
    $('#batch-search').oninput = (e) => { filterText = e.target.value; renderList(); };
    $('#batch-all').oninput = (e) => {
      const val = e.target.value;
      $$('#' + bodyId + ' .batch-qty').forEach(inp => { if (checked.has(inp.dataset.num)) { inp.value = val; qtys.set(inp.dataset.num, val); } });
    };
    renderList();
    $('#batch-ok').onclick = () => {
      const sel = state.beads.filter(b => checked.has(b.colorNumber));
      if (!sel.length) return toast('请至少选择一个色号', 'error');
      let done = 0;
      sel.forEach(b => {
        const inp = $$('#' + bodyId + ' .batch-qty').find(x => x.dataset.num === b.colorNumber);
        const qty = parseInt(inp ? inp.value : (qtys.get(b.colorNumber) || '10')) || 0;
        if (qty <= 0) return;
        const dq = isIn ? qty : -qty;
        b.stock = Math.max(0, b.stock + dq);
        addLog(type, b, dq, '批量' + type);
        done++;
      });
      save();
      closeModal();
      if (currentView === 'dashboard') renderDashboard($('#view'));
      else renderWarehouse($('#view'));
      toast(`已${type} ${done} 个色号`, 'success');
    };
  }

  /* ===================== 13. 图纸识别上传页 ===================== */
  let tempImage = null;       // 已上传图片的 dataURL
  let recognitionResult = []; // 识别结果数组（模态框校对用）
  let tempIgnoreColors = [];  // 本次识别手动标记的忽略颜色（背景/网格线）
  let tempAlignPoints = [];   // （旧版十字格对齐点，已弃用，保留兼容）
  let recognitionResultSampleInfo = ''; // 识别统计信息（弹窗顶部展示）
  let tempCropRegion = null;  // 当前选中的识别区域（归一化 0~1 的 {x,y,w,h}）
  let tempDetectedRegions = []; // 自动检测到的候选图案区域
  let tempDetectedVLines = [];  // 选中区域内检测到的垂直网格线（归一化 0~1）
  let tempDetectedHLines = [];  // 选中区域内检测到的水平网格线（归一化 0~1）
  let tempDetectedFramePx = null; // 检测到的图纸边框（分析画布像素坐标 {gx0,gy0,gx1,gy1,aw,ah}），用于按行列数重排网格


  /* ---------- 图纸识别辅助：自动框选、格子检测、画布编辑 ---------- */

  // 将图片缩放到最大边 <= max，返回 {canvas, ctx, scale, w, h}
  function createAnalysisCanvas(img, max = 1200) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, ctx, scale, w, h };
  }

  // 检测图片中的候选网格区域，返回归一化矩形数组 {x,y,w,h}
  function detectCandidateRegions(img) {
    const { w, h, ctx } = createAnalysisCanvas(img, 500);
    const data = ctx.getImageData(0, 0, w, h).data;
    // 网格响应：暗色 + 局部梯度大
    const score = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const dark = 255 - lum;
        const li = (y * w + (x - 1)) * 4, ri = (y * w + (x + 1)) * 4;
        const ti = ((y - 1) * w + x) * 4, bi = ((y + 1) * w + x) * 4;
        const gx = Math.abs(data[ri] + data[ri + 1] + data[ri + 2] - data[li] - data[li + 1] - data[li + 2]);
        const gy = Math.abs(data[bi] + data[bi + 1] + data[bi + 2] - data[ti] - data[ti + 1] - data[ti + 2]);
        score[y * w + x] = dark * 0.4 + Math.max(gx, gy) * 0.6;
      }
    }
    // 滑动窗口找高分区域
    const step = Math.max(12, Math.floor(Math.min(w, h) / 16));
    const win = step * 2;
    const windows = [];
    for (let y = 0; y + win <= h; y += step) {
      for (let x = 0; x + win <= w; x += step) {
        let s = 0;
        for (let yy = y; yy < y + win; yy++) {
          for (let xx = x; xx < x + win; xx++) s += score[yy * w + xx];
        }
        windows.push({ x, y, w: win, h: win, score: s });
      }
    }
    windows.sort((a, b) => b.score - a.score);
    // 非极大值抑制
    const picked = [];
    for (const b of windows.slice(0, 24)) {
      const bx1 = b.x + b.w, by1 = b.y + b.h;
      let overlap = false;
      for (const p of picked) {
        const px1 = p.x + p.w, py1 = p.y + p.h;
        const ix = Math.max(0, Math.min(bx1, px1) - Math.max(b.x, p.x));
        const iy = Math.max(0, Math.min(by1, py1) - Math.max(b.y, p.y));
        if (ix * iy > b.w * b.h * 0.5) { overlap = true; break; }
      }
      if (!overlap) picked.push(b);
      if (picked.length >= 4) break;
    }
    const regions = picked.map(p => ({ x: p.x / w, y: p.y / h, w: p.w / w, h: p.h / h }));
    if (!regions.length) regions.push({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    return regions;
  }

  // 1D 投影中找周期性峰（网格线）
  function findPeriodicPeaks(proj, minPeriod) {
    const smooth = proj.map((v, i) => {
      let s = 0, c = 0;
      for (let d = -2; d <= 2; d++) {
        const j = i + d;
        if (j >= 0 && j < proj.length) { s += proj[j]; c++; }
      }
      return s / c;
    });
    const mean = smooth.reduce((a, b) => a + b, 0) / smooth.length;
    const std = Math.sqrt(smooth.reduce((a, b) => a + (b - mean) ** 2, 0) / smooth.length);
    const threshold = mean + std * 0.7;
    // 找局部最大
    const peaks = [];
    for (let i = 3; i < smooth.length - 3; i++) {
      if (smooth[i] > threshold &&
          smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] &&
          smooth[i] >= smooth[i - 2] && smooth[i] >= smooth[i + 2] &&
          smooth[i] >= smooth[i - 3] && smooth[i] >= smooth[i + 3]) {
        peaks.push(i);
      }
    }
    if (peaks.length < 2) return [];
    // 估算周期
    const gaps = [];
    for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1]);
    const period = estimateMode(gaps);
    if (!period || period < minPeriod) return peaks;
    // 按周期规整峰序列，补全缺失
    const refined = [peaks[0]];
    for (let i = 1; i < peaks.length; i++) {
      const gap = peaks[i] - refined[refined.length - 1];
      const missing = Math.max(0, Math.round(gap / period) - 1);
      for (let m = 1; m <= missing; m++) {
        const pos = refined[refined.length - 1] + Math.round(period * m);
        if (pos > 0 && pos < smooth.length && smooth[pos] > mean) refined.push(pos);
      }
      refined.push(peaks[i]);
    }
    // 合并过近峰
    const merged = [];
    for (const p of refined) {
      if (!merged.length || p - merged[merged.length - 1] > period * 0.4) merged.push(p);
      else if (smooth[p] > smooth[merged[merged.length - 1]]) merged[merged.length - 1] = p;
    }
    return merged;
  }

  function estimateMode(arr) {
    if (!arr.length) return 0;
    const hist = {};
    for (const v of arr) {
      const b = Math.round(v / 2) * 2;
      hist[b] = (hist[b] || 0) + 1;
    }
    let best = 0, bestC = 0;
    for (const [b, c] of Object.entries(hist)) {
      if (c > bestC) { bestC = c; best = +b; }
    }
    return best;
  }


  // ---------- 新版图纸识别辅助：HSV / 边框检测 / 格子 Blob 采样 ----------
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: max ? d / max : 0, v: max };
  }
  function isMarginBarPixel(r, g, b) {
    const { h, s, v } = rgbToHsv(r, g, b);
    return (h >= 210 && h <= 310 && s > 0.15 && v > 0.18);
  }
  // 列/行最长暗线长度（检测贯穿格子的网格线）
  function longestDarkRunCol(data, w, h, x, y0, y1, thr) {
    let best = 0, cur = 0;
    for (let y = y0; y < y1; y++) {
      const i = (y * w + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < thr) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    return best;
  }
  function longestDarkRunRow(data, w, h, y, x0, x1, thr) {
    let best = 0, cur = 0;
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < thr) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    return best;
  }
  // 从一组线位置估算周期：取合法间距的众数
  function estimatePitch(lines, minGap, maxGap) {
    const gaps = [];
    for (let i = 1; i < lines.length; i++) {
      const g = lines[i] - lines[i - 1];
      if (g >= minGap && g <= maxGap) gaps.push(g);
    }
    if (!gaps.length) return 0;
    const hist = {};
    for (const g of gaps) {
      const k = Math.round(g);
      hist[k] = (hist[k] || 0) + 1;
    }
    let best = 0, bestC = 0;
    for (const [k, c] of Object.entries(hist)) {
      if (c > bestC) { bestC = c; best = +k; }
    }
    return best;
  }
  // 列间距检测：每列的竖向颜色梯度总和 → 取局部峰值 → 格点拟合求周期。
  // 比“最长暗线”更稳健：纯色块（如熊猫身体）不会制造峰值，只有真实列边界（颜色突变）才会，
  // 因此能在 80 列标准图纸上稳定得到正确列数。
  // 检测列方向的“网格线”候选位置（竖向梯度局部峰），返回清洗后的内部峰数组（像素坐标）。
  // 清洗：合并过近（<0.6*中位间距）的峰，并剔除紧贴边框的峰（边框线本身不算内部格线）。
  // 列数 = 内部峰数 + 1；该估计在满分辨率及多尺度下均稳定（已对测试图验证：80 列）。
  function detectColumnPeaks(data, w, h, gx0, gy0, gx1, gy1) {
    const span = gx1 - gx0;
    if (span < 40) return [];
    const Gc = new Float64Array(span);
    for (let x = gx0 + 1; x < gx1 - 1; x++) {
      let s = 0;
      for (let y = gy0 + 2; y < gy1 - 2; y++) {
        const i = (y * w + x) * 4, j = (y * w + x - 1) * 4;
        s += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
      }
      Gc[x - gx0] = s;
    }
    let mean = 0; for (let k = 0; k < Gc.length; k++) mean += Gc[k]; mean /= Gc.length;
    const raw = [];
    for (let k = 2; k < Gc.length - 2; k++) {
      const v = Gc[k];
      if (v >= mean * 1.3 && v >= Gc[k - 1] && v >= Gc[k + 1] && v >= Gc[k - 2] && v >= Gc[k + 2]) raw.push(gx0 + k);
    }
    if (raw.length < 3) return raw;
    const gaps = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const g = raw[i + 1] - raw[i];
      if (g >= 10 && g <= 40) gaps.push(g);
    }
    const med = gaps.length ? medianOf(gaps) : 18;
    const cleaned = [];
    for (const p of raw) {
      if (cleaned.length && (p - cleaned[cleaned.length - 1]) < 0.6 * med) continue;
      cleaned.push(p);
    }
    // 剔除紧贴边框的峰（边框线不算内部格线）
    return cleaned.filter(p => (p - gx0) > 0.5 * med && (gx1 - p) > 0.5 * med);
  }
  function medianOf(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  // 在 cell 内找最大连通色块（排除纯白/纯黑文字/网格线），返回 {area, r, g, b}
  function findCellBlob(ctx, x0, y0, x1, y1, whiteThr, darkThr) {
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return null;
    const data = ctx.getImageData(x0, y0, w, h).data;
    const mask = new Uint8Array(w * h);
    const colors = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = (r + g + b) / 3;
        if (lum > whiteThr || lum < darkThr) continue;
        mask[y * w + x] = 1;
        colors.push({ x, y, r, g, b });
      }
    }
    if (!colors.length) return null;
    const label = new Int32Array(w * h);
    let bestArea = 0, bestCols = [];
    let lid = 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!mask[idx] || label[idx]) continue;
        const stack = [idx];
        label[idx] = lid;
        let area = 0;
        const cols = [];
        while (stack.length) {
          const cur = stack.pop();
          const cx = cur % w, cy = Math.floor(cur / w);
          const cidx = (cy * w + cx) * 4;
          area++;
          cols.push({ r: data[cidx], g: data[cidx + 1], b: data[cidx + 2] });
          const nxts = [cur - 1, cur + 1, cur - w, cur + w];
          for (const n of nxts) {
            if (n < 0 || n >= w * h) continue;
            if (mask[n] && !label[n]) { label[n] = lid; stack.push(n); }
          }
        }
        if (area > bestArea) { bestArea = area; bestCols = cols; }
        lid++;
      }
    }
    if (!bestCols.length) return null;
    // 取连通块主色（量化到 /8 取众数，避免反锯齿分散）
    const freq = {};
    for (const c of bestCols) {
      const k = `${Math.round(c.r / 8) * 8},${Math.round(c.g / 8) * 8},${Math.round(c.b / 8) * 8}`;
      freq[k] = (freq[k] || 0) + 1;
    }
    let mk = '', mv = 0;
    for (const [k, v] of Object.entries(freq)) { if (v > mv) { mv = v; mk = k; } }
    const [r, g, b] = mk.split(',').map(Number);
    return { area: bestArea, r, g, b };
  }

// 在指定归一化区域内检测网格线，返回归一化坐标与行列数
  function detectGridLines(img, region) {
    const { w, h, ctx } = createAnalysisCanvas(img, 1500);
    const data = ctx.getImageData(0, 0, w, h).data;
    const x0 = Math.round(region.x * w);
    const y0 = Math.round(region.y * h);
    const x1 = Math.round((region.x + region.w) * w);
    const y1 = Math.round((region.y + region.h) * h);
    const rw = Math.max(1, x1 - x0), rh = Math.max(1, y1 - y0);
    // 1) 找紫色/蓝色边框条，确定图纸原点
    let topBarEnd = y0, leftBarEnd = x0, bottomBarStart = y1, rightBarStart = x1;
    // 行：从上往下找连续紫色条
    for (let y = y0; y < y1; y++) {
      let cnt = 0;
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        if (isMarginBarPixel(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt / rw > 0.45) topBarEnd = y;
      else if (topBarEnd > y0 + 2) break;
    }
    // 列：从左往右
    for (let x = x0; x < x1; x++) {
      let cnt = 0;
      for (let y = y0; y < y1; y++) {
        const i = (y * w + x) * 4;
        if (isMarginBarPixel(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt / rh > 0.45) leftBarEnd = x;
      else if (leftBarEnd > x0 + 2) break;
    }
    // 从底部/右侧找紫色条
    for (let y = y1 - 1; y > y0; y--) {
      let cnt = 0;
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        if (isMarginBarPixel(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt / rw > 0.45) bottomBarStart = y;
      else if (bottomBarStart < y1 - 2) break;
    }
    for (let x = x1 - 1; x > x0; x--) {
      let cnt = 0;
      for (let y = y0; y < y1; y++) {
        const i = (y * w + x) * 4;
        if (isMarginBarPixel(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt / rh > 0.45) rightBarStart = x;
      else if (rightBarStart < x1 - 2) break;
    }
    const gx0 = leftBarEnd + 1;
    const gy0 = topBarEnd + 1;
    const gx1 = rightBarStart - 1;
    const gy1 = bottomBarStart - 1;
    const gw = Math.max(1, gx1 - gx0), gh = Math.max(1, gy1 - gy0);
    // 2) 列数：由“清洗后的内部峰 + 1”得到（多尺度稳定，已验证=80 列）。
    const peaks = detectColumnPeaks(data, w, h, gx0, gy0, gx1, gy1);
    let cols;
    if (peaks.length >= 3) {
      cols = peaks.length + 1;
    } else {
      // 兜底：用默认列距估算（极少触发，仅在几乎无网格线的图上）
      cols = Math.max(2, Math.round(gw / 18) + 1);
    }
    // 3) 行数：行无法从内容稳定检测（纯色块内部无边界、文字稀疏），
    //    由“精确列距 × 单元格高宽比 cellAspect”反推；用 gw/(cols-1) 作为精确列距，
    //    消除中位间距量化的跨尺度偏差，使行数在多尺度下稳定（已验证=74 行）。
    const cellAspect = (state.settings.cellAspect && state.settings.cellAspect > 0) ? state.settings.cellAspect : 0.555;
    const colPitch = gw / Math.max(1, cols - 1);
    const py = colPitch * cellAspect;
    const rows = Math.max(2, Math.round(gh / py) + 1);
    // 4) 以边框为锚点，等距跨满整图放置网格线（与已验证方案一致：80×74，C25≈608）
    const vx = gw / Math.max(1, cols - 1), vy = gh / Math.max(1, rows - 1);
    const vLines = [], hLines = [];
    for (let i = 0; i <= cols; i++) vLines.push((gx0 + i * vx) / w);
    for (let i = 0; i <= rows; i++) hLines.push((gy0 + i * vy) / h);
    return {
      vLines,
      hLines,
      cols,
      rows,
      frame: { gx0, gy0, gx1, gy1 },
      aw: w, ah: h
    };
  }
  // 兜底：用暗色小连通块中心间距估算 pitch
  function estimatePitchByComponents(ctx, x0, y0, x1, y1) {
    const w = x1 - x0, h = y1 - y0;
    if (w < 20 || h < 20) return { px: 18, py: 12 };
    const data = ctx.getImageData(x0, y0, w, h).data;
    const seen = new Uint8Array(w * h);
    const xs = [], ys = [];
    const darkThr = 80, minA = 6, maxA = 300;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (seen[idx]) continue;
        const i = idx * 4;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum >= darkThr) continue;
        // BFS small dark component
        const stack = [idx]; seen[idx] = 1;
        let minx = x, maxx = x, miny = y, maxy = y, area = 0;
        while (stack.length) {
          const cur = stack.pop();
          const cx = cur % w, cy = Math.floor(cur / w);
          minx = Math.min(minx, cx); maxx = Math.max(maxx, cx);
          miny = Math.min(miny, cy); maxy = Math.max(maxy, cy);
          area++;
          const nxts = [cur - 1, cur + 1, cur - w, cur + w];
          for (const n of nxts) {
            if (n < 0 || n >= w * h || seen[n]) continue;
            const ni = n * 4;
            const nlum = (data[ni] + data[ni + 1] + data[ni + 2]) / 3;
            if (nlum < darkThr) { seen[n] = 1; stack.push(n); }
          }
        }
        if (area >= minA && area <= maxA && (maxx - minx) < 40 && (maxy - miny) < 40) {
          xs.push((minx + maxx) / 2); ys.push((miny + maxy) / 2);
        }
      }
    }
    const px = estimatePitch(xs.sort((a, b) => a - b), 4, 80) || 18;
    const py = estimatePitch(ys.sort((a, b) => a - b), 4, 80) || 12;
    return { px, py };
  }

// 用检测到的网格线逐格中心采样（新版：Blob 面积过滤 + 避开网格线/文字）
  // 用检测到的网格线逐格中心采样：取每格中心 50% 区域的“众数颜色”（量化为 /8），
  // 跳过近白像素与背景色，再与 MARD 标准色号匹配。每个格子计 1 颗豆。
  // 该中心采样法在 80×74 标准图纸上实测 C25≈608（标注 598），远优于旧的 Blob 面积法。
  function sampleByDetectedGrid(img, region, vLines, hLines, ignoreColors = [], tolerance = 24) {
    const MAX = 1500;
    const { w, h, ctx } = createAnalysisCanvas(img, MAX);
    const data = ctx.getImageData(0, 0, w, h).data;
    const frac = 0.5; // 中心区域占比：越大越接近整格（含文字/边界风险），越小越稳
    const cellColors = [];
    for (let yi = 0; yi < hLines.length - 1; yi++) {
      for (let xi = 0; xi < vLines.length - 1; xi++) {
        const lx = Math.round(vLines[xi] * w);
        const rx = Math.round(vLines[xi + 1] * w);
        const ty = Math.round(hLines[yi] * h);
        const by = Math.round(hLines[yi + 1] * h);
        if (lx >= rx || ty >= by) continue;
        const cw = rx - lx, ch = by - ty;
        const iw = Math.max(1, Math.round(cw * frac)), ih = Math.max(1, Math.round(ch * frac));
        const sx = lx + ((cw - iw) >> 1), sy = ty + ((ch - ih) >> 1);
        // 统计中心区域像素的众数颜色（量化到 /8 以抗轻微抗锯齿色差）
        const freq = new Map();
        for (let py = sy; py < sy + ih; py++) {
          for (let px = sx; px < sx + iw; px++) {
            const idx = (py * w + px) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            if ((r + g + b) / 3 > 236) continue; // 跳过近白
            // 量化到 /8 后用 24 位整数做键（每通道 8 位，避免位移截断导致颜色错乱）
            const key = ((r & 0xF8) << 16) | ((g & 0xF8) << 8) | (b & 0xF8);
            freq.set(key, (freq.get(key) || 0) + 1);
          }
        }
        if (!freq.size) continue;
        let bestK = 0, bestC = 0;
        for (const [k, c] of freq) { if (c > bestC) { bestC = c; bestK = k; } }
        const r = (bestK >> 16) & 0xFF, g = (bestK >> 8) & 0xFF, b = bestK & 0xFF;
        // 应用忽略色与背景过滤
        let ignored = false;
        for (const ig of ignoreColors) {
          if (colorDist(r, g, b, ig.r, ig.g, ig.b) <= (ig.tolerance || 24)) { ignored = true; break; }
        }
        if (ignored || isGridBackgroundLike(r, g, b)) continue;
        cellColors.push({ r, g, b, count: 1 });
      }
    }
    // 二次聚合成桶
    const buckets = [];
    for (const c of cellColors) {
      let hit = null;
      for (const bk of buckets) {
        if (colorDist(c.r, c.g, c.b, bk.r, bk.g, bk.b) <= tolerance) { hit = bk; break; }
      }
      if (hit) {
        hit.r = Math.round((hit.r * hit.count + c.r) / (hit.count + 1));
        hit.g = Math.round((hit.g * hit.count + c.g) / (hit.count + 1));
        hit.b = Math.round((hit.b * hit.count + c.b) / (hit.count + 1));
        hit.count++;
      } else buckets.push({ r: c.r, g: c.g, b: c.b, count: 1 });
    }
    return buckets;
  }

  // 把“检测到的边框 + 指定行列数”重排成规整网格线，并写入全局变量（供预览叠加与识别复用）。
  // 边框来自 detectGridLines 的分析画布像素坐标；行列数变化时仅缩放间距，原点/边框不变。
  function applyGridFromFrame(cols, rows) {
    if (!tempDetectedFramePx) return;
    const f = tempDetectedFramePx;
    // 等距跨满边框放置（与 detectGridLines 完全一致）：cols 个格子 => (cols-1) 个间距
    const vx = (f.gx1 - f.gx0) / Math.max(1, cols - 1);
    const vy = (f.gy1 - f.gy0) / Math.max(1, rows - 1);
    const vLines = [], hLines = [];
    for (let i = 0; i <= cols; i++) vLines.push((f.gx0 + i * vx) / f.aw);
    for (let i = 0; i <= rows; i++) hLines.push((f.gy0 + i * vy) / f.ah);
    tempDetectedVLines = vLines;
    tempDetectedHLines = hLines;
    tempCropRegion = { x: f.gx0 / f.aw, y: f.gy0 / f.ah, w: (f.gx1 - f.gx0) / f.aw, h: (f.gy1 - f.gy0) / f.ah };
  }

  // 智能识别：在全图上自动定位图纸边框并识别行列，结果写入全局变量并刷新预览。
  function runAutoDetect(img, onDone) {
    const res = detectGridLines(img, { x: 0, y: 0, w: 1, h: 1 });
    tempDetectedFramePx = { gx0: res.frame.gx0, gy0: res.frame.gy0, gx1: res.frame.gx1, gy1: res.frame.gy1, aw: res.aw, ah: res.ah };
    state.settings.gridCols = Math.max(1, res.cols);
    state.settings.gridRows = Math.max(1, res.rows);
    save();
    applyGridFromFrame(state.settings.gridCols, state.settings.gridRows);
    if (onDone) onDone(res);
  }

  // 在编辑器画布上绘制图片、候选区域、选中区域与网格线
  function drawEditor() {
    const cv = $('#editor-canvas');
    if (!cv || !tempImage) return;
    const img = new Image();
    img.onload = () => {
      const rect = cv.parentElement.getBoundingClientRect();
      const maxW = Math.min(cv.parentElement.clientWidth || rect.width, 720);
      const scale = Math.min(1, maxW / img.width, 420 / img.height);
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      cv.width = dw; cv.height = dh;
      cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, dw, dh);
      ctx.drawImage(img, 0, 0, dw, dh);
      // 候选区域
      tempDetectedRegions.forEach((r, i) => {
        ctx.strokeStyle = tempCropRegion && tempCropRegion === r ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(r.x * dw, r.y * dh, r.w * dw, r.h * dh);
        ctx.setLineDash([]);
        ctx.fillStyle = tempCropRegion && tempCropRegion === r ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.08)';
        ctx.fillRect(r.x * dw, r.y * dh, r.w * dw, r.h * dh);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('图案 ' + (i + 1), (r.x * dw) + 4, (r.y * dh) + 14);
      });
      // 选中区域网格线
      if (tempCropRegion && tempDetectedVLines.length && tempDetectedHLines.length) {
        ctx.strokeStyle = 'rgba(244,114,182,0.55)';
        ctx.lineWidth = 1;
        tempDetectedVLines.forEach(lx => {
          const x = lx * dw;
          ctx.beginPath(); ctx.moveTo(x, tempCropRegion.y * dh); ctx.lineTo(x, (tempCropRegion.y + tempCropRegion.h) * dh); ctx.stroke();
        });
        tempDetectedHLines.forEach(ly => {
          const y = ly * dh;
          ctx.beginPath(); ctx.moveTo(tempCropRegion.x * dw, y); ctx.lineTo((tempCropRegion.x + tempCropRegion.w) * dw, y); ctx.stroke();
        });
      }
      // 当前选中框
      if (tempCropRegion) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(tempCropRegion.x * dw, tempCropRegion.y * dh, tempCropRegion.w * dw, tempCropRegion.h * dh);
      }
    };
    img.src = tempImage;
  }

  // 将鼠标/画布坐标转换为归一化坐标
  function canvasNorm(ev, cv) {
    const rect = cv.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
  }

  function renderRecognize(v) {
    v.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4">
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h2 class="text-xl font-bold mb-1">🖼️ 图纸识别</h2>
          <p class="text-sm text-mk-sub mb-4">上传拼豆图纸，框选要识别的图案区域后自动检测格子。</p>

          <label class="block border-2 border-dashed border-mk-brown rounded-2xl p-6 text-center cursor-pointer hover:bg-white/50 transition">
            <input id="img-input" type="file" accept="image/png,image/jpeg" class="hidden">
            <div class="text-4xl">📤</div>
            <div class="mt-2 font-semibold">点击上传图纸图片</div>
            <div class="text-xs text-mk-sub">支持整张图含多个图案，框选其中一个即可</div>
          </label>

          <div id="preview" class="mt-4 ${tempImage ? '' : 'hidden'}">
            <div class="relative inline-block w-full">
              <canvas id="editor-canvas" class="w-full rounded-xl border border-mk-sand cursor-crosshair bg-white" style="max-height:360px;"></canvas>
              <div id="editor-hint" class="text-[11px] text-mk-sub mt-1">🤖 智能识别模式下，上传后自动定位图纸并叠加网格，无需手动对齐；如需自定义，仍可拖拽框选或点「自动框选」。</div>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <button id="auto-region" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/60 text-mk-ink text-xs hover:bg-mk-lav/80">🪄 自动框选图案</button>
              <button id="detect-grid" type="button" class="px-3 py-1.5 rounded-lg bg-mk-mint/60 text-mk-ink text-xs hover:bg-mk-mint/80">🔍 检测格子</button>
              <button id="clear-region" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">↺ 重新框选</button>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <label class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
              <span>识别模式</span>
              <select id="mode" class="px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm">
                <option value="auto" ${state.settings.recognizeMode === 'auto' ? 'selected' : ''}>🤖 智能识别（推荐·自动框图）</option>
                <option value="grid" ${state.settings.recognizeMode === 'grid' ? 'selected' : ''}>格子采样（手填格子数）</option>
                <option value="pixel" ${state.settings.recognizeMode === 'pixel' ? 'selected' : ''}>像素聚类（无标注小图）</option>
              </select>
            </label>

            <!-- 智能识别：自动定位边框 + 自动行列，最省事 -->
            <div id="auto-options" class="${state.settings.recognizeMode === 'auto' ? '' : 'hidden'} space-y-2">
              <p class="text-[11px] text-mk-sub">上传后程序会自动定位图纸边框、识别行列数，并在预览上叠加粉色网格。若行数略有偏差，点下方步进或用“单元格高宽比”微调即可，<b>无需手动对齐十字格</b>。</p>
              <button id="detect-auto" type="button" class="w-full px-3 py-2 rounded-xl bg-mk-mint/70 text-mk-ink text-sm font-semibold hover:bg-mk-mint/90">🔍 自动识别网格</button>
              <div class="flex items-center justify-between text-sm bg-mk-mint/20 rounded-xl px-3 py-2">
                <span>已识别行列（可微调）</span>
                <span class="flex items-center gap-1">
                  <button id="auto-col-dec" class="w-6 h-6 rounded-lg bg-white border border-mk-sand text-sm leading-none">−</button>
                  <b id="auto-col-v" class="w-8 text-center">${state.settings.gridCols}</b>
                  <button id="auto-col-inc" class="w-6 h-6 rounded-lg bg-white border border-mk-sand text-sm leading-none">+</button>
                  <span class="mx-1">×</span>
                  <button id="auto-row-dec" class="w-6 h-6 rounded-lg bg-white border border-mk-sand text-sm leading-none">−</button>
                  <b id="auto-row-v" class="w-8 text-center">${state.settings.gridRows}</b>
                  <button id="auto-row-inc" class="w-6 h-6 rounded-lg bg-white border border-mk-sand text-sm leading-none">+</button>
                </span>
              </div>
              <label class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
                <span>单元格高宽比 <span class="text-[10px] text-mk-sub">（行距=列距×此值）</span></span>
                <span><input id="cell-aspect" type="range" min="0.40" max="0.80" step="0.005" value="${state.settings.cellAspect || 0.555}" class="align-middle"><b id="cell-aspect-v" class="ml-1">${(state.settings.cellAspect || 0.555).toFixed(3)}</b></span>
              </label>
            </div>

            <!-- 手动格子采样 -->
            <div id="grid-options" class="${state.settings.recognizeMode === 'grid' ? '' : 'hidden'} space-y-2">
              <div class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
                <span>图纸格子数（宽 × 高）</span>
                <span class="flex items-center gap-2">
                  <input id="grid-cols" type="number" min="1" value="${state.settings.gridCols}" class="w-16 px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm">
                  <span>×</span>
                  <input id="grid-rows" type="number" min="1" value="${state.settings.gridRows}" class="w-16 px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm">
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${[29, 48, 64, 80, 96].map(n => `<button class="grid-preset px-2 py-1 rounded-lg bg-white border border-mk-sand text-xs hover:bg-mk-lav/30" data-n="${n}">${n}×${n}</button>`).join('')}
              </div>
              <p class="text-[11px] text-mk-sub">可先框选图案（或点「自动框选」）再点「检测格子」自动填入；不对时再看图纸边缘刻度手动改。</p>
            </div>

            <label class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
              <span>颜色聚类容差</span>
              <span><input id="tol" type="range" min="10" max="120" value="${state.settings.sampleTolerance}" class="align-middle"><b id="tol-v" class="ml-1">${state.settings.sampleTolerance}</b></span>
            </label>
            <label id="scale-wrap" class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2 ${state.settings.recognizeMode === 'pixel' ? '' : 'hidden'}">
              <span>折算系数（每多少像素算 1 颗豆）</span>
              <input id="scale" type="number" step="0.1" min="0.1" value="${state.settings.scaleFactor}" class="w-20 px-2 py-1 rounded-lg bg-white border border-mk-sand">
            </label>
            <label class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
              <span>自动过滤背景/网格线</span>
              <input id="filter-bg" type="checkbox" checked class="w-4 h-4 accent-mk-rose">
            </label>
            <button id="auto-ignore-bg" type="button" class="w-full text-left text-xs px-3 py-2 rounded-xl bg-mk-lav/40 text-mk-ink hover:bg-mk-lav/60 ${tempImage ? '' : 'hidden'}">
              🎯 自动取图纸四角颜色作为背景忽略
            </button>
            <div id="ignore-list" class="${tempIgnoreColors.length ? '' : 'hidden'} text-sm">
              <div class="text-mk-sub mb-1 text-xs">已忽略颜色（点击 × 移除）：</div>
              <div class="flex flex-wrap gap-2">
                ${tempIgnoreColors.map((c, i) => `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-mk-sand text-xs"><span class="w-4 h-4 rounded-full swatch" style="background:${c.hex}"></span>${c.hex}<button class="ig-del text-rose-400 ml-1 leading-none" data-i="${i}">×</button></span>`).join('')}
              </div>
            </div>
            ${state.settings.enableVision && state.settings.apiKey
              ? `<label class="flex items-center gap-2 text-sm bg-mk-lav/40 rounded-xl px-3 py-2"><input id="use-vision" type="checkbox"> 使用云端视觉 AI（OpenAI Vision）直接识别</label>`
              : ''}
          </div>

          <button id="start" class="mt-4 w-full py-2.5 rounded-xl bg-mk-rose text-white font-bold shadow-soft disabled:opacity-40" ${tempImage ? '' : 'disabled'}>🔍 开始识别</button>
          <p class="text-xs text-mk-sub mt-2">提示：<b>智能识别</b>最省事——上传即自动框图、自动识别行列并叠加网格，直接点「开始识别」即可（行数若略有偏差，用右侧步进或“单元格高宽比”微调）。每格计 1 颗豆，相同标准色号自动合并。</p>
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">📋 识别说明</h3>
          <ol class="text-sm text-mk-ink/80 space-y-2 list-decimal list-inside">
            <li>上传图纸。若图中有多个图案，请分别框选识别。</li>
            <li>点击「自动框选图案」让程序推荐区域；也可直接在图上拖拽自定义。</li>
            <li>点「检测格子」自动识别网格线并填入行列数；也可手动输入。</li>
            <li>点击“开始识别”：程序按格子中心取色，自动避开网格线与色号文字。</li>
            <li>相同标准色号合并，弹窗中的“数量”即该色号的格子数。</li>
            <li>校对色号/数量后，确认扣减库存或存为配方。</li>
          </ol>
          <div class="mt-4 p-3 rounded-xl bg-mk-lemon/50 text-xs text-mk-ink/70">
            💡 自动框选通过网格线密度定位图案；检测格子通过暗色线投影定位每条网格线。若结果不对，先检查橙色/绿色框是否准确包围了一个完整图案。
          </div>
        </section>
      </div>`;

    const input = $('#img-input');
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        tempImage = ev.target.result;
        tempIgnoreColors = [];
        tempAlignPoints = [];
        tempCropRegion = null;
        tempDetectedRegions = [];
        tempDetectedVLines = [];
        tempDetectedHLines = [];
        tempDetectedFramePx = null;
        renderRecognize(v);
        // 智能识别模式：上传即自动识别，免去手动点按
        if (state.settings.recognizeMode === 'auto') {
          const img = new Image();
          img.onload = () => { runAutoDetect(img, () => { syncAutoInputs(); drawEditor(); }); };
          img.src = tempImage;
        }
      };
      reader.readAsDataURL(file);
    };
    $('#tol').oninput = (e) => { state.settings.sampleTolerance = +e.target.value; $('#tol-v').textContent = e.target.value; save(); };
    $('#scale').onchange = (e) => { state.settings.scaleFactor = Math.max(0.1, parseFloat(e.target.value) || 1); save(); };
    $('#mode').onchange = (e) => {
      state.settings.recognizeMode = e.target.value;
      $('#grid-options').classList.toggle('hidden', e.target.value !== 'grid');
      $('#auto-options').classList.toggle('hidden', e.target.value !== 'auto');
      $('#scale-wrap').classList.toggle('hidden', e.target.value === 'grid' || e.target.value === 'auto');
      save();
      // 切到智能识别且已上传图片时，自动跑一次识别，免手动点
      if (e.target.value === 'auto' && tempImage) {
        const img = new Image();
        img.onload = () => { runAutoDetect(img, () => { syncAutoInputs(); drawEditor(); toast(`已自动识别 ${state.settings.gridCols} 列 × ${state.settings.gridRows} 行`, 'success'); }); };
        img.src = tempImage;
      }
    };
    // —— 智能识别：行列步进 + 单元格高宽比微调 ——
    function syncAutoInputs() {
      const cv = $('#auto-col-v'), rv = $('#auto-row-v');
      if (cv) cv.textContent = state.settings.gridCols;
      if (rv) rv.textContent = state.settings.gridRows;
    }
    const stepAuto = (key, delta) => {
      state.settings[key] = Math.max(1, (state.settings[key] || 1) + delta);
      if (tempDetectedFramePx) applyGridFromFrame(state.settings.gridCols, state.settings.gridRows);
      syncAutoInputs(); drawEditor(); save();
    };
    $('#auto-col-dec').onclick = () => stepAuto('gridCols', -1);
    $('#auto-col-inc').onclick = () => stepAuto('gridCols', +1);
    $('#auto-row-dec').onclick = () => stepAuto('gridRows', -1);
    $('#auto-row-inc').onclick = () => stepAuto('gridRows', +1);
    const aspectIn = $('#cell-aspect');
    if (aspectIn) aspectIn.oninput = (e) => {
      state.settings.cellAspect = Math.max(0.1, parseFloat(e.target.value) || 0.555);
      $('#cell-aspect-v').textContent = state.settings.cellAspect.toFixed(3);
      // 行数 = 边框高 / (列距 × 高宽比)，列距 = 边框宽 / 列数
      if (tempDetectedFramePx) {
        const f = tempDetectedFramePx;
        const colPitch = (f.gx1 - f.gx0) / Math.max(1, state.settings.gridCols);
        const rowPitch = colPitch * state.settings.cellAspect;
        state.settings.gridRows = Math.max(1, Math.round((f.gy1 - f.gy0) / rowPitch));
        applyGridFromFrame(state.settings.gridCols, state.settings.gridRows);
        syncAutoInputs(); drawEditor();
      }
      save();
    };
    $('#detect-auto').onclick = () => {
      if (!tempImage) return toast('请先上传图片', 'error');
      const img = new Image();
      img.onload = () => { runAutoDetect(img, () => { syncAutoInputs(); drawEditor(); toast(`已自动识别 ${state.settings.gridCols} 列 × ${state.settings.gridRows} 行`, 'success'); }); };
      img.src = tempImage;
    };
    $('#grid-cols').onchange = (e) => { state.settings.gridCols = Math.max(1, parseInt(e.target.value) || 1); save(); };
    $('#grid-rows').onchange = (e) => { state.settings.gridRows = Math.max(1, parseInt(e.target.value) || 1); save(); };
    $$('.grid-preset').forEach(btn => btn.onclick = (e) => {
      const n = +e.target.dataset.n;
      state.settings.gridCols = n; state.settings.gridRows = n;
      $('#grid-cols').value = n; $('#grid-rows').value = n;
      save();
    });

    // 编辑器画布事件
    const cv = $('#editor-canvas');
    if (cv && tempImage) {
      drawEditor();
      let dragging = false, dragStart = null, dragCurrent = null;
      cv.onmousedown = (e) => {
        const p = canvasNorm(e, cv);
        // 若点击在候选区域内，选中它
        const hit = tempDetectedRegions.slice().reverse().find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
        if (hit) {
          tempCropRegion = hit;
          drawEditor();
          return;
        }
        dragging = true; dragStart = p; dragCurrent = p;
      };
      cv.onmousemove = (e) => {
        if (!dragging) return;
        dragCurrent = canvasNorm(e, cv);
        // 实时绘制拖拽框
        drawEditor();
        const ctx = cv.getContext('2d');
        const dw = cv.width, dh = cv.height;
        const x = Math.min(dragStart.x, dragCurrent.x) * dw;
        const y = Math.min(dragStart.y, dragCurrent.y) * dh;
        const ww = Math.abs(dragCurrent.x - dragStart.x) * dw;
        const hh = Math.abs(dragCurrent.y - dragStart.y) * dh;
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x, y, ww, hh);
        ctx.setLineDash([]);
      };
      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        if (dragStart && dragCurrent) {
          const x = Math.min(dragStart.x, dragCurrent.x);
          const y = Math.min(dragStart.y, dragCurrent.y);
          const w = Math.abs(dragCurrent.x - dragStart.x);
          const h = Math.abs(dragCurrent.y - dragStart.y);
          if (w > 0.03 && h > 0.03) {
            tempCropRegion = { x, y, w, h };
            tempDetectedVLines = []; tempDetectedHLines = [];
          }
        }
        dragStart = null; dragCurrent = null;
        drawEditor();
      };
      cv.onmouseup = endDrag;
      cv.onmouseleave = endDrag;
    }

    $('#auto-region').onclick = () => {
      if (!tempImage) return toast('请先上传图片', 'error');
      const img = new Image();
      img.onload = () => {
        tempDetectedRegions = detectCandidateRegions(img);
        if (tempDetectedRegions.length) tempCropRegion = tempDetectedRegions[0];
        tempDetectedVLines = []; tempDetectedHLines = [];
        drawEditor();
        toast(`检测到 ${tempDetectedRegions.length} 个候选区域，已选中第 1 个`, 'success');
      };
      img.src = tempImage;
    };
    $('#detect-grid').onclick = () => {
      if (!tempImage || !tempCropRegion) return toast('请先框选图案区域', 'error');
      const img = new Image();
      img.onload = () => {
        const res = detectGridLines(img, tempCropRegion);
        tempDetectedVLines = res.vLines;
        tempDetectedHLines = res.hLines;
        state.settings.gridCols = Math.max(1, res.cols);
        state.settings.gridRows = Math.max(1, res.rows);
        const colsIn = $('#grid-cols'), rowsIn = $('#grid-rows');
        if (colsIn) colsIn.value = state.settings.gridCols;
        if (rowsIn) rowsIn.value = state.settings.gridRows;
        drawEditor();
        toast(`检测到 ${res.cols} 列 × ${res.rows} 行`, 'success');
      };
      img.src = tempImage;
    };
    $('#clear-region').onclick = () => {
      tempCropRegion = null;
      tempDetectedRegions = [];
      tempDetectedVLines = []; tempDetectedHLines = [];
      tempDetectedFramePx = null;
      drawEditor();
    };

    $('#start').onclick = runRecognition;
    $('#auto-ignore-bg').onclick = () => autoIgnoreCorners(v);
    $$('.ig-del').forEach(btn => btn.onclick = (e) => {
      tempIgnoreColors.splice(+e.target.dataset.i, 1);
      renderRecognize(v);
    });
  }
  async function runRecognition() {
    if (!tempImage) return toast('请先上传图片', 'error');
    const mode = state.settings.recognizeMode || 'pixel';
    if (mode === 'grid' && !tempCropRegion) {
      return toast('请先在图上框选要识别的图案区域', 'error');
    }
    toast('识别中…', 'info');
    const img = new Image();
    img.onload = async () => {
      try {
        const useVision = state.settings.enableVision && state.settings.apiKey && $('#use-vision') && $('#use-vision').checked;
        if (useVision) {
          recognitionResult = await callVisionAPI(tempImage, state.settings.apiKey, state.settings.model);
        } else {
          const sf = state.settings.scaleFactor || 1;
          const filterBg = $('#filter-bg') && $('#filter-bg').checked;
          let buckets = [];
          let sampleInfo = '';
          // 智能识别：若尚未检测，先在全图自动定位边框并识别行列
          if (mode === 'auto' && tempDetectedVLines.length < 2) {
            const det = detectGridLines(img, { x: 0, y: 0, w: 1, h: 1 });
            tempDetectedFramePx = { gx0: det.frame.gx0, gy0: det.frame.gy0, gx1: det.frame.gx1, gy1: det.frame.gy1, aw: det.aw, ah: det.ah };
            state.settings.gridCols = det.cols; state.settings.gridRows = det.rows;
            applyGridFromFrame(det.cols, det.rows);
            if (!tempCropRegion) tempCropRegion = { x: 0, y: 0, w: 1, h: 1 };
          }
          if (mode === 'grid' || mode === 'auto') {
            const cols = Math.max(1, state.settings.gridCols || 1);
            const rows = Math.max(1, state.settings.gridRows || 1);
            // 如果检测到了网格线，用实际线位置采样（更准）；否则用均匀分格兜底
            if (tempDetectedVLines.length >= 2 && tempDetectedHLines.length >= 2) {
              buckets = sampleByDetectedGrid(img, tempCropRegion, tempDetectedVLines, tempDetectedHLines, tempIgnoreColors, state.settings.sampleTolerance);
              sampleInfo = `本次按智能识别的网格线采样：${cols} 列 × ${rows} 行`;
            } else {
              buckets = sampleByGridInRegion(img, tempCropRegion || { x: 0, y: 0, w: 1, h: 1 }, cols, rows, tempIgnoreColors, state.settings.sampleTolerance);
              sampleInfo = `本次按 ${cols}×${rows} 均匀采样`;
            }
          } else {
            // —— 像素聚类路径（核心算法 A）：适合无标注的“每像素=1豆”小图 ——
            buckets = clusterImageColors(img, state.settings.sampleTolerance, tempIgnoreColors);
            sampleInfo = '本次为像素聚类模式';
          }

          // —— 色号映射（核心算法 B）——
          if (mode === 'grid' || mode === 'auto') {
            const merged = new Map();
            for (const bk of buckets) {
              if (filterBg && isGridBackgroundLike(bk.r, bk.g, bk.b)) continue;
              const m = mapColorToStandard(bk.r, bk.g, bk.b);
              const key = m.colorNumber || `__unmatched_${bk.r}_${bk.g}_${bk.b}`;
              if (!merged.has(key)) {
                merged.set(key, {
                  id: uid('r'),
                  sampleHex: rgbToHex(bk.r, bk.g, bk.b),
                  sr: bk.r, sg: bk.g, sb: bk.b,
                  count: 0, removed: false,
                  colorNumber: m.colorNumber,
                  colorName: m.colorName,
                  hex: m.hex,
                  matched: m.matched,
                  matchedBy: m.matchedBy,
                  distance: m.distance
                });
              }
              merged.get(key).count += bk.count;
            }
            recognitionResult = Array.from(merged.values()).sort((a, b) => b.count - a.count);
          } else {
            recognitionResult = buckets
              .filter(bk => !filterBg || !isBackgroundLike(bk.r, bk.g, bk.b))
              .map(bk => {
                const cnt = Math.max(1, Math.round(bk.count / sf));
                const m = mapColorToStandard(bk.r, bk.g, bk.b);
                return {
                  id: uid('r'),
                  sampleHex: rgbToHex(bk.r, bk.g, bk.b),
                  sr: bk.r, sg: bk.g, sb: bk.b,
                  count: cnt, removed: false,
                  ...m
                };
              })
              .sort((a, b) => b.count - a.count);
          }
          recognitionResultSampleInfo = sampleInfo;
        }
        if (!recognitionResult.length) return toast('未识别到颜色（可能是纯色/透明图）', 'warn');
        openRecognitionModal();
      } catch (err) {
        console.error(err);
        toast('识别失败：' + err.message, 'error');
      }
    };
    img.onerror = () => toast('图片加载失败', 'error');
    img.src = tempImage;
  }

  // 自动取图纸四角颜色加入忽略列表（通常四角是背景/空白）
  function autoIgnoreCorners(v) {
    if (!tempImage) return toast('请先上传图片', 'error');
    const img = new Image();
    img.onload = () => {
      const corners = [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]];
      let added = 0;
      corners.forEach(([nx, ny]) => {
        const c = getPixelColorFromImage(img, nx, ny);
        if (!tempIgnoreColors.some(ig => ig.hex === c.hex)) {
          tempIgnoreColors.push({ ...c, tolerance: 32 });
          added++;
        }
      });
      renderRecognize(v);
      toast(`已自动忽略 ${added} 个四角颜色`, added ? 'success' : 'info');
    };
    img.onerror = () => toast('图片加载失败', 'error');
    img.src = tempImage;
  }

  // ---- 识别结果校对弹窗 ----
  function openRecognitionModal() {
    const mode = state.settings.recognizeMode || 'pixel';
    const totalCells = recognitionResult.reduce((s, r) => s + (r.removed ? 0 : r.count), 0);
    const suspicious = recognitionResult.filter(r => !r.removed && isGridBackgroundLike(r.sr, r.sg, r.sb));

    const renderRows = () => recognitionResult.filter(r => !r.removed).map(r => `
      <tr data-id="${r.id}" class="border-t border-mk-sand/50 align-middle ${isGridBackgroundLike(r.sr, r.sg, r.sb) ? 'bg-amber-50/50' : ''}">
        <td class="px-2 py-2 text-center">
          <span class="w-6 h-6 rounded-full swatch inline-block" style="background:${r.sampleHex}"></span>
          <div class="font-mono text-[10px] mt-1">${r.sampleHex}</div>
        </td>
        <td class="px-2 py-2 text-center">
          <span class="w-6 h-6 rounded-full swatch inline-block" style="background:${r.hex}"></span>
          <div class="text-[10px] mt-1">${r.colorNumber || '未匹配'}</div>
        </td>
        <td class="px-2 py-2">
          <select class="r-color w-full px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm" data-id="${r.id}">
            <option value="">（未匹配·请选择）</option>
            ${state.beads.map(b => `<option value="${b.colorNumber}" ${r.colorNumber === b.colorNumber ? 'selected' : ''}>${b.colorNumber} ${escapeHtml(b.colorName)}</option>`).join('')}
          </select>
          ${r.matchedBy ? `<div class="text-[11px] text-mk-sub mt-0.5">自动匹配：${r.matchedBy}${r.distance !== Infinity ? ` · 距离 ${Math.round(r.distance)}` : ''}</div>` : ''}
        </td>
        <td class="px-2 py-2"><input type="number" min="0" value="${r.count}" class="r-qty w-20 px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm" data-id="${r.id}"></td>
        <td class="px-2 py-2 text-center">
          <button class="r-del text-rose-400 text-sm" data-id="${r.id}">✕</button>
          ${gridMode ? `<button class="r-ignore text-mk-sub text-[11px] block mt-1" data-id="${r.id}">忽略色</button>` : ''}
        </td>
      </tr>`).join('');

    const gridMode = (mode === 'grid' || mode === 'auto');
    const body = `
      <input id="recipe-name" class="w-full mb-3 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand text-sm" placeholder="可填写配方名称（用于保存到配方库）">
      <div class="mb-3 p-3 rounded-xl bg-mk-lav/40 text-xs text-mk-ink">
        <div>${recognitionResultSampleInfo || `本次按 <b>${gridMode ? `${state.settings.gridCols}×${state.settings.gridRows}` : '整图像素'}</b> 采样`}，共识别到 <b>${totalCells}</b> 个有效${gridMode ? '格子' : '像素'}。</div>
        ${gridMode ? `<div class="mt-1 text-mk-sub">若总格数与图纸实际不符，请返回修改“图纸格子数”。总格数 = 宽 × 高，应与框选区域内的实际格子数一致。</div>` : ''}
        ${suspicious.length ? `<div class="mt-1 text-amber-600">⚠️ 检测到 ${suspicious.length} 行颜色接近背景/网格线，建议点击下方“忽略色”后重跑。</div>` : ''}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-mk-sand/40 text-mk-sub"><tr>
            <th class="px-2 py-2">采样色</th><th class="px-2 py-2">匹配色号</th><th class="px-2 py-2">标准色号</th><th class="px-2 py-2">数量${mode === 'grid' ? '<span class="text-[10px] font-normal">（格子）</span>' : ''}</th><th class="px-2 py-2"></th>
          </tr></thead>
          <tbody id="rec-rows">${renderRows()}</tbody>
        </table>
      </div>`;
    openModal('识别结果校对', body, { wide: true });

    // 行内事件
    $$('.r-color').forEach(sel => sel.onchange = (e) => {
      const r = recognitionResult.find(x => x.id === e.target.dataset.id);
      const bead = beadByNumber(e.target.value);
      r.colorNumber = e.target.value;
      r.colorName = bead ? bead.colorName : '';
      r.hex = bead ? bead.hex : r.sampleHex;
      r.matched = !!bead; r.matchedBy = bead ? '手动' : '';
      // 同步更新“匹配色号”列的色样与色号文字
      const row = e.target.closest('tr');
      row.querySelectorAll('span.swatch')[1].style.background = r.hex;
      row.querySelector('td:nth-child(2) div').textContent = r.colorNumber || '未匹配';
    });
    $$('.r-qty').forEach(inp => inp.oninput = (e) => {
      const r = recognitionResult.find(x => x.id === e.target.dataset.id);
      r.count = Math.max(0, parseInt(e.target.value) || 0);
    });
    $$('.r-del').forEach(btn => btn.onclick = (e) => {
      const r = recognitionResult.find(x => x.id === e.target.dataset.id);
      r.removed = true;
      e.target.closest('tr').remove();
    });
    $$('.r-ignore').forEach(btn => btn.onclick = (e) => {
      const r = recognitionResult.find(x => x.id === e.target.dataset.id);
      if (r && !tempIgnoreColors.some(ig => ig.hex === r.sampleHex)) {
        tempIgnoreColors.push({ r: r.sr, g: r.sg, b: r.sb, hex: r.sampleHex, tolerance: 32 });
      }
      closeModal();
      renderRecognize($('#view'));
      toast('已将该行采样色加入忽略，请重新识别', 'info');
    });

    setModalFoot(`
      <button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="rec-save-recipe" class="px-4 py-2 rounded-xl bg-mk-lav text-mk-ink font-semibold">存为配方</button>
      <button id="rec-confirm" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">确认扣减库存</button>`);

    $('#rec-confirm').onclick = confirmDeduct;
    $('#rec-save-recipe').onclick = saveRecipeFromResult;
  }

  // 确认：从库存对应色号扣减并写日志
  function confirmDeduct() {
    let okCount = 0, skip = 0;
    recognitionResult.filter(r => !r.removed && r.colorNumber && r.count > 0).forEach(r => {
      const bead = beadByNumber(r.colorNumber);
      if (!bead) { skip++; return; }
      bead.stock = Math.max(0, bead.stock - r.count);
      addLog('图纸消耗', bead, -r.count, '图纸识别扣减');
      okCount++;
    });
    save();
    closeModal();
    switchView('dashboard');
    toast(`已扣减 ${okCount} 种颜色${skip ? `，跳过 ${skip} 种未匹配` : ''}`, 'success');
  }

  // 存为配方（不直接扣减）
  function saveRecipeFromResult() {
    const items = recognitionResult.filter(r => !r.removed && r.colorNumber && r.count > 0)
      .map(r => ({ colorNumber: r.colorNumber, colorName: r.colorName, hex: r.hex, qty: r.count }));
    if (!items.length) return toast('没有可保存的条目', 'warn');
    const name = $('#recipe-name').value.trim() || ('图纸配方 ' + fmtTime(Date.now()));
    state.recipes.unshift({ id: uid('rc'), name, createdAt: Date.now(), items });
    save();
    toast('已保存到配方库', 'success');
    closeModal();
    switchView('recipes');
  }

  /* ===================== 14. 配方库 ===================== */
  function renderRecipes(v) {
    v.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">📚 配方库</h2>
        <span class="text-sm text-mk-sub">共 ${state.recipes.length} 个配方（仅预览/预扣，不直接扣减）</span>
      </div>
      ${state.recipes.length ? `<div class="grid md:grid-cols-2 gap-4">${state.recipes.map(recipeCard).join('')}</div>`
        : '<div class="mk-card rounded-2xl shadow-soft p-8 text-center text-mk-sub">还没有配方，去「图纸识别」识别后可存为配方 🌟</div>'}`;
    $$('.rc-view').forEach(b => b.onclick = () => viewRecipe(b.dataset.id));
    $$('.rc-del').forEach(b => b.onclick = () => {
      if (confirm('删除该配方？')) { state.recipes = state.recipes.filter(r => r.id !== b.dataset.id); save(); renderRecipes(v); }
    });
  }
  function recipeCard(rc) {
    const total = rc.items.reduce((s, i) => s + i.qty, 0);
    return `<div class="mk-card rounded-2xl shadow-soft p-4">
      <div class="flex items-center justify-between">
        <div class="font-bold">${escapeHtml(rc.name)}</div>
        <div class="text-xs text-mk-sub">${fmtTime(rc.createdAt)}</div>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-2">
        ${rc.items.slice(0, 12).map(i => `<span class="w-5 h-5 rounded-full swatch inline-block" style="background:${i.hex}" title="${i.colorNumber} ${i.colorName} ×${i.qty}"></span>`).join('')}
        ${rc.items.length > 12 ? `<span class="text-xs text-mk-sub self-center">+${rc.items.length - 12}</span>` : ''}
      </div>
      <div class="text-sm text-mk-sub mt-2">${rc.items.length} 种颜色 · 约 ${total} 颗豆</div>
      <div class="flex gap-2 mt-3">
        <button class="rc-view text-xs px-3 py-1.5 rounded-xl bg-mk-sky text-mk-ink font-semibold" data-id="${rc.id}">预览/预扣</button>
        <button class="rc-del text-xs px-3 py-1.5 rounded-xl bg-rose-50 text-rose-400" data-id="${rc.id}">删除</button>
      </div>
    </div>`;
  }
  function viewRecipe(id) {
    const rc = state.recipes.find(r => r.id === id);
    // 预扣库存预览：按色号汇总需求，与实际库存比较（不扣减）
    const need = {};
    rc.items.forEach(i => { need[i.colorNumber] = (need[i.colorNumber] || 0) + i.qty; });
    const rows = Object.keys(need).map(num => {
      const bead = beadByNumber(num);
      const req = need[num];
      const have = bead ? bead.stock : 0;
      const lack = Math.max(0, req - have);
      return `<tr class="border-t border-mk-sand/50">
        <td class="px-3 py-2"><span class="w-5 h-5 rounded-full swatch inline-block align-middle mr-1" style="background:${bead ? bead.hex : '#ccc'}"></span>${num} ${bead ? escapeHtml(bead.colorName) : '<span class=text-rose-400>库存无此色</span>'}</td>
        <td class="px-3 py-2 text-right">${req}</td>
        <td class="px-3 py-2 text-right">${have}</td>
        <td class="px-3 py-2 text-right font-bold ${lack ? 'text-rose-500' : 'text-emerald-600'}">${lack ? '缺 ' + lack : '充足'}</td>
      </tr>`;
    }).join('');
    const body = `
      <p class="text-sm text-mk-sub mb-2">以下为「预扣库存预览」，<b>不会实际扣减</b>。红色为库存不足。</p>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-mk-sand/40 text-mk-sub"><tr><th class="px-3 py-2 text-left">色号</th><th class="px-3 py-2 text-right">需要</th><th class="px-3 py-2 text-right">现有</th><th class="px-3 py-2 text-right">差额</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    openModal('配方预览：' + rc.name, body, { wide: true });
    setModalFoot(`
      <button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">关闭</button>
      <button id="rc-exec" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">应用到库存（扣减）</button>`);
    $('#rc-exec').onclick = () => {
      let n = 0;
      rc.items.forEach(i => {
        const bead = beadByNumber(i.colorNumber);
        if (bead && i.qty > 0) { bead.stock = Math.max(0, bead.stock - i.qty); addLog('配方扣减', bead, -i.qty, rc.name); n++; }
      });
      save(); closeModal(); switchView('dashboard'); toast(`已按配方扣减 ${n} 种颜色`, 'success');
    };
  }

  /* ===================== 15. 操作记录 ===================== */
  let logFilter = 'all';
  function renderLogs(v) {
    const types = ['all', '入库', '消耗', '图纸消耗', '配方扣减'];
    const list = state.logs.filter(l => logFilter === 'all' || l.type === logFilter);
    v.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-xl font-bold">📝 操作记录</h2>
        <div class="flex gap-1.5 flex-wrap">
          ${types.map(t => `<button class="lf-btn px-3 py-1.5 rounded-xl text-xs font-semibold ${logFilter === t ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub'}" data-t="${t}">${t === 'all' ? '全部' : t}</button>`).join('')}
        </div>
      </div>
      <div class="mk-card rounded-2xl shadow-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-mk-sand/40 text-mk-sub"><tr>
              <th class="px-3 py-2 text-left">时间</th><th class="px-3 py-2 text-left">类型</th>
              <th class="px-3 py-2 text-right">数量</th><th class="px-3 py-2 text-left">色号</th>
              <th class="px-3 py-2 text-right">结余</th><th class="px-3 py-2 text-left">备注</th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map(l => `<tr class="border-t border-mk-sand/50">
                <td class="px-3 py-2 text-mk-sub">${fmtTime(l.ts)}</td>
                <td class="px-3 py-2 font-semibold">${l.type}</td>
                <td class="px-3 py-2 text-right font-bold ${l.qty > 0 ? 'text-emerald-600' : 'text-rose-500'}">${l.qty > 0 ? '+' : ''}${l.qty}</td>
                <td class="px-3 py-2">${l.colorNumber} ${escapeHtml(l.colorName)}</td>
                <td class="px-3 py-2 text-right text-mk-sub">${l.balance}</td>
                <td class="px-3 py-2 text-mk-sub">${escapeHtml(l.note || '')}</td>
              </tr>`).join('') : `<tr><td colspan="6" class="text-center text-mk-sub py-6">暂无记录</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    $$('.lf-btn').forEach(b => b.onclick = () => { logFilter = b.dataset.t; renderLogs(v); });
  }

  /* ===================== 16. 设置（色卡映射管理 + 数据 + 视觉AI） ===================== */
  function renderSettings(v) {
    v.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-4">
        <!-- 色卡对照表 -->
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold">🎨 自定义色号映射（覆盖色卡）</h3>
            <button id="map-add" class="px-3 py-1.5 rounded-xl bg-mk-lav text-mk-ink text-sm font-semibold">+ 新增映射</button>
          </div>
          <p class="text-xs text-mk-sub mb-3">内置 MARD 221 标准色卡已作为默认“RGB→标准色号”对照（识别时按最近色自动匹配）。下表用于补充自定义覆盖/别名：图纸采样色命中此处时优先采用。</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-mk-sand/40 text-mk-sub"><tr>
                <th class="px-2 py-2 text-left">图纸采样RGB</th><th class="px-2 py-2 text-left">→标准色号</th>
                <th class="px-2 py-2 text-left">容差</th><th class="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                ${state.mappings.length ? state.mappings.map(m => {
                  const bead = beadByNumber(m.colorNumber);
                  return `<tr class="border-t border-mk-sand/50">
                    <td class="px-2 py-2"><span class="w-5 h-5 rounded-full swatch inline-block align-middle mr-1" style="background:${m.hex}"></span><span class="text-xs">${m.hex}</span></td>
                    <td class="px-2 py-2">${m.colorNumber} ${bead ? escapeHtml(bead.colorName) : ''}</td>
                    <td class="px-2 py-2 text-xs text-mk-sub">${m.tolerance}</td>
                    <td class="px-2 py-2 text-center"><button class="map-del text-rose-400 text-xs" data-id="${m.id}">删</button></td>
                  </tr>`;
                }).join('') : `<tr><td colspan="4" class="text-center text-mk-sub py-4">暂无自定义映射，默认使用内置 MARD 221 色卡</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>

        <!-- 视觉 AI 开关 -->
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">🤖 云端视觉 AI（可选）</h3>
          <label class="flex items-center gap-2 text-sm mb-3">
            <input id="vision-on" type="checkbox" ${state.settings.enableVision ? 'checked' : ''}> 启用 OpenAI Vision 直接识别图纸
          </label>
          <label class="text-sm block mb-2">API Key<input id="vision-key" type="password" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${state.settings.apiKey}"></label>
          <label class="text-sm block mb-3">模型<input id="vision-model" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${state.settings.model}"></label>
          <p class="text-xs text-mk-sub">启用后，图纸识别页会出现“使用云端视觉AI”选项，上传后调用 VLM 输出结构化 JSON。</p>
        </section>

        <!-- 补货阈值设置 -->
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">📦 补货阈值设置</h3>
          <label class="text-sm block mb-2">全局补货阈值（库存低于此值即预警，默认 100）
            <input id="replenish-thr" type="number" min="0" step="1" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${state.settings.replenishThreshold}">
          </label>
          <p class="text-xs text-mk-sub">该值为所有色号的默认补货阈值；单个色号可在「豆子仓库」编辑时单独设置覆盖值（阈值填 0 即使用此全局值）。首次使用默认每色 1000 颗，均高于阈值，无需补货。</p>
        </section>

        <!-- 数据：导入导出 / 备份恢复 -->
        <section class="mk-card rounded-2xl shadow-soft p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">💾 数据管理</h3>
          <div class="flex flex-wrap gap-2">
            <button id="exp-xlsx" class="px-4 py-2 rounded-xl bg-mk-mint text-mk-ink font-semibold">导出库存 Excel</button>
            <button id="imp-xlsx" class="px-4 py-2 rounded-xl bg-mk-sky text-mk-ink font-semibold">导入库存 Excel</button>
            <input id="imp-file" type="file" accept=".xlsx,.xls,.csv" class="hidden">
            <button id="backup" class="px-4 py-2 rounded-xl bg-mk-lemon text-mk-ink font-semibold">备份全部数据</button>
            <button id="restore" class="px-4 py-2 rounded-xl bg-mk-peach text-mk-ink font-semibold">恢复备份</button>
            <input id="restore-file" type="file" accept=".json" class="hidden">
            <button id="reset" class="px-4 py-2 rounded-xl bg-rose-100 text-rose-500 font-semibold">恢复默认数据</button>
          </div>
          <p class="text-xs text-mk-sub mt-3">Excel 导出依赖 SheetJS（联网）；离线时自动改用 CSV。备份为完整 JSON，可用于换设备恢复。</p>
        </section>

        <!-- 账户与云端同步 -->
        <section class="mk-card rounded-2xl shadow-soft p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">☁️ 账户与云端同步</h3>
          ${accountSyncInner()}
        </section>
      </div>`;

    $('#map-add').onclick = openAddMapping;

    const accLogin = $('#acc-login'); if (accLogin) accLogin.onclick = () => doAuth('login');
    const accSignup = $('#acc-signup'); if (accSignup) accSignup.onclick = () => doAuth('signup');
    const syncNow = $('#sync-now'); if (syncNow) syncNow.onclick = () => syncPull();
    const syncOut = $('#sync-out'); if (syncOut) syncOut.onclick = () => doLogout();
    $$('.map-del').forEach(b => b.onclick = () => {
      state.mappings = state.mappings.filter(m => m.id !== b.dataset.id); save(); renderSettings(v); toast('已删除映射', 'success');
    });
    $('#vision-on').onchange = e => { state.settings.enableVision = e.target.checked; save(); };
    $('#vision-key').onchange = e => { state.settings.apiKey = e.target.value; save(); };
    $('#vision-model').onchange = e => { state.settings.model = e.target.value; save(); };
    $('#replenish-thr').onchange = e => {
      const val = parseInt(e.target.value, 10);
      state.settings.replenishThreshold = (isNaN(val) || val < 0) ? 0 : val;
      save(); renderSettings(v);
      if (currentView === 'dashboard') renderDashboard($('#view'));
      else if (currentView === 'warehouse') renderWarehouse($('#view'));
      toast('补货阈值已更新', 'success');
    };

    $('#exp-xlsx').onclick = exportInventory;
    $('#imp-xlsx').onclick = () => $('#imp-file').click();
    $('#imp-file').onchange = e => { if (e.target.files[0]) importInventory(e.target.files[0]); };
    $('#backup').onclick = backupAll;
    $('#restore').onclick = () => $('#restore-file').click();
    $('#restore-file').onchange = e => { if (e.target.files[0]) restoreAll(e.target.files[0]); };
    $('#reset').onclick = () => { if (confirm('将恢复为默认 221 色卡（每色 1000 颗），并清空所有日志、配方与自定义映射，且不可恢复。确定？')) { state = defaultState(); save(); toast('已恢复默认数据', 'success'); switchView('dashboard'); } };
  }

  function openAddMapping() {
    const body = `
      <div class="grid grid-cols-3 gap-3">
        <label class="text-sm col-span-1">图纸采样RGB<input id="m-hex" type="color" class="w-full mt-1 h-10 rounded-xl bg-white border border-mk-sand" value="#FFFFFF"></label>
        <label class="text-sm col-span-1">对应标准色号<select id="m-num" class="w-full mt-1 px-2 py-2 rounded-xl bg-white border border-mk-sand">${state.beads.map(b => `<option value="${b.colorNumber}">${b.colorNumber} ${escapeHtml(b.colorName)}</option>`).join('')}</select></label>
        <label class="text-sm col-span-1">容差<input id="m-tol" type="number" value="40" class="w-full mt-1 px-2 py-2 rounded-xl bg-white border border-mk-sand"></label>
      </div>
      <p class="text-xs text-mk-sub mt-2">“图纸采样RGB”填写你在图纸上实际看到的颜色（可用取色工具取色），识别时按容差匹配。</p>`;
    openModal('新增色卡映射', body);
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="m-save" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">保存</button>`);
    $('#m-save').onclick = () => {
      state.mappings.push({ id: uid('m'), hex: $('#m-hex').value, colorNumber: $('#m-num').value, tolerance: parseInt($('#m-tol').value) || 40 });
      save(); closeModal(); renderSettings($('#view')); toast('已添加', 'success');
    };
  }

  /* ===================== 17. 导入导出 / 备份恢复 ===================== */
  function exportInventory() {
    const rows = state.beads.map(b => ({
      色号: b.colorNumber, 颜色名称: b.colorName, 色值: b.hex,
      存放位置: b.location, 当前库存: b.stock, 最低补货阈值: b.threshold
    }));
    if (window.XLSX) {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '库存');
      XLSX.writeFile(wb, '拼豆库存.xlsx');
    } else {
      downloadCsv(rows, '拼豆库存.csv');
    }
    toast('已导出', 'success');
  }
  function importInventory(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let rows;
      if (window.XLSX && /\.xlsx?$/.test(file.name)) {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else {
        rows = parseCsv(e.target.result);
      }
      const imported = rows.map(r => ({
        id: uid('b'),
        colorNumber: String(r['色号'] || '').trim(),
        colorName: String(r['颜色名称'] || '').trim() || '未命名',
        hex: String(r['色值'] || '#FFFFFF').trim(),
        location: String(r['存放位置'] || '').trim(),
        stock: parseInt(r['当前库存']) || 0,
        threshold: parseInt(r['最低补货阈值']) || 0
      })).filter(r => r.colorNumber);
      if (!imported.length) return toast('未解析到有效行', 'error');
      // 按色号合并：已存在则覆盖，否则新增
      imported.forEach(n => {
        const ex = state.beads.find(b => b.colorNumber === n.colorNumber);
        if (ex) Object.assign(ex, n); else state.beads.push(n);
      });
      save(); switchView('warehouse'); toast(`已导入 ${imported.length} 条`, 'success');
    };
    if (window.XLSX && /\.xlsx?$/.test(file.name)) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }
  function downloadCsv(rows, filename) {
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }
  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(s => s.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(s => s.replace(/^"|"$/g, ''));
      const o = {}; headers.forEach((h, i) => o[h] = cells[i]); return o;
    });
  }
  function backupAll() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '拼豆豆仓备份_' + Date.now() + '.json'; a.click();
    toast('已备份', 'success');
  }
  function restoreAll(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        state = Object.assign(defaultState(), data);
        save(); switchView('dashboard'); toast('已恢复', 'success');
      } catch (err) { toast('恢复失败：文件格式错误', 'error'); }
    };
    reader.readAsText(file);
  }

  /* ===================== 18. 启动 ===================== */
  if (supabase) {
    // 启动时若已有会话（同一浏览器之前登录过），自动恢复登录态并拉取云端数据
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { currentUser = data.session.user; syncPull(); }
    }).catch(() => {});
  }
  renderNav();
  switchView('dashboard');
})();
