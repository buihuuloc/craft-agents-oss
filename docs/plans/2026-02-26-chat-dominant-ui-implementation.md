# Chat-Dominant 2-Column UI Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Craft Agents from a 3-4 panel layout to a chat-dominant 2-column interface where all settings are editable via conversation, navigation is via Cmd+K command palette, and a contextual artifact panel slides in only when needed.

**Architecture:** Progressive simplification in 4 phases. Phase 1 replaces sidebar/navigator with command palette. Phase 2 adds contextual artifact panel. Phase 3 makes settings chat-driven. Phase 4 adds home screen. Each phase is independently shippable.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Jotai, `cmdk` (already installed), `motion` (Framer Motion, already installed), Radix UI, Electron IPC.

**Design Doc:** `docs/plans/2026-02-26-chat-dominant-ui-migration-design.md`

---

## Phase 1: Command Palette + Minimal Chrome

> Strip the 3-panel layout to single-column chat with Cmd+K navigation.

### Task 1: Create CommandPalette Component

**Files:**
- Create: `apps/electron/src/renderer/components/command-palette/CommandPalette.tsx`
- Create: `apps/electron/src/renderer/components/command-palette/index.ts`
- Create: `apps/electron/src/renderer/atoms/command-palette.ts`

**Context:**
- `cmdk` is already installed (`package.json` dependency)
- Existing `cmdk` usage: search for any existing Command component in `components/ui/` — there's likely a `Command.tsx` wrapping cmdk already
- Navigation functions available via `useNavigation()` from `contexts/NavigationContext.tsx`
- Session data via `sessionMetaMapAtom` from `atoms/sessions.ts`
- Sources via `sourcesAtom`, skills via `skillsAtom`

**Step 1: Create command palette atom**

```typescript
// apps/electron/src/renderer/atoms/command-palette.ts
import { atom } from 'jotai'

export const commandPaletteOpenAtom = atom(false)
```

**Step 2: Create CommandPalette component**

Build a full-screen modal overlay using `cmdk` that searches across:
- Sessions (from `sessionMetaMapAtom`) — icon: MessageSquare, show name + preview
- Sources (from `sourcesAtom`) — icon: Plug, show name + type
- Skills (from `skillsAtom`) — icon: Sparkles, show name
- Settings (hardcoded list of 9 settings subpages) — icon: Settings
- Actions (New Session, Toggle Theme, etc.) — icon: Zap

Structure:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="p-0 max-w-2xl">
    <Command shouldFilter={true}>
      <Command.Input placeholder="Search sessions, sources, settings..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Sessions">
          {sessions.map(s => <Command.Item onSelect={() => navigateToSession(s.id)} />)}
        </Command.Group>
        <Command.Group heading="Sources">...</Command.Group>
        <Command.Group heading="Skills">...</Command.Group>
        <Command.Group heading="Settings">...</Command.Group>
        <Command.Group heading="Actions">...</Command.Group>
      </Command.List>
    </Command>
  </DialogContent>
