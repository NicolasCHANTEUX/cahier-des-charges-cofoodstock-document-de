import type { ActivityEvent, ActivityType, BadgeTone } from "@/types/domain";

export type ActivityEventInsert = {
  household_id: string;
  user_id?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
  product_id?: string | null;
  recipe_id?: string | null;
  can_undo?: boolean;
  metadata?: Record<string, unknown>;
};

type ActivityEventRow = {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  can_undo: boolean;
  created_at: string;
};

export function buildActivityEventInsert(input: ActivityEventInsert): ActivityEventInsert {
  return {
    can_undo: false,
    metadata: {},
    description: null,
    product_id: null,
    recipe_id: null,
    user_id: null,
    ...input
  };
}

export function mapActivityEventRow(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description ?? "",
    color: colorForActivityType(row.type),
    canUndo: row.can_undo,
    createdAt: row.created_at
  };
}

export function colorForActivityType(type: ActivityType) {
  if (type === "product_added") {
    return "bg-emerald-500";
  }

  if (type === "product_wasted") {
    return "bg-rose-500";
  }

  if (type === "undo") {
    return "bg-blue-500";
  }

  return "bg-slate-400";
}

export function canUndoActivityType(type: ActivityType) {
  return type === "product_added" || type === "product_consumed" || type === "product_wasted" || type === "product_adjusted";
}

export function groupActivityEvents(events: ActivityEvent[]) {
  const groups = [
    { label: "Aujourd'hui", events: [] as ActivityEvent[] },
    { label: "Hier", events: [] as ActivityEvent[] },
    { label: "Plus ancien", events: [] as ActivityEvent[] }
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
