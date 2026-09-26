# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Okładki z ScreenScraper.fr (per system i region: box-2D, box-2D-side, box-3D).

Wymaga kluczy deweloperskich (SS_DEVID / SS_DEVPASSWORD, dostępne na forum ScreenScraper;
można je wpisać w Narzędzia → Klucze API)
oraz konta użytkownika (SS_USER / SS_PASSWORD). Adresy mediów zawierają te dane,
dlatego nigdy nie trafiają do przeglądarki — obrazki idą przez proxy aplikacji.
"""
import asyncio
import logging
import os
import re
import time
import unicodedata
from typing import Optional

import httpx

from . import config

log = logging.getLogger("kolekcja.screenscraper")

API = "https://api.screenscraper.fr/api2/"
SOFTNAME = os.getenv("SS_SOFTNAME", "MojaKolekcja")

# zapasowe ID systemów (gdy lista systemów z API jest niedostępna)
FALLBACK_IDS = {
    "Sega Mega Drive": 1, "NES": 3, "SNES": 4, "Game Boy": 9, "Game Boy Color": 10,
    "Game Boy Advance": 12, "GameCube": 13, "Nintendo 64": 14, "Nintendo DS": 15, "Wii": 16,
    "Nintendo 3DS": 17, "Wii U": 18, "Sega Dreamcast": 23, "Xbox": 32, "Xbox 360": 33,
    "Xbox One": 34, "PlayStation": 57, "PlayStation 2": 58, "PlayStation 3": 59,
    "PlayStation 4": 60, "PSP": 61, "PS Vita": 62, "Nintendo Switch": 225,
}
# jak nasze nazwy mogą wyglądać w nazwach systemów ScreenScrapera
ALIASES = {
    "PlayStation": ["playstation", "psx", "ps1"], "PlayStation 2": ["playstation 2", "ps2"],
    "PlayStation 3": ["playstation 3", "ps3"], "PlayStation 4": ["playstation 4", "ps4"],
    "PlayStation 5": ["playstation 5", "ps5"], "PSP": ["psp"], "PS Vita": ["vita"],
    "Xbox": ["xbox"], "Xbox 360": ["xbox 360"], "Xbox One": ["xbox one"],
    "Xbox Series X|S": ["xbox series"], "Nintendo Switch": ["switch"], "Wii": ["wii"],
    "Wii U": ["wii u"], "GameCube": ["gamecube"], "Nintendo 64": ["nintendo 64", "n64"],
    "SNES": ["super nintendo", "snes"], "NES": ["nes", "famicom"], "Game Boy": ["game boy"],
    "Game Boy Color": ["game boy color"], "Game Boy Advance": ["game boy advance"],
    "Nintendo DS": ["nintendo ds", "ds"], "Nintendo 3DS": ["3ds"],
    "Sega Mega Drive": ["mega drive", "megadrive", "genesis"], "Sega Dreamcast": ["dreamcast"],
}
# preferencja regionów okładki wg języka okładki
REGION_BY_LANG = {
    "PL": ["pl", "eu", "uk", "wor", "us"], "EN": ["uk", "eu", "wor", "us", "au"],
    "DE": ["de", "eu", "wor", "uk", "us"], "FR": ["fr", "eu", "wor", "uk", "us"],
    "ES": ["sp", "es", "eu", "wor", "us"], "IT": ["it", "eu", "wor", "uk", "us"],
}
DEFAULT_REGIONS = ["eu", "uk", "pl", "de", "fr", "wor", "us", "jp"]
REGION_LABEL = {"eu": "PAL", "uk": "UK", "pl": "PL", "de": "DE", "fr": "FR", "sp": "ES", "es": "ES",
                "it": "IT", "wor": "World", "us": "USA", "jp": "JP", "au": "AU"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


class ScreenScraper:
    def __init__(self):
        self.lock = asyncio.Lock()  # darmowe konto = 1 wątek
        self.systems: dict[str, int] = {}
        self.systems_at = 0.0

    @property
    def configured(self) -> bool:
        return config.service_on("screenscraper")

    def _params(self, **extra):
        g = config.get
        return {"devid": g("SS_DEVID"), "devpassword": g("SS_DEVPASSWORD"), "softname": SOFTNAME,
                "ssid": g("SS_USER"), "sspassword": g("SS_PASSWORD"), "output": "json", **extra}

    async def _get(self, client: httpx.AsyncClient, endpoint: str, **params) -> dict:
        async with self.lock:
            r = await client.get(API + endpoint, params=self._params(**params), timeout=25)
        if r.status_code != 200:
            raise RuntimeError(f"ScreenScraper {endpoint}: HTTP {r.status_code} {r.text[:150]}")
        try:
            return r.json()
        except ValueError:
            raise RuntimeError(f"ScreenScraper {endpoint}: {r.text[:150]}")

    async def system_id(self, client, platform: Optional[str]) -> Optional[int]:
        if not platform:
            return None
        if not self.systems or time.time() - self.systems_at > 7 * 86400:
            try:
                data = await self._get(client, "systemesListe.php")
                systems = data.get("response", {}).get("systemes", [])
                found = {}
                for ours, keys in ALIASES.items():
                    best = None
                    for s in systems:
                        raw = [str(v) for v in (s.get("noms") or {}).values() if v]
                        names = [norm(x) for v in raw for x in v.split(",") if norm(x)]
                        if any(n == k or n.endswith(" " + k) for n in names for k in keys):
                            best = int(s["id"])
                            break
                    if best:
                        found[ours] = best
                self.systems = {**FALLBACK_IDS, **found}
                self.systems_at = time.time()
            except Exception as e:  # noqa: BLE001
                log.warning("lista systemów niedostępna: %s", e)
                self.systems = dict(FALLBACK_IDS)
        return self.systems.get(platform)

    async def covers(self, client, title: str, platform: Optional[str], lang: Optional[str]) -> list[dict]:
        """Warianty okładek dla gry: [{url, region, type}], posortowane wg języka/regionu."""
        if not self.configured or not title:
            return []
        sid = await self.system_id(client, platform)
        params = {"recherche": title}
        if sid:
            params["systemeid"] = sid
        data = await self._get(client, "jeuRecherche.php", **params)
        games = [g for g in data.get("response", {}).get("jeux", []) if g and g.get("id")]
        if not games:
            return []
        want = norm(title)

        def score(g):
            names = [norm(n.get("text", "")) for n in g.get("noms", [])]
            return 0 if want in names else (1 if any(want in n or n in want for n in names) else 2)

        game = sorted(games, key=score)[0]
        order = REGION_BY_LANG.get((lang or "").upper(), DEFAULT_REGIONS)

        def rank(m):
            reg = m.get("region") or "wor"
            return order.index(reg) if reg in order else len(order)

        out = []
        for typ in ("box-2D", "box-2D-side"):
            media = [m for m in game.get("medias", []) if m.get("type") == typ and m.get("url")]
            for m in sorted(media, key=rank):
                out.append({"url": m["url"], "type": "spine" if typ.endswith("side") else "cover",
                            "region": REGION_LABEL.get(m.get("region"), (m.get("region") or "").upper())})
        return out
