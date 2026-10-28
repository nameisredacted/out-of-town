// Smoke tests for travel (the out-of-town repo). jsdom, an in-memory backend, no network, no OneDrive.
// Run: node tests/smoke.mjs   (npm i jsdom once)
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8')
  .replace(/<!--MSAL-->[\s\S]*?<!--\/MSAL-->/, '');

const COLS = ['name','category','city','rating','toOrder','ordered','notes','address','lat','lng','closed','kind'];
const seed = [
  { name: 'Bar Pitti', category: 'Italian', city: 'New York, NY', rating: 'y', lat: '40.729', lng: '-74.002' },
  { name: "Salt Hank's", category: 'Sandwiches', city: 'New York, NY', lat: '40.731', lng: '-74.003' },
  { name: 'FreeForm Coffee Roasters', category: 'Coffee', city: 'Sedona, AZ', rating: 'y', lat: '34.86', lng: '-111.76' },
  { name: 'Vino di Sedona', category: 'Restaurant', city: 'Sedona, AZ', rating: 'n', lat: '34.86', lng: '-111.80' },
  { name: 'Wild Crumb', category: 'Bakery', city: 'Bozeman, MT', ordered: 'Sugar Cookie; Chocolate Cookie', lat: '45.68', lng: '-111.04' },
];

function memBackend(rows){
  const table = rows.map(r => COLS.map(c => r[c] || ''));
  const obj = (vals, i) => { const o = { index: i }; COLS.forEach((c, j) => o[c] = vals[j]); return o; };
  const log = [];
  return {
    live: false, table, log,
    async list(){ return table.map((v, i) => obj(v.slice(), i)); },
    async rowAt(i){ return table[i] ? obj(table[i].slice(), i) : null; },
    async add(rec){ table.push(COLS.map(c => rec[c] || '')); log.push(['add', rec.name]); return table.length - 1; },
    async update(i, rec){ table[i] = COLS.map(c => rec[c] || ''); log.push(['update', i, rec.name]); },
    async remove(i){ table.splice(i, 1); log.push(['remove', i]); },
  };
}

async function app(rows = seed){
  const backend = memBackend(rows);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/',
    beforeParse(w){ w.OOT_BACKEND = backend; w.alert = m => (w.__alerts = (w.__alerts || [])).push(m); w.confirm = () => true; w.scrollTo = () => {}; }
  });
  await tick(dom);
  return { dom, w: dom.window, d: dom.window.document, backend };
}
const tick = (dom, ms = 20) => new Promise(r => dom.window.setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, msg){ if(cond){ pass++; } else { fail++; console.log('FAIL:', msg); } }

// 1. index follows the travel notes: area label ▸ region ▸ state ▸ town, all closed; US regions under united states
{
  const { d } = await app();
  const areas = [...d.querySelectorAll('.area')].map(e => e.textContent);
  ok(JSON.stringify(areas) === JSON.stringify(['united states']), 'area labels: ' + areas);
  const regions = [...d.querySelectorAll('.region')].map(e => (e.firstElementChild || e).textContent);
  ok(JSON.stringify(regions) === JSON.stringify(['West', 'Southwest', 'East']), 'regions in notes order: ' + regions);
  ok(d.querySelectorAll('details.country').length === 3 && [...d.querySelectorAll('details.country')].every(e => !e.open), 'regions collapsed by default');
  ok(d.querySelectorAll('details.sub').length === 0, 'a region with one state lists its towns directly');
  ok([...d.querySelectorAll('.city .cn')].map(e => e.textContent).join('|') === 'Bozeman|Sedona|New York', 'town names without state: ' + [...d.querySelectorAll('.city .cn')].map(e => e.textContent));
  ok(d.querySelector('.note').textContent.includes('3 cities · 5 places'), 'count line');
  ok([...d.querySelectorAll('.rcount')].map(e => e.textContent).join() === '1,2,2', 'region counts: ' + [...d.querySelectorAll('.rcount')].map(e => e.textContent));
  ok([...d.querySelectorAll('.city .cc')].every(e => /^\d+$/.test(e.textContent)), 'city rows show a bare count');
}

