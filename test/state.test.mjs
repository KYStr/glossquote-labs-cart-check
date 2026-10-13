import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, copyReport } from '../public/js/state.mjs';
import { makeReport, differenceText } from '../public/js/report.mjs';
import { messages } from '../public/js/messages.mjs';
import { calculateCart } from '../public/js/core/cart.mjs';
import { request, shippingExample, item } from './fixtures.mjs';
const ready = state => state.commit(state.begin(), calculateCart(request()));

test('A34 names remain literal strings in core and report; browser DOM checked separately', () => {
  const name = '<img src=x onerror="window.__cartInjection=1">';
  const output = calculateCart(request({ items: [item(name)] }));
  assert.equal(output.value.items[0].name, name);
  assert.ok(makeReport(output.value, messages.en).includes(name));
});
test('A35 invalidation drops result and copy tickets', () => {
  const state = createState(); ready(state);
  const copy = state.beginCopy(); state.invalidate();
  assert.equal(state.getResult(), null); assert.equal(state.currentCopy(copy), false); assert.equal(state.beginCopy(), null);
});
test('A36 reversed requests and stale clipboard success/rejection cannot commit', async () => {
  const state = createState(), old = state.begin(), latest = state.begin();
  assert.equal(state.commit(latest, calculateCart(request())), true);
  assert.equal(state.commit(old, calculateCart(request({ shipping: '80' }))), false);
  for (const rejection of [false, true]) {
    ready(state);
    let finish; let callbacks = 0;
    const pending = copyReport({ state, text: 'Fictional report', write: () => new Promise((resolve, reject) => { finish = rejection ? reject : resolve; }), onSuccess: () => callbacks++, onFallback: () => callbacks++ });
    state.invalidate(); ready(state); finish(); await pending;
    assert.equal(callbacks, 0);
  }
});
test('A36 newest copy ticket also blocks reverse callbacks at same revision', async () => {
  const state = createState(); ready(state); let older, newer; const callbacks = [];
  const a = copyReport({ state, text: 'A', write: () => new Promise(resolve => { older = resolve; }), onSuccess: () => callbacks.push('A'), onFallback: () => callbacks.push('AF') });
  const b = copyReport({ state, text: 'B', write: () => new Promise(resolve => { newer = resolve; }), onSuccess: () => callbacks.push('B'), onFallback: () => callbacks.push('BF') });
  newer(); await b; older(); await a; assert.deepEqual(callbacks, ['B']);
});
test('A37 clipboard missing/rejected invokes text fallback, no download capability', async () => {
  for (const write of [undefined, async () => { throw new Error('Permission denied'); }]) {
    const state = createState(); ready(state); let fallback = null;
    await copyReport({ state, text: 'Fictional report', write, onSuccess: () => assert.fail(), onFallback: text => { fallback = text; } });
    assert.equal(fallback, 'Fictional report');
  }
  const state = createState(); ready(state); let copied = false;
  await copyReport({ state, text: 'Fictional report', write: async () => {}, onSuccess: () => { copied = true; }, onFallback: () => assert.fail() });
  assert.equal(copied, true);
});
test('A38 clear/new page state has no restored result or pending request', () => {
  const state = createState(); const ticket = state.begin(); ready(state); state.invalidate();
  assert.equal(state.getResult(), null); assert.equal(state.commit(ticket, calculateCart(request())), false);
  assert.equal(createState().getResult(), null);
});
test('A24/A25/A26 report labels actual net differences in both languages', () => {
  for (const t of Object.values(messages)) {
    const value = calculateCart(shippingExample()).value;
    assert.equal(differenceText(value.summary, t), `${t.more} 20.00`);
    const report = makeReport(value, t);
    for (const amount of ['980.00', '1000.00', '100.00', '20.00']) assert.ok(report.includes(amount));
    assert.ok(report.includes(t.included)); assert.ok(report.includes(t.requestedCoupon)); assert.ok(report.includes(t.appliedCoupon));
    assert.equal(differenceText(calculateCart(shippingExample('50')).value.summary, t), `${t.more} 50.00`);
    assert.equal(differenceText({ differenceCents: -3000n }, t), `${t.less} 30.00`);
    assert.equal(differenceText({ differenceCents: 0n }, t), `${t.same} · 0.00`);
  }
});
