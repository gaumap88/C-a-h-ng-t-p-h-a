/* Kho dữ liệu trên máy (IndexedDB). Cho phép dùng khi mất mạng. */
(function (w) {
  'use strict';
  const STORES = [
    { n: 'warehouses', k: 'id' }, { n: 'product_groups', k: 'id' }, { n: 'products', k: 'id' },
    { n: 'product_units', k: 'id' }, { n: 'lots', k: 'id' }, { n: 'product_stock', k: 'k' },
    { n: 'lot_stock', k: 'lot_id' }, { n: 'customers', k: 'id' },
    { n: 'outbox', k: 'seq', auto: true }, { n: 'meta', k: 'k' }
  ];
  const DB = { db: null, name: 'so-tap-hoa', version: 1, STORES };

  DB.open = function () {
    if (DB.db) return Promise.resolve(DB.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB.name, DB.version);
      r.onupgradeneeded = () => {
        const db = r.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s.n)) db.createObjectStore(s.n, { keyPath: s.k, autoIncrement: !!s.auto }); });
      };
      r.onsuccess = () => { DB.db = r.result; res(DB.db); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Kho dữ liệu đang bị khóa bởi một thẻ khác'));
    });
  };
  const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = (n, mode) => DB.db.transaction(n, mode || 'readonly').objectStore(n);
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

  DB.get = (s, k) => wrap(store(s).get(k));
  DB.all = s => wrap(store(s).getAll());
  DB.count = s => wrap(store(s).count());
  DB.put = (s, o) => wrap(store(s, 'readwrite').put(o));
  DB.del = (s, k) => wrap(store(s, 'readwrite').delete(k));
  DB.clear = s => wrap(store(s, 'readwrite').clear());
  DB.putMany = (s, arr) => {
    if (!arr.length) return Promise.resolve();
    const t = DB.db.transaction(s, 'readwrite'); const o = t.objectStore(s);
    arr.forEach(x => o.put(x)); return done(t);
  };
  DB.addMany = (s, arr) => {
    if (!arr.length) return Promise.resolve();
    const t = DB.db.transaction(s, 'readwrite'); const o = t.objectStore(s);
    arr.forEach(x => o.add(x)); return done(t);
  };
  DB.getMeta = async k => { const r = await DB.get('meta', k); return r ? r.v : undefined; };
  DB.setMeta = (k, v) => DB.put('meta', { k: k, v: v });
  DB.wipe = async () => { for (const s of STORES) await DB.clear(s.n); };
  w.DB = DB;
})(window);
