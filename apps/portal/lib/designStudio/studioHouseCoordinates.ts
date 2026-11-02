/** Derived finite numbers enter the existing decimal-string house contract here.
 * Expand exponent notation without rounding, epsilon snapping or changing raw
 * user-input grammar. String(-0) already canonically represents zero as "0". */
export function studioComputedCoordinate(value: number): string {
  if (!Number.isFinite(value)) throw Error('Computed house coordinates must be finite.');
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, power] = text.toLowerCase().split('e');
  const negative = coefficient.startsWith('-'), unsigned = negative ? coefficient.slice(1) : coefficient;
  const point = unsigned.indexOf('.'), digits = unsigned.replace('.', '');
  const offset = (point < 0 ? unsigned.length : point) + Number(power);
  const plain = offset <= 0 ? `0.${'0'.repeat(-offset)}${digits}`
    : offset >= digits.length ? digits + '0'.repeat(offset - digits.length)
    : `${digits.slice(0, offset)}.${digits.slice(offset)}`;
  return (negative ? '-' : '') + plain;
}
