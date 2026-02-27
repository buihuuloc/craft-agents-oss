import { describe, it, expect } from 'bun:test'
import type { SessionMeta } from '@/atoms/sessions'
import { getVisibleRootSessions } from '@/lib/session-visibility'

function makeSession(id: string, overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id,
    workspaceId: 'ws-1',
    ...overrides,
  }
}

describe('getVisibleRootSessions', () => {
  it('filters hidden, archived, and child sessions', () => {
    const sessions = new Map<string, SessionMeta>([
      ['a', makeSession('a', { hidden: true, lastMessageAt: 300 })],
      ['b', makeSession('b', { isArchived: true, lastMessageAt: 200 })],
      ['c', makeSession('c', { parentSessionId: 'root', lastMessageAt: 100 })],
      ['d', makeSession('d', { lastMessageAt: 400 })],
      ['e', makeSession('e', { lastMessageAt: 500 })],
    ])

    const result = getVisibleRootSessions(sessions)
    expect(result.map(s => s.id)).toEqual(['e', 'd'])
  })

  it('sorts by lastMessageAt desc with deterministic id tie-breaker', () => {
    const sessions = new Map<string, SessionMeta>([
      ['b', makeSession('b', { lastMessageAt: 100 })],
      ['a', makeSession('a', { lastMessageAt: 100 })],
      ['c', makeSession('c', { lastMessageAt: 200 })],
    ])

    const result = getVisibleRootSessions(sessions)
    expect(result.map(s => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('applies result limit', () => {
    const sessions = new Map<string, SessionMeta>([
      ['a', makeSession('a', { lastMessageAt: 100 })],
      ['b', makeSession('b', { lastMessageAt: 200 })],
      ['c', makeSession('c', { lastMessageAt: 300 })],
    ])

    const result = getVisibleRootSessions(sessions, 2)
    expect(result.map(s => s.id)).toEqual(['c', 'b'])
  })
})
