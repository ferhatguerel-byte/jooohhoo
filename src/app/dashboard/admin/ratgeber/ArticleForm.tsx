'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  articleId?: string
  initialTitle?: string
  initialExcerpt?: string
  initialContent?: string
  initialMetaDescription?: string
  initialPublished?: boolean
}

export default function ArticleForm({
  articleId,
  initialTitle = '',
  initialExcerpt = '',
  initialContent = '',
  initialMetaDescription = '',
  initialPublished = true,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = {
      title: form.get('title'),
      excerpt: form.get('excerpt'),
      content: form.get('content'),
      metaDescription: form.get('metaDescription') || undefined,
      published: form.get('published') === 'on',
    }

    try {
      const res = await fetch(
        articleId ? `/api/admin/guide-articles/${articleId}` : '/api/admin/guide-articles',
        {
          method: articleId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler beim Speichern.')
      router.push('/dashboard/admin/ratgeber')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Titel</span>
        <input name="title" defaultValue={initialTitle} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Kurzbeschreibung (Vorschautext)</span>
        <textarea name="excerpt" defaultValue={initialExcerpt} required rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Meta-Beschreibung (für Google, optional)</span>
        <input name="metaDescription" defaultValue={initialMetaDescription} maxLength={300} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Inhalt</span>
        <p className="text-xs text-slate-400 mb-1">
          Absätze durch eine Leerzeile trennen. Zeilen, die mit ## beginnen, werden zu Überschriften.
        </p>
        <textarea name="content" defaultValue={initialContent} required rows={16} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="published" defaultChecked={initialPublished} className="w-4 h-4" />
        <span className="text-sm font-semibold text-slate-700">Veröffentlicht (öffentlich sichtbar)</span>
      </label>

      <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg">
        {loading ? 'Speichern…' : 'Speichern'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
