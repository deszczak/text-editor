// Default settings
export default {
  el: '[data-wysi], .wysi-field',
  tools: [
    'format', '|',
    'bold', 'italic', 'underline', 'strike', 'highlight', '|',
    'ul', 'ol', '|',
    'link', 'hr', 'quote', '|',
    'autoFormat', 'removeFormat', '|',
    'markdownExport'
  ],
  height: 200,
  autoGrow: false,
  autoHide: false,
  allowedTags: {
    br: { attributes: [], styles: [], isEmpty: true },
    p: { attributes: [], styles: [], isEmpty: false }
  }
}