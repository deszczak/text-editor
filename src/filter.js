import settings from './settings'
import toolset from './toolset'
import { buildFragment } from './utils'
import { blockElements, createElement, replaceNode } from './common'
import { trimText, cloneObject } from "./shortcuts"

const STYLE_ATTRIBUTE = 'style'

/**
 * Enable HTML tags belonging to a set of tools.
 * @param {array} tools A array of tool objects.
 * @return {object} The list of allowed tags.
 */
export function enableTags(tools) {
  const allowedTags = cloneObject(settings.allowedTags)

  tools.forEach(toolName => {
    const tool = cloneObject(toolset[toolName]);
    if (!tool || !tool.tags) return

    const isEmpty = !!tool.isEmpty
    const extraTags = tool.extraTags || []
    const aliasList = tool.alias || []
    const alias = aliasList.length ? tool.tags[0] : undefined
    const tags = [...tool.tags, ...extraTags, ...aliasList]
    const attributes = tool.attributes || []
    const styles = tool.styles || []

    tags.forEach(tag => {
      allowedTags[tag] = { attributes, styles, alias, isEmpty }
      if (!extraTags.includes(tag)) allowedTags[tag].toolName = toolName
    })
  })

  return allowedTags
}

/**
 * Prepare raw content for editing.
 * @param {string} content The raw content.
 * @param {array} allowedTags The list of allowed tags.
 * @param {boolean} filterOnly If true, only filter the content, without further cleaning.
 * @return {string} The filtered HTML content.
 */
function prepareContent(content, allowedTags, filterOnly = false) {
  const container = createElement('div')
  const fragment = buildFragment(content)

  filterContent(fragment, allowedTags)

  if (!filterOnly) {
    wrapTextNodes(fragment)
    cleanContent(fragment, allowedTags)
  }

  container.appendChild(fragment)

  return container.innerHTML
}

/**
 * Remove unsupported CSS styles from a node.
 * @param {Node || HTMLElement} node The element to filter.
 * @param {array} allowedStyles An array of supported styles.
 */
function filterStyles(node, allowedStyles) {
  const styleAttribute = node.getAttribute(STYLE_ATTRIBUTE)

  if (styleAttribute) {
    // Parse the styles
    const styles = styleAttribute.split(';').map(s => {
      const prop = s.split(':')
      
      return {
        name: prop[0].trim(),
        value: prop[1].trim()
      }
    })
    // Filter the styles
    .filter(s => allowedStyles.includes(s.name))

    // Convert back to a style string
    .map(({ name, value }) => `${name}: ${value.trim()};`).join('')

    if (styles !== '') node.setAttribute(STYLE_ATTRIBUTE, styles)
    else node.removeAttribute(STYLE_ATTRIBUTE)
  }
}

/**
 * Remove unsupported HTML tags and attributes.
 * @param {Node || HTMLElement} node The parent element to filter recursively.
 * @param {array} allowedTags The list of allowed tags.
 */
function filterContent(node, allowedTags) {
  const children = Array.from(node.childNodes)
  if (!children || !children.length) return

  children.forEach(childNode => {
    // Element nodes
    if (childNode.nodeType === 1) {
      // Filter recursively (deeper nodes first)
      filterContent(childNode, allowedTags)

      // Check if the current element is allowed
      const tag = childNode.tagName.toLowerCase()
      const allowedTag = allowedTags[tag]
      const attributes = Array.from(childNode.attributes)

      if (allowedTag) {
        const allowedAttributes = allowedTag.attributes || []
        const allowedStyles = allowedTag.styles || []

        // Remove attributes that are not allowed
        for (let i = 0; i < attributes.length; i++) {
          const attributeName = attributes[i].name

          if (!allowedAttributes.includes(attributes[i].name)) {
            if (attributeName === STYLE_ATTRIBUTE && allowedStyles.length) {
              filterStyles(childNode, allowedStyles)
            } else childNode.removeAttribute(attributes[i].name)
          }
        }

        // If the tag is an alias, replace it with the standard tag
        // e.g.: <b> tags will be replaced with <strong> tags
        if (allowedTag.alias) replaceNode(childNode, allowedTag.alias, true)
      } else {
        // Remove style nodes
        if (tag === 'style') node.removeChild(childNode)
        // And unwrap the other nodes
        else childNode.replaceWith(...childNode.childNodes)
      }

    // Remove comment nodes
    } else if (childNode.nodeType === 8) node.removeChild(childNode)
  })
}

/**
 * Remove empty nodes.
 * @param {Node} node The parent element to filter recursively.
 * @param {array} allowedTags The list of allowed tags.
 */
function cleanContent(node, allowedTags) {
  const children = Array.from(node.childNodes)
  if (!children || !children.length) return

  children.forEach(childNode => {
    // Remove empty element nodes
    if (childNode.nodeType === 1) {
      // Filter recursively (deeper nodes first)
      cleanContent(childNode, allowedTags)

      // Check if the element can be empty
      const tag = childNode.tagName.toLowerCase()
      const allowedTag = allowedTags[tag]

      if (allowedTag && !allowedTag.isEmpty && trimText(childNode.innerHTML) === '') {
        node.removeChild(childNode)
      }
    }
  })
}

/**
 * Wrap the child text nodes in a paragraph (non-recursively).
 * @param {Node} node The parent element of the text nodes.
 */
function wrapTextNodes(node) {
  const children = Array.from(node.childNodes)
  if (!children || !children.length) return

  let appendToPrev = false

  children.forEach(childNode => {
    if (childNode.nodeType !== 3 && blockElements.includes(childNode.tagName)) {
      appendToPrev = false
      return
    }

    // Remove empty text node
    if (trimText(childNode.textContent) === '') {
      node.removeChild(childNode)
    } else {
      // Wrap the text node in a paragraph
      if (appendToPrev) {
        const prev = childNode.previousElementSibling
        if (prev) prev.appendChild(childNode)
      } else {
        replaceNode(childNode, 'p')
        appendToPrev = true
      }
    }
  })
}

export { prepareContent }