// 2. city view sorts y first, n last
{
  const { d, dom } = await app();
  d.querySelector('.city[data-city="Sedona, AZ"]').click(); await tick(dom);
  const names = [...d.querySelectorAll('.item-name')].map(e => e.textContent);
  ok(names[0] === 'FreeForm Coffee Roasters' && names[1] === 'Vino di Sedona', 'sedona order: ' + names);
  ok(d.querySelector('#addHere').textContent.includes('Sedona'), 'add-here button names the city');
}

// 3. adding to a new city with sloppy case creates one canonical city; same city snaps
{
  const { d, dom, w, backend } = await app();
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'Pizzeria Bianco';
  d.getElementById('f_city').value = 'phoenix,  az';
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.at(-1)[2] === 'Phoenix, AZ', 'new city canonicalised: ' + backend.table.at(-1)[2]);
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'Tacos Chiwas';
  d.getElementById('f_city').value = 'PHOENIX, az';
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.at(-1)[2] === 'Phoenix, AZ', 'second entry snaps to existing spelling');
  ok(w.__oot.state.view === 'city' && w.__oot.state.city === 'Phoenix, AZ', 'lands on the city after add');
  ok(d.getElementById('detailSheet').classList.contains('open'), 'opens the new place');
}

// 4. duplicate name + city is refused, same name in another city is allowed
{
  const { d, dom, w, backend } = await app();
  const n = backend.table.length;
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'bar pitti';
  d.getElementById('f_city').value = 'new york, ny';
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.length === n, 'twin not written');
  ok((w.__alerts || []).some(a => a.includes('already on the list')), 'twin message');
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'Bar Pitti';
  d.getElementById('f_city').value = 'Miami Beach, FL';
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.length === n + 1, 'same name, other city, is written');
}

// 5. edit keeps every column and writes the same row (no second row)
{
  const { d, dom, backend } = await app();
  const n = backend.table.length;
  d.querySelector('.city[data-city="Bozeman, MT"]').click(); await tick(dom);
  d.querySelector('.item').click(); await tick(dom);
  d.getElementById('editBtn').click(); await tick(dom);
  d.getElementById('f_notes').value = 'next to the bookstore';
  d.getElementById('saveBtn').click(); await tick(dom);
  const row = backend.table[4];
  ok(backend.table.length === n, 'edit did not append');
  ok(row[6] === 'next to the bookstore' && row[5] === 'Sugar Cookie; Chocolate Cookie' && row[8] === '45.68', 'edit kept ordered + coords: ' + row);
}

// 6. rating toggles and ordered items append
{
  const { d, dom, backend } = await app();
  d.querySelector('.city[data-city="New York, NY"]').click(); await tick(dom);
  [...d.querySelectorAll('.item')].find(e => e.textContent.includes("Salt Hank")).click(); await tick(dom);
  d.querySelector('.rateBtn.y').click(); await tick(dom);
  ok(backend.table[1][3] === 'y', 'rating set');
  d.querySelector('.rateBtn.y').click(); await tick(dom);
  ok(backend.table[1][3] === '', 'rating toggled off');
  d.getElementById('orderedAdd').value = 'Double Smash';
  d.getElementById('orderedAddBtn').click(); await tick(dom);
  d.getElementById('orderedAdd').value = 'Fries';
  d.getElementById('orderedAddBtn').click(); await tick(dom);
  ok(backend.table[1][5] === 'Double Smash; Fries', 'ordered appended: ' + backend.table[1][5]);
}

// 7. a row shifted by another device is found again, not overwritten
{
  const { d, dom, backend } = await app();
  d.querySelector('.city[data-city="Sedona, AZ"]').click(); await tick(dom);
  [...d.querySelectorAll('.item')].find(e => e.textContent.includes('Vino')).click(); await tick(dom);
  backend.table.splice(0, 1);                 // another device deleted row 0
  d.querySelector('.rateBtn.d').click(); await tick(dom);
  ok(backend.table[2][0] === 'Vino di Sedona' && backend.table[2][3] === '-', 'wrote the shifted row');
  ok(backend.table[1][0] === 'FreeForm Coffee Roasters' && backend.table[1][3] === 'y', 'neighbour untouched');
}

