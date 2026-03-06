/**
 * Text formatting utilities
 */

// Orphans
const ORPHAN_PATTERN = /(^| )([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /gm
const DOUBLE_ORPHAN_PATTERN = /\xa0([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /g

/**
 * Add non-breaking spaces after orphan words
 */
export const nbsp = (text) => {
  let result = text
  let prev = null
  let iterations = 0

  // Step 1: Replace space after orphan with non-breaking space
  while (prev !== result && iterations < 5) {
    prev = result
    result = result.replace(ORPHAN_PATTERN, '$1$2\xa0')
    iterations++
  }

  // Step 2: Handle double orphans
  prev = null
  iterations = 0
  while (prev !== result && iterations < 5) {
    prev = result
    result = result.replace(DOUBLE_ORPHAN_PATTERN, '\xa0$1\xa0')
    iterations++
  }

  return result
}

/**
 * Replace hyphens surrounded by spaces with en-dash
 */
export const dash = (text) => text.replace(/(\s-)+\s/g, m => m === ' - ' ? ' – ' : m)

/**
 * Fix spacing around punctuation marks
 */
export const punctuation = (text) => text
  .replace(/[^\S\r\n]+([,.!?;:\]])/g, '$1')
  .replace(/([,.!?;:\]])[^\S\r\n]{2,}/g, '$1 ')

/**
 * Apply all formatting: punctuation, nbsp (orphan words), and dash
 */
export const autoFormat = (text) => punctuation(nbsp(dash(text)))

/**
 * Format all text nodes within a container element
 * @param {Element} container - Element containing text to format
 */
export const formatTextNodes = (container) => {
  if (!container) return
  
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    { acceptNode: node => node.textContent.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
  )

  const nodes = []
  let node
  while ((node = walker.nextNode())) nodes.push(node)

  nodes.forEach(n => {
    const formatted = autoFormat(n.textContent)
    if (formatted !== n.textContent) n.textContent = formatted
  })
}