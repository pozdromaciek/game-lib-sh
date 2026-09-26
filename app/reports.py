# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""„Twój rok w grach” (podsumowanie roku) i raport PDF do ubezpieczenia."""
import asyncio
import io
import json
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

SYMBOL = {"PLN": "zł", "EUR": "€"}
MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień",
          "październik", "listopad", "grudzień"]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]


def M():
    from . import main
    return main


def money(v, cur: str = "PLN") -> str:
    if v is None:
        return "—"
    s = f"{round(v):,}".replace(",", " ")
    sym = SYMBOL.get(cur, cur)
    return f"{s} {sym}"


# --- rok w grach ---------------------------------------------------------------------
@router.get("/api/wrapped")
def wrapped(year: Optional[int] = None):
    m = M()
    y = year or date.today().year
    ys = str(y)
    with m.db() as con:
        items = [dict(r) for r in con.execute("SELECT * FROM items WHERE wish = 0")]
        ev = [dict(r) for r in con.execute("SELECT * FROM events WHERE substr(at,1,4)=?", (ys,))]
        tro = con.execute("SELECT COUNT(*) FROM trophies WHERE substr(unlocked_at,1,4)=?", (ys,)).fetchone()[0]
        vh = [dict(r) for r in con.execute("SELECT * FROM value_history WHERE substr(day,1,4)=? ORDER BY day", (ys,))]
        loans = con.execute("SELECT COUNT(*) FROM loans WHERE substr(lent_on,1,4)=?", (ys,)).fetchone()[0]
        years = sorted({int(r[0]) for r in con.execute(
            "SELECT DISTINCT substr(COALESCE(purchased_on, created_at),1,4) FROM items WHERE wish=0") if r[0] and r[0].isdigit()})
        m.log_event(con, "wrapped")
    bought = [i for i in items if (i["purchased_on"] or i["created_at"] or "")[:4] == ys]
    games = [i for i in bought if i["kind"] == "game"]
    spent = sum(i["price_paid"] or 0 for i in bought)
    priciest = max((i for i in bought if i["price_paid"]), key=lambda i: i["price_paid"], default=None)
    months = Counter((i["purchased_on"] or i["created_at"])[5:7] for i in bought)
    best_month = months.most_common(1)[0] if months else None
    plats = Counter(i["platform"] for i in games if i["platform"])
    evc = Counter(e["type"] for e in ev)
    completed_ids = {e["item_id"] for e in ev if e["type"] == "completed"}
    completed = [i for i in items if i["id"] in completed_ids]
    sold = [i for i in items if (i["sold_on"] or "")[:4] == ys]
    profit = sum((i["sold_price"] or 0) - (i["price_paid"] or 0) for i in sold if i["price_paid"] is not None)
    first = min(bought, key=lambda i: (i["purchased_on"] or i["created_at"]), default=None)
    rated = sorted((i for i in completed if i["rating"]), key=lambda i: -i["rating"])
    return {
        "year": y, "years": sorted(set(years) | {date.today().year}),
        "bought": len(bought), "games": len(games), "consoles": sum(1 for i in bought if i["kind"] == "console"),
        "accessories": sum(1 for i in bought if i["kind"] == "accessory"), "spent": spent,
        "priciest": {"title": priciest["title"], "platform": priciest["platform"], "price": priciest["price_paid"]} if priciest else None,
        "best_month": {"month": int(best_month[0]), "count": best_month[1]} if best_month else None,
        "top_platform": {"name": plats.most_common(1)[0][0], "count": plats.most_common(1)[0][1]} if plats else None,
        "first": {"title": first["title"], "date": (first["purchased_on"] or first["created_at"])[:10]} if first else None,
        "completed": len(completed), "best_rated": {"title": rated[0]["title"], "rating": rated[0]["rating"]} if rated else None,
        "shame_add": evc.get("shame_add", 0), "shame_done": evc.get("shame_done", 0),
        "loans": loans, "wish_bought": evc.get("bought", 0), "trophies": tro,
        "sold": len(sold), "profit": profit, "sold_sum": sum(i["sold_price"] or 0 for i in sold),
        "profit_known": sum(1 for i in sold if i["price_paid"] is not None),
        "value_start": vh[0]["value"] if vh else None, "value_end": vh[-1]["value"] if vh else None,
        "photos": evc.get("photo", 0),
    }


