# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Odczyt numeru seryjnego ze zdjęcia grzbietu/tyłu pudełka (Tesseract OCR lokalnie, bez chmury)."""
import asyncio
import io
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, ImageFilter, ImageOps

router = APIRouter()
PS_PREFIX = {"SLES", "SCES", "SLUS", "SCUS", "SLPS", "SCPS", "SLPM", "SIPS", "SCED", "SLED", "SCAJ", "SLKA", "SCKA", "PAPX",
             "BLES", "BCES", "BLUS", "BCUS", "BLJM", "BCJS", "BLAS", "BCAS", "NPEB", "NPUB",
             "ULES", "UCES", "ULUS", "UCUS", "ULJM", "UCJS", "ULAS", "UCAS", "ULKS", "NPJH"}
TO_DIGIT = str.maketrans({"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "T": "1", "S": "5", "B": "8", "Z": "2", "G": "6"})
TO_ALPHA = str.maketrans({"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G"})
WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-."


def M():
    from . import main
    return main


def candidates(text: str) -> list:
    t = text.upper().replace("—", "-").replace("–", "-")
    out = []
    # PlayStation: SLES-02605, SLES 026.05, SCES_003.44
    for m in re.finditer(r"(?=([A-Z0-9]{4})[\s\-_.]{0,2}([0-9OIDQLSBZG]{3})[\s.\-]{0,2}([0-9OIDQLSBZG]{2}))", t):
        pre = m.group(1).translate(TO_ALPHA)
        if pre in PS_PREFIX:
            out.append(f"{pre}-{(m.group(2) + m.group(3)).translate(TO_DIGIT)}")
    # Nintendo: AGB-BPEP-EUR, DOL-GW7P-EUR, NTR-CQSP, RVL-…
    for m in re.finditer(r"(AGB|NTR|TWL|CTR|KTR|DOL|RVL|NUS)[\s\-]{0,2}([A-Z0-9]{4})", t):
        out.append(f"{m.group(1)}-{m.group(2)}")
    # Dreamcast: T-1234N, MK-51000
    for m in re.finditer(r"(?<![A-Z0-9])(T|MK|HDR)[\s\-](\d{4,5})([A-Z]?)(?![0-9])", t):
        out.append(f"{m.group(1)}-{m.group(2)}{m.group(3)}")
    seen, res = set(), []
    for c in out:
        if c not in seen:
            seen.add(c)
            res.append(c)
    return res


def _variants(data: bytes):
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("L")
    if max(im.size) > 2000:
        im.thumbnail((2000, 2000))
    if max(im.size) < 1200:
        f = 1200 / max(im.size)
        im = im.resize((int(im.width * f), int(im.height * f)), Image.LANCZOS)
    im = ImageOps.autocontrast(im).filter(ImageFilter.SHARPEN)
    for angle in (0, 90, 270, 180):
        yield im.rotate(angle, expand=True) if angle else im


def _tesseract(img: Image.Image, psm: int) -> str:
    with tempfile.NamedTemporaryFile(prefix="ocr_", suffix=".png") as f:
        img.save(f.name)
        r = subprocess.run(["tesseract", f.name, "stdout", "--psm", str(psm), "-c", f"tessedit_char_whitelist={WHITELIST}"],
                           capture_output=True, text=True, timeout=25)
        return r.stdout


def cleanup_tmp(max_age: int = 600) -> int:
    """Zdjęcia z OCR nie są nigdzie zapisywane — plik roboczy żyje tylko na czas odczytu. Na wszelki wypadek
    (np. restart w trakcie) sprzątamy osierocone pliki robocze Tesseracta starsze niż 10 minut."""
    import time
    n = 0
    now = time.time()
    for p in Path(tempfile.gettempdir()).glob("ocr_*.png"):
        try:
            if now - p.stat().st_mtime > max_age:
                p.unlink()
                n += 1
        except OSError:
            pass
    return n


def read_serials(data: bytes) -> tuple:
    if not shutil.which("tesseract"):
        raise HTTPException(503, "Brak programu Tesseract w kontenerze — przebuduj obraz")
    texts, found = [], []
    try:
        variants = list(_variants(data))
    except Exception:  # noqa: BLE001
        raise HTTPException(415, "To nie wygląda na zdjęcie")
    for img in variants:
        for psm in (11, 6):
            txt = _tesseract(img, psm)
            texts.append(txt)
            for c in candidates(txt):
                if c not in found:
                    found.append(c)
        if found:
            break
    return found, " ".join(" ".join(texts).split())[:300]


@router.post("/api/ocr-serial")
async def ocr_serial(file: UploadFile = File(...), platform: Optional[str] = Form(default=None)):
    m = M()
    data = await file.read(25 * 1024 * 1024 + 1)
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Maks. 25 MB")
    await asyncio.to_thread(cleanup_tmp)
    try:
        found, raw = await asyncio.to_thread(read_serials, data)
    finally:
        del data
    with m.db() as con:
        m.log_event(con, "ocr")
    for c in found:
        res = await m.serial_search(c, platform or None)
        if res:
            return {"serial": c, "candidates": found, "results": res, "text": raw}
    return {"serial": found[0] if found else None, "candidates": found, "results": [], "text": raw}
