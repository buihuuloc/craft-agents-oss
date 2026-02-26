/**
 * MermaidPreviewOverlay — fullscreen diagram preview with zoom and pan.
 *
 * Renders a pre-rendered mermaid SVG string in a zoomable/pannable viewport
 * with Figma-style zoom controls.
 *
 * Input methods:
 *   - Trackpad pinch: Smooth proportional zoom (ctrlKey wheel events on macOS)
 *   - Mousewheel:     Zoom toward cursor
 *   - Click-drag:     Pan the diagram
 *   - Double-click:   Reset to zoom-to-fit
 *   - Cmd/Ctrl +/-:   Zoom in/out by 25% steps toward viewport center
 *   - Cmd/Ctrl 0:     Reset to zoom-to-fit
 *   - +/− buttons:    25% step zoom toward viewport center
 *   - Preset dropdown: Jump to 25/50/75/100/150/200/400% or "Zoom to Fit"
 *
 * Header controls: [−] [▾ 100%] [+]  [⟲] [copy]
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { GitGraph, RotateCcw, Minus, Plus, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { PreviewOverlay } from './PreviewOverlay'
import { CopyButton } from './CopyButton'

// ── Zoom constants ───────────────────────────────────────────────────────

const MIN_SCALE = 0.1
const MAX_SCALE = 4

// Step factor for +/- buttons and keyboard shortcuts (25% increments).
const ZOOM_STEP_FACTOR = 1.25

// Zoom presets shown in the dropdown (percentages)
const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400]

// ── Helpers ──────────────────────────────────────────────────────────────

/** Parse width/height from an SVG string's root element attributes. */
function parseSvgDimensions(svgString: string): { width: number; height: number } | null {
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/)
  if (!widthMatch?.[1] || !heightMatch?.[1]) return null
  return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) }
}

/** Clamp a value between min and max. */
function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

// ── Inline zoom dropdown ─────────────────────────────────────────────────

interface ZoomDropdownProps {
  zoomPercent: number
  activePreset: number | undefined
  onZoomToFit: () => void
  onZoomToPreset: (preset: number) => void
}

