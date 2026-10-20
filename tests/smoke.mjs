// Smoke tests for out of town. jsdom, an in-memory backend, no network, no OneDrive.
// Run: node tests/smoke.mjs   (npm i jsdom once)
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8')
  .replace(/<!--MSAL-->[\s\S]*?<!--\/MSAL-->/, '');

const COLS = ['name','category','city','rating','toOrder','ordered','notes','address','lat','lng','closed'];
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

// 1. index groups cities by state
{
  const { d } = await app();
  const regions = [...d.querySelectorAll('.region')].map(e => e.textContent);
  ok(JSON.stringify(regions) === JSON.stringify(['Arizona','Montana','New York']), 'regions sorted: ' + regions);
  ok(d.querySelectorAll('.city').length === 3, 'three cities');
  ok(d.querySelector('.note').textContent.includes('3 cities · 5 places'), 'count line');
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
  d.getElementById('editBtn').click(); await tick(dom);
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
  q.value = 'sedona'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom);
  ok(d.querySelectorAll('.city').length === 1 && d.querySelectorAll('.item').length >= 1, 'city + place hit');
  q.value = 'chocolate'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom);
  ok(d.querySelector('.item-name').textContent === 'Wild Crumb', 'ordered item searchable');
  q.value = 'zzzz'; q.dispatchEvent(new dom.window.Event('input')); await tick(dom);
  ok(d.querySelector('.note').textContent.includes('nothing matches'), 'empty result copy');
}

// 10. closed places: tagged, last in the city, no rating buttons
{
  const rows = seed.map(r => Object.assign({}, r));
  rows[2].closed = 'closed Jun 2026';
  const { d, dom } = await app(rows);
  d.querySelector('.city[data-city="Sedona, AZ"]').click(); await tick(dom);
  const items = [...d.querySelectorAll('.item')];
  ok(items.at(-1).textContent.includes('FreeForm') && items.at(-1).querySelector('.closed'), 'closed sorts last with tag');
  items.at(-1).click(); await tick(dom);
  ok(!d.querySelector('#detailBody .rateBtn') && !d.getElementById('orderedAdd'), 'closed is read-only');
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
