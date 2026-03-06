import document from 'document';

// Instances storage
export const instances = {};

// The CSS class to use for selected elements
export const selectedClass = 'wysi-selected';

// Placeholder elements CSS class
export const placeholderClass = 'wysi-fragment-placeholder';

// Heading elements
export const headingElements = ['H1', 'H2', 'H3', 'H4'];

// Block type HTML elements
export const blockElements = ['BLOCKQUOTE', 'HR', 'P', 'OL', 'UL'].concat(headingElements);

// Detect Firefox browser
export const isFirefox = navigator.userAgent.search(/Gecko\//) > -1;

/**
 * Create an element and optionally set its attributes.
 * @param {string} tag The HTML tag of the new element.
 * @param {object} [attributes] The element's attributes.
 * @return {object} An HTML element.
 */
export function createElement(tag, attributes) {
  const element = document.createElement(tag);

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
export function replaceNode(node, tag, copyAttributes) {
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