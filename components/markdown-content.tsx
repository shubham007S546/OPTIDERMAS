'use client'

import React from 'react'
import { Info } from 'lucide-react'
import type { ConversationCitation } from '@/lib/api'

interface MarkdownContentProps {
  content: string
  citations?: ConversationCitation[]
  onCitationClick?: (citation: ConversationCitation) => void
  className?: string
}

/**
 * Renders structured clinical markdown cleanly without external heavy runtime dependencies.
 * Supports headings (#..####), GFM pipe tables, bullet/numbered lists, blockquotes/callouts,
 * horizontal rules, inline **bold**, *italic*, `code`, <br>, markdown links, and interactive [CIT-X] pills.
 */
export function MarkdownContent({
  content,
  citations,
  onCitationClick,
  className = '',
}: MarkdownContentProps) {
  if (!content) return null

  // Normalize stray HTML line breaks cleanly before block parsing
  const normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\s+---\s+##/g, '\n\n---\n\n##')
    .replace(/<br\s*\/?>/gi, '\n')

  const lines = normalized.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let keyCounter = 0
  const nextKey = () => `md-blk-${keyCounter++}`

  const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
    if (!text) return []

    // First split by interactive citation markers [CIT-1] or grouped [CIT-1, CIT-2]
    const citSegments = text.split(/(\[CIT-\d+(?:\s*,\s*CIT-\d+)*\])/g)
    const out: React.ReactNode[] = []

    citSegments.forEach((seg, sIdx) => {
      if (!seg) return

      const groupedCit = seg.match(/^\[(CIT-\d+(?:\s*,\s*CIT-\d+)*)\]$/)
      if (groupedCit) {
        const ids = groupedCit[1].split(',').map((s) => s.trim())
        ids.forEach((citId, cIdx) => {
          const citObj = citations?.find((c) => c.citation_id === citId)
          out.push(
            <button
              key={`${keyPrefix}-cit-${sIdx}-${cIdx}`}
              type="button"
              onClick={() => citObj && onCitationClick?.(citObj)}
              disabled={!citObj}
              className={`inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/40 align-baseline transition-colors ${
                citObj
                  ? 'hover:bg-sky-500/25 cursor-pointer'
                  : 'opacity-80 cursor-default'
              }`}
              title={citObj ? `${citObj.title} (${citObj.source})` : 'Clinical Literature Citation'}
            >
              <span>{citId}</span>
              <Info size={10} />
            </button>
          )
        })
        return
      }

      // Parse inline formatting tokens (**bold**, *italic*, `code`, [label](url))
      const tokenRegex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
      const subParts = seg.split(tokenRegex)

      subParts.forEach((part, pIdx) => {
        if (!part) return
        const k = `${keyPrefix}-${sIdx}-${pIdx}`

        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          out.push(
            <strong key={k} className="font-bold text-slate-950 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          )
          return
        }

        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          out.push(
            <em key={k} className="italic text-slate-700 dark:text-slate-300">
              {part.slice(1, -1)}
            </em>
          )
          return
        }

        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          out.push(
            <code
              key={k}
              className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-sky-300 font-mono text-[12px]"
            >
              {part.slice(1, -1)}
            </code>
          )
          return
        }

        const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
        if (linkMatch) {
          out.push(
            <a
              key={k}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 dark:text-sky-400 underline underline-offset-2 font-medium hover:text-sky-900"
            >
              {linkMatch[1]}
            </a>
          )
          return
        }

        out.push(<React.Fragment key={k}>{part}</React.Fragment>)
      })
    })

    return out
  }

  const isTableRow = (line: string) => {
    const trimmed = line.trim()
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 3
  }

  const isTableSeparator = (line: string) => {
    const trimmed = line.trim()
    return /^\|[\s:|-]+\|$/.test(trimmed) && trimmed.includes('-')
  }

  const splitTableCells = (line: string) => {
    return line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line
    if (!trimmed) {
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={nextKey()} className="border-slate-200 dark:border-slate-700/70 my-2.5" />)
      i++
      continue
    }

    // Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = headingMatch[2]
      const k = nextKey()
      if (level <= 2) {
        blocks.push(
          <h3
            key={k}
            className="text-[14px] font-extrabold text-slate-950 dark:text-white mt-3.5 mb-1.5 pb-1 border-b border-slate-200/80 dark:border-slate-700/60"
          >
            {renderInline(headingText, k)}
          </h3>
        )
      } else {
        blocks.push(
          <h4
            key={k}
            className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mt-2.5 mb-1"
          >
            {renderInline(headingText, k)}
          </h4>
        )
      }
      i++
      continue
    }

    // GFM Pipe Table
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableCells(trimmed)
      i += 2 // skip header + separator
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitTableCells(lines[i]))
        i++
      }
      const k = nextKey()
      blocks.push(
        <div
          key={k}
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-2xs"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={`${k}-h-${hIdx}`}
                    className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap"
                  >
                    {renderInline(h, `${k}-th-${hIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr
                  key={`${k}-r-${rIdx}`}
                  className="even:bg-slate-50/70 dark:even:bg-slate-800/30"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={`${k}-c-${rIdx}-${cIdx}`}
                      className="px-3 py-2 text-slate-700 dark:text-slate-200 align-top leading-relaxed"
                    >
                      {renderInline(row[cIdx] || '', `${k}-td-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Blockquote / [!NOTE] / [!WARNING] callout
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const cleaned = lines[i].trim().replace(/^>\s?/, '')
        if (!/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.test(cleaned)) {
          quoteLines.push(cleaned)
        }
        i++
      }
      const k = nextKey()
      blocks.push(
        <div
          key={k}
          className="my-2 px-3.5 py-2.5 rounded-xl border-l-4 border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed space-y-1"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={`${k}-q-${qIdx}`}>{renderInline(ql, `${k}-q-${qIdx}`)}</p>
          ))}
        </div>
      )
      continue
    }

    // Bullet List (-, *, •)
    if (/^([-*•])\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^([-*•])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•])\s+/, ''))
        i++
      }
      const k = nextKey()
      blocks.push(
        <ul key={k} className="my-1.5 pl-4 space-y-1.5 list-disc marker:text-sky-600">
          {items.map((item, idx) => (
            <li
              key={`${k}-li-${idx}`}
              className="text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed pl-0.5"
            >
              {renderInline(item, `${k}-li-${idx}`)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered List (1., 2., ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      const k = nextKey()
      blocks.push(
        <ol key={k} className="my-1.5 pl-5 space-y-1.5 list-decimal marker:font-bold marker:text-sky-700">
          {items.map((item, idx) => (
            <li
              key={`${k}-oli-${idx}`}
              className="text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed pl-0.5"
            >
              {renderInline(item, `${k}-oli-${idx}`)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Paragraph (collect consecutive plain lines)
    const paraLines: string[] = []
    while (i < lines.length) {
      const cur = lines[i].trim()
      if (
        !cur ||
        /^(#{1,4})\s+/.test(cur) ||
        /^([-*•])\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        cur.startsWith('>') ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(cur) ||
        (isTableRow(cur) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break
      }
      paraLines.push(cur)
      i++
    }
    const k = nextKey()
    blocks.push(
      <p key={k} className="text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed">
        {renderInline(paraLines.join(' '), k)}
      </p>
    )
  }

  return <div className={`space-y-1.5 break-words ${className}`}>{blocks}</div>
}