// 8. delete removes the row and fixes later indexes
{
  const { d, dom, w, backend } = await app();
  d.querySelector('.city[data-city="New York, NY"]').click(); await tick(dom);
  [...d.querySelectorAll('.item')].find(e => e.textContent.includes('Bar Pitti')).click(); await tick(dom);
  d.getElementById('deleteBtn').click(); await tick(dom);
  ok(backend.table.length === 4 && !backend.table.some(r => r[0] === 'Bar Pitti'), 'deleted');
  const wc = w.__oot.places.find(p => p.name === 'Wild Crumb');
  ok(wc.index === 3, 'later index shifted: ' + wc.index);
  d.querySelector('.city[data-city="Bozeman, MT"]') || w.__oot.openCity('Bozeman, MT');
  w.__oot.openCity('Bozeman, MT'); await tick(dom);
  d.querySelector('.item').click(); await tick(dom);
  d.querySelector('.rateBtn.n').click(); await tick(dom);
  ok(backend.table[3][0] === 'Wild Crumb' && backend.table[3][3] === 'n', 'write after delete hits the right row');
}

// 9. search finds cities and places, including ordered items
{
  const { d, dom } = await app();
  const q = d.getElementById('q');
  q.value = 'sedona'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  ok(d.querySelectorAll('.city').length === 1 && d.querySelectorAll('.item').length >= 1, 'city + place hit');
  q.value = 'chocolate'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  ok(d.querySelector('.item-name').textContent === 'Wild Crumb', 'ordered item searchable');
  q.value = 'zzzz'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  ok(d.querySelector('.note').textContent.includes('nothing matches'), 'empty result copy');
}

// 10. closed places: tagged, last in the city, no rating buttons
{
  const rows = seed.map(r => Object.assign({}, r));
  rows[2].closed = 'closed Jun 2026';
  const { d, dom } = await app(rows);
  d.querySelector('.city[data-city="Sedona, AZ"]').click(); await tick(dom);
  const items = [...d.querySelectorAll('.item')];
  ok(items.at(-1).textContent.includes('FreeForm') && items.at(-1).querySelector('.closedtag'), 'closed sorts last with tag');
  items.at(-1).click(); await tick(dom);
  ok(!d.querySelector('#detailBody .rateBtn') && !d.getElementById('orderedAdd') && !d.getElementById('toOrderAdd') && !d.getElementById('editBtn'), 'closed is read-only');
}

// 11. near me sorts cities by distance
{
  const { d, dom, w } = await app();
  Object.defineProperty(w.navigator, 'geolocation', { value: { getCurrentPosition: res => res({ coords: { latitude: 33.45, longitude: -112.07 } }) } });
  d.getElementById('nearBtn').click(); await tick(dom, 40);
  const first = d.querySelector('.city').dataset.city;
  ok(first === 'Sedona, AZ', 'nearest to Phoenix is Sedona: ' + first);
  ok(d.querySelector('.city .cc').textContent.includes('mi'), 'distance shown');
}

// 12. search over thousands of places is capped
{
  const many = [];
  for (let i = 0; i < 400; i++) many.push({ name: 'Cafe ' + i, city: 'Paris, France', lat: '48.85', lng: '2.35' });
  const { d, dom } = await app(many);
  const q = d.getElementById('q');
  q.value = 'cafe'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  ok(d.querySelectorAll('.item').length === 150, 'search capped at 150: ' + d.querySelectorAll('.item').length);
  ok([...d.querySelectorAll('.note')].some(n => n.textContent.includes('of 400')), 'cap message');
}

// 13. international regions after north america; countries are dropdowns inside a region
{
  const rows = seed.concat([
    { name: 'Septime', city: 'Paris, France' }, { name: 'Noma', city: 'Copenhagen, Denmark' },
    { name: 'Sushi Saito', city: 'Tokyo, Japan' }, { name: 'Pujol', city: 'Mexico City, Mexico' },
  ]);
  const { d } = await app(rows);
  const areas = [...d.querySelectorAll('.area')].map(e => e.textContent);
  ok(JSON.stringify(areas) === JSON.stringify(['united states', 'international']), 'two areas: ' + areas);
  const regions = [...d.querySelectorAll('.region')].map(e => (e.firstElementChild || e).textContent);
  ok(JSON.stringify(regions) === JSON.stringify(['West', 'Southwest', 'East', 'Mexico / Latin / South America', 'Europe', 'Asia']), 'region order: ' + regions);
  const europe = d.querySelector('details.country[data-g="Europe"]');
  const subs = [...europe.querySelectorAll('details.sub > summary span:first-child')].map(e => e.textContent);
  ok(JSON.stringify(subs) === JSON.stringify(['Denmark', 'France']), 'countries inside Europe: ' + subs);
  ok(!europe.querySelector('details.sub').open, 'countries collapsed by default');
  ok([...europe.querySelectorAll('.city .cn')].some(e => e.textContent === 'Paris'), 'Paris shown without France');
}

