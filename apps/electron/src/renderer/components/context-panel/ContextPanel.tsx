/**
 * ContextPanel - Displays artifacts in the contextual right column.
 *
 * Routes artifact types to card components (SourceCard, SkillDetailCard)
 * or placeholder renderers for other artifact kinds.
 */

import { useAtom } from 'jotai'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { activeArtifactAtom } from '@/atoms/artifact'
import { SourceCard } from './SourceCard'
import { SkillDetailCard } from './SkillDetailCard'
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
      return <SourceCard sourceSlug={artifact.sourceSlug} />
    case 'skill':
      return <SkillDetailCard skillSlug={artifact.skillSlug} />
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
