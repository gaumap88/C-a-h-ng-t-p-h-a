/* Đồng bộ: ghi vào máy trước, gửi lên máy chủ khi có mạng, kéo thay đổi mới về. */
(function (w) {
  'use strict';
  const PAGE = 1000, BATCH = 200, OVERLAP_MS = 10000;

  /* Bảng được kéo về máy. owner:true = chỉ chủ cửa hàng đọc được. */
  const TABLES = [
    { name: 'warehouses', key: 'id' },
    { name: 'product_groups', key: 'id' },
    { name: 'products', key: 'id' },
    { name: 'product_units', key: 'id' },
    { name: 'lots', key: 'id' },
    { name: 'product_stock', key: 'k', orderKey: 'product_id', mk: r => r.warehouse_id + '|' + r.product_id },
    { name: 'lot_stock', key: 'lot_id', orderKey: 'lot_id' },
    { name: 'customers', key: 'id' }
  ];
  const def = n => TABLES.find(t => t.name === n);

  const Sync = {
    TABLES,
    state: { running: false, last: null, error: null, pending: 0, failed: 0, needLogin: false },
    listeners: [],
    timer: null
  };

  Sync.on = fn => { Sync.listeners.push(fn); };
  Sync.set = patch => { Object.assign(Sync.state, patch); Sync.listeners.forEach(f => { try { f(Sync.state); } catch (e) { console.error(e); } }); };

  Sync.isNet = err => {
    if (!err) return false;
    const m = String(err.message || err);
    return navigator.onLine === false || err.status === 0 || /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error/i.test(m);
  };
  Sync.isAuth = err => !!err && (err.status === 401 || err.code === 'PGRST301' || err.code === 'PGRST303' || /jwt/i.test(String(err.message || '')));

  Sync.refreshCounts = async () => {
    const failed = (await DB.getMeta('failed')) || [];
    Sync.set({ pending: await DB.count('outbox'), failed: failed.length });
  };

  /* Ghi vào máy + xếp hàng chờ gửi. Trả về hàng đã lưu. */
  Sync.save = async (table, row, opt) => (await Sync.saveMany(table, [row], opt))[0];

  Sync.saveMany = async (table, rows, opt) => {
    opt = opt || {};
    const t = def(table); const now = new Date().toISOString();
    const out = rows.map(r => {
      const x = Object.assign({}, r);
      if (!x.id && (!t || t.key === 'id')) x.id = U.uuid();
      if (App.store && x.store_id === undefined && table !== 'tax_params') x.store_id = App.store.id;
      if (!opt.append) x.updated_at = x.updated_at || now;
      return x;
    });
    if (t) {
      await DB.putMany(table, out.map(x => { const y = Object.assign({}, x); if (t.mk) y.k = t.mk(y); return y; }));
    }
    await DB.addMany('outbox', out.map(x => ({ table, row: x, ignore: !!opt.append, ts: Date.now() })));
    await Sync.refreshCounts();
    Sync.kick();
    return out;
  };

  /* Chỉ xếp hàng gửi, không lưu trên máy (dùng cho sổ cái kho: máy chủ tự tính tồn) */
  Sync.queueOnly = (table, rows) => Sync.saveMany(table, rows, { append: true });

  Sync.kick = () => { clearTimeout(Sync.timer); Sync.timer = setTimeout(() => Sync.run(), 1200); };

  /* ---------- Gửi lên ---------- */
  async function failItem(it, err) {
    const failed = (await DB.getMeta('failed')) || [];
    failed.push({ table: it.table, id: it.row && it.row.id, message: String(err.message || err), code: err.code || '', ts: Date.now(), row: it.row });
    await DB.setMeta('failed', failed.slice(-100));
    await DB.del('outbox', it.seq);
  }

  async function pushOne(it) {
    let res;
    try { res = await App.sb.from(it.table).upsert([it.row], { onConflict: (def(it.table) || {}).pk || 'id', ignoreDuplicates: !!it.ignore }); }
    catch (e) { res = { error: e }; }
    const err = res && res.error;
    if (!err) { await DB.del('outbox', it.seq); return {}; }
    if (Sync.isNet(err)) return { net: true };
    if (Sync.isAuth(err)) return { auth: true };
    await failItem(it, err); return { failed: true };
  }

  Sync.push = async function () {
    for (;;) {
      const items = await DB.all('outbox');
      if (!items.length) return {};
      const first = items[0]; const batch = [first];
      for (let i = 1; i < items.length && batch.length < BATCH; i++) {
        const it = items[i];
        if (it.table === first.table && !!it.ignore === !!first.ignore) batch.push(it); else break;
      }
      let res;
      try { res = await App.sb.from(first.table).upsert(batch.map(b => b.row), { onConflict: (def(first.table) || {}).pk || 'id', ignoreDuplicates: !!first.ignore }); }
      catch (e) { res = { error: e }; }
      const err = res && res.error;
      if (!err) { for (const b of batch) await DB.del('outbox', b.seq); await Sync.refreshCounts(); continue; }
      if (Sync.isNet(err)) return { net: true };
      if (Sync.isAuth(err)) return { auth: true };
      for (const b of batch) {                 // tách từng dòng để biết dòng nào lỗi
        const r = await pushOne(b);
        if (r.net || r.auth) return r;
      }
      await Sync.refreshCounts();
    }
  };

  /* ---------- Kéo về ---------- */
  async function applyRows(t, rows) {
    const pend = new Set((await DB.all('outbox')).filter(o => o.table === t.name).map(o => o.row[t.key]));
    const out = [];
    rows.forEach(r => {
      if (t.mk) r.k = t.mk(r);
      if (pend.has(r[t.key])) return;          // đang có thay đổi chưa gửi: giữ bản trên máy
      out.push(r);
    });
    await DB.putMany(t.name, out);
    return out.length;
  }

  Sync.pull = async function () {
    const sid = App.store.id; let changed = 0;
    for (const t of TABLES) {
      if (t.owner && App.role !== 'owner') continue;
      const cur = await DB.getMeta('cur:' + t.name);
      const since = cur ? new Date(Date.parse(cur) - OVERLAP_MS).toISOString() : null;
      let offset = 0, max = cur;
      for (;;) {
        let q = App.sb.from(t.name).select('*').eq('store_id', sid);
        if (since) q = q.gte('updated_at', since);
        q = q.order('updated_at', { ascending: true }).order(t.orderKey || 'id', { ascending: true }).range(offset, offset + PAGE - 1);
        let res;
        try { res = await q; } catch (e) { res = { error: e }; }
        if (res.error) {
          if (Sync.isNet(res.error)) return { net: true, changed };
          if (Sync.isAuth(res.error)) return { auth: true, changed };
          console.warn('Không kéo được bảng', t.name, res.error.message); break;
        }
        const data = res.data || [];
        if (!data.length) break;
        changed += await applyRows(t, data);
        data.forEach(r => { if (!max || r.updated_at > max) max = r.updated_at; });
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      if (max && max !== cur) await DB.setMeta('cur:' + t.name, max);
    }
    return { changed };
  };

  Sync.resetCursors = async () => { for (const t of TABLES) await DB.del('meta', 'cur:' + t.name); };

  /* ---------- Chạy một vòng ---------- */
  Sync.run = async function () {
    if (Sync.state.running || !App.sb || !App.store) return;
    if (navigator.onLine === false) { Sync.set({ error: null }); return; }
    Sync.set({ running: true, error: null });
    try {
      const p = await Sync.push();
      if (p.auth) { await App.tryRefreshSession(); }
      else if (!p.net) {
        const r = await Sync.pull();
        if (r.auth) await App.tryRefreshSession();
        else if (!r.net) Sync.set({ last: Date.now() });
        if (r.changed) App.refresh();
      }
    } catch (e) {
      console.error(e); Sync.set({ error: String(e.message || e) });
    } finally {
      Sync.set({ running: false });
      await Sync.refreshCounts();
    }
  };

  Sync.start = function () {
    clearInterval(Sync.interval);
    Sync.interval = setInterval(() => { if (!document.hidden) Sync.run(); }, 30000);
    if (!Sync.wired) {
      Sync.wired = true;
      window.addEventListener('online', () => Sync.run());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.run(); });
    }
    Sync.run();
  };

  w.Sync = Sync;
})(window);
