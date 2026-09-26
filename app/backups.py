# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Automatyczny backup co noc + dzienny zapis wartości kolekcji.

Backup = jeden plik ZIP w /data/backups: spójna kopia bazy (SQLite backup API), okładki
i zdjęcia egzemplarzy. Trzymamy BACKUP_KEEP ostatnich (domyślnie 14). Opcjonalnie kopia
do BACKUP_COPY_DIR (np. katalog z Proxmoxa/NAS podmontowany do kontenera).
"""
import asyncio
import logging
import os
import re
import shutil
import sqlite3
import time
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

log = logging.getLogger("kolekcja.backup")
router = APIRouter()

KEEP = max(1, int(os.getenv("BACKUP_KEEP", "14") or 14))
HOUR = int(os.getenv("BACKUP_HOUR", "3") or 3)
COPY_DIR = os.getenv("BACKUP_COPY_DIR", "").strip()
NAME_RE = re.compile(r"^kolekcja-\d{8}-\d{6}\.zip$")
_state = {"running": False, "last_error": None}


def M():
    from . import main
    return main


def backup_dir() -> Path:
    d = M().DATA / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_backups() -> list:
    out = []
    for p in sorted(backup_dir().glob("kolekcja-*.zip"), reverse=True):
        st = p.stat()
        out.append({"name": p.name, "size": st.st_size,
                    "created": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")})
    return out


def make_backup() -> dict:
    """Synchronicznie (odpalać w wątku)."""
    m = M()
    name = f"kolekcja-{time.strftime('%Y%m%d-%H%M%S')}.zip"
    tmp_db = backup_dir() / f".{name}.db"
    target = backup_dir() / name
    part = backup_dir() / f".{name}.part"
    try:
        src = sqlite3.connect(m.DB_PATH)
        dst = sqlite3.connect(tmp_db)
        with dst:
            src.backup(dst)          # spójna kopia także przy działającej apce
        src.close()
        dst.close()
        with zipfile.ZipFile(part, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(tmp_db, "kolekcja.db")
            for sub in ("covers", "photos"):
                d = m.DATA / sub
                if d.is_dir():
                    for f in d.iterdir():
                        if f.is_file():
                            z.write(f, f"{sub}/{f.name}", compress_type=zipfile.ZIP_STORED)  # jpg/png już skompresowane
        part.replace(target)
    finally:
        tmp_db.unlink(missing_ok=True)
        part.unlink(missing_ok=True)
    # rotacja
    for old in sorted(backup_dir().glob("kolekcja-*.zip"), reverse=True)[KEEP:]:
        old.unlink(missing_ok=True)
    if COPY_DIR:
        try:
            cd = Path(COPY_DIR)
            cd.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, cd / name)
            for old in sorted(cd.glob("kolekcja-*.zip"), reverse=True)[KEEP:]:
                old.unlink(missing_ok=True)
        except OSError as e:
            log.warning("Kopia do %s nieudana: %s", COPY_DIR, e)
            _state["last_error"] = f"Kopia do {COPY_DIR}: {e}"
    log.info("Backup %s (%.1f MB)", name, target.stat().st_size / 1e6)
    return {"name": name, "size": target.stat().st_size}


async def run_backup() -> dict:
    if _state["running"]:
        raise HTTPException(409, "Backup już trwa")
    _state["running"] = True
    try:
        res = await asyncio.to_thread(make_backup)
        _state["last_error"] = None
        return res
    except Exception as e:  # noqa: BLE001
        _state["last_error"] = str(e)
        log.exception("Backup nieudany")
        raise HTTPException(500, f"Backup nieudany: {e}")
    finally:
        _state["running"] = False


async def scheduler():
    """Co 10 min: dzienny zapis wartości; o BACKUP_HOUR — backup (raz na dobę)."""
    m = M()
    while True:
        try:
            with m.db() as con:
                m.snapshot_value(con)
            now = datetime.now()
            today = now.strftime("%Y%m%d")
            done = any(b["name"].startswith(f"kolekcja-{today}") for b in list_backups())
            if now.hour >= HOUR and not done:
                await run_backup()
        except Exception:  # noqa: BLE001
            log.exception("Harmonogram")
        await asyncio.sleep(600)


@router.get("/api/backups")
def get_backups():
    return {"backups": list_backups(), "keep": KEEP, "hour": HOUR, "copy_dir": bool(COPY_DIR),
            "running": _state["running"], "last_error": _state["last_error"]}


@router.post("/api/backups")
async def post_backup():
    return await run_backup()


@router.get("/api/backups/{name}")
def download_backup(name: str):
    if not NAME_RE.match(name):
        raise HTTPException(404, "Nie ma takiego backupu")
    p = backup_dir() / name
    if not p.is_file():
        raise HTTPException(404, "Nie ma takiego backupu")
    return FileResponse(p, media_type="application/zip", filename=name)
