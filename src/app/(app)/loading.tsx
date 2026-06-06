export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center rounded-xl" role="status" aria-label="Chargement">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
    </div>
  );
}
