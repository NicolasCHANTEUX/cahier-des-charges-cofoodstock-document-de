"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ActivityEvent,
  ActivityGroup,
  ActivityType,
  InventoryItem,
  QuantityUnit,
  StorageArea,
  UndoPayload
} from "@/types/domain";
import { mockInventory } from "@/lib/mock-data";
import { formatQuantity } from "@/lib/units";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildAccountStorageKey } from "@/lib/account-storage";

const STORAGE_KEY = "ecofoodstock:mvp-state";

type MvpState = {
  inventory: InventoryItem[];
  activityEvents: ActivityEvent[];
};

export type AddInventoryInput = {
  name: string;
  quantity: number;
  unit: QuantityUnit;
  storageArea: StorageArea;
  expirationDate?: string;
  barcode?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
};

const initialState: MvpState = {
  inventory: mockInventory,
  activityEvents: [
    createEvent({
      type: "product_consumed",
      title: "Lait Lactel termine",
      description: "Utilise normalement",
      color: "bg-slate-400",
      canUndo: false
    }),
    createEvent({
      type: "product_added",
      title: "+1 Lait Lactel ajoute au stock",
      description: "Ajout manuel",
      color: "bg-emerald-500",
      canUndo: false
    })
  ]
};

export function useMvpStore() {
  const [state, setState] = useState<MvpState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data } = await supabase.auth.getUser();
      setStorageKey(buildAccountStorageKey(STORAGE_KEY, data.user?.id ?? null));
    })();
  }, []);

  useEffect(() => {
    if (!storageKey) return;

    const stored = window.localStorage.getItem(storageKey);

    if (stored) {
      try {
        setState(JSON.parse(stored) as MvpState);
      } catch {
        setState(initialState);
      }
    }

    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded && storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [loaded, state, storageKey]);

  const groupedActivity = useMemo(
    () => groupActivityEvents(state.activityEvents),
    [state.activityEvents]
  );

  function addInventoryItem(input: AddInventoryInput) {
    const item = enrichInventoryItem({
      id: createId("item"),
      icon: createIconLabel(input.name),
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      storageArea: input.storageArea,
      expirationDate: input.expirationDate || undefined
    });

    setState((current) => ({
      inventory: [item, ...current.inventory],
      activityEvents: [
        createEvent({
          type: "product_added",
          title: `${item.name} ajoute au stock`,
          description: `${formatQuantity(item.quantity, item.unit)} - ajout manuel`,
          color: "bg-emerald-500",
          canUndo: true,
          undoPayload: { kind: "remove_added_item", itemId: item.id }
        }),
        ...current.activityEvents
      ]
    }));
  }

  function decreaseInventoryItem(itemId: string, amount: number) {
    setState((current) => {
      const item = current.inventory.find((candidate) => candidate.id === itemId);

      if (!item || amount <= 0) {
        return current;
      }

      const nextQuantity = Math.max(0, item.quantity - amount);
      const nextInventory =
        nextQuantity === 0
          ? current.inventory.filter((candidate) => candidate.id !== itemId)
          : current.inventory.map((candidate) =>
              candidate.id === itemId ? { ...candidate, quantity: nextQuantity } : candidate
            );

      return {
        inventory: nextInventory,
        activityEvents: [
          createEvent({
            type: "product_consumed",
            title: `${item.name} consomme`,
            description: `${formatQuantity(amount, item.unit)} retire du stock`,
            color: "bg-slate-400",
            canUndo: true,
            undoPayload:
              nextQuantity === 0
                ? { kind: "restore_item", item }
                : {
                    kind: "restore_quantity",
                    itemId: item.id,
                    previousQuantity: item.quantity
                  }
          }),
          ...current.activityEvents
        ]
      };
    });
  }

  function removeInventoryItem(itemId: string, reason: "consumed" | "wasted") {
    setState((current) => {
      const item = current.inventory.find((candidate) => candidate.id === itemId);

      if (!item) {
        return current;
      }

      const isWaste = reason === "wasted";

      return {
        inventory: current.inventory.filter((candidate) => candidate.id !== itemId),
        activityEvents: [
          createEvent({
            type: isWaste ? "product_wasted" : "product_consumed",
            title: `${item.name} ${isWaste ? "jete" : "consomme"}`,
            description: `${formatQuantity(item.quantity, item.unit)} sorti du stock`,
            color: isWaste ? "bg-rose-500" : "bg-slate-400",
            canUndo: true,
            undoPayload: { kind: "restore_item", item }
          }),
          ...current.activityEvents
        ]
      };
    });
  }

  function undoActivity(eventId: string) {
    setState((current) => {
      const event = current.activityEvents.find((candidate) => candidate.id === eventId);

      if (!event?.canUndo || !event.undoPayload) {
        return current;
      }

      const inventory = applyUndoPayload(current.inventory, event.undoPayload);

      return {
        inventory,
        activityEvents: [
          createEvent({
            type: "undo",
            title: `Action annulee : ${event.title}`,
            description: "Restauration effectuee depuis l'historique",
            color: "bg-blue-500",
            canUndo: false
          }),
          ...current.activityEvents.map((candidate) =>
            candidate.id === eventId ? { ...candidate, canUndo: false } : candidate
          )
        ]
      };
    });
  }

  function resetDemoState() {
    setState(initialState);
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
  }

  return {
    inventory: state.inventory,
    activityEvents: state.activityEvents,
    groupedActivity,
    addInventoryItem,
    decreaseInventoryItem,
    removeInventoryItem,
    undoActivity,
    resetDemoState
  };
}

