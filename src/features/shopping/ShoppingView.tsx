"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, RotateCcw, ShoppingCart, Trash2, X } from "lucide-react";
import { ProductThumbnail } from "@/components/shared/ProductThumbnail";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import type { ShoppingGroup, ShoppingItem, ShoppingSuggestion } from "@/types/domain";

const SHOPPING_LIST_STORAGE_KEY = "ecofoodstock:shopping-list";
const SHOPPING_SUGGESTIONS_STORAGE_KEY = "ecofoodstock:shopping-suggestions-hidden";
const SHOPPING_COMPLETION_STORAGE_KEY = "ecofoodstock:shopping-completion";

type ShoppingCompletionSession = {
  completedAt: string;
  groups: ShoppingGroup[];
};

export function ShoppingView() {
  const [groups, setGroups] = useState<ShoppingGroup[]>([]);
  const [suggestions, setSuggestions] = useState<ShoppingSuggestion[]>([]);
  const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<string[]>([]);
  const [completedSession, setCompletedSession] = useState<ShoppingCompletionSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    let storedHiddenIds: string[] = [];

    try {
      const storedGroups = window.localStorage.getItem(SHOPPING_LIST_STORAGE_KEY);
      if (storedGroups) {
        setGroups(JSON.parse(storedGroups) as ShoppingGroup[]);
      }
    } catch {
      setGroups([]);
    }

    try {
      const storedHidden = window.localStorage.getItem(SHOPPING_SUGGESTIONS_STORAGE_KEY);
      if (storedHidden) {
        storedHiddenIds = JSON.parse(storedHidden) as string[];
        setHiddenSuggestionIds(storedHiddenIds);
      }
    } catch {
      setHiddenSuggestionIds([]);
    }

    try {
      const storedCompletion = window.localStorage.getItem(SHOPPING_COMPLETION_STORAGE_KEY);
      if (storedCompletion) {
        setCompletedSession(JSON.parse(storedCompletion) as ShoppingCompletionSession);
      }
    } catch {
      setCompletedSession(null);
    }

    setHydrated(true);

    const controller = new AbortController();

    async function loadSuggestions() {
      try {
        setLoadingSuggestions(true);

        const response = await fetch("/api/shopping/suggestions", {
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as { suggestions: ShoppingSuggestion[] };
        setSuggestions(payload.suggestions.filter((item) => !storedHiddenIds.includes(item.id)));
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }

    loadSuggestions();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(SHOPPING_LIST_STORAGE_KEY, JSON.stringify(groups));
  }, [groups, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(SHOPPING_SUGGESTIONS_STORAGE_KEY, JSON.stringify(hiddenSuggestionIds));
  }, [hiddenSuggestionIds, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (completedSession) {
      window.localStorage.setItem(SHOPPING_COMPLETION_STORAGE_KEY, JSON.stringify(completedSession));
      return;
    }

    window.localStorage.removeItem(SHOPPING_COMPLETION_STORAGE_KEY);
  }, [completedSession, hydrated]);

  const totalItems = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);
  const completedItems = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.filter((item) => item.checked).length, 0),
    [groups]
  );

  function addSuggestionToList(suggestion: ShoppingSuggestion) {
    const newItem: ShoppingItem = {
      id: `${suggestion.id}-${Date.now()}`,
      label: suggestion.label,
      quantity: "1 unité",
      icon: suggestion.icon,
      imageUrl: suggestion.imageUrl,
      checked: false
    };

    setGroups((current) => {
      const next = current.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item }))
      }));
      const targetGroup = next.find((group) => group.category === "Ajouts récents");

      if (targetGroup) {
        targetGroup.items.unshift(newItem);
        return next;
      }

      return [{ category: "Ajouts récents", items: [newItem] }, ...next];
    });

    setSuggestions((current) => current.filter((candidate) => candidate.id !== suggestion.id));
    setHiddenSuggestionIds((current) => (current.includes(suggestion.id) ? current : [...current, suggestion.id]));
  }

  function clearShoppingList() {
    setGroups([]);
  }

  function resetShoppingList() {
    setGroups([]);
    window.localStorage.removeItem(SHOPPING_LIST_STORAGE_KEY);
    setCompletedSession(null);
  }

  function clearSuggestions() {
    setHiddenSuggestionIds((current) => {
      const merged = new Set([...current, ...suggestions.map((item) => item.id)]);
      return Array.from(merged);
    });
    setSuggestions([]);
  }

  function resetSuggestions() {
    setLoadingSuggestions(true);
    window.localStorage.removeItem(SHOPPING_SUGGESTIONS_STORAGE_KEY);
    setHiddenSuggestionIds([]);
    void fetch("/api/shopping/suggestions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { suggestions: ShoppingSuggestion[] }) => setSuggestions(payload.suggestions))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }

  function removeItem(itemId: string) {
    setGroups((current) =>
      current
        .map((group) => ({ ...group, items: group.items.filter((item) => item.id !== itemId) }))
        .filter((group) => group.items.length > 0)
    );
  }

  function hideSuggestion(itemId: string) {
    setSuggestions((current) => current.filter((candidate) => candidate.id !== itemId));
    setHiddenSuggestionIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
  }

  function restoreInitialState() {
    setGroups([]);
    setCompletedSession(null);
    window.localStorage.removeItem(SHOPPING_LIST_STORAGE_KEY);
    window.localStorage.removeItem(SHOPPING_COMPLETION_STORAGE_KEY);
  }

  function completeShopping() {
    const checkedGroups = groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.checked)
      }))
      .filter((group) => group.items.length > 0);

    if (checkedGroups.length === 0) {
      return;
    }

    setCompletedSession({
      completedAt: new Date().toISOString(),
      groups: checkedGroups
    });
  }

  function toggleChecked(itemId: string) {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item))
      }))
    );
  }

  return (
    <div>
      <PageHeader icon={ShoppingCart} title="Courses" description="Liste interactive alimentée par Open Food Facts." />

      {completedSession ? (
        <Card className="mb-5 border-brand-200 bg-brand-50/80">
          <div className="flex flex-col gap-4 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-brand-600/10 p-2 text-brand-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">Courses terminées</p>
                <p className="text-sm text-slate-600">
                  Il ne reste plus qu'à scanner les articles achetés pour les ajouter au stock.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Rappel enregistré le {new Date(completedSession.completedAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-brand-100 bg-white/80 p-4">
              {completedSession.groups.map((group) => (
                <section key={group.category}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group.category}</h3>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                        <ProductThumbnail
                          name={item.label}
                          fallbackLabel={item.icon}
                          imageUrl={item.imageUrl}
                          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Ma liste</h2>
              <p className="text-sm text-slate-500">
                {totalItems} article{totalItems > 1 ? "s" : ""} · {completedItems} cochés
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-9 gap-2 px-3" onClick={restoreInitialState}>
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </Button>
              <Button variant="ghost" className="h-9 gap-2 px-3 text-rose-600" onClick={clearShoppingList} disabled={totalItems === 0}>
                <Trash2 className="h-4 w-4" />
                Vider
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.category}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {group.category}
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-3 py-4 last:border-b-0"
                    >
                      <input
                        className="h-5 w-5 rounded border-slate-300"
                        type="checkbox"
                        checked={item.checked ?? false}
                        onChange={() => toggleChecked(item.id)}
                      />
                      <ProductThumbnail
                        name={item.label}
                        fallbackLabel={item.icon}
                        imageUrl={item.imageUrl}
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={item.checked ? "truncate text-slate-400 line-through" : "truncate"}>{item.label}</p>
                        <p className="text-sm text-slate-500">{item.quantity}</p>
                      </div>
                      <Button variant="ghost" className="h-8 w-8 px-0 text-slate-400 hover:text-rose-600" aria-label={`Supprimer ${item.label}`} onClick={() => removeItem(item.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                La liste est vide. Ajoute un produit depuis les suggestions.
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-24 mt-6 flex items-center justify-between rounded-xl border border-brand-600 bg-white p-4 shadow-soft lg:bottom-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-brand-600" />
              <div>
                <p className="font-semibold">{totalItems} article{totalItems > 1 ? "s" : ""} dans le panier</p>
                <p className="text-sm text-slate-500">Pret a finaliser vos courses ?</p>
              </div>
            </div>
            <Button onClick={completeShopping} disabled={completedItems === 0}>
              Terminer
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold">Suggestions Open Food Facts</h2>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-9 gap-2 px-3" onClick={resetSuggestions}>
                <RotateCcw className="h-4 w-4" />
                Rafraîchir
              </Button>
              <Button variant="ghost" className="h-9 gap-2 px-3 text-rose-600" onClick={clearSuggestions} disabled={suggestions.length === 0}>
                <Trash2 className="h-4 w-4" />
                Vider
              </Button>
            </div>
          </div>

          {loadingSuggestions ? <p className="text-sm text-slate-500">Chargement des suggestions Open Food Facts...</p> : null}

          <div className="space-y-3">
            {suggestions.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <ProductThumbnail
                  name={item.label}
                  fallbackLabel={item.icon}
                  imageUrl={item.imageUrl}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.reason}</p>
                </div>
                <Button className="h-9 w-9 px-0" aria-label={`Ajouter ${item.label}`} onClick={() => addSuggestionToList(item)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" className="h-9 w-9 px-0" aria-label={`Masquer ${item.label}`} onClick={() => hideSuggestion(item.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {!loadingSuggestions && suggestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Plus de suggestions visibles. Rafraîchis la liste pour en récupérer depuis Open Food Facts.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}


