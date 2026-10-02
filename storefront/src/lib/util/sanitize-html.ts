/**
 * Minimal HTML sanitizer for merchant-authored product descriptions
 * (Shopify imports carry <p>/<strong>/spans + stray markdown).
 *
 * No dependency: allowlist-based, works server- and client-side.
 * - converts **bold** markdown to <strong>
 * - drops empty paragraphs (&nbsp; fillers)
 * - keeps a small set of structural/formatting tags, unstyled
 * - strips everything else (scripts, styles, iframes, event handlers,
 *   javascript: URLs, all other attributes)
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "div",
  "a",
])

export function sanitizeDescriptionHtml(input: string): string {
  if (!input) return ""
  let html = input.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  // Nuke active content wholesale before tag filtering.
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|form|input|button|img|video|audio|link|meta)\b[^>]*>/gi, "")

  // Walk tags: keep allowlisted ones (href-only on <a>), drop the rest but
  // keep their inner text.
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawTag, attrs) => {
    const tag = rawTag.toLowerCase()
    const closing = match.startsWith("</")
    if (!ALLOWED_TAGS.has(tag)) return ""
    if (closing) {
      if (tag === "b") return "</strong>"
      if (tag === "i") return "</em>"
      return `</${tag}>`
    }
    if (tag === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "")
      const url = (href?.[2] ?? href?.[3] ?? href?.[4] ?? "").trim()
      if (/^(https?:|mailto:)/i.test(url)) {
        const safe = url.replace(/"/g, "%22")
        return `<a href="${safe}">`
      }
      return ""
    }
    // Normalize presentational aliases to semantic tags (closings
    // already mapped above).
    if (tag === "b") return "<strong>"
    if (tag === "i") return "<em>"
    return `<${tag}>`
  })

  // Drop filler paragraphs (<p>&nbsp;</p>, <p> </p>, <p><br></p>).
  html = html.replace(/<p[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/p\s*>/gi, "")

  return html.trim()
}

/** Plain-text excerpt for cards/previews: sanitized first (so script
 *  bodies and markup never leak), then tags + entities removed. */
export function stripHtmlToText(input: string): string {
  if (!input) return ""
  const clean = sanitizeDescriptionHtml(input)
  return clean
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}
