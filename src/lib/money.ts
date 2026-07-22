export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getPreTaxAmount(price: number, taxExempt: boolean | undefined): number {
  if (taxExempt) {
    return price;
  }
  return roundCents(price / 1.18);
}

export function roundUpToNearestFive(value: number): number {
  // If value has no decimal part, return it without changes
  if (value % 1 === 0) {
    return value;
  }
  // If it has a decimal part, round up to the nearest multiple of 5
  return roundCents(Math.ceil(value / 5) * 5);
}
