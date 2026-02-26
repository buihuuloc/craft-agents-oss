import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { searchLog } from "@/lib/logger"
import { fuzzyScore } from "@craft-agent/shared/search"
import { getSessionTitle } from "@/utils/session"
import type { SessionMeta } from "@/atoms/sessions"
import type { ViewConfig } from "@craft-agent/shared/views"
import type { SessionFilter } from "@/contexts/NavigationContext"
import {
  INITIAL_DISPLAY_LIMIT,
  BATCH_SIZE,
  MAX_SEARCH_RESULTS,
  sessionMatchesCurrentFilter,
  groupSessionsByDate,
} from "./session-list-utils"
import type { FilterMode } from "./session-list-types"

interface UseSessionListFilteringParams {
  items: SessionMeta[]
  searchActive?: boolean
  searchQuery: string
  currentFilter: SessionFilter | undefined
  evaluateViews?: (meta: SessionMeta) => ViewConfig[]
  workspaceId?: string
  statusFilter?: Map<string, FilterMode>
  labelFilterMap?: Map<string, FilterMode>
}

interface UseSessionListFilteringResult {
  /** Items visible in the current view, sorted by time */
  sortedItems: SessionMeta[]
  /** Items after applying search/filter, pre-pagination */
  searchFilteredItems: SessionMeta[]
  /** Items matching the current filter (in search mode) */
  matchingFilterItems: SessionMeta[]
  /** Items NOT matching current filter (in search mode) */
  otherResultItems: SessionMeta[]
  /** Whether result count exceeded MAX_SEARCH_RESULTS */
  exceededSearchLimit: boolean
  /** Paginated items (for date grouping in normal mode) */
  paginatedItems: SessionMeta[]
  /** Date-grouped sessions for normal (non-search) mode */
  dateGroups: Array<{ date: Date; label: string; sessions: SessionMeta[] }>
  /** Flat list of all visible items (for keyboard navigation) */
  flatItems: SessionMeta[]
  /** Map from session ID -> flat index */
  sessionIndexMap: Map<string, number>
  /** Whether there are more items to load (pagination) */
  hasMore: boolean
  /** Load more items (pagination) */
  loadMore: () => void
  /** Sentinel ref for infinite scroll */
  sentinelRef: React.RefObject<HTMLDivElement | null>
  /** Whether search mode is active (2+ chars) */
  isSearchMode: boolean
  /** The highlight query (only set in search mode) */
  highlightQuery: string | undefined
  /** Content search results from ripgrep */
  contentSearchResults: Map<string, { matchCount: number; snippet: string }>
  /** Whether a content search is in progress */
  isSearchingContent: boolean
}

