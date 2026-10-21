'use strict';
/** Модели данных поверх JSON-документа из store.js (синхронные — документ уже загружен в начале запроса). */
const store = require('./store');
const { state, touchContent, touchLeads, nextId, sqlNow } = store;

const STATUSES = {
  new: { label: 'Новая', tone: 'new' },
  in_progress: { label: 'В работе', tone: 'progress' },
  done: { label: 'Завершена', tone: 'done' },
  cancelled: { label: 'Отменена', tone: 'cancel' },
};
const KINDS = { order: 'Расчёт и заявка', callback: 'Обратный звонок' };
const ITEM_KINDS = {
  advantage: { label: 'Преимущества', single: 'преимущество' },
  step: { label: 'Этапы работы', single: 'этап' },
  faq: { label: 'Вопросы и ответы', single: 'вопрос' },
  review: { label: 'Отзывы', single: 'отзыв' },
};

const C = () => state.content;
const bySort = (a, b) => a.sort - b.sort || a.id - b.id;
const copy = (x) => (x ? { ...x } : x);

function moveIn(list, id, dir) {
  const rows = list.slice().sort(bySort);
  const i = rows.findIndex((r) => r.id === Number(id));
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  rows.forEach((r, k) => { r.sort = (k + 1) * 10; });
  touchContent();
}
const maxSort = (list) => list.reduce((m, x) => Math.max(m, x.sort || 0), 0) + 10;

// ---------- Настройки ----------
const defaults = store.seed().settings;
function getGroup(key) { return { ...(defaults[key] || {}), ...(C().settings[key] || {}) }; }
function setGroup(key, patch) { C().settings[key] = { ...getGroup(key), ...patch }; touchContent(); }

// ---------- Услуги ----------
const Services = {
  list({ visibleOnly = false } = {}) { return C().services.filter((s) => !visibleOnly || s.visible).sort(bySort).map(copy); },
  get(id) { return copy(C().services.find((s) => s.id === Number(id))); },
  slugTaken(slug, exceptId = 0) { return C().services.some((s) => s.slug === slug && s.id !== Number(exceptId)); },
  create(d) { const id = nextId(); const now = sqlNow(); C().services.push({ ...d, id, sort: maxSort(C().services), created_at: now, updated_at: now }); touchContent(); return id; },
  update(id, d) { const s = C().services.find((x) => x.id === Number(id)); if (s) { Object.assign(s, d, { updated_at: sqlNow() }); touchContent(); } },
  toggle(id, field) { const s = C().services.find((x) => x.id === Number(id)); if (s && ['visible', 'featured'].includes(field)) { s[field] = s[field] ? 0 : 1; touchContent(); } },
  remove(id) { C().services = C().services.filter((s) => s.id !== Number(id)); touchContent(); },
  move(id, dir) { moveIn(C().services, id, dir); },
  categories() { return [...new Set(C().services.map((s) => s.category).filter(Boolean))].sort(); },
};

// ---------- Доп. опции ----------
const Addons = {
  list({ visibleOnly = false } = {}) { return C().addons.filter((a) => !visibleOnly || a.visible).sort(bySort).map(copy); },
  get(id) { return copy(C().addons.find((a) => a.id === Number(id))); },
  byIds(ids) { const set = new Set(ids.map(Number)); return this.list({ visibleOnly: true }).filter((a) => set.has(a.id)); },
  save(id, d) {
    if (id) { const a = C().addons.find((x) => x.id === Number(id)); if (a) Object.assign(a, d); }
    else C().addons.push({ ...d, id: nextId(), sort: maxSort(C().addons) });
    touchContent();
  },
  remove(id) { C().addons = C().addons.filter((a) => a.id !== Number(id)); touchContent(); },
  move(id, dir) { moveIn(C().addons, id, dir); },
};

// ---------- Преимущества, этапы, FAQ, отзывы ----------
const Items = {
  list(kind, { visibleOnly = false } = {}) { return C().items.filter((i) => i.kind === kind && (!visibleOnly || i.visible)).sort(bySort).map(copy); },
  get(id) { return copy(C().items.find((i) => i.id === Number(id))); },
  save(id, d) {
    if (id) { const it = C().items.find((x) => x.id === Number(id)); if (it) Object.assign(it, d); }
    else C().items.push({ ...d, id: nextId(), sort: maxSort(C().items.filter((i) => i.kind === d.kind)) });
    touchContent();
  },
  remove(id) { C().items = C().items.filter((i) => i.id !== Number(id)); touchContent(); },
  move(id, dir) { const it = this.get(id); if (it) moveIn(C().items.filter((i) => i.kind === it.kind), id, dir); },
};

// ---------- Заявки (копии заявок с сайта) ----------
const MAX_LEADS = 2000;
const L = () => state.leads;
const Leads = {
  create(d) {
    const id = ++L().seq; const now = sqlNow();
    L().items.unshift({ id, status: 'new', note: '', ...d, created_at: now, updated_at: now });
    if (L().items.length > MAX_LEADS) L().items.length = MAX_LEADS;
    touchLeads();
    return id;
  },
  get(id) { return copy(L().items.find((l) => l.id === Number(id))); },
  search({ q = '', status = '', kind = '', page = 1, per = 20 } = {}) {
    const ql = q.toLowerCase(); const dq = q.replace(/\D/g, '');
    let rows = L().items.filter((l) => (!status || l.status === status) && (!kind || l.kind === kind));
    if (q) rows = rows.filter((l) => [l.name, l.email, l.address, l.comment, l.service_name].some((v) => String(v || '').toLowerCase().includes(ql)) || (dq.length >= 3 && l.phone.includes(dq)));
    const total = rows.length; const pages = Math.max(1, Math.ceil(total / per));
    page = Math.min(Math.max(1, page), pages);
    return { rows: rows.slice((page - 1) * per, page * per).map(copy), total, page, pages };
  },
  counts() {
    const out = { all: 0, new: 0, in_progress: 0, done: 0, cancelled: 0, week: 0 };
    const weekAgo = Date.now() - 7 * 864e5;
    for (const l of L().items) { out[l.status]++; out.all++; if (Date.parse(l.created_at.replace(' ', 'T') + 'Z') >= weekAgo) out.week++; }
    return out;
  },
  recent(n = 6) { return L().items.slice(0, n).map(copy); },
  update(id, { status, note }) { const l = L().items.find((x) => x.id === Number(id)); if (l) { Object.assign(l, { status, note, updated_at: sqlNow() }); touchLeads(); } },
  setStatus(id, status) { this.update(id, { status, note: (this.get(id) || {}).note || '' }); },
  remove(id) { L().items = L().items.filter((l) => l.id !== Number(id)); touchLeads(); },
  recentFromIpHash(h, minutes) {
    const since = Date.now() - minutes * 60000;
    return L().items.filter((l) => l.ip_hash === h && Date.parse(l.created_at.replace(' ', 'T') + 'Z') >= since).length;
  },
};

module.exports = { Services, Addons, Items, Leads, STATUSES, KINDS, ITEM_KINDS, getGroup, setGroup };
