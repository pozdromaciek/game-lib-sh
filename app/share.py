# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""„Kod kolekcji” — udostępnianie bez serwera pośredniego i bez otwierania portów.

Eksport: skompresowany JSON (zlib + base64url) z tytułami, platformami, kompletnością, statusem
i ID okładek z IGDB. Ceny tylko na życzenie. Bez notatek, wypożyczeń, dat zakupu.
Import: znajomy wkleja kod albo wgrywa plik → podstrona „Znajomi” z porównaniem kolekcji.
Dane z kodu traktujemy jako niezaufane: walidacja typów i długości, limity rozmiaru.
"""
import base64
import json
import re
import secrets
import time
import zlib
from datetime import date
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter()
PREFIX = "MK1:"
MAX_CODE = 3_000_000
MAX_JSON = 5_000_000
MAX_ITEMS = 5000
KIND = {"game": "g", "console": "c", "accessory": "a"}
KIND_R = {v: k for k, v in KIND.items()}
STATUSES = {"backlog", "playing", "completed", "dropped"}


def M():
    from . import main
    return main


def norm(s: str) -> str:
    from .collections import norm as n
    return n(s)


def share_id(con) -> str:
    r = con.execute("SELECT value FROM settings WHERE key='share_id'").fetchone()
    if r:
        return json.loads(r["value"])
    sid = secrets.token_hex(8)
    con.execute("INSERT INTO settings(key, value) VALUES ('share_id', ?)", (json.dumps(sid),))
    return sid


async def build(name: str, prices: bool) -> dict:
    m = M()
    with m.db() as con:
        items = [dict(r) for r in con.execute("SELECT * FROM items WHERE sold_on IS NULL ORDER BY kind, platform, title")]
        sid = share_id(con)
    # ID okładek z IGDB (jedno zapytanie na 500 gier) — okładki lokalne zostają u Ciebie
    covers = {}
    ids = sorted({i["igdb_id"] for i in items if i["igdb_id"]})
    if ids and m.igdb_on():
        for k in range(0, len(ids), 500):
            chunk = ids[k:k + 500]
            try:
                for g in await m.igdb("games", f"fields cover.image_id; where id = ({','.join(map(str, chunk))}); limit 500;"):
                    cid = (g.get("cover") or {}).get("image_id")
                    if cid:
                        covers[g["id"]] = cid
            except HTTPException:
                break
    out = []
    for i in items:
        e = {"t": i["title"], "k": KIND[i["kind"]], "p": i["platform"] or ""}
        if i["igdb_id"]:
            e["ig"] = i["igdb_id"]
            if i["igdb_id"] in covers:
                e["ci"] = covers[i["igdb_id"]]
        if i["wish"]:
            e["w"] = 1
        else:
            e["c"] = (1 if i["has_disc"] else 0) | (2 if i["has_box"] else 0) | (4 if i["has_manual"] else 0)
            if i["kind"] == "game" and i["status"]:
                e["s"] = i["status"]
            if i["rating"]:
                e["r"] = i["rating"]
        if i["region"]:
            e["rg"] = i["region"]
        if i["edition"]:
            e["ed"] = i["edition"]
        if i["release_year"]:
            e["y"] = i["release_year"]
        if prices and i["value"] is not None and not i["wish"]:
            e["v"] = i["value"]
        if i["for_sale"]:
            e["fs"] = 1
            if i["asking_price"] is not None:
                e["ap"] = i["asking_price"]
        out.append(e)
    return {"v": 1, "id": sid, "name": name[:40], "at": date.today().isoformat(), "items": out}


def encode(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    return PREFIX + base64.urlsafe_b64encode(zlib.compress(raw, 9)).decode().rstrip("=")


def decode(code: str) -> dict:
    code = re.sub(r"\s+", "", code or "")
    if not code.startswith(PREFIX) or len(code) > MAX_CODE:
        raise HTTPException(400, "To nie jest kod kolekcji (powinien zaczynać się od MK1:)")
    body = code[len(PREFIX):]
    try:
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        d = zlib.decompressobj()
        data = d.decompress(raw, MAX_JSON)
        if d.unconsumed_tail:
            raise ValueError("za duży")
        payload = json.loads(data)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Kod jest uszkodzony — skopiuj go jeszcze raz w całości")
    return clean(payload)


def _s(v, n: int) -> Optional[str]:
    return v.strip()[:n] if isinstance(v, str) and v.strip() else None


def clean(p: dict) -> dict:
    """Walidacja niezaufanych danych z kodu."""
    if not isinstance(p, dict) or p.get("v") != 1 or not isinstance(p.get("items"), list):
        raise HTTPException(400, "Nieobsługiwany format kodu")
    items = []
    for e in p["items"][:MAX_ITEMS]:
        if not isinstance(e, dict) or not _s(e.get("t"), 300) or e.get("k") not in KIND_R:
            continue
        it = {"t": _s(e["t"], 300), "k": e["k"], "p": _s(e.get("p"), 60) or ""}
        if isinstance(e.get("ig"), int) and e["ig"] > 0:
            it["ig"] = e["ig"]
        if isinstance(e.get("ci"), str) and re.fullmatch(r"[a-z0-9]{3,40}", e["ci"]):
            it["ci"] = e["ci"]
        if e.get("w") == 1:
            it["w"] = 1
        if isinstance(e.get("c"), int) and 0 <= e["c"] <= 7:
            it["c"] = e["c"]
        if e.get("s") in STATUSES:
            it["s"] = e["s"]
        if isinstance(e.get("r"), int) and 1 <= e["r"] <= 10:
            it["r"] = e["r"]
        for k, n in (("rg", 10), ("ed", 80)):
            if _s(e.get(k), n):
                it[k] = _s(e[k], n)
        if isinstance(e.get("y"), int) and 1970 <= e["y"] <= 2100:
            it["y"] = e["y"]
        if isinstance(e.get("v"), (int, float)) and 0 <= e["v"] < 10_000_000:
            it["v"] = round(float(e["v"]), 2)
        if e.get("fs") == 1:
            it["fs"] = 1
            if isinstance(e.get("ap"), (int, float)) and 0 <= e["ap"] < 10_000_000:
                it["ap"] = round(float(e["ap"]), 2)
        items.append(it)
    sid = p.get("id") if isinstance(p.get("id"), str) and re.fullmatch(r"[a-f0-9]{16}", p.get("id") or "") else None
    at = p.get("at") if isinstance(p.get("at"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.get("at") or "") else None
    return {"v": 1, "id": sid, "name": _s(p.get("name"), 40) or "Znajomy", "at": at, "items": items}


# --- eksport -------------------------------------------------------------------------
@router.get("/api/share/code")
async def share_code(name: str = "", prices: bool = False, file: bool = False):
    payload = await build(name.strip() or "Kolekcja", prices)
    code = encode(payload)
    with M().db() as con:
        M().log_event(con, "share")
    games = sum(1 for e in payload["items"] if e["k"] == "g" and not e.get("w"))
    if file:
        fn = re.sub(r"[^A-Za-z0-9_-]+", "-", payload["name"]).strip("-") or "kolekcja"
        return Response(code, media_type="text/plain; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{fn}.mkol"'})
    return {"code": code, "length": len(code), "items": len(payload["items"]), "games": games}


# --- znajomi ---------------------------------------------------------------------------
class CodeIn(BaseModel):
    code: str = Field(min_length=5, max_length=MAX_CODE)
    name: Optional[str] = Field(default=None, max_length=40)


def _save_friend(p: dict, name: Optional[str]) -> dict:
    with M().db() as con:
        nm = (name or "").strip() or p["name"]
        existing = None
        if p["id"]:
            for r in con.execute("SELECT id, data FROM friends"):
                if json.loads(r["data"]).get("id") == p["id"]:
                    existing = r["id"]
        if existing:
            con.execute("UPDATE friends SET name=?, shared_at=?, imported_at=datetime('now'), data=? WHERE id=?",
                        (nm, p["at"], json.dumps(p, ensure_ascii=False), existing))
            fid, updated = existing, True
        else:
            M().log_event(con, "friend_add")
            fid = con.execute("INSERT INTO friends(name, shared_at, data) VALUES (?,?,?)",
                              (nm, p["at"], json.dumps(p, ensure_ascii=False))).lastrowid
            updated = False
    return {"id": fid, "updated": updated, "name": nm, "items": len(p["items"])}


@router.post("/api/friends")
def add_friend(body: CodeIn):
    return _save_friend(decode(body.code), body.name)


@router.post("/api/friends/file")
async def add_friend_file(file: UploadFile = File(...)):
    data = await file.read(MAX_CODE + 1)
    if len(data) > MAX_CODE:
        raise HTTPException(413, "Plik za duży")
    return _save_friend(decode(data.decode("utf-8", "replace")), None)


def _mine(con) -> list:
    return [dict(r) for r in con.execute("SELECT id, title, platform, kind, igdb_id, wish, cover FROM items WHERE sold_on IS NULL")]


def _key(ig, title):
    return ("i", ig) if ig else ("n", norm(title))


@router.get("/api/friends")
def list_friends():
    with M().db() as con:
        mine = _mine(con)
        my_keys = {_key(i["igdb_id"], i["title"]) for i in mine if i["kind"] == "game" and not i["wish"]}
        my_names = {norm(i["title"]) for i in mine if i["kind"] == "game" and not i["wish"]}
        out = []
        for r in con.execute("SELECT * FROM friends ORDER BY name COLLATE NOCASE"):
            p = json.loads(r["data"])
            games = [e for e in p["items"] if e["k"] == "g" and not e.get("w")]
            common = sum(1 for e in games if _key(e.get("ig"), e["t"]) in my_keys or norm(e["t"]) in my_names)
            out.append({"id": r["id"], "name": r["name"], "shared_at": r["shared_at"], "imported_at": r["imported_at"],
                        "games": len(games), "consoles": sum(1 for e in p["items"] if e["k"] == "c" and not e.get("w")),
                        "wishes": sum(1 for e in p["items"] if e.get("w")), "common": common})
        return out


@router.get("/api/friends/{fid}")
def get_friend(fid: int):
    m = M()
    with m.db() as con:
        r = con.execute("SELECT * FROM friends WHERE id=?", (fid,)).fetchone()
        if not r:
            raise HTTPException(404, "Nie ma takiego znajomego")
        p = json.loads(r["data"])
        mine = _mine(con)
    own_games = [i for i in mine if i["kind"] == "game" and not i["wish"]]
    my_wish = [i for i in mine if i["wish"]]
    by_key = {}
    for i in own_games:
        by_key.setdefault(_key(i["igdb_id"], i["title"]), []).append(i)
        by_key.setdefault(("n", norm(i["title"])), []).append(i)
    wish_keys = {_key(i["igdb_id"], i["title"]) for i in my_wish} | {("n", norm(i["title"])) for i in my_wish}
    items, seen_mine = [], set()
    for e in p["items"]:
        mk = by_key.get(_key(e.get("ig"), e["t"])) or by_key.get(("n", norm(e["t"]))) or []
        if e["k"] == "g":
            for i in mk:
                seen_mine.add(i["id"])
        items.append({**e, "cover": m.img_token(m.igdb_img(e["ci"])) if e.get("ci") else None,
                      "mine": [{"id": i["id"], "platform": i["platform"]} for i in mk] if e["k"] == "g" else [],
                      "my_wish": _key(e.get("ig"), e["t"]) in wish_keys or ("n", norm(e["t"])) in wish_keys})
    only_me = [{"id": i["id"], "t": i["title"], "p": i["platform"],
                "cover_file": i["cover"]} for i in own_games if i["id"] not in seen_mine]
    return {"id": r["id"], "name": r["name"], "shared_at": r["shared_at"], "imported_at": r["imported_at"],
            "items": items, "only_me": only_me}


@router.delete("/api/friends/{fid}", status_code=204)
def delete_friend(fid: int):
    with M().db() as con:
        con.execute("DELETE FROM friends WHERE id=?", (fid,))
