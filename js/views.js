/* Các màn hình: Tổng quan, Danh mục, Nhập Excel, Khách hàng, Cài đặt */
(function (w) {
  'use strict';
  const $ = U.$, esc = U.esc, fmt = U.fmt, fmtN = U.fmtN, norm = U.norm;
  const Views = {}; w.Views = Views;
  const live = arr => arr.filter(x => !x.deleted_at);
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'vi');
  const owner = () => App.role === 'owner';
  const nowIso = () => new Date().toISOString();

  /* ===================== TỔNG QUAN ===================== */
  Views.home = async () => {
    const P = live(await DB.all('products')).length, G = live(await DB.all('product_groups')).length, C = live(await DB.all('customers')).length;
    const devSet = !!(await DB.getMeta('device'));
    const item = (done, t, d, btn) => '<li class="' + (done ? 'done' : '') + '"><span class="dot">' + (done ? '✓' : '') + '</span><div><b>' + t + '</b><p class="note" style="margin:0">' + d + '</p>' + (btn || '') + '</div></li>';
    return '<div class="g2" style="margin-top:0"><div class="stack">' +
      '<div class="card"><h2>Bắt đầu với ' + esc(App.store.name) + '</h2><ul class="checklist">' +
      item(true, 'Tạo cửa hàng', 'Đã xong. Kho chính đã được tạo sẵn.') +
      item(P > 0, 'Nhập danh mục hàng hóa', P > 0 ? 'Đã có ' + P + ' mặt hàng.' : 'Thêm từng mặt hàng hoặc nhập cả danh sách từ file Excel.',
        owner() ? '<button class="link" data-act="nav" data-v="catalog">Mở danh mục</button>' : '') +
      item(devSet, 'Đặt mã cho máy này', 'Mã máy (A, B, C…) dùng để số đơn hàng không trùng khi nhiều máy bán cùng lúc.', '<button class="link" data-act="nav" data-v="settings">Mở cài đặt</button>') +
      (owner() ? item(false, 'Thêm nhân viên (không bắt buộc)', 'Nhân viên đăng ký tài khoản trước, rồi bạn thêm email của họ.', '<button class="link" data-act="nav" data-v="settings">Mở cài đặt</button>') : '') +
      '</ul></div></div><div class="stack">' +
      '<div class="card"><h2>Số liệu hiện có</h2><div class="stats3"><div class="stat"><b>' + P + '</b><span>Mặt hàng</span></div><div class="stat"><b>' + G + '</b><span>Nhóm hàng</span></div><div class="stat"><b>' + C + '</b><span>Khách hàng</span></div></div></div>' +
      '<div class="card"><h2>Sắp có</h2><p class="note" style="margin:0">Bán hàng, tồn kho theo lô, công nợ và báo cáo sẽ được thêm ở các đợt sau. Dữ liệu bạn nhập hôm nay giữ nguyên, không phải nhập lại.</p></div></div></div>';
  };

  /* ===================== DANH MỤC ===================== */
  Views.catalog = async () => {
    const [groups, prods, units] = await Promise.all([DB.all('product_groups'), DB.all('products'), DB.all('product_units')]);
    Views._cat = { groups: live(groups).sort(byName), prods: live(prods).sort(byName), units: live(units) };
    const s = App.ui.cat;
    return '<div class="toolbar"><div class="searchbar">' + App.ICON('search') + '<input id="cq" data-act="catSearch" data-live="1" placeholder="Tìm hàng theo tên…" value="' + esc(s.q) + '" autocomplete="off" aria-label="Tìm hàng"></div>' +
      '<select id="cg" data-act="catGroup" aria-label="Lọc theo nhóm"></select><span class="spacer"></span>' +
      (owner() ? '<button class="btn" data-act="groupsOpen">Quản lý nhóm</button><button class="btn" data-act="nav" data-v="import">Nhập từ Excel</button><button class="btn primary" data-act="productNew">＋ Thêm hàng</button>' : '') +
      '</div><div class="card" style="padding:6px 8px"><div class="tw"><table><thead><tr><th>Hàng</th><th>Nhóm</th><th>ĐVT</th><th class="r">Giá bán</th><th>Quy đổi</th><th class="r">Tồn tối thiểu</th><th></th></tr></thead><tbody id="catbody"></tbody></table></div><p class="note" id="catnote" style="padding:0 10px 8px"></p></div>';
  };
  Views.after_catalog = async () => { fillGroupSelect(); fillCatRows(); };

  function fillGroupSelect() {
    const sel = $('#cg'); if (!sel) return; const c = Views._cat, g = App.ui.cat.g;
    sel.innerHTML = '<option value="">Tất cả nhóm (' + c.prods.length + ')</option>' + c.groups.map(x => '<option value="' + x.id + '"' + (g === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
  }
  function fillCatRows() {
    const body = $('#catbody'); if (!body || !Views._cat) return;
    const c = Views._cat, s = App.ui.cat, q = norm(s.q);
    const gm = {}; c.groups.forEach(x => { gm[x.id] = x.name; });
    const um = {}; c.units.forEach(u => { (um[u.product_id] = um[u.product_id] || []).push(u); });
    const list = c.prods.filter(p => (!s.g || p.group_id === s.g) && (!q || norm(p.name).indexOf(q) >= 0));
    const shown = list.slice(0, 200);
    body.innerHTML = shown.length ? shown.map(p => {
      const us = (um[p.id] || []).map(u => esc(u.name) + ' = ' + fmtN(u.factor) + ' ' + esc(p.base_unit) + (u.sale_price ? ' · ' + fmt(u.sale_price) : '')).join('<br>');
      return '<tr><td><b>' + esc(p.name) + '</b>' + (p.sold_by_weight ? ' <span class="chip">Bán cân</span>' : '') + '</td><td class="muted">' + esc(gm[p.group_id] || 'Chưa phân nhóm') + '</td><td>' + esc(p.base_unit) + '</td><td class="r num">' + fmt(p.sale_price) + '</td><td style="font-size:13px">' + (us || '<span class="muted">—</span>') + '</td><td class="r num">' + fmtN(p.min_stock) + '</td><td class="r">' + (owner() ? '<button class="btn sm" data-act="productEdit" data-id="' + p.id + '">Sửa</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">' + (c.prods.length ? 'Không có hàng nào khớp.' : 'Chưa có mặt hàng nào. ' + (owner() ? 'Bấm "Thêm hàng" hoặc "Nhập từ Excel" để bắt đầu.' : '')) + '</div></td></tr>';
    const n = $('#catnote'); if (n) n.textContent = list.length > 200 ? 'Đang hiện 200 trên ' + list.length + ' hàng. Gõ tên để thu hẹp.' : (list.length + ' mặt hàng');
  }

  function productModal(id) {
    const c = Views._cat; const p = id ? c.prods.find(x => x.id === id) : null;
    const us = p ? c.units.filter(u => u.product_id === p.id) : [];
    Views._edit = { product: p, units: us };
    const row = i => { const u = us[i] || {}; return '<div class="urow"><input id="un' + i + '" placeholder="Đơn vị lớn (thùng, lốc…)" value="' + esc(u.name || '') + '"><input id="uf' + i + '" type="number" step="any" min="0" placeholder="Quy đổi" value="' + (u.factor || '') + '"><input id="up' + i + '" type="number" min="0" placeholder="Giá bán / đơn vị lớn" value="' + (u.sale_price || '') + '"><span class="muted" style="font-size:12px">= số ĐVT cơ sở</span></div>'; };
    U.openModal('<h2>' + (p ? 'Sửa hàng hóa' : 'Thêm hàng hóa') + '</h2>' +
      '<label class="f" style="margin-top:0" for="pn">Tên hàng</label><input id="pn" value="' + esc(p ? p.name : '') + '" maxlength="120">' +
      '<div class="grid2"><div><label class="f" for="pg">Nhóm hàng</label><select id="pg" data-act="pgSel"><option value="">Chưa phân nhóm</option>' + c.groups.map(g => '<option value="' + g.id + '"' + (p && p.group_id === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') + '<option value="__new">＋ Nhóm mới…</option></select><input id="pgn" placeholder="Tên nhóm mới" style="display:none;margin-top:6px"></div>' +
      '<div><label class="f" for="pu">Đơn vị tính cơ sở</label><input id="pu" placeholder="gói, chai, kg…" value="' + esc(p ? p.base_unit : '') + '"></div></div>' +
      '<div class="grid2"><div><label class="f" for="pp">Giá bán (₫ / đơn vị cơ sở)</label><input id="pp" type="number" min="0" inputmode="numeric" value="' + (p ? p.sale_price : '') + '"></div>' +
      '<div><label class="f" for="pm">Tồn tối thiểu (để cảnh báo hết hàng)</label><input id="pm" type="number" step="any" min="0" value="' + (p ? p.min_stock : '') + '"></div></div>' +
      '<label class="chk"><input id="pw" type="checkbox"' + (p && p.sold_by_weight ? ' checked' : '') + '> Bán theo cân hoặc đo (cho phép số lẻ)</label>' +
      '<h3>Quy đổi đơn vị (không bắt buộc)</h3><p class="note" style="margin-top:0">Ví dụ: 1 thùng = 30 gói, giá bán thùng 125.000 ₫.</p>' + row(0) + row(1) + row(2) +
      '<label class="f" for="pb">Mã vạch (không bắt buộc, dùng khi có máy quét)</label><input id="pb" value="' + esc((p && p.barcode) || '') + '">' +
      '<div class="acts">' + (p ? '<button class="btn danger" data-act="productDel" data-id="' + p.id + '" style="margin-right:auto">Xóa hàng này</button>' : '') + '<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="productSave">Lưu</button></div>');
    setTimeout(() => { const i = $('#pn'); if (i && !p) i.focus(); }, 30);
  }

  async function ensureGroup(name) {
    const nm = name.trim(); const ex = live(await DB.all('product_groups')).find(g => norm(g.name) === norm(nm));
    if (ex) return ex.id;
    const g = await Sync.save('product_groups', { name: nm }); return g.id;
  }

  async function saveProduct() {
    const ed = Views._edit; const name = $('#pn').value.trim();
    if (!name) { U.toast('Nhập tên hàng', 'bad'); return; }
    const dup = Views._cat.prods.find(x => norm(x.name) === norm(name) && (!ed.product || x.id !== ed.product.id));
    if (dup) { U.toast('Đã có hàng cùng tên trong danh mục', 'bad'); return; }
    let gid = $('#pg').value || null;
    if (gid === '__new') { const gn = $('#pgn').value.trim(); if (!gn) { U.toast('Nhập tên nhóm mới', 'bad'); return; } gid = await ensureGroup(gn); }
    const price = Math.max(0, Math.round(U.num($('#pp').value)));
    const prod = Object.assign({}, ed.product || {}, {
      name, base_unit: $('#pu').value.trim() || 'cái', group_id: gid, sale_price: price,
      min_stock: Math.max(0, U.num($('#pm').value)), sold_by_weight: $('#pw').checked,
      barcode: $('#pb').value.trim() || null, active: true, deleted_at: null
    });
    if (!prod.id) prod.id = U.uuid();
    await Sync.save('products', prod);
    for (let i = 0; i < 3; i++) {
      const un = $('#un' + i).value.trim(), f = U.num($('#uf' + i).value), pr = Math.round(U.num($('#up' + i).value)), ex = ed.units[i];
      if (un && f > 0) await Sync.save('product_units', Object.assign({}, ex || {}, { product_id: prod.id, name: un, factor: f, sale_price: pr > 0 ? pr : null, deleted_at: null }));
      else if (ex) await Sync.save('product_units', Object.assign({}, ex, { deleted_at: nowIso() }));
    }
    U.closeModal(); U.toast('Đã lưu "' + name + '"'); App.renderRoute();
  }

  async function deleteProduct(id) {
    const p = Views._cat.prods.find(x => x.id === id); if (!p) return;
    await Sync.save('products', Object.assign({}, p, { deleted_at: nowIso(), active: false }));
    for (const u of Views._cat.units.filter(x => x.product_id === id)) await Sync.save('product_units', Object.assign({}, u, { deleted_at: nowIso() }));
    U.closeModal(); U.toast('Đã xóa "' + p.name + '"'); App.renderRoute();
  }

  function groupsModal() {
    const c = Views._cat; const cnt = {}; c.prods.forEach(p => { if (p.group_id) cnt[p.group_id] = (cnt[p.group_id] || 0) + 1; });
    U.openModal('<h2>Nhóm hàng</h2><div class="list">' + (c.groups.length ? c.groups.map(g => '<div class="li" style="gap:8px"><input value="' + esc(g.name) + '" data-act="groupRename" data-id="' + g.id + '" aria-label="Tên nhóm" style="flex:1"><span class="muted" style="font-size:12.5px;white-space:nowrap">' + (cnt[g.id] || 0) + ' hàng</span><button class="btn sm danger" data-act="groupDel" data-id="' + g.id + '">Xóa</button></div>').join('') : '<div class="empty">Chưa có nhóm nào.</div>') + '</div>' +
      '<label class="f" for="gnew">Thêm nhóm mới</label><div style="display:flex;gap:8px"><input id="gnew" placeholder="Ví dụ: Nước giải khát"><button class="btn primary" data-act="groupAdd">Thêm</button></div><div class="acts"><button class="btn" data-act="close">Đóng</button></div>');
  }

  /* ===================== NHẬP TỪ EXCEL ===================== */
  const FIELDS = [
    { k: 'name', t: 'Tên hàng', req: true, syn: ['ten hang', 'ten san pham', 'san pham', 'hang hoa', 'ten', 'name'] },
    { k: 'group', t: 'Nhóm hàng', syn: ['nhom hang', 'nhom', 'loai hang', 'loai', 'danh muc'] },
    { k: 'unit', t: 'Đơn vị tính', syn: ['don vi tinh', 'don vi', 'dvt', 'unit'] },
    { k: 'price', t: 'Giá bán', syn: ['gia ban', 'don gia', 'gia le', 'gia', 'price'] },
    { k: 'cost', t: 'Giá vốn', syn: ['gia von', 'gia nhap', 'von', 'cost'] },
    { k: 'stock', t: 'Tồn đầu', syn: ['ton dau', 'ton kho', 'so luong ton', 'so luong', 'ton', 'sl'] },
    { k: 'expiry', t: 'Hạn dùng', syn: ['han su dung', 'han dung', 'hsd', 'date'] },
    { k: 'min', t: 'Tồn tối thiểu', syn: ['ton toi thieu', 'toi thieu', 'dinh muc'] },
    { k: 'weight', t: 'Bán theo cân', syn: ['ban theo can', 'ban can', 'theo can'] }
  ];
  const pad2 = n => String(n).padStart(2, '0');
  function parseDate(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
    const s = String(v).trim(); let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    return null;
  }
  const colLetter = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function detectHeader(rows) {
    let best = 0, bestScore = -1;
    rows.slice(0, 10).forEach((r, i) => {
      const sc = r.reduce((a, c) => a + (FIELDS.some(f => f.syn.indexOf(norm(c)) >= 0) ? 1 : 0), 0);
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    return best;
  }
  function autoMap(headers) {
    const map = {}, used = {};
    FIELDS.forEach(f => { const i = headers.findIndex((h, ix) => !used[ix] && f.syn.indexOf(norm(h)) >= 0); if (i >= 0) { map[f.k] = i; used[i] = 1; } });
    FIELDS.forEach(f => {
      if (map[f.k] != null) return;
      for (const s of f.syn) { const i = headers.findIndex((h, ix) => !used[ix] && s.length >= 3 && norm(h).indexOf(s) >= 0); if (i >= 0) { map[f.k] = i; used[i] = 1; break; } }
    });
    return map;
  }

  Views.import = async () => {
    if (!owner()) return '<div class="card"><p>Chỉ chủ cửa hàng mới nhập được danh mục.</p></div>';
    const s = App.ui.imp || (App.ui.imp = { stage: 'pick' });
    const back = '<p style="margin-bottom:12px"><button class="link" data-act="nav" data-v="catalog">← Quay lại danh mục</button></p>';
    if (s.stage === 'pick') {
      return back + '<div class="card"><h2>Bước 1. Chọn file danh sách hàng</h2><p class="note" style="margin-top:0">Nhận file <b>.xlsx</b> hoặc <b>.csv</b>. Dòng đầu là tiêu đề cột; chỉ cột <b>Tên hàng</b> là bắt buộc. Có thể thêm giá bán, giá vốn, nhóm, đơn vị, tồn đầu, hạn dùng…</p>' +
        '<div class="drop"><div><b>Chọn file từ máy</b><p class="note" style="margin-top:4px">Tối đa vài nghìn dòng mỗi lần.</p></div><label class="btn primary" style="cursor:pointer;position:relative;overflow:hidden">Chọn file<input type="file" accept=".xlsx,.csv,.txt" data-act="impFile" style="position:absolute;opacity:0;width:1px;height:1px"></label><button class="link" data-act="impTemplate">Tải file mẫu (.csv, mở bằng Excel)</button></div>' +
        (s.error ? '<div class="err" role="alert">' + esc(s.error) + '</div>' : '') + '</div>';
    }
    if (s.stage === 'map') {
      const an = await analyze(s);
      return back + '<div class="card"><h2>Bước 2. Kiểm tra cột</h2><p class="note" style="margin-top:0">File: <b>' + esc(s.fileName) + '</b> · dòng tiêu đề: ' + (s.headerRow + 1) + '. Hệ thống đã tự đoán cột; bạn sửa lại nếu sai.</p>' +
        FIELDS.map(f => '<div class="maprow"><label for="map_' + f.k + '"><b>' + f.t + '</b>' + (f.req ? ' <span class="chip bad">bắt buộc</span>' : '') + '</label><select id="map_' + f.k + '" data-act="impMap" data-k="' + f.k + '"><option value="">— Không nhập —</option>' + s.headers.map((h, i) => '<option value="' + i + '"' + (s.map[f.k] === i ? ' selected' : '') + '>Cột ' + colLetter(i) + ': ' + esc(h || '(trống)') + '</option>').join('') + '</select></div>').join('') + '</div>' +
        '<div class="card" style="margin-top:14px"><h2>Bước 3. Xem trước và nhập</h2>' + an.html + '</div>';
    }
    if (s.stage === 'done') {
      const r = s.result;
      return back + '<div class="card"><h2>Đã nhập xong</h2><p>Đã lưu <b>' + r.products + '</b> mặt hàng' + (r.groups ? ', tạo <b>' + r.groups + '</b> nhóm mới' : '') + (r.stock ? ', ghi tồn đầu cho <b>' + r.stock + '</b> mặt hàng' : '') + '. Bỏ qua ' + r.skipped + ' dòng.</p><p class="note">Dữ liệu đã nằm trên máy bạn và đang được gửi lên máy chủ (xem trạng thái đồng bộ ở góc trên bên phải).</p><div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" data-act="nav" data-v="catalog">Xem danh mục</button><button class="btn" data-act="impReset">Nhập file khác</button></div></div>';
    }
    return '';
  };

  /* Đọc dữ liệu theo cột đã chọn, kiểm tra, đếm */
  async function analyze(s) {
    const existing = new Set(live(await DB.all('products')).map(p => norm(p.name)));
    const groupsEx = new Set(live(await DB.all('product_groups')).map(g => norm(g.name)));
    const get = (r, k) => (s.map[k] == null || s.map[k] === '' ? '' : (r[s.map[k]] === undefined ? '' : r[s.map[k]]));
    const seen = new Set(), items = []; let skipNoName = 0, skipDup = 0, skipEx = 0, noPrice = 0, costZero = 0, badDate = 0;
    const newGroups = new Set(); let stockN = 0;
    s.data.forEach(r => {
      if (r.every(c => c === '' || c == null)) return;
      const name = String(get(r, 'name')).trim();
      if (!name) { skipNoName++; return; }
      const key = norm(name);
      if (seen.has(key)) { skipDup++; return; }
      if (existing.has(key)) { skipEx++; return; }
      seen.add(key);
      const group = String(get(r, 'group')).trim(); if (group && !groupsEx.has(norm(group))) newGroups.add(group);
      const price = Math.max(0, Math.round(U.num(get(r, 'price')))), cost = Math.max(0, U.num(get(r, 'cost'))), stock = Math.max(0, U.num(get(r, 'stock')));
      const rawExp = get(r, 'expiry'), expiry = parseDate(rawExp); if (rawExp !== '' && !expiry) badDate++;
      const wv = norm(get(r, 'weight'));
      if (!price) noPrice++; if (stock > 0 && !cost) costZero++; if (stock > 0) stockN++;
      items.push({ name, group, unit: String(get(r, 'unit')).trim() || 'cái', price, cost, stock, expiry, min: Math.max(0, U.num(get(r, 'min'))), weight: ['x', 'co', '1', 'yes', 'true', 'can'].indexOf(wv) >= 0 });
    });
    s.items = items; s.newGroupNames = Array.from(newGroups); s.skipped = skipNoName + skipDup + skipEx;
    const warn = [];
    if (s.map.name == null) warn.push('Chưa chọn cột Tên hàng.');
    if (skipEx) warn.push(skipEx + ' dòng trùng tên với hàng đã có trong danh mục (sẽ bỏ qua).');
    if (skipDup) warn.push(skipDup + ' dòng trùng tên trong file (giữ dòng đầu).');
    if (skipNoName) warn.push(skipNoName + ' dòng thiếu tên (bỏ qua).');
    if (noPrice) warn.push(noPrice + ' hàng chưa có giá bán (sẽ để 0, bạn sửa sau).');
    if (costZero) warn.push(costZero + ' hàng có tồn đầu nhưng chưa có giá vốn (giá vốn = 0 sẽ làm lãi gộp sai).');
    if (badDate) warn.push(badDate + ' ô hạn dùng không đọc được (bỏ trống hạn).');
    const prev = items.slice(0, 8);
    const html = '<p><b>' + items.length + '</b> mặt hàng sẽ được nhập' + (newGroups.size ? ', tạo <b>' + newGroups.size + '</b> nhóm mới' : '') + (stockN ? ', có tồn đầu cho <b>' + stockN + '</b> mặt hàng' : '') + '.</p>' +
      (warn.length ? '<ul class="tick note warn" style="list-style:disc;padding:8px 8px 8px 26px;border-radius:8px">' + warn.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
      '<div class="tw" style="margin-top:10px"><table><thead><tr><th>Tên hàng</th><th>Nhóm</th><th>ĐVT</th><th class="r">Giá bán</th><th class="r">Giá vốn</th><th class="r">Tồn đầu</th><th>Hạn dùng</th></tr></thead><tbody>' +
      (prev.length ? prev.map(i => '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.group || '—') + '</td><td>' + esc(i.unit) + '</td><td class="r num">' + fmt(i.price) + '</td><td class="r num">' + (i.cost ? fmt(i.cost) : '—') + '</td><td class="r num">' + (i.stock ? fmtN(i.stock) : '—') + '</td><td>' + (i.expiry ? U.dmy(i.expiry) : '—') + '</td></tr>').join('') : '<tr><td colspan="7"><div class="empty">Chưa có dòng hợp lệ.</div></td></tr>') +
      '</tbody></table></div>' + (items.length > 8 ? '<p class="note">Chỉ hiện 8 dòng đầu.</p>' : '') +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn" data-act="impReset">Chọn file khác</button><button class="btn primary" data-act="impRun"' + (items.length && s.map.name != null ? '' : ' disabled') + '>Nhập ' + items.length + ' mặt hàng</button></div>';
    return { html };
  }

  async function runImport() {
    const s = App.ui.imp; const items = s.items || []; if (!items.length) return;
    const btn = document.querySelector('[data-act="impRun"]'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    const wh = (await DB.all('warehouses')).find(x => x.is_default) || (await DB.all('warehouses'))[0];
    const needStock = items.some(i => i.stock > 0);
    if (needStock && !wh) { U.toast('Chưa tải được thông tin kho. Hãy bật mạng, bấm vào trạng thái đồng bộ rồi thử lại.', 'bad'); if (btn) { btn.disabled = false; btn.textContent = 'Nhập'; } return; }
    const gmap = {}; live(await DB.all('product_groups')).forEach(g => { gmap[norm(g.name)] = g.id; });
    const newG = [];
    s.newGroupNames.forEach(n => { const g = { id: U.uuid(), name: n }; gmap[norm(n)] = g.id; newG.push(g); });
    const prods = [], lots = [], movs = []; let stockN = 0;
    items.forEach(i => {
      const p = { id: U.uuid(), group_id: i.group ? gmap[norm(i.group)] : null, name: i.name, base_unit: i.unit, sale_price: i.price, min_stock: i.min, sold_by_weight: i.weight, barcode: null, image_url: null, active: true, deleted_at: null };
      prods.push(p);
      if (i.stock > 0 && wh) {
        const lot = { id: U.uuid(), warehouse_id: wh.id, product_id: p.id, expiry_date: i.expiry || null };
        lots.push(lot); stockN++;
        movs.push({ id: U.uuid(), warehouse_id: wh.id, product_id: p.id, lot_id: lot.id, qty_base: i.stock, unit_cost: i.cost || 0, kind: 'opening', ref_type: 'import', note: 'Nhập tồn đầu từ Excel' });
      }
    });
    if (newG.length) await Sync.saveMany('product_groups', newG);
    await Sync.saveMany('products', prods);
    if (lots.length) await Sync.saveMany('lots', lots);
    if (movs.length) await Sync.queueOnly('stock_movements', movs);
    s.stage = 'done'; s.result = { products: prods.length, groups: newG.length, stock: stockN, skipped: s.skipped };
    App.renderRoute();
  }

  async function onImportFile(el) {
    const f = el.files && el.files[0]; if (!f) return; const s = App.ui.imp = { stage: 'pick' };
    try {
      const rows = await XL.readFile(f);
      const clean = [], origin = [];
      rows.forEach((r, i) => { if (r && r.some(c => c !== '' && c != null)) { clean.push(r); origin.push(i); } });
      if (clean.length < 2) throw new Error('File không có dữ liệu (cần ít nhất 1 dòng tiêu đề và 1 dòng hàng).');
      const hi = detectHeader(clean); const headers = clean[hi].map(c => String(c == null ? '' : c).trim());
      Object.assign(s, { stage: 'map', fileName: f.name, headerRow: origin[hi], headers, data: clean.slice(hi + 1), map: autoMap(headers) });
    } catch (e) { s.error = e.message || String(e); }
    App.renderRoute();
  }

  /* ===================== KHÁCH HÀNG ===================== */
  Views.customers = async () => {
    Views._cust = live(await DB.all('customers')).sort(byName);
    return '<div class="toolbar"><div class="searchbar">' + App.ICON('search') + '<input id="kq" data-act="custSearch" data-live="1" placeholder="Tìm theo tên hoặc số điện thoại…" value="' + esc(App.ui.cust.q) + '" autocomplete="off" aria-label="Tìm khách"></div><span class="spacer"></span><button class="btn primary" data-act="custNew">＋ Thêm khách</button></div>' +
      '<div class="card" style="padding:6px 8px"><div class="tw"><table><thead><tr><th>Tên</th><th>Điện thoại</th><th></th></tr></thead><tbody id="custbody"></tbody></table></div><p class="note" id="custnote" style="padding:0 10px 8px"></p></div>';
  };
  Views.after_customers = async () => fillCust();
  function fillCust() {
    const body = $('#custbody'); if (!body) return; const q = norm(App.ui.cust.q);
    const list = Views._cust.filter(c => !q || norm(c.name).indexOf(q) >= 0 || norm(c.phone || '').indexOf(q) >= 0);
    body.innerHTML = list.length ? list.slice(0, 300).map(c => '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.phone || '—') + '</td><td class="r"><button class="btn sm" data-act="custEdit" data-id="' + c.id + '">Sửa</button></td></tr>').join('') : '<tr><td colspan="3"><div class="empty">' + (Views._cust.length ? 'Không có khách nào khớp.' : 'Chưa có khách hàng. Bấm "Thêm khách" để bắt đầu.') + '</div></td></tr>';
    const n = $('#custnote'); if (n) n.textContent = list.length + ' khách';
  }
  function custModal(id) {
    const c = id ? Views._cust.find(x => x.id === id) : null; Views._editC = c;
    U.openModal('<h2>' + (c ? 'Sửa khách hàng' : 'Thêm khách hàng') + '</h2><label class="f" style="margin-top:0" for="cn">Tên khách</label><input id="cn" value="' + esc(c ? c.name : '') + '" maxlength="80"><label class="f" for="cp">Số điện thoại</label><input id="cp" inputmode="tel" value="' + esc((c && c.phone) || '') + '" maxlength="20">' +
      '<div class="acts">' + (c ? '<button class="btn danger" data-act="custDel" data-id="' + c.id + '" style="margin-right:auto">Xóa</button>' : '') + '<button class="btn" data-act="close">Hủy</button><button class="btn primary" data-act="custSave">Lưu</button></div>');
    setTimeout(() => { const i = $('#cn'); if (i && !c) i.focus(); }, 30);
  }

  /* ===================== CÀI ĐẶT ===================== */
  const SWATCH = ['#22408F', '#1E6B4A', '#A63A2B', '#5B3A8C', '#2B3540'];
  Views.settings = async () => {
    const failed = (await DB.getMeta('failed')) || [], dev = (await DB.getMeta('device')) || 'A';
    const st = Sync.state, cur = (App.store.brand && App.store.brand.color) || '#22408F';
    Views._color = cur;
    return '<div class="two"><div class="stack">' +
      '<div class="card"><h2>Cửa hàng</h2>' + (owner() ?
        '<label class="f" style="margin-top:0" for="stn">Tên cửa hàng</label><input id="stn" value="' + esc(App.store.name) + '" maxlength="60"><label class="f">Màu chủ đạo</label><div class="sw">' + SWATCH.map(c => '<button class="' + (cur.toLowerCase() === c.toLowerCase() ? 'on' : '') + '" style="background:' + c + '" data-act="setColor" data-v="' + c + '" aria-label="Màu ' + c + '"></button>').join('') + '</div><button class="btn primary" style="margin-top:14px" data-act="storeSave">Lưu thay đổi</button><p class="note">Lưu thông tin cửa hàng cần có mạng.</p>'
        : '<p><b>' + esc(App.store.name) + '</b></p><p class="note">Chỉ chủ cửa hàng sửa được thông tin này.</p>') + '</div>' +
      '<div class="card"><h2>Máy này</h2><label class="f" style="margin-top:0" for="dev">Mã máy</label><select id="dev" data-act="setDevice">' + 'ABCDEF'.split('').map(c => '<option' + (dev === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select><p class="note">Mỗi máy bán hàng dùng một mã khác nhau để số đơn không trùng khi mất mạng.</p></div>' +
      (owner() ? '<div class="card"><h2>Nhân viên</h2><p class="note" style="margin-top:0">Nhân viên tạo đơn bán, thu tiền và thêm khách, nhưng không thấy giá vốn, nhập hàng, sổ quỹ hay thuế. Họ cần đăng ký tài khoản trước.</p><label class="f" for="stf">Email nhân viên</label><div style="display:flex;gap:8px"><input id="stf" type="email" inputmode="email" placeholder="email@example.com"><button class="btn primary" data-act="addStaff">Thêm</button></div></div>' : '') +
      '</div><div class="stack">' +
      '<div class="card"><h2>Đồng bộ</h2><div class="grid2"><div class="stat"><b>' + st.pending + '</b><span>Chờ gửi lên máy chủ</span></div><div class="stat"><b>' + failed.length + '</b><span>Bị lỗi</span></div></div><p class="note">' + (st.last ? 'Lần đồng bộ gần nhất: ' + new Date(st.last).toLocaleString('vi-VN') : 'Chưa đồng bộ lần nào trong phiên này.') + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="syncNow">Đồng bộ ngay</button><button class="btn" data-act="resetPull">Tải lại toàn bộ từ máy chủ</button></div>' +
      (failed.length ? '<h3>Thay đổi bị lỗi (máy chủ từ chối)</h3><div class="list">' + failed.slice(-8).map(f => '<div class="li" style="align-items:flex-start;gap:8px"><span style="white-space:normal">' + esc(f.table) + ': ' + esc(f.message) + '</span></div>').join('') + '</div><button class="btn sm" style="margin-top:8px" data-act="clearFailed">Xóa danh sách lỗi</button><p class="note">Những thay đổi này không được lưu lên máy chủ. Hãy chụp màn hình gửi người hỗ trợ.</p>' : '') + '</div>' +
      '<div class="card"><h2>Tài khoản</h2><p>' + esc(App.user.email || '') + '<br><span class="muted">' + (owner() ? 'Chủ cửa hàng' : 'Nhân viên') + '</span></p><button class="btn" data-act="logout">Đăng xuất</button></div></div></div>';
  };

  /* ===================== SỰ KIỆN CỦA CÁC MÀN HÌNH ===================== */
  Views.act = async (el, ev, e) => {
    const a = el.dataset.act, d = el.dataset;
    switch (a) {
      case 'catSearch': App.ui.cat.q = el.value; fillCatRows(); return;
      case 'catGroup': App.ui.cat.g = el.value; fillCatRows(); return;
      case 'productNew': productModal(null); return;
      case 'productEdit': productModal(d.id); return;
      case 'pgSel': { const n = $('#pgn'); if (n) { n.style.display = el.value === '__new' ? '' : 'none'; if (el.value === '__new') n.focus(); } return; }
      case 'productSave': await saveProduct(); return;
      case 'productDel': U.openModal('<h2>Xóa hàng này?</h2><p>Hàng sẽ biến khỏi danh mục. Lịch sử bán và nhập cũ vẫn được giữ.</p><div class="acts"><button class="btn" data-act="close">Giữ lại</button><button class="btn danger" data-act="productDelYes" data-id="' + d.id + '">Xóa</button></div>'); return;
      case 'productDelYes': await deleteProduct(d.id); return;
      case 'groupsOpen': groupsModal(); return;
      case 'groupAdd': { const n = $('#gnew').value.trim(); if (!n) { U.toast('Nhập tên nhóm', 'bad'); return; } await ensureGroup(n); await App.renderRoute(); groupsModal(); return; }
      case 'groupRename': { const g = Views._cat.groups.find(x => x.id === d.id); const n = el.value.trim(); if (g && n && n !== g.name) { await Sync.save('product_groups', Object.assign({}, g, { name: n })); await App.renderRoute(); groupsModal(); U.toast('Đã đổi tên nhóm'); } return; }
      case 'groupDel': { const used = Views._cat.prods.filter(p => p.group_id === d.id).length; if (used) { U.toast('Nhóm còn ' + used + ' mặt hàng, hãy chuyển hàng sang nhóm khác trước', 'bad'); return; } const g = Views._cat.groups.find(x => x.id === d.id); await Sync.save('product_groups', Object.assign({}, g, { deleted_at: nowIso() })); await App.renderRoute(); groupsModal(); return; }

      case 'impFile': await onImportFile(el); return;
      case 'impMap': { const s = App.ui.imp; s.map[d.k] = el.value === '' ? null : parseInt(el.value, 10); App.renderRoute(); return; }
      case 'impRun': await runImport(); return;
      case 'impReset': App.ui.imp = { stage: 'pick' }; App.renderRoute(); return;
      case 'impTemplate': U.download('mau-danh-muc-hang.csv', 'Tên hàng,Nhóm hàng,Đơn vị tính,Giá bán,Giá vốn,Tồn đầu,Hạn dùng,Tồn tối thiểu,Bán theo cân\r\nMì Hảo Hảo tôm chua cay,Mì & thực phẩm khô,gói,4500,3500,260,31/12/2026,90,\r\nĐường trắng,Dầu ăn & gia vị,kg,25000,21000,22,,10,x\r\nNước mắm Nam Ngư 500ml,Dầu ăn & gia vị,chai,37000,31000,26,15/06/2027,10,\r\n'); return;

      case 'custSearch': App.ui.cust.q = el.value; fillCust(); return;
      case 'custNew': custModal(null); return;
      case 'custEdit': custModal(d.id); return;
      case 'custSave': {
        const n = $('#cn').value.trim(); if (!n) { U.toast('Nhập tên khách', 'bad'); return; }
        await Sync.save('customers', Object.assign({}, Views._editC || {}, { name: n, phone: $('#cp').value.trim() || null, deleted_at: null }));
        U.closeModal(); U.toast('Đã lưu khách "' + n + '"'); App.renderRoute(); return;
      }
      case 'custDel': { const c = Views._cust.find(x => x.id === d.id); await Sync.save('customers', Object.assign({}, c, { deleted_at: nowIso() })); U.closeModal(); App.renderRoute(); return; }

      case 'setColor': Views._color = d.v; document.documentElement.style.setProperty('--brand', d.v); document.querySelectorAll('.sw button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); return;
      case 'storeSave': {
        const name = ($('#stn').value || '').trim(); if (!name) { U.toast('Nhập tên cửa hàng', 'bad'); return; }
        const r = await App.sb.from('stores').update({ name, brand: Object.assign({}, App.store.brand || {}, { color: Views._color }) }).eq('id', App.store.id).select().single();
        if (r.error) { U.toast(Sync.isNet(r.error) ? 'Cần có mạng để lưu thông tin cửa hàng' : 'Không lưu được: ' + r.error.message, 'bad'); return; }
        App.store = r.data; const ctx = await DB.getMeta('ctx'); if (ctx) { ctx.store = r.data; await DB.setMeta('ctx', ctx); }
        App.applyBrand(); U.toast('Đã lưu thông tin cửa hàng'); App.renderRoute(); return;
      }
      case 'setDevice': await DB.setMeta('device', el.value); App.device = el.value; U.toast('Máy này dùng mã ' + el.value); return;
      case 'addStaff': {
        const em = ($('#stf').value || '').trim(); if (!em) { U.toast('Nhập email nhân viên', 'bad'); return; }
        const r = await App.sb.rpc('add_staff', { p_store: App.store.id, p_email: em });
        if (r.error) { U.toast(Sync.isNet(r.error) ? 'Cần có mạng để thêm nhân viên' : r.error.message, 'bad'); return; }
        $('#stf').value = ''; U.toast('Đã thêm ' + em + ' làm nhân viên'); return;
      }
      case 'clearFailed': await DB.setMeta('failed', []); await Sync.refreshCounts(); App.renderRoute(); return;
      case 'resetPull': await Sync.resetCursors(); U.toast('Đang tải lại dữ liệu…'); Sync.run(); return;
    }
  };
})(window);
