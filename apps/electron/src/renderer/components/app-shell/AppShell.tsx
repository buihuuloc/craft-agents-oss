import * as React from "react"
import { useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Archive,
  CheckCircle2,
  Settings,
  Flag,
  ListFilter,
  Tag,
  Check,
  Search,
  Plus,
  DatabaseZap,
  Zap,
  Inbox,
  Globe,
  FolderOpen,
  HelpCircle,
  ExternalLink,
  Cake,
} from "lucide-react"
import { PanelRightRounded } from "../icons/PanelRightRounded"
import { PanelLeftRounded } from "../icons/PanelLeftRounded"
import { AppMenu } from "../AppMenu"
import { SquarePenRounded } from "../icons/SquarePenRounded"
import { McpIcon } from "../icons/McpIcon"
import { cn } from "@/lib/utils"
import { isMac } from "@/lib/platform"
import { Button } from "@/components/ui/button"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { Tooltip, TooltipTrigger, TooltipContent, DocumentFormattedMarkdownOverlay } from "@craft-agent/ui"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuSub,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubTrigger,
  StyledDropdownMenuSubContent,
} from "@/components/ui/styled-dropdown"
import {
  ContextMenu,
  ContextMenuTrigger,
  StyledContextMenuContent,
} from "@/components/ui/styled-context-menu"
import { ContextMenuProvider } from "@/components/ui/menu-context"
import { SidebarMenu } from "./SidebarMenu"
import { WorkspaceSwitcher } from "./WorkspaceSwitcher"
import { SessionList } from "./SessionList"
import { MainContentPanel } from "./MainContentPanel"
import { LeftSidebar } from "./LeftSidebar"
import { AppShellProvider, type AppShellContextType } from "@/context/AppShellContext"
import { EscapeInterruptProvider } from "@/context/EscapeInterruptContext"
import { getResizeGradientStyle } from "@/hooks/useResizeGradient"
import { navigate, routes } from "@/lib/navigate"
import {
  isSessionsNavigation,
  isSourcesNavigation,
  isSettingsNavigation,
  isSkillsNavigation,
} from "@/contexts/NavigationContext"
import { SourcesListPanel } from "./SourcesListPanel"
import { SkillsListPanel } from "./SkillsListPanel"
import { PanelHeader } from "./PanelHeader"
import { EditPopover, getEditConfig, type EditContextKey } from "@/components/ui/EditPopover"
import { getDocUrl } from "@craft-agent/shared/docs/doc-links"
import SettingsNavigator from "@/pages/settings/SettingsNavigator"
import { RightSidebar } from "./RightSidebar"
import { LabelIcon, LabelValueTypeIcon } from "@/components/ui/label-icon"
import { getLabelDisplayName, findLabelById } from "@craft-agent/shared/labels"
import type { LabelTreeNode } from "@craft-agent/shared/labels"

// Extracted modules
import { FilterModeBadge, FilterModeSubMenuItems, FilterMenuRow, FilterLabelItems } from "./FilterComponents"
import type { FilterMode } from "./FilterComponents"
import { EditPopovers } from "./EditPopovers"
import { useAppShellState } from "./useAppShellState"

/**
 * AppShellProps - Minimal props interface for AppShell component
 *
 * Data and callbacks come via contextValue (AppShellContextType).
 * Only UI-specific state is passed as separate props.
 *
 * Adding new features:
 * 1. Add to AppShellContextType in context/AppShellContext.tsx
 * 2. Update App.tsx to include in contextValue
 * 3. Use via useAppShellContext() hook in child components
 */
interface AppShellProps {
  /** All data and callbacks - passed directly to AppShellProvider */
  contextValue: AppShellContextType
  /** UI-specific props */
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  menuNewChatTrigger?: number
  /** Focused mode - hides sidebars, shows only the chat content */
  isFocusedMode?: boolean
}

/**
 * AppShell - Main 3-panel layout container
 *
 * Layout: [LeftSidebar 20%] | [NavigatorPanel 32%] | [MainContentPanel 48%]
 *
 * Session Filters:
 * - 'allSessions': Shows all sessions
 * - 'flagged': Shows flagged sessions
 * - 'state': Shows sessions with a specific todo state
 */
export function AppShell(props: AppShellProps) {
  // Wrap with EscapeInterruptProvider so AppShellContent can use useEscapeInterrupt
  return (
    <EscapeInterruptProvider>
      <AppShellContent {...props} />
    </EscapeInterruptProvider>
  )
}

/**
 * AppShellContent - Inner component that contains all the AppShell logic
 * Separated to allow useEscapeInterrupt hook to work (must be inside provider)
 */
