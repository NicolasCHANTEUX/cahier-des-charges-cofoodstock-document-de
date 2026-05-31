"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { groupActivityEvents } from "@/lib/activity-events";
import type { ActivityEvent } from "@/types/domain";

const filters = ["Tout", "Entrees", "Consommes", "Jetes"];

export function HistoryView() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("Tout");

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/history", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { events: ActivityEvent[] };
      setEvents(payload.events);
    } catch {
      setError("Impossible de charger l'historique depuis Supabase.");
    } finally {
      setLoading(false);
    }
  }

  const visibleGroups = useMemo(() => {
    return groupActivityEvents(events)
      .map((group) => ({
        ...group,
        events: group.events.filter((event) => matchesActivityFilter(event, activeFilter))
      }))
      .filter((group) => group.events.length > 0);
  }, [activeFilter, events]);

  return (
    <div>
      <PageHeader icon={History} title="Historique d'activite" />

      {error ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((filter, index) => (
          <button key={filter} type="button" onClick={() => setActiveFilter(filter)}>
            <Badge tone={activeFilter === filter ? "blue" : "slate"}>
              {filter}
            </Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Chargement de l'historique depuis Supabase...
        </Card>
      ) : visibleGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold">Aucune activite pour ce filtre</p>
          <p className="mt-1 text-sm text-slate-500">
            Les actions sur l'inventaire apparaitront ici.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {group.label}
              </h2>
              <Card className="space-y-3 p-3">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 rounded-lg p-2">
                    <span className={`h-3 w-3 rounded-full ${event.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-slate-500">
                        {event.description} - {formatActivityTime(event.createdAt)}
                      </p>
                    </div>
                    {event.canUndo ? <span className="text-xs text-slate-400">Annulable bientôt</span> : null}
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function matchesActivityFilter(event: ActivityEvent, filter: string) {
  if (filter === "Tout") {
    return true;
  }

  if (filter === "Entrees") {
    return event.type === "product_added";
  }

  if (filter === "Consommes") {
    return event.type === "product_consumed" || event.type === "product_adjusted";
  }

  if (filter === "Jetes") {
    return event.type === "product_wasted";
  }

  return true;
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
