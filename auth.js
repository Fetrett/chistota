'use strict';
/**
 * Вход в админку по паролю из переменной окружения ADMIN_PASSWORD (задаётся в настройках Netlify).
 *  - Пароль нигде не хранится в коде и в репозитории.
 *  - Сессия — подписанная HMAC cookie (HttpOnly, Secure на https, SameSite=Lax), срок 7 дней.
 *    Ключ подписи выводится из пароля: смена пароля в Netlify сразу разлогинивает всех.
 *  - CSRF-токен выводится из сессии и проверяется на каждом изменяющем запросе.
 *  - Перебор: задержка на неверный пароль + лимит попыток с одного IP.
 */
const crypto = require('crypto');
const { safeEqual, cookie, limiter, token } = require('./util');

const COOKIE = 'ec_admin';
const TTL = 7 * 24 * 3600 * 1000;
const pw = () => process.env.ADMIN_PASSWORD || '';
const key = () => crypto.createHash('sha256').update('ec-admin-session:' + pw()).digest();
const sign = (s) => crypto.createHmac('sha256', key()).update(s).digest('base64url');

function configProblem() {
  if (!pw()) return 'Пароль админки не задан. В Netlify откройте Project configuration → Environment variables и добавьте ADMIN_PASSWORD.';
  if (pw().length < 10) return 'Пароль в ADMIN_PASSWORD слишком короткий: нужно не меньше 10 символов. Измените переменную в Netlify и сделайте Redeploy.';
  return null;
}

const ipLimit = limiter(10, 15 * 60 * 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(password, ip) {
  const problem = configProblem();
  if (problem) return { error: problem };
  if (ipLimit.blocked(ip)) return { error: 'Слишком много попыток. Подождите 15 минут.' };
  const a = crypto.createHash('sha256').update(String(password || '')).digest('hex');
  const b = crypto.createHash('sha256').update(pw()).digest('hex');
  if (!safeEqual(a, b)) { ipLimit.hit(ip); await sleep(600); return { error: 'Неверный пароль' }; }
  ipLimit.reset(ip);
  const body = `${Date.now() + TTL}.${token(12)}`;
  return { value: `${body}.${sign(body)}` };
}

function getSession(value) {
  if (configProblem() || !value || value.length > 200) return null;
  const i = value.lastIndexOf('.');
  const body = value.slice(0, i); const sig = value.slice(i + 1);
  if (!safeEqual(sign(body), sig)) return null;
  if (Number(body.split('.')[0]) < Date.now()) return null;
  return { user: { id: 1, email: 'Владелец', name: '' }, csrf: sign('csrf:' + value).slice(0, 32) };
}
const checkCsrf = (s, v) => !!s && typeof v === 'string' && safeEqual(s.csrf, v);

const sessionCookie = (v, secure) => cookie(COOKIE, v, { secure, maxAge: TTL / 1000 });
const clearCookie = (secure) => cookie(COOKIE, '', { secure, maxAge: 0 });

module.exports = { COOKIE, login, getSession, checkCsrf, sessionCookie, clearCookie, configProblem };
