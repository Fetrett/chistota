'use strict';
/**
 * Приём заявок с сайта: проверка, антиспам, серверный пересчёт стоимости,
 * сохранение копии и отправка владельцу в Telegram.
 */
const crypto = require('crypto');
const V = require('./validate');
const Pricing = require('../public/static/js/pricing');
const { Services, Addons, Leads } = require('./models');
const telegram = require('./telegram');

class LeadError extends Error { constructor(message, status = 400, errors = {}) { super(message); this.status = status; this.errors = errors; } }
const ipHash = (ip) => crypto.createHash('sha256').update('ec-ip:' + (process.env.ADMIN_PASSWORD || '') + ip).digest('hex').slice(0, 24);

async function create(body, ip, siteUrl) {
  if (V.str(body.website)) return { id: 0, silent: true }; // ловушка для ботов
  const ts = Number(body.ts);
  if (ts && Date.now() - ts < 2500) throw new LeadError('Слишком быстрая отправка. Проверьте данные и нажмите кнопку ещё раз.', 429);

  const { data, errors } = V.lead({ ...body, service_id: body.service_id || body.service });
  let q = null;
  if (data.kind === 'order' && !errors.service_id) {
    const service = Services.get(data.service_id);
    if (!service || !service.visible) errors.service_id = 'Эта услуга недоступна. Выберите другую.';
    else q = { service, ...Pricing.estimate(service, data.qty || 1, Addons.byIds(data.addon_ids)) };
  }
  if (Object.keys(errors).length) throw new LeadError('Проверьте выделенные поля', 422, errors);

  const h = ipHash(ip);
  if (Leads.recentFromIpHash(h, 10) >= 5) throw new LeadError('Слишком много заявок подряд. Позвоните нам или попробуйте через 10 минут.', 429);

  const row = {
    kind: data.kind, name: data.name, phone: data.phone, email: data.email, address: data.address,
    preferred_date: data.preferred_date, contact_time: data.contact_time, comment: data.comment,
    service_id: q ? q.service.id : null, service_name: q ? q.service.name : '',
    qty: q ? q.qty : null, qty_unit: q ? Pricing.limits(q.service).unit : '',
    addons: JSON.stringify(q ? q.addons : []), estimate: q ? q.total : null, ip_hash: h,
  };
  const id = Leads.create(row);
  const tg = await telegram.sendLead({ id, ...row }, siteUrl);
  if (!tg.ok) { const l = Leads.get(id); Leads.update(id, { status: l.status, note: tg.error === 'not_configured' ? '' : 'Не удалось отправить в Telegram: ' + tg.error }); }
  return { id, estimate: row.estimate };
}

module.exports = { create, LeadError };
