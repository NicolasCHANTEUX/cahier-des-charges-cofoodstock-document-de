"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Barcode, Camera, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductThumbnail } from "@/components/shared/ProductThumbnail";
import { getBrowserAuthHeaders } from "@/lib/supabase/browser-auth";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (!open) {
    return null;
  }

  async function lookupProduct(barcodeValue?: string) {
    const cleanBarcode = (barcodeValue ?? barcode).trim();

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

      setBarcode(cleanBarcode);
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

  async function startCameraScan() {
    setScanError(null);
    setValidationMessage(null);

    if (typeof window === "undefined") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("La caméra n'est pas accessible sur cet appareil.");
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect: (target: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    stopCamera();
    setIsScanning(true);
    let videoElement: HTMLVideoElement | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (videoRef.current) {
        videoElement = videoRef.current;
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    if (!videoElement) {
      setScanError("Impossible d'initialiser l'aperçu caméra.");
      stopCamera();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      if (BarcodeDetectorCtor) {
        const detector = new BarcodeDetectorCtor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const tick = async () => {
          if (!videoRef.current || !streamRef.current) {
            return;
          }

          try {
            const barcodes = await detector.detect(videoRef.current);
            const detectedCode = barcodes.find((entry) => Boolean(entry.rawValue))?.rawValue?.trim();

            if (detectedCode) {
              stopCamera();
              setBarcode(detectedCode);
              await lookupProduct(detectedCode);
              return;
            }
          } catch {
            // keep scanning
          }

          frameRef.current = window.requestAnimationFrame(() => {
            void tick();
          });
        };

        frameRef.current = window.requestAnimationFrame(() => {
          void tick();
        });
        return;
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      zxingControlsRef.current = await reader.decodeFromVideoElement(videoElement, (result) => {
        const detectedCode = result?.getText()?.trim();
        if (!detectedCode) {
          return;
        }
        stopCamera();
        setBarcode(detectedCode);
        void lookupProduct(detectedCode);
      });
    } catch {
      stopCamera();
      setScanError("Impossible d'accéder à la caméra. Vérifie les permissions puis réessaie.");
    }
  }

  function stopCamera() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }

  function resetForm() {
    setBarcode("");
    setName("");
    setQuantity("1");
    setUnit("pieces");
    setStorageArea("fresh");
    setExpirationDate("");
    setLookup({ status: "idle" });
    setSubmitError(null);
    setValidationMessage(null);
    setScanError(null);
  }

  function closeDialog() {
    if (isSubmitting) {
      return;
    }

    stopCamera();
    onClose();
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setValidationMessage(null);

    const trimmedName = name.trim();
    const numericQuantity = Number(quantity.replace(",", "."));

    if (!trimmedName) {
      setValidationMessage("Le nom du produit est obligatoire.");
      return;
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setValidationMessage("La quantité doit être supérieure à 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getBrowserAuthHeaders()) },
        body: JSON.stringify({
          product: {
            name: trimmedName,
            barcode: barcode.trim() || undefined,
            brand: lookup.status === "found" ? lookup.brand : undefined,
            category: lookup.status === "found" ? lookup.category : undefined,
            imageUrl: lookup.status === "found" ? lookup.imageUrl : undefined,
            source: barcode.trim() ? "open_food_facts" : "manual",
            default_storage_area: storageArea,
            default_unit: unit
          },
          quantity: numericQuantity,
          unit,
          storageArea,
          expirationDate: expirationDate || null
        })
      });

      if (!response.ok) {
        const errorMessage = await response.text();

        if (process.env.NODE_ENV !== "production") {
          onAdd?.({
            name: trimmedName,
            quantity: numericQuantity,
            unit,
            storageArea,
            expirationDate,
            barcode: barcode.trim() || undefined
          });
          onClose();
          resetForm();
          return;
        }

        throw new Error(errorMessage || "save_failed");
      }

      await response.json();
      onPersisted?.();
      resetForm();
      onClose();
    } catch {
      setSubmitError("Impossible d'ajouter le produit. Vérifie la connexion puis réessaie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 sm:items-center sm:justify-center sm:p-4">
      <form
        onSubmit={(event) => void submitForm(event)}
        className="w-full rounded-t-2xl bg-white p-5 shadow-soft sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Ajouter un produit</h2>
            <p className="text-sm text-slate-500">Tu peux scanner un code-barres ou le saisir manuellement.</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>Code-barres</span>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none focus:border-brand-500 sm:flex-1"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                inputMode="numeric"
                placeholder="Ex : 7376280645028"
              />
              <Button type="button" variant="secondary" className="gap-2 px-3" onClick={() => void lookupProduct()} disabled={isSubmitting}>
                <Search className="h-4 w-4" />
                Chercher
              </Button>
              <Button type="button" variant="secondary" className="gap-2 px-3" onClick={() => void startCameraScan()} disabled={isSubmitting || isScanning}>
                <Camera className="h-4 w-4" />
                Scanner caméra
              </Button>
            </div>
          </label>

          {isScanning ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <video ref={videoRef} className="h-52 w-full rounded-lg bg-black object-cover" muted playsInline />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-600">Recherche du code-barres en cours...</p>
                <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={stopCamera}>
                  Arrêter
                </Button>
              </div>
            </div>
          ) : null}

          {scanError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {scanError}
            </div>
          ) : null}

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
              Aucun code détecté dans le catalogue. Continue en saisie manuelle.
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

        {validationMessage ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{validationMessage}</p>
        ) : null}

        {submitError ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
        ) : null}

        {isSubmitting ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Ajout en cours...</p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={closeDialog} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ajout..." : "Ajouter au stock"}
          </Button>
        </div>
      </form>
    </div>
  );
}
