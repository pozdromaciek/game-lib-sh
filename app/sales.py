# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Sprzedaż: „Na sprzedaż” (cena wywoławcza), gotowe ogłoszenie, zdjęcia do ogłoszenia (ZIP), „Sprzedana” → archiwum
z zyskiem/stratą. Sprzedane pozycje nie liczą się do kolekcji, wartości, kolekcji serii ani trofeów.
"""
import io
import zipfile
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter()

COND = {"A": "jak nowa", "B": "lekkie ślady użytkowania", "C": "wyraźne ślady użytkowania"}
BOX = {"A": "jak nowe", "B": "lekkie ślady", "C": "zniszczone"}


def M():
    from . import main
    return main


class SaleIn(BaseModel):
    on: bool = True
    asking_price: Optional[float] = Field(default=None, ge=0, lt=10_000_000)


class SoldIn(BaseModel):
    price: float = Field(ge=0, lt=10_000_000)
    sold_on: Optional[str] = None
    sold_to: Optional[str] = Field(default=None, max_length=80)


def _owned(con, item_id: int) -> dict:
    it = M()._get(con, item_id)
    if it["wish"]:
        raise HTTPException(400, "To jest pozycja z listy życzeń")
    return it


@router.post("/api/items/{item_id}/sale")
def set_sale(item_id: int, body: SaleIn):
    m = M()
    with m.db() as con:
        it = _owned(con, item_id)
        if it["sold_on"]:
            raise HTTPException(400, "Ta pozycja jest już sprzedana")
        con.execute("UPDATE items SET for_sale=?, asking_price=?, updated_at=datetime('now') WHERE id=?",
                    (1 if body.on else 0, body.asking_price if body.on else it["asking_price"], item_id))
        if body.on and not it["for_sale"]:
            m.log_event(con, "for_sale", item_id)
        return m._get(con, item_id)


@router.post("/api/items/{item_id}/sold")
def set_sold(item_id: int, body: SoldIn):
    m = M()
    with m.db() as con:
        it = _owned(con, item_id)
        if it.get("loan"):
            raise HTTPException(409, "Najpierw oznacz pozycję jako oddaną")
        when = m._date(body.sold_on) or date.today().isoformat()
        con.execute("UPDATE items SET sold_on=?, sold_price=?, sold_to=?, for_sale=0, shame_since=NULL, "
                    "updated_at=datetime('now') WHERE id=?", (when, body.price, (body.sold_to or "").strip() or None, item_id))
        m.log_event(con, "sold", item_id)
        if it["price_paid"] is not None and body.price > it["price_paid"]:
            m.log_event(con, "sold_profit", item_id)
        m.snapshot_value(con)
        return m._get(con, item_id)


@router.post("/api/items/{item_id}/unsold")
def undo_sold(item_id: int):
    m = M()
    with m.db() as con:
        it = m._get(con, item_id)
        if not it["sold_on"]:
            raise HTTPException(400, "Ta pozycja nie jest sprzedana")
        con.execute("UPDATE items SET sold_on=NULL, sold_price=NULL, sold_to=NULL, updated_at=datetime('now') WHERE id=?", (item_id,))
        m.snapshot_value(con)
        return m._get(con, item_id)


def ad_text(it: dict, n_photos: int) -> dict:
    game = it["kind"] == "game"
    title = " ".join(p for p in [it["title"], it["platform"] and f"({it['platform']})", it.get("region") if it.get("region") in ("PAL", "NTSC-U", "NTSC-J") else None,
                                 "CIB" if it["has_box"] and it["has_manual"] and (it["has_disc"] or not game) else None] if p)
    lines = [f"{it['title']} — {it['platform'] or ''}".strip(" —")]
    if it.get("edition"):
        lines.append(f"Wydanie: {it['edition']}")
    if it.get("region"):
        lines.append(f"Region: {it['region']}" + (" (wersja europejska)" if it["region"] == "PAL" else ""))
    if game and it.get("cover_lang"):
        lines.append(f"Język okładki: {it['cover_lang']}")
    if it.get("serial"):
        lines.append(f"Numer seryjny: {it['serial']}")
    lines.append("")
    lines.append("W zestawie:")
    if game:
        lines.append(f"• płyta / kartridż — {'tak' if it['has_disc'] else 'brak'}")
    else:
        lines.append(f"• konsola / urządzenie{'' if it['working'] else ' (NIESPRAWNE — na części)'}")
    lines.append(f"• pudełko — {'tak' if it['has_box'] else 'brak'}")
    lines.append(f"• instrukcja — {'tak' if it['has_manual'] else 'brak'}")
    if it.get("special"):
        lines.append("• dodatki: " + ", ".join(it["special"]))
    lines.append("")
    if it.get("condition"):
        lines.append(f"Stan {'płyty' if game else 'wizualny'}: {COND.get(it['condition'], it['condition'])}")
    if it["has_box"] and it.get("box_condition"):
        lines.append(f"Stan pudełka: {BOX.get(it['box_condition'], it['box_condition'])}")
    if not game and it["working"]:
        lines.append("Sprawna, przetestowana.")
    if n_photos:
        lines.append(f"Zdjęcia przedstawiają sprzedawany egzemplarz ({n_photos}).")
    lines.append("")
    lines.append("Wysyłka lub odbiór osobisty. Zapraszam do pytań!")
    body = "\n".join(lines).strip()
    while "\n\n\n" in body:
        body = body.replace("\n\n\n", "\n\n")
    return {"title": title[:70], "body": body}


@router.get("/api/items/{item_id}/ad")
def get_ad(item_id: int):
    m = M()
    with m.db() as con:
        it = _owned(con, item_id)
        n = con.execute("SELECT COUNT(*) FROM item_photos WHERE item_id=?", (item_id,)).fetchone()[0]
    return {**ad_text(it, n), "asking_price": it["asking_price"], "photos": n}


@router.get("/api/items/{item_id}/photos.zip")
def photos_zip(item_id: int):
    m = M()
    from .photos import pdir
    with m.db() as con:
        it = m._get(con, item_id)
        rows = [dict(r) for r in con.execute("SELECT file FROM item_photos WHERE item_id=? ORDER BY id", (item_id,))]
    if not rows:
        raise HTTPException(404, "Ta pozycja nie ma zdjęć egzemplarza")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for i, r in enumerate(rows, 1):
            p = pdir() / f"{r['file']}.jpg"
            if p.exists():
                z.write(p, f"{i:02d}.jpg")
    slug = "".join(ch if ch.isalnum() else "-" for ch in it["title"].lower()).strip("-")[:40] or "zdjecia"
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{slug}-zdjecia.zip"'})
