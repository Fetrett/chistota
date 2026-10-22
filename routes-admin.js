'use strict';
/**
 * Админ-панель. Каждый маршрут /admin/* (кроме входа) проходит requireAuth на сервере,
 * каждый POST дополнительно проверяет CSRF-токен. Ввод валидируется в validate.js.
 */
const auth = require('./auth');
const V = require('./validate');
const media = require('./media');
const store = require('./store');
const { Services, Addons, Items, Leads, STATUSES, ITEM_KINDS, getGroup, setGroup } = require('./models');
const views = require('./views/admin');
const { cookie, normPhone } = require('./util');

const FLASH = 'ec_flash';
function flash(req, res, type, msg) { res.setHeader('Set-Cookie', cookie(FLASH, JSON.stringify({ type, msg }), { maxAge: 30, path: '/admin', secure: req.secure })); }
function takeFlash(req, res) {
  if (!req.cookies[FLASH]) return null;
  res.setHeader('Set-Cookie', cookie(FLASH, '', { maxAge: 0, path: '/admin', secure: req.secure }));
  try { const f = JSON.parse(req.cookies[FLASH]); return typeof f.msg === 'string' ? { type: f.type === 'err' ? 'err' : 'ok', msg: f.msg.slice(0, 200) } : null; } catch { return null; }
}
const done = (req, res, to, msg, type = 'ok') => {
  if (req.wantsJson) return res.json({ ok: type !== 'err', message: msg }, type === 'err' ? 400 : 200);
  flash(req, res, type, msg); res.redirect(to);
};
const safeBack = (b, d) => (typeof b === 'string' && /^\/admin(\/[\w\-/?=&%.]*)?$/.test(b) ? b : d);

async function requireAuth(req, res, next) {
  const s = auth.getSession(req.cookies[auth.COOKIE]);
  if (!s) {
    if (req.wantsJson) return res.json({ ok: false, error: 'Сессия истекла. Войдите снова.' }, 401);
    return res.redirect('/admin/login' + (req.method === 'GET' && req.path !== '/admin' ? '?next=' + encodeURIComponent(req.path) : ''));
  }
  if (req.method === 'POST' && !auth.checkCsrf(s, req.body._csrf)) {
    if (req.wantsJson) return res.json({ ok: false, error: 'Страница устарела. Обновите её и повторите действие.' }, 403);
    flash(req, res, 'err', 'Страница устарела — обновите её и повторите действие.');
    return res.redirect('/admin');
  }
  req.session = s;
  await store.loadLeads();
  next();
}
const vctx = (req, res) => ({ user: req.session.user, csrf: req.session.csrf, flash: takeFlash(req, res), newCount: Leads.counts().new, companyName: getGroup('company').name });
const idParam = (req) => { const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? n : 0; };

/** Поле изображения: новый файл → /media/…; «убрать» → ''; иначе текстовое значение. */
async function resolveImage(req, name) {
  const up = await media.saveImage(req.files[`${name}_file`]);
  if (up.error) return { error: up.error };
  if (up.url) return { value: up.url };
  if (V.bool(req.body[`${name}_remove`])) return { value: '' };
  const p = V.imagePath(req.body[name]);
  return p.ok ? { value: p.value } : { error: 'Загрузите файл или укажите ссылку, начинающуюся с https://' };
}

