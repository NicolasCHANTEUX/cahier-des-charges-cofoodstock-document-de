import { NextResponse } from "next/server";
import { lookupOpenFoodFactsProduct, searchOpenFoodFactsProducts, type OpenFoodFactsLookupResult } from "@/lib/open-food-facts";
import { proxiedOffImageUrl } from "@/lib/image-proxy";

export const dynamic = "force-dynamic";

type ShoppingSuggestionResponse = {
  id: string;
  label: string;
  reason: string;
  icon: string;
  imageUrl?: string;
};

const curatedQueries = [
  { id: "milk", queries: ["lactel", "lait lactel"], reason: "Basique du quotidien" },
  { id: "yogurt", queries: ["yaourt nature danone", "danone nature"], reason: "Petit-déjeuner rapide" },
  { id: "eggs", queries: ["oeufs fermiers", "oeufs frais", "oeufs"], reason: "Protéines faciles" },
  { id: "pasta", queries: ["pates barilla", "barilla spaghetti"], reason: "Repas rapide" },
  { id: "rice", queries: ["riz basmati", "taureau aile basmati"], reason: "Base polyvalente" },
  { id: "tomatoes", queries: ["tomates cerise", "tomates cerises"], reason: "Cuisine fraîche" },
  { id: "bananas", queries: ["bananes", "banane"], reason: "Collation classique" },
  { id: "chicken", queries: ["poulet fermier label rouge", "poulet fermier"], reason: "Plat principal simple" }
];

const preferredSuggestionBarcodes: Record<string, string> = {
  milk: "3428273980046",
  yogurt: "6111032002925",
  eggs: "3251320080617",
  pasta: "8076800195057",
  rice: "3760341070472",
  tomatoes: "3276558775128"
};

export async function GET() {
  const suggestions = await Promise.all(
    curatedQueries.map(async (entry) => {
      const product = await pickSuggestionProduct(entry);
      const label = product?.name ?? titleCase(entry.queries[0]);
      const icon = createIconLabel(product?.name ?? entry.queries[0]);

      return {
        id: entry.id,
        label,
        reason: entry.reason,
        icon,
        imageUrl: proxiedOffImageUrl(product?.imageUrl)
      } satisfies ShoppingSuggestionResponse;
    })
  );

  return NextResponse.json({ ok: true, suggestions });
}

async function pickSuggestionProduct(entry: (typeof curatedQueries)[number]) {
  let fallbackProduct: OpenFoodFactsLookupResult | undefined;
  const preferredBarcode = preferredSuggestionBarcodes[entry.id];

  if (preferredBarcode) {
    const preferredProduct = await lookupOpenFoodFactsProduct(preferredBarcode).catch(() => null);

    if (preferredProduct?.imageUrl) {
      return preferredProduct;
    }
  }

  for (const query of entry.queries) {
    const results = await searchOpenFoodFactsProducts(query, 100, { sortBy: "unique_scans_n" }).catch(() => []);
    const candidateWithImage = await findCandidateWithImage(results);

    if (candidateWithImage) {
      return candidateWithImage;
    }

    if (results[0]) {
      fallbackProduct = fallbackProduct ?? results[0];
    }
  }

  for (const query of entry.queries) {
    const imageResults = await searchOpenFoodFactsProducts(query, 100, { image: true, sortBy: "unique_scans_n" }).catch(() => []);
    const candidateWithImage = await findCandidateWithImage(imageResults);

    if (candidateWithImage) {
      return candidateWithImage;
    }
  }

  return fallbackProduct;
}

async function findCandidateWithImage(results: OpenFoodFactsLookupResult[]) {
  const directImageCandidate = results.find((candidate) => Boolean(candidate.imageUrl));

  if (directImageCandidate) {
    return directImageCandidate;
  }

  for (const candidate of results.slice(0, 8)) {
    if (!candidate.barcode) {
      continue;
    }

    const hydratedCandidate = await lookupOpenFoodFactsProduct(candidate.barcode).catch(() => null);

    if (hydratedCandidate?.imageUrl) {
      return {
        ...candidate,
        ...hydratedCandidate,
        name: candidate.name || hydratedCandidate.name,
        storageArea: candidate.storageArea ?? hydratedCandidate.storageArea
      };
    }
  }

  return undefined;
}

function createIconLabel(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return compact || "PR";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
