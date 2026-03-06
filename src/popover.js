import document from 'document'
import toolset from './toolset'
import { selectedClass } from './common'
import { execAction } from './commands'
import {
  addListener,
  findInstance,
  getCurrentSelection,
  getFragmentContent,
  restoreCurrentSelection,
  setCurrentSelection,
  toggleButton
} from './utils'
import { createElement } from './common'

let uniqueFieldId = 0

/**
 * Render a popover form for tool parameters
 * @param {string} toolName - Tool name
 * @param {HTMLElement} button - Toolbar button
 * @returns {HTMLElement}
 */
export function renderPopover(toolName, button) {
  const tool = toolset[toolName]
  const fields = tool.attributes.map((attr, i) => ({ name: attr, label: tool.attributeLabels[i] }))

  const wrapper = createElement('div', { class: 'wysi-popover' })
  const popover = createElement('div', { tabindex: -1 })

  button.setAttribute('aria-haspopup', 'true')
  button.setAttribute('aria-expanded', 'false')

  wrapper.append(button, popover)

  // Add regular fields
  fields.forEach(field => {
    if (toolName === 'link' && field.name === 'target') return
    
    popover.appendChild(createElement('label', {
      _innerHTML: `<span>${field.label}</span><input type="text" name="wysi-${field.name}" data-attribute="${field.name}">`
    }))
  })

  // Link-specific fields
  if (toolName === 'link') {
    const targetField = fields.find(f => f.name === 'target')
    if (targetField) {
      targetField.toolName = toolName
      targetField.options = tool.formOptions?.target || []
      popover.append(
        createElement('span', { _textContent: targetField.label }),
        renderSegmentedField(targetField)
      )
    }

    const unlinkLabel = toolset.unlink.label
    popover.appendChild(createElement('button', {
      type: 'button',
      title: unlinkLabel,
      'aria-label': unlinkLabel,
      'data-action': 'unlink',
      _innerHTML: `<svg><use href="#wysi-delete"></use></svg>`
    }))
  }

  // Image-specific fields
  if (toolName === 'image') {
    tool.extraSettings.forEach((setting, i) => {
      const field = {
        name: setting,
        label: tool.extraSettingLabels[i],
        toolName,
        options: tool.formOptions?.[setting] || []
      }
      popover.append(
        createElement('span', { _textContent: field.label }),
        renderSegmentedField(field)
      )
    })
  }

  popover.append(
    createElement('button', { type: 'button', _textContent: 'Cancel' }),
    createElement('button', { type: 'button', 'data-action': toolName, _textContent: 'Save' })
  )

  return wrapper
}

/**
 * Render a segmented form field
 * @param {object} field - Field attributes
 * @returns {HTMLElement}
 */
function renderSegmentedField(field) {
  const fieldId = uniqueFieldId++
  const segmented = createElement('fieldset', { class: 'wysi-segmented' })
  segmented.appendChild(createElement('legend', { _textContent: field.label }))

  field.options.forEach(option => {
    const segmentId = uniqueFieldId++
    segmented.append(
      createElement('input', {
        id: `wysi-seg-${segmentId}`,
        name: `wysi-${field.toolName}-${field.name}-${fieldId}`,
        type: 'radio',
        'data-attribute': field.name,
        value: option.value
      }),
      createElement('label', { for: `wysi-seg-${segmentId}`, _textContent: option.label })
    )
  })

  return segmented
}

/**
 * Open a popover
 * @param {HTMLElement} button - Popover button
 */
