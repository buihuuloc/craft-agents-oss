# Universal Chat-Driven Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every setting changeable via chat with instant UI updates — no risky gates, no stale React state.

**Architecture:** Add a unified `craft-settings-changed` CustomEvent dispatched after every setting change. Expand interceptor patterns to cover all 27 settings. Remove the risky gate so all settings apply instantly. Create a `useSettingChanged` hook for reactive UI updates.

**Tech Stack:** TypeScript, React (hooks, context, custom events), Electron IPC

---

### Task 1: Add unified settings event helper

**Files:**
- Modify: `apps/electron/src/renderer/lib/settings-intent.ts`

**Step 1: Add `dispatchSettingsChanged` helper function**

Add after the `broadcastThemePreferences` function (after line 140):

```typescript
/**
 * Dispatch a unified settings-changed event for local React state sync.
 * Any component can listen via the `useSettingChanged` hook.
 */
export function dispatchSettingsChanged(key: string, value: unknown): void {
  window.dispatchEvent(new CustomEvent('craft-settings-changed', {
    detail: { key, value },
  }))
}
```

**Step 2: Remove `craft-theme-changed` dispatch from `broadcastThemePreferences`**

The `broadcastThemePreferences` function (line 130-140) currently dispatches `craft-theme-changed`. Remove that line — the unified event replaces it. The function should only do the IPC broadcast:

```typescript
async function broadcastThemePreferences(): Promise<void> {
  const t = loadStoredTheme()
  const prefs = {
    mode: t.mode ?? 'system',
    colorTheme: t.colorTheme ?? 'default',
    font: t.font ?? 'inter',
  }
  await window.electronAPI.broadcastThemePreferences?.(prefs)
}
```

**Step 3: Verify**

Run: `cd apps/electron && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (the function is exported but not yet imported anywhere)

---

### Task 2: Create `useSettingChanged` hook

**Files:**
- Create: `apps/electron/src/renderer/hooks/useSettingChanged.ts`

**Step 1: Create the hook file**

```typescript
import { useEffect } from 'react'

/**
 * Listen for setting changes dispatched by the interceptor or settings tool.
 * Filters by setting key(s) and calls the callback with the new value.
 *
 * @param keys - A single key or array of keys to listen for
 * @param callback - Called with (key, value) when a matching setting changes
 */
