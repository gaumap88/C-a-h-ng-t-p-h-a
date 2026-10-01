/* Tiện ích dùng chung */
(function (w) {
  'use strict';
  const U = {};
  U.$ = (s, r) => (r || document).querySelector(s);
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('vi-VN');
  U.fmt = n => nf.format(Math.round(n || 0)) + ' ₫';
  U.fmtN = n => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n || 0);
  U.norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  U.uuid = () => (w.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  U.iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  U.dmy = s => { if (!s) return ''; const p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; };
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* Đọc số theo cách viết Việt Nam: "115.000", "115,000", "12,5", "1.234.567,5" */
  U.num = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).trim().replace(/[^\d,.\-]/g, '');
    if (!s || s === '-' ) return 0;
    const hasDot = s.indexOf('.') >= 0, hasCom = s.indexOf(',') >= 0;
    if (hasDot && hasCom) {
      const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
      const thou = dec === '.' ? ',' : '.';
      s = s.split(thou).join('').replace(dec, '.');
    } else if (hasDot || hasCom) {
      const sep = hasDot ? '.' : ',';
      const parts = s.split(sep);
      if (parts.length > 2) s = parts.join('');                       // nhiều dấu: là ngăn cách hàng nghìn
      else if (parts[1].length === 3 && parts[0].replace('-', '').length <= 3 && parts[0] !== '0') s = parts.join(''); // 1.500 -> 1500
      else s = parts.join('.');                                         // 12,5 -> 12.5
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  U.toast = (msg, kind) => {
    const t = U.$('#toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast on' + (kind === 'bad' ? ' bad' : '');
    clearTimeout(U.toast.h); U.toast.h = setTimeout(() => { t.className = 'toast'; }, 3200);
  };
  U.openModal = html => { U.$('#modal').innerHTML = '<div class="ov" data-act="ovClose"><div class="md" role="dialog" aria-modal="true">' + html + '</div></div>'; };
  U.closeModal = () => { U.$('#modal').innerHTML = ''; };
  U.modalOpen = () => !!U.$('#modal').innerHTML;

  U.download = (name, text, mime) => {
    const blob = new Blob(['\ufeff' + text], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  w.U = U;
})(window);
