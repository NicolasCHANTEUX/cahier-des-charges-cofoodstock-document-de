import type { ShoppingItem } from "@/types/domain";

export function countCheckedItems(items: ShoppingItem[]) {
  return items.filter((item) => item.checked).length;
}

export function canFinishShopping(items: ShoppingItem[]) {
  return countCheckedItems(items) > 0;
}

