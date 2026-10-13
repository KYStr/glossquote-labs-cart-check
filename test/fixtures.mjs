// Offline, fictional inputs only. Expected cents are literal test constants.
export const item = (name = 'Example item', price = '10.00', quantity = '1') => ({ name, price, quantity });
export const request = (overrides = {}) => ({
  items: [item()], percentOff: '0', fixedCoupon: '0', freeShippingThreshold: '',
  thresholdBasis: 'post-discount', shipping: '0', addOn: null, ...overrides
});
export const shippingExample = (price = '100') => request({
  items: [item('Example basket', '900')], shipping: '80', freeShippingThreshold: '1000',
  addOn: { name: 'Example add-on', price }
});
export const ROW_KEYS = ['name', 'unitPriceCents', 'quantity', 'lineCents'];
export const SCENARIO_KEYS = ['items', 'subtotalCents', 'percentOffBasisPoints', 'percentageDiscountCents', 'afterPercentCents', 'fixedCouponRequestedCents', 'fixedCouponAppliedCents', 'merchNetCents', 'thresholdCents', 'thresholdBasis', 'thresholdMeasureCents', 'qualifiesFreeShipping', 'shippingInputCents', 'shippingChargedCents', 'finalTotalCents'];
