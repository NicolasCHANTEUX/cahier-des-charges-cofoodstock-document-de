import type { ActivityEvent } from "@/types/domain";

export function canUndoActivity(event: ActivityEvent) {
  return event.canUndo;
}

