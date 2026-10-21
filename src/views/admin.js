'use strict';
/** Шаблоны админ-панели. Все формы содержат CSRF-токен; опасные действия помечены data-confirm. */
const cfg = require('../config');
const { html, raw, rub, fmt, lines, dateRu, prettyPhone, telHref } = require('../util');
const { icon } = require('../icons');
const { STATUSES, KINDS, ITEM_KINDS } = require('../models');
const { mark } = require('./layout');

const LIB_IMAGES = [
  ['/static/img/living.svg', 'Гостиная'], ['/static/img/kitchen.svg', 'Кухня'], ['/static/img/renovation.svg', 'После ремонта'],
  ['/static/img/windows.svg', 'Окна'], ['/static/img/office.svg', 'Офис'], ['/static/img/kit.svg', 'Инвентарь'], ['/static/img/hero.svg', 'Интерьер (вертикальный)'],
];
const PALETTES = [
  ['pine', 'Хвоя', ['#1E5A47', '#154536', '#E7D36B', '#F5F2EC']],
  ['lagoon', 'Лагуна', ['#1D5964', '#13434C', '#E9C46A', '#F5F2EC']],
  ['graphite', 'Графит', ['#2D3532', '#1A201E', '#D98A5F', '#F5F2EC']],
  ['terracotta', 'Терракота', ['#8A4A32', '#6C3824', '#E7C76B', '#F5F2EC']],
];

// ---------- Примитивы форм ----------
const csrf = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf}">`;
const badge = (status) => { const s = STATUSES[status] || { label: status, tone: '' }; return html`<span class="badge badge--${s.tone}">${s.label}</span>`; };

function field(name, label, o = {}) {
  const id = o.id || `f-${name}`;
  const errs = o.errors || {};
  const a = raw(`${o.required ? ' required' : ''}${errs[name] ? ' aria-invalid="true"' : ''} aria-describedby="${id}-h ${id}-e"`);
  let control;
  if (o.textarea) control = html`<textarea class="input${o.tall ? ' tall' : ''}" id="${id}" name="${name}" rows="${o.rows || 4}" maxlength="${o.max || 4000}"${a}>${o.value ?? ''}</textarea>`;
  else if (o.select) control = html`<select class="input" id="${id}" name="${name}"${a}>${o.select.map(([v, l]) => html`<option value="${v}"${String(v) === String(o.value) ? raw(' selected') : ''}>${l}</option>`)}</select>`;
  else control = html`<input class="input" id="${id}" name="${name}" type="${o.type || 'text'}" value="${o.value ?? ''}"${o.placeholder ? html` placeholder="${o.placeholder}"` : ''}${o.inputmode ? html` inputmode="${o.inputmode}"` : ''}${o.list ? html` list="${o.list}"` : ''} maxlength="${o.max || 300}"${o.autocomplete ? html` autocomplete="${o.autocomplete}"` : ''}${a}>`;
  if (o.prefix) control = html`<div class="prefix"><span>${o.prefix}</span>${control}</div>`;
  return html`<div class="field${o.cls ? ' ' + o.cls : ''}">
    <label for="${id}">${label}${o.optional ? html` <i>— необязательно</i>` : ''}</label>${control}
    ${o.hint ? html`<span class="hint" id="${id}-h">${o.hint}</span>` : ''}<span class="err" id="${id}-e">${errs[name] || ''}</span></div>`;
}
function toggle(name, label, checked, hint) {
  return html`<label class="switch"><input type="checkbox" name="${name}" value="1"${checked ? raw(' checked') : ''}><span><b>${label}</b>${hint ? html`<span>${hint}</span>` : ''}</span></label>`;
}
function imagePicker(name, label, value, o = {}) {
  const errs = o.errors || {};
  return html`<div class="field" data-imgpick>
    <span class="lbl">${label}</span>
    <div class="imgpick">
      <img class="imgpick__prev${o.logo ? ' imgpick__prev--logo' : ''}" src="${value || '/static/img/living.svg'}" alt="" data-prev${value ? '' : raw(' hidden')}>
      <div class="stack">
        <input class="file" type="file" name="${name}_file" accept="image/jpeg,image/png,image/webp" data-file>
        <span class="hint">JPG, PNG или WebP до 4 МБ. ${o.hint || 'Лучше горизонтальное фото 4:3, от 1600 px по ширине.'}</span>
        ${o.library !== false ? html`<div><span class="hint">Или выберите иллюстрацию из библиотеки сайта:</span><div class="lib">${LIB_IMAGES.map(([src, t]) => html`<button type="button" data-lib="${src}" aria-pressed="${src === value ? 'true' : 'false'}" title="${t}"><img src="${src}" alt="${t}"></button>`)}</div></div>` : ''}
        ${field(name, 'Адрес изображения', { value, hint: 'Заполняется автоматически. Можно вставить ссылку на фото, начинающуюся с https://', optional: true, errors: errs, max: 400 })}
        ${o.removable && value ? html`<label class="switch"><input type="checkbox" name="${name}_remove" value="1"><span><b>Убрать изображение</b></span></label>` : ''}
      </div>
    </div></div>`;
}

// ---------- Каркас ----------
function nav(ctx, active) {
  const L = (href, key, ic, label, extra) => html`<a class="nl" href="${href}"${active === key ? raw(' aria-current="page"') : ''}>${icon(ic, { size: 18 })}${label}${extra || ''}</a>`;
  return html`<nav aria-label="Разделы админки">
    ${L('/admin', 'dash', 'home', 'Обзор')}
    ${L('/admin/leads', 'leads', 'inbox', 'Заявки', ctx.newCount ? html`<span class="badge badge--count">${ctx.newCount}</span>` : '')}
    <div class="side__group">Каталог</div>
    ${L('/admin/services', 'services', 'grid', 'Услуги и цены')}
    ${L('/admin/addons', 'addons', 'layers', 'Доп. опции')}
    <div class="side__group">Содержимое сайта</div>
    ${L('/admin/content', 'content', 'text', 'Тексты и блоки')}
    ${L('/admin/items/faq', 'faq', 'help', 'Вопросы и ответы')}
    ${L('/admin/items/advantage', 'advantage', 'list', 'Преимущества')}
    ${L('/admin/items/step', 'step', 'list', 'Этапы работы')}
    ${L('/admin/items/review', 'review', 'chat', 'Отзывы')}
    <div class="side__group">Компания</div>
    ${L('/admin/contacts', 'contacts', 'contact', 'Контакты и соцсети')}
    ${L('/admin/settings', 'settings', 'settings', 'Внешний вид и SEO')}
  </nav>`;
}

