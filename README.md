# Moja kolekcja — a self-hosted library for your physical games

**[Polski opis → README.pl.md](README.pl.md)**

Keep track of your physical games, consoles and accessories: what you own, what it's worth, what's still on the
pile of shame and who borrowed your copy of GTA. Runs in a single Docker container on your own server (a Raspberry Pi,
an old thin client, a NAS); your collection stays on it.

> **Beta 1.0**. Everything described here works, but expect rough edges. Bug reports are welcome in Issues.

![Main screen](docs/screenshots/main.jpg)

## Features

**Adding and cataloguing**
- Add a game by title or by the serial number on the box (e.g. `SLES-00250`). The in-app scanner reads the serial
  with the phone camera, with tap-to-focus and zoom.
- Games, consoles and accessories in one place, with photos and PAL covers.
- Covers show the console spine and use the real case proportions.
- Region, cover language, serial number and special editions (Steelbook, collector's editions).
- Completeness (box, manual, disc), condition, and photos of your own copy (GPS data is stripped).
- Star ratings and statuses: backlog, playing, completed, dropped.

**Value**
- Suggested price from eBay listings, converted at the Polish central bank (NBP) rate.
- A chart of your collection's value over time.
- Currencies: PLN, EUR, USD, GBP, CHF, CZK.
- A PDF report of the whole collection, e.g. for insurance.

**Buying and selling**
- Wishlist with target prices and quick search in the shops you pick: OLX, Allegro, eBay (.com/.de/.co.uk),
  Vinted, PriceCharting.
- A “Bought it” button moves a game from the wishlist into the collection.
- A duplicates filter.
- Selling: a ready-made listing text and a ZIP of photos, then a sold archive with profit or loss.

**Playing**
- Pile of shame (optional).
- “What to play today?”: picks a game from the pile, slot-machine style.
- Loans with due dates and history, plus a list of what's overdue.

**Collecting**
- Series collections: how many Gran Turismo games you have and which are missing.
- Platform exclusives.
- Friends: swap “collection codes” and compare collections, with no server in between.

**Statistics and fun**
- Statistics in three styles: TV, LCD screen or game manual.
- 135 trophies, including a platinum.
- A “Your year in games” summary.
- An LCD screen in the header with a console-style boot animation.
- Seven looks: PS1, PS2, Game Boy, Xbox 360, Windows 95, LCD and CRT. Plus a few secrets.

**Technical**
- Works in the browser on desktop and phone, and can be added to the home screen like an app.
- Polish and English interface.
- HTTPS in your home network with its own local certificate. The CA can only sign private addresses, so it can't be
  used to fake any site on the internet.
- Nightly backup, CSV/JSON export and restore.

![Seven looks](docs/screenshots/themes.jpg)

## Installation

You need a machine with Docker (x86-64 or ARM64).

### Docker Compose (recommended)

```bash
mkdir moja-kolekcja && cd moja-kolekcja
curl -O https://raw.githubusercontent.com/pozdromaciek/game-lib-sh/main/docker-compose.yml
docker compose up -d
docker logs moja-kolekcja        # shows the setup code
```

### Docker only

```bash
docker run -d --name moja-kolekcja --restart unless-stopped \
  -p 8080:8080 -p 8443:8443 -v kolekcja-data:/data \
  ghcr.io/pozdromaciek/game-lib-sh:latest
docker logs moja-kolekcja        # shows the setup code
```

### First run

Open `http://<server-address>:8080`. The setup wizard asks for:

1. **The setup code** from `docker logs moja-kolekcja`. This means only someone with access to the server can finish
   the install.
2. **A password** for the app (at least 8 characters, stored only as a scrypt hash).
3. **IGDB keys** (required, free). IGDB is Twitch's game database. Sign in at
   [dev.twitch.tv/console](https://dev.twitch.tv/console) → *Register Your Application* (any name, redirect URL
   `http://localhost`, category *Application Integration*, client type *Confidential*) → *Manage* → copy the
   *Client ID* and generate a *Client Secret*.
4. **eBay keys** (optional, can be skipped) for suggested prices. Get them at [developer.ebay.com](https://developer.ebay.com/)
   → *Application Keys* → a **Production** keyset (*App ID* and *Cert ID*).

The wizard checks each key against the real service before saving it. You can add or change keys (including optional
[ScreenScraper](https://www.screenscraper.fr/) keys for region-specific covers) and the password later in
**Menu → Tools**.

![Setup wizard](docs/screenshots/setup.jpg)

### Configuration via `.env` (optional)

Everything can also be set with environment variables; see [`.env.example`](.env.example). A value set in the
environment takes precedence and can't be changed from the app. Existing installs that use `.env` keep working and
skip the wizard.

## Updating

```bash
docker compose pull && docker compose up -d
```

Your data lives in the `kolekcja-data` volume (`/data`). Database migrations run automatically.

## HTTPS and the phone camera

Browsers only allow the camera inside a page over HTTPS. The container serves HTTPS on port 8443 with a certificate
from its own local CA. Install that CA once on your phone (Menu → Tools → Secure connection has step-by-step
instructions for Android, iPhone and desktop), then open `https://<server-address>:8443`.

The CA is limited with critical *Name Constraints* to private IP ranges and `.lan`, `.local`, `.home.arpa`,
`.internal` and `localhost`, so even a leaked key can't be used to impersonate public websites.

## Backups

A ZIP with the database, covers and photos is created every night in `/data/backups` (14 copies by default).
Menu → Tools also has CSV export, JSON backup and restore. To keep a copy on another disk, mount a directory into the
container and set `BACKUP_COPY_DIR`.

## Building from source

```bash
git clone https://github.com/pozdromaciek/game-lib-sh.git && cd game-lib-sh
docker build -t moja-kolekcja .
```

Stack: FastAPI, SQLite, vanilla JS/CSS (no frameworks, no CDNs; fonts are bundled), Tesseract for OCR,
ReportLab for PDFs.

## Licence

Copyright © 2026 [pozdromaciek](https://github.com/pozdromaciek).

Free and open source under the **GNU AGPL-3.0** ([LICENSE](LICENSE)) with **additional terms** under section 7
([NOTICE](NOTICE)):

- the author credit (pozdromaciek + links to the profile and this repository) must stay visible in the app's “About”
  dialog in every copy and modified version, including ones offered over a network;
- modified versions must be marked as changed and must not pretend to be the original;
- the author's name may not be used to promote modified versions without permission.

In short: you can use, share and modify it for free, but you keep the credit, and if you run a modified version for
others you share its source under the same licence.

## Support

If you like the project, you can [buy me a coffee ☕](https://buycoffee.to/pozdromaciek). Thanks!

## Credits and data sources

Game data: [IGDB](https://www.igdb.com/) (Twitch). Covers: ScreenScraper, LaunchBox Games Database,
libretro-thumbnails. Serial numbers: Redump and No-Intro (libretro-database). Hardware photos: Wikimedia Commons
(including Evan-Amos). Exchange rates: Narodowy Bank Polski. Fonts (SIL OFL): Exo 2, Press Start 2P, VT323,
Open Sans, Nunito.

Console and game names belong to their owners. The looks are inspired by period hardware and use no logos.
This project is not affiliated with Sony, Microsoft, Nintendo, eBay or Twitch.
