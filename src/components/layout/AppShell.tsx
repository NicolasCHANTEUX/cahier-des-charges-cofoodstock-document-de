import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NavigationLoadingOverlay } from "@/components/shared/NavigationLoadingOverlay";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfcfb] text-ink">
      <Sidebar />
      <NavigationLoadingOverlay />
      <div className="min-h-screen lg:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