function layout(ctx, { title, active }, body) {
  return html`<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — Админ-панель</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/css/admin.css?v=${cfg.version}">
<script src="/static/js/admin.js?v=${cfg.version}" defer></script>
</head><body>
<div class="topbar"><button type="button" aria-label="Меню" data-side-open>${icon('menu')}</button><b>${ctx.companyName}</b><a href="/" target="_blank" rel="noopener">Сайт ↗</a></div>
<div class="app">
  <aside class="side" data-side>
    <a class="brand" href="/admin">${mark}<span><b>${ctx.companyName}</b><small>Админ-панель</small></span></a>
    ${nav(ctx, active)}
    <div class="side__foot">
      <a class="nl" href="/" target="_blank" rel="noopener">${icon('external', { size: 18 })}Открыть сайт</a>
      <div class="side__user">${ctx.user.email}</div>
      <form method="post" action="/admin/logout">${csrf(ctx)}<button class="nl" type="submit">${icon('logout', { size: 18 })}Выйти</button></form>
    </div>
  </aside>
  <main class="main" id="main">${body}</main>
</div>
<div class="toasts" aria-live="polite" data-toasts>${ctx.flash ? html`<div class="toast${ctx.flash.type === 'err' ? ' toast--err' : ''}" role="status">${icon(ctx.flash.type === 'err' ? 'alert' : 'check', { size: 18 })}<span>${ctx.flash.msg}</span><button type="button" aria-label="Закрыть" data-toast-close>×</button></div>` : ''}</div>
<dialog class="confirm" data-confirm-dialog aria-labelledby="cf-t">
  <div class="confirm__b">${icon('alert', { size: 22 })}<div><h2 id="cf-t" data-cf-title>Подтвердите действие</h2><p class="muted" data-cf-text></p></div></div>
  <div class="confirm__f"><button class="btn btn--ghost" type="button" value="cancel" data-cf-cancel>Отмена</button><button class="btn btn--solid-danger" type="button" data-cf-ok>Удалить</button></div>
</dialog>
</body></html>`;
}

const ph = (title, desc, actions, back) => html`<header class="ph"><div>${back ? html`<a class="back" href="${back[0]}">← ${back[1]}</a>` : ''}<h1>${title}</h1>${desc ? html`<p>${desc}</p>` : ''}</div>${actions ? html`<div class="ph__act">${actions}</div>` : ''}</header>`;
const errorBox = (errors) => (errors && Object.keys(errors).length ? html`<div class="alert alert--err" role="alert">${icon('alert', { size: 18 })}<span>Проверьте отмеченные поля — изменения не сохранены.</span></div>` : '');

// ---------- Вход ----------
function login({ error, problem }) {
  return html`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Вход — Админ-панель</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/static/css/admin.css?v=${cfg.version}"><script src="/static/js/admin.js?v=${cfg.version}" defer></script></head>
<body><div class="auth"><div class="auth__card">
  <div class="brand">${mark}<span><b>Админ-панель</b><small>Управление сайтом</small></span></div>
  <h1>Вход</h1>
  <p class="muted">Введите пароль администратора.</p>
  ${problem ? html`<div class="alert alert--info">${icon('info', { size: 18 })}<span>${problem}</span></div>` : ''}
  <form class="form" method="post" action="/admin/login" data-busy>
    ${error && error !== problem ? html`<div class="alert alert--err" role="alert">${icon('alert', { size: 18 })}<span>${error}</span></div>` : ''}
    <input type="text" name="username" value="admin" autocomplete="username" hidden>
    ${field('password', 'Пароль', { type: 'password', required: true, autocomplete: 'current-password', max: 200 })}
    <button class="btn" type="submit">Войти</button>
  </form>
</div></div></body></html>`;
}

// ---------- Обзор ----------
function dashboard(ctx, { counts, recent, checks, tg }) {
  const body = html`
${ph(`Здравствуйте${ctx.user.name ? ', ' + ctx.user.name : ''}`, 'Сводка по заявкам и состоянию сайта.')}
<div class="stats">
  <a class="stat stat--hl" href="/admin/leads?status=new"><div class="stat__k">${icon('inbox', { size: 16 })}Новые заявки</div><div class="stat__v">${counts.new}</div></a>
  <a class="stat" href="/admin/leads?status=in_progress"><div class="stat__k">В работе</div><div class="stat__v">${counts.in_progress}</div></a>
  <div class="stat"><div class="stat__k">За 7 дней</div><div class="stat__v">${counts.week}</div></div>
  <a class="stat" href="/admin/leads"><div class="stat__k">Всего заявок</div><div class="stat__v">${counts.all}</div></a>
</div>
<div class="grid-main">
  <section class="card">
    <div class="card__h"><h2>Последние заявки</h2><a href="/admin/leads">Все заявки →</a></div>
    ${recent.length ? leadsTable(ctx, recent, { compact: true }) : html`<div class="empty">${icon('inbox', { size: 36 })}<b>Заявок пока нет</b>Заявки приходят в Telegram, а копия сохраняется здесь.</div>`}
  </section>
  <div class="cards">
    <section class="card"><div class="card__h"><h2>Быстрые действия</h2></div><div class="card__b quick">
      <a href="/admin/services/new">${icon('plus', { size: 18 })}Добавить услугу${icon('arrow', { size: 16 })}</a>
      <a href="/admin/services">${icon('grid', { size: 18 })}Изменить цены${icon('arrow', { size: 16 })}</a>
      <a href="/admin/contacts">${icon('phone', { size: 18 })}Телефон и часы работы${icon('arrow', { size: 16 })}</a>
      <a href="/admin/items/faq">${icon('help', { size: 18 })}Вопросы и ответы${icon('arrow', { size: 16 })}</a>
    </div></section>
    <section class="card"><div class="card__h"><h2>Перед запуском</h2></div><div class="card__b">
      <ul class="checklist">${checks.map((c) => html`<li>${icon(c.ok ? 'check' : 'alert', { size: 18, cls: c.ok ? 'ok' : 'todo' })}<span>${c.href && !c.ok ? html`<a href="${c.href}">${c.text}</a>` : c.text}</span></li>`)}</ul>
    </div>${tg ? html`<div class="card__f"><form method="post" action="/admin/telegram-test" data-busy>${csrf(ctx)}<button class="btn btn--ghost btn--sm" type="submit">${icon('send', { size: 15 })}Проверить Telegram</button></form></div>` : ''}</section>
  </div>
</div>`;
  return layout(ctx, { title: 'Обзор', active: 'dash' }, body);
}

