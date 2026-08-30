import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeOttawa — Navigation sécurisée",
  description: "Navigateur de route sécurisée pour piétons et cyclistes à Ottawa",
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
