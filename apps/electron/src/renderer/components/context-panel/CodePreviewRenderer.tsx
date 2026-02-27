/**
 * CodePreviewRenderer - Read-only syntax-highlighted HTML source view for ContextPanel.
 *
 * Parses the JSON spec (with `src` path) to load the actual HTML file content,
 * then displays it with ShikiCodeViewer for syntax highlighting.
 */

import { useState, useEffect, useMemo } from 'react'
import { ShikiCodeViewer, usePlatform } from '@craft-agent/ui'
import { useTheme } from '@/context/ThemeContext'

interface CodePreviewRendererProps {
  code: string
  /** Syntax language for highlighting. Default 'html'. */
  language?: string
}

export function CodePreviewRenderer({ code, language = 'html' }: CodePreviewRendererProps) {
  const { isDark } = useTheme()
  const { onReadFile } = usePlatform()
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse the JSON spec to extract src path (only for HTML — mermaid code is raw text)
  const src = useMemo(() => {
    if (language !== 'html') return null
    try {
      const parsed = JSON.parse(code)
      if (parsed.src && typeof parsed.src === 'string') return parsed.src
      if (parsed.items?.[0]?.src) return parsed.items[0].src
    } catch {
      // Not JSON — code itself is raw HTML
    }
    return null
  }, [code, language])

  // Load the actual HTML file content
  useEffect(() => {
    if (!src || !onReadFile) return
    setLoading(true)
    setHtmlContent(null)
    setError(null)
    onReadFile(src)
      .then(setHtmlContent)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load file'))
      .finally(() => setLoading(false))
  }, [src, onReadFile])

  // Determine what to display
  const displayCode = src ? htmlContent : code

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading source...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive/70">{error}</div>
  }

  if (!displayCode) {
    return <div className="p-4 text-sm text-muted-foreground">No content</div>
  }

  return (
    <div className="h-full">
      <ShikiCodeViewer
        code={displayCode}
        language={language}
        theme={isDark ? 'dark' : 'light'}
      />
    </div>
  )
}