// 13b. filed where the notes filed them; open dropdowns are remembered
{
  const rows = [
    { name: 'El San Juan', city: 'San Juan, PR' }, { name: 'The Inn at Little Washington', city: 'Washington, VA' },
    { name: 'Rose Hall', city: 'Montego Bay, Jamaica' }, { name: 'Ciya', city: 'Istanbul, Turkey' },
    { name: 'Fabrika', city: 'Tbilisi, Georgia' }, { name: 'Two Sisters', city: 'Atlanta, GA' },
    { name: 'Somewhere', city: 'Ulaanbaatar, Mongolia' }, { name: 'Odd One', city: 'Nowhere, Atlantis' },
    { name: 'Sobo', city: 'Tofino, Canada' }, { name: 'Ochre', city: 'Cairns, Australia' },
    { name: 'Tamarind', city: 'Christiansted, US Virgin Islands' }, { name: 'Crow\'s Nest', city: 'Anchorage, AK' },
    { name: 'Lavash', city: 'Yerevan, Armenia' },
    { name: 'Hotel Arctic', city: 'Ilulissat, Greenland' }, { name: 'Meskla', city: 'Hagåtña, Guam' }, { name: 'Gladys', city: 'Charlotte Amalie, U.S. Virgin Islands' }, { name: 'Kalachucha', city: 'Saipan, MP' },
  ];
  const { d, dom, w } = await app(rows);
  const where = c => [...d.querySelectorAll(`.city[data-city="${c}"]`)].map(e => e.closest('details.country').dataset.g).join('+');
  ok(where('San Juan, PR') === 'Territories' && where('Montego Bay, Jamaica') === 'Caribbean', 'Puerto Rico under the US: ' + where('San Juan, PR'));
  ok(where('Washington, VA') === 'South', 'Virginia in the South');
  ok(where('Istanbul, Turkey') === 'Europe+Asia' && where('Tbilisi, Georgia') === 'Europe+Asia' && where('Atlanta, GA') === 'South', 'two-continent countries in both; GA South');
  const areaOf = g => { let e = d.querySelector(`details.country[data-g="${g}"]`); while(e && !e.classList.contains('area')) e = e.previousElementSibling; return e && e.textContent; };
  ok(areaOf('Territories') === 'united states' && areaOf('North America') === 'international' && !d.querySelector('.area') .textContent.includes('north'), 'territories under united states, North America under international');
  ok(where('Nowhere, Atlantis') === 'elsewhere', 'unknown country kept, under elsewhere');
  ok(where('Christiansted, US Virgin Islands') === 'Territories' && where('Anchorage, AK') === 'Alaska' && areaOf('Alaska') === 'united states', 'USVI + Alaska under the US');
  ok(where('Yerevan, Armenia') === 'Asia', 'Armenia in Asia');
  ok(where('Tofino, Canada') === 'North America' && d.querySelector('details.sub[data-g="North America/Canada"]'), 'Canada is a country inside North America');
  ok(where('Hagåtña, Guam') === 'Territories' && where('Charlotte Amalie, U.S. Virgin Islands') === 'Territories' && where('Saipan, MP') === 'Territories', 'every territory, any spelling');
  ok(d.querySelector('details.sub[data-g="Territories/US Virgin Islands"] .rcount').textContent === '2', 'one name per territory: ' + [...d.querySelectorAll('details.country[data-g="Territories"] summary span:first-child')].map(e => e.textContent));
  ok(d.querySelector('.region:last-of-type') && [...d.querySelectorAll('.region')].at(-1).firstElementChild.textContent === 'elsewhere', 'elsewhere last');
  const asia = d.querySelector('details.country[data-g="Asia"]');
  asia.open = true; asia.dispatchEvent(new dom.window.Event('toggle'));
  const geo = asia.querySelector('details.sub[data-g="Asia/Georgia"]');
  geo.open = true; geo.dispatchEvent(new dom.window.Event('toggle'));
  await tick(dom);
  w.__oot.render();
  ok(d.querySelector('details.country[data-g="Asia"]').open && d.querySelector('details.sub[data-g="Asia/Georgia"]').open, 'open dropdowns survive a re-render');
  const q = d.getElementById('q');
  q.value = 'puerto rico'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  ok([...d.querySelectorAll('.city')].some(e => e.dataset.city === 'San Juan, PR'), 'a state name finds its towns');
  q.value = ''; q.dispatchEvent(new dom.window.Event('input')); await tick(dom, 250);
  w.__oot.openCity('San Juan, PR'); await tick(dom);
  ok(d.querySelector('.cityhead .sub').textContent.startsWith('Puerto Rico · Territories'), 'city page says where: ' + d.querySelector('.cityhead .sub').textContent);
  w.__oot.openCity('Tofino, Canada'); await tick(dom);
  ok(d.querySelector('.cityhead .sub').textContent.startsWith('Canada · North America'), 'Canada · North America: ' + d.querySelector('.cityhead .sub').textContent);
}

