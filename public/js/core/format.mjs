export function formatCents(value) {
  if (typeof value !== 'bigint') throw new TypeError('Expected integer cents');
  const magnitude = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`;
}
