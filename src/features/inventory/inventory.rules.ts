import type { InventoryItem } from "@/types/domain";

export function isExpiringSoon(item: InventoryItem) {
  return item.dlcStatus?.tone === "red" || item.dlcStatus?.tone === "orange";
}

export function canDecreaseQuantity(item: InventoryItem) {
  return item.quantity > 0;
}

