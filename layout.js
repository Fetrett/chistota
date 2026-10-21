'use strict';
/** Общий каркас публичных страниц: <head>, шапка, мобильное меню, подвал. */
const cfg = require('../config');
const { html, raw, lines, telHref, normPhone, prettyPhone, tgBase } = require('../util');
const { icon } = require('../icons');

const NAV = [
  { href: '/uslugi', label: 'Услуги' },
  { href: '/ceny', label: 'Цены' },
  { href: '/#process', label: 'Как работаем' },
  { href: '/#faq', label: 'Вопросы' },
  { href: '/kontakty', label: 'Контакты' },
];

// Знак: кольцо и четырёхлучевой «блик» — тот же мотив, что в иллюстрациях
const mark = raw(`<svg class="logo__mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M20 8c.6 7.4 4.6 11.4 12 12-7.4.6-11.4 4.6-12 12-.6-7.4-4.6-11.4-12-12 7.4-.6 11.4-4.6 12-12z" fill="currentColor"/></svg>`);

function logo(ctx, { asLink = true } = {}) {
  const c = ctx.company; const s = ctx.site;
  const inner = s.logo
    ? html`<img class="logo__img" src="${s.logo}" alt="${c.name}" width="160" height="44">`
    : html`${mark}<span class="logo__name">${c.name}<small>Клининг · ${ctx.city}</small></span>`;
  return asLink ? html`<a class="logo" href="/" aria-label="${c.name} — на главную">${inner}</a>` : inner;
}

const phoneText = (p) => prettyPhone(normPhone(p)) || p;
const isCurrent = (ctx, href) => (href === '/' ? ctx.path === '/' : !href.includes('#') && (ctx.path === href || ctx.path.startsWith(href + '/')));

function absUrl(ctx, p) { return (cfg.siteUrl || ctx.origin) + p; }

