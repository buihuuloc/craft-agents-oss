/**
 * ContextPanel - Displays artifacts in the contextual right column.
 *
 * Routes artifact types to placeholder renderers (to be replaced with
 * real card components in Task 9).
 */

import { useAtom } from 'jotai'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { activeArtifactAtom } from '@/atoms/artifact'
import type { ArtifactType } from '@/types/artifact'

function getTitle(artifact: ArtifactType): string {
  switch (artifact.kind) {
    case 'source':
      return 'Source'
    case 'skill':
      return 'Skill'
    case 'session-meta':
      return 'Session'
    case 'settings-preview':
      return 'Settings'
    case 'multi-field-config':
      return artifact.title
  }
}

function ArtifactRenderer({ artifact }: { artifact: ArtifactType }) {
  switch (artifact.kind) {
    case 'source':
      return <div className="text-sm text-foreground-50">Source: {artifact.sourceSlug}</div>
    case 'skill':
      return <div className="text-sm text-foreground-50">Skill: {artifact.skillSlug}</div>
    case 'session-meta':
      return <div className="text-sm text-foreground-50">Session: {artifact.sessionId}</div>
    case 'settings-preview':
      return <div className="text-sm text-foreground-50">Settings preview: {artifact.settingKey}</div>
    case 'multi-field-config':
      return <div className="text-sm text-foreground-50">Config: {artifact.title}</div>
  }
}

export function ContextPanel() {
  const [artifact, setArtifact] = useAtom(activeArtifactAtom)

  if (!artifact) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and close button */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-foreground-90 shrink-0">
        <span className="text-sm font-medium">{getTitle(artifact)}</span>
        <Button variant="ghost" size="icon" onClick={() => setArtifact(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ArtifactRenderer artifact={artifact} />
        </div>
      </ScrollArea>
    </div>
  )
}
