# travel — working notes

Named **travel** in the app since 2026.10.28-1 (repo, Pages URL and workbook keep the
`out-of-town` / `Out of Town.xlsx` names: renaming the repo would change the URL and the MSAL
redirect URI). Stripped-down city directory for places outside the hometown list. Separate from
**eat + drink** (`../food-drink-app`) on purpose: that app is changing a lot, and this one
is meant to stay small while it holds many cities with only a few places each.

## Where things live

| Thing | Path |
|---|---|
| App source | `index.html` (one file: markup, CSS, JS) |
| Build stamp | `version.txt`, and `APP_VERSION` near the top of the script — bump both together |
| Repo on the Mac | `~/Desktop/Invisible Hand/WIP/eat + drink/out-of-town` |
| Live site | https://nameisredacted.github.io/out-of-town/ (GitHub Pages, `main`, repo `nameisredacted/out-of-town`, public) |
| Workbook | OneDrive `the list/Food + Drink/Claude/Out of Town.xlsx` |
| Tests | `tests/smoke.mjs` (jsdom, in-memory backend, no network, no OneDrive) |

## Where hometown ends

Hometown = the nine Bay Area counties (Alameda, Contra Costa, Marin, Napa, San Francisco,
San Mateo, Santa Clara, Solano, Sonoma). Anything else belongs here. Decided 2026-10-13.
Tracy, Stockton, Castroville and Ukiah are outside that line and moved; Benicia and
Vacaville (Solano) stayed.

## Data model

`Out of Town.xlsx`, table **PlacesTable** on sheet **Places**, one table only:

`Name | Category | City | Rating | To Order | Ordered | Notes | Address | Lat | Lng | Closed | Kind`

- **Kind** (12th column, 2026.10.27-1) is one of `eat + drink`, `stay`, `see + do`, `shop`,
  `golf`, `ski`. Blank reads as `eat + drink`. The header's kind select and the y / - / n chips
  filter everything (index counts, city pages, search, nearest); a city page with more than one
  kind splits into a section per kind. The app writes rows at the width the table actually has
  (`tableWidth`, read from the first row), so an 11-column copy of the workbook still works.
- **To Order** is a list (items separated by `; `). The detail sheet shows it the way eat + drink
  does: one row per item with an **ate it** button that moves the item to Ordered, and an add
  field under the list. For kinds other than eat + drink the same two columns read **To Do** /
  **done** / **Done**.

- **Identity is name + city.** The same name in two cities is two rows (All'antico Vinaio
  is in New York and Los Angeles). A twin name + city is refused on add and on rename.
