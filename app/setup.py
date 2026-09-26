# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Kreator pierwszego uruchomienia (/setup) i zarządzanie kluczami API / hasłem w Narzędziach.

Kreator działa tylko, dopóki nie ma hasła. Każde jego wywołanie wymaga kodu instalacji,
który kontener wypisuje w logach (docker logs moja-kolekcja) — dzięki temu nikt inny w sieci
nie „przejmie” świeżej instalacji, zanim zrobi to właściciel serwera.
"""
import asyncio
import base64
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from . import config

router = APIRouter()
_fails: list = []
MIN_PASSWORD = 8


def M():
    from . import main
    return main


def _rate_limit() -> None:
    now = time.time()
    _fails[:] = [t for t in _fails if now - t < 600]
    if len(_fails) >= 10:
        raise HTTPException(429, "Za dużo prób — odczekaj 10 minut")


async def _check_code(code: str) -> None:
    _rate_limit()
    if not config.check_setup_code(code):
        _fails.append(time.time())
        await asyncio.sleep(1.0)
        raise HTTPException(403, "Zły kod instalacji — sprawdź logi kontenera")


def _reset_tokens() -> None:
    M()._token.update(value=None, exp=0.0)
    from . import prices
    prices._token.update(value=None, exp=0.0)
    prices._cache.clear()


# --- testy kluczy -------------------------------------------------------------------
async def test_service(service: str, v: dict) -> str:
    """Sprawdza klucze prawdziwym zapytaniem. Zwraca krótki opis; przy błędzie HTTPException 422."""
    async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "MojaKolekcja/1.0"}) as c:
        try:
            if service == "igdb":
                cid, sec = v.get("IGDB_CLIENT_ID", ""), v.get("IGDB_CLIENT_SECRET", "")
                r = await c.post("https://id.twitch.tv/oauth2/token",
                                 params={"client_id": cid, "client_secret": sec, "grant_type": "client_credentials"})
                if r.status_code != 200:
                    raise HTTPException(422, "Twitch nie przyjął kluczy — sprawdź Client ID i Client Secret")
                tok = r.json()["access_token"]
                r = await c.post("https://api.igdb.com/v4/platforms", content="fields name; where id = 7;",
                                 headers={"Client-ID": cid, "Authorization": f"Bearer {tok}"})
                if r.status_code != 200:
                    raise HTTPException(422, f"IGDB odrzuca zapytania ({r.status_code})")
                return "IGDB działa"
            if service == "ebay":
                basic = base64.b64encode(f"{v.get('EBAY_CLIENT_ID', '')}:{v.get('EBAY_CLIENT_SECRET', '')}".encode()).decode()
                r = await c.post("https://api.ebay.com/identity/v1/oauth2/token",
                                 headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
                                 content="grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope")
                if r.status_code != 200:
                    raise HTTPException(422, "eBay nie przyjął kluczy — potrzebne są klucze produkcyjne (Production)")
                return "eBay działa"
            if service == "screenscraper":
                r = await c.get("https://api.screenscraper.fr/api2/ssuserInfos.php", params={
                    "devid": v.get("SS_DEVID", ""), "devpassword": v.get("SS_DEVPASSWORD", ""), "softname": "MojaKolekcja",
                    "ssid": v.get("SS_USER", ""), "sspassword": v.get("SS_PASSWORD", ""), "output": "json"})
                if r.status_code != 200 or not r.text.lstrip().startswith("{"):
                    raise HTTPException(422, f"ScreenScraper odrzucił dane ({r.status_code})")
                return "ScreenScraper działa"
        except httpx.HTTPError:
            raise HTTPException(502, "Brak połączenia z serwerem usługi — sprawdź internet na serwerze")
        except (ValueError, KeyError):
            raise HTTPException(502, "Nieoczekiwana odpowiedź usługi — spróbuj za chwilę")
    raise HTTPException(404, "Nieznana usługa")


def _values(service: str, given: dict) -> dict:
    """Uzupełnia pola z .env / zapisanych, żeby dało się zmienić np. tylko sekret."""
    return {k: (given.get(k) or "").strip() or config.get(k) for k in config.SERVICES[service]}


# --- kreator ------------------------------------------------------------------------
@router.get("/api/setup/state")
def setup_state():
    return {"needed": config.setup_needed(), "password_env": config.password_from_env(),
            "igdb_env": all(config.source(k) == "env" for k in config.SERVICES["igdb"]),
            "ebay_env": all(config.source(k) == "env" for k in config.SERVICES["ebay"]),
            "version": M().APP_VERSION}


class CodeIn(BaseModel):
    code: str = Field(max_length=20)


@router.post("/api/setup/code")
async def setup_code(body: CodeIn):
    await _check_code(body.code)
    return {"ok": True}


class TestIn(BaseModel):
    code: str = Field(max_length=20)
    service: str
    values: dict = {}


@router.post("/api/setup/test")
async def setup_test(body: TestIn):
    await _check_code(body.code)
    if body.service not in ("igdb", "ebay"):
        raise HTTPException(404, "Nieznana usługa")
    return {"ok": True, "msg": await test_service(body.service, _values(body.service, body.values))}


class FinishIn(BaseModel):
    code: str = Field(max_length=20)
    password: str = Field("", max_length=200)
    igdb: dict = {}
    ebay: Optional[dict] = None


@router.post("/api/setup/finish")
async def setup_finish(body: FinishIn, response: Response):
    await _check_code(body.code)
    if not config.password_from_env() and len(body.password) < MIN_PASSWORD:
        raise HTTPException(422, f"Hasło musi mieć co najmniej {MIN_PASSWORD} znaków")
    save = {}
    if not all(config.source(k) == "env" for k in config.SERVICES["igdb"]):
        igdb = _values("igdb", body.igdb)
        if not all(igdb.values()):
            raise HTTPException(422, "Wpisz klucze IGDB — bez nich apka nie znajdzie gier")
        await test_service("igdb", igdb)
        save.update(igdb)
    if body.ebay and any((body.ebay.get(k) or "").strip() for k in config.SERVICES["ebay"]):
        ebay = _values("ebay", body.ebay)
        await test_service("ebay", ebay)
        save.update(ebay)
    config.update(save)
    if not config.password_from_env():
        await asyncio.to_thread(config.set_password, body.password)
    config.finish_setup()
    _reset_tokens()
    M().set_session(response)
    return {"ok": True}


# --- po instalacji: Narzędzia → Klucze API i hasło ----------------------------------
LABELS = {"igdb": "IGDB", "ebay": "eBay", "screenscraper": "ScreenScraper"}


@router.get("/api/keys")
def keys_state():
    out = {}
    for s, fields in config.SERVICES.items():
        out[s] = {"label": LABELS[s], "on": config.service_on(s),
                  "fields": [{"key": k, "source": config.source(k), "hint": config.hint(config.get(k))} for k in fields]}
    return {"services": out, "password_env": config.password_from_env()}


class KeysIn(BaseModel):
    values: dict = {}
    remove: bool = False


@router.post("/api/keys/{service}")
async def keys_save(service: str, body: KeysIn):
    if service not in config.SERVICES:
        raise HTTPException(404, "Nieznana usługa")
    fields = config.SERVICES[service]
    if any(config.source(k) == "env" for k in fields):
        raise HTTPException(409, "Te klucze są ustawione w pliku .env — zmień je tam")
    if body.remove:
        if service == "igdb":
            raise HTTPException(422, "Bez kluczy IGDB apka nie znajdzie gier — możesz je tylko zmienić")
        config.update({k: "" for k in fields})
        _reset_tokens()
        return {"ok": True, "msg": "Usunięto"}
    vals = _values(service, body.values)
    if not all(vals.values()):
        raise HTTPException(422, "Uzupełnij wszystkie pola")
    msg = await test_service(service, vals)
    config.update(vals)
    _reset_tokens()
    return {"ok": True, "msg": msg}


class PasswordIn(BaseModel):
    old: str = Field(max_length=200)
    new: str = Field(max_length=200)


@router.post("/api/password")
async def change_password(body: PasswordIn, response: Response):
    if config.password_from_env():
        raise HTTPException(409, "Hasło jest ustawione w pliku .env (APP_PASSWORD) — zmień je tam")
    if not await asyncio.to_thread(config.check_password, body.old):
        await asyncio.sleep(1.0)
        raise HTTPException(403, "Obecne hasło się nie zgadza")
    if len(body.new) < MIN_PASSWORD:
        raise HTTPException(422, f"Nowe hasło musi mieć co najmniej {MIN_PASSWORD} znaków")
    await asyncio.to_thread(config.set_password, body.new)
    M().set_session(response)      # to urządzenie zostaje zalogowane, pozostałe muszą zalogować się ponownie
    return {"ok": True}
