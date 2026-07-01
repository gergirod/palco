import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palco — inteligencia de reputación en streaming",
  description:
    "Monitoreo de narrativa y reputación sobre el streaming en vivo argentino. Enterás cuándo, dónde y cómo se habla de vos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
