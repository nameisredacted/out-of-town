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
| Live site | https://nameisredacted.github.io/out-of-town/ (GitHub Pages, `main`) — repo still to be created |
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
  state code, so `phoenix,  az` becomes `Phoenix, AZ`. The index groups by the part after
  the last comma (state codes become state names).
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
`https://nameisredacted.github.io/out-of-town/`. That URI has to be added to the app
registration (Azure portal ▸ App registrations ▸ the eat + drink app ▸ Authentication ▸
Single-page application ▸ Add URI) before sign-in works on the new site.

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
