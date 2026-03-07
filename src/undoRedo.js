import document from 'document'
import { showToast, getInstanceId } from "./utils"

const MAX_HISTORY = 20
const undoStack = new Map()
const redoStack = new Map()

const createState = (editor) => ({
  html: editor.innerHTML,
  selection: saveSelection(editor)
})

const pushState = (stack, instanceId, state) => {
  const states = stack.get(instanceId) || []
  states.push(state)
  if (states.length > MAX_HISTORY) states.shift()
  stack.set(instanceId, states)
}

const popState = (stack, instanceId) => {
  const states = stack.get(instanceId)
  return states?.pop()
}

export function saveState(editor) {
  const instanceId = getInstanceId(editor)
  if (!instanceId) return
  pushState(undoStack, instanceId, createState(editor))
  redoStack.delete(instanceId)
}

export function undo(editor) {
  const instanceId = getInstanceId(editor)
  if (!instanceId) return false

  const prevState = popState(undoStack, instanceId)
  if (!prevState) return false

  pushState(redoStack, instanceId, createState(editor))
  editor.innerHTML = prevState.html
  restoreSelection(editor, prevState.selection)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  showToast('Undo', editor)
  return true
}

export function redo(editor) {
  const instanceId = getInstanceId(editor)
  if (!instanceId) return false

  const nextState = popState(redoStack, instanceId)
  if (!nextState) return false

  pushState(undoStack, instanceId, createState(editor))
  editor.innerHTML = nextState.html
  restoreSelection(editor, nextState.selection)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  showToast('Redo', editor)
  return true
}

export const canUndo = (editor) => {
  const instanceId = getInstanceId(editor)
  return instanceId ? (undoStack.get(instanceId)?.length > 0) : false
}

export const canRedo = (editor) => {
  const instanceId = getInstanceId(editor)
  return instanceId ? (redoStack.get(instanceId)?.length > 0) : false
}

export function clearHistory(editor) {
  const instanceId = getInstanceId(editor)
  if (instanceId) {
    undoStack.delete(instanceId)
    redoStack.delete(instanceId)
  }
}

function saveSelection(editor) {
  const selection = document.getSelection()
  if (!selection?.rangeCount) return null

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null

  return {
    startContainer: getNodePath(editor, range.startContainer),
    startOffset: range.startOffset,
    endContainer: getNodePath(editor, range.endContainer),
    endOffset: range.endOffset
  }
}

function restoreSelection(editor, saved) {
  if (!saved) return
  try {
    const start = getNodeFromPath(editor, saved.startContainer)
    const end = getNodeFromPath(editor, saved.endContainer)
    if (!start || !end) return

    const range = document.createRange()
    range.setStart(start, saved.startOffset)
    range.setEnd(end, saved.endOffset)

    const selection = document.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    editor.focus()
  }
}

function getNodePath(root, node) {
  const path = []
  let current = node

  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) break
    path.unshift([...parent.childNodes].indexOf(current))
    current = parent
  }

  return path
}

function getNodeFromPath(root, path) {
  return path.reduce((current, index) => current?.childNodes?.[index], root) || null
}