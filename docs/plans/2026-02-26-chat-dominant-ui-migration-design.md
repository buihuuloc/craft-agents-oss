# Chat-Dominant 2-Column UI Migration

## Problem

The current 3-4 panel layout (LeftSidebar | NavigatorPanel | MainContentPanel | RightSidebar) with 9 separate settings pages is over-chromed for an AI-first app. Users should type to configure, not click through forms.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Chat-dominant, contextual second column | Clean by default, split only when meaningful |
| Navigation | Cmd+K command palette, no sidebar | "Type to do everything" philosophy |
| Settings | Hybrid apply (instant safe, preview risky) | Speed for trivial, safety for consequential |
| Right column | Settings + live artifacts | Purposeful, not a generic canvas |
| Command palette | Flat unified search | Simple, searches everything at once |
| Migration | Progressive simplification | Each step shippable independently |

## Layout Architecture

### State 1: Home Screen (no active session)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Craft Agents                           │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │  What would you like to do?            Cmd+K │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│         Recent: Session A · Session B · ...         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Search-prompt centered like Google
- Recent sessions as subtle inline hints
- Sets the tone: you talk to this app

### State 2: Active Session (single column — default)

```
┌─────────────────────────────────────────────────────┐
│   ← Back                             Cmd+K  ···    │
│                                                     │
│   Conversation flows here                           │
│   Agent responses, user messages                    │
│                                                     │
│   ┌──────────────────────────────────────────┐      │
│   │  ◉ Dark mode applied                    │      │  ← inline artifact
│   │  Theme updated successfully              │      │
│   └──────────────────────────────────────────┘      │
│                                                     │
│   ┌──────────────────────────────────────────┐      │
│   │  ⚠ Change LLM to GPT-4o?               │      │  ← risky change preview
│   │  Current: Claude Opus → New: GPT-4o     │      │
│   │  [Confirm]  [Cancel]                    │      │
│   └──────────────────────────────────────────┘      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Type a message...                             ↑    │
└─────────────────────────────────────────────────────┘
```

- Chat takes 100% width
- Safe settings changes appear as inline artifact cards in the conversation
- Risky changes show inline preview with confirm/cancel
- Minimal header: back, Cmd+K trigger, overflow menu
- Header fades on scroll down, reappears on scroll up

### State 3: Active Session with Artifact (two columns)

```
┌─────────────────────────────────────────────────────┐
│   ← Back                             Cmd+K  ···    │
│                                                     │
│   Conversation        │  Live Artifact              │
│                       │                             │
│   "Set up Linear      │  ┌───────────────────┐     │
│    as a source"       │  │ Linear            │     │
│                       │  │ ✓ Connected       │     │
│   "Got it. I've       │  │ 47 tools          │     │
│    connected..."      │  │ [Disconnect]      │     │
│                       │  └───────────────────┘     │
│                       │                             │
├───────────────────────┴─────────────────────────────┤
│  Type a message...                             ↑    │
└─────────────────────────────────────────────────────┘
```

- Second column slides in (animated) only for rich/complex artifacts
- Source dashboards, skill documentation, multi-field configs
- Dismissible with Esc
- Chat input remains full-width below both columns

## Command Palette (Cmd+K)

Flat unified search replacing all sidebar navigation.

**Searches across:**
- Sessions (by name, content preview)
- Sources (by name, type)
- Skills (by name)
- Settings (by setting name/description)
- Actions (new session, toggle theme, etc.)

**Behavior:**
- Opens as centered modal overlay
- Results ranked by relevance with type icons
- Enter to select, Esc to dismiss
- No prefix scoping — just type and find

## Settings via Chat

### Safe Changes (instant apply + inline confirmation)

These apply immediately when the user types them:
- Theme / dark mode / light mode
- Accent color
- User name, timezone, language
- Input behavior preferences
- Keyboard shortcuts
- Session rename, archive, flag

Agent responds with an inline artifact card confirming the change.

### Risky Changes (preview + confirm)

These show a preview card requiring explicit confirmation:
- Change LLM provider or default model
- Change workspace permission mode
- Delete workspace / session
- Modify source connections
- Change credential / API key
- Tool allow/deny list modifications

