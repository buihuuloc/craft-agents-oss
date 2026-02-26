import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Command as CommandPrimitive } from 'cmdk'
import {
  Paperclip,
  ArrowUp,
  Square,
  Check,
  DatabaseZap,
} from 'lucide-react'

import * as storage from '@/lib/local-storage'
import { extractWorkspaceSlugFromPath } from '@craft-agent/shared/utils/workspace-slug'

import { Button } from '@/components/ui/button'
import {
  InlineSlashCommand,
  useInlineSlashCommand,
  type SlashCommandId,
} from '@/components/ui/slash-command-menu'
import {
  InlineMentionMenu,
  useInlineMention,
  type MentionItem,
} from '@/components/ui/mention-menu'
import {
  InlineLabelMenu,
  useInlineLabelMenu,
} from '@/components/ui/label-menu'
import { RichTextInput, type RichTextInputHandle } from '@/components/ui/rich-text-input'
import { cn } from '@/lib/utils'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { AttachmentPreview } from '../AttachmentPreview'
import { useOptionalAppShellContext } from '@/context/AppShellContext'
import { useEscapeInterrupt } from '@/context/EscapeInterruptContext'
import { EscapeInterruptOverlay } from './EscapeInterruptOverlay'
import { FreeFormInputContextBadge } from './FreeFormInputContextBadge'
import { WorkingDirectoryBadge } from './WorkingDirectoryBadge'
import { ModelSelector, ContextUsageWarningBadge } from './ModelSelector'
import { useInputHandlers } from './useInputHandlers'
import { DEFAULT_PLACEHOLDERS, getRecentDirs, addRecentDir } from './free-form-input-utils'

// Re-export types for external consumers
export type { FreeFormInputProps } from './free-form-input-types'
import type { FreeFormInputProps } from './free-form-input-types'

/**
 * FreeFormInput - Self-contained textarea input with attachments and controls
 *
 * Features:
 * - Auto-growing textarea
 * - File attachments via button or drag-drop
 * - Slash commands menu
 * - Model selector
 * - Active option badges
 */
