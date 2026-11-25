// Token Radar's page: renders window.RADAR (written by main.ts as data.js)
// into the board, the detail view, the live view and the model view.
// No fetch, no network: everything the page shows is already on disk.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);
const rowsEl = $('rows');
const liveRowsEl = $('liveRows');

/** Dollars as $12,345,678. */
function usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** TVL as $1.24B or $380M. */
function compactUsd(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return usd(n);
}

/** 7-day change as +5.8% / -0.4% / —, with a direction class. */
function growthCell(v) {
  if (v === null || v === undefined) return '<span class="flat">—</span>';
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  const sign = v > 0 ? '+' : '';
  return '<span class="' + cls + '">' + sign + v.toFixed(1) + '%</span>';
}

/** Age in days as 412d, or — when the snapshot names no listing date. */
function ageCell(days) {
  if (days === null || days === undefined) return '<span class="flat">—</span>';
  if (days >= 365) return (days / 365).toFixed(1) + 'y';
  return days + 'd';
}

/** The distinct values of one field across the board, sorted. */
function distinct(field) {
  const out = new Set();
  for (const r of D.rows) {
    if (field === 'chains') {
      for (const c of r.chains) out.add(c);
    } else if (r[field]) {
      out.add(r[field]);
    }
  }
  return [...out].sort();
}

/** Fill the header facts, the stat strip and the filter dropdowns. */
function fillChrome() {
  const top10 = D.rows.slice(0, 10).reduce((s, r) => s + r.implied_value_usd, 0);
  const mid = D.rows[Math.floor(D.rows.length / 2)].implied_value_usd;
  $('meta').innerHTML =
    '<div><dt>Snapshot</dt><dd>' + D.as_of + '</dd></div>' +
    '<div><dt>Protocols</dt><dd>' + D.board_size + ' ranked</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + ' / ' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Model</dt><dd>' + D.model_version + '</dd></div>';
  $('stats').innerHTML =
    '<div class="stat"><b>' + usd(top10) + '</b><span>Combined implied value of the top 10</span></div>' +
    '<div class="stat"><b>' + usd(mid) + '</b><span>Median implied value on the board</span></div>' +
    '<div class="stat"><b>' + D.early_size + '</b><span>Early finds below the $50M floor</span></div>' +
    '<div class="stat"><b>' + D.live_size + '</b><span>Live-token protocols set aside</span></div>';
  for (const c of distinct('category')) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    $('category').appendChild(o);
  }
  for (const c of distinct('chains')) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    $('chain').appendChild(o);
  }
  $('formula').innerHTML =
    '<dt>Base — the economy a token would price</dt><dd>TVL x ' + D.model.base_multiple + '. A protocol holding more value has more to price into a launch.</dd>' +
    '<dt>Growth — momentum over the last 7 days</dt><dd>Change clamped to ' + D.model.growth_floor + '% .. +' + D.model.growth_cap + '%, then 1 + change x ' + D.model.growth_weight + '. Fast-growing TVL is evidence the protocol is being farmed already.</dd>' +
    '<dt>Maturity — time served with no token</dt><dd>' + D.model.maturity_floor + ' + min(age, ' + D.model.maturity_days + ' days) / ' + D.model.maturity_days + ' x ' + D.model.maturity_range + '. A protocol that ran for years without issuing a token has a longer runway of unrewarded users to pay. Unknown age counts as ' + D.model.unknown_age_days + ' days.</dd>' +
    '<dt>Breadth — reach across chains</dt><dd>1 + 0.04 for each chain past the first, up to ' + D.model.breadth_max_chains + ' extra chains. More chains means more wallets to reward.</dd>' +
    '<dt>Implied value</dt><dd>Base x growth x maturity x breadth, rounded to whole dollars. Rank 1 is the board\'s most valuable protocol.</dd>';
}

/** The board's rows after the current search, filters and sort. */
let sortKey = 'value';
function visibleRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('category').value;
  const chain = $('chain').value;
  const wlOnly = $('watchlistOnly').checked;
  let list = D.rows.filter((r) => {
    if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
    if (cat && r.category !== cat) return false;
    if (chain && r.chains.indexOf(chain) < 0) return false;
    if (wlOnly && !r.on_watchlist) return false;
    return true;
  });
  const by = {
    value: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -999) - (a.change_7d ?? -999),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    name: (a, b) => (a.name < b.name ? -1 : 1),
    rank: (a, b) => a.rank - b.rank,
  }[sortKey] || ((a, b) => a.rank - b.rank);
  return list.sort(by);
}

