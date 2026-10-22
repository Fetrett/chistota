'use strict';
/** Главный обработчик: Web Request → Web Response. Используется Netlify Function и локальным dev.js. */
const { createRouter, makeReq, makeRes } = require('./http');
const store = require('./store');
const pub = require('./routes-public');
const admin = require('./routes-admin');
const views = require('./views/public');

const router = createRouter();
pub.register(router);
admin.register(router);

async function purgeCdn() {
  if (store.isLocal) return;
  try { const { purgeCache } = await import('@netlify/functions'); await purgeCache(); }
  catch (e) { console.error('[purge]', e.message); }
}

async function handle(request, { ip, deployId } = {}) {
  if (deployId) require('./config').version = String(deployId).slice(-10);
  let req; const res = makeRes();
  try {
    req = await makeReq(request, ip);
    const m = router.match(req.method, req.path);
    if (m && m.notAllowed) return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
    if (req.method === 'POST') {
      // Межсайтовые POST-запросы отклоняются
      const origin = req.headers.origin;
      if (origin && origin !== 'null') { let host = ''; try { host = new URL(origin).host; } catch { /* */ } if (host !== req.headers.host) return new Response('Forbidden', { status: 403 }); }
    }
    await store.loadContent();
    if (!m) {
      if (req.path.startsWith('/admin')) res.html('<h1>404</h1>', 404);
      else res.html(views.notFound(pub.context(req)), 404);
      return res.toResponse(req.method);
    }
    req.params = m.params;
    for (const h of m.handlers) {
      let next = false;
      await h(req, res, () => { next = true; });
      if (!next) break;
    }
    const contentChanged = await store.flush();
    if (contentChanged) await purgeCdn();
    return res.toResponse(req.method);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(new Date().toISOString(), request.method, request.url, err);
    const msg = status === 413 ? 'Слишком большой запрос (файл больше 4 МБ).' : status === 400 ? 'Некорректный запрос.' : 'Внутренняя ошибка сервера. Попробуйте ещё раз.';
    if ((request.headers.get('accept') || '').includes('application/json')) return Response.json({ ok: false, error: msg }, { status });
    return new Response(`<!doctype html><meta charset="utf-8"><title>Ошибка</title><body style="font-family:system-ui;padding:40px"><h1>${status}</h1><p>${msg}</p><p><a href="/">На главную</a></p>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
  }
}

module.exports = { handle };
