import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'

const window = new JSDOM('').window
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any)

/**
 * Sanitize HTML input — strips dangerous tags/attributes (script, onclick, etc.)
 * but keeps safe formatting tags (b, i, em, strong, p, br, ul, ol, li, a).
 */
export function sanitizeHtml(input: string): string {
  return purify.sanitize(input, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

/**
 * Strip ALL HTML tags and return plain text.
 * Use for fields that should never contain markup (names, titles, etc.).
 */
export function sanitizeText(input: string): string {
  return purify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
