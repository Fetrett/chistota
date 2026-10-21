'use strict';
const crypto = require('crypto');

// ---------- Безопасный HTML-шаблонизатор: всё экранируется, кроме raw() ----------
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(String(s ?? ''));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Типографика: неразрывный пробел перед тире, чтобы тире не начинало строку
const esc = (v) => String(v ?? '').replace(/ ([—–]) /g, '\u00A0$1 ').replace(/[&<>"']/g, (c) => ESC[c]);
function part(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === false || v == null) return '';
  return esc(v);
}
function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Raw(out);
}

// ---------- Форматирование ----------
const nf = new Intl.NumberFormat('ru-RU');
const fmt = (n) => nf.format(Math.round(Number(n) || 0)).replace(/\s/g, ' ');
const rub = (n) => fmt(n) + ' ₽';
const lines = (s) => String(s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const paragraphs = (s) => String(s || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
function dateRu(sqlDate, withTime = true) {
  if (!sqlDate) return '';
  const d = new Date(String(sqlDate).replace(' ', 'T') + (String(sqlDate).length <= 10 ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return sqlDate;
  const o = { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) };
  if (String(sqlDate).length <= 10) o.timeZone = 'UTC';
  return d.toLocaleString('ru-RU', o).replace(' г.', '');
}

function digits(s) { return String(s || '').replace(/\D/g, ''); }
function normPhone(s) {
  let d = digits(s);
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1);
  else if (d.length === 10 && d[0] === '9') d = '7' + d;
  else if (!(d.length >= 11 && d.length <= 15)) return null;
  return '+' + d;
}
const telHref = (s) => 'tel:' + (normPhone(s) || digits(s));
function prettyPhone(p) {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(p || '');
  return m ? `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}` : p;
}

const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
function slugify(s) {
  const t = String(s || '').toLowerCase().split('').map((c) => (c in TR ? TR[c] : c)).join('');
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'usluga';
}

// ---------- Куки ----------
function parseCookies(h) {
  const out = {};
  for (const p of String(h || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* пропускаем битую cookie */ } }
  }
  return out;
}
function cookie(name, value, o = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=${o.path || '/'}; SameSite=${o.sameSite || 'Lax'}`;
  if (o.httpOnly !== false) s += '; HttpOnly';
  if (o.secure) s += '; Secure';
  if (o.maxAge != null) s += `; Max-Age=${o.maxAge}`;
  return s;
}

// ---------- Криптография ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = (n = 32) => crypto.randomBytes(n).toString('base64url');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Лимит запросов (скользящее окно в памяти процесса) ----------
function limiter(max, windowMs) {
  const m = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, a] of m) if (!a.some((t) => now - t < windowMs)) m.delete(k); }, 60000).unref();
  const recent = (k) => (m.get(k) || []).filter((t) => Date.now() - t < windowMs);
  return {
    hit(k) { const a = recent(k); a.push(Date.now()); m.set(k, a); return a.length > max; },
    blocked(k) { return recent(k).length >= max; },
    reset(k) { m.delete(k); },
  };
}

/** Ссылка на личный чат в Telegram по логину (@name) или номеру телефона. Пусто, если не задано. */
function tgBase(v) {
  const s = String(v || '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '');
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s)) return 'https://t.me/' + s;
  const p = normPhone(s);
  return p ? 'https://t.me/' + p : '';
}

module.exports = { tgBase, raw, esc, html, part, Raw, fmt, rub, lines, paragraphs, dateRu, digits, normPhone, telHref, prettyPhone, slugify, parseCookies, cookie, sha256, token, safeEqual, limiter };
