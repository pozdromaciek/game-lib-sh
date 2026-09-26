/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';

// ================= narzędzia =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
let CUR = 'PLN';
const CUR_SYM = {PLN: 'zł', EUR: '€'};
const curSym = () => CUR_SYM[CUR] || CUR;
const zl = (n) => new Intl.NumberFormat('pl-PL', {maximumFractionDigits: 0}).format(n || 0) + ' ' + curSym();
const num0 = (n) => new Intl.NumberFormat('pl-PL', {maximumFractionDigits: 0}).format(n || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysSince = (d) => Math.max(0, Math.round((Date.parse(today()) - Date.parse(d)) / 86400000));
const ago = (d) => (d <= 0 ? 'od dziś' : plural(d, 'dzień', 'dni', 'dni'));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plural = (n, one, few, many) => {
  const d = n % 10, h = n % 100;
  return `${n} ${n === 1 ? one : (d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? few : many}`;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* brak storage */ } },
};
const narrow = () => matchMedia('(max-width: 1180px)').matches;
const small = () => matchMedia('(max-width: 760px)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const STATUS = {backlog: 'Do zagrania', playing: 'Gram', completed: 'Ukończona', dropped: 'Porzucona'};
const STATUS_CLS = {backlog: '', playing: 'info', completed: 'info', dropped: 'bad'};
const KIND = {game: 'Gra', console: 'Konsola', accessory: 'Akcesorium'};
const KIND_TABS = [['game', 'Gry'], ['console', 'Konsole'], ['accessory', 'Akcesoria']];
const LANG_LABEL = {PL: 'PL', EN: 'EN', DE: 'DE', FR: 'FR', ES: 'ES', IT: 'IT', MULTI: 'Multi', INNY: 'Inny'};
const SPECIALS = ['Steelbook', 'Obwoluta', 'Edycja kolekcjonerska', 'Limitowana', 'Big box', 'Mapa / plakat', 'Soundtrack'];
const NO_PLATFORM = 'Inne';
const OTHER = '__other';
const FIELD = {rating: 'Ocena', price_paid: 'Cena zakupu', value: 'Wartość', title: 'Nazwa', release_year: 'Rok wydania',
  target_price: 'Cena docelowa', purchased_on: 'Data zakupu'};

// nakładka (pasek konsoli) + proporcje nośnika (gdy nie znamy prawdziwych wymiarów skanu)
const FRAME = {
  'PlayStation': 'ps1', 'PlayStation 2': 'ps2', 'PlayStation 3': 'ps3', 'PlayStation 4': 'ps4',
  'PlayStation 5': 'ps5', 'Xbox': 'xbox', 'Xbox 360': 'x360', 'PSP': 'psp',
  'Game Boy Advance': 'gba', 'Nintendo Switch': 'sw',
};
const BAND = {ps1: 'PlayStation', ps2: 'PlayStation 2', ps3: 'PS3', ps4: 'PS4', ps5: 'PS5', xbox: 'XBOX',
  x360: 'XBOX 360', psp: 'PSP', gba: 'GAME BOY ADVANCE', sw: 'NINTENDO SWITCH'};
const RATIO = {
  'PlayStation': 1, 'PlayStation 2': 0.71, 'PlayStation 3': 0.8, 'PlayStation 4': 0.8, 'PlayStation 5': 0.8,
  'PSP': 0.59, 'PS Vita': 0.78, 'Xbox': 0.71, 'Xbox 360': 0.71, 'Xbox One': 0.8, 'Xbox Series X|S': 0.8,
  'GameCube': 0.71, 'Wii': 0.71, 'Wii U': 0.8, 'Nintendo Switch': 0.62, 'Nintendo DS': 0.88, 'Nintendo 3DS': 0.88,
  'Game Boy': 0.9, 'Game Boy Color': 0.9, 'Game Boy Advance': 0.89, 'NES': 0.72, 'SNES': 0.72, 'Nintendo 64': 0.72,
  'Sega Mega Drive': 0.7, 'Sega Dreamcast': 1, 'PC': 0.71,
};
const PCOLOR = {
  'PlayStation': '#8a8a8a', 'PlayStation 2': '#0b0b0b', 'PlayStation 3': '#444', 'PlayStation 4': '#003791',
  'PlayStation 5': '#2463d6', 'PSP': '#050505', 'PS Vita': '#1f4fbf', 'Xbox': '#1f6b16', 'Xbox 360': '#5dc21e',
  'Xbox One': '#107c10', 'Xbox Series X|S': '#107c10', 'Nintendo Switch': '#e60012', 'Wii': '#9aa0a6',
  'Wii U': '#009ac7', 'GameCube': '#5b4a9c', 'Nintendo 64': '#e4b021', 'SNES': '#6b5fa8', 'NES': '#c4161c',
  'Game Boy': '#8b8b8b', 'Game Boy Color': '#6b4bb4', 'Game Boy Advance': '#2b3a9a', 'Nintendo DS': '#9aa0a6',
  'Nintendo 3DS': '#d12228', 'Sega Mega Drive': '#111', 'Sega Dreamcast': '#f26722', 'PC': '#333',
};

// ================= ikony =================
function pixelSvg(map, colors, cls) {
  let r = '';
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {  // łączymy poziome ciągi pikseli w jeden prostokąt
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (colors[c]) r += `<rect x="${x}" y="${y}" width="${w}" height="1.02" fill="${colors[c]}"/>`;
      x += w;
    }
  });
  return `<svg class="${cls}" viewBox="0 0 16 ${map.length}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
const POOP = pixelSvg([
  '........#.......',
  '.......h#.......',
  '......h###......',
  '.....h#####.....',
  '....h#######....',
  '...h#########...',
  '....h######d....',
  '..h##########d..',
  '.h##ww####ww##d.',
  '.h##wk####wk##d.',
  'h####kkkkkk####d',
  'h#####kkkk#####d',
  '.dddddddddddddd.',
], {'#': '#8b5a2b', h: '#b8834e', d: '#5e3a17', w: '#fff', k: '#2a1a0c'}, 'px poop');
const ICON = {
  disc: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" fill="currentColor" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>',
  box: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="1.5" width="11" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="2" y="1" width="3.2" height="14" fill="currentColor"/></svg>',
  manual: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3C3.8 1.9 6.3 2 8 3.4 9.7 2 12.2 1.9 14.5 3v11c-2.3-1-4.8-.9-6.5.5C6.3 13.1 3.8 13 1.5 14z"/><path d="M8 4v9.6" stroke="#fff" stroke-opacity=".7" stroke-width="1"/></svg>',
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .8l2.2 4.6 5 .6-3.7 3.5 1 5L8 12l-4.5 2.5 1-5L.8 6l5-.6z"/></svg>',
};

// ikony akcesoriów bez zdjęcia — wg typu (linie 24×24, kolor z CSS)
const ACC_SVG = {
  pad: '<path d="M6 9h12a4 4 0 0 1 3.9 4.8l-.8 3.6a2 2 0 0 1-3.5.8L15.5 16h-7l-2.1 2.2a2 2 0 0 1-3.5-.8l-.8-3.6A4 4 0 0 1 6 9z"/><path d="M7 11.5v3M5.5 13h3"/><circle cx="16" cy="12" r=".9" fill="currentColor"/><circle cx="18.2" cy="13.8" r=".9" fill="currentColor"/>',
  card: '<path d="M7 3h8l3 3v15H7z"/><path d="M9.5 3v3.5M12 3v3.5M14.5 3v3.5"/><rect x="9.5" y="12" width="6" height="5" rx=".6"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.8h6.3M13.9 10.8h6.3M12 14v6.3"/>',
  gun: '<path d="M3 8h15l2 2v3h-8l-1.4 3.4L9.5 20H5.6l1.2-5.4L3 12z"/><path d="M11 13l1.4 2.4"/>',
  stick: '<rect x="3" y="15" width="18" height="5" rx="1"/><path d="M12 15V8"/><circle cx="12" cy="5.8" r="2.6"/><circle cx="17" cy="17.5" r=".9" fill="currentColor"/>',
  tap: '<rect x="3" y="8" width="18" height="10" rx="1.5"/><path d="M6.5 12h2M10.8 12h2.4M15.5 12h2M6.5 14.5h2M10.8 14.5h2.4M15.5 14.5h2"/><path d="M12 8V3.5"/>',
  cable: '<path d="M5 18.5c0-6 3.5-6.5 7-6.5s7-.5 7-6.5"/><rect x="3.3" y="18" width="3.4" height="4" rx=".6"/><rect x="17.3" y="2" width="3.4" height="4" rx=".6"/>',
  psu: '<rect x="4" y="6" width="12" height="12" rx="1.5"/><path d="M16 12h3a2 2 0 0 1 2 2v6.5"/><path d="M7.5 3v3M12.5 3v3"/><path d="M10.8 8.8l-2 3.4h3l-2 3.6"/>',
  cam: '<rect x="5" y="4.5" width="14" height="10" rx="5"/><circle cx="12" cy="9.5" r="2.8"/><path d="M9 14.5l-1 5.5h8l-1-5.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
  phones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>',
  remote: '<rect x="8" y="2.5" width="8" height="19" rx="2"/><circle cx="12" cy="7" r="1.6"/><path d="M10.5 11.5h3M10.5 14h3M10.5 16.5h3"/>',
  charger: '<rect x="7" y="4" width="10" height="16" rx="1.5"/><path d="M12.6 7.8l-2.6 4.2h3.6L11 16.6"/>',
  adapter: '<path d="M3 9h6v6H3zM15 9h6v6h-6z"/><path d="M9 12h6M5 11v2M19 11v2"/>',
  shell: '<rect x="4" y="5" width="16" height="14" rx="3"/><rect x="7" y="8" width="10" height="8" rx="1.5"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
};
const ACC_MATCH = [
  [/pad|kontroler|controller|dual ?shock|dual ?sense|joy-?con|gamepad/, 'pad'], [/kart|memory|vmu/, 'card'],
  [/kierown|wheel|pedał|pedal/, 'wheel'], [/pistolet|gun|guncon|zapper/, 'gun'], [/joystick|arcade|stick|fight/, 'stick'],
  [/multitap|rozgałęź/, 'tap'], [/kabel|cable|av|rgb|scart|hdmi|link/, 'cable'], [/zasilacz|power|psu|ac adapter/, 'psu'],
  [/kamer|camera|eye/, 'cam'], [/mikrofon|mic/, 'mic'], [/słuchaw|headset|headphone/, 'phones'], [/pilot|remote|media/, 'remote'],
  [/ładowar|charg|stacj|dock/, 'charger'], [/przejści|adapter|konwert/, 'adapter'], [/nakład|etui|case|pokrow|torba|obudow/, 'shell'],
];
function accIcon(it) {
  const t = `${it.acc_type || ''} ${it.title || ''}`.toLowerCase();
  const key = (ACC_MATCH.find(([re]) => re.test(t)) || [null, 'box'])[1];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACC_SVG[key]}</svg>`;
}

// ================= stan =================
let all = [];                // wszystko z API
let soldItems = [];          // sprzedane (archiwum)
let items = [];              // posiadane
let wishes = [];             // lista życzeń
let cfg = {platforms: [], cover_langs: [], editions: [], sources: {}};
let settings = {shame: false, theme: 'ps1'};
const view = {platform: null, kind: 'game', status: null, other: null, complete: null, list: null};
let selected = null;
let editing = null;          // id edytowanej pozycji
let kind = 'game';           // typ w formularzu
let wishMode = false;        // formularz: lista życzeń
let buying = false;          // formularz: „Kupiłem”
let pending = {};            // okładka wybrana w formularzu: {coverUrl, framed, igdbId, lbId, variants}
let lbStatus = null, lbPoll = null;
const AR = new Map();        // src → proporcje (podgląd w formularzu)

