/* Клиентский скрипт публичного сайта. Без зависимостей; сайт работает и без JS (формы отправляются обычным POST). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('ru-RU');
  var rub = function (n) { return nf.format(Math.round(n)).replace(/\s/g, ' ') + ' ₽'; };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    // ---------- Шапка и нижняя панель ----------
    var hdr = $('[data-hdr]'); var mbar = $('[data-mbar]');
    var onScroll = function () {
      var y = window.scrollY;
      if (hdr) hdr.classList.toggle('is-stuck', y > 8);
      if (mbar) {
        var calcVisible = $$('[data-calc]').some(function (f) { var r = f.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
        mbar.classList.toggle('is-on', y > 420 && !calcVisible);
      }
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // ---------- Мобильное меню ----------
    var menu = $('[data-menu]'); var opener = $('[data-menu-open]');
    function setMenu(open) {
      if (!menu) return;
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      if (opener) opener.setAttribute('aria-expanded', String(open));
      if (open) { var f = $('a, button', menu); if (f) f.focus(); } else if (opener) opener.focus();
    }
    if (opener) opener.addEventListener('click', function () { setMenu(true); });
    $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
    if (menu) {
      $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
      menu.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setMenu(false);
        if (e.key === 'Tab') { // удерживаем фокус внутри меню
          var f = $$('a, button', menu); var first = f[0]; var last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
    }

    // ---------- Деликатное появление блоков ниже первого экрана ----------
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      $$('.rv').forEach(function (el) {
        if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('rv-wait'); io.observe(el); }
      });
    }

    $$('[data-calc]').forEach(initCalc);
    $$('[data-ts]').forEach(function (i) { i.value = String(Date.now()); });
    $$('[data-lead-form]').forEach(initForm);
    $$('[data-phone]').forEach(initPhone);
  });

  // ---------- Калькулятор ----------
  function initCalc(form) {
    var qty = $('input[name="qty"]', form); var range = $('[data-range]', form);
    var totalEl = $('[data-total]', form); var linesEl = $('[data-lines]', form);
    var minNote = $('[data-min-note]', form); var qtyLabel = $('[data-qty-label]', form); var qtyUnit = $('[data-qty-unit]', form);
    var lastArea = null;

    function service() {
      var r = $('input[name="service_id"]:checked', form);
      return r ? { name: r.dataset.name, price: +r.dataset.price, per_area: +r.dataset.area, min_price: +r.dataset.min, unit: r.dataset.unit } : null;
    }
    function addons() {
      return $$('input[name="addons"]:checked', form).map(function (c) { return { id: +c.value, name: c.dataset.name, price: +c.dataset.price }; });
    }
    function li(a, b, cls) {
      var l = document.createElement('li'); if (cls) l.className = cls;
      var x = document.createElement('span'); x.textContent = a; var y = document.createElement('span'); y.textContent = b;
      l.appendChild(x); l.appendChild(y); return l;
    }
    function update() {
      var s = service();
      if (!s) { return; }
      var lim = window.Pricing.limits(s);
      if (lastArea !== s.per_area) { // переключение «м²» ↔ «штуки»
        if (lastArea !== null) qty.value = lim.def;
        lastArea = s.per_area;
        range.min = lim.min; range.max = lim.max;
        qtyLabel.textContent = lim.label; qtyUnit.textContent = 'Единица: ' + lim.unit;
        qty.setAttribute('aria-label', lim.label);
      }
      var q = Math.max(1, parseInt(qty.value, 10) || 0);
      range.value = Math.min(lim.max, Math.max(lim.min, q));
      var e = window.Pricing.estimate(s, q, addons());
      totalEl.innerHTML = '';
      var sm = document.createElement('small'); sm.textContent = '≈'; totalEl.appendChild(sm);
      totalEl.appendChild(document.createTextNode(rub(e.total)));
      linesEl.innerHTML = '';
      linesEl.appendChild(li(s.name + ', ' + e.qty + ' ' + lim.unit, rub(e.base)));
      e.addons.forEach(function (a) { linesEl.appendChild(li(a.name, '+ ' + rub(a.price))); });
      minNote.textContent = s.min_price ? (e.minApplied ? 'Применена минимальная стоимость ' + rub(s.min_price) : 'Минимальный заказ — ' + rub(s.min_price)) : '';
    }
    form.addEventListener('change', update);
    qty.addEventListener('input', update);
    range.addEventListener('input', function () { qty.value = range.value; update(); });
    $$('[data-step]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = service(); var step = s && s.per_area ? 5 : 1;
        var v = (parseInt(qty.value, 10) || 0) + (+b.dataset.step) * step;
        qty.value = Math.max(1, Math.min(1000, v)); update();
      });
    });
    update();
  }

  // ---------- Отправка заявки ----------
  function initForm(form) {
    var btn = $('[data-submit]', form); var label = $('[data-submit-label]', form); var formErr = $('[data-form-error]', form);
    var labelText = label ? label.textContent : '';

    function setErr(name, msg) {
      var el = $('[data-err="' + name + '"]', form);
      var input = form.elements[name];
      if (el) el.textContent = msg || '';
      var target = input && input.length && !input.tagName ? input[0] : input;
      if (target && target.setAttribute) { if (msg) target.setAttribute('aria-invalid', 'true'); else target.removeAttribute('aria-invalid'); }
    }
    function clientCheck() {
      var errs = {};
      var f = form.elements;
      if (!f.name.value.trim() || f.name.value.trim().length < 2) errs.name = 'Укажите имя — как к вам обращаться';
      var d = f.phone.value.replace(/\D/g, '');
      var phoneOptional = !!form.dataset.tg && !d.length;
      if (!phoneOptional && !(d.length === 10 || (d.length >= 11 && d.length <= 15))) errs.phone = 'Проверьте номер телефона: нужно 10–11 цифр';
      if (f.email && f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value)) errs.email = 'Проверьте адрес почты или оставьте поле пустым';
      if (f.kind.value === 'order') {
        if (!$('input[name="service_id"]:checked', form)) errs.service_id = 'Выберите услугу';
        if (!(parseInt(f.qty.value, 10) >= 1)) errs.qty = 'Укажите площадь или количество';
      }
      if (!f.consent.checked) errs.consent = 'Нужно согласие на обработку данных, чтобы мы могли перезвонить';
      return errs;
    }
    function showErrors(errs) {
      ['name', 'phone', 'email', 'service_id', 'qty', 'consent', 'preferred_date'].forEach(function (k) { setErr(k, errs[k]); });
      var first = Object.keys(errs)[0];
      if (first) {
        var el = form.elements[first]; el = el && el.length && !el.tagName ? el[0] : el;
        if (el && el.focus) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
      }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      if (formErr) formErr.textContent = '';
      var errs = clientCheck();
      showErrors(errs);
      if (Object.keys(errs).length) return;
      if (form.dataset.tg) { openTelegram(); return; }

      btn.disabled = true; btn.classList.add('is-loading'); if (label) label.textContent = 'Отправляем…';
      fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)), headers: { Accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Сервер вернул неожиданный ответ (' + r.status + ')' }; }); })
        .then(function (res) {
          if (res && res.ok) { done(res); return; }
          if (res && res.errors) showErrors(res.errors);
          if (formErr) formErr.textContent = (res && res.error) || 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.';
        })
        .catch(function () { if (formErr) formErr.textContent = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз — или позвоните нам.'; })
        .then(function () { btn.disabled = false; btn.classList.remove('is-loading'); if (label) label.textContent = labelText; });
    });

    // ---------- «Написать в Telegram»: открываем чат владельца с готовым текстом ----------
    function val(n) { var el = form.elements[n]; return el && el.value ? String(el.value).trim() : ''; }
    function buildMessage() {
      var L = [];
      if (val('kind') === 'callback') {
        L.push('Здравствуйте! Хочу проконсультироваться по уборке.');
        if (val('comment')) L.push('', val('comment'));
      } else {
        L.push('Здравствуйте! Хочу заказать уборку.', '');
        var r = $('input[name="service_id"]:checked', form);
        if (r) {
          var s = { price: +r.dataset.price, per_area: +r.dataset.area, min_price: +r.dataset.min };
          var lim = window.Pricing.limits(s); var q = Math.max(1, parseInt(val('qty'), 10) || 1);
          var ad = $$('input[name="addons"]:checked', form).map(function (c) { return { id: +c.value, name: c.dataset.name, price: +c.dataset.price }; });
          var est = window.Pricing.estimate(s, q, ad);
          L.push('Услуга: ' + r.dataset.name + ' — ' + q + ' ' + lim.unit);
          if (ad.length) L.push('Дополнительно: ' + ad.map(function (a) { return a.name; }).join(', '));
          L.push('Стоимость по калькулятору на сайте: ≈ ' + rub(est.total).replace(/\u00A0/g, ' '));
        }
        if (val('preferred_date')) L.push('Желаемая дата: ' + val('preferred_date').split('-').reverse().join('.'));
        if (val('address')) L.push('Адрес: ' + val('address'));
        if (val('comment')) L.push('Комментарий: ' + val('comment'));
      }
      L.push('');
      L.push('Имя: ' + val('name'));
      if (val('phone')) L.push('Телефон: ' + val('phone'));
      if (val('contact_time')) L.push('Удобно связаться: ' + val('contact_time'));
      return L.join('\n');
    }
    function openTelegram() {
      var text = buildMessage();
      var url = form.dataset.tg + '?text=' + encodeURIComponent(text);
      // Окно открываем сразу в обработчике клика, иначе браузер его заблокирует
      var w = null; try { w = window.open(url, '_blank'); if (w) w.opener = null; } catch (err) { w = null; }
      // Копия заявки для админки (на случай, если клиент не нажмёт «Отправить» в Telegram)
      try {
        var body = new URLSearchParams(new FormData(form)); body.set('channel', 'telegram');
        if (navigator.sendBeacon) navigator.sendBeacon(form.action, body);
        else fetch(form.action, { method: 'POST', body: body, keepalive: true, headers: { Accept: 'application/json' } });
      } catch (err) { /* копия не критична */ }
      doneTelegram(url, text, !w);
    }
    function doneTelegram(url, text, blocked) {
      var box = document.createElement('div');
      box.className = 'form-done'; box.setAttribute('role', 'status'); box.tabIndex = -1;
      var h = document.createElement('h3'); h.className = 'h3';
      h.textContent = blocked ? 'Осталось открыть Telegram' : 'Нажмите «Отправить» в Telegram';
      var p = document.createElement('p');
      p.textContent = blocked
        ? 'Нажмите кнопку ниже — откроется чат с нами, сообщение уже будет вписано.'
        : 'Мы открыли чат с нами — сообщение уже вписано, его можно дополнить. Если чат не открылся, нажмите кнопку ниже.';
      var msg = document.createElement('pre'); msg.className = 'form-done__msg'; msg.textContent = text;
      var act = document.createElement('div'); act.className = 'form-done__act';
      var a = document.createElement('a'); a.className = 'btn btn--tg'; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Открыть чат в Telegram';
      var c = document.createElement('button'); c.type = 'button'; c.className = 'btn btn--ghost'; c.textContent = 'Скопировать текст';
      c.addEventListener('click', function () {
        var ok = function () { c.textContent = 'Скопировано'; };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () { selectText(msg); });
        else selectText(msg);
      });
      act.appendChild(a); act.appendChild(c);
      box.appendChild(h); box.appendChild(p); box.appendChild(msg); box.appendChild(act);
      form.replaceWith(box);
      box.focus({ preventScroll: true });
      box.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
    function selectText(el) { var r = document.createRange(); r.selectNodeContents(el); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }

    function done(res) {
      // Подтверждение показываем только после ответа сервера о сохранении заявки
      var box = document.createElement('div');
      box.className = 'form-done'; box.setAttribute('role', 'status'); box.tabIndex = -1;
      var h = document.createElement('h3'); h.className = 'h3';
      h.textContent = res.id ? 'Заявка №' + res.id + ' принята' : 'Заявка принята';
      var p = document.createElement('p');
      p.textContent = form.elements.kind.value === 'callback'
        ? 'Спасибо! Перезвоним в рабочее время.'
        : 'Спасибо! Перезвоним, уточним детали и подтвердим стоимость' + (res.estimate ? ' (ориентир — ' + rub(res.estimate) + ')' : '') + '.';
      box.appendChild(h); box.appendChild(p);
      form.replaceWith(box);
      box.focus({ preventScroll: true });
      box.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  // ---------- Мягкое форматирование телефона ----------
  function initPhone(input) {
    input.addEventListener('blur', function () {
      var d = input.value.replace(/\D/g, '');
      if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
      if (d.length === 10) input.value = '+7 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
    });
  }
})();
