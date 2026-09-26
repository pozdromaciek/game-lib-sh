/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// Kreator pierwszego uruchomienia: kod z logów → hasło → IGDB → eBay (można pominąć) → gotowe.
(function () {
  const $ = (s) => document.querySelector(s);
  let lang = 'pl';
  try { lang = localStorage.getItem('appLang') === 'en' ? 'en' : 'pl'; } catch { /* brak storage */ }

  const EN = {
    title: 'MY COLLECTION — SETUP', welcome: 'Hi! Let’s get started',
    codeInfo: 'So nobody else on your network can take over a fresh install, enter the code from the container logs:',
    codeLbl: 'Setup code', pwTitle: 'App password', pwInfo: 'One password protects the whole collection. At least 8 characters.',
    pw1: 'Password', pw2: 'Repeat password',
    igdbTitle: 'IGDB keys (required)', igdbInfo: 'IGDB is Twitch’s game database — the app gets titles, covers and console photos from it. The keys are free.',
    igdb1: 'Sign in at <a href="https://dev.twitch.tv/console" target="_blank" rel="noopener">dev.twitch.tv/console</a> (a Twitch account with two-factor authentication on).',
    igdb2: '“Register Your Application”: any name, OAuth Redirect URL <code>http://localhost</code>, category “Application Integration”, client type “Confidential”.',
    igdb3: '“Manage” → copy the <b>Client ID</b>, then “New Secret” → copy the <b>Client Secret</b>.',
    test: 'Check keys', ebayTitle: 'eBay keys (optional)',
    ebayInfo: 'eBay is used for suggested prices of games and consoles. You can skip this and add them later in Menu → Tools → API keys.',
    ebay1: 'Create a free account at <a href="https://developer.ebay.com/" target="_blank" rel="noopener">developer.ebay.com</a>.',
    ebay2: '“Application Keys” → create a <b>Production</b> keyset. eBay asks about account deletion notifications — choose the exemption (the app does not store eBay user data).',
    ebay3: 'Copy the <b>App ID (Client ID)</b> and <b>Cert ID (Client Secret)</b>.',
    doneTitle: 'Ready to go', doneInfo: 'You can change keys and the password later in Menu → Tools. A backup is made automatically every night.',
    back: 'Back', skip: 'Skip', next: 'Next', finish: 'Finish', step: 'STEP {a}/{b}',
    sumPw: 'Password: set', sumPwEnv: 'Password: from the .env file', sumIgdb: 'IGDB: working', sumIgdbEnv: 'IGDB: from the .env file',
    sumEbay: 'eBay: working', sumEbayNo: 'eBay: skipped — add later in Tools', sumEbayEnv: 'eBay: from the .env file',
    errPwLen: 'The password must be at least 8 characters', errPwSame: 'The passwords don’t match', errIgdb: 'Check the IGDB keys first',
    errFill: 'Fill in both fields', checking: 'Checking…', saving: 'Saving…',
    // komunikaty serwera
    'Zły kod instalacji — sprawdź logi kontenera': 'Wrong setup code — check the container logs',
    'Za dużo prób — odczekaj 10 minut': 'Too many attempts — wait 10 minutes',
    'Twitch nie przyjął kluczy — sprawdź Client ID i Client Secret': 'Twitch rejected the keys — check the Client ID and Client Secret',
    'eBay nie przyjął kluczy — potrzebne są klucze produkcyjne (Production)': 'eBay rejected the keys — Production keys are needed',
    'Brak połączenia z serwerem usługi — sprawdź internet na serwerze': 'Can’t reach the service — check the server’s internet connection',
    'Wpisz klucze IGDB — bez nich apka nie znajdzie gier': 'Enter the IGDB keys — without them the app can’t find games',
    'Hasło musi mieć co najmniej 8 znaków': 'The password must be at least 8 characters',
    'IGDB działa': 'IGDB works', 'eBay działa': 'eBay works', 'Instalacja jest już zakończona': 'Setup is already finished',
  };
  const PL = {
    finish: 'Zakończ', step: 'KROK {a}/{b}', sumPw: 'Hasło: ustawione', sumPwEnv: 'Hasło: z pliku .env', sumIgdb: 'IGDB: działa',
    sumIgdbEnv: 'IGDB: z pliku .env', sumEbay: 'eBay: działa', sumEbayNo: 'eBay: pominięty — dodasz w Narzędziach', sumEbayEnv: 'eBay: z pliku .env',
    errPwLen: 'Hasło musi mieć co najmniej 8 znaków', errPwSame: 'Hasła się różnią', errIgdb: 'Najpierw sprawdź klucze IGDB',
    errFill: 'Uzupełnij oba pola', checking: 'Sprawdzam…', saving: 'Zapisuję…', next: 'Dalej',
  };
  const t = (k) => (lang === 'en' ? EN[k] : PL[k]) ?? k;
  const orig = {};
  document.querySelectorAll('[data-t]').forEach((el) => { orig[el.dataset.t] = el.innerHTML; });
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => {
      const k = el.dataset.t;
      el.innerHTML = lang === 'en' && EN[k] ? EN[k] : orig[k];
    });
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    document.title = lang === 'en' ? 'My collection – setup' : 'Moja kolekcja – instalacja';
    show();
  }

  let state = {};
  let steps = [];
  let idx = 0;
  const done = {igdb: false, ebay: false};

  async function call(url, body) {
    const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    let j = {};
    try { j = await r.json(); } catch { /* pusta odpowiedź */ }
    if (!r.ok) throw new Error(t(typeof j.detail === 'string' ? j.detail : `HTTP ${r.status}`));
    return j;
  }
  const code = () => $('#code').value.trim();
  const err = (m) => { $('#err').textContent = m || ''; };

  function show() {
    const cur = steps[idx];
    document.querySelectorAll('section[data-step]').forEach((s) => { s.hidden = s.dataset.step !== cur; });
    $('#stepNo').textContent = t('step').replace('{a}', idx + 1).replace('{b}', steps.length);
    $('#back').hidden = idx === 0;
    $('#skip').hidden = cur !== 'ebay';
    $('#next').textContent = cur === 'done' ? t('finish') : t('next');
    if (cur === 'done') summary();
    const first = document.querySelector(`section[data-step="${cur}"] input`);
    if (first) setTimeout(() => first.focus(), 30);
  }
  function summary() {
    const li = [];
    li.push(state.password_env ? t('sumPwEnv') : t('sumPw'));
    li.push(state.igdb_env ? t('sumIgdbEnv') : t('sumIgdb'));
    li.push(state.ebay_env ? t('sumEbayEnv') : (done.ebay ? t('sumEbay') : t('sumEbayNo')));
    $('#summary').innerHTML = li.map((x) => `<li>✓ ${x}</li>`).join('');
  }

  async function testIgdb() {
    err(''); $('#igdbOk').textContent = t('checking');
    try {
      const r = await call('/api/setup/test', {code: code(), service: 'igdb', values: {IGDB_CLIENT_ID: $('#igdbId').value.trim(), IGDB_CLIENT_SECRET: $('#igdbSecret').value.trim()}});
      done.igdb = true; $('#igdbOk').textContent = '✓ ' + t(r.msg);
      return true;
    } catch (e) { done.igdb = false; $('#igdbOk').textContent = ''; err(e.message); return false; }
  }

  async function next() {
    err('');
    const cur = steps[idx];
    const btn = $('#next');
    btn.disabled = true;
    try {
      if (cur === 'code') {
        await call('/api/setup/code', {code: code()});
      } else if (cur === 'password') {
        const a = $('#pw1').value; const b = $('#pw2').value;
        if (a.length < 8) throw new Error(t('errPwLen'));
        if (a !== b) throw new Error(t('errPwSame'));
      } else if (cur === 'igdb') {
        if (!done.igdb && !(await testIgdb())) return;
      } else if (cur === 'ebay') {
        const id = $('#ebayId').value.trim(); const sec = $('#ebaySecret').value.trim();
        if (!id && !sec) { done.ebay = false; } else {
          if (!id || !sec) throw new Error(t('errFill'));
          $('#ebayOk').textContent = t('checking');
          const r = await call('/api/setup/test', {code: code(), service: 'ebay', values: {EBAY_CLIENT_ID: id, EBAY_CLIENT_SECRET: sec}});
          done.ebay = true; $('#ebayOk').textContent = '✓ ' + t(r.msg);
        }
      } else if (cur === 'done') {
        btn.textContent = t('saving');
        const body = {code: code(), password: $('#pw1').value, igdb: {}, ebay: null};
        if (!state.igdb_env) body.igdb = {IGDB_CLIENT_ID: $('#igdbId').value.trim(), IGDB_CLIENT_SECRET: $('#igdbSecret').value.trim()};
        if (done.ebay) body.ebay = {EBAY_CLIENT_ID: $('#ebayId').value.trim(), EBAY_CLIENT_SECRET: $('#ebaySecret').value.trim()};
        await call('/api/setup/finish', body);
        try { localStorage.setItem('appLang', lang); } catch { /* nic */ }
        location.href = '/';
        return;
      }
      idx++; show();
    } catch (e) {
      if (cur === 'ebay') $('#ebayOk').textContent = '';
      err(e.message);
      if (cur === 'done') show();
    } finally { btn.disabled = false; }
  }

  $('#f').addEventListener('submit', (e) => { e.preventDefault(); next(); });
  $('#back').addEventListener('click', () => { err(''); if (idx > 0) { idx--; show(); } });
  $('#skip').addEventListener('click', () => { err(''); done.ebay = false; $('#ebayId').value = ''; $('#ebaySecret').value = ''; $('#ebayOk').textContent = ''; idx++; show(); });
  $('#igdbTest').addEventListener('click', testIgdb);
  ['#igdbId', '#igdbSecret'].forEach((s) => $(s).addEventListener('input', () => { done.igdb = false; $('#igdbOk').textContent = ''; }));
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try { localStorage.setItem('appLang', lang); } catch { /* nic */ }
    applyLang();
  }));

  fetch('/api/setup/state').then((r) => r.json()).then((s) => {
    if (!s.needed) { location.href = '/'; return; }
    state = s;
    steps = ['code'];
    if (!s.password_env) steps.push('password');
    if (!s.igdb_env) steps.push('igdb');
    if (!s.ebay_env) steps.push('ebay');
    steps.push('done');
    applyLang();
  }).catch(() => { location.href = '/'; });
})();