function AppShellContent(props: AppShellProps) {
  const state = useAppShellState(props)

  const {
    // Context values
    contextValue,
    workspaces,
    activeWorkspaceId,
    sessionOptions,
    onSelectWorkspace,
    onRefreshWorkspaces,
    onFlagSession,
    onUnflagSession,
    onArchiveSession,
    onUnarchiveSession,
    onMarkSessionUnread,
    onSessionStatusChange,
    onRenameSession,
    onOpenSettings,
    onOpenKeyboardShortcuts,
    onOpenStoredUserPreferences,

    // Hotkey labels
    newChatHotkey,

    // Sidebar
    isSidebarVisible,
    setIsSidebarVisible,
    sidebarWidth,
    sessionListWidth,
    isRightSidebarVisible,
    setIsRightSidebarVisible,
    rightSidebarWidth,
    skipRightSidebarAnimation,

    // Focus mode
    setIsFocusModeActive,
    effectiveFocusMode,

    // What's New
    showWhatsNew,
    setShowWhatsNew,
    releaseNotesContent,
    hasUnseenReleaseNotes,

    // Resize
    isResizing,
    setIsResizing,
    sidebarHandleY,
    setSidebarHandleY,
    sessionListHandleY,
    setSessionListHandleY,
    rightSidebarHandleY,
    setRightSidebarHandleY,
    resizeHandleRef,
    sessionListHandleRef,
    rightSidebarHandleRef,
    shouldUseOverlay,

    // Session & Navigation
    navState,
    sessionFilter,
    sourceFilter,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    navigateToSession,

    // Search
    searchActive,
    setSearchActive,
    searchQuery,
    setSearchQuery,
    chatDisplayRef,
    handleChatMatchInfoChange,

    // Sidebar navigation
    focusedSidebarItemId,
    isExpanded,
    toggleExpanded,

    // Sources & Skills
    sources,
    skills,
    localMcpEnabled,
    enabledModes,

    // Active workspace
    activeWorkspace,

    // Status configs
    effectiveSessionStatuses,

    // Labels & Views
    labelConfigs,
    labelTree,
    viewConfigs,
    evaluateViews,

    // Session metadata
    workspaceSessionMetas,

    // Session filtering
    listFilter,
    setListFilter,
    labelFilter,
    setLabelFilter,
    filteredSessionMetas,
    pinnedFilters,
    filterDropdownResults,
    filterDropdownQuery,
    setFilterDropdownQuery,
    filterDropdownSelectedIdx,
    setFilterDropdownSelectedIdx,
    filterDropdownListRef,
    filterDropdownInputRef,

    // Counts
    flaggedCount,
    archivedCount,
    labelCounts,
    sessionStatusCounts,
    sourceTypeCounts,

    // Handlers
    handleDeleteSession,
    handleSessionSourcesChange,
    handleSessionLabelsChange,
    handleNewChat,
    handleDeleteSource,
    handleDeleteSkill,
    handleAllSessionsClick,
    handleFlaggedClick,
    handleArchivedClick,
    handleSessionStatusClick,
    handleLabelClick,
    handleViewClick,
    handleStatusReorder,
    handleSourcesClick,
    handleSourcesApiClick,
    handleSourcesMcpClick,
    handleSourcesLocalClick,
    handleSkillsClick,
    handleSettingsClick,
    handleWhatsNewClick,
    handleSourceSelect,
    handleSkillSelect,
    getSidebarItemProps,

    // Edit popover
    editPopoverOpen,
    setEditPopoverOpen,
    editPopoverAnchorY,
    editLabelTargetId,
    openConfigureStatuses,
    openConfigureLabels,
    handleAddLabel,
    handleDeleteLabel,
    openAddSource,
    openAddSkill,

    // Focus zone
    focusZone,
    sidebarRef,
    sidebarFocused,
    chatInputRef,
    focusChatInput,

    // Animation
    springTransition,

    // Constants
    PANEL_WINDOW_EDGE_SPACING,
    PANEL_PANEL_SPACING,
  } = state

  // Right sidebar OPEN button
  const rightSidebarOpenButton = React.useMemo(() => {
    if (!isSessionsNavigation(navState) || !navState.details) return null

    return (
      <motion.div
        initial={false}
        animate={{ opacity: isRightSidebarVisible ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        style={{ pointerEvents: isRightSidebarVisible ? 'none' : 'auto' }}
      >
        <HeaderIconButton
          icon={<PanelRightRounded className="h-5 w-6" />}
          onClick={() => setIsRightSidebarVisible(true)}
          tooltip="Open sidebar"
          className="text-foreground"
        />
      </motion.div>
    )
  }, [navState, isRightSidebarVisible])

  // Right sidebar CLOSE button
  const rightSidebarCloseButton = React.useMemo(() => {
    if (!isRightSidebarVisible) return null

    return (
      <HeaderIconButton
        icon={<PanelLeftRounded className="h-5 w-6" />}
        onClick={() => setIsRightSidebarVisible(false)}
        tooltip="Close sidebar"
        className="text-foreground"
      />
    )
  }, [isRightSidebarVisible])

  // Extend context value with local overrides
  const appShellContextValue = React.useMemo<AppShellContextType>(() => ({
    ...contextValue,
    onDeleteSession: handleDeleteSession,
    textareaRef: chatInputRef,
    enabledSources: sources,
    skills,
    labels: labelConfigs,
    onSessionLabelsChange: handleSessionLabelsChange,
    enabledModes,
    sessionStatuses: effectiveSessionStatuses,
    onSessionSourcesChange: handleSessionSourcesChange,
    rightSidebarButton: rightSidebarOpenButton,
    sessionListSearchQuery: searchActive ? searchQuery : undefined,
    isSearchModeActive: searchActive,
    chatDisplayRef,
    onChatMatchInfoChange: handleChatMatchInfoChange,
  }), [contextValue, handleDeleteSession, sources, skills, labelConfigs, handleSessionLabelsChange, enabledModes, effectiveSessionStatuses, handleSessionSourcesChange, rightSidebarOpenButton, searchActive, searchQuery, handleChatMatchInfoChange])

  // Unified sidebar items
  type SidebarItem = {
    id: string
    type: 'nav'
    action?: () => void
  }

  const unifiedSidebarItems = React.useMemo((): SidebarItem[] => {
    const result: SidebarItem[] = []

    result.push({ id: 'nav:allSessions', type: 'nav', action: handleAllSessionsClick })
    result.push({ id: 'nav:flagged', type: 'nav', action: handleFlaggedClick })
    result.push({ id: 'nav:states', type: 'nav', action: handleAllSessionsClick })
    for (const s of effectiveSessionStatuses) {
      result.push({ id: `nav:state:${s.id}`, type: 'nav', action: () => handleSessionStatusClick(s.id) })
    }

    result.push({ id: 'nav:labels', type: 'nav', action: handleAllSessionsClick })
    const flattenTree = (nodes: LabelTreeNode[]) => {
      for (const node of nodes) {
        if (node.label) {
          result.push({ id: `nav:label:${node.fullId}`, type: 'nav', action: () => handleLabelClick(node.fullId) })
        }
        if (node.children.length > 0) flattenTree(node.children)
      }
    }
    flattenTree(labelTree)

    result.push({ id: 'nav:archived', type: 'nav', action: handleArchivedClick })
    result.push({ id: 'nav:sources', type: 'nav', action: handleSourcesClick })
    result.push({ id: 'nav:skills', type: 'nav', action: handleSkillsClick })
    result.push({ id: 'nav:settings', type: 'nav', action: () => handleSettingsClick('app') })
    result.push({ id: 'nav:whats-new', type: 'nav', action: handleWhatsNewClick })

    return result
  }, [handleAllSessionsClick, handleFlaggedClick, handleArchivedClick, handleSessionStatusClick, effectiveSessionStatuses, handleLabelClick, labelConfigs, labelTree, viewConfigs, handleViewClick, handleSourcesClick, handleSkillsClick, handleSettingsClick, handleWhatsNewClick])

  // Unified sidebar keyboard navigation
  const handleSidebarKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!sidebarFocused || unifiedSidebarItems.length === 0) return

    const currentIndex = unifiedSidebarItems.findIndex(item => item.id === focusedSidebarItemId)
    const currentItem = currentIndex >= 0 ? unifiedSidebarItems[currentIndex] : null
    const { setFocusedSidebarItemId, sidebarItemRefs } = state

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const nextIndex = currentIndex < unifiedSidebarItems.length - 1 ? currentIndex + 1 : 0
        const nextItem = unifiedSidebarItems[nextIndex]
        setFocusedSidebarItemId(nextItem.id)
        sidebarItemRefs.current.get(nextItem.id)?.focus()
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : unifiedSidebarItems.length - 1
        const prevItem = unifiedSidebarItems[prevIndex]
        setFocusedSidebarItemId(prevItem.id)
        sidebarItemRefs.current.get(prevItem.id)?.focus()
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        focusZone('session-list', { intent: 'keyboard' })
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (currentItem?.type === 'nav' && currentItem.action) {
          currentItem.action()
        }
        break
      }
      case 'Home': {
        e.preventDefault()
        if (unifiedSidebarItems.length > 0) {
          const firstItem = unifiedSidebarItems[0]
          setFocusedSidebarItemId(firstItem.id)
          sidebarItemRefs.current.get(firstItem.id)?.focus()
        }
        break
      }
      case 'End': {
        e.preventDefault()
        if (unifiedSidebarItems.length > 0) {
          const lastItem = unifiedSidebarItems[unifiedSidebarItems.length - 1]
          setFocusedSidebarItemId(lastItem.id)
          sidebarItemRefs.current.get(lastItem.id)?.focus()
        }
        break
      }
    }
  }, [sidebarFocused, unifiedSidebarItems, focusedSidebarItemId, focusZone, state])

  // Focus sidebar item when sidebar zone gains focus
  React.useEffect(() => {
    if (sidebarFocused && unifiedSidebarItems.length > 0) {
      const itemId = focusedSidebarItemId || unifiedSidebarItems[0].id
      if (!focusedSidebarItemId) {
        state.setFocusedSidebarItemId(itemId)
      }
      requestAnimationFrame(() => {
        state.sidebarItemRefs.current.get(itemId)?.focus()
      })
    }
  }, [sidebarFocused, focusedSidebarItemId, unifiedSidebarItems])

  // Get title based on navigation state
  const listTitle = React.useMemo(() => {
    if (isSourcesNavigation(navState)) return 'Sources'
    if (isSkillsNavigation(navState)) return 'All Skills'
    if (isSettingsNavigation(navState)) return 'Settings'
    if (!sessionFilter) return 'All Sessions'

    switch (sessionFilter.kind) {
      case 'flagged':
        return 'Flagged'
      case 'state': {
        const s = effectiveSessionStatuses.find(st => st.id === sessionFilter.stateId)
        return s?.label || 'All Sessions'
      }
      case 'label':
        return sessionFilter.labelId === '__all__' ? 'Labels' : getLabelDisplayName(labelConfigs, sessionFilter.labelId)
      case 'view':
        return sessionFilter.viewId === '__all__' ? 'Views' : viewConfigs.find(v => v.id === sessionFilter.viewId)?.name || 'Views'
      default:
        return 'All Sessions'
    }
  }, [navState, sessionFilter, effectiveSessionStatuses, labelConfigs, viewConfigs])

  // Build recursive sidebar items from label tree
  const buildLabelSidebarItems = React.useCallback((nodes: LabelTreeNode[]): any[] => {
    const sorted = [...nodes].sort((a, b) => {
      const nameA = (a.label?.name || a.segment).toLowerCase()
      const nameB = (b.label?.name || b.segment).toLowerCase()
      return nameA.localeCompare(nameB)
    })
    return sorted.map(node => {
      const hasChildren = node.children.length > 0
      const isActive = sessionFilter?.kind === 'label' && sessionFilter.labelId === node.fullId
      const count = labelCounts[node.fullId] || 0

      const item: any = {
        id: `nav:label:${node.fullId}`,
        title: node.label?.name || node.segment.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        label: count > 0 ? String(count) : undefined,
        afterTitle: node.label?.valueType ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center"><LabelValueTypeIcon valueType={node.label.valueType} size={10} /></span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              This label can have a {node.label.valueType} value
            </TooltipContent>
          </Tooltip>
        ) : undefined,
        icon: node.label && activeWorkspace?.id ? (
          <LabelIcon
            label={node.label}
            size="sm"
            hasChildren={hasChildren}
          />
        ) : <Tag className="h-3.5 w-3.5" />,
        variant: isActive ? "default" : "ghost",
        compact: true,
        onClick: () => handleLabelClick(node.fullId),
        contextMenu: {
          type: 'labels' as const,
          labelId: node.fullId,
          onConfigureLabels: openConfigureLabels,
          onAddLabel: handleAddLabel,
          onDeleteLabel: handleDeleteLabel,
        },
      }

      if (hasChildren) {
        item.expandable = true
        item.expanded = isExpanded(`nav:label:${node.fullId}`)
        item.onToggle = () => toggleExpanded(`nav:label:${node.fullId}`)
        item.items = buildLabelSidebarItems(node.children)
      }

      return item
    })
  }, [sessionFilter, labelCounts, activeWorkspace?.id, handleLabelClick, isExpanded, toggleExpanded, openConfigureLabels, handleAddLabel, handleDeleteLabel])

  return (
    <AppShellProvider value={appShellContextValue}>
        {/*
          Draggable title bar region for transparent window (macOS)
          - Fixed overlay at z-titlebar allows window dragging from the top bar area
          - Interactive elements (buttons, dropdowns) must use:
            1. titlebar-no-drag: prevents drag behavior on clickable elements
            2. relative z-panel: ensures elements render above this drag overlay
        */}
        <div className="titlebar-drag-region fixed top-0 left-0 right-0 h-[50px] z-titlebar" />

      {/* App Menu - fixed position, fades out in focused mode
          On macOS: offset 86px to avoid stoplight controls
          On Windows/Linux: offset 12px (no stoplight controls) */}
      {(() => {
        const menuLeftOffset = isMac ? 86 : 12
        return (
          <motion.div
            initial={false}
            animate={{ opacity: effectiveFocusMode ? 0 : 1 }}
            transition={springTransition}
            className={cn(
              "fixed top-0 h-[50px] z-overlay flex items-center pointer-events-none pr-2",
              effectiveFocusMode && "pointer-events-none"
            )}
            style={{ left: menuLeftOffset, width: sidebarWidth - menuLeftOffset }}
          >
            <AppMenu
              onNewChat={() => handleNewChat(true)}
              onNewWindow={() => window.electronAPI.menuNewWindow()}
              onOpenSettings={onOpenSettings}
              onOpenSettingsSubpage={handleSettingsClick}
              onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
              onOpenStoredUserPreferences={onOpenStoredUserPreferences}
              onBack={goBack}
              onForward={goForward}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onToggleSidebar={() => setIsSidebarVisible(prev => !prev)}
              onToggleFocusMode={() => setIsFocusModeActive(prev => !prev)}
            />
          </motion.div>
        )
      })()}

      {/* === OUTER LAYOUT: Sidebar | Main Content === */}
      <div className="h-full flex items-stretch relative">
        {/* === SIDEBAR (Left) === */}
        <motion.div
          initial={false}
          animate={{
            width: effectiveFocusMode ? 0 : (isSidebarVisible ? sidebarWidth : 0),
            opacity: effectiveFocusMode ? 0 : 1,
          }}
          transition={isResizing ? { duration: 0 } : springTransition}
          className="h-full overflow-hidden shrink-0 relative"
        >
          <div
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className="h-full font-sans relative"
            data-focus-zone="sidebar"
            tabIndex={sidebarFocused ? 0 : -1}
            onKeyDown={handleSidebarKeyDown}
          >
            <div className="flex h-full flex-col pt-[50px] select-none">
              {/* Sidebar Top Section */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* New Session Button */}
                <div className="px-2 pt-1 pb-2 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <ContextMenu modal={true}>
                          <ContextMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              onClick={() => handleNewChat(true)}
                              className="w-full justify-start gap-2 py-[7px] px-2 text-[13px] font-normal rounded-[6px] shadow-minimal bg-background"
                              data-tutorial="new-chat-button"
                            >
                              <SquarePenRounded className="h-3.5 w-3.5 shrink-0" />
                              New Session
                            </Button>
                          </ContextMenuTrigger>
                          <StyledContextMenuContent>
                            <ContextMenuProvider>
                              <SidebarMenu type="newSession" />
                            </ContextMenuProvider>
                          </StyledContextMenuContent>
                        </ContextMenu>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{newChatHotkey}</TooltipContent>
                  </Tooltip>
                </div>
                {/* Primary Nav */}
                <div className="flex-1 overflow-y-auto min-h-0 mask-fade-bottom pb-4">
                <LeftSidebar
                  isCollapsed={false}
                  getItemProps={getSidebarItemProps}
                  focusedItemId={focusedSidebarItemId}
                  links={[
                    // --- Sessions Section ---
                    {
                      id: "nav:allSessions",
                      title: "All Sessions",
                      label: String(workspaceSessionMetas.length),
                      icon: Inbox,
                      variant: sessionFilter?.kind === 'allSessions' ? "default" : "ghost",
                      onClick: handleAllSessionsClick,
                    },
                    {
                      id: "nav:flagged",
                      title: "Flagged",
                      label: String(flaggedCount),
                      icon: <Flag className="h-3.5 w-3.5" />,
                      variant: sessionFilter?.kind === 'flagged' ? "default" : "ghost",
                      onClick: handleFlaggedClick,
                    },
                    // States: expandable section with status sub-items
                    {
                      id: "nav:states",
                      title: "Status",
                      icon: CheckCircle2,
                      variant: "ghost",
                      onClick: () => toggleExpanded('nav:states'),
                      expandable: true,
                      expanded: isExpanded('nav:states'),
                      onToggle: () => toggleExpanded('nav:states'),
                      contextMenu: {
                        type: 'allSessions',
                        onConfigureStatuses: openConfigureStatuses,
                      },
                      sortable: { onReorder: handleStatusReorder },
                      items: effectiveSessionStatuses.map(s => ({
                        id: `nav:state:${s.id}`,
                        title: s.label,
                        label: String(sessionStatusCounts[s.id] || 0),
                        icon: s.icon,
                        iconColor: s.resolvedColor,
                        iconColorable: s.iconColorable,
                        variant: (sessionFilter?.kind === 'state' && sessionFilter.stateId === s.id ? "default" : "ghost") as "default" | "ghost",
                        onClick: () => handleSessionStatusClick(s.id),
                        contextMenu: {
                          type: 'status' as const,
                          statusId: s.id,
                          onConfigureStatuses: openConfigureStatuses,
                        },
                      })),
                    },
                    // Labels
                    {
                      id: "nav:labels",
                      title: "Labels",
                      icon: Tag,
                      variant: (sessionFilter?.kind === 'label' && sessionFilter.labelId === '__all__') ? "default" as const : "ghost" as const,
                      onClick: () => handleLabelClick('__all__'),
                      expandable: true,
                      expanded: isExpanded('nav:labels'),
                      onToggle: () => toggleExpanded('nav:labels'),
                      contextMenu: {
                        type: 'labels' as const,
                        onConfigureLabels: openConfigureLabels,
                        onAddLabel: handleAddLabel,
                      },
                      items: buildLabelSidebarItems(labelTree),
                    },
                    // --- Archived Section ---
                    {
                      id: "nav:archived",
                      title: "Archived",
                      label: archivedCount > 0 ? String(archivedCount) : undefined,
                      icon: Archive,
                      variant: sessionFilter?.kind === 'archived' ? "default" : "ghost",
                      onClick: handleArchivedClick,
                    },
                    // --- Separator ---
                    { id: "separator:chats-sources", type: "separator" },
                    // --- Sources & Skills Section ---
                    {
                      id: "nav:sources",
                      title: "Sources",
                      label: String(sources.length),
                      icon: DatabaseZap,
                      variant: (isSourcesNavigation(navState) && !sourceFilter) ? "default" : "ghost",
                      onClick: handleSourcesClick,
                      dataTutorial: "sources-nav",
                      expandable: true,
                      expanded: isExpanded('nav:sources'),
                      onToggle: () => toggleExpanded('nav:sources'),
                      contextMenu: {
                        type: 'sources',
                        onAddSource: () => openAddSource(),
                      },
                      items: [
                        {
                          id: "nav:sources:api",
                          title: "APIs",
                          label: String(sourceTypeCounts.api),
                          icon: Globe,
                          variant: (sourceFilter?.kind === 'type' && sourceFilter.sourceType === 'api') ? "default" : "ghost",
                          onClick: handleSourcesApiClick,
                          contextMenu: {
                            type: 'sources' as const,
                            onAddSource: () => openAddSource('api'),
                            sourceType: 'api',
                          },
                        },
                        {
                          id: "nav:sources:mcp",
                          title: "MCPs",
                          label: String(sourceTypeCounts.mcp),
                          icon: <McpIcon className="h-3.5 w-3.5" />,
                          variant: (sourceFilter?.kind === 'type' && sourceFilter.sourceType === 'mcp') ? "default" : "ghost",
                          onClick: handleSourcesMcpClick,
                          contextMenu: {
                            type: 'sources' as const,
                            onAddSource: () => openAddSource('mcp'),
                            sourceType: 'mcp',
                          },
                        },
                        {
                          id: "nav:sources:local",
                          title: "Local Folders",
                          label: String(sourceTypeCounts.local),
                          icon: FolderOpen,
                          variant: (sourceFilter?.kind === 'type' && sourceFilter.sourceType === 'local') ? "default" : "ghost",
                          onClick: handleSourcesLocalClick,
                          contextMenu: {
                            type: 'sources' as const,
                            onAddSource: () => openAddSource('local'),
                            sourceType: 'local',
                          },
                        },
                      ],
                    },
                    {
                      id: "nav:skills",
                      title: "Skills",
                      label: String(skills.length),
                      icon: Zap,
                      variant: isSkillsNavigation(navState) ? "default" : "ghost",
                      onClick: handleSkillsClick,
                      contextMenu: {
                        type: 'skills',
                        onAddSkill: openAddSkill,
                      },
                    },
                    // --- Separator ---
                    { id: "separator:skills-settings", type: "separator" },
                    // --- Settings ---
                    {
                      id: "nav:settings",
                      title: "Settings",
                      icon: Settings,
                      variant: isSettingsNavigation(navState) ? "default" : "ghost",
                      onClick: () => handleSettingsClick('app'),
                    },
                    // --- What's New ---
                    {
                      id: "nav:whats-new",
                      title: "What's New",
                      icon: hasUnseenReleaseNotes ? (
                        <span className="relative">
                          <Cake className="h-3.5 w-3.5" />
                          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                        </span>
                      ) : Cake,
                      variant: "ghost" as const,
                      onClick: handleWhatsNewClick,
                    },
                  ]}
                />
                </div>
              </div>

              {/* Sidebar Bottom Section: WorkspaceSwitcher + Help icon */}
              <div className="mt-auto shrink-0 py-2 px-2">
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <WorkspaceSwitcher
                      isCollapsed={false}
                      workspaces={workspaces}
                      activeWorkspaceId={activeWorkspaceId}
                      onSelect={onSelectWorkspace}
                      onWorkspaceCreated={() => onRefreshWorkspaces?.()}
                    />
                  </div>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex items-center justify-center h-7 w-7 rounded-[6px] select-none outline-none hover:bg-foreground/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <HelpCircle className="h-4 w-4 text-foreground/60" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">Help & Documentation</TooltipContent>
                    </Tooltip>
                    <StyledDropdownMenuContent align="end" side="top" sideOffset={8}>
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl(getDocUrl('sources'))}>
                        <DatabaseZap className="h-3.5 w-3.5" />
                        <span className="flex-1">Sources</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl(getDocUrl('skills'))}>
                        <Zap className="h-3.5 w-3.5" />
                        <span className="flex-1">Skills</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl(getDocUrl('statuses'))}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="flex-1">Statuses</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl(getDocUrl('permissions'))}>
                        <Settings className="h-3.5 w-3.5" />
                        <span className="flex-1">Permissions</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </StyledDropdownMenuItem>
                      <StyledDropdownMenuSeparator />
                      <StyledDropdownMenuItem onClick={() => window.electronAPI.openUrl('https://agents.craft.do/docs')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="flex-1">All Documentation</span>
                      </StyledDropdownMenuItem>
                    </StyledDropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sidebar Resize Handle (hidden in focused mode) */}
        {!effectiveFocusMode && (
        <div
          ref={resizeHandleRef}
          onMouseDown={(e) => { e.preventDefault(); setIsResizing('sidebar') }}
          onMouseMove={(e) => {
            if (resizeHandleRef.current) {
              const rect = resizeHandleRef.current.getBoundingClientRect()
              setSidebarHandleY(e.clientY - rect.top)
            }
          }}
          onMouseLeave={() => { if (!isResizing) setSidebarHandleY(null) }}
          className="absolute top-0 w-3 h-full cursor-col-resize z-panel flex justify-center"
          style={{
            left: isSidebarVisible ? sidebarWidth - 6 : -6,
            transition: isResizing === 'sidebar' ? undefined : 'left 0.15s ease-out',
          }}
        >
          <div
            className="w-0.5 h-full"
            style={getResizeGradientStyle(sidebarHandleY)}
          />
        </div>
        )}

        {/* === MAIN CONTENT (Right) === */}
        <div
          className="flex-1 overflow-hidden min-w-0 flex h-full"
          style={{ padding: PANEL_WINDOW_EDGE_SPACING, gap: PANEL_PANEL_SPACING / 2 }}
        >
          {/* === SESSION LIST PANEL === */}
          <motion.div
            initial={false}
            animate={{
              width: effectiveFocusMode ? 0 : sessionListWidth,
              opacity: effectiveFocusMode ? 0 : 1,
            }}
            transition={isResizing ? { duration: 0 } : springTransition}
            className="h-full shrink-0 overflow-hidden bg-background shadow-middle rounded-l-[14px] rounded-r-[10px]"
          >
            <div
              style={{ width: sessionListWidth }}
              className="h-full flex flex-col min-w-0 relative z-panel"
            >
            <PanelHeader
              title={isSidebarVisible ? listTitle : undefined}
              compensateForStoplight={!isSidebarVisible}
              actions={
                <>
                  {/* Filter dropdown */}
                  {isSessionsNavigation(navState) && (
                    <DropdownMenu onOpenChange={(open) => { if (!open) setFilterDropdownQuery('') }}>
                      <DropdownMenuTrigger asChild>
                        <HeaderIconButton
                          icon={<ListFilter className="h-4 w-4" />}
                          className={(listFilter.size > 0 || labelFilter.size > 0) ? "bg-accent/5 text-accent rounded-[8px] shadow-tinted" : "rounded-[8px]"}
                          style={(listFilter.size > 0 || labelFilter.size > 0) ? { '--shadow-color': 'var(--accent-rgb)' } as React.CSSProperties : undefined}
                        />
                      </DropdownMenuTrigger>
                      <StyledDropdownMenuContent
                        align="end"
                        light
                        minWidth="min-w-[200px]"
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'ArrowUp' && !filterDropdownQuery.trim()) {
                            const menu = (e.target as HTMLElement).closest('[role="menu"]')
                            const items = menu?.querySelectorAll('[role="menuitem"]')
                            if (items && items.length > 0 && document.activeElement === items[0]) {
                              e.preventDefault()
                              e.stopPropagation()
                              filterDropdownInputRef.current?.focus()
                            }
                          }
                        }}
                      >
                        {/* Header with title and clear button */}
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-xs font-medium text-muted-foreground">Filter Chats</span>
                          {(listFilter.size > 0 || labelFilter.size > 0) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                setListFilter(new Map())
                                setLabelFilter(new Map())
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        {/* Search input */}
                        <div className="px-1 pb-3 border-b border-foreground/5">
                          <div className="bg-background rounded-[6px] shadow-minimal px-2 py-1.5">
                            <input
                              ref={filterDropdownInputRef}
                              type="text"
                              value={filterDropdownQuery}
                              onChange={(e) => setFilterDropdownQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (!filterDropdownQuery.trim() && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                                  e.preventDefault()
                                  ;(e.target as HTMLInputElement).blur()
                                  const menu = (e.target as HTMLElement).closest('[role="menu"]')
                                  const firstItem = menu?.querySelector('[role="menuitem"]') as HTMLElement | null
                                  firstItem?.focus()
                                  return
                                }
                                e.stopPropagation()
                                const { states: ms, labels: ml } = filterDropdownResults
                                const total = ms.length + ml.length
                                if (total === 0) return
                                switch (e.key) {
                                  case 'ArrowDown':
                                    e.preventDefault()
                                    setFilterDropdownSelectedIdx(prev => (prev < total - 1 ? prev + 1 : 0))
                                    break
                                  case 'ArrowUp':
                                    e.preventDefault()
                                    setFilterDropdownSelectedIdx(prev => (prev > 0 ? prev - 1 : total - 1))
                                    break
                                  case 'Enter': {
                                    e.preventDefault()
                                    const idx = filterDropdownSelectedIdx
                                    if (idx < ms.length) {
                                      const s = ms[idx]
                                      if (s.id !== pinnedFilters.pinnedStatusId) {
                                        setListFilter(prev => {
                                          const next = new Map(prev)
                                          if (next.has(s.id)) next.delete(s.id)
                                          else next.set(s.id, 'include')
                                          return next
                                        })
                                      }
                                    } else {
                                      const item = ml[idx - ms.length]
                                      if (item && item.id !== pinnedFilters.pinnedLabelId) {
                                        setLabelFilter(prev => {
                                          const next = new Map(prev)
                                          if (next.has(item.id)) next.delete(item.id)
                                          else next.set(item.id, 'include')
                                          return next
                                        })
                                      }
                                    }
                                    break
                                  }
                                }
                              }}
                              placeholder="Search statuses & labels..."
                              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Conditional body: hierarchical vs flat filtered list */}
                        {filterDropdownQuery.trim() === '' ? (
                          <>
                            {/* === HIERARCHICAL MODE (default) === */}

                            {/* Active filter chips */}
                            {(pinnedFilters.pinnedFlagged || pinnedFilters.pinnedStatusId || pinnedFilters.pinnedLabelId || listFilter.size > 0 || labelFilter.size > 0) && (
                              <>
                                {pinnedFilters.pinnedFlagged && (
                                  <StyledDropdownMenuItem disabled>
                                    <FilterMenuRow
                                      icon={<Flag className="h-3.5 w-3.5" />}
                                      label="Flagged"
                                      accessory={<Check className="h-3 w-3 text-muted-foreground" />}
                                    />
                                  </StyledDropdownMenuItem>
                                )}
                                {(() => {
                                  if (!pinnedFilters.pinnedStatusId) return null
                                  const s = effectiveSessionStatuses.find(st => st.id === pinnedFilters.pinnedStatusId)
                                  if (!s) return null
                                  return (
                                    <StyledDropdownMenuItem disabled key={`pinned-status-${s.id}`}>
                                      <FilterMenuRow
                                        icon={s.icon}
                                        label={s.label}
                                        accessory={<Check className="h-3 w-3 text-muted-foreground" />}
                                        iconStyle={s.iconColorable ? { color: s.resolvedColor } : undefined}
                                        noIconContainer
                                      />
                                    </StyledDropdownMenuItem>
                                  )
                                })()}
                                {(() => {
                                  if (!pinnedFilters.pinnedLabelId) return null
                                  const label = findLabelById(labelConfigs, pinnedFilters.pinnedLabelId)
                                  if (!label) return null
                                  return (
                                    <StyledDropdownMenuItem disabled key={`pinned-label-${label.id}`}>
                                      <FilterMenuRow
                                        icon={<LabelIcon label={label} size="sm" />}
                                        label={label.name}
                                        accessory={<Check className="h-3 w-3 text-muted-foreground" />}
                                      />
                                    </StyledDropdownMenuItem>
                                  )
                                })()}
                                {effectiveSessionStatuses.filter(s => listFilter.has(s.id)).map(s => {
                                  const applyColor = s.iconColorable
                                  const mode = listFilter.get(s.id)!
                                  return (
                                    <DropdownMenuSub key={`sel-status-${s.id}`}>
                                      <StyledDropdownMenuSubTrigger onClick={(e) => { e.preventDefault(); setListFilter(prev => { const next = new Map(prev); next.delete(s.id); return next }) }}>
                                        <FilterMenuRow
                                          icon={s.icon}
                                          label={s.label}
                                          accessory={<FilterModeBadge mode={mode} />}
                                          iconStyle={applyColor ? { color: s.resolvedColor } : undefined}
                                          noIconContainer
                                        />
                                      </StyledDropdownMenuSubTrigger>
                                      <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                                        <FilterModeSubMenuItems
                                          mode={mode}
                                          onChangeMode={(newMode) => setListFilter(prev => {
                                            const next = new Map(prev)
                                            next.set(s.id, newMode)
                                            return next
                                          })}
                                          onRemove={() => setListFilter(prev => {
                                            const next = new Map(prev)
                                            next.delete(s.id)
                                            return next
                                          })}
                                        />
                                      </StyledDropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )
                                })}
                                {Array.from(labelFilter).map(([labelId, mode]) => {
                                  const label = findLabelById(labelConfigs, labelId)
                                  if (!label) return null
                                  return (
                                    <DropdownMenuSub key={`sel-label-${labelId}`}>
                                      <StyledDropdownMenuSubTrigger onClick={(e) => { e.preventDefault(); setLabelFilter(prev => { const next = new Map(prev); next.delete(labelId); return next }) }}>
                                        <FilterMenuRow
                                          icon={<LabelIcon label={label} size="sm" />}
                                          label={label.name}
                                          accessory={<FilterModeBadge mode={mode} />}
                                        />
                                      </StyledDropdownMenuSubTrigger>
                                      <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                                        <FilterModeSubMenuItems
                                          mode={mode}
                                          onChangeMode={(newMode) => setLabelFilter(prev => {
                                            const next = new Map(prev)
                                            next.set(labelId, newMode)
                                            return next
                                          })}
                                          onRemove={() => setLabelFilter(prev => {
                                            const next = new Map(prev)
                                            next.delete(labelId)
                                            return next
                                          })}
                                        />
                                      </StyledDropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )
                                })}
                                <StyledDropdownMenuSeparator />
                              </>
                            )}

                            {/* Statuses submenu */}
                            <DropdownMenuSub>
                              <StyledDropdownMenuSubTrigger>
                                <Inbox className="h-3.5 w-3.5" />
                                <span className="flex-1">Statuses</span>
                              </StyledDropdownMenuSubTrigger>
                              <StyledDropdownMenuSubContent minWidth="min-w-[180px]">
                                {effectiveSessionStatuses.map(s => {
                                  const applyColor = s.iconColorable
                                  const isPinned = s.id === pinnedFilters.pinnedStatusId
                                  const currentMode = listFilter.get(s.id)
                                  const isActive = !!currentMode && !isPinned
                                  if (isActive) {
                                    return (
                                      <DropdownMenuSub key={s.id}>
                                        <StyledDropdownMenuSubTrigger onClick={(e) => { e.preventDefault(); setListFilter(prev => { const next = new Map(prev); next.delete(s.id); return next }) }}>
                                          <FilterMenuRow
                                            icon={s.icon}
                                            label={s.label}
                                            accessory={<FilterModeBadge mode={currentMode} />}
                                            iconStyle={applyColor ? { color: s.resolvedColor } : undefined}
                                            noIconContainer
                                          />
                                        </StyledDropdownMenuSubTrigger>
                                        <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                                          <FilterModeSubMenuItems
                                            mode={currentMode}
                                            onChangeMode={(newMode) => setListFilter(prev => {
                                              const next = new Map(prev)
                                              next.set(s.id, newMode)
                                              return next
                                            })}
                                            onRemove={() => setListFilter(prev => {
                                              const next = new Map(prev)
                                              next.delete(s.id)
                                              return next
                                            })}
                                          />
                                        </StyledDropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    )
                                  }
                                  return (
                                    <StyledDropdownMenuItem
                                      key={s.id}
                                      disabled={isPinned}
                                      onClick={(e) => {
                                        if (isPinned) return
                                        e.preventDefault()
                                        setListFilter(prev => {
                                          const next = new Map(prev)
                                          if (next.has(s.id)) next.delete(s.id)
                                          else next.set(s.id, 'include')
                                          return next
                                        })
                                      }}
                                    >
                                      <FilterMenuRow
                                        icon={s.icon}
                                        label={s.label}
                                        accessory={isPinned ? <Check className="h-3 w-3 text-muted-foreground" /> : null}
                                        iconStyle={applyColor ? { color: s.resolvedColor } : undefined}
                                        noIconContainer
                                      />
                                    </StyledDropdownMenuItem>
                                  )
                                })}
                              </StyledDropdownMenuSubContent>
                            </DropdownMenuSub>

                            {/* Labels submenu */}
                            <DropdownMenuSub>
                              <StyledDropdownMenuSubTrigger>
                                <Tag className="h-3.5 w-3.5" />
                                <span className="flex-1">Labels</span>
                              </StyledDropdownMenuSubTrigger>
                              <StyledDropdownMenuSubContent minWidth="min-w-[180px]">
                                {labelConfigs.length === 0 ? (
                                  <StyledDropdownMenuItem disabled>
                                    <span className="text-muted-foreground">No labels configured</span>
                                  </StyledDropdownMenuItem>
                                ) : (
                                  <FilterLabelItems
                                    labels={labelConfigs}
                                    labelFilter={labelFilter}
                                    setLabelFilter={setLabelFilter}
                                    pinnedLabelId={pinnedFilters.pinnedLabelId}
                                  />
                                )}
                              </StyledDropdownMenuSubContent>
                            </DropdownMenuSub>

                            <StyledDropdownMenuSeparator />
                            <StyledDropdownMenuItem
                              onClick={() => {
                                setSearchActive(true)
                              }}
                            >
                              <Search className="h-3.5 w-3.5" />
                              <span className="flex-1">Search</span>
                            </StyledDropdownMenuItem>
                          </>
                        ) : (
                          <>
                            {/* === FLAT FILTERED MODE (has query) === */}
                            {filterDropdownResults.states.length === 0 && filterDropdownResults.labels.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                No matching statuses or labels
                              </div>
                            ) : (
                              <div ref={filterDropdownListRef} className="max-h-[240px] overflow-y-auto py-1">
                                {filterDropdownResults.states.length > 0 && (
                                  <>
                                    <div className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                      Statuses
                                    </div>
                                    {filterDropdownResults.states.map((s, index) => {
                                      const applyColor = s.iconColorable
                                      const isPinned = s.id === pinnedFilters.pinnedStatusId
                                      const currentMode = listFilter.get(s.id)
                                      const isHighlighted = index === filterDropdownSelectedIdx
                                      const isActive = !!currentMode && !isPinned
                                      if (isActive) {
                                        return (
                                          <DropdownMenuSub key={`flat-status-${s.id}`}>
                                            <StyledDropdownMenuSubTrigger
                                              data-filter-selected={isHighlighted}
                                              onMouseEnter={() => setFilterDropdownSelectedIdx(index)}
                                              className={cn("mx-1", isHighlighted && "bg-foreground/5")}
                                              onClick={(e) => { e.preventDefault(); setListFilter(prev => { const next = new Map(prev); next.delete(s.id); return next }) }}
                                            >
                                              <FilterMenuRow
                                                icon={s.icon}
                                                label={s.label}
                                                accessory={<FilterModeBadge mode={currentMode} />}
                                                iconStyle={applyColor ? { color: s.resolvedColor } : undefined}
                                                noIconContainer
                                              />
                                            </StyledDropdownMenuSubTrigger>
                                            <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                                              <FilterModeSubMenuItems
                                                mode={currentMode}
                                                onChangeMode={(newMode) => setListFilter(prev => {
                                                  const next = new Map(prev)
                                                  next.set(s.id, newMode)
                                                  return next
                                                })}
                                                onRemove={() => setListFilter(prev => {
                                                  const next = new Map(prev)
                                                  next.delete(s.id)
                                                  return next
                                                })}
                                              />
                                            </StyledDropdownMenuSubContent>
                                          </DropdownMenuSub>
                                        )
                                      }
                                      return (
                                        <div
                                          key={`flat-status-${s.id}`}
                                          data-filter-selected={isHighlighted}
                                          onMouseEnter={() => setFilterDropdownSelectedIdx(index)}
                                          onClick={(e) => {
                                            if (isPinned) return
                                            e.preventDefault()
                                            setListFilter(prev => {
                                              const next = new Map(prev)
                                              if (next.has(s.id)) next.delete(s.id)
                                              else next.set(s.id, 'include')
                                              return next
                                            })
                                          }}
                                          className={cn(
                                            "flex cursor-pointer select-none items-center gap-2 rounded-[4px] mx-1 px-2 py-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
                                            isHighlighted && "bg-foreground/5",
                                            isPinned && "opacity-50 pointer-events-none",
                                          )}
                                        >
                                          <FilterMenuRow
                                            icon={s.icon}
                                            label={s.label}
                                            accessory={isPinned ? <Check className="h-3 w-3 text-muted-foreground" /> : null}
                                            iconStyle={applyColor ? { color: s.resolvedColor } : undefined}
                                            noIconContainer
                                          />
                                        </div>
                                      )
                                    })}
                                  </>
                                )}
                                {filterDropdownResults.states.length > 0 && filterDropdownResults.labels.length > 0 && (
                                  <div className="my-1 mx-2 border-t border-border/40" />
                                )}
                                {filterDropdownResults.labels.length > 0 && (
                                  <>
                                    <div className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                                      Labels
                                    </div>
                                    {filterDropdownResults.labels.map((item, index) => {
                                      const flatIndex = filterDropdownResults.states.length + index
                                      const isPinned = item.id === pinnedFilters.pinnedLabelId
                                      const currentMode = labelFilter.get(item.id)
                                      const isHighlighted = flatIndex === filterDropdownSelectedIdx
                                      const isActive = !!currentMode && !isPinned
                                      const labelDisplay = item.parentPath
                                        ? <><span className="text-muted-foreground">{item.parentPath}</span>{item.label}</>
                                        : item.label
                                      if (isActive) {
                                        return (
                                          <DropdownMenuSub key={`flat-label-${item.id}`}>
                                            <StyledDropdownMenuSubTrigger
                                              data-filter-selected={isHighlighted}
                                              onMouseEnter={() => setFilterDropdownSelectedIdx(flatIndex)}
                                              className={cn("mx-1", isHighlighted && "bg-foreground/5")}
                                              onClick={(e) => { e.preventDefault(); setLabelFilter(prev => { const next = new Map(prev); next.delete(item.id); return next }) }}
                                            >
                                              <FilterMenuRow
                                                icon={<LabelIcon label={item.config} size="sm" />}
                                                label={labelDisplay}
                                                accessory={<FilterModeBadge mode={currentMode} />}
                                              />
                                            </StyledDropdownMenuSubTrigger>
                                            <StyledDropdownMenuSubContent minWidth="min-w-[140px]">
                                              <FilterModeSubMenuItems
                                                mode={currentMode}
                                                onChangeMode={(newMode) => setLabelFilter(prev => {
                                                  const next = new Map(prev)
                                                  next.set(item.id, newMode)
                                                  return next
                                                })}
                                                onRemove={() => setLabelFilter(prev => {
                                                  const next = new Map(prev)
                                                  next.delete(item.id)
                                                  return next
                                                })}
                                              />
                                            </StyledDropdownMenuSubContent>
                                          </DropdownMenuSub>
                                        )
                                      }
                                      return (
                                        <div
                                          key={`flat-label-${item.id}`}
                                          data-filter-selected={isHighlighted}
                                          onMouseEnter={() => setFilterDropdownSelectedIdx(flatIndex)}
                                          onClick={(e) => {
                                            if (isPinned) return
                                            e.preventDefault()
                                            setLabelFilter(prev => {
                                              const next = new Map(prev)
                                              if (next.has(item.id)) next.delete(item.id)
                                              else next.set(item.id, 'include')
                                              return next
                                            })
                                          }}
                                          className={cn(
                                            "flex cursor-pointer select-none items-center gap-2 rounded-[4px] mx-1 px-2 py-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
                                            isHighlighted && "bg-foreground/5",
                                            isPinned && "opacity-50 pointer-events-none",
                                          )}
                                        >
                                          <FilterMenuRow
                                            icon={<LabelIcon label={item.config} size="sm" />}
                                            label={labelDisplay}
                                            accessory={isPinned ? <Check className="h-3 w-3 text-muted-foreground" /> : null}
                                          />
                                        </div>
                                      )
                                    })}
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </StyledDropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {/* Add Source button (only for sources mode) */}
                  {isSourcesNavigation(navState) && activeWorkspace && (
                    <EditPopover
                      trigger={
                        <HeaderIconButton
                          icon={<Plus className="h-4 w-4" />}
                          tooltip="Add Source"
                          data-tutorial="add-source-button"
                        />
                      }
                      {...getEditConfig(
                        sourceFilter?.kind === 'type' ? `add-source-${sourceFilter.sourceType}` as EditContextKey : 'add-source',
                        activeWorkspace.rootPath
                      )}
                    />
                  )}
                  {/* Add Skill button (only for skills mode) */}
                  {isSkillsNavigation(navState) && activeWorkspace && (
                    <EditPopover
                      trigger={
                        <HeaderIconButton
                          icon={<Plus className="h-4 w-4" />}
                          tooltip="Add Skill"
                          data-tutorial="add-skill-button"
                        />
                      }
                      {...getEditConfig('add-skill', activeWorkspace.rootPath)}
                    />
                  )}
                </>
              }
            />
            {/* Content */}
            {isSourcesNavigation(navState) && (
              <SourcesListPanel
                sources={sources}
                sourceFilter={sourceFilter}
                workspaceRootPath={activeWorkspace?.rootPath}
                onDeleteSource={handleDeleteSource}
                onSourceClick={handleSourceSelect}
                selectedSourceSlug={isSourcesNavigation(navState) && navState.details ? navState.details.sourceSlug : null}
                localMcpEnabled={localMcpEnabled}
              />
            )}
            {isSkillsNavigation(navState) && activeWorkspaceId && (
              <SkillsListPanel
                skills={skills}
                workspaceId={activeWorkspaceId}
                workspaceRootPath={activeWorkspace?.rootPath}
                onSkillClick={handleSkillSelect}
                onDeleteSkill={handleDeleteSkill}
                selectedSkillSlug={isSkillsNavigation(navState) && navState.details?.type === 'skill' ? navState.details.skillSlug : null}
              />
            )}
            {isSettingsNavigation(navState) && (
              <SettingsNavigator
                selectedSubpage={navState.subpage}
                onSelectSubpage={(subpage) => handleSettingsClick(subpage)}
              />
            )}
            {isSessionsNavigation(navState) && (
              <>
                <SessionList
                  key={sessionFilter?.kind}
                  items={searchActive ? workspaceSessionMetas : filteredSessionMetas}
                  onDelete={handleDeleteSession}
                  onFlag={onFlagSession}
                  onUnflag={onUnflagSession}
                  onArchive={onArchiveSession}
                  onUnarchive={onUnarchiveSession}
                  onMarkUnread={onMarkSessionUnread}
                  onSessionStatusChange={onSessionStatusChange}
                  onRename={onRenameSession}
                  onFocusChatInput={focusChatInput}
                  onSessionSelect={(selectedMeta) => {
                    navigateToSession(selectedMeta.id)
                  }}
                  onOpenInNewWindow={(selectedMeta) => {
                    if (activeWorkspaceId) {
                      window.electronAPI.openSessionInNewWindow(activeWorkspaceId, selectedMeta.id)
                    }
                  }}
                  onNavigateToView={(view) => {
                    if (view === 'allSessions') {
                      navigate(routes.view.allSessions())
                    } else if (view === 'flagged') {
                      navigate(routes.view.flagged())
                    }
                  }}
                  sessionOptions={sessionOptions}
                  searchActive={searchActive}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onSearchClose={() => {
                    setSearchActive(false)
                    setSearchQuery('')
                  }}
                  sessionStatuses={effectiveSessionStatuses}
                  evaluateViews={evaluateViews}
                  labels={labelConfigs}
                  onLabelsChange={handleSessionLabelsChange}
                  workspaceId={activeWorkspaceId ?? undefined}
                  statusFilter={listFilter}
                  labelFilterMap={labelFilter}
                />
              </>
            )}
            </div>
          </motion.div>

          {/* Session List Resize Handle (hidden in focused mode) */}
          {!effectiveFocusMode && (
          <div
            ref={sessionListHandleRef}
            onMouseDown={(e) => { e.preventDefault(); setIsResizing('session-list') }}
            onMouseMove={(e) => {
              if (sessionListHandleRef.current) {
                const rect = sessionListHandleRef.current.getBoundingClientRect()
                setSessionListHandleY(e.clientY - rect.top)
              }
            }}
            onMouseLeave={() => { if (isResizing !== 'session-list') setSessionListHandleY(null) }}
            className="relative w-0 h-full cursor-col-resize flex justify-center shrink-0"
          >
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 flex justify-center cursor-col-resize">
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5"
                style={getResizeGradientStyle(sessionListHandleY)}
              />
            </div>
          </div>
          )}

          {/* === MAIN CONTENT PANEL === */}
          <div className={cn(
            "flex-1 overflow-hidden min-w-0 bg-foreground-2 shadow-middle",
            effectiveFocusMode ? "rounded-l-[14px]" : "rounded-l-[10px]",
            isRightSidebarVisible ? "rounded-r-[10px]" : "rounded-r-[14px]"
          )}>
            <MainContentPanel isFocusedMode={effectiveFocusMode} />
          </div>

          {/* Right Sidebar - Inline Mode */}
          {!shouldUseOverlay && (
            <>
              {isRightSidebarVisible && (
                <div
                  ref={rightSidebarHandleRef}
                  onMouseDown={(e) => { e.preventDefault(); setIsResizing('right-sidebar') }}
                  onMouseMove={(e) => {
                    if (rightSidebarHandleRef.current) {
                      const rect = rightSidebarHandleRef.current.getBoundingClientRect()
                      setRightSidebarHandleY(e.clientY - rect.top)
                    }
                  }}
                  onMouseLeave={() => { if (isResizing !== 'right-sidebar') setRightSidebarHandleY(null) }}
                  className="relative w-0 h-full cursor-col-resize flex justify-center shrink-0"
                >
                  <div className="absolute inset-y-0 -left-1.5 -right-1.5 flex justify-center cursor-col-resize">
                    <div
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5"
                      style={getResizeGradientStyle(rightSidebarHandleY)}
                    />
                  </div>
                </div>
              )}

              <motion.div
                initial={false}
                animate={{
                  width: isRightSidebarVisible ? rightSidebarWidth : 0,
                  marginLeft: isRightSidebarVisible ? 0 : -PANEL_PANEL_SPACING / 2,
                }}
                transition={isResizing === 'right-sidebar' || skipRightSidebarAnimation ? { duration: 0 } : springTransition}
                className="h-full shrink-0 overflow-visible"
              >
                <motion.div
                  initial={false}
                  animate={{
                    x: isRightSidebarVisible ? 0 : rightSidebarWidth + PANEL_PANEL_SPACING / 2,
                    opacity: isRightSidebarVisible ? 1 : 0,
                  }}
                  transition={isResizing === 'right-sidebar' || skipRightSidebarAnimation ? { duration: 0 } : springTransition}
                  className="h-full bg-foreground-2 shadow-middle rounded-l-[10px] rounded-r-[14px]"
                  style={{ width: rightSidebarWidth }}
                >
                  <RightSidebar
                    panel={{ type: 'sessionMetadata' }}
                    sessionId={isSessionsNavigation(navState) && navState.details ? navState.details.sessionId : undefined}
                    closeButton={rightSidebarCloseButton}
                  />
                </motion.div>
              </motion.div>
            </>
          )}

          {/* Right Sidebar - Overlay Mode */}
          {shouldUseOverlay && (
            <AnimatePresence>
              {isRightSidebarVisible && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={skipRightSidebarAnimation ? { duration: 0 } : { duration: 0.2 }}
                    className="fixed inset-0 bg-black/25 z-overlay"
                    onClick={() => setIsRightSidebarVisible(false)}
                  />
                  <motion.div
                    initial={{ x: 316 }}
                    animate={{ x: 0 }}
                    exit={{ x: 316 }}
                    transition={skipRightSidebarAnimation ? { duration: 0 } : springTransition}
                    className="fixed inset-y-0 right-0 w-[316px] h-screen z-overlay p-1.5"
                  >
                    <div className="h-full bg-foreground-2 overflow-hidden shadow-strong rounded-[12px]">
                      <RightSidebar
                        panel={{ type: 'sessionMetadata' }}
                        sessionId={isSessionsNavigation(navState) && navState.details ? navState.details.sessionId : undefined}
                        closeButton={rightSidebarCloseButton}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Context menu triggered edit popovers */}
      {activeWorkspace && (
        <EditPopovers
          activeWorkspace={activeWorkspace}
          sidebarWidth={sidebarWidth}
          editPopoverOpen={editPopoverOpen}
          setEditPopoverOpen={setEditPopoverOpen}
          editPopoverAnchorY={editPopoverAnchorY}
          editLabelTargetId={editLabelTargetId}
          labelConfigs={labelConfigs}
        />
      )}

      {/* What's New overlay */}
      <DocumentFormattedMarkdownOverlay
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        content={releaseNotesContent}
        onOpenUrl={(url) => window.electronAPI.openUrl(url)}
      />

    </AppShellProvider>
  )
}
