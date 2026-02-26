import * as storage from '@/lib/local-storage'
import { isMac, PATH_SEP } from '@/lib/platform'

/**
 * Format token count for display (e.g., 1500 -> "1.5k", 200000 -> "200k")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`
  }
  return tokens.toString()
}

/** Platform-specific modifier key for keyboard shortcuts */
export const cmdKey = isMac ? '\u2318' : 'Ctrl'

/** Default rotating placeholders for onboarding/empty state */
export const DEFAULT_PLACEHOLDERS = [
  'What would you like to work on?',
  'Use Shift + Tab to switch between Explore and Execute',
  'Type @ to mention files, folders, or skills',
  'Type # to apply labels to this conversation',
  'Press Shift + Return to add a new line',
  `Press ${cmdKey} + B to toggle the sidebar`,
  `Press ${cmdKey} + . for focus mode`,
]

/** Fisher-Yates shuffle -- returns a new array in random order */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Helper functions for recent directories storage
 */
export function getRecentDirs(): string[] {
  return storage.get<string[]>(storage.KEYS.recentWorkingDirs, [])
}

export function addRecentDir(path: string): void {
  const recent = getRecentDirs().filter(p => p !== path)
  const updated = [path, ...recent].slice(0, 25)
  storage.set(storage.KEYS.recentWorkingDirs, updated)
}

/**
 * Format path for display, with home directory shortened
 */
export function formatPathForDisplay(path: string, homeDir: string): string {
  let displayPath = path
  if (homeDir && path.startsWith(homeDir)) {
    const relativePath = path.slice(homeDir.length)
    // Remove leading separator if present, show root separator if empty
    displayPath = relativePath.startsWith(PATH_SEP)
      ? relativePath.slice(1)
      : (relativePath || PATH_SEP)
  }
  return `in ${displayPath}`
}