- **City** is `City, ST` for the US, `City, Country` elsewhere. `canonCity()` snaps a typed
  city to an existing spelling (case, spacing and accents ignored) and upper-cases a known
  state code, so `phoenix,  az` becomes `Phoenix, AZ`. The index (2026.10.28-4) follows the
  **Apple Notes travel folder**: area label (`united states`, `international`; muted 12px) ▸
  region = one note (West, Southwest, Midwest, South, East, Alaska, Territories, National; North
  America (Canada, Greenland), Mexico / Latin / South America, Caribbean, Europe, Africa, Asia,
  Oceania, Antarctica, Global (Bike, Cruise)) ▸ state or country ▸ town. Region and state/country are both
  dropdowns (`<details class="country">` / `<details class="sub">`), closed by default, each summary
  showing its place count; a region holding a single state or country (Alaska, National,
  Antarctica) lists its towns directly. `STATE_REGION` / `COUNTRY_REGION` in the script map
  each state and country to the note it was filed in, checked against `import/notes-20261019/`,
  with the user's rulings (2026-10-28): **Virginia is South**; **Alaska stays under the United
  States**; **every US territory outside the 50 states and DC is filed under Territories by its own
  name** (`TERRITORIES`: Puerto Rico, US Virgin Islands, Guam, American Samoa, Northern Mariana
  Islands, US Minor Outlying Islands — each accepts its postal code and common spellings, e.g.
  `U.S. Virgin Islands`, `VI`, `Saipan, MP`); **North America (Canada, Greenland) sits under
  international**; **Cruise sits under Global**; **Armenia is Asia**. Bermuda is Caribbean.
  **Countries on two continents are listed under both** regions, from one entry in
  `TWO_CONTINENTS` (Russia, Turkey, Kazakhstan, Georgia, Azerbaijan: Europe + Asia; Egypt: Africa +
  Asia; Indonesia: Asia + Oceania). Both entries are drawn from the same rows, so they are always
  identical; the city total counts them once; a city page reads `Turkey · Europe / Asia`. Change
  that list in one place, never one region at a time. Multi-place tails: `United States` →
  National, `Europe` / `South America` → that region's `across countries`, `Americas` and `Bike` → Global ▸ Bike (the
  Alaska-to-Tierra-del-Fuego ride), `Cruise` → Global ▸ Cruise. A country not in the map goes to **elsewhere**, last, never hidden — add it to
  `COUNTRY_REGION`. Which dropdowns are open is kept
  per browser in `localStorage` (`oot.openGroups`, ids `Region` and `Region/Sub`), never in the
  workbook. Town rows show only the town; search results and the near-me list keep the full
  `City, ST` / `City, Country`. Search also lists a state's or country's towns when the query is its
  full name (`puerto rico`, `georgia`). A city page's sub-line reads `Arizona · Southwest`.
  Headings (2026.10.20-5, option H "one black rule"): region 15px bold under a single 1px black rule,
  place count muted on the right, no chevron; state/country 15px black, bold while open; town rows
  15px with a bare muted count and no dividers, indented 14px inside a state/country. City names are accent blue since 2026.10.27-1 (blue = tappable, as in
  eat + drink). **Layout (2026.10.28-6) matches eat + drink**: full window width, no column
  and no zoom (the 640px column and wide-window zoom of 2026.10.20-7 / -8 were removed — the
  user found the type too big and the page not filling a stretched window). Header padding
  14px 16px 10px, list 2px 16px, + button 20px from the bottom-right corner, sheets full width,
  form inputs 14px (search 16px) — the same sizes as eat + drink's "minimal" pass. Contrast
  comes from weight and the one rule only; no capitals, bands or icons.
- **Random (2026.10.28-5)**: the `random` chip in the header opens a random **city** (never a
  single place; each city counts once however many places it has). Scope is the dropdown most
  recently opened that is still open and showing — open Europe ▸ Italy and it picks only Italian
  towns, and the chip reads `random in Italy`; a country inside a closed region does not count;
  nothing open = everywhere. The kind and y / - / n filters apply; the same city never comes up
  twice in a row. Open order is the insertion order of `oot.openGroups`; a re-render that
  restores a remembered dropdown does not reorder it.
- **Look (2026.10.27-1)** follows eat + drink's "minimal" pass: accent `#1a4fd6`, hairlines
  `#ececec`, square corners everywhere, underline-only search, text-only filters (blue, bold
  black when on), list items as blue names over a grey sub-line with a hairline below, the + as
  a white box with a hairline border, sheets with a top rule, black primary button. Copy is
  lowercase like eat + drink's.
- **Ordered** replaces eat + drink's Menu Details table: items separated by `; `.
  The detail sheet appends one at a time.
- **Rating** is `y` / `-` / `n` / blank, same as eat + drink.
- **Closed**: any non-empty value means closed (`closed Jun 2026`). Closed rows sort last,
  carry a CLOSED tag and take no rating or ordered items. The detail sheet's **mark as closed**
  writes `closed <Mon YYYY>`; **reopen this place** clears it. Edit and delete sit on the
  detail sheet (as in eat + drink), not in the form.
- **Lat/Lng** exist only to sort cities for *near me*. A new place borrows its city's
  centre when the city is known and no address is typed; otherwise it asks OpenStreetMap
  Nominatim once (4 s timeout). A place without coordinates still saves.

The workbook was built with **xlsxwriter**, not openpyxl (shared strings, a table whose
`tableColumns` match its `ref`). If its structure is ever edited, the eat + drink rule
applies: table ref, `tableColumns count`, number of `tableColumn` elements and the sheet
`dimension` must agree, or Graph refuses the file.

