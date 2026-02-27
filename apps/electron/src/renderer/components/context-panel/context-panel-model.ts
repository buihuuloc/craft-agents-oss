import type { ArtifactType } from '@/types/artifact'

export type ArtifactViewMode = 'preview' | 'code'

export function getArtifactIdentity(artifact: ArtifactType | null): string {
  if (!artifact) return '__none__'

  switch (artifact.kind) {
    case 'source':
      return `${artifact.kind}:${artifact.sourceSlug}`
    case 'skill':
      return `${artifact.kind}:${artifact.skillSlug}`
    case 'session-meta':
      return `${artifact.kind}:${artifact.sessionId}`
    case 'settings-preview':
      return `${artifact.kind}:${artifact.settingKey}`
    case 'multi-field-config':
      return `${artifact.kind}:${artifact.title}`
    case 'content-preview':
      return `${artifact.kind}:${artifact.contentType}:${artifact.title}:${artifact.code.length}`
  }
}

export function getArtifactTitle(artifact: ArtifactType): string {
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
    case 'content-preview':
      return artifact.title
  }
}

export function getArtifactTypeLabel(artifact: ArtifactType): string | null {
  if (artifact.kind !== 'content-preview') return null

  switch (artifact.contentType) {
    case 'html':
      return 'HTML'
    case 'mermaid':
      return 'Diagram'
    case 'pdf':
      return 'PDF'
  }
}

export function shouldShowCodeToggle(artifact: ArtifactType): boolean {
  return artifact.kind === 'content-preview' && (artifact.contentType === 'html' || artifact.contentType === 'mermaid')
}

export function nextViewModeAfterArtifactChange(
  previousArtifact: ArtifactType | null,
  nextArtifact: ArtifactType,
  currentViewMode: ArtifactViewMode,
): ArtifactViewMode {
  if (getArtifactIdentity(previousArtifact) === getArtifactIdentity(nextArtifact)) {
    return currentViewMode
  }

  return 'preview'
}
