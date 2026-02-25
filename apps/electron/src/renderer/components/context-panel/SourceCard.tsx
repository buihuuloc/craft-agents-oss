/**
 * SourceCard - Compact source info card for the ContextPanel.
 *
 * Displays source name, type badge, connection status, tool count,
 * description, and action buttons in a compact card format.
 */

import { useEffect, useState, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { RefreshCw, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { deriveConnectionStatus } from '@/components/ui/source-status-indicator'
import { sourcesAtom } from '@/atoms/sources'
import { useAppShellContext } from '@/context/AppShellContext'
import type { SourceConnectionStatus } from '../../../shared/types'

interface SourceCardProps {
  sourceSlug: string
}

/** Human-readable labels for source types */
const TYPE_LABELS: Record<string, string> = {
  mcp: 'MCP',
  api: 'API',
  local: 'Local',
  gmail: 'Gmail',
}

/** Status label text */
const STATUS_LABELS: Record<SourceConnectionStatus, string> = {
  connected: 'Connected',
  needs_auth: 'Needs Auth',
  failed: 'Disconnected',
  untested: 'Not Tested',
  local_disabled: 'Disabled',
}

export function SourceCard({ sourceSlug }: SourceCardProps) {
  const sources = useAtomValue(sourcesAtom)
  const { activeWorkspaceId } = useAppShellContext()
  const [mcpToolCount, setMcpToolCount] = useState<number | null>(null)
  const [mcpToolsLoading, setMcpToolsLoading] = useState(false)

  // Find source from atom
  const source = useMemo(
    () => sources.find((s) => s.config.slug === sourceSlug) ?? null,
    [sources, sourceSlug],
  )

  // Load MCP tool count
  useEffect(() => {
    if (!source || source.config.type !== 'mcp' || !activeWorkspaceId) {
      setMcpToolCount(null)
      return
    }

    let cancelled = false
    setMcpToolsLoading(true)

    window.electronAPI
      .getMcpTools(activeWorkspaceId, sourceSlug)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.tools) {
          setMcpToolCount(result.tools.length)
        }
      })
      .catch(() => {
        // Silently ignore -- not critical for card display
      })
      .finally(() => {
        if (!cancelled) setMcpToolsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [source, activeWorkspaceId, sourceSlug])

  // Derive connection status
  const connectionStatus = useMemo(
    () => (source ? deriveConnectionStatus(source) : 'untested'),
    [source],
  )

  if (!source) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Source not found
      </div>
    )
  }

  const typeLabel = TYPE_LABELS[source.config.type] ?? source.config.type.toUpperCase()
  const statusLabel = STATUS_LABELS[connectionStatus]
  const isConnected = connectionStatus === 'connected'

  return (
    <div className="flex flex-col gap-4">
      {/* Header: Avatar + Name + Type badge */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0">
          <SourceAvatar source={source} size="lg" showStatus />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold truncate">
              {source.config.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {typeLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            isConnected
              ? 'bg-success'
              : connectionStatus === 'failed'
                ? 'bg-destructive'
                : connectionStatus === 'needs_auth'
                  ? 'bg-info'
                  : 'bg-foreground/40'
          }`}
        />
        <span className="text-muted-foreground">{statusLabel}</span>
      </div>

      {/* Tool count (MCP sources only) */}
      {source.config.type === 'mcp' && (
        <div className="text-sm text-muted-foreground">
          {mcpToolsLoading
            ? 'Loading tools...'
            : mcpToolCount !== null
              ? `${mcpToolCount} tool${mcpToolCount !== 1 ? 's' : ''} available`
              : null}
        </div>
      )}

      {/* Tagline / description */}
      {source.config.tagline && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {source.config.tagline}
        </p>
      )}

      {/* Connection error */}
      {source.config.connectionError && (
        <div className="text-xs text-destructive bg-destructive/5 rounded-md px-3 py-2 border border-destructive/20">
          {source.config.connectionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {isConnected ? (
          <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled>
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled>
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
        )}
      </div>
    </div>
  )
}
