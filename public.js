'use strict';
/** Публичные страницы. Все данные приходят из базы через ctx — в шаблонах нет захардкоженных цен и контактов. */
const { html, raw, rub, fmt, lines, paragraphs, telHref, tgBase } = require('../util');
const { icon } = require('../icons');
const Pricing = require('../../public/static/js/pricing');
const { page, phoneText, socials, absUrl } = require('./layout');

// ---------- Мелкие компоненты ----------
const priceFrom = (s) => html`от <span class="num">${fmt(s.price)}</span>`;
const unitOf = (s) => s.unit || (s.per_area ? '₽/м²' : '₽');

function img(src, alt, { cls = '', eager = false, w = 1200, h = 900 } = {}) {
  return html`<img class="${cls}" src="${src || '/static/img/living.svg'}" alt="${alt}" width="${w}" height="${h}" ${raw(eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"')}>`;
}

function crumbs(list) {
  return html`<nav aria-label="Хлебные крошки"><ol class="crumbs">${list.map(([href, label]) => html`<li>${href ? html`<a href="${href}">${label}</a>` : html`<span aria-current="page">${label}</span>`}</li>`)}</ol></nav>`;
}

function serviceCard(s) {
  const inc = lines(s.includes).slice(0, 3);
  return html`
<article class="scard rv">
  <a class="scard__media" href="/uslugi/${s.slug}" tabindex="-1" aria-hidden="true">${img(s.image, '', { w: 1200, h: 900 })}</a>
  <div class="scard__body">
    <h3 class="scard__t"><a href="/uslugi/${s.slug}">${s.name}</a></h3>
    <p class="scard__sum">${s.summary}</p>
    ${inc.length ? html`<ul class="checks checks--sm">${inc.map((x) => html`<li>${icon('check', { size: 16 })}<span>${x}</span></li>`)}</ul>` : ''}
    <div class="scard__price"><span class="price price--sm">${priceFrom(s)}<small>${unitOf(s)}</small></span>${s.duration ? html`<span class="meta">${icon('clock', { size: 15 })}${s.duration}</span>` : ''}</div>
    <div class="scard__act">
      <a class="btn btn--sm" href="/raschet?usluga=${s.slug}">Рассчитать</a>
      <a class="link" href="/uslugi/${s.slug}">Подробнее ${icon('arrow', { size: 15 })}</a>
    </div>
  </div>
</article>`;
}

function serviceRow(s, i) {
  const inc = lines(s.includes).slice(0, 3);
  return html`
<article class="srow rv" id="s-${s.slug}">
  <a class="srow__media" href="/uslugi/${s.slug}" tabindex="-1" aria-hidden="true">${img(s.image, '')}</a>
  <div>
    ${s.category ? html`<div class="srow__cat">${s.category}</div>` : ''}
    <h3 class="h3 srow__title"><a href="/uslugi/${s.slug}">${s.name}</a></h3>
    <p class="srow__sum">${s.summary}</p>
    ${inc.length ? html`<ul class="checks">${inc.map((x) => html`<li>${icon('check', { size: 18 })}<span>${x}</span></li>`)}</ul>` : ''}
    <div class="srow__price">
      <span class="price">${priceFrom(s)}<small>${unitOf(s)}</small></span>
      ${s.duration ? html`<span class="meta">${icon('clock', { size: 17 })}${s.duration}</span>` : ''}
      ${s.min_price ? html`<span class="meta">Минимальный заказ — ${rub(s.min_price)}</span>` : ''}
    </div>
    <div class="srow__act">
      <a class="btn" href="/raschet?usluga=${s.slug}">Рассчитать ${icon('arrow', { size: 18, cls: 'i--move' })}</a>
      <a class="link" href="/uslugi/${s.slug}">Что входит в услугу ${icon('arrow', { size: 16 })}</a>
    </div>
  </div>
</article>`;
}

