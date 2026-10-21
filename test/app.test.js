'use strict';
/**
 * Тесты без Netlify: вызывают тот же обработчик, что и Netlify Function, на временном хранилище.
 *   npm test
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.LOCAL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-nf-'));
process.env.ADMIN_PASSWORD = 'Test-password-1';
process.env.TELEGRAM_BOT_TOKEN = '1:T';
process.env.TELEGRAM_CHAT_ID = '42';
const app = require('../src/app');

const sent = [];
let tg;
before(async () => {
  tg = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { sent.push({ url: req.url, body: JSON.parse(b) }); res.end('{"ok":true}'); }); });
  await new Promise((r) => tg.listen(0, '127.0.0.1', r));
  process.env.TELEGRAM_API_BASE = `http://127.0.0.1:${tg.address().port}`;
});
after(() => { tg.close(); fs.rmSync(process.env.LOCAL_DATA_DIR, { recursive: true, force: true }); });

const H = 'example.test';
const call = (p, o = {}) => app.handle(new Request(`https://${H}${p}`, { redirect: 'manual', ...o, headers: { host: H, ...(o.headers || {}) } }), { ip: o.ip || '10.0.0.1' });
const form = (obj) => new URLSearchParams(obj).toString();
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const old = () => String(Date.now() - 10000);

test('публичные страницы', async () => {
  for (const p of ['/', '/uslugi', '/ceny', '/raschet', '/kontakty', '/politika', '/uslugi/generalnaya-uborka', '/robots.txt', '/sitemap.xml']) assert.equal((await call(p)).status, 200, p);
  assert.equal((await call('/uslugi/net')).status, 404);
  const h = await (await call('/')).text();
  assert.equal((h.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(h, /tel:\+79000000000/);
  const r = await call('/');
  assert.match(r.headers.get('netlify-cdn-cache-control'), /s-maxage/);
});

test('заявка: сохраняется, сумма считается на сервере, уходит в Telegram', async () => {
  const r = await call('/zayavka', { method: 'POST', headers: { ...FORM, Accept: 'application/json' }, body: form({ kind: 'order', ts: old(), name: 'Мария', phone: '8 912 000-11-22', service_id: '2', qty: '40', addons: '101', consent: '1' }) });
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.estimate, 170 * 40 + 700);
  const m = sent.at(-1);
  assert.equal(m.url, '/bot1:T/sendMessage'); assert.equal(m.body.chat_id, '42');
  assert.match(m.body.text, /Мария/); assert.match(m.body.text, /\+7 \(912\) 000-11-22/); assert.match(m.body.text, /Генеральная уборка — 40 м²/); assert.match(m.body.text, /Духовка внутри/);
  assert.match(m.body.text, /https:\/\/example\.test\/admin\/leads\/\d+/);
});

test('заявка без JS: редирект на «Спасибо»', async () => {
  const r = await call('/zayavka', { method: 'POST', headers: FORM, body: form({ kind: 'callback', ts: old(), name: 'Без JS', phone: '89005556677', consent: '1' }), ip: '10.0.0.2' });
  assert.equal(r.status, 303); assert.match(r.headers.get('location'), /^\/spasibo/);
});

test('ошибки заявки и антиспам', async () => {
  const J = { ...FORM, Accept: 'application/json' };
  let r = await call('/zayavka', { method: 'POST', headers: J, body: form({ kind: 'order', ts: old(), name: '', phone: '1' }), ip: '10.0.0.3' });
  assert.equal(r.status, 422); const j = await r.json(); assert.ok(j.errors.name && j.errors.phone && j.errors.consent);
  const n = sent.length;
  r = await call('/zayavka', { method: 'POST', headers: J, body: form({ kind: 'callback', ts: old(), name: 'Бот', phone: '89001112233', consent: '1', website: 'spam' }), ip: '10.0.0.4' });
  assert.equal((await r.json()).id, null); assert.equal(sent.length, n, 'ловушка: в Telegram ничего не ушло');
  r = await call('/zayavka', { method: 'POST', headers: J, body: form({ kind: 'callback', ts: String(Date.now()), name: 'Быстрый', phone: '89001112233', consent: '1' }), ip: '10.0.0.5' });
  assert.equal(r.status, 429);
  for (let i = 0; i < 5; i++) await call('/zayavka', { method: 'POST', headers: J, body: form({ kind: 'callback', ts: old(), name: 'Флуд', phone: '89001112233', consent: '1' }), ip: '10.0.0.6' });
  r = await call('/zayavka', { method: 'POST', headers: J, body: form({ kind: 'callback', ts: old(), name: 'Флуд', phone: '89001112233', consent: '1' }), ip: '10.0.0.6' });
  assert.equal(r.status, 429, 'лимит 5 заявок за 10 минут с IP');
});

test('XSS экранируется', async () => {
  const r = await call('/zayavka', { method: 'POST', headers: FORM, body: form({ kind: 'callback', name: '"><script>alert(1)</script>', phone: '1' }), ip: '10.0.0.7' });
  const h = await r.text(); assert.equal(r.status, 422); assert.ok(!h.includes('<script>alert(1)</script>'));
});

test('админка закрыта без входа', async () => {
  for (const p of ['/admin', '/admin/leads', '/admin/services', '/admin/settings']) { const r = await call(p); assert.equal(r.status, 303); assert.match(r.headers.get('location'), /\/admin\/login/); }
  assert.equal((await call('/admin/leads/1/status', { method: 'POST', headers: { ...FORM, Accept: 'application/json' }, body: form({ status: 'done' }) })).status, 401);
  const forged = 'ec_admin=' + encodeURIComponent(`${Date.now() + 1e6}.abc.fake`);
  assert.equal((await call('/admin', { headers: { cookie: forged } })).status, 303, 'поддельная cookie не принимается');
});

async function login() {
  const bad = await call('/admin/login', { method: 'POST', headers: FORM, body: form({ password: 'wrong-password' }), ip: '10.1.0.1' });
  assert.equal(bad.status, 401);
  const r = await call('/admin/login', { method: 'POST', headers: FORM, body: form({ password: 'Test-password-1' }), ip: '10.1.0.1' });
  assert.equal(r.status, 303);
  const c = r.headers.getSetCookie()[0]; assert.match(c, /HttpOnly/); assert.match(c, /Secure/);
  const cookie = c.split(';')[0];
  const csrf = /name="_csrf" value="([^"]+)"/.exec(await (await call('/admin/services', { headers: { cookie } })).text())[1];
  return { cookie, csrf };
}

test('CSRF и CRUD услуги отражаются на сайте', async () => {
  const { cookie, csrf } = await login();
  const h = { cookie, ...FORM };
  await call('/admin/services/new', { method: 'POST', headers: h, body: form({ name: 'Без токена', summary: 'x', price: '1' }) });
  assert.ok(!(await (await call('/ceny')).text()).includes('Без токена'), 'без CSRF не создано');
  let r = await call('/admin/services/new', { method: 'POST', headers: h, body: form({ _csrf: csrf, name: 'Чистка штор', summary: 'На месте', price: '400', per_area: '0', unit: '₽/окно', min_price: '1200', visible: '1' }) });
  assert.equal(r.status, 303);
  assert.match(await (await call('/uslugi/chistka-shtor')).text(), /от <span class="num">400<\/span>/);
  const id = /\/admin\/services\/(\d+)/.exec(r.headers.get('location'))[1];
  r = await call(`/admin/services/${id}`, { method: 'POST', headers: h, body: form({ _csrf: csrf, name: 'Чистка штор', summary: 'На месте', price: '-5' }) });
  assert.equal(r.status, 422);
  await call(`/admin/services/${id}/delete`, { method: 'POST', headers: h, body: form({ _csrf: csrf }) });
  assert.equal((await call('/uslugi/chistka-shtor')).status, 404);
});

test('контакты → телефон на сайте; фото → /media', async () => {
  const { cookie, csrf } = await login();
  await call('/admin/contacts', { method: 'POST', headers: { cookie, ...FORM }, body: form({ _csrf: csrf, name: 'Эксперты чистоты', city: 'Зеркальный', city_in: 'Зеркальном', phone: '+7 912 111-22-33', hours: 'Ежедневно', areas: 'Центр' }) });
  assert.match(await (await call('/kontakty')).text(), /tel:\+79121112233/);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
  const fd = new FormData();
  for (const [k, v] of Object.entries({ _csrf: csrf, name: 'Поддерживающая уборка', summary: 'x', price: '90', per_area: '1', unit: '₽/м²', visible: '1', slug: 'podderzhivayushchaya-uborka', image: '/static/img/living.svg' })) fd.append(k, v);
  fd.append('image_file', new Blob([png], { type: 'image/png' }), 'a.png');
  const r = await app.handle(new Request(`https://${H}/admin/services/1`, { method: 'POST', body: fd, headers: { cookie, host: H } }), { ip: '1' });
  assert.equal(r.status, 303);
  const page = await (await call('/uslugi/podderzhivayushchaya-uborka')).text();
  const src = /src="(\/media\/[^"]+)"/.exec(page)[1];
  const img = await call(src); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
});

test('межсайтовый POST отклоняется', async () => {
  assert.equal((await call('/zayavka', { method: 'POST', headers: { ...FORM, origin: 'https://evil.example' }, body: 'x=1' })).status, 403);
});

test('без ADMIN_PASSWORD вход невозможен и есть подсказка', async () => {
  const saved = process.env.ADMIN_PASSWORD; process.env.ADMIN_PASSWORD = '';
  const h = await (await call('/admin/login')).text();
  assert.match(h, /ADMIN_PASSWORD/);
  assert.equal((await call('/admin/login', { method: 'POST', headers: FORM, body: form({ password: '' }) })).status, 401);
  process.env.ADMIN_PASSWORD = saved;
});