function head(ctx, page) {
  const s = ctx.site;
  const title = page.title ? `${page.title} — ${ctx.company.name}` : s.site_title;
  const desc = page.description || s.site_description;
  const canonical = absUrl(ctx, page.canonical || ctx.path);
  const og = s.og_image || ctx.content.hero_image;
  const ogAbs = /^https?:/.test(og) ? og : absUrl(ctx, og);
  return html`<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
${s.noindex || page.noindex ? raw('<meta name="robots" content="noindex, nofollow">') : ''}
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${ctx.company.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogAbs}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F2EC">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/static/fonts/lora-var.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/static/fonts/inter-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/static/css/site.css?v=${cfg.version}">
${page.jsonld ? raw(`<script type="application/ld+json">${JSON.stringify(page.jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
<script src="/static/js/pricing.js?v=${cfg.version}" defer></script>
<script src="/static/js/site.js?v=${cfg.version}" defer></script>
</head>`;
}

function header(ctx) {
  const c = ctx.company;
  return html`
<a class="skip" href="#main">Перейти к содержанию</a>
${ctx.site.demo_notice ? html`<div class="demo-bar"><strong>Демонстрационный сайт.</strong> Цены и контакты — примеры<span class="demo-bar__more">; заявки сохраняются, но услуги не оказываются</span>.</div>` : ''}
<header class="hdr" data-hdr>
  <div class="wrap hdr__in">
    ${logo(ctx)}
    <nav class="nav" aria-label="Основная навигация">
      ${NAV.map((n) => html`<a href="${n.href}"${isCurrent(ctx, n.href) ? raw(' aria-current="page"') : ''}>${n.label}</a>`)}
    </nav>
    <a class="hdr__phone" href="${telHref(c.phone)}"><b>${phoneText(c.phone)}</b><span>${lines(c.hours)[0] || ''}</span></a>
    <a class="btn btn--sm hdr__cta" href="/raschet">${ctx.content.hero_cta}</a>
    <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="mnav" data-menu-open>${icon('menu', { size: 22 })}</button>
  </div>
</header>
<div class="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Меню" data-menu>
  <div class="mnav__top">${logo(ctx)}<button class="burger" type="button" aria-label="Закрыть меню" data-menu-close>${icon('close', { size: 22 })}</button></div>
  <nav class="mnav__links" aria-label="Мобильная навигация">
    <a href="/"${ctx.path === '/' ? raw(' aria-current="page"') : ''}>Главная ${icon('arrow')}</a>
    ${NAV.map((n) => html`<a href="${n.href}"${isCurrent(ctx, n.href) ? raw(' aria-current="page"') : ''}>${n.label} ${icon('arrow')}</a>`)}
  </nav>
  <div class="mnav__foot">
    <div class="mnav__meta">${c.hours}</div>
    <a class="btn" href="/raschet">${icon('calc')} ${ctx.content.hero_cta}</a>
    <a class="btn btn--ghost" href="${telHref(c.phone)}">${icon('phone')} ${phoneText(c.phone)}</a>
  </div>
</div>`;
}

function socials(c, cls = 'link') {
  const links = { telegram: tgBase(c.tg_username) || c.telegram, whatsapp: c.whatsapp, vk: c.vk };
  const list = [['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'], ['vk', 'ВКонтакте']].filter(([k]) => links[k]);
  return list.map(([k, label]) => html`<a class="${cls}" href="${links[k]}" target="_blank" rel="noopener noreferrer">${label}</a>`);
}

function footer(ctx) {
  const c = ctx.company;
  const year = new Date().getFullYear();
  const svcs = ctx.services.slice(0, 6);
  return html`
<footer class="ftr">
  <div class="wrap">
    <div class="ftr__grid">
      <div>
        ${logo(ctx)}
        <p class="ftr__about">Уборка квартир, домов и небольших офисов в ${ctx.cityIn}. Стоимость называем до начала работ, оплата — после приёмки.</p>
      </div>
      <div>
        <h3>Услуги</h3>
        <ul>${svcs.map((s) => html`<li><a href="/uslugi/${s.slug}">${s.name}</a></li>`)}</ul>
      </div>
      <div>
        <h3>Клиентам</h3>
        <ul>
          <li><a href="/ceny">Цены</a></li>
          <li><a href="/raschet">Расчёт стоимости</a></li>
          <li><a href="/#faq">Частые вопросы</a></li>
          <li><a href="/kontakty">Контакты</a></li>
          <li><a href="/politika">Политика конфиденциальности</a></li>
        </ul>
      </div>
      <div>
        <h3>Связаться</h3>
        <a class="ftr__phone" href="${telHref(c.phone)}">${phoneText(c.phone)}</a>
        <ul>
          ${c.email ? html`<li><a href="mailto:${c.email}">${c.email}</a></li>` : ''}
          <li class="pre">${c.hours}</li>
          ${c.address ? html`<li>${c.address}</li>` : ''}
          ${socials(c, '').map((a) => html`<li>${a}</li>`)}
        </ul>
      </div>
    </div>
    <div class="ftr__bottom">
      <span>© ${year} ${c.legal_name || c.name}${c.inn ? html` · ИНН ${c.inn}` : ''}${c.ogrn ? html` · ОГРН ${c.ogrn}` : ''}</span>
      <a href="/politika">Обработка персональных данных</a>
    </div>
  </div>
</footer>
<div class="mbar" data-mbar>
  <a class="btn btn--ghost" href="${telHref(c.phone)}">${icon('phone', { size: 18 })} Позвонить</a>
  <a class="btn" href="/raschet">${icon('calc', { size: 18 })} Рассчитать</a>
</div>`;
}

function page(ctx, p, body) {
  return html`<html lang="ru" data-palette="${ctx.site.palette || 'pine'}">
${head(ctx, p)}
<body>
${header(ctx)}
<main id="main">${body}</main>
${footer(ctx)}
</body>
</html>`;
}

module.exports = { page, logo, phoneText, socials, mark, absUrl };
