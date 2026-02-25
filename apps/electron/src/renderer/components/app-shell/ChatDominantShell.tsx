/**
 * ChatDominantShell
 *
 * A single-column, chat-dominant layout that replaces the 3-panel AppShell.
 * Structure: MinimalTopBar at the top, full-width main content below, with
 * a slot for a contextual side panel (wired in Task 8).
 *
 * Like AppShell, this component enriches the incoming contextValue with
 * local state (sources, skills, labels, session statuses, refs, etc.)
 * before passing it to AppShellProvider so child components (especially
 * ChatPage) have everything they need via useAppShellContext().
 */

import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { activeArtifactAtom } from '@/atoms/artifact'
import { commandPaletteOpenAtom } from '@/atoms/command-palette'
import { sourcesAtom } from '@/atoms/sources'
import { skillsAtom } from '@/atoms/skills'
import {
  AppShellProvider,
  useAppShellContext,
  type AppShellContextType,
} from '@/context/AppShellContext'
import { EscapeInterruptProvider } from '@/context/EscapeInterruptContext'
import { useTheme } from '@/context/ThemeContext'
import {
  useNavigation,
  useNavigationState,
  routes,
  isSessionsNavigation,
  isSourcesNavigation,
  isSettingsNavigation,
  isSkillsNavigation,
} from '@/contexts/NavigationContext'
import { useAction } from '@/actions'
import { useSession } from '@/hooks/useSession'
import { useStatuses } from '@/hooks/useStatuses'
import { useLabels } from '@/hooks/useLabels'
import { statusConfigsToSessionStatuses } from '@/config/session-status-config'
import type { SessionStatus } from '@/config/session-status-config'
import type { LoadedSource, LoadedSkill, PermissionMode } from '../../../shared/types'
import type { RichTextInputHandle } from '@/components/ui/rich-text-input'
import type { ChatDisplayHandle } from './ChatDisplay'
import { clearSourceIconCaches } from '@/lib/icon-cache'

import { MinimalTopBar } from './MinimalTopBar'
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { ContextPanel } from '@/components/context-panel'
import { HomeScreen } from '@/components/home'
import { SourceInfoPage, ChatPage } from '@/pages'
import SkillInfoPage from '@/pages/SkillInfoPage'
import { getSettingsPageComponent } from '@/pages/settings/settings-pages'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatDominantShellProps {
  /** All data and callbacks -- passed to AppShellProvider after enrichment */
  contextValue: AppShellContextType
  /** Trigger counter to create a new chat from the menu */
  menuNewChatTrigger?: number
  /** Focused mode -- hides non-essential chrome */
  isFocusedMode?: boolean
}

// ---------------------------------------------------------------------------
// Public component (wraps with EscapeInterruptProvider like AppShell does)
// ---------------------------------------------------------------------------

export function ChatDominantShell(props: ChatDominantShellProps) {
  return (
    <EscapeInterruptProvider>
      <ChatDominantShellContent {...props} />
    </EscapeInterruptProvider>
  )
}

// ---------------------------------------------------------------------------
// Inner content component
// ---------------------------------------------------------------------------

