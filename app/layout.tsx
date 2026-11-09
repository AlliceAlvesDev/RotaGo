import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotaGo",
  description: "Controle pessoal de ganhos, despesas e lucro nas suas rotas.",
  applicationName: "RotaGo",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo-symbol.png",
    shortcut: "/logo-symbol.png",
    apple: "/logo-symbol.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#090b10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
