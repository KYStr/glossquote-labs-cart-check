import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCart } from '../public/js/core/cart.mjs';
import { formatCents } from '../public/js/core/format.mjs';
import { request, item, shippingExample, ROW_KEYS, SCENARIO_KEYS } from './fixtures.mjs';
const success = draft => { const output = calculateCart(draft); assert.equal(output.ok, true); return output.value; };
const error = (draft, code, row = null, field = null) => assert.deepEqual(calculateCart(draft), { ok: false, error: { code, row, field } });

test('A1 line price × quantity is integer cents', () => {
  const value = success(request({ items: [item('Example', '10.00', '2')] }));
  assert.deepEqual(value.items, [{ name: 'Example', unitPriceCents: 1000n, quantity: 2, lineCents: 2000n }]);
  assert.equal(value.baseline.subtotalCents, 2000n);
});
test('A2 maximum legal basket is exact and add-on may extend it', () => {
  const value = success(request({ items: Array.from({ length: 30 }, () => item('Example', '9999999.99', '1000')), addOn: { name: 'Extra', price: '9999999.99' } }));
  assert.equal(value.baseline.subtotalCents, 29999999970000n);
  assert.equal(value.addOnScenario.subtotalCents, 30000999969999n);
  assert.equal(value.summary.differenceCents, 999999999n);
});
test('A3 count limits 0 / 31; schema has first priority', () => {
  error(request({ items: [] }), 'TOO_FEW_ITEMS', null, 'items');
  error(request({ items: Array.from({ length: 31 }, () => item()) }), 'TOO_MANY_ITEMS', null, 'items');
  error(request({ items: [], unknown: 'x' }), 'INVALID_REQUEST');
});
test('A4 missing/type vs incomplete and raw cap priority; no blank row skipping', () => {
  error(request({ items: [{ price: '10', quantity: '1' }] }), 'INVALID_REQUEST');
  error(request({ items: [item('Example', 10)] }), 'INVALID_REQUEST');
  error(request({ items: [item('   ')] }), 'ROW_INCOMPLETE', 1, 'name');
  error(request({ items: [item('Example', ' \t ')] }), 'ROW_INCOMPLETE', 1, 'price');
  error(request({ items: [item('Example', '10', '')] }), 'ROW_INCOMPLETE', 1, 'quantity');
  error(request({ items: [item(' '.repeat(257))] }), 'NAME_RAW_TOO_LONG', 1, 'name');
  error(request({ items: [item('Example', ' '.repeat(17))] }), 'INVALID_PRICE', 1, 'price');
  error(request({ items: [item('Example', '10', '     ')] }), 'INVALID_QUANTITY', 1, 'quantity');
  error(request({ items: [item(), item('')] }), 'ROW_INCOMPLETE', 2, 'name');
});
test('A5 integer / one / two decimal places, outer trim and leading zeros', () => {
  for (const [raw, expected] of [['1', 100n], ['1.2', 120n], ['1.20', 120n], [' 001.2 ', 120n], ['0', 0n], ['0000000000000001', 100n]]) assert.equal(success(request({ items: [item(' Example ', raw, '0001')] })).items[0].unitPriceCents, expected);
  assert.equal(success(request({ items: [item(' Example ')] })).items[0].name, 'Example');
});
test('A6 rejects non-ASCII decimal forms without silently truncating', () => {
  for (const raw of ['1.001', '1,000', '+1', '-1', '1e3', '１', '١', '.1', '1.', '1 0', 'NaN', 'Infinity']) error(request({ items: [item('Example', raw)] }), 'INVALID_PRICE', 1, 'price');
  error(request({ items: [item('Example', `${'0'.repeat(16)}1`)] }), 'INVALID_PRICE', 1, 'price');
});
test('A7 raw maximum unit price accepted; next cent rejected; commas invalid', () => {
  assert.equal(success(request({ items: [item('Example', '9999999.99')] })).items[0].unitPriceCents, 999999999n);
  error(request({ items: [item('Example', '10000000.00')] }), 'PRICE_TOO_LARGE', 1, 'price');
  error(request({ items: [item('Example', '9,999,999.99')] }), 'INVALID_PRICE', 1, 'price');
});
test('A8 quantity 1 / 1000 accepted; invalid quantities rejected', () => {
  for (const raw of ['1', '1000', '0001']) assert.ok(success(request({ items: [item('Example', '0', raw)] })));
  for (const raw of ['0', '1001', '2.0', '-1', '00001', ' 1', '1 ', '1\n', '1\r', '１', '1e2']) error(request({ items: [item('Example', '0', raw)] }), 'INVALID_QUANTITY', 1, 'quantity');
});
test('A9 names enforce UTF-16 lengths and reject C0 / C1 controls', () => {
  assert.equal(success(request({ items: [item('😀'.repeat(40))] })).items[0].name.length, 80);
  error(request({ items: [item('a'.repeat(81))] }), 'NAME_TOO_LONG', 1, 'name');
  for (const control of ['\u0000', '\u0001', '\u001f', '\u007f', '\u0080', '\u009f']) error(request({ items: [item(`a${control}b`)] }), 'CONTROL_CHARACTER', 1, 'name');
  assert.equal(success(request({ items: [item(`${' '.repeat(88)}${'a'.repeat(80)}${' '.repeat(88)}`)] })).items[0].name.length, 80);
});
test('A10 percentages accepted at 0 / 100; bounds, precision, raw length errors', () => {
  assert.equal(success(request({ percentOff: '0.00' })).discount.percentOffBasisPoints, 0n);
  assert.equal(success(request({ percentOff: '100.00' })).baseline.merchNetCents, 0n);
  for (const raw of ['100.01', '-1', '1.001', '', '１', '1e1', ' 100.00  ', '000000000']) error(request({ percentOff: raw }), 'INVALID_PERCENT', null, 'percentOff');
  assert.equal(success(request({ percentOff: ' 100.00 ' })).discount.percentOffBasisPoints, 10000n);
});
test('A11 tiny percentage half-cent rounds discount up', () => {
  const value = success(request({ percentOff: '0.05' })).baseline;
  assert.equal(value.percentageDiscountCents, 1n); assert.equal(value.afterPercentCents, 999n);
});
test('A12 below half-cent discount rounds down', () => {
  const value = success(request({ items: [item('Example', '100.01')], percentOff: '10.00' })).baseline;
  assert.equal(value.percentageDiscountCents, 1000n); assert.equal(value.afterPercentCents, 9001n);
});
test('A13 half-cent discount rounds up, never the merchandise remainder', () => {
  const value = success(request({ items: [item('Example', '100.05')], percentOff: '10.00' })).baseline;
  assert.equal(value.percentageDiscountCents, 1001n); assert.equal(value.afterPercentCents, 9004n);
  const tiny = success(request({ items: [item('Example', '0.05')], percentOff: '10.00' })).baseline;
  assert.equal(tiny.percentageDiscountCents, 1n); assert.equal(tiny.afterPercentCents, 4n);
});
test('A14 coupon above after-percent floors net at zero without discounting shipping', () => {
  const value = success(request({ percentOff: '50', fixedCoupon: '6', shipping: '8' })).baseline;
  assert.equal(value.fixedCouponRequestedCents, 600n); assert.equal(value.fixedCouponAppliedCents, 500n);
  assert.equal(value.merchNetCents, 0n); assert.equal(value.finalTotalCents, 800n);
});
test('A15 coupon numeric cap distinct from raw 18-unit cap', () => {
  assert.equal(success(request({ fixedCoupon: '299999999700.00' })).discount.fixedCouponRequestedCents, 29999999970000n);
  error(request({ fixedCoupon: '299999999700.01' }), 'FIXED_COUPON_TOO_LARGE', null, 'fixedCoupon');
  assert.equal(success(request({ fixedCoupon: '000000000000000000' })).discount.fixedCouponRequestedCents, 0n);
  for (const raw of ['0'.repeat(19), '1.001', '', '1,000', '-1']) error(request({ fixedCoupon: raw }), 'INVALID_FIXED_COUPON', null, 'fixedCoupon');
});
test('A16 percentage then fixed coupon, complete constituent amounts', () => {
  const value = success(request({ items: [item('Example', '100')], percentOff: '10', fixedCoupon: '5', shipping: '8' })).baseline;
  assert.equal(value.percentageDiscountCents, 1000n); assert.equal(value.afterPercentCents, 9000n);
  assert.equal(value.fixedCouponAppliedCents, 500n); assert.equal(value.merchNetCents, 8500n); assert.equal(value.finalTotalCents, 9300n);
});
test('A17 blank threshold is no offer even with zero subtotal', () => {
  for (const threshold of ['', '   ']) {
    const value = success(request({ items: [item('Example', '0')], freeShippingThreshold: threshold, shipping: '8' })).baseline;
    assert.equal(value.thresholdCents, null); assert.equal(value.thresholdMeasureCents, null);
    assert.equal(value.qualifiesFreeShipping, false); assert.equal(value.shippingChargedCents, 800n);
  }
});
test('A18 explicit zero threshold is an offer, bounds enforce full raw draft', () => {
  const value = success(request({ items: [item('Example', '0')], freeShippingThreshold: '0', shipping: '8' })).baseline;
  assert.equal(value.thresholdCents, 0n); assert.equal(value.thresholdMeasureCents, 0n);
  assert.equal(value.qualifiesFreeShipping, true); assert.equal(value.finalTotalCents, 0n);
  assert.equal(success(request({ freeShippingThreshold: '299999999700.00' })).baseline.thresholdCents, 29999999970000n);
  for (const raw of ['299999999700.01', ' '.repeat(19), '1.001', '-1', '1,000']) error(request({ freeShippingThreshold: raw }), 'INVALID_THRESHOLD', null, 'freeShippingThreshold');
});
test('A19 pre-discount threshold uses subtotal', () => {
  const value = success(request({ items: [item('Example', '900')], fixedCoupon: '100', freeShippingThreshold: '850', shipping: '80', thresholdBasis: 'pre-discount' })).baseline;
  assert.equal(value.merchNetCents, 80000n); assert.equal(value.thresholdMeasureCents, 90000n); assert.equal(value.shippingChargedCents, 0n);
});
test('A20 post-discount threshold uses net after both discounts', () => {
  const value = success(request({ items: [item('Example', '900')], fixedCoupon: '100', freeShippingThreshold: '850', shipping: '80' })).baseline;
  assert.equal(value.thresholdMeasureCents, 80000n); assert.equal(value.shippingChargedCents, 8000n); assert.equal(value.finalTotalCents, 88000n);
});
test('A21 equal threshold qualifies, one cent short does not', () => {
  assert.equal(success(request({ freeShippingThreshold: '10', shipping: '8' })).baseline.shippingChargedCents, 0n);
  assert.equal(success(request({ freeShippingThreshold: '10.01', shipping: '8' })).baseline.shippingChargedCents, 800n);
});
test('A22 shipping maximum raw decimal accepted, next cent / commas rejected', () => {
  assert.equal(success(request({ shipping: '99999.99' })).baseline.shippingChargedCents, 9999999n);
  for (const raw of ['100000.00', '99,999.99', '1.001', '', '-1', '0'.repeat(17)]) error(request({ shipping: raw }), 'INVALID_SHIPPING', null, 'shipping');
});
test('A23 merchandise discounts never apply to shipping', () => {
  assert.equal(success(request({ percentOff: '100', fixedCoupon: '100', shipping: '80' })).baseline.finalTotalCents, 8000n);
});
test('A24 900 + 100 reaches 1000: 980 → 1000, +20 including item cost', () => {
  const value = success(shippingExample());
  assert.equal(value.baseline.finalTotalCents, 98000n); assert.equal(value.addOnScenario.finalTotalCents, 100000n);
  assert.equal(value.addOnScenario.shippingChargedCents, 0n); assert.equal(value.summary.differenceCents, 2000n); assert.equal(value.summary.addOnPriceCents, 10000n);
});
test('A25 900 + 50 below threshold: 980 → 1030, +50', () => {
  const value = success(shippingExample('50'));
  assert.equal(value.addOnScenario.finalTotalCents, 103000n); assert.equal(value.addOnScenario.shippingChargedCents, 8000n); assert.equal(value.summary.differenceCents, 5000n);
});
test('A26 950 + 50: 1030 → 1000, -30; zero add-on allowed', () => {
  const value = success(request({ items: [item('Example', '950')], shipping: '80', freeShippingThreshold: '1000', addOn: { name: 'Extra', price: '50' } }));
  assert.equal(value.baseline.finalTotalCents, 103000n); assert.equal(value.addOnScenario.finalTotalCents, 100000n);
  assert.equal(value.summary.differenceCents, -3000n); assert.equal(value.summary.addOnPriceCents, 5000n);
  assert.equal(success(shippingExample('0')).summary.differenceCents, 0n);
});
test('A27 add-on independently recalculates percentage and applied coupon', () => {
  const value = success(request({ percentOff: '50', fixedCoupon: '6', addOn: { name: 'Extra', price: '10' } }));
  assert.equal(value.baseline.percentageDiscountCents, 500n); assert.equal(value.baseline.fixedCouponAppliedCents, 500n);
  assert.equal(value.addOnScenario.percentageDiscountCents, 1000n); assert.equal(value.addOnScenario.fixedCouponAppliedCents, 600n);
  assert.equal(value.addOnScenario.merchNetCents, 400n); assert.equal(value.summary.differenceCents, 400n);
});
test('A28 basis enum rejected in specified value-validation order', () => {
  error(request({ thresholdBasis: 'unknown' }), 'INVALID_REQUEST', null, 'thresholdBasis');
  error(request({ thresholdBasis: 'unknown', percentOff: '-1' }), 'INVALID_PERCENT', null, 'percentOff');
  error(request({ thresholdBasis: 1 }), 'INVALID_REQUEST');
});
test('A29 exact request, row, add-on schemas, descriptors and prototypes', () => {
  const mutations = [
    x => { delete x.shipping; }, x => { x.unknown = 'x'; }, x => { x[Symbol('x')] = 'x'; },
    x => { Object.defineProperty(x, 'hidden', { value: 'x' }); },
    x => { Object.defineProperty(x, 'shipping', { value: '0', enumerable: false }); },
    x => { Object.defineProperty(x, 'shipping', { get() { throw new Error('must not call'); }, enumerable: true }); },
    x => { Object.setPrototypeOf(x, { custom: true }); }, x => { x.shipping = null; }, x => { x.addOn = []; }
  ];
  for (const mutate of mutations) { const draft = request(); mutate(draft); error(draft, 'INVALID_REQUEST'); }
  for (const target of ['row', 'addon']) {
    for (const mutate of [x => { delete x.price; }, x => { x[Symbol('x')] = 'x'; }, x => { x.unknown = 'x'; }, x => { Object.defineProperty(x, 'hidden', { value: 'x' }); }, x => { Object.defineProperty(x, 'price', { get() { throw new Error('must not call'); }, enumerable: true }); }, x => { Object.defineProperty(x, 'name', { value: 'x', enumerable: false }); }, x => { Object.setPrototypeOf(x, Date.prototype); }, x => { x.name = 2; }]) {
      const draft = request(), obj = target === 'row' ? draft.items[0] : (draft.addOn = { name: 'Extra', price: '1' });
      mutate(obj); error(draft, 'INVALID_REQUEST');
    }
  }
  const nullDraft = Object.assign(Object.create(null), request());
  nullDraft.items[0] = Object.assign(Object.create(null), item());
  nullDraft.addOn = Object.assign(Object.create(null), { name: 'Extra', price: '0' });
  assert.equal(calculateCart(nullDraft).ok, true);
  const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); error(proxy, 'INVALID_REQUEST');
});
test('A30 dense exact arrays: holes, custom props, symbols, subclass, accessors rejected', () => {
  const subclass = class extends Array {};
  for (const rows of [Array(1), new subclass(item()), Object.assign([item()], { custom: 1 }), Object.assign([item()], { [Symbol('x')]: 1 }), Object.setPrototypeOf([item()], null)]) error(request({ items: rows }), 'INVALID_REQUEST');
  const rows = [item()]; Object.defineProperty(rows, '0', { get() { throw new Error('must not call'); }, enumerable: true }); error(request({ items: rows }), 'INVALID_REQUEST');
  const hidden = [item()]; Object.defineProperty(hidden, '0', { value: item(), enumerable: false }); error(request({ items: hidden }), 'INVALID_REQUEST');
});
test('A31 first error points at second row, no partial value or inputs returned', () => {
  error(request({ items: [item(), item('PRIVATE_EXAMPLE_CANARY', 'bad')], percentOff: '-1' }), 'INVALID_PRICE', 2, 'price');
  error(request({ items: [item(''), item('Example', 'bad')] }), 'ROW_INCOMPLETE', 1, 'name');
});
test('A32 both scenarios contain full arithmetic and independent shipping', () => {
  const value = success(request({ items: [item('Example', '100')], percentOff: '10', fixedCoupon: '5', shipping: '8', freeShippingThreshold: '100', addOn: { name: 'Extra', price: '20' } }));
  assert.equal(value.baseline.afterPercentCents, 9000n); assert.equal(value.baseline.fixedCouponAppliedCents, 500n); assert.equal(value.baseline.shippingChargedCents, 800n); assert.equal(value.baseline.finalTotalCents, 9300n);
  assert.equal(value.addOnScenario.afterPercentCents, 10800n); assert.equal(value.addOnScenario.fixedCouponAppliedCents, 500n); assert.equal(value.addOnScenario.shippingChargedCents, 0n); assert.equal(value.addOnScenario.finalTotalCents, 10300n);
  for (const scenario of [value.baseline, value.addOnScenario]) assert.equal(scenario.afterPercentCents - scenario.fixedCouponAppliedCents + scenario.shippingChargedCents, scenario.finalTotalCents);
});
test('A33 exact two-decimal formatting, large and signed values, no currency symbol', () => {
  for (const [amount, expected] of [[1005n, '10.05'], [0n, '0.00'], [1n, '0.01'], [-3000n, '-30.00'], [29999999970000n, '299999999700.00']]) assert.equal(formatCents(amount), expected);
  assert.throws(() => formatCents(1.05));
});
test('A39 exact successful schema, typed amounts and null add-on summary; immutable input', () => {
  const checkKeys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
  for (const draft of [request(), shippingExample()]) {
    Object.freeze(draft.items[0]); Object.freeze(draft.items); if (draft.addOn) Object.freeze(draft.addOn); Object.freeze(draft);
    const output = calculateCart(draft), value = output.value;
    checkKeys(output, ['ok', 'value']); checkKeys(value, ['items', 'discount', 'baseline', 'addOnScenario', 'summary']);
    checkKeys(value.discount, ['percentOffBasisPoints', 'fixedCouponRequestedCents']);
    checkKeys(value.summary, ['baselineFinalTotalCents', 'addOnFinalTotalCents', 'addOnPriceCents', 'differenceCents']);
    for (const [key, scenario] of [['baseline', value.baseline], ['addon', value.addOnScenario]]) {
      if (!scenario) continue;
      checkKeys(scenario, key === 'baseline' ? SCENARIO_KEYS : [...SCENARIO_KEYS, 'addOn']);
      for (const row of scenario.items) { checkKeys(row, ROW_KEYS); assert.equal(typeof row.name, 'string'); assert.equal(typeof row.quantity, 'number'); for (const k of ['unitPriceCents', 'lineCents']) assert.equal(typeof row[k], 'bigint'); }
      for (const [k, amount] of Object.entries(scenario)) if (k.endsWith('Cents') || k === 'percentOffBasisPoints') { assert.ok(amount === null || typeof amount === 'bigint'); if (amount !== null) assert.ok(amount >= 0n); }
      assert.equal(typeof scenario.qualifiesFreeShipping, 'boolean');
      if (key === 'addon') { checkKeys(scenario.addOn, ['name', 'priceCents', 'quantity']); assert.equal(scenario.addOn.quantity, 1); }
    }
    if (!draft.addOn) assert.deepEqual(value.summary, { baselineFinalTotalCents: 1000n, addOnFinalTotalCents: null, addOnPriceCents: null, differenceCents: null });
  }
});
test('Add-on value errors remain bounded and dedicated, schema first', () => {
  for (const extra of [{ name: '', price: '0' }, { name: ' '.repeat(257), price: '0' }, { name: 'a'.repeat(81), price: '0' }, { name: 'a\u0001b', price: '0' }, { name: 'Extra', price: '' }, { name: 'Extra', price: '10000000' }, { name: 'Extra', price: '0'.repeat(17) }, { name: 'Extra', price: '1,000' }]) error(request({ addOn: extra }), 'INVALID_ADD_ON', null, 'addOn');
});
