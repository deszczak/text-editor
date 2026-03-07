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

  const menu = createElement('div', { role: 'listbox', 'aria-label': label })

  items.forEach(item => {
    menu.appendChild(createElement('button', {
      type: 'button',
      role: 'option',
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
  e.target.getAttribute('aria-expanded') === 'true' ? closeListBox() : openListBox(e.target)
})

addListener(document, 'click', '.wysi-listbox > div > button', (e) => {
  const item = e.target
  if (item.hasAttribute('disabled')) return
  
  const { editor } = findInstance(item)
  const selection = document.getSelection()

  if (selection && editor.contains(selection.anchorNode)) {
    execAction(item.dataset.action, editor, [item.dataset.option])
  }
  selectListBoxItem(item)
  closeListBox()
})

addListener(document, 'click', (e) => { if (!e.target.closest('.wysi-listbox')) closeListBox() })

addListener(document, 'keydown', (e) => {
  const listBox = document.querySelector('.wysi-listbox:has([aria-expanded="true"]) > [role="listbox"]')
  if (listBox && e.target === listBox.lastElementChild && !e.shiftKey) closeListBox()
})

export { renderListBox }