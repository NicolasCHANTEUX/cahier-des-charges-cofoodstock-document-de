import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/shared/AuthGate";

export default function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
