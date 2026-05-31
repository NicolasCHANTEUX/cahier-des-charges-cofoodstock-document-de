import { CheckCircle2, Plus, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/shared/PageHeader";
import { shoppingItems, shoppingSuggestions } from "@/lib/mock-data";

export function ShoppingView() {
  return (
    <div>
      <PageHeader icon={ShoppingCart} title="Courses" description="Liste simple pour le MVP 1." />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold">Ma liste</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">2 articles dans le panier</span>
          </div>

          <div className="space-y-6">
            {shoppingItems.map((group) => (
              <section key={group.category}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {group.category}
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  {group.items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-3 py-4 last:border-b-0"
                    >
                      <input className="h-5 w-5 rounded border-slate-300" type="checkbox" defaultChecked={item.checked} />
                      <span className="text-lg">{item.icon}</span>
                      <span className={item.checked ? "text-slate-400 line-through" : ""}>
                        {item.label} <span className="text-sm text-slate-500">{item.quantity}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="sticky bottom-24 mt-6 flex items-center justify-between rounded-xl border border-brand-600 bg-white p-4 shadow-soft lg:bottom-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-brand-600" />
              <div>
                <p className="font-semibold">2 articles dans le panier</p>
                <p className="text-sm text-slate-500">Pret a finaliser vos courses ?</p>
              </div>
            </div>
            <Button>Terminer</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">Suggestions simples</h2>
          <div className="space-y-3">
            {shoppingSuggestions.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <span className="text-lg">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.reason}</p>
                </div>
                <Button className="h-9 w-9 px-0" aria-label="Ajouter">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" className="h-9 w-9 px-0" aria-label="Masquer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

