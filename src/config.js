'use strict';
// Настройки из переменных окружения Netlify. Адрес сайта Netlify подставляет сам (URL).
module.exports = {
  get siteUrl() { return String(process.env.SITE_URL || process.env.URL || '').replace(/\/$/, ''); },
  version: '2', // меняйте при правке CSS/JS, чтобы браузеры обновили кеш
};