function priceTable(services, { compact = false } = {}) {
  const groups = new Map();
  for (const s of services) { const k = s.category || 'Другое'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  return html`<div class="plist">${[...groups].map(([g, list]) => html`
    <div class="plist__group">
      ${groups.size > 1 || !compact ? html`<div class="plist__gt">${g}</div>` : ''}
      ${list.map((s) => html`<a class="prow" href="/uslugi/${s.slug}">
        <span class="prow__name">${s.name}</span>
        <span class="prow__price">${priceFrom(s)} ${unitOf(s)}</span>
        <span class="prow__desc">${s.summary}</span>
        ${s.min_price ? html`<span class="prow__min">минимум ${rub(s.min_price)}</span>` : ''}
      </a>`)}
    </div>`)}</div>`;
}

function addonTable(addons) {
  return html`<div class="plist">${addons.map((a) => html`<div class="prow prow--addon">
    <span class="prow__name">${a.name}</span><span class="prow__price">${rub(a.price)}</span>
    ${a.note ? html`<span class="prow__desc">${a.note}</span>` : ''}</div>`)}</div>`;
}

function faqBlock(ctx, items, { title, aside = true } = {}) {
  if (!items.length) return '';
  return html`
<section class="sec" id="faq" aria-labelledby="faq-t">
  <div class="wrap faq">
    <div class="faq__aside rv">
      <span class="eyebrow">Вопросы</span>
      <h2 class="h2" id="faq-t">${title || ctx.content.faq_title}</h2>
      ${aside ? html`<p>Не нашли ответ? Позвоните по номеру <a href="${telHref(ctx.company.phone)}">${phoneText(ctx.company.phone)}</a> — ответим на вопросы до заказа.</p>` : ''}
    </div>
    <div class="qa rv">
      ${items.map((q, i) => html`<details${i === 0 ? raw(' open') : ''}><summary>${q.title}<span class="pm">${icon('plus', { size: 16 })}</span></summary><div class="ans">${paragraphs(q.body).map((p) => html`<p>${p}</p>`)}</div></details>`)}
    </div>
  </div>
</section>`;
}

function finalCta(ctx, { areas = false } = {}) {
  const c = ctx.content;
  const areaList = areas ? lines(ctx.company.areas) : [];
  return html`
<section class="sec--tight" aria-labelledby="final-t">
  <div class="wrap"><div class="final rv">
    <div><h2 class="h2" id="final-t">${c.final_title}</h2>${c.final_text ? html`<p>${c.final_text}</p>` : ''}
      ${areas ? html`<dl class="final__meta">
        <div><dt>Часы работы</dt><dd class="pre">${ctx.company.hours}</dd></div>
        ${areaList.length ? html`<div><dt>Где работаем</dt><dd><ul class="areas">${areaList.map((x) => html`<li>${x}</li>`)}</ul></dd></div>` : ''}
      </dl>` : ''}</div>
    <div class="final__act">
      <a class="btn" href="${telHref(ctx.company.phone)}">${icon('phone', { size: 18 })} ${phoneText(ctx.company.phone)}</a>
      ${tgBase(ctx.company.tg_username) ? html`<a class="btn btn--ghost" href="${tgBase(ctx.company.tg_username)}" target="_blank" rel="noopener">${icon('send', { size: 18 })} Telegram</a>` : ''}
      <a class="btn btn--ghost" href="/raschet">${c.hero_cta}</a>
    </div>
  </div></div>
</section>`;
}

// ---------- Калькулятор + форма заявки ----------
function calculator(ctx, { selected, values = {}, errors = {}, formError = '', headingTag = 'h2', id = 'calc' } = {}) {
  const svcs = ctx.services;
  const sel = svcs.find((s) => s.id === Number(values.service_id)) || svcs.find((s) => s.slug === selected) || svcs.find((s) => s.featured) || svcs[0] || null;
  const lim = Pricing.limits(sel || { per_area: 1 });
  const qty = values.qty || lim.def;
  const chosenAddons = new Set([].concat(values.addons || []).map(Number));
  const err = (k) => html`<span class="err" id="e-${k}" data-err="${k}">${errors[k] || ''}</span>`;
  const inv = (k) => raw(errors[k] ? ` aria-invalid="true" aria-describedby="e-${k}"` : ` aria-describedby="e-${k}"`);
  const c = ctx.content;
  const H = headingTag;
  const tg = tgBase(ctx.company.tg_username);

  return html`
<form class="calc" method="post" action="/zayavka" novalidate data-calc data-lead-form id="${id}"${tg ? html` data-tg="${tg}"` : ''}>
  <input type="hidden" name="kind" value="order">
  <input type="hidden" name="ts" value="" data-ts>
  <div class="hp" aria-hidden="true"><label>Сайт <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
  <div class="calc__main">
    ${formError ? html`<div class="alert alert--err" role="alert">${icon('alert')}<span>${formError}</span></div>` : ''}
    <fieldset class="fs">
      <legend><span class="fs__n">01</span>Какая уборка нужна</legend>
      <div class="opts opts--svc" role="radiogroup">
        ${svcs.map((s) => html`<label class="opt">
          <input type="radio" name="service_id" value="${s.id}" ${sel && sel.id === s.id ? raw('checked') : ''}
            data-price="${s.price}" data-area="${s.per_area}" data-min="${s.min_price}" data-unit="${unitOf(s)}" data-name="${s.name}">
          <span class="opt__mark"></span>
          <span><span class="opt__n">${s.name}</span><span class="opt__p">от ${fmt(s.price)} ${unitOf(s)}${s.min_price ? html`<span class="opt__min"> · мин. ${rub(s.min_price)}</span>` : ''}</span></span>
        </label>`)}
      </div>
      ${err('service_id')}
    </fieldset>

    <fieldset class="fs">
      <legend><span class="fs__n">02</span><span data-qty-label>${lim.label}</span></legend>
      <div class="qty">
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="Уменьшить">${icon('minus', { size: 18 })}</button>
          <input type="number" name="qty" id="qty" inputmode="numeric" min="1" max="1000" value="${qty}"${inv('qty')} aria-label="${lim.label}">
          <button type="button" data-step="1" aria-label="Увеличить">${icon('plus', { size: 18 })}</button>
        </div>
        <input class="range" type="range" min="${lim.min}" max="${lim.max}" step="1" value="${Math.min(lim.max, qty)}" data-range aria-label="Ползунок: ${lim.label}">
        <div class="qty__hint"><span data-qty-unit>Единица: ${lim.unit}</span><span data-min-note></span></div>
      </div>
      ${err('qty')}
    </fieldset>

    ${ctx.addons.length ? html`<fieldset class="fs">
      <legend><span class="fs__n">03</span>Дополнительно <small class="fs__opt">— по желанию</small></legend>
      <div class="opts opts--addons">
        ${ctx.addons.map((a) => html`<label class="opt opt--check"${a.note ? html` title="${a.note}"` : ''}>
          <input type="checkbox" name="addons" value="${a.id}" data-price="${a.price}" data-name="${a.name}" ${chosenAddons.has(a.id) ? raw('checked') : ''}>
          <span class="opt__mark"></span>
          <span><span class="opt__n">${a.name}</span><span class="opt__p">+ ${rub(a.price)}</span></span>
        </label>`)}
      </div>
    </fieldset>` : ''}

    <fieldset class="fs">
      <legend><span class="fs__n">${ctx.addons.length ? '04' : '03'}</span>${tg ? 'Как к вам обращаться' : 'Куда перезвонить'}</legend>
      <div class="fgrid fgrid--3">
        <div class="field"><label for="f-name">Имя</label><input class="input" id="f-name" name="name" autocomplete="name" required maxlength="80" value="${values.name || ''}"${inv('name')}>${err('name')}</div>
        <div class="field"><label for="f-phone">Телефон${tg ? html` <i>— необязательно</i>` : ''}</label><input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"${tg ? '' : raw(' required')} placeholder="+7 900 000-00-00" value="${values.phone || ''}"${inv('phone')} data-phone>${err('phone')}</div>
        <div class="field"><label for="f-email">Email <i>— необязательно</i></label><input class="input" id="f-email" name="email" type="email" autocomplete="email" maxlength="120" value="${values.email || ''}"${inv('email')}>${err('email')}</div>
        <div class="field"><label for="f-date">Желаемая дата <i>— необязательно</i></label><input class="input" id="f-date" name="preferred_date" type="date" min="${ctx.today}" value="${values.preferred_date || ''}"${inv('preferred_date')}>${err('preferred_date')}</div>
        <div class="field f-wide"><label for="f-address">Адрес или район <i>— необязательно</i></label><input class="input" id="f-address" name="address" autocomplete="street-address" maxlength="200" value="${values.address || ''}"></div>
        <div class="field full"><label for="f-comment">Комментарий <i>— этаж, питомцы, особые поверхности</i></label><textarea class="input" id="f-comment" name="comment" maxlength="1500" rows="2">${values.comment || ''}</textarea></div>
        <label class="consent full"><input type="checkbox" name="consent" value="1" ${values.consent ? raw('checked') : ''}${inv('consent')}><span>Согласен(на) на обработку персональных данных в соответствии с <a href="/politika" target="_blank">политикой конфиденциальности</a></span></label>
        <div class="full">${err('consent')}</div>
      </div>
    </fieldset>
  </div>

  <aside class="sum" aria-live="polite" aria-labelledby="sum-k">
    <div class="sum__k" id="sum-k">Ориентировочная стоимость</div>
    <div class="sum__total" data-total>${sel ? html`<small>≈</small>${rub(Pricing.estimate(sel, qty, ctx.addons.filter((a) => chosenAddons.has(a.id))).total)}` : html`<span class="sum__empty">Выберите услугу</span>`}</div>
    <ul class="sum__lines" data-lines>${sel ? html`<li><span>${sel.name}</span><span></span></li>` : html`<li><span>Услуга не выбрана</span><span>—</span></li>`}</ul>
    <p class="sum__note">Это ориентир по ценам сайта. Итоговую сумму подтвердим по телефону до начала работ — после уточнения состояния помещения.</p>
    <div class="err" data-form-error role="alert"></div>
    ${tg ? html`<button class="btn btn--block btn--tg" type="submit" data-submit>${icon('send', { size: 18 })}<span data-submit-label>Написать в Telegram</span></button>
    <p class="sum__note">Откроется чат с нами в Telegram — сообщение с расчётом уже будет вписано, останется нажать «Отправить». Или позвоните: <a href="${telHref(ctx.company.phone)}">${phoneText(ctx.company.phone)}</a></p>`
    : html`<button class="btn btn--block" type="submit" data-submit><span class="spinner" aria-hidden="true"></span><span data-submit-label>${c.submit_text}</span></button>
    <p class="sum__note">Перезвоним в рабочее время. Или позвоните сами: <a href="${telHref(ctx.company.phone)}">${phoneText(ctx.company.phone)}</a></p>`}
  </aside>
</form>`;
}

// ---------- Главная ----------
function home(ctx) {
  const c = ctx.content; const b = ctx.blocks; const co = ctx.company;
  const featured = ctx.services.filter((s) => s.featured);
  const rest = ctx.services.filter((s) => !s.featured);
  const tagSvc = featured[0] || ctx.services[0];
  const points = lines(c.hero_points);

  const body = html`
<section class="hero">
  <div class="wrap hero__grid">
    <div class="hero__text">
      <span class="eyebrow">${c.hero_eyebrow}</span>
      <h1 class="display">${c.hero_title}</h1>
      <p class="lead">${c.hero_text}</p>
      <div class="hero__cta">
        <a class="btn" href="/raschet">${icon('calc', { size: 18 })} ${c.hero_cta}</a>
        <a class="btn btn--ghost" href="${telHref(co.phone)}">${icon('phone', { size: 18 })} ${c.hero_cta2} · <span class="num">${phoneText(co.phone)}</span></a>
      </div>
      ${points.length ? html`<ul class="hero__points">${points.map((p) => html`<li>${icon('check', { size: 18 })}<span>${p}</span></li>`)}</ul>` : ''}
    </div>
    <div class="hero__media">
      ${img(c.hero_image, c.hero_image_alt, { cls: 'hero__img', eager: true, w: 1000, h: 1250 })}
      ${tagSvc ? html`<a class="tag" href="/uslugi/${tagSvc.slug}"><span class="tag__k">${tagSvc.name}</span><span class="tag__v">${priceFrom(tagSvc)}<small>${unitOf(tagSvc)}</small></span></a>` : ''}
    </div>
  </div>
</section>


${b.show_featured && ctx.services.length ? html`<section class="sec" id="services" aria-labelledby="svc-t">
  <div class="wrap">
    <div class="sec-head rv">
      <div><span class="eyebrow">Услуги</span><h2 class="h2" id="svc-t">${c.services_title}</h2><p class="lead">${c.services_text}</p></div>
      <a class="link" href="/ceny">Полный прайс-лист ${icon('arrow', { size: 16 })}</a>
    </div>
    <div class="scards">${(featured.length ? featured : ctx.services.slice(0, 3)).map(serviceCard)}</div>
    ${rest.length && featured.length ? html`<div class="more rv"><h3 class="more__t" id="more">Ещё услуги</h3>${priceTable(rest, { compact: true })}</div>` : ''}
  </div>
</section>` : ''}

${(b.show_process && ctx.steps.length) || (b.show_advantages && ctx.advantages.length) ? html`<section class="sec dark" id="process" aria-labelledby="proc-t">
  <div class="wrap">
    <span class="eyebrow">Как это работает</span>
    <h2 class="h2" id="proc-t">${c.process_title}</h2>
    ${b.show_process && ctx.steps.length ? html`<ol class="steps">${ctx.steps.map((s) => html`<li class="rv"><div><h3>${s.title}</h3><p>${s.body}</p></div></li>`)}</ol>` : ''}
    ${b.show_advantages && ctx.advantages.length ? html`<ul class="terms rv" aria-label="${c.adv_title}">${ctx.advantages.map((a) => html`<li>${icon('check', { size: 18 })}<div><h3>${a.title}</h3><p>${a.body}</p></div></li>`)}</ul>` : ''}
  </div>
</section>` : ''}

${ctx.services.length ? html`<section class="sec sec--alt" id="raschet" aria-labelledby="calc-t">
  <div class="wrap">
    <div class="sec-head sec-head--stack rv"><div><span class="eyebrow">Калькулятор</span><h2 class="h2" id="calc-t">${c.calc_title}</h2><p class="lead">${c.calc_text}</p></div></div>
    ${calculator(ctx, { id: 'calc-home' })}
  </div>
</section>` : ''}

${b.show_reviews && ctx.reviews.length ? html`<section class="sec" aria-labelledby="rev-t">
  <div class="wrap">
    <div class="sec-head rv"><div><span class="eyebrow">Отзывы</span><h2 class="h2" id="rev-t">${c.reviews_title}</h2></div></div>
    <div class="reviews rv">${ctx.reviews.map((r) => html`<figure class="review"><blockquote>${r.body}</blockquote><figcaption><b>${r.author || r.title}</b>${r.meta}</figcaption></figure>`)}</div>
  </div>
</section>` : ''}

${b.show_faq ? faqBlock(ctx, ctx.faq) : ''}

${finalCta(ctx, { areas: !!b.show_areas })}`;

  return page(ctx, { canonical: '/', jsonld: ctx.jsonld }, body);
}

function areasBlock(ctx) {
  const co = ctx.company;
  const areas = lines(co.areas);
  return html`<section class="sec--tight" aria-labelledby="area-t">
  <div class="wrap">
    <h2 class="sr-only" id="area-t">Контакты и районы обслуживания</h2>
    <div class="info3 rv">
      <div><h3>Телефон и часы работы</h3><a class="big-phone" href="${telHref(co.phone)}">${phoneText(co.phone)}</a><p class="pre muted">${co.hours}</p></div>
      <div><h3>Где работаем</h3>${areas.length ? html`<ul class="areas">${areas.map((a) => html`<li>${a}</li>`)}</ul>` : html`<p>${ctx.city}</p>`}</div>
      <div><h3>Написать</h3>${co.email ? html`<p><a class="link" href="mailto:${co.email}">${icon('mail', { size: 16 })} ${co.email}</a></p>` : ''}${co.address ? html`<p class="muted">${co.address}</p>` : ''}<div class="socials">${socials(co)}</div></div>
    </div>
  </div>
</section>`;
}

// ---------- Услуги ----------
function services(ctx) {
  const body = html`
<header class="phead"><div class="wrap">
  ${crumbs([['/', 'Главная'], [null, 'Услуги']])}
  <h1 class="display">Уборка для квартир, домов и офисов</h1>
  <p class="lead">${ctx.content.services_text}</p>
</div></header>
<section class="sec" aria-label="Список услуг"><div class="wrap">
  ${ctx.services.length ? ctx.services.map(serviceRow) : html`<p class="lead">Список услуг скоро появится. Позвоните нам — расскажем, чем можем помочь.</p>`}
</div></section>
${ctx.addons.length ? html`<section class="sec sec--alt" aria-labelledby="add-t"><div class="wrap cols2">
  <div><span class="eyebrow">Опции</span><h2 class="h2" id="add-t">Дополнительные работы</h2><p class="lead">Добавляются к любой уборке. Отметьте нужные в калькуляторе — они войдут в расчёт.</p></div>
  <div>${addonTable(ctx.addons)}</div>
</div></section>` : ''}
${finalCta(ctx)}`;
  return page(ctx, { title: 'Услуги', description: `Услуги клининга в ${ctx.cityIn}: ${ctx.services.map((s) => s.name.toLowerCase()).join(', ')}. Цены и состав работ.` }, body);
}

function service(ctx, s) {
  const inc = lines(s.includes);
  const others = ctx.services.filter((x) => x.id !== s.id).slice(0, 4);
  const body = html`
<div class="wrap">
  <section class="svc-hero">
    <div>
      ${crumbs([['/', 'Главная'], ['/uslugi', 'Услуги'], [null, s.name]])}
      <h1 class="display">${s.name}</h1>
      <p class="lead">${s.summary}</p>
      <dl class="facts">
        <div><dt>Цена</dt><dd>${priceFrom(s)} ${unitOf(s)}</dd></div>
        ${s.min_price ? html`<div><dt>Минимальный заказ</dt><dd>${rub(s.min_price)}</dd></div>` : ''}
        ${s.duration ? html`<div><dt>Длительность</dt><dd>${s.duration}</dd></div>` : ''}
      </dl>
      <div class="hero__cta"><a class="btn" href="#calc">${icon('calc', { size: 18 })} Рассчитать эту уборку</a><a class="btn btn--ghost" href="${telHref(ctx.company.phone)}">${icon('phone', { size: 18 })} Позвонить</a></div>
    </div>
    ${img(s.image, `${s.name} — пример результата`, { eager: true })}
  </section>
</div>
<section class="sec sec--alt" aria-labelledby="inc-t"><div class="wrap cols2">
  <div class="rv">
    <span class="eyebrow">Состав работ</span>
    <h2 class="h2" id="inc-t">Что входит в услугу</h2>
    ${inc.length ? html`<ul class="checks">${inc.map((x) => html`<li>${icon('check', { size: 18 })}<span>${x}</span></li>`)}</ul>` : ''}
  </div>
  <div class="rv">
    <div class="prose">${paragraphs(s.description).map((p) => html`<p>${p}</p>`)}</div>
    <div class="note">
      <h3>Как считается цена</h3>
      <p>${s.per_area ? html`Стоимость — ${fmt(s.price)} ${unitOf(s)} × площадь помещения` : html`Стоимость — ${fmt(s.price)} ${unitOf(s)} × количество`}${s.min_price ? html`, но не меньше ${rub(s.min_price)} за заказ` : ''}. Дополнительные опции прибавляются к сумме. Точную цену подтверждаем до начала работ.</p>
    </div>
  </div>
</div></section>
<section class="sec" aria-labelledby="calc-t"><div class="wrap">
  <div class="sec-head sec-head--stack"><div><span class="eyebrow">Калькулятор</span><h2 class="h2" id="calc-t">Посчитайте стоимость и оставьте заявку</h2></div></div>
  ${calculator(ctx, { selected: s.slug, id: 'calc' })}
</div></section>
${others.length ? html`<section class="sec sec--alt" aria-labelledby="oth-t"><div class="wrap">
  <div class="sec-head"><div><h2 class="h2" id="oth-t">Другие услуги</h2></div><a class="link" href="/uslugi">Все услуги ${icon('arrow', { size: 16 })}</a></div>
  ${priceTable(others, { compact: true })}
</div></section>` : ''}
${faqBlock(ctx, ctx.faq.slice(0, 4))}`;
  const offer = { '@context': 'https://schema.org', '@type': 'Service', name: s.name, description: s.summary, areaServed: ctx.city,
    provider: { '@type': 'LocalBusiness', name: ctx.company.name, telephone: ctx.company.phone },
    offers: { '@type': 'Offer', priceCurrency: 'RUB', price: String(s.price), priceSpecification: { '@type': 'UnitPriceSpecification', price: String(s.price), priceCurrency: 'RUB', unitText: unitOf(s).replace('₽/', '') } } };
  return page(ctx, { title: `${s.name} в ${ctx.cityIn}`, description: `${s.summary} Цена от ${fmt(s.price)} ${unitOf(s)}.`, jsonld: ctx.site.demo_notice ? null : offer }, body);
}

// ---------- Цены ----------
function prices(ctx) {
  const body = html`
<header class="phead"><div class="wrap">
  ${crumbs([['/', 'Главная'], [null, 'Цены']])}
  <h1 class="display">Цены на уборку</h1>
  <p class="lead">Все цены — «от». Итог зависит от площади, состояния помещения и дополнительных работ. Сумму называем до начала уборки.</p>
</div></header>
<section class="sec"><div class="wrap cols2">
  <div>${ctx.services.length ? priceTable(ctx.services) : html`<p>Прайс-лист обновляется. Позвоните — назовём цену.</p>`}</div>
  <aside class="rv">
    <div class="note"><h3>Что влияет на стоимость</h3>
      <ul class="checks">
        <li>${icon('check', { size: 18 })}<span>Тип уборки и площадь помещения</span></li>
        <li>${icon('check', { size: 18 })}<span>Состояние: давность последней уборки, следы ремонта, питомцы</span></li>
        <li>${icon('check', { size: 18 })}<span>Дополнительные работы — духовка, холодильник, балкон и другие</span></li>
        <li>${icon('check', { size: 18 })}<span>У каждой услуги есть минимальная стоимость заказа</span></li>
      </ul>
    </div>
    <a class="btn btn--block mt" href="/raschet">${icon('calc', { size: 18 })} Рассчитать свою уборку</a>
  </aside>
</div></section>
${ctx.addons.length ? html`<section class="sec sec--alt" aria-labelledby="add-t"><div class="wrap cols2">
  <div><span class="eyebrow">Опции</span><h2 class="h2" id="add-t">Дополнительные работы</h2><p class="lead">Добавляются к любой уборке.</p></div>
  <div>${addonTable(ctx.addons)}</div>
</div></section>` : ''}
${finalCta(ctx)}`;
  return page(ctx, { title: 'Цены', description: `Прайс-лист на уборку в ${ctx.cityIn}: поддерживающая и генеральная уборка, после ремонта, мытьё окон. Дополнительные опции и минимальный заказ.` }, body);
}

// ---------- Расчёт ----------
function calcPage(ctx, opts = {}) {
  const body = html`
<header class="phead"><div class="wrap">
  ${crumbs([['/', 'Главная'], [null, 'Расчёт стоимости']])}
  <h1 class="display">${ctx.content.calc_title}</h1>
  <p class="lead">${ctx.content.calc_text}</p>
</div></header>
<section class="sec sec--alt"><div class="wrap">
  ${ctx.services.length ? calculator(ctx, { ...opts, id: 'calc' }) : html`<p class="lead">Калькулятор временно недоступен. Позвоните: <a href="${telHref(ctx.company.phone)}">${phoneText(ctx.company.phone)}</a></p>`}
</div></section>
${faqBlock(ctx, ctx.faq.slice(0, 4))}`;
  return page(ctx, { title: 'Расчёт стоимости уборки', description: 'Онлайн-калькулятор стоимости уборки: выберите услугу, площадь и опции, оставьте заявку — перезвоним и подтвердим цену.', canonical: '/raschet' }, body);
}

// ---------- Контакты ----------
function contacts(ctx, { values = {}, errors = {}, formError = '' } = {}) {
  const co = ctx.company;
  const tg = tgBase(co.tg_username);
  const areas = lines(co.areas);
  const err = (k) => html`<span class="err" id="e-${k}" data-err="${k}">${errors[k] || ''}</span>`;
  const inv = (k) => raw(errors[k] ? ` aria-invalid="true" aria-describedby="e-${k}"` : ` aria-describedby="e-${k}"`);
  const body = html`
<header class="phead"><div class="wrap">
  ${crumbs([['/', 'Главная'], [null, 'Контакты']])}
  <h1 class="display">Контакты</h1>
  <p class="lead">Позвоните или оставьте номер — перезвоним, ответим на вопросы и поможем выбрать формат уборки.</p>
</div></header>
<section class="sec"><div class="wrap contact-grid">
  <ul class="clist">
    <li><span class="k">Телефон</span><span class="v"><a class="big-phone" href="${telHref(co.phone)}">${phoneText(co.phone)}</a></span></li>
    ${co.email ? html`<li><span class="k">Email</span><span class="v"><a href="mailto:${co.email}">${co.email}</a></span></li>` : ''}
    <li><span class="k">Часы работы</span><span class="v pre">${co.hours}</span></li>
    ${co.address ? html`<li><span class="k">Адрес офиса</span><span class="v">${co.address}</span></li>` : ''}
    ${areas.length ? html`<li><span class="k">Районы</span><span class="v"><ul class="areas">${areas.map((a) => html`<li>${a}</li>`)}</ul></span></li>` : ''}
    ${socials(co).length ? html`<li><span class="k">Мессенджеры</span><span class="v socials">${socials(co)}</span></li>` : ''}
    ${co.legal_name || co.inn ? html`<li><span class="k">Реквизиты</span><span class="v">${co.legal_name}${co.inn ? html`<br>ИНН ${co.inn}` : ''}${co.ogrn ? html`<br>ОГРН ${co.ogrn}` : ''}</span></li>` : ''}
  </ul>
  <div class="panel" id="callback">
    <h2 class="h3">${tg ? 'Написать нам' : 'Заказать обратный звонок'}</h2>
    <p class="muted small">${tg ? 'Опишите вопрос — откроется чат с нами в Telegram, сообщение уже будет вписано.' : 'Оставьте телефон — перезвоним в рабочее время.'}</p>
    <form method="post" action="/zayavka" novalidate data-lead-form class="fgrid" id="cb-form"${tg ? html` data-tg="${tg}"` : ''}>
      <input type="hidden" name="kind" value="callback"><input type="hidden" name="ts" value="" data-ts>
      <div class="hp" aria-hidden="true"><label>Сайт <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      ${formError ? html`<div class="alert alert--err full" role="alert">${icon('alert')}<span>${formError}</span></div>` : ''}
      <div class="field full"><label for="c-name">Имя</label><input class="input" id="c-name" name="name" autocomplete="name" required maxlength="80" value="${values.name || ''}"${inv('name')}>${err('name')}</div>
      <div class="field full"><label for="c-phone">Телефон${tg ? html` <i>— необязательно</i>` : ''}</label><input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel"${tg ? '' : raw(' required')} placeholder="+7 900 000-00-00" value="${values.phone || ''}"${inv('phone')} data-phone>${err('phone')}</div>
      <div class="field full"><label for="c-time">Когда удобно говорить <i>— необязательно</i></label><input class="input" id="c-time" name="contact_time" maxlength="40" placeholder="Например, после 18:00" value="${values.contact_time || ''}"></div>
      <div class="field full"><label for="c-comment">Вопрос <i>— необязательно</i></label><textarea class="input" id="c-comment" name="comment" rows="3" maxlength="1500">${values.comment || ''}</textarea></div>
      <label class="consent full"><input type="checkbox" name="consent" value="1"${inv('consent')} ${values.consent ? raw('checked') : ''}><span>Согласен(на) на обработку персональных данных по <a href="/politika" target="_blank">политике конфиденциальности</a></span></label>
      <div class="full">${err('consent')}<div class="err" data-form-error role="alert"></div></div>
      ${tg ? html`<button class="btn btn--tg full" type="submit" data-submit>${icon('send', { size: 18 })}<span data-submit-label>Написать в Telegram</span></button>`
        : html`<button class="btn full" type="submit" data-submit><span class="spinner" aria-hidden="true"></span><span data-submit-label>Перезвоните мне</span></button>`}
    </form>
  </div>
</div></section>`;
  return page(ctx, { title: 'Контакты', description: `Телефон, часы работы и районы обслуживания компании «${co.name}» в ${ctx.cityIn}.`, jsonld: ctx.jsonld }, body);
}

function thanks(ctx, { id, kind } = {}) {
  const body = html`<section class="e404"><div class="wrap">
    <span class="eyebrow">Заявка получена</span>
    <h1 class="h2">Спасибо! ${id ? html`Заявка №${id} сохранена.` : ''}</h1>
    <p class="lead">${kind === 'callback' ? 'Перезвоним в рабочее время.' : 'Перезвоним в рабочее время, уточним детали и подтвердим стоимость.'} Если вопрос срочный — позвоните: <a href="${telHref(ctx.company.phone)}">${phoneText(ctx.company.phone)}</a>.</p>
    <div class="hero__cta"><a class="btn btn--ghost" href="/">На главную</a></div>
  </div></section>`;
  return page(ctx, { title: 'Заявка отправлена', noindex: true }, body);
}

function privacy(ctx) {
  const t = String(ctx.content.privacy_text || '').replace(/\{name\}/g, ctx.company.legal_name || ctx.company.name).replace(/\{email\}/g, ctx.company.email || 'наш email');
  const body = html`<header class="phead"><div class="wrap">${crumbs([['/', 'Главная'], [null, 'Политика конфиденциальности']])}<h1 class="h2">Политика обработки персональных данных</h1></div></header>
  <section class="sec"><div class="wrap prose">${paragraphs(t).map((p) => html`<p>${p}</p>`)}</div></section>`;
  return page(ctx, { title: 'Политика конфиденциальности', description: 'Как мы обрабатываем персональные данные из форм на сайте.' }, body);
}

function notFound(ctx) {
  const body = html`<section class="e404"><div class="wrap">
    <div class="display">404</div>
    <h1 class="h2">Такой страницы нет</h1>
    <p class="lead">Возможно, адрес изменился или услугу убрали из списка. Начните с главной или посмотрите цены.</p>
    <div class="hero__cta"><a class="btn" href="/">На главную</a><a class="btn btn--ghost" href="/ceny">Цены</a></div>
  </div></section>`;
  return page(ctx, { title: 'Страница не найдена', noindex: true }, body);
}

module.exports = { home, services, service, prices, calcPage, contacts, thanks, privacy, notFound, absUrl };