// ---------- Заявки ----------
function leadsTable(ctx, rows, { compact = false, back = '' } = {}) {
  return html`<div class="tablewrap"><table class="t t--cards"><thead><tr><th>№ и дата</th><th>Клиент</th><th>Услуга</th><th class="r">Ориентир</th><th>Статус</th></tr></thead><tbody>
  ${rows.map((l) => html`<tr>
    <td><a class="rowlink" href="/admin/leads/${l.id}">№${l.id}</a><span class="sub nowrap">${dateRu(l.created_at)}</span></td>
    <td><a class="rowlink" href="/admin/leads/${l.id}">${l.name}</a><span class="sub nowrap">${prettyPhone(l.phone)}</span></td>
    <td data-l="Услуга">${l.kind === 'callback' ? html`<span class="badge badge--plain">Обратный звонок</span>` : html`${l.service_name}${l.qty ? html`<span class="sub">объём: ${l.qty}</span>` : ''}`}</td>
    <td class="r num" data-l="Ориентир">${l.estimate ? rub(l.estimate) : '—'}</td>
    <td>${compact ? badge(l.status) : html`<form class="statusform" method="post" action="/admin/leads/${l.id}/status" data-autosubmit>${csrf(ctx)}<input type="hidden" name="back" value="${back}">
      <label class="sr-only" for="st-${l.id}">Статус заявки №${l.id}</label>
      <select class="input" id="st-${l.id}" name="status">${Object.entries(STATUSES).map(([k, s]) => html`<option value="${k}"${k === l.status ? raw(' selected') : ''}>${s.label}</option>`)}</select>
      <button class="btn btn--ghost btn--sm" type="submit">OK</button></form>`}</td>
  </tr>`)}
  </tbody></table></div>`;
}

function leads(ctx, { result, q, status, kind, counts, back }) {
  const qs = (o) => { const p = new URLSearchParams({ ...(q ? { q } : {}), ...(kind ? { kind } : {}), ...o }); for (const [k, v] of [...p]) if (!v) p.delete(k); const s = p.toString(); return '/admin/leads' + (s ? '?' + s : ''); };
  const tabs = [['', 'Все', counts.all], ...Object.entries(STATUSES).map(([k, s]) => [k, s.label, counts[k]])];
  const body = html`
${ph('Заявки', 'Каждая заявка сразу уходит в Telegram, а здесь хранится копия. Меняйте статус по мере работы — новые подсвечиваются в меню.')}
<section class="card">
  <div class="filters">
    <nav class="tabs" aria-label="Фильтр по статусу">${tabs.map(([k, l, n]) => html`<a href="${qs({ status: k, page: '' })}" aria-current="${status === k ? 'true' : 'false'}">${l}<span>${n || 0}</span></a>`)}</nav>
    <form class="search" method="get" action="/admin/leads" role="search">
      ${status ? html`<input type="hidden" name="status" value="${status}">` : ''}
      <select class="input" name="kind" aria-label="Тип заявки"><option value="">Все типы</option>${Object.entries(KINDS).map(([k, l]) => html`<option value="${k}"${k === kind ? raw(' selected') : ''}>${l}</option>`)}</select>
      <label class="sr-only" for="q">Поиск</label><input class="input" id="q" type="search" name="q" value="${q}" placeholder="Имя, телефон, адрес…">
      <button class="btn btn--ghost" type="submit">${icon('search', { size: 16 })}<span class="sr-only">Найти</span></button>
    </form>
  </div>
  ${result.rows.length ? leadsTable(ctx, result.rows, { back }) : html`<div class="empty">${icon('inbox', { size: 36 })}<b>${q || status || kind ? 'Ничего не найдено' : 'Заявок пока нет'}</b>${q || status || kind ? html`Попробуйте изменить фильтр. <a href="/admin/leads">Сбросить</a>` : 'Заявки с сайта будут появляться здесь.'}</div>`}
  ${result.pages > 1 ? html`<div class="pager"><span>Стр. ${result.page} из ${result.pages} · всего ${result.total}</span><div>
    ${result.page > 1 ? html`<a class="btn btn--ghost btn--sm" href="${qs({ status, page: result.page - 1 })}">← Назад</a>` : ''}
    ${result.page < result.pages ? html`<a class="btn btn--ghost btn--sm" href="${qs({ status, page: result.page + 1 })}">Дальше →</a>` : ''}</div></div>` : ''}
</section>`;
  return layout(ctx, { title: 'Заявки', active: 'leads' }, body);
}

