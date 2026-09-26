# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Informacje o serwerze dla okna „Narzędzia”: zajętość dysku i rozmiary danych aplikacji."""
import os
import shutil
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
_cache: dict = {}


def M():
    from . import main
    return main


def dir_size(path) -> tuple:
    total, files = 0, 0
    stack = [str(path)]
    while stack:
        d = stack.pop()
        try:
            with os.scandir(d) as it:
                for e in it:
                    try:
                        if e.is_dir(follow_symlinks=False):
                            stack.append(e.path)
                        elif e.is_file(follow_symlinks=False):
                            total += e.stat(follow_symlinks=False).st_size
                            files += 1
                    except OSError:
                        pass
        except OSError:
            pass
    return total, files


@router.get("/api/system")
def system_info():
    m = M()
    now = time.time()
    if _cache.get("at", 0) > now - 30:
        return _cache["data"]
    data = m.DATA
    du = shutil.disk_usage(data)
    parts = []
    known = set()
    for key, label in (("covers", "Okładki"), ("photos", "Zdjęcia egzemplarzy"), ("backups", "Backupy"),
                       ("libretro", "Bazy numerów seryjnych"), ("launchbox", "Baza okładek LaunchBox")):
        size, files = dir_size(data / key)
        parts.append({"key": key, "label": label, "bytes": size, "files": files})
        known.add(key)
    db_size = sum((data / n).stat().st_size for n in ("kolekcja.db", "kolekcja.db-wal", "kolekcja.db-shm") if (data / n).exists())
    parts.insert(0, {"key": "db", "label": "Baza danych", "bytes": db_size, "files": 1})
    other = 0
    try:
        with os.scandir(data) as it:
            for e in it:
                if e.name in known or e.name.startswith("kolekcja.db"):
                    continue
                if e.is_dir(follow_symlinks=False):
                    other += dir_size(e.path)[0]
                elif e.is_file(follow_symlinks=False):
                    other += e.stat().st_size
    except OSError:
        pass
    parts.append({"key": "other", "label": "Inne", "bytes": other, "files": None})
    with m.db() as con:
        items = con.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    out = {"disk": {"total": du.total, "used": du.used, "free": du.free},
           "app_bytes": sum(p["bytes"] for p in parts), "parts": parts, "items": items,
           "version": m.APP_VERSION}
    _cache.update(at=now, data=out)
    return out


# zdarzenia z przeglądarki (dla trofeów) — tylko z tej listy
CLIENT_EVENTS = {"about", "konami", "combo"}


class EventIn(BaseModel):
    type: str


@router.post("/api/events", status_code=204)
def client_event(body: EventIn):
    if body.type not in CLIENT_EVENTS:
        raise HTTPException(422, "Nieznane zdarzenie")
    m = M()
    with m.db() as con:
        m.log_event(con, body.type)
