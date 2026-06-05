import { cn } from "@/lib/cn";

type LoadingSpinnerProps = {
  className?: string;
};

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600",
        className
      )}
      role="status"
      aria-label="Chargement"
    />
  );
}

