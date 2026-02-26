import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useAction } from "@/actions"
import { Inbox, Archive } from "lucide-react"
import { toast } from "sonner"

import { flattenLabels } from "@craft-agent/shared/labels"
import { Spinner } from "@craft-agent/ui"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import type { SessionStatusId } from "@/config/session-status-config"
import { SessionSearchHeader } from "./SessionSearchHeader"
import { useSessionSelection } from "@/hooks/useSession"
import { useFocusZone, useRovingTabIndex } from "@/hooks/keyboard"
import { useEscapeInterrupt } from "@/context/EscapeInterruptContext"
import { useNavigation, useNavigationState, routes, isSessionsNavigation } from "@/contexts/NavigationContext"
import { useFocusContext } from "@/context/FocusContext"
import { RenameDialog } from "@/components/ui/rename-dialog"
import type { SessionMeta } from "@/atoms/sessions"

import { SessionItem } from "./SessionItem"
import { SessionListSectionHeader } from "./SessionListSectionHeader"
import { useSessionListFiltering } from "./useSessionListFiltering"
import type { SessionListProps } from "./session-list-types"

// Re-export SessionStatusId for use by parent components
export type { SessionStatusId }

/**
 * SessionList - Scrollable list of session cards with keyboard navigation
 *
 * Keyboard shortcuts:
 * - Arrow Up/Down: Navigate and select sessions (immediate selection)
 * - Arrow Left/Right: Navigate between zones
 * - Enter: Focus chat input
 * - Home/End: Jump to first/last session
 */
