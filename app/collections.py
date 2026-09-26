# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Kolekcje: serie gier (np. „Grand Theft Auto”) z postępem — posiadane vs brakujące.

Gra liczy się jako posiadana, gdy masz ją na dowolnej platformie z zakresu kolekcji
(dowolna / rodzina / jedna platforma). Dopasowanie: igdb_id (także remaster ↔ oryginał),
a dla pozycji bez igdb_id — po znormalizowanej nazwie.
"""
import json
import re
import time
import unicodedata
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

FAMILIES = {
    "playstation": ["PlayStation", "PlayStation 2", "PlayStation 3", "PlayStation 4", "PlayStation 5", "PSP", "PS Vita"],
    "xbox": ["Xbox", "Xbox 360", "Xbox One", "Xbox Series X|S"],
    "nintendo": ["NES", "SNES", "Nintendo 64", "GameCube", "Wii", "Wii U", "Nintendo Switch", "Game Boy",
                 "Game Boy Color", "Game Boy Advance", "Nintendo DS", "Nintendo 3DS"],
    "sega": ["Sega Mega Drive", "Sega Dreamcast"],
    "pc": ["PC"],
}
# IGDB game_type / category → nasz typ; None = pomijamy (mody, odcinki, aktualizacje…)
GTYPE = {0: "main", 1: "dlc", 2: "expansion", 3: "bundle", 4: "expansion", 5: None, 6: None, 7: None,
         8: "remake", 9: "remaster", 10: "remaster", 11: "main", 12: None, 13: None, 14: None}
DEFAULT_INCLUDE = {"main": True, "expansion": False, "dlc": False, "bundle": False, "remaster": "either"}
GAME_FIELDS = ("fields name,first_release_date,cover.image_id,platforms,category,game_type,"
               "version_parent,remakes,remasters,parent_game;")


def M():
    from . import main  # import leniwy (main importuje ten moduł)
    return main


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return " ".join(w for w in re.sub(r"[^a-z0-9]+", " ", s).split() if w not in ("the", "a"))


def allowed_platforms(scope: str, value: Optional[str]) -> Optional[set]:
    if scope == "platform":
        return {value} if value else None
    if scope == "family":
        return set(FAMILIES.get(value or "", []))
    return None


# --- IGDB ------------------------------------------------------------------------
def _entry_from_igdb(g: dict) -> Optional[dict]:
    m = M()
    if g.get("version_parent"):          # wersje/edycje (GOTY, Deluxe) — nie osobne gry
        return None
    t = g.get("game_type") if isinstance(g.get("game_type"), int) else g.get("category", 0)
    typ = GTYPE.get(t if isinstance(t, int) else 0, "main")
    if typ is None:
        return None
    rev = {v: k for k, v in m.PLATFORMS.items()}
    ts = g.get("first_release_date")
    cid = (g.get("cover") or {}).get("image_id")
    return {"igdb_id": g["id"], "title": g.get("name") or "?", "year": time.gmtime(ts).tm_year if ts else None,
            "platforms": [rev[p] for p in g.get("platforms") or [] if p in rev],
            "cover_url": m.igdb_img(cid) if cid else None, "type": typ,
            "_alts": list(g.get("remakes") or []) + list(g.get("remasters") or [])}


async def igdb_exclusive_games(pid: int) -> list:
    """Gry wydane TYLKO na jedną platformę (bez portów, bez PC). IGDB `platforms = {id}` = dokładnie ten zbiór;
    dodatkowo filtrujemy po stronie serwera, więc wynik jest poprawny nawet przy innej składni API."""
    m = M()
    q = f"{GAME_FIELDS} where platforms = {{{pid}}} & version_parent = null; sort total_rating_count desc; limit 400;"
    try:
        rows = await m.igdb("games", q)
    except Exception:  # noqa: BLE001 — starsza składnia: „zawiera”, a dokładność zapewnia filtr niżej
        rows = await m.igdb("games", f"{GAME_FIELDS} where platforms = [{pid}] & version_parent = null; sort total_rating_count desc; limit 500;")
    return [g for g in rows if (g.get("platforms") or []) == [pid]]


async def igdb_series_games(stype: str, sid: int) -> list:
    m = M()
    if stype == "exclusive":
        out = await igdb_exclusive_games(sid)
        entries = [e for e in (_entry_from_igdb(g) for g in out) if e]
        for e in entries:
            e.pop("_alts", None)
            e["alt_of"] = None
        entries.sort(key=lambda e: (e["year"] or 9999, e["title"]))
        return entries
    where = f"collections = ({sid})" if stype == "collection" else f"franchises = ({sid})"
    out, offset = [], 0
    while offset < 500:
        batch = await m.igdb("games", f"{GAME_FIELDS} where {where}; sort first_release_date asc; limit 200; offset {offset};")
        out += batch
        if len(batch) < 200:
            break
        offset += 200
    entries = [e for e in (_entry_from_igdb(g) for g in out) if e]
    # remaster/remake → wskaż oryginał, jeśli oryginał też jest w serii
    ids = {e["igdb_id"] for e in entries}
    orig_of = {}
    for e in entries:
        for a in e.pop("_alts"):
            if a in ids and a != e["igdb_id"]:
                orig_of.setdefault(a, e["igdb_id"])
    for e in entries:
        e["alt_of"] = orig_of.get(e["igdb_id"]) if e["type"] in ("remaster", "remake") else None
    entries.sort(key=lambda e: (e["year"] or 9999, e["title"]))
    return entries


def apply_include(entries: list, include: dict) -> list:
    """Filtr typów + scalanie remasterów z oryginałem (tryb „either”)."""
    inc = {**DEFAULT_INCLUDE, **(include or {})}
    out = []
    merged: dict = {}
    for e in entries:
        typ = e.get("type", "main")
        if typ in ("remaster", "remake"):
            if inc["remaster"] == "skip":
                continue
            if inc["remaster"] == "either" and e.get("alt_of"):
                merged.setdefault(e["alt_of"], []).append(e["igdb_id"])
                continue
        elif typ == "main" and not inc.get("main", True):
            continue
        elif typ in ("dlc", "expansion", "bundle") and not inc.get(typ):
            continue
        out.append(e)
    for e in out:
        e["alt_ids"] = sorted(set((e.get("alt_ids") or []) + merged.get(e.get("igdb_id"), [])))
    return out


# --- modele ---------------------------------------------------------------------------
class Source(BaseModel):
    type: Literal["collection", "franchise", "exclusive"]
    id: int
    name: str = Field(default="", max_length=200)


class EntryIn(BaseModel):
    igdb_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=300)
    year: Optional[int] = None
    platforms: list[str] = []
    cover_url: Optional[str] = None
    type: str = "main"
    hidden: bool = False
    alt_ids: list[int] = []


class CollIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source: Optional[Source] = None
    scope: Literal["any", "family", "platform"] = "any"
    scope_value: Optional[str] = None
    include: dict = {}
    entries: list[EntryIn] = Field(default=[], max_length=600)


class PreviewIn(BaseModel):
    source: Source


# --- zapis / odczyt -------------------------------------------------------------------
def _check(c: CollIn):
    m = M()
    if c.scope == "family" and c.scope_value not in FAMILIES:
        raise HTTPException(422, "Nieznana rodzina platform")
    if c.scope == "platform" and c.scope_value not in m.PLATFORMS:
        raise HTTPException(422, "Nieznana platforma")
    for e in c.entries:
        if e.cover_url and not m.trusted(e.cover_url):
            e.cover_url = None


def _save_entries(con, cid: int, entries: list):
    con.execute("DELETE FROM collection_entries WHERE collection_id = ?", (cid,))
    for i, e in enumerate(entries):
        d = e if isinstance(e, dict) else e.model_dump()
        con.execute("INSERT INTO collection_entries(collection_id, pos, igdb_id, title, year, platforms, cover_url, type, hidden, alt_ids) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (cid, i, d.get("igdb_id"), d["title"][:300], d.get("year"), json.dumps(d.get("platforms") or []),
                     d.get("cover_url"), d.get("type") or "main", int(bool(d.get("hidden"))), json.dumps(d.get("alt_ids") or [])))


def _load(con, only: Optional[int] = None) -> list:
    m = M()
    items = [dict(r) for r in con.execute("SELECT id, title, platform, igdb_id, wish FROM items WHERE kind = 'game' AND sold_on IS NULL")]
    by_igdb: dict = {}
    by_name: dict = {}
    for it in items:
        if it["igdb_id"]:
            by_igdb.setdefault(it["igdb_id"], []).append(it)
        else:
            by_name.setdefault(norm(it["title"]), []).append(it)
    q = "SELECT * FROM collections" + (" WHERE id = ?" if only else "") + " ORDER BY name COLLATE NOCASE"
    out = []
    for c in con.execute(q, (only,) if only else ()):
        c = dict(c)
        allowed = allowed_platforms(c["scope"], c["scope_value"])
        entries = []
        for e in con.execute("SELECT * FROM collection_entries WHERE collection_id = ? ORDER BY pos", (c["id"],)):
            e = dict(e)
            e["platforms"] = json.loads(e["platforms"] or "[]")
            e["alt_ids"] = json.loads(e["alt_ids"] or "[]")
            found = []
            for gid in [e["igdb_id"], *e["alt_ids"]]:
                if gid:
                    found += by_igdb.get(gid, [])
            found += by_name.get(norm(e["title"]), [])
            seen = set()
            found = [f for f in found if not (f["id"] in seen or seen.add(f["id"]))]
            if allowed is not None:
                found = [f for f in found if f["platform"] in allowed]
            e["owned"] = [{"id": f["id"], "platform": f["platform"]} for f in found if not f["wish"]]
            e["wish"] = [{"id": f["id"], "platform": f["platform"]} for f in found if f["wish"]]
            e["hidden"] = bool(e["hidden"])
            e["cover"] = m.img_token(e["cover_url"]) if e["cover_url"] else None
            entries.append(e)
        out.append({"id": c["id"], "name": c["name"], "scope": c["scope"], "scope_value": c["scope_value"],
                    "include": {**DEFAULT_INCLUDE, **json.loads(c["include"] or "{}")},
                    "source": ({"type": c["source_type"], "id": c["source_id"], "name": c["source_name"]}
                               if c["source_type"] else None),
                    "entries": entries})
    return out


@router.get("/api/collections")
def list_collections():
    with M().db() as con:
        return _load(con)


@router.post("/api/collections", status_code=201)
def create_collection(c: CollIn):
    _check(c)
    with M().db() as con:
        cur = con.execute("INSERT INTO collections(name, source_type, source_id, source_name, scope, scope_value, include) "
                          "VALUES (?,?,?,?,?,?,?)",
                          (c.name.strip(), c.source.type if c.source else None, c.source.id if c.source else None,
                           c.source.name if c.source else None, c.scope, c.scope_value if c.scope != "any" else None,
                           json.dumps(c.include)))
        _save_entries(con, cur.lastrowid, c.entries)
        return _load(con, cur.lastrowid)[0]


@router.put("/api/collections/{cid}")
def update_collection(cid: int, c: CollIn):
    _check(c)
    with M().db() as con:
        cur = con.execute("UPDATE collections SET name=?, source_type=?, source_id=?, source_name=?, scope=?, scope_value=?, "
                          "include=?, updated_at=datetime('now') WHERE id=?",
                          (c.name.strip(), c.source.type if c.source else None, c.source.id if c.source else None,
                           c.source.name if c.source else None, c.scope, c.scope_value if c.scope != "any" else None,
                           json.dumps(c.include), cid))
        if not cur.rowcount:
            raise HTTPException(404, "Nie ma takiej kolekcji")
        _save_entries(con, cid, c.entries)
        return _load(con, cid)[0]


@router.delete("/api/collections/{cid}", status_code=204)
def delete_collection(cid: int):
    with M().db() as con:
        con.execute("DELETE FROM collection_entries WHERE collection_id = ?", (cid,))
        con.execute("DELETE FROM collections WHERE id = ?", (cid,))


@router.post("/api/collections/{cid}/refresh")
async def refresh_collection(cid: int):
    with M().db() as con:
        cur = _load(con, cid)
    if not cur:
        raise HTTPException(404, "Nie ma takiej kolekcji")
    c = cur[0]
    if not c["source"]:
        raise HTTPException(400, "Kolekcja nie jest powiązana z serią IGDB ani platformą")
    fresh = apply_include(await igdb_series_games(c["source"]["type"], c["source"]["id"]), c["include"])
    old = {e["igdb_id"]: e for e in c["entries"] if e["igdb_id"]}
    allowed = allowed_platforms(c["scope"], c["scope_value"])
    entries = []
    for e in fresh:
        if allowed is not None and not set(e["platforms"]) & allowed:
            continue
        prev = old.pop(e["igdb_id"], None)
        e["hidden"] = prev["hidden"] if prev else False
        entries.append(e)
    # ręcznie dodane (spoza serii) zostają
    entries += [e for e in c["entries"] if e["type"] == "manual" or (e["igdb_id"] is None)]
    added = len(entries) - len(c["entries"])
    with M().db() as con:
        _save_entries(con, cid, entries)
        con.execute("UPDATE collections SET updated_at=datetime('now') WHERE id=?", (cid,))
        return {**_load(con, cid)[0], "added": added}


@router.get("/api/collections/series")
async def search_series(q: str):
    m = M()
    q = re.sub(r'["\\;*]', " ", q).strip()[:80]
    if len(q) < 2:
        return []
    out = []
    for stype, ep in (("collection", "collections"), ("franchise", "franchises")):
        rows = await m.igdb(ep, f'fields name,games; where name ~ *"{q}"*; limit 8;')
        for r in rows:
            n = len(r.get("games") or [])
            if n:
                out.append({"type": stype, "id": r["id"], "name": r.get("name") + (" (franczyza)" if stype == "franchise" else ""),
                            "games": n, "_exact": norm(r.get("name")) == norm(q)})
    out.sort(key=lambda s: (not s["_exact"], s["type"] != "collection", -s["games"]))
    for s in out:
        s.pop("_exact")
    return out[:10]


@router.post("/api/collections/preview")
async def preview(body: PreviewIn):
    entries = await igdb_series_games(body.source.type, body.source.id)
    with M().db() as con:
        items = [dict(r) for r in con.execute("SELECT igdb_id, title, platform FROM items WHERE kind='game' AND wish=0 AND sold_on IS NULL")]
    have = {i["igdb_id"] for i in items if i["igdb_id"]}
    names = {norm(i["title"]) for i in items}
    for i, e in enumerate(entries):
        e["id"] = f"p{e['igdb_id']}"
        e["hidden"] = e["type"] in ("dlc", "bundle")
        e["owned"] = [1] if e["igdb_id"] in have or norm(e["title"]) in names else []
        e["wish"] = []
    return entries


@router.get("/api/collections/games")
async def search_games(q: str):
    """Wyszukiwarka do ręcznego dodania gry (z platformami i okładką)."""
    m = M()
    q = re.sub(r'["\\;]', " ", q).strip()[:100]
    if len(q) < 2:
        return []
    rows = await m.igdb("games", f'search "{q}"; {GAME_FIELDS} limit 12;')
    out = []
    for g in rows:
        e = _entry_from_igdb(g)
        if e:
            e.pop("_alts", None)
            out.append(e)
    return out


def backup_rows(con) -> list:
    return [{**{k: c[k] for k in ("name", "source_type", "source_id", "source_name", "scope", "scope_value", "include")},
             "entries": [{k: e[k] for k in ("igdb_id", "title", "year", "platforms", "cover_url", "type", "hidden", "alt_ids")}
                         for e in con.execute("SELECT * FROM collection_entries WHERE collection_id=? ORDER BY pos", (c["id"],))]}
            for c in con.execute("SELECT * FROM collections ORDER BY id")]


def restore_rows(con, rows: list):
    con.execute("DELETE FROM collection_entries")
    con.execute("DELETE FROM collections")
    for c in rows or []:
        cur = con.execute("INSERT INTO collections(name, source_type, source_id, source_name, scope, scope_value, include) "
                          "VALUES (?,?,?,?,?,?,?)", (c["name"], c.get("source_type"), c.get("source_id"), c.get("source_name"),
                                                     c.get("scope") or "any", c.get("scope_value"), c.get("include") or "{}"))
        ents = []
        for e in c.get("entries", []):
            e = dict(e)
            for k in ("platforms", "alt_ids"):
                if isinstance(e.get(k), str):
                    e[k] = json.loads(e[k] or "[]")
            ents.append(e)
        _save_entries(con, cur.lastrowid, ents)
