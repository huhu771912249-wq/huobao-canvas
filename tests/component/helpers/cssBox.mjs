/**
 * A small CSS box oracle for jsdom.
 *
 * jsdom parses and cascades CSS but never lays anything out: every
 * `getBoundingClientRect()` is zero. These helpers close exactly the gap the canvas
 * guard rails need — read the *rendered* element's effective `max-height` (inline style
 * or author stylesheet), resolve it against a chosen viewport, and apply the browser's
 * own `height = min(content, max-height)` rule.
 *
 * Everything here reads values out of the DOM the component actually produced; nothing
 * reads component source text.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import tailwindConfig from '../../../tailwind.config.js'

const APP_STYLESHEET_ID = 'app-stylesheet-under-test'
const TAILWIND_STYLESHEET_ID = 'tailwind-utilities-under-test'

let tailwindCssPromise = null

/**
 * Inject `src/style.css` into the jsdom document so class-based guard rails such as
 * `.canvas-node-scroll-shell` participate in `getComputedStyle`. The three `@tailwind`
 * directives are stripped: they are build-time placeholders, not CSS.
 */
export const loadAppStylesheet = () => {
  if (document.getElementById(APP_STYLESHEET_ID)) return
  const css = readFileSync(path.resolve(process.cwd(), 'src/style.css'), 'utf8')
    .replace(/^\s*@tailwind[^;]*;\s*$/gm, '')
  const style = document.createElement('style')
  style.id = APP_STYLESHEET_ID
  style.textContent = css
  document.head.append(style)
}

/**
 * Compile the project's real Tailwind utilities and inject them too, so utility classes
 * such as `overflow-y-auto` / `min-h-0` are visible to `getComputedStyle`. Generating
 * them (~250ms, cached per worker) beats hand-written stand-ins that can drift from the
 * classes the build actually emits.
 */
export const loadTailwindUtilities = async () => {
  if (document.getElementById(TAILWIND_STYLESHEET_ID)) return
  tailwindCssPromise ??= postcss([tailwind(tailwindConfig)])
    .process('@tailwind utilities;', { from: undefined })
    .then(result => result.css)
  const style = document.createElement('style')
  style.id = TAILWIND_STYLESHEET_ID
  style.textContent = await tailwindCssPromise
  document.head.append(style)
}

/** Everything the canvas guard rails are expressed in: project CSS + Tailwind utilities. */
export const loadCanvasStyles = async () => {
  loadAppStylesheet()
  await loadTailwindUtilities()
}

/** Pin the jsdom viewport so `100vh` and `window.innerHeight` agree. */
export const setViewport = ({ width = 1440, height = 900 } = {}) => {
  Object.defineProperty(globalThis, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'innerHeight', { value: height, configurable: true, writable: true })
  return { width, height }
}

const toPixels = (amount, unit, viewport) => {
  switch (unit) {
    case '':
    case 'px': return amount
    case 'vh': return amount / 100 * viewport.height
    case 'vw': return amount / 100 * viewport.width
    case 'vmin': return amount / 100 * Math.min(viewport.width, viewport.height)
    case 'vmax': return amount / 100 * Math.max(viewport.width, viewport.height)
    case 'rem':
    case 'em': return amount * 16
    default: return Number.NaN
  }
}

const tokenize = expression => expression.match(/\d*\.?\d+[a-z%]*|[()+\-*/]/gi) ?? []

/** Recursive-descent evaluator for the arithmetic subset CSS `calc()` allows. */
const parseExpression = (tokens, viewport) => {
  let index = 0
  const peek = () => tokens[index]
  const parsePrimary = () => {
    const token = tokens[index++]
    if (token === '(') {
      const value = parseSum()
      if (tokens[index] === ')') index += 1
      return value
    }
    if (token === '-') return -parsePrimary()
    if (token === '+') return parsePrimary()
    const match = String(token).match(/^(\d*\.?\d+)([a-z%]*)$/i)
    if (!match) return Number.NaN
    return toPixels(Number.parseFloat(match[1]), match[2].toLowerCase(), viewport)
  }
  const parseProduct = () => {
    let value = parsePrimary()
    while (peek() === '*' || peek() === '/') {
      const operator = tokens[index++]
      const right = parsePrimary()
      value = operator === '*' ? value * right : value / right
    }
    return value
  }
  const parseSum = () => {
    let value = parseProduct()
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[index++]
      const right = parseProduct()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }
  return parseSum()
}

/**
 * Resolve a CSS length (`780px`, `calc(100vh - 120px)`, `none`, …) to pixels.
 * Returns `null` for "no bound", which is what an unguarded node reports.
 */
export const resolveCssLength = (raw, viewport) => {
  const value = String(raw ?? '').trim()
  if (!value || value === 'none' || value === 'auto' || value === 'initial') return null
  const calc = value.match(/^calc\((.*)\)$/is)
  const result = parseExpression(tokenize(calc ? calc[1] : value), viewport)
  return Number.isFinite(result) ? result : null
}

/** The effective `max-height` of a rendered element, in pixels (inline style wins). */
export const effectiveMaxHeight = (element, viewport) => {
  const inline = element.style?.maxHeight
  if (inline) return resolveCssLength(inline, viewport)
  return resolveCssLength(window.getComputedStyle(element).maxHeight, viewport)
}

/**
 * The height a browser would actually paint for `element`, given content that wants
 * to be `contentHeight` tall. This is the CSS `max-height` clamp and nothing else.
 */
export const paintedHeight = (element, { contentHeight, viewport }) => {
  const bound = effectiveMaxHeight(element, viewport)
  return bound === null ? contentHeight : Math.min(contentHeight, bound)
}