export function SessionList({
  items,
  onDelete,
  onFlag,
  onUnflag,
  onArchive,
  onUnarchive,
  onMarkUnread,
  onSessionStatusChange,
  onRename,
  onFocusChatInput,
  onSessionSelect,
  onOpenInNewWindow,
  onNavigateToView,
  sessionOptions,
  searchActive,
  searchQuery = '',
  onSearchChange,
  onSearchClose,
  sessionStatuses = [],
  evaluateViews,
  labels = [],
  onLabelsChange,
  workspaceId,
  statusFilter,
  labelFilterMap,
}: SessionListProps) {
  const {
    state: selectionState,
    select: selectSession,
    toggle: toggleSession,
    selectRange,
    selectAll: selectAllSessions,
    clearMultiSelect,
    isMultiSelectActive,
    isSelected: isSessionSelected,
  } = useSessionSelection()
  const { navigate, navigateToSession } = useNavigation()
  const navState = useNavigationState()
  const { showEscapeOverlay } = useEscapeInterrupt()

  // Pre-flatten label tree once for efficient ID lookups in each SessionItem
  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  // Get current filter from navigation state (for preserving context in tab routes)
  const currentFilter = isSessionsNavigation(navState) ? navState.filter : undefined

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Track if search input has actual DOM focus (for proper keyboard navigation gating)
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false)

  // Use the extracted filtering hook
  const {
    matchingFilterItems,
    otherResultItems,
    exceededSearchLimit,
    dateGroups,
    flatItems,
    sessionIndexMap,
    hasMore,
    loadMore,
    sentinelRef,
    isSearchMode,
    highlightQuery,
    contentSearchResults,
    isSearchingContent,
  } = useSessionListFiltering({
    items,
    searchActive,
    searchQuery,
    currentFilter,
    evaluateViews,
    workspaceId,
    statusFilter,
    labelFilterMap,
  })

  // Focus search input when search becomes active
  useEffect(() => {
    if (searchActive) {
      searchInputRef.current?.focus()
    }
  }, [searchActive])

  // Find initial index based on selected session
  const selectedIndex = flatItems.findIndex(item => item.id === selectionState.selected)

  // Focus zone management
  const { focusZone } = useFocusContext()

  // Register as focus zone
  // shouldMoveDOMFocus is true only when zone was activated via keyboard (not click or data change)
  const { zoneRef, isFocused, shouldMoveDOMFocus } = useFocusZone({ zoneId: 'session-list' })

  // Handle keyboard navigation (arrow keys) - scrolls into view and selects
  // Arrow key during multi-select exits multi-select and navigates (provides keyboard escape hatch)
  const handleNavigate = useCallback((item: SessionMeta, index: number) => {
    // Scroll the item into view
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-session-id="${item.id}"]`)
      element?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    })

    // Exit multi-select on plain arrow navigation (provides keyboard escape hatch)
    if (isMultiSelectActive) {
      clearMultiSelect()
    }

    // Select the session and navigate (preserves filter context)
    selectSession(item.id, index)
    navigateToSession(item.id)
  }, [isMultiSelectActive, clearMultiSelect, selectSession, navigateToSession])

  // Handle click selection - selects the item and navigates to it
  const handleSelectSession = useCallback((item: SessionMeta, index: number) => {
    selectSession(item.id, index)
    navigateToSession(item.id)
  }, [selectSession, navigateToSession])

  // Handle toggle select (cmd/ctrl+click)
  const handleToggleSelect = useCallback((item: SessionMeta, index: number) => {
    // Activate zone for keyboard shortcuts, but don't steal DOM focus from chat input
    focusZone('session-list', { intent: 'click', moveFocus: false })
    toggleSession(item.id, index)
  }, [focusZone, toggleSession])

  // Handle range select (shift+click or shift+arrow)
  // No navigation - MultiSelectPanel shows automatically via isMultiSelectActive
  const handleRangeSelect = useCallback((toIndex: number) => {
    // Activate zone for keyboard shortcuts, but don't steal DOM focus from chat input
    focusZone('session-list', { intent: 'click', moveFocus: false })
    const allIds = flatItems.map(i => i.id)
    selectRange(toIndex, allIds)
  }, [focusZone, flatItems, selectRange])

  // NOTE: We intentionally do NOT auto-select sessions while typing in search.
  // Auto-selecting causes: 1) ChatDisplay to scroll, 2) focus loss from search input
  // Selection only changes via: Enter key activation or explicit click

  // Handle Enter/Space activation - selects the focused item and focuses chat input
  const handleActivate = useCallback((item: SessionMeta, index: number) => {
    // In multi-select mode, Enter just focuses chat (selection is already set)
    // In normal mode, Enter selects the item then focuses chat
    if (!isMultiSelectActive) {
      selectSession(item.id, index)
      navigateToSession(item.id)
    }
    onFocusChatInput?.()
  }, [isMultiSelectActive, selectSession, navigateToSession, onFocusChatInput])

  const handleFlagWithToast = useCallback((sessionId: string) => {
    if (!onFlag) return
    onFlag(sessionId)
    toast('Session flagged', {
      description: 'Added to your flagged items',
      action: onUnflag ? {
        label: 'Undo',
        onClick: () => onUnflag(sessionId),
      } : undefined,
    })
  }, [onFlag, onUnflag])

  const handleUnflagWithToast = useCallback((sessionId: string) => {
    if (!onUnflag) return
    onUnflag(sessionId)
    toast('Flag removed', {
      description: 'Removed from flagged items',
      action: onFlag ? {
        label: 'Undo',
        onClick: () => onFlag(sessionId),
      } : undefined,
    })
  }, [onFlag, onUnflag])

  const handleArchiveWithToast = useCallback((sessionId: string) => {
    if (!onArchive) return
    onArchive(sessionId)
    toast('Session archived', {
      description: 'Moved to archive',
      action: onUnarchive ? {
        label: 'Undo',
        onClick: () => onUnarchive(sessionId),
      } : undefined,
    })
  }, [onArchive, onUnarchive])

  const handleUnarchiveWithToast = useCallback((sessionId: string) => {
    if (!onUnarchive) return
    onUnarchive(sessionId)
    toast('Session restored', {
      description: 'Moved from archive',
      action: onArchive ? {
        label: 'Undo',
        onClick: () => onArchive(sessionId),
      } : undefined,
    })
  }, [onArchive, onUnarchive])

  const handleDeleteWithToast = useCallback(async (sessionId: string): Promise<boolean> => {
    // Confirmation dialog is shown by handleDeleteSession in App.tsx
    // We await so toast only shows after successful deletion (if user confirmed)
    const deleted = await onDelete(sessionId)
    if (deleted) {
      toast('Session deleted')
    }
    return deleted
  }, [onDelete])

  // Keyboard eligibility: determines when SessionList handles global keyboard shortcuts.
  // Two modes are supported:
  // 1. Zone-focused: User explicitly focused session-list zone (Cmd+2, Tab, or click)
  // 2. Search mode: Search input is focused (special case - we want arrow navigation
  //    but Cmd+A should NOT select all sessions since user may want to select input text)
  // This is intentionally NOT unified into the focus zone system because search input
  // requires partial keyboard support (arrows yes, Cmd+A no).
  const isKeyboardEligible = isFocused || (searchActive && isSearchInputFocused)

  // Helper: check if focus is within the session list container
  const isFocusWithinZone = () => zoneRef.current?.contains(document.activeElement) ?? false

  // Cmd+A to select all sessions
  // Uses containment check: fires when focus is anywhere within the zone container
  useAction('sessionList.selectAll', () => {
    const allIds = flatItems.map(item => item.id)
    selectAllSessions(allIds)
  }, {
    enabled: isFocusWithinZone,
  }, [flatItems, selectAllSessions])

  // Escape to clear multi-select (globally - works from any zone)
  // inputSafe flag in action definition allows this to fire from INPUT/TEXTAREA
  // Defers to interrupt flow when escape overlay is showing (processing interrupt takes priority)
  useAction('sessionList.clearSelection', () => {
    // Get the session that will remain selected after clearing
    const selectedId = selectionState.selected
    clearMultiSelect()
    // Navigate to sync sidebar and main content
    if (selectedId) {
      navigateToSession(selectedId)
    }
  }, {
    enabled: () => isMultiSelectActive && !showEscapeOverlay,
  }, [isMultiSelectActive, showEscapeOverlay, clearMultiSelect, selectionState.selected, navigateToSession])

  // Roving tabindex enabled when keyboard-eligible (see isKeyboardEligible comment above)
  // moveFocus=false during search so DOM focus stays on input while activeIndex changes
  const rovingEnabled = isKeyboardEligible

  const {
    activeIndex,
    setActiveIndex,
    getItemProps,
    getContainerProps,
    focusActiveItem,
  } = useRovingTabIndex({
    items: flatItems,
    getId: (item, _index) => item.id,
    orientation: 'vertical',
    wrap: true,
    onNavigate: handleNavigate, // Arrow keys scroll into view
    onActivate: handleActivate, // Enter/Space selects and focuses chat
    initialIndex: selectedIndex >= 0 ? selectedIndex : 0,
    enabled: rovingEnabled,
    moveFocus: !searchActive, // Keep focus on search input during search
    onExtendSelection: handleRangeSelect, // Shift+Arrow extends selection
  })

  // Sync activeIndex when selection changes externally
  useEffect(() => {
    const newIndex = flatItems.findIndex(item => item.id === selectionState.selected)
    if (newIndex >= 0 && newIndex !== activeIndex) {
      setActiveIndex(newIndex)
    }
  }, [selectionState.selected, flatItems, activeIndex, setActiveIndex])

  // Focus active item when zone gains focus via explicit keyboard navigation
  // shouldMoveDOMFocus is only true for keyboard intents (Cmd+2, Tab, Arrow keys)
  // This prevents data changes (new messages, reordering) from stealing focus
  useEffect(() => {
    if (shouldMoveDOMFocus && flatItems.length > 0 && !searchActive) {
      focusActiveItem()
    }
  }, [shouldMoveDOMFocus, focusActiveItem, flatItems.length, searchActive])

  // Arrow key shortcuts for zone navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, _item: SessionMeta) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusZone('sidebar', { intent: 'keyboard' })
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusZone('chat', { intent: 'keyboard' })
      return
    }
  }, [focusZone])

  const handleRenameClick = (sessionId: string, currentName: string) => {
    setRenameSessionId(sessionId)
    setRenameName(currentName)
    // Defer dialog open to next frame to let dropdown fully unmount first
    // This prevents race condition between dropdown's modal cleanup and dialog's modal setup
    requestAnimationFrame(() => {
      setRenameDialogOpen(true)
    })
  }

  const handleRenameSubmit = () => {
    if (renameSessionId && renameName.trim()) {
      onRename(renameSessionId, renameName.trim())
    }
    setRenameDialogOpen(false)
    setRenameSessionId(null)
    setRenameName("")
  }

  // Handle search input key events (Arrow keys handled by native listener above)
  // Note: Escape blurs the input but doesn't close search - only the X button closes it
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape: Blur the input but keep search visible
    if (e.key === 'Escape') {
      e.preventDefault()
      searchInputRef.current?.blur()
      return
    }

    // Enter: Focus the chat input (same as pressing Enter on a selected session)
    if (e.key === 'Enter') {
      e.preventDefault()
      onFocusChatInput?.()
      return
    }

    // Forward arrow keys to roving tabindex (search input is outside the container)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      getContainerProps().onKeyDown(e)
      return
    }
  }

  // Empty state - render outside ScrollArea for proper vertical centering
  if (flatItems.length === 0 && !searchActive) {
    // Special empty state for archived view
    if (currentFilter?.kind === 'archived') {
      return (
        <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Archive />
            </EmptyMedia>
            <EmptyTitle>No archived sessions</EmptyTitle>
            <EmptyDescription>
              Sessions you archive will appear here. Archive sessions to keep your list tidy while preserving conversations.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>No sessions yet</EmptyTitle>
          <EmptyDescription>
            Sessions with your agent appear here. Start one to get going.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <button
            onClick={() => {
              // Create a new session, applying the current filter's status/label if applicable
              const params: { status?: string; label?: string } = {}
              if (currentFilter?.kind === 'state') params.status = currentFilter.stateId
              else if (currentFilter?.kind === 'label') params.label = currentFilter.labelId
              navigate(routes.action.newSession(Object.keys(params).length > 0 ? params : undefined))
            }}
            className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors"
          >
            New Session
          </button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Search header - input + status row (shared with playground) */}
      {searchActive && (
        <SessionSearchHeader
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSearchClose={onSearchClose}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => setIsSearchInputFocused(true)}
          onBlur={() => setIsSearchInputFocused(false)}
          isSearching={isSearchingContent}
          resultCount={matchingFilterItems.length + otherResultItems.length}
          exceededLimit={exceededSearchLimit}
          inputRef={searchInputRef}
        />
      )}
      {/* ScrollArea with mask-fade-top-short - shorter fade to avoid header overlap */}
      <ScrollArea className="flex-1 select-none mask-fade-top-short">
        <div
          ref={zoneRef}
          className="flex flex-col pb-14 min-w-0"
          data-focus-zone="session-list"
          role="listbox"
          aria-label="Sessions"
        >
          {/* No results message when in search mode */}
          {isSearchMode && flatItems.length === 0 && !isSearchingContent && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-sm text-muted-foreground">No sessions found</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Searched titles and message content
              </p>
              <button
                onClick={() => onSearchChange?.('')}
                className="text-xs text-foreground hover:underline mt-2"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Search mode: flat list with two sections (In Current View + Other Conversations) */}
          {isSearchMode ? (
            <>
              {/* No results in current filter message */}
              {matchingFilterItems.length === 0 && otherResultItems.length > 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No results in current filter
                </div>
              )}

              {/* Matching Filters section - flat list, no date grouping */}
              {matchingFilterItems.length > 0 && (
                <>
                  <SessionListSectionHeader label="In Current View" />
                  {matchingFilterItems.map((item, index) => {
                    const flatIndex = sessionIndexMap.get(item.id) ?? 0
                    const itemProps = getItemProps(item, flatIndex)
                    return (
                      <SessionItem
                        key={item.id}
                        item={item}
                        index={flatIndex}
                        itemProps={itemProps}
                        isSelected={selectionState.selected === item.id}
                        isLast={flatIndex === flatItems.length - 1}
                        isFirstInGroup={index === 0}
                        onKeyDown={handleKeyDown}
                        onRenameClick={handleRenameClick}
                        onSessionStatusChange={onSessionStatusChange}
                        onFlag={onFlag ? handleFlagWithToast : undefined}
                        onUnflag={onUnflag ? handleUnflagWithToast : undefined}
                        onArchive={onArchive ? handleArchiveWithToast : undefined}
                        onUnarchive={onUnarchive ? handleUnarchiveWithToast : undefined}
                        onMarkUnread={onMarkUnread}
                        onDelete={handleDeleteWithToast}
                        onSelect={() => handleSelectSession(item, flatIndex)}
                        onOpenInNewWindow={() => onOpenInNewWindow?.(item)}
                        permissionMode={sessionOptions?.get(item.id)?.permissionMode}
                        llmConnection={item.llmConnection}
                        searchQuery={highlightQuery}
                        sessionStatuses={sessionStatuses}
                        flatLabels={flatLabels}
                        labels={labels}
                        onLabelsChange={onLabelsChange}
                        chatMatchCount={isSearchMode ? contentSearchResults.get(item.id)?.matchCount : undefined}
                        isMultiSelectActive={isMultiSelectActive}
                        isInMultiSelect={isSessionSelected(item.id)}
                        onToggleSelect={() => handleToggleSelect(item, flatIndex)}
                        onRangeSelect={() => handleRangeSelect(flatIndex)}
                        onFocusZone={() => focusZone('session-list', { intent: 'click', moveFocus: false })}
                      />
                    )
                  })}
                </>
              )}

              {/* Other Matches section - flat list, no date grouping */}
              {otherResultItems.length > 0 && (
                <>
                  <SessionListSectionHeader label="Other Conversations" />
                  {otherResultItems.map((item, index) => {
                    const flatIndex = sessionIndexMap.get(item.id) ?? 0
                    const itemProps = getItemProps(item, flatIndex)
                    return (
                      <SessionItem
                        key={item.id}
                        item={item}
                        index={flatIndex}
                        itemProps={itemProps}
                        isSelected={selectionState.selected === item.id}
                        isLast={flatIndex === flatItems.length - 1}
                        isFirstInGroup={index === 0}
                        onKeyDown={handleKeyDown}
                        onRenameClick={handleRenameClick}
                        onSessionStatusChange={onSessionStatusChange}
                        onFlag={onFlag ? handleFlagWithToast : undefined}
                        onUnflag={onUnflag ? handleUnflagWithToast : undefined}
                        onArchive={onArchive ? handleArchiveWithToast : undefined}
                        onUnarchive={onUnarchive ? handleUnarchiveWithToast : undefined}
                        onMarkUnread={onMarkUnread}
                        onDelete={handleDeleteWithToast}
                        onSelect={() => handleSelectSession(item, flatIndex)}
                        onOpenInNewWindow={() => onOpenInNewWindow?.(item)}
                        permissionMode={sessionOptions?.get(item.id)?.permissionMode}
                        llmConnection={item.llmConnection}
                        searchQuery={highlightQuery}
                        sessionStatuses={sessionStatuses}
                        flatLabels={flatLabels}
                        labels={labels}
                        onLabelsChange={onLabelsChange}
                        chatMatchCount={isSearchMode ? contentSearchResults.get(item.id)?.matchCount : undefined}
                        isMultiSelectActive={isMultiSelectActive}
                        isInMultiSelect={isSessionSelected(item.id)}
                        onToggleSelect={() => handleToggleSelect(item, flatIndex)}
                        onRangeSelect={() => handleRangeSelect(flatIndex)}
                        onFocusZone={() => focusZone('session-list', { intent: 'click', moveFocus: false })}
                      />
                    )
                  })}
                </>
              )}
            </>
          ) : (
            /* Normal mode: show date-grouped sessions */
            dateGroups.map((group) => (
              <div key={group.date.toISOString()}>
                <SessionListSectionHeader label={group.label} />
                {group.sessions.map((item, indexInGroup) => {
                  const flatIndex = sessionIndexMap.get(item.id) ?? 0
                  const itemProps = getItemProps(item, flatIndex)
                  return (
                    <SessionItem
                      key={item.id}
                      item={item}
                      index={flatIndex}
                      itemProps={itemProps}
                      isSelected={selectionState.selected === item.id}
                      isLast={flatIndex === flatItems.length - 1}
                      isFirstInGroup={indexInGroup === 0}
                      onKeyDown={handleKeyDown}
                      onRenameClick={handleRenameClick}
                      onSessionStatusChange={onSessionStatusChange}
                      onFlag={onFlag ? handleFlagWithToast : undefined}
                      onUnflag={onUnflag ? handleUnflagWithToast : undefined}
                      onArchive={onArchive ? handleArchiveWithToast : undefined}
                      onUnarchive={onUnarchive ? handleUnarchiveWithToast : undefined}
                      onMarkUnread={onMarkUnread}
                      onDelete={handleDeleteWithToast}
                      onSelect={() => handleSelectSession(item, flatIndex)}
                      onOpenInNewWindow={() => onOpenInNewWindow?.(item)}
                      permissionMode={sessionOptions?.get(item.id)?.permissionMode}
                        llmConnection={item.llmConnection}
                      searchQuery={searchQuery}
                      sessionStatuses={sessionStatuses}
                      flatLabels={flatLabels}
                      labels={labels}
                      onLabelsChange={onLabelsChange}
                      chatMatchCount={contentSearchResults.get(item.id)?.matchCount}
                      isMultiSelectActive={isMultiSelectActive}
                      isInMultiSelect={isSessionSelected(item.id)}
                      onToggleSelect={() => handleToggleSelect(item, flatIndex)}
                      onRangeSelect={() => handleRangeSelect(flatIndex)}
                      onFocusZone={() => focusZone('session-list', { intent: 'click', moveFocus: false })}
                    />
                  )
                })}
              </div>
            ))
          )}
          {/* Load more sentinel - triggers infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef as React.RefObject<HTMLDivElement>} className="flex justify-center py-4">
              <Spinner className="text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        title="Rename Session"
        value={renameName}
        onValueChange={setRenameName}
        onSubmit={handleRenameSubmit}
        placeholder="Enter session name..."
      />
    </div>
  )
}
