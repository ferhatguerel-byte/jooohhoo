import Link from 'next/link'
import type { InternalLink } from '@/lib/seo/internal-links'

export default function InternalLinks({ title, links }: { title: string; links: InternalLink[] }) {
  if (links.length === 0) return null
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:border-brand/40 hover:text-brand transition"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
