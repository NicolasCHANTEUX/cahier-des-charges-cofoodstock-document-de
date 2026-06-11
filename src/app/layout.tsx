import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IosInstallHelper } from "@/components/shared/IosInstallHelper";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "EcoFoodStock",
  description: "Assistant domestique pour stock alimentaire et DLC",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "EcoFoodStock"
  },
  icons: {
    icon: "/icon-192.svg",
    apple: "/apple-touch-icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      data-theme="light"
      data-theme-preference="system"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
                  var preference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
                  var isDark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
                  var theme = isDark ? "dark" : "light";
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.dataset.themePreference = preference;
                  document.documentElement.style.colorScheme = theme;
                } catch {
                  document.documentElement.dataset.theme = "light";
                  document.documentElement.dataset.themePreference = "system";
                  document.documentElement.style.colorScheme = "light";
                }
              })();
            `
          }}
        />
        {children}
        <PwaInstallPrompt />
        <IosInstallHelper />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