export function FreeFormInput({
  placeholder = DEFAULT_PLACEHOLDERS,
  disabled = false,
  isProcessing = false,
  onSubmit,
  onStop,
  inputRef: externalInputRef,
  currentModel,
  onModelChange,
  thinkingLevel = 'think',
  onThinkingLevelChange,
  ultrathinkEnabled = false,
  onUltrathinkChange,
  permissionMode = 'ask',
  onPermissionModeChange,
  enabledModes = ['safe', 'ask', 'allow-all'],
  inputValue,
  onInputChange,
  unstyled = false,
  onHeightChange,
  onFocusChange,
  sources = [],
  enabledSourceSlugs = [],
  onSourcesChange,
  skills = [],
  labels = [],
  sessionLabels = [],
  onLabelAdd,
  workspaceId,
  workingDirectory,
  onWorkingDirectoryChange,
  sessionFolderPath,
  sessionId,
  currentSessionStatus,
  disableSend = false,
  isEmptySession = false,
  contextStatus,
  compactMode = false,
  currentConnection,
  onConnectionChange,
  connectionUnavailable = false,
}: FreeFormInputProps) {
  // Read connection default model, connections, and workspace info from context.
  const appShellCtx = useOptionalAppShellContext()
  const llmConnections = appShellCtx?.llmConnections ?? []
  const workspaceDefaultConnection = appShellCtx?.workspaceDefaultLlmConnection

  // Access sessionStatuses and onSessionStatusChange from context for the # menu state picker
  const sessionStatuses = appShellCtx?.sessionStatuses ?? []
  const onSessionStatusChange = appShellCtx?.onSessionStatusChange

  // Resolve workspace rootPath for "Add New Label" deep link
  const workspaceRootPath = React.useMemo(() => {
    if (!appShellCtx || !workspaceId) return null
    return appShellCtx.workspaces.find(w => w.id === workspaceId)?.rootPath ?? null
  }, [appShellCtx, workspaceId])

  // Compute workspace slug from rootPath for SDK skill qualification
  const workspaceSlug = React.useMemo(() => {
    if (!workspaceRootPath) return workspaceId
    return extractWorkspaceSlugFromPath(workspaceRootPath, workspaceId ?? '')
  }, [workspaceRootPath, workspaceId])

  // Optimistic state for source selection
  const [optimisticSourceSlugs, setOptimisticSourceSlugs] = React.useState(enabledSourceSlugs)

  // Sync from prop when server state changes
  const prevEnabledSourceSlugsRef = React.useRef(enabledSourceSlugs)
  React.useEffect(() => {
    const prev = prevEnabledSourceSlugsRef.current
    const changed = enabledSourceSlugs.length !== prev.length ||
      enabledSourceSlugs.some((slug, i) => slug !== prev[i])

    if (changed) {
      setOptimisticSourceSlugs(enabledSourceSlugs)
      prevEnabledSourceSlugsRef.current = enabledSourceSlugs
    }
  }, [enabledSourceSlugs])

  const [isFocused, setIsFocused] = React.useState(false)
  const [inputMaxHeight, setInputMaxHeight] = React.useState(540)
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false)
  const [sourceDropdownOpen, setSourceDropdownOpen] = React.useState(false)
  const [sourceFilter, setSourceFilter] = React.useState('')

  // Input settings (loaded from config)
  const [autoCapitalisation, setAutoCapitalisation] = React.useState(true)
  const [sendMessageKey, setSendMessageKey] = React.useState<'enter' | 'cmd-enter'>('enter')
  const [spellCheck, setSpellCheck] = React.useState(false)

  // Load input settings on mount
  React.useEffect(() => {
    const loadInputSettings = async () => {
      if (!window.electronAPI) return
      try {
        const [autoCapEnabled, sendKey, spellCheckEnabled] = await Promise.all([
          window.electronAPI.getAutoCapitalisation(),
          window.electronAPI.getSendMessageKey(),
          window.electronAPI.getSpellCheck(),
        ])
        setAutoCapitalisation(autoCapEnabled)
        setSendMessageKey(sendKey ?? 'enter')
        setSpellCheck(spellCheckEnabled)
      } catch (error) {
        console.error('Failed to load input settings:', error)
      }
    }
    loadInputSettings()
  }, [])

  // Double-Esc interrupt
  const { showEscapeOverlay } = useEscapeInterrupt()

  // Calculate max height: min(66% of window height, 540px)
  React.useEffect(() => {
    const updateMaxHeight = () => {
      const maxFromWindow = Math.floor(window.innerHeight * 0.66)
      setInputMaxHeight(Math.min(maxFromWindow, 540))
    }
    updateMaxHeight()
    window.addEventListener('resize', updateMaxHeight)
    return () => window.removeEventListener('resize', updateMaxHeight)
  }, [])

  const containerRef = React.useRef<HTMLDivElement>(null)
  const sourceButtonRef = React.useRef<HTMLButtonElement>(null)
  const sourceFilterInputRef = React.useRef<HTMLInputElement>(null)
  const [sourceDropdownPosition, setSourceDropdownPosition] = React.useState<{ top: number; left: number } | null>(null)

  // Merge refs for RichTextInput
  const internalInputRef = React.useRef<RichTextInputHandle>(null)
  const richInputRef = externalInputRef || internalInputRef

  // Home directory for slash menu and mention menu
  const [homeDir, setHomeDir] = React.useState<string>('')
  React.useEffect(() => {
    window.electronAPI?.getHomeDir?.().then((dir: string) => {
      if (dir) setHomeDir(dir)
    })
  }, [])

  // Recent folders state (used by both slash command hook and input handlers)
  const [recentFolders, setRecentFolders] = React.useState<string[]>([])
  React.useEffect(() => {
    setRecentFolders(getRecentDirs())
  }, [])

  // Build active commands list for slash command menu
  const activeCommands = React.useMemo(() => {
    const active: SlashCommandId[] = []
    if (permissionMode === 'safe') active.push('safe')
    else if (permissionMode === 'ask') active.push('ask')
    else if (permissionMode === 'allow-all') active.push('allow-all')
    if (ultrathinkEnabled) active.push('ultrathink')
    return active
  }, [permissionMode, ultrathinkEnabled])

  // Slash command callbacks - use refs to break circular dependency
  // (inlineSlash needs these, but they also reference inputHandlers which needs inlineSlash)
  const handleSlashCommandRef = React.useRef<(commandId: SlashCommandId) => void>(() => {})
  const handleSlashFolderSelectRef = React.useRef<(path: string) => void>(() => {})

  // Inline slash command hook
  const inlineSlash = useInlineSlashCommand({
    inputRef: richInputRef,
    onSelectCommand: (commandId: SlashCommandId) => {
      handleSlashCommandRef.current(commandId)
    },
    onSelectFolder: (path: string) => {
      handleSlashFolderSelectRef.current(path)
    },
    activeCommands,
    recentFolders,
    homeDir,
  })

  // Handle mention selection
  const handleMentionSelectForHook = React.useCallback((item: MentionItem) => {
    if (item.type === 'source' && item.source && onSourcesChange) {
      const slug = item.source.config.slug
      if (!optimisticSourceSlugs.includes(slug)) {
        const newSlugs = [...optimisticSourceSlugs, slug]
        setOptimisticSourceSlugs(newSlugs)
        onSourcesChange(newSlugs)
      }
    }
  }, [optimisticSourceSlugs, onSourcesChange])

  // Inline mention hook
  const inlineMention = useInlineMention({
    inputRef: richInputRef,
    skills,
    sources,
    basePath: workingDirectory,
    onSelect: handleMentionSelectForHook,
    workspaceId: workspaceSlug,
  })

  // Inline label menu hook
  const handleLabelSelectForHook = React.useCallback((labelId: string) => {
    onLabelAdd?.(labelId)
  }, [onLabelAdd])

  const inlineLabel = useInlineLabelMenu({
    inputRef: richInputRef,
    labels,
    sessionLabels,
    onSelect: handleLabelSelectForHook,
    sessionStatuses,
    activeStateId: currentSessionStatus,
  })

  // ─── Input Handlers Hook ────────────────────────────────────────────────────

  const inputHandlers = useInputHandlers({
    disabled,
    disableSend,
    isProcessing,
    inputValue,
    onInputChange,
    onSubmit,
    onStop,
    richInputRef,
    permissionMode,
    onPermissionModeChange,
    enabledModes,
    ultrathinkEnabled,
    onUltrathinkChange,
    onWorkingDirectoryChange,
    sources,
    skills,
    optimisticSourceSlugs,
    setOptimisticSourceSlugs,
    onSourcesChange,
    sessionId,
    onSessionStatusChange,
    autoCapitalisation,
    sendMessageKey,
    placeholder,
    homeDir,
    recentFolders,
    setRecentFolders,
    inlineSlash,
    inlineMention,
    inlineLabel,
  })

  const {
    input,
    setInput,
    attachments,
    loadingCount,
    isDraggingOver,
    hasContent,
    shuffledPlaceholder,
    handleSubmit,
    handleStop,
    handleKeyDown,
    handleInputChange,
    handleRichInput,
    handlePaste,
    handleLongTextPaste,
    handleAttachClick,
    handleRemoveAttachment,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleInlineSlashCommandSelect,
    handleInlineSlashFolderSelect,
    handleInlineMentionSelect,
    handleInlineLabelSelect,
    handleInlineStateSelect,
    syncToParent,
    lastCaretPositionRef,
  } = inputHandlers

  // Wire up refs for slash command callbacks (breaks circular dependency)
  handleSlashCommandRef.current = inputHandlers.handleSlashCommand
  handleSlashFolderSelectRef.current = inputHandlers.handleSlashFolderSelect

  // "Add New Label" handler
  const [addLabelPopoverOpen, setAddLabelPopoverOpen] = React.useState(false)
  const [addLabelPrefill, setAddLabelPrefill] = React.useState('')
  const handleAddLabel = React.useCallback((prefill: string) => {
    if (!workspaceRootPath) return

    const cleaned = inlineLabel.handleSelect('')
    setInput(cleaned)
    syncToParent(cleaned)
    inlineLabel.close()

    setAddLabelPrefill(prefill ? `Add new label ${prefill}` : '')
    setAddLabelPopoverOpen(true)
  }, [workspaceRootPath, inlineLabel, syncToParent])

  // Memoize the add-label config
  const addLabelEditConfig = React.useMemo(() => {
    if (!workspaceRootPath) return null
    return getEditConfig('add-label', workspaceRootPath)
  }, [workspaceRootPath])

  // Report height changes to parent
  React.useLayoutEffect(() => {
    if (!onHeightChange || !containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [onHeightChange])

  // In compact mode, immediately report collapsed height
  React.useEffect(() => {
    if (!onHeightChange || !compactMode) return
    if (isProcessing) {
      onHeightChange(44)
    }
  }, [compactMode, isProcessing, onHeightChange])

  return (
    <form onSubmit={handleSubmit}>
      <div
        ref={containerRef}
        className={cn(
          'overflow-hidden transition-all',
          !unstyled && 'rounded-[16px] shadow-middle',
          !unstyled && 'bg-background',
          isDraggingOver && 'ring-2 ring-foreground ring-offset-2 ring-offset-background bg-foreground/5'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Inline Slash Command Autocomplete */}
        <InlineSlashCommand
          open={inlineSlash.isOpen}
          onOpenChange={(open) => !open && inlineSlash.close()}
          sections={inlineSlash.sections}
          activeCommands={activeCommands}
          onSelectCommand={handleInlineSlashCommandSelect}
          onSelectFolder={handleInlineSlashFolderSelect}
          filter={inlineSlash.filter}
          position={inlineSlash.position}
        />

        {/* Inline Mention Autocomplete (skills, sources, files) */}
        <InlineMentionMenu
          open={inlineMention.isOpen}
          onOpenChange={(open) => !open && inlineMention.close()}
          sections={inlineMention.sections}
          onSelect={handleInlineMentionSelect}
          filter={inlineMention.filter}
          position={inlineMention.position}
          workspaceId={workspaceId}
          maxWidth={280}
          isSearching={inlineMention.isSearching}
        />

        {/* Inline Label & State Autocomplete (#labels / #states) */}
        <InlineLabelMenu
          open={inlineLabel.isOpen}
          onOpenChange={(open) => !open && inlineLabel.close()}
          items={inlineLabel.items}
          onSelect={handleInlineLabelSelect}
          onAddLabel={handleAddLabel}
          filter={inlineLabel.filter}
          position={inlineLabel.position}
          states={inlineLabel.states}
          activeStateId={inlineLabel.activeStateId}
          onSelectState={handleInlineStateSelect}
        />

        {/* Controlled EditPopover for "Add New Label" */}
        {addLabelEditConfig && (
          <EditPopover
            trigger={<span className="absolute top-0 left-0 w-0 h-0 overflow-hidden" />}
            open={addLabelPopoverOpen}
            onOpenChange={setAddLabelPopoverOpen}
            context={addLabelEditConfig.context}
            example={addLabelEditConfig.example}
            overridePlaceholder={addLabelEditConfig.overridePlaceholder}
            defaultValue={addLabelPrefill}
            model={addLabelEditConfig.model}
            systemPromptPreset={addLabelEditConfig.systemPromptPreset}
            secondaryAction={workspaceRootPath ? {
              label: 'Edit File',
              filePath: `${workspaceRootPath}/labels/config.json`,
            } : undefined}
            side="top"
            align="start"
          />
        )}

        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
          disabled={disabled}
          loadingCount={loadingCount}
        />

        {/* Rich Text Input with inline mention badges */}
        {!(compactMode && isProcessing) && (
        <RichTextInput
          ref={richInputRef}
          value={input}
          onChange={handleInputChange}
          onInput={handleRichInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onLongTextPaste={handleLongTextPaste}
          onFocus={() => { setIsFocused(true); onFocusChange?.(true) }}
          onBlur={() => {
            lastCaretPositionRef.current = richInputRef.current?.selectionStart ?? null
            setIsFocused(false)
            onFocusChange?.(false)
          }}
          placeholder={shuffledPlaceholder}
          disabled={disabled}
          skills={skills}
          sources={sources}
          workspaceId={workspaceSlug}
          className="pl-5 pr-4 pt-4 pb-3 overflow-y-auto min-h-[88px]"
          style={{ maxHeight: inputMaxHeight }}
          data-tutorial="chat-input"
          spellCheck={spellCheck}
        />
        )}

        {/* Bottom Row: Controls */}
        <div className="relative">
          {/* Escape interrupt overlay */}
          <EscapeInterruptOverlay isVisible={isProcessing && showEscapeOverlay} />

          <div className={cn("flex items-center gap-1 px-2 py-2", !compactMode && "border-t border-border/50")}>
          {/* Left side: Context badges */}
          {!compactMode && (
          <div className="flex items-center gap-1 min-w-32 shrink overflow-hidden">
          {/* 1. Attach Files Badge */}
          <FreeFormInputContextBadge
            icon={<Paperclip className="h-4 w-4" />}
            label={attachments.length > 0
              ? attachments.length === 1
                ? "1 file"
                : `${attachments.length} files`
              : "Attach Files"
            }
            isExpanded={isEmptySession}
            hasSelection={attachments.length > 0}
            showChevron={false}
            onClick={handleAttachClick}
            tooltip="Attach files"
            disabled={disabled}
          />

          {/* 2. Source Selector Badge */}
          {onSourcesChange && (
            <div className="relative shrink min-w-0 overflow-hidden">
              <FreeFormInputContextBadge
                buttonRef={sourceButtonRef}
                icon={
                  optimisticSourceSlugs.length === 0 ? (
                    <DatabaseZap className="h-4 w-4" />
                  ) : (
                    <div className="flex items-center -ml-0.5">
                      {(() => {
                        const enabledSources = sources.filter(s => optimisticSourceSlugs.includes(s.config.slug))
                        const displaySources = enabledSources.slice(0, 3)
                        const remainingCount = enabledSources.length - 3
                        return (
                          <>
                            {displaySources.map((source, index) => (
                              <div
                                key={source.config.slug}
                                className={cn("relative h-5 w-5 rounded-[4px] bg-background shadow-minimal flex items-center justify-center", index > 0 && "-ml-1")}
                                style={{ zIndex: index + 1 }}
                              >
                                <SourceAvatar source={source} size="xs" />
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <div
                                className="-ml-1 h-5 w-5 rounded-[4px] bg-background shadow-minimal flex items-center justify-center text-[8px] font-medium text-muted-foreground"
                                style={{ zIndex: displaySources.length + 1 }}
                              >
                                +{remainingCount}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )
                }
                label={
                  optimisticSourceSlugs.length === 0
                    ? "Choose Sources"
                    : (() => {
                        const enabledSources = sources.filter(s => optimisticSourceSlugs.includes(s.config.slug))
                        if (enabledSources.length === 1) return enabledSources[0].config.name
                        if (enabledSources.length === 2) return enabledSources.map(s => s.config.name).join(', ')
                        return `${enabledSources.length} sources`
                      })()
                }
                isExpanded={isEmptySession}
                hasSelection={optimisticSourceSlugs.length > 0}
                showChevron={true}
                isOpen={sourceDropdownOpen}
                disabled={disabled}
                data-tutorial="source-selector-button"
                onClick={() => {
                  if (!sourceDropdownOpen && sourceButtonRef.current) {
                    const rect = sourceButtonRef.current.getBoundingClientRect()
                    setSourceDropdownPosition({
                      top: rect.top,
                      left: rect.left,
                    })
                    setTimeout(() => sourceFilterInputRef.current?.focus(), 0)
                  } else {
                    setSourceFilter('')
                  }
                  setSourceDropdownOpen(!sourceDropdownOpen)
                }}
                tooltip="Sources"
              />
              {sourceDropdownOpen && sourceDropdownPosition && ReactDOM.createPortal(
                <>
                  <div
                    className="fixed inset-0 z-floating-backdrop"
                    onClick={() => {
                      setSourceDropdownOpen(false)
                      setSourceFilter('')
                    }}
                  />
                  <div
                    className="fixed z-floating-menu min-w-[200px] overflow-hidden rounded-[8px] bg-background text-foreground shadow-modal-small"
                    style={{
                      top: sourceDropdownPosition.top - 8,
                      left: sourceDropdownPosition.left,
                      transform: 'translateY(-100%)',
                    }}
                  >
                    {sources.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-3 select-none">
                        No sources configured.
                        <br />
                        Add sources in Settings.
                      </div>
                    ) : (
                      <CommandPrimitive
                        className="min-w-[200px]"
                        shouldFilter={false}
                      >
                        <div className="border-b border-border/50 px-3 py-2">
                          <CommandPrimitive.Input
                            ref={sourceFilterInputRef}
                            value={sourceFilter}
                            onValueChange={setSourceFilter}
                            placeholder="Search sources..."
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground placeholder:select-none"
                          />
                        </div>
                        <CommandPrimitive.List className="max-h-[240px] overflow-y-auto p-1">
                          {sources
                            .filter(source => source.config.name.toLowerCase().includes(sourceFilter.toLowerCase()))
                            .map((source, index) => {
                              const isEnabled = optimisticSourceSlugs.includes(source.config.slug)
                              return (
                                <CommandPrimitive.Item
                                  key={source.config.slug}
                                  value={source.config.slug}
                                  data-tutorial={index === 0 ? "source-dropdown-item-first" : undefined}
                                  onSelect={() => {
                                    const newSlugs = isEnabled
                                      ? optimisticSourceSlugs.filter(slug => slug !== source.config.slug)
                                      : [...optimisticSourceSlugs, source.config.slug]
                                    setOptimisticSourceSlugs(newSlugs)
                                    onSourcesChange?.(newSlugs)
                                  }}
                                  className={cn(
                                    "flex cursor-pointer select-none items-center gap-3 rounded-[6px] px-3 py-2 text-[13px]",
                                    "outline-none data-[selected=true]:bg-foreground/5",
                                    isEnabled && "bg-foreground/3"
                                  )}
                                >
                                  <div className="shrink-0 text-muted-foreground flex items-center">
                                    <SourceAvatar
                                      source={source}
                                      size="sm"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0 truncate">{source.config.name}</div>
                                  <div className={cn(
                                    "shrink-0 h-4 w-4 rounded-full bg-current flex items-center justify-center",
                                    !isEnabled && "opacity-0"
                                  )}>
                                    <Check className="h-2.5 w-2.5 text-white dark:text-black" strokeWidth={3} />
                                  </div>
                                </CommandPrimitive.Item>
                              )
                            })}
                        </CommandPrimitive.List>
                      </CommandPrimitive>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>
          )}

          {/* 3. Working Directory Selector Badge */}
          {onWorkingDirectoryChange && (
            <WorkingDirectoryBadge
              workingDirectory={workingDirectory}
              onWorkingDirectoryChange={onWorkingDirectoryChange}
              sessionFolderPath={sessionFolderPath}
              isEmptySession={isEmptySession}
            />
          )}
          </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: Model + Send */}
          <div className="flex items-center shrink-0">
          {/* 5. Model/Connection Selector */}
          {!compactMode && (
            <ModelSelector
              currentModel={currentModel}
              onModelChange={onModelChange}
              thinkingLevel={thinkingLevel}
              onThinkingLevelChange={onThinkingLevelChange}
              isEmptySession={isEmptySession}
              isProcessing={isProcessing}
              currentConnection={currentConnection}
              onConnectionChange={onConnectionChange}
              connectionUnavailable={connectionUnavailable}
              contextStatus={contextStatus}
              onSubmit={onSubmit}
              llmConnections={llmConnections}
              workspaceDefaultLlmConnection={workspaceDefaultConnection}
              modelDropdownOpen={modelDropdownOpen}
              setModelDropdownOpen={setModelDropdownOpen}
            />
          )}

          {/* 5.5 Context Usage Warning Badge */}
          <ContextUsageWarningBadge
            contextStatus={contextStatus}
            currentModel={currentModel}
            isProcessing={isProcessing}
            onSubmit={onSubmit}
          />

          {/* 6. Send/Stop Button */}
          {isProcessing ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-7 w-7 rounded-full shrink-0 hover:bg-foreground/15 active:bg-foreground/20 ml-2"
              onClick={() => handleStop(false)}
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-7 w-7 rounded-full shrink-0 ml-2"
              disabled={!hasContent || disabled}
              data-tutorial="send-button"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
          </div>
          </div>
        </div>
      </div>
    </form>
  )
}