function applyUndoPayload(inventory: InventoryItem[], payload: UndoPayload) {
  if (payload.kind === "remove_added_item") {
    return inventory.filter((item) => item.id !== payload.itemId);
  }

  if (payload.kind === "restore_item") {
    const alreadyExists = inventory.some((item) => item.id === payload.item.id);
    return alreadyExists ? inventory : [payload.item, ...inventory];
  }

  return inventory.map((item) =>
    item.id === payload.itemId ? { ...item, quantity: payload.previousQuantity } : item
  );
}

function enrichInventoryItem(item: InventoryItem): InventoryItem {
  const expiration = getExpirationInfo(item.expirationDate);

  return {
    ...item,
    expirationLabel: expiration.label,
    dlcStatus: expiration.status
  };
}

function getExpirationInfo(expirationDate?: string) {
  if (!expirationDate) {
    return {};
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${expirationDate}T00:00:00`);
  const diffDays = Math.round((expiration.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return {
      label: "Expire aujourd'hui",
      status: { label: "DLC aujourd'hui", tone: "red" as const }
    };
  }

  if (diffDays === 1) {
    return {
      label: "Expire demain",
      status: { label: "DLC demain", tone: "orange" as const }
    };
  }

  if (diffDays <= 3) {
    return {
      label: `Expire dans ${diffDays} jours`,
      status: { label: "DLC proche", tone: "orange" as const }
    };
  }

  return {
    label: `Expire le ${formatDate(expirationDate)}`
  };
}

function groupActivityEvents(events: ActivityEvent[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [
    { label: "Aujourd'hui", events: [] },
    { label: "Hier", events: [] },
    { label: "Plus ancien", events: [] }
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  events.forEach((event) => {
    const eventDate = new Date(event.createdAt);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === today.getTime()) {
      groups[0].events.push(event);
    } else if (eventDate.getTime() === yesterday.getTime()) {
      groups[1].events.push(event);
    } else {
      groups[2].events.push(event);
    }
  });

  return groups.filter((group) => group.events.length > 0);
}

function createEvent(input: {
  type: ActivityType;
  title: string;
  description: string;
  color: string;
  canUndo: boolean;
  undoPayload?: UndoPayload;
}): ActivityEvent {
  return {
    id: createId("event"),
    createdAt: new Date().toISOString(),
    ...input
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createIconLabel(name: string) {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return compact || "PR";
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
