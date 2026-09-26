/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// ================= sprzedaż, waluta, skan numeru seryjnego, raport PDF, „Twój rok w grach” =================

// ---------- waluta ----------
function applyCurrency() {
  CUR = settings.currency || 'PLN';
  $$('.cursym').forEach((el) => { el.textContent = curSym(); });
  if ($('#curSel')) $('#curSel').value = CUR;
}
async function changeCurrency() {
  const to = $('#curSel').value;
  if (to === CUR) { toast('To już jest waluta kolekcji'); return; }
  const convert = $('#curConv').checked;
  if (!confirm(convert ? `Przeliczyć wszystkie kwoty z ${CUR} na ${to} po dzisiejszym kursie NBP?` : `Zmienić walutę na ${to} bez przeliczania kwot?`)) return;
  try {
    const r = await jsonPost('/api/currency', {to, convert});
    settings = r.settings; applyCurrency(); await load();
    toast(r.factor ? `Przeliczono po kursie ${String(r.factor.toFixed(4)).replace('.', ',')}` : `Waluta: ${to}`);
  } catch (e) { toast(e.message, true); }
}

// ---------- sprzedaż ----------
let saleItem = null;
async function openSale(it) {
  saleItem = it;
  $('#saleTitle').textContent = it.title;
  $('#saleInfo').textContent = [it.platform, it.price_paid != null ? `kupiona za ${zl(it.price_paid)}` : '', it.value != null ? `wartość ${zl(it.value)}` : '',
    isDupe(it) ? 'masz dubel' : ''].filter(Boolean).join(' · ');
  $('#saleAsk').value = it.asking_price ?? it.value ?? '';
  $('#saleSugHint').textContent = '';
  $('#adZip').href = `/api/items/${it.id}/photos.zip`;
  $('#saleSave').textContent = it.for_sale ? 'Zapisz cenę' : 'Zapisz — na sprzedaż';
  $('#adTitle').value = ''; $('#adBody').value = '…';
  $('#adShops').innerHTML = sellLinks();
  $('#saleDlg').showModal();
  try {
    const ad = await api(`/api/items/${it.id}/ad`);
    $('#adTitle').value = ad.title; $('#adBody').value = ad.body;
    $('#adZip').hidden = !ad.photos;
  } catch (e) { $('#adBody').value = ''; toast(e.message, true); }
}
async function saleSuggest() {
  const it = saleItem; if (!it) return;
  $('#saleSugHint').textContent = 'Szukam ofert…';
  const p = new URLSearchParams({title: it.title, kind: it.kind, platform: it.platform || '', region: it.region || '', edition: it.edition || '',
    model: it.model || '', has_box: it.has_box, has_manual: it.has_manual, has_disc: it.has_disc});
  try {
    const r = await api('/api/price?' + p);
    if (r.suggested != null) { $('#saleAsk').value = r.suggested; $('#saleSugHint').textContent = `mediana ofert ${zl(r.median)}`; } else $('#saleSugHint').textContent = r.note || 'Brak danych';
  } catch (e) { $('#saleSugHint').textContent = e.message; }
}
async function saleSave() {
  const it = saleItem; if (!it) return;
  const v = $('#saleAsk').value;
  try {
    await jsonPost(`/api/items/${it.id}/sale`, {on: true, asking_price: v === '' ? null : Number(v)});
    toast(it.for_sale ? 'Zapisano cenę' : 'Wystawione na sprzedaż'); saleItem = {...it, for_sale: true};
    $('#saleSave').textContent = 'Zapisz cenę';
    await load();
  } catch (e) { toast(e.message, true); }
}
function openSold(it) {
  saleItem = it;
  $('#soldTitle').textContent = it.title;
  $('#soldPrice').value = it.asking_price ?? '';
  $('#soldDate').value = today();
  $('#soldTo').value = '';
  soldProfitHint();
  $('#soldDlg').showModal();
}
function soldProfitHint() {
  const it = saleItem; const v = $('#soldPrice').value;
  $('#soldProfit').textContent = it && it.price_paid != null && v !== '' ? `${+v - it.price_paid >= 0 ? 'Zysk' : 'Strata'}: ${zl(Math.abs(+v - it.price_paid))} (kupiona za ${zl(it.price_paid)})` : '';
}
function soldDetail(it, head, cv, kvHtml) {
  const prof = it.price_paid != null && it.sold_price != null ? it.sold_price - it.price_paid : null;
  const kv = [['Sprzedana', esc(it.sold_on)], ['Cena sprzedaży', it.sold_price != null ? `<b>${zl(it.sold_price)}</b>` : '—'],
    ['Kupiona', [it.purchased_on, it.price_paid != null ? zl(it.price_paid) : ''].filter(Boolean).join(' · ') || '—'],
    ['Wynik', prof == null ? '—' : `<b class="${prof >= 0 ? 'up' : 'down'}">${prof >= 0 ? '+' : '−'}${zl(Math.abs(prof))}</b>`]];
  if (it.sold_to) kv.push(['Kupujący', esc(it.sold_to)]);
  return `<div class="manual">${head}<div class="bd">${cv([`<span class="ptag">Sprzedana</span>`])}${kvHtml(kv)}
    <div class="acts"><button class="btn light" data-act="unsold">Cofnij sprzedaż</button><button class="btn" data-act="delete">Usuń</button></div></div></div>`;
}

