#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE)
"""Buduje stronę projektu (GitHub Pages z katalogu docs/) w dwóch językach z jednego szablonu.

    python3 tools/build_site.py      →  docs/index.html (EN) i docs/pl/index.html (PL)

Teksty są w słowniku T poniżej — zmieniaj je tutaj, nie w wygenerowanych plikach HTML.
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://pozdromaciek.github.io/game-lib-sh/"
REPO = "https://github.com/pozdromaciek/game-lib-sh"
COFFEE = "https://buycoffee.to/pozdromaciek"
IMAGE = "ghcr.io/pozdromaciek/game-lib-sh:latest"

THEMES = ["ps1", "ps2", "lcd", "crt", "dmg", "x360", "w95"]

T = {
    "en": {
        "title": "Moja kolekcja — a self-hosted library for your physical games",
        "desc": "Keep track of your physical games, consoles and accessories: value, wishlist, loans, trophies and seven retro looks. Free, open source, one Docker container on your own server.",
        "brand": "MOJA KOLEKCJA",
        "nav": [("features", "Features"), ("looks", "Looks"), ("install", "Install"), ("faq", "FAQ")],
        "lcd": ["BETA 1.0", "GAMES · CONSOLES · ACCESSORIES", "7 LOOKS", "135 TROPHIES", "FREE & OPEN SOURCE", "PRESS START"],
        "kicker": "SELF-HOSTED · FREE · OPEN SOURCE",
        "h1": "Your game shelf, <em>catalogued</em>.",
        "lead": "Keep track of your physical games, consoles and accessories: what you own, what it's worth, what's still on the pile of shame and who borrowed your copy of GTA. Runs in a single Docker container on your own server.",
        "cta_install": "✕ Install", "cta_github": "○ GitHub", "cta_coffee": "□ Buy me a coffee",
        "chips": ["Free, AGPL-3.0", "1 Docker container", "amd64 · arm64", "Polish & English", "Your data stays home"],
        "hero_alt": "Main screen of Moja kolekcja with a PlayStation game collection and the details of Metal Gear Solid",
        "hero_cap": ("PS1 LOOK", "BETA 1.0"),
        "feat_h": "WHAT IT DOES",
        "feat_p": "Built by a collector for collectors of physical games. Everything below works today.",
        "features": [
            ("tri", "△", "ADD & CATALOGUE", [
                "Add a game by title or by the serial number on the box (e.g. SLES-00250)",
                "Scan the serial with your phone camera, with tap-to-focus and zoom",
                "PAL covers with the console spine, in real case proportions",
                "Region, cover language, special editions (Steelbook, collector's)",
                "Completeness (box, manual, disc), condition, photos of your own copy",
                "Star ratings and statuses: backlog, playing, completed, dropped",
            ]),
            ("cir", "○", "VALUE", [
                "Suggested price from eBay listings, converted at the NBP exchange rate",
                "Chart of your collection's value over time",
                "PLN, EUR, USD, GBP, CHF, CZK",
                "PDF report of the whole collection, e.g. for insurance",
            ]),
            ("crs", "✕", "BUY & SELL", [
                "Wishlist with target prices and quick search in the shops you pick",
                "OLX, Allegro, eBay (.com/.de/.co.uk), Vinted, PriceCharting",
                "“Bought it” moves a game from the wishlist into the collection",
                "Duplicates filter, ready-made listings with a ZIP of photos",
                "Sold archive with profit or loss",
            ]),
            ("sqr", "□", "PLAY", [
                "Pile of shame (optional)",
                "“What to play today?” — a slot machine picks a game for you",
                "Loans with due dates and history — see what's overdue",
            ]),
            ("tri", "△", "COLLECT", [
                "Series: how many Gran Turismo games you have and which are missing",
                "Platform exclusives",
                "Friends: swap “collection codes” and compare — no server in between",
            ]),
            ("cir", "○", "STATS & FUN", [
                "Statistics in three styles: TV, LCD screen or game manual",
                "135 trophies, including a platinum",
                "“Your year in games” summary",
                "A header LCD with a console-style boot animation — and a few secrets",
            ]),
        ],
        "looks_h": "SEVEN LOOKS",
        "looks_p": "Switch the whole app in Menu → Look. Inspired by period hardware, without any logos.",
        "themes": {
            "ps1": ("PS1", "Light grey plastic, △○✕□ buttons and a green LCD. The default look."),
            "ps2": ("PS2", "Deep blue fog, glass panels and towers in the background."),
            "lcd": ("LCD", "Four shades of green, pixel grid and duotone covers."),
            "crt": ("CRT", "A dark tube TV: phosphor glow and scanlines."),
            "dmg": ("GAME BOY", "The grey brick: navy italics, burgundy A/B, rounded corner."),
            "x360": ("XBOX 360", "The 2005 “Blades” dashboard: glossy panels and green blades."),
            "w95": ("WIN 95", "Teal desktop, bevelled grey windows, navy title bars."),
        },
        "secret_tab": "???",
        "secret_desc": "Some things have to be unlocked.",
        "secret_txt": "LOCKED", "secret_small": "↑ ↑ ↓ ↓ ← → ← → B A",
        "phones_h": "ON YOUR PHONE",
        "phones_p": "Works in the browser and can be added to the home screen like an app. With HTTPS in your home network the serial number scanner runs right inside the app.",
        "phones": [("m_ps1", "PS1"), ("m_detail", "Game details"), ("m_x360", "Xbox 360"), ("m_dmg", "Game Boy"), ("m_w95", "Windows 95")],
        "gal_h": "A CLOSER LOOK",
        "gallery": [
            ("series", "Series collections", "Owned in colour, missing greyed out — one click to the wishlist."),
            ("trophies", "Trophies", "135 of them, bronze to platinum, with pop-ups like on a console."),
            ("stats", "Statistics", "Value over time, per console, per category and by status."),
            ("wrapped", "Your year in games", "What you bought, spent and finished — slide by slide."),
            ("theme_crt", "CRT look", "Phosphor and scanlines for the whole app."),
            ("theme_w95", "Windows 95 look", "Because why not."),
        ],
        "zoom": "Enlarge",
        "inst_h": "INSTALL IN 3 STEPS",
        "inst_p": "You need any machine with Docker: a Raspberry Pi, an old thin client, a NAS or a home server.",
        "steps": [
            ("1. Start the container", "One command, x86-64 or ARM64:"),
            ("2. Get the setup code", "The container prints a one-time code, so only someone with access to the server can finish the install:"),
            ("3. Open the setup wizard", "Go to <code>http://&lt;server-address&gt;:8080</code>. The wizard asks for a password, free <a href=\"https://dev.twitch.tv/console\">IGDB keys</a> (required) and <a href=\"https://developer.ebay.com/\">eBay keys</a> (optional). Every key is checked before it's saved."),
        ],
        "cmt_code": "# shows the setup code",
        "copy": "Copy", "copied": "Copied",
        "compose_note": "Prefer Docker Compose, updates, backups or HTTPS for the phone camera? Everything is in the <a href=\"" + REPO + "#readme\">README</a>.",
        "faq_h": "FAQ",
        "faq": [
            ("Is it really free?", "Yes. It's open source under the GNU AGPL-3.0. The one extra condition: the author credit in the “About” dialog has to stay in every copy and modified version (details in NOTICE)."),
            ("Where is my data?", "On your server, in a Docker volume. The app talks to IGDB, eBay and a few cover databases to fetch game data, but your collection is never uploaded anywhere."),
            ("Do I need API keys?", "IGDB keys are required and free (a Twitch developer account). eBay keys are optional and only used for suggested prices; you can add them later in Menu → Tools."),
            ("Can I use it outside my home?", "It's built for your home network. Don't expose it directly to the internet; if you need remote access, use your own VPN."),
            ("What does it run on?", "Anything that runs Docker on x86-64 or ARM64. It's light enough for a Raspberry Pi or an old thin client."),
            ("Is this affiliated with Sony, Microsoft or Nintendo?", "No. Console and game names belong to their owners, and the looks use no logos."),
        ],
        "foot_about": "Moja kolekcja (“My collection”) is a self-hosted library for physical games, consoles and accessories.",
        "foot_by": "Made by",
        "foot_lic": "Free and open source under GNU AGPL-3.0 with additional terms (the author credit must stay).",
        "foot_src": "Source code", "foot_coffee": "Buy me a coffee", "foot_notice": "Licence & credits",
        "foot_data": "Game data: IGDB (Twitch). Covers: ScreenScraper, LaunchBox Games Database, libretro. Hardware photos: Wikimedia Commons.",
        "close": "Close",
    },
    "pl": {
        "title": "Moja kolekcja — biblioteka fizycznych gier na własnym serwerze",
        "desc": "Spis fizycznych gier, konsol i akcesoriów: wartość, lista życzeń, wypożyczenia, trofea i siedem retro wyglądów. Darmowa, otwarta, jeden kontener Dockera na Twoim serwerze.",
        "brand": "MOJA KOLEKCJA",
        "nav": [("features", "Funkcje"), ("looks", "Wyglądy"), ("install", "Instalacja"), ("faq", "FAQ")],
        "lcd": ["BETA 1.0", "GRY · KONSOLE · AKCESORIA", "7 WYGLĄDÓW", "135 TROFEÓW", "DARMOWA I OTWARTA", "PRESS START"],
        "kicker": "WŁASNY SERWER · DARMOWA · OPEN SOURCE",
        "h1": "Twoja półka z grami, <em>w porządku</em>.",
        "lead": "Spis fizycznych gier, konsol i akcesoriów: co masz, ile to jest warte, co leży na kupce wstydu i komu pożyczyłeś GTA. Działa w jednym kontenerze Dockera na Twoim serwerze.",
        "cta_install": "✕ Instalacja", "cta_github": "○ GitHub", "cta_coffee": "□ Postaw mi kawę",
        "chips": ["Darmowa, AGPL-3.0", "1 kontener Dockera", "amd64 · arm64", "Polski i angielski", "Dane zostają w domu"],
        "hero_alt": "Ekran główny Mojej kolekcji z grami na PlayStation i szczegółami Metal Gear Solid",
        "hero_cap": ("WYGLĄD PS1", "BETA 1.0"),
        "feat_h": "CO POTRAFI",
        "feat_p": "Zrobione przez kolekcjonera dla kolekcjonerów fizycznych gier. Wszystko poniżej już działa.",
        "features": [
            ("tri", "△", "DODAWANIE I KATALOG", [
                "Dodawanie gry po tytule albo po numerze seryjnym z pudełka (np. SLES-00250)",
                "Skan numeru aparatem telefonu, z ustawieniem ostrości i przybliżeniem",
                "Okładki PAL z paskiem konsoli, w proporcjach prawdziwego pudełka",
                "Region, język okładki, wydania specjalne (Steelbook, kolekcjonerskie)",
                "Kompletność (pudełko, instrukcja, płyta), stan, zdjęcia własnej sztuki",
                "Oceny w gwiazdkach i statusy: do zagrania, gram, ukończona, porzucona",
            ]),
            ("cir", "○", "WARTOŚĆ", [
                "Sugerowana cena z ofert eBaya, przeliczona po kursie NBP",
                "Wykres wartości kolekcji w czasie",
                "PLN, EUR, USD, GBP, CHF, CZK",
                "Raport PDF z całą kolekcją, np. do ubezpieczenia",
            ]),
            ("crs", "✕", "KUPOWANIE I SPRZEDAŻ", [
                "Lista życzeń z ceną docelową i szybkim szukaniem w wybranych sklepach",
                "OLX, Allegro, eBay (.com/.de/.co.uk), Vinted, PriceCharting",
                "„Kupiłem” przenosi grę z listy życzeń do kolekcji",
                "Filtr „Duble”, gotowe ogłoszenie z paczką zdjęć",
                "Archiwum sprzedanych z zyskiem albo stratą",
            ]),
            ("sqr", "□", "GRANIE", [
                "Kupka wstydu (opcjonalna)",
                "„Co dziś zagrać?” — losowanie jak jednoręki bandyta",
                "Wypożyczenia z terminem i historią — widać, co jest po terminie",
            ]),
            ("tri", "△", "KOLEKCJONOWANIE", [
                "Serie: ile części Gran Turismo masz, a których brakuje",
                "Exclusive'y, czyli gry wydane tylko na daną konsolę",
                "Znajomi: wymiana „kodem kolekcji” i porównanie — bez serwera pośrodku",
            ]),
            ("cir", "○", "STATYSTYKI I ZABAWA", [
                "Statystyki w trzech stylach: telewizor, ekran LCD albo instrukcja",
                "135 trofeów jak na konsoli, łącznie z platyną",
                "Podsumowanie „Twój rok w grach”",
                "Ekranik LCD w nagłówku z animacją startu — i parę sekretów",
            ]),
        ],
        "looks_h": "SIEDEM WYGLĄDÓW",
        "looks_p": "Całą apkę przełączasz w Menu → Wygląd. Inspirowane sprzętem z epoki, bez żadnych logo.",
        "themes": {
            "ps1": ("PS1", "Jasnoszary plastik, przyciski △○✕□ i zielony ekran LCD. Wygląd domyślny."),
            "ps2": ("PS2", "Granatowa mgła, szklane panele i wieże w tle."),
            "lcd": ("LCD", "Cztery odcienie zieleni, siatka pikseli i okładki w dwóch kolorach."),
            "crt": ("KINESKOP", "Ciemny telewizor: poświata fosforu i linie skanowania."),
            "dmg": ("GAME BOY", "Szara „cegła”: granatowa kursywa, bordowe A/B, zaokrąglony róg."),
            "x360": ("XBOX 360", "Dashboard „Blades” z 2005 roku: błyszczące panele i zielone ostrza."),
            "w95": ("WIN 95", "Turkusowy pulpit, szare okna z fazą, granatowe paski tytułu."),
        },
        "secret_tab": "???",
        "secret_desc": "Niektóre rzeczy trzeba najpierw odblokować.",
        "secret_txt": "ZABLOKOWANE", "secret_small": "↑ ↑ ↓ ↓ ← → ← → B A",
        "phones_h": "NA TELEFONIE",
        "phones_p": "Działa w przeglądarce i można ją dodać do ekranu głównego jak apkę. Z HTTPS w domowej sieci skaner numerów seryjnych działa w oknie apki.",
        "phones": [("m_ps1", "PS1"), ("m_detail", "Karta gry"), ("m_x360", "Xbox 360"), ("m_dmg", "Game Boy"), ("m_w95", "Windows 95")],
        "gal_h": "Z BLISKA",
        "gallery": [
            ("series", "Kolekcje serii", "Posiadane w kolorze, brakujące wyszarzone — jednym kliknięciem na listę życzeń."),
            ("trophies", "Trofea", "135 sztuk, od brązu do platyny, z powiadomieniami jak na konsoli."),
            ("stats", "Statystyki", "Wartość w czasie, per konsola, per kategoria i według statusu."),
            ("wrapped", "Twój rok w grach", "Co kupiłeś, ile wydałeś i co ukończyłeś — slajd po slajdzie."),
            ("sale", "Sprzedaż", "Gotowy tytuł i opis ogłoszenia, zdjęcia w ZIP i linki do serwisów."),
            ("theme_crt", "Wygląd kineskop", "Fosfor i linie skanowania w całej apce."),
        ],
        "zoom": "Powiększ",
        "inst_h": "INSTALACJA W 3 KROKACH",
        "inst_p": "Wystarczy dowolny komputer z Dockerem: Raspberry Pi, stary terminal, NAS albo domowy serwer.",
        "steps": [
            ("1. Uruchom kontener", "Jedna komenda, x86-64 albo ARM64:"),
            ("2. Odczytaj kod instalacji", "Kontener wypisuje jednorazowy kod — instalację dokończy tylko ktoś z dostępem do serwera:"),
            ("3. Otwórz kreator", "Wejdź na <code>http://&lt;adres-serwera&gt;:8080</code>. Kreator zapyta o hasło, darmowe <a href=\"https://dev.twitch.tv/console\">klucze IGDB</a> (wymagane) i <a href=\"https://developer.ebay.com/\">klucze eBay</a> (opcjonalne). Każdy klucz jest sprawdzany przed zapisem."),
        ],
        "cmt_code": "# tu jest kod instalacji",
        "copy": "Kopiuj", "copied": "Skopiowano",
        "compose_note": "Docker Compose, aktualizacje, kopie zapasowe albo HTTPS dla aparatu w telefonie? Wszystko jest w <a href=\"" + REPO + "/blob/main/README.pl.md\">README</a>.",
        "faq_h": "FAQ",
        "faq": [
            ("Czy to naprawdę darmowe?", "Tak. Kod jest otwarty, na licencji GNU AGPL-3.0. Jedyny dodatkowy warunek: informacja o autorze w oknie „O aplikacji” musi zostać w każdej kopii i przeróbce (szczegóły w pliku NOTICE)."),
            ("Gdzie są moje dane?", "Na Twoim serwerze, w wolumenie Dockera. Apka łączy się z IGDB, eBayem i kilkoma bazami okładek, żeby pobrać dane o grach, ale Twoja kolekcja nigdzie nie jest wysyłana."),
            ("Czy potrzebuję kluczy API?", "Klucze IGDB są wymagane i darmowe (konto deweloperskie Twitcha). Klucze eBay są opcjonalne i służą tylko do sugerowanej ceny; dodasz je później w Menu → Narzędzia."),
            ("Czy mogę używać jej poza domem?", "Jest zrobiona do domowej sieci. Nie wystawiaj jej bezpośrednio do internetu; jeśli potrzebujesz dostępu z zewnątrz, użyj własnego VPN-a."),
            ("Na czym to działa?", "Na wszystkim, co uruchamia Dockera na x86-64 albo ARM64. Jest na tyle lekka, że wystarczy Raspberry Pi albo stary terminal."),
            ("Czy to projekt Sony, Microsoftu albo Nintendo?", "Nie. Nazwy konsol i gier należą do ich właścicieli, a wyglądy nie używają logo."),
        ],
        "foot_about": "Moja kolekcja to biblioteka fizycznych gier, konsol i akcesoriów na własnym serwerze.",
        "foot_by": "Autor",
        "foot_lic": "Darmowa i otwarta, na licencji GNU AGPL-3.0 z dodatkowym warunkiem (informacja o autorze musi zostać).",
        "foot_src": "Kod źródłowy", "foot_coffee": "Postaw mi kawę", "foot_notice": "Licencja i źródła",
        "foot_data": "Dane o grach: IGDB (Twitch). Okładki: ScreenScraper, LaunchBox Games Database, libretro. Zdjęcia sprzętu: Wikimedia Commons.",
        "close": "Zamknij",
    },
}


def page(lang: str) -> str:
    t = T[lang]
    base = "" if lang == "en" else "../"
    img = f"{base}img/{lang}/"
    url = SITE if lang == "en" else SITE + "pl/"
    other = "pl" if lang == "en" else "en"
    e = escape

    lcd = "".join(f"<span>{e(x)}</span>" for x in t["lcd"])
    nav = "".join(f'<a href="#{i}">{e(n)}</a>' for i, n in t["nav"])
    chips = "".join(f"<li>{e(c)}</li>" for c in t["chips"])
    feats = "".join(
        f'<article class="panel"><h3 class="phd"><span class="ic {c}" aria-hidden="true">{s}</span>{e(h)}</h3>'
        f'<div class="pbd"><ul>{"".join(f"<li>{e(x)}</li>" for x in items)}</ul></div></article>'
        for c, s, h, items in t["features"])
    tabs = "".join(
        f'<button type="button" role="tab" aria-selected="{str(k == "ps1").lower()}" data-src="{img}theme_{k}.webp" '
        f'data-alt="{e(t["themes"][k][0])}" data-desc="{e(t["themes"][k][1])}">{e(t["themes"][k][0])}</button>'
        for k in THEMES)
    tabs += (f'<button type="button" role="tab" aria-selected="false" class="locked" data-desc="{e(t["secret_desc"])}" '
             f'aria-label="{e(t["secret_desc"])}">{t["secret_tab"]}</button>')
    phones = "".join(
        f'<figure class="phone"><img src="{img}{f}.webp" width="390" height="844" loading="lazy" alt="{e(c)}"><figcaption>{e(c)}</figcaption></figure>'
        for f, c in t["phones"])
    gal = "".join(
        f'<figure><button type="button" data-zoom="{e(h)}" aria-label="{e(t["zoom"])}: {e(h)}">'
        f'<img src="{img}{f}.webp" width="1440" height="900" loading="lazy" alt="{e(h)}"></button>'
        f'<figcaption>{e(h)}<span>{e(d)}</span></figcaption></figure>'
        for f, h, d in t["gallery"])
    run_cmd = (f"docker run -d --name moja-kolekcja --restart unless-stopped \\\n"
               f"  -p 8080:8080 -p 8443:8443 -v kolekcja-data:/data \\\n  {IMAGE}")
    code1 = f'<div class="code"><pre>{e(run_cmd)}</pre><button type="button" class="btn light sm copy" data-ok="{t["copied"]}">{t["copy"]}</button></div>'
    code2 = (f'<div class="code"><pre>docker logs moja-kolekcja  <span class="c">{e(t["cmt_code"])}</span></pre>'
             f'<button type="button" class="btn light sm copy" data-ok="{t["copied"]}">{t["copy"]}</button></div>')
    steps = []
    for i, (h, p) in enumerate(t["steps"]):
        extra = code1 if i == 0 else code2 if i == 1 else ""
        steps.append(f'<article class="panel step"><div class="pbd"><h3>{e(h)}</h3><p>{p}</p>{extra}</div></article>')
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in t["faq"])

    return f"""<!doctype html>
