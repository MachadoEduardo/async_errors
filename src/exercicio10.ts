export interface Item { price: number; qty: number }

export function applyDiscount(items: Item[]): number {
  let total = 0;
  for (let index = 0; index < items.length; index++) {
    total += items[index].price * items[index].qty;
  }
  if (total > 200) total *= 0.95;
  return Number(total.toFixed(2));
}

export function brokenDiscount(items: Item[]): number {
  let total = 0;
  let applied = 0;
  for (let index = 0; index < items.length; index++) {
    total += items[index].price * items[index].qty;
    if (total > 200 && applied < 2) {
      total -= total * 0.05;
      applied++;
    }
  }
  return Number(total.toFixed(2));
}

if (require.main === module) {
  const items = [{ price: 100, qty: 1 }, { price: 150, qty: 1 }, { price: 50, qty: 2 }];
  const reordered = [items[0], items[2], items[1]];
  console.log('antes:', brokenDiscount(items), brokenDiscount(reordered));
  console.log('depois:', applyDiscount(items), applyDiscount(reordered));
}
