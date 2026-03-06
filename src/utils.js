import document from 'document'
import { createElement, replaceNode } from './common'

// Store the current DOM selection for later use
let currentSelection

// Unique marker ID counter
let markerIdCounter = 0

// Polyfill for NodeList.forEach
if (NodeList?.prototype && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach
}

/**
 * Add event listener with optional delegation
 * @param {object} context - Event target
 * @param {string} type - Event type
 * @param {string|function} selector - Target selector or handler
 * @param {function} [fn] - Event handler
 */
export function addListener(context, type, selector, fn) {
  if (typeof selector === 'string') {
    context.addEventListener(type, e => {
      const target = e.target.closest(selector)
      if (target) fn.call(target, e)
    })
  } else context.addEventListener(type, selector)
}

/**
 * Build HTML fragment from string
 * @param {string} html - HTML code
 * @returns {DocumentFragment}
 */
export function buildFragment(html) {
  const template = createElement('template')
  template.innerHTML = html.trim()
  return template.content
}

/**
 * Execute function when DOM is ready
 * @param {function} fn - Function to execute
 * @param {array} [args] - Arguments to pass
 */
export function DOMReady(fn, args = []) {
  if (document.readyState !== 'loading') fn(...args)
  else addListener(document, 'DOMContentLoaded', () => fn(...args))
}

/**
 * Find the deepest child node
 * @param {Node} node - Target node
 * @returns {Node} Deepest child
 */
export const findDeepestChildNode = (node) => {
  while (node.firstChild) node = node.firstChild
  return node
}

/**
 * Find WYSIWYG editor instances
 * @param {string} selector - Textarea selectors
 * @returns {array} Editor instances
 */
export function findEditorInstances(selector) {
  return getTargetElements(selector).map(textarea => {
    const wrapper = textarea.previousElementSibling
    if (wrapper && !wrapper.classList.contains('wysi-wrapper')) return null
    
    const [toolbar, editor] = wrapper.children
    return { textarea, wrapper, toolbar, editor, instanceId: getInstanceId(editor) }
  }).filter(Boolean)
}

/**
 * Find current editor instance
 * @param {Node || HTMLElement} currentNode - Possible child node
 * @returns {object} Instance data
 */
export function findInstance(currentNode) {
  const nodes = []
  let ancestor, toolbar, editor

  while (currentNode && currentNode !== document.body) {
    if (currentNode.tagName) {
      if (currentNode.classList.contains('wysi-wrapper')) {
        ancestor = currentNode
        break
      }
      nodes.push(currentNode)
    }
    currentNode = currentNode.parentNode
  }

  if (ancestor) [toolbar, editor] = ancestor.children

  return { toolbar, editor, nodes }
}

export const getCurrentSelection = () => currentSelection

/**
 * Get HTML content of document fragment
 * @param {HTMLElement} fragment - Document fragment
 * @returns {string} HTML content
 */
export function getFragmentContent(fragment) {
  const wrapper = createElement('div')
  wrapper.appendChild(fragment)
  return wrapper.innerHTML
}

/**
 * Get editor instance ID
 * @param {HTMLElement} editor - Editor element
 * @returns {string} Instance ID
 */
export const getInstanceId = (editor) => editor?.dataset.wid

/**
 * Get DOM elements from selector
 * @param {string|object} selector - CSS selector, DOM element, or list
 * @returns {array} DOM elements
 */
export function getTargetElements(selector) {
  if (typeof selector === 'string') return [...document.querySelectorAll(selector)]
  if (selector instanceof Node) return [selector]
  if (selector instanceof NodeList || selector instanceof HTMLCollection) return [...selector]
  if (Array.isArray(selector)) return selector.filter(el => el instanceof Node)
  return []
}

/**
 * Try to guess textarea element's label
 * @param {HTMLElement} textarea - Textarea element
 * @returns {string} Label text
 */
export function getTextAreaLabel(textarea) {
  const { parentNode, id } = textarea
  const labelElement = parentNode.nodeName === 'LABEL' 
    ? parentNode 
    : id ? document.querySelector(`label[for="${id}"]`) : null

  if (labelElement) {
    const text = [...labelElement.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.replace(/\s+/g, ' ').trim())
      .find(l => l)
    if (text) return text
  }

  return ''
}

/**
 * Restore the previous selection if any
 */