<!-- Moja kolekcja — project site · © pozdromaciek · AGPL-3.0 with additional terms (NOTICE) · generated by tools/build_site.py -->
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(t["title"])}</title>
<meta name="description" content="{e(t["desc"])}">
<meta name="author" content="pozdromaciek">
<meta name="theme-color" content="#6b6a70">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{SITE}">
<link rel="alternate" hreflang="pl" href="{SITE}pl/">
<link rel="alternate" hreflang="x-default" href="{SITE}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(t["title"])}">
<meta property="og:description" content="{e(t["desc"])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}img/og.jpg">
<meta property="og:locale" content="{"en_GB" if lang == "en" else "pl_PL"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{base}assets/icon.svg">
<link rel="preload" href="{base}assets/fonts/exo-2-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{base}assets/site.css">
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="logo" href="#top">{e(t["brand"])}</a>
    <span class="sym" aria-hidden="true"><b>△</b><b>○</b><b>✕</b><b>□</b></span>
    <span class="vents" aria-hidden="true"></span>
    <nav class="nav" aria-label="Menu">{nav}</nav>
    <div class="lang" role="group" aria-label="Language / Język">
      <a href="{base}index.html" hreflang="en" lang="en"{' aria-current="page"' if lang == "en" else ""}>EN</a>
      <a href="{base}pl/index.html" hreflang="pl" lang="pl"{' aria-current="page"' if lang == "pl" else ""}>PL</a>
    </div>
  </div>
