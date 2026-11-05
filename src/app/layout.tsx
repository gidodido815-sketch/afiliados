import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Padrón Electoral — Santiago del Estero",
  description: "Consulta del padrón electoral y de afiliación al Partido Justicialista.",
  robots: { index: false, follow: false },
};
// Dinámico: el CSP con nonce se genera por solicitud en el middleware
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
