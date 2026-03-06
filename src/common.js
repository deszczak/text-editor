import document from 'document'

// Instances storage
export const instances = {}

// CSS classes
export const selectedClass = 'wysi-selected'
export const placeholderClass = 'wysi-fragment-placeholder'

// Element categories
export const headingElements = ['H1', 'H2', 'H3', 'H4']
export const blockElements = ['BLOCKQUOTE', 'HR', 'P', 'OL', 'UL', ...headingElements]

// Browser detection
export const isFirefox = navigator.userAgent.includes('Gecko/')

/**
 * Create an element with optional attributes.
 * @param {string} tag - HTML tag name
 * @param {object} attrs - Element attributes (prefix with _ for properties)
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}) {
  const el = document.createElement(tag)

  for (const [key, val] of Object.entries(attrs)) {
    if (key[0] === '_') el[key.slice(1)] = val
    else el.setAttribute(key, val)
  }

  return el
}

/**
 * Replace a DOM element while preserving content.
 * @param {HTMLElement} node - Element to replace
 * @param {string} tag - New element tag
 * @param {boolean} copyAttrs - Copy original attributes
 * @returns {HTMLElement}
 */
export function replaceNode(node, tag, copyAttrs = false) {
  const newEl = createElement(tag)
  newEl.innerHTML = node.innerHTML || node.textContent || node.outerHTML

  if (copyAttrs && node.attributes) {
    for (const attr of node.attributes) {
      newEl.setAttribute(attr.name, attr.value)
    }
  }

  node.parentNode.replaceChild(newEl, node)
  return newEl
}