function ZoomDropdown({ zoomPercent, activePreset, onZoomToFit, onZoomToPreset }: ZoomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-0.5 px-1 py-1 hover:bg-foreground/5 text-[13px] tabular-nums min-w-[4rem] justify-center transition-colors"
        title="Zoom presets"
      >
        {zoomPercent}%
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-1 min-w-[140px] p-1",
            "bg-background rounded-[8px] shadow-strong border border-border/50",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          <button
            type="button"
            onClick={() => { onZoomToFit(); setIsOpen(false) }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[13px] rounded-[4px] hover:bg-foreground/[0.05] transition-colors"
          >
            Zoom to Fit
          </button>
          <div className="h-px bg-foreground/5 my-1" />
          {ZOOM_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => { onZoomToPreset(preset); setIsOpen(false) }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[13px] rounded-[4px] hover:bg-foreground/[0.05] transition-colors"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                {activePreset === preset && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className={activePreset === preset ? 'font-medium' : ''}>
                {preset}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────

export interface MermaidPreviewOverlayProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-rendered SVG string from renderMermaid() */
  svg: string
  /** Original mermaid source code (for copy button) */
  code: string
}

export function MermaidPreviewOverlay({
  isOpen,
  onClose,
  svg,
  code,
}: MermaidPreviewOverlayProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Refs for latest state — used in imperative event handlers to avoid stale closures.
  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const translateAtDragStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Keep refs in sync
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { translateRef.current = translate }, [translate])

  // ── Zoom-to-fit calculation ────────────────────────────────────────────

  const calcFitScale = useCallback((container?: HTMLDivElement | null) => {
    const el = container || containerRef.current
    if (!el) return null

    const dims = parseSvgDimensions(svg)
    if (!dims) return null

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const scaleX = (rect.width * 0.9) / dims.width
    const scaleY = (rect.height * 0.9) / dims.height
    return clampScale(Math.min(scaleX, scaleY, MAX_SCALE))
  }, [svg])

  // Auto zoom-to-fit when overlay opens
  useEffect(() => {
    if (!isOpen) return
    // Delay to ensure the Portal/Dialog has mounted the container
    const timer = setTimeout(() => {
      const fitScale = calcFitScale()
      if (fitScale !== null) {
        setScale(fitScale)
      } else {
        setScale(1)
      }
      setTranslate({ x: 0, y: 0 })
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen, calcFitScale])

  // ── Zoom actions ─────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setIsAnimating(true)
    const fitScale = calcFitScale()
    setScale(fitScale ?? 1)
    setTranslate({ x: 0, y: 0 })
  }, [calcFitScale])

  const zoomByStep = useCallback((direction: 'in' | 'out') => {
    setIsAnimating(true)
    setScale(prev => {
      const factor = direction === 'in' ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR
      const next = clampScale(prev * factor)
      const ratio = next / prev
      setTranslate(t => ({ x: t.x * ratio, y: t.y * ratio }))
      return next
    })
  }, [])

  const zoomToPreset = useCallback((preset: number) => {
    setIsAnimating(true)
    setScale(clampScale(preset / 100))
    setTranslate({ x: 0, y: 0 })
  }, [])

  const zoomToFit = useCallback(() => {
    const fitScale = calcFitScale()
    if (fitScale !== null) {
      setIsAnimating(true)
      setScale(fitScale)
      setTranslate({ x: 0, y: 0 })
    } else {
      handleReset()
    }
  }, [calcFitScale, handleReset])

  // ── Attach all gesture handlers via callback ref ──────────────────────
  // This ensures handlers are attached the instant the DOM element mounts,
  // regardless of Portal/Dialog timing. Cleanup runs when element unmounts.
  const cleanupRef = useRef<(() => void) | null>(null)

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous listeners
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    containerRef.current = node
    if (!node) return

    // ── Wheel zoom (mouse wheel + trackpad pinch via ctrlKey) ──
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = node.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2

      // Trackpad pinch fires with ctrlKey=true and small deltaY
      const isTrackpadPinch = e.ctrlKey
      const sensitivity = isTrackpadPinch ? 0.01 : 0.003
      const factor = Math.pow(2, -e.deltaY * sensitivity)

      setScale(prev => {
        const next = clampScale(prev * factor)
        const ratio = next / prev
        setTranslate(t => ({
          x: cx - ratio * (cx - t.x),
          y: cy - ratio * (cy - t.y),
        }))
        return next
      })
    }

    // ── Mouse drag for pan ──
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      isDraggingRef.current = true
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      translateAtDragStartRef.current = { ...translateRef.current }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      setTranslate({
        x: translateAtDragStartRef.current.x + (e.clientX - dragStartRef.current.x),
        y: translateAtDragStartRef.current.y + (e.clientY - dragStartRef.current.y),
      })
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
      }
    }

    // ── Double-click to reset ──
    const handleDblClick = () => {
      setIsAnimating(true)
      // Use timeout to read latest container size
      setTimeout(() => {
        const dims = parseSvgDimensions(svg)
        if (dims && node) {
          const rect = node.getBoundingClientRect()
          const scaleX = (rect.width * 0.9) / dims.width
          const scaleY = (rect.height * 0.9) / dims.height
          setScale(clampScale(Math.min(scaleX, scaleY, MAX_SCALE)))
        } else {
          setScale(1)
        }
        setTranslate({ x: 0, y: 0 })
      }, 0)
    }

    // ── Touch pinch zoom + pan ──
    let touchStartDist = 0
    let touchStartScale = 1
    let touchStartMid = { x: 0, y: 0 }
    let touchStartTranslate = { x: 0, y: 0 }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]!
        const t2 = e.touches[1]!
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        touchStartDist = Math.sqrt(dx * dx + dy * dy)
        touchStartScale = scaleRef.current
        touchStartMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
        touchStartTranslate = { ...translateRef.current }
      } else if (e.touches.length === 1) {
        isDraggingRef.current = true
        setIsDragging(true)
        dragStartRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }
        translateAtDragStartRef.current = { ...translateRef.current }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]!
        const t2 = e.touches[1]!
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        const currentDist = Math.sqrt(dx * dx + dy * dy)
        const currentMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }

        const ratio = currentDist / touchStartDist
        const newScale = clampScale(touchStartScale * ratio)
        const scaleRatio = newScale / touchStartScale

        const rect = node.getBoundingClientRect()
        const cx = touchStartMid.x - rect.left - rect.width / 2
        const cy = touchStartMid.y - rect.top - rect.height / 2
        const panDx = currentMid.x - touchStartMid.x
        const panDy = currentMid.y - touchStartMid.y

        setScale(newScale)
        setTranslate({
          x: cx - scaleRatio * (cx - touchStartTranslate.x) + panDx,
          y: cy - scaleRatio * (cy - touchStartTranslate.y) + panDy,
        })
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        setTranslate({
          x: translateAtDragStartRef.current.x + (e.touches[0]!.clientX - dragStartRef.current.x),
          y: translateAtDragStartRef.current.y + (e.touches[0]!.clientY - dragStartRef.current.y),
        })
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
      }
    }

    // Attach all listeners
    node.addEventListener('wheel', handleWheel, { passive: false })
    node.addEventListener('mousedown', handleMouseDown)
    node.addEventListener('dblclick', handleDblClick)
    node.addEventListener('touchstart', handleTouchStart, { passive: false })
    node.addEventListener('touchmove', handleTouchMove, { passive: false })
    node.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // Store cleanup function
    cleanupRef.current = () => {
      node.removeEventListener('wheel', handleWheel)
      node.removeEventListener('mousedown', handleMouseDown)
      node.removeEventListener('dblclick', handleDblClick)
      node.removeEventListener('touchstart', handleTouchStart)
      node.removeEventListener('touchmove', handleTouchMove)
      node.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [svg])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomByStep('in')
      } else if (e.key === '-') {
        e.preventDefault()
        zoomByStep('out')
      } else if (e.key === '0') {
        e.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, zoomByStep, handleReset])

  // ── Header actions ───────────────────────────────────────────────────

  const fitScale = calcFitScale()
  const isDefaultView = (fitScale !== null ? scale === fitScale : scale === 1) && translate.x === 0 && translate.y === 0
  const zoomPercent = Math.round(scale * 100)
  const activePreset = ZOOM_PRESETS.find(p => p === zoomPercent)

  const controlBtnClass = cn(
    'p-1.5 rounded-[6px] bg-background shadow-minimal cursor-pointer',
    'opacity-70 hover:opacity-100 transition-opacity',
    'disabled:opacity-30 disabled:cursor-not-allowed',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring'
  )

  const headerActions = (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-px bg-background shadow-minimal rounded-[6px]">
        <button
          onClick={() => zoomByStep('out')}
          disabled={scale <= MIN_SCALE}
          className={cn(
            'p-1.5 rounded-l-[6px] cursor-pointer',
            'opacity-70 hover:opacity-100 transition-opacity',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
          title="Zoom out (⌘−)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <ZoomDropdown
          zoomPercent={zoomPercent}
          activePreset={activePreset}
          onZoomToFit={zoomToFit}
          onZoomToPreset={zoomToPreset}
        />

        <button
          onClick={() => zoomByStep('in')}
          disabled={scale >= MAX_SCALE}
          className={cn(
            'p-1.5 rounded-r-[6px] cursor-pointer',
            'opacity-70 hover:opacity-100 transition-opacity',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
          title="Zoom in (⌘+)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={handleReset}
        disabled={isDefaultView}
        className={controlBtnClass}
        title="Reset zoom (⌘0)"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <CopyButton content={code} title="Copy code" className="bg-background shadow-minimal opacity-70 hover:opacity-100" />
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      typeBadge={{
        icon: GitGraph,
        label: 'Diagram',
        variant: 'purple',
      }}
      title="Mermaid Diagram"
      headerActions={headerActions}
    >
      <div
        ref={setContainerRef}
        className="flex items-center justify-center select-none"
        style={{
          marginTop: -72,
          marginBottom: -24,
          height: '100vh',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          onTransitionEnd={() => setIsAnimating(false)}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isAnimating ? 'transform 150ms ease-out' : 'none',
          }}
        />
      </div>
    </PreviewOverlay>
  )
}