function lead(ctx, l) {
  let addons = []; try { addons = JSON.parse(l.addons || '[]'); } catch { addons = []; }
  const base = l.estimate ? l.estimate - addons.reduce((s, a) => s + a.price, 0) : 0;
  const body = html`
${ph(`Заявка №${l.id}`, html`${KINDS[l.kind] || ''} · ${dateRu(l.created_at)}`, html`
  <a class="btn" href="${telHref(l.phone)}">${icon('phone', { size: 16 })}Позвонить</a>
  ${l.email ? html`<a class="btn btn--ghost" href="mailto:${l.email}">${icon('mail', { size: 16 })}Написать</a>` : ''}`, ['/admin/leads', 'Все заявки'])}
<div class="grid-main">
  <section class="card"><div class="card__h"><h2>Клиент и заказ</h2>${badge(l.status)}</div><div class="card__b">
    <dl class="dl">
      <dt>Имя</dt><dd class="big">${l.name}</dd>
      <dt>Телефон</dt><dd><a href="${telHref(l.phone)}" class="nowrap">${prettyPhone(l.phone)}</a></dd>
      <dt>Email</dt><dd>${l.email ? html`<a href="mailto:${l.email}">${l.email}</a>` : '—'}</dd>
      ${l.kind === 'order' ? html`<dt>Услуга</dt><dd>${l.service_name || '—'}${l.qty ? html` · ${l.qty}` : ''}</dd>` : ''}
      <dt>Адрес</dt><dd>${l.address || '—'}</dd>
      <dt>Желаемая дата</dt><dd>${l.preferred_date ? dateRu(l.preferred_date, false) : '—'}</dd>
      ${l.contact_time ? html`<dt>Удобно звонить</dt><dd>${l.contact_time}</dd>` : ''}
      <dt>Комментарий</dt><dd>${l.comment ? html`<span class="pre">${l.comment}</span>` : '—'}</dd>
    </dl>
    ${l.estimate ? html`<h3 class="small muted" id="est">Расчёт с сайта на момент заявки</h3><ul class="breakdown" aria-labelledby="est">
      <li><span>${l.service_name}${l.qty ? `, ${l.qty}` : ''}</span><span class="num">${rub(base)}</span></li>
      ${addons.map((a) => html`<li><span>${a.name}</span><span class="num">+ ${rub(a.price)}</span></li>`)}
      <li class="total"><span>Ориентир</span><span class="num">${rub(l.estimate)}</span></li></ul>` : ''}
  </div></section>
  <div class="cards">
    <section class="card"><form method="post" action="/admin/leads/${l.id}" data-busy>${csrf(ctx)}
      <div class="card__h"><h2>Обработка</h2></div>
      <div class="card__b form">
        ${field('status', 'Статус', { select: Object.entries(STATUSES).map(([k, s]) => [k, s.label]), value: l.status })}
        ${field('note', 'Заметка менеджера', { textarea: true, value: l.note, rows: 5, optional: true, hint: 'Видна только в админке: договорённости, итоговая цена, время визита.', max: 3000 })}
      </div>
      <div class="card__f"><button class="btn" type="submit">Сохранить</button></div>
    </form></section>
    <section class="card"><div class="card__b">
      <form method="post" action="/admin/leads/${l.id}/delete" data-confirm="Заявка №${l.id} от ${l.name} будет удалена без возможности восстановления.">${csrf(ctx)}
        <button class="btn btn--danger" type="submit">${icon('trash', { size: 16 })}Удалить заявку</button></form>
      <p class="hint">Удаляйте заявки по просьбе клиента или если это спам. Изменено: ${dateRu(l.updated_at)}</p>
    </div></section>
  </div>
</div>`;
  return layout(ctx, { title: `Заявка №${l.id}`, active: 'leads' }, body);
}

// ---------- Услуги ----------
function services(ctx, list) {
  const body = html`
${ph('Услуги и цены', 'Порядок здесь = порядок на сайте. «Рекомендуемые» показываются крупно на главной, остальные — списком.', html`<a class="btn" href="/admin/services/new">${icon('plus', { size: 16 })}Добавить услугу</a>`)}
<section class="card">
  ${list.length ? html`<div class="tablewrap"><table class="t t--cards"><thead><tr><th></th><th>Услуга</th><th class="r">Цена</th><th>На сайте</th><th>Рекомендуемая</th><th class="r">Действия</th></tr></thead><tbody>
  ${list.map((s, i) => html`<tr class="${s.visible ? '' : 'is-hidden'}">
    <td class="hide-m"><img class="thumb" src="${s.image || '/static/img/living.svg'}" alt="" loading="lazy"></td>
    <td><a class="rowlink" href="/admin/services/${s.id}">${s.name}</a><span class="sub">${s.category || 'Без категории'}${s.duration ? ' · ' + s.duration : ''}</span></td>
    <td class="r num nowrap" data-l="Цена">от ${fmt(s.price)} ${s.unit}<span class="sub">мин. ${rub(s.min_price)}</span></td>
    <td data-l="На сайте"><form method="post" action="/admin/services/${s.id}/toggle" class="inl">${csrf(ctx)}<input type="hidden" name="field" value="visible"><button class="btn btn--ghost btn--sm" type="submit" aria-label="${s.visible ? 'Скрыть с сайта' : 'Показать на сайте'}: ${s.name}">${icon(s.visible ? 'eye' : 'eyeOff', { size: 15 })}${s.visible ? 'Показана' : 'Скрыта'}</button></form></td>
    <td data-l="Главная"><form method="post" action="/admin/services/${s.id}/toggle" class="inl">${csrf(ctx)}<input type="hidden" name="field" value="featured"><button class="btn btn--ghost btn--sm" type="submit" aria-label="Рекомендуемая: ${s.name}">${icon('pinned', { size: 15 })}${s.featured ? 'Да' : 'Нет'}</button></form></td>
    <td class="r"><span class="iconbtns">
      <form method="post" action="/admin/services/${s.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="up"><button class="btn btn--ghost btn--icon" type="submit" aria-label="Выше: ${s.name}"${i === 0 ? raw(' disabled') : ''}>${icon('up', { size: 16 })}</button></form>
      <form method="post" action="/admin/services/${s.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="down"><button class="btn btn--ghost btn--icon" type="submit" aria-label="Ниже: ${s.name}"${i === list.length - 1 ? raw(' disabled') : ''}>${icon('down', { size: 16 })}</button></form>
      <a class="btn btn--ghost btn--icon" href="/admin/services/${s.id}" aria-label="Изменить: ${s.name}">${icon('edit', { size: 16 })}</a>
      <form method="post" action="/admin/services/${s.id}/delete" data-confirm="Услуга «${s.name}» будет удалена с сайта. Старые заявки сохранятся.">${csrf(ctx)}<button class="btn btn--danger btn--icon" type="submit" aria-label="Удалить: ${s.name}">${icon('trash', { size: 16 })}</button></form>
    </span></td>
  </tr>`)}</tbody></table></div>` : html`<div class="empty">${icon('grid', { size: 36 })}<b>Услуг пока нет</b>Добавьте первую услугу — она сразу появится на сайте и в калькуляторе.<br><a class="btn" href="/admin/services/new">Добавить услугу</a></div>`}
</section>`;
  return layout(ctx, { title: 'Услуги', active: 'services' }, body);
}

