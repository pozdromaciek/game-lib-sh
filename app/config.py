# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Ustawienia instalacji: hasło, klucz sesji i klucze API.

Kolejność: zmienne środowiskowe (.env) mają pierwszeństwo — tak działały starsze instalacje.
Reszta trzymana jest w /data/config.json (uprawnienia 0600), który zapisuje kreator pierwszego
uruchomienia (/setup) i Narzędzia → Klucze API. Hasło zapisujemy tylko jako skrót scrypt.
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import threading
from pathlib import Path

log = logging.getLogger("kolekcja.config")

KEYS = ("IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET", "EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET",
        "SS_DEVID", "SS_DEVPASSWORD", "SS_USER", "SS_PASSWORD")
SERVICES = {
    "igdb": ("IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"),
    "ebay": ("EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"),
    "screenscraper": ("SS_DEVID", "SS_DEVPASSWORD", "SS_USER", "SS_PASSWORD"),
}
_lock = threading.Lock()
_cache: dict | None = None
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # bez 0/O i 1/I — łatwo przepisać z logów


def data_dir() -> Path:
    d = Path(os.getenv("DATA_DIR", "/data"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path() -> Path:
    return data_dir() / "config.json"


def _load() -> dict:
    global _cache
    if _cache is None:
        try:
            _cache = json.loads(_path().read_text())
            if not isinstance(_cache, dict):
                _cache = {}
        except FileNotFoundError:
            _cache = {}
        except (OSError, ValueError) as e:
            log.error("Nie da się odczytać %s: %s", _path(), e)
            _cache = {}
    return _cache


def _save(data: dict) -> None:
    global _cache
    p = _path()
    tmp = p.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, p)
    _cache = data


def get(name: str, default: str = "") -> str:
    env = os.getenv(name)
    if env:
        return env
    return str(_load().get(name) or default)


def source(name: str) -> str:
    """'env' — ustawione w .env (tylko do odczytu w apce), 'app' — zapisane w apce, '' — brak."""
    if os.getenv(name):
        return "env"
    return "app" if _load().get(name) else ""


def update(values: dict) -> None:
    """Zapisuje klucze (pusty tekst = usuń). Klucze ustawione w .env są pomijane."""
    with _lock:
        data = dict(_load())
        for k, v in values.items():
            if k not in KEYS or os.getenv(k):
                continue
            v = (v or "").strip()
            if v:
                data[k] = v
            else:
                data.pop(k, None)
        _save(data)


def service_on(name: str) -> bool:
    return all(get(k) for k in SERVICES[name])


def hint(value: str) -> str:
    """Podpowiedź, który klucz jest zapisany — pierwsze 4 znaki, nigdy cały."""
    return f"{value[:4]}…" if len(value) > 8 else ("…" if value else "")


# --- klucz sesji ---------------------------------------------------------------
def secret_key() -> bytes:
    env = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY") or ""
    if len(env) >= 16:
        return env.encode()
    with _lock:
        data = dict(_load())
        if len(data.get("SECRET_KEY", "")) < 32:
            data["SECRET_KEY"] = secrets.token_hex(32)
            _save(data)
        return data["SECRET_KEY"].encode()


def session_epoch() -> str:
    """Zmienia się przy zmianie hasła — stare sesje przestają działać."""
    return str(_load().get("session_epoch") or "")


# --- hasło ------------------------------------------------------------------------
def password_from_env() -> bool:
    return bool(os.getenv("APP_PASSWORD"))


def password_set() -> bool:
    return password_from_env() or bool(_load().get("password_hash"))


def _scrypt(pw: str, salt: bytes) -> bytes:
    return hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)


def check_password(pw: str) -> bool:
    env = os.getenv("APP_PASSWORD")
    if env:
        return hmac.compare_digest(pw.encode(), env.encode())
    stored = _load().get("password_hash") or ""
    try:
        algo, salt_b64, hash_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        salt, want = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
    except ValueError:
        return False
    return hmac.compare_digest(_scrypt(pw, salt), want)


def set_password(pw: str) -> None:
    if password_from_env():
        raise ValueError("Hasło jest ustawione w .env (APP_PASSWORD) — zmień je tam")
    salt = secrets.token_bytes(16)
    with _lock:
        data = dict(_load())
        data["password_hash"] = f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(_scrypt(pw, salt)).decode()}"
        data["session_epoch"] = secrets.token_hex(4)
        _save(data)


# --- pierwsze uruchomienie ------------------------------------------------------
def setup_needed() -> bool:
    return not password_set()


def _code_path() -> Path:
    return data_dir() / "setup-code"


def setup_code() -> str:
    """Kod z logów kontenera — tylko osoba z dostępem do serwera może dokończyć instalację."""
    p = _code_path()
    try:
        code = p.read_text().strip()
        if len(code) == 9:
            return code
    except OSError:
        pass
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
    code = f"{raw[:4]}-{raw[4:]}"
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(code)
    return code


def check_setup_code(code: str) -> bool:
    want = setup_code().replace("-", "")
    got = "".join(ch for ch in (code or "").upper() if ch.isalnum())
    return hmac.compare_digest(got.encode(), want.encode())


def finish_setup() -> None:
    try:
        _code_path().unlink()
    except FileNotFoundError:
        pass


def announce_setup() -> None:
    if not setup_needed():
        return
    code = setup_code()
    line = "=" * 64
    msg = (f"\n{line}\n  MOJA KOLEKCJA — pierwsze uruchomienie / first run\n"
           f"  Otwórz / open  http://<adres-serwera>:{os.getenv('PORT', '8080')}/setup\n"
           f"  Kod instalacji / setup code:  {code}\n{line}\n")
    print(msg, flush=True)
