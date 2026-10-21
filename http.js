'use strict';
/** Роутер и тонкий адаптер Web Request → req/res → Web Response (формат Netlify Functions v2). */
const { parseCookies, part } = require('./util');

function createRouter() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/$/, '').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handlers });
  };
  return {
    get: add('GET'), post: add('POST'),
    match(method, pathname) {
      let allowed = false;
      for (const r of routes) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) { allowed = true; continue; }
        const params = {};
        r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
        return { handlers: r.handlers, params };
      }
      return allowed ? { notAllowed: true } : null;
    },
  };
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'",
};
const MAX_BODY = 4.5 * 1024 * 1024;

async function makeReq(request, ip) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  const req = {
    method: request.method, url: url.pathname + url.search, path: url.pathname, query: Object.fromEntries(url.searchParams),
    headers, cookies: parseCookies(headers.cookie), ip: ip || 'unknown', origin: url.origin,
    wantsJson: (headers.accept || '').includes('application/json'), body: {}, files: {}, params: {},
    secure: url.protocol === 'https:' || headers['x-forwarded-proto'] === 'https',
  };
  if (request.method === 'POST') {
    if (Number(headers['content-length'] || 0) > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    const type = headers['content-type'] || '';
    if (type.startsWith('application/json')) {
      try { req.body = await request.json(); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
    } else if (type.startsWith('multipart/form-data') || type.startsWith('application/x-www-form-urlencoded')) {
      const fd = await request.formData();
      for (const [k0, v] of fd.entries()) {
        const k = k0.endsWith('[]') ? k0.slice(0, -2) : k0;
        if (typeof v === 'string') req.body[k] = k in req.body ? [].concat(req.body[k], v) : v;
        else if (v && v.size) req.files[k] = { filename: v.name, type: v.type, data: Buffer.from(await v.arrayBuffer()) };
      }
    }
  }
  return req;
}

function makeRes() {
  const headers = new Headers(SECURITY_HEADERS);
  const res = {
    status: 200, body: null, done: false, headers,
    setHeader(k, v) { if (k.toLowerCase() === 'set-cookie') headers.append('Set-Cookie', v); else headers.set(k, v); },
    removeHeader(k) { headers.delete(k); },
    send(status, body, type = 'text/html; charset=utf-8', extra = {}) {
      res.status = status; res.body = Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : part(body);
      headers.set('Content-Type', type);
      for (const [k, v] of Object.entries(extra)) headers.set(k, v);
      res.done = true;
    },
    html(body, status = 200, extra = {}) { res.send(status, '<!doctype html>' + part(body), 'text/html; charset=utf-8', { 'Cache-Control': 'no-store', ...extra }); },
    json(obj, status = 200) { res.send(status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' }); },
    redirect(loc, status = 303) { res.status = status; headers.set('Location', loc); headers.set('Cache-Control', 'no-store'); res.body = null; res.done = true; },
    toResponse(method) { return new Response(method === 'HEAD' ? null : res.body, { status: res.status, headers }); },
  };
  return res;
}

module.exports = { createRouter, makeReq, makeRes };
