/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// ================= kolekcje (osobna podstrona #kolekcje) =================
// Korzysta z globali z app.js: $, $$, esc, api, jsonPost, toast, plural, cover, load, cfg, PCOLOR.

const PSHORT = {
  'PlayStation': 'PS1', 'PlayStation 2': 'PS2', 'PlayStation 3': 'PS3', 'PlayStation 4': 'PS4', 'PlayStation 5': 'PS5',
  'PSP': 'PSP', 'PS Vita': 'Vita', 'Xbox': 'Xbox', 'Xbox 360': 'X360', 'Xbox One': 'XOne', 'Xbox Series X|S': 'XSX',
  'NES': 'NES', 'SNES': 'SNES', 'Nintendo 64': 'N64', 'GameCube': 'GC', 'Wii': 'Wii', 'Wii U': 'Wii U',
  'Nintendo Switch': 'Switch', 'Game Boy': 'GB', 'Game Boy Color': 'GBC', 'Game Boy Advance': 'GBA',
  'Nintendo DS': 'DS', 'Nintendo 3DS': '3DS', 'Sega Mega Drive': 'MD', 'Sega Dreamcast': 'DC', 'PC': 'PC',
};
const FAMILIES = {
  playstation: ['PlayStation', ['PlayStation', 'PlayStation 2', 'PlayStation 3', 'PlayStation 4', 'PlayStation 5', 'PSP', 'PS Vita']],
  xbox: ['Xbox', ['Xbox', 'Xbox 360', 'Xbox One', 'Xbox Series X|S']],
  nintendo: ['Nintendo', ['NES', 'SNES', 'Nintendo 64', 'GameCube', 'Wii', 'Wii U', 'Nintendo Switch', 'Game Boy',
    'Game Boy Color', 'Game Boy Advance', 'Nintendo DS', 'Nintendo 3DS']],
  sega: ['Sega', ['Sega Mega Drive', 'Sega Dreamcast']],
  pc: ['PC', ['PC']],
};
const ETYPE = {main: 'Gra', dlc: 'Dodatek', expansion: 'Rozszerzenie', spinoff: 'Spin-off', remaster: 'Remaster', remake: 'Remake', port: 'Port', bundle: 'Składanka', manual: 'Ręcznie'};

let colls = [];
let collOpen = null;          // id otwartej kolekcji
let collFilter = 'all';       // all | have | miss

const scopePlatforms = (c) => (c.scope === 'platform' ? [c.scope_value]
  : c.scope === 'family' ? (FAMILIES[c.scope_value]?.[1] || []) : null);
function scopeLabel(c) {
  if (c.source?.type === 'exclusive') return `Tylko na ${c.scope_value}`;
  if (c.scope === 'platform') return c.scope_value;
  if (c.scope === 'family') return 'Rodzina ' + (FAMILIES[c.scope_value]?.[0] || c.scope_value);
  return 'Dowolna platforma';
}
const shown = (c) => c.entries.filter((e) => !e.hidden);
const haveCount = (c) => shown(c).filter((e) => e.owned.length).length;

function blocks(have, total, max = 24) {
  // pasek jak bloki karty pamięci: jeden blok = jedna gra (przy dużych seriach proporcjonalnie)
  const n = Math.min(total, max);
  const on = total ? Math.round((have / total) * n) : 0;
  return `<span class="cblocks" style="--n:${n}">${Array.from({length: n}, (_, i) => `<i${i < on ? ' class="on"' : ''}></i>`).join('')}</span>`;
}

function collCover(e, h) {
  const own = e.owned[0];
  const it = {kind: 'game', title: e.title, platform: own?.platform || '', cover: null, cover_frame: false};
  return cover(it, h, {src: e.cover || null, frame: false, ar: 0.75, noTags: true});
}