// ================= API =================
async function api(path, opts = {}) {
  let r;
  try { r = await fetch(path, opts); } catch (e) {
    if (e.name === 'AbortError') throw new Error('Serwer nie odpowiedział na czas — spróbuj jeszcze raz');
    throw new Error('Brak połączenia z serwerem — sprawdź Wi-Fi');
  }
  if (r.status === 401) { location.href = '/login'; throw new Error('401'); }
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json()).detail; } catch { /* nie JSON */ }
    if (!msg) msg = r.status === 413 ? 'Plik jest za duży' : r.status >= 500 ? `Błąd serwera (${r.status}) — szczegóły w logach` : `Błąd ${r.status} ${r.statusText || ''}`.trim();
    if (Array.isArray(msg)) msg = msg.map((d) => { const f = d.loc?.at(-1); return `${FIELD[f] || f}: ${d.msg}`; }).join('; ');
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return r.status === 204 ? null : r.json();
}
const jsonPost = (path, body, method = 'POST') => api(path, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
// każdy nieobsłużony błąd ma być widoczny, a nie ginąć w konsoli
window.addEventListener('unhandledrejection', (e) => {
  const m = e.reason?.message || String(e.reason || '');
  if (m && m !== '401' && typeof toast === 'function') toast(m, true);
});
window.addEventListener('error', (e) => {
  if (e.message && !/ResizeObserver|Script error/.test(e.message) && typeof toast === 'function') toast('Błąd w aplikacji: ' + e.message, true);
});
function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 5000 : 2400);
}

// ================= logika =================
const isGame = (it) => it.kind === 'game';
const dupeKey = (it) => `${it.igdb_id || it.title.trim().toLowerCase()}|${it.platform || ''}`;
function isDupe(it) {
  if (!isGame(it) || it.wish || it.sold_on) return false;
  return items.filter((i) => isGame(i) && dupeKey(i) === dupeKey(it)).length > 1;
}
const platOf = (it) => it.platform || NO_PLATFORM;
const coverSrc = (it) => (it.cover ? `/covers/${encodeURIComponent(it.cover)}` : null);
const isLate = (loan) => loan && loan.due_on && loan.due_on < today();
const onShame = (it) => settings.shame && !it.wish && isGame(it) && !!it.shame_since;
const find = (id) => all.find((i) => i.id === id);

function completeness(it) {
  if (isGame(it)) {
    if (!it.has_disc) return {key: 'nodisc', label: 'Bez płyty', cls: 'bad'};
    if (it.has_box && it.has_manual) return {key: 'cib', label: 'CIB', cls: 'ok'};
    if (it.has_box) return {key: 'nomanual', label: 'Bez instrukcji', cls: 'warn'};
    return {key: 'loose', label: 'Luzem', cls: 'bad'};
  }
  if (it.has_box && it.has_manual) return {key: 'cib', label: 'Komplet', cls: 'ok'};
  if (it.has_box) return {key: 'nomanual', label: 'W pudełku', cls: 'warn'};
  return {key: 'loose', label: 'Bez pudełka', cls: ''};
}
function compIcons(it) {
  const i = (on, icon, label) => `<span class="ico${on ? '' : ' off'}" title="${label}: ${on ? 'jest' : 'brak'}">${icon}</span>`;
  return `<span class="icos">${isGame(it) ? i(it.has_disc, ICON.disc, 'Płyta / kartridż') : ''}${i(it.has_box, ICON.box, 'Pudełko')}${i(it.has_manual, ICON.manual, 'Instrukcja')}</span>`;
}
function starsRo(v) {
  if (!v) return '—';
  return `<span class="stars-ro" style="--p:${v * 10}%" title="${String(v / 2).replace('.', ',')} / 5">★★★★★</span>`;
}

// proporcje kafelka: skan bez paska → prawdziwe wymiary; z paskiem → nośnik konsoli
function coverAr(it, src, framed, nat) {
  if (!isGame(it)) return src && nat ? clamp(nat, 0.6, 1.8) : 4 / 3;
  if (framed && FRAME[it.platform]) return RATIO[it.platform] || 0.75;
  if (src && nat) return clamp(nat, 0.5, 1.6);
  return RATIO[it.platform] || 0.75;
}
function cover(it, h, extra = {}) {
  const hw = !isGame(it);
  const plat = it.platform;
  const src = extra.src !== undefined ? extra.src : coverSrc(it);
  const framed = extra.frame !== undefined ? extra.frame : (it.cover_frame || !src);
  const fk = !hw && framed ? FRAME[plat] : null;
  const nat = extra.ar !== undefined ? extra.ar : (src && src === coverSrc(it) ? it.cover_ar : null);
  const ar = coverAr(it, src, framed, nat);
  const art = src
    ? `<span class="art" style="background-image:url('${esc(src)}')"></span>`
    : it.kind === 'accessory'
      ? `<span class="ph acc"><span class="aci">${accIcon(it)}</span><span class="acl">${esc(it.acc_type || it.title || '')}</span></span>`
      : `<span class="ph" style="--pc:${PCOLOR[plat] || '#555'}">${esc(it.title || '')}</span>`;
  const loan = it.loan && !extra.noTags
    ? `<span class="ribbon${isLate(it.loan) ? ' late' : ''}">□ ${esc(it.loan.borrower)}</span>` : '';
  const tags = extra.noTags ? '' : [
    onShame(it) ? `<span class="tg shame" title="Kupka wstydu od ${esc(it.shame_since)}">${POOP}</span>` : '',
    ...(it.special || []).slice(0, 1).map((s) => `<span class="tg spec">${esc(s)}</span>`),
    it.cover_lang ? `<span class="tg lang">${esc(LANG_LABEL[it.cover_lang] || it.cover_lang)}</span>` : '',
  ].join('');
  return `<span class="cov${hw ? ' hw' : ''}${fk ? ' f-' + fk : ''}${it.loan && !extra.noTags ? ' lent' : ''}" style="--h:${h}px;--ar:${ar}">
    ${art}${fk ? `<span class="band">${BAND[fk]}</span>` : ''}${fk === 'gba' ? '<span class="corner">ONLY<br>FOR</span>' : ''}
    ${loan}${tags ? `<span class="ctags">${tags}</span>` : ''}</span>`;
}

function sorted(list) {
  const s = $('#sort').value;
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'pl', {sensitivity: 'base'});
  const cmp = {
    title: byTitle,
    added: (a, b) => b.id - a.id,
    value: (a, b) => ((b.wish ? b.target_price : b.value) ?? -1) - ((a.wish ? a.target_price : a.value) ?? -1) || byTitle(a, b),
    year: (a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999) || byTitle(a, b),
  }[s] || byTitle;
  return [...list].sort(cmp);
}

function baseList() {
  if (view.list === 'wish') return wishes;
  if (view.list === 'shame') return items.filter(onShame);
  if (view.list === 'loans') return items.filter((i) => i.loan);
  if (view.list === 'sale') return items.filter((i) => i.for_sale);
  if (view.list === 'sold') return soldItems;
  return items;
}
function inPlatform(it) { return !view.platform || platOf(it) === view.platform; }
function passes(it, ignore = '') {
  const q = $('#q').value.trim().toLowerCase();
  if (q && ![it.title, it.edition, it.model, it.acc_type, it.platform, it.notes, it.loan?.borrower, ...(it.special || [])]
    .some((v) => (v || '').toLowerCase().includes(q))) return false;
  if (ignore !== 'status' && view.status && (!isGame(it) || it.status !== view.status)) return false;
  if (ignore !== 'complete' && view.complete && completeness(it).key !== view.complete) return false;
  if (ignore !== 'other' && view.other) {
    const o = view.other;
    if (o === 'loan' && !it.loan) return false;
    if (o === 'special' && !(it.special || []).length) return false;
    if (o === 'dupe' && !isDupe(it)) return false;
    if (o.startsWith('lang:') && it.cover_lang !== o.slice(5)) return false;
    if (o.startsWith('type:') && (it.acc_type || '') !== o.slice(5)) return false;
  }
  return true;
}

