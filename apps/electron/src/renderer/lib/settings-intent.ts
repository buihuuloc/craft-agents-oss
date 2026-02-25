/**
 * Settings Intent System — Registry of all chat-accessible settings.
 *
 * This maps natural language setting changes to IPC calls.
 * The agent (LLM) handles understanding — this is the execution layer.
 *
 * Stub: This file will be fully populated by Task 10.
 * Provides the minimal exports needed by settings-tool.ts.
 */

export interface SettingDefinition {
  key: string
  label: string
  description: string
  category: 'app' | 'workspace' | 'ai' | 'appearance' | 'permissions' | 'preferences'
  type: 'toggle' | 'select' | 'text' | 'number'
  options?: { label: string; value: string }[]
  risky: boolean
  getValue: () => Promise<unknown>
  setValue: (value: unknown) => Promise<void>
}

export const settingsRegistry: SettingDefinition[] = [
  // App settings
  {
    key: 'notifications',
    label: 'Desktop Notifications',
    description: 'Show desktop notifications for new messages',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getNotificationsEnabled(),
    setValue: (v) => window.electronAPI.setNotificationsEnabled(v as boolean),
  },
  {
    key: 'keepAwake',
    label: 'Keep Awake While Running',
    description: 'Prevent sleep while agents are active',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getKeepAwakeWhileRunning(),
    setValue: (v) => window.electronAPI.setKeepAwakeWhileRunning(v as boolean),
  },
  // Appearance settings
  {
    key: 'theme',
    label: 'Theme',
    description: 'App color scheme',
    category: 'appearance',
    type: 'select',
    options: [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
      { label: 'System', value: 'system' },
    ],
    risky: false,
    getValue: async () => {
      const stored = localStorage.getItem('craft-theme')
      return stored ?? 'system'
    },
    setValue: async (v) => {
      localStorage.setItem('craft-theme', v as string)
    },
  },
  // AI settings (risky — require confirmation)
  {
    key: 'defaultConnection',
    label: 'Default LLM Connection',
    description: 'The default AI provider for new sessions',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: async () => null, // Populated when Task 10 is complete
    setValue: async () => {},
  },
  {
    key: 'defaultModel',
    label: 'Default Model',
    description: 'The default model for new sessions',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: async () => null,
    setValue: async () => {},
  },
  // Permissions (risky)
  {
    key: 'permissionMode',
    label: 'Permission Mode',
    description: 'Default permission level for agent actions',
    category: 'permissions',
    type: 'select',
    options: [
      { label: 'Safe (ask for everything)', value: 'safe' },
      { label: 'Ask to Edit', value: 'ask' },
      { label: 'Auto (allow all)', value: 'allow-all' },
    ],
    risky: true,
    getValue: async () => null,
    setValue: async () => {},
  },
  // Preferences
  {
    key: 'userName',
    label: 'Your Name',
    description: 'Name used by the agent to address you',
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const result = await window.electronAPI.readPreferences()
      if (!result.exists) return undefined
      try {
        const prefs = JSON.parse(result.content)
        return prefs?.name
      } catch {
        return undefined
      }
    },
    setValue: async (v) => {
      const result = await window.electronAPI.readPreferences()
      let prefs: Record<string, unknown> = {}
      if (result.exists) {
        try {
          prefs = JSON.parse(result.content)
        } catch {
          // Start fresh if parse fails
        }
      }
      prefs.name = v as string
      await window.electronAPI.writePreferences(JSON.stringify(prefs, null, 2))
    },
  },
]

/**
 * Search settings by query string.
 * Matches against key, label, description, and category.
 */
export function findSettings(query: string): SettingDefinition[] {
  const q = query.toLowerCase()
  return settingsRegistry.filter(
    (s) =>
      s.key.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q),
  )
}
