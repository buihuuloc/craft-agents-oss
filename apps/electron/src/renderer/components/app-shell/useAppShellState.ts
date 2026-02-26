import * as React from "react"
import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useSession } from "@/hooks/useSession"
import { ensureSessionMessagesLoadedAtom, sessionMetaMapAtom, type SessionMeta } from "@/atoms/sessions"
import { sourcesAtom } from "@/atoms/sources"
import { skillsAtom } from "@/atoms/skills"
import { type AppShellContextType } from "@/context/AppShellContext"
import { useEscapeInterrupt } from "@/context/EscapeInterruptContext"
import { useTheme } from "@/context/ThemeContext"
import { useAction, useActionLabel } from "@/actions"
import { useFocusZone } from "@/hooks/keyboard"
import { useFocusContext } from "@/context/FocusContext"
import {
  useNavigation,
  useNavigationState,
  isSessionsNavigation,
  isSourcesNavigation,
  isSettingsNavigation,
  isSkillsNavigation,
} from "@/contexts/NavigationContext"
import { type SessionStatusId, type SessionStatus, statusConfigsToSessionStatuses } from "@/config/session-status-config"
import { useStatuses } from "@/hooks/useStatuses"
import { useLabels } from "@/hooks/useLabels"
import { useViews } from "@/hooks/useViews"
import { buildLabelTree, flattenLabels, extractLabelId, getDescendantIds } from "@craft-agent/shared/labels"
import type { LabelConfig } from "@craft-agent/shared/labels"
import { filterItems as filterLabelMenuItems, filterSessionStatuses as filterLabelMenuStates, type LabelMenuItem } from "@/components/ui/label-menu"
import * as storage from "@/lib/local-storage"
import { navigate, routes } from "@/lib/navigate"
import { toast } from "sonner"
import { hasOpenOverlay } from "@/lib/overlay-detection"
import { clearSourceIconCaches } from "@/lib/icon-cache"
import type { Session, Workspace, LoadedSource, LoadedSkill, PermissionMode, SourceFilter, SettingsSubpage } from "../../../shared/types"
import type { ChatDisplayHandle } from "./ChatDisplay"
import type { RichTextInputHandle } from "@/components/ui/rich-text-input"
import { useSessionFiltering, type ViewFiltersMap } from "./useSessionFiltering"
import type { EditPopoverType } from "./EditPopovers"

interface AppShellProps {
  contextValue: AppShellContextType
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  menuNewChatTrigger?: number
  isFocusedMode?: boolean
}

