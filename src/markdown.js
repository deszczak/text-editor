/**
 * Convert HTML content to Markdown.
 * @param {HTMLElement} element - Element containing HTML content
 * @returns {string} Markdown text
 */
export function htmlToMarkdown(element) {
  const processNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const tag = node.tagName.toLowerCase()
    const content = [...node.childNodes].map(processNode).join('')

    const converters = {
      h1: () => `# ${content}\n\n`,
      h2: () => `## ${content}\n\n`,
      h3: () => `### ${content}\n\n`,
      h4: () => `#### ${content}\n\n`,
      p: () => `${content}\n\n`,
      strong: () => `**${content}**`,
      b: () => `**${content}**`,
      em: () => `_${content}_`,
      i: () => `_${content}_`,
      u: () => `<u>${content}</u>`,
      s: () => `~~${content}~~`,
      del: () => `~~${content}~~`,
      strike: () => `~~${content}~~`,
      mark: () => `==${content}==`,
      a: () => `[${content}](${node.getAttribute('href') || ''})`,
      blockquote: () => content.split('\n').filter(l => l.trim()).map(l => `> ${l}`).join('\n') + '\n\n',
      ul: () => content,
      ol: () => content,
      li: () => {
        const parent = node.parentElement
        const prefix = parent?.tagName.toLowerCase() === 'ol' 
          ? `${[...parent.children].indexOf(node) + 1}. ` 
          : '- '
        return `${prefix}${content}\n`
      },
      br: () => '\n',
      hr: () => '---\n\n',
      div: () => `${content}\n`
    }

    return converters[tag]?.() ?? content
  }

  return [...element.childNodes].map(processNode).join('').trim()
}