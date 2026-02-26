import type { ActivityItem } from "@craft-agent/ui"
import type { ParsedSettingsResult } from "./chat-display-types"

/**
 * Checks if a file path is in a plans folder and is a markdown file.
 * Used to conditionally show the PLAN header in DocumentFormattedMarkdownOverlay.
 */
export function isPlanFilePath(filePath: string | undefined): boolean {
  if (!filePath) return false
  return (filePath.includes('/plans/') || filePath.startsWith('plans/')) &&
         filePath.endsWith('.md')
}

/**
 * Processing status messages - cycles through these randomly
 * Inspired by Claude Code's playful status messages
 */
export const PROCESSING_MESSAGES = [
  'Thinking...',
  'Pondering...',
  'Contemplating...',
  'Reasoning...',
  'Processing...',
  'Computing...',
  'Considering...',
  'Reflecting...',
  'Deliberating...',
  'Cogitating...',
  'Ruminating...',
  'Musing...',
  'Working on it...',
  'On it...',
  'Crunching...',
  'Brewing...',
  'Connecting dots...',
  'Mulling it over...',
  'Deep in thought...',
  'Hmm...',
  'Let me see...',
  'One moment...',
  'Hold on...',
  'Bear with me...',
  'Just a sec...',
  'Hang tight...',
  'Getting there...',
  'Almost...',
  'Working...',
  'Busy busy...',
  'Whirring...',
  'Churning...',
  'Percolating...',
  'Simmering...',
  'Cooking...',
  'Baking...',
  'Stirring...',
  'Spinning up...',
  'Warming up...',
  'Revving...',
  'Buzzing...',
  'Humming...',
  'Ticking...',
  'Clicking...',
  'Whizzing...',
  'Zooming...',
  'Zipping...',
  'Chugging...',
  'Trucking...',
  'Rolling...',
]

/**
 * Format elapsed time: "45s" under a minute, "1:02" for 1+ minutes
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Try to parse a settings tool result from an activity's content.
 * Returns null if the activity is not a settings tool result or can't be parsed.
 */
export function parseSettingsResult(activity: ActivityItem): ParsedSettingsResult | null {
  if (activity.toolName !== 'Settings') return null
  if (!activity.content) return null
  try {
    const parsed = JSON.parse(activity.content) as ParsedSettingsResult
    if (typeof parsed !== 'object' || parsed === null) return null
    // Must be a set action result (applied or requiresConfirmation)
    if (parsed.data?.applied || parsed.requiresConfirmation) return parsed
    return null
  } catch {
    return null
  }
}
