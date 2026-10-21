/* Улучшения интерфейса админки. Все действия работают и без JS (обычные формы с проверкой на сервере). */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function toast(msg, isErr) {
    var box = $('[data-toasts]'); if (!box) return;
    var t = document.createElement('div'); t.className = 'toast' + (isErr ? ' toast--err' : ''); t.setAttribute('role', 'status');
    var s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    var b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Закрыть'); b.onclick = function () { t.remove(); };
    t.appendChild(b); box.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 8000 : 4000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Тосты, пришедшие с сервера
    $$('.toast').forEach(function (t) { setTimeout(function () { t.remove(); }, 5000); });
    document.addEventListener('click', function (e) { if (e.target.matches('[data-toast-close]')) e.target.closest('.toast').remove(); });

    // Мобильное меню
    var side = $('[data-side]'); var open = $('[data-side-open]');
    if (open && side) {
      open.addEventListener('click', function (e) { e.stopPropagation(); side.classList.toggle('is-open'); });
      document.addEventListener('click', function (e) { if (side.classList.contains('is-open') && !side.contains(e.target)) side.classList.remove('is-open'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') side.classList.remove('is-open'); });
    }

    // Подтверждение опасных действий
    var dlg = $('[data-confirm-dialog]'); var pending = null;
    $$('form[data-confirm]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        if (f.dataset.confirmed) return;
        e.preventDefault();
        if (!dlg || typeof dlg.showModal !== 'function') { if (window.confirm(f.dataset.confirm)) { f.dataset.confirmed = '1'; f.submit(); } return; }
        pending = f; $('[data-cf-text]', dlg).textContent = f.dataset.confirm;
        dlg.showModal(); $('[data-cf-cancel]', dlg).focus();
      });
    });
    if (dlg) {
      $('[data-cf-cancel]', dlg).addEventListener('click', function () { pending = null; dlg.close(); });
      $('[data-cf-ok]', dlg).addEventListener('click', function () { if (pending) { pending.dataset.confirmed = '1'; var b = $('button[type=submit], button:not([type])', pending); if (b) b.classList.add('is-loading'); pending.submit(); } dlg.close(); });
    }

    // Индикатор сохранения и защита от двойной отправки
    $$('form[data-busy]').forEach(function (f) {
      f.addEventListener('submit', function () {
        var b = $('button[type=submit]', f) || $$('.card__f button[type=submit]', f)[0];
        if (b) { b.classList.add('is-loading'); setTimeout(function () { b.disabled = true; }, 0); }
      });
    });

    // Смена статуса заявки без перезагрузки
    $$('form[data-autosubmit]').forEach(function (f) {
      var sel = $('select', f);
      sel.addEventListener('change', function () {
        sel.disabled = true;
        var body = new URLSearchParams(new FormData(f)); body.set('status', sel.value);
        fetch(f.action, { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'same-origin' })
          .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
          .then(function (x) {
            if (x.j.ok) { toast(x.j.message); }
            else { toast(x.j.error || 'Не удалось сохранить', true); if (x.r.status === 401) location.href = '/admin/login'; }
          })
          .catch(function () { toast('Нет связи с сервером — статус не сохранён', true); })
          .then(function () { sel.disabled = false; });
      });
    });

    // Выбор изображения: превью файла и библиотека
    $$('[data-imgpick]').forEach(function (box) {
      var prev = $('[data-prev]', box); var file = $('[data-file]', box); var input = $('input[type=text]', box);
      if (file) file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        if (f.size > 5 * 1024 * 1024) { toast('Файл больше 5 МБ — уменьшите фото', true); file.value = ''; return; }
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('Подходят только JPG, PNG или WebP', true); file.value = ''; return; }
        prev.src = URL.createObjectURL(f); prev.hidden = false;
        $$('[data-lib]', box).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      });
      $$('[data-lib]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          input.value = b.dataset.lib; prev.src = b.dataset.lib; prev.hidden = false; if (file) file.value = '';
          $$('[data-lib]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        });
      });
      if (input) input.addEventListener('change', function () { if (/^(\/|https:\/\/)/.test(input.value)) { prev.src = input.value; prev.hidden = false; } });
    });

    // Предупреждение о несохранённых изменениях
    $$('form[data-busy][enctype], .main form.form[data-busy]').forEach(function (f) {
      if (f.action.indexOf('/admin/login') > -1) return;
      var dirty = false;
      f.addEventListener('input', function () { dirty = true; });
      f.addEventListener('submit', function () { dirty = false; });
      window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    });
  });
})();
