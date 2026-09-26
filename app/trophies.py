# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Trofea (osiągnięcia) w stylu PlayStation: brąz / srebro / złoto / platyna.

Stan liczony z bazy (liczby, wartości) + dziennik zdarzeń `events` (np. ukończenie gry z kupki
wstydu). Zdobyte zapisujemy w `trophies`; `seen = 0` → klient pokazuje popup i potwierdza.
Przy pierwszym uruchomieniu wszystko, co już się należy, zapisujemy „po cichu”.
"""
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

TIERS = {"bronze": "Brąz", "silver": "Srebro", "gold": "Złoto", "platinum": "Platyna"}
# (klucz, tier, grupa, nazwa, opis, metryka, próg)
DEFS = [
    ("g1", "bronze", "Kolekcja", "Start!", "Dodaj pierwszą grę", "games", 1),
    ("g10", "bronze", "Kolekcja", "Półka", "10 gier w kolekcji", "games", 10),
    ("g25", "bronze", "Kolekcja", "Regał", "25 gier w kolekcji", "games", 25),
    ("g50", "silver", "Kolekcja", "Kolekcjoner", "50 gier w kolekcji", "games", 50),
    ("g100", "silver", "Kolekcja", "Setka", "100 gier w kolekcji", "games", 100),
    ("g250", "gold", "Kolekcja", "Archiwum", "250 gier w kolekcji", "games", 250),
    ("g500", "gold", "Kolekcja", "Muzeum", "500 gier w kolekcji", "games", 500),
    ("v500", "bronze", "Wartość", "Kieszonkowe", "Kolekcja warta 500 zł", "value", 500),
    ("v1000", "bronze", "Wartość", "Tysiączek", "Kolekcja warta 1000 zł", "value", 1000),
    ("v2500", "silver", "Wartość", "Skarbonka", "Kolekcja warta 2500 zł", "value", 2500),
    ("v5000", "silver", "Wartość", "Sejf", "Kolekcja warta 5000 zł", "value", 5000),
    ("v10000", "gold", "Wartość", "Skarbiec", "Kolekcja warta 10 000 zł", "value", 10000),
    ("c1", "bronze", "Sprzęt", "Włączam!", "Pierwsza konsola", "consoles", 1),
    ("c3", "bronze", "Sprzęt", "Trio", "3 konsole", "consoles", 3),
    ("c5", "silver", "Sprzęt", "Ściana konsol", "5 konsol", "consoles", 5),
    ("c10", "gold", "Sprzęt", "Wystawa", "10 konsol", "consoles", 10),
    ("a1", "bronze", "Sprzęt", "Drugi pad", "Pierwsze akcesorium", "accessories", 1),
    ("p3", "bronze", "Platformy", "Wieloplatformowiec", "Gry na 3 różne platformy", "platforms", 3),
    ("p5", "silver", "Platformy", "Wojna konsol? Nie u mnie", "Gry na 5 różnych platform", "platforms", 5),
    ("p10", "gold", "Platformy", "Ekumenista", "Gry na 10 różnych platform", "platforms", 10),
    ("f1", "bronze", "Granie", "Napisy końcowe", "Ukończ pierwszą grę", "completed", 1),
    ("f10", "bronze", "Granie", "Wytrwały", "10 ukończonych gier", "completed", 10),
    ("f25", "silver", "Granie", "Maratończyk", "25 ukończonych gier", "completed", 25),
    ("f50", "gold", "Granie", "Nie śpię, gram", "50 ukończonych gier", "completed", 50),
    ("cib10", "bronze", "Kompletność", "CIB", "10 kompletnych gier (płyta + pudełko + instrukcja)", "cib", 10),
    ("cib50", "silver", "Kompletność", "Pedant", "50 kompletnych gier", "cib", 50),
    ("cib_all", "gold", "Kompletność", "Wszystko na miejscu", "Każda gra kompletna (min. 20 gier)", "cib_all", 1),
    ("s1", "bronze", "Kupka wstydu", "Wstyd mi", "Połóż pierwszą grę na kupce wstydu", "shame_add", 1),
    ("s_done1", "bronze", "Kupka wstydu", "Odkupienie", "Ukończ grę z kupki wstydu", "shame_done", 1),
    ("s_done5", "silver", "Kupka wstydu", "Porządki", "Ukończ 5 gier z kupki wstydu", "shame_done", 5),
    ("s_done20", "gold", "Kupka wstydu", "Czyste sumienie", "Ukończ 20 gier z kupki wstydu", "shame_done", 20),
    ("s_empty", "gold", "Kupka wstydu", "Pusta kupka", "Opróżnij kupkę wstydu (po min. 5 grach na niej)", "shame_empty", 1),
    ("l1", "bronze", "Wypożyczenia", "Pożyczalski", "Pierwsze wypożyczenie", "loans", 1),
    ("l_late", "bronze", "Wypożyczenia", "Gdzie moja gra?!", "Gra wróciła po terminie", "return_late", 1),
    ("w1", "bronze", "Lista życzeń", "Marzyciel", "Pierwsza pozycja na liście życzeń", "wishes", 1),
    ("b1", "bronze", "Lista życzeń", "Spełnione marzenie", "Kup coś z listy życzeń", "bought", 1),
    ("b10", "silver", "Lista życzeń", "Łowca", "10 zakupów z listy życzeń", "bought", 10),
    ("b_under", "silver", "Lista życzeń", "Okazja!", "Kup poniżej swojej ceny docelowej", "bought_under", 1),
    ("k1", "bronze", "Kolekcje", "Plan", "Utwórz pierwszą kolekcję", "coll_count", 1),
    ("k50", "bronze", "Kolekcje", "Półmetek", "Skompletuj połowę dowolnej kolekcji", "coll_half", 1),
    ("k100", "gold", "Kolekcje", "Komplet", "Skompletuj całą kolekcję (min. 3 gry)", "coll_full", 1),
    ("sp1", "bronze", "Wydania", "Limitka", "Pierwsze wydanie specjalne", "special", 1),
    ("r10", "bronze", "Oceny", "Recenzent", "Oceń 10 gier", "rated", 10),
    ("r5", "bronze", "Oceny", "Arcydzieło", "Daj grze 5 gwiazdek", "five_star", 1),
    ("jp", "bronze", "Różne", "Import z Japonii", "Gra w wersji NTSC-J", "ntsc_j", 1),
    ("retro", "bronze", "Różne", "Retro", "Gra z 1995 roku lub starsza", "retro", 1),
    ("dec", "silver", "Różne", "Podróżnik w czasie", "Gry z 4 różnych dekad", "decades", 4),
    ("ph1", "bronze", "Różne", "Fotograf", "Dodaj zdjęcie swojego egzemplarza", "photos", 1),
    ("rnd", "bronze", "Różne", "Los tak chciał", "Zacznij grę wylosowaną w „Co dziś zagrać?”", "random_start", 1),
    # --- rozszerzenie (v3.8) ---
    ("g5", "bronze", "Kolekcja", "Rozgrzewka", "5 gier w kolekcji", "games", 5),
    ("g75", "silver", "Kolekcja", "Ściana gier", "75 gier w kolekcji", "games", 75),
    ("g150", "silver", "Kolekcja", "Magazyn", "150 gier w kolekcji", "games", 150),
    ("g1000", "gold", "Kolekcja", "Legenda", "1000 gier w kolekcji", "games", 1000),
    ("v250", "bronze", "Wartość", "Grosz do grosza", "Kolekcja warta 250 zł", "value", 250),
    ("v7500", "silver", "Wartość", "Lokata", "Kolekcja warta 7500 zł", "value", 7500),
    ("v25000", "gold", "Wartość", "Fort Knox", "Kolekcja warta 25 000 zł", "value", 25000),
    ("v50000", "gold", "Wartość", "Bank", "Kolekcja warta 50 000 zł", "value", 50000),
    ("x200", "bronze", "Wartość", "Perełka", "Pozycja warta co najmniej 200 zł", "max_value", 200),
    ("x500", "silver", "Wartość", "Klejnot", "Pozycja warta co najmniej 500 zł", "max_value", 500),
    ("x1000", "gold", "Wartość", "Święty Graal", "Pozycja warta co najmniej 1000 zł", "max_value", 1000),
    ("c2", "bronze", "Sprzęt", "Druga konsola", "2 konsole", "consoles", 2),
    ("c20", "gold", "Sprzęt", "Muzeum sprzętu", "20 konsol", "consoles", 20),
    ("a5", "bronze", "Sprzęt", "Szuflada", "5 akcesoriów", "accessories", 5),
    ("a10", "silver", "Sprzęt", "Szuflada kabli", "10 akcesoriów", "accessories", 10),
    ("a25", "gold", "Sprzęt", "Magazyn akcesoriów", "25 akcesoriów", "accessories", 25),
    ("hand", "bronze", "Sprzęt", "W drogę", "Konsola przenośna w kolekcji", "handheld", 1),
    ("fam3", "silver", "Sprzęt", "Trzy obozy", "Konsole z 3 rodzin (PlayStation, Xbox, Nintendo, Sega)", "families", 3),
    ("pm25", "silver", "Platformy", "Specjalista", "25 gier na jednej platformie", "plat_max", 25),
    ("pm50", "gold", "Platformy", "Fanatyk", "50 gier na jednej platformie", "plat_max", 50),
    ("psall", "silver", "Platformy", "Cała rodzina PlayStation", "Gry na PS1, PS2, PS3, PS4 i PS5", "ps_gens", 5),
    ("nin5", "silver", "Platformy", "Wielkie N", "Gry na 5 platformach Nintendo", "nin_plats", 5),
    ("sega", "bronze", "Platformy", "Sega!", "Gra na konsolę Segi", "sega_games", 1),
    ("pc", "bronze", "Platformy", "Pecetowiec", "Gra na PC", "pc_games", 1),
    ("xbox", "bronze", "Platformy", "Zielone światło", "Gra na Xboksa", "xbox_games", 1),
    ("f5", "bronze", "Granie", "Rozpęd", "5 ukończonych gier", "completed", 5),
    ("f100", "gold", "Granie", "Setka napisów", "100 ukończonych gier", "completed", 100),
    ("fast", "bronze", "Granie", "Błyskawica", "Ukończ grę w ciągu 7 dni od zakupu", "fast_complete", 1),
    ("month3", "silver", "Granie", "Maraton miesiąca", "3 gry ukończone w jednym miesiącu", "month_max", 3),
    ("multi", "bronze", "Granie", "Wielozadaniowość", "3 gry jednocześnie ze statusem „Gram”", "playing_now", 3),
    ("drop", "bronze", "Granie", "Nie dla mnie", "Porzuć grę", "dropped", 1),
    ("cib1", "bronze", "Kompletność", "Pierwszy komplet", "Pierwsza kompletna gra", "cib", 1),
    ("cib25", "silver", "Kompletność", "Kolekcjoner pudełek", "25 kompletnych gier", "cib", 25),
    ("cib100", "gold", "Kompletność", "Kompletista", "100 kompletnych gier", "cib", 100),
    ("loose5", "bronze", "Kompletność", "Luzak", "5 gier bez pudełka", "loose", 5),
    ("condA", "bronze", "Kompletność", "Jak z fabryki", "10 pozycji w stanie A", "cond_a", 10),
    ("s5", "bronze", "Kupka wstydu", "Kupka rośnie", "5 gier na kupce wstydu jednocześnie", "shame_now", 5),
    ("s_done10", "silver", "Kupka wstydu", "Wiosenne porządki", "Ukończ 10 gier z kupki wstydu", "shame_done", 10),
    ("l5", "bronze", "Wypożyczenia", "Wypożyczalnia", "5 wypożyczeń", "loans", 5),
    ("l10", "silver", "Wypożyczenia", "Biblioteka", "10 wypożyczeń", "loans", 10),
    ("ret5", "bronze", "Wypożyczenia", "Słowni znajomi", "5 gier oddanych w terminie", "returns_ok", 5),
    ("w10", "bronze", "Lista życzeń", "Lista zakupów", "10 pozycji na liście życzeń", "wishes", 10),
    ("w25", "silver", "Lista życzeń", "Marzenia na zapas", "25 pozycji na liście życzeń", "wishes", 25),
    ("b5", "bronze", "Lista życzeń", "Łowca okazji", "5 zakupów z listy życzeń", "bought", 5),
    ("b25", "gold", "Lista życzeń", "Spełniacz marzeń", "25 zakupów z listy życzeń", "bought", 25),
    ("k3", "bronze", "Kolekcje", "Planista", "Utwórz 3 kolekcje", "coll_count", 3),
    ("k100x3", "gold", "Kolekcje", "Seryjny kolekcjoner", "3 skompletowane kolekcje", "coll_full_n", 3),
    ("kbig", "silver", "Kolekcje", "Duża seria", "Skompletuj kolekcję z co najmniej 10 gier", "coll_full_big", 1),
    ("sp5", "silver", "Wydania", "Limitowane", "5 wydań specjalnych", "special", 5),
    ("sp10", "silver", "Wydania", "Edycja kolekcjonerska", "10 wydań specjalnych", "special", 10),
    ("steel", "bronze", "Wydania", "Metalowa skrzynka", "Pierwszy steelbook", "steelbook", 1),
    ("r25", "silver", "Oceny", "Krytyk", "Oceń 25 gier", "rated", 25),
    ("r50", "gold", "Oceny", "Redaktor naczelny", "Oceń 50 gier", "rated", 50),
    ("rlow", "bronze", "Oceny", "Szczerość", "Daj grze pół gwiazdki albo jedną", "low_rating", 1),
    ("pl10", "bronze", "Regiony", "Polska wersja", "10 gier z polską okładką", "pl_covers", 10),
    ("reg3", "silver", "Regiony", "Obywatel świata", "Pozycje w wersjach PAL, NTSC-U i NTSC-J", "regions", 3),
    ("lang4", "bronze", "Regiony", "Poliglota", "Okładki w 4 różnych językach", "cover_langs", 4),
    ("y1", "bronze", "Czas", "Rocznica", "Pozycja w kolekcji od co najmniej roku", "owned_1y", 1),
    ("y10", "gold", "Czas", "Dekada z grą", "Pozycja w kolekcji od co najmniej 10 lat", "owned_10y", 1),
    ("old85", "silver", "Czas", "Pradawne", "Gra z 1985 roku lub starsza", "old85", 1),
    ("fresh", "bronze", "Czas", "Premiera", "Gra wydana w tym roku", "fresh", 1),
    ("ph10", "bronze", "Zdjęcia", "Album", "10 zdjęć egzemplarzy", "photos", 10),
    ("ph50", "silver", "Zdjęcia", "Fotoreporter", "50 zdjęć egzemplarzy", "photos", 50),
    ("fs1", "bronze", "Sprzedaż", "Wystawione", "Wystaw coś na sprzedaż", "for_sale_ev", 1),
    ("sold1", "bronze", "Sprzedaż", "Pierwsza transakcja", "Sprzedaj coś", "sold", 1),
    ("sold10", "silver", "Sprzedaż", "Handlarz", "Sprzedaj 10 pozycji", "sold", 10),
    ("prof1", "bronze", "Sprzedaż", "Na plusie", "Sprzedaj drożej, niż kupiłeś", "sold_profit", 1),
    ("prof500", "gold", "Sprzedaż", "Biznesmen", "Łączny zysk ze sprzedaży co najmniej 500 zł", "profit", 500),
    ("dup", "bronze", "Sprzedaż", "Déjà vu", "Dwa egzemplarze tej samej gry", "dupes", 1),
    ("fr1", "bronze", "Znajomi", "Znajomy", "Dodaj znajomego", "friends", 1),
    ("fr5", "silver", "Znajomi", "Paczka", "5 znajomych", "friends", 5),
    ("share", "bronze", "Znajomi", "Pochwal się", "Udostępnij kod swojej kolekcji", "share_ev", 1),
    ("ser10", "bronze", "Narzędzia", "Archiwista", "10 gier z numerem seryjnym", "serials", 10),
    ("ocr", "bronze", "Narzędzia", "Skaner", "Odczytaj numer seryjny aparatem", "ocr_ev", 1),
    ("report", "bronze", "Narzędzia", "Polisa", "Wygeneruj raport do ubezpieczenia", "report_ev", 1),
    ("wrapped", "bronze", "Narzędzia", "Podsumowanie", "Obejrzyj swój rok w grach", "wrapped_ev", 1),
    ("rnd5", "bronze", "Narzędzia", "Hazardzista", "Zacznij 5 wylosowanych gier", "random_start", 5),
    ("lcd", "bronze", "Narzędzia", "Game Boy", "Włącz wygląd LCD", "theme_lcd", 1),
    ("crt", "bronze", "Narzędzia", "Kineskop", "Włącz wygląd CRT", "theme_crt", 1),
    ("en", "bronze", "Narzędzia", "Hello!", "Przełącz apkę na angielski", "lang_en", 1),
    ("themes", "silver", "Narzędzia", "Garderoba", "Wypróbuj wszystkie wyglądy (poza ukrytym)", "themes_used", 6),
    # ukryte — nie liczą się do platyny, do odblokowania widać tylko „???”
    ("konami", "gold", "Sekrety", "↑↑↓↓←→←→BA", "Wpisz kod Konami", "konami_ev", 1),
    ("red", "silver", "Sekrety", "Czerwona gorączka", "Włącz ukryty wygląd RED", "theme_red", 1),
    ("combo", "bronze", "Sekrety", "Kombinacja", "Naciśnij △ ○ ✕ □ w nagłówku po kolei", "combo_ev", 1),
    ("about", "bronze", "Sekrety", "Ciekawski", "Zajrzyj do „O aplikacji”", "about_ev", 1),
    ("plat", "platinum", "Platyna", "Platyna", "Zdobądź 70% pozostałych trofeów", "platinum", 1),
]
SECRET_GROUP = "Sekrety"
SHAME_METRICS = {"shame_add", "shame_done", "shame_empty", "shame_now"}
HANDHELD = {"PSP", "PS Vita", "Game Boy", "Game Boy Color", "Game Boy Advance", "Nintendo DS", "Nintendo 3DS", "Nintendo Switch"}
FAMILY = {"PlayStation": "ps", "PlayStation 2": "ps", "PlayStation 3": "ps", "PlayStation 4": "ps", "PlayStation 5": "ps", "PSP": "ps", "PS Vita": "ps",
          "Xbox": "xbox", "Xbox 360": "xbox", "Xbox One": "xbox", "Xbox Series X|S": "xbox", "Sega Mega Drive": "sega", "Sega Dreamcast": "sega"}
NINTENDO = {"NES", "SNES", "Nintendo 64", "GameCube", "Wii", "Wii U", "Nintendo Switch", "Game Boy", "Game Boy Color", "Game Boy Advance", "Nintendo DS", "Nintendo 3DS"}


def M():
    from . import main
    return main


def metrics(con) -> dict:
    m = M()
    items = [dict(r) for r in con.execute("SELECT * FROM items WHERE wish = 0 AND sold_on IS NULL")]
    games = [i for i in items if i["kind"] == "game"]
    ev = {r[0]: r[1] for r in con.execute("SELECT type, COUNT(*) FROM events GROUP BY type")}
    cib = [g for g in games if g["has_disc"] and g["has_box"] and g["has_manual"]]
    years = [g["release_year"] for g in games if g["release_year"]]
    from . import collections as C
    cols = C._load(con)
    pct = []
    for c in cols:
        s = [e for e in c["entries"] if not e["hidden"]]
        if s:
            pct.append((sum(1 for e in s if e["owned"]) / len(s), len(s)))
    wishes_now = con.execute("SELECT COUNT(*) FROM items WHERE wish = 1").fetchone()[0]
    shame_now = sum(1 for g in games if g["shame_since"])
    return {
        "games": len(games),
        "value": to_pln(sum(i["value"] or 0 for i in items)),
        "consoles": sum(1 for i in items if i["kind"] == "console"),
        "accessories": sum(1 for i in items if i["kind"] == "accessory"),
        "platforms": len({g["platform"] for g in games if g["platform"]}),
        "completed": sum(1 for g in games if g["status"] == "completed"),
        "cib": len(cib),
        "cib_all": 1 if len(games) >= 20 and len(cib) == len(games) else 0,
        "shame_add": ev.get("shame_add", 0) + (1 if shame_now and not ev.get("shame_add") else 0),
        "shame_done": ev.get("shame_done", 0),
        "shame_empty": 1 if ev.get("shame_add", 0) >= 5 and shame_now == 0 else 0,
        "loans": ev.get("loan", 0) + (0 if ev.get("loan") else con.execute("SELECT COUNT(*) FROM loans").fetchone()[0]),
        "return_late": ev.get("return_late", 0),
        "wishes": max(ev.get("wish_add", 0), wishes_now, ev.get("bought", 0)),
        "bought": ev.get("bought", 0),
        "bought_under": ev.get("bought_under", 0),
        "coll_count": len(cols),
        "coll_half": 1 if any(p >= 0.5 for p, _ in pct) else 0,
        "coll_full": 1 if any(p >= 1 and n >= 3 for p, n in pct) else 0,
        "special": sum(1 for i in items if (i["special"] or "[]") not in ("[]", "")),
        "rated": sum(1 for g in games if g["rating"]),
        "five_star": 1 if any((g["rating"] or 0) >= 10 for g in games) else 0,
        "ntsc_j": 1 if any(i["region"] == "NTSC-J" for i in items) else 0,
        "retro": 1 if any(y <= 1995 for y in years) else 0,
        "decades": len({y // 10 for y in years}),
        "photos": con.execute("SELECT COUNT(*) FROM item_photos").fetchone()[0],
        "random_start": ev.get("random_start", 0),
        **extra_metrics(con, items, games, ev, pct, shame_now),
    }


def to_pln(v: float) -> float:
    """Progi trofeów są w zł — przy innej walucie przeliczamy kursem NBP (z pamięci podręcznej)."""
    cur = M().get_settings().get("currency", "PLN")
    if cur == "PLN":
        return v
    from .prices import _rates
    r = _rates["rates"].get(cur)
    return v * r if r else v


def extra_metrics(con, items, games, ev, pct, shame_now) -> dict:
    from collections import Counter
    from datetime import date, timedelta
    today = date.today()
    per_plat = Counter(g["platform"] for g in games if g["platform"])
    consoles = [i for i in items if i["kind"] == "console"]
    sold = [dict(r) for r in con.execute("SELECT * FROM items WHERE sold_on IS NOT NULL")]
    profit = sum((i["sold_price"] or 0) - (i["price_paid"] or 0) for i in sold if i["price_paid"] is not None)
    bought = {g["id"]: g["purchased_on"] for g in games if g["purchased_on"]}
    comp_ev = [dict(r) for r in con.execute("SELECT item_id, at FROM events WHERE type='completed'")]
    fast = 0
    for e in comp_ev:
        p = bought.get(e["item_id"])
        try:
            if p and date.fromisoformat(e["at"][:10]) - date.fromisoformat(p) <= timedelta(days=7):
                fast = 1
        except ValueError:
            pass
    month = Counter(e["at"][:7] for e in comp_ev)
    keys = Counter((g["igdb_id"] or g["title"].strip().lower(), g["platform"]) for g in games)
    def since(d, days):
        try:
            return d and (today - date.fromisoformat(d[:10])).days >= days
        except ValueError:
            return False
    langs = {g["cover_lang"] for g in games if g["cover_lang"] and g["cover_lang"] not in ("MULTI", "INNY")}
    return {
        "max_value": to_pln(max((i["value"] or 0 for i in items), default=0)),
        "handheld": sum(1 for c in consoles if c["platform"] in HANDHELD),
        "families": len({FAMILY.get(c["platform"], "nin" if c["platform"] in NINTENDO else None) for c in consoles} - {None}),
        "plat_max": max(per_plat.values(), default=0),
        "ps_gens": len({p for p in per_plat if p in ("PlayStation", "PlayStation 2", "PlayStation 3", "PlayStation 4", "PlayStation 5")}),
        "nin_plats": len({p for p in per_plat if p in NINTENDO}),
        "sega_games": sum(n for p, n in per_plat.items() if p and p.startswith("Sega")),
        "pc_games": per_plat.get("PC", 0),
        "xbox_games": sum(n for p, n in per_plat.items() if p and p.startswith("Xbox")),
        "fast_complete": fast,
        "month_max": max(month.values(), default=0),
        "playing_now": sum(1 for g in games if g["status"] == "playing"),
        "dropped": sum(1 for g in games if g["status"] == "dropped"),
        "loose": sum(1 for g in games if not g["has_box"]),
        "cond_a": sum(1 for i in items if i["condition"] == "A"),
        "shame_now": shame_now,
        "returns_ok": ev.get("return", 0),
        "coll_full_n": sum(1 for p, n in pct if p >= 1 and n >= 3),
        "coll_full_big": 1 if any(p >= 1 and n >= 10 for p, n in pct) else 0,
        "steelbook": sum(1 for i in items if "Steelbook" in (i["special"] or "")),
        "low_rating": 1 if any(g["rating"] and g["rating"] <= 2 for g in games) else 0,
        "pl_covers": sum(1 for g in games if g["cover_lang"] == "PL"),
        "regions": len({i["region"] for i in items if i["region"] in ("PAL", "NTSC-U", "NTSC-J")}),
        "cover_langs": len(langs),
        "owned_1y": 1 if any(since(i["purchased_on"] or i["created_at"], 365) for i in items) else 0,
        "owned_10y": 1 if any(since(i["purchased_on"], 3650) for i in items) else 0,
        "old85": 1 if any(g["release_year"] and g["release_year"] <= 1985 for g in games) else 0,
        "fresh": 1 if any(g["release_year"] == today.year for g in games) else 0,
        "for_sale_ev": ev.get("for_sale", 0),
        "sold": len(sold),
        "sold_profit": ev.get("sold_profit", 0),
        "profit": to_pln(profit),
        "dupes": 1 if any(n >= 2 for n in keys.values()) else 0,
        "friends": con.execute("SELECT COUNT(*) FROM friends").fetchone()[0],
        "share_ev": ev.get("share", 0),
        "serials": sum(1 for g in games if g["serial"]),
        "ocr_ev": ev.get("ocr", 0), "report_ev": ev.get("report", 0), "wrapped_ev": ev.get("wrapped", 0),
        "theme_lcd": ev.get("theme_lcd", 0), "theme_crt": ev.get("theme_crt", 0), "lang_en": ev.get("lang_en", 0),
        "themes_used": sum(1 for t in ("ps2", "lcd", "crt", "dmg", "x360", "w95") if ev.get(f"theme_{t}")),
        "konami_ev": ev.get("konami", 0), "theme_red": ev.get("theme_red", 0),
        "combo_ev": ev.get("combo", 0), "about_ev": ev.get("about", 0),
    }


def evaluate(con, shame_on: bool) -> dict:
    met = metrics(con)
    have = {r["key"]: dict(r) for r in con.execute("SELECT * FROM trophies")}
    defs = [d for d in DEFS if shame_on or d[5] not in SHAME_METRICS]
    base = [d for d in defs if d[5] != "platinum" and d[2] != SECRET_GROUP]
    got_base = sum(1 for d in base if d[0] in have or met.get(d[5], 0) >= d[6])
    need = round(len(base) * 0.7)
    met["platinum"] = 1 if got_base >= need else 0
    ver = con.execute("SELECT value FROM settings WHERE key='trophies_init'").fetchone()
    # pierwsze uruchomienie albo nowa lista trofeów → zaległe zapisujemy po cichu (jeden zbiorczy popup)
    init = ver is None or json.loads(ver["value"]) != len(DEFS)
    new = []
    for d in defs:
        key, metric, target = d[0], d[5], d[6]
        if key not in have and met.get(metric, 0) >= target:
            con.execute("INSERT OR IGNORE INTO trophies(key, seen) VALUES (?, ?)", (key, 1 if init else 0))
            new.append(key)
    if init:
        con.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('trophies_init', ?)", (json.dumps(len(DEFS)),))
    have = {r["key"]: dict(r) for r in con.execute("SELECT * FROM trophies")}
    out = []
    for key, tier, group, name, desc, metric, target in defs:
        h = have.get(key)
        cur = met["platinum"] if metric == "platinum" else met.get(metric, 0)
        prog = None
        if not h and target > 1:
            prog = [min(cur, target), target]
        if metric == "platinum" and not h:
            prog = [got_base, need]
        secret = group == SECRET_GROUP
        if secret and not h:
            name, desc, prog = "???", "Ukryte trofeum — podobno działa tu pewien stary kod…" if key == "konami" else "Ukryte trofeum", None
        out.append({"key": key, "tier": tier, "group": group, "name": name, "desc": desc, "secret": secret,
                    "unlocked_at": h["unlocked_at"] if h else None, "seen": bool(h["seen"]) if h else None,
                    "progress": prog})
    summary = {t: {"have": sum(1 for o in out if o["tier"] == t and o["unlocked_at"]),
                   "all": sum(1 for o in out if o["tier"] == t)} for t in TIERS}
    unseen = [o for o in out if o["unlocked_at"] and o["seen"] is False]
    return {"trophies": out, "summary": summary, "new": unseen,
            "initial": (sum(1 for o in out if o["unlocked_at"]) if new else 0) if init else 0, "total": len(out),
            "have": sum(1 for o in out if o["unlocked_at"])}


@router.get("/api/trophies")
def get_trophies():
    m = M()
    shame_on = m.get_settings().get("shame", False)
    with m.db() as con:
        return evaluate(con, shame_on)


class SeenIn(BaseModel):
    keys: list[str] = Field(default=[], max_length=100)


@router.post("/api/trophies/seen")
def mark_seen(body: SeenIn):
    with M().db() as con:
        for k in body.keys:
            con.execute("UPDATE trophies SET seen=1 WHERE key=?", (k,))
    return {"ok": True}


# --- „Co dziś zagrać?” -------------------------------------------------------------
class RandomIn(BaseModel):
    item_id: int


@router.post("/api/random/start")
def random_start(body: RandomIn):
    m = M()
    with m.db() as con:
        it = m._get(con, body.item_id)
        if it["kind"] != "game" or it["wish"]:
            raise HTTPException(400, "To nie jest gra z kolekcji")
        con.execute("UPDATE items SET status='playing', updated_at=datetime('now') WHERE id=?", (body.item_id,))
        m.log_event(con, "random_start", body.item_id)
        return m._get(con, body.item_id)
