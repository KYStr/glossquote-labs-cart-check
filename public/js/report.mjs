import { formatCents } from './core/format.mjs';

export function differenceText(summary, t) {
  const difference = summary.differenceCents;
  if (difference === 0n) return `${t.same} · ${formatCents(0n)}`;
  return `${difference > 0n ? t.more : t.less} ${formatCents(difference < 0n ? -difference : difference)}`;
}

export function scenarioEntries(value, t) {
  return [
    [t.subtotal, formatCents(value.subtotalCents), 'subtotal'],
    [`${t.percentageDiscount} (${formatCents(value.percentOffBasisPoints)}%)`, `−${formatCents(value.percentageDiscountCents)}`, 'percentage-discount'],
    [t.afterPercent, formatCents(value.afterPercentCents), 'after-percent'],
    [t.requestedCoupon, formatCents(value.fixedCouponRequestedCents), 'coupon-requested'],
    [t.appliedCoupon, `−${formatCents(value.fixedCouponAppliedCents)}`, 'coupon-applied'],
    [t.merchNet, formatCents(value.merchNetCents), 'merch-net'],
    [t.thresholdAmount, value.thresholdCents === null ? t.noThreshold : formatCents(value.thresholdCents), 'threshold', value.thresholdCents === null],
    [t.basis, value.thresholdBasis === 'pre-discount' ? t.pre : t.post, 'basis', true],
    [t.measure, value.thresholdMeasureCents === null ? t.noThreshold : formatCents(value.thresholdMeasureCents), 'measure', value.thresholdMeasureCents === null],
    [t.qualifies, value.thresholdCents === null ? t.noThreshold : value.qualifiesFreeShipping ? t.qualifiesYes : t.qualifiesNo, 'qualifies', true],
    [t.shippingInput, formatCents(value.shippingInputCents), 'shipping-input'],
    [t.shippingCharged, formatCents(value.shippingChargedCents), 'shipping-charged'],
    [t.total, formatCents(value.finalTotalCents), 'total']
  ];
}

export function makeReport(value, t) {
  const lines = [t.h1, t.caution, t.privacy, ''];
  for (const [heading, scenario] of [[t.current, value.baseline], [t.added, value.addOnScenario]]) {
    if (scenario === null) continue;
    lines.push(heading);
    for (const row of scenario.items) lines.push(`${row.name} | ${t.price}: ${formatCents(row.unitPriceCents)} | ${t.quantity}: ${row.quantity} | ${t.line}: ${formatCents(row.lineCents)}`);
    for (const [label, amount] of scenarioEntries(scenario, t)) lines.push(`${label}: ${amount}`);
    lines.push('');
  }
  if (value.addOnScenario) lines.push(`${t.addOnCost}: ${formatCents(value.summary.addOnPriceCents)}`, differenceText(value.summary, t), t.included, t.compareHelp);
  return lines.join('\n');
}