// ---------- skan numeru seryjnego ----------
// zmniejsza zdjęcie z telefonu (12 MP → max 2000 px) — szybszy upload i OCR, mniej pamięci
async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file, {imageOrientation: 'from-image'});
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
    return blob || file;
  } catch { return file; }
}
function ocrFail(msg) {
  $('#sHint').textContent = msg;
  $('#sHint').classList.add('err');
  toast(msg, true);
}
async function ocrUpload(file) {
  try { sessionStorage.removeItem('ocrPending'); } catch { /* prywatne okno */ }
  if (!file) return;
  $('#sHint').classList.remove('err');
  $('#sHint').textContent = 'Czytam numer ze zdjęcia…';
  $('#results').innerHTML = '';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const img = await shrinkPhoto(file);
    const fd = new FormData(); fd.append('file', img, 'numer.jpg'); fd.append('platform', $('#sPlatform')?.value || '');
    const r = await api('/api/ocr-serial', {method: 'POST', body: fd, signal: ctl.signal});
    if (r.serial) $('#sQuery').value = r.serial;
    if (!r.results.length) {
      $('#sHint').textContent = r.serial ? `Odczytano ${r.serial}, ale nie znam takiego wydania — sprawdź numer i kliknij „Szukaj”.`
        : 'Nie udało się odczytać numeru — zrób zdjęcie z bliska, w dobrym świetle, sam numer w kadrze.';
      checkTrophies(); return;
    }
    $('#sHint').textContent = `Odczytano: ${r.serial}`;
    $('#results').innerHTML = r.results.map((g, i) => `<button type="button" class="res" data-i="${i}">
      <span class="img">${g.thumb ? `<img src="${esc(g.thumb)}" alt="" loading="lazy">` : `<span>${esc(g.title)}</span>`}</span>
      <span class="t"><b>${esc(g.title)}</b>${g.release_year ?? ''}</span></button>`).join('');
    $$('#results .res').forEach((b) => b.addEventListener('click', () => pick(r.results[+b.dataset.i])));
    checkTrophies();
  } catch (e) { ocrFail(e.message || 'Nie udało się wysłać zdjęcia'); } finally { clearTimeout(timer); }
}
// telefon potrafi zamknąć stronę, gdy otwiera aparat (mało pamięci) — po powrocie wyjaśnij, co się stało
function ocrResume() {
  let t = 0;
  try { t = +sessionStorage.getItem('ocrPending') || 0; sessionStorage.removeItem('ocrPending'); } catch { /* nic */ }
  if (!t || Date.now() - t > 10 * 60 * 1000) return;
  openAdd();
  setTimeout(() => ocrFail('Telefon zamknął stronę podczas robienia zdjęcia (za mało pamięci). Zrób zdjęcie zwykłym aparatem i wybierz je przyciskiem galerii obok.'), 300);
}

