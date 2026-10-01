/* Đọc file Excel (.xlsx) và CSV ngay trên trình duyệt, không cần thư viện ngoài.
   Chỉ đọc giá trị ô của trang tính đầu tiên (đủ để nhập danh mục hàng). */
(function (w) {
  'use strict';
  const XL = {};
  const dec = new TextDecoder('utf-8');

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt quá cũ để đọc .xlsx, hãy lưu file thành .csv');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function zipEntries(buf) {
    const dv = new DataView(buf); const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('File không phải là .xlsx hợp lệ');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      out[name] = { method, csize, lho };
      p += 46 + nl + el + cl;
    }
    out.__read = async name => {
      const e = out[name]; if (!e) return null;
      const ln = dv.getUint16(e.lho + 26, true), le = dv.getUint16(e.lho + 28, true);
      const start = e.lho + 30 + ln + le; const data = u8.subarray(start, start + e.csize);
      return e.method === 0 ? data : inflateRaw(data);
    };
    return out;
  }

  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const all = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  const colIndex = ref => { const m = /^([A-Z]+)/.exec(ref) ; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

  XL.readXlsx = async function (buf) {
    const z = zipEntries(buf);
    const txt = async n => { const b = await z.__read(n); return b ? dec.decode(b) : null; };
    let shared = [];
    const sst = await txt('xl/sharedStrings.xml');
    if (sst) shared = all(xml(sst), 'si').map(si => all(si, 't').map(t => t.textContent).join(''));
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wb = await txt('xl/workbook.xml'), rels = await txt('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const first = all(xml(wb), 'sheet')[0];
      if (first) {
        const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const rel = all(xml(rels), 'Relationship').find(r => r.getAttribute('Id') === rid);
        if (rel) { let t = rel.getAttribute('Target'); t = t.replace(/^\//, ''); sheetPath = t.indexOf('xl/') === 0 ? t : 'xl/' + t; }
      }
    }
    const sx = await txt(sheetPath);
    if (!sx) throw new Error('Không đọc được trang tính đầu tiên của file');
    const rows = [];
    all(xml(sx), 'row').forEach(r => {
      const ri = parseInt(r.getAttribute('r'), 10) - 1;
      const row = rows[ri] = rows[ri] || [];
      all(r, 'c').forEach(c => {
        const ref = c.getAttribute('r'); if (!ref) return;
        const ci = colIndex(ref), t = c.getAttribute('t');
        const vEl = all(c, 'v')[0]; const v = vEl ? vEl.textContent : '';
        let val = '';
        if (t === 's') val = shared[parseInt(v, 10)] || '';
        else if (t === 'inlineStr') val = all(c, 't').map(x => x.textContent).join('');
        else if (t === 'str') val = v;
        else if (t === 'b') val = v === '1';
        else if (t === 'e') val = '';
        else val = v === '' ? '' : Number(v);
        row[ci] = val;
      });
    });
    return Array.from(rows, r => Array.from(r || [], x => x === undefined ? '' : x));
  };

  XL.parseCsv = function (text) {
    text = text.replace(/^\ufeff/, '');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : (firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };

  XL.readFile = async function (file) {
    const name = (file.name || '').toLowerCase();
    if (/\.(csv|txt)$/.test(name)) return XL.parseCsv(await file.text());
    if (/\.xlsx$/.test(name)) return XL.readXlsx(await file.arrayBuffer());
    if (/\.xls$/.test(name)) throw new Error('File .xls (Excel cũ) chưa đọc được. Hãy mở bằng Excel, chọn Lưu thành, định dạng .xlsx hoặc .csv');
    throw new Error('Chỉ nhận file .xlsx hoặc .csv');
  };
  w.XL = XL;
})(window);