function register(r) {
  // ---------- Вход ----------
  r.get('/admin/login', (req, res) => {
    if (auth.getSession(req.cookies[auth.COOKIE])) return res.redirect('/admin');
    res.html(views.login({ problem: auth.configProblem() }));
  });
  r.post('/admin/login', async (req, res) => {
    const out = await auth.login(req.body.password, req.ip);
    if (out.error) return res.html(views.login({ error: out.error, problem: auth.configProblem() }), 401);
    res.setHeader('Set-Cookie', auth.sessionCookie(out.value, req.secure));
    const next = typeof req.query.next === 'string' && /^\/admin[\w\-/]*$/.test(req.query.next) ? req.query.next : '/admin';
    res.redirect(next);
  });
  r.post('/admin/logout', requireAuth, (req, res) => { res.setHeader('Set-Cookie', auth.clearCookie(req.secure)); res.redirect('/admin/login'); });

  // ---------- Обзор ----------
  r.get('/admin', requireAuth, (req, res) => {
    const company = getGroup('company'); const site = getGroup('site');
    const checks = [
      { ok: !!company.tg_username, text: 'Указан Telegram для заявок — клиенты смогут написать вам в один клик', href: '/admin/contacts' },
      { ok: normPhone(company.phone) !== '+79000000000', text: 'Указан реальный номер телефона', href: '/admin/contacts' },
      { ok: company.email && !company.email.endsWith('@example.com'), text: 'Указан рабочий email', href: '/admin/contacts' },
      { ok: !!(company.legal_name && company.inn), text: 'Заполнены реквизиты (юрлицо, ИНН)', href: '/admin/contacts' },
      { ok: Services.list().some((s) => /^(\/media\/|https:)/.test(s.image)), text: 'Загружены реальные фото работ', href: '/admin/services' },
      { ok: !site.demo_notice, text: 'Выключена плашка демо-режима', href: '/admin/settings' },
    ];
    res.html(views.dashboard(vctx(req, res), { counts: Leads.counts(), recent: Leads.recent(6), checks }));
  });

  // ---------- Заявки ----------
  r.get('/admin/leads', requireAuth, (req, res) => {
    const q = V.str(req.query.q, 80); const status = STATUSES[req.query.status] ? req.query.status : '';
    const kind = ['order', 'callback'].includes(req.query.kind) ? req.query.kind : '';
    res.html(views.leads(vctx(req, res), { result: Leads.search({ q, status, kind, page: Number(req.query.page) || 1 }), q, status, kind, counts: Leads.counts(), back: req.url }));
  });
  r.get('/admin/leads/:id', requireAuth, (req, res) => {
    const l = Leads.get(idParam(req));
    if (!l) return res.html(views.notFound(vctx(req, res)), 404);
    res.html(views.lead(vctx(req, res), l));
  });
  r.post('/admin/leads/clear', requireAuth, (req, res) => {
    const n = Leads.clear();
    done(req, res, '/admin/leads', n ? `Удалено заявок: ${n}. Нумерация начнётся с №1` : 'Заявок и так нет');
  });
  r.post('/admin/leads/:id', requireAuth, (req, res) => {
    const l = Leads.get(idParam(req));
    if (!l) return done(req, res, '/admin/leads', 'Заявка не найдена', 'err');
    Leads.update(l.id, { status: STATUSES[req.body.status] ? req.body.status : l.status, note: V.str(req.body.note, 3000) });
    done(req, res, `/admin/leads/${l.id}`, 'Заявка сохранена');
  });
  r.post('/admin/leads/:id/status', requireAuth, (req, res) => {
    const l = Leads.get(idParam(req));
    if (!l || !STATUSES[req.body.status]) return done(req, res, '/admin/leads', 'Не удалось изменить статус', 'err');
    Leads.setStatus(l.id, req.body.status);
    done(req, res, safeBack(req.body.back, '/admin/leads'), `Заявка №${l.id}: «${STATUSES[req.body.status].label}»`);
  });
  r.post('/admin/leads/:id/delete', requireAuth, (req, res) => {
    const l = Leads.get(idParam(req));
    if (l) Leads.remove(l.id);
    done(req, res, '/admin/leads', l ? `Заявка №${l.id} удалена` : 'Заявка уже удалена');
  });

  // ---------- Услуги ----------
  r.get('/admin/services', requireAuth, (req, res) => res.html(views.services(vctx(req, res), Services.list())));
  r.get('/admin/services/new', requireAuth, (req, res) => res.html(views.serviceForm(vctx(req, res), { s: { per_area: 1, visible: 1, unit: '₽/м²', min_price: 0, image: '/static/img/living.svg' }, categories: Services.categories() })));
  r.get('/admin/services/:id', requireAuth, (req, res) => {
    const s = Services.get(idParam(req));
    if (!s) return res.html(views.notFound(vctx(req, res)), 404);
    res.html(views.serviceForm(vctx(req, res), { s, categories: Services.categories() }));
  });
  const saveService = (isNew) => async (req, res) => {
    const id = isNew ? 0 : idParam(req);
    const existing = id ? Services.get(id) : null;
    if (!isNew && !existing) return done(req, res, '/admin/services', 'Услуга не найдена', 'err');
    const { data, errors } = V.service(req.body, (slug) => Services.slugTaken(slug, id));
    const img = await resolveImage(req, 'image');
    if (img.error) errors.image = img.error; else data.image = img.value;
    if (Object.keys(errors).length) {
      return res.html(views.serviceForm(vctx(req, res), { s: { ...existing, ...req.body, ...data, id, image: img.value ?? req.body.image }, errors, categories: Services.categories() }), 422);
    }
    if (isNew) { const nid = Services.create(data); return done(req, res, `/admin/services/${nid}`, `Услуга «${data.name}» создана${data.visible ? ' и опубликована' : ' (скрыта)'}`); }
    Services.update(id, data);
    if (existing.image !== data.image) await media.cleanup(existing.image);
    done(req, res, `/admin/services/${id}`, 'Изменения сохранены — на сайте уже обновлено');
  };
  r.post('/admin/services/new', requireAuth, saveService(true));
  r.post('/admin/services/:id', requireAuth, saveService(false));
  r.post('/admin/services/:id/toggle', requireAuth, (req, res) => {
    const s = Services.get(idParam(req));
    if (!s) return done(req, res, '/admin/services', 'Услуга не найдена', 'err');
    Services.toggle(s.id, req.body.field);
    const n = Services.get(s.id);
    done(req, res, '/admin/services', req.body.field === 'visible' ? `«${s.name}» ${n.visible ? 'показана на сайте' : 'скрыта с сайта'}` : `«${s.name}» ${n.featured ? 'теперь рекомендуемая' : 'больше не рекомендуемая'}`);
  });
  r.post('/admin/services/:id/move', requireAuth, (req, res) => { Services.move(idParam(req), req.body.dir === 'up' ? 'up' : 'down'); done(req, res, '/admin/services', 'Порядок изменён'); });
  r.post('/admin/services/:id/delete', requireAuth, async (req, res) => {
    const s = Services.get(idParam(req));
    if (s) { Services.remove(s.id); await media.cleanup(s.image); }
    done(req, res, '/admin/services', s ? `Услуга «${s.name}» удалена` : 'Услуга уже удалена');
  });

  // ---------- Доп. опции ----------
  r.get('/admin/addons', requireAuth, (req, res) => res.html(views.addons(vctx(req, res), { list: Addons.list() })));
  const saveAddon = (isNew) => (req, res) => {
    const id = isNew ? 0 : idParam(req);
    if (!isNew && !Addons.get(id)) return done(req, res, '/admin/addons', 'Опция не найдена', 'err');
    const { data, errors } = V.addon(req.body);
    if (Object.keys(errors).length) return res.html(views.addons(vctx(req, res), { list: Addons.list(), errors, draft: { ...req.body, ...data, price: req.body.price }, editId: id }), 422);
    Addons.save(id, data);
    done(req, res, '/admin/addons', isNew ? `Опция «${data.name}» добавлена` : 'Опция сохранена');
  };
  r.post('/admin/addons/new', requireAuth, saveAddon(true));
  r.post('/admin/addons/:id', requireAuth, saveAddon(false));
  r.post('/admin/addons/:id/move', requireAuth, (req, res) => { Addons.move(idParam(req), req.body.dir === 'up' ? 'up' : 'down'); done(req, res, '/admin/addons', 'Порядок изменён'); });
  r.post('/admin/addons/:id/delete', requireAuth, (req, res) => { const a = Addons.get(idParam(req)); if (a) Addons.remove(a.id); done(req, res, '/admin/addons', a ? `Опция «${a.name}» удалена` : 'Уже удалено'); });

  // ---------- FAQ / преимущества / этапы / отзывы ----------
  const kindOk = (req, res) => { if (ITEM_KINDS[req.params.kind]) return true; res.html(views.notFound(vctx(req, res)), 404); return false; };
  r.get('/admin/items/:kind', requireAuth, (req, res) => { if (kindOk(req, res)) res.html(views.items(vctx(req, res), { kind: req.params.kind, list: Items.list(req.params.kind) })); });
  const saveItem = (isNew) => (req, res) => {
    if (!kindOk(req, res)) return;
    const kind = req.params.kind; const id = isNew ? 0 : idParam(req);
    const ex = id ? Items.get(id) : null;
    if (!isNew && (!ex || ex.kind !== kind)) return done(req, res, `/admin/items/${kind}`, 'Запись не найдена', 'err');
    const { data, errors } = V.item(req.body, kind);
    if (Object.keys(errors).length) return res.html(views.items(vctx(req, res), { kind, list: Items.list(kind), errors, draft: data, editId: id }), 422);
    Items.save(id, data);
    done(req, res, `/admin/items/${kind}`, isNew ? 'Добавлено' : 'Сохранено');
  };
  r.post('/admin/items/:kind/new', requireAuth, saveItem(true));
  r.post('/admin/items/:kind/:id', requireAuth, saveItem(false));
  r.post('/admin/items/:kind/:id/move', requireAuth, (req, res) => { if (!kindOk(req, res)) return; Items.move(idParam(req), req.body.dir === 'up' ? 'up' : 'down'); done(req, res, `/admin/items/${req.params.kind}`, 'Порядок изменён'); });
  r.post('/admin/items/:kind/:id/delete', requireAuth, (req, res) => {
    if (!kindOk(req, res)) return;
    const it = Items.get(idParam(req));
    if (it && it.kind === req.params.kind) Items.remove(it.id);
    done(req, res, `/admin/items/${req.params.kind}`, 'Удалено');
  });

  // ---------- Тексты и блоки ----------
  const LIMITS = { hero_eyebrow: 60, hero_title: 140, hero_text: 400, hero_points: 400, hero_cta: 40, hero_cta2: 30, hero_image_alt: 200, services_title: 100, services_text: 300, adv_title: 140, process_title: 100, faq_title: 100, calc_title: 100, calc_text: 400, submit_text: 40, reviews_title: 100, final_title: 140, final_text: 400, privacy_text: 20000 };
  const REQUIRED = ['hero_title', 'hero_cta', 'services_title', 'calc_title', 'submit_text', 'faq_title'];
  r.get('/admin/content', requireAuth, (req, res) => res.html(views.content(vctx(req, res), { c: getGroup('content'), blocks: getGroup('blocks') })));
  r.post('/admin/content', requireAuth, async (req, res) => {
    const old = getGroup('content'); const c = {}; const errors = {};
    for (const [k, max] of Object.entries(LIMITS)) c[k] = V.str(req.body[k], max);
    for (const k of REQUIRED) if (!c[k]) errors[k] = 'Поле не может быть пустым';
    const img = await resolveImage(req, 'hero_image');
    if (img.error) errors.hero_image = img.error; else c.hero_image = img.value || '/static/img/hero.svg';
    const blocks = {}; for (const k of Object.keys(getGroup('blocks'))) blocks[k] = V.bool(req.body[k]);
    if (Object.keys(errors).length) return res.html(views.content(vctx(req, res), { c: { ...old, ...c, hero_image: img.value ?? req.body.hero_image }, blocks, errors }), 422);
    setGroup('content', c); setGroup('blocks', blocks);
    if (old.hero_image !== c.hero_image) await media.cleanup(old.hero_image);
    done(req, res, '/admin/content', 'Тексты сохранены — на сайте уже обновлено');
  });

  // ---------- Контакты ----------
  r.get('/admin/contacts', requireAuth, (req, res) => res.html(views.contacts(vctx(req, res), { c: getGroup('company') })));
  r.post('/admin/contacts', requireAuth, (req, res) => {
    const { data, errors } = V.company(req.body);
    if (Object.keys(errors).length) return res.html(views.contacts(vctx(req, res), { c: { ...getGroup('company'), ...req.body }, errors }), 422);
    const old = getGroup('company');
    setGroup('company', data);
    // Новое название или город — заменяем и в заголовках, SEO и текстах сайта
    const swaps = [[old.name, data.name], [old.city_in, data.city_in], [old.city, data.city]].filter(([a, b]) => a && b && a !== b);
    if (swaps.length) {
      const fix = (v) => (typeof v === 'string' ? swaps.reduce((acc, [a, b]) => acc.split(a).join(b), v) : v);
      const co = getGroup('company');
      setGroup('company', { address: fix(co.address), areas: fix(co.areas) });
      for (const g of ['site', 'content']) {
        const cur = getGroup(g); const next = {};
        for (const [k, v] of Object.entries(cur)) next[k] = fix(v);
        setGroup(g, next);
      }
    }
    done(req, res, '/admin/contacts', swaps.length ? 'Контакты сохранены, новое название и город подставлены во все тексты сайта' : 'Контакты сохранены и обновлены на всём сайте');
  });

  // ---------- Внешний вид и SEO ----------
  r.get('/admin/settings', requireAuth, (req, res) => res.html(views.settings(vctx(req, res), { s: getGroup('site') })));
  r.post('/admin/settings', requireAuth, async (req, res) => {
    const old = getGroup('site'); const errors = {};
    const s = {
      palette: views.PALETTES.some(([k]) => k === req.body.palette) ? req.body.palette : 'pine',
      site_title: V.str(req.body.site_title, 120), site_description: V.str(req.body.site_description, 300),
      demo_notice: V.bool(req.body.demo_notice), noindex: V.bool(req.body.noindex),
    };
    if (!s.site_title) errors.site_title = 'Заголовок обязателен';
    if (!s.site_description) errors.site_description = 'Описание обязательно';
    for (const k of ['logo', 'og_image']) { const im = await resolveImage(req, k); if (im.error) errors[k] = im.error; else s[k] = im.value; }
    if (Object.keys(errors).length) return res.html(views.settings(vctx(req, res), { s: { ...old, ...s }, errors }), 422);
    setGroup('site', s);
    for (const k of ['logo', 'og_image']) if (old[k] !== s[k]) await media.cleanup(old[k]);
    done(req, res, '/admin/settings', 'Настройки сохранены');
  });
}

module.exports = { register };
