'use strict';
// Настройки из переменных окружения Netlify. Адрес сайта Netlify подставляет сам (URL).
module.exports = {
  get siteUrl() { return String(process.env.SITE_URL || process.env.URL || '').replace(/\/$/, ''); },
  // Метка версии для CSS/JS: на Netlify это id деплоя (меняется при каждом обновлении сайта),
  // поэтому браузеры сразу берут свежие файлы, а не старые из кеша.
  version: '3',
};
