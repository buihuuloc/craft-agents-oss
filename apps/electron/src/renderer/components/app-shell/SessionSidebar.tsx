/**
 * SessionSidebar
 *
 * A slim left sidebar for the chat-dominant layout, inspired by Claude Co-work.
 * Shows recent sessions for quick navigation, a "New session" button, and
 * a search button that opens the command palette.
 *
 * Width: 220px fixed. Handles its own macOS traffic light padding.
 */

import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { Plus, Search, PanelLeftClose } from 'lucide-react'

import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import {
  useNavigation,
  useNavigationState,
  routes,
  isSessionsNavigation,
} from '@/contexts/NavigationContext'

export interface SessionSidebarProps {
  onNewSession: () => void
  onCommandPaletteOpen: () => void
  onToggleSidebar?: () => void
}

export function SessionSidebar({ onNewSession, onCommandPaletteOpen, onToggleSidebar }: SessionSidebarProps) {
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { navigate } = useNavigation()
  const navigationState = useNavigationState()

  // Derive the currently active session ID
  const activeSessionId = isSessionsNavigation(navigationState)
    ? navigationState.details?.sessionId ?? null
    : null

  // Filter and sort sessions: exclude hidden, archived, sub-sessions
  const sessions = useMemo(() => {
    const all: SessionMeta[] = []
    for (const meta of sessionMetaMap.values()) {
      if (meta.hidden || meta.isArchived || meta.parentSessionId) continue
      all.push(meta)
    }
    all.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
    return all
  }, [sessionMetaMap])

  const handleSelectSession = (sessionId: string) => {
    navigate(routes.view.allSessions(sessionId))
  }

  return (
    <div
      className={cn(
        'flex flex-col w-[220px] shrink-0',
        'bg-foreground/[0.02] border-r border-foreground/[0.06]',
        'h-full overflow-hidden',
        isMac ? 'pt-[42px]' : 'pt-2'
      )}
    >
      {/* Action buttons */}
      <div className="flex flex-col gap-0.5 px-2 pb-1">
        <button
          onClick={onNewSession}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm rounded-md',
            'text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]',
            'transition-colors text-left'
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          New session
        </button>
        <button
          onClick={onCommandPaletteOpen}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm rounded-md',
            'text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]',
            'transition-colors text-left'
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          Search
        </button>
      </div>

      {/* Section header */}
      <div className="text-xs font-medium text-foreground/40 uppercase tracking-wider px-3 mt-4 mb-1 mx-2">
        Recents
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId
          return (
            <button
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm truncate cursor-pointer rounded-md mx-2',
                'transition-colors block',
                // Constrain width so truncation works (subtract mx-2 = 16px padding)
                'max-w-[calc(100%-16px)]',
                isActive
                  ? 'bg-foreground/[0.06] text-foreground'
                  : 'text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03]'
              )}
            >
              {session.name || session.preview || 'Untitled'}
            </button>
          )
        })}
      </div>

      {/* Hide sidebar button (bottom) */}
      {onToggleSidebar && (
        <div className="shrink-0 px-2 py-2 border-t border-foreground/[0.06]">
          <button
            onClick={onToggleSidebar}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs rounded-md w-full',
              'text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.03]',
              'transition-colors text-left'
            )}
          >
            <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
            Hide sidebar
          </button>
        </div>
      )}
    </div>
  )
}