// ---------- aparat w oknie apki (getUserMedia — tylko HTTPS / localhost) ----------
let scanStream = null;
const canLiveCam = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
function camClick() {
  if (canLiveCam()) { openScanner(); return; }
  $('#camHelpDlg').showModal();
}
async function openScanner() {
  const dlg = $('#scanDlg'), v = $('#scanVideo');
  dlg.showModal();
  $('#scanZoomRow').hidden = true; $('#scanFocusRow').hidden = true; $('#scanTorch').hidden = true;
  try {
    // wysoka rozdzielczość: można trzymać telefon dalej (poza minimalną odległością ostrzenia), a numer i tak jest czytelny
    scanStream = await navigator.mediaDevices.getUserMedia({audio: false,
      video: {facingMode: {ideal: 'environment'}, width: {ideal: 3840}, height: {ideal: 2160}}});
    v.srcObject = scanStream;
    await v.play().catch(() => {});
    const track = scanStream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    $('#scanTorch').hidden = !caps.torch;
    if (caps.focusMode?.includes('continuous')) track.applyConstraints({advanced: [{focusMode: 'continuous'}]}).catch(() => {});
    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
      const z = $('#scanZoom');
      Object.assign(z, {min: caps.zoom.min, max: Math.min(caps.zoom.max, caps.zoom.min * 8), step: caps.zoom.step || 0.1,
        value: track.getSettings?.().zoom ?? caps.zoom.min});
      $('#scanZoomRow').hidden = false;
    }
    if (caps.focusDistance && caps.focusMode?.includes('manual') && caps.focusDistance.max > caps.focusDistance.min) {
      const f = $('#scanFocusDist');
      Object.assign(f, {min: caps.focusDistance.min, max: caps.focusDistance.max, step: caps.focusDistance.step || 0.01,
        value: track.getSettings?.().focusDistance ?? caps.focusDistance.min});
      $('#scanFocusRow').hidden = false;
    }
  } catch (e) {
    dlg.close();
    ocrFail(e.name === 'NotAllowedError' ? 'Brak zgody na aparat — zezwól w ustawieniach strony w przeglądarce.' : `Nie udało się włączyć aparatu (${e.name || e.message})`);
  }
}
function scanTrack() { return scanStream?.getVideoTracks()[0]; }
// stuknięcie w podgląd → ostrość w tym punkcie (Chrome: pointsOfInterest + single-shot)
function scanTapFocus(e) {
  const t = scanTrack(); if (!t) return;
  const box = $('#scanBox').getBoundingClientRect();
  const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
  const mark = $('#scanFocus');
  mark.style.left = `${x * 100}%`; mark.style.top = `${y * 100}%`;
  mark.hidden = false; mark.style.animation = 'none'; void mark.offsetWidth; mark.style.animation = '';
  clearTimeout(mark._t); mark._t = setTimeout(() => { mark.hidden = true; }, 1500);
  const caps = t.getCapabilities?.() || {};
  const c = {};
  if (caps.focusMode?.includes('single-shot')) c.focusMode = 'single-shot';
  else if (caps.focusMode?.includes('continuous')) c.focusMode = 'continuous';
  c.pointsOfInterest = [{x, y}];
  t.applyConstraints({advanced: [c]}).catch(() => {});
  if (c.focusMode === 'single-shot') setTimeout(() => t.applyConstraints({advanced: [{focusMode: 'continuous'}]}).catch(() => {}), 2500);
}
function stopScanner() {
  scanStream?.getTracks().forEach((t) => t.stop());
  scanStream = null;
  $('#scanVideo').srcObject = null;
}
// prostokąt ramki w pikselach klatki wideo (podgląd ma object-fit:cover), z zapasem 10%
function scanCropRect(W, H) {
  const v = $('#scanVideo');
  const box = v.getBoundingClientRect(), fr = $('.scanframe').getBoundingClientRect();
  const vw = v.videoWidth || W, vh = v.videoHeight || H;
  const sc = Math.max(box.width / vw, box.height / vh);
  const ox = (box.width - vw * sc) / 2, oy = (box.height - vh * sc) / 2;
  const mx = fr.width * 0.1, my = fr.height * 0.1;
  const k = W / vw;                                   // zdjęcie może mieć większą rozdzielczość niż podgląd
  let sx = ((fr.left - box.left - mx - ox) / sc) * k, sy = ((fr.top - box.top - my - oy) / sc) * (H / vh);
  let cw = ((fr.width + 2 * mx) / sc) * k, ch = ((fr.height + 2 * my) / sc) * (H / vh);
  sx = Math.max(0, sx); sy = Math.max(0, sy); cw = Math.min(W - sx, cw); ch = Math.min(H - sy, ch);
  if (!(cw > 50 && ch > 50)) return [0, 0, W, H];
  return [sx, sy, cw, ch];
}
async function scanShot() {
  const v = $('#scanVideo');
  if (!v.videoWidth) return;
  $('#scanShot').disabled = true;
  let src = v, W = v.videoWidth, H = v.videoHeight, bmp = null;
  // prawdziwe zdjęcie (autofokus, pełna ostrość), jeśli przeglądarka pozwala — inaczej klatka z podglądu
  try {
    if (window.ImageCapture) {
      const ic = new ImageCapture(scanTrack());
      const pc = await ic.getPhotoCapabilities().catch(() => null);
      const opts = {};
      if (pc?.imageWidth?.max) opts.imageWidth = Math.min(pc.imageWidth.max, 4000);
      const blob = await ic.takePhoto(opts);
      bmp = await createImageBitmap(blob);
      // tylko jeśli proporcje zgadzają się z podglądem (wtedy ramka trafia w to samo miejsce)
      if (Math.abs(bmp.width / bmp.height - W / H) < 0.02) { src = bmp; W = bmp.width; H = bmp.height; }
    }
  } catch { /* zostaje klatka z podglądu */ }
  const [sx, sy, cw, ch] = scanCropRect(W, H);
  const c = document.createElement('canvas');
  const k = Math.min(1, 2400 / Math.max(cw, ch));
  c.width = Math.round(cw * k); c.height = Math.round(ch * k);
  c.getContext('2d').drawImage(src, sx, sy, cw, ch, 0, 0, c.width, c.height);
  bmp?.close?.();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  $('#scanShot').disabled = false;
  $('#scanDlg').close();
  if (blob) ocrUpload(blob);
}
let torchOn = false;
function scanTorch() {
  const t = scanTrack(); if (!t) return;
  torchOn = !torchOn;
  t.applyConstraints({advanced: [{torch: torchOn}]}).catch(() => {});
}
// ---------- HTTPS: stan i instrukcja ----------
async function renderTls() {
  const box = $('#tlsBox');
  try {
    const r = await api('/api/tls');
    if (!r.enabled) { box.innerHTML = '<b>Bezpieczne połączenie (HTTPS)</b><p class="hint">HTTPS jest wyłączony na serwerze (HTTPS_PORT=0).</p>'; return; }
    if (r.secure) {
      box.innerHTML = '<b>Bezpieczne połączenie (HTTPS)</b><p class="tlsok">✓ Połączenie jest szyfrowane — aparat działa w oknie apki.</p>';
      return;
    }
    box.innerHTML = `<b>Bezpieczne połączenie (HTTPS)</b>
      <p class="hint">Szyfruje hasło w sieci domowej i pozwala używać aparatu w oknie apki (skan numeru seryjnego na telefonie).</p>
      <ol class="tlssteps">
        <li><a class="btn light" href="/ca.crt" download>1. Pobierz certyfikat</a></li>
        <li><b>2. Zainstaluj go na telefonie</b>
          <details><summary>Android</summary><p class="hint">Ustawienia → Bezpieczeństwo → Więcej ustawień → Szyfrowanie i dane logowania → Zainstaluj certyfikat → Certyfikat CA → wybierz pobrany plik <i>moja-kolekcja-ca.crt</i>.</p></details>
          <details><summary>iPhone / iPad</summary><p class="hint">Otwórz pobrany plik → Ustawienia → Pobrany profil → Zainstaluj. Potem Ogólne → To urządzenie → Zaufanie certyfikatom → włącz „Moja kolekcja”.</p></details>
          <details><summary>Komputer</summary><p class="hint">Windows: dwuklik na pliku → Zainstaluj certyfikat → Zaufane główne urzędy certyfikacji. Firefox ma własne ustawienia certyfikatów.</p></details></li>
        <li>${r.https_url ? `<a class="btn crs" href="${esc(r.https_url)}">3. Otwórz wersję HTTPS</a>` : '<b>3. Otwórz apkę przez https:// i port ' + r.port + '</b>'}</li>
      </ol>
      <p class="hint">Certyfikat działa tylko dla adresów w sieci domowej — nie da się nim podrobić żadnej strony w internecie.<br>
        Odcisk SHA-256: <code class="fp">${esc(r.fingerprint || '')}</code></p>`;
  } catch (e) { box.innerHTML = `<b>Bezpieczne połączenie (HTTPS)</b><p class="hint err">${esc(e.message)}</p>`; }
}