/** The chains a protocol runs on, shortened so a row stays on one line. */
function chainsCell(chains) {
  const shown = chains.slice(0, 3).map(esc).join(', ');
  return chains.length > 3 ? shown + ' +' + (chains.length - 3) : shown;
}

/** One board row's HTML. The value cell carries a bar scaled to rank 1, so the eye can compare values down the board without reading every number. */
function rowHtml(r) {
  const badge = r.on_watchlist ? '<span class="badge">Watchlist</span>' : '';
  const share = Math.max(1, Math.round((r.implied_value_usd / D.rows[0].implied_value_usd) * 100));
  return (
    '<tr data-slug="' + r.slug + '">' +
    '<td class="rank">' + r.rank + '</td>' +
    '<td><span class="pname">' + esc(r.name) + '</span>' + badge + '<br><span class="slug">' + r.slug + '</span></td>' +
    '<td>' + esc(r.category || '—') + '</td>' +
    '<td>' + chainsCell(r.chains) + '</td>' +
    '<td class="num">' + compactUsd(r.tvl_usd) + '</td>' +
    '<td class="num">' + growthCell(r.change_7d) + '</td>' +
    '<td class="num">' + ageCell(r.age_days) + '</td>' +
    '<td class="num value"><span class="vbar"><i style="width:' + share + '%"></i></span>' + usd(r.implied_value_usd) + '</td>' +
    '</tr>'
  );
}

/** Escape text for HTML. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render the board for the current filters. */
function renderBoard() {
  const list = visibleRows();
  rowsEl.innerHTML = list.map(rowHtml).join('');
  $('count').textContent =
    list.length + ' of ' + D.rows.length + ' protocols shown' +
    (list.length < D.rows.length ? ' — clear the filters to see the whole board.' : '.');
}

/** Render the live-token table. */
function renderLive() {
  liveRowsEl.innerHTML = D.live
    .map(
      (p) =>
        '<tr><td><span class="pname">' + esc(p.name) + '</span><br><span class="slug">' + p.slug + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td>' + chainsCell(p.chains) + '</td>' +
        '<td class="num">' + compactUsd(p.tvl_usd) + '</td>' +
        '<td class="num">' + (p.mcap_usd === null ? '—' : compactUsd(p.mcap_usd)) + '</td>' +
        '<td class="num">' + growthCell(p.change_7d) + '</td></tr>',
    )
    .join('');
}

/** The farm plan for one board row: the steps the board itself carries. */
function farmStepsFor(slug) {
  const row = D.rows.find((r) => r.slug === slug);
  return row ? row.farm_steps : null;
}

/** The protocols ranked just above and below one row, as links the reader can follow. */
function neighbours(r) {
  const prev = D.rows.find((x) => x.rank === r.rank - 1);
  const next = D.rows.find((x) => x.rank === r.rank + 1);
  const link = (x, label) =>
    '<a href="#/protocol/' + x.slug + '">' + label + ' ' + esc(x.name) + ' (' + usd(x.implied_value_usd) + ')</a>';
  const parts = [];
  if (prev) parts.push('Above: ' + link(prev, '#' + prev.rank));
  if (next) parts.push('Below: ' + link(next, '#' + next.rank));
  return parts.length > 0 ? parts.join(' · ') : 'The only protocol on the board.';
}