export function restoreCurrentSelection() {
  if (currentSelection) {
    setSelection(currentSelection)
    currentSelection = undefined
  }
}

/**
 * Create unique marker element for selection boundaries
 * @returns {HTMLScriptElement} Marker element
 */
const createMarker = () => {
  const script = document.createElement('script')
  script.type = 'marker'
  script.id = `mark-${markerIdCounter++}`
  return script
}

/**
 * Save the current selection by inserting temporary markers
 * @param {Selection} [selection] - Selection to save
 * @returns {Array|null} Marker elements
 */
export function placeSelectionMarkers(selection = document.getSelection()) {
  if (!selection?.rangeCount) return null

  const range = selection.getRangeAt(0)
  const startMarker = createMarker()
  const endMarker = createMarker()

  const startRange = range.cloneRange()
  startRange.collapse(true)
  startRange.insertNode(startMarker)

  const endRange = range.cloneRange()
  endRange.collapse(false)
  endRange.insertNode(endMarker)

  return [startMarker, endMarker]
}

/**
 * Remove tag from node
 * @param {HTMLElement} node - Node to process
 */
export const removeTag = (node) => node.outerHTML = node.innerHTML

/**
 * Get new marker references after DOM changes
 * @param {HTMLScriptElement[]} markers - Saved markers
 * @returns {HTMLScriptElement[]} New references
 */
export const getNewMarkerReferences = (markers) => markers.map(m => document.getElementById(m.id))

/**
 * Restore selection using marker elements
 * @param {HTMLScriptElement[]} markers - Start and end markers
 * @param {boolean} [removeMarkers=true] - Remove markers after restoring
 */
export function restoreMarkerSelection(markers, removeMarkers = true) {
  if (markers.length !== 2) return
  const [start, end] = markers

  const range = document.getSelection().getRangeAt(0)
  range.setStartAfter(start)
  range.setEndBefore(end)
  setSelection(range)

  if (removeMarkers) {
    start.remove()
    end.remove()
  }
}

export const setCurrentSelection = (range) => currentSelection = range

/**
 * Set selection to a range
 * @param {Range} range - Range to select
 */
export function setSelection(range) {
  const selection = document.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * Set button expanded state
 * @param {HTMLElement} button - Button element
 * @param {boolean} expanded - Expanded state
 */
export const toggleButton = (button, expanded) => button.setAttribute('aria-expanded', String(expanded))

/**
 * Get all selected nodes
 * @param {Selection} [selection] - Selection to get nodes from
 * @returns {array} Selected nodes
 */
export function getSelectedNodes(selection = document.getSelection()) {
  if (!selection?.rangeCount) return []

  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const parent = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement

  const nodes = []
  const walker = document.createTreeWalker(
    parent,
    NodeFilter.SHOW_ALL,
    { acceptNode: node => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
  )

  let currentNode = walker.currentNode
  while (currentNode) {
    if (range.intersectsNode(currentNode) && currentNode !== container) {
      nodes.push(currentNode)
    }
    currentNode = walker.nextNode()
  }

  return nodes
}

/**
 * Remove all tags within selection range
 * @param {Selection} selection - Selection containing content
 * @param {string} tag - Tag name to remove
 */
export function removeAllInSelection(selection, tag) {
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
    ? range.commonAncestorContainer 
    : range.commonAncestorContainer.parentElement

  const elsToRemove = [...container.querySelectorAll(tag)].filter(el => range.intersectsNode(el))

  if (!elsToRemove.length && container.tagName === tag) {
    removeTag(container)
  } else {
    elsToRemove.forEach(el => {
      if (el.parentElement.classList.contains('wysi-editor')) {
        replaceNode(el, 'p')
      } else removeTag(el)
    })
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy:', err))
    return
  }

  // Fallback for older browsers
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(textarea)
  textarea.select()
  try { document.execCommand('copy') } catch (err) { console.error('Failed to copy:', err) }
  document.body.removeChild(textarea)
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {HTMLElement} editor - Editor element
 */
export function showToast(message, editor) {
  document.querySelector('.wysi-toast')?.remove()

  const toast = document.createElement('div')
  toast.className = 'wysi-toast'
  toast.textContent = message

  const wrapper = editor?.closest('.wysi-wrapper') || editor || document.body
  wrapper.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add('wysi-toast--visible'))

  setTimeout(() => {
    toast.classList.remove('wysi-toast--visible')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}