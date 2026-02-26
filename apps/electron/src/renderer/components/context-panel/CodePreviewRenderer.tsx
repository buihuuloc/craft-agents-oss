/**
 * CodePreviewRenderer - Read-only syntax-highlighted HTML source view for ContextPanel.
 *
 * Uses ShikiCodeViewer to display the raw HTML code with line numbers
 * and proper syntax highlighting.
 */

import { ShikiCodeViewer } from '@craft-agent/ui'
import { useTheme } from '@/context/ThemeContext'

interface CodePreviewRendererProps {
  code: string
}

export function CodePreviewRenderer({ code }: CodePreviewRendererProps) {
  const { isDark } = useTheme()

  return (
    <div className="h-full">
      <ShikiCodeViewer
        code={code}
        language="html"
        theme={isDark ? 'dark' : 'light'}
      />
    </div>
  )
}
