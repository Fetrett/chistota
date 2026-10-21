'use strict';
/** Фото из админки: проверка сигнатуры файла, лимит размера, хранение в Netlify Blobs. */
const crypto = require('crypto');
const { backend, state } = require('./store');

const MAX = 4 * 1024 * 1024;
const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null; // SVG не принимаем: может содержать скрипты
}

/** { url } | { url: null } если файла нет | { error } */
async function saveImage(file) {
  if (!file || !file.data || !file.data.length) return { url: null };
  if (file.data.length > MAX) return { error: 'Файл больше 4 МБ. Уменьшите фото (например, до 2000 px по длинной стороне).' };
  const ext = sniff(file.data);
  if (!ext) return { error: 'Подходят только JPG, PNG или WebP.' };
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}${ext}`;
  await backend.putMedia(name, file.data, TYPES[ext]);
  return { url: '/media/' + name };
}

/** Удаляет файл, если на него больше не ссылается контент сайта. */
async function cleanup(url) {
  if (!/^\/media\/[\w.-]+$/.test(url || '')) return;
  if (JSON.stringify(state.content).includes(url)) return;
  try { await backend.deleteMedia(url.slice('/media/'.length)); } catch (e) { console.error('[media]', e.message); }
}

module.exports = { saveImage, cleanup, sniff, MAX };
