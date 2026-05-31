import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoFoodStock",
  description: "Assistant domestique pour stock alimentaire et DLC"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

