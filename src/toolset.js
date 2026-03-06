// Supported tools
export default {
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
      target: [
        { label: 'Current tab', value: '' },
        { label: 'New tab', value: '_blank' }
      ]
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
}