// ---------- widoki ----------
function renderColls() {
  const box = $('#colls');
  if (collOpen != null) {
    const c = colls.find((x) => x.id === collOpen);
    if (c) { box.innerHTML = collDetail(c); return; }
    collOpen = null;
  }
  const cards = colls.map((c) => {
    const s = shown(c);
    const have = haveCount(c);
    const strip = s.slice(0, 8).map((e) => `<span class="cm${e.owned.length ? '' : ' miss'}">${collCover(e, 64)}</span>`).join('');
    return `<button class="ccard" data-coll="${c.id}">
      <span class="cch"><b>${esc(c.name)}</b><span>${esc(scopeLabel(c))}</span></span>
      <span class="ccs">${strip}${s.length > 8 ? `<span class="more">+${s.length - 8}</span>` : ''}</span>
      <span class="ccf"><span class="clcd">${have}/${s.length}</span>${blocks(have, s.length)}<span class="cpc">${s.length ? Math.round((have / s.length) * 100) : 0}%</span></span>
    </button>`;
  }).join('');
  box.innerHTML = `<div class="st-head"><button class="btn light" data-cact="back">← Wróć</button><h2>KOLEKCJE</h2>
      <button class="btn cir" data-cact="new">+ Nowa kolekcja</button></div>
    ${colls.length ? `<div class="ccards">${cards}</div>`
      : '<div class="empty">Nie masz jeszcze kolekcji. Utwórz pierwszą — np. „Grand Theft Auto” albo „Gran Turismo na PS2”.</div>'}`;
}

function collDetail(c) {
  const s = shown(c);
  const have = haveCount(c);
  const list = s.filter((e) => (collFilter === 'have' ? e.owned.length : collFilter === 'miss' ? !e.owned.length : true));
  const cards = list.map((e) => {
    const own = e.owned.length > 0;
    const plats = own ? [...new Set(e.owned.map((o) => o.platform))] : [];
    const badges = own
      ? plats.map((p) => `<span class="pb" style="--c:${PCOLOR[p] || '#555'}">${esc(PSHORT[p] || p)}</span>`).join('')
      : e.wish.length ? `<span class="pb wish">★ na liście</span>` : '<span class="pb miss">BRAK</span>';
    return `<button class="card ccell${own ? '' : ' miss'}" data-entry="${e.id}">${collCover(e, 150)}
      <span class="t" title="${esc(e.title)}">${esc(e.title)}</span>
      <span class="m"><span>${e.year || '—'}${e.type && e.type !== 'main' ? ' · ' + esc(ETYPE[e.type] || e.type) : ''}</span></span>
      <span class="pbs">${badges}</span></button>`;
  }).join('');
  const seg = (k, l, n) => `<button data-cf="${k}" aria-pressed="${collFilter === k}">${l} ${n}</button>`;
  return `<div class="st-head"><button class="btn light" data-cact="list">← Kolekcje</button>
      <h2>${esc(c.name.toUpperCase())}</h2>
      <span class="seg">${seg('all', 'Wszystkie', s.length)}${seg('have', 'Mam', have)}${seg('miss', 'Brakuje', s.length - have)}</span>
      <details class="menu cmenu"><summary class="btn">Opcje</summary><div class="pop">
        <button data-cact="edit">Edytuj…</button><button data-cact="refresh">Odśwież z IGDB</button><hr><button data-cact="delete">Usuń kolekcję</button></div></details>
    </div>
    <div class="cprog"><span class="clcd big">${have}/${s.length}</span>${blocks(have, s.length, 40)}
      <span class="cmeta"><b>${Math.round(s.length ? (have / s.length) * 100 : 0)}%</b> · ${esc(scopeLabel(c))}${c.source?.name ? ` · seria IGDB „${esc(c.source.name)}”` : ''}</span></div>
    <div class="grid cgrid">${cards || '<div class="empty">Nic tu nie ma.</div>'}</div>`;
}

