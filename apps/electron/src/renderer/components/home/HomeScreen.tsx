/**
 * HomeScreen
 *
 * Centered landing screen shown when no session is active.
 * Displays the app title, a search prompt that opens the command palette,
 * and a list of recent sessions for quick access.
 */

import { Fragment, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Search } from 'lucide-react'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { commandPaletteOpenAtom } from '@/atoms/command-palette'
import { useNavigation, routes } from '@/contexts/NavigationContext'

export function HomeScreen() {
  const sessions = useAtomValue(sessionMetaMapAtom)
  const { navigate } = useNavigation()
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)

  // Get 5 most recent non-archived, non-hidden sessions
  const recentSessions = useMemo(() => {
    return [...sessions.values()]
      .filter(s => !s.isArchived && !s.hidden && !s.parentSessionId)
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
      .slice(0, 5)
  }, [sessions])

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col items-center gap-8 max-w-2xl w-full px-4">
        {/* App Title */}
        <h1 className="text-2xl font-semibold tracking-tight">Craft Agents</h1>

        {/* Search Prompt -- clickable, opens command palette */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full max-w-lg flex items-center gap-3 px-4 py-3 rounded-xl
                     border border-foreground/10 bg-background
                     hover:border-foreground/20 transition-colors
                     text-foreground/40 text-sm cursor-text"
        >
          <Search className="h-4 w-4" />
          <span>What would you like to do?</span>
          <kbd className="ml-auto text-xs bg-foreground/5 text-foreground/40 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-foreground/40">
            <span>Recent:</span>
            {recentSessions.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && <span className="text-foreground/20">&middot;</span>}
                <button
                  onClick={() => navigate(routes.view.allSessions(s.id))}
                  className="hover:text-foreground transition-colors truncate max-w-[150px]"
                >
                  {s.name || s.preview || 'Untitled'}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
