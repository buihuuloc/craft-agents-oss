/**
 * Settings Tool — Bridges agent intent to the settings registry.
 *
 * This is the execution layer for chat-driven settings. The agent (LLM) calls
 * this tool with a structured action (list/get/set/search) and receives a
 * serializable result that can be rendered in the chat stream.
 *
 * Key design decisions:
 * - The `setting` field in SettingsToolResult contains ONLY serializable metadata
 *   (no getValue/setValue functions).
 * - All settings are applied instantly — no confirmation gate.
 * - All async operations are wrapped in try/catch for robust error handling.
 */

import { settingsRegistry, findSettings, dispatchSettingsChanged } from './settings-intent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsToolCall {
  action: 'list' | 'get' | 'set' | 'search'
  category?: string
  key?: string
  value?: unknown
  query?: string
}

export interface SettingsToolResult {
  success: boolean
  data?: unknown
  error?: string
  requiresConfirmation?: boolean
  setting?: { key: string; label: string; description: string; category: string }
  currentValue?: unknown
  newValue?: unknown
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeSettingsTool(
  call: SettingsToolCall,
): Promise<SettingsToolResult> {
  switch (call.action) {
    case 'list': {
      const settings = call.category
        ? settingsRegistry.filter((s) => s.category === call.category)
        : settingsRegistry
      return {
        success: true,
        data: settings.map((s) => ({
          key: s.key,
          label: s.label,
          category: s.category,
          type: s.type,
        })),
      }
    }

    case 'search': {
      const results = findSettings(call.query || '')
      return {
        success: true,
        data: results.map((s) => ({
          key: s.key,
          label: s.label,
          description: s.description,
        })),
      }
    }

    case 'get': {
      const setting = settingsRegistry.find((s) => s.key === call.key)
      if (!setting) {
        return { success: false, error: `Setting "${call.key}" not found` }
      }
      try {
        const value = await setting.getValue()
        return {
          success: true,
          data: { key: setting.key, label: setting.label, value },
        }
      } catch (err) {
        return {
          success: false,
          error: `Failed to read setting: ${err}`,
        }
      }
    }

    case 'set': {
      const setting = settingsRegistry.find((s) => s.key === call.key)
      if (!setting) {
        return { success: false, error: `Setting "${call.key}" not found` }
      }
      try {
        const currentValue = await setting.getValue()
        await setting.setValue(call.value)
        dispatchSettingsChanged(setting.key, call.value)
        return {
          success: true,
          data: {
            key: setting.key,
            applied: true,
            oldValue: currentValue,
            newValue: call.value,
          },
        }
      } catch (err) {
        return {
          success: false,
          error: `Failed to update setting: ${err}`,
        }
      }
    }

    default:
      return {
        success: false,
        error: `Unknown action: ${String((call as unknown as Record<string, unknown>).action)}`,
      }
  }
}
