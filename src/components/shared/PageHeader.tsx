import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

export function PageHeader({ icon: Icon, title, description }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <Icon className="mt-1 h-6 w-6 text-brand-600" />
      <div>
        <h1 className="text-2xl font-bold tracking-normal">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
    </div>
  );
}

