/**
 * ContentPreviewRenderer - Renders full content previews in the ContextPanel.
 *
 * Wraps the block components (MarkdownHtmlBlock, MarkdownMermaidBlock, MarkdownPdfBlock)
 * in a PlatformProvider that strips `onOpenArtifactPreview`, so they render in full
 * inline mode rather than as compact cards.
 *
 * Uses scoped CSS overrides to force the block components to fill the full panel height,
 * overriding their default 400px inline height constraints.
 */

import {
  PlatformProvider,
  usePlatform,
  MarkdownHtmlBlock,
  MarkdownMermaidBlock,
  MarkdownPdfBlock,
} from '@craft-agent/ui'

interface ContentPreviewRendererProps {
  contentType: 'html' | 'mermaid' | 'pdf'
  code: string
}

export function ContentPreviewRenderer({ contentType, code }: ContentPreviewRendererProps) {
  const platformActions = usePlatform()

  // Strip onOpenArtifactPreview so block components render full preview, not compact cards
  const { onOpenArtifactPreview: _, ...actionsWithoutArtifact } = platformActions

  return (
    <PlatformProvider actions={actionsWithoutArtifact}>
      {/* Scoped style overrides — !important needed to beat inline styles on iframes */}
      <style>{`
        .content-preview-full-height {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .content-preview-full-height > div {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .content-preview-full-height .relative.group {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-radius: 0;
          border: none;
          background: transparent;
        }
        .content-preview-full-height .relative.overflow-hidden {
          max-height: none !important;
          height: auto !important;
          flex: 1;
          overflow: auto !important;
        }
        .content-preview-full-height iframe {
          height: 100% !important;
          min-height: 100% !important;
        }
      `}</style>
      <div className="content-preview-full-height">
        {contentType === 'html' && <MarkdownHtmlBlock code={code} />}
        {contentType === 'mermaid' && <MarkdownMermaidBlock code={code} />}
        {contentType === 'pdf' && <MarkdownPdfBlock code={code} />}
      </div>
    </PlatformProvider>
  )
}
