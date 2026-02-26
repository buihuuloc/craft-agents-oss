import { useState, useMemo } from "react"
import { useActionLabel } from "@/actions"
import { formatDistanceToNow } from "date-fns"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { MoreHorizontal, Flag, Copy, Link2Off, CloudUpload, Globe, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { rendererPerf } from "@/lib/perf"
import { parseLabelEntry, formatLabelEntry, formatDisplayValue } from "@craft-agent/shared/labels"
import { resolveEntityColor } from "@craft-agent/shared/colors"
import { useTheme } from "@/context/ThemeContext"
import { Spinner, Tooltip, TooltipTrigger, TooltipContent } from "@craft-agent/ui"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SessionStatusMenu } from "@/components/ui/session-status-menu"
import { LabelValuePopover } from "@/components/ui/label-value-popover"
import { LabelValueTypeIcon } from "@/components/ui/label-icon"
import { getStateColor, getStateIcon, type SessionStatusId } from "@/config/session-status-config"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
} from "@/components/ui/styled-dropdown"
import {
  ContextMenu,
  ContextMenuTrigger,
  StyledContextMenuContent,
} from "@/components/ui/styled-context-menu"
import { DropdownMenuProvider, ContextMenuProvider } from "@/components/ui/menu-context"
import { SessionMenu } from "./SessionMenu"
import { BatchSessionMenu } from "./BatchSessionMenu"
import { ConnectionIcon } from "@/components/icons/ConnectionIcon"
import { useOptionalAppShellContext } from "@/context/AppShellContext"
import * as storage from "@/lib/local-storage"
import { PERMISSION_MODE_CONFIG } from "@craft-agent/shared/agent/modes"
import { getSessionTitle } from "@/utils/session"
import { getSessionSessionStatus, hasUnreadMessages, hasMessages, highlightMatch } from "./session-list-utils"
import type { SessionItemProps } from "./session-list-types"

/**
 * SessionItem - Individual session card with todo checkbox and dropdown menu
 * Tracks menu open state to keep "..." button visible
 */
