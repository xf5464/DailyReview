const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deliver, pendingConditions, conditionKey } = require('../scripts/send-deduplicated-forecast-alert');

const gold = { id: 'centralBankGoldPurchases', threshold: 25, episodeStart: '2026-03-31', date: '2026-09-30' };
const margin = date => ({ id: 'chinaFilmMargin', threshold: 2000, episodeStart: date, date });
function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'forecast-delivery-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, '.forecast-alert.json');
  const write = conditions => fs.writeFileSync(file, JSON.stringify({ shouldNotify: true, conditions }));
  const received = [];
  const send = () => received.push(JSON.parse(fs.readFileSync(file, 'utf8')).conditions);
  return { directory, file, write, received, send };
}

test('daily financing alerts do not repeat the already-delivered gold observation', t => {
  const s = setup(t);
  s.write([gold, margin('2026-11-18')]);
  const original = fs.readFileSync(s.file, 'utf8');
  deliver('wecom', s);
  assert.deepEqual(s.received, [[margin('2026-11-18')]]);
  assert.equal(fs.readFileSync(s.file, 'utf8'), original);
  deliver('wecom', s);
  assert.equal(s.received.length, 1);
  s.write([gold, margin('2026-11-19')]);
  deliver('wecom', s);
  assert.deepEqual(s.received[1], [margin('2026-11-19')]);
});

test('new gold episode alerts once and remains suppressed when another condition changes', t => {
  const s = setup(t);
  const next = { ...gold, episodeStart: '2026-06-30', date: '2026-12-31' };
  s.write([next]);
  deliver('wecom', s);
  s.write([next, margin('2027-01-04')]);
  deliver('wecom', s);
  assert.deepEqual(s.received, [[next], [margin('2027-01-04')]]);
  assert.equal(pendingConditions({ conditions: [{ ...next, threshold: 30 }] },
    { channels: { wecom: [conditionKey(next)] } }, 'wecom').length, 1);
});

test('delivery failure retries only the failed channel and restores the original payload', t => {
  const s = setup(t);
  s.write([margin('2026-11-19')]);
  const original = fs.readFileSync(s.file, 'utf8');
  deliver('email', s);
  assert.throws(() => deliver('wecom', { ...s, send() { throw new Error('offline'); } }), /offline/);
  assert.equal(fs.readFileSync(s.file, 'utf8'), original);
  deliver('email', s);
  assert.equal(s.received.length, 1);
  deliver('wecom', s);
  assert.equal(s.received.length, 2);
});

test('forced tests send all conditions without consuming production notifications', t => {
  const s = setup(t);
  s.write([gold, margin('2026-11-19')]);
  deliver('bark', { ...s, env: { FORCE_NOTIFICATION_TEST: 'true' } });
  assert.equal(s.received[0].length, 2);
  assert.equal(fs.existsSync(path.join(s.directory, '.forecast-delivery/state.json')), false);
  deliver('bark', s);
  assert.deepEqual(s.received[1], [margin('2026-11-19')]);
});

test('gold alone is silent after migration, but a different threshold can alert', () => {
  const state = { channels: {} };
  assert.deepEqual(pendingConditions({ conditions: [gold] }, state, 'wecom'), []);
  assert.equal(pendingConditions({ conditions: [{ ...gold, threshold: 30 }] }, state, 'wecom').length, 1);
});
