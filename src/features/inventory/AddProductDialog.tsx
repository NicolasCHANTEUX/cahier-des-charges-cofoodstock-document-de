"use client";

import { type FormEvent, useState } from "react";
import { Barcode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductThumbnail } from "@/components/shared/ProductThumbnail";
import type { AddInventoryInput } from "@/features/mvp/useMvpStore";
import type { QuantityUnit, StorageArea } from "@/types/domain";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "found";
      label: string;
      brand?: string;
      category?: string;
      imageUrl?: string;
      quantityText?: string;
      quantityValue?: number;
      quantityUnit?: QuantityUnit;
      storageArea?: StorageArea;
    }
  | { status: "not-found" }
  | { status: "error"; message: string };

type AddProductDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd?: (input: AddInventoryInput) => void;
  onPersisted?: () => void;
};

const unitOptions: { label: string; value: QuantityUnit }[] = [
  { label: "Grammes", value: "g" },
  { label: "Millilitres", value: "ml" },
  { label: "Pieces", value: "pieces" },
  { label: "Portions", value: "portions" },
  { label: "Pots", value: "pots" },
  { label: "Paquets", value: "paquets" },
  { label: "Bouteilles", value: "bouteilles" }
];

const storageOptions: { label: string; value: StorageArea }[] = [
  { label: "Frais", value: "fresh" },
  { label: "Surgeles", value: "frozen" },
  { label: "Sec", value: "dry" },
  { label: "Autre", value: "other" }
];

export function AddProductDialog({ open, onClose, onAdd, onPersisted }: AddProductDialogProps) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<QuantityUnit>("pieces");
  const [storageArea, setStorageArea] = useState<StorageArea>("fresh");
  const [expirationDate, setExpirationDate] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });

  if (!open) {
    return null;
  }

  async function lookupProduct() {
    const cleanBarcode = barcode.trim();

    if (!cleanBarcode) {
      setLookup({ status: "error", message: "Renseigne d'abord un code-barres." });
      return;
    }

    try {
      setLookup({ status: "loading" });

      const response = await fetch(`/api/products/lookup/${encodeURIComponent(cleanBarcode)}`, {
        cache: "no-store"
      });

      if (response.status === 404) {
        setLookup({ status: "not-found" });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        product: {
          name: string;
          brand?: string;
          category?: string;
          imageUrl?: string;
          quantityText?: string;
          quantityValue?: number;
          quantityUnit?: QuantityUnit;
          storageArea?: StorageArea;
        };
      };

      setName(payload.product.name);
      if (payload.product.quantityValue && payload.product.quantityValue > 0) {
        setQuantity(String(payload.product.quantityValue));
      }
      if (payload.product.quantityUnit) {
        setUnit(payload.product.quantityUnit);
      }
      setStorageArea(payload.product.storageArea ?? "other");
      setLookup({
        status: "found",
        label: payload.product.name,
        brand: payload.product.brand,
        category: payload.product.category,
        imageUrl: payload.product.imageUrl,
        quantityText: payload.product.quantityText,
        quantityValue: payload.product.quantityValue,
        quantityUnit: payload.product.quantityUnit,
        storageArea: payload.product.storageArea ?? "other"
      });
    } catch {
      setLookup({ status: "error", message: "Impossible de joindre Open Food Facts." });
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void (async () => {
      const numericQuantity = Number(quantity.replace(",", "."));

      if (!name.trim() || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        return;
      }

      try {
        const response = await fetch("/api/inventory/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: { name, barcode: barcode.trim() || undefined },
            quantity: numericQuantity,
            unit,
            storageArea,
            expirationDate: expirationDate || null
          })
        });

          if (!response.ok) {
          console.error("Failed to persist batch", await response.text());
          // Fallback to local add
          onAdd?.({ name, quantity: numericQuantity, unit, storageArea, expirationDate, barcode: barcode.trim() || undefined });
        } else {
          await response.json();
          onPersisted?.();
        }
      } catch (err) {
        console.error(err);
        onAdd?.({ name, quantity: numericQuantity, unit, storageArea, expirationDate, barcode: barcode.trim() || undefined });
      }
    })();

    setBarcode("");
    setName("");
    setQuantity("1");
    setUnit("pieces");
    setStorageArea("fresh");
    setExpirationDate("");
    setLookup({ status: "idle" });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 sm:items-center sm:justify-center sm:p-4">
      <form
        onSubmit={submitForm}
        className="w-full rounded-t-2xl bg-white p-5 shadow-soft sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Ajouter un produit</h2>
            <p className="text-sm text-slate-500">Tu peux d'abord tenter un scan de code-barres.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>Code-barres</span>
            <div className="flex gap-2">
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                inputMode="numeric"
                placeholder="Ex : 7376280645028"
              />
              <Button type="button" variant="secondary" className="gap-2 px-3" onClick={lookupProduct}>
                <Search className="h-4 w-4" />
                Chercher
              </Button>
            </div>
          </label>

          {lookup.status === "loading" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              Recherche du produit sur Open Food Facts...
            </div>
          ) : null}

          {lookup.status === "found" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="mb-2 flex items-start gap-3 font-semibold">
                <ProductThumbnail name={lookup.label} imageUrl={lookup.imageUrl} fallbackLabel={lookup.label} className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-white text-xs font-bold text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4" />
                    <span>Produit trouvé</span>
                  </div>
                  <p className="truncate font-semibold text-emerald-900">{lookup.label}</p>
                </div>
              </div>
              {lookup.brand ? <p className="text-emerald-700">Marque: {lookup.brand}</p> : null}
              {lookup.category ? <p className="text-emerald-700">Catégorie: {lookup.category}</p> : null}
              {lookup.quantityText ? <p className="text-emerald-700">Quantité: {lookup.quantityText}</p> : null}
              {lookup.quantityValue && lookup.quantityUnit ? (
                <p className="text-emerald-700">
                  Préremplissage: {lookup.quantityValue} {lookup.quantityUnit === "g" ? "grammes" : lookup.quantityUnit === "ml" ? "millilitres" : "pièces"}
                </p>
              ) : null}
              {lookup.storageArea ? (
                <p className="text-emerald-700">
                  Zone suggérée: {lookup.storageArea === "fresh" ? "Frais" : lookup.storageArea === "frozen" ? "Surgelés" : lookup.storageArea === "dry" ? "Sec" : "Autre"}
                </p>
              ) : null}
            </div>
          ) : null}

          {lookup.status === "not-found" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Produit non reconnu. Tu peux continuer en saisie manuelle.
            </div>
          ) : null}

          {lookup.status === "error" ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {lookup.message}
            </div>
          ) : null}

          <label className="block space-y-2 text-sm font-medium">
            <span>Nom du produit</span>
            <input
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex : Riz basmati"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>Quantite</span>
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>Unite</span>
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
                value={unit}
                onChange={(event) => setUnit(event.target.value as QuantityUnit)}
              >
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>Zone</span>
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
                value={storageArea}
                onChange={(event) => setStorageArea(event.target.value as StorageArea)}
              >
                {storageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>DLC facultative</span>
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
                type="date"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Ajouter au stock</Button>
        </div>
      </form>
    </div>
  );
}