// ---------- brakująca gra → lista życzeń ----------
function missPop(btn, c, e) {
  $('#cpop')?.remove();
  const allowed = scopePlatforms(c);
  const plats = (e.platforms || []).filter((p) => !allowed || allowed.includes(p));
  const pop = document.createElement('div');
  pop.id = 'cpop';
  pop.className = 'cpop';
  pop.innerHTML = `<b>${esc(e.title)}</b>${e.wish.length ? `<span class="cpn">Już na liście życzeń (${esc(e.wish.map((w) => PSHORT[w.platform] || w.platform).join(', '))})</span>` : ''}
    <span class="cpn">Dodaj do listy życzeń na:</span>
    <span class="cpp">${plats.map((p) => `<button class="chip" data-wp="${esc(p)}">${esc(PSHORT[p] || p)}</button>`).join('') || '<i>brak znanych platform</i>'}</span>`;
  document.body.append(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  const below = r.bottom + 6 + pop.offsetHeight < innerHeight;
  pop.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - pop.offsetHeight - 6)) + 'px';
  pop.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-wp]'); if (!b) return;
    try {
      await jsonPost('/api/items', {kind: 'game', title: e.title, platform: b.dataset.wp, wish: true, igdb_id: e.igdb_id,
        cover_url: e.cover_url || null, release_year: e.year || null, region: 'PAL', has_disc: true, has_box: true, has_manual: true});
      pop.remove(); toast(`Dodano do listy życzeń: ${e.title}`);
      await load(); await loadColls();
    } catch (err) { toast(err.message, true); }
  });
}

