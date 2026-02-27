import type { SessionMeta } from '@/atoms/sessions'

export function isVisibleRootSession(session: SessionMeta): boolean {
  return !session.hidden && !session.isArchived && !session.parentSessionId
}

function compareSessions(a: SessionMeta, b: SessionMeta): number {
  const aTs = a.lastMessageAt ?? 0
  const bTs = b.lastMessageAt ?? 0
  if (aTs !== bTs) return bTs - aTs
  return a.id.localeCompare(b.id)
}

export function getVisibleRootSessions(
  sessions: Map<string, SessionMeta> | Iterable<SessionMeta>,
  limit?: number,
): SessionMeta[] {
  const values = sessions instanceof Map ? sessions.values() : sessions
  const visible = Array.from(values).filter(isVisibleRootSession).sort(compareSessions)
  if (typeof limit === 'number') return visible.slice(0, Math.max(0, limit))
  return visible
}
