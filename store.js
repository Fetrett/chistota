'use strict';
/**
 * Хранилище данных.
 *  - На Netlify: Netlify Blobs (бесплатно, ничего настраивать не нужно).
 *  - Локально (node dev.js): JSON-файлы в папке .data/.
 *
 * Весь контент сайта — один JSON-документ «content», заявки — документ «leads»,
 * загруженные фото — ключи «media/<имя>».
 * Документ загружается в начале запроса, меняется синхронно и сохраняется в конце (flush).
 */
const fs = require('fs');
const path = require('path');
const seedData = require('../content');

const LOCAL_DIR = process.env.LOCAL_DATA_DIR || '';

// ---------- Бэкенды ----------
let blobStore = null;
async function blobs() {
  if (!blobStore) {
    const { getStore } = await import('@netlify/blobs');
    blobStore = getStore({ name: 'eksperty-chistoty', consistency: 'strong' });
  }
  return blobStore;
}
const fileKey = (k) => path.join(LOCAL_DIR, k.replace(/[^\w.-]/g, '_'));

const backend = {
  async getJSON(key) {
    if (LOCAL_DIR) { try { return JSON.parse(fs.readFileSync(fileKey(key) + '.json', 'utf8')); } catch { return null; } }
    return (await blobs()).get(key, { type: 'json' });
  },
  async setJSON(key, value) {
    if (LOCAL_DIR) { fs.mkdirSync(LOCAL_DIR, { recursive: true }); fs.writeFileSync(fileKey(key) + '.json', JSON.stringify(value)); return; }
    await (await blobs()).setJSON(key, value);
  },
  async putMedia(key, buf, type) {
    if (LOCAL_DIR) { fs.mkdirSync(LOCAL_DIR, { recursive: true }); fs.writeFileSync(fileKey('media_' + key), buf); fs.writeFileSync(fileKey('media_' + key) + '.type', type); return; }
    await (await blobs()).set('media/' + key, buf, { metadata: { type } });
  },
  async getMedia(key) {
    if (LOCAL_DIR) {
      try { return { data: fs.readFileSync(fileKey('media_' + key)), type: fs.readFileSync(fileKey('media_' + key) + '.type', 'utf8') }; } catch { return null; }
    }
    const r = await (await blobs()).getWithMetadata('media/' + key, { type: 'arrayBuffer' });
    return r ? { data: Buffer.from(r.data), type: (r.metadata && r.metadata.type) || 'application/octet-stream' } : null;
  },
  async deleteMedia(key) {
    if (LOCAL_DIR) { for (const f of [fileKey('media_' + key), fileKey('media_' + key) + '.type']) { try { fs.unlinkSync(f); } catch { /* нет файла */ } } return; }
    await (await blobs()).delete('media/' + key);
  },
};

// ---------- Первичное наполнение из content.js ----------
const join = (v, sep = '\n') => (Array.isArray(v) ? v.join(sep) : String(v ?? ''));
function seed() {
  const s = seedData;
  let id = 0;
  const items = [];
  for (const kind of ['advantage', 'step', 'faq', 'review']) {
    const src = { advantage: s.advantages, step: s.steps, faq: s.faq, review: s.reviews }[kind] || [];
    src.forEach((it, i) => items.push({ id: ++id, kind, title: it.title || '', body: join(it.body, '\n\n'), author: it.author || '', meta: it.meta || '', visible: it.visible === 0 ? 0 : 1, sort: (i + 1) * 10 }));
  }
  const now = sqlNow();
  return {
    v: 1,
    seq: id + 1000,
    settings: {
      company: { ...s.company, hours: join(s.company.hours), areas: join(s.company.areas) },
      content: { ...s.content, hero_points: join(s.content.hero_points), privacy_text: join(s.content.privacy_text, '\n\n') },
      blocks: { ...s.blocks },
      site: { ...s.site },
    },
    services: s.services.map((x, i) => ({ id: i + 1, ...x, description: join(x.description, '\n\n'), includes: join(x.includes), visible: x.visible === 0 ? 0 : 1, featured: x.featured ? 1 : 0, sort: (i + 1) * 10, created_at: now, updated_at: now })),
    addons: s.addons.map((a, i) => ({ id: 100 + i + 1, name: a.name, price: a.price, note: a.note || '', visible: a.visible === 0 ? 0 : 1, sort: (i + 1) * 10 })),
    items,
  };
}
function sqlNow() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }

// ---------- Состояние текущего запроса ----------
// На Netlify одна копия функции обрабатывает один запрос за раз, поэтому состояние модуля безопасно.
const state = { content: null, leads: null, dirtyContent: false, dirtyLeads: false };

async function loadContent() {
  state.content = (await backend.getJSON('content')) || seed();
  state.dirtyContent = false;
  return state.content;
}
async function loadLeads() {
  state.leads = (await backend.getJSON('leads')) || { seq: 0, items: [] };
  state.dirtyLeads = false;
  return state.leads;
}
function touchContent() { state.dirtyContent = true; }
function touchLeads() { state.dirtyLeads = true; }
async function flush() {
  const changed = state.dirtyContent;
  if (state.dirtyContent) { await backend.setJSON('content', state.content); state.dirtyContent = false; }
  if (state.dirtyLeads) { await backend.setJSON('leads', state.leads); state.dirtyLeads = false; }
  return changed;
}
function nextId() { state.content.seq = (state.content.seq || 1000) + 1; touchContent(); return state.content.seq; }

module.exports = { backend, state, seed, loadContent, loadLeads, touchContent, touchLeads, flush, nextId, sqlNow, isLocal: !!LOCAL_DIR };
