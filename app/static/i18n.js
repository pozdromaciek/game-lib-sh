/* SPDX-License-Identifier: AGPL-3.0-only · Copyright (C) 2026 pozdromaciek — https://github.com/pozdromaciek/game-lib-sh (additional terms: NOTICE) */
'use strict';
// ================= wersja angielska interfejsu =================
// Tłumaczenie na poziomie DOM: teksty i atrybuty (placeholder, title, aria-label) są podmieniane według słownika.
// Liczby i daty w tekstach zamieniamy na {n}/{d}, tłumaczymy szablon i wstawiamy liczby z powrotem.
// Treści użytkownika (tytuły gier, notatki, nazwy kolekcji) nie są tłumaczone — oznaczone klasą lub [data-notr].
(function () {
  let lang = 'pl';
  try { lang = localStorage.getItem('appLang') === 'en' ? 'en' : 'pl'; } catch { /* brak storage */ }
  window.APP_LANG = lang;
  if (lang !== 'en') return;
  document.documentElement.lang = 'en';

  const E = {
    // --- nagłówek, menu ---
    'MOJA KOLEKCJA': 'MY COLLECTION', 'Moja kolekcja': 'My collection', 'Moja kolekcja – logowanie': 'My collection – sign in',
    '+ Dodaj': '+ Add', 'Menu': 'Menu', 'Wygląd': 'Theme', 'Język': 'Language', 'Wygląd apki': 'App theme',
    'Statystyki': 'Statistics', 'Kolekcje': 'Collections', 'Co dziś zagrać?': 'What to play today?', 'Trofea': 'Trophies',
    'Znajomi': 'Friends', 'Udostępnij moją kolekcję…': 'Share my collection…', 'Ustawienia…': 'Settings…',
    'Eksport CSV': 'Export CSV', 'Backup JSON': 'Backup JSON', 'Przywróć z backupu…': 'Restore from backup…',
    'Odśwież bazę okładek LaunchBox': 'Refresh LaunchBox cover database', 'Wyloguj': 'Sign out',
    'Statystyki kolekcji — otwórz': 'Collection statistics — open', 'Statystyki': 'Statistics',
    'GRY {n}': 'GAMES {n}', 'KONSOLE {n}': 'CONSOLES {n}', 'AKCESORIA {n}': 'ACCESSORIES {n}', 'WARTOŚĆ {n} ZŁ': 'VALUE {n} PLN',
    'Hasło': 'Password', '✕ Zaloguj': '✕ Sign in', 'Złe hasło': 'Wrong password',
    // --- lewa kolumna ---
    'Lista życzeń': 'Wishlist', 'Kupka wstydu': 'Pile of shame', 'Wypożyczone': 'Lent out', 'KONSOLE': 'CONSOLES',
    'STATUS': 'STATUS', 'INNE': 'OTHER', 'KOMPLETNOŚĆ': 'COMPLETENESS', 'Wszystkie': 'All', 'Inne': 'Other',
    'Do zagrania': 'Backlog', 'Gram': 'Playing', 'Ukończona': 'Completed', 'Porzucona': 'Dropped',
    'Ukończone': 'Completed', 'Porzucone': 'Dropped', 'Pozostałe': 'Remaining',
    'Okładka PL': 'Cover PL', 'Okładka EN': 'Cover EN', 'Okładka DE': 'Cover DE', 'Okładka FR': 'Cover FR', 'Okładka Multi': 'Cover Multi',
    'Wydanie specjalne': 'Special edition', 'Wypożyczona': 'Lent out', 'CIB': 'CIB', 'Bez instrukcji': 'No manual', 'Luzem': 'Loose',
    'Bez płyty': 'No disc', 'Komplet': 'Complete', 'W pudełku': 'Boxed', 'Bez pudełka': 'No box',
    // --- środek ---
    'WSZYSTKIE': 'ALL', 'LISTA ŻYCZEŃ': 'WISHLIST', 'KUPKA WSTYDU': 'PILE OF SHAME', 'WYPOŻYCZONE': 'LENT OUT', 'INNE': 'OTHER',
    'Sortowanie': 'Sorting', 'Sortuj: A–Z': 'Sort: A–Z', 'Sortuj: rok': 'Sort: year', 'Sortuj: ostatnio dodane': 'Sort: recently added',
    'Sortuj: wartość': 'Sort: value', 'Szukaj…': 'Search…', 'Szukaj': 'Search', 'Gry': 'Games', 'Konsole': 'Consoles', 'Akcesoria': 'Accessories',
    'Gry {n}': 'Games {n}', 'Konsole {n}': 'Consoles {n}', 'Akcesoria {n}': 'Accessories {n}',
    '{n} gra': '{n} game', '{n} gry': '{n} games', '{n} gier': '{n} games', '{n} pozycja': '{n} item', '{n} pozycje': '{n} items', '{n} pozycji': '{n} items',
    '{n} zł': '{n} PLN', 'cel {n} zł': 'target {n} PLN', 'po terminie: {n}': 'overdue: {n}', 'leżą średnio: {n} dni': 'waiting on average: {n} days',
    'leżą średnio: {n} dzień': 'waiting on average: {n} day', 'leżą średnio: od dziś': 'waiting on average: since today',
    'Kolekcja jest pusta — kliknij „+ Dodaj”.': 'The collection is empty — click “+ Add”.', 'Nic nie pasuje do filtrów.': 'Nothing matches the filters.',
    'Kupka wstydu jest pusta. Szacun.': 'The pile of shame is empty. Respect.',
    'Lista życzeń jest pusta — „+ Dodaj” i przełącz „Lista życzeń”.': 'The wishlist is empty — “+ Add” and switch on “Wishlist”.',
    // --- panel szczegółów ---
    'SZCZEGÓŁY': 'DETAILS', 'Wybierz coś z kolekcji.': 'Pick something from the collection.', 'Zamknij': 'Close',
    'Kompletność': 'Completeness', 'Kupiona': 'Bought', 'Wartość': 'Value', 'Stan pudełka': 'Box condition', 'brak pudełka': 'no box',
    'Model': 'Model', 'Typ': 'Type', 'Do konsoli': 'For console', 'Wydanie': 'Edition', 'Ocena': 'Rating', 'Notatki': 'Notes', 'Numer seryjny': 'Serial number',
    'wycena z {d}': 'valued on {d}', 'Cena docelowa': 'Target price', 'Okładka': 'Cover', 'Na liście od': 'On list since',
    'Płyta A': 'Disc A', 'Płyta B': 'Disc B', 'Płyta C': 'Disc C', 'Stan A': 'Condition A', 'Stan B': 'Condition B', 'Stan C': 'Condition C',
    'Niesprawna': 'Not working', 'Gra': 'Game', 'Konsola': 'Console', 'Akcesorium': 'Accessory',
    '✕ Edytuj': '✕ Edit', '□ Wypożycz': '□ Lend', '□ Oddana': '□ Returned', '△ Zmień okładkę': '△ Change cover',
    '△ Zdjęcie automatyczne': '△ Automatic photo', 'Usuń': 'Delete', '✓ Kupiłem': '✓ Bought it', 'Zdejmij z kupki': 'Remove from pile',
    'Na kupkę wstydu': 'To the pile of shame', 'Historia wypożyczeń': 'Loan history', 'Jeszcze nikomu nie pożyczana.': 'Never lent to anyone yet.',
    'nadal': 'still out', '□ Wypożyczona:': '□ Lent to:', 'po terminie': 'overdue', 'Kupka wstydu · {n} dni': 'Pile of shame · {n} days',
    'Kupka wstydu · {n} dzień': 'Pile of shame · {n} day', 'Kupka wstydu · od dziś': 'Pile of shame · since today',
    'od {d} ({n} dni)': 'since {d} ({n} days)', 'oddać do: {d}': 'due: {d}',
    'Szukaj na OLX ↗': 'Search on OLX ↗', 'Szukaj na Allegro ↗': 'Search on Allegro ↗',
    'Zdjęcia egzemplarza': 'Photos of your copy', '+ Dodaj ': '+ Add', 'Brak — dodaj zdjęcia pudełka, płyty albo wad (np. z telefonu).': 'None yet — add photos of the box, disc or flaws (e.g. from your phone).',
    // --- formularz ---
    'DODAJ': 'ADD', 'DODAJ DO KOLEKCJI': 'ADD TO COLLECTION', 'DODAJ DO LISTY ŻYCZEŃ': 'ADD TO WISHLIST', 'EDYTUJ': 'EDIT',
    'EDYTUJ — LISTA ŻYCZEŃ': 'EDIT — WISHLIST', 'KUPIŁEM!': 'BOUGHT IT!', 'Zapisz jako rzecz, którą chcesz kupić': 'Save as something you want to buy',
    'Tytuł gry…': 'Game title…', 'Tytuł gry': 'Game title', 'Ręcznie': 'Manually', '← Szukaj': '← Search', 'Anuluj': 'Cancel', 'Zapisz': 'Save',
    'Wybierz konsolę i wpisz tytuł albo numer seryjny z grzbietu pudełka (np. SLES-02605).': 'Pick a console and type a title — or a serial number from the box spine (e.g. SLES-02605).',
    'Szukam…': 'Searching…', 'Nic nie znaleziono — spróbuj angielskiej nazwy albo dodaj ręcznie.': 'Nothing found — try the English title or add manually.',
    'Brak kluczy IGDB — wyszukiwanie w bazie LaunchBox.': 'No IGDB keys — searching the LaunchBox database.',
    'Wgraj okładkę / zdjęcie': 'Upload cover / photo', 'Szukaj okładek': 'Find covers', 'Szukaj zdjęć': 'Find photos', 'Zdjęcie automatyczne': 'Automatic photo',
    'Pasek konsoli na okładce': 'Console band on cover', 'Brak zdjęcia': 'No photo', 'Okładki ({n})': 'Covers ({n})', 'Zdjęcia ({n})': 'Photos ({n})',
    'wydanie': 'release',
    'Nazwa': 'Title', 'Konsola / platforma': 'Console / platform', 'Region': 'Region', 'Język okładki': 'Cover language', 'Rok wydania': 'Release year',
    'Gatunki': 'Genres', 'Wpisz wydanie': 'Type the edition', 'Inne…': 'Other…', 'Inne (oddziel przecinkami)': 'Other (comma separated)',
    'np. pad, karta pamięci': 'e.g. controller, memory card', 'np. SCPH-7002, Slim 250 GB': 'e.g. SCPH-7002, Slim 250 GB', 'np. DualShock SCPH-1200': 'e.g. DualShock SCPH-1200',
    'np. SLES-02605 (grzbiet pudełka)': 'e.g. SLES-02605 (box spine)', 'Płyta / kartridż': 'Disc / cartridge', 'Sprawna': 'Working', 'Pudełko': 'Box',
    'Instrukcja': 'Manual', 'Instrukcja / papiery': 'Manual / papers', 'Stan płyty': 'Disc condition', 'Stan płyty / kartridża': 'Disc / cartridge condition',
    'Stan wizualny': 'Visual condition', 'A – jak nowa': 'A – like new', 'B – lekkie ślady': 'B – light wear', 'C – wyraźne ślady': 'C – heavy wear',
    'A – jak nowe': 'A – like new', 'C – zniszczone': 'C – damaged', 'Status': 'Status', 'brak oceny': 'no rating', 'Cena zakupu (zł)': 'Purchase price (PLN)',
    'Wartość (zł)': 'Value (PLN)', 'Data zakupu': 'Purchase date', 'Na kupce wstydu': 'On the pile of shame', 'Cena docelowa (zł)': 'Target price (PLN)',
    'ile chcesz zapłacić max': 'max you want to pay', 'Wydanie specjalne': 'Special edition', 'Obwoluta': 'Slipcover', 'Edycja kolekcjonerska': 'Collector’s edition',
    'Limitowana': 'Limited', 'Mapa / plakat': 'Map / poster', 'Kompletność ': 'Completeness', 'Premierowe': 'Launch', 'Seria budżetowa': 'Budget series',
    'Edycja kompletna / Definitive': 'Complete / Definitive edition', 'Game of the Year': 'Game of the Year',
    'Pad': 'Controller', 'Karta pamięci': 'Memory card', 'Kierownica': 'Steering wheel', 'Pistolet': 'Light gun', 'Kabel AV / RGB': 'AV / RGB cable',
    'Zasilacz': 'Power supply', 'Kamera': 'Camera', 'Mikrofon': 'Microphone', 'Słuchawki': 'Headset', 'Pilot': 'Remote', 'Ładowarka': 'Charger',
    'Przejściówka': 'Adapter', 'Nakładka / etui': 'Shell / case',
    'Sugeruj cenę': 'Suggest price', 'oferty eBay (DE / UK / PL) + linki do sprawdzenia': 'eBay listings (DE / UK / PL) + links to check',
    'Szukam ofert…': 'Looking for listings…', 'SUGEROWANA': 'SUGGESTED', 'Sprawdź sam:': 'Check yourself:', 'eBay.de — sprzedane': 'eBay.de — sold',
    'eBay.co.uk — sprzedane': 'eBay.co.uk — sold', 'Oferty ({n})': 'Listings ({n})', 'Wstaw do „Wartość”': 'Put into “Value”', 'Wstaw do „Cena docelowa”': 'Put into “Target price”',
    'Zapytanie: „': 'Query: “', 'oferty → realna sprzedaż': 'listings → real sale', 'bez instrukcji': 'no manual', 'bez pudełka': 'no box', 'bez płyty/kartridża': 'no disc/cartridge',
    'Automatyczna wycena wymaga darmowych kluczy eBay (Menu → Narzędzia → Klucze API).': 'Automatic pricing needs free eBay keys (Menu → Tools → API keys).',
    'Brak pasujących ofert — sprawdź ręcznie w linkach poniżej.': 'No matching listings — check manually with the links below.',
    'Mało ofert — traktuj wynik orientacyjnie.': 'Few listings — treat the result as a rough guide.',
    // --- wypożyczenie ---
    'WYPOŻYCZ': 'LEND', 'Komu': 'To whom', 'Od kiedy': 'Since', 'Oddać do (opcjonalnie)': 'Due (optional)', 'Notatka': 'Note',
    'Oddana — wraca na półkę': 'Returned — back on the shelf',
    // --- ustawienia ---
    'USTAWIENIA': 'SETTINGS', 'Gry kupione i nieruszone. Po włączeniu: przycisk w grze, lista nad konsolami, znacznik na okładce i kafelek w statystykach. Wyłączenie tylko ukrywa — nic nie jest kasowane.':
      'Games bought and never touched. When on: a button on the game, a list above the consoles, a badge on the cover and a stats tile. Turning it off only hides it — nothing is deleted.',
    'Backup automatyczny': 'Automatic backup', 'Zrób teraz': 'Back up now', 'Robię…': 'Working…', 'Jeszcze nie było backupu.': 'No backup yet.',
    'Codziennie po {n}:{n} — baza, okładki i zdjęcia w jednym pliku ZIP. Trzymam {n} ostatnich.': 'Daily after {n}:{n} — database, covers and photos in one ZIP file. Keeping the last {n}.',
    'Codziennie po {n}:{n} — baza, okładki i zdjęcia w jednym pliku ZIP. Trzymam {n} ostatnich + kopia na dodatkowy dysk.': 'Daily after {n}:{n} — database, covers and photos in one ZIP file. Keeping the last {n} + a copy on an extra disk.',
    'Zapisano ustawienia': 'Settings saved', 'Backup: sprawdzam…': 'Backup: checking…', 'Backup gotowy ({n} MB)': 'Backup ready ({n} MB)',
    // --- statystyki ---
    'STATYSTYKI': 'STATISTICS', 'Telewizor': 'TV', 'Ekran LCD': 'LCD screen', 'Instrukcja': 'Manual', '← Kolekcja': '← Collection',
    'GRY': 'GAMES', 'KONSOLE': 'CONSOLES', 'AKCESORIA': 'ACCESSORIES', 'WARTOŚĆ': 'VALUE', 'BILANS': 'BALANCE', 'UKOŃCZONE': 'COMPLETED', 'GRAM': 'PLAYING',
    'DO ZAGRANIA': 'BACKLOG', 'PORZUCONE': 'DROPPED', 'ŚREDNIA OCENA': 'AVERAGE RATING', 'WYDANIA SPECJALNE': 'SPECIAL EDITIONS', 'NAJCENNIEJSZA GRA': 'MOST VALUABLE GAME',
    '{n} CIB ({n}%)': '{n} CIB ({n}%)', 'wydane {n} zł': 'spent {n} PLN', '{n}% gier': '{n}% of games', 'wszystko w terminie': 'all on time', '{n} po terminie': '{n} overdue',
    'brak ocen': 'no ratings', 'pusto — szacun': 'empty — respect', 'wartość − cena, {n} pozycja z obiema': 'value − price, {n} item with both',
    'wartość − cena, {n} pozycje z obiema': 'value − price, {n} items with both', 'wartość − cena, {n} pozycji z obiema': 'value − price, {n} items with both',
    '{n} / {n} · {n} ocena': '{n} / {n} · {n} rating', '{n} / {n} · {n} oceny': '{n} / {n} · {n} ratings', '{n} / {n} · {n} ocen': '{n} / {n} · {n} ratings',
    'WARTOŚĆ PER KONSOLA': 'VALUE PER CONSOLE', 'gry, konsole i akcesoria': 'games, consoles and accessories', 'WARTOŚĆ PER KATEGORIA': 'VALUE PER CATEGORY',
    'ile jest warta każda część': 'what each part is worth', 'GRY WG STATUSU': 'GAMES BY STATUS', 'GRY PER KONSOLA': 'GAMES PER CONSOLE',
    'ukończone i pozostałe': 'completed and remaining', 'WYDATKI PER ROK': 'SPENDING PER YEAR', 'suma cen zakupu wg daty zakupu': 'purchase prices by purchase date',
    'WARTOŚĆ W CZASIE': 'VALUE OVER TIME', 'od {d} · wydane vs wartość': 'since {d} · spent vs value', 'wartość': 'value', 'wydane': 'spent',
    'Tabela': 'Table', 'Konsola ': 'Console', 'Razem': 'Total', 'Kategoria': 'Category', 'Sztuk': 'Count', 'Udział': 'Share', 'Rok': 'Year', 'Wydane': 'Spent',
    'Dzień': 'Day', 'Pozycji': 'Items', 'Za mało danych — uzupełnij wartości w kolekcji.': 'Not enough data — fill in values in your collection.',
    'Wartość: {n} zł': 'Value: {n} PLN', 'Wydane: {n} zł': 'Spent: {n} PLN', 'Pozycji: {n}': 'Items: {n}', 'Razem: {n} zł': 'Total: {n} PLN',
    // --- kolekcje ---
    'KOLEKCJE': 'COLLECTIONS', '+ Nowa kolekcja': '+ New collection', '← Wróć': '← Back', '← Kolekcje': '← Collections', 'Dowolna platforma': 'Any platform',
    'Rodzina PlayStation': 'PlayStation family', 'Rodzina Xbox': 'Xbox family', 'Rodzina Nintendo': 'Nintendo family', 'Rodzina Sega': 'Sega family', 'Rodzina PC': 'PC family',
    'Wszystkie {n}': 'All {n}', 'Mam {n}': 'Owned {n}', 'Brakuje {n}': 'Missing {n}', 'Opcje': 'Options', 'Edytuj…': 'Edit…', 'Odśwież z IGDB': 'Refresh from IGDB',
    'Usuń kolekcję': 'Delete collection', 'BRAK': 'MISSING', '★ na liście': '★ on wishlist', 'Dodaj do listy życzeń na:': 'Add to wishlist for:',
    'brak znanych platform': 'no known platforms', 'Nic tu nie ma.': 'Nothing here.', 'NOWA KOLEKCJA': 'NEW COLLECTION', 'EDYTUJ KOLEKCJĘ': 'EDIT COLLECTION',
    'np. Grand Theft Auto': 'e.g. Grand Theft Auto', 'Platformy': 'Platforms', 'Dowolna': 'Any', 'Rodzina': 'Family', 'Jedna platforma': 'One platform',
    'Masz grę na którejkolwiek pasującej platformie = masz tę część.': 'Own the game on any matching platform = you own that entry.',
    'Uwzględnij': 'Include', 'Główne gry': 'Main games', 'Rozszerzenia / samodzielne dodatki': 'Expansions / standalone add-ons', 'DLC': 'DLC', 'Składanki': 'Bundles',
    "Remastery / remake'i": 'Remasters / remakes', 'zaliczają oryginał (wystarczy jedna wersja)': 'count for the original (one version is enough)',
    'osobne pozycje': 'separate entries', 'pomiń': 'skip', 'Gry w kolekcji': 'Games in collection', 'Dodaj grę ręcznie': 'Add a game manually',
    'Szukaj w IGDB…': 'Search IGDB…', 'Serie z IGDB:': 'IGDB series:', 'Brak serii w IGDB — dodaj gry ręcznie.': 'No IGDB series — add games manually.',
    'Pobieram gry z IGDB…': 'Fetching games from IGDB…', 'Seria IGDB:': 'IGDB series:', 'zmień': 'change', '✓ masz': '✓ owned',
    'Wybierz serię z IGDB albo dodawaj gry ręcznie poniżej.': 'Pick an IGDB series or add games manually below.',
    'Żadna gra nie pasuje do wybranych opcji.': 'No game matches the selected options.', '{n} z {n} zaznaczonych': '{n} of {n} selected',
    'Rozszerzenie': 'Expansion', 'Dodatek': 'DLC', 'Remaster': 'Remaster', 'Remake': 'Remake', 'Składanka': 'Bundle', 'Spin-off': 'Spin-off',
    'Zapisano kolekcję': 'Collection saved', 'Odświeżono z IGDB': 'Refreshed from IGDB', 'Podaj nazwę kolekcji': 'Enter a collection name',
    'Nie masz jeszcze kolekcji. Utwórz pierwszą — np. „Grand Theft Auto” albo „Gran Turismo na PS2”.': 'No collections yet. Create your first — e.g. “Grand Theft Auto” or “Gran Turismo on PS2”.',
    'Już na liście życzeń ({n})': 'Already on wishlist', '{n}% · Dowolna platforma': '{n}% · Any platform',
    // --- trofea ---
    'TROFEA': 'TROPHIES', 'Zdobyte': 'Earned', 'Do zdobycia': 'To earn', 'PLATYNA': 'PLATINUM', 'ZŁOTO': 'GOLD', 'SREBRO': 'SILVER', 'BRĄZ': 'BRONZE',
    'Zdobyte {d}': 'Earned {d}', 'Trofea włączone!': 'Trophies enabled!', 'Zdobyto trofeum · Brąz': 'Trophy earned · Bronze', 'Zdobyto trofeum · Srebro': 'Trophy earned · Silver',
    'Zdobyto trofeum · Złoto': 'Trophy earned · Gold', 'Zdobyto trofeum · Platyna': 'Trophy earned · Platinum',
    'Masz już {n} trofeum': 'You already have {n} trophy', 'Masz już {n} trofea': 'You already have {n} trophies', 'Masz już {n} trofeów': 'You already have {n} trophies',
    'Start!': 'Start!', 'Dodaj pierwszą grę': 'Add your first game', 'Półka': 'Shelf', '{n} gier w kolekcji': '{n} games in the collection', 'Regał': 'Bookcase',
    'Kolekcjoner': 'Collector', 'Setka': 'Hundred', 'Archiwum': 'Archive', 'Muzeum': 'Museum', 'Kieszonkowe': 'Pocket money', 'Kolekcja warta {n} zł': 'Collection worth {n} PLN',
    'Tysiączek': 'Grand', 'Skarbonka': 'Piggy bank', 'Sejf': 'Safe', 'Skarbiec': 'Treasury', 'Włączam!': 'Power on!', 'Pierwsza konsola': 'First console',
    'Trio': 'Trio', '{n} konsole': '{n} consoles', '{n} konsol': '{n} consoles', 'Ściana konsol': 'Wall of consoles', 'Wystawa': 'Exhibition',
    'Drugi pad': 'Player two', 'Pierwsze akcesorium': 'First accessory', 'Wieloplatformowiec': 'Multiplatform', 'Gry na {n} różne platformy': 'Games on {n} different platforms',
    'Wojna konsol? Nie u mnie': 'Console war? Not here', 'Gry na {n} różnych platform': 'Games on {n} different platforms', 'Ekumenista': 'Ecumenist',
    'Napisy końcowe': 'End credits', 'Ukończ pierwszą grę': 'Complete your first game', 'Wytrwały': 'Persistent', '{n} ukończonych gier': '{n} completed games',
    'Maratończyk': 'Marathoner', 'Nie śpię, gram': 'No sleep, just games', '{n} kompletnych gier (płyta + pudełko + instrukcja)': '{n} complete games (disc + box + manual)',
    'Pedant': 'Perfectionist', '{n} kompletnych gier': '{n} complete games', 'Wszystko na miejscu': 'Everything in place', 'Każda gra kompletna (min. {n} gier)': 'Every game complete (min. {n} games)',
    'Wstyd mi': 'Shame on me', 'Połóż pierwszą grę na kupce wstydu': 'Put your first game on the pile of shame', 'Odkupienie': 'Redemption',
    'Ukończ grę z kupki wstydu': 'Complete a game from the pile of shame', 'Porządki': 'Cleanup', 'Ukończ {n} gier z kupki wstydu': 'Complete {n} games from the pile of shame',
    'Czyste sumienie': 'Clear conscience', 'Pusta kupka': 'Empty pile', 'Opróżnij kupkę wstydu (po min. {n} grach na niej)': 'Empty the pile of shame (after at least {n} games on it)',
    'Pożyczalski': 'Lender', 'Pierwsze wypożyczenie': 'First loan', 'Gdzie moja gra?!': 'Where is my game?!', 'Gra wróciła po terminie': 'A game came back late',
    'Marzyciel': 'Dreamer', 'Pierwsza pozycja na liście życzeń': 'First item on the wishlist', 'Spełnione marzenie': 'Dream come true', 'Kup coś z listy życzeń': 'Buy something from your wishlist',
    'Łowca': 'Hunter', '{n} zakupów z listy życzeń': '{n} purchases from the wishlist', 'Okazja!': 'Bargain!', 'Kup poniżej swojej ceny docelowej': 'Buy below your target price',
    'Plan': 'Plan', 'Utwórz pierwszą kolekcję': 'Create your first collection', 'Półmetek': 'Halfway', 'Skompletuj połowę dowolnej kolekcji': 'Complete half of any collection',
    'Skompletuj całą kolekcję (min. {n} gry)': 'Complete a whole collection (min. {n} games)', 'Limitka': 'Limited', 'Pierwsze wydanie specjalne': 'First special edition',
    'Recenzent': 'Reviewer', 'Oceń {n} gier': 'Rate {n} games', 'Arcydzieło': 'Masterpiece', 'Daj grze {n} gwiazdek': 'Give a game {n} stars',
    'Import z Japonii': 'Imported from Japan', 'Gra w wersji NTSC-J': 'A game in the NTSC-J version', 'Retro': 'Retro', 'Gra z {n} roku lub starsza': 'A game from {n} or older',
    'Podróżnik w czasie': 'Time traveller', 'Gry z {n} różnych dekad': 'Games from {n} different decades', 'Fotograf': 'Photographer',
    'Dodaj zdjęcie swojego egzemplarza': 'Add a photo of your copy', 'Los tak chciał': 'Fate decided', 'Zacznij grę wylosowaną w „Co dziś zagrać?”': 'Start a game picked by “What to play today?”',
    'Platyna': 'Platinum', 'Zdobądź {n}% pozostałych trofeów': 'Earn {n}% of the other trophies', 'Brąz': 'Bronze', 'Srebro': 'Silver', 'Złoto': 'Gold',
    // --- losowanie ---
    'CO DZIŚ ZAGRAĆ?': 'WHAT TO PLAY TODAY?', 'Z czego losować': 'Pick from', 'Nieukończone': 'Not completed', 'Losuj': 'Roll', 'Jeszcze raz': 'Roll again',
    'Pokaż kartę': 'Show card', '▶ Zaczynam grać': '▶ Start playing', 'Pusto — wybierz inną pulę.': 'Empty — pick another pool.',
    '{n} gra w puli': '{n} game in the pool', '{n} gry w puli': '{n} games in the pool', '{n} gier w puli': '{n} games in the pool',
    'Miłej gry: ': 'Have fun: ',
    // --- znajomi / udostępnianie ---
    'ZNAJOMI': 'FRIENDS', 'Udostępnij moją': 'Share mine', '+ Dodaj znajomego': '+ Add friend', '← Znajomi': '← Friends', 'Kolekcja': 'Collection',
    'Wspólne': 'In common', 'Ma, a Ty nie': 'They have, you don’t', 'Ty masz, on nie': 'You have, they don’t', 'Sprzęt': 'Hardware', 'Jego lista życzeń': 'Their wishlist',
    '✓ masz': '✓ owned', '★ na Twojej liście': '★ on your wishlist', 'ukończył': 'completed', 'do wymiany?': 'to trade?', 'Wklej nowszy kod…': 'Paste a newer code…',
    'Usuń znajomego': 'Remove friend', 'Pokaż mój egzemplarz': 'Show my copy', 'Już jest na Twojej liście życzeń.': 'Already on your wishlist.',
    'Pusto.': 'Empty.', 'jego gier masz też Ty · kod z {d}': 'of their games you own too · code from {d}', 'kod z {d}': 'code from {d}',
    'Wspólnych gier: ': 'Games in common: ', ' · ma, a Ty nie: ': ' · they have, you don’t: ', 'gier': 'games',
    'Nikogo tu jeszcze nie ma.': 'Nobody here yet.', 'UDOSTĘPNIJ KOLEKCJĘ': 'SHARE COLLECTION', 'DODAJ ZNAJOMEGO': 'ADD FRIEND',
    'Kod zawiera tytuły, platformy, kompletność, status, oceny i listę życzeń.': 'The code contains titles, platforms, completeness, status, ratings and the wishlist.',
    'Bez': 'Without', 'notatek, wypożyczeń, dat i cen zakupu. Wyślij go znajomemu, który też ma tę apkę — wklei go w „Znajomi”.': 'notes, loans, dates or purchase prices. Send it to a friend who also runs this app — they paste it in “Friends”.',
    'Twoja nazwa': 'Your name', 'np. Janek': 'e.g. John', 'Dołącz wartości (zł)': 'Include values (PLN)', 'Generuj kod': 'Generate code', 'Kopiuj kod': 'Copy code',
    'Pobierz plik .mkol': 'Download .mkol file', 'Kod kolekcji': 'Collection code', '…albo wybierz plik .mkol': '…or choose a .mkol file', 'Nazwa (opcjonalnie)': 'Name (optional)',
    'Dodaj': 'Add', 'Skopiowano kod': 'Code copied', '{n} pozycja · {n} znaków': '{n} item · {n} characters', '{n} pozycje · {n} znaków': '{n} items · {n} characters',
    '{n} pozycji · {n} znaków': '{n} items · {n} characters',
    // --- zdjęcia ---
    'ZDJĘCIE {n}/{n}': 'PHOTO {n}/{n}', 'Opis (np. rysa na płycie)': 'Caption (e.g. scratch on the disc)', 'Usuń zdjęcie': 'Delete photo', 'Zapisz opis': 'Save caption',
    'Poprzednie': 'Previous', 'Następne': 'Next', 'Zdjęcia dodane': 'Photos added', 'Zapisano opis': 'Caption saved', 'Usunąć to zdjęcie?': 'Delete this photo?',
    'Wysyłam {n} zdjęcie…': 'Uploading {n} photo…', 'Wysyłam {n} zdjęcia…': 'Uploading {n} photos…', 'Wysyłam {n} zdjęć…': 'Uploading {n} photos…',
    // --- komunikaty ---
    'Zapisano': 'Saved', 'Usunięto': 'Deleted', 'Zdjęcie pobrane': 'Photo downloaded', 'Najpierw wpisz nazwę': 'Enter a title first', 'Wpisz najpierw nazwę': 'Enter a title first',
    'Podaj nazwę': 'Enter a name', 'Baza okładek LaunchBox gotowa': 'LaunchBox cover database ready', 'Wylądowała na kupce wstydu': 'Landed on the pile of shame',
    'Zdjęta z kupki wstydu': 'Taken off the pile of shame', 'Wstawiono {n} zł': 'Inserted {n} PLN',
    'Nie ma takiej pozycji': 'No such item', 'Nie można wypożyczyć czegoś z listy życzeń': 'You can’t lend something from the wishlist',
    'Ta pozycja jest już wypożyczona': 'This item is already lent out', 'Ta pozycja nie jest wypożyczona': 'This item is not lent out',
    'Na kupkę wstydu trafiają tylko posiadane gry': 'Only owned games can go on the pile of shame', 'Maks. {n} MB': 'Max {n} MB', 'Tylko JPG, PNG lub WEBP': 'JPG, PNG or WEBP only',
    'To nie jest kod kolekcji (powinien zaczynać się od MK1:)': 'This is not a collection code (it should start with MK1:)',
    'Kod jest uszkodzony — skopiuj go jeszcze raz w całości': 'The code is damaged — copy it again in full', 'Nieobsługiwany format kodu': 'Unsupported code format',
    'Nie ma takiego znajomego': 'No such friend', 'Nie ma takiej kolekcji': 'No such collection', 'Kolekcja nie jest powiązana z serią IGDB': 'This collection is not linked to an IGDB series',
    'Nieznana platforma': 'Unknown platform', 'Nieznana rodzina platform': 'Unknown platform family', 'Nieznany wygląd': 'Unknown theme',
    'Backup już trwa': 'A backup is already running', 'Nie ma takiego backupu': 'No such backup', 'Nie ma takiego zdjęcia': 'No such photo',
    'Maks. {n} zdjęć na pozycję': 'Max {n} photos per item', 'Maks. {n} MB na zdjęcie': 'Max {n} MB per photo', 'Plik za duży': 'File too large',
    'To nie wygląda na zdjęcie (JPG, PNG, WEBP, HEIC nieobsługiwany)': 'That doesn’t look like a photo (JPG, PNG, WEBP; HEIC not supported)',
    'Nie znalazłem zdjęcia tej konsoli — użyj „Szukaj zdjęć” albo wgraj własne': 'Couldn’t find a photo of this console — use “Find photos” or upload your own',
    'Brak kluczy IGDB — dodaj je w Menu → Narzędzia → Klucze API': 'No IGDB keys — add them in Menu → Tools → API keys', 'Zaloguj się': 'Please sign in',
    'Obrazek wygasł — wyszukaj ponownie': 'Image link expired — search again', 'Nie udało się pobrać zdjęcia': 'Could not download the photo',
    'To nie jest gra z kolekcji': 'That is not a game from your collection', 'Podaj nazwę ': 'Enter a name',
    'Przywrócić backup? Obecna zawartość zostanie zastąpiona (kopia bazy zrobi się automatycznie).': 'Restore the backup? Current content will be replaced (a database copy is made automatically).',
    'Indeksuję okładki LaunchBox (kilka minut)…': 'Indexing LaunchBox covers (a few minutes)…', 'Pobieram bazę okładek LaunchBox…': 'Downloading LaunchBox cover database…',
    'Wspólnych gier:': 'Games in common:', '· ma, a Ty nie:': '· they have, you don’t:', '{n} konsola': '{n} console',
    '{n} na liście życzeń': '{n} on wishlist', 'oddać do: {d} —': 'due: {d} —', '+{n} zł': '+{n} PLN', '−{n} zł': '−{n} PLN',
    'Wygląd wykresów': 'Chart style', 'Nieznany język': 'Unknown language', 'jest': 'yes', 'brak': 'no', 'Sprawna ': 'Working',
    'Ponów': 'Retry', 'od dziś': 'since today', '{n} dzień': '{n} day', '{n} dni': '{n} days', 'z obiema': 'with both',
  };

  Object.assign(E, {
    // --- v3.8: sprzedaż, waluta, skan, raport, rok w grach ---
    'zł': 'PLN', 'Cena zakupu (': 'Purchase price (', 'Wartość (': 'Value (', 'Cena docelowa (': 'Target price (', 'Dołącz wartości (': 'Include values (',
    'Cena (': 'Price (', 'Cena sprzedaży (': 'Sale price (', ')': ')',
    'Na sprzedaż': 'For sale', 'Sprzedane': 'Sold', 'NA SPRZEDAŻ': 'FOR SALE', 'SPRZEDANE': 'SOLD', 'SPRZEDANA': 'SOLD', 'Sprzedana': 'Sold',
    '○ Na sprzedaż': '○ Sell', '✓ Sprzedana': '✓ Sold', 'Ogłoszenie': 'Listing', 'Zdejmij ze sprzedaży': 'Take off sale', 'Cofnij sprzedaż': 'Undo sale',
    'Na sprzedaż · {n} {c}': 'For sale · {n} {c}', 'Zdjęte ze sprzedaży': 'Taken off sale', 'Wystawione na sprzedaż': 'Listed for sale', 'Zapisano cenę': 'Price saved',
    'Wróciła do kolekcji': 'Back in the collection', 'Zapisz — na sprzedaż': 'Save — list for sale', 'Zapisz cenę': 'Save price',
    'Tytuł ogłoszenia': 'Listing title', 'Opis': 'Description', 'Kopiuj tytuł': 'Copy title', 'Kopiuj opis': 'Copy description', 'Zdjęcia (ZIP)': 'Photos (ZIP)',
    'Wystaw na OLX ↗': 'List on OLX ↗', 'Allegro — sprzedaż ↗': 'Allegro — selling ↗', 'Skopiowano': 'Copied', 'Data': 'Date', 'Komu (opcjonalnie)': 'Buyer (optional)',
    'Kupujący': 'Buyer', 'Cena sprzedaży': 'Sale price', 'Wynik': 'Result', 'masz dubel': 'you have a duplicate', 'Duble': 'Duplicates',
    'kupiona za {n} {c}': 'bought for {n} {c}', 'wartość {n} {c}': 'value {n} {c}', 'mediana ofert {n} {c}': 'median of listings {n} {c}', 'Brak danych': 'No data',
    'Zysk: {n} {c} (kupiona za {n} {c})': 'Profit: {n} {c} (bought for {n} {c})', 'Strata: {n} {c} (kupiona za {n} {c})': 'Loss: {n} {c} (bought for {n} {c})',
    'zysk {n} {c}': 'profit {n} {c}', 'sprzedano za {n} {c}': 'sold for {n} {c}', 'strata {n} {c}': 'loss {n} {c}', 'strata {n} {c}': 'loss {n} {c}', 'na sprzedaż': 'for sale', 'na sprzedaż · {n} {c}': 'for sale · {n} {c}',
    'dubel — do wymiany': 'duplicate — to trade', 'Cofnąć sprzedaż „': 'Undo the sale of “', 'Sprzedana: ': 'Sold: ',
    'Najpierw oznacz pozycję jako oddaną': 'Mark the item as returned first', 'Ta pozycja jest już sprzedana': 'This item is already sold',
    'Ta pozycja nie jest sprzedana': 'This item is not sold', 'To jest pozycja z listy życzeń': 'This is a wishlist item', 'Ta pozycja nie ma zdjęć egzemplarza': 'This item has no photos',
    'Waluta kolekcji': 'Collection currency', 'Zmień walutę': 'Change currency', 'Przelicz istniejące kwoty po dzisiejszym kursie NBP': 'Convert existing amounts at today’s NBP rate',
    'Bez zaznaczenia zmienia się tylko symbol — liczby zostają.': 'Unchecked: only the symbol changes — the numbers stay.', 'To już jest waluta kolekcji': 'That is already the collection currency',
    'Nieznana waluta': 'Unknown currency', 'Brak kursu NBP — spróbuj później albo zmień bez przeliczania': 'No NBP rate — try later or change without converting',
    'Zdjęcie numeru seryjnego z pudełka': 'Photo of the serial number on the box', 'Zdjęcie numeru seryjnego': 'Photo of the serial number', 'Czytam numer ze zdjęcia…': 'Reading the number from the photo…',
    'Nie udało się odczytać numeru — zrób zdjęcie z bliska, w dobrym świetle, sam numer w kadrze.': 'Couldn’t read the number — take a close-up in good light with just the number in frame.',
    'Odczytano: ': 'Read: ', 'Brak programu Tesseract w kontenerze — przebuduj obraz': 'Tesseract is missing in the container — rebuild the image', 'To nie wygląda na zdjęcie': 'That doesn’t look like a photo',
    'Raport do ubezpieczenia (PDF)…': 'Insurance report (PDF)…', 'RAPORT DO UBEZPIECZENIA': 'INSURANCE REPORT', 'Dołącz zdjęcia egzemplarzy': 'Include photos of your copies',
    'Plik PDF ze spisem kolekcji: okładki, kompletność i stan, numery seryjne, zakup i wartość z datą wyceny. Przyda się przy szkodzie lub kradzieży — trzymaj kopię poza domem.':
      'A PDF inventory of your collection: covers, completeness and condition, serial numbers, purchase and value with the valuation date. Useful after damage or theft — keep a copy outside your home.',
    'Pobierz PDF': 'Download PDF', 'Generuję PDF…': 'Generating PDF…', 'Brak biblioteki reportlab — przebuduj kontener': 'reportlab is missing — rebuild the container',
    'Twój rok w grach': 'Your year in games', 'ROK W GRACH': 'YEAR IN GAMES', 'TWÓJ ROK W GRACH': 'YOUR YEAR IN GAMES', 'Rok {n} w grach': '{n} in games',
    'Naciśnij ▶, żeby zobaczyć podsumowanie': 'Press ▶ to see your summary', 'KUPIONE': 'BOUGHT', 'WYDANE': 'SPENT', 'NAJDROŻSZY ZAKUP': 'PRICIEST PURCHASE',
    'ULUBIONA PLATFORMA': 'FAVOURITE PLATFORM', 'MIESIĄC ZAKUPÓW': 'SHOPPING MONTH', 'PIERWSZY ZAKUP ROKU': 'FIRST PURCHASE OF THE YEAR',
    'POŻYCZONE / SPEŁNIONE': 'LENT / WISHES MET', 'SPRZEDAŻ': 'SALES', 'TROFEA ': 'TROPHIES', 'WARTOŚĆ KOLEKCJI': 'COLLECTION VALUE', 'KONIEC': 'THE END',
    'średnio {n} {c} za pozycję': 'on average {n} {c} per item', '{n} nowa gra': '{n} new game', '{n} nowe gry': '{n} new games', '{n} nowych gier': '{n} new games',
    '{n} zakup': '{n} purchase', '{n} zakupy': '{n} purchases', '{n} zakupów': '{n} purchases', 'napisy końcowe w tym roku': 'end credits this year',
    'dołożone / zdjęte z kupki': 'added / taken off the pile', 'wypożyczone gry / spełnione pozycje z listy życzeń': 'games lent / wishlist items fulfilled',
    'zdobytych w tym roku': 'earned this year', 'Do zobaczenia za rok!': 'See you next year!', '+{n} {c} od początku roku': '+{n} {c} since the start of the year',
    '−{n} {c} od początku roku': '−{n} {c} since the start of the year', 'Liczę…': 'Counting…', 'Wstecz': 'Back', 'Dalej': 'Next', 'Rok': 'Year',
    '{n} akcesorium': '{n} accessory', '{n} akcesoria': '{n} accessories', '{n} akcesoriów': '{n} accessories',
    'styczeń': 'January', 'luty': 'February', 'marzec': 'March', 'kwiecień': 'April', 'maj': 'May', 'czerwiec': 'June', 'lipiec': 'July',
    'sierpień': 'August', 'wrzesień': 'September', 'październik': 'October', 'listopad': 'November', 'grudzień': 'December',
    'SPRZEDANE ': 'SOLD', 'Wystawione': 'Listed', 'Na sprzedaż ': 'For sale',
    // --- trofea v3.8 ---
    'Rozgrzewka': 'Warm-up', 'Ściana gier': 'Wall of games', 'Magazyn': 'Warehouse', 'Legenda': 'Legend', 'Grosz do grosza': 'Every penny counts',
    'Lokata': 'Savings account', 'Fort Knox': 'Fort Knox', 'Bank': 'Bank', 'Perełka': 'Pearl', 'Klejnot': 'Jewel', 'Święty Graal': 'Holy Grail',
    'Pozycja warta co najmniej {n} zł': 'An item worth at least {n} PLN', 'Druga konsola': 'Second console', 'Muzeum sprzętu': 'Hardware museum',
    'Szuflada': 'Drawer', 'Szuflada kabli': 'Drawer of cables', 'Magazyn akcesoriów': 'Accessory stockroom', '{n} akcesoriów ': '{n} accessories',
    'W drogę': 'On the go', 'Konsola przenośna w kolekcji': 'A handheld console in the collection', 'Trzy obozy': 'Three camps',
    'Konsole z {n} rodzin (PlayStation, Xbox, Nintendo, Sega)': 'Consoles from {n} families (PlayStation, Xbox, Nintendo, Sega)',
    'Specjalista': 'Specialist', 'Fanatyk': 'Fanatic', '{n} gier na jednej platformie': '{n} games on one platform', 'Cała rodzina PlayStation': 'The whole PlayStation family',
    'Gry na PS{n}, PS{n}, PS{n}, PS{n} i PS{n}': 'Games on PS1, PS2, PS3, PS4 and PS5', 'Gry na PS1, PS2, PS3, PS4 i PS5': 'Games on PS1, PS2, PS3, PS4 and PS5',
    'Wielkie N': 'Big N', 'Gry na {n} platformach Nintendo': 'Games on {n} Nintendo platforms', 'Sega!': 'Sega!', 'Gra na konsolę Segi': 'A game for a Sega console',
    'Pecetowiec': 'PC gamer', 'Gra na PC': 'A PC game', 'Zielone światło': 'Green light', 'Gra na Xboksa': 'An Xbox game', 'Rozpęd': 'Momentum',
    'Setka napisów': 'Hundred credits', 'Błyskawica': 'Lightning', 'Ukończ grę w ciągu {n} dni od zakupu': 'Complete a game within {n} days of buying it',
    'Maraton miesiąca': 'Monthly marathon', '{n} gry ukończone w jednym miesiącu': '{n} games completed in one month', 'Wielozadaniowość': 'Multitasking',
    '{n} gry jednocześnie ze statusem „Gram”': '{n} games at once with status “Playing”', 'Nie dla mnie': 'Not for me', 'Porzuć grę': 'Drop a game',
    'Pierwszy komplet': 'First complete copy', 'Pierwsza kompletna gra': 'First complete game', 'Kolekcjoner pudełek': 'Box collector', 'Kompletista': 'Completionist',
    'Luzak': 'Loose', '{n} gier bez pudełka': '{n} games without a box', 'Jak z fabryki': 'Factory fresh', '{n} pozycji w stanie A': '{n} items in condition A',
    'Kupka rośnie': 'The pile grows', '{n} gier na kupce wstydu jednocześnie': '{n} games on the pile of shame at once', 'Wiosenne porządki': 'Spring cleaning',
    'Wypożyczalnia': 'Rental shop', '{n} wypożyczeń': '{n} loans', 'Biblioteka': 'Library', 'Słowni znajomi': 'Reliable friends', '{n} gier oddanych w terminie': '{n} games returned on time',
    'Lista zakupów': 'Shopping list', '{n} pozycji na liście życzeń': '{n} items on the wishlist', 'Marzenia na zapas': 'Dreams in stock', 'Łowca okazji': 'Deal hunter',
    'Spełniacz marzeń': 'Dream maker', 'Planista': 'Planner', 'Utwórz {n} kolekcje': 'Create {n} collections', 'Seryjny kolekcjoner': 'Serial collector',
    '{n} skompletowane kolekcje': '{n} completed collections', 'Duża seria': 'Big series', 'Skompletuj kolekcję z co najmniej {n} gier': 'Complete a collection of at least {n} games',
    'Limitowane': 'Limited', '{n} wydań specjalnych': '{n} special editions', 'Edycja kolekcjonerska': 'Collector’s edition', 'Metalowa skrzynka': 'Metal box',
    'Pierwszy steelbook': 'First steelbook', 'Krytyk': 'Critic', 'Oceń {n} gier ': 'Rate {n} games', 'Redaktor naczelny': 'Editor-in-chief', 'Szczerość': 'Honesty',
    'Daj grze pół gwiazdki albo jedną': 'Give a game half a star or one star', 'Polska wersja': 'Polish version', '{n} gier z polską okładką': '{n} games with a Polish cover',
    'Obywatel świata': 'Citizen of the world', 'Pozycje w wersjach PAL, NTSC-U i NTSC-J': 'Items in PAL, NTSC-U and NTSC-J versions', 'Poliglota': 'Polyglot',
    'Okładki w {n} różnych językach': 'Covers in {n} different languages', 'Rocznica': 'Anniversary', 'Pozycja w kolekcji od co najmniej roku': 'An item in the collection for at least a year',
    'Dekada z grą': 'A decade with a game', 'Pozycja w kolekcji od co najmniej {n} lat': 'An item in the collection for at least {n} years', 'Pradawne': 'Ancient',
    'Gra z {n} roku lub starsza ': 'A game from {n} or older', 'Premiera': 'Premiere', 'Gra wydana w tym roku': 'A game released this year', 'Album': 'Album',
    '{n} zdjęć egzemplarzy': '{n} photos of copies', 'Fotoreporter': 'Photojournalist', 'Wystaw coś na sprzedaż': 'List something for sale', 'Pierwsza transakcja': 'First deal',
    'Sprzedaj coś': 'Sell something', 'Handlarz': 'Trader', 'Sprzedaj {n} pozycji': 'Sell {n} items', 'Na plusie': 'In the black', 'Sprzedaj drożej, niż kupiłeś': 'Sell for more than you paid',
    'Biznesmen': 'Businessman', 'Łączny zysk ze sprzedaży co najmniej {n} zł': 'Total sales profit of at least {n} PLN', 'Déjà vu': 'Déjà vu',
    'Dwa egzemplarze tej samej gry': 'Two copies of the same game', 'Znajomy': 'Friend', 'Dodaj znajomego': 'Add a friend', 'Paczka': 'Crew', '{n} znajomych': '{n} friends',
    'Pochwal się': 'Show off', 'Udostępnij kod swojej kolekcji': 'Share your collection code', 'Archiwista': 'Archivist', '{n} gier z numerem seryjnym': '{n} games with a serial number',
    'Skaner': 'Scanner', 'Odczytaj numer seryjny aparatem': 'Read a serial number with the camera', 'Polisa': 'Policy', 'Wygeneruj raport do ubezpieczenia': 'Generate an insurance report',
    'Podsumowanie': 'Summary', 'Obejrzyj swój rok w grach': 'Watch your year in games', 'Hazardzista': 'Gambler', 'Zacznij {n} wylosowanych gier': 'Start {n} randomly picked games',
    'Game Boy': 'Game Boy', 'Włącz wygląd LCD': 'Turn on the LCD theme', 'Kineskop': 'Tube', 'Włącz wygląd CRT': 'Turn on the CRT theme', 'Hello!': 'Hello!',
    'Przełącz apkę na angielski': 'Switch the app to English', 'Zdobądź {n}% pozostałych trofeów': 'Earn {n}% of the other trophies', '{n} konsol ': '{n} consoles',
  });
  // prefiksy: „Tekst: <dane użytkownika>”
  Object.assign(E, {
    "Narzędzia…": "Tools…",
    "O aplikacji…": "About…",
    "NARZĘDZIA": "TOOLS",
    "O APLIKACJI": "ABOUT",
    "Cała kolekcja w arkuszu (Excel, LibreOffice).": "The whole collection as a spreadsheet (Excel, LibreOffice).",
    "Spis z okładkami, stanem, cenami i zdjęciami.": "A list with covers, condition, prices and photos.",
    "Dane bez plików obrazów — do przeniesienia albo archiwum.": "Data without image files — for moving or archiving.",
    "Zastępuje obecną kolekcję (kopia bazy robi się sama).": "Replaces the current collection (a database copy is made automatically).",
    "Pobiera najnowszą bazę okładek (kilkadziesiąt MB).": "Downloads the latest cover database (tens of MB).",
    "Miejsce na serwerze": "Server storage",
    "Sprawdzam…": "Checking…",
    "Wolne:": "Free:",
    "Dane aplikacji:": "App data:",
    "z 1 GB · zajęte 1%": "of 1 GB · 1% used",
    "z 1 TB · zajęte 1%": "of 1 TB · 1% used",
    "z 1 MB · zajęte 1%": "of 1 MB · 1% used",
    "Baza danych": "Database",
    "Okładki": "Covers",
    "Zdjęcia egzemplarzy": "Copy photos",
    "Backupy": "Backups",
    "Bazy numerów seryjnych": "Serial number databases",
    "Baza okładek LaunchBox": "LaunchBox cover database",
    "Inne": "Other",
    "Autor:": "Author:",
    "[miejsce na nick i link do profilu]": "[placeholder for nickname and profile link]",
    "Samodzielnie hostowana biblioteka fizycznych gier, konsol i akcesoriów. Dane zostają na Twoim serwerze.": "A self-hosted library of physical games, consoles and accessories. Your data stays on your server.",
    "☕ Postaw mi kawę": "☕ Buy me a coffee",
    "Źródła danych i licencje": "Data sources and licences",
    "Dane o grach: IGDB (Twitch)": "Game data: IGDB (Twitch)",
    "Okładki: ScreenScraper, LaunchBox Games Database, libretro-thumbnails": "Covers: ScreenScraper, LaunchBox Games Database, libretro-thumbnails",
    "Numery seryjne: bazy Redump i No-Intro (libretro-database)": "Serial numbers: Redump and No-Intro databases (libretro-database)",
    "Zdjęcia sprzętu: Wikimedia Commons (m.in. Evan-Amos)": "Hardware photos: Wikimedia Commons (incl. Evan-Amos)",
    "Kursy walut: Narodowy Bank Polski": "Exchange rates: National Bank of Poland",
    "Czcionki (SIL OFL): Exo 2, Press Start 2P, VT323, Open Sans, Nunito": "Fonts (SIL OFL): Exo 2, Press Start 2P, VT323, Open Sans, Nunito",
    "Nazwy konsol i gier należą do ich właścicieli. Wyglądy są inspirowane sprzętem z epoki i nie używają logo.": "Console and game names belong to their owners. The looks are inspired by period hardware and use no logos.",
    "Gdzie szukać ofert": "Where to look for offers",
    "Przyciski na liście życzeń, w ogłoszeniu i przy sugerowanej cenie.": "Buttons on the wishlist, in the listing and next to the suggested price.",
    "Wybierz serwisy w Ustawieniach, żeby szukać ofert.": "Pick marketplaces in Settings to search for offers.",
    "Zdjęcie numeru z galerii": "Serial number photo from the gallery",
    "Telefon zamknął stronę podczas robienia zdjęcia (za mało pamięci). Zrób zdjęcie zwykłym aparatem i wybierz je przyciskiem galerii obok.": "Your phone closed the page while taking the photo (not enough memory). Take the photo with the normal camera app and pick it with the gallery button next to it.",
    "Nie udało się wysłać zdjęcia": "Could not send the photo",
    "Serwer nie odpowiedział na czas — spróbuj jeszcze raz": "The server did not respond in time — try again",
    "Brak połączenia z serwerem — sprawdź Wi-Fi": "No connection to the server — check your Wi-Fi",
    "Plik jest za duży": "The file is too large",
    "Błąd serwera (500) — szczegóły w logach": "Server error (500) — see the logs",
    "albo tylko gry wydane wyłącznie na:": "or only games released exclusively on:",
    "Exclusive'y": "Exclusives",
    "Exclusive'y platformy:": "Platform exclusives:",
    "Szukam gier wydanych tylko na tę platformę…": "Looking for games released only on this platform…",
    "IGDB nie zwrócił żadnych exclusive'ów dla tej platformy": "IGDB returned no exclusives for this platform",
    "Kolekcja nie jest powiązana z serią IGDB ani platformą": "This collection is not linked to an IGDB series or platform",
    "Gry (1)": "Games (1)",
    "Konsole (1)": "Consoles (1)",
    "Akcesoria (1)": "Accessories (1)",
    "Garderoba": "Wardrobe",
    "Wypróbuj wszystkie wyglądy (poza ukrytym)": "Try every look (except the hidden one)",
    "Wpisz kod Konami": "Enter the Konami code",
    "Czerwona gorączka": "Red fever",
    "Włącz ukryty wygląd RED": "Turn on the hidden RED look",
    "Kombinacja": "Combo",
    "Naciśnij △ ○ ✕ □ w nagłówku po kolei": "Press △ ○ ✕ □ in the header in order",
    "Ciekawski": "Curious",
    "Zajrzyj do „O aplikacji”": "Open “About”",
    "Ukryte trofeum": "Hidden trophy",
    "Ukryte trofeum — podobno działa tu pewien stary kod…": "Hidden trophy — rumour has it an old code works here…",
    "Sekrety": "Secrets",
    "SEKRETY": "SECRETS",
    "Kod przyjęty! W Menu → Wygląd czeka ukryty wygląd RED": "Code accepted! A hidden RED look is waiting in Menu → Look",
    "KOD PRZYJĘTY": "CODE ACCEPTED",
    "+30 ŻYĆ": "+30 LIVES",
    "SEKRET!": "SECRET!",
    "Ten wygląd trzeba najpierw odblokować": "This look has to be unlocked first",
    "Dowolna platforma": "Any platform",
    "ZMIEŃ OKŁADKĘ": "CHANGE COVER", "Baza okładek LaunchBox: błąd (1)": "LaunchBox cover database: error (1)"
  });
  const P = {
    'Pokaż tylko ': 'Show only ', 'Dodano do listy życzeń: ': 'Added to wishlist: ', 'Na liście życzeń: ': 'On the wishlist: ', 'Dodano: ': 'Added: ', 'W kolekcji: ': 'In collection: ',
    'Miłej gry: ': 'Have fun: ', 'Uzupełnij: ': 'Fill in: ', 'Nie zapisano: ': 'Not saved: ', 'Błąd: ': 'Error: ', 'Błąd wyszukiwania: ': 'Search error: ',
    'Dodano znajomego: ': 'Friend added: ', 'Sprzedana: ': 'Sold: ', 'Odczytano: ': 'Read: ', 'Cofnąć sprzedaż „': 'Undo the sale of “', 'Zaktualizowano kolekcję: ': 'Collection updated: ', 'Przywrócono ': 'Restored ', 'Usunąć „': 'Delete “',
    'Usunąć kolekcję „': 'Delete collection “', 'Seria IGDB: ': 'IGDB series: ', 'Zapytanie: „': 'Query: “', 'eBay nie odpowiedział: ': 'eBay did not respond: ',
    'Niepoprawny plik backupu: ': 'Invalid backup file: ', 'Wypożyczona: ': 'Lent to: ', 'Backup nieudany: ': 'Backup failed: ',
    'Dla konsoli „': 'For console “', 'Szukaj: ': 'Search: ', 'Wystaw: ': 'Sell on: ', 'Tylko na ': 'Only on ', 'Błąd w aplikacji: ': 'App error: ',
  };
  Object.assign(E, {
    "SKANUJ NUMER SERYJNY": "SCAN SERIAL NUMBER",
    "Ustaw numer (np. SLES-00250) w ramce": "Put the number (e.g. SLES-00250) inside the frame",
    "Latarka": "Torch",
    "Zrób zdjęcie": "Take photo",
    "APARAT W TELEFONIE": "PHONE CAMERA",
    "Przez zwykły adres (http) przeglądarka nie pozwala użyć aparatu w oknie apki. Otwiera wtedy aplikację aparatu, a telefon z małą ilością wolnej pamięci zamyka w tym czasie stronę.": "Over a plain (http) address the browser does not allow the camera inside the app. It opens the camera app instead, and a phone low on memory closes the page meanwhile.",
    "Rozwiązanie:": "Solution:",
    "otwórz apkę przez HTTPS — raz zainstaluj certyfikat (Menu → Narzędzia → Bezpieczne połączenie). Potem aparat działa w oknie apki, bez przełączania.": "open the app over HTTPS — install the certificate once (Menu → Tools → Secure connection). Then the camera works inside the app, without switching.",
    "Pokaż, jak włączyć HTTPS": "Show how to turn on HTTPS",
    "Wybierz zdjęcie z galerii": "Pick a photo from the gallery",
    "Użyj aparatu telefonu mimo to": "Use the phone camera anyway",
    "Bezpieczne połączenie (HTTPS)": "Secure connection (HTTPS)",
    "HTTPS jest wyłączony na serwerze (HTTPS_PORT=0).": "HTTPS is turned off on the server (HTTPS_PORT=0).",
    "✓ Połączenie jest szyfrowane — aparat działa w oknie apki.": "✓ The connection is encrypted — the camera works inside the app.",
    "Szyfruje hasło w sieci domowej i pozwala używać aparatu w oknie apki (skan numeru seryjnego na telefonie).": "Encrypts your password on the home network and lets you use the camera inside the app (serial number scan on a phone).",
    "1. Pobierz certyfikat": "1. Download the certificate",
    "2. Zainstaluj go na telefonie": "2. Install it on your phone",
    "3. Otwórz wersję HTTPS": "3. Open the HTTPS version",
    "Ustawienia → Bezpieczeństwo → Więcej ustawień → Szyfrowanie i dane logowania → Zainstaluj certyfikat → Certyfikat CA → wybierz pobrany plik": "Settings → Security → More settings → Encryption & credentials → Install a certificate → CA certificate → pick the downloaded file",
    "iPhone / iPad": "iPhone / iPad",
    "Komputer": "Computer",
    "Otwórz pobrany plik → Ustawienia → Pobrany profil → Zainstaluj. Potem Ogólne → To urządzenie → Zaufanie certyfikatom → włącz „Moja kolekcja”.": "Open the downloaded file → Settings → Profile Downloaded → Install. Then General → About → Certificate Trust Settings → turn on “Moja kolekcja”.",
    "Windows: dwuklik na pliku → Zainstaluj certyfikat → Zaufane główne urzędy certyfikacji. Firefox ma własne ustawienia certyfikatów.": "Windows: double-click the file → Install Certificate → Trusted Root Certification Authorities. Firefox has its own certificate settings.",
    "Certyfikat działa tylko dla adresów w sieci domowej — nie da się nim podrobić żadnej strony w internecie.": "The certificate only works for home network addresses — it cannot be used to fake any website on the internet.",
    "Odcisk SHA-256:": "SHA-256 fingerprint:",
    "Brak zgody na aparat — zezwól w ustawieniach strony w przeglądarce.": "No camera permission — allow it in the browser’s site settings.",
    "Ten wygląd trzeba najpierw odblokować": "This look has to be unlocked first"
  });
  Object.assign(E, {
    "Klucze API": "API keys", "Hasło do aplikacji": "App password", "Obecne hasło": "Current password",
    "Nowe hasło (min. {n} znaków)": "New password (min. {n} characters)", "Powtórz nowe hasło": "Repeat new password",
    "Zmień hasło": "Change password", "Po zmianie inne urządzenia trzeba zalogować ponownie.": "After the change, other devices have to sign in again.",
    "✓ działa": "✓ working", "brak kluczy": "no keys", "z pliku .env": "from the .env file", "Zmień": "Change",
    "Dane o grach, okładki, zdjęcia konsol (wymagane).": "Game data, covers, console photos (required).",
    "Sugerowana cena gier i konsol.": "Suggested prices for games and consoles.",
    "Okładki z konkretnego regionu (klucze deweloperskie z forum ScreenScraper).": "Region-specific covers (developer keys from the ScreenScraper forum).",
    "Skąd wziąć klucze ↗": "Where to get the keys ↗", "Zapisz i sprawdź": "Save and check", "Usuń klucze": "Remove keys",
    "Puste pole = bez zmian.": "Empty field = no change.", "Hasło ScreenScraper": "ScreenScraper password", "Dev password": "Dev password",
    "Usunąć zapisane klucze?": "Remove the saved keys?", "Usunięto klucze": "Keys removed", "Usunięto": "Removed",
    "Nowe hasła się różnią": "The new passwords don’t match", "Hasło zmienione": "Password changed", "Zapisano": "Saved",
    "Hasło jest ustawione w pliku .env (APP_PASSWORD) — zmienisz je tylko tam.": "The password is set in the .env file (APP_PASSWORD) — change it there.",
    "Hasło jest ustawione w pliku .env (APP_PASSWORD) — zmień je tam": "The password is set in the .env file (APP_PASSWORD) — change it there",
    "Obecne hasło się nie zgadza": "The current password is wrong",
    "Nowe hasło musi mieć co najmniej {n} znaków": "The new password must be at least {n} characters",
    "Te klucze są ustawione w pliku .env — zmień je tam": "These keys are set in the .env file — change them there",
    "Uzupełnij wszystkie pola": "Fill in all fields", "IGDB działa": "IGDB works", "eBay działa": "eBay works", "ScreenScraper działa": "ScreenScraper works",
    "Twitch nie przyjął kluczy — sprawdź Client ID i Client Secret": "Twitch rejected the keys — check the Client ID and Client Secret",
    "eBay nie przyjął kluczy — potrzebne są klucze produkcyjne (Production)": "eBay rejected the keys — Production keys are needed",
    "ScreenScraper odrzucił dane ({n})": "ScreenScraper rejected the credentials ({n})", "IGDB odrzuca zapytania ({n})": "IGDB rejects requests ({n})",
    "Brak połączenia z serwerem usługi — sprawdź internet na serwerze": "Can’t reach the service — check the server’s internet connection",
    "Nieoczekiwana odpowiedź usługi — spróbuj za chwilę": "Unexpected response from the service — try again in a moment",
    "Bez kluczy IGDB apka nie znajdzie gier — możesz je tylko zmienić": "Without IGDB keys the app can’t find games — you can only change them",
    "Kod źródłowy:": "Source code:",
    "Licencja: GNU AGPL-3.0 z dodatkowym warunkiem — informacja o autorze musi zostać widoczna w aplikacji i w każdej jej kopii lub przeróbce.": "Licence: GNU AGPL-3.0 with an additional term — the author credit must stay visible in the app and in every copy or modified version.",
    "Moja kolekcja · © pozdromaciek ·": "My collection · © pozdromaciek ·"
  });
  Object.assign(E, {
    "Trzymaj telefon ok. 15–20 cm od pudełka · stuknij w obraz, żeby ustawić ostrość": "Hold the phone about 15–20 cm from the box · tap the picture to focus",
    "Trzymaj telefon ok. 15–20 cm od pudełka": "Hold the phone about 15–20 cm from the box",
    "stuknij w obraz, żeby ustawić ostrość": "tap the picture to focus",
    "Przybliżenie": "Zoom",
    "Ostrość": "Focus"
  });
  // zdania z nazwami w środku (nie da się ich zapisać jako {n})
  const RX = [
    [/^Oznaczyć „(.+)” jako oddaną przez (.+)\?$/, 'Mark “$1” as returned by $2?'],
    [/^Odczytano (.+), ale nie znam takiego wydania — sprawdź numer i kliknij „Szukaj”\.$/, 'Read $1, but this release is unknown — check the number and click “Search”.'],
    [/^najwyżej oceniona: (.+)$/, 'top rated: $1'],
    [/^średnio (.+) za pozycję$/, 'on average $1 per item'],
    [/^Przeliczyć wszystkie kwoty z (\w+) na (\w+) po dzisiejszym kursie NBP\?$/, 'Convert all amounts from $1 to $2 at today’s NBP rate?'],
    [/^Zmienić walutę na (\w+) bez przeliczania kwot\?$/, 'Change the currency to $1 without converting amounts?'],
    [/^Usunąć „(.+)” ze znajomych\?$/, 'Remove “$1” from friends?'],
    [/^cel był (.+)$/, 'target was $1'],
    [/^Nie udało się włączyć aparatu \((.+)\)$/, 'Could not start the camera ($1)'],
    [/^3\. Otwórz apkę przez https:\/\/ i port (\d+)$/, '3. Open the app via https:// and port $1'],
    [/^([+−-].+) od początku roku$/, '$1 since the start of the year'],
    [/^(.+) \(franczyza\)$/, '$1 (franchise)'],
  ];
  const WORDS = {'cena zakupu': 'purchase price', 'data zakupu': 'purchase date', 'stan': 'condition'};

  const NUM = /\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?|(?<![A-Za-zĄ-ż])\d+(?:[.,   ]\d+)*/g;
  const CURX = /(?<=[\d\s(])(zł|ZŁ|€|EUR|USD|GBP|CHF|CZK)(?![A-Za-zĄ-ż])/g;
  const norm = (s) => s.replace(NUM, (m) => (/^\d{4}-\d{2}-\d{2}/.test(m) ? '{d}' : '{n}'));
  const T = {};
  for (const [k, v] of Object.entries(E)) {
    const nk = norm(k).replace(CURX, '{c}');
    T[nk] = nk.includes('{c}') && !v.includes('{c}') ? v.replace(/PLN/g, '{c}') : v;
  }
  const cache = new Map();

  function tr(raw) {
    if (!raw || !/[A-Za-zĄ-ż]/.test(raw)) return raw;
    if (cache.has(raw)) return cache.get(raw);
    const lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
    const s = raw.trim();
    let out = one(s);
    const bul = out === null && s.match(/^([·•]\s+)(.+)$/);        // „· Dowolna platforma”
    if (bul) { const o = one(bul[2]); if (o !== null) out = bul[1] + o; }
    if (out === null && s.includes(' · ')) {
      const parts = s.split(' · ').map((p) => one(p) ?? p);
      out = parts.join(' · ');
      if (out === s) out = null;
    }
    const res = out === null ? raw : lead + out + tail;
    if (cache.size > 5000) cache.clear();
    cache.set(raw, res);
    return res;
  }
  function one(s) {
    if (E[s] !== undefined) return E[s];
    const nums = [];
    const curs = [];
    const key = s.replace(NUM, (m) => { nums.push(m); return /^\d{4}-\d{2}-\d{2}/.test(m) ? '{d}' : '{n}'; })
      .replace(CURX, (m) => { curs.push(/^z/i.test(m) ? 'PLN' : m); return '{c}'; });
    if ((nums.length || curs.length) && T[key] !== undefined) {
      let i = 0, j = 0;
      return T[key].replace(/\{[ndc]\}/g, (x) => (x === '{c}' ? (curs[j++] ?? '') : (nums[i++] ?? '')));
    }
    for (const [re, v] of RX) if (re.test(s)) return s.replace(re, v);
    for (const [p, v] of Object.entries(P)) if (s.startsWith(p)) return v + (WORDS[s.slice(p.length)] || s.slice(p.length).split(', ').map((w) => WORDS[w] || w).join(', '));
    const kv = s.match(/^(.+?): (.+)$/);                         // „Pudełko: jest”
    if (kv && E[kv[1]] !== undefined && E[kv[2]] !== undefined) return E[kv[1]] + ': ' + E[kv[2]];
    const m = s.match(/^(.*\S)\s+(\d+(?:\/\d+)?)$/);          // „Etykieta 12”, „Trofea 15/50”
    if (m && E[m[1]] !== undefined) return E[m[1]] + ' ' + m[2];
    return null;
  }
  window.tr = tr;

  const SKIP = 'script,style,textarea,[data-notr],.card .t,.manual h3,.cch b,.rinfo b,.ct,.res b,.cpop > b,.cov,.bklist a,.variants,.kv span:last-child .stars-ro';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
    for (const a of ATTRS) if (root.hasAttribute?.(a)) { const v = root.getAttribute(a); const t = tr(v); if (t !== v) root.setAttribute(a, t); }
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = it.nextNode())) {
      if (n.nodeType === 1) {
        if (n.matches(SKIP)) { continue; }
        for (const a of ATTRS) if (n.hasAttribute(a)) { const v = n.getAttribute(a); const t = tr(v); if (t !== v) n.setAttribute(a, t); }
      } else fixText(n);
    }
  }
  function fixText(n) {
    if (n.parentElement?.closest(SKIP)) return;
    const v = n.nodeValue; const t = tr(v);
    if (t !== v) n.nodeValue = t;
  }
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); const t = v && tr(v); if (t && t !== v) m.target.setAttribute(m.attributeName, t); }
      else m.addedNodes.forEach(walk);
    }
  });
  function start() {
    walk(document.body);
    document.title = tr(document.title);
    obs.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  const conf = window.confirm.bind(window);
  window.confirm = (msg) => conf(tr(String(msg)));
})();
