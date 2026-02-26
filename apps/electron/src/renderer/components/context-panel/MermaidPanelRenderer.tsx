/**
 * MermaidPanelRenderer — Zoomable mermaid diagram for the ContextPanel.
 *
 * Renders mermaid code as SVG with trackpad pinch zoom, mouse wheel zoom,
 * click-drag pan, and double-click reset. No fullscreen button — the panel
 * is the primary view.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { renderMermaidSync } from '@craft-agent/mermaid'

const MIN_SCALE = 0.1
const MAX_SCALE = 4

function parseSvgDimensions(svgString: string): { width: number; height: number } | null {
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)"/)
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)"/)
  if (!widthMatch?.[1] || !heightMatch?.[1]) return null
  return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) }
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

interface MermaidPanelRendererProps {
  code: string
}

export function MermaidPanelRenderer({ code }: MermaidPanelRendererProps) {
  const { svg, error } = useMemo(() => {
    try {
      return {
        svg: renderMermaidSync(code, {
          bg: 'var(--background)',
          fg: 'var(--foreground)',
          accent: 'var(--accent)',
          line: 'var(--foreground-30)',
          muted: 'var(--muted-foreground)',
          surface: 'var(--foreground-3)',
          border: 'var(--foreground-20)',
          transparent: true,
        }),
        error: null,
      }
    } catch (err) {
      return { svg: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [code])

  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const translateAtDragStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { translateRef.current = translate }, [translate])

  // Calculate zoom-to-fit scale (cap at 100% to avoid upscaling small diagrams)
  const calcFitScale = useCallback((container?: HTMLDivElement | null) => {
    const el = container || containerRef.current
    if (!el || !svg) return null
    const dims = parseSvgDimensions(svg)
    if (!dims) return null
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const scaleX = (rect.width * 0.9) / dims.width
    const scaleY = (rect.height * 0.9) / dims.height
    return clampScale(Math.min(scaleX, scaleY, 1))
  }, [svg])

  // Auto zoom-to-fit on mount / code change
  useEffect(() => {
    if (!svg) return
    const timer = setTimeout(() => {
      const fitScale = calcFitScale()
      if (fitScale !== null) setScale(fitScale)
      setTranslate({ x: 0, y: 0 })
    }, 50)
    return () => clearTimeout(timer)
  }, [svg, calcFitScale])

  // Attach gesture handlers via callback ref
  const setContainerRefCb = useCallback((node: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    containerRef.current = node
    if (!node) return

    // Wheel zoom (mouse wheel + trackpad pinch via ctrlKey)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = node.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
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

    // Mouse drag for pan
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

    // Double-click to reset to fit
    const handleDblClick = () => {
      const fitScale = calcFitScale()
      setScale(fitScale ?? 1)
      setTranslate({ x: 0, y: 0 })
    }

    // Touch pinch zoom + pan
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

    node.addEventListener('wheel', handleWheel, { passive: false })
    node.addEventListener('mousedown', handleMouseDown)
    node.addEventListener('dblclick', handleDblClick)
    node.addEventListener('touchstart', handleTouchStart, { passive: false })
    node.addEventListener('touchmove', handleTouchMove, { passive: false })
    node.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

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
  }, [svg, calcFitScale])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  if (error || !svg) {
    return (
      <div className="p-4 text-sm text-destructive/70">
        {error || 'Failed to render diagram'}
      </div>
    )
  }

  const zoomPercent = Math.round(scale * 100)

  return (
    <div className="relative h-full flex flex-col">
      {/* Zoom percentage indicator */}
      <div className="absolute bottom-3 right-3 z-10 text-xs text-muted-foreground/50 bg-background/80 px-2 py-0.5 rounded-md select-none pointer-events-none">
        {zoomPercent}%
      </div>

      {/* Zoomable/pannable viewport */}
      <div
        ref={setContainerRefCb}
        className="flex-1 flex items-center justify-center select-none"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  )
}
