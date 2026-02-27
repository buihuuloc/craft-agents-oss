/**
 * ContextPanel - Displays artifacts in the contextual right column.
 *
 * Routes artifact types to card components (SourceCard, SkillDetailCard)
 * or full content previews (HTML, Mermaid, PDF) for chat artifacts.
 */

import { useAtom } from 'jotai'
import { X, RotateCw, Eye, Code2 } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { activeArtifactAtom } from '@/atoms/artifact'
import { SourceCard } from './SourceCard'
import { SkillDetailCard } from './SkillDetailCard'
import { ContentPreviewRenderer } from './ContentPreviewRenderer'
import { CodePreviewRenderer } from './CodePreviewRenderer'
import { MermaidPanelRenderer } from './MermaidPanelRenderer'
import type { ArtifactType } from '@/types/artifact'
import {
  getArtifactTitle,
  getArtifactTypeLabel,
  nextViewModeAfterArtifactChange,
  shouldShowCodeToggle,
  type ArtifactViewMode,
} from './context-panel-model'

function ArtifactRenderer({ artifact, refreshKey }: { artifact: ArtifactType; refreshKey: number }) {
  switch (artifact.kind) {
    case 'source':
      return <SourceCard sourceSlug={artifact.sourceSlug} />
    case 'skill':
      return <SkillDetailCard skillSlug={artifact.skillSlug} />
    case 'session-meta':
      return <div className="text-sm text-foreground-50">Session: {artifact.sessionId}</div>
    case 'settings-preview':
      return <div className="text-sm text-foreground-50">Settings preview: {artifact.settingKey}</div>
    case 'multi-field-config':
      return <div className="text-sm text-foreground-50">Config: {artifact.title}</div>
    case 'content-preview':
      return <ContentPreviewRenderer key={refreshKey} contentType={artifact.contentType} code={artifact.code} />
  }
}

export function ContextPanel() {
  const [artifact, setArtifact] = useAtom(activeArtifactAtom)
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<ArtifactViewMode>('preview')
  const previousArtifactRef = useRef<ArtifactType | null>(null)

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  useEffect(() => {
    if (!artifact) {
      previousArtifactRef.current = null
      return
    }

    setViewMode(prev => nextViewModeAfterArtifactChange(previousArtifactRef.current, artifact, prev))
    previousArtifactRef.current = artifact
  }, [artifact])

  if (!artifact) return null

  const isContentPreview = artifact.kind === 'content-preview'
  const isHtmlPreview = isContentPreview && artifact.contentType === 'html'
  const isMermaidPreview = isContentPreview && artifact.contentType === 'mermaid'
  const hasCodeToggle = shouldShowCodeToggle(artifact)
  const typeLabel = getArtifactTypeLabel(artifact)

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — title + type on left, action buttons on right */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-foreground/[0.06] shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium truncate">{getArtifactTitle(artifact)}</span>
          {typeLabel && (
            <span className="text-xs text-muted-foreground shrink-0">{typeLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Code/Preview toggle for HTML and Mermaid artifacts */}
          {hasCodeToggle && (
            <div className="flex items-center rounded-md border border-foreground/[0.08] overflow-hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('preview')}
                title="Preview"
                className={`h-7 w-7 rounded-none ${viewMode === 'preview' ? 'bg-foreground/[0.08]' : ''}`}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('code')}
                title="View Code"
                className={`h-7 w-7 rounded-none ${viewMode === 'code' ? 'bg-foreground/[0.08]' : ''}`}
              >
                <Code2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {isContentPreview && (
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setArtifact(null)} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Content */}
      {isContentPreview ? (
        <div className="flex-1 min-h-0 overflow-auto">
          {hasCodeToggle && viewMode === 'code' ? (
            <CodePreviewRenderer code={artifact.code} language={isMermaidPreview ? 'mermaid' : 'html'} />
          ) : isMermaidPreview ? (
            <MermaidPanelRenderer code={artifact.code} />
          ) : (
            <ArtifactRenderer artifact={artifact} refreshKey={refreshKey} />
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4">
            <ArtifactRenderer artifact={artifact} refreshKey={refreshKey} />
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