// ---------- tworzenie / edycja ----------
const cdraft = {name: '', source: null, scope: 'any', scope_value: '', include: {main: true, expansion: false, dlc: false, remaster: 'either', bundle: false}, entries: [], editing: null};
function openCollDlg(c) {
  Object.assign(cdraft, c
    ? {name: c.name, source: c.source, scope: c.scope, scope_value: c.scope_value || '', include: {...c.include}, entries: c.entries.map((e) => ({...e})), editing: c.id}
    : {name: '', source: null, scope: 'any', scope_value: '', include: {main: true, expansion: false, dlc: false, remaster: 'either', bundle: false}, entries: [], editing: null});
  $('#collDlg h2').textContent = c ? 'EDYTUJ KOLEKCJĘ' : 'NOWA KOLEKCJA';
  $('#cName').value = cdraft.name;
  $('#cSeries').innerHTML = '';
  renderCollForm();
  $('#collDlg').showModal();
  if (!c) $('#cName').focus();
}
function renderCollForm() {
  $$('#cScope button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === cdraft.scope)));
  const sv = $('#cScopeVal');
  sv.hidden = cdraft.scope === 'any';
  if (cdraft.scope === 'family') {
    sv.innerHTML = Object.entries(FAMILIES).map(([k, [l]]) => `<option value="${k}">${esc(l)}</option>`).join('');
    if (!FAMILIES[cdraft.scope_value]) cdraft.scope_value = 'playstation';
  } else if (cdraft.scope === 'platform') {
    sv.innerHTML = (cfg.platforms || Object.keys(PSHORT)).map((p) => `<option>${esc(p)}</option>`).join('');
    if (!(cfg.platforms || []).includes(cdraft.scope_value)) cdraft.scope_value = cfg.platforms?.[0] || 'PlayStation 2';
  }
  sv.value = cdraft.scope_value;
  const inc = cdraft.include;
  $$('#cInc input[type=checkbox]').forEach((i) => { i.checked = !!inc[i.name]; });
  $('#cRemaster').value = inc.remaster;
  $('#cSrc').innerHTML = cdraft.source
    ? `${cdraft.source.type === 'exclusive' ? 'Exclusive\'y platformy' : 'Seria IGDB'}: <b>${esc(cdraft.source.name)}</b> <button type="button" class="lnk" data-cx="unsrc">zmień</button>` : '';
  $('#cExcl').hidden = !!cdraft.source;
  const ep = $('#cExPlat');
  if (!ep.options.length) ep.innerHTML = Object.keys(cfg.platform_ids || {}).filter((p) => p !== 'PC').map((p) => `<option>${esc(p)}</option>`).join('');
  renderPreview();
}
function entryVisible(e) {
  const inc = cdraft.include;
  if (e.type === 'manual' || e.forced) return true;
  if (e.type === 'main' || e.type === 'port') return inc.main;
  if (e.type === 'remaster' || e.type === 'remake') {
    if (inc.remaster === 'skip') return false;
    // tryb „either”: remaster oryginału z tej serii zalicza oryginał — nie jest osobną pozycją
    return !(inc.remaster === 'either' && e.alt_of && cdraft.entries.some((o) => o.igdb_id === e.alt_of));
  }
  return !!inc[e.type];
}
function inScope(e) {
  const allowed = scopePlatforms(cdraft);
  return !allowed || e.type === 'manual' || (e.platforms || []).some((p) => allowed.includes(p));
}
function renderPreview() {
  const rows = cdraft.entries.filter((e) => entryVisible(e) && inScope(e));
  const on = rows.filter((e) => !e.hidden).length;
  $('#cCount').textContent = cdraft.entries.length ? `${on} z ${rows.length} zaznaczonych` : '';
  $('#cList').innerHTML = rows.length ? rows.map((e) => `<label class="crow${e.hidden ? ' off' : ''}">
      <input type="checkbox" data-ce="${e.id}" ${e.hidden ? '' : 'checked'}>
      <span class="cy">${e.year || '—'}</span><span class="ct">${esc(e.title)}</span>
      ${e.type !== 'main' ? `<span class="ctg">${esc(ETYPE[e.type] || e.type)}</span>` : ''}
      <span class="cps">${(e.platforms || []).map((p) => esc(PSHORT[p] || p)).join(' · ')}</span>
      ${e.owned?.length ? '<span class="cown">✓ masz</span>' : ''}</label>`).join('')
    : `<div class="cempty">${cdraft.source ? 'Żadna gra nie pasuje do wybranych opcji.' : 'Wybierz serię z IGDB albo dodawaj gry ręcznie poniżej.'}</div>`;
}

async function loadColls() {
  try { colls = await api('/api/collections'); } catch (e) { colls = []; toast(e.message, true); }
  if (!$('#colls').hidden) renderColls();
  if (typeof renderSide === 'function') renderSide();
}
function openColls(id = null) {
  $('#stats').hidden = true; document.body.classList.remove('page-stats');
  if (typeof closeSubpages === 'function') closeSubpages(false);
  $('#colls').hidden = false;
  document.body.classList.add('page-colls');
  document.body.classList.remove('show-detail');
  collOpen = id; collFilter = 'all';
  const h = id != null ? `#kolekcje/${id}` : '#kolekcje';
  if (location.hash !== h) history.pushState(null, '', h);
  renderColls();
  window.scrollTo({top: 0});
}
function closeColls(push = true) {
  if ($('#colls').hidden) return;
  $('#colls').hidden = true;
  document.body.classList.remove('page-colls');
  $('#cpop')?.remove();
  if (push && location.hash.startsWith('#kolekcje')) history.pushState(null, '', location.pathname);
}

function initColls() {
  const box = $('#colls');
  box.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-coll]');
    if (card) { openColls(+card.dataset.coll); return; }
    const f = e.target.closest('[data-cf]');
    if (f) { collFilter = f.dataset.cf; renderColls(); return; }
    const cell = e.target.closest('[data-entry]');
    if (cell) {
      const c = colls.find((x) => x.id === collOpen);
      const en = c?.entries.find((x) => String(x.id) === cell.dataset.entry);
      if (!en) return;
      if (en.owned.length) {
        closeColls();
        const it = find(en.owned[0].id);
        Object.assign(view, {list: null, platform: null, kind: 'game', status: null, other: null, complete: null});
        render(); selected = en.owned[0].id; renderMain(); renderDetail();
        if (it && narrow()) document.body.classList.add('show-detail');
        return;
      }
      missPop(cell, c, en); return;
    }
    const a = e.target.closest('[data-cact]')?.dataset.cact;
    if (!a) return;
    e.target.closest('details')?.removeAttribute('open');
    const c = colls.find((x) => x.id === collOpen);
    if (a === 'back') closeColls();
    else if (a === 'list') openColls();
    else if (a === 'new') openCollDlg(null);
    else if (a === 'edit' && c) openCollDlg(c);
    else if (a === 'refresh' && c) {
      try { await api(`/api/collections/${c.id}/refresh`, {method: 'POST'}); toast('Odświeżono z IGDB'); await loadColls(); } catch (err) { toast(err.message, true); }
    } else if (a === 'delete' && c) {
      if (!confirm(`Usunąć kolekcję „${c.name}”? Gry w kolekcji zostają.`)) return;
      try { await api(`/api/collections/${c.id}`, {method: 'DELETE'}); collOpen = null; await loadColls(); openColls(); } catch (err) { toast(err.message, true); }
    }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#cpop,[data-entry]')) $('#cpop')?.remove(); });
  box.addEventListener('scroll', () => $('#cpop')?.remove());
  window.addEventListener('scroll', () => $('#cpop')?.remove());

  // dialog
  const dlg = $('#collDlg');
  let st;
  $('#cName').addEventListener('input', () => {
    cdraft.name = $('#cName').value;
    clearTimeout(st);
    const q = cdraft.name.trim();
    if (q.length < 2 || cdraft.source) { $('#cSeries').innerHTML = ''; return; }
    st = setTimeout(async () => {
      try {
        const r = await api('/api/collections/series?q=' + encodeURIComponent(q));
        $('#cSeries').innerHTML = r.length ? '<span class="cl">Serie z IGDB:</span>' + r.map((s, i) =>
          `<button type="button" class="chip" data-si="${i}">${esc(s.name)} <b>${s.games}</b></button>`).join('') : '<span class="cl">Brak serii w IGDB — dodaj gry ręcznie.</span>';
        $('#cSeries')._r = r;
      } catch (err) { $('#cSeries').innerHTML = `<span class="cl">${esc(err.message)}</span>`; }
    }, 350);
  });
  $('#cSeries').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-si]'); if (!b) return;
    const s = $('#cSeries')._r[+b.dataset.si];
    cdraft.source = {type: s.type, id: s.id, name: s.name};
    if (!cdraft.name.trim()) { cdraft.name = s.name; $('#cName').value = s.name; }
    $('#cSeries').innerHTML = '';
    $('#cList').innerHTML = '<div class="cempty">Pobieram gry z IGDB…</div>';
    try {
      const r = await jsonPost('/api/collections/preview', {source: cdraft.source});
      const manual = cdraft.entries.filter((x) => x.type === 'manual');
      cdraft.entries = [...r, ...manual];
    } catch (err) { toast(err.message, true); }
    renderCollForm();
  });
  $('#cExGo').addEventListener('click', async () => {
    const plat = $('#cExPlat').value, pid = (cfg.platform_ids || {})[plat];
    if (!pid) return;
    cdraft.source = {type: 'exclusive', id: pid, name: plat};
    cdraft.scope = 'platform'; cdraft.scope_value = plat;
    if (!cdraft.name.trim()) { cdraft.name = `Exclusive'y: ${plat}`; $('#cName').value = cdraft.name; }
    $('#cSeries').innerHTML = '';
    $('#cList').innerHTML = '<div class="cempty">Szukam gier wydanych tylko na tę platformę…</div>';
    $('#cExcl').hidden = true;
    try {
      const r = await jsonPost('/api/collections/preview', {source: cdraft.source});
      const manual = cdraft.entries.filter((x) => x.type === 'manual');
      cdraft.entries = [...r, ...manual];
      if (!r.length) toast('IGDB nie zwrócił żadnych exclusive\'ów dla tej platformy', true);
    } catch (err) { toast(err.message, true); }
    renderCollForm();
  });
  $('#cSrc').addEventListener('click', (e) => { if (e.target.closest('[data-cx=unsrc]')) { cdraft.source = null; cdraft.entries = cdraft.entries.filter((x) => x.type === 'manual'); renderCollForm(); $('#cName').dispatchEvent(new Event('input')); } });
  $('#cScope').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { cdraft.scope = b.dataset.s; renderCollForm(); } });
  $('#cScopeVal').addEventListener('change', (e) => { cdraft.scope_value = e.target.value; renderPreview(); });
  $('#cInc').addEventListener('change', (e) => {
    if (e.target.id === 'cRemaster') cdraft.include.remaster = e.target.value;
    else if (e.target.name) cdraft.include[e.target.name] = e.target.checked;
    renderPreview();
  });
  $('#cList').addEventListener('change', (e) => {
    const en = cdraft.entries.find((x) => String(x.id) === e.target.dataset.ce);
    if (en) { en.hidden = !e.target.checked; renderPreview(); }
  });
  // ręczne dodawanie gry (wyszukiwarka IGDB z formularza)
  let mt;
  $('#cAdd').addEventListener('input', () => {
    clearTimeout(mt);
    const q = $('#cAdd').value.trim();
    if (q.length < 2) { $('#cAddRes').innerHTML = ''; return; }
    mt = setTimeout(async () => {
      try {
        const r = await api('/api/collections/games?q=' + encodeURIComponent(q));
        $('#cAddRes')._r = r;
        $('#cAddRes').innerHTML = r.slice(0, 8).map((g, i) => `<button type="button" class="chip" data-ai="${i}">${esc(g.title)}${g.year ? ` (${g.year})` : ''}</button>`).join('');
      } catch (err) { $('#cAddRes').innerHTML = `<span class="cl">${esc(err.message)}</span>`; }
    }, 350);
  });
  $('#cAddRes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ai]'); if (!b) return;
    const g = $('#cAddRes')._r[+b.dataset.ai];
    if (!cdraft.entries.some((x) => x.igdb_id && x.igdb_id === g.igdb_id)) {
      cdraft.entries.push({id: 'm' + (g.igdb_id || Date.now()), igdb_id: g.igdb_id, title: g.title, year: g.year, platforms: g.platforms || [],
        cover_url: g.cover_url || null, type: 'manual', owned: [], wish: []});
    }
    $('#cAdd').value = ''; $('#cAddRes').innerHTML = '';
    renderPreview();
  });
  $('#collForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#cName').value.trim();
    if (!name) { toast('Podaj nazwę kolekcji', true); return; }
    const body = {name, source: cdraft.source, scope: cdraft.scope, scope_value: cdraft.scope === 'any' ? null : cdraft.scope_value,
      include: cdraft.include,
      entries: cdraft.entries.filter((x) => entryVisible(x) && inScope(x)).map((x) => ({igdb_id: x.igdb_id, title: x.title, year: x.year,
        platforms: x.platforms, cover_url: x.cover_url, type: x.type, hidden: !!x.hidden,
        alt_ids: [...new Set([...(x.alt_ids || []), ...(cdraft.include.remaster === 'either'
          ? cdraft.entries.filter((r) => r.alt_of && r.alt_of === x.igdb_id).map((r) => r.igdb_id) : [])])]}))};
    try {
      const r = cdraft.editing != null ? await jsonPost(`/api/collections/${cdraft.editing}`, body, 'PUT') : await jsonPost('/api/collections', body);
      dlg.close(); await loadColls(); openColls(r.id); toast('Zapisano kolekcję');
    } catch (err) { toast(err.message, true); }
  });

  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#kolekcje(?:\/(\d+))?$/);
    if (m) openColls(m[1] ? +m[1] : null); else closeColls(false);
  });
}
