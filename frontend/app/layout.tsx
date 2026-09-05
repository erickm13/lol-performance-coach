import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

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
    <html lang="es" className={`${chakraPetch.variable} ${ibmPlexSans.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
