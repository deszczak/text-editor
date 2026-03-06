import window from 'window'
import document from 'document'
import settings from './settings'
import { renderToolbar } from './toolbar'
import { enableTags, prepareContent } from './filter'
import { instances, placeholderClass, headingElements, blockElements, isFirefox } from './common'
import {
  addListener,
  DOMReady,
  findEditorInstances,
  findInstance,
  getInstanceId,
  getTargetElements,
  getTextAreaLabel
} from './utils'
import { createElement } from './common'
import { dispatchEvent, execCommand, hasClass, cloneObject } from './shortcuts'
import { undo, redo, canUndo, canRedo, clearHistory } from './undoRedo'
import { suppressInputEvents } from './commands'

let nextId = 0

/**
 * Init WYSIWYG editor instances
 * @param {object} options - Configuration options
 */
function init(options) {
  const tools = options.tools || settings.tools
  const selector = options.el || settings.el
  const customActions = options.customActions || {}
  const toolbar = renderToolbar(tools, customActions)
  const allowedTags = enableTags(tools)

  getTargetElements(selector).forEach(field => {
    const sibling = field.previousElementSibling

    if (!sibling || !hasClass(sibling, 'wysi-wrapper')) {
      const instanceId = String(nextId++)
      instances[instanceId] = options
      instances[instanceId].allowedTags = cloneObject(allowedTags)

      const wrapper = createElement('div', { class: 'wysi-wrapper' })
      const editor = createElement('div', {
        class: 'wysi-editor',
        contenteditable: true,
        role: 'textbox',
        'aria-multiline': true,
        'aria-label': getTextAreaLabel(field),
        'data-wid': instanceId,
        _innerHTML: prepareContent(field.value, allowedTags)
      })

      wrapper.append(toolbar.cloneNode(true), editor)
      field.before(wrapper)
      configure(wrapper, options)
    } else configure(sibling, options)
  })
}

/**
 * Configure editor instance
 * @param {HTMLElement} instance - Editor wrapper
 * @param {object} options - Configuration options
 */
function configure(instance, options) {
  if (typeof options !== 'object') return

  for (const [key, val] of Object.entries(options)) {
    switch (key) {
      case 'autoGrow':
      case 'autoHide':
        instance.classList.toggle(`wysi-${key.toLowerCase()}`, !!val)
        break
      case 'height':
        if (!isNaN(val)) {
          const editor = instance.lastElementChild
          editor.style.minHeight = `${val}px`
          editor.style.maxHeight = `${val}px`
        }
        break
    }
  }
}

/**
 * Update editor content
 * @param {HTMLElement} textarea - Textarea element
 * @param {HTMLElement} editor - Editor element
 * @param {string} instanceId - Instance ID
 * @param {string} rawContent - New content
 * @param {boolean} setEditorContent - Update editor content
 */
function updateContent(textarea, editor, instanceId, rawContent, setEditorContent = false) {
  const instance = instances[instanceId]
  const content = prepareContent(rawContent, instance.allowedTags)

  if (setEditorContent) editor.innerHTML = content
  textarea.value = content
  dispatchEvent(textarea, 'change')
  instance.onChange?.(content)
}

/**
 * Destroy editor instance
 * @param {string} selector - Textarea selectors
 */
function destroy(selector) {
  findEditorInstances(selector).forEach(({ instanceId, wrapper, editor }) => {
    delete instances[instanceId]
    clearHistory(editor)
    wrapper.remove()
  })
}

/**
 * Set editor content programmatically
 * @param {string} selector - Textarea selectors
 * @param {string} content - New content
 */
function setContent(selector, content) {
  findEditorInstances(selector).forEach(({ textarea, editor, instanceId }) => {
    updateContent(textarea, editor, instanceId, content, true)
    clearHistory(editor)
  })
}

/**
 * Clean up pasted content
 * @param {object} event - Paste event
 */
function cleanPastedContent(event) {
  const { editor, nodes } = findInstance(event.target)
  const clipboardData = event.clipboardData

  if (!editor || !clipboardData.types.includes('text/html')) return

  const instanceId = getInstanceId(editor)
  const allowedTags = instances[instanceId].allowedTags
  let pastedContent = prepareContent(clipboardData.getData('text/html'), allowedTags)

  const splitHeadingTag = nodes.some(n => headingElements.includes(n.tagName))

  if (splitHeadingTag && !isFirefox) {
    const splitter = `<h1 class="${placeholderClass}"><br></h1><p class="${placeholderClass}"><br></p>`
    pastedContent = splitter + pastedContent + splitter
  }

  execCommand('insertHTML', pastedContent)
  event.preventDefault()

  if (splitHeadingTag && !isFirefox) {
    editor.querySelectorAll(`.${placeholderClass}`).forEach(el => el.remove())
    editor.querySelectorAll(headingElements.join()).forEach(heading => {
      const firstChild = heading.firstElementChild
      if (firstChild && blockElements.includes(firstChild.tagName)) {
        heading.replaceWith(...heading.childNodes)
      }
    })
  }
}

/**
 * Bootstrap the editor
 */
function bootstrap() {
  ['styleWithCSS', 'enableObjectResizing', 'enableInlineTableEditing']
    .forEach(cmd => execCommand(cmd, false))
  execCommand('defaultParagraphSeparator', 'p')

  // Input handler
  addListener(document, 'input', '.wysi-editor', (e) => {
    const editor = e.target
    if (suppressInputEvents.has(editor)) return

    const textarea = editor.parentNode.nextElementSibling
    updateContent(textarea, editor, getInstanceId(editor), editor.innerHTML)
  })

  // Paste handler
  addListener(document, 'paste', cleanPastedContent)

  // Keyboard shortcuts
  addListener(document, 'keydown', (e) => {
    if (!e.target.closest?.('.wysi-editor')) return

    const { editor } = findInstance(e.target)
    if (!editor) return

    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey
    const key = e.key.toLowerCase()

    if (isCtrl && key === 'z' && !isShift && canUndo(editor)) {
      e.preventDefault()
      undo(editor)
    } else if ((isCtrl && key === 'y') || (isCtrl && isShift && key === 'z') && canRedo(editor)) {
      e.preventDefault()
      redo(editor)
    }
  })
}

// Expose Wysi to global scope
window.Wysi = (() => {
  const Wysi = (options) => DOMReady(() => init(options || {}))
  
  Object.entries({ destroy, setContent }).forEach(([key, fn]) => {
    Wysi[key] = (...args) => DOMReady(fn, args)
  })

  return Wysi
})()

DOMReady(bootstrap)