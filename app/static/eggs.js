/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// ================= easter eggi =================
// 1) Kod Konami: ↑↑↓↓←→←→ B A na klawiaturze; na telefonie: przeciągnięcia po ekranie LCD w nagłówku
//    (góra, góra, dół, dół, lewo, prawo, lewo, prawo), potem dwa stuknięcia w LCD (B, A).
//    Nagroda: ukryte trofeum + ukryty wygląd RED.
// 2) Kombinacja: kliknij △ ○ ✕ □ w nagłówku po kolei.
const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
let konamiPos = 0;
let konamiAt = 0;
function konamiStep(k) {
  const now = Date.now();
  if (now - konamiAt > 4000) konamiPos = 0;
  konamiAt = now;
  if (KONAMI[konamiPos] === k) konamiPos++;
  else konamiPos = KONAMI[0] === k ? 1 : 0;
  document.body.classList.toggle('konami-armed', konamiPos >= 8 && konamiPos < KONAMI.length);
  if (konamiPos === KONAMI.length) { konamiPos = 0; document.body.classList.remove('konami-armed'); konamiWin(); }
}
async function konamiWin() {
  const scr = $('#lcdScr');
  if (typeof lcdState !== 'undefined') lcdState = 'booting';
  document.body.classList.add('konami-shake');
  setTimeout(() => document.body.classList.remove('konami-shake'), 700);
  scr.style.minWidth = scr.offsetWidth + 'px';
  const frames = ['KOD PRZYJĘTY', '+30 ŻYĆ', 'SEKRET!'];
  for (const f of frames) { scr.innerHTML = `<span class="bootmsg">${f}</span>`; await sleep(900); }
  scr.style.minWidth = '';
  if (typeof lcdState !== 'undefined') lcdState = 'on';
  renderLcd();
  try {
    await jsonPost('/api/events', {type: 'konami'});
    cfg.unlocked = [...new Set([...(cfg.unlocked || []), 'red'])];
    showSecretThemes();
    toast('Kod przyjęty! W Menu → Wygląd czeka ukryty wygląd RED');
    checkTrophies();
  } catch (e) { toast(e.message, true); }
}
function showSecretThemes() {
  const b = $('#themeSeg [data-th=red]');
  if (b) b.hidden = !(cfg.unlocked || []).includes('red');
}
// kombinacja △ ○ ✕ □
const COMBO = ['△', '○', '✕', '□'];
let comboPos = 0;
let comboAt = 0;
function comboStep(sym, el) {
  const now = Date.now();
  if (now - comboAt > 2500) comboPos = 0;
  comboAt = now;
  comboPos = COMBO[comboPos] === sym ? comboPos + 1 : (sym === COMBO[0] ? 1 : 0);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (comboPos === COMBO.length) {
    comboPos = 0;
    $$('.sym b').forEach((b, i) => setTimeout(() => { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }, i * 90));
    const scr = $('#lcdScr');
    if (typeof lcdState !== 'undefined') lcdState = 'booting';
    scr.style.minWidth = scr.offsetWidth + 'px';
    scr.innerHTML = '<span class="bootmsg">COMBO x4!</span>';
    setTimeout(() => { scr.style.minWidth = ''; if (typeof lcdState !== 'undefined') lcdState = 'on'; renderLcd(); }, 1400);
    jsonPost('/api/events', {type: 'combo'}).then(() => checkTrophies()).catch(() => {});
  }
}
function initEggs() {
  const KEYS = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a'};
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const k = KEYS[e.key];
    if (k) konamiStep(k); else konamiPos = 0;
  });
  // telefon: przeciągnięcia po ekranie LCD, potem dwa stuknięcia
  const lcd = $('#lcd');
  let t0 = null;
  lcd.addEventListener('touchstart', (e) => { const t = e.touches[0]; t0 = {x: t.clientX, y: t.clientY}; }, {passive: true});
  lcd.addEventListener('touchend', (e) => {
    if (!t0) return;
    const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    t0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    lcd.dataset.swiped = String(Date.now());
    konamiStep(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, {passive: true});
  // po 8 przeciągnięciach stuknięcia w LCD to B i A (zamiast otwierania statystyk)
  lcd.addEventListener('click', (e) => {
    if (Date.now() - (+lcd.dataset.swiped || 0) < 400) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (konamiPos >= 8) { e.stopImmediatePropagation(); e.preventDefault(); konamiStep(konamiPos === 8 ? 'b' : 'a'); }
  }, true);
  $$('.sym b').forEach((b) => b.addEventListener('click', () => comboStep(b.textContent.trim(), b)));
  showSecretThemes();
}
