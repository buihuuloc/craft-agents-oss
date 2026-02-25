/**
 * Settings Intent Registry
 *
 * Comprehensive registry mapping all app settings to their types, getter/setter
 * functions, and risk classification. Enables the chat-driven settings system
 * where users can query and modify settings via natural language.
 *
 * Risk classification:
 * - risky: false  => Safe to apply instantly (visual, informational)
 * - risky: true   => Requires preview/confirmation before applying (data, security, identity)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the active workspace ID from the Electron main process. */
async function getActiveWorkspaceId(): Promise<string> {
  const wsId = await window.electronAPI.getWindowWorkspace()
  if (!wsId) throw new Error('No active workspace')
  return wsId
}

/** Read a single workspace setting by key. */
async function getWorkspaceSetting<T = unknown>(key: string): Promise<T> {
  const wsId = await getActiveWorkspaceId()
  const settings = await window.electronAPI.getWorkspaceSettings(wsId)
  return (settings as Record<string, unknown>)?.[key] as T
}

/** Write a single workspace setting by key. */
async function setWorkspaceSetting(key: string, value: unknown): Promise<void> {
  const wsId = await getActiveWorkspaceId()
  await window.electronAPI.updateWorkspaceSetting(wsId, key as any, value as any)
}

// ---------------------------------------------------------------------------
// Preferences helpers (JSON file at ~/.craft-agent/preferences.json)
// ---------------------------------------------------------------------------

interface PreferencesJson {
  name?: string
  timezone?: string
  language?: string
  location?: { city?: string; country?: string }
  notes?: string
  updatedAt?: number
}

async function readPreferencesJson(): Promise<PreferencesJson> {
  const result = await window.electronAPI.readPreferences()
  try {
    return JSON.parse(result.content) as PreferencesJson
  } catch {
    return {}
  }
}

async function writePreferencesField(field: string, value: unknown): Promise<void> {
  const prefs = await readPreferencesJson()
  if (field === 'city' || field === 'country') {
    if (!prefs.location) prefs.location = {}
    ;(prefs.location as Record<string, unknown>)[field] = value
  } else {
    ;(prefs as Record<string, unknown>)[field] = value
  }
  prefs.updatedAt = Date.now()
  await window.electronAPI.writePreferences(JSON.stringify(prefs, null, 2))
}

// ---------------------------------------------------------------------------
// localStorage helpers (for settings stored in browser localStorage)
// ---------------------------------------------------------------------------

const LS_PREFIX = 'craft-'

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function lsSet(key: string, value: unknown): void {
  localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(value))
}

// ---------------------------------------------------------------------------
// Theme helpers
// The ThemeContext persists mode/colorTheme/font to localStorage and
// broadcasts across windows. For the settings registry we read/write
// localStorage directly and trigger a broadcast so other windows sync.
// ---------------------------------------------------------------------------

interface StoredTheme {
  mode?: string
  colorTheme?: string
  font?: string
  isUserOverride?: boolean
}

function loadStoredTheme(): StoredTheme {
  return lsGet<StoredTheme>('theme', {})
}

function saveStoredTheme(patch: Partial<StoredTheme>): void {
  const current = loadStoredTheme()
  lsSet('theme', { ...current, ...patch })
}

