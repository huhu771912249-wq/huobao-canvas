/**
 * jsdom polyfills for the browser APIs naive-ui / vue-flow touch on mount.
 * Keep this file free of test-specific stubs — per-test doubles belong in the spec.
 */
import { afterEach } from 'vitest'
import { config, enableAutoUnmount } from '@vue/test-utils'

// Specs mount with `attachTo: document.body`. Without this, a spec that fails before its
// own `unmount()` leaves its DOM behind and every later spec in the file queries the
// corpse instead of its own component — one real failure would cascade into ten fake ones.
enableAutoUnmount(afterEach)
afterEach(() => { document.body.innerHTML = '' })

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe () {}
    unobserve () {}
    disconnect () {}
  }
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor () { this.root = null; this.rootMargin = ''; this.thresholds = [] }
    observe () {}
    unobserve () {}
    disconnect () {}
    takeRecords () { return [] }
  }
}

if (!window.matchMedia) {
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener () {},
    removeListener () {},
    addEventListener () {},
    removeEventListener () {},
    dispatchEvent () { return false }
  })
}

// vue-flow hit-tests connection handles through elementFromPoint; jsdom has no layout,
// so there is never an element under a point.
if (!Document.prototype.elementFromPoint) {
  Document.prototype.elementFromPoint = function elementFromPoint () { return null }
}

if (!Element.prototype.scrollTo) Element.prototype.scrollTo = function scrollTo () {}
if (!Element.prototype.scrollBy) Element.prototype.scrollBy = function scrollBy () {}

// vue-flow reads the transformation pane's zoom through DOMMatrixReadOnly.m22.
// jsdom ships no CSSOM matrix, so parse the handful of transform functions the
// canvas actually emits (`translate(...) scale(...)` and `matrix(...)`).
if (!globalThis.DOMMatrixReadOnly) {
  class DOMMatrixReadOnly {
    constructor (init = '') {
      this.a = 1
      this.b = 0
      this.c = 0
      this.d = 1
      this.e = 0
      this.f = 0
      const source = String(init ?? '').trim()
      if (!source || source === 'none') return
      const matrix = source.match(/^matrix\(([^)]*)\)$/)
      if (matrix) {
        const [a, b, c, d, e, f] = matrix[1].split(',').map(part => Number.parseFloat(part))
        Object.assign(this, { a, b, c, d, e, f })
        return
      }
      const scale = source.match(/scale\(([^)]*)\)/)
      if (scale) {
        const parts = scale[1].split(',').map(part => Number.parseFloat(part))
        this.a = parts[0]
        this.d = parts.length > 1 ? parts[1] : parts[0]
      }
      const translate = source.match(/translate\(([^)]*)\)/)
      if (translate) {
        const parts = translate[1].split(',').map(part => Number.parseFloat(part))
        this.e = parts[0] || 0
        this.f = parts[1] || 0
      }
    }

    get m11 () { return this.a }
    get m12 () { return this.b }
    get m21 () { return this.c }
    get m22 () { return this.d }
    get m41 () { return this.e }
    get m42 () { return this.f }
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnly
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrixReadOnly
}

// naive-ui renders a lot of teleported overlays; keep them in the document so the
// component's own DOM is not polluted by stubs.
config.global.stubs = {
  ...config.global.stubs,
  Teleport: false
}
