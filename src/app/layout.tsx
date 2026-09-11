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

const SITE_URL = "https://www.rundumwerk24.de";
const SITE_NAME = "RundumWerk24";
const TITLE = "RundumWerk24 – Umzüge, Transporte, Reinigung & Bau aus einer Hand";
const DESCRIPTION =
  "RundumWerk24 ist Ihr Rundum-Dienstleister in Deutschland für Umzüge, Transporte, Gebäudereinigung und Bau-/Renovierungsarbeiten. Festpreis-Garantie, versichert, deutschlandweit im Einsatz.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s – ${SITE_NAME}` },
  description: DESCRIPTION,
  keywords: [
    "Umzug Deutschland",
    "Umzugsfirma",
    "Transporte",
    "Gebäudereinigung",
    "Renovierung",
    "Bauarbeiten",
    "Festpreis Umzug",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: SITE_NAME,
  legalName: "GGV BAU GmbH",
  url: SITE_URL,
  telephone: "+4915252968818",
  email: "anfrage@rundumwerk24.de",
  areaServed: "DE",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Mühlenstr. 8a",
    postalCode: "14167",
    addressLocality: "Berlin",
    addressCountry: "DE",
  },
  openingHours: ["Mo-Fr 08:00-18:00", "Sa 09:00-13:00"],
  priceRange: "€€",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
