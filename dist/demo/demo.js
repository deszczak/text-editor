Wysi({
  el: '#demo1',
  height: 300,
  autoGrow: true,
  autoHide: false,
  tools: [
    'goBack',
    'format', '|',
    'bold', 'italic', 'underline', 'strike', 'highlight', '|',
    'ul', 'ol', '|',
    'link', 'hr', 'quote', '|',
    'autoFormat', 'removeFormat', '|',
    'markdownExport'
  ],
  customActions: {
    goBack: {
      innerHTML: `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      `,
      label: 'Go back',
      action: () => {
        console.log('Custom action – Go back – was executed.')
      }
    }
  },
  onChange: (content) => {
    console.log('Content changed:', content);
  }
});