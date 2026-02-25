/**
 * MinimalTopBar
 *
 * A clean, minimal top bar for the chat-dominant layout. Replaces the complex
 * multi-panel headers with a simple bar containing:
 *
 * Left side:
 *   - Back button (when navigation history allows going back)
 *   - Workspace name (clickable, opens command palette)
 *
 * Right side:
 *   - Search button (opens command palette)
 *   - Overflow menu (HeaderMenu with Open in New Window)
 *   - New session button
 *
 * The bar supports Electron window dragging (-webkit-app-region: drag) and
 * compensates for macOS traffic light controls on the left side.
 *
 * When `minimal` is true (e.g., home screen), only the overflow menu and
 * new session button are shown, with a fully transparent background.
 */

import { ChevronLeft, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'
import { useNavigation, routes } from '@/contexts/NavigationContext'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import { HeaderMenu } from '@/components/ui/HeaderMenu'

export interface MinimalTopBarProps {
  /** Callback to open the command palette */
  onCommandPaletteOpen: () => void
  /** When true (home screen): only show overflow menu and new session button, transparent */
  minimal?: boolean
}

export function MinimalTopBar({ onCommandPaletteOpen, minimal }: MinimalTopBarProps) {
  const { navigate, canGoBack, goBack } = useNavigation()
  const activeWorkspace = useActiveWorkspace()
  const workspaceName = activeWorkspace?.name ?? 'Workspace'

  const handleNewSession = () => {
    navigate(routes.action.newSession())
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center h-11 bg-transparent titlebar-drag-region',
        // Left padding: compensate for macOS traffic lights (stoplight)
        isMac ? 'pl-[80px]' : 'pl-3',
        'pr-2'
      )}
    >
      {/* Left side */}
      {!minimal && (
        <div className="flex items-center gap-1 titlebar-no-drag">
          {/* Back button - only visible when history allows going back */}
          {canGoBack && (
            <HeaderIconButton
              icon={<ChevronLeft className="h-4 w-4" />}
              tooltip="Go back"
              onClick={goBack}
            />
          )}

          {/* Workspace name - clickable, opens command palette */}
          <button
            onClick={onCommandPaletteOpen}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md',
              'text-sm font-medium text-foreground/80 truncate',
              'hover:bg-foreground/[0.03] transition-colors',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            )}
          >
            {workspaceName}
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-0.5 titlebar-no-drag">
        {/* Search button - opens command palette (hidden in minimal mode) */}
        {!minimal && (
          <HeaderIconButton
            icon={<Search className="h-4 w-4" />}
            tooltip={isMac ? 'Search (\u2318K)' : 'Search (Ctrl+K)'}
            onClick={onCommandPaletteOpen}
          />
        )}

        {/* Overflow menu */}
        <HeaderMenu route="allSessions" />

        {/* New session button */}
        <HeaderIconButton
          icon={<Plus className="h-4 w-4" />}
          tooltip="New session"
          onClick={handleNewSession}
        />
      </div>
    </div>
  )
}
