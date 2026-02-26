import { isToday, isYesterday, format, startOfDay } from "date-fns"
import { parseLabelEntry } from "@craft-agent/shared/labels"
import type { SessionMeta } from "@/atoms/sessions"
import type { ViewConfig } from "@craft-agent/shared/views"
import type { SessionFilter } from "@/contexts/NavigationContext"
import type { SessionStatusId } from "@/config/session-status-config"

// Pagination constants
export const INITIAL_DISPLAY_LIMIT = 20
export const BATCH_SIZE = 20
export const MAX_SEARCH_RESULTS = 100


/**
 * Format a date for the date header
 * Returns "Today", "Yesterday", or formatted date like "Dec 19"
 */
export function formatDateHeader(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d")
}

/**
 * Group sessions by date (day boundary)
 * Returns array of { date, sessions } sorted by date descending
 */
export function groupSessionsByDate(sessions: SessionMeta[]): Array<{ date: Date; label: string; sessions: SessionMeta[] }> {
  const groups = new Map<string, { date: Date; sessions: SessionMeta[] }>()

  for (const session of sessions) {
    const timestamp = session.lastMessageAt || 0
    const date = startOfDay(new Date(timestamp))
    const key = date.toISOString()

    if (!groups.has(key)) {
      groups.set(key, { date, sessions: [] })
    }
    groups.get(key)!.sessions.push(session)
  }

  // Sort groups by date descending and add labels
  return Array.from(groups.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(group => ({
      ...group,
      label: formatDateHeader(group.date),
    }))
}

/**
 * Get the current session status of a session
 * States are user-controlled, never automatic
 */
export function getSessionSessionStatus(session: SessionMeta): SessionStatusId {
  // Read from session.sessionStatus (user-controlled)
  // Falls back to 'todo' if not set
  return (session.sessionStatus as SessionStatusId) || 'todo'
}

/**
 * Check if a session has unread messages.
 * Uses the explicit hasUnread flag (state machine approach) as single source of truth.
 * This avoids race conditions from comparing two independently-updated IDs.
 */
export function hasUnreadMessages(session: SessionMeta): boolean {
  return session.hasUnread === true
}

/**
 * Check if session has any messages (uses lastFinalMessageId as proxy)
 */
export function hasMessages(session: SessionMeta): boolean {
  return session.lastFinalMessageId !== undefined
}

/** Options for sessionMatchesCurrentFilter including secondary filters */
export interface FilterMatchOptions {
  evaluateViews?: (meta: SessionMeta) => ViewConfig[]
  /** Secondary status filter (status chips) */
  statusFilter?: Map<string, 'include' | 'exclude'>
  /** Secondary label filter (label chips) */
  labelFilterMap?: Map<string, 'include' | 'exclude'>
}

/**
 * Check if a session matches the current navigation filter AND secondary filters.
 * Used to split search results into "Matching Current Filters" vs "All Results".
 *
 * Filter layers:
 * 1. Primary filter (sessionFilter) - "All Sessions", "Flagged", specific state/label/view
 * 2. Secondary filters (statusFilter, labelFilterMap) - user-applied chips on top
 *
 * A session must pass BOTH layers to be considered "matching".
 */
export function sessionMatchesCurrentFilter(
  session: SessionMeta,
  currentFilter: SessionFilter | undefined,
  options: FilterMatchOptions = {}
): boolean {
  const { evaluateViews, statusFilter, labelFilterMap } = options

  // Helper: Check if session passes secondary status filter
  const passesStatusFilter = (): boolean => {
    if (!statusFilter || statusFilter.size === 0) return true
    const sessionState = (session.sessionStatus || 'todo') as string

    let hasIncludes = false
    let matchesInclude = false
    for (const [stateId, mode] of statusFilter) {
      if (mode === 'exclude' && sessionState === stateId) return false
      if (mode === 'include') {
        hasIncludes = true
        if (sessionState === stateId) matchesInclude = true
      }
    }
    return !hasIncludes || matchesInclude
  }

  // Helper: Check if session passes secondary label filter
  const passesLabelFilter = (): boolean => {
    if (!labelFilterMap || labelFilterMap.size === 0) return true
    const sessionLabelIds = session.labels?.map(l => parseLabelEntry(l).id) || []

    let hasIncludes = false
    let matchesInclude = false
    for (const [labelId, mode] of labelFilterMap) {
      if (mode === 'exclude' && sessionLabelIds.includes(labelId)) return false
      if (mode === 'include') {
        hasIncludes = true
        if (sessionLabelIds.includes(labelId)) matchesInclude = true
      }
    }
    return !hasIncludes || matchesInclude
  }

  // Must pass BOTH secondary filters first
  if (!passesStatusFilter() || !passesLabelFilter()) return false

  // Then check primary filter
  if (!currentFilter) return true

  switch (currentFilter.kind) {
    case 'allSessions':
      // Exclude archived sessions from All Sessions
      return session.isArchived !== true

    case 'flagged':
      // Exclude archived sessions from Flagged view
      return session.isFlagged === true && session.isArchived !== true

    case 'archived':
      // Only show archived sessions in Archived view
      return session.isArchived === true

    case 'state':
      // Default to 'todo' for sessions without explicit sessionStatus (matches getSessionSessionStatus logic)
      // Exclude archived sessions from state views
      return (session.sessionStatus || 'todo') === currentFilter.stateId && session.isArchived !== true

    case 'label': {
      if (!session.labels?.length) return false
      // Exclude archived sessions from label views
      if (session.isArchived === true) return false
      if (currentFilter.labelId === '__all__') return true
      const labelIds = session.labels.map(l => parseLabelEntry(l).id)
      return labelIds.includes(currentFilter.labelId)
    }

    case 'view':
      // Exclude archived sessions from view filters
      if (session.isArchived === true) return false
      if (!evaluateViews) return true
      const matched = evaluateViews(session)
      if (currentFilter.viewId === '__all__') return matched.length > 0
      return matched.some(v => v.id === currentFilter.viewId)

    default:
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = currentFilter
      return true
  }
}

/**
 * Highlight matching text in a string
 * Returns React nodes with matched portions wrapped in a highlight span
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return text

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <>
      {before}
      <span className="bg-yellow-300/30 rounded-[2px]">{match}</span>
      {highlightMatch(after, query)}
    </>
  )
}