// ---------- Narzędzia i „O aplikacji” ----------
function fmtBytes(b) {
  if (b == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${(i ? v.toFixed(v < 10 ? 1 : 0) : v).toString().replace('.', ',')} ${u[i]}`;
}
// ---------- Klucze API i hasło (Narzędzia) ----------
const KEY_LABELS = {IGDB_CLIENT_ID: 'Client ID', IGDB_CLIENT_SECRET: 'Client Secret', EBAY_CLIENT_ID: 'App ID (Client ID)',
  EBAY_CLIENT_SECRET: 'Cert ID (Client Secret)', SS_DEVID: 'Dev ID', SS_DEVPASSWORD: 'Dev password', SS_USER: 'Login ScreenScraper', SS_PASSWORD: 'Hasło ScreenScraper'};
const KEY_HELP = {igdb: 'https://dev.twitch.tv/console', ebay: 'https://developer.ebay.com/my/keys', screenscraper: 'https://www.screenscraper.fr/'};
const KEY_DESC = {igdb: 'Dane o grach, okładki, zdjęcia konsol (wymagane).', ebay: 'Sugerowana cena gier i konsol.',
  screenscraper: 'Okładki z konkretnego regionu (klucze deweloperskie z forum ScreenScraper).'};
async function renderKeys() {
  const box = $('#keysBox');
  try {
    const r = await api('/api/keys');
    $('#pwForm').hidden = r.password_env;
    if (r.password_env) $('#pwBox').insertAdjacentHTML('beforeend', '<p class="hint pwenv">Hasło jest ustawione w pliku .env (APP_PASSWORD) — zmienisz je tylko tam.</p>');
    box.innerHTML = '<b>Klucze API</b>' + Object.entries(r.services).map(([s, v]) => {
      const env = v.fields.some((f) => f.source === 'env');
      const app = v.fields.some((f) => f.source === 'app');
      const st = v.on ? '<span class="kon">✓ działa</span>' : '<span class="koff">brak kluczy</span>';
      return `<div class="krow" data-svc="${s}"><div class="khd"><b>${esc(v.label)}</b>${st}
          ${env ? '<span class="hint">z pliku .env</span>' : `<button type="button" class="btn light" data-kedit>${v.on ? 'Zmień' : 'Dodaj'}</button>`}</div>
        <p class="hint">${KEY_DESC[s]} <a href="${KEY_HELP[s]}" target="_blank" rel="noopener">Skąd wziąć klucze ↗</a></p>
        ${env ? '' : `<form class="kform" hidden>${v.fields.map((f) => `<label class="f">${KEY_LABELS[f.key]}
            <input name="${f.key}" ${/SECRET|PASSWORD/.test(f.key) ? 'type="password"' : ''} autocomplete="off" spellcheck="false" placeholder="${f.hint ? esc(f.hint) : ''}"></label>`).join('')}
          ${v.on ? '<p class="hint">Puste pole = bez zmian.</p>' : ''}
          <div class="acts"><button type="submit" class="btn crs">Zapisz i sprawdź</button>
          ${app && s !== 'igdb' ? '<button type="button" class="btn light" data-kdel>Usuń klucze</button>' : ''}</div></form>`}</div>`;
    }).join('');
  } catch (e) { box.innerHTML = `<b>Klucze API</b><p class="hint err">${esc(e.message)}</p>`; }
}
function refreshSources() { api('/api/config').then((c) => { cfg.sources = c.sources; }).catch(() => {}); }
function initKeys() {
  $('#keysBox').addEventListener('click', async (e) => {
    const row = e.target.closest('.krow'); if (!row) return;
    if (e.target.closest('[data-kedit]')) { const f = row.querySelector('.kform'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); }
    if (e.target.closest('[data-kdel]')) {
      if (!confirm('Usunąć zapisane klucze?')) return;
      try { await jsonPost(`/api/keys/${row.dataset.svc}`, {remove: true}); toast('Usunięto klucze'); renderKeys(); refreshSources(); } catch (er) { toast(er.message, true); }
    }
  });
  $('#keysBox').addEventListener('submit', async (e) => {
    e.preventDefault();
    const row = e.target.closest('.krow'); const btn = e.target.querySelector('[type=submit]');
    const values = Object.fromEntries(new FormData(e.target));
    btn.disabled = true; btn.textContent = 'Sprawdzam…';
    try {
      const r = await jsonPost(`/api/keys/${row.dataset.svc}`, {values});
      toast(r.msg || 'Zapisano');
      renderKeys();
      refreshSources();
    } catch (er) { toast(er.message, true); btn.disabled = false; btn.textContent = 'Zapisz i sprawdź'; }
  });
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.new !== f.new2) { toast('Nowe hasła się różnią', true); return; }
    try { await jsonPost('/api/password', {old: f.old, new: f.new}); e.target.reset(); toast('Hasło zmienione'); } catch (er) { toast(er.message, true); }
  });
}
async function openTools() {
  $('#toolsDlg').showModal();
  renderTls();
  renderKeys();
  const box = $('#diskBox');
  box.innerHTML = '<b>Miejsce na serwerze</b><p class="hint">Sprawdzam…</p>';
  try {
    const r = await api('/api/system');
    const used = r.disk.total - r.disk.free;
    const pct = Math.round((used / r.disk.total) * 100);
    const max = Math.max(1, ...r.parts.map((p) => p.bytes));
    box.innerHTML = `<b>Miejsce na serwerze</b>
      <div class="dbar${pct >= 90 ? ' full' : ''}"><i style="width:${pct}%"></i></div>
      <p class="dsum"><span>Wolne: <b>${fmtBytes(r.disk.free)}</b></span><span>z ${fmtBytes(r.disk.total)} · zajęte ${pct}%</span></p>
      <p class="hint">Dane aplikacji: <b>${fmtBytes(r.app_bytes)}</b></p>
      <div class="dparts">${r.parts.filter((p) => p.bytes > 0 || p.key === 'db').map((p) => `<div class="dp"><span>${esc(p.label)}</span>
        <span class="dpb"><i style="width:${Math.max(2, (p.bytes / max) * 100)}%"></i></span><b>${fmtBytes(p.bytes)}</b></div>`).join('')}</div>`;
  } catch (e) { box.innerHTML = `<b>Miejsce na serwerze</b><p class="hint err">${esc(e.message)}</p>`; }
}
function openAbout() {
  if (window.APP_VERSION) $('#abVer').textContent = window.APP_VERSION;
  $('#aboutDlg').showModal();
  logClientEvent('about');
}
function logClientEvent(type) { jsonPost('/api/events', {type}).then(() => checkTrophies()).catch(() => {}); }

// ---------- „Twój rok w grach” ----------
const MONTHS_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
let wrap = null;
let wrapIdx = 0;
let wrapTimer = null;
function wrappedLb(lb) {
  const d = new Date();
  const y = d.getMonth() === 11 ? d.getFullYear() : d.getMonth() === 0 ? d.getFullYear() - 1 : null;
  return y ? lb('wrapped', `<span class="ic">${CUP}</span>`, `Rok ${y} w grach`, '▶', '#4b77c9') : '';
}
async function openWrapped(year = null) {
  showSub('wrapPage', year ? `#rok/${year}` : '#rok');
  $('#wrapPage').innerHTML = '<div class="empty">Liczę…</div>';
  try { wrap = await api('/api/wrapped' + (year ? `?year=${year}` : '')); } catch (e) { $('#wrapPage').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  wrapIdx = 0;
  renderWrapped();
  startWrapTimer();
  checkTrophies();
}
function wrapSlides(w) {
  const S = [];
  S.push({k: 'TWÓJ ROK W GRACH', big: String(w.year), sub: 'Naciśnij ▶, żeby zobaczyć podsumowanie', cls: 'intro'});
  S.push({k: 'KUPIONE', big: num0(w.bought), sub: [plural(w.games, 'gra', 'gry', 'gier'), w.consoles ? plural(w.consoles, 'konsola', 'konsole', 'konsol') : '', w.accessories ? plural(w.accessories, 'akcesorium', 'akcesoria', 'akcesoriów') : ''].filter(Boolean).join(' · ')});
  if (w.spent) S.push({k: 'WYDANE', big: zl(w.spent), sub: w.bought ? `średnio ${zl(w.spent / w.bought)} za pozycję` : ''});
  if (w.priciest) S.push({k: 'NAJDROŻSZY ZAKUP', big: zl(w.priciest.price), sub: `${w.priciest.title}${w.priciest.platform ? ' · ' + w.priciest.platform : ''}`});
  if (w.top_platform) S.push({k: 'ULUBIONA PLATFORMA', big: w.top_platform.name, notr: true, sub: plural(w.top_platform.count, 'nowa gra', 'nowe gry', 'nowych gier'), small: true});
  if (w.best_month) S.push({k: 'MIESIĄC ZAKUPÓW', big: MONTHS_PL[w.best_month.month - 1], sub: plural(w.best_month.count, 'zakup', 'zakupy', 'zakupów'), small: true});
  if (w.first) S.push({k: 'PIERWSZY ZAKUP ROKU', big: w.first.title, notr: true, sub: w.first.date, small: true});
  S.push({k: 'UKOŃCZONE', big: num0(w.completed), sub: w.best_rated ? `najwyżej oceniona: ${w.best_rated.title} (${String(w.best_rated.rating / 2).replace('.', ',')} ★)` : 'napisy końcowe w tym roku'});
  if (settings.shame && (w.shame_add || w.shame_done)) S.push({k: 'KUPKA WSTYDU', big: `+${w.shame_add} / −${w.shame_done}`, sub: 'dołożone / zdjęte z kupki'});
  if (w.loans || w.wish_bought) S.push({k: 'POŻYCZONE / SPEŁNIONE', big: `${w.loans} / ${w.wish_bought}`, sub: 'wypożyczone gry / spełnione pozycje z listy życzeń'});
  if (w.sold) S.push({k: 'SPRZEDAŻ', big: num0(w.sold), sub: [`sprzedano za ${zl(w.sold_sum || 0)}`, w.profit_known ? `${w.profit >= 0 ? 'zysk' : 'strata'} ${zl(Math.abs(w.profit))}` : ''].filter(Boolean).join(' · ')});
  if (w.trophies) S.push({k: 'TROFEA', big: num0(w.trophies), sub: 'zdobytych w tym roku'});
  if (w.value_end != null) S.push({k: 'WARTOŚĆ KOLEKCJI', big: zl(w.value_end), sub: w.value_start != null && w.value_start !== w.value_end ? `${w.value_end >= w.value_start ? '+' : '−'}${zl(Math.abs(w.value_end - w.value_start))} od początku roku` : ''});
  S.push({k: 'KONIEC', big: 'GG', sub: 'Do zobaczenia za rok!', cls: 'outro'});
  return S;
}
function renderWrapped() {
  const w = wrap; if (!w) return;
  const S = wrapSlides(w);
  wrapIdx = Math.max(0, Math.min(wrapIdx, S.length - 1));
  const s = S[wrapIdx];
  $('#wrapPage').innerHTML = `<div class="st-head"><button class="btn light" data-back>← Wróć</button><h2>ROK W GRACH</h2>
      <select class="sel" id="wrapYear" aria-label="Rok">${w.years.map((y) => `<option${y === w.year ? ' selected' : ''}>${y}</option>`).join('')}</select></div>
    <div class="wscreen"><div class="wscr ${s.cls || ''}"><div class="wk">${esc(s.k)}</div><div class="wbig${s.small ? ' small' : ''}"${s.notr ? ' data-notr' : ''}>${esc(s.big)}</div><div class="wsub">${esc(s.sub || '')}</div></div>
      <div class="wctl"><button class="btn light" data-w="-1" aria-label="Wstecz">◀</button>
        <span class="wdots">${S.map((_, i) => `<i${i === wrapIdx ? ' class="on"' : ''} data-wi="${i}"></i>`).join('')}</span>
        <button class="btn cir" data-w="1" aria-label="Dalej">▶</button></div></div>
    <div class="wgrid">${S.slice(1, -1).map((x) => `<div class="kpi"><div class="scr"><div class="kl">${esc(x.k)}</div><div class="kb${x.small ? ' sm' : ''}"${x.notr ? ' data-notr' : ''}>${esc(x.big)}</div><div class="ks">${esc(x.sub || '')}</div></div></div>`).join('')}</div>`;
}
function startWrapTimer() {
  clearInterval(wrapTimer);
  if (reducedMotion()) return;
  wrapTimer = setInterval(() => {
    if ($('#wrapPage').hidden || !wrap) { clearInterval(wrapTimer); return; }
    const n = wrapSlides(wrap).length;
    if (wrapIdx >= n - 1) { clearInterval(wrapTimer); return; }
    wrapIdx++; renderWrapped();
  }, 4500);
}

// ---------- inicjalizacja ----------
function initMore() {
  $('#curApply').addEventListener('click', changeCurrency);
  $('#saleSuggest').addEventListener('click', saleSuggest);
  $('#saleSave').addEventListener('click', saleSave);
  const copy = async (el) => { try { await navigator.clipboard.writeText(el.value); } catch { el.select(); document.execCommand('copy'); } toast('Skopiowano'); };
  $('#adCopyT').addEventListener('click', () => copy($('#adTitle')));
  $('#adCopyB').addEventListener('click', () => copy($('#adBody')));
  $('#soldPrice').addEventListener('input', soldProfitHint);
  $('#soldForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const it = saleItem; if (!it) return;
    try {
      await jsonPost(`/api/items/${it.id}/sold`, {price: Number($('#soldPrice').value || 0), sold_on: $('#soldDate').value || null, sold_to: $('#soldTo').value.trim() || null});
      $('#soldDlg').close(); toast(`Sprzedana: ${it.title}`);
      selected = null; document.body.classList.remove('show-detail'); await load();
    } catch (err) { toast(err.message, true); }
  });
  $('#camIn').addEventListener('change', (e) => { ocrUpload(e.target.files[0]); e.target.value = ''; });
  $('#camBtn').addEventListener('click', camClick);
  $('#scanShot').addEventListener('click', scanShot);
  $('#scanTorch').addEventListener('click', scanTorch);
  $('#scanBox').addEventListener('click', scanTapFocus);
  $('#scanZoom').addEventListener('input', (e) => scanTrack()?.applyConstraints({advanced: [{zoom: +e.target.value}]}).catch(() => {}));
  $('#scanFocusDist').addEventListener('input', (e) => scanTrack()?.applyConstraints({advanced: [{focusMode: 'manual', focusDistance: +e.target.value}]}).catch(() => {}));
  $('#scanDlg').addEventListener('close', stopScanner);
  $('#camHelpGal').addEventListener('click', () => { $('#camHelpDlg').close(); $('#galIn').click(); });
  $('#camHelpNative').addEventListener('click', () => { $('#camHelpDlg').close(); $('#camIn').click(); });
  $('#camHelpTls').addEventListener('click', () => { $('#camHelpDlg').close(); openTools(); setTimeout(() => $('#tlsBox').scrollIntoView({block: 'start'}), 400); });
  $('#galIn').addEventListener('change', (e) => { ocrUpload(e.target.files[0]); e.target.value = ''; });
  $('#camIn').addEventListener('click', () => { try { sessionStorage.setItem('ocrPending', String(Date.now())); } catch { /* nic */ } });
  window.addEventListener('focus', () => setTimeout(() => { try { sessionStorage.removeItem('ocrPending'); } catch { /* nic */ } }, 4000));
  ocrResume();
  // menu: zamykaj po kliknięciu obok i klawiszem Esc
  document.addEventListener('click', (e) => { const m = $('.menu'); if (m.open && !e.target.closest('.menu')) m.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('.menu').open = false; });
  initKeys();
  $('#toolsDlg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    const t = b.dataset.tool;
    if (t === 'csv') location.href = '/api/export.csv';
    if (t === 'backup') location.href = '/api/backup.json';
    if (t === 'report') { $('#toolsDlg').close(); $('#repDlg').showModal(); }
    if (t === 'restore') { $('#toolsDlg').close(); $('#restoreFile').click(); }
    if (t === 'lb') { $('#toolsDlg').close(); startLb(); }
  });
  $('#repPhotos').addEventListener('change', (e) => { $('#repGo').href = `/api/report.pdf?photos=${e.target.checked}`; });
  $('#repGo').addEventListener('click', () => { toast('Generuję PDF…'); setTimeout(() => { $('#repDlg').close(); checkTrophies(); }, 1500); });
  $('#wrapPage').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { clearInterval(wrapTimer); closeSubpages(); render(); return; }
    const b = e.target.closest('[data-w]'); if (b) { clearInterval(wrapTimer); wrapIdx += +b.dataset.w; renderWrapped(); return; }
    const d = e.target.closest('[data-wi]'); if (d) { clearInterval(wrapTimer); wrapIdx = +d.dataset.wi; renderWrapped(); }
  });
  $('#wrapPage').addEventListener('change', (e) => { if (e.target.id === 'wrapYear') openWrapped(+e.target.value); });
  document.addEventListener('keydown', (e) => {
    if ($('#wrapPage').hidden || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') { clearInterval(wrapTimer); wrapIdx++; renderWrapped(); }
    if (e.key === 'ArrowLeft') { clearInterval(wrapTimer); wrapIdx--; renderWrapped(); }
  });
  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#rok(?:\/(\d{4}))?$/);
    if (m) openWrapped(m[1] ? +m[1] : null);
  });
}
function routeMore() {
  const m = location.hash.match(/^#rok(?:\/(\d{4}))?$/);
  if (m) openWrapped(m[1] ? +m[1] : null);
}
