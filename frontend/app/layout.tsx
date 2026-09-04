import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Performance Coach",
  description:
    "Plataforma de análisis y entrenamiento personalizado para League of Legends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
