/**
 * Artifact types for the contextual right panel.
 *
 * Each variant represents a different kind of content that can be
 * displayed in the artifact panel alongside the chat.
 */
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