function openPopover(button) {
  const popoverContent = button.nextElementSibling
  const inputs = popoverContent.querySelectorAll('input[type="text"]')
  const radioButtons = popoverContent.querySelectorAll('input[type="radio"]')
  const selection = document.getSelection()
  const anchorNode = selection.anchorNode
  const { editor, nodes } = findInstance(anchorNode)
  const values = {}

  if (editor) {
    const action = button.dataset.action
    const tool = toolset[action]
    let target = editor.querySelector(`.${selectedClass}`)
    let selectContents = false

    if (!target) {
      target = nodes.find(node => tool.tags.includes(node.tagName.toLowerCase()))
      selectContents = true
    }

    if (target) {
      const range = document.createRange()
      selectContents ? range.selectNodeContents(target) : range.selectNode(target)
      setCurrentSelection(range)

      tool.attributes.forEach(attr => values[attr] = target.getAttribute(attr))

      tool.extraSettings?.forEach(setting => {
        tool.formOptions[setting]?.forEach(option => {
          if (!option.criterion) return
          const [key, value] = Object.entries(option.criterion)[0]
          if (target.style[key] === value) {
            values[setting] = option.value
          }
        })
      })
    } else if (selection && editor.contains(anchorNode) && selection.rangeCount) {
      setCurrentSelection(selection.getRangeAt(0))
    }
  }

  inputs.forEach(input => input.value = values[input.dataset.attribute] || '')
  radioButtons.forEach(radio => radio.checked = radio.value === (values[radio.dataset.attribute] || ''))

  toggleButton(button, true)
  inputs[0]?.focus()
}

/**
 * Execute popover action
 * @param {HTMLElement} button - Action button
 */
function execPopoverAction(button) {
  const action = button.dataset.action
  const selection = getCurrentSelection()
  const parent = button.parentNode
  const inputs = parent.querySelectorAll('input[type="text"]')
  const radioButtons = parent.querySelectorAll('input[type="radio"]')
  const { editor } = findInstance(button)
  const options = []

  inputs.forEach(input => options.push(input.value))
  radioButtons.forEach(radio => { if (radio.checked) options.push(radio.value) })

  if (action === 'image') {
    const selected = editor?.querySelector(`.${selectedClass}`)
    if (selected?.parentNode?.tagName === 'A') options.push(selected.parentNode.outerHTML)
  } else if (action === 'link' && selection) {
    options.push(getFragmentContent(selection.cloneContents()))
  }

  execAction(action, editor, options)
}

const closePopover = (ignoreSelection = true) => {
  document.querySelector('.wysi-popover [aria-expanded="true"]')?.setAttribute('aria-expanded', 'false')
  if (!ignoreSelection) restoreCurrentSelection()
}

// Event listeners
addListener(document, 'click', '.wysi-popover > button', (e) => {
  e.stopPropagation()
  e.stopImmediatePropagation()
  closePopover()
  popoverJustOpened = true
  openPopover(e.target)
})

addListener(document, 'keydown', '.wysi-popover > button', (e) => {
  if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) {
    openPopover(e.target)
    e.preventDefault()
  }
})

addListener(document, 'click', '.wysi-popover > div > button[data-action]', (e) => {
  execPopoverAction(e.target)
  closePopover(true)
})

addListener(document, 'click', '.wysi-popover > div > button:not([data-action])', () => closePopover())

addListener(document, 'click', '.wysi-popover *:not(button)', (e) => e.stopImmediatePropagation())

addListener(document, 'keydown', '.wysi-popover *', (e) => {
  const { target } = e
  const form = target.parentNode.tagName === 'DIV' ? target.parentNode : target.parentNode.parentNode

  switch (e.key) {
    case 'Tab':
      const firstField = form.querySelector('input')
      const lastField = !target.nextElementSibling && !target.parentNode.nextElementSibling
      
      if (e.shiftKey && target === firstField) {
        form.lastElementChild.focus()
        e.preventDefault()
      } else if (!e.shiftKey && lastField) {
        firstField.focus()
        e.preventDefault()
      }
      break
    case 'Enter':
      if (target.tagName === 'INPUT') {
        form.querySelector('[data-action]:last-of-type').click()
        e.preventDefault()
      }
      break
    case 'Escape':
      closePopover()
      e.stopImmediatePropagation()
      break
  }
})

let isSelectionInProgress = false
let popoverJustOpened = false
addListener(document, 'click', () => {
  if (!isSelectionInProgress && !popoverJustOpened) closePopover()
  popoverJustOpened = false
})