import type { QuantityUnit } from "@/types/domain";

export const quantityUnitValues = ["g", "ml", "pieces", "portions", "pots", "paquets", "bouteilles"] as const;

export function isQuantityUnit(value: unknown): value is QuantityUnit {
  return typeof value === "string" && quantityUnitValues.includes(value as QuantityUnit);
}

export function normalizeQuantityUnit(value: unknown): QuantityUnit {
  if (typeof value !== "string") {
    return "pieces";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (normalized === "g" || normalized === "gramme" || normalized === "grammes") {
    return "g";
  }

  if (normalized === "ml" || normalized === "millilitre" || normalized === "millilitres") {
    return "ml";
  }

  if (["portion", "portions"].includes(normalized)) {
    return "portions";
  }

  if (["pot", "pots"].includes(normalized)) {
    return "pots";
  }

  if (["paquet", "paquets"].includes(normalized)) {
    return "paquets";
  }

  if (["bouteille", "bouteilles"].includes(normalized)) {
    return "bouteilles";
  }

  return "pieces";
}

export function formatQuantity(quantity: number, unit: QuantityUnit) {
  const normalizedUnit = normalizeQuantityUnit(unit);

  if (normalizedUnit === "g") {
    if (quantity >= 1000) {
      return `${formatNumber(quantity / 1000)} kg`;
    }

    return `${formatNumber(quantity)} g`;
  }

  if (normalizedUnit === "ml") {
    if (quantity >= 1000) {
      return `${formatNumber(quantity / 1000)} L`;
    }

    return `${formatNumber(quantity)} ml`;
  }

  return `${formatNumber(quantity)} ${quantityUnitLabel(normalizedUnit, quantity)}`;
}

export function quantityUnitLabel(unit: QuantityUnit, quantity = 2) {
  const singular = quantity === 1;

  if (unit === "pieces") {
    return singular ? "pièce" : "pièces";
  }

  if (unit === "portions") {
    return singular ? "portion" : "portions";
  }

  if (unit === "pots") {
    return singular ? "pot" : "pots";
  }

  if (unit === "paquets") {
    return singular ? "paquet" : "paquets";
  }

  if (unit === "bouteilles") {
    return singular ? "bouteille" : "bouteilles";
  }

  return unit;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
