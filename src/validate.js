'use strict';
/**
 * Серверная валидация. Каждая функция возвращает { data, errors }.
 * errors — объект { поле: 'сообщение' }; пустой объект означает успех.
 */
const { normPhone, slugify, tgBase } = require('./util');

const str = (v, max = 500) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const bool = (v) => (v === '1' || v === 'on' || v === true || v === 1 ? 1 : 0);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-zа-яё]{2,}$/i;
const isEmail = (s) => EMAIL.test(s);

function int(v, { min = 0, max = 10_000_000 } = {}) {
  const s = String(v ?? '').replace(/\s/g, '');
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n < min || n > max ? NaN : n;
}

// Путь к изображению: только локальные файлы сайта или https-ссылка
function imagePath(v) {
  const s = str(v, 400);
  if (!s) return { ok: true, value: '' };
  if (/^\/(media|static\/img)\/[\w.\-/]+$/.test(s) && !s.includes('..')) return { ok: true, value: s };
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return { ok: true, value: s };
  return { ok: false };
}
function url(v) {
  const s = str(v, 300);
  if (!s) return { ok: true, value: '' };
  return /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(s) ? { ok: true, value: s } : { ok: false };
}

// ---------- Публичная заявка ----------
function lead(b) {
  const e = {};
  const kind = b.kind === 'callback' ? 'callback' : 'order';
  const channel = b.channel === 'telegram' ? 'telegram' : 'form';
  const d = {
    kind, channel,
    name: str(b.name, 80),
    phone: normPhone(b.phone),
    email: str(b.email, 120).toLowerCase(),
    address: str(b.address, 200),
    preferred_date: str(b.preferred_date, 10),
    contact_time: str(b.contact_time, 40),
    comment: str(b.comment, 1500),
    service_id: b.service_id ? int(b.service_id, { min: 1 }) : null,
    qty: b.qty ? int(b.qty, { min: 1, max: 1000 }) : null,
    addon_ids: [].concat(b.addons || []).map((x) => int(x, { min: 1 })).filter((x) => !Number.isNaN(x)).slice(0, 30),
  };
  if (d.name.length < 2) e.name = 'Укажите имя — как к вам обращаться';
  if (!d.phone && (channel !== 'telegram' || str(b.phone))) e.phone = 'Проверьте номер телефона: нужно 10–11 цифр';
  if (!d.phone) d.phone = '';
  if (d.email && !isEmail(d.email)) e.email = 'Проверьте адрес почты или оставьте поле пустым';
  if (d.preferred_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.preferred_date) || Number.isNaN(Date.parse(d.preferred_date))) e.preferred_date = 'Некорректная дата';
    else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(d.preferred_date) < today) e.preferred_date = 'Дата уже прошла';
    }
  }
  if (kind === 'order') {
    if (!d.service_id || Number.isNaN(d.service_id)) e.service_id = 'Выберите услугу';
    if (d.qty == null || Number.isNaN(d.qty)) e.qty = 'Укажите площадь или количество';
  }
  if (!bool(b.consent)) e.consent = 'Нужно согласие на обработку данных, чтобы мы могли перезвонить';
  return { data: d, errors: e };
}

// ---------- Услуга ----------
function service(b, isSlugTaken) {
  const e = {};
  const d = {
    name: str(b.name, 120),
    category: str(b.category, 60),
    summary: str(b.summary, 300),
    description: str(b.description, 4000),
    includes: str(b.includes, 4000),
    price: int(b.price, { min: 0, max: 1_000_000 }),
    per_area: b.per_area === '0' ? 0 : 1,
    unit: str(b.unit, 30),
    min_price: b.min_price === '' || b.min_price == null ? 0 : int(b.min_price, { min: 0, max: 10_000_000 }),
    duration: str(b.duration, 60),
    visible: bool(b.visible),
    featured: bool(b.featured),
  };
  d.slug = slugify(str(b.slug, 80) || d.name);
  if (d.name.length < 2) e.name = 'Название обязательно';
  if (Number.isNaN(d.price)) e.price = 'Цена — целое число рублей, без копеек';
  if (Number.isNaN(d.min_price)) e.min_price = 'Минимальная стоимость — целое число или пусто';
  if (!d.unit) d.unit = d.per_area ? '₽/м²' : '₽/шт.';
  if (!d.summary) e.summary = 'Короткое описание показывается в карточке услуги';
  if (isSlugTaken(d.slug)) e.slug = 'Такой адрес страницы уже занят другой услугой';
  const img = imagePath(b.image);
  if (!img.ok) e.image = 'Загрузите файл или укажите ссылку, начинающуюся с https://';
  d.image = img.value;
  return { data: d, errors: e };
}

function addon(b) {
  const e = {};
  const d = { name: str(b.name, 100), price: int(b.price, { min: 0, max: 1_000_000 }), note: str(b.note, 200), visible: bool(b.visible) };
  if (d.name.length < 2) e.name = 'Название обязательно';
  if (Number.isNaN(d.price)) e.price = 'Цена — целое число рублей';
  return { data: d, errors: e };
}

function item(b, kind) {
  const e = {};
  const d = { kind, title: str(b.title, 200), body: str(b.body, 3000), author: str(b.author, 80), meta: str(b.meta, 80), visible: bool(b.visible) };
  if (d.title.length < 2) e.title = kind === 'faq' ? 'Введите вопрос' : 'Введите заголовок';
  if (d.body.length < 2) e.body = kind === 'faq' ? 'Введите ответ' : 'Введите текст';
  return { data: d, errors: e };
}

function company(b) {
  const e = {};
  const d = {
    name: str(b.name, 80), legal_name: str(b.legal_name, 160), city: str(b.city, 60), city_in: str(b.city_in, 60), phone: str(b.phone, 40), email: str(b.email, 120),
    address: str(b.address, 200), hours: str(b.hours, 300), areas: str(b.areas, 1500),
    inn: str(b.inn, 12), ogrn: str(b.ogrn, 15),
  };
  if (d.name.length < 2) e.name = 'Название обязательно';
  if (!d.city) e.city = 'Укажите город';
  if (!d.city_in) d.city_in = d.city;
  if (!normPhone(d.phone)) e.phone = 'Номер не распознан. Пример: +7 900 000-00-00';
  if (d.email && !isEmail(d.email)) e.email = 'Некорректный email';
  if (d.inn && !/^(\d{10}|\d{12})$/.test(d.inn)) e.inn = 'ИНН — 10 или 12 цифр';
  if (d.ogrn && !/^(\d{13}|\d{15})$/.test(d.ogrn)) e.ogrn = 'ОГРН — 13 цифр, ОГРНИП — 15';
  d.tg_username = str(b.tg_username, 60).replace(/^https?:\/\/t\.me\//i, '');
  if (d.tg_username) {
    const base = tgBase(d.tg_username);
    if (!base) e.tg_username = 'Укажите логин вида @username (5–32 латинских буквы, цифры или _) или номер телефона';
    else d.tg_username = base.startsWith('https://t.me/+') ? base.slice(13) : '@' + base.slice(13);
  }
  d.telegram = '';
  for (const k of ['whatsapp', 'vk']) {
    const u = url(b[k]);
    if (!u.ok) e[k] = 'Полная ссылка, начиная с https://';
    d[k] = u.value;
  }
  return { data: d, errors: e };
}

module.exports = { str, bool, int, isEmail, imagePath, url, lead, service, addon, item, company };