## Writes

Graph can serve the pre-write copy of a table for a moment after a write, so after a write
the local list is the truth and nothing re-reads straight away. Before every PATCH or
DELETE, `liveIndex()` reads the row at the stored index back and checks name + city; if
another device shifted the rows it re-reads the table and finds the place again, and if it
cannot find exactly one it writes nothing. POST returns the new row's index, so a new row
never carries a guessed index. A delete decrements every later index locally.

The page re-reads on `visibilitychange` / `pageshow` / `focus` when the last read is more
than 20 s old, no write happened in the last 10 s, and no sheet is open.

## What it deliberately does not have

No dice (the **random** chip, 2026.10.28-5, picks a location only — see below), no data check, no chain logic, no vendor/section log, no categories in
`localStorage`. If one of these is wanted, add it here rather than porting eat + drink's
version wholesale.

## Auth

Same MSAL app registration as eat + drink (`MSAL_CLIENT_ID`), redirect URI
`https://nameisredacted.github.io/out-of-town/`, added 2026-10-19 to the **food and drink**
app registration (Azure portal ▸ App registrations ▸ food and drink ▸ Authentication ▸
Single-page application). Both apps live on the same origin (`nameisredacted.github.io`),
so they share MSAL's localStorage cache: signed in to one is signed in to the other.

**Signing in without a tap (2026.10.27-1).** The user reported not being signed in
automatically. With no account in the cache (a home-screen copy has its own storage, a new
device, or Safari clearing site data) the page used to stop at a Sign in button. Now
`start()` calls `loginRedirect` straight away; a browser Microsoft already knows comes back
signed in with no prompt. A `sessionStorage` stamp (`oot.autoLoginAt`) stops a loop: if that
round trip came back without an account, or failed, inside two minutes, the button shows
instead. The last username is kept in `localStorage` (`oot.lastUser`) and passed as
`loginHint`. The active account is set explicitly. MSAL is pinned to 3.30.0, the build
eat + drink's `@3` resolves to, so both read the same cache.

MSAL's silent token renewal loads the redirect URI (this page) in a hidden iframe; since
2026.10.27-1 the app does not boot there (`init()` runs only when `window.self === window.top`
or a `window.OOT_BACKEND` is supplied, which the preview does on purpose).

## Preview

`scripts/build_preview.py` (kept in the session, not the repo) strips MSAL, injects an
in-memory backend with the rows, and publishes it as a Claude artifact. Nothing typed into
the preview is saved.

## Testing

`node tests/smoke.mjs` (needs `npm i jsdom`). Run before and after any change.

## Migration log

- 2026-10-13: 28 rows (24 with an out-of-town location, plus 4 blank-location rows whose
  own notes named only non-Bay-Area cities) became **31 places** here, because three of
  those four name two cities each. Their 5 Menu Details rows became the `Ordered` column.
  Coordinates: Census `exact` rows kept theirs; the rest took the Nominatim city centre.
- 2026-10-19: 6 **San Luis Obispo, CA** places and their 10 ordered items moved in (37 places,
  17 cities). They were in the hometown sheet before the first removal but missed it: that pass
  matched a city list frozen at the 2026-10-13 check. Any later sweep must classify every
  Location against the nine-county line, not reuse an earlier list. Backups:
  `archive/Out of Town (pre-SLO 20261019).xlsx`, `archive/Food + Drink (pre-move-out SLO 20261019).xlsx`.
  Left in eat + drink on purpose (no city, so the hometown rule keeps them): Coast Starlight
  (Amtrak), Eureka! and Rookies Sports Lodge (`Chain`).
- 2026-10-19: every place with no Rating was removed — the user called them mistakes (never
  been to Miami). 14 rows went, including Wild Crumb and Centurión Lounge SEA, which carried
  ordered items. Silver Bar & Cocktail Lounge was kept and rated `-` (set through the app, the
  first live write). Now 23 places, 12 cities. Backup:
  `archive/Out of Town (pre-unrated-cleanup 20261019).xlsx`.
