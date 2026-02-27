import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource, LoadedSkill } from '../../../shared/types'
import { getVisibleRootSessions, isVisibleRootSession } from '@/lib/session-visibility'

export const DEFAULT_MAX_RESULTS_PER_GROUP = 5

export interface WorkspaceOption {
  id: string
  name: string
}

export interface CommandPaletteModelInput {
  sessionMetaMap: Map<string, SessionMeta>
  sources: LoadedSource[]
  skills: LoadedSkill[]
  workspaces: WorkspaceOption[]
  activeWorkspaceId: string | null
  maxResultsPerGroup?: number
}

export interface CommandPaletteModel {
  sessions: SessionMeta[]
  sources: LoadedSource[]
  skills: LoadedSkill[]
  workspaces: WorkspaceOption[]
  hasAnyResults: boolean
}

function compareByName(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '')
}

export function buildCommandPaletteModel({
  sessionMetaMap,
  sources,
  skills,
  workspaces,
  maxResultsPerGroup = DEFAULT_MAX_RESULTS_PER_GROUP,
}: CommandPaletteModelInput): CommandPaletteModel {
  const sessions = getVisibleRootSessions(sessionMetaMap, maxResultsPerGroup)

  const visibleSources = sources
    .filter(source => !source.isBuiltin)
    .sort((a, b) => compareByName(a.config.name, b.config.name))
    .slice(0, maxResultsPerGroup)

  const visibleSkills = [...skills]
    .sort((a, b) => compareByName(a.metadata.name, b.metadata.name))
    .slice(0, maxResultsPerGroup)

  const visibleWorkspaces = [...workspaces]
    .sort((a, b) => compareByName(a.name, b.name))
    .slice(0, maxResultsPerGroup)

  return {
    sessions,
    sources: visibleSources,
    skills: visibleSkills,
    workspaces: visibleWorkspaces,
    hasAnyResults:
      sessions.length > 0 ||
      visibleSources.length > 0 ||
      visibleSkills.length > 0 ||
      visibleWorkspaces.length > 0,
  }
}

export function canSelectVisibleRootSession(
  sessionMetaMap: Map<string, SessionMeta>,
  sessionId: string,
): boolean {
  const session = sessionMetaMap.get(sessionId)
  return !!session && isVisibleRootSession(session)
}

export function canSelectWorkspace(workspaces: WorkspaceOption[], workspaceId: string): boolean {
  return workspaces.some(workspace => workspace.id === workspaceId)
}

export function getSettingPrompt(id: string): string {
  const settingMessages: Record<string, string> = {
    app: 'Show me my app settings',
    ai: 'Show me my AI configuration',
    appearance: 'Show me my appearance settings',
    workspace: 'Show me my workspace settings',
    permissions: 'Show me my permission settings',
    labels: 'Show me my label settings',
    input: 'Show me my input settings',
    preferences: 'Show me my preferences',
    shortcuts: 'Show me my keyboard shortcuts',
  }
  return settingMessages[id] || `Show me my ${id} settings`
}