# --- raport PDF ------------------------------------------------------------------------------
FONT_DIRS = [Path("/usr/share/fonts/truetype/dejavu"), Path(__file__).parent / "static" / "fonts"]
L = {
    "pl": {"title": "Spis kolekcji — dokumentacja do ubezpieczenia", "made": "Stan na", "summary": "Podsumowanie",
           "games": "Gry", "consoles": "Konsole", "accessories": "Akcesoria", "items": "pozycji", "value": "Wartość łącznie",
           "paid": "Wydane łącznie", "no": "Lp.", "cover": "Okładka", "item": "Pozycja", "comp": "Kompletność / stan",
           "serial": "Nr seryjny", "bought": "Zakup", "worth": "Wartość", "photos": "Zdjęcia egzemplarzy",
           "disc": "płyta", "box": "pudełko", "manual": "instrukcja", "cond": "stan", "valued": "wycena",
           "note": "Wartości szacunkowe na podstawie ofert rynkowych (wycena z podanego dnia). Zdjęcia przedstawiają posiadane egzemplarze.",
           "page": "Strona", "none": "—", "working": "sprawna", "broken": "niesprawna"},
    "en": {"title": "Collection inventory — insurance documentation", "made": "As of", "summary": "Summary",
           "games": "Games", "consoles": "Consoles", "accessories": "Accessories", "items": "items", "value": "Total value",
           "paid": "Total spent", "no": "No.", "cover": "Cover", "item": "Item", "comp": "Completeness / condition",
           "serial": "Serial no.", "bought": "Purchase", "worth": "Value", "photos": "Photos of owned copies",
           "disc": "disc", "box": "box", "manual": "manual", "cond": "condition", "valued": "valued",
           "note": "Estimated values based on market listings (valued on the given date). Photos show the owned copies.",
           "page": "Page", "none": "—", "working": "working", "broken": "not working"},
}


def _fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    if "DV" in pdfmetrics.getRegisteredFontNames():
        return "DV", "DVB"
    for d in FONT_DIRS:
        if (d / "DejaVuSans.ttf").exists():
            pdfmetrics.registerFont(TTFont("DV", str(d / "DejaVuSans.ttf")))
            pdfmetrics.registerFont(TTFont("DVB", str(d / ("DejaVuSans-Bold.ttf" if (d / "DejaVuSans-Bold.ttf").exists() else "DejaVuSans.ttf"))))
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily("DV", normal="DV", bold="DVB", italic="DV", boldItalic="DVB")
            return "DV", "DVB"
    return "Helvetica", "Helvetica-Bold"


def _thumb(path: Path, w: float, h: float):
    """Obraz do tabeli (JPEG w pamięci — obsłuży też WEBP)."""
    from PIL import Image as PImage
    from reportlab.platypus import Image
    try:
        im = PImage.open(path)
        im = im.convert("RGB")
        im.thumbnail((int(w * 4), int(h * 4)))
        b = io.BytesIO()
        im.save(b, "JPEG", quality=80)
        b.seek(0)
        iw, ih = im.size
        s = min(w / iw, h / ih)
        return Image(b, iw * s, ih * s)
    except Exception:  # noqa: BLE001
        return ""