- 2026-10-19: Wild Crumb (Bozeman, MT) and Centurión Lounge SEA (Seattle, WA) restored from that
  backup with every field as it was, rated `-`. 25 places, 14 cities.
- 2026-10-20: search input waits 150 ms after typing and lists at most 150 places
  (`SEARCH_CAP`), with a "keep typing" line — needed once the list passed 6,000 rows.
- 2026-10-20: **travel notes import.** Every note under the Apple Notes folder `travel` was copied
  (read-only, from a copy of NoteStore.sqlite; text kept in `import/notes-20261019/`, gitignored)
  and 6,506 eat-or-drink places were added — 6,531 rows, 1,113 cities, 125 countries/states.
  Dishes nested under a place went into To Order. Rating is blank: these are want-to-go places,
  not the "no rating = mistake" rows removed earlier. Names that were not recognised (1,591) each
  got one web search; 449 that a search could not find were still added, Notes "not found online
  (Oct 2026 check)". 8 carry Closed from a web source. Lat/Lng are city centres (Photon / OSM),
  not addresses. Bay Area places from the notes (316) were not added here. Backup:
  `archive/Out of Town (pre-travel-import 20261020).xlsx`.
- 2026-10-27: **restaurant check + travel merge** (backup `archive/Out of Town (pre-travel-merge 20261027).xlsx`).
  Every food row was matched back to its line in `import/notes-20261019/`: 6,186 sat under a
  heading naming their city; 121 more named it in a heading just above; the other 166 were read
  one by one and ~30 checked online. Fixed: Double Luck (Anaheim → Miami), Levain (Kaysersberg →
  Arles), Bourbon Steak (DC → New York), Libération produce market (Rabat → Nice), Coquette →
  Sainte-Anne-de-Beaupré, Microbrasserie Shawbridge → Prévost, Breedy's → `Sint Maarten, Sint
  Maarten`; no-city rows placed: Sunday (St. Augustine), To Be Determined (Miami), Ken's and
  Kessler's (Aberdeen, SD). Removed: Eight North, Bistro Lagniappe, George + Kin's, Ferry
  Building (hometown), Alyvia (among Bay Area hotels, not found), "the lime" (a Grenada district
  used as a heading), twins HumoySal / DBA / frank fats. `, Scotland` cities became
  `, United Kingdom` (one twin dropped). The 449 "not found online" rows were not re-checked.
  Same-name headings (Berlin, Lagos, Providence, Versailles…) were checked: each of those rows
  also has its own line under the real city, so they stay.
  Then the **rest of the travel notes** (14,846 lines not yet in the app) were sorted line by line
  into heading / place / sub-item / note, and 9,576 places added with a Kind: see + do 5,820,
  stay 2,604, shop 762, golf 229, eat + drink 86 (misses from the first import), ski 75. 639
  sub-items (dishes, trails, courses, rooms) went onto their parent's To Order / To Do; 74 notes
  onto Notes. Left out and listed in `import/not-imported-20261027.txt` (gitignored): 582 Bay
  Area places, 103 with no single town (cruise ships, statewide trails), 85 sub-items under a
  bare heading. Lat/Lng for new cities are Photon city centres (`lang=en`, place tags first,
  country/state checked; 32 cities found nothing). Now 16,158 rows. Built with xlsxwriter,
  table `A1:L16159`, 12 tableColumns, dimension agrees; every pre-existing row compared cell
  by cell against the backup — only the changes above differ.
- 2026-10-27 (later): the **103 places with no single town** were placed, by the user's rule: use
  the note they are in, how they were filed, and what the line itself says — never a vague
  bucket. Route-type lines use their own endpoints (`Canterbury to Rome, Europe`, `Chicago to
  Santa Monica, United States`, `Denver to Durango, CO`); lines filed under a town take that town
  (Orient Express → Valletta, Malta; Lawson → Toyama); truly statewide passes and birding-trail
  networks stay `Statewide, ST`; the Cruise note's ships use `<waters>, Cruise`; the rotating
  NCAA / Army-Navy events use their next confirmed host (sources in Notes); 53 were looked up
  online. Multi-state rows (`…, United States`) group under the US heading as **across states**,
  after the states (2026.10.27-2). Only the Bay Trail, Bay Area Ridge Trail and New Tree Ranch
  (Bay Area block) stay out. The 3 Marseille foods filed under the Marseille heading
  (navettes, sardines, panisses) became eat + drink rows, category Local Specialty. The 73
  remaining sub-items all belong to Bay Area places and stay out with them. Now 16,261 rows.
  Backup `archive/Out of Town (pre-multi-place 20261027).xlsx`; list of what is out:
  `import/not-imported-20261027b.txt`.
- 2026-10-27 (later): **recheck of the "not found online" rows**, two rounds of one web search
  each (442 of 444; DLT and Maple, London, still to do). Every suggested change was checked
  against where the line sits in the notes before it was applied — the searches proposed moving
  La Hacienda (Guadalajara) and Stella's (Gulfport, MS) to places that are already their own
  rows or that the notes contradict, and those were refused. Applied: 56 found (note cleared to
  "found online (Oct 2026 recheck)", 4 of them "found only as a directory listing"), 22 names
  corrected (the notes' spelling kept in Notes), 12 towns corrected, 9 not eat + drink (Kind
  changed: Besso and Sasayuri-ann → stay, Brusk / Contramurada → see + do, Polonio / Despiral /
  Miss Arthur → shop), Coola Boola (Coimbra) Closed Dec 2024. Three rows were twins the first
  import had filed in a wrong city from the same note line (Fausto in Cales Fonts, the Spot in
  Dresden, OMA in Fukuoka) and were removed; Francie's merged into Francie. City spellings
  `Chang Rai` → `Chiang Rai`, `San Pacho` → `San Pancho`. 347 rows now say "not found online
  (rechecked Oct 2026)". 16,257 rows. Backups `archive/Out of Town (pre-recheck 20261027).xlsx`
  and `(pre-recheck-2 20261027).xlsx`.
- 2026-10-27: the user said **drop the 347** still-not-found rows. All were eat + drink from the
  first import, none rated, ordered or closed (3 carried To Order items). Removed; listed in
  `import/dropped-notfound-20261027.tsv` (gitignored). Every other row's coordinates were kept
  from the previous build so no city centre moved; nothing else changed (cell-by-cell check).
  DLT and Maple (London) were never rechecked and stay. 15,910 rows. Backup
  `archive/Out of Town (pre-drop-notfound 20261027).xlsx`.
- 2026-10-27: **guessed-type review, round 1 of ~4.** 814 places carried a kind/category the
  note sort had guessed ("unsure" in its notes). One web search each, ~200 a round; every
  suggestion read before applying (a move of Stoneridge Estate from Waiheke to a Queenstown lodge
  was refused — the note files it on Waiheke). Round 1: 111 confirmed, 55 kind/category fixed
  (e.g. Pocketbook Hudson → stay, Radio Tave → Meow Wolf exhibit, The Lynx → bookstore), 7 towns
  made specific within the filed region (Camptown → Leeds, NY; Our Habitas on Hudson → Staatsburg),
  49 still unconfirmed (Notes: "type not confirmed online (Oct 2026)"). Answers given "without a
  search" were not accepted and go back in the queue. 598 left (`work/rv2_*.tsv` in the session).
  Backup `archive/Out of Town (pre-type-review 20261027).xlsx`.
- 2026-10-27: **guessed-type review, round 2.** Running totals: 222 confirmed, 98 kind/category
  fixed (round 2 e.g. LUDÕ → a show, Harper's Bangkok and Peninsula House (Penang) → restaurants,
  House of Tugu / HL 309 / Hibird → hotels, the Atlantic Club Comporta → resort), 24 towns made
  specific inside the filed region (Hotel Tyrol → Selva di Val Gardena, Shiguchi → Kutchan,
  Bratus Hotel → Aqaba), Green Heron B&B (Grand Rapids, MN) closed, 76 unconfirmed. A "not found"
  from a search that lumped several names with OR is not taken as a miss — it goes back in the
  queue. 416 left. Backup `archive/Out of Town (pre-type-review-2 20261027).xlsx`.
- 2026-10-27: **guessed-type review, round 3** (one search per place, no lumped OR searches).
  Running totals: 311 confirmed, 147 kind/category fixed (round 3 e.g. The Portland Zoo → a bar,
  The Moore Miami / Lopud 1483 / Karl August → stay, Antiquus (Zadar) → sushi restaurant,
  Lou Passagin → Nice's port ferry), 30 towns made specific, 132 unconfirmed; 222 left.
  Renamed: Ashen Rail Trail → Ashokan Rail Trail, Mont des Morious → Mont des Morios. LXR Hotels &
  Resorts (the brand line under SAX Paris) folded into SAX Paris. Guess-words from the sort
  ("likely …", "possibly …", first-person asides) are no longer carried into Notes; the person's
  own words from the notes still are.
  **Map centres corrected.** A city whose rows sit more than 80 km from where the city actually
  is now takes the looked-up centre (`build_wb.py`): the first import had put every Catskills
  and Hamptons row on New York City, the Hebridean isles on the Isle of Wight, the Oregon Coast /
  Cascades / Outback on Oregon City, the Tuscan Archipelago on La Maddalena, and moved rows
  (Libération market, Bourbon Steak) kept their old city's point. Lookups: Photon first,
  Nominatim second opinion, an answer kept only when its name shares a distinctive word with
  the place and the country matches (territories accept their sovereign country). 99 cities /
  255 rows re-centred; 39 rows have no centre. Backup
  `archive/Out of Town (pre-type-review-3 20261027).xlsx`.
- 2026-10-27: **guessed-type review, round 4.** Final totals over the 814: 406 confirmed,
  195 kind/category fixed, 36 towns made specific inside the filed region, 189 not confirmed
  online (Notes "type not confirmed online (Oct 2026)"), 22 not reached (Notes "type not yet
  checked online (Oct 2026)", queue in the session's `work/rv5_00.tsv`). Searching the app for
  "type not" lists them. Names corrected: Meissl & Schadn, PURO Gdańsk Stare Miasto, Grand
  Juste, Ausseer Handdrucke, Kaohu Store. Refused: two kind changes resting on inference (The
  Bunker, La Quinta) and moving David's Hole to the Dutch side. DLT (London) searched once more,
  not found, dropped with the 347; Maple (London) kept as a weak match. 15,908 rows. Backup
  `archive/Out of Town (pre-type-review-4 20261027).xlsx`.

- 2026-10-27: **travel notes deleted from Apple Notes** (user: "for total committal delete the
  relevant notes app files", keeping the two `local` notes). Before deleting, the current notes were
  compared with the Oct 19 copy: 9 had been edited since (south, West, National, midwest, east,
  mexico / latin / south america, asia, europe, africa). Their new lines went in first — 71 places
  added, To Do added to Tenement Museum (Museum shop) and Crossroads Arts District (Art alley
  corridor), Chiricahua National Monument renamed Chiricahua National Park as the note now reads.
  Lines that repeat a place already in the app were not added again (Four Seasons Hotel Austin,
  Heywood Hotel, St. Regis Punta Mita Resort, The Mining Exchange, The Rabbit Books & Bar, Book Club
  Bar). 15,979 rows. Backup `archive/Out of Town (pre-notes-delta 20261027).xlsx`; current text of
  the 10 notes checked is in `import/notes-20261027/` (gitignored), the rest in `import/notes-20261019/`.
  Deleted in Notes: folders travel/to play (with international), to visit/international,
  north america, skiing, family, and the 5 notes in travel/to visit — 36 notes, in Recently Deleted
  for 30 days. Left: travel/to visit/local (`local`, `go to tamales bay`).
- 2026-10-28: **renamed travel; index rebuilt on the notes' filing** (2026.10.28-1; corrected in
  2026.10.28-2 to -4: Virginia South, US territories and Alaska under `united states`, Armenia Asia,
  two-continent countries in both regions — see Data model).
  No workbook change (15,979 rows). Every row lands in a named region; nothing falls to
  `elsewhere`.
