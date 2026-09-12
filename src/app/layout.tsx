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

const SITE_URL = "https://www.bauversus.de";
const SITE_NAME = "BAUVERSUS";
const TITLE = "BAUVERSUS – Geprüfte Handwerker. Vergleichbare Angebote.";
const DESCRIPTION =
  "BAUVERSUS verbindet Auftraggeber mit geprüften Handwerksbetrieben. KI-gestütztes Leistungsverzeichnis macht Angebote direkt vergleichbar. Für Bauunternehmen zusätzlich: Nachunternehmer-Börse.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s – ${SITE_NAME}` },
  description: DESCRIPTION,
  keywords: [
    "Handwerker finden",
    "Handwerker Vergleich",
    "Angebote vergleichen Bau",
    "Leistungsverzeichnis erstellen",
    "Subunternehmer finden",
    "Nachunternehmer Bau",
    "Festpreis Renovierung",
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  legalName: "GGV BAU GmbH",
  url: SITE_URL,
  email: "kontakt@bauversus.de",
  telephone: "+4915252968818",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Mühlenstr. 8a",
    postalCode: "14167",
    addressLocality: "Berlin",
    addressCountry: "DE",
  },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
