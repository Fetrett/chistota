/* Единая формула расчёта стоимости: используется и на сервере (require), и в браузере (window.Pricing). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function limits(service) {
    return service.per_area
      ? { min: 10, max: 500, step: 1, def: 50, label: 'Площадь помещения', unit: 'м²' }
      : { min: 1, max: 60, step: 1, def: 4, label: 'Количество', unit: 'шт.' };
  }
  function estimate(service, qty, addons) {
    var l = limits(service);
    qty = Math.min(l.max * 2, Math.max(1, Math.floor(Number(qty)) || 1));
    var raw = Number(service.price) * qty;
    var base = Math.max(Number(service.min_price) || 0, raw);
    var list = (addons || []).map(function (a) { return { id: a.id, name: a.name, price: Number(a.price) }; });
    var addonsTotal = list.reduce(function (s, a) { return s + a.price; }, 0);
    return { qty: qty, raw: raw, base: base, minApplied: base > raw, addons: list, addonsTotal: addonsTotal, total: base + addonsTotal };
  }
  return { limits: limits, estimate: estimate };
});
