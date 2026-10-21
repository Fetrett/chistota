'use strict';
/**
 * Локальный запуск без Netlify (для проверки на своём компьютере):
 *   ADMIN_PASSWORD=придумайте-пароль node dev.js   → http://localhost:8888
 * Данные хранятся в папке .data/ вместо Netlify Blobs.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
process.env.LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(__dirname, '.data');
const app = require('./src/app');

const PUB = path.join(__dirname, 'public');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Как preferStatic на Netlify: существующий файл из public/ отдаётся напрямую
  const file = path.normalize(path.join(PUB, decodeURIComponent(url.pathname)));
  if (file.startsWith(PUB + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() && MIME[path.extname(file)]) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] }); return fs.createReadStream(file).pipe(res);
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const response = await app.handle(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }), { ip: req.socket.remoteAddress });
  const out = {}; response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie(); if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
});
const PORT = Number(process.env.PORT) || 8888;
server.listen(PORT, () => {
  console.log(`Сайт: http://localhost:${PORT}   Админка: http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) console.log('Чтобы войти в админку, запустите так: ADMIN_PASSWORD=ваш-пароль node dev.js');
});
module.exports = { server };
