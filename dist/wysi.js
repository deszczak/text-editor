/*!
 * Originally made by Momo Bassit.
 * https://github.com/mdbassit/Wysi
 */
(function (window, document$1) {
  'use strict';

  // Default settings
  var settings = {
    el: '[data-wysi], .wysi-field',
    tools: ['format', '|', 'bold', 'italic', 'underline', 'strike', 'highlight', '|', 'ul', 'ol', '|', 'link', 'hr', 'quote', '|', 'autoFormat', 'removeFormat', '|', 'markdownExport'],
    height: 200,
    autoGrow: false,
    autoHide: false,
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
    }
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

  // CSS classes
  const selectedClass = 'wysi-selected';
  const placeholderClass = 'wysi-fragment-placeholder';

  // Element categories
  const headingElements = ['H1', 'H2', 'H3', 'H4'];
  const blockElements = ['BLOCKQUOTE', 'HR', 'P', 'OL', 'UL', ...headingElements];

  // Browser detection
  const isFirefox = navigator.userAgent.includes('Gecko/');

  /**
   * Create an element with optional attributes.
   * @param {string} tag - HTML tag name
   * @param {object} attrs - Element attributes (prefix with _ for properties)
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs) {
    if (attrs === void 0) {
      attrs = {};
    }
    const el = document$1.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key[0] === '_') el[key.slice(1)] = val;else el.setAttribute(key, val);
    }
    return el;
  }

  /**
   * Replace a DOM element while preserving content.
   * @param {HTMLElement} node - Element to replace
   * @param {string} tag - New element tag
   * @param {boolean} copyAttrs - Copy original attributes
   * @returns {HTMLElement}
   */
  function replaceNode(node, tag, copyAttrs) {
    if (copyAttrs === void 0) {
      copyAttrs = false;
    }
    const newEl = createElement(tag);
    newEl.innerHTML = node.innerHTML || node.textContent || node.outerHTML;
    if (copyAttrs && node.attributes) {
      for (const attr of node.attributes) {
        newEl.setAttribute(attr.name, attr.value);
      }
    }
    node.parentNode.replaceChild(newEl, node);
    return newEl;
  }

  var _NodeList;

  // Store the current DOM selection for later use
  let currentSelection;

  // Unique marker ID counter
  let markerIdCounter = 0;

  // Polyfill for NodeList.forEach
  if ((_NodeList = NodeList) != null && _NodeList.prototype && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  /**
   * Add event listener with optional delegation
   * @param {object} context - Event target
   * @param {string} type - Event type
   * @param {string|function} selector - Target selector or handler
   * @param {function} [fn] - Event handler
   */
  function addListener(context, type, selector, fn) {
    if (typeof selector === 'string') {
      context.addEventListener(type, e => {
        const target = e.target.closest(selector);
        if (target) fn.call(target, e);
      });
    } else context.addEventListener(type, selector);
  }

  /**
   * Build HTML fragment from string
   * @param {string} html - HTML code
   * @returns {DocumentFragment}
   */
  function buildFragment(html) {
    const template = createElement('template');
    template.innerHTML = html.trim();
    return template.content;
  }

  /**
   * Execute function when DOM is ready
   * @param {function} fn - Function to execute
   * @param {array} [args] - Arguments to pass
   */
  function DOMReady(fn, args) {
    if (args === void 0) {
      args = [];
    }
    if (document$1.readyState !== 'loading') fn(...args);else addListener(document$1, 'DOMContentLoaded', () => fn(...args));
  }

  /**
   * Find the deepest child node
   * @param {Node} node - Target node
   * @returns {Node} Deepest child
   */
  const findDeepestChildNode = node => {
    while (node.firstChild) node = node.firstChild;
    return node;
  };

  /**
   * Find WYSIWYG editor instances
   * @param {string} selector - Textarea selectors
   * @returns {array} Editor instances
   */
  function findEditorInstances(selector) {
    return getTargetElements(selector).map(textarea => {
      const wrapper = textarea.previousElementSibling;
      if (wrapper && !wrapper.classList.contains('wysi-wrapper')) return null;
      const [toolbar, editor] = wrapper.children;
      return {
        textarea,
        wrapper,
        toolbar,
        editor,
        instanceId: getInstanceId$1(editor)
      };
    }).filter(Boolean);
  }

  /**
   * Find current editor instance
   * @param {Node || HTMLElement} currentNode - Possible child node
   * @returns {object} Instance data
   */
  function findInstance(currentNode) {
    const nodes = [];
    let ancestor, toolbar, editor;
    while (currentNode && currentNode !== document$1.body) {
      if (currentNode.tagName) {
        if (currentNode.classList.contains('wysi-wrapper')) {
          ancestor = currentNode;
          break;
        }
        nodes.push(currentNode);
      }
      currentNode = currentNode.parentNode;
    }
    if (ancestor) [toolbar, editor] = ancestor.children;
    return {
      toolbar,
      editor,
      nodes
    };
  }
  const getCurrentSelection = () => currentSelection;

  /**
   * Get HTML content of document fragment
   * @param {HTMLElement} fragment - Document fragment
   * @returns {string} HTML content
   */
  function getFragmentContent(fragment) {
    const wrapper = createElement('div');
    wrapper.appendChild(fragment);
    return wrapper.innerHTML;
  }

  /**
   * Get editor instance ID
   * @param {HTMLElement} editor - Editor element
   * @returns {string} Instance ID
   */
  const getInstanceId$1 = editor => editor == null ? void 0 : editor.dataset.wid;

  /**
   * Get DOM elements from selector
   * @param {string|object} selector - CSS selector, DOM element, or list
   * @returns {array} DOM elements
   */
  function getTargetElements(selector) {
    if (typeof selector === 'string') return [...document$1.querySelectorAll(selector)];
    if (selector instanceof Node) return [selector];
    if (selector instanceof NodeList || selector instanceof HTMLCollection) return [...selector];
    if (Array.isArray(selector)) return selector.filter(el => el instanceof Node);
    return [];
  }

  /**
   * Try to guess textarea element's label
   * @param {HTMLElement} textarea - Textarea element
   * @returns {string} Label text
   */
  function getTextAreaLabel(textarea) {
    const {
      parentNode,
      id
    } = textarea;
    const labelElement = parentNode.nodeName === 'LABEL' ? parentNode : id ? document$1.querySelector("label[for=\"" + id + "\"]") : null;
    if (labelElement) {
      const text = [...labelElement.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.replace(/\s+/g, ' ').trim()).find(l => l);
      if (text) return text;
    }
    return '';
  }

  /**
   * Restore the previous selection if any
   */
  function restoreCurrentSelection() {
    if (currentSelection) {
      setSelection(currentSelection);
      currentSelection = undefined;
    }
  }

  /**
   * Create unique marker element for selection boundaries
   * @returns {HTMLScriptElement} Marker element
   */
  const createMarker = () => {
    const script = document$1.createElement('script');
    script.type = 'marker';
    script.id = "mark-" + markerIdCounter++;
    return script;
  };

  /**
   * Save the current selection by inserting temporary markers
   * @param {Selection} [selection] - Selection to save
   * @returns {Array|null} Marker elements
   */
  function placeSelectionMarkers(selection) {
    var _selection;
    if (selection === void 0) {
      selection = document$1.getSelection();
    }
    if (!((_selection = selection) != null && _selection.rangeCount)) return null;
    const range = selection.getRangeAt(0);
    const startMarker = createMarker();
    const endMarker = createMarker();
    const startRange = range.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);
    const endRange = range.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);
    return [startMarker, endMarker];
  }

  /**
   * Remove tag from node
   * @param {HTMLElement} node - Node to process
   */
  const removeTag = node => node.outerHTML = node.innerHTML;

  /**
   * Get new marker references after DOM changes
   * @param {HTMLScriptElement[]} markers - Saved markers
   * @returns {HTMLScriptElement[]} New references
   */
  const getNewMarkerReferences = markers => markers.map(m => document$1.getElementById(m.id));

  /**
   * Restore selection using marker elements
   * @param {HTMLScriptElement[]} markers - Start and end markers
   * @param {boolean} [removeMarkers=true] - Remove markers after restoring
   */
  function restoreMarkerSelection(markers, removeMarkers) {
    if (removeMarkers === void 0) {
      removeMarkers = true;
    }
    if (markers.length !== 2) return;
    const [start, end] = markers;
    const range = document$1.getSelection().getRangeAt(0);
    range.setStartAfter(start);
    range.setEndBefore(end);
    setSelection(range);
    if (removeMarkers) {
      start.remove();
      end.remove();
    }
  }
  const setCurrentSelection = range => currentSelection = range;

  /**
   * Set selection to a range
   * @param {Range} range - Range to select
   */
  function setSelection(range) {
    const selection = document$1.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Set button expanded state
   * @param {HTMLElement} button - Button element
   * @param {boolean} expanded - Expanded state
   */
  const toggleButton = (button, expanded) => button.setAttribute('aria-expanded', String(expanded));

  /**
   * Get all selected nodes
   * @param {Selection} [selection] - Selection to get nodes from
   * @returns {array} Selected nodes
   */
  function getSelectedNodes(selection) {
    var _selection2;
    if (selection === void 0) {
      selection = document$1.getSelection();
    }
    if (!((_selection2 = selection) != null && _selection2.rangeCount)) return [];
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    const nodes = [];
    const walker = document$1.createTreeWalker(parent, NodeFilter.SHOW_ALL, {
      acceptNode: node => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    let currentNode = walker.currentNode;
    while (currentNode) {
      if (range.intersectsNode(currentNode) && currentNode !== container) {
        nodes.push(currentNode);
      }
      currentNode = walker.nextNode();
    }
    return nodes;
  }

  /**
   * Remove all tags within selection range
   * @param {Selection} selection - Selection containing content
   * @param {string} tag - Tag name to remove
   */
  function removeAllInSelection(selection, tag) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const elsToRemove = [...container.querySelectorAll(tag)].filter(el => range.intersectsNode(el));
    if (!elsToRemove.length && container.tagName === tag) {
      removeTag(container);
    } else {
      elsToRemove.forEach(el => {
        if (el.parentElement.classList.contains('wysi-editor')) {
          replaceNode(el, 'p');
        } else removeTag(el);
      });
    }
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   */
  function copyToClipboard(text) {
    var _navigator$clipboard;
    if ((_navigator$clipboard = navigator.clipboard) != null && _navigator$clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(err => console.error('Failed to copy:', err));
      return;
    }

    // Fallback for older browsers
    const textarea = document$1.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0';
    document$1.body.appendChild(textarea);
    textarea.select();
    try {
      document$1.execCommand('copy');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    document$1.body.removeChild(textarea);
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {HTMLElement} editor - Editor element
   */
  function showToast(message, editor) {
    var _document$querySelect;
    (_document$querySelect = document$1.querySelector('.wysi-toast')) == null ? void 0 : _document$querySelect.remove();
    const toast = document$1.createElement('div');
    toast.className = 'wysi-toast';
    toast.textContent = message;
    const wrapper = (editor == null ? void 0 : editor.closest('.wysi-wrapper')) || editor || document$1.body;
    wrapper.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('wysi-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('wysi-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Shortcuts
  const dispatchEvent = (el, event) => el.dispatchEvent(new Event(event, {
    bubbles: true
  }));
  const execCommand = function (command, value) {
    if (value === void 0) {
      value = null;
    }
    return document$1.execCommand(command, false, value);
  };
  const hasClass = (el, className) => {
    var _el$classList;
    return (_el$classList = el.classList) == null ? void 0 : _el$classList.contains(className);
  };
  const trimText = text => text.trim().replace(/^\s+|\s+$/g, '');
  const cloneObject = obj => obj ? JSON.parse(JSON.stringify(obj)) : obj;

  /**
   * Text formatting utilities
   */

  // Orphans
  const ORPHAN_PATTERN = /(^| )([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /gm;
  const DOUBLE_ORPHAN_PATTERN = /\xa0([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /g;

  /**
   * Add non-breaking spaces after orphan words
   */
  const nbsp = text => {
    let result = text;
    let prev = null;
    let iterations = 0;

    // Step 1: Replace space after orphan with non-breaking space
    while (prev !== result && iterations < 5) {
      prev = result;
      result = result.replace(ORPHAN_PATTERN, '$1$2\xa0');
      iterations++;
    }

    // Step 2: Handle double orphans
    prev = null;
    iterations = 0;
    while (prev !== result && iterations < 5) {
      prev = result;
      result = result.replace(DOUBLE_ORPHAN_PATTERN, '\xa0$1\xa0');
      iterations++;
    }
    return result;
  };

  /**
   * Replace hyphens surrounded by spaces with en-dash
   */
  const dash = text => text.replace(/(\s-)+\s/g, m => m === ' - ' ? ' – ' : m);

  /**
   * Fix spacing around punctuation marks
   */
  const punctuation = text => text.replace(/[^\S\r\n]+([,.!?;:\]])/g, '$1').replace(/([,.!?;:\]])[^\S\r\n]{2,}/g, '$1 ');

  /**
   * Apply all formatting: punctuation, nbsp (orphan words), and dash
   */
  const autoFormat = text => punctuation(nbsp(dash(text)));

  /**
   * Format all text nodes within a container element
   * @param {Element} container - Element containing text to format
   */
  const formatTextNodes = container => {
    if (!container) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.textContent.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    let node;
    while (node = walker.nextNode()) nodes.push(node);
    nodes.forEach(n => {
      const formatted = autoFormat(n.textContent);
      if (formatted !== n.textContent) n.textContent = formatted;
    });
  };

  /**
   * Convert HTML content to Markdown.
   * @param {HTMLElement} element - Element containing HTML content
   * @returns {string} Markdown text
   */
  function htmlToMarkdown(element) {
    const processNode = node => {
      var _converters$tag, _converters$tag2;
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      const content = [...node.childNodes].map(processNode).join('');
      const converters = {
        h1: () => "# " + content + "\n\n",
        h2: () => "## " + content + "\n\n",
        h3: () => "### " + content + "\n\n",
        h4: () => "#### " + content + "\n\n",
        p: () => content + "\n\n",
        strong: () => "**" + content + "**",
        b: () => "**" + content + "**",
        em: () => "_" + content + "_",
        i: () => "_" + content + "_",
        u: () => "<u>" + content + "</u>",
        s: () => "~~" + content + "~~",
        del: () => "~~" + content + "~~",
        strike: () => "~~" + content + "~~",
        mark: () => "==" + content + "==",
        a: () => "[" + content + "](" + (node.getAttribute('href') || '') + ")",
        blockquote: () => content.split('\n').filter(l => l.trim()).map(l => "> " + l).join('\n') + '\n\n',
        ul: () => content + "\n",
        ol: () => content + "\n",
        li: () => {
          const parent = node.parentElement;
          const prefix = (parent == null ? void 0 : parent.tagName.toLowerCase()) === 'ol' ? [...parent.children].indexOf(node) + 1 + ". " : '- ';
          return "" + prefix + content + "\n";
        },
        br: () => '\n',
        hr: () => '---\n\n',
        div: () => content + "\n"
      };
      return (_converters$tag = (_converters$tag2 = converters[tag]) == null ? void 0 : _converters$tag2.call(converters)) != null ? _converters$tag : content;
    };
    return [...element.childNodes].map(processNode).join('').trim();
  }

  const MAX_HISTORY = 20;
  const undoStack = new Map();
  const redoStack = new Map();
  const getInstanceId = editor => editor == null ? void 0 : editor.dataset.wid;
  const createState = editor => ({
    html: editor.innerHTML,
    selection: saveSelection(editor)
  });
  const pushState = (stack, instanceId, state) => {
    const states = stack.get(instanceId) || [];
    states.push(state);
    if (states.length > MAX_HISTORY) states.shift();
    stack.set(instanceId, states);
  };
  const popState = (stack, instanceId) => {
    const states = stack.get(instanceId);
    return states == null ? void 0 : states.pop();
  };
  function saveState(editor) {
    const instanceId = getInstanceId(editor);
    if (!instanceId) return;
    pushState(undoStack, instanceId, createState(editor));
    redoStack.delete(instanceId);
  }
  function undo(editor) {
    const instanceId = getInstanceId(editor);
    if (!instanceId) return false;
    const prevState = popState(undoStack, instanceId);
    if (!prevState) return false;
    pushState(redoStack, instanceId, createState(editor));
    editor.innerHTML = prevState.html;
    restoreSelection(editor, prevState.selection);
    editor.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    showToast('Undo', editor);
    return true;
  }
  function redo(editor) {
    const instanceId = getInstanceId(editor);
    if (!instanceId) return false;
    const nextState = popState(redoStack, instanceId);
    if (!nextState) return false;
    pushState(undoStack, instanceId, createState(editor));
    editor.innerHTML = nextState.html;
    restoreSelection(editor, nextState.selection);
    editor.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    showToast('Redo', editor);
    return true;
  }
  const canUndo = editor => {
    var _undoStack$get;
    const instanceId = getInstanceId(editor);
    return instanceId ? ((_undoStack$get = undoStack.get(instanceId)) == null ? void 0 : _undoStack$get.length) > 0 : false;
  };
  const canRedo = editor => {
    var _redoStack$get;
    const instanceId = getInstanceId(editor);
    return instanceId ? ((_redoStack$get = redoStack.get(instanceId)) == null ? void 0 : _redoStack$get.length) > 0 : false;
  };
  function clearHistory(editor) {
    const instanceId = getInstanceId(editor);
    if (instanceId) {
      undoStack.delete(instanceId);
      redoStack.delete(instanceId);
    }
  }
  function saveSelection(editor) {
    const selection = document$1.getSelection();
    if (!(selection != null && selection.rangeCount)) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return {
      startContainer: getNodePath(editor, range.startContainer),
      startOffset: range.startOffset,
      endContainer: getNodePath(editor, range.endContainer),
      endOffset: range.endOffset
    };
  }
  function restoreSelection(editor, saved) {
    if (!saved) return;
    try {
      const start = getNodeFromPath(editor, saved.startContainer);
      const end = getNodeFromPath(editor, saved.endContainer);
      if (!start || !end) return;
      const range = document$1.createRange();
      range.setStart(start, saved.startOffset);
      range.setEnd(end, saved.endOffset);
      const selection = document$1.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_unused) {
      editor.focus();
    }
  }
  function getNodePath(root, node) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      path.unshift([...parent.childNodes].indexOf(current));
      current = parent;
    }
    return path;
  }
  function getNodeFromPath(root, path) {
    return path.reduce((current, index) => {
      var _current$childNodes;
      return current == null ? void 0 : (_current$childNodes = current.childNodes) == null ? void 0 : _current$childNodes[index];
    }, root) || null;
  }

  const suppressInputEvents = new WeakSet();
  function execAction(action, editor, options) {
    const tool = toolset[action];
    if (!tool) return;
    restoreCurrentSelection();
    saveState(editor);
    execEditorCommand(editor, tool.command || action, options);
    editor.normalize();
    editor.focus();
  }
  function execEditorCommand(editor, command, options) {
    if (command === 'format' && Array.isArray(options)) {
      execCommand('formatBlock', "<" + options[0] + ">");
      return;
    }
    if (command === 'link' && Array.isArray(options)) {
      const [url, target = '', text] = options;
      if (text) {
        const targetAttr = target ? " target=\"" + target + "\"" : '';
        execCommand('insertHTML', "<a href=\"" + url + "\"" + targetAttr + ">" + text + "</a>");
      }
      return;
    }
    if (command === 'autoFormat') {
      const sel = document.getSelection();
      let container = sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0).commonAncestorContainer : null;
      if (container && container.nodeType !== Node.ELEMENT_NODE) container = container.parentElement;
      formatTextNodes(container || editor);
      dispatchEvent(editor, 'input');
      showToast('Formatted Text', editor);
      return;
    }
    if (command === 'markdownExport') {
      if (!editor) return;
      copyToClipboard(htmlToMarkdown(editor));
      showToast('Markdown copied to clipboard', editor);
      return;
    }
    if (command === 'removeFormat') {
      execCommand(command);
      if (editor && options && options.selection && options.selection.type === 'Range') {
        showToast('Formatting removed', editor);
      }
      return;
    }
    if (command === 'quote') {
      if (options && options.state) revertState(editor, command, options.selection);else execCommand('formatBlock', '<blockquote>');
      return;
    }
    if (command === 'insertHorizontalRule') {
      if (options && options.state) {
        revertState(editor, 'hr', options.selection);
      } else execCommand(command);
      return;
    }
    if (command === 'highlight') {
      if (options && options.state) {
        revertState(editor, command, options.selection);
      } else {
        const markers = placeSelectionMarkers(options.selection);
        suppressInputEvents.add(editor);
        execCommand('hiliteColor', '#ffff00');
        suppressInputEvents.delete(editor);
        getSelectedNodes().forEach(n => {
          if (n.tagName === 'SPAN') replaceNode(n, 'mark').classList.add(selectedClass);
        });
        restoreMarkerSelection(getNewMarkerReferences(markers));
        dispatchEvent(editor, 'input');
      }
      return;
    }
    execCommand(command);
  }
  function revertState(editor, command, selection) {
    const anchor = selection.anchorNode;
    const elementToModify = anchor.tagName ? anchor : anchor.parentNode;
    const markers = placeSelectionMarkers();
    if (command === 'highlight') removeAllInSelection(selection, 'MARK');else if (command === 'quote') removeAllInSelection(selection, 'BLOCKQUOTE');else if (command === 'hr') removeTag(elementToModify);
    restoreMarkerSelection(getNewMarkerReferences(markers));
    dispatchEvent(editor, 'input');
  }

  let uniqueFieldId = 0;

  /**
   * Render a popover form for tool parameters
   * @param {string} toolName - Tool name
   * @param {HTMLElement} button - Toolbar button
   * @returns {HTMLElement}
   */
  function renderPopover(toolName, button) {
    const tool = toolset[toolName];
    const fields = tool.attributes.map((attr, i) => ({
      name: attr,
      label: tool.attributeLabels[i]
    }));
    const wrapper = createElement('div', {
      class: 'wysi-popover'
    });
    const popover = createElement('div', {
      tabindex: -1
    });
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    wrapper.append(button, popover);

    // Add regular fields
    fields.forEach(field => {
      if (toolName === 'link' && field.name === 'target') return;
      popover.appendChild(createElement('label', {
        _innerHTML: "<span>" + field.label + "</span><input type=\"text\" name=\"wysi-" + field.name + "\" data-attribute=\"" + field.name + "\">"
      }));
    });

    // Link-specific fields
    if (toolName === 'link') {
      const targetField = fields.find(f => f.name === 'target');
      if (targetField) {
        var _tool$formOptions;
        targetField.toolName = toolName;
        targetField.options = ((_tool$formOptions = tool.formOptions) == null ? void 0 : _tool$formOptions.target) || [];
        popover.append(createElement('span', {
          _textContent: targetField.label
        }), renderSegmentedField(targetField));
      }
      const unlinkLabel = toolset.unlink.label;
      popover.appendChild(createElement('button', {
        type: 'button',
        title: unlinkLabel,
        'aria-label': unlinkLabel,
        'data-action': 'unlink',
        _innerHTML: "<svg><use href=\"#wysi-delete\"></use></svg>"
      }));
    }

    // Image-specific fields
    if (toolName === 'image') {
      tool.extraSettings.forEach((setting, i) => {
        var _tool$formOptions2;
        const field = {
          name: setting,
          label: tool.extraSettingLabels[i],
          toolName,
          options: ((_tool$formOptions2 = tool.formOptions) == null ? void 0 : _tool$formOptions2[setting]) || []
        };
        popover.append(createElement('span', {
          _textContent: field.label
        }), renderSegmentedField(field));
      });
    }
    popover.append(createElement('button', {
      type: 'button',
      _textContent: 'Cancel'
    }), createElement('button', {
      type: 'button',
      'data-action': toolName,
      _textContent: 'Save'
    }));
    return wrapper;
  }

  /**
   * Render a segmented form field
   * @param {object} field - Field attributes
   * @returns {HTMLElement}
   */
  function renderSegmentedField(field) {
    const fieldId = uniqueFieldId++;
    const segmented = createElement('fieldset', {
      class: 'wysi-segmented'
    });
    segmented.appendChild(createElement('legend', {
      _textContent: field.label
    }));
    field.options.forEach(option => {
      const segmentId = uniqueFieldId++;
      segmented.append(createElement('input', {
        id: "wysi-seg-" + segmentId,
        name: "wysi-" + field.toolName + "-" + field.name + "-" + fieldId,
        type: 'radio',
        'data-attribute': field.name,
        value: option.value
      }), createElement('label', {
        for: "wysi-seg-" + segmentId,
        _textContent: option.label
      }));
    });
    return segmented;
  }

  /**
   * Open a popover
   * @param {HTMLElement} button - Popover button
   */
  function openPopover(button) {
    var _inputs$;
    const popoverContent = button.nextElementSibling;
    const inputs = popoverContent.querySelectorAll('input[type="text"]');
    const radioButtons = popoverContent.querySelectorAll('input[type="radio"]');
    const selection = document$1.getSelection();
    const anchorNode = selection.anchorNode;
    const {
      editor,
      nodes
    } = findInstance(anchorNode);
    const values = {};
    if (editor) {
      const action = button.dataset.action;
      const tool = toolset[action];
      let target = editor.querySelector("." + selectedClass);
      let selectContents = false;
      if (!target) {
        target = nodes.find(node => tool.tags.includes(node.tagName.toLowerCase()));
        selectContents = true;
      }
      if (target) {
        var _tool$extraSettings;
        const range = document$1.createRange();
        selectContents ? range.selectNodeContents(target) : range.selectNode(target);
        setCurrentSelection(range);
        tool.attributes.forEach(attr => values[attr] = target.getAttribute(attr));
        (_tool$extraSettings = tool.extraSettings) == null ? void 0 : _tool$extraSettings.forEach(setting => {
          var _tool$formOptions$set;
          (_tool$formOptions$set = tool.formOptions[setting]) == null ? void 0 : _tool$formOptions$set.forEach(option => {
            if (!option.criterion) return;
            const [key, value] = Object.entries(option.criterion)[0];
            if (target.style[key] === value) {
              values[setting] = option.value;
            }
          });
        });
      } else if (selection && editor.contains(anchorNode) && selection.rangeCount) {
        setCurrentSelection(selection.getRangeAt(0));
      }
    }
    inputs.forEach(input => input.value = values[input.dataset.attribute] || '');
    radioButtons.forEach(radio => radio.checked = radio.value === (values[radio.dataset.attribute] || ''));
    toggleButton(button, true);
    (_inputs$ = inputs[0]) == null ? void 0 : _inputs$.focus();
  }

  /**
   * Execute popover action
   * @param {HTMLElement} button - Action button
   */
  function execPopoverAction(button) {
    const action = button.dataset.action;
    const selection = getCurrentSelection();
    const parent = button.parentNode;
    const inputs = parent.querySelectorAll('input[type="text"]');
    const radioButtons = parent.querySelectorAll('input[type="radio"]');
    const {
      editor
    } = findInstance(button);
    const options = [];
    inputs.forEach(input => options.push(input.value));
    radioButtons.forEach(radio => {
      if (radio.checked) options.push(radio.value);
    });
    if (action === 'image') {
      var _selected$parentNode;
      const selected = editor == null ? void 0 : editor.querySelector("." + selectedClass);
      if ((selected == null ? void 0 : (_selected$parentNode = selected.parentNode) == null ? void 0 : _selected$parentNode.tagName) === 'A') options.push(selected.parentNode.outerHTML);
    } else if (action === 'link' && selection) {
      options.push(getFragmentContent(selection.cloneContents()));
    }
    execAction(action, editor, options);
  }
  const closePopover = function (ignoreSelection) {
    var _document$querySelect;
    if (ignoreSelection === void 0) {
      ignoreSelection = true;
    }
    (_document$querySelect = document$1.querySelector('.wysi-popover [aria-expanded="true"]')) == null ? void 0 : _document$querySelect.setAttribute('aria-expanded', 'false');
    if (!ignoreSelection) restoreCurrentSelection();
  };

  // Event listeners
  addListener(document$1, 'click', '.wysi-popover > button', e => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    closePopover();
    popoverJustOpened = true;
    openPopover(e.target);
  });
  addListener(document$1, 'keydown', '.wysi-popover > button', e => {
    if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) {
      openPopover(e.target);
      e.preventDefault();
    }
  });
  addListener(document$1, 'click', '.wysi-popover > div > button[data-action]', e => {
    execPopoverAction(e.target);
    closePopover(true);
  });
  addListener(document$1, 'click', '.wysi-popover > div > button:not([data-action])', () => closePopover());
  addListener(document$1, 'click', '.wysi-popover *:not(button)', e => e.stopImmediatePropagation());
  addListener(document$1, 'keydown', '.wysi-popover *', e => {
    const {
      target
    } = e;
    const form = target.parentNode.tagName === 'DIV' ? target.parentNode : target.parentNode.parentNode;
    switch (e.key) {
      case 'Tab':
        const firstField = form.querySelector('input');
        const lastField = !target.nextElementSibling && !target.parentNode.nextElementSibling;
        if (e.shiftKey && target === firstField) {
          form.lastElementChild.focus();
          e.preventDefault();
        } else if (!e.shiftKey && lastField) {
          firstField.focus();
          e.preventDefault();
        }
        break;
      case 'Enter':
        if (target.tagName === 'INPUT') {
          form.querySelector('[data-action]:last-of-type').click();
          e.preventDefault();
        }
        break;
      case 'Escape':
        closePopover();
        e.stopImmediatePropagation();
        break;
    }
  });
  let popoverJustOpened = false;
  addListener(document$1, 'click', () => {
    if (!popoverJustOpened) closePopover();
    popoverJustOpened = false;
  });

  /**
   * Render a list box
   * @param {object} details - List box properties
   * @returns {HTMLElement}
   */
  function renderListBox(_ref) {
    let {
      label,
      items,
      classes = []
    } = _ref;
    const classList = Array.isArray(classes) ? classes : [classes];
    const listBox = createElement('div', {
      class: ['wysi-listbox', ...classList].join(' ')
    });
    const button = createElement('button', {
      type: 'button',
      title: label,
      'aria-label': label + " " + items[0].label,
      'aria-haspopup': 'listbox',
      'aria-expanded': false,
      _innerHTML: renderListBoxItem(items[0])
    });
    const menu = createElement('div', {
      role: 'listbox',
      'aria-label': label
    });
    items.forEach(item => {
      menu.appendChild(createElement('button', {
        type: 'button',
        role: 'option',
        'aria-label': item.label,
        'aria-selected': false,
        'data-action': item.action,
        'data-option': item.name || '',
        _innerHTML: renderListBoxItem(item)
      }));
    });
    listBox.append(button, menu);
    return listBox;
  }
  const renderListBoxItem = item => item.icon ? "<svg><use href=\"#wysi-" + item.icon + "\"></use></svg>" : item.label;
  const openListBox = button => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    const selectedItem = button.nextElementSibling.querySelector('[aria-selected="true"]') || button.nextElementSibling.firstElementChild;
    toggleButton(button, !isOpen);
    selectedItem.focus();
  };
  function selectListBoxItem(item) {
    var _listBox$querySelecto;
    const listBox = item.parentNode;
    const button = listBox.previousElementSibling;
    (_listBox$querySelecto = listBox.querySelector('[aria-selected="true"]')) == null ? void 0 : _listBox$querySelecto.setAttribute('aria-selected', 'false');
    item.setAttribute('aria-selected', 'true');
    button.innerHTML = item.innerHTML;
  }
  const closeListBox = () => {
    var _document$querySelect;
    (_document$querySelect = document$1.querySelector('.wysi-listbox [aria-expanded="true"]')) == null ? void 0 : _document$querySelect.setAttribute('aria-expanded', 'false');
  };

  // Event listeners
  addListener(document$1, 'click', '.wysi-listbox > button', e => {
    e.target.getAttribute('aria-expanded') === 'true' ? closeListBox() : openListBox(e.target);
  });
  addListener(document$1, 'click', '.wysi-listbox > div > button', e => {
    const item = e.target;
    if (item.hasAttribute('disabled')) return;
    const {
      editor
    } = findInstance(item);
    const selection = document$1.getSelection();
    if (selection && editor.contains(selection.anchorNode)) {
      execAction(item.dataset.action, editor, [item.dataset.option]);
    }
    selectListBoxItem(item);
    closeListBox();
  });
  addListener(document$1, 'click', e => {
    if (!e.target.closest('.wysi-listbox')) closeListBox();
  });
  addListener(document$1, 'keydown', e => {
    const listBox = document$1.querySelector('.wysi-listbox:has([aria-expanded="true"]) > [role="listbox"]');
    if (listBox && e.target === listBox.lastElementChild && !e.shiftKey) closeListBox();
  });

  /**
   * Render the toolbar
   * @param {array} tools - List of tools
   * @param {object} customActions - Custom actions
   * @returns {HTMLElement}
   */
  function renderToolbar(tools, customActions) {
    if (customActions === void 0) {
      customActions = {};
    }
    const toolbar = createElement('div', {
      class: 'wysi-toolbar'
    });
    tools.forEach(toolName => {
      switch (toolName) {
        case '|':
          toolbar.appendChild(createElement('div', {
            class: 'wysi-separator'
          }));
          break;
        case '-':
          toolbar.appendChild(createElement('div', {
            class: 'wysi-newline'
          }));
          break;
        case 'format':
          toolbar.appendChild(renderFormatTool());
          break;
        default:
          if (typeof toolName === 'string' && customActions[toolName]) {
            toolbar.appendChild(createElement('button', {
              type: 'button',
              title: customActions[toolName].label,
              'aria-label': customActions[toolName].label,
              'aria-pressed': false,
              'data-custom-action': toolName,
              _innerHTML: customActions[toolName].innerHTML
            }));
          } else if (typeof toolName === 'object' && toolName.items) {
            toolbar.appendChild(renderToolGroup(toolName));
          } else if (typeof toolName === 'string') {
            renderTool(toolName, toolbar);
          }
      }
    });
    return toolbar;
  }
  function renderTool(name, toolbar) {
    const tool = toolset[name];
    const button = createElement('button', {
      type: 'button',
      title: tool.label,
      'aria-label': tool.label,
      'aria-pressed': false,
      'data-action': name,
      _innerHTML: "<svg><use href=\"#wysi-" + name + "\"></use></svg>"
    });
    toolbar.appendChild(tool.hasForm ? renderPopover(name, button) : button);
  }
  function renderToolGroup(_ref) {
    let {
      label = 'Select an item',
      items
    } = _ref;
    return renderListBox({
      label,
      items: items.map(action => ({
        label: toolset[action].label,
        icon: action,
        action
      }))
    });
  }
  function renderFormatTool() {
    return renderListBox({
      label: toolset.format.label,
      classes: 'wysi-format',
      items: toolset.format.tags.map(tag => ({
        name: tag,
        label: tag === 'p' ? toolset.format.paragraph : toolset.format.heading + " " + tag.slice(1),
        action: 'format'
      }))
    });
  }

  /**
   * Update toolbar buttons state
   */
  function updateToolbarState() {
    var _instances$instanceId;
    const selection = document$1.getSelection();
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;
    const range = selection.getRangeAt(0);
    const candidate = findDeepestChildNode(range.startContainer.nextElementSibling || range.startContainer);
    const selectedNode = range.intersectsNode(candidate) ? candidate : anchorNode;
    const {
      toolbar,
      editor,
      nodes
    } = findInstance(selectedNode);
    if (!editor) return;
    const tags = nodes.map(n => n.tagName.toLowerCase());
    const selectedObj = editor.querySelector("." + selectedClass);
    if (selectedObj) tags.push(selectedObj.tagName.toLowerCase());
    const instanceId = getInstanceId$1(editor);
    const allowedTags = ((_instances$instanceId = instances[instanceId]) == null ? void 0 : _instances$instanceId.allowedTags) || {};

    // Reset states
    toolbar.querySelectorAll('[aria-pressed="true"]').forEach(btn => btn.setAttribute('aria-pressed', 'false'));
    toolbar.querySelectorAll('.wysi-listbox > div > button:first-of-type').forEach(selectListBoxItem);

    // Update states
    tags.forEach(tag => {
      if (['p', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
        const format = toolbar.querySelector("[data-action=\"format\"][data-option=\"" + tag + "\"]");
        if (format) selectListBoxItem(format);
      } else {
        var _allowedTags$tag, _toolbar$querySelecto;
        const action = (_allowedTags$tag = allowedTags[tag]) == null ? void 0 : _allowedTags$tag.toolName;
        if (action) (_toolbar$querySelecto = toolbar.querySelector("[data-action=\"" + action + "\"]")) == null ? void 0 : _toolbar$querySelecto.setAttribute('aria-pressed', 'true');
      }
    });

    // Disable the h1 button if there's already an H1 element in the content
    const h1Button = toolbar.querySelector('[data-action="format"][data-option="h1"]');
    if (h1Button) {
      const hasH1 = editor.querySelector('.wysi-editor h1');
      if (hasH1) h1Button.setAttribute('disabled', '');else h1Button.removeAttribute('disabled');
    }
  }

  /**
   * Embed SVG icons
   */
  function embedSVGIcons() {
    const icons = '<svg id="wysi-svg-icons" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="wysi-highlight" viewBox="0 0 24 24"><path d="M14.962 6.1H17.172V18H14.962V6.1ZM8.808 18H6.598V6.1H8.808V18ZM15.132 12.9H8.621V11.013H15.132V12.9Z"/></symbol><symbol id="wysi-bold" viewBox="0 0 24 24"><path d="M16.5,9.5A3.5,3.5,0,0,0,13,6H8.5a1,1,0,0,0-1,1V17a1,1,0,0,0,1,1H13a3.49,3.49,0,0,0,2.44-6A3.5,3.5,0,0,0,16.5,9.5ZM13,16H9.5V13H13a1.5,1.5,0,0,1,0,3Zm0-5H9.5V8H13a1.5,1.5,0,0,1,0,3Z"/></symbol><symbol id="wysi-italic" viewBox="0 0 24 24"><path d="M17,6H11a1,1,0,0,0,0,2h1.52l-3.2,8H7a1,1,0,0,0,0,2h6a1,1,0,0,0,0-2H11.48l3.2-8H17a1,1,0,0,0,0-2Z"/></symbol><symbol id="wysi-underline" viewBox="0 0 24 24"><path d="M12,15.5a5,5,0,0,0,5-5v-5a1,1,0,0,0-2,0v5a3,3,0,0,1-6,0v-5a1,1,0,0,0-2,0v5A5,5,0,0,0,12,15.5Zm5,2H7a1,1,0,0,0,0,2H17a1,1,0,0,0,0-2Z"/></symbol><symbol id="wysi-strike" viewBox="0 0 24 24"><path d="M12 6C9.33 6 7.5 7.34 7.5 9.5c0 .58.12 1.07.35 1.5H13c-1.49-.34-3.49-.48-3.5-1.5 0-1.03 1.08-1.75 2.5-1.75s2.5.83 2.5 1.75h2C16.5 7.4 14.67 6 12 6zm-5.5 6c-.67 0-.67 1 0 1h4.35c.5.17 1.04.34 1.65.5.58.15 1.75.23 1.75 1s-.66 1.75-2.25 1.75-2.5-1.01-2.5-1.75h-2c0 1.64 1.33 3.5 4.5 3.5s4.5-2.08 4.5-3.5c0-.58-.05-1.07-.2-1.5h1.2c.67 0 .67-1 0-1z"/></symbol><symbol id="wysi-ul" viewBox="0 0 24 24"><path d="M3 6a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7zm-4 5a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7zm-4 5a1 1 0 0 0-1 1 1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1zm4 0a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H7z"/></symbol><symbol id="wysi-ol" viewBox="0 0 24 24"><path d="M4 5c-.25 0-.5.17-.5.5v3c0 .67 1 .67 1 0v-3c0-.33-.25-.5-.5-.5zm4.5 1c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2zm-6 5.5h.75c0-.43.34-.75.75-.75.4 0 .75.28.75.75L2.5 13.25V14h3v-.75H3.75L5.5 12v-.5c0-.9-.73-1.49-1.5-1.5-.77 0-1.5.59-1.5 1.5zm6-.5c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2zM4 15c-.83 0-1.5.63-1.5 1.25h.75c0-.28.34-.5.75-.5s.75.22.75.5-.34.5-.75.5v.5c.41 0 .75.22.75.5s-.34.5-.75.5-.75-.22-.75-.5H2.5c0 .62.67 1.25 1.5 1.25s1.5-.5 1.5-1.12c0-.34-.2-.66-.56-.88.35-.2.56-.53.56-.87 0-.62-.67-1.12-1.5-1.12zm4.5 1c-1.33 0-1.33 2 0 2h12c1.33 0 1.33-2 0-2z"/></symbol><symbol id="wysi-link" viewBox="0 0 24 24"><path d="M8,12a1,1,0,0,0,1,1h6a1,1,0,0,0,0-2H9A1,1,0,0,0,8,12Zm2,3H7A3,3,0,0,1,7,9h3a1,1,0,0,0,0-2H7A5,5,0,0,0,7,17h3a1,1,0,0,0,0-2Zm7-8H14a1,1,0,0,0,0,2h3a3,3,0,0,1,0,6H14a1,1,0,0,0,0,2h3A5,5,0,0,0,17,7Z"/></symbol><symbol id="wysi-quote" viewBox="0 0 24 24"><path d="m9 6c-2.2 0-4 1.96-4 4.36v6c0 0.903 0.672 1.64 1.5 1.64h3c0.828 0 1.5-0.733 1.5-1.64v-3.27c0-0.903-0.672-1.64-1.5-1.64h-1.75c-0.414 0-0.75-0.367-0.75-0.818v-0.273c0-1.2 0.899-2.18 2-2.18h0.5c0.274 0 0.5-0.246 0.5-0.545v-1.09c0-0.298-0.226-0.545-0.5-0.545zm8 0c-2.2 0-4 1.96-4 4.36v6c0 0.903 0.672 1.64 1.5 1.64h3c0.828 0 1.5-0.733 1.5-1.64v-3.27c0-0.903-0.672-1.64-1.5-1.64h-1.75c-0.414 0-0.75-0.367-0.75-0.818v-0.273c0-1.2 0.899-2.18 2-2.18h0.5c0.274 0 0.5-0.246 0.5-0.545v-1.09c0-0.298-0.226-0.545-0.5-0.545z"/></symbol><symbol id="wysi-hr" viewBox="0 0 24 24"><path d="m20 11h-16c-1.33 0-1.33 2 0 2 0 0 16-0.018 16 0 1.33 0 1.33-2 0-2z"/></symbol><symbol id="wysi-removeFormat" viewBox="0 0 24 24"><path d="M7 6C5.67 6 5.67 8 7 8h3l-2 7c0 .02 2 0 2 0l2-7h3c1.33 0 1.33-2 0-2H7zm7.06 7c-.79-.04-1.49.98-.75 1.72l.78.78-.78.79c-.94.93.47 2.35 1.4 1.4l.79-.78.78.79c.94.93 2.35-.47 1.41-1.41l-.78-.79.78-.78c.94-.94-.47-2.35-1.4-1.41l-.8.79-.77-.79a.99.99 0 0 0-.66-.3zM7 16c-1.33 0-1.33 2 0 2 .02-.02 4 0 4 0 1.33 0 1.33-2 0-2H7z"/></symbol><symbol id="wysi-delete" viewBox="0 0 24 24"><path d="M10,18a1,1,0,0,0,1-1V11a1,1,0,0,0-2,0v6A1,1,0,0,0,10,18ZM20,6H16V5a3,3,0,0,0-3-3H11A3,3,0,0,0,8,5V6H4A1,1,0,0,0,4,8H5V19a3,3,0,0,0,3,3h8a3,3,0,0,0,3-3V8h1a1,1,0,0,0,0-2ZM10,5a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V6H10Zm7,14a1,1,0,0,1-1,1H8a1,1,0,0,1-1-1V8H17Zm-3-1a1,1,0,0,0,1-1V11a1,1,0,0,0-2,0v6A1,1,0,0,0,14,18Z"/></symbol><symbol id="wysi-autoFormat" viewBox="0 0 24 24"><path d="M9.24207 13.6332C9.3924 13.4826 9.64745 13.6099 9.61753 13.8206L9.44154 15.0569C9.40295 15.3287 9.42821 15.6058 9.51531 15.8662C9.60241 16.1266 9.74896 16.3631 9.94334 16.557L10.8268 17.4387C10.9774 17.5891 10.8501 17.8441 10.6394 17.8142L9.40312 17.6382C9.1313 17.5996 8.85422 17.6249 8.59386 17.712C8.33349 17.7991 8.09699 17.9456 7.9031 18.14L7.02133 19.0235C6.98861 19.0566 6.94629 19.0785 6.90039 19.0861C6.85449 19.0937 6.80737 19.0866 6.76574 19.0658C6.72412 19.045 6.69012 19.0116 6.66859 18.9704C6.64706 18.9292 6.63911 18.8822 6.64586 18.8361L6.82186 17.5998C6.86047 17.3281 6.83528 17.0511 6.74827 16.7907C6.66127 16.5304 6.51485 16.2939 6.3206 16.1L5.43659 15.218C5.40352 15.1853 5.38162 15.1429 5.37403 15.097C5.36643 15.0511 5.37353 15.004 5.3943 14.9624C5.41507 14.9208 5.44846 14.8868 5.4897 14.8652C5.53093 14.8437 5.57792 14.8358 5.62395 14.8425L6.86027 15.0185C7.13201 15.0571 7.40901 15.0319 7.66932 14.9449C7.92963 14.8579 8.16611 14.7115 8.36003 14.5172L9.24207 13.6332ZM13.8229 4.57726C13.8505 4.56499 13.8813 4.56173 13.9108 4.56793C13.9404 4.57413 13.9672 4.58949 13.9875 4.61182C14.0079 4.63415 14.0206 4.66232 14.024 4.69232C14.0274 4.72232 14.0213 4.75263 14.0065 4.77894L13.6101 5.48601C13.4336 5.80145 13.4157 6.18105 13.5617 6.51168L13.8899 7.25288C13.9022 7.28047 13.9055 7.31122 13.8993 7.34077C13.8931 7.37032 13.8777 7.39716 13.8554 7.41748C13.833 7.4378 13.8049 7.45057 13.7749 7.45397C13.7449 7.45737 13.7146 7.45123 13.6883 7.43642L12.9812 7.04001C12.8257 6.95287 12.6521 6.90313 12.4741 6.89475C12.2961 6.88636 12.1185 6.91955 11.9555 6.99169L11.2144 7.31989C11.1868 7.33216 11.156 7.33542 11.1265 7.32922C11.0969 7.32302 11.0701 7.30766 11.0498 7.28533C11.0294 7.263 11.0167 7.23483 11.0133 7.20483C11.0099 7.17483 11.016 7.14452 11.0308 7.11821L11.4272 6.41114C11.5144 6.25567 11.5641 6.08204 11.5725 5.90401C11.5809 5.72598 11.5477 5.54845 11.4755 5.38547L11.1474 4.64427C11.1351 4.61668 11.1318 4.58593 11.138 4.55638C11.1442 4.52683 11.1596 4.49999 11.1819 4.47967C11.2042 4.45935 11.2324 4.44658 11.2624 4.44318C11.2924 4.43979 11.3227 4.44593 11.349 4.46074L12.0561 4.85715C12.2116 4.94429 12.3852 4.99402 12.5632 5.00241C12.7412 5.01079 12.9188 4.9776 13.0817 4.90546L13.8229 4.57726ZM5.87908 7.79045C5.88874 7.76074 5.90741 7.73479 5.9325 7.71618C5.95759 7.69758 5.98785 7.68726 6.01908 7.68665C6.05031 7.68605 6.08095 7.69518 6.10674 7.7128C6.13254 7.73041 6.1522 7.75562 6.163 7.78493L6.44594 8.58177C6.57207 8.93798 6.85835 9.21334 7.21919 9.32553L8.02641 9.57728C8.05611 9.58694 8.08207 9.60561 8.10067 9.6307C8.11927 9.65579 8.12959 9.68605 8.1302 9.71728C8.13081 9.74851 8.12167 9.77915 8.10406 9.80494C8.08645 9.83074 8.06124 9.8504 8.03193 9.86121L7.23511 10.1441C7.05956 10.2064 6.90094 10.3086 6.77184 10.4429C6.64273 10.5771 6.54669 10.7396 6.49135 10.9174L6.2396 11.7246C6.22995 11.7543 6.21128 11.7803 6.18619 11.7989C6.1611 11.8175 6.13083 11.8278 6.09961 11.8284C6.06838 11.829 6.03774 11.8199 6.01195 11.8023C5.98615 11.7847 5.96649 11.7595 5.95568 11.7302L5.67275 10.9333C5.61054 10.7578 5.50826 10.5992 5.37403 10.47C5.2398 10.3409 5.07733 10.2449 4.8995 10.1896L4.09331 9.93779C4.06361 9.92813 4.03765 9.90946 4.01905 9.88437C4.00045 9.85928 3.99013 9.82902 3.98952 9.79779C3.98891 9.76656 3.99805 9.73592 4.01566 9.71012C4.03327 9.68433 4.05848 9.66466 4.08779 9.65386L4.88462 9.37092C5.24083 9.24479 5.51618 8.95851 5.62837 8.59766L5.87908 7.79045Z"/><path d="M11.2416 9.3966C12.0824 8.80382 13.2533 8.93276 13.9427 9.7257L19.6224 16.2599L19.7347 16.4025L19.7425 16.4132C20.3351 17.2538 20.2068 18.4239 19.4144 19.1134C18.6215 19.8027 17.4439 19.7674 16.6937 19.0636L16.5492 18.9142L10.8783 12.3898C10.1428 11.5437 10.2325 10.26 11.0785 9.52453L11.2416 9.3966ZM13.9252 13.5821L17.6947 17.9181L17.7709 17.9894C17.9602 18.1341 18.2306 18.1299 18.4173 17.9679C18.6306 17.7821 18.6545 17.4588 18.4691 17.2452L14.6996 12.9083L13.9252 13.5821ZM12.7982 10.7208C12.6127 10.5074 12.2875 10.4846 12.0736 10.67C11.8603 10.8559 11.8381 11.1811 12.0238 11.3946L12.93 12.4376L13.7045 11.7638L12.7982 10.7208Z"/></symbol><symbol id="wysi-markdownExport" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 8.33317C1 6.30813 2.64162 4.6665 4.66667 4.6665H19.3333C21.3583 4.6665 23 6.30813 23 8.33317V15.6665C23 17.6915 21.3583 19.3332 19.3333 19.3332H4.66667C2.64162 19.3332 1 17.6915 1 15.6665V8.33317ZM4.66667 6.49984C3.65414 6.49984 2.83333 7.32065 2.83333 8.33317V15.6665C2.83333 16.6791 3.65414 17.4998 4.66667 17.4998H19.3333C20.3459 17.4998 21.1667 16.6791 21.1667 15.6665V8.33317C21.1667 7.32065 20.3459 6.49984 19.3333 6.49984H4.66667ZM6.21012 8.38021C6.58443 8.25544 6.9966 8.38419 7.23333 8.69984L9.25 11.3887L11.2667 8.69984C11.5034 8.38419 11.9156 8.25544 12.2899 8.38021C12.6642 8.50498 12.9167 8.85528 12.9167 9.24984V14.7498C12.9167 15.2561 12.5063 15.6665 12 15.6665C11.4937 15.6665 11.0833 15.2561 11.0833 14.7498V11.9998L9.98333 13.4665C9.81022 13.6973 9.53853 13.8332 9.25 13.8332C8.96147 13.8332 8.68978 13.6973 8.51667 13.4665L7.41667 11.9998V14.7498C7.41667 15.2561 7.00626 15.6665 6.5 15.6665C5.99374 15.6665 5.58333 15.2561 5.58333 14.7498V9.24984C5.58333 8.85528 5.83581 8.50498 6.21012 8.38021ZM17.5 9.24984C17.5 8.74358 17.0896 8.33317 16.5833 8.33317C16.0771 8.33317 15.6667 8.74358 15.6667 9.24984V12.5368L15.3982 12.2683C15.0402 11.9104 14.4598 11.9104 14.1018 12.2683C13.7439 12.6263 13.7439 13.2067 14.1018 13.5647L15.9352 15.398C16.2931 15.756 16.8736 15.756 17.2315 15.398L19.0648 13.5647C19.4228 13.2067 19.4228 12.6263 19.0648 12.2683C18.7069 11.9104 18.1265 11.9104 17.7685 12.2683L17.5 12.5368V9.24984Z"/></symbol></defs></svg>';
    document$1.body.appendChild(buildFragment(icons));
  }

  // Event listeners
  addListener(document$1, 'mousedown', '.wysi-editor, .wysi-editor *', () => {
    var _document$querySelect;
    (_document$querySelect = document$1.querySelector("." + selectedClass)) == null ? void 0 : _document$querySelect.classList.remove(selectedClass);
  });
  addListener(document$1, 'mousedown', '.wysi-editor mark', e => e.target.classList.add(selectedClass));
  addListener(document$1, 'click', '.wysi-toolbar > button', e => {
    const button = e.target;
    const state = JSON.parse(button.getAttribute('aria-pressed'));
    const action = button.dataset.action;
    const customAction = button.dataset.customAction;
    const {
      editor
    } = findInstance(button);
    const selection = document$1.getSelection();

    // Skip buttons inside popovers - those are handled by popover.js
    if (button.closest('.wysi-popover')) return;
    if (customAction) {
      var _instance$customActio, _instance$customActio2;
      const instanceId = getInstanceId$1(editor);
      const instance = instances[instanceId];
      const actionFn = instance == null ? void 0 : (_instance$customActio = instance.customActions) == null ? void 0 : (_instance$customActio2 = _instance$customActio[customAction]) == null ? void 0 : _instance$customActio2.action;
      if (actionFn) actionFn(editor);
    } else if (action && selection && editor.contains(selection.anchorNode)) {
      execAction(action, editor, {
        state,
        selection
      });
    }
  });
  addListener(document$1, 'selectionchange', updateToolbarState);
  addListener(document$1, 'input', '.wysi-editor', updateToolbarState);
  DOMReady(embedSVGIcons);

  const STYLE_ATTR = 'style';

  /**
   * Enable HTML tags belonging to a set of tools
   * @param {array} tools - Array of tool names
   * @returns {object} Allowed tags
   */
  function enableTags(tools) {
    const allowedTags = cloneObject(settings.allowedTags);
    tools.forEach(toolName => {
      const tool = cloneObject(toolset[toolName]);
      if (!(tool != null && tool.tags)) return;
      const {
        tags,
        extraTags = [],
        alias = [],
        attributes = [],
        styles = [],
        isEmpty = false
      } = tool;
      const aliasTag = alias.length ? tags[0] : undefined;
      const allTags = [...tags, ...extraTags, ...alias];
      allTags.forEach(tag => {
        allowedTags[tag] = {
          attributes,
          styles,
          alias: aliasTag,
          isEmpty
        };
        if (!extraTags.includes(tag)) allowedTags[tag].toolName = toolName;
      });
    });
    return allowedTags;
  }

  /**
   * Prepare raw content for editing
   * @param {string} content - Raw content
   * @param {object} allowedTags - Allowed tags
   * @param {boolean} filterOnly - Only filter, no cleaning
   * @returns {string} Filtered HTML
   */
  function prepareContent(content, allowedTags, filterOnly) {
    if (filterOnly === void 0) {
      filterOnly = false;
    }
    const fragment = buildFragment(content);
    filterContent(fragment, allowedTags);
    if (!filterOnly) {
      wrapTextNodes(fragment);
      cleanContent(fragment, allowedTags);
    }
    const container = createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
  }

  /**
   * Filter unsupported CSS styles from node
   * @param {HTMLElement} node - Element to filter
   * @param {array} allowedStyles - Supported styles
   */
  function filterStyles(node, allowedStyles) {
    const styleAttr = node.getAttribute(STYLE_ATTR);
    if (!styleAttr) return;
    const styles = styleAttr.split(';').map(s => {
      const [name, value] = s.split(':').map(p => p.trim());
      return {
        name,
        value
      };
    }).filter(s => allowedStyles.includes(s.name)).map(_ref => {
      let {
        name,
        value
      } = _ref;
      return name + ": " + value + ";";
    }).join('');
    if (styles) node.setAttribute(STYLE_ATTR, styles);else node.removeAttribute(STYLE_ATTR);
  }

  /**
   * Remove unsupported HTML tags and attributes
   * @param {Node} node - Parent element to filter
   * @param {object} allowedTags - Allowed tags
   */
  function filterContent(node, allowedTags) {
    for (const child of [...node.childNodes]) {
      // Element nodes
      if (child.nodeType === 1) {
        filterContent(child, allowedTags);
        const tag = child.tagName.toLowerCase();
        const allowedTag = allowedTags[tag];
        if (allowedTag) {
          const {
            attributes = [],
            styles = []
          } = allowedTag;
          for (const attr of [...child.attributes]) {
            if (!attributes.includes(attr.name)) {
              if (attr.name === STYLE_ATTR && styles.length) {
                filterStyles(child, styles);
              } else {
                child.removeAttribute(attr.name);
              }
            }
          }
          if (allowedTag.alias) replaceNode(child, allowedTag.alias, true);
        } else if (tag === 'style') {
          node.removeChild(child);
        } else {
          child.replaceWith(...child.childNodes);
        }
      } else if (child.nodeType === 8) {
        // Remove comment nodes
        node.removeChild(child);
      }
    }
  }

  /**
   * Remove empty nodes
   * @param {Node} node - Parent element
   * @param {object} allowedTags - Allowed tags
   */
  function cleanContent(node, allowedTags) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        cleanContent(child, allowedTags);
        const tag = child.tagName.toLowerCase();
        const allowedTag = allowedTags[tag];
        if (allowedTag && !allowedTag.isEmpty && trimText(child.innerHTML) === '') {
          node.removeChild(child);
        }
      }
    }
  }

  /**
   * Wrap child text nodes in paragraphs
   * @param {Node} node - Parent element
   */
  function wrapTextNodes(node) {
    let appendToPrev = false;
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== 3 && blockElements.includes(child.tagName)) {
        appendToPrev = false;
        continue;
      }
      if (trimText(child.textContent) === '') {
        node.removeChild(child);
      } else if (appendToPrev) {
        var _child$previousElemen;
        (_child$previousElemen = child.previousElementSibling) == null ? void 0 : _child$previousElemen.appendChild(child);
      } else {
        replaceNode(child, 'p');
        appendToPrev = true;
      }
    }
  }

  let nextId = 0;

  /**
   * Init WYSIWYG editor instances
   * @param {object} options - Configuration options
   */
  function init(options) {
    const tools = options.tools || settings.tools;
    const selector = options.el || settings.el;
    const customActions = options.customActions || {};
    const toolbar = renderToolbar(tools, customActions);
    const allowedTags = enableTags(tools);
    getTargetElements(selector).forEach(field => {
      const sibling = field.previousElementSibling;
      if (!sibling || !hasClass(sibling, 'wysi-wrapper')) {
        const instanceId = String(nextId++);
        instances[instanceId] = options;
        instances[instanceId].allowedTags = cloneObject(allowedTags);
        const wrapper = createElement('div', {
          class: 'wysi-wrapper'
        });
        const editor = createElement('div', {
          class: 'wysi-editor',
          contenteditable: true,
          role: 'textbox',
          'aria-multiline': true,
          'aria-label': getTextAreaLabel(field),
          'data-wid': instanceId,
          _innerHTML: prepareContent(field.value, allowedTags)
        });
        wrapper.append(toolbar.cloneNode(true), editor);
        field.before(wrapper);
        configure(wrapper, options);
      } else configure(sibling, options);
    });
  }

  /**
   * Configure editor instance
   * @param {HTMLElement} instance - Editor wrapper
   * @param {object} options - Configuration options
   */
  function configure(instance, options) {
    if (typeof options !== 'object') return;
    for (const [key, val] of Object.entries(options)) {
      switch (key) {
        case 'autoGrow':
        case 'autoHide':
          instance.classList.toggle("wysi-" + key.toLowerCase(), !!val);
          break;
        case 'height':
          if (!isNaN(val)) {
            const editor = instance.lastElementChild;
            editor.style.minHeight = val + "px";
            editor.style.maxHeight = val + "px";
          }
          break;
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
  function updateContent(textarea, editor, instanceId, rawContent, setEditorContent) {
    if (setEditorContent === void 0) {
      setEditorContent = false;
    }
    const instance = instances[instanceId];
    const content = prepareContent(rawContent, instance.allowedTags);
    if (setEditorContent) editor.innerHTML = content;
    textarea.value = content;
    dispatchEvent(textarea, 'change');
    instance.onChange == null ? void 0 : instance.onChange(content);
  }

  /**
   * Destroy editor instance
   * @param {string} selector - Textarea selectors
   */
  function destroy(selector) {
    findEditorInstances(selector).forEach(_ref => {
      let {
        instanceId,
        wrapper,
        editor
      } = _ref;
      delete instances[instanceId];
      clearHistory(editor);
      wrapper.remove();
    });
  }

  /**
   * Set editor content programmatically
   * @param {string} selector - Textarea selectors
   * @param {string} content - New content
   */
  function setContent(selector, content) {
    findEditorInstances(selector).forEach(_ref2 => {
      let {
        textarea,
        editor,
        instanceId
      } = _ref2;
      updateContent(textarea, editor, instanceId, content, true);
      clearHistory(editor);
    });
  }

  /**
   * Clean up pasted content
   * @param {object} event - Paste event
   */
  function cleanPastedContent(event) {
    const {
      editor,
      nodes
    } = findInstance(event.target);
    const clipboardData = event.clipboardData;
    if (!editor || !clipboardData.types.includes('text/html')) return;
    const instanceId = getInstanceId$1(editor);
    const allowedTags = instances[instanceId].allowedTags;
    let pastedContent = prepareContent(clipboardData.getData('text/html'), allowedTags);
    const splitHeadingTag = nodes.some(n => headingElements.includes(n.tagName));
    if (splitHeadingTag && !isFirefox) {
      const splitter = "<h1 class=\"" + placeholderClass + "\"><br></h1><p class=\"" + placeholderClass + "\"><br></p>";
      pastedContent = splitter + pastedContent + splitter;
    }
    execCommand('insertHTML', pastedContent);
    event.preventDefault();
    if (splitHeadingTag && !isFirefox) {
      editor.querySelectorAll("." + placeholderClass).forEach(el => el.remove());
      editor.querySelectorAll(headingElements.join()).forEach(heading => {
        const firstChild = heading.firstElementChild;
        if (firstChild && blockElements.includes(firstChild.tagName)) {
          heading.replaceWith(...heading.childNodes);
        }
      });
    }
  }

  /**
   * Bootstrap the editor
   */
  function bootstrap() {
    ['styleWithCSS', 'enableObjectResizing', 'enableInlineTableEditing'].forEach(cmd => execCommand(cmd, false));
    execCommand('defaultParagraphSeparator', 'p');

    // Input handler
    addListener(document$1, 'input', '.wysi-editor', e => {
      const editor = e.target;
      if (suppressInputEvents.has(editor)) return;
      const textarea = editor.parentNode.nextElementSibling;
      updateContent(textarea, editor, getInstanceId$1(editor), editor.innerHTML);
    });

    // Paste handler
    addListener(document$1, 'paste', cleanPastedContent);

    // Keyboard shortcuts
    addListener(document$1, 'keydown', e => {
      if (!(e.target.closest != null && e.target.closest('.wysi-editor'))) return;
      const {
        editor
      } = findInstance(e.target);
      if (!editor) return;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();
      if (isCtrl && key === 'z' && !isShift && canUndo(editor)) {
        e.preventDefault();
        undo(editor);
      } else if (isCtrl && key === 'y' || isCtrl && isShift && key === 'z' && canRedo(editor)) {
        e.preventDefault();
        redo(editor);
      }
    });
  }

  // Expose Wysi to global scope
  window.Wysi = (() => {
    const Wysi = options => DOMReady(() => init(options || {}));
    Object.entries({
      destroy,
      setContent
    }).forEach(_ref3 => {
      let [key, fn] = _ref3;
      Wysi[key] = function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return DOMReady(fn, args);
      };
    });
    return Wysi;
  })();
  DOMReady(bootstrap);

})(window, document);