// 14. To Order box: add an item, then "ate it" moves it to Ordered
{
  const { d, dom, backend } = await app();
  d.querySelector('.city[data-city="New York, NY"]').click(); await tick(dom);
  [...d.querySelectorAll('.item')].find(e => e.textContent.includes('Salt Hank')).click(); await tick(dom);
  ok(d.querySelector('#detailBody label').parentElement && [...d.querySelectorAll('#detailBody label')].some(l => l.textContent === 'To Order'), 'To Order box shown');
  d.getElementById('toOrderAdd').value = 'Double Smash';
  d.getElementById('toOrderAddBtn').click(); await tick(dom);
  d.getElementById('toOrderAdd').value = 'Fries';
  d.getElementById('toOrderAddBtn').click(); await tick(dom);
  ok(backend.table[1][4] === 'Double Smash; Fries', 'to order appended: ' + backend.table[1][4]);
  ok(d.querySelectorAll('#detailBody .wantrow').length === 2, 'two to-order rows');
  d.querySelector('#detailBody .ate[data-i="0"]').click(); await tick(dom);
  ok(backend.table[1][4] === 'Fries' && backend.table[1][5] === 'Double Smash', 'ate it moves the item: ' + backend.table[1].slice(4, 6));
  const it = [...d.querySelectorAll('.item')].find(e => e.textContent.includes('Salt Hank'));
  ok(it.querySelector('.toorder').textContent.includes('Fries'), 'list shows what is left to order');
}

// 15. kinds: sections on a city page, "To Do" wording, kind filter on the index
{
  const rows = seed.concat([
    { name: 'Enchantment Resort', category: 'Resort', city: 'Sedona, AZ', kind: 'stay', toOrder: 'Mii amo spa', lat: '34.9', lng: '-111.8' },
    { name: 'Cathedral Rock', category: 'Trail', city: 'Sedona, AZ', kind: 'see + do', lat: '34.82', lng: '-111.79' },
    { name: 'TPC Scottsdale', category: 'Golf Course', city: 'Scottsdale, AZ', kind: 'golf', lat: '33.64', lng: '-111.91' },
  ]);
  const { d, dom, w, backend } = await app(rows);
  d.querySelector('.city[data-city="Sedona, AZ"]').click(); await tick(dom);
  const heads = [...d.querySelectorAll('.kindhead span:first-child')].map(e => e.textContent);
  ok(JSON.stringify(heads) === JSON.stringify(['eat + drink', 'stay', 'see + do']), 'kind sections: ' + heads);
  [...d.querySelectorAll('.item')].find(e => e.textContent.includes('Enchantment')).click(); await tick(dom);
  ok([...d.querySelectorAll('#detailBody label')].some(l => l.textContent === 'To Do') && d.querySelector('#detailBody .ate').textContent === 'done', 'non-food wording');
  d.querySelector('#detailBody .ate').click(); await tick(dom);
  ok(backend.table[5][4] === '' && backend.table[5][5] === 'Mii amo spa' && backend.table[5][11] === 'stay', 'done keeps kind: ' + backend.table[5]);
  w.__oot.state.view = 'index';
  const sel = d.getElementById('kindSel'); sel.value = 'golf'; sel.dispatchEvent(new dom.window.Event('change')); await tick(dom);
  ok(d.querySelectorAll('.city').length === 1 && d.querySelector('.city').dataset.city === 'Scottsdale, AZ', 'golf filter leaves one city');
  ok(d.querySelector('.note').textContent.includes('1 city · 1 place'), 'filtered count line: ' + d.querySelector('.note').textContent);
  sel.value = ''; sel.dispatchEvent(new dom.window.Event('change')); await tick(dom);
  d.querySelector('.chip[data-rating="y"]').click(); await tick(dom);
  ok(d.querySelector('.note').textContent.includes('2 places'), 'rating filter: ' + d.querySelector('.note').textContent);
}