</Dialog>
```

Key behaviors:
- Opens on `Cmd+K` (register global keyboard shortcut)
- Flat search — no prefix scoping, results ranked by `cmdk`'s fuzzy matching
- On select: navigate using `useNavigation().navigate()` and close palette
- Actions group includes: "New Session", "Toggle Dark Mode", "Toggle Scenic Mode"
- Sessions show: name (or preview if no name), last message timestamp
- Show max 5 results per group, scrollable

**Step 3: Create barrel export**

```typescript
// apps/electron/src/renderer/components/command-palette/index.ts
export { CommandPalette } from './CommandPalette'
```

**Step 4: Commit**

```bash
git add apps/electron/src/renderer/components/command-palette/ apps/electron/src/renderer/atoms/command-palette.ts
git commit -m "feat: add CommandPalette component with flat unified search"
```

---

### Task 2: Create MinimalTopBar Component

**Files:**
- Create: `apps/electron/src/renderer/components/app-shell/MinimalTopBar.tsx`

**Context:**
- Must handle macOS traffic light (stoplight) compensation — see `StoplightProvider` usage in `MainContentPanel.tsx:130-134`
- Needs `-webkit-app-region: drag` for Electron window dragging
- Back button uses `useNavigation().goBack()` and `canGoBack`
- Workspace name from `AppShellContext`

**Step 1: Create MinimalTopBar**

```tsx
// apps/electron/src/renderer/components/app-shell/MinimalTopBar.tsx
interface MinimalTopBarProps {
  onCommandPaletteOpen: () => void
}
```

Structure:
```
┌──────────────────────────────────────────────────────┐
│ [←Back]  [WorkspaceName ▾]          [⌘K]  [···]  [+] │
└──────────────────────────────────────────────────────┘
```

- Left: Back button (only visible when `canGoBack`), workspace name (clickable → opens command palette)
- Right: Search icon button (opens command palette), overflow menu (HeaderMenu), new session button
- Height: `h-11` (44px), same as existing panel headers
- Background: transparent with `-webkit-app-region: drag` for window dragging
- Buttons use `-webkit-app-region: no-drag`
- Fades in/out behavior: NOT implementing scroll-based fade in Phase 1 (YAGNI), just static top bar

**Step 2: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/MinimalTopBar.tsx
git commit -m "feat: add MinimalTopBar with back, search, and new session"
```

---

### Task 3: Create New AppShell Layout (ChatDominantShell)

**Files:**
- Create: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx`
- Modify: `apps/electron/src/renderer/App.tsx` — swap AppShell for ChatDominantShell

**Context:**
- Current `AppShell.tsx` is 1,568 lines — too complex to modify in-place
- Create a new shell component that reuses existing children (ChatDisplay, MainContentPanel logic)
- `AppShellContext` must still be provided (same `contextValue` prop)
- All existing providers in App.tsx remain unchanged

**Step 1: Create ChatDominantShell**

This is the core layout refactor. The new shell:

```tsx
interface ChatDominantShellProps {
  contextValue: AppShellContextType
  menuNewChatTrigger?: number
  isFocusedMode?: boolean
}
```

Layout structure:
```tsx
<AppShellProvider value={contextValue}>
  <div className="flex flex-col h-screen w-screen">
    <MinimalTopBar onCommandPaletteOpen={() => setCommandPaletteOpen(true)} />
    <div className="flex flex-1 min-h-0">
      {/* Chat panel — takes full width by default */}
      <div className={cn("flex-1 min-w-0", artifactVisible && "w-[60%]")}>
        <MainContent />
      </div>
      {/* Context panel — slides in from right when artifact present */}
      {artifactVisible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "40%", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="border-l border-foreground-90"
        >
          <ContextPanel />
        </motion.div>
      )}
    </div>
    <CommandPalette />
  </div>
</AppShellProvider>
```

Key decisions:
- Reuse `MainContentPanel` routing logic but strip the panel wrapper
- The `MainContent` sub-component routes to ChatPage, SourceInfoPage, SkillInfoPage based on `navigationState` (same logic as `MainContentPanel.tsx:137-230`)
- For settings routes: in Phase 1, still render settings pages in the main panel (Phase 3 removes them)
- Preserve all existing context providers from App.tsx
- Preserve keyboard shortcuts (Cmd+N for new session, etc.)
- Preserve `sessionAtomFamily` and all Jotai state — no state changes

**Step 2: Modify App.tsx to use ChatDominantShell**

In `App.tsx`, replace the `<AppShell>` usage with `<ChatDominantShell>`:
- Same `contextValue` prop passed through
- Remove props that no longer apply: `defaultLayout`, `defaultCollapsed` (no resizable panels)
- Keep `menuNewChatTrigger` and `isFocusedMode`

**Step 3: Verify the app renders with the new layout**

Run the app and verify:
- Chat displays correctly at full width
- Cmd+K opens command palette
- Can search and navigate to sessions
- Can navigate to settings pages
- New session button works
- Back navigation works

**Step 4: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx apps/electron/src/renderer/App.tsx
git commit -m "feat: replace 3-panel AppShell with ChatDominantShell"
```

