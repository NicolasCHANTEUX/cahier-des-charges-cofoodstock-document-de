"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, MinusCircle, Plus, Trash2, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuantityPromptModal } from "@/components/shared/QuantityPromptModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProductThumbnail } from "@/components/shared/ProductThumbnail";
import { AddProductDialog } from "@/features/inventory/AddProductDialog";
import { formatQuantity } from "@/lib/units";
import { getBrowserAuthHeaders } from "@/lib/supabase/browser-auth";
import type { InventoryItem } from "@/types/domain";

const filters = ["Tous", "Frais", "Surgeles", "Sec", "DLC Proche"];

export function InventoryView() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [quantityPrompt, setQuantityPrompt] = useState<{
    title: string;
    description: string;
    value: string;
  } | null>(null);
  const quantityPromptResolveRef = useRef<((value: string | null) => void) | null>(null);

  async function loadInventory() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        cache: "no-store",
        headers: await getBrowserAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { inventory: InventoryItem[] };
      setInventory(payload.inventory);
    } catch {
      setError("Impossible de charger l'inventaire depuis Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = matchesInventoryFilter(item, activeFilter);
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, inventory, search]);

  function openQuantityPrompt(options: { title: string; description: string; defaultValue: string }) {
    return new Promise<string | null>((resolve) => {
      quantityPromptResolveRef.current = resolve;
      setQuantityPrompt({
        title: options.title,
        description: options.description,
        value: options.defaultValue
      });
    });
  }

  function closeQuantityPrompt(nextValue: string | null) {
    quantityPromptResolveRef.current?.(nextValue);
    quantityPromptResolveRef.current = null;
    setQuantityPrompt(null);
  }

  async function mutateInventory(item: InventoryItem, action: "consume" | "waste" | "adjust", quantity: number) {
    setMutatingId(item.id);

    try {
      const authHeaders = await getBrowserAuthHeaders();
      const response = await fetch("/api/inventory/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          productId: item.id,
          action,
          quantity
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await loadInventory();
    } catch (error) {
      setError("Impossible de modifier le stock pour le moment.");
    } finally {
      setMutatingId(null);
    }
  }

  async function askDecrease(item: InventoryItem, action: "consume" | "waste" | "adjust") {
    const defaultAmount = action === "waste" ? item.quantity : Math.min(item.quantity, getDefaultDecreaseAmount(item));
    const value = await openQuantityPrompt({
      title: action === "waste" ? `Quelle quantite de "${item.name}" voulez-vous jeter ?` : `Quelle quantite de "${item.name}" voulez-vous consommer ?`,
      description: action === "waste" ? "Saisissez la quantité à retirer du stock." : "Saisissez la quantité à retirer du stock.",
      defaultValue: String(defaultAmount)
    });

    if (!value) {
      return;
    }

    const amount = Number(value.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    void mutateInventory(item, action, amount);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={Box}
          title="Mon inventaire"
          description={loading ? "Chargement des produits..." : `${inventory.length} produits en stock`}
        />
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <Card className="mx-auto max-w-4xl">
        {error ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <input
          className="mb-4 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-brand-500"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <button key={filter} type="button" onClick={() => setActiveFilter(filter)}>
              <Badge tone={activeFilter === filter ? "green" : "slate"}>
                {filter}
              </Badge>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Chargement des stocks depuis Supabase...
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold">Aucun produit trouve</p>
            <p className="mt-1 text-sm text-slate-500">
              Modifiez la recherche ou ajoutez un produit au stock.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-lg border border-slate-200 px-3 py-3 sm:grid-cols-[auto_auto_1fr_auto_auto] sm:items-center"
              >
                <input className="hidden h-5 w-5 rounded border-slate-300 sm:block" type="checkbox" />
                <div className="flex items-center gap-3">
                  <ProductThumbnail name={item.name} imageUrl={item.imageUrl} fallbackLabel={item.icon} />
                  <div className="min-w-0 sm:hidden">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {formatQuantity(item.quantity, item.unit)}
                      {item.expirationLabel ? ` - ${item.expirationLabel}` : ""}
                    </p>
                  </div>
                </div>

                <div className="hidden min-w-0 sm:block">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {formatQuantity(item.quantity, item.unit)}
                    {item.expirationLabel ? ` - ${item.expirationLabel}` : ""}
                  </p>
                </div>

                {item.dlcStatus ? <Badge tone={item.dlcStatus.tone}>{item.dlcStatus.label}</Badge> : <span />}

                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                    disabled={mutatingId === item.id}
                    onClick={() => askDecrease(item, "adjust")}
                  >
                    <MinusCircle className="h-4 w-4" />
                    Reduire
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                    disabled={mutatingId === item.id}
                    onClick={() => askDecrease(item, "consume")}
                  >
                    <Utensils className="h-4 w-4" />
                    Consomme
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 gap-2 px-3 text-rose-600"
                    disabled={mutatingId === item.id}
                    onClick={() => askDecrease(item, "waste")}
                  >
                    <Trash2 className="h-4 w-4" />
                    Jete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddProductDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onPersisted={() => {
          setAddDialogOpen(false);
          void loadInventory();
        }}
        onAdd={() => {
          setAddDialogOpen(false);
          void loadInventory();
        }}
      />

      <QuantityPromptModal
        open={quantityPrompt !== null}
        title={quantityPrompt?.title ?? ""}
        description={quantityPrompt?.description}
        value={quantityPrompt?.value ?? ""}
        onValueChange={(nextValue) => {
          setQuantityPrompt((current) => (current ? { ...current, value: nextValue } : current));
        }}
        onConfirm={() => {
          closeQuantityPrompt(quantityPrompt?.value ?? null);
        }}
        onCancel={() => {
          closeQuantityPrompt(null);
        }}
      />
    </div>
  );
}

function getDefaultDecreaseAmount(item: InventoryItem) {
  if (item.unit === "g" || item.unit === "ml") {
    return Math.min(100, item.quantity);
  }

  return 1;
}

function matchesInventoryFilter(item: InventoryItem, filter: string) {
  if (filter === "Tous") {
    return true;
  }

  if (filter === "Frais") {
    return item.storageArea === "fresh";
  }

  if (filter === "Surgeles") {
    return item.storageArea === "frozen";
  }

  if (filter === "Sec") {
    return item.storageArea === "dry";
  }

  return Boolean(item.dlcStatus);
}
