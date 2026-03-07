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
 * Render the toolbar
 * @param {array} tools - List of tools
 * @param {object} customActions - Custom actions
 * @returns {HTMLElement}
 */
export function renderToolbar(tools, customActions = {}) {
  const toolbar = createElement('div', { class: 'wysi-toolbar' })

  tools.forEach(toolName => {
    switch (toolName) {
      case '|':
        toolbar.appendChild(createElement('div', { class: 'wysi-separator' }))
        break
      case '-':
        toolbar.appendChild(createElement('div', { class: 'wysi-newline' }))
        break
      case 'format':
        toolbar.appendChild(renderFormatTool())
        break
      default:
        if (typeof toolName === 'string' && customActions[toolName]) {
          toolbar.appendChild(createElement('button', {
            type: 'button',
            title: customActions[toolName].label,
            'aria-label': customActions[toolName].label,
            'aria-pressed': false,
            'data-custom-action': toolName,
            _innerHTML: customActions[toolName].innerHTML
          }))
        } else if (typeof toolName === 'object' && toolName.items) {
          toolbar.appendChild(renderToolGroup(toolName))
        } else if (typeof toolName === 'string') {
          renderTool(toolName, toolbar)
        }
    }
  })

  return toolbar
}

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

  toolbar.appendChild(tool.hasForm ? renderPopover(name, button) : button)
}

function renderToolGroup({ label = 'Select an item', items }) {
  return renderListBox({
    label,
    items: items.map(action => ({
      label: toolset[action].label,
      icon: action,
      action
    }))
  })
}

function renderFormatTool() {
  return renderListBox({
    label: toolset.format.label,
    classes: 'wysi-format',
    items: toolset.format.tags.map(tag => ({
      name: tag,
      label: tag === 'p' ? toolset.format.paragraph : `${toolset.format.heading} ${tag.slice(1)}`,
      action: 'format'
    }))
  })
}

/**
 * Update toolbar buttons state
 */
function updateToolbarState() {
  const selection = document.getSelection()
  const anchorNode = selection.anchorNode
  if (!anchorNode) return

  const range = selection.getRangeAt(0)
  const candidate = findDeepestChildNode(range.startContainer.nextElementSibling || range.startContainer)
  const selectedNode = range.intersectsNode(candidate) ? candidate : anchorNode

  const { toolbar, editor, nodes } = findInstance(selectedNode)
  if (!editor) return

  const tags = nodes.map(n => n.tagName.toLowerCase())
  const selectedObj = editor.querySelector(`.${selectedClass}`)
  if (selectedObj) tags.push(selectedObj.tagName.toLowerCase())

  const instanceId = getInstanceId(editor)
  const allowedTags = instances[instanceId]?.allowedTags || {}

  // Reset states
  toolbar.querySelectorAll('[aria-pressed="true"]').forEach(btn => btn.setAttribute('aria-pressed', 'false'))
  toolbar.querySelectorAll('.wysi-listbox > div > button:first-of-type').forEach(selectListBoxItem)

  // Update states
  tags.forEach(tag => {
    if (['p', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
      const format = toolbar.querySelector(`[data-action="format"][data-option="${tag}"]`)
      if (format) selectListBoxItem(format)
    } else {
      const action = allowedTags[tag]?.toolName
      if (action) toolbar.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-pressed', 'true')
    }
  })

  // Disable the h1 button if there's already an H1 element in the content
  const h1Button = toolbar.querySelector('[data-action="format"][data-option="h1"]')
  if (h1Button) {
    const hasH1 = editor.querySelector('.wysi-editor h1')
    if (hasH1) h1Button.setAttribute('disabled', '')
    else h1Button.removeAttribute('disabled')
  }
}

/**
 * Embed SVG icons
 */
function embedSVGIcons() {
  const icons = '_SVGIcons_'
  document.body.appendChild(buildFragment(icons))
}

// Event listeners
addListener(document, 'mousedown', '.wysi-editor, .wysi-editor *', () => {
  document.querySelector(`.${selectedClass}`)?.classList.remove(selectedClass)
})

addListener(document, 'mousedown', '.wysi-editor mark', (e) => e.target.classList.add(selectedClass))

addListener(document, 'click', '.wysi-toolbar > button', (e) => {
  const button = e.target
  const state = JSON.parse(button.getAttribute('aria-pressed'))
  const action = button.dataset.action
  const customAction = button.dataset.customAction
  const { editor } = findInstance(button)
  const selection = document.getSelection()

  // Skip buttons inside popovers - those are handled by popover.js
  if (button.closest('.wysi-popover')) return

  if (customAction) {
    const instanceId = getInstanceId(editor)
    const instance = instances[instanceId]
    const actionFn = instance?.customActions?.[customAction]?.action
    if (actionFn) actionFn(editor)
  } else if (action && selection && editor.contains(selection.anchorNode)) {
    execAction(action, editor, { state, selection })
  }
})

addListener(document, 'selectionchange', updateToolbarState)
addListener(document, 'input', '.wysi-editor', updateToolbarState)

DOMReady(embedSVGIcons)