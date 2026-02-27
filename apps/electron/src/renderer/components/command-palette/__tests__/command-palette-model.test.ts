import { describe, it, expect } from 'bun:test'
import type { SessionMeta } from '@/atoms/sessions'
import type { LoadedSource, LoadedSkill } from '../../../../shared/types'
import {
  buildCommandPaletteModel,
  getSettingPrompt,
  canSelectVisibleRootSession,
} from '../command-palette-model'

function session(id: string, overrides: Partial<SessionMeta> = {}): SessionMeta {
  return { id, workspaceId: 'ws-1', ...overrides }
}

function source(name: string, slug: string, type = 'mcp'): LoadedSource {
  return {
    config: { id: slug, name, slug, type, auth: { type: 'none' }, enabled: true },
    status: 'ready',
  } as unknown as LoadedSource
}

function skill(name: string, slug: string): LoadedSkill {
  return {
    slug,
    metadata: { name, description: '' },
    content: '',
  } as LoadedSkill
}

describe('command-palette-model', () => {
  it('builds deterministic grouped results with limits', () => {
    const sessionMetaMap = new Map<string, SessionMeta>([
      ['s2', session('s2', { lastMessageAt: 10, name: 'Two' })],
      ['s1', session('s1', { lastMessageAt: 20, name: 'One' })],
      ['hidden', session('hidden', { hidden: true, lastMessageAt: 99 })],
    ])

    const model = buildCommandPaletteModel({
      sessionMetaMap,
      sources: [source('Zulu', 'zulu'), source('Alpha', 'alpha')],
      skills: [skill('Zeta', 'zeta'), skill('Beta', 'beta')],
      workspaces: [
        { id: 'w2', name: 'Zulu' },
        { id: 'w1', name: 'Alpha' },
      ],
      activeWorkspaceId: 'w1',
      maxResultsPerGroup: 1,
    })

    expect(model.sessions.map(s => s.id)).toEqual(['s1'])
    expect(model.sources.map(s => s.config.slug)).toEqual(['alpha'])
    expect(model.skills.map(s => s.slug)).toEqual(['beta'])
    expect(model.workspaces.map(w => w.id)).toEqual(['w1'])
  })

  it('returns known setting prompt with fallback', () => {
    expect(getSettingPrompt('appearance')).toBe('Show me my appearance settings')
    expect(getSettingPrompt('custom')).toBe('Show me my custom settings')
  })

  it('guards selection to visible root sessions only', () => {
    const sessions = new Map<string, SessionMeta>([
      ['ok', session('ok')],
      ['archived', session('archived', { isArchived: true })],
      ['hidden', session('hidden', { hidden: true })],
      ['child', session('child', { parentSessionId: 'ok' })],
    ])

    expect(canSelectVisibleRootSession(sessions, 'ok')).toBe(true)
    expect(canSelectVisibleRootSession(sessions, 'archived')).toBe(false)
    expect(canSelectVisibleRootSession(sessions, 'hidden')).toBe(false)
    expect(canSelectVisibleRootSession(sessions, 'child')).toBe(false)
    expect(canSelectVisibleRootSession(sessions, 'missing')).toBe(false)
  })
})
