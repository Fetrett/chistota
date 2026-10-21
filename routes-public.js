'use strict';
const cfg = require('./config');
const { Services, Addons, Items, getGroup } = require('./models');
const Leads = require('./leads');
const store = require('./store');
const V = require('./validate');
const views = require('./views/public');
const { esc, lines } = require('./util');

const siteUrl = (req) => cfg.siteUrl || req.origin;

/** Контекст страницы — всё из хранилища, поэтому правки в админке сразу попадают на сайт. */
function context(req) {
  const company = getGroup('company');
  const site = getGroup('site');
  const ctx = {
    path: req.path.length > 1 ? req.path.replace(/\/$/, '') : '/', origin: siteUrl(req),
    company, site, content: getGroup('content'), blocks: getGroup('blocks'),
    city: company.city || 'Зеркальный', cityIn: company.city_in || company.city || 'Зеркальном',
    services: Services.list({ visibleOnly: true }), addons: Addons.list({ visibleOnly: true }),
    advantages: Items.list('advantage', { visibleOnly: true }), steps: Items.list('step', { visibleOnly: true }),
    faq: Items.list('faq', { visibleOnly: true }), reviews: Items.list('review', { visibleOnly: true }),
    today: new Date().toISOString().slice(0, 10),
  };
  ctx.jsonld = site.demo_notice ? null : {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: company.name, url: ctx.origin + '/', telephone: company.phone,
    ...(company.email ? { email: company.email } : {}),
    ...(company.address ? { address: { '@type': 'PostalAddress', streetAddress: company.address, addressLocality: ctx.city, addressCountry: 'RU' } } : {}),
    areaServed: lines(company.areas).length ? lines(company.areas) : ctx.city,
  };
  return ctx;
}

// Публичные страницы кешируются CDN Netlify; после сохранения в админке кеш сбрасывается.
const CACHE = { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=600, stale-while-revalidate=86400' };

function register(r) {
  r.get('/', (req, res) => res.html(views.home(context(req)), 200, CACHE));
  r.get('/uslugi', (req, res) => res.html(views.services(context(req)), 200, CACHE));
  r.get('/uslugi/:slug', (req, res) => {
    const ctx = context(req);
    const s = ctx.services.find((x) => x.slug === req.params.slug);
    if (!s) return res.html(views.notFound(ctx), 404, CACHE);
    res.html(views.service(ctx, s), 200, CACHE);
  });
  r.get('/ceny', (req, res) => res.html(views.prices(context(req)), 200, CACHE));
  r.get('/raschet', (req, res) => res.html(views.calcPage(context(req), { selected: V.str(req.query.usluga, 80) }), 200, CACHE));
  r.get('/kontakty', (req, res) => res.html(views.contacts(context(req)), 200, CACHE));
  r.get('/politika', (req, res) => res.html(views.privacy(context(req)), 200, CACHE));
  r.get('/spasibo', (req, res) => res.html(views.thanks(context(req), { id: Number(req.query.n) || 0, kind: req.query.k })));

  r.post('/zayavka', async (req, res) => {
    await store.loadLeads();
    try {
      const out = await Leads.create(req.body, req.ip);
      if (req.wantsJson) return res.json({ ok: true, id: out.id || null, estimate: out.estimate || null });
      return res.redirect(`/spasibo?n=${out.id || ''}&k=${req.body.kind === 'callback' ? 'callback' : 'order'}`);
    } catch (e) {
      if (!(e instanceof Leads.LeadError)) throw e;
      if (req.wantsJson) return res.json({ ok: false, error: e.message, errors: e.errors }, e.status);
      const ctx = context(req);
      const values = { ...req.body, addons: [].concat(req.body.addons || []) };
      res.html(req.body.kind === 'callback' ? views.contacts(ctx, { values, errors: e.errors, formError: e.message }) : views.calcPage(ctx, { values, errors: e.errors, formError: e.message }), e.status);
    }
  });

  r.get('/media/:key', async (req, res) => {
    const f = /^[\w.-]+$/.test(req.params.key) ? await store.backend.getMedia(req.params.key) : null;
    if (!f) return res.send(404, 'Not found', 'text/plain; charset=utf-8');
    res.send(200, f.data, f.type, { 'Cache-Control': 'public, max-age=31536000, immutable', 'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable' });
    res.removeHeader('Content-Security-Policy');
  });

  r.get('/robots.txt', (req, res) => {
    const body = getGroup('site').noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nDisallow: /zayavka\nDisallow: /spasibo\n\nSitemap: ${siteUrl(req)}/sitemap.xml\n`;
    res.send(200, body, 'text/plain; charset=utf-8', CACHE);
  });
  r.get('/sitemap.xml', (req, res) => {
    const base = siteUrl(req);
    const pages = ['/', '/uslugi', '/ceny', '/raschet', '/kontakty', '/politika', ...Services.list({ visibleOnly: true }).map((s) => `/uslugi/${s.slug}`)];
    res.send(200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join('\n')}\n</urlset>\n`, 'application/xml; charset=utf-8', CACHE);
  });
}

module.exports = { register, context };