def build_pdf(photos: bool, lang: str, cur: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    m = M()
    t = L.get(lang, L["pl"])
    fn, fb = _fonts()
    st = {k: ParagraphStyle(k, fontName=fn, fontSize=s, leading=s * 1.25) for k, s in (("n", 8), ("s", 7), ("h", 16), ("h2", 11))}
    st["h"].fontName = st["h2"].fontName = fb
    with m.db() as con:
        items = [dict(r) for r in con.execute("SELECT * FROM items WHERE wish=0 AND sold_on IS NULL "
                                              "ORDER BY CASE kind WHEN 'game' THEN 0 WHEN 'console' THEN 1 ELSE 2 END, platform, title")]
        ph = {}
        for r in con.execute("SELECT item_id, file, caption FROM item_photos ORDER BY id"):
            ph.setdefault(r["item_id"], []).append(dict(r))
        m.log_event(con, "report")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
                            title=t["title"], author="Moja kolekcja")
    story = [Paragraph(t["title"], st["h"]), Paragraph(f"{t['made']} {date.today().isoformat()}", st["n"]), Spacer(1, 5 * mm)]
    kinds = Counter(i["kind"] for i in items)
    total = sum(i["value"] or 0 for i in items)
    paid = sum(i["price_paid"] or 0 for i in items)
    summ = [[t["games"], str(kinds.get("game", 0))], [t["consoles"], str(kinds.get("console", 0))],
            [t["accessories"], str(kinds.get("accessory", 0))], [t["value"], money(total, cur)], [t["paid"], money(paid, cur)]]
    tb = Table(summ, colWidths=[50 * mm, 40 * mm])
    tb.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), fn, 9), ("FONT", (0, 3), (-1, 3), fb, 10),
                            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.grey), ("ALIGN", (1, 0), (1, -1), "RIGHT")]))
    story += [Paragraph(t["summary"], st["h2"]), tb, Spacer(1, 3 * mm), Paragraph(t["note"], st["s"]), Spacer(1, 5 * mm)]
    rows = [[t["no"], t["cover"], t["item"], t["comp"], t["serial"], t["bought"], t["worth"]]]
    for n, i in enumerate(items, 1):
        game = i["kind"] == "game"
        name = f"<b>{_esc(i['title'])}</b><br/>{_esc(i['platform'] or '')}{' · ' + _esc(i['region']) if i['region'] else ''}"
        if i["edition"]:
            name += f"<br/>{_esc(i['edition'])}"
        if i["model"]:
            name += f"<br/>{_esc(i['model'])}"
        comp = ", ".join(x for x, on in ((t["disc"], i["has_disc"] and game), (t["box"], i["has_box"]), (t["manual"], i["has_manual"])) if on)
        if not game:
            comp = (t["working"] if i["working"] else t["broken"]) + (", " + comp if comp else "")
        if i["condition"]:
            comp += f"<br/>{t['cond']}: {i['condition']}" + (f"/{i['box_condition']}" if i["box_condition"] else "")
        cover = _thumb(m.COVERS / i["cover"], 14 * mm, 18 * mm) if i["cover"] and (m.COVERS / i["cover"]).exists() else ""
        buy = " ".join(x for x in (i["purchased_on"] or "", money(i["price_paid"], cur) if i["price_paid"] is not None else "") if x) or t["none"]
        val = money(i["value"], cur) if i["value"] is not None else t["none"]
        if i["value_checked"]:
            val += f"<br/><font size=6>{t['valued']} {i['value_checked']}</font>"
        rows.append([str(n), cover, Paragraph(name, st["n"]), Paragraph(comp or t["none"], st["n"]),
                     Paragraph(_esc(i["serial"] or t["none"]), st["n"]), Paragraph(buy, st["n"]), Paragraph(val, st["n"])])
    tbl = Table(rows, colWidths=[8 * mm, 17 * mm, 58 * mm, 36 * mm, 24 * mm, 22 * mm, 21 * mm], repeatRows=1)
    tbl.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), fb, 8), ("FONT", (0, 1), (0, -1), fn, 8), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#5e5d63")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0eeea")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#aaa59c"))]))
    story.append(tbl)
    if photos and any(i["id"] in ph for i in items):
        story += [PageBreak(), Paragraph(t["photos"], st["h"]), Spacer(1, 4 * mm)]
        for i in items:
            if i["id"] not in ph:
                continue
            cells = []
            from .photos import pdir
            for p in ph[i["id"]][:9]:
                img = _thumb(pdir() / f"{p['file']}.jpg", 58 * mm, 44 * mm)
                cells.append([img, Paragraph(_esc(p["caption"] or ""), st["s"])])
            grid = [cells[k:k + 3] for k in range(0, len(cells), 3)]
            grid = [[Table([[c[0]], [c[1]]]) for c in row] + [""] * (3 - len(row)) for row in grid]
            g = Table(grid, colWidths=[62 * mm] * 3)
            g.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story.append(KeepTogether([Paragraph(f"<b>{_esc(i['title'])}</b> — {_esc(i['platform'] or '')}"
                                                 + (f" · {_esc(i['serial'])}" if i['serial'] else ""), st["h2"]), Spacer(1, 2 * mm), g, Spacer(1, 5 * mm)]))

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont(fn, 7)
        canvas.setFillColor(colors.grey)
        canvas.drawString(12 * mm, 8 * mm, f"Moja kolekcja · {date.today().isoformat()}")
        canvas.drawRightString(A4[0] - 12 * mm, 8 * mm, f"{t['page']} {d.page}")
        canvas.restoreState()
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


@router.get("/api/report.pdf")
async def report_pdf(photos: bool = True):
    m = M()
    s = m.get_settings()
    try:
        data = await asyncio.to_thread(build_pdf, photos, s.get("lang", "pl"), s.get("currency", "PLN"))
    except ImportError:
        raise HTTPException(500, "Brak biblioteki reportlab — przebuduj kontener")
    fn = f"kolekcja-raport-{date.today().isoformat()}.pdf"
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fn}"'})
