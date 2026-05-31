export type AppMode = "general_public" | "athlete";

export type StorageArea = "fresh" | "frozen" | "dry" | "other";

export type QuantityUnit =
  | "g"
  | "ml"
  | "pieces"
  | "portions"
  | "pots"
  | "paquets"
  | "bouteilles";

export type BadgeTone = "green" | "orange" | "red" | "blue" | "slate";

export type InventoryItem = {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  unit: QuantityUnit;
  storageArea: StorageArea;
  expirationDate?: string;
  expirationLabel?: string;
  dlcStatus?: {
    label: string;
    tone: BadgeTone;
  };
};

export type ShoppingGroup = {
  category: string;
  items: ShoppingItem[];
};

export type ShoppingItem = {
  id: string;
  label: string;
  quantity: string;
  icon: string;
  checked?: boolean;
};

export type ShoppingSuggestion = {
  id: string;
  label: string;
  reason: string;
  icon: string;
};

export type ActivityGroup = {
  label: string;
  events: ActivityEvent[];
};

export type ActivityType =
  | "product_added"
  | "product_consumed"
  | "product_wasted"
  | "product_adjusted"
  | "undo";

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  color: string;
  canUndo: boolean;
  createdAt: string;
  undoPayload?: UndoPayload;
};

export type UndoPayload =
  | {
      kind: "remove_added_item";
      itemId: string;
    }
  | {
      kind: "restore_item";
      item: InventoryItem;
    }
  | {
      kind: "restore_quantity";
      itemId: string;
      previousQuantity: number;
    };
