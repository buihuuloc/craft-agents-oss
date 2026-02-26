/**
 * Settings Interceptor
 *
 * Detects user messages that express intent to change a setting and applies
 * the change instantly at the UI layer, without routing through the LLM agent.
 *
 * This provides sub-100ms settings changes instead of the 10-30 second round
 * trip through the agent (which reads files, edits configs, etc.).
 *
 * Only non-risky settings are intercepted. Risky settings (model changes,
 * workspace config, permissions) still go through the agent for the
 * confirmation flow.
 */

import { getSettingByKey } from './settings-intent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsInterceptResult {
  intercepted: boolean
  settingKey?: string
  settingLabel?: string
  oldValue?: string
  newValue?: string
  confirmationMessage?: string
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

const SETTINGS_PATTERNS: Array<{
  pattern: RegExp
  settingKey: string
  extractValue: (match: RegExpMatchArray) => string | boolean
}> = [
  // ── Theme mode ──────────────────────────────────────────────────────────
  { pattern: /(?:switch|change|set|turn|go)\s+(?:to\s+)?(?:the\s+)?(?:theme\s+(?:to\s+)?)?dark\s*(?:mode|theme)?/i, settingKey: 'themeMode', extractValue: () => 'dark' },
  { pattern: /(?:switch|change|set|turn|go)\s+(?:to\s+)?(?:the\s+)?(?:theme\s+(?:to\s+)?)?light\s*(?:mode|theme)?/i, settingKey: 'themeMode', extractValue: () => 'light' },
  { pattern: /(?:enable|turn\s+on|activate)\s+dark\s*(?:mode|theme)?/i, settingKey: 'themeMode', extractValue: () => 'dark' },
  { pattern: /(?:enable|turn\s+on|activate)\s+light\s*(?:mode|theme)?/i, settingKey: 'themeMode', extractValue: () => 'light' },
  { pattern: /dark\s*mode/i, settingKey: 'themeMode', extractValue: () => 'dark' },
  { pattern: /light\s*mode/i, settingKey: 'themeMode', extractValue: () => 'light' },
  { pattern: /(?:change|set|switch)\s+(?:the\s+)?them(?:e)?\s+(?:to\s+)?(light|dark|system)/i, settingKey: 'themeMode', extractValue: (m) => m[1].toLowerCase() },

  // ── Notifications ───────────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+(?:desktop\s+)?notifications?/i, settingKey: 'notifications', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+(?:desktop\s+)?notifications?/i, settingKey: 'notifications', extractValue: () => false },
  { pattern: /(?:enable|activate)\s+(?:desktop\s+)?notifications?/i, settingKey: 'notifications', extractValue: () => true },
  { pattern: /(?:disable|deactivate)\s+(?:desktop\s+)?notifications?/i, settingKey: 'notifications', extractValue: () => false },

  // ── Font ────────────────────────────────────────────────────────────────
  { pattern: /(?:change|set|switch)\s+(?:the\s+)?font\s+(?:to\s+)?(inter|system)/i, settingKey: 'font', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /(?:use|switch\s+to)\s+(inter|system)\s+font/i, settingKey: 'font', extractValue: (m) => m[1].toLowerCase() },

  // ── Keep awake ──────────────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+keep\s*(?:screen\s+)?awake/i, settingKey: 'keepAwake', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+keep\s*(?:screen\s+)?awake/i, settingKey: 'keepAwake', extractValue: () => false },
  { pattern: /(?:enable)\s+keep\s*(?:screen\s+)?awake/i, settingKey: 'keepAwake', extractValue: () => true },
  { pattern: /(?:disable)\s+keep\s*(?:screen\s+)?awake/i, settingKey: 'keepAwake', extractValue: () => false },

  // ── Spell check ─────────────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+spell\s*check(?:ing)?/i, settingKey: 'spellCheck', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+spell\s*check(?:ing)?/i, settingKey: 'spellCheck', extractValue: () => false },
  { pattern: /(?:enable)\s+spell\s*check(?:ing)?/i, settingKey: 'spellCheck', extractValue: () => true },
  { pattern: /(?:disable)\s+spell\s*check(?:ing)?/i, settingKey: 'spellCheck', extractValue: () => false },

  // ── Auto capitalisation ─────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+auto\s*(?:cap(?:italisation|italization)?)/i, settingKey: 'autoCapitalisation', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+auto\s*(?:cap(?:italisation|italization)?)/i, settingKey: 'autoCapitalisation', extractValue: () => false },
  { pattern: /(?:enable)\s+auto\s*(?:cap(?:italisation|italization)?)/i, settingKey: 'autoCapitalisation', extractValue: () => true },
  { pattern: /(?:disable)\s+auto\s*(?:cap(?:italisation|italization)?)/i, settingKey: 'autoCapitalisation', extractValue: () => false },

  // ── Connection icons ────────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+(?:connection\s+)?icons?/i, settingKey: 'connectionIcons', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+(?:connection\s+)?icons?/i, settingKey: 'connectionIcons', extractValue: () => false },
  { pattern: /(?:show|enable)\s+(?:connection\s+)?icons?/i, settingKey: 'connectionIcons', extractValue: () => true },
  { pattern: /(?:hide|disable)\s+(?:connection\s+)?icons?/i, settingKey: 'connectionIcons', extractValue: () => false },

  // ── Rich tool descriptions ──────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+rich\s+(?:tool\s+)?descriptions?/i, settingKey: 'richToolDescriptions', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+rich\s+(?:tool\s+)?descriptions?/i, settingKey: 'richToolDescriptions', extractValue: () => false },
  { pattern: /(?:enable)\s+rich\s+(?:tool\s+)?descriptions?/i, settingKey: 'richToolDescriptions', extractValue: () => true },
  { pattern: /(?:disable)\s+rich\s+(?:tool\s+)?descriptions?/i, settingKey: 'richToolDescriptions', extractValue: () => false },
]

// ---------------------------------------------------------------------------
// Interceptor
// ---------------------------------------------------------------------------

/**
 * Check if a user message matches a known settings pattern and apply it
 * instantly. Returns `{ intercepted: true, ... }` if handled, otherwise
 * `{ intercepted: false }` so the caller can forward the message to the agent.
 */
export async function interceptSettingsMessage(message: string): Promise<SettingsInterceptResult> {
  const trimmed = message.trim()

  // Quick heuristic: settings messages are short. Anything over 80 chars is
  // almost certainly a complex request that should go to the agent.
  if (trimmed.length > 80) {
    return { intercepted: false }
  }

  for (const { pattern, settingKey, extractValue } of SETTINGS_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const setting = getSettingByKey(settingKey)
      if (!setting) continue

      // Never intercept risky settings — the agent handles those with a
      // preview/confirmation flow.
      if (setting.risky) continue

      const newValue = extractValue(match)

      try {
        const oldValue = await setting.getValue()
        await setting.setValue(newValue)

        const oldStr = formatValue(oldValue)
        const newStr = formatValue(newValue)

        return {
          intercepted: true,
          settingKey,
          settingLabel: setting.label,
          oldValue: oldStr,
          newValue: newStr,
          confirmationMessage: `Done! Changed **${setting.label}** from ${oldStr} to **${newStr}**.`,
        }
      } catch {
        // If setting application fails, let the agent handle it
        return { intercepted: false }
      }
    }
  }

  return { intercepted: false }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
  if (value === null || value === undefined) return 'Not set'
  return String(value)
}
