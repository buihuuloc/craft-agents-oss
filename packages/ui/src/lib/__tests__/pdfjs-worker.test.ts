import { describe, it, expect } from 'bun:test'
import { resolvePdfJsWorkerSrc } from '../pdfjs-worker'

describe('resolvePdfJsWorkerSrc', () => {
  it('uses default export when available', () => {
    expect(resolvePdfJsWorkerSrc({ default: '/assets/pdf.worker.js' })).toBe('/assets/pdf.worker.js')
  })

  it('uses direct string module shape', () => {
    expect(resolvePdfJsWorkerSrc('/assets/worker.js')).toBe('/assets/worker.js')
  })

  it('falls back to package worker path', () => {
    expect(resolvePdfJsWorkerSrc({})).toBe('pdfjs-dist/build/pdf.worker.min.mjs')
    expect(resolvePdfJsWorkerSrc(undefined)).toBe('pdfjs-dist/build/pdf.worker.min.mjs')
  })
})
