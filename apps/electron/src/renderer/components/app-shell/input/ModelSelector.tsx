import * as React from 'react'
import {
  Check,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'

import * as storage from '@/lib/local-storage'
import { Tooltip, TooltipContent, TooltipTrigger } from '@craft-agent/ui'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuSub,
} from '@/components/ui/dropdown-menu'
import {
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubTrigger,
  StyledDropdownMenuSubContent,
} from '@/components/ui/styled-dropdown'
import { cn } from '@/lib/utils'
import { ANTHROPIC_MODELS, getModelShortName, getModelDisplayName, getModelContextWindow, isCodexModel, isCopilotModel } from '@config/models'
import { resolveEffectiveConnectionSlug, isCompatProvider } from '@config/llm-connections'
import { ConnectionIcon } from '@/components/icons/ConnectionIcon'
import { type ThinkingLevel, THINKING_LEVELS, getThinkingLevelName } from '@craft-agent/shared/agent/thinking-levels'
import { formatTokenCount } from './free-form-input-utils'

import type { LlmConnectionWithStatus } from '../../../../shared/types'
import type { FileAttachment } from '../../../../shared/types'

export interface ModelSelectorProps {
  currentModel: string
  onModelChange: (model: string, connection?: string) => void
  thinkingLevel: ThinkingLevel
  onThinkingLevelChange?: (level: ThinkingLevel) => void
  isEmptySession: boolean
  isProcessing: boolean
  currentConnection?: string
  onConnectionChange?: (connectionSlug: string) => void
  connectionUnavailable: boolean
  contextStatus?: {
    isCompacting?: boolean
    inputTokens?: number
    contextWindow?: number
  }
  onSubmit: (message: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
  // From AppShellContext
  llmConnections: LlmConnectionWithStatus[]
  workspaceDefaultLlmConnection?: string
  // Dropdown state
  modelDropdownOpen: boolean
  setModelDropdownOpen: (open: boolean) => void
}

export function ModelSelector({
  currentModel,
  onModelChange,
  thinkingLevel,
  onThinkingLevelChange,
  isEmptySession,
  isProcessing,
  currentConnection,
  onConnectionChange,
  connectionUnavailable,
  contextStatus,
  onSubmit,
  llmConnections,
  workspaceDefaultLlmConnection,
  modelDropdownOpen,
  setModelDropdownOpen,
}: ModelSelectorProps) {
  // Derive connectionDefaultModel per-session from the effective connection.
  const connectionDefaultModel = React.useMemo(() => {
    const effectiveSlug = resolveEffectiveConnectionSlug(currentConnection, workspaceDefaultLlmConnection, llmConnections)
    const conn = llmConnections.find(c => c.slug === effectiveSlug)
    if (!conn) return null
    if (!isCompatProvider(conn.providerType)) return null
    if (conn.models && conn.models.length > 1) return null
    return conn.defaultModel ?? null
  }, [currentConnection, workspaceDefaultLlmConnection, llmConnections])

  // Compute available models from the effective connection.
  const availableModels = React.useMemo(() => {
    if (connectionUnavailable) return []
    const effectiveSlug = resolveEffectiveConnectionSlug(currentConnection, workspaceDefaultLlmConnection, llmConnections)
    const connection = llmConnections.find(c => c.slug === effectiveSlug)
    if (!connection) {
      return ANTHROPIC_MODELS
    }
    return connection.models || ANTHROPIC_MODELS
  }, [llmConnections, currentConnection, workspaceDefaultLlmConnection, connectionUnavailable])

  const availableThinkingLevels = THINKING_LEVELS

  // Disable thinking selector when the current model explicitly doesn't support it
  const thinkingDisabled = React.useMemo(() => {
    const model = availableModels.find(m => typeof m !== 'string' && m.id === currentModel)
    return typeof model !== 'string' && model?.supportsThinking === false
  }, [availableModels, currentModel])

  // Get display name for current model
  const currentModelDisplayName = React.useMemo(() => {
    const modelToDisplay = connectionDefaultModel ?? currentModel
    const model = availableModels.find(m =>
      typeof m === 'string' ? m === modelToDisplay : m.id === modelToDisplay
    )
    if (!model) {
      return getModelDisplayName(modelToDisplay)
    }
    return typeof model === 'string' ? model : model.name
  }, [availableModels, currentModel, connectionDefaultModel])

  // Group connections by provider type for hierarchical dropdown
  const connectionsByProvider = React.useMemo(() => {
    const groups: Record<string, typeof llmConnections> = {
      'Anthropic': [],
      'OpenAI': [],
      'GitHub Copilot': [],
    }
    for (const conn of llmConnections) {
      const provider = conn.providerType || 'anthropic'
      if (provider === 'anthropic' || provider === 'anthropic_compat' || provider === 'bedrock' || provider === 'vertex') {
        groups['Anthropic'].push(conn)
      } else if (provider === 'openai' || provider === 'openai_compat') {
        groups['OpenAI'].push(conn)
      } else if (provider === 'copilot') {
        groups['GitHub Copilot'].push(conn)
      }
    }
    return Object.entries(groups).filter(([, conns]) => conns.length > 0)
  }, [llmConnections])

  // Find current connection details for display
  const currentConnectionDetails = React.useMemo(() => {
    if (!currentConnection) return null
    return llmConnections.find(c => c.slug === currentConnection) ?? null
  }, [llmConnections, currentConnection])

  // Effective connection: canonical fallback chain
  const effectiveConnection = resolveEffectiveConnectionSlug(currentConnection, workspaceDefaultLlmConnection, llmConnections)

  // Effective connection details for model list
  const effectiveConnectionDetails = React.useMemo(() => {
    if (!effectiveConnection) return null
    return llmConnections.find(c => c.slug === effectiveConnection) ?? null
  }, [llmConnections, effectiveConnection])

  return (
    <DropdownMenu open={modelDropdownOpen} onOpenChange={setModelDropdownOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center h-7 px-1.5 gap-0.5 text-[13px] shrink-0 rounded-[6px] hover:bg-foreground/5 transition-colors select-none",
                modelDropdownOpen && "bg-foreground/5",
                connectionUnavailable && "text-destructive",
              )}
            >
              {connectionUnavailable ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Unavailable
                </>
              ) : (
                <>
                  {effectiveConnectionDetails && llmConnections.length > 1 && storage.get(storage.KEYS.showConnectionIcons, true) && <ConnectionIcon connection={effectiveConnectionDetails} size={14} showTooltip />}
                  {currentModelDisplayName}
                  {!connectionDefaultModel && <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
Model
        </TooltipContent>
      </Tooltip>
      <StyledDropdownMenuContent side="top" align="end" sideOffset={8} className="min-w-[260px]">
        {/* Connection unavailable message */}
        {connectionUnavailable ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <div className="font-medium text-sm mb-1">Connection Unavailable</div>
            <div className="text-xs text-muted-foreground">
              The connection used by this session has been removed. Create a new session to continue.
            </div>
          </div>
        ) : connectionDefaultModel ? (
          <StyledDropdownMenuItem
            disabled
            className="flex items-center justify-between px-2 py-2 rounded-lg"
          >
            <div className="text-left">
              <div className="font-medium text-sm">{connectionDefaultModel}</div>
              <div className="text-xs text-muted-foreground">Connection default</div>
            </div>
            <Check className="h-3 w-3 text-foreground shrink-0 ml-3" />
          </StyledDropdownMenuItem>
        ) : isEmptySession && llmConnections.length > 1 ? (
          /* Hierarchical view: Provider -> Connection -> Models */
          connectionsByProvider.map(([providerName, connections], index) => (
            <React.Fragment key={providerName}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide select-none">
                {providerName}
              </div>
              {connections.map((conn) => {
                const isCurrentConnection = effectiveConnection === conn.slug
                const isAuthenticated = conn.isAuthenticated
                return (
                  <DropdownMenuSub key={conn.slug}>
                    <StyledDropdownMenuSubTrigger
                      disabled={!isAuthenticated}
                      className={cn(
                        "flex items-center justify-between px-2 py-2 rounded-lg",
                        isCurrentConnection && "bg-foreground/5"
                      )}
                    >
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <ConnectionIcon connection={conn} size={14} />
                          {conn.name}
                          {isCurrentConnection && <Check className="h-3 w-3 text-foreground" />}
                        </div>
                        {!isAuthenticated && (
                          <div className="text-xs text-muted-foreground">Not authenticated</div>
                        )}
                      </div>
                    </StyledDropdownMenuSubTrigger>
                    {isAuthenticated && (
                      <StyledDropdownMenuSubContent className="min-w-[220px]">
                        {(conn.models || ANTHROPIC_MODELS).map((model) => {
                          const modelId = typeof model === 'string' ? model : model.id
                          const modelName = typeof model === 'string' ? getModelShortName(model) : model.name
                          const isSelectedModel = isCurrentConnection && currentModel === modelId
                          return (
                            <StyledDropdownMenuItem
                              key={modelId}
                              onSelect={() => {
                                if (!isCurrentConnection && onConnectionChange) {
                                  onConnectionChange(conn.slug)
                                }
                                onModelChange(modelId, conn.slug)
                              }}
                              className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                            >
                              <div className="font-medium text-sm">{modelName}</div>
                              {isSelectedModel && (
                                <Check className="h-3 w-3 text-foreground shrink-0 ml-3" />
                              )}
                            </StyledDropdownMenuItem>
                          )
                        })}
                      </StyledDropdownMenuSubContent>
                    )}
                  </DropdownMenuSub>
                )
              })}
              {index < connectionsByProvider.length - 1 && (
                <StyledDropdownMenuSeparator className="my-1" />
              )}
            </React.Fragment>
          ))
        ) : (
          /* Flat model list (single connection or session started) */
          <>
            {!isEmptySession && currentConnectionDetails && llmConnections.length > 1 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs select-none text-muted-foreground">
                  <span>Using {currentConnectionDetails.name}</span>
                </div>
                <StyledDropdownMenuSeparator className="my-1" />
              </>
            )}
            {availableModels.map((model) => {
              const modelId = typeof model === 'string' ? model : model.id
              const modelName = typeof model === 'string' ? getModelShortName(model) : model.name
              const isSelected = currentModel === modelId
              const description = typeof model !== 'string' && 'description' in model ? (model.description as string) : ''
              return (
                <StyledDropdownMenuItem
                  key={modelId}
                  onSelect={() => onModelChange(modelId, effectiveConnection)}
                  className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                >
                  <div className="text-left">
                    <div className="font-medium text-sm">{modelName}</div>
                    {description && (
                      <div className="text-xs text-muted-foreground">{description}</div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-3 w-3 text-foreground shrink-0 ml-3" />
                  )}
                </StyledDropdownMenuItem>
              )
            })}
          </>
        )}

        {/* Thinking level selector */}
        {availableThinkingLevels.length > 0 && (
          <>
            <StyledDropdownMenuSeparator className="my-1" />

            <DropdownMenuSub>
              <StyledDropdownMenuSubTrigger disabled={thinkingDisabled} className={cn("flex items-center justify-between px-2 py-2 rounded-lg", thinkingDisabled && "opacity-50 cursor-not-allowed")}>
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">{getThinkingLevelName(thinkingLevel)}</div>
                  <div className="text-xs text-muted-foreground">{thinkingDisabled ? 'Not supported by this model' : 'Extended reasoning depth'}</div>
                </div>
              </StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent className="min-w-[220px]">
                {availableThinkingLevels.map(({ id, name, description }) => {
                  const isSelected = thinkingLevel === id
                  return (
                    <StyledDropdownMenuItem
                      key={id}
                      onSelect={() => onThinkingLevelChange?.(id)}
                      className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer"
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm">{name}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                      {isSelected && (
                        <Check className="h-3 w-3 text-foreground shrink-0 ml-3" />
                      )}
                    </StyledDropdownMenuItem>
                  )
                })}
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {/* Context usage footer */}
        {contextStatus?.inputTokens != null && contextStatus.inputTokens > 0 && (
          <>
            <StyledDropdownMenuSeparator className="my-1" />
            <div className="px-2 py-1.5 select-none">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Context</span>
                <span className="flex items-center gap-1.5">
                  {contextStatus.isCompacting && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {formatTokenCount(contextStatus.inputTokens)} tokens used
                </span>
              </div>
            </div>
          </>
        )}
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * ContextUsageWarningBadge - Shows when approaching auto-compaction threshold
 */
export function ContextUsageWarningBadge({
  contextStatus,
  currentModel,
  isProcessing,
  onSubmit,
}: {
  contextStatus?: {
    isCompacting?: boolean
    inputTokens?: number
    contextWindow?: number
  }
  currentModel: string
  isProcessing: boolean
  onSubmit: (message: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
}) {
  // Calculate usage percentage based on compaction threshold (~77.5% of context window)
  const effectiveContextWindow = contextStatus?.contextWindow || getModelContextWindow(currentModel)
  const compactionThreshold = effectiveContextWindow
    ? Math.round(effectiveContextWindow * 0.775)
    : null
  const usagePercent = contextStatus?.inputTokens && compactionThreshold
    ? Math.min(99, Math.round((contextStatus.inputTokens / compactionThreshold) * 100))
    : null
  // Show badge when >= 80% of compaction threshold AND not currently compacting
  // Hide for Codex and Copilot models which don't support context compaction
  const showWarning = usagePercent !== null && usagePercent >= 80 && !contextStatus?.isCompacting && !isCodexModel(currentModel) && !isCopilotModel(currentModel)

  if (!showWarning) return null

  const handleCompactClick = () => {
    if (!isProcessing) {
      onSubmit('/compact', [])
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCompactClick}
          disabled={isProcessing}
          className="inline-flex items-center h-6 px-2 text-[12px] font-medium bg-info/10 rounded-[6px] shadow-tinted select-none cursor-pointer hover:bg-info/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            '--shadow-color': 'var(--info-rgb)',
            color: 'color-mix(in oklab, var(--info) 30%, var(--foreground))',
          } as React.CSSProperties}
        >
          {usagePercent}%
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isProcessing
          ? `${usagePercent}% context used \u2014 wait for current operation`
          : `${usagePercent}% context used \u2014 click to compact`
        }
      </TooltipContent>
    </Tooltip>
  )
}
