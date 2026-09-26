/* Moja kolekcja — project site · © pozdromaciek · AGPL-3.0 (see NOTICE) */
'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* brak storage */ } },
  };

  // wybór języka zapamiętany; pierwsze wejście na stronę EN z przeglądarką po polsku → wersja PL
  $$('.lang a').forEach((a) => a.addEventListener('click', () => store.set('siteLang', a.hreflang)));
  const page = document.documentElement.lang;
  if (page === 'en' && !store.get('siteLang') && /^pl\b/i.test(navigator.language || '')) {
    location.replace($('.lang a[hreflang=pl]').href);
    return;
  }

  // wyglądy
  const tabs = $$('.tabs [role=tab]');
  const img = $('#themeImg');
  const desc = $('#themeDesc');
  const secret = $('#themeSecret');
  function pick(btn) {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    const locked = btn.classList.contains('locked');
    img.hidden = locked; secret.hidden = !locked;
    if (!locked) { img.src = btn.dataset.src; img.alt = btn.dataset.alt; }
    desc.textContent = btn.dataset.desc || '';
  }
  tabs.forEach((b) => b.addEventListener('click', () => pick(b)));
  $('.tabs')?.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (n === null) return;
    const t = tabs[(n + tabs.length) % tabs.length];
    t.focus(); pick(t); e.preventDefault();
  });
  // obrazki wyglądów wczytaj zawczasu, żeby przełączanie było natychmiastowe
  window.addEventListener('load', () => tabs.forEach((b) => { if (b.dataset.src) { const i = new Image(); i.src = b.dataset.src; } }));

  // podgląd zdjęcia
  const lb = $('#lb');
  $$('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const im = b.querySelector('img');
    $('img', lb).src = im.src; $('img', lb).alt = im.alt;
    $('p', lb).textContent = b.dataset.zoom;
    lb.showModal();
  }));
  lb?.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.x')) lb.close(); });

  // kopiowanie komend
  $$('.code .copy').forEach((b) => b.addEventListener('click', async () => {
    const pre = $('pre', b.parentElement).cloneNode(true);
    pre.querySelectorAll('.c').forEach((c) => c.remove());
    const txt = pre.textContent.replace(/[ \t]+$/gm, '').trim();
    try { await navigator.clipboard.writeText(txt); const o = b.textContent; b.textContent = b.dataset.ok; setTimeout(() => { b.textContent = o; }, 1500); } catch { /* brak uprawnień */ }
  }));
})();
