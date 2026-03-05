import toolset from './toolset';
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
} from './utils';
import { execCommand } from './shortcuts';
import { replaceNode } from "./filter";
import { selectedClass } from "./common";
import { formatTextNodes } from './autoFormat';
import { htmlToMarkdown } from './markdown';
import { saveState } from './undoRedo';

/**
 * Execute an action.
 * @param {string} action The action to execute.
 * @param {HTMLElement} editor The editor instance.
 * @param {array || object} options Optional action parameters.
 */
export function execAction(action, editor, options = []) {
  const tool = toolset[action];

  if (tool) {
    const command = tool.command || action;

    // Restore selection if any
    restoreCurrentSelection();

    // Save state before executing the action (for undo)
    saveState(editor);

    // Execute the tool's action
    execEditorCommand(editor, command, options);
    editor.normalize();

    // Focus the editor instance
    editor.focus();
  }
}

/**
 * Execute an editor command.
 * @param {Element} editor The editor instance.
 * @param {string} command The command to execute.
 * @param {array || object} options Optional command parameters.
 */
export function execEditorCommand(editor, command, options) {
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
          } else {
            const markers = placeSelectionMarkers(selection);
            execCommand('hiliteColor', "#ffff00");
            const nodes = getSelectedNodes();
            nodes.forEach(n => n.tagName === 'SPAN' && replaceNode(n, 'mark').classList.add(selectedClass));
            const newMarkers = getNewMarkerReferences(markers);
            restoreMarkerSelection(newMarkers);
            break;
          }
        }
        console.error('Error when trying to highlight.')
        break;

    case 'autoFormat':
      const sel = document.getSelection();
      let container;

      if (sel.rangeCount > 0 && !sel.isCollapsed) {
        container = sel.getRangeAt(0).commonAncestorContainer;
        if (container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement;
      }

      formatTextNodes(container || editor);
      showToast('Formatted Text', editor);
      break;

    case 'markdownExport':
      if (editor) {
        const markdown = htmlToMarkdown(editor);
        copyToClipboard(markdown);
        showToast('Markdown copied to clipboard', editor);
      }
      break;

    case 'removeFormat':
      const { selection } = options;
      execCommand(command);
      if (editor && selection.type === 'Range') {
        showToast('Formatting removed', editor);
      }
      break;

    // All the other commands
    default:
      execCommand(command);
  }
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
      removeAllInSelection(selection, 'MARK');
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
  restoreMarkerSelection(newMarkerReferences);
}