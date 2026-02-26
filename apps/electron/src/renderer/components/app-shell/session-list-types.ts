import type { LabelConfig } from "@craft-agent/shared/labels"
import type { SessionStatusId, SessionStatus } from "@/config/session-status-config"
import type { SessionMeta } from "@/atoms/sessions"
import type { ViewConfig } from "@craft-agent/shared/views"
import type { PermissionMode } from "@craft-agent/shared/agent/modes"

/** Filter mode for tri-state filtering: include shows only matching, exclude hides matching */
export type FilterMode = 'include' | 'exclude'

export interface SessionItemProps {
  item: SessionMeta
  index: number
  itemProps: {
    id: string
    tabIndex: number
    'aria-selected': boolean
    onKeyDown: (e: React.KeyboardEvent) => void
    onFocus: () => void
    ref: (el: HTMLElement | null) => void
    role: string
  }
  isSelected: boolean
  isLast: boolean
  isFirstInGroup: boolean
  onKeyDown: (e: React.KeyboardEvent, item: SessionMeta) => void
  onRenameClick: (sessionId: string, currentName: string) => void
  onSessionStatusChange: (sessionId: string, state: SessionStatusId) => void
  onFlag?: (sessionId: string) => void
  onUnflag?: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
  onUnarchive?: (sessionId: string) => void
  onMarkUnread: (sessionId: string) => void
  onDelete: (sessionId: string, skipConfirmation?: boolean) => Promise<boolean>
  onSelect: () => void
  onOpenInNewWindow: () => void
  /** Current permission mode for this session (from real-time state) */
  permissionMode?: PermissionMode
  /** LLM connection slug for this session */
  llmConnection?: string
  /** Current search query for highlighting matches */
  searchQuery?: string
  /** Dynamic todo states from workspace config */
  sessionStatuses: SessionStatus[]
  /** Pre-flattened label configs for resolving session label IDs to display info */
  flatLabels: LabelConfig[]
  /** Full label tree (for labels submenu in SessionMenu) */
  labels: LabelConfig[]
  /** Callback when session labels are toggled */
  onLabelsChange?: (sessionId: string, labels: string[]) => void
  /** Number of matches in ChatDisplay (only set when session is selected and loaded) */
  chatMatchCount?: number
  /** Whether multi-select mode is active (shows checkboxes) */
  isMultiSelectActive?: boolean
  /** Whether this item is in the multi-select set */
  isInMultiSelect?: boolean
  /** Toggle this item in multi-select (cmd/ctrl+click) */
  onToggleSelect?: () => void
  /** Range select to this item (shift+click) */
  onRangeSelect?: () => void
  /** Callback to focus the session-list zone (enables keyboard shortcuts) */
  onFocusZone?: () => void
}

export interface SessionListProps {
  items: SessionMeta[]
  onDelete: (sessionId: string, skipConfirmation?: boolean) => Promise<boolean>
  onFlag?: (sessionId: string) => void
  onUnflag?: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
  onUnarchive?: (sessionId: string) => void
  onMarkUnread: (sessionId: string) => void
  onSessionStatusChange: (sessionId: string, state: SessionStatusId) => void
  onRename: (sessionId: string, name: string) => void
  /** Called when Enter is pressed to focus chat input */
  onFocusChatInput?: () => void
  /** Called when a session is selected */
  onSessionSelect?: (session: SessionMeta) => void
  /** Called when user wants to open a session in a new window */
  onOpenInNewWindow?: (session: SessionMeta) => void
  /** Called to navigate to a specific view (e.g., 'allSessions', 'flagged') */
  onNavigateToView?: (view: 'allSessions' | 'flagged') => void
  /** Unified session options per session (real-time state) */
  sessionOptions?: Map<string, import('../../hooks/useSessionOptions').SessionOptions>
  /** Whether search mode is active */
  searchActive?: boolean
  /** Current search query */
  searchQuery?: string
  /** Called when search query changes */
  onSearchChange?: (query: string) => void
  /** Called when search is closed */
  onSearchClose?: () => void
  /** Dynamic todo states from workspace config */
  sessionStatuses?: SessionStatus[]
  /** View evaluator — evaluates a session and returns matching view configs */
  evaluateViews?: (meta: SessionMeta) => ViewConfig[]
  /** Label configs for resolving session label IDs to display info */
  labels?: LabelConfig[]
  /** Callback when session labels are toggled (for labels submenu in SessionMenu) */
  onLabelsChange?: (sessionId: string, labels: string[]) => void
  /** Workspace ID for content search (optional - if not provided, content search is disabled) */
  workspaceId?: string
  /** Secondary status filter (status chips in "All Sessions" view) - for search result grouping */
  statusFilter?: Map<string, FilterMode>
  /** Secondary label filter (label chips) - for search result grouping */
  labelFilterMap?: Map<string, FilterMode>
}
