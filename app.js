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
      // 补货管理：仪表盘「添加到补货清单」或手动新增的补货记录（未入库/已入库）
      restockRecords: [],
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
        replenishThreshold: 100,
        // 补货清单导出列预设：数组即输出顺序，仅列出的列会导出；默认全选
        restockExportCols: ['record', 'colorNumber', 'portions', 'perQty', 'beads'],
        // 图库图片是否同步备份到 Supabase Storage（需配置存储桶 + RLS），默认关闭
        backupImages: false
      }
    };
  }

  /* ===================== 2.0 图片 IndexedDB 存储（大体积图片不进 localStorage） ===================== */
  // 图库原图体积大，直接塞进 localStorage 极易触顶（约 5MB）。改为：
  // - localStorage 只存图库元数据 + imageId 引用（imageStored 标记已入库）；
  // - 图片 dataURL 本体存在浏览器 IndexedDB（按设备/域名隔离，配额数百 MB~GB）；
  // - 可选：把图片同步到 Supabase Storage 做云端备份（设置开关控制）。
  const IMG_DB_NAME = 'pindou_images';
  const IMG_DB_VERSION = 1;
  const IMG_STORE = 'images';
  let _imgDBPromise = null;
  function openImgDB() {
    if (_imgDBPromise) return _imgDBPromise;
    _imgDBPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('当前浏览器不支持 IndexedDB')); return; }
      const req = indexedDB.open(IMG_DB_NAME, IMG_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
    return _imgDBPromise;
  }
  async function imgDBPut(id, dataURL) {
    const db = await openImgDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, 'readwrite');
      tx.objectStore(IMG_STORE).put({ id, data: dataURL });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function imgDBGet(id) {
    const db = await openImgDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, 'readonly');
      const rq = tx.objectStore(IMG_STORE).get(id);
      rq.onsuccess = () => resolve(rq.result ? rq.result.data : null);
      rq.onerror = () => reject(rq.error);
    });
  }
  async function imgDBDel(id) {
    const db = await openImgDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMG_STORE, 'readwrite');
      tx.objectStore(IMG_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // 序列化用于落盘/上传的 state：图库大图已从 localStorage 剥离（只保留 imageId + imageStored 引用）。
  // 未成功入库（imageStored=false）的图片仍保留在 localStorage 作为兜底，避免丢图。
  function serializeState() {
    const out = Object.assign({}, state);
    out.gallery = (state.gallery || []).map(g => {
      if (!g || !g.imageId || !g.imageStored) return g; // 未入库图片仍保留在 localStorage 兜底
      const c = Object.assign({}, g);
      delete c.image;
      return c;
    });
    return JSON.stringify(out);
  }
  // 把图库图片落盘：优先 IndexedDB；若开启云端备份则同步到 Supabase Storage。
  // 成功后置 imageStored=true（save 时即从 localStorage 剥离该图片），失败则保留 localStorage 兜底。
  async function persistGalleryImage(g) {
    if (!g || !g.imageId || !g.image) return;
    let ok = false;
    try { await imgDBPut(g.imageId, g.image); ok = true; }
    catch (e) { console.warn('图片写入 IndexedDB 失败，回退到 localStorage', g.imageId, e); }
    if (ok && state.settings.backupImages) {
      try { await backupImageToCloud(g.imageId, g.image); }
      catch (e) { console.warn('图片云端备份失败（已存本地）', g.imageId, e); }
    }
    g.imageStored = ok;
    save();
  }
  // 启动时把旧数据（图片直接内嵌在 state）迁移到 IndexedDB
  async function migrateLegacyGalleryImages() {
    const legacy = (state.gallery || []).filter(g => g && g.image && !g.imageId);
    if (legacy.length) {
      for (const g of legacy) {
        g.imageId = g.id;
        await persistGalleryImage(g); // 写入 IDB 并摘掉 localStorage 中的大图
      }
      toast('已把 ' + legacy.length + ' 张图纸图片转入本地 IndexedDB（更大容量，无需压缩）', 'success', 4000);
    }
    await hydrateGalleryImages();
  }
  // 从 IndexedDB（必要时云端）取回图片填回内存，供页面渲染
  async function hydrateGalleryImages() {
    const need = (state.gallery || []).filter(g => g && g.imageId && !g.image);
    if (!need.length) return;
    for (const g of need) {
      let data = null;
      try { data = await imgDBGet(g.imageId); } catch (e) { console.warn('IDB 读取失败', g.imageId, e); }
      if (!data && state.settings.backupImages) { try { data = await fetchImageFromCloud(g.imageId); } catch (e) {} }
      if (data) g.image = data;
    }
    if (['gallery', 'settings', 'recognize'].indexOf(currentView) !== -1) {
      if (currentView === 'gallery') renderGallery($('#view'));
      else if (currentView === 'settings') renderSettings($('#view'));
      else if (currentView === 'recognize') renderRecognize($('#view'));
    }
  }
  // 把尚未入库（仍是内联 base64）的图库图片写入 IndexedDB，并从内存/落盘数据剥离。
  // 返回成功迁移的张数。供 save() 容量不足自动兜底与设置页手动按钮共用。
  async function migrateUnsavedGalleryImages() {
    const need = (state.gallery || []).filter(g => g && g.image && !g.imageStored);
    if (!need.length) return 0;
    let ok = 0;
    for (const g of need) {
      try {
        g.imageId = g.imageId || g.id;
        await imgDBPut(g.imageId, g.image);
        g.imageStored = true;
        delete g.image;
        ok++;
      } catch (e) { console.warn('迁移图片失败', g.id, e); }
    }
    return ok;
  }
  // 容量不足且无法自动迁移时的弹窗
  function showQuotaModal(approxKB) {
    openModal('本地存储空间不足', `
      <div class="space-y-3 text-sm">
        <p>当前数据约 <strong>${approxKB}KB</strong>，已超过浏览器 localStorage 容量上限。</p>
        <p>图库原图现默认存于浏览器 IndexedDB（容量大得多），通常不会触顶。若仍不足，多为其他数据异常，可：</p>
        <ul class="list-disc pl-5 space-y-1 text-mk-sub">
          <li>导出备份后，恢复默认数据再导入</li>
          <li>检查是否有损坏的大字段</li>
        </ul>
      </div>`);
    setModalFoot(`
      <button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="document.getElementById('modal-root').innerHTML=''">稍后再说</button>
      <button id="save-fail-go-settings" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold">去设置查看</button>`);
    $('#save-fail-go-settings').onclick = () => { closeModal(); switchView('settings'); };
  }

  /* ===================== 2. 存储与会话状态 ===================== */
  let state = load();
  migrateLegacyGalleryImages();
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

      // 迁移：旧版 restockRecords 为扁平结构（每条记录直接带 colorNumber/portions/perQty），
      // 新版改为「补货记录 → 多个色号清单项(items)」层级。旧数据自动包裹成一条清单项并命名「补货记录N」。
      // （注意：load() 在 uid 常量定义之前执行，这里不能调用 uid，必须内联生成 id）
      if (Array.isArray(merged.restockRecords)) {
        const looksOld = merged.restockRecords.length && merged.restockRecords[0] &&
          merged.restockRecords[0].colorNumber !== undefined && !Array.isArray(merged.restockRecords[0].items);
        if (looksOld) {
          merged.restockRecords = merged.restockRecords.map((r, i) => ({
            id: r.id || ('rs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            name: '补货记录' + (i + 1),
            status: r.status || 'pending',
            createdAt: r.createdAt || Date.now(),
            updatedAt: r.updatedAt || Date.now(),
            stockedAt: r.stockedAt || null,
            items: [{
              id: 'ri_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              colorNumber: r.colorNumber || '',
              portions: r.portions || 1,
              perQty: r.perQty || 1000,
              note: r.note || ''
            }]
          }));
        }
      }

      // 迁移：补货记录补充 defaultPerQty（默认每份颗数）字段
      if (Array.isArray(merged.restockRecords)) {
        merged.restockRecords.forEach(r => { if (r && r.defaultPerQty === undefined) r.defaultPerQty = DEFAULT_RESTOCK_PER_QTY; });
      }

      // 迁移：图库图片补充 legend 字段（旧数据没有该字段，缺省为 null 表示尚未识别图例）
      if (Array.isArray(merged.gallery)) {
        merged.gallery.forEach(g => { if (g && g.legend === undefined) g.legend = null; });
      }

      return merged;
    } catch (e) {
      console.warn('读取本地数据失败，使用默认数据', e);
      return defaultState();
    }
  }
  function save() {
    let str;
    try { str = serializeState(); }
    catch (e) { str = JSON.stringify(state); } // 极端兜底
    try {
      localStorage.setItem(STORAGE_KEY, str);
    } catch (e) {
      const isQuota = e && (e.name === 'QuotaExceededError' || /quota|exceeded|storage/i.test(e.message));
      const approxKB = Math.round(str.length / 1024);
      if (isQuota) {
        // 自动把未入库图片搬入 IndexedDB，成功则剥离后重试保存
        migrateUnsavedGalleryImages().then((migrated) => {
          if (migrated) {
            try {
              save();
              toast('已自动把 ' + migrated + ' 张图纸图片转入 IndexedDB，保存成功', 'success', 3500);
            } catch (e2) { showQuotaModal(approxKB); }
          } else {
            showQuotaModal(approxKB);
          }
        });
      } else {
        toast('保存失败：' + e.message, 'error', 6000);
      }
      console.error('save failed', e, 'state approx', approxKB + 'KB');
      return;
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
      .upsert({ user_id: currentUser.id, data: JSON.parse(serializeState()), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
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
      await hydrateGalleryImages(); // 云端 state 不含图片，需从 IndexedDB/云端取回
      try { localStorage.setItem(STORAGE_KEY, serializeState()); } catch (e) {}
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
  // 图库图片云端备份（Supabase Storage，可选）
  const IMG_BUCKET = 'gallery-images';
  function dataURLtoBlob(dataURL) {
    const parts = String(dataURL).split(',');
    const mime = (parts[0].match(/:(.*?);/) || [, 'image/jpeg'])[1];
    const bin = atob(parts[1] || '');
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  async function backupImageToCloud(imageId, dataURL) {
    if (!supabase || !currentUser || !state.settings.backupImages) return;
    try {
      const blob = dataURLtoBlob(dataURL);
      const path = currentUser.id + '/' + imageId + '.jpg';
      const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) console.warn('云端备份图片失败', imageId, error.message);
    } catch (e) { console.warn('云端备份图片异常', imageId, e); }
  }
  async function fetchImageFromCloud(imageId) {
    if (!supabase || !currentUser) return null;
    try {
      const path = currentUser.id + '/' + imageId + '.jpg';
      const { data, error } = await supabase.storage.from(IMG_BUCKET).download(path);
      if (error || !data) return null;
      return await blobToDataURL(data);
    } catch (e) { return null; }
  }
  async function deleteImageFromCloud(imageId) {
    if (!supabase || !currentUser) return;
    try {
      const path = currentUser.id + '/' + imageId + '.jpg';
      await supabase.storage.from(IMG_BUCKET).remove([path]);
    } catch (e) { console.warn('云端删除图片失败', imageId, e); }
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
          <div class="flex items-center justify-between flex-wrap gap-2 px-5 py-4 border-b border-mk-sand">
            <h3 class="font-bold text-lg">${escapeHtml(title)}</h3>
            <button class="text-mk-sub hover:text-mk-ink text-xl leading-none" id="modal-close">×</button>
          </div>
          <div class="p-4 sm:p-5 overflow-auto" id="modal-body">${bodyHtml}</div>
          <div class="px-5 py-3 border-t border-mk-sand flex flex-wrap justify-end gap-2" id="modal-foot"></div>
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
    function extractJsonContent(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    // 第1层：去掉首尾所有 markdown 标记（含嵌套/重复）
    s = s.replace(/```\w*\n?/g, '').replace(/\x60{3}/g, '');
    // 第2层：直接尝试
    try { const j = JSON.parse(s); return JSON.stringify(j); } catch(e) {}
    // 第3层：去首尾非JSON字符
    const m1 = s.match(/\[[\s\S]*\]/);
    if (m1) { try { JSON.parse(m1[0]); return m1[0]; } catch(e) {} }
    const m2 = s.match(/\{[\s\S]*\}/);
    if (m2) { try { JSON.parse(m2[0]); return m2[0]; } catch(e) {} }
    // 第4层：逐行扫描找JSON行或数组行
    for (const line of s.split('\n')) {
      const l = line.trim().replace(/^\x60+|\x60+$/g, '');
      if (!l) continue;
      if (l.startsWith('[') && l.endsWith(']')) { try { JSON.parse(l); return l; } catch(e) {} }
      if (l.startsWith('{') && l.endsWith('}')) { try { JSON.parse(l); return l; } catch(e) {} }
    }
    // 第5层：提取第一个 [ 到最后一个 ] 的内容
    const si = s.indexOf('['), ei = s.lastIndexOf(']');
    if (si >= 0 && ei > si) {
      const sub = s.substring(si, ei + 1);
      try { JSON.parse(sub); return sub; } catch(e) {}
    }
    // 第6层：提取第一个 { 到最后一个 } 的内容  
    const ci = s.indexOf('{'), cei = s.lastIndexOf('}');
    if (ci >= 0 && cei > ci) {
      const sub = s.substring(ci, cei + 1);
      try { JSON.parse(sub); return sub; } catch(e) {}
    }
    console.warn('[extractJson] 全部fallback失败，原始长度:', s.length, '前100字:', s.slice(0, 100));
    return '';
  }
  // 把视觉模型返回的文本解析为 JS 对象/数组。
  // 注意：extractJsonContent 只负责取出 JSON 字符串，这里再 JSON.parse，
  // 确保 callVLM 返回的是对象/数组而非字符串——否则调用方（callLegendVisionAPI 等）
  // 用 Array.isArray(字符串) 会恒为 false、字符串.colors 为 undefined，导致永远识别 0 个色块。
  function parseVLMContent(raw) {
    const s = extractJsonContent(raw);
    if (!s) throw new Error('视觉模型未返回可识别的内容');
    try { return JSON.parse(s); } catch (e) { throw new Error('视觉模型返回内容无法解析为 JSON'); }
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
      return parseVLMContent(content);
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
    return parseVLMContent(content);
  }
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
    const prompt = `你正在看一张拼豆(Perler/Hama)图纸的「颜色图例」区域：它是由若干纯色填充的圆角矩形色块组成的矩阵，可能是 1 行，也可能是 2~5 行的多行排列。

每个色块的固定结构是：
- 色块【内部】印有一行短码（如 "W123"、"R05"、"C25"），那是该颜色的「色号名称」。
- 色块【正下方】另有一行数字，那是该颜色的「数量」（例如 12 表示需要 12 颗），不是色号。

任务：识别图例区域内所有「颜色色块」，按阅读顺序（从左到右、从上到下，即先第一行从左到右，再第二行从左到右，以此类推）逐一列出。

严格要求（务必遵守）：
1. 只识别纯色填充的「色块」本身，忽略白色间隔、黑色网格线、边框、表头文字、以及色块外的文字说明。
2. hex 取该色块中心的「主体填充色」，不要取文字颜色、边框颜色或阴影。如果某一行没有彩色色块（例如全是白色/浅灰背景、表头文字行），不要输出它。
3. code 只取「色块内部印的色号短码」。绝对不要把色块【下方】的数量数字当成 code。看不清或没印字就填空字符串 ""，不要猜测或编造。尤其不要把无意义的英文单词（如 "no"、"yes"、"all"）填到 code 里。
4. count 取「色块正下方印的数量数字」（整数，如 12）；若下方没有数字就填 0。
5. 不要合并相近颜色——只要肉眼可区分的不同色块，就分别列出（含深浅不同的同色系）。
6. 图片中可能还混有图纸网格、行号、水印、表头文字（如 "色号 名称 数量"）等无关内容，请全部忽略；只识别彩色圆角矩形色块。
7. 每个色块只输出一条记录，不要重复、不要遗漏。如果图例中有 16 个色块，就必须返回 16 条；有 20 个就返回 20 条。
8. 只返回一个 JSON，不要任何额外文字或 Markdown。你可以直接返回 JSON 数组，也可以返回 {"colors": [...]} 对象。

返回格式（示例）：
[{"hex":"#FFD700","code":"Y8","count":12},{"hex":"#A52A2A","code":"BR3","count":3}]`;
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
  // 分组模式：把相邻 2~3 个色块一起发给模型，保留左右上下文，显著降低"A11↔A17"等孤立误读。
  async function callGroupLegendVisionAPI(dataUrl, apiKey, model, baseUrl, groupSize) {
    const prompt = `这张图是从拼豆图纸颜色图例中裁剪出来的「连续 ${groupSize} 个色块」，它们从左到右依次排列。

结构说明：每个色块【内部】印有一行短码（如 "A11"、"C25"），那是「色号名称」；每个色块【正下方】另有一行数字（如 12），那是「数量」（需要几颗），不是色号。

任务：从左到右依次识别这 ${groupSize} 个色块，返回一个 JSON 数组，数组长度必须严格等于 ${groupSize}。

严格要求：
1. 数组元素顺序必须对应图中从左到右的色块顺序，不要遗漏、不要重复。
2. 每个元素包含 hex、code、count 三个字段。
3. hex 取该色块中心的「主体填充色」，不要取文字颜色、边框或阴影。
4. code 只取「色块内部印的色号短码」（如 "A11"、"C25"）。绝对不要把色块【下方】的数量数字当成 code。看不清或没印字就填空字符串 ""，不要猜测编造。
5. count 取「该色块正下方印的数量数字」（整数，如 12）；若下方没有数字就填 0。
6. 只返回一个 JSON 数组，不要任何额外文字或 Markdown：
[{"hex":"#RRGGBB","code":"A11","count":12},{"hex":"#RRGGBB","code":"C25","count":5},...]`;
    const parsed = await callVLM(dataUrl, apiKey, model, prompt, baseUrl);
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.colors) ? parsed.colors : []);
    return arr.map(normalizeLegendItem).filter(c => /^#?[0-9a-fA-F]{6}$/.test(c.hex) || /^#[0-9a-fA-F]{3}$/.test(c.hex));
  }
  // 数量补全模式：只读每个色块正下方的数字，返回整数数组。
  // 用于首轮回合漏读 count（尤其是边缘/尾部的色块）时做二次聚焦识别。
  async function callLegendCountAPI(dataUrl, apiKey, model, baseUrl, expectedCount) {
    expectedCount = Math.max(1, expectedCount | 0);
    const prompt = `你正在看一张拼豆(Perler/Hama)图纸的颜色图例区域。图中是一排彩色填充的圆角矩形色块，每个色块【正下方】印有一个整数数字，表示该颜色需要的豆子数量。

任务：按从左到右的顺序，逐个读出每个色块正下方的整数数字，返回一个 JSON 数组。数组长度必须严格等于 ${expectedCount}。
如果某个色块下方确实没有数字，该位置填 0。

严格要求：
1. 只读色块【正下方】的纯数字，不要读色块内部的色号文字。
2. 不要跳过任何色块，尤其是最左边和最右边的边缘色块，必须全部读出。
3. 只返回 JSON 数组，不要任何额外文字、Markdown 或解释。

示例（假设 5 个色块）：
[12, 0, 38, 205, 17]`;
    const parsed = await callVLM(dataUrl, apiKey, model, prompt, baseUrl);
    if (Array.isArray(parsed)) return parsed.map(v => parseInt(v, 10) || 0);
    if (parsed && Array.isArray(parsed.counts)) return parsed.counts.map(v => parseInt(v, 10) || 0);
    if (parsed && Array.isArray(parsed.colors)) return parsed.colors.map(c => parseInt(c.count, 10) || 0);
    return [];
  }
  // 将归一化区域裁剪为独立图片 dataURL（用于把图例区域单独发给视觉模型）
  function cropRegionToDataURL(img, region) {
    const { canvas, w, h } = createAnalysisCanvas(img, 2400);
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
    const { canvas, w, h } = createAnalysisCanvas(img, 2400);
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

  // 在 region 内部精修图例条带：保留色块主体 + 下方数量，支持两行图例。
  // 返回归一化 region，失败时返回原 region。
  function refineLegendRegion(img, region) {
    const { canvas, w, h, ctx } = createAnalysisCanvas(img, 2400);
    const x0 = Math.max(0, Math.round(region.x * w));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const rw = Math.max(1, x1 - x0), rh = Math.max(1, y1 - y0);
    if (rw < 20 || rh < 10) return region;
    const data = ctx.getImageData(x0, y0, rw, rh).data;
    function isBg(r, g, b) { return r > 245 && g > 245 && b > 245; }
    function isText(r, g, b) { return r < 45 && g < 45 && b < 45; }
    // 放宽灰色判定：避免把浅肤色/浅灰等浅色块边缘误过滤
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 18 && mx > 90 && mx < 220; }
    // 过滤表头/分隔行的低饱和浅色背景
    function isPaleBg(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 235 && mx - mn < 30; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b) && !isPaleBg(r, g, b); }

    const rowInfos = [];
    for (let y = 0; y < rh; y++) {
      let goodCount = 0;
      const segments = [];
      let inSeg = false, segStart = 0;
      for (let x = 0; x < rw; x++) {
        const i = (y * rw + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const ok = goodPx(r, g, b);
        if (ok) {
          goodCount++;
          if (!inSeg) { inSeg = true; segStart = x; }
        } else {
          if (inSeg) { if (x - segStart >= 2) segments.push({ x0: segStart, x1: x }); inSeg = false; }
        }
      }
      if (inSeg && rw - segStart >= 2) segments.push({ x0: segStart, x1: rw });
      const ratio = goodCount / rw;
      const segScore = Math.min(segments.length, 12) * 0.05;
      const multiSegBonus = segments.length >= 3 ? 0.15 : 0;
      rowInfos[y] = { ratio, score: ratio + segScore + multiSegBonus, segments };
    }
    let bestY = 0, bestScore = 0;
    for (let y = 0; y < rh; y++) if (rowInfos[y].score > bestScore) { bestScore = rowInfos[y].score; bestY = y; }
    if (bestScore < 0.04) return region;

    // 向上下扩展时允许单行空白，适配两行之间的分隔行
    let coreY0 = bestY, coreY1 = bestY;
    let blankStreak = 0;
    while (coreY0 > 0) {
      const r = rowInfos[coreY0 - 1];
      if (r.segments.length >= 2 || r.ratio > 0.12) { coreY0--; blankStreak = 0; }
      else if (blankStreak < 2) { coreY0--; blankStreak++; }
      else break;
    }
    blankStreak = 0;
    while (coreY1 < rh - 1) {
      const r = rowInfos[coreY1 + 1];
      if (r.segments.length >= 2 || r.ratio > 0.12) { coreY1++; blankStreak = 0; }
      else if (blankStreak < 2) { coreY1++; blankStreak++; }
      else break;
    }
    const coreH = coreY1 - coreY0 + 1;
    if (coreH < 4) return region;

    // x 方向主彩色带
    const gapThresh = Math.max(3, Math.round(rw * 0.004));
    const runs = [];
    let run = null;
    for (let x = 0; x < rw; x++) {
      let cnt = 0;
      for (let y = coreY0; y <= coreY1; y++) {
        const i = (y * rw + x) * 4;
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
    const minBlockW = Math.max(4, Math.round(rw * 0.006));
    const validRuns = runs.filter(r => r.x1 - r.x0 + 1 >= minBlockW);
    if (!validRuns.length) return region;
    // 取所有有效段的并集作为图例主体宽度，避免只保留最长段而切掉左右边缘色块
    const firstX = validRuns[0].x0;
    const lastX = validRuns[validRuns.length - 1].x1;
    const stripW = lastX - firstX + 1;
    const originalW = x1 - x0;
    if (stripW < originalW * 0.3) return region;
    if (stripW < originalW * 0.6) {
      console.debug('[refineLegendRegion] 精修后宽度缩水 %.1f%%，回退到原区域', (stripW / originalW) * 100);
      return region;
    }

    const topMargin = Math.max(2, Math.round(coreH * 0.12));
    // 两行图例时，下方需要足够空间容纳第二行色块及其数量数字；
    // 单行时多留余量，避免把色块正下方的数量数字切掉。
    const bottomMargin = Math.max(Math.round(coreH * (coreH > rh * 0.35 ? 1.0 : 2.4)), 28);
    const rx0 = x0 + firstX;
    const rx1 = x0 + lastX;
    const ry0 = Math.max(0, y0 + coreY0 - topMargin);
    const ry1 = Math.min(h - 1, Math.max(y0 + coreY1 + 1, y0 + coreY1 + bottomMargin));
    return { x: rx0 / w, y: ry0 / h, w: (rx1 - rx0 + 1) / w, h: (ry1 - ry0 + 1) / h };
  }

  // 在 region 内部按饱和度能量峰估算图例色块列数（用户无需手动填写）。
  function estimateLegendCols(img, region) {
    const { canvas, w, h, ctx } = createAnalysisCanvas(img, 2400);
    const x0 = Math.max(0, Math.round(region.x * w));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const rw = Math.max(1, x1 - x0), rh = Math.max(1, y1 - y0);
    if (rw < 20 || rh < 4) return 0;
    const data = ctx.getImageData(x0, y0, rw, rh).data;
    function isBg(r, g, b) { return r > 248 && g > 248 && b > 248; }
    function isText(r, g, b) { return r < 40 && g < 40 && b < 40; }
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 25 && mx > 50 && mx < 235; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b); }

    const energy = new Array(rw).fill(0);
    for (let x = 0; x < rw; x++) {
      let sum = 0, cnt = 0;
      for (let y = 0; y < rh; y++) {
        const i = (y * rw + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (goodPx(r, g, b)) { sum += Math.max(r, g, b) - Math.min(r, g, b); cnt++; }
      }
      energy[x] = cnt ? sum / cnt : 0;
    }
    const smooth = energy.map((v, i) => {
      let s = 0, n = 0;
      for (let d = -2; d <= 2; d++) if (energy[i + d] !== undefined) { s += energy[i + d]; n++; }
      return s / n;
    });
    const peaks = [];
    for (let x = 3; x < rw - 3; x++) {
      if (smooth[x] > smooth[x - 1] && smooth[x] > smooth[x + 1] && smooth[x] > 5) peaks.push(x);
    }
    const mergeDist = Math.max(4, Math.round(rw * 0.015));
    const groups = [];
    for (const p of peaks) {
      const last = groups[groups.length - 1];
      if (last && p - last[last.length - 1] < mergeDist) last.push(p);
      else groups.push([p]);
    }
    let cols = groups.length;
    if (cols < 2) cols = Math.max(2, Math.round(rw / 30));
    if (cols > 80) cols = 80;
    return cols;
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
  // 在图例区域内用饱和度能量峰检测每个色块的中心与左右边界，返回 [{x0,x1,center}]（像素坐标，相对 region 内部）
  function detectLegendBlocks(img, region) {
    const { canvas, w, h, ctx } = createAnalysisCanvas(img, 2400);
    const x0 = Math.max(0, Math.round(region.x * w));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const rw = Math.max(1, x1 - x0), rh = Math.max(1, y1 - y0);
    if (rw < 20 || rh < 4) return [];
    const data = ctx.getImageData(x0, y0, rw, rh).data;
    function isBg(r, g, b) { return r > 248 && g > 248 && b > 248; }
    function isText(r, g, b) { return r < 40 && g < 40 && b < 40; }
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 25 && mx > 50 && mx < 235; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b); }

    // 1) 找到色块主体行（y 方向彩色饱和度能量最大）
    let bestY = 0, bestEnergy = 0;
    for (let y = 0; y < rh; y++) {
      let e = 0;
      for (let x = 0; x < rw; x++) {
        const i = (y * rw + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (goodPx(r, g, b)) e += Math.max(r, g, b) - Math.min(r, g, b);
      }
      if (e > bestEnergy) { bestEnergy = e; bestY = y; }
    }
    const coreHalfH = Math.max(2, Math.floor(rh * 0.18));
    const ys = Math.max(0, bestY - coreHalfH), ye = Math.min(rh - 1, bestY + coreHalfH);

    // 2) 在主体行附近做 x 方向饱和度能量
    const energy = new Array(rw).fill(0);
    for (let x = 0; x < rw; x++) {
      let sum = 0, cnt = 0;
      for (let y = ys; y <= ye; y++) {
        const i = (y * rw + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (goodPx(r, g, b)) { sum += Math.max(r, g, b) - Math.min(r, g, b); cnt++; }
      }
      energy[x] = cnt ? sum / cnt : 0;
    }
    const smooth = energy.map((v, i) => {
      let s = 0, n = 0;
      for (let d = -2; d <= 2; d++) if (energy[i + d] !== undefined) { s += energy[i + d]; n++; }
      return s / n;
    });

    // 3) 找饱和度峰（每个峰对应一个色块中心）
    const peaks = [];
    for (let x = 3; x < rw - 3; x++) {
      if (smooth[x] > smooth[x - 1] && smooth[x] > smooth[x + 1] && smooth[x] > 6) peaks.push(x);
    }
    const mergeDist = Math.max(3, Math.round(rw * 0.008));
    const groups = [];
    for (const p of peaks) {
      const last = groups[groups.length - 1];
      if (last && p - last[last.length - 1] < mergeDist) last.push(p);
      else groups.push([p]);
    }
    if (groups.length < 2) return [];

    // 4) 根据相邻峰中心取中点作为每个色块的左右边界
    let centers = groups.map(g => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
    // 过滤末尾异常远的噪声中心（如文字/空白被误当成色块），避免后续分组/识别引入垃圾
    if (centers.length > 3) {
      const gaps = [];
      for (let i = 1; i < centers.length; i++) gaps.push(centers[i] - centers[i - 1]);
      const med = medianOf(gaps);
      const cutoff = Math.max(med * 2.5, med + 60);
      let keep = centers.length;
      for (let i = gaps.length - 1; i >= 0; i--) {
        if (gaps[i] > cutoff) keep = i + 1;
        else break;
      }
      if (keep < centers.length) centers = centers.slice(0, keep);
    }
    const blocks = [];
    for (let i = 0; i < centers.length; i++) {
      const left = i === 0 ? 0 : Math.round((centers[i - 1] + centers[i]) / 2);
      const right = i === centers.length - 1 ? rw - 1 : Math.round((centers[i] + centers[i + 1]) / 2);
      blocks.push({ x0: left, x1: right, center: centers[i] });
    }
    return blocks;
  }
  // 把图例区域内一个色块边界（像素坐标，相对 region 内部）裁剪为独立小图
  function cropBlockToDataURL(img, region, bx0, bx1) {
    const { canvas, w, h } = createAnalysisCanvas(img, 2400);
    const x0 = Math.max(0, Math.round(region.x * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    // 在边界内缩 5%，避免混入相邻色块边缘/分隔线；保底 1px
    const pad = Math.max(1, Math.round((bx1 - bx0) * 0.05));
    const cx0 = Math.min(x1 - 1, x0 + bx0 + pad);
    const cx1 = Math.max(cx0 + 1, x0 + bx1 - pad);
    const cy0 = y0;
    const cy1 = y1;
    const cw = Math.max(1, cx1 - cx0), ch = Math.max(1, cy1 - cy0);
    const upscale = Math.max(1, Math.ceil(700 / Math.min(cw, ch)));
    const c = document.createElement('canvas');
    c.width = Math.min(cw * upscale, 1600);
    c.height = Math.min(ch * upscale, 1600);
    c.getContext('2d').drawImage(canvas, cx0, cy0, cw, ch, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  }
  // 把图例区域中连续多个色块（blocks[start..end]）一起裁剪为一张图，
  // 保留相邻色块上下文，帮助模型纠正单个小图中的色号误读（如 A11↔A17）。
  function cropGroupToDataURL(img, region, blocks, start, end) {
    const { canvas, w, h } = createAnalysisCanvas(img, 2400);
    const x0 = Math.max(0, Math.round(region.x * w));
    const y0 = Math.max(0, Math.round(region.y * h));
    const x1 = Math.min(w, Math.round((region.x + region.w) * w));
    const y1 = Math.min(h, Math.round((region.y + region.h) * h));
    const bx0 = blocks[start].x0;
    const bx1 = blocks[end].x1;
    // 在组合边界内缩 2%，避免混入相邻块边缘/分隔线
    const pad = Math.max(1, Math.round((bx1 - bx0) * 0.02));
    const cx0 = Math.min(x1 - 1, x0 + bx0 + pad);
    const cx1 = Math.max(cx0 + 1, x0 + bx1 - pad);
    const cy0 = y0;
    const cy1 = y1;
    const cw = Math.max(1, cx1 - cx0), ch = Math.max(1, cy1 - cy0);
    const upscale = Math.max(1, Math.ceil(900 / Math.min(cw, ch)));
    const c = document.createElement('canvas');
    c.width = Math.min(cw * upscale, 2000);
    c.height = Math.min(ch * upscale, 2000);
    c.getContext('2d').drawImage(canvas, cx0, cy0, cw, ch, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  }
  // 用视觉大模型识别图例：先精修区域，再用饱和度能量峰定位每个色块，
  // 按实际色块边界裁剪成单个小图并发识别；失败则退回整张图例识别。
  async function aiParseLegend(img, region, baseUrl, opts = {}) {
    const refined = refineLegendRegion(img, region);
    const blocks = detectLegendBlocks(img, refined);
    const imgH = img.naturalHeight || img.height || 1;
    const regionPixelH = (region.h || 0) * imgH;
    const likelyTwoRow = !!opts.likelyTwoRow;
    // 只有「用户上传的本身就是裁剪后的图例条带」才走快速路径：
    // 图片整体高度 < 200 且图例区域高度 < 150。避免整张图纸被误判为条带。
    const isCroppedStrip = imgH < 200 && regionPixelH > 10 && regionPixelH < 150;
    console.debug('[图例识别] regionPixelH=%d, isCroppedStrip=%s, likelyTwoRow=%s, refined=%o, blocks=%d',
      regionPixelH, isCroppedStrip, likelyTwoRow, refined, blocks.length);
    const wholeDataUrl = cropRegionToDataURL(img, refined);
    // 快速路径：如果用户上传的是「已经裁好的图例条带」（区域高度 < 150px 原图像素），
    // 直接整张发给视觉模型，跳过容易过切的色块切分。
    if (isCroppedStrip && wholeDataUrl && wholeDataUrl.length >= 500) {
      try {
        const raw = await callLegendVisionAPI(wholeDataUrl, state.settings.apiKey, state.settings.model, baseUrl);
        console.debug('[图例识别] 裁剪条带整张识别返回 %d 条', raw.length);
        if (raw && raw.length >= 2) return buildLegendFromColors(raw, raw.length);
      } catch (e) { console.warn('裁剪图例条带整张识别失败：', e.message); }
    }
    // 第一路径：整张图例识别。经过 refine 后区域只保留色块条带 + 数量，
    // 完整上下文让模型更不容易把 A11 误读成 A17，也不易遗漏边缘色块。
    // 对疑似两行图例，强制优先整张识别（分组路径容易跨行混乱）。
    if (wholeDataUrl && wholeDataUrl.length >= 500) {
      try {
        const wholeRaw = await callLegendVisionAPI(wholeDataUrl, state.settings.apiKey, state.settings.model, baseUrl);
        console.debug('[图例识别] 整张识别返回 %d 条', wholeRaw.length);
        // 当色块切分明显过切（如 >2 倍整张识别结果）时，直接采信整张识别，避免被错误 blocks 拖下水。
        const suspiciousBlocks = blocks.length > 0 && blocks.length > (wholeRaw.length || 0) * 2;
        // 预期数量：单行时约为 blocks/1，两行时约为 blocks/2
        const rowFactor = likelyTwoRow ? 0.5 : 1;
        const expected = Math.max(2, Math.floor((Math.min(blocks.length * rowFactor, (wholeRaw.length || 0) * 2) || wholeRaw.length || 2) * 0.45));
        console.debug('[图例识别] expected=%d, suspiciousBlocks=%s', expected, suspiciousBlocks);
        if (wholeRaw && wholeRaw.length >= expected) {
          console.debug('[图例识别] 采用整张识别结果');
          return buildLegendFromColors(wholeRaw, blocks.length || wholeRaw.length);
        }
        if (suspiciousBlocks && wholeRaw && wholeRaw.length >= 3) {
          console.debug('[图例识别] 检测到 blocks 过切，强制采用整张识别');
          return buildLegendFromColors(wholeRaw, wholeRaw.length);
        }
        // 疑似两行但整张结果明显偏少：可能是表头/文字被误识别，继续尝试分组
      } catch (e) { console.warn('整张图例识别失败，尝试分组识别：', e.message); }
    }
    // 第二路径：分组识别（2~3 个色块一组），兼顾上下文与分辨率。
    // 仅当图例区域比较扁（单行/接近单行）且 blocks 数合理时才分组；
    // 多行矩阵图例的分组会跨行混色，直接用整张识别更稳。
    const regionAspect = (region.h || 0) / Math.max(0.001, region.w || 1);
    const looksSingleRow = regionAspect < 0.12 && !likelyTwoRow;
    if (blocks.length >= 2 && blocks.length <= 60 && looksSingleRow) {
      console.debug('[图例识别] 进入分组识别，blocks=%d', blocks.length);
      const results = [];
      const groupSize = 3;
      for (let i = 0; i < blocks.length; i += groupSize) {
        const end = Math.min(blocks.length - 1, i + groupSize - 1);
        const actualSize = end - i + 1;
        try {
          const dataUrl = cropGroupToDataURL(img, refined, blocks, i, end);
          if (!dataUrl || dataUrl.length < 500) {
            for (let k = i; k <= end; k++) results.push({ hex: '', code: '', count: 0 });
            continue;
          }
          const raw = await callGroupLegendVisionAPI(dataUrl, state.settings.apiKey, state.settings.model, baseUrl, actualSize);
          for (let k = i; k <= end; k++) {
            const item = raw[k - i] || { hex: '', code: '', count: 0 };
            results.push(item);
          }
        } catch (e) {
          console.warn('图例分组识别失败：', e.message);
          for (let k = i; k <= end; k++) results.push({ hex: '', code: '', count: 0 });
        }
      }
      const valid = results.filter(r => r.hex && /^#?[0-9a-fA-F]{6}$/.test(r.hex));
      console.debug('[图例识别] 分组识别有效结果 %d / %d', valid.length, results.length);
      if (valid.length >= Math.max(2, Math.floor(blocks.length * 0.5))) {
        console.debug('[图例识别] 采用分组识别结果');
        return buildLegendFromColors(results, blocks.length);
      }
    }
    // 最终 fallback：整张识别（即使数量偏少也采用，避免空结果）
    if (wholeDataUrl && wholeDataUrl.length >= 500) {
      const raw = await callLegendVisionAPI(wholeDataUrl, state.settings.apiKey, state.settings.model, baseUrl);
      console.debug('[图例识别] fallback 整张识别返回 %d 条', raw.length);
      return buildLegendFromColors(raw, blocks.length || raw.length || undefined);
    }
    throw new Error('裁剪出的图例区为空/过小，请重新框选图例区域');
  }
  // 对 aiParseLegend 的结果做数量补全：把 count 为 0 的条目用「数量专用」二次识别填满。
  // 视觉模型在首轮回合容易漏读边缘/尾部色块的数量，聚焦只读数字能显著改善。
  async function fillMissingLegendCounts(img, region, legend, baseUrl) {
    if (!legend || !legend.length) return legend;
    const missingIdx = [];
    for (let i = 0; i < legend.length; i++) {
      if (!legend[i].count && legend[i].colorNumber) missingIdx.push(i);
    }
    if (!missingIdx.length) return legend;
    const dataUrl = cropRegionToDataURL(img, region);
    if (!dataUrl || dataUrl.length < 500) return legend;
    try {
      const counts = await callLegendCountAPI(dataUrl, state.settings.apiKey, state.settings.model, baseUrl, legend.length);
      if (Array.isArray(counts) && counts.length >= legend.length) {
        for (const idx of missingIdx) {
          const c = parseInt(counts[idx], 10);
          if (c > 0) legend[idx].count = c;
        }
        console.debug('[图例识别] 数量补全：%d 个缺失项中已填 %d 个', missingIdx.length,
          missingIdx.filter(i => legend[i].count > 0).length);
      }
    } catch (e) { console.warn('数量补全识别失败：', e.message); }
    return legend;
  }
  // aiParseLegend 的包装：先识别色号，再自动补全缺失的数量。
  async function aiParseLegendWithCountFix(img, region, baseUrl, opts = {}) {
    const legend = await aiParseLegend(img, region, baseUrl, opts);
    return await fillMissingLegendCounts(img, region, legend, baseUrl);
  }
  // 把模型返回的 [{hex,code}] 映射为标准色号清单，并过滤表头/无效行
  function buildLegendFromColors(raw, estimatedCols) {
    const out = [];
    // 常见模型幻觉/文字误读，清空后交给颜色匹配兜底
    const noiseCodes = new Set(['no', 'none', 'null', 'undefined', 'yes', 'all', 'ok', 'nil']);
    // 表头类文字：直接丢弃，避免把 "色号 名称 数量" 当成一行数据
    const headerCodes = new Set(['色号', '名称', '数量', '颜色', '颜色名称', '编号', '序号', 'code', 'name', 'count', 'color']);
    for (const c of raw) {
      let hex = (c.hex || '').trim();
      if (!hex) continue;
      if (!hex.startsWith('#')) hex = '#' + hex;
      const rgb = hexToRgb(hex);
      if (!rgb || rgb.some(v => isNaN(v))) continue;
      const [r, g, b] = rgb;
      let code = (c.code || '').trim();
      if (noiseCodes.has(code.toLowerCase())) code = '';
      // 过滤明显是表头/说明文字的行
      if (headerCodes.has(code) || headerCodes.has(code.toLowerCase())) continue;
      // 如果颜色接近白/黑灰且没有有效 code，也视为文字/间隔/网格而非色块
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const isNearWhite = max > 240 && min > 235;
      const isNearBlack = max < 45 && min < 45;
      const isFlatGray = max - min < 20 && max > 80 && max < 220;
      if ((isNearWhite || isNearBlack) && !code) continue;
      // count 为 0 且颜色是浅色/灰色背景、没有有效色号 → 大概率是表头/分隔行/网格
      const countRaw = Number(c.count);
      const count = (c.count && countRaw > 0) ? countRaw : 0;
      if (count === 0 && !code && (isNearWhite || isFlatGray)) continue;
      let colorNumber = '', colorName = '';
      if (code) {
        const bead = beadByCode(code);
        if (bead) { colorNumber = bead.colorNumber; colorName = bead.colorName; }
      }
      if (!colorNumber) {
        const m = mapColorToStandard(r, g, b);
        colorNumber = m.colorNumber || '';
        colorName = m.colorName || '';
      }
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
    { key: 'restock',   label: '补货管理' },
    { key: 'recognize', label: '图纸识别' },
    { key: 'recipes',   label: '配方库' },
    { key: 'pattern',   label: '图纸生成器' },
    { key: 'gallery',   label: '图库' },
    { key: 'grid',      label: '网格图纸' },
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
  function switchView(key, opts = {}) {
    currentView = key;
    renderNav();
    const v = $('#view');
    if (key === 'dashboard')  renderDashboard(v);
    if (key === 'warehouse')  renderWarehouse(v, opts);
    if (key === 'restock')    renderRestock(v, opts);
    if (key === 'recognize')  renderRecognize(v);
    if (key === 'recipes')    renderRecipes(v);
    if (key === 'pattern')    renderPattern(v);
    if (key === 'gallery')    renderGallery(v);
    if (key === 'grid')       renderGrid(v);
    if (key === 'logs')       renderLogs(v);
    if (key === 'settings')   renderSettings(v);
  }

  /* ===================== 页面滑动切换 ===================== */
  // 带方向动画地切换到指定视图（仅滑动/方向键触发，避免与色号跳转的滚动定位冲突）
  function swipeToView(key, dir) {
    const v = $('#view');
    if (!v) { switchView(key); return; }
    const cls = dir === 'next' ? 'view-from-right' : 'view-from-left';
    v.classList.add(cls);
    try {
      switchView(key); // 渲染新内容（此时 #view 仍带偏移，作为动画起点）
    } finally {
      // 双 rAF：确保浏览器先以偏移态绘制一帧，再过渡归位，滑动动画才生效；
      // 再用 setTimeout 兜底强制移除动画类——杜绝「渲染异常/rAF 被节流」导致 #view 永久
      // 停留在偏移/透明态而整页空白的隐患
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('view-from-right', 'view-from-left')));
      setTimeout(() => v.classList.remove('view-from-right', 'view-from-left'), 380);
    }
  }
  function enableSwipeNavigation() {
    const main = document.querySelector('main');
    if (!main) return;
    let sx = 0, sy = 0, st = 0, tracking = false, locked = false;
    // 这些元素自身有横向滚动或需要手势交互，滑动切换应让位给它
    const isExcluded = (t) => !!(t && t.closest &&
      t.closest('table, .overflow-x-auto, .overflow-auto, canvas, input, textarea, select, [contenteditable]'));
    const modalOpen = () => {
      const mr = document.querySelector('#modal-root');
      return mr && mr.children.length > 0;
    };
    // 屏幕左右边缘留白：此区域内起滑交给系统返回手势，不参与翻页，避免与浏览器返回冲突
    const EDGE = 24;
    main.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || isExcluded(e.target) || modalOpen()) { tracking = false; locked = false; return; }
      const x = e.touches[0].clientX;
      // 从屏幕最左/最右边缘起滑 → 交给浏览器（iOS/安卓系统返回手势），不当成翻页
      if (x < EDGE || x > window.innerWidth - EDGE) { tracking = false; locked = false; return; }
      sx = x; sy = e.touches[0].clientY; st = Date.now(); tracking = true; locked = false;
    }, { passive: true });
    // 关键：touchmove 用非 passive，滑动过程中锁定为横向手势后立即 preventDefault，
    // 拦掉浏览器对横向手势的默认处理（含返回手势），否则极易被浏览器当成「返回」吞掉
    main.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (!locked) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          locked = true; // 横向明显占优 → 锁定为翻页手势
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 14) {
          tracking = false; return; // 纵向占优 → 放弃翻页，让位正常上下滚动
        }
      }
      if (locked) e.preventDefault();
    }, { passive: false });
    main.addEventListener('touchend', (e) => {
      if (!tracking) { tracking = false; locked = false; return; }
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
      // 已锁定横向手势 + 距离足够 + 动作够快 → 判定为翻页（阈值略降，更灵敏）
      if (locked && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 800) {
        const idx = VIEWS.findIndex(vv => vv.key === currentView);
        const ni = idx + (dx < 0 ? 1 : -1); // 左滑 → 下一个
        if (ni >= 0 && ni < VIEWS.length) swipeToView(VIEWS[ni].key, dx < 0 ? 'next' : 'prev');
      }
      locked = false;
    }, { passive: true });
    // 桌面端：左右方向键翻页（输入框聚焦时不触发）
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      if (modalOpen()) return;
      const idx = VIEWS.findIndex(vv => vv.key === currentView);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const ni = idx + dir;
      if (ni >= 0 && ni < VIEWS.length) { e.preventDefault(); swipeToView(VIEWS[ni].key, e.key === 'ArrowRight' ? 'next' : 'prev'); }
    });
    // 首次进入（移动端）提示一次可滑动翻页
    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches && !localStorage.getItem('swipe_hinted')) {
      setTimeout(() => { toast('💡 左右滑动可切换页面', 'info', 2600); localStorage.setItem('swipe_hinted', '1'); }, 1200);
    }
  }

  /* ===================== 11. 仪表盘 ===================== */
  const DEFAULT_RESTOCK_PER_QTY = 1000; // 补货记录中每项默认每份颗数
  let restockTab = 'pending';           // 补货管理页当前页签：pending 未入库 / stocked 已入库
  let pendingFocusRestockIds = null;    // 从仪表盘「添加到补货清单」后，要定位/高亮的记录 id
  let pendingNewRestockId = null;       // 手动新增记录后，要聚焦其名称输入框的记录 id
  let collapsedRestock = new Set();     // 处于折叠状态的补货记录 id 集合（其余默认展开，可见清单项）
  let editingRestockNameId = null;      // 当前正在编辑名称的补货记录 id（点击铅笔进入编辑）

  // 取下一条补货记录的自动名称：补货记录N（N 为当前最大序号 +1）
  function nextRestockName() {
    const nums = (state.restockRecords || []).map(r => {
      const m = /^补货记录(\d+)$/.exec(r.name || '');
      return m ? parseInt(m[1], 10) : 0;
    });
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return '补货记录' + (max + 1);
  }
  function renderDashboard(v) {
    const low = state.beads.filter(isLow);
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
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 class="font-bold">🚨 低库存预警（低于补货阈值）</h3>
            ${low.length ? '<button id="add-to-restock" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-mk-lav/70 text-mk-ink hover:bg-mk-lav/90">📥 添加到补货清单</button>' : ''}
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

      <section class="mk-card rounded-2xl shadow-soft p-5 mt-4">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
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
      </section>

      <section class="mk-card rounded-2xl shadow-soft p-5 mt-4">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="font-bold">📲 下载桌面 / 手机 App</h3>
          <a href="download.html" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-mk-lav/70 text-mk-ink hover:bg-mk-lav/90">查看所有平台 →</a>
        </div>
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <div id="home-qr" class="p-2 bg-white rounded-xl shadow-soft shrink-0"></div>
          <div class="text-sm text-mk-sub">
            <p>手机 / 电脑扫码，选择对应平台下载安装：</p>
            <p class="mt-1 font-semibold text-mk-ink">🪟 Windows　🍎 Mac　🤖 安卓　📱 iPhone</p>
            <p class="mt-1">iOS 推荐用 Safari「分享 → 添加到主屏幕」一步变 App。</p>
          </div>
        </div>
      </section>`;

    $$('.dash-color', v).forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      whFilterLow = false;
      whSearch = '';
      switchView('warehouse', { focusColor: btn.dataset.num });
    });
    $$('.stat-card', v).forEach(card => card.onclick = () => {
      const action = card.dataset.action;
      if (!action) return;
      if (action === 'warehouse') {
        whFilterLow = false;
        whSearch = '';
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
    $$('.low-stock-row', v).forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      // 低库存色号在仓库列表很深处，改开启「仅看低库存」过滤，让其落在短列表里稳定定位
      whFilterLow = true;
      whSearch = '';
      switchView('warehouse', { focusColor: btn.dataset.num });
    });
    const atr = $('#add-to-restock');
    if (atr) atr.onclick = () => addToRestockList();

    // 首页「下载 App」二维码：指向下载落地页（自适应当前域名，localhost 也能用）
    const qrBox = $('#home-qr');
    if (qrBox) {
      qrBox.innerHTML = '';
      const dlUrl = location.origin + '/download.html';
      if (window.QRCode) {
        try {
          new window.QRCode(qrBox, {
            text: dlUrl, width: 132, height: 132,
            colorDark: '#5B5147', colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M
          });
        } catch (e) {
          qrBox.innerHTML = '<a class="text-xs text-mk-sub underline" href="download.html">扫码下载（点此打开）</a>';
        }
      } else {
        qrBox.innerHTML = '<a class="text-xs text-mk-sub underline" href="download.html">扫码下载（点此打开）</a>';
      }
    }
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
  // 仪表盘「添加到补货清单」：把所有低库存色号（去重）打包成一条新的补货记录
  function addToRestockList() {
    const low = state.beads.filter(isLow);
    if (!low.length) return toast('当前没有低库存色号', 'warn');
    // 收集已在任意 pending 记录 items 中的色号，避免重复添加
    const exist = new Set();
    (state.restockRecords || []).forEach(r => {
      if (r.status === 'pending' && Array.isArray(r.items)) r.items.forEach(it => { if (it.colorNumber) exist.add(it.colorNumber); });
    });
    const items = [];
    let skipped = 0;
    low.forEach(b => {
      if (exist.has(b.colorNumber)) { skipped++; return; }
      items.push({ id: uid('ri'), colorNumber: b.colorNumber, portions: 1, perQty: DEFAULT_RESTOCK_PER_QTY, note: '' });
    });
    if (!items.length) return toast('低库存色号都已加入补货清单', 'info');
    const id = uid('rs');
    state.restockRecords.push({
      id, name: nextRestockName(), status: 'pending',
      createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null,
      defaultPerQty: DEFAULT_RESTOCK_PER_QTY, items
    });
    save();
    restockTab = 'pending';
    collapsedRestock.delete(id);
    pendingFocusRestockIds = [id];
    switchView('restock', { focusTab: 'pending' });
    toast('已生成补货记录，含 ' + items.length + ' 个色号' + (skipped ? '（' + skipped + ' 个已存在跳过）' : ''), 'success');
  }

  function getRestock(id) { return (state.restockRecords || []).find(r => r.id === id); }

  // 将一组色号清单项加入补货管理（生成一条新记录，自动去重已有 pending 色号）
  function addItemsToRestock(newItems, notePrefix) {
    if (!newItems || !newItems.length) return toast('没有可添加的色号', 'warn');
    const exist = new Set();
    (state.restockRecords || []).forEach(r => {
      if (r.status === 'pending' && Array.isArray(r.items)) r.items.forEach(it => { if (it.colorNumber) exist.add(it.colorNumber); });
    });
    const items = [];
    let skipped = 0;
    newItems.forEach(it => {
      if (!it.colorNumber || exist.has(it.colorNumber)) { skipped++; return; }
      items.push({ id: uid('ri'), colorNumber: it.colorNumber, portions: it.portions || 1, perQty: it.perQty || DEFAULT_RESTOCK_PER_QTY, note: it.note || '' });
    });
    if (!items.length) return toast('这些色号都已加入补货清单', 'info');
    const id = uid('rs');
    state.restockRecords.push({
      id, name: nextRestockName(), status: 'pending',
      createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null,
      defaultPerQty: DEFAULT_RESTOCK_PER_QTY, items, note: notePrefix || ''
    });
    save();
    restockTab = 'pending';
    collapsedRestock.delete(id);
    pendingFocusRestockIds = [id];
    switchView('restock', { focusTab: 'pending' });
    toast('已生成补货记录，含 ' + items.length + ' 个色号' + (skipped ? '（' + skipped + ' 个已存在跳过）' : ''), 'success');
  }

  // 记录合计颗数（所有清单项之和）
  function restockRecordBeads(r) {
    return (r.items || []).reduce((s, it) => s + (it.portions || 0) * (it.perQty || 0), 0);
  }
  // 记录合计份数（所有清单项份数之和）
  function restockRecordPortions(r) {
    return (r.items || []).reduce((s, it) => s + (it.portions || 0), 0);
  }

  function rStat(label, count, beads, active, tabKey) {
    return `<div class="rs-tab mk-card rounded-2xl shadow-soft p-4 ${active ? 'ring-2 ring-mk-rose bg-mk-rose/5' : 'cursor-pointer hover:bg-mk-sand/40'}" data-t="${tabKey}">
      <div class="text-xs text-mk-sub font-semibold">${label}</div>
      <div class="text-2xl font-bold">${count}</div>
      <div class="text-[11px] text-mk-sub">${beads} 颗</div>
    </div>`;
  }

  // 单条清单项（可编辑行）：色号 / 份数 / 每份颗数 / 数量 / 删除
  function restockItemRow(r, it) {
    const b = beadByNumber(it.colorNumber);
    const hex = b ? b.hex : '#ccc';
    const name = b ? b.colorName : (it.colorNumber ? '未知色号' : '请填写色号');
    const total = (it.portions || 0) * (it.perQty || 0);
    return `
    <div class="rs-item grid grid-cols-[auto_1fr_auto_auto_auto] sm:flex sm:items-center gap-2 mb-2 bg-white/60 rounded-xl px-2 py-2" data-rid="${r.id}" data-iid="${it.id}">
      <span class="w-6 h-6 rounded-full swatch shrink-0 self-center" style="background:${hex}"></span>
      <div class="flex flex-col min-w-0">
        <input class="ri-color w-full px-1.5 py-1 rounded-lg bg-white border border-mk-sand text-xs font-semibold" data-rid="${r.id}" data-iid="${it.id}" value="${escapeHtml(it.colorNumber)}" placeholder="色号">
        <span class="text-[10px] text-mk-sub truncate px-0.5">${escapeHtml(name)}</span>
      </div>
      <label class="flex flex-col items-center text-[10px] text-mk-sub">
        份数
        <input type="number" min="1" step="1" class="ri-portions w-14 px-1 py-1 rounded-lg bg-white border border-mk-sand text-xs text-right" data-rid="${r.id}" data-iid="${it.id}" value="${it.portions || 1}">
      </label>
      <label class="flex flex-col items-center text-[10px] text-mk-sub">
        每份
        <input type="number" min="1" step="1" class="ri-perqty w-16 px-1 py-1 rounded-lg bg-white border border-mk-sand text-xs text-right" data-rid="${r.id}" data-iid="${it.id}" value="${it.perQty || DEFAULT_RESTOCK_PER_QTY}">
      </label>
      <div class="flex flex-col items-center text-[10px] text-mk-sub shrink-0">
        数量
        <span class="text-sm font-bold text-mk-ink">${total}</span>
      </div>
      <button class="ri-del px-2 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-50 self-center" data-rid="${r.id}" data-iid="${it.id}" title="删除该项">✕</button>
    </div>`;
  }

  // 补货记录卡片（含可编辑名称、一键入库/新增清单、清单项列表；可折叠）
  function restockRecordRow(r, mode) {
    const collapsed = collapsedRestock.has(r.id);
    const total = restockRecordBeads(r);
    const totalPortions = restockRecordPortions(r);
    const itemCount = (r.items || []).length;
    const timeLabel = mode === 'stocked' && r.stockedAt ? '入库于 ' + fmtTime(r.stockedAt) : '创建 ' + fmtTime(r.createdAt);
    const ringCls = mode === 'stocked' ? 'ring-2 ring-emerald-300 bg-emerald-50/40' : 'ring-2 ring-mk-rose/30 bg-mk-rose/5';
    const editingName = editingRestockNameId === r.id;
    const nameHtml = editingName
      ? `<input class="rs-name flex-1 min-w-0 px-2 py-1.5 rounded-xl bg-white border border-mk-sand text-sm font-bold" data-id="${r.id}" value="${escapeHtml(r.name || '')}" placeholder="补货记录名称">`
      : `<span class="rs-name-text flex-1 min-w-0 px-2 py-1.5 rounded-xl hover:bg-white/60 text-sm font-bold cursor-pointer truncate" data-id="${r.id}" title="点击折叠/展开">${escapeHtml(r.name || '')}</span>
         <button class="rs-name-edit ml-1 px-1.5 py-1 rounded-lg text-xs text-mk-sub hover:bg-mk-sand/40 hover:text-mk-ink" data-id="${r.id}" title="修改名称">✏️</button>`;
    const head = `
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <button class="rs-toggle text-mk-sub text-lg leading-none px-1" data-id="${r.id}" title="${collapsed ? '展开' : '折叠'}">${collapsed ? '▸' : '▾'}</button>
        ${nameHtml}
        <span class="text-[11px] text-mk-sub whitespace-nowrap">${itemCount} 项 · ${totalPortions} 份 · ${total} 颗</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        ${mode === 'pending'
          ? `<button class="rs-stock-all px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600" data-id="${r.id}">✅ 一键入库</button>
             <button class="rs-add-item px-3 py-1.5 rounded-xl text-xs font-semibold bg-mk-rose text-white hover:bg-mk-rose/90" data-id="${r.id}">➕ 新增清单</button>`
          : `<button class="rs-undo px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600" data-id="${r.id}">↩️ 撤销入库</button>`}
        <button class="rs-del-record px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-mk-sand text-rose-500 hover:bg-rose-50" data-id="${r.id}">🗑️ 删除记录</button>
        <label class="flex items-center gap-1.5 ml-auto text-[10px] text-mk-sub whitespace-nowrap">
          默认每份
          <input type="number" min="1" step="1" class="rs-default-perqty w-16 px-1.5 py-1 rounded-lg bg-white border border-mk-sand text-xs text-right" data-id="${r.id}" value="${r.defaultPerQty || DEFAULT_RESTOCK_PER_QTY}">
          颗
        </label>
      </div>`;
    const itemsHtml = collapsed ? '' :
      `<div class="space-y-1 mt-1">${(r.items || []).map(it => restockItemRow(r, it)).join('') || '<div class="text-xs text-mk-sub text-center py-2">暂无清单项，点「新增清单」添加色号</div>'}</div>`;
    const footerHtml = collapsed || !itemCount ? '' :
      `<div class="mt-3 pt-2 border-t border-mk-sand/50 flex items-center justify-between text-sm">
        <span class="text-mk-sub">当前合计</span>
        <span class="font-bold text-mk-ink">${totalPortions} 份 · ${total} 颗</span>
      </div>`;
    return `
    <div class="restock-rec mk-card rounded-2xl shadow-soft p-4 mb-3 ${ringCls}" data-id="${r.id}">
      ${head}
      ${itemsHtml}
      ${footerHtml}
    </div>`;
  }

  function renderRestock(v, opts = {}) {
    if (opts && opts.focusTab) restockTab = opts.focusTab;
    const records = state.restockRecords || [];
    const pending = records.filter(r => r.status === 'pending');
    const stocked = records.filter(r => r.status === 'stocked');
    const list = restockTab === 'pending' ? pending : stocked;
    const pendingBeads = pending.reduce((s, r) => s + restockRecordBeads(r), 0);
    const stockedBeads = stocked.reduce((s, r) => s + restockRecordBeads(r), 0);
    v.innerHTML = `
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-xl font-bold">📥 补货管理</h2>
        ${restockTab === 'pending'
          ? `<div class="flex gap-2 flex-wrap">
              <button id="rs-copy" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold hover:bg-mk-sand/40">📄 复制清单</button>
              <button id="rs-export-cfg" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold hover:bg-mk-sand/40">⚙️ 导出列</button>
              <button id="rs-recognize" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold hover:bg-mk-sand/40">📷 识别色号</button>
              <button id="rs-add" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">➕ 新增补货记录</button>
            </div>`
          : ''}
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        ${rStat('未入库', pending.length, pendingBeads, restockTab === 'pending', 'pending')}
        ${rStat('已入库', stocked.length, stockedBeads, restockTab === 'stocked', 'stocked')}
      </div>
      ${list.length ? list.map(r => restockRecordRow(r, restockTab)).join('')
        : `<div class="mk-card rounded-2xl shadow-soft p-8 text-center text-mk-sub">${restockTab === 'pending' ? '暂无未入库记录，去仪表盘点「添加到补货清单」或在右上角新增吧 🌟' : '还没有已入库的记录'}</div>`}
    `;
    $$('.rs-tab', v).forEach(b => b.onclick = () => { restockTab = b.dataset.t; renderRestock(v); });
    const copyBtn = $('#rs-copy'); if (copyBtn) copyBtn.onclick = () => copyRestockRecords();
    const cfgBtn = $('#rs-export-cfg'); if (cfgBtn) cfgBtn.onclick = () => openRestockExportCfg();
    const recBtn = $('#rs-recognize'); if (recBtn) recBtn.onclick = () => openRestockRecognize();
    const addBtn = $('#rs-add'); if (addBtn) addBtn.onclick = () => addRestockRecord();
    bindRestockRecordHandlers(v);
    if (pendingFocusRestockIds) {
      const ids = pendingFocusRestockIds; pendingFocusRestockIds = null;
      requestAnimationFrame(() => {
        ids.forEach(id => {
          const el = v.querySelector('[data-id="' + id + '"]');
          if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ring-2', 'ring-mk-rose'); setTimeout(() => el.classList.remove('ring-2', 'ring-mk-rose'), 2600); }
        });
      });
    }
    if (pendingNewRestockId) {
      const nid = pendingNewRestockId; pendingNewRestockId = null;
      editingRestockNameId = nid;
      renderRestock(v);
      requestAnimationFrame(() => {
        const el = v.querySelector('.rs-name[data-id="' + nid + '"]');
        if (el) { el.focus(); el.select(); }
      });
    }
  }

  function bindRestockRecordHandlers(v) {
    // 折叠 / 展开（箭头按钮 & 名称文本点击）
    $$('.rs-toggle, .rs-name-text', v).forEach(el => el.onclick = () => {
      const id = el.dataset.id;
      if (collapsedRestock.has(id)) collapsedRestock.delete(id); else collapsedRestock.add(id);
      renderRestock(v);
    });
    // 点击铅笔进入名称编辑模式
    $$('.rs-name-edit', v).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      editingRestockNameId = b.dataset.id;
      renderRestock(v);
      requestAnimationFrame(() => {
        const el = v.querySelector('.rs-name[data-id="' + b.dataset.id + '"]');
        if (el) { el.focus(); el.select(); }
      });
    });
    // 编辑记录名称（输入即存，不重渲染，避免打断输入）
    $$('.rs-name', v).forEach(inp => {
      inp.oninput = () => {
        const r = getRestock(inp.dataset.id); if (!r) return;
        r.name = inp.value; r.updatedAt = Date.now(); save();
      };
      inp.onblur = () => { editingRestockNameId = null; renderRestock(v); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { editingRestockNameId = null; renderRestock(v); } };
    });
    // 编辑清单项：色号
    $$('.ri-color', v).forEach(inp => inp.onchange = () => {
      const r = getRestock(inp.dataset.rid); if (!r) return;
      const it = r.items.find(x => x.id === inp.dataset.iid); if (!it) return;
      const raw = inp.value.trim().toUpperCase();
      if (!raw) { inp.value = it.colorNumber; return toast('色号不能为空', 'warn'); }
      if (!beadByNumber(raw)) { inp.value = it.colorNumber; return toast('色号 ' + raw + ' 不存在', 'error'); }
      it.colorNumber = raw; r.updatedAt = Date.now(); save(); renderRestock(v);
    });
    // 编辑清单项：份数 / 每份颗数
    $$('.ri-portions', v).forEach(inp => inp.onchange = () => {
      const r = getRestock(inp.dataset.rid); if (!r) return;
      const it = r.items.find(x => x.id === inp.dataset.iid); if (!it) return;
      let val = parseInt(inp.value, 10); if (!val || val < 1) val = 1;
      it.portions = val; r.updatedAt = Date.now(); save(); renderRestock(v);
    });
    $$('.ri-perqty', v).forEach(inp => inp.onchange = () => {
      const r = getRestock(inp.dataset.rid); if (!r) return;
      const it = r.items.find(x => x.id === inp.dataset.iid); if (!it) return;
      let val = parseInt(inp.value, 10); if (!val || val < 1) val = 1;
      it.perQty = val; r.updatedAt = Date.now(); save(); renderRestock(v);
    });
    // 编辑记录默认每份颗数
    $$('.rs-default-perqty', v).forEach(inp => inp.onchange = () => {
      const r = getRestock(inp.dataset.id); if (!r) return;
      let val = parseInt(inp.value, 10); if (!val || val < 1) val = 1;
      r.defaultPerQty = val; r.updatedAt = Date.now(); save(); renderRestock(v);
    });
    // 删除清单项
    $$('.ri-del', v).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const r = getRestock(b.dataset.rid); if (!r) return;
      r.items = r.items.filter(x => x.id !== b.dataset.iid);
      r.updatedAt = Date.now(); save(); renderRestock(v);
    });
    // 新增清单项
    $$('.rs-add-item', v).forEach(b => b.onclick = () => addRestockItem(b.dataset.id));
    // 一键入库（整条记录）
    $$('.rs-stock-all', v).forEach(b => b.onclick = () => stockInRestock(b.dataset.id));
    // 撤销入库
    $$('.rs-undo', v).forEach(b => b.onclick = () => undoRestock(b.dataset.id));
    // 删除记录
    $$('.rs-del-record', v).forEach(b => b.onclick = () => deleteRestock(b.dataset.id));
  }

  // 在指定记录内新增一条清单项（色号留空，等待用户填写），并自动展开 + 聚焦输入框
  function addRestockItem(recordId) {
    const r = getRestock(recordId); if (!r) return;
    collapsedRestock.delete(recordId);
    const it = { id: uid('ri'), colorNumber: '', portions: 1, perQty: r.defaultPerQty || DEFAULT_RESTOCK_PER_QTY, note: '' };
    r.items.push(it); r.updatedAt = Date.now(); save(); renderRestock($('#view'));
    requestAnimationFrame(() => {
      const el = $('#view').querySelector('.ri-color[data-rid="' + recordId + '"][data-iid="' + it.id + '"]');
      if (el) { el.focus(); el.select(); }
    });
  }

  function stockInRestock(id) {
    const r = getRestock(id); if (!r || r.status !== 'pending') return;
    const valid = (r.items || []).filter(it => beadByNumber(it.colorNumber));
    const invalid = (r.items || []).length - valid.length;
    if (!valid.length) return toast('没有可入库的有效色号（请先填写正确的色号）', 'warn');
    valid.forEach(it => {
      const b = beadByNumber(it.colorNumber);
      const qty = (it.portions || 0) * (it.perQty || 0);
      b.stock += qty;
      addLog('补货清单入库', b, qty, '补货记录「' + (r.name || '') + '」入库（' + it.portions + '份 × ' + it.perQty + '颗）');
    });
    r.status = 'stocked'; r.stockedAt = Date.now(); r.updatedAt = Date.now();
    save();
    renderRestock($('#view'));
    toast((r.name || '') + ' 已入库 +' + valid.length + ' 项' + (invalid ? '（' + invalid + ' 项色号无效已跳过）' : ''), 'success');
  }

  function undoRestock(id) {
    const r = getRestock(id); if (!r || r.status !== 'stocked') return;
    const valid = (r.items || []).filter(it => beadByNumber(it.colorNumber));
    let undone = 0;
    valid.forEach(it => {
      const b = beadByNumber(it.colorNumber);
      const qty = (it.portions || 0) * (it.perQty || 0);
      const before = b.stock;
      b.stock = Math.max(0, b.stock - qty);
      const deducted = before - b.stock;
      if (deducted > 0) { addLog('补货清单撤销入库', b, -deducted, '撤销补货记录「' + (r.name || '') + '」入库（' + it.portions + '份 × ' + it.perQty + '颗）'); undone++; }
    });
    r.status = 'pending'; r.stockedAt = null; r.updatedAt = Date.now();
    save();
    renderRestock($('#view'));
    toast((r.name || '') + ' 已撤销入库，回到未入库' + (undone ? '' : '（库存均已为 0，无扣减）'), 'info');
  }

  function deleteRestock(id) {
    const r = getRestock(id); if (!r) return;
    if (!confirm('删除该补货记录「' + (r.name || '') + '」？' + (r.status === 'stocked' ? '（该记录已入库，删除不会回退库存）' : ''))) return;
    state.restockRecords = state.restockRecords.filter(x => x.id !== id);
    collapsedRestock.delete(id);
    save(); renderRestock($('#view'));
  }

  function addRestockRecord() {
    const id = uid('rs');
    state.restockRecords.push({
      id, name: nextRestockName(), status: 'pending',
      createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null,
      defaultPerQty: DEFAULT_RESTOCK_PER_QTY, items: []
    });
    save();
    restockTab = 'pending';
    collapsedRestock.delete(id);
    pendingFocusRestockIds = [id];
    pendingNewRestockId = id;
    renderRestock($('#view'));
  }

  // 补货管理「识别色号」：解析形如「色号 份数」的多行文本，生成一条补货记录
  function openRestockRecognize() {
    const body = `
      <p class="text-sm text-mk-sub mb-3">每行一个色号，格式：<span class="font-semibold text-mk-ink">色号 + 空格/制表符 + 份数</span>（份数可省略，默认 1）。例如：</p>
      <pre class="text-xs bg-mk-sand/30 rounded-xl p-3 mb-3 whitespace-pre-wrap">A7    1
C22   2
C25   2</pre>
      <textarea id="rs-rec-input" rows="7" class="w-full px-3 py-2 rounded-xl bg-white border border-mk-sand text-sm font-mono" placeholder="在此粘贴：&#10;A7   1&#10;C22  2&#10;C25  2"></textarea>
      <div id="rs-rec-preview" class="mt-3 text-xs text-mk-sub"></div>`;
    openModal('识别色号并添加', body, { width: 560 });
    const input = $('#rs-rec-input');
    const preview = $('#rs-rec-preview');
    if (input) {
      input.focus();
      input.oninput = () => {
        const r = parseRestockText(input.value);
        const parts = [];
        if (r.items.length) parts.push('可添加 ' + r.items.length + ' 个：' + r.items.map(i => i.colorNumber + '×' + i.portions).join('、'));
        if (r.missing.length) parts.push('色号不存在跳过 ' + r.missing.length + '：' + r.missing.join('、'));
        if (r.skipped.length) parts.push('已存在跳过 ' + r.skipped.length + '：' + r.skipped.join('、'));
        preview.innerHTML = parts.length ? parts.join('；') : '';
      };
    }
    setModalFoot(`
      <button id="rs-rec-cancel" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold hover:bg-mk-sand/40">取消</button>
      <button id="rs-rec-ok" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">识别并添加</button>`);
    $('#rs-rec-cancel').onclick = () => closeModal();
    $('#rs-rec-ok').onclick = () => {
      const text = input ? input.value : '';
      const res = applyRestockRecognize(text);
      if (res) closeModal();
    };
  }

  // 解析文本：返回 {items:[{colorNumber,portions}], missing:[色号], skipped:[色号]}
  function parseRestockText(text) {
    const items = [], missing = [], skipped = [];
    if (!text) return { items, missing, skipped };
    // 已存在（任意 pending 记录的 items）的色号，避免重复添加
    const exist = new Set();
    (state.restockRecords || []).forEach(r => {
      if (r.status === 'pending' && Array.isArray(r.items)) r.items.forEach(it => { if (it.colorNumber) exist.add(it.colorNumber); });
    });
    text.split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const toks = line.split(/\s+/);
      const color = toks[0].toUpperCase();
      let portions = 1;
      if (toks[1] !== undefined) {
        const n = parseInt(toks[1], 10);
        if (!isNaN(n) && n >= 1) portions = n;
      }
      if (!beadByNumber(color)) { missing.push(color); return; }
      if (exist.has(color)) { skipped.push(color); return; }
      exist.add(color);
      items.push({ id: uid('ri'), colorNumber: color, portions, perQty: DEFAULT_RESTOCK_PER_QTY, note: '' });
    });
    return { items, missing, skipped };
  }

  function applyRestockRecognize(text) {
    const { items, missing, skipped } = parseRestockText(text);
    if (!items.length) {
      return toast(missing.length ? ('没有可添加的色号，' + missing.length + ' 个色号在色卡中不存在') : '请输入色号和份数', 'warn');
    }
    const id = uid('rs');
    state.restockRecords.push({
      id, name: nextRestockName(), status: 'pending',
      createdAt: Date.now(), updatedAt: Date.now(), stockedAt: null,
      defaultPerQty: DEFAULT_RESTOCK_PER_QTY, items
    });
    save();
    restockTab = 'pending';
    collapsedRestock.delete(id);
    pendingFocusRestockIds = [id];
    renderRestock($('#view'));
    let msg = '已识别添加 ' + items.length + ' 个色号';
    if (skipped.length) msg += '，' + skipped.length + ' 个已存在跳过';
    if (missing.length) msg += '，' + missing.length + ' 个色号不存在跳过';
    toast(msg, 'success');
    return true;
  }

  // 补货清单可导出的列定义（主顺序固定，导出时按用户预设子集与顺序输出）
  const RESTOCK_COL_DEFS = [
    { key: 'record', label: '记录名', get: (r, it) => r.name || '' },
    { key: 'colorNumber', label: '色号', get: (r, it) => it.colorNumber },
    { key: 'portions', label: '份数', get: (r, it) => (it.portions || 1) },
    { key: 'perQty', label: '每份颗数', get: (r, it) => (it.perQty || DEFAULT_RESTOCK_PER_QTY) },
    { key: 'beads', label: '颗数', get: (r, it) => (it.portions || 0) * (it.perQty || 0) }
  ];
  // 取当前导出列（严格按用户预设的子集与顺序；预设为空时回退全选）
  function restockExportCols() {
    const saved = (state.settings && Array.isArray(state.settings.restockExportCols)) ? state.settings.restockExportCols : null;
    const valid = RESTOCK_COL_DEFS.map(c => c.key);
    if (!saved || !saved.length) return valid.slice();
    const seen = new Set();
    return saved.filter(k => valid.includes(k) && !seen.has(k) && seen.add(k));
  }

  function copyRestockRecords() {
    const pending = (state.restockRecords || []).filter(r => r.status === 'pending');
    if (!pending.length) return toast('没有未入库记录可复制', 'warn');
    const cols = restockExportCols().map(k => RESTOCK_COL_DEFS.find(c => c.key === k)).filter(Boolean);
    if (!cols.length) return toast('请先在「⚙️ 导出列」里勾选要导出的列', 'warn');
    let totalP = 0, totalG = 0;
    const rows = [];
    pending.forEach(r => {
      (r.items || []).forEach(it => {
        totalP += (it.portions || 0); totalG += (it.portions || 0) * (it.perQty || 0);
        rows.push(cols.map(c => c.get(r, it)).join('\t'));
      });
    });
    const totals = { portions: totalP, beads: totalG };
    const header = cols.map(c => c.label).join('\t');
    const summary = cols.map(c => (c.key in totals) ? totals[c.key] : '').join('\t');
    const lines = ['补货清单（待采购）', header, ...rows, summary];
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('已复制补货清单', 'success'), () => copyTextFallback(text));
    else copyTextFallback(text);
  }

  // 「⚙️ 导出列」预设配置弹窗：勾选要导出的列并调整顺序，保存到 settings
  function openRestockExportCfg() {
    // order：全部 5 列的主顺序；on：勾选包含的列（key 集合）
    let order = RESTOCK_COL_DEFS.map(c => c.key);
    const saved = (state.settings && Array.isArray(state.settings.restockExportCols)) ? state.settings.restockExportCols : null;
    const on = new Set(saved && saved.length ? saved.filter(k => order.includes(k)) : order.slice());
    const body = document.createElement('div');
    const render = () => {
      body.innerHTML = `
        <p class="text-sm text-mk-sub mb-3">勾选要导出的列，并用 ↑/↓ 调整输出顺序（最上方最先输出）。</p>
        <div id="rs-cols" class="space-y-2"></div>
        <div class="mt-3 flex gap-2">
          <button id="rs-cfg-all" class="px-3 py-1.5 rounded-xl bg-white border border-mk-sand text-xs font-semibold hover:bg-mk-sand/40">全选</button>
          <button id="rs-cfg-none" class="px-3 py-1.5 rounded-xl bg-white border border-mk-sand text-xs font-semibold hover:bg-mk-sand/40">全不选</button>
        </div>`;
      const wrap = body.querySelector('#rs-cols');
      order.forEach((k, idx) => {
        const def = RESTOCK_COL_DEFS.find(c => c.key === k);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 bg-mk-sand/20 rounded-xl px-3 py-2';
        row.innerHTML = `
          <input type="checkbox" class="rs-col-on" data-key="${k}" ${on.has(k) ? 'checked' : ''}>
          <span class="flex-1 text-sm font-semibold">${def.label}</span>
          <button class="rs-col-up px-2 py-1 rounded-lg text-xs bg-white border border-mk-sand" data-key="${k}" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="rs-col-down px-2 py-1 rounded-lg text-xs bg-white border border-mk-sand" data-key="${k}" ${idx === order.length - 1 ? 'disabled' : ''}>↓</button>`;
        wrap.appendChild(row);
      });
      body.querySelectorAll('.rs-col-on').forEach(cb => cb.onchange = () => { cb.checked ? on.add(cb.dataset.key) : on.delete(cb.dataset.key); });
      body.querySelectorAll('.rs-col-up').forEach(b => b.onclick = () => { const i = order.indexOf(b.dataset.key); if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); } });
      body.querySelectorAll('.rs-col-down').forEach(b => b.onclick = () => { const i = order.indexOf(b.dataset.key); if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); } });
      body.querySelector('#rs-cfg-all').onclick = () => { order.forEach(k => on.add(k)); render(); };
      body.querySelector('#rs-cfg-none').onclick = () => { on.clear(); render(); };
    };
    render();
    openModal('导出列预设', '', { width: 480 });
    const modalBody = $('#modal-body');
    modalBody.innerHTML = '';
    modalBody.appendChild(body);
    setModalFoot(`
      <button id="rs-cfg-cancel" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-ink font-semibold hover:bg-mk-sand/40">取消</button>
      <button id="rs-cfg-save" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold shadow-soft">保存</button>`);
    $('#rs-cfg-cancel').onclick = () => closeModal();
    $('#rs-cfg-save').onclick = () => {
      state.settings.restockExportCols = order.filter(k => on.has(k));
      save();
      closeModal();
      toast('导出列预设已保存', 'success');
    };
  }
  function logRow(l) {
    const color = { 入库: 'text-emerald-600', 出库: 'text-rose-500', 消耗: 'text-rose-500', 图纸消耗: 'text-amber-600', 配方扣减: 'text-purple-600', 补货清单入库: 'text-emerald-600', 补货清单撤销入库: 'text-amber-600' }[l.type] || 'text-mk-ink';
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
  let whSort = ''; // 库存排序：'' 默认（按色号）, 'stock-asc' 从少到多, 'stock-desc' 从多到少
  let pendingWarehouseColor = null; // 从仪表盘点击色号后要跳转/高亮的色号
  function renderWarehouse(v, opts = {}) {
    let list = state.beads.slice();
    if (whFilterLow) list = list.filter(isLow);
    const q = whSearch.trim().toLowerCase();
    if (q) list = list.filter(b =>
      b.colorNumber.toLowerCase().includes(q) ||
      (b.colorName || '').toLowerCase().includes(q) ||
      (b.hex || '').toLowerCase().includes(q) ||
      (b.location || '').toLowerCase().includes(q)
    );
    if (whSort === 'stock-asc') list.sort((a, b) => a.stock - b.stock || a.colorNumber.localeCompare(b.colorNumber));
    else if (whSort === 'stock-desc') list.sort((a, b) => b.stock - a.stock || a.colorNumber.localeCompare(b.colorNumber));

    v.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-xl font-bold">📦 豆子仓库</h2>
        <div class="flex gap-2">
          <button id="wh-filter" class="px-3 py-1.5 rounded-xl text-sm font-semibold ${whFilterLow ? 'bg-rose-200 text-rose-700' : 'bg-white/70 text-mk-sub'}">仅看低库存</button>
          <button id="wh-add" class="px-3 py-1.5 rounded-xl text-sm font-semibold bg-mk-rose text-white shadow-soft">+ 新增豆子</button>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sub text-sm">🔍</span>
          <input id="wh-search" type="text" value="${escapeHtml(whSearch)}" placeholder="搜索色号 / 名称 / 色值 / 位置…" class="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/70 border border-mk-sand text-sm focus:outline-none focus:ring-2 focus:ring-mk-rose/30" />
          ${whSearch ? '<button id="wh-search-clear" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-mk-sub text-xs px-2 py-1 rounded-lg bg-white/70 border border-mk-sand">清除</button>' : ''}
        </div>
        <select id="wh-sort" class="shrink-0 px-3 py-2.5 rounded-xl bg-white/70 border border-mk-sand text-sm focus:outline-none focus:ring-2 focus:ring-mk-rose/30 cursor-pointer">
          <option value="" ${whSort === '' ? 'selected' : ''}>默认排序</option>
          <option value="stock-asc" ${whSort === 'stock-asc' ? 'selected' : ''}>库存从少到多</option>
          <option value="stock-desc" ${whSort === 'stock-desc' ? 'selected' : ''}>库存从多到少</option>
        </select>
        ${q || whSort ? `<span class="text-xs text-mk-sub shrink-0 self-center">${list.length} 个结果</span>` : ''}
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
    let focusColor = null; // 提升到函数作用域：否则下方 if(focusColor) 会因块级作用域 ReferenceError
    const whSearchInput = $('#wh-search');
    if (whSearchInput) {
      // 实时搜索：重渲染后重新聚焦到末尾，避免每次输入丢失光标
      whSearchInput.oninput = (e) => {
        whSearch = e.target.value;
        renderWarehouse(v);
        const ni = $('#wh-search');
        if (ni) { ni.focus(); const len = ni.value.length; ni.setSelectionRange(len, len); }
      };
      // 进仓库不再自动聚焦搜索框：移动端会自动弹软键盘并把视图滚到顶部（最早「跳到搜索框」的根因）；
      // 输入时的光标保持已在 oninput 中处理
      focusColor = (opts && opts.focusColor) || pendingWarehouseColor;
    }
    const whSearchClear = $('#wh-search-clear');
    if (whSearchClear) whSearchClear.onclick = () => { whSearch = ''; renderWarehouse(v); };
    const whSortSelect = $('#wh-sort');
    if (whSortSelect) whSortSelect.onchange = (e) => { whSort = e.target.value; renderWarehouse(v); };
    $$('.bead-edit').forEach(b => b.onclick = () => openAddBead(b.dataset.id));
    $$('.bead-adj').forEach(b => b.onclick = () => openAdjust(b.dataset.id));
    $$('.bead-del').forEach(b => b.onclick = () => deleteBead(b.dataset.id));
    if (focusColor) {
      const target = focusColor; pendingWarehouseColor = null;
      // 确定性定位：用 window.scrollTo（不依赖 scrollIntoView 在移动端的容器/平滑滚动怪异行为）
      // 并在布局未就绪时重试一次，避免低库存色号（列表深处）定位失败停在搜索框
      const locateAndScroll = () => {
        let row = $$('[data-num]').find(el =>
          el.dataset.num === target &&
          el.offsetParent !== null &&
          (el.classList.contains('bead-card') || el.tagName === 'TR')
        );
        if (!row) row = $$('[data-num]').find(el => el.dataset.num === target && el.offsetParent !== null);
        if (!row) return false;
        const rect = row.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        window.scrollTo({ top: Math.max(0, absTop - window.innerHeight * 0.32), behavior: 'auto' });
        row.classList.add('ring-2', 'ring-mk-rose', 'bg-mk-rose/5');
        setTimeout(() => row.classList.remove('ring-2', 'ring-mk-rose', 'bg-mk-rose/5'), 2600);
        return true;
      };
      requestAnimationFrame(() => { if (!locateAndScroll()) setTimeout(locateAndScroll, 140); });
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
  let tempLegendSourceGalleryId = null; // 若本次图例识别来自图库，记录来源图片 id，识别后可「保存到图库」反填图例信息

  /* ---------- 拼豆模式：网格图纸识别 ---------- */
  // 用户上传/从图库导入「每个格子都印有色号文字」的拼豆图纸，手动对齐四角 → 透视拉正 →
  // 逐格识别色号（云端视觉 / 本地 Tesseract）→ 统计色号用量 → 点击色号高亮对应格子。
  let grid = {
    image: null,       // 当前图纸 dataURL
    imgEl: null,       // 已加载的 HTMLImageElement（缓存）
    cols: 0, rows: 0,  // 网格列/行数
    align: null,       // 网格对齐：{cx,cy(归一化),cell(按宽归一化),rot(弧度),cols,rows}
    cells: null,       // 识别结果 [rows][cols] = {code:'', src:'', conf:0}
    engine: 'vision',  // 'vision' | 'tesseract'
    highlight: null,   // 当前高亮的色号
    warp: null,        // 透视拉正后的画布（缓存，用于显示与高亮）
    worker: null,      // Tesseract worker（复用）
    busy: false,
    cancel: false
  };
  let GV = null;       // 当前 grid 视图容器（供异步回调重渲染）


  /* ---------- 图纸识别辅助：自动框选、格子检测、画布编辑 ---------- */

  // 将图片缩放到最大边 <= max，返回 {canvas, ctx, scale, w, h}
  function createAnalysisCanvas(img, max = 1200) {
    // 大图缩小到 max，小图允许放大到 max（最多 4 倍），让图例/色块更清晰。
    const scale = Math.min(4, max / Math.max(img.width, img.height));
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // 最多 2x 高清，平衡性能与清晰度
      const parentW = cv.parentElement.clientWidth || cv.parentElement.getBoundingClientRect().width || img.width;
      // 桌面端给足够大的显示尺寸，移动端仍按宽度撑满；高度由图片比例自然决定
      const displayMaxW = window.innerWidth >= 768 ? Math.min(parentW, 1400) : parentW;
      const displayMaxH = window.innerHeight * 0.72; // 提高到 72vh
      const scale = Math.min(displayMaxW / img.width, displayMaxH / img.height, 1);
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      // canvas 内部像素 = 显示尺寸 × DPR，保证高分屏/放大后仍清晰
      cv.width = Math.max(1, Math.round(dw * dpr));
      cv.height = Math.max(1, Math.round(dh * dpr));
      // 小图不要强制拉伸到 100% 容器宽度，否则浏览器插值会模糊；
      // 按计算出的显示尺寸 dw 渲染，max-width:100% 保证大图不溢出。
      cv.style.width = dw + 'px';
      cv.style.maxWidth = '100%';
      cv.style.height = 'auto';
      cv.style.maxHeight = displayMaxH + 'px';
      cv.style.display = 'block';
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const srcGallery = tempLegendSourceGalleryId ? (state.gallery.find(x => x.id === tempLegendSourceGalleryId) || null) : null;
    v.innerHTML = `
      <div class="flex flex-col gap-4">
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5">
          <h2 class="text-xl font-bold mb-1">🖼️ 图纸识别（图例模式）</h2>
          <p class="text-sm text-mk-sub mb-4">上传拼豆图纸，程序会自动定位底部的「颜色图例」条；定位不准时可拖拽边框/四角微调。</p>

          <label class="block border-2 border-dashed border-mk-brown rounded-2xl p-4 sm:p-6 text-center cursor-pointer hover:bg-white/50 transition">
            <input id="img-input" type="file" accept="image/png,image/jpeg" class="hidden">
            <div class="text-4xl">📤</div>
            <div class="mt-2 font-semibold text-sm sm:text-base">点击上传图纸图片</div>
            <div class="text-xs text-mk-sub">自动识别图纸底部的色块图例（每个色块内印色号、下方印数量）</div>
          </label>

          <div id="preview" class="mt-4 ${tempImage ? '' : 'hidden'}">
            ${srcGallery ? `<div class="mb-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span class="leading-relaxed">📚 来自图库：<b>${escapeHtml(srcGallery.name)}</b>，识别后可「保存到图库」反填该图纸的图例信息。</span>
              <button id="rc-back-gallery" type="button" class="text-violet-500 underline shrink-0 text-xs sm:text-sm">返回图库</button>
            </div>` : ''}
            <div class="relative w-full">
              <canvas id="editor-canvas" class="rounded-xl border border-mk-sand cursor-crosshair bg-white mx-auto"></canvas>
              <div id="editor-hint" class="text-[11px] text-mk-sub mt-1.5 leading-relaxed">${tempLegendRegion ? '已定位图例区域（紫框）。拖拽紫框/绿框的四边或四角可微调大小，在空白处拖拽可重新框选。' : '在图上拖拽框选<b>图例区域</b>（通常是一整条横向排列的色块）。紫框=图例区，绿框=可选的图案区；框好后可拖拽边框/四角微调大小。'}</div>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <button id="auto-legend-region" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/70 text-mk-ink text-xs font-semibold hover:bg-mk-lav/90">🎯 自动框选图例区域</button>
              <button id="clear-region" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">↺ 重新框选</button>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <!-- 图例识别：自动/手动框选图例 → 解析颜色 → 生成色号清单 → 框选图案 → 统计用量 -->
            <div id="legend-options" class="space-y-2">
              <p class="text-[11px] text-mk-sub leading-relaxed"><b>第一步</b>：上传后程序会<b>自动定位</b>图纸底部的图例条（紫框）。若定位不准，可拖拽紫框的四边/四角微调大小，或在空白处拖拽重新框选。<br>点「🤖 AI识别图例」读出色号与数量；识别后若调整了紫框，可点「🔄 重新解析」按新框重新识别。若图例下方已印数量，识别后可直接「存为配方 / 扣减库存」，<b>无需再框选图案</b>。</p>
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-white/60 rounded-xl px-3 py-2">
                <span class="text-xs text-mk-sub leading-relaxed">自动定位图例后，点右侧按钮重新识别（会根据当前紫框重新读取色号与数量）：</span>
                <button id="parse-legend" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/70 text-mk-ink text-xs font-semibold hover:bg-mk-lav/90 whitespace-nowrap">${tempLegendMap.length ? '🔄 重新解析' : '🎨 解析图例'}</button>
              </div>
              ${(() => {
                const viaProxy = !state.settings.visionBaseUrl || !state.settings.visionBaseUrl.trim() || state.settings.visionBaseUrl.trim().indexOf('/api/') === 0;
                const aiReady = viaProxy || !!(state.settings.enableVision && state.settings.apiKey);
                return `<button id="ai-parse-legend" type="button" ${aiReady ? '' : 'disabled title="请先到「设置 → 云端视觉AI」启用（默认走内置云端代理）"'} class="w-full px-3 py-2 rounded-xl text-sm font-semibold ${aiReady ? 'bg-gradient-to-r from-violet-400 to-sky-400 text-white hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'} ${tempLegendMap.length ? 'hidden' : ''}">🤖 AI识别图例（云端视觉自动读色号）</button>${aiReady ? '' : '<p class="text-[10px] text-center text-mk-sub mt-1">到「设置 → 云端视觉AI」启用即可使用（默认走内置代理，无需填 Key）</p>'}`;
              })()}
              <div id="legend-list" class="${tempLegendMap.length ? '' : 'hidden'}">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                  <div class="text-xs text-mk-sub">已解析 <b>${tempLegendMap.length}</b> 个色号${tempLegendMap.some(x => x.count > 0) ? '（含数量）' : ''}（色号/数量可点击编辑）：</div>
                  <button id="clear-legend" type="button" class="text-xs text-rose-400 hover:underline self-start">清空图例</button>
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
                  <div class="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-mk-lav/30 rounded-xl px-3 py-2">
                    <span>共 <b class="text-mk-ink">${tempLegendMap.filter(x => x.count > 0).length}</b> 色 · <b class="text-mk-ink">${tempLegendMap.reduce((s, x) => s + (+x.count || 0), 0)}</b> 颗</span>
                    <span class="flex gap-2">
                      <button id="legend-save" type="button" class="px-2.5 py-1 rounded-lg bg-mk-lav text-mk-ink text-xs font-semibold hover:bg-mk-lav/80">存为配方</button>
                      <button id="legend-deduct" type="button" class="px-2.5 py-1 rounded-lg bg-mk-rose text-white text-xs font-semibold hover:opacity-90">扣减库存</button>
                    </span>
                  </div>` : ''}
              </div>
              ${srcGallery ? `<div class="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                <span class="text-violet-600 leading-relaxed">将上方识别结果保存到图库图纸「${escapeHtml(srcGallery.name)}」</span>
                <button id="legend-save-gallery" type="button" class="px-2.5 py-1 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:opacity-90 whitespace-nowrap">💾 保存到图库</button>
              </div>` : ''}
              <button id="legend-usage" type="button" class="w-full px-3 py-2 rounded-xl bg-mk-mint/70 text-mk-ink text-sm font-semibold hover:bg-mk-mint/90 ${tempLegendMap.length ? '' : 'hidden'}">📊 计算整图用量（先框选图案区域）</button>
            </div>
          </div>
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5">
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
        tempLegendSourceGalleryId = null;
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
        const legendStub = window.__aiParseLegendStub;
        tempLegendMap = await (legendStub && typeof legendStub === 'function'
          ? legendStub(img, region, baseUrl)
          : aiParseLegendWithCountFix(img, region, baseUrl));
        tempLegendRegion = region;   // 锁定图例区，图案区留给第二步框选
        tempCropRegion = null;
        tempDetectedVLines = []; tempDetectedHLines = [];
        drawEditor();
        renderRecognize(v);
        const _hasCount = tempLegendMap.some(x => x.count > 0);
        if (tempLegendMap.length === 0) {
          toast('AI 未识别到任何色块：请确认已框选图例区域，或换更清晰的图重试', 'warn', 5000);
        } else {
          toast(`AI 已识别 ${tempLegendMap.length} 个图例色${_hasCount ? '（已读入色块下方数量，可直接「存为配方 / 扣减库存」）' : '，如需精确数量请再框选图案区域点「计算整图用量」'}`, 'success');
        }
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
        if (field === 'colorNumber') {
          const bead = beadByCode(e.target.value);
          if (bead) {
            tempLegendMap[idx].hex = bead.hex;
            tempLegendMap[idx].colorName = bead.colorName;
            const swatch = item.querySelector('.swatch');
            if (swatch) swatch.style.backgroundColor = bead.hex;
          }
        }
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

    // 来自图库：返回图库 / 保存图例结果回图库
    const backGalleryBtn = $('#rc-back-gallery');
    if (backGalleryBtn) backGalleryBtn.onclick = () => switchView('gallery');
    const saveGalleryBtn = $('#legend-save-gallery');
    if (saveGalleryBtn) saveGalleryBtn.onclick = () => {
      const g = srcGallery;
      if (!g) return toast('找不到来源图纸', 'error');
      const items = tempLegendMap
        .filter(x => x.colorNumber)
        .map(x => ({ hex: x.hex || '', colorNumber: x.colorNumber, colorName: x.colorName || '', count: +x.count || 0 }));
      if (!items.length) return toast('请先识别并保留至少一个色号', 'warn');
      g.legend = { savedAt: Date.now(), items };
      save();
      toast('已保存到图库「' + g.name + '」', 'success');
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

  // 自动检测图纸底部的颜色图例条，支持 1~2 行（甚至多行）色块矩阵。
  // 返回 { region: {x,y,w,h}, estimatedCols, likelyTwoRow }，失败时返回 null。region 为归一化坐标（0~1）。
  function detectLegendRegion(img) {
    const MAX_W = 1600;
    const { w, h, ctx } = createAnalysisCanvas(img, MAX_W);
    const data = ctx.getImageData(0, 0, w, h).data;

    function isBg(r, g, b) { return r > 245 && g > 245 && b > 245; }
    function isText(r, g, b) { return r < 45 && g < 45 && b < 45; }
    function isGray(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn < 30 && mx > 60 && mx < 230; }
    // 过滤表头/分隔行的低饱和浅色背景（如浅米色、浅粉色、浅灰蓝），避免被当成色块
    function isPaleBg(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 230 && mx - mn < 35; }
    function goodPx(r, g, b) { return !isBg(r, g, b) && !isText(r, g, b) && !isGray(r, g, b) && !isPaleBg(r, g, b); }

    // 1. 扫描底部 45% 区域（给两行图例留出足够搜索空间）
    const yStart = Math.floor(h * 0.55);
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
      const segScore = Math.min(segments.length, 12) * 0.05;
      const multiSegBonus = segments.length >= 3 ? 0.15 : 0;
      const score = ratio + segScore + multiSegBonus;
      rowInfos[y] = { goodCount, segments, ratio, score };
    }

    // 2. 找连续彩色行段（允许最多 2 行空白间隔，解决两行之间的分隔间隙）
    const minRowScore = 0.10;
    const groups = [];
    let cur = null;
    for (let y = yStart; y < h; y++) {
      const r = rowInfos[y];
      const active = r.score >= minRowScore && r.segments.length >= 2;
      if (active) {
        if (!cur) cur = { y0: y, y1: y, rows: [y], score: r.score };
        else { cur.y1 = y; cur.rows.push(y); cur.score += r.score; }
      } else if (cur) {
        if (y - cur.y1 <= 2) { cur.y1 = y; cur.rows.push(y); }
        else { groups.push(cur); cur = null; }
      }
    }
    if (cur) groups.push(cur);
    if (!groups.length) return null;

    groups.forEach(g => {
      g.height = g.y1 - g.y0 + 1;
      g.avgScore = g.score / Math.max(1, g.rows.length);
    });
    groups.sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return b.avgScore - a.avgScore;
    });
    const bestGroup = groups[0];
    let coreY0 = bestGroup.y0, coreY1 = bestGroup.y1;

    // 3. 在核心区域内做 x 方向投影，取所有有效彩色带的并集（避免只保留最长段而切掉边缘色块）
    const gapThresh = Math.max(3, Math.round(w * 0.004));
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

    const minBlockW = Math.max(4, Math.round(w * 0.006));
    const validRuns = runs.filter(r => r.x1 - r.x0 + 1 >= minBlockW);
    if (!validRuns.length) return null;

    const firstX = validRuns[0].x0;
    const lastX = validRuns[validRuns.length - 1].x1;
    const stripW = lastX - firstX + 1;
    if (stripW < w * 0.06) return null;

    // 4. 在完整条带内按饱和度能量峰估算列数；两行时峰数约为 1 行时的 2 倍
    const energy = new Array(w).fill(0);
    for (let x = firstX; x <= lastX; x++) {
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
    for (let x = firstX + 4; x <= lastX - 4; x++) {
      if (smooth[x] > smooth[x - 1] && smooth[x] > smooth[x + 1] && smooth[x] > smooth[x - 2] && smooth[x] > smooth[x + 2] && smooth[x] > 4) peaks.push(x);
    }
    const mergeDist = Math.max(6, Math.round(stripW / 50));
    const peakGroups = [];
    for (const p of peaks) {
      const last = peakGroups[peakGroups.length - 1];
      if (last && p - last[last.length - 1] < mergeDist) last.push(p);
      else peakGroups.push([p]);
    }

    const coreH = coreY1 - coreY0 + 1;
    const likelyTwoRow = coreH > Math.max(18, h * 0.022);
    // 两行图例的峰数约为列数 2 倍，折半估算更准；单行直接用峰数
    let estimatedCols = likelyTwoRow ? Math.max(3, Math.round(peakGroups.length / 2)) : peakGroups.length;
    const singleRowFallback = Math.max(3, Math.round(stripW / 32));
    const twoRowFallback = Math.max(3, Math.round(stripW / 64));
    if (estimatedCols < 3) estimatedCols = likelyTwoRow ? twoRowFallback : singleRowFallback;
    if (estimatedCols > 80) estimatedCols = 80;

    // 5. 最终 region：核心条带 + 适度上下扩展（确保包含两行色块及下方数量，但不过大）
    const vertExpand = Math.min(Math.round(coreH * 0.35), Math.round(h * 0.04), 24);
    const y0 = Math.max(0, coreY0 - vertExpand);
    const y1 = Math.min(h - 1, coreY1 + vertExpand);

    return {
      region: {
        x: Math.max(0, firstX / w),
        y: Math.max(0, y0 / h),
        w: Math.min(1, stripW / w),
        h: Math.min(1, (y1 - y0 + 1) / h)
      },
      estimatedCols,
      likelyTwoRow
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
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
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
      <div class="flex flex-wrap items-center justify-between gap-2">
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
  let logSearch = '';
  let logSearchTimer = null;
  function renderLogs(v) {
    const types = ['all', '入库', '补货清单入库', '补货清单撤销入库', '消耗', '图纸消耗', '配方扣减'];
    const term = logSearch.trim().toLowerCase();
    const list = state.logs.filter(l => {
      const typeOk = logFilter === 'all' || l.type === logFilter;
      if (!typeOk) return false;
      if (!term) return true;
      const hay = [
        l.type,
        l.colorNumber,
        l.colorName,
        l.note,
        String(l.qty),
        String(l.balance),
        fmtTime(l.ts)
      ].join(' ').toLowerCase();
      return hay.includes(term);
    });
    v.innerHTML = `
      <div class="mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 class="text-xl font-bold">📝 操作记录</h2>
          <div class="relative w-full sm:w-64">
            <input id="log-search" type="text" value="${escapeHtml(logSearch)}" placeholder="搜索色号 / 颜色 / 备注 / 数量…" class="w-full pl-9 pr-8 py-2 rounded-xl bg-white/70 border border-mk-sand text-sm focus:outline-none focus:ring-2 focus:ring-mk-rose/40">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sub">🔍</span>
            ${logSearch ? `<button id="log-search-clear" class="absolute right-2 top-1/2 -translate-y-1/2 text-mk-sub hover:text-mk-ink px-1">✕</button>` : ''}
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${types.map(t => `<button class="lf-btn px-3 py-1.5 rounded-xl text-xs font-semibold ${logFilter === t ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub'}" data-t="${t}">${t === 'all' ? '全部' : t}</button>`).join('')}
        </div>
        ${term ? `<div class="mt-2 text-xs text-mk-sub">「${escapeHtml(logSearch.trim())}」共 ${list.length} 条记录</div>` : ''}
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
              </tr>`).join('') : `<tr><td colspan="6" class="text-center text-mk-sub py-6">${term ? '没有匹配记录' : '暂无记录'}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    $$('.lf-btn').forEach(b => b.onclick = () => { logFilter = b.dataset.t; renderLogs(v); });
    const searchInput = $('#log-search');
    if (searchInput) {
      searchInput.oninput = () => {
        logSearch = searchInput.value;
        clearTimeout(logSearchTimer);
        logSearchTimer = setTimeout(() => renderLogs(v), 180);
      };
      searchInput.onkeydown = (e) => { if (e.key === 'Escape') { logSearch = ''; renderLogs(v); } };
    }
    const clearBtn = $('#log-search-clear');
    if (clearBtn) clearBtn.onclick = () => { logSearch = ''; renderLogs(v); };
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
      <div class="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        ${gStatCard('全部', all.length, galleryFilter === 'all')}
        ${gStatCard('未拼', unmade.length, galleryFilter === 'unmade')}
        ${gStatCard('已拼', made.length, galleryFilter === 'made')}
      </div>
      ${list.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${list.map(galleryCard).join('')}</div>`
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
    $$('.g-grid').forEach(b => b.onclick = () => { const g = state.gallery.find(x => x.id === b.dataset.id); if (g) { grid.image = g.image; gridReset(true); grid.cropped = false; grid.cropRegion = null; switchView('grid'); } });
    $$('.g-legend').forEach(b => b.onclick = () => {
      const g = state.gallery.find(x => x.id === b.dataset.id);
      if (g) openLegendInRecognize(g);
    });
    $$('.g-legend-info').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const g = state.gallery.find(x => x.id === b.dataset.id);
      if (g) openGalleryLegendPreview(g);
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
    return `<button class="g-filter mk-card rounded-2xl shadow-soft p-3 sm:p-4 text-center ${active ? 'ring-2 ring-mk-rose' : 'hover:scale-[1.02]'} transition" data-f="${f}">
      <div class="text-xl sm:text-2xl font-bold text-mk-ink">${val}</div>
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
          <div class="font-bold text-sm sm:text-base flex items-center gap-1">
            <span class="truncate">${escapeHtml(g.name)}</span>
            <button class="g-edit text-mk-sub hover:text-sky-500 transition shrink-0" data-id="${g.id}" title="编辑">✏️</button>
          </div>
          <div class="text-xs text-mk-sub mt-0.5 truncate">${g.platform ? '📦 ' + escapeHtml(g.platform) : ''}${g.platform && g.author ? ' · ' : ''}${g.author ? '✍️ ' + escapeHtml(g.author) : ''}</div>
          <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span class="text-[11px] px-2 py-0.5 rounded-full self-start whitespace-nowrap ${made ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">${made ? '✓ 已拼' : '○ 未拼'}</span>
            <div class="flex gap-1.5 flex-wrap">
              ${g.legend && g.legend.items && g.legend.items.length ? `
              <button class="g-legend-info text-[11px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-violet-50 text-violet-500" data-id="${g.id}">📋 图例信息</button>
              ` : `
              <button class="g-legend text-[11px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-violet-50 text-violet-500" data-id="${g.id}">🎨 去识别</button>
              `}
              <button class="g-grid text-[11px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-indigo-50 text-indigo-500" data-id="${g.id}">🧩 网格识别</button>
              <button class="g-toggle text-[11px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl ${made ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}" data-id="${g.id}">${made ? '标记未拼' : '标记已拼'}</button>
              <button class="g-del text-[11px] px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-50 text-rose-400" data-id="${g.id}">删除</button>
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
  // 图库「识别图例」：把当前图片注入「图纸识别」页（自动定位图例），识别后可反填回图库
  // 在弹窗中展示图库图纸已保存的图例清单
  function openGalleryLegendPreview(g) {
    if (!g || !g.legend || !g.legend.items || !g.legend.items.length) return toast('该图纸暂无图例信息', 'info');
    const items = g.legend.items;
    const total = items.reduce((s, x) => s + (+x.count || 0), 0);
    const rows = items.map((it, i) => {
      const hex = it.hex || '#e5e7eb';
      const cn = it.colorNumber || '—';
      const name = it.colorName || '—';
      const cnt = +it.count || 0;
      return `<div class="flex items-center gap-2 py-1.5 border-b border-mk-sand/40 ${i % 2 === 0 ? 'bg-white/40' : ''}">
        <div class="w-5 h-5 rounded-md border border-mk-sand shrink-0" style="background:${hex}"></div>
        <div class="w-14 text-xs font-mono font-semibold">${escapeHtml(cn)}</div>
        <div class="flex-1 text-xs truncate">${escapeHtml(name)}</div>
        <div class="w-12 text-xs text-right font-semibold">${cnt} 颗</div>
      </div>`;
    }).join('');
    const body = `
      <div class="text-xs text-mk-sub mb-2">保存于 ${fmtTime(g.legend.savedAt || g.legend.updatedAt || 0)} · 共 ${items.length} 色 / ${total} 颗</div>
      <div class="max-h-[55vh] overflow-auto rounded-xl border border-mk-sand bg-white/60 px-2">
        ${rows}
      </div>`;
    openModal('🎨 图例清单：' + g.name, body, { wide: true });
    setModalFoot(`
      <button id="glp-retry" class="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-600 text-xs font-semibold hover:bg-violet-100">🔄 重新识别</button>
      <button id="glp-deduct" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600">➖ 一键入库（扣减）</button>
    `);
    $('#glp-retry').onclick = () => { closeModal(); openLegendInRecognize(g); };
    $('#glp-deduct').onclick = () => { closeModal(); deductGalleryLegend(g); };
  }

  // 图库图纸：按已保存的图例数量一键扣减库存
  function deductGalleryLegend(g) {
    const items = (g && g.legend && g.legend.items) || [];
    if (!items.length) return toast('该图纸暂无图例信息', 'info');
    let ok = 0, skip = 0;
    items.filter(x => x.colorNumber && x.count > 0).forEach(x => {
      const bead = beadByNumber(x.colorNumber);
      if (!bead) { skip++; return; }
      bead.stock = Math.max(0, bead.stock - x.count);
      addLog('图纸消耗', bead, -x.count, '图库图例一键扣减：' + (g.name || ''));
      ok++;
    });
    save();
    toast(`已扣减 ${ok} 种颜色${skip ? `，跳过 ${skip} 种未匹配` : ''}`, 'success');
  }

  function openLegendInRecognize(g) {
    if (!g || !g.image) return toast('该图纸没有图片，无法识别图例', 'warn');
    tempImage = g.image;
    tempIgnoreColors = [];
    tempCropRegion = null;
    tempDetectedVLines = [];
    tempDetectedHLines = [];
    tempDetectedFramePx = null;
    // 反填已有图例结果，便于继续编辑/修正后再保存
    tempLegendMap = (g.legend && Array.isArray(g.legend.items)) ? g.legend.items.map(it => {
      const rgb = hexToRgb(it.hex || '') || [0, 0, 0];
      return { r: rgb[0], g: rgb[1], b: rgb[2], hex: it.hex || '', colorNumber: it.colorNumber || '', colorName: it.colorName || '', count: +it.count || 0 };
    }) : [];
    tempLegendRegion = null;
    tempLegendSourceGalleryId = g.id;
    switchView('recognize');
    // 切换视图后自动定位图例区域
    const img = new Image();
    img.onload = () => {
      const det = detectLegendRegion(img);
      if (det && det.region) { tempLegendRegion = det.region; }
      drawEditor();
      if (det && det.region) toast('已自动定位图例区域，可拖拽边框/四角微调', 'success');
      else toast('未能自动定位，请在图纸上拖拽框选图例区域', 'warn');
    };
    img.src = tempImage;
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
          ${g.legend && g.legend.items && g.legend.items.length ? `<div class="mt-1"><b>图例：</b>${g.legend.items.length} 色 · 共 ${g.legend.items.reduce((s, x) => s + (+x.count || 0), 0)} 颗<div class="mt-1 flex flex-wrap gap-1">${g.legend.items.map(it => `<span class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600"><span class="w-3 h-3 rounded-full inline-block" style="background:${it.hex || '#ccc'}"></span>${escapeHtml(it.colorNumber)}${it.count ? (' ×' + it.count) : ''}</span>`).join('')}</div></div>` : ''}
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
          const img = await autoCropDataURL(await readFileDataURL(f));
          const base = (f.name || ('图纸 ' + (idx + 1))).replace(/\.[^.]+$/, '');
          pendingItems.push({ img, name: base, platform: '', author: '', status: 'unmade' });
        } catch (e) { toast('图片读取失败：' + (f.name || ''), 'error'); }
      }));
      wrappedRender();
    };
    $('#g-save').onclick = async () => {
      if (!pendingItems.length) return toast('请上传图纸图片', 'error');
      const t = Date.now();
      const created = [];
      pendingItems.forEach((it, i) => {
        const name = (it.name || '').trim() || ('图纸 ' + (i + 1));
        const id = 'g' + (t + i).toString(36) + Math.random().toString(36).slice(2, 6);
        const g = {
          id, name, platform: (it.platform || '').trim(), author: (it.author || '').trim(),
          imageId: id, image: it.img, imageStored: false, status: it.status, legend: null,
          createdAt: t + i
        };
        created.push(g);
        state.gallery.unshift(g);
      });
      const n = pendingItems.length;
      pendingItems = [];
      for (const g of created) await persistGalleryImage(g); // 写入 IndexedDB 并摘掉 localStorage 大图
      save(); closeModal(); renderGallery($('#view')); toast('已添加 ' + n + ' 张图纸到图库', 'success');
    };
    updateApplyDisabled();
  }
  // 读取文件原始 data URL（保留原图格式与分辨率，不缩放、不重编码），用于图库原图存储。
  // 图片现已存于 IndexedDB（容量大），故不再为节省空间而缩放/转码，确保与原图 100% 一致。
  function readFileDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }
  // 保持比例缩放图片为 data URL（不裁剪），用于图库存储。
  // 图片现已存于 IndexedDB（容量大），故不再激进压缩：默认保存 2400px 长边、JPEG 0.95；
  // 原图若小于该上限则不放大（scale<=1），最大限度保留清晰度。如需进一步节省空间可去「设置 → 图库图片管理」手动压缩。
  function fitImageToDataURL(file, maxEdge = 2400) {
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
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
        // 裁剪输出无损 PNG，仅改变几何边界、不损失清晰度（拼豆图纸多为线稿/色块，对 JPEG 压缩敏感）
        resolve(out.toDataURL('image/png'));
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
  async function compressGalleryImages(opts = {}) {
    const maxEdge = opts.maxEdge || 1000;
    const quality = opts.quality || 0.80;
    const label = opts.label || (maxEdge + 'px/' + Math.round(quality * 100) + '%');
    const items = state.gallery.filter(g => g.image);
    if (!items.length) return toast('图库中没有图片', 'info');
    const totalBefore = items.reduce((s, g) => s + g.image.length, 0);
    toast('开始压缩图库图片（' + label + '）…', 'info', 1500);
    let done = 0;
    for (const g of items) {
      try {
        g.image = await compressDataURL(g.image, maxEdge, quality);
        g.imageStored = false;
        await persistGalleryImage(g); // 回写 IndexedDB（覆盖旧图），并同步云端备份
        done++;
      } catch (e) { console.warn('压缩失败', g.id, e); }
    }
    const totalAfter = state.gallery.filter(g => g.image).reduce((s, g) => s + g.image.length, 0);
    save();
    if (currentView === 'gallery') renderGallery($('#view'));
    else if (currentView === 'settings') renderSettings($('#view'));
    toast('已压缩 ' + done + '/' + items.length + ' 张图片，约节省 ' + Math.round((totalBefore - totalAfter) / 1024) + 'KB', 'success', 4000);
  }
  // 删除图库中指定状态图片的 image 字段（保留记录）
  function purgeGalleryImages(status, label) {
    const items = state.gallery.filter(g => g.status === status && g.image);
    if (!items.length) return toast('没有可清理的' + label + '图片', 'info');
    if (!confirm('确定删除 ' + items.length + ' 张' + label + '的图片吗？图纸记录仍会保留，只是不再显示缩略图，可随时重新上传。')) return;
    items.forEach(g => {
      g.image = '';
      g.imageStored = false;
      if (g.imageId) {
        imgDBDel(g.imageId).catch(() => {});
        if (state.settings.backupImages) deleteImageFromCloud(g.imageId).catch(() => {});
      }
    });
    save();
    if (currentView === 'gallery') renderGallery($('#view'));
    else if (currentView === 'settings') renderSettings($('#view'));
    toast('已清理 ' + items.length + ' 张' + label + '图片', 'success');
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
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5 lg:col-span-2">
          <h3 class="font-bold mb-4">👤 个人信息</h3>
          <div class="flex flex-col sm:flex-row sm:items-start gap-4">
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
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
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
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5">
          <h3 class="font-bold mb-3">📦 补货阈值设置</h3>
          <label class="text-sm block mb-2">全局补货阈值（库存低于此值即预警，默认 100）
            <input id="replenish-thr" type="number" min="0" step="1" class="w-full mt-1 px-3 py-2 rounded-xl bg-white/70 border border-mk-sand" value="${state.settings.replenishThreshold}">
          </label>
          <p class="text-xs text-mk-sub">该值为所有色号的默认补货阈值；单个色号可在「豆子仓库」编辑时单独设置覆盖值（阈值填 0 即使用此全局值）。首次使用默认每色 1000 颗，均高于阈值，无需补货。</p>
        </section>

        <!-- 数据：导入导出 / 备份恢复 -->
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5 lg:col-span-2">
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
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">🖼️ 图库图片管理</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div class="bg-white/50 rounded-xl p-2.5 text-center">
              <div class="text-sm font-bold text-mk-ink">${Math.round(serializeState().length / 1024)}KB</div>
              <div class="text-[10px] text-mk-sub">本地占用(localStorage)</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2.5 text-center">
              <div class="text-sm font-bold text-mk-ink">${gallerySize}KB</div>
              <div class="text-[10px] text-mk-sub">图库图片</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2.5 text-center">
              <div class="text-sm font-bold text-mk-ink">${galleryCount}</div>
              <div class="text-[10px] text-mk-sub">图片张数</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2.5 text-center">
              <div class="text-sm font-bold text-mk-ink">${state.gallery.filter(g => g.image).length ? Math.round(Math.max(...state.gallery.filter(g => g.image).map(g => g.image.length)) / 1024) : 0}KB</div>
              <div class="text-[10px] text-mk-sub">单张最大</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="migrate-gallery" class="px-4 py-2 rounded-xl bg-mk-mint text-mk-ink font-semibold">迁移旧图到 IndexedDB</button>
            <button id="compress-gallery" class="px-4 py-2 rounded-xl bg-mk-sky text-mk-ink font-semibold">标准压缩</button>
            <button id="compress-gallery-strong" class="px-4 py-2 rounded-xl bg-mk-peach text-mk-ink font-semibold">强力压缩</button>
            <button id="purge-made" class="px-4 py-2 rounded-xl bg-rose-100 text-rose-500 font-semibold">删除已拼图片</button>
            <button id="purge-unmade" class="px-4 py-2 rounded-xl bg-amber-100 text-amber-600 font-semibold">删除未拼图片</button>
          </div>
          <p class="text-xs text-mk-sub mt-2">图库原图现默认存于浏览器 <strong>IndexedDB</strong>（容量数百 MB~GB，无需压缩）。如需进一步节省本地空间可压缩；删除图片会保留图纸记录，只是清空图片数据，可重新上传。清空 IndexedDB 会丢图，勿在浏览器「清除网站数据」中清理本站。</p>
        </section>

        <!-- 图库云端备份（可选） -->
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5 lg:col-span-2">
          <h3 class="font-bold mb-3">☁️ 图库云端备份（可选）</h3>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input id="backup-images-toggle" type="checkbox" ${state.settings.backupImages ? 'checked' : ''} class="w-4 h-4">
            <span>把图库图片同步到 Supabase Storage（换设备也能恢复）</span>
          </label>
          <p class="text-xs text-mk-sub mt-2">开启后，每次添加/修改图纸图片都会上传到云端存储桶 <code>gallery-images</code>（路径 <code>用户ID/图片ID.jpg</code>）。需在 Supabase 后台先创建该存储桶并配置 RLS 策略允许本人读写自己的目录；未配置时上传会静默失败，不影响本地。关闭不会删除已备份的图片。</p>
        </section>

        <!-- 账户与云端同步 -->
        <section class="mk-card rounded-2xl shadow-soft p-4 sm:p-5 lg:col-span-2">
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
    $('#migrate-gallery').onclick = async () => {
      const n = await migrateUnsavedGalleryImages();
      if (n) { save(); renderSettings($('#view')); toast('已迁移 ' + n + ' 张图片到 IndexedDB', 'success'); }
      else toast('没有需要迁移的图片（已全部在 IndexedDB 中）', 'info');
    };
    $('#compress-gallery').onclick = () => compressGalleryImages({ maxEdge: 1000, quality: 0.80, label: '标准' });
    $('#compress-gallery-strong').onclick = () => compressGalleryImages({ maxEdge: 800, quality: 0.70, label: '强力' });
    $('#purge-made').onclick = () => purgeGalleryImages('made', '已拼');
    $('#purge-unmade').onclick = () => purgeGalleryImages('unmade', '未拼');

    const backupToggle = $('#backup-images-toggle');
    if (backupToggle) backupToggle.onchange = async () => {
      state.settings.backupImages = backupToggle.checked;
      save();
      if (state.settings.backupImages) {
        toast('正在把图库图片备份到云端…', 'info', 1500);
        let n = 0;
        for (const g of state.gallery) { if (g.imageId && g.image) { await persistGalleryImage(g); n++; } }
        toast('已备份 ' + n + ' 张图库图片到云端', 'success');
      } else {
        toast('已关闭云端备份（已备份图片保留）', 'info');
      }
    };

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
  async function backupAll() {
    // 图库图片单独打包（避免 state 内嵌大图），统一放 galleryImages 映射
    const galleryImages = {};
    for (const g of state.gallery) {
      if (!g || !g.imageId) continue;
      let img = g.image;
      if (!img) { try { img = await imgDBGet(g.imageId); } catch (e) {} }
      if (img) galleryImages[g.imageId] = img;
    }
    const payload = Object.assign({}, JSON.parse(serializeState()), { galleryImages });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '拼豆豆仓备份_' + Date.now() + '.json'; a.click();
    toast('已备份（含 ' + Object.keys(galleryImages).length + ' 张图库图片）', 'success');
  }
  async function restoreAll(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const galleryImages = data.galleryImages || {};
        state = Object.assign(defaultState(), data);
        delete state.galleryImages; // 该字段仅用于备份文件，不应写回 state/localStorage
        // 把图片写回 IndexedDB 并挂到内存（兼容旧备份内联 image 的情况）
        for (const g of (state.gallery || [])) {
          if (!g) continue;
          if (!g.imageId && g.image) g.imageId = g.id;
          const img = (g.image || galleryImages[g.imageId] || '');
          if (img && g.imageId) {
            g.image = img;
            try { await imgDBPut(g.imageId, img); g.imageStored = true; } catch (err) { g.imageStored = false; }
            if (state.settings.backupImages) { try { await backupImageToCloud(g.imageId, img); } catch (err) {} }
          } else {
            g.image = ''; g.imageStored = false;
          }
        }
        save(); switchView('dashboard'); await hydrateGalleryImages(); toast('已恢复', 'success');
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

  /* ===================== 拼豆模式：网格图纸识别 ===================== */
  function gridInitAlign() {
    // 默认：网格居中、格子取短边的 1/30、旋转 0；用户再拖中心十字 + 调格子大小/角度
    const iw = grid.imgEl ? grid.imgEl.width : 1000;
    const ih = grid.imgEl ? grid.imgEl.height : 1000;
    const cellPx = Math.min(iw, ih) / 30;
    grid.align = { cx: 0.5, cy: 0.5, cell: cellPx / iw, rot: 0, cols: grid.cols || 0, rows: grid.rows || 0 };
  }
  function gridReset(keepImage) {
    const img = keepImage ? grid.image : null;
    const imgEl = keepImage ? grid.imgEl : null;
    grid = { image: img, imgEl, cols: 0, rows: 0, align: null, zoom: 1, cells: null,
             engine: grid.engine, highlight: null, warp: null, worker: grid.worker, busy: false, cancel: false,
             cropped: false, cropRegion: null };
  }
  // 网格对齐模型：中心(cx,cy)归一化坐标 + 每格边长 cell(按图宽归一化) + 旋转 rot(弧度)
  // 格(r,c)中心(r:0..rows-1, c:0..cols-1)像素坐标
  function gridCellCenter(align, r, c, iw, ih) {
    const dx = c - (align.cols - 1) / 2, dy = r - (align.rows - 1) / 2;
    const cellPx = align.cell * iw, cos = Math.cos(align.rot), sin = Math.sin(align.rot);
    return { x: align.cx * iw + dx * cellPx * cos - dy * cellPx * sin,
             y: align.cy * ih + dx * cellPx * sin + dy * cellPx * cos };
  }
  // 网格线交点(ri:0..rows, ci:0..cols)像素坐标
  function gridNodePx(align, ri, ci, iw, ih) {
    const dx = ci - align.cols / 2, dy = ri - align.rows / 2;
    const cellPx = align.cell * iw, cos = Math.cos(align.rot), sin = Math.sin(align.rot);
    return { x: align.cx * iw + dx * cellPx * cos - dy * cellPx * sin,
             y: align.cy * ih + dx * cellPx * sin + dy * cellPx * cos };
  }
  function gridCellPx() {
    // 优先用对齐参数导出的实际格距（用户拖十字/输入的格子大小），保证 warp 采样与绘制一致
    if (grid.align && grid.imgEl) {
      const px = Math.round(grid.align.cell * grid.imgEl.width);
      if (px >= 4) return Math.max(4, Math.min(120, px));
    }
    // 无 align 时 fallback：按总格数算一个合理默认值
    const total = Math.max(1, grid.cols * grid.rows);
    return Math.max(16, Math.min(48, Math.floor(Math.sqrt(12_000_000 / total))));
  }
  // 将原图按对齐参数映射到输出画布（与 gridDrawAlign 同款 proven 渲染方式）
  // 核心思路：算出"输出每像素对应原图多少像素"的缩放比，直接 drawImage 整图缩放+旋转
  // v7: gridCellCenter逐格截取 + 像素采样诊断 + 整图fallback
  function gridWarp(img, align, cols, rows, cellPx) {
    const iw = img.width || img.naturalWidth || 1, ih = img.height || img.naturalHeight || 1;
    if (iw < 2 || ih < 2) { console.warn('[gridWarp] 无效图像尺寸:', iw, ih); const e=document.createElement('canvas');e.width=1;e.height=1;return e; }
    const W = Math.max(1, cols * cellPx), H = Math.max(1, rows * cellPx);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const octx = out.getContext('2d');
    octx.fillStyle = '#fff'; octx.fillRect(0, 0, W, H);
    const cellSrc = (align.cell || 0.03) * iw;
    const halfSrc = cellSrc * 0.5;
    let drawn = 0, outOfBounds = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ctr = gridCellCenter(align, r, c, iw, ih);
        let sx = ctr.x - halfSrc, sy = ctr.y - halfSrc;
        let sw = cellSrc, sh = cellSrc;
        if (sx < 0) { sw += sx; sx = 0; }
        if (sy < 0) { sh += sy; sy = 0; }
        if (sx + sw > iw) sw = iw - sx;
        if (sy + sh > ih) sh = ih - sy;
        if (sw <= 0 || sh <= 0) { outOfBounds++; continue; }
        octx.drawImage(img, sx, sy, sw, sh, c * cellPx, r * cellPx, cellPx, cellPx);
        drawn++;
      }
    }
    // 诊断：采样中心像素确认是否有非白内容
    const diag = octx.getImageData(Math.floor(W/2), Math.floor(H/2), 1, 1).data;
    const isWhite = diag[0]>250 && diag[1]>250 && diag[2]>250;
    console.log('[gridWarp] v8', iw+'x'+ih, '->', W+'x'+H, 'cellSrc='+cellSrc.toFixed(1),
      'drawn='+drawn, 'oob='+outOfBounds, 'centerPixel=('+diag[0]+','+diag[1]+','+diag[2]+')', isWhite?'⚠️WHITE':'✅CONTENT');
    // (debug img removed - gridDrawResult v10 now handles display via <img>)
    // 如果逐格截取全白（可能坐标偏差），fallback：整图缩放填充
    if (isWhite && drawn > 0) {
      console.warn('[gridWarp] FALLBACK: 逐格截取输出全白，尝试整图缩放填充');
      octx.drawImage(img, 0, 0, W, H);
      const fbDiag = octx.getImageData(Math.floor(W/2), Math.floor(H/2), 1, 1).data;
      const fbWhite = fbDiag[0]>250 && fbDiag[1]>250 && fbDiag[2]>250;
      console.log('[gridWarp] FALLBACK result:', fbWhite?'⚠️STILL_WHITE':'✅HAS_CONTENT', '('+fbDiag[0]+','+fbDiag[1]+','+fbDiag[2]+')');
    }
    // 自动裁掉白边：扫描非白像素边界框，裁剪到内容区域
    const cropped = autoCropCanvas(out);
    if (cropped && cropped !== out) {
      console.log('[gridWarp] AUTO-CROP', W+'x'+H, '->', cropped.width+'x'+cropped.height);
      return cropped;
    }
    return out;
  }
  // 裁掉 canvas 四周的白边（容差阈值=240，即接近白的都算背景）
  function autoCropCanvas(canvas, threshold) {
    threshold = threshold || 240;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w < 3 || h < 3) return canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    // 快速采样（每 4 像素取一点）加速
    const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
    let top = h, bottom = 0, left = w, right = 0;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i] < threshold || data[i+1] < threshold || data[i+2] < threshold) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (top >= bottom || left >= right) return canvas; // 全白，不裁
    // 加 2px 边距
    left = Math.max(0, left - 2); top = Math.max(0, top - 2);
    right = Math.min(w - 1, right + 2); bottom = Math.min(h - 1, bottom + 2);
    const cw = right - left + 1, ch = bottom - top + 1;
    if (cw < w * 0.3 || ch < h * 0.3) return canvas; // 裁太多，不安全
    const nc = document.createElement('canvas');
    nc.width = cw; nc.height = ch;
    nc.getContext('2d').drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
    return nc;
  }
  function gridSanitizeCode(s) {
    if (!s) return '';
    return String(s).toUpperCase().replace(/[\s\u3000]+/g, '').replace(/[^A-Z0-9-]/g, '').trim();
  }
  function gridLoadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Tesseract 加载失败（请检查网络是否可访问 CDN）'));
      document.head.appendChild(s);
    });
  }
  async function gridGetWorker() {
    if (grid.worker) return grid.worker;
    await gridLoadTesseract();
    const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
    await worker.setParameters({ tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-' });
    grid.worker = worker;
    return worker;
  }
  function gridAutoDetect() {
    if (!grid.imgEl) return toast('请先上传图片', 'error');
    const det = detectGridLines(grid.imgEl, { x: 0, y: 0, w: 1, h: 1 });
    if (!det || !det.cols || !det.rows) return toast('未能自动检测网格，请手动填写列数/行数', 'warn');
    grid.cols = det.cols; grid.rows = det.rows;
    const aw = det.aw, ah = det.ah, f = det.frame;
    const nx0 = f.gx0 / aw, ny0 = f.gy0 / ah, nx1 = f.gx1 / aw, ny1 = f.gy1 / ah;
    grid.align = {
      cx: (nx0 + nx1) / 2, cy: (ny0 + ny1) / 2,
      cell: (nx1 - nx0) / det.cols, rot: 0,
      cols: det.cols, rows: det.rows
    };
    const ci = $('#grid-cols'), ri = $('#grid-rows');
    if (ci) ci.value = det.cols;
    if (ri) ri.value = det.rows;
    if (grid.align) { const ce = $('#grid-cell'); if (ce) ce.value = Math.round(grid.align.cell * grid.imgEl.width); }
    gridDrawAlign();
    toast(`已检测 ${det.cols} 列 × ${det.rows} 行，可拖动中心十字 + 调格子大小微调`, 'success');
  }
  // ---- 两点校准：点两个真实交点 + 填相隔格数，反推精确 cell/rot 并做相位对齐 ----
  function gridStartCalib() {
    if (!grid.align || !grid.imgEl) return toast('请先上传/导入图纸并拖十字对准一个交点', 'warn');
    grid.calib = { active: true, pts: [] };
    const panel = $('#grid-calib-panel'); if (panel) panel.classList.remove('hidden');
    const status = $('#grid-calib-status');
    if (status) status.textContent = '请在图纸上点击第一个网格交点（P1）。';
    const cv = $('#grid-align-canvas');
    if (cv) cv.style.cursor = 'crosshair';
    console.log('[gridStartCalib] calib active, cursor=crosshair');
    gridDrawAlign();
  }
  function gridStopCalib(keep) {
    if (!grid.calib) grid.calib = { active: false, pts: [] };
    grid.calib.active = false;
    const panel = $('#grid-calib-panel'); if (panel) panel.classList.add('hidden');
    const cv = $('#grid-align-canvas');
    if (cv) cv.style.cursor = '';
    if (!keep) gridDrawAlign();
  }
  function gridCalibClick(p) {
    console.log('[gridCalibClick] fired, p=', p.x.toFixed(1)+','+p.y.toFixed(1), 'calib=', !!grid.calib, 'active=', !!(grid.calib&&grid.calib.active));
    if (!grid.calib || !grid.calib.active || !grid.align || !grid.imgEl) return;
    const iw = grid.imgEl.width, ih = grid.imgEl.height;
    const _cv = $('#grid-align-canvas');
    if (!_cv) return;
    const sc = _cv.width / iw; // canvas px -> image px
    const imgX = p.x / sc, imgY = p.y / sc;
    grid.calib.pts.push({ x: imgX, y: imgY });
    const status = $('#grid-calib-status');
    if (grid.calib.pts.length === 1) {
      if (status) status.textContent = '已记录 P1。请点击另一个远处交点（P2，尽量同一行/列、离 P1 远）。';
    } else if (grid.calib.pts.length === 2) {
      const A = grid.calib.pts[0], B = grid.calib.pts[1];
      const dx = B.x - A.x, dy = B.y - A.y;
      const curCellPx = Math.max(2, grid.align.cell * iw);
      let dc, dr;
      if (Math.abs(dx) >= Math.abs(dy)) { dc = Math.max(1, Math.round(Math.abs(dx) / curCellPx)); dr = 0; }
      else { dc = 0; dr = Math.max(1, Math.round(Math.abs(dy) / curCellPx)); }
      const dcEl = $('#grid-calib-dc'), drEl = $('#grid-calib-dr');
      if (dcEl) dcEl.value = dc; if (drEl) drEl.value = dr;
      if (status) status.textContent = '已记录 P2（距 P1 ' + Math.round(Math.hypot(dx, dy)) + 'px）。请确认两点间相隔的格数，再点「应用校准」。';
    }
    gridDrawAlign();
  }
  function gridCalibApply() {
    if (!grid.calib || !grid.calib.pts || grid.calib.pts.length < 2 || !grid.align || !grid.imgEl) return toast('请先在图上点选两个交点', 'warn');
    const dc = parseInt($('#grid-calib-dc').value, 10) || 0;
    const dr = parseInt($('#grid-calib-dr').value, 10) || 0;
    if (dc === 0 && dr === 0) return toast('横向/纵向格数不能都为 0', 'error');
    const iw = grid.imgEl.width, ih = grid.imgEl.height;
    const A = grid.calib.pts[0], B = grid.calib.pts[1];
    const vx = B.x - A.x, vy = B.y - A.y;
    const det = dc * dc + dr * dr;
    const Kc = (vx * dc + vy * dr) / det; // = cellPx*cos(rot)
    const Ks = (vy * dc - vx * dr) / det; // = cellPx*sin(rot)
    const cellPx = Math.sqrt(Kc * Kc + Ks * Ks);
    const rot = Math.atan2(Ks, Kc);
    if (!(cellPx > 0) || !isFinite(cellPx)) return toast('校准失败：距离/格数异常', 'error');
    // 相位对齐：让 P1 精确落在交点上（中心点 = P1 沿 -dc,-dr 方向回退 cellPx 格）
    const centerX = A.x - (dc * Kc - dr * Ks);
    const centerY = A.y - (dc * Ks + dr * Kc);
    grid.align.cell = cellPx / iw;
    grid.align.rot = rot;
    grid.align.cx = Math.min(1, Math.max(0, centerX / iw));
    grid.align.cy = Math.min(1, Math.max(0, centerY / ih));
    const cellEl = $('#grid-cell'); if (cellEl) cellEl.value = Math.round(cellPx);
    const rotEl = $('#grid-rot'); if (rotEl) rotEl.value = (rot * 180 / Math.PI).toFixed(2);
    gridStopCalib(true);
    gridDrawAlign();
    toast('✓ 已校准：格距 ' + Math.round(cellPx) + 'px，旋转 ' + (rot * 180 / Math.PI).toFixed(2) + '°', 'success');
  }

  // 对齐画布：原图 + 正交网格预览 + 中心十字手柄
  function gridDrawAlign() {
    const cv = $('#grid-align-canvas');
    if (!cv || !grid.imgEl) return;
    const img = grid.imgEl;
    const Wpx = 1000;
    const Hpx = Math.max(1, Math.round(img.height * (Wpx / img.width)));
    cv.width = Wpx; cv.height = Hpx;
    cv.style.aspectRatio = Wpx + '/' + Hpx;
    cv.style.maxWidth = 'none';
    cv.style.width = ((grid.zoom || 1) * 100) + '%';
    cv.style.height = 'auto';
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, Wpx, Hpx);
    if (!grid.align) return;
    const a = grid.align, iw = img.width, ih = img.height;
    const sx = Wpx / iw, sy = Hpx / ih;
    const node = (ri, ci) => { const p = gridNodePx(a, ri, ci, iw, ih); return { x: p.x * sx, y: p.y * sy }; };
    ctx.strokeStyle = 'rgba(99,102,241,0.5)'; ctx.lineWidth = 1;
    if (a.cols > 0 && a.rows > 0) {
      for (let ci = 0; ci <= a.cols; ci++) {
        const A = node(0, ci), B = node(a.rows, ci);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      for (let ri = 0; ri <= a.rows; ri++) {
        const A = node(ri, 0), B = node(ri, a.cols);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
    }
    // 校准模式：保持十字光标
    if (grid.calib && grid.calib.active) { const _ccv2 = $('#grid-align-canvas'); if (_ccv2) _ccv2.style.cursor = 'crosshair'; }
    if (grid.calib && grid.calib.active && grid.calib.pts && grid.calib.pts.length) {
      const scx = cv.width / iw, scy = cv.height / ih;
      grid.calib.pts.forEach((pt, idx) => {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(pt.x * scx, pt.y * scy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('P' + (idx + 1), pt.x * scx + 9, pt.y * scy + 4);
      });
    }
    const ctr = { x: a.cx * cv.width, y: a.cy * cv.height };
    ctx.save();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ctr.x - 16, ctr.y); ctx.lineTo(ctr.x + 16, ctr.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ctr.x, ctr.y - 16); ctx.lineTo(ctr.x, ctr.y + 16); ctx.stroke();
    ctx.beginPath(); ctx.arc(ctr.x, ctr.y, 6, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.restore();
  }
  // 结果渲染 v11：用 <img> 显示 warp 产物（绕开 canvas drawImage 跨域/taint 静默失败）
  // 核心发现：gridWarp 的 toDataURL 能产出有内容的 PNG（v9 调试 img 已验证），
  // 但必须在正确的时机和位置插入 DOM
  function gridDrawResult() {
    const cv = $('#grid-result-canvas');
    console.log('[gridDrawResult] v11 START cv=', !!cv, 'warp=', !!grid.warp, 'cells=', !!(grid.cells && grid.cells.length));
    if (!cv || !grid.warp || !grid.cells) { console.warn('[gridDrawResult] EARLY RETURN'); return; }
    const w = grid.warp.width, h = grid.warp.height;

    // 诊断：检查 warp canvas 本身是否有内容
    let warpDataSize = 0, warpCenterPixel = [255,255,255];
    try {
      const wd = grid.warp.getContext('2d').getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
      warpCenterPixel = [wd[0], wd[1], wd[2]];
    } catch(e) { console.warn('[gridDrawResult] warp getImageData failed (taint?):', e.message); }

    let warpUrl = '';
    try {
      warpUrl = grid.warp.toDataURL('image/png');
      warpDataSize = warpUrl.length;
    } catch(e) { console.warn('[gridDrawResult] toDataURL failed:', e.message); }
    console.log('[gridDrawResult] v11 DIAG', w+'x'+h, 'warpCenter='+warpCenterPixel.join(','),
      'dataURLsize='+warpDataSize, 'urlStarts='+warpUrl.substring(0,30));

    // 清除旧元素
    ['grid-warp-display-img','grid-highlight-canvas','grid-grid-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // 创建结果容器（确保布局独立）
    let container = document.getElementById('grid-result-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'grid-result-container';
      container.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;';
      cv.parentNode.insertBefore(container, cv);
    } else {
      container.innerHTML = '';
    }

    // 1) 主图 <img> —— 用 warp 的 toDataURL
    if (warpUrl && warpDataSize > 1000) {
      const img = document.createElement('img');
      img.id = 'grid-warp-display-img';
      img.src = warpUrl;
      img.style.cssText = 'display:block;width:100%;height:auto;max-width:none;border:3px solid #8b5cf6;border-radius:8px;background:#fff;object-fit:contain;';
      img.alt = '识别结果 ' + grid.cols + '×' + grid.rows;
      container.appendChild(img);
      img.onload = () => console.log('[gridDrawResult] IMG LOADED', img.naturalWidth, 'x', img.naturalHeight);
      img.onerror = (e) => console.error('[gridDrawResult] IMG LOAD ERROR', e);
    } else {
      console.warn('[gridDrawResult] warpUrl empty or too small, skipping img');
      // fallback：直接把 warp canvas 插入 DOM（canvas→DOM 不受 taint 影响）
      grid.warp.style.cssText = 'display:block;width:100%;height:auto;border:3px solid #ef4444;border-radius:8px;';
      grid.warp.id = 'grid-warp-display-canvas';
      container.appendChild(grid.warp);
    }

    // 2) 网格线叠加 canvas（透明，覆盖在图上）
    const overlay = document.createElement('canvas');
    overlay.id = 'grid-grid-overlay';
    overlay.width = w; overlay.height = h;
    overlay.style.cssText = 'display:block;width:100%;height:auto;border:1px solid rgba(128,128,128,0.3);border-radius:4px;';
    container.appendChild(overlay);
    const octx = overlay.getContext('2d');
    octx.fillStyle = '#fff'; octx.fillRect(0, 0, w, h);
    // 从 warp 复制像素到 overlay（如果 warp 可读）
    try { octx.drawImage(grid.warp, 0, 0); } catch(e) { /* taint, skip */ }
    const cw = w / grid.cols, ch = h / grid.rows;
    octx.strokeStyle = 'rgba(0,0,0,0.2)'; octx.lineWidth = 1;
    for (let c = 0; c <= grid.cols; c++) { octx.beginPath(); octx.moveTo(c*cw,0); octx.lineTo(c*cw,h); octx.stroke(); }
    for (let r = 0; r <= grid.rows; r++) { octx.beginPath(); octx.moveTo(0,r*ch); octx.lineTo(w,r*ch); octx.stroke(); }

    // 3) 隐藏原 result-canvas（保留但不显示）
    cv.style.display = 'none';

    console.log('[gridDrawResult] v11 DONE');
  }
  function gridCodeCounts() {
    const m = new Map();
    if (!grid.cells) return m;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) {
        const code = grid.cells[r][c] && grid.cells[r][c].code;
        if (code) m.set(code, (m.get(code) || 0) + 1);
      }
    return m;
  }
  function gridRenderStats() {
    const el = $('#grid-stats');
    if (!el) return;
    const counts = gridCodeCounts();
    const arr = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    el.innerHTML = arr.length ? arr.map(([code, n]) => {
      const bead = beadByCode(code);
      const sw = bead ? bead.hex : '#cbd5e1';
      const active = grid.highlight === code;
      return `<button class="grid-stat-chip relative flex flex-col items-center p-2 rounded-xl border ${active ? 'ring-2 ring-mk-rose border-mk-rose' : 'border-mk-sand bg-white/70'} hover:bg-white transition" data-code="${escapeHtml(code)}">
        <span class="w-7 h-7 rounded-full swatch mb-1" style="background:${sw}"></span>
        <span class="text-xs font-bold">${escapeHtml(code)}</span>
        <span class="text-[10px] text-mk-sub">${n} 格</span>
        ${bead ? '' : '<span class="absolute top-1 right-1 text-[9px] px-1 rounded-full bg-amber-100 text-amber-600">缺</span>'}
      </button>`;
    }).join('') : '<p class="text-xs text-mk-sub col-span-full">没有识别到任何色号，请重新识别或手动点击格子填写。</p>';
    $$('#grid-stats .grid-stat-chip').forEach(b => b.onclick = () => {
      const code = b.dataset.code;
      grid.highlight = (grid.highlight === code) ? null : code;
      gridDrawResult();
      gridRenderStats();
    });
    gridRenderActions(counts);
  }
  function gridRenderActions(counts) {
    const el = $('#grid-actions');
    if (!el) return;
    let matched = 0, missing = 0, total = 0;
    counts.forEach((n, code) => { total += n; if (beadByCode(code)) matched += n; else missing += n; });
    el.innerHTML = `
      <div class="text-xs text-mk-sub w-full">共 <b>${counts.size}</b> 种色号 · <b>${total}</b> 格 · 库存匹配 <b class="text-emerald-600">${matched}</b> · <span class="text-amber-600">缺货/未录入 ${missing}</span></div>
      <button id="grid-save" type="button" class="px-4 py-2 rounded-xl bg-mk-lav text-mk-ink text-sm font-semibold hover:bg-mk-lav/80">💾 存为配方</button>
      <button id="grid-deduct" type="button" class="px-4 py-2 rounded-xl bg-mk-rose text-white text-sm font-semibold hover:opacity-90">➖ 扣减库存</button>`;
    $('#grid-save').onclick = () => {
      const items = [];
      counts.forEach((n, code) => {
        const bead = beadByCode(code);
        if (bead) items.push({ colorNumber: bead.colorNumber, colorName: bead.colorName, hex: bead.hex, qty: n });
      });
      if (!items.length) return toast('没有可保存的已匹配色号', 'warn');
      const def = '网格图纸 ' + fmtTime(Date.now());
      const name = (window.prompt('配方名称', def) || '').trim() || def;
      state.recipes.unshift({ id: uid('rc'), name, createdAt: Date.now(), items });
      save();
      toast('已保存到配方库', 'success');
      switchView('recipes');
    };
    $('#grid-deduct').onclick = () => {
      let ok = 0, skip = 0;
      counts.forEach((n, code) => {
        const b = beadByCode(code);
        if (!b) { skip++; return; }
        b.stock = Math.max(0, b.stock - n);
        addLog('图纸消耗', b, -n, '网格图纸识别扣减');
        ok++;
      });
      save();
      switchView('dashboard');
      toast(`已扣减 ${ok} 种颜色${skip ? `，跳过 ${skip} 种未匹配` : ''}`, 'success');
    };
  }
  function gridOpenCellEditor(r, c) {
    const cell = grid.cells[r][c];
    const body = `<div class="space-y-3">
      <div class="text-sm text-mk-sub">第 ${r + 1} 行 · 第 ${c + 1} 列</div>
      <input id="cell-code" type="text" value="${escapeHtml(cell.code)}" placeholder="输入色号，如 B12 / W3" class="w-full px-3 py-2 rounded-xl bg-mk-sand/30 border border-mk-sand text-sm font-semibold uppercase">
      <div id="cell-match" class="text-xs min-h-[1rem]"></div>
    </div>`;
    openModal('编辑格子色号', body, {}, () => {});
    const input = $('#cell-code');
    const match = $('#cell-match');
    const refresh = () => {
      const code = gridSanitizeCode(input.value);
      const bead = code ? beadByCode(code) : null;
      match.innerHTML = bead
        ? `<span class="inline-block w-4 h-4 rounded-full swatch align-middle mr-1" style="background:${bead.hex}"></span> 匹配库存：${escapeHtml(bead.colorName || bead.colorNumber)}`
        : (code ? '<span class="text-amber-600">库存中无此色号</span>' : '');
    };
    input.oninput = refresh; refresh();
    setModalFoot(`<button class="px-4 py-2 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" onclick="closeModal()">取消</button>
      <button id="cell-ok" class="px-4 py-2 rounded-xl bg-mk-rose text-white font-semibold">保存</button>`);
    $('#cell-ok').onclick = () => {
      cell.code = gridSanitizeCode(input.value);
      cell.src = 'manual';
      closeModal();
      gridDrawResult(); gridRenderStats();
    };
  }
  function gridOpenGalleryPicker() {
    const imgs = state.gallery.filter(g => g.image);
    const body = imgs.length
      ? `<div class="grid grid-cols-3 gap-2">${imgs.map((g, i) => `<button class="gpick rounded-xl overflow-hidden border border-mk-sand hover:ring-2 hover:ring-mk-rose" data-i="${i}"><img src="${g.image}" class="w-full aspect-square object-cover"><div class="text-[10px] px-1 py-0.5 truncate">${escapeHtml(g.name)}</div></button>`).join('')}</div>`
      : '<p class="text-sm text-mk-sub">图库还没有带图的图纸，先去「图库」上传吧。</p>';
    openModal('从图库导入图纸', body, { wide: true });
    $$('.gpick').forEach(b => b.onclick = () => {
      const g = imgs[+b.dataset.i];
      if (!g) return;
      grid.image = g.image;
      gridReset(true); grid.cropped = false; grid.cropRegion = null;
      closeModal();
      renderGrid(GV);
    });
  }
  function gridEnsureImage(cb) {
    if (grid.imgEl && grid.imgEl.src === grid.image) { cb(grid.imgEl); return; }
    const img = new Image();
    img.onload = () => { grid.imgEl = img; cb(img); };
    img.onerror = () => toast('图片加载失败', 'error');
    img.src = grid.image;
  }
  async function gridRunRecognize() {
    const v = GV;
    if (grid.busy) return;
    if (!grid.cols || !grid.rows) return toast('请先填写列数/行数，或点「自动检测网格」', 'error');
    if (!grid.align) return toast('请先对齐网格（拖动红色十字到网格交点）', 'error');
    if (grid.engine === 'vision') {
      const viaProxy = !state.settings.visionBaseUrl || !state.settings.visionBaseUrl.trim() || state.settings.visionBaseUrl.trim().indexOf('/api/') === 0;
      const ready = viaProxy || (state.settings.enableVision && state.settings.apiKey);
      if (!ready) return toast('当前无法用云端视觉：请在「设置 → 云端视觉AI」启用（默认走内置代理）或先填 Key', 'warn', 4000);
      const n = grid.cols * grid.rows;
      if (n > 800) toast('网格较大（' + n + ' 格），云端视觉将分块识别，请耐心等待进度完成', 'info', 3500);
    }
    grid.busy = true; grid.cancel = false;
    renderGrid(v);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('图片加载失败')); i.src = grid.image; });
      grid.imgEl = img;
      if (grid.engine === 'tesseract') await gridRecognizeTesseract(img);
      else await gridRecognizeVision(img);
      const n = gridCodeCounts();
      grid.busy = false;
      renderGrid(v);
      toast(`识别完成：共 ${n.size} 种色号、${[...n.values()].reduce((a, b) => a + b, 0)} 个有码格子`, 'success');
    } catch (e) {
      console.error(e);
      grid.busy = false;
      renderGrid(v);
      toast('识别失败：' + (e && e.message ? e.message : e), 'error');
    }
  }
  function setGridProgress(pct, text) {
    const bar = $('#grid-progress-bar'), txt = $('#grid-progress-text');
    if (bar) bar.style.width = (Math.max(0, Math.min(100, pct || 0))) + '%';
    if (txt) txt.textContent = text || '';
  }
  async function gridRecognizeVision(img) {
    const cellPx = gridCellPx();
    const warp = gridWarp(img, grid.align, grid.cols, grid.rows, cellPx);
    grid.warp = warp;
    // 大模型无法一次吐出几千个色号（会截断/读不清）。切成接近方形的小块：
    // 每块 <= ~300 格、图片近方形，模型在上下文分辨率下才读得清每个色号；逐块识别后拼回二维数组。
    const target = 300;
    const blockN = Math.max(1, Math.round(Math.sqrt(target)));
    const blockCols = Math.max(1, Math.min(grid.cols, blockN));
    const blockRows = Math.max(1, Math.min(grid.rows, blockN));
    const nBc = Math.max(1, Math.ceil(grid.cols / blockCols));
    const nBr = Math.max(1, Math.ceil(grid.rows / blockRows));
    const totalBlocks = nBc * nBr;
    grid.cells = [];
    for (let r = 0; r < grid.rows; r++) grid.cells.push(new Array(grid.cols).fill(null));
    let doneBlocks = 0;
    setGridProgress(2, '准备分块识别（' + grid.cols + '×' + grid.rows + '，共 ' + totalBlocks + ' 块）');
    for (let br = 0; br < nBr; br++) {
      if (grid.cancel) throw new Error('已取消');
      const r0 = br * blockRows, rN = Math.min(grid.rows - r0, blockRows);
      for (let bc = 0; bc < nBc; bc++) {
        if (grid.cancel) throw new Error('已取消');
        const c0 = bc * blockCols, cN = Math.min(grid.cols - c0, blockCols);
        const x0 = Math.round(c0 * cellPx), y0 = Math.round(r0 * cellPx);
        const bw = Math.round(cN * cellPx), bh = Math.round(rN * cellPx);
        const tmp = document.createElement('canvas');
        tmp.width = bw; tmp.height = bh;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(warp, x0, y0, bw, bh, 0, 0, bw, bh);
        const dataUrl = tmp.toDataURL('image/png');
        const label = (br + 1) + '/' + nBr + ' 行块 · ' + (bc + 1) + '/' + nBc + ' 列块';
        setGridProgress(Math.round(doneBlocks / totalBlocks * 100), '识别中 第 ' + (doneBlocks + 1) + '/' + totalBlocks + ' 块（' + label + '）');
        let res, tries = 0;
        while (true) {
          try {
            res = await callGridVisionAPI(dataUrl, rN, cN, state.settings.apiKey, state.settings.model, state.settings.visionBaseUrl);
            break;
          } catch (err) {
            tries++;
            if (tries >= 2) {
              console.warn('[grid] 第 ' + (doneBlocks + 1) + '/' + totalBlocks + ' 块识别失败，已跳过：' + (err && err.message ? err.message : err));
              break;
            }
            await new Promise(r => setTimeout(r, 600));
          }
        }
        if (!res) { doneBlocks++; setGridProgress(Math.round(doneBlocks / totalBlocks * 100), '已跳过 ' + doneBlocks + '/' + totalBlocks + ' 块'); continue; }
        const g = res.grid || [];
        for (let i = 0; i < rN; i++) {
          const src = g[i] || [];
          for (let c = 0; c < cN; c++)
            grid.cells[r0 + i][c0 + c] = { code: gridSanitizeCode(src[c]), src: 'vision', conf: 0 };
        }
        doneBlocks++;
        setGridProgress(Math.round(doneBlocks / totalBlocks * 100), '已识别 ' + doneBlocks + '/' + totalBlocks + ' 块');
      }
    }
    setGridProgress(100, '识别完成');
  }
  async function gridRecognizeTesseract(img) {
    const cellPx = gridCellPx();
    const warp = gridWarp(img, grid.align, grid.cols, grid.rows, cellPx);
    grid.warp = warp;
    const worker = await gridGetWorker();
    grid.cells = [];
    for (let r = 0; r < grid.rows; r++) {
      const row = [];
      for (let c = 0; c < grid.cols; c++) row.push({ code: '', src: '', conf: 0 });
      grid.cells.push(row);
    }
    const total = grid.rows * grid.cols;
    let done = 0;
    const m = Math.round(cellPx * 0.12);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.cancel) throw new Error('已取消');
        const cw = cellPx - 2 * m, ch = cellPx - 2 * m;
        const tmp = document.createElement('canvas');
        tmp.width = cw * 2; tmp.height = ch * 2;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(warp, c * cellPx + m, r * cellPx + m, cw, ch, 0, 0, cw * 2, ch * 2);
        const { data } = await worker.recognize(tmp);
        grid.cells[r][c] = { code: gridSanitizeCode(data.text), src: 'ocr', conf: data.confidence || 0 };
        done++;
        if (done % 4 === 0 || done === total) {
          const pct = Math.round(done / total * 100);
          const bar = $('#grid-progress-bar'), txt = $('#grid-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `已识别 ${done}/${total}`;
        }
      }
    }
  }
  function gridBindAlign() {
    const cv = $('#grid-align-canvas');
    if (!cv || !grid.align) return;
    let dragging = false;
    const toCanvas = (ev) => {
      const rect = cv.getBoundingClientRect();
      const cx = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
      const cy = ev.clientY !== undefined ? ev.clientY : (ev.touches && ev.touches[0] && ev.touches[0].clientY);
      return { x: (cx - rect.left) / rect.width * cv.width, y: (cy - rect.top) / rect.height * cv.height };
    };
    const hitCenter = (p) => Math.hypot(p.x - grid.align.cx * cv.width, p.y - grid.align.cy * cv.height) < 24;
    const down = (ev) => {
      if (grid.calib && grid.calib.active) return; // 校准模式下不拖十字
      if (!grid.align) return; const p = toCanvas(ev); if (hitCenter(p)) { dragging = true; ev.preventDefault(); }
    };
    const calibClick = (ev) => { if (grid.calib && grid.calib.active) { ev.preventDefault(); gridCalibClick(toCanvas(ev)); } };
    cv.addEventListener('click', calibClick);
    // 备用：touchend 也触发校准点击（部分设备/浏览器 touch 后不触发 click）
    const calibTouchEnd = (ev) => { if (grid.calib && grid.calib.active) { ev.preventDefault(); const t = ev.changedTouches && ev.changedTouches[0]; if (t) gridCalibClick({ clientX: t.clientX, clientY: t.clientY }); } };
    cv.addEventListener('touchend', calibTouchEnd);
    const move = (ev) => {
      if (!dragging) { cv.style.cursor = hitCenter(toCanvas(ev)) ? 'grab' : 'default'; return; }
      ev.preventDefault(); cv.style.cursor = 'grabbing';
      const p = toCanvas(ev);
      grid.align.cx = Math.min(1, Math.max(0, p.x / cv.width));
      grid.align.cy = Math.min(1, Math.max(0, p.y / cv.height));
      gridDrawAlign();
    };
    const up = () => { dragging = false; };
    cv.onmousedown = down; cv.onmousemove = move; cv.onmouseup = up; cv.onmouseleave = up;
    cv.addEventListener('touchstart', (e) => down(e), { passive: false });
    cv.addEventListener('touchmove', (e) => move(e), { passive: false });
    cv.addEventListener('touchend', up);
    cv.onwheel = (e) => {
      if (!grid.align) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      grid.zoom = Math.min(5, Math.max(0.3, (grid.zoom || 1) * f));
      gridDrawAlign();
    };
    cv.ondblclick = () => { grid.zoom = 1; gridDrawAlign(); };
  }
  function gridBindResult() {
    const cv = $('#grid-result-canvas');
    if (!cv || !grid.warp) return;
    const handler = (ev) => {
      const rect = cv.getBoundingClientRect();
      const cx = ev.clientX !== undefined ? ev.clientX : (ev.changedTouches && ev.changedTouches[0] && ev.changedTouches[0].clientX);
      const cy = ev.clientY !== undefined ? ev.clientY : (ev.changedTouches && ev.changedTouches[0] && ev.changedTouches[0].clientY);
      if (cx == null || cy == null) return;
      const x = (cx - rect.left) / rect.width * cv.width;
      const y = (cy - rect.top) / rect.height * cv.height;
      const cw = cv.width / grid.cols, ch = cv.height / grid.rows;
      const c = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / cw)));
      const r = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / ch)));
      gridOpenCellEditor(r, c);
    };
    cv.onclick = handler;
    cv.addEventListener('touchstart', (e) => { e.preventDefault(); handler(e); }, { passive: false });
  }
  // ---- 剪裁模式：渲染剪裁画布 + 拖拽框选 ----
  let gridCropDrag = null; // {x0,y0,x1,y1} 归一化拖拽状态
  function gridRenderCrop() {
    const cv = $('#grid-crop-canvas');
    if (!cv || !grid.image) return;
    const img = new Image();
    img.onload = () => {
      const Wpx = 1000;
      const Hpx = Math.max(1, Math.round(img.height * (Wpx / img.width)));
      cv.width = Wpx; cv.height = Hpx;
      cv.style.aspectRatio = Wpx + '/' + Hpx;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, Wpx, Hpx);
      // 默认选区：留 3% 边距
      if (!grid.cropRegion) grid.cropRegion = { x: 0.03, y: 0.03, w: 0.94, h: 0.94 };
      const r = grid.cropRegion;
      // 半透明暗色蒙层
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, Wpx, Hpx);
      // 选区亮显
      ctx.drawImage(img,
        r.x * img.width, r.y * img.height, r.w * img.width, r.h * img.height,
        r.x * Wpx, r.y * Hpx, r.w * Wpx, r.h * Hpx
      );
      // 选区边框
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
      ctx.strokeRect(r.x * Wpx, r.y * Hpx, r.w * Wpx, r.h * Hpx);
      // 拖拽中的临时框
      if (gridCropDrag) {
        const dx0 = Math.min(gridCropDrag.x0, gridCropDrag.x1) * Wpx;
        const dy0 = Math.min(gridCropDrag.y0, gridCropDrag.y1) * Hpx;
        const dw = Math.abs(gridCropDrag.x1 - gridCropDrag.x0) * Wpx;
        const dh = Math.abs(gridCropDrag.y1 - gridCropDrag.y0) * Hpx;
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        ctx.strokeRect(dx0, dy0, dw, dh);
        ctx.setLineDash([]);
      }
    };
    img.src = grid.image;
  }
  function gridBindCropEvents(cv) {
    if (!cv) return;
    const getPos = (e) => {
      const rect = cv.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return { x: (touch.clientX - rect.left) / rect.width, y: (touch.clientY - rect.top) / rect.height };
    };
    const onDown = (e) => {
      e.preventDefault();
      const p = getPos(e);
      gridCropDrag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    };
    const onMove = (e) => {
      if (!gridCropDrag) return;
      e.preventDefault();
      const p = getPos(e);
      gridCropDrag.x1 = p.x; gridCropDrag.y1 = p.y;
      gridRenderCrop();
    };
    const onUp = () => {
      if (!gridCropDrag) return;
      const x0 = Math.min(gridCropDrag.x0, gridCropDrag.x1), y0 = Math.min(gridCropDrag.y0, gridCropDrag.y1);
      const x1 = Math.max(gridCropDrag.x0, gridCropDrag.x1), y1 = Math.max(gridCropDrag.y0, gridCropDrag.y1);
      if (x1 - x0 > 0.02 && y1 - y0 > 0.02) {
        grid.cropRegion = { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(1 - x0, x1 - x0), h: Math.min(1 - y0, y1 - y0) };
      }
      gridCropDrag = null;
      gridRenderCrop();
    };
    cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseup', onUp);
    cv.addEventListener('mouseleave', onUp);
    cv.addEventListener('touchstart', onDown, { passive: false });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onUp);
  }
  function gridConfirmCrop(v) {
    if (!grid.image || !grid.cropRegion) return;
    const img = new Image();
    img.onload = () => {
      const r = grid.cropRegion;
      const tmp = document.createElement('canvas');
      tmp.width = Math.round(r.w * img.width);
      tmp.height = Math.round(r.h * img.height);
      const ctx = tmp.getContext('2d');
      ctx.drawImage(img, r.x * img.width, r.y * img.height, r.w * img.width, r.h * img.height, 0, 0, tmp.width, tmp.height);
      grid.image = tmp.toDataURL('image/png');
      grid.cropped = true;
      // 重新加载剪裁后的图片（重置 align）
      const croppedImg = new Image();
      croppedImg.onload = () => {
        grid.imgEl = croppedImg;
        gridInitAlign();
        renderGrid(v);
      };
      croppedImg.src = grid.image;
    };
    img.src = grid.image;
  }
  function gridSkipCrop(v) {
    grid.cropped = true;
    grid.cropRegion = null;
    if (!grid.imgEl && grid.image) {
      const img = new Image();
      img.onload = () => { grid.imgEl = img; gridInitAlign(); renderGrid(v); };
      img.src = grid.image;
    } else if (grid.imgEl) {
      gridInitAlign();
      renderGrid(v);
    } else {
      renderGrid(v);
    }
  }

  function renderGrid(v) {
    GV = v;
    const hasImg = !!grid.image;
    const hasCells = !!(grid.cells && grid.rows && grid.cols);
    v.innerHTML = `
      <div class="flex flex-col gap-4">
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h2 class="text-xl font-bold mb-1">🧩 拼豆模式 · 网格图纸识别</h2>
          <p class="text-sm text-mk-sub mb-4">上传或导入一张「每个格子都印有色号文字」的拼豆图纸。拖动红色十字对齐网格交点、调格子大小/旋转贴合 → 识别每个格子的色号 → 统计用量 → 点击色号高亮对应格子。</p>
          <div class="flex flex-wrap gap-2">
            <label class="px-3 py-1.5 rounded-lg bg-mk-rose text-white text-xs font-semibold cursor-pointer hover:opacity-90">📤 上传图纸<input id="grid-upload" type="file" accept="image/*" class="hidden"></label>
            <button id="grid-from-gallery" type="button" class="px-3 py-1.5 rounded-lg bg-mk-sky/70 text-mk-ink text-xs font-semibold hover:bg-mk-sky/90">📂 从图库导入</button>
            ${hasImg ? `<button id="grid-clear-img" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">↺ 换图</button>` : ''}
          </div>
          ${!hasImg ? `<div class="mt-4 text-sm text-mk-sub">还没有图纸。点「上传图纸」选择本地图片，或「从图库导入」已保存的图纸。</div>` : ''}
        </section>

        ${hasImg && grid.cropped ? `
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-2">② 对齐网格</h3>
          <p class="text-[11px] text-mk-sub mb-2">把图上的<span class="text-rose-500 font-semibold">红色十字</span>中心点拖到图纸某个网格交叉点上，再调「格子大小」让网格贴合。若远处仍对不齐（累积误差），用<span class="text-violet-600 font-semibold">📏 两点校准格距</span>：点两个真实交点 + 填相隔格数，系统自动算出精确格距与旋转。先填列数/行数，或点「自动检测」。</p>
          <div class="relative inline-block w-full">
            <div class="grid-canvas-wrap w-full rounded-xl border border-mk-sand bg-white overflow-auto" style="max-height:min(58vh,520px)"><canvas id="grid-align-canvas" class="block" style="touch-action:none;width:100%;height:auto;"></canvas></div>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3">
            <label class="text-xs text-mk-sub">列数 <input id="grid-cols" type="number" min="1" max="400" value="${grid.cols || ''}" class="w-16 px-2 py-1 rounded bg-mk-sand/30 border border-mk-sand text-sm"></label>
            <label class="text-xs text-mk-sub">行数 <input id="grid-rows" type="number" min="1" max="400" value="${grid.rows || ''}" class="w-16 px-2 py-1 rounded bg-mk-sand/30 border border-mk-sand text-sm"></label>
            <button id="grid-auto" type="button" class="px-3 py-1.5 rounded-lg bg-mk-lav/70 text-mk-ink text-xs font-semibold hover:bg-mk-lav/90">🎯 自动检测网格</button>
            <button id="grid-calib-btn" type="button" class="px-3 py-1.5 rounded-lg bg-violet-400/80 text-white text-xs font-semibold hover:bg-violet-400">📏 两点校准格距</button>
            <div id="grid-calib-panel" class="hidden mt-3 p-3 bg-violet-50/60 rounded-xl border border-violet-200">
              <p class="text-[11px] text-mk-sub mb-2">① 拖红色十字对准一个交点（已完成）→ ② 点上方「📏 两点校准格距」→ ③ 在图上点<span class="text-rose-500 font-semibold">另一个远处交点</span>（尽量同一行/列、离得远）→ ④ 填两点间相隔的格数 → 应用。</p>
              <div class="flex flex-wrap items-center gap-3">
                <label class="text-xs text-mk-sub">横向跨几格 <input id="grid-calib-dc" type="number" min="1" max="400" value="10" class="w-16 px-2 py-1 rounded bg-white border border-mk-sand text-sm"></label>
                <label class="text-xs text-mk-sub">纵向跨几格 <input id="grid-calib-dr" type="number" min="0" max="400" value="0" class="w-16 px-2 py-1 rounded bg-white border border-mk-sand text-sm"></label>
                <button id="grid-calib-apply" type="button" class="px-3 py-1.5 rounded-lg bg-mk-rose text-white text-xs font-semibold">✓ 应用校准</button>
                <button id="grid-calib-cancel" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs">取消</button>
              </div>
              <p id="grid-calib-status" class="text-[11px] text-violet-700 mt-2"></p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3">
            <label class="text-xs text-mk-sub">格子大小(px) <input id="grid-cell" type="number" min="2" max="4000" value="${grid.align ? Math.round(grid.align.cell * grid.imgEl.width) : ''}" class="w-20 px-2 py-1 rounded bg-mk-sand/30 border border-mk-sand text-sm"></label>
            <label class="text-xs text-mk-sub">旋转(°) <input id="grid-rot" type="number" min="-45" max="45" step="0.5" value="${grid.align ? (grid.align.rot * 180 / Math.PI).toFixed(1) : 0}" class="w-20 px-2 py-1 rounded bg-mk-sand/30 border border-mk-sand text-sm"></label>
            <span class="text-[11px] text-mk-sub">滚轮在图上缩放图片（双击复位）· 格子大小用上方「格子大小(px)」调</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3">
            <span class="text-xs text-mk-sub">识别引擎：</span>
            <label class="text-xs flex items-center gap-1"><input type="radio" name="grid-engine" value="vision" ${grid.engine === 'vision' ? 'checked' : ''}> 云端视觉（分块识别大图）</label>
            <label class="text-xs flex items-center gap-1"><input type="radio" name="grid-engine" value="tesseract" ${grid.engine === 'tesseract' ? 'checked' : ''}> 本地OCR（密集网格更准）</label>
            <button id="grid-recognize" type="button" class="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-400 to-sky-400 text-white text-sm font-semibold hover:opacity-90 sm:ml-auto ${grid.busy ? 'opacity-60 cursor-wait' : ''}" ${grid.busy ? 'disabled' : ''}>${grid.busy ? '⏳ 识别中…' : '🔍 识别色号'}</button>
          </div>
          <div id="grid-progress" class="mt-2 ${grid.busy ? '' : 'hidden'}">
            <div class="h-2 rounded-full bg-mk-sand overflow-hidden"><div id="grid-progress-bar" class="h-full bg-mk-rose" style="width:0%"></div></div>
            <div id="grid-progress-text" class="text-[11px] text-mk-sub mt-1"></div>
          </div>
        </section>` :''}

${hasImg && !grid.cropped ? `
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-2">① 剪裁图纸</h3>
          <p class="text-[11px] text-mk-sub mb-2">拖拽框选网格区域，去掉边缘空白后「确认剪裁」进入对齐。或「跳过剪裁」直接用整张图。</p>
          <div class="relative inline-block w-full">
            <div class="w-full rounded-xl border border-mk-sand bg-white overflow-hidden" style="max-height:min(58vh,520px)">
              <canvas id="grid-crop-canvas" class="block w-full" style="touch-action:none"></canvas>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button id="grid-crop-ok" type="button" class="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-400 to-sky-400 text-white text-sm font-semibold hover:opacity-90">✓ 确认剪裁</button>
            <button id="grid-crop-skip" type="button" class="px-4 py-2 rounded-xl bg-white border border-mk-sand text-mk-sub text-sm hover:bg-mk-sand/30">跳过剪裁</button>
          </div>
        </section>` :''}

${hasCells ? `
        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-2">② 识别结果（${grid.rows} 行 × ${grid.cols} 列）</h3>
          <div class="relative inline-block w-full">
            <div class="grid-canvas-wrap-result w-full rounded-xl border border-mk-sand bg-white overflow-hidden" style="max-height:min(72vh,680px)"><canvas id="grid-result-canvas" class="block" style="touch-action:none;width:100%;height:auto;"></canvas></div>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="text-[11px] text-mk-sub">点击上方格子可改色号；点击下方色号可高亮对应格子。</span>
            <button id="grid-clear-hl" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">清除高亮</button>
            <button id="grid-realign" type="button" class="px-3 py-1.5 rounded-lg bg-white border border-mk-sand text-mk-sub text-xs hover:bg-mk-sand/30">重新对齐</button>
          </div>
        </section>

        <section class="mk-card rounded-2xl shadow-soft p-5">
          <h3 class="font-bold mb-2">③ 色号统计（点击高亮）</h3>
          <div id="grid-stats" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"></div>
          <div id="grid-actions" class="flex flex-wrap gap-2 mt-4"></div>
        </section>` : ''}
      </div>`;

    const upload = $('#grid-upload');
    if (upload) upload.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { grid.image = ev.target.result; gridReset(true); grid.cropped = false; grid.cropRegion = null; renderGrid(v); };
      reader.readAsDataURL(file);
    };
    const fromGallery = $('#grid-from-gallery');
    if (fromGallery) fromGallery.onclick = () => gridOpenGalleryPicker();
    const clearImg = $('#grid-clear-img');
    if (clearImg) clearImg.onclick = () => { gridReset(false); grid.cropped = false; grid.cropRegion = null; renderGrid(v); };

    // ---- 剪裁模式绑定 ----
    if (hasImg && !grid.cropped) {
      gridRenderCrop();
      gridBindCropEvents($('#grid-crop-canvas'));
      const cropOk = $('#grid-crop-ok');
      if (cropOk) cropOk.onclick = () => gridConfirmCrop(v);
      const cropSkip = $('#grid-crop-skip');
      if (cropSkip) cropSkip.onclick = () => gridSkipCrop(v);
    }

    // ---- 对齐模式绑定（仅在已剪裁后）----
    if (hasImg && grid.cropped) {
      const ci = $('#grid-cols'), ri = $('#grid-rows');
      if (ci) ci.oninput = () => { grid.cols = Math.max(0, parseInt(ci.value, 10) || 0); if (grid.align) grid.align.cols = grid.cols; gridDrawAlign(); };
      if (ri) ri.oninput = () => { grid.rows = Math.max(0, parseInt(ri.value, 10) || 0); if (grid.align) grid.align.rows = grid.rows; gridDrawAlign(); };
      const autoBtn = $('#grid-auto');
      if (autoBtn) autoBtn.onclick = () => gridAutoDetect();
      const calibBtn = $('#grid-calib-btn');
      if (calibBtn) calibBtn.onclick = () => gridStartCalib();
      const calibApply = $('#grid-calib-apply');
      if (calibApply) calibApply.onclick = () => gridCalibApply();
      const calibCancel = $('#grid-calib-cancel');
      if (calibCancel) calibCancel.onclick = () => gridStopCalib(false);
      const cellEl = $('#grid-cell');
      if (cellEl) cellEl.oninput = () => {
        const v = parseInt(cellEl.value, 10);
        if (grid.align && grid.imgEl && isFinite(v) && v > 0) { grid.align.cell = v / grid.imgEl.width; gridDrawAlign(); }
      };
      const rotEl = $('#grid-rot');
      if (rotEl) rotEl.oninput = () => {
        const d = parseFloat(rotEl.value);
        if (grid.align && isFinite(d)) { grid.align.rot = d * Math.PI / 180; gridDrawAlign(); }
      };
      const recBtn = $('#grid-recognize');
      if (recBtn) recBtn.onclick = () => gridRunRecognize();
      $$('input[name="grid-engine"]').forEach(r => r.onchange = () => { if (r.checked) grid.engine = r.value; });
      gridBindAlign();
      gridEnsureImage(() => {
        if (!grid.align) gridInitAlign();
        gridBindAlign();
        gridDrawAlign();
        if (grid.cols === 0 && grid.rows === 0) gridAutoDetect();
      });
    }

    if (hasCells) {
      gridDrawResult();
      gridRenderStats();
      const clearHl = $('#grid-clear-hl');
      if (clearHl) clearHl.onclick = () => { grid.highlight = null; gridDrawResult(); gridRenderStats(); };
      const realign = $('#grid-realign');
      if (realign) realign.onclick = () => { grid.cells = null; grid.highlight = null; grid.warp = null; renderGrid(v); };
      gridBindResult();
    }
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
            ${pImage ? `<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-2 text-[11px] text-mk-sub"><span>📌 浅色区=识别的图案</span><button id="p-img-zoom" class="px-2 py-0.5 rounded-lg bg-mk-rose text-white font-semibold self-start" title="在大窗口里预览并剪裁（操作更方便）">🔍 点图放大</button></div>` : ''}
            <div class="flex flex-wrap gap-2 mt-2 ${pImage ? '' : 'hidden'}" id="p-crop-bar">
              <button id="p-crop-toggle" class="text-xs px-2.5 py-1.5 rounded-xl ${pImageCropMode ? 'bg-mk-rose text-white' : 'bg-white/70 text-mk-sub border border-mk-sand'}" title="${pImageCropMode ? '保存当前选区并退出编辑' : '进入剪裁编辑模式（4 角 + 4 边 + 内部拖动）'}">${pImageCropMode ? '✓ 完成剪裁' : '✂️ 剪裁'}</button>
              <button id="p-crop-reset" class="text-xs px-2.5 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub" title="选区重置为整张图">↺ 重置选区</button>
              <button id="p-crop-clear" class="text-xs px-2.5 py-1.5 rounded-xl bg-white/70 border border-mk-sand text-mk-sub ${pImageCrop ? '' : 'hidden'}" title="清除剪裁（识别整张图）">✕ 不剪裁</button>
              <span class="text-[11px] text-mk-sub self-center">${pImageCropMode ? '💡 拖 4 角/4 边缩放，拖中间移动' : (pImageCrop ? '📌 已剪裁（深色区不识别）' : '📌 默认识别整张图')}</span>
            </div>
            ${pImage ? `
            <button id="p-ai-redraw" class="w-full mt-2 px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold shadow-soft">🤖 AI 重绘成拼豆风</button>
            <p class="text-[10px] text-mk-sub mt-1">把照片交给 97api 重绘成纯色像素风，再用像素法自动出图。需 Vercel 已配置 <code>PINDOU_API_KEY</code>。</p>` : ''}
            <h3 class="font-bold mb-2 mt-4">🎯 目标网格</h3>
            <div class="flex flex-wrap gap-2 mb-2">
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="29">标准 29</button>
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="14">小板 14</button>
              <button class="preset-board px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/70 text-mk-sub border border-mk-sand" data-preset="6">迷你 6</button>
            </div>
            <div class="flex flex-col sm:flex-row sm:items-end gap-2">
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
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
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
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
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
              <button id="p-save-gallery" class="flex-1 min-w-[40%] text-center px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold shadow-soft">📷 保存到图库</button>
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
      try { localStorage.setItem(STORAGE_KEY, serializeState()); } catch (_) {}
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
    const aiRedrawBtn = $('#p-ai-redraw');
    if (aiRedrawBtn) aiRedrawBtn.onclick = () => patternAiRedraw();
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
    const saveGalleryBtn = $('#p-save-gallery');
    if (saveGalleryBtn) saveGalleryBtn.onclick = patternSaveToGallery;
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

  // AI 重绘：把当前源图发给 /api/image-gen（97api 图生图），结果回写成 pImage 并自动出图
  async function patternAiRedraw() {
    if (!pImage || !pImage.src) { toast('请先上传一张参考图', 'warn'); return; }
    const btn = $('#p-ai-redraw');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '🤖 重绘中…(可能数十秒)'; }
    try {
      const src = pDownscaleDataURL(pImage, 1024); // 降采样减小上行体积与耗时
      const res = await fetch('/api/image-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: src })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.image) throw new Error(j.error || ('HTTP ' + res.status));
      const img = new Image();
      await new Promise((ok, err) => {
        img.onload = ok;
        img.onerror = () => err(new Error('重绘图加载失败'));
        img.src = j.image;
      });
      pImage = img;
      if (img.naturalWidth && img.naturalHeight) pImgAspect = img.naturalWidth / img.naturalHeight;
      pImageCrop = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      pImageCropMode = false;
      const v = $('#view'); if (v) renderPattern(v);
      toast('✅ AI 重绘完成，自动生成图纸', 'success');
      patternRunGenerate({ fromAuto: false });
    } catch (e) {
      toast('AI 重绘失败：' + e.message, 'error', 5000);
    } finally {
      const b2 = $('#p-ai-redraw');
      if (b2) { b2.disabled = false; b2.textContent = oldText; }
    }
  }
  // 把 Image 降采样到 maxDim 以内，返回 dataURL（减少上行体积）
  function pDownscaleDataURL(img, maxDim) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return img.src;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    if (scale >= 1) return img.src;
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(img, 0, 0, cw, ch);
    return c.toDataURL('image/png');
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
          } else if (bgTop && isNearWhite(bgTop.sr / bgTop.n, bgTop.sg / bgTop.n, bgTop.sb / bgTop.n)) {
            // 🆕 整图不是白底，但 cell 主色是近白（如 97api 重绘风里的头发高光/白色衣服/肤色高光）
            // 整张图背景是深蓝 H1 时，整图白底分支不会触发，但局部白格仍是有效色 → 也填最近白色系色号。
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
  function patternBuildPNGBoard() {
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
    return cv;
  }
  function patternExportPNG() {
    const safe = patternSafeName(pName);
    const cv = patternBuildPNGBoard();
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
  // 把当前图纸的 PNG 预览图存到图库：复用 patternBuildPNGBoard 拿图，组装 gallery item
  async function patternSaveToGallery() {
    const bom = patternBOM();
    if (!bom.length) return toast('画布为空，无法保存', 'warn');
    pName = ($('#p-name').value || '').trim();
    const name = pName || ('拼豆图纸 ' + fmtTime(Date.now()));
    const cv = patternBuildPNGBoard();
    const dataURL = cv.toDataURL('image/png');
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const g = {
      id, name, platform: '自制（图纸生成器）', author: '',
      imageId: id, image: dataURL, imageStored: false, status: 'unmade', legend: null,
      createdAt: Date.now()
    };
    state.gallery.unshift(g);
    await persistGalleryImage(g);   // 写 IndexedDB 并摘掉 localStorage 大图
    save();
    toast('已保存到图库「' + name + '」', 'success', 3200);
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
  const brand = $('#brand');
  if (brand) brand.onclick = () => switchView('dashboard');
  switchView('dashboard');
  enableSwipeNavigation();
  // 把弹窗相关函数暴露到 window，让 inline onclick（如 `onclick="closeModal()"`）能正常执行
  // （整个 app.js 是 IIFE 闭包，原来在闭包内的函数外部访问不到）
  window.closeModal = closeModal;
  window.openModal = openModal;
  window.setModalFoot = setModalFoot;
  // 本地测试辅助：把核心算法函数暴露到 window，方便 puppeteer 单元测试
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.__detectLegendRegion = detectLegendRegion;
    window.__refineLegendRegion = refineLegendRegion;
  }
})();