/** Open the detail view for one protocol. */
function openDetail(slug) {
  const r = D.rows.find((x) => x.slug === slug);
  if (!r) return;
  const steps = farmStepsFor(slug);
  const stepsHtml = steps
    ? '<ol class="steps">' + steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
    : '<p class="note">The farm plan for this protocol is in board.json.</p>';
  $('detail').innerHTML =
    '<div class="detail-card">' +
    '<h2>' + esc(r.name) + '</h2>' +
    '<p class="sub">' + r.slug + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + r.chains.map(esc).join(', ') + '</p>' +
    '<dl class="kv">' +
    '<div><dt>Rank</dt><dd>#' + r.rank + '</dd></div>' +
    '<div><dt>Implied value</dt><dd>' + usd(r.implied_value_usd) + '</dd></div>' +
    '<div><dt>TVL</dt><dd>' + compactUsd(r.tvl_usd) + '</dd></div>' +
    '<div><dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</dd></div>' +
    '<div><dt>Age</dt><dd>' + (r.age_days === null ? 'Unknown' : r.age_days + ' days') + '</dd></div>' +
    '<div><dt>Token</dt><dd>Records no token</dd></div>' +
    '</dl>' +
    '<h3>Why this value</h3>' +
    '<table class="model-table"><tbody>' +
    '<tr><td>Base (TVL x ' + D.model.base_multiple + ')</td><td class="num">' + usd(r.tvl_usd * D.model.base_multiple) + '</td></tr>' +
    '<tr><td>Growth multiplier</td><td class="num">x' + r.growth_multiplier.toFixed(2) + '</td></tr>' +
    '<tr><td>Maturity multiplier</td><td class="num">x' + r.maturity_multiplier.toFixed(2) + '</td></tr>' +
    '<tr><td>Breadth multiplier</td><td class="num">x' + r.breadth_multiplier.toFixed(2) + '</td></tr>' +
    '<tr><td><b>Implied value</b></td><td class="num value">' + usd(r.implied_value_usd) + '</td></tr>' +
    '</tbody></table>' +
    '<h3>How to farm it</h3>' +
    stepsHtml +
    '<h3>Neighbours on the board</h3>' +
    '<p class="note">' + neighbours(r) + '</p>' +
    '<p class="note">This protocol records no token — that is the snapshot\'s record, not proof it has none. The plan above is derived from its category, chains, TVL and age.</p>' +
    '</div>';
  showView('detail');
}

/** Switch between board, live, model and detail views. */
function showView(name) {
  $('boardView').hidden = name !== 'board';
  $('controls').style.display = name === 'board' ? '' : 'none';
  $('detailView').hidden = name !== 'detail';
  $('liveView').hidden = name !== 'live';
  $('modelView').hidden = name !== 'model';
  for (const b of document.querySelectorAll('#views button')) {
    b.classList.toggle('active', b.dataset.view === name || (name === 'detail' && b.dataset.view === 'board'));
  }
  if (name === 'board') renderBoard();
  if (name === 'live') renderLive();
}

/** Read the hash: #/protocol/<slug>, #/filter/<category>, #/live, #/model. */
function route() {
  const h = location.hash || '';
  const mProto = h.match(/^#\/protocol\/([a-z0-9-]+)$/);
  if (mProto) return openDetail(mProto[1]);
  const mFilter = h.match(/^#\/filter\/(.+)$/);
  if (mFilter) {
    const cat = decodeURIComponent(mFilter[1]);
    const sel = $('category');
    if ([...sel.options].some((o) => o.value === cat)) {
      sel.value = cat;
      showView('board');
      return;
    }
  }
  if (h === '#/live') return showView('live');
  if (h === '#/model') return showView('model');
  showView('board');
}

for (const b of document.querySelectorAll('#views button')) {
  b.addEventListener('click', () => {
    location.hash = b.dataset.view === 'board' ? '' : '#/' + b.dataset.view;
    route();
  });
}
$('back').addEventListener('click', () => {
  location.hash = '';
  route();
});
for (const id of ['q', 'category', 'chain', 'sort', 'watchlistOnly']) {
  $(id).addEventListener('input', () => {
    sortKey = $('sort').value;
    renderBoard();
  });
}
document.querySelectorAll('#board thead th').forEach((th) => {
  th.addEventListener('click', () => {
    const map = { rank: 'rank', name: 'name', category: 'name', chains: 'name', tvl: 'tvl', growth: 'growth', age: 'age', value: 'value' };
    sortKey = map[th.dataset.sort] || 'value';
    $('sort').value = sortKey;
    renderBoard();
  });
});
rowsEl.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-slug]');
  if (!tr) return;
  location.hash = '#/protocol/' + tr.dataset.slug;
  route();
});
window.addEventListener('hashchange', route);

fillChrome();
route();
