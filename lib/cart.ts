import type { CartLine } from './types';
export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.price_cents * line.quantity, 0);
}
export function cartCount(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
export function setCartQuantity(lines: CartLine[], id: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity)) return lines;
  return lines
    .map((l) =>
      l.variant_id === id
        ? { ...l, quantity: Math.max(0, Math.min(Math.trunc(quantity), l.available, 20)) }
        : l,
    )
    .filter((l) => l.quantity > 0);
}
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const old = lines.find((l) => l.variant_id === line.variant_id);
  if (old)
    return setCartQuantity(
      lines.map((l) =>
        l.variant_id === line.variant_id
          ? { ...l, available: line.available, price_cents: line.price_cents }
          : l,
      ),
      line.variant_id,
      old.quantity + line.quantity,
    );
  return setCartQuantity([...lines, line], line.variant_id, line.quantity);
}