async function broadcastThemePreferences(): Promise<void> {
  const t = loadStoredTheme()
  await window.electronAPI.broadcastThemePreferences?.({
    mode: t.mode ?? 'system',
    colorTheme: t.colorTheme ?? 'default',
    font: t.font ?? 'inter',
  })
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const settingsRegistry: SettingDefinition[] = [
  // =========================================================================
  // APP SETTINGS
  // =========================================================================
  {
    key: 'notifications',
    label: 'Desktop Notifications',
    description: 'Get notified when AI finishes working in a chat.',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getNotificationsEnabled(),
    setValue: async (v) => {
      await window.electronAPI.setNotificationsEnabled(v as boolean)
    },
  },
  {
    key: 'keepAwake',
    label: 'Keep Screen Awake',
    description: 'Prevent the screen from turning off while sessions are running.',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getKeepAwakeWhileRunning(),
    setValue: async (v) => {
      await window.electronAPI.setKeepAwakeWhileRunning(v as boolean)
    },
  },

  // =========================================================================
  // INPUT SETTINGS
  // =========================================================================
  {
    key: 'autoCapitalisation',
    label: 'Auto Capitalisation',
    description: 'Automatically capitalise the first letter when typing a message.',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getAutoCapitalisation(),
    setValue: async (v) => {
      await window.electronAPI.setAutoCapitalisation(v as boolean)
    },
  },
  {
    key: 'spellCheck',
    label: 'Spell Check',
    description: 'Underline misspelled words while typing.',
    category: 'app',
    type: 'toggle',
    risky: false,
    getValue: () => window.electronAPI.getSpellCheck(),
    setValue: async (v) => {
      await window.electronAPI.setSpellCheck(v as boolean)
    },
  },
  {
    key: 'sendMessageKey',
    label: 'Send Message Key',
    description: 'Keyboard shortcut for sending messages.',
    category: 'app',
    type: 'select',
    options: [
      { label: 'Enter', value: 'enter' },
      { label: 'Cmd+Enter', value: 'cmd-enter' },
    ],
    risky: false,
    getValue: () => window.electronAPI.getSendMessageKey(),
    setValue: async (v) => {
      await window.electronAPI.setSendMessageKey(v as 'enter' | 'cmd-enter')
    },
  },

  // =========================================================================
  // APPEARANCE SETTINGS
  // =========================================================================
  {
    key: 'themeMode',
    label: 'Theme Mode',
    description: 'Light, dark, or system-matched appearance mode.',
    category: 'appearance',
    type: 'select',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
    risky: false,
    getValue: async () => {
      const t = loadStoredTheme()
      return t.mode ?? 'system'
    },
    setValue: async (v) => {
      saveStoredTheme({ mode: v as string })
      await broadcastThemePreferences()
    },
  },
  {
    key: 'colorTheme',
    label: 'Color Theme',
    description: 'The color theme preset applied to the app.',
    category: 'appearance',
    type: 'select',
    // Options loaded dynamically from presets; omit static list here.
    risky: false,
    getValue: async () => {
      const t = loadStoredTheme()
      return t.colorTheme ?? 'default'
    },
    setValue: async (v) => {
      saveStoredTheme({ colorTheme: v as string, isUserOverride: true })
      await window.electronAPI.setColorTheme?.(v as string)
      await broadcastThemePreferences()
    },
  },
  {
    key: 'font',
    label: 'Font',
    description: 'UI font family used throughout the app.',
    category: 'appearance',
    type: 'select',
    options: [
      { label: 'Inter', value: 'inter' },
      { label: 'System', value: 'system' },
    ],
    risky: false,
    getValue: async () => {
      const t = loadStoredTheme()
      return t.font ?? 'inter'
    },
    setValue: async (v) => {
      saveStoredTheme({ font: v as string })
      await broadcastThemePreferences()
    },
  },
  {
    key: 'connectionIcons',
    label: 'Connection Icons',
    description: 'Show provider icons in the session list and model selector.',
    category: 'appearance',
    type: 'toggle',
    risky: false,
    getValue: async () => lsGet('show-connection-icons', true),
    setValue: async (v) => {
      lsSet('show-connection-icons', v as boolean)
    },
  },
  {
    key: 'richToolDescriptions',
    label: 'Rich Tool Descriptions',
    description: 'Add action names and intent descriptions to all tool calls. Provides richer activity context in sessions.',
    category: 'appearance',
    type: 'toggle',
    risky: false,
    getValue: async () => {
      return (await window.electronAPI.getRichToolDescriptions?.()) ?? true
    },
    setValue: async (v) => {
      await window.electronAPI.setRichToolDescriptions?.(v as boolean)
    },
  },

  // =========================================================================
  // AI SETTINGS
  // =========================================================================
  {
    key: 'defaultLlmConnection',
    label: 'Default LLM Connection',
    description: 'The default API connection used for new chats when no workspace override is set.',
    category: 'ai',
    type: 'select',
    // Options are dynamic (loaded from listLlmConnections)
    risky: true,
    getValue: async () => {
      const connections = await window.electronAPI.listLlmConnectionsWithStatus()
      const def = (connections as Array<{ isDefault?: boolean; slug: string }>).find((c) => c.isDefault)
      return def?.slug ?? null
    },
    setValue: async (v) => {
      await window.electronAPI.setDefaultLlmConnection(v as string)
    },
  },
  {
    key: 'defaultModel',
    label: 'Default Model',
    description: 'The AI model used for new chats by the default connection.',
    category: 'ai',
    type: 'select',
    // Options are dynamic (depend on selected connection)
    risky: true,
    getValue: async () => {
      const connections = await window.electronAPI.listLlmConnectionsWithStatus()
      const def = (connections as Array<{ isDefault?: boolean; defaultModel?: string }>).find((c) => c.isDefault)
      return def?.defaultModel ?? null
    },
    setValue: async (v) => {
      const connections = await window.electronAPI.listLlmConnectionsWithStatus()
      const def = connections.find((c) => c.isDefault)
      if (!def) throw new Error('No default connection found')
      // Strip runtime-only status fields before saving as LlmConnection
      const { isAuthenticated: _a, authError: _b, isDefault: _c, ...connectionData } = def
      await window.electronAPI.saveLlmConnection({ ...connectionData, defaultModel: v as string })
    },
  },
  {
    key: 'workspaceDefaultLlmConnection',
    label: 'Workspace Default Connection',
    description: 'Override the default LLM connection for the active workspace.',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('defaultLlmConnection')) ?? null
    },
    setValue: async (v) => {
      const wsId = await getActiveWorkspaceId()
      const slug = (v as string) === 'global' ? null : (v as string)
      await window.electronAPI.setWorkspaceDefaultLlmConnection(wsId, slug)
    },
  },
  {
    key: 'workspaceModel',
    label: 'Workspace Default Model',
    description: 'Override the default AI model for the active workspace.',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('model')) ?? null
    },
    setValue: async (v) => {
      const val = (v as string) === 'global' ? undefined : (v as string)
      await setWorkspaceSetting('model', val)
    },
  },
  {
    key: 'workspaceThinkingLevel',
    label: 'Workspace Thinking Level',
    description: 'Override the reasoning depth for new chats in the active workspace.',
    category: 'ai',
    type: 'select',
    options: [
      { label: 'Use Default', value: 'global' },
      { label: 'No Thinking', value: 'off' },
      { label: 'Thinking', value: 'think' },
      { label: 'Max Thinking', value: 'max' },
    ],
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('thinkingLevel')) ?? 'global'
    },
    setValue: async (v) => {
      const val = (v as string) === 'global' ? undefined : (v as string)
      await setWorkspaceSetting('thinkingLevel', val)
    },
  },

  // =========================================================================
  // WORKSPACE SETTINGS
  // =========================================================================
  {
    key: 'workspaceName',
    label: 'Workspace Name',
    description: 'Display name of the active workspace.',
    category: 'workspace',
    type: 'text',
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('name')) ?? ''
    },
    setValue: async (v) => {
      await setWorkspaceSetting('name', v as string)
    },
  },
  {
    key: 'workingDirectory',
    label: 'Working Directory',
    description: 'Default working directory for the active workspace. Used as the cwd for shell commands.',
    category: 'workspace',
    type: 'text',
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('workingDirectory')) ?? ''
    },
    setValue: async (v) => {
      const val = (v as string) || undefined
      await setWorkspaceSetting('workingDirectory', val)
    },
  },
  {
    key: 'localMcpEnabled',
    label: 'Local MCP Servers',
    description: 'Enable stdio subprocess MCP servers in the active workspace.',
    category: 'workspace',
    type: 'toggle',
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('localMcpEnabled')) ?? true
    },
    setValue: async (v) => {
      await setWorkspaceSetting('localMcpEnabled', v as boolean)
    },
  },

  // =========================================================================
  // PERMISSIONS SETTINGS
  // =========================================================================
  {
    key: 'permissionMode',
    label: 'Permission Mode',
    description: 'Default permission mode for the active workspace. Controls what the AI agent can do (safe = read-only, ask = prompt before edits, allow-all = full auto).',
    category: 'permissions',
    type: 'select',
    options: [
      { label: 'Explore (read-only)', value: 'safe' },
      { label: 'Ask to Edit', value: 'ask' },
      { label: 'Auto (full access)', value: 'allow-all' },
    ],
    risky: true,
    getValue: async () => {
      return (await getWorkspaceSetting('permissionMode')) ?? 'ask'
    },
    setValue: async (v) => {
      await setWorkspaceSetting('permissionMode', v as string)
    },
  },

  // =========================================================================
  // PREFERENCES (user profile stored in ~/.craft-agent/preferences.json)
  // =========================================================================
  {
    key: 'userName',
    label: 'User Name',
    description: 'How Craft Agent should address you.',
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.name ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('name', v as string)
    },
  },
  {
    key: 'timezone',
    label: 'Timezone',
    description: "Used for relative dates like 'tomorrow' or 'next week'.",
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.timezone ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('timezone', v as string)
    },
  },
  {
    key: 'language',
    label: 'Language',
    description: "Preferred language for Craft Agent's responses.",
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.language ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('language', v as string)
    },
  },
  {
    key: 'city',
    label: 'City',
    description: 'Your city for local information and context.',
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.location?.city ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('city', v as string)
    },
  },
  {
    key: 'country',
    label: 'Country',
    description: 'Your country for regional formatting and context.',
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.location?.country ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('country', v as string)
    },
  },
  {
    key: 'notes',
    label: 'Preference Notes',
    description: 'Free-form context that helps Craft Agent understand your preferences.',
    category: 'preferences',
    type: 'text',
    risky: false,
    getValue: async () => {
      const prefs = await readPreferencesJson()
      return prefs.notes ?? ''
    },
    setValue: async (v) => {
      await writePreferencesField('notes', v as string)
    },
  },

  // =========================================================================
  // WORKSPACE THEME OVERRIDE
  // =========================================================================
  {
    key: 'workspaceColorTheme',
    label: 'Workspace Color Theme',
    description: 'Override the color theme for the active workspace.',
    category: 'appearance',
    type: 'select',
    // Options are dynamic (loaded from preset themes)
    risky: false,
    getValue: async () => {
      const wsId = await getActiveWorkspaceId()
      const theme = await window.electronAPI.getWorkspaceColorTheme?.(wsId)
      return theme ?? 'default'
    },
    setValue: async (v) => {
      const wsId = await getActiveWorkspaceId()
      const themeId = (v as string) === 'default' ? null : (v as string)
      await window.electronAPI.setWorkspaceColorTheme?.(wsId, themeId)
      await window.electronAPI.broadcastWorkspaceThemeChange?.(wsId, themeId)
    },
  },
]

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Find settings matching a free-text query.
 * Searches across key, label, description, and category fields.
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

/**
 * Look up a single setting by its exact key.
 */
export function getSettingByKey(key: string): SettingDefinition | undefined {
  return settingsRegistry.find((s) => s.key === key)
}
