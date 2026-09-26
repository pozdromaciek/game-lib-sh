# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Sugerowana cena: oferty z eBay (Browse API, darmowe klucze) + kurs NBP + szybkie linki.

Oferty to ceny wystawienia, nie sprzedaży — sugestia = mediana ofert × SOLD_FACTOR,
z korektą za kompletność. Bez kluczy eBay zwracamy same linki do ręcznego sprawdzenia.
"""
import base64
import logging
import os
import re
import statistics
import time
import unicodedata
from typing import Optional
from urllib.parse import quote, quote_plus

import httpx

from . import config

log = logging.getLogger("kolekcja.ceny")

MARKETS = [m.strip() for m in os.getenv("EBAY_MARKETS", "EBAY_DE,EBAY_GB,EBAY_PL").split(",") if m.strip()]
SOLD_FACTOR = 0.75
CACHE_TTL = 24 * 3600

# kategorie eBay: gry, konsole, akcesoria
CATEGORY = {"game": "139973", "console": "139971", "accessory": "54968"}

# krótka nazwa do zapytania + aliasy do rozpoznania platformy w tytule oferty
PLAT = {
    "PlayStation": ("PS1", ["ps1", "psx", "psone", "ps one", "playstation 1", "ps 1"]),
    "PlayStation 2": ("PS2", ["ps2", "ps 2", "playstation 2"]),
    "PlayStation 3": ("PS3", ["ps3", "ps 3", "playstation 3"]),
    "PlayStation 4": ("PS4", ["ps4", "ps 4", "playstation 4"]),
    "PlayStation 5": ("PS5", ["ps5", "ps 5", "playstation 5"]),
    "PSP": ("PSP", ["psp", "playstation portable"]),
    "PS Vita": ("PS Vita", ["vita", "ps vita", "psvita"]),
    "Xbox": ("Xbox", ["xbox classic", "original xbox", "xbox 1st"]),
    "Xbox 360": ("Xbox 360", ["xbox 360", "x360", "xbox360"]),
    "Xbox One": ("Xbox One", ["xbox one", "xone"]),
    "Xbox Series X|S": ("Xbox Series X", ["xbox series", "series x", "series s"]),
    "NES": ("NES", ["nes", "nintendo entertainment system"]),
    "SNES": ("SNES", ["snes", "super nintendo"]),
    "Nintendo 64": ("N64", ["n64", "nintendo 64"]),
    "GameCube": ("GameCube", ["gamecube", "game cube", "ngc", "gc"]),
    "Wii": ("Wii", ["wii"]),
    "Wii U": ("Wii U", ["wii u", "wiiu"]),
    "Nintendo Switch": ("Switch", ["switch"]),
    "Game Boy": ("Game Boy", ["game boy", "gameboy", "gb"]),
    "Game Boy Color": ("Game Boy Color", ["game boy color", "gameboy color", "gbc"]),
    "Game Boy Advance": ("GBA", ["gba", "game boy advance", "gameboy advance"]),
    "Nintendo DS": ("Nintendo DS", ["nintendo ds", "nds", "ds"]),
    "Nintendo 3DS": ("3DS", ["3ds", "nintendo 3ds"]),
    "Sega Mega Drive": ("Mega Drive", ["mega drive", "megadrive", "genesis"]),
    "Sega Dreamcast": ("Dreamcast", ["dreamcast"]),
    "PC": ("PC", ["pc", "windows"]),
}

BUDGET = ["platinum", "essentials", "greatest hits", "players choice", "player s choice",
          "nintendo selects", "classics", "best of", "budget"]
STOP = {"the", "of", "a", "an", "and", "der", "die", "das", "und", "edition", "i"}
JUNK_ANY = ["defekt", "defect", "broken", "for parts", "spares", "ersatzteil", "faulty", "kaputt",
            "konvolut", "sammlung", "job lot", "joblot", "repro", "reproduction", "empty box",
            "leerkarton", "box only", "ovp only", "nur ovp", "only box", "uszkodz", "na czesci"]
JUNK = {
    "game": ["hulle", "leerhulle", "case only", "only case", "cover only", "nur cover", "manual only",
             "nur anleitung", "anleitung only", "booklet only", "no disc", "keine disc", "ohne spiel",
             "no game", "guide", "losungsbuch", "losungsheft", "strategy", "soundtrack", "poster",
             "bundle", "konsole", "console", "spiele paket", "games lot", "pudelko", "okladka"],
    "console": ["bundle", "mit spielen", "with games", "spiele", "shell", "gehause", "lufter", "laufwerk",
                "netzteil", "fernbedienung", "controller only", "nur controller", "mainboard", "motherboard",
                "housing", "power supply", "cable only", "hdmi port"],
    "accessory": ["bundle", "konsole", "console", "2x", "3x", "4x", "x2", "x3", "set of", "spiele"],
}

_cache: dict = {}
_token = {"value": None, "exp": 0.0}
_rates = {"at": 0.0, "rates": {"PLN": 1.0}, "date": None}


def configured() -> bool:
    return config.service_on("ebay")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower().replace("ł", "l"))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _has(text: str, phrase: str) -> bool:
    return f" {phrase} " in f" {text} "


def short_platform(platform: str) -> str:
    return PLAT.get(platform or "", (platform or "", []))[0]


def build_query(title: str, platform: str, kind: str, region: str = "", model: str = "") -> str:
    parts = [title.strip()]
    if kind == "game":
        sp = short_platform(platform)
        if sp and norm(sp) not in norm(title):
            parts.append(sp)
        if region == "NTSC-U":
            parts.append("NTSC")
        elif region == "NTSC-J":
            parts.append("NTSC-J")
    else:
        if model and norm(model) not in norm(title) and not re.search(r"\d{3,}", model):
            parts.append(model.strip())  # „Slim”, „Pro” pomagają; numery SCPH raczej zawężają za mocno
        if kind == "accessory" and platform:
            sp = short_platform(platform)
            if sp and norm(sp) not in norm(title):
                parts.append(sp)
    return " ".join(p for p in parts if p)


def quick_links(query: str, kind: str, region: str = "PAL") -> list:
    q = quote_plus(query)
    olx = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", norm(query))).strip("-")
    pc_q = quote_plus(query + (" PAL" if kind == "game" and region in ("", "PAL", None) else ""))
    return [
        {"key": "allegro", "name": "Allegro", "url": f"https://allegro.pl/listing?string={q}"},
        {"key": "olx", "name": "OLX", "url": f"https://www.olx.pl/oferty/q-{quote(olx)}/"},
        {"key": "ebay", "name": "eBay.com — sprzedane", "url": f"https://www.ebay.com/sch/i.html?_nkw={q}&LH_Sold=1&LH_Complete=1"},
        {"key": "ebay_de", "name": "eBay.de — sprzedane", "url": f"https://www.ebay.de/sch/i.html?_nkw={q}&LH_Sold=1&LH_Complete=1"},
        {"key": "ebay_uk", "name": "eBay.co.uk — sprzedane", "url": f"https://www.ebay.co.uk/sch/i.html?_nkw={q}&LH_Sold=1&LH_Complete=1"},
        {"key": "vinted", "name": "Vinted", "url": f"https://www.vinted.pl/catalog?search_text={q}"},
        {"key": "pricecharting", "name": "PriceCharting", "url": f"https://www.pricecharting.com/search-products?q={pc_q}&type=prices"},
    ]


# --- filtr ofert -------------------------------------------------------------
def _title_tokens(title: str, platform: str) -> list:
    t = norm(title)
    for a in PLAT.get(platform or "", ("", []))[1]:
        t = f" {t} ".replace(f" {a} ", " ").strip()
    return [w for w in t.split() if w not in STOP and (len(w) > 1 or w.isdigit() or w in ("v", "x"))]


def _numbers(tokens) -> set:
    roman = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10"}
    out = set()
    for w in tokens:
        if w.isdigit():
            out.add(str(int(w)))
        elif w in roman:
            out.add(roman[w])
    return out


def _strip_platforms(text: str) -> str:
    t = f" {text} "
    for _, (_, aliases) in PLAT.items():
        for a in sorted(aliases, key=len, reverse=True):
            t = t.replace(f" {a} ", " ")
    return re.sub(r" +", " ", t).strip()


def accept(offer_title: str, title: str, platform: str, kind: str, region: str, edition: str) -> Optional[str]:
    """None = oferta pasuje, inaczej powód odrzucenia."""
    t = norm(offer_title)
    own = norm(title)
    for j in JUNK_ANY + JUNK.get(kind, []):
        if _has(t, j) and not _has(own, j):
            return f"słowo „{j}”"
    want = _title_tokens(title, platform)
    if want:
        hit = sum(1 for w in want if _has(t, w) or (len(w) > 4 and w in t))
        if hit / len(want) < 0.75:
            return "inny tytuł"
    # numery części (GT3 ≠ GT4); gra bez numeru nie łapie kontynuacji
    have_nums = _numbers(_strip_platforms(t).split())
    want_nums = _numbers(want)
    if not want_nums <= have_nums:
        return "brak numeru części"
    if kind == "game" and have_nums - want_nums - {"1"}:
        extra = have_nums - want_nums
        if any(n in {"2", "3", "4", "5", "6", "7", "8", "9", "10"} for n in extra):
            return "inna część"
    # platforma: odrzuć, gdy tytuł wskazuje inną konsolę, a naszej nie
    ours = PLAT.get(platform or "", ("", []))[1]
    if ours and not any(_has(t, a) for a in ours):
        for name, (_, aliases) in PLAT.items():
            if name != platform and any(_has(t, a) for a in aliases if len(a) > 2):
                return "inna platforma"
    if kind == "game":
        budget_ed = any(b in norm(edition) for b in BUDGET)
        budget_off = any(_has(t, b) for b in BUDGET)
        if budget_off != budget_ed:
            return "inne wydanie (Platinum/Essentials)"
        if region in ("", "PAL", None) and any(_has(t, w) for w in ["ntsc", "ntsc u", "ntsc j", "usa", "us version", "jap", "japan", "japanese", "import"]):
            return "inny region"
    return None


# --- kursy NBP ------------------------------------------------------------------
async def rates(c: httpx.AsyncClient) -> dict:
    if time.time() - _rates["at"] < 12 * 3600 and len(_rates["rates"]) > 1:
        return _rates["rates"]
    try:
        r = await c.get("https://api.nbp.pl/api/exchangerates/tables/A/?format=json")
        r.raise_for_status()
        tab = r.json()[0]
        _rates["rates"] = {"PLN": 1.0, **{x["code"]: float(x["mid"]) for x in tab["rates"]}}
        _rates["date"] = tab.get("effectiveDate")
        _rates["at"] = time.time()
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as e:
        log.warning("NBP: %s", e)
    return _rates["rates"]


# --- eBay -------------------------------------------------------------------------
async def ebay_token(c: httpx.AsyncClient) -> str:
    if _token["value"] and time.time() < _token["exp"] - 120:
        return _token["value"]
    basic = base64.b64encode(f"{config.get('EBAY_CLIENT_ID')}:{config.get('EBAY_CLIENT_SECRET')}".encode()).decode()
    r = await c.post("https://api.ebay.com/identity/v1/oauth2/token",
                     headers={"Authorization": f"Basic {basic}",
                              "Content-Type": "application/x-www-form-urlencoded"},
                     content="grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope")
    if r.status_code != 200:
        raise RuntimeError(f"eBay OAuth {r.status_code}: {r.text[:160]}")
    j = r.json()
    _token.update(value=j["access_token"], exp=time.time() + int(j.get("expires_in", 7200)))
    return _token["value"]


async def ebay_search(c: httpx.AsyncClient, market: str, query: str, kind: str) -> list:
    tok = await ebay_token(c)
    params = {"q": query, "limit": "100",
              "filter": "buyingOptions:{FIXED_PRICE},conditions:{USED|UNSPECIFIED}"}
    headers = {"Authorization": f"Bearer {tok}", "X-EBAY-C-MARKETPLACE-ID": market,
               "Accept-Language": "en-GB"}
    url = "https://api.ebay.com/buy/browse/v1/item_summary/search"
    items = []
    for cat in (CATEGORY.get(kind), None):
        p = dict(params, **({"category_ids": cat} if cat else {}))
        r = await c.get(url, params=p, headers=headers)
        if r.status_code == 401:
            _token["value"] = None
        if r.status_code != 200:
            log.info("eBay %s %s: %s", market, r.status_code, r.text[:160])
            continue
        items = r.json().get("itemSummaries") or []
        if items:
            break
    out = []
    for it in items:
        pr = it.get("price") or {}
        try:
            val = float(pr.get("value"))
        except (TypeError, ValueError):
            continue
        out.append({"title": it.get("title", ""), "value": val, "currency": pr.get("currency", ""),
                    "url": it.get("itemWebUrl", ""), "market": market.replace("EBAY_", "eBay "),
                    "condition": it.get("condition", "")})
    return out


def _round(v: float) -> float:
    if v >= 100:
        return float(round(v / 5) * 5)
    return float(round(v))


def completeness(kind: str, has_box: bool, has_manual: bool, has_disc: bool) -> tuple:
    """Korekta względem typowej oferty (kompletny egzemplarz)."""
    if kind == "game":
        if not has_disc:
            return 0.3, "bez płyty/kartridża"
        if not has_box:
            return 0.55, "bez pudełka"
        if not has_manual:
            return 0.85, "bez instrukcji"
    elif kind == "console":
        if not has_box:
            return 0.85, "bez pudełka"
    return 1.0, ""


async def suggest(c: httpx.AsyncClient, *, title: str, platform: str = "", kind: str = "game",
                  region: str = "PAL", edition: str = "", model: str = "",
                  has_box: bool = True, has_manual: bool = True, has_disc: bool = True, currency: str = "PLN") -> dict:
    kind = kind if kind in CATEGORY else "game"
    query = build_query(title, platform, kind, region, model)
    res = {"query": query, "links": quick_links(query, kind, region), "configured": configured(),
           "offers": [], "count": 0, "suggested": None}
    if not configured():
        res["note"] = "Automatyczna wycena wymaga darmowych kluczy eBay (Menu → Narzędzia → Klucze API)."
        return res

    key = (query, kind, platform, region, norm(edition))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        raw, rejected = hit[1]
    else:
        raw, rejected, errors = [], 0, []
        seen = set()
        for m in MARKETS:
            try:
                found = await ebay_search(c, m, query, kind)
            except (httpx.HTTPError, RuntimeError) as e:
                errors.append(f"{m}: {e}")
                continue
            for o in found:
                if o["url"] in seen:
                    continue
                seen.add(o["url"])
                why = accept(o["title"], title, platform, kind, region, edition)
                if why:
                    rejected += 1
                else:
                    raw.append(o)
        if errors and not raw:
            res["note"] = "eBay nie odpowiedział: " + "; ".join(errors)[:300]
            return res
        _cache[key] = (time.time(), (raw, rejected))

    rt = await rates(c)
    div = rt.get(currency, 1.0) if currency != "PLN" else 1.0   # kwoty w walucie kolekcji
    res["currency"] = currency
    offers = []
    for o in raw:
        rate = rt.get(o["currency"])
        if not rate:
            continue
        offers.append(dict(o, pln=round(o["value"] * rate / div, 2)))
    res["rejected"] = rejected
    res["rates_date"] = _rates["date"]
    if not offers:
        res["note"] = "Brak pasujących ofert — sprawdź ręcznie w linkach poniżej."
        return res

    prices = sorted(o["pln"] for o in offers)
    med = statistics.median(prices)
    kept = [o for o in offers if med / 3 <= o["pln"] <= med * 3]  # odrzuć skrajności
    prices = sorted(o["pln"] for o in kept)
    med = statistics.median(prices)
    q1, q3 = (statistics.quantiles(prices, n=4)[0], statistics.quantiles(prices, n=4)[2]) if len(prices) >= 4 else (prices[0], prices[-1])
    factor, why = completeness(kind, has_box, has_manual, has_disc)
    suggested = _round(med * SOLD_FACTOR * factor)
    kept.sort(key=lambda o: abs(o["pln"] - med))
    res.update(count=len(kept), median=round(med, 2), low=round(q1, 2), high=round(q3, 2),
               suggested=suggested, factor=SOLD_FACTOR, completeness=factor, completeness_note=why,
               offers=[{k: o[k] for k in ("title", "pln", "value", "currency", "url", "market")}
                       for o in kept[:12]])
    if len(kept) < 3:
        res["note"] = "Mało ofert — traktuj wynik orientacyjnie."
    return res
