const MAX_PRICE = 999999999n;
const MAX_SUBTOTAL = 29999999970000n;
const DECIMAL = /^[0-9]+(?:\.[0-9]{1,2})?$/;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;
const REQUEST_KEYS = ['items', 'percentOff', 'fixedCoupon', 'freeShippingThreshold', 'thresholdBasis', 'shipping', 'addOn'];
const SCALAR_KEYS = REQUEST_KEYS.filter(key => key !== 'items' && key !== 'addOn');

function fail(code, row = null, field = null) {
  return { ok: false, error: { code, row, field } };
}

// Read descriptors, never a getter. Validate the entire schema before values.
function exactObject(value, keys) {
  if (value === null || typeof value !== 'object') return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) return null;
  const data = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    data[key] = descriptor.value;
  }
  return data;
}

function exactItems(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  const own = Reflect.ownKeys(value);
  if (own.length !== length + 1 || !own.includes('length')) return null;
  const rows = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    const row = exactObject(descriptor.value, ['name', 'price', 'quantity']);
    if (!row || Object.values(row).some(field => typeof field !== 'string')) return null;
    rows.push(row);
  }
  return rows;
}

function cents(text) {
  const [whole, fractional = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fractional.padEnd(2, '0'));
}

function money(raw, limit, max, invalid, tooLarge = invalid, optional = false) {
  if (raw.length > limit) return { code: invalid };
  const text = raw.trim();
  if (optional && text === '') return { value: null };
  if (text.length > limit || !DECIMAL.test(text)) return { code: invalid };
  const value = cents(text);
  return value > max ? { code: tooLarge } : { value };
}

function nameError(raw) {
  if (raw.length > 256) return 'NAME_RAW_TOO_LONG';
  const name = raw.trim();
  if (!name) return 'ROW_INCOMPLETE';
  if (name.length > 80) return 'NAME_TOO_LONG';
  if (CONTROLS.test(name)) return 'CONTROL_CHARACTER';
  return null;
}

function validateRow(row, number) {
  const nameCode = nameError(row.name);
  if (nameCode) return fail(nameCode, number, 'name');
  if (row.price.length <= 16 && row.price.trim() === '') return fail('ROW_INCOMPLETE', number, 'price');
  const price = money(row.price, 16, MAX_PRICE, 'INVALID_PRICE', 'PRICE_TOO_LARGE');
  if (price.code) return fail(price.code, number, 'price');
  if (row.quantity === '') return fail('ROW_INCOMPLETE', number, 'quantity');
  if (row.quantity.length > 4 || /[^0-9]/.test(row.quantity)) return fail('INVALID_QUANTITY', number, 'quantity');
  const quantity = Number(row.quantity);
  if (quantity < 1 || quantity > 1000) return fail('INVALID_QUANTITY', number, 'quantity');
  return { ok: true, value: { name: row.name.trim(), unitPriceCents: price.value, quantity, lineCents: price.value * BigInt(quantity) } };
}

function scenario(items, percentOffBasisPoints, fixedCouponRequestedCents, thresholdCents, thresholdBasis, shippingInputCents) {
  const subtotalCents = items.reduce((sum, item) => sum + item.lineCents, 0n);
  const percentageDiscountCents = (2n * subtotalCents * percentOffBasisPoints + 10000n) / 20000n;
  const afterPercentCents = subtotalCents - percentageDiscountCents;
  const fixedCouponAppliedCents = fixedCouponRequestedCents < afterPercentCents ? fixedCouponRequestedCents : afterPercentCents;
  const merchNetCents = afterPercentCents - fixedCouponAppliedCents;
  const thresholdMeasureCents = thresholdCents === null ? null : thresholdBasis === 'pre-discount' ? subtotalCents : merchNetCents;
  const qualifiesFreeShipping = thresholdCents !== null && thresholdMeasureCents >= thresholdCents;
  const shippingChargedCents = qualifiesFreeShipping ? 0n : shippingInputCents;
  return { items, subtotalCents, percentOffBasisPoints, percentageDiscountCents, afterPercentCents, fixedCouponRequestedCents, fixedCouponAppliedCents, merchNetCents, thresholdCents, thresholdBasis, thresholdMeasureCents, qualifiesFreeShipping, shippingInputCents, shippingChargedCents, finalTotalCents: merchNetCents + shippingChargedCents };
}

export function calculateCart(request) {
  let data, rows, extra;
  try {
    data = exactObject(request, REQUEST_KEYS);
    if (!data || SCALAR_KEYS.some(key => typeof data[key] !== 'string')) return fail('INVALID_REQUEST');
    rows = exactItems(data.items);
    if (!rows) return fail('INVALID_REQUEST');
    if (data.addOn !== null) {
      extra = exactObject(data.addOn, ['name', 'price']);
      if (!extra || typeof extra.name !== 'string' || typeof extra.price !== 'string') return fail('INVALID_REQUEST');
    }
  } catch {
    return fail('INVALID_REQUEST');
  }
  if (rows.length === 0) return fail('TOO_FEW_ITEMS', null, 'items');
  if (rows.length > 30) return fail('TOO_MANY_ITEMS', null, 'items');
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = validateRow(rows[i], i + 1);
    if (!parsed.ok) return parsed;
    items.push(parsed.value);
  }
  const percent = money(data.percentOff, 8, 10000n, 'INVALID_PERCENT');
  if (percent.code) return fail(percent.code, null, 'percentOff');
  const fixed = money(data.fixedCoupon, 18, MAX_SUBTOTAL, 'INVALID_FIXED_COUPON', 'FIXED_COUPON_TOO_LARGE');
  if (fixed.code) return fail(fixed.code, null, 'fixedCoupon');
  const threshold = money(data.freeShippingThreshold, 18, MAX_SUBTOTAL, 'INVALID_THRESHOLD', 'INVALID_THRESHOLD', true);
  if (threshold.code) return fail(threshold.code, null, 'freeShippingThreshold');
  if (!['pre-discount', 'post-discount'].includes(data.thresholdBasis)) return fail('INVALID_REQUEST', null, 'thresholdBasis');
  const shipping = money(data.shipping, 16, 9999999n, 'INVALID_SHIPPING');
  if (shipping.code) return fail(shipping.code, null, 'shipping');
  let addOn = null;
  if (extra) {
    // Add-on value errors use its dedicated stable code; schema errors were checked above.
    const price = money(extra.price, 16, MAX_PRICE, 'INVALID_ADD_ON');
    if (nameError(extra.name) || price.code) return fail('INVALID_ADD_ON', null, 'addOn');
    addOn = { name: extra.name.trim(), priceCents: price.value, quantity: 1 };
  }
  const args = [percent.value, fixed.value, threshold.value, data.thresholdBasis, shipping.value];
  const baseline = scenario(items, ...args);
  const addOnScenario = addOn === null ? null : {
    ...scenario([...items, { name: addOn.name, unitPriceCents: addOn.priceCents, quantity: 1, lineCents: addOn.priceCents }], ...args), addOn
  };
  return { ok: true, value: {
    items,
    discount: { percentOffBasisPoints: percent.value, fixedCouponRequestedCents: fixed.value },
    baseline, addOnScenario,
    summary: { baselineFinalTotalCents: baseline.finalTotalCents, addOnFinalTotalCents: addOnScenario?.finalTotalCents ?? null, addOnPriceCents: addOn?.priceCents ?? null, differenceCents: addOnScenario === null ? null : addOnScenario.finalTotalCents - baseline.finalTotalCents }
  } };
}
