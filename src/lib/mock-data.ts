import type { ActivityGroup, InventoryItem, ShoppingGroup, ShoppingSuggestion } from "@/types/domain";

export const mockInventory: InventoryItem[] = [
  {
    id: "milk",
    name: "Lait Lactel",
    icon: "LA",
    quantity: 1000,
    unit: "ml",
    storageArea: "fresh",
    expirationDate: "2026-05-29",
    expirationLabel: "Expire aujourd'hui",
    dlcStatus: { label: "DLC aujourd'hui", tone: "red" }
  },
  {
    id: "meat",
    name: "Viande Active3",
    icon: "VI",
    quantity: 500,
    unit: "g",
    storageArea: "fresh",
    expirationDate: "2026-05-29",
    expirationLabel: "Expire aujourd'hui",
    dlcStatus: { label: "DLC aujourd'hui", tone: "red" }
  },
  {
    id: "quik",
    name: "Quik Jr.2",
    icon: "QK",
    quantity: 320,
    unit: "g",
    storageArea: "fresh",
    expirationDate: "2026-05-30",
    expirationLabel: "Expire demain",
    dlcStatus: { label: "DLC demain", tone: "orange" }
  },
  {
    id: "pasta",
    name: "Pates Barilla",
    icon: "PA",
    quantity: 1000,
    unit: "g",
    storageArea: "dry"
  },
  {
    id: "tomatoes",
    name: "Tomates",
    icon: "TO",
    quantity: 6,
    unit: "pieces",
    storageArea: "fresh",
    expirationDate: "2026-06-02",
    expirationLabel: "Expire le 02/06/2026"
  },
  {
    id: "chicken",
    name: "Poulet",
    icon: "PO",
    quantity: 800,
    unit: "g",
    storageArea: "fresh"
  },
  {
    id: "rice",
    name: "Riz Basmati",
    icon: "RI",
    quantity: 2000,
    unit: "g",
    storageArea: "dry"
  },
  {
    id: "yogurt",
    name: "Yaourt nature",
    icon: "YA",
    quantity: 8,
    unit: "pots",
    storageArea: "fresh",
    expirationDate: "2026-06-05",
    expirationLabel: "Expire le 05/06/2026"
  }
];

export const shoppingItems: ShoppingGroup[] = [
  {
    category: "Produits laitiers",
    items: [
      { id: "milk", label: "Lait Lactel", quantity: "2 L", icon: "LA" },
      { id: "cream", label: "Creme fraiche", quantity: "1 pot", icon: "CR" }
    ]
  },
  {
    category: "Viandes",
    items: [{ id: "chicken", label: "Poulet fermier", quantity: "1 piece", icon: "PO" }]
  },
  {
    category: "Feculents",
    items: [{ id: "pasta", label: "Pates Barilla", quantity: "2 paquets", icon: "PA" }]
  },
  {
    category: "Articles dans le panier",
    items: [{ id: "tomatoes", label: "Tomates", quantity: "1 kg", icon: "TO", checked: true }]
  }
];

export const shoppingSuggestions: ShoppingSuggestion[] = [
  { id: "bananas", label: "Bananes", reason: "Bon pour les collations", icon: "BA" },
  { id: "yogurt", label: "Yaourt nature", reason: "Achat recurrent", icon: "YA" },
  { id: "quinoa", label: "Quinoa", reason: "Suggestion nutritionnelle", icon: "QU" }
];

export const historyGroups: ActivityGroup[] = [
  {
    label: "Aujourd'hui",
    events: [
      {
        id: "1",
        type: "product_consumed",
        title: "Lait Lactel termine",
        description: "Utilise normalement",
        color: "bg-slate-400",
        canUndo: true,
        createdAt: "2026-05-29T13:37:00.000Z"
      }
    ]
  },
  {
    label: "Hier",
    events: [
      {
        id: "2",
        type: "product_wasted",
        title: "Yaourt Activia x4 jete",
        description: "Raison : perime",
        color: "bg-rose-500",
        canUndo: true,
        createdAt: "2026-05-28T15:43:00.000Z"
      },
      {
        id: "3",
        type: "product_added",
        title: "+1 Lait Lactel ajoute au stock",
        description: "Ajout manuel",
        color: "bg-emerald-500",
        canUndo: true,
        createdAt: "2026-05-28T15:13:00.000Z"
      }
    ]
  }
];
