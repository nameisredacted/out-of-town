# out of town — working notes

Stripped-down city directory for places outside the hometown list. Separate from
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

`Name | Category | City | Rating | To Order | Ordered | Notes | Address | Lat | Lng | Closed`

- **Identity is name + city.** The same name in two cities is two rows (All'antico Vinaio
  is in New York and Los Angeles). A twin name + city is refused on add and on rename.
- **City** is `City, ST` for the US, `City, Country` elsewhere. `canonCity()` snaps a typed
  city to an existing spelling (case, spacing and accents ignored) and upper-cases a known
  state code, so `phoenix,  az` becomes `Phoenix, AZ`. The index (2026.10.20-2) puts every
  US city under one **United States** heading, first, with a state subheading for each state;
  every other city is grouped under its country (the part after the last comma). City rows
  under a heading show only the town — the heading already says the state or country.
  Search results and the near-me list keep the full `City, ST` / `City, Country`.
  Each country is a collapsible `<details class="country">` (2026.10.20-4), closed by default,
  its summary showing places · cities; which ones are open is remembered per browser in
  `localStorage` (`oot.openCountries`), never in the workbook. Headings: country 19px bold with
  a rule, state 12px uppercase in the accent, cities plain body text.
- **Ordered** replaces eat + drink's Menu Details table: items separated by `; `.
  The detail sheet appends one at a time.
- **Rating** is `y` / `-` / `n` / blank, same as eat + drink.
- **Closed**: any non-empty value means closed (`closed Jun 2026`). Closed rows sort last,
  carry a CLOSED tag and take no rating or ordered items.
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

No dice, no data check, no chain logic, no vendor/section log, no categories in
`localStorage`. If one of these is wanted, add it here rather than porting eat + drink's
version wholesale.

## Auth

Same MSAL app registration as eat + drink (`MSAL_CLIENT_ID`), redirect URI
`https://nameisredacted.github.io/out-of-town/`, added 2026-10-19 to the **food and drink**
app registration (Azure portal ▸ App registrations ▸ food and drink ▸ Authentication ▸
Single-page application). Both apps live on the same origin (`nameisredacted.github.io`),
so they share MSAL's localStorage cache: signed in to one is signed in to the other.

Known noise: MSAL's silent token renewal loads the redirect URI (this page) in a hidden
iframe, the app boots inside it, and the console logs `block_iframe_reload`. Harmless.
If it ever matters, skip `init()` when `window.self !== window.top` and no
`window.OOT_BACKEND` is set (the preview runs in an iframe on purpose).

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
