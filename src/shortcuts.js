import document from 'document'

// Shortcuts
export const dispatchEvent = (el, event) => el.dispatchEvent(new Event(event, { bubbles: true }))
export const execCommand = (command, value = null) => document.execCommand(command, false, value)
export const hasClass = (el, className) => el.classList?.contains(className)
export const trimText = (text) => text.trim().replace(/^\s+|\s+$/g, '')
export const cloneObject = (obj) => obj ? JSON.parse(JSON.stringify(obj)) : obj