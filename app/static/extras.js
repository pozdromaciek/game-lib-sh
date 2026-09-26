/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// ================= dodatki: zdjęcia egzemplarza, trofea, „Co dziś zagrać?”, znajomi, backupy =================
// Korzysta z globali z app.js i collections.js.

const CUP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1h8v1.5h2.5V5c0 1.9-1.3 3.3-3.1 3.5A4 4 0 0 1 9 10.9V12h2.5v2.5h-7V12H7v-1.1a4 4 0 0 1-2.4-2.4C2.8 8.3 1.5 6.9 1.5 5V2.5H4zm0 3H3v1c0 .8.4 1.5 1 1.8zm8 0v2.8c.6-.3 1-1 1-1.8V4z"/></svg>';
const FRIEND_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm5.5 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM0 13c0-2.5 2.5-4.5 5.5-4.5S11 10.5 11 13v1H0zm11.6-4.4c2.4.1 4.4 1.8 4.4 4V14h-4v-1c0-1.7-.2-3-1.4-4.2z"/></svg>';
const DICE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1zM4.8 3.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6.4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM4.8 9.7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6.4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';
const TIER = {platinum: 'Platyna', gold: 'Złoto', silver: 'Srebro', bronze: 'Brąz'};

// ---------- sklepy (lista życzeń) ----------
function shopQuery(it) {
  const p = typeof PSHORT !== 'undefined' ? (PSHORT[it.platform] || it.platform || '') : (it.platform || '');
  return [it.title, it.kind === 'game' || it.kind === 'accessory' ? p : it.model].filter(Boolean).join(' ');
}
const SHOPS = {
  olx: {name: 'OLX', search: (q, slug) => `https://www.olx.pl/oferty/q-${encodeURIComponent(slug)}/`, sell: 'https://www.olx.pl/d/nowe-ogloszenie/'},
  allegro: {name: 'Allegro', search: (q) => `https://allegro.pl/listing?string=${encodeURIComponent(q)}`, sell: 'https://allegro.pl/moje-allegro/sprzedaz'},
  ebay: {name: 'eBay', search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`, sell: 'https://www.ebay.com/sl/sell'},
  ebay_de: {name: 'eBay.de', search: (q) => `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}`, sell: 'https://www.ebay.de/sl/sell'},
  ebay_uk: {name: 'eBay.co.uk', search: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}`, sell: 'https://www.ebay.co.uk/sl/sell'},
  vinted: {name: 'Vinted', search: (q) => `https://www.vinted.pl/catalog?search_text=${encodeURIComponent(q)}`, sell: 'https://www.vinted.pl/items/new'},
  pricecharting: {name: 'PriceCharting', search: (q) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`, sell: null},
};
function myShops() {
  const s = (typeof settings !== 'undefined' && Array.isArray(settings.shops)) ? settings.shops : ['olx', 'allegro', 'ebay'];
  return Object.keys(SHOPS).filter((k) => s.includes(k));
}
function shopLinks(it) {
  const q = shopQuery(it);
  const slug = q.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ks = myShops();
  if (!ks.length) return '<span class="hint">Wybierz serwisy w Ustawieniach, żeby szukać ofert.</span>';
  return ks.map((k) => `<a class="btn light" href="${SHOPS[k].search(q, slug)}" target="_blank" rel="noopener noreferrer">Szukaj: ${SHOPS[k].name} ↗</a>`).join('');
}
function sellLinks() {
  return myShops().filter((k) => SHOPS[k].sell).map((k) =>
    `<a class="btn light" href="${SHOPS[k].sell}" target="_blank" rel="noopener noreferrer">Wystaw: ${SHOPS[k].name} ↗</a>`).join('');
}

// ---------- zdjęcia egzemplarza ----------
let itemPhotos = [];            // zdjęcia pokazywanej pozycji
let phIndex = 0;
let photoSeq = 0;
function photoBox(it) {
  return `<div class="photos" data-item="${it.id}"><div class="phh"><b>Zdjęcia egzemplarza</b>
    <label class="btn light phadd">+ Dodaj<input type="file" accept="image/*" multiple hidden data-pup="${it.id}"></label></div>
    <div class="phs" id="phs"><span class="phnone">…</span></div></div>`;
}
async function loadItemPhotos(id) {
  const seq = ++photoSeq;
  let list = [];
  try { list = await api(`/api/items/${id}/photos`); } catch { /* brak */ }
  if (seq !== photoSeq || !$('#phs')) return;
  itemPhotos = list;
  renderPhotoStrip();
}
function renderPhotoStrip() {
  const box = $('#phs'); if (!box) return;
  box.innerHTML = itemPhotos.length ? itemPhotos.map((p, i) => `<button type="button" class="pht" data-phi="${i}" title="${esc(p.caption || '')}"><img src="${esc(p.thumb)}" alt="${esc(p.caption || 'Zdjęcie ' + (i + 1))}" loading="lazy"></button>`).join('')
    : '<span class="phnone">Brak — dodaj zdjęcia pudełka, płyty albo wad (np. z telefonu).</span>';
}
function showPhoto(i) {
  if (!itemPhotos.length) { $('#phDlg').close(); return; }
  phIndex = (i + itemPhotos.length) % itemPhotos.length;
  const p = itemPhotos[phIndex];
  $('#phImg').src = p.url;
  $('#phCap').value = p.caption || '';
  $('#phTitle').textContent = `ZDJĘCIE ${phIndex + 1}/${itemPhotos.length}`;
  $$('#phDlg .phnav').forEach((b) => { b.hidden = itemPhotos.length < 2; });
  if (!$('#phDlg').open) $('#phDlg').showModal();
}
async function uploadPhotos(id, files) {
  if (!files.length) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  toast(`Wysyłam ${plural(files.length, 'zdjęcie', 'zdjęcia', 'zdjęć')}…`);
  try {
    itemPhotos = await api(`/api/items/${id}/photos`, {method: 'POST', body: fd});
    renderPhotoStrip(); toast('Zdjęcia dodane'); checkTrophies();
  } catch (e) { toast(e.message, true); }
}

// ---------- trofea ----------
let trophyState = {have: 0, total: 50, trophies: [], summary: {}};
let trFilter = 'all';
const trQueue = [];
let trShowing = false;
let trBusy = false;
async function checkTrophies() {
  if (trBusy) return;
  trBusy = true;
  try {
    const r = await api('/api/trophies');
    const before = trophyState.have;
    trophyState = r;
    if (r.initial) queueTrophy({initial: r.initial});
    for (const t of r.new) queueTrophy(t);
    if (r.new.length) api('/api/trophies/seen', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({keys: r.new.map((t) => t.key)})}).catch(() => {});
    if (before !== r.have || r.initial) renderSide();
    if (!$('#troph').hidden) renderTroph();
  } catch { /* offline — spróbujemy przy następnym odświeżeniu */ } finally { trBusy = false; }
}
function queueTrophy(t) { trQueue.push(t); if (!trShowing) nextTrophy(); }
function nextTrophy() {
  const t = trQueue.shift();
  if (!t) { trShowing = false; return; }
  trShowing = true;
  const el = document.createElement('div');
  el.className = 'trt ' + (t.tier || 'gold');
  el.innerHTML = t.initial
    ? `<span class="tri2">${CUP}</span><span><small>Trofea włączone!</small><b>Masz już ${plural(t.initial, 'trofeum', 'trofea', 'trofeów')}</b></span>`
    : `<span class="tri2">${CUP}</span><span><small>Zdobyto trofeum · ${TIER[t.tier]}</small><b>${esc(t.name)}</b><em>${esc(t.desc)}</em></span>`;
  el.addEventListener('click', () => { el.remove(); openTroph(); });
  $('#trToast').append(el);
  setTimeout(() => el.classList.add('out'), 4600);
  setTimeout(() => { el.remove(); nextTrophy(); }, 5000);
}
function trCard(t) {
  const got = !!t.unlocked_at;
  const prog = t.progress ? `<span class="tprog"><i style="width:${Math.min(100, (t.progress[0] / t.progress[1]) * 100)}%"></i></span><span class="tpv">${num0(t.progress[0])} / ${num0(t.progress[1])}</span>` : '';
  return `<div class="tcard ${t.tier}${got ? ' got' : ''}"><span class="tcup">${CUP}</span><span class="tbody"><b>${esc(t.name)}</b><span class="tdesc">${esc(t.desc)}</span>
    ${got ? `<span class="tdate">Zdobyte ${esc(t.unlocked_at.slice(0, 10))}</span>` : prog}</span></div>`;
}
function renderTroph() {
  const r = trophyState;
  const list = r.trophies.filter((t) => (trFilter === 'got' ? t.unlocked_at : trFilter === 'todo' ? !t.unlocked_at : true));
  const pct = r.total ? Math.round((r.have / r.total) * 100) : 0;
  const seg = (k, l) => `<button data-tf="${k}" aria-pressed="${trFilter === k}">${l}</button>`;
  $('#troph').innerHTML = `<div class="st-head"><button class="btn light" data-back>← Wróć</button><h2>TROFEA</h2>
      <span class="seg">${seg('all', 'Wszystkie')}${seg('got', 'Zdobyte')}${seg('todo', 'Do zdobycia')}</span></div>
    <div class="tsum"><span class="clcd big">${r.have}/${r.total}</span><span class="tpct"><span class="tprog big"><i style="width:${pct}%"></i></span><b>${pct}%</b></span>
      <span class="ttiers">${Object.keys(TIER).map((k) => `<span class="tt ${k}"><span class="tcup">${CUP}</span>${r.summary[k]?.have ?? 0}<small>/${r.summary[k]?.all ?? 0}</small></span>`).join('')}</span></div>
    ${Object.entries(TIER).map(([k, l]) => {
      const ts = list.filter((t) => t.tier === k);
      if (!ts.length) return '';
      return `<section class="tier ${k}"><h3><span class="tcup">${CUP}</span>${l.toUpperCase()} <small>${r.summary[k]?.have ?? 0}/${r.summary[k]?.all ?? 0}</small></h3>
        <div class="tgrid">${ts.sort((a, b) => !!b.unlocked_at - !!a.unlocked_at).map(trCard).join('')}</div></section>`;
    }).join('') || '<div class="empty">Nic tu nie ma.</div>'}`;
}

// ---------- podstrony: trofea, znajomi ----------
function showSub(id, hash) {
  $('#stats').hidden = true; document.body.classList.remove('page-stats');
  if (typeof closeColls === 'function') closeColls(false);
  $$('.subpage').forEach((s) => { s.hidden = s.id !== id; });
  document.body.classList.add('page-sub');
  document.body.classList.remove('show-detail');
  if (location.hash !== hash) history.pushState(null, '', hash);
  window.scrollTo({top: 0});
}
function closeSubpages(push = true) {
  const open = $$('.subpage').some((s) => !s.hidden);
  $$('.subpage').forEach((s) => { s.hidden = true; });
  document.body.classList.remove('page-sub');
  $('#fpop')?.remove();
  if (open && push && /^#(trofea|znajomi|rok)/.test(location.hash)) history.pushState(null, '', location.pathname);
}
function openTroph() { showSub('troph', '#trofea'); renderTroph(); checkTrophies(); }

// ---------- „Co dziś zagrać?” ----------
let lcdSpin = false;
let rndPool = 'backlog';
let rndPick = null;
function rndCandidates() {
  const games = items.filter(isGame);
  if (rndPool === 'shame') return games.filter(onShame);
  if (rndPool === 'open') return games.filter((g) => g.status !== 'completed');
  return games.filter((g) => g.status === 'backlog');
}
function openRandom() {
  const pools = [['backlog', 'Do zagrania'], ...(settings.shame ? [['shame', 'Kupka wstydu']] : []), ['open', 'Nieukończone']];
  if (!pools.some(([k]) => k === rndPool)) rndPool = 'backlog';
  $('#rndPool').innerHTML = pools.map(([k, l]) => `<button type="button" data-rp="${k}" aria-pressed="${rndPool === k}">${l}</button>`).join('');
  rndPick = null;
  $('#rndSlot').innerHTML = `<span class="rq">?</span>`;
  $('#rndInfo').textContent = `${plural(rndCandidates().length, 'gra', 'gry', 'gier')} w puli`;
  $('#rndStart').hidden = true; $('#rndShow').hidden = true;
  $('#rndDlg').showModal();
}
async function spin() {
  const pool = rndCandidates();
  if (!pool.length) { $('#rndInfo').textContent = 'Pusto — wybierz inną pulę.'; return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  $('#rndGo').disabled = true; $('#rndStart').hidden = true; $('#rndShow').hidden = true;
  const slot = $('#rndSlot');
  const face = (g) => `${cover(g, 180, {noTags: true})}`;
  if (!reducedMotion() && pool.length > 1) {
    lcdSpin = true;
    let delay = 45;
    for (let i = 0; delay < 420; i++) {
      const g = pool[Math.floor(Math.random() * pool.length)];
      slot.innerHTML = face(g); slot.classList.toggle('blur', delay < 160);
      $('#lcdScr').innerHTML = `<span class="bootmsg">» ${esc(g.title.toUpperCase().slice(0, 34))}</span>`;
      await sleep(delay);
      delay *= 1.12;
    }
  }
  slot.classList.remove('blur');
  slot.innerHTML = face(pick);
  slot.classList.add('win');
  setTimeout(() => slot.classList.remove('win'), 900);
  $('#lcdScr').innerHTML = `<span class="bootmsg">▶ ${esc(pick.title.toUpperCase().slice(0, 36))}</span>`;
  rndPick = pick;
  $('#rndInfo').innerHTML = `<b>${esc(pick.title)}</b><br>${esc(pick.platform || '')}${pick.shame_since && settings.shame ? ` · na kupce ${ago(daysSince(pick.shame_since))}` : ''}`;
  $('#rndGo').disabled = false; $('#rndGo').innerHTML = `${DICE} Jeszcze raz`;
  $('#rndStart').hidden = pick.status === 'playing'; $('#rndShow').hidden = false;
  setTimeout(() => { lcdSpin = false; renderLcd(); }, 2500);
}

// ---------- znajomi ----------
let friends = [];
let friendOpen = null;          // {id, …, items, only_me}
let frTab = 'all';
async function loadFriends() {
  try { friends = await api('/api/friends'); } catch { friends = []; }
  renderSide();
  if (!$('#friendsPage').hidden && !friendOpen) renderFriends();
}
async function openFriends(id = null) {
  showSub('friendsPage', id ? `#znajomi/${id}` : '#znajomi');
  friendOpen = null;
  if (id) {
    try { friendOpen = await api(`/api/friends/${id}`); frTab = 'all'; } catch (e) { toast(e.message, true); }
  }
  renderFriends();
}
function frCover(e, h) {
  const it = {kind: KIND_OF[e.k] || 'game', title: e.t, platform: e.p, cover: null, cover_frame: false};
  return cover(it, h, {src: e.cover || null, frame: false, ar: 0.75, noTags: true});
}
const KIND_OF = {g: 'game', c: 'console', a: 'accessory'};
function renderFriends() {
  const box = $('#friendsPage');
  if (friendOpen) { box.innerHTML = friendDetail(friendOpen); return; }
  const cards = friends.map((f) => `<button class="ccard fcard" data-fr="${f.id}">
      <span class="cch"><b>${esc(f.name)}</b><span>kod z ${esc(f.shared_at || f.imported_at.slice(0, 10))}</span></span>
      <span class="fstats"><span class="clcd">${f.games}</span><span>gier${f.consoles ? ` · ${plural(f.consoles, 'konsola', 'konsole', 'konsol')}` : ''}${f.wishes ? ` · ${f.wishes} na liście życzeń` : ''}</span></span>
      <span class="fcommon">Wspólnych gier: <b>${f.common}</b> · ma, a Ty nie: <b>${f.games - f.common}</b></span></button>`).join('');
  box.innerHTML = `<div class="st-head"><button class="btn light" data-back>← Wróć</button><h2>ZNAJOMI</h2>
      <button class="btn light" data-fact="share">Udostępnij moją</button><button class="btn cir" data-fact="add">+ Dodaj znajomego</button></div>
    ${friends.length ? `<div class="ccards">${cards}</div>` : `<div class="empty">Nikogo tu jeszcze nie ma.<br><br>Poproś znajomego z tą apką o <b>kod kolekcji</b> (Menu → Udostępnij moją kolekcję) i wklej go tutaj.<br>Swój kod wygenerujesz przyciskiem „Udostępnij moją”.</div>`}`;
}
function friendDetail(f) {
  const games = f.items.filter((e) => e.k === 'g' && !e.w);
  const hw = f.items.filter((e) => e.k !== 'g' && !e.w);
  const wish = f.items.filter((e) => e.w);
  const common = games.filter((e) => e.mine.length);
  const theirs = games.filter((e) => !e.mine.length);
  const tabs = [['all', 'Kolekcja', games.length], ['common', 'Wspólne', common.length], ['theirs', 'Ma, a Ty nie', theirs.length],
    ['mine', 'Ty masz, on nie', f.only_me.length], ['hw', 'Sprzęt', hw.length], ['wish', 'Jego lista życzeń', wish.length]];
  const sale = f.items.filter((e) => e.fs);
  if (sale.length) tabs.splice(3, 0, ['sale', 'Na sprzedaż', sale.length]);
  const src = {all: games, common, theirs, hw, wish, sale}[frTab] || games;
  const COMP = (c) => (c == null ? '' : `<span class="icos">${['disc', 'box', 'manual'].map((k, i) => `<span class="ico${c & (1 << i) ? '' : ' off'}">${ICON[k]}</span>`).join('')}</span>`);
  const card = (e, i) => `<button class="card ccell${e.mine?.length || frTab === 'mine' ? '' : ' fr-only'}" data-fe="${i}">${frCover(e, 150)}
      <span class="t" title="${esc(e.t)}">${esc(e.t)}</span>
      <span class="m"><span>${esc(PSHORT[e.p] || e.p || '—')}${e.y ? ' · ' + e.y : ''}</span>${COMP(e.c)}</span>
      <span class="pbs">${e.mine?.length ? '<span class="pb have">✓ masz</span>' : e.my_wish ? '<span class="pb wish">★ na Twojej liście</span>' : ''}${e.s === 'completed' ? '<span class="pb">ukończył</span>' : ''}${e.v != null ? `<span class="pb val">${zl(e.v)}</span>` : ''}${e.fs ? `<span class="pb forsale">na sprzedaż${e.ap != null ? ' · ' + zl(e.ap) : ''}</span>` : ''}</span></button>`;
  const grid = frTab === 'mine'
    ? f.only_me.map((i, n) => `<button class="card ccell" data-fm="${i.id}">${cover({kind: 'game', title: i.t, platform: i.p, cover: i.cover_file, cover_frame: false}, 150, {ar: 0.75, frame: false, noTags: true})}
        <span class="t">${esc(i.t)}</span><span class="m"><span>${esc(PSHORT[i.p] || i.p || '')}</span></span><span class="pbs"><span class="pb trade">${isDupe(find(i.id) || {}) ? 'dubel — do wymiany' : 'do wymiany?'}</span></span></button>`).join('')
    : src.map((e) => card(e, f.items.indexOf(e))).join('');
  return `<div class="st-head"><button class="btn light" data-fact="list">← Znajomi</button><h2>${esc(f.name.toUpperCase())}</h2>
      <details class="menu cmenu"><summary class="btn">Opcje</summary><div class="pop"><button data-fact="update">Wklej nowszy kod…</button><hr><button data-fact="delete">Usuń znajomego</button></div></details></div>
    <div class="cprog"><span class="clcd big">${common.length}/${games.length}</span>${blocks(common.length, games.length, 40)}
      <span class="cmeta"><b>${games.length ? Math.round((common.length / games.length) * 100) : 0}%</b> jego gier masz też Ty · kod z ${esc(f.shared_at || '—')}</span></div>
    <div class="ftabs chips">${tabs.map(([k, l, n]) => `<button class="chip" data-ft="${k}" aria-pressed="${frTab === k}">${l} <b>${n}</b></button>`).join('')}</div>
    <div class="grid cgrid">${grid || '<div class="empty">Pusto.</div>'}</div>`;
}
function friendPop(btn, e) {
  $('#fpop')?.remove();
  const pop = document.createElement('div');
  pop.id = 'fpop'; pop.className = 'cpop';
  pop.innerHTML = `<b>${esc(e.t)}</b><span class="cpn">${esc(e.p || '')}${e.ed ? ' · ' + esc(e.ed) : ''}${e.rg ? ' · ' + esc(e.rg) : ''}</span>
    ${e.mine?.length ? `<button class="chip" data-fgo="${e.mine[0].id}">Pokaż mój egzemplarz</button>`
      : e.my_wish ? '<span class="cpn">Już jest na Twojej liście życzeń.</span>'
        : `<span class="cpp"><button class="chip" data-fw="1">★ Na moją listę życzeń${e.p ? ` (${esc(PSHORT[e.p] || e.p)})` : ''}</button></span>`}`;
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight < innerHeight ? r.bottom + 6 : Math.max(8, r.top - pop.offsetHeight - 6)) + 'px';
  pop.addEventListener('click', async (ev) => {
    const go = ev.target.closest('[data-fgo]');
    if (go) { pop.remove(); closeSubpages(); selected = +go.dataset.fgo; resetView({list: null, platform: null, kind: 'game'}); selected = +go.dataset.fgo; renderMain(); renderDetail(); if (narrow()) document.body.classList.add('show-detail'); return; }
    if (!ev.target.closest('[data-fw]')) return;
    try {
      await jsonPost('/api/items', {kind: KIND_OF[e.k] || 'game', title: e.t, platform: e.p || null, wish: true, igdb_id: e.ig || null,
        cover_url: e.ci ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${e.ci}.jpg` : null, release_year: e.y || null,
        region: e.rg || 'PAL', has_disc: true, has_box: true, has_manual: true});
      pop.remove(); toast(`Na liście życzeń: ${e.t}`);
      e.my_wish = true; await load(); renderFriends();
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- udostępnianie ----------
function openShare() {
  $('#shName').value = store.get('shareName') || '';
  $('#shOut').hidden = true;
  $('#shareDlg').showModal();
}
async function genShare() {
  const name = $('#shName').value.trim();
  store.set('shareName', name);
  const p = new URLSearchParams({name, prices: $('#shPrices').checked});
  $('#shGen').disabled = true;
  try {
    const r = await api('/api/share/code?' + p);
    $('#shCode').value = r.code;
    $('#shInfo').textContent = `${plural(r.items, 'pozycja', 'pozycje', 'pozycji')} · ${num0(r.length)} znaków${r.length > 20000 ? ' — długi kod, wygodniej wysłać plik' : ''}`;
    $('#shFile').href = '/api/share/code?' + p + '&file=true';
    $('#shOut').hidden = false;
  } catch (e) { toast(e.message, true); } finally { $('#shGen').disabled = false; }
}

// ---------- backupy (w Ustawieniach) ----------
async function renderBackups() {
  const box = $('#bkBox'); if (!box) return;
  box.innerHTML = '<div class="hint">Backup: sprawdzam…</div>';
  try {
    const r = await api('/api/backups');
    const last = r.backups[0];
    box.innerHTML = `<div class="bkh"><b>Backup automatyczny</b><button type="button" class="btn light" id="bkNow"${r.running ? ' disabled' : ''}>Zrób teraz</button></div>
      <div class="hint">Codziennie po ${r.hour}:00 — baza, okładki i zdjęcia w jednym pliku ZIP. Trzymam ${r.keep} ostatnich${r.copy_dir ? ' + kopia na dodatkowy dysk' : ''}.</div>
      ${r.last_error ? `<div class="pnote">${esc(r.last_error)}</div>` : ''}
      ${r.backups.length ? `<ul class="bklist">${r.backups.slice(0, 5).map((b) => `<li><a href="/api/backups/${encodeURIComponent(b.name)}">${esc(b.created)}</a><span>${(b.size / 1e6).toFixed(1)} MB</span></li>`).join('')}</ul>` : '<div class="hint">Jeszcze nie było backupu.</div>'}
      ${last ? '' : ''}`;
  } catch (e) { box.innerHTML = `<div class="pnote">${esc(e.message)}</div>`; }
}

// ---------- inicjalizacja ----------
function initExtras() {
  // zdjęcia w panelu
  $('#detail').addEventListener('change', (e) => {
    const inp = e.target.closest('[data-pup]');
    if (inp) { uploadPhotos(+inp.dataset.pup, [...inp.files]); inp.value = ''; }
  });
  $('#detail').addEventListener('click', (e) => {
    const t = e.target.closest('[data-phi]');
    if (t) showPhoto(+t.dataset.phi);
  });
  $('#phDlg').addEventListener('click', (e) => { const n = e.target.closest('[data-ph]'); if (n) showPhoto(phIndex + +n.dataset.ph); });
  $('#phDlg').addEventListener('keydown', (e) => {
    if (e.target.id === 'phCap') return;
    if (e.key === 'ArrowRight') showPhoto(phIndex + 1);
    if (e.key === 'ArrowLeft') showPhoto(phIndex - 1);
  });
  $('#phSave').addEventListener('click', async () => {
    const p = itemPhotos[phIndex]; if (!p) return;
    try { itemPhotos = await jsonPost(`/api/item-photos/${p.id}`, {caption: $('#phCap').value}, 'PUT'); renderPhotoStrip(); toast('Zapisano opis'); } catch (e) { toast(e.message, true); }
  });
  $('#phDel').addEventListener('click', async () => {
    const p = itemPhotos[phIndex]; if (!p || !confirm('Usunąć to zdjęcie?')) return;
    try { itemPhotos = await api(`/api/item-photos/${p.id}`, {method: 'DELETE'}); renderPhotoStrip(); showPhoto(phIndex); } catch (e) { toast(e.message, true); }
  });

  // trofea
  $('#troph').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { closeSubpages(); render(); return; }
    const f = e.target.closest('[data-tf]'); if (f) { trFilter = f.dataset.tf; renderTroph(); }
  });

  // losowanie
  $('#rndPool').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rp]'); if (!b) return;
    rndPool = b.dataset.rp;
    $$('#rndPool button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#rndInfo').textContent = `${plural(rndCandidates().length, 'gra', 'gry', 'gier')} w puli`;
  });
  $('#rndGo').addEventListener('click', spin);
  $('#rndStart').addEventListener('click', async () => {
    if (!rndPick) return;
    try { await jsonPost('/api/random/start', {item_id: rndPick.id}); toast(`Miłej gry: ${rndPick.title}`); $('#rndDlg').close(); await load(); } catch (e) { toast(e.message, true); }
  });
  $('#rndShow').addEventListener('click', () => {
    if (!rndPick) return;
    $('#rndDlg').close(); closeSubpages(false); closeColls(false);
    resetView({list: null, platform: null, kind: 'game'});
    selected = rndPick.id; renderMain(); renderDetail();
    if (narrow()) document.body.classList.add('show-detail');
  });
  $('#rndDlg').addEventListener('close', () => { if (lcdSpin) { lcdSpin = false; } $('#rndGo').innerHTML = `${DICE} Losuj`; renderLcd(); });
  $('#rndGo').innerHTML = `${DICE} Losuj`;

  // znajomi
  $('#friendsPage').addEventListener('click', async (e) => {
    if (e.target.closest('[data-back]')) { closeSubpages(); render(); return; }
    const c = e.target.closest('[data-fr]'); if (c) { openFriends(+c.dataset.fr); return; }
    const t = e.target.closest('[data-ft]'); if (t) { frTab = t.dataset.ft; renderFriends(); return; }
    const fe = e.target.closest('[data-fe]'); if (fe && friendOpen) { friendPop(fe, friendOpen.items[+fe.dataset.fe]); return; }
    const fm = e.target.closest('[data-fm]');
    if (fm) { closeSubpages(); resetView({list: null, platform: null, kind: 'game'}); selected = +fm.dataset.fm; renderMain(); renderDetail(); if (narrow()) document.body.classList.add('show-detail'); return; }
    const a = e.target.closest('[data-fact]')?.dataset.fact; if (!a) return;
    e.target.closest('details')?.removeAttribute('open');
    if (a === 'add' || a === 'update') { $('#frCode').value = ''; $('#frName').value = a === 'update' && friendOpen ? friendOpen.name : ''; $('#frDlg').showModal(); }
    if (a === 'share') openShare();
    if (a === 'list') openFriends();
    if (a === 'delete' && friendOpen && confirm(`Usunąć „${friendOpen.name}” ze znajomych?`)) {
      try { await api(`/api/friends/${friendOpen.id}`, {method: 'DELETE'}); await loadFriends(); openFriends(); } catch (err) { toast(err.message, true); }
    }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#fpop,[data-fe]')) $('#fpop')?.remove(); });
  $('#friendsPage').addEventListener('scroll', () => $('#fpop')?.remove());
  window.addEventListener('scroll', () => $('#fpop')?.remove());
  $('#frFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#frCode').value = (await f.text()).trim(); e.target.value = '';
  });
  $('#frForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await jsonPost('/api/friends', {code: $('#frCode').value, name: $('#frName').value.trim() || null});
      $('#frDlg').close();
      toast(r.updated ? `Zaktualizowano kolekcję: ${r.name}` : `Dodano znajomego: ${r.name}`);
      await loadFriends(); openFriends(r.id);
    } catch (err) { toast(err.message, true); }
  });
  $('#shGen').addEventListener('click', genShare);
  $('#shCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#shCode').value); toast('Skopiowano kod'); } catch { $('#shCode').select(); document.execCommand('copy'); toast('Skopiowano kod'); }
  });

  // backupy
  $('#setDlg').addEventListener('click', async (e) => {
    if (e.target.id !== 'bkNow') return;
    e.target.disabled = true; e.target.textContent = 'Robię…';
    try { const r = await api('/api/backups', {method: 'POST'}); toast(`Backup gotowy (${(r.size / 1e6).toFixed(1)} MB)`); } catch (err) { toast(err.message, true); }
    renderBackups();
  });

  // adresy podstron
  window.addEventListener('popstate', () => {
    const h = location.hash;
    if (h === '#trofea') openTroph();
    else if (/^#znajomi(\/\d+)?$/.test(h)) openFriends(h.split('/')[1] ? +h.split('/')[1] : null);
    else if (!/^#rok/.test(h)) closeSubpages(false);
  });
}
function routeExtras() {
  const h = location.hash;
  if (h === '#trofea') openTroph();
  else if (/^#znajomi(\/\d+)?$/.test(h)) openFriends(h.split('/')[1] ? +h.split('/')[1] : null);
}
