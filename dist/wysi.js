/*!
 * Originally made by Momo Bassit.
 * https://github.com/mdbassit/Wysi
 */
(function (window, document$1) {
  'use strict';

  // Default settings
  var settings = {
    // Default selector
    el: '[data-wysi], .wysi-field',
    // Default tools in the toolbar
    tools: ['format', '|', 'bold', 'italic', 'underline', 'strike', 'highlight', '|', 'ul', 'ol', '|', 'link', 'hr', 'quote', '|', 'autoFormat', '|', 'removeFormat'],
    // Height of the editable region
    height: 200,
    // Grow the editable region's height to fit its content
    autoGrow: false,
    // Hide the toolbar when the editable region is out of focus
    autoHide: false,
    // Default list of allowed tags
    // These tags are always allowed regardless of the instance options
    allowedTags: {
      br: {
        attributes: [],
        styles: [],
        isEmpty: true
      },
      p: {
        attributes: [],
        styles: [],
        isEmpty: false
      }
    },
    // Custom tags to allow when filtering inserted content
    customTags: [
      /* Example:
       {
        tags: ['table', 'thead', 'tbody', 'tr', 'td', 'th'], // Tags to allow
        attributes: ['id', 'class'], // These attributes will be permitted for all the tags above
        styles: ['width'],
        isEmpty: false
      }
       */
    ]
  };

  // Supported tools
  var toolset = {
    format: {
      tags: ['p', 'h1', 'h2', 'h3', 'h4'],
      label: 'Select block format',
      paragraph: 'Paragraph',
      heading: 'Heading'
    },
    quote: {
      tags: ['blockquote'],
      label: 'Quote'
    },
    highlight: {
      tags: ['mark'],
      label: 'Highlight'
    },
    bold: {
      tags: ['strong'],
      alias: ['b'],
      label: 'Bold'
    },
    italic: {
      tags: ['em'],
      alias: ['i'],
      label: 'Italic'
    },
    underline: {
      tags: ['u'],
      label: 'Underline'
    },
    strike: {
      tags: ['s'],
      alias: ['del', 'strike'],
      label: 'Strike-through',
      command: 'strikeThrough'
    },
    ul: {
      tags: ['ul'],
      extraTags: ['li'],
      label: 'Bulleted list',
      command: 'insertUnorderedList'
    },
    ol: {
      tags: ['ol'],
      extraTags: ['li'],
      label: 'Numbered list',
      command: 'insertOrderedList'
    },
    link: {
      tags: ['a'],
      attributes: ['href', 'target'],
      attributeLabels: ['URL', 'Open link in'],
      hasForm: true,
      formOptions: {
        target: [{
          label: 'Current tab',
          value: ''
        }, {
          label: 'New tab',
          value: '_blank'
        }]
      },
      label: 'Link'
    },
    hr: {
      tags: ['hr'],
      isEmpty: true,
      label: 'Horizontal line',
      command: 'insertHorizontalRule'
    },
    removeFormat: {
      label: 'Remove format'
    },
    unlink: {
      label: 'Remove link'
    },
    autoFormat: {
      label: 'Auto format text',
      command: 'autoFormat'
    },
    markdownExport: {
      label: 'Copy as Markdown',
      command: 'markdownExport'
    }
  };

  // Instances storage
  const instances = {};

  // The CSS class to use for selected elements
  const selectedClass = 'wysi-selected';

  // Placeholder elements CSS class
  const placeholderClass = 'wysi-fragment-placeholder';

  // Heading elements
  const headingElements = ['H1', 'H2', 'H3', 'H4'];

  // Block type HTML elements
  const blockElements = ['BLOCKQUOTE', 'HR', 'P', 'OL', 'UL'].concat(headingElements);

  // Detect Firefox browser
  const isFirefox = navigator.userAgent.search(/Gecko\//) > -1;

  /**
   * Create an element and optionally set its attributes.
   * @param {string} tag The HTML tag of the new element.
   * @param {object} [attributes] The element's attributes.
   * @return {object} An HTML element.
   */
  function createElement(tag, attributes) {
    const element = document$1.createElement(tag);
    if (attributes) {
      for (const attributeName in attributes) {
        // Attribute names starting with underscore are actually properties
        if (attributeName[0] === '_') {
          element[attributeName.substring(1)] = attributes[attributeName];
        } else {
          element.setAttribute(attributeName, attributes[attributeName]);
        }
      }
    }
    return element;
  }

  /**
   * Replace a DOM element with another while preserving its content.
   * @param {object} node The element to replace.
   * @param {string} tag The HTML tag of the new element.
   * @param {boolean} [copyAttributes] If true, also copy the original element's attributes.
   * @return {object} The new element/Node.
   */
  function replaceNode(node, tag, copyAttributes) {
    const newElement = createElement(tag);
    const parentNode = node.parentNode;
    const attributes = node.attributes;

    // Copy the original element's content
    newElement.innerHTML = node.innerHTML || node.textContent || node.outerHTML;

    // Copy the original element's attributes
    if (copyAttributes && attributes) {
      for (let i = 0; i < attributes.length; i++) {
        newElement.setAttribute(attributes[i].name, attributes[i].value);
      }
    }

    // Replace the element
    parentNode.replaceChild(newElement, node);
    return newElement;
  }

  // Shortcuts
  const dispatchEvent = (element, event) => element.dispatchEvent(new Event(event, {
    bubbles: true
  }));
  const execCommand = function (command, value) {
    if (value === void 0) {
      value = null;
    }
    return document$1.execCommand(command, false, value);
  };
  const hasClass = (element, classes) => element.classList && element.classList.contains(classes);

  // Used to store the current DOM selection for later use
  let currentSelection;

  // For storing translated strings
  let availableTranslations;

  // Unique marker ID counter
  let markerIdCounter = 0;

  // Polyfill for Nodelist.forEach
  if (NodeList !== undefined && NodeList.prototype && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  /**
   * Shortcut for addEventListener to optimize the minified JS.
   * @param {object} context The context to which the listener is attached.
   * @param {string} type Event type.
   * @param {(string|function)} selector Event target if delegation is used, event handler if not.
   * @param {function} [fn] Event handler if delegation is used.
   */
  function addListener(context, type, selector, fn) {
    // Delegate event to the target of the selector
    if (typeof selector === 'string') {
      context.addEventListener(type, event => {
        const target = event.target;
        if (target.matches(selector)) {
          fn.call(target, event);
        }
      });

      // If the selector is not a string then it's a function
      // in which case we need a regular event listener
    } else {
      fn = selector;
      context.addEventListener(type, fn);
    }
  }

  /**
   * Build an html fragment from a string.
   * @param {string} html The HTML code.
   * @return {object} A document fragment.
   */
  function buildFragment(html) {
    const template = createElement('template');
    template.innerHTML = html.trim();
    return template.content;
  }

  /**
   * Deep clone an object.
   * @param {object} obj The object to clone.
   * @return {object} The clone object.
   */
  function cloneObject(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  /**
   * Call a function only when the DOM is ready.
   * @param {function} fn The function to call.
   * @param {array} [args] Arguments to pass to the function.
   */
  function DOMReady(fn, args) {
    args = args !== undefined ? args : [];
    if (document$1.readyState !== 'loading') {
      fn(...args);
    } else {
      addListener(document$1, 'DOMContentLoaded', () => {
        fn(...args);
      });
    }
  }

  /**
   * Find the the deepest child of a node.
   * @param {object} node The target node.
   * @return {object} The deepest child node of our target node.
   */
  function findDeepestChildNode(node) {
    while (node.firstChild !== null) {
      node = node.firstChild;
    }
    return node;
  }

  /**
   * Find WYSIWYG editor instances.
   * @param {string} selector One or more selectors pointing to textarea fields.
   */
  function findEditorInstances(selector) {
    const editorInstances = [];
    getTargetElements(selector).forEach(textarea => {
      const wrapper = textarea.previousElementSibling;
      if (wrapper && hasClass(wrapper, 'wysi-wrapper')) {
        const children = wrapper.children;
        const toolbar = children[0];
        const editor = children[1];
        const instanceId = getInstanceId(editor);
        editorInstances.push({
          textarea,
          wrapper,
          toolbar,
          editor,
          instanceId
        });
      }
    });
    return editorInstances;
  }

  /**
   * Find the current editor instance.
   * @param {object} currentNode The possible child node of the editor instance.
   * @return {object} The instance's editable region and toolbar, and an array of nodes that lead to it.
   */
  function findInstance(currentNode) {
    const nodes = [];
    let ancestor, toolbar, editor;

    // Find all HTML tags between the current node and the editable ancestor
    while (currentNode && currentNode !== document$1.body) {
      const tag = currentNode.tagName;
      if (tag) {
        if (hasClass(currentNode, 'wysi-wrapper')) {
          // Editable ancestor found
          ancestor = currentNode;
          break;
        } else {
          nodes.push(currentNode);
        }
      }
      currentNode = currentNode.parentNode;
    }
    if (ancestor) {
      const children = ancestor.children;
      toolbar = children[0];
      editor = children[1];
    }
    return {
      toolbar,
      editor,
      nodes
    };
  }

  /**
   * Get the current selection.
   * @return {object} The current selection.
   */
  function getCurrentSelection() {
    return currentSelection;
  }

  /**
   * Get the html content of a document fragment.
   * @param {string} fragment A document fragment.
   * @return {string} The html content of the fragment.
   */
  function getFragmentContent(fragment) {
    const wrapper = createElement('div');
    wrapper.appendChild(fragment);
    return wrapper.innerHTML;
  }

  /**
   * Get an editor's instance id.
   * @param {object} editor The editor element.
   * @return {string} The instance id.
   */
  function getInstanceId(editor) {
    return editor.dataset.wid;
  }

  /**
   * Get a list of DOM elements based on a selector value.
   * @param {(string|object)} selector A CSS selector string, a DOM element or a list of DOM elements.
   * @return {array} A list of DOM elements.
   */
  function getTargetElements(selector) {
    // If selector is a string, get the elements that it represents
    if (typeof selector === 'string') {
      return Array.from(document$1.querySelectorAll(selector));
    }

    // If selector is a DOM element, wrap it in an array
    if (selector instanceof Node) {
      return [selector];
    }

    // If selector is a NodeList or an HTMLCollection, convert it to an array
    if (selector instanceof NodeList || selector instanceof HTMLCollection) {
      return Array.from(selector);
    }

    // If selector is an array, find any DOM elements it contains
    if (Array.isArray(selector)) {
      return selector.filter(el => el instanceof Node);
    }
    return [];
  }

  /**
   * Try to guess the textarea element's label if any.
   * @param {object} textarea The textarea element.
   * @return {string} The textarea element's label or an empty string.
   */
  function getTextAreaLabel(textarea) {
    const parent = textarea.parentNode;
    const id = textarea.id;
    let labelElement;

    // If the textarea element is inside a label element
    if (parent.nodeName === 'LABEL') {
      labelElement = parent;

      // Or if the textarea element has an id, and there is a label element
      // with an attribute "for" that points to that id
    } else if (id !== undefined) {
      labelElement = document$1.querySelector("label[for=\"" + id + "\"]");
    }

    // If a label element is found, return the first non empty child text node
    if (labelElement) {
      const textNodes = [].filter.call(labelElement.childNodes, n => n.nodeType === 3);
      const texts = textNodes.map(n => n.textContent.replace(/\s+/g, ' ').trim());
      const label = texts.filter(l => l !== '')[0];
      if (label) {
        return label;
      }
    }
    return '';
  }

  /**
   * Get a translated string if applicable.
   * @param {string} category The category of the string.
   * @param {string} str The string to translate.
   * @return {string} The translated string, or the original string otherwise.
   */
  function getTranslation(category, str) {
    if (availableTranslations[category] && availableTranslations[category][str]) {
      return availableTranslations[category][str];
    }
    return str;
  }

  /**
   * Restore a previous selection if any.
   */
  function restoreCurrentSelection() {
    if (currentSelection) {
      setSelection(currentSelection);
      currentSelection = undefined;
    }
  }

  /**
   * Create a unique marker element for selection boundaries.
   * @return {Comment} A comment node to use as a marker.
   */
  function createMarker() {
    const script = document$1.createElement('script');
    script.type = 'marker';
    script.id = "mark-" + markerIdCounter++;
    return script;
  }

  /**
   * Save the current selection by inserting temporary markers.
   * This handles multi-node selections correctly by marking both start and end points.
   * @param {Selection?} selection The selection to save (defaults to current selection).
   * @return {Array} Array containing the start and end marker comment nodes.
   */
  function placeSelectionMarkers(selection) {
    const sel = selection || document$1.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const startMarker = createMarker();
    const endMarker = createMarker();

    // Safely place the markers with cloneRange
    const startRange = range.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);
    const endRange = range.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);
    return [startMarker, endMarker];
  }

  /**
   * Remove the specified tag.
   * @param {HTMLElement} node Node to have the tag removed.
   */
  function removeTag(node) {
    node.outerHTML = node.innerHTML;
  }

  /**
   * Return new marker references.
   * @param {HTMLScriptElement[]} markers Array of saved markers.
   * @return {HTMLScriptElement[]} Array of new marker references.
   */
  function getNewMarkerReferences(markers) {
    const m1 = document$1.getElementById(markers[0].id);
    const m2 = document$1.getElementById(markers[1].id);
    return [m1, m2];
  }

  /**
   * Restore selection using marker elements.
   * This properly restores multi-node selections.
   * @param {HTMLScriptElement[]} markers The start marker comment node.
   * @param {boolean} removeMarkers Whether to remove the markers after restoring (default: true).
   */
  function restoreMarkerSelection(markers, removeMarkers) {
    if (removeMarkers === void 0) {
      removeMarkers = true;
    }
    if (markers.length !== 2) return;
    const [s, e] = markers;
    const selection = document$1.getSelection();
    const range = selection.getRangeAt(0);

    // Set range's start after the start marker
    range.setStartAfter(s);
    // Set range's end before the end marker
    range.setEndBefore(e);
    setSelection(range);

    // Remove markers if requested
    if (removeMarkers) {
      s.remove();
      e.remove();
    }
  }

  /**
   * Set the value of the current selection.
   * @param {object} range The range to set.
   */
  function setCurrentSelection(range) {
    currentSelection = range;
  }

  /**
   * Set the selection to a range.
   * @param {object} range The range to select.
   */
  function setSelection(range) {
    const selection = document$1.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Store translated strings.
   * @param {object} translations The translated strings.
   */
  function storeTranslations(translations) {
    availableTranslations = translations;
  }

  /**
   * Set the expanded state of a button.
   * @param {object} button The button.
   * @param {boolean} expanded The expanded state.
   */
  function toggleButton(button, expanded) {
    button.setAttribute('aria-expanded', expanded);
  }

  /**
   * Get all selected nodes.
   * @param {Selection?} selection The selection to get nodes from.
   * @return {array} The selected nodes.
   */
  function getSelectedNodes(selection) {
    const sel = selection || document$1.getSelection();
    if (!sel || !sel.rangeCount) return [];
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const nodes = [];
    const walker = document$1.createTreeWalker(container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement, NodeFilter.SHOW_ALL, {
      acceptNode: node => {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let currentNode = walker.currentNode;
    while (currentNode) {
      if (range.intersectsNode(currentNode) && currentNode !== container) nodes.push(currentNode);
      currentNode = walker.nextNode();
    }
    return nodes;
  }

  /**
   * Remove all tags within a selection range.
   * @param {Selection} selection The selection containing highlighted content.
   * @param {string} tag The tag name of the element to remove.
   */
  function removeAllInSelection(selection, tag) {
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const nodeIsElement = commonAncestor.nodeType === Node.ELEMENT_NODE;

    // Get the container element to search for tags
    const container = nodeIsElement ? commonAncestor : commonAncestor.parentElement;

    // Find all elements and filter the ones that intersect with the selection
    const elsToRemove = Array.from(container.querySelectorAll(tag)).filter(el => range.intersectsNode(el));

    // Remove all collected elements
    if (!elsToRemove.length && container.tagName === tag) {
      removeTag(container);
    } else elsToRemove.forEach(el => {
      if (el.parentElement.classList.contains('wysi-editor')) {
        replaceNode(el, 'p');
      } else removeTag(el);
    });
  }

  /**
   * Copy text to clipboard.
   * @param {string} text The text to copy.
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {}).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    } else {
      // Fallback for older browsers
      const textarea = document$1.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document$1.body.appendChild(textarea);
      textarea.select();
      try {
        document$1.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
      document$1.body.removeChild(textarea);
    }
  }

  /**
   * Show a toast notification message.
   * @param {string} message The message to display.
   * @param {HTMLElement} editor The editor element to position the toast relative to.
   */
  function showToast(message, editor) {
    // Remove any existing toast
    const existingToast = document$1.querySelector('.wysi-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document$1.createElement('div');
    toast.className = 'wysi-toast';
    toast.textContent = message;

    // Find the editor wrapper or use the editor itself
    const wrapper = (editor == null ? void 0 : editor.closest('.wysi-wrapper')) || editor;
    if (wrapper) wrapper.appendChild(toast);else document$1.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('wysi-toast--visible'));

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('wysi-toast--visible');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }

  /**
   * Text formatting utilities
   */

  // Orphans
  const ORPHAN_PATTERN = /(^| )([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /gm;
  const DOUBLE_ORPHAN_PATTERN = /\xa0([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /g;

  /**
   * Add non-breaking spaces after orphans
   */
  const nbsp = text => {
    let result = text;
    let prev = null;
    let iterations = 0;
    const maxIterations = 5;

    // Step 1: Replace space after orphan with non-breaking space
    while (prev !== result && iterations < maxIterations) {
      prev = result;
      result = result.replace(ORPHAN_PATTERN, '$1$2\xa0');
      iterations++;
    }

    // Step 2: Handle double orphans
    prev = null;
    iterations = 0;
    while (prev !== result && iterations < maxIterations) {
      prev = result;
      result = result.replace(DOUBLE_ORPHAN_PATTERN, '\xa0$1\xa0');
      iterations++;
    }
    return result;
  };

  /**
   * Replace hyphens surrounded by spaces with en-dash
   */
  const dash = text => {
    return text.replace(/(\s-)+\s/g, match => match === ' - ' ? ' – ' : match);
  };

  /**
   * Fix spacing around punctuation marks
   * Removes spaces before punctuation and normalizes spaces after
   */
  const punctuation = text => {
    return text
    // Remove spaces before punctuation
    .replace(/[^\S\r\n]+([,.!?;:\]])/g, '$1')
    // Normalize multiple spaces after punctuation to single space
    .replace(/([,.!?;:\]])[^\S\r\n]{2,}/g, '$1 ');
  };

  /**
   * Apply all formatting
   * Combines: punctuation, nbsp (orphan words), and dash
   */
  const autoFormat = text => {
    return punctuation(nbsp(dash(text)));
  };

  /**
   * Format all text nodes within a container element
   * @param {Element} container The element containing text to format
   */
  const formatTextNodes = container => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        return node.textContent.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
      textNodes.push(node);
    }
    textNodes.forEach(textNode => {
      const originalText = textNode.textContent;
      const formattedText = autoFormat(originalText);
      if (formattedText !== originalText) {
        textNode.textContent = formattedText;
      }
    });
  };

  /**
   * Convert HTML content to Markdown.
   * @param {HTMLElement} element The element containing HTML content.
   * @return {string} The Markdown text.
   */
  function htmlToMarkdown(element) {
    let markdown = '';
    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      const tagName = node.tagName.toLowerCase();
      let content = '';

      // Process child nodes
      for (const child of node.childNodes) {
        content += processNode(child);
      }

      // Convert based on tag
      switch (tagName) {
        case 'h1':
          return "# " + content + "\n\n";
        case 'h2':
          return "## " + content + "\n\n";
        case 'h3':
          return "### " + content + "\n\n";
        case 'h4':
          return "#### " + content + "\n\n";
        case 'p':
          return content + "\n\n";
        case 'strong':
        case 'b':
          return "**" + content + "**";
        case 'em':
        case 'i':
          return "_" + content + "_";
        case 'u':
          return "<u>" + content + "</u>";
        case 's':
        case 'del':
        case 'strike':
          return "~~" + content + "~~";
        case 'mark':
          return "==" + content + "==";
        case 'a':
          const href = node.getAttribute('href') || '';
          return "[" + content + "](" + href + ")";
        case 'blockquote':
          return content.split('\n').filter(line => line.trim()).map(line => "> " + line).join('\n') + '\n\n';
        case 'ul':
          return content;
        case 'ol':
          return content;
        case 'li':
          const parent = node.parentElement;
          if (parent && parent.tagName.toLowerCase() === 'ol') {
            const index = Array.from(parent.children).indexOf(node) + 1;
            return index + ". " + content + "\n";
          }
          return "- " + content + "\n";
        case 'br':
          return '\n';
        case 'hr':
          return '---\n\n';
        case 'div':
          return content + "\n";
        default:
          return content;
      }
    }
    for (const child of element.childNodes) {
      markdown += processNode(child);
    }
    return markdown.trim();
  }

  // Maximum number of undo/redo steps to keep
  const MAX_HISTORY_SIZE = 20;

  // Store undo/redo state for each editor instance (now arrays for multiple steps)
  const undoStack = new Map();
  const redoStack = new Map();

  /**
   * Save the current state of an editor for undo functionality.
   * @param {HTMLElement} editor The editor element.
   */
  function saveState(editor) {
    if (!editor) return;
    const instanceId = editor.dataset.wid;
    if (!instanceId) return;

    // Get or create the undo stack for this instance
    let stack = undoStack.get(instanceId);
    if (!stack) {
      stack = [];
      undoStack.set(instanceId, stack);
    }

    // Save the current state
    const state = {
      html: editor.innerHTML,
      selection: saveSelection(editor)
    };

    // Add to stack, limiting size
    stack.push(state);
    if (stack.length > MAX_HISTORY_SIZE) {
      stack.shift(); // Remove oldest state
    }

    // Clear the redo stack when a new action is performed
    redoStack.delete(instanceId);
  }

  /**
   * Undo the last action for an editor.
   * @param {HTMLElement} editor The editor element.
   * @returns {boolean} True if undo was performed, false otherwise.
   */
  function undo(editor) {
    if (!editor) return false;
    const instanceId = editor.dataset.wid;
    if (!instanceId) return false;
    const undoStates = undoStack.get(instanceId);
    if (!undoStates || undoStates.length === 0) return false;

    // Get or create the redo stack for this instance
    let redoStates = redoStack.get(instanceId);
    if (!redoStates) {
      redoStates = [];
      redoStack.set(instanceId, redoStates);
    }

    // Save current state to redo stack
    const currentState = {
      html: editor.innerHTML,
      selection: saveSelection(editor)
    };
    redoStates.push(currentState);
    if (redoStates.length > MAX_HISTORY_SIZE) {
      redoStates.shift();
    }

    // Restore the previous state from undo stack
    const previousState = undoStates.pop();
    editor.innerHTML = previousState.html;
    restoreSelection(editor, previousState.selection);

    // Dispatch input event to update the textarea and toolbar
    editor.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    return true;
  }

  /**
   * Redo the last undone action for an editor.
   * @param {HTMLElement} editor The editor element.
   * @returns {boolean} True if redo was performed, false otherwise.
   */
  function redo(editor) {
    if (!editor) return false;
    const instanceId = editor.dataset.wid;
    if (!instanceId) return false;
    const redoStates = redoStack.get(instanceId);
    if (!redoStates || redoStates.length === 0) return false;

    // Get or create the undo stack for this instance
    let undoStates = undoStack.get(instanceId);
    if (!undoStates) {
      undoStates = [];
      undoStack.set(instanceId, undoStates);
    }

    // Save current state to undo stack
    const currentState = {
      html: editor.innerHTML,
      selection: saveSelection(editor)
    };
    undoStates.push(currentState);
    if (undoStates.length > MAX_HISTORY_SIZE) {
      undoStates.shift();
    }

    // Restore the next state from redo stack
    const nextState = redoStates.pop();
    editor.innerHTML = nextState.html;
    restoreSelection(editor, nextState.selection);

    // Dispatch input event to update the textarea and toolbar
    editor.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    return true;
  }

  /**
   * Check if undo is available for an editor.
   * @param {HTMLElement} editor The editor element.
   * @returns {boolean} True if undo is available.
   */
  function canUndo(editor) {
    if (!editor) return false;
    const instanceId = editor.dataset.wid;
    if (!instanceId) return false;
    const stack = undoStack.get(instanceId);
    return stack && stack.length > 0;
  }

  /**
   * Check if redo is available for an editor.
   * @param {HTMLElement} editor The editor element.
   * @returns {boolean} True if redo is available.
   */
  function canRedo(editor) {
    if (!editor) return false;
    const instanceId = editor.dataset.wid;
    if (!instanceId) return false;
    const stack = redoStack.get(instanceId);
    return stack && stack.length > 0;
  }

  /**
   * Clear undo/redo stacks for an editor.
   * @param {HTMLElement} editor The editor element.
   */
  function clearHistory(editor) {
    if (!editor) return;
    const instanceId = editor.dataset.wid;
    if (instanceId) {
      undoStack.delete(instanceId);
      redoStack.delete(instanceId);
    }
  }

  /**
   * Save the current selection in an editor.
   * @param {HTMLElement} editor The editor element.
   * @returns {object|null} Selection state object or null.
   */
  function saveSelection(editor) {
    const selection = document$1.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);

    // Check if selection is within the editor
    if (!editor.contains(range.commonAncestorContainer)) {
      return null;
    }
    return {
      startContainer: getNodePath(editor, range.startContainer),
      startOffset: range.startOffset,
      endContainer: getNodePath(editor, range.endContainer),
      endOffset: range.endOffset
    };
  }

  /**
   * Restore a saved selection in an editor.
   * @param {HTMLElement} editor The editor element.
   * @param {object} savedSelection The saved selection state.
   */
  function restoreSelection(editor, savedSelection) {
    if (!savedSelection) return;
    try {
      const startContainer = getNodeFromPath(editor, savedSelection.startContainer);
      const endContainer = getNodeFromPath(editor, savedSelection.endContainer);
      if (!startContainer || !endContainer) return;
      const range = document$1.createRange();
      range.setStart(startContainer, savedSelection.startOffset);
      range.setEnd(endContainer, savedSelection.endOffset);
      const selection = document$1.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      // If restoration fails, place cursor at the beginning
      editor.focus();
    }
  }

  /**
   * Get the path of a node relative to the editor root.
   * @param {HTMLElement} root The root element (editor).
   * @param {Node} node The target node.
   * @returns {number[]} Array of child indices representing the path.
   */
  function getNodePath(root, node) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.from(parent.childNodes).indexOf(current);
      path.unshift(index);
      current = parent;
    }
    return path;
  }

  /**
   * Get a node from a path relative to the editor root.
   * @param {HTMLElement} root The root element (editor).
   * @param {number[]} path Array of child indices representing the path.
   * @returns {Node|null} The target node or null.
   */
  function getNodeFromPath(root, path) {
    let current = root;
    for (const index of path) {
      if (!current.childNodes || index >= current.childNodes.length) {
        return null;
      }
      current = current.childNodes[index];
    }
    return current;
  }

  // Set to track editors that should suppress input events during execCommand
  const suppressInputEvents = new WeakSet();

  /**
   * Execute an action.
   * @param {string} action The action to execute.
   * @param {HTMLElement} editor The editor instance.
   * @param {array || object} options Optional action parameters.
   */
  function execAction(action, editor, options) {
    if (options === void 0) {
      options = [];
    }
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
  function execEditorCommand(editor, command, options) {
    switch (command) {
      // Block level formatting
      case 'quote':
        if (typeof options === 'object') {
          const {
            state,
            selection
          } = options;
          if (state) {
            revertState(editor, command, selection);
            break;
          }
        }
        execCommand('formatBlock', '<blockquote>');
        break;
      case 'insertHorizontalRule':
        if (typeof options === 'object') {
          const {
            state,
            selection
          } = options;
          if (state) {
            revertState(editor, 'hr', selection);
            break;
          } else {
            execCommand(command);
            break;
          }
        }
        execCommand(command);
        break;
      case 'format':
        if (Array.isArray(options)) execCommand('formatBlock', "<" + options[0] + ">");
        break;

      // Links
      case 'link':
        if (Array.isArray(options)) {
          const [linkUrl, linkTarget = '', linkText] = options;
          if (linkText) {
            const targetAttr = linkTarget !== '' ? " target=\"" + linkTarget + "\"" : '';
            const linkTag = "<a href=\"" + linkUrl + "\"" + targetAttr + ">" + linkText + "</a>";
            execCommand('insertHTML', linkTag);
          }
        }
        break;

      // Highlighting
      case 'highlight':
        if (typeof options === 'object') {
          const {
            state,
            selection
          } = options;
          if (state) {
            revertState(editor, command, selection);
            break;
          } else {
            const markers = placeSelectionMarkers(selection);
            // Suppress input events during execCommand to avoid duplicate events
            suppressInputEvents.add(editor);
            execCommand('hiliteColor', "#ffff00");
            suppressInputEvents.delete(editor);
            const nodes = getSelectedNodes();
            nodes.forEach(n => n.tagName === 'SPAN' && replaceNode(n, 'mark').classList.add(selectedClass));
            const newMarkers = getNewMarkerReferences(markers);
            restoreMarkerSelection(newMarkers);
            editor.dispatchEvent(new Event('input', {
              bubbles: true
            }));
            break;
          }
        }
        console.error('Error when trying to highlight.');
        break;
      case 'autoFormat':
        const sel = document.getSelection();
        let container;
        if (sel.rangeCount > 0 && !sel.isCollapsed) {
          container = sel.getRangeAt(0).commonAncestorContainer;
          if (container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement;
        }
        formatTextNodes(container || editor);
        editor.dispatchEvent(new Event('input', {
          bubbles: true
        }));
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
        const {
          selection
        } = options;
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
   * @param {Element} editor The editor instance.
   * @param {string} command The command to execute.
   * @param {Selection} selection Selection to revert to.
   */
  function revertState(editor, command, selection) {
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
    editor.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }

  // Used to give form fields unique ids
  let uniqueFieldId = 0;

  /**
   * Render a popover form to set a tool's parameters.
   * @param {string} toolName The tool name.
   * @param {object} button The tool's toolbar button.
   * @return {object} A DOM element containing the button and the popover.
   */
  function renderPopover(toolName, button) {
    const tool = toolset[toolName];
    const labels = tool.attributeLabels;
    const fields = tool.attributes.map((attribute, i) => {
      return {
        name: attribute,
        label: getTranslation(toolName, labels[i])
      };
    });

    // Popover wrapper
    const wrapper = createElement('div', {
      class: 'wysi-popover'
    });

    // Popover
    const popover = createElement('div', {
      tabindex: -1
    });

    // Toolbar Button
    button.setAttribute('aria-haspopup', true);
    button.setAttribute('aria-expanded', false);
    wrapper.appendChild(button);
    wrapper.appendChild(popover);
    fields.forEach(field => {
      // Link target requires special handling later
      if (toolName !== 'link' || field.name !== 'target') {
        const label = createElement('label');
        const span = createElement('span', {
          _textContent: field.label
        });
        const input = createElement('input', {
          type: 'text',
          name: "wysi-" + field.name,
          'data-attribute': field.name
        });
        label.appendChild(span);
        label.appendChild(input);
        popover.appendChild(label);
      }
    });

    // Link popover
    if (toolName === 'link') {
      // Add the target attribute
      const targetField = fields.find(f => f.name === 'target');
      if (targetField) {
        targetField.toolName = toolName;
        targetField.options = tool.formOptions ? tool.formOptions.target || [] : [];
        popover.appendChild(createElement('span', {
          _textContent: targetField.label
        }));
        popover.appendChild(renderSegmentedField(targetField));
      }

      // The link popover needs an extra "Remove link" button
      const extraTool = 'unlink';
      const label = getTranslation(toolName, toolset[extraTool].label);
      popover.appendChild(createElement('button', {
        type: 'button',
        title: label,
        'aria-label': label,
        'data-action': extraTool,
        _innerHTML: "<svg><use href=\"#wysi-delete\"></use></svg>"
      }));
    }

    // Image popover
    if (toolName === 'image') {
      const imageSettings = tool.extraSettings.map((setting, i) => {
        return {
          name: setting,
          label: getTranslation(toolName, tool.extraSettingLabels[i])
        };
      });
      imageSettings.forEach(setting => {
        setting.toolName = toolName;
        setting.options = tool.formOptions ? tool.formOptions[setting.name] || [] : [];
        popover.appendChild(createElement('span', {
          _textContent: setting.label
        }));
        popover.appendChild(renderSegmentedField(setting));
      });
    }
    const cancel = createElement('button', {
      type: 'button',
      _textContent: getTranslation('popover', 'Cancel')
    });
    const save = createElement('button', {
      type: 'button',
      'data-action': toolName,
      _textContent: getTranslation('popover', 'Save')
    });
    popover.appendChild(cancel);
    popover.appendChild(save);
    return wrapper;
  }

  /**
   * Render a segmented form field.
   * @param {object} field The field attributes.
   * @return {object} A DOM element representing the segmented field.
   */
  function renderSegmentedField(field) {
    const fieldId = uniqueFieldId++;
    const segmented = createElement('fieldset', {
      class: 'wysi-segmented'
    });

    // Add the fieldset legend for accessibility
    segmented.appendChild(createElement('legend', {
      _textContent: field.label
    }));

    // Add field options
    field.options.forEach(option => {
      const segmentId = uniqueFieldId++;
      segmented.appendChild(createElement('input', {
        id: "wysi-seg-" + segmentId,
        name: "wysi-" + field.toolName + "-" + field.name + "-" + fieldId,
        type: 'radio',
        'data-attribute': field.name,
        value: option.value
      }));
      segmented.appendChild(createElement('label', {
        for: "wysi-seg-" + segmentId,
        _textContent: getTranslation(field.toolName, option.label)
      }));
    });
    return segmented;
  }

  /**
   * Open a popover.
   * @param {object} button The popover's button.
   */
  function openPopover(button) {
    const inputs = button.nextElementSibling.querySelectorAll('input[type="text"]');
    const radioButtons = button.nextElementSibling.querySelectorAll('input[type="radio"]');
    const selection = document$1.getSelection();
    const anchorNode = selection.anchorNode;
    const {
      editor,
      nodes
    } = findInstance(anchorNode);
    const values = {};
    if (editor) {
      // Try to find an existing target of the popover's action from the DOM selection
      const action = button.dataset.action;
      const tool = toolset[action];
      let target = editor.querySelector("." + selectedClass);
      let selectContents = false;

      // If that fails, look for an element with the selection CSS class
      if (!target) {
        target = nodes.filter(node => tool.tags.includes(node.tagName.toLowerCase()))[0];
        selectContents = true;
      }

      // If an existing target is found, we will be in modification mode
      if (target) {
        const range = document$1.createRange();

        // Add the target to a selection range
        // Depending on the type of the target, select the whole node or just its contents
        if (selectContents) {
          range.selectNodeContents(target);
        } else {
          range.selectNode(target);
        }

        // Save the current selection for later use
        setCurrentSelection(range);

        // Retrieve the current attribute values of the target for modification
        tool.attributes.forEach(attribute => {
          values[attribute] = target.getAttribute(attribute);
        });

        // Process extra popover settings
        if (tool.extraSettings) {
          tool.extraSettings.forEach(setting => {
            const settingOptions = tool.formOptions[setting];
            for (const option of settingOptions) {
              if (!option.criterion) {
                continue;
              }
              const key = Object.keys(option.criterion)[0];
              const value = option.criterion[key];
              if (target.style[key] && target.style[key] === value) {
                values[setting] = option.value;
                break;
              }
            }
          });
        }

        // If no existing target is found, we are adding new content
      } else if (selection && editor.contains(anchorNode) && selection.rangeCount) {
        // Save the current selection to keep track of where to insert the content
        setCurrentSelection(selection.getRangeAt(0));
      }
    }

    // Populate the input fields with the existing values if any
    inputs.forEach(input => {
      input.value = values[input.dataset.attribute] || '';
    });

    // Check the relevent radio fields if any
    radioButtons.forEach(radio => {
      const value = values[radio.dataset.attribute] || '';
      if (radio.value === value) {
        radio.checked = true;
      }
    });

    // Open this popover
    toggleButton(button, true);

    // Focus the first input field
    inputs[0].focus();
  }

  /**
   * Execute a popover's action.
   * @param {object} button The popover's action button.
   */
  function execPopoverAction(button) {
    const action = button.dataset.action;
    const selection = getCurrentSelection();
    const inputs = button.parentNode.querySelectorAll('input[type="text"]');
    const radioButtons = button.parentNode.querySelectorAll('input[type="radio"]');
    const {
      editor
    } = findInstance(button);
    const options = [];
    inputs.forEach(input => {
      options.push(input.value);
    });
    radioButtons.forEach(radio => {
      if (radio.checked) {
        options.push(radio.value);
      }
    });

    // Workaround for links being removed when updating images
    if (action === 'image') {
      const selected = editor.querySelector("." + selectedClass);
      const parent = selected ? selected.parentNode : {};
      if (selected && parent.tagName === 'A') {
        options.push(parent.outerHTML);
      }

      // Save the content of the current selection to use as a link text
    } else if (action === 'link' && selection) {
      options.push(getFragmentContent(selection.cloneContents()));
    }
    execAction(action, editor, options);
  }

  /**
   * Close the open popover if any.
   * @param {boolean} ignoreSelection If true, do not restore the previous selection.
   */
  function closePopover(ignoreSelection) {
    const popover = document$1.querySelector('.wysi-popover [aria-expanded="true"]');
    if (popover) {
      toggleButton(popover, false);
    }
    if (!ignoreSelection) {
      restoreCurrentSelection();
    }
  }

  // Open a popover
  addListener(document$1, 'click', '.wysi-popover > button', event => {
    closePopover();
    openPopover(event.target);
  });

  // On key press on the popover button
  addListener(document$1, 'keydown', '.wysi-popover > button', event => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        openPopover(event.target);
        event.preventDefault();
        break;
    }
  });

  // Execute the popover action
  addListener(document$1, 'click', '.wysi-popover > div > button[data-action]', event => {
    execPopoverAction(event.target);
    closePopover(true);
  });

  // Cancel the popover
  addListener(document$1, 'click', '.wysi-popover > div > button:not([data-action])', () => {
    closePopover();
  });

  // Prevent clicks on the popover content to propagate (keep popover open)
  addListener(document$1, 'click', '.wysi-popover *:not(button)', event => {
    event.stopImmediatePropagation();
  });

  // Trap focus inside a popover until it's closed
  addListener(document$1, 'keydown', '.wysi-popover *', event => {
    const target = event.target;
    const parent = target.parentNode;
    const form = parent.tagName === 'DIV' ? parent : parent.parentNode;
    switch (event.key) {
      case 'Tab':
        const firstField = form.querySelector('input');
        if (event.shiftKey) {
          if (target === firstField) {
            form.lastElementChild.focus();
            event.preventDefault();
          }
        } else {
          if (!target.nextElementSibling && !target.parentNode.nextElementSibling) {
            firstField.focus();
            event.preventDefault();
          }
        }
        break;
      case 'Enter':
        if (target.tagName === 'INPUT') {
          const actionButton = form.querySelector('[data-action]:last-of-type');
          actionButton.click();
          event.preventDefault();
        }
        break;
      case 'Escape':
        closePopover();
        event.stopImmediatePropagation();
        break;
    }
  });
  let isSelectionInProgress = false;

  // Close open popups and dropdowns on click outside
  addListener(document$1, 'click', () => {
    if (!isSelectionInProgress) {
      closePopover();
    }
  });

  // Text selection within a popover is in progress
  // This helps avoid closing a popover when the end of a text selection is outside it
  addListener(document$1, 'mousedown', '.wysi-popover, .wysi-popover *', () => {
    isSelectionInProgress = true;
  });

  // The text selection ended
  addListener(document$1, 'mouseup', () => {
    setTimeout(() => {
      isSelectionInProgress = false;
    });
  });

  /**
   * Render a list box.
   * @param {object} details The list box properties and data.
   * @return {object} A DOM element containing the list box.
   */
  function renderListBox(details) {
    const label = details.label;
    const items = details.items;
    const firstItem = items[0];
    const classes = ['wysi-listbox'].concat(details.classes || []);

    // List box wrapper
    const listBox = createElement('div', {
      class: classes.join(' ')
    });

    // List box button
    const button = createElement('button', {
      type: 'button',
      title: label,
      'aria-label': label + " " + firstItem.label,
      'aria-haspopup': 'listbox',
      'aria-expanded': false,
      _innerHTML: renderListBoxItem(firstItem)
    });

    // List box menu
    const menu = createElement('div', {
      role: 'listbox',
      tabindex: -1,
      'aria-label': label
    });

    // List box items
    items.forEach(item => {
      const option = createElement('button', {
        type: 'button',
        role: 'option',
        tabindex: -1,
        'aria-label': item.label,
        'aria-selected': false,
        'data-action': item.action,
        'data-option': item.name || '',
        _innerHTML: renderListBoxItem(item)
      });
      menu.appendChild(option);
    });

    // Tie it all together
    listBox.appendChild(button);
    listBox.appendChild(menu);
    return listBox;
  }

  /**
   * Render a list box item.
   * @param {object} item The list box item.
   * @return {string} The list box item's content.
   */
  function renderListBoxItem(item) {
    return item.icon ? "<svg><use href=\"#wysi-" + item.icon + "\"></use></svg>" : item.label;
  }

  /**
   * Open a list box.
   * @param {object} button The list box's button.
   */
  function openListBox(button) {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    const listBox = button.nextElementSibling;
    let selectedItem = listBox.querySelector('[aria-selected="true"]');
    if (!selectedItem) {
      selectedItem = listBox.firstElementChild;
    }
    toggleButton(button, !isOpen);
    selectedItem.focus();
  }

  /**
   * Select a list box item.
   * @param {object} item The list box item.
   */
  function selectListBoxItem(item) {
    const listBox = item.parentNode;
    const button = listBox.previousElementSibling;
    const selectedItem = listBox.querySelector('[aria-selected="true"]');
    if (selectedItem) {
      selectedItem.setAttribute('aria-selected', 'false');
    }
    item.setAttribute('aria-selected', 'true');
    button.innerHTML = item.innerHTML;
  }

  /**
   * Close the currently open list box if any.
   */
  function closeListBox() {
    const activeListBox = document$1.querySelector('.wysi-listbox [aria-expanded="true"]');
    if (activeListBox) {
      toggleButton(activeListBox, false);
    }
  }

  // list box button click
  addListener(document$1, 'click', '.wysi-listbox > button', event => {
    closeListBox();
    openListBox(event.target);
  });

  // On key press on the list box button
  addListener(document$1, 'keydown', '.wysi-listbox > button', event => {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        openListBox(event.target);
        event.preventDefault();
        break;
    }
  });

  // When the mouse moves on a list box item, focus it
  addListener(document$1.documentElement, 'mousemove', '.wysi-listbox > div > button', event => {
    event.target.focus();
  });

  // On click on a list box item
  addListener(document$1, 'click', '.wysi-listbox > div > button', event => {
    const item = event.target;
    const action = item.dataset.action;
    const option = item.dataset.option;
    const {
      editor
    } = findInstance(item);
    const selection = document$1.getSelection();
    if (selection && editor.contains(selection.anchorNode)) {
      execAction(action, editor, [option]);
    }
    selectListBoxItem(item);
  });

  // On key press on an item
  addListener(document$1, 'keydown', '.wysi-listbox > div > button', event => {
    const item = event.target;
    const listBox = item.parentNode;
    const button = listBox.previousElementSibling;
    let preventDefault = true;
    switch (event.key) {
      case 'ArrowUp':
        const prev = item.previousElementSibling;
        if (prev) {
          prev.focus();
        }
        break;
      case 'ArrowDown':
        const next = item.nextElementSibling;
        if (next) {
          next.focus();
        }
        break;
      case 'Home':
        listBox.firstElementChild.focus();
        break;
      case 'End':
        listBox.lastElementChild.focus();
        break;
      case 'Tab':
        item.click();
        break;
      case 'Escape':
        toggleButton(button, false);
        break;
      default:
        preventDefault = false;
    }
    if (preventDefault) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  let isOpeningInProgress = false;

  // Close open popups and dropdowns on click outside
  addListener(document$1, 'click', () => {
    if (!isOpeningInProgress) {
      closeListBox();
    }
  });

  // This prevents closing a listbox immediately after opening it
  addListener(document$1, 'mousedown', '.wysi-listbox > button', () => isOpeningInProgress = true);
  addListener(document$1, 'mouseup', () => setTimeout(() => {
    isOpeningInProgress = false;
  }));

  /**
   * Render the toolbar.
   * @param {array} tools The list of tools in the toolbar.
   * @param {object} customActions Custom actions to add to the toolbar.
   * @return {string} The toolbars HTML string.
   */
  function renderToolbar(tools, customActions) {
    if (customActions === void 0) {
      customActions = {};
    }
    const toolbar = createElement('div', {
      class: 'wysi-toolbar'
    });

    // Generate toolbar buttons
    tools.forEach(toolName => {
      switch (toolName) {
        // Toolbar separator
        case '|':
          toolbar.appendChild(createElement('div', {
            class: 'wysi-separator'
          }));
          break;

        // Toolbar new line
        case '-':
          toolbar.appendChild(createElement('div', {
            class: 'wysi-newline'
          }));
          break;

        // The format tool renders as a list box
        case 'format':
          toolbar.appendChild(renderFormatTool());
          break;

        // Custom action (string reference to customActions)
        default:
          if (typeof toolName === 'string' && customActions[toolName]) {
            const customAction = customActions[toolName];
            const button = createElement('button', {
              type: 'button',
              title: customAction.label,
              'aria-label': customAction.label,
              'aria-pressed': false,
              'data-custom-action': toolName,
              _innerHTML: customAction.innerHTML
            });
            toolbar.appendChild(button);
          } else if (typeof toolName === 'object' && toolName.items) {
            // Tool group
            toolbar.appendChild(renderToolGroup(toolName));
          } else if (typeof toolName === 'string') {
            // Standard tool
            renderTool(toolName, toolbar);
          }
      }
    });
    return toolbar;
  }

  /**
   * Render a tool.
   * @param {string} name The tool's name.
   * @param {object} toolbar The toolbar to which the tool will be appended.
   */
  function renderTool(name, toolbar) {
    const tool = toolset[name];
    const label = getTranslation(name, tool.label);
    const button = createElement('button', {
      type: 'button',
      title: label,
      'aria-label': label,
      'aria-pressed': false,
      'data-action': name,
      _innerHTML: "<svg><use href=\"#wysi-" + name + "\"></use></svg>"
    });

    // Tools that require parameters (e.g: link) need a popover
    if (tool.hasForm) {
      const popover = renderPopover(name, button);
      toolbar.appendChild(popover);

      // The other tools only display a button
    } else {
      toolbar.appendChild(button);
    }
  }

  /**
   * Render a tool group.
   * @param {object} details The group's properties.
   * @return {object} A DOM element containing the tool group.
   */
  function renderToolGroup(details) {
    const label = details.label || getTranslation('toolbar', 'Select an item');
    const options = details.items;
    const items = options.map(option => {
      const tool = toolset[option];
      const label = getTranslation(option, tool.label);
      const icon = option;
      const action = option;
      return {
        label,
        icon,
        action
      };
    });
    return renderListBox({
      label,
      items
    });
  }

  /**
   * Render format tool.
   * @return {object} A DOM element containing the format tool.
   */
  function renderFormatTool() {
    const toolName = 'format';
    const label = getTranslation(toolName, toolset.format.label);
    const paragraphLabel = getTranslation(toolName, toolset.format.paragraph);
    const headingLabel = getTranslation(toolName, toolset.format.heading);
    const classes = 'wysi-format';
    const items = toolset.format.tags.map(tag => {
      const name = tag;
      const label = tag === 'p' ? paragraphLabel : headingLabel + " " + tag.substring(1);
      const action = 'format';
      return {
        name,
        label,
        action
      };
    });
    return renderListBox({
      label,
      items,
      classes
    });
  }

  /**
   * Update toolbar buttons state.
   */
  function updateToolbarState() {
    const selection = document$1.getSelection();
    const anchorNode = selection.anchorNode;
    if (!anchorNode) {
      return;
    }
    const range = selection.getRangeAt(0);

    // This is to fix double click selection on Firefox not highlighting the relevant tool in some cases
    // We want to find the deepest child node to properly handle nested styles
    const candidateNode = findDeepestChildNode(range.startContainer.nextElementSibling || range.startContainer);

    // Fallback to the original selection.anchorNode if a more suitable node is not found
    const selectedNode = range.intersectsNode(candidateNode) ? candidateNode : anchorNode;

    // Get editor instance
    const {
      toolbar,
      editor,
      nodes
    } = findInstance(selectedNode);
    const tags = nodes.map(node => node.tagName.toLowerCase());

    // Abort if the selection is not within an editor instance
    if (!editor) {
      return;
    }

    // Check for an element with the selection class (likely a highlight)
    const selectedObject = editor.querySelector("." + selectedClass);

    // If such element exists, add its tag to the list of active tags
    if (selectedObject) {
      tags.push(selectedObject.tagName.toLowerCase());
    }

    // Get the list of allowed tags in the current editor instance
    const instanceId = getInstanceId(editor);
    const allowedTags = instances[instanceId].allowedTags;

    // Reset the state of all buttons
    toolbar.querySelectorAll('[aria-pressed="true"]').forEach(button => button.setAttribute('aria-pressed', 'false'));

    // Reset the state of all list boxes
    toolbar.querySelectorAll('.wysi-listbox > div > button:first-of-type').forEach(button => selectListBoxItem(button));

    // Update the buttons states
    tags.forEach(tag => {
      switch (tag) {
        case 'p':
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'li':
          const format = toolbar.querySelector("[data-action=\"format\"][data-option=\"" + tag + "\"]");
          if (format) selectListBoxItem(format);
          break;
        default:
          const allowedTag = allowedTags[tag];
          const action = allowedTag ? allowedTag.toolName : undefined;
          if (action) {
            const button = toolbar.querySelector("[data-action=\"" + action + "\"]");
            button.setAttribute('aria-pressed', 'true');
          }
      }
    });
  }

  /**
   * Embed SVG icons in the HTML document.
   */
  function embedSVGIcons() {
    // The icons will be included during the build process
    const icons = '<svg id="wysi-svg-icons" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="wysi-highlight" viewBox="0 0 24 24"><path d="M14.962 6.1H17.172V18H14.962V6.1ZM8.808 18H6.598V6.1H8.808V18ZM15.132 12.9H8.621V11.013H15.132V12.9Z"/></symbol><symbol id="wysi-bold" viewBox="0 0 24 24"><path d="M16.5,9.5A3.5,3.5,0,0,0,13,6H8.5a1,1,0,0,0-1,1V17a1,1,0,0,0,1,1H13a3.49,3.49,0,0,0,2.44-6A3.5,3.5,0,0,0,16.5,9.5ZM13,16H9.5V13H13a1.5,1.5,0,0,1,0,3Zm0-5H9.5V8H13a1.5,1.5,0,0,1,0,3Z"/></symbol><symbol id="wysi-italic" viewBox="0 0 24 24"><path d="M17,6H11a1,1,0,0,0,0,2h1.52l-3.2,8H7a1,1,0,0,0,0,2h6a1,1,0,0,0,0-2H11.48l3.2-8H17a1,1,0,0,0,0-2Z"/></symbol><symbol id="wysi-underline" viewBox="0 0 24 24"><path d="M12,15.5a5,5,0,0,0,5-5v-5a1,1,0,0,0-2,0v5a3,3,0,0,1-6,0v-5a1,1,0,0,0-2,0v5A5,5,0,0,0,12,15.5Zm5,2H7a1,1,0,0,0,0,2H17a1,1,0,0,0,0-2Z"/></symbol><symbol id="wysi-strike" viewBox="0 0 24 24"><path d="M12 6C9.33 6 7.5 7.34 7.5 9.5c0 .58.12 1.07.35 1.5H13c-1.49-.34-3.49-.48-3.5-1.5 0-1.03 1.08-1.75 2.5-1.75s2.5.83 2.5 1.75h2C16.5 7.4 14.67 6 12 6zm-5.5 6c-.67 0-.67 1 0 1h4.35c.5.17 1.04.34 1.65.5.58.15 1.75.23 1.75 1s-.66 1.75-2.25 1.75-2.5-1.01-2.5-1.75h-2c0 1.64 1.33 3.5 4.5 3.5s4.5-2.08 4.5-3.5c0-.58-.05-1.07-.2-1.5h1.2c.67 0 .67-1 0-1z"/></symbol><symbol id="wysi-ul" viewBox="0 0 24 24"><path d="M3 6a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7zm-4 5a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7zm-4 5a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7z"/></symbol><symbol id="wysi-ol" viewBox="0 0 24 24"><path d="M4 5c-.25 0-.5.17-.5.5v3c0 .67 1 .67 1 0v-3c0-.33-.25-.5-.5-.5zm4.5 1c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2zm-6 5.5h.75c0-.43.34-.75.75-.75.4 0 .75.28.75.75L2.5 13.25V14h3v-.75H3.75L5.5 12v-.5c0-.9-.73-1.49-1.5-1.5-.77 0-1.5.59-1.5 1.5zm6-.5c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2zM4 15c-.83 0-1.5.63-1.5 1.25h.75c0-.28.34-.5.75-.5s.75.22.75.5-.34.5-.75.5v.5c.41 0 .75.22.75.5s-.34.5-.75.5-.75-.22-.75-.5H2.5c0 .62.67 1.25 1.5 1.25s1.5-.5 1.5-1.12c0-.34-.2-.66-.56-.88.35-.2.56-.53.56-.87 0-.62-.67-1.12-1.5-1.12zm4.5 1c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2z"/></symbol><symbol id="wysi-link" viewBox="0 0 24 24"><path d="M8,12a1,1,0,0,0,1,1h6a1,1,0,0,0,0-2H9A1,1,0,0,0,8,12Zm2,3H7A3,3,0,0,1,7,9h3a1,1,0,0,0,0-2H7A5,5,0,0,0,7,17h3a1,1,0,0,0,0-2Zm7-8H14a1,1,0,0,0,0,2h3a3,3,0,0,1,0,6H14a1,1,0,0,0,0,2h3A5,5,0,0,0,17,7Z"/></symbol><symbol id="wysi-quote" viewBox="0 0 24 24"><path d="m9 6c-2.2 0-4 1.96-4 4.36v6c0 0.903 0.672 1.64 1.5 1.64h3c0.828 0 1.5-0.733 1.5-1.64v-3.27c0-0.903-0.672-1.64-1.5-1.64h-1.75c-0.414 0-0.75-0.367-0.75-0.818v-0.273c0-1.2 0.899-2.18 2-2.18h0.5c0.274 0 0.5-0.246 0.5-0.545v-1.09c0-0.298-0.226-0.545-0.5-0.545zm8 0c-2.2 0-4 1.96-4 4.36v6c0 0.903 0.672 1.64 1.5 1.64h3c0.828 0 1.5-0.733 1.5-1.64v-3.27c0-0.903-0.672-1.64-1.5-1.64h-1.75c-0.414 0-0.75-0.367-0.75-0.818v-0.273c0-1.2 0.899-2.18 2-2.18h0.5c0.274 0 0.5-0.246 0.5-0.545v-1.09c0-0.298-0.226-0.545-0.5-0.545z"/></symbol><symbol id="wysi-hr" viewBox="0 0 24 24"><path d="m20 11h-16c-1.33 0-1.33 2 0 2 0 0 16-0.018 16 0 1.33 0 1.33-2 0-2z"/></symbol><symbol id="wysi-removeFormat" viewBox="0 0 24 24"><path d="M7 6C5.67 6 5.67 8 7 8h3l-2 7c0 .02 2 0 2 0l2-7h3c1.33 0 1.33-2 0-2H7zm7.06 7c-.79-.04-1.49.98-.75 1.72l.78.78-.78.79c-.94.93.47 2.35 1.4 1.4l.79-.78.78.79c.94.93 2.35-.47 1.41-1.41l-.78-.79.78-.78c.94-.94-.47-2.35-1.4-1.41l-.8.79-.77-.79a.99.99 0 0 0-.66-.3zM7 16c-1.33 0-1.33 2 0 2 .02-.02 4 0 4 0 1.33 0 1.33-2 0-2H7z"/></symbol><symbol id="wysi-delete" viewBox="0 0 24 24"><path d="M10,18a1,1,0,0,0,1-1V11a1,1,0,0,0-2,0v6A1,1,0,0,0,10,18ZM20,6H16V5a3,3,0,0,0-3-3H11A3,3,0,0,0,8,5V6H4A1,1,0,0,0,4,8H5V19a3,3,0,0,0,3,3h8a3,3,0,0,0,3-3V8h1a1,1,0,0,0,0-2ZM10,5a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V6H10Zm7,14a1,1,0,0,1-1,1H8a1,1,0,0,1-1-1V8H17Zm-3-1a1,1,0,0,0,1-1V11a1,1,0,0,0-2,0v6A1,1,0,0,0,14,18Z"/></symbol><symbol id="wysi-autoFormat" viewBox="0 0 24 24"><path d="M9.24207 13.6332C9.3924 13.4826 9.64745 13.6099 9.61753 13.8206L9.44154 15.0569C9.40295 15.3287 9.42821 15.6058 9.51531 15.8662C9.60241 16.1266 9.74896 16.3631 9.94334 16.557L10.8268 17.4387C10.9774 17.5891 10.8501 17.8441 10.6394 17.8142L9.40312 17.6382C9.1313 17.5996 8.85422 17.6249 8.59386 17.712C8.33349 17.7991 8.09699 17.9456 7.9031 18.14L7.02133 19.0235C6.98861 19.0566 6.94629 19.0785 6.90039 19.0861C6.85449 19.0937 6.80737 19.0866 6.76574 19.0658C6.72412 19.045 6.69012 19.0116 6.66859 18.9704C6.64706 18.9292 6.63911 18.8822 6.64586 18.8361L6.82186 17.5998C6.86047 17.3281 6.83528 17.0511 6.74827 16.7907C6.66127 16.5304 6.51485 16.2939 6.3206 16.1L5.43659 15.218C5.40352 15.1853 5.38162 15.1429 5.37403 15.097C5.36643 15.0511 5.37353 15.004 5.3943 14.9624C5.41507 14.9208 5.44846 14.8868 5.4897 14.8652C5.53093 14.8437 5.57792 14.8358 5.62395 14.8425L6.86027 15.0185C7.13201 15.0571 7.40901 15.0319 7.66932 14.9449C7.92963 14.8579 8.16611 14.7115 8.36003 14.5172L9.24207 13.6332ZM13.8229 4.57726C13.8505 4.56499 13.8813 4.56173 13.9108 4.56793C13.9404 4.57413 13.9672 4.58949 13.9875 4.61182C14.0079 4.63415 14.0206 4.66232 14.024 4.69232C14.0274 4.72232 14.0213 4.75263 14.0065 4.77894L13.6101 5.48601C13.4336 5.80145 13.4157 6.18105 13.5617 6.51168L13.8899 7.25288C13.9022 7.28047 13.9055 7.31122 13.8993 7.34077C13.8931 7.37032 13.8777 7.39716 13.8554 7.41748C13.833 7.4378 13.8049 7.45057 13.7749 7.45397C13.7449 7.45737 13.7146 7.45123 13.6883 7.43642L12.9812 7.04001C12.8257 6.95287 12.6521 6.90313 12.4741 6.89475C12.2961 6.88636 12.1185 6.91955 11.9555 6.99169L11.2144 7.31989C11.1868 7.33216 11.156 7.33542 11.1265 7.32922C11.0969 7.32302 11.0701 7.30766 11.0498 7.28533C11.0294 7.263 11.0167 7.23483 11.0133 7.20483C11.0099 7.17483 11.016 7.14452 11.0308 7.11821L11.4272 6.41114C11.5144 6.25567 11.5641 6.08204 11.5725 5.90401C11.5809 5.72598 11.5477 5.54845 11.4755 5.38547L11.1474 4.64427C11.1351 4.61668 11.1318 4.58593 11.138 4.55638C11.1442 4.52683 11.1596 4.49999 11.1819 4.47967C11.2042 4.45935 11.2324 4.44658 11.2624 4.44318C11.2924 4.43979 11.3227 4.44593 11.349 4.46074L12.0561 4.85715C12.2116 4.94429 12.3852 4.99402 12.5632 5.00241C12.7412 5.01079 12.9188 4.9776 13.0817 4.90546L13.8229 4.57726ZM5.87908 7.79045C5.88874 7.76074 5.90741 7.73479 5.9325 7.71618C5.95759 7.69758 5.98785 7.68726 6.01908 7.68665C6.05031 7.68605 6.08095 7.69518 6.10674 7.7128C6.13254 7.73041 6.1522 7.75562 6.163 7.78493L6.44594 8.58177C6.57207 8.93798 6.85835 9.21334 7.21919 9.32553L8.02641 9.57728C8.05611 9.58694 8.08207 9.60561 8.10067 9.6307C8.11927 9.65579 8.12959 9.68605 8.1302 9.71728C8.13081 9.74851 8.12167 9.77915 8.10406 9.80494C8.08645 9.83074 8.06124 9.8504 8.03193 9.86121L7.23511 10.1441C7.05956 10.2064 6.90094 10.3086 6.77184 10.4429C6.64273 10.5771 6.54669 10.7396 6.49135 10.9174L6.2396 11.7246C6.22995 11.7543 6.21128 11.7803 6.18619 11.7989C6.1611 11.8175 6.13083 11.8278 6.09961 11.8284C6.06838 11.829 6.03774 11.8199 6.01195 11.8023C5.98615 11.7847 5.96649 11.7595 5.95568 11.7302L5.67275 10.9333C5.61054 10.7578 5.50826 10.5992 5.37403 10.47C5.2398 10.3409 5.07733 10.2449 4.8995 10.1896L4.09331 9.93779C4.06361 9.92813 4.03765 9.90946 4.01905 9.88437C4.00045 9.85928 3.99013 9.82902 3.98952 9.79779C3.98891 9.76656 3.99805 9.73592 4.01566 9.71012C4.03327 9.68433 4.05848 9.66466 4.08779 9.65386L4.88462 9.37092C5.24083 9.24479 5.51618 8.95851 5.62837 8.59766L5.87908 7.79045Z"/><path d="M11.2416 9.3966C12.0824 8.80382 13.2533 8.93276 13.9427 9.7257L19.6224 16.2599L19.7347 16.4025L19.7425 16.4132C20.3351 17.2538 20.2068 18.4239 19.4144 19.1134C18.6215 19.8027 17.4439 19.7674 16.6937 19.0636L16.5492 18.9142L10.8783 12.3898C10.1428 11.5437 10.2325 10.26 11.0785 9.52453L11.2416 9.3966ZM13.9252 13.5821L17.6947 17.9181L17.7709 17.9894C17.9602 18.1341 18.2306 18.1299 18.4173 17.9679C18.6306 17.7821 18.6545 17.4588 18.4691 17.2452L14.6996 12.9083L13.9252 13.5821ZM12.7982 10.7208C12.6127 10.5074 12.2875 10.4846 12.0736 10.67C11.8603 10.8559 11.8381 11.1811 12.0238 11.3946L12.93 12.4376L13.7045 11.7638L12.7982 10.7208Z"/></symbol><symbol id="wysi-markdownExport" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 8.33317C1 6.30813 2.64162 4.6665 4.66667 4.6665H19.3333C21.3583 4.6665 23 6.30813 23 8.33317V15.6665C23 17.6915 21.3583 19.3332 19.3333 19.3332H4.66667C2.64162 19.3332 1 17.6915 1 15.6665V8.33317ZM4.66667 6.49984C3.65414 6.49984 2.83333 7.32065 2.83333 8.33317V15.6665C2.83333 16.6791 3.65414 17.4998 4.66667 17.4998H19.3333C20.3459 17.4998 21.1667 16.6791 21.1667 15.6665V8.33317C21.1667 7.32065 20.3459 6.49984 19.3333 6.49984H4.66667ZM6.21012 8.38021C6.58443 8.25544 6.9966 8.38419 7.23333 8.69984L9.25 11.3887L11.2667 8.69984C11.5034 8.38419 11.9156 8.25544 12.2899 8.38021C12.6642 8.50498 12.9167 8.85528 12.9167 9.24984V14.7498C12.9167 15.2561 12.5063 15.6665 12 15.6665C11.4937 15.6665 11.0833 15.2561 11.0833 14.7498V11.9998L9.98333 13.4665C9.81022 13.6973 9.53853 13.8332 9.25 13.8332C8.96147 13.8332 8.68978 13.6973 8.51667 13.4665L7.41667 11.9998V14.7498C7.41667 15.2561 7.00626 15.6665 6.5 15.6665C5.99374 15.6665 5.58333 15.2561 5.58333 14.7498V9.24984C5.58333 8.85528 5.83581 8.50498 6.21012 8.38021ZM17.5 9.24984C17.5 8.74358 17.0896 8.33317 16.5833 8.33317C16.0771 8.33317 15.6667 8.74358 15.6667 9.24984V12.5368L15.3982 12.2683C15.0402 11.9104 14.4598 11.9104 14.1018 12.2683C13.7439 12.6263 13.7439 13.2067 14.1018 13.5647L15.9352 15.398C16.2931 15.756 16.8736 15.756 17.2315 15.398L19.0648 13.5647C19.4228 13.2067 19.4228 12.6263 19.0648 12.2683C18.7069 11.9104 18.1265 11.9104 17.7685 12.2683L17.5 12.5368V9.24984Z"/></symbol></defs></svg>';
    const svgElement = buildFragment(icons);
    document$1.body.appendChild(svgElement);
  }

  // Deselect selected element when clicking outside
  addListener(document$1, 'mousedown', '.wysi-editor, .wysi-editor *', event => {
    const selected = document$1.querySelector("." + selectedClass);
    if (selected && selected !== event.target) {
      selected.classList.remove(selectedClass);
    }
  });

  // "Select" a highlight when it's clicked
  addListener(document$1, 'mousedown', '.wysi-editor mark', event => {
    const highlight = event.target;
    highlight.classList.add(selectedClass);
  });

  // Toolbar button click
  addListener(document$1, 'click', '.wysi-toolbar > button', event => {
    const button = event.target;
    const state = JSON.parse(button.getAttribute('aria-pressed'));
    const action = button.dataset.action;
    const customAction = button.dataset.customAction;
    const {
      editor
    } = findInstance(button);
    const selection = document$1.getSelection();
    if (customAction) {
      // Execute custom action
      const instanceId = getInstanceId(editor);
      const instance = instances[instanceId];
      const customActions = instance.customActions || {};
      if (customActions[customAction] && customActions[customAction].action) {
        customActions[customAction].action(editor);
      }
    } else if (action && selection && editor.contains(selection.anchorNode)) {
      execAction(action, editor, {
        state,
        selection
      });
    }
  });

  // Update the toolbar buttons state
  addListener(document$1, 'selectionchange', updateToolbarState);
  addListener(document$1, 'input', '.wysi-editor', updateToolbarState);

  // include SVG icons
  DOMReady(embedSVGIcons);

  const STYLE_ATTRIBUTE = 'style';

  /**
   * Enable HTML tags belonging to a set of tools.
   * @param {array} tools A array of tool objects.
   * @return {object} The list of allowed tags.
   */
  function enableTags(tools) {
    const allowedTags = cloneObject(settings.allowedTags);
    tools.forEach(toolName => {
      const tool = cloneObject(toolset[toolName]);
      if (!tool || !tool.tags) {
        return;
      }
      const isEmpty = !!tool.isEmpty;
      const extraTags = tool.extraTags || [];
      const aliasList = tool.alias || [];
      const alias = aliasList.length ? tool.tags[0] : undefined;
      const tags = [...tool.tags, ...extraTags, ...aliasList];
      const attributes = tool.attributes || [];
      const styles = tool.styles || [];
      tags.forEach(tag => {
        allowedTags[tag] = {
          attributes,
          styles,
          alias,
          isEmpty
        };
        if (!extraTags.includes(tag)) {
          allowedTags[tag].toolName = toolName;
        }
      });
    });
    return allowedTags;
  }

  /**
   * Prepare raw content for editing.
   * @param {string} content The raw content.
   * @param {array} allowedTags The list of allowed tags.
   * @param {boolean} filterOnly If true, only filter the content, without further cleaning.
   * @return {string} The filtered HTML content.
   */
  function prepareContent(content, allowedTags, filterOnly) {
    const container = createElement('div');
    const fragment = buildFragment(content);
    filterContent(fragment, allowedTags);
    if (!filterOnly) {
      wrapTextNodes(fragment);
      cleanContent(fragment, allowedTags);
    }
    container.appendChild(fragment);
    return container.innerHTML;
  }

  /**
   * Remove unsupported CSS styles from a node.
   * @param {object} node The element to filter.
   * @param {array} allowedStyles An array of supported styles.
   */
  function filterStyles(node, allowedStyles) {
    const styleAttribute = node.getAttribute(STYLE_ATTRIBUTE);
    if (styleAttribute) {
      // Parse the styles
      const styles = styleAttribute.split(';').map(style => {
        const prop = style.split(':');
        return {
          name: prop[0].trim(),
          value: prop[1]
        };
      })
      // Filter the styles
      .filter(style => allowedStyles.includes(style.name))

      // Convert back to a style string
      .map(_ref => {
        let {
          name,
          value
        } = _ref;
        return name + ": " + value.trim() + ";";
      }).join('');
      if (styles !== '') {
        node.setAttribute(STYLE_ATTRIBUTE, styles);
      } else {
        node.removeAttribute(STYLE_ATTRIBUTE);
      }
    }
  }

  /**
   * Remove unsupported HTML tags and attributes.
   * @param {object} node The parent element to filter recursively.
   * @param {array} allowedTags The list of allowed tags.
   */
  function filterContent(node, allowedTags) {
    const children = Array.from(node.childNodes);
    if (!children || !children.length) {
      return;
    }
    children.forEach(childNode => {
      // Element nodes
      if (childNode.nodeType === 1) {
        // Filter recursively (deeper nodes first)
        filterContent(childNode, allowedTags);

        // Check if the current element is allowed
        const tag = childNode.tagName.toLowerCase();
        const allowedTag = allowedTags[tag];
        const attributes = Array.from(childNode.attributes);
        if (allowedTag) {
          const allowedAttributes = allowedTag.attributes || [];
          const allowedStyles = allowedTag.styles || [];

          // Remove attributes that are not allowed
          for (let i = 0; i < attributes.length; i++) {
            const attributeName = attributes[i].name;
            if (!allowedAttributes.includes(attributes[i].name)) {
              if (attributeName === STYLE_ATTRIBUTE && allowedStyles.length) {
                filterStyles(childNode, allowedStyles);
              } else {
                childNode.removeAttribute(attributes[i].name);
              }
            }
          }

          // If the tag is an alias, replace it with the standard tag
          // e.g: <b> tags will be replaced with <strong> tags
          if (allowedTag.alias) {
            replaceNode(childNode, allowedTag.alias, true);
          }
        } else {
          // Remove style nodes
          if (tag === 'style') {
            node.removeChild(childNode);

            // And unwrap the other nodes
          } else {
            childNode.replaceWith(...childNode.childNodes);
          }
        }

        // Remove comment nodes
      } else if (childNode.nodeType === 8) {
        node.removeChild(childNode);
      }
    });
  }

  /**
   * Remove empty nodes.
   * @param {object} node The parent element to filter recursively.
   * @param {array} allowedTags The list of allowed tags.
   */
  function cleanContent(node, allowedTags) {
    const children = Array.from(node.childNodes);
    if (!children || !children.length) {
      return;
    }
    children.forEach(childNode => {
      // Remove empty element nodes
      if (childNode.nodeType === 1) {
        // Filter recursively (deeper nodes first)
        cleanContent(childNode, allowedTags);

        // Check if the element can be empty
        const tag = childNode.tagName.toLowerCase();
        const allowedTag = allowedTags[tag];
        if (allowedTag && !allowedTag.isEmpty && trimText(childNode.innerHTML) === '') {
          node.removeChild(childNode);
        }
      }
    });
  }

  /**
   * Wrap the child text nodes in a paragraph (non-recursively).
   * @param {object} node The parent element of the text nodes.
   */
  function wrapTextNodes(node) {
    const children = Array.from(node.childNodes);
    if (!children || !children.length) {
      return;
    }
    let appendToPrev = false;
    children.forEach(childNode => {
      if (childNode.nodeType !== 3 && blockElements.includes(childNode.tagName)) {
        appendToPrev = false;
        return;
      }

      // Remove empty text node
      /*if (trimText(childNode.textContent) === '') {
        node.removeChild(childNode);
       // Wrap text node in a paragraph
      } else {*/
      if (appendToPrev) {
        const prev = childNode.previousElementSibling;
        if (prev) {
          prev.appendChild(childNode);
        }
      } else {
        replaceNode(childNode, 'p');
        appendToPrev = true;
      }
      /*}*/
    });
  }

  /**
   * Trim whitespace from the start and end of a text.
   * @param {string} text The text to trim.
   * @return {string} The trimmed text.
   */
  function trimText(text) {
    return text.replace(/^\s+|\s+$/g, '').trim();
  }

  // Next available instance id
  let nextId = 0;

  /**
   * Init WYSIWYG editor instances.
   * @param {object} options Configuration options.
   */
  function init(options) {
    const globalTranslations = window.wysiGlobalTranslations || {};
    const translations = Object.assign({}, globalTranslations, options.translations || {});

    // Store translated strings
    storeTranslations(translations);
    const tools = options.tools || settings.tools;
    const selector = options.el || settings.el;
    const targetEls = getTargetElements(selector);
    const customActions = options.customActions || {};
    const toolbar = renderToolbar(tools, customActions);
    const allowedTags = enableTags(tools);
    const customTags = options.customTags || [];

    // Add custom tags if any to the allowed tags list
    customTags.forEach(custom => {
      if (custom.tags) {
        const attributes = custom.attributes || [];
        const styles = custom.styles || [];
        const isEmpty = !!custom.isEmpty;
        custom.tags.forEach(tag => {
          allowedTags[tag] = {
            attributes,
            styles,
            isEmpty
          };
        });
      }
    });

    // Append an editor instance to target elements
    targetEls.forEach(field => {
      const sibling = field.previousElementSibling;
      if (!sibling || !hasClass(sibling, 'wysi-wrapper')) {
        const instanceId = nextId++;

        // Store the instance's options 
        instances[instanceId] = options;

        // Cache the list of allowed tags in the instance
        instances[instanceId].allowedTags = cloneObject(allowedTags);

        // Wrapper
        const wrapper = createElement('div', {
          class: 'wysi-wrapper'
        });

        // Editable region
        const editor = createElement('div', {
          class: 'wysi-editor',
          contenteditable: true,
          role: 'textbox',
          'aria-multiline': true,
          'aria-label': getTextAreaLabel(field),
          'data-wid': instanceId,
          _innerHTML: prepareContent(field.value, allowedTags)
        });

        // Insert the editor instance in the document
        wrapper.appendChild(toolbar.cloneNode(true));
        wrapper.appendChild(editor);
        field.before(wrapper);

        // Apply configuration
        configure(wrapper, options);

        // Reconfigure instance
      } else {
        configure(sibling, options);
      }
    });
  }

  /**
   * Configure a WYSIWYG editor instance.
   * @param {object} instance The editor instance to configure.
   * @param {object} options The configuration options.
   */
  function configure(instance, options) {
    if (typeof options !== 'object') {
      return;
    }
    for (const key in options) {
      switch (key) {
        case 'autoGrow':
        case 'autoHide':
          instance.classList.toggle("wysi-" + key.toLowerCase(), !!options[key]);
          break;
        case 'height':
          const height = options.height;
          if (!isNaN(height)) {
            const editor = instance.lastChild;
            editor.style.minHeight = height + "px";
            editor.style.maxHeight = height + "px";
          }
          break;
      }
    }
  }

  /**
   * Update the content of a WYSIWYG editor instance.
   * @param {object} textarea The textarea eleement.
   * @param {object} editor The editable region.
   * @param {string} instanceId The id of the instance.
   * @param {string} rawContent The new unfiltered content of the instance.
   * @param {boolean} setEditorContent Whether to update the content of the editable region.
   */
  function updateContent(textarea, editor, instanceId, rawContent, setEditorContent) {
    const instance = instances[instanceId];
    const content = prepareContent(rawContent, instance.allowedTags);
    const onChange = instance.onChange;
    if (setEditorContent === true) {
      editor.innerHTML = content;
    }
    textarea.value = content;
    dispatchEvent(textarea, 'change');
    if (onChange) {
      onChange(content);
    }
  }

  /**
   * Destroy a WYSIWYG editor instance.
   * @param {string} selector One or more selectors pointing to textarea fields.
   */
  function destroy(selector) {
    const editorInstances = findEditorInstances(selector);
    for (const editorInstance of editorInstances) {
      const {
        instanceId,
        wrapper,
        editor
      } = editorInstance;
      delete instances[instanceId];
      clearHistory(editor);
      wrapper.remove();
    }
  }

  /**
   * Set the content of a WYSIWYG editor instance programmatically.
   * @param {string} selector One or more selectors pointing to textarea fields.
   * @param {string} content The new content of the editor instance.
   */
  function setContent(selector, content) {
    const editorInstances = findEditorInstances(selector);
    for (const editorInstance of editorInstances) {
      const {
        textarea,
        editor,
        instanceId
      } = editorInstance;
      updateContent(textarea, editor, instanceId, content, true);
      clearHistory(editor);
    }
  }

  /**
   * Clean up content before pasting it in an editor.
   * @param {object} event The browser's paste event.
   */
  function cleanPastedContent(event) {
    const {
      editor,
      nodes
    } = findInstance(event.target);
    const clipboardData = event.clipboardData;
    if (editor && clipboardData.types.includes('text/html')) {
      const pasted = clipboardData.getData('text/html');
      const instanceId = getInstanceId(editor);
      const allowedTags = instances[instanceId].allowedTags;
      let content = prepareContent(pasted, allowedTags);

      // Detect a heading tag in the current selection
      const splitHeadingTag = nodes.filter(n => headingElements.includes(n.tagName)).length > 0;

      // Force split the heading tag if any.
      // This fixes a bug in Webkit/Blink browsers where the whole content is converted to a heading
      if (splitHeadingTag && !isFirefox) {
        const splitter = "<h1 class=\"" + placeholderClass + "\"><br></h1><p class=\"" + placeholderClass + "\"><br></p>";
        content = splitter + content + splitter;
      }

      // Manually paste the cleaned content
      execCommand('insertHTML', content);
      if (splitHeadingTag && !isFirefox) {
        // Remove placeholder elements if any
        editor.querySelectorAll("." + placeholderClass).forEach(fragment => {
          fragment.remove();
        });

        // Unwrap nested heading elements to fix a bug in Webkit/Blink browsers
        editor.querySelectorAll(headingElements.join()).forEach(heading => {
          const firstChild = heading.firstElementChild;
          if (firstChild && blockElements.includes(firstChild.tagName)) {
            heading.replaceWith(...heading.childNodes);
          }
        });
      }

      // Prevent the default paste action
      event.preventDefault();
    }
  }

  /**
   * Bootstrap the WYSIWYG editor.
   */
  function bootstrap() {
    // Configure editable regions
    execCommand('styleWithCSS', false);
    execCommand('enableObjectResizing', false);
    execCommand('enableInlineTableEditing', false);
    execCommand('defaultParagraphSeparator', 'p');

    // Update the textarea value when the editor's content changes
    addListener(document$1, 'input', '.wysi-editor', event => {
      const editor = event.target;

      // Skip if input events are being suppressed (e.g., during highlight command)
      if (suppressInputEvents.has(editor)) {
        return;
      }
      const textarea = editor.parentNode.nextElementSibling;
      const instanceId = getInstanceId(editor);
      const content = editor.innerHTML;
      updateContent(textarea, editor, instanceId, content);
    });

    // Clean up pasted content
    addListener(document$1, 'paste', cleanPastedContent);

    // Handle undo/redo keyboard shortcuts
    addListener(document$1, 'keydown', event => {
      // Check if the target is within an editor
      const target = event.target;
      if (!target.closest || !target.closest('.wysi-editor')) {
        return;
      }
      const {
        editor
      } = findInstance(target);
      if (!editor) return;
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;
      const key = event.key.toLowerCase();
      if (isCtrl && key === 'z' && !isShift) {
        // Ctrl+Z: Undo (only if available)
        if (canUndo(editor)) {
          event.preventDefault();
          undo(editor);
        }
      } else if (isCtrl && key === 'y' || isCtrl && isShift && key === 'z') {
        // Ctrl+Y or Ctrl+Shift+Z: Redo (only if available)
        if (canRedo(editor)) {
          event.preventDefault();
          redo(editor);
        }
      }
    });
  }

  // Expose Wysi to the global scope
  window.Wysi = (() => {
    const methods = {
      destroy,
      setContent
    };
    function Wysi(options) {
      DOMReady(() => {
        init(options || {});
      });
    }
    for (const key in methods) {
      Wysi[key] = function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        DOMReady(methods[key], args);
      };
    }
    return Wysi;
  })();

  // Bootstrap Wysi when the DOM is ready
  DOMReady(bootstrap);

})(window, document);
