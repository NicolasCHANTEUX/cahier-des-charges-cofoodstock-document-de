"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { t } from "@/lib/i18n";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        // redirect to login preserving token
        router.push(`/login?token=${encodeURIComponent(token)}`);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/household/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ token })
        });

        const body = await res.json();
        if (!res.ok) {
          setStatus(body?.error ?? t("household.invalidToken"));
          return;
        }

        setStatus(t("household.joinSuccess"));
        // small delay then redirect to dashboard
        setTimeout(() => router.push("/dashboard"), 1200);
      } catch (err) {
        setStatus((err as Error).message ?? t("household.invalidToken"));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold mb-4">Rattachement au foyer</h1>
        <p className="text-sm text-slate-600 mb-6">{token ? `Token: ${token}` : "Aucun token fourni."}</p>
        {status ? <div className="mb-4 text-sm">{status}</div> : null}
        <div className="flex justify-center">
          <Button onClick={() => router.push("/")}>Retour</Button>
        </div>
      </Card>
    </main>
  );
}
