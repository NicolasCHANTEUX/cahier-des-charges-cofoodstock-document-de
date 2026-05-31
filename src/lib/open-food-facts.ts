export type OpenFoodFactsLookupResult = {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  quantityText?: string;
  quantityValue?: number;
  quantityUnit?: "g" | "ml" | "pieces";
  storageArea?: "fresh" | "frozen" | "dry" | "other";
  nutriscore?: string;
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  saltG?: number;
  source: "open_food_facts";
};

type OpenFoodFactsApiResponse = {
  status: number;
  product?: {
    code?: string;
    product_name?: string;
    brands?: string;
    categories?: string;
    image_front_url?: string;
    image_url?: string;
    quantity?: string;
    nutriscore_grade?: string;
    nutriments?: {
      "energy-kcal_100g"?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
      sugars_100g?: number;
      salt_100g?: number;
    };
  };
};

export async function lookupOpenFoodFactsProduct(barcode: string): Promise<OpenFoodFactsLookupResult | null> {
  const cleanBarcode = barcode.trim();

  if (!cleanBarcode) {
    return null;
  }

  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`, {
    headers: {
      "User-Agent": "EcoFoodStock/0.1.0"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OpenFoodFactsApiResponse;

  if (payload.status !== 1 || !payload.product) {
    return null;
  }

  const product = payload.product;
  const parsedQuantity = parseQuantityText(product.quantity?.trim());
  const inferredStorageArea = inferStorageArea(product.categories, product.product_name, product.quantity);

  return {
    barcode: product.code ?? cleanBarcode,
    name: product.product_name?.trim() || "Produit sans nom",
    brand: product.brands?.split(",").map((value) => value.trim()).filter(Boolean)[0],
    category: product.categories?.split(",").map((value) => value.trim()).filter(Boolean)[0],
    imageUrl: product.image_front_url || product.image_url,
    quantityText: product.quantity?.trim(),
    quantityValue: parsedQuantity?.value,
    quantityUnit: parsedQuantity?.unit,
    storageArea: inferredStorageArea,
    nutriscore: product.nutriscore_grade?.toUpperCase(),
    caloriesKcal: product.nutriments?.["energy-kcal_100g"],
    proteinG: product.nutriments?.proteins_100g,
    carbsG: product.nutriments?.carbohydrates_100g,
    fatG: product.nutriments?.fat_100g,
    fiberG: product.nutriments?.fiber_100g,
    sugarG: product.nutriments?.sugars_100g,
    saltG: product.nutriments?.salt_100g,
    source: "open_food_facts"
  };
}

function parseQuantityText(quantityText?: string) {
  if (!quantityText) {
    return null;
  }

  const normalized = quantityText.toLowerCase().replace(/,/g, ".").trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl|mg|pcs?|pi[eè]ces?|unit[eé]s?)/i);

  if (!match) {
    return null;
  }

  const rawValue = Number(match[1]);
  const rawUnit = match[2].toLowerCase();

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return null;
  }

  if (rawUnit === "kg") {
    return { value: roundQuantity(rawValue * 1000), unit: "g" as const };
  }

  if (rawUnit === "g" || rawUnit === "mg") {
    return { value: rawUnit === "mg" ? roundQuantity(rawValue / 1000) : roundQuantity(rawValue), unit: "g" as const };
  }

  if (rawUnit === "l") {
    return { value: roundQuantity(rawValue * 1000), unit: "ml" as const };
  }

  if (rawUnit === "cl") {
    return { value: roundQuantity(rawValue * 10), unit: "ml" as const };
  }

  if (rawUnit === "ml") {
    return { value: roundQuantity(rawValue), unit: "ml" as const };
  }

  return { value: roundQuantity(rawValue), unit: "pieces" as const };
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function inferStorageArea(categories?: string, name?: string, quantity?: string) {
  const haystack = [categories, name, quantity].filter(Boolean).join(" ").toLowerCase();

  if (!haystack) {
    return undefined;
  }

  if (containsAny(haystack, ["surgel", "congel", "frozen", "ice cream", "glace", "sorbet", "freezer"])) {
    return "frozen";
  }

  if (containsAny(haystack, ["yaourt", "yogurt", "lait", "milk", "fromage", "cheese", "viande", "meat", "poisson", "fish", "fruit", "vegetable", "legume", "salade", "salad", "fresh", "frais"])) {
    return "fresh";
  }

  if (containsAny(haystack, ["pate a tartiner", "spread", "pates", "pasta", "riz", "rice", "cereale", "cereal", "biscuit", "cookie", "chocolat", "flour", "farine", "sugar", "sucre", "huile", "oil", "conserve", "canne", "sauce", "condiment", "breakfast", "snack", "epicerie", "grocery", "pantry"])) {
    return "dry";
  }

  return undefined;
}

function containsAny(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword));
}