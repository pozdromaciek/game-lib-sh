# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Lokalny indeks okładek z LaunchBox Games DB (okładki per platforma i region).

Metadata.zip (publiczny, aktualizowany codziennie) jest pobierany raz i parsowany
strumieniowo do osobnej bazy SQLite. Trzymamy tylko obsługiwane platformy i obrazki
typu "Box - Front", więc indeks jest mały, a wyszukiwanie działa offline.
"""
import logging
import os
import re
import sqlite3
import threading
import time
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx

log = logging.getLogger("kolekcja.launchbox")

METADATA_URL = os.getenv("LAUNCHBOX_METADATA_URL", "https://gamesdb.launchbox-app.com/Metadata.zip")
IMAGE_BASE = "https://images.launchbox-app.com/"
COVER_TYPES = ("Box - Front", "Box - Front - Reconstructed")
SPINE_TYPES = ("Box - Spine",)
IMAGE_TYPES = COVER_TYPES + SPINE_TYPES

# nasza nazwa platformy -> nazwa platformy w LaunchBox
PLATFORMS = {
    "Xbox": "Microsoft Xbox", "Xbox 360": "Microsoft Xbox 360", "Xbox One": "Microsoft Xbox One",
    "Xbox Series X|S": "Microsoft Xbox Series X/S",
    "PlayStation": "Sony Playstation", "PlayStation 2": "Sony Playstation 2",
    "PlayStation 3": "Sony Playstation 3", "PlayStation 4": "Sony Playstation 4",
    "PlayStation 5": "Sony Playstation 5", "PSP": "Sony PSP", "PS Vita": "Sony Playstation Vita",
    "NES": "Nintendo Entertainment System", "SNES": "Super Nintendo Entertainment System",
    "Nintendo 64": "Nintendo 64", "GameCube": "Nintendo GameCube", "Wii": "Nintendo Wii",
    "Wii U": "Nintendo Wii U", "Nintendo Switch": "Nintendo Switch",
    "Game Boy": "Nintendo Game Boy", "Game Boy Color": "Nintendo Game Boy Color",
    "Game Boy Advance": "Nintendo Game Boy Advance", "Nintendo DS": "Nintendo DS",
    "Nintendo 3DS": "Nintendo 3DS", "Sega Mega Drive": "Sega Genesis",
    "Sega Dreamcast": "Sega Dreamcast", "PC": "Windows",
}
LB_TO_OURS = {v: k for k, v in PLATFORMS.items()}

# kolejność regionów okładek — najpierw wydania PAL
REGION_ORDER = [
    "Europe", "United Kingdom", "Poland", "Germany", "France", "Italy", "Spain",
    "The Netherlands", "Sweden", "Australia", "World", None,
    "North America", "United States", "Canada", "Japan",
]
REGION_LABEL = {
    None: "—", "Europe": "PAL", "United Kingdom": "UK", "Poland": "PL", "Germany": "DE",
    "France": "FR", "Italy": "IT", "Spain": "ES", "The Netherlands": "NL", "Sweden": "SE",
    "Australia": "AU", "World": "World", "North America": "NTSC-U", "United States": "USA",
    "Canada": "CA", "Japan": "JP",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def region_rank(region):
    try:
        return REGION_ORDER.index(region)
    except ValueError:
        return len(REGION_ORDER)


class LaunchBox:
    def __init__(self, data_dir: Path):
        self.dir = data_dir / "launchbox"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.dir / "launchbox.db"
        self.lock = threading.Lock()
        self.status = {"state": "ready" if self.db_path.exists() else "missing",
                       "progress": None, "message": None, "games": self._count()}

    # --- stan -----------------------------------------------------------
    def _count(self):
        if not self.db_path.exists():
            return 0
        try:
            con = sqlite3.connect(self.db_path)
            n = con.execute("SELECT COUNT(*) FROM games").fetchone()[0]
            con.close()
            return n
        except sqlite3.Error:
            return 0

    @property
    def ready(self) -> bool:
        return self.db_path.exists() and self.status["games"] > 0

    @property
    def busy(self) -> bool:
        return self.status["state"] in ("downloading", "parsing")

    def start_import(self) -> bool:
        with self.lock:
            if self.busy:
                return False
            self.status.update(state="downloading", progress=0, message=None)
        threading.Thread(target=self._import, daemon=True, name="launchbox-import").start()
        return True

    # --- import ---------------------------------------------------------
    def _import(self):
        zpath = self.dir / "Metadata.zip.part"
        tmpdb = self.dir / "launchbox.new.db"
        try:
            self._download(zpath)
            self.status.update(state="parsing", progress=None)
            self._parse(zpath, tmpdb)
            os.replace(tmpdb, self.db_path)
            self.status.update(state="ready", progress=None, games=self._count(),
                               message=time.strftime("zaktualizowano %Y-%m-%d %H:%M"))
            log.info("LaunchBox: zaimportowano %s gier", self.status["games"])
        except Exception as e:  # noqa: BLE001
            log.exception("LaunchBox import nieudany")
            self.status.update(state="error", progress=None, message=str(e)[:300])
        finally:
            for p in (zpath, tmpdb):
                try:
                    p.unlink()
                except FileNotFoundError:
                    pass

    def _download(self, dest: Path):
        timeout = httpx.Timeout(30, read=300)
        with httpx.stream("GET", METADATA_URL, timeout=timeout, follow_redirects=True) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length") or 0)
            done = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
                    done += len(chunk)
                    if total:
                        self.status["progress"] = round(done * 100 / total)

    @staticmethod
    def _iter_records(fileobj):
        """Rekordy najwyższego poziomu; zwalnia pamięć po każdym (plik ma setki MB)."""
        ctx = ET.iterparse(fileobj, events=("start", "end"))
        _, root = next(iter(ctx))
        depth = 0
        for event, elem in ctx:
            if event == "start":
                depth += 1
                continue
            depth -= 1
            if depth == 0:
                yield elem
                root.clear()

    def _parse(self, zpath: Path, dbpath: Path):
        if dbpath.exists():
            dbpath.unlink()
        con = sqlite3.connect(dbpath)
        con.executescript("""
            PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;
            CREATE TABLE games (id INTEGER PRIMARY KEY, name TEXT, norm TEXT, platform TEXT,
                                year INTEGER, genres TEXT);
            CREATE TABLE alt (id INTEGER, norm TEXT);
            CREATE TABLE images (id INTEGER, file TEXT, type TEXT, region TEXT);
        """)
        wanted = set(PLATFORMS.values())
        games, alts, images = [], [], []

        def flush():
            con.executemany("INSERT OR REPLACE INTO games VALUES (?,?,?,?,?,?)", games)
            con.executemany("INSERT INTO alt VALUES (?,?)", alts)
            con.executemany("INSERT INTO images VALUES (?,?,?,?)", images)
            games.clear(); alts.clear(); images.clear()

        with zipfile.ZipFile(zpath) as z, z.open("Metadata.xml") as f:
            for n, el in enumerate(self._iter_records(f)):
                tag = el.tag
                if tag == "Game":
                    plat = (el.findtext("Platform") or "").strip()
                    gid = (el.findtext("DatabaseID") or "").strip()
                    name = (el.findtext("Name") or "").strip()
                    if plat in wanted and gid.isdigit() and name:
                        rd = (el.findtext("ReleaseDate") or el.findtext("ReleaseYear") or "")[:4]
                        genres = (el.findtext("Genres") or "").replace(";", ", ").strip() or None
                        games.append((int(gid), name, norm(name), plat,
                                      int(rd) if rd.isdigit() else None, genres))
                elif tag == "GameAlternateName":
                    gid = (el.findtext("DatabaseID") or "").strip()
                    alt = (el.findtext("AlternateName") or "").strip()
                    if gid.isdigit() and alt:
                        alts.append((int(gid), norm(alt)))
                elif tag == "GameImage":
                    typ = (el.findtext("Type") or "").strip()
                    gid = (el.findtext("DatabaseID") or "").strip()
                    fn = (el.findtext("FileName") or "").strip()
                    if typ in IMAGE_TYPES and gid.isdigit() and fn:
                        region = (el.findtext("Region") or "").strip() or None
                        images.append((int(gid), fn, typ, region))
                if n % 20000 == 0:
                    flush()
        flush()
        # tylko obrazki/aliasy gier z obsługiwanych platform
        con.executescript("""
            DELETE FROM images WHERE id NOT IN (SELECT id FROM games);
            DELETE FROM alt WHERE id NOT IN (SELECT id FROM games);
            CREATE INDEX idx_games_plat ON games(platform, norm);
            CREATE INDEX idx_alt ON alt(norm);
            CREATE INDEX idx_img ON images(id);
            VACUUM;
        """)
        con.close()

    # --- wyszukiwanie ---------------------------------------------------
    def search(self, q: str, platform: str | None, limit: int = 24):
        if not self.ready:
            return []
        tokens = norm(q).split()
        if not tokens:
            return []
        con = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        try:
            like = " AND ".join(["n LIKE ?"] * len(tokens))
            params = [f"%{t}%" for t in tokens]
            lb_plat = PLATFORMS.get(platform or "")
            plat_sql = "AND g.platform = ?" if lb_plat else ""
            plat_par = [lb_plat] if lb_plat else []
            sql = f"""
                SELECT g.*, MIN(m.rank) AS r FROM (
                    SELECT id, norm AS n, 0 AS rank FROM games
                    UNION ALL SELECT id, norm AS n, 1 AS rank FROM alt
                ) m JOIN games g ON g.id = m.id
                WHERE {like} {plat_sql}
                GROUP BY g.id
                ORDER BY (g.norm = ?) DESC, (g.norm LIKE ?) DESC, r, length(g.name)
                LIMIT ?"""
            full = " ".join(tokens)
            rows = con.execute(sql, params + plat_par + [full, full + "%", limit]).fetchall()
            out = []
            for g in rows:
                imgs = con.execute("SELECT file, type, region FROM images WHERE id = ?",
                                   (g["id"],)).fetchall()
                imgs = sorted(imgs, key=lambda i: (IMAGE_TYPES.index(i["type"]),
                                                   region_rank(i["region"])))
                pack = lambda lst: [{"url": IMAGE_BASE + i["file"],  # noqa: E731
                                     "region": REGION_LABEL.get(i["region"], i["region"])}
                                    for i in lst[:12]]
                out.append({
                    "source": "launchbox", "ext_id": g["id"], "title": g["name"],
                    "platform": LB_TO_OURS.get(g["platform"], g["platform"]),
                    "release_year": g["year"], "genres": g["genres"],
                    "covers": pack([i for i in imgs if i["type"] in COVER_TYPES]),
                    "spines": pack([i for i in imgs if i["type"] in SPINE_TYPES]),
                })
            return out
        finally:
            con.close()