export function useSettingChanged(
  keys: string | string[],
  callback: (key: string, value: unknown) => void,
): void {
  useEffect(() => {
    const keySet = new Set(Array.isArray(keys) ? keys : [keys])

    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail
      if (keySet.has(key)) {
        callback(key, value)
      }
    }

    window.addEventListener('craft-settings-changed', handler)
    return () => window.removeEventListener('craft-settings-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof keys === 'string' ? keys : keys.join(',')])
}
```

**Step 2: Verify**

Run: `cd apps/electron && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 3: Update ThemeContext to use unified event

**Files:**
- Modify: `apps/electron/src/renderer/context/ThemeContext.tsx`

**Step 1: Replace `craft-theme-changed` listener with `craft-settings-changed`**

Replace the "Local settings-intent sync listener" block (lines 341-358) with:

```typescript
  // === Local settings-intent sync listener ===
  // The settings interceptor and settings tool dispatch 'craft-settings-changed'
  // after applying any setting. We listen for theme-related keys.
  useEffect(() => {
    const handler = (e: Event) => {
      const { key, value } = (e as CustomEvent).detail
      if (key === 'themeMode' || key === 'colorTheme' || key === 'font') {
        isExternalUpdate.current = true
        if (key === 'themeMode') setModeState(value as ThemeMode)
        else if (key === 'colorTheme') setColorThemeState(value as string)
        else if (key === 'font') setFontState(value as FontFamily)
        setTimeout(() => {
          isExternalUpdate.current = false
        }, 0)
      }
    }

    window.addEventListener('craft-settings-changed', handler)
    return () => window.removeEventListener('craft-settings-changed', handler)
  }, [])
```

**Step 2: Verify**

Run: `cd apps/electron && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 4: Remove risky gate from interceptor and settings-tool

**Files:**
- Modify: `apps/electron/src/renderer/lib/settings-interceptor.ts`
- Modify: `apps/electron/src/renderer/lib/settings-tool.ts`

**Step 1: Remove risky check from interceptor (line 113-115)**

Remove these lines:
```typescript
      // Never intercept risky settings — the agent handles those with a
      // preview/confirmation flow.
      if (setting.risky) continue
```

**Step 2: Add unified event dispatch after successful setValue in interceptor**

After `await setting.setValue(newValue)` (line 121), add:

```typescript
        const { dispatchSettingsChanged } = await import('./settings-intent')
        dispatchSettingsChanged(settingKey, newValue)
```

**Step 3: Increase message length limit from 80 to 200 chars**

Change line 103 from `trimmed.length > 80` to `trimmed.length > 200`. Longer settings (working directory paths, model names) need more room.

**Step 4: Update file header comment**

Replace lines 11-12 comment about risky settings:
```typescript
 * All settings are intercepted for instant application, regardless of risk
 * classification. This provides the fastest possible settings UX.
```

**Step 5: Remove risky gate from settings-tool (lines 102-117)**

In `settings-tool.ts`, the `set` action currently returns `requiresConfirmation: true` for risky settings without applying. Remove that check and apply all settings directly. Replace lines 100-129 with:

```typescript
        const currentValue = await setting.getValue()
        await setting.setValue(call.value)

        // Dispatch unified settings event for local UI sync
        const { dispatchSettingsChanged } = await import('./settings-intent')
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
```

**Step 6: Verify**

Run: `cd apps/electron && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 5: Add interceptor patterns for all missing settings

**Files:**
- Modify: `apps/electron/src/renderer/lib/settings-interceptor.ts`

**Step 1: Add patterns for `sendMessageKey`**

```typescript
  // ── Send message key ────────────────────────────────────────────────────
  { pattern: /(?:use|set|change)\s+(?:the\s+)?send\s+(?:message\s+)?key\s+(?:to\s+)?(enter|cmd[+-]enter)/i, settingKey: 'sendMessageKey', extractValue: (m) => m[1].toLowerCase().replace('+', '-') },
  { pattern: /send\s+(?:messages?\s+)?with\s+(enter|cmd[+-]enter)/i, settingKey: 'sendMessageKey', extractValue: (m) => m[1].toLowerCase().replace('+', '-') },
```

**Step 2: Add patterns for `colorTheme`**

```typescript
  // ── Color theme ─────────────────────────────────────────────────────────
  { pattern: /(?:use|set|change|switch)\s+(?:the\s+)?(?:color\s+)?theme\s+(?:to\s+)?([\w-]+)/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },
  { pattern: /(?:apply|activate)\s+(?:the\s+)?([\w-]+)\s+theme/i, settingKey: 'colorTheme', extractValue: (m) => m[1].toLowerCase() },
```

Note: These must be placed AFTER the themeMode patterns to avoid conflicts. The themeMode patterns match `light/dark/system` specifically, while these catch other theme names.

**Step 3: Add patterns for `workspaceColorTheme`**

```typescript
  // ── Workspace color theme ───────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:color\s+)?theme\s+(?:to\s+)?([\w-]+)/i, settingKey: 'workspaceColorTheme', extractValue: (m) => m[1].toLowerCase() },
```

**Step 4: Add patterns for preferences**

```typescript
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
  { pattern: /(?:i'?m|i\s+am)\s+(?:located\s+)?in\s+(.+?)(?:\s*,\s*(.+))?$/i, settingKey: 'city', extractValue: (m) => m[1].trim() },

  // ── Country ────────────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?country\s+(?:to\s+)(.+)/i, settingKey: 'country', extractValue: (m) => m[1].trim() },

  // ── Preference notes ──────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:my\s+)?(?:preference\s+)?notes?\s+(?:to\s+)(.+)/i, settingKey: 'notes', extractValue: (m) => m[1].trim() },
  { pattern: /(?:remember|note)\s+(?:that\s+)?(.+)/i, settingKey: 'notes', extractValue: (m) => m[1].trim() },
```

**Step 5: Add patterns for AI settings (previously risky)**

```typescript
  // ── Default model ──────────────────────────────────────────────────────
  { pattern: /(?:use|set|change|switch)\s+(?:the\s+)?(?:default\s+)?model\s+(?:to\s+)(.+)/i, settingKey: 'defaultModel', extractValue: (m) => m[1].trim() },
  { pattern: /(?:switch|change)\s+(?:to\s+)?(?:the\s+)?(.+?)\s+model/i, settingKey: 'defaultModel', extractValue: (m) => m[1].trim() },

  // ── Default LLM connection ─────────────────────────────────────────────
  { pattern: /(?:use|set|switch)\s+(?:the\s+)?(?:default\s+)?(?:llm\s+)?connection\s+(?:to\s+)(.+)/i, settingKey: 'defaultLlmConnection', extractValue: (m) => m[1].trim() },

  // ── Workspace model ────────────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:default\s+)?model\s+(?:to\s+)(.+)/i, settingKey: 'workspaceModel', extractValue: (m) => m[1].trim() },

  // ── Workspace connection ───────────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?workspace\s+(?:default\s+)?connection\s+(?:to\s+)(.+)/i, settingKey: 'workspaceDefaultLlmConnection', extractValue: (m) => m[1].trim() },

  // ── Workspace thinking level ───────────────────────────────────────────
  { pattern: /(?:set|change)\s+(?:the\s+)?(?:workspace\s+)?thinking\s+(?:level\s+)?(?:to\s+)?(off|think|max|no\s*thinking|max\s*thinking)/i, settingKey: 'workspaceThinkingLevel', extractValue: (m) => {
    const v = m[1].toLowerCase().replace(/\s+/g, '')
    if (v === 'nothinking') return 'off'
    if (v === 'maxthinking') return 'max'
    return v
  }},
  { pattern: /(?:enable|turn\s+on)\s+(?:max\s+)?thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'think' },
  { pattern: /(?:enable|turn\s+on)\s+max\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'max' },
  { pattern: /(?:disable|turn\s+off)\s+thinking/i, settingKey: 'workspaceThinkingLevel', extractValue: () => 'off' },
```

**Step 6: Add patterns for workspace/permissions settings (previously risky)**

```typescript
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
```

**Step 7: Verify**

Run: `cd apps/electron && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

---

### Task 6: Commit

**Step 1: Commit all changes**

```bash
git add apps/electron/src/renderer/lib/settings-intent.ts \
       apps/electron/src/renderer/lib/settings-interceptor.ts \
       apps/electron/src/renderer/lib/settings-tool.ts \
       apps/electron/src/renderer/context/ThemeContext.tsx \
       apps/electron/src/renderer/hooks/useSettingChanged.ts
git commit -m "feat: universal chat-driven settings with instant UI updates"
```