Agent responds with a diff-style preview card with [Confirm] and [Cancel] buttons.

### Settings Discovery

Users can ask:
- "What settings are available?" → agent lists categories
- "Show my current theme" → agent shows current config as artifact
- "What can I change about permissions?" → agent explains options

## Artifact Types for Context Panel

| Artifact | When it appears | Column behavior |
|----------|----------------|-----------------|
| Settings confirmation | Safe setting changed | Inline in chat (single column) |
| Settings preview/diff | Risky setting change | Inline in chat (single column) |
| Source dashboard | Source connected/inspected | Second column slides in |
| Skill detail view | Skill explored/configured | Second column slides in |
| Session metadata | Session inspected | Second column slides in |
| Multi-field config | Complex setup (e.g., new workspace) | Second column slides in |

## Migration Strategy: Progressive Simplification

### Phase 1: Command Palette + Minimal Chrome

**Remove:** LeftSidebar, NavigatorPanel, SettingsNavigator, SessionList (as panel)
**Add:** CommandPalette component, MinimalTopBar
**Modify:** AppShell → simplified 1-column layout
**Keep:** All chat components, MainContentPanel (repurposed as ChatPanel)

Deliverable: Users navigate entirely via Cmd+K. Chat takes full width.

### Phase 2: Contextual Second Column

**Add:** ContextPanel, ArtifactRenderer, slide-in animation system
**Modify:** ChatPanel to support split layout when artifact present
**Add:** Artifact types: SourceCard, SkillDetailCard, SessionMetaCard

Deliverable: Rich outputs display in a contextual second column.

### Phase 3: Chat-Driven Settings

**Add:** Settings intent detection in chat, SettingsPreviewCard, SettingsConfirmationCard
**Add:** Inline artifact rendering in chat stream for settings changes
**Modify:** IPC handlers to support chat-triggered setting mutations
**Remove:** All 9 settings pages (AppSettings, AiSettings, WorkspaceSettings, etc.)
**Remove:** All settings form components (SettingsToggle, SettingsMenuSelect, etc.)

Deliverable: All settings configurable via conversation. No settings pages.

### Phase 4: Home Screen

**Add:** HomeScreen component with centered search prompt
**Add:** Recent sessions inline display
**Modify:** App entry point to show HomeScreen when no session active

Deliverable: Google-like home screen as the app landing.

## Components to Create

| Component | Purpose |
|-----------|---------|
| `HomeScreen` | Centered search prompt + recent sessions |
| `MinimalTopBar` | Back, Cmd+K, overflow — fades on scroll |
| `CommandPalette` | Flat unified search overlay |
| `ChatPanel` | Full-width chat, supports split mode |
| `ContextPanel` | Slide-in artifact display |
| `ArtifactRenderer` | Routes artifact type to correct card |
| `SettingsConfirmationCard` | Inline card for safe setting changes |
| `SettingsPreviewCard` | Diff-style card for risky changes |
| `SourceCard` | Source connection dashboard |
| `SkillDetailCard` | Skill info + config |
| `SessionMetaCard` | Session metadata view |

## Components to Remove

| Component | Replaced by |
|-----------|-------------|
| `LeftSidebar` | CommandPalette |
| `NavigatorPanel` | CommandPalette |
| `SettingsNavigator` | Chat + CommandPalette |
| `SessionList` (panel) | CommandPalette search |
| `SourcesListPanel` | CommandPalette + ContextPanel |
| `SkillsListPanel` | CommandPalette + ContextPanel |
| All 9 settings pages | Chat-driven settings |
| `SettingsSection/Card/Row/Toggle/MenuSelect/RadioGroup/SegmentedControl/Input/Textarea` | SettingsPreviewCard + SettingsConfirmationCard |

## Success Criteria

1. Zero persistent navigation chrome — only chat and minimal top bar visible
2. All settings changeable via natural language in chat
3. Cmd+K reaches any session, source, skill, or setting within 2 keystrokes
4. Second column appears only when content genuinely needs space
5. Each migration phase is independently shippable
6. No regression in functionality — everything accessible, just via different UX
