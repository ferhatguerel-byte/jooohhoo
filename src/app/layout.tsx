import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProfiWerk24 – Umzüge, Transporte, Reinigung & Bau aus einer Hand",
  description:
    "ProfiWerk24 ist Ihr Rundum-Dienstleister in Deutschland für Umzüge, Transporte, Gebäudereinigung und Bau-/Renovierungsarbeiten. Festpreis-Garantie, versichert, deutschlandweit im Einsatz.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
