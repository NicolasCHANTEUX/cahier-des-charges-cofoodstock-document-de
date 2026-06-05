import { Suspense } from "react";
import { AuthCard } from "@/features/auth/AuthCard";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <AuthCard />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-soft">
        <p className="text-sm text-slate-600">Chargement...</p>
      </div>
    </main>
  );
}
