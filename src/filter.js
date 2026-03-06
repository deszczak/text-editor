import settings from './settings'
import toolset from './toolset'
import { buildFragment } from './utils'
import { blockElements, createElement, replaceNode } from './common'
import { trimText, cloneObject } from './shortcuts'

const STYLE_ATTR = 'style'

/**
 * Enable HTML tags belonging to a set of tools
 * @param {array} tools - Array of tool names
 * @returns {object} Allowed tags
 */
export function enableTags(tools) {
  const allowedTags = cloneObject(settings.allowedTags)

  tools.forEach(toolName => {
    const tool = cloneObject(toolset[toolName])
    if (!tool?.tags) return

    const { tags, extraTags = [], alias = [], attributes = [], styles = [], isEmpty = false } = tool
    const aliasTag = alias.length ? tags[0] : undefined
    const allTags = [...tags, ...extraTags, ...alias]

    allTags.forEach(tag => {
      allowedTags[tag] = { attributes, styles, alias: aliasTag, isEmpty }
      if (!extraTags.includes(tag)) allowedTags[tag].toolName = toolName
    })
  })

  return allowedTags
}

/**
 * Prepare raw content for editing
 * @param {string} content - Raw content
 * @param {object} allowedTags - Allowed tags
 * @param {boolean} filterOnly - Only filter, no cleaning
 * @returns {string} Filtered HTML
 */
export function prepareContent(content, allowedTags, filterOnly = false) {
  const fragment = buildFragment(content)
  filterContent(fragment, allowedTags)

  if (!filterOnly) {
    wrapTextNodes(fragment)
    cleanContent(fragment, allowedTags)
  }

  const container = createElement('div')
  container.appendChild(fragment)
  return container.innerHTML
}

/**
 * Filter unsupported CSS styles from node
 * @param {HTMLElement} node - Element to filter
 * @param {array} allowedStyles - Supported styles
 */
function filterStyles(node, allowedStyles) {
  const styleAttr = node.getAttribute(STYLE_ATTR)
  if (!styleAttr) return

  const styles = styleAttr
    .split(';')
    .map(s => {
      const [name, value] = s.split(':').map(p => p.trim())
      return { name, value }
    })
    .filter(s => allowedStyles.includes(s.name))
    .map(({ name, value }) => `${name}: ${value};`)
    .join('')

  if (styles) node.setAttribute(STYLE_ATTR, styles)
  else node.removeAttribute(STYLE_ATTR)
}

/**
 * Remove unsupported HTML tags and attributes
 * @param {Node} node - Parent element to filter
 * @param {object} allowedTags - Allowed tags
 */
function filterContent(node, allowedTags) {
  for (const child of [...node.childNodes]) {
    // Element nodes
    if (child.nodeType === 1) {
      filterContent(child, allowedTags)

      const tag = child.tagName.toLowerCase()
      const allowedTag = allowedTags[tag]

      if (allowedTag) {
        const { attributes = [], styles = [] } = allowedTag

        for (const attr of [...child.attributes]) {
          if (!attributes.includes(attr.name)) {
            if (attr.name === STYLE_ATTR && styles.length) {
              filterStyles(child, styles)
            } else {
              child.removeAttribute(attr.name)
            }
          }
        }

        if (allowedTag.alias) replaceNode(child, allowedTag.alias, true)
      } else if (tag === 'style') { node.removeChild(child) }
      else { child.replaceWith(...child.childNodes) }
    } else if (child.nodeType === 8) {
      // Remove comment nodes
      node.removeChild(child)
    }
  }
}

/**
 * Remove empty nodes
 * @param {Node} node - Parent element
 * @param {object} allowedTags - Allowed tags
 */
function cleanContent(node, allowedTags) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 1) {
      cleanContent(child, allowedTags)

      const tag = child.tagName.toLowerCase()
      const allowedTag = allowedTags[tag]

      if (allowedTag && !allowedTag.isEmpty && trimText(child.innerHTML) === '') {
        node.removeChild(child)
      }
    }
  }
}

/**
 * Wrap child text nodes in paragraphs
 * @param {Node} node - Parent element
 */
function wrapTextNodes(node) {
  let appendToPrev = false

  for (const child of [...node.childNodes]) {
    if (child.nodeType !== 3 && blockElements.includes(child.tagName)) {
      appendToPrev = false
      continue
    }

    if (trimText(child.textContent) === '') {
      node.removeChild(child)
    } else if (appendToPrev) {
      child.previousElementSibling?.appendChild(child)
    } else {
      replaceNode(child, 'p')
      appendToPrev = true
    }
  }
}