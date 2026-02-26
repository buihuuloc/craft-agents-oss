import { useMemo, useCallback } from "react"
import * as React from "react"
import { type SessionStatusId } from "@/config/session-status-config"
import { getDescendantIds, extractLabelId, flattenLabels, findLabelById } from "@craft-agent/shared/labels"
import type { LabelConfig } from "@craft-agent/shared/labels"
import { filterItems as filterLabelMenuItems, filterSessionStatuses as filterLabelMenuStates, type LabelMenuItem } from "@/components/ui/label-menu"
import type { SessionStatus } from "@/config/session-status-config"
import type { SessionMeta } from "@/atoms/sessions"
import type { SessionFilter } from "@/contexts/NavigationContext"
import * as storage from "@/lib/local-storage"
import type { FilterMode } from "./FilterComponents"

/** Per-view filter entry: maps id to filter mode */
type FilterEntry = Record<string, FilterMode>

/** Map from view key to its status and label filters */
export type ViewFiltersMap = Record<string, { statuses: FilterEntry, labels: FilterEntry }>

interface UseSessionFilteringParams {
  sessionFilter: SessionFilter | null
  workspaceSessionMetas: SessionMeta[]
  activeSessionMetas: SessionMeta[]
  labelConfigs: LabelConfig[]
  effectiveSessionStatuses: SessionStatus[]
  flatLabelMenuItems: LabelMenuItem[]
  evaluateViews: (session: SessionMeta) => any[]
  activeWorkspaceId: string | null | undefined
}

interface UseSessionFilteringResult {
  /** Per-view filter map (raw state) */
  viewFiltersMap: ViewFiltersMap
  setViewFiltersMap: React.Dispatch<React.SetStateAction<ViewFiltersMap>>
  /** Current view's status filter */
  listFilter: Map<SessionStatusId, FilterMode>
  setListFilter: (updater: Map<SessionStatusId, FilterMode> | ((prev: Map<SessionStatusId, FilterMode>) => Map<SessionStatusId, FilterMode>)) => void
  /** Current view's label filter */
  labelFilter: Map<string, FilterMode>
  setLabelFilter: (updater: Map<string, FilterMode> | ((prev: Map<string, FilterMode>) => Map<string, FilterMode>)) => void
  /** Stable key for the current session filter view */
  sessionFilterKey: string | null
  /** Filtered session metadata */
  filteredSessionMetas: SessionMeta[]
  /** Non-removable filters derived from the current route */
  pinnedFilters: { pinnedStatusId: string | null, pinnedLabelId: string | null, pinnedFlagged: boolean }
  /** Filter dropdown search results */
  filterDropdownResults: { states: SessionStatus[], labels: LabelMenuItem[] }
  /** Filter dropdown search query */
  filterDropdownQuery: string
  setFilterDropdownQuery: React.Dispatch<React.SetStateAction<string>>
  /** Filter dropdown keyboard navigation index */
  filterDropdownSelectedIdx: number
  setFilterDropdownSelectedIdx: React.Dispatch<React.SetStateAction<number>>
  /** Ref for the filter dropdown list (for scroll-into-view) */
  filterDropdownListRef: React.RefObject<HTMLDivElement>
  /** Ref for the filter dropdown input */
  filterDropdownInputRef: React.RefObject<HTMLInputElement>
}

