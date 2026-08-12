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
      // 图库：用户上传的图纸，含名称/来源(平台)/作者/是否已拼状态
      gallery: [],
      // 自定义色号映射覆盖表（可选）：识别时优先于内置 221 色卡匹配
      mappings: [],
      // 用户个人资料（昵称/头像），随 state 同步到云端
      profile: { nickname: '', avatar: '' },
      settings: {
        enableVision: true, apiKey: '', model: 'glm-4v-flash', visionBaseUrl: '',
        sampleTolerance: 48, scaleFactor: 1,
        // 识别模式：本应用仅保留「图例识别」一种模式——框选图纸色块图例，
        // 由云端视觉 AI 读取每个色块的色号与下方数量，直接生成色号清单并扣减库存。
        recognizeMode: 'legend',
        gridCols: 0, gridRows: 0,
        // 单元格高宽比（仅图例用量统计时的兜底参考，默认 0.555）。
        cellAspect: 0.555,
        // 「图片转图纸」默认走像素法；若图纸已是带色号字符的成品，可开启 → 调云端视觉逐格读字符
        gridOCREnabled: false,
        // 全局补货阈值：库存低于此值即触发"低库存/需补货"预警（可在设置中调整，默认 100）。
        // 单个色号在「豆子仓库」里可单独设置覆盖值（阈值填 0 = 使用此全局值）。
        replenishThreshold: 100
      }
    };
  }

  /* ===================== 2. 存储与会话状态 ===================== */
  let state = load();
  // 旧版模式（auto/grid/pixel/aligned）已移除，统一为图例识别模式。
  if (state.settings.recognizeMode !== 'legend') state.settings.recognizeMode = 'legend';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // 简单兜底，避免旧数据结构缺字段；settings 需深层补齐（向后兼容旧数据缺失的新增项如 replenishThreshold）
      const merged = Object.assign(defaultState(), parsed);
      merged.settings = Object.assign(defaultState().settings, parsed.settings || {});
      // 迁移：glm-4v-plus 在智谱侧已不稳定/可能改名，统一切到稳定的 glm-4v-flash（免费、识别色号够用）
      if (merged.settings.model === 'glm-4v-plus') merged.settings.model = 'glm-4v-flash';
      return merged;
    } catch (e) {
      console.warn('读取本地数据失败，使用默认数据', e);
      return defaultState();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      const isQuota = e && (e.name === 'QuotaExceededError' || /quota|exceeded|storage/i.test(e.message));
      const approxKB = Math.round(JSON.stringify(state).length / 1024);
      const msg = isQuota
        ? '保存失败：本地存储空间不足（当前数据约 ' + approxKB + 'KB）。通常是图库图片过大，建议到「设置」压缩图库图片，或删除部分图片后再试。'
        : '保存失败：' + e.message;
      toast(msg, 'error', 6000);
      console.error('save failed', e, 'state approx', approxKB + 'KB');
    }
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
  let pendingSignupAvatar = ''; // 注册时临时头像（data URL）
  let settingsAvatarTemp = '';  // 设置页临时头像（data URL）

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
  // opts: { nickname, avatar } 仅用于注册时初始化个人资料
  async function doAuth(mode, emailVal, passVal, opts = {}) {
    if (!supabase) return toast('云端同步未配置', 'error');
    const email = (emailVal || '').trim();
    const pass = passVal || '';
    if (!email || !pass) return toast('请填写邮箱和密码', 'error');
    if (pass.length < 6) return toast('密码至少 6 位', 'error');
    try {
      const { data, error } = mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password: pass,
            options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
          })
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
      // 注册时初始化个人资料
      if (mode === 'signup') {
        state.profile.nickname = (opts.nickname || '').trim();
        state.profile.avatar = (opts.avatar || '').trim();
        save();
      }
      toast('已登录', 'success');
      await syncPull();
      renderHeaderUser();
      if (currentView === 'dashboard') renderDashboard($('#view'));
      else renderSettings($('#view'));
    } catch (e) {
      console.error('doAuth 异常', e);
      toast((mode === 'signup' ? '注册' : '登录') + '异常：' + (e && e.message ? e.message : String(e)), 'error');
    }
  }
  async function doLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    pendingSignupAvatar = '';
    settingsAvatarTemp = '';
    toast('已退出登录（本机数据已保留）', 'success');
    renderHeaderUser();
    if (currentView === 'dashboard') renderDashboard($('#view'));
    else renderSettings($('#view'));
  }

  // 修改密码：发送邮箱验证（密码重置邮件）
  async function sendPasswordResetEmail() {
    if (!supabase || !currentUser) return toast('未登录，无法修改密码', 'error');
    const email = currentUser.email;
    if (!email) return toast('当前账号没有邮箱', 'error');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
      });
      if (error) return toast('发送失败：' + error.message, 'error');
      toast('验证邮件已发送，请查收后点击邮件链接设置新密码', 'success');
      closeModal();
    } catch (e) {
      toast('发送异常：' + (e && e.message ? e.message : String(e)), 'error');
    }
  }
  function openChangePasswordModal() {
    if (!currentUser) return toast('请先登录', 'warn');
    const email = escapeHtml(currentUser.email || '');
    openModal('🔒 修改密码', `
      <div class="space-y-3 text-sm">
        <p>修改密码需要进行邮箱验证。</p>
        <p class="text-mk-sub">我们将向 <b>${email}</b> 发送一封密码重置邮件。点击邮件中的链接后，即可在此设置新密码。</p>
        <div class="bg-mk-sand/30 rounded-xl p-3 text-xs text-mk-sub">如果你没有收到邮件，请检查垃圾箱；部分邮箱服务商可能会有延迟。</div>
      </div>`);
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">取消</button>
      <button id="send-reset-email" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">发送验证邮件</button>`);
    $('#send-reset-email').onclick = sendPasswordResetEmail;
  }
  // 从密码重置邮件回调后，打开设置新密码弹窗
  function openPasswordResetModal() {
    openModal('🔑 设置新密码', `
      <div class="space-y-3">
        <label class="text-sm block">新密码（至少 6 位）<input id="reset-new-pass" type="password" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand"></label>
        <label class="text-sm block">确认新密码<input id="reset-confirm-pass" type="password" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand"></label>
        <p id="reset-pass-error" class="text-xs text-rose-500 hidden"></p>
      </div>`);
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">取消</button>
      <button id="reset-pass-save" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">保存新密码</button>`);
    const errEl = $('#reset-pass-error');
    $('#reset-pass-save').onclick = async () => {
      const p1 = ($('#reset-new-pass') || {}).value || '';
      const p2 = ($('#reset-confirm-pass') || {}).value || '';
      if (p1.length < 6) { errEl.textContent = '密码至少 6 位'; errEl.classList.remove('hidden'); return; }
      if (p1 !== p2) { errEl.textContent = '两次输入的密码不一致'; errEl.classList.remove('hidden'); return; }
      try {
        const { error } = await supabase.auth.updateUser({ password: p1 });
        if (error) { errEl.textContent = '设置失败：' + error.message; errEl.classList.remove('hidden'); return; }
        closeModal();
        toast('密码已更新，请用新密码重新登录', 'success');
      } catch (e) {
        errEl.textContent = '设置异常：' + (e && e.message ? e.message : String(e));
        errEl.classList.remove('hidden');
      }
    };
  }

  // “账户与同步”卡片内容（按登录态渲染）。prefix 区分设置页(acc)与首页(home)的多个实例，避免 id 冲突。
  function accountSyncInner(prefix) {
    const p = prefix || 'acc';
    if (!supabase) {
      return `<p class="text-xs text-mk-sub">未配置云端同步（config.js 中未填写 Supabase 项目）。当前数据仅保存在本机浏览器（localStorage），换设备或清缓存会丢失。配置 Supabase 后即可跨设备自动同步。</p>`;
    }
    if (currentUser) {
      return `
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm">已登录：<b>${escapeHtml(currentUser.email || currentUser.id)}</b></span>
          <span class="text-xs text-mk-sub">${lastSyncAt ? '上次同步：' + lastSyncAt.toLocaleString() : '尚未同步'}</span>
          <button id="${p}-syncnow" class="px-3 py-1.5 rounded-xl bg-mk-sky text-mk-ink text-sm font-semibold">立即同步</button>
          <button id="${p}-logout" class="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-500 text-sm font-semibold">退出登录</button>
        </div>
        <p class="text-xs text-mk-sub mt-2">数据已在本地与云端双向同步（每次保存后自动上传，登录/启动时拉取）。换设备登录同一账号即可恢复全部数据。</p>`;
    }
    const avatarPreview = pendingSignupAvatar || generateDefaultAvatarSvg('我');
    return `
      <button id="${p}-toggle" class="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-mk-lav text-mk-ink font-semibold">登录 / 注册 <span class="${p}-chevron">▾</span></button>
      <div id="${p}-form" class="hidden mt-3">
        <div class="grid sm:grid-cols-2 gap-3 max-w-md">
          <label class="text-sm">邮箱<input id="${p}-email" type="email" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="you@example.com"></label>
          <label class="text-sm">密码（至少 6 位）<input id="${p}-pass" type="password" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="••••••"></label>
        </div>
        <div class="grid sm:grid-cols-2 gap-3 max-w-md mt-3">
          <label class="text-sm">昵称（注册时可选）<input id="${p}-nickname" type="text" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="怎么称呼你"></label>
          <label class="text-sm">头像（注册时可选）
            <div class="flex items-center gap-2 mt-1">
              <img id="${p}-avatar-preview" src="${avatarPreview}" class="w-9 h-9 rounded-full object-cover bg-white border border-mk-sand">
              <input id="${p}-avatar" type="file" accept="image/*" class="text-xs">
            </div>
          </label>
        </div>
        <div class="flex gap-2 mt-3">
          <button id="${p}-login" class="px-4 py-2 rounded-xl bg-mk-mint text-mk-ink font-semibold">登录</button>
          <button id="${p}-signup" class="px-4 py-2 rounded-xl bg-mk-lav text-mk-ink font-semibold">注册新账号</button>
        </div>
        <p class="text-xs text-mk-sub mt-2">登录后数据将自动同步到云端，可跨设备使用。账号仅用于标识你的数据，不与任何人共享。</p>
      </div>`;
  }
  // 折叠按钮：点击展开/收起账户表单（首页 home / 设置页 acc 各一份）
  function wireAccountToggle(p, root) {
    const tgl = root.querySelector('#' + p + '-toggle');
    const frm = root.querySelector('#' + p + '-form');
    const chv = root.querySelector('.' + p + '-chevron');
    if (tgl && frm) tgl.onclick = () => {
      frm.classList.toggle('hidden');
      if (chv) chv.textContent = frm.classList.contains('hidden') ? '▾' : '▴';
    };
  }
  // 给登录/注册表单绑定事件（头像上传 + 登录/注册按钮）
  function wireAuthForm(prefix) {
    const p = prefix;
    const loginBtn = $('#' + p + '-login');
    if (loginBtn) loginBtn.onclick = () => doAuth('login', $('#' + p + '-email').value, $('#' + p + '-pass').value);
    const signupBtn = $('#' + p + '-signup');
    if (signupBtn) signupBtn.onclick = () => doAuth('signup', $('#' + p + '-email').value, $('#' + p + '-pass').value, {
      nickname: ($('#' + p + '-nickname') || {}).value,
      avatar: pendingSignupAvatar
    });
    const fileInput = $('#' + p + '-avatar');
    const preview = $('#' + p + '-avatar-preview');
    if (fileInput) fileInput.onchange = async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try {
        const dataUrl = await resizeImageToDataURL(f);
        pendingSignupAvatar = dataUrl;
        if (preview) preview.src = dataUrl;
      } catch (e) { toast('头像读取失败', 'error'); }
    };
  }

  // 用户资料辅助：显示昵称 / 头像 / 默认头像
  function getDisplayName() {
    if (state.profile && state.profile.nickname) return state.profile.nickname;
    if (currentUser && currentUser.email) return currentUser.email.split('@')[0];
    return '我';
  }
  function getAvatarUrl() {
    if (state.profile && state.profile.avatar) return state.profile.avatar;
    return '';
  }
  function getAvatarLetter() {
    const n = getDisplayName();
    return (n && n[0]) ? n[0].toUpperCase() : '我';
  }
  function generateDefaultAvatarSvg(letter) {
    const l = escapeHtml(letter || '我');
    const bg = '#f3d2c1'; // 与主题搭的柔和桃色
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${bg}"/><text x="32" y="38" font-size="28" font-family="sans-serif" fill="#8b5cf6" text-anchor="middle" dominant-baseline="middle">${l}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function renderAvatarImg(cls = 'w-8 h-8 rounded-full object-cover bg-white shadow-soft') {
    const url = getAvatarUrl() || generateDefaultAvatarSvg(getAvatarLetter());
    return `<img src="${url}" alt="${escapeHtml(getDisplayName())}" class="${cls}">`;
  }
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('读取文件失败'));
      r.readAsDataURL(file);
    });
  }
  // 读取图片文件并缩放为正方形 data URL（用于头像，避免 base64 过大）
  function resizeImageToDataURL(file, maxSize = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const size = Math.min(maxSize, Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        // 居中裁剪为正方形
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
      img.src = url;
    });
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
  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function beadByNumber(num) { return state.beads.find(b => b.colorNumber === num); }
  // 按色号/编号精确匹配（忽略大小写与首尾空格），用于 AI 读到的图例印字
  function beadByCode(code) {
    if (!code) return null;
    const c = String(code).trim().toLowerCase();
    return state.beads.find(b => String(b.colorNumber || '').trim().toLowerCase() === c) || null;
  }
  // 有效补货阈值：单色单独设置且 >0 时优先，否则使用全局默认（设置里的 replenishThreshold）
  function effThreshold(b) {
    return (b.threshold && b.threshold > 0) ? b.threshold : (state.settings.replenishThreshold || 0);
  }
  function isLow(b) { return b.stock < effThreshold(b); }

  /* ===================== 4. 轻提示 Toast ===================== */
  function toast(msg, type = 'info', duration = 2300) {
    const colors = { info: 'bg-mk-ink', success: 'bg-emerald-500', error: 'bg-rose-400', warn: 'bg-amber-400' };
    const t = document.createElement('div');
    t.className = `${colors[type] || colors.info} text-white text-sm px-4 py-2 rounded-full shadow-soft transition whitespace-pre-line max-w-[90vw] text-center`;
    t.textContent = msg;
    $('#toast-root').appendChild(t);
    const fade = Math.max(800, duration - 500);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px);'; }, fade);
    setTimeout(() => t.remove(), duration);
  }

  /* ===================== 5. 模态框系统 ===================== */
  function openModal(title, bodyHtml, opts = {}, onClose = null) {
    const root = $('#modal-root');
    // 自定义最大宽度: opts.width (CSS 像素) > opts.wide (3xl=768) > 默认 lg (512)
    const widthCls = opts.width ? '' : (opts.wide ? 'max-w-3xl' : 'max-w-lg');
    const widthStyle = opts.width ? `max-width:${opts.width}px;` : '';
    root.innerHTML = `
      <div class="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4" id="modal-overlay">
        <div class="mk-card rounded-2xl shadow-soft w-full ${widthCls} max-h-[88vh] flex flex-col" style="${widthStyle}">
          <div class="flex items-center justify-between px-5 py-4 border-b border-mk-sand">
            <h3 class="font-bold text-lg">${escapeHtml(title)}</h3>
            <button class="text-mk-sub hover:text-mk-ink text-xl leading-none" id="modal-close">×</button>
          </div>
          <div class="p-5 overflow-auto" id="modal-body">${bodyHtml}</div>
          <div class="px-5 py-3 border-t border-mk-sand flex justify-end gap-2" id="modal-foot"></div>
        </div>
      </div>`;
    $('#modal-close').onclick = () => { if (onClose) onClose(); closeModal(); };
    $('#modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') { if (onClose) onClose(); closeModal(); } };
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
  function mapColorToStandard(r, g, b, legendMap = null) {
    // 0) 优先使用用户从图例解析出的色号映射（如果存在且颜色接近）
    if (legendMap && legendMap.length) {
      let bestL = null, bestLD = Infinity;
      for (const m of legendMap) {
        const d = colorDist(r, g, b, m.r, m.g, m.b);
        if (d < bestLD) { bestLD = d; bestL = m; }
      }
      if (bestL && bestLD <= (state.settings.sampleTolerance || 32)) {
        return {
          colorNumber: bestL.colorNumber,
          colorName: bestL.colorName,
          hex: bestL.hex,
          matched: !!bestL.colorNumber,
          matchedBy: '图例',
          distance: bestLD
        };
      }
    }
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
  // 通用 VLM 调用：向 OpenAI 兼容接口发送“文本 + 图片”，返回解析后的 JSON 对象。
  // baseUrl 缺省走 OpenAI；可填任意 OpenAI 兼容端点（如 DeepSeek / 通义千问等），提升国内可用性。
  // 鲁棒解析 AI 返回：先整体解析，失败再分别尝试截取 [..] / {..} 块
  // （兼容模型多嘴、带 Markdown 代码块、或返回纯数组的情况）
  function extractJsonContent(content) {
    if (typeof content !== 'string') content = String(content || '{}');
    try { return JSON.parse(content); } catch (_) {}
    const trySlice = (open, close) => {
      const s = content.indexOf(open), e = content.lastIndexOf(close);
      if (s >= 0 && e > s) { try { return JSON.parse(content.slice(s, e + 1)); } catch (_) {} }
      return undefined;
    };
    const arr = trySlice('[', ']'); if (arr !== undefined) return arr;
    const obj = trySlice('{', '}'); if (obj !== undefined) return obj;
    throw new Error('无法解析 AI 返回内容：' + content.slice(0, 200));
  }
  async function callVLM(dataUrl, apiKey, model, prompt, baseUrl) {
    // 代理模式：visionBaseUrl 为空或指向同源 /api/* 时，前端不带 Key，
    // 由 Vercel Serverless 函数（api/legend-vision.js）用服务端环境变量里的智谱 Key 转发。
    const viaProxy = !baseUrl || !baseUrl.trim() || baseUrl.trim().indexOf('/api/') === 0;
    if (viaProxy) {
      // 代理模式统一走智谱（ZHIPU_API_KEY）。未显式给智谱模型时默认用稳定的 glm-4v-flash（免费、识别色号够用）。
      const zhipuModel = (model && String(model).toLowerCase().startsWith('glm')) ? model : 'glm-4v-flash';
      const res = await fetch('/api/legend-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, model: zhipuModel, prompt })
      });
      if (!res.ok) {
        let msg = '代理服务返回 ' + res.status;
        try {
          const e = await res.json();
          if (e && e.error) {
            msg = e.error;
            if (e.detail) msg += '：' + e.detail.slice(0, 240);
          }
        } catch (_) {}
        throw new Error(msg);
      }
      const j = await res.json();
      const content = (j && j.content) || '{}';
      return extractJsonContent(content);
    }
    // 直连（用户自填 Key + OpenAI 兼容端点，如本地/自托管）
    const url = baseUrl.trim();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ] }]
      })
    });
    if (!res.ok) {
      let detail = '';
      try { const e = await res.json(); detail = (e.error && e.error.message) || JSON.stringify(e); } catch (_) {}
      throw new Error('Vision API ' + res.status + (detail ? '：' + detail : ''));
    }
    const j = await res.json();
    const content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '{}';
    return extractJsonContent(content);
  }
  // 归一化单个图例条目：解析 hex / code / count，并防御模型把「内部色号」与「下方数量」互换
  function normalizeLegendItem(c) {
    c = c || {};
    let hex = (c.hex || '').trim();
    let code = (c.code || '').trim();
    let count = parseInt(c.count, 10);
    if (isNaN(count) || count < 0) count = 0;
    // 模型有时把两者互换：code 拿到纯数字、count 拿到字母数字 -> 纠正
    if (/^\d+$/.test(code) && /[A-Za-z]/.test(String(c.count != null ? c.count : ''))) {
      const t = code; code = String(c.count).trim(); count = parseInt(t, 10) || 0;
    }
    return { hex, code, count };
  }
  // 让视觉模型识别“图例区域”中的颜色色块：返回每个色块的 hex、内部色号 code、以及下方数量 count。
  async function callLegendVisionAPI(dataUrl, apiKey, model, baseUrl) {
    const prompt = `你正在看一张拼豆(Perler/Hama)图纸的「颜色图例」区域：这是一排/一列整齐排列的纯色色块。

每个色块的固定结构是：
- 色块【内部】印有一行短码（如 "W123"、"R05"、"C25"），那是该颜色的「色号名称」。
- 色块【正下方】另有一行数字，那是该颜色的「数量」（例如 12 表示需要 12 颗），不是色号。

任务：识别图例中每一个「颜色色块」，从左到右、从上到下逐一列出。

严格要求（务必遵守）：
1. 只识别纯色填充的「色块」本身，忽略白色间隔、黑色网格线、边框、以及色块外的文字说明。
2. hex 取该色块中心的「主体填充色」，不要取文字颜色、边框颜色或阴影。
3. code 只取「色块内部印的色号短码」。绝对不要把色块【下方】的数量数字当成 code。看不清或没印字就填空字符串 ""，不要猜测或编造。
4. count 取「色块正下方印的数量数字」（整数，如 12）；若下方没有数字就填 0。
5. 不要合并相近颜色——只要肉眼可区分的不同色块，就分别列出（含深浅不同的同色系）。
6. 只返回一个 JSON，不要任何额外文字或 Markdown。

返回格式（示例）：
{"colors":[{"hex":"#FFD700","code":"Y8","count":12},{"hex":"#A52A2A","code":"BR3","count":3}]}`;
    const parsed = await callVLM(dataUrl, apiKey, model, prompt, baseUrl);
    const colors = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.colors) ? parsed.colors : []);
    return colors
      .map(normalizeLegendItem)
      .filter(c => /^#?[0-9a-fA-F]{6}$/.test(c.hex) || /^#[0-9a-fA-F]{3}$/.test(c.hex));
  }
  // 让视觉模型识别「整张拼豆图纸」的每个格子：返回 rows×cols 二维字符色号数组。
  // 用于"反解析已有图纸"——精准读取每个格子中央印的色号，比像素法稳得多。
  // 返回 { grid: string[rows][cols], rows, cols, matched?, totalChars? }
  async function callGridVisionAPI(dataUrl, rows, cols, apiKey, model, baseUrl) {
    rows = Math.max(2, rows | 0); cols = Math.max(2, cols | 0);
    const prompt = `你正在看一张拼豆(Perler/Hama) 拼豆图纸，它已经被等分为 ${rows} 行 × ${cols} 列的网格（总共 ${rows * cols} 个格子）。
每个格子中央通常印着一个色号短码（字母+数字，例如 "B12"、"H5"、"C25"、"W1"、"M3" 等），表示该格子应填的拼豆颜色。
少数格子是空白的——表示该位置不应放豆子（通常是背景 / 镂空）。

任务：逐格读取中央印的色号字符，输出一个 ${rows} 行 × ${cols} 列的二维数组 grid。

严格要求：
1. grid 必须是 ${rows} 行 × ${cols} 列，**严格等于**这个维度；多了少了都不要。
2. 字符大小写不限，按原样输出（例如 'b12' 与 'B12' 都可以，识别后归一化处理）。
3. 单元格里有印字的就输出该色号字符串；空白（没印字的格子）输出空字符串 ""。
4. 看不清或不确定的格子用 "?" 输出，不要猜测编造。
5. 同时返回 rows=${rows}、cols=${cols} 这两个字段（便于校验）。
6. **只**输出一个 JSON 对象，不要任何额外文字、Markdown 代码块或解释：
{"grid":[["B12","","H5","..."], [...], ...],"rows":${rows},"cols":${cols}}`;
    const parsed = await callVLM(dataUrl, apiKey, model, prompt, baseUrl);
    // 兼容多种返回形态（直接 grid / {grid, rows, cols}）
    let rawGrid = null, rawRows = rows, rawCols = cols;
    if (Array.isArray(parsed)) {
      rawGrid = parsed;
    } else if (parsed && typeof parsed === 'object') {
      rawGrid = Array.isArray(parsed.grid) ? parsed.grid : null;
      if (Number.isInteger(parsed.rows)) rawRows = parsed.rows;
      if (Number.isInteger(parsed.cols)) rawCols = parsed.cols;
    }
    if (!rawGrid || !rawGrid.length) throw new Error('模型未返回 grid 数组');
    // 防御性：截断 / 补全到目标 rows × cols；每行截断到 cols 长度
    const grid = [];
    let nonEmpty = 0;
    for (let r = 0; r < rawRows; r++) {
      const srcRow = Array.isArray(rawGrid[r]) ? rawGrid[r] : [];
      const outRow = new Array(rawCols).fill('');
      for (let c = 0; c < rawCols; c++) {
        let v = srcRow[c];
        if (v === null || v === undefined) v = '';
        v = String(v).replace(/[\s\u3000]+/g, '').replace(/^[-—]+|[-—]+$/g, '').trim();
        if (v && v !== '?') nonEmpty++;
        outRow[c] = v || '';
      }
      grid.push(outRow);
    }
    // 如果模型返回的行/列与请求不一致, 裁剪或补空
    while (grid.length < rawRows) grid.push(new Array(rawCols).fill(''));
    return { grid, rows: rawRows, cols: rawCols, recognized: nonEmpty };
  }

  // 把 OCR 字符数组查 state.beads 写回 pCells（已有色彩保留；有字符则查色号；无字符留 null）。
  // 返回统计 {matched, unmatched, empty, usedFallback, fallbackFilled}
  //   matched    - 字符命中色卡（含已有色彩被覆盖）
  //   unmatched  - 识别到字符但色卡里没有该色号（用户可补色卡）
  //   empty      - 模型判为空 / "?"（保持原像素结果或 null）
  //   usedFallback - 多少个原本空的格子被像素法兜底填充
  function applyGridToCells(grid) {
    const cells = Array.from({ length: pRows }, () => new Array(pCols).fill(null));
    const stats = { matched: 0, unmatched: 0, empty: 0, fallbackFilled: 0 };
    const unrecognizedCodes = new Map();  // 色号 → 次数（提示补色卡）
    for (let r = 0; r < pRows; r++) {
      const rowArr = (grid && grid[r]) || [];
      for (let c = 0; c < pCols; c++) {
        const codeRaw = rowArr[c];
        const code = codeRaw == null ? '' : String(codeRaw).trim();
        if (!code || code === '?') { stats.empty++; continue; }
        const bead = beadByCode(code);   // beadByCode 已忽略大小写
        if (bead && bead.colorNumber) {
          cells[r][c] = bead.colorNumber;
          stats.matched++;
        } else {
          // 字符识别成功但色卡没有此色号 → 不覆盖，仍留 null（用统计给"补色卡"建议）
          cells[r][c] = null;
          stats.unmatched++;
          unrecognizedCodes.set(code, (unrecognizedCodes.get(code) || 0) + 1);
        }
      }
    }
    stats.unrecognizedCodes = Array.from(unrecognizedCodes.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 12);  // 取前 12 个用于诊断
    return cells;
  }

  // 单块模式：图例条已切成独立小图，每张只含一个色块。prompt 强调「只有一个色块」，
  // 让模型专注读出该块主体色与印字，避免把间隔/边框当色块。
  async function callSingleLegendVisionAPI(dataUrl, apiKey, model, baseUrl) {
    const prompt = `这张图是从拼豆图纸颜色图例中裁剪出来的「单个色块」区域。

结构说明：色块【内部】印有一行短码（如 "W123"、"R05"），那是「色号名称」；色块【正下方】可能另有一行数字（如 12），那是「数量」（需要几颗），不是色号。

任务：识别这个色块的属性。

严格要求：
1. hex 取该色块中心的「主体填充色」，不要取文字颜色、边框或阴影。
2. code 只取「色块内部印的色号短码」（如 "C25"、"W1"）。绝对不要把任何位于色块【下方/边缘】的单独数字当成 code。看不清或没印字就填空字符串 ""，不要猜测编造。
3. count 取「色块正下方印的数量数字」（整数，如 12）；若下方没有数字就填 0。
4. 只返回一个 JSON 对象，不要任何额外文字或 Markdown：{"hex":"#RRGGBB","code":"...","count":12}`;
    const parsed = await callVLM(dataUrl, apiKey, model, prompt, baseUrl);
    // 兼容返回纯数组 [{}] 与对象 {hex,code,count} 两种形态
    const obj = (Array.isArray(parsed) ? parsed[0] : parsed) || {};
    const norm = normalizeLegendItem(obj);
    if (!/^#?[0-9a-fA-F]{6}$/.test(norm.hex) && !/^#[0-9a-fA-F]{3}$/.test(norm.hex)) return { hex: '', code: '', count: 0 };
    return norm;
  }
  // 将归一化区域裁剪为独立图片 dataURL（用于把图例区域单独发给视觉模型）
  function cropRegionToDataURL(img, region) {
    const { canvas, w, h } = createAnalysisCanvas(img, 1600);
    const x0 = Math.max(0, Math.round(region.x * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const cw = Math.max(1, x1 - x0), ch = Math.max(1, y1 - y0);
    // 裁剪出图例区后，若分辨率偏小（色块在图里被缩得很小），放大到更清晰再发，
    // 让视觉模型更容易看清颜色和印字，提升识别准确率。
    const upscale = Math.max(1, Math.ceil(900 / Math.min(cw, ch)));
    const c = document.createElement('canvas');
    c.width = Math.min(cw * upscale, 2400);
    c.height = Math.min(ch * upscale, 2400);
    c.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, c.width, c.height);
    // 输出 JPEG 减小 base64 体积，避免 PNG 无压缩导致 body 过大/智谱 400
    return c.toDataURL('image/jpeg', 0.9);
  }
  // 把图例区域按列切成 N 个独立色块小图（用于「按列逐个识别」提升密集小色块的准确率）。
  // region 为归一化的图例区域；index 从 0 开始；返回单个色块的 dataURL，剔除左右边界各 8%
  // 以避开网格线/分隔，避免把相邻色块边缘混入。
  function cropColumnToDataURL(img, region, index, cols) {
    const { canvas, w, h } = createAnalysisCanvas(img, 1600);
    const x0 = Math.max(0, Math.round(region.x * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const cw = Math.max(1, x1 - x0), fullCh = Math.max(1, y1 - y0);
    // 保留完整列高（含色块主体 + 色块【正下方】印的数量数字），
    // prompt 会让模型分别读取「内部色号」与「下方数量」。
    const ch = fullCh;
    // 每列宽度（含间隔），切出该列中心区
    const colW = cw / cols;
    const pad = colW * 0.08; // 两侧各剔除 8%，避开网格/分隔
    const cx0 = Math.round(x0 + index * colW + pad);
    const cx1 = Math.round(x0 + (index + 1) * colW - pad);
    const ccw = Math.max(1, cx1 - cx0);
    // 放大到足够清晰（短边放大到 ~600px），让模型看清颜色/印字
    const upscale = Math.max(1, Math.ceil(600 / Math.min(ccw, ch)));
    const c = document.createElement('canvas');
    c.width = Math.min(ccw * upscale, 1600);
    c.height = Math.min(ch * upscale, 1600);
    c.getContext('2d').drawImage(canvas, cx0, y0, ccw, ch, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  }
  // 异步加载图片为 HTMLImageElement
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  }
  // 用视觉大模型识别图例：裁剪图例区 → 调 VLM 读色 → 映射成标准色号清单
  // 始终将整条图例作为一张图发送给模型，由模型自行识别其中所有色块与数量。
  async function aiParseLegend(img, region, baseUrl) {
    const dataUrl = cropRegionToDataURL(img, region);
    if (!dataUrl || dataUrl.length < 500) throw new Error('裁剪出的图例区为空/过小，请重新框选图例区域');
    const raw = await callLegendVisionAPI(dataUrl, state.settings.apiKey, state.settings.model, baseUrl);
    return buildLegendFromColors(raw, raw.length || undefined);
  }
  // 把模型返回的 [{hex,code}] 映射为标准色号清单
  function buildLegendFromColors(raw, estimatedCols) {
    const out = [];
    for (const c of raw) {
      let hex = (c.hex || '').trim();
      if (!hex) continue; // 该列未识别到颜色（图像为空/识别失败），跳过不占位，避免噪声
      if (!hex.startsWith('#')) hex = '#' + hex;
      const rgb = hexToRgb(hex);
      if (!rgb || rgb.some(v => isNaN(v))) continue;
      const [r, g, b] = rgb;
      let colorNumber = '', colorName = '';
      if (c.code) {
        const bead = beadByCode(c.code);
        if (bead) { colorNumber = bead.colorNumber; colorName = bead.colorName; }
      }
      if (!colorNumber) {
        const m = mapColorToStandard(r, g, b);
        colorNumber = m.colorNumber || '';
        colorName = m.colorName || '';
      }
      const count = (c.count && Number(c.count) > 0) ? Number(c.count) : 0;
      out.push({ r, g, b, hex: rgbToHex(r, g, b), colorNumber, colorName, count });
    }
    out.estimatedCols = estimatedCols || out.length;
    return out;
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
    { key: 'pattern',   label: '图纸生成器' },
    { key: 'gallery',   label: '图库' },
    { key: 'logs',      label: '操作记录' },
    { key: 'settings',  label: '设置' }
  ];
  let currentView = 'dashboard';
  let navMoreDocClickBound = false;

  function renderNav() {
    // 窄屏（<380px，如 iPhone SE）只显示 3 个，避免「更多」按钮被挤到横向滚动区外
    const visibleCount = (window.innerWidth < 380) ? 3 : 4;
    const visible = VIEWS.slice(0, visibleCount);
    const more = VIEWS.slice(visibleCount);
    const isCurrentHidden = more.some(v => v.key === currentView);
    const moreMenuHtml = more.map(v =>
      `<button class="nav-more-btn block w-full text-left px-3 py-2 text-xs font-semibold text-mk-sub hover:bg-mk-sand/40 ${v.key === currentView ? 'bg-mk-sand/60' : ''}" data-view="${v.key}">${v.label}</button>`
    ).join('');
    $('#nav').innerHTML =
      visible.map(v =>
        `<button class="nav-btn flex-1 sm:flex-none px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-mk-sub whitespace-nowrap ${v.key === currentView ? 'active' : 'hover:bg-white/60'}" data-view="${v.key}">${v.label}</button>`
      ).join('') +
      (more.length ? `<div class="relative sm:hidden flex-none">
        <button id="nav-more" class="px-2 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-mk-sub whitespace-nowrap ${isCurrentHidden ? 'active' : 'hover:bg-white/60'}">更多</button>
        <div id="nav-more-menu" class="absolute right-0 top-full mt-1 w-28 py-1 rounded-xl bg-white shadow-soft border border-mk-sand hidden z-50">${moreMenuHtml}</div>
      </div>` : '') +
      more.map(v =>
        `<button class="nav-btn hidden sm:inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-mk-sub whitespace-nowrap ${v.key === currentView ? 'active' : 'hover:bg-white/60'}" data-view="${v.key}">${v.label}</button>`
      ).join('');
    $$('#nav .nav-btn').forEach(btn => btn.onclick = () => switchView(btn.dataset.view));
    const moreBtn = $('#nav-more');
    const moreMenu = $('#nav-more-menu');
    if (moreBtn && moreMenu) {
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('hidden');
      };
      $$('#nav-more-menu .nav-more-btn').forEach(btn => btn.onclick = () => {
        switchView(btn.dataset.view);
        moreMenu.classList.add('hidden');
      });
      if (!navMoreDocClickBound) {
        navMoreDocClickBound = true;
        document.addEventListener('click', () => {
          const m = $('#nav-more-menu');
          if (m) m.classList.add('hidden');
        });
      }
    }
    renderHeaderUser();
  }

  // 渲染顶部导航右侧用户头像/登录入口
  function renderHeaderUser() {
    const container = $('#header-user');
    if (!container) return;
    if (!supabase) {
      container.innerHTML = '';
      return;
    }
    if (!currentUser) {
      container.innerHTML = `
        <button id="header-login" type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-mk-sub hover:bg-white/60">
          <span class="w-7 h-7 rounded-full bg-mk-sand flex items-center justify-center text-sm">👤</span>
          <span class="hidden sm:inline">登录</span>
        </button>`;
      $('#header-login').onclick = () => switchView('settings');
      return;
    }
    const name = escapeHtml(getDisplayName());
    const email = escapeHtml(currentUser.email || '');
    container.innerHTML = `
      <div id="header-user-wrap" class="relative group">
        <button id="header-avatar" type="button" class="flex items-center gap-1.5 focus:outline-none" aria-label="打开个人信息">
          ${renderAvatarImg('w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover bg-white shadow-soft ring-2 ring-transparent group-hover:ring-mk-lav transition')}
          <span class="hidden sm:inline text-xs font-semibold text-mk-ink max-w-[80px] truncate">${name}</span>
        </button>
        <div id="header-user-dropdown" class="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl bg-white shadow-soft border border-mk-sand hidden group-hover:block z-50">
          <div class="flex items-center gap-3 pb-3 mb-3 border-b border-mk-sand/60">
            ${renderAvatarImg('w-10 h-10 rounded-full object-cover bg-white')}
            <div class="min-w-0">
              <div class="text-sm font-bold truncate">${name}</div>
              <div class="text-xs text-mk-sub truncate">${email}</div>
            </div>
          </div>
          <button id="header-go-settings" type="button" class="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-mk-sand/40 mb-1">⚙️ 个人信息</button>
          <button id="header-logout" type="button" class="w-full text-left px-3 py-2 rounded-xl text-sm text-rose-500 hover:bg-rose-50">退出账号</button>
        </div>
      </div>`;
    $('#header-avatar').onclick = () => switchView('settings');
    $('#header-go-settings').onclick = () => switchView('settings');
    $('#header-logout').onclick = () => doLogout();
  }
  function switchView(key) {
    currentView = key;
    renderNav();
    const v = $('#view');
    if (key === 'dashboard')  renderDashboard(v);
    if (key === 'warehouse')  renderWarehouse(v);
    if (key === 'recognize')  renderRecognize(v);
    if (key === 'recipes')    renderRecipes(v);
    if (key === 'pattern')    renderPattern(v);
    if (key === 'gallery')    renderGallery(v);
    if (key === 'logs')       renderLogs(v);
    if (key === 'settings')   renderSettings(v);
  }

  /* ===================== 11. 仪表盘 ===================== */
  let restockPortions = {}; // 补货清单：色号 → 份数（默认 1，可改）
  let restockItems = null;  // 当前清单中的色号数组（可删/可增）
  let restockPerQty = 1000; // 每份多少颗
  let restockOpen = false;  // 补货清单面板是否展开（重绘时保持）
  function renderDashboard(v) {
    const low = state.beads.filter(isLow);
    if (!restockItems) restockItems = low.map(b => b.colorNumber);
    const totalStock = state.beads.reduce((s, b) => s + b.stock, 0);
    const recent = state.logs.slice(0, 6);

    v.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        ${statCard('色号种类', state.beads.length, '🌈', 'from-mk-pink to-mk-rose', 'text-mk-ink', 'warehouse')}
        ${statCard('当前总库存', totalStock, '📦', 'from-mk-sky to-mk-mint', 'text-mk-ink', 'warehouse')}
        ${statCard('低库存预警', low.length, '⚠️', 'from-mk-peach to-mk-lemon', low.length ? 'text-rose-500' : '', 'low-stock')}
        ${statCard('操作记录', state.logs.length, '📝', 'from-mk-lav to-mk-sky', 'text-mk-ink', 'logs')}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <section id="low-stock-section" class="mk-card rounded-2xl shadow-soft p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold">🚨 低库存预警（低于补货阈值）</h3>
            ${restockItems && restockItems.length ? '<button id="gen-restock" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-mk-lav/70 text-mk-ink hover:bg-mk-lav/90">📋 生成补货清单</button>' : ''}
          </div>
          ${low.length ? `<div class="space-y-2">${low.map(b => lowRow(b)).join('')}</div>`
            : '<p class="text-mk-sub text-sm">暂无预警，库存充足 ✨</p>'}
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">🕘 最近操作</h3>
          ${recent.length ? `<div class="space-y-2">${recent.map(logRow).join('')}</div>`
            : '<p class="text-mk-sub text-sm">还没有操作记录</p>'}
        </section>
      </div>

      ${restockItems && restockItems.length ? (() => {
        const totalP = restockItems.reduce((s, num) => s + (restockPortions[num] ?? 1), 0);
        const totalG = totalP * restockPerQty;
        return `
      <section id="restock-panel" class="mk-card rounded-2xl shadow-soft p-5 mt-4 ${restockOpen ? '' : 'hidden'}">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 class="font-bold">📋 补货清单</h3>
          <div class="flex items-center gap-2">
            <label class="text-xs text-mk-sub flex items-center gap-1">每份 <input id="restock-per-qty" type="number" min="1" step="1" value="${restockPerQty}" class="w-20 px-2 py-1 rounded-lg bg-white border border-mk-sand text-xs text-right"> 颗</label>
            <button id="copy-restock" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600">📄 复制</button>
            <button id="restock-in" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600">➕ 一键入库</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-mk-sub text-xs border-b border-mk-sand">
                <th class="px-2 py-1 text-left">色号</th>
                <th class="px-2 py-1 text-right">份数</th>
                <th class="px-2 py-1 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              ${restockItems.map(num => {
                const b = beadByNumber(num);
                if (!b) return `<tr class="border-b border-mk-sand/40"><td colspan="3" class="px-2 py-1 text-xs text-rose-500">色号 ${escapeHtml(num)} 不存在</td></tr>`;
                return `
                <tr class="border-b border-mk-sand/40">
                  <td class="px-2 py-1"><span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded-full swatch" style="background:${b.hex}"></span>${b.colorNumber}</span></td>
                  <td class="px-2 py-1 text-right">
                    <input type="number" min="1" step="1" value="${restockPortions[b.colorNumber] ?? 1}" data-num="${escapeHtml(b.colorNumber)}" class="restock-qty w-16 px-2 py-1 rounded-lg bg-white border border-mk-sand text-sm text-right">
                  </td>
                  <td class="px-2 py-1 text-center">
                    <button type="button" class="restock-del text-rose-400 hover:text-rose-600 text-xs font-semibold" data-num="${escapeHtml(b.colorNumber)}">🗑️</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="font-bold text-xs">
                <td class="px-2 py-1 text-right" colspan="2">
                  总份数 <span id="restock-total-p" class="text-rose-500">${totalP}</span> · 总颗数 <span id="restock-total-g" class="text-rose-500">${totalG}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input id="add-restock-num" type="text" placeholder="输入色号（如 A2）" class="flex-1 px-2 py-1.5 rounded-lg bg-white border border-mk-sand text-sm">
          <button id="add-restock" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-mk-sand text-mk-ink hover:bg-mk-sand/50">➕ 新增色号</button>
        </div>
        <p class="text-[11px] text-mk-sub mt-2">💡 份数 = 该色号要补的「份」数（默认 1 份）。每份默认 1000 颗，可在左上角修改。点「一键入库」会按 份数×每份颗数 自动给对应色号加库存并记录。</p>
      </section>`;
      })() : ''}

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
      whSearch = '';
      pendingWarehouseColor = btn.dataset.num;
      switchView('warehouse');
    });
    $$('.stat-card', v).forEach(card => card.onclick = () => {
      const action = card.dataset.action;
      if (!action) return;
      if (action === 'warehouse') {
        whFilterLow = false;
        whSearch = '';
        pendingWarehouseColor = '';
        switchView('warehouse');
      } else if (action === 'logs') {
        switchView('logs');
      } else if (action === 'low-stock') {
        const el = $('#low-stock-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    const di = $('#dash-in'); if (di) di.onclick = () => openBatchStock('入库');
    const dout = $('#dash-out'); if (dout) dout.onclick = () => openBatchStock('出库');
    $$('.low-stock-row', v).forEach(btn => btn.onclick = () => {
      whFilterLow = false;
      whSearch = '';
      pendingWarehouseColor = btn.dataset.num;
      switchView('warehouse');
    });
    const gr = $('#gen-restock');
    if (gr) gr.onclick = () => {
      restockOpen = !restockOpen;
      renderDashboard(v);
      if (restockOpen) { const inp = $('#add-restock-num'); if (inp) inp.focus(); }
    };
    $$('.restock-qty', v).forEach(inp => inp.oninput = () => {
      const num = inp.dataset.num;
      let val = parseInt(inp.value, 10);
      if (!val || val < 1) val = 1;
      restockPortions[num] = val;
      updateRestockTotals();
    });
    $$('.restock-del', v).forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      const num = btn.dataset.num;
      restockItems = restockItems.filter(n => n !== num);
      delete restockPortions[num];
      const scrollY = window.scrollY;
      renderDashboard(v);
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      const inputAfter = $('#add-restock-num');
      if (inputAfter) { inputAfter.focus(); }
    });
    const addBtn = $('#add-restock');
    const addInput = $('#add-restock-num');
    if (addBtn && addInput) {
      const doAdd = e => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const raw = addInput.value.trim().toUpperCase();
        if (!raw) return;
        if (restockItems.includes(raw)) return toast('色号已在清单中', 'warn');
        const b = beadByNumber(raw);
        if (!b) return toast('色号 ' + raw + ' 不存在', 'error');
        restockItems.push(raw);
        restockPortions[raw] = 1;
        const scrollY = window.scrollY;
        renderDashboard(v);
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        const inputAfter = $('#add-restock-num');
        if (inputAfter) { inputAfter.focus(); }
        toast('已添加 ' + raw, 'success');
      };
      addBtn.onclick = doAdd;
      addInput.onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); doAdd(e); } };
    }
    const perInput = $('#restock-per-qty');
    if (perInput) perInput.oninput = () => {
      let val = parseInt(perInput.value, 10);
      if (!val || val < 1) val = 1;
      restockPerQty = val;
      updateRestockTotals();
    };
    const ri = $('#restock-in');
    if (ri) ri.onclick = e => { e.stopPropagation(); restockInOneClick(); };
    const cr = $('#copy-restock');
    if (cr) cr.onclick = e => { e.stopPropagation(); copyRestockList(); };
  }
  function statCard(label, val, icon, grad, valColor = 'text-mk-ink', action = '') {
    const actionAttr = action ? ` data-action="${action}"` : '';
    const cursorClass = action ? ' cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform' : '';
    return `<div class="stat-card mk-card rounded-2xl shadow-soft p-4 bg-gradient-to-br ${grad}${cursorClass}"${actionAttr}>
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
  function updateRestockTotals() {
    const totalP = restockItems.reduce((s, num) => s + (restockPortions[num] ?? 1), 0);
    const totalG = totalP * restockPerQty;
    const pEl = $('#restock-total-p');
    if (pEl) pEl.textContent = totalP;
    const gEl = $('#restock-total-g');
    if (gEl) gEl.textContent = totalG;
  }
  // 从当前补货清单表格 DOM 读取实际条目，避免内存变量不同步导致误报空
  function readRestockItemsFromDOM() {
    const rows = $$('#restock-panel tbody tr');
    const items = [];
    rows.forEach(tr => {
      const numEl = tr.querySelector('td:first-child span:last-child');
      const qtyEl = tr.querySelector('.restock-qty');
      if (!numEl || !qtyEl) return;
      const num = numEl.textContent.trim();
      const portions = parseInt(qtyEl.value, 10) || 1;
      if (num) items.push({ num, portions });
    });
    return items;
  }
  function restockInOneClick() {
    const items = readRestockItemsFromDOM();
    if (!items.length) return toast('清单为空，无法入库', 'warn');
    let totalQty = 0;
    items.forEach(({ num, portions }) => {
      const b = beadByNumber(num);
      if (!b) return;
      const qty = portions * restockPerQty;
      b.stock += qty;
      addLog('入库', b, qty, '补货清单一键入库（' + portions + '份 × ' + restockPerQty + '颗）');
      totalQty += qty;
    });
    save();
    const msg = '已入库 ' + items.length + ' 色，共 ' + totalQty + ' 颗';
    restockItems = null;
    restockPortions = {};
    renderDashboard($('#view'));
    toast(msg, 'success');
  }
  function copyRestockList() {
    const items = readRestockItemsFromDOM();
    if (!items.length) return toast('清单为空，没有可复制的补货内容', 'warn');
    const lines = ['补货清单（每份 ' + restockPerQty + ' 颗）', '色号\t份数\t颗数'];
    let totalP = 0, totalG = 0;
    items.forEach(({ num, portions }) => {
      const b = beadByNumber(num);
      if (!b) return;
      const g = portions * restockPerQty;
      totalP += portions;
      totalG += g;
      lines.push(b.colorNumber + '\t' + portions + '\t' + g);
    });
    lines.push('总份数\t' + totalP + '\t总颗数\t' + totalG);
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('已复制补货清单', 'success'), () => copyTextFallback(text));
    } else copyTextFallback(text);
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
  let whSearch = ''; // 仓库搜索关键字（色号/名称/色值/位置）
  let pendingWarehouseColor = null; // 从仪表盘点击色号后要跳转/高亮的色号
  function renderWarehouse(v) {
    let list = state.beads.slice();
    if (whFilterLow) list = list.filter(isLow);
    const q = whSearch.trim().toLowerCase();
    if (q) list = list.filter(b =>
      b.colorNumber.toLowerCase().includes(q) ||
      (b.colorName || '').toLowerCase().includes(q) ||
      (b.hex || '').toLowerCase().includes(q) ||
      (b.location || '').toLowerCase().includes(q)
    );

    v.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-xl font-bold">📦 豆子仓库</h2>
        <div class="flex gap-2">
          <button id="wh-filter" class="px-3 py-1.5 rounded-xl text-sm font-semibold ${whFilterLow ? 'bg-rose-200 text-rose-700' : 'bg-white/70 text-mk-sub'}">仅看低库存</button>
          <button id="wh-add" class="px-3 py-1.5 rounded-xl text-sm font-semibold bg-mk-rose text-white shadow-soft">+ 新增豆子</button>
        </div>
      </div>
      <div class="flex items-center gap-2 mb-4">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sub text-sm">🔍</span>
          <input id="wh-search" type="text" value="${escapeHtml(whSearch)}" placeholder="搜索色号 / 名称 / 色值 / 位置…" class="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/70 border border-mk-sand text-sm focus:outline-none focus:ring-2 focus:ring-mk-rose/30" />
          ${whSearch ? '<button id="wh-search-clear" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-mk-sub text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand">清除</button>' : ''}
        </div>
        ${q ? `<span class="text-xs text-mk-sub shrink-0">${list.length} 个结果</span>` : ''}
      </div>
      <div class="mk-card rounded-2xl shadow-soft overflow-hidden hidden sm:block">
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
      </div>
      <div class="sm:hidden grid grid-cols-1 gap-2">
        ${list.length ? list.map(beadCard).join('') : `<p class="text-center text-mk-sub py-6">暂无数据</p>`}
      </div>`;

    $('#wh-add').onclick = openAddBead;
    $('#wh-filter').onclick = () => { whFilterLow = !whFilterLow; renderWarehouse(v); };
    const whSearchInput = $('#wh-search');
    if (whSearchInput) {
      // 实时搜索：重渲染后重新聚焦到末尾，避免每次输入丢失光标
      whSearchInput.oninput = (e) => {
        whSearch = e.target.value;
        renderWarehouse(v);
        const ni = $('#wh-search');
        if (ni) { ni.focus(); const len = ni.value.length; ni.setSelectionRange(len, len); }
      };
      // 从仪表盘点色号跳转时（pendingWarehouseColor 已置），不要聚焦搜索框——
      // 否则移动端会弹软键盘并把视图滚到顶部，看起来像「跳到了搜索框」
      if (!pendingWarehouseColor) whSearchInput.focus();
    }
    const whSearchClear = $('#wh-search-clear');
    if (whSearchClear) whSearchClear.onclick = () => { whSearch = ''; renderWarehouse(v); };
    $$('.bead-edit').forEach(b => b.onclick = () => openAddBead(b.dataset.id));
    $$('.bead-adj').forEach(b => b.onclick = () => openAdjust(b.dataset.id));
    $$('.bead-del').forEach(b => b.onclick = () => deleteBead(b.dataset.id));
    if (pendingWarehouseColor) {
      const target = pendingWarehouseColor; pendingWarehouseColor = null;
      // 等本次 innerHTML 布局算好后再定位，并改用瞬时滚动：
      // 移动端（尤其 iOS Safari）behavior:'smooth' 经常失效，导致停在顶部搜索框；
      // 低库存色号在列表很深处，平滑滚动被忽略就会看起来「跳到了搜索框」
      requestAnimationFrame(() => {
        // 只在「当前可见」的色号卡片/行里找：移动端是 .bead-card，桌面端是表格 tr；
        // 另一个被 hidden 掉的元素 offsetParent 为 null，不能用来定位
        const row = $$('[data-num]').find(el =>
          el.dataset.num === target &&
          el.offsetParent !== null &&
          (el.classList.contains('bead-card') || el.tagName === 'TR')
        );
        if (row) {
          row.scrollIntoView({ block: 'center' });
          row.classList.add('ring-2', 'ring-mk-rose', 'bg-mk-rose/5');
          setTimeout(() => row.classList.remove('ring-2', 'ring-mk-rose', 'bg-mk-rose/5'), 2600);
        }
      });
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
  // 移动端卡片布局（<sm 显示）
  function beadCard(b) {
    const low = isLow(b);
    return `<div class="mk-card rounded-2xl p-3 flex items-center gap-3" data-num="${b.colorNumber}">
      <span class="w-10 h-10 rounded-full swatch shrink-0" style="background:${b.hex}"></span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-bold">${b.colorNumber}</span>
          <span class="text-sm truncate">${escapeHtml(b.colorName)}</span>
          ${low ? '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold shrink-0">补货</span>' : '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs shrink-0">正常</span>'}
        </div>
        <div class="text-xs text-mk-sub mt-0.5 truncate">${b.hex}${b.location ? ' · ' + escapeHtml(b.location) : ''} · 库存 <b class="${low ? 'text-rose-500' : ''}">${b.stock}</b> · 阈值 ${effThreshold(b)}</div>
        <div class="flex gap-2 mt-2">
          <button class="bead-adj text-xs px-2.5 py-1 rounded-lg bg-mk-mint text-mk-ink font-semibold" data-id="${b.id}">入库/消耗</button>
          <button class="bead-edit text-xs px-2.5 py-1 rounded-lg bg-white/70 border border-mk-sand text-mk-sub" data-id="${b.id}">编辑</button>
          <button class="bead-del text-xs px-2.5 py-1 rounded-lg bg-rose-50 text-rose-400" data-id="${b.id}">删</button>
        </div>
      </div>
    </div>`;
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
  let tempIgnoreColors = [];  // 本次识别手动标记的忽略颜色（背景/网格线）
  let tempCropRegion = null;  // 当前选中的识别区域（归一化 0~1 的 {x,y,w,h}）
  let tempDetectedVLines = [];  // 选中区域内检测到的垂直网格线（归一化 0~1）
  let tempDetectedHLines = [];  // 选中区域内检测到的水平网格线（归一化 0~1）
  let tempDetectedFramePx = null; // 检测到的图纸边框（分析画布像素坐标 {gx0,gy0,gx1,gy1,aw,ah}），用于按行列数重排网格
  let tempLegendMap = [];     // 用户框选图例后解析出的颜色→色号映射 [{r,g,b,hex,colorNumber,colorName,count}]
  let tempLegendRegion = null; // 图例模式：用户框选的图例区域坐标（与图案区 tempCropRegion 分开保存）


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
      // 图例模式：图例区(紫)与图案区(绿)分别绘制
      if (state.settings.recognizeMode === 'legend') {
        if (tempLegendRegion) drawRegionWithHandles(ctx, tempLegendRegion, dw, dh, '#8b5cf6', '图例区域');
        if (tempCropRegion) drawRegionWithHandles(ctx, tempCropRegion, dw, dh, '#10b981', '图案区域');
      }
    };
    img.src = tempImage;
  }

  // 绘制选择框及其 8 个调整手柄（四边 + 四角）
  function drawRegionWithHandles(ctx, region, dw, dh, color, label) {
    const x = region.x * dw, y = region.y * dh, w = region.w * dw, h = region.h * dh;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(color === '#8b5cf6' ? [6, 3] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = color === '#8b5cf6' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, x + 4, y + 14);

    const s = 8, hs = s / 2;
    const handles = [
      { nx: 0, ny: 0 }, { nx: 0.5, ny: 0 }, { nx: 1, ny: 0 },
      { nx: 1, ny: 0.5 }, { nx: 1, ny: 1 }, { nx: 0.5, ny: 1 },
      { nx: 0, ny: 1 }, { nx: 0, ny: 0.5 }
    ];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (const handle of handles) {
      const hx = x + handle.nx * w - hs;
      const hy = y + handle.ny * h - hs;
      ctx.fillRect(hx, hy, s, s);
      ctx.strokeRect(hx, hy, s, s);
    }
  }

  // 检测鼠标是否落在某个选择框的手柄上，返回 { target:'legend'|'crop', handle:'n'|'s'|... }
  function findResizeTarget(normX, normY) {
    const cv = $('#editor-canvas');
    if (!cv) return null;
    const dw = cv.width, dh = cv.height;
    const threshold = Math.max(0.018, 10 / Math.min(dw, dh));
    const candidates = [
      { target: 'legend', region: tempLegendRegion },
      { target: 'crop', region: tempCropRegion }
    ];
    const handleNames = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const handlePos = [
      { nx: 0, ny: 0 }, { nx: 0.5, ny: 0 }, { nx: 1, ny: 0 },
      { nx: 1, ny: 0.5 }, { nx: 1, ny: 1 }, { nx: 0.5, ny: 1 },
      { nx: 0, ny: 1 }, { nx: 0, ny: 0.5 }
    ];
    for (const cand of candidates) {
      const r = cand.region;
      if (!r) continue;
      for (let i = 0; i < handlePos.length; i++) {
        const hx = r.x + handlePos[i].nx * r.w;
        const hy = r.y + handlePos[i].ny * r.h;
        if (Math.abs(normX - hx) <= threshold && Math.abs(normY - hy) <= threshold) {
          return { target: cand.target, handle: handleNames[i] };
        }
      }
    }
    return null;
  }

  // 根据手柄和拖拽偏移量更新区域（保持对边/对角不动）
  function applyResize(orig, handle, dx, dy) {
    const min = 0.03;
    let x = orig.x, y = orig.y, w = orig.w, h = orig.h;
    if (handle.includes('e')) w = orig.w + dx;
    if (handle.includes('w')) { x = orig.x + dx; w = orig.w - dx; }
    if (handle.includes('s')) h = orig.h + dy;
    if (handle.includes('n')) { y = orig.y + dy; h = orig.h - dy; }

    // 限制在画布内
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > 1) w = 1 - x;
    if (y + h > 1) h = 1 - y;

    // 最小尺寸保护，且当拉过头时保持对边位置
    if (w < min) {
      if (handle.includes('w')) x = orig.x + orig.w - min;
      w = min;
    }
    if (h < min) {
      if (handle.includes('n')) y = orig.y + orig.h - min;
      h = min;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    return { x, y, w, h };
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
          <h2 class="text-xl font-bold mb-1">🖼️ 图纸识别（图例模式）</h2>
          <p class="text-sm text-mk-sub mb-4">上传拼豆图纸，程序会自动定位底部的「颜色图例」条；定位不准时可拖拽边框/四角微调。</p>

          <label class="block border-2 border-dashed border-mk-brown rounded-2xl p-6 text-center cursor-pointer hover:bg-white/50 transition">
            <input id="img-input" type="file" accept="image/png,image/jpeg" class="hidden">
            <div class="text-4xl">📤</div>
            <div class="mt-2 font-semibold">点击上传图纸图片</div>
            <div class="text-xs text-mk-sub">自动识别图纸底部的色块图例（每个色块内印色号、下方印数量）</div>
          </label>

          <div id="preview" class="mt-4 ${tempImage ? '' : 'hidden'}">
            <div class="relative inline-block w-full">
              <canvas id="editor-canvas" class="w-full rounded-xl border border-mk-sand cursor-crosshair bg-white" style="max-height:360px;"></canvas>
              <div id="editor-hint" class="text-[11px] text-mk-sub mt-1">${tempLegendRegion ? '已定位图例区域（紫框）。拖拽紫框/绿框的四边或四角可微调大小，在空白处拖拽可重新框选。' : '在图上拖拽框选<b>图例区域</b>（通常是一整条横向排列的色块）。紫框=图例区，绿框=可选的图案区；框好后可拖拽边框/四角微调大小。'}</div>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <button id="auto-legend-region" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/70 text-mk-ink text-xs font-semibold hover:bg-mk-lav/90">🎯 自动框选图例区域</button>
              <button id="clear-region" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">↺ 重新框选</button>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <!-- 图例识别：自动/手动框选图例 → 解析颜色 → 生成色号清单 → 框选图案 → 统计用量 -->
            <div id="legend-options" class="space-y-2">
              <p class="text-[11px] text-mk-sub"><b>第一步</b>：上传后程序会<b>自动定位</b>图纸底部的图例条（紫框）。若定位不准，可拖拽紫框的四边/四角微调大小，或在空白处拖拽重新框选。<br>点「🤖 AI识别图例」读出色号与数量；识别后若调整了紫框，可点「🔄 重新解析」按新框重新识别。若图例下方已印数量，识别后可直接「存为配方 / 扣减库存」，<b>无需再框选图案</b>。</p>
              <div class="flex items-center justify-between text-sm bg-white/60 rounded-xl px-3 py-2">
                <span class="text-xs text-mk-sub">自动定位图例后，点右侧按钮重新识别（会根据当前紫框重新读取色号与数量）：</span>
                <button id="parse-legend" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/70 text-mk-ink text-xs font-semibold hover:bg-mk-lav/90">${tempLegendMap.length ? '🔄 重新解析' : '🎨 解析图例'}</button>
              </div>
              ${(() => {
                const viaProxy = !state.settings.visionBaseUrl || !state.settings.visionBaseUrl.trim() || state.settings.visionBaseUrl.trim().indexOf('/api/') === 0;
                const aiReady = viaProxy || !!(state.settings.enableVision && state.settings.apiKey);
                return `<button id="ai-parse-legend" type="button" ${aiReady ? '' : 'disabled title="请先到「设置 → 云端视觉AI」启用（默认走内置云端代理）"'} class="w-full px-3 py-2 rounded-xl text-sm font-semibold ${aiReady ? 'bg-gradient-to-r from-violet-400 to-sky-400 text-white hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} ${tempLegendMap.length ? 'hidden' : ''}">🤖 AI识别图例（云端视觉自动读色号）</button>${aiReady ? '' : '<p class="text-[10px] text-center text-mk-sub mt-1">到「设置 → 云端视觉AI」启用即可使用（默认走内置代理，无需填 Key）</p>'}`;
              })()}
              <div id="legend-list" class="${tempLegendMap.length ? '' : 'hidden'}">
                <div class="flex items-center justify-between mb-1">
                  <div class="text-xs text-mk-sub">已解析色号清单${tempLegendMap.some(x => x.count > 0) ? '（含数量）' : ''}（色号/数量可点击编辑）：</div>
                  <button id="clear-legend" type="button" class="text-xs text-rose-400 hover:underline">清空图例</button>
                </div>
                <div id="legend-items" class="flex flex-col gap-1.5 max-h-52 overflow-auto pr-1">
                  ${tempLegendMap.map((it, i) => `
                    <div class="legend-item flex items-center gap-2 p-1.5 rounded-lg bg-white border border-mk-sand" data-i="${i}">
                      <span class="w-5 h-5 rounded-full swatch shrink-0" style="background:${it.hex}"></span>
                      <input type="text" data-field="colorNumber" value="${escapeHtml(it.colorNumber)}" placeholder="色号" class="flex-1 min-w-0 px-2 py-1 rounded bg-mk-sand/30 border border-mk-sand/50 text-xs font-semibold">
                      <div class="flex items-center gap-1 shrink-0">
                        <input type="number" min="0" data-field="count" value="${it.count || 0}" class="w-14 px-1 py-0.5 rounded bg-white border border-mk-sand text-xs text-right">
                        <span class="text-[10px] text-mk-sub">颗</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                ${tempLegendMap.some(x => x.count > 0) ? `
                  <div class="mt-2 flex items-center justify-between text-sm bg-mk-lav/30 rounded-xl px-3 py-2">
                    <span>共 <b class="text-mk-ink">${tempLegendMap.filter(x => x.count > 0).length}</b> 色 · <b class="text-mk-ink">${tempLegendMap.reduce((s, x) => s + (+x.count || 0), 0)}</b> 颗</span>
                    <span class="flex gap-2">
                      <button id="legend-save" type="button" class="px-2.5 py-1 rounded-lg bg-mk-lav text-mk-ink text-xs font-semibold hover:bg-mk-lav/80">存为配方</button>
                      <button id="legend-deduct" type="button" class="px-2.5 py-1 rounded-lg bg-mk-rose text-white text-xs font-semibold hover:opacity-90">扣减库存</button>
                    </span>
                  </div>` : ''}
              </div>
              <button id="legend-usage" type="button" class="w-full px-3 py-2 rounded-xl bg-mk-mint/70 text-mk-ink text-sm font-semibold hover:bg-mk-mint/90 ${tempLegendMap.length ? '' : 'hidden'}">📊 计算整图用量（先框选图案区域）</button>
            </div>
          </div>
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-3">📋 使用说明</h3>
          <ol class="text-sm text-mk-ink/80 space-y-2 list-decimal list-inside">
            <li>上传图纸图片。</li>
            <li>程序会<b>自动定位</b>底部的色块图例（紫框）。若定位不准，可拖拽紫框的四边/四角微调，或在空白处拖拽重新框选。</li>
            <li>点「🤖 AI识别图例」——云端视觉自动读出色号与数量（程序会自动估算色块个数并逐列识别）。</li>
            <li>若图例下方已印数量，识别后可直接「存为配方 / 扣减库存」，<b>无需框选图案</b>。</li>
            <li>若想按实际图案精确统计数量，可再框选<b>图案区域</b>（绿框）后点「计算整图用量」覆盖数量。</li>
            <li>校对色号/数量后，确认扣减库存或存为配方。</li>
          </ol>
          <div class="mt-4 p-3 rounded-xl bg-mk-lemon/50 text-xs text-mk-ink/70">
            💡 本应用只保留「图例识别」一种模式：自动/手动框选色块图例、由云端视觉读取每个色块的色号与下方数量，直接生成色号清单。已移除智能识别/格子采样/像素聚类等旧模式。
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
        tempCropRegion = null;
        tempDetectedVLines = [];
        tempDetectedHLines = [];
        tempDetectedFramePx = null;
        tempLegendMap = [];
        tempLegendRegion = null;
        renderRecognize(v);
        // 上传后自动尝试定位图例条
        const img = new Image();
        img.onload = () => {
          const det = detectLegendRegion(img);
          if (det && det.region) {
            tempLegendRegion = det.region;
            drawEditor();
            toast('已自动定位图例区域，可拖拽边框/四角微调', 'success');
          }
        };
        img.src = tempImage;
      };
      reader.readAsDataURL(file);
    };

    // 编辑器画布事件：拖拽新建框 / 拖拽手柄调整已有框
    const cv = $('#editor-canvas');
    if (cv && tempImage) {
      drawEditor();
      let dragMode = null; // null | 'create' | 'resize'
      let dragging = false, dragStart = null, dragCurrent = null;
      let resizeTarget = null, resizeHandle = null, resizeStartRegion = null, resizeStartPos = null;
      const CURSOR_MAP = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

      const pointerDown = (p) => {
        const hit = findResizeTarget(p.x, p.y);
        if (hit) {
          dragMode = 'resize';
          resizeTarget = hit.target;
          resizeHandle = hit.handle;
          resizeStartRegion = hit.target === 'legend' ? { ...tempLegendRegion } : { ...tempCropRegion };
          resizeStartPos = p;
          return;
        }
        dragMode = 'create';
        dragging = true; dragStart = p; dragCurrent = p;
      };
      const pointerMove = (p) => {
        if (!dragMode) {
          const hit = findResizeTarget(p.x, p.y);
          cv.style.cursor = hit ? (CURSOR_MAP[hit.handle] || 'pointer') : 'crosshair';
        }
        if (dragMode === 'resize') {
          const r = applyResize(resizeStartRegion, resizeHandle, p.x - resizeStartPos.x, p.y - resizeStartPos.y);
          if (resizeTarget === 'legend') tempLegendRegion = r;
          else tempCropRegion = r;
          drawEditor();
          return;
        }
        if (dragMode !== 'create' || !dragging) return;
        dragCurrent = p;
        drawEditor();
        const ctx = cv.getContext('2d');
        const dw = cv.width, dh = cv.height;
        const x = Math.min(dragStart.x, dragCurrent.x) * dw;
        const y = Math.min(dragStart.y, dragCurrent.y) * dh;
        const ww = Math.abs(dragCurrent.x - dragStart.x) * dw;
        const hh = Math.abs(dragCurrent.y - dragStart.y) * dh;
        ctx.strokeStyle = tempLegendRegion ? '#10b981' : '#8b5cf6'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x, y, ww, hh);
        ctx.setLineDash([]);
      };
      const pointerUp = () => {
        if (dragMode === 'resize') {
          dragMode = null;
          resizeTarget = null; resizeHandle = null; resizeStartRegion = null; resizeStartPos = null;
          cv.style.cursor = 'crosshair';
          drawEditor();
          return;
        }
        if (!dragging) return;
        dragging = false;
        if (dragStart && dragCurrent) {
          const x = Math.min(dragStart.x, dragCurrent.x);
          const y = Math.min(dragStart.y, dragCurrent.y);
          const w = Math.abs(dragCurrent.x - dragStart.x);
          const h = Math.abs(dragCurrent.y - dragStart.y);
          if (w > 0.03 && h > 0.03) {
            // 尚未定位图例区时，拖拽用于框选图例；已定位图例后，拖拽用于框选图案区
            if (!tempLegendRegion) {
              tempLegendRegion = { x, y, w, h };
            } else {
              tempCropRegion = { x, y, w, h };
            }
            tempDetectedVLines = []; tempDetectedHLines = [];
          }
        }
        dragStart = null; dragCurrent = null;
        dragMode = null;
        cv.style.cursor = 'crosshair';
        drawEditor();
      };
      cv.onmousedown = (e) => pointerDown(canvasNorm(e, cv));
      cv.onmousemove = (e) => pointerMove(canvasNorm(e, cv));
      cv.onmouseup = pointerUp;
      cv.onmouseleave = pointerUp;

      // 触摸事件（移动端）：禁用默认手势以免拖拽触发页面滚动/缩放
      cv.style.touchAction = 'none';
      cv.addEventListener('touchstart', (e) => {
        if (!e.touches || !e.touches.length) return;
        e.preventDefault();
        pointerDown(canvasNorm(e.touches[0], cv));
      }, { passive: false });
      cv.addEventListener('touchmove', (e) => {
        if (!e.touches || !e.touches.length) return;
        e.preventDefault();
        pointerMove(canvasNorm(e.touches[0], cv));
      }, { passive: false });
      cv.addEventListener('touchend', (e) => {
        e.preventDefault();
        pointerUp();
      }, { passive: false });
    }

    $('#clear-region').onclick = () => {
      tempLegendRegion = null;
      tempCropRegion = null;
      tempDetectedVLines = []; tempDetectedHLines = [];
      tempDetectedFramePx = null;
      drawEditor();
    };
    $('#auto-legend-region').onclick = () => {
      if (!tempImage) return toast('请先上传图片', 'error');
      const img = new Image();
      img.onload = () => {
        const det = detectLegendRegion(img);
        if (!det || !det.region) {
          toast('未能在图片底部自动定位到图例条，请手动拖拽框选', 'warn');
          return;
        }
        tempLegendRegion = det.region;
        tempCropRegion = null;
        tempDetectedVLines = []; tempDetectedHLines = [];
        drawEditor();
        renderRecognize(v);
        toast('已自动定位图例区域，可拖拽边框/四角微调', 'success');
      };
      img.src = tempImage;
    };
    // 统一的 AI 识别/重新识别逻辑：始终整张图例发给模型，读取色号与数量
    async function runAiLegendParse(btn) {
      const viaProxy = !state.settings.visionBaseUrl || !state.settings.visionBaseUrl.trim() || state.settings.visionBaseUrl.trim().indexOf('/api/') === 0;
      if (!viaProxy && !(state.settings.enableVision && state.settings.apiKey)) return toast('当前无法使用云端视觉：请使用内置代理（API 地址留空）或先在设置填写 API Key 与端点', 'warn', 4000);
      if (!tempImage) return toast('请先上传图片', 'error');
      const baseUrl = state.settings.visionBaseUrl || '';
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '⏳ AI识别中…';
      try {
        const img = await loadImage(tempImage);
        let region = tempLegendRegion;
        if (!region && tempCropRegion) region = tempCropRegion;
        if (!region) {
          const det = detectLegendRegion(img);
          if (det && det.region) { region = det.region; tempLegendRegion = region; }
        }
        if (!region) return toast('未能自动定位图例区域，请在图上拖拽框选图例条', 'warn');
        tempLegendMap = await aiParseLegend(img, region, baseUrl);
        tempLegendRegion = region;   // 锁定图例区，图案区留给第二步框选
        tempCropRegion = null;
        tempDetectedVLines = []; tempDetectedHLines = [];
        drawEditor();
        renderRecognize(v);
        const _hasCount = tempLegendMap.some(x => x.count > 0);
        toast(`AI 已识别 ${tempLegendMap.length} 个图例色${_hasCount ? '（已读入色块下方数量，可直接「存为配方 / 扣减库存」）' : '，如需精确数量请再框选图案区域点「计算整图用量」'}`, tempLegendMap.length ? 'success' : 'warn');
      } catch (err) {
        console.error(err);
        toast('AI 识别失败：' + (err.message || err), 'error');
      } finally {
        btn.disabled = false; btn.textContent = oldText;
      }
    }

    $('#parse-legend').onclick = () => runAiLegendParse($('#parse-legend'));
    // AI 识别图例：首次识别按钮（识别完成后隐藏，由「重新解析」接管）
    const aiLegendBtn = $('#ai-parse-legend');
    if (aiLegendBtn) aiLegendBtn.onclick = () => runAiLegendParse(aiLegendBtn);
    $('#clear-legend').onclick = () => {
      tempLegendMap = [];
      tempLegendRegion = null;
      renderRecognize(v);
    };
    // 图例清单编辑事件（事件委托）
    const legendItems = $('#legend-items');
    if (legendItems) legendItems.oninput = (e) => {
      const item = e.target.closest('.legend-item');
      if (!item) return;
      const idx = +item.dataset.i;
      const field = e.target.dataset.field;
      if (tempLegendMap[idx] && field) {
        tempLegendMap[idx][field] = (field === 'count') ? Math.max(0, parseInt(e.target.value, 10) || 0) : e.target.value;
      }
    };

    // 图例模式：统计整图用量 / 存配方 / 扣减库存
    const legendUsageBtn = $('#legend-usage');
    if (legendUsageBtn) legendUsageBtn.onclick = () => {
      if (!tempImage) return toast('请先上传图片', 'error');
      if (!tempLegendMap.length) return toast('请先解析图例', 'error');
      const img = new Image();
      img.onload = () => {
        const res = computeLegendUsage(img);
        if (res.error) { toast(res.error, 'warn'); return; }
        renderRecognize(v);
        toast(`已统计 ${res.matched} 个色号，共 ${res.total} 颗`, 'success');
      };
      img.src = tempImage;
    };
    const legendSaveBtn = $('#legend-save');
    if (legendSaveBtn) legendSaveBtn.onclick = () => {
      const items = tempLegendMap.filter(x => x.colorNumber && x.count > 0).map(x => ({ colorNumber: x.colorNumber, colorName: x.colorName, hex: x.hex, qty: x.count }));
      if (!items.length) return toast('没有带数量的色号可保存', 'warn');
      const def = '图例图纸 ' + fmtTime(Date.now());
      const name = (window.prompt('配方名称', def) || '').trim() || def;
      state.recipes.unshift({ id: uid('rc'), name, createdAt: Date.now(), items });
      save();
      toast('已保存到配方库', 'success');
      switchView('recipes');
    };
    const legendDeductBtn = $('#legend-deduct');
    if (legendDeductBtn) legendDeductBtn.onclick = () => {
      let ok = 0, skip = 0;
      tempLegendMap.filter(x => x.colorNumber && x.count > 0).forEach(x => {
        const bead = beadByNumber(x.colorNumber);
        if (!bead) { skip++; return; }
        bead.stock = Math.max(0, bead.stock - x.count);
        addLog('图纸消耗', bead, -x.count, '图例识别扣减');
        ok++;
      });
      save();
      switchView('dashboard');
      toast(`已扣减 ${ok} 种颜色${skip ? `，跳过 ${skip} 种未匹配` : ''}`, 'success');
    };

  }

  // 图例模式：用图例色卡统计图案区域每个色号的用量（数量=格子数）
  function computeLegendUsage(img) {
    const pattern = tempCropRegion || { x: 0, y: 0, w: 1, h: 1 };
    const det = detectGridLines(img, pattern);
    let vLines = det.vLines, hLines = det.hLines;
    if (vLines.length < 2 || hLines.length < 2) {
      const cols = state.settings.gridCols, rows = state.settings.gridRows;
      if (!cols || !rows || cols < 1 || rows < 1) {
        return { error: '未检测到清晰网格线。请切换到「格子采样」或「智能识别」模式框选图案区域并确认格子数后再统计。' };
      }
      vLines = []; hLines = [];
      for (let i = 0; i <= cols; i++) vLines.push(i / cols);
      for (let i = 0; i <= rows; i++) hLines.push(i / rows);
    }
    const { w, h, ctx } = createAnalysisCanvas(img, 1500);
    const data = ctx.getImageData(0, 0, w, h).data;
    const frac = 0.5;
    const acc = new Map();
    for (let yi = 0; yi < hLines.length - 1; yi++) {
      for (let xi = 0; xi < vLines.length - 1; xi++) {
        const lx = Math.round(vLines[xi] * w), rx = Math.round(vLines[xi + 1] * w);
        const ty = Math.round(hLines[yi] * h), by = Math.round(hLines[yi + 1] * h);
        if (lx >= rx || ty >= by) continue;
        const cxN = (vLines[xi] + vLines[xi + 1]) / 2, cyN = (hLines[yi] + hLines[yi + 1]) / 2;
        if (tempCropRegion) {
          const r = tempCropRegion;
          if (cxN < r.x || cxN > r.x + r.w || cyN < r.y || cyN > r.y + r.h) continue;
        }
        if (tempLegendRegion) {
          const lr = tempLegendRegion;
          if (cxN >= lr.x && cxN <= lr.x + lr.w && cyN >= lr.y && cyN <= lr.y + lr.h) continue;
        }
        const cw = rx - lx, ch = by - ty;
        const iw = Math.max(1, Math.round(cw * frac)), ih = Math.max(1, Math.round(ch * frac));
        const sx = lx + ((cw - iw) >> 1), sy = ty + ((ch - ih) >> 1);
        const freq = new Map();
        for (let py = sy; py < sy + ih; py++) {
          for (let px = sx; px < sx + iw; px++) {
            const idx = (py * w + px) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            if ((r + g + b) / 3 > 236) continue;
            const key = ((r & 0xF8) << 16) | ((g & 0xF8) << 8) | (b & 0xF8);
            freq.set(key, (freq.get(key) || 0) + 1);
          }
        }
        if (!freq.size) continue;
        let bestK = 0, bestC = 0;
        for (const [k, c] of freq) { if (c > bestC) { bestC = c; bestK = k; } }
        const r = (bestK >> 16) & 0xFF, g = (bestK >> 8) & 0xFF, b = bestK & 0xFF;
        let ignored = false;
        for (const ig of tempIgnoreColors) { if (colorDist(r, g, b, ig.r, ig.g, ig.b) <= (ig.tolerance || 24)) { ignored = true; break; } }
        if (ignored || isGridBackgroundLike(r, g, b)) continue;
        const m = mapColorToStandard(r, g, b, tempLegendMap);
        if (!m.colorNumber || m.matchedBy !== '图例') continue;
        const key = m.colorNumber;
        if (!acc.has(key)) acc.set(key, { colorNumber: m.colorNumber, colorName: m.colorName, hex: m.hex, qty: 0 });
        acc.get(key).qty += 1;
      }
    }
    tempLegendMap.forEach(it => { it.count = 0; });
    let total = 0;
    acc.forEach(a => {
      const it = tempLegendMap.find(x => x.colorNumber === a.colorNumber);
      if (it) { it.count = a.qty; total += a.qty; }
    });
    return { total, matched: acc.size };
  }

  // 自动检测图纸底部的横向颜色图例条，返回 { region: {x,y,w,h}, estimatedCols }
  // 失败时返回 null。region 坐标为相对于原图的归一化值（0~1）。
  function detectLegendRegion(img) {
    const MAX_W = 1200;
    const { w, h, ctx } = createAnalysisCanvas(img, MAX_W);
    const data = ctx.getImageData(0, 0, w, h).data;

    function isBg(r, g, b) { return r > 248 && g > 248 && b > 248; }
    function isText(r, g, b) { return r < 40 && g < 40 && b < 40; }
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 25 && mx > 50 && mx < 235; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b); }

    // 1. 只扫描底部 30% 区域（图例通常位于图纸最底部）
    const yStart = Math.floor(h * 0.70);
    const rowInfos = [];
    for (let y = yStart; y < h; y++) {
      let goodCount = 0;
      const segments = [];
      let inSeg = false, segStart = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const ok = goodPx(r, g, b);
        if (ok) {
          goodCount++;
          if (!inSeg) { inSeg = true; segStart = x; }
        } else {
          if (inSeg) {
            if (x - segStart >= 2) segments.push({ x0: segStart, x1: x });
            inSeg = false;
          }
        }
      }
      if (inSeg && w - segStart >= 2) segments.push({ x0: segStart, x1: w });
      const ratio = goodCount / w;
      const segScore = Math.min(segments.length, 10) * 0.06;
      const multiSegBonus = segments.length >= 3 ? 0.12 : 0;
      const score = ratio + segScore + multiSegBonus;
      rowInfos[y] = { goodCount, segments, ratio, score };
    }

    // 2. 评分：有效像素比例 + 段数奖励（图例行应有多个小色块段）
    let bestY = -1, bestScore = 0;
    for (let y = yStart; y < h; y++) {
      if (rowInfos[y].score > bestScore) { bestScore = rowInfos[y].score; bestY = y; }
    }
    if (bestY < 0 || bestScore < 0.20) return null;

    // 3. 从 bestY 向上下严格扩展「核心色块条带」：要求同时段数多且比例高，
    //    避免把图案主体或底部水印/文字误扩进来。
    const coreSegThresh = 3;
    const coreRatioThresh = 0.45;
    const scoreRatioThresh = 0.55;
    const minScoreThresh = 0.30;
    const maxExpandUp = Math.round(h * 0.05);
    const maxExpandDown = Math.round(h * 0.05);

    let coreY0 = bestY, coreY1 = bestY;
    while (coreY0 > Math.max(yStart, bestY - maxExpandUp)) {
      const r = rowInfos[coreY0 - 1];
      const good = (r.segments.length >= coreSegThresh && r.ratio >= coreRatioThresh) ||
                   (r.score >= bestScore * scoreRatioThresh && r.score >= minScoreThresh);
      if (!good) break;
      coreY0--;
    }
    while (coreY1 < Math.min(h - 1, bestY + maxExpandDown)) {
      const r = rowInfos[coreY1 + 1];
      const good = (r.segments.length >= coreSegThresh && r.ratio >= coreRatioThresh) ||
                   (r.score >= bestScore * scoreRatioThresh && r.score >= minScoreThresh);
      if (!good) break;
      coreY1++;
    }

    // 保底核心高度
    if (coreY1 - coreY0 + 1 < 8) {
      coreY0 = Math.max(yStart, bestY - 8);
      coreY1 = Math.min(h - 1, bestY + 8);
    }

    // 4. 在核心条带内做 x 方向投影，取最长连续彩色带作为图例主体
    const gapThresh = Math.max(2, Math.round(w * 0.003));
    const runs = [];
    let run = null;
    for (let x = 0; x < w; x++) {
      let cnt = 0;
      for (let y = coreY0; y <= coreY1; y++) {
        const i = (y * w + x) * 4;
        if (goodPx(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt > 0) {
        if (!run) run = { x0: x, x1: x, gap: 0 };
        else { run.x1 = x; run.gap = 0; }
      } else if (run) {
        run.gap++;
        if (run.gap > gapThresh) { runs.push({ x0: run.x0, x1: run.x1 - run.gap }); run = null; }
      }
    }
    if (run) runs.push({ x0: run.x0, x1: run.x1 - run.gap });

    const minBlockW = Math.max(4, Math.round(w * 0.007));
    const validRuns = runs.filter(r => r.x1 - r.x0 + 1 >= minBlockW);
    if (validRuns.length < 1) return null;

    const mainRun = validRuns.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), { x0: 0, x1: -1 });
    const stripW = mainRun.x1 - mainRun.x0 + 1;
    if (stripW < w * 0.08) return null;

    // 5. 在主体内按饱和度能量峰估算列数（色块间隙很小时比简单 run 更稳）
    const energy = new Array(w).fill(0);
    for (let x = mainRun.x0; x <= mainRun.x1; x++) {
      let sum = 0, cnt = 0;
      for (let y = coreY0; y <= coreY1; y++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (goodPx(r, g, b)) { sum += Math.max(r, g, b) - Math.min(r, g, b); cnt++; }
      }
      energy[x] = cnt ? sum / cnt : 0;
    }
    const smooth = energy.map((v, i) => {
      let sum = 0, n = 0;
      for (let d = -2; d <= 2; d++) if (energy[i + d] !== undefined) { sum += energy[i + d]; n++; }
      return sum / n;
    });

    const peaks = [];
    for (let x = mainRun.x0 + 3; x <= mainRun.x1 - 3; x++) {
      if (smooth[x] > smooth[x - 1] && smooth[x] > smooth[x + 1] && smooth[x] > 5) peaks.push(x);
    }
    const mergeDist = 8;
    const groups = [];
    for (const p of peaks) {
      const last = groups[groups.length - 1];
      if (last && p - last[last.length - 1] < mergeDist) last.push(p);
      else groups.push([p]);
    }
    let estimatedCols = groups.length;
    const fallbackCols = Math.max(3, Math.round(stripW / 28));
    if (estimatedCols < 3) estimatedCols = fallbackCols;
    if (estimatedCols > 60) estimatedCols = 60;

    // 6. 最终 region：核心条带 + 有限上下扩展（包含色号/数量文字，但避免包含底部水印）
    const coreH = coreY1 - coreY0 + 1;
    const vertExpand = Math.min(Math.round(coreH * 0.6), 22);
    const y0 = Math.max(yStart, coreY0 - vertExpand);
    const y1 = Math.min(h - 1, coreY1 + vertExpand);

    return {
      region: {
        x: Math.max(0, mainRun.x0 / w),
        y: Math.max(0, y0 / h),
        w: Math.min(1, stripW / w),
        h: Math.min(1, (y1 - y0 + 1) / h)
      },
      estimatedCols
    };
  }

  // 解析用户框选的图例区域：自动估算列数，按列采样色块中心颜色，再映射到标准色号
  function parseLegendRegion(img, region, opts = {}) {
    const MAX = 800;
    const { w, h, ctx } = createAnalysisCanvas(img, MAX);
    const data = ctx.getImageData(0, 0, w, h).data;
    const rx0 = Math.max(0, Math.round(region.x * w));
    const ry0 = Math.max(0, Math.round(region.y * h));
    const rx1 = Math.min(w, Math.round((region.x + region.w) * w));
    const ry1 = Math.min(h, Math.round((region.y + region.h) * h));

    function isBg(r, g, b) { return r > 248 && g > 248 && b > 248; }
    function isText(r, g, b) { return r < 40 && g < 40 && b < 40; }
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 20 && mx > 60 && mx < 230; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b); }

    // 1. 找出色块行（y 方向颜色能量最大的几行）
    let bestY = ry0, bestCount = 0;
    for (let y = ry0; y < ry1; y++) {
      let cnt = 0;
      for (let x = rx0; x < rx1; x++) {
        const i = (y * w + x) * 4;
        if (goodPx(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt > bestCount) { bestCount = cnt; bestY = y; }
    }
    if (bestCount < 5) return [];
    const stripY0 = Math.max(ry0, bestY - 12);
    const stripY1 = Math.min(ry1 - 1, bestY + 12);

    // 2. 裁剪左右空白边距，并合并色块间的小间隙，取最长连续色块带
    const runs = [];
    let run = null;
    const gapThresh = Math.max(4, Math.round((rx1 - rx0) * 0.015));
    for (let x = rx0; x < rx1; x++) {
      let cnt = 0;
      for (let y = stripY0; y <= stripY1; y++) {
        const i = (y * w + x) * 4;
        if (goodPx(data[i], data[i + 1], data[i + 2])) cnt++;
      }
      if (cnt > 2) {
        if (!run) run = { x0: x, x1: x, gap: 0 };
        else { run.x1 = x; run.gap = 0; }
      } else if (run) {
        run.gap++;
        if (run.gap > gapThresh) { runs.push({ x0: run.x0, x1: run.x1 - run.gap }); run = null; }
      }
    }
    if (run) runs.push({ x0: run.x0, x1: run.x1 - run.gap });
    const longest = runs.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), { x0: 0, x1: -1 });
    if (longest.x1 - longest.x0 < 5) return [];
    const firstX = longest.x0, lastX = longest.x1;
    const stripW = lastX - firstX + 1;

    // 3. 估算列数：按 x 方向颜色能量找峰
    const energy = [];
    for (let x = rx0; x < rx1; x++) {
      let e = 0, cnt = 0;
      for (let y = stripY0; y <= stripY1; y++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (goodPx(r, g, b)) { e += Math.max(r, g, b) - Math.min(r, g, b); cnt++; }
      }
      energy[x] = cnt ? e / cnt : 0;
    }
    // 平滑
    const smooth = energy.map((v, i) => {
      let sum = 0, n = 0;
      for (let d = -2; d <= 2; d++) if (energy[i + d] !== undefined) { sum += energy[i + d]; n++; }
      return sum / n;
    });
    const peaks = [];
    for (let x = firstX + 3; x <= lastX - 3; x++) {
      if (smooth[x] > smooth[x - 1] && smooth[x] > smooth[x + 1] && smooth[x] > 8) peaks.push(x);
    }
    // 合并邻近峰
    const groups = [];
    for (const p of peaks) {
      const last = groups[groups.length - 1];
      if (last && p - last[last.length - 1] < 8) last.push(p);
      else groups.push([p]);
    }
    let estimatedCols = groups.length;
    if (estimatedCols < 2) estimatedCols = 2;
    if (estimatedCols > 60) estimatedCols = 60;

    // 4. 按目标列数等分采样
    const targetCols = (opts.cols && opts.cols > 0) ? opts.cols : estimatedCols;
    const colW = stripW / targetCols;
    const colors = [];
    for (let i = 0; i < targetCols; i++) {
      const cx = firstX + Math.round((i + 0.5) * colW);
      const colorMap = {};
      let total = 0;
      for (let y = stripY0; y <= stripY1; y++) {
        for (let x = Math.max(rx0, cx - 6); x <= Math.min(rx1 - 1, cx + 6); x++) {
          const ii = (y * w + x) * 4;
          const r = data[ii], g = data[ii + 1], b = data[ii + 2];
          if (goodPx(r, g, b)) {
            const k = `${Math.round(r / 4) * 4},${Math.round(g / 4) * 4},${Math.round(b / 4) * 4}`;
            colorMap[k] = (colorMap[k] || 0) + 1; total++;
          }
        }
      }
      if (!total) continue;
      const dom = Object.entries(colorMap).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
      const std = mapColorToStandard(dom[0], dom[1], dom[2]);
      colors.push({
        r: dom[0], g: dom[1], b: dom[2],
        hex: rgbToHex(dom[0], dom[1], dom[2]),
        colorNumber: std.colorNumber || '',
        colorName: std.colorName || ''
      });
    }

    colors.estimatedCols = estimatedCols;
    colors.peakCenters = groups.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
    return colors;
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
    $$('.rc-edit').forEach(b => b.onclick = () => editPatternFromRecipe(b.dataset.id));
  }
  function recipeCard(rc) {
    const total = rc.items.reduce((s, i) => s + i.qty, 0);
    const gridBadge = rc.grid ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-mk-mint/60 text-mk-ink whitespace-nowrap">📐 ${rc.grid.cols}×${rc.grid.rows} 图纸</span>` : '';
    return `<div class="mk-card rounded-2xl shadow-soft p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="font-bold truncate">${escapeHtml(rc.name)}</div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${gridBadge}
          <span class="text-xs text-mk-sub">${fmtTime(rc.createdAt)}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-2">
        ${rc.items.slice(0, 12).map(i => `<span class="w-5 h-5 rounded-full swatch inline-block" style="background:${i.hex}" title="${i.colorNumber} ${i.colorName} ×${i.qty}"></span>`).join('')}
        ${rc.items.length > 12 ? `<span class="text-xs text-mk-sub self-center">+${rc.items.length - 12}</span>` : ''}
      </div>
      <div class="text-sm text-mk-sub mt-2">${rc.items.length} 种颜色 · 约 ${total} 颗豆</div>
      <div class="flex flex-wrap gap-2 mt-3">
        ${rc.grid ? `<button class="rc-edit text-xs px-3 py-1.5 rounded-xl bg-mk-lemon text-mk-ink font-semibold" data-id="${rc.id}">✏️ 编辑图纸</button>` : ''}
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

  /* ===================== 15.5 图库 ===================== */
  // 图纸图库：用户上传图纸，记录名称/来源(平台)/作者，并标记是否已拼。
  let galleryFilter = 'all'; // 'all' | 'unmade' | 'made'
  let galleryEditId = null; // 当前处于内联编辑的图纸 id
  function renderGallery(v) {
    const all = state.gallery;
    const unmade = all.filter(g => g.status === 'unmade');
    const made = all.filter(g => g.status === 'made');
    const list = galleryFilter === 'all' ? all : (galleryFilter === 'unmade' ? unmade : made);
    v.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-xl font-bold">🖼️ 图库</h2>
        <button id="gallery-add" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">+ 添加图纸</button>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        ${gStatCard('全部', all.length, galleryFilter === 'all')}
        ${gStatCard('未拼', unmade.length, galleryFilter === 'unmade')}
        ${gStatCard('已拼', made.length, galleryFilter === 'made')}
      </div>
      ${list.length ? `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${list.map(galleryCard).join('')}</div>`
        : '<div class="mk-card rounded-2xl shadow-soft p-8 text-center text-mk-sub">还没有图纸，点右上角「+ 添加图纸」上传吧 🌟</div>'}`;
    $('#gallery-add').onclick = openAddGalleryModal;
    $$('.g-filter').forEach(b => b.onclick = () => { galleryFilter = b.dataset.f; galleryEditId = null; renderGallery(v); });
    $$('.g-toggle').forEach(b => b.onclick = () => {
      const g = state.gallery.find(x => x.id === b.dataset.id);
      if (g) { g.status = (g.status === 'made' ? 'unmade' : 'made'); save(); renderGallery(v); }
    });
    $$('.g-del').forEach(b => b.onclick = () => {
      if (confirm('删除该图纸？')) { state.gallery = state.gallery.filter(x => x.id !== b.dataset.id); save(); renderGallery(v); }
    });
    $$('.g-view').forEach(b => b.onclick = () => {
      if (b.dataset.id === galleryEditId) return; // 编辑中不跳转详情
      const g = state.gallery.find(x => x.id === b.dataset.id);
      if (g) viewGallery(g);
    });
    $$('.g-edit').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      galleryEditId = b.dataset.id;
      renderGallery(v);
    });
    $$('.g-e-save').forEach(b => b.onclick = () => {
      const card = b.closest('.mk-card');
      const g = state.gallery.find(x => x.id === b.dataset.id);
      if (!g || !card) return;
      const name = (card.querySelector('.g-e-name').value || '').trim();
      if (!name) return toast('请填写图纸名称', 'error');
      g.name = name;
      g.platform = (card.querySelector('.g-e-platform').value || '').trim();
      g.author = (card.querySelector('.g-e-author').value || '').trim();
      g.status = card.querySelector('.g-e-made').checked ? 'made' : 'unmade';
      galleryEditId = null;
      save(); renderGallery(v); toast('已保存修改', 'success');
    });
    $$('.g-e-cancel').forEach(b => b.onclick = () => {
      galleryEditId = null;
      renderGallery(v);
    });
  }
  function gStatCard(label, val, active) {
    const f = label === '全部' ? 'all' : (label === '未拼' ? 'unmade' : 'made');
    return `<button class="g-filter mk-card rounded-2xl shadow-soft p-4 text-center ${active ? 'ring-2 ring-mk-rose' : 'hover:scale-[1.02]'} transition" data-f="${f}">
      <div class="text-2xl font-bold text-mk-ink">${val}</div>
      <div class="text-xs text-mk-sub mt-1">${label}</div>
    </button>`;
  }
  function galleryCard(g) {
    const made = g.status === 'made';
    const editing = g.id === galleryEditId;
    if (!editing) {
      return `<div class="mk-card rounded-2xl shadow-soft p-3">
        <div class="g-view cursor-pointer group" data-id="${g.id}">
          <div class="rounded-xl overflow-hidden bg-mk-sand/30 aspect-[4/3] flex items-center justify-center relative">
            ${g.image ? `<img src="${g.image}" class="w-full h-full object-contain" alt="${escapeHtml(g.name)}">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <span class="text-xs bg-white/80 text-mk-ink px-2 py-1 rounded-full shadow-sm">点击查看详情</span>
            </div>` : '<span class="text-mk-sub text-sm">无图</span>'}
          </div>
        </div>
        <div class="mt-2">
          <div class="font-bold truncate">${escapeHtml(g.name)}</div>
          <div class="text-xs text-mk-sub mt-0.5 truncate">${g.platform ? '📦 ' + escapeHtml(g.platform) : ''}${g.platform && g.author ? ' · ' : ''}${g.author ? '✍️ ' + escapeHtml(g.author) : ''}</div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-[11px] px-2 py-0.5 rounded-full ${made ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">${made ? '✓ 已拼' : '○ 未拼'}</span>
            <div class="flex gap-1.5">
              <button class="g-edit text-[11px] px-2.5 py-1.5 rounded-xl bg-sky-50 text-sky-500" data-id="${g.id}">编辑</button>
              <button class="g-toggle text-[11px] px-2.5 py-1.5 rounded-xl ${made ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}" data-id="${g.id}">${made ? '标记未拼' : '标记已拼'}</button>
              <button class="g-del text-[11px] px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-400" data-id="${g.id}">删除</button>
            </div>
          </div>
        </div>
      </div>`;
    }
    // 编辑模式：名称、平台、作者、状态直接就地可改
    const esc = s => escapeHtml(s).replace(/"/g, '&quot;');
    return `<div class="mk-card rounded-2xl shadow-soft p-3 ring-2 ring-sky-300">
      <div class="g-view cursor-pointer group" data-id="${g.id}">
        <div class="rounded-xl overflow-hidden bg-mk-sand/30 aspect-[4/3] flex items-center justify-center relative">
          ${g.image ? `<img src="${g.image}" class="w-full h-full object-contain" alt="${escapeHtml(g.name)}">` : '<span class="text-mk-sub text-sm">无图</span>'}
        </div>
      </div>
      <div class="mt-2 space-y-1.5">
        <label class="flex items-center gap-1.5">
          <span class="text-xs text-mk-sub shrink-0 w-10 text-right">名字</span>
          <input class="g-e-name flex-1 text-sm font-bold px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-id="${g.id}" value="${esc(g.name)}" placeholder="名称（必填）">
        </label>
        <label class="flex items-center gap-1.5">
          <span class="text-xs text-mk-sub shrink-0 w-10 text-right">来源</span>
          <input class="g-e-platform flex-1 text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-id="${g.id}" value="${esc(g.platform || '')}" placeholder="平台 / 来源">
        </label>
        <label class="flex items-center gap-1.5">
          <span class="text-xs text-mk-sub shrink-0 w-10 text-right">作者</span>
          <input class="g-e-author flex-1 text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-id="${g.id}" value="${esc(g.author || '')}" placeholder="作者">
          <span class="text-xs text-mk-sub shrink-0">已拼</span>
          <input class="g-e-made" type="checkbox" data-id="${g.id}" ${made ? 'checked' : ''}>
        </label>
        <div class="flex gap-1.5 pt-1">
          <button class="g-e-save text-[11px] px-3 py-1.5 rounded-xl bg-mk-rose text-white font-semibold" data-id="${g.id}">保存</button>
          <button class="g-e-cancel text-[11px] px-3 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" data-id="${g.id}">取消</button>
        </div>
      </div>
    </div>`;
  }
  function viewGallery(g) {
    const made = g.status === 'made';
    const body = `
      <div class="flex flex-col items-center">
        ${g.image ? `<div class="relative group cursor-zoom-in" id="g-detail-img-wrap">
            <img src="${g.image}" class="max-w-full max-h-[60vh] rounded-xl border border-mk-sand" alt="${escapeHtml(g.name)}">
            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
              <span class="text-xs bg-black/50 text-white px-2 py-1 rounded-full">点击放大</span>
            </div>
          </div>` : '<div class="text-mk-sub">该图纸无图片</div>'}
        <div class="mt-3 text-sm text-mk-sub w-full space-y-1">
          <div><b>名称：</b>${escapeHtml(g.name)}</div>
          <div><b>平台 / 来源：</b>${escapeHtml(g.platform || '—')}</div>
          <div><b>作者：</b>${escapeHtml(g.author || '—')}</div>
          <div><b>状态：</b>${made ? '已拼' : '未拼'}</div>
          <div><b>添加时间：</b>${fmtTime(g.createdAt)}</div>
        </div>
      </div>`;
    openModal('图纸详情：' + g.name, body, { wide: true });
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">关闭</button>
      <button id="g-edit2" class="px-4 py-2 rounded-xl bg-sky-100 text-sky-600 font-semibold">编辑</button>
      <button id="g-toggle2" class="px-4 py-2 rounded-xl ${made ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'} font-semibold">${made ? '标记未拼' : '标记已拼'}</button>`);
    $('#g-toggle2').onclick = () => { g.status = made ? 'unmade' : 'made'; save(); closeModal(); renderGallery($('#view')); toast(made ? '已标记为未拼' : '已标记为已拼', 'success'); };
    $('#g-edit2').onclick = () => { galleryEditId = g.id; closeModal(); renderGallery($('#view')); };
    const imgWrap = $('#g-detail-img-wrap');
    if (imgWrap) imgWrap.onclick = () => openGalleryImageZoom(g);
  }
  function openAddGalleryModal() {
    const body = `
      <div class="space-y-3">
        <div>
          <label class="text-sm font-semibold block mb-1">图纸图片（可多选批量上传）*</label>
          <input id="g-file" type="file" accept="image/*" multiple class="w-full text-sm">
          <div id="g-preview-list" class="mt-2 hidden grid sm:grid-cols-2 gap-2"></div>
        </div>
        <p class="text-xs text-mk-sub">填写第 1 张图纸信息后，点击「批量应用」可把名称按序号顺延到其他图纸。不点击则各张单独填写。</p>
      </div>`;
    openModal('添加图纸', body, { wide: true });
    let pendingItems = []; // { img, name, platform, author, status }
    const fileInput = $('#g-file');
    const listEl = $('#g-preview-list');
    const escapeAttr = s => escapeHtml(s).replace(/"/g, '&quot;');
    const renderPreviewList = () => {
      listEl.innerHTML = pendingItems.map((it, i) => {
        const made = it.status === 'made';
        return `<div class="mk-card rounded-xl p-2 flex gap-2">
          <div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-mk-sand/30 flex items-center justify-center">
            <img src="${it.img}" class="w-full h-full object-contain" alt="${escapeAttr(it.name)}">
          </div>
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-mk-sub">#${i + 1}</span>
              ${i === 0 ? '<span class="text-[11px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">模板</span>' : ''}
            </div>
            <input class="g-name w-full text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-i="${i}" value="${escapeAttr(it.name)}" placeholder="名称">
            <input class="g-platform w-full text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-i="${i}" value="${escapeAttr(it.platform || '')}" placeholder="平台 / 来源">
            <div class="flex items-center gap-1.5">
              <input class="g-author flex-1 text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand" data-i="${i}" value="${escapeAttr(it.author || '')}" placeholder="作者">
              <label class="flex items-center gap-1 text-[11px] whitespace-nowrap"><input class="g-made" type="checkbox" data-i="${i}" ${made ? 'checked' : ''}>已拼</label>
            </div>
          </div>
        </div>`;
      }).join('');
      listEl.querySelectorAll('.g-name').forEach(inp => {
        inp.oninput = () => { pendingItems[+inp.dataset.i].name = inp.value; };
      });
      listEl.querySelectorAll('.g-platform').forEach(inp => {
        inp.oninput = () => { pendingItems[+inp.dataset.i].platform = inp.value; };
      });
      listEl.querySelectorAll('.g-author').forEach(inp => {
        inp.oninput = () => { pendingItems[+inp.dataset.i].author = inp.value; };
      });
      listEl.querySelectorAll('.g-made').forEach(inp => {
        inp.onchange = () => { pendingItems[+inp.dataset.i].status = inp.checked ? 'made' : 'unmade'; };
      });
    };
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="g-apply-all" class="px-4 py-2 rounded-xl bg-sky-100 text-sky-600 font-semibold" disabled>批量应用</button>
      <button id="g-save" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold">添加到图库</button>`);
    const applyBtn = $('#g-apply-all');
    applyBtn.onclick = () => {
      if (!pendingItems.length) return;
      const base = pendingItems[0];
      pendingItems.forEach((it, i) => {
        it.platform = base.platform;
        it.author = base.author;
        it.status = base.status;
        if (i === 0) return;
        const rawName = (base.name || '').trim();
        if (!rawName) {
          it.name = base.name;
          return;
        }
        // 去掉尾部已有序号（支持 2、_2、(2) 等）再顺延
        const stem = rawName.replace(/\s*(?:\(|_|-)?\d+\)?$/, '').trim();
        it.name = stem + ' ' + (i + 1);
      });
      renderPreviewList();
      toast('已批量应用，名称按序号顺延', 'success');
    };
    const updateApplyDisabled = () => {
      applyBtn.disabled = pendingItems.length < 2;
      applyBtn.title = pendingItems.length < 2 ? '至少上传两张图才可批量应用' : '将第 1 张的信息应用到全部图纸';
    };
    const wrappedRender = () => { renderPreviewList(); updateApplyDisabled(); };
    fileInput.onchange = async () => {
      const files = [...fileInput.files];
      if (!files.length) return;
      listEl.classList.remove('hidden');
      listEl.innerHTML = '<div class="col-span-2 text-xs text-mk-sub">处理中…</div>';
      pendingItems = [];
      await Promise.all(files.map(async (f, idx) => {
        try {
          const img = await autoCropDataURL(await fitImageToDataURL(f, 1200));
          const base = (f.name || ('图纸 ' + (idx + 1))).replace(/\.[^.]+$/, '');
          pendingItems.push({ img, name: base, platform: '', author: '', status: 'unmade' });
        } catch (e) { toast('图片读取失败：' + (f.name || ''), 'error'); }
      }));
      wrappedRender();
    };
    $('#g-save').onclick = () => {
      if (!pendingItems.length) return toast('请上传图纸图片', 'error');
      const t = Date.now();
      pendingItems.forEach((it, i) => {
        const name = (it.name || '').trim() || ('图纸 ' + (i + 1));
        state.gallery.unshift({
          id: 'g' + (t + i).toString(36) + Math.random().toString(36).slice(2, 6),
          name, platform: (it.platform || '').trim(), author: (it.author || '').trim(),
          image: it.img, status: it.status,
          createdAt: t + i
        });
      });
      const n = pendingItems.length;
      pendingItems = [];
      save(); closeModal(); renderGallery($('#view')); toast('已添加 ' + n + ' 张图纸到图库', 'success');
    };
    updateApplyDisabled();
  }
  // 保持比例缩放图片为 data URL（不裁剪），用于图库缩略图
  function fitImageToDataURL(file, maxEdge = 900) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.80));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
      img.src = url;
    });
  }
  // 自动裁切图片四周留白（基于边框背景色采样）
  function autoCropDataURL(dataUrl, opts = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.width, H = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let d;
        try { d = ctx.getImageData(0, 0, W, H).data; }
        catch (e) { return resolve(dataUrl); }
        // 采样边框像素估算背景色
        const samples = [];
        const border = Math.max(4, Math.floor(Math.min(W, H) * 0.03));
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (x < border || x >= W - border || y < border || y >= H - border) {
              const i = (y * W + x) * 4;
              if (d[i + 3] < 128) continue;
              samples.push([d[i], d[i + 1], d[i + 2]]);
            }
          }
        }
        let bg = [255, 255, 255];
        if (samples.length) {
          const buckets = {};
          let bestKey = '', bestCount = 0;
          for (const [r, g, b] of samples) {
            const key = `${r >> 4},${g >> 4},${b >> 4}`;
            buckets[key] = (buckets[key] || 0) + 1;
            if (buckets[key] > bestCount) { bestCount = buckets[key]; bestKey = key; }
          }
          if (bestKey) bg = bestKey.split(',').map(v => parseInt(v, 10) << 4);
        }
        const bgLum = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;
        const threshold = opts.threshold || (bgLum > 0.85 ? 26 : 36);
        const isContent = (i) => {
          if (d[i + 3] < 128) return false;
          const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          return dist > threshold && !(lum > 0.96 && dist < threshold * 1.6);
        };
        const rowHas = (y) => { for (let x = 0; x < W; x++) if (isContent((y * W + x) * 4)) return true; return false; };
        const colHas = (x) => { for (let y = 0; y < H; y++) if (isContent((y * W + x) * 4)) return true; return false; };
        let top = 0, bottom = H - 1, left = 0, right = W - 1;
        while (top < H && !rowHas(top)) top++;
        while (bottom > top && !rowHas(bottom)) bottom--;
        while (left < W && !colHas(left)) left++;
        while (right > left && !colHas(right)) right--;
        if (top >= bottom || left >= right) return resolve(dataUrl);
        const pad = Math.max(4, Math.round(Math.min(W, H) * 0.015));
        left = Math.max(0, left - pad); top = Math.max(0, top - pad);
        right = Math.min(W - 1, right + pad); bottom = Math.min(H - 1, bottom + pad);
        const cw = right - left + 1, ch = bottom - top + 1;
        const out = document.createElement('canvas');
        out.width = cw; out.height = ch;
        out.getContext('2d').drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }
  // 将 data URL 图片重新压缩到指定尺寸/质量（用于回收图库空间）
  function compressDataURL(dataUrl, maxEdge = 1000, quality = 0.80) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }
  // 压缩图库中所有图片，减小 localStorage 占用
  async function compressGalleryImages() {
    const items = state.gallery.filter(g => g.image);
    if (!items.length) return toast('图库中没有图片', 'info');
    const totalBefore = items.reduce((s, g) => s + g.image.length, 0);
    toast('开始压缩图库图片…', 'info', 1500);
    let done = 0;
    for (const g of items) {
      try {
        g.image = await compressDataURL(g.image, 1000, 0.80);
        done++;
      } catch (e) { console.warn('压缩失败', g.id, e); }
    }
    const totalAfter = state.gallery.filter(g => g.image).reduce((s, g) => s + g.image.length, 0);
    save();
    if (currentView === 'gallery') renderGallery($('#view'));
    else if (currentView === 'settings') renderSettings($('#view'));
    toast('已压缩 ' + done + '/' + items.length + ' 张图片，约节省 ' + Math.round((totalBefore - totalAfter) / 1024) + 'KB', 'success', 4000);
  }
  // 放大查看图库图片（支持滚轮缩放 / 双指缩放 / 拖拽平移）
  function openGalleryImageZoom(g) {
    const body = `
      <div id="gzoom-stage" class="relative flex items-center justify-center min-h-[55vh] overflow-hidden select-none" style="touch-action:none;">
        <img id="gzoom-img" src="${g.image}" class="max-w-full max-h-[78vh] rounded-xl shadow-lg select-none" alt="${escapeHtml(g.name)}" style="transform-origin:0 0;">
        <div id="gzoom-info" class="absolute top-2 left-2 text-xs bg-black/55 text-white px-2 py-1 rounded-full pointer-events-none">100%</div>
        <div class="absolute bottom-2 left-2 text-[11px] bg-black/40 text-white px-2 py-1 rounded-full pointer-events-none">滚轮/双指缩放 · 拖拽平移</div>
      </div>`;
    openModal(escapeHtml(g.name), body, { width: 1200 });
    setModalFoot(`<button id="gzoom-reset" class="px-3 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub">重置</button>
      <button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">关闭</button>`);

    const stage = $('#gzoom-stage');
    const img = $('#gzoom-img');
    const info = $('#gzoom-info');
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    let scale = 1, tx = 0, ty = 0;
    const apply = () => {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      info.textContent = Math.round(scale * 100) + '%';
    };
    // 以某屏幕点为锚点缩放：保持该点下的图像内容不动
    function zoomAt(clientX, clientY, factor) {
      const layoutLeft = stage.getBoundingClientRect().left + img.offsetLeft;
      const layoutTop = stage.getBoundingClientRect().top + img.offsetTop;
      const px = clientX - layoutLeft, py = clientY - layoutTop;
      const newScale = clamp(scale * factor, 1, 8);
      if (newScale === scale) return;
      tx = px - (px - tx) * (newScale / scale);
      ty = py - (py - ty) * (newScale / scale);
      scale = newScale;
      if (scale === 1) { tx = 0; ty = 0; }
      apply();
    }
    // 桌面滚轮缩放
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    // 桌面拖拽平移
    let dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    stage.addEventListener('mousedown', (e) => {
      if (scale <= 1) return;
      dragging = true; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy); apply();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    // 移动端双指缩放 + 单指拖拽
    let pinchDist = 0, pinchMidX = 0, pinchMidY = 0;
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchMidX = (a.clientX + b.clientX) / 2; pinchMidY = (a.clientY + b.clientY) / 2;
      } else if (e.touches.length === 1 && scale > 1) {
        dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; stx = tx; sty = ty;
      }
    }, { passive: false });
    stage.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist > 0) zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, dist / pinchDist);
        pinchDist = dist;
        pinchMidX = (a.clientX + b.clientX) / 2; pinchMidY = (a.clientY + b.clientY) / 2;
      } else if (dragging && e.touches.length === 1) {
        tx = stx + (e.touches[0].clientX - sx); ty = sty + (e.touches[0].clientY - sy); apply();
      }
    }, { passive: false });
    stage.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) pinchDist = 0;
      if (e.touches.length === 0) { dragging = false; pinchDist = 0; }
    });
    $('#gzoom-reset').onclick = () => { scale = 1; tx = 0; ty = 0; apply(); };
    apply();
  }

  /* ===================== 16. 设置（色卡映射管理 + 数据 + 视觉AI） ===================== */
  function renderSettings(v) {
    const avatarUrl = getAvatarUrl() || generateDefaultAvatarSvg(getAvatarLetter());
    const emailText = currentUser ? escapeHtml(currentUser.email) : '未登录';
    const galleryCount = state.gallery.filter(g => g.image).length;
    const gallerySize = Math.round(state.gallery.reduce((s, g) => s + (g.image ? g.image.length : 0), 0) / 1024);
    v.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-4">
        <!-- 个人信息 -->
        <section class="mk-card rounded-2xl shadow-soft p-5 lg:col-span-2">
          <h3 class="font-bold mb-4">👤 个人信息</h3>
          <div class="flex flex-row items-start gap-4">
            <div class="relative shrink-0">
              <img id="settings-avatar-preview" src="${avatarUrl}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover bg-white border border-mk-sand shadow-soft">
              <label class="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow cursor-pointer hover:bg-mk-sand text-[10px] border border-mk-sand" title="更换头像">
                📷
                <input id="settings-avatar" type="file" accept="image/*" class="hidden">
              </label>
            </div>
            <div class="flex-1 space-y-3 w-full min-w-0 max-w-md">
              <label class="text-sm block">昵称<input id="settings-nickname" type="text" value="${escapeHtml(state.profile.nickname)}" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" placeholder="怎么称呼你"></label>
              <div class="text-sm text-mk-sub">邮箱：${emailText}</div>
              <div class="flex flex-wrap gap-2">
                <button id="settings-save-profile" type="button" class="px-4 py-2 rounded-xl bg-mk-mint text-mk-ink font-semibold">保存资料</button>
                <button id="settings-change-pass" type="button" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold ${currentUser ? '' : 'opacity-50 cursor-not-allowed'}">🔒 修改密码</button>
              </div>
            </div>
          </div>
        </section>

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

        <!-- 图库图片管理 -->
        <section class="mk-card rounded-2xl shadow-soft p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">🖼️ 图库图片管理</h3>
          <div class="flex flex-wrap items-center gap-3">
            <button id="compress-gallery" class="px-4 py-2 rounded-xl bg-mk-sky text-mk-ink font-semibold">压缩图库图片</button>
            <span class="text-xs text-mk-sub">当前图库 ${galleryCount} 张图片，约 ${gallerySize}KB（过大时会导致保存失败）</span>
          </div>
          <p class="text-xs text-mk-sub mt-2">压缩会将每张图限制在 1000px 内、JPEG 0.80 质量，可显著减小 localStorage 占用。建议上传时即使用此尺寸。</p>
        </section>

        <!-- 账户与云端同步 -->
        <section class="mk-card rounded-2xl shadow-soft p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">☁️ 账户与云端同步</h3>
          ${accountSyncInner('acc')}
        </section>
      </div>`;

    $('#map-add').onclick = openAddMapping;

    wireAuthForm('acc');
    const syncNow = $('#acc-syncnow'); if (syncNow) syncNow.onclick = () => syncPull();
    const syncOut = $('#acc-logout'); if (syncOut) syncOut.onclick = () => doLogout();
    wireAccountToggle('acc', v);
    $$('.map-del').forEach(b => b.onclick = () => {
      state.mappings = state.mappings.filter(m => m.id !== b.dataset.id); save(); renderSettings(v); toast('已删除映射', 'success');
    });
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
    $('#compress-gallery').onclick = compressGalleryImages;

    // 个人信息：头像上传、保存资料、修改密码
    settingsAvatarTemp = state.profile.avatar || '';
    const settingsAvatarInput = $('#settings-avatar');
    const settingsAvatarPreview = $('#settings-avatar-preview');
    if (settingsAvatarInput) settingsAvatarInput.onchange = async () => {
      const f = settingsAvatarInput.files[0];
      if (!f) return;
      try {
        const dataUrl = await resizeImageToDataURL(f);
        settingsAvatarTemp = dataUrl;
        if (settingsAvatarPreview) settingsAvatarPreview.src = dataUrl;
      } catch (e) { toast('头像读取失败', 'error'); }
    };
    const saveProfileBtn = $('#settings-save-profile');
    if (saveProfileBtn) saveProfileBtn.onclick = () => {
      const nick = ($('#settings-nickname') || {}).value || '';
      state.profile.nickname = nick.trim();
      state.profile.avatar = settingsAvatarTemp;
      save();
      renderHeaderUser();
      toast('个人资料已保存', 'success');
    };
    const changePassBtn = $('#settings-change-pass');
    if (changePassBtn) changePassBtn.onclick = () => openChangePasswordModal();
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

  /* ===================== 17.5 拼豆图纸生成器 ===================== */
  // 模块级状态：画布尺寸 / 格子 / 当前工具与颜色 / 模式 / 已上传参考图
  let pCols = 20, pRows = 20;
  let pCells = null;          // pRows×pCols 二维数组，元素为 colorNumber 字符串或 null（空白）
  let pTool = 'pen';          // pen 画笔 | eraser 橡皮 | fill 填充 | picker 取色
  let pColor = null;          // 当前选中 colorNumber
  let pMode = 'blank';        // blank 空白画布 | image 图片转图纸
  let pImage = null;          // 已上传参考图 Image 对象
  let pShowNumbers = true;    // 画布与导出 PNG 上是否在格子上印色号
  let pPaletteShowNumbers = false;  // 色板色块上是否叠加色号文字（独立开关，默认关）
  let pZoom = 1;                  // 画布缩放倍数（1=原始 / 通过滚轮/按钮/双指调整，0.2–6）
  let pImgAspect = null;      // 已上传参考图的宽高比（naturalWidth / naturalHeight），用于锁定纵横比
  let pAspectLock = true;     // 设置列/行时是否锁定纵横比（空白 1:1、图片按原图比例）
  let pLastDetectedColors = 0; // 上次识别时图中检测到的非白主色数 (5-bit 量化后去重), 给 toast 用
  let pPaletteReport = [];     // 上次识别的色彩映射报告: [{pct, r, g, b, hex, beadCode}, ...] (按占比降序)
  let pMaxColors = 0;          // 最多用色数 (0=不限制); 借鉴 pindou-skill 的 max_colors: 超出部分合并到最近主色
  let pOcrMeta = null;         // OCR 模式诊断: {recognized, matchedByOCR, filledByFallback, unmatchedByOCR, model}
  let pImageCrop = null;      // 剪裁区域：{x,y,w,h} 原图像素坐标；null = 不剪裁（整图）
  let pImageCropMode = false; // 是否处于剪裁编辑模式（可拖拽选区）
  let pImageCropDrag = null;  // {handle, startCrop, startX, startY, scale} 拖拽状态
  let pDrawing = false;
  let pInited = false;
  let pHighlight = null;      // 当前在图纸上高亮的色号（点击用料清单项触发，再次点击取消）
  let pName = '';             // 图纸名称，用作导出文件名；保存到配方库时一并写入
  let pUndo = [];              // 撤销栈：每次改图前压入 pCells 深拷贝快照（一次拖动 = 一步）
  let pUndoMax = 60;
  let pPanning = false;        // 正在拖动画布（平移）
  let pSpacePan = false;       // 按住空格临时进入平移模式
  let pMiddlePan = false;      // 鼠标中键按住临时进入平移模式
  let pLastPanX = 0, pLastPanY = 0;
  let pPanX = 0, pPanY = 0;    // 画布平移偏移（CSS transform translate，不依赖容器溢出，任意尺寸都能拖）

  // 真实拼豆板尺寸（Perler 标准 pegboard）：标准板 29×29、小板 14×14、迷你板 6×6
  // 这些才是实物板的固定格数，画布尺寸应贴合它们，而不是 150×150 自由网格
  const PERLER_BOARDS = [
    { key: 'std',   label: '标准板', w: 29, h: 29 },
    { key: 'small', label: '小板',   w: 14, h: 14 },
    { key: 'mini',  label: '迷你板', w: 6,  h: 6  },
  ];
  let pPlanBoard = PERLER_BOARDS[0];   // 板数规划 / 板缝叠加所选用的板型（默认标准板）
  let pShowBoards = false;             // 是否在画布上叠加「板缝」参考线（帮助对齐实物板）

  // 画布分组背景主题：每 5×5 格交替上浅色，帮助数格与分区；颜色都极浅，不干扰豆子色号显示
  // 交替逻辑：(floor(r/5)+floor(c/5))%2 —— 相邻 5×5 区块不同色；none = 纯色无交替
  const GRID_THEMES = [
    { key: 'none',   label: '纯色（无交替）', pair: null },
    { key: 'pb',     label: '粉蓝交替',  pair: ['#ffe6f0', '#dcebff'] },
    { key: 'gg',     label: '浅绿深绿交替', pair: ['#e8f7e6', '#cdeccf'] },
    { key: 'lm',     label: '薰衣草薄荷', pair: ['#efe6ff', '#dcf5ec'] },
    { key: 'ps',     label: '蜜桃天蓝',  pair: ['#ffe9d6', '#d6ecff'] },
    { key: 'yg',     label: '米黄浅灰',  pair: ['#fff6d6', '#eceae6'] },
    { key: 'bg',     label: '蓝灰交替',  pair: ['#e2ecf7', '#eae7e2'] },
  ];
  let pGridTheme = 'none';   // 当前选用的分组背景主题 key
  // 取某格所属 5×5 区块的背景色（无交替或空主题返回 null）
  function gridThemeBg(r, c) {
    const t = GRID_THEMES.find(x => x.key === pGridTheme);
    if (!t || !t.pair) return null;
    return t.pair[(Math.floor(r / 5) + Math.floor(c / 5)) % 2];
  }

  // 一键把画布尺寸设为真实板尺寸（同步更新两处输入控件的值）
  function setBoardSize(n) {
    pCols = n; pRows = n;
    const ic = $('#p-cols'), ir = $('#p-rows'), iic = $('#p-icols'), iir = $('#p-irows');
    if (ic) ic.value = n; if (ir) ir.value = n;
    if (iic) iic.value = n; if (iir) iir.value = n;
  }

  function initPatternCells(cols, rows) {
    pCells = Array.from({ length: rows }, () => new Array(cols).fill(null));
  }
  function ensurePatternCells() {
    if (!pCells || pCells.length !== pRows || (pCells[0] && pCells[0].length !== pCols)) initPatternCells(pCols, pRows);
  }
  // 仅匹配用户仓库里已有的色卡（保证“只能选用自己拥有的色卡”）
  function nearestOwnedColor(r, g, b) {
    let best = null, bestD = Infinity;
    for (const bead of state.beads) {
      const [br, bg, bb] = hexToRgb(bead.hex);
      const d = colorDist(r, g, b, br, bg, bb);
      if (d < bestD) { bestD = d; best = bead; }
    }
    return best ? best.colorNumber : null;
  }
  // sRGB → CIE-Lab (D65)，用于感知一致的色差比较（红/橙/黄/棕等相近色不再混淆）
  function rgbToLab(R, G, B) {
    let r = R / 255, g = G / 255, b = B / 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
    const fx = f(X / Xn), fy = f(Y / Yn), fz = f(Z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  // 感知色差：CIEDE2000（对标 skimage.color.deltaE_ciede2000）。
  // 借鉴 pindou-skill 的核心方法论：颜色聚类必须在 Lab 空间、用 CIEDE2000 ΔE，
  // 不能用 RGB/CIE76 欧氏距离（会把暖棕+暗影合成中性灰再映射到橄榄绿）。
  function labDeltaE(a, b) {
    const kL = 1, kC = 1, kH = 1;
    const L1 = a[0], a1 = a[1], b1 = a[2];
    const L2 = b[0], a2 = b[1], b2 = b[2];
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cbar = (C1 + C2) / 2;
    const Cbar7 = Cbar * Cbar * Cbar * Cbar * Cbar * Cbar * Cbar; // Cbar^7
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7 = 6103515625
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);
    const rad = x => { let v = x * 180 / Math.PI; if (v < 0) v += 360; return v; };
    const h1 = (b1 === 0 && a1p === 0) ? 0 : rad(Math.atan2(b1, a1p));
    const h2 = (b2 === 0 && a2p === 0) ? 0 : rad(Math.atan2(b2, a2p));
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp;
    if (C1p * C2p === 0) dhp = 0;
    else { dhp = h2 - h1; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360); // sin(Δh/2)
    const Lbarp = (L1 + L2) / 2, Cbarp = (C1p + C2p) / 2;
    let hpbar;
    if (C1p * C2p === 0) hpbar = h1 + h2;
    else { const diff = Math.abs(h1 - h2); hpbar = diff > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2; }
    const T = 1 - 0.17 * Math.cos((hpbar - 30) * Math.PI / 180)
      + 0.24 * Math.cos(2 * hpbar * Math.PI / 180)
      + 0.32 * Math.cos((3 * hpbar + 6) * Math.PI / 180)
      - 0.20 * Math.cos((4 * hpbar - 63) * Math.PI / 180);
    const SL = 1 + (0.015 * (Lbarp - 50) * (Lbarp - 50)) / Math.sqrt(20 + (Lbarp - 50) * (Lbarp - 50));
    const SC = 1 + 0.045 * Cbarp;
    const SH = 1 + 0.015 * Cbarp * T;
    const dL = dLp / (kL * SL), dC = dCp / (kC * SC), dH = dHp / (kH * SH);
    return Math.sqrt(dL * dL + dC * dC + dH * dH);
  }
  // 用感知色差(CIELAB ΔE)找最近的自有色卡；beadLabs 为预计算的所有色卡 Lab
  function nearestOwnedColorLab(r, g, b, beadLabs) {
    const lab = rgbToLab(r, g, b);
    let best = null, bestD = Infinity, blackD = Infinity;
    for (let i = 0; i < state.beads.length; i++) {
      const code = state.beads[i].colorNumber;
      const d = labDeltaE(lab, beadLabs[i]);
      if (code === 'H7') { blackD = d; continue; }  // 记录黑色距离为兜底
      if (d < bestD) { bestD = d; best = state.beads[i]; }
    }
    if (!best) return null;
    const mx = Math.max(r, g, b);
    // 近黑(max<45)保留黑；暗而不黑(max>=45)且最近非黑比黑更近 → 改取最近非黑豆，削减"黑色块偏多"
    if (bestD < blackD && mx >= 45) return best.colorNumber;
    return 'H7';
  }

  function renderPattern(v) {
    ensurePatternCells();
    if (!pColor && state.beads.length) pColor = state.beads[0].colorNumber;
    pDrawing = false; pPanX = 0; pPanY = 0;   // 重建画布视图时复位平移偏移
    const toolBtns = [
      ['pen', '🖌️ 画笔'], ['eraser', '🧽 橡皮'], ['fill', '🪣 填充'], ['picker', '💉 取色']
    ].map(([t, l]) =>
      `<button class="ptool px-3 py-1.5 rounded-xl text-sm font-semibold ${pTool === t ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub'}" data-tool="${t}">${l}</button>`
    ).join('');

    v.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-xl font-bold">🎨 拼豆图纸生成器</h2>
        <span class="hidden sm:inline text-sm text-mk-sub">绘图 → 用料统计 → 消耗库存，一条龙</span>
      </div>

      <div class="flex gap-2 mb-4 flex-wrap">
        <button class="pmode-btn px-3 py-1.5 rounded-xl text-sm font-semibold ${pMode === 'blank' ? 'bg-mk-rose text-white shadow-soft' : 'bg-white/70 text-mk-sub'}" data-mode="blank">① 空白画布自由绘制</button>
        <button class="pmode-btn px-3 py-1.5 rounded-xl text-sm font-semibold ${pMode === 'image' ? 'bg-mk-rose text-white shadow-soft' : 'bg-white/70 text-mk-sub'}" data-mode="image">② 图片转拼豆图纸</button>
      </div>

      <div class="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <!-- 左：控制 + 色板 -->
        <div class="space-y-4">
          <!-- 空白画布控制 -->
          <section class="mk-card rounded-2xl shadow-soft p-4 ${pMode === 'blank' ? '' : 'hidden'}">
            <h3 class="font-bold mb-3">📐 画布尺寸</h3>
            <p class="text-[11px] text-mk-sub mb-2">想要贴合真实拼豆板？一键新建标准尺寸画布：</p>
            <div class="flex flex-wrap gap-2 mb-3">
              <button class="preset-board px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="29">🟦 标准板 29×29</button>
              <button class="preset-board px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="14">🟩 小板 14×14</button>
              <button class="preset-board px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="6">🟪 迷你板 6×6</button>
            </div>
            <div class="flex items-end gap-2">
              <label class="text-sm flex-1">列（宽）<input id="p-cols" type="number" min="2" max="150" value="${pCols}" class="w-full mt-1 px-2 py-1.5 rounded-xl bg-white/70 border border-mk-sand"></label>
              <label class="text-sm flex-1">行（高）<input id="p-rows" type="number" min="2" max="150" value="${pRows}" class="w-full mt-1 px-2 py-1.5 rounded-xl bg-white/70 border border-mk-sand"></label>
            </div>
            <label class="flex items-center gap-2 text-xs mt-2 text-mk-sub select-none">
              <input id="p-aspect-blank" type="checkbox" ${pAspectLock ? 'checked' : ''} class="accent-mk-rose"> 🔒 锁定纵横比（1:1，改一项另一项自动同步）
            </label>
            <button id="p-new" class="w-full mt-3 px-3 py-2 rounded-xl bg-mk-sky text-mk-ink text-sm font-semibold">🆕 新建画布</button>
            <h3 class="font-bold mb-2 mt-4">🛠️ 工具</h3>
            <div class="flex flex-wrap gap-2">${toolBtns}</div>
            <button id="p-clear" class="w-full mt-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-400 text-sm font-semibold">🗑️ 清空画布</button>
          </section>

          <!-- 图片转图纸控制 -->
          <section class="mk-card rounded-2xl shadow-soft p-4 ${pMode === 'image' ? '' : 'hidden'}">
            <h3 class="font-bold mb-3">🖼️ 上传参考图</h3>
            <div id="p-drop" class="border-2 border-dashed border-mk-sand rounded-xl p-4 text-center text-sm text-mk-sub cursor-pointer hover:bg-white/50">
              点击或拖拽图片到此处<br>（PNG / JPG）
              <input id="p-file" type="file" accept="image/*" class="hidden">
            </div>
            ${pImage ? `
              <div id="p-img-wrap" class="mt-3 relative inline-block w-full">
                <img id="p-img-preview" src="${pImage.src}" class="w-full rounded-xl border border-mk-sand block cursor-zoom-in" title="点击放大预览与剪裁" />
                <div id="p-img-mask" class="absolute inset-0 rounded-xl overflow-hidden ${pImageCrop ? '' : 'hidden'}"></div>
              </div>` : `
              <div id="p-img-wrap" class="mt-3 relative inline-block w-full hidden">
                <img id="p-img-preview" class="w-full rounded-xl border border-mk-sand block" />
                <div id="p-img-mask" class="absolute inset-0 rounded-xl overflow-hidden hidden"></div>
              </div>`}
            ${pImage ? `<div class="flex items-center justify-between mt-2 text-[11px] text-mk-sub"><span>📌 浅色区=识别的图案</span><button id="p-img-zoom" class="px-2 py-0.5 rounded-lg bg-mk-rose text-white font-semibold" title="在大窗口里预览并剪裁（操作更方便）">🔍 点图放大</button></div>` : ''}
            <div class="flex flex-wrap gap-2 mt-2 ${pImage ? '' : 'hidden'}" id="p-crop-bar">
              <button id="p-crop-toggle" class="text-xs px-2.5 py-1.5 rounded-xl ${pImageCropMode ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="${pImageCropMode ? '保存当前选区并退出编辑' : '进入剪裁编辑模式（4 角 + 4 边 + 内部拖动）'}">${pImageCropMode ? '✓ 完成剪裁' : '✂️ 剪裁'}</button>
              <button id="p-crop-reset" class="text-xs px-2.5 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" title="选区重置为整张图">↺ 重置选区</button>
              <button id="p-crop-clear" class="text-xs px-2.5 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub ${pImageCrop ? '' : 'hidden'}" title="清除剪裁（识别整张图）">✕ 不剪裁</button>
              <span class="text-[11px] text-mk-sub self-center">${pImageCropMode ? '💡 拖 4 角/4 边缩放，拖中间移动' : (pImageCrop ? '📌 已剪裁（深色区不识别）' : '📌 默认识别整张图')}</span>
            </div>
            <h3 class="font-bold mb-2 mt-4">🎯 目标网格</h3>
            <div class="flex flex-wrap gap-2 mb-2">
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="29">标准 29</button>
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="14">小板 14</button>
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="6">迷你 6</button>
            </div>
            <div class="flex items-end gap-2">
              <label class="text-sm flex-1">列（宽）<input id="p-icols" type="number" min="2" max="150" value="${pCols}" class="w-full mt-1 px-2 py-1.5 rounded-xl bg-white/70 border border-mk-sand"></label>
              <label class="text-sm flex-1">行（高）<input id="p-irows" type="number" min="2" max="150" value="${pRows}" class="w-full mt-1 px-2 py-1.5 rounded-xl bg-white/70 border border-mk-sand"></label>
            </div>
            <label class="flex items-center gap-2 text-xs mt-2 text-mk-sub select-none">
              <input id="p-aspect-image" type="checkbox" ${pAspectLock ? 'checked' : ''} class="accent-mk-rose"> 🔒 锁定纵横比${pImgAspect ? `（原图 ${pImgAspect.toFixed(2)}:1，改一项另一项自动按比例）` : '（上传图后按原图比例，先传图更准）'}
            </label>
            <label class="flex items-center gap-2 text-xs mt-2 text-mk-sub select-none">
              <span>🎨 最多色数</span>
              <input id="p-maxcolors" type="number" min="0" max="60" value="${pMaxColors || 0}" class="w-16 px-2 py-1 rounded-lg bg-white/70 border border-mk-sand">
              <span class="text-[10px]">（0=不限制；超出自动合并到最近主色）</span>
            </label>
            <div class="mt-3 mb-1 text-xs text-mk-sub font-semibold">🔠 识别模式</div>
            <div class="flex flex-wrap gap-1 text-[11px]">
              <button class="pmode-recog px-2.5 py-1.5 rounded-xl border ${!state.settings.gridOCREnabled ? 'bg-mk-rose text-white border-mk-rose' : 'bg-white/70 text-mk-sub border-mk-sand'}" data-mode="pixel" title="按像素聚类（默认；适合彩色照片/手绘）">🎨 像素法</button>
              <button class="pmode-recog px-2.5 py-1.5 rounded-xl border ${state.settings.gridOCREnabled ? 'bg-mk-rose text-white border-mk-rose' : 'bg-white/70 text-mk-sub border-mk-sand'}" data-mode="gridOCR" title="调云端视觉读每格字符（适合「已有图纸」、反解析；走 /api/legend-vision 代理）">🔠 格子 OCR</button>
            </div>
            <p class="text-[10px] text-mk-sub mt-1">${state.settings.gridOCREnabled ? '🧠 OCR 模式：模型读每格中央色号字符，反解析图纸最准确；OCR 失败格子自动用像素法兜底' : '🎨 像素法：按 cell 内主色聚类，适合照片/插画。已有图纸请切到「格子 OCR」'}</p>
            <button id="p-generate" class="w-full mt-3 px-3 py-2 rounded-xl bg-mk-rose text-white text-sm font-semibold shadow-soft">✨ 生成拼豆图纸</button>
            <p class="text-[11px] text-mk-sub mt-2">生成后自动按色值匹配你仓库里已有的色卡并填入画布，可继续手动微调。</p>
          </section>

          <!-- 色板（仅拥有色卡） -->
          <section class="mk-card rounded-2xl shadow-soft p-4">
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-bold">🎨 色板（仅你拥有的色卡）</h3>
              <button id="p-pal-numbers" class="text-xs px-2.5 py-1 rounded-lg ${pPaletteShowNumbers ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="切换色板色块上是否叠加色号">🔢 色号</button>
            </div>
            <p class="text-[11px] text-mk-sub mb-2">点击选色，再在画布上涂色。</p>
            <input id="p-search" type="text" placeholder="搜索色号 / 名称" class="w-full px-3 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-sm mb-2">
            <div id="p-current" class="text-sm mb-2"></div>
            <div id="p-swatches" class="grid gap-1.5 max-h-64 overflow-auto pr-1 ${pPaletteShowNumbers ? 'grid-cols-5 sm:grid-cols-6' : 'grid-cols-7 sm:grid-cols-8'}"></div>
          </section>
        </div>

        <!-- 右：画布 + 用料清单 -->
        <div class="space-y-4">
          <section class="mk-card rounded-2xl shadow-soft p-4">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 class="font-bold">🧩 画布（${pCols} × ${pRows}）</h3>
              <div class="flex items-center gap-2 flex-wrap">
                <button id="p-numbers" class="text-xs px-2.5 py-1 rounded-lg ${pShowNumbers ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="切换格子上是否显示色号">🔢 显示色号</button>
                <button id="p-undo" class="text-xs px-2.5 py-1 rounded-lg bg-white/70 border border-mk-sand text-mk-sub disabled:opacity-40 disabled:cursor-not-allowed" title="撤销上一步（Ctrl/⌘+Z）" disabled>↩ 撤销</button>
                <div class="flex items-center gap-1 bg-white/70 border border-mk-sand rounded-lg px-1 py-0.5 text-xs">
                  <button id="p-zoom-out" class="w-6 h-6 rounded-md hover:bg-mk-sand/40" title="缩小">➖</button>
                  <span id="p-zoom-label" class="px-1 min-w-[44px] text-center font-semibold">${Math.round(pZoom * 100)}%</span>
                  <button id="p-zoom-in" class="w-6 h-6 rounded-md hover:bg-mk-sand/40" title="放大">➕</button>
                  <button id="p-zoom-reset" class="w-6 h-6 rounded-md hover:bg-mk-sand/40" title="重置 100%">🔄</button>
                </div>
                <button id="p-pan-toggle" class="text-xs px-2.5 py-1 rounded-lg ${pTool === 'pan' ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="开启后可在画布上拖动平移（也可按住空格 / 鼠标中键）">✋ 拖动画布</button>
                <button id="p-board-plan" class="text-xs px-2.5 py-1 rounded-lg bg-white/70 border border-mk-sand text-mk-sub" title="计算此图案需要多少块真实拼豆板、怎么拼接">📐 板数规划</button>
                <button id="p-board-overlay" class="text-xs px-2.5 py-1 rounded-lg ${pShowBoards ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="在画布上叠加板缝参考线，帮助对齐实物板">🧱 板缝</button>
                <button id="p-grid-theme" class="text-xs px-2.5 py-1 rounded-lg bg-white/70 border border-mk-sand text-mk-sub" title="选择画布 5×5 分组的背景色（交替浅色，便于数格分区）">🎨 分组底色</button>
                <span class="text-xs text-mk-sub">${pMode === 'blank' ? '画笔/橡皮拖动涂色；点「✋ 拖动画布」或按住空格可平移' : '点「✋ 拖动画布」或按住空格 / 中键，平移生成的图纸'}</span>
              </div>
            </div>
            <p class="text-[11px] text-mk-sub mb-2">💡 选「✋ 拖动画布」工具，或按住 <b class="text-mk-ink">空格</b> / 鼠标 <b class="text-mk-ink">中键</b>，可平移画布；滚轮缩放只作用于画布，不影响下方用料清单。若浏览器已被意外缩放，按 <b class="text-mk-ink">Ctrl+0</b>（Mac：⌘+0）复位。点「📐 板数规划」可算此图需几块真实板、怎么拼。</p>
            <div id="p-canvas-wrap" class="overflow-hidden bg-mk-cream rounded-xl p-2 relative" style="max-height: 75vh;touch-action:none;">
              <canvas id="p-canvas" class="rounded-md" style="image-rendering:pixelated;touch-action:none;"></canvas>
              <div id="p-cell-preview" class="absolute bottom-1 right-1 text-[11px] bg-black/60 text-white px-2 py-1 rounded-lg pointer-events-none hidden whitespace-nowrap leading-tight" style="backdrop-filter:blur(4px);"></div>
            </div>
          </section>

          <section class="mk-card rounded-2xl shadow-soft p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold">📋 用料清单</h3>
              <span id="p-total" class="text-sm text-mk-sub"></span>
            </div>
            <div class="flex items-center gap-2 flex-wrap mb-2">
              <label class="text-xs text-mk-sub flex items-center gap-1">合并阈值
                <input id="p-merge-th" type="number" min="1" max="200" value="40" class="w-14 px-1.5 py-1 rounded-lg bg-white/70 border border-mk-sand">
              </label>
              <button id="p-merge" class="text-xs px-2.5 py-1.5 rounded-lg bg-mk-lav text-mk-ink font-semibold">🧬 合并相近色</button>
              <button id="p-hl-off" class="text-xs px-2.5 py-1.5 rounded-lg bg-white/70 border border-mk-sand text-mk-sub ${pHighlight ? '' : 'hidden'}">✕ 取消高亮</button>
            </div>
            <p id="p-hl-tip" class="text-[11px] text-mk-sub mb-2 ${pHighlight ? '' : 'hidden'}">🔍 正在高亮：<b>${pHighlight || ''}</b>（点图纸或此按钮取消）</p>
            <div id="p-bom"></div>
            <details id="p-palette" class="mt-3 ${pPaletteReport.length ? '' : 'hidden'}">
              <summary class="cursor-pointer text-xs text-mk-sub hover:text-mk-ink select-none">📊 色彩映射（识别图色 → 色卡号，点开展开）</summary>
              <div id="p-palette-body" class="mt-2 p-2 rounded-lg bg-white/40 max-h-48 overflow-auto"></div>
            </details>
            <label class="text-sm block mt-3">图纸名称（用于导出文件名）
              <input id="p-name" type="text" placeholder="留空则自动命名" value="${escapeHtml(pName)}" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand">
            </label>
            <div class="flex flex-wrap gap-2 mt-3">
              <button id="p-png" class="flex-1 min-w-[40%] text-center px-3 py-2 rounded-xl bg-mk-mint text-mk-ink text-sm font-semibold">🖼️ 导出 PNG 预览图</button>
              <button id="p-csv" class="flex-1 min-w-[40%] text-center px-3 py-2 rounded-xl bg-mk-sky text-mk-ink text-sm font-semibold">📄 导出用料 CSV</button>
              <button id="p-copy" class="flex-1 min-w-[40%] text-center px-3 py-2 rounded-xl bg-mk-lav text-mk-ink text-sm font-semibold">📋 复制文本</button>
              <button id="p-save" class="flex-1 min-w-[40%] text-center px-3 py-2 rounded-xl bg-mk-lemon text-mk-ink text-sm font-semibold">💾 保存到配方库</button>
              <button id="p-consume" class="flex-1 min-w-[100%] px-3 py-2 rounded-xl bg-mk-rose text-white text-sm font-semibold shadow-soft">✅ 进入确认面板 · 扣减库存</button>
            </div>
          </section>
        </div>
      </div>`;

    // 模式切换
    $$('.pmode-btn').forEach(b => b.onclick = () => { pMode = b.dataset.mode; if (pMode === 'blank') pTool = 'pen'; renderPattern(v); });
    // 识别模式切换（像素法 vs 格子 OCR）
    $$('.pmode-recog').forEach(b => b.onclick = () => {
      state.settings.gridOCREnabled = b.dataset.mode === 'gridOCR';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
      renderPattern(v);
      toast(state.settings.gridOCREnabled ? '🔠 已切换到「格子 OCR」模式：识别模式将从「每格中央印的色号字符」反解析图纸' : '🎨 已切换到「像素法」模式（默认）：按 cell 颜色聚类', 'info', 2800);
    });
    // 锁定纵横比 checkbox
    const lockBlank = $('#p-aspect-blank');
    const lockImage = $('#p-aspect-image');
    if (lockBlank) lockBlank.onchange = () => { pAspectLock = lockBlank.checked; };
    if (lockImage) lockImage.onchange = () => { pAspectLock = lockImage.checked; };
    // 纵横比联动：改 cols 同步改 rows，反之亦然
    let _autoRegenTimer = null;
    const bindLock = (colsEl, rowsEl, mode) => {
      if (!colsEl || !rowsEl) return;
      const sync = (srcKey) => {
        if (!pAspectLock) return;
        const cv = parseInt(colsEl.value, 10);
        const rv = parseInt(rowsEl.value, 10);
        if (!isFinite(cv) || !isFinite(rv)) return;
        const clamp = (v) => Math.min(150, Math.max(2, v));
        if (srcKey === 'cols') {
          let newRows;
          if (mode === 'image' && pImgAspect) newRows = Math.round(cv / pImgAspect);
          else                                newRows = cv;                  // 空白模式 1:1
          rowsEl.value = clamp(newRows);
        } else {
          let newCols;
          if (mode === 'image' && pImgAspect) newCols = Math.round(rv * pImgAspect);
          else                                newCols = rv;
          colsEl.value = clamp(newCols);
        }
        // 「input 改变 → 立刻重绘画布 title/格子（即便未生成也按新维度显示）」+ image 模式下
        // 若已上传图，debounce 自动重算图纸，避免「改了网格忘记按生成」看到一片空白的踩坑
        const newColsVal = parseInt(colsEl.value, 10);
        const newRowsVal = parseInt(rowsEl.value, 10);
        if (!isFinite(newColsVal) || !isFinite(newRowsVal)) return;
        const dimsChanged = (newColsVal !== pCols || newRowsVal !== pRows);
        pCols = newColsVal; pRows = newRowsVal;
        ensurePatternCells();      // 维度变了就重置 pCells（不丢老 cells 内容，等 generate 再覆盖）
        patternRenderCanvas();     // 立刻按新维度重画空白画布 + 更新 title
        const titles = document.querySelectorAll('h3');
        for (const t of titles) { if (/🧩\s*画布/.test(t.textContent)) t.textContent = `🧩 画布（${pCols} × ${pRows}）`; }
        // 自动重算（仅 image 模式 + 已上传图 + 维度确实变了）
        if (dimsChanged && mode === 'image' && pImage && state.beads && state.beads.length) {
          clearTimeout(_autoRegenTimer);
          _autoRegenTimer = setTimeout(() => patternRunGenerate({ fromAuto: true }), 280);
        }
      };
      colsEl.addEventListener('input', () => sync('cols'));
      rowsEl.addEventListener('input', () => sync('rows'));
    };
    bindLock($('#p-cols'),  $('#p-rows'),  'blank');
    bindLock($('#p-icols'), $('#p-irows'), 'image');
    // 画布拖动切换（始终可见，不受空白/图片模式影响）
    const panToggle = $('#p-pan-toggle');
    const syncPanToggle = () => {
      if (!panToggle) return;
      const on = pTool === 'pan';
      panToggle.classList.toggle('bg-mk-rose', on);
      panToggle.classList.toggle('text-white', on);
      panToggle.classList.toggle('bg-white/70', !on);
      panToggle.classList.toggle('text-mk-sub', !on);
      const cv = $('#p-canvas'); if (cv) cv.style.cursor = on ? 'grab' : '';
    };
    if (panToggle) panToggle.onclick = () => { pTool = (pTool === 'pan') ? 'pen' : 'pan'; syncPanToggle(); };
    $('#p-generate').onclick = () => patternRunGenerate({ fromAuto: false });
    // 真实板尺寸预设按钮（空白 / 图片两处共用）：一键把画布尺寸设为真实板
    $$('.preset-board').forEach(b => b.onclick = () => {
      const n = parseInt(b.dataset.preset, 10);
      setBoardSize(n);
      if (pMode === 'blank') { initPatternCells(n, n); pHighlight = null; pUndo = []; pPanX = 0; pPanY = 0; renderPattern(v); }
    });
    // 板数规划弹窗
    const boardPlanBtn = $('#p-board-plan');
    if (boardPlanBtn) boardPlanBtn.onclick = openBoardPlan;
    // 板缝参考线开关
    const boardOverlay = $('#p-board-overlay');
    const syncBoardOverlay = () => {
      if (!boardOverlay) return;
      const on = pShowBoards;
      boardOverlay.classList.toggle('bg-mk-rose', on);
      boardOverlay.classList.toggle('text-white', on);
      boardOverlay.classList.toggle('bg-white/70', !on);
      boardOverlay.classList.toggle('text-mk-sub', !on);
    };
    if (boardOverlay) boardOverlay.onclick = () => { pShowBoards = !pShowBoards; syncBoardOverlay(); patternRenderCanvas(); };
    // 分组背景主题选择弹窗
    const gridThemeBtn = $('#p-grid-theme');
    if (gridThemeBtn) gridThemeBtn.onclick = openGridThemePicker;
    // 图片剪裁：进入/完成编辑、重置、清除
    const cropToggle = $('#p-crop-toggle');
    if (cropToggle) cropToggle.onclick = () => {
      if (!pImage) return toast('请先上传参考图', 'warn');
      pImageCropMode = !pImageCropMode;
      if (!pImageCrop) pImageCrop = { x: 0, y: 0, w: pImage.naturalWidth, h: pImage.naturalHeight };
      renderImageCropMask();
      renderPattern(v);
    };
    const cropReset = $('#p-crop-reset');
    if (cropReset) cropReset.onclick = () => {
      if (!pImage) return;
      pImageCrop = { x: 0, y: 0, w: pImage.naturalWidth, h: pImage.naturalHeight };
      pImageCropMode = true;        // 重置后留在编辑模式方便继续调
      renderImageCropMask();
      renderPattern(v);
    };
    const cropClear = $('#p-crop-clear');
    if (cropClear) cropClear.onclick = () => {
      pImageCrop = null;
      pImageCropMode = false;
      renderImageCropMask();
      renderPattern(v);
    };
    // 工具切换
    $$('.ptool').forEach(b => b.onclick = () => {
      pTool = b.dataset.tool;
      $$('.ptool').forEach(x => x.classList.remove('bg-mk-rose', 'text-white'));
      b.classList.add('bg-mk-rose', 'text-white');
      syncPanToggle();
    });
    // 新建画布
    $('#p-new').onclick = () => {
      let c = parseInt($('#p-cols').value, 10) || 20, r = parseInt($('#p-rows').value, 10) || 20;
      c = Math.min(150, Math.max(2, c)); r = Math.min(150, Math.max(2, r));
      pCols = c; pRows = r; initPatternCells(c, r); pHighlight = null; pUndo = []; pPanX = 0; pPanY = 0;
      renderPattern(v);
    };
    $('#p-clear').onclick = () => {
      if (confirm('清空整个画布？')) { patternPushUndo(); initPatternCells(pCols, pRows); pHighlight = null; patternRenderCanvas(); patternRenderBOM(); }
    };
    // 图片上传（点击 + 拖拽）
    const fileInput = $('#p-file');
    if (fileInput) fileInput.onchange = e => { if (e.target.files[0]) patternLoadImage(e.target.files[0]); };
    const dz = $('#p-drop');
    if (dz) {
      dz.onclick = () => fileInput && fileInput.click();
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('ring-2', 'ring-mk-rose'); };
      dz.ondragleave = () => dz.classList.remove('ring-2', 'ring-mk-rose');
      dz.ondrop = e => {
        e.preventDefault(); dz.classList.remove('ring-2', 'ring-mk-rose');
        if (e.dataTransfer.files[0]) patternLoadImage(e.dataTransfer.files[0]);
      };
    }
    $('#p-generate').onclick = () => patternRunGenerate({ fromAuto: false });
    // 真实板尺寸预设按钮（空白 / 图片两处共用）：一键把画布尺寸设为真实板
    // 点图放大弹窗（更宽敞的剪裁空间）
    const imgZoom = $('#p-img-zoom');
    const imgPreview = $('#p-img-preview');
    if (imgZoom) imgZoom.onclick = openImageZoomModal;
    if (imgPreview) imgPreview.onclick = openImageZoomModal;
    // 色板搜索
    $('#p-search').oninput = patternRenderPalette;
    // 色号显隐
    $('#p-numbers').onclick = () => { pShowNumbers = !pShowNumbers; renderPattern(v); };
    // 色板色块叠加色号（独立开关，仅刷新色板，不影响画布）
    $('#p-pal-numbers').onclick = () => { pPaletteShowNumbers = !pPaletteShowNumbers; renderPattern(v); };
    // 画布缩放按钮
    $('#p-zoom-in').onclick     = () => patternSetZoom(pZoom * 1.25);
    $('#p-zoom-out').onclick    = () => patternSetZoom(pZoom / 1.25);
    $('#p-zoom-reset').onclick  = () => patternSetZoom(1);
    $('#p-undo').onclick = patternUndo;
    // 导出 / 保存 / 确认
    $('#p-png').onclick = patternExportPNG;
    $('#p-csv').onclick = patternExportCSV;
    $('#p-copy').onclick = patternCopyText;
    $('#p-save').onclick = patternSaveRecipe;
    $('#p-consume').onclick = patternConsume;
    // 图纸名称（导出文件名）
    $('#p-name').oninput = () => { pName = $('#p-name').value; };
    // 合并相近色（按 RGB 距离阈值）
    $('#p-merge').onclick = () => {
      const th = Math.max(1, Math.min(200, parseInt($('#p-merge-th').value, 10) || 40));
      patternMergeSimilar(th);
    };
    // 取消高亮
    $('#p-hl-off').onclick = () => {
      pHighlight = null; patternRenderBOM(); patternRenderCanvas();
      const off = $('#p-hl-off'), tip = $('#p-hl-tip');
      if (off) off.classList.add('hidden');
      if (tip) tip.classList.add('hidden');
    };

    patternRenderCanvas();
    patternRenderPalette();
    patternRenderCurrentColor();
    patternRenderBOM();
    patternAttachCanvas();
    renderImageCropMask();   // wrap 被 v.innerHTML 重置后，重新画 SVG 选区
  }

  function patternCellPx() {
    const maxDim = Math.max(pCols, pRows, 1);
    // 80×80 给 18px 仍能勉强显示色号；20×20 给 40px 大格子方便编辑；再乘 zoom（用户调整的缩放倍数）
    return Math.max(4, Math.min(60, Math.floor(800 / maxDim)) * pZoom);
  }
  // 按色值亮度决定文字颜色（深底用白字，浅底用深字）
  function patternLuminance(hex) {
    const [r, g, b] = hexToRgb(hex || '#ffffff');
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  function patternRenderCanvas() {
    const cv = $('#p-canvas'); if (!cv) return;
    const cp = patternCellPx();
    cv.width = pCols * cp; cv.height = pRows * cp;
    // 桌面端取消 max-width 让放大的画布撑出外层滚动区；移动端限制为 100% 使画布自适应屏宽不溢出
    cv.style.maxWidth = (window.innerWidth < 1024) ? '100%' : 'none';
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        const num = pCells[r][c];
        const bead = num ? beadByNumber(num) : null;
        const hex = bead ? bead.hex : null;
        if (hex) {
          ctx.fillStyle = hex;            // 有豆子的格子显示豆色
          ctx.fillRect(c * cp, r * cp, cp, cp);
        } else {
          const bg = gridThemeBg(r, c);   // 空白格按 5×5 分组上交替浅底
          ctx.fillStyle = bg || '#FFFDF9';
          ctx.fillRect(c * cp, r * cp, cp, cp);
        }
        // 高亮模式下，把非目标色淡出，突出当前选中的色号
        if (pHighlight && num && num !== pHighlight) { ctx.fillStyle = 'rgba(248,246,242,0.55)'; ctx.fillRect(c * cp, r * cp, cp, cp); }
        if (pShowNumbers && num && hex) {
          ctx.fillStyle = patternLuminance(hex) > 150 ? '#3a2a1f' : '#ffffff';
          // 字号随色号长度自动缩放，保证 4 位色号（如 H221）在小格子里也完整显示
          const fs = Math.max(7, Math.min(Math.floor(cp * 0.52), Math.floor(cp * 1.6 / num.length)));
          ctx.font = `bold ${fs}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
          ctx.fillText(num, c * cp + cp / 2, r * cp + cp / 2 + 0.5);
        }
      }
    }
    // 细网格线
    ctx.strokeStyle = 'rgba(150,120,100,0.22)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= pCols; c++) { ctx.beginPath(); ctx.moveTo(c * cp + 0.5, 0); ctx.lineTo(c * cp + 0.5, cv.height); ctx.stroke(); }
    for (let r = 0; r <= pRows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cp + 0.5); ctx.lineTo(cv.width, r * cp + 0.5); ctx.stroke(); }
    // 每 5 格画一条粗线（分组边线），方便按区块数数
    ctx.strokeStyle = 'rgba(60,40,30,0.55)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c <= pCols; c += 5) { ctx.beginPath(); ctx.moveTo(c * cp + 0.5, 0); ctx.lineTo(c * cp + 0.5, cv.height); ctx.stroke(); }
    for (let r = 0; r <= pRows; r += 5) { ctx.beginPath(); ctx.moveTo(0, r * cp + 0.5); ctx.lineTo(cv.width, r * cp + 0.5); ctx.stroke(); }
    // 真实板缝参考线（叠加在网格上，帮助用户把图纸对齐到实物拼豆板）
    if (pShowBoards) {
      const bw = pPlanBoard.w, bh = pPlanBoard.h;
      ctx.strokeStyle = 'rgba(214,40,90,0.9)';
      ctx.lineWidth = Math.max(2, cp * 0.14);
      for (let c = bw; c < pCols; c += bw) { ctx.beginPath(); ctx.moveTo(c * cp + 0.5, 0); ctx.lineTo(c * cp + 0.5, cv.height); ctx.stroke(); }
      for (let r = bh; r < pRows; r += bh) { ctx.beginPath(); ctx.moveTo(0, r * cp + 0.5); ctx.lineTo(cv.width, r * cp + 0.5); ctx.stroke(); }
    }
    // 高亮：给当前选中色号的格子描粗边（按底色明暗选黑/白描边，保证可见）
    if (pHighlight) {
      const lw = Math.max(2, cp * 0.16);
      for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
        const num = pCells[r][c];
        if (num === pHighlight) {
          const hx = (beadByNumber(num) || {}).hex || '#fff';
          ctx.strokeStyle = patternLuminance(hx) > 140 ? '#111' : '#fff';
          ctx.lineWidth = lw;
          ctx.strokeRect(c * cp + lw / 2, r * cp + lw / 2, cp - lw, cp - lw);
        }
      }
    }
    patternApplyPan();   // 重绘后保持画布平移偏移
  }
  // 应用画布平移偏移（CSS transform，不依赖容器溢出，任意尺寸都能拖）
  function patternApplyPan() {
    const cv = $('#p-canvas'); if (!cv) return;
    cv.style.transform = `translate(${pPanX}px, ${pPanY}px)`;
    cv.style.transformOrigin = '0 0';
  }
  // hover 诊断: 显示当前 cell 对应的原图坐标段 + 色号 / 主色
  function updateCellPreview(cell) {
    const tip = $('#p-cell-preview'); if (!tip) return;
    if (!cell) { tip.classList.add('hidden'); return; }
    const { r, c } = cell;
    // 当前 cell 对应的原图坐标段 (按 pImageCrop + pCols/pRows 等比例切分)
    const cropW = pImageCrop ? pImageCrop.w : (pImage ? pImage.naturalWidth : 0);
    const cropH = pImageCrop ? pImageCrop.h : (pImage ? pImage.naturalHeight : 0);
    let imgX0 = 0, imgY0 = 0, imgX1 = 0, imgY1 = 0;
    if (cropW && cropH) {
      const cx = (pImageCrop ? pImageCrop.x : 0), cy = (pImageCrop ? pImageCrop.y : 0);
      imgX0 = (cx + (c * cropW) / pCols) | 0;
      imgY0 = (cy + (r * cropH) / pRows) | 0;
      imgX1 = (cx + ((c + 1) * cropW) / pCols) | 0;
      imgY1 = (cy + ((r + 1) * cropH) / pRows) | 0;
    }
    const num = (pCells[r] || [])[c];
    const bead = num ? beadByNumber(num) : null;
    const beadLabel = bead ? `${bead.colorNumber} ${bead.colorName || ''}`.trim() : (num ? `? ${num}` : '空');
    const sw = bead ? bead.hex : null;
    const swatch = sw ? `■` : '□';
    tip.innerHTML = `${swatch} (${r + 1}, ${c + 1}) → 原图 [${imgX0},${imgY0} – ${imgX1},${imgY1}] · ${beadLabel}`;
    tip.classList.remove('hidden');
  }
  function patternAttachCanvas() {
    const cv = $('#p-canvas'); if (!cv) return;
    const wrap = $('#p-canvas-wrap');
    if (!pInited) {
      document.addEventListener('mouseup', () => { pDrawing = false; pPanning = false; pMiddlePan = false; pImageCropDrag = null; const c = $('#p-canvas'); if (c) c.style.cursor = ''; });
      document.addEventListener('keydown', (e) => {
        const t = e.target;
        const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
          if (inField) return;                 // 输入框内保留原生撤销
          if (!$('#p-canvas')) return;
          e.preventDefault(); patternUndo();
          return;
        }
        // 拦截浏览器整页缩放快捷键（Ctrl/Cmd + =/+/-/0），避免「用料清单跟着缩放」
        // 注意：这里不再检查 inField —— 焦点在输入框时也必须拦，否则按 Ctrl+= 会把整页（含 BOM）放大
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
          if (!$('#p-canvas')) return;
          e.preventDefault();
          return;
        }
        if (e.key === ' ' && !inField) { pSpacePan = true; const c = $('#p-canvas'); if (c) c.style.cursor = 'grab'; }
      });
      document.addEventListener('keyup', (e) => {
        if (e.key === ' ') { pSpacePan = false; const c = $('#p-canvas'); if (c) c.style.cursor = ''; }
      });
      // 阻止整页被 Ctrl/Cmd + 滚轮 / 双指捏合放大（仅图纸页生效），避免「用料清单跟着缩放」
      // 同时挂到 window + document，capture 阶段触发，并 stopImmediatePropagation 防止被其它监听器绕过
      const blockZoom = (e) => {
        if ((e.ctrlKey || e.metaKey) && $('#p-canvas')) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
      };
      window.addEventListener('wheel', blockZoom, { passive: false, capture: true });
      document.addEventListener('wheel', blockZoom, { passive: false, capture: true });
      window.addEventListener('gesturestart', blockZoom, { passive: false });
      document.addEventListener('gesturestart', blockZoom, { passive: false });
      // 剪裁拖拽过程：mousemove 在手柄启动后更新选区
      document.addEventListener('mousemove', (e) => { if (pImageCropDrag) applyCropDrag(e); });
      pInited = true;
    }
    const getCell = (e) => {
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (cv.width / rect.width);
      const y = (e.clientY - rect.top) * (cv.height / rect.height);
      const cp = patternCellPx();
      const c = Math.floor(x / cp), r = Math.floor(y / cp);
      if (r < 0 || c < 0 || r >= pRows || c >= pCols) return null;
      return { r, c };
    };
    const panMode = () => pTool === 'pan' || pSpacePan || pMiddlePan;
    const apply = (cell) => {
      if (!cell) return;
      const { r, c } = cell;
      if (pTool === 'pen') pCells[r][c] = pColor;
      else if (pTool === 'eraser') pCells[r][c] = null;
      else if (pTool === 'fill') { patternPushUndo(); patternFloodFill(r, c, pColor); }
      else if (pTool === 'picker') {
        const n = pCells[r][c];
        if (n) { pColor = n; patternRenderPalette(); patternRenderCurrentColor(); }
      }
      patternRenderCanvas(); patternRenderBOM();
    };
    // 单指 / 鼠标
    cv.onmousedown = (e) => {
      if (e.button === 1) {                    // 鼠标中键 → 临时平移画布（任意工具下都能拖）
        e.preventDefault();
        pMiddlePan = true;
        pPanning = true; pLastPanX = e.clientX; pLastPanY = e.clientY; cv.style.cursor = 'grabbing';
        return;
      }
      if (e.button !== 0) return;
      if (panMode()) { pPanning = true; pLastPanX = e.clientX; pLastPanY = e.clientY; cv.style.cursor = 'grabbing'; return; }
      pDrawing = true;
      if (pTool === 'pen' || pTool === 'eraser') patternPushUndo();   // 一次拖动 = 一步撤销
      apply(getCell(e));
    };
    // 悬浮提示：在 pan / 空格 / 中键可平移时显示 grab 手型，让用户知道这里可以拖
    cv.onmouseenter = () => { if (panMode()) cv.style.cursor = 'grab'; };
    cv.onmouseleave = () => { cv.style.cursor = ''; const tip = $('#p-cell-preview'); if (tip) tip.classList.add('hidden'); };
    cv.onmousemove = (e) => {
      if (pPanning && panMode()) {
        pPanX += (e.clientX - pLastPanX);
        pPanY += (e.clientY - pLastPanY);
        pLastPanX = e.clientX; pLastPanY = e.clientY;
        patternApplyPan();
        return;
      }
      if (pDrawing && (pTool === 'pen' || pTool === 'eraser')) apply(getCell(e));
      // hover 诊断: 显示当前 cell 对应的原图坐标段 + 色号 / 主色
      updateCellPreview(getCell(e));
    };
    cv.ontouchstart = (e) => {
      if (e.touches.length >= 2) { pDrawing = false; pPanning = false; return; }
      e.preventDefault();
      if (panMode()) { pPanning = true; pLastPanX = e.touches[0].clientX; pLastPanY = e.touches[0].clientY; return; }
      pDrawing = true;
      if (pTool === 'pen' || pTool === 'eraser') patternPushUndo();
      apply(getCell(e.touches[0]));
    };
    cv.ontouchmove = (e) => {
      if (e.touches.length >= 2) return;
      e.preventDefault();
      if (pPanning && panMode()) {
        pPanX += (e.touches[0].clientX - pLastPanX);
        pPanY += (e.touches[0].clientY - pLastPanY);
        pLastPanX = e.touches[0].clientX; pLastPanY = e.touches[0].clientY;
        patternApplyPan();
        return;
      }
      if (pDrawing && (pTool === 'pen' || pTool === 'eraser')) apply(getCell(e.touches[0]));
    };
    cv.ontouchend = (e) => { if (e.touches.length === 0) { pDrawing = false; pPanning = false; cv.style.cursor = ''; } };

    // ===== 滚轮缩放（电脑端）=====
    cv.onwheel = (e) => {
      e.preventDefault();                              // 阻止页面整体滚动
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.12 : 1 / 1.12;     // 向上滚=放大，向下滚=缩小
      patternSetZoom(pZoom * factor, { anchorX: e.clientX, anchorY: e.clientY });
    };
    // ===== 双指 pinch 缩放（移动端）=====
    const pinchState = { active: false, startDist: 0, startZoom: 1 };
    const pinchDist = () => {
      const t = cv.touches; if (t.length < 2) return 0;
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    };
    cv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchState.active = true;
        pinchState.startDist = pinchDist();
        pinchState.startZoom = pZoom;
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      if (!pinchState.active || e.touches.length < 2) return;
      e.preventDefault();
      const d = pinchDist();
      if (!d || !pinchState.startDist) return;
      const factor = d / pinchState.startDist;
      patternSetZoom(pinchState.startZoom * factor);
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) pinchState.active = false;
    });
  }
  // 设置缩放 + 刷新（带"以光标/触摸点为锚"的体验，让光标下的格子尽量不动）
  function patternSetZoom(next, anchor) {
    const z = Math.max(0.2, Math.min(6, next));
    const cv = $('#p-canvas'); const wrap = $('#p-canvas-wrap');
    if (cv && wrap && anchor && z !== pZoom) {
      // 锚点相对画布布局坐标（transform 平移后），缩放后让该点仍停在光标下
      const wr = wrap.getBoundingClientRect();
      const localX = anchor.anchorX - wr.left - pPanX;
      const localY = anchor.anchorY - wr.top - pPanY;
      const factor = z / pZoom;                 // 新分辨率 / 旧分辨率
      pPanX -= localX * (factor - 1);
      pPanY -= localY * (factor - 1);
    }
    patternRenderZoomed(z);   // 设置 pZoom、重绘画布（内部 patternApplyPan 应用新偏移）
  }
  function patternRenderZoomed(z) {
    pZoom = z;
    const lbl = $('#p-zoom-label'); if (lbl) lbl.textContent = Math.round(pZoom * 100) + '%';
    patternRenderCanvas();
  }
  function patternFloodFill(r, c, newColor) {
    const target = pCells[r][c];
    if (target === newColor) return;
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      if (cr < 0 || cc < 0 || cr >= pRows || cc >= pCols) continue;
      if (pCells[cr][cc] !== target) continue;
      pCells[cr][cc] = newColor;
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
  }
  // 撤销栈：每次改图前压入 pCells 深拷贝快照
  function patternSnapshot() { return pCells.map(row => row.slice()); }
  function patternPushUndo() {
    pUndo.push(patternSnapshot());
    if (pUndo.length > pUndoMax) pUndo.shift();
    const b = $('#p-undo'); if (b) b.disabled = false;
  }
  function patternUndo() {
    if (!pUndo.length) return toast('没有可撤销的操作了', 'warn');
    pCells = pUndo.pop();
    patternRenderCanvas(); patternRenderBOM();
    const b = $('#p-undo'); if (b && !pUndo.length) b.disabled = true;
  }
  // 从图纸中删除某色号（所有该色格子置空），返回删除数量
  function patternDeleteColor(num) {
    if (!num) return 0;
    let cnt = 0;
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      if (pCells[r][c] === num) { pCells[r][c] = null; cnt++; }
    }
    if (pHighlight === num) pHighlight = null;
    return cnt;
  }
  function patternDeleteColorConfirm(num) {
    if (!num) return;
    const bead = beadByNumber(num);
    if (!confirm(`从图纸中删除所有「${num}」${bead ? '（' + bead.colorName + '）' : ''}？此操作可撤销。`)) return;
    patternPushUndo();
    const cnt = patternDeleteColor(num);
    patternRenderBOM(); patternRenderCanvas();
    if (pHighlight === num) {
      const off = $('#p-hl-off'), tip = $('#p-hl-tip');
      if (off) off.classList.add('hidden');
      if (tip) tip.classList.add('hidden');
    }
    toast(`已删除 ${cnt} 颗 ${num}`, 'success');
  }
  function patternBOM() {
    const counts = {};
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      const n = pCells[r][c]; if (n) counts[n] = (counts[n] || 0) + 1;
    }
    return Object.keys(counts).map(num => {
      const bead = beadByNumber(num);
      return { colorNumber: num, colorName: bead ? bead.colorName : '', hex: bead ? bead.hex : '#ccc', qty: counts[num], stock: bead ? bead.stock : 0 };
    }).sort((a, b) => b.qty - a.qty);
  }
  // 胶囊样式色卡统计：色号标在胶囊上方，数量标在胶囊下方，胶囊只显本色（一眼看清，文字不挤）
  // 文件名安全化：去掉非法字符、连空格转下划线、限长
  function patternSafeName(s) {
    return (s || '').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60) || '拼豆图纸';
  }
  // 把图纸中某色号全部替换为另一个色号（可并入已存在的色）
  function patternReplaceColor(oldNum, newNum) {
    if (!oldNum || !newNum || oldNum === newNum) return;
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      if (pCells[r][c] === oldNum) pCells[r][c] = newNum;
    }
    if (pHighlight === oldNum) pHighlight = newNum;
  }
  // 相近色号合并：按 RGB 距离阈值，把较少用的相近色并入较多用的相近色
  function patternMergeSimilar(threshold) {
    const used = patternBOM();
    if (used.length < 2) return toast('颜色太少，无需合并', 'warn');
    const byNum = {}; used.forEach(x => byNum[x.colorNumber] = x);
    const order = used.slice().sort((a, b) => b.qty - a.qty).map(x => x.colorNumber); // 数量多者优先当锚点
    const removed = new Set();
    let merged = 0;
    patternPushUndo();
    for (const anchor of order) {
      if (removed.has(anchor)) continue;
      let best = null, bestD = Infinity;
      for (const other of order) {
        if (other === anchor || removed.has(other)) continue;
        const [ar, ag, ab] = hexToRgb(byNum[anchor].hex);
        const [or, og, ob] = hexToRgb(byNum[other].hex);
        const d = colorDist(ar, ag, ab, or, og, ob);
        if (d < bestD) { bestD = d; best = other; }
      }
      if (best && bestD <= threshold) {
        patternReplaceColor(best, anchor);
        removed.add(best);
        merged++;
      }
    }
    patternRenderBOM(); patternRenderCanvas();
    if (merged) toast(`已合并 ${merged} 组相近色`, 'success');
    else toast(`阈值 ${threshold} 内没有可合并的相近色`, 'warn');
  }
  // 替换色号弹窗：从你拥有的色卡里选目标色
  function openReplaceModal(oldNum) {
    const opts = state.beads.filter(b => b.colorNumber !== oldNum)
      .map(b => `<option value="${escapeHtml(b.colorNumber)}">${escapeHtml(b.colorNumber)} ${escapeHtml(b.colorName || '')}</option>`).join('');
    const body = `<p class="text-sm text-mk-sub mb-2">将图纸中所有 <b class="text-mk-ink">${escapeHtml(oldNum)}</b> 替换为：</p>
      <select id="p-repl-sel" class="w-full px-3 py-2 rounded-xl bg-white/70 border border-mk-sand">${opts}</select>`;
    openModal('替换色号', body, {});
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">取消</button>
      <button id="p-repl-ok" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold">确认替换</button>`);
    const sel = $('#p-repl-sel');
    $('#p-repl-ok').onclick = () => {
      const newNum = sel ? sel.value : null;
      if (!newNum) return closeModal();
      patternPushUndo();
      patternReplaceColor(oldNum, newNum);
      closeModal();
      patternRenderBOM(); patternRenderCanvas();
      toast(`已将 ${oldNum} → ${newNum}`, 'success');
    };
  }
  function patternRenderBOM() {
    const el = $('#p-bom'); if (!el) return;
    const bom = patternBOM();
    const total = bom.reduce((s, x) => s + x.qty, 0);
    const totEl = $('#p-total'); if (totEl) totEl.textContent = `共 ${bom.length} 色 · ${total} 颗`;
    if (!bom.length) {
      el.innerHTML = '<p class="text-sm text-mk-sub">还没有涂色——先用左侧色板选色，在画布上点击/拖动涂色，或上传图片生成图纸。</p>';
      return;
    }
    el.innerHTML = `<div class="flex flex-wrap gap-x-3 gap-y-4">
      ${bom.map(x => {
        const lack = Math.max(0, x.qty - x.stock);
        const light = patternLuminance(x.hex) > 150;
        const active = pHighlight === x.colorNumber;
        return `<div class="bom-item flex flex-col items-center text-center cursor-pointer select-none ${active ? 'ring-2 ring-mk-rose rounded-xl p-1 -m-1' : ''}"
                  data-num="${escapeHtml(x.colorNumber)}"
                  title="点击：在图纸上高亮此色 · 需 ${x.qty} / 现有 ${x.stock} / ${lack ? '缺 ' + lack : '充足'}">
          <div class="relative w-full rounded-xl shadow-soft flex items-center justify-center ${lack ? 'ring-2 ring-rose-500' : ''}"
               style="height:44px; background:${x.hex}">
            <span class="text-[11px] font-bold ${light ? 'text-gray-900' : 'text-white'}">${escapeHtml(x.colorNumber)}</span>
            <button class="bom-replace absolute -top-2 -right-2 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-white border border-mk-sand text-mk-sub shadow hover:bg-mk-rose hover:text-white" data-num="${escapeHtml(x.colorNumber)}" title="替换为其它色号">⇄</button>
            <button class="bom-del absolute -bottom-2 -right-2 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-white border border-mk-sand text-mk-sub shadow hover:bg-rose-500 hover:text-white" data-num="${escapeHtml(x.colorNumber)}" title="从图纸删除此色">✕</button>
          </div>
          <div class="text-base font-extrabold text-mk-ink mt-1 leading-none">${x.qty}</div>
        </div>`;
      }).join('')}
    </div>
    <p class="text-sm text-mk-sub mt-3">所需豆子数量：<b class="text-mk-ink font-bold">${total}</b></p>
    <p class="text-sm text-mk-sub">图纸尺寸：<b class="text-mk-ink font-bold">${pCols} × ${pRows}</b>（共 ${pCols * pRows} 格 · 已用 ${total} 格）</p>`;
    // 整项点击 = 高亮；替换按钮 = 打开替换弹窗（阻止冒泡，避免误触发高亮）
    $$('#p-bom .bom-item').forEach(it => {
      it.onclick = () => {
        const num = it.dataset.num;
        pHighlight = (pHighlight === num) ? null : num;
        patternRenderBOM(); patternRenderCanvas();
        const off = $('#p-hl-off'), tip = $('#p-hl-tip');
        if (off) off.classList.toggle('hidden', !pHighlight);
        if (tip) { tip.classList.toggle('hidden', !pHighlight); const b = tip.querySelector('b'); if (b) b.textContent = pHighlight || ''; }
      };
    });
    $$('#p-bom .bom-replace').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); openReplaceModal(b.dataset.num); };
    });
    $$('#p-bom .bom-del').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); patternDeleteColorConfirm(b.dataset.num); };
    });
  }
  // 计算图案实际占用范围（最小/最大行列），用于板数规划
  function patternUsedBBox() {
    let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1, used = 0;
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      if (pCells[r][c]) {
        used++;
        if (r < minR) minR = r; if (c < minC) minC = c;
        if (r > maxR) maxR = r; if (c > maxC) maxC = c;
      }
    }
    if (!used) return { used: 0, w: pCols, h: pRows, minC: 0, minR: 0, empty: true };
    return { used, w: maxC - minC + 1, h: maxR - minR + 1, minC, minR, empty: false };
  }
  // 板数规划弹窗：按所选真实板型，算此图案要几块板、怎么拼
  function openBoardPlan() {
    const renderPlan = () => {
      const bb = patternUsedBBox();
      const bw = pPlanBoard.w, bh = pPlanBoard.h;
      const colsBoards = Math.ceil(bb.w / bw);
      const rowsBoards = Math.ceil(bb.h / bh);
      const total = colsBoards * rowsBoards;
      let layout;
      if (colsBoards === 1 && rowsBoards === 1) {
        layout = `✅ <b>一张「${pPlanBoard.label} (${bw}×${bh})」即可装下</b>，无需拼接。`;
      } else {
        const seamV = []; for (let c = bw; c < bb.w; c += bw) seamV.push(bb.minC + c);
        const seamH = []; for (let r = bh; r < bb.h; r += bh) seamH.push(bb.minR + r);
        layout = `需 <b>${colsBoards} 横 × ${rowsBoards} 纵 = <span class="text-mk-rose font-bold">${total} 块</span>「${pPlanBoard.label} (${bw}×${bh})」</b>。` +
          `<br>横向拼接 ${colsBoards} 块（覆盖 ${colsBoards * bw} 列），纵向 ${rowsBoards} 块（覆盖 ${rowsBoards * bh} 行）。` +
          (seamV.length ? `<br>竖向板缝落在第 <b>${seamV.join('、')}</b> 列` : '') +
          (seamH.length ? `；横向板缝落在第 <b>${seamH.join('、')}</b> 行` : '') + '。';
      }
      const boardBtns = PERLER_BOARDS.map(b =>
        `<button class="plan-board px-3 py-1.5 rounded-xl text-sm font-semibold ${b.key === pPlanBoard.key ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" data-key="${b.key}">${b.label} ${b.w}×${b.h}</button>`
      ).join('');
      const body = `
        <p class="text-sm text-mk-sub mb-2">图案实际占用：<b class="text-mk-ink">${bb.w} × ${bb.h}</b> 格（${bb.used} 颗豆${bb.empty ? ' —— 当前画布全空，按整张画布尺寸估算' : ''}）。</p>
        <p class="text-xs text-mk-sub mb-1">选择板型：</p>
        <div class="flex flex-wrap gap-2 mb-3">${boardBtns}</div>
        <div class="mk-card rounded-xl p-3 bg-mk-cream text-sm leading-relaxed text-mk-ink">${layout}</div>
        <p class="text-[11px] text-mk-sub mt-3 leading-relaxed">📌 实物拼接建议：按板缝把图纸切成 ${total} 块区域，每块在对应板上单独摆豆；摆好后用耐热胶带整片翻面、再熨烫定型。标准板之间可互锁对齐，拼大图时记得留 1 格板边对齐。</p>
        ${pShowBoards ? '' : '<p class="text-[11px] text-mk-sub mt-2">💡 点画布工具栏「🧱 板缝」可在图纸上直接显示板缝参考线。</p>'}
      `;
      openModal('📐 板数规划', body, { wide: true });
      setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">关闭</button>`);
      $$('.plan-board').forEach(b => b.onclick = () => {
        pPlanBoard = PERLER_BOARDS.find(x => x.key === b.dataset.key) || pPlanBoard;
        renderPlan();
      });
    };
    renderPlan();
  }
  // 分组背景主题选择弹窗：每 5×5 分组交替浅色 / 纯色无交替
  function openGridThemePicker() {
    const swatch = (pair) => pair
      ? `<span style="display:inline-block;width:100%;height:14px;border-radius:4px;background:linear-gradient(90deg,${pair[0]} 0 50%,${pair[1]} 50% 100%)"></span>`
      : `<span style="display:inline-block;width:100%;height:14px;border-radius:4px;background:#FFFDF9;border:1px solid #e6ddd2"></span>`;
    const body = `
      <p class="text-[11px] text-mk-sub mb-3">每 5×5 格为一分组，相邻分组交替上浅色，方便数格与分区；颜色极浅，不干扰豆子色号显示。导出 PNG 同样生效。</p>
      <div class="grid grid-cols-2 gap-2">
        ${GRID_THEMES.map(t => `
          <button class="theme-pick flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${t.key === pGridTheme ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" data-key="${t.key}">
            <span class="inline-block w-10 shrink-0">${swatch(t.pair)}</span>${t.label}
          </button>`).join('')}
      </div>`;
    openModal('🎨 分组底色', body, { wide: false });
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">关闭</button>`);
    $$('.theme-pick').forEach(b => b.onclick = () => {
      pGridTheme = b.dataset.key;
      $$('.theme-pick').forEach(x => { const on = x.dataset.key === pGridTheme; x.classList.toggle('bg-mk-rose', on); x.classList.toggle('text-white', on); x.classList.toggle('bg-white/70', !on); x.classList.toggle('text-mk-sub', !on); });
      patternRenderCanvas();
    });
  }
  function patternRenderPalette() {
    const wrap = $('#p-swatches'); if (!wrap) return;
    const q = ($('#p-search').value || '').trim().toLowerCase();
    const beads = state.beads.filter(b => !q || b.colorNumber.toLowerCase().includes(q) || (b.colorName || '').toLowerCase().includes(q));
    const showN = pPaletteShowNumbers;
    // 开启色号时格子稍大、列数减少，避免 4 位色号（如 H221）被截
    const sizeCls = showN ? 'h-9 text-[10px]' : 'h-7 text-[9px]';
    wrap.innerHTML = beads.map(b => {
      const light = patternLuminance(b.hex) > 150;
      const labelCls = light ? 'text-gray-900' : 'text-white';
      const label = showN
        ? `<span class="px-0.5 leading-none text-center break-all ${labelCls} font-bold tracking-tight" style="text-shadow:0 0 2px rgba(0,0,0,0.25)">${escapeHtml(b.colorNumber)}</span>`
        : '';
      return `<button class="pw-swatch ${sizeCls} rounded-md ${b.colorNumber === pColor ? 'ring-2 ring-mk-rose ring-offset-1' : ''} ${showN ? 'flex items-center justify-center' : ''}"
                title="${b.colorNumber} ${escapeHtml(b.colorName)}（库存 ${b.stock}）"
                data-num="${b.colorNumber}"
                style="background:${b.hex}">${label}</button>`;
    }).join('');
    $$('#p-swatches .pw-swatch').forEach(btn => btn.onclick = () => {
      pColor = btn.dataset.num; patternRenderPalette(); patternRenderCurrentColor();
    });
  }
  function patternRenderCurrentColor() {
    const el = $('#p-current'); if (!el) return;
    const bead = pColor ? beadByNumber(pColor) : null;
    el.innerHTML = `<span class="w-7 h-7 rounded-lg swatch inline-block align-middle mr-2" style="background:${bead ? bead.hex : '#fff'}"></span>${bead ? (bead.colorNumber + ' ' + escapeHtml(bead.colorName)) : '未选择（请点色板选色）'}`;
  }
  function patternLoadImage(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        pImage = img;
        // 记录原图纵横比，供"目标网格 锁定纵横比"使用
        if (img.naturalWidth && img.naturalHeight) {
          pImgAspect = img.naturalWidth / img.naturalHeight;
        }
        // 默认选区 = 整张图（用户可再点「✂️ 剪裁」调整）
        pImageCrop = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
        pImageCropMode = false;
        // 重渲染整个图纸页：让 #p-img-wrap 切到"pImage 真"分支、移除 hidden；并在末尾 renderImageCropMask 重画选区层
        const v = $('#view');
        if (v) renderPattern(v);
        // 同步刷新图片模式 checkbox 提示文案（强制 re-render 让 pImgAspect 后的文案显示出来）
        toast('图片已加载' + (pImgAspect ? `（原图 ${img.naturalWidth}×${img.naturalHeight}，比例 ${pImgAspect.toFixed(2)}:1）` : '') + '，设置网格后点「生成拼豆图纸」', 'success');
      };
      img.onerror = () => toast('图片加载失败', 'error');
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 在大窗口里预览图片 + 剪裁（不受左侧卡片宽度限制，操作更方便）
  function openImageZoomModal() {
    if (!pImage) return;
    // 进入 modal 时自动开启剪裁编辑模式（关闭大图后退出）
    const wasMode = pImageCropMode; pImageCropMode = true;
    // 关键修复: 之前图片 object-fit:contain + SVG preserveAspectRatio="none" → 图片按比例居中
    // 显示（含 padding 留白），SVG 强制拉伸到 wrap 尺寸。两者显示比例不一致，用户拖到图片
    // 中"X 点"时,实际 SVG 坐标算出的原图像素 ≠ 用户视觉位置 → 选区跟视觉框位置错位.
    // 现在 wrap 尺寸 = 图片 contain 后的实际显示尺寸（与原图比例一致），img 强制填满，SVG 也
    // 按 xMidYMid meet 填满,两者比例完全一致,选区位置 = 用户视觉位置.
    const naturalW = pImage.naturalWidth || 1440;
    const naturalH = pImage.naturalHeight || 886;
    const naturalAR = naturalW / naturalH;
    const maxW = Math.max(320, Math.min(window.innerWidth - 100, 1400, naturalW));
    const maxH = Math.max(240, Math.min(window.innerHeight * 0.62, 640, naturalH));
    // 按原图比例取"能放进 (maxW, maxH) 的最大矩形"
    let wrapW, wrapH;
    if (naturalAR >= maxW / maxH) { wrapW = maxW; wrapH = Math.round(maxW / naturalAR); }
    else { wrapH = maxH; wrapW = Math.round(maxH * naturalAR); }
    // 此时 wrapW:H = naturalW:H，img 和 SVG 都填满 wrap（object-fit:fill + xMidYMid meet），
    // 任意点 (x,y) → 原图坐标 = (x * naturalW / wrapW, y * naturalH / wrapH) 线性一致.
    const cropInfoText = pImageCrop ? ((pImageCrop.w | 0) + ' × ' + (pImageCrop.h | 0)) : '未设置';
    openModal('🔍 放大预览与剪裁', `
      <div class="flex flex-col items-center">
        <div class="flex flex-wrap items-center justify-center gap-2 mb-3 text-xs w-full">
          <button id="zoom-crop-mode" class="px-3 py-1.5 rounded-xl ${pImageCropMode ? 'bg-mk-rose text-white' : 'bg-white/70 border border-mk-sand text-mk-sub'}" title="切换编辑模式（可拖 8 手柄 + 内部移动）">${pImageCropMode ? '✓ 完成剪裁' : '✂️ 继续剪裁'}</button>
          <button id="zoom-crop-reset" class="px-3 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" title="选区重置为整张图\">↺ 重置选区</button>
          <button id="zoom-crop-clear" class="px-3 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" title="清除剪裁（识别整张图）">✕ 不剪裁</button>
          <span id="zoom-crop-info" class="text-mk-sub bg-white/70 px-2 py-1 rounded-lg border border-mk-sand">📐 选区: <span id="zoom-crop-info-text">${cropInfoText}</span></span>
          <span class="text-mk-sub">💡 拖 4 角/4 边缩放，拖中间移动选区</span>
        </div>
        <div id="zoom-img-wrap" class="relative bg-mk-cream rounded-xl border border-mk-sand overflow-hidden" style="width:${wrapW}px;height:${wrapH}px;">
          <img id="zoom-img" src="${pImage.src}" class="absolute inset-0 block w-full h-full" style="object-fit:fill;" />
          <div id="zoom-img-mask" class="absolute inset-0"></div>
        </div>
      </div>
    `, { wide: true, width: Math.min(window.innerWidth - 40, wrapW + 80) }, () => {
      // 关闭时：把 modal 里的 crop 状态写回 pImageCrop / pImageCropMode，刷新主视图
      pImageCropMode = false;
      renderImageCropMask();
      const v = $('#view'); if (v) renderPattern(v);
    });
    // wrap 尺寸已显式固定 → SVG 比例与图片天然一致，直接渲染选区层即可
    renderZoomCropMask();
    updateZoomCropInfo();
  }
  // 在大图 modal 里画选区（与主视图共用 pImageCrop 状态）
  function renderZoomCropMask() {
    const mask = $('#zoom-img-mask'); if (!mask || !pImage || !pImageCrop) return;
    const W = pImage.naturalWidth, H = pImage.naturalHeight;
    const c = pImageCrop;
    const min = Math.max(W, H) * 0.02;
    c.w = Math.max(min, Math.min(c.w, W - c.x));
    c.h = Math.max(min, Math.min(c.h, H - c.y));
    c.x = Math.max(0, Math.min(c.x, W - c.w));
    c.y = Math.max(0, Math.min(c.y, H - c.h));
    const HANDLE = Math.max(10, Math.min(W, H) * 0.018);
    const stroke = Math.max(2, Math.min(W, H) * 0.004);
    const path = `M0,0 L${W},0 L${W},${H} L0,${H} Z M${c.x},${c.y} L${c.x + c.w},${c.y} L${c.x + c.w},${c.y + c.h} L${c.x},${c.y + c.h} Z`;
    const interactive = pImageCropMode ? `
      <rect class="zoom-crop-move" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="transparent" pointer-events="all" style="cursor:move" />
      <rect class="zoom-crop-h" data-handle="nw" x="${c.x - HANDLE / 2}" y="${c.y - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nwse-resize" />
      <rect class="zoom-crop-h" data-handle="ne" x="${c.x + c.w - HANDLE / 2}" y="${c.y - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nesw-resize" />
      <rect class="zoom-crop-h" data-handle="sw" x="${c.x - HANDLE / 2}" y="${c.y + c.h - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nesw-resize" />
      <rect class="zoom-crop-h" data-handle="se" x="${c.x + c.w - HANDLE / 2}" y="${c.y + c.h - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nwse-resize" />
      <rect class="zoom-crop-h" data-handle="n"  x="${c.x + c.w / 2 - HANDLE / 2}" y="${c.y - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ns-resize" />
      <rect class="zoom-crop-h" data-handle="s"  x="${c.x + c.w / 2 - HANDLE / 2}" y="${c.y + c.h - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ns-resize" />
      <rect class="zoom-crop-h" data-handle="w"  x="${c.x - HANDLE / 2}" y="${c.y + c.h / 2 - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ew-resize" />
      <rect class="zoom-crop-h" data-handle="e"  x="${c.x + c.w - HANDLE / 2}" y="${c.y + c.h / 2 - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ew-resize" />
    ` : '';
    mask.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="w-full h-full block">
      <path d="${path}" fill="#0009" fill-rule="evenodd" pointer-events="none" />
      <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#fff" stroke-width="${stroke}" pointer-events="none" />
      ${interactive}
    </svg>`;
    // 绑定 8 手柄 + 内部移动（document 级监听）
    if (pImageCropMode) {
      const handleMousedown = (e, handle) => {
        e.preventDefault(); e.stopPropagation();
        const svg = $('#zoom-img-mask svg'); if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const sx = rect.width / (pImage.naturalWidth || 1);
        const sy = rect.height / (pImage.naturalHeight || 1);
        pImageCropDrag = { handle, startCrop: { ...pImageCrop }, startX: e.clientX, startY: e.clientY, sx, sy };
      };
      $$('.zoom-crop-h').forEach(h => h.onmousedown = (e) => handleMousedown(e, h.dataset.handle));
      $$('.zoom-crop-move').forEach(m => m.onmousedown = (e) => handleMousedown(e, 'move'));
    }
    // 绑定三个 modal 内按钮
    const modeBtn = $('#zoom-crop-mode'); if (modeBtn) modeBtn.onclick = () => { pImageCropMode = !pImageCropMode; renderZoomCropMask(); updateZoomCropInfo(); };
    const resetBtn = $('#zoom-crop-reset'); if (resetBtn) resetBtn.onclick = () => { pImageCrop = { x: 0, y: 0, w: pImage.naturalWidth, h: pImage.naturalHeight }; renderZoomCropMask(); renderImageCropMask(); updateZoomCropInfo(); };
    const clearBtn = $('#zoom-crop-clear'); if (clearBtn) clearBtn.onclick = () => { pImageCrop = null; pImageCropMode = false; renderZoomCropMask(); renderImageCropMask(); updateZoomCropInfo(); };
    // 初次渲染后填充一次信息
    updateZoomCropInfo();
  }
  // 按当前 pImageCrop / pImageCropMode 渲染 SVG 选区层；剪裁编辑模式下绑定 8 手柄 + 内部移动
  function renderImageCropMask() {
    const mask = $('#p-img-mask'); if (!mask) return;
    const img = $('#p-img-preview');
    const W = pImage && img ? (pImage.naturalWidth || img.naturalWidth) : 0;
    const H = pImage && img ? (pImage.naturalHeight || img.naturalHeight) : 0;
    if (!pImage || !W || !H || !pImageCrop) { mask.innerHTML = ''; mask.classList.add('hidden'); return; }
    mask.classList.remove('hidden');
    const c = pImageCrop;
    const min = Math.max(W, H) * 0.02;   // 选区最小边长（保持基本可识别）
    c.w = Math.max(min, Math.min(c.w, W - c.x));
    c.h = Math.max(min, Math.min(c.h, H - c.y));
    c.x = Math.max(0, Math.min(c.x, W - c.w));
    c.y = Math.max(0, Math.min(c.y, H - c.h));
    const cx = c.x, cy = c.y, cw = c.w, ch = c.h;
    // 手柄半径按原图比例缩放；SVG 自身会被拉伸到 wrap 尺寸
    const HANDLE = Math.max(6, Math.min(W, H) * 0.018);
    const stroke = Math.max(2, Math.min(W, H) * 0.004);
    // 4 边外区域暗色 + 选区边框（剪裁模式下还画 8 手柄 + 内部移动区）
    const path = `M0,0 L${W},0 L${W},${H} L0,${H} Z M${cx},${cy} L${cx + cw},${cy} L${cx + cw},${cy + ch} L${cx},${cy + ch} Z`;
    const interactive = pImageCropMode ? `
      <rect class="p-crop-move" x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="transparent" pointer-events="all" style="cursor:move" />
      <rect class="p-crop-h" data-handle="nw" x="${cx - HANDLE / 2}" y="${cy - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nwse-resize" />
      <rect class="p-crop-h" data-handle="ne" x="${cx + cw - HANDLE / 2}" y="${cy - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nesw-resize" />
      <rect class="p-crop-h" data-handle="sw" x="${cx - HANDLE / 2}" y="${cy + ch - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nesw-resize" />
      <rect class="p-crop-h" data-handle="se" x="${cx + cw - HANDLE / 2}" y="${cy + ch - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:nwse-resize" />
      <rect class="p-crop-h" data-handle="n"  x="${cx + cw / 2 - HANDLE / 2}" y="${cy - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ns-resize" />
      <rect class="p-crop-h" data-handle="s"  x="${cx + cw / 2 - HANDLE / 2}" y="${cy + ch - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ns-resize" />
      <rect class="p-crop-h" data-handle="w"  x="${cx - HANDLE / 2}" y="${cy + ch / 2 - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ew-resize" />
      <rect class="p-crop-h" data-handle="e"  x="${cx + cw - HANDLE / 2}" y="${cy + ch / 2 - HANDLE / 2}" width="${HANDLE}" height="${HANDLE}" fill="#fff" stroke="#D6285A" stroke-width="${stroke}" pointer-events="all" style="cursor:ew-resize" />
    ` : '';
    mask.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="w-full h-full block">
        <path d="${path}" fill="#0009" fill-rule="evenodd" pointer-events="none" />
        <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="#fff" stroke-width="${stroke}" pointer-events="none" />
        ${interactive}
      </svg>`;
    if (pImageCropMode) bindCropHandleEvents();
  }
  // 绑 8 手柄 + 内部移动的 mousedown（拖拽过程用 document 级监听，避免鼠标离开 svg 丢事件）
  function bindCropHandleEvents() {
    $$('.p-crop-h').forEach(h => h.onmousedown = (e) => startCropDrag(e, h.dataset.handle, 'p-img-mask'));
    $$('.p-crop-move').forEach(m => m.onmousedown = (e) => startCropDrag(e, 'move', 'p-img-mask'));
  }
  // 用 mask 内 svg 的实际渲染尺寸算 X/Y 两个 scale — 防止容器比例与 viewBox 比例不一致时算错
  function startCropDrag(e, handle, maskId) {
    e.preventDefault(); e.stopPropagation();
    const svg = $(`#${maskId} svg`); if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = rect.width / (pImage.naturalWidth || 1);   // CSS X 像素 → 原图 X 像素比例
    const sy = rect.height / (pImage.naturalHeight || 1); // CSS Y 像素 → 原图 Y 像素比例
    pImageCropDrag = { handle, startCrop: { ...pImageCrop }, startX: e.clientX, startY: e.clientY, sx, sy };
  }
  // 根据 handle 调整 pImageCrop（保证选区在 [0,W]×[0,H] 内，最小 2% 边）
  function applyCropDrag(e) {
    if (!pImageCropDrag || !pImageCrop) return;
    const W = pImage.naturalWidth, H = pImage.naturalHeight;
    const min = Math.max(W, H) * 0.02;
    const dx = (e.clientX - pImageCropDrag.startX) / (pImageCropDrag.sx || pImageCropDrag.scale || 1);
    const dy = (e.clientY - pImageCropDrag.startY) / (pImageCropDrag.sy || pImageCropDrag.scale || 1);
    const c0 = pImageCropDrag.startCrop;
    let x = c0.x, y = c0.y, w = c0.w, h = c0.h;
    const h_ = pImageCropDrag.handle;
    const setMax = (v, max) => Math.max(min, Math.min(v, max));
    if (h_ === 'move') {
      x = Math.max(0, Math.min(c0.x + dx, W - c0.w));
      y = Math.max(0, Math.min(c0.y + dy, H - c0.h));
    } else if (h_ === 'nw') {
      const nx = Math.max(0, Math.min(c0.x + dx, c0.x + c0.w - min));
      const ny = Math.max(0, Math.min(c0.y + dy, c0.y + c0.h - min));
      w = (c0.x + c0.w) - nx; h = (c0.y + c0.h) - ny; x = nx; y = ny;
    } else if (h_ === 'ne') {
      const ny = Math.max(0, Math.min(c0.y + dy, c0.y + c0.h - min));
      const nw = setMax(c0.w + dx, W - c0.x);
      w = nw; h = (c0.y + c0.h) - ny; x = c0.x; y = ny;
    } else if (h_ === 'sw') {
      const nx = Math.max(0, Math.min(c0.x + dx, c0.x + c0.w - min));
      const nh = setMax(c0.h + dy, H - c0.y);
      w = (c0.x + c0.w) - nx; h = nh; x = nx; y = c0.y;
    } else if (h_ === 'se') {
      w = setMax(c0.w + dx, W - c0.x);
      h = setMax(c0.h + dy, H - c0.y);
      x = c0.x; y = c0.y;
    } else if (h_ === 'n') {
      const ny = Math.max(0, Math.min(c0.y + dy, c0.y + c0.h - min));
      h = (c0.y + c0.h) - ny; y = ny; x = c0.x; w = c0.w;
    } else if (h_ === 's') {
      h = setMax(c0.h + dy, H - c0.y);
      y = c0.y; x = c0.x; w = c0.w;
    } else if (h_ === 'w') {
      const nx = Math.max(0, Math.min(c0.x + dx, c0.x + c0.w - min));
      w = (c0.x + c0.w) - nx; x = nx; y = c0.y; h = c0.h;
    } else if (h_ === 'e') {
      w = setMax(c0.w + dx, W - c0.x);
      x = c0.x; y = c0.y; h = c0.h;
    }
    pImageCrop = { x, y, w, h };
    renderImageCropMask();
    // 若放大 modal 开着，同步刷新 modal 里的选区
    if ($('#zoom-img-mask')) renderZoomCropMask();
    updateZoomCropInfo();
  }
  // 更新放大 modal 内「📐 选区: WxH」实时显示（含与目标网格比例对照）
  function updateZoomCropInfo() {
    const info = $('#zoom-crop-info');
    if (!info || !pImage) return;
    if (!pImageCrop) { info.textContent = '📐 选区: 未设置（识别整图）'; return; }
    const cw = pImageCrop.w | 0, ch = pImageCrop.h | 0;
    const tCols = parseInt(($('#p-icols') || {}).value, 10) || 0;
    const tRows = parseInt(($('#p-irows') || {}).value, 10) || 0;
    let ratioHint = '';
    if (tCols > 0 && tRows > 0) {
      const imgR = cw / Math.max(1, ch);
      const tgR = tCols / Math.max(1, tRows);
      const diff = Math.abs(imgR - tgR) / tgR;
      if (diff > 0.4) ratioHint = ` ⚠️ 与目标 ${tCols}×${tRows} 比例差距较大`;
      else ratioHint = ` (≈ 目标 ${tCols}×${tRows})`;
    }
    info.textContent = `📐 选区: ${cw} × ${ch}${ratioHint}`;
  }
  // 像素网格降色：高过采样 + cell 内粗颜色直方图投票（把格内文字/网格线"少数票"稀释掉）
  //   - 每格采 8×8=64 像素 → 主色占绝大多数票
  //   - 每像素按 4-bit RGB 量化到 4096 桶，找最大桶取均 → 再 nearestOwnedColor 一次
  //   - 适合源图已经是"带色号文字/网格线的拼豆图纸"（否则平均色会被黑色文字污染，错配到相邻色）
  function patternGenerateFromImage() {
    if (!pImage) return;
    const fullW = pImage.naturalWidth || pImage.width;
    const fullH = pImage.naturalHeight || pImage.height;
    if (!fullW || !fullH) {
      // 图片尺寸读不到（缓存/未 onload），重置 pCells 为目标尺寸全空，避免留旧数据导致画布显示陈旧内容
      pCells = Array.from({ length: pRows }, () => new Array(pCols).fill(null));
      pLastDetectedColors = 0;
      return;
    }
    if (!state.beads || !state.beads.length) {
      pCells = Array.from({ length: pRows }, () => new Array(pCols).fill(null));
      pLastDetectedColors = 0;
      return;
    }
    let sx = 0, sy = 0, sw = fullW, sh = fullH;
    if (pImageCrop && (pImageCrop.x > 0 || pImageCrop.y > 0 || pImageCrop.w < fullW || pImageCrop.h < fullH)) {
      sx = pImageCrop.x; sy = pImageCrop.y; sw = pImageCrop.w; sh = pImageCrop.h;
      sw = Math.max(2, Math.min(sw, fullW - sx));
      sh = Math.max(2, Math.min(sh, fullH - sy));
    }
    const W = sw, H = sh;
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(pImage, sx, sy, sw, sh, 0, 0, W, H);
    const data = tctx.getImageData(0, 0, W, H).data;

    // 噪声过滤: 只过滤"近白"的极浅光晕（旧的设备银边/真浅灰(180~220) 应保留给下方饱和度判定）
    function isNoise(r, g, b) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const lum = (mx + mn) / 2;
      if (sat < 0.04 && lum > 0.88 && lum < 0.99) return true;  // 极浅的银边/光晕
      return false;
    }
    // 像素分类 (HSL)
    //   background: 饱和度极低 (sat < 0.10) — 白底/银底/灰底 都属此类
    //   blackText  : 极深 (max < 40) — MARD221 黑文字/网格线 (排除, 当背景用)
    //   colored    : 其他 — 真正的彩色拼豆像素
    function isBackground(r, g, b) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      return sat < 0.10;
    }
    function isBlackish(r, g, b) { return r < 40 && g < 40 && b < 40; }
    // 近白(应填白色系如 H2): 高亮度且极低饱和 — 与浅灰底/银边区分开
    function isNearWhite(r, g, b) {
      const mx = Math.max(r, g, b);
      if (mx < 240) return false;
      const mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      return sat < 0.06;
    }
    // 直方图条目: { n, sr, sg, sb, satSum, isColored }
    const tmp_cells = [];
    pPaletteReport = [];  // 调试报告: 全图每种 5bit 主色 → 色号 → 占比

    for (let r = 0; r < pRows; r++) {
      const rowRgb = new Array(pCols).fill(null);
      const rowCell = new Array(pCols).fill(null);  // cell 调试数据: {best, picked}
      for (let c = 0; c < pCols; c++) {
        const x0 = ((c * W) / pCols) | 0;
        const x1 = (((c + 1) * W) / pCols) | 0;
        const y0 = ((r * H) / pRows) | 0;
        const y1 = (((r + 1) * H) / pRows) | 0;
        if (x1 <= x0 || y1 <= y0) continue;
        const cw = x1 - x0, chh = y1 - y0;
        // 边缘 cell 内缩少些，中心 cell 内缩多些 — 避免边缘 cell 错过彩色像素
        const radial = Math.min(cw, chh);
        const inset = Math.min(2, Math.floor(radial * 0.10));
        const ix0 = x0 + inset, ix1 = x1 - inset;
        const iy0 = y0 + inset, iy1 = y1 - inset;
        if (ix1 <= ix0 || iy1 <= iy0) continue;

        // 3 类分桶: 全像素 / 彩色像素 / 背景像素
        const allBuckets = new Map();      // 整体量化 (回退用)
        const coloredBuckets = new Map();  // 只有彩色像素 (主色用)
        const bgBuckets = new Map();       // 背景像素 (用于诊断)
        let totalPx = 0, coloredPx = 0, bgPx = 0;
        for (let yy = iy0; yy < iy1; yy++) {
          const rowOff = yy * W * 4;
          for (let xx = ix0; xx < ix1; xx++) {
            const px = rowOff + (xx << 2);
            const dr = data[px], dg = data[px + 1], db = data[px + 2];
            if (isNoise(dr, dg, db)) continue;
            totalPx++;
            const qr = dr >> 4, qg = dg >> 4, qb = db >> 4;
            const key = (qr << 8) | (qg << 4) | qb;
            let bb = allBuckets.get(key);
            if (!bb) { bb = { sr: 0, sg: 0, sb: 0, n: 0 }; allBuckets.set(key, bb); }
            bb.sr += dr; bb.sg += dg; bb.sb += db; bb.n++;
            if (isBackground(dr, dg, db)) {
              bgPx++;
              let bg = bgBuckets.get(key);
              if (!bg) { bg = { sr: 0, sg: 0, sb: 0, n: 0 }; bgBuckets.set(key, bg); }
              bg.sr += dr; bg.sg += dg; bg.sb += db; bg.n++;
            } else {
              coloredPx++;
              let cb = coloredBuckets.get(key);
              if (!cb) { cb = { sr: 0, sg: 0, sb: 0, n: 0 }; coloredBuckets.set(key, cb); }
              cb.sr += dr; cb.sg += dg; cb.sb += db; cb.n++;
            }
          }
        }
        if (!totalPx) continue;

        // === 决策算法：代表色 = 占格≥4%的彩色桶中「最高饱和度」者 ===
        // 目的：细边/描边(如中间圆形边缘应为单一 c19)在 cell 内与白底 AA 混合时，
        // 取"最饱和"的主色而非"最频繁"的混合均值，避免边缘被带成多种浅色。
        let chosen = null;
        let colorRole = 'skip';  // 'colored' | 'bg' | 'skip' 用于诊断
        const minCount = Math.max(2, Math.round(totalPx * 0.04)); // 4% 门槛，抑制零星杂点喧宾夺主
        let bgTop = null;
        for (const b of bgBuckets.values()) { if (!bgTop || b.n > bgTop.n) bgTop = b; }
        if (coloredPx / totalPx >= 0.08) {
          let top = null, satBest = null, satBestSat = -1;
          for (const b of coloredBuckets.values()) {
            if (!top || b.n > top.n) top = b;
            if (b.n >= minCount) {
              const ar = b.sr / b.n, ag = b.sg / b.n, ab = b.sb / b.n;
              const mx = Math.max(ar, ag, ab), mn = Math.min(ar, ag, ab);
              const sat = mx === 0 ? 0 : (mx - mn) / mx;
              if (sat > satBestSat) { satBestSat = sat; satBest = b; }
            }
          }
          if (satBest) { chosen = satBest; colorRole = 'colored'; }
          else if (top && top.n >= minCount) { chosen = top; colorRole = 'colored'; }
          else if (top && top.n >= 2) { chosen = top; colorRole = 'colored'; }
          else { colorRole = 'bg'; }
        } else {
          // 彩色像素占比过低 → 可能是纯白底格子(应填白色系 H2) 或真背景
          // 若白像素占绝大多数且主色近白 → 填最近白色系色号, 否则留空
          if (bgTop && bgPx / totalPx >= 0.5 && isNearWhite(bgTop.sr / bgTop.n, bgTop.sg / bgTop.n, bgTop.sb / bgTop.n)) {
            chosen = bgTop; colorRole = 'white';
          } else {
            colorRole = 'bg';  // 避免白底零星彩点/浅灰底被当成色块
          }
        }
        if (chosen) {
          rowRgb[c] = [chosen.sr / chosen.n, chosen.sg / chosen.n, chosen.sb / chosen.n];
        }
        rowCell[c] = { totalPx, coloredPx, bgPx, colorRole };
      }
      tmp_cells.push(rowRgb);
      // (调试数据存到全局外不再使用 — 用户不需看 cell-by-cell)
    }

    // === 第二遍: 全局调色板 (5-bit 量化合并) ===
    const beadLabs = state.beads.map(b => {
      const [br, bg, bb] = hexToRgb(b.hex);
      return rgbToLab(br, bg, bb);
    });
    const paletteMap = new Map();  // 5bit key → 色号
    const detectedKeys = new Set();
    const detectedAgg = new Map();  // 5bit key → { n, sr, sg, sb }
    for (const rowRgb of tmp_cells) {
      for (const rgb of rowRgb) {
        if (!rgb) continue;
        const qk = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
        detectedKeys.add(qk);
        let agg = detectedAgg.get(qk);
        if (!agg) { agg = { n: 0, sr: 0, sg: 0, sb: 0 }; detectedAgg.set(qk, agg); }
        agg.n++; agg.sr += rgb[0]; agg.sg += rgb[1]; agg.sb += rgb[2];
        if (!paletteMap.has(qk)) {
          paletteMap.set(qk, nearestOwnedColorLab(rgb[0], rgb[1], rgb[2], beadLabs));
        }
      }
    }
    pLastDetectedColors = detectedKeys.size;

    // === 第三遍: 每 cell 量化 → 全局调色板 → 色号 ===
    // 同时收集配色报告 (top 12 量化色，按占比降序)
    const reportArr = [];
    for (const [qk, agg] of detectedAgg) {
      const beadCode = paletteMap.get(qk);
      const r = Math.round(agg.sr / agg.n), g = Math.round(agg.sg / agg.n), b = Math.round(agg.sb / agg.n);
      reportArr.push({ qk, n: agg.n, r, g, b, beadCode });
    }
    const totalMapped = reportArr.reduce((s, x) => s + x.n, 0);
    reportArr.sort((a, b) => b.n - a.n);
    pPaletteReport = reportArr.slice(0, 12).map(x => ({
      pct: Math.round(100 * x.n / Math.max(1, totalMapped)),
      r: x.r, g: x.g, b: x.b,
      beadCode: x.beadCode,
      hex: rgbToHex(x.r, x.g, x.b)
    }));
    renderPaletteReportPanel();

    const cells = [];
    for (const rowRgb of tmp_cells) {
      const outRow = [];
      for (const rgb of rowRgb) {
        if (!rgb) { outRow.push(null); continue; }
        const qk = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
        outRow.push(paletteMap.get(qk));
      }
      cells.push(outRow);
    }
    // 借鉴 pindou-skill 的 max_colors：限制图纸用色数，超出部分合并到最近主色
    // 思路：先每格 CIEDE2000 匹配全色板（上面已完成），数频次取 top-K 主色板，
    // 低频色号 remap 到 top-K 里 CIEDE2000 最近的色号（色板→色板，失真可控）。
    if (pMaxColors && pMaxColors > 0) {
      const counts = new Map();
      for (const row of cells) for (const code of row) if (code) counts.set(code, (counts.get(code) || 0) + 1);
      if (counts.size > pMaxColors) {
        const topK = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, pMaxColors).map(e => e[0]);
        const topSet = new Set(topK);
        const labCacheM = new Map();
        const labOf = (code) => {
          if (!labCacheM.has(code)) {
            const bd = beadByNumber(code);
            const [br, bg, bb] = (bd && bd.hex) ? hexToRgb(bd.hex) : [200, 200, 200];
            labCacheM.set(code, rgbToLab(br, bg, bb));
          }
          return labCacheM.get(code);
        };
        const remap = new Map();
        for (const code of counts.keys()) {
          if (topSet.has(code)) { remap.set(code, code); continue; }
          const lab = labOf(code);
          let best = null, bd = Infinity;
          for (const t of topK) { const d = labDeltaE(lab, labOf(t)); if (d < bd) { bd = d; best = t; } }
          remap.set(code, best);
        }
        for (let rr = 0; rr < cells.length; rr++) for (let cc = 0; cc < cells[rr].length; cc++) {
          if (cells[rr][cc]) cells[rr][cc] = remap.get(cells[rr][cc]);
        }
      }
    }
    return cells;   // 主路径调用方负责写 pCells；OCR 路径把它当 fallback 使用
  }
  // 把 pImage (含 pImageCrop 选区) 画成模型可读的高分辨率图（短边 ≈ min(行数,列数)×35 像素，
  // 上限 1800），提升视觉模型对网格中字符色号的读取准确率。
  function getPatternDataUrlForOCR() {
    if (!pImage) return null;
    const fullW = pImage.naturalWidth || pImage.width;
    const fullH = pImage.naturalHeight || pImage.height;
    if (!fullW || !fullH) return null;
    let sx = 0, sy = 0, sw = fullW, sh = fullH;
    if (pImageCrop && (pImageCrop.x > 0 || pImageCrop.y > 0 || pImageCrop.w < fullW || pImageCrop.h < fullH)) {
      sx = pImageCrop.x; sy = pImageCrop.y; sw = pImageCrop.w; sh = pImageCrop.h;
      sw = Math.max(2, Math.min(sw, fullW - sx));
      sh = Math.max(2, Math.min(sh, fullH - sy));
    }
    const short = Math.min(sw, sh);
    const target = Math.min(1800, Math.max(800, Math.min(pRows, pCols) * 35));
    const scale = target / short;
    const outW = Math.max(2, Math.round(sw * scale));
    const outH = Math.max(2, Math.round(sh * scale));
    const cnv = document.createElement('canvas');
    cnv.width = outW; cnv.height = outH;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pImage, sx, sy, sw, sh, 0, 0, outW, outH);
    return cnv.toDataURL('image/jpeg', 0.92);
  }
  // OCR 模式最后兜底：对 OCR + 原像素法都没填上的格子，若 cell 内有非白像素，用 cell 主色就近填一格色卡。
  // （图纸作者把"白底=不放豆"时此格仍留空；图纸把白当"放白豆但没印字符"时此格会被填上对应浅色/W1。）
  function fillBlankByCellColor(cells) {
    if (!pImage || !state.beads || !state.beads.length) return 0;
    const fullW = pImage.naturalWidth || pImage.width;
    const fullH = pImage.naturalHeight || pImage.height;
    if (!fullW || !fullH) return 0;
    let sx = 0, sy = 0, sw = fullW, sh = fullH;
    if (pImageCrop && (pImageCrop.x > 0 || pImageCrop.y > 0 || pImageCrop.w < fullW || pImageCrop.h < fullH)) {
      sx = pImageCrop.x; sy = pImageCrop.y; sw = pImageCrop.w; sh = pImageCrop.h;
      sw = Math.max(2, Math.min(sw, fullW - sx));
      sh = Math.max(2, Math.min(sh, fullH - sy));
    }
    // 中等分辨率分析画布（看清 cell 主色即可）
    const short = Math.min(sw, sh);
    const scale = Math.min(1, Math.max(0.5, 600 / Math.max(short, 1)));
    const outW = Math.max(2, Math.round(sw * scale));
    const outH = Math.max(2, Math.round(sh * scale));
    const cnv = document.createElement('canvas');
    cnv.width = outW; cnv.height = outH;
    const ctx = cnv.getContext('2d');
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(pImage, sx, sy, sw, sh, 0, 0, outW, outH);
    let imgData;
    try { imgData = ctx.getImageData(0, 0, outW, outH); } catch (_) { return 0; }
    const data = imgData.data;
    // 预计算所有有效色卡的 Lab（避免每 cell 重算）
    const labCache = [];
    for (let i = 0; i < state.beads.length; i++) {
      const b = state.beads[i];
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(b.hex || '');
      if (!m) continue;
      labCache.push({ idx: i, lab: rgbToLab(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)) });
    }
    function quickNearest(r, g, b) {
      const lab = rgbToLab(r, g, b);
      let best = null, bestD = Infinity;
      for (let k = 0; k < labCache.length; k++) {
        const d = labDeltaE(lab, labCache[k].lab);
        if (d < bestD) { bestD = d; best = state.beads[labCache[k].idx]; }
      }
      return best ? best.colorNumber : null;
    }
    let filled = 0;
    const cellW = outW / pCols, cellH = outH / pRows;
    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        if (cells[r][c]) continue;
        const x0 = Math.max(0, Math.floor(c * cellW));
        const x1 = Math.min(outW, Math.floor((c + 1) * cellW));
        const y0 = Math.max(0, Math.floor(r * cellH));
        const y1 = Math.min(outH, Math.floor((r + 1) * cellH));
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const off = (y * outW + x) * 4;
            const R = data[off], G = data[off + 1], B = data[off + 2];
            if (R >= 250 && G >= 250 && B >= 250) continue;  // 近白跳过
            sr += R; sg += G; sb += B; n++;
          }
        }
        if (n >= 2) {
          const R = Math.round(sr / n), G = Math.round(sg / n), B = Math.round(sb / n);
          const code = quickNearest(R, G, B);
          if (code) { cells[r][c] = code; filled++; }
        }
      }
    }
    return filled;
  }
  // 「格子 OCR」主路径：调视觉模型读每格中央字符 → 查色卡 → 写 cells。
  // 对 OCR 失败 / 色卡未覆盖 / 模型判为空的格子，回退到像素法（用同一网格坐标）。
  async function patternGenerateFromImageOCR() {
    if (!pImage) return Array.from({ length: pRows }, () => new Array(pCols).fill(null));
    if (!state.beads || !state.beads.length) return Array.from({ length: pRows }, () => new Array(pCols).fill(null));
    const dataUrl = getPatternDataUrlForOCR();
    if (!dataUrl) return Array.from({ length: pRows }, () => new Array(pCols).fill(null));
    // 1) 像素法结果作为 fallback（OCR 失败的格子用它兜底）
    const backupCells = patternGenerateFromImage();
    // 2) 调视觉模型读 grid —— OCR 固定走智谱（若设置里选了其他智谱模型 glm-* 则用之，否则默认 glm-4v-flash）。
    //    强制走同源代理（baseUrl=''），不直连，避免用户在设置里选的 OpenAI Key 干扰 OCR。
    const ocrModel = (state.settings.model && state.settings.model.toLowerCase().startsWith('glm'))
      ? state.settings.model : 'glm-4v-flash';
    const { grid, recognized } = await callGridVisionAPI(
      dataUrl, pRows, pCols,
      '', ocrModel, ''   // apiKey 空=代理不前端带 Key；baseUrl 空=同源代理(智谱)
    );
    // 3) 字符 → 色号查表（覆盖在 backup 之上）
    const ocrCells = applyGridToCells(grid);
    let matchedByOCR = 0, filledByFallback = 0, unmatchedByOCR = 0;
    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        if (ocrCells[r][c]) { matchedByOCR++; continue; }
        if (backupCells[r] && backupCells[r][c]) { ocrCells[r][c] = backupCells[r][c]; filledByFallback++; continue; }
        ocrCells[r][c] = null;
        unmatchedByOCR++;
      }
    }
    // 3.5) 最后兜底：OCR + 像素法都没填上的格子，若 cell 内有非白像素，用主色就近填色卡
    const filledByPixel = fillBlankByCellColor(ocrCells);
    // 4) 报告：基于最终 cells 按色号统计占比（OCR 模式主导）
    const agg = new Map();   // colorNumber → { n, r, g, b }
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      const code = ocrCells[r][c]; if (!code) continue;
      const bead = beadByNumber(code);
      let rrr = 204, ggg = 204, bbb = 204;
      if (bead && bead.hex) {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(bead.hex);
        if (m) { rrr = parseInt(m[1], 16); ggg = parseInt(m[2], 16); bbb = parseInt(m[3], 16); }
      }
      let a = agg.get(code);
      if (!a) { a = { n: 0, r: rrr, g: ggg, b: bbb }; agg.set(code, a); }
      a.n++;
    }
    const arr = Array.from(agg.entries());   // [[code, {n,r,g,b}], ...]
    const tot = arr.reduce((s, [, x]) => s + x.n, 0);
    arr.sort((a, b) => b[1].n - a[1].n);
    pPaletteReport = arr.slice(0, 12).map(([code, x]) => ({
      pct: Math.round(100 * x.n / Math.max(1, tot)),
      r: x.r, g: x.g, b: x.b,
      beadCode: code,
      hex: rgbToHex(x.r, x.g, x.b)
    }));
    renderPaletteReportPanel();
    pLastDetectedColors = agg.size;
    // 5) 给调用方一个最终诊断（写到全局后面让 toast 显示）
    pOcrMeta = { recognized, matchedByOCR, filledByFallback, filledByPixel, unmatchedByOCR, model: ocrModel };
    return ocrCells;
  }
  // 执行「图转图纸」生成（被点击按钮和 grid input 自动重算共用）。
  // opts.fromAuto=true 时用于网格改变后的静默重算，仅弹简短提示，避免每次都刷「全空/成功」长诊断。
  // async 因为 OCR 模式会 await 视觉模型
  async function patternRunGenerate(opts) {
    const fromAuto = !!(opts && opts.fromAuto);
    if (!pImage) return toast('请先上传参考图', 'warn');
    // 读取「最多色数」选项（借鉴 pindou-skill 的 max_colors）
    const mcEl = document.getElementById('p-maxcolors');
    if (mcEl) { const v = parseInt(mcEl.value, 10); pMaxColors = (isFinite(v) && v > 0) ? v : 0; }
    // 色卡不足时的软提示：≥5 色才"出图", <5 色只建议先补色卡再生成
    if (!state.beads || !state.beads.length) {
      return toast('⚠️ 拼豆色卡为空\n请先到「色卡管理」添加一些色卡（黑色、白色、肉色等基础配色），再识别图纸', 'warn', 6000);
    }
    if (state.beads.length < 5 && !fromAuto) {
      toast(`💡 当前只有 ${state.beads.length} 种色卡, 识别效果会非常粗糙（所有非白格都会映射到同一色号）\n建议先到「色卡管理」导入更多色号 (MARD 221 标准色), 或点下方「继续生成」强行预览`, 'info', 6000);
    }
    // input 空/非法时 fallback 到现有 pCols/pRows（避免被强行改成 30 抹掉用户之前填的尺寸）
    let c = parseInt($('#p-icols').value, 10); if (!isFinite(c) || c < 2 || c > 150) c = pCols || 30;
    let r = parseInt($('#p-irows').value, 10); if (!isFinite(r) || r < 2 || r > 150) r = pRows || 30;
    c = Math.min(150, Math.max(2, c)); r = Math.min(150, Math.max(2, r));
    pCols = c; pRows = r; pHighlight = null;
    patternPushUndo();
    // 模式分派：像素法 vs 格子 OCR
    const useOCR = !!(state.settings && state.settings.gridOCREnabled);
    let cells;
    if (useOCR) {
      try {
        cells = await patternGenerateFromImageOCR();
      } catch (err) {
        // OCR 失败：把智谱真实错误暴露出来（之前静默回退，让人误以为是没换成智谱）
        console.error('[格子OCR] 智谱调用失败：', err);
        toast(`⚠️ 格子 OCR 调用智谱失败：${(err && err.message) || err}\n已回退到像素法。请确认 Vercel 已配 ZHIPU_API_KEY（模型统一用 glm-4v-flash）`, 'warn', 6000);
        cells = patternGenerateFromImage();
      }
    } else {
      cells = patternGenerateFromImage();
    }
    pCells = cells;
    patternRenderCanvas();
    patternRenderBOM();
    // 同步更新右上「画布（N×M）」标题（避免每次重新 renderPattern）
    const titles = document.querySelectorAll('h3');
    for (const t of titles) { if (/🧩\s*画布/.test(t.textContent)) t.textContent = `🧩 画布（${pCols} × ${pRows}）`; }
    // 反馈生成情况：多少格匹配到色、多少格空（剪裁区小于目标网格时空格会很多）
    let filled = 0, empty = 0;
    for (let rr = 0; rr < pCells.length; rr++) for (let cc = 0; cc < pCells[rr].length; cc++) {
      if (pCells[rr][cc]) filled++; else empty++;
    }
    const total = pCols * pRows;
    const beadCount = (state.beads && state.beads.length) || 0;
    const detected = pLastDetectedColors || 0;
    // 当前剪裁区比例（用于提示"把网格调到接近这个比例"）
    const cropW = pImageCrop ? pImageCrop.w : (pImage ? pImage.naturalWidth : 1);
    const cropH = pImageCrop ? pImageCrop.h : (pImage ? pImage.naturalHeight : 1);
    const cropRatio = (cropW / cropH).toFixed(2);
    const cellPxW = (cropW / pCols).toFixed(1), cellPxH = (cropH / pRows).toFixed(1);

    // 紧凑的"色彩映射"摘要：只列色号+占比（不打印 RGB/hex，省行数，详细报告渲染到下方面板）
    const topPalette = (pPaletteReport || []).slice(0, 5).map(x => `${x.beadCode || '?'}·${x.pct}%`).join(' · ');
    const paletteSummary = topPalette ? `  Top5: ${topPalette}` : '';

    if (fromAuto) {
      // 静默场景：仅给一行简洁反馈
      if (filled === 0) {
        toast(`⚠️ ${pCols}×${pRows} 全空 — 检查色卡或缩小网格/调整剪裁`, 'warn', 4000);
      } else {
        toast(`🔄 自动重算 ${pCols}×${pRows}，匹配 ${filled} 格${paletteSummary}`, 'info', 2400);
      }
      return;
    }

    if (filled === 0) {
      const tips = [];
      if (beadCount < 5) tips.push(`① 色卡仅 ${beadCount} 种 — 至少加 5~10 种基础色`);
      if (detected > beadCount * 2 && beadCount < 20) tips.push(`② 图中检测到 ${detected} 种主色, 但色卡只有 ${beadCount} 种 — 建议导入完整 MARD 221 色`);
      if (detected === 1) tips.push(`③ 仅识别出 1 种主色 — 大部分区域被识别为白底, 把网格列/行调小（如 40×25）或点「✂️ 剪裁」框出内容区`);
      else tips.push(`③ 目标网格 ${pCols}×${pRows}（比例 ${(pCols/pRows).toFixed(2)}:1）过大, 建议调到剪裁区比例 ${cropRatio}:1 — 每格像素越多, 识别越准`);
      if (!pImageCrop || (pImageCrop.x === 0 && pImageCrop.y === 0 && pImageCrop.w >= (pImage.naturalWidth - 1) && pImageCrop.h >= (pImage.naturalHeight - 1))) {
        tips.push(`④ 当前未剪裁, 整张图含大量白底 — 点「✂️ 剪裁」框出内容区`);
      }
      // OCR 模式下附加诊断
      const ocrWarn = (useOCR && pOcrMeta)
        ? `\n🧠 OCR：识别 ${pOcrMeta.recognized} · 命中 ${pOcrMeta.matchedByOCR}${pOcrMeta.unmatchedByOCR ? ' · ' + pOcrMeta.unmatchedByOCR + ' 格未覆盖' : ''} · cell 主色补 ${pOcrMeta.filledByPixel || 0}`
        : '';
      toast(`⚠️ 没匹配到任何色卡（${total} 格全空）\n图检测到 ${detected} 种主色 / 你的色卡 ${beadCount} 种\n${tips.join('\n')}${ocrWarn}${paletteSummary}`, 'warn', 6000);
    } else if (empty / total > 0.5) {
      const tips2 = [`匹配 ${filled} / 空 ${empty}（${total} 格），检测 ${detected} 种主色`];
      if (detected > beadCount * 2 && beadCount < 20) tips2.push(`色卡 ${beadCount} 种 < 检测 ${detected} 种 — 颜色卡里导入更多`);
      if (cellPxW < 12 || cellPxH < 12) tips2.push(`每格仅 ${cellPxW}×${cellPxH}px（<12），识别精度受限 — 把网格调小到 30~40 列`);
      else tips2.push(`建议把 ${pCols}×${pRows} 调到接近剪裁比例 ${cropRatio}:1`);
      const ocrHint = (useOCR && pOcrMeta)
        ? `\n🧠 OCR：识别 ${pOcrMeta.recognized} · 命中 ${pOcrMeta.matchedByOCR}${pOcrMeta.unmatchedByOCR ? ' · ' + pOcrMeta.unmatchedByOCR + ' 格未覆盖' : ''} · 兜底 ${pOcrMeta.filledByFallback} · cell补 ${pOcrMeta.filledByPixel || 0}`
        : '';
      toast(`⚠️ ${tips2.join('\n')}${ocrHint}${paletteSummary}`, 'warn', 5000);
    } else {
      // 成功路径：2 行 + 紧凑摘要（OCR 模式下额外展示识别/命中/兜底/未匹配数）
      if (useOCR && pOcrMeta) {
        const om = pOcrMeta;
        const unmatchedHint = om.unmatchedByOCR > 0 ? ` · ${om.unmatchedByOCR} 格识别出色号但色卡未覆盖` : '';
        toast(`✅ 格子 OCR ${pCols}×${pRows}：识别 ${om.recognized} · 命中色卡 ${om.matchedByOCR}${unmatchedHint} · 像素兜底 ${om.filledByFallback} · cell主色补 ${om.filledByPixel}\n🧠 模型 ${om.model}（OCR 固定走智谱；空格子按 cell 主色就近填充）`,
              'success', 5000);
      } else {
        toast(`✅ 已生成 ${pCols}×${pRows}，匹配 ${filled} 格 / 空 ${empty} 格（检测 ${detected} 种主色）\n🎨 hover 网格看具体色号；详细色彩映射在下方面板展开`, 'success', 4000);
      }
    }
  }
  // 渲染"色彩映射"详情面板（BOM 下方的折叠区），只展示识别到的主色 + 占色卡号 + 占比。
  // 当 pPaletteReport 为空时折叠区自动隐藏。
  function renderPaletteReportPanel() {
    const wrap = $('#p-palette');
    const body = $('#p-palette-body');
    if (!wrap || !body) return;
    if (!pPaletteReport || !pPaletteReport.length) {
      wrap.classList.add('hidden');
      body.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    const totalShown = pPaletteReport.reduce((s, x) => s + x.pct, 0);
    body.innerHTML = `
      <table class="w-full text-xs leading-tight">
        <thead><tr class="text-mk-sub text-left">
          <th class="py-1 pr-1">■</th><th class="py-1 pr-1">HEX</th><th class="py-1 pr-1">RGB</th>
          <th class="py-1 pr-1">→ 色号</th><th class="py-1 pr-1 text-right">%</th><th class="py-1">色块</th>
        </tr></thead>
        <tbody>
          ${pPaletteReport.map(x => `<tr class="border-t border-mk-sand/40">
            <td class="py-1 pr-1 font-mono">${escapeHtml(x.hex)}</td>
            <td class="py-1 pr-1 text-mk-sub">${x.r},${x.g},${x.b}</td>
            <td class="py-1 pr-1 font-semibold">${escapeHtml(x.beadCode || '?')}</td>
            <td class="py-1 pr-1 text-right tabular-nums">${x.pct}%</td>
            <td class="py-1"><span class="inline-block w-6 h-3 rounded align-middle border border-mk-sand/60" style="background:${x.hex}"></span></td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p class="text-[11px] text-mk-sub mt-2">前 ${pPaletteReport.length} 色共占 ${totalShown}%（剩余 ${100 - totalShown}% 为背景白/网格）</p>`;
  }
  function patternExportPNG() {
    const safe = patternSafeName(pName);
    const cp = pShowNumbers ? 30 : 20;     // 启用色号时格子大一些，文字才清楚
    const W = pCols * cp;
    const H_grid = pRows * cp;
    const bom = patternBOM();
    const total = bom.reduce((s, x) => s + x.qty, 0);
    // 用料清单区布局（色号印在框内 / 色卡色块 / 数量在框下）
    const capW = 62, capH = 44, gap = 12;                 // 色块（内含色号）
    const numH = 22, blockGap = 4;                         // 色块下方数量
    const cellH = capH + blockGap + numH;                  // 每颗 cell 总高（色块 + 间隔 + 数量）
    const perRow = Math.max(1, Math.floor((W - 16 + gap) / (capW + gap)));
    const rowsCount = Math.ceil(bom.length / perRow);
    const listPadTop = 18, titleH = 24, sumH = 36, listGap = 12;
    const listH = bom.length ? (titleH + rowsCount * (cellH + gap) + listGap + sumH) : 0;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H_grid + (bom.length ? listPadTop + listH : 0) + 16;
    const ctx = cv.getContext('2d');
    // 白底
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // 填色 + 色号
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < pRows; r++) for (let c = 0; c < pCols; c++) {
      const num = pCells[r][c];
      const bead = num ? beadByNumber(num) : null;
      const hex = bead ? bead.hex : null;
      if (hex) {
        ctx.fillStyle = hex;
        ctx.fillRect(c * cp, r * cp, cp, cp);
      } else {
        ctx.fillStyle = gridThemeBg(r, c) || '#ffffff';
        ctx.fillRect(c * cp, r * cp, cp, cp);
      }
      if (pShowNumbers && num) {
        ctx.fillStyle = patternLuminance(hex) > 150 ? '#2a1f18' : '#ffffff';
        // 字号随色号长度自动缩放，保证 4 位色号在小格子里也完整显示
        const fs = Math.max(9, Math.min(Math.floor(cp * 0.52), Math.floor(cp * 1.6 / num.length)));
        ctx.font = `bold ${fs}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.fillText(num, c * cp + cp / 2, r * cp + cp / 2 + 0.5);
      }
    }
    // 细网格线（仅网格区内，不穿透清单）
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= pCols; c++) { ctx.beginPath(); ctx.moveTo(c * cp + 0.5, 0); ctx.lineTo(c * cp + 0.5, H_grid); ctx.stroke(); }
    for (let r = 0; r <= pRows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cp + 0.5); ctx.lineTo(W, r * cp + 0.5); ctx.stroke(); }
    // 每 5 格加粗分组边线，方便按区块数数
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.6;
    for (let c = 0; c <= pCols; c += 5) { ctx.beginPath(); ctx.moveTo(c * cp + 0.5, 0); ctx.lineTo(c * cp + 0.5, H_grid); ctx.stroke(); }
    for (let r = 0; r <= pRows; r += 5) { ctx.beginPath(); ctx.moveTo(0, r * cp + 0.5); ctx.lineTo(W, r * cp + 0.5); ctx.stroke(); }
    // ===== 用料清单（拼到图纸底部，生成的图纸自带清单） =====
    if (bom.length) {
      const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      let y = H_grid + listPadTop;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#3a2a1f';
      ctx.font = 'bold 16px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('用料清单（共 ' + bom.length + ' 色 · ' + total + ' 颗）', 8, y + 14);
      y += titleH;
      bom.forEach((x, i) => {
        const col = i % perRow, row = Math.floor(i / perRow);
        const x0 = 8 + col * (capW + gap);
        const y0 = y + row * (cellH + gap);
        // 色卡色块（圆角），色号印在框内
        ctx.fillStyle = x.hex;
        rr(x0, y0, capW, capH, 8); ctx.fill();
        const lack = Math.max(0, x.qty - x.stock);
        if (lack) { ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2; rr(x0 + 1, y0 + 1, capW - 2, capH - 2, 7); ctx.stroke(); }
        const light = patternLuminance(x.hex) > 150;
        ctx.fillStyle = light ? '#1a1a1a' : '#ffffff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(x.colorNumber, x0 + capW / 2, y0 + capH / 2);
        // 色块下方：数量
        ctx.fillStyle = '#1f1f1f';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = 'bold 18px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(String(x.qty), x0 + capW / 2, y0 + capH + blockGap + numH - 4);
      });
      const sy = y + rowsCount * (cellH + gap) + 6;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#555';
      ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('所需豆子数量：' + total, 8, sy + 14);
      ctx.fillText('图纸尺寸：' + pCols + ' × ' + pRows + '（共 ' + (pCols * pRows) + ' 格 · 已用 ' + total + ' 格）', 8, sy + 32);
    }
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `${safe}_${pCols}x${pRows}.png`;
    a.click();
    toast('已导出 PNG（含用料清单）', 'success');
  }
  function patternExportCSV() {
    const safe = patternSafeName(pName);
    const bom = patternBOM();
    if (!bom.length) return toast('还没有用料数据', 'warn');
    const rows = bom.map(x => ({ 色号: x.colorNumber, 颜色名称: x.colorName, 色值: x.hex, 数量: x.qty, 现有库存: x.stock }));
    downloadCsv(rows, `${safe}_用料清单_${pCols}x${pRows}.csv`);
    toast('已导出 CSV', 'success');
  }
  function patternCopyText() {
    const bom = patternBOM();
    if (!bom.length) return toast('还没有用料数据', 'warn');
    const total = bom.reduce((s, x) => s + x.qty, 0);
    const title = (pName || '拼豆图纸').trim() || '拼豆图纸';
    const lines = [title + ' · 用料清单 (' + pCols + '×' + pRows + ')', '共 ' + bom.length + ' 色，' + total + ' 颗豆', ''];
    bom.forEach(x => lines.push(x.colorNumber + ' ' + x.colorName + '  × ' + x.qty + '  (HEX ' + x.hex + ')'));
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('已复制文本', 'success'), () => copyTextFallback(text));
    } else copyTextFallback(text);
  }
  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制文本', 'success'); }
    catch (e) { toast('复制失败，请手动复制', 'error'); }
    ta.remove();
  }
  function patternSaveRecipe() {
    const bom = patternBOM();
    if (!bom.length) return toast('画布为空，无法保存', 'warn');
    pName = ($('#p-name').value || '').trim();
    const name = pName || ('拼豆图纸 ' + fmtTime(Date.now()));
    state.recipes.unshift({
      id: uid('rc'), name, createdAt: Date.now(),
      items: bom.map(x => ({ colorNumber: x.colorNumber, colorName: x.colorName, hex: x.hex, qty: x.qty })),
      grid: { cols: pCols, rows: pRows, cells: pCells.map(row => row.slice()) },
      source: 'pattern'
    });
    save();
    toast('已保存到配方库，可随时回来编辑', 'success');
  }
  function patternConsume() {
    const bom = patternBOM();
    if (!bom.length) return toast('画布为空', 'warn');
    const items = bom.map(x => ({ colorNumber: x.colorNumber, colorName: x.colorName, hex: x.hex, qty: x.qty }));
    openConsumeConfirm('图纸用料确认 · 扣减库存', items, '图纸生成');
  }
  // 通用“识别确认面板”：预扣预览 + 存为配方 + 确认扣减库存
  function openConsumeConfirm(title, items, sourceLabel) {
    const need = {};
    items.forEach(i => { need[i.colorNumber] = (need[i.colorNumber] || 0) + i.qty; });
    const rows = Object.keys(need).map(num => {
      const bead = beadByNumber(num);
      const req = need[num], have = bead ? bead.stock : 0, lack = Math.max(0, req - have);
      return `<tr class="border-t border-mk-sand/50">
        <td class="px-3 py-2"><span class="w-5 h-5 rounded-full swatch inline-block align-middle mr-1" style="background:${bead ? bead.hex : '#ccc'}"></span>${num} ${bead ? escapeHtml(bead.colorName) : '<span class="text-rose-400">库存无此色</span>'}</td>
        <td class="px-3 py-2 text-right">${req}</td>
        <td class="px-3 py-2 text-right">${have}</td>
        <td class="px-3 py-2 text-right font-bold ${lack ? 'text-rose-500' : 'text-emerald-600'}">${lack ? ('缺 ' + lack) : '充足'}</td>
      </tr>`;
    }).join('');
    const body = `
      <p class="text-sm text-mk-sub mb-2">确认后将从库存对应色号扣除以下用量（来源：${escapeHtml(sourceLabel || '图纸生成')}）。红色为库存不足，仍可扣减（库存会降到 0）。</p>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-mk-sand/40 text-mk-sub"><tr>
          <th class="px-3 py-2 text-left">色号</th><th class="px-3 py-2 text-right">需要</th><th class="px-3 py-2 text-right">现有</th><th class="px-3 py-2 text-right">差额</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    openModal(title, body, { wide: true });
    setModalFoot(`
      <button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">取消</button>
      <button id="cc-recipe" class="px-4 py-2 rounded-xl bg-mk-lav text-mk-ink font-semibold">存为配方</button>
      <button id="cc-confirm" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">确认扣减库存</button>`);
    $('#cc-recipe').onclick = () => {
      const name = '图纸配方 ' + fmtTime(Date.now());
      state.recipes.unshift({
        id: uid('rc'), name, createdAt: Date.now(),
        items: items.map(i => ({ colorNumber: i.colorNumber, colorName: i.colorName, hex: i.hex, qty: i.qty })),
        source: 'consume'
      });
      save(); closeModal(); switchView('recipes'); toast('已存为配方', 'success');
    };
    $('#cc-confirm').onclick = () => {
      let ok = 0, skip = 0;
      items.forEach(i => {
        const bead = beadByNumber(i.colorNumber);
        if (!bead) { skip++; return; }
        bead.stock = Math.max(0, bead.stock - i.qty);
        addLog('图纸消耗', bead, -i.qty, sourceLabel || '图纸生成');
        ok++;
      });
      save(); closeModal(); switchView('dashboard');
      toast(`已扣减 ${ok} 种颜色${skip ? `，跳过 ${skip} 种未匹配` : ''}`, 'success');
    };
  }
  // 从配方库载入图纸到编辑器（再次编辑 / 复用）
  function editPatternFromRecipe(id) {
    const rc = state.recipes.find(r => r.id === id);
    if (!rc || !rc.grid) return toast('该配方不含图纸网格', 'warn');
    pCols = rc.grid.cols; pRows = rc.grid.rows;
    pCells = rc.grid.cells.map(row => row.slice());
    pName = rc.name || '';
    pMode = 'blank'; pColor = null; pImage = null; pHighlight = null;
    switchView('pattern');
    toast('已载入图纸到编辑器', 'success');
  }

  /* ===================== 18. 启动 ===================== */
  if (supabase) {
    // 启动时若已有会话（同一浏览器之前登录过），自动恢复登录态并拉取云端数据
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { currentUser = data.session.user; syncPull(); }
      renderHeaderUser();
    }).catch(() => {});
    // 监听 auth 状态变化：登录/登出/密码重置
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') { currentUser = session.user; renderHeaderUser(); }
      if (event === 'SIGNED_OUT') { currentUser = null; renderHeaderUser(); }
      if (event === 'PASSWORD_RECOVERY') { openPasswordResetModal(); }
    });
  }
  renderNav();
  switchView('dashboard');
  // 把弹窗相关函数暴露到 window，让 inline onclick（如 `onclick="closeModal()"`）能正常执行
  // （整个 app.js 是 IIFE 闭包，原来在闭包内的函数外部访问不到）
  window.closeModal = closeModal;
  window.openModal = openModal;
  window.setModalFoot = setModalFoot;
})();
