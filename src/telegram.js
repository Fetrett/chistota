'use strict';
/**
 * Отправка заявок владельцу в Telegram.
 * Нужны переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID (см. README).
 * Несколько получателей — через запятую в TELEGRAM_CHAT_ID.
 */
const { rub, prettyPhone } = require('./util');

const API = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const chats = () => String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
const configured = () => !!(token() && chats().length);

function text(lead, siteUrl) {
  let addons = []; try { addons = JSON.parse(lead.addons || '[]'); } catch { addons = []; }
  const rows = [
    lead.kind === 'callback' ? `📞 Обратный звонок — заявка №${lead.id}` : `🧽 Новая заявка №${lead.id}`,
    '',
    `Имя: ${lead.name}`,
    `Телефон: ${prettyPhone(lead.phone)}`,
    !!lead.email && `Email: ${lead.email}`,
    !!lead.service_name && `Услуга: ${lead.service_name}${lead.qty ? ` — ${lead.qty} ${lead.qty_unit || ''}`.trimEnd() : ''}`,
    !!addons.length && `Опции: ${addons.map((a) => a.name).join(', ')}`,
    !!lead.estimate && `Ориентир по сайту: ${rub(lead.estimate).replace(/ /g, ' ')}`,
    !!lead.address && `Адрес: ${lead.address}`,
    !!lead.preferred_date && `Желаемая дата: ${lead.preferred_date.split('-').reverse().join('.')}`,
    !!lead.contact_time && `Удобно звонить: ${lead.contact_time}`,
    !!lead.comment && `Комментарий: ${lead.comment}`,
    siteUrl ? '' : false,
    !!siteUrl && `Открыть в админке: ${siteUrl}/admin/leads/${lead.id}`,
  ];
  return rows.filter((r) => typeof r === 'string').join('\n');
}

/** Возвращает { ok, error } — не бросает исключений. */
async function sendLead(lead, siteUrl) {
  if (!configured()) return { ok: false, error: 'not_configured' };
  const msg = text(lead, siteUrl);
  const results = await Promise.all(chats().map(async (chat_id) => {
    try {
      const r = await fetch(`${API()}/bot${token()}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: msg, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(7000),
      });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.ok ? null : (j.description || `HTTP ${r.status}`);
    } catch (e) { return e.message; }
  }));
  const errs = results.filter(Boolean);
  if (errs.length) console.error('[telegram]', errs.join('; '));
  return { ok: errs.length < results.length, error: errs.join('; ') || null };
}

/** Тестовое сообщение из админки. */
async function sendTest(siteName) {
  if (!configured()) return { ok: false, error: 'Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID' };
  return sendLead({ id: 0, kind: 'callback', name: `Проверка связи — ${siteName}`, phone: '+70000000000', comment: 'Если вы видите это сообщение, заявки с сайта будут приходить сюда.' }, '');
}

module.exports = { sendLead, sendTest, configured, text };
