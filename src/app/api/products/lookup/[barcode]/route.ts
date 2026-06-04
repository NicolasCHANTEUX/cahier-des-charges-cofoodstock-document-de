import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lookupOpenFoodFactsProduct } from "@/lib/open-food-facts";
import { proxiedOffImageUrl } from "@/lib/image-proxy";
import { resolveAccountContext } from "@/lib/supabase/account-context";

type RouteContext = {
  params: Promise<{ barcode: string }>;
};

type CatalogProductRow = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  source: string;
  default_storage_area: string;
  default_unit: string;
};

export async function GET(req: Request, { params }: RouteContext) {
  const { barcode } = await params;

  const supabase = (() => {
    try {
      return createSupabaseServerClient();
    } catch {
      return null;
    }
  })();
  let canWriteCatalog = false;

  if (supabase) {
    const context = await resolveAccountContext(req, supabase);
    canWriteCatalog = Boolean(context.authenticated && context.appUserId);
  }

  if (supabase) {
    const { data: existingProduct, error: productError } = await supabase
      .from("products")
      .select("id, barcode, name, brand, category, image_url, source, default_storage_area, default_unit")
      .eq("barcode", barcode)
      .maybeSingle<CatalogProductRow>();

    if (!productError && existingProduct) {
      const offProduct = await lookupOpenFoodFactsProduct(barcode).catch(() => null);

      return NextResponse.json({
        ok: true,
        found: true,
        source: "supabase",
        product: {
          barcode: existingProduct.barcode ?? barcode,
          name: existingProduct.name,
          brand: existingProduct.brand ?? undefined,
          category: existingProduct.category ?? undefined,
          imageUrl: proxiedOffImageUrl(existingProduct.image_url ?? undefined),
          source: "supabase" as const,
          quantityText: offProduct?.quantityText,
          quantityValue: offProduct?.quantityValue,
          quantityUnit: offProduct?.quantityUnit,
          storageArea: existingProduct.default_storage_area !== "other" ? existingProduct.default_storage_area : offProduct?.storageArea
        }
      });
    }
  }

  const product = await lookupOpenFoodFactsProduct(barcode);

  if (!product) {
    return NextResponse.json({ ok: false, barcode, found: false }, { status: 404 });
  }

  if (supabase && canWriteCatalog) {
    const { data: storedProduct, error: upsertError } = await supabase
      .from("products")
      .upsert(
        {
          barcode: product.barcode,
          name: product.name,
          brand: product.brand ?? null,
          category: product.category ?? null,
          image_url: product.imageUrl ?? null,
          source: "open_food_facts",
          default_storage_area: product.storageArea ?? "other",
          default_unit: "unit"
        },
        { onConflict: "barcode" }
      )
      .select("id, barcode, name, brand, category, image_url")
      .maybeSingle();

    if (!upsertError && storedProduct && product.caloriesKcal !== undefined) {
      await supabase.from("product_nutrition").upsert(
        {
          product_id: storedProduct.id,
          per_unit: "100g",
          calories_kcal: product.caloriesKcal,
          protein_g: product.proteinG ?? null,
          carbs_g: product.carbsG ?? null,
          fat_g: product.fatG ?? null,
          fiber_g: product.fiberG ?? null,
          sugar_g: product.sugarG ?? null,
          salt_g: product.saltG ?? null
        },
        { onConflict: "product_id" }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    found: true,
    product: {
      ...product,
      imageUrl: proxiedOffImageUrl(product.imageUrl)
    }
  });
}