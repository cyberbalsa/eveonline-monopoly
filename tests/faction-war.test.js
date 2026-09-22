const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../data');
const R = require('../bot-roster');
const history = require('../research/warzone-history.json');
const geography = require('../research/warzone-snapshot.json');

test('the 48-name pool has unique identities and dated affiliation references', () => {
  assert.equal(R.entries.length, 48);
  assert.equal(new Set(R.entries.map(e => e.id)).size, 48);
  assert.equal(new Set(R.entries.map(e => e.name.toLowerCase())).size, 48);
  for (const faction of ['calmil', 'galmil']) assert.equal(R.entries.filter(e => e.faction === faction).length, 24);
  for (const entry of R.entries) {
    assert.ok(entry.name && entry.fullName);
    assert.ok(['pilot', 'corporation', 'alliance'].includes(entry.kind));
    const source = R.sources[entry.source];
    assert.ok(source?.period && source?.title, entry.id);
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(R.find(entry.id), entry);
  }
});

test('random selection reaches the whole pool, respects faction and prevents duplicates', () => {
  const seen = new Set();
  for (const faction of ['calmil', 'galmil']) {
    for (let i = 0; i < 24; i++) {
      const picked = R.pick([faction, faction, faction], () => (i + 0.5) / 24);
      assert.equal(new Set(picked.map(e => e.id)).size, 3);
      assert.ok(picked.every(e => e.faction === faction));
      seen.add(picked[0].id);
    }
    const all = R.pick(Array(24).fill(faction), () => 0.999999);
    assert.equal(new Set(all.map(e => e.id)).size, 24);
  }
  assert.equal(seen.size, 48, 'every identity can be selected, including the end of each pool');
});

test('selection excludes the human callsign by display name or full name', () => {
  const forbidden = ['  TEMPLIS CALSF  ', 'Quantum Cats Syndicate'];
  const picked = R.pick(['calmil', 'galmil', 'galmil'], () => 0, forbidden);
  assert.ok(picked.every(e => !['calmil-templis-calsf', 'galmil-qcats'].includes(e.id)));
  assert.throws(() => R.pick(Array(25).fill('calmil')), /No unused militia identities/);
});

test('year-long activity totals exclude the partial month and preserve missing data', () => {
  assert.equal(history.months.length, 12);
  assert.ok(!history.months.includes(history.partialMonth));
  assert.equal(history.expectedSystems, geography.systems.length);
  assert.equal(history.fetchedSystems, history.expectedSystems);
  assert.deepEqual(new Set(history.systems.map(s => s.id)), new Set(geography.systems.map(s => s.id)));
  for (const row of history.systems) {
    const counts = history.months.filter(m => row.rawMonths[m]).map(m => row.rawMonths[m].shipsDestroyed).sort((a,b) => a-b);
    assert.equal(row.monthsReturned, counts.length, row.name);
    if (counts.length !== 12) {
      assert.equal(row.totalRecordedKills, null, row.name);
      assert.equal(row.medianMonthlyKills, null, row.name);
      continue;
    }
    assert.ok(counts.every(Number.isFinite), row.name);
    assert.equal(row.totalRecordedKills, counts.reduce((a,b) => a+b, 0), row.name);
    assert.equal(row.medianMonthlyKills, (counts[5] + counts[6])/2, row.name);
    assert.equal(row.monthsOver100Kills, counts.filter(n => n >= 100).length, row.name);
  }
});

test('22 board systems match the API geography and documented hotspot selection', () => {
  const properties = D.spaces.filter(s => s.type === 'property');
  assert.equal(properties.length, 22);
  assert.equal(new Set(properties.map(s => s.systemId)).size, 22);
  const ranked = history.systems.filter(s => s.monthsReturned === 12).sort((a,b) => b.medianMonthlyKills-a.medianMonthlyKills || b.totalRecordedKills-a.totalRecordedKills);
  const expected = [...ranked.slice(0,21).map(s => s.id), history.systems.find(s => s.name === 'Fliet').id];
  assert.deepEqual(new Set(properties.map(s => s.systemId)), new Set(expected));
  let previousMedian = -1;
  for (const property of properties) {
    const system = geography.systems.find(s => s.id === property.systemId);
    assert.equal(property.name, system.name);
    assert.equal(property.region, system.region);
    const activity = history.systems.find(s => s.id === property.systemId);
    assert.ok(activity.medianMonthlyKills >= previousMedian);
    previousMedian = activity.medianMonthlyKills;
  }
});