---

### Task 4: Wire Global Keyboard Shortcuts

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx`

**Context:**
- Existing shortcuts are registered in AppShell.tsx — find the `useEffect` with keyboard listeners
- Critical shortcuts to preserve: Cmd+N (new session), Cmd+/ (shortcuts), Cmd+, (settings)
- New shortcut: Cmd+K (command palette)

**Step 1: Add Cmd+K handler and preserve existing shortcuts**

In ChatDominantShell, add a `useEffect` that listens for:
- `Cmd+K` → toggle `commandPaletteOpenAtom`
- `Cmd+N` → create new session (use existing `onCreateSession` from context)
- `Cmd+,` → navigate to settings
- `Escape` → close command palette if open

Reuse existing shortcut patterns from AppShell.tsx — search for `addEventListener('keydown'` in that file.

**Step 2: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx
git commit -m "feat: wire Cmd+K and preserve global keyboard shortcuts"
```

---

### Task 5: Clean Up — Remove Old Panel Imports (but keep files)

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx` — ensure no imports from LeftSidebar, NavigatorPanel, SessionList

**Context:**
- Do NOT delete old components yet — other code may reference them, and we want a safe rollback path
- Just ensure the new shell doesn't import them
- The old `AppShell.tsx` remains in the codebase but is no longer imported by App.tsx

**Step 1: Audit imports in ChatDominantShell**

Ensure only these app-shell components are imported:
- `MinimalTopBar`
- `ChatDisplay` (or `ChatPage`)
- Any content routing logic extracted from `MainContentPanel`

**Step 2: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx
git commit -m "refactor: clean up ChatDominantShell imports"
```

---

## Phase 2: Contextual Artifact Panel

> Add the slide-in second column for rich artifacts.

### Task 6: Create Artifact State & Types

**Files:**
- Create: `apps/electron/src/renderer/atoms/artifact.ts`
- Create: `apps/electron/src/renderer/types/artifact.ts`

**Step 1: Define artifact types**

```typescript
// apps/electron/src/renderer/types/artifact.ts
export type ArtifactType =
  | { kind: 'source'; sourceSlug: string }
  | { kind: 'skill'; skillSlug: string }
  | { kind: 'session-meta'; sessionId: string }
  | { kind: 'settings-preview'; settingKey: string; currentValue: unknown; newValue: unknown }
  | { kind: 'multi-field-config'; title: string; fields: ConfigField[] }

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'select' | 'toggle'
  value: unknown
  options?: { label: string; value: string }[]
}
```

**Step 2: Create artifact atom**

```typescript
// apps/electron/src/renderer/atoms/artifact.ts
import { atom } from 'jotai'
import type { ArtifactType } from '../types/artifact'

export const activeArtifactAtom = atom<ArtifactType | null>(null)
```

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/types/artifact.ts apps/electron/src/renderer/atoms/artifact.ts
git commit -m "feat: add artifact types and atom for context panel"
```

---

### Task 7: Create ContextPanel Component

**Files:**
- Create: `apps/electron/src/renderer/components/context-panel/ContextPanel.tsx`
- Create: `apps/electron/src/renderer/components/context-panel/index.ts`

**Context:**
- Reads `activeArtifactAtom` to determine what to display
- Routes artifact kind to the correct card component
- Has a close button that sets `activeArtifactAtom` to null
- Esc key also closes

**Step 1: Create ContextPanel**

```tsx
// apps/electron/src/renderer/components/context-panel/ContextPanel.tsx
export function ContextPanel() {
  const [artifact, setArtifact] = useAtom(activeArtifactAtom)

  if (!artifact) return null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-11 border-b border-foreground-90">
        <span className="text-sm font-medium">{getTitle(artifact)}</span>
        <Button variant="ghost" size="icon" onClick={() => setArtifact(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ArtifactRenderer artifact={artifact} />
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Step 2: Create ArtifactRenderer** (in same file or separate)

Routes `artifact.kind` to:
- `source` → renders `SourceInfoPage` content (reuse existing component)
- `skill` → renders `SkillInfoPage` content (reuse existing component)
- `session-meta` → renders session metadata card
- `settings-preview` → renders settings diff preview (Phase 3)
- `multi-field-config` → renders config form (Phase 3)

For Phase 2, implement `source` and `skill` kinds only. Others return placeholder.

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/context-panel/
git commit -m "feat: add ContextPanel with artifact routing"
```

---

### Task 8: Integrate ContextPanel into ChatDominantShell

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx`

**Step 1: Add animated context panel**

Use `AnimatePresence` from `motion/react`:
```tsx
import { AnimatePresence, motion } from 'motion/react'

// In render:
<div className="flex flex-1 min-h-0">
  <div className={cn("flex-1 min-w-0 transition-all duration-300")}>
    <MainContent />
  </div>
  <AnimatePresence>
    {artifact && (
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 480, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="border-l border-foreground-90 overflow-hidden"
      >
        <ContextPanel />
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

Use fixed width (480px) instead of percentage — more predictable, doesn't squish chat too much.

**Step 2: Wire source/skill navigation to open artifact panel**

When user navigates to a source or skill via command palette:
- Instead of navigating to SourceInfoPage/SkillInfoPage in main panel, set `activeArtifactAtom` to show it in context panel
- Chat remains visible in the main panel

Modify the command palette's onSelect handlers for sources and skills.

**Step 3: Add Escape to close**

Add keyboard listener: `Escape` closes context panel (sets artifact to null) if open.

**Step 4: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx
git commit -m "feat: integrate animated ContextPanel into layout"
```

---

### Task 9: Create Artifact Cards for Sources and Skills

**Files:**
- Create: `apps/electron/src/renderer/components/context-panel/SourceCard.tsx`
- Create: `apps/electron/src/renderer/components/context-panel/SkillDetailCard.tsx`

**Context:**
- Reuse data fetching from existing `SourceInfoPage.tsx` and `SkillInfoPage.tsx`
- These cards are simpler versions — just the key info, not full pages
- Source card shows: name, type, connection status, tool count, [Disconnect] button
- Skill card shows: name, description, source, enabled/disabled toggle

**Step 1: Create SourceCard**

Read `SourceInfoPage.tsx` to understand the data shape and display patterns. Create a compact card version that shows:
- Source avatar + name
- Type badge (MCP / API / Local)
- Connection status (connected/disconnected with indicator)
- Tool count
- Action buttons: Disconnect, Refresh

Use existing `SourceAvatar` component from `components/ui/`.

**Step 2: Create SkillDetailCard**

Read `SkillInfoPage.tsx`. Create compact card:
- Skill name + icon
- Description
- Source attribution
- Enable/disable toggle

**Step 3: Wire into ArtifactRenderer**

Update the ArtifactRenderer switch to use these cards.

**Step 4: Commit**

```bash
git add apps/electron/src/renderer/components/context-panel/SourceCard.tsx apps/electron/src/renderer/components/context-panel/SkillDetailCard.tsx
git commit -m "feat: add SourceCard and SkillDetailCard for context panel"
```

---

## Phase 3: Chat-Driven Settings

> Replace all 9 settings pages with conversational settings via chat.

### Task 10: Create Settings Intent System

**Files:**
- Create: `apps/electron/src/renderer/lib/settings-intent.ts`

**Context:**
- This maps natural language setting changes to IPC calls
- The agent (LLM) handles understanding — this is the execution layer
- We need a registry of all available settings with their types, current values, and mutation functions

**Step 1: Create settings registry for chat**

```typescript
// apps/electron/src/renderer/lib/settings-intent.ts

export interface SettingDefinition {
  key: string
  label: string
  description: string
  category: 'app' | 'workspace' | 'ai' | 'appearance' | 'permissions' | 'preferences'
  type: 'toggle' | 'select' | 'text' | 'number'
  options?: { label: string; value: string }[]
  risky: boolean  // true = preview required, false = instant apply
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
    getValue: () => window.electronAPI.getAppSetting('theme'),
    setValue: (v) => window.electronAPI.setAppSetting('theme', v),
  },
  // AI settings (risky)
  {
    key: 'defaultConnection',
    label: 'Default LLM Connection',
    description: 'The default AI provider for new sessions',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: () => window.electronAPI.getAppSetting('defaultLlmConnection'),
    setValue: (v) => window.electronAPI.setAppSetting('defaultLlmConnection', v),
  },
  {
    key: 'defaultModel',
    label: 'Default Model',
    description: 'The default model for new sessions',
    category: 'ai',
    type: 'select',
    risky: true,
    getValue: () => window.electronAPI.getAppSetting('defaultModel'),
    setValue: (v) => window.electronAPI.setAppSetting('defaultModel', v),
  },
  // Workspace settings (risky)
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
    getValue: () => window.electronAPI.getAppSetting('permissionMode'),
    setValue: (v) => window.electronAPI.setAppSetting('permissionMode', v),
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
      const prefs = await window.electronAPI.readPreferences()
      return prefs?.name
    },
    setValue: async (v) => {
      const prefs = await window.electronAPI.readPreferences()
      await window.electronAPI.writePreferences({ ...prefs, name: v as string })
    },
  },
  // ... complete registry for all settings from the 9 pages
]

export function findSettings(query: string): SettingDefinition[] {
  const q = query.toLowerCase()
  return settingsRegistry.filter(
    s => s.key.toLowerCase().includes(q) ||
         s.label.toLowerCase().includes(q) ||
         s.description.toLowerCase().includes(q) ||
         s.category.toLowerCase().includes(q)
  )
}
```

**Step 2: Commit**

```bash
git add apps/electron/src/renderer/lib/settings-intent.ts
git commit -m "feat: add settings registry for chat-driven configuration"
```

---

### Task 11: Create Inline Settings Cards for Chat

**Files:**
- Create: `apps/electron/src/renderer/components/chat/SettingsConfirmationCard.tsx`
- Create: `apps/electron/src/renderer/components/chat/SettingsPreviewCard.tsx`

**Context:**
- These render inline in the chat message stream
- Confirmation card: shown after a safe setting is applied (read-only, success state)
- Preview card: shown for risky settings, has Confirm/Cancel buttons

**Step 1: Create SettingsConfirmationCard**

```tsx
// Inline card shown after a safe setting change is applied
interface SettingsConfirmationCardProps {
  settingLabel: string
  oldValue: string
  newValue: string
  appliedAt: Date
}

export function SettingsConfirmationCard({ settingLabel, oldValue, newValue, appliedAt }: Props) {
  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4 my-2 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="h-4 w-4 text-success" />
        <span className="text-sm font-medium">Setting Updated</span>
      </div>
      <div className="text-sm">
        <span className="text-foreground-30">{settingLabel}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="line-through text-foreground-50">{oldValue}</span>
          <ArrowRight className="h-3 w-3 text-foreground-50" />
          <span className="font-medium">{newValue}</span>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Create SettingsPreviewCard**

```tsx
// Inline card for risky setting changes requiring confirmation
interface SettingsPreviewCardProps {
  settingLabel: string
  description: string
  currentValue: string
  newValue: string
  onConfirm: () => void
  onCancel: () => void
  status: 'pending' | 'confirmed' | 'cancelled'
}

export function SettingsPreviewCard(props: Props) {
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-4 my-2 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-info" />
        <span className="text-sm font-medium">Confirm Change</span>
      </div>
      <div className="text-sm mb-3">
        <div className="font-medium">{settingLabel}</div>
        <div className="text-foreground-50 text-xs mt-0.5">{description}</div>
        <div className="mt-2 rounded bg-background p-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-foreground-50">Current</span>
            <span>{currentValue}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-50">New</span>
            <span className="font-medium text-info-text">{newValue}</span>
          </div>
        </div>
      </div>
      {status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      )}
      {status === 'confirmed' && (
        <div className="flex items-center gap-1 text-success text-sm">
          <CheckCircle className="h-3.5 w-3.5" /> Applied
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center gap-1 text-foreground-50 text-sm">
          <XCircle className="h-3.5 w-3.5" /> Cancelled
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/chat/SettingsConfirmationCard.tsx apps/electron/src/renderer/components/chat/SettingsPreviewCard.tsx
git commit -m "feat: add inline settings cards for chat-driven configuration"
```

---

### Task 12: Create Settings Tool for Agent

**Files:**
- Create: `apps/electron/src/renderer/lib/settings-tool.ts`

**Context:**
- The agent needs a "tool" that the chat system can call to read/write settings
- This bridges the LLM's intent to the settings registry
- The agent sees this as a tool use response in the message stream

**Step 1: Create settings tool handler**

```typescript
// apps/electron/src/renderer/lib/settings-tool.ts
import { settingsRegistry, findSettings, type SettingDefinition } from './settings-intent'

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
  setting?: SettingDefinition
  currentValue?: unknown
  newValue?: unknown
}

export async function executeSettingsTool(call: SettingsToolCall): Promise<SettingsToolResult> {
  switch (call.action) {
    case 'list': {
      const settings = call.category
        ? settingsRegistry.filter(s => s.category === call.category)
        : settingsRegistry
      return {
        success: true,
        data: settings.map(s => ({ key: s.key, label: s.label, category: s.category, type: s.type })),
      }
    }
    case 'search': {
      const results = findSettings(call.query || '')
      return {
        success: true,
        data: results.map(s => ({ key: s.key, label: s.label, description: s.description })),
      }
    }
    case 'get': {
      const setting = settingsRegistry.find(s => s.key === call.key)
      if (!setting) return { success: false, error: `Setting "${call.key}" not found` }
      const value = await setting.getValue()
      return { success: true, data: { key: setting.key, label: setting.label, value } }
    }
    case 'set': {
      const setting = settingsRegistry.find(s => s.key === call.key)
      if (!setting) return { success: false, error: `Setting "${call.key}" not found` }
      const currentValue = await setting.getValue()

      if (setting.risky) {
        return {
          success: true,
          requiresConfirmation: true,
          setting,
          currentValue,
          newValue: call.value,
        }
      }

      // Safe setting — apply immediately
      await setting.setValue(call.value)
      return {
        success: true,
        data: { key: setting.key, applied: true, oldValue: currentValue, newValue: call.value },
      }
    }
    default:
      return { success: false, error: `Unknown action: ${call.action}` }
  }
}
```

**Step 2: Commit**

```bash
git add apps/electron/src/renderer/lib/settings-tool.ts
git commit -m "feat: add settings tool for agent-driven configuration"
```

---

### Task 13: Integrate Settings Tool into Chat System

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx` — add settings card rendering
- Modify: Agent system prompt or tool definitions to include the settings tool

**Context:**
- The chat system processes messages from the agent. When a message contains a settings tool call result, render the appropriate card (SettingsConfirmationCard or SettingsPreviewCard)
- This integrates with the existing `TurnCard` / message rendering pipeline
- Look at how existing tool results are rendered in ChatDisplay (search for `ActivityItem` or tool rendering patterns)

**Step 1: Add settings card rendering to chat messages**

In the message rendering pipeline, detect settings tool results and render inline cards:
- If `requiresConfirmation: true` → render `SettingsPreviewCard` with confirm/cancel handlers
- If `applied: true` → render `SettingsConfirmationCard`

The exact integration point depends on how the agent tool system works — inspect the existing tool rendering in ChatDisplay.tsx and TurnCard.

**Step 2: Wire confirm/cancel actions**

When user clicks Confirm on a SettingsPreviewCard:
- Call `setting.setValue(newValue)` from the settings registry
- Update the card status to 'confirmed'
- Show a toast notification (using `sonner`)

When user clicks Cancel:
- Update card status to 'cancelled'
- No IPC call

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx
git commit -m "feat: integrate settings cards into chat message stream"
```

---

### Task 14: Add Settings Tool to Agent System Prompt

**Files:**
- Modify: Agent configuration / system prompt to describe the settings tool

**Context:**
- The agent needs to know it can use a `settings` tool with actions: list, get, set, search
- The system prompt should instruct the agent to use this tool when users ask about settings
- Search for where system prompts are defined — likely in `packages/shared/src/agent/` or via IPC

**Step 1: Find and update agent system prompt**

Search for system prompt construction in the codebase. Add instructions like:

```
You have access to a `settings` tool that can read and modify app settings.

When the user asks to change a setting:
1. Use settings.search to find the relevant setting
2. Use settings.get to show current value
3. Use settings.set to apply the change

Safe settings (theme, notifications, name) are applied instantly.
Risky settings (LLM provider, permissions, delete) require user confirmation via an inline card.

When the user asks "what settings are available" or "show my settings":
- Use settings.list to enumerate available settings by category
```

**Step 2: Commit**

```bash
git commit -m "feat: add settings tool to agent system prompt"
```

---

### Task 15: Remove Settings Pages Navigation

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx` — remove settings page routing
- Modify: Command palette — remove settings subpage navigation, add "Chat about settings" action instead

**Context:**
- Settings pages no longer need to be navigable
- Command palette settings entries should trigger a chat message like "Show me my [category] settings" instead of navigating to a page
- Keep settings page files in codebase for now (can be deleted in a cleanup task)

**Step 1: Update command palette**

Change settings items in CommandPalette from navigating to settings pages to inserting a chat message:
- "App Settings" → sends "Show me my app settings" to chat
- "AI Settings" → sends "Show me my AI configuration"
- "Appearance" → sends "Show me my appearance settings"
- etc.

**Step 2: Update content routing**

In ChatDominantShell, remove the settings navigator routing. All navigation states now route to chat.

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx apps/electron/src/renderer/components/command-palette/CommandPalette.tsx
git commit -m "feat: route settings to chat instead of settings pages"
```

---

## Phase 4: Home Screen

> Google-like landing when no session is active.

### Task 16: Create HomeScreen Component

**Files:**
- Create: `apps/electron/src/renderer/components/home/HomeScreen.tsx`
- Create: `apps/electron/src/renderer/components/home/index.ts`

**Context:**
- Shown when no active session is selected
- Centered layout with app name, search input, and recent sessions
- Search input doubles as Cmd+K trigger (typing opens command palette with the query pre-filled)

**Step 1: Create HomeScreen**

```tsx
export function HomeScreen() {
  const sessions = useAtomValue(sessionMetaMapAtom)
  const { navigate } = useNavigation()
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)

  // Get 5 most recent sessions
  const recentSessions = useMemo(() => {
    return Object.values(sessions)
      .filter(s => !s.isArchived && !s.hidden)
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
      .slice(0, 5)
  }, [sessions])

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col items-center gap-8 max-w-2xl w-full px-4">
        {/* App Title */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Craft Agents</h1>
        </div>

        {/* Search Input */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full max-w-lg flex items-center gap-3 px-4 py-3 rounded-xl
                     border border-foreground-80 bg-background
                     hover:border-foreground-60 transition-colors
                     text-foreground-50 text-sm cursor-text"
        >
          <Search className="h-4 w-4" />
          <span>What would you like to do?</span>
          <kbd className="ml-auto text-xs bg-foreground-90 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-foreground-50">
            <span>Recent:</span>
            {recentSessions.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && <span className="text-foreground-80">·</span>}
                <button
                  onClick={() => navigate(routes.view.allSessions(s.id))}
                  className="hover:text-foreground transition-colors truncate max-w-[150px]"
                >
                  {s.name || s.preview || 'Untitled'}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create barrel export**

```typescript
// apps/electron/src/renderer/components/home/index.ts
export { HomeScreen } from './HomeScreen'
```

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/home/
git commit -m "feat: add HomeScreen with centered search prompt"
```

---

### Task 17: Integrate HomeScreen into ChatDominantShell

**Files:**
- Modify: `apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx`

**Step 1: Show HomeScreen when no session is active**

In the main content routing:
```tsx
function MainContent() {
  const navState = useNavigationState()

  // No active session → show home screen
  if (navState.navigator === 'sessions' && !navState.details?.sessionId) {
    return <HomeScreen />
  }

  // Active session → show chat
  return <ChatPage />
}
```

**Step 2: Adjust MinimalTopBar**

When on home screen, the top bar should be invisible or minimal (just the overflow menu). The home screen has its own search prompt, so the Cmd+K button in the top bar is redundant on this screen.

```tsx
// In MinimalTopBar, accept a `minimal` prop
// When minimal=true: only show overflow menu, fully transparent
```

**Step 3: Commit**

```bash
git add apps/electron/src/renderer/components/app-shell/ChatDominantShell.tsx apps/electron/src/renderer/components/app-shell/MinimalTopBar.tsx
git commit -m "feat: show HomeScreen when no session is active"
```

---

### Task 18: Final Cleanup

**Files:**
- Delete (after verifying no imports): Old panel components that are no longer used
- Modify: Remove dead imports throughout the codebase

**Step 1: Verify no remaining imports of old components**

Search for imports of:
- `LeftSidebar`
- `NavigatorPanel`
- `SessionList` (as a panel — it may still be used in command palette search)
- `SettingsNavigator`
- `SourcesListPanel`
- `SkillsListPanel`

**Step 2: Delete unused components**

Only delete files that have zero imports remaining. Keep everything that's still referenced.

**Step 3: Clean up routes**

Remove settings subpage routes from `routes.ts` and `route-parser.ts` since settings are now chat-driven. Keep action routes and view routes.

**Step 4: Update NavigationState type**

Remove the `settings` navigator from the NavigationState union type if settings pages are fully removed.

**Step 5: Commit**

```bash
git commit -m "refactor: remove unused panel components and settings page routes"
```

---

## Dependency Graph

```
Phase 1:  Task 1 → Task 2 → Task 3 → Task 4 → Task 5
Phase 2:  Task 6 → Task 7 → Task 8 → Task 9
Phase 3:  Task 10 → Task 11 → Task 12 → Task 13 → Task 14 → Task 15
Phase 4:  Task 16 → Task 17 → Task 18

Phase 2 depends on Phase 1 (needs ChatDominantShell)
Phase 3 depends on Phase 2 (needs ContextPanel for previews)
Phase 4 depends on Phase 1 (needs ChatDominantShell)

Parallelizable:
- Phase 2 (Tasks 6-9) and Phase 4 (Tasks 16-17) can run in parallel after Phase 1
- Task 10-11 (settings types/cards) can run in parallel with Task 12 (settings tool)
```

---

## Verification Checklist

After each phase, verify:

### Phase 1
- [ ] App renders with single-column chat at full width
- [ ] Cmd+K opens command palette
- [ ] Can search and navigate to any session
- [ ] Can create new session
- [ ] Back navigation works
- [ ] All existing keyboard shortcuts still work

### Phase 2
- [ ] Selecting a source in command palette opens context panel
- [ ] Context panel slides in smoothly from right
- [ ] Escape closes context panel
- [ ] Chat remains interactive while context panel is open
- [ ] Context panel shows source info correctly

### Phase 3
- [ ] "Switch to dark mode" in chat applies theme immediately with confirmation card
- [ ] "Change my default model" shows preview card with confirm/cancel
- [ ] Confirm applies the change, cancel dismisses
- [ ] "What settings are available?" lists all categories
- [ ] All 9 categories of settings are accessible via chat

### Phase 4
- [ ] App opens to HomeScreen when no session is active
- [ ] Recent sessions are shown and clickable
- [ ] Search prompt opens command palette
- [ ] Navigating to a session transitions to chat view
- [ ] Back from chat returns to home screen
