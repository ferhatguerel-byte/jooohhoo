export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Firmenname als lesbarer Teil, gefolgt von den ersten 8 Zeichen der UUID zur eindeutigen Identifikation. */
export function buildCompanySlug(companyName: string, id: string): string {
  return `${slugify(companyName)}-${id.slice(0, 8)}`
}

export function extractIdPrefixFromSlug(slug: string): string | null {
  const match = slug.match(/-([0-9a-f]{8})$/i)
  return match ? match[1] : null
}
