"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type QuantityPromptModalProps = {
  open: boolean;
  title: string;
  description?: string;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function QuantityPromptModal({
  open,
  title,
  description,
  value,
  onValueChange,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler"
}: QuantityPromptModalProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsVisible(true));
      window.setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => setShouldRender(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm transition-opacity duration-200",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      onMouseDown={onCancel}
      aria-hidden={!open}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantity-prompt-title"
        aria-describedby={description ? "quantity-prompt-description" : undefined}
        className={cn(
          "w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 transition-all duration-200 sm:p-6",
          isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <div className="space-y-2">
            <h2 id="quantity-prompt-title" className="text-xl font-bold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id="quantity-prompt-description" className="text-sm text-slate-500">
                {description}
              </p>
            ) : null}
          </div>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Quantité numérique</span>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-brand-500 focus:bg-white"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" type="button" onClick={onCancel} className="w-full">
              {cancelLabel}
            </Button>
            <Button type="submit" className="w-full">
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
