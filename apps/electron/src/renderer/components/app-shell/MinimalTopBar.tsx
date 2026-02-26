/**
 * MinimalTopBar
 *
 * A clean, minimal top bar for the chat-dominant layout. Sits to the right
 * of the SessionSidebar, so it no longer needs macOS traffic-light padding.
 *
 * Left side:
 *   - Back button (when navigation history allows going back)
 *
 * Right side:
 *   - Search button (opens command palette)
 *   - Overflow menu (HeaderMenu with Open in New Window)
 *   - New session button
 *
 * The bar supports Electron window dragging (-webkit-app-region: drag).
 *
 * When `minimal` is true (e.g., home screen), only the overflow menu and
 * new session button are shown, with a fully transparent background.
 */

import { ChevronLeft, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'
import { useNavigation, routes } from '@/contexts/NavigationContext'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import { HeaderMenu } from '@/components/ui/HeaderMenu'

export interface MinimalTopBarProps {
  /** Callback to open the command palette */
  onCommandPaletteOpen: () => void
  /** Whether the sidebar is currently visible (affects macOS traffic light padding) */
  isSidebarVisible?: boolean
  /** When true (home screen): only show overflow menu and new session button, transparent */
  minimal?: boolean
}

export function MinimalTopBar({ onCommandPaletteOpen, isSidebarVisible, minimal }: MinimalTopBarProps) {
  const { navigate, canGoBack, goBack } = useNavigation()

  const handleNewSession = () => {
    navigate(routes.action.newSession())
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center h-11 bg-transparent titlebar-drag-region',
        // Must be above the fixed titlebar drag overlay (z-titlebar: 40) so buttons are clickable
        'relative z-[var(--z-panel)]',
        // When sidebar is hidden on macOS, add left padding for traffic lights
        isMac && !isSidebarVisible ? 'pl-[76px]' : 'pl-3',
        'pr-2'
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        {/* Back button - only visible when history allows going back */}
        {!minimal && canGoBack && (
          <HeaderIconButton
            icon={<ChevronLeft className="h-4 w-4" />}
            tooltip="Go back"
            onClick={goBack}
          />
        )}
      </div>

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