export function useAppShellState({
  contextValue,
  defaultCollapsed = false,
  menuNewChatTrigger,
  isFocusedMode = false,
}: AppShellProps) {
  // Destructure commonly used values from context
  const {
    workspaces,
    activeWorkspaceId,
    sessionOptions,
    onSelectWorkspace,
    onRefreshWorkspaces,
    onCreateSession,
    onDeleteSession,
    onFlagSession,
    onUnflagSession,
    onArchiveSession,
    onUnarchiveSession,
    onMarkSessionRead,
    onMarkSessionUnread,
    onSessionStatusChange,
    onRenameSession,
    onOpenSettings,
    onOpenKeyboardShortcuts,
    onOpenStoredUserPreferences,
    onReset,
    onSendMessage,
    openNewChat,
  } = contextValue

  // Get hotkey labels from centralized action registry
  const newChatHotkey = useActionLabel('app.newChat').hotkey

  // ============================================================================
  // SIDEBAR STATE
  // ============================================================================
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(() => {
    return storage.get(storage.KEYS.sidebarVisible, !defaultCollapsed)
  })
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    return storage.get(storage.KEYS.sidebarWidth, 220)
  })
  const [sessionListWidth, setSessionListWidth] = React.useState(() => {
    return storage.get(storage.KEYS.sessionListWidth, 300)
  })

  // Right sidebar state (min 280, max 480)
  const [isRightSidebarVisible, setIsRightSidebarVisible] = React.useState(() => {
    return storage.get(storage.KEYS.rightSidebarVisible, false)
  })
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(() => {
    return storage.get(storage.KEYS.rightSidebarWidth, 300)
  })
  const [skipRightSidebarAnimation, setSkipRightSidebarAnimation] = React.useState(false)

  // ============================================================================
  // FOCUS MODE STATE
  // ============================================================================
  const [isFocusModeActive, setIsFocusModeActive] = React.useState(() => {
    return storage.get(storage.KEYS.focusModeEnabled, false)
  })
  const effectiveFocusMode = isFocusedMode || isFocusModeActive

  // ============================================================================
  // WHAT'S NEW OVERLAY
  // ============================================================================
  const [showWhatsNew, setShowWhatsNew] = React.useState(false)
  const [releaseNotesContent, setReleaseNotesContent] = React.useState('')
  const [hasUnseenReleaseNotes, setHasUnseenReleaseNotes] = React.useState(false)

  useEffect(() => {
    window.electronAPI.getLatestReleaseVersion().then((latestVersion) => {
      if (!latestVersion) return
      const lastSeen = storage.get(storage.KEYS.whatsNewLastSeenVersion, '')
      setHasUnseenReleaseNotes(lastSeen !== latestVersion)
    })
  }, [])

  // ============================================================================
  // WINDOW SIZE & RESPONSIVE BEHAVIOR
  // ============================================================================
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth)
  const MIN_INLINE_SPACE = 600
  const leftSidebarEffectiveWidth = isSidebarVisible ? sidebarWidth : 0
  const OVERLAY_THRESHOLD = MIN_INLINE_SPACE + leftSidebarEffectiveWidth + sessionListWidth
  const shouldUseOverlay = windowWidth < OVERLAY_THRESHOLD

  // ============================================================================
  // RESIZE STATE
  // ============================================================================
  const [isResizing, setIsResizing] = React.useState<'sidebar' | 'session-list' | 'right-sidebar' | null>(null)
  const [sidebarHandleY, setSidebarHandleY] = React.useState<number | null>(null)
  const [sessionListHandleY, setSessionListHandleY] = React.useState<number | null>(null)
  const [rightSidebarHandleY, setRightSidebarHandleY] = React.useState<number | null>(null)
  const resizeHandleRef = React.useRef<HTMLDivElement>(null)
  const sessionListHandleRef = React.useRef<HTMLDivElement>(null)
  const rightSidebarHandleRef = React.useRef<HTMLDivElement>(null)

  // ============================================================================
  // SESSION & NAVIGATION
  // ============================================================================
  const [session, setSession] = useSession()
  const { resolvedMode, isDark, setMode } = useTheme()
  const { canGoBack, canGoForward, goBack, goForward, navigateToSource, navigateToSession } = useNavigation()
  const { handleEscapePress } = useEscapeInterrupt()
  const navState = useNavigationState()

  // Derive chat filter from navigation state
  const sessionFilter = isSessionsNavigation(navState) ? navState.filter : null
  const sourceFilter: SourceFilter | null = isSourcesNavigation(navState) ? navState.filter ?? null : null

  // ============================================================================
  // SEARCH STATE
  // ============================================================================
  const [searchActive, setSearchActive] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Ref for ChatDisplay navigation
  const chatDisplayRef = React.useRef<ChatDisplayHandle>(null)
  const [chatMatchInfo, setChatMatchInfo] = React.useState<{ count: number; index: number }>({ count: 0, index: 0 })

  const handleChatMatchInfoChange = React.useCallback((info: { count: number; index: number }) => {
    setChatMatchInfo(info)
  }, [])

  React.useEffect(() => {
    if (!searchActive || !searchQuery) {
      setChatMatchInfo({ count: 0, index: 0 })
    }
  }, [searchActive, searchQuery])

  // Reset search only when navigator or filter changes
  const navFilterKey = React.useMemo(() => {
    if (isSessionsNavigation(navState)) {
      const filter = navState.filter
      return `chats:${filter.kind}:${filter.kind === 'state' ? filter.stateId : ''}`
    }
    return navState.navigator
  }, [navState])

  React.useEffect(() => {
    setSearchActive(false)
    setSearchQuery('')
  }, [navFilterKey])

  // Auto-hide right sidebar when navigating away from chat sessions
  React.useEffect(() => {
    if (!isSessionsNavigation(navState) || !navState.details) {
      setSkipRightSidebarAnimation(true)
      setIsRightSidebarVisible(false)
      setTimeout(() => setSkipRightSidebarAnimation(false), 0)
    }
  }, [navState])

  // Cmd+F to activate search
  useAction('app.search', () => setSearchActive(true))

  // Track window width for responsive right sidebar behavior
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ============================================================================
  // SIDEBAR NAVIGATION STATE
  // ============================================================================
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(() => {
    const saved = storage.get<string[]>(storage.KEYS.expandedFolders, [])
    return new Set(saved)
  })
  const [focusedSidebarItemId, setFocusedSidebarItemId] = React.useState<string | null>(null)
  const sidebarItemRefs = React.useRef<Map<string, HTMLElement>>(new Map())
  const [collapsedItems, setCollapsedItems] = React.useState<Set<string>>(() => {
    const saved = storage.get<string[] | null>(storage.KEYS.collapsedSidebarItems, null)
    if (saved !== null) return new Set(saved)
    return new Set(['nav:labels'])
  })
  const isExpanded = React.useCallback((id: string) => !collapsedItems.has(id), [collapsedItems])
  const toggleExpanded = React.useCallback((id: string) => {
    setCollapsedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ============================================================================
  // SOURCES & SKILLS STATE
  // ============================================================================
  const [sources, setSources] = React.useState<LoadedSource[]>([])
  const setSourcesAtom = useSetAtom(sourcesAtom)
  React.useEffect(() => {
    setSourcesAtom(sources)
  }, [sources, setSourcesAtom])

  const [skills, setSkills] = React.useState<LoadedSkill[]>([])
  const setSkillsAtom = useSetAtom(skillsAtom)
  React.useEffect(() => {
    setSkillsAtom(skills)
  }, [skills, setSkillsAtom])

  const [localMcpEnabled, setLocalMcpEnabled] = React.useState(true)
  const [enabledModes, setEnabledModes] = React.useState<PermissionMode[]>(['safe', 'ask', 'allow-all'])

  // Load workspace settings on workspace change
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getWorkspaceSettings(activeWorkspaceId).then((settings) => {
      if (settings) {
        setLocalMcpEnabled(settings.localMcpEnabled ?? true)
        if (settings.cyclablePermissionModes && settings.cyclablePermissionModes.length >= 2) {
          setEnabledModes(settings.cyclablePermissionModes)
        }
      }
    }).catch((err) => {
      console.error('[Chat] Failed to load workspace settings:', err)
    })
  }, [activeWorkspaceId])

  // Reset UI state when workspace changes
  const previousWorkspaceRef = React.useRef<string | null>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)

  // ============================================================================
  // DYNAMIC STATUS CONFIGS
  // ============================================================================
  const { statuses: statusConfigs, isLoading: isLoadingStatuses } = useStatuses(activeWorkspace?.id || null)
  const [sessionStatuses, setSessionStatuses] = React.useState<SessionStatus[]>([])

  React.useEffect(() => {
    if (!activeWorkspace?.id || statusConfigs.length === 0) {
      setSessionStatuses([])
      return
    }
    setSessionStatuses(statusConfigsToSessionStatuses(statusConfigs, activeWorkspace.id, isDark))
  }, [statusConfigs, activeWorkspace?.id, isDark])

  const [optimisticStatusOrder, setOptimisticStatusOrder] = React.useState<string[] | null>(null)
  React.useEffect(() => {
    setOptimisticStatusOrder(null)
  }, [statusConfigs])

  const effectiveSessionStatuses = React.useMemo(() => {
    if (!optimisticStatusOrder) return sessionStatuses
    const stateMap = new Map(sessionStatuses.map(s => [s.id, s]))
    const reordered: SessionStatus[] = []
    for (const id of optimisticStatusOrder) {
      const state = stateMap.get(id)
      if (state) reordered.push(state)
    }
    for (const state of sessionStatuses) {
      if (!optimisticStatusOrder.includes(state.id)) reordered.push(state)
    }
    return reordered
  }, [sessionStatuses, optimisticStatusOrder])

  // ============================================================================
  // LABELS & VIEWS
  // ============================================================================
  const { labels: labelConfigs } = useLabels(activeWorkspace?.id || null)
  const { evaluateSession: evaluateViews, viewConfigs } = useViews(activeWorkspace?.id || null)
  const labelTree = useMemo(() => buildLabelTree(labelConfigs), [labelConfigs])

  // Build flat LabelMenuItem[] for the filter dropdown's search mode
  const flatLabelMenuItems = useMemo((): LabelMenuItem[] => {
    const flat = flattenLabels(labelConfigs)
    const findParentPath = (tree: LabelConfig[], targetId: string, path: string[]): string[] | null => {
      for (const node of tree) {
        if (node.id === targetId) return path
        if (node.children) {
          const result = findParentPath(node.children, targetId, [...path, node.name])
          if (result) return result
        }
      }
      return null
    }
    return flat.map(label => {
      let parentPath: string | undefined
      const pathParts = findParentPath(labelConfigs, label.id, [])
      if (pathParts && pathParts.length > 0) {
        parentPath = pathParts.join(' / ') + ' / '
      }
      return { id: label.id, label: label.name, config: label, parentPath }
    })
  }, [labelConfigs])

  // ============================================================================
  // SESSION METADATA (from Jotai atom - lightweight, no messages)
  // ============================================================================
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)

  const workspaceSessionMetas = useMemo(() => {
    const metas = Array.from(sessionMetaMap.values())
    return activeWorkspaceId
      ? metas.filter(s => s.workspaceId === activeWorkspaceId && !s.hidden)
      : metas.filter(s => !s.hidden)
  }, [sessionMetaMap, activeWorkspaceId])

  const activeSessionMetas = useMemo(() => {
    return workspaceSessionMetas.filter(s => !s.isArchived)
  }, [workspaceSessionMetas])

  // ============================================================================
  // SESSION FILTERING (delegated to custom hook)
  // ============================================================================
  const sessionFiltering = useSessionFiltering({
    sessionFilter,
    workspaceSessionMetas,
    activeSessionMetas,
    labelConfigs,
    effectiveSessionStatuses,
    flatLabelMenuItems,
    evaluateViews,
    activeWorkspaceId,
  })

  // Destructure for convenience
  const {
    viewFiltersMap,
    setViewFiltersMap,
    listFilter,
    setListFilter,
    labelFilter,
    setLabelFilter,
    sessionFilterKey,
    filteredSessionMetas,
    pinnedFilters,
    filterDropdownResults,
    filterDropdownQuery,
    setFilterDropdownQuery,
    filterDropdownSelectedIdx,
    setFilterDropdownSelectedIdx,
    filterDropdownListRef,
    filterDropdownInputRef,
  } = sessionFiltering

  // ============================================================================
  // COUNTS
  // ============================================================================
  const flaggedCount = activeSessionMetas.filter(s => s.isFlagged).length
  const archivedCount = workspaceSessionMetas.filter(s => s.isArchived).length

  const labelCounts = useMemo(() => {
    const allLabels = flattenLabels(labelConfigs)
    const counts: Record<string, number> = {}
    for (const label of allLabels) {
      const directCount = activeSessionMetas.filter(
        s => s.labels?.some(l => extractLabelId(l) === label.id)
      ).length
      counts[label.id] = directCount
    }
    for (const label of allLabels) {
      const descendants = getDescendantIds(labelConfigs, label.id)
      if (descendants.length > 0) {
        const descendantCount = activeSessionMetas.filter(
          s => s.labels?.some(l => descendants.includes(extractLabelId(l)))
        ).length
        counts[label.id] = (counts[label.id] || 0) + descendantCount
      }
    }
    return counts
  }, [activeSessionMetas, labelConfigs])

  const sessionStatusCounts = useMemo(() => {
    const counts: Record<SessionStatusId, number> = {}
    for (const state of effectiveSessionStatuses) {
      counts[state.id] = 0
    }
    for (const s of activeSessionMetas) {
      const state = (s.sessionStatus || 'todo') as SessionStatusId
      counts[state] = (counts[state] || 0) + 1
    }
    return counts
  }, [activeSessionMetas, effectiveSessionStatuses])

  const sourceTypeCounts = useMemo(() => {
    const counts = { api: 0, mcp: 0, local: 0 }
    for (const source of sources) {
      const t = source.config.type
      if (t === 'api' || t === 'mcp' || t === 'local') {
        counts[t]++
      }
    }
    return counts
  }, [sources])

  // ============================================================================
  // WORKSPACE CHANGE EFFECTS
  // ============================================================================
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    const previousWorkspaceId = previousWorkspaceRef.current

    if (previousWorkspaceId !== null && previousWorkspaceId !== activeWorkspaceId) {
      setSearchActive(false)
      setSearchQuery('')
      setFilterDropdownQuery('')
      setFilterDropdownSelectedIdx(0)
      setFocusedSidebarItemId(null)
    }

    if (previousWorkspaceId !== activeWorkspaceId) {
      const newViewFilters = storage.get<ViewFiltersMap>(storage.KEYS.viewFilters, {}, activeWorkspaceId)
      setViewFiltersMap(newViewFilters)

      const newExpandedFolders = storage.get<string[]>(storage.KEYS.expandedFolders, [], activeWorkspaceId)
      setExpandedFolders(new Set(newExpandedFolders))

      const newCollapsedItems = storage.get<string[] | null>(storage.KEYS.collapsedSidebarItems, null, activeWorkspaceId)
      setCollapsedItems(newCollapsedItems !== null ? new Set(newCollapsedItems) : new Set(['nav:labels']))
    }

    previousWorkspaceRef.current = activeWorkspaceId
  }, [activeWorkspaceId])

  // Load sources from backend
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getSources(activeWorkspaceId).then((loaded) => {
      setSources(loaded || [])
    }).catch(err => {
      console.error('[Chat] Failed to load sources:', err)
    })
  }, [activeWorkspaceId])

  // Subscribe to live source updates
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSourcesChanged((updatedSources) => {
      clearSourceIconCaches()
      setSources(updatedSources || [])
    })
    return cleanup
  }, [])

  // Subscribe to live skill updates
  React.useEffect(() => {
    const cleanup = window.electronAPI.onSkillsChanged?.((updatedSkills) => {
      setSkills(updatedSkills || [])
    })
    return cleanup
  }, [])

  // Reload skills when active session's workingDirectory changes
  const activeSessionWorkingDirectory = session.selected
    ? sessionMetaMap.get(session.selected)?.workingDirectory
    : undefined
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getSkills(activeWorkspaceId, activeSessionWorkingDirectory).then((loaded) => {
      setSkills(loaded || [])
    }).catch(err => {
      console.error('[Chat] Failed to load skills:', err)
    })
  }, [activeWorkspaceId, activeSessionWorkingDirectory])

  // ============================================================================
  // SESSION HANDLERS
  // ============================================================================
  const handleSessionSourcesChange = React.useCallback(async (sessionId: string, sourceSlugs: string[]) => {
    try {
      await window.electronAPI.sessionCommand(sessionId, { type: 'setSources', sourceSlugs })
    } catch (err) {
      console.error('[Chat] Failed to set session sources:', err)
    }
  }, [])

  const handleSessionLabelsChange = React.useCallback(async (sessionId: string, labels: string[]) => {
    try {
      await window.electronAPI.sessionCommand(sessionId, { type: 'setLabels', labels })
    } catch (err) {
      console.error('[Chat] Failed to set session labels:', err)
    }
  }, [])

  // Ensure session messages are loaded when selected
  const ensureMessagesLoaded = useSetAtom(ensureSessionMessagesLoadedAtom)
  React.useEffect(() => {
    if (session.selected) {
      ensureMessagesLoaded(session.selected)
    }
  }, [session.selected, ensureMessagesLoaded])

  // Wrap delete handler
  const handleDeleteSession = useCallback(async (sessionId: string, skipConfirmation?: boolean): Promise<boolean> => {
    if (session.selected === sessionId) {
      setSession({ selected: null })
    }
    return onDeleteSession(sessionId, skipConfirmation)
  }, [session.selected, setSession, onDeleteSession])

  // ============================================================================
  // FOCUS ZONE MANAGEMENT
  // ============================================================================
  const { focusZone, focusNextZone, focusPreviousZone } = useFocusContext()
  const { zoneRef: sidebarRef, isFocused: sidebarFocused } = useFocusZone({ zoneId: 'sidebar' })

  const chatInputRef = useRef<RichTextInputHandle>(null)
  const focusChatInput = useCallback(() => {
    chatInputRef.current?.focus()
  }, [])

  // ============================================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ============================================================================
  useAction('nav.focusSidebar', () => focusZone('sidebar', { intent: 'keyboard' }))
  useAction('nav.focusSessionList', () => focusZone('session-list', { intent: 'keyboard' }))
  useAction('nav.focusChat', () => focusZone('chat', { intent: 'keyboard' }))

  useAction('nav.nextZone', () => {
    focusNextZone()
  }, { enabled: () => !document.querySelector('[role="dialog"]') })

  useAction('chat.cyclePermissionMode', () => {
    if (session.selected) {
      const currentOptions = contextValue.sessionOptions.get(session.selected)
      const currentMode = currentOptions?.permissionMode ?? 'ask'
      const modes = enabledModes.length >= 2 ? enabledModes : ['safe', 'ask', 'allow-all'] as PermissionMode[]
      const currentIndex = modes.indexOf(currentMode)
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length
      const nextMode = modes[nextIndex]
      contextValue.onSessionOptionsChange(session.selected, { permissionMode: nextMode })
    }
  }, { enabled: () => !document.querySelector('[role="dialog"]') && document.activeElement?.tagName !== 'TEXTAREA' })

  useAction('view.toggleSidebar', () => setIsSidebarVisible(v => !v))
  useAction('view.toggleFocusMode', () => setIsFocusModeActive(v => !v))
  useAction('app.newChat', () => handleNewChat(true))
  useAction('app.settings', onOpenSettings)
  useAction('app.keyboardShortcuts', onOpenKeyboardShortcuts)
  useAction('app.newWindow', () => window.electronAPI.menuNewWindow())
  useAction('app.quit', () => window.electronAPI.menuQuit())
  useAction('nav.goBack', goBack)
  useAction('nav.goForward', goForward)
  useAction('nav.goBackAlt', goBack)
  useAction('nav.goForwardAlt', goForward)

  useAction('chat.nextSearchMatch', () => chatDisplayRef.current?.goToNextMatch(), {
    enabled: () => searchActive && (chatMatchInfo.count ?? 0) > 0
  })
  useAction('chat.prevSearchMatch', () => chatDisplayRef.current?.goToPrevMatch(), {
    enabled: () => searchActive && (chatMatchInfo.count ?? 0) > 0
  })

  useAction('chat.stopProcessing', () => {
    if (session.selected) {
      const meta = sessionMetaMap.get(session.selected)
      if (meta?.isProcessing) {
        const shouldInterrupt = handleEscapePress()
        if (shouldInterrupt) {
          window.electronAPI.cancelProcessing(session.selected, false).catch(err => {
            console.error('[AppShell] Failed to cancel processing:', err)
          })
        }
      }
    }
  }, {
    enabled: () => {
      if (hasOpenOverlay()) return false
      if (!session.selected) return false
      const meta = sessionMetaMap.get(session.selected)
      return meta?.isProcessing ?? false
    }
  }, [session, handleEscapePress])

  useAction('app.toggleTheme', () => setMode(resolvedMode === 'dark' ? 'light' : 'dark'))

  // ============================================================================
  // GLOBAL PASTE LISTENER
  // ============================================================================
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      const files = e.clipboardData?.files
      if (!files || files.length === 0) return
      const activeElement = document.activeElement as HTMLElement | null
      if (
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'INPUT' ||
        activeElement?.isContentEditable
      ) return
      e.preventDefault()
      const filesArray = Array.from(files)
      window.dispatchEvent(new CustomEvent('craft:paste-files', {
        detail: { files: filesArray }
      }))
    }
    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [])

  // ============================================================================
  // RESIZE EFFECT
  // ============================================================================
  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'sidebar') {
        const newWidth = Math.min(Math.max(e.clientX, 180), 320)
        setSidebarWidth(newWidth)
        if (resizeHandleRef.current) {
          const rect = resizeHandleRef.current.getBoundingClientRect()
          setSidebarHandleY(e.clientY - rect.top)
        }
      } else if (isResizing === 'session-list') {
        const offset = isSidebarVisible ? sidebarWidth : 0
        const newWidth = Math.min(Math.max(e.clientX - offset, 240), 480)
        setSessionListWidth(newWidth)
        if (sessionListHandleRef.current) {
          const rect = sessionListHandleRef.current.getBoundingClientRect()
          setSessionListHandleY(e.clientY - rect.top)
        }
      } else if (isResizing === 'right-sidebar') {
        const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 280), 480)
        setRightSidebarWidth(newWidth)
        if (rightSidebarHandleRef.current) {
          const rect = rightSidebarHandleRef.current.getBoundingClientRect()
          setRightSidebarHandleY(e.clientY - rect.top)
        }
      }
    }

    const handleMouseUp = () => {
      if (isResizing === 'sidebar') {
        storage.set(storage.KEYS.sidebarWidth, sidebarWidth)
        setSidebarHandleY(null)
      } else if (isResizing === 'session-list') {
        storage.set(storage.KEYS.sessionListWidth, sessionListWidth)
        setSessionListHandleY(null)
      } else if (isResizing === 'right-sidebar') {
        storage.set(storage.KEYS.rightSidebarWidth, rightSidebarWidth)
        setRightSidebarHandleY(null)
      }
      setIsResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, sidebarWidth, sessionListWidth, rightSidebarWidth, isSidebarVisible])

  // Spring transition config
  const springTransition = {
    type: "spring" as const,
    stiffness: 600,
    damping: 49,
  }

  // ============================================================================
  // EDIT POPOVER STATE
  // ============================================================================
  const [editPopoverOpen, setEditPopoverOpen] = useState<EditPopoverType>(null)
  const editPopoverAnchorY = useRef<number>(120)
  const editLabelTargetId = useRef<string | undefined>(undefined)
  const editPopoverTriggerRef = useRef<Element | null>(null)

  const captureContextMenuPosition = useCallback(() => {
    const trigger = document.querySelector('.group\\/section > [data-state="open"]')
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      editPopoverAnchorY.current = rect.top
      editPopoverTriggerRef.current = trigger
    }
  }, [])

  useEffect(() => {
    const el = editPopoverTriggerRef.current
    if (!el) return
    if (editPopoverOpen) {
      el.setAttribute('data-edit-active', 'true')
    } else {
      el.removeAttribute('data-edit-active')
      editPopoverTriggerRef.current = null
    }
  }, [editPopoverOpen])

  const openConfigureStatuses = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('statuses'), 50)
  }, [captureContextMenuPosition])

  const openConfigureLabels = useCallback((labelId?: string) => {
    editLabelTargetId.current = labelId
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('labels'), 50)
  }, [captureContextMenuPosition])

  const openConfigureViews = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('views'), 50)
  }, [captureContextMenuPosition])

  const handleDeleteView = useCallback(async (viewId: string) => {
    if (!activeWorkspace?.id) return
    try {
      const updated = viewConfigs.filter(v => v.id !== viewId)
      await window.electronAPI.saveViews(activeWorkspace.id, updated)
    } catch (err) {
      console.error('[AppShell] Failed to delete view:', err)
    }
  }, [activeWorkspace?.id, viewConfigs])

  const handleAddLabel = useCallback((parentId?: string) => {
    editLabelTargetId.current = parentId
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('add-label'), 50)
  }, [captureContextMenuPosition])

  const handleDeleteLabel = useCallback(async (labelId: string) => {
    if (!activeWorkspace?.id) return
    try {
      await window.electronAPI.deleteLabel(activeWorkspace.id, labelId)
    } catch (err) {
      console.error('[AppShell] Failed to delete label:', err)
    }
  }, [activeWorkspace?.id])

  const openAddSource = useCallback((sourceType?: 'api' | 'mcp' | 'local') => {
    captureContextMenuPosition()
    const key = sourceType ? `add-source-${sourceType}` as const : 'add-source' as const
    setTimeout(() => setEditPopoverOpen(key), 50)
  }, [captureContextMenuPosition])

  const openAddSkill = useCallback(() => {
    captureContextMenuPosition()
    setTimeout(() => setEditPopoverOpen('add-skill'), 50)
  }, [captureContextMenuPosition])

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================
  const handleNewChat = useCallback(async (_useCurrentAgent: boolean = true) => {
    if (!activeWorkspace) return
    setSearchActive(false)
    setSearchQuery('')
    const newSession = await onCreateSession(activeWorkspace.id)
    navigate(routes.view.allSessions(newSession.id))
    setTimeout(() => focusZone('chat', { intent: 'programmatic' }), 50)
  }, [activeWorkspace, onCreateSession, focusZone])

  const handleDeleteSource = useCallback(async (sourceSlug: string) => {
    if (!activeWorkspace) return
    try {
      await window.electronAPI.deleteSource(activeWorkspace.id, sourceSlug)
      toast.success(`Deleted source`)
    } catch (error) {
      console.error('[Chat] Failed to delete source:', error)
      toast.error('Failed to delete source')
    }
  }, [activeWorkspace])

  const handleDeleteSkill = useCallback(async (skillSlug: string) => {
    if (!activeWorkspace) return
    try {
      await window.electronAPI.deleteSkill(activeWorkspace.id, skillSlug)
      toast.success(`Deleted skill: ${skillSlug}`)
    } catch (error) {
      console.error('[Chat] Failed to delete skill:', error)
      toast.error('Failed to delete skill')
    }
  }, [activeWorkspace])

  // Menu bar "New Chat" trigger
  const menuTriggerRef = useRef(menuNewChatTrigger)
  useEffect(() => {
    if (menuTriggerRef.current === menuNewChatTrigger) return
    menuTriggerRef.current = menuNewChatTrigger
    handleNewChat(true)
  }, [menuNewChatTrigger, handleNewChat])

  const handleAllSessionsClick = useCallback(() => {
    navigate(routes.view.allSessions())
  }, [])

  const handleFlaggedClick = useCallback(() => {
    navigate(routes.view.flagged())
  }, [])

  const handleArchivedClick = useCallback(() => {
    navigate(routes.view.archived())
  }, [])

  const handleSessionStatusClick = useCallback((stateId: SessionStatusId) => {
    navigate(routes.view.state(stateId))
  }, [])

  const handleLabelClick = useCallback((labelId: string) => {
    navigate(routes.view.label(labelId))
  }, [])

  const handleViewClick = useCallback((viewId: string) => {
    navigate(routes.view.view(viewId))
  }, [])

  const handleStatusReorder = useCallback((orderedIds: string[]) => {
    if (!activeWorkspaceId) return
    setOptimisticStatusOrder(orderedIds)
    window.electronAPI.reorderStatuses(activeWorkspaceId, orderedIds)
  }, [activeWorkspaceId])

  const handleSourcesClick = useCallback(() => {
    navigate(routes.view.sources())
  }, [])

  const handleSourcesApiClick = useCallback(() => {
    navigate(routes.view.sourcesApi())
  }, [])

  const handleSourcesMcpClick = useCallback(() => {
    navigate(routes.view.sourcesMcp())
  }, [])

  const handleSourcesLocalClick = useCallback(() => {
    navigate(routes.view.sourcesLocal())
  }, [])

  const handleSkillsClick = useCallback(() => {
    navigate(routes.view.skills())
  }, [])

  const handleSettingsClick = useCallback((subpage: SettingsSubpage = 'app') => {
    navigate(routes.view.settings(subpage))
  }, [])

  const handleWhatsNewClick = useCallback(async () => {
    const content = await window.electronAPI.getReleaseNotes()
    setReleaseNotesContent(content)
    setShowWhatsNew(true)
    setHasUnseenReleaseNotes(false)
    const latestVersion = await window.electronAPI.getLatestReleaseVersion()
    if (latestVersion) {
      storage.set(storage.KEYS.whatsNewLastSeenVersion, latestVersion)
    }
  }, [])

  const handleSourceSelect = React.useCallback((source: LoadedSource) => {
    if (!activeWorkspaceId) return
    navigateToSource(source.config.slug)
  }, [activeWorkspaceId, navigateToSource])

  const handleSkillSelect = React.useCallback((skill: LoadedSkill) => {
    if (!activeWorkspaceId) return
    navigate(routes.view.skills(skill.slug))
  }, [activeWorkspaceId, navigate])

  // ============================================================================
  // PERSISTENCE EFFECTS
  // ============================================================================
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    storage.set(storage.KEYS.expandedFolders, [...expandedFolders], activeWorkspaceId)
  }, [expandedFolders, activeWorkspaceId])

  React.useEffect(() => {
    storage.set(storage.KEYS.sidebarVisible, isSidebarVisible)
  }, [isSidebarVisible])

  React.useEffect(() => {
    storage.set(storage.KEYS.rightSidebarVisible, isRightSidebarVisible)
  }, [isRightSidebarVisible])

  React.useEffect(() => {
    storage.set(storage.KEYS.focusModeEnabled, isFocusModeActive)
  }, [isFocusModeActive])

  React.useEffect(() => {
    const cleanup = window.electronAPI.onMenuToggleFocusMode?.(() => {
      setIsFocusModeActive(v => !v)
    })
    return cleanup
  }, [])

  React.useEffect(() => {
    const cleanup = window.electronAPI.onMenuToggleSidebar?.(() => {
      setIsSidebarVisible(v => !v)
    })
    return cleanup
  }, [])

  React.useEffect(() => {
    if (!activeWorkspaceId) return
    storage.set(storage.KEYS.collapsedSidebarItems, [...collapsedItems], activeWorkspaceId)
  }, [collapsedItems, activeWorkspaceId])

  // ============================================================================
  // SIDEBAR ITEMS
  // ============================================================================
  const handleToggleFolder = React.useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const getSidebarItemProps = React.useCallback((id: string) => ({
    tabIndex: focusedSidebarItemId === id ? 0 : -1,
    'data-focused': focusedSidebarItemId === id,
    ref: (el: HTMLElement | null) => {
      if (el) {
        sidebarItemRefs.current.set(id, el)
      } else {
        sidebarItemRefs.current.delete(id)
      }
    },
  }), [focusedSidebarItemId])

  // ============================================================================
  // RETURN ALL STATE
  // ============================================================================
  return {
    // Context values
    contextValue,
    workspaces,
    activeWorkspaceId,
    sessionOptions,
    onSelectWorkspace,
    onRefreshWorkspaces,
    onCreateSession,
    onFlagSession,
    onUnflagSession,
    onArchiveSession,
    onUnarchiveSession,
    onMarkSessionRead,
    onMarkSessionUnread,
    onSessionStatusChange,
    onRenameSession,
    onOpenSettings,
    onOpenKeyboardShortcuts,
    onOpenStoredUserPreferences,
    onReset,
    onSendMessage,
    openNewChat,

    // Hotkey labels
    newChatHotkey,

    // Sidebar
    isSidebarVisible,
    setIsSidebarVisible,
    sidebarWidth,
    setSidebarWidth,
    sessionListWidth,
    setSessionListWidth,
    isRightSidebarVisible,
    setIsRightSidebarVisible,
    rightSidebarWidth,
    setRightSidebarWidth,
    skipRightSidebarAnimation,
    setSkipRightSidebarAnimation,

    // Focus mode
    isFocusModeActive,
    setIsFocusModeActive,
    effectiveFocusMode,

    // What's New
    showWhatsNew,
    setShowWhatsNew,
    releaseNotesContent,
    hasUnseenReleaseNotes,

    // Window
    windowWidth,
    shouldUseOverlay,

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

    // Session & Navigation
    session,
    setSession,
    resolvedMode,
    isDark,
    setMode,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    navigateToSource,
    navigateToSession,
    handleEscapePress,
    navState,
    sessionFilter,
    sourceFilter,

    // Search
    searchActive,
    setSearchActive,
    searchQuery,
    setSearchQuery,
    chatDisplayRef,
    chatMatchInfo,
    handleChatMatchInfoChange,

    // Sidebar navigation
    expandedFolders,
    setExpandedFolders,
    focusedSidebarItemId,
    setFocusedSidebarItemId,
    sidebarItemRefs,
    collapsedItems,
    setCollapsedItems,
    isExpanded,
    toggleExpanded,

    // Sources & Skills
    sources,
    setSources,
    skills,
    setSkills,
    localMcpEnabled,
    enabledModes,

    // Active workspace
    activeWorkspace,

    // Status configs
    effectiveSessionStatuses,
    optimisticStatusOrder,

    // Labels & Views
    labelConfigs,
    labelTree,
    flatLabelMenuItems,
    viewConfigs,
    evaluateViews,

    // Session metadata
    sessionMetaMap,
    workspaceSessionMetas,
    activeSessionMetas,

    // Session filtering
    ...sessionFiltering,

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
    handleToggleFolder,
    getSidebarItemProps,

    // Edit popover
    editPopoverOpen,
    setEditPopoverOpen,
    editPopoverAnchorY,
    editLabelTargetId,
    editPopoverTriggerRef,
    captureContextMenuPosition,
    openConfigureStatuses,
    openConfigureLabels,
    openConfigureViews,
    handleDeleteView,
    handleAddLabel,
    handleDeleteLabel,
    openAddSource,
    openAddSkill,

    // Focus zone
    focusZone,
    focusNextZone,
    focusPreviousZone,
    sidebarRef,
    sidebarFocused,
    chatInputRef,
    focusChatInput,

    // Animation
    springTransition,

    // Constants
    PANEL_WINDOW_EDGE_SPACING: 6,
    PANEL_PANEL_SPACING: 5,
  }
}
