/* Lõi ứng dụng: khởi động, đăng nhập, khung giao diện, điều hướng, sự kiện */
(function (w) {
  'use strict';
  const $ = U.$, esc = U.esc;
  const App = { sb: null, user: null, store: null, role: null, route: 'home', device: 'A', cfg: w.APP_CONFIG || {}, ui: { cat: { q: '', g: '' }, cust: { q: '' }, imp: null, authMode: 'login' } };
  w.App = App;

  const IC = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'
  };
  const ICON = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>';
  App.ICON = ICON;

  const NAV = [
    { id: 'home', t: 'Tổng quan', i: 'home' },
    { id: 'catalog', t: 'Danh mục', i: 'box' },
    { id: 'customers', t: 'Khách hàng', i: 'users' },
    { id: 'settings', t: 'Cài đặt', i: 'gear' }
  ];
  const TITLES = { home: 'Tổng quan', catalog: 'Danh mục hàng', import: 'Nhập từ Excel', customers: 'Khách hàng', settings: 'Cài đặt' };
  const navOf = r => (r === 'import' ? 'catalog' : r);

  const root = html => { $('#root').innerHTML = html; };
  const mark = () => '<span class="mark">' + esc(((App.store && App.store.name) || 'S').trim().charAt(0).toUpperCase() || 'S') + '</span>';

  /* ---------- Giao diện sáng/tối, màu thương hiệu ---------- */
  function applyTheme() {
    let t = ''; try { t = localStorage.getItem('so-tap-hoa-theme') || ''; } catch (e) {}
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  }
  function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    try { localStorage.setItem('so-tap-hoa-theme', dark ? 'light' : 'dark'); } catch (e) {}
    applyTheme();
  }
  App.applyBrand = () => {
    const c = App.store && App.store.brand && App.store.brand.color;
    if (c && /^#[0-9a-f]{6}$/i.test(c)) document.documentElement.style.setProperty('--brand', c);
  };

  /* ---------- Màn hình chưa cấu hình / lỗi ---------- */
  function renderSetup() {
    root('<div class="boot"><div class="card auth"><div class="brand"><span class="mark">S</span><span>Sổ tạp hóa</span></div><h1>Chưa kết nối máy chủ</h1><p class="sub">Mở file <b>config.js</b> và điền hai thông tin lấy từ Supabase (Project Settings, mục API):</p><p class="mono">SUPABASE_URL<br>SUPABASE_ANON_KEY</p><p class="note">Chỉ dùng khóa công khai (anon hoặc publishable). Tuyệt đối không dán khóa bí mật (service_role).</p></div></div>');
  }
  function renderFatal(msg, retry) {
    root('<div class="boot"><div class="card auth"><div class="brand"><span class="mark">S</span><span>Sổ tạp hóa</span></div><h1>Không mở được ứng dụng</h1><p class="sub">' + esc(msg) + '</p>' + (retry ? '<button class="btn primary block" data-act="reload">Thử lại</button>' : '') + '</div></div>');
  }

  /* ---------- Đăng nhập ---------- */
  const AUTH_ERR = [
    [/invalid login credentials/i, 'Sai email hoặc mật khẩu.'],
    [/user already registered|already been registered/i, 'Email này đã đăng ký. Hãy chuyển sang Đăng nhập.'],
    [/email not confirmed/i, 'Bạn cần bấm vào liên kết xác nhận trong email trước khi đăng nhập.'],
    [/password should be at least|weak password/i, 'Mật khẩu cần tối thiểu 6 ký tự.'],
    [/unable to validate email|invalid.*email/i, 'Email chưa đúng định dạng.'],
    [/rate limit|too many/i, 'Bạn thử quá nhiều lần. Hãy chờ vài phút rồi thử lại.'],
    [/failed to fetch|network/i, 'Không kết nối được máy chủ. Kiểm tra Internet rồi thử lại.']
  ];
  const authMsg = e => { const m = String((e && e.message) || e); const f = AUTH_ERR.find(x => x[0].test(m)); return f ? f[1] : 'Lỗi: ' + m; };

  function renderAuth(msg, ok) {
    const su = App.ui.authMode === 'signup';
    root('<div class="boot"><div class="card auth"><div class="brand"><span class="mark">S</span><span>Sổ tạp hóa</span></div>' +
      '<h1>' + (su ? 'Tạo tài khoản' : 'Đăng nhập') + '</h1><p class="sub">' + (su ? 'Dùng email của chủ cửa hàng. Nhân viên cũng tự đăng ký, rồi bạn thêm họ vào cửa hàng trong Cài đặt.' : 'Đăng nhập để mở cửa hàng của bạn.') + '</p>' +
      '<div class="seg" role="group"><button class="' + (!su ? 'on' : '') + '" data-act="authMode" data-v="login">Đăng nhập</button><button class="' + (su ? 'on' : '') + '" data-act="authMode" data-v="signup">Đăng ký</button></div>' +
      '<label class="f" for="em">Email</label><input id="em" type="email" autocomplete="email" inputmode="email">' +
      '<label class="f" for="pw">Mật khẩu' + (su ? ' (tối thiểu 6 ký tự)' : '') + '</label><input id="pw" type="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '">' +
      (msg ? '<div class="' + (ok ? 'okmsg' : 'err') + '" role="alert">' + esc(msg) + '</div>' : '') +
      '<button class="btn primary block" style="margin-top:14px" data-act="authGo" id="authbtn">' + (su ? 'Tạo tài khoản' : 'Đăng nhập') + '</button>' +
      (navigator.onLine === false ? '<p class="note warn">Đang ngoại tuyến. Cần có mạng để đăng nhập.</p>' : '') + '</div></div>');
  }

  async function authGo() {
    const em = ($('#em').value || '').trim(), pw = $('#pw').value || '';
    if (!em || !pw) { renderAuth('Nhập đủ email và mật khẩu.'); $('#em').value = em; return; }
    const btn = $('#authbtn'); btn.disabled = true; btn.textContent = 'Đang xử lý…';
    try {
      const su = App.ui.authMode === 'signup';
      const r = su ? await App.sb.auth.signUp({ email: em, password: pw }) : await App.sb.auth.signInWithPassword({ email: em, password: pw });
      if (r.error) throw r.error;
      const session = r.data && r.data.session;
      if (!session) { App.ui.authMode = 'login'; renderAuth('Đã tạo tài khoản. Hãy mở email, bấm liên kết xác nhận rồi đăng nhập.', true); return; }
      App.user = session.user; await loadContext();
    } catch (e) { renderAuth(authMsg(e)); const i = $('#em'); if (i) i.value = em; }
  }

  async function doLogout(force) {
    const n = Sync.state.pending;
    if (n > 0 && !force) {
      U.openModal('<h2>Còn thay đổi chưa gửi</h2><p>Có <b>' + n + '</b> thay đổi chưa gửi lên máy chủ. Đăng xuất vẫn giữ dữ liệu trên máy, nhưng chỉ khi đăng nhập lại đúng tài khoản này thì chúng mới được gửi tiếp.</p><div class="acts"><button class="btn" data-act="close">Ở lại</button><button class="btn primary" data-act="logoutForce">Vẫn đăng xuất</button></div>');
      return;
    }
    U.closeModal();
    try { await App.sb.auth.signOut(); } catch (e) {}
    App.user = null; App.store = null; renderAuth();
  }

  App.tryRefreshSession = async () => {
    try { const r = await App.sb.auth.refreshSession(); if (r.error) throw r.error; Sync.set({ needLogin: false }); }
    catch (e) { if (!Sync.isNet(e)) Sync.set({ needLogin: true }); }
  };

  /* ---------- Cửa hàng của người dùng ---------- */
  async function loadContext() {
    const uid = App.user.id;
    const last = await DB.getMeta('lastUser');
    let ctx = await DB.getMeta('ctx'); if (ctx && ctx.userId !== uid) ctx = null;
    if (last && last !== uid) {
      const pending = await DB.count('outbox');
      if (pending > 0) { try { await App.sb.auth.signOut(); } catch (e) {} App.user = null; renderAuth('Máy này còn ' + pending + ' thay đổi chưa gửi của tài khoản khác. Hãy đăng nhập lại bằng tài khoản đó để gửi hết trước.'); return; }
      await DB.wipe(); ctx = null;
    }
    try {
      const m = await App.sb.from('store_members').select('store_id,role').eq('user_id', uid);
      if (m.error) throw m.error;
      if (!m.data || !m.data.length) { renderCreateStore(); return; }
      const st = await App.sb.from('stores').select('*').eq('id', m.data[0].store_id).single();
      if (st.error) throw st.error;
      ctx = { userId: uid, email: App.user.email, storeId: st.data.id, role: m.data[0].role, store: st.data };
      await DB.setMeta('ctx', ctx);
    } catch (e) {
      if (!(Sync.isNet(e) && ctx)) { renderFatal('Không tải được thông tin cửa hàng: ' + (e.message || e), true); return; }
    }
    await enter(ctx);
  }

  function renderCreateStore(msg) {
    root('<div class="boot"><div class="card auth"><div class="brand"><span class="mark">S</span><span>Sổ tạp hóa</span></div><h1>Tạo cửa hàng của bạn</h1><p class="sub">Tài khoản này chưa thuộc cửa hàng nào. Nếu bạn là nhân viên, hãy nhờ chủ cửa hàng thêm email của bạn trong Cài đặt rồi tải lại trang.</p>' +
      '<label class="f" for="sn">Tên cửa hàng</label><input id="sn" placeholder="Ví dụ: Tạp hóa Bà Sáu" maxlength="60">' +
      (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
      '<button class="btn primary block" style="margin-top:14px" data-act="createStore" id="csbtn">Tạo cửa hàng</button>' +
      '<button class="link" style="display:block;margin:14px auto 0" data-act="logout">Đăng xuất</button></div></div>');
  }
  async function createStore() {
    const name = ($('#sn').value || '').trim(); if (!name) { renderCreateStore('Nhập tên cửa hàng.'); return; }
    const b = $('#csbtn'); b.disabled = true; b.textContent = 'Đang tạo…';
    const r = await App.sb.rpc('create_store', { p_name: name });
    if (r.error) { renderCreateStore('Không tạo được cửa hàng: ' + r.error.message); return; }
    await loadContext();
  }

  let entered = false;
  async function enter(ctx) {
    App.store = ctx.store; App.role = ctx.role;
    await DB.setMeta('lastUser', App.user.id);
    App.device = (await DB.getMeta('device')) || 'A';
    App.applyBrand();
    renderShell();
    App.route = 'home'; await renderRoute();
    if (!entered) { entered = true; Sync.on(renderPill); w.addEventListener('online', renderPill); w.addEventListener('offline', renderPill); }
    renderPill(); await Sync.refreshCounts(); Sync.start();
  }

  /* ---------- Khung giao diện ---------- */
  function renderShell() {
    root('<div class="app"><nav class="side" id="side" aria-label="Menu chính"></nav><div class="wrap"><header class="top" id="top"></header><main class="main" id="view"></main></div></div><nav class="tabbar" id="tabbar" aria-label="Menu chính" style="grid-template-columns:repeat(' + NAV.length + ',1fr)"></nav>');
    renderNav(); renderTop();
  }
  function renderNav() {
    const a = navOf(App.route);
    const s = $('#side'); if (!s) return;
    s.innerHTML = '<div class="brand">' + mark() + '<span>' + esc(App.store.name) + '</span></div>' +
      NAV.map(n => '<button class="nv' + (a === n.id ? ' on' : '') + '" data-act="nav" data-v="' + n.id + '">' + ICON(n.i) + '<span>' + n.t + '</span></button>').join('') +
      '<div class="side-foot">' + esc(App.user ? App.user.email || '' : '') + '<br>' + (App.role === 'owner' ? 'Chủ cửa hàng' : 'Nhân viên') + '</div>';
    $('#tabbar').innerHTML = NAV.map(n => '<button class="' + (a === n.id ? 'on' : '') + '" data-act="nav" data-v="' + n.id + '">' + ICON(n.i) + '<span>' + n.t + '</span></button>').join('');
  }
  function renderTop() {
    const t = $('#top'); if (!t) return;
    const label = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    t.innerHTML = '<div><div class="mbrand">' + mark() + '<span>' + esc(App.store.name) + '</span></div><h1>' + (TITLES[App.route] || '') + '</h1><p class="sub">' + esc(label) + '</p></div><div class="top-r"><button class="pill" id="net" data-act="syncNow" aria-live="polite"></button><button class="icon-btn" data-act="theme" aria-label="Đổi giao diện sáng hoặc tối">' + ICON('moon') + '</button></div>';
    renderPill();
  }
  function renderPill() {
    const el = $('#net'); if (!el) return;
    const s = Sync.state, off = navigator.onLine === false;
    let cls = 'pill', txt;
    if (s.needLogin) { cls += ' bad'; txt = 'Cần đăng nhập lại'; }
    else if (off) { cls += ' off'; txt = 'Ngoại tuyến' + (s.pending ? ' · ' + s.pending + ' chờ gửi' : ' · lưu trên máy'); }
    else if (s.running) { cls += ' busy'; txt = 'Đang đồng bộ…'; }
    else if (s.failed) { cls += ' bad'; txt = s.failed + ' thay đổi bị lỗi'; }
    else if (s.pending) { cls += ' off'; txt = s.pending + ' thay đổi chờ gửi'; }
    else if (s.last) { txt = 'Đã đồng bộ ' + new Date(s.last).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
    else txt = 'Chưa đồng bộ';
    el.className = cls; el.innerHTML = '<i></i>' + esc(txt);
  }

  let rtok = 0;
  async function renderRoute() {
    const tok = ++rtok; const fn = Views[App.route] || Views.home;
    let html; try { html = await fn(); } catch (e) { console.error(e); html = '<div class="card"><h2>Có lỗi khi hiển thị</h2><p class="note">' + esc(e.message || e) + '</p></div>'; }
    if (tok !== rtok) return;
    const v = $('#view'); if (!v) return;
    v.innerHTML = html;
    const after = Views['after_' + App.route]; if (after) await after();
    renderNav(); renderTop();
  }
  App.renderRoute = renderRoute;
  App.go = r => { App.route = r; w.scrollTo(0, 0); renderRoute(); };
  App.refresh = () => {
    if (!App.store || U.modalOpen()) return;
    const a = document.activeElement; if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    if (App.route === 'import') return;
    renderRoute();
  };

  /* ---------- Sự kiện ---------- */
  function act(el, ev, e) {
    const a = el.dataset.act;
    switch (a) {
      case 'nav': App.go(el.dataset.v); return;
      case 'theme': toggleTheme(); return;
      case 'close': U.closeModal(); return;
      case 'ovClose': if (ev === 'click' && e && e.target === el) U.closeModal(); return;
      case 'reload': location.reload(); return;
      case 'authMode': App.ui.authMode = el.dataset.v; renderAuth(); return;
      case 'authGo': authGo(); return;
      case 'createStore': createStore(); return;
      case 'logout': doLogout(); return;
      case 'logoutForce': doLogout(true); return;
      case 'syncNow': if (navigator.onLine === false) { U.toast('Đang ngoại tuyến, dữ liệu vẫn được lưu trên máy', 'bad'); return; } Sync.run(); return;
    }
    if (w.Views && Views.act) Views.act(el, ev, e);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (/^(INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)) return;
    act(el, 'click', e);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-act]'); if (!el || !/^(INPUT|SELECT)$/.test(el.tagName)) return;
    act(el, 'change', e);
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-act][data-live]'); if (!el) return;
    act(el, 'input', e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') U.closeModal();
    if (e.key === 'Enter' && (e.target.id === 'pw' || e.target.id === 'em')) { const b = $('#authbtn'); if (b && !b.disabled) authGo(); }
    if (e.key === 'Enter' && e.target.id === 'sn' && $('#csbtn')) createStore();
  });

  /* ---------- Khởi động ---------- */
  async function boot() {
    applyTheme();
    try { await DB.open(); } catch (e) { renderFatal('Trình duyệt không cho lưu dữ liệu trên máy (' + (e.message || e) + '). Hãy tắt chế độ ẩn danh và thử lại.', true); return; }
    const c = App.cfg;
    if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY || /DAN_|YOUR_|xxxx/i.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY)) { renderSetup(); return; }
    if (!w.supabase || !w.supabase.createClient) { renderFatal('Không tải được thư viện kết nối. Lần đầu mở ứng dụng cần có Internet.', true); return; }
    App.sb = w.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    App.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && App.store && !App.signingOut) { App.user = null; App.store = null; renderAuth('Phiên đăng nhập đã hết. Hãy đăng nhập lại; dữ liệu trên máy vẫn được giữ.'); } });
    let session = null;
    try { const r = await App.sb.auth.getSession(); session = r && r.data && r.data.session; } catch (e) {}
    const cached = await DB.getMeta('ctx');
    if (session) { App.user = session.user; await loadContext(); }
    else if (cached && navigator.onLine === false) { App.user = { id: cached.userId, email: cached.email }; await enter(cached); }
    else renderAuth();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  App.boot = boot;
  document.addEventListener('DOMContentLoaded', () => { if (w.Views) boot(); else w.addEventListener('load', boot); });
})(window);
