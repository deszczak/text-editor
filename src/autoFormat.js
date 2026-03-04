/**
 * Text formatting utilities
 */

// Orphans
const ORPHAN_PATTERN = /(^| )([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /gm;
const DOUBLE_ORPHAN_PATTERN = /\xa0([wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ]) /g;

/**
 * Add non-breaking spaces after orphans
 */
export const nbsp = (text) => {
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
export const dash = (text) => {
  return text.replace(/(\s-)+\s/g, (match) =>
    match === ' - ' ? ' – ' : match
  );
};

/**
 * Fix spacing around punctuation marks
 * Removes spaces before punctuation and normalizes spaces after
 */
export const punctuation = (text) => {
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
export const autoFormat = (text) => {
  return punctuation(nbsp(dash(text)));
};

/**
 * Format all text nodes within a container element
 * @param {Element} container The element containing text to format
 */
export const formatTextNodes = (container) => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        return node.textContent.length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

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
