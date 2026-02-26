/**
 * ArtifactCompactCard - A compact clickable card for artifact previews.
 *
 * Used by MarkdownHtmlBlock, MarkdownMermaidBlock, and MarkdownPdfBlock
 * when `onOpenArtifactPreview` is available in PlatformContext.
 * Clicking the card opens the full preview in the ContextPanel.
 */

import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ArtifactCompactCardProps {
  title: string
  typeLabel: string
  icon: LucideIcon
  onClick: () => void
  className?: string
}

export function ArtifactCompactCard({ title, typeLabel, icon: Icon, onClick, className }: ArtifactCompactCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border border-foreground/10 bg-foreground/[0.02]',
        'hover:bg-foreground/[0.05] hover:border-foreground/15',
        'transition-colors cursor-pointer',
        'px-4 py-3 group',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 rounded-md bg-foreground/[0.05] flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{title}</div>
          <div className="text-xs text-muted-foreground">{typeLabel} · Click to preview</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>
    </button>
  )
}