// ================= ekran LCD =================
let lcdState = 'idle';       // idle → booting → on
function lcdValues() {
  const n = (k) => items.filter((i) => i.kind === k).length;
  return [['GRY', n('game')], ['KONSOLE', n('console')], ['AKCESORIA', n('accessory')],
    ['WARTOŚĆ', items.reduce((a, i) => a + (i.value || 0), 0), true]];
}
function lcdText(t = 1) {
  return lcdValues().map(([l, v, money]) => `<span>${l} ${money ? esc(zl(Math.round(v * t)).toUpperCase()) : Math.round(v * t)}</span>`).join('');
}
async function bootLcd() {
  const wrap = $('#lcd'), scr = $('#lcdScr');
  lcdState = 'booting';
  scr.innerHTML = lcdText();                         // szerokość docelowa — ekran nie skacze
  scr.style.minWidth = scr.offsetWidth + 'px';
  scr.innerHTML = '';
  wrap.classList.add('off');
  await sleep(280);
  wrap.classList.remove('off'); wrap.classList.add('on', 'flick');
  scr.innerHTML = '<span class="bootmsg">MOJA KOLEKCJA</span>';
  await sleep(520);
  for (let i = 0; i <= 12; i++) {
    scr.innerHTML = `<span class="bootmsg">WCZYTUJĘ ${'█'.repeat(i)}${'░'.repeat(12 - i)}</span>`;
    await sleep(38);
  }
  wrap.classList.remove('flick');
  const t0 = performance.now(), D = 750;
  await new Promise((res) => {
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D);
      scr.innerHTML = lcdText(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  scr.style.minWidth = '';
  lcdState = 'on';
  renderLcd();
}
function renderLcd() {
  if (lcdState === 'booting' || (typeof lcdSpin !== 'undefined' && lcdSpin)) return;
  if (lcdState === 'idle') {
    if (reducedMotion()) { lcdState = 'on'; $('#lcd').classList.add('on'); } else { bootLcd(); return; }
  }
  lcdFit(lcdText());
}
// za mało miejsca (telefon) → tekst przewija się jak na starym wyświetlaczu
function lcdFit(html) {
  const scr = $('#lcdScr');
  scr.classList.remove('marq');
  scr.innerHTML = html;
  if (reducedMotion() || scr.scrollWidth <= scr.clientWidth + 2) return;
  scr.classList.add('marq');
  scr.innerHTML = `<span class="mq"><span class="mqi">${html}</span><span class="mqi" aria-hidden="true">${html}</span></span>`;
  const w = scr.querySelector('.mqi').offsetWidth;
  scr.querySelector('.mq').style.animationDuration = `${Math.max(6, w / 45)}s`;
}
window.addEventListener('resize', () => { clearTimeout(window.__lcdR); window.__lcdR = setTimeout(() => { if (lcdState === 'on') renderLcd(); }, 250); });

// ================= render =================
function renderSide() {
  // listy nad konsolami
  const lb = (key, icon, label, n, color) => `<button class="cart list" data-list="${key}" aria-pressed="${view.list === key}">
    <span class="lbl" style="--c:${color}"><span class="li">${icon}${esc(label)}</span> <span>${n}</span></span></button>`;
  $('#lists').innerHTML = lb('wish', `<span class="ic star">${ICON.star}</span>`, 'Lista życzeń', wishes.length, '#d9a21b')
    + (settings.shame ? lb('shame', `<span class="ic">${POOP}</span>`, 'Kupka wstydu', items.filter(onShame).length, '#8b5a2b') : '')
    + (items.some((i) => i.for_sale) ? lb('sale', `<span class="ic sale">○</span>`, 'Na sprzedaż', items.filter((i) => i.for_sale).length, '#e7555a') : '')
    + (soldItems.length ? lb('sold', `<span class="ic sale">✓</span>`, 'Sprzedane', soldItems.length, '#8a8580') : '')
    + (items.some((i) => i.loan) ? lb('loans', `<span class="ic sqi">□</span>`, 'Wypożyczone', items.filter((i) => i.loan).length, '#c7619f') : '')
    + (typeof wrappedLb === 'function' ? wrappedLb(lb) : '')
    + (typeof colls !== 'undefined' ? lb('colls', `<span class="ic">${ICON.box}</span>`, 'Kolekcje', colls.length, '#4b77c9') : '')
    + (typeof trophyState !== 'undefined' ? lb('troph', `<span class="ic">${CUP}</span>`, 'Trofea', `${trophyState.have}/${trophyState.total}`, '#d9a21b') : '')
    + (typeof friends !== 'undefined' ? lb('friends', `<span class="ic">${FRIEND_ICON}</span>`, 'Znajomi', friends.length, '#3cb98a') : '');

  const counts = new Map();
  for (const it of items) counts.set(platOf(it), (counts.get(platOf(it)) || 0) + 1);
  const plats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'));
  $('#carts').innerHTML = [[null, 'Wszystkie', items.length, '#1d1d22'], ...plats.map(([p, n]) => [p, p, n, PCOLOR[p] || '#888'])]
    .map(([val, label, n, c]) => `<button class="cart" data-p="${esc(val ?? '')}" aria-pressed="${!view.list && view.platform === val}">
      <span class="lbl" style="--c:${c}">${esc(label)} <span>${n}</span></span></button>`).join('');

  const scope = baseList().filter((it) => inPlatform(it) && it.kind === view.kind);
  const chip = (group, val, label, n) => `<button class="chip" data-g="${group}" data-v="${esc(val)}" aria-pressed="${view[group] === val}">${esc(label)}${n !== undefined ? ` <b>${n}</b>` : ''}</button>`;

  const wishView = view.list === 'wish';
  $('#statusBox').hidden = view.kind !== 'game' || wishView;
  $('#completeBox').hidden = wishView;
  $('#fStatus').innerHTML = Object.entries(STATUS).map(([k, l]) => chip('status', k, l, scope.filter((i) => i.status === k && passes(i, 'status')).length)).join('');

  const other = [];
  const loans = scope.filter((i) => i.loan).length;
  if (loans) other.push(chip('other', 'loan', 'Wypożyczone', loans));
  const dupes = scope.filter(isDupe).length;
  if (dupes) other.push(chip('other', 'dupe', 'Duble', dupes));
  const specs = scope.filter((i) => (i.special || []).length).length;
  if (specs) other.push(chip('other', 'special', 'Wydania specjalne', specs));
  const langs = new Map();
  for (const i of scope) if (i.cover_lang) langs.set(i.cover_lang, (langs.get(i.cover_lang) || 0) + 1);
  for (const [l, n] of langs) other.push(chip('other', 'lang:' + l, 'Okładka ' + (LANG_LABEL[l] || l), n));
  const types = new Map();
  for (const i of scope) if (i.kind === 'accessory' && i.acc_type) types.set(i.acc_type, (types.get(i.acc_type) || 0) + 1);
  for (const [t, n] of [...types].sort((a, b) => b[1] - a[1])) other.push(chip('other', 'type:' + t, t, n));
  $('#fOther').innerHTML = other.join('') || '<span class="hint" style="font-size:12px">—</span>';

  const comp = view.kind === 'game' ? [['cib', 'CIB'], ['nomanual', 'Bez instrukcji'], ['loose', 'Luzem']] : [['cib', 'Komplet'], ['nomanual', 'W pudełku'], ['loose', 'Bez pudełka']];
  $('#fComplete').innerHTML = comp.map(([k, l]) => chip('complete', k, l)).join('');
}

function renderMain() {
  if (view.list === 'shame') view.kind = 'game';
  const scopeAll = baseList().filter(inPlatform);
  const listTitle = {wish: 'LISTA ŻYCZEŃ', shame: 'KUPKA WSTYDU', loans: 'WYPOŻYCZONE', sale: 'NA SPRZEDAŻ', sold: 'SPRZEDANE'}[view.list];
  $('#title').innerHTML = listTitle ? `${view.list === 'shame' ? POOP : view.list === 'loans' ? '<span class="ic sqi">□</span>' : view.list === 'sale' || view.list === 'sold' ? '<span class="ic sale">○</span>' : `<span class="ic star">${ICON.star}</span>`}${listTitle}`
    : esc((view.platform || 'Wszystkie').toUpperCase());
  $('#title').classList.toggle('withicon', !!listTitle);
  const val = scopeAll.reduce((a, i) => a + (i.value || 0), 0);
  const g = scopeAll.filter(isGame).length;
  if (view.list === 'wish') {
    const t = scopeAll.reduce((a, i) => a + (i.target_price || 0), 0);
    $('#sub').textContent = `${plural(scopeAll.length, 'pozycja', 'pozycje', 'pozycji')}${t ? ' · cel ' + zl(t) : ''}`;
  } else if (view.list === 'sale') {
    $('#sub').textContent = `${plural(scopeAll.length, 'pozycja', 'pozycje', 'pozycji')} · ${zl(scopeAll.reduce((a, i) => a + (i.asking_price || 0), 0))}`;
  } else if (view.list === 'sold') {
    const known = scopeAll.filter((i) => i.price_paid != null);
    const prof = known.reduce((a, i) => a + (i.sold_price || 0) - i.price_paid, 0);
    $('#sub').textContent = [plural(scopeAll.length, 'pozycja', 'pozycje', 'pozycji'), `sprzedano za ${zl(scopeAll.reduce((a, i) => a + (i.sold_price || 0), 0))}`,
      known.length ? `${prof >= 0 ? 'zysk' : 'strata'} ${zl(Math.abs(prof))}` : ''].filter(Boolean).join(' · ');
  } else if (view.list === 'loans') {
    const late = scopeAll.filter((i) => isLate(i.loan)).length;
    $('#sub').textContent = `${plural(scopeAll.length, 'pozycja', 'pozycje', 'pozycji')}${late ? ` · po terminie: ${late}` : ''}`;
  } else if (view.list === 'shame') {
    const avg = g ? Math.round(scopeAll.reduce((a, i) => a + daysSince(i.shame_since), 0) / g) : 0;
    $('#sub').textContent = `${plural(g, 'gra', 'gry', 'gier')}${g ? ` · leżą średnio: ${ago(avg)}` : ''} · ${zl(val)}`;
  } else {
    $('#sub').textContent = `${plural(g, 'gra', 'gry', 'gier')} · ${zl(val)}`;
  }
  $('#tabs').hidden = view.list === 'shame';
  $('#tabs').innerHTML = KIND_TABS.map(([k, l]) => `<button data-k="${k}" aria-pressed="${view.kind === k}">${l} ${scopeAll.filter((i) => i.kind === k).length}</button>`).join('');

  const list = sorted(scopeAll.filter((i) => i.kind === view.kind && passes(i)));
  const h = small() ? 150 : 200;
  const card = (it) => {
    const w = Math.round(h * coverAr(it, coverSrc(it), it.cover_frame || !it.cover, it.cover_ar));
    const meta = isGame(it) ? (it.release_year || '') : it.kind === 'accessory' ? (it.acc_type || it.model || KIND[it.kind]) : (it.model || KIND[it.kind]);
    const left = it.wish ? `<span>${esc(meta)}</span>` : `<span class="ml">${compIcons(it)}<span>${esc(meta)}</span></span>`;
    const right = it.wish ? (it.target_price ? 'cel ' + zl(it.target_price) : '') : (it.value ? zl(it.value) : '');
    return `<button class="card" data-id="${it.id}" aria-current="${selected === it.id}">
      ${cover(it, h)}
      <span class="t" style="max-width:${w}px">${esc(it.title)}</span>
      <span class="m" style="max-width:${w}px">${left}<span>${right}</span></span>
    </button>`;
  };
  // „Wszystkie” + gry → sekcje per konsola (kolejność jak w bocznym panelu)
  const groups = new Map();
  if (!view.platform && view.kind === 'game') for (const it of list) {
    const p = platOf(it);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(it);
  }
  if (groups.size > 1) {
    const order = [...groups.entries()].sort((a, b) => (a[0] === NO_PLATFORM) - (b[0] === NO_PLATFORM)
      || b[1].length - a[1].length || a[0].localeCompare(b[0], 'pl'));
    $('#grid').innerHTML = order.map(([p, arr]) => {
      const v = arr.reduce((a, i) => a + ((i.wish ? i.target_price : i.value) || 0), 0);
      return `<button class="grp" data-p="${esc(p)}" style="--c:${PCOLOR[p] || '#888'}" title="Pokaż tylko ${esc(p)}">
        <span class="gl">${esc(p.toUpperCase())}</span><span class="gm">${plural(arr.length, 'gra', 'gry', 'gier')}${v ? ' · ' + zl(v) : ''}</span></button>
        ${arr.map(card).join('')}`;
    }).join('');
  } else {
    $('#grid').innerHTML = list.map(card).join('');
  }
  const empty = $('#empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = view.list === 'wish' ? (wishes.length ? 'Nic nie pasuje do filtrów.' : 'Lista życzeń jest pusta — „+ Dodaj” i przełącz „Lista życzeń”.')
      : view.list === 'shame' ? 'Kupka wstydu jest pusta. Szacun.'
        : items.length ? 'Nic nie pasuje do filtrów.' : 'Kolekcja jest pusta — kliknij „+ Dodaj”.';
  }
  if (!narrow() && (!selected || !list.some((i) => i.id === selected))) selected = list[0]?.id ?? null;
}

function renderDetail() {
  const box = $('#detail');
  const it = find(selected);
  if (!it) { box.innerHTML = narrow() ? '' : '<div class="manual"><div class="hd">SZCZEGÓŁY</div><div class="none">Wybierz coś z kolekcji.</div></div>'; return; }
  const game = isGame(it);
  const meta = game ? [it.release_year, it.genres].filter(Boolean).join(' · ') : it.kind === 'accessory' ? [KIND[it.kind], it.acc_type].filter(Boolean).join(' · ') : KIND[it.kind];
  const head = `<div class="hd"><span>${esc((it.platform || NO_PLATFORM).toUpperCase())}${it.region && it.kind !== 'accessory' ? ' · ' + esc(it.region) : ''}</span><button class="x" data-act="close" aria-label="Zamknij">✕</button></div>`;
  const cv = (tags) => `<div class="cv">${cover(it, game ? (small() ? 150 : 190) : (small() ? 90 : 120), {noTags: true})}<div><h3>${esc(it.title)}</h3><div class="mm">${esc(meta)}</div>
        <div class="ptags">${tags.join('')}</div></div></div>`;
  const kvHtml = (kv) => `<div class="kv">${kv.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;

  if (it.wish) {
    const kv = [['Cena docelowa', it.target_price != null ? `<b>${zl(it.target_price)}</b>` : '—']];
    if (game) kv.push(['Wydanie', esc(it.edition || '—')], ['Okładka', esc(LANG_LABEL[it.cover_lang] || it.cover_lang || '—')]);
    else kv.push(['Model', esc(it.model || '—')]);
    kv.push(['Na liście od', esc((it.created_at || '').slice(0, 10))]);
    if (it.notes) kv.push(['Notatki', esc(it.notes)]);
    box.innerHTML = `<div class="manual">${head}<div class="bd">
      ${cv([`<span class="ptag wish">${ICON.star} Lista życzeń</span>`, `<span class="ptag">${KIND[it.kind]}</span>`])}
      ${kvHtml(kv)}
      <div class="acts">
        <button class="btn tri big" data-act="buy">✓ Kupiłem</button>
        <button class="btn crs" data-act="edit">✕ Edytuj</button>
        <button class="btn" data-act="delete">Usuń</button>
      </div>
      <div class="acts slinks">${shopLinks(it)}</div></div></div>`;
    return;
  }

  if (it.sold_on) { box.innerHTML = soldDetail(it, head, cv, kvHtml); return; }
  const c = completeness(it);
  const tags = [`<span class="ptag ${c.cls}">${c.label}</span>`];
  if (it.for_sale) tags.unshift(`<span class="ptag sale">Na sprzedaż${it.asking_price != null ? ' · ' + zl(it.asking_price) : ''}</span>`);
  if (onShame(it)) tags.push(`<span class="ptag shame">${POOP} Kupka wstydu · ${ago(daysSince(it.shame_since))}</span>`);
  if (it.condition) tags.push(`<span class="ptag ${{A: 'ok', B: 'warn', C: 'bad'}[it.condition]}">${game ? 'Płyta' : 'Stan'} ${it.condition}</span>`);
  if (game && it.cover_lang) tags.push(`<span class="ptag lang">Okładka ${esc(LANG_LABEL[it.cover_lang] || it.cover_lang)}</span>`);
  for (const s of it.special || []) tags.push(`<span class="ptag spec">${esc(s)}</span>`);
  if (game && STATUS[it.status]) tags.push(`<span class="ptag ${STATUS_CLS[it.status] || ''}">${STATUS[it.status]}</span>`);
  if (!game && !it.working) tags.push('<span class="ptag bad">Niesprawna</span>');
  const loan = it.loan
    ? `<div class="loanbox${isLate(it.loan) ? ' late' : ''}">□ Wypożyczona: <b>${esc(it.loan.borrower)}</b><br>od ${esc(it.loan.lent_on)} (${daysSince(it.loan.lent_on)} dni)${it.loan.due_on ? ` · oddać do: ${esc(it.loan.due_on)}${isLate(it.loan) ? ' — <b>po terminie</b>' : ''}` : ''}${it.loan.notes ? `<br>${esc(it.loan.notes)}` : ''}</div>` : '';
  const kv = [
    ['Kompletność', compIcons(it)],
    ['Kupiona', [it.purchased_on, it.price_paid != null ? zl(it.price_paid) : ''].filter(Boolean).join(' · ') || '—'],
    ['Wartość', it.value != null ? `<b>${zl(it.value)}</b>${it.value_checked ? `<small class="vchk">wycena z ${esc(it.value_checked)}</small>` : ''}` : '—'],
    [game ? 'Stan pudełka' : 'Model', game ? (it.has_box ? (it.box_condition || '—') : 'brak pudełka') : esc(it.model || '—')],
  ];
  if (it.kind === 'accessory') kv.push(['Typ', esc(it.acc_type || '—')], ['Do konsoli', esc(it.platform || '—')]);
  if (game) kv.push(['Wydanie', esc(it.edition || '—')], ['Ocena', starsRo(it.rating)]);
  if (it.serial) kv.push(['Numer seryjny', esc(it.serial)]);
  if (it.notes) kv.push(['Notatki', esc(it.notes)]);
  const shameBtn = settings.shame && game
    ? (it.shame_since ? `<button class="btn poop" data-act="shame">${POOP} Zdejmij z kupki</button>` : `<button class="btn poop" data-act="shame">${POOP} Na kupkę wstydu</button>`) : '';
  box.innerHTML = `<div class="manual">${head}<div class="bd">
      ${cv(tags)}
      ${loan}
      ${kvHtml(kv)}
      <div class="acts">
        <button class="btn crs" data-act="edit">✕ Edytuj</button>
        ${it.loan ? '<button class="btn sqr" data-act="return">□ Oddana</button>' : '<button class="btn sqr" data-act="lend">□ Wypożycz</button>'}
        ${it.kind === 'console' ? '<button class="btn tri" data-act="igdb">△ Zdjęcie automatyczne</button>' : ''}
        ${shameBtn}
        <button class="btn" data-act="delete">Usuń</button>
      </div>
      <div class="acts salebar">${it.for_sale
        ? '<button class="btn cir" data-act="sold">✓ Sprzedana</button><button class="btn light" data-act="ad">Ogłoszenie</button><button class="btn light" data-act="unsale">Zdejmij ze sprzedaży</button>'
        : '<button class="btn light" data-act="sale">○ Na sprzedaż</button>'}</div>
      ${photoBox(it)}
      <details class="hist" data-id="${it.id}"><summary>Historia wypożyczeń</summary><div>…</div></details>
    </div></div>`;
  loadItemPhotos(it.id);
}

function render() {
  if (view.list === 'shame' && !settings.shame) view.list = null;
  if (view.list === 'loans' && !items.some((i) => i.loan)) view.list = null;
  if (view.list === 'sale' && !items.some((i) => i.for_sale)) view.list = null;
  if (view.list === 'sold' && !soldItems.length) view.list = null;
  renderLcd();
  renderSide();
  renderMain();
  renderDetail();
  if (!$('#stats').hidden) renderStats();
}

async function load() {
  all = await api('/api/items');
  items = all.filter((i) => !i.wish && !i.sold_on);
  soldItems = all.filter((i) => i.sold_on);
  wishes = all.filter((i) => i.wish);
  const used = [...new Set(all.map((i) => i.platform).filter(Boolean))];
  $('#platformList').innerHTML = [...new Set([...cfg.platforms, ...used])].map((p) => `<option value="${esc(p)}">`).join('');
  if (view.platform && !baseList().some((i) => platOf(i) === view.platform)) view.platform = null;
  render();
  checkTrophies();
}

// ================= akcje w panelu =================
async function detailAction(act, it) {
  if (act === 'close') { document.body.classList.remove('show-detail'); return; }
  if (act === 'edit') return openEdit(it.id);
  if (act === 'cover') return openEdit(it.id, true);
  if (act === 'lend') return openLoan(it);
  if (act === 'buy') return openBuy(it);
  if (act === 'return') {
    if (!confirm(`Oznaczyć „${it.title}” jako oddaną przez ${it.loan.borrower}?`)) return;
    await api(`/api/items/${it.id}/return`, {method: 'POST'});
    toast('Oddana — wraca na półkę');
    return load();
  }
  if (act === 'shame') {
    const on = !it.shame_since;
    await jsonPost(`/api/items/${it.id}/shame`, {on});
    toast(on ? 'Wylądowała na kupce wstydu' : 'Zdjęta z kupki wstydu');
    return load();
  }
  if (act === 'sale' || act === 'ad') return openSale(it);
  if (act === 'sold') return openSold(it);
  if (act === 'unsale') { await jsonPost(`/api/items/${it.id}/sale`, {on: false}); toast('Zdjęte ze sprzedaży'); return load(); }
  if (act === 'unsold') {
    if (!confirm(`Cofnąć sprzedaż „${it.title}”? Wróci do kolekcji.`)) return;
    await api(`/api/items/${it.id}/unsold`, {method: 'POST'}); toast('Wróciła do kolekcji'); view.list = null; return load();
  }
  if (act === 'igdb') {
    try { await api(`/api/items/${it.id}/igdb-image`, {method: 'POST'}); toast('Zdjęcie pobrane'); await load(); } catch (e) { toast(e.message, true); }
    return;
  }
  if (act === 'delete') {
    if (!confirm(`Usunąć „${it.title}”${it.wish ? ' z listy życzeń' : ' z kolekcji'}?`)) return;
    await api(`/api/items/${it.id}`, {method: 'DELETE'});
    selected = null; document.body.classList.remove('show-detail');
    toast('Usunięto');
    return load();
  }
}

// ================= wypożyczenia =================
const loanDlg = $('#loanDlg');
let loanItem = null;
async function openLoan(it) {
  loanItem = it;
  const f = $('#loanForm');
  f.reset();
  f.elements.lent_on.value = today();
  try { $('#borrowerList').innerHTML = (await api('/api/borrowers')).map((b) => `<option value="${esc(b)}">`).join(''); } catch { /* bez podpowiedzi */ }
  loanDlg.showModal();
  f.elements.borrower.focus();
}
$('#loanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (!f.borrower.value.trim()) { f.borrower.focus(); return; }
  try {
    await jsonPost(`/api/items/${loanItem.id}/loan`, {borrower: f.borrower.value.trim(), lent_on: f.lent_on.value || null, due_on: f.due_on.value || null, notes: f.notes.value.trim() || null});
    loanDlg.close();
    toast(`Wypożyczona: ${f.borrower.value.trim()}`);
    await load();
  } catch (err) { toast(err.message, true); }
});

// ================= formularz =================
const dlg = $('#dlg');
const form = $('#itemForm');

function applyVis() {
  const game = kind === 'game';
  $$('#dlg [data-for],#dlg [data-not],#dlg [data-own],#dlg [data-wish],#dlg [data-shame]').forEach((el) => {
    const f = el.dataset.for;
    let show = true;
    if (f === 'game') show = game;
    else if (f === 'hw') show = !game;
    else if (f === 'acc') show = kind === 'accessory';
    else if (f === 'console') show = kind === 'console';
    if (el.dataset.not === kind) show = false;
    if ('own' in el.dataset && wishMode) show = false;
    if ('wish' in el.dataset && !wishMode) show = false;
    if ('shame' in el.dataset && !settings.shame) show = false;
    el.hidden = !show;
  });
  $('#igdbImg').hidden = !(kind === 'console' && editing !== null && !wishMode);
  $('#wishTog').setAttribute('aria-pressed', String(wishMode));
  $('#wishTog').hidden = buying || (editing !== null && !wishMode);
}
function setKind(k) {
  kind = k;
  $$('#kindTabs button[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
  $('#platLabel').textContent = k === 'accessory' ? 'Do konsoli' : 'Konsola / platforma';
  $('#modelIn').placeholder = k === 'accessory' ? 'np. DualShock SCPH-1200' : 'np. SCPH-7002, Slim 250 GB';
  $('#condLabel').textContent = k === 'game' ? 'Stan płyty / kartridża' : 'Stan wizualny';
  $('#manualLabel').textContent = k === 'game' ? 'Instrukcja' : 'Instrukcja / papiery';
  applyVis();
}
function setTitle() {
  $('#dlgTitle').textContent = buying ? 'KUPIŁEM!' : editing !== null ? (wishMode ? 'EDYTUJ — LISTA ŻYCZEŃ' : 'EDYTUJ')
    : (wishMode ? 'DODAJ DO LISTY ŻYCZEŃ' : 'DODAJ DO KOLEKCJI');
}
function showSearch() {
  $('#searchBox').hidden = false; $('#formBox').hidden = true; $('#formFooter').hidden = true;
  setTimeout(() => $('#sQuery').focus(), 50);
}
function showForm() {
  $('#searchBox').hidden = true; $('#formBox').hidden = false; $('#formFooter').hidden = false;
  $('#back').hidden = editing !== null || kind !== 'game';
}
function currentDraft() {
  const f = form.elements;
  return {kind, title: f.title.value, platform: f.platform.value || $('#sPlatform').value, cover_lang: f.cover_lang.value,
    acc_type: f.acc_type.value, special: [], loan: null};
}
function probeAr(src) {
  if (AR.has(src)) return;
  AR.set(src, null);
  const img = new Image();
  img.onload = () => { if (img.naturalHeight) { AR.set(src, img.naturalWidth / img.naturalHeight); renderPic(); } };
  img.src = src;
}
function syncFrame() {
  const plat = form.elements.platform.value || $('#sPlatform').value;
  const ok = !!FRAME[plat];
  form.elements.cover_frame.disabled = !ok;
  $('#frameLbl').classList.toggle('dis', !ok);
  $('#frameLbl').title = ok ? '' : `Dla konsoli „${plat || '—'}” nie ma jeszcze paska`;
}
function syncBox() {
  const f = form.elements;
  const on = f.has_box.checked;
  f.box_condition.disabled = !on;
  if (!on) f.box_condition.value = '';
  $('#boxCondBox').classList.toggle('dis', !on);
}
function syncEdition() {
  const other = form.elements.edition_sel.value === OTHER;
  $('#editionOther').hidden = !other;
}
function renderPic() {
  const it = editing ? find(editing) : null;
  const draft = currentDraft();
  const upload = $('#upload').files[0];
  let src = null;
  if (upload) src = pending.uploadUrl || (pending.uploadUrl = URL.createObjectURL(upload));
  else if (pending.coverUrl) src = pending.coverUrl;
  else if (it?.cover) src = coverSrc(it);
  let ar = null;
  if (src) {
    ar = AR.get(src) ?? (it && src === coverSrc(it) ? it.cover_ar : null);
    if (ar == null) probeAr(src);
  }
  syncFrame();
  const frame = form.elements.cover_frame.checked && !form.elements.cover_frame.disabled;
  const h = kind === 'game' ? (small() ? 150 : 190) : (small() ? 90 : 135);
  if (kind === 'console' && !draft.title) draft.title = 'Brak zdjęcia';
  $('#pic').innerHTML = cover(draft, h, {src, ar, frame: kind === 'game' ? (frame || !src) : false, noTags: true});
}
function renderVariants() {
  const v = pending.variants;
  $('#variants').classList.toggle('hw', kind !== 'game');
  if (!v) { $('#variants').innerHTML = ''; return; }
  const what = kind === 'game' ? 'okładek' : 'zdjęć';
  const pq = kind !== 'game' && pending.photoQ !== undefined
    ? `<div class="psearch"><input id="photoQ" value="${esc(pending.photoQ)}" aria-label="Szukaj zdjęć" placeholder="np. EyeToy USB Camera"><button type="button" class="btn light" id="photoGo" title="Szukaj">↻</button></div>` : '';
  if (v === 'loading') { $('#variants').innerHTML = `${pq}<div class="hint">Szukam ${what}…</div>`; return; }
  const covers = v.covers || [];
  $('#variants').innerHTML = pq + (covers.length
    ? `<div class="vt">${kind === 'game' ? 'Okładki' : 'Zdjęcia'} (${covers.length})</div><div class="vs">${covers.map((c, i) =>
      `<button type="button" data-i="${i}" aria-pressed="${c.url === pending.coverUrl}" title="${esc([c.source, c.region, c.title, c.credit].filter(Boolean).join(' · '))}"><img src="${esc(c.url)}" alt="" loading="lazy"><span>${esc(c.region)}</span></button>`).join('')}</div>`
      + (kind !== 'game' ? (kind === 'console' ? '<div class="hint src">Źródła: IGDB, Wikipedia / Wikimedia Commons (autor w podpowiedzi)</div>' : '<div class="hint src">Źródło: Wikipedia / Wikimedia Commons (wolne licencje — autor w podpowiedzi)</div>') : '')
    : `<div class="hint">Nie znaleziono ${what}${(v.notes || []).length ? ` (${esc(v.notes.join('; '))})` : ''}.</div>`);
}
async function loadCovers() {
  if (kind !== 'game') return;
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) return;
  pending.variants = 'loading'; renderVariants();
  try {
    const p = new URLSearchParams({title, platform: f.platform.value || '', lang: f.cover_lang.value || ''});
    if (pending.igdbId) p.set('igdb_id', pending.igdbId);
    if (pending.release) p.set('release', pending.release);
    if (f.region.value) p.set('region', f.region.value);
    const res = await api('/api/covers?' + p);
    pending.variants = res;
    const first = res.covers[0];
    const keep = res.covers.find((c) => c.url === pending.coverUrl);
    if (!keep && first && (!editing || pending.forceCover)) pickVariant(first);
  } catch (e) {
    pending.variants = {covers: [], notes: [e.message]};
  }
  renderVariants(); renderPic();
}
// ---------- sugerowana cena ----------
let priceSeq = 0;
function priceTarget() { return wishMode ? form.elements.target_price : form.elements.value; }
function resetPrice() { priceSeq++; $('#priceOut').hidden = true; $('#priceOut').innerHTML = ''; }
async function suggestPrice() {
  const f = form.elements;
  const title = f.title.value.trim();
  if (!title) { toast('Najpierw wpisz nazwę', true); f.title.focus(); return; }
  const game = kind === 'game';
  const edition = !game ? '' : f.edition_sel.value === OTHER ? f.edition.value : f.edition_sel.value;
  const p = new URLSearchParams({title, kind, platform: f.platform.value || $('#sPlatform').value || '',
    region: kind === 'accessory' ? '' : f.region.value, edition: edition || '', model: game ? '' : f.model.value,
    // lista życzeń: wyceniamy kompletny egzemplarz
    has_box: wishMode || f.has_box.checked, has_manual: wishMode || f.has_manual.checked,
    has_disc: wishMode || !game || f.has_disc.checked});
  const out = $('#priceOut');
  const seq = ++priceSeq;
  out.hidden = false;
  out.innerHTML = '<div class="pload">Szukam ofert…</div>';
  $('#priceGo').disabled = true;
  let r;
  try { r = await api('/api/price?' + p); } catch (e) { if (seq === priceSeq) { out.innerHTML = `<div class="pnote">${esc(e.message)}</div>`; } return; }
  finally { $('#priceGo').disabled = false; }
  if (seq !== priceSeq) return;
  const target = wishMode ? 'Cena docelowa' : 'Wartość';
  let h = '';
  if (r.suggested != null) {
    const adj = [`×${String(r.factor).replace('.', ',')} oferty → realna sprzedaż`];
    if (r.completeness_note) adj.push(`×${String(r.completeness).replace('.', ',')} ${r.completeness_note}`);
    h += `<div class="psum"><div class="plcd"><small>SUGEROWANA</small>${num0(r.suggested)} zł</div>
      <div class="pmeta"><b>mediana ${zl(r.median)}</b> z ${plural(r.count, 'oferty', 'ofert', 'ofert')}${r.count > 1 ? ` · typowo ${num0(r.low)}–${zl(r.high)}` : ''}<br>${esc(adj.join(' · '))}</div>
      <button type="button" class="btn tri" id="priceUse" data-v="${r.suggested}">Wstaw do „${target}”</button></div>`;
  }
  if (r.note) h += `<div class="pnote">${esc(r.note)}</div>`;
  if (r.offers?.length) {
    h += `<details class="poffers"><summary>Oferty (${r.offers.length})</summary><ul>` + r.offers.map((o) =>
      `<li><span class="pm">${esc(o.market)}</span><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.title)}</a><b>${zl(o.pln)}</b></li>`).join('') + '</ul></details>';
  }
  h += '<div class="plinks"><span>Sprawdź sam:</span>' + (r.links || []).filter((l) => !l.key || myShops().includes(l.key)).map((l) =>
    `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>`).join('') + '</div>';
  h += `<div class="pq">Zapytanie: „${esc(r.query)}”</div>`;
  out.innerHTML = h;
}

async function loadPhotos(custom) {
  const f = form.elements;
  const title = f.title.value.trim();
  const q = (custom ?? title).trim();
  if (q.length < 2) { toast('Wpisz najpierw nazwę', true); f.title.focus(); return; }
  pending.photoQ = custom ?? [title, f.model.value.trim()].filter(Boolean).join(' ');
  const p = new URLSearchParams({q});
  p.set('kind', kind);
  if (custom === undefined) { p.set('model', f.model.value.trim()); p.set('platform', f.platform.value.trim()); }
  pending.variants = 'loading'; renderVariants();
  try { pending.variants = await api('/api/photos?' + p); } catch (e) { pending.variants = {covers: [], notes: [e.message]}; }
  renderVariants();
}
function pickVariant(c) {
  pending.coverUrl = c.url;
  form.elements.cover_frame.checked = !c.framed;
  $('#upload').value = ''; pending.uploadUrl = null;
  renderVariants(); renderPic();
}

// gwiazdki 0–5 co pół (w bazie 0–10)
function setStars(v) {
  v = clamp(Math.round(+v || 0), 0, 10);
  form.elements.rating.value = v || '';
  $('#stars').style.setProperty('--p', v * 10 + '%');
  $('#stars').setAttribute('aria-valuenow', String(v / 2));
  $('#starVal').textContent = v ? `${String(v / 2).replace('.', ',')} / 5` : 'brak oceny';
}
function starFromEvent(e) {
  const r = $('#stars').getBoundingClientRect();
  return clamp(Math.ceil(((e.clientX - r.left) / r.width) * 10), 1, 10);
}

function fillForm(it) {
  resetPrice();
  const keep = [$('#sPlatform').value, $('#sQuery').value];
  form.reset();
  [$('#sPlatform').value, $('#sQuery').value] = keep;
  const f = form.elements;
  for (const k of ['title', 'platform', 'edition', 'model', 'release_year', 'condition', 'box_condition', 'status',
    'price_paid', 'value', 'purchased_on', 'genres', 'notes', 'cover_lang', 'acc_type', 'target_price', 'serial']) if (f[k]) f[k].value = it[k] ?? '';
  f.region.value = it.region ?? 'PAL';
  for (const k of ['has_disc', 'has_box', 'has_manual', 'working']) f[k].checked = !!it[k];
  f.cover_frame.checked = it.cover_frame !== false;
  f.shame.checked = !!it.shame_since;
  if (!f.status.value) f.status.value = 'backlog';
  const ed = it.edition || '';
  f.edition_sel.value = !ed ? '' : cfg.editions.includes(ed) ? ed : OTHER;
  f.edition.value = f.edition_sel.value === OTHER ? ed : '';
  syncEdition();
  setStars(it.rating);
  const specs = it.special || [];
  $$('#specialBox input').forEach((cb) => { cb.checked = specs.includes(cb.value); });
  f.special_other.value = specs.filter((s) => !SPECIALS.includes(s)).join(', ');
  $('#upload').value = ''; pending.uploadUrl = null;
  $$('#dlg .invalid').forEach((el) => el.classList.remove('invalid'));
  $$('#dlg .req').forEach((el) => el.classList.remove('req'));
  syncBox();
}
function defaultPlatform() {
  if (view.platform && cfg.platforms.includes(view.platform)) return view.platform;
  const last = store.get('lastPlatform');
  return cfg.platforms.includes(last) ? last : 'PlayStation 2';
}
function openAdd() {
  editing = null; pending = {}; buying = false;
  wishMode = view.list === 'wish';
  $('#results').innerHTML = '';
  $('#sHint').textContent = cfg.sources.igdb ? 'Wybierz konsolę i wpisz tytuł albo numer seryjny z grzbietu pudełka (np. SLES-02605).' : 'Brak kluczy IGDB — wyszukiwanie w bazie LaunchBox.';
  $('#sQuery').value = '';
  $('#sPlatform').value = defaultPlatform();
  fillForm({has_disc: true, has_box: true, has_manual: true, working: true, region: 'PAL', status: 'backlog', cover_frame: true});
  setKind(view.list === 'shame' ? 'game' : view.kind);
  setTitle();
  if (kind === 'game') showSearch(); else startManual();
  dlg.showModal();
}
function openEdit(id, coverMode = false) {
  const it = find(id);
  if (!it) return;
  editing = id; buying = false; wishMode = !!it.wish;
  pending = {igdbId: it.igdb_id, lbId: it.lb_id, forceCover: coverMode};
  fillForm(it);
  setKind(it.kind);
  setTitle();
  if (coverMode) $('#dlgTitle').textContent = 'ZMIEŃ OKŁADKĘ';
  showForm();
  renderVariants(); renderPic();
  dlg.showModal();
  if (coverMode) loadCovers();
}
function openBuy(it) {
  openEdit(it.id);
  buying = true; wishMode = false;
  const f = form.elements;
  if (!f.purchased_on.value) f.purchased_on.value = today();
  f.price_paid.placeholder = it.target_price ? `cel był ${zl(it.target_price)}` : '';
  if (settings.shame && isGame(it)) f.shame.checked = true;   // prosto z pudełka na kupkę :)
  for (const id of ['paidBox', 'dateBox', 'condBox']) $('#' + id).classList.add('req');
  applyVis(); setTitle();
  setTimeout(() => (f.price_paid.value ? f.condition : f.price_paid).focus(), 50);
}
function startManual() {
  pending = {};
  const plat = kind === 'game' ? $('#sPlatform').value : (view.platform && view.platform !== NO_PLATFORM ? view.platform : '');
  fillForm({has_disc: true, has_box: kind === 'game', has_manual: kind === 'game', working: true, region: 'PAL', status: 'backlog',
    platform: plat, title: kind === 'game' ? $('#sQuery').value.trim() : '', cover_frame: true});
  showForm(); renderVariants(); renderPic();
  form.elements.title.focus();
}
async function search() {
  const q = $('#sQuery').value.trim();
  if (q.length < 2) return;
  const plat = $('#sPlatform').value;
  store.set('lastPlatform', plat);
  $('#sHint').textContent = 'Szukam…';
  $('#results').innerHTML = '';
  try {
    const {results} = await api(`/api/search?q=${encodeURIComponent(q)}&platform=${encodeURIComponent(plat)}`);
    $('#sHint').textContent = results.length ? '' : 'Nic nie znaleziono — spróbuj angielskiej nazwy albo dodaj ręcznie.';
    $('#results').innerHTML = results.map((g, i) => `<button type="button" class="res" data-i="${i}">
      <span class="img">${g.thumb ? `<img src="${esc(g.thumb)}" alt="" loading="lazy">` : `<span>${esc(g.title)}</span>`}</span>
      <span class="t"><b>${esc(g.title)}</b>${g.release_year ?? ''}</span></button>`).join('');
    $$('#results .res').forEach((b) => b.addEventListener('click', () => pick(results[+b.dataset.i])));
  } catch (e) { $('#sHint').textContent = 'Błąd wyszukiwania: ' + e.message; }
}
function pick(g) {
  pending = {igdbId: g.igdb_id || null, lbId: g.lb_id || null, forceCover: true, release: g.release_name || null};
  if (g.platform) $('#sPlatform').value = g.platform;
  fillForm({title: g.title, release_year: g.release_year, genres: g.genres, platform: g.platform || $('#sPlatform').value, region: g.region || 'PAL',
    cover_lang: g.cover_lang || '', serial: g.serial || '',
    has_disc: true, has_box: true, has_manual: true, status: 'backlog', cover_frame: true});
  showForm(); renderPic();
  loadCovers();
}
function collect() {
  const f = form.elements;
  const txt = (k) => f[k].value.trim() || null;
  const num = (k) => (f[k].value === '' ? null : Number(f[k].value));
  const cur = editing ? find(editing) : null;
  const game = kind === 'game';
  const own = !wishMode;
  const special = game ? [...$$('#specialBox input:checked').map((c) => c.value),
    ...f.special_other.value.split(',').map((s) => s.trim()).filter(Boolean)] : [];
  const edition = !game ? null : f.edition_sel.value === OTHER ? txt('edition') : (f.edition_sel.value || null);
  const shame = !game || !own ? null
    : settings.shame ? (f.shame.checked ? (cur?.shame_since || today()) : null)
      : (cur?.shame_since ?? null);                     // funkcja wyłączona → nie ruszamy
  return {
    kind, title: f.title.value.trim(), platform: txt('platform'), region: kind === 'accessory' ? null : (f.region.value || null),
    edition, model: game ? null : txt('model'),
    has_disc: game ? f.has_disc.checked : true, has_box: f.has_box.checked, has_manual: f.has_manual.checked,
    working: game ? true : f.working.checked, condition: f.condition.value || null, box_condition: f.has_box.checked ? (f.box_condition.value || null) : null,
    status: game ? f.status.value : 'none', rating: game && own ? (num('rating') || null) : null,
    price_paid: own ? num('price_paid') : null, value: own ? num('value') : null, purchased_on: own ? (f.purchased_on.value || null) : null,
    notes: txt('notes'),
    igdb_id: game ? pending.igdbId ?? cur?.igdb_id ?? null : null, lb_id: game ? pending.lbId ?? cur?.lb_id ?? null : null,
    cover: cur ? cur.cover : null, spine: cur ? cur.spine : null,
    release_year: game ? num('release_year') : null, genres: game ? txt('genres') : null,
    cover_lang: game ? (f.cover_lang.value || null) : null, special,
    cover_frame: game ? f.cover_frame.checked && !f.cover_frame.disabled : false,
    acc_type: kind === 'accessory' ? txt('acc_type') : null,
    shame_since: shame, wish: wishMode, target_price: num('target_price'), serial: game ? txt('serial') : null,
    cover_url: pending.coverUrl || null,
  };
}
async function save(e) {
  e.preventDefault();
  const f = form.elements;
  if (!f.title.value.trim()) { f.title.focus(); toast('Podaj nazwę', true); return; }
  for (const k of ['price_paid', 'value', 'target_price', 'release_year']) {
    if (f[k].value !== '' && !f[k].checkValidity()) { f[k].focus(); toast(`${FIELD[k]}: niepoprawna wartość`, true); return; }
  }
  if (buying) {
    const miss = [['paidBox', f.price_paid.value === '', 'cena zakupu'], ['dateBox', !f.purchased_on.value, 'data zakupu'], ['condBox', !f.condition.value, 'stan']];
    miss.forEach(([id, bad]) => $('#' + id).classList.toggle('invalid', bad));
    const m = miss.filter((x) => x[1]).map((x) => x[2]);
    if (m.length) { toast('Uzupełnij: ' + m.join(', '), true); return; }
  }
  $('#save').disabled = true;
  try {
    let it = await jsonPost(editing ? `/api/items/${editing}` : '/api/items', collect(), editing ? 'PUT' : 'POST');
    const file = $('#upload').files[0];
    if (file) {
      const fd = new FormData(); fd.append('file', file);
      it = await api(`/api/items/${it.id}/cover`, {method: 'POST', body: fd});
    }
    dlg.close();
    toast(buying ? `W kolekcji: ${it.title}` : editing ? 'Zapisano' : it.wish ? `Na liście życzeń: ${it.title}` : `Dodano: ${it.title}`);
    selected = it.id;
    view.kind = it.kind;
    if (it.wish) view.list = 'wish';
    else if (view.list === 'wish') view.list = null;
    if (buying) view.platform = null;
    buying = false;
    await load();
  } catch (err) { toast('Nie zapisano: ' + err.message, true); } finally { $('#save').disabled = false; }
}

// ================= statystyki =================
// dwa wyglądy wykresów: „instrukcja” (kolory symboli PS) i „lcd” (4 odcienie Game Boya + wzory zamiast koloru)
const HATCH = (c) => `repeating-linear-gradient(45deg,${c} 0 2px,transparent 2px 5px)`;
const DOTS = (c) => `radial-gradient(${c} 1.2px,transparent 1.7px) 0 0/4px 4px`;
const STAT_PAL = {
  manual: {cat: ['#4b77c9', '#3cb98a', '#d9a21b'], st: ['#3cb98a', '#4b77c9', '#d9a21b', '#e7555a'], done: '#3cb98a', rest: '#a8a39a', col: '#4b77c9'},
  lcd: {cat: ['#0f380f', '#306230', HATCH('#0f380f')], st: ['#0f380f', '#306230', HATCH('#0f380f'), DOTS('#0f380f')], done: '#0f380f', rest: HATCH('#306230'), col: '#0f380f'},
  crt: {cat: ['#4f86e8', '#1e9e69', '#d0609f'], st: ['#1e9e69', '#4f86e8', '#bf7d17', '#d8508f'], done: '#1e9e69', rest: '#4a5566', col: '#4f86e8'},
};
const THEMES = [['crt', 'Telewizor'], ['lcd', 'Ekran LCD'], ['manual', 'Instrukcja']];
let statTheme = THEMES.some(([k]) => k === store.get('statTheme')) ? store.get('statTheme') : 'crt';

let valueHist = [];
function openStats() {
  api('/api/value-history').then((r) => { valueHist = r; if (!$('#stats').hidden) renderStats(); }).catch(() => {});
  $('#stats').hidden = false;
  document.body.classList.add('page-stats');
  document.body.classList.remove('show-detail');
  if (location.hash !== '#statystyki') history.pushState(null, '', '#statystyki');
  renderStats();
  powerOn();
  window.scrollTo({top: 0});
}
function closeStats(push = true) {
  if ($('#stats').hidden) return;
  $('#stats').hidden = true;
  document.body.classList.remove('page-stats');
  if (push && location.hash === '#statystyki') history.pushState(null, '', location.pathname);
}
const legend = (series) => `<div class="lg">${series.map(([, l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
const table = (head, rows) => `<details class="tbl"><summary>Tabela</summary><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
// poziome słupki (opcjonalnie skumulowane); wartość przy końcu słupka
function hbars(rows, series, fmt) {
  const max = Math.max(1, ...rows.map((r) => r.vals.reduce((a, b) => a + b, 0)));
  return `<div class="hb">${rows.map((r) => {
    const tot = r.vals.reduce((a, b) => a + b, 0);
    const tip = [r.label, ...series.map(([, l], i) => r.vals[i] ? `${l}: ${fmt(r.vals[i])}` : '').filter(Boolean), series.length > 1 ? `Razem: ${fmt(tot)}` : ''].filter(Boolean).join('\n');
    return `<div class="hb-row" data-tip="${esc(tip)}"><span class="hb-l">${r.color ? `<i style="background:${r.color}"></i>` : ''}${esc(r.label)}</span>
      <span class="hb-tr"><span class="hb-bar" style="width:${(tot / max) * 100}%">${series.map(([, , c], i) => r.vals[i] ? `<span class="hb-seg" style="flex:${r.vals[i]};background:${r.segColors?.[i] || c}"></span>` : '').join('')}</span>
      <span class="hb-v">${fmt(tot)}</span></span></div>`;
  }).join('')}</div>`;
}
function powerOn() {
  if (reducedMotion()) return;
  const el = $('#stats');
  el.classList.remove('boot'); void el.offsetWidth; el.classList.add('boot');
  setTimeout(() => el.classList.remove('boot'), 900);
}
function renderStats() {
  const P = STAT_PAL[statTheme];
  const CAT = [['game', 'Gry', P.cat[0]], ['console', 'Konsole', P.cat[1]], ['accessory', 'Akcesoria', P.cat[2]]];
  const STAT_ST = [['completed', 'Ukończone', P.st[0]], ['playing', 'Gram', P.st[1]], ['backlog', 'Do zagrania', P.st[2]], ['dropped', 'Porzucone', P.st[3]]];
  const DONE = [['', 'Ukończone', P.done], ['', 'Pozostałe', P.rest]];
  const fig = (title, sub, body, cls = '') => `<figure class="chart ${cls}"><div class="scr"><div class="chd"><b>${title}</b><span>${sub}</span></div><div class="cbd">${body}</div></div>
    <div class="tvb" aria-hidden="true"><span class="brand">MOJA KOLEKCJA</span><i class="spk"></i><i class="pwr"></i></div></figure>`;
  const games = items.filter(isGame);
  const byK = (k) => items.filter((i) => i.kind === k);
  const sum = (arr, f) => arr.reduce((a, i) => a + (f(i) || 0), 0);
  const value = sum(items, (i) => i.value);
  const paid = sum(items, (i) => i.price_paid);
  const both = items.filter((i) => i.value != null && i.price_paid != null);
  const gain = sum(both, (i) => i.value - i.price_paid);
  const st = (s) => games.filter((g) => g.status === s).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const rated = games.filter((g) => g.rating);
  const avgRating = rated.length ? sum(rated, (g) => g.rating) / rated.length : 0;
  const cib = games.filter((g) => completeness(g).key === 'cib').length;
  const loans = items.filter((i) => i.loan);
  const late = loans.filter((i) => isLate(i.loan)).length;
  const priciest = [...games].sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const shame = items.filter(onShame);

  const tile = (label, big, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="scr"><div class="kl">${label}</div><div class="kb">${big}</div><div class="ks">${sub}</div></div></div>`;
  const tiles = [
    tile('GRY', num0(games.length), `${cib} CIB (${pct(cib, games.length)}%)`),
    tile('KONSOLE', num0(byK('console').length)),
    tile('AKCESORIA', num0(byK('accessory').length)),
    tile('WARTOŚĆ', esc(zl(value)), `wydane ${zl(paid)}`, 'wide'),
    tile('BILANS', `${gain >= 0 ? '+' : '−'}${esc(zl(Math.abs(gain)))}`, `wartość − cena, ${plural(both.length, 'pozycja', 'pozycje', 'pozycji')} z obiema`, gain >= 0 ? 'up' : 'down'),
    tile('UKOŃCZONE', num0(st('completed')), `${pct(st('completed'), games.length)}% gier`),
    tile('GRAM', num0(st('playing'))),
    tile('DO ZAGRANIA', num0(st('backlog'))),
    tile('PORZUCONE', num0(st('dropped'))),
    tile('ŚREDNIA OCENA', rated.length ? starsRo(Math.round(avgRating)) : '—', rated.length ? `${String((avgRating / 2).toFixed(1)).replace('.', ',')} / 5 · ${plural(rated.length, 'ocena', 'oceny', 'ocen')}` : 'brak ocen'),
    tile('WYPOŻYCZONE', num0(loans.length), late ? `${late} po terminie` : 'wszystko w terminie'),
    tile('WYDANIA SPECJALNE', num0(items.filter((i) => (i.special || []).length).length)),
    tile('LISTA ŻYCZEŃ', num0(wishes.length), wishes.length ? `cel ${zl(sum(wishes, (w) => w.target_price))}` : ''),
    settings.shame ? tile('KUPKA WSTYDU', num0(shame.length), shame.length ? `leżą średnio: ${ago(Math.round(sum(shame, (g) => daysSince(g.shame_since)) / shame.length))}` : 'pusto — szacun') : '',
    soldItems.length ? tile('SPRZEDANE', num0(soldItems.length), (() => { const p = soldItems.filter((i) => i.price_paid != null).reduce((a, i) => a + (i.sold_price || 0) - i.price_paid, 0); return `${p >= 0 ? 'zysk' : 'strata'} ${zl(Math.abs(p))}`; })()) : '',
    priciest?.value ? tile('NAJCENNIEJSZA GRA', esc(zl(priciest.value)), esc(priciest.title)) : '',
  ].join('');

  // wartość per konsola (skumulowana po kategoriach)
  const plats = [...new Set(items.map(platOf))];
  const vp = plats.map((p) => ({label: p, color: PCOLOR[p] || '#888', vals: CAT.map(([k]) => sum(items.filter((i) => platOf(i) === p && i.kind === k), (i) => i.value))}))
    .filter((r) => r.vals.some(Boolean)).sort((a, b) => b.vals.reduce((x, y) => x + y) - a.vals.reduce((x, y) => x + y));
  // wartość per kategoria
  const vc = CAT.map(([k, l, c]) => ({label: l, vals: [sum(byK(k), (i) => i.value)], c, n: byK(k).length}));
  // gry per konsola: ukończone vs reszta
  const gp = [...new Set(games.map(platOf))].map((p) => {
    const gg = games.filter((g) => platOf(g) === p);
    const done = gg.filter((g) => g.status === 'completed').length;
    return {label: p, color: PCOLOR[p] || '#888', vals: [done, gg.length - done]};
  }).sort((a, b) => b.vals[0] + b.vals[1] - a.vals[0] - a.vals[1]);
  // statusy gier (100%)
  const stv = STAT_ST.map(([k, l, c]) => [k, l, c, st(k)]);
  const stTot = Math.max(1, games.length);
  // wydatki per rok
  const years = new Map();
  for (const i of items) if (i.purchased_on && i.price_paid) years.set(i.purchased_on.slice(0, 4), (years.get(i.purchased_on.slice(0, 4)) || 0) + i.price_paid);
  const yrs = [...years.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const ymax = Math.max(1, ...yrs.map((y) => y[1]));
  const yTop = yrs.length ? yrs.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;

  const noData = '<p class="hint">Za mało danych — uzupełnij wartości w kolekcji.</p>';
  $('#stats').className = 'stats st-' + statTheme + ($('#stats').classList.contains('boot') ? ' boot' : '');
  $('#stats').innerHTML = `
    <div class="st-head"><h2>STATYSTYKI</h2>
      <div class="seg" role="group" aria-label="Wygląd wykresów">${THEMES.map(([k, l]) => `<button data-theme="${k}" aria-pressed="${statTheme === k}">${l}</button>`).join('')}</div>
      <button class="btn light" data-sact="back">← Kolekcja</button></div>
    <div class="kpis">${tiles}</div>
    <div class="charts">
      ${valueHist.length > 1 ? fig('WARTOŚĆ W CZASIE', `od ${valueHist[0].day} · wydane vs wartość`, (() => {
        const vmax = Math.max(1, ...valueHist.map((h) => Math.max(h.value, h.paid)));
        const last = valueHist[valueHist.length - 1];
        return `<div class="cols vhist">${valueHist.map((h) => `<div class="col" data-tip="${esc(`${h.day}\nWartość: ${zl(h.value)}\nWydane: ${zl(h.paid)}\nPozycji: ${h.items}`)}"><span class="cb" style="height:${(h.value / vmax) * 100}%;background:${P.col}">${h === last ? `<span class="cv">${esc(zl(h.value))}</span>` : ''}</span><span class="cpaid" style="bottom:${(h.paid / vmax) * 100}%"></span><span class="cl">${esc(h.day.slice(5).split('-').reverse().join('.'))}</span></div>`).join('')}</div>
          <div class="lg"><span><i style="background:${P.col}"></i>wartość</span><span><i class="ln"></i>wydane</span></div>`
          + table(['Dzień', 'Wartość', 'Wydane', 'Pozycji'], valueHist.map((h) => [h.day, zl(h.value), zl(h.paid), String(h.items)]));
      })(), 'span2') : ''}
      ${fig('WARTOŚĆ PER KONSOLA', 'gry, konsole i akcesoria', vp.length ? legend(CAT) + hbars(vp, CAT, zl) + table(['Konsola', 'Gry', 'Konsole', 'Akcesoria', 'Razem'], vp.map((r) => [r.label, ...r.vals.map(zl), zl(r.vals.reduce((a, b) => a + b))])) : noData, 'span2')}
      ${fig('WARTOŚĆ PER KATEGORIA', 'ile jest warta każda część', value ? hbars(vc.map((r) => ({label: `${r.label} (${r.n})`, vals: r.vals, color: r.c, segColors: [r.c]})), [['', 'Wartość', P.cat[0]]], zl)
          + table(['Kategoria', 'Sztuk', 'Wartość', 'Udział'], vc.map((r) => [r.label, String(r.n), zl(r.vals[0]), pct(r.vals[0], value) + '%'])) : noData)}
      ${fig('GRY WG STATUSU', plural(games.length, 'gra', 'gry', 'gier'), games.length ? `<div class="stack" role="img" aria-label="Statusy gier">${stv.filter((x) => x[3]).map(([, l, c, n]) => `<span style="flex:${n};background:${c}" data-tip="${esc(`${l}: ${n} (${pct(n, stTot)}%)`)}"></span>`).join('')}</div>
        <div class="lg vals">${stv.map(([, l, c, n]) => `<span><i style="background:${c}"></i>${esc(l)} <b>${n}</b> <em>${pct(n, stTot)}%</em></span>`).join('')}</div>` : noData)}
      ${fig('GRY PER KONSOLA', 'ukończone i pozostałe', gp.length ? legend(DONE) + hbars(gp, DONE, (n) => String(n))
          + table(['Konsola', 'Ukończone', 'Pozostałe', 'Razem'], gp.map((r) => [r.label, String(r.vals[0]), String(r.vals[1]), String(r.vals[0] + r.vals[1])])) : noData)}
      ${fig('WYDATKI PER ROK', 'suma cen zakupu wg daty zakupu', yrs.length ? `<div class="cols">${yrs.map(([y, v]) => `<div class="col" data-tip="${esc(`${y}: ${zl(v)}`)}"><span class="cb" style="height:${(v / ymax) * 100}%;background:${P.col}">${yTop && y === yTop[0] ? `<span class="cv">${esc(zl(v))}</span>` : ''}</span><span class="cl">${y}</span></div>`).join('')}</div>`
          + table(['Rok', 'Wydane'], yrs.map(([y, v]) => [y, zl(v)])) : noData)}
    </div>`;
}
// dymek z wartościami (dodatek — te same liczby są w tabelach)
function tipMove(e) {
  const t = e.target.closest?.('[data-tip]');
  const tip = $('#tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  const y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

// ================= ustawienia =================
function openSettings() {
  const f = $('#setForm').elements;
  f.shame.checked = !!settings.shame;
  $$('#shopGrid input').forEach((c) => { c.checked = myShops().includes(c.value); });
  $('#setDlg').showModal();
  renderBackups();
}
$('#setForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    settings = await api('/api/settings', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({shame: e.target.elements.shame.checked, shops: $$('#shopGrid input:checked').map((c) => c.value)})});
    $('#setDlg').close();
    toast('Zapisano ustawienia');
    render();
  } catch (err) { toast(err.message, true); }
});

// ================= LaunchBox (zapasowe okładki) =================
function renderBanner() {
  const s = lbStatus, b = $('#banner');
  if (!s || s.state === 'ready' || s.state === 'missing') { b.hidden = true; return; }
  b.hidden = false;
  if (s.state === 'downloading') b.innerHTML = `Pobieram bazę okładek LaunchBox… <progress max="100" value="${s.progress || 0}"></progress> ${s.progress || 0}%`;
  else if (s.state === 'parsing') b.textContent = 'Indeksuję okładki LaunchBox (kilka minut)…';
  else if (s.state === 'error') b.innerHTML = `Baza okładek LaunchBox: błąd (${esc(s.message)}) <button class="btn light" id="lbRetry">Ponów</button>`;
  $('#lbRetry')?.addEventListener('click', startLb);
}
async function pollLb() {
  const prev = lbStatus?.state;
  try { lbStatus = await api('/api/launchbox/status'); } catch { return; }
  renderBanner();
  const busy = ['downloading', 'parsing'].includes(lbStatus.state);
  if (busy && !lbPoll) lbPoll = setInterval(pollLb, 3000);
  if (!busy && lbPoll) { clearInterval(lbPoll); lbPoll = null; }
  if (prev && prev !== 'ready' && lbStatus.state === 'ready') toast('Baza okładek LaunchBox gotowa');
}
async function startLb() {
  try { await api('/api/launchbox/import', {method: 'POST'}); } catch (e) { toast(e.message, true); }
  pollLb();
}

// ================= wygląd całej apki =================
const THEME_COLOR = {ps1: '#6b6a70', ps2: '#04050a', lcd: '#0f380f', crt: '#050806', dmg: '#c4c0bc', x360: '#dfe2de', w95: '#c0c0c0', red: '#000000'};
function applyTheme(t) {
  if (!THEME_COLOR[t]) t = 'ps1';
  if (t === 'ps1') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = THEME_COLOR[t];
  store.set('appTheme', t);
  $$('#themeSeg [data-th]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.th === t)));
}
function applyLang() {
  const cur = window.APP_LANG || 'pl';
  $$('#langSeg [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === cur)));
  if ((settings.lang || 'pl') !== cur) { store.set('appLang', settings.lang || 'pl'); location.reload(); return true; }
  return false;
}
async function setLang(l) {
  if (l === (window.APP_LANG || 'pl')) return;
  try { settings = await jsonPost('/api/settings', {lang: l}, 'PUT'); store.set('appLang', l); location.reload(); } catch (e) { toast(e.message, true); }
}
async function setTheme(t) {
  const prev = settings.theme;
  settings.theme = t;
  applyTheme(t);
  // statystyki idą za wyglądem apki
  const st = {lcd: 'lcd', crt: 'crt', dmg: 'lcd', ps2: 'crt', x360: 'manual', w95: 'manual'}[t];
  if (st) { statTheme = st; store.set('statTheme', st); if (!$('#stats').hidden) { renderStats(); powerOn(); } }
  try { settings = await jsonPost('/api/settings', {theme: t}, 'PUT'); } catch (e) { settings.theme = prev; applyTheme(prev); toast(e.message, true); }
}

// ================= menu / backup =================
async function menu(act) {
  $('.menu').open = false;
  if (act === 'stats') { closeColls(false); closeSubpages(false); openStats(); }
  if (act === 'colls') openColls();
  if (act === 'random') openRandom();
  if (act === 'troph') openTroph();
  if (act === 'friends') openFriends();
  if (act === 'share') openShare();
  if (act === 'settings') openSettings();
  if (act === 'tools') openTools();
  if (act === 'about') openAbout();
  if (act === 'csv') location.href = '/api/export.csv';
  if (act === 'backup') location.href = '/api/backup.json';
  if (act === 'wrapped') openWrapped();
  if (act === 'report') $('#repDlg').showModal();
  if (act === 'restore') $('#restoreFile').click();
  if (act === 'lb') startLb();
  if (act === 'logout') { await api('/api/logout', {method: 'POST'}); location.href = '/login'; }
}
$('#restoreFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file || !confirm('Przywrócić backup? Obecna zawartość zostanie zastąpiona (kopia bazy zrobi się automatycznie).')) return;
  const fd = new FormData(); fd.append('file', file);
  try {
    const r = await api('/api/restore', {method: 'POST', body: fd});
    settings = await api('/api/settings');
    applyTheme(settings.theme);
    toast(`Przywrócono ${r.restored} pozycji`); await load();
  } catch (err) { toast(err.message, true); }
});

// ================= start =================
function resetView(extra = {}) {
  Object.assign(view, {status: null, other: null, complete: null}, extra);
  selected = null;
  closeStats();
  closeColls();
  closeSubpages();
  render();
}
async function init() {
  cfg = await api('/api/config');
  window.APP_VERSION = cfg.version;
  settings = cfg.settings || settings;
  applyTheme(settings.theme);
  if (applyLang()) return;
  applyCurrency();
  $('.poopi') && $$('.poopi').forEach((el) => { el.innerHTML = POOP; });
  $('#sPlatform').innerHTML = cfg.platforms.map((p) => `<option>${esc(p)}</option>`).join('');
  form.elements.cover_lang.innerHTML = '<option value="">—</option>' + cfg.cover_langs.map((l) => `<option value="${l}">${LANG_LABEL[l] || l}</option>`).join('');
  form.elements.edition_sel.innerHTML = '<option value="">—</option>' + (cfg.editions || []).map((e) => `<option>${esc(e)}</option>`).join('') + `<option value="${OTHER}">Inne…</option>`;
  $('#accTypeList').innerHTML = (cfg.acc_types || []).map((t) => `<option value="${esc(t)}">`).join('');
  $('#specialBox').innerHTML = SPECIALS.map((s) => `<label><input type="checkbox" value="${esc(s)}"> ${esc(s)}</label>`).join('');

  $('#home').addEventListener('click', (e) => { e.preventDefault(); resetView({platform: null, kind: 'game', list: null}); });
  $('#lcd').addEventListener('click', () => { if (lcdSpin) return; closeColls(false); closeSubpages(false); openStats(); });
  $('#add').addEventListener('click', openAdd);
  $('.menu .pop').addEventListener('click', (e) => {
    const th = e.target.closest('[data-th]'); if (th) { setTheme(th.dataset.th); $('.menu').open = false; return; }
    const lg = e.target.closest('[data-lang]'); if (lg) { setLang(lg.dataset.lang); return; }
    const b = e.target.closest('[data-act]'); if (b) menu(b.dataset.act);
  });
  $('#lists').addEventListener('click', (e) => {
    const b = e.target.closest('[data-list]'); if (!b) return;
    const l = b.dataset.list;
    if (l === 'colls') { openColls(); return; }
    if (l === 'troph') { openTroph(); return; }
    if (l === 'wrapped') { const d = new Date(); openWrapped(d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()); return; }
    if (l === 'friends') { openFriends(); return; }
    resetView({list: view.list === l ? null : l, platform: null, kind: l === 'shame' ? 'game' : view.kind});
  });
  $('#carts').addEventListener('click', (e) => {
    const b = e.target.closest('.cart'); if (!b) return;
    resetView({platform: b.dataset.p || null, list: null});
  });
  $('.side').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const g = b.dataset.g, v = b.dataset.v;
    view[g] = view[g] === v ? null : v; selected = null; render();
  });
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    view.kind = b.dataset.k; view.status = view.complete = view.other = null; selected = null; render();
  });
  $('#grid').addEventListener('click', (e) => {
    const g = e.target.closest('.grp');
    if (g) { view.platform = g.dataset.p; view.status = view.other = view.complete = null; selected = null; render(); $('.main').scrollTo({top: 0}); window.scrollTo({top: 0}); return; }
    const c = e.target.closest('.card'); if (!c) return;
    selected = +c.dataset.id; renderMain(); renderDetail();
    if (narrow()) document.body.classList.add('show-detail');
  });
  $('#detail').addEventListener('click', (e) => {
    if (e.target.id === 'detail') { document.body.classList.remove('show-detail'); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const it = find(selected);
    if (it) detailAction(b.dataset.act, it).catch((err) => toast(err.message, true));
  });
  $('#detail').addEventListener('toggle', async (e) => {
    const d = e.target;
    if (!d.matches?.('details.hist') || !d.open) return;
    const hist = await api(`/api/items/${d.dataset.id}/loans`);
    d.querySelector('div').innerHTML = hist.length ? hist.map((l) => `${esc(l.borrower)}: ${esc(l.lent_on)} → ${l.returned_on ? esc(l.returned_on) : '<b>nadal</b>'}`).join('<br>') : 'Jeszcze nikomu nie pożyczana.';
  }, true);
  $('#stats').addEventListener('click', (e) => {
    if (e.target.closest('[data-sact="back"]')) closeStats();
    const t = e.target.closest('[data-theme]');
    if (t) { statTheme = t.dataset.theme; store.set('statTheme', statTheme); renderStats(); powerOn(); }
  });
  $('#stats').addEventListener('pointermove', tipMove);
  $('#stats').addEventListener('pointerleave', () => { $('#tip').hidden = true; });
  window.addEventListener('popstate', () => { if (location.hash === '#statystyki') openStats(); else closeStats(false); });
  ['q', 'sort'].forEach((id) => $('#' + id).addEventListener('input', () => { selected = null; renderSide(); renderMain(); renderDetail(); }));
  const sort = store.get('sort'); if (sort) $('#sort').value = sort;
  $('#sort').addEventListener('change', () => store.set('sort', $('#sort').value));

  // formularz
  $$('#kindTabs button[data-kind]').forEach((b) => b.addEventListener('click', () => {
    setKind(b.dataset.kind);
    if (editing === null) { if (b.dataset.kind === 'game') showSearch(); else startManual(); } else renderPic();
  }));
  $('#wishTog').addEventListener('click', () => { wishMode = !wishMode; applyVis(); setTitle(); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#sGo').addEventListener('click', search);
  $('#sManual').addEventListener('click', startManual);
  $('#sQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  $('#back').addEventListener('click', showSearch);
  $('#findCovers').addEventListener('click', () => { pending.forceCover = true; loadCovers(); });
  $('#findPhotos').addEventListener('click', loadPhotos);
  $('#priceGo').addEventListener('click', suggestPrice);
  $('#priceOut').addEventListener('click', (e) => {
    const b = e.target.closest('#priceUse'); if (!b) return;
    const el = priceTarget(); el.value = b.dataset.v; el.dispatchEvent(new Event('input', {bubbles: true}));
    el.closest('label')?.classList.add('flash'); setTimeout(() => el.closest('label')?.classList.remove('flash'), 900);
    toast('Wstawiono ' + zl(+b.dataset.v));
  });
  $('#igdbImg').addEventListener('click', async () => {
    try { await api(`/api/items/${editing}/igdb-image`, {method: 'POST'}); toast('Zdjęcie pobrane'); await load(); renderPic(); } catch (e) { toast(e.message, true); }
  });
  $('#variants').addEventListener('click', (e) => {
    if (e.target.closest('#photoGo')) { loadPhotos($('#photoQ').value); return; }
    const b = e.target.closest('button[data-i]'); if (b) pickVariant(pending.variants.covers[+b.dataset.i]);
  });
  $('#variants').addEventListener('keydown', (e) => { if (e.target.id === 'photoQ' && e.key === 'Enter') { e.preventDefault(); loadPhotos(e.target.value); } });
  $('#upload').addEventListener('change', () => { pending.coverUrl = null; pending.uploadUrl = null; form.elements.cover_frame.checked = true; renderVariants(); renderPic(); });
  form.elements.cover_frame.addEventListener('change', renderPic);
  form.elements.platform.addEventListener('input', renderPic);
  form.elements.title.addEventListener('change', renderPic);
  form.elements.acc_type.addEventListener('input', renderPic);
  form.elements.has_box.addEventListener('change', syncBox);
  form.elements.edition_sel.addEventListener('change', () => { syncEdition(); if (form.elements.edition_sel.value === OTHER) form.elements.edition.focus(); });
  form.elements.cover_lang.addEventListener('change', () => { if (pending.variants && pending.variants !== 'loading' && kind === 'game') { pending.forceCover = true; loadCovers(); } });
  $$('#dlg input,#dlg select').forEach((el) => el.addEventListener('input', () => el.closest('.invalid')?.classList.remove('invalid')));
  const stars = $('#stars');
  stars.addEventListener('pointermove', (e) => stars.style.setProperty('--p', starFromEvent(e) * 10 + '%'));
  stars.addEventListener('pointerleave', () => setStars(form.elements.rating.value));
  stars.addEventListener('click', (e) => { const v = starFromEvent(e); setStars(+form.elements.rating.value === v ? 0 : v); });
  stars.addEventListener('keydown', (e) => {
    const v = +form.elements.rating.value || 0;
    const d = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1}[e.key];
    if (d) { e.preventDefault(); setStars(v + d); }
    if (['Delete', 'Backspace', '0'].includes(e.key)) { e.preventDefault(); setStars(0); }
  });
  form.addEventListener('submit', save);

  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
  await load();
  initColls();
  initExtras();
  initMore();
  initEggs();
  await Promise.all([loadColls(), loadFriends()]);
  if (location.hash === '#statystyki') openStats();
  else { const m = location.hash.match(/^#kolekcje(?:\/(\d+))?$/); if (m) openColls(m[1] ? +m[1] : null); else { routeExtras(); routeMore(); } }
  pollLb();
}

init().catch((e) => { if (e.message !== '401') toast('Błąd: ' + e.message, true); });
