import type { RichTextInputHandle } from '@/components/ui/rich-text-input'
import type { LabelConfig } from '@craft-agent/shared/labels'
import type { FileAttachment, LoadedSource, LoadedSkill } from '../../../../shared/types'
import type { PermissionMode } from '@craft-agent/shared/agent/modes'
import type { ThinkingLevel } from '@craft-agent/shared/agent/thinking-levels'

export interface FreeFormInputProps {
  /** Placeholder text(s) for the textarea - can be array for rotation */
  placeholder?: string | string[]
  /** Whether input is disabled */
  disabled?: boolean
  /** Whether the session is currently processing */
  isProcessing?: boolean
  /** Callback when message is submitted (skillSlugs from @mentions) */
  onSubmit: (message: string, attachments?: FileAttachment[], skillSlugs?: string[]) => void
  /** Callback to stop processing. Pass silent=true to skip "Response interrupted" message */
  onStop?: (silent?: boolean) => void
  /** External ref for the input */
  inputRef?: React.RefObject<RichTextInputHandle>
  /** Current model ID */
  currentModel: string
  /** Callback when model changes (includes connection slug for proper persistence) */
  onModelChange: (model: string, connection?: string) => void
  // Thinking level (session-level setting)
  /** Current thinking level ('off', 'think', 'max') */
  thinkingLevel?: ThinkingLevel
  /** Callback when thinking level changes */
  onThinkingLevelChange?: (level: ThinkingLevel) => void
  // Advanced options
  ultrathinkEnabled?: boolean
  onUltrathinkChange?: (enabled: boolean) => void
  permissionMode?: PermissionMode
  onPermissionModeChange?: (mode: PermissionMode) => void
  /** Enabled permission modes for Shift+Tab cycling (min 2 modes) */
  enabledModes?: PermissionMode[]
  // Controlled input value (for persisting across mode switches and conversation changes)
  /** Current input value - if provided, component becomes controlled */
  inputValue?: string
  /** Callback when input value changes */
  onInputChange?: (value: string) => void
  /** When true, removes container styling (shadow, bg, rounded) - used when wrapped by InputContainer */
  unstyled?: boolean
  /** Callback when component height changes (for external animation sync) */
  onHeightChange?: (height: number) => void
  /** Callback when focus state changes */
  onFocusChange?: (focused: boolean) => void
  // Source selection
  /** Available sources (enabled only) */
  sources?: LoadedSource[]
  /** Currently enabled source slugs for this session */
  enabledSourceSlugs?: string[]
  /** Callback when source selection changes */
  onSourcesChange?: (slugs: string[]) => void
  // Skill selection (for @mentions)
  /** Available skills for @mention autocomplete */
  skills?: LoadedSkill[]
  // Label selection (for #labels)
  /** Available labels for #label autocomplete */
  labels?: LabelConfig[]
  /** Currently applied session labels */
  sessionLabels?: string[]
  /** Callback when a label is added via # menu */
  onLabelAdd?: (labelId: string) => void
  /** Workspace ID for loading skill icons */
  workspaceId?: string
  /** Current working directory path */
  workingDirectory?: string
  /** Callback when working directory changes */
  onWorkingDirectoryChange?: (path: string) => void
  /** Session folder path (for "Reset to Session Root" option) */
  sessionFolderPath?: string
  /** Session ID for scoping events like approve-plan */
  sessionId?: string
  /** Current session status of the session (for # menu state selection) */
  currentSessionStatus?: string
  /** Disable send action (for tutorial guidance) */
  disableSend?: boolean
  /** Whether the session is empty (no messages yet) - affects context badge prominence */
  isEmptySession?: boolean
  /** Context status for showing compaction indicator and token usage */
  contextStatus?: {
    /** True when SDK is actively compacting the conversation */
    isCompacting?: boolean
    /** Input tokens used so far in this session */
    inputTokens?: number
    /** Model's context window size in tokens */
    contextWindow?: number
  }
  /** Enable compact mode - hides attach, sources, working directory for popover embedding */
  compactMode?: boolean
  // Connection selection (hierarchical connection -> model selector)
  /** Current LLM connection slug (locked after first message) */
  currentConnection?: string
  /** Callback when connection changes (only works when session is empty) */
  onConnectionChange?: (connectionSlug: string) => void
  /** When true, the session's locked connection has been removed */
  connectionUnavailable?: boolean
}