</header>

<main id="top">
  <section class="hero">
    <div class="wrap grid">
      <div>
        <p class="kicker">{e(t["kicker"])}</p>
        <h1>{t["h1"]}</h1>
        <p class="lead">{e(t["lead"])}</p>
        <div class="ctas">
          <a class="btn crs" href="#install">{e(t["cta_install"])}</a>
          <a class="btn cir" href="{REPO}">{e(t["cta_github"])}</a>
          <a class="btn sqr" href="{COFFEE}">{e(t["cta_coffee"])}</a>
        </div>
        <ul class="chips">{chips}</ul>
      </div>
      <figure class="screen">
        <div class="lcdwrap" aria-hidden="true"><span class="led"></span><div class="lcd"><div class="run">{lcd}{lcd}</div></div></div>
        <img src="{img}theme_ps1.webp" width="1440" height="900" alt="{e(t["hero_alt"])}" style="margin-top:10px">
        <figcaption class="cap"><span>{e(t["hero_cap"][0])}</span><span>{e(t["hero_cap"][1])}</span></figcaption>
      </figure>
    </div>
  </section>

  <section id="features">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["feat_h"])}</h2><p>{e(t["feat_p"])}</p></div></div>
      <div class="feat">{feats}</div>
    </div>
  </section>

  <section id="looks">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["looks_h"])}</h2><p>{e(t["looks_p"])}</p></div></div>
      <div class="tabs" role="tablist" aria-label="{e(t["looks_h"])}">{tabs}</div>
      <div class="screen">
        <img id="themeImg" src="{img}theme_ps1.webp" width="1440" height="900" alt="PS1" loading="lazy">
        <div id="themeSecret" class="secret" hidden><div>{e(t["secret_txt"])}<small>{e(t["secret_small"])}</small></div></div>
      </div>
      <p id="themeDesc" class="themedesc" aria-live="polite">{e(t["themes"]["ps1"][1])}</p>
    </div>
  </section>

  <section id="phone">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["phones_h"])}</h2><p>{e(t["phones_p"])}</p></div></div>
      <div class="phones">{phones}</div>
    </div>
  </section>

  <section id="gallery">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["gal_h"])}</h2></div></div>
      <div class="gallery">{gal}</div>
    </div>
  </section>

  <section id="install">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["inst_h"])}</h2><p>{e(t["inst_p"])}</p></div></div>
      <div class="steps">{"".join(steps)}</div>
      <p class="note">{t["compose_note"]}</p>
    </div>
  </section>

  <section id="faq" class="faq">
    <div class="wrap">
      <div class="shd"><div><h2>{e(t["faq_h"])}</h2></div></div>
      {faq}
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <div>
      <p><b>{e(t["brand"])}</b> · Beta 1.0</p>
      <p class="small">{e(t["foot_about"])}</p>
      <p class="small">{e(t["foot_data"])}</p>
    </div>
    <div>
      <p>{e(t["foot_by"])}: <a href="https://github.com/pozdromaciek">pozdromaciek</a></p>
      <p><a href="{REPO}">{e(t["foot_src"])}</a> · <a href="{REPO}/blob/main/NOTICE">{e(t["foot_notice"])}</a> · <a href="{COFFEE}">{e(t["foot_coffee"])}</a></p>
      <p class="small">© 2026 pozdromaciek. {e(t["foot_lic"])}</p>
    </div>
  </div>
</footer>

<dialog id="lb" class="lb" aria-label="{e(t["zoom"])}">
  <button type="button" class="btn light sm x">✕ {e(t["close"])}</button>
  <img src="" alt=""><p></p>
</dialog>
<script src="{base}assets/site.js"></script>
</body>
</html>
"""


def main() -> None:
    docs = ROOT / "docs"
    (docs / "pl").mkdir(parents=True, exist_ok=True)
    (docs / "index.html").write_text(page("en"), encoding="utf-8")
    (docs / "pl" / "index.html").write_text(page("pl"), encoding="utf-8")
    (docs / ".nojekyll").write_text("")
    print("docs/index.html, docs/pl/index.html")


if __name__ == "__main__":
    main()
