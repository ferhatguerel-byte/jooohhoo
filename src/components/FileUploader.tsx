'use client'

import { useRef, useState } from 'react'
import { Paperclip, X, Loader2 } from 'lucide-react'

export interface UploadedFile {
  url: string
  name: string
}

export default function FileUploader({
  files,
  onChange,
  label,
  accept,
  multiple = true,
}: {
  files: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  label: string
  accept?: string
  multiple?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError('')
    try {
      const uploaded: UploadedFile[] = []
      for (const file of Array.from(fileList)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Upload fehlgeschlagen.')
        uploaded.push({ url: json.url, name: json.name })
      }
      onChange(multiple ? [...files, ...uploaded] : uploaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeFile(url: string) {
    onChange(files.filter((f) => f.url !== url))
  }

  return (
    <div>
      <p className="block text-sm font-semibold text-slate-700 mb-1">{label}</p>
      <div className="space-y-2 mb-2">
        {files.map((f) => (
          <div key={f.url} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-700 hover:underline truncate">
              <Paperclip size={14} className="shrink-0" /> <span className="truncate">{f.name}</span>
            </a>
            <button type="button" onClick={() => removeFile(f.url)} aria-label="Entfernen" className="text-slate-400 hover:text-red-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="border border-dashed border-slate-300 hover:border-slate-400 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 flex items-center gap-2 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        {uploading ? 'Wird hochgeladen…' : 'Datei(en) auswählen'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p role="alert" className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
