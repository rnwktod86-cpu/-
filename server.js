// 예약접수/자료등록 공용 프로그램 (의존성 없음: Node 22.13+ 내장 sqlite 사용)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'reservations.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// 엑셀 양식(해운대2 시트)의 컬럼 순서와 동일
const FIELDS = [
  ['reservation_no', '예약번호'], ['corp', '최초예약법인'], ['counselor', '자료등록(상담자)'],
  ['registered_at', '자료등록일시(상담일시)'], ['memo', '자료등록자 메모'], ['reserved_date', '예약일'],
  ['purpose', '검사목적'], ['sample_name', '검체명'], ['test_detail', '검사세부사항'],
  ['client_type', '의뢰인구분'], ['client_name', '의뢰인 명칭'], ['sido', '시도'],
  ['sigungu', '의뢰인 시군구'], ['address', '소재지'], ['client_phone', '고객 전화'],
  ['client_contact', '고객측 담당자'], ['contact_mobile', '담당자 휴대폰'],
];
const KEYS = FIELDS.map(f => f[0]);

const db = new DatabaseSync(DB_FILE);
db.exec(`CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${KEYS.map(k => `${k} TEXT NOT NULL DEFAULT ''`).join(',\n  ')},
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)`);

const clean = body => Object.fromEntries(KEYS.map(k => [k, String(body[k] ?? '').trim()]));

// 입력 검증: 오류가 있으면 { 필드키: 메시지 } 반환
const REQUIRED = ['reserved_date', 'client_name'];
const LONG_FIELDS = ['memo', 'test_detail', 'address'];
const PHONE_FIELDS = ['client_phone', 'contact_mobile'];
const LABEL = Object.fromEntries(FIELDS);
const validDate = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};
function validate(d, id) {
  const err = {};
  for (const k of REQUIRED) if (!d[k]) err[k] = `${LABEL[k]}은(는) 필수 입력입니다.`;
  for (const k of KEYS) {
    const max = LONG_FIELDS.includes(k) ? 1000 : 100;
    if (!err[k] && d[k].length > max) err[k] = `${LABEL[k]}은(는) ${max}자 이내로 입력해 주세요.`;
    if (!err[k] && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(d[k])) err[k] = `${LABEL[k]}에 사용할 수 없는 문자가 있습니다.`;
  }
  if (!err.reserved_date && d.reserved_date && !validDate(d.reserved_date)) err.reserved_date = '예약일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.';
  if (!err.registered_at && d.registered_at) {
    const m = d.registered_at.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m || !validDate(m[1]) || +m[2] > 23 || +m[3] > 59) err.registered_at = '자료등록일시는 YYYY-MM-DD HH:MM 형식이어야 합니다.';
  }
  for (const k of PHONE_FIELDS) {
    if (err[k] || !d[k]) continue;
    const digits = d[k].replace(/\D/g, '').length;
    if (!/^[0-9+\-() ]+$/.test(d[k]) || digits < 8 || digits > 15) err[k] = `${LABEL[k]}은(는) 숫자·하이픈(-)만 사용해 8~15자리로 입력해 주세요.`;
  }
  if (!err.reservation_no && d.reservation_no) {
    if (/\s/.test(d.reservation_no)) err.reservation_no = '예약번호에는 공백을 사용할 수 없습니다.';
    else if (db.prepare('SELECT 1 FROM reservations WHERE reservation_no=? AND id IS NOT ?').get(d.reservation_no, id ? Number(id) : null))
      err.reservation_no = '이미 사용 중인 예약번호입니다.';
  }
  return Object.keys(err).length ? err : null;
}

function nextReservationNo() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  const prefix = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const row = db.prepare(`SELECT reservation_no FROM reservations WHERE reservation_no LIKE ? ORDER BY reservation_no DESC LIMIT 1`).get(prefix + '-%');
  const n = row ? parseInt(row.reservation_no.split('-')[1], 10) + 1 : 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

function list(q) {
  const where = [], args = [];
  if (q.q) { where.push('(' + KEYS.map(k => `${k} LIKE ?`).join(' OR ') + ')'); KEYS.forEach(() => args.push(`%${q.q}%`)); }
  if (q.from) { where.push('reserved_date >= ?'); args.push(q.from); }
  if (q.to) { where.push('reserved_date <= ?'); args.push(q.to); }
  const sql = `SELECT * FROM reservations ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY reserved_date DESC, id DESC`;
  return db.prepare(sql).all(...args);
}

const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
function toCsv(rows) {
  const lines = [FIELDS.map(f => csvCell(f[1])).join(',')];
  for (const r of rows) lines.push(KEYS.map(k => csvCell(r[k])).join(','));
  return '﻿' + lines.join('\r\n'); // BOM: 엑셀에서 한글 깨짐 방지
}

const send = (res, code, data, type = 'application/json; charset=utf-8', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, ...extra });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};
const readBody = req => new Promise((ok, no) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/api\/reservations(?:\/(\d+))?$/);
  try {
    if (url.pathname === '/api/fields') return send(res, 200, FIELDS);
    if (url.pathname === '/api/export.csv') {
      return send(res, 200, toCsv(list(Object.fromEntries(url.searchParams))), 'text/csv; charset=utf-8',
        { 'Content-Disposition': `attachment; filename="reservations_${new Date().toISOString().slice(0, 10)}.csv"` });
    }
    if (m) {
      const id = m[1];
      const user = decodeURIComponent(req.headers['x-user'] || '');
      if (req.method === 'GET' && !id) return send(res, 200, list(Object.fromEntries(url.searchParams)));
      if (req.method === 'POST' && !id) {
        const d = clean(await readBody(req));
        const errors = validate(d);
        if (errors) return send(res, 400, { errors });
        if (!d.reservation_no) d.reservation_no = nextReservationNo();
        if (!d.counselor) d.counselor = user;
        if (!d.registered_at) d.registered_at = new Date().toLocaleString('sv').slice(0, 16);
        const info = db.prepare(`INSERT INTO reservations (${KEYS.join(',')},updated_by) VALUES (${KEYS.map(() => '?').join(',')},?)`)
          .run(...KEYS.map(k => d[k]), user);
        return send(res, 201, db.prepare('SELECT * FROM reservations WHERE id=?').get(info.lastInsertRowid));
      }
      if (req.method === 'PUT' && id) {
        const d = clean(await readBody(req));
        const errors = validate(d, id);
        if (errors) return send(res, 400, { errors });
        db.prepare(`UPDATE reservations SET ${KEYS.map(k => k + '=?').join(',')},updated_by=?,updated_at=datetime('now','localtime') WHERE id=?`)
          .run(...KEYS.map(k => d[k]), user, id);
        return send(res, 200, db.prepare('SELECT * FROM reservations WHERE id=?').get(id));
      }
      if (req.method === 'DELETE' && id) { db.prepare('DELETE FROM reservations WHERE id=?').run(id); return send(res, 200, { ok: true }); }
    }
    // 정적 파일
    const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
    if (file.startsWith(path.join(__dirname, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
      return send(res, 200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
});

server.listen(PORT, '0.0.0.0', () => console.log(`예약접수 프로그램 실행 중: http://localhost:${PORT}  (같은 네트워크: http://<이 PC의 IP>:${PORT})`));
