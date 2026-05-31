import type { QuantityUnit } from "@/types/domain";

export function formatQuantity(quantity: number, unit: QuantityUnit) {
  if (unit === "g") {
    if (quantity >= 1000) {
      return `${formatNumber(quantity / 1000)} kg`;
    }

    return `${formatNumber(quantity)} g`;
  }

  if (unit === "ml") {
    if (quantity >= 1000) {
      return `${formatNumber(quantity / 1000)} L`;
    }

    return `${formatNumber(quantity)} ml`;
  }

  return `${formatNumber(quantity)} ${unit}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

