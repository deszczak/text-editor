import document from 'document'

// Maximum number of undo/redo steps to keep
const MAX_HISTORY_SIZE = 20

// Store undo/redo state for each editor instance (now arrays for multiple steps)
const undoStack = new Map()
const redoStack = new Map()

/**
 * Save the current state of an editor for undo functionality.
 * @param {HTMLElement} editor The editor element.
 */
export function saveState(editor) {
  if (!editor) return

  const instanceId = editor.dataset.wid
  if (!instanceId) return

  // Get or create the undo stack for this instance
  let stack = undoStack.get(instanceId)
  if (!stack) {
    stack = []
    undoStack.set(instanceId, stack)
  }

  // Save the current state
  const state = {
    html: editor.innerHTML,
    selection: saveSelection(editor)
  }

  // Add to stack, limiting size
  stack.push(state)
  if (stack.length > MAX_HISTORY_SIZE) stack.shift() // Remove oldest state

  // Clear the redo stack when a new action is performed
  redoStack.delete(instanceId)
}

/**
 * Undo the last action for an editor.
 * @param {HTMLElement} editor The editor element.
 * @returns {boolean} True if undo was performed, false otherwise.
 */
export function undo(editor) {
  if (!editor) return false

  const instanceId = editor.dataset.wid
  if (!instanceId) return false

  const undoStates = undoStack.get(instanceId)
  if (!undoStates || undoStates.length === 0) return false

  // Get or create the redo stack for this instance
  let redoStates = redoStack.get(instanceId)
  if (!redoStates) {
    redoStates = []
    redoStack.set(instanceId, redoStates)
  }

  // Save the current state to redo stack
  const currentState = {
    html: editor.innerHTML,
    selection: saveSelection(editor)
  }
  redoStates.push(currentState)
  if (redoStates.length > MAX_HISTORY_SIZE) redoStates.shift()

  // Restore the previous state from the undo stack
  const previousState = undoStates.pop()
  editor.innerHTML = previousState.html
  restoreSelection(editor, previousState.selection)

  // Dispatch input event to update the textarea and toolbar
  editor.dispatchEvent(new Event('input', { bubbles: true }))

  return true
}

/**
 * Redo the last undone action for an editor.
 * @param {HTMLElement} editor The editor element.
 * @returns {boolean} True if redo was performed, false otherwise.
 */
export function redo(editor) {
  if (!editor) return false

  const instanceId = editor.dataset.wid
  if (!instanceId) return false

  const redoStates = redoStack.get(instanceId)
  if (!redoStates || redoStates.length === 0) return false

  // Get or create the undo stack for this instance
  let undoStates = undoStack.get(instanceId)
  if (!undoStates) {
    undoStates = []
    undoStack.set(instanceId, undoStates)
  }

  // Save the current state to undo the stack
  const currentState = {
    html: editor.innerHTML,
    selection: saveSelection(editor)
  }
  undoStates.push(currentState)
  if (undoStates.length > MAX_HISTORY_SIZE) undoStates.shift()

  // Restore the next state from the redo stack
  const nextState = redoStates.pop()
  editor.innerHTML = nextState.html
  restoreSelection(editor, nextState.selection)

  // Dispatch input event to update the textarea and toolbar
  editor.dispatchEvent(new Event('input', { bubbles: true }))

  return true
}

/**
 * Check if undo is available for an editor.
 * @param {HTMLElement} editor The editor element.
 * @returns {boolean} True if undo is available.
 */
export function canUndo(editor) {
  if (!editor) return false
  const instanceId = editor.dataset.wid
  if (!instanceId) return false
  const stack = undoStack.get(instanceId)
  return stack && stack.length > 0
}

/**
 * Check if redo is available for an editor.
 * @param {HTMLElement} editor The editor element.
 * @returns {boolean} True if redo is available.
 */
export function canRedo(editor) {
  if (!editor) return false
  const instanceId = editor.dataset.wid
  if (!instanceId) return false
  const stack = redoStack.get(instanceId)
  return stack && stack.length > 0
}

/**
 * Clear undo/redo stacks for an editor.
 * @param {HTMLElement} editor The editor element.
 */
export function clearHistory(editor) {
  if (!editor) return
  const instanceId = editor.dataset.wid
  if (instanceId) {
    undoStack.delete(instanceId)
    redoStack.delete(instanceId)
  }
}

/**
 * Save the current selection in an editor.
 * @param {HTMLElement} editor The editor element.
 * @returns {object|null} Selection state object or null.
 */
function saveSelection(editor) {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)

  // Check if the selection is within the editor
  if (!editor.contains(range.commonAncestorContainer)) return null

  return {
    startContainer: getNodePath(editor, range.startContainer),
    startOffset: range.startOffset,
    endContainer: getNodePath(editor, range.endContainer),
    endOffset: range.endOffset
  }
}

/**
 * Restore a saved selection in an editor.
 * @param {HTMLElement} editor The editor element.
 * @param {object} savedSelection The saved selection state.
 */
function restoreSelection(editor, savedSelection) {
  if (!savedSelection) return

  try {
    const startContainer = getNodeFromPath(editor, savedSelection.startContainer)
    const endContainer = getNodeFromPath(editor, savedSelection.endContainer)

    if (!startContainer || !endContainer) return

    const range = document.createRange()
    range.setStart(startContainer, savedSelection.startOffset)
    range.setEnd(endContainer, savedSelection.endOffset)

    const selection = document.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (e) {
    // If restoration fails, place the cursor at the beginning
    editor.focus()
  }
}

/**
 * Get the path of a node relative to the editor root.
 * @param {HTMLElement} root The root element (editor).
 * @param {Node} node The target node.
 * @returns {number[]} Array of child indices representing the path.
 */
function getNodePath(root, node) {
  const path = []
  let current = node

  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) break

    const index = Array.from(parent.childNodes).indexOf(current)
    path.unshift(index)
    current = parent
  }

  return path
}

/**
 * Get a node from a path relative to the editor root.
 * @param {HTMLElement} root The root element (editor).
 * @param {number[]} path Array of child indices representing the path.
 * @returns {Node|null} The target node or null.
 */
function getNodeFromPath(root, path) {
  let current = root

  for (const index of path) {
    if (!current.childNodes || index >= current.childNodes.length) return null
    current = current.childNodes[index]
  }

  return current
}
