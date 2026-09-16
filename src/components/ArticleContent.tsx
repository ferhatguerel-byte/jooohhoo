export default function ArticleContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim())

  return (
    <div className="prose-content space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="text-lg font-bold text-[#17202a] mt-6">
              {trimmed.slice(4)}
            </h3>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-black text-[#17202a] mt-8">
              {trimmed.slice(3)}
            </h2>
          )
        }
        return (
          <p key={i} className="text-slate-700 leading-relaxed whitespace-pre-line">
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}
