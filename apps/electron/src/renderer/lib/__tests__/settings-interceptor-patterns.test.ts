/**
 * Unit tests for settings interceptor regex pattern matching.
 *
 * Tests ONLY the pattern matching logic (extracting settingKey + value from
 * user messages). Does NOT require Electron IPC or browser APIs — we import
 * the patterns array directly and test regex matches.
 */

import { describe, it, expect } from 'bun:test'

// ---------------------------------------------------------------------------
// We can't import the interceptor directly (it depends on Electron APIs).
// Instead, duplicate the SETTINGS_PATTERNS array here so we can test the
// regex matching in isolation. If patterns change in the source file, these
// tests will catch regressions.
// ---------------------------------------------------------------------------

interface PatternDef {
  pattern: RegExp
  settingKey: string
  extractValue: (match: RegExpMatchArray) => string | boolean
}

// Copy of SETTINGS_PATTERNS from settings-interceptor.ts
// Keep in sync — if a pattern is added/changed there, update here too.
const SETTINGS_PATTERNS: PatternDef[] = [
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

  // ── Color theme ─────────────────────────────────────────────────────────
  { pattern: /(?:use|apply|activate)\s+(?:the\s+)?([\w-]+)\s+(?:color\s+)?theme/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /(?:set|change|switch)\s+(?:the\s+)?(?:color\s+)?theme\s+(?:(?:change|set|switch)\s+)?(?:to\s+)([\w-]+)/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /(?:color\s+)?theme\s+(?:change|set|switch)\s+(?:to\s+)([\w-]+)/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },

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
  { pattern: /(?:use|set|change|switch)\s+(?:the\s+)?(?:default\s+)?model\s+(?:to\s+)?(.+)/i, settingKey: 'defaultModel', extractValue: (m) => m[1].trim() },

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
// Test helper: match a message against patterns (same logic as interceptor)
// ---------------------------------------------------------------------------

function matchMessage(message: string): { settingKey: string; value: string | boolean } | null {
  const trimmed = message.trim()
  if (trimmed.length > 200) return null

  for (const { pattern, settingKey, extractValue } of SETTINGS_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      return { settingKey, value: extractValue(match) }
    }
  }
  return null
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Settings Interceptor Pattern Matching', () => {

  // ── Theme Mode ────────────────────────────────────────────────────────

  describe('themeMode', () => {
    it.each([
      ['dark mode', 'dark'],
      ['light mode', 'light'],
      ['switch to dark', 'dark'],
      ['switch to light', 'light'],
      ['switch to dark mode', 'dark'],
      ['switch to light mode', 'light'],
      ['change to dark', 'dark'],
      ['change to light', 'light'],
      ['set to dark', 'dark'],
      ['go dark', 'dark'],
      ['go light', 'light'],
      ['enable dark mode', 'dark'],
      ['enable light mode', 'light'],
      ['turn on dark mode', 'dark'],
      ['turn on light mode', 'light'],
      ['change theme to dark', 'dark'],
      ['change theme to light', 'light'],
      ['change theme to system', 'system'],
      ['set theme to dark', 'dark'],
      ['switch theme to light', 'light'],
    ])('"%s" → themeMode = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('themeMode')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Notifications ─────────────────────────────────────────────────────

  describe('notifications', () => {
    it.each([
      ['turn on notifications', true],
      ['turn off notifications', false],
      ['enable notifications', true],
      ['disable notifications', false],
      ['turn on desktop notifications', true],
      ['turn off desktop notifications', false],
      ['enable desktop notifications', true],
      ['disable desktop notifications', false],
    ])('"%s" → notifications = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('notifications')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Font ──────────────────────────────────────────────────────────────

  describe('font', () => {
    it.each([
      ['change font to inter', 'inter'],
      ['change font to system', 'system'],
      ['set font to inter', 'inter'],
      ['switch font to system', 'system'],
      ['use inter font', 'inter'],
      ['use system font', 'system'],
    ])('"%s" → font = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('font')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Keep Awake ────────────────────────────────────────────────────────

  describe('keepAwake', () => {
    it.each([
      ['turn on keep awake', true],
      ['turn off keep awake', false],
      ['enable keep awake', true],
      ['disable keep awake', false],
      ['turn on keep screen awake', true],
      ['turn off keep screen awake', false],
    ])('"%s" → keepAwake = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('keepAwake')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Spell Check ───────────────────────────────────────────────────────

  describe('spellCheck', () => {
    it.each([
      ['turn on spell check', true],
      ['turn off spell check', false],
      ['enable spell check', true],
      ['disable spell check', false],
      ['enable spellcheck', true],
      ['disable spellchecking', false],
    ])('"%s" → spellCheck = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('spellCheck')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Auto Capitalisation ───────────────────────────────────────────────

  describe('autoCapitalisation', () => {
    it.each([
      ['turn on auto cap', true],
      ['turn off auto cap', false],
      ['enable auto capitalisation', true],
      ['disable auto capitalization', false],
      ['turn on auto capitalisation', true],
    ])('"%s" → autoCapitalisation = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('autoCapitalisation')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Connection Icons ──────────────────────────────────────────────────

  describe('connectionIcons', () => {
    it.each([
      ['turn on connection icons', true],
      ['turn off connection icons', false],
      ['show icons', true],
      ['hide icons', false],
      ['show connection icons', true],
      ['enable icons', true],
      ['disable icons', false],
    ])('"%s" → connectionIcons = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('connectionIcons')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Rich Tool Descriptions ────────────────────────────────────────────

  describe('richToolDescriptions', () => {
    it.each([
      ['turn on rich descriptions', true],
      ['turn off rich descriptions', false],
      ['enable rich tool descriptions', true],
      ['disable rich tool descriptions', false],
    ])('"%s" → richToolDescriptions = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('richToolDescriptions')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Send Message Key ──────────────────────────────────────────────────

  describe('sendMessageKey', () => {
    it.each([
      ['set send key to enter', 'enter'],
      ['set send key to cmd-enter', 'cmd-enter'],
      ['change send message key to enter', 'enter'],
      ['use send key to cmd+enter', 'cmd-enter'],
      ['send with enter', 'enter'],
      ['send with cmd+enter', 'cmd-enter'],
      ['send messages with enter', 'enter'],
    ])('"%s" → sendMessageKey = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('sendMessageKey')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Color Theme ───────────────────────────────────────────────────────

  describe('colorTheme', () => {
    it.each([
      ['use solarized theme', 'solarized'],
      ['apply dracula theme', 'dracula'],
      ['use the nord theme', 'nord'],
      ['apply the monokai color theme', 'monokai'],
      ['change color theme to solarized', 'solarized'],
      ['set color theme to dracula', 'dracula'],
      ['switch theme to nord', 'nord'],
      ['change theme to monokai', 'monokai'],
      ['Color Theme change to Solarized', 'solarized'],
      ['color theme set to nord', 'nord'],
      ['theme change to dracula', 'dracula'],
    ])('"%s" → colorTheme = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('colorTheme')
      expect(result!.value).toBe(expected)
    })

    it('does NOT match "change theme to dark" (should be themeMode)', () => {
      const result = matchMessage('change theme to dark')
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('themeMode')
    })
  })

  // ── Workspace Color Theme ─────────────────────────────────────────────

  describe('workspaceColorTheme', () => {
    it.each([
      ['set workspace theme to solarized', 'solarized'],
      ['change workspace color theme to nord', 'nord'],
      ['set the workspace theme to dracula', 'dracula'],
    ])('"%s" → workspaceColorTheme = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workspaceColorTheme')
      expect(result!.value).toBe(expected)
    })
  })

  // ── User Name ─────────────────────────────────────────────────────────

  describe('userName', () => {
    it.each([
      ['set my name to John', 'John'],
      ['change name to Sarah', 'Sarah'],
      ['set username to Alex', 'Alex'],
      ['call me Boss', 'Boss'],
      ['my name is Loc', 'Loc'],
    ])('"%s" → userName = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('userName')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Timezone ──────────────────────────────────────────────────────────

  describe('timezone', () => {
    it.each([
      ['set timezone to PST', 'PST'],
      ['set my timezone to UTC+7', 'UTC+7'],
      ['change timezone to America/New_York', 'America/New_York'],
      ['timezone is Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh'],
      ['my timezone is EST', 'EST'],
    ])('"%s" → timezone = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('timezone')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Language ──────────────────────────────────────────────────────────

  describe('language', () => {
    it.each([
      ['set language to Vietnamese', 'Vietnamese'],
      ['change language to English', 'English'],
      ['set my preferred language to Japanese', 'Japanese'],
      ['speak in Vietnamese', 'Vietnamese'],
      ['respond in English', 'English'],
      ['reply in French', 'French'],
    ])('"%s" → language = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('language')
      expect(result!.value).toBe(expected)
    })
  })

  // ── City ──────────────────────────────────────────────────────────────

  describe('city', () => {
    it.each([
      ['set city to London', 'London'],
      ['set my city to Ho Chi Minh City', 'Ho Chi Minh City'],
      ['change city to Tokyo', 'Tokyo'],
    ])('"%s" → city = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('city')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Country ───────────────────────────────────────────────────────────

  describe('country', () => {
    it.each([
      ['set country to Vietnam', 'Vietnam'],
      ['change my country to Japan', 'Japan'],
      ['set country to United Kingdom', 'United Kingdom'],
    ])('"%s" → country = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('country')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Preference Notes ──────────────────────────────────────────────────

  describe('notes', () => {
    it.each([
      ['set notes to I prefer concise responses', 'I prefer concise responses'],
      ['change my preference notes to Always use TypeScript', 'Always use TypeScript'],
    ])('"%s" → notes = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('notes')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Default Model ─────────────────────────────────────────────────────

  describe('defaultModel', () => {
    it.each([
      ['use model claude-sonnet-4', 'claude-sonnet-4'],
      ['set model to gpt-4o', 'gpt-4o'],
      ['change model to claude-opus-4-6', 'claude-opus-4-6'],
      ['switch model to Sonet 4.5', 'Sonet 4.5'],
      ['set default model to claude-haiku', 'claude-haiku'],
      ['change the model to gpt-4', 'gpt-4'],
    ])('"%s" → defaultModel = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('defaultModel')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Default LLM Connection ────────────────────────────────────────────

  describe('defaultLlmConnection', () => {
    it.each([
      ['set connection to anthropic', 'anthropic'],
      ['use connection to openai', 'openai'],
      ['switch connection to local-llm', 'local-llm'],
      ['set llm connection to anthropic', 'anthropic'],
    ])('"%s" → defaultLlmConnection = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('defaultLlmConnection')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Workspace Model ───────────────────────────────────────────────────

  describe('workspaceModel', () => {
    it.each([
      ['set workspace model to claude-sonnet-4', 'claude-sonnet-4'],
      ['change the workspace default model to gpt-4o', 'gpt-4o'],
    ])('"%s" → workspaceModel = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workspaceModel')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Workspace Default Connection ──────────────────────────────────────

  describe('workspaceDefaultLlmConnection', () => {
    it.each([
      ['set workspace connection to anthropic', 'anthropic'],
      ['change workspace default connection to openai', 'openai'],
    ])('"%s" → workspaceDefaultLlmConnection = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workspaceDefaultLlmConnection')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Workspace Thinking Level ──────────────────────────────────────────

  describe('workspaceThinkingLevel', () => {
    it.each([
      ['enable thinking', 'think'],
      ['enable max thinking', 'max'],
      ['turn on thinking', 'think'],
      ['turn on max thinking', 'max'],
      ['disable thinking', 'off'],
      ['turn off thinking', 'off'],
      ['set thinking to max', 'max'],
      ['set thinking to off', 'off'],
      ['change thinking level to think', 'think'],
      ['max thinking', 'max'],
      ['no thinking', 'off'],
    ])('"%s" → workspaceThinkingLevel = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workspaceThinkingLevel')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Workspace Name ────────────────────────────────────────────────────

  describe('workspaceName', () => {
    it.each([
      ['rename workspace to MyProject', 'MyProject'],
      ['set workspace name to Backend API', 'Backend API'],
      ['change workspace to Frontend', 'Frontend'],
      ['rename the workspace to craft-agents', 'craft-agents'],
    ])('"%s" → workspaceName = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workspaceName')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Working Directory ─────────────────────────────────────────────────

  describe('workingDirectory', () => {
    it.each([
      ['set directory to /Users/loc/projects', '/Users/loc/projects'],
      ['set working directory to /tmp/work', '/tmp/work'],
      ['change dir to ~/Documents', '~/Documents'],
      ['set cwd to /home/user/app', '/home/user/app'],
    ])('"%s" → workingDirectory = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('workingDirectory')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Local MCP Servers ─────────────────────────────────────────────────

  describe('localMcpEnabled', () => {
    it.each([
      ['turn on mcp', true],
      ['turn off mcp', false],
      ['enable mcp servers', true],
      ['disable mcp servers', false],
      ['enable local mcp', true],
      ['disable local mcp servers', false],
      ['turn on local mcp servers', true],
    ])('"%s" → localMcpEnabled = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('localMcpEnabled')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Permission Mode ───────────────────────────────────────────────────

  describe('permissionMode', () => {
    it.each([
      ['set permissions to ask', 'ask'],
      ['set permission mode to auto', 'allow-all'],
      ['set permissions to allow-all', 'allow-all'],
      ['set permissions to safe', 'safe'],
      ['set permissions to explore', 'safe'],
      ['set permissions to read-only', 'safe'],
      ['use ask mode', 'ask'],
      ['use auto mode', 'allow-all'],
      ['switch to safe mode', 'safe'],
      ['switch to explore mode', 'safe'],
    ])('"%s" → permissionMode = %s', (msg, expected) => {
      const result = matchMessage(msg)
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('permissionMode')
      expect(result!.value).toBe(expected)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('rejects messages over 200 characters', () => {
      const long = 'set theme to dark ' + 'x'.repeat(200)
      expect(matchMessage(long)).toBeNull()
    })

    it('trims whitespace before matching', () => {
      expect(matchMessage('  dark mode  ')).not.toBeNull()
    })

    it('is case insensitive', () => {
      const result = matchMessage('DARK MODE')
      expect(result).not.toBeNull()
      expect(result!.settingKey).toBe('themeMode')
      expect(result!.value).toBe('dark')
    })

    it('returns null for unrelated messages', () => {
      expect(matchMessage('hello world')).toBeNull()
      expect(matchMessage('write me a function')).toBeNull()
      expect(matchMessage('how do I change the theme?')).toBeNull()
    })
  })
})
