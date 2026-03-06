import toolset from './toolset'
import {
  restoreCurrentSelection,
  restoreMarkerSelection,
  removeTag,
  placeSelectionMarkers,
  getNewMarkerReferences,
  getSelectedNodes,
  removeAllInSelection,
  copyToClipboard,
  showToast
} from './utils'
import { dispatchEvent, execCommand } from './shortcuts'
import { replaceNode, selectedClass } from './common'
import { formatTextNodes } from './autoFormat'
import { htmlToMarkdown } from './markdown'
import { saveState } from './undoRedo'

export const suppressInputEvents = new WeakSet()

export function execAction(action, editor, options) {
  const tool = toolset[action]
  if (!tool) return

  restoreCurrentSelection()
  saveState(editor)
  execEditorCommand(editor, tool.command || action, options)
  editor.normalize()
  editor.focus()
}

export function execEditorCommand(editor, command, options) {
  if (command === 'format' && Array.isArray(options)) {
    execCommand('formatBlock', `<${options[0]}>`)
    return
  }

  if (command === 'link' && Array.isArray(options)) {
    const [url, target = '', text] = options
    if (text) {
      const targetAttr = target ? ` target="${target}"` : ''
      execCommand('insertHTML', `<a href="${url}"${targetAttr}>${text}</a>`)
    }
    return
  }

  if (command === 'autoFormat') {
    const sel = document.getSelection()
    let container = sel.rangeCount && !sel.isCollapsed
      ? sel.getRangeAt(0).commonAncestorContainer
      : null
    if (container && container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement

    formatTextNodes(container || editor)
    dispatchEvent(editor, 'input')
    showToast('Formatted Text', editor)
    return
  }

  if (command === 'markdownExport') {
    if (!editor) return
    copyToClipboard(htmlToMarkdown(editor))
    showToast('Markdown copied to clipboard', editor)
    return
  }

  if (command === 'removeFormat') {
    execCommand(command)
    if (editor && options && options.selection && options.selection.type === 'Range') {
      showToast('Formatting removed', editor)
    }
    return
  }

  if (command === 'quote') {
    if (options && options.state) revertState(editor, command, options.selection)
    else execCommand('formatBlock', '<blockquote>')
    return
  }

  if (command === 'insertHorizontalRule') {
    if (options && options.state) {
      revertState(editor, 'hr', options.selection)
    } else execCommand(command)
    return
  }

  if (command === 'highlight') {
    if (options && options.state) {
      revertState(editor, command, options.selection)
    } else {
      const markers = placeSelectionMarkers(options.selection)
      suppressInputEvents.add(editor)
      execCommand('hiliteColor', '#ffff00')
      suppressInputEvents.delete(editor)
      getSelectedNodes().forEach(n => {
        if (n.tagName === 'SPAN') replaceNode(n, 'mark').classList.add(selectedClass)
      })
      restoreMarkerSelection(getNewMarkerReferences(markers))
      dispatchEvent(editor, 'input')
    }
    return
  }

  execCommand(command)
}

export function revertState(editor, command, selection) {
  const anchor = selection.anchorNode
  const elementToModify = anchor.tagName ? anchor : anchor.parentNode
  const markers = placeSelectionMarkers()

  if (command === 'highlight') removeAllInSelection(selection, 'MARK')
  else if (command === 'quote') removeAllInSelection(selection, 'BLOCKQUOTE')
  else if (command === 'hr') removeTag(elementToModify)

  restoreMarkerSelection(getNewMarkerReferences(markers))
  dispatchEvent(editor, 'input')
}