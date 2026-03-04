Wysi({
  el: '#demo1',
  darkMode: true,
  height: 300,
  autoGrow: true,
  autoHide: false,
  tools: [
    'format', '|',
    'bold', 'italic', 'underline', 'strike', 'highlight', '|',
    'ul', 'ol', '|',
    'link', 'hr', 'quote', '|',
    'autoFormat', '|',
    'removeFormat', '|',
    'markdownExport'
  ],
  onChange: (content) => {
    console.log('Content changed:', content);
  }
});