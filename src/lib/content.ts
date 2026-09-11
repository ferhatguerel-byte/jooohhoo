import {
  Truck,
  Sparkles,
  HardHat,
  Clock,
  ShieldCheck,
  Star,
  BadgeCheck,
  Users,
  MapPin,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react'

export type Locale = 'de' | 'en'

export interface ServiceItem {
  icon: LucideIcon
  iconClassName?: string
  title: string
  desc: string
  points: string[]
}

export interface StatItem {
  icon: LucideIcon
  value: string
  label: string
}

export interface WhyUsItem {
  icon: LucideIcon
  title: string
  desc: string
}

export interface StepItem {
  step: string
  title: string
  desc: string
}

export interface TestimonialItem {
  name: string
  role: string
  text: string
  stars: number
}

export interface FaqItemData {
  q: string
  a: string
}

export interface ProjectImage {
  src: string
  alt: string
}

export interface Content {
  htmlLang: string
  nav: { leistungen: string; projekte: string; ablauf: string; referenzen: string; faq: string; kontakt: string }
  ctaAnfrage: string
  menuOpenLabel: string
  menuCloseLabel: string
  phoneDisplay: string
  langSwitchLabel: string
  langSwitchHref: string
  hero: {
    badge: string
    titleLine1: string
    titleHighlight: string
    subtitle: string
    cta1: string
    cta2: string
  }
  services: ServiceItem[]
  stats: StatItem[]
  whyUs: { heading: string; subheading: string; items: WhyUsItem[] }
  process: { heading: string; subheading: string; steps: StepItem[] }
  testimonials: { heading: string; items: TestimonialItem[] }
  projects: { heading: string; subheading: string; images: ProjectImage[] }
  quote: {
    heading: string
    desc: string
    hours: string
  }
  form: {
    name: string
    phone: string
    email: string
    service: string
    servicePlaceholder: string
    serviceOptions: string[]
    date: string
    message: string
    messagePlaceholder: string
    submit: string
    submitLoading: string
    errorPrefix: string
    successTitle: string
    successDesc: string
    privacyPre: string
    privacyLink: string
    privacyPost: string
  }
  faq: { heading: string; items: FaqItemData[] }
  footer: {
    tagline: string
    servicesHeading: string
    companyHeading: string
    companyLinks: { label: string; href: string }[]
    contactHeading: string
    copyright: string
    legal: { impressum: string; datenschutz: string; agb: string }
  }
  servicesSectionHeading: string
  servicesSectionSubheading: string
}

const servicesDe: ServiceItem[] = [
  {
    icon: Truck,
    title: 'Umzüge',
    desc: 'Privat- und Firmenumzüge, deutschlandweit und international. Vom Kartonpacken bis zum Möbelaufbau – alles aus einer Hand.',
    points: ['Wohnungs- & Hausumzüge', 'Büro- & Firmenumzüge', 'Ein- und Auslagerung'],
  },
  {
    icon: Truck,
    iconClassName: 'rotate-90',
    title: 'Transporte',
    desc: 'Schnelle und zuverlässige Transporte für Möbel, Paletten und Sondergüter – auf Abruf oder als Fixtermin.',
    points: ['Möbeltransporte', 'Kurier- & Expressfahrten', 'Sperrgut & Sondertransporte'],
  },
  {
    icon: Sparkles,
    title: 'Reinigung',
    desc: 'Gründliche Endreinigung, Unterhaltsreinigung und Grundreinigung für Wohnungen, Büros und Neubauten.',
    points: ['Umzugs- & Endreinigung', 'Büro- & Praxisreinigung', 'Bauendreinigung'],
  },
  {
    icon: HardHat,
    title: 'Bau & Renovierung',
    desc: 'Renovierungen, Sanierungen und kleinere Bauarbeiten – termingerecht und in gewohnt sauberer Ausführung.',
    points: ['Maler- & Bodenarbeiten', 'Trockenbau & Sanierung', 'Renovierung nach Umzug'],
  },
]

const servicesEn: ServiceItem[] = [
  {
    icon: Truck,
    title: 'Moving',
    desc: 'Residential and commercial moves, nationwide and international. From packing boxes to furniture assembly – all under one roof.',
    points: ['Home & apartment moves', 'Office & corporate moves', 'Storage & warehousing'],
  },
  {
    icon: Truck,
    iconClassName: 'rotate-90',
    title: 'Transport',
    desc: 'Fast and reliable transport for furniture, pallets and special cargo – on demand or on a fixed schedule.',
    points: ['Furniture transport', 'Courier & express delivery', 'Bulky goods & special transport'],
  },
  {
    icon: Sparkles,
    title: 'Cleaning',
    desc: 'Thorough move-out cleaning, regular maintenance cleaning and deep cleaning for apartments, offices and new buildings.',
    points: ['Move-out & final cleaning', 'Office & practice cleaning', 'Post-construction cleaning'],
  },
  {
    icon: HardHat,
    title: 'Construction & Renovation',
    desc: 'Renovations, refurbishments and minor construction work – on schedule and finished to the usual clean standard.',
    points: ['Painting & flooring work', 'Drywall & refurbishment', 'Post-move renovation'],
  },
]

const statsDe: StatItem[] = [
  { icon: Users, value: '1.200+', label: 'Zufriedene Kunden' },
  { icon: Star, value: '4,8/5', label: 'Durchschnittsbewertung' },
  { icon: Clock, value: '10+ Jahre', label: 'Erfahrung' },
  { icon: MapPin, value: 'DE-weit', label: 'Einsatzgebiet' },
]

const statsEn: StatItem[] = [
  { icon: Users, value: '1,200+', label: 'Satisfied customers' },
  { icon: Star, value: '4.8/5', label: 'Average rating' },
  { icon: Clock, value: '10+ years', label: 'Experience' },
  { icon: MapPin, value: 'Germany-wide', label: 'Service area' },
]

const whyUsDe: WhyUsItem[] = [
  { icon: BadgeCheck, title: 'Festpreis-Garantie', desc: 'Transparentes Angebot vorab – keine versteckten Kosten.' },
  { icon: ShieldCheck, title: 'Vollständig versichert', desc: 'Transport- und Betriebshaftpflicht für Ihre Sicherheit.' },
  { icon: Users, title: 'Erfahrenes Team', desc: 'Geschulte Fachkräfte für Umzug, Transport, Reinigung und Bau.' },
  { icon: Clock, title: 'Flexible Termine', desc: 'Auch kurzfristig, abends und am Wochenende möglich.' },
  { icon: MapPin, title: 'Deutschlandweit', desc: 'Wir sind in ganz Deutschland und grenznah im Einsatz.' },
  { icon: CheckCircle, title: 'Alles aus einer Hand', desc: 'Ein Ansprechpartner für alle Ihre Anliegen.' },
]

const whyUsEn: WhyUsItem[] = [
  { icon: BadgeCheck, title: 'Fixed-Price Guarantee', desc: 'Transparent quote upfront – no hidden costs.' },
  { icon: ShieldCheck, title: 'Fully Insured', desc: 'Transport and liability insurance for your peace of mind.' },
  { icon: Users, title: 'Experienced Team', desc: 'Trained professionals for moving, transport, cleaning and construction.' },
  { icon: Clock, title: 'Flexible Scheduling', desc: 'Available on short notice, evenings and weekends.' },
  { icon: MapPin, title: 'Nationwide', desc: 'We operate across Germany and in border regions.' },
  { icon: CheckCircle, title: 'Everything, One Provider', desc: 'One point of contact for all your needs.' },
]

const stepsDe: StepItem[] = [
  { step: '01', title: 'Anfrage stellen', desc: 'Formular ausfüllen oder anrufen – wir melden uns innerhalb von 24 Stunden.' },
  { step: '02', title: 'Kostenloses Angebot', desc: 'Sie erhalten ein unverbindliches Festpreis-Angebot, bei Bedarf nach Vor-Ort-Besichtigung.' },
  { step: '03', title: 'Termin vereinbaren', desc: 'Wir stimmen einen für Sie passenden Termin ab – auch kurzfristig.' },
  { step: '04', title: 'Durchführung', desc: 'Unser Team führt den Auftrag zuverlässig, sauber und termingerecht aus.' },
]

const stepsEn: StepItem[] = [
  { step: '01', title: 'Submit a Request', desc: 'Fill out the form or call us – we’ll get back to you within 24 hours.' },
  { step: '02', title: 'Free Quote', desc: 'You’ll receive a non-binding fixed-price quote, if needed after an on-site inspection.' },
  { step: '03', title: 'Schedule an Appointment', desc: 'We’ll agree on a time that works for you – even on short notice.' },
  { step: '04', title: 'Completion', desc: 'Our team carries out the job reliably, cleanly and on schedule.' },
]

const testimonialsDe: TestimonialItem[] = [
  { name: 'Familie Schneider', role: 'Umzug, München', text: 'Reibungsloser Ablauf, faires Festpreisangebot und sehr vorsichtiger Umgang mit unseren Möbeln. Absolute Empfehlung!', stars: 5 },
  { name: 'Anna K.', role: 'Büroreinigung, Berlin', text: 'Seit einem Jahr betreut RundumWerk24 unsere Praxisräume. Immer pünktlich, gründlich und zuverlässig.', stars: 5 },
  { name: 'Michael R.', role: 'Renovierung, Köln', text: 'Vom Boden bis zur Wand alles aus einer Hand organisiert. Termin wurde exakt eingehalten.', stars: 5 },
]

const testimonialsEn: TestimonialItem[] = [
  { name: 'The Schneider Family', role: 'Moving, Munich', text: 'Smooth process, a fair fixed-price quote and very careful handling of our furniture. Highly recommended!', stars: 5 },
  { name: 'Anna K.', role: 'Office cleaning, Berlin', text: 'RundumWerk24 has been taking care of our practice rooms for a year now. Always punctual, thorough and reliable.', stars: 5 },
  { name: 'Michael R.', role: 'Renovation, Cologne', text: 'Everything organized from floor to wall, all under one roof. The schedule was met exactly.', stars: 5 },
]

const faqDe: FaqItemData[] = [
  { q: 'Wie schnell erhalte ich ein Angebot?', a: 'In der Regel innerhalb von 24 Stunden nach Ihrer Anfrage. Bei komplexeren Aufträgen vereinbaren wir vorab einen kurzen Vor-Ort- oder Video-Termin zur Besichtigung.' },
  { q: 'Sind die Preise wirklich Festpreise?', a: 'Ja. Nach der Besichtigung bzw. Angebotsklärung erhalten Sie einen verbindlichen Festpreis – ohne versteckte Zusatzkosten.' },
  { q: 'Bieten Sie auch kurzfristige Termine an?', a: 'Ja, je nach Kapazität sind auch kurzfristige und Wochenendtermine möglich. Sprechen Sie uns einfach an.' },
  { q: 'In welchen Regionen sind Sie aktiv?', a: 'Wir sind deutschlandweit im Einsatz, mit Schwerpunkt in Ballungsräumen sowie grenznahen Regionen zu Polen.' },
  { q: 'Ist mein Umzug/Transport versichert?', a: 'Ja, alle Aufträge sind über unsere Transport- und Betriebshaftpflichtversicherung abgesichert.' },
]

const faqEn: FaqItemData[] = [
  { q: 'How quickly will I receive a quote?', a: 'Usually within 24 hours of your request. For more complex jobs, we arrange a short on-site or video inspection beforehand.' },
  { q: 'Are the prices really fixed?', a: 'Yes. After the inspection or clarification of your request, you’ll receive a binding fixed price – no hidden extra costs.' },
  { q: 'Do you also offer short-notice appointments?', a: 'Yes, depending on capacity we also offer short-notice and weekend appointments. Just get in touch.' },
  { q: 'Which regions do you serve?', a: 'We operate across Germany, with a focus on major metropolitan areas and border regions near Poland.' },
  { q: 'Is my move/transport insured?', a: 'Yes, all jobs are covered by our transport and general liability insurance.' },
]

const projectImagesDe: ProjectImage[] = [
  { src: '/fotos/bau-09.jpg', alt: 'Fertig saniertes Zimmer mit Dielenboden' },
  { src: '/fotos/bau-10.jpg', alt: 'Fertiggestelltes Badezimmer mit Duschkabine' },
  { src: '/fotos/bau-01.jpg', alt: 'Ausgebautes Dachgeschoss mit Sichtfachwerk' },
  { src: '/fotos/bau-04.jpg', alt: 'Fliesenverlegung im Badezimmer' },
  { src: '/fotos/bau-05.jpg', alt: 'Parkettschliff und Aufarbeitung' },
  { src: '/fotos/bau-06.jpg', alt: 'Fußbodenaufbau mit OSB-Platten' },
  { src: '/fotos/bau-07.jpg', alt: 'Elektroinstallation und Sicherheitsprüfung' },
  { src: '/fotos/bau-08.jpg', alt: 'Trockenbau und Elektroinstallation im Flur' },
]

const projectImagesEn: ProjectImage[] = [
  { src: '/fotos/bau-09.jpg', alt: 'Fully renovated room with wood flooring' },
  { src: '/fotos/bau-10.jpg', alt: 'Completed bathroom with walk-in shower' },
  { src: '/fotos/bau-01.jpg', alt: 'Converted attic room with exposed timber framing' },
  { src: '/fotos/bau-04.jpg', alt: 'Bathroom tiling in progress' },
  { src: '/fotos/bau-05.jpg', alt: 'Sanding and refinishing a parquet floor' },
  { src: '/fotos/bau-06.jpg', alt: 'Subfloor construction with OSB panels' },
  { src: '/fotos/bau-07.jpg', alt: 'Electrical installation and safety testing' },
  { src: '/fotos/bau-08.jpg', alt: 'Drywall and electrical work in a hallway' },
]

export const content: Record<Locale, Content> = {
  de: {
    htmlLang: 'de',
    nav: { leistungen: 'Leistungen', projekte: 'Projekte', ablauf: 'Ablauf', referenzen: 'Referenzen', faq: 'FAQ', kontakt: 'Kontakt' },
    ctaAnfrage: 'Kostenlose Anfrage',
    menuOpenLabel: 'Menü öffnen',
    menuCloseLabel: 'Menü schließen',
    phoneDisplay: '0152 / 52968818',
    langSwitchLabel: 'EN',
    langSwitchHref: '/en',
    hero: {
      badge: 'Versichert & mit Festpreis-Garantie',
      titleLine1: 'Umzug, Transport, Reinigung & Bau –',
      titleHighlight: 'alles aus einer Hand',
      subtitle: 'RundumWerk24 ist Ihr zuverlässiger Rundum-Dienstleister für Privat- und Geschäftskunden in ganz Deutschland. Ein Ansprechpartner, transparente Festpreise, saubere Ausführung.',
      cta1: 'Kostenloses Angebot anfordern',
      cta2: 'Unsere Leistungen',
    },
    services: servicesDe,
    stats: statsDe,
    servicesSectionHeading: 'Unsere Leistungen',
    servicesSectionSubheading: 'Vier Kernbereiche, ein Ansprechpartner – individuell kombinierbar für Ihr Projekt.',
    whyUs: { heading: 'Warum RundumWerk24?', subheading: 'Was uns von anderen Anbietern unterscheidet.', items: whyUsDe },
    process: { heading: 'So läuft es ab', subheading: 'In vier einfachen Schritten zu Ihrem fertigen Auftrag.', steps: stepsDe },
    testimonials: { heading: 'Das sagen unsere Kunden', items: testimonialsDe },
    projects: {
      heading: 'Unsere Projekte',
      subheading: 'Ein Einblick in echte Baustellen und abgeschlossene Arbeiten von GGV BAU.',
      images: projectImagesDe,
    },
    quote: {
      heading: 'Kostenloses & unverbindliches Angebot',
      desc: 'Füllen Sie das Formular aus – wir melden uns innerhalb von 24 Stunden mit einem individuellen Festpreisangebot bei Ihnen.',
      hours: 'Mo–Fr 08:00–18:00, Sa 09:00–13:00',
    },
    form: {
      name: 'Name *',
      phone: 'Telefon',
      email: 'E-Mail *',
      service: 'Leistung *',
      servicePlaceholder: 'Bitte wählen',
      serviceOptions: ['Umzug', 'Transport', 'Reinigung', 'Bau & Renovierung', 'Sonstiges'],
      date: 'Wunschtermin',
      message: 'Nachricht',
      messagePlaceholder: 'Beschreiben Sie kurz Ihr Anliegen (z. B. Wohnungsgröße, Adresse von/nach, Umfang der Arbeiten)…',
      submit: 'Unverbindliches Angebot anfordern',
      submitLoading: 'Wird gesendet…',
      errorPrefix: 'Fehler: ',
      successTitle: 'Vielen Dank für Ihre Anfrage!',
      successDesc: 'Wir melden uns in der Regel innerhalb von 24 Stunden mit einem unverbindlichen Angebot bei Ihnen.',
      privacyPre: 'Mit dem Absenden stimmen Sie unserer',
      privacyLink: 'Datenschutzerklärung',
      privacyPost: 'zu.',
    },
    faq: { heading: 'Häufige Fragen', items: faqDe },
    footer: {
      tagline: 'Ihr Rundum-Dienstleister für Umzüge, Transporte, Reinigung und Bau in ganz Deutschland.',
      servicesHeading: 'Leistungen',
      companyHeading: 'Unternehmen',
      companyLinks: [
        { label: 'Leistungen', href: '#leistungen' },
        { label: 'Projekte', href: '#projekte' },
        { label: 'Referenzen', href: '#referenzen' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Angebot anfordern', href: '#anfrage' },
      ],
      contactHeading: 'Kontakt',
      copyright: 'Alle Rechte vorbehalten.',
      legal: { impressum: 'Impressum', datenschutz: 'Datenschutz', agb: 'AGB' },
    },
  },
  en: {
    htmlLang: 'en',
    nav: { leistungen: 'Services', projekte: 'Projects', ablauf: 'Process', referenzen: 'Reviews', faq: 'FAQ', kontakt: 'Contact' },
    ctaAnfrage: 'Free Quote',
    menuOpenLabel: 'Open menu',
    menuCloseLabel: 'Close menu',
    phoneDisplay: '+49 152 52968818',
    langSwitchLabel: 'DE',
    langSwitchHref: '/',
    hero: {
      badge: 'Insured & Fixed-Price Guarantee',
      titleLine1: 'Moving, Transport, Cleaning & Construction –',
      titleHighlight: 'all under one roof',
      subtitle: 'RundumWerk24 is your reliable all-in-one service provider for private and business customers across Germany. One point of contact, transparent fixed prices, clean execution.',
      cta1: 'Request a Free Quote',
      cta2: 'Our Services',
    },
    services: servicesEn,
    stats: statsEn,
    servicesSectionHeading: 'Our Services',
    servicesSectionSubheading: 'Four core areas, one point of contact – individually combinable for your project.',
    whyUs: { heading: 'Why RundumWerk24?', subheading: 'What sets us apart from other providers.', items: whyUsEn },
    process: { heading: 'How It Works', subheading: 'Four simple steps to your completed job.', steps: stepsEn },
    testimonials: { heading: 'What Our Customers Say', items: testimonialsEn },
    projects: {
      heading: 'Our Projects',
      subheading: 'A look at real job sites and completed work by GGV BAU.',
      images: projectImagesEn,
    },
    quote: {
      heading: 'Free & Non-Binding Quote',
      desc: 'Fill out the form – we’ll get back to you within 24 hours with a personalized fixed-price quote.',
      hours: 'Mon–Fri 8:00 AM–6:00 PM, Sat 9:00 AM–1:00 PM',
    },
    form: {
      name: 'Name *',
      phone: 'Phone',
      email: 'Email *',
      service: 'Service *',
      servicePlaceholder: 'Please select',
      serviceOptions: ['Moving', 'Transport', 'Cleaning', 'Construction & Renovation', 'Other'],
      date: 'Preferred date',
      message: 'Message',
      messagePlaceholder: 'Briefly describe your request (e.g. apartment size, from/to address, scope of work)…',
      submit: 'Request a Free Quote',
      submitLoading: 'Sending…',
      errorPrefix: 'Error: ',
      successTitle: 'Thank you for your request!',
      successDesc: 'We’ll usually get back to you within 24 hours with a non-binding quote.',
      privacyPre: 'By submitting, you agree to our',
      privacyLink: 'Privacy Policy',
      privacyPost: '(available in German).',
    },
    faq: { heading: 'Frequently Asked Questions', items: faqEn },
    footer: {
      tagline: 'Your all-in-one service provider for moving, transport, cleaning and construction across Germany.',
      servicesHeading: 'Services',
      companyHeading: 'Company',
      companyLinks: [
        { label: 'Services', href: '#leistungen' },
        { label: 'Projects', href: '#projekte' },
        { label: 'Reviews', href: '#referenzen' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Request a Quote', href: '#anfrage' },
      ],
      contactHeading: 'Contact',
      copyright: 'All rights reserved.',
      legal: { impressum: 'Imprint', datenschutz: 'Privacy Policy', agb: 'Terms' },
    },
  },
}