function serviceForm(ctx, { s, errors = {}, categories = [] }) {
  const isNew = !s.id;
  const v = (k, d = '') => (s[k] ?? d);
  const body = html`
${ph(isNew ? 'Новая услуга' : s.name, isNew ? 'После сохранения услуга появится на сайте, в прайс-листе и в калькуляторе.' : html`Страница на сайте: <a href="/uslugi/${s.slug}" target="_blank" rel="noopener">/uslugi/${s.slug}</a>`, null, ['/admin/services', 'Все услуги'])}
<form class="form" method="post" action="${isNew ? '/admin/services/new' : `/admin/services/${s.id}`}" enctype="multipart/form-data" novalidate data-busy>
  ${csrf(ctx)}
  ${errorBox(errors)}
  <div class="grid-main">
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Описание</h2></div><div class="card__b form">
        <div class="row2">
          ${field('name', 'Название', { value: v('name'), required: true, errors, max: 120 })}
          ${field('category', 'Категория', { value: v('category'), errors, list: 'cats', hint: 'Группирует услуги в прайс-листе. Например: «Квартиры и дома».', max: 60 })}
        </div>
        <datalist id="cats">${categories.map((c) => html`<option value="${c}">`)}</datalist>
        ${field('summary', 'Кратко', { value: v('summary'), textarea: true, rows: 2, errors, max: 300, hint: 'Одно-два предложения для карточки и калькулятора (до 300 знаков).' })}
        ${field('description', 'Подробное описание', { value: v('description'), textarea: true, rows: 6, errors, optional: true, hint: 'Показывается на странице услуги. Пустая строка — новый абзац.' })}
        ${field('includes', 'Что входит', { value: v('includes'), textarea: true, tall: true, errors, optional: true, hint: 'Каждый пункт — с новой строки. Первые четыре пункта показываются на главной.' })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Изображение</h2></div><div class="card__b">${imagePicker('image', 'Фото или иллюстрация', v('image'), { errors })}</div></section>
    </div>
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Цена</h2></div><div class="card__b form">
        <fieldset class="fs field"><legend class="lbl">Как считать</legend>
          <div class="seg">
            <label><input type="radio" name="per_area" value="1"${v('per_area', 1) ? raw(' checked') : ''}>За м²</label>
            <label><input type="radio" name="per_area" value="0"${!v('per_area', 1) ? raw(' checked') : ''}>За штуку</label>
          </div>
          <span class="hint">«За штуку» — для окон, предметов мебели и т. п. Калькулятор спросит количество вместо площади.</span>
        </fieldset>
        <div class="row2">
          ${field('price', 'Цена', { value: v('price'), required: true, errors, inputmode: 'numeric', prefix: '₽', max: 9 })}
          ${field('unit', 'Подпись единицы', { value: v('unit', '₽/м²'), errors, max: 30, hint: 'Например: ₽/м², ₽/створка' })}
        </div>
        ${field('min_price', 'Минимальная стоимость заказа', { value: v('min_price', 0), errors, inputmode: 'numeric', prefix: '₽', max: 9, hint: 'Если расчёт по площади меньше — клиент увидит минимальную сумму. 0 — без минимума.' })}
        ${field('duration', 'Длительность', { value: v('duration'), errors, optional: true, placeholder: '2–4 часа', max: 60 })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Публикация</h2></div><div class="card__b">
        ${toggle('visible', 'Показывать на сайте', v('visible', 1), 'Скрытая услуга не видна посетителям и в калькуляторе.')}
        ${toggle('featured', 'Рекомендуемая', v('featured', 0), 'Крупный блок с фото на главной странице.')}
        ${field('slug', 'Адрес страницы', { value: v('slug'), errors, prefix: '/uslugi/', optional: true, hint: 'Латиница и дефисы. Если оставить пустым — сформируется из названия.', max: 80 })}
      </div>
      <div class="card__f"><a class="btn btn--ghost" href="/admin/services">Отмена</a><button class="btn" type="submit">${isNew ? 'Создать услугу' : 'Сохранить'}</button></div></section>
    </div>
  </div>
</form>`;
  return layout(ctx, { title: isNew ? 'Новая услуга' : s.name, active: 'services' }, body);
}

// ---------- Доп. опции ----------
function addons(ctx, { list, errors = {}, draft = {}, editId = 0 }) {
  const form = (a, id) => html`<form class="form" method="post" action="${id ? `/admin/addons/${id}` : '/admin/addons/new'}" novalidate data-busy>${csrf(ctx)}
    <div class="row3">
      ${field('name', 'Название', { id: `a${id}-name`, value: a.name, required: true, errors: id === editId ? errors : {}, max: 100 })}
      ${field('price', 'Цена', { id: `a${id}-price`, value: a.price, prefix: '₽', inputmode: 'numeric', required: true, errors: id === editId ? errors : {}, max: 9 })}
      ${field('note', 'Пояснение', { id: `a${id}-note`, value: a.note, optional: true, max: 200 })}
    </div>
    ${toggle('visible', 'Показывать в калькуляторе', a.visible ?? 1)}
    <div><button class="btn btn--sm" type="submit">${id ? 'Сохранить' : 'Добавить опцию'}</button></div></form>`;
  const body = html`
${ph('Дополнительные опции', 'Работы, которые клиент может добавить к любой уборке в калькуляторе: духовка, холодильник, балкон и т. п.')}
<div class="cards">
  <section class="card"><div class="card__h"><h2>Опции (${list.length})</h2></div>
  ${list.length ? html`<ul class="ilist">${list.map((a, i) => html`<li class="${a.visible ? '' : 'is-hidden'}">
    <div><b>${a.name} · <span class="num">${rub(a.price)}</span>${a.visible ? '' : html` <span class="badge badge--cancel">скрыта</span>`}</b>${a.note ? html`<p>${a.note}</p>` : ''}</div>
    <span class="iconbtns">
      <form method="post" action="/admin/addons/${a.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="up"><button class="btn btn--ghost btn--icon" aria-label="Выше"${i === 0 ? raw(' disabled') : ''}>${icon('up', { size: 16 })}</button></form>
      <form method="post" action="/admin/addons/${a.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="down"><button class="btn btn--ghost btn--icon" aria-label="Ниже"${i === list.length - 1 ? raw(' disabled') : ''}>${icon('down', { size: 16 })}</button></form>
      <form method="post" action="/admin/addons/${a.id}/delete" data-confirm="Опция «${a.name}» будет удалена из калькулятора.">${csrf(ctx)}<button class="btn btn--danger btn--icon" aria-label="Удалить: ${a.name}">${icon('trash', { size: 16 })}</button></form>
    </span>
    <details class="edit"${editId === a.id ? raw(' open') : ''}><summary class="btn btn--ghost btn--sm">${icon('edit', { size: 14 })}Изменить</summary><div class="editbox">${form(editId === a.id ? { ...a, ...draft } : a, a.id)}</div></details>
  </li>`)}</ul>` : html`<div class="empty">${icon('layers', { size: 36 })}<b>Опций нет</b>Без опций шаг «Дополнительно» в калькуляторе не показывается.</div>`}
  </section>
  <section class="card"><div class="card__h"><h2>Новая опция</h2></div><div class="card__b">${form(editId === 0 ? draft : {}, 0)}</div></section>
</div>`;
  return layout(ctx, { title: 'Доп. опции', active: 'addons' }, body);
}

