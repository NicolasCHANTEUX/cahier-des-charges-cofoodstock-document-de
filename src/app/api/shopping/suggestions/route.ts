import { NextResponse } from "next/server";
import { searchOpenFoodFactsProducts } from "@/lib/open-food-facts";
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

export async function GET() {
  const suggestions = await Promise.all(
    curatedQueries.map(async (entry) => {
      const product = await pickSuggestionProduct(entry.queries);
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

async function pickSuggestionProduct(queries: string[]) {
  let fallbackProduct;

  for (const query of queries) {
    const results = await searchOpenFoodFactsProducts(query, 100).catch(() => []);
    const candidateWithImage = results.find((candidate) => Boolean(candidate.imageUrl));

    if (candidateWithImage) {
      return candidateWithImage;
    }

    if (results[0]) {
      fallbackProduct = fallbackProduct ?? results[0];
    }
  }

  return fallbackProduct;
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
