import { describe, it, expect } from 'bun:test'
import type { ArtifactType } from '@/types/artifact'
import {
  getArtifactTitle,
  getArtifactTypeLabel,
  shouldShowCodeToggle,
  nextViewModeAfterArtifactChange,
} from '../context-panel-model'

const htmlArtifact: ArtifactType = {
  kind: 'content-preview',
  contentType: 'html',
  title: 'Preview',
  code: '<html></html>',
}

const mermaidArtifact: ArtifactType = {
  kind: 'content-preview',
  contentType: 'mermaid',
  title: 'Diagram',
  code: 'graph TD; A-->B;',
}

describe('context-panel-model', () => {
  it('provides title and type label for content preview', () => {
    expect(getArtifactTitle(htmlArtifact)).toBe('Preview')
    expect(getArtifactTypeLabel(htmlArtifact)).toBe('HTML')
  })

  it('shows code toggle only for html/mermaid previews', () => {
    expect(shouldShowCodeToggle(htmlArtifact)).toBe(true)
    expect(shouldShowCodeToggle(mermaidArtifact)).toBe(true)
    expect(
      shouldShowCodeToggle({
        kind: 'content-preview',
        contentType: 'pdf',
        title: 'PDF',
        code: '{}',
      })
    ).toBe(false)
  })

  it('resets to preview mode when artifact identity changes', () => {
    const first = nextViewModeAfterArtifactChange(null, htmlArtifact, 'code')
    expect(first).toBe('preview')

    const unchanged = nextViewModeAfterArtifactChange(htmlArtifact, htmlArtifact, 'code')
    expect(unchanged).toBe('code')

    const changed = nextViewModeAfterArtifactChange(htmlArtifact, mermaidArtifact, 'code')
    expect(changed).toBe('preview')
  })
})