// ---------- Элементы: FAQ, преимущества, этапы, отзывы ----------
const ITEM_HINTS = {
  faq: 'Ответы на вопросы, которые клиенты задают по телефону. Первый вопрос раскрыт по умолчанию.',
  advantage: 'Нумерованный список условий работы на главной. Оптимально — 3–5 пунктов.',
  step: 'Шаги от заявки до оплаты в тёмном блоке «Как это работает». Оптимально — 4 шага.',
  review: 'Публикуйте только настоящие отзывы клиентов и с их согласия. Блок не показывается, пока здесь нет видимых отзывов.',
};
function items(ctx, { kind, list, errors = {}, draft = {}, editId = 0 }) {
  const K = ITEM_KINDS[kind];
  const isReview = kind === 'review';
  const labels = { faq: ['Вопрос', 'Ответ'], review: ['Заголовок для админки', 'Текст отзыва'], advantage: ['Заголовок', 'Описание'], step: ['Название шага', 'Описание'] }[kind];
  const form = (it, id) => html`<form class="form" method="post" action="${id ? `/admin/items/${kind}/${id}` : `/admin/items/${kind}/new`}" novalidate data-busy>${csrf(ctx)}
    ${field('title', labels[0], { id: `i${id}-t`, value: it.title, required: true, errors: id === editId ? errors : {}, max: 200, hint: isReview ? 'Например: «Генеральная уборка, март»' : '' })}
    ${field('body', labels[1], { id: `i${id}-b`, value: it.body, textarea: true, rows: 4, required: true, errors: id === editId ? errors : {}, max: 3000, hint: kind === 'faq' ? 'Пустая строка — новый абзац.' : '' })}
    ${isReview ? html`<div class="row2">${field('author', 'Имя клиента', { id: `i${id}-a`, value: it.author, max: 80, hint: 'Как разрешил подписать клиент: «Анна», «Игорь К.»' })}${field('meta', 'Подпись', { id: `i${id}-m`, value: it.meta, optional: true, max: 80, hint: 'Например: «Уборка после ремонта, 2-комн. квартира»' })}</div>` : ''}
    ${toggle('visible', 'Показывать на сайте', it.visible ?? 1)}
    <div><button class="btn btn--sm" type="submit">${id ? 'Сохранить' : 'Добавить'}</button></div></form>`;
  const body = html`
${ph(K.label, ITEM_HINTS[kind])}
<div class="stack">
${isReview ? html`<div class="alert alert--warn">${icon('info', { size: 18 })}<span>Придуманные отзывы вводят клиентов в заблуждение и нарушают закон о рекламе. Добавляйте только реальные отзывы.</span></div>` : ''}
<div class="cards">
  <section class="card"><div class="card__h"><h2>${K.label} (${list.length})</h2></div>
  ${list.length ? html`<ul class="ilist">${list.map((it, i) => html`<li class="${it.visible ? '' : 'is-hidden'}">
    <div><b>${it.title}${it.visible ? '' : html` <span class="badge badge--cancel">скрыт</span>`}</b><p>${it.body}</p></div>
    <span class="iconbtns">
      <form method="post" action="/admin/items/${kind}/${it.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="up"><button class="btn btn--ghost btn--icon" aria-label="Выше"${i === 0 ? raw(' disabled') : ''}>${icon('up', { size: 16 })}</button></form>
      <form method="post" action="/admin/items/${kind}/${it.id}/move">${csrf(ctx)}<input type="hidden" name="dir" value="down"><button class="btn btn--ghost btn--icon" aria-label="Ниже"${i === list.length - 1 ? raw(' disabled') : ''}>${icon('down', { size: 16 })}</button></form>
      <form method="post" action="/admin/items/${kind}/${it.id}/delete" data-confirm="«${it.title}» будет удалён с сайта.">${csrf(ctx)}<button class="btn btn--danger btn--icon" aria-label="Удалить">${icon('trash', { size: 16 })}</button></form>
    </span>
    <details class="edit"${editId === it.id ? raw(' open') : ''}><summary class="btn btn--ghost btn--sm">${icon('edit', { size: 14 })}Изменить</summary><div class="editbox">${form(editId === it.id ? { ...it, ...draft } : it, it.id)}</div></details>
  </li>`)}</ul>` : html`<div class="empty">${icon(isReview ? 'chat' : 'help', { size: 36 })}<b>Пока пусто</b>${isReview ? 'Когда появятся отзывы клиентов, добавьте их ниже.' : 'Добавьте первый элемент ниже.'}</div>`}
  </section>
  <section class="card"><div class="card__h"><h2>Добавить ${K.single}</h2></div><div class="card__b">${form(editId === 0 ? draft : {}, 0)}</div></section>
</div></div>`;
  return layout(ctx, { title: K.label, active: kind }, body);
}

