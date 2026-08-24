import { useEffect, useMemo, useState } from 'react'
import { getPrivateAttachmentBlob } from '../../services/vulnerabilities'

export function PrivateMarkdown({ content, className = '' }: { content: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content])
  return <div className={`text-sm leading-7 text-slate-700 dark:text-slate-300 ${className}`}>{blocks}</div>
}

function parseBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      blocks.push(<div className="my-4 overflow-hidden rounded-lg border border-black/10 dark:border-white/10" key={`code-${index}`}>
        {language && <div className="border-b border-black/10 bg-[var(--app-panel-muted-bg)] px-3 py-1 text-xs text-slate-400 dark:border-white/10">{language}</div>}
        <pre className="platform-scrollbar overflow-x-auto bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{code.join('\n')}</code></pre>
      </div>)
      index += 1
      continue
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\(attachment:\/\/([a-zA-Z0-9_-]+)\)$/)
    if (image) {
      blocks.push(<PrivateImage alt={image[1]} attachmentId={image[2]} key={`image-${image[2]}-${index}`} />)
      index += 1
      continue
    }
    if (isTable(lines, index)) {
      const table: string[] = []
      while (index < lines.length && lines[index].includes('|')) table.push(lines[index++])
      blocks.push(<MarkdownTable key={`table-${index}`} lines={table} />)
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const classes = level === 1 ? 'mb-4 mt-2 text-center text-2xl' : level === 2 ? 'mb-2 mt-6 text-lg' : 'mb-2 mt-4 text-base'
      blocks.push(<div className={`${classes} font-semibold text-slate-950 first:mt-0 dark:text-white`} key={index}>{inline(heading[2])}</div>)
      index += 1
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s/, ''))
      blocks.push(<ol className="my-3 list-decimal space-y-1 pl-6" key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>)
      continue
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s/.test(lines[index])) items.push(lines[index++].replace(/^[-*]\s/, ''))
      blocks.push(<ul className="my-3 list-disc space-y-1 pl-6" key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>)
      continue
    }
    if (line.startsWith('> ')) {
      blocks.push(<blockquote className="my-3 border-l-2 border-brand-600/40 bg-brand-600/5 px-4 py-2" key={index}>{inline(line.slice(2))}</blockquote>)
      index += 1
      continue
    }
    if (!line.trim()) {
      index += 1
      continue
    }
    blocks.push(<p className="my-2 whitespace-pre-wrap" key={index}>{inline(line)}</p>)
    index += 1
  }
  return blocks
}

function PrivateImage({ alt, attachmentId }: { alt: string; attachmentId: string }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void getPrivateAttachmentBlob(attachmentId, true).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachmentId])
  if (failed) return <p className="my-3 rounded-lg border border-dashed border-black/10 p-3 text-slate-400 dark:border-white/10">私有图片加载失败或无权访问</p>
  if (!url) return <div className="my-3 h-28 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
  return <button className="my-4 block max-w-full" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} type="button"><img alt={alt || '漏洞证明图片'} className="max-h-[680px] max-w-full rounded-lg border border-black/10 object-contain dark:border-white/10" src={url} /></button>
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines.filter((_, index) => index !== 1).map(splitRow)
  const [head = [], ...body] = rows
  return <div className="platform-scrollbar my-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10"><table className="min-w-full divide-y divide-black/10 dark:divide-white/10"><thead className="bg-[var(--app-panel-muted-bg)]"><tr>{head.map((cell, index) => <th className="px-3 py-2 text-left font-semibold" key={index}>{inline(cell)}</th>)}</tr></thead><tbody className="divide-y divide-black/5 dark:divide-white/10">{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td className="px-3 py-2 align-top" key={index}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong className="font-semibold text-slate-950 dark:text-white" key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code className="rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10" key={index}>{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/)
    if (link) return <a className="text-brand-700 hover:underline dark:text-brand-300" href={link[2]} key={index} rel="noreferrer" target="_blank">{link[1]}</a>
    return <span key={index}>{part}</span>
  })
}

function isTable(lines: string[], index: number) {
  return Boolean(lines[index]?.includes('|') && /^\|?\s*:?-{3,}/.test(lines[index + 1]?.trim() ?? ''))
}

function splitRow(line: string) {
  const cells = line.split('|').map((cell) => cell.trim())
  if (cells[0] === '') cells.shift()
  if (cells[cells.length - 1] === '') cells.pop()
  return cells
}
