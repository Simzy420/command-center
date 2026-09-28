import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSnapshotAge,
  liveMarketValue,
  livePrice,
  maskLast4,
  normalizeSnapshot,
} from './snapshot.ts';

const sample = {
  updatedAt: '2026-09-28T15:00:00Z',
  account: { label: '', last4: '999988886740' },
  totalValue: 118532.25,
  equityValue: 175464.27,
  cryptoValue: 26130.89,
  cash: -83062.91,
  currency: 'usd',
  positions: [
    { symbol: 'pltr', quantity: 149.998, avgCost: 142.02, price: 0, marketValue: 0, dayChangePct: null },
    { symbol: 'brk.b', quantity: 2, avgCost: 400, price: 410.5, marketValue: 821, dayChangePct: 1.25 },
  ],
};

test('normalizes the brokerage snapshot and masks the account', () => {
  const snapshot = normalizeSnapshot(sample);
  assert.ok(snapshot);
  assert.equal(snapshot.account.label, 'Individual');
  assert.equal(snapshot.account.last4, '6740');
  assert.equal(maskLast4('acct 6740'), '6740');
  assert.equal(snapshot.currency, 'USD');
  assert.equal(snapshot.totalValue, 118532.25);
  assert.equal(snapshot.positions[0]?.symbol, 'PLTR');
  assert.equal(livePrice(snapshot.positions[0]!), null);
  assert.equal(liveMarketValue(snapshot.positions[0]!), null);
  assert.equal(livePrice(snapshot.positions[1]!), 410.5);
  assert.equal(liveMarketValue(snapshot.positions[1]!), 821);
});

test('drops a full account number stuffed into the label', () => {
  const snapshot = normalizeSnapshot({
    updatedAt: '2026-09-28T15:00:00Z',
    account: { label: '123456786740', last4: '6740' },
    positions: [],
  });
  assert.equal(snapshot?.account.label, 'Individual');
});

test('age label and stale threshold', () => {
  const now = Date.parse('2026-09-28T15:12:00Z');
  const fresh = formatSnapshotAge('2026-09-28T15:09:00Z', now);
  assert.equal(fresh?.label, 'Updated 3m ago');
  assert.equal(fresh?.stale, false);
  const stale = formatSnapshotAge('2026-09-28T15:00:00Z', now);
  assert.equal(stale?.label, 'Updated 12m ago');
  assert.equal(stale?.stale, true);
  assert.equal(formatSnapshotAge('2026-09-28T15:12:30Z', now)?.label, 'Updated just now');
});