export function useSessionFiltering({
  sessionFilter,
  workspaceSessionMetas,
  activeSessionMetas,
  labelConfigs,
  effectiveSessionStatuses,
  flatLabelMenuItems,
  evaluateViews,
  activeWorkspaceId,
}: UseSessionFilteringParams): UseSessionFilteringResult {
  // Compute a stable key for the current chat filter view
  const sessionFilterKey = useMemo(() => {
    if (!sessionFilter) return null
    switch (sessionFilter.kind) {
      case 'allSessions': return 'allSessions'
      case 'flagged': return 'flagged'
      case 'archived': return 'archived'
      case 'state': return `state:${sessionFilter.stateId}`
      case 'label': return `label:${sessionFilter.labelId}`
      case 'view': return `view:${sessionFilter.viewId}`
      default: return 'allSessions'
    }
  }, [sessionFilter])

  const [viewFiltersMap, setViewFiltersMap] = React.useState<ViewFiltersMap>(() => {
    const saved = storage.get<ViewFiltersMap>(storage.KEYS.viewFilters, {})
    // Backward compat: migrate old format (arrays) into new format (Record<string, FilterMode>)
    if (saved.allSessions && Array.isArray((saved.allSessions as any).statuses)) {
      // Old format: { statuses: string[], labels: string[] } -> new: { statuses: Record, labels: Record }
      for (const key of Object.keys(saved)) {
        const entry = saved[key] as any
        if (Array.isArray(entry.statuses)) {
          const newStatuses: FilterEntry = {}
          for (const id of entry.statuses) newStatuses[id] = 'include'
          const newLabels: FilterEntry = {}
          for (const id of entry.labels) newLabels[id] = 'include'
          saved[key] = { statuses: newStatuses, labels: newLabels }
        }
      }
    }
    // Also migrate legacy global filters if no allSessions entry exists
    if (!saved.allSessions) {
      const oldStatuses = storage.get<SessionStatusId[]>(storage.KEYS.listFilter, [])
      const oldLabels = storage.get<string[]>(storage.KEYS.labelFilter, [])
      if (oldStatuses.length > 0 || oldLabels.length > 0) {
        const statuses: FilterEntry = {}
        for (const id of oldStatuses) statuses[id] = 'include'
        const labels: FilterEntry = {}
        for (const id of oldLabels) labels[id] = 'include'
        saved.allSessions = { statuses, labels }
      }
    }
    return saved
  })

  // Derive current view's status filter as a Map<SessionStatusId, FilterMode>
  const listFilter = useMemo(() => {
    if (!sessionFilterKey) return new Map<SessionStatusId, FilterMode>()
    const entry = viewFiltersMap[sessionFilterKey]?.statuses ?? {}
    return new Map<SessionStatusId, FilterMode>(Object.entries(entry) as [SessionStatusId, FilterMode][])
  }, [viewFiltersMap, sessionFilterKey])

  // Derive current view's label filter as a Map<string, FilterMode>
  const labelFilter = useMemo(() => {
    if (!sessionFilterKey) return new Map<string, FilterMode>()
    const entry = viewFiltersMap[sessionFilterKey]?.labels ?? {}
    return new Map<string, FilterMode>(Object.entries(entry) as [string, FilterMode][])
  }, [viewFiltersMap, sessionFilterKey])

  // Setter for status filter -- updates only the current view's entry in the map
  const setListFilter = useCallback((updater: Map<SessionStatusId, FilterMode> | ((prev: Map<SessionStatusId, FilterMode>) => Map<SessionStatusId, FilterMode>)) => {
    setViewFiltersMap(prev => {
      if (!sessionFilterKey) return prev
      const current = new Map<SessionStatusId, FilterMode>(Object.entries(prev[sessionFilterKey]?.statuses ?? {}) as [SessionStatusId, FilterMode][])
      const next = typeof updater === 'function' ? updater(current) : updater
      return {
        ...prev,
        [sessionFilterKey]: { statuses: Object.fromEntries(next), labels: prev[sessionFilterKey]?.labels ?? {} }
      }
    })
  }, [sessionFilterKey])

  // Setter for label filter -- updates only the current view's entry in the map
  const setLabelFilter = useCallback((updater: Map<string, FilterMode> | ((prev: Map<string, FilterMode>) => Map<string, FilterMode>)) => {
    setViewFiltersMap(prev => {
      if (!sessionFilterKey) return prev
      const current = new Map<string, FilterMode>(Object.entries(prev[sessionFilterKey]?.labels ?? {}) as [string, FilterMode][])
      const next = typeof updater === 'function' ? updater(current) : updater
      return {
        ...prev,
        [sessionFilterKey]: { statuses: prev[sessionFilterKey]?.statuses ?? {}, labels: Object.fromEntries(next) }
      }
    })
  }, [sessionFilterKey])

  // Filter dropdown: inline search query for filtering statuses/labels in a flat list.
  const [filterDropdownQuery, setFilterDropdownQuery] = React.useState('')

  // Filter dropdown keyboard navigation: tracks highlighted item index in flat search mode.
  const [filterDropdownSelectedIdx, setFilterDropdownSelectedIdx] = React.useState(0)
  const filterDropdownListRef = React.useRef<HTMLDivElement>(null)
  const filterDropdownInputRef = React.useRef<HTMLInputElement>(null)

  // Compute filtered results for the dropdown's search mode
  const filterDropdownResults = useMemo(() => {
    if (!filterDropdownQuery.trim()) return { states: [] as SessionStatus[], labels: [] as LabelMenuItem[] }
    return {
      states: filterLabelMenuStates(effectiveSessionStatuses, filterDropdownQuery),
      labels: filterLabelMenuItems(flatLabelMenuItems, filterDropdownQuery),
    }
  }, [filterDropdownQuery, effectiveSessionStatuses, flatLabelMenuItems])

  // Reset selected index when query changes
  React.useEffect(() => {
    setFilterDropdownSelectedIdx(0)
  }, [filterDropdownQuery])

  // Scroll keyboard-highlighted item into view
  React.useEffect(() => {
    if (!filterDropdownListRef.current) return
    const el = filterDropdownListRef.current.querySelector('[data-filter-selected="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [filterDropdownSelectedIdx])

  // Filter session metadata based on sidebar mode and chat filter
  const filteredSessionMetas = useMemo(() => {
    // When in sources mode, return empty (no sessions to show)
    if (!sessionFilter) {
      return []
    }

    let result: SessionMeta[]

    switch (sessionFilter.kind) {
      case 'allSessions':
        // "All Sessions" - shows active (non-archived) sessions
        result = activeSessionMetas
        break
      case 'flagged':
        result = activeSessionMetas.filter(s => s.isFlagged)
        break
      case 'archived':
        // Archived view shows only archived sessions
        result = workspaceSessionMetas.filter(s => s.isArchived)
        break
      case 'state':
        // Filter by specific todo state (excludes archived)
        result = activeSessionMetas.filter(s => (s.sessionStatus || 'todo') === sessionFilter.stateId)
        break
      case 'label': {
        if (sessionFilter.labelId === '__all__') {
          // "Labels" header: show all active sessions that have at least one label
          result = activeSessionMetas.filter(s => s.labels && s.labels.length > 0)
        } else {
          // Specific label: includes sessions tagged with this label or any descendant
          const descendants = getDescendantIds(labelConfigs, sessionFilter.labelId)
          const matchIds = new Set([sessionFilter.labelId, ...descendants])
          result = activeSessionMetas.filter(
            s => s.labels?.some(l => matchIds.has(extractLabelId(l)))
          )
        }
        break
      }
      case 'view': {
        // Filter by view: __all__ shows any session matched by any view,
        // otherwise filter to the specific view (excludes archived)
        result = activeSessionMetas.filter(s => {
          const matched = evaluateViews(s)
          if (sessionFilter.viewId === '__all__') {
            return matched.length > 0
          }
          return matched.some(v => v.id === sessionFilter.viewId)
        })
        break
      }
      default:
        result = activeSessionMetas
    }

    // Apply secondary filters (status + labels, AND-ed together) in ALL views.
    if (listFilter.size > 0) {
      const statusIncludes = new Set<SessionStatusId>()
      const statusExcludes = new Set<SessionStatusId>()
      for (const [id, mode] of listFilter) {
        if (mode === 'include') statusIncludes.add(id)
        else statusExcludes.add(id)
      }
      if (statusIncludes.size > 0) {
        result = result.filter(s => statusIncludes.has((s.sessionStatus || 'todo') as SessionStatusId))
      }
      if (statusExcludes.size > 0) {
        result = result.filter(s => !statusExcludes.has((s.sessionStatus || 'todo') as SessionStatusId))
      }
    }
    // Filter by labels -- supports include/exclude with descendant expansion
    if (labelFilter.size > 0) {
      const labelIncludes = new Set<string>()
      const labelExcludes = new Set<string>()
      for (const [id, mode] of labelFilter) {
        // Expand to include descendant label IDs
        const ids = [id, ...getDescendantIds(labelConfigs, id)]
        for (const expandedId of ids) {
          if (mode === 'include') labelIncludes.add(expandedId)
          else labelExcludes.add(expandedId)
        }
      }
      if (labelIncludes.size > 0) {
        result = result.filter(s =>
          s.labels?.some(l => labelIncludes.has(extractLabelId(l)))
        )
      }
      if (labelExcludes.size > 0) {
        result = result.filter(s =>
          !s.labels?.some(l => labelExcludes.has(extractLabelId(l)))
        )
      }
    }

    return result
  }, [workspaceSessionMetas, activeSessionMetas, sessionFilter, listFilter, labelFilter, labelConfigs])

  // Derive "pinned" (non-removable) filters from the current sessionFilter path.
  const pinnedFilters = useMemo(() => {
    if (!sessionFilter) return { pinnedStatusId: null as string | null, pinnedLabelId: null as string | null, pinnedFlagged: false }
    switch (sessionFilter.kind) {
      case 'state':
        return { pinnedStatusId: sessionFilter.stateId, pinnedLabelId: null, pinnedFlagged: false }
      case 'label':
        // Don't pin the __all__ pseudo-label -- that just means "any label"
        return { pinnedStatusId: null, pinnedLabelId: sessionFilter.labelId !== '__all__' ? sessionFilter.labelId : null, pinnedFlagged: false }
      case 'flagged':
        return { pinnedStatusId: null, pinnedLabelId: null, pinnedFlagged: true }
      default:
        return { pinnedStatusId: null, pinnedLabelId: null, pinnedFlagged: false }
    }
  }, [sessionFilter])

  // Persist per-view filter map to localStorage (workspace-scoped)
  React.useEffect(() => {
    if (!activeWorkspaceId) return
    storage.set(storage.KEYS.viewFilters, viewFiltersMap, activeWorkspaceId)
  }, [viewFiltersMap, activeWorkspaceId])

  return {
    viewFiltersMap,
    setViewFiltersMap,
    listFilter,
    setListFilter,
    labelFilter,
    setLabelFilter,
    sessionFilterKey,
    filteredSessionMetas,
    pinnedFilters,
    filterDropdownResults,
    filterDropdownQuery,
    setFilterDropdownQuery,
    filterDropdownSelectedIdx,
    setFilterDropdownSelectedIdx,
    filterDropdownListRef,
    filterDropdownInputRef,
  }
}
