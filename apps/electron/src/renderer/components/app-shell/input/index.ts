// Main components
export { InputContainer } from './InputContainer'
export { FreeFormInput } from './FreeFormInput'
export { StructuredInput } from './StructuredInput'
export { WorkingDirectoryBadge } from './WorkingDirectoryBadge'
export { ModelSelector, ContextUsageWarningBadge } from './ModelSelector'

// Structured input components
export { PermissionRequest } from './structured/PermissionRequest'

// Hooks
export { useAutoGrow } from './useAutoGrow'
export { useInputHandlers } from './useInputHandlers'

// Types
export type { FreeFormInputProps } from './free-form-input-types'
export type {
  InputMode,
  StructuredInputType,
  StructuredInputState,
  StructuredInputData,
  StructuredResponse,
  PermissionResponse,
} from './structured/types'

// Utilities
export {
  formatTokenCount,
  cmdKey,
  DEFAULT_PLACEHOLDERS,
  shuffleArray,
  getRecentDirs,
  addRecentDir,
  formatPathForDisplay,
} from './free-form-input-utils'
