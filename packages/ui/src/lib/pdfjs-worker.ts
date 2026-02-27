const FALLBACK_WORKER_SRC = 'pdfjs-dist/build/pdf.worker.min.mjs'

export function resolvePdfJsWorkerSrc(moduleValue: unknown): string {
  if (typeof moduleValue === 'string' && moduleValue.length > 0) return moduleValue

  if (moduleValue && typeof moduleValue === 'object') {
    const maybeDefault = (moduleValue as { default?: unknown }).default
    if (typeof maybeDefault === 'string' && maybeDefault.length > 0) {
      return maybeDefault
    }
  }

  return FALLBACK_WORKER_SRC
}