function ChatDominantShellContent({
  contextValue,
  menuNewChatTrigger,
  isFocusedMode = false,
}: ChatDominantShellProps) {
  const {
    workspaces,
    activeWorkspaceId,
    onDeleteSession,
    openNewChat,
  } = contextValue

  const { isDark } = useTheme()
  const [session, setSession] = useSession()
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)
  const artifact = useAtomValue(activeArtifactAtom)
  const setArtifact = useSetAtom(activeArtifactAtom)
  const { navigate } = useNavigation()

  // -------------------------------------------------------------------------
  // Global keyboard shortcuts (using centralized action registry)
  // Actions are defined in @/actions/definitions.ts
  // -------------------------------------------------------------------------

  // Cmd+K / Ctrl+K → toggle command palette
  useAction('app.commandPalette', () => {
    setCommandPaletteOpen(prev => !prev)
  })

  // Cmd+N / Ctrl+N → create new session
  useAction('app.newChat', () => {
    if (openNewChat) {
      openNewChat()
    } else {
      navigate(routes.action.newSession())
    }
  })

  // Cmd+, / Ctrl+, → navigate to settings
  useAction('app.settings', () => {
    navigate(routes.view.settings())
  })

  // Escape → close context panel (only when panel is open and command palette is closed)
  useAction('app.closePanel', () => {
    setArtifact(null)
  })

  // -------------------------------------------------------------------------
  // Sources -- loaded from backend, kept in sync via live updates
  // -------------------------------------------------------------------------
  const [sources, setSources] = useState<LoadedSource[]>([])
  const setSourcesAtom = useSetAtom(sourcesAtom)
  useEffect(() => { setSourcesAtom(sources) }, [sources, setSourcesAtom])

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getSources(activeWorkspaceId).then((loaded) => {
      setSources(loaded || [])
    }).catch(err => {
      console.error('[ChatDominantShell] Failed to load sources:', err)
    })
  }, [activeWorkspaceId])

  useEffect(() => {
    const cleanup = window.electronAPI.onSourcesChanged((updatedSources) => {
      clearSourceIconCaches()
      setSources(updatedSources || [])
    })
    return cleanup
  }, [])

  // -------------------------------------------------------------------------
  // Skills -- loaded from backend, kept in sync via live updates
  // -------------------------------------------------------------------------
  const [skills, setSkills] = useState<LoadedSkill[]>([])
  const setSkillsAtom = useSetAtom(skillsAtom)
  useEffect(() => { setSkillsAtom(skills) }, [skills, setSkillsAtom])

  useEffect(() => {
    const cleanup = window.electronAPI.onSkillsChanged?.((updatedSkills) => {
      setSkills(updatedSkills || [])
    })
    return cleanup
  }, [])

  // -------------------------------------------------------------------------
  // Labels -- from workspace config via hook
  // -------------------------------------------------------------------------
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId)
  const { labels: labelConfigs } = useLabels(activeWorkspace?.id || null)

  // -------------------------------------------------------------------------
  // Session statuses -- dynamic from workspace config
  // -------------------------------------------------------------------------
  const { statuses: statusConfigs } = useStatuses(activeWorkspace?.id || null)
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([])

  useEffect(() => {
    if (!activeWorkspace?.id || statusConfigs.length === 0) {
      setSessionStatuses([])
      return
    }
    setSessionStatuses(statusConfigsToSessionStatuses(statusConfigs, activeWorkspace.id, isDark))
  }, [statusConfigs, activeWorkspace?.id, isDark])

  // -------------------------------------------------------------------------
  // Permission modes -- loaded from workspace settings
  // -------------------------------------------------------------------------
  const [enabledModes, setEnabledModes] = useState<PermissionMode[]>(['safe', 'ask', 'allow-all'])

  useEffect(() => {
    if (!activeWorkspaceId) return
    window.electronAPI.getWorkspaceSettings(activeWorkspaceId).then((settings) => {
      if (settings?.cyclablePermissionModes && settings.cyclablePermissionModes.length >= 2) {
        setEnabledModes(settings.cyclablePermissionModes)
      }
    }).catch(err => {
      console.error('[ChatDominantShell] Failed to load workspace settings:', err)
    })
  }, [activeWorkspaceId])

  // -------------------------------------------------------------------------
  // Refs for chat input and display (needed by ChatPage via context)
  // -------------------------------------------------------------------------
  const chatInputRef = useRef<RichTextInputHandle>(null)
  const chatDisplayRef = useRef<ChatDisplayHandle>(null)

  // -------------------------------------------------------------------------
  // Session source / label change handlers
  // -------------------------------------------------------------------------
  const handleSessionSourcesChange = useCallback(async (sessionId: string, sourceSlugs: string[]) => {
    try {
      await window.electronAPI.sessionCommand(sessionId, { type: 'setSources', sourceSlugs })
    } catch (err) {
      console.error('[ChatDominantShell] Failed to set session sources:', err)
    }
  }, [])

  const handleSessionLabelsChange = useCallback(async (sessionId: string, labels: string[]) => {
    try {
      await window.electronAPI.sessionCommand(sessionId, { type: 'setLabels', labels })
    } catch (err) {
      console.error('[ChatDominantShell] Failed to set session labels:', err)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Wrap delete handler to clear selection (same pattern as AppShell)
  // -------------------------------------------------------------------------
  const handleDeleteSession = useCallback(async (sessionId: string, skipConfirmation?: boolean): Promise<boolean> => {
    if (session.selected === sessionId) {
      setSession({ selected: null })
    }
    return onDeleteSession(sessionId, skipConfirmation)
  }, [session.selected, setSession, onDeleteSession])

  // -------------------------------------------------------------------------
  // New chat from menu trigger
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (menuNewChatTrigger && menuNewChatTrigger > 0 && activeWorkspaceId && openNewChat) {
      openNewChat()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuNewChatTrigger])

  // -------------------------------------------------------------------------
  // Enriched context value (same pattern as AppShell)
  // -------------------------------------------------------------------------
  const enrichedContextValue = useMemo<AppShellContextType>(() => ({
    ...contextValue,
    onDeleteSession: handleDeleteSession,
    textareaRef: chatInputRef,
    enabledSources: sources,
    skills,
    labels: labelConfigs,
    onSessionLabelsChange: handleSessionLabelsChange,
    enabledModes,
    sessionStatuses,
    onSessionSourcesChange: handleSessionSourcesChange,
    // No right sidebar in the chat-dominant layout (context panel comes in Task 8)
    rightSidebarButton: null,
    // No search highlighting from session list (no session list in this layout)
    sessionListSearchQuery: undefined,
    isSearchModeActive: false,
    chatDisplayRef,
    onChatMatchInfoChange: undefined,
  }), [
    contextValue,
    handleDeleteSession,
    sources,
    skills,
    labelConfigs,
    handleSessionLabelsChange,
    enabledModes,
    sessionStatuses,
    handleSessionSourcesChange,
  ])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const navigationState = useNavigationState()
  const isHomeScreen = isSessionsNavigation(navigationState) && !navigationState.details?.sessionId

  return (
    <AppShellProvider value={enrichedContextValue}>
      <div className="flex flex-col h-screen w-screen">
        {/* Draggable title bar region for transparent window (macOS) */}
        <div className="titlebar-drag-region fixed top-0 left-0 right-0 h-[50px] z-titlebar" />

        <MinimalTopBar
          onCommandPaletteOpen={() => setCommandPaletteOpen(true)}
          minimal={isHomeScreen}
        />

        <div className="flex flex-1 min-h-0">
          {/* Main content -- full width by default */}
          <div className="flex-1 min-w-0">
            <MainContent />
          </div>
          <AnimatePresence>
            {artifact && (
              <motion.div
                key="context-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 480, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="border-l border-foreground-90 overflow-hidden shrink-0"
              >
                <ContextPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CommandPalette />
      </div>
    </AppShellProvider>
  )
}

// ---------------------------------------------------------------------------
// MainContent -- routes navigation state to the correct page
// ---------------------------------------------------------------------------

function MainContent() {
  const navState = useNavigationState()
  const { activeWorkspaceId } = useAppShellContext()

  // Settings navigator
  if (isSettingsNavigation(navState)) {
    const SettingsPageComponent = getSettingsPageComponent(navState.subpage)
    return SettingsPageComponent ? (
      <div className="h-full">
        <SettingsPageComponent />
      </div>
    ) : null
  }

  // Sources navigator
  if (isSourcesNavigation(navState)) {
    if (navState.details) {
      return (
        <div className="h-full">
          <SourceInfoPage
            sourceSlug={navState.details.sourceSlug}
            workspaceId={activeWorkspaceId || ''}
          />
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No sources configured</p>
      </div>
    )
  }

  // Skills navigator
  if (isSkillsNavigation(navState)) {
    if (navState.details?.type === 'skill') {
      return (
        <div className="h-full">
          <SkillInfoPage
            skillSlug={navState.details.skillSlug}
            workspaceId={activeWorkspaceId || ''}
          />
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No skills configured</p>
      </div>
    )
  }

  // Sessions (default) -- show chat or empty state
  if (isSessionsNavigation(navState)) {
    if (navState.details) {
      return (
        <div className="h-full">
          <ChatPage sessionId={navState.details.sessionId} />
        </div>
      )
    }

    // No session selected → show home screen
    return <HomeScreen />
  }

  // Fallback
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p className="text-sm">Select a conversation to get started</p>
    </div>
  )
}