// 16. adding a place writes its kind; a blank kind reads as eat + drink
{
  const { d, dom, backend } = await app();
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'Amangiri';
  d.getElementById('f_city').value = 'Canyon Point, UT';
  d.getElementById('f_kind').value = 'stay'; d.getElementById('f_kind').dispatchEvent(new dom.window.Event('change'));
  ok(d.getElementById('f_toOrderLabel').textContent === 'To Do', 'form wording follows kind');
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.at(-1)[11] === 'stay', 'kind written: ' + backend.table.at(-1));
  d.querySelector('.city[data-city="Bozeman, MT"]') ;
}

// 17. the page does not boot inside MSAL's hidden renewal iframe
{
  const src = html;
  ok(/if\(window\.self === window\.top \|\| window\.OOT_BACKEND\) init\(\);/.test(src), 'iframe guard present');
  ok(/loginRedirect\(Object\.assign\(\{ scopes: GRAPH_SCOPES \}, hint\(\)\)\)/.test(src) && /AUTO_TRY/.test(src), 'signs in without a tap, once');
}

// 17b. a two-continent country is one set of rows shown twice: a change shows in both places
{
  const rows = [{ name: 'Ciya', city: 'Istanbul, Turkey' }, { name: 'Mikla', city: 'Istanbul, Turkey' }, { name: 'Septime', city: 'Paris, France' }, { name: 'Den', city: 'Tokyo, Japan' }];
  const { d, dom, w, backend } = await app(rows);
  const counts = () => ['Europe', 'Asia'].map(r => d.querySelector(`details.sub[data-g="${r}/Turkey"] .rcount`).textContent).join();
  ok(counts() === '2,2', 'same count in both: ' + counts());
  ok(d.querySelector('.note').textContent.includes('3 cities · 4 places'), 'counted once in the total: ' + d.querySelector('.note').textContent);
  d.getElementById('fab').click();
  d.getElementById('f_name').value = 'Karaköy Lokantası';
  d.getElementById('f_city').value = 'istanbul, turkey';
  d.getElementById('saveBtn').click(); await tick(dom);
  ok(backend.table.length === 5, 'one row written, not two');
  w.__oot.state.view = 'index'; w.__oot.render();
  ok(counts() === '3,3', 'both updated together: ' + counts());
  w.__oot.openCity('Istanbul, Turkey'); await tick(dom);
  ok(d.querySelector('.cityhead .sub').textContent.startsWith('Turkey · Europe / Asia'), 'city page names both: ' + d.querySelector('.cityhead .sub').textContent);
}

// 18. multi-state places sit under National, multi-country routes under their region
{
  const rows = seed.concat([
    { name: 'Route 66', category: 'Scenic Drive', city: 'Chicago to Santa Monica, United States', kind: 'see + do' },
    { name: 'Via Francigena', category: 'Trail', city: 'Canterbury to Rome, Europe', kind: 'see + do' },
    { name: 'Septime', city: 'Paris, France' },
    { name: 'Paul Gauguin', city: 'French Polynesia, Cruise', kind: 'stay' },
  ]);
  const { d } = await app(rows);
  const regions = [...d.querySelectorAll('.region')].map(e => (e.firstElementChild || e).textContent);
  ok(JSON.stringify(regions) === JSON.stringify(['West', 'Southwest', 'East', 'National', 'Europe', 'Global']), 'Cruise under Global: ' + regions);
  ok([...d.querySelectorAll('details.country[data-g="Global"] .city .cn')].some(e => e.textContent === 'French Polynesia'), 'cruise towns inside Global');
  const subs = [...d.querySelectorAll('details.country[data-g="Europe"] details.sub > summary span:first-child')].map(e => e.textContent);
  ok(JSON.stringify(subs) === JSON.stringify(['France', 'across countries']), 'across countries after the countries: ' + subs);
  ok([...d.querySelectorAll('details.country[data-g="National"] .city .cn')].some(e => e.textContent === 'Chicago to Santa Monica'), 'shows the route');
}

