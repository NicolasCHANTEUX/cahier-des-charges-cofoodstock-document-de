import { Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";

type ComingSoonProps = {
  title: string;
  description: string;
};

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Clock3 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
      </Card>
    </div>
  );
}