export function useSessionListFiltering({
  items,
  searchActive,
  searchQuery,
  currentFilter,
  evaluateViews,
  workspaceId,
  statusFilter,
  labelFilterMap,
}: UseSessionListFilteringParams): UseSessionListFilteringResult {
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Content search state (full-text search via ripgrep)
  const [contentSearchResults, setContentSearchResults] = useState<Map<string, { matchCount: number; snippet: string }>>(new Map())
  const [isSearchingContent, setIsSearchingContent] = useState(false)

  // Search mode is active when search is open AND query has 2+ characters
  const isSearchMode = !!(searchActive && searchQuery.length >= 2)

  // Only highlight matches when in search mode
  const highlightQuery = isSearchMode ? searchQuery : undefined

  // Filter out hidden sessions (e.g., mini edit sessions) before any processing
  const visibleItems = useMemo(() => items.filter(item => !item.hidden), [items])

  // Sort by most recent activity first
  const sortedItems = useMemo(() =>
    [...visibleItems].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)),
    [visibleItems]
  )

  // Content search - triggers immediately when search query changes (ripgrep cancels previous search)
  useEffect(() => {
    if (!workspaceId || !isSearchMode) {
      setContentSearchResults(new Map())
      return
    }

    const searchId = Date.now().toString(36)
    searchLog.info('query:change', { searchId, query: searchQuery })

    // Track if this effect was cleaned up (user typed new query)
    let cancelled = false

    setIsSearchingContent(true)

    // 100ms debounce to prevent I/O contention from overlapping ripgrep searches
    const timer = setTimeout(async () => {
      try {
        searchLog.info('ipc:call', { searchId })
        const ipcStart = performance.now()

        const results = await window.electronAPI.searchSessionContent(workspaceId, searchQuery, searchId)

        // Ignore results if user already typed a new query
        if (cancelled) return

        searchLog.info('ipc:received', {
          searchId,
          durationMs: Math.round(performance.now() - ipcStart),
          resultCount: results.length,
        })

        const resultMap = new Map<string, { matchCount: number; snippet: string }>()
        for (const result of results) {
          resultMap.set(result.sessionId, {
            matchCount: result.matchCount,
            snippet: result.matches[0]?.snippet || '',
          })
        }
        setContentSearchResults(resultMap)

        // Log render complete after React commits the state update
        requestAnimationFrame(() => {
          searchLog.info('render:complete', { searchId, sessionsDisplayed: resultMap.size })
        })
      } catch (error) {
        if (cancelled) return
        console.error('[SessionList] Content search error:', error)
        setContentSearchResults(new Map())
      } finally {
        if (!cancelled) {
          setIsSearchingContent(false)
        }
      }
    }, 100)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setIsSearchingContent(false)
    }
  }, [workspaceId, isSearchMode, searchQuery])

  // Filter items by search query — ripgrep content search only for consistent results
  // When not in search mode, apply current filter to maintain filtered view
  const searchFilteredItems = useMemo(() => {
    // Not in search mode: filter to current view (same as non-search mode)
    if (!isSearchMode) {
      return sortedItems.filter(item =>
        sessionMatchesCurrentFilter(item, currentFilter, { evaluateViews, statusFilter, labelFilterMap })
      )
    }

    // Search mode (2+ chars): show sessions with ripgrep content matches (from ALL sessions)
    // Sort by: fuzzy title score first, then by match count
    return sortedItems
      .filter(item => contentSearchResults.has(item.id))
      .sort((a, b) => {
        const aScore = fuzzyScore(getSessionTitle(a), searchQuery)
        const bScore = fuzzyScore(getSessionTitle(b), searchQuery)

        // Title matches come first, sorted by fuzzy score (higher = better)
        if (aScore > 0 && bScore === 0) return -1
        if (aScore === 0 && bScore > 0) return 1
        if (aScore !== bScore) return bScore - aScore

        // Then sort by ripgrep match count
        const countA = contentSearchResults.get(a.id)?.matchCount || 0
        const countB = contentSearchResults.get(b.id)?.matchCount || 0
        return countB - countA
      })
  }, [sortedItems, isSearchMode, searchQuery, contentSearchResults, currentFilter, evaluateViews, statusFilter, labelFilterMap])

  // Split search results: sessions matching current filter vs all others
  // Also limits total results to MAX_SEARCH_RESULTS (100)
  const { matchingFilterItems, otherResultItems, exceededSearchLimit } = useMemo(() => {
    // Check if ANY filtering is active (primary OR secondary)
    const hasActiveFilters =
      (currentFilter && currentFilter.kind !== 'allSessions') ||
      (statusFilter && statusFilter.size > 0) ||
      (labelFilterMap && labelFilterMap.size > 0)

    // DEBUG: Trace values to diagnose grouping issue
    if (searchQuery.trim() && searchFilteredItems.length > 0) {
      searchLog.info('search:grouping', {
        searchQuery,
        currentFilterKind: currentFilter?.kind,
        currentFilterStateId: currentFilter?.kind === 'state' ? currentFilter.stateId : undefined,
        hasActiveFilters,
        statusFilterSize: statusFilter?.size ?? 0,
        labelFilterSize: labelFilterMap?.size ?? 0,
        itemCount: searchFilteredItems.length,
      })
    }

    // Check if we have more results than the limit
    const totalCount = searchFilteredItems.length
    const exceeded = totalCount > MAX_SEARCH_RESULTS

    if (!isSearchMode || !hasActiveFilters) {
      // No grouping needed - all results go to "matching", but limit to MAX_SEARCH_RESULTS
      const limitedItems = searchFilteredItems.slice(0, MAX_SEARCH_RESULTS)
      return { matchingFilterItems: limitedItems, otherResultItems: [] as SessionMeta[], exceededSearchLimit: exceeded }
    }

    const matching: SessionMeta[] = []
    const others: SessionMeta[] = []

    // Split results, stopping once we hit MAX_SEARCH_RESULTS total
    for (const item of searchFilteredItems) {
      if (matching.length + others.length >= MAX_SEARCH_RESULTS) break

      const matches = sessionMatchesCurrentFilter(item, currentFilter, { evaluateViews, statusFilter, labelFilterMap })
      if (matches) {
        matching.push(item)
      } else {
        others.push(item)
      }
    }

    // DEBUG: Log split result
    if (searchFilteredItems.length > 0) {
      searchLog.info('search:grouping:result', {
        matchingCount: matching.length,
        othersCount: others.length,
        exceeded,
      })
    }

    return { matchingFilterItems: matching, otherResultItems: others, exceededSearchLimit: exceeded }
  }, [searchFilteredItems, currentFilter, evaluateViews, isSearchMode, statusFilter, labelFilterMap])

  // Reset display limit when search query changes
  useEffect(() => {
    setDisplayLimit(INITIAL_DISPLAY_LIMIT)
  }, [searchQuery])

  // Paginate items - only show up to displayLimit
  const paginatedItems = useMemo(() => {
    return searchFilteredItems.slice(0, displayLimit)
  }, [searchFilteredItems, displayLimit])

  // Check if there are more items to load
  const hasMore = displayLimit < searchFilteredItems.length

  // Load more items callback
  const loadMore = useCallback(() => {
    setDisplayLimit(prev => Math.min(prev + BATCH_SIZE, searchFilteredItems.length))
  }, [searchFilteredItems.length])

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '100px' }  // Trigger slightly before reaching bottom
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  // Group sessions by date (only used in normal mode, not search mode)
  const dateGroups = useMemo(() => groupSessionsByDate(paginatedItems), [paginatedItems])

  // Create flat list for keyboard navigation (maintains order across groups/sections)
  const flatItems = useMemo(() => {
    if (isSearchMode) {
      // Search mode: flat list of matching + other results (no date grouping)
      return [...matchingFilterItems, ...otherResultItems]
    }
    // Normal mode: flatten date groups
    return dateGroups.flatMap(group => group.sessions)
  }, [isSearchMode, matchingFilterItems, otherResultItems, dateGroups])

  // Create a lookup map for session ID -> flat index
  const sessionIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    flatItems.forEach((item, index) => map.set(item.id, index))
    return map
  }, [flatItems])

  return {
    sortedItems,
    searchFilteredItems,
    matchingFilterItems,
    otherResultItems,
    exceededSearchLimit,
    paginatedItems,
    dateGroups,
    flatItems,
    sessionIndexMap,
    hasMore,
    loadMore,
    sentinelRef,
    isSearchMode,
    highlightQuery,
    contentSearchResults,
    isSearchingContent,
  }
}
