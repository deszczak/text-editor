import document from 'document'
import toolset from './toolset'
import { renderPopover } from './popover'
import { renderListBox, selectListBoxItem } from './listbox'
import { instances, selectedClass } from './common'
import { execAction } from './commands'
import {
  addListener,
  buildFragment,
  DOMReady,
  findDeepestChildNode,
  findInstance,
  getInstanceId
} from './utils'
import { createElement } from './common'

/**
 * Render the toolbar.
 * @param {array} tools The list of tools in the toolbar.
 * @param {object} customActions Custom actions to add to the toolbar.
 * @return {string} The toolbars HTML string.
 */
function renderToolbar(tools, customActions = {}) {
  const toolbar = createElement('div', { class: 'wysi-toolbar' })

  // Generate toolbar buttons
  tools.forEach(toolName => {
    switch (toolName) {
      // Toolbar separator
      case '|':
        toolbar.appendChild(createElement('div', { class: 'wysi-separator' }))
        break

      // Toolbar new line
      case '-':
        toolbar.appendChild(createElement('div', { class: 'wysi-newline' }))
        break

      // The format tool renders as a list box
      case 'format':
        toolbar.appendChild(renderFormatTool())
        break

      // Custom action (string reference to customActions)
      default:
        if (typeof toolName === 'string' && customActions[toolName]) {
          const customAction = customActions[toolName]
          const button = createElement('button', {
            type: 'button',
            title: customAction.label,
            'aria-label': customAction.label,
            'aria-pressed': false,
            'data-custom-action': toolName,
            _innerHTML: customAction.innerHTML
          })
          toolbar.appendChild(button)
        } else if (typeof toolName === 'object' && toolName.items) {
          // Tool group
          toolbar.appendChild(renderToolGroup(toolName))
        } else if (typeof toolName === 'string') {
          // Standard tool
          renderTool(toolName, toolbar)
        }
    }
  })

  return toolbar
}

/**
 * Render a tool.
 * @param {string} name The tool's name.
 * @param {HTMLElement} toolbar The toolbar to which the tool will be appended.
 */
function renderTool(name, toolbar) {
  const tool = toolset[name]
  const button = createElement('button', {
    type: 'button',
    title: tool.label,
    'aria-label': tool.label,
    'aria-pressed': false,
    'data-action': name,
    _innerHTML: `<svg><use href="#wysi-${name}"></use></svg>`
  })

  // Tools that require parameters (e.g.: link) need a popover
  if (tool.hasForm) {
    const popover = renderPopover(name, button)
    toolbar.appendChild(popover)

  // The other tools only display a button
  } else toolbar.appendChild(button)
}

/**
 * Render a tool group.
 * @param {object} details The group's properties.
 * @return {HTMLElement} A DOM element containing the tool group.
 */
function renderToolGroup(details) {
  const label = details.label || 'Select an item'
  const options = details.items

  const items = options.map(option => {
    const tool = toolset[option]
    const label = tool.label
    const icon = option
    const action = option

    return { label, icon, action }
  })

  return renderListBox({ label, items })
}

/**
 * Render format tool.
 * @return {HTMLElement} A DOM element containing the format tool.
 */
function renderFormatTool() {
  const label = toolset.format.label
  const paragraphLabel = toolset.format.paragraph
  const headingLabel = toolset.format.heading
  const classes = 'wysi-format'
  const items = toolset.format.tags.map(tag => { 
    const name = tag
    const label = tag === 'p' ? paragraphLabel : `${headingLabel} ${tag.substring(1)}`
    const action = 'format'

    return { name, label, action }
  })

  return renderListBox({ label, items, classes })
}

/**
 * Update toolbar buttons state.
 */
function updateToolbarState() {
  const selection = document.getSelection()
  const anchorNode = selection.anchorNode
  if (!anchorNode) return

  const range = selection.getRangeAt(0)

  // This is to fix double click selection on Firefox not highlighting the relevant tool in some cases
  // We want to find the deepest child node to properly handle nested styles
  const candidateNode = findDeepestChildNode(range.startContainer.nextElementSibling || range.startContainer)

  // Fallback to the original selection.anchorNode if a more suitable node is not found
  const selectedNode = range.intersectsNode(candidateNode) ? candidateNode : anchorNode

  // Get an editor instance
  const { toolbar, editor, nodes } = findInstance(selectedNode)
  const tags = nodes.map(node => node.tagName.toLowerCase())

  // Abort if the selection is not within an editor instance
  if (!editor) return

  // Check for an element with the selection class (likely a highlight)
  const selectedObject = editor.querySelector(`.${selectedClass}`)

  // If such an element exists, add its tag to the list of active tags
  if (selectedObject) tags.push(selectedObject.tagName.toLowerCase())

  // Get the list of allowed tags in the current editor instance
  const instanceId = getInstanceId(editor)
  const allowedTags = instances[instanceId].allowedTags

  // Reset the state of all buttons
  toolbar.querySelectorAll('[aria-pressed="true"]').forEach(button => button.setAttribute('aria-pressed', 'false'))

  // Reset the state of all list boxes
  toolbar.querySelectorAll('.wysi-listbox > div > button:first-of-type').forEach(button => selectListBoxItem(button))

  // Update the buttons states
  tags.forEach(tag => {
    switch (tag) {
      case 'p':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'li':
        const format = toolbar.querySelector(`[data-action="format"][data-option="${tag}"]`)
        if (format) selectListBoxItem(format)
        break
      default:
        const allowedTag = allowedTags[tag]
        const action = allowedTag ? allowedTag.toolName : undefined

        if (action) {
          const button = toolbar.querySelector(`[data-action="${action}"]`)
          button.setAttribute('aria-pressed', 'true')
        }
    }    
  })
}

/**
 * Embed SVG icons in the HTML document.
 */
function embedSVGIcons() {
  // The icons will be included during the build process
  const icons = '_SVGIcons_'
  const svgElement = buildFragment(icons)

  document.body.appendChild(svgElement)
}

// Deselect the selected element when clicking outside
addListener(document, 'mousedown', '.wysi-editor, .wysi-editor *', event => {
  const selected = document.querySelector(`.${selectedClass}`)
  if (selected && selected !== event.target) selected.classList.remove(selectedClass)
})

// "Select" a highlight when it's clicked
addListener(document, 'mousedown', '.wysi-editor mark', event => {
  const highlight = event.target
  highlight.classList.add(selectedClass)
})

// Toolbar button click
addListener(document, 'click', '.wysi-toolbar > button', event => {
  const button = event.target
  const state = JSON.parse(button.getAttribute('aria-pressed'))
  const action = button.dataset.action
  const customAction = button.dataset.customAction
  const { editor } = findInstance(button)
  const selection = document.getSelection()

  if (customAction) {
    // Execute custom action
    const instanceId = getInstanceId(editor)
    const instance = instances[instanceId]
    const customActions = instance.customActions || {}
    if (customActions[customAction] && customActions[customAction].action) {
      customActions[customAction].action(editor)
    }
  } else if (action && selection && editor.contains(selection.anchorNode)) {
    execAction(action, editor, { state, selection })
  }
})

// Update the toolbar buttons state
addListener(document, 'selectionchange', updateToolbarState)
addListener(document, 'input', '.wysi-editor', updateToolbarState)

// include SVG icons
DOMReady(embedSVGIcons)

export { renderToolbar }