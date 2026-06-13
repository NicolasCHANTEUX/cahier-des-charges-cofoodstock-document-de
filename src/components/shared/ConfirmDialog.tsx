"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  cancelLabel = "Annuler",
  children,
  confirmDisabled = false,
  confirmLabel = "Confirmer",
  danger = false,
  description,
  onCancel,
  onConfirm,
  open,
  title
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/35 p-4"
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`rounded-xl p-2 ${danger ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-700"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-950">{title}</h2>
              {description ? (
                <p id="confirm-dialog-description" className="mt-1 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
            onClick={onCancel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