export function SessionItem({
  item,
  index,
  itemProps,
  isSelected,
  isLast,
  isFirstInGroup,
  onKeyDown,
  onRenameClick,
  onSessionStatusChange,
  onFlag,
  onUnflag,
  onArchive,
  onUnarchive,
  onMarkUnread,
  onDelete,
  onSelect,
  onOpenInNewWindow,
  permissionMode,
  llmConnection,
  searchQuery,
  sessionStatuses,
  flatLabels,
  labels,
  onLabelsChange,
  chatMatchCount,
  isMultiSelectActive,
  isInMultiSelect,
  onToggleSelect,
  onRangeSelect,
  onFocusZone,
}: SessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [todoMenuOpen, setTodoMenuOpen] = useState(false)
  // Tracks which label badge's LabelValuePopover is open (by index), null = all closed
  const [openLabelIndex, setOpenLabelIndex] = useState<number | null>(null)

  // Get hotkey labels from centralized action registry
  const nextMatchHotkey = useActionLabel('chat.nextSearchMatch').hotkey
  const prevMatchHotkey = useActionLabel('chat.prevSearchMatch').hotkey

  // Get current todo state from session properties
  const currentSessionStatus = getSessionSessionStatus(item)

  // Resolve session label entries (e.g. "bug", "priority::3") to config + optional value
  const resolvedLabels = useMemo(() => {
    if (!item.labels || item.labels.length === 0 || flatLabels.length === 0) return []
    return item.labels
      .map(entry => {
        const parsed = parseLabelEntry(entry)
        const config = flatLabels.find(l => l.id === parsed.id)
        if (!config) return null
        return { config, rawValue: parsed.rawValue }
      })
      .filter((l): l is { config: import("@craft-agent/shared/labels").LabelConfig; rawValue: string | undefined } => l != null)
  }, [item.labels, flatLabels])


  // Theme context for resolving label colors (light/dark aware)
  const { isDark } = useTheme()

  // Get connection details for icon display (only when enabled and multiple connections exist)
  const appShellContext = useOptionalAppShellContext()
  const showConnectionIcons = storage.get(storage.KEYS.showConnectionIcons, true)
  const connectionDetails = useMemo(() => {
    if (!showConnectionIcons) return null
    if (!llmConnection || !appShellContext?.llmConnections) return null
    if (appShellContext.llmConnections.length <= 1) return null
    return appShellContext.llmConnections.find(c => c.slug === llmConnection) ?? null
  }, [showConnectionIcons, llmConnection, appShellContext?.llmConnections])

  const handleClick = (e: React.MouseEvent) => {
    // Always activate session-list zone for keyboard navigation (arrow keys, Cmd+A, etc.)
    onFocusZone?.()

    // Right-click: preserve multi-select, let context menu handle it
    if (e.button === 2) {
      if (isMultiSelectActive && !isInMultiSelect && onToggleSelect) {
        // Right-clicking an unselected item during multi-select: add it to selection
        onToggleSelect()
      }
      // Don't change selection — context menu will show batch or single actions
      return
    }

    // Handle multi-select modifier keys
    const isMetaKey = e.metaKey || e.ctrlKey // Cmd on Mac, Ctrl on Windows
    const isShiftKey = e.shiftKey

    if (isMetaKey && onToggleSelect) {
      // Cmd/Ctrl+click: toggle selection
      e.preventDefault()
      onToggleSelect()
      return
    }

    if (isShiftKey && onRangeSelect) {
      // Shift+click: range select
      e.preventDefault()
      onRangeSelect()
      return
    }

    // Normal click: single select
    // Start perf tracking for session switch
    rendererPerf.startSessionSwitch(item.id)
    onSelect()
  }

  const handleSessionStatusSelect = (state: SessionStatusId) => {
    setTodoMenuOpen(false)
    onSessionStatusChange(item.id, state)
  }

  const handleArchiveFromMenu = () => {
    setTodoMenuOpen(false)
    onArchive?.(item.id)
  }

  const handleUnarchiveFromMenu = () => {
    setTodoMenuOpen(false)
    onUnarchive?.(item.id)
  }

  return (
    <div
      className="session-item"
      data-selected={isSelected || undefined}
      data-session-id={item.id}
    >
      {/* Separator - only show if not first in group */}
      {!isFirstInGroup && (
        <div className="session-separator pl-12 pr-4">
          <Separator />
        </div>
      )}
      {/* Wrapper for button + dropdown + context menu, group for hover state */}
      <ContextMenu modal={true} onOpenChange={setContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <div className="session-content relative group select-none pl-2 mr-2">
        {/* Multi-select indicator bar */}
        {isInMultiSelect && (
          <div className="absolute left-0 inset-y-0 w-[2px] bg-accent" />
        )}
        {/* Todo State Icon - positioned absolutely, outside the button */}
        <Popover modal={true} open={todoMenuOpen} onOpenChange={setTodoMenuOpen}>
          <PopoverTrigger asChild>
            <div className="absolute left-4 top-3.5 z-10">
              <div
                className={cn(
                  "w-4 h-4 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                  "hover:bg-foreground/5",
                )}
                style={{ color: getStateColor(currentSessionStatus, sessionStatuses) ?? 'var(--foreground)' }}
                role="button"
                aria-haspopup="menu"
                aria-expanded={todoMenuOpen}
                aria-label="Change todo state"
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                <div className="w-4 h-4 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full [&>span]:text-base">
                  {getStateIcon(currentSessionStatus, sessionStatuses)}
                </div>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 border-0 shadow-none bg-transparent"
            align="start"
            side="bottom"
            sideOffset={4}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <SessionStatusMenu
              activeState={currentSessionStatus}
              onSelect={handleSessionStatusSelect}
              states={sessionStatuses}
              isArchived={item.isArchived}
              onArchive={handleArchiveFromMenu}
              onUnarchive={handleUnarchiveFromMenu}
            />
          </PopoverContent>
        </Popover>
        {/* Main content button */}
        <button
          {...itemProps}
          className={cn(
            "flex w-full items-start gap-2 pl-2 pr-4 py-3 text-left text-sm outline-none rounded-[8px]",
            // Fast hover transition (75ms vs default 150ms), selection is instant
            "transition-[background-color] duration-75",
            // Unified selection states: same color family, graduated intensity
            (isSelected || isInMultiSelect)
              ? "bg-foreground/3"
              : "hover:bg-foreground/2"
          )}
          // Handle all click logic in onMouseDown for proper modifier key handling
          onMouseDown={handleClick}
          onKeyDown={(e) => {
            itemProps.onKeyDown(e)
            onKeyDown(e, item)
          }}
        >
          {/* Spacer for todo icon */}
          <div className="w-4 h-5 shrink-0" />
          {/* Content column */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {/* Title - up to 2 lines, with shimmer during async operations (sharing, title regen, etc.) */}
            <div className="flex items-start gap-2 w-full pr-6 min-w-0">
              <div className={cn(
                "font-medium font-sans line-clamp-2 min-w-0 -mb-[2px]",
                item.isAsyncOperationOngoing && "animate-shimmer-text"
              )}>
                {searchQuery ? highlightMatch(getSessionTitle(item), searchQuery) : getSessionTitle(item)}
              </div>
            </div>
            {/* Subtitle row — badges scroll horizontally when they overflow */}
            <div className="flex items-center gap-1.5 text-xs text-foreground/70 w-full -mb-[2px] min-w-0">
              {/* Fixed indicators (Spinner + New) — always visible */}
              {item.isProcessing && (
                <Spinner className="text-[8px] text-foreground shrink-0" />
              )}
              {!item.isProcessing && hasUnreadMessages(item) && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent text-white">
                  New
                </span>
              )}

              {/* Scrollable badges container — horizontal scroll with hidden scrollbar,
                  right-edge gradient mask to hint at overflow */}
              <div
                className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-hide pr-4"
                style={{ maskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)' }}
              >
                {item.isFlagged && (
                  <span className="shrink-0 h-[18px] w-[18px] flex items-center justify-center rounded bg-foreground/5">
                    <Flag className="h-[10px] w-[10px] text-info fill-info" />
                  </span>
                )}
                {item.lastMessageRole === 'plan' && (
                  <span className="shrink-0 h-[18px] px-1.5 text-[10px] font-medium rounded bg-success/10 text-success flex items-center whitespace-nowrap">
                    Plan
                  </span>
                )}
                {connectionDetails && (
                  <ConnectionIcon connection={connectionDetails} size={14} showTooltip />
                )}
                {permissionMode && (
                  <span
                    className={cn(
                      "shrink-0 h-[18px] px-1.5 text-[10px] font-medium rounded flex items-center whitespace-nowrap",
                      permissionMode === 'safe' && "bg-foreground/5 text-foreground/60",
                      permissionMode === 'ask' && "bg-info/10 text-info",
                      permissionMode === 'allow-all' && "bg-accent/10 text-accent"
                    )}
                  >
                    {PERMISSION_MODE_CONFIG[permissionMode].shortName}
                  </span>
                )}
                {/* Label badges — each badge opens its own LabelValuePopover for
                    editing the value or removing the label. Uses onMouseDown +
                    stopPropagation to prevent parent <button> session selection. */}
                {resolvedLabels.map(({ config: label, rawValue }, labelIndex) => {
                  const color = label.color ? resolveEntityColor(label.color, isDark) : null
                  const displayValue = rawValue ? formatDisplayValue(rawValue, label.valueType) : undefined
                  return (
                    <LabelValuePopover
                      key={`${label.id}-${labelIndex}`}
                      label={label}
                      value={rawValue}
                      open={openLabelIndex === labelIndex}
                      onOpenChange={(open) => setOpenLabelIndex(open ? labelIndex : null)}
                      onValueChange={(newValue) => {
                        // Rebuild labels array with the updated value for this label
                        const updatedLabels = (item.labels || []).map(entry => {
                          const parsed = parseLabelEntry(entry)
                          if (parsed.id === label.id) {
                            return formatLabelEntry(label.id, newValue)
                          }
                          return entry
                        })
                        onLabelsChange?.(item.id, updatedLabels)
                      }}
                      onRemove={() => {
                        // Remove this label entry from the session
                        const updatedLabels = (item.labels || []).filter(entry => {
                          const parsed = parseLabelEntry(entry)
                          return parsed.id !== label.id
                        })
                        onLabelsChange?.(item.id, updatedLabels)
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="shrink-0 h-[18px] max-w-[120px] px-1.5 text-[10px] font-medium rounded flex items-center whitespace-nowrap gap-0.5 cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                        }}
                        style={color ? {
                          backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
                          color: `color-mix(in srgb, ${color} 75%, var(--foreground))`,
                        } : {
                          backgroundColor: 'rgba(var(--foreground-rgb), 0.05)',
                          color: 'rgba(var(--foreground-rgb), 0.8)',
                        }}
                      >
                        {label.name}
                        {/* Interpunct + value for typed labels, or placeholder icon if typed but no value set */}
                        {displayValue ? (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span className="font-normal truncate min-w-0" style={{ opacity: 0.75 }}>
                              {displayValue}
                            </span>
                          </>
                        ) : (
                          label.valueType && (
                            <>
                              <span style={{ opacity: 0.4 }}>·</span>
                              <LabelValueTypeIcon valueType={label.valueType} size={10} />
                            </>
                          )
                        )}
                      </div>
                    </LabelValuePopover>
                  )
                })}
                {item.sharedUrl && (
                  <DropdownMenu modal={true}>
                    <DropdownMenuTrigger asChild>
                      <span
                        className="shrink-0 h-[18px] w-[18px] flex items-center justify-center rounded bg-foreground/5 text-foreground/70 cursor-pointer hover:bg-foreground/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CloudUpload className="h-[10px] w-[10px]" />
                      </span>
                    </DropdownMenuTrigger>
                    <StyledDropdownMenuContent align="start">
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl(item.sharedUrl!)}>
                        <Globe />
                        Open in Browser
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuItem onClick={async () => {
                        await navigator.clipboard.writeText(item.sharedUrl!)
                        toast.success('Link copied to clipboard')
                      }}>
                        <Copy />
                        Copy Link
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuItem onClick={async () => {
                        const result = await window.electronAPI.sessionCommand(item.id, { type: 'updateShare' })
                        if (result && 'success' in result && result.success) {
                          toast.success('Share updated')
                        } else {
                          const errorMsg = result && 'error' in result ? result.error : undefined
                          toast.error('Failed to update share', { description: errorMsg })
                        }
                      }}>
                        <RefreshCw />
                        Update Share
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuSeparator />
                      <StyledDropdownMenuItem onClick={async () => {
                        const result = await window.electronAPI.sessionCommand(item.id, { type: 'revokeShare' })
                        if (result && 'success' in result && result.success) {
                          toast.success('Sharing stopped')
                        } else {
                          const errorMsg = result && 'error' in result ? result.error : undefined
                          toast.error('Failed to stop sharing', { description: errorMsg })
                        }
                      }} variant="destructive">
                        <Link2Off />
                        Stop Sharing
                      </StyledDropdownMenuItem>
                    </StyledDropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {/* Timestamp — outside stacking container so it never overlaps badges.
                  shrink-0 keeps it fixed-width; the badges container clips instead. */}
              {item.lastMessageAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-[11px] text-foreground/40 whitespace-nowrap cursor-default">
                      {formatRelativeTime(item.lastMessageAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    {formatDistanceToNow(new Date(item.lastMessageAt), { addSuffix: true })}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </button>

        {/* Match count badge - shown on right side for all items with matches */}
        {chatMatchCount != null && chatMatchCount > 0 && (
          <div className="absolute right-3 top-2 z-10">
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[24px] px-1 py-1 rounded-[6px] text-[10px] font-medium tabular-nums leading-tight whitespace-nowrap",
                isSelected
                  ? "bg-yellow-300/50 border border-yellow-500 text-yellow-900"
                  : "bg-yellow-300/10 border border-yellow-600/20 text-yellow-800"
              )}
              style={{ boxShadow: isSelected ? '0 1px 2px 0 rgba(234, 179, 8, 0.3)' : '0 1px 2px 0 rgba(133, 77, 14, 0.15)' }}
              title={`Matches found (${nextMatchHotkey} next, ${prevMatchHotkey} prev)`}
            >
              {chatMatchCount}
            </span>
          </div>
        )}

        {/* Action buttons - visible on hover or when menu is open, hidden when match badge is visible */}
        {!(chatMatchCount != null && chatMatchCount > 0) && (
        <div
          className={cn(
            "absolute right-2 top-2 transition-opacity z-10 flex items-center gap-1",
            menuOpen || contextMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {/* More menu */}
          <div className="flex items-center rounded-[8px] overflow-hidden border border-transparent hover:border-border/50">
            <DropdownMenu modal={true} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <div className="p-1.5 hover:bg-foreground/10 data-[state=open]:bg-foreground/10 cursor-pointer">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <StyledDropdownMenuContent align="end">
                <DropdownMenuProvider>
                  <SessionMenu
                    sessionId={item.id}
                    sessionName={getSessionTitle(item)}
                    isFlagged={item.isFlagged ?? false}
                    isArchived={item.isArchived ?? false}
                    sharedUrl={item.sharedUrl}
                    hasMessages={hasMessages(item)}
                    hasUnreadMessages={hasUnreadMessages(item)}
                    currentSessionStatus={currentSessionStatus}
                    sessionStatuses={sessionStatuses}
                    sessionLabels={item.labels ?? []}
                    labels={labels}
                    onLabelsChange={onLabelsChange ? (newLabels) => onLabelsChange(item.id, newLabels) : undefined}
                    onRename={() => onRenameClick(item.id, getSessionTitle(item))}
                    onFlag={() => onFlag?.(item.id)}
                    onUnflag={() => onUnflag?.(item.id)}
                    onArchive={() => onArchive?.(item.id)}
                    onUnarchive={() => onUnarchive?.(item.id)}
                    onMarkUnread={() => onMarkUnread(item.id)}
                    onSessionStatusChange={(state) => onSessionStatusChange(item.id, state)}
                    onOpenInNewWindow={onOpenInNewWindow}
                    onDelete={() => onDelete(item.id)}
                  />
                </DropdownMenuProvider>
              </StyledDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        )}
          </div>
        </ContextMenuTrigger>
        {/* Context menu - batch actions when multi-selecting, single-session menu otherwise */}
        <StyledContextMenuContent>
          <ContextMenuProvider>
            {isMultiSelectActive && isInMultiSelect ? (
              <BatchSessionMenu />
            ) : (
              <SessionMenu
                sessionId={item.id}
                sessionName={getSessionTitle(item)}
                isFlagged={item.isFlagged ?? false}
                isArchived={item.isArchived ?? false}
                sharedUrl={item.sharedUrl}
                hasMessages={hasMessages(item)}
                hasUnreadMessages={hasUnreadMessages(item)}
                currentSessionStatus={currentSessionStatus}
                sessionStatuses={sessionStatuses}
                sessionLabels={item.labels ?? []}
                labels={labels}
                onLabelsChange={onLabelsChange ? (newLabels) => onLabelsChange(item.id, newLabels) : undefined}
                onRename={() => onRenameClick(item.id, getSessionTitle(item))}
                onFlag={() => onFlag?.(item.id)}
                onUnflag={() => onUnflag?.(item.id)}
                onArchive={() => onArchive?.(item.id)}
                onUnarchive={() => onUnarchive?.(item.id)}
                onMarkUnread={() => onMarkUnread(item.id)}
                onSessionStatusChange={(state) => onSessionStatusChange(item.id, state)}
                onOpenInNewWindow={onOpenInNewWindow}
                onDelete={() => onDelete(item.id)}
              />
            )}
          </ContextMenuProvider>
        </StyledContextMenuContent>
      </ContextMenu>
    </div>
  )
}
