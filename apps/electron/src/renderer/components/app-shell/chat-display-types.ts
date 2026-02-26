import type { RenderMode } from "@/components/markdown"
import type { RichTextInputHandle } from "@/components/ui/rich-text-input"
import type { SessionStatus } from "@/config/session-status-config"
import type {
  ActivityItem,
  FileChange,
} from "@craft-agent/ui"
import type { LabelConfig } from "@craft-agent/shared/labels"
import type { PermissionMode } from "@craft-agent/shared/agent/modes"
import type { ThinkingLevel } from "@craft-agent/shared/agent/thinking-levels"
import type { Session, Message, FileAttachment, PermissionRequest, CredentialRequest, CredentialResponse, LoadedSource, LoadedSkill } from "../../../shared/types"

// ============================================================================
// Overlay State Types
// ============================================================================

/** State for multi-diff overlay (Edit/Write activities) */
export interface MultiDiffOverlayState {
  type: 'multi-diff'
  changes: FileChange[]
  consolidated: boolean
  focusedChangeId?: string
}

/** State for markdown overlay (pop-out, turn details, generic activities) */
export interface MarkdownOverlayState {
  type: 'markdown'
  content: string
  title: string
  /** When true, show raw markdown source in code viewer instead of rendered preview */
  forceCodeView?: boolean
}

/** Union of all overlay states, or null for no overlay */
export type OverlayState =
  | { type: 'activity'; activity: ActivityItem }
  | MultiDiffOverlayState
  | MarkdownOverlayState
  | null

// ============================================================================
// ChatDisplay Props & Handle
// ============================================================================

export interface ChatDisplayProps {
  session: Session | null
  onSendMessage: (message: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
  onOpenFile: (path: string) => void
  onOpenUrl: (url: string) => void
  // Model selection
  currentModel: string
  onModelChange: (model: string, connection?: string) => void
  // Connection selection (locked after first message)
  /** Callback when LLM connection changes (only works when session is empty) */
  onConnectionChange?: (connectionSlug: string) => void
  /** Ref for the input, used for external focus control */
  textareaRef?: React.RefObject<RichTextInputHandle>
  /** When true, disables input (e.g., when agent needs activation) */
  disabled?: boolean
  /** Pending permission request for this session */
  pendingPermission?: PermissionRequest
  /** Callback to respond to permission request */
  onRespondToPermission?: (sessionId: string, requestId: string, allowed: boolean, alwaysAllow: boolean) => void
  /** Pending credential request for this session */
  pendingCredential?: CredentialRequest
  /** Callback to respond to credential request */
  onRespondToCredential?: (sessionId: string, requestId: string, response: CredentialResponse) => void
  // Thinking level (session-level setting)
  /** Current thinking level ('off', 'think', 'max') */
  thinkingLevel?: ThinkingLevel
  /** Callback when thinking level changes */
  onThinkingLevelChange?: (level: ThinkingLevel) => void
  // Advanced options
  /** Enable ultrathink mode for extended reasoning */
  ultrathinkEnabled?: boolean
  onUltrathinkChange?: (enabled: boolean) => void
  /** Current permission mode */
  permissionMode?: PermissionMode
  onPermissionModeChange?: (mode: PermissionMode) => void
  /** Enabled permission modes for Shift+Tab cycling */
  enabledModes?: PermissionMode[]
  // Input value preservation (controlled from parent)
  /** Current input value - preserved across mode switches and conversation changes */
  inputValue?: string
  /** Callback when input value changes */
  onInputChange?: (value: string) => void
  // Source selection
  /** Available sources (enabled only) */
  sources?: LoadedSource[]
  /** Callback when source selection changes */
  onSourcesChange?: (slugs: string[]) => void
  // Skill selection (for @mentions)
  /** Available skills for @mention autocomplete */
  skills?: LoadedSkill[]
  // Label selection (for #labels)
  /** Available label configs (tree) for label menu and badge display */
  labels?: LabelConfig[]
  /** Callback when labels change */
  onLabelsChange?: (labels: string[]) => void
  // State/status selection (for # menu and ActiveOptionBadges)
  /** Available workflow states */
  sessionStatuses?: SessionStatus[]
  /** Callback when session state changes */
  onSessionStatusChange?: (stateId: string) => void
  /** Workspace ID for loading skill icons */
  workspaceId?: string
  // Working directory (per session)
  /** Current working directory for this session */
  workingDirectory?: string
  /** Callback when working directory changes */
  onWorkingDirectoryChange?: (path: string) => void
  /** Session folder path (for "Reset to Session Root" option) */
  sessionFolderPath?: string
  // Lazy loading
  /** When true, messages are still loading - show spinner in messages area */
  messagesLoading?: boolean
  // Tutorial
  /** Disable send action (for tutorial guidance) */
  disableSend?: boolean
  // Search highlighting (from session list search)
  /** Search query for highlighting matches - passed from session list */
  searchQuery?: string
  /** Whether search mode is active (prevents focus stealing to chat input) */
  isSearchModeActive?: boolean
  /** Callback when match count changes - used by session list for navigation */
  onMatchCountChange?: (count: number) => void
  /** Callback when match info (count and index) changes - for immediate UI updates */
  onMatchInfoChange?: (info: { count: number; index: number }) => void
  // Compact mode (for EditPopover embedding)
  /** Enable compact mode - hides non-essential UI elements for popover embedding */
  compactMode?: boolean
  /** Custom placeholder for input (used in compact mode for edit context) */
  placeholder?: string | string[]
  /** Label shown as empty state in compact mode (e.g., "Permission Settings") */
  emptyStateLabel?: string
  /** When true, the session's locked connection has been removed - disables send and shows unavailable state */
  connectionUnavailable?: boolean
}

/**
 * Imperative handle exposed via forwardRef for navigation between matches
 */
export interface ChatDisplayHandle {
  goToNextMatch: () => void
  goToPrevMatch: () => void
  matchCount: number
  currentMatchIndex: number
}

// ============================================================================
// Settings Types
// ============================================================================

/** Parsed settings tool result from activity content */
export interface ParsedSettingsResult {
  success: boolean
  /** Present when a safe setting was applied immediately */
  data?: {
    applied?: boolean
    key?: string
    oldValue?: unknown
    newValue?: unknown
  }
  /** Present when a risky setting needs user confirmation */
  requiresConfirmation?: boolean
  setting?: { key: string; label: string; description: string; category: string }
  currentValue?: unknown
  newValue?: unknown
  error?: string
}

// ============================================================================
// ProcessingIndicator Types
// ============================================================================

export interface ProcessingIndicatorProps {
  /** Start timestamp (persists across remounts) */
  startTime?: number
  /** Override cycling messages with explicit status (e.g., "Compacting...") */
  statusMessage?: string
}

// ============================================================================
// MessageBubble Types
// ============================================================================

export interface MessageBubbleProps {
  message: Message
  onOpenFile: (path: string) => void
  onOpenUrl: (url: string) => void
  /**
   * Markdown render mode for assistant messages
   * @default 'minimal'
   */
  renderMode?: RenderMode
  /**
   * Callback to pop out message into a separate window
   */
  onPopOut?: (message: Message) => void
  /** Compact mode - reduces padding for popover embedding */
  compactMode?: boolean
}