// ---------- Тексты и блоки ----------
function content(ctx, { c, blocks, errors = {} }) {
  const f = (k, label, o = {}) => field(k, label, { value: c[k], errors, ...o });
  const body = html`
${ph('Тексты и блоки', 'Заголовки и подписи на главной странице. Изменения видны на сайте сразу после сохранения.', html`<a class="btn btn--ghost" href="/" target="_blank" rel="noopener">${icon('external', { size: 16 })}Открыть главную</a>`)}
<form class="form" method="post" action="/admin/content" enctype="multipart/form-data" novalidate data-busy>${csrf(ctx)}
  ${errorBox(errors)}
  <div class="grid-main">
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Первый экран</h2></div><div class="card__b form">
        ${f('hero_eyebrow', 'Надзаголовок', { max: 60 })}
        ${f('hero_title', 'Главный заголовок', { textarea: true, rows: 2, max: 140, hint: 'Самая заметная фраза сайта: что вы делаете и чем это выгодно. До 140 знаков.' })}
        ${f('hero_text', 'Подзаголовок', { textarea: true, rows: 3, max: 400 })}
        ${f('hero_points', 'Ключевые условия', { textarea: true, rows: 3, max: 400, hint: 'Каждый пункт с новой строки, 2–4 пункта. Показываются с галочками.' })}
        <div class="row2">${f('hero_cta', 'Текст основной кнопки', { max: 40, hint: 'Ведёт на калькулятор. Используется и в шапке.' })}${f('hero_cta2', 'Текст кнопки звонка', { max: 30 })}</div>
        ${imagePicker('hero_image', 'Изображение первого экрана', c.hero_image, { errors, hint: 'Лучше вертикальное фото 4:5, от 1200 px по ширине.' })}
        ${f('hero_image_alt', 'Описание изображения', { max: 200, hint: 'Для незрячих посетителей и поисковиков: что изображено.' })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Заголовки разделов</h2></div><div class="card__b form">
        <div class="row2">${f('services_title', 'Услуги — заголовок', { max: 100 })}${f('adv_title', 'Преимущества — заголовок', { max: 140 })}</div>
        ${f('services_text', 'Услуги — подпись', { textarea: true, rows: 2, max: 300 })}
        <div class="row2">${f('process_title', 'Этапы — заголовок', { max: 100 })}${f('faq_title', 'Вопросы — заголовок', { max: 100 })}</div>
        <div class="row2">${f('calc_title', 'Калькулятор — заголовок', { max: 100 })}${f('submit_text', 'Кнопка отправки заявки', { max: 40 })}</div>
        ${f('calc_text', 'Калькулятор — подпись', { textarea: true, rows: 2, max: 400 })}
        ${f('reviews_title', 'Отзывы — заголовок', { max: 100 })}
        ${f('final_title', 'Финальный призыв — заголовок', { max: 140 })}
        ${f('final_text', 'Финальный призыв — текст', { textarea: true, rows: 2, max: 400, optional: true })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Политика конфиденциальности</h2></div><div class="card__b">
        ${f('privacy_text', 'Текст страницы /politika', { textarea: true, tall: true, max: 20000, hint: '{name} и {email} подставятся из контактов. Перед запуском согласуйте текст с юристом.' })}
      </div></section>
    </div>
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Блоки главной</h2></div><div class="card__b">
        ${toggle('show_featured', 'Услуги и цены', blocks.show_featured)}
        ${toggle('show_advantages', 'Условия работы', blocks.show_advantages)}
        ${toggle('show_process', 'Как это работает', blocks.show_process)}
        ${toggle('show_reviews', 'Отзывы', blocks.show_reviews, 'Показывается, только если есть видимые отзывы.')}
        ${toggle('show_faq', 'Частые вопросы', blocks.show_faq)}
        ${toggle('show_areas', 'Контакты и районы', blocks.show_areas)}
        <p class="hint">Калькулятор и первый экран отключить нельзя — это основные инструменты для заявок.</p>
      </div><div class="card__f"><button class="btn" type="submit">Сохранить всё</button></div></section>
    </div>
  </div>
</form>`;
  return layout(ctx, { title: 'Тексты и блоки', active: 'content' }, body);
}

// ---------- Контакты ----------
function contacts(ctx, { c, errors = {} }) {
  const f = (k, label, o = {}) => field(k, label, { value: c[k], errors, ...o });
  const body = html`
${ph('Контакты и соцсети', 'Телефон, почта и часы работы обновятся во всех местах сайта: в шапке, подвале, кнопках звонка и на странице контактов.')}
<form class="form" method="post" action="/admin/contacts" novalidate data-busy>${csrf(ctx)}
  ${errorBox(errors)}
  <div class="grid2">
    <section class="card"><div class="card__h"><h2>Связь</h2></div><div class="card__b form">
      ${f('name', 'Название компании', { required: true, max: 80 })}
      <div class="row2">${f('city', 'Город', { required: true, max: 60 })}${f('city_in', 'Город в предложном падеже', { max: 60, hint: '«в Зеркальном» — для заголовков и SEO' })}</div>
      ${f('phone', 'Телефон', { type: 'tel', required: true, max: 40, hint: 'Номер для кнопок «Позвонить». Формат: +7 900 000-00-00' })}
      ${f('email', 'Email', { type: 'email', optional: true, max: 120 })}
      ${f('hours', 'Часы работы', { textarea: true, rows: 3, max: 300, hint: 'Каждая строка — отдельно. Первая строка показывается в шапке.' })}
      ${f('address', 'Адрес офиса', { optional: true, max: 200 })}
    </div></section>
    <div class="cards">
      <section class="card"><div class="card__h"><h2>География</h2></div><div class="card__b form">
        ${f('areas', 'Районы обслуживания', { textarea: true, rows: 6, max: 1500, hint: 'Каждый район с новой строки.' })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Мессенджеры и соцсети</h2></div><div class="card__b form">
        ${f('telegram', 'Telegram', { optional: true, placeholder: 'https://t.me/username', max: 300 })}
        ${f('whatsapp', 'WhatsApp', { optional: true, placeholder: 'https://wa.me/79000000000', max: 300 })}
        ${f('vk', 'ВКонтакте', { optional: true, placeholder: 'https://vk.com/…', max: 300 })}
        <p class="hint">Пустые ссылки на сайте не показываются.</p>
      </div></section>
      <section class="card"><div class="card__h"><h2>Реквизиты</h2></div><div class="card__b form">
        ${f('legal_name', 'Юридическое название', { optional: true, max: 160, placeholder: 'ИП Иванов И. И. / ООО «…»' })}
        <div class="row2">${f('inn', 'ИНН', { optional: true, inputmode: 'numeric', max: 12 })}${f('ogrn', 'ОГРН / ОГРНИП', { optional: true, inputmode: 'numeric', max: 15 })}</div>
        <p class="hint">Показываются в подвале и на странице контактов.</p>
      </div><div class="card__f"><button class="btn" type="submit">Сохранить контакты</button></div></section>
    </div>
  </div>
</form>`;
  return layout(ctx, { title: 'Контакты', active: 'contacts' }, body);
}

