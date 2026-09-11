import type { Metadata } from "next";
import "./globals.css";

const TITRE = "SafeOttawa — Navigation sécurisée";
const DESCRIPTION =
  "Itinéraires les plus sûrs pour piétons et cyclistes, calculés sur 94 406 collisions publiées par la Ville d'Ottawa.";

export const metadata: Metadata = {
  metadataBase: new URL("https://safeottawa.soultaka.com"),
  title: TITRE,
  description: DESCRIPTION,
  icons: { icon: '/icon.svg' },
  openGraph: {
    type: "website",
    url: "https://safeottawa.soultaka.com",
    siteName: "SafeOttawa",
    locale: "fr_CA",
    title: TITRE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SafeOttawa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITRE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
