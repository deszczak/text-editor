/**
 * Convert HTML content to Markdown.
 * @param {HTMLElement} element The element containing HTML content.
 * @return {string} The Markdown text.
 */
export function htmlToMarkdown(element) {
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
        return `# ${content}\n\n`;
      case 'h2':
        return `## ${content}\n\n`;
      case 'h3':
        return `### ${content}\n\n`;
      case 'h4':
        return `#### ${content}\n\n`;
      case 'p':
        return `${content}\n\n`;
      case 'strong':
      case 'b':
        return `**${content}**`;
      case 'em':
      case 'i':
        return `_${content}_`;
      case 'u':
        return `<u>${content}</u>`;
      case 's':
      case 'del':
      case 'strike':
        return `~~${content}~~`;
      case 'mark':
        return `==${content}==`;
      case 'a':
        const href = node.getAttribute('href') || '';
        return `[${content}](${href})`;
      case 'blockquote':
        return content.split('\n').filter(line => line.trim()).map(line => `> ${line}`).join('\n') + '\n\n';
      case 'ul':
        return content;
      case 'ol':
        return content;
      case 'li':
        const parent = node.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(node) + 1;
          return `${index}. ${content}\n`;
        }
        return `- ${content}\n`;
      case 'br':
        return '\n';
      case 'hr':
        return '---\n\n';
      case 'div':
        return `${content}\n`;
      default:
        return content;
    }
  }

  for (const child of element.childNodes) {
    markdown += processNode(child);
  }

  return markdown.trim();
}