// ---------- Внешний вид и SEO ----------
function settings(ctx, { s, errors = {} }) {
  const body = html`
${ph('Внешний вид и SEO', 'Цветовая схема, логотип и то, как сайт выглядит в поиске и при отправке ссылки в мессенджере.')}
<form class="form" method="post" action="/admin/settings" enctype="multipart/form-data" novalidate data-busy>${csrf(ctx)}
  ${errorBox(errors)}
  <div class="grid-main">
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Цветовая схема</h2></div><div class="card__b">
        <fieldset class="fs"><legend class="sr-only">Палитра</legend><div class="palettes">
          ${PALETTES.map(([k, l, c]) => html`<label class="pal pal--${k}"><input type="radio" name="palette" value="${k}"${s.palette === k ? raw(' checked') : ''}><span class="pal__sw"><i></i><i></i><i></i><i></i></span><b>${l}</b></label>`)}
        </div></fieldset>
        <p class="hint">Палитры подобраны с проверенным контрастом текста. Фон и типографика остаются фирменными.</p>
      </div></section>
      <section class="card"><div class="card__h"><h2>Логотип</h2></div><div class="card__b">
        ${imagePicker('logo', 'Файл логотипа', s.logo, { errors, logo: true, library: false, removable: true, hint: 'PNG с прозрачным фоном, высота от 88 px. Если не загружен — показывается фирменный знак и название.' })}
      </div></section>
      <section class="card"><div class="card__h"><h2>Поисковики и соцсети</h2></div><div class="card__b form">
        ${field('site_title', 'Заголовок главной страницы (title)', { value: s.site_title, errors, max: 120, hint: 'До 60–70 знаков: компания, услуга, город.' })}
        ${field('site_description', 'Описание (meta description)', { value: s.site_description, errors, textarea: true, rows: 3, max: 300, hint: 'До 160 знаков. Показывается в результатах поиска под заголовком.' })}
        ${imagePicker('og_image', 'Картинка для превью ссылки', s.og_image, { errors, library: false, removable: true, hint: 'Размер 1200×630, JPG или PNG. Мессенджеры не показывают SVG, поэтому загрузите фото.' })}
        ${toggle('noindex', 'Скрыть сайт от поисковиков', s.noindex, 'Включите на время наполнения: robots.txt закроет сайт от индексации.')}
      </div></section>
    </div>
    <div class="cards">
      <section class="card"><div class="card__h"><h2>Режим демонстрации</h2></div><div class="card__b">
        ${toggle('demo_notice', 'Плашка «Демонстрационный сайт»', s.demo_notice, 'Тонкая полоса сверху: цены и контакты — примеры. Выключите, когда заполните реальные данные.')}
        <p class="hint">В демо-режиме сайт не отдаёт поисковикам структурированные данные о компании.</p>
      </div><div class="card__f"><button class="btn" type="submit">Сохранить настройки</button></div></section>
    </div>
  </div>
</form>`;
  return layout(ctx, { title: 'Внешний вид и SEO', active: 'settings' }, body);
}

// ---------- Доступ ----------
function account(ctx, { users, errors = {}, draft = {} }) {
  const body = html`
${ph('Доступ к админ-панели', 'Смена пароля и управление учётными записями сотрудников.')}
<div class="grid2">
  <section class="card"><form class="form" method="post" action="/admin/account/password" novalidate data-busy>${csrf(ctx)}
    <div class="card__h"><h2>Сменить пароль</h2></div>
    <div class="card__b form">
      ${errors._pw ? html`<div class="alert alert--err">${errors._pw}</div>` : ''}
      ${field('current', 'Текущий пароль', { type: 'password', required: true, autocomplete: 'current-password', errors, max: 200 })}
      ${field('password', 'Новый пароль', { type: 'password', required: true, autocomplete: 'new-password', errors, max: 200, hint: 'Не короче 10 символов, буквы и цифры. После смены другие устройства выйдут из админки.' })}
      ${field('password2', 'Повторите новый пароль', { type: 'password', required: true, autocomplete: 'new-password', errors, max: 200 })}
    </div>
    <div class="card__f"><button class="btn" type="submit">Сменить пароль</button></div></form></section>
  <div class="cards">
    <section class="card"><div class="card__h"><h2>Администраторы</h2></div>
      <ul class="ilist">${users.map((u) => html`<li><div><b>${u.name || u.email}${u.id === ctx.user.id ? html` <span class="badge badge--done">это вы</span>` : ''}</b><p>${u.email} · вход: ${u.last_login ? dateRu(u.last_login) : 'ещё не входил'}</p></div>
        ${u.id !== ctx.user.id ? html`<form method="post" action="/admin/account/users/${u.id}/delete" data-confirm="Сотрудник ${u.email} потеряет доступ к админ-панели.">${csrf(ctx)}<button class="btn btn--danger btn--sm">Отключить</button></form>` : html`<span></span>`}</li>`)}</ul>
    </section>
    <section class="card"><form class="form" method="post" action="/admin/account/users" novalidate data-busy>${csrf(ctx)}
      <div class="card__h"><h2>Добавить сотрудника</h2></div>
      <div class="card__b form">
        ${field('u_email', 'Email', { type: 'email', value: draft.u_email, required: true, errors, autocomplete: 'off', max: 120 })}
        ${field('u_name', 'Имя', { value: draft.u_name, optional: true, errors, max: 80 })}
        ${field('u_password', 'Временный пароль', { type: 'password', required: true, autocomplete: 'new-password', errors, max: 200, hint: 'Передайте сотруднику лично и попросите сменить после входа.' })}
      </div>
      <div class="card__f"><button class="btn" type="submit">Добавить</button></div></form></section>
  </div>
</div>`;
  return layout(ctx, { title: 'Доступ', active: 'account' }, body);
}

function notFound(ctx) {
  return layout(ctx, { title: 'Не найдено' }, html`${ph('Не найдено', 'Запись удалена или адрес неверный.')}<a class="btn btn--ghost" href="/admin">На главную админки</a>`);
}

module.exports = { login, dashboard, leads, lead, services, serviceForm, addons, items, content, contacts, settings, account, notFound, PALETTES, LIB_IMAGES };
