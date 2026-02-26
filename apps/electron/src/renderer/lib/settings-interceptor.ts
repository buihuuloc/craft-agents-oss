/**
 * Settings Interceptor
 *
 * Detects user messages that express intent to change a setting and applies
 * the change instantly at the UI layer, without routing through the LLM agent.
 *
 * This provides sub-100ms settings changes instead of the 10-30 second round
 * trip through the agent (which reads files, edits configs, etc.).
 *
 * All settings are intercepted for instant application, regardless of risk
 * classification. This provides the fastest possible settings UX.
 */

import { getSettingByKey, dispatchSettingsChanged } from './settings-intent'

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

  // ── Send message key ────────────────────────────────────────────────────
  { pattern: /(?:use|set|change)\s+(?:the\s+)?send\s+(?:message\s+)?key\s+(?:to\s+)?(enter|cmd[+-]enter)/i, settingKey: 'sendMessageKey', extractValue: (m) => m[1].toLowerCase().replace('+', '-') },
  { pattern: /send\s+(?:messages?\s+)?with\s+(enter|cmd[+-]enter)/i, settingKey: 'sendMessageKey', extractValue: (m) => m[1].toLowerCase().replace('+', '-') },

  // ── Color theme (must be AFTER themeMode patterns to avoid conflicts) ──
  { pattern: /(?:use|apply|activate)\s+(?:the\s+)?([\w-]+)\s+(?:color\s+)?theme/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /(?:set|change|switch)\s+(?:the\s+)?color\s+theme\s+(?:to\s+)?([\w-]+)/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },

  // ── Workspace color theme ───────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:color\s+)?theme\s+(?:to\s+)?([\w-]+)/i, settingKey: 'workspaceColorTheme', extractValue: (m) => m[1].toLowerCase() },

  // ── User name ──────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?(?:user\s*)?name\s+(?:to\s+)(.+)/i, settingKey: 'userName', extractValue: (m) => m[1].trim() },
  { pattern: /(?:call|address)\s+me\s+(.+)/i, settingKey: 'userName', extractValue: (m) => m[1].trim() },
  { pattern: /my\s+name\s+is\s+(.+)/i, settingKey: 'userName', extractValue: (m) => m[1].trim() },

  // ── Timezone ───────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?timezone\s+(?:to\s+)(.+)/i, settingKey: 'timezone', extractValue: (m) => m[1].trim() },
  { pattern: /(?:my\s+)?timezone\s+is\s+(.+)/i, settingKey: 'timezone', extractValue: (m) => m[1].trim() },

  // ── Language ───────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?(?:preferred\s+)?language\s+(?:to\s+)(.+)/i, settingKey: 'language', extractValue: (m) => m[1].trim() },
  { pattern: /(?:speak|respond|reply)\s+(?:in|to\s+me\s+in)\s+(.+)/i, settingKey: 'language', extractValue: (m) => m[1].trim() },

  // ── City ───────────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?city\s+(?:to\s+)(.+)/i, settingKey: 'city', extractValue: (m) => m[1].trim() },

  // ── Country ────────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?country\s+(?:to\s+)(.+)/i, settingKey: 'country', extractValue: (m) => m[1].trim() },

  // ── Preference notes ──────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?(?:preference\s+)?notes?\s+(?:to\s+)(.+)/i, settingKey: 'notes', extractValue: (m) => m[1].trim() },

  // ── Default model ──────────────────────────────────────────────────────
  { pattern: /(?:use|set|change|switch)\s+(?:the\s+)?(?:default\s+)?model\s+(?:to\s+)(.+)/i, settingKey: 'defaultModel', extractValue: (m) => m[1].trim() },

  // ── Default LLM connection ─────────────────────────────────────────────
  { pattern: /(?:use|set|switch)\s+(?:the\s+)?(?:default\s+)?(?:llm\s+)?connection\s+(?:to\s+)(.+)/i, settingKey: 'defaultLlmConnection', extractValue: (m) => m[1].trim() },

  // ── Workspace model ────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:default\s+)?model\s+(?:to\s+)(.+)/i, settingKey: 'workspaceModel', extractValue: (m) => m[1].trim() },

  // ── Workspace connection ───────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:default\s+)?connection\s+(?:to\s+)(.+)/i, settingKey: 'workspaceDefaultLlmConnection', extractValue: (m) => m[1].trim() },

  // ── Workspace thinking level ───────────────────────────────────────────
  { pattern: /(?:enable|turn\s+on)\s+max\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'max' },
  { pattern: /(?:enable|turn\s+on)\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'think' },
  { pattern: /(?:disable|turn\s+off)\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'off' },
  { pattern: /(?:set|change)\s+(?:the\s+)?(?:workspace\s+)?thinking\s+(?:level\s+)?(?:to\s+)?(off|think|max)/i, settingKey: 'workspaceThinkingLevel', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /max\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'max' },
  { pattern: /no\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'off' },

  // ── Workspace name ─────────────────────────────────────────────────────
  { pattern: /(?:rename|set|change)\s+(?:the\s+)?workspace\s+(?:name\s+)?(?:to\s+)(.+)/i, settingKey: 'workspaceName', extractValue: (m) => m[1].trim() },

  // ── Working directory ──────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?(?:working\s+)?(?:directory|dir|cwd)\s+(?:to\s+)(.+)/i, settingKey: 'workingDirectory', extractValue: (m) => m[1].trim() },

  // ── Local MCP servers ──────────────────────────────────────────────────
  { pattern: /(?:turn|switch)\s+on\s+(?:local\s+)?mcp\s*(?:servers?)?/i, settingKey: 'localMcpEnabled', extractValue: () => true },
  { pattern: /(?:turn|switch)\s+off\s+(?:local\s+)?mcp\s*(?:servers?)?/i, settingKey: 'localMcpEnabled', extractValue: () => false },
  { pattern: /(?:enable)\s+(?:local\s+)?mcp\s*(?:servers?)?/i, settingKey: 'localMcpEnabled', extractValue: () => true },
  { pattern: /(?:disable)\s+(?:local\s+)?mcp\s*(?:servers?)?/i, settingKey: 'localMcpEnabled', extractValue: () => false },

  // ── Permission mode ────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?permission(?:s)?\s+(?:mode\s+)?(?:to\s+)?(safe|ask|allow-all|auto|read[- ]?only|explore)/i, settingKey: 'permissionMode', extractValue: (m) => {
    const v = m[1].toLowerCase().replace(/[\s-]+/g, '')
    if (v === 'auto' || v === 'allowall') return 'allow-all'
    if (v === 'readonly' || v === 'explore') return 'safe'
    return v
  }},
  { pattern: /(?:use|switch\s+to)\s+(safe|ask|auto|allow-all|read[- ]?only|explore)\s*(?:mode|permissions?)?/i, settingKey: 'permissionMode', extractValue: (m) => {
    const v = m[1].toLowerCase().replace(/[\s-]+/g, '')
    if (v === 'auto' || v === 'allowall') return 'allow-all'
    if (v === 'readonly' || v === 'explore') return 'safe'
    return v
  }},
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

  // Quick heuristic: settings messages are short. Anything over 200 chars is
  // almost certainly a complex request that should go to the agent.
  if (trimmed.length > 200) {
    return { intercepted: false }
  }

  for (const { pattern, settingKey, extractValue } of SETTINGS_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const setting = getSettingByKey(settingKey)
      if (!setting) continue

      const newValue = extractValue(match)

      try {
        const oldValue = await setting.getValue()
        await setting.setValue(newValue)
        dispatchSettingsChanged(settingKey, newValue)

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
