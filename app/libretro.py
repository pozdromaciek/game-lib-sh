# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""libretro-database: numery seryjne wydań (Redump / No-Intro) i darmowe okładki PAL.

DAT-y pobierane na żądanie z GitHuba do /data/libretro (odświeżane co 60 dni), parsowane
do pamięci. Okładki: thumbnails.libretro.com/<System>/Named_Boxarts/<nazwa>.png.
"""
import asyncio
import logging
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import httpx

log = logging.getLogger("kolekcja.libretro")

RAW = "https://raw.githubusercontent.com/libretro/libretro-database/master/metadat"
THUMBS = "https://thumbnails.libretro.com"
MAX_AGE = 60 * 86400
# nasza platforma → (katalog, nazwa systemu libretro)
SYSTEMS = {
    "PlayStation": ("redump", "Sony - PlayStation"),
    "PlayStation 2": ("redump", "Sony - PlayStation 2"),
    "PlayStation 3": ("redump", "Sony - PlayStation 3"),
    "PSP": ("redump", "Sony - PlayStation Portable"),
    "GameCube": ("redump", "Nintendo - GameCube"),
    "Wii": ("redump", "Nintendo - Wii"),
    "Sega Dreamcast": ("redump", "Sega - Dreamcast"),
    "Xbox": ("redump", "Microsoft - Xbox"),
    "Xbox 360": ("redump", "Microsoft - Xbox 360"),
    "Game Boy Advance": ("no-intro", "Nintendo - Game Boy Advance"),
    "Nintendo DS": ("no-intro", "Nintendo - Nintendo DS"),
    "Nintendo 3DS": ("no-intro", "Nintendo - Nintendo 3DS"),
    "Nintendo 64": ("no-intro", "Nintendo - Nintendo 64"),
    "Sega Mega Drive": ("no-intro", "Sega - Mega Drive - Genesis"),
    "SNES": ("no-intro", "Nintendo - Super Nintendo Entertainment System"),
    "NES": ("no-intro", "Nintendo - Nintendo Entertainment System"),
    "Game Boy": ("no-intro", "Nintendo - Game Boy"),
    "Game Boy Color": ("no-intro", "Nintendo - Game Boy Color"),
}
# prefiksy seriali → platforma (żeby nie ładować wszystkich baz przy wyszukiwaniu bez platformy)
SERIAL_HINTS = [
    (re.compile(r"^(SLES|SCES|SLUS|SCUS|SLPS|SCPS|SLPM|SIPS|SCED|SLED|PAPX|SCAJ|SLKA|SCKA)\d{5}"), None),  # PS1/PS2 — rozstrzyga numer
    (re.compile(r"^(BLES|BCES|BLUS|BCUS|BLJM|BCJS|BLAS|BCAS|NPEB|NPUB)"), "PlayStation 3"),
    (re.compile(r"^(ULES|UCES|ULUS|UCUS|ULJM|UCJS|ULAS|UCAS|NPJH|ULKS)"), "PSP"),
    (re.compile(r"^(DLDOL|DOL)"), "GameCube"),
    (re.compile(r"^(RVL)"), "Wii"),
    (re.compile(r"^(AGB)"), "Game Boy Advance"),
    (re.compile(r"^(NTR|TWL)"), "Nintendo DS"),
    (re.compile(r"^(CTR|KTR)"), "Nintendo 3DS"),
    (re.compile(r"^(NUS)"), "Nintendo 64"),
    (re.compile(r"^(T|MK|HDR)\d"), "Sega Dreamcast"),
]
LANG_TO_COVER = {"En": "EN", "De": "DE", "Fr": "FR", "Es": "ES", "It": "IT", "Pl": "PL"}
REGION_OF = [("Europe", "PAL"), ("Germany", "PAL"), ("France", "PAL"), ("Spain", "PAL"), ("Italy", "PAL"), ("UK", "PAL"),
             ("Poland", "PAL"), ("Australia", "PAL"), ("Scandinavia", "PAL"), ("Netherlands", "PAL"),
             ("USA", "NTSC-U"), ("Canada", "NTSC-U"), ("Brazil", "NTSC-U"), ("Japan", "NTSC-J"), ("Korea", "NTSC-J"), ("Asia", "NTSC-J")]

_games: dict = {}          # platforma → lista wpisów
_locks: dict = {}
_thumb_ok: dict = {}


def M():
    from . import main
    return main


def sernorm(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def looks_like_serial(q: str) -> bool:
    n = sernorm(q)
    if not (5 <= len(n) <= 16) or len(q.split()) > 3:
        return False
    return bool(re.match(r"^[A-Z]{4}\d{5}", n) or re.match(r"^(DLDOL|DOL|RVL|AGB|NTR|TWL|CTR|KTR|NUS)[A-Z0-9]{4}", n)
                or re.match(r"^(T|MK|HDR)\d{4,5}", n))


def clean_title(name: str) -> str:
    t = re.sub(r"\s*\([^)]*\)", "", name).strip()
    # „Legend of Zelda, The - …” → „The Legend of Zelda - …”
    m = re.match(r"^(.*?), (The|A|An|Die|Der|Das|Le|La|Les)( - .*)?$", t)
    if m:
        t = f"{m.group(2)} {m.group(1)}{m.group(3) or ''}"
    return t.replace(" - ", ": ", 1) if " - " in t and ":" not in t else t


def parse_tags(name: str) -> dict:
    tags = re.findall(r"\(([^)]*)\)", name)
    region, langs = None, []
    for t in tags:
        parts = [p.strip() for p in t.split(",")]
        if region is None and any(p in dict(REGION_OF) for p in parts):
            for key, reg in REGION_OF:
                if key in parts:
                    region = reg
                    break
        elif all(re.fullmatch(r"[A-Z][a-z](-[A-Z][a-z])?", p) for p in parts):
            langs = parts
    return {"region": region, "langs": langs}


def cover_lang(langs: list, region: Optional[str]) -> Optional[str]:
    if len(langs) > 1:
        return "MULTI"
    if len(langs) == 1:
        return LANG_TO_COVER.get(langs[0][:2])
    return "EN" if region in ("NTSC-U",) else None


def _parse(text: str) -> list:
    out = []
    for block in re.finditer(r'game \(\s*name "((?:[^"\\]|\\.)*)"(.*?)\n\)', text, re.S):
        name = block.group(1)
        body = block.group(2)
        sm = re.search(r'^\s*serial "([^"]*)"', body, re.M)
        serials = [s.strip() for s in (sm.group(1).split(",") if sm else []) if s.strip()]
        out.append({"name": name, "serials": serials, "norms": [sernorm(s) for s in serials]})
    return out


async def load_system(platform: str) -> list:
    if platform in _games:
        return _games[platform]
    if platform not in SYSTEMS:
        return []
    lock = _locks.setdefault(platform, asyncio.Lock())
    async with lock:
        if platform in _games:
            return _games[platform]
        folder, system = SYSTEMS[platform]
        d = M().DATA / "libretro"
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{system}.dat"
        if not path.exists() or time.time() - path.stat().st_mtime > MAX_AGE:
            try:
                c = await M().http()
                r = await c.get(f"{RAW}/{folder}/{quote(system)}.dat", timeout=60)
                r.raise_for_status()
                path.write_bytes(r.content)
            except httpx.HTTPError as e:
                log.warning("libretro %s: %s", system, e)
                if not path.exists():
                    return []
        text = await asyncio.to_thread(path.read_text, "utf-8", "replace")
        _games[platform] = await asyncio.to_thread(_parse, text)
        log.info("libretro %s: %d wydań", system, len(_games[platform]))
        return _games[platform]


def guess_platforms(q: str) -> list:
    n = sernorm(q)
    for rx, plat in SERIAL_HINTS:
        m = rx.match(n)
        if m:
            if plat:
                return [plat]
            # PS1 vs PS2: SLES-0xxxx/1xxxx/…/3xxxx = PS1, 5xxxx+ = PS2 (przybliżenie)
            num = re.search(r"\d{5}", n)
            return ["PlayStation 2", "PlayStation"] if num and num.group(0)[0] in "5678" else ["PlayStation", "PlayStation 2"]
    return []


def thumb_url(platform: str, name: str, kind: str = "Named_Boxarts") -> str:
    system = SYSTEMS[platform][1]
    safe = re.sub(r'[&*/:`<>?\\|"]', "_", name)
    return f"{THUMBS}/{quote(system)}/{kind}/{quote(safe)}.png"


async def thumb_exists(url: str) -> bool:
    if url in _thumb_ok:
        return _thumb_ok[url]
    try:
        c = await M().http()
        r = await c.head(url, timeout=10)
        ok = r.status_code == 200
    except httpx.HTTPError:
        ok = False
    _thumb_ok[url] = ok
    return ok


def _entry(platform: str, g: dict) -> dict:
    tags = parse_tags(g["name"])
    return {"source": "libretro", "platform": platform, "title": clean_title(g["name"]), "release_name": g["name"],
            "serial": g["serials"][0] if g["serials"] else None, "region": tags["region"],
            "langs": tags["langs"], "cover_lang": cover_lang(tags["langs"], tags["region"]),
            "cover_url": thumb_url(platform, g["name"])}


async def by_serial(q: str, platform: Optional[str] = None) -> list:
    n = sernorm(q)
    guess = guess_platforms(q)
    plats = ([platform] if platform in SYSTEMS else []) + [g for g in guess if g != platform]
    out, seen = [], set()
    for p in plats:
        if out:            # znaleziono na wybranej platformie — nie szukaj dalej
            break
        for g in await load_system(p):
            if any(n == s or (len(n) >= 4 and (n in s or (len(s) >= 6 and s in n)))
                   or (len(s) == 4 and n.startswith(("AGB", "NTR", "TWL", "CTR", "KTR", "NUS")) and n[3:7] == s)
                   for s in g["norms"]):
                key = (p, g["name"].split(" (Rev")[0])
                if key in seen:
                    continue
                seen.add(key)
                out.append(_entry(p, g))
                if len(out) >= 12:
                    break
    # dokładne dopasowania najpierw
    out.sort(key=lambda e: sernorm(e["serial"] or "") != n)
    return out


def _tnorm(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", " ", (s or "").lower().replace("&", " and "))
    return " ".join(w for w in s.split() if w not in ("the", "a", "an"))


async def boxarts(title: str, platform: str, region: Optional[str] = "PAL", limit: int = 4) -> list:
    """Okładki wydań pasujących tytułem (najpierw region z formularza)."""
    if platform not in SYSTEMS:
        return []
    want = _tnorm(title)
    if not want:
        return []
    cands = []
    for g in await load_system(platform):
        t = _tnorm(clean_title(g["name"]))
        if t == want or t.replace(" ", "") == want.replace(" ", ""):
            tags = parse_tags(g["name"])
            score = (0 if tags["region"] == (region or "PAL") else 1, 1 if "(Rev" in g["name"] or "(Beta" in g["name"] or "(Demo" in g["name"] else 0)
            cands.append((score, g))
    cands.sort(key=lambda x: x[0])
    out, names = [], set()
    for _, g in cands:
        base = re.sub(r"\s*\((Rev|Disc) [^)]*\)", "", g["name"])
        if base in names:
            continue
        names.add(base)
        e = _entry(platform, g)
        if await thumb_exists(e["cover_url"]):
            out.append(e)
        if len(out) >= limit:
            break
    return out
