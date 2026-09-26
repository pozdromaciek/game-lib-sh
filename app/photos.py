# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Zdjęcia własnego egzemplarza (pudełko, płyta, wady) — kilka na pozycję.

Każde zdjęcie jest przeskalowane (maks. 1600 px) i zapisane od nowa jako JPEG — bez metadanych EXIF
(m.in. bez lokalizacji GPS z telefonu). Plus miniatura 400 px. Pliki w /data/photos.
"""
import asyncio
import io
import re
import time
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

router = APIRouter()
MAX_FILES = 12
MAX_BYTES = 20 * 1024 * 1024
NAME_RE = re.compile(r"^p\d+_\d+(_t)?\.jpg$")


def M():
    from . import main
    return main


def pdir():
    d = M().DATA / "photos"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _process(data: bytes, base: str) -> tuple:
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(415, "To nie wygląda na zdjęcie (JPG, PNG, WEBP, HEIC nieobsługiwany)")
    im.thumbnail((1600, 1600))
    im.save(pdir() / f"{base}.jpg", "JPEG", quality=85, optimize=True)   # bez exif=… → metadane usunięte
    w, h = im.size
    th = im.copy()
    th.thumbnail((400, 400))
    th.save(pdir() / f"{base}_t.jpg", "JPEG", quality=80)
    return w, h


def _row(r) -> dict:
    return {"id": r["id"], "item_id": r["item_id"], "url": f"/media/photos/{r['file']}.jpg",
            "thumb": f"/media/photos/{r['file']}_t.jpg", "w": r["w"], "h": r["h"], "caption": r["caption"],
            "created_at": r["created_at"]}


def list_for(con, item_id: int) -> list:
    return [_row(r) for r in con.execute("SELECT * FROM item_photos WHERE item_id=? ORDER BY id", (item_id,))]


def counts(con) -> dict:
    return {r[0]: r[1] for r in con.execute("SELECT item_id, COUNT(*) FROM item_photos GROUP BY item_id")}


@router.get("/api/items/{item_id}/photos")
def get_photos(item_id: int):
    with M().db() as con:
        return list_for(con, item_id)


@router.post("/api/items/{item_id}/photos")
async def add_photos(item_id: int, files: list[UploadFile] = File(...)):
    m = M()
    with m.db() as con:
        m._get(con, item_id)
        have = con.execute("SELECT COUNT(*) FROM item_photos WHERE item_id=?", (item_id,)).fetchone()[0]
    if have + len(files) > MAX_FILES:
        raise HTTPException(400, f"Maks. {MAX_FILES} zdjęć na pozycję")
    added = []
    for i, f in enumerate(files):
        data = await f.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "Maks. 20 MB na zdjęcie")
        base = f"p{item_id}_{int(time.time() * 1000)}{i}"
        w, h = await asyncio.to_thread(_process, data, base)
        added.append((base, w, h))
    with m.db() as con:
        for base, w, h in added:
            con.execute("INSERT INTO item_photos(item_id, file, w, h) VALUES (?,?,?,?)", (item_id, base, w, h))
        m.log_event(con, "photo", item_id)
        return list_for(con, item_id)


class CaptionIn(BaseModel):
    caption: Optional[str] = Field(default=None, max_length=200)


@router.put("/api/item-photos/{pid}")
def caption(pid: int, body: CaptionIn):
    with M().db() as con:
        r = con.execute("SELECT * FROM item_photos WHERE id=?", (pid,)).fetchone()
        if not r:
            raise HTTPException(404, "Nie ma takiego zdjęcia")
        con.execute("UPDATE item_photos SET caption=? WHERE id=?", ((body.caption or "").strip() or None, pid))
        return list_for(con, r["item_id"])


@router.delete("/api/item-photos/{pid}")
def delete_photo(pid: int):
    with M().db() as con:
        r = con.execute("SELECT * FROM item_photos WHERE id=?", (pid,)).fetchone()
        if not r:
            raise HTTPException(404, "Nie ma takiego zdjęcia")
        con.execute("DELETE FROM item_photos WHERE id=?", (pid,))
        for suf in ("", "_t"):
            (pdir() / f"{r['file']}{suf}.jpg").unlink(missing_ok=True)
        return list_for(con, r["item_id"])


def delete_files_of(item_id: int):
    for p in pdir().glob(f"p{item_id}_*.jpg"):
        p.unlink(missing_ok=True)


@router.get("/media/photos/{name}")
def serve(name: str):
    if not NAME_RE.match(name):
        raise HTTPException(404)
    p = pdir() / name
    if not p.is_file():
        raise HTTPException(404)
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=604800"})
