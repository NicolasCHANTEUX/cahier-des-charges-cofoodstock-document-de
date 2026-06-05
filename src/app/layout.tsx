import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IosInstallHelper } from "@/components/shared/IosInstallHelper";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";

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
    <html lang="fr">
      <body>
        {children}
        <PwaInstallPrompt />
        <IosInstallHelper />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

