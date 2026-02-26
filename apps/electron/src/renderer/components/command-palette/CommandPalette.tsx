/**
 * CommandPalette
 *
 * Global command palette for quick navigation across sessions, sources,
 * skills, settings, and actions. Replaces sidebar navigation with a
 * unified search experience powered by cmdk.
 *
 * Open via Cmd+K or by setting commandPaletteOpenAtom to true.
 */

import { useCallback, useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { formatRelativeTime } from '@/lib/format-relative-time'
import {
  MessageSquare,
  Plug,
  Sparkles,
  Settings,
  Plus,
  Moon,
  Sun,
  LogOut,
  FolderOpen,
  Check,
} from 'lucide-react'

import { activeArtifactAtom } from '@/atoms/artifact'
import { commandPaletteOpenAtom } from '@/atoms/command-palette'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { sourcesAtom } from '@/atoms/sources'
import { skillsAtom } from '@/atoms/skills'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { useNavigation, routes } from '@/contexts/NavigationContext'
import { useAppShellContext } from '@/context/AppShellContext'
import { SETTINGS_PAGES } from '../../../shared/settings-registry'
import { useTheme } from '@/context/ThemeContext'

/** Max results per group to keep the palette snappy */
const MAX_RESULTS_PER_GROUP = 5

export function CommandPalette() {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom)
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const sources = useAtomValue(sourcesAtom)
  const skills = useAtomValue(skillsAtom)
  const setArtifact = useSetAtom(activeArtifactAtom)
  const { navigate } = useNavigation()
  const { onReset, workspaces, activeWorkspaceId, onSelectWorkspace } = useAppShellContext()
  const { resolvedMode, setMode } = useTheme()

  // Sort sessions by lastMessageAt descending, exclude hidden/archived
  const sessions = useMemo(() => {
    const all: SessionMeta[] = []
    for (const meta of sessionMetaMap.values()) {
      if (meta.hidden || meta.isArchived || meta.parentSessionId) continue
      all.push(meta)
    }
    all.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
    return all.slice(0, MAX_RESULTS_PER_GROUP)
  }, [sessionMetaMap])

  // Filter out built-in sources
  const visibleSources = useMemo(
    () => sources.filter(s => !s.isBuiltin).slice(0, MAX_RESULTS_PER_GROUP),
    [sources]
  )

  const visibleSkills = useMemo(
    () => skills.slice(0, MAX_RESULTS_PER_GROUP),
    [skills]
  )

  const close = useCallback(() => setOpen(false), [setOpen])

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      navigate(routes.view.allSessions(sessionId))
      close()
    },
    [navigate, close]
  )

  const handleSelectSource = useCallback(
    (sourceSlug: string) => {
      setArtifact({ kind: 'source', sourceSlug })
      close()
    },
    [setArtifact, close]
  )

  const handleSelectSkill = useCallback(
    (skillSlug: string) => {
      setArtifact({ kind: 'skill', skillSlug })
      close()
    },
    [setArtifact, close]
  )

  const handleSelectSetting = useCallback(
    (id: string) => {
      const settingMessages: Record<string, string> = {
        app: 'Show me my app settings',
        ai: 'Show me my AI configuration',
        appearance: 'Show me my appearance settings',
        workspace: 'Show me my workspace settings',
        permissions: 'Show me my permission settings',
        labels: 'Show me my label settings',
        input: 'Show me my input settings',
        preferences: 'Show me my preferences',
        shortcuts: 'Show me my keyboard shortcuts',
      }
      const message = settingMessages[id] || `Show me my ${id} settings`
      navigate(routes.action.newSession({ input: message, send: true }))
      close()
    },
    [navigate, close]
  )

  const handleNewSession = useCallback(() => {
    navigate(routes.action.newSession())
    close()
  }, [navigate, close])

  const handleToggleTheme = useCallback(() => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark')
    close()
  }, [setMode, resolvedMode, close])

  const handleLogout = useCallback(() => {
    close()
    onReset()
  }, [close, onReset])

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      onSelectWorkspace(workspaceId)
      close()
    },
    [onSelectWorkspace, close]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search sessions, sources, settings..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Sessions */}
        {sessions.length > 0 && (
          <CommandGroup heading="Sessions">
            {sessions.map((session) => (
              <CommandItem
                key={session.id}
                value={`session:${session.name ?? ''}${session.preview ?? ''}${session.id}`}
                onSelect={() => handleSelectSession(session.id)}
              >
                <MessageSquare className="text-muted-foreground" />
                <span className="flex-1 truncate">
                  {session.name || session.preview || 'Untitled'}
                </span>
                {session.lastMessageAt && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(session.lastMessageAt)}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Sources */}
        {visibleSources.length > 0 && (
          <CommandGroup heading="Sources">
            {visibleSources.map((source) => (
              <CommandItem
                key={source.config.slug}
                value={`source:${source.config.name}${source.config.type}`}
                onSelect={() => handleSelectSource(source.config.slug)}
              >
                <Plug className="text-muted-foreground" />
                <span className="flex-1 truncate">{source.config.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {source.config.type}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Skills */}
        {visibleSkills.length > 0 && (
          <CommandGroup heading="Skills">
            {visibleSkills.map((skill) => (
              <CommandItem
                key={skill.slug}
                value={`skill:${skill.metadata.name}${skill.slug}`}
                onSelect={() => handleSelectSkill(skill.slug)}
              >
                <Sparkles className="text-muted-foreground" />
                <span className="flex-1 truncate">{skill.metadata.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Settings */}
        <CommandGroup heading="Settings">
          {SETTINGS_PAGES.map((page) => (
            <CommandItem
              key={page.id}
              value={`setting:${page.label}${page.description}`}
              onSelect={() => handleSelectSetting(page.id)}
            >
              <Settings className="text-muted-foreground" />
              <span className="flex-1 truncate">{page.label}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {page.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Workspaces */}
        {workspaces.length > 0 && (
          <CommandGroup heading="Workspaces">
            {workspaces.map((workspace) => (
              <CommandItem
                key={workspace.id}
                value={`workspace:${workspace.name}${workspace.id}`}
                onSelect={() => handleSelectWorkspace(workspace.id)}
              >
                <FolderOpen className="text-muted-foreground" />
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId && (
                  <Check className="ml-auto shrink-0 h-4 w-4 text-accent" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="action:New Session"
            onSelect={handleNewSession}
          >
            <Plus className="text-muted-foreground" />
            <span>New Session</span>
          </CommandItem>
          <CommandItem
            value="action:Toggle Dark Mode"
            onSelect={handleToggleTheme}
          >
            {resolvedMode === 'dark' ? (
              <Sun className="text-muted-foreground" />
            ) : (
              <Moon className="text-muted-foreground" />
            )}
            <span>Toggle Dark Mode</span>
          </CommandItem>
          <CommandItem
            value="action:Logout Sign Out"
            onSelect={handleLogout}
          >
            <LogOut className="text-muted-foreground" />
            <span>Logout</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
