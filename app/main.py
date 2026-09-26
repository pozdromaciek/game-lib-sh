# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Moja kolekcja — biblioteka fizycznych gier, konsol i akcesoriów.

FastAPI + SQLite. Dane o grach: IGDB. Okładki: ScreenScraper (gdy są klucze),
zapas: LaunchBox Games DB, na końcu okładka z IGDB.
"""
import asyncio
import csv
import gzip
import hashlib
import hmac
import io
import json
import logging
import os
import re
import shutil
import sqlite3
import time
from collections import OrderedDict
from contextlib import asynccontextmanager, contextmanager
from datetime import date
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlparse

import httpx
from PIL import Image
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import backups, libretro, ocr, photos, reports, sales, setup, share, system, tls, trophies
from . import collections as colls
from . import config as appcfg
from . import prices
from .launchbox import LaunchBox
from .screenscraper import ScreenScraper

log = logging.getLogger("kolekcja")
APP_NAME = "Moja kolekcja"

# --- konfiguracja (.env albo kreator pierwszego uruchomienia → /data/config.json) ---
DATA = Path(os.getenv("DATA_DIR", "/data"))
COVERS = DATA / "covers"
DB_PATH = DATA / "kolekcja.db"
STATIC = Path(__file__).parent / "static"

SECRET = appcfg.secret_key()
SESSION_DAYS = 30


def igdb_on() -> bool:
    return appcfg.service_on("igdb")

COVERS.mkdir(parents=True, exist_ok=True)

# Nazwa platformy -> ID platformy w IGDB
PLATFORMS = {
    "Xbox": 11, "Xbox 360": 12, "Xbox One": 49, "Xbox Series X|S": 169,
    "PlayStation": 7, "PlayStation 2": 8, "PlayStation 3": 9, "PlayStation 4": 48,
    "PlayStation 5": 167, "PSP": 38, "PS Vita": 46,
    "NES": 18, "SNES": 19, "Nintendo 64": 4, "GameCube": 21, "Wii": 5, "Wii U": 41,
    "Nintendo Switch": 130, "Game Boy": 33, "Game Boy Color": 22,
    "Game Boy Advance": 24, "Nintendo DS": 20, "Nintendo 3DS": 37,
    "Sega Mega Drive": 29, "Sega Dreamcast": 23, "PC": 6,
}
COVER_LANGS = ["PL", "EN", "DE", "FR", "ES", "IT", "MULTI", "INNY"]

# --- baza danych -----------------------------------------------------------
MIGRATIONS = [
    """
    CREATE TABLE items (
        id            INTEGER PRIMARY KEY,
        kind          TEXT NOT NULL DEFAULT 'game' CHECK (kind IN ('game','console','accessory')),
        title         TEXT NOT NULL,
        platform      TEXT,
        region        TEXT DEFAULT 'PAL',
        edition       TEXT,
        model         TEXT,
        has_disc      INTEGER NOT NULL DEFAULT 1,
        has_box       INTEGER NOT NULL DEFAULT 0,
        has_manual    INTEGER NOT NULL DEFAULT 0,
        working       INTEGER NOT NULL DEFAULT 1,
        condition     TEXT CHECK (condition IN ('A','B','C') OR condition IS NULL),
        box_condition TEXT CHECK (box_condition IN ('A','B','C') OR box_condition IS NULL),
        status        TEXT NOT NULL DEFAULT 'backlog'
                      CHECK (status IN ('backlog','playing','completed','dropped','none')),
        rating        INTEGER CHECK (rating BETWEEN 1 AND 10 OR rating IS NULL),
        price_paid    REAL,
        value         REAL,
        purchased_on  TEXT,
        notes         TEXT,
        igdb_id       INTEGER,
        cover         TEXT,
        release_year  INTEGER,
        genres        TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_items_platform ON items(platform);
    """,
    """
    ALTER TABLE items ADD COLUMN lb_id INTEGER;
    ALTER TABLE items ADD COLUMN spine TEXT;
    CREATE TABLE platforms (name TEXT PRIMARY KEY, image TEXT);
    """,
    """
    ALTER TABLE items ADD COLUMN cover_lang TEXT;
    ALTER TABLE items ADD COLUMN special TEXT;
    ALTER TABLE items ADD COLUMN cover_frame INTEGER NOT NULL DEFAULT 1;
    CREATE TABLE loans (
        id          INTEGER PRIMARY KEY,
        item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        borrower    TEXT NOT NULL,
        lent_on     TEXT NOT NULL,
        due_on      TEXT,
        returned_on TEXT,
        notes       TEXT
    );
    CREATE INDEX idx_loans_item ON loans(item_id);
    CREATE UNIQUE INDEX idx_loans_active ON loans(item_id) WHERE returned_on IS NULL;
    UPDATE items SET cover_frame = 0 WHERE lb_id IS NOT NULL OR kind != 'game';
    """,
    """
    ALTER TABLE items ADD COLUMN acc_type TEXT;
    UPDATE items SET region = NULL WHERE kind = 'accessory';
    """,
    """
    ALTER TABLE items ADD COLUMN shame_since TEXT;
    ALTER TABLE items ADD COLUMN wish INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE items ADD COLUMN target_price REAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    """,
    """
    CREATE TABLE collections (
        id           INTEGER PRIMARY KEY,
        name         TEXT NOT NULL,
        source_type  TEXT,
        source_id    INTEGER,
        source_name  TEXT,
        scope        TEXT NOT NULL DEFAULT 'any',
        scope_value  TEXT,
        include      TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE collection_entries (
        id            INTEGER PRIMARY KEY,
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        pos           INTEGER NOT NULL DEFAULT 0,
        igdb_id       INTEGER,
        title         TEXT NOT NULL,
        year          INTEGER,
        platforms     TEXT,
        cover_url     TEXT,
        type          TEXT NOT NULL DEFAULT 'main',
        hidden        INTEGER NOT NULL DEFAULT 0,
        alt_ids       TEXT
    );
    CREATE INDEX idx_centries_coll ON collection_entries(collection_id, pos);
    """,
    """
    ALTER TABLE items ADD COLUMN value_checked TEXT;
    ALTER TABLE items ADD COLUMN serial TEXT;
    UPDATE items SET value_checked = substr(updated_at, 1, 10) WHERE value IS NOT NULL;
    CREATE TABLE value_history (
        day    TEXT PRIMARY KEY,
        value  REAL NOT NULL DEFAULT 0,
        paid   REAL NOT NULL DEFAULT 0,
        items  INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE item_photos (
        id         INTEGER PRIMARY KEY,
        item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        file       TEXT NOT NULL,
        w          INTEGER, h INTEGER,
        caption    TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_photos_item ON item_photos(item_id);
    CREATE TABLE events (
        id      INTEGER PRIMARY KEY,
        type    TEXT NOT NULL,
        item_id INTEGER,
        at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_events_type ON events(type);
    CREATE TABLE trophies (
        key         TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        seen        INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE friends (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        shared_at   TEXT,
        imported_at TEXT NOT NULL DEFAULT (datetime('now')),
        data        TEXT NOT NULL
    );
    """,
    """
    ALTER TABLE items ADD COLUMN for_sale INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE items ADD COLUMN asking_price REAL;
    ALTER TABLE items ADD COLUMN sold_on TEXT;
    ALTER TABLE items ADD COLUMN sold_price REAL;
    ALTER TABLE items ADD COLUMN sold_to TEXT;
    """,
]


@contextmanager
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def migrate():
    with db() as con:
        con.execute("PRAGMA journal_mode = WAL")
        version = con.execute("PRAGMA user_version").fetchone()[0]
        for i, sql in enumerate(MIGRATIONS[version:], start=version + 1):
            con.executescript(sql)
            con.execute(f"PRAGMA user_version = {i}")
            log.info("migracja %s OK", i)


migrate()

COLUMNS = [
    "kind", "title", "platform", "region", "edition", "model", "has_disc", "has_box",
    "has_manual", "working", "condition", "box_condition", "status", "rating",
    "price_paid", "value", "purchased_on", "notes", "igdb_id", "cover",
    "release_year", "genres", "lb_id", "spine", "cover_lang", "special", "cover_frame",
    "acc_type", "shame_since", "wish", "target_price", "value_checked", "serial",
    "for_sale", "asking_price", "sold_on", "sold_price", "sold_to",
]
SALE_KEYS = ("for_sale", "asking_price", "sold_on", "sold_price", "sold_to")   # zmieniane tylko przez /sale i /sold


class ItemIn(BaseModel):
    kind: Literal["game", "console", "accessory"] = "game"
    title: str = Field(min_length=1, max_length=300)
    platform: Optional[str] = None
    region: Optional[str] = "PAL"
    edition: Optional[str] = None
    model: Optional[str] = None
    has_disc: bool = True
    has_box: bool = False
    has_manual: bool = False
    working: bool = True
    condition: Optional[Literal["A", "B", "C"]] = None
    box_condition: Optional[Literal["A", "B", "C"]] = None
    status: Literal["backlog", "playing", "completed", "dropped", "none"] = "backlog"
    rating: Optional[int] = Field(default=None, ge=1, le=10)
    price_paid: Optional[float] = Field(default=None, ge=0)
    value: Optional[float] = Field(default=None, ge=0)
    purchased_on: Optional[str] = None
    notes: Optional[str] = None
    igdb_id: Optional[int] = None
    cover: Optional[str] = None
    release_year: Optional[int] = None
    genres: Optional[str] = None
    lb_id: Optional[int] = None
    spine: Optional[str] = None
    cover_lang: Optional[str] = Field(default=None, max_length=10)
    special: list[str] = Field(default_factory=list)
    cover_frame: bool = True
    acc_type: Optional[str] = Field(default=None, max_length=60)
    shame_since: Optional[str] = None
    wish: bool = False
    target_price: Optional[float] = Field(default=None, ge=0)
    value_checked: Optional[str] = None   # ustawiane przez serwer przy zmianie wartości
    serial: Optional[str] = Field(default=None, max_length=40)
    for_sale: bool = False
    asking_price: Optional[float] = Field(default=None, ge=0)
    sold_on: Optional[str] = None
    sold_price: Optional[float] = Field(default=None, ge=0)
    sold_to: Optional[str] = Field(default=None, max_length=80)
    cover_url: Optional[str] = None  # tylko wejście: /api/img/<token> albo adres z zaufanego hosta
    spine_url: Optional[str] = None


def row(r: sqlite3.Row) -> dict:
    d = dict(r)
    for k in ("has_disc", "has_box", "has_manual", "working", "cover_frame", "wish", "for_sale"):
        if k in d:
            d[k] = bool(d[k])
    try:
        d["special"] = json.loads(d.get("special") or "[]")
    except ValueError:
        d["special"] = []
    d["cover_ar"] = image_ar(d.get("cover"))
    return d


def _db_values(data: dict) -> list:
    vals = dict(data)
    vals["special"] = json.dumps([s.strip()[:40] for s in vals.get("special") or [] if s.strip()],
                                 ensure_ascii=False)
    vals["cover_frame"] = 1 if vals.get("cover_frame", True) else 0
    vals["wish"] = 1 if vals.get("wish") else 0
    return [vals.get(c) for c in COLUMNS]


# --- proporcje obrazków (czytane z nagłówka pliku, bez Pillow) ---------------
_ar_cache: dict = {}


def _jpeg_orientation(seg: bytes) -> int:
    """Orientacja z EXIF (APP1); 1 = normalna."""
    if not seg.startswith(b"Exif\x00\x00"):
        return 1
    t = seg[6:]
    if len(t) < 8:
        return 1
    bo = "little" if t[:2] == b"II" else "big"
    ifd = int.from_bytes(t[4:8], bo)
    if ifd + 2 > len(t):
        return 1
    n = int.from_bytes(t[ifd:ifd + 2], bo)
    for k in range(n):
        e = ifd + 2 + k * 12
        if e + 12 > len(t):
            break
        if int.from_bytes(t[e:e + 2], bo) == 0x0112:
            return int.from_bytes(t[e + 8:e + 10], bo)
    return 1


def image_dims(data: bytes) -> Optional[tuple]:
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP" and len(data) >= 30:
        chunk = data[12:16]
        if chunk == b"VP8 ":
            return int.from_bytes(data[26:28], "little") & 0x3FFF, int.from_bytes(data[28:30], "little") & 0x3FFF
        if chunk == b"VP8L":
            b = data[21:25]
            return 1 + (((b[1] & 0x3F) << 8) | b[0]), 1 + (((b[3] & 0xF) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
        if chunk == b"VP8X":
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
    if data[:2] == b"\xff\xd8":
        i, orient = 2, 1
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            m = data[i + 1]
            if m == 0xFF:
                i += 1
                continue
            if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
                i += 2
                continue
            seglen = int.from_bytes(data[i + 2:i + 4], "big")
            if m == 0xE1:
                orient = _jpeg_orientation(data[i + 4:i + 2 + seglen])
            if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                h = int.from_bytes(data[i + 5:i + 7], "big")
                w = int.from_bytes(data[i + 7:i + 9], "big")
                return (h, w) if orient in (5, 6, 7, 8) else (w, h)
            i += 2 + seglen
    return None


def image_ar(name: Optional[str]) -> Optional[float]:
    """Szerokość/wysokość okładki — kafelek ma proporcje prawdziwego skanu, bez przycinania."""
    if not name or "/" in name or name.startswith("."):
        return None
    if name not in _ar_cache:
        ar = None
        try:
            with open(COVERS / name, "rb") as f:
                head = f.read(256 * 1024)
                dims = image_dims(head)
                if not dims and head[:2] == b"\xff\xd8":
                    dims = image_dims(head + f.read())
            if dims and dims[0] and dims[1]:
                ar = round(dims[0] / dims[1], 4)
        except OSError:
            pass
        _ar_cache[name] = ar
    return _ar_cache[name]


# --- HTTP / obrazki ---------------------------------------------------------
_http: Optional[httpx.AsyncClient] = None


async def http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=20, follow_redirects=True,
                                  headers={"User-Agent": "MojaKolekcja/1.0 (https://github.com/pozdromaciek/game-lib-sh; self-hosted home app)"})
    return _http


def trusted(url: str) -> bool:
    u = urlparse(url)
    host = u.hostname or ""
    return (u.scheme == "https" and ".." not in u.path and
            (host in {"images.igdb.com", "images.launchbox-app.com", "upload.wikimedia.org",
                      "thumb.wikimedia.org"}
             or host == "thumbnails.libretro.com"
             or host.endswith(".screenscraper.fr")
             or host == "screenscraper.fr"))


def sniff_ext(data: bytes) -> Optional[str]:
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


async def download(url: str) -> Optional[bytes]:
    if not trusted(url):
        return None
    c = await http()
    try:
        r = await c.get(url)
    except httpx.HTTPError:
        log.warning("nie pobrano obrazka z %s", urlparse(url).hostname)
        return None
    if r.status_code != 200:
        return None
    data = r.content
    if data[:2] == b"\x1f\x8b":  # LaunchBox bywa podwójnie gzipowany
        data = gzip.decompress(data)
    return data if sniff_ext(data) else None


# Tokeny obrazków: przeglądarka widzi tylko /api/img/<token>, nigdy adresu źródła
# (adresy ScreenScrapera zawierają klucze i hasło).
_img_tokens: "OrderedDict[str, str]" = OrderedDict()


def img_token(url: str) -> str:
    tok = hashlib.sha256(SECRET + url.encode()).hexdigest()[:24]
    _img_tokens[tok] = url
    _img_tokens.move_to_end(tok)
    while len(_img_tokens) > 5000:
        _img_tokens.popitem(last=False)
    return f"/api/img/{tok}"


def resolve(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    m = re.fullmatch(r"/api/img/([0-9a-f]{24})", url)
    if m:
        return _img_tokens.get(m.group(1))
    return url if trusted(url) else None


async def fetch_image(url: Optional[str], prefix: str) -> Optional[str]:
    """Pobiera obraz (token albo zaufany adres) i zapisuje lokalnie; cache po adresie."""
    src = resolve(url)
    if not src:
        return None
    key = hashlib.sha1(src.encode()).hexdigest()[:20]
    for ext in ("jpg", "png", "webp"):
        if (COVERS / f"{prefix}_{key}.{ext}").exists():
            return f"{prefix}_{key}.{ext}"
    data = await download(src)
    if not data:
        return None
    name = f"{prefix}_{key}.{sniff_ext(data)}"
    (COVERS / name).write_bytes(data)
    return name


# --- IGDB ------------------------------------------------------------------
_token = {"value": None, "exp": 0.0}


async def igdb_token() -> str:
    if _token["value"] and time.time() < _token["exp"] - 120:
        return _token["value"]
    if not igdb_on():
        raise HTTPException(503, "Brak kluczy IGDB — dodaj je w Menu → Narzędzia → Klucze API")
    c = await http()
    try:
        r = await c.post("https://id.twitch.tv/oauth2/token", params={
            "client_id": appcfg.get("IGDB_CLIENT_ID"), "client_secret": appcfg.get("IGDB_CLIENT_SECRET"), "grant_type": "client_credentials"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Brak połączenia z Twitch/IGDB: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"Twitch OAuth: {r.status_code} {r.text[:200]}")
    j = r.json()
    _token.update(value=j["access_token"], exp=time.time() + j["expires_in"])
    return _token["value"]


async def igdb(endpoint: str, body: str) -> list:
    token = await igdb_token()
    c = await http()
    try:
        r = await c.post(f"https://api.igdb.com/v4/{endpoint}", content=body, headers={
            "Client-ID": appcfg.get("IGDB_CLIENT_ID"), "Authorization": f"Bearer {token}", "Accept": "application/json"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Brak połączenia z IGDB: {e}")
    if r.status_code == 401:
        _token["value"] = None  # token unieważniony — kolejne zapytanie pobierze nowy
    if r.status_code != 200:
        raise HTTPException(502, f"IGDB: {r.status_code} {r.text[:200]}")
    return r.json()


def igdb_img(image_id: str, size: str = "t_cover_big", ext: str = "jpg") -> str:
    return f"https://images.igdb.com/igdb/image/upload/{size}/{image_id}.{ext}"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def is_logo(data: bytes) -> bool:
    """Logo (płaskie plamy koloru, mało barw) czy zdjęcie (szum, cienie)? IGDB trzyma przy konsolach
    raz zdjęcie sprzętu, raz sam napis — tło (najczęstszy kolor) nie jest brane pod uwagę."""
    try:
        im = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:  # noqa: BLE001 — uszkodzony plik traktujemy jak nieprzydatny
        return True
    w, h = im.size
    s = 256 / max(w, h)
    if s < 1:
        im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.NEAREST)
    W, H = im.size
    px = im.load()
    opaque = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] > 200]
    if len(opaque) < W * H * 0.03:
        return True
    q5 = lambda c: (c[0] >> 3, c[1] >> 3, c[2] >> 3)
    counts: dict = {}
    for x, y in opaque:
        k = q5(px[x, y])
        counts[k] = counts.get(k, 0) + 1
    bg, bgn = max(counts.items(), key=lambda kv: kv[1])
    strip_bg = bgn / len(opaque) > 0.25
    obj = [(x, y) for x, y in opaque
           if not (strip_bg and max(abs(a - b) for a, b in zip(q5(px[x, y]), bg)) <= 1)]
    if len(obj) < len(opaque) * 0.03:
        return True
    oc: dict = {}
    for x, y in obj:
        k = q5(px[x, y])
        oc[k] = oc.get(k, 0) + 1
    acc = n95 = 0
    for c in sorted(oc.values(), reverse=True):
        acc += c
        n95 += 1
        if acc >= 0.95 * len(obj):
            break
    flat = sum(1 for x, y in obj if x + 1 < W and px[x + 1, y] == px[x, y]) / len(obj)
    return flat > 0.55 and n95 < 80


_logo_cache: dict = {}


async def is_logo_url(url: str) -> bool:
    if url not in _logo_cache:
        data = await download(url)
        _logo_cache[url] = True if not data else await asyncio.to_thread(is_logo, data)
    return _logo_cache[url]


async def console_photo(platform: Optional[str], title: str, model: str = "") -> Optional[str]:
    """Zdjęcie konsoli: najpierw zdjęcie (nie logo!) z IGDB w pasującej wersji, potem najlepsze
    zdjęcie z Wikipedii/Commons, na końcu choćby logo z IGDB."""
    plat = platform if platform in PLATFORMS else platform_from_text(f"{title} {platform or ''}")
    igdb_list = await igdb_console_images(plat, f"{title} {model}")
    for _, url in igdb_list:
        if not await is_logo_url(url):
            return url
    wiki = await photos(title, model, plat or "", kind="")
    if wiki["covers"]:
        return resolve(wiki["covers"][0]["url"])
    return igdb_list[0][1] if igdb_list else None


async def igdb_console_images(platform: Optional[str], hint: str) -> list:
    """Wszystkie zdjęcia konsoli z IGDB (każda wersja: Fat, Slim, …) — pasująca do nazwy/modelu pierwsza."""
    pid = PLATFORMS.get(platform or "")
    if not pid or not (igdb_on()):
        return []
    try:
        res = await igdb("platforms", f"fields name,platform_logo.image_id,versions.name,"
                                      f"versions.platform_logo.image_id; where id = {pid};")
    except HTTPException as e:
        log.info("IGDB: brak zdjęć konsoli (%s)", e.detail)
        return []
    if not res:
        return []
    p = res[0]
    base = set(_norm(platform).split())
    generic = {"initial", "version", "original", "standard", "model", "console", "first", "launch", "edition"}
    words = set(_norm(hint).split()) - base - generic
    out, seen = [], set()
    for v in p.get("versions") or []:
        img = (v.get("platform_logo") or {}).get("image_id")
        if img and img not in seen:
            seen.add(img)
            vw = set(_norm(v.get("name", "")).split()) - base - generic
            # „PlayStation 5” → wersja podstawowa, nie „Pro”/„Digital”; „PS2 Slim” → Slim
            score = 2 * len(words & vw) - len(vw - words)
            out.append((-score, len(out), v.get("name") or p.get("name"), img))
    main_img = (p.get("platform_logo") or {}).get("image_id")
    if main_img and main_img not in seen:
        out.append((0, len(out), p.get("name") or platform, main_img))
    out.sort()
    return [(name, igdb_img(img, "t_720p", "png")) for _, _, name, img in out]


def platform_from_text(text: str) -> Optional[str]:
    """„PlayStation 2 Slim” → „PlayStation 2” (najdłuższa pasująca nazwa platformy)."""
    t = f" {_norm(text)} "
    hits = [p for p in PLATFORMS if f" {_norm(p)} " in t]
    return max(hits, key=len) if hits else None


# --- auth (jedno hasło, podpisane ciasteczko) --------------------------------
def sign(exp: int) -> str:
    epoch = appcfg.session_epoch()        # zmiana hasła → nowa epoka → stare sesje wygasają
    msg = f"{exp}.{epoch}" if epoch else str(exp)
    mac = hmac.new(SECRET, msg.encode(), hashlib.sha256).hexdigest()
    return f"{exp}.{mac}"


def valid(token: Optional[str]) -> bool:
    try:
        exp_s, mac = (token or "").split(".", 1)
        exp = int(exp_s)
    except ValueError:
        return False
    return exp > time.time() and hmac.compare_digest(sign(exp), f"{exp}.{mac}")


PUBLIC = {"/login", "/api/login", "/healthz", "/ca.crt", "/ca.pem", "/static/style.css", "/static/themes.css", "/static/themes2.css", "/static/i18n.js", "/static/icon.svg",
          "/static/icon-192.png", "/static/icon-512.png", "/static/icon-maskable-512.png",
          "/static/apple-touch-icon.png", "/manifest.webmanifest"}

LB = LaunchBox(DATA)
SS = ScreenScraper()


@asynccontextmanager
async def lifespan(_app):
    appcfg.announce_setup()
    if not LB.ready and os.getenv("LAUNCHBOX_AUTO_IMPORT", "1") != "0":
        LB.start_import()
    task = asyncio.create_task(backups.scheduler())
    yield
    task.cancel()


app = FastAPI(title=APP_NAME, docs_url=None, redoc_url=None, lifespan=lifespan)
app.include_router(colls.router)
for _r in (backups.router, photos.router, share.router, trophies.router, sales.router, reports.router, ocr.router, system.router, setup.router):
    app.include_router(_r)


TLS_ON = int(os.getenv("HTTPS_PORT", "8443") or 0) > 0


@app.get("/ca.crt")
def ca_crt():
    """Certyfikat lokalnego CA do zainstalowania na telefonie (DER — Android i iOS)."""
    return Response(tls.ca_der(), media_type="application/x-x509-ca-cert",
                    headers={"Content-Disposition": 'attachment; filename="moja-kolekcja-ca.crt"'})


@app.get("/ca.pem")
def ca_pem_file():
    return Response(tls.ca_pem(), media_type="application/x-pem-file",
                    headers={"Content-Disposition": 'attachment; filename="moja-kolekcja-ca.pem"'})


@app.get("/api/tls")
def tls_info(request: Request):
    host = (request.headers.get("host") or "").split(":")[0]
    port = int(os.getenv("HTTPS_PORT", "8443") or 0)
    return {"enabled": TLS_ON, "secure": request.url.scheme == "https", "port": port,
            "https_url": f"https://{host}:{port}/" if TLS_ON and host else None,
            "host_ok": tls.allowed_host(host), "fingerprint": tls.ca_fingerprint() if TLS_ON else None}


@app.middleware("http")
async def auth(request: Request, call_next):
    path = request.url.path
    if TLS_ON:
        try:
            await asyncio.to_thread(tls.learn_host, request.headers.get("host", ""))
        except Exception:  # noqa: BLE001
            pass
    if appcfg.setup_needed():
        # przed pierwszą konfiguracją działa tylko kreator (chroniony kodem z logów kontenera)
        if path != "/login" and (path in PUBLIC or path.startswith(("/static/fonts/", "/api/setup/")) or path in ("/setup", "/static/setup.js")):
            return await call_next(request)
        if path.startswith("/api/"):
            return JSONResponse({"detail": "Najpierw dokończ instalację: /setup"}, status_code=409)
        return RedirectResponse("/setup")
    if path == "/setup" or path.startswith("/api/setup/"):
        return RedirectResponse("/") if not path.startswith("/api/") else JSONResponse({"detail": "Instalacja jest już zakończona"}, status_code=409)
    if path in PUBLIC or path.startswith("/static/fonts/") or valid(request.cookies.get("sesja")):
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"detail": "Zaloguj się"}, status_code=401)
    return RedirectResponse("/login")


class LoginIn(BaseModel):
    password: str


@app.post("/api/login")
async def login(body: LoginIn, response: Response):
    if not await asyncio.to_thread(appcfg.check_password, body.password):
        await asyncio.sleep(1.5)  # spowalnia zgadywanie
        raise HTTPException(401, "Złe hasło")
    set_session(response)
    return {"ok": True}


def set_session(response: Response) -> None:
    exp = int(time.time()) + SESSION_DAYS * 86400
    response.set_cookie("sesja", sign(exp), max_age=SESSION_DAYS * 86400,
                        httponly=True, samesite="lax")


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie("sesja")
    return {"ok": True}


# --- strony ----------------------------------------------------------------
@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/login")
def login_page():
    return FileResponse(STATIC / "login.html")


@app.get("/setup")
def setup_page():
    return FileResponse(STATIC / "setup.html", headers={"Cache-Control": "no-store"})


@app.get("/manifest.webmanifest")
def manifest():
    return JSONResponse({
        "name": APP_NAME, "short_name": APP_NAME, "start_url": "/",
        "display": "standalone", "background_color": "#cfcdc8", "theme_color": "#6b6a70",
        "id": "/", "scope": "/", "orientation": "any", "lang": "pl",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/static/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            {"src": "/static/icon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }, media_type="application/manifest+json")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
app.mount("/covers", StaticFiles(directory=COVERS), name="covers")


@app.get("/api/img/{tok}")
async def img_proxy(tok: str):
    src = _img_tokens.get(tok)
    if not src:
        raise HTTPException(404, "Obrazek wygasł — wyszukaj ponownie")
    data = await download(src)
    if not data:
        raise HTTPException(502, "Nie udało się pobrać obrazka")
    return Response(data, media_type=f"image/{'jpeg' if sniff_ext(data) == 'jpg' else sniff_ext(data)}",
                    headers={"Cache-Control": "private, max-age=86400"})


APP_VERSION = "Beta 1.0"
SHOPS = ("olx", "allegro", "ebay", "ebay_de", "ebay_uk", "vinted", "pricecharting")
DEFAULT_SETTINGS = {"shame": False, "theme": "ps1", "lang": "pl", "currency": "PLN", "shops": ["olx", "allegro", "ebay"]}
CURRENCIES = ("PLN", "EUR", "USD", "GBP", "CHF", "CZK")
THEMES = ("ps1", "ps2", "lcd", "crt", "dmg", "x360", "w95", "red")
LANGS = ("pl", "en")


def get_settings() -> dict:
    out = dict(DEFAULT_SETTINGS)
    with db() as con:
        for r in con.execute("SELECT key, value FROM settings"):
            if r["key"] in out:
                out[r["key"]] = json.loads(r["value"])
    return out


def unlocked_extras() -> list:
    with db() as con:
        return ["red"] if con.execute("SELECT 1 FROM events WHERE type='konami' LIMIT 1").fetchone() else []


@app.get("/api/config")
def config():
    return {"platforms": list(PLATFORMS), "cover_langs": COVER_LANGS, "acc_types": ACC_TYPES,
            "editions": EDITIONS, "settings": get_settings(), "version": APP_VERSION, "platform_ids": PLATFORMS, "unlocked": unlocked_extras(),
            "sources": {"igdb": bool(igdb_on()), "screenscraper": SS.configured,
                        "launchbox": LB.ready, "ebay": prices.configured()}}


@app.get("/api/settings")
def read_settings():
    return get_settings()


@app.put("/api/settings")
def write_settings(body: dict):
    with db() as con:
        for k, v in body.items():
            if k not in DEFAULT_SETTINGS:
                continue
            if k == "theme":
                if v not in THEMES:
                    raise HTTPException(422, "Nieznany wygląd")
                if v == "red" and not con.execute("SELECT 1 FROM events WHERE type='konami' LIMIT 1").fetchone():
                    raise HTTPException(403, "Ten wygląd trzeba najpierw odblokować")
                val = json.dumps(v)
            elif k == "lang":
                if v not in LANGS:
                    raise HTTPException(422, "Nieznany język")
                val = json.dumps(v)
            elif k == "currency":
                if v not in CURRENCIES:
                    raise HTTPException(422, "Nieznana waluta")
                val = json.dumps(v)
            elif k == "shops":
                if not isinstance(v, list) or any(x not in SHOPS for x in v):
                    raise HTTPException(422, "Nieznany serwis")
                val = json.dumps([x for x in SHOPS if x in v])
            else:
                val = json.dumps(bool(v))
            con.execute("INSERT INTO settings(key, value) VALUES (?, ?) "
                        "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, val))
            if (k == "theme" and v in THEMES and v != "ps1") or (k == "lang" and v == "en"):
                log_event(con, f"{k}_{v}")
    return get_settings()


class CurrencyIn(BaseModel):
    to: str
    convert: bool = False


@app.post("/api/currency")
async def change_currency(body: CurrencyIn):
    """Zmiana waluty kolekcji; opcjonalnie jednorazowe przeliczenie kwot po kursie NBP."""
    if body.to not in CURRENCIES:
        raise HTTPException(422, "Nieznana waluta")
    cur = get_settings().get("currency", "PLN")
    factor = None
    if body.convert and cur != body.to:
        rates = await prices.rates(await http())
        if cur not in rates or body.to not in rates:
            raise HTTPException(502, "Brak kursu NBP — spróbuj później albo zmień bez przeliczania")
        factor = rates[cur] / rates[body.to]
        with db() as con:
            for col in ("price_paid", "value", "target_price", "asking_price", "sold_price"):
                con.execute(f"UPDATE items SET {col} = ROUND({col} * ?, 2) WHERE {col} IS NOT NULL", (factor,))
            con.execute("UPDATE value_history SET value = ROUND(value * ?, 2), paid = ROUND(paid * ?, 2)", (factor, factor))
    write_settings({"currency": body.to})
    return {"settings": get_settings(), "factor": factor}


# --- API: przedmioty ---------------------------------------------------------
def _loans(con) -> dict:
    return {r["item_id"]: dict(r) for r in con.execute("SELECT * FROM loans WHERE returned_on IS NULL")}


def _get(con, item_id: int) -> dict:
    r = con.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not r:
        raise HTTPException(404, "Nie ma takiej pozycji")
    d = row(r)
    loan = con.execute("SELECT * FROM loans WHERE item_id=? AND returned_on IS NULL", (item_id,)).fetchone()
    d["loan"] = dict(loan) if loan else None
    return d


@app.get("/api/items")
def list_items():
    with db() as con:
        loans = _loans(con)
        out = []
        for r in con.execute("SELECT * FROM items ORDER BY title COLLATE NOCASE"):
            d = row(r)
            d["loan"] = loans.get(d["id"])
            out.append(d)
        return out


async def _values(item: ItemIn) -> dict:
    data = item.model_dump(exclude={"cover_url", "spine_url"})
    if item.cover_url:
        data["cover"] = await fetch_image(item.cover_url, "cover") or data.get("cover")
    if item.spine_url:
        data["spine"] = await fetch_image(item.spine_url, "spine") or data.get("spine")
    if item.kind == "console" and not data.get("cover") and not item.cover_url:
        try:  # konsola bez zdjęcia → zdjęcie (IGDB albo Wikipedia/Commons)
            url = await console_photo(item.platform, item.title, item.model or "")
            if url:
                data["cover"] = await fetch_image(url, "console")
                data["cover_frame"] = False
        except HTTPException as e:
            log.info("IGDB: brak obrazu konsoli (%s)", e.detail)
    if item.kind != "game":
        data["cover_frame"] = False
    if item.kind == "accessory":
        data["region"] = None
        data["acc_type"] = (item.acc_type or "").strip() or None
    else:
        data["acc_type"] = None
    # kupka wstydu: tylko posiadane gry, ukończenie zdejmuje z kupki
    if item.kind != "game" or item.wish or item.status == "completed":
        data["shame_since"] = None
    else:
        data["shame_since"] = _date(item.shame_since)
    return data


EDITIONS = ["Premierowe", "Platinum", "Essentials", "Greatest Hits", "Player's Choice", "Nintendo Selects",
            "Classics", "Game of the Year", "Edycja kompletna / Definitive", "Seria budżetowa"]
BUY_REQUIRED = {"price_paid": "cena zakupu", "purchased_on": "data zakupu", "condition": "stan"}


ACC_TYPES = ["Pad", "Karta pamięci", "Kierownica", "Pistolet", "Joystick / arcade stick", "Multitap",
             "Kabel AV / RGB", "Zasilacz", "Kamera", "Mikrofon", "Słuchawki", "Pilot", "Ładowarka",
             "Przejściówka", "Nakładka / etui"]


def log_event(con, typ: str, item_id: Optional[int] = None):
    con.execute("INSERT INTO events(type, item_id) VALUES (?, ?)", (typ, item_id))


def snapshot_value(con):
    """Dzienny zapis wartości kolekcji (nadpisuje dzisiejszy)."""
    r = con.execute("SELECT COALESCE(SUM(value),0) v, COALESCE(SUM(price_paid),0) p, COUNT(*) n "
                    "FROM items WHERE wish = 0 AND sold_on IS NULL").fetchone()
    con.execute("INSERT INTO value_history(day, value, paid, items) VALUES (date('now','localtime'),?,?,?) "
                "ON CONFLICT(day) DO UPDATE SET value=excluded.value, paid=excluded.paid, items=excluded.items",
                (r["v"], r["p"], r["n"]))


@app.get("/api/value-history")
def value_history():
    """Wartość w czasie: dzienne punkty; przy dłuższej historii — ostatni dzień każdego tygodnia (maks. rok)."""
    with db() as con:
        rows = [dict(r) for r in con.execute("SELECT * FROM value_history ORDER BY day")]
    if len(rows) > 35:
        weekly = {}
        for r in rows:
            y, w, _ = date.fromisoformat(r["day"]).isocalendar()
            weekly[(y, w)] = r
        rows = list(weekly.values())[-52:]
    return rows


@app.post("/api/items", status_code=201)
async def create_item(item: ItemIn):
    data = await _values(item)
    data["value_checked"] = date.today().isoformat() if data.get("value") is not None else None
    for k in SALE_KEYS:
        data[k] = 0 if k == "for_sale" else None
    with db() as con:
        cur = con.execute(
            f"INSERT INTO items ({','.join(COLUMNS)}) VALUES ({','.join('?' * len(COLUMNS))})",
            _db_values(data))
        iid = cur.lastrowid
        log_event(con, "wish_add" if data.get("wish") else "add", iid)
        if data.get("shame_since"):
            log_event(con, "shame_add", iid)
        if data.get("status") == "completed" and not data.get("wish") and item.kind == "game":
            log_event(con, "completed", iid)
        snapshot_value(con)
        return _get(con, iid)


@app.put("/api/items/{item_id}")
async def update_item(item_id: int, item: ItemIn):
    data = await _values(item)
    with db() as con:
        old = _get(con, item_id)
        if old["wish"] and not item.wish:  # „Kupiłem” — trzeba uzupełnić dane zakupu
            missing = [label for k, label in BUY_REQUIRED.items() if not data.get(k) and data.get(k) != 0]
            if missing:
                raise HTTPException(422, "Uzupełnij: " + ", ".join(missing))
        for k in SALE_KEYS:                       # formularz nie rusza sprzedaży
            data[k] = old.get(k)
        data["value_checked"] = (date.today().isoformat() if data.get("value") != old.get("value")
                                 and data.get("value") is not None else old.get("value_checked"))
        con.execute(
            f"UPDATE items SET {','.join(c + '=?' for c in COLUMNS)}, updated_at=datetime('now') "
            "WHERE id=?", _db_values(data) + [item_id])
        if old["wish"] and not item.wish:
            log_event(con, "bought", item_id)
            if old.get("target_price") and data.get("price_paid") is not None and data["price_paid"] <= old["target_price"]:
                log_event(con, "bought_under", item_id)
        if not old["wish"] and not old.get("shame_since") and data.get("shame_since"):
            log_event(con, "shame_add", item_id)
        if item.kind == "game" and not item.wish and data.get("status") == "completed" and old.get("status") != "completed":
            log_event(con, "completed", item_id)
            if old.get("shame_since"):
                log_event(con, "shame_done", item_id)
        snapshot_value(con)
        return _get(con, item_id)


@app.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    with db() as con:
        _get(con, item_id)
        con.execute("DELETE FROM items WHERE id=?", (item_id,))
        snapshot_value(con)
    photos.delete_files_of(item_id)


async def save_upload(file: UploadFile, prefix: str) -> str:
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(413, "Maks. 12 MB")
    ext = sniff_ext(content)
    if not ext:
        raise HTTPException(415, "Tylko JPG, PNG lub WEBP")
    name = f"{prefix}_{int(time.time() * 1000)}.{ext}"
    (COVERS / name).write_bytes(content)
    return name


@app.post("/api/items/{item_id}/cover")
async def upload_cover(item_id: int, file: UploadFile = File(...), kind: str = "cover"):
    col = "spine" if kind == "spine" else "cover"
    with db() as con:
        it = _get(con, item_id)
    name = await save_upload(file, f"own{item_id}_{col}")
    with db() as con:
        # własne zdjęcie gry = sama grafika → nakładka konsoli włączona
        frame = 1 if (col == "cover" and it["kind"] == "game") else (1 if it["cover_frame"] else 0)
        con.execute(f"UPDATE items SET {col}=?, cover_frame=?, updated_at=datetime('now') WHERE id=?",
                    (name, frame, item_id))
        return _get(con, item_id)


@app.post("/api/items/{item_id}/igdb-image")
async def refresh_console_image(item_id: int):
    with db() as con:
        it = _get(con, item_id)
    url = await console_photo(it["platform"], it["title"], it.get("model") or "")
    if not url:
        raise HTTPException(404, "Nie znalazłem zdjęcia tej konsoli — użyj „Szukaj zdjęć” albo wgraj własne")
    name = await fetch_image(url, "console")
    if not name:
        raise HTTPException(502, "Nie udało się pobrać zdjęcia")
    with db() as con:
        con.execute("UPDATE items SET cover=?, cover_frame=0, updated_at=datetime('now') WHERE id=?",
                    (name, item_id))
        return _get(con, item_id)


# --- API: wypożyczenia -------------------------------------------------------
class LoanIn(BaseModel):
    borrower: str = Field(min_length=1, max_length=80)
    lent_on: Optional[str] = None
    due_on: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)


def _date(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    try:
        return date.fromisoformat(s).isoformat()
    except ValueError:
        raise HTTPException(422, f"Zła data: {s}")


@app.post("/api/items/{item_id}/loan", status_code=201)
def lend(item_id: int, body: LoanIn):
    with db() as con:
        if _get(con, item_id)["wish"]:
            raise HTTPException(400, "Nie można wypożyczyć czegoś z listy życzeń")
        try:
            con.execute("INSERT INTO loans(item_id, borrower, lent_on, due_on, notes) VALUES (?,?,?,?,?)",
                        (item_id, body.borrower.strip(), _date(body.lent_on) or date.today().isoformat(),
                         _date(body.due_on), body.notes))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ta pozycja jest już wypożyczona")
        log_event(con, "loan", item_id)
        return _get(con, item_id)


@app.post("/api/items/{item_id}/return")
def give_back(item_id: int):
    with db() as con:
        it = _get(con, item_id)
        cur = con.execute("UPDATE loans SET returned_on=? WHERE item_id=? AND returned_on IS NULL",
                          (date.today().isoformat(), item_id))
        if not cur.rowcount:
            raise HTTPException(409, "Ta pozycja nie jest wypożyczona")
        due = (it.get("loan") or {}).get("due_on")
        log_event(con, "return_late" if due and due < date.today().isoformat() else "return", item_id)
        return _get(con, item_id)


@app.get("/api/items/{item_id}/loans")
def loan_history(item_id: int):
    with db() as con:
        return [dict(r) for r in con.execute(
            "SELECT * FROM loans WHERE item_id=? ORDER BY lent_on DESC, id DESC", (item_id,))]


@app.get("/api/borrowers")
def borrowers():
    with db() as con:
        return [r[0] for r in con.execute(
            "SELECT borrower FROM loans GROUP BY borrower ORDER BY MAX(lent_on) DESC LIMIT 50")]


# --- API: wyszukiwanie gier i okładek ------------------------------------------
@app.get("/api/search")
async def search(q: str, platform: Optional[str] = None):
    """Dane o grze: IGDB; bez kluczy IGDB — LaunchBox."""
    q = re.sub(r'["\\;]', " ", q).strip()[:100]
    if len(q) < 2:
        return {"source": "none", "results": []}
    if libretro.looks_like_serial(q):
        return {"source": "libretro", "results": await serial_search(q, platform)}
    if igdb_on():
        body = f'search "{q}"; fields name,first_release_date,cover.image_id,genres.name;'
        pid = PLATFORMS.get(platform or "")
        if pid:
            body += f" where platforms = ({pid});"
        body += " limit 24;"
        out = []
        for g in await igdb("games", body):
            ts = g.get("first_release_date")
            cid = (g.get("cover") or {}).get("image_id")
            out.append({"source": "igdb", "igdb_id": g["id"], "title": g.get("name"),
                        "release_year": time.gmtime(ts).tm_year if ts else None,
                        "genres": ", ".join(x["name"] for x in g.get("genres", [])) or None,
                        "thumb": img_token(igdb_img(cid)) if cid else None})
        return {"source": "igdb", "results": out}
    if LB.ready:
        res = await asyncio.to_thread(LB.search, q, platform)
        return {"source": "launchbox", "results": [{
            "source": "launchbox", "lb_id": g["ext_id"], "title": g["title"],
            "release_year": g["release_year"], "genres": g["genres"],
            "thumb": img_token(g["covers"][0]["url"]) if g["covers"] else None} for g in res]}
    return {"source": "none", "results": []}


async def serial_search(q: str, platform: Optional[str]) -> list:
    """Numer seryjny z pudełka → dokładne wydanie (libretro) + dane z IGDB po tytule."""
    hits = await libretro.by_serial(q, platform or None)
    out = []
    for i, h in enumerate(hits[:8]):
        r = {"source": "libretro", "title": h["title"], "platform": h["platform"], "region": h["region"] or "PAL",
             "cover_lang": h["cover_lang"], "serial": h["serial"], "release_name": h["release_name"],
             "thumb": img_token(h["cover_url"]), "cover_url": h["cover_url"],
             "release_year": None, "genres": None, "igdb_id": None}
        if i < 3 and igdb_on():
            try:
                t = re.sub(r'["\\;]', " ", h["title"])
                pid = PLATFORMS.get(h["platform"])
                g = await igdb("games", f'search "{t}"; fields name,first_release_date,genres.name;'
                                        + (f" where platforms = ({pid});" if pid else "") + " limit 1;")
                if g:
                    ts = g[0].get("first_release_date")
                    r.update(igdb_id=g[0]["id"], release_year=time.gmtime(ts).tm_year if ts else None,
                             genres=", ".join(x["name"] for x in g[0].get("genres", [])) or None)
            except HTTPException:
                pass
        out.append(r)
    return out


@app.get("/api/covers")
async def covers(title: str, platform: Optional[str] = None, lang: Optional[str] = None,
                 igdb_id: Optional[int] = None, region: Optional[str] = None, release: Optional[str] = None):
    """Warianty okładek: [wydanie z numeru seryjnego] → ScreenScraper → libretro → LaunchBox → IGDB.
    `framed` = okładka ma już pasek konsoli."""
    out, notes = [], []
    if release and platform in libretro.SYSTEMS:
        url = libretro.thumb_url(platform, release)
        if await libretro.thumb_exists(url):
            out.append({"url": img_token(url), "region": "wydanie", "source": "libretro", "type": "cover", "framed": True})
    if SS.configured:
        try:
            for m in await SS.covers(await http(), title, platform, lang):
                out.append({"url": img_token(m["url"]), "region": m["region"], "source": "ScreenScraper",
                            "type": m["type"], "framed": True})
        except Exception as e:  # noqa: BLE001
            notes.append(f"ScreenScraper: {e}")
    if platform in libretro.SYSTEMS:
        try:
            for e in await libretro.boxarts(title, platform, region or "PAL"):
                u = img_token(e["cover_url"])
                if not any(o["url"] == u for o in out):
                    out.append({"url": u, "region": e["region"] or "?", "source": "libretro", "type": "cover", "framed": True})
        except Exception as e:  # noqa: BLE001
            notes.append(f"libretro: {e}")
    if not any(o["type"] == "cover" for o in out) and LB.ready:
        res = await asyncio.to_thread(LB.search, title, platform, 5)
        best = next((g for g in res if _norm(g["title"]) == _norm(title)), res[0] if res else None)
        if best:
            for c in best["covers"]:
                out.append({"url": img_token(c["url"]), "region": c["region"], "source": "LaunchBox",
                            "type": "cover", "framed": True})
            for c in best["spines"]:
                out.append({"url": img_token(c["url"]), "region": c["region"], "source": "LaunchBox",
                            "type": "spine", "framed": True})
    if igdb_id and igdb_on():
        try:
            res = await igdb("games", f"fields cover.image_id; where id = {int(igdb_id)};")
            cid = ((res[0] if res else {}).get("cover") or {}).get("image_id")
            if cid:
                out.append({"url": img_token(igdb_img(cid)), "region": "IGDB", "source": "IGDB",
                            "type": "cover", "framed": False})
        except HTTPException as e:
            notes.append(f"IGDB: {e.detail}")
    return {"covers": [o for o in out if o["type"] == "cover"],
            "spines": [o for o in out if o["type"] == "spine"], "notes": notes}


@app.get("/api/launchbox/status")
def launchbox_status():
    return LB.status


@app.post("/api/launchbox/import")
def launchbox_import():
    if not LB.start_import():
        raise HTTPException(409, "Import już trwa")
    return LB.status


class ShameIn(BaseModel):
    on: bool = True


@app.post("/api/items/{item_id}/shame")
def set_shame(item_id: int, body: ShameIn):
    with db() as con:
        it = _get(con, item_id)
        if it["kind"] != "game" or it["wish"]:
            raise HTTPException(400, "Na kupkę wstydu trafiają tylko posiadane gry")
        if body.on:
            if not it["shame_since"]:
                log_event(con, "shame_add", item_id)
            con.execute("UPDATE items SET shame_since=?, status=CASE WHEN status='completed' THEN 'backlog' "
                        "ELSE status END, updated_at=datetime('now') WHERE id=?",
                        (it["shame_since"] or date.today().isoformat(), item_id))
        else:
            con.execute("UPDATE items SET shame_since=NULL, updated_at=datetime('now') WHERE id=?", (item_id,))
        return _get(con, item_id)


COMMONS_API = "https://commons.wikimedia.org/w/api.php"
_photo_cache: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
PHOTO_SKIP = ("logo", "icon", "screenshot", "map of", "diagram", "chart", "signature")


async def _mw(url: str, params: dict) -> dict:
    try:
        r = await (await http()).get(url, params={"format": "json", "formatversion": "2", **params})
        r.raise_for_status()
        return r.json()
    except (httpx.HTTPError, ValueError) as e:
        log.warning("MediaWiki %s: %s", urlparse(url).hostname, e)
        return {}


def _file_key(name: str) -> str:
    n = name.replace("_", " ").strip()
    n = n.split(":", 1)[1].strip() if n.lower().startswith(("file:", "plik:")) else n
    return n[:1].upper() + n[1:]


@app.get("/api/photos")
async def photos(q: str, model: str = "", platform: str = "", kind: str = "", limit: int = 24):
    """Zdjęcia sprzętu z Wikimedia (bez klucza): 1) główne zdjęcie artykułu na Wikipedii EN/PL,
    2) pliki z pasującej kategorii Commons, 3) wyszukiwanie plików, 4) awaryjnie z nazwą konsoli.
    Zdjęcia Evan-Amos (neutralne tło, prawie każdy sprzęt) idą na początek."""
    q, model, platform = q.strip(), model.strip(), platform.strip()
    if len(q) < 2:
        return {"covers": [], "notes": []}
    ck = f"{q}|{model}|{platform}|{kind}".lower()
    if ck in _photo_cache and _photo_cache[ck][0] > time.time():
        return _photo_cache[ck][1]
    base = f"{q} {model}".strip()
    found: "OrderedDict[str, int]" = OrderedDict()   # plik → źródło (0 = Wikipedia, 2 = kategoria, 3 = szukanie)
    lead: set = set()                                 # zdjęcie z pierwszego (najtrafniejszego) artykułu

    def add(name: str, src: int):
        k = _file_key(name)
        if k and k not in found and not any(w in k.lower() for w in PHOTO_SKIP):
            found[k] = src

    wiki_q = [("en", base), ("pl", q)] + ([("en", q)] if model else [])
    wiki = await asyncio.gather(*[_mw(f"https://{lang}.wikipedia.org/w/api.php", {
        "action": "query", "generator": "search", "gsrnamespace": "0", "gsrlimit": "3", "gsrsearch": text,
        "prop": "pageimages", "piprop": "name"}) for lang, text in wiki_q])
    for d in wiki:
        for pg in sorted((d.get("query") or {}).get("pages", []), key=lambda x: x.get("index", 0)):
            if pg.get("pageimage"):
                add(pg["pageimage"], 0)
                if pg.get("index") == 1:
                    lead.add(_file_key(pg["pageimage"]))

    cats = await _mw(COMMONS_API, {"action": "query", "list": "search", "srnamespace": "14", "srlimit": "2", "srsearch": q})
    members = await asyncio.gather(*[_mw(COMMONS_API, {
        "action": "query", "list": "categorymembers", "cmtitle": c["title"], "cmtype": "file", "cmlimit": "30"})
        for c in (cats.get("query") or {}).get("search", [])])
    for d in members:
        for m in (d.get("query") or {}).get("categorymembers", []):
            add(m["title"], 2)

    queries = [base] + ([q] if model else []) + ([f"{q} {platform}"] if platform else [])
    for d in await asyncio.gather(*[_mw(COMMONS_API, {
            "action": "query", "list": "search", "srnamespace": "6", "srlimit": "20",
            "srsearch": f"{text} filetype:bitmap"}) for text in queries]):
        for s_ in (d.get("query") or {}).get("search", []):
            add(s_["title"], 3)

    names = list(found)[:80]
    info: dict = {}
    for i in range(0, len(names), 50):
        d = await _mw(COMMONS_API, {"action": "query", "titles": "|".join("File:" + n for n in names[i:i + 50]),
                                    "prop": "imageinfo", "iiprop": "url|mime|size|extmetadata", "iiurlwidth": "640",
                                    "iiextmetadatafilter": "Artist|LicenseShortName"})
        for pg in (d.get("query") or {}).get("pages", []):
            if pg.get("imageinfo"):
                info[_file_key(pg["title"])] = pg["imageinfo"][0]

    # dopasowanie nazwy pliku do nazwy sprzętu (też „PlayStation 2” ↔ „PS2”, „DualShock” ↔ „DualShock2”)
    variants = {q.lower(), re.sub(r"playstation\s*(\d)", r"ps\1", q.lower())}
    word_sets = [[w for w in re.findall(r"[a-z0-9ąćęłńóśźż]+", v) if len(w) > 1] for v in variants]

    def match(name: str) -> float:
        toks = re.findall(r"[a-z0-9ąćęłńóśźż]+", name.lower())
        return max((sum(any(t.startswith(w) for t in toks) for w in ws) / len(ws) for ws in word_sets if ws), default=0)

    ranked = []
    for order, (name, src) in enumerate(found.items()):
        ii = info.get(name)
        if not ii or ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if (ii.get("width") or 0) < 250 or (ii.get("height") or 0) < 150:
            continue
        url = ii.get("thumburl") or ii.get("url")
        if not url or not trusted(url):
            continue
        meta = ii.get("extmetadata") or {}
        artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "")).strip()
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        score = match(name) + (0.3 if "evan-amos" in artist.lower() else 0) + (0.2 if name in lead else 0)
        key = (-round(score, 2), src, order)
        ranked.append((key, {"url": img_token(url), "region": "Wiki" if src == 0 else "Commons",
                             "source": "Wikipedia" if src == 0 else "Wikimedia Commons", "framed": True,
                             "title": name, "credit": " · ".join(x for x in (artist[:60], lic) if x)}))
    ranked.sort(key=lambda x: x[0])
    # konsola → najpierw zdjęcia z IGDB (każda wersja sprzętu)
    igdb_items = []
    if kind == "console":
        plat = platform if platform in PLATFORMS else platform_from_text(f"{q} {platform}")
        logos = []
        for name, url in await igdb_console_images(plat, f"{q} {model}"):
            logo = await is_logo_url(url)
            (logos if logo else igdb_items).append({
                "url": img_token(url), "region": "IGDB logo" if logo else "IGDB", "source": "IGDB", "framed": True,
                "title": name + (" (logo)" if logo else ""), "credit": "IGDB"})
        ranked += [(None, it) for it in logos]            # loga na sam koniec
    ranked = [(None, it) for it in igdb_items] + ranked
    out = {"covers": [r[1] for r in ranked[:limit]],
           "notes": [] if ranked else ["brak zdjęć — spróbuj innej nazwy (np. po angielsku)"]}
    _photo_cache[ck] = (time.time() + 3600, out)
    while len(_photo_cache) > 200:
        _photo_cache.popitem(last=False)
    return out


# --- API: eksport / backup -------------------------------------------------
# --- API: sugerowana cena ------------------------------------------------------
@app.get("/api/price")
async def price(title: str, platform: str = "", kind: str = "game", region: str = "PAL",
                edition: str = "", model: str = "", has_box: bool = True, has_manual: bool = True,
                has_disc: bool = True):
    title = title.strip()
    if len(title) < 2:
        raise HTTPException(400, "Podaj nazwę")
    return await prices.suggest(await http(), title=title[:200], platform=platform, kind=kind,
                                region=region, edition=edition, model=model[:80], has_box=has_box,
                                has_manual=has_manual, has_disc=has_disc,
                                currency=get_settings().get("currency", "PLN"))


@app.get("/api/export.csv")
def export_csv():
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    with db() as con:
        loans = _loans(con)
        rows = [row(r) for r in con.execute("SELECT * FROM items ORDER BY platform, title")]
    cols = ["id"] + COLUMNS + ["created_at", "updated_at"]
    w.writerow(cols + ["wypozyczona_komu", "wypozyczona_od"])
    for r in rows:
        ln = loans.get(r["id"]) or {}
        vals = [", ".join(r[c]) if c == "special" else r[c] for c in cols]
        w.writerow(vals + [ln.get("borrower"), ln.get("lent_on")])
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": "attachment; filename=moja-kolekcja.csv"})


@app.get("/api/backup.json")
def backup():
    with db() as con:
        items = [row(r) for r in con.execute("SELECT * FROM items ORDER BY id")]
        loans = [dict(r) for r in con.execute("SELECT * FROM loans ORDER BY id")]
        collections = colls.backup_rows(con)
        extra = {t: [dict(r) for r in con.execute(f"SELECT * FROM {t}")]
                 for t in ("value_history", "item_photos", "events", "trophies", "friends")}
    return JSONResponse({"version": len(MIGRATIONS), "items": items, "loans": loans,
                         "settings": get_settings(), "collections": collections, **extra}, headers={
        "Content-Disposition": f"attachment; filename=moja-kolekcja-{time.strftime('%Y%m%d')}.json"})


@app.post("/api/restore")
async def restore(file: UploadFile = File(...)):
    try:
        payload = json.loads(await file.read())
        items = [(it.get("id"), ItemIn(**{k: v for k, v in it.items() if k in ItemIn.model_fields}))
                 for it in payload["items"]]
        loans = payload.get("loans", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Niepoprawny plik backupu: {e}")
    snap = DATA / f"kolekcja-przed-restore-{time.strftime('%Y%m%d-%H%M%S')}.db"
    with db() as con:
        con.execute("PRAGMA wal_checkpoint(FULL)")
    shutil.copy2(DB_PATH, snap)
    with db() as con:
        con.execute("DELETE FROM loans")
        con.execute("DELETE FROM items")
        idmap = {}
        for old_id, it in items:
            d = it.model_dump(exclude={"cover_url", "spine_url"})
            cur = con.execute(
                f"INSERT INTO items ({','.join(COLUMNS)}) VALUES ({','.join('?' * len(COLUMNS))})",
                _db_values(d))
            idmap[old_id] = cur.lastrowid
        for ln in loans:
            if ln.get("item_id") in idmap:
                con.execute("INSERT INTO loans(item_id, borrower, lent_on, due_on, returned_on, notes) "
                            "VALUES (?,?,?,?,?,?)", (idmap[ln["item_id"]], ln["borrower"], ln["lent_on"],
                                                     ln.get("due_on"), ln.get("returned_on"), ln.get("notes")))
    if isinstance(payload.get("settings"), dict):
        write_settings({k: v for k, v in payload["settings"].items()
                        if (k != "theme" or v in THEMES) and (k != "lang" or v in LANGS)
                        and (k != "currency" or v in CURRENCIES)})
    if isinstance(payload.get("collections"), list):
        with db() as con:
            colls.restore_rows(con, payload["collections"])
    with db() as con:
        try:
            if isinstance(payload.get("value_history"), list):
                con.execute("DELETE FROM value_history")
                for h in payload["value_history"]:
                    con.execute("INSERT OR REPLACE INTO value_history(day, value, paid, items) VALUES (?,?,?,?)",
                                (h["day"], h["value"], h["paid"], h["items"]))
            if isinstance(payload.get("events"), list):
                con.execute("DELETE FROM events")
                for e in payload["events"]:
                    con.execute("INSERT INTO events(type, item_id, at) VALUES (?,?,?)",
                                (str(e["type"])[:30], idmap.get(e.get("item_id")), e["at"]))
            if isinstance(payload.get("trophies"), list):
                con.execute("DELETE FROM trophies")
                for t in payload["trophies"]:
                    con.execute("INSERT OR IGNORE INTO trophies(key, unlocked_at, seen) VALUES (?,?,1)",
                                (str(t["key"])[:20], t["unlocked_at"]))
                con.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('trophies_init', ?)", (json.dumps(len(trophies.DEFS)),))
            if isinstance(payload.get("item_photos"), list):   # pliki zdjęć są w backupie ZIP, tu tylko opisy
                for ph in payload["item_photos"]:
                    if idmap.get(ph.get("item_id")) and (DATA / "photos" / f"{ph['file']}.jpg").exists():
                        con.execute("INSERT INTO item_photos(item_id, file, w, h, caption, created_at) VALUES (?,?,?,?,?,?)",
                                    (idmap[ph["item_id"]], ph["file"], ph.get("w"), ph.get("h"), ph.get("caption"), ph["created_at"]))
            if isinstance(payload.get("friends"), list):
                con.execute("DELETE FROM friends")
                for f in payload["friends"]:
                    con.execute("INSERT INTO friends(name, shared_at, imported_at, data) VALUES (?,?,?,?)",
                                (f["name"], f.get("shared_at"), f["imported_at"], json.dumps(share.clean(json.loads(f["data"])))))
            snapshot_value(con)
        except (KeyError, TypeError, ValueError, HTTPException) as e:
            log.warning("Restore — dodatkowe dane pominięte: %s", e)
    return {"restored": len(items), "snapshot": snap.name}
