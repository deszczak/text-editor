import document from 'document'
import { execAction } from './commands'
import { addListener, findInstance, toggleButton } from './utils'
import { createElement } from './common'

/**
 * Render a list box
 * @param {object} details - List box properties
 * @returns {HTMLElement}
 */
function renderListBox({ label, items, classes = [] }) {
  const classList = Array.isArray(classes) ? classes : [classes]
  const listBox = createElement('div', { class: ['wysi-listbox', ...classList].join(' ') })
  
  const button = createElement('button', {
    type: 'button',
    title: label,
    'aria-label': `${label} ${items[0].label}`,
    'aria-haspopup': 'listbox',
    'aria-expanded': false,
    _innerHTML: renderListBoxItem(items[0])
  })

  const menu = createElement('div', { role: 'listbox', tabindex: -1, 'aria-label': label })

  items.forEach(item => {
    menu.appendChild(createElement('button', {
      type: 'button',
      role: 'option',
      tabindex: -1,
      'aria-label': item.label,
      'aria-selected': false,
      'data-action': item.action,
      'data-option': item.name || '',
      _innerHTML: renderListBoxItem(item)
    }))
  })

  listBox.append(button, menu)
  return listBox
}

const renderListBoxItem = (item) => item.icon ? `<svg><use href="#wysi-${item.icon}"></use></svg>` : item.label

const openListBox = (button) => {
  const isOpen = button.getAttribute('aria-expanded') === 'true'
  const selectedItem = button.nextElementSibling.querySelector('[aria-selected="true"]') || button.nextElementSibling.firstElementChild
  toggleButton(button, !isOpen)
  selectedItem.focus()
}

export function selectListBoxItem(item) {
  const listBox = item.parentNode
  const button = listBox.previousElementSibling
  
  listBox.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false')
  item.setAttribute('aria-selected', 'true')
  button.innerHTML = item.innerHTML
}

const closeListBox = () => {
  document.querySelector('.wysi-listbox [aria-expanded="true"]')?.setAttribute('aria-expanded', 'false')
}

// Event listeners
addListener(document, 'click', '.wysi-listbox > button', (e) => {
  closeListBox()
  openListBox(e.target)
})

addListener(document, 'keydown', '.wysi-listbox > button', (e) => {
  if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) {
    openListBox(e.target)
    e.preventDefault()
  }
})

addListener(document.documentElement, 'mousemove', '.wysi-listbox > div > button', (e) => e.target.focus())

addListener(document, 'click', '.wysi-listbox > div > button', (e) => {
  const item = e.target
  const { editor } = findInstance(item)
  const selection = document.getSelection()

  if (selection && editor.contains(selection.anchorNode)) {
    execAction(item.dataset.action, editor, [item.dataset.option])
  }
  selectListBoxItem(item)
})

addListener(document, 'keydown', '.wysi-listbox > div > button', (e) => {
  const item = e.target
  const listBox = item.parentNode
  const button = listBox.previousElementSibling

  const handlers = {
    ArrowUp: () => item.previousElementSibling?.focus(),
    ArrowDown: () => item.nextElementSibling?.focus(),
    Home: () => listBox.firstElementChild.focus(),
    End: () => listBox.lastElementChild.focus(),
    Tab: () => item.click(),
    Escape: () => toggleButton(button, false)
  }

  if (handlers[e.key]) {
    handlers[e.key]()
    e.preventDefault()
    if (e.key !== 'Tab') e.stopImmediatePropagation()
  }
})

// Prevent closing immediately after opening
let isOpeningInProgress = false
addListener(document, 'click', () => { if (!isOpeningInProgress) closeListBox() })
addListener(document, 'mousedown', '.wysi-listbox > button', () => isOpeningInProgress = true)
addListener(document, 'mouseup', () => setTimeout(() => isOpeningInProgress = false))

export { renderListBox }