// 18b. Global holds Bike (the Americas ride) and Cruise
{
  const rows = [{ name: 'Bike from AK to Tierra del Fuego', city: 'Alaska to Tierra del Fuego, Americas', kind: 'see + do' }, { name: 'Paul Gauguin', city: 'French Polynesia, Cruise', kind: 'stay' }];
  const { d } = await app(rows);
  const subs = [...d.querySelectorAll('details.country[data-g="Global"] details.sub > summary span:first-child')].map(e => e.textContent);
  ok(JSON.stringify(subs) === JSON.stringify(['Bike', 'Cruise']), 'Global subs: ' + subs);
}

// 20. random: a city, within the dropdown last opened, from everywhere when none is open
{
  const rows = [
    { name: 'A', city: 'Rome, Italy' }, { name: 'B', city: 'Rome, Italy' }, { name: 'C', city: 'Florence, Italy' },
    { name: 'D', city: 'Paris, France' }, { name: 'E', city: 'Tokyo, Japan', kind: 'stay' }, { name: 'F', city: 'Sedona, AZ' },
  ];
  const { d, dom, w } = await app(rows);
  const btn = d.getElementById('randBtn');
  const pick = async () => { btn.click(); await tick(dom, 5); return w.__oot.state.city; };
  const seen = async n => { const s = new Set(); for(let i = 0; i < n; i++) s.add(await pick()); return [...s].sort(); };
  ok(btn.textContent === 'random', 'nothing open: ' + btn.textContent);
  ok(JSON.stringify(await seen(60)) === JSON.stringify(['Florence, Italy', 'Paris, France', 'Rome, Italy', 'Sedona, AZ', 'Tokyo, Japan']), 'everywhere');
  ok(w.__oot.state.view === 'city', 'lands on the city page');
  const open = async id => { w.__oot.state.view = 'index'; w.__oot.render(); const e = d.querySelector(`details[data-g="${id}"]`); e.open = true; e.dispatchEvent(new dom.window.Event('toggle')); await tick(dom); };
  await open('Europe');
  ok(btn.textContent === 'random in Europe', 'label names the section: ' + btn.textContent);
  ok(JSON.stringify(await seen(40)) === JSON.stringify(['Florence, Italy', 'Paris, France', 'Rome, Italy']), 'Europe only');
  await open('Europe/Italy');
  ok(btn.textContent === 'random in Italy', 'innermost: ' + btn.textContent);
  const it = await seen(30);
  ok(JSON.stringify(it) === JSON.stringify(['Florence, Italy', 'Rome, Italy']), 'Italy only: ' + it);
  let back = 0; let prev = await pick(); for(let i = 0; i < 20; i++){ const c = await pick(); if(c === prev) back++; prev = c; }
  ok(back === 0, 'never the same city twice in a row');
  w.__oot.state.view = 'index'; w.__oot.render();
  const e = d.querySelector('details[data-g="Europe"]'); e.open = false; e.dispatchEvent(new dom.window.Event('toggle')); await tick(dom);
  ok(btn.textContent === 'random', 'closing the region drops Italy too: ' + btn.textContent);
  const sel = d.getElementById('kindSel'); sel.value = 'stay'; sel.dispatchEvent(new dom.window.Event('change')); await tick(dom);
  ok(JSON.stringify(await seen(10)) === JSON.stringify(['Tokyo, Japan']), 'kind filter applies');
}

// 19. named travel
{
  const { d } = await app();
  ok(d.title === 'travel' && d.querySelector('h1').firstChild.textContent.trim() === 'travel', 'title is travel');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
