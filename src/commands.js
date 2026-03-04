import toolset from './toolset';
import {
  restoreCurrentSelection,
  restoreSelection,
  removeTag,
  placeSelectionMarkers,
  getNewMarkerReferences
} from './utils';
import { execCommand } from './shortcuts';
import {replaceNode} from "./filter";

/**
 * Execute an action.
 * @param {string} action The action to execute.
 * @param {object} editor The editor instance.
 * @param {array || object} options Optional action parameters.
 */
export function execAction(action, editor, options = []) {
  const tool = toolset[action];
  
  if (tool) {
    const command = tool.command || action;

    // Restore selection if any
    restoreCurrentSelection();

    // Execute the tool's action
    execEditorCommand(command, options);
    editor.normalize();

    // Focus the editor instance
    editor.focus();
  }
}

/**
 * Execute an editor command.
 * @param {string} command The command to execute.
 * @param {array || object} options Optional command parameters.
 */
export function execEditorCommand(command, options) {
  switch (command) {
    // Block level formatting
    case 'quote':
      if (typeof options === 'object') {
        const { state, selection } = options;
        if (state) {
          revertState(command, selection);
          break;
        }
      }
      execCommand('formatBlock', '<blockquote>');
      break;

    case 'insertHorizontalRule':
      if (typeof options === 'object') {
        const { state, selection } = options;
        if (state) {
          revertState('hr', selection);
          break;
        } else {
          execCommand(command);
          break;
        }
      }
      execCommand(command);
      break;

    case 'format':
      if (Array.isArray(options)) execCommand('formatBlock', `<${options[0]}>`);
      break;

    // Links
    case 'link':
      if (Array.isArray(options)) {
        const [linkUrl, linkTarget = '', linkText] = options;

        if (linkText) {
          const targetAttr = linkTarget !== '' ? ` target="${linkTarget}"` : '';
          const linkTag = `<a href="${linkUrl}"${targetAttr}>${linkText}</a>`;

          execCommand('insertHTML', linkTag);
        }
      }
      break;

    // Highlighting
      case 'highlight':
        if (typeof options === 'object') {
          const { state, selection } = options;
          if (state) {
            revertState(command, selection);
            break;
          }
        }
        execCommand('hiliteColor', '#ffff00');
        break;

    // All the other commands
    default:
      execCommand(command);
  }
}

/**
 * Remove all highlight spans within a selection range.
 * @param {Selection} selection The selection containing highlighted content.
 * @param {string} tag The tag name of the element to remove.
 */
function removeAllInSelection(selection, tag) {
  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const nodeIsElement = commonAncestor.nodeType === Node.ELEMENT_NODE;

  // Get the container element to search for tags
  const container = nodeIsElement ? commonAncestor
    : commonAncestor.parentElement;

  // Find all elements and filter the ones that intersect with the selection
  const elsToRemove = Array
    .from(container.querySelectorAll(tag))
    .filter(el => range.intersectsNode(el));

  // Remove all collected elements
  if (!elsToRemove.length && container.tagName === tag) {
    removeTag(container);
  } else elsToRemove.forEach(el => {
    if (el.parentElement.classList.contains('wysi-editor')) {
      replaceNode(el, 'p');
    } else removeTag(el)
  });
}

/**
 * Revert a formatting command and restore the selection properly.
 * Uses marker-based selection saving to handle multi-node selections correctly.
 * @param {string} command The command to execute.
 * @param {Selection} selection Selection to revert to.
 */
export function revertState(command, selection) {
  const anchor = selection.anchorNode;
  const elementToModify = anchor.tagName ? anchor : anchor.parentNode;

  // Place markers before making any DOM changes
  const markers = placeSelectionMarkers();

  switch (command) {
    case 'highlight':
      removeAllInSelection(selection, 'SPAN');
      break;
    case 'quote':
      removeAllInSelection(selection, 'BLOCKQUOTE');
      break;
    case 'hr':
      removeTag(elementToModify);
      break;
  }

  // Get new marker references
  const newMarkerReferences = getNewMarkerReferences(markers);

  // Restore selection using the markers
  restoreSelection(newMarkerReferences);
  document.querySelector('.wysi-editor').dispatchEvent(new Event('